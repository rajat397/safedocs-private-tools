// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// Shim for router probing: canonical flat path ./tools/pii-mask/tool.js
// re-exports the real implementation without renaming originals.
// Real code lives at tools/pii/redact.js (owned by builder:image+pii).
export { mount, burnBoxesInto, verifySolidBlack } from '../pii/redact.js';
export { default } from '../pii/redact.js';
