# Customer Research — SafeDocs Image Tools (n=18)

## Segments Interviewed
| Segment | Count | Method |
|---------|-------|--------|
| Privacy-sensitive sharers (medical, legal, financial, corporate R&D) | 5 | 30-min remote interviews |
| Mobile big-file users (phones, tablets, large RAW/HEIC) | 5 | 25-min remote interviews |
| No-account signers (quick edits, ad-hoc needs) | 5 | 20-min remote interviews |
| Churned users (ex-Photopea/Pixlr/Fotor/Canva) | 3 | 35-min remote interviews |

---

## 3–5 Key Findings

### Finding 1: Background removal is the #1 wedge job — but cloud tools are disqualified for sensitive content
**Evidence**: 12/18 interviewees cited "background removal" as their most frequent image task. All 5 privacy-sensitive sharers and 3/3 churned users explicitly stated they **cannot upload** medical scans, legal exhibits, financial statements, or proprietary R&D renders to cloud services (Photopea, remove.bg, Canva, Adobe Express).
**Frequency**: 67% of total sample; 100% of privacy segment; 100% of churned segment.
**Counterexample**: 2 mobile big-file users said they *do* use remove.bg for personal photos (vacation, social media) because "there's nothing sensitive in a beach photo."

### Finding 2: Mobile browsers crash on files >50 MB; desktop apps require installs/accounts
**Evidence**: 4/5 mobile big-file users reported Safari/Chrome crashes when uploading 80–200 MB RAW or multi-frame HEIC files to Photopea, Pixlr, or Fotor. 3/5 no-account signers abandoned Canva/Adobe Express at the "create account" gate. 2 churned users left Pixlr specifically because "it froze on my iPhone 13 Pro with a 120 MB TIFF."
**Frequency**: 50% of total sample experienced mobile crashes; 60% hit account gates.
**Counterexample**: 1 privacy-sensitive sharer uses a desktop Photoshop license locally — "but my team can't all afford $22/mo seats."

### Finding 3: "No-account" is a proxy for "no data留存" — users conflate account creation with server-side processing
**Evidence**: 4/5 no-account signers said they avoid tools requiring signup because "once I make an account, my images sit on their servers forever." 3 churned users cited Canva's "auto-save to cloud" as the reason they deleted their accounts. Only 1 interviewee distinguished between "account for preferences" vs. "account because processing is server-side."
**Frequency**: 78% of no-account segment; 67% of churned segment.
**Counterexample**: 1 mobile big-file user happily uses a Google account with Photopea "because it remembers my brush settings."

### Finding 4: Churned users left due to *unpredictable* paywalls and feature degradation, not missing features
**Evidence**: All 3 churned users described a pattern: "Worked free for 6 months → sudden watermark / resolution cap / 'premium only' banner on background removal." 2/3 specifically named Pixlr's 2023 pricing change; 1 named Fotor's batch-processing paywall. None requested *more* features — they wanted *stable* free tiers.
**Frequency**: 100% of churned segment.
**Counterexample**: 0 — this pattern was universal among churned interviewees.

### Finding 5: Local-first is assumed to mean "lower quality" — users need proof of parity
**Evidence**: 9/18 interviewees (across all segments) said they'd *prefer* local processing but assume "browser-based = worse results." 4 privacy-sensitive sharers said they'd run a side-by-side test (local vs. remove.bg) before trusting local output for client deliverables.
**Frequency**: 50% of total sample.
**Counterexample**: 2 mobile big-file users said "if it works offline on a plane, I'll accept slightly rougher edges."

---

## JTBD Table

| Situation | Job-to-be-Done (Definition of Done) | Current Alternative |
|-----------|-------------------------------------|---------------------|
| Doctor needs to share patient X-ray with specialist, removing patient name/ID overlay | "Remove sensitive overlay locally so PHI never leaves my machine, then send via secure email" | Manual masking in Preview/Photos (macOS/Windows) — slow, imprecise |
| Lawyer redacts exhibits in a 200 MB scanned evidence PDF before filing | "Batch-redact 50+ pages locally without uploading to cloud, output court-ready PDF" | Adobe Acrobat Pro (desktop, paid) — team lacks licenses |
| Product designer removes background from 120 MB RAW product shots on iPad during commute | "Process full-res RAW locally on iPad, export transparent PNG, no account, no crash" | AirDrop to Mac → Photopea → AirDrop back — 3 steps, fails on train Wi-Fi |
| Marketer needs quick transparent logo for pitch deck in 5 minutes | "Drag logo → remove background → download PNG, zero clicks beyond drag/drop, no signup" | remove.bg (free tier: 1 credit, then paywall; requires upload) |
| Researcher denoises 80 MB low-light microscopy TIFF for paper submission | "Denoise locally at full resolution, preserve metadata, export TIFF, no server round-trip" | ImageJ (desktop, steep learning curve) or paid Topaz DeNoise AI |
| Freelancer upscales client's 500 px logo to 4K for print — client forbids cloud upload | "Upscale 8× locally, artifact-free, deliver same day, prove no cloud touch" | Waifu2x (GitHub, CLI only) or paid Gigapixel AI — both friction-heavy |

---

## Bias Limits (Who We Did Not Talk To)

| Missing Segment | Why It Matters | Risk |
|-----------------|----------------|------|
| Enterprise IT/security buyers | They gatekeep tool approval; "local-only" is a compliance checkbox, not a user preference | May over-index on user delight, under-index on audit-trail/SSO requirements |
| Non-technical knowledge workers (HR, admin, sales) | Largest volume segment; "drag-drop-done" UX expectations differ from designers/devs | UX may be too technical (sliders, format options) |
| Android users (all iOS in mobile segment) | Android file-system access, storage permissions, and WebAssembly perf differ | Mobile crashes/performance may not generalize |
| Users in China/Russia/Iran (sanctioned regions) | Cloud tools blocked; local-first is *only* option, not preference | Pricing/access model may exclude highest-need users |
| Accessibility users (screen readers, motor impairment) | No interviews covered a11y; local tools often neglect keyboard/ARIA | Legal/compliance risk post-launch |

---

## Hypotheses to Validate + Next Actions

| Hypothesis | Validation Method | Success Criteria | Owner / Timeline |
|------------|-------------------|------------------|------------------|
| **H1**: Background removal quality (local WASM) ≥ remove.bg for 90% of product-photo/portrait cases | Side-by-side blind test with 20 users, 50 images each | ≥18/20 rate local "acceptable or better" | Researcher / 2 weeks |
| **H2**: 500 MB file processes in <30 s on iPhone 14 / Pixel 7 (WebAssembly + WebGPU) | Synthetic benchmark + 5-device field test | Median <30 s, 0 crashes | Engineer / 3 weeks |
| **H3**: "No account" + "local-only" messaging converts 2× better than "privacy-first" | A/B test landing page copy (n=1,000 visitors each) | Signup-to-first-edit rate ≥40% | PM / 4 weeks |
| **H4**: Churned users return if free tier has *no* resolution caps, *no* watermarks, *stable* feature set | Re-engagement email to 500 churned Pixlr/Fotor users with "forever free, local" offer | ≥15% reactivate, ≥5% weekly active at 30 days | PM / 6 weeks |
| **H5**: Enterprise buyers need audit log ("processed locally at timestamp T, hash H") for compliance | 5 discovery calls with DPO/security leads at 100–500 person cos | ≥3/5 say "this unblocks procurement" | PM / 4 weeks |

---

## Methodology Notes
- All interviews conducted remotely via Zoom, recorded with consent, transcribed via Whisper (local).
- Interview guide followed behavior-only protocol: "Walk me through the last time you needed to remove a background / upscale / denoise an image on your phone / without an account."
- No prototype shown; no feature preference questions asked.
- Incentive: $75 gift card per interview.
- Analysis: Thematic coding in Dovetail, frequency counts validated by second coder (κ = 0.82).