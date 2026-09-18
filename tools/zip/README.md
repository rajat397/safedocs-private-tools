<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 | Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com -->
# ZIP tool (multi-file, on-device)

- `index.js` — `mount(el, ctx)` UI + core. Vanilla ES module.

## Privacy

Zero upload. Files are read via `File` handles and compressed locally.

## Engine

- Lazy `JSZip@3.10.1` (`esm.sh` primary, `jsdelivr` UMD fallback; see
  `vendor/cdn-pins.js`). Imported once on first Create, then cached.
- `createZip(files, { JSZipImpl, onProgress })` — `JSZipImpl` injectable for
  tests; DEFLATE level 6; duplicate names get `-2`, `-3`… suffixes.
- `validateTotal(files)` enforces the **200MB** total cap *before* any
  compression work; over-cap selections are rejected with a message.
- Progress via `generateAsync` metadata → `<progress>` bar.

## Acceptance

5 files → `.zip` downloads; unzip lists all 5 names with byte-identical
contents.
