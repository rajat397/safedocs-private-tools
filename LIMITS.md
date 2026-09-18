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
