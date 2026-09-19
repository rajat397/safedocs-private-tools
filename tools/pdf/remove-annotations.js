// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/remove-annotations.js — strip the annotation layer (comments, links, markup). pdf-lib only.
import { shell } from '../_lib/page.js';

export async function mount(el, ctx = {}) {
  const tool = (ctx && ctx.tool) || { id: 'pdf-remove-annotations', accept: '.pdf,application/pdf', multiple: false };
  const TOOL_ID = tool.id || 'pdf-remove-annotations';
  const ACCEPT = tool.accept || '.pdf,application/pdf';
  const MAX_PAGES = 500;
  const page = shell(el, tool, ctx);

  page.optionsEl.innerHTML = `
    <label style="display:grid;gap:4px;font-size:13px;font-weight:600">Password (if encrypted)
      <input type="password" data-f="pw" placeholder="Optional" autocomplete="off"
        style="padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-weight:400" />
    </label>
    <label style="display:grid;gap:4px;font-size:13px;font-weight:600">Pages (blank = all, e.g. 1,3,5-7)
      <input type="text" data-f="pages" placeholder="All pages"
        style="padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-weight:400" />
    </label>
    <p class="muted" style="font-size:12px;margin:0">100% on-device. Removes the annotation layer —
    comments, sticky notes, highlight / underline markup, links, stamps and widget annotations on the
    selected pages. Page text and vector content are untouched. Not a redaction tool: annotations that
    were already flattened into page content stay, and info-dict / XMP metadata is unchanged (use
    Redact &amp; burn for burned-in regions, Scrub metadata for hidden data).</p>`;

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

  page.runBtn('Remove annotations & download', async (files, api) => {
    const file = revalidate(files);
    if (!file) { api.status('Pick a PDF first.'); return; }
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
    const annotsKey = PDFName.of('Annots');
    let removed = 0;
    let pagesWith = 0;
    for (const idx of targets) {
      const pg = doc.getPage(idx);
      let arr = null;
      try { arr = pg.node.get(annotsKey); } catch { arr = null; }
      if (!arr) continue;
      let count = 1;
      try {
        const resolved = doc.context.lookup(arr);
        if (resolved && typeof resolved.size === 'function') count = resolved.size();
      } catch { /* keep count = 1 */ }
      try { pg.node.delete(annotsKey); } catch { continue; }
      removed += count;
      pagesWith++;
    }
    const out = await doc.save({ useObjectStreams: true });
    assertPdfHeader(out);
    saveBytes(out, file.name.replace(/\.pdf$/i, '') + '-no-annots.pdf', 'application/pdf');
    try { q('pw').value = ''; } catch { /* ignore */ }
    if (!removed) {
      api.status('Done — no annotations found on the selected pages; file re-saved unchanged.');
    } else {
      api.status(`Done — removed ~${removed} annotation(s) from ${pagesWith} page(s). Page content kept; flattened-in markup and metadata unchanged.`);
    }
  });

  return () => page.cleanup();
}
