<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 | Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com -->
# Limits (38 tools)

Caps keep tools fast and crash-free, especially on phones. Enforced in
`core/caps.js:checkFiles` (via `core/dropzone.js`); tools must not accept
files the dropzone rejected without re-validating. All 38 registry tools
inherit the base profile below except the `TOOL_CAPS` overrides.

## Profiles

| Cap              | Desktop | Mobile |
|------------------|---------|--------|
| Max single file  | 200 MB  | 50 MB  |
| Max batch total  | 500 MB  | 150 MB |
| Max file count   | 50      | 20     |
| Max video input  | 300 MB  | 100 MB |
| Max image dim.   | 12000px | 8000px |

Mobile = `(pointer: coarse)` match, mobile UA, or viewport < 768px
(`core/caps.js:isMobile`).

## Per-tool overrides (`TOOL_CAPS`)

| Tool      | Override |
|-----------|----------|
| `video-gif` | mobile: 100 MB single / 150 MB total (GIF encode is memory-heavy) |
| `ocr`       | mobile: 25 MB single / 100 MB total (on-device model RAM) |
| `pdf-redact-burn` | mobile: 25 MB single / 100 MB total (raster burn holds full-page bitmaps in RAM) |
| `image-bgremove` | mobile: 25 MB single / 100 MB total / max 4096px (AI model RAM) |
| `image-upscale` | mobile: 25 MB single / 100 MB total / max 2048px input (AI model RAM) |
| `image-colorize` | mobile: 25 MB single / 100 MB total / max 2048px input (AI model RAM) |
| `image-vectorize` | mobile: 10 MB single / 50 MB total / max 2048px input (WASM trace) |

All other tools inherit the base profile above (no `TOOL_CAPS` entry:
`activeCaps` falls through to `CAPS`). Add an override here only with a
measured RAM / CPU reason, same change as the `core/caps.js` edit.

### 9 new tools (MVP-3)

`pdf-rotate`, `pdf-add-remove-pages`, `pdf-extract-pages`,
`pdf-target-size`, `pdf-grayscale`, `text-to-pdf`, `pdf-to-text`,
`pdf-unlock-view` inherit the base profile above (no `TOOL_CAPS` entry).
`pdf-redact-burn` is the 9th: desktop inherits base, mobile is capped at
25 MB single / 100 MB total (row above — raster burn holds full-page
bitmaps in RAM). `pdf-redact-burn` additionally guards page count
(100 desktop / 25 mobile) and raster size (16 MP / `maxImageDim`) inside
the tool; those are tool-level guards, not `checkFiles` caps.

### 6 new tools (P3A, pdf-lib only)

`pdf-metadata-edit`, `pdf-split-by-size`, `pdf-crop`,
`pdf-extract-images`, `pdf-remove-annotations`, `pdf-n-up` inherit the
base profile above (no `TOOL_CAPS` entry: vector-only pdf-lib ops with no
measured RAM spike beyond the base caps). Tool-level guards, not
`checkFiles` caps: 500-page cap inside every tool; `pdf-extract-images`
additionally caps downloads at the first 100 images per run (re-run on
page ranges for the rest) since each image triggers a separate download.

### 4 new tools (Image Tools MVP)

`image-bgremove`, `image-upscale`, `image-colorize`, `image-vectorize`
have per-tool overrides above (AI/WASM model RAM). Each tool enforces
a 50 MB/model mobile cap via the model loader (OPFS cache), and uses
tiled inference where applicable. Desktop inherits base caps with
`maxImageDim` limits per tool.

## Batch meter

After `checkFiles`, the dropzone derives bar data via
`core/caps.js:batchMeter(result)` → `{ count, acceptedBytes, acceptedMB,
capMB, mobile, frac }` (`frac` = accepted / total cap, clamped 0–1) and
renders it into the existing `.meter` bar (`styles.css`): e.g. “2 files ·
12.4 MB of 150 MB total”. The meter is read-only feedback; it never changes
accept/reject decisions.

Accessibility: the bar itself is decorative; the text label (“N files ·
X MB of Y MB total”) is the accessible status, and shell announcements
go through `main#view` (`aria-live="polite"` in `index.html`).

## Behavior on excess

- Over-limit files are **rejected individually with a reason**, not silently
  dropped; the rest of the batch still loads.
- Single-file tools keep the first valid file and explain the rest.
- Tools should show progress (`.progress` in `styles.css`) and process large
  inputs in chunks / workers where possible.

## Hard-refresh note

- If the toolbox shows 28 tools instead of 34, hard-refresh with
  `Ctrl+Shift+R`, then check in an incognito window.
- Still stale? DevTools → Application → Service Workers → Unregister
  the SW, then reload. Footer must read `v4·34`.

## Changing caps

Edit `core/caps.js` (`CAPS`, `TOOL_CAPS`) and update this table in the same
change. Keep mobile caps conservative: the service worker cache refuses
entries > 50 MB and phones kill tabs that spike RAM.
