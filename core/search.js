// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava. Source-available - see /LICENSE. Commercial use requires permission: rajat242003@gmail.com.
/**
 * Friendly synonym search (MVP-1 T02).
 * Pure ESM, no imports: caller passes the tool list (see core/registry.js
 * `TOOLS` shape: { id, name, desc, cat, ... }).
 *
 *   import { searchWithSynonyms } from './search.js';
 *   import { TOOLS } from './registry.js';
 *   const hits = searchWithSynonyms('shrink to 1MB', TOOLS); // -> [compress, ...]
 *
 * No-match behaviour: when nothing scores above zero, this returns a short
 * list of suggestions (closest fuzzy match + popular fallbacks) so the UI
 * never renders an empty dead-end. Use `suggestTools()` directly if you need
 * suggestions without conflating them with real hits.
 */

/** Alias phrase (normalized) -> canonical search terms. */
export const SYNONYMS = {
  // --- explicitly requested clusters ---
  turn: ['rotate'],
  spin: ['rotate'],
  rotate: ['rotate', 'turn', 'spin'],
  extract: ['split', 'extract'],
  'split out': ['split', 'extract'],
  'take pages': ['split', 'extract'],
  'pull pages': ['split', 'extract'],
  'get pages': ['split', 'extract'],
  redact: ['redact', 'mask', 'pii'],
  'black out': ['redact', 'mask'],
  blackout: ['redact', 'mask'],
  burn: ['redact', 'mask'],
  unlock: ['unlock', 'decrypt'],
  decrypt: ['unlock', 'decrypt'],
  'open locked': ['unlock', 'decrypt'],
  'remove password': ['unlock', 'decrypt'],
  grayscale: ['grayscale', 'convert'],
  greyscale: ['grayscale', 'convert'],
  'b w': ['grayscale', 'convert'],
  'b&w': ['grayscale', 'convert'],
  bw: ['grayscale', 'convert'],
  'black and white': ['grayscale', 'convert'],
  'target size': ['compress', 'target'],
  'target-size': ['compress', 'target'],
  'shrink to 1mb': ['compress', 'target'],
  '1mb': ['compress', 'target'],
  merge: ['merge', 'combine'],
  combine: ['merge', 'combine'],
  join: ['merge', 'combine'],
  stitch: ['merge', 'combine'],
  append: ['merge', 'combine'],
  compress: ['compress', 'shrink'],
  shrink: ['compress', 'shrink'],
  reduce: ['compress', 'shrink'],
  smaller: ['compress', 'shrink'],
  'make smaller': ['compress', 'shrink'],

  // --- general friendly aliases ---
  'join pdfs': ['merge'],
  'combine pdfs': ['merge'],
  split: ['split', 'extract'],
  divide: ['split'],
  separate: ['split'],
  password: ['protect', 'password'],
  lock: ['protect', 'password'],
  encrypt: ['protect', 'password'],
  protect: ['protect', 'password'],
  'jpg to pdf': ['images-to-pdf', 'pdf'],
  'png to pdf': ['images-to-pdf', 'pdf'],
  'photo to pdf': ['images-to-pdf', 'pdf'],
  'image to pdf': ['images-to-pdf', 'pdf'],
  'pdf to jpg': ['pdf-to-images', 'export'],
  'pdf to png': ['pdf-to-images', 'export'],
  'pdf to images': ['pdf-to-images', 'export'],
  'export png': ['pdf-to-images', 'export'],
  'export jpg': ['pdf-to-images', 'export'],
  metadata: ['scrub', 'metadata'],
  'remove metadata': ['scrub', 'metadata'],
  clean: ['scrub', 'metadata'],
  watermark: ['watermark', 'stamp'],
  stamp: ['watermark', 'stamp'],
  'page numbers': ['pagenum', 'number'],
  bates: ['pagenum', 'number'],
  'number pages': ['pagenum', 'number'],
  flatten: ['flatten'],
  reorder: ['reorder'],
  rearrange: ['reorder'],
  'sort pages': ['reorder'],
  convert: ['convert'],
  'change format': ['convert'],
  'jpg png webp': ['convert'],
  exif: ['exif'],
  gps: ['exif'],
  location: ['exif'],
  'camera data': ['exif'],
  'strip exif': ['exif'],
  resize: ['compress', 'resize'],
  mask: ['redact', 'mask'],
  hide: ['redact', 'mask'],
  censor: ['redact', 'mask'],
  ocr: ['ocr', 'text'],
  scan: ['ocr', 'text'],
  'read text': ['ocr', 'text'],
  'extract text': ['ocr', 'text'],
  'text from image': ['ocr', 'text'],
  video: ['video', 'gif'],
  gif: ['video', 'gif'],
  trim: ['video', 'gif'],
  'trim clip': ['video', 'gif'],
  sign: ['sign', 'signature'],
  signature: ['sign', 'signature'],
  zip: ['zip', 'archive'],
  bundle: ['zip', 'archive'],
  archive: ['zip', 'archive'],
};

/** Extra searchable keywords per tool id (lowercase, pre-normalized). */
export const TOOL_KEYWORDS = {
  'pdf-merge': ['merge', 'combine', 'join', 'stitch', 'append', 'join pdfs', 'combine pdfs'],
  split: ['split', 'extract', 'split out', 'take pages', 'pull pages', 'get pages', 'divide', 'separate', 'page ranges'],
  compress: ['compress', 'shrink', 'reduce', 'smaller', 'make smaller', 'target size', 'target-size', 'shrink to 1mb', '1mb', 'size'],
  'images-to-pdf': ['images to pdf', 'jpg to pdf', 'png to pdf', 'photo to pdf', 'image to pdf', 'photos'],
  'pdf-to-images': ['pdf to images', 'pdf to jpg', 'pdf to png', 'export png', 'export jpg', 'export', 'png', 'jpg'],
  protect: ['protect', 'password', 'lock', 'encrypt'],
  scrub: ['scrub', 'metadata', 'remove metadata', 'clean', 'hidden'],
  watermark: ['watermark', 'stamp', 'text across'],
  pagenum: ['page numbers', 'bates', 'number pages', 'number', 'stamps'],
  flatten: ['flatten', 'forms', 'annotations'],
  reorder: ['reorder', 'rearrange', 'sort pages', 'order spec'],
  'image-convert': ['convert', 'change format', 'jpg png webp', 'formats', 'webp', 'jpeg'],
  'image-exif': ['exif', 'gps', 'location', 'camera data', 'strip exif', 'inspector'],
  'image-compress': ['compress images', 'resize', 'resize images', 'shrink image', 'recompress', 'smaller'],
  'pii-mask': ['redact', 'mask', 'black out', 'blackout', 'burn', 'hide', 'censor', 'pii', 'emails', 'phones', 'ids'],
  ocr: ['ocr', 'scan', 'read text', 'extract text', 'text from image', 'offline', 'text'],
  'video-gif': ['video', 'gif', 'trim', 'trim clip', 'convert video', 'clips', 'mp4'],
  sign: ['sign', 'signature', 'draw signature', 'type signature'],
  zip: ['zip', 'bundle', 'archive', 'bundle files'],
};

/** Popular tools used as last-resort suggestions on no-match. */
export const POPULAR_IDS = ['pdf-merge', 'compress', 'split', 'ocr', 'images-to-pdf'];

/** Lowercase, `&` -> ` `, strip punctuation, collapse whitespace. */
export function normalizeQuery(q) {
  return String(q || '')
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokensOf(norm) {
  return norm ? norm.split(' ') : [];
}

/** Expand normalized query with synonym canonicals (phrase + token level). */
export function expandQuery(norm) {
  const expanded = new Set(tokensOf(norm));
  if (!norm) return [...expanded];
  for (const [alias, canonicals] of Object.entries(SYNONYMS)) {
    const a = normalizeQuery(alias);
    if (!a) continue;
    const isPhrase = a.includes(' ');
    const hit = isPhrase ? norm.includes(a) : tokensOf(norm).includes(a);
    if (hit) for (const c of canonicals) for (const t of tokensOf(normalizeQuery(c))) expanded.add(t);
  }
  // Also index the raw normalized alias tokens themselves so that a query
  // like "black out" still matches even before expansion.
  return [...expanded];
}

function editDistance(a, b, cap = 3) {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > cap) return cap + 1;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i += 1) {
    let cur = [i];
    let rowMin = i;
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > cap) return cap + 1;
    prev = cur;
  }
  return prev[n];
}

function fuzzyHit(token, hayTokens) {
  // Allow 1 typo for short tokens, 2 for longer ones.
  for (const h of hayTokens) {
    if (!h) continue;
    if (h === token) return 1;
    if (h.startsWith(token) || token.startsWith(h)) return 0.8; // prefix
    const cap = token.length <= 4 ? 1 : 2;
    if (Math.min(token.length, h.length) >= 3 && editDistance(token, h, cap) <= cap) return 0.6;
  }
  return 0;
}

function haystackFor(tool) {
  const kw = TOOL_KEYWORDS[tool?.id] || [];
  const text = [tool?.id, tool?.name, tool?.desc, tool?.cat, ...kw].filter(Boolean).join(' ');
  const norm = normalizeQuery(text.replace(/-/g, ' '));
  return { norm, tokens: new Set(tokensOf(norm)) };
}

function scoreTool(tool, norm, expanded) {
  const { norm: hay, tokens: haySet } = haystackFor(tool);
  const hayTokens = [...haySet];
  let score = 0;

  // Exact full-phrase hit is the strongest signal.
  if (norm && hay.includes(norm)) score += 12;

  for (const tok of expanded) {
    if (!tok) continue;
    if (haySet.has(tok)) {
      // Weight id/name-ish tokens higher via keyword presence; flat +3 keeps it simple.
      score += 3;
    } else {
      score += fuzzyHit(tok, hayTokens);
    }
  }

  // Small boost when a defined keyword phrase for this tool appears verbatim.
  for (const kw of TOOL_KEYWORDS[tool?.id] || []) {
    if (norm && normalizeQuery(kw) && norm.includes(normalizeQuery(kw))) score += 4;
  }
  return score;
}

/**
 * Ranked fuzzy + synonym search over a tool list.
 * @param {string} query user input
 * @param {Array} tools tool objects ({ id, name, desc, cat })
 * @param {{ limit?: number }} [opts]
 * @returns {Array} matching tools, best first; on no-match, suggestion fallbacks.
 */
export function searchWithSynonyms(query, tools, opts = {}) {
  const list = Array.isArray(tools) ? tools : [];
  const norm = normalizeQuery(query);
  if (!norm) return [...list];
  if (list.length === 0) return [];

  const expanded = expandQuery(norm);
  const scored = list
    .map((tool) => ({ tool, score: scoreTool(tool, norm, expanded) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length > 0) {
    const limit = Number.isFinite(opts.limit) ? opts.limit : scored.length;
    return scored.slice(0, limit).map((s) => s.tool);
  }
  return suggestTools(query, list, opts.limit ?? 3);
}

/**
 * Closest-match suggestions for a query with zero hits.
 * Never returns [] when `tools` is non-empty: falls back to POPULAR_IDS order.
 */
export function suggestTools(query, tools, limit = 3) {
  const list = Array.isArray(tools) ? tools : [];
  if (list.length === 0) return [];
  const norm = normalizeQuery(query);
  const expanded = expandQuery(norm);
  const n = Math.max(1, Number(limit) || 3);

  const scored = list
    .map((tool) => ({ tool, score: norm ? scoreTool(tool, norm, expanded) : 0 }))
    .sort((a, b) => b.score - a.score);

  const nonZero = scored.filter((s) => s.score > 0).map((s) => s.tool);
  if (nonZero.length > 0) return nonZero.slice(0, n);

  // Pure fallback: popular tools first, then the rest in registry order.
  const byId = new Map(list.map((t) => [t.id, t]));
  const out = [];
  for (const id of POPULAR_IDS) {
    if (byId.has(id)) out.push(byId.get(id));
    if (out.length >= n) break;
  }
  for (const t of list) {
    if (out.length >= n) break;
    if (!out.includes(t)) out.push(t);
  }
  return out.slice(0, n);
}
