<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->
# Issue Tracker (placeholder)

Evaluator verdict log. One row per gate.

| Date | Evaluator verdict | Criteria checked | Evidence | Fix round (0-2) | Owner |
|------|-------------------|------------------|----------|-----------------|-------|
| 2026-09-19 | PASS | warmup-guard 1-4 PASS, tester PASS, reviewer APPROVE | orchestrator.md Step-0 + CONTEXT.md + ADR 0001 verified | 1 | orchestrator |
| 2026-09-19 | PASS | docs: 28 tools / 10 cats, search synonyms incl join, recents, batch meter, onboarding, Protect deterrent + Redact-Burn honesty, new-tool caps | README.md features/honesty/limits, LIMITS.md TOOL_CAPS + page/raster guards verified vs core/caps.js + registry.js | 0 | docs-writer |
| 2026-09-19 | PASS | docs P0+E2E+UI+6: 34 tools / 10 cats (PDF 17+6 P3A), P0 scrub→ctx.download central + revoke, E2E npm test + make-corpus.sh + gitignored corpus, UI 7-step shell contract, 6-tool honesty + base-caps/500-page/100-download guards | README.md features/honesty/downloads/UI/E2E/limits vs core/utils.js + tools/pdf/scrub.js + tools/_lib/page.js + tests/e2e/*.spec.js + fixtures.js + scripts/make-corpus.sh + .gitignore + core/registry.js + core/caps.js; LIMITS.md 34-tool header verified | 0 | docs-writer |
| 2026-09-19 | PASS | docs hard-refresh note: 28-vs-34 stale-cache, Ctrl+Shift+R + incognito + SW unregister, footer v4·34 | README.md Stale cache section + LIMITS.md Hard-refresh note verified, no other files touched, no commit | 0 | docs-writer |

Rules: max 2 fix rounds total; builder must not commit until PASS; orchestrator owns fan-out.
