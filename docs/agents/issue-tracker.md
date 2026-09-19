<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->
# Issue Tracker (placeholder)

Evaluator verdict log. One row per gate.

| Date | Evaluator verdict | Criteria checked | Evidence | Fix round (0-2) | Owner |
|------|-------------------|------------------|----------|-----------------|-------|
| 2026-09-19 | PASS | warmup-guard 1-4 PASS, tester PASS, reviewer APPROVE | orchestrator.md Step-0 + CONTEXT.md + ADR 0001 verified | 1 | orchestrator |
| 2026-09-19 | PASS | docs: 28 tools / 10 cats, search synonyms incl join, recents, batch meter, onboarding, Protect deterrent + Redact-Burn honesty, new-tool caps | README.md features/honesty/limits, LIMITS.md TOOL_CAPS + page/raster guards verified vs core/caps.js + registry.js | 0 | docs-writer |

Rules: max 2 fix rounds total; builder must not commit until PASS; orchestrator owns fan-out.
