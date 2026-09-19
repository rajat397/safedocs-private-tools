<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->
# SafeDocs – Private File Tools

100% on-device PDF/image/PII tools, zero upload.

## Features (28 tools, 10 categories)

- PDF (11): Merge PDFs (try `join pdfs`), Split, Compress, Images → PDF,
  PDF → Images, Protect, Watermark, Page numbers, Flatten, Reorder, Sign
- Organize (3, new): Rotate PDF, Add / Remove pages, Extract pages
- Compress (2, new): PDF to target size, Grayscale PDF
- Convert (2, new): Text → PDF, PDF → Text
- Security (2, new): Unlock / View PDF, Redact & burn
- Image (3): Convert, EXIF inspector, Compress images
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

## Privacy proof

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
- 8 of 9 new tools inherit base caps; `pdf-redact-burn` tightens mobile
  to 25 MB single / 100 MB total + page-count guard (100 desktop /
  25 mobile) + 16 MP raster cap inside the tool
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
