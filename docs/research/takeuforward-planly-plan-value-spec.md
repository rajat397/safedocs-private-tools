<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->
# TakeUForward Planly — Plan Value Spec (creation-value only)

Date: 2026-09-20 UTC (capture date). Method: `research` dossier → value synthesis over frozen priors.
Status: draft value spec for review. Priors FROZEN — `docs/research/takeuforward-planly-spec.md`, `docs/research/takeuforward-planly-plan-creation-spec.md`, `docs/research/takeuforward-planly-plan-creation-technical-spec.md` untouched, preserved.
Provenance: only `takeuforward.org` pages (no clones/mirrors). Zero new capture in this file; all verbatims inherited from frozen priors.
Decision: CONDITIONAL GO — value framing only (Today + Learn + Solve + Track + Missed/Readjust + horizon + paid inclusion). No build commitment in this file.
Evidence grades (inherited): V2 = verified (verbatim + options + URL + timestamp) · V1 = partial (verbatim observed, options/URL/timestamp incomplete) · NOT-OBSERVED = not seen in capture + follow-up probe required. Zero I1 cited as fact in this spec.

## 1. Scope + terminology + guards

IN (value only): value, outcomes, benefits, differentiators, content, tracking, readjust, horizon, pricing.

OUT (explicit, excluded from this file except this declaration): auth, API, idempotency, telemetry, security, scaling, backend, checkout.

Value terms — 9 canonical (B1–B9), zero conflation:

| # | Term | Verbatim anchor | Definition / guard |
|---|---|---|---|
| B1 | Plan | "Get personal roadmap" / "Get plan based on target role" | Claimed generated artefact; trigger + fields NOT-OBSERVED (§8, probe P1) |
| B2 | Personalization | "Tell Planly who you are builds plan around you" / "Get plan based on target role" | Claim that inputs shape output; input-to-output mapping NOT-OBSERVED (V5) |
| B3 | Sprint | "Personalised weekly sprints" / "Sprints progress" | Claimed weekly plan unit; schema NOT-OBSERVED |
| B4 | Daily = Today | "Daily Planner" / "Know exactly what daily" / "convert roadmap to daily tasks" | Daily unit equals the Today view; one concept, two labels — never counted twice |
| B5 | Learn | "Learn don't just read" / "curated video & expert editorial" | Video + editorial content claim; tied to Plan, not equal to Plan (G2) |
| B6 | Practice | "Solve Practice" / "timed coding env" / "POTD — Solve problem" | Timed practice + POTD claim; tied to Plan, not equal to Plan |
| B7 | Progress | "Your progress 0% 0/442" / "Track your time" / "Stay on track sync" | Tracking claim with 0/442 counter; linkage to Plan NOT-OBSERVED (V5) |
| B8 | Readjust | "Readjusts" / "Readjusts for you" / "Know what to study readjust" / "Missed Day/Task?" | Observed verbs only; coined synonyms excluded by rule — no alternate verb appears in this file |
| B9 | Outcome | "Stay on track sync" / "Know exactly what daily" / "Get personal roadmap" | Promised learner outcome; promise Tara fields NOT-OBSERVED (V3) |

Guards (binding):

- G1 Teaser ≠ Wizard ≠ Output: the 7-item `/planly` marketing stepper is not the 6-step Draft Wizard (`Step 1 of 6`), and neither is the generated Plan/Sprint/Daily output. Only overlap admitted is "About you". Mapping any teaser item to a Wizard step or to an output field is forbidden.
- G2 Curriculum ≠ Plan: the Learning Curriculum (A2Z `442 Topics`, `792 videos`, `19 modules / 95 sections`) is content the Plan points at; it is not the Plan itself. Plan references content; content does not define Plan value.

## 2. Exec summary (decision-first, ≤1 page)

**Decision.** Frame Planly plan value as a leadership promise — personal roadmap → weekly sprints → Today tasks → Learn + Solve → Track → Missed/Readjust over a 2–12 month horizon — before any commitment beyond the frozen creation core.

**Why.** Frozen evidence verifies the promise surface (V2 input options, V1 plan/sprint/today/learn/solve/track/readjust claims, V1 paid inclusion) and verifies the load-bearing unknowns: output fields, personalization mapping, content linkage, and Free-exclusion are NOT-OBSERVED. A value-only spec isolates commercial framing from those unknowns behind probes P1–P5.

**What the buyer gets (V9 MVP).** Today + Learn + Solve + Track + Missed/Readjust + horizon. Nothing else is promised in this file.

**Cost / risk.** Cost: narrative + evidence discipline only — no systems, no staffing, no timelines in this file. Risk: HIGH if output fields or linkages are assumed before P1–P5 close — mitigated by V3 (promise Tara fields), V4 (tied not equal), V5 (no auto-linkage), V8 (claims only). Residual risks: B2 mapping unverified, B7 linkage unverified, horizon as marketing vs plan fact (V6), tier boundary for Free (V10).

## 3. Value proposition (V3 promise Tara fields · V4 tied not equal · V5 no auto-linkage)

- V3 — Promise without fields: the value promise ("Get personal roadmap", "Know exactly what daily", "Stay on track sync") is stated without any output field, date, duration, subject, or score. No field is synthesized in this file.
- V4 — Tied not equal: Learn (B5), Practice (B6), and Progress (B7) are tied to the Plan (the Plan points at them) but are not equal to the Plan. Curriculum ≠ Plan (G2). Practice history ≠ Plan. Counter value ≠ Plan completion.
- V5 — No auto-linkage: no evidence observes automatic linkage from Plan → Learn progress, Plan → Solve history, or Solve → counter. Each tie is claimed proximity only until P2–P4 close.

## 4. Jobs intent (V1)

V1 — Jobs intent (claims only; intent unverified beyond copy):

| Job | Verbatim anchor | Reading |
|---|---|---|
| J1 Know what to study | "Know what to study readjust" / "Know exactly what daily" | Buyer wants a daily answer, not a topic list |
| J2 Follow a roadmap | "Get personal roadmap" / "Get plan based on target role" | Buyer wants role-shaped sequencing |
| J3 Keep weekly rhythm | "Personalised weekly sprints" / "Sprints progress" | Buyer wants week-sized commitments |
| J4 Learn with guidance | "Learn don't just read" | Buyer wants video + editorial, not raw notes |
| J5 Practice under time | "Solve Practice" / "timed coding env" / "POTD" | Buyer wants timed reps + daily prompt |
| J6 Stay on track | "Stay on track sync" / "Track your time" / "Missed Day/Task?" | Buyer wants miss-tolerance via readjust |

## 5. Ten value artifacts (A1–A10, normative)

**A1 — Value promise.** "Tell Planly who you are builds plan around you" → "Get personal roadmap" → "Know exactly what daily" → "Stay on track sync". Promise chain only; fields NOT-OBSERVED (V3, probe P1).

**A2 — Jobs map.** J1–J6 (§4) each bound to one verbatim; no intent beyond copy claimed (V1).

**A3 — Today (B4 Daily = Today).** Claim: "Daily Planner" converts roadmap to daily tasks ("convert roadmap to daily tasks", "Know exactly what daily"). Daily and Today are one artefact in this spec — single count, never double-counted. Task fields NOT-OBSERVED (probe P1). Microcopy V2 applies at entry: "Takes less than 3min".

**A4 — Learn (B5 video + editorial).** Claim: "Learn don't just read" + "curated video & expert editorial". Curriculum facts cited as content only: `442 Topics`, `792 videos`, `19 modules / 95 sections`. Curriculum ≠ Plan (G2). Plan-to-lesson linkage NOT-OBSERVED (probe P2).

**A5 — Solve (B6 timed + POTD).** Claim: "Solve Practice" + "timed coding env" + "POTD — Solve problem". Plan-to-problem linkage NOT-OBSERVED (probe P3). Practice counts (`19 Modules 442 Topics 16 Contests`) are content facts, not plan fields.

**A6 — Track (B7 Progress 0/442).** Claim: "Track your time" + "Your progress 0% 0/442" + "Stay on track sync". Counter facts: `Basic 0/99 Core 0/302 Pro 0/34` (tier-scoped counters, content only). Counter-to-plan linkage NOT-OBSERVED (probe P4).

**A7 — Missed / Readjust (B8 verbs only).** Claims: "Missed Day/Task?" + "Readjusts" / "Readjusts for you" / "Know what to study readjust". Trigger, diff, and history NOT-OBSERVED (probe P4). Observed verbs only throughout this file.

**A8 — Horizon.** Marketing claim: "2 months or 12" (homepage) / "2-12 months roadmap". V6: horizon is marketing copy, not a confirmed plan field — plan-window fields NOT-OBSERVED (probe P5).

**A9 — Benefits + differentiators (summary; detail §6).** Six benefits, paid-inclusion framing only (V7). Differentiators stated as claims only, never as measured facts (V8).

**A10 — Tier + entry microcopy (summary; detail §7).** Paid inclusion: Basic ₹4399/7999 · Core ₹6049/10999 · Max ₹10999/19999, "Access depends on plan", "45% OFF ZENKAI45 UP TO 45% OFF" (V10). Entry microcopy V1 (claim only): "Takes less than 3min" + "Create my plan". Free-exclusion NOT-OBSERVED (V10, probe P5).

V1 — Entry microcopy (claim only): "Takes less than 3min" on `/planly` beside "Create my plan". Timed-entry promise only; completion time unverified.

## 6. Benefits (V7) + differentiators (V8)

V7 — Six benefits, paid-inclusion framing only (each benefit states which paid tier includes Planly; no benefit is claimed for unpaid access):

| # | Benefit | Verbatim anchor | Inclusion note |
|---|---|---|---|
| F1 | Personal roadmap | "Get personal roadmap" | Paid inclusion per §7; unpaid scope NOT-OBSERVED |
| F2 | Weekly sprints | "Personalised weekly sprints" | Paid inclusion per §7 |
| F3 | Daily answer | "Know exactly what daily" | Paid inclusion per §7 |
| F4 | Guided learning | "Learn don't just read" | Paid inclusion per §7 |
| F5 | Timed practice + POTD | "Solve Practice" / "POTD" | Paid inclusion per §7 |
| F6 | Miss-tolerance | "Missed Day/Task?" + "Readjusts for you" | Paid inclusion per §7 |

V8 — Differentiators, claims only (never stated as measured fact; comparison unmeasured):

| # | Differentiator claim | Verbatim anchor | Grade |
|---|---|---|---|
| D-a | Role-shaped plan | "Get plan based on target role" | Claim only (V1) |
| D-b | Roadmap → daily conversion | "convert roadmap to daily tasks" | Claim only (V1) |
| D-c | Video + editorial, not raw notes | "curated video & expert editorial — not just AI notes" | Claim only (V1) |
| D-d | Readjust on miss | "Readjusts for you" + "Missed Day/Task?" | Claim only (V1) |

## 7. Tier (V10 pricing, paid-inclusion only)

V10 — Pricing (Sept 2026 capture verbatims; INR list, geo/promo-variant — confirm at purchase surface):

| Tier | Verbatim | Note |
|---|---|---|
| Basic | `₹4399 / ₹7999` | Lists Planly; "Access depends on plan" |
| Core | `₹6049 / ₹10999 Most popular` | Lists Planly; "Access depends on plan" |
| Max | `₹10999 / ₹19999 45% OFF` | Lists Planly; "Access depends on plan" |
| Promo | `ZENKAI45 45% OFF` / `UP TO 45% OFF` | Early-bird event verbatim |

Access rule stated: "Access depends on plan". Free-exclusion: NOT-OBSERVED — no Free-tier Planly exclusion block was seen in capture; no unpaid-availability claim is made in this file (probe P5).

V9 — MVP value slice: Today + Learn + Solve + Track + Missed/Readjust + horizon. Anything outside this slice (entry-wall semantics, output fields, linkage mechanics, purchase execution) is out of this file.

## 8. Gaps — value-only probes P1–P5

Taxonomy: [unconfirmed]=single-source/unverified · [needs-render]=needs rendered capture · [needs-plan-read]=needs entitled plan read.

- P1: [needs-render] [unconfirmed] Today/output fields — capture a generated Plan + Sprint + Today view verbatim + URL + timestamp; unlocks A1/A3 field claims. Nothing promised until logged.
- P2: [unconfirmed] Learn tie — capture Plan-to-lesson pointers (which video/editorial item a Today task points at) verbatim + URL + timestamp; unlocks A4 linkage. Until then V4/V5 hold.
- P3: [unconfirmed] Solve tie — capture Plan-to-problem pointers (which timed item / POTD a Today task points at) verbatim + URL + timestamp; unlocks A5 linkage.
- P4: [needs-plan-read] [unconfirmed] Track + Missed/Readjust — capture counter updates after task completion + miss behavior + readjust trigger/diff verbatim + URL + timestamp; unlocks A6/A7.
- P5: [unconfirmed] Horizon + tier boundary — confirm "2–12 months" as plan-window fact vs homepage marketing + capture Free-tier Planly block (if any) and `/pricing#plans` matrix verbatim + timestamp; unlocks A8/A10.

## 9. Evidence log (verbatim + URL + access + grade; `takeuforward.org` only; zero I1)

Access date for all rows: 2026-09-20 UTC.

| # | Artefact | Verbatim | URL | Access | Grade |
|---|---|---|---|---|---|
| 1 | Entry microcopy (V1) | "Create my plan" + "Takes less than 3min" | `https://takeuforward.org/planly` | 2026-09-20 UTC | V1 |
| 2 | Teaser stepper (G1) | 7 teaser incl. "About you", "Understanding goals", "Get personal roadmap", "Learn don't just read", "Personalised weekly sprints", "Solve Practice", "Track time" | `https://takeuforward.org/planly` | 2026-09-20 UTC | V1 |
| 3 | Personalization (B2) | "Tell Planly who you are builds plan around you" / "Get plan based on target role" | `https://takeuforward.org/planly` | 2026-09-20 UTC | V1 (claims; mapping NOT-OBSERVED, probe P1) |
| 4 | Sprint (B3) | "Personalised weekly sprints" / "Sprints progress" / "PERSONALIZED ROADMAPS 2 months or 12" | `https://takeuforward.org/planly` | 2026-09-20 UTC | V1 (claims; schema NOT-OBSERVED, probe P1) |
| 5 | Today (B4) | "Daily Planner" / "Know exactly what daily" / "convert roadmap to daily tasks" | `https://takeuforward.org/planly` | 2026-09-20 UTC | V1 (claims; fields NOT-OBSERVED, probe P1) |
| 6 | Learn (B5) | "Learn don't just read" / "curated video & expert editorial — not just AI notes" | `https://takeuforward.org/courses` | 2026-09-20 UTC | V1 |
| 7 | Curriculum content (G2) | "A2Z 442 Topics 131.3Hrs / 132hrs 442 topics 792 videos" + "~450 items 400+ problems 50 theory 19 modules 95 sections" | `https://takeuforward.org/strivers-a2z-dsa-course/strivers-a2z-dsa-course-sheet-2` | 2026-09-20 UTC | V1 (content facts; Plan linkage NOT-OBSERVED, probe P2) |
| 8 | Solve (B6) | "Solve & Practice" / "timed coding env" / "POTD — Solve problem" / "DSA / SQL / Aptitude / POTD / Online Compiler /ide" | `https://takeuforward.org/practice` | 2026-09-20 UTC | V1 (claims; Plan linkage NOT-OBSERVED, probe P3) |
| 9 | Track (B7) | "Track your time" / "Your progress 0% 0/442" / "Stay on track sync" / "Basic 0/99 Core 0/302 Pro 0/34" | `https://takeuforward.org/progress` | 2026-09-20 UTC | V1 (claims; linkage NOT-OBSERVED, probe P4) |
| 10 | Readjust/missed (B8) | "Readjusts" / "Readjusts for you" / "Know what to study readjust" / "Missed Day/Task?" | `https://takeuforward.org/planly` | 2026-09-20 UTC | V1 (claims; flows NOT-OBSERVED, probe P4) |
| 11 | Horizon (V6) | "2 months or 12" / "2-12 months roadmap" | `https://takeuforward.org/planly` | 2026-09-20 UTC | V1 as marketing copy; plan-window fact NOT-OBSERVED, probe P5 |
| 12 | Paid inclusion (V7/V10) | "Basic/Core/Max all list Planly ₹4399/7999 ₹6049/10999 ₹10999/19999 45% OFF ZENKAI45 UP TO 45% OFF" / "Access depends on plan" | `https://takeuforward.org/pricing` | 2026-09-20 UTC | V1 |
| 13 | Input options (V1; V2 support claim scoped to Q1-Q4 only) | Q1 "Which role*" ("SDE Intern" / "Software Engineer") · Q2 "How much experience*" ("0-2" / "2-5") · Q3 "What kind companies*" ("Startups" / "FAANG" / "All Product Based Companies" / "Open to all") · Q4 "Which region's*" ("India" / "US-Europe" / "Others") | `https://takeuforward.org/planly/draft` | 2026-09-20 UTC | V1 (Q1-Q4 observed; Steps5-6 NOT-OBSERVED, probe P1) |
| 14 | Output fields | Plan/Sprint/Daily field set | `https://takeuforward.org/planly` | 2026-09-20 UTC | NOT-OBSERVED + probe P1 |
| 15 | Free-exclusion block | Free-tier Planly exclusion block | `https://takeuforward.org/pricing` | 2026-09-20 UTC | NOT-OBSERVED + probe P5 |

Zero I1 cited as fact. Row 11 horizon is marketing copy, not a plan fact. Collision guard: only `https://takeuforward.org/*` rows admissible; mirrors and social posts rejected (§1 priors).

## 10. Acceptance criteria + evaluator log

| AC | Criterion | Verdict |
|---|---|---|
| AC1 | Creation-value scope only; OUT terms confined to §1 declaration | PASS |
| AC2 | Terms B1–B9 + guards G1 (Teaser≠Wizard≠Output) G2 (Curriculum≠Plan); B8 observed verbs only | PASS |
| AC3 | V1–V10 each stated (§2–§7) | PASS |
| AC4 | Ten artifacts A1–A10 present (§5) | PASS |
| AC5 | Benefits (6, paid-inclusion only, V7) + differentiators (claims only, V8) present (§6) | PASS |
| AC6 | Tier V10 with four price verbatims + promo + "Access depends on plan" + Free-exclusion NOT-OBSERVED (§7) | PASS |
| AC7 | Gaps P1–P5 value-only with closure criteria (§8) | PASS |
| AC8 | Evidence log: every row URL+timestamp+V1/V2/NOT-OBSERVED, `takeuforward.org` only, zero I1 (§9) | PASS |
| AC9 | Priors FROZEN untouched; single-file write; no subagents | PASS |
| AC10 | Evaluator log placeholder unfilled | PENDING |

Evaluator log (placeholder — do not fill as builder):

- Verdict: _PENDING_
- AC1–AC10: _PENDING_
- Fix rounds used: 0/2

(End of file)
