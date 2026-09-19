// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava. Source-available - see /LICENSE. Commercial use requires permission: rajat242003@gmail.com.
/**
 * tools/_lib/page.js — P2 shared UI system lib for tool pages.
 *
 * Zero per-tool boilerplate drift: every tool mounts the same shell and
 * only injects its own options + run logic. No core edits, no per-tool
 * edits — tools opt in via `import { shell } from '../_lib/page.js'`.
 *
 * 7-step contract:
 *   1. shell(el, tool, ctx) — build root shell into `el`.
 *   2. status(msg) — single aria-live status writer.
 *   3. wireCaps() — render caps kv from ctx.activeCaps(tool.id).
 *   4. runBtn(label, fn) — wire the run button (disabled until files).
 *   5. dropzone via ctx.createDropzone — files stay on-device; onFiles hook.
 *   6. caps kv + meter — <dl class="kv"> + .meter batch usage bar.
 *   7. options form slot + run + .progress + output + cleanup revokes.
 *
 * Tool usage:
 *   import { shell } from '../_lib/page.js';
 *   export async function mount(el, ctx = {}) {
 *     const page = shell(el, ctx.tool, ctx);
 *     page.optionsEl.append(myControls);
 *     page.onFiles((files) => { ... });
 *     page.runBtn('Convert & download', async (files, api) => { ... });
 *     return () => page.cleanup();
 *   }
 *
 * Shell contract: mount(rootEl, ctx) -> cleanupFn | void (see core/router.js).
 * ctx used read-only: { tool, createDropzone, checkFiles, activeCaps,
 *   download, isMobile }. This module performs zero network I/O.
 */

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function fmtBytes(n) {
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = n / 1024;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) { v /= 1024; u++; }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[u]}`;
}

function fmtMB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1);
}

/**
 * Build the standard tool page shell.
 * @param {HTMLElement} el — mount root (router gives #tool-root).
 * @param {object} tool — registry entry { id, name, accept, multiple }.
 * @param {object} ctx — shell context (createDropzone, activeCaps, …).
 * @returns page api { root, optionsEl, status, setProgress, getFiles,
 *   onFiles, runBtn, wireCaps, addDownload, clearOutput, cleanup }.
 */
export function shell(el, tool = {}, ctx = {}) {
  if (!el) throw new Error('page.shell: mount element missing');
  const id = tool?.id || '';
  const accept = tool?.accept ?? '*/*';
  const multiple = tool?.multiple !== false;

  // --- tracked state (all revoked/freed by cleanup) -----------------------
  const objectUrls = new Set();
  let files = [];
  let fileListeners = [];
  let dzHandle = null;
  let destroyed = false;
  let lastCaps = null;

  const trackUrl = (url) => { if (url) objectUrls.add(url); return url; };
  const revokeAll = () => {
    for (const u of objectUrls) {
      try { URL.revokeObjectURL(u); } catch { /* ignore */ }
    }
    objectUrls.clear();
  };

  // --- 1. shell(el, tool): root DOM (classes come from styles.css) --------
  el.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'tool-page';
  root.dataset.tool = id;
  root.innerHTML = `
    <div data-slot="head"><span class="pill green">offline-ready · on-device</span></div>
    <div data-slot="dz"></div>
    <dl class="kv tool-caps" data-slot="caps">
      <dt>Accepted types</dt><dd data-slot="caps-accept">${escapeHtml(accept)}</dd>
      <dt>Size caps (this device)</dt><dd data-slot="caps-sizes">…</dd>
    </dl>
    <div class="meter-wrap tool-meter" data-slot="meter" hidden>
      <div class="meter-label" data-slot="meter-label"></div>
      <div class="meter" role="progressbar" aria-label="Batch size usage"
        aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
        <div class="meter-fill" data-slot="meter-fill"></div>
      </div>
    </div>
    <form class="tool-options" data-slot="options" aria-label="Options"></form>
    <div class="btnrow">
      <button type="button" data-action="run" disabled>Run</button>
      <button type="button" class="secondary" data-action="clear">Clear</button>
    </div>
    <div class="progress" data-slot="progress" aria-hidden="true"><div data-slot="bar"></div></div>
    <div class="tool-status muted" data-slot="status" role="status" aria-live="polite"></div>
    <div class="tool-output" data-slot="output"></div>`;
  el.append(root);

  const q = (slot) => root.querySelector(`[data-slot="${slot}"]`);
  const runEl = root.querySelector('[data-action="run"]');
  const clearEl = root.querySelector('[data-action="clear"]');
  const statusEl = q('status');
  const barEl = q('bar');
  const outputEl = q('output');
  const optionsEl = q('options');
  const capsSizesEl = q('caps-sizes');
  const meterWrap = q('meter');
  const meterLabel = q('meter-label');
  const meterFill = q('meter-fill');
  const meterBar = meterWrap.querySelector('.meter');

  // Options form must never navigate (tool buttons live outside submits).
  optionsEl.addEventListener('submit', (e) => e.preventDefault());

  // --- 2. status(): single aria-live writer --------------------------------
  function status(msg = '') {
    if (destroyed) return;
    statusEl.textContent = String(msg ?? '');
  }

  function setProgress(frac) {
    if (!barEl) return;
    const f = Math.max(0, Math.min(1, Number(frac) || 0));
    barEl.style.width = `${f * 100}%`;
  }

  // --- 6. caps kv + meter ---------------------------------------------------
  function readCaps() {
    try {
      if (typeof ctx.activeCaps === 'function') return ctx.activeCaps(id);
    } catch { /* fall through to null */ }
    return null;
  }

  // 3. wireCaps(): paint kv from the active (mobile/desktop) profile.
  function wireCaps() {
    const caps = readCaps();
    lastCaps = caps;
    if (!caps) {
      capsSizesEl.textContent = 'On-device limits apply.';
      return null;
    }
    capsSizesEl.textContent =
      `${caps.maxSingleMB} MB / file · ${caps.maxTotalMB} MB total · max ${caps.maxFiles} files`
      + (caps.mobile ? ' (mobile)' : '');
    renderMeter();
    return caps;
  }

  function renderMeter() {
    const capMB = Number(lastCaps?.maxTotalMB);
    if (!files.length || !Number.isFinite(capMB) || capMB <= 0) {
      meterWrap.hidden = true;
      return;
    }
    const bytes = files.reduce((s, f) => s + (Number.isFinite(f?.size) ? f.size : 0), 0);
    const frac = Math.max(0, Math.min(1, (bytes / (1024 * 1024)) / capMB));
    meterWrap.hidden = false;
    meterLabel.textContent = `${files.length} file${files.length === 1 ? '' : 's'} · ${fmtBytes(bytes)} of ${capMB} MB total`;
    meterFill.style.width = `${frac * 100}%`;
    meterBar.setAttribute('aria-valuenow', String(Math.round(frac * 100)));
  }

  function refreshRunEnabled() {
    runEl.disabled = files.length === 0;
  }

  function setFiles(next) {
    files = [...(next || [])];
    renderMeter();
    refreshRunEnabled();
    for (const fn of fileListeners) {
      try { fn([...files]); } catch { /* listener errors stay local */ }
    }
  }

  function onFiles(fn) {
    if (typeof fn === 'function') fileListeners.push(fn);
  }

  function getFiles() {
    return [...files];
  }

  // --- 5. dropzone via ctx.createDropzone (never a direct core import) -----
  function mountDropzone() {
    const slot = q('dz');
    const create = ctx.createDropzone;
    if (typeof create !== 'function') {
      const warn = document.createElement('div');
      warn.className = 'warnbox';
      warn.textContent = 'File picker unavailable (shell context missing createDropzone).';
      slot.append(warn);
      return;
    }
    dzHandle = create({
      accept,
      multiple,
      toolId: id,
      label: `Drop ${multiple ? 'your files' : 'your file'} here or click to browse`,
      sub: 'Files never leave this device.',
      onFiles: (accepted) => {
        if (destroyed) return;
        setFiles(accepted);
        status(accepted.length
          ? `${accepted.length} file${accepted.length === 1 ? '' : 's'} ready (${fmtBytes(accepted.reduce((s, f) => s + f.size, 0))}).`
          : 'No files accepted.');
      },
    });
    if (dzHandle?.element) slot.append(dzHandle.element);
  }

  // --- output: object-URL downloads, all revoked on clear/cleanup ---------
  function addDownload(blobOrUrl, filename = 'output', label) {
    const a = document.createElement('a');
    a.className = 'btn secondary';
    if (typeof blobOrUrl === 'string' && /^(blob|data):/.test(blobOrUrl)) {
      a.href = blobOrUrl;
    } else if (typeof blobOrUrl === 'string') {
      const url = trackUrl(URL.createObjectURL(new Blob([blobOrUrl], { type: 'application/octet-stream' })));
      a.href = url;
    } else {
      const src = blobOrUrl instanceof Blob ? blobOrUrl : new Blob([blobOrUrl ?? '']);
      const url = trackUrl(URL.createObjectURL(src));
      a.href = url;
    }
    a.download = filename || 'output';
    a.textContent = label || `Download ${filename}`;
    const row = document.createElement('div');
    row.className = 'tool-result btnrow';
    row.append(a);
    outputEl.append(row);
    return a;
  }

  function note(html) {
    const d = document.createElement('div');
    d.className = 'notice';
    d.innerHTML = html;
    outputEl.append(d);
    return d;
  }

  function clearOutput() {
    revokeAll();
    outputEl.innerHTML = '';
    setProgress(0);
  }

  // --- 4. runBtn(label, fn): guarded async runner + .progress --------------
  function runBtn(label, fn) {
    if (typeof label === 'function') { fn = label; label = ''; }
    if (label) runEl.textContent = label;
    if (typeof fn !== 'function') return runEl;
    if (runEl.dataset.wired) {
      runEl.onclick = () => run(fn);
      return runEl;
    }
    runEl.dataset.wired = '1';
    runEl.addEventListener('click', () => run(fn));
    return runEl;
  }

  async function run(fn) {
    if (destroyed || runEl.disabled) return;
    if (!files.length) { status('Pick a file first.'); return; }
    runEl.disabled = true;
    setProgress(0);
    const api = apiPublic();
    try {
      status('Working…');
      await fn(getFiles(), api);
      setProgress(1);
    } catch (e) {
      status(`Error: ${e?.message || e}`);
    } finally {
      if (!destroyed) refreshRunEnabled();
    }
  }

  clearEl.addEventListener('click', () => {
    clearOutput();
    status(files.length ? `${files.length} file(s) still selected.` : 'Cleared.');
  });

  // --- 7. cleanup revokes ---------------------------------------------------
  function cleanup() {
    if (destroyed) return;
    destroyed = true;
    try { dzHandle?.destroy?.(); } catch { /* ignore */ }
    dzHandle = null;
    fileListeners = [];
    revokeAll();
    try { el.innerHTML = ''; } catch { /* ignore */ }
  }

  function apiPublic() {
    return {
      root, optionsEl, outputEl,
      status, setProgress, getFiles, setFiles, onFiles,
      runBtn, run, wireCaps, addDownload, note, clearOutput, cleanup,
      get tool() { return tool; },
      get caps() { return lastCaps; },
    };
  }

  mountDropzone();
  wireCaps();
  refreshRunEnabled();
  status('Drop a file to begin — everything stays on this device.');
  return apiPublic();
}

/** Alias: createPage(el, tool, ctx) === shell(el, tool, ctx). */
export const createPage = shell;

export default { shell, createPage };
