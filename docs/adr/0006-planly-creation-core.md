<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->
# ADR 0006: Planly Creation Core — Stack A + Separate Origin

Date: 2026-09-20
Status: Accepted (CONDITIONAL GO — creation core only)
Scope: `docs/product/planly/backend-spec.md` (normative) + `backend-plan.md` (execution) + `leadership-brief.md` (decision input)

## Context

Planly backend deliverables closed out PASS: tester 8/8, reviewer 10 findings fixed, security 3 HIGH fixed, evaluator PASS (fix round 1/2 used). The creation core (Draft → Generate → read, gated) is the only approved build scope; Steps 2–6 content, Generate trigger/schema, Sprint/Daily output fields remain NOT-OBSERVED until probes P1–P5 close. This ADR locks the load-bearing decisions so execution tickets (T1–T10) cannot re-litigate them.

## Decision

- **Stack A LOCKED:** Supabase PG + Auth + RLS + Cloudflare Pages (static shell) + Workers (Hono + Drizzle) via Hyperdrive → Supavisor transaction mode. No direct browser → PG. No toolbox coupling. Free-tier caps assumed: Supabase 500 MB / 50k MAU / 60 direct / 200 pooler / 7d-inactivity pause; Workers 100k req/day, 10 ms CPU; Pages 500 builds/mo. First paid jump $30/mo (Supabase Pro $25 + Workers $5) at 80% breakpoints.
- **Separate origin LOCKED:** canonical ONLY `app.planly.*` (Pages) + `api.planly.*` (Worker, all `/v1/*`). Non-canonical `Host` → 301. Never serve API on Pages origin. CORS: `allowOrigin https://app.planly.*` only, methods `GET,POST,PUT` only, headers `Authorization,Content-Type,Idempotency-Key,If-Match,If-None-Match` only, `allowCredentials true`; preflight `OPTIONS → 204` + `Vary: Origin`.
- **Cookie `draftId` httpOnly LOCKED:** anon session = `Set-Cookie: draftId=<id>; Secure; HttpOnly; SameSite=Lax; Path=/; Domain=.planly.*; Max-Age=2592000` (30d). Cookie + JWT are authority; body `draftId` never trusted. Post-login merge via `POST /v1/drafts/:id/bind` (idempotent, merge-loss = 0).
- **`/v1/*` allowlist LOCKED (8 contracts):** `POST /v1/drafts` · `GET/PUT /v1/drafts/:id/steps/:n` · `POST /v1/drafts/:id/bind` · `POST /v1/drafts/:id/generate` (+ `Idempotency-Key` header → 202 `{opId}`, duplicate same key → 200 same `opId`) · `GET /v1/operations/:opId` · `GET /v1/plans/:id` (teaser-or-full + ETag) · `POST /v1/plans/:id/readjustments` (`baseVersion` required). Canonical naming: `id` / `opId` (never `operationId`) / `Idempotency-Key` header (never body field) / `readjustmentId` / `version` / `n`.
- **TeaserGuard BOTH LOCKED:** lint rule (teaser-index→wizard-step mapping fails build, `teaser_wizard_conflation_attempt` stays 0) + runtime filter (unentitled reads get `full:null`, new fields default to full / deny-by-default until P4 unlocks). Enforced by INV-5 (false-allow = 0) with 3 entitlement choke points (Generate / read-full / readjust).
- **CONDITIONAL GO:** creation core only. No build beyond probes until P1/P4 close and leadership re-votes. Guards: G1 contract CI (OpenAPI snapshot + TeaserGuard lint + status-code matrix + ETag round-trip) blocks merge; G2 SLO guard (staging k6 asserting the 7 SLOs) blocks promote. Invariants INV-1..INV-5 PG-enforced per backend-spec §2.8.

## Consequences

- T1–T10 tickets inherit hosts, cookie, contracts, naming, and guards as binding inputs; drift fails at evaluator GATE without a new DECISION.
- Known non-blocking polish (not gate-blocking): leadership-brief §9 TBDs (host/CORS/quota) read stale vs fixed spec §§1/8/13 — spec is normative where they conflict.

## Alternatives

- Neon / Vercel Hobby / Render as primary: rejected — suspend/sleep resume penalties; Vercel Hobby rejected on non-commercial license. Kept as overflow/dormant standby only.
- Same-origin API on Pages: rejected — privacy-prefix exception requires the separate-origin allowlist (`/v1/*` JSON only, no static-tool paths).
- TeaserGuard lint-only or runtime-only: rejected — BOTH required; either half alone permits fail-open reads.
