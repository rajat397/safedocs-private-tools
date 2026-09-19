<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->
# Toolbox Competitor Matrix — companion

Date: 2026-09-19 (research window: Sept 2026). Scope: web PDF incumbents vs local toolbox.
Method: researcher evidence — primary sources first (official pricing / security / help pages).
Evidence grades: [A] = official pricing/security page · [B] = official blog/support/FAQ · [C] = third-party review/aggregator.

## 1. Evidence-graded matrix

| Vendor | Free limit | Paid entry (US list, Sept 2026) | Retention | Encrypt | Redact | E-sign |
|---|---|---|---|---|---|---|
| Smallpdf | 2 tasks/day reported; daily download limit (number unpublished, placeholder in UI) [B][C] | Pro ~$9/mo billed annually ($12/mo monthly); Team ~$7/mo/seat annual [A][C] | Auto-delete after 1h (unless saved to account); 256-bit TLS; ISO 27001, GDPR/CCPA [A] | Protect (password) incl. free w/ daily limit [A] | Redact tool incl. free w/ daily limit [A] | Smallpdf Sign free w/ daily limit; Sign.com 2 docs/mo free → unlimited on Pro [A] |
| iLovePDF | Core tools free w/ per-tool task caps + file-size caps (e.g. Merge 100 MB, Compress 200 MB, Office-to-PDF 15 MB); Desktop 3 tasks/day [A][C] | Premium $9/mo monthly or $5/mo billed annually ($60/yr); Business custom, 25-seat ceiling → custom [A] | Auto-delete within 2h, manual delete available; HTTPS; ISO 27001, GDPR-aligned; signed docs retained up to 5y (legal) [A] | Protect included (free + premium) [A] | Redact included (free + premium) [A] | Simple e-sign free w/ limits; Premium adds Digital Signatures + Workflows; 2,000 AI credits [A] |
| Adobe (Acrobat online + Pro) | Online tools free w/ limited use + account wall (convert/compress/merge/fill-sign); up to 2 GB single-file compress advertised [B] | Standard $14.99/mo, Pro $19.99/mo, Studio $24.99/mo (annual, billed monthly); Teams Pro $23.99/mo/seat; Pro-2024 one-time $324 / 3-yr term [A][B] | Not-signed-in files "soon deleted"; signed-in files saved to Adobe cloud (private by default); AES-256 + TLS 1.2 [B] | Protect free to add password, but removal requires paid/trial [B] | Redact = paid Pro only [A] | Fill & Sign limited free; Request e-signatures + tracking = paid [A] |
| CloudConvert | 10 conversion credits/day, free [A] | Package from $18 one-time (credits never expire, ~$0.018/credit); Subscription from $10/mo (~$0.01/credit); Enterprise custom [A] | Auto-delete ≤24h (jobs deleted 24h after end; API default deletes after first download); manual ×-delete; ISO 27001, isolated containers [A][B] | None (converter only) | None | None |
| Xodo | Web: ~1 action/day free; Desktop Reader free (view/annotate/fill); trials 3-day (Web/Desktop), Desktop demo 14-day limited [B] | Web $7.99/mo annual ($10.99 monthly); Desktop $9.99/mo annual ($19.99 monthly) or $240 perpetual; Suite $14.99/mo annual ($24.99 monthly); Mobile billed separately; 40%-for-life promo to Dec 31 2026 [A][B] | Browser-only tools never leave device; server-processed tools removed after ~1h [B] | Password + sanitize (Desktop); Web redact/organize/compress listed [A][B] | Redact listed in Web toolset [B] | Xodo Sign = SEPARATE product: Free 3 docs/mo; Basic $10/mo annual; Pro $16/mo annual; unlimited docs on paid; SOC 2, HIPAA (Aug 2026), eIDAS/ESIGN/UETA [A][B] |
| Local toolbox (this repo) | Free, no account, no daily task cap; caps are technical only: 200 MB single / 500 MB batch desktop, 50 MB / 150 MB mobile (`LIMITS.md`) [A-local] | $0 — static site, no backend, no paid tier [A-local] | Zero retention: no uploads by construction (`PRIVACY.md`: runtime upload guard + CSP + offline-first); recents store tool-ids only | HONEST LIMIT: Protect = hint-only re-save, NOT real encryption — use `qpdf` for real passwords [A-local] | Redact-Burn = raster burn to image-only copy (true pixel burn, text layer discarded; verify copy) [A-local] | Local overlay sign only (draw/type); NO PKI, audit trail, or multi-party request flow |

[A-local] = `LIMITS.md`, `PRIVACY.md` in this repo (primary source for local column).

## 2. Top 8 complaints = opportunities

1. Daily/task paywalls hit mid-job (Smallpdf ~2/day; iLovePDF per-tool caps) → Opportunity: no-countdown batch meter + honest technical caps only. [C: G2/SWAdvice 2026; B: Smallpdf help "2 conversions/day"]
2. "Free" then account/billing wall to download or remove password (Adobe protect-removal paywalled; Smallpdf download limit) → Opportunity: instant download, no account. [B: Adobe FAQ; A: Smallpdf pricing table]
3. Price shock / subscription fatigue (Adobe $239.88/yr Pro; Xodo Suite $179.88/yr; Smallpdf $108/yr) → Opportunity: $0 local for the 80% jobs. [A: Adobe/Xodo/Smallpdf pricing pages, June–Aug 2026]
4. Upload-anxiety for sensitive docs (bank, legal, health) despite 1–24h deletion promises → Opportunity: zero-upload proof (guard + airplane-mode test). [A/B: Smallpdf 1h, iLovePDF 2h, CloudConvert 24h, Adobe cloud-save, Xodo tool-privacy pages]
5. Credit/minute metering confusion (CloudConvert base 1–4 credits + per-minute; subs don't roll over) → Opportunity: flat predictable "file-size cap scales" story. [A: CloudConvert pricing/FAQ]
6. E-sign limits & split products (Smallpdf Sign.com 2/mo; Xodo Sign separate $10–16/mo; Adobe request-signatures paid) → Opportunity: don't claim parity — position local sign as single-signer overlay only. [A: Smallpdf/Xodo-Sign/Adobe pages]
7. Layout breakage on convert/OCR (reviews: Excel/PPT round-trips, 5 MB anecdotes, 50 MB AI-tool confusion) → Opportunity: publish per-tool limits in-workspace + "check output" copy. [C: Trustpilot/G2 2026; A: Smallpdf "AI-tool 50 MB ≠ converter limit"]
8. Performance + bloat/AI clutter (Adobe slow large files, intrusive AI; Xodo crash anecdotes; mobile caps) → Opportunity: offline-first, lazy-load, mobile caps table (50 MB single / 150 MB batch). [C: ChromeStats/Capterra 2026; A-local: `LIMITS.md`]

## 3. Sources (all accessed Sept 2026)

- https://smallpdf.com/pricing — plans, daily download limit, Sign.com 2/mo, AI 50 MB row (Sept 2026)
- https://smallpdf.com/blog/smallpdf-free-vs-pro-plan-comparison (2026-08-03) — free vs pro
- https://smallpdf.com/delete-pages-from-pdf — 1h deletion, TLS 256-bit, ISO 27001
- https://smallpdf.com/support — "2 conversions per day"
- https://www.ilovepdf.com/pricing — Premium $9/$5, caps table (100 MB merge, 200 MB compress, 15 MB Office)
- https://www.ilovepdf.com/help/security + /help/legal + /blog/pdf-compliance-gdpr-ilovepdf (2026-02-13) — 2h deletion, HTTPS, ISO 27001, 5y signed-doc retention
- https://www.adobe.com/acrobat/pricing.html + /pricing/business.html — $14.99/$19.99/$24.99, teams pricing (2026)
- https://www.adobe.com/acrobat/online/compress-pdf.html — 2 GB compress claim
- https://helpx.adobe.com/document-cloud/faq/try-acrobat-online-services.html (2025-06-02) — free limits notice, AES-256/TLS 1.2, delete-if-not-signed-in
- https://cloudconvert.com/pricing — 10 credits/day free, $18 package, $10/mo sub
- https://cloudconvert.com/privacy + /security + /docs/api-reference/jobs — ≤24h deletion, ISO 27001
- https://xodo.com/pricing (2026-08-21) + https://xodo.com/blog/xodo-plans-explained + https://xodo.com/tool-privacy — 1/day free, $7.99/$9.99/$14.99 tiers, browser-only vs 1h server
- https://eversign.com/pricing + /blog/eversign-plans-explained (2026-03-18) + Apryse support (2026-04-15) — Xodo Sign 3 docs free, $10/$16, SOC 2, HIPAA Aug 2026
- https://xodo.com/blog/adobe-acrobat-pricing-explained (2026-06-05) — Adobe cross-check
- https://www.trustpilot.com/review/smallpdf.com + /review/ilovepdf.com (Aug 2026) ; G2/SoftwareAdvice/Capterra/ChromeStats 2025–2026 — complaint mining
- Local: `LIMITS.md`, `PRIVACY.md` (this repo, Sept 2026)

## 4. What to avoid

- Clones: do NOT cite `smallpdf.us`, `smallpdf.app`, `ilovepdf4.com`, `ilovepdf2.com`, `ilovepdf.org`, `ilovepdf.io` as official — lookalike/affiliate or regional mirrors with divergent "$0 today" / "100% free" copy. Only `smallpdf.com` and `ilovepdf.com` are canonical.
- Region pricing: Smallpdf/Adobe/Xodo render by geo + promos (US $ vs €, annual-vs-monthly, 40%-for-life to Dec 2026). Never hardcode a single "$X" in-tool; say "≈$X/mo US list, Sept 2026 — check your checkout".
- E-sign parity: do NOT claim local sign equals DocuSign/Adobe Sign/Xodo Sign. No audit trail, no multi-party routing, no LTV/SMS auth, no HIPAA/SOC 2 envelope. Keep "single-signer overlay" positioning; link out for regulated signing.
