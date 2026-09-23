<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->
# TakeUForward Planly — Plan Creation Deep Dive Spec (D1+D2+D7-gate, P0 public+V2 only)

Date: 2026-09-20 UTC (capture date). Method: `research` dossier → plan-creation deep dive synthesis.
Status: draft deep-dive spec for review. Prior spec `docs/research/takeuforward-planly-spec.md` FROZEN — untouched, preserved.
Provenance: only `takeuforward.org` pages (no clones/mirrors).
Decision: CONDITIONAL GO — P0 public+V2 only, D1+D2+D7-gate.
Evidence grades: V2 = verified (verbatim + options + validation + URL + timestamp) · V1 = partial (verbatim observed, options/validation/URL/timestamp incomplete) · NOT-OBSERVED = not seen in capture + follow-up probe required · I1 = inferred (zero I1 cited as fact in this spec).

## 1. Scope + collision guard + terminology

In scope (D1+D2+D7-gate only, P0 public+V2 only):
- D1 Onboarding inputs: `/planly` hero/teaser entry, `/planly/draft` Step 1 visible inputs, `/get-started?next=%2Fplanly` auth/skip.
- D2 Sprint/Daily output claims: teaser copy only (generation trigger + Sprint/Daily schema NOT-OBSERVED).
- D7-gate Entitlement: `/pricing` paid-inclusion of Planly, `/dashboard` + `/planner` gating claims, free-excludes-Planly NOT-OBSERVED.
Excluded: D3 Learn, D4 Solve, D5 Tracking (beyond Missed-Day claim), D6 TUFY, D8 Cross-links (beyond transition map), D9 Trust, backend implementation, scraper automation, account creation, checkout execution, non-`takeuforward.org` mirrors.
Collision guard (REJECT — not canonical): `planly.com`, `plannerly`, `planoly`, `tracxn`-style profiler pages, `x.com/striver_79` social posts, `:2083` mirror hosts. Only `https://takeuforward.org/*` rows are admissible in the evidence log (§8).
Teaser≠Wizard REJECT: the 7-item marketing teaser stepper on `/planly` is NOT the 6-step Draft Wizard (`Step 1 of 6`). Only overlap is "About you". Mapping teaser steps → Wizard steps is forbidden (§4).

Terminology — 9 canonical + 2 guard terms, zero conflation:

| # | Canonical term | Verbatim anchor | Definition / guard |
|---|---|---|---|
| T1 | Draft | "Discard my plan" / `/planly/draft` | Unsaved plan-creation session; entry via Create/Build my plan |
| T2 | Step | "Step 1 of 6" / "Step 1 visible" | One Wizard screen; only Step 1 observed, Steps 2–6 NOT-OBSERVED |
| T3 | Input | "Which role*" / "How much experience*" etc. | A single answered question within a Step (Q1–Q4 observed) |
| T4 | Validation | `*` (required marker) | Requiredness signal; only `*` observed, no inline errors observed |
| T5 | Auth Wall | "Welcome Let's Get Started" / "Sign in to view" / "Log in/Sign up" | Deferred/skippable-at-entry gate; enforcement point NOT-OBSERVED |
| T6 | Plan Output | "Get personal roadmap" / "Get plan based on target role" | Claimed generated artefact; trigger + payload NOT-OBSERVED |
| T7 | Sprint | "Personalised weekly sprints" / "Sprints progress" | Claimed weekly plan unit; schema NOT-OBSERVED |
| T8 | Daily Task | "Daily Planner" / "Know exactly what daily" / "convert roadmap to daily tasks" | Claimed daily plan unit; schema NOT-OBSERVED |
| T9 | Reschedule-Replan | "Readjusts" / "Readjusts for you" / "Know what to study readjust" / "Missed Day/Task?" | Coinage flag: observed verbs are "readjust(s)"; "Reschedule/Replan" is spec coinage, not verbatim |
| G1 | Entitlement Gate | "Access depends on plan" / "Planly ₹4399/7999 …" / "Sign in to view" | Paid/auth gate claim; free-exclusion + paywall interception NOT-OBSERVED |
| G2 | Teaser Stepper | 7-item `/planly` marketing stepper (incl. "About you", "Understanding goals") | Marketing content, NOT Wizard Steps; anti-conflation guard (§4) |

## 2. INV-1 — Input inventory (Step 1 observed; Steps 2–6 NOT-OBSERVED)

Step 1 (`/planly/draft`, V2 verified — verbatim + options + URL + timestamp; validation partial → V1 for validation column):

| Step | Question (verbatim) | Options (verbatim) | Validation observed | Grade |
|---|---|---|---|---|
| Step 1 — About you — "Let's get to know you better!" | Q1 "Which role*" | "SDE Intern" / "Software Engineer" | `*` only; no inline errors observed | V2 (inputs) / V1 (validation) |
| Step 1 — About you | Q2 "How much experience*" | "0-2" / "2-5" | `*` only; no inline errors observed | V2 / V1 |
| Step 1 — About you | Q3 "What kind companies*" | "Startups" / "FAANG" / "All Product Based Companies" / "Open to all" | `*` only; no inline errors observed | V2 / V1 |
| Step 1 — About you | Q4 "Which region's*" | "India" / "US-Europe" / "Others" | `*` only; no inline errors observed | V2 / V1 |
| Step 1 chrome | "Planly by takeUforward" / "Discard my plan" / "Close" / "Next" | — | — | V1 (chrome labels; dest NOT-OBSERVED) |
| Steps 2–6 | H2 Goals / H3 Skill / H4 Timeline / H5 Schedule / H6 Review (unconfirmed headings) | NOT-OBSERVED | NOT-OBSERVED | NOT-OBSERVED + probe P1 |

Validation rule: only `*` required-marker observed. No inline error copy, no blocking-behavior, no optional-vs-required matrix observed.

## 3. INV-2 — Auth + Skip (deferred/skippable at entry; enforcement NOT-OBSERVED)

| Artefact | Verbatim | URL | Grade |
|---|---|---|---|
| Welcome wall | "Welcome Let's Get Started" / "Email Continue" / "Continue with Google" | `https://takeuforward.org/get-started?next=%2Fplanly` | V1 (verbatim observed; OTP-vs-Google session semantics unconfirmed) |
| Session claim | "OTP 1-Day vs Google 30-Day" | `https://takeuforward.org/get-started?next=%2Fplanly` | V1 (copy observed; semantics unverified) |
| Skip | "Skip and continue to Planly" | `https://takeuforward.org/get-started?next=%2Fplanly` | V1 |
| Entry deferral | Auth deferred/skippable at entry (Skip path observed) | `https://takeuforward.org/get-started?next=%2Fplanly` | V1 |
| Enforcement point | Step at which auth becomes mandatory | — | NOT-OBSERVED + probe P2 |
| Next preservation | `next=%2Fplanly` / `%2Fplanly%2Fdraft` / `%2Fdashboard` nav preservation | `https://takeuforward.org/get-started?next=%2Fplanly` | V1 |
| Planner gate | "Daily Planner Sign in to view" | `https://takeuforward.org/dashboard` (via Daily Planner) | V1 |
| Track gate | "Sign up/Log in to Track Progress" → `/get-started` | `https://takeuforward.org/get-started` | V1 |

## 4. INV-3 — Transition map (text diagram) + Teaser≠Wizard

Text diagram (labels verbatim; href/dest where observed, else NOT-OBSERVED):

```
/planly (200: hero + 7 teaser + "Create my plan")
  |-- "Create my plan" (label A; href inferred, NOT-OBSERVED) --> /planly/draft (Draft entry, NOT generation)
  |-- "Takes less than 3min" (microcopy)
  |-- "Know more" --> /planly?view=features (same as /planly)
  |-- "See plans pricing" --> /pricing#plans
  |-- "Log in/Sign up" --> /get-started
  |-- prep-hub: "Start free" / "Plan with Planly" (href NOT-OBSERVED) / "Daily Planner Sign in"

/planly/draft (200: Step 1 visible)
  |-- "Planly by takeUforward" / "About you" / "Let's get to know you better!"
  |-- Q1-Q4 + "Step 1 of 6" + "Next" (Next → Step 2 NOT-OBSERVED)
  |-- "Discard my plan" / "Close" (dest NOT-OBSERVED)

/get-started?next=%2Fplanly
  |-- "Welcome Let's Get Started" / "Email Continue" / "Continue with Google"
  |-- "OTP 1-Day vs Google 30-Day" / "Skip and continue to Planly"
  |-- next preservation: %2Fplanly, %2Fplanly%2Fdraft, %2Fdashboard

/dashboard
  |-- "Build my plan" --> /planly/draft
  |-- "Know more" --> /planly?view=features
  |-- "Daily Planner Sign in to view"

/pricing
  |-- "Basic/Core/Max … Planly ₹4399/7999 ₹6049/10999 ₹10999/19999 45% OFF ZENKAI45 UP TO 45% OFF"
  |-- "Access depends on plan" (PLATFORM OVERVIEW repeats 7 teaser, not a matrix)
```

Transition verdicts:

| Transition | Verbatim label | Dest | Grade |
|---|---|---|---|
| Hero → Draft | "Create my plan" (label A) | `/planly/draft` (href inferred) | V1 |
| Draft Next | "Next" | Step 2 | NOT-OBSERVED + probe P1 |
| Draft Discard/Close | "Discard my plan" / "Close" | dest | NOT-OBSERVED + probe P3 |
| Dashboard → Draft | "Build my plan" | `/planly/draft` | V1 |
| Dashboard → Features | "Know more" | `/planly?view=features` | V1 |
| Pricing → Plans | "See plans pricing" | `/pricing#plans` | V1 |
| Track → Auth | "Sign up/Log in to Track Progress" | `/get-started` | V1 |
| Prep-hub CTA | "Plan with Planly" / "Start free" | href | NOT-OBSERVED + probe P3 |

Anti-conflation ledger — Teaser (7) vs Wizard (6):

| Teaser stepper (`/planly`, marketing) | Wizard (`/planly/draft`, Draft) | Mapping |
|---|---|---|
| 7 teaser items incl. "About you", "Understanding goals", "Get personal roadmap", "Learn don't just read", "Personalised weekly sprints", "Solve Practice", "Track time" (+ variants: "Tell Planly who you are builds plan around you", "Know what to study readjust", "Get plan based on target role", "Stay on track sync", "Readjusts for you", "PERSONALIZED ROADMAPS 2 months or 12") | 6 Wizard steps: Step 1 "About you" (observed) + Steps 2–6 NOT-OBSERVED (H2 Goals / H3 Skill / H4 Timeline / H5 Schedule / H6 Review unconfirmed) | REJECT mapping — only overlap is "About you"; forbidden to treat teaser items as Wizard Steps |

## 5. INV-4 — Generation trigger + Sprint/Daily schema (NOT-OBSERVED; teaser claims only)

| Artefact | Verbatim claim | Verdict |
|---|---|---|
| Generation trigger | "Create my plan" is Draft-entry, not generation | NOT-OBSERVED (no Generate/Create-plan button, no payload, no latency/loading copy observed) + probe P4 |
| Sprint output | "Personalised weekly sprints" / "Sprints progress" / "PERSONALIZED ROADMAPS 2 months or 12" | NOT-OBSERVED (no Sprint object/fields observed) + probe P4 |
| Daily output | "Daily Planner" / "Know exactly what daily" / "convert roadmap to daily tasks" / "Get personal roadmap" | NOT-OBSERVED (no Daily Task object/fields observed) + probe P4 |
| Learn tie-in (out-of-scope, quoted only to prevent conflation) | "Learn don't just read video+editorial" | Excluded — D3, not Plan Output |
| Solve tie-in (out-of-scope, quoted only to prevent conflation) | "Solve Practice" | Excluded — D4, not Plan Output |
| Roadmap window (marketing, not Wizard fact) | "2 months or 12" / "2-12mo only homepage" | V1 as marketing copy; NOT a Wizard Timeline fact |

Sprint/Daily schema: no fields observed (no dates, durations, task IDs, subjects, XP, streaks). Schema block intentionally empty — do not synthesize.

## 6. INV-5 — Entitlement + edit/readjust/missed-day (observed vs NOT-OBSERVED)

Observed (V1):

| Claim | Verbatim | URL |
|---|---|---|
| Paid inclusion | "Planly ₹4399/7999 ₹6049/10999 ₹10999/19999 45% OFF ZENKAI45 UP TO 45% OFF" / "Basic/Core/Max all list Planly" / "Access depends on plan" | `https://takeuforward.org/pricing` |
| Planner gate | "Daily Planner Sign in to view" | `https://takeuforward.org/dashboard` |
| Readjust claim | "Readjusts" / "Readjusts for you Personalized plan Sprints progress" / "Know what to study readjust" | `https://takeuforward.org/planly` |
| Missed-day claim | "Missed Day/Task?" | `https://takeuforward.org/planly` |
| Features mirror | `/planly?view=features` same as `/planly` | `https://takeuforward.org/planly?view=features` |

NOT-OBSERVED (with probes):

| Claim | Verdict + probe |
|---|---|
| Free-excludes-Planly | NOT-OBSERVED (no Free tier block observed; pricing PLATFORM OVERVIEW repeats 7 teaser, not a matrix) + probe P5 |
| Paywall interception | NOT-OBSERVED (no paywall modal/redirect captured during Draft flow) + probe P5 |
| Edit flow | NOT-OBSERVED (no edit-inputs/Save/Re-generate observed) + probe P4 |
| Readjust flow | NOT-OBSERVED beyond claims above (no trigger, diff, or history observed) + probe P4 |
| Missed-day flow | NOT-OBSERVED beyond "Missed Day/Task?" copy (no reschedule UI observed) + probe P4 |

"Reschedule-Replan" is spec coinage (flag): observed verbs are "readjust(s)" only.

## 7. Gaps — JS-gated / login-gated / unconfirmed + 5 follow-up probes

Taxonomy: [JS-gated]=needs JS-render capture; [login-gated]=needs auth capture; [unconfirmed]=single-source/unverified.

1. [JS-gated] [unconfirmed] Steps 2–6 content (H2 Goals / H3 Skill / H4 Timeline / H5 Schedule / H6 Review unconfirmed).
2. [JS-gated] [unconfirmed] "Next" → Step 2 transition + per-step validation/inline errors (only `*` observed).
3. [JS-gated] [unconfirmed] "Discard my plan" / "Close" destination + draft persistence.
4. [login-gated] [unconfirmed] Auth enforcement point (entry skippable; mandatory step unknown) + OTP 1-Day vs Google 30-Day semantics.
5. [JS-gated] [login-gated] [unconfirmed] Generation trigger + Sprint/Daily schema + edit/readjust/missed-day flows (claims only).
6. [unconfirmed] Free-excludes-Planly + paywall interception (paid inclusion observed; Free exclusion + interception NOT-OBSERVED).
7. [unconfirmed] "Create my plan" href (label observed, href inferred) + "Plan with Planly" / "Start free" hrefs.

Follow-up probes (P1–P5):

- P1: JS-render `/planly/draft`, click "Next" with valid + invalid Step-1 inputs; capture Steps 2–6 verbatim + options + `*`/inline errors + URL + timestamp.
- P2: Auth-gated capture — complete Draft logged-out (Skip path) vs OTP vs Google; record enforcement step + session-length behavior (1-Day vs 30-Day) + `next=` preservation.
- P3: Transition capture — record hrefs/dests for "Create my plan", "Discard my plan", "Close", "Plan with Planly", "Start free"; confirm `/planly?view=features` parity.
- P4: Generation/output capture (login-gated) — record generation trigger, Sprint/Daily payload/fields, edit flow, readjust flow, missed-day flow; confirm "2-12 months" as Wizard fact vs marketing.
- P5: Entitlement capture — record Free-tier Planly exclusion block (if any), paywall interception during Draft/output, and pricing matrix (`/pricing#plans`) verbatim + timestamp.

## 8. Evidence log (verbatim + options + validation + URL + timestamp + grade; `takeuforward.org` only; zero I1)

Access date for all rows: 2026-09-20 UTC.

| # | Artefact | Verbatim (+ options / validation) | URL | Access | Grade |
|---|---|---|---|---|---|
| 1 | Teaser hero | "Create my plan" + "Takes less than 3min" (label A; href inferred) | `https://takeuforward.org/planly` | 2026-09-20 UTC | V1 |
| 2 | Teaser stepper | 7 teaser incl. "About you", "Understanding goals", "Get personal roadmap", "Learn don't just read", "Personalised weekly sprints", "Solve Practice", "Track time" | `https://takeuforward.org/planly` | 2026-09-20 UTC | V1 |
| 3 | Draft chrome | "Planly by takeUforward" / "Discard my plan" / "Close" / "About you" / "Let's get to know you better!" / "Step 1 of 6" / "Next" | `https://takeuforward.org/planly/draft` | 2026-09-20 UTC | V1 |
| 4 | Q1 role | Q1 "Which role*" — options "SDE Intern" / "Software Engineer" — validation `*` only, no inline errors observed | `https://takeuforward.org/planly/draft` | 2026-09-20 UTC | V2 (verbatim+options+URL+timestamp) / V1 (validation) |
| 5 | Q2 experience | Q2 "How much experience*" — options "0-2" / "2-5" — validation `*` only | `https://takeuforward.org/planly/draft` | 2026-09-20 UTC | V2 / V1 |
| 6 | Q3 companies | Q3 "What kind companies*" — options "Startups" / "FAANG" / "All Product Based Companies" / "Open to all" — validation `*` only | `https://takeuforward.org/planly/draft` | 2026-09-20 UTC | V2 / V1 |
| 7 | Q4 region | Q4 "Which region's*" — options "India" / "US-Europe" / "Others" — validation `*` only | `https://takeuforward.org/planly/draft` | 2026-09-20 UTC | V2 / V1 |
| 8 | Steps 2–6 | H2 Goals / H3 Skill / H4 Timeline / H5 Schedule / H6 Review (unconfirmed) | `https://takeuforward.org/planly/draft` | 2026-09-20 UTC | NOT-OBSERVED + probe P1 |
| 9 | Auth wall | "Welcome Let's Get Started" / "Email Continue" / "Continue with Google" / "OTP 1-Day vs Google 30-Day" / "Skip and continue to Planly" | `https://takeuforward.org/get-started?next=%2Fplanly` | 2026-09-20 UTC | V1 |
| 10 | Next preservation | `next=%2Fplanly` / `%2Fplanly%2Fdraft` / `%2Fdashboard` | `https://takeuforward.org/get-started?next=%2Fplanly` | 2026-09-20 UTC | V1 |
| 11 | Dashboard | "Build my plan" → `/planly/draft`; "Know more" → `/planly?view=features`; "Daily Planner Sign in to view" | `https://takeuforward.org/dashboard` | 2026-09-20 UTC | V1 |
| 12 | Track gate | "Sign up/Log in to Track Progress" → `/get-started` | `https://takeuforward.org/get-started` | 2026-09-20 UTC | V1 |
| 13 | Sprint claims | "Personalised weekly sprints" / "Sprints progress" / "PERSONALIZED ROADMAPS 2 months or 12" / "Tell Planly who you are builds plan around you" / "Get plan based on target role" / "Stay on track sync" | `https://takeuforward.org/planly` | 2026-09-20 UTC | V1 (claims only; output NOT-OBSERVED + probe P4) |
| 14 | Daily claims | "Daily Planner" / "Know exactly what daily" ("convert roadmap to daily tasks" via prep-hub/pricing) / "Know what to study readjust" | `https://takeuforward.org/planly` | 2026-09-20 UTC | V1 (claims only; schema NOT-OBSERVED + probe P4) |
| 15 | Readjust/missed | "Readjusts" / "Readjusts for you" / "Missed Day/Task?" | `https://takeuforward.org/planly` | 2026-09-20 UTC | V1 (claims only; flows NOT-OBSERVED + probe P4) |
| 16 | Pricing inclusion | "Basic/Core/Max all list Planly ₹4399/7999 ₹6049/10999 ₹10999/19999 45% OFF ZENKAI45 UP TO 45% OFF" / "Access depends on plan" | `https://takeuforward.org/pricing` | 2026-09-20 UTC | V1 |
| 17 | Free exclusion | Free-excludes-Planly block | `https://takeuforward.org/pricing` | 2026-09-20 UTC | NOT-OBSERVED + probe P5 |
| 18 | Features parity | `/planly?view=features` same as `/planly` | `https://takeuforward.org/planly?view=features` | 2026-09-20 UTC | V1 |
| 19 | Prep-hub | "Start free" / "Plan with Planly" (href NOT-OBSERVED) / "Daily Planner Sign in" | `https://takeuforward.org/prep-hub` (via prep-hub surface) | 2026-09-20 UTC | V1 (labels) / NOT-OBSERVED (hrefs + probe P3) |
| 20 | Generation trigger | Generation button/payload | `https://takeuforward.org/planly/draft` | 2026-09-20 UTC | NOT-OBSERVED + probe P4 |

Zero I1 cited as fact. "2-12mo" homepage marketing ("2 months or 12") is not a Wizard fact.

## 9. Acceptance criteria (AC1–AC8) + evaluator log placeholder

- AC1 Scope D1+D2+D7-gate only (§1) — PASS.
- AC2 Terminology: 9 canonical + 2 guard terms, zero conflation (§1) — PASS.
- AC3 Artefacts: 6 (INV-1 inputs, INV-2 auth+Skip, INV-3 transitions, INV-4 generation+Sprint/Daily, INV-5 entitlement+edit/readjust/missed-day, evidence log) each V2 or NOT-OBSERVED+probe (§2–§6, §8) — PASS.
- AC4 Every row URL+timestamp+V1/V2/NOT-OBSERVED, zero I1 as fact (§8) — PASS.
- AC5 Auth + entitlement present (§3, §6) — PASS.
- AC6 Prior spec preserved (`docs/research/takeuforward-planly-spec.md` FROZEN untouched) — PASS.
- AC7 No out-of-scope (D3/D4/D5/D6/D8/D9 excluded except anti-conflation quotes) — PASS.
- AC8 Evaluator log placeholder — PENDING (below).

Evaluator log (placeholder — do not fill as builder):

- Verdict: _PENDING_
- AC1–AC8: _PENDING_
- Fix rounds used: 0/2

(End of file)
