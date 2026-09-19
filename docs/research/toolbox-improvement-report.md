# Toolbox Improvement Report — How We Beat Premium Tools (Plain Language)

**Goal:** be the tool people trust more than Smallpdf / iLovePDF / Adobe — not by claiming more, but by proving more.

**How to read this:** every claim has a file address (like `core/privacy.js:60`). Don't take our word for it — click, check, and try the "prove it yourself" steps. That's the whole strategy: **verify, don't trust.**

**What premium tools charge and cost you (why this matters):**
- Smallpdf ~$9/mo, iLovePDF ~$5–7/mo, Adobe Acrobat online ~$19.99/mo (prices change — check their sites; listed here as order-of-magnitude context, not a quote).
- Hidden costs users complain about: forced uploads, file retention (examples seen in the wild: ~1hr auto-delete claims vs. 2hr vs. persistent account history), paywalls mid-task, ads/trackers, hard-to-cancel trials.
- Our answer: free, no account, no upload. If we ever add a cost or account, this report must be rewritten — no silent changes.

---

## 1. Trust Gaps — What Still Makes a Careful Person Nervous

DECISION: Fix visibility of existing privacy guarantees first (proof line, badges, verify button) — no new privacy mechanisms in scope.

Plain language: "You say private — why should I believe you?"

What we already do well (traceable):
- Runtime upload guard blocks file bytes from leaving in `core/privacy.js:60` (`installUploadGuard`). It patches `fetch` + `Request` bodies (`core/privacy.js:66`), `XHR` (`core/privacy.js:84`), `sendBeacon` (`core/privacy.js:100`), form submits (`core/privacy.js:110`), `WebSocket.send` (`core/privacy.js:135`). Installed at boot in `app.js:7`.
- Backup wall: CSP in `index.html:11` — `default-src 'self'`, `connect-src` allow-listed to pinned CDNs only, `object-src 'none'`, `form-action 'self'`.
- Static-only hosting: no backend endpoint to receive files (`PRIVACY.md:9`, `app.js:1-18`, `sw.js:52-72` only caches GETs).
- Honest limits today: Protect is hint-only, Redact-Burn needs visual check (see §5).

Gaps to fix (ranked):
1. **Guard is invisible.** A nervous user never sees it. Fix: surface a "Proof" line in-tool ("guard on — try airplane mode") linking to `PRIVACY.md:29-47`.
2. **CDN exception is easy to miss.** First use of OCR / video / sign / zip needs network for pinned libs (`PRIVACY.md:51-60`, pins in `vendor/cdn-pins.js:8-62`). Users hear "offline" and feel lied to when it fails offline. Fix: per-tool "needs 1 online load" badge (see §2).
3. **No one-click verify.** The `rg` + Network-tab steps exist (`PRIVACY.md:31-46`) but require DevTools. Fix: add a "Verify" footer button that runs `auditForUploads` (`core/privacy.js:153`) on the loaded shell and shows pass/fail in plain words.

> Verify, don't trust: open DevTools → Network → drop a file in any tool. You should see zero POST/PUT. Only GETs for `.js/.css`, or nothing at all when cached.

---

## 2. First-Run Proof — What a New Person Sees in 60 Seconds

DECISION: Make airplane-mode demo and Offline-ready vs Needs-1-online-load badges required on first run — never promise offline for OCR/video/sign/zip on first load.

Plain language: "Show me it's private before I risk my file."

What works now:
- Header says "100% on-device" + sub "No uploads. Works in airplane mode." (`index.html:21-23`), onboarding 3-step card (`index.html:32-42`), footer honesty line (`index.html:49`).
- Offline shell precached (`sw.js:8-23`); version stamp `v4·34 tools` (`app.js:9-13`).

What to improve (ranked):
1. **Make airplane mode the demo.** Onboarding step 2 should say: "Try it: load once, turn on airplane mode, drop a file — it still works." Shell tools do (`sw.js:8-23`); CDN-gated tools (OCR, video, sign, zip) must say upfront "needs 1 online load first, then cached" (`PRIVACY.md:58-61`). Never promise what those 4 tools can't do offline on first run.
2. **Label the two kinds of tools.** Badge A: "Offline-ready" (same-origin only). Badge B: "Needs 1 online load (pinned library, no file bytes sent)". Source of truth: `vendor/cdn-pins.js:8-62` + CSP allow-list `index.html:11` + SW gate `sw.js:39`.
3. **Show limits before rejection.** Caps are generous but invisible until hit: desktop 200 MB single / 500 MB batch / 50 files; mobile 50 MB / 150 MB / 20 files (`LIMITS.md:11-20`, enforced `core/caps.js:checkFiles` via `core/dropzone.js`). Overrides: `video-gif` 100/150 mobile, `ocr` 25/100 mobile, `pdf-redact-burn` 25/100 mobile + page/raster guards (`LIMITS.md:22-43`, `tools/pdf/redact-burn.js:280-300`). Fix: show "Fits: up to X MB on this device" on the dropzone before the user picks.

> Verify, don't trust: load once → DevTools → Application → Service Workers → Offline → reload. Shell tools work. OCR/video/sign/zip show their loader error until cached — that's expected, not a bug (`PRIVACY.md:60-61`).

---

## 3. Three Jobs That Force an Upload Elsewhere (Our Wedge)

DECISION: Prioritize redact-burn, big-file handling, and OCR/sign wedge jobs — win high-stakes no-upload moments before breadth improvements.

Plain language: "These are the moments people give up and upload to a premium site. Win here."

**Job 1 — "Black out text for real before I share."**
- Elsewhere: upload a sensitive PDF to remove sensitive text — the worst time to upload.
- Here: `tools/pdf/redact-burn.js:3` rasterizes each page, `fillRect`s boxes to opaque black (`tools/pdf/redact-burn.js:310-317`), rebuilds an image-only `-redacted.pdf` with the text layer discarded (`tools/pdf/redact-burn.js:332-342`). Verifies header + page count before download (`tools/pdf/redact-burn.js:334-337`). Must still visually confirm the COPY (`tools/pdf/redact-burn.js:342`, `PRIVACY.md:84-88`).
- Improvement: after burn, force a "Open the COPY and check every box" checklist before the success state clears. Never auto-claim "fully redacted."

**Job 2 — "Join / shrink / extract a big file on my phone without it crashing."**
- Elsewhere: upload a 300 MB deck because the free tool crashes.
- Here: caps keep it crash-free (`LIMITS.md:9-20`); over-limit files rejected individually with reasons, rest still loads (`LIMITS.md:70-74`); batch meter is read-only feedback (`LIMITS.md:55-62`). Raster tools add page/pixel guards (`tools/pdf/redact-burn.js:280-300`).
- Improvement: pre-flight estimator ("This will use ~X of your 150 MB mobile budget") + chunked progress (`.progress` in `styles.css` per `LIMITS.md:73-74`).

**Job 3 — "Read text from a photo / sign a form without creating an account."**
- Elsewhere: signup + upload + retention risk.
- Here: on-device OCR / sign / zip via pinned CDN libs, no file bytes sent (`vendor/cdn-pins.js:8-62`, `PRIVACY.md:51-57`). Recents store tool ids only, never filenames/bytes (`PRIVACY.md:65-73`, `core/recents.js`).
- Improvement: state on the tool page itself: "No account. Files stay here. Library loads once from [pinned URL], then cached." Link the exact pin.

> Verify, don't trust: for any of these 3 jobs, watch Network during the run — no POST with file bytes. If you ever see one, that's a bug: file an issue with tool id + steps (`PRIVACY.md:91-93`).

---

## 4. Findability — Can People Find the Right Tool With Their Own Words?

DECISION: Fix Protect vs Unlock disambiguation and surface honesty suffixes in results first — add job-phrase synonyms only with tests.

Plain language: "I don't know it's called 'pagenum' — I type 'add page numbers'."

What works now:
- Synonym + fuzzy search over id/name/desc/cat + keywords (`core/search.js:242-259`, scoring `core/search.js:210-233`, fuzzy 1–2 typos `core/search.js:191-201`).
- Friendly aliases already covered: `join/merge/combine` (`core/search.js:46-50`), `black out/blackout/burn → redact` (`core/search.js:29-32`), `shrink to 1mb/1mb → compress` (`core/search.js:42-45`), `remove password/open locked → unlock` (`core/search.js:33-36`), `jpg to pdf / pdf to jpg` (`core/search.js:67-75`), typo-tolerant prefix match (`core/search.js:196`).
- Never a dead end: no-match returns suggestions, then popular fallbacks (`core/search.js:261-291`, `POPULAR_IDS` at `core/search.js:140`).
- Search box with plain placeholder (`index.html:20`: "Try join pdfs, black out text…").

Gaps to fix (ranked):
1. **Protect vs. Unlock confusion.** `password/lock/encrypt → protect` (`core/search.js:62-66`) and `remove password → unlock` (`core/search.js:36`) both fire on "password." A user typing "remove password" must land on Unlock, not Protect (which does NOT encrypt). Fix: add a disambiguation line on Protect results ("This does NOT lock — see Unlock / real encryption note").
2. **Missing job phrases.** Add: "make pdf smaller for email" → compress/target-size; "delete pages" → add-remove-pages; "blank out address" → redact-burn; "read handwriting/photo" → ocr. Each addition needs a test in the search spec — no untested synonyms.
3. **Surface the honesty line in results.** Protect hits should carry "(hint-only, not encryption)" and Redact hits "(image-only copy — verify)" inline, sourced from `tools/pdf/protect.js:23` and `tools/pdf/redact-burn.js:342`, so the right expectation arrives before the click.

---

## 5. Language Honesty — Never Promise What We Don't Do

DECISION: Keep hint-only Protect, verify-the-COPY Redact, and asterisked offline claims as non-negotiable language rules — ban absolute security phrases everywhere.

Plain language: "Tell me the truth even when it makes us look weaker. That's why I'll trust you."

Rules we follow (with sources):
- **Protect is NOT encryption.** `tools/pdf/protect.js:3-6` says "honest hint-only copy. NOT encryption." It re-saves, writes `toolbox-protect(hint-only, not encrypted)` metadata (`tools/pdf/protect.js:94`), clears password fields immediately (`tools/pdf/protect.js:99-101`, `104`), warns in-tool (`tools/pdf/protect.js:23`) and in footer (`index.html:49`) and docs (`PRIVACY.md:77-83`). For real protection, use `qpdf` or similar desktop step. Never say "password-protect" without "hint-only."
- **Redact-Burn needs eyes.** Pixels are burned opaque and the text layer is discarded (`tools/pdf/redact-burn.js:310-321`), output verified as new header + page count (`tools/pdf/redact-burn.js:334-337`) — but you must open the COPY and confirm every box before sharing (`tools/pdf/redact-burn.js:342`, `PRIVACY.md:82-88`). Never say "guaranteed redacted."
- **Offline has one asterisk.** Shell + same-origin tools work offline once cached (`sw.js:8-23`). CDN tools (ocr, video, sign, zip) need one online load for the pinned lib first (`PRIVACY.md:58-61`, `vendor/cdn-pins.js`). Never say "fully offline" without that asterisk on those 4 tools.
- **Limits are real.** State the cap that applies on the user's device (desktop vs. mobile per `LIMITS.md:11-20`) before they invest time. Never blame the file when we reject it — give the reason + what fits.

Banned phrases (do not use anywhere): "military-grade," "100% secure," "encrypted upload," "we delete after 1 hour" (we never receive it at all — nothing to delete), "unlimited free."

---

## Ranked Backlog (Do This Order to Beat Premium)

| # | Fix | Why it wins | Source / verify |
|---|-----|-------------|-----------------|
| 1 | In-tool "guard on + airplane test" proof line | Turns invisible privacy into something felt in 10s | `core/privacy.js:60`, `app.js:7`, `PRIVACY.md:29-47` |
| 2 | Offline badge A/B per tool (1-online-load warning on ocr/video/sign/zip) | Kills the #1 "you lied about offline" complaint | `vendor/cdn-pins.js`, `sw.js:39`, `PRIVACY.md:58-61` |
| 3 | Redact-Burn forced COPY-check checklist | Wins the highest-stakes job safely | `tools/pdf/redact-burn.js:334-342` |
| 4 | Dropzone pre-flight cap line ("up to X MB on this device") | Stops phone crashes + resentment | `LIMITS.md:11-43` |
| 5 | Search disambiguation: Protect (hint-only) vs Unlock | Prevents dangerous misunderstanding | `core/search.js:62-66`, `tools/pdf/protect.js:23` |
| 6 | One-click shell self-audit button (`auditForUploads`) | Lowers verify cost from DevTools to one tap | `core/privacy.js:153-166` |
| 7 | Result-line honesty suffixes ("hint-only", "verify copy") | Right expectation before click | `index.html:49`, `tools/pdf/protect.js:94` |
| 8 | Add missing job synonyms + tests | Captures "my words" searches premium tools miss | `core/search.js:18-114` |

**Done means:** each item ships with its trace (file:line), its verify step (what the user can check), and its honest limit stated in plain words. No claim without a check.
