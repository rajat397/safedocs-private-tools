<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 | Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com -->
# OCR tool (English + Hindi, on-device)

- `index.js` — `mount(el, ctx)` UI + engine. Vanilla ES module.
- `fixture.js` — `FIXTURE_TEXT` (`HELLO OCR 123`) + canvas renderer for self-test.

## Privacy

Zero upload. The image never leaves the device. The only network GETs are the
`tesseract.js@7` ESM build and the `eng`/`hin` traineddata lang packs, fetched
**once** then cached (singleton worker + `cacheMethod: 'write'`).

## Engine

- Lazy: `tesseract.js@7` dynamic `import()` on first Recognize (see `vendor/cdn-pins.js`).
- `createWorker(['eng','hin'], OEM.LSTM, { cacheMethod:'write', logger })` — v7 API.
- Worker-only OCR; progress via `logger` -> `<progress>` bar.
- Concurrent Recognize calls share one in-flight worker promise, so the lang
  pack is never fetched twice.

## Acceptance

Render `fixture.js` to canvas (or open `fixture.png`), run Recognize, expect
`HELLO OCR 123` in the output `<pre>`.
