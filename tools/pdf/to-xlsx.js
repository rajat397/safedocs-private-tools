// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/to-xlsx.js — PDF to Excel (.xlsx): extract text/tables via pdf.js, build workbook via SheetJS. Static-only, no upload. (P2 shell UI.)
import { shell } from '../_lib/page.js';

const TOOL_ID = 'pdf-to-xlsx';
const XLSX_ESM = 'https://esm.sh/xlsx@0.18.5';
const MAX_PAGES = 500;

export async function mount(el, ctx = {}) {
  const tool = (ctx && ctx.tool) || {};
  const page = shell(el, tool, ctx);
  const status = page.status;
  const setProgress = page.setProgress;
  const q = (s) => page.root.querySelector(`[data-f="${s}"]`);

  page.optionsEl.innerHTML = `
    <label>Password (if encrypted)
      <input type="password" data-f="pw" placeholder="Optional" autocomplete="off" />
    </label>
    <label>Layout
      <select data-f="mode">
        <option value="table" selected>Detect tables (columns by spacing)</option>
        <option value="lines">One line per row (single column)</option>
      </select>
    </label>
    <label style="display:flex;gap:8px;align-items:center;flex-direction:row">
      <input type="checkbox" data-f="persheet" checked /> One sheet per page
    </label>
    <p class="muted" style="margin:0;font-size:12px">Reads the PDF&apos;s embedded (selectable) text via pdf.js — no OCR. Scanned pages with no text layer are skipped. Workbook is built on-device with SheetJS.</p>`;

  let files = [];
  page.onFiles((accepted) => { files = [...accepted]; });

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

  function saveXlsx(bytes, filename) {
    const blob = bytes instanceof Blob
      ? bytes
      : new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    if (typeof ctx.download === 'function') return ctx.download(blob, filename, blob.type);
    return page.addDownload(blob, filename, `Download ${filename}`);
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
          s.src = src; s.async = true; s.onload = res;
          s.onerror = () => rej(new Error('script failed: ' + src));
          document.head.appendChild(s);
        });
        if (globalThis.pdfjsLib) {
          globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          return globalThis.pdfjsLib;
        }
      } catch { /* try next CDN */ }
    }
    throw new Error('Could not load pdf.js (check network).');
  }

  async function loadXlsx() {
    const m = await import(/* @vite-ignore */XLSX_ESM);
    const XLSX = (m && m.default) ?? m;
    if (!XLSX?.utils?.aoa_to_sheet || !XLSX?.utils?.book_new || !XLSX?.utils?.book_append_sheet || typeof XLSX?.write !== 'function') {
      throw new Error('SheetJS failed to load (unexpected module shape).');
    }
    return XLSX;
  }

  function assertPdfHeader(bytes) {
    if (!bytes || bytes.length < 5 || bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46 || bytes[4] !== 0x2D) {
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

  // Group pdf.js text items into rows (by Y) then cells (by X gaps).
  function itemsToAoa(items, mode) {
    const rows = [];
    if (!items || !items.length) return rows;
    if (mode === 'lines') {
      // Reuse to-text style row grouping: break on Y change / EOL.
      let cur = [];
      let curY = null;
      const flush = () => {
        const line = cur.join('').replace(/[ \t]+/g, ' ').trim();
        if (line) rows.push([line]);
        cur = [];
      };
      const sorted = [...items].sort((a, b) => {
        const ay = a.transform?.[5] ?? 0; const by = b.transform?.[5] ?? 0;
        if (ay !== by) return by - ay; // top-down (PDF y grows upward)
        return (a.transform?.[4] ?? 0) - (b.transform?.[4] ?? 0);
      });
      for (const it of sorted) {
        const s = typeof it.str === 'string' ? it.str : '';
        const y = it.transform?.[5];
        if (curY !== null && typeof y === 'number' && Math.abs(y - curY) > 1 && cur.length) {
          flush();
          curY = y;
        } else if (curY === null && typeof y === 'number') {
          curY = y;
        }
        cur.push(s);
        if (it.hasEOL) { flush(); curY = null; }
      }
      if (cur.length) flush();
      return rows;
    }
    // Table mode: cluster into visual rows by Y tolerance, split cells by X gaps.
    const pts = [];
    for (const it of items) {
      const s = typeof it.str === 'string' ? it.str : '';
      if (!s || !s.trim()) continue;
      const t = it.transform || [];
      const x = Number(t[4]); const y = Number(t[5]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const w = Number(it.width) || 0;
      pts.push({ s, x, y, x1: x + w });
    }
    if (!pts.length) return rows;
    pts.sort((a, b) => (b.y - a.y) || (a.x - b.x));
    const Y_TOL = 3;
    const bands = [];
    for (const p of pts) {
      const band = bands.find((b) => Math.abs(b.y - p.y) <= Y_TOL);
      if (band) { band.items.push(p); band.y = (band.y * (band.items.length - 1) + p.y) / band.items.length; }
      else bands.push({ y: p.y, items: [p] });
    }
    bands.sort((a, b) => b.y - a.y);
    for (const band of bands) {
      const cells = band.items.sort((a, b) => a.x - b.x);
      // Gap-based cell splitting: large horizontal gaps start a new column.
      const gaps = [];
      for (let i = 1; i < cells.length; i++) gaps.push(cells[i].x - cells[i - 1].x1);
      const med = gaps.length ? [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)] : 0;
      const splitAt = Math.max(2 * (med || 0), 10);
      const row = [];
      let cur = '';
      for (let i = 0; i < cells.length; i++) {
        if (i > 0 && gaps[i - 1] > splitAt) { row.push(cur.trim()); cur = ''; }
        else if (i > 0) cur += ' ';
        cur += cells[i].s;
      }
      row.push(cur.trim());
      if (row.some((c) => c)) rows.push(row);
    }
    return rows;
  }

  function sanitizeSheetName(name) {
    const s = String(name || 'Sheet').replace(/[\\/?*[\]:]/g, '-').slice(0, 31) || 'Sheet';
    return s;
  }

  let pdfDoc = null;

  page.runBtn('Convert to .xlsx', async (got) => {
    try {
      files = [...(got || [])];
      const f = files[0];
      if (!f) { status('Pick a PDF.'); return; }
      const chk = checkCaps([f], { toolId: TOOL_ID, accept: '.pdf,application/pdf', multiple: false });
      const file = (chk && chk.accepted && chk.accepted.length) ? chk.accepted[0] : f;
      if (chk && chk.accepted && !chk.accepted.length) return;

      page.clearOutput();
      status('Loading pdf.js…');
      const pdfjsLib = await loadPdfJs();
      const data = new Uint8Array(await file.arrayBuffer());
      try { if (pdfDoc && typeof pdfDoc.destroy === 'function') await pdfDoc.destroy(); } catch { /* ignore */ }
      pdfDoc = null;
      const pdf = await openPdfWithPassword(pdfjsLib, data, () => q('pw').value);
      pdfDoc = pdf;
      if (pdf.numPages > MAX_PAGES) throw new Error(`Page-count guard: PDF has ${pdf.numPages} pages (cap ${MAX_PAGES}).`);
      if (pdf.numPages < 1) throw new Error('PDF has no pages.');

      const mode = q('mode')?.value === 'lines' ? 'lines' : 'table';
      const perSheet = q('persheet')?.checked !== false;

      status('Loading SheetJS…');
      const XLSX = await loadXlsx();

      const wb = XLSX.utils.book_new();
      let totalRows = 0;
      let usedSheets = 0;
      const seenNames = new Set();
      const uniqueName = (base) => {
        let n = sanitizeSheetName(base);
        let i = 2;
        while (seenNames.has(n)) n = sanitizeSheetName(`${base} (${i++})`);
        seenNames.add(n);
        return n;
      };

      const combined = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        status(`Extracting page ${n}/${pdf.numPages}…`);
        const pg = await pdf.getPage(n);
        const tc = await pg.getTextContent();
        const aoa = itemsToAoa(tc.items || [], mode);
        try { pg.cleanup(); } catch { /* ignore */ }
        setProgress(n / pdf.numPages);
        if (!aoa.length) continue; // image-only page: skip
        totalRows += aoa.length;
        if (perSheet) {
          const ws = XLSX.utils.aoa_to_sheet(aoa);
          ws['!cols'] = [{ wch: 40 }];
          XLSX.utils.book_append_sheet(wb, ws, uniqueName(`Page ${n}`));
          usedSheets++;
        } else {
          if (combined.length) combined.push([]);
          combined.push(...aoa);
        }
      }
      if (!perSheet && combined.length) {
        const ws = XLSX.utils.aoa_to_sheet(combined);
        ws['!cols'] = [{ wch: 40 }];
        XLSX.utils.book_append_sheet(wb, ws, uniqueName('Extract'));
        usedSheets++;
        totalRows = combined.length;
      }
      try { q('pw').value = ''; } catch { /* ignore */ }
      if (!usedSheets) {
        status('No selectable text found — this looks like a scanned PDF (image-only pages). Table extraction only reads embedded text and does no OCR; try the on-device OCR tool for scanned pages.');
        return;
      }
      const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const name = (file.name.replace(/\.pdf$/i, '') || 'converted') + '.xlsx';
      saveXlsx(out, name);
      status(`Done — ${totalRows.toLocaleString()} row(s) from ${pdf.numPages} page(s) → ${usedSheets} sheet(s) → ${name}. (100% client-side)`);
    } catch (e) {
      status('Error: ' + (e?.message || e));
    } finally {
      try { q('pw').value = ''; } catch { /* ignore */ }
    }
  });

  return () => {
    files = [];
    try { if (pdfDoc && typeof pdfDoc.destroy === 'function') pdfDoc.destroy(); } catch { /* ignore */ }
    pdfDoc = null;
    page.cleanup();
  };
}
