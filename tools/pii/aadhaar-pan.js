// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pii/aadhaar-pan.js — vanilla ES module, zero upload, zero deps.
// Auto-detect ASSIST (text level only; no OCR claims):
//   Aadhaar: lookaround-guarded 12-digit groups + Verhoeff checksum (local tables)
//   PAN:     lookaround-guarded [A-Z]{5}[0-9]{4}[A-Z] format-only (NO checksum exists)
// Contract: pure functions over caller-supplied text. Never fetch/upload.

import { validateVerhoeff } from './verhoeff.js';

// Spec-mandated bare patterns (kept exact for acceptance tests).
export const AADHAAR_RE_SOURCE = '[2-9]\\d{3}\\s?\\d{4}\\s?\\d{4}';
export const PAN_RE_SOURCE = '[A-Z]{5}[0-9]{4}[A-Z]';

// Scanning patterns: hardened.
// - Aadhaar: (?<!\d) / (?!\d) so a 13+ digit run never yields a 12-digit
//   substring hit; \s covers space/tab/newline/CR (single separator per spec,
//   tolerant of one whitespace char of any kind between 4-digit groups).
// - PAN: (?<![A-Za-z0-9]) / (?![A-Za-z0-9]) instead of bare \b so hits glued
//   to digits/letters (e.g. "XABCDE1234FY", "ABCDE1234F2") do not flag.
const AADHAAR_SCAN_SRC = '(?<!\\d)[2-9]\\d{3}\\s?\\d{4}\\s?\\d{4}(?!\\d)';
const PAN_SCAN_SRC = '(?<![A-Za-z0-9])[A-Z]{5}[0-9]{4}[A-Z](?![A-Za-z0-9])';

export const AADHAAR_SCAN_RE = new RegExp(AADHAAR_SCAN_SRC, 'g');
export const PAN_SCAN_RE = new RegExp(PAN_SCAN_SRC, 'g');
// Bare-spec regexes (for acceptance: PAN flagged by format-only pattern).
export const AADHAAR_BARE_RE = new RegExp(AADHAAR_RE_SOURCE);
export const PAN_BARE_RE = new RegExp(PAN_RE_SOURCE);

export const MASK_CHAR = '\u2588'; // full block

/** Digits-only normalization of an Aadhaar match (strips spaces/tabs/newlines). */
export function normalizeAadhaar(raw) {
  return String(raw).replace(/\s/g, '');
}

/** Repeated-digit guard: 0000… / 1111… / etc. are never valid IDs. */
export function isRepeatedDigits(digits) {
  return /^(.)\1+$/.test(String(digits));
}

/** True iff 12 digits, first digit 2-9, not repeated-digit, Verhoeff-valid. */
export function isValidAadhaar(value) {
  const digits = normalizeAadhaar(value);
  if (!/^[2-9]\d{11}$/.test(digits)) return false;
  if (isRepeatedDigits(digits)) return false;
  return validateVerhoeff(digits);
}

/** True iff PAN format [A-Z]{5}[0-9]{4}[A-Z] (format-only, no checksum). Full-match on trim. */
export function isPanFormat(value) {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(String(value).trim());
}

/**
 * Find Aadhaar-shaped candidates in text.
 * Every regex hit is returned; `valid` = Verhoeff pass + repeated-digit guard.
 * Invalid-but-shaped hits are kept so the UI can warn, but only `valid`
 * ones count for burn.
 */
export function findAadhaarCandidates(text) {
  const s = String(text ?? '');
  const out = [];
  const re = new RegExp(AADHAAR_SCAN_SRC, 'g');
  let m;
  while ((m = re.exec(s)) !== null) {
    const raw = m[0];
    const normalized = normalizeAadhaar(raw);
    out.push({
      kind: 'aadhaar',
      raw,
      normalized,
      index: m.index,
      end: m.index + raw.length,
      valid: isValidAadhaar(raw),
    });
    // Guard against zero-length loops (regex always consumes, defensive).
    if (re.lastIndex === m.index) re.lastIndex++;
  }
  return out;
}

/** Find PAN-format candidates in text (all are "flagged", format-only). */
export function findPanCandidates(text) {
  const s = String(text ?? '');
  const out = [];
  const re = new RegExp(PAN_SCAN_SRC, 'g');
  let m;
  while ((m = re.exec(s)) !== null) {
    out.push({
      kind: 'pan',
      raw: m[0],
      normalized: m[0],
      index: m.index,
      end: m.index + m[0].length,
      valid: true, // format-only: a match IS the flag. No checksum exists.
      note: 'format-only',
    });
    if (re.lastIndex === m.index) re.lastIndex++;
  }
  return out;
}

/**
 * Scan text for both ID types.
 * Returns { aadhaar, pan, all } where `all` is index-sorted.
 * `validAadhaar` / `count` count only actionable items:
 *   Verhoeff-valid Aadhaar + all PAN-format hits.
 */
export function scanText(text) {
  const aadhaar = findAadhaarCandidates(text);
  const pan = findPanCandidates(text);
  const all = [...aadhaar, ...pan].sort((a, b) => a.index - b.index);
  const validAadhaar = aadhaar.filter((c) => c.valid);
  return {
    aadhaar,
    pan,
    all,
    validAadhaar,
    count: validAadhaar.length + pan.length,
  };
}

/**
 * Mask actionable candidates in text with full-block characters.
 * - Valid Aadhaar: every digit -> MASK_CHAR (whitespace layout kept).
 * - PAN: every char -> MASK_CHAR.
 * Invalid-shaped Aadhaar (Verhoeff fail / repeated digits) is left intact so
 * a rescan can still surface it for manual review.
 * Uses lookaround-guarded patterns so longer digit/letter runs are untouched.
 * Returns { text, masked } where masked = number of spans redacted.
 */
export function maskText(text, opts = {}) {
  const mask = opts.maskChar ?? MASK_CHAR;
  const maskAadhaar = opts.maskAadhaar ?? true;
  const maskPan = opts.maskPan ?? true;
  let s = String(text ?? '');
  let masked = 0;
  if (maskAadhaar) {
    s = s.replace(new RegExp(AADHAAR_SCAN_SRC, 'g'), (hit) =>
      isValidAadhaar(hit) ? (masked++, hit.replace(/\d/g, mask)) : hit,
    );
  }
  if (maskPan) {
    s = s.replace(new RegExp(PAN_SCAN_SRC, 'g'), (hit) => {
      masked++;
      return mask.repeat(hit.length);
    });
  }
  return { text: s, masked };
}

/** Masked display helper: Aadhaar -> XXXX-XXXX-1234, PAN -> XXXXX-1234F style. */
export function maskedDisplay(c) {
  if (!c) return '';
  if (c.kind === 'pan') return 'XXXXX-' + String(c.raw).slice(-4);
  const d = String(c.normalized || normalizeAadhaar(c.raw));
  return 'XXXX-XXXX-' + d.slice(-4);
}

export default {
  AADHAAR_RE_SOURCE,
  PAN_RE_SOURCE,
  AADHAAR_SCAN_RE,
  PAN_SCAN_RE,
  normalizeAadhaar,
  isValidAadhaar,
  isPanFormat,
  findAadhaarCandidates,
  findPanCandidates,
  scanText,
  maskText,
  maskedDisplay,
  isRepeatedDigits,
};
