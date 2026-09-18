<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 | Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com -->
# Sign tool (draw + embed)

- `index.js` — `mount(el, ctx)` UI + helpers. Vanilla ES module.

## Draw

- HiDPI canvas: backing store = CSS size × `devicePixelRatio`, context scaled.
- Transparent background (cleared, never filled) → exported PNG keeps alpha.
- Smoothed strokes (quadratic curves, coalesced pointer events), Clear/Save.

## Embed (minimal pdf-lib)

- Lazy `pdf-lib@1.17.1` (same pin + loader fallback chain as `tools/pdf`),
  loaded only when "Embed PNG in PDF" is clicked.
- `embedPngInPdf(pdfBytes, pngBytes, { pageIndex=-1, width=160 })` draws the
  PNG bottom-right of the last page (or chosen page), returns `{ bytes, page,
  width, height }`.

## Acceptance

Draw → Save PNG (transparent, HiDPI) → pick a PDF → Embed → `signed.pdf`
contains the signature image (PNG embeds — verify by opening).
