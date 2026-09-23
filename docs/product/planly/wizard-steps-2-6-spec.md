# Planly Wizard Steps 2–6 — Spec (static-string grade)

Status: DRAFT spec — static strings only, rendered-unverified.
Owner file only: `docs/product/planly/wizard-steps-2-6-spec.md` (new). Planly monolith untouched. No commit.
Binding evidence: 2026-09-22 UTC, takeuforward.org only. Source grades: P1 static strings, P2 auth, P4 gated.
Canonical spelling: `Planly` everywhere. Non-canonical spellings are defects.

## Guards (binding)

- G1: Teaser != Wizard != Output. Do not conflate landing/teaser copy with wizard StepDefs or with post-plan output screens.
- G2: Curriculum != Plan. Subject/topic lists are curriculum inputs; a Plan is only the generated output after Generate. Do not promise plan fields from curriculum strings.
- 2–12mo is NOT a plan field. It is subscription-validity copy only. FORBID modeling horizon as a contract field in StepDefs, validation, payload, or schema.
- P4-gated: Generate payload / latency / schema = NOT-OBSERVED. Spec marks them TBD; no implementation may assume shape, timing, or field names.

## Auth + navigation context (P2, binding)

- Auth NOT required for S1 / landing.
- Session labels: OTP 1-day vs Google 30-day (labels only, no enforcement change in this spec).
- `next=` preserved on Skip.
- Step-level auth enforcement = NOT-OBSERVED. Do not spec enforcement here; Playwright follow-up.

## State machine (binding)

- Steps 1–6, forward-only progression + Previous.
- S1 is entry context (spec'd elsewhere; summary below for continuity). This spec owns S2–S6 StepDefs.
- `Next` / `Continue`-family CTA advances only if step validation passes; otherwise invalid-submit blocking applies (NOT-OBSERVED rendered — Playwright follow-up, see § Rendered-unverified).
- `Previous` returns to prior step without data loss (rendered behaviour NOT-OBSERVED).
- Discard → 410 (binding state transition; rendered copy NOT-OBSERVED).
- Step indicator string: `Step N of 6` (S1-observed static string; reused grade for S2–S6 indicator, rendered-unverified).

## S1 summary (context only, not owned here)

- P1-S1 (SSR Q1-Q4 only): role [SDE Intern, Software Engineer]; experience [0-2, 2-5, 5+ years]; target [Startups, FAANG, All Product Based Companies, Open to all]; region [India, US/Europe/Others]; chrome `Step 1 of 6` + `Next`.
- P1-S1B (bundle PLANLY_STEP_COPY[1] extra): prepDays Q `In how many days do you want to get prepared?`; options 30 / 60 / 90 / 120 / custom; customDays `Enter number of days` range 7–365; hint `You can adjust your daily study hours later.`; validators Select-role / exp / intern-skip / target / region + prepDays / customPrepDays msgs; chrome Next / Previous / `Step N of 6`.
- Distinction binding: SSR Q1-Q4 only (P1-S1) vs bundle prepDays extra (P1-S1B) — do not conflate.

---

## StepDef convention (all steps S2–S6)

Each StepDef is server-driven:

```json
{
  "step": 2,
  "questions": [],
  "options": [],
  "validation": [],
  "cta": "",
  "grade": "static-string",
  "rendered": "unverified"
}
```

- `questions` / `options` / `validation` / `cta` below are verbatim static strings from P1.
- Grade note on every step: static-string grade with rendered-unverified flag.
- Rendered placement + invalid-submit blocking + server-driven list wiring = NOT-OBSERVED (Playwright follow-up). Do not implement against assumed DOM selectors or API shapes.

---

## S2 — Recommended subjects

- Grade: static-string, rendered-unverified.
- Heading (verbatim): `Recommended subjects`
- Helper copy (verbatim): picked-essentials; remove-anything.
  - Intended meaning: list is pre-picked essentials; user may remove anything.
- CTA (verbatim): `Continue with selected subjects`
- Server-driven list: subject list is server-driven; level keys (verbatim slugs): `dsa` / `dbms` / `computer-networks` / `operating-system` / `oops` / `lld` (cn/os abbreviations REMOVED — full slugs per P1-S2).
- Validation catalog S2:
  - V-S2-01: >=1 subject required. Empty selection blocks Continue (blocking behaviour NOT-OBSERVED rendered).
  - V-S2-02: remove-unavailable — unavailable subjects must be removable / excluded without blocking valid selection (exact unavailable-set server-driven, NOT-OBSERVED).
- StepDef skeleton:

```json
{
  "step": 2,
  "questions": ["Recommended subjects"],
  "options": [{"source": "server", "level_keys": ["dsa","dbms","computer-networks","operating-system","oops","lld"]}],
  "validation": ["V-S2-01 >=1 subject", "V-S2-02 remove-unavailable"],
  "cta": "Continue with selected subjects",
  "grade": "static-string",
  "rendered": "unverified"
}
```

## S3 — Coding language + levels per subject

- Grade: static-string, rendered-unverified.
- Coding language options (verbatim): C++ / Java / Python; default `cpp`.
- Language scoping (verbatim binding): only `dsa` + `new_to_this`.
- Levels per subject (verbatim tracks):
  - Generic: New to this / Basic / Intermediate / Strong.
  - DSA 4-track.
  - DBMS-computer-networks-operating-system 2-track.
  - OOPs-LLD 2-track.
- Validation catalog S3:
  - V-S3-01: language required (when in scope).
  - V-S3-02: every-subject requires a level selection.
- StepDef skeleton:

```json
{
  "step": 3,
  "questions": ["coding language", "levels per subject"],
  "options": [
    {"key": "language", "values": ["C++","Java","Python"], "default": "cpp", "scope": ["dsa","new_to_this"]},
    {"key": "level_generic", "values": ["New to this","Basic","Intermediate","Strong"]},
    {"key": "level_dsa", "track": "4-track"},
    {"key": "level_dbms_computer-networks_operating-system", "track": "2-track"},
    {"key": "level_oops_lld", "track": "2-track"}
  ],
  "validation": ["V-S3-01 language", "V-S3-02 every-subject level"],
  "cta": "Confirm levels",
  "grade": "static-string",
  "rendered": "unverified"
}
```

## S4 — Roadmap review

- Grade: static-string, rendered-unverified.
- Elements (verbatim): hours banner `N hours`; Tufy prompt; Weighted schedule preview; `Confirm content`.
- Validation catalog S4:
  - V-S4-01: >=1 subject required to confirm.
- StepDef skeleton:

```json
{
  "step": 4,
  "questions": ["roadmap review"],
  "options": ["hours banner N hours", "Tufy prompt", "Weighted schedule preview"],
  "validation": ["V-S4-01 >=1 subject"],
  "cta": "Confirm content",
  "grade": "static-string",
  "rendered": "unverified"
}
```

## S5 — Weekly availability

- Grade: static-string, rendered-unverified.
- Controls (verbatim): weekday sliders 0–16 step 1 default 0.
- Copy elements (verbatim): `Est. days:`; `Day off`; total allocated; `Confirm availability`.
- Validation catalog S5:
  - V-S5-01: >=1 hour total required.
- StepDef skeleton:

```json
{
  "step": 5,
  "questions": ["weekly availability"],
  "options": [{"key": "weekday_sliders", "min": 0, "max": 16, "step": 1, "default": 0}],
  "validation": ["V-S5-01 >=1 hour"],
  "cta": "Confirm availability",
  "grade": "static-string",
  "rendered": "unverified",
  "copy": ["Est. days:", "Day off", "total allocated"]
}
```

## S6 — Finalise

- Grade: static-string, rendered-unverified.
- Fields (verbatim):
  - Plan name 1–60 (chars; over-limit blocks Generate — blocking NOT-OBSERVED rendered).
  - Start: Today / Tomorrow / Custom>=today + unavailable-hint.
- CTA (verbatim): `Generate plan`
- Metrics row (verbatim, success-screen context): Total sprints / Subjects / Study hours / Est. duration / Est. completion.
- Success screen (verbatim): `Your personalised roadmap is ready` + `Go to Dashboard`.
- StepDef skeleton:

```json
{
  "step": 6,
  "questions": ["plan name 1-60", "start Today/Tomorrow/Custom>=today"],
  "options": [{"key": "start", "values": ["Today","Tomorrow","Custom"], "custom_constraint": ">=today"}],
  "validation": ["V-S6-01 plan name 1-60", "V-S6-02 start >=today"],
  "cta": "Generate plan",
  "grade": "static-string",
  "rendered": "unverified",
  "copy": ["unavailable-hint", "Total sprints", "Subjects", "Study hours", "Est. duration", "Est. completion", "Your personalised roadmap is ready", "Go to Dashboard"]
}
```

---

## Validation catalog (consolidated)

| ID | Step | Rule (verbatim) | Rendered |
|----|------|-----------------|----------|
| V-S2-01 | S2 | >=1 subject | NOT-OBSERVED blocking |
| V-S2-02 | S2 | remove-unavailable | NOT-OBSERVED |
| V-S3-01 | S3 | language required (dsa + new_to_this scope) | NOT-OBSERVED |
| V-S3-02 | S3 | every-subject level | NOT-OBSERVED |
| V-S4-01 | S4 | >=1 subject | NOT-OBSERVED |
| V-S5-01 | S5 | >=1 hour | NOT-OBSERVED |
| V-S6-01 | S6 | plan name 1–60 | NOT-OBSERVED |
| V-S6-02 | S6 | start >=today (Today/Tomorrow/Custom) | NOT-OBSERVED |
| S1 refs | S1 | Select-role/exp/intern-skip/target/region + prepDays/customPrepDays | context only |

No other validators may be added without new P1 evidence.

## Generate skeleton (P4-gated)

- Trigger CTA (verbatim): `Generate plan` (S6).
- Post-plan loader strings (verbatim, order as observed): Understanding your goals / Estimating preparation time / Arranging the topics / Organising into sprints / Crafting your plan.
- Success screen (verbatim): `Your personalised roadmap is ready` + `Go to Dashboard`, with metrics Total sprints / Subjects / Study hours / Est. duration / Est. completion.
- Payload / latency / response schema: TBD — P4-gated NOT-OBSERVED. Do not define field names, types, timing SLAs, or retry semantics in this spec.
- No polling / webhook / idempotency promises in this spec.

## Cut line (explicit non-promises)

- No Sprint / Daily field promises. Loader string `Organising into sprints` and metric `Total sprints` are display strings only; they do not define sprint/daily object shapes, cadences, or required fields.
- No horizon field. 2–12mo copy is subscription validity only; never model as plan duration / horizon / contract field.
- No rendered-placement promises (S2–S6 DOM order, styling, responsive placement NOT-OBSERVED).
- No invalid-submit blocking behaviour promises beyond the static validation rules above (blocking UX NOT-OBSERVED).
- No server-driven list content promises beyond level keys `dsa/dbms/computer-networks/operating-system/oops/lld` (actual lists NOT-OBSERVED; cn/os abbreviations REMOVED).
- No auth-enforcement, payload, latency, or schema promises.

## Playwright follow-up (NOT-OBSERVED list)

1. S2–S6 rendered placement.
2. Invalid-submit blocking per V-S2-01 … V-S6-02.
3. Server-driven subject/option list wiring.
4. Generate payload / latency / schema capture (lifts P4 gate only with fresh evidence).
5. Step-level auth enforcement (lifts P2 NOT-OBSERVED only with fresh evidence).

## Traceability (per-verbatim row-ID map)

- P1-S1 (SSR Q1-Q4 only) → § S1 summary line 1; § State machine Step indicator.
- P1-S1B (bundle prepDays extra) → § S1 summary line 2; not owned here.
- P1-S2 (Recommended subjects + CTA `Continue with selected subjects` + slugs dsa/dbms/computer-networks/operating-system/oops/lld) → § S2.
- P1-S3 (CTA `Confirm levels`; generic `New to this / Basic / Intermediate / Strong`; DSA 4-track; DBMS-computer-networks-operating-system 2-track; OOPs-LLD 2-track) → § S3.
- P1-S4 (CTA `Confirm content`; hoursBanner; Tufy prompt; Weighted schedule preview) → § S4.
- P1-S5 (CTA `Confirm availability`; sliders 0–16; `Est. days:` / `Day off`) → § S5.
- P1-S6 (CTA `Generate plan`; metrics Total sprints / Subjects / Study hours / Est. duration / Est. completion; loader `Understanding your goals / Estimating preparation time / Arranging the topics / Organising into sprints / Crafting your plan`; success `Your personalised roadmap is ready` + `Go to Dashboard`) → § S6 + § Generate skeleton.
- P2 (auth labels + Skip next=; enforcement NOT-OBSERVED) → § Auth + navigation context.
- P4 E1-E10 (E1 trigger `Create my plan`; E2-E3 value/7-step labels; E4-E5 payload/schema NOT-OBSERVED; E6 missed-day label; E7 edit NOT-OBSERVED; E9 token-cost hypothesis; E10 2–12mo subscription-validity only) → § Generate skeleton + § Cut line.
- G1/G2 → § Guards.
