<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->
# ADR 0007: Planly Stack-A Monolith Override (PH0+T3 close-out)

Date: 2026-09-20
Status: Accepted (CONDITIONAL PASS — monolith PH0+T3 only)
Scope: sibling monolith `/home/rajat/Documents/planly` (own git repo) + toolbox specs (read-only reference)

> Numbering note: `0007-px0-reviewer-sidecar.md` already holds number 0007.
> This file keeps the requested `0007-planly-monolith.md` name per close-out
> instruction, mirroring the preserved duplicate-0002 precedent. Renumber only
> by a future DECISION, never silently.

## Context

- Monolith PH0+T3 closed CONDITIONAL PASS, 8/8 checks, fix round 1/2 used:
  Tester initial FAIL (contract/test misplacement) fixed, Reviewer FAIL fixed,
  Security 1 Critical (JWT) + High (throttles) fixed.
- Open follow-ups (non-blocking, tracked in `planly/docs/BUILD.md`): OpenAPI
  snapshot, UUIDv4 spec wording, 403→404 mapping, initial commit.
- ADR 0006 locked Stack A + **separate origin** (`app.planly.*` Pages +
  `api.planly.*` Worker). The monolith build implements Stack-A-Monolith
  instead: single Worker + Static Assets, Hono `/v1/*` + `/*` same-origin.

## Decision

- **Monolith override (suspends ADR 0006 separate-origin for this build ONLY):**
  single Worker `planly-api` (`api/app.ts`) serving Hono `/v1/*` API +
  Static Assets `/*` (SPA fallback). ADR 0006 separate-origin stays normative
  for any non-monolith future; this override does not amend it.
- **Sibling repo allowed:** `/home/rajat/Documents/planly` may `git init`
  (own repo, own initial commit). Toolbox repo stays untouched by monolith
  writes; toolbox specs are read-only reference (see `planly/docs/SPECS.md`).
- **Single Worker+Assets LOCKED:** `wrangler.toml` — `main = "api/app.ts"`,
  `[assets] directory = "."`, `not_found_handling = "single-page-application"`,
  Hyperdrive binding `HYPERDRIVE` → Supavisor transaction mode, crons =
  warmup 1/d (7d-pause guard) + op-TTL hourly + draft purge nightly.
- **Contracts LOCKED (8 ops, 3 active Step1):** `POST /v1/drafts` ·
  `GET/PUT /v1/drafts/:id/steps/:n` · `POST /v1/drafts/:id/bind` ·
  `POST /v1/drafts/:id/generate` (`Idempotency-Key: UUIDv4` → 202 `{opId}`) ·
  `GET /v1/operations/:opId` · `GET /v1/plans/:id` (teaser-or-full + ETag) ·
  `POST /v1/plans/:id/readjustments` (`baseVersion` required).
  Step1 = Q1–Q4 wizard, `draftId` cookie 30d (`Max-Age=2592000`), body
  `draftId` never trusted.
- **Data LOCKED:** 7 tables, RLS, RPC-only (no direct browser→PG, no
  `service_role` key in Worker env; Hyperdrive binding + anon key + JWKS URL only).
- **Web LOCKED:** Step1 server-driven wizard (no client-side step state as authority).

## Ticket scope (T1–T10 from backend-plan)

- **GO:** T1 (infra skeleton — done: one `npm ci`, one `wrangler deploy`),
  T2 (contracts), T8-half (infra/tests half only), T3 (monolith PH0+T3 build).
- **CUT:** rest (Steps 2–6 content, Generate trigger/schema, Sprint/Daily
  output fields — NOT-OBSERVED until probes P1–P5 close; no build beyond
  probes without leadership re-vote).

## Ownership (O1–O5, disjoint)

- O1 infra: `package.json`, `wrangler.toml`, `tsconfig.json`, `.gitignore`,
  `README.md`, `scripts/`, `tests/k6/`, `planly/docs/`.
- O2 contracts owner: `contracts/` — DO NOT TOUCH outside O2.
- O3 db owner: `db/` — DO NOT TOUCH outside O3.
- O4 api owner: `api/` — DO NOT TOUCH outside O4.
- O5 web owner: `web/` (+ `tests/contract`, `tests/e2e` via O2/O5) — DO NOT TOUCH outside O5.
- This close-out (docs-writer) owns ONLY: toolbox tracker append +
  this ADR + `planly/docs/BUILD.md`. No `api/`, `web/`, `contracts/`,
  `db/`, `package.json`, or test writes; no commit.

## Consequences

- G0 monolith / G1 contract CI / G2 k6-7-SLO gates bind all T-tickets;
  drift fails at evaluator GATE without a new DECISION.
- Follow-ups (OpenAPI snapshot, UUIDv4, 403→404, initial commit) must close
  before any scope beyond GO tickets is approved.

## Alternatives

- Separate-origin per ADR 0006 for this build: suspended — monolith won for
  single-deploy ops simplicity; revivable by DECISION for non-monolith future.
- Toolbox-repo monolith: rejected — sibling repo isolates deploy ownership.
- TeaserGuard halves: rejected — lint + runtime BOTH required (per ADR 0006).
