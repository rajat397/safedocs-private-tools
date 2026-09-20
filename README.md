<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->
# SafeDocs – Private File Tools

100% on-device PDF/image/PII tools, zero upload.

## Features (38 tools, 10 categories)

- PDF (17): Merge PDFs (try `join pdfs`), Split, Compress, Images → PDF,
  PDF → Images, Protect, Watermark, Page numbers, Flatten, Reorder, Sign,
  + 6 new (pdf-lib only, on-device): Edit metadata, Split by size,
  Crop PDF, Extract images, Remove annotations, N-up PDF
- Organize (3): Rotate PDF, Add / Remove pages, Extract pages
- Compress (2): PDF to target size, Grayscale PDF
- Convert (2): Text → PDF, PDF → Text
- Security (2): Unlock / View PDF, Redact & burn
- Image (7): Convert, EXIF inspector, Compress images, **Remove background (AI)**,
  **Upscale (AI 2×/4×)**, **Colorize (AI)**, **Vectorize (SVG)**
- Privacy (2): Scrub metadata, Mask PII
- Scan / Media / Files: OCR on-device (EN + HI), Video → GIF, ZIP files
- Search: forgiving synonyms + fuzzy match (`join` → Merge, `black out`
  → Redact, `decrypt` → Unlock, `shrink to 1MB` → Compress); no-match
  shows closest suggestions, never a dead end
- Recents: last 8 tools, tool ids + timestamps only — never filenames
  or file bytes; private-mode failures are silent no-ops
- Batch meter: read-only `N files · X MB of Y MB total` feedback from
  `core/caps.js:batchMeter`; never changes accept/reject
- Onboarding: one-time `Private by design` tour (`Got it` dismiss,
  `safedocs:onboarded` flag); static 3-step card in `index.html` shell

## Honesty notes (read before sharing)

- Protect PDF is a basic deterrent, NOT encryption: it re-saves a
  hint-only copy with a metadata label, clears the password field, and
  warns in-tool. Anyone can still open the file. For real password
  protection use qpdf / desktop tooling.
- Redact & burn pixels are burned into a new image-only copy (original
  text layer discarded). Open the COPY and visually confirm every box
  before sharing.
- Edit metadata touches the info dictionary only (Title/Author/Subject/
  Keywords/Creator/Producer); blank fields keep existing values. XMP
  streams and embedded-file metadata are NOT touched.
- Split by size packs pages greedily so each part stays under the target;
  shared PDF objects mean parts can vary slightly. A single page bigger
  than the target is emitted solo with a warning — pages are never
  rasterized or cut.
- Crop PDF is a vector CropBox hide, NOT a delete: content stays in the
  file and the crop is reversible (reset option). Some viewers print the
  full MediaBox regardless of CropBox.
- Extract images saves embedded JPEG (DCTDecode) / JPEG-2000 (JPXDecode)
  byte-for-byte with no re-encode; other encodings (raw/Flate, masked,
  CCITT fax, JBIG2) are listed as skipped — use PDF → Images raster
  export for those. First 100 images download per run (re-run on page
  ranges for the rest); browsers may prompt for multiple downloads.
- Remove annotations strips the annotation layer only (comments, links,
  markup, widgets); page text/content is untouched. NOT a redaction tool:
  already-flattened markup stays, and info-dict / XMP metadata is unchanged.
- N-up is vector imposition (text stays sharp); each sheet keeps the first
  selected page's size. Interactive annotations / form fields on imposed
  pages may not carry over — flatten first if fidelity matters.

## Downloads (P0 fix, central)

- All saves go through the central `core/utils.js:download()` helper
  (`ctx.download` in tools): one object URL per file, anchor-click
  download, `URL.revokeObjectURL` scheduled after 10s.
- `scrub` no longer mints its own `createObjectURL`: the stray per-tool
  URL path was removed and scrub now calls `ctx.download` like every
  other tool. No per-tool URL tracking drift.
- E2E `tests/e2e/download-matrix.spec.js` covers Blob / Uint8Array /
  ArrayBuffer / string inputs + unsupported-input rejection and asserts
  every created URL is revoked.

## Tool UI contract (7-step shell)

- Every tool mounts the shared shell in `tools/_lib/page.js:shell(el, tool, ctx)`
  — zero per-tool boilerplate drift. Contract:
  1. `shell(el, tool, ctx)` builds the root shell into `el`.
  2. `status(msg)` is the single aria-live status writer.
  3. `wireCaps()` renders the caps kv from `ctx.activeCaps(tool.id)`.
  4. `runBtn(label, fn)` wires the run button (disabled until files).
  5. Dropzone via `ctx.createDropzone` — files stay on-device; `onFiles` hook.
  6. Caps kv + meter — `<dl class="kv">` + `.meter` batch usage bar.
  7. Options form slot + run + `.progress` + output + cleanup revokes.
- Shell owns all object-URL revocation on clear/cleanup; tools must save
  via `ctx.download` (fallback: `page.addDownload`).

## E2E harness

- Run: `npm test` (or `npx playwright test`, `--project=chromium` for one
  browser). Static shell served locally via `python3 -m http.server`
  (`playwright.config.js`, 3 projects: chromium / firefox / webkit).
- Suites: `smoke.spec.js` (34 tools × 3 asserts: heading, file entry,
  on-device notice; home grid = 34 cards), `deep.spec.js` (25 PDF tools ×
  7 corpus files, attach-only, shell stays alive), `download-matrix.spec.js`
  (P0 download + revoke), `caps-mobile.spec.js` (mobile profile + meter),
  `cdn-block.spec.js` (pinned CDNs blocked, graceful degrade). Every test
  installs the zero-upload guard (`fixtures.js`).
- Corpus: regenerate locally with `scripts/make-corpus.sh` (needs `qpdf`
  + `reportlab`/`Pillow`; every PDF passes through qpdf). Outputs
  `tests/e2e/corpus/{small-1p,medium-20p,large-168p,encrypted,corrupt,
  image-scan,form}.pdf` (password for `encrypted.pdf` is `test123`).
- No binaries committed: `tests/e2e/corpus/*.pdf` is gitignored — CI /
  reviewers regenerate via the script; only the builder script is tracked.

## Stale cache? Hard-refresh note

- If the toolbox shows 28 tools instead of 34, you are seeing a stale
  cached shell: hard-refresh with `Ctrl+Shift+R`, then check in an
  incognito window.
- Still stale? Open DevTools → Application → Service Workers →
  Unregister the SW, then reload.
- Healthy footer must read `v4·38`.

- Zero upload: files never leave your device; all processing runs locally
- No servers, no analytics uploads, no tracking of file contents
- Third-party libraries load from pinned CDNs on first use, then cache;
  file data itself is never sent anywhere
- Verify: run with network logging, use airplane mode after first load,
  and confirm tools keep working; see PRIVACY.md

## Limits

- Large files are limited by device memory and browser storage
  (desktop: 200 MB/file · 500 MB batch · 50 files; mobile: 50 MB/file ·
  150 MB batch · 20 files; video: 300/100 MB; image dim: 12000/8000px)
- 8 of 9 MVP-3 tools inherit base caps; `pdf-redact-burn` tightens mobile
  to 25 MB single / 100 MB total + page-count guard (100 desktop /
  25 mobile) + 16 MP raster cap inside the tool
- 6 P3A tools (metadata-edit, split-by-size, crop, extract-images,
  remove-annotations, n-up) inherit base caps (no `TOOL_CAPS` entry:
  vector-only pdf-lib ops); each enforces a 500-page tool-level guard,
  and `pdf-extract-images` additionally caps downloads at the first 100
  images per run (re-run on page ranges for the rest)
- OCR accuracy depends on image quality; Hindi + English packs download once (~16MB cached)
- Video fallback (~25MB) loads only with explicit consent, never automatically
- See LIMITS.md and vendor/cdn-pins.js for pinned versions and sizes

## License

This project is source-available under the PolyForm Noncommercial License 1.0.0.

- Noncommercial use only under PolyForm Noncommercial 1.0.0
- Commercial use requires a separate commercial license
- License text: LICENSE
- Required notice: NOTICE
- Commercial licensing: COMMERCIAL-LICENSE.md

Copyright (c) 2026 Rajat Srivastava <rajat242003@gmail.com>

## Third-party components

Runtime dependencies (pdf-lib, jszip, gifenc, tesseract.js, @ffmpeg/ffmpeg, pdf.js)
are loaded from pinned CDNs and carry their own licenses.
See THIRD-PARTY-NOTICES.md and vendor/cdn-pins.js.
