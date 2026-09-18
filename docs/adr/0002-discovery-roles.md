<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->
# ADR 0002: Discovery Roles

Date: 2026-09-19
Status: Accepted

## Context

Need PM/domain debate before engineers start building. Upstream opencode has no PM persona; product-manager, domain-expert, and tie-breaker roles must be composed locally via grill-with-docs (grill + docs + deep-research behaviors) or equivalent prompts.

## Decision

Adopt 3 roles for discovery debate:

- product-manager: owns user value, scope, acceptance criteria.
- domain-expert: owns domain correctness, constraints, edge cases.
- tie-breaker: resolves PM vs domain deadlock with a binding call.

Skill wiring:

- product-manager: grill-with-docs, ask-matt, to-spec
- domain-expert: domain-modeling, research, wayfinder, ask-matt
- tie-breaker: to-spec, handoff

Cap debate at 1 round to bound cost/latency.

Triage is excluded from discovery because it is evaluator-only (final quality gate, must PASS to ship) — not a debate participant.

to-questionnaire and prototype are not wired because both are missing locally (no skill/agent installed); wire them only once available.

## Consequences

- Structured PM/domain conflict surfaces early, before planner/builder fan-out.
- +3 debate spawns overhead, capped by 1-round limit.
- Tie-breaker guarantees a decision even on deadlock.
- Triage stays clean as post-build gate; no role confusion.

## Alternatives

- 2-role fallback (product-manager + domain-expert only, orchestrator synthesis on deadlock): accepted as fallback when spawn budget is tight or tie-breaker unavailable. Loses binding third-party call; orchestrator bias risk.
- Direct-to-planner (no discovery debate): rejected — repeats prior scope/domain misses.
- Wiring to-questionnaire/prototype now: rejected — missing locally, would fail.
