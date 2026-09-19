<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 | Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com -->
# Limits

Caps keep tools fast and crash-free, especially on phones. Enforced in
`core/caps.js:checkFiles` (via `core/dropzone.js`); tools must not accept
files the dropzone rejected without re-validating.

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

All other MVP-1 tools inherit the base profile above (no `TOOL_CAPS` entry:
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

## Changing caps

Edit `core/caps.js` (`CAPS`, `TOOL_CAPS`) and update this table in the same
change. Keep mobile caps conservative: the service worker cache refuses
entries > 50 MB and phones kill tabs that spike RAM.
