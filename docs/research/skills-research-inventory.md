<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->
# Skills Research Inventory

Date: 2026-09-19. Source: `alirezarezvani/claude-skills@research/` (MIT). See ADR 0003.

## Upstream (8 research skills)

| # | Name | Purpose | Upstream path | License | Status |
|---|------|---------|---------------|---------|--------|
| 1 | res-research-brief | Fuzzy topic → scoped, decision-oriented brief (questions, success criteria, executable plan) | `res-research-brief/SKILL.md` | MIT | Installed |
| 2 | res-deep-research | Multi-source deep research with citation-grade synthesis, conflict resolution, sourced verdict | `res-deep-research/SKILL.md` | MIT | Installed |
| 3 | res-competitor-research | Competitor profiling (product, pricing, positioning, GTM, moat) with evidence-graded tables; complaint-mining | `res-competitor-research/SKILL.md` | MIT | Installed |
| 4 | res-customer-research | Interviews, JTBD framing, evidence-based insight synthesis, bias controls | `res-customer-research/SKILL.md` | MIT | Installed |
| 5 | res-survey-design | Sampling plan, sample-size math, wording/order/non-response bias checks, analysis-ready instrument | `res-survey-design/SKILL.md` | MIT | Installed |
| 6 | res-dossier | Entity briefing packs (companies/people): verified facts, timeline, network map, open questions | `res-dossier/SKILL.md` | MIT | Installed |
| 7 | res-litreview | Academic literature review | `res-litreview/SKILL.md` | MIT | Deferred |
| 8 | res-patent-landscape | Patent search/analysis | `res-patent-landscape/SKILL.md` | MIT | Deferred |

Local install layout (flat): `.opencode/skills/<name>/SKILL.md`.

## Local comparison (16 pre-existing skills)

| Local skill | Overlap with upstream 8 | Verdict |
|---|---|---|
| research | Delegates background-agent investigation; overlaps res-deep-research method but kept as execution vehicle | Keep; domain-expert uses both |
| domain-modeling | Domain invariants/ubiquitous language; no overlap | Keep |
| grill-with-docs / grilling | Debate/interview mechanics; customer-research interviews complement, not replace | Keep |
| to-spec / to-tickets / handoff / wayfinder | Spec/planning/tracking; res-research-brief feeds them, no overlap | Keep |
| product-manager | Role/gate; consumes res-* outputs | Keep |
| triage agents | Evaluator-only (final quality gate); consumes nothing, not a discovery participant (ADR 0002:27) | Keep |
| code-review / codebase-design / diagnosing-bugs / improve-codebase-architecture / implement / tdd / ask-matt | Build-side; no overlap | Keep |

No local skill replaced. Net: 16 local + 6 installed = 22 skills; 2 upstream deferred.
