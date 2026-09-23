<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->
# Planly creation-core — Backend Execution Plan

Date: 2026-09-21 UTC. Status: executable plan (builder-owned).
Scope: creation core only — Draft → Generate → Sprint/Daily read → Readjust + gates.
Skills route: `implement` + `tdd` (red→green at pre-agreed seams) + `codebase-design` (deep modules, seam discipline). No Task fan-out in this file.

## 0. Binding DECISION + planner (normative)

Same binding as spec (`docs/research/takeuforward-planly-plan-creation-technical-spec.md` §§1–6). This plan adds execution only; it cites, never edits, frozen rows.

- **Stack A (binding):** Supabase PG + Auth + RLS + Cloudflare Pages + Workers (Hono + Drizzle) via Hyperdrive → Supavisor transaction mode + cookie session (`httpOnly` `draftId` anon cookie name stays `draftId`; authed session via Supabase JWT; every auth redirect carries `next=` exact-allowlist ∈ {`%2Fplanly`, `%2Fplanly%2Fdraft`, `%2Fdashboard`}) + OpenAPI contracts (§4 matrix below, inherited from backend-spec §3) + invariants INV-1…INV-5 + SLOs (save p95 <400ms, step-def p95 <300ms, Generate-accept p95 <600ms, poll-to-visible p95 <60s, merge-loss 0, duplicate 0, false-allow 0) + G1/G2 guards (§6).
- **Hosts (binding, P-host):** canonical ONLY `app.planly.*` (Pages, static) + `api.planly.*` (Worker, all `/v1/*`). Non-canonical `Host` → `301` to canonical; never serve API on Pages origin. CORS: `allowOrigin https://app.planly.*` only, `methods GET,POST,PUT` only, `headers Authorization,Content-Type,Idempotency-Key,If-Match,If-None-Match` only, `allowCredentials true`; preflight `OPTIONS → 204` + `Vary: Origin`. `takeuforward.org/planly` is NOT an origin — kept only as legacy `returnTo` value validated vs `next=` allowlist (exact match, decode-once, open-redirect → `400`).
- **Naming (binding, P-naming per backend-spec §3):** `id` (draft/plan body field; cookie name `draftId` stays), `opId` (never `operationId`), `Idempotency-Key` header (never `idempotencyKey` body field), `readjustmentId` (never `eventId`), `version` + `status` + `n` (never `currentStep` alone). T4 `202 {opId, status:accepted}`; duplicate same `(draft_id, Idempotency-Key)` → `200` same `opId`.
- **Invariants (binding on every ticket):** INV-1 server-authoritative wizard · INV-2 forward-only back-nav merge · INV-3 auth merge preserves anon 1:1 · INV-4 async idempotent Generate · INV-5 append-only readjust + `EntitlementService` on every Generate/read.
- **`next=` validation (binding, P-next/H3):** exact allowlist match vs {`%2Fplanly`, `%2Fplanly%2Fdraft`, `%2Fdashboard`}, decode-once only, reject open-redirect / `//` / scheme / `..` → `400`; preserve valid `next=` on `401/403` redirects (`get-started?next=<origin>`); `bind` merges 1:1 with `lost_fields == 0`, never forks.
- **Poll + pause (binding):** client poll backoff `1s→2s→5s`, stop at `60s` then surface retry (never `1s→8s`/2-min-hold); Supabase 7d pause runbook: Worker cron `1/d` warmup + `503 + Retry-After:20` + telemetry `supabase.cold_start` (§5); queue shed → `429 + Retry-After`, entitlement-down → fail-closed `403`.
- **Out-of-scope (binding):** tracking/progress, billing/checkout/refunds, CMS/curriculum, notifications, offline/PWA beyond existing shell, multi-workspace, AI internals (TUFY credits/prompts/models), perf beyond SLO. D3 Learn, D4 Solve, D5 Tracking, D6 TUFY, D8 Cross-links, D9 Trust excluded except `TeaserGuard` anti-conflation.
- **Explorer baseline (binding):** no backend exists. New surface only: Worker (`api.planly.*` Hono) + Supabase PG (Drizzle migrations) + Pages (`app.planly.*` `web/planly-wizard/`) + toolbox `core/privacy.js` allowance + `index.html` CSP `connect-src https://api.planly.*` only. `sw.js` byte-identical (GET-only, no API caching; POST/PUT never pass through SW).

## 1. Phase map + ticket DAG (binding)

| Phase | Tickets | Exit bar |
|---|---|---|
| PH0 Foundations | T1, T2, T8-infra-half | Contracts frozen; Step-1 fixture green; event/operation tables migrated (no API) |
| PH1 Draft + Step 1 | T3 | Anon Draft → Step-1 save/merge → Discard→410 green on stub |
| PH2 Generate + Read | T4, T5, T6, T7 | Idempotent Generate + poll + gated reads + auth-merge green; cut line enforced |
| PH3 Hardening | T8 (completion), T9, T10 | Readjust replay deterministic; SLO dashboards live; E2E green; evaluator PASS |

**Blocking edges (binding):** `T1 → T2, T8` · `T1,T2 → T3` · `T3 → T4` · `T4 → T5, T6, T7` · `T8 + T7 → T9, T10`.

```text
T1 ─┬─→ T2 ─┬─→ T3 ─→ T4 ─┬─→ T5 ─╮
    │        │             ├─→ T6 ─┼─╮
    └─→ T8 ──┘             └─→ T7 ─┴─┼─→ T9
    (infra-half)                   └──→ T10 (needs T8-completion + T7)
```

**Probes P1–P5 as gates (binding):** P1 unlocks Steps 2–6 definitions + validation copy · P2 unlocks enforcement step + OTP-1-day/Google-30-day + `next=` variants · P3 unlocks Discard/Close/CTA hrefs (`Create my plan`, `Plan with Planly`, `Start free`, `?view=features` parity) · P4 unlocks Generate trigger + Sprint/Daily fields + edit/readjust/missed-day types · P5 unlocks Free-exclusion block + paywall interception UX. No unlock without verbatim + URL + timestamp row in a follow-up evidence addendum. Zero I1 fixtures: every Wizard/Sprint/Daily field beyond Step-1 Q1–Q4 stays TBD/empty until its probe closes.

**Cut line (binding):** nothing past T4 starts before P1 + P2 close. T5/T6/T7 additionally require their probe unlocks (§3 per-ticket `probe unlock` row); T8-completion requires P4 event-type unlock.

## 2. Deep-module map (codebase-design vocabulary)

Four deep modules, one interface each; tests cross the external seam only. Internal seams (fakes/doubles) are private to the implementation and never part of the contract.

| Module | Interface (small) | Implementation (deep) | Adapter slots at seam |
|---|---|---|---|
| `DraftService` | `createDraft(anon)`, `getDefinition(step)`, `saveAnswers(id, step, inputs)`, `discard(id)` | Lifecycle, step-def provider, INV-2 merge, Discard→410, server `returnTo` (legacy `takeuforward.org/planly` only as validated value) | step-def provider (fake: Step-1 Q1–Q4 fixture); store double |
| `GenerateService` | `POST /v1/drafts/:id/generate`, `GET /v1/operations/:opId` | Orchestration, `(draft_id, Idempotency-Key)` single-execution, `202 {opId}`+poll `1s→2s→5s` stop `60s`, jittered backoff | idempotency store (in-memory double for retry-storm) |
| `EntitlementService` | `canGenerate(subject)`, `canRead(subject, planId)` | Paid-inclusion verdict (Basic ₹4399/7999 · Core ₹6049/10999 · Max ₹10999/19999, "Access depends on plan"); calls, never owns, Draft content | entitlement stub (matrix anon/authed/entitled) |
| `ReadjustService` | `appendReadjustment(planId, event)`, `getHistory(planId)` | `baseVersion == head` check, deterministic `(head, event) → head+1`, ordered history; `PUT/PATCH` on Plan forbidden | event-log double (append-only, replay determinism) |

`TeaserGuard` is a compile/lint guard, not a service: any client mapping teaser index → wizard step fails build; counter `teaser_wizard_conflation_attempt` must stay 0.

## 3. Tickets T1–T10 (owner, I/O, edges, probes, TDD, telemetry, fallback, breakpoints, gate)

Convention per ticket: `Owner` single accountable role · `Inputs → Outputs` · `Blocked-by / Blocks` (from §1 DAG) · `Probe unlock` · `TDD seam + first failing test` (red→green, one vertical slice at a time) · `Contract tests` · `Telemetry` · `Fallback / overflow` · `Breakpoint` (stop-work trigger) · `Gate` (evaluator PASS bar). Max 2 fix rounds total across the plan; builder must not commit until evaluator PASS (per `docs/agents/issue-tracker.md` rules).

### T1 — Scaffold, contracts, DB base (PH0) [G1]
- **Owner:** builder-backend.
- **Inputs → Outputs:** backend-spec §§3–5 + Stack A → Worker (`api.planly.*`, Hono, cookie parser, OpenAPI stub), Supabase PG via Drizzle migrations (`drafts`, `steps`, `operations`, `plans` shells; `readjustments` table shell for T8-half), OpenAPI file frozen for 7 endpoints + `POST /v1/drafts/:id/bind`, CI contract-test harness (G1: OpenAPI snapshot + TeaserGuard lint + 409/422/402/202/304+ETag matrix).
- **Blocked-by / Blocks:** — / T2, T3, T8-infra-half.
- **Probe unlock:** none (infra only; no Wizard content).
- **TDD seam + first test:** seam = contract stub on `api.planly.*`; red = `GET /v1/drafts/NOPE/steps/1 → 404` against stub; green = stub router only.
- **Contract tests:** stub returns shape-correct `201/200/202/304/401/402/403/404/409/410/422` envelopes; schema-lint passes; ETag round-trip (`If-None-Match → 304`, `If-Match` stale → `409 + currentVersion`).
- **Telemetry:** none yet (harness logs only).
- **Fallback / overflow:** n/a (no traffic).
- **Breakpoint:** stop if separate-origin (`app.planly.*` + `api.planly.*`) + cookie design cannot pass toolbox `core/privacy.js` review (no file bytes on `/v1/*`) — escalate, do not improvise same-origin.
- **Gate:** evaluator PASS = OpenAPI matches backend-spec §3 exactly (canonical `id`/`opId`/`Idempotency-Key`/`readjustmentId`/`version`); `sw.js` byte-identical; CSP diff `connect-src https://api.planly.*` only.

### T2 — Step-definition provider + Step-1 fixture (PH0)
- **Owner:** builder-backend.
- **Inputs → Outputs:** T1 stub + frozen Step-1 Q1–Q4 V2 (Q1 role `SDE Intern`/`Software Engineer` · Q2 exp `0-2`/`2-5` · Q3 companies `Startups`/`FAANG`/`All Product Based Companies`/`Open to all` · Q4 region `India`/`US-Europe`/`Others`; chrome `Planly by takeUforward`/`Discard my plan`/`Close`/`Step 1 of 6`/`Next`) → `DraftService.getDefinition` serving Step 1; Steps 2–6 return `404 step-unprobed` (never synthesized).
- **Blocked-by / Blocks:** T1 / T3.
- **Probe unlock:** Step-1 content pre-unlocked (V2); Steps 2–6 locked until P1.
- **TDD seam + first test:** seam = step-def provider; red = `getDefinition(2) → 404`, `getDefinition(1)` returns verbatim Q1–Q4 + `required: ["*"]`; green = fake provider with Step-1 fixture only.
- **Contract tests:** `GET /v1/drafts/:id/steps/1 → 200 {n:1, payload, version} + ETag` shape; `GET …/steps/2..6 → 404 {code:STEP_UNPROBED}`; `PUT …/steps/2..6 → 422 {code:STEP_UNPROBED}`; discarded draft → `410`.
- **Telemetry:** histogram `steps_observed_count` (expect 1 until P1 closes).
- **Fallback / overflow:** unknown step → `404`, never fallback to teaser items (TeaserGuard rejects).
- **Breakpoint:** stop if any Step 2–6 content is requested without P1 row — leave TBD.
- **Gate:** PASS = fixture byte-equals frozen verbatims; `steps_observed_count == 1`.

### T8-infra-half — Event-log + operation tables (PH0 half; completion in PH3)
- **Owner:** builder-backend.
- **Inputs → Outputs:** T1 migrations → `readjustments (id→readjustmentId, plan_id FK, base_version, delta jsonb, author_user_id, created_at)` + `operations (id→opId, draft_id FK, idempotency_key text, status accepted|running|succeeded|failed, plan_id, ttl_expires_at)` with `UNIQUE (draft_id, idempotency_key)` + append-only DB constraint (`REVOKE UPDATE,DELETE ON plans,readjustments FROM app_role` + `forbid_mutation()` trigger; writes only via RPC).
- **Blocked-by / Blocks:** T1 / T8-completion (PH3), T9, T10.
- **Probe unlock:** none for DDL; readjust `delta` shape locked until P4.
- **TDD seam + first test:** seam = event-log double; red = `UPDATE readjustments → rejected`; green = append-only constraint test.
- **Contract tests:** none (no endpoint yet).
- **Telemetry:** migration version gauge.
- **Fallback / overflow:** migration failure → roll back, never partial DDL.
- **Breakpoint:** stop if DB cannot enforce append-only — do not emulate in app code alone.
- **Gate:** PASS = append-only proven at DB layer; no API wired yet.

### T3 — Draft lifecycle + Step-1 save/merge + Discard (PH1)
- **Owner:** builder-backend (API) + builder-frontend (wizard slice).
- **Inputs → Outputs:** T1 + T2 → `POST /v1/drafts` (anon, sets `Set-Cookie: draftId=<id>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`), `PUT /v1/drafts/:id/steps/:n` with `If-Match: <version>` (INV-2 merge, `*` requiredness; error copy TBD P1), `discard` → `410` + server `returnTo` (never hardcoded; dest TBD P3; legacy `takeuforward.org/planly` only as validated `returnTo` value), `web/planly-wizard/` Step-1 renderer on `app.planly.*` (server-driven, no hardcoded options).
- **Blocked-by / Blocks:** T1, T2 / T4.
- **Probe unlock:** P3 partially gates Discard/Close dests — until P3 closes, follow server `returnTo` stub.
- **TDD seams + first tests (vertical slices):** (a) merge seam — red = back-nav `PUT step 1` after `step 1` saves merges and keeps `version` monotonic, `n` pointer never regresses (INV-2); (b) validation seam — red = missing `*` field → `422 {code:SCHEMA_INVALID}` (copy-agnostic assertion); (c) OCC seam — red = stale `If-Match` → `409 {code:VERSION_CONFLICT, currentVersion}`.
- **Contract tests:** `POST /v1/drafts → 201 {id, version:1, status:open} + Set-Cookie` · `PUT …/steps/1 valid + If-Match → 200 {n:1, version}` · `PUT invalid → 422` · `PUT stale → 409 + currentVersion` · `discard → 410 on next GET`.
- **Telemetry:** `wizard_enter`, `step_view`, `step_save_ok/error`, `draft_ready`, `discard`.
- **Fallback / overflow:** stale definition → server wins (INV-1); client never advances past server-confirmed step; save p95 alert >400ms pages to overflow review (§5); client rebases on `409` via `currentVersion` (merge-loss 0).
- **Breakpoint:** stop if client caches/hardcodes Step-1 options — must render from `getDefinition`.
- **Gate:** PASS = merge + `422` + `409` + `410` tests green; wizard renders Step 1 from server only.

### T4 — Async idempotent Generate + poll (PH2; cut-line ticket)
- **Owner:** builder-backend.
- **Inputs → Outputs:** T3 draft (`open` + steps complete) → `POST /v1/drafts/:id/generate` + `Idempotency-Key: <uuidv4>` header → `202 {opId, status:accepted}`; `GET /v1/operations/:opId` (`accepted→running→succeeded|failed`, terminal immutable); client polls with jittered backoff `1s→2s→5s`, stop at `60s` then surface retry; `409 {code:STEP_STALE, currentVersion}` on stale snapshot; duplicate same `(draft_id, Idempotency-Key)` → `200` same `opId` (no new op).
- **Blocked-by / Blocks:** T3 (+ P1 + P2 closed per cut line) / T5, T6, T7.
- **Probe unlock:** trigger/payload semantics locked until P4 — accept contract only; generation internals deferred.
- **TDD seam + first test:** seam = idempotency store; red = double-POST same key under retry storm yields exactly one operation/Plan, same `opId` (INV-4); green = `(draft_id, key)` single-execution + `UNIQUE (draft_id, idempotency_key)`.
- **Contract tests:** `POST generate anon → 401` · authed no-key/malformed-key → `400/422` · unentitled → `402 {code:ENTITLED_REQUIRED}` · valid → `202 {opId}` · retry same key → `200` same `opId` · `GET operation → 200 {opId, status, draftId?, planId?}` · unknown op → `404` · concurrent generate → `409`.
- **Telemetry:** `generate_req`, `generate_202`, `generate_succeeded/failed`; histogram poll-to-visible (SLO <60s); alert on `generate_failed` spike.
- **Fallback / overflow:** queue depth > threshold (§5) → `429 + Retry-After`, never drop idempotency record; poll stop `60s` → UI surfaces retry, never synthesizes a Plan; Supabase pause → `503 + Retry-After:20` + `supabase.cold_start` (§5).
- **Breakpoint:** CUT LINE — do not start T4 until P1 + P2 rows are logged (verbatim + URL + timestamp). Stop if exactly-once effect cannot be proven under retry storm.
- **Gate:** PASS = retry-storm test (≥50 concurrent same-key POSTs → 1 operation, same `opId`) + `409`/`402`/`304` tests green; Generate-accept p95 <600ms on stub.

### T5 — Plan / Sprint / Daily read paths (PH2)
- **Owner:** builder-backend.
- **Inputs → Outputs:** T4 `opId → planId` → `GET /v1/plans/:id` `200 {id, version, teaser, full}` + `ETag: "plan-<id>-vN"` (+ `304` on `If-None-Match`); unentitled → `full:null` explicit; Sprint/Daily arrays empty-until-probed; reads default to latest version, history explicit.
- **Blocked-by / Blocks:** T4 / T9, T10 (via T7+T8).
- **Probe unlock:** Sprint/Daily domain fields locked until P4; clients tolerate unknown fields + render empty states.
- **TDD seam + first test:** seam = read adapter (`TeaserGuard.filter`); red = unentitled gets `full:null` + allowlisted teaser only; read beyond-head version → latest; unknown-field payload renders without crash.
- **Contract tests:** `GET plan anon → 401` · authed-not-entitled → `200 teaser-only (full:null)` or `403` per choke C2 · entitled → `200 teaser+full` · unknown id → `404` · `If-None-Match` match → `304`.
- **Telemetry:** `plan_read` + `teaser.serve{mode:teaser|full}` + version gauge.
- **Fallback / overflow:** P4-open reads return empty arrays with `probed: false` flag, never fabricated dates/subjects/XP; `full` never cached at edge (`Cache-Control: private, no-store`), `teaser` `s-maxage=60`.
- **Breakpoint:** stop if any Sprint/Daily field is invented without P4 row.
- **Gate:** PASS = `401/403/404` + `304+ETag` matrix + empty-until-probed rendering green.

### T6 — Entitlement gates (PH2)
- **Owner:** builder-backend.
- **Inputs → Outputs:** T4 paths + pricing matrix (paid inclusion observed; Free-exclusion NOT-OBSERVED) → `EntitlementService.canGenerate/canReadFull/canReadjust` enforced at 3 chokes (C1 generate, C2 full-read, C3 readjust); `401` anon / `402 {code:ENTITLED_REQUIRED}` / `403` authed-not-entitled with preserved `next=` + `/pricing#plans` routing.
- **Blocked-by / Blocks:** T4 / T9, T10 (via T7+T8).
- **Probe unlock:** Free-exclusion + interception UX locked until P5 — until then, deny defaults to `402/403 → /pricing#plans`, never allow-by-default.
- **TDD seam + first test:** seam = entitlement stub; red = matrix anon/authed/entitled × {generate, read, readjust} matches A5 table; green = stub matrix, deny-closed; red = `can_generate=false → 402`, no op row created.
- **Contract tests:** full A5 matrix: anon generate → soft-gate `get-started?next=%2Fplanly%2Fdraft`; authed-not-entitled generate → `402/403`; entitled → allow; reads analogous (teaser-only vs full).
- **Telemetry:** `auth_gate_hit (401/402/403, next=)` counters by reason; alert on `403` spike post-pricing change; `entitlement false-allow == 0` SLO gate.
- **Fallback / overflow:** entitlement store down → fail-closed (`402/403` + `Retry-After`), never fail-open; audit log every verdict.
- **Breakpoint:** stop if fail-open is proposed for availability — deny-closed is binding (INV-5).
- **Gate:** PASS = A5 matrix tests green; false-allow 0.

### T7 — Auth-merge + TeaserGuard + wizard auth wiring (PH2)
- **Owner:** builder-backend + builder-frontend.
- **Inputs → Outputs:** T4 + P2 rows → `POST /v1/drafts/:id/bind` (`rpc_draft_bind`, idempotent `merged:true/false`) preserving anon inputs 1:1 across exact-allowlist `next=` variants (Skip continues anon, no bind); `next=` validation: exact match, decode-once, reject `//`/scheme/`..` → `400`, preserve valid `next=` on `401/403`; OTP/Google session handling (expiry claims unverified until P2); `TeaserGuard` lint + runtime + `teaser_wizard_conflation_attempt` counter.
- **Blocked-by / Blocks:** T4 / T9, T10.
- **Probe unlock:** enforcement step + session semantics locked until P2 (cut line already requires P2 closed before T4, so T7 executes post-P2).
- **TDD seams + first tests:** (a) auth-bind seam — red = anon draft with Step-1 answers + login via each `next=` variant → identical inputs under authed owner, `lost_fields == 0`, no fork, replay → `merged:false` (INV-3); (b) guard seam — red = teaser-index→wizard-step mapping fails build; (c) `next=` seam — red = `next=https://evil` / `//evil` / `%252F` double-encode → `400`.
- **Contract tests:** `401/403 → get-started?next=<allowlisted>` → `bind` → merge → resume round-trip per `next=` variant; invalid `next=` → `400`; Skip path stays anon.
- **Telemetry:** `auth_merge_ok / lost_fields` audit (SLO: loss rate 0); `teaser_wizard_conflation_attempt == 0`.
- **Fallback / overflow:** bind conflict (draft already owned by other) → `403/409` + merge preview, keep owner, never fork; `steps before == steps after` count-check per bind.
- **Breakpoint:** stop if any merge loses a field — field-loss > 0 halts PH2.
- **Gate:** PASS = `next=`-variant merge + `400` open-redirect rejection + `TeaserGuard` rejection tests green; loss rate 0.

### T8-completion — Readjust append + re-derive + versioning (PH3)
- **Owner:** builder-backend.
- **Inputs → Outputs:** T8-infra-half + P4 event types → `POST /v1/plans/:id/readjustments {baseVersion, delta}` → `201 {readjustmentId, baseVersion, opId}`, `GET` history ordered, `baseVersion` must equal a real `plans.version` (stale/unknown → `409`), deterministic re-derive `(head, delta) → head+1` as new immutable `plans` row; no `PUT/PATCH` on Plan/Sprint/Daily; requires `Idempotency-Key` header per backend-spec §6.
- **Blocked-by / Blocks:** T8-infra-half + T4 (+ P4) / T9, T10.
- **Probe unlock:** readjust `delta` shape + missed-day semantics locked until P4.
- **TDD seam + first test:** seam = event-log double; red = append with stale `baseVersion` → `409`; missing `baseVersion` → `400`; append → version+1; replay of history reproduces head byte-identically (INV-5).
- **Contract tests:** valid append → `201 {readjustmentId, baseVersion, opId}` · missing base → `400` · stale base → `409` · bad delta → `422` · authed-not-entitled → `402/403` · history ordering test.
- **Telemetry:** `readjust_appended` + version counter.
- **Fallback / overflow:** concurrent appends → one wins (`201`), losers get `409` + current head, client rebases via `currentVersion`; log never rewritten.
- **Breakpoint:** stop if in-place Plan mutation is proposed — append-only is binding.
- **Gate:** PASS = append/replay-determinism + `400/409/422/402` tests green.

### T9 — Telemetry + SLO dashboards + alerts (PH3) [G2]
- **Owner:** builder-backend (instrumentation) + builder-frontend (loading/empty states).
- **Inputs → Outputs:** T7 + T8-completion → funnel dashboards (`wizard_enter → step_complete → ready → generate_req → generate_ok → read → readjust`), latency histograms (save/step-def/Generate-accept/poll-to-visible), gate-denied counters, merge-preservation audit, risk instruments (`teaser_wizard_conflation_attempt`, `steps_observed_count`), G2 k6 SLO staging (7 SLOs per backend-spec §10).
- **Blocked-by / Blocks:** T7, T8-completion / — (parallel with T10).
- **Probe unlock:** none (reads existing events).
- **TDD seam + first test:** seam = event emitter double; red = every funnel transition emits with `id` hash + step + auth mode; green = schema-validated events.
- **Contract tests:** event-schema lint; SLO-threshold tests on synthetic traces; G2 k6 asserts save p95 <400ms, stepdef p95 <300ms, gen-accept p95 <600ms, poll-to-visible <60s, merge-loss 0, duplicate 0, false-allow 0.
- **Telemetry (dashboards):** D1 funnel conversion · D2 latency p50/p95 per endpoint vs SLO · D3 gate-denied (`401/402/403`) by reason + `next=` · D4 merge-loss (= 0) + duplicate (= 0) + false-allow (= 0) gates · D5 risk (`teaser… == 0`, `steps_observed_count`) · D6 pause/cold-start (`supabase.cold_start`, `503` rate).
- **Fallback / overflow:** telemetry pipeline down → local spillover buffer (bounded), never block API path; dashboard gap annotated, never backfilled with synthetic data.
- **Breakpoint:** stop shipping further scope if any zero-gate (loss/duplicate/false-allow) breaches — fix-forward under fix-round budget.
- **Gate [G2]:** PASS = dashboards live on synthetic traffic; all SLO panels render thresholds; k6 staging run green → promote unblocked.

### T10 — E2E + hardening + privacy/CSP verification (PH3) [G1/G2]
- **Owner:** builder-backend + builder-frontend + tester.
- **Inputs → Outputs:** T7 + T8-completion → E2E on `app.planly.* → api.planly.*` (post-probe): anon → Skip → Generate-gate → Google → Generate (`202 {opId}`) → poll `1s→2s→5s` stop `60s` → read (`ETag`/`304`) → readjust (`201 {readjustmentId}`) → version+1; Discard → `410`; `index.html` CSP `connect-src https://api.planly.*` only; `core/privacy.js` allowance proven (no file bytes on `/v1/*`); `sw.js` byte-identical.
- **Blocked-by / Blocks:** T7, T8-completion / — (parallel with T9).
- **Probe unlock:** E2E Sprint/Daily assertions only for P4-unlocked fields; all else assert empty-state tolerance.
- **TDD seam + first test:** seam = full-stack E2E harness against `api.planly.*` (runs last, not red-first per slice — unit/contract seams already green); first E2E = anon→Step-1→Discard→`410`.
- **Contract tests:** re-run full endpoint matrix (§4 below: 409/422/402/202/304+ETag) against deployed `api.planly.*` + cookie (`draftId`) + JWT flow; assert G1 OpenAPI snapshot + TeaserGuard lint green.
- **Telemetry:** E2E run emits full funnel trace; discarded-run trace asserted.
- **Fallback / overflow:** E2E flake budget → quarantine + rerun once with jitter; persistent flake = breakpoint, not retry-loop; Supabase pause path asserted (`503 + Retry-After:20`).
- **Breakpoint:** stop if `sw.js` not byte-identical, CSP wider than `connect-src https://api.planly.*` only, or `core/privacy.js` guard bypassed (file bytes on `/v1/*`).
- **Gate [G1/G2]:** PASS = E2E suite green + `sw.js` byte-identical + CSP diff `connect-src https://api.planly.*` only + `core/privacy.js` no file bytes on `/v1/*` → evaluator final PASS.

## 4. Contract tests per endpoint (normative matrix, backend-spec §3 canonical)

| Method + path | 2xx | 401/402/403 | 404/409/410/422 (+304) | INV asserted |
|---|---|---|---|---|
| `POST /v1/drafts` | `201 {id, version:1, status:open} + Set-Cookie: draftId` (T3) | n/a (anon OK) | `400` malformed · `429` cap · `500` only | INV-1, INV-3 setup |
| `GET /v1/drafts/:id/steps/:n` | `200 {n, payload, version} + ETag: "vN"` Step 1 (T2/T3) | `401` no cookie+no JWT · `403` not owner | `404` unknown/S2–6-`STEP_UNPROBED` · `410` discarded · `304` on `If-None-Match` | INV-1 |
| `PUT /v1/drafts/:id/steps/:n` + `If-Match` | `200 {n, version}` (T3) | owner-scoped `401/403` | `409 {code:VERSION_CONFLICT, currentVersion}` stale · `422 {code:SCHEMA_INVALID}` · `410` discarded | INV-2 |
| `POST /v1/drafts/:id/bind` (JWT required) | `200 {id, owner_user_id, merged:true/false}` idempotent (T7) | `401` no JWT · `403` bound to other | `404` unknown draft · `409` already bound elsewhere | INV-3 |
| `POST /v1/drafts/:id/generate` + `Idempotency-Key: <uuidv4>` header | `202 {opId, status:accepted}`; duplicate same key → `200` same `opId` (T4) | `401` anon · `402 {code:ENTITLED_REQUIRED}` not-entitled (T6) | `409 {code:STEP_STALE, currentVersion}` · `422` incomplete · `400` missing/malformed key · `429` cap | INV-4, INV-5 |
| `GET /v1/operations/:opId` | `200 {opId, status:accepted\|running\|succeeded\|failed, draftId?, planId?, planVersion?}` (T4) | `403` not owner | `404` unknown op | INV-4 |
| `GET /v1/plans/:id` | `200 {id, version, teaser, full}` + `ETag: "plan-<id>-vN"`; unentitled `full:null` (T5) | `401` / `403` bound-draft only (T6) | `404` unknown · `304` on `If-None-Match` | INV-5 |
| `POST /v1/plans/:id/readjustments {baseVersion, delta}` + `Idempotency-Key` | `201 {readjustmentId, baseVersion, opId}` (T8) | `401` / `402` entitled-required / `403` (T6) | `400` missing baseVersion · `409` unknown/stale base · `422` delta invalid | INV-5 |

Status codes: `200` OK, `201` created, `202` accepted (`{opId}`), `304` not-modified (ETag), `400` missing/malformed (incl. bad `next=` open-redirect), `401` unauthenticated, `402` entitled-required, `403` forbidden, `404` not-found (incl. `STEP_UNPROBED`), `409` conflict/stale (`currentVersion`), `410` discarded, `422` schema-invalid, `429 + Retry-After`, `503 + Retry-After:20` (Supabase cold-start), `5xx + requestId`.

All contract tests run against the OpenAPI stub on `api.planly.*` from T1 onward and against live `api.planly.*` + Supabase from T4 onward (G1 gate). Cookie assertions: `POST /v1/drafts` sets `Set-Cookie: draftId=<id>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`; authed flows send JWT + `draftId` cookie; every `401/402/403` redirect preserves only allowlisted `next=` (exact match, decode-once), invalid `next=` → `400`.

## 5. Telemetry dashboards, fallback/overflow triggers, breakpoints

- **Dashboards (T9 [G2]):** D1 funnel · D2 latency vs SLO (save p95 <400ms · step-def p95 <300ms · Generate-accept p95 <600ms · poll-to-visible p95 <60s) · D3 gate-denied by `401/402/403` + `next=` · D4 zero-gates (merge-loss 0 · duplicate 0 · false-allow 0) · D5 risk (`teaser_wizard_conflation_attempt == 0` · `steps_observed_count`) · D6 pause/cold-start (`supabase.cold_start`, `503` rate).
- **G1 contract CI (binding, P-G1 per backend-spec §13):** OpenAPI snapshot for §4 routes; TeaserGuard lint (`teaser-guard` rule + `TEASER_ALLOWLIST` snapshot); status-code matrix (`409/422/402/202/304+ETag` round-trips); ETag (`If-None-Match → 304`, `If-Match` stale → `409`). Merge blocked on G1 green (T1, T10).
- **G2 SLO staging (binding, P-G2 per backend-spec §§10/13):** k6 run asserting all 7 SLOs (save/stepdef/gen-accept latencies, 60s poll-to-visible, merge-loss/duplicate/false-allow zero counters). Promote blocked on G2 green (T9, T10).
- **Supabase 7d pause runbook (binding, P-pause):** Worker scheduled cron `1/d` warmup request keeps project warm; cold-start path returns `503 + Retry-After:20` with telemetry `supabase.cold_start`; Pages 500 builds/mo (preview on PR, prod on main); caps: per-IP 60/min PUT/generate, per-draft 10 generates/hour, global shed 80k req/day → `429 + Retry-After`; TTLs: `draftId` cookie 30d, ops 24h, teaser `s-maxage=60`, `full` `private, no-store`.
- **Fallback / overflow triggers:** Generate queue depth > configured max → `429 + Retry-After` (T4) · poll stops at `60s` → surface retry, never synthesize Plan (T4; backoff `1s→2s→5s`) · entitlement store down → fail-closed `402/403 + Retry-After` (T6) · concurrent readjust → `409 + currentVersion` + rebase (T8) · Supabase paused/cold → `503 + Retry-After:20` (warmup cron) · telemetry down → bounded spillover, API path unblocked (T9) · save/accept latency breaching SLO → overflow review before next ticket starts.
- **Breakpoints (stop-work):** cut-line breach (work past T4 without P1+P2 rows) · invented Steps 2–6 / Sprint / Daily fields without probe rows · field-loss > 0 · duplicate > 0 · false-allow > 0 · `sw.js` not byte-identical · CSP wider than `connect-src https://api.planly.*` only · file bytes observed on `/v1/*` (`core/privacy.js` bypass) · in-place Plan mutation proposed · fail-open proposed · open-redirect `next=` accepted.

## 6. Fix rounds + evaluator PASS gates (binding)

- **Max 2 fix rounds total.** Each gate rejection consumes one round; after 2/2 the plan halts and returns to planner (no silent third round). This fix: round 1/2, no commit.
- **Per-ticket gates (§3):** evaluator checks `Gate` row; evidence = named tests green + contract matrix (§4) + telemetry event present. Labels: `[G1]` = contract guard (T1, T10), `[G2]` = SLO guard (T9, T10).
- **Final PASS requires:** (1) all T1–T10 gates green incl. G1 OpenAPI snapshot + TeaserGuard lint + 409/422/402/202/304+ETag matrix and G2 k6 7-SLO staging · (2) zero-gates hold (loss/duplicate/false-allow 0) · (3) `sw.js` byte-identical, CSP diff `connect-src https://api.planly.*` only, `core/privacy.js` no file bytes on `/v1/*` proven · (4) canonical hosts (`app.planly.*` + `api.planly.*`; `takeuforward.org/planly` only as validated legacy `returnTo`) + canonical naming (`id`/`opId`/`Idempotency-Key`/`readjustmentId`/`version`; cookie `draftId` stays) + poll `1s→2s→5s` stop `60s` + pause runbook (`503 + Retry-After:20`, `supabase.cold_start`) · (5) no work past cut line without P1+P2 rows; no P3/P4/P5-locked content without its probe row · (6) single-file plan discipline held by downstream writers (this file owns the plan; `backend-spec.md` / `leadership-brief.md` are other owners' files — do not write them here).
- **Evaluator log (placeholder — do not fill as builder):** Verdict: _PENDING_ · T1–T10: _PENDING_ · Fix rounds used: 1/2.

## 7. Input / output index + handoff

- **Consumes:** `docs/research/takeuforward-planly-spec.md` (frozen) · `docs/research/takeuforward-planly-plan-creation-spec.md` (INV-1…INV-5 evidence rows 1–20, P1–P5) · `docs/research/takeuforward-planly-plan-creation-technical-spec.md` §§1–6 (D-A…D-F, contracts, A1–A8, SLOs) · `docs/product/planly/backend-spec.md` §§3–6,§§9–10,§13 (canonical naming/hosts/G1/G2/pause — normative where this plan cites §3/§13) · `docs/product/HARNESS.md` (reporting contract).
- **Produces:** this file only — `docs/product/planly/backend-plan.md`. Downstream owners (disjoint): backend-spec writer, leadership-brief writer, Worker + Supabase + `web/planly-wizard/` builders, tester (E2E), evaluator (gates).
- **Handoff shells (fill at execution):** `H1 DraftService owner: __ · inputs: T1+T2 rows · done when: T3 merge + 409 tests green` · `H2 Generate owner: __ · inputs: T4 contract (202 {opId}, Idempotency-Key) + P1/P2 rows · done when: retry-storm (same opId) green` · `H3 Entitlement + next= owner: __ · inputs: P5 matrix + T6 stub + allowlist {…} · done when: A5 matrix + 402/400 open-redirect tests green` · `H4 Readjust owner: __ · inputs: T8-half + P4 types · done when: replay + 201 {readjustmentId} green`. Each shell requires evaluator PASS (incl. G1/G2 where tagged) before the next starts.

(End of file)
