<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->
# SafeDocs – Private File Tools

100% on-device PDF/image/PII tools, zero upload.

## Features

- PDF tools: merge, split, compress, and sign preparation, all in the browser
- Image tools: convert, resize, and compress without leaving your device
- PII tools: detect and redact sensitive text locally
- OCR: English + Hindi text extraction via on-device engine
- ZIP tools: create and inspect archives locally
- Video to GIF: lightweight on-device encoding, with opt-in fallback

## Privacy proof

- Zero upload: files never leave your device; all processing runs locally
- No servers, no analytics uploads, no tracking of file contents
- Third-party libraries load from pinned CDNs on first use, then cache;
  file data itself is never sent anywhere
- Verify: run with network logging, use airplane mode after first load,
  and confirm tools keep working; see PRIVACY.md

## Limits

- Large files are limited by device memory and browser storage
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
