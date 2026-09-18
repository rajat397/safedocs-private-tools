<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->
# vendor/ — stubs only

This directory contains **no vendored library code**. Heavy dependencies are
never checked in; each tool lazy-loads its pinned CDN build on first use:

| stub | real lib (lazy, cached) | used by |
|---|---|---|
| `cdn-pins.js` | pin manifest (this file is the only code) | all advanced tools |
| tesseract.js@7 | ESM + `eng`/`hin` traineddata, GET-once | `tools/ocr` |
| gifenc@1.0.3 | GIF encoder | `tools/video` primary |
| @ffmpeg/ffmpeg@0.12.1 | ~25MB fallback, **consent-gated** | `tools/video` fallback |
| pdf-lib@1.17.1 | minimal embed (same pin as `tools/pdf`) | `tools/sign` |
| jszip@3.10.1 | DEFLATE zip | `tools/zip` |

Rules: no other files here, no heavy code, pins updated in `cdn-pins.js` only.
