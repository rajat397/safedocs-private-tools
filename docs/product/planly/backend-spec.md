# Planly Backend Spec — creation-core

Status: CONDITIONAL GO (creation-core only).
Binding sources: DECISION + planner. This file is normative for backend.
Stack: **Stack A — Supabase PG + Auth + RLS + Cloudflare Pages + Workers (Hono + Drizzle)**.
Separate origin LOCKED. Toolbox untouched.

Scope: creation-core only. Steps 2–6, Sprint/Daily are empty-until-probed
NULL placeholders (see §12). G1/G2 guards gate progress (see §13).

Research caps assumed (free tier, verified):
Supabase 500MB / 50k MAU / 60 direct / 200 pooler / pauses after 7d inactivity;
Workers 100k req/day, 10ms CPU; Pages 500 builds/mo;
Hono + Drizzle via Hyperdrive officially supported;
Neon / Vercel / Render fallback only with suspend/sleep disqualifiers.

---

## 1. Architecture (deep modules, one external seam)

One external seam: `Worker (Hono) → Hyperdrive → Supavisor (transaction mode) → Supabase PG`.
Pages serves static origin only. No direct browser → PG. No toolbox coupling.

Modules (depth = leverage at interface; interface = full caller contract):

| Module | Interface (small) | Implementation hides |
|---|---|---|
| Drafts | `POST /v1/drafts`, `POST /v1/drafts/:id/bind`, step GET/PUT | anon→auth merge, cookie issue, version OCC |
| Steps | `GET …/steps/:n`, `PUT …` | step-definition fetch, 409/422 mapping |
| Generate | `POST …/generate` + `Idempotency-Key` → 202 `{opId}` | entitlement choke 1, op enqueue, worker poll |
| Operations | `GET /v1/operations/:opId` | async state machine, TTL, poll-to-visible |
| Plans | `GET /v1/plans/:id` teaser-or-full + ETag | TeaserGuard runtime filter, entitlement choke 2 |
| Readjustments | `POST …/readjustments` (baseVersion required) | append-only, monotonic version, choke 3 |
| Identity | `identity_links` table + bind endpoint | merge-loss=0 SQL, p_caller_user binding |
| Entitlement | `canGenerate / canReadFull / canReadjust` | 3 choke points, false-allow=0 |
| TeaserGuard | lint rule + runtime filter | teaser/full field partition |

Separate origin LOCKED: `app.planly.*` (Pages) + `api.planly.*` (Worker route).
Canonical hosts ONLY `app.planly.*` (Pages) and `api.planly.*` (Worker).
Non-canonical `Host` → 301 to canonical; never serve API on Pages origin.
CORS (normative): `allowOrigin https://app.planly.*` only (wildcard-subdomain
match, no other origins), `methods GET,POST,PUT` only,
`headers Authorization,Content-Type,Idempotency-Key,If-Match,If-None-Match` only,
`allowCredentials true`. Preflight `OPTIONS` → 204 with
`Access-Control-Allow-Origin` echo iff origin matches `https://app.planly.*`,
plus `Vary: Origin`. Toolbox paths, cookies, storage keys untouched.

Free-stack wiring (normative):

```text
Browser ──HTTPS──▶ Pages (static, app origin)
Browser ──HTTPS──▶ Worker api.planly.* (Hono)
Worker ──Hyperdrive──▶ Supavisor pooler (transaction mode, NOT session mode)
Supavisor ──▶ Supabase PG (RLS ON, app role restricted, see §6)
Worker ──▶ Supabase Auth (verify JWT, jwks cache 10 min)
```

Why transaction mode: Workers have no persistent TCP; Hyperdrive pools +
Supavisor transaction mode required. Consequence: no advisory locks,
no `SET LOCAL`, no prepared-statement-held transactions across awaits,
no LISTEN/NOTIFY, NO `auth.uid()` inside transaction-mode RPCs (session
vars / JWT context do not persist through Hyperdrive+Supavisor pooling).
All multi-statement atomicity via single-statement
or RPC functions with `SECURITY DEFINER` + explicit caller args.
Normative RPC auth pattern: Worker verifies Supabase JWT (JWKS cache 10m),
then passes `p_caller_user` (= `sub` from verified JWT, NULL when anon)
and `p_caller_draft` (= `draftId` cookie value, NULL when absent) as
explicit RPC args. Every `rpc_*` MUST assert
`p_caller_user = verified-JWT-sub AND (p_caller_draft = cookie draft OR
caller owns draft)` else raise 403 `forbidden` — never trust body draftId,
never call `auth.uid()` in tx-mode.

---

## 2. Aggregates + invariants

### 2.1 Draft (mutable pre-generation root)

```ts
Draft { id: uuid PK, owner_user_id: uuid NULL, anon_id: uuid NULL,
  version: int >=1, status: 'open'|'generating'|'generated'|'abandoned',
  created_at, updated_at }
```

- Anonymous create allowed (`owner_user_id NULL`, `anon_id` set).
- Authenticated create sets `owner_user_id = p_caller_user` (verified JWT sub; never `auth.uid()` in tx-mode).
- Server sets `Set-Cookie: draftId=<id>; Secure; HttpOnly; SameSite=Lax; Path=/; Domain=.planly.*; Max-Age=2592000` (30d).
- Client never sends draftId in body as authority; cookie + JWT are authority.
- Draft TTL 30d: `created_at` + 30d. Nightly purge cron DELETES drafts with
  `created_at < now() - interval '30 days'` (CASCADE steps/operations).
  GET on purged draft → 404; GET on discarded draft → 410 (see §3.1a).
  Anon create rate cap: 20/IP/hr on `POST /v1/drafts` (anon only);
  over cap → 429 + `Retry-After` (seconds to window reset).

### 2.2 Step (per-draft ordered slot)

```ts
Step { draft_id FK, n int, payload jsonb, version int, updated_at }
PK (draft_id, n)
```

- `n` is 1-based creation-core step index. Only Step 1 active; Steps 2–6 NULL placeholders (§12).
- PUT uses optimistic concurrency: caller sends `If-Match: <version>`; mismatch → 409.
- Body caps (normative): step `payload` JSON ≤ 32KB; readjustment `delta` JSON ≤ 64KB (measured on serialised body bytes). Over cap → 413 + `Retry-After` NOT set; client must shrink. Caps enforced in Worker before PG.
- Skip-ahead guard: PUT with `n > current_max_n + 1` (skipping an unprobed slot) → 409 `{ "code":"STEP_AHEAD", "currentMax":<m> }`. Steps must be filled sequentially; Steps 2–6 unprobed → 422 `STEP_UNPROBED` (§12).

### 2.3 Plan (immutable output)

```ts
Plan { id uuid PK, draft_id FK, version int >=1, full jsonb NOT NULL,
  teaser jsonb NOT NULL, created_at }
```

- Immutable: NO UPDATE / DELETE permitted (REVOKE + RLS + trigger, §6).
- New generation / readjustment creates new row with `version = max+1`.
- `full` = entitled payload; `teaser` = safe subset (TeaserGuard §9).

### 2.4 Readjustment (append-only delta)

```ts
Readjustment { id uuid PK, plan_id FK, base_version int NOT NULL,
  delta jsonb NOT NULL, author_user_id uuid NOT NULL, created_at }
```

- `baseVersion` required in request; must equal a real `plans.version` for that plan family.
- Never mutates `plans`; worker materialises next `plans.version` from `base + delta`.

### 2.5 IdentityLink (anon→auth bind)

```ts
IdentityLink { anon_id uuid, user_id uuid, draft_id uuid, created_at,
  PK (draft_id), UNIQUE (anon_id, draft_id) }
```

- Written exactly once per draft by `POST /v1/drafts/:id/bind`.
- Merge must be idempotent and lossless (merge-loss=0 SLO).

### 2.6 Operation (async generate tracker)

```ts
Operation { id uuid PK (opId), draft_id FK, idempotency_key text NOT NULL,
  status: 'accepted'|'running'|'succeeded'|'failed', plan_id NULL,
  error_code NULL, created_at, updated_at, ttl_expires_at }
UNIQUE (draft_id, idempotency_key)
```

- Returned as 202 `{ opId }`. Polled via `GET /v1/operations/:opId`.
- TTL 24h (`ttl_expires_at = created_at + 24h`); succeeded ops retain `plan_id` pointer.
- Op TTL cron job (hourly): rows with `ttl_expires_at <= now()` are served as
  410 Gone on GET, then hard-DELETEd by cron (retained 24h then DELETE).
  Idempotency keys reusable ONLY after DELETE (see §6).

### 2.7 Entitlement (derived, not stored as mutable flag)

```ts
Entitlement { user_id, can_generate bool, can_read_full bool, can_readjust bool }
```

- Derived from Auth user + PG `entitlements` table (Stripe/webhook later; free-tier default: allow creation-core, deny bulk).
- Enforced at 3 choke points (§8). `false-allow=0` SLO.

### 2.8 Invariants → enforcement map (INV-1..INV-5)

| ID | Invariant | PG enforcement |
|---|---|---|
| INV-1 | Draft visible only to owner (auth) or holder of matching `draftId` cookie pre-bind; after bind only `owner_user_id` | RLS ON, deny-by-default (no permissive anon/authenticated policies; default DENY all); GRANT SELECT only (§4); all reads via RLS owner-or-cookie check on explicit `p_caller_user`/`p_caller_draft` args (never `auth.uid()` in tx-mode); RPCs assert `p_caller_user=verified-JWT-sub AND (p_caller_draft=cookie draft OR owner)` else 403; CHECK `owner_user_id IS NOT NULL OR anon_id IS NOT NULL` |
| INV-2 | Plans immutable | `REVOKE UPDATE, DELETE ON plans FROM app_role`; `BEFORE UPDATE OR DELETE` trigger always raises; RLS FOR SELECT only + GRANT SELECT only; INSERT only via RPC |
| INV-3 | Readjustments append-only, `base_version` must exist, monotonic | `REVOKE UPDATE, DELETE ON readjustments`; CHECK `base_version >= 1`; FK + RPC verifies `EXISTS (SELECT 1 FROM plans WHERE id=plan_id AND version=base_version)`; UNIQUE `(plan_id, id)` ordering by `created_at`; GRANT SELECT only, writes via RPC |
| INV-4 | Step `n` in range, PUT needs version match | CHECK `n BETWEEN 1 AND 6`; RPC compares `version`, raises `conflict_409` on mismatch; skip-ahead `n>max+1` → 409 `STEP_AHEAD`; payload schema validated → 422; body >32KB → 413 |
| INV-5 | Unentitled callers receive teaser only, never full | RLS never exposes `plans.full` to anon role; Worker selects `teaser` vs `full` per entitlement; TeaserGuard lint+runtime (§9); `false-allow=0` telemetry alert |

---

## 3. Contracts (status codes normative)

Auth: `Authorization: Bearer <supabase JWT>` when logged in; always send
`Cookie: draftId=…` when present. Worker resolves principal =
`p_caller_user NULL? anon : user` (verified JWT sub; never `auth.uid()` in tx-mode).

### 3.1 POST /v1/drafts → 201

Creates draft (anon or auth). Sets `Set-Cookie: draftId=<id>; Secure; HttpOnly; SameSite=Lax; Path=/; Domain=.planly.*; Max-Age=2592000`.

```http
POST /v1/drafts
→ 201 { "id": "uuid", "version": 1, "status": "open" } + Set-Cookie
→ 400 malformed body | 429 over cap + Retry-After | 5xx
```

Rate cap (S-H1): anon `POST /v1/drafts` max 20/IP/hr (sliding window, Worker KV/counter). Over cap → 429 `{ "code":"RATE_LIMITED" }` + `Retry-After: <seconds>`. Authed creates uncapped in creation-core (abuse telemetry only). `next=` redirect param allowlist (exact-match only): allowed values exactly `%2Fplanly`, `%2Fplanly%2Fdraft`, `%2Fdashboard`. Reject if contains `//`, `http:`, `%2F%2F` (decoded `//`), or any other value → 400 `{ "code":"BAD_NEXT" }`. Exact string match post-decode; no prefix/substring match.

### 3.1a POST /v1/drafts/:id/discard → 200, then GET → 410

```http
POST /v1/drafts/:id/discard
→ 200 { "id":"uuid", "status":"discarded" }
→ 401 no cookie+no JWT match | 403 not owner | 404 unknown draft | 410 already discarded/purged
```

Effect: sets `drafts.status='discarded'` via RPC (`rpc_draft_discard(p_draft,p_caller_user,p_caller_draft)` with same 403 assert as §1). Subsequent `GET /v1/drafts/:id`, `GET …/steps/:n`, `PUT …/steps/:n`, `POST …/generate` on that id → 410 `{ "code":"DISCARDED" }`. Discarded drafts still purged by the 30d purge cron. Cookie cleared via `Set-Cookie: draftId=; Max-Age=0; Secure; HttpOnly; SameSite=Lax; Path=/; Domain=.planly.*`.

### 3.2 GET /v1/drafts/:id/steps/:n → 200

```http
GET /v1/drafts/:id/steps/1
→ 200 { "n":1, "payload":{…}, "version":3 } + ETag: "v3"
→ 401 no cookie+no JWT match | 403 not owner | 404 unknown draft/step
```

Step-definition fetch SLO: p95 < 300ms.

### 3.3 PUT /v1/drafts/:id/steps/:n → 200 / 409 / 422

```http
PUT /v1/drafts/:id/steps/1
If-Match: "v3"
{ "payload": {…} }
→ 200 { "n":1, "version":4 }
→ 409 { "code":"VERSION_CONFLICT", "currentVersion":4 } on stale If-Match
→ 409 { "code":"STEP_AHEAD", "currentMax":1 } when n > currentMax+1 (skip-ahead)
→ 422 { "code":"SCHEMA_INVALID", "errors":[…] } on payload violation
→ 413 { "code":"PAYLOAD_TOO_LARGE" } when payload > 32KB
→ 410 { "code":"DISCARDED" } when draft discarded
→ 401/403/404 as above
```

Save SLO: p95 < 400ms. 409 must include `currentVersion` so client can rebase
without data loss (merge-loss=0).

### 3.4 POST /v1/drafts/:id/bind → 200 (idempotent)

Binds anon draft to logged-in identity; writes `identity_links`; merges ownership.

```http
POST /v1/drafts/:id/bind   (requires JWT)
→ 200 { "id":"uuid", "owner_user_id":"uuid", "merged":true }
→ 200 { "merged":false } when already bound to same user (idempotent)
→ 401 no JWT | 403 bound to different user | 404 unknown draft | 409 already bound elsewhere
```

Side effect: `Set-Cookie` refreshed; old `anon_id` preserved in `identity_links`.

### 3.5 POST /v1/drafts/:id/generate → 202

Requires `Idempotency-Key: <uuid/v4>` header. Entitlement choke 1.

```http
POST /v1/drafts/:id/generate
Idempotency-Key: 550e8400-…
{ "stepSnapshotVersion": 4 }
→ 202 { "opId": "uuid", "status":"accepted" }
→ 402 { "code":"ENTITLED_REQUIRED" } when can_generate=false
→ 409 { "code":"STEP_STALE", "currentVersion":5 }
→ 422 step incomplete | 401/403/404 | 429 cap
```

Accept SLO: p95 < 600ms (enqueue only, not full generation).
Duplicate delivery with same `(draft_id, Idempotency-Key)` returns original
`opId` with 200 (not a new op) — `duplicate=0` SLO (no double generation).

### 3.6 GET /v1/operations/:opId → 200

```http
GET /v1/operations/<opId>
→ 200 { "opId":"…", "status":"running", "draftId":"…" }
→ 200 { "opId":"…", "status":"succeeded", "planId":"…", "planVersion":1 }
→ 200 { "status":"failed", "errorCode":"…" }
→ 404 unknown op | 403 not owner
```

Poll-to-visible SLO: < 60s from 202 to `succeeded` visible via plan GET.
Client polls with backoff 1s→2s→5s, stops at 60s, then surfaces retry.
(Normative everywhere: delays 1s, 2s, 5s, 5s … capped at 5s, hard stop 60s —
no other backoff schedule permitted.) Expired op GET → 410 `{ "code":"OP_GONE" }`.

### 3.7 GET /v1/plans/:id → 200 teaser-or-full + ETag

```http
GET /v1/plans/<planId>
→ 200 { "id":"…", "version":1, "teaser":{…}, "full":null }          # unentitled
→ 200 { "id":"…", "version":1, "teaser":{…}, "full":{…} }           # entitled
  + ETag: "plan-<id>-v1" (+ 304 on If-None-Match)
→ 404 | 403 (bound-draft access only)
```

Teaser/full partition enforced by TeaserGuard (§9). `full:null` explicit
(not omitted) so clients can distinguish teaser from error.

### 3.8 POST /v1/plans/:id/readjustments → 201 (baseVersion required)

Entitlement choke 3.

```http
POST /v1/plans/<planId>/readjustments
{ "baseVersion": 1, "delta": {…} }
→ 201 { "readjustmentId":"…", "baseVersion":1, "opId":"…" }
→ 400 missing baseVersion | 409 baseVersion unknown/stale
→ 402 entitled required | 422 delta invalid | 413 delta > 64KB
```

Readjustment enqueues a new Operation; resulting plan is new immutable version.

Status-code summary: 200 OK, 201 created, 202 accepted, 304 not-modified,
400 missing field / BAD_NEXT, 401 unauthenticated, 402 entitled-required (custom, documented),
403 forbidden (RPC caller assert fail), 404 not-found, 409 conflict/stale/STEP_AHEAD,
410 Gone (DISCARDED draft / OP_GONE expired op), 413 payload-too-large (step >32KB / delta >64KB),
422 schema-invalid, 429 cap + Retry-After,
5xx with `requestId`.

---

## 4. PG schema (Drizzle source of truth, PG enforcement)

Drizzle schema in Worker repo; migrations via Supabase SQL. Excerpt:

```sql
-- roles: app_role (Worker only via Hyperdrive). REVOKE everything, grant per-object.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM app_role, anon, authenticated;

CREATE TABLE drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES auth.users(id),
  anon_id uuid NOT NULL DEFAULT gen_random_uuid(),
  version int NOT NULL DEFAULT 1 CHECK (version >= 1),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','generating','generated','abandoned','discarded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (owner_user_id IS NOT NULL OR anon_id IS NOT NULL)          -- INV-1
);
CREATE TABLE steps (
  draft_id uuid NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
  n int NOT NULL CHECK (n BETWEEN 1 AND 6),                          -- INV-4 range
  payload jsonb NOT NULL DEFAULT '{}',
  version int NOT NULL DEFAULT 1 CHECK (version >= 1),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (draft_id, n)
);
CREATE TABLE plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES drafts(id) ON DELETE RESTRICT,
  version int NOT NULL CHECK (version >= 1),
  teaser jsonb NOT NULL, full jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (draft_id, version)
);
CREATE TABLE readjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  base_version int NOT NULL CHECK (base_version >= 1),               -- INV-3
  delta jsonb NOT NULL,
  author_user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE identity_links (
  draft_id uuid PRIMARY KEY REFERENCES drafts(id) ON DELETE CASCADE,
  anon_id uuid NOT NULL, user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (anon_id, draft_id)
);
CREATE TABLE operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'accepted'
    CHECK (status IN ('accepted','running','succeeded','failed')),
  plan_id uuid REFERENCES plans(id) ON DELETE SET NULL,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ttl_expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  UNIQUE (draft_id, idempotency_key)
);
CREATE TABLE entitlements (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  can_generate bool NOT NULL DEFAULT true,
  can_read_full bool NOT NULL DEFAULT true,
  can_readjust bool NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Immutability (INV-2, INV-3)
CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'immutable_table %', TG_TABLE_NAME USING ERRCODE='25001'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER plans_no_mut BEFORE UPDATE OR DELETE ON plans
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER readj_no_mut BEFORE UPDATE OR DELETE ON readjustments
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- Grants (least privilege; Worker uses app_role only via Hyperdrive).
-- NORMATIVE: GRANT SELECT only. NO GRANT INSERT/UPDATE/DELETE on any table.
-- ALL writes go through RPCs (SECURITY DEFINER) below, never direct DML.
GRANT SELECT ON drafts, steps TO app_role;
GRANT SELECT ON plans, readjustments, operations, identity_links TO app_role;
GRANT SELECT ON entitlements TO app_role;
GRANT EXECUTE ON FUNCTION
  rpc_step_put(uuid,int,jsonb,int,uuid,uuid),
  rpc_draft_bind(uuid,uuid,uuid,uuid),
  rpc_draft_discard(uuid,uuid,uuid),
  rpc_generate_enqueue(uuid,text,int,uuid,uuid),
  rpc_operation_complete(uuid,uuid,text,uuid),
  rpc_readjust_enqueue(uuid,int,jsonb,uuid,uuid,uuid)
TO app_role;

-- RLS ON everywhere; deny-by-default (no permissive policies; default DENY).
-- No policy grants anon/authenticated direct access. SELECT policies allow
-- a row ONLY when explicit RPC/RLS args match: (p_caller_user = owner_user_id)
-- OR (p_caller_draft = draft id/anon holder pre-bind). RPCs assert
-- p_caller_user = verified-JWT-sub AND (p_caller_draft = cookie draft OR owner)
-- else raise 403 `forbidden` (ERRCODE P0004). NEVER use auth.uid() in tx-mode.
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE readjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations ENABLE ROW LEVEL SECURITY;
-- Direct SELECT policies: owner-only (Worker passes JWT claim through
-- Hyperdrive session arg; see RPC pattern). No permissive anon policies.
```

RLS notes: Worker never uses `service_role` key (forbidden in Worker env;
Hyperdrive binding only for DB access; secrets = Hyperdrive connection +
Supabase anon key + JWKS URL only). `anon`/`authenticated`
have zero direct grants (revoked). All writes go through RPCs that take
`(p_caller_user, p_caller_draft)` as explicit args derived from verified
JWT (JWKS cache 10m) + `draftId` cookie — never `auth.uid()` inside pooler
transaction-mode sessions where session vars don't persist. RLS default DENY.

---

## 5. Auth-merge SQL (bind, lossless, idempotent)

`POST /v1/drafts/:id/bind` → `rpc_draft_bind(p_draft, p_anon, p_caller_user, p_caller_draft)`:

```sql
CREATE OR REPLACE FUNCTION rpc_draft_bind(p_draft uuid, p_anon uuid, p_caller_user uuid, p_caller_draft uuid)
RETURNS TABLE (merged boolean, owner uuid) AS $$
DECLARE v_owner uuid; v_anon uuid;
BEGIN
  -- Caller assert (deny-by-default): JWT sub must equal p_caller_user AND
  -- cookie draft must equal target or caller must already own it; else 403.
  IF p_caller_user IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='P0004'; END IF;
  IF p_caller_draft IS DISTINCT FROM p_draft THEN
    -- allow only if caller already owns the draft (token-rebind path)
    PERFORM 1 FROM drafts WHERE id = p_draft AND owner_user_id = p_caller_user;
    IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='P0004'; END IF;
  END IF;
  SELECT owner_user_id, anon_id INTO v_owner, v_anon FROM drafts WHERE id = p_draft FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'draft_not_found' USING ERRCODE='P0002'; END IF;
  IF v_owner IS NOT NULL AND v_owner <> p_caller_user THEN
    RAISE EXCEPTION 'bound_to_other' USING ERRCODE='P0003';
  END IF;
  INSERT INTO identity_links (draft_id, anon_id, user_id)
    VALUES (p_draft, p_anon, p_caller_user) ON CONFLICT (draft_id) DO NOTHING;
  IF v_owner IS NULL THEN
    UPDATE drafts SET owner_user_id = p_caller_user, version = version + 1,
      updated_at = now() WHERE id = p_draft;
    RETURN QUERY SELECT true, p_caller_user;
  ELSE
    RETURN QUERY SELECT false, v_owner;  -- idempotent replay
  END IF;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
```

Discard: `rpc_draft_discard(p_draft, p_caller_user, p_caller_draft)` asserts
same 403 rule, then `UPDATE drafts SET status='discarded'` (only from
`open/generating`); already-discarded → 410 path. No `auth.uid()` anywhere.

Properties: replay-safe (`ON CONFLICT DO NOTHING`, `merged:false`);
never steals bound drafts (403 path); every anon step row preserved —
`steps` keyed by `draft_id` so no row moves; merge-loss=0 verified by
count check `steps before == steps after` in telemetry.

---

## 6. Idempotency (generate + readjust)

- Header `Idempotency-Key` required on `POST …/generate` (and
  `POST …/readjustments`). Must be UUIDv4; else 400.
- `UNIQUE (draft_id, idempotency_key)` on `operations`.
- `rpc_generate_enqueue` inserts `accepted` or returns existing `opId`
  on conflict → caller gets 200 + existing `opId` (not 202-new).
- Key scope: per-draft. TTL 24h (`ttl_expires_at = created_at + 24h`).
  Keys retained 24h then DELETEd by hourly cron; reuse allowed ONLY after DELETE.
  Live-row check: if `ttl_expires_at <= now()` → `GET /v1/operations/:opId`
  returns 410 `{ "code":"OP_GONE" }`; re-POST with same key before DELETE
  returns 410 (not a new op, not the old op). After cron DELETE, same key
  may create a fresh op.
- `duplicate=0` SLO: exactly one `running/succeeded` op per key; verified by
  unique-violation counter = 0 unexpected duplicates.

```sql
-- sketch (SECURITY DEFINER, caller assert first, never auth.uid())
-- 1) SELECT id,status,ttl_expires_at FROM operations
--      WHERE draft_id=p_draft AND idempotency_key=p_key;
-- 2) IF FOUND AND ttl_expires_at <= now() THEN RAISE 'op_gone' ERRCODE 'P0005'; -- 410
-- 3) IF FOUND THEN RETURN existing id (200, duplicate-safe);
-- 4) ELSE INSERT (draft_id, idempotency_key, status='accepted',
--      ttl_expires_at=now()+interval '24 hours') RETURNING id; -- 202
-- Cron hourly: DELETE FROM operations WHERE ttl_expires_at <= now();
```

---

## 7. Entitlement — 3 choke points

Derived in Worker per request: `SELECT can_* FROM entitlements WHERE user_id = ?`
(anon → all false except teaser). Missing row → defaults (generate:true
during creation-core beta, readjust:true; tightened later without schema change).

| # | Choke | Location | Deny code |
|---|---|---|---|
| C1 | generate accept | `POST …/generate` before enqueue | 402 `ENTITLED_REQUIRED` |
| C2 | full-plan read | `GET /v1/plans/:id` field projection | teaser-only 200 (`full:null`) |
| C3 | readjust create | `POST …/readjustments` before enqueue | 402 `ENTITLED_REQUIRED` |

`false-allow=0`: every allow at C1/C2-full/C3 emits `entitlement.allow`
telemetry with `user_id, choke, policy_version`; nightly query asserts
`allow ⟹ entitlements.can_* = true at request time`. Any violation pages.

---

## 8. TeaserGuard — lint + runtime (BOTH required)

Field partition (PROVISIONAL until P4 — normative for creation-core only):
`teaser` may contain title, summary ≤280 chars,
step count, price-range bucket only. `full` contains everything else
(itinerary detail, vendor data, PII-adjacent notes). Teaser keys TBD at P4;
until then default-deny: any new field defaults to `full` (never teaser)
and any unlisted teaser key is stripped at runtime + fails lint.

- **Lint** (`teaser-guard` ESLint rule in Worker repo, runs in CI):
  forbids selecting `plans.full` in handlers marked `teaser-safe`;
  forbids adding keys to `teaser` builder without updating
  `TEASER_ALLOWLIST` constant; snapshot test asserts teaser fixture has
  exactly allowlisted keys.
- **Runtime** (`TeaserGuard.filter(plan, entitlement)` — the only path that
  serialises plans): strips `full` unless `can_read_full`; truncates
  `teaser.summary` to 280 chars; validates allowlist; logs
  `teaser.serve{mode:teaser|full}`.

Bypass requires explicit `TeaserGuard.unsafeFull()` call which logs a warning
and fails lint unless accompanied by `// teaser-guard: allow-full + reason`.

---

## 9. Free-stack wiring, caps, TTL

```text
Worker (Hono, 10ms CPU budget) → Hyperdrive (pool) → Supavisor tx-mode → PG
```

- Drizzle via `drizzle-orm/postgres-js` over Hyperdrive binding; all queries
  short + indexed (`drafts(id)`, `steps PK`, `plans(draft_id,version)`,
  `operations(draft_id,idempotency_key)`).
- No multi-round-trip transactions; use RPCs (§4–§6). No `LISTEN`, no advisory locks, no `auth.uid()` in tx-mode.
- Caps enforced in Worker before PG: anon draft create 20/IP/hr; per-IP 60/min on PUT/generate,
  per-draft 10 generates/hour, global shed at 80k req/day (under 100k limit).
  Every 429 includes `Retry-After` (seconds). Body caps: step payload ≤32KB,
  readjust delta ≤64KB → 413 (no Retry-After).
- TTLs/jobs: `draftId` cookie 30d (`Secure; HttpOnly; SameSite=Lax; Path=/; Domain=.planly.*`);
  draft purge cron (nightly) DELETEs `drafts WHERE created_at < now()-30d`;
  op TTL 24h cron (hourly) serves 410 then DELETEs `operations WHERE ttl_expires_at <= now()`;
  `teaser` CDN-cache 60s (s-maxage),
  `full` never cached at edge (`Cache-Control: private, no-store`);
  ETag on plans + steps enables 304.
- CORS/edge (normative): `Access-Control-Allow-Origin https://app.planly.*` only;
  `Allow-Methods GET,POST,PUT`; `Allow-Headers Authorization,Content-Type,Idempotency-Key,If-Match,If-None-Match`;
  `Allow-Credentials true`. Cookie attrs always `Secure; HttpOnly; SameSite=Lax; Path=/; Domain=.planly.*`.
- Secrets (normative): NO `service_role` key in Worker env; DB only via Hyperdrive binding;
  allowed secrets = Hyperdrive binding + Supabase anon key + JWKS URL. Supabase JWT verified per request with JWKS cache 10m.
- Poll backoff (normative, consistent): 1s→2s→5s, then 5s capped, hard stop 60s (§3.6).
- Supabase pause risk (7d inactivity): health-check cron (Worker scheduled
  event, 1 req/day) keeps project warm; cold-start path returns 503 +
  `Retry-After: 20` with telemetry `supabase.cold_start`.
- Pages 500 builds/mo: preview only on PR, production on main.
- Fallbacks (Neon/Vercel/Render) disqualified for free-tier suspend/sleep
  unless paid; documented only, not wired.

---

## 10. Telemetry + SLOs

Every request logs `{ requestId, route, principal, draftId?, opId?, latencyMs,
entitlement {c1,c2,c3}, teaserMode?, dbMs }` to Worker logs / analytics engine.

SLOs (binding, alerts on breach):

| SLO | Target | Probe |
|---|---|---|
| save p95 | < 400ms (`PUT step`) | histogram `http.put_step` |
| stepdef p95 | < 300ms (`GET step`) | histogram `http.get_step` |
| generate-accept p95 | < 600ms (`POST generate` → 202) | histogram `http.gen_accept` |
| poll-to-visible | < 60s (202 → plan readable) | `op.accepted → plan.served` trace |
| merge-loss | = 0 (bind never drops steps) | `steps_before == steps_after` assert per bind |
| duplicate | = 0 (no double-op per key) | unique-conflict unexpected counter |
| false-allow | = 0 (no unentitled full) | nightly entitlement join audit |

Dashboards: latency p50/p95 per route; op funnel
`accepted→running→succeeded/failed`; teaser vs full serve ratio;
429/402/409 rates.

---

## 11. TDD seams (pre-agreed test surfaces)

Per `/tdd`: tests live at public interfaces only. Agreed seams:

1. `PUT step` OCC seam — red: stale `If-Match` → 409 with `currentVersion`.
2. `generate` idempotency seam — red: same key twice → same `opId`, one op row; expired key → 410 `OP_GONE`, reuse only after DELETE.
3. `bind` merge seam — red: anon steps survive bind; replay → `merged:false`.
4. `TeaserGuard.filter` seam — red: unentitled gets `full:null`, allowlisted teaser only (PROVISIONAL partition until P4, default-deny full).
5. Entitlement choke seam — red: `can_generate=false` → 402, no op row created.
6. `discard` seam — red: `POST …/discard` → 200, next GET/PUT/generate → 410 `DISCARDED`.
7. `step-ahead + caps` seam — red: `n>max+1` → 409 `STEP_AHEAD`; payload >32KB / delta >64KB → 413; anon draft 21st/IP/hr → 429 + `Retry-After`.

No tests against Drizzle internals, SQL strings, or Hyperdrive mocks —
behaviour verified through Hono request/response + PG state via public GETs.

---

## 12. Steps 2–6, Sprint/Daily — NULL placeholders

Creation-core ships Step 1 only. Steps 2–6, Sprint, Daily exist as
empty-until-probed placeholders:

```sql
-- Step rows for n=2..6 are ABSENT (not empty payloads).
-- GET /v1/drafts/:id/steps/2..6 → 404 { "code":"STEP_UNPROBED", "n":N }
-- PUT …/steps/2..6 → 422 { "code":"STEP_UNPROBED" }
-- Sprint/Daily endpoints: not routed; any probe → 404 + telemetry `probe.unprobed`.
```

Rationale: keeps `CHECK (n BETWEEN 1 AND 6)` stable while preventing
phantom data. Activating a later step requires a spec amendment + migration
that seeds the step definition — never a silent NULL-fill.

---

## 13. G1 / G2 guards

- **G1 (contract guard, CI):** OpenAPI snapshot for §3 routes; TeaserGuard
  lint; status-code matrix test (409/422/402/202/304 cases); ETag round-trip.
  Merge blocked on G1 green.
- **G2 (SLO guard, staging):** k6 run asserting §10 SLOs (save/stepdef/
  gen-accept latencies, 60s poll-to-visible, merge-loss/duplicate/false-allow
  zero counters). Promote blocked on G2 green.

---

## 14. Non-goals (creation-core)

No Sprint/Daily logic, no billing webhooks beyond `entitlements` stub defaults,
no toolbox changes, no second origin, no direct browser→PG, no service_role
in Worker, no session-mode pooler features.

---

*File: `docs/product/planly/backend-spec.md` — owner: creation-core backend builder.
Siblings (`backend-plan.md`, `leadership-brief.md`) owned by other lanes; untouched.*
