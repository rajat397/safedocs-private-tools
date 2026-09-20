// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/ocr-layer.js — image/PDF → searchable PDF (OCR text layer). Client-side only. (P2 shell UI.)
//
// 100% on-device: the image/PDF never uploads. The ONLY network GETs are the
// pinned libs + tesseract traineddata (eng+hin), fetched once then cached.
// Static-only: no registry edits, no new CDN pins — reuses vendor/cdn-pins.js:
//   tesseract.js@7 (same pin as tools/ocr), pdf-lib@1.17.1 (same as tools/pdf),
//   pdf.js@3.11.174 (same as tools/pdf, used to rasterize PDF pages for OCR).
//
// How the invisible layer works: pdf-lib has no `renderText` / Tr operator,
// so the searchable-but-invisible equivalent is drawText with opacity: 0 —
// real selectable text painted exactly over the source image pixels.
// NOTE: pdf-lib StandardFonts.Helvetica only encodes WinAnsi (Latin). Hindi
// (Devanagari) words have no WinAnsi glyphs, so they are skipped in the text
// layer (counted + reported) instead of throwing. English stays fully
// searchable; no custom-font fetch is added (that would need a new pin).
// Contract: export function mount(el, ctx) -> cleanup function

import { shell } from '../_lib/page.js';

// --- Pinned deps (mirrors vendor/cdn-pins.js + tools/ocr/index.js — no new pins)
export const TESSERACT_PIN = '7';
export const TESSERACT_ESM = [
  'https://cdn.jsdelivr.net/npm/tesseract.js@7/dist/tesseract.esm.min.js',
  'https://unpkg.com/tesseract.js@7/dist/tesseract.esm.min.js',
];
export const PDF_LIB_PIN = '1.17.1';
export const PDF_LIB_ESM = 'https://esm.sh/pdf-lib@1.17.1';
export const PDF_LIB_UMD = [
  'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
  'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
];
export const PDFJS_PIN = '3.11.174';
export const PDFJS_UMD = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
];
export const PDFJS_WORKER = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
];

export const DEFAULT_LANGS = ['eng', 'hin'];
export const OEM_LSTM = 1;
export const MAX_PAGES = 100;

export function normalizeLangs(langs) {
  const list = (Array.isArray(langs) ? langs : String(langs || '').split('+'))
    .map(s => String(s).trim().toLowerCase())
    .filter(s => /^[a-z]{3}$/.test(s));
  const uniq = [...new Set(list)];
  return uniq.length ? uniq : [...DEFAULT_LANGS];
}

export function langsKey(langs) {
  return normalizeLangs(langs).sort().join('+');
}

// Helvetica/WinAnsi can only encode U+0009/000A/000D + U+0020..U+00FF.
// Strip the rest so drawText never throws; '' means "word not embeddable".
export function sanitizeWinAnsi(s) {
  return String(s ?? '').replace(/[^\x09\x0a\x0d\x20-\xff]/g, '');
}

// Map a tesseract word bbox (raster px, top-left origin) to PDF points.
// Page convention (same as images-to-pdf.js): 1 raster px = 1 pt, y flipped.
export function mapWordToPdf(word, pageH) {
  const b = word?.bbox || {};
  const x0 = +b.x0 || 0;
  const y0 = +b.y0 || 0;
  const y1 = b.y1 != null ? +b.y1 : y0;
  const h = Math.max(1, y1 - y0);
  const size = Math.min(48, Math.max(4, h * 0.9));
  return { x: x0, y: Math.max(0, pageH - y1), size, text: String(word?.text ?? '') };
}

let _tessMod = null;
let _worker = null;
let _workerKey = '';
let _workerInflight = null;

export async function loadTesseractModule(onLog) {
  if (_tessMod) return _tessMod;
  let lastErr = null;
  for (const url of TESSERACT_ESM) {
    try {
      onLog && onLog('loading ocr engine…');
      _tessMod = await import(/* @vite-ignore */url);
      if (_tessMod && _tessMod.createWorker) return _tessMod;
      _tessMod = null;
    } catch (e) { lastErr = e; }
  }
  throw new Error('Could not load tesseract.js@7 from CDN (check network). ' + (lastErr?.message || ''));
}

// Singleton worker per langs key: eng+hin traineddata GET happens once,
// then cacheMethod:'write' serves it from cache (same as tools/ocr).
export async function ensureWorker(langs, { onProgress, onLog } = {}) {
  const key = langsKey(langs);
  if (_worker && _workerKey === key) return _worker;
  if (_workerInflight && _workerKey === key) return _workerInflight;
  if (_worker) { try { await _worker.terminate(); } catch {} _worker = null; }
  _workerKey = key;
  _workerInflight = (async () => {
    const T = await loadTesseractModule(onLog);
    const worker = await T.createWorker(key.split('+'), OEM_LSTM, {
      cacheMethod: 'write',
      logger: m => {
        const p = (m && typeof m.progress === 'number')
          ? { status: String(m.status || ''), progress: Math.min(1, Math.max(0, m.progress)) }
          : { status: String((m && m.status) || ''), progress: null };
        onProgress && onProgress(p);
      },
    });
    _worker = worker;
    _workerInflight = null;
    return worker;
  })().catch(e => { _workerInflight = null; _workerKey = ''; throw e; });
  return _workerInflight;
}

export async function loadPdfLib() {
  if (globalThis.PDFLib) return globalThis.PDFLib;
  try {
    const m = await import(/* @vite-ignore */PDF_LIB_ESM);
    const lib = m.default ?? m;
    if (lib?.PDFDocument) { globalThis.PDFLib = lib; return lib; }
  } catch {}
  for (const src of PDF_LIB_UMD) {
    try {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = src; s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
      if (globalThis.PDFLib) return globalThis.PDFLib;
    } catch {}
  }
  throw new Error('Could not load pdf-lib@1.17.1 (check network).');
}

export async function loadPdfJs() {
  if (globalThis.pdfjsLib) return globalThis.pdfjsLib;
  for (const src of PDFJS_UMD) {
    try {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = src; s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
      if (globalThis.pdfjsLib) break;
    } catch {}
  }
  const lib = globalThis.pdfjsLib;
  if (!lib) throw new Error('Could not load pdf.js@3.11.174 (check network).');
  try {
    if (!lib.GlobalWorkerOptions?.workerSrc) {
      lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER[0];
    }
  } catch {}
  return lib;
}

// Image file → canvas at natural size (+ jpeg data URL for pdf-lib embed).
export async function fileToCanvas(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const bmp = await createImageBitmap(new Blob([buf], { type: file.type || 'image/png' }));
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  canvas.getContext('2d').drawImage(bmp, 0, 0);
  try { bmp.close(); } catch {}
  return { canvas, width: bmp.width, height: bmp.height };
}

// Rasterize one PDF page (pdf.js) at scale → canvas. 1 canvas px = 1 PDF pt.
export async function rasterizePdfPage(pdf, pageNum, scale) {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  try { page.cleanup(); } catch {}
  return { canvas, width: canvas.width, height: canvas.height };
}

// OCR one raster + embed: full-bleed image + invisible (opacity 0) word layer.
// Returns { words, embedded, skipped } for status reporting.
export async function addOcrPage(doc, canvas, data, font) {
  const W = canvas.width;
  const H = canvas.height;
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  const img = await doc.embedJpg(dataUrl);
  const page = doc.addPage([W, H]);
  page.drawImage(img, { x: 0, y: 0, width: W, height: H });
  const words = Array.isArray(data?.words) ? data.words : [];
  let embedded = 0;
  let skipped = 0;
  for (const w of words) {
    const text = String(w?.text ?? '').trim();
    if (!text) continue;
    const safe = sanitizeWinAnsi(text);
    if (!safe) { skipped += 1; continue; } // non-Latin glyphs (e.g. Devanagari)
    const m = mapWordToPdf(w, H);
    try {
      page.drawText(safe, {
        x: m.x, y: m.y, size: m.size, font,
        opacity: 0, // invisible but selectable/searchable
      });
      embedded += 1;
    } catch { skipped += 1; }
  }
  return { words: words.length, embedded, skipped };
}

export async function mount(el, ctx = {}) {
  const tool = (ctx && ctx.tool) || {};
  const page = shell(el, tool, ctx);
  const status = page.status;
  const setProgress = page.setProgress;
  const q = s => page.root.querySelector(`[data-f="${s}"]`);

  page.optionsEl.innerHTML = `
    <p class="muted" style="font-size:12px;margin:4px 0">100% on-device. Drop an image or PDF —
      OCR runs locally (eng+hin pack downloads once, then cached) and the output PDF keeps the
      original look with an invisible searchable text layer. Devanagari words can't embed in
      Helvetica/WinAnsi and are counted, not embedded.</p>
    <label>Languages
      <select data-f="langs">
        <option value="eng+hin" selected>English + Hindi</option>
        <option value="eng">English only</option>
        <option value="hin">Hindi only</option>
      </select>
    </label>
    <label>PDF raster scale (PDF input only)
      <select data-f="scale">
        <option value="1.5">1.5x — faster</option>
        <option value="2" selected>2x — balanced</option>
        <option value="3">3x — best accuracy</option>
      </select>
    </label>`;

  let files = [];
  page.onFiles(accepted => { files = [...accepted]; });

  function checkCaps(list, opts) {
    try {
      if (typeof ctx.checkFiles === 'function') {
        const r = ctx.checkFiles(list, opts);
        if (r?.rejected?.length) {
          status('Rejected: ' + r.rejected.map(x => `${x.file?.name || 'file'}: ${x.reason}`).join(' | '));
        }
        return r;
      }
    } catch {}
    return null;
  }
  function saveBytes(bytes, filename, mime = 'application/pdf') {
    return ctx.download(bytes, filename, mime);
  }

  page.runBtn('OCR & download searchable PDF', async got => {
    try {
      files = [...(got || [])];
      if (!files.length) { status('Drop an image or PDF first.'); return; }
      const chk = checkCaps(files, {
        toolId: 'ocr-layer',
        accept: 'image/*,.jpg,.jpeg,.png,.webp,.pdf,application/pdf',
        multiple: false,
      });
      let useFiles = files;
      if (chk) {
        if (chk.accepted?.length) useFiles = chk.accepted;
        else return;
      }
      const f = useFiles[0];
      const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '');
      const langs = q('langs').value || 'eng+hin';
      const scale = Math.min(3, Math.max(1, parseFloat(q('scale').value) || 2));

      status('Loading OCR engine / lang pack (once, then cached)…');
      const worker = ctx.worker || await ensureWorker(langs, {
        onLog: m => (ctx.log || console.log)('[ocr-layer]', m),
        onProgress: p => { if (p?.progress != null) setProgress(p.progress * 0.2); },
      });
      status('Loading pdf-lib…');
      const { PDFDocument, StandardFonts } = await loadPdfLib();
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);

      // Collect rasters: images → 1 canvas; PDFs → 1 canvas per page (pdf.js).
      let rasters = [];
      if (isPdf) {
        status('Loading pdf.js (rasterize PDF pages)…');
        const pdfjs = ctx.pdfjsLib || await loadPdfJs();
        const buf = await f.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
        if (pdf.numPages > MAX_PAGES) {
          throw new Error(`Page-count guard: ${pdf.numPages} pages (cap ${MAX_PAGES}). Split the PDF first.`);
        }
        try { ctx.activeCaps && ctx.activeCaps('pdf'); } catch {}
        for (let n = 1; n <= pdf.numPages; n++) {
          status(`Rasterizing page ${n}/${pdf.numPages}…`);
          rasters.push(await rasterizePdfPage(pdf, n, scale));
          setProgress(0.2 + (0.2 * n) / pdf.numPages);
        }
        try { await pdf.destroy(); } catch {}
      } else {
        try { ctx.activeCaps && ctx.activeCaps('ocr'); } catch {}
        status('Reading image…');
        rasters.push(await fileToCanvas(f));
      }

      let totalWords = 0;
      let totalEmbedded = 0;
      let totalSkipped = 0;
      for (let i = 0; i < rasters.length; i++) {
        status(`Recognizing ${isPdf ? `page ${i + 1}/${rasters.length}` : f.name} (eng+hin)…`);
        const { data } = await worker.recognize(rasters[i].canvas);
        const r = await addOcrPage(doc, rasters[i].canvas, data, font);
        totalWords += r.words;
        totalEmbedded += r.embedded;
        totalSkipped += r.skipped;
        rasters[i].canvas.width = 0; // free raster memory
        setProgress(0.4 + (0.6 * (i + 1)) / rasters.length);
      }
      rasters = [];

      const bytes = await doc.save({ useObjectStreams: true });
      const base = (f.name || 'scan').replace(/\.[^.]+$/, '') || 'scan';
      const pageCount = rasters.length;
      saveBytes(bytes, `${base}.searchable.pdf`, 'application/pdf');
      const skipNote = totalSkipped
        ? ` ${totalSkipped} non-Latin word(s) skipped (no WinAnsi glyphs).`
        : '';
      status(`Done — ${totalWords} word(s) OCR'd, ` +
        `${totalEmbedded} embedded invisibly on ${pageCount} page(s).${skipNote}`);
      setProgress(null);
    } catch (e) { setProgress(null); status('Error: ' + (e?.message || e)); }
  });

  return () => {
    files = [];
    // Keep the worker singleton alive (lang packs stay cached for next run).
    page.cleanup();
  };
}

export default { mount };
