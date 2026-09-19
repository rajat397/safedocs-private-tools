// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava. Source-available - see /LICENSE. Commercial use requires permission: rajat242003@gmail.com.
/** Small DOM + file helpers. No network, no uploads. */

export const $ = (id) => document.getElementById(id);

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (v != null) n.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null) continue;
    n.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return n;
}

export function fmtBytes(n) {
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = n / 1024;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) { v /= 1024; u++; }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[u]}`;
}

/**
 * Central download helper (P0). Local-only: creates one object URL,
 * triggers a download via an anchor click, revokes after 10s.
 * No network, no uploads.
 * @param {Blob|File|Uint8Array|ArrayBuffer|DataView|TypedArray|string} input
 * @param {string} [filename="output"]
 * @param {string} [mime="application/octet-stream"]
 */
export function download(input, filename = 'output', mime = 'application/octet-stream') {
  let blob;
  if (input instanceof Blob) {
    blob = input;
  } else if (typeof input === 'string') {
    blob = new Blob([input], { type: mime });
  } else if (input instanceof ArrayBuffer) {
    blob = new Blob([input.slice(0)], { type: mime });
  } else if (input instanceof Uint8Array) {
    blob = new Blob([input.slice()], { type: mime });
  } else if (ArrayBuffer.isView(input)) {
    const copy = new Uint8Array(input.buffer, input.byteOffset, input.byteLength).slice();
    blob = new Blob([copy], { type: mime });
  } else {
    throw new TypeError('download: unsupported input type');
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'output';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function readAsArrayBuffer(file) {
  return file.arrayBuffer();
}

export function debounce(fn, ms = 200) {
  let t = 0;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function setProgress(barEl, frac) {
  if (!barEl) return;
  barEl.style.width = `${Math.max(0, Math.min(1, frac || 0)) * 100}%`;
}
