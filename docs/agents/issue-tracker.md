<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->
# Issue Tracker (placeholder)

Evaluator verdict log. One row per gate.

| Date | Evaluator verdict | Criteria checked | Evidence | Fix round (0-2) | Owner |
|------|-------------------|------------------|----------|-----------------|-------|
| 2026-09-19 | PASS | warmup-guard 1-4 PASS, tester PASS, reviewer APPROVE | orchestrator.md Step-0 + CONTEXT.md + ADR 0001 verified | 1 | orchestrator |
| 2026-09-19 | PASS | docs: 28 tools / 10 cats, search synonyms incl join, recents, batch meter, onboarding, Protect deterrent + Redact-Burn honesty, new-tool caps | README.md features/honesty/limits, LIMITS.md TOOL_CAPS + page/raster guards verified vs core/caps.js + registry.js | 0 | docs-writer |
| 2026-09-19 | PASS | docs P0+E2E+UI+6: 34 tools / 10 cats (PDF 17+6 P3A), P0 scrub→ctx.download central + revoke, E2E npm test + make-corpus.sh + gitignored corpus, UI 7-step shell contract, 6-tool honesty + base-caps/500-page/100-download guards | README.md features/honesty/downloads/UI/E2E/limits vs core/utils.js + tools/pdf/scrub.js + tools/_lib/page.js + tests/e2e/*.spec.js + fixtures.js + scripts/make-corpus.sh + .gitignore + core/registry.js + core/caps.js; LIMITS.md 34-tool header verified | 0 | docs-writer |
| 2026-09-19 | PASS | docs hard-refresh note: 28-vs-34 stale-cache, Ctrl+Shift+R + incognito + SW unregister, footer v4·34 | README.md Stale cache section + LIMITS.md Hard-refresh note verified, no other files touched, no commit | 0 | docs-writer |
| 2026-09-19 | PASS | toolbox report tester PASS + reviewer APPROVE (5 sections, evidence grounded, report-only) | docs/research/toolbox-improvement-report.md + matrix | 1 | orchestrator |
| 2026-09-19 | PASS | ADR 0002 jittered specialist retry created (Full Jitter 100ms/5s/3attempts, free-tier guard only) | docs/adr/0002-jittered-specialist-retry.md verified | 0 | orchestrator |
| 2026-09-19 | PASS | Warmup protocol removed; ADR 0001 superseded; specialist agents via `general-as-*` workaround | CONTEXT.md, orchestrator.md, ADR 0001 updated | 0 | orchestrator |
| 2026-09-19 | PASS | A01 compare scaffold | tools/compare/index.js + core/registry.js | 0 | orchestrator |
| 2026-09-19 | PASS | A02 text extraction | tools/compare/index.js (extractTextLayers) | 0 | orchestrator |
| 2026-09-19 | PASS | A03 diff algorithm | tools/compare/index.js (diffTextLayers, myersDiff) | 0 | orchestrator |
| 2026-09-19 | PASS | A04 HTML report | tools/compare/index.js (renderOverlay) | 0 | orchestrator |
| 2026-09-19 | PASS | A05 CLI integration | tools/compare/index.js (zoom/opacity sliders, export buttons) | 0 | orchestrator |
| 2026-09-19 | PASS | A06 test suite | tests/e2e/compare-smoke.spec.js | 0 | orchestrator |
| 2026-09-19 | PASS | B01 PDF parse core | core/pdf/parse.ts (parsePdf, recoverXRef, fixTrailer, recoverPages) | 0 | orchestrator |
| 2026-09-19 | PASS | B02 header detection | core/pdf/parse.ts (detectHeaderOffset, validateHeader) | 0 | orchestrator |
| 2026-09-19 | PASS | B03 xref/stream parsing | core/pdf/parse.ts (decompressFlateDecode, parseXRefStream, parseXRefTable, linearScanForObjects) | 0 | orchestrator |
| 2026-09-19 | PASS | B04 trailer chain walk | core/pdf/parse.ts (fixTrailer, walkPrevChain) | 0 | orchestrator |
| 2026-09-19 | PASS | B05 page recovery | core/pdf/parse.ts (recoverPages, collectOrphans) | 0 | orchestrator |
| 2026-09-19 | PASS | B06 repair CLI | tools/repair/index.js | 0 | orchestrator |
| 2026-09-19 | PASS | B07 repair smoke test | tests/e2e/repair-smoke.spec.js | 0 | orchestrator |
| 2026-09-19 | PASS | C01 bench runner | bench/run.js | 0 | orchestrator |
| 2026-09-19 | PASS | C02 corpus fetch | bench/fetch-corpus.js | 0 | orchestrator |
| 2026-09-19 | PASS | C03 metrics collection | bench/run.js (metrics) | 0 | orchestrator |
| 2026-09-19 | PASS | C04 bench workflow | .github/workflows/bench.yml | 0 | orchestrator |
| 2026-09-19 | PASS | C05 bench report UI | bench/index.html | 0 | orchestrator |
| 2026-09-19 | PASS | C06 PR comment bot | .github/workflows/bench.yml (PR comment) | 0 | orchestrator |
| 2026-09-20 | PASS | left-tasks: create-form + edit/fill wiring + India4 + converters4, 54 TOOLS/MODULES, 4 CDN pins | tools/pdf/create-form,edit-content,fill-form,gst-invoice,pos-billing,camera,ocr-layer,to-docx,xlsx,pptx + tools/image/heic-support + registry 54/54 + pins docx/xlsx/pptxgenjs/heic2any verified | 1 | orchestrator |

Rules: max 2 fix rounds total; builder must not commit until PASS; orchestrator owns fan-out.