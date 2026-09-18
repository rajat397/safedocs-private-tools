// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// Shim for router probing: canonical flat path ./tools/image-exif/tool.js
// re-exports the real implementation without renaming originals.
// Real code lives at tools/image/exif-remove.js (owned by builder:image+pii).
export { mount, strip } from '../image/exif-remove.js';
export { default } from '../image/exif-remove.js';
