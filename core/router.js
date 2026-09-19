// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava. Source-available - see /LICENSE. Commercial use requires permission: rajat242003@gmail.com.
/**
 * Hash router: `#/` (grid) and `#/<tool-id>` (tool view).
 * Tool code is lazy-loaded via dynamic import() so the initial payload
 * stays tiny; only the shell is precached by the service worker.
 *
 * Tool module contract (owned by tools/* builders):
 *   export async function mount(rootEl, ctx) -> cleanupFn | void
 *   ctx = { tool, createDropzone, checkFiles, activeCaps, baseUrl, download, isMobile }
 *   ctx.download(input, filename, mime): central local-only download helper
 *     (Blob/File/Uint8Array/ArrayBuffer/DataView/TypedArray/string -> Blob,
 *     default filename "output"). No network, no uploads.
 */
import { TOOLS, getTool, searchTools, categories, moduleCandidates } from './registry.js';
import { list as listRecents } from './recents.js';
import { escapeHtml, fmtBytes, download } from './utils.js';
import { createDropzone } from './dropzone.js';
import { checkFiles, activeCaps, isMobile } from './caps.js';

let cleanup = null;
function runCleanup() {
  try { cleanup?.(); } catch { /* ignore */ }
  cleanup = null;
}

// --- Home state (module-private; renderHome(view, query) signature unchanged) ---
let activeCat = 'All';
const ONBOARD_KEY = 'safedocs:onboarded';

/** Canonical category list: single source is registry categories(). */
function allCats() {
  return ['All', ...categories()];
}

/**
 * Resolve a header chip value (legacy data-q / data-cat / label) to a
 * canonical category name. Case-insensitive; 'zip' is an alias of 'Files'.
 * Returns 'All' for empty values, null when unresolvable.
 */
function resolveCat(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s || s === 'all') return 'All';
  if (s === 'zip') return 'Files';
  const cats = allCats();
  const hit = cats.find((c) => c.toLowerCase() === s);
  return hit || null;
}

/**
 * M1+M4: if a header nav (header .chip[data-q]) exists, wire it to the same
 * activeCat filter as the in-view [data-cat] chips and keep aria-pressed
 * in sync. No-op when the header nav was removed (single-source in-view
 * chips remain the filter UI). Never throws.
 */
function syncHeaderChips(view) {
  try {
    const headerChips = document.querySelectorAll('header .chip[data-q], .chips .chip[data-q], header [data-cat]');
    if (!headerChips.length) return;
    headerChips.forEach((btn) => {
      const target = resolveCat(btn.dataset.cat ?? btn.dataset.q ?? btn.textContent);
      if (target) btn.dataset.cat = target;
      const isActive = target === activeCat;
      btn.setAttribute('aria-pressed', String(isActive));
      btn.classList.toggle('is-active', isActive);
      if (!btn.dataset.wired) {
        btn.dataset.wired = '1';
        btn.addEventListener('click', () => {
          const next = resolveCat(btn.dataset.cat ?? btn.dataset.q ?? btn.textContent);
          if (!next) return;
          activeCat = next;
          if ((location.hash || '#/') !== '#/') location.hash = '#/';
          else renderHome(view, document.getElementById('search')?.value || '');
        });
      }
    });
  } catch { /* ignore */ }
}

function isOnboarded() {
  try {
    if (typeof localStorage === 'undefined') return true;
    return localStorage.getItem(ONBOARD_KEY) === '1';
  } catch {
    return false;
  }
}

/** Read-only use of core/recents.js: list() only, mapped to known tools. Never throws. */
function getRecentTools() {
  try {
    const entries = listRecents();
    if (!Array.isArray(entries)) return [];
    const seen = new Set();
    const out = [];
    for (const e of entries) {
      const id = e?.id;
      if (typeof id !== 'string' || !id || seen.has(id)) continue;
      seen.add(id);
      const t = getTool(id);
      if (t) out.push(t);
    }
    return out;
  } catch {
    return [];
  }
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
  const cats = allCats();
  if (!cats.includes(activeCat)) activeCat = 'All';
  const tools = searchTools(query);
  const filtered = activeCat === 'All' ? tools : tools.filter((t) => t.cat === activeCat);
  const recentTools = getRecentTools();
  const showOnboard = !isOnboarded();

  const chips = cats.map((c) => `
    <button type="button" class="pill ${c === activeCat ? 'blue' : 'grey'}" style="border:0;cursor:pointer"
      data-cat="${escapeHtml(c)}" aria-pressed="${c === activeCat}">${escapeHtml(c)}</button>`).join('');

  const cards = filtered.map((t) => `
    <a class="card" href="#/${t.id}">
      <span class="cat">${escapeHtml(t.cat)}</span>
      <h3>${escapeHtml(t.name)}</h3>
      <p>${escapeHtml(t.desc)}</p>
    </a>`).join('');

  const recents = recentTools.length ? `
    <section class="card" id="home-recents" aria-label="Recently used">
      <h3 style="margin:0 0 8px">Recently used</h3>
      <div class="btnrow" style="margin-top:0">${recentTools.map((t) => `
        <a class="btn secondary" href="#/${t.id}">${escapeHtml(t.name)}</a>`).join('')}</div>
    </section>` : '';

  view.innerHTML = `
    ${showOnboard ? `
    <section class="card" id="home-onboard" aria-label="Welcome">
      <h2 style="margin:0">Private by design 🔒</h2>
      <p class="muted" style="margin:8px 0 0">1-minute tour — everything below runs in your browser:</p>
      <ul style="margin:8px 0 0;padding-left:20px;font-size:14px">
        <li>Files never leave this device — airplane mode still works.</li>
        <li>Pick a category or search to find a tool.</li>
        <li>Recents remember tool names only, never your files.</li>
      </ul>
      <div class="btnrow"><button type="button" id="onboard-dismiss">Got it</button></div>
    </section>` : ''}
    <section class="card">
      <h2 style="margin:0">Toolbox <span class="muted">· ${TOOLS.length} tools</span></h2>
      <p class="muted" style="margin:8px 0 0">Everything runs in your browser. Turn on airplane mode — it still works.</p>
    </section>
    ${recents}
    <div class="btnrow" role="group" aria-label="Filter by category">${chips}</div>
    <div class="tool-grid">${cards}</div>
    ${filtered.length === 0 ? '<p class="empty">No tools match. Try “pdf”, “image”, “zip”…</p>' : ''}`;

  view.querySelectorAll('[data-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCat = resolveCat(btn.dataset.cat) || 'All';
      renderHome(view, document.getElementById('search')?.value || '');
    });
  });

  view.querySelector('#onboard-dismiss')?.addEventListener('click', () => {
    try { localStorage.setItem(ONBOARD_KEY, '1'); } catch { /* private-mode: session-only dismiss */ }
    view.querySelector('#home-onboard')?.remove();
  });

  // M1+M4: keep header chips (if present) on the same canonical filter.
  syncHeaderChips(view);
  // M2: no dead batch/preview slots on home — per-tool dropzones own their
  // meter + thumbnails, so there is nothing to listen for here.
  cleanup = null;
}

/** Shell mount contract: mount(rootEl, ctx) -> cleanup. Home-only entry. */
export function mount(rootEl, ctx = {}) {
  renderHome(rootEl, ctx.query ?? document.getElementById('search')?.value ?? '');
  return () => runCleanup();
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
    download,
    isMobile,
  };
  try {
    const maybeCleanup = await mod.mount(root, ctx);
    if (typeof maybeCleanup === 'function') cleanup = maybeCleanup;
  } catch (e) {
    root.innerHTML = `<div class="warnbox"><strong>Tool failed to start:</strong> ${escapeHtml(e?.message || e)}</div>`;
  }
}
