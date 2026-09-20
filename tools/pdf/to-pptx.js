// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/to-pptx.js — PDF → PPTX: rasterize pages via pdf.js to PNG, one full-slide image per page via pptxgenjs. Client-side only. (P2 shell UI.)
import { shell } from '../_lib/page.js';

export async function mount(el, ctx = {}) {
  const tool = (ctx && ctx.tool) || {};
  const page = shell(el, tool, ctx);
  const status = page.status;
  const setProgress = page.setProgress;
  const q = (s) => page.root.querySelector(`[data-f="${s}"]`);

  page.optionsEl.innerHTML = `
    <label>Password (if encrypted)
      <input type="password" data-f="pw" placeholder="Optional" />
    </label>
    <label>Render scale
      <select data-f="scale">
        <option value="1">1x</option>
        <option value="1.5">1.5x</option>
        <option value="2" selected>2x</option>
      </select>
    </label>
    <label>Pages
      <input data-f="pages" placeholder="all / 1-3" />
    </label>`;

  let files = [];
  page.onFiles((accepted) => { files = [...accepted]; });

  const liveCanvases = new Set();
  const MAX_PAGES = 50;

  function checkCaps(list, opts) {
    try {
      if (typeof ctx.checkFiles === 'function') {
        const r = ctx.checkFiles(list, opts);
        if (r && r.rejected && r.rejected.length) {
          status('Rejected: ' + r.rejected.map((x) => `${x.file?.name || 'file'}: ${x.reason}`).join(' | '));
        }
        return r;
      }
    } catch { /* ignore */ }
    return null;
  }

  function clampScale(s, fallback = 2) {
    s = parseFloat(s);
    if (!Number.isFinite(s)) return fallback;
    return Math.min(3, Math.max(0.5, s));
  }

  function parsePages(str, n, warnings = []) {
    str = (str || '').trim().toLowerCase();
    if (!str || str === 'all') return Array.from({ length: n }, (_, i) => i + 1);
    const out = [];
    for (const part of str.split(',')) {
      const t = part.trim();
      if (!t) continue;
      const m = t.match(/^(\d+)\s*-\s*(\d+)$/);
      if (m) {
        let a = +m[1]; let b = +m[2];
        if (a > b) [a, b] = [b, a];
        if (a > n || b < 1) { warnings.push(`Range "${t}" out of range (1–${n}) — skipped.`); continue; }
        const ca = Math.max(1, a); const cb = Math.min(n, b);
        if (ca !== a || cb !== b) warnings.push(`Range "${t}" truncated to ${ca}-${cb} (PDF has ${n} pages).`);
        for (let p = ca; p <= cb; p++) out.push(p);
      } else if (/^\d+$/.test(t)) {
        const v = +t;
        if (v >= 1 && v <= n) out.push(v);
        else warnings.push(`Page ${v} out of range (1–${n}) — skipped.`);
      } else {
        throw new Error(`Bad token "${t}"`);
      }
    }
    return [...new Set(out)];
  }

  async function loadPdfJs() {
    if (globalThis.pdfjsLib) return globalThis.pdfjsLib;
    for (const src of [
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
    ]) {
      try {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = src; s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
        if (globalThis.pdfjsLib) {
          globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          return globalThis.pdfjsLib;
        }
      } catch { /* try next CDN */ }
    }
    throw new Error('Could not load pdf.js');
  }

  function assertPdfHeader(bytes) {
    if (!bytes || bytes.length < 5 || bytes[0] !== 0x25 || bytes[1] !== 0x50 ||
        bytes[2] !== 0x44 || bytes[3] !== 0x46 || bytes[4] !== 0x2d) {
      throw new Error('Not a PDF (missing %PDF header)');
    }
  }

  async function openPdfWithPassword(pdfjsLib, data, getPassword) {
    assertPdfHeader(data);
    const pw = (getPassword && getPassword()) || '';
    try {
      const task = pdfjsLib.getDocument(pw ? { data: data.slice(), password: pw } : { data: data.slice() });
      return await task.promise;
    } catch (e) {
      if ((e && e.name === 'PasswordNeededException') || /password|encrypted/i.test(String((e && e.message) || e))) {
        if (!pw) throw new Error('This PDF is encrypted — enter its password and try again.');
        try {
          return await pdfjsLib.getDocument({ data: data.slice(), password: pw }).promise;
        } catch (e2) {
          if (e2 && e2.name === 'PasswordNeededException') throw new Error('Wrong password for this encrypted PDF.');
          throw new Error('Could not open encrypted PDF: ' + ((e2 && e2.message) || e2));
        }
      }
      throw e;
    }
  }

  async function loadPptxGen() {
    // Lazy ESM: pptxgenjs@3.12 only (pinned). Cached on window for repeat runs.
    if (globalThis.PptxGenJS) return globalThis.PptxGenJS;
    const m = await import(/* @vite-ignore */ 'https://esm.sh/pptxgenjs@3.12.0');
    const PptxGenJS = m.default ?? m.PptxGenJS ?? m;
    if (typeof PptxGenJS !== 'function') throw new Error('Could not load pptxgenjs@3.12');
    globalThis.PptxGenJS = PptxGenJS;
    return PptxGenJS;
  }

  page.runBtn('Convert & download', async (got) => {
    try {
      files = [...(got || [])];
      const f = files[0];
      if (!f) { status('Pick a PDF.'); return; }
      const chk = checkCaps([f], { toolId: 'pdf-to-pptx', accept: '.pdf,application/pdf', multiple: false });
      const file = (chk && chk.accepted && chk.accepted.length) ? chk.accepted[0] : f;
      if (chk && chk.accepted && !chk.accepted.length) return;

      status('Loading pdf.js…');
      const pdfjsLib = await loadPdfJs();
      const data = new Uint8Array(await file.arrayBuffer());
      const pdf = await openPdfWithPassword(pdfjsLib, data.slice(), () => { try { return q('pw').value; } catch { return ''; } });
      if (pdf.numPages > 200) throw new Error(`Page-count guard: PDF has ${pdf.numPages} pages (cap 200). Narrow the page range.`);

      const warnings = [];
      let pages = parsePages((() => { try { return q('pages').value; } catch { return ''; } })(), pdf.numPages, warnings);
      if (!pages.length) { status('No pages match (all out of range).' + (warnings.length ? ' ' + warnings.join(' ') : '')); return; }
      if (pages.length > MAX_PAGES) {
        warnings.push(`Clamped to first ${MAX_PAGES} of ${pages.length} requested pages (render guard).`);
        pages = pages.slice(0, MAX_PAGES);
      }

      status('Loading pptxgenjs…');
      const PptxGenJS = await loadPptxGen();
      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_WIDE';

      const scale = clampScale((() => { try { return q('scale').value; } catch { return '2'; } })(), 2);
      let done = 0;
      for (const n of pages) {
        status(`Rendering page ${n}/${pdf.numPages}…`);
        const pg = await pdf.getPage(n);
        const viewport = pg.getViewport({ scale });
        const canvas = document.createElement('canvas');
        liveCanvases.add(canvas);
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const c2d = canvas.getContext('2d');
        c2d.fillStyle = '#fff';
        c2d.fillRect(0, 0, canvas.width, canvas.height);
        await pg.render({ canvasContext: c2d, viewport }).promise;
        const pngData = canvas.toDataURL('image/png');
        canvas.width = 0; canvas.height = 0;
        liveCanvases.delete(canvas);

        const slide = pptx.addSlide();
        slide.addImage({ data: pngData, x: 0, y: 0, w: '100%', h: '100%' });
        done += 1;
        setProgress((done / pages.length) * 0.9);
      }

      status('Building .pptx…');
      const out = await pptx.write({ outputType: 'blob' });
      const blob = out instanceof Blob ? out : new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
      const base = (file.name || 'document').replace(/\.pdf$/i, '') || 'document';
      if (typeof ctx.download === 'function') {
        await ctx.download(blob, `${base}.pptx`, blob.type);
      } else {
        page.addDownload(blob, `${base}.pptx`, `Download ${base}.pptx`);
      }
      setProgress(1);
      try { q('pw').value = ''; } catch { /* ignore */ }
      const warnTxt = warnings.length ? ' Warnings: ' + warnings.join(' ') : '';
      status(`Done — ${pages.length} page(s) → PPTX (full-slide PNG per slide).${warnTxt}`);
    } catch (e) {
      status('Error: ' + (e?.message || e));
    }
  });

  return () => {
    files = [];
    try { liveCanvases.forEach((c) => { c.width = 0; c.height = 0; }); liveCanvases.clear(); } catch { /* ignore */ }
    try { q('pw').value = ''; } catch { /* ignore */ }
    page.cleanup();
  };
}
