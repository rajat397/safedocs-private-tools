// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pii/verhoeff.js — vanilla ES module, zero upload, zero deps.
// Local Verhoeff checksum tables (base-10). Used to validate Aadhaar's
// 12th check digit. No network, no OCR, no upload — pure arithmetic.
//
// Verhoeff validate: c = 0; walk digits right-to-left,
//   c = D[c][P[i mod 8][digit]]; valid iff c === 0.
// Verhoeff generate: for an n-digit base (no check digit), walk right-to-left
//   with offset (i+1) mod 8, then check = INV[c].

// Multiplication table D (10x10)
export const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

// Permutation table P (8x10)
export const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 7, 2, 5],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

// Inverse table
export const INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

function digitsOf(s) {
  // Returns array of ints or null if any char is not 0-9.
  if (typeof s !== 'string' || s.length === 0) return null;
  const out = new Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i) - 48;
    if (c < 0 || c > 9) return null;
    out[i] = c;
  }
  return out;
}

/** Validate a digit-only string with Verhoeff. Returns boolean. */
export function validateVerhoeff(numStr) {
  const d = digitsOf(numStr);
  if (!d) return false;
  let c = 0;
  // Right-to-left: position i = 0 is the check digit.
  for (let i = 0; i < d.length; i++) {
    c = D[c][P[i % 8][d[d.length - 1 - i]]];
  }
  return c === 0;
}

/** Compute the Verhoeff check digit for a digit-only base (without check). */
export function verhoeffCheckDigit(baseStr) {
  const d = digitsOf(baseStr);
  if (!d) throw new Error('verhoeffCheckDigit: base must be digits only');
  let c = 0;
  for (let i = 0; i < d.length; i++) {
    c = D[c][P[(i + 1) % 8][d[d.length - 1 - i]]];
  }
  return String(INV[c]);
}

/** Append a correct check digit to an 11-digit base -> 12-digit number. */
export function verhoeffGenerate(baseStr) {
  return baseStr + verhoeffCheckDigit(baseStr);
}

export default { D, P, INV, validateVerhoeff, verhoeffCheckDigit, verhoeffGenerate };
