// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava. Source-available - see /LICENSE. Commercial use requires permission: rajat242003@gmail.com.
/**
 * Recently-used tools (MVP-1 T04).
 * Privacy: stores tool ids + timestamps ONLY — never filenames, file bytes,
 * or other PII. All localStorage access is try/catch so private-mode
 * (SecurityError / QuotaExceededError) failures are non-fatal no-ops.
 */

const KEY = 'safedocs:recents';
const MAX = 8;

function storage() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function isValidEntry(e) {
  return !!e && typeof e === 'object'
    && typeof e.id === 'string' && e.id.length > 0
    && Number.isFinite(e.ts);
}

function readRaw() {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Project to {id, ts} only so stale/foreign shapes can't leak PII.
    return parsed.filter(isValidEntry).map((e) => ({ id: e.id, ts: e.ts }));
  } catch {
    return [];
  }
}

function writeRaw(entries) {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(KEY, JSON.stringify(entries));
  } catch {
    // Private-mode / quota failure: non-fatal no-op.
  }
}

/** Record a tool use. Invalid ids are ignored. Returns the new list. */
export function push(id) {
  if (typeof id !== 'string' || !id.trim()) return list();
  const clean = id.trim().slice(0, 80);
  const entries = readRaw().filter((e) => e.id !== clean);
  entries.unshift({ id: clean, ts: Date.now() });
  const trimmed = entries.slice(0, MAX);
  writeRaw(trimmed);
  return trimmed.map((e) => ({ ...e }));
}

/** Most-recent-first list of {id, ts}. Never throws. */
export function list() {
  return readRaw();
}

/** Clear recents. Never throws. */
export function clear() {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(KEY);
  } catch {
    // Private-mode failure: non-fatal no-op.
  }
}
