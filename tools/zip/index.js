// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/zip/index.js — zip files client-side. Zero upload.
// Heavy: JSZip (lazy dynamic import, cached). Total cap enforced BEFORE any
// compression work: 200MB desktop, 150MB mobile (LIMITS.md batch-total row
// via ctx.activeCaps('zip')). Progress via generateAsync metadata.
// Contract: export function mount(el, ctx) -> cleanup function

export const JSZIP_PIN = '3.10.1';
export const MAX_TOTAL_BYTES = 200 * 1024 * 1024; // 200MB desktop default
export const MAX_TOTAL_BYTES_MOBILE = 150 * 1024 * 1024; // 150MB mobile (LIMITS.md)

export function formatBytes(n) {
  n = Math.max(0, +n || 0);
  if (n < 1024) return n + ' B';
  const units = ['KB', 'MB', 'GB'];
  let v = n / 1024, u = 0;
  while (v >= 1024 && u < units.length - 1) { v /= 1024; u++; }
  return v.toFixed(v >= 100 ? 0 : 1) + ' ' + units[u];
}

// Effective cap: honor ctx.activeCaps('zip') (mobile 150MB total) when
// available, else fall back to static defaults (mobile flag optional).
export function effectiveCapBytes(ctx = {}, { mobile = false } = {}) {
  try {
    if (typeof ctx.activeCaps === 'function') {
      const caps = ctx.activeCaps('zip');
      if (caps?.maxTotalMB) return Math.round(caps.maxTotalMB * 1024 * 1024);
    }
  } catch {}
  return mobile ? MAX_TOTAL_BYTES_MOBILE : MAX_TOTAL_BYTES;
}

// Sanitize an entry name: strip ../, backslashes, drive letters, leading
// slashes so entries can never escape the archive root.
export function sanitizeName(name) {
  let n = String(name || 'file').replace(/\\/g, '/');
  n = n.replace(/^[a-zA-Z]:/, '');           // drive letter
  n = n.split('/').filter(seg => seg && seg !== '.' && seg !== '..').join('/');
  n = n.replace(/^\/+/, '');
  if (!n) n = 'file';
  return n.slice(0, 255);
}

// Pure: validate a file list against the cap. Testable in Node.
export function validateTotal(files, capBytes = MAX_TOTAL_BYTES) {
  const list = [...(files || [])];
  const total = list.reduce((s, f) => s + (f?.size || 0), 0);
  return {
    count: list.length,
    total,
    capBytes,
    ok: list.length > 0 && total <= capBytes,
    error: !list.length ? 'No files selected.'
      : total > capBytes
        ? `Total ${formatBytes(total)} exceeds ${formatBytes(capBytes)} cap — remove files.`
        : '',
  };
}

// Gate files via ctx.checkFiles/activeCaps BEFORE any compression work.
// Returns { ok, files, reason } where files = capped accepted list.
export function gateZipFiles(files, ctx = {}) {
  const cap = effectiveCapBytes(ctx);
  try {
    if (typeof ctx.checkFiles === 'function') {
      const r = ctx.checkFiles(files, { toolId: 'zip', accept: '*/*', multiple: true });
      const v = validateTotal(r.accepted?.length ? r.accepted : [], cap);
      if (!v.ok) {
        const reason = v.error || r.rejected?.[0]?.reason || 'Files rejected by device caps.';
        return { ok: false, files: [], reason, cap };
      }
      return { ok: true, files: r.accepted, reason: '', cap };
    }
  } catch (e) {
    return { ok: false, files: [], reason: e?.message || 'Cap check failed.', cap };
  }
  const v = validateTotal(files, cap);
  if (!v.ok) return { ok: false, files: [], reason: v.error, cap };
  return { ok: true, files: [...files], reason: '', cap };
}

let _JSZip = null;
export async function loadJSZip() {
  if (_JSZip) return _JSZip;
  try {
    const m = await import(/* @vite-ignore */'https://esm.sh/jszip@3.10.1');
    _JSZip = m.default ?? m.JSZip ?? m;
  } catch {
    await loadScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
    _JSZip = globalThis.JSZip;
  }
  if (!_JSZip) throw new Error('Could not load jszip@3.10.1 from CDN (check network).');
  return _JSZip;
}
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = res; s.onerror = () => rej(new Error('script failed: ' + src));
    document.head.appendChild(s);
  });
}

// Injectable core: pass JSZip class in tests, lazy-load in browser.
export async function createZip(files, { JSZipImpl = null, onProgress, capBytes = MAX_TOTAL_BYTES } = {}) {
  const v = validateTotal(files, capBytes);
  if (!v.ok) throw new Error(v.error);
  const Impl = JSZipImpl || await loadJSZip();
  const zip = new Impl();
  // unique sanitized names (duplicate input names get -2, -3… suffixes)
  const seen = new Map();
  for (const f of files) {
    let name = sanitizeName(f.name || 'file');
    if (seen.has(name)) {
      const n = seen.get(name) + 1;
      seen.set(name, n);
      const dot = name.lastIndexOf('.');
      name = dot > 0 ? `${name.slice(0, dot)}-${n}${name.slice(dot)}` : `${name}-${n}`;
    } else seen.set(name, 1);
    zip.file(name, f);
  }
  const blob = await zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    meta => onProgress && onProgress(meta?.percent != null ? meta.percent / 100 : null),
  );
  onProgress && onProgress(1);
  return blob;
}

export function mount(el, ctx = {}) {
  const log = (...a) => { (ctx.log || console.log)('[zip]', ...a); };
  let files = [];
  let zipUrl = null;
  const capBytes = effectiveCapBytes(ctx);

  el.innerHTML = `
    <div style="display:grid;gap:10px">
      <p class="muted" style="margin:0">100% local — JSZip loads once on first Create. Max total ${formatBytes(capBytes)} (this device).</p>
      <label style="font-size:13px;font-weight:600">Files (multi-select)
        <input type="file" data-f="files" multiple />
      </label>
      <div data-f="list" style="font-size:13px;color:#64748b">No files selected.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button data-f="go">Create ZIP & download</button>
        <a data-f="dl" hidden>Download .zip</a>
      </div>
      <progress data-f="bar" max="100" value="0" style="width:100%" hidden></progress>
      <div data-f="status" style="font-size:13px;color:#64748b" aria-live="polite"></div>
    </div>`;

  const q = s => el.querySelector(`[data-f="${s}"]`);
  const say = m => { q('status').textContent = m; log(m); };
  const setBar = p => {
    const bar = q('bar');
    if (p == null) { bar.hidden = true; return; }
    bar.hidden = false; bar.value = Math.round(p * 100);
  };

  q('files').addEventListener('change', e => {
    // Gate via ctx.checkFiles/activeCaps first; never trust raw input.
    const gate = gateZipFiles([...e.target.files], ctx);
    files = gate.ok ? gate.files : [...e.target.files];
    const v = validateTotal(files, gate.cap);
    q('list').textContent = files.length
      ? files.map((f, i) => `${i + 1}. ${sanitizeName(f.name)} (${formatBytes(f.size)})`).join('  ·  ') +
        `  —  total ${formatBytes(v.total)} / ${formatBytes(v.capBytes)}`
      : 'No files selected.';
    if (!gate.ok) say('Rejected: ' + gate.reason);
    else if (!v.ok && files.length) say(v.error);
    else if (files.length) say(`${files.length} files, ${formatBytes(v.total)} — under cap, ready.`);
  });

  q('go').addEventListener('click', async () => {
    const gate = gateZipFiles(files, ctx);
    if (!gate.ok) { say('Rejected: ' + (gate.reason || 'Pick files first.')); return; }
    files = gate.files;
    const v = validateTotal(files, gate.cap);
    if (!v.ok) { say(v.error || 'Pick files first.'); return; }
    q('go').disabled = true;
    setBar(0);
    try {
      say('Loading JSZip (once)…');
      const blob = await createZip(files, { capBytes: gate.cap, onProgress: p => { if (p != null) setBar(p); } });
      const dl = ctx.download;
      if (typeof dl === 'function') { dl(blob, 'files.zip', 'application/zip'); }
      else {
        if (zipUrl) URL.revokeObjectURL(zipUrl);
        zipUrl = URL.createObjectURL(blob);
        const a = q('dl');
        a.href = zipUrl; a.download = 'files.zip'; a.hidden = false;
      }
      setBar(null);
      say(`Done — ${v.count} files, ${formatBytes(v.total)} → ${formatBytes(blob.size)} .zip`);
    } catch (e) {
      setBar(null);
      say('Error: ' + (e?.message || e));
    } finally { q('go').disabled = false; }
  });

  log('mounted');
  function cleanup() {
    if (zipUrl) URL.revokeObjectURL(zipUrl);
    zipUrl = null;
    files = [];
    el.innerHTML = '';
  }
  cleanup.createZip = createZip;
  cleanup.validateTotal = validateTotal;
  cleanup.formatBytes = formatBytes;
  return cleanup;
}

export default { mount };
