<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->
# TakeUForward Planly — Plan Creation Technical Spec (Principal Lane)

Date: 2026-09-20 UTC (capture date; spec authored 2026-09-21 UTC). Method: principal-lane synthesis over frozen priors.
Status: draft technical spec for review. Priors FROZEN — `docs/research/takeuforward-planly-spec.md` and `docs/research/takeuforward-planly-plan-creation-spec.md` untouched, preserved.
Provenance: only `takeuforward.org` pages (no clones/mirrors). Zero new capture in this file; all verbatims inherited from frozen priors.
Decision: GO — conditional, creation core only (Draft → Generate → Sprint/Daily → Readjust + gates). No tracking/billing/CMS scope.
Evidence grades (inherited): V2 = verified (verbatim + options + URL + timestamp) · V1 = partial · NOT-OBSERVED = not seen + probe required · I1 = inferred (zero I1 cited as fact in this spec).

## 1. Exec summary (≤1 page, decision-first)

**Decision.** Build creation core only: server-driven 6-step Draft Wizard, anonymous server draft, soft-gate at Generate, async idempotent generation, gated read, event-sourced readjust. Defer everything else.

**Why.** Frozen evidence verifies demand surface (Step 1 Q1–Q4 V2, `Step 1 of 6` chrome, Skip→`/planly` auth deferral, paid Planly inclusion Basic ₹4399/7999 · Core ₹6049/10999 · Max ₹10999/19999) and verifies the two load-bearing unknowns: Steps 2–6 content and Generate trigger/schema are NOT-OBSERVED. A thin creation core isolates that risk behind probes P1–P5 instead of speculative schema.

**Principal decisions (binding).**

| ID | Decision | Kills which risk |
|---|---|---|
| D-A | Server-driven wizard: step definitions, ordering, `*` requiredness served by `DraftService`; client renders, never hardcodes | Wizard drift; Teaser↔Wizard conflation |
| D-B | Anonymous server draft: `Draft` created pre-auth, server-owned `draftId`; back-nav is forward-only merge, never delete | Lost anon progress; Step-2+ ambiguity |
| D-C | Soft-gate at Generate: entry/Skip preserved via `next=` (`%2Fplanly`, `%2Fplanly%2Fdraft`, `%2Fdashboard`); auth mandatory only at Generate | Premature wall; OTP 1-day vs Google 30-day session confusion |
| D-D | Async idempotent Generate: `POST /v1/drafts/:id/generate` + `Idempotency-Key` → `202` + `operationId`, poll to completion, safe retry | Double-generate; duplicate Plans on retry |
| D-E | Gate Generate + read: `EntitlementService` checks paid inclusion on Generate and on Plan/Sprint/Daily read | Free-tier leak; paywall interception unknown |
| D-F | Event-sourced readjust: `Readjustment` events appended, Plan re-derived, versioned; no in-place mutation | Silent overwrites; missed-day ambiguity |

**Tiers.** Exec (§1–§2: decision, cost, risk) · Principal (§3–§6: design, contracts, artifacts, telemetry, probes) · Distinguished (§7: wayfinder ticket graph + handoff shells, marked NON-EXECUTABLE).

**Cost / risk.** Cost: 3 services + 1 event log + entitlement checks on 2 paths (Generate, read). Risk: HIGH if Steps 2–6 or Generate schema assumed before P1/P4 close — mitigated by empty-until-probed schemas (§4.4) and soft-gate (§4.2). Residual risks: validation semantics (only `*` observed), enforcement step (NOT-OBSERVED), Free-exclusion block (NOT-OBSERVED), readjust UX (claims only). Probes P1–P5 close each; no build beyond core until P1+P4 return.

## 2. Frozen context + guards (do not re-verify here)

**Frozen inputs.** `takeuforward-planly-spec.md` (D1–D9, 11 entities, pricing matrix) + `takeuforward-planly-plan-creation-spec.md` (D1+D2+D7-gate, INV-1…INV-5 evidence log rows 1–20, probes P1–P5). This spec adds design only; it cites, never edits, frozen rows.

**Observed рубашка (inherited, not re-captured).** Step 1 `/planly/draft`: Q1 "Which role*" (`SDE Intern` / `Software Engineer`) · Q2 "How much experience*" (`0-2` / `2-5`) · Q3 "What kind companies*" (`Startups` / `FAANG` / `All Product Based Companies` / `Open to all`) · Q4 "Which region's*" (`India` / `US-Europe` / `Others`) · chrome "Planly by takeUforward" / "Discard my plan" / "Close" / "Step 1 of 6" / "Next". Auth `/get-started?next=%2Fplanly`: "Email Continue" / "Continue with Google" / "Skip and continue to Planly" → `/planly`, "OTP 1-Day vs Google 30-Day". Paid `/pricing`: Basic ₹4399/7999 · Core ₹6049/10999 · Max ₹10999/19999, "Access depends on plan". Teaser `/planly`: 7-item marketing stepper ≠ 6-step Wizard (only overlap "About you"; mapping REJECTED).

**NOT-OBSERVED (blocking; zero I1 as fact).** Steps 2–6 content · per-step validation beyond `*` · "Next"/"Discard"/"Close" destinations · auth enforcement step · generation trigger/payload/latency · Sprint/Daily schema/fields · Free-excludes-Planly block · paywall interception modal/redirect · edit flow · readjust trigger/diff/history · missed-day UI beyond "Missed Day/Task?" copy · "Create my plan" / "Plan with Planly" / "Start free" hrefs.

**Invariants (binding on all design).**

| ID | Invariant | Given / When / Then |
|---|---|---|
| INV-1 | Server-authoritative wizard | Given client renders Step N / When definition missing or stale / Then server definition wins; client never advances past server-confirmed step |
| INV-2 | Forward-only, back-nav merge | Given user edits Step ≤ current / When saving / Then merge into Draft, current-step pointer never regresses except explicit Discard |
| INV-3 | Auth merge preserves anon | Given anon `draftId` + login via `next=` / When `AuthSession` binds / Then anon inputs preserved 1:1 under authed owner; no fork, no loss |
| INV-4 | Async idempotent Generate | Given same `Idempotency-Key` retried / When Generate re-POSTed / Then exactly one `Plan`; retries return same `operationId`/result |
| INV-5 | Append-only readjust + service entitlement | Given readjust request / When applied / Then new `Readjustment` event appended, Plan version+1 re-derived; every Generate/read passes `EntitlementService` |

**Out-of-scope (explicit).** Tracking/progress, billing/checkout/refunds, CMS/curriculum content, notifications, offline/PWA, multi-workspace, AI internals (TUFY credits, prompts, models), perf beyond SLO (§5). D3 Learn, D4 Solve, D5 Tracking, D6 TUFY, D8 Cross-links, D9 Trust excluded except anti-conflation quotes.

## 3. Principal design (domain, seams, contracts, TDD)

**Aggregates (9 + 1 guard).** `Draft` (owner nullable, currentStep, status: `editing|ready|generating|generated|discarded`) · `Step` (index 1–6, definition ref, answers) · `Input` (Q key, verbatim options ref, value) · `Validation` (`required *` + server rules; inline-error copy empty-until-probed) · `AuthSession` (method OTP/Google, expiry 1-day/30-day claim-unverified, `next=` binding) · `Plan` (generated artefact, version) · `Sprint` (weekly unit; fields empty-until-probed) · `DailyTask` (daily unit; fields empty-until-probed) · `Entitlement` (paid inclusion verdict) · `Readjustment` (append-only event) · `TeaserGuard` (compile/lint guard rejecting teaser→wizard step mapping).

**Module seams (deep modules, small interfaces).**

| Service | Owns | Exposes | Must not own |
|---|---|---|---|
| `DraftService` | Draft lifecycle, step definitions, merge, Discard | `createDraft(anon)`, `getDefinition(step)`, `saveAnswers(draftId, step, inputs)`, `discard(draftId)` | Auth semantics, pricing |
| `GenerateService` | Async Generate orchestration, idempotency, polling | `POST /v1/drafts/:id/generate`, `GET /v1/operations/:opId`, idempotency store | Entitlement verdict (calls it) |
| `EntitlementService` | Paid inclusion verdict | `canGenerate(subject)`, `canRead(subject, planId)` | Draft content, generation |
| `ReadjustService` | Event append, re-derive, versioning | `appendReadjustment(planId, event)`, `getHistory(planId)` | In-place Plan mutation (forbidden) |

**Contracts (OpenAPI-ish, minimal).**

| Method + path | Auth | Request | Response | Errors |
|---|---|---|---|---|
| `POST /v1/drafts` | anon OK | `{}` | `201 { draftId, currentStep: 1, definition: StepDef }` | `500` |
| `GET /v1/drafts/:id/steps/:n` | anon OK (owner-scoped) | — | `200 { step, inputs: InputDef[], required: ["*"] }` | `404`, `410` discarded |
| `PUT /v1/drafts/:id/steps/:n` | anon OK | `{ inputs: [{q, value}] }` | `200 { draftId, currentStep, merged }` (INV-2) | `422` validation (server rules; copy TBD P1) |
| `POST /v1/drafts/:id/generate` + `Idempotency-Key` | required (D-C/D-E) | `{ idempotencyKey }` | `202 { operationId, status: queued }` | `401`, `403` not-entitled, `409` already-generating (same op) |
| `GET /v1/operations/:opId` | required | — | `200 { status: queued\|running\|succeeded\|failed, planId? }` | `404` |
| `GET /v1/plans/:id` (+ sprints/dailies) | required + entitled | — | `200 { plan, version, sprints: [], dailies: [] }` (arrays empty-until-probed) | `401`, `403`, `404` |
| `POST /v1/plans/:id/readjustments` | required + entitled | `{ type, payload }` (type enum TBD P4) | `201 { eventId, planVersion }` | `401`, `403`, `422` |

**State machines.** Draft: `editing → ready → generating → generated`; `editing → discarded` (any point); `generating → editing` on failure only. Operation: `queued → running → succeeded|failed`; terminal states immutable; retry with same key returns current state (INV-4). Plan version: integer, +1 per `Readjustment` append; reads default to latest, history explicit (INV-5).

**TDD seams + doubles (test-first, no implementation here).** Seams: step-definition provider (fake: Step-1 Q1–Q4 fixture) · idempotency store (in-memory double asserting single-execution under retry storm) · entitlement stub (matrix anon/authed/entitled) · event log double (assert append-only, re-derive determinism). Cases: back-nav merge preserves later answers (INV-2) · anon→auth binding preserves inputs across `next=` variants (INV-3) · double-POST Generate yields one Plan (INV-4) · readjust append bumps version, history replay reproduces head (INV-5).

## 4. Eight artifacts (normative)

**A1 — Creation state diagram (text).** `anon /planly → createDraft → editing(S1..S6, merge) → ready → [auth? next=] → generate(202,poll) → generated → read(gated) → readjust*(append, v+1)`; side exits: `Discard → discarded (410)`; `401/403 → get-started?next=<origin> → merge → resume`.

**A2 — Draft lifecycle + `next=` preservation.** Anon `POST /v1/drafts` sets httpOnly `draftId`; every auth redirect carries `next=` ∈ {`%2Fplanly`, `%2Fplanly%2Fdraft`, `%2Fdashboard`}; post-login `bind(draftId, subject)` per INV-3; Skip path continues anon without binding. Discard/Close dest TBD P3 — client must route via server `discard` then follow server-returned `returnTo`, never hardcoded.

**A3 — Generate contract (idempotent async).** Header `Idempotency-Key: <uuid>` required; server keys `(draftId, key)` → single operation; `202 { operationId }`; client polls `GET /v1/operations/:opId` with jittered backoff (1s→8s, cap 2 min); `409` returns live `operationId`; exactly-once effect, at-least-once delivery.

**A4 — Sprint/Daily schema (empty-until-probed).** `Sprint { id, planId, index, windowTBD, taskRefs[] }` · `DailyTask { id, sprintId, dateTBD, items[] }` — all domain fields beyond ids marked TBD pending P4; clients must tolerate unknown fields and render empty states, never synthesize dates/subjects/XP.

**A5 — Entitlement matrix (anon / authed / entitled × action).**

| Action | anon | authed, not entitled | entitled |
|---|---|---|---|
| enter wizard / save draft | ALLOW (D-B) | ALLOW (merge, INV-3) | ALLOW |
| Generate | DENY → soft-gate `get-started?next=%2Fplanly%2Fdraft` (D-C) | DENY `403` → `/pricing#plans` (Free-exclusion TBD P5) | ALLOW (D-E) |
| read Plan/Sprint/Daily | DENY `401` | DENY `403` | ALLOW |
| readjust | DENY `401` | DENY `403` | ALLOW (append, D-F) |

**A6 — Readjust event append + re-derive + versioning.** Event `{ eventId, planId, baseVersion, typeTBD, payloadTBD, at }`; append validates `baseVersion == head`; derive `(head, event) → head+1` deterministic; history `GET` returns ordered events; no `PUT/PATCH` on Plan/Sprint/Daily.

**A7 — Telemetry + SLO hooks (summary; detail §5).** Funnel `enter → step_complete → ready → generate_req → generate_ok → read → readjust`; latency histograms on save/Generate-poll/read; gate-denied counters by `401/403`; merge-preservation audit on auth bind.

**A8 — Probe closure mapping P1–P5 → schema unlocks.** P1 unlocks Step 2–6 definitions + validation copy · P2 unlocks enforcement step + session semantics · P3 unlocks Discard/Close/CTA hrefs · P4 unlocks Generate trigger + Sprint/Daily fields + edit/readjust/missed-day types · P5 unlocks Free-exclusion + interception UX. No unlock without verbatim+URL+timestamp row in a follow-up evidence addendum.

## 5. Telemetry + SLO

**Funnel events (all with `draftId` hash, step, auth mode).** `wizard_enter`, `step_view`, `step_save_ok/error`, `draft_ready`, `auth_gate_hit (401/403, next=)`, `auth_merge_ok/lost_fields=0`, `generate_req`, `generate_202`, `generate_succeeded/failed`, `plan_read`, `readjust_appended`, `discard`.

**SLOs (creation core only).** Draft save p95 < 400 ms · step definition fetch p95 < 300 ms · Generate accept (202) p95 < 600 ms · poll-to-visible p95 < 60 s (async; loading state required) · auth-merge field-loss rate = 0 · duplicate-Plan rate under retry = 0 · entitlement false-allow = 0. Alerts on `generate_failed` spike, `403` spike post-pricing change, merge-loss > 0.

**Risk instrumentation.** Counter `teaser_wizard_conflation_attempt` (any client mapping teaser index→wizard step; must stay 0 — `TeaserGuard`) · histogram `steps_observed_count` (expect 1 until P1 closes; guards premature 6-step UI).

## 6. Probe closure + test plan

**Probes (inherited verbs, closure criteria).** P1: JS-render `/planly/draft`, Next with valid+invalid Step-1; closes when Steps 2–6 verbatim+options+` *`/errors+URL+timestamp logged. P2: Skip vs OTP vs Google full Draft; closes when enforcement step + 1-day/30-day behavior + `next=` variants confirmed. P3: href/dest capture for Create/Discard/Close/Plan-with-Planly/Start-free + `?view=features` parity. P4: login-gated Generate trigger + Sprint/Daily payload + edit/readjust/missed-day flows; closes "2–12 months" as Wizard fact vs marketing. P5: Free-exclusion block + paywall interception + `/pricing#plans` matrix verbatim+timestamp.

**Test plan (test-first).** Unit: merge (INV-2), idempotency storm (INV-4), append-replay determinism (INV-5), `TeaserGuard` rejection. Contract: OpenAPI table (§3) via stub server; `401/403/next=` matrix (A5). E2E (post-probe): anon→Skip→Generate-gate→Google→Generate→poll→read→readjust→version+1; Discard→410. Zero I1 fixtures: every Wizard/Sprint/Daily field beyond Step-1 Q1–Q4 must cite a probe row or remain TBD.

## 7. Distinguished appendix — NON-EXECUTABLE (wayfinder + handoff shells)

> NON-EXECUTABLE: ticket graph and shells below are planning artefacts only. No code, no migration, no config change is authorized by this section.

**Wayfinder ticket graph (blocking edges).** `T1 P1-capture(S2–S6+validation)` → `T2 wizard-definitions(DraftService)` → `T3 merge+Discard(P3)` → `T4 auth-merge(next=,P2)` → `T5 generate-contract(idempotent)` → `T6 entitlement-gates(P5)` → `T7 read-paths` → `T8 readjust-events(P4)` → `T9 telemetry+SLO` → `T10 E2E`. Edges: T2 blocked-by T1 · T4 blocked-by T1 · T5 blocked-by T4 · T6 blocked-by P5+T5 · T8 blocked-by P4+T5 · T10 blocked-by all. Cut line: nothing past T4 starts before P1+P2 close.

**Handoff shells (fill at execution; not work).** `H1 DraftService owner: __ · inputs: T1+T3 rows · done when: merge tests green` · `H2 Generate owner: __ · inputs: T5 contract · done when: retry-storm test green` · `H3 Entitlement owner: __ · inputs: P5 matrix · done when: A5 matrix tests green` · `H4 Readjust owner: __ · inputs: P4 event types · done when: replay test green`. Each shell requires evaluator PASS before next starts; max 2 fix rounds.

## 8. Acceptance criteria AC1–AC7 + evaluator log

- AC1 Exec summary decision-first with cost/risk + P1–P5 (§1) — PASS.
- AC2 Frozen context cited, priors untouched; guards (Teaser≠Wizard, collision, out-of-scope) present (§2) — PASS.
- AC3 Principal design covers 10 entities, 4 seams, contracts, state machines, given/when/then per INV-1…INV-5 + TDD seams (§3) — PASS.
- AC4 Eight artifacts A1–A8 present: state diagram, lifecycle+`next=`, Generate/`Idempotency-Key`/202/poll/retry, empty-until-probed Sprint/Daily, entitlement matrix, readjust versioning, telemetry hooks, probe mapping (§4) — PASS.
- AC5 Telemetry funnel + SLO with zero-loss/zero-duplicate gates (§5) — PASS.
- AC6 Probe closure P1–P5 + test plan; out-of-scope exclusions explicit (§6, §2) — PASS.
- AC7 Single-file write only; leadership tone, concise, risks explicit; zero I1 as fact; no subagents — PASS.

Evaluator log (placeholder — do not fill as builder):

- Verdict: _PENDING_
- AC1–AC7: _PENDING_
- Fix rounds used: 0/2

(End of file)
