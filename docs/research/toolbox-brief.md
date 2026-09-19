<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->
# Research Brief — Toolbox Trust-to-Share

Date: 2026-09-19. Method: `res-research-brief` (6-section format, output per `.opencode/skills/res-research-brief/SKILL.md`).
Status: brief-gated DISCOVERY intake (per `docs/adr/0003-business-discovery.md`).

## Decision sentence (the one decision this research informs)

Decide whether to invest in a trust-to-share MVP (in-tool proof line + offline badges + Redact-Burn COPY-check checklist + pre-flight caps) versus shipping a demo-only trust pass (copy/badges without verifiable guards), for the local zero-upload PDF toolbox.

## Core questions (question | if answered → action | success criteria)

| # | Question (observable, independently searchable) | If answered → action | Success criteria |
|---|-----------------------------------------------|----------------------|------------------|
| 1 | What observable moments make privacy-sensitive users abandon a local tool and upload to Smallpdf / iLovePDF / Adobe instead (paywall hit, upload-anxiety, sign/redact doubt)? | If top-3 abandonment triggers cluster on trust-to-share moments (redact-before-share, big-file-on-mobile, sign-without-account) → scope MVP to those 3 wedge jobs per `docs/research/toolbox-improvement-report.md §3`; else cut redact/sign wedge and invest in findability/caps only. | 5 interviews per segment (privacy-sensitive sharers, mobile big-file users, no-account signers) + 3 churned-user interviews for pattern validity (per ADR 0003 rubric: JTBD pattern 5/segment + 3 churned); JTBD-framed synthesis via `res-customer-research`, bias controls logged. |
| 2 | Which premium promises (deletion timelines, encryption/redact/e-sign scope, free limits) are verifiably contradicted by primary sources, and what honest counter-claim can the local toolbox prove in-tool? | If checklist of premium promises vs local proof holds (1h/2h/24h retention vs zero-upload; hint-only Protect vs real encryption; overlay-sign vs PKI flow) → publish honesty suffixes + proof line in-tool; else downgrade claims to footer-only copy. | Checklist of premium promises verified against primary sources (official pricing/security/help pages, Sept 2026) with evidence grades [A]/[B]/[C] per `docs/research/toolbox-competitor-matrix.md`; fallback: if no primary source, second-tier = official blog/support/FAQ, never lookalike domains (`smallpdf.us`, `ilovepdf*.io` excluded per matrix §4). Companion: `toolbox-competitor-matrix.md`. |
| 3 | Does the zero-upload claim reproduce under airplane-mode + mobile-cap repro across shell tools vs CDN-gated tools (ocr, video, sign, zip)? | If airplane + mobile repro passes (zero POST/PUT with file bytes; shell offline, CDN tools show honest "needs 1 online load") → ship trust-to-share MVP with proof line + badge A/B; else fix guard/CSP/SW gaps before any trust marketing. | Airplane + mobile repro: `rg` guard audit (`core/privacy.js:60`, `PRIVACY.md:29-47`) + DevTools Network zero-POST run + offline reload per `PRIVACY.md:31-46`; mobile caps verified at 50 MB single / 150 MB batch / 20 files and `TOOL_CAPS` overrides (ocr 25/100, redact-burn 25/100 per `LIMITS.md:22-43`); pass = no file-byte POST on any of the 3 wedge jobs. |

Quality check: Q1–Q3 are observable (abandonment events, primary-source promise text, network/cap repro) — no "what do you think" opinion questions. Missing-data plan: if no primary source, fall back to [B] official blog/support, then [C] review aggregators, labeled as such; never hardcode geo-variant pricing in-tool ("≈$X/mo US list, Sept 2026 — check your checkout"). Scope fits 2 weeks: 3 questions only; split further work into a separate brief.

## Scope · exclusions · constraints table

| Axis | In scope | Explicitly excluded |
|---|---|---|
| Topic | Trust-to-share: upload guard visibility, offline badges, Redact-Burn verify-COPY, Protect hint-only honesty, pre-flight caps | Backend design, accounts/billing/auth flows, server retention pipelines — static-site only, no backend endpoint exists (`PRIVACY.md:9`, `app.js:1-18`) |
| Methods | `res-competitor-research` (top-3 complaint mining), `res-customer-research` (JTBD interviews), `res-deep-research` (primary-source verification), `res-survey-design` / `res-dossier` on demand | `litreview`, `patent` (academic/patent depth deferred per ADR 0003; revisit on demand) |
| Regions / periods / languages | Web PDF incumbents (US list pricing, Sept 2026 window); English sources; local repo `PRIVACY.md` / `LIMITS.md` as [A-local] primary | Region-specific checkout pricing, pre-2025 reviews, non-English forums |
| Evidence bar | PM value/scope gate (ADR 0002: product-manager owns user value, acceptance criteria) + domain correctness gate (domain-expert owns constraints/edge cases); 1-round debate cap, tie-breaker on deadlock | Triage/evaluator gate (post-build only, not a discovery participant per ADR 0002:27); prototype/to-questionnaire (missing locally, ADR 0002) |
| Constraints | Deadline: 2-week research window; confidentiality: no user file bytes collected (recents store tool-ids only, `core/recents.js`); accessible data: official pricing/security/help pages + local repo source; excluded channels: lookalike/affiliate domains, paid panels without consent | — |
| Output contract | Audience: decision-maker (PM + tie-breaker GO/CUT). Deliverables: report (`docs/research/toolbox-improvement-report.md`: 5 sections, trace file:line + verify step per item) + matrix (`docs/research/toolbox-competitor-matrix.md`: evidence-graded pricing/retention/feature table + top-8 complaints → opportunities). Lead-in: decision sentence + ranked backlog (8 items, trust proof first). Length: report ≤127 lines equivalent, matrix ≤55 lines equivalent. | No code changes, no in-tool copy ship in this brief — decision artifact only |

## Research plan (approach per source tier + output format)

1. Tier 1 — primary sources: Smallpdf / iLovePDF / Adobe / CloudConvert / Xodo official pricing, security, help/FAQ pages (Sept 2026) + local `PRIVACY.md`, `LIMITS.md`, `core/privacy.js:60`, `vendor/cdn-pins.js:8-62`, `tools/pdf/protect.js:23`, `tools/pdf/redact-burn.js:310-342` — evidence grade [A] / [A-local].
2. Tier 2 — official blogs/support changelogs (free-vs-pro comparisons, plan explainers, deletion/retention notices) — grade [B].
3. Tier 3 — complaint mining (Trustpilot/G2/SoftwareAdvice/Capterra/ChromeStats 2025–2026) for top-3 repeated complaints as positioning input — grade [C], never sole basis for a claim.
4. Customer tier — JTBD interviews (5/segment + 3 churned) feeding survey design (n≈384 for quantitative validation per ADR 0003 rubric); RICE/WSJF-lite scoring (reach/impact/confidence/effort) then DECISION GO/CUT via tie-breaker.
5. Output format: this brief → `res-competitor-research` matrix + `res-customer-research` JTBD synthesis → `toolbox-improvement-report.md` + `toolbox-competitor-matrix.md`; brief-gated DISCOVERY only, triage stays post-build.

### PM / competitor evidence cited

- Competitor price/retention/feature gaps: Smallpdf ~$9/mo + 1h delete; iLovePDF ~$5–9/mo + 2h delete; Adobe $14.99–$19.99/mo + cloud-save; CloudConvert 10 credits/day + ≤24h delete; Xodo ~1 action/day free + split Sign product — see `docs/research/toolbox-competitor-matrix.md §1–2`.
- Trust gaps → MVP backlog order (proof line, badge A/B, COPY-check checklist, pre-flight caps, Protect/Unlock disambiguation): `docs/research/toolbox-improvement-report.md §1–5` + ranked backlog items 1–8.
- Honesty rules (hint-only Protect, verify-the-COPY Redact, asterisked offline, banned "military-grade/100% secure/deleted-after-1h/unlimited-free"): `docs/research/toolbox-improvement-report.md §5`, sourced to `tools/pdf/protect.js:3-6`, `tools/pdf/redact-burn.js:334-342`, `PRIVACY.md:58-61`.
- Discovery wiring (brief gate, 6 GO / 2 deferred, JTBD 5/segment + 3 churned, survey n≈384, RICE/WSJF-lite, GO/CUT): `docs/adr/0003-business-discovery.md`; roles + 1-round cap: `docs/adr/0002-discovery-roles.md`.

(End of file)
