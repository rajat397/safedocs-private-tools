// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/extract-images.js — save embedded JPEG/JPX images byte-for-byte. pdf-lib only, client-side.
import { shell } from '../_lib/page.js';

export async function mount(el, ctx = {}) {
  const tool = (ctx && ctx.tool) || { id: 'pdf-extract-images', accept: '.pdf,application/pdf', multiple: false };
  const TOOL_ID = tool.id || 'pdf-extract-images';
  const ACCEPT = tool.accept || '.pdf,application/pdf';
  const MAX_PAGES = 500;
  const MAX_DOWNLOADS = 100;
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
    <p class="muted" style="font-size:12px;margin:0">100% on-device. Extracts embedded
    <strong>JPEG (DCTDecode)</strong> and <strong>JPEG-2000 (JPXDecode)</strong> images byte-for-byte —
    no re-encoding, original quality. Other encodings (raw/Flate, masked, CCITT fax, JBIG2) are listed
    as skipped: use PDF → Images raster export for those. Each image downloads separately (your
    browser may ask permission for multiple downloads).</p>`;

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

  function saveBytes(bytes, filename, mime) {
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

  function nameText(v) {
    if (v == null) return '';
    if (typeof v === 'string') return v.replace(/^\/+/, '');
    try {
      const s = v.encodedName ?? (typeof v.toString === 'function' ? v.toString() : '');
      return String(s).replace(/^\/+/, '');
    } catch { return ''; }
  }

  page.runBtn('Extract & download', async (files, api) => {
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
    const context = doc.context;
    const seen = new Set();
    const found = [];
    const skipped = [];

    function xobjectDict(node) {
      try {
        const resRef = node.get(PDFName.of('Resources'));
        const res = resRef ? context.lookup(resRef) : null;
        if (!res || typeof res.get !== 'function') return null;
        const xoRef = res.get(PDFName.of('XObject'));
        const xo = xoRef ? context.lookup(xoRef) : null;
        return (xo && typeof xo.keys === 'function') ? xo : null;
      } catch { return null; }
    }

    function walk(xoDict, pageNum, depth) {
      if (!xoDict || depth > 3) return;
      let keys = [];
      try { keys = [...xoDict.keys()]; } catch { return; }
      for (const k of keys) {
        const label = nameText(k) || `img${found.length + skipped.length + 1}`;
        let obj = null;
        try { obj = context.lookup(xoDict.get(k)); } catch { continue; }
        if (!obj || typeof obj.get !== 'function') continue;
        let subtype = '';
        try { subtype = nameText(context.lookup(obj.get(PDFName.of('Subtype')))); } catch { continue; }
        if (subtype === 'Form') {
          // Form XObjects can nest their own image resources.
          try {
            const rres = context.lookup(obj.get(PDFName.of('Resources')));
            const nested = rres && typeof rres.get === 'function'
              ? context.lookup(rres.get(PDFName.of('XObject')))
              : null;
            if (nested && typeof nested.keys === 'function') walk(nested, pageNum, depth + 1);
          } catch { /* no nested resources */ }
          continue;
        }
        if (subtype !== 'Image') continue;
        if (seen.has(obj)) continue;
        seen.add(obj);
        let filters = [];
        try {
          const fraw = obj.get(PDFName.of('Filter'));
          const fres = fraw ? context.lookup(fraw) : null;
          if (fres) {
            if (typeof fres.size === 'function') {
              for (let i = 0; i < fres.size(); i++) {
                try { filters.push(nameText(context.lookup(fres.get(i)))); } catch { /* ignore */ }
              }
            } else {
              filters.push(nameText(fres));
            }
          }
        } catch { /* no filter entry */ }
        filters = filters.filter(Boolean);
        let contents = null;
        try {
          contents = obj.contents
            ?? (typeof obj.getContents === 'function' ? obj.getContents() : null);
        } catch { contents = null; }
        if (!contents || !contents.length) {
          skipped.push(`p${pageNum + 1}/${label}: empty stream`);
          continue;
        }
        const last = filters[filters.length - 1] || '';
        if (last === 'DCTDecode') {
          found.push({ page: pageNum, name: label, ext: 'jpg', mime: 'image/jpeg', bytes: contents });
        } else if (last === 'JPXDecode') {
          found.push({ page: pageNum, name: label, ext: 'jp2', mime: 'image/jp2', bytes: contents });
        } else {
          skipped.push(`p${pageNum + 1}/${label}: ${filters.length ? 'filter ' + filters.join('+') + ' (not directly extractable)' : 'raw pixels (no filter)'}`);
        }
      }
    }

    for (const idx of targets) {
      api.status(`Scanning page ${idx + 1}/${n}…`);
      try {
        const pg = doc.getPage(idx);
        const xo = xobjectDict(pg.node);
        if (xo) walk(xo, idx, 0);
      } catch { /* keep scanning other pages */ }
      await new Promise((r) => setTimeout(r, 0));
    }

    const base = file.name.replace(/\.pdf$/i, '').replace(/[^\w.-]+/g, '_');
    let done = 0;
    for (const img of found.slice(0, MAX_DOWNLOADS)) {
      const safe = String(img.name).replace(/[^\w.-]+/g, '_').slice(0, 40) || 'img';
      saveBytes(img.bytes, `${base}-p${img.page + 1}-${safe}.${img.ext}`, img.mime);
      done++;
      await new Promise((r) => setTimeout(r, 0));
    }
    try { q('pw').value = ''; } catch { /* ignore */ }
    const skipTxt = skipped.length
      ? ` Skipped ${skipped.length} non-JPEG image(s): ${skipped.slice(0, 5).join('; ')}${skipped.length > 5 ? '…' : ''}`
      : '';
    const capTxt = found.length > MAX_DOWNLOADS
      ? ` Download cap: first ${MAX_DOWNLOADS} of ${found.length} saved (re-run on page ranges for the rest).`
      : '';
    if (!done && !skipped.length) {
      api.status('Done — no embedded images found on the selected pages. (Vector drawings are not images.)');
    } else {
      api.status(`Done — extracted ${done} image(s) byte-for-byte (no re-encode).${skipTxt}${capTxt}`);
    }
  });

  return () => page.cleanup();
}
