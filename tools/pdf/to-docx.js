// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/to-docx.js — PDF → Word (.docx). Extract text via pdf.js getTextContent
// per page, rebuild as docx via docx@8 (lazy esm.sh: Document, Paragraph,
// TextRun). Simple fallback table detection. Static-only, 100% client-side.
import { shell } from '../_lib/page.js';

export async function mount(el, ctx = {}) {
  const tool = (ctx && ctx.tool) || {};
  const page = shell(el, tool, ctx);
  const status = page.status;
  const setProgress = page.setProgress;
  const q = (s) => page.root.querySelector(`[data-f="${s}"]`);
  const TOOL_ID = (ctx && ctx.tool && ctx.tool.id) || 'pdf-to-docx';

  page.optionsEl.innerHTML = `
    <label>Password (if encrypted)
      <input type="password" data-f="pw" placeholder="Optional" />
    </label>
    <label style="display:flex;gap:8px;align-items:center">
      <input type="checkbox" data-f="tables" checked style="width:auto" />
      Detect simple tables (aligned columns → Word table)
    </label>
    <label style="display:flex;gap:8px;align-items:center">
      <input type="checkbox" data-f="pagebreaks" checked style="width:auto" />
      Page break between PDF pages
    </label>
    <p class="muted" style="margin:0;font-size:12px">Rebuilds selectable text into an editable .docx. Layout, fonts, images and complex tables are approximate — scanned pages with no text layer are skipped (no OCR).</p>`;

  let files = [];
  page.onFiles((accepted) => { files = [...accepted]; });
  let pdfDoc = null;

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

  function saveDocx(blob, filename) {
    const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (typeof ctx.download === 'function') return ctx.download(blob, filename, mime);
    return page.addDownload(blob, filename, `Download ${filename}`);
  }

  async function loadPdfJs() {
    if (globalThis.pdfjsLib) return globalThis.pdfjsLib;
    for (const src of [
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
    ]) {
      try {
        await new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
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
    if (!bytes || bytes.length < 5 || bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46 || bytes[4] !== 0x2D) throw new Error('Not a PDF (missing %PDF header)');
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

  async function loadDocxLib() {
    // Pinned lazy ESM: docx v8 API (Document, Paragraph, TextRun, Packer).
    // eslint-disable-next-line no-await-in-loop
    for (const src of [
      'https://esm.sh/docx@8.5.0',
      'https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.mjs',
    ]) {
      try {
        const m = await import(/* @vite-ignore */ src);
        const lib = (m && m.default && m.default.Document) ? { ...m.default, ...m } : m;
        if (lib && lib.Document && lib.Paragraph && lib.TextRun && lib.Packer) return lib;
      } catch { /* try next CDN */ }
    }
    throw new Error('Could not load docx@8 (check network — esm.sh / jsdelivr).');
  }

  // Group pdf.js text items into visual rows (tolerant Y bucket), each row
  // sorted left→right. Returns [{ y, cells: [{x, str, w}] }].
  function rowsFromItems(items) {
    const rows = [];
    const Y_TOL = 3;
    for (const it of (items || [])) {
      const s = typeof it.str === 'string' ? it.str : '';
      if (!s || !s.trim()) continue;
      const t = it.transform || [];
      const x = Number(t[4]) || 0;
      const y = Number(t[5]) || 0;
      const w = Number(it.width) || Math.max(s.length * 5, 1);
      let row = null;
      for (const r of rows) {
        if (Math.abs(r.y - y) <= Y_TOL) { row = r; break; }
      }
      if (!row) { row = { y, cells: [] }; rows.push(row); }
      row.cells.push({ x, str: s, w });
    }
    // PDF y grows upward → sort rows top-first.
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows) r.cells.sort((a, b) => a.x - b.x);
    return rows;
  }

  // Split one row into columns at large horizontal gaps.
  // Returns array of column strings.
  function splitRowColumns(row) {
    if (!row.cells.length) return [];
    const cols = [];
    let cur = row.cells[0].str;
    for (let i = 1; i < row.cells.length; i++) {
      const prev = row.cells[i - 1];
      const cur_ = row.cells[i];
      const prevEnd = prev.x + prev.w;
      const gap = cur_.x - prevEnd;
      // Also split when items are adjacent but pdf.js split words oddly:
      // only treat as same column when gap is small/negative.
      if (gap > 12 && !cur.endsWith(' ') && !cur_.str.startsWith(' ')) {
        // Large visual gap → new column.
        cols.push(cur.replace(/[ \t]+/g, ' ').trim());
        cur = cur_.str;
      } else {
        cur += (cur.endsWith(' ') || cur_.str.startsWith(' ') ? '' : ' ') + cur_.str;
      }
    }
    cols.push(cur.replace(/[ \t]+/g, ' ').trim());
    return cols.filter((c) => c.length > 0);
  }

  page.runBtn('Convert to .docx', async (got) => {
    try {
      files = [...(got || [])];
      const f = files[0];
      if (!f) { status('Pick a PDF.'); return; }
      const chk = checkCaps([f], { toolId: TOOL_ID, accept: '.pdf,application/pdf', multiple: false });
      const file = (chk && chk.accepted && chk.accepted.length) ? chk.accepted[0] : f;
      if (chk && chk.accepted && !chk.accepted.length) return;

      status('Loading pdf.js…');
      const pdfjsLib = await loadPdfJs();
      const data = new Uint8Array(await file.arrayBuffer());
      try { if (pdfDoc && typeof pdfDoc.destroy === 'function') await pdfDoc.destroy(); } catch { /* ignore */ }
      pdfDoc = null;
      const pdf = await openPdfWithPassword(pdfjsLib, data, () => q('pw').value);
      pdfDoc = pdf;
      if (pdf.numPages > 200) throw new Error(`Page-count guard: PDF has ${pdf.numPages} pages (cap 200).`);
      const wantTables = !!q('tables').checked;
      const wantBreaks = !!q('pagebreaks').checked;

      // Pass 1 — extract per-page text rows (getTextContent per page).
      const pageRows = [];
      let emptyPages = 0;
      for (let n = 1; n <= pdf.numPages; n++) {
        status(`Reading page ${n}/${pdf.numPages}…`);
        const pg = await pdf.getPage(n);
        const tc = await pg.getTextContent();
        const rows = rowsFromItems(tc.items || []);
        if (!rows.length) emptyPages += 1;
        pageRows.push(rows);
        try { pg.cleanup(); } catch { /* ignore */ }
        setProgress((n / pdf.numPages) * 0.5);
      }

      const totalRows = pageRows.reduce((s, r) => s + r.length, 0);
      if (!totalRows) {
        status('No selectable text found — this looks like a scanned PDF (image-only pages). PDF → Word only rebuilds embedded text and does no OCR; try the on-device OCR tool first, then convert.');
        return;
      }

      status('Loading docx writer…');
      const { Document, Paragraph, TextRun, Packer, PageBreak, Table, TableRow, TableCell, WidthType } = await loadDocxLib();

      // Pass 2 — rows → docx children (Paragraphs + simple Table fallback).
      const children = [];
      const pushPara = (text, { heading = false } = {}) => {
        if (!text || !text.trim()) { children.push(new Paragraph({ text: '' })); return; }
        const t = text.replace(/[ \t]+/g, ' ').trim();
        // Heuristic heading: short line, mostly non-lowercase, no trailing period.
        const looksHeading = heading && t.length <= 120 && !/[.!?;:]$/.test(t);
        children.push(new Paragraph({
          heading: looksHeading ? 'Heading2' : undefined,
          children: [new TextRun({ text: t, bold: looksHeading || undefined, size: looksHeading ? 28 : undefined })],
          spacing: looksHeading ? { after: 160 } : { after: 120 },
        }));
      };

      for (let p = 0; p < pageRows.length; p++) {
        const rows = pageRows[p];
        const colLists = rows.map(splitRowColumns);
        // Fallback table detection: a run of ≥2 consecutive rows that each
        // split into the same column count ≥2 → one Word table.
        let i = 0;
        while (i < colLists.length) {
          const ncols = colLists[i].length;
          if (wantTables && Table && ncols >= 2) {
            let j = i + 1;
            while (j < colLists.length && colLists[j].length === ncols) j += 1;
            if (j - i >= 2) {
              const trows = [];
              for (let k = i; k < j; k++) {
                trows.push(new TableRow({
                  children: colLists[k].map((c) => new TableCell({
                    width: { size: Math.floor(100 / ncols), type: (WidthType && WidthType.PERCENTAGE) || 'pct' },
                    children: [new Paragraph({ children: [new TextRun({ text: c, size: 20 })] })],
                  })),
                }));
              }
              try {
                children.push(new Table({ rows: trows, width: { size: 100, type: (WidthType && WidthType.PERCENTAGE) || 'pct' } }));
              } catch {
                // Table ctor failed (API drift) → fall back to tabbed paragraphs.
                for (let k = i; k < j; k++) pushPara(colLists[k].join('\t'));
              }
              i = j;
              continue;
            }
          }
          // First row of a page often a title → heading hint (page 1 only).
          const isTitle = (p === 0 && i === 0);
          pushPara(colLists[i].join('  '), { heading: isTitle });
          i += 1;
        }
        if (wantBreaks && PageBreak && p < pageRows.length - 1) {
          children.push(new Paragraph({ children: [new PageBreak()] }));
        }
        setProgress(0.5 + ((p + 1) / pageRows.length) * 0.4);
      }

      status('Packing .docx…');
      const doc = new Document({ sections: [{ children }] });
      const blob = await Packer.toBlob(doc);
      const outName = (file.name || 'document.pdf').replace(/\.pdf$/i, '') + '.docx';
      saveDocx(blob, outName || 'document.docx');
      try { q('pw').value = ''; } catch { /* ignore */ }
      setProgress(1);
      const warn = emptyPages ? ` (${emptyPages} page(s) had no selectable text — skipped, likely scans.)` : '';
      status(`Done — ${outName} from ${pdf.numPages} page(s). Approximate layout; verify before sharing. (100% client-side)${warn}`);
    } catch (e) { status('Error: ' + (e?.message || e)); }
    finally { try { q('pw').value = ''; } catch { /* ignore */ } }
  });

  return () => {
    files = [];
    try { if (pdfDoc && typeof pdfDoc.destroy === 'function') pdfDoc.destroy(); } catch { /* ignore */ }
    pdfDoc = null;
    try { q('pw').value = ''; } catch { /* ignore */ }
    page.cleanup();
  };
}
