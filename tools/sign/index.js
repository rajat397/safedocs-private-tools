// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/sign/index.js — draw signature (HiDPI, transparent PNG) + embed in PDF.
// Zero upload. Canvas stays transparent (no background fill). pdf-lib is lazy
// (same pin as tools/pdf: pdf-lib@1.17.1) and only loads on "Embed in PDF".
// Contract: export function mount(el, ctx) -> cleanup function

export const PDF_LIB_PIN = '1.17.1';

// HiDPI setup: backing store = cssSize * exact dpr, context scaled, transparent.
// NOTE: dpr is used EXACTLY (no Math.round on the ratio) so strokes map 1:1
// on fractional-DPR devices (1.5, 2.625, …). Only the integer backing-store
// dims are rounded, as canvas width/height must be ints.
export function setupHiDPI(canvas, { cssW = 520, cssH = 200 } = {}) {
  const raw = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  const dpr = Math.max(1, +raw || 1);
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const c = canvas.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = '#0f172a'; c.lineWidth = 2.2;
  return { ctx: c, dpr, cssW, cssH };
}

export function clearCanvas(canvas) {
  const c = canvas.getContext('2d');
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.restore();
}

export function isBlank(canvas) {
  const c = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  // sample alpha channel on a stride to stay fast on big HiDPI canvases
  const step = Math.max(1, Math.floor(Math.min(w, h) / 64));
  const px = c.getImageData(0, 0, w, h).data;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      if (px[(y * w + x) * 4 + 3] > 8) return false;
    }
  }
  return true;
}

export function canvasToPngBlob(canvas) {
  return new Promise((res, rej) => {
    canvas.toBlob(b => (b ? res(b) : rej(new Error('PNG encode failed'))), 'image/png');
  });
}

async function loadPdfLib() {
  if (globalThis.PDFLib) return globalThis.PDFLib;
  try {
    const m = await import(/* @vite-ignore */'https://esm.sh/pdf-lib@1.17.1');
    if (m && (m.PDFDocument || m.default?.PDFDocument)) {
      const lib = m.default ?? m;
      globalThis.PDFLib = lib;
      return lib;
    }
  } catch {}
  const urls = [
    'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
    'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
  ];
  for (const src of urls) {
    try {
      await loadScript(src);
      if (globalThis.PDFLib) return globalThis.PDFLib;
    } catch {}
  }
  throw new Error('Could not load pdf-lib@1.17.1 from CDN (check network).');
}
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = res; s.onerror = () => rej(new Error('script failed: ' + src));
    document.head.appendChild(s);
  });
}

// Minimal embed: PNG -> last page (or first), bottom-right, scaled to width.
export async function embedPngInPdf(pdfBytes, pngBytes, { pageIndex = -1, width = 160, x, y, margin = 36 } = {}) {
  const { PDFDocument } = await loadPdfLib();
  const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const png = await pdf.embedPng(pngBytes);
  const pages = pdf.getPages();
  if (!pages.length) throw new Error('PDF has no pages');
  const idx = pageIndex < 0 ? pages.length - 1 : Math.min(pageIndex, pages.length - 1);
  const page = pages[idx];
  const { width: pw, height: ph } = page.getSize();
  const scale = width / png.width;
  const w = width, h = png.height * scale;
  page.drawImage(png, {
    x: x ?? (pw - w - margin),
    y: y ?? margin,
    width: w, height: h,
  });
  return { bytes: await pdf.save(), page: idx, width: w, height: h };
}

// Gate a PDF against device caps BEFORE any pdf-lib decode.
export function gatePdfFile(file, ctx = {}) {
  try {
    if (typeof ctx.checkFiles === 'function') {
      const r = ctx.checkFiles([file], { toolId: 'sign', accept: '.pdf,application/pdf', multiple: false });
      if (!r.accepted?.length) {
        return { ok: false, reason: r.rejected?.[0]?.reason || 'File rejected by device caps.' };
      }
      return { ok: true, reason: '' };
    }
    if (typeof ctx.activeCaps === 'function') {
      const caps = ctx.activeCaps('sign');
      const capMB = caps?.maxSingleMB ?? 200;
      const mb = (file?.size || 0) / (1024 * 1024);
      if (mb > capMB) return { ok: false, reason: `Too big (${mb.toFixed(1)} MB > ${capMB} MB cap).` };
    }
  } catch (e) {
    return { ok: false, reason: e?.message || 'Cap check failed.' };
  }
  return { ok: true, reason: '' };
}

export function mount(el, ctx = {}) {
  const log = (...a) => { (ctx.log || console.log)('[sign]', ...a); };
  let pngBlob = null;
  // Unified object-URL registry: every URL we create is tracked here and
  // revoked together on replace/unmount. No per-anchor special cases.
  const liveUrls = new Set();
  const track = url => { liveUrls.add(url); return url; };
  const revoke = url => { if (url && liveUrls.has(url)) { try { URL.revokeObjectURL(url); } catch {} liveUrls.delete(url); } };
  const revokeAll = () => { for (const u of [...liveUrls]) revoke(u); };

  el.innerHTML = `
    <div style="display:grid;gap:10px">
      <p class="muted" style="margin:0">100% local — draw, export transparent PNG, optionally embed in your PDF.</p>
      <canvas data-f="pad" style="border:1px solid #e2e8f0;border-radius:10px;touch-action:none;cursor:crosshair;background:transparent"></canvas>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button data-f="clear" class="secondary">Clear</button>
        <button data-f="save">Save PNG</button>
        <button data-f="audit" class="secondary">Show audit info</button>
      </div>
      <label style="font-size:13px;font-weight:600">PDF to sign (optional)
        <input type="file" data-f="pdf" accept="application/pdf,.pdf" />
      </label>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button data-f="embed">Embed PNG in PDF</button>
        <a data-f="dlpng" hidden>Download signature.png</a>
        <a data-f="dlpdf" hidden>Download signed.pdf</a>
      </div>
      <div data-f="status" style="font-size:13px;color:#64748b" aria-live="polite">Draw above to begin.</div>
    </div>`;

  const q = s => el.querySelector(`[data-f="${s}"]`);
  const say = m => { q('status').textContent = m; log(m); };
  const canvas = q('pad');
  const { ctx: c2 } = setupHiDPI(canvas);
  let drawing = false, last = null;

  const pos = e => {
    const r = canvas.getBoundingClientRect();
    const p = e.touches?.[0] ?? e;
    return { x: p.clientX - r.left, y: p.clientY - r.top };
  };
  const down = e => {
    e.preventDefault();
    drawing = true; last = pos(e);
    c2.beginPath(); c2.moveTo(last.x, last.y);
    try { canvas.setPointerCapture?.(e.pointerId); } catch {}
  };
  const move = e => {
    if (!drawing) return;
    e.preventDefault();
    const pts = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of pts) {
      const p = ev === e ? pos(e) : pos(ev);
      const mx = (last.x + p.x) / 2, my = (last.y + p.y) / 2;
      c2.quadraticCurveTo(last.x, last.y, mx, my);
      c2.stroke();
      c2.beginPath(); c2.moveTo(mx, my);
      last = p;
    }
  };
  const up = () => { drawing = false; last = null; };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  // Unified download helper: ctx.download when provided, else tracked <a>.
  const saveBlob = (blob, name, mime, anchorSel) => {
    const dl = ctx.download;
    if (typeof dl === 'function') return dl(blob, name, mime);
    const a = q(anchorSel);
    if (a.dataset.url) revoke(a.dataset.url);
    const url = track(URL.createObjectURL(blob));
    a.dataset.url = url;
    a.href = url; a.download = name; a.hidden = false;
  };

  q('clear').addEventListener('click', () => {
    clearCanvas(canvas);
    pngBlob = null; q('dlpng').hidden = true;
    say('Cleared — draw above to begin.');
  });

  q('save').addEventListener('click', async () => {
    if (isBlank(canvas)) { say('Canvas is blank — draw first.'); return; }
    pngBlob = await canvasToPngBlob(canvas);
    saveBlob(pngBlob, 'signature.png', 'image/png', 'dlpng');
    say(`PNG saved — ${(pngBlob.size / 1024).toFixed(1)} KB, transparent, HiDPI (${canvas.width}×${canvas.height}px).`);
  });

  // T6: UI-only local audit panel — no crypto/PKI, no fetch, no server log.
  q('audit').addEventListener('click', () => {
    const f = q('pdf').files?.[0];
    const when = new Date().toLocaleString();
    const filePart = f ? `${f.name} (${(f.size / 1024).toFixed(1)} KB)` : 'no PDF chosen';
    say(`Audit (local only — on-device, no server log) — ${when} · tool: sign · file: ${filePart}.`);
  });

  q('pdf').addEventListener('change', () => {
    const f = q('pdf').files?.[0];
    if (!f) return;
    const gate = gatePdfFile(f, ctx);
    if (!gate.ok) {
      q('pdf').value = '';
      say('Rejected: ' + gate.reason);
    }
  });

  q('embed').addEventListener('click', async () => {
    const f = q('pdf').files?.[0];
    if (!f) { say('Choose a PDF first.'); return; }
    const gate = gatePdfFile(f, ctx);
    if (!gate.ok) { say('Rejected: ' + gate.reason); return; }
    try { ctx.activeCaps && ctx.activeCaps('sign'); } catch {}
    if (isBlank(canvas)) { say('Draw your signature first.'); return; }
    q('embed').disabled = true;
    try {
      say('Loading pdf-lib (once)…');
      pngBlob = pngBlob || await canvasToPngBlob(canvas);
      const pdfBytes = new Uint8Array(await f.arrayBuffer());
      const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
      const out = await embedPngInPdf(pdfBytes, pngBytes);
      const blob = new Blob([out.bytes], { type: 'application/pdf' });
      saveBlob(blob, 'signed.pdf', 'application/pdf', 'dlpdf');
      say(`Embedded on page ${out.page + 1} (${Math.round(out.width)}×${Math.round(out.height)}pt). PNG embeds — open signed.pdf to verify.`);
    } catch (e) { say('Error: ' + (e?.message || e)); }
    finally { q('embed').disabled = false; }
  });

  log('mounted');
  function cleanup() {
    revokeAll();
    el.innerHTML = '';
  }
  cleanup.setupHiDPI = setupHiDPI;
  cleanup.clearCanvas = clearCanvas;
  cleanup.isBlank = isBlank;
  cleanup.canvasToPngBlob = canvasToPngBlob;
  cleanup.embedPngInPdf = embedPngInPdf;
  return cleanup;
}

export default { mount };
