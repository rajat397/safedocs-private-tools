# Planly Backend — Tech Leadership Brief

Status: CONDITIONAL GO (creation core only) · Date: 2026-09-20 UTC · Owner: builder
Sources: `docs/research/takeuforward-planly-spec.md` (FROZEN) · `docs/research/takeuforward-planly-plan-creation-spec.md` (FROZEN) · `docs/research/takeuforward-planly-plan-creation-technical-spec.md` (draft) · `docs/research/takeuforward-planly-plan-value-spec.md` (draft)

## 1. Executive summary

- Bet: ship a thin Planly plan-creation core (Draft → Generate → read, gated) on a $0 stack before committing to roadmap/sprint/daily depth.
- Load-bearing unknowns are isolated, not solved: Wizard Steps 2–6 content and Generate trigger/schema are NOT-OBSERVED. Probes P1–P5 close them.
- Stack A (Supabase Free + Workers Free + Pages Free) carries the MVP to defined paid breakpoints. No infra spend is requested today — only probe funding (time) + decisions below.
- Guardrails honored in this doc: no Sprint/Daily output-field claims, no Free-tier availability claims, no teaser→Wizard mapping (7-item `/planly` marketing stepper ≠ 6-step Draft Wizard; only shared label is "About you").

## 2. The Ask (decision slide)

| # | Decision requested | Recommendation |
|---|--------------------|----------------|
| 1 | Approve **Stack A** ($0: Supabase + Workers + Pages) | Approve |
| 2 | Approve **privacy-prefix exception**: backend on a **separate origin**, allowlist **`/v1/*` JSON only** (no static-tool paths, no PII beyond draft minimum) | Approve with audit log |
| 3 | Fund **probes P1–P5** (time-boxed captures, see §7) | Approve, P1/P4 first |
| 4 | Confirm **pricing source of truth**: `/pricing#plans` matrix verbatim + timestamp as entitlement basis (paid inclusion observed; Free-exclusion NOT-OBSERVED) | Confirm owner + date |
| 5 | Record verdict | **CONDITIONAL GO** — creation core only; no build beyond probes until P1/P4 close |

If any ask is denied: fall back to NO-GO (do not start PH1).

## 3. Cost — $0 envelope + paid triggers

| Service | Free allowance (cap) | Paid trigger |
|---------|----------------------|--------------|
| Supabase Free | 500 MB DB · 50k MAU · 60 direct conns · 200 pooler conns · pause after 7 d inactivity | Supabase Pro **$25/mo** |
| Workers Free | 100k req/day · 10 ms CPU | Workers Paid **$5/mo** |
| Pages Free | 500 builds/mo · unlimited static bandwidth (static shell) | — (overflow only) |

Breakpoints (act at 80% — before the wall):
- Any free quota at **>80% sustained usage**.
- DB **>400 MB** (500 MB cap) → prune/rollup or Pro.
- API **>80k req/day** (100k cap) → cache/poll-backoff or Workers Paid.
- CPU **>10 ms p95** → move work to client/queue or Workers Paid.

First paid jump when any breakpoint trips: **Supabase Pro $25 + Workers $5 = $30/mo**.

## 4. Architecture (text diagram)

```
[Pages: static shell + Draft Wizard UI — host app.planly.*]
        │  HTTPS / JSON only
        ▼
[Workers API — separate origin api.planly.*, /v1/* allowlist]
  │  POST /v1/drafts
  │  GET /v1/drafts/:id/steps/:n · PUT /v1/drafts/:id/steps/:n
  │  POST /v1/drafts/:id/bind
  │  POST /v1/drafts/:id/generate (Idempotency-Key → 202 {opId})
  │  GET /v1/operations/:opId
  │  GET /v1/plans/:id (teaser/full + ETag)
  │  POST /v1/plans/:id/readjustments (baseVersion required)
  ▼
[Supabase Postgres + Auth + RLS]
  drafts (anon draftId httpOnly) → bind(subject) post-login → generations → reads
        │
        ├── next= preservation: %2Fplanly · %2Fplanly%2Fdraft · %2Fdashboard
        └── gates: soft-gate at Generate (entry/Skip preserved) · 403 → /pricing#plans
```
Footnote: Discard is `POST /v1/drafts/:id/discard` → `410` on next GET (server `returnTo`; dest TBD P3). No `PATCH` on drafts/steps/plans — mutations only via `PUT step` + `POST bind/generate/readjustments` per spec §3.

- Privacy fork: static tools stay zero-network after model load; Planly backend traffic is confined to the separate origin + `/v1/*` JSON allowlist. No cross-contamination by construction.
- Auth (observed copy, semantics unverified): `/get-started?next=…` — Email/OTP vs Google; "OTP 1-day vs Google 30-day" session claim is UNVERIFIED (probe P2).

## 5. Phases PH0–PH3 (T1–T10)

| Phase | Tickets | Exit criteria |
|-------|---------|---------------|
| PH0 Foundations | T1 separate-origin API + `/v1/*` allowlist · T2 draft model + RLS + `next=` merge | Anon draft round-trip; Skip path preserves entry |
| PH1 Creation core | T3 S1 (Q1–Q4 observed) + S2–S6 shells behind P1 · T4 Generate 202/poll (gated) · T5 Discard/Close via server `returnTo` | Ready → soft-gate → generate → read path works with fixtures |
| PH2 Gates + probes | T6 entitlement gate (paid inclusion observed; Free-exclusion TBD P5) · T7 P1–P5 probe harness | P1/P4 closed; enforcement step confirmed |
| PH3 Hardening | T8 SLO dashboards + funnel · T9 retention/rollup (protect 500 MB) · T10 launch gate (pre-mortem + red-team) | SLOs green on fixtures; CONDITIONAL GO re-vote before depth |

Observed baseline carried in: Step 1 Q1 role (`SDE Intern` / `Software Engineer`) · Q2 exp (`0-2` / `2-5`) · Q3 companies (`Startups` / `FAANG` / `All Product Based Companies` / `Open to all`) · Q4 region (`India` / `US-Europe` / `Others`); chrome `Step 1 of 6` / `Next` / `Discard my plan` / `Close`. Validation beyond `*`: NOT-OBSERVED.

## 6. Risks + mitigations

| Risk | Level | Mitigation |
|------|-------|------------|
| Steps 2–6 content unknown | HIGH until P1 | Block PH1 depth; P1 captures verbatim + options + `*`/errors + URL + timestamp |
| Generate trigger/schema unknown | HIGH until P4 | Fixture-only Generate; soft-gate; P4 closes trigger + payload + edit/readjust/missed-day |
| Per-step validation (only `*` seen) | MED | P1 invalid-input pass; server-side validation regardless |
| Auth enforcement step TBD | MED | P2: Skip vs OTP vs Google full Draft; confirm enforcement step + `next=` variants |
| Free-exclusion / paywall interception TBD | MED | P5: capture exclusion block (if any) + interception + matrix verbatim; 403 → `/pricing#plans` default |
| Privacy fork violation | MED | Separate origin + `/v1/*` JSON allowlist + audit; static tools unaffected |
| Session semantics unverified (OTP 1-day vs Google 30-day) | LOW | P2 confirms; no session-duration claim until then |

## 7. Probes P1–P5 (funded work)

- P1: JS-render `/planly/draft`, Next with valid + invalid Step-1 → Steps 2–6 verbatim + options + `*`/errors + URL + timestamp.
- P2: Skip vs OTP vs Google full Draft → enforcement step + 1-day/30-day behavior + `next=` variants.
- P3: href/dest capture (Create / Discard / Close / Plan-with-Planly / Start-free) + `?view=features` parity.
- P4: login-gated Generate trigger + Sprint/Daily payload + edit/readjust/missed-day flows; closes "2–12 months" as Wizard fact vs marketing.
- P5: Free-exclusion block (if any) + paywall interception + `/pricing#plans` matrix verbatim + timestamp. Order: P1/P4 first, then P2/P3/P5.

## 8. SLOs + funnel (spec §10 verbatim — committed)

| SLO | Target | Probe |
|---|---|---|
| save p95 | < 400ms (`PUT step`) | histogram `http.put_step` |
| stepdef p95 | < 300ms (`GET step`) | histogram `http.get_step` |
| generate-accept p95 | < 600ms (`POST generate` → 202) | histogram `http.gen_accept` |
| poll-to-visible | < 60s (202 → plan readable) | `op.accepted → plan.served` trace |
| merge-loss | = 0 (bind never drops steps) | `steps_before == steps_after` assert per bind |
| duplicate | = 0 (no double-op per key) | unique-conflict unexpected counter |
| false-allow | = 0 (no unentitled full) | nightly entitlement join audit |

- Dashboards: latency p50/p95 per route; op funnel `accepted→running→succeeded/failed`; teaser vs full serve ratio; 429/402/409 rates.
- Guards: G1 (contract guard, CI: OpenAPI snapshot + TeaserGuard lint + status-code matrix + ETag round-trip) · G2 (SLO guard, staging: k6 run asserting the 7 SLOs above). Promote blocked on G2 green.
- Funnel (creation only): `/planly` → Draft S1 → S6-ready → auth (Skip vs login) → Generate → read. No output-quality SLO is set — output schema is NOT-OBSERVED until P4.
- Teaser/full partition (examples only, P4-unlocked default to full): e.g. teaser may contain title / summary ≤280 chars / step count / price-range bucket only; everything else defaults to full (deny-by-default). New fields default to full until P4 unlocks them. Unentitled reads get `full:null` explicitly.
- Proposed, NOT committed (no availability promise on free tier): API 99.5% monthly, `next=` preserved 99.9%, draft bind loss < 0.1% — tracked as proposals only; committed SLOs are the 7 rows above.
- Cost guards (not SLOs): alert at 80% of any quota; page at DB >400 MB / >80k req/day / CPU >10 ms p95.

## 9. TBDs (explicit, no promises)

- Q2–Q4 option semantics + Steps 5–6 content (P1). Steps 2–6, Sprint/Daily stay empty-until-probed (no OUT promises).
- Per-step validation rules beyond `*` (P1).
- Discard/Close destinations; Create/Plan-with-Planly/Start-free hrefs (P3).
- Enforcement step + OTP-1d vs Google-30d semantics (P2, unverified — no claim made here).
- Free-exclusion + paywall interception (P5).
- Pricing matrix verbatim + timestamp as source of truth (P5; paid inclusion observed: Basic ₹4399/7999 · Core ₹6049/10999 · Max ₹10999/19999 — "Access depends on plan").
- LLM/model choice, prompt, and eval for generation (post-P4; no commitment in this doc).
- Canonical host TBD until S-fix: `app.planly.*` (Pages) + `api.planly.*` (Worker route) assumed; no prod host committed.
- CORS/cookie TBD until S-fix: CORS allowlist (app origin only assumed) + `draftId` cookie attrs (`HttpOnly; Secure; SameSite=Lax`) unconfirmed.
- Quota/TTL TBD until S-fix: per-IP / per-draft caps, op TTL 24h, teaser CDN-cache vs `full: private, no-store`, ETag semantics per spec — pending S-fix confirmation.
- Secrets TBD until S-fix: service-role / Hyperdrive / JWT JWKS handling unconfirmed; Worker never uses `service_role` assumed.
- Guards: G1 Teaser ≠ Wizard ≠ Output (teaser-index→wizard-step mapping rejected; `teaser_wizard_conflation_attempt` must stay 0) · G2 Curriculum ≠ Plan (marketing 7-item `/planly` stepper ≠ 6-step Draft Wizard; only shared label is "About you").
- Spelling: canonical `Planly` throughout (not planly/PLANLY except paths/code).

## 10. Decision matrix — Stack A vs fallbacks

| Criterion | Stack A (Supabase + Workers + Pages) | Neon (fallback DB) | Vercel Hobby | Render (overflow only) |
|-----------|--------------------------------------|--------------------|--------------|------------------------|
| $0 fit | Yes — defined caps above | 0.5 GB; suspend 5 min; ~500 ms resume | Non-commercial disqualifier — REJECT as primary | Sleep 15 min; ~60 s cold — overflow only |
| Auth/RLS | Built-in (RLS per subject) | Bring own auth | OK but disqualified | Bring own ops |
| Latency risk | CPU 10 ms cap → keep handlers thin | Resume penalty on idle | — | Cold-start penalty |
| Verdict | **APPROVE** | Overflow/dormant standby | **REJECT** (license) | Overflow only |

## 11. Verdict

**CONDITIONAL GO**: approve Stack A + privacy-prefix exception, fund P1–P5 (P1/P4 first), confirm pricing source. No build beyond the creation core and no output-schema commitments until P1/P4 close and leadership re-votes.
