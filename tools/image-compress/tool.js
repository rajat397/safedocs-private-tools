// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// Shim for router probing: canonical flat path ./tools/image-compress/tool.js
// re-exports the real implementation without renaming originals.
// Real code lives at tools/image/compress.js (owned by builder:image+pii).
// (tools/image/convert.js shares this caps profile; no separate tool id.)
export { mount, compress } from '../image/compress.js';
export { default } from '../image/compress.js';
