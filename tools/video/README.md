<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 | Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com -->
# Video → GIF tool

- `index.js` — `mount(el, ctx)` UI + conversion paths. Vanilla ES module.

## Privacy

Zero upload. Decode + encode happen on-device.

## Paths

1. **Primary (auto):** WebCodecs `VideoDecoder` + `gifenc@1.0.3`, both lazy
   (`gifenc` dynamic `import()` on first Convert; see `vendor/cdn-pins.js`).
2. **Fallback (opt-in):** `ffmpeg.wasm` (~25MB). Gated behind an explicit
   consent button — "Load ~25MB fallback decoder?" — never auto-loaded,
   cached after first load.
3. **Unsupported:** fast principled stub `{ status:'unsupported', reason,
   fallbackAvailable:true, hint }`. All async paths race a timeout
   (`CONVERT_TIMEOUT_MS` 30s, stub 5s) so the UI never hangs.

## Caps (enforced before decode via `computePlan`)

- Max 1280×720 (aspect-preserving downscale, even dims for gifenc)
- Max 10s (trim to first 10s)
- Max 15fps

## Acceptance

5s test video → GIF via primary path, or the principled stub on browsers
without WebCodecs (stub must resolve in <5s with `fallbackAvailable: true`).
