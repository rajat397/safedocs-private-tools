<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->
# ADR 0003: Business Discovery Skills

Date: 2026-09-19
Status: Accepted

## Context

Good at building, weak at deciding what is worth building. Discovery (ADR 0002) added PM/domain debate roles, but the team lacked business-research skills: no systematic way to profile competitors, understand customers, scope research questions, validate quantitatively, or brief a decision-maker. Upstream `alirezarezvani/claude-skills@research/` (MIT) offers 8 research skills; local repo already has 16 non-research skills and a generic `research` delegation skill.

## Decision

Install 6 `res-*` skills as GO, defer 2:

- GO (installed, flat layout under `.opencode/skills/`): res-research-brief, res-deep-research, res-competitor-research, res-customer-research, res-survey-design, res-dossier.
- DEFERRED: litreview, patent (academic/patent depth not needed for MVP discovery; revisit on demand).

Wiring (per DECISION):

- product-manager: + res-research-brief, res-competitor-research, res-customer-research, res-survey-design
- domain-expert: + res-deep-research, res-dossier (alongside existing research, wayfinder)
- Brief-gated flow: every DISCOVERY run starts with res-research-brief before fanning out to competitor/customer/deep research.

Layout: flat (`.opencode/skills/<name>/SKILL.md`), matching existing convention. License: MIT upstream, attributed in each SKILL.md frontmatter; repo docs stay PolyForm-Noncommercial.

## Consequences

- Brief-gated DISCOVERY: scoped questions + success criteria before research spend.
- Complaint-mining: competitor research harvests top-3 repeated complaints as positioning input.
- JTBD + survey: customer research (JTBD framing) feeds survey design for quantitative validation.
- Dossier pattern: entity brief packs for companies/people ahead of decisions.
- +6 skills maintenance/lookup surface; bounded by brief gate and 1-round debate cap (ADR 0002).

## Alternatives

- All 8 now (incl. litreview + patent): rejected for MVP — unused depth, extra surface; deferred, not abandoned.
- 6 MVP (chosen): covers brief → research → validate → brief-decision loop with minimal surface.
- No new skills (roles only): rejected — debate without evidence methods repeats prior misses.

## Triage stages for research install

- Intake via res-research-brief: scoped questions + success criteria before research spend.
- Evidence via res-deep / competitor / customer / survey / dossier: competitor top-3 complaints, JTBD patterns, survey validation, entity dossiers.
- Score (RICE/WSJF-lite + effort): reach / impact / confidence / effort.
- DECISION GO/CUT via tie-breaker.

Rubric:

- reach / impact / confidence / effort scored per opportunity; effort bounds build cost.
- Complaint frequency: top-3 repeated complaints required for positioning input.
- JTBD pattern: 5/segment + 3 churned interviews for pattern validity.
- Survey: n≈384 for quantitative validation.

Location: evaluator-only triage post-build gate only. Discovery consumes res-* but triage does not (ref ADR 0002:27).
