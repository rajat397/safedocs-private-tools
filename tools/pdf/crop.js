// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/crop.js — trim page margins via CropBox (vector, reversible). pdf-lib only, client-side.
import { shell } from '../_lib/page.js';

export async function mount(el, ctx = {}) {
  const tool = (ctx && ctx.tool) || { id: 'pdf-crop', accept: '.pdf,application/pdf', multiple: false };
  const TOOL_ID = tool.id || 'pdf-crop';
  const ACCEPT = tool.accept || '.pdf,application/pdf';
  const MAX_PAGES = 500;
  const page = shell(el, tool, ctx);

  page.optionsEl.innerHTML = `
    <label style="display:grid;gap:4px;font-size:13px;font-weight:600">Password (if encrypted)
      <input type="password" data-f="pw" placeholder="Optional" autocomplete="off"
        style="padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-weight:400" />
    </label>
    <fieldset style="display:grid;gap:8px;border:1px solid #e2e8f0;border-radius:8px;padding:10px;margin:0">
      <legend style="font-size:13px;font-weight:600;padding:0 4px">Margins to trim (PDF points, 72 = 1 inch)</legend>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <label style="display:grid;gap:4px;font-size:13px;font-weight:600">Top
          <input type="number" data-f="top" value="36" min="0" max="1000" step="1"
            style="padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-weight:400" />
        </label>
        <label style="display:grid;gap:4px;font-size:13px;font-weight:600">Bottom
          <input type="number" data-f="bottom" value="36" min="0" max="1000" step="1"
            style="padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-weight:400" />
        </label>
        <label style="display:grid;gap:4px;font-size:13px;font-weight:600">Left
          <input type="number" data-f="left" value="36" min="0" max="1000" step="1"
            style="padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-weight:400" />
        </label>
        <label style="display:grid;gap:4px;font-size:13px;font-weight:600">Right
          <input type="number" data-f="right" value="36" min="0" max="1000" step="1"
            style="padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-weight:400" />
        </label>
      </div>
    </fieldset>
    <label style="display:grid;gap:4px;font-size:13px;font-weight:600">Pages (blank = all, e.g. 1,3,5-7)
      <input type="text" data-f="pages" placeholder="All pages"
        style="padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-weight:400" />
    </label>
    <label style="display:flex;gap:8px;align-items:center;font-size:13px;font-weight:600">
      <input type="checkbox" data-f="reset" /> Remove existing crop instead (restore full page)
    </label>
    <p class="muted" style="font-size:12px;margin:0">100% on-device. Vector crop: sets the CropBox so
    viewers hide the trimmed margins — content is not deleted or rasterized and the crop can be
    removed later with the reset option. Some viewers print the full MediaBox regardless of CropBox.</p>`;

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
        let a = +m[1]; let b = +m[2];
        const lo = Math.min(a, b); const hi = Math.max(a, b);
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

  page.runBtn('Crop & download', async (files, api) => {
    const file = revalidate(files);
    if (!file) { api.status('Pick a PDF first.'); return; }
    const num = (key) => {
      const v = parseFloat(q(key).value);
      if (!Number.isFinite(v) || v < 0 || v > 1000) throw new Error(`Margin "${key}" must be 0–1000 pt.`);
      return v;
    };
    const margins = { top: num('top'), bottom: num('bottom'), left: num('left'), right: num('right') };
    const reset = !!q('reset').checked;
    api.status('Loading pdf-lib…');
    const { PDFDocument, PDFName } = await loadPdfLib();
    const bytes0 = new Uint8Array(await file.arrayBuffer());
    assertPdfHeader(bytes0);
    const pw = (q('pw') && q('pw').value) || '';
    let doc;
    try {
      doc = await PDFDocument.load(bytes0, pw ? { password: pw } : {});
    } catch (e) {
      const msg = String((e && e.message) || e);
      if ((e && e.name === 'PasswordNeededException') || /password|encrypted|PasswordNeeded/i.test(msg)) {
        throw new Error(pw ? 'Encrypted PDF needs the correct password: ' + msg : 'This PDF is encrypted — enter its password and try again.');
      }
      throw e;
    }
    const n = doc.getPageCount();
    if (n > MAX_PAGES) throw new Error(`Page-count guard: PDF has ${n} pages (cap ${MAX_PAGES}).`);
    const targets = parsePages(q('pages').value, n) ?? doc.getPageIndices();
    const cropKey = PDFName.of('CropBox');
    let touched = 0;
    for (const idx of targets) {
      const pg = doc.getPage(idx);
      if (reset) {
        try { pg.node.delete(cropKey); touched++; } catch { /* page without CropBox */ }
        continue;
      }
      // Base rect: prefer MediaBox, fall back to current size.
      let bx = 0; let by = 0; let bw = 0; let bh = 0;
      try {
        const mb = pg.getMediaBox();
        bx = mb.x ?? 0; by = mb.y ?? 0; bw = mb.width; bh = mb.height;
      } catch {
        const sz = pg.getSize();
        bw = sz.width; bh = sz.height;
      }
      if (!Number.isFinite(bw) || !Number.isFinite(bh) || bw <= 0 || bh <= 0) {
        throw new Error(`Page ${idx + 1}: unreadable page size — cannot crop.`);
      }
      const nw = bw - margins.left - margins.right;
      const nh = bh - margins.top - margins.bottom;
      if (nw <= 0 || nh <= 0) {
        throw new Error(`Page ${idx + 1}: margins (${margins.left + margins.right}×${margins.top + margins.bottom}pt) exceed page size ${bw.toFixed(0)}×${bh.toFixed(0)}pt.`);
      }
      const rect = doc.context.obj([bx + margins.left, by + margins.bottom, bx + margins.left + nw, by + margins.bottom + nh]);
      pg.node.set(cropKey, rect);
      touched++;
    }
    const out = await doc.save({ useObjectStreams: true });
    assertPdfHeader(out);
    saveBytes(out, file.name.replace(/\.pdf$/i, '') + (reset ? '-uncropped.pdf' : '-cropped.pdf'), 'application/pdf');
    try { q('pw').value = ''; } catch { /* ignore */ }
    const scope = touched === n ? 'all pages' : `pages ${targets.map((i) => i + 1).join(',')}`;
    api.status(reset
      ? `Done — removed CropBox on ${scope} (full MediaBox restored).`
      : `Done — cropped ${scope} by ${margins.left}/${margins.top}/${margins.right}/${margins.bottom}pt (L/T/R/B). Vector CropBox: content hidden, not deleted.`);
  });

  return () => page.cleanup();
}
