// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/n-up.js — impose 2 or 4 source pages per output sheet. pdf-lib only, client-side.
import { shell } from '../_lib/page.js';

export async function mount(el, ctx = {}) {
  const tool = (ctx && ctx.tool) || { id: 'pdf-n-up', accept: '.pdf,application/pdf', multiple: false };
  const TOOL_ID = tool.id || 'pdf-n-up';
  const ACCEPT = tool.accept || '.pdf,application/pdf';
  const MAX_PAGES = 500;
  const page = shell(el, tool, ctx);

  page.optionsEl.innerHTML = `
    <label style="display:grid;gap:4px;font-size:13px;font-weight:600">Password (if encrypted)
      <input type="password" data-f="pw" placeholder="Optional" autocomplete="off"
        style="padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-weight:400" />
    </label>
    <label style="display:grid;gap:4px;font-size:13px;font-weight:600">Layout
      <select data-f="layout" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-weight:400">
        <option value="2" selected>2-up (2 pages per sheet, side by side)</option>
        <option value="4">4-up (4 pages per sheet, 2×2 grid)</option>
      </select>
    </label>
    <label style="display:grid;gap:4px;font-size:13px;font-weight:600">Pages (blank = all, e.g. 1,3,5-7)
      <input type="text" data-f="pages" placeholder="All pages"
        style="padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-weight:400" />
    </label>
    <p class="muted" style="font-size:12px;margin:0">100% on-device. Vector imposition: source pages
    are embedded (not rasterized), so text stays sharp. Each output sheet keeps the first selected
    page's size; source pages are scaled to fit their cell left-to-right, top-to-bottom. Interactive
    annotations and form fields on imposed pages may not carry over — flatten first if fidelity matters.</p>`;

  const q = (s) => page.optionsEl.querySelector(`[data-f="${s}"]`);

  function revalidate(files) {
    try {
      if (typeof ctx.checkFiles === 'function') {
        const r = ctx.checkFiles(files, { toolId: TOOL_ID, accept: ACCEPT, multiple: false });
        if (r && r.rejected && r.rejected.length) {
          page.status('Rejected: ' + r.rejected.map((x) => `${x.file?.name || 'file'}: ${x.reason}`).join(' | '));
        }
        if (r && r.accepted && r.accepted.length) return r.accepted[0];
        return null;
      }
    } catch { /* fall through to first file */ }
    return files[0] || null;
  }

  function saveBytes(bytes, filename, mime = 'application/pdf') {
    if (typeof ctx.download === 'function') return ctx.download(bytes, filename, mime);
    return page.addDownload(bytes, filename, `Download ${filename}`);
  }

  async function loadPdfLib() {
    if (globalThis.PDFLib) return globalThis.PDFLib;
    try {
      const m = await import('https://esm.sh/pdf-lib@1.17.1');
      const lib = m.default ?? m;
      if (lib?.PDFDocument) { globalThis.PDFLib = lib; return lib; }
    } catch { /* fall through to UMD */ }
    for (const src of [
      'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
      'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
    ]) {
      try {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = src; s.async = true; s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
        if (globalThis.PDFLib) return globalThis.PDFLib;
      } catch { /* try next */ }
    }
    throw new Error('Could not load pdf-lib@1.17.1 (check network).');
  }

  function assertPdfHeader(bytes) {
    if (!bytes || bytes.length < 5 || bytes[0] !== 0x25 || bytes[1] !== 0x50
      || bytes[2] !== 0x44 || bytes[3] !== 0x46 || bytes[4] !== 0x2D) {
      throw new Error('Not a PDF (missing %PDF header).');
    }
  }

  function parsePages(str, n) {
    str = (str || '').trim();
    if (!str) return null; // null = all pages
    const out = [];
    for (const part of str.split(',')) {
      const t = part.trim();
      if (!t) continue;
      const m = t.match(/^(\d+)\s*-\s*(\d+)$/);
      if (m) {
        const lo = Math.min(+m[1], +m[2]); const hi = Math.max(+m[1], +m[2]);
        for (let p = lo; p <= hi; p++) {
          if (p < 1 || p > n) throw new Error(`Page ${p} out of range (1–${n}).`);
          if (!out.includes(p - 1)) out.push(p - 1);
        }
      } else if (/^\d+$/.test(t)) {
        const p = +t;
        if (p < 1 || p > n) throw new Error(`Page ${p} out of range (1–${n}).`);
        if (!out.includes(p - 1)) out.push(p - 1);
      } else {
        throw new Error(`Bad token "${t}" (use e.g. 1,3,5-7).`);
      }
    }
    if (!out.length) throw new Error('No valid pages in selection.');
    out.sort((a, b) => a - b);
    return out;
  }

  page.runBtn('Impose & download', async (files, api) => {
    const file = revalidate(files);
    if (!file) { api.status('Pick a PDF first.'); return; }
    const perSheet = parseInt(q('layout').value, 10);
    if (![2, 4].includes(perSheet)) throw new Error('Pick a 2-up or 4-up layout.');
    const cols = 2;
    const rows = perSheet === 2 ? 1 : 2;
    api.status('Loading pdf-lib…');
    const { PDFDocument } = await loadPdfLib();
    const bytes0 = new Uint8Array(await file.arrayBuffer());
    assertPdfHeader(bytes0);
    const pw = (q('pw') && q('pw').value) || '';
    let src;
    try {
      src = await PDFDocument.load(bytes0, pw ? { password: pw } : {});
    } catch (e) {
      const msg = String((e && e.message) || e);
      if ((e && e.name === 'PasswordNeededException') || /password|encrypted|PasswordNeeded/i.test(msg)) {
        throw new Error(pw ? 'Encrypted PDF needs the correct password: ' + msg : 'This PDF is encrypted — enter its password and try again.');
      }
      throw e;
    }
    const n = src.getPageCount();
    if (n > MAX_PAGES) throw new Error(`Page-count guard: PDF has ${n} pages (cap ${MAX_PAGES}).`);
    const order = parsePages(q('pages').value, n) ?? src.getPageIndices();
    if (order.length < 2) throw new Error('N-up needs at least 2 pages (select more or use the whole file).');
    const firstSize = src.getPage(order[0]).getSize();
    const W = firstSize.width; const H = firstSize.height;
    if (!Number.isFinite(W) || !Number.isFinite(H) || W <= 0 || H <= 0) {
      throw new Error('Unreadable page size on the first selected page.');
    }
    const cellW = W / cols; const cellH = H / rows;
    const out = await PDFDocument.create();
    const sheets = Math.ceil(order.length / perSheet);
    for (let s = 0; s < sheets; s++) {
      api.status(`Imposing sheet ${s + 1}/${sheets}…`);
      api.setProgress(s / sheets);
      const chunk = order.slice(s * perSheet, (s + 1) * perSheet);
      // Embed per chunk (not the whole file at once) to bound memory.
      const embedded = await out.embedPages(chunk.map((i) => src.getPage(i)));
      const sheet = out.addPage([W, H]);
      embedded.forEach((emb, k) => {
        const col = k % cols;
        const row = Math.floor(k / cols);
        const scale = Math.min(cellW / emb.width, cellH / emb.height);
        const dw = emb.width * scale; const dh = emb.height * scale;
        const x = col * cellW + (cellW - dw) / 2;
        const y = H - (row + 1) * cellH + (cellH - dh) / 2;
        sheet.drawPage(emb, { x, y, width: dw, height: dh });
      });
      await new Promise((r) => setTimeout(r, 0));
    }
    const bytes = await out.save({ useObjectStreams: true });
    assertPdfHeader(bytes);
    saveBytes(bytes, file.name.replace(/\.pdf$/i, '') + `-${perSheet}up.pdf`, 'application/pdf');
    try { q('pw').value = ''; } catch { /* ignore */ }
    api.status(`Done — imposed ${order.length} page(s) onto ${sheets} sheet(s) (${perSheet}-up, sheet size ${W.toFixed(0)}×${H.toFixed(0)}pt). Vector output; annotations on imposed pages may not carry over.`);
  });

  return () => page.cleanup();
}
