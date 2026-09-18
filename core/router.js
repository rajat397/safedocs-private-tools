// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava. Source-available - see /LICENSE. Commercial use requires permission: rajat242003@gmail.com.
/**
 * Hash router: `#/` (grid) and `#/<tool-id>` (tool view).
 * Tool code is lazy-loaded via dynamic import() so the initial payload
 * stays tiny; only the shell is precached by the service worker.
 *
 * Tool module contract (owned by tools/* builders):
 *   export async function mount(rootEl, ctx) -> cleanupFn | void
 *   ctx = { tool, createDropzone, caps utils, helpers }
 */
import { TOOLS, getTool, searchTools, moduleCandidates } from './registry.js';
import { escapeHtml, fmtBytes } from './utils.js';
import { createDropzone } from './dropzone.js';
import { checkFiles, activeCaps } from './caps.js';

let cleanup = null;
function runCleanup() {
  try { cleanup?.(); } catch { /* ignore */ }
  cleanup = null;
}

export function initRouter({ view, search }) {
  if (!view) throw new Error('router: #view element missing');
  const onHash = () => route(view);
  window.addEventListener('hashchange', onHash);
  if (search) {
    search.addEventListener('input', () => {
      if ((location.hash || '#/') !== '#/') location.hash = '#/';
      else renderHome(view, search.value);
    });
  }
  route(view);
}

async function route(view) {
  runCleanup();
  const hash = location.hash || '#/';
  const m = hash.match(/^#\/([a-z0-9-]+)\/?$/);
  if (!m) {
    renderHome(view, document.getElementById('search')?.value || '');
    return;
  }
  const tool = getTool(m[1]);
  if (!tool) {
    view.innerHTML = `<div class="card"><a class="crumb" href="#/">← All tools</a>
      <h2>Unknown tool</h2><p class="muted">No tool with id “${escapeHtml(m[1])}”.</p></div>`;
    return;
  }
  await renderTool(view, tool);
}

export function renderHome(view, query = '') {
  runCleanup();
  const tools = searchTools(query);
  const cards = tools.map((t) => `
    <a class="card" href="#/${t.id}">
      <span class="cat">${escapeHtml(t.cat)}</span>
      <h3>${escapeHtml(t.name)}</h3>
      <p>${escapeHtml(t.desc)}</p>
    </a>`).join('');
  view.innerHTML = `
    <section class="card">
      <h2 style="margin:0">Toolbox <span class="muted">· ${TOOLS.length} tools</span></h2>
      <p class="muted" style="margin:8px 0 0">Everything runs in your browser. Turn on airplane mode — it still works.</p>
    </section>
    <div class="tool-grid">${cards}</div>
    ${tools.length === 0 ? '<p class="empty">No tools match. Try “pdf”, “image”, “zip”…</p>' : ''}`;
}

async function tryImportTool(tool) {
  const errs = [];
  for (const rel of moduleCandidates(tool)) {
    const url = new URL(rel, document.baseURI).href;
    try {
      const mod = await import(/* @vite-ignore */ url);
      if (mod && typeof mod.mount === 'function') return { mod, url };
      errs.push(`${url}: no mount() export`);
    } catch (e) {
      errs.push(`${url}: ${e?.message || e}`);
    }
  }
  return { errs };
}

/** Shell-provided fallback so every route is useful even before tools land. */
function renderPlaceholder(view, tool, loadErrors) {
  const caps = activeCaps(tool.id);
  view.innerHTML = `
    <div class="card">
      <a class="crumb" href="#/">← All tools</a>
      <h2 style="margin:4px 0">${escapeHtml(tool.name)}</h2>
      <p class="muted" style="margin:0 0 4px">${escapeHtml(tool.desc)}</p>
      <span class="pill blue">${escapeHtml(tool.cat)}</span>
      <span class="pill grey">${tool.multiple ? 'multi-file' : 'single file'}</span>
      <div class="notice">🔒 On-device only — files are processed locally and never uploaded.</div>
      <div id="dz"></div>
      <div class="kv">
        <dt>Accepted types</dt><dd>${escapeHtml(tool.accept)}</dd>
        <dt>Size caps (this device)</dt><dd>${caps.maxSingleMB} MB / file · ${caps.maxTotalMB} MB total · max ${caps.maxFiles} files</dd>
      </div>
      <div class="progress" aria-hidden="true"><div id="bar"></div></div>
      <div id="out"></div>
    </div>`;

  const dz = createDropzone({
    accept: tool.accept,
    multiple: tool.multiple !== false,
    toolId: tool.id,
    label: `Drop ${tool.multiple === false ? 'your file' : 'your files'} for ${tool.name}`,
    onFiles: (files) => {
      const out = view.querySelector('#out');
      const total = files.reduce((s, f) => s + f.size, 0);
      out.innerHTML = `<div class="notice">✔ ${files.length} file(s) accepted locally (${fmtBytes(total)}). The <strong>${escapeHtml(tool.id)}</strong> processor plugs in here (tools/*).</div>`;
    },
  });
  view.querySelector('#dz').append(dz.element);
  cleanup = () => dz.destroy();

  if (loadErrors?.length) {
    const d = document.createElement('div');
    d.className = 'warnbox';
    d.innerHTML = `<strong>Tool module not loaded yet</strong> <span class="muted">(shell is ready; implementation pending):</span><br><span class="muted">${loadErrors.map(escapeHtml).join('<br>')}</span>`;
    view.querySelector('.card').append(d);
  }
}

async function renderTool(view, tool) {
  view.innerHTML = `<div class="card"><a class="crumb" href="#/">← All tools</a>
    <h2>Loading ${escapeHtml(tool.name)}…</h2><div class="progress"><div style="width:40%"></div></div></div>`;

  const { mod, url, errs } = await tryImportTool(tool);
  if (!mod) {
    renderPlaceholder(view, tool, errs);
    return;
  }
  view.innerHTML = `<div class="card" id="tool-host">
    <a class="crumb" href="#/">← All tools</a>
    <h2 style="margin:4px 0">${escapeHtml(tool.name)}</h2>
    <div class="notice">🔒 On-device only — files are processed locally and never uploaded.</div>
    <div id="tool-root"></div></div>`;
  const root = view.querySelector('#tool-root');
  const ctx = {
    tool,
    createDropzone,
    checkFiles,
    activeCaps,
    baseUrl: url.slice(0, url.lastIndexOf('/') + 1),
  };
  try {
    const maybeCleanup = await mod.mount(root, ctx);
    if (typeof maybeCleanup === 'function') cleanup = maybeCleanup;
  } catch (e) {
    root.innerHTML = `<div class="warnbox"><strong>Tool failed to start:</strong> ${escapeHtml(e?.message || e)}</div>`;
  }
}
