<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->
# Third-Party Notices – SafeDocs – Private File Tools

This project loads the following third-party libraries at runtime
from pinned CDNs (see `vendor/cdn-pins.js`). No vendored copies
are shipped in this repository.

## pdf-lib@1.17.1 – MIT

- Upstream: https://github.com/Hopding/pdf-lib
- License: MIT
- CDN:
  - https://esm.sh/pdf-lib@1.17.1
  - https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js
  - https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js

## jszip@3.10.1 – MIT

- Upstream: https://github.com/Stuk/jszip
- License: MIT
- CDN:
  - https://esm.sh/jszip@3.10.1
  - https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js

## gifenc@1.0.3 – MIT

- Upstream: https://github.com/mattdesl/gifenc
- License: MIT
- CDN:
  - https://esm.sh/gifenc@1.0.3

## tesseract.js@7 – Apache-2.0

- Upstream: https://github.com/naptha/tesseract.js
- License: Apache License 2.0
- CDN:
  - https://cdn.jsdelivr.net/npm/tesseract.js@7/dist/tesseract.esm.min.js
  - https://unpkg.com/tesseract.js@7/dist/tesseract.esm.min.js
- Note: traineddata language packs (eng, hin) are fetched once on first use and cached.

## @ffmpeg/ffmpeg@0.12.1 – MIT (wrapper) + GPL/LGPL core

- Upstream wrapper: https://github.com/ffmpegwasm/ffmpeg.wasm
- License (wrapper): MIT
- CDN:
  - https://esm.sh/@ffmpeg/ffmpeg@0.12.1
- Core note: the underlying FFmpeg core is licensed under GPL/LGPL.
  This is an OPT-IN fallback only (tools/video), gated behind explicit
  user consent, never auto-loaded. Consult the FFmpeg license terms
  before commercial use.

## pdf.js@3.11.174 (pdfjs-dist) – Apache-2.0

- Upstream: https://mozilla.github.io/pdf.js/
- License: Apache License 2.0
- CDN:
  - https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js
  - https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js

## meshcode-ai/skills-research – MIT

- Upstream: https://github.com/meshcode-ai/skills-research.git
- License: MIT
- Copyright: © 2026 meshcode-ai
- Source: alirezarezvani/claude-skills@research/ (MIT)
- Skills installed (6):
  - res-research-brief
  - res-deep-research
  - res-competitor-research
  - res-customer-research
  - res-survey-design
  - res-dossier
- Local path: .opencode/skills/res-*/SKILL.md
- Note: deferred res-litreview / res-patent-landscape not installed.
