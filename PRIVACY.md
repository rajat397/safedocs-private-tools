<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 | Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com -->
# Privacy — zero-upload proof

**Claim:** your files never leave your device. The toolbox is a static site
(no backend) and every tool runs locally in the browser.

## Architecture

1. **Static hosting only.** `python3 -m http.server` serves files; there is no
   server endpoint that could receive uploads.
2. **ES modules, no framework.** Shell (`index.html`, `styles.css`, `app.js`,
   `core/*`) plus lazily `import()`ed tool modules under `tools/`.
3. **Runtime upload guard.** `core/privacy.js:installUploadGuard` patches
    `fetch` (including `Request`-object bodies), `XMLHttpRequest.send`,
    `navigator.sendBeacon`, `HTMLFormElement.submit` (+ `submit` events), and
    `WebSocket.send` at boot (`app.js`) and **throws** if any code tries to
    POST/PUT/PATCH/DELETE `Blob`/`File`, `FormData`-with-files,
    `ArrayBuffer`/TypedArray/`DataView` bytes, or any non-empty string body.
    Same-origin GETs (tool chunks, data) keep working for lazy-load + offline.
4. **Content Security Policy.** `index.html` ships a CSP `<meta>` tag:
    `default-src 'self'` with `script-src`/`connect-src` allow-listed to the
    pinned library CDNs (`esm.sh`, `cdn.jsdelivr.net`, `unpkg.com`) plus
    `blob:`/`data:` for local object URLs, `object-src 'none'`, and
    `form-action 'self'`. The CSP is defense-in-depth behind the runtime
    guard above — it cannot be bypassed from page JS.
4. **Offline-first.** `sw.js` precaches the shell; airplane mode keeps working
   — which is only possible because nothing needs a server.

## How to verify (do it yourself)

```bash
# 1. No upload-capable code in the shell or tools
rg -n "fetch\(|XMLHttpRequest|sendBeacon|navigator\.sendBeacon" .
# expected: only core/privacy.js (the guard itself) + sw.js GET caching

rg -n "method:\s*['\"]POST['\"]|method:\s*['\"]PUT['\"]" .
# expected: no matches

# 2. Serve + inspect network tab
python3 -m http.server 8000
# open http://localhost:8000, DevTools → Network → drop a file into any tool.
# expected: zero POST/PUT requests; only GETs for .js/.css (or nothing cached).

# 3. Airplane-mode test
# load once → enable OS airplane mode / offline in DevTools → reload + use tools.
# expected: shell + cached tools work; no failed uploads because none are attempted.
```

## Exceptions (non-file network)

- **Pinned CDN library GETs (allowed).** Heavy libs are never checked in;
  `tools/ocr|video|sign|zip` lazy-load version-pinned builds via GET from
  `esm.sh`, `cdn.jsdelivr.net`, `unpkg.com` (pins in `vendor/cdn-pins.js`,
  allow-listed in the CSP + service worker). These requests carry **no file
  bytes** — library JS / traineddata only, fetched before any file is read.
  First use of those tools needs network; afterwards the service worker
  serves them from cache.
- **Offline limit.** The app shell + same-origin tool modules work fully
  offline once cached. CDN-backed tools (OCR, video, sign, zip) require one
  online load so the pinned library can be cached; offline before that first
  load, those tools show their loader error instead of working.
- Tool modules MUST NOT add analytics, tracking pixels, or font loads.
  `vendor/*` holds only the pin manifest (`cdn-pins.js`) for this reason.

## Recents (tool ids only)

"Recently used" remembers **tool ids + timestamps only** —
`core/recents.js` stores `[{ id, ts }]` (max 8) under
`localStorage` key `safedocs:recents`. It never stores filenames, file
bytes, previews, or other PII; entries are projected to `{ id, ts }` on
read so stale/foreign shapes can't leak anything. All storage access is
try/catch, so private-mode denials are non-fatal no-ops. The home grid
maps ids back to known tools via the registry and drops unknown ids.

## Honesty notes (what tools do NOT promise)

- **Protect PDF is a basic deterrent, not encryption.** `pdf-lib` cannot
  do real password encryption client-side, so `tools/pdf/protect.js`
  re-saves a hint-only copy (protection hint in metadata, e.g.
  `toolbox-protect(hint-only, not encrypted)`), clears both password
  fields immediately, and warns in-tool: anyone can still open the file
  without a password. For real password protection use a desktop step
  (e.g. `qpdf`).
- **Redact-Burn pixels are burned, not overlaid.** `tools/pdf/redact-burn.js`
  rasterizes each page, `fillRect`s your boxes to opaque black pixels,
  and rebuilds an **image-only copy** (`-redacted.pdf`) — the original
  text layer is discarded, no vector/text survives underneath. Always
  open the COPY and visually confirm every box before sharing.

## Reporting

If you ever see a POST with file bytes in DevTools while using the toolbox,
that's a bug — file an issue with the tool id and repro steps.
