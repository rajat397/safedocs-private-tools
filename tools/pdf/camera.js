// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/camera.js — camera captures → PDF. Client-side only, static-only.
import { shell } from '../_lib/page.js';

export async function mount(el, ctx = {}) {
  const tool = (ctx && ctx.tool) || {};
  const page = shell(el, tool, ctx);
  const status = page.status;
  const setProgress = page.setProgress;
  const q = (s) => page.root.querySelector(`[data-f="${s}"]`);

  page.optionsEl.innerHTML = `
    <div class="notice" data-f="hint">Tip: fill the frame, hold the phone parallel to the page, use even light. Perspective auto-crop is not included — straighten/crop later if needed.</div>
    <div data-f="livewrap">
      <video data-f="video" playsinline autoplay muted style="width:100%;max-height:320px;background:#0f172a;border-radius:8px" hidden></video>
      <canvas data-f="canvas" hidden></canvas>
    </div>
    <div class="btnrow">
      <button type="button" data-f="start">Start camera</button>
      <button type="button" data-f="capture" disabled>Capture page</button>
      <button type="button" class="secondary" data-f="stop" disabled>Stop camera</button>
    </div>
    <label>Fallback upload (no camera / permission denied)
      <input type="file" data-f="upload" accept="image/*,.jpg,.jpeg,.png,.webp" multiple />
    </label>
    <label><input type="checkbox" data-f="gray" checked /> Grayscale + cleanup (contrast boost, ink-saving)</label>
    <label>JPEG quality
      <select data-f="quality">
        <option value="0.7">0.7 — smaller</option>
        <option value="0.85" selected>0.85 — balanced</option>
        <option value="0.92">0.92 — best</option>
      </select>
    </label>
    <div data-f="thumbs" aria-label="Captured pages" style="display:grid;gap:8px"></div>`;

  const video = q('video');
  const canvas = q('canvas');
  const thumbs = q('thumbs');
  const startBtn = q('start');
  const captureBtn = q('capture');
  const stopBtn = q('stop');

  let stream = null;
  let pages = []; // { id, dataUrl, w, h }
  let nextId = 1;
  let syntheticFile = null;
  let destroyed = false;
  const MAX_PAGES = 50;

  function saveBytes(bytes, filename, mime = 'application/pdf') {
    return ctx.download(bytes, filename, mime);
  }

  function syncRunEnabled() {
    // Shell Run guard needs >=1 file: seed a synthetic placeholder while pages exist.
    try {
      const hasReal = page.getFiles().some((f) => f !== syntheticFile);
      if (pages.length && !syntheticFile && !hasReal) {
        syntheticFile = new File(['camera-scan'], 'camera-pages.txt', { type: 'text/plain' });
        page.setFiles([syntheticFile]);
      } else if (!pages.length && syntheticFile && !hasReal) {
        syntheticFile = null;
        page.setFiles([]);
      }
    } catch { /* ignore */ }
  }

  function renderThumbs() {
    thumbs.innerHTML = '';
    pages.forEach((p, idx) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;align-items:center;border:1px solid var(--line);border-radius:8px;padding:6px';
      const img = document.createElement('img');
      img.src = p.dataUrl;
      img.alt = `Page ${idx + 1}`;
      img.style.cssText = 'width:72px;height:96px;object-fit:cover;border-radius:4px';
      const label = document.createElement('span');
      label.textContent = `Page ${idx + 1}`;
      label.style.cssText = 'font-size:13px;font-weight:600;min-width:56px';
      const mk = (t, title) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'secondary';
        b.textContent = t;
        b.title = title;
        b.setAttribute('aria-label', `${title} (page ${idx + 1})`);
        return b;
      };
      const up = mk('←', 'Move earlier');
      const down = mk('→', 'Move later');
      const del = mk('✕', 'Delete page');
      up.disabled = idx === 0;
      down.disabled = idx === pages.length - 1;
      up.onclick = () => {
        [pages[idx - 1], pages[idx]] = [pages[idx], pages[idx - 1]];
        renderThumbs();
      };
      down.onclick = () => {
        [pages[idx + 1], pages[idx]] = [pages[idx], pages[idx + 1]];
        renderThumbs();
      };
      del.onclick = () => {
        pages.splice(idx, 1);
        renderThumbs();
        syncRunEnabled();
        status(pages.length ? `${pages.length} page(s) kept.` : 'All pages removed.');
      };
      row.append(img, label, up, down, del);
      thumbs.append(row);
    });
  }

  function addPage(dataUrl, w, h) {
    if (pages.length >= MAX_PAGES) {
      status(`Page-cap: ${MAX_PAGES} pages max. Delete a page or export first.`);
      return;
    }
    pages.push({ id: nextId++, dataUrl, w, h });
    renderThumbs();
    syncRunEnabled();
    status(`Captured page ${pages.length} of max ${MAX_PAGES}.`);
  }

  function processFrame(quality) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) throw new Error('Camera not ready — wait a second and retry.');
    const gray = q('gray').checked;
    canvas.width = vw;
    canvas.height = vh;
    const g = canvas.getContext('2d');
    try { g.filter = gray ? 'grayscale(1) contrast(1.15) brightness(1.05)' : 'none'; } catch { /* older browsers */ }
    g.drawImage(video, 0, 0, vw, vh);
    try { g.filter = 'none'; } catch { /* ignore */ }
    const url = canvas.toDataURL('image/jpeg', quality);
    canvas.width = 0;
    canvas.height = 0;
    addPage(url, vw, vh);
  }

  async function fileToPage(file, quality) {
    const bmp = await createImageBitmap(file);
    const gray = q('gray').checked;
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const g = canvas.getContext('2d');
    if (gray) {
      // Manual grayscale+contrast for uploads (canvas filter may not apply to drawImage everywhere).
      g.drawImage(bmp, 0, 0);
      const d = g.getImageData(0, 0, canvas.width, canvas.height);
      const px = d.data;
      for (let i = 0; i < px.length; i += 4) {
        const v = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        const c = Math.max(0, Math.min(255, (v - 128) * 1.15 + 128 + 12));
        px[i] = px[i + 1] = px[i + 2] = c;
      }
      g.putImageData(d, 0, 0);
    } else {
      g.drawImage(bmp, 0, 0);
    }
    const url = canvas.toDataURL('image/jpeg', quality);
    canvas.width = 0;
    canvas.height = 0;
    try { bmp.close(); } catch { /* ignore */ }
    addPage(url, bmp.width, bmp.height);
  }

  function stopCamera(silent) {
    try {
      if (stream) stream.getTracks().forEach((t) => { try { t.stop(); } catch { /* ignore */ } });
    } catch { /* ignore */ }
    stream = null;
    try {
      video.srcObject = null;
      video.hidden = true;
    } catch { /* ignore */ }
    captureBtn.disabled = true;
    stopBtn.disabled = true;
    startBtn.disabled = false;
    if (!silent) status('Camera stopped. Pages kept — export or capture more.');
  }

  startBtn.onclick = async () => {
    if (!window.isSecureContext && location.hostname !== 'localhost' && location.protocol !== 'file:') {
      // getUserMedia still attempted; warn only.
      status('Note: camera needs HTTPS or localhost — trying anyway…');
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      status('Camera API unavailable here — use the fallback upload below.');
      try { q('upload').focus(); } catch { /* ignore */ }
      return;
    }
    try {
      status('Requesting camera…');
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      if (destroyed) { stopCamera(true); return; }
      video.srcObject = stream;
      video.hidden = false;
      try { await video.play(); } catch { /* autoplay guard; user can press play */ }
      captureBtn.disabled = false;
      stopBtn.disabled = false;
      startBtn.disabled = true;
      status('Live preview on — Capture adds a page (multi-capture supported).');
    } catch (e) {
      const name = e?.name || '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        status('Permission denied — camera blocked. Use the fallback upload below instead; nothing was recorded.');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        status('No camera found — use the fallback upload below.');
      } else {
        status('Camera error (' + (e?.message || name || e) + ') — use the fallback upload below.');
      }
      try { q('upload').focus(); } catch { /* ignore */ }
    }
  };

  captureBtn.onclick = () => {
    try {
      processFrame(parseFloat(q('quality').value) || 0.85);
    } catch (e) { status('Error: ' + (e?.message || e)); }
  };

  stopBtn.onclick = () => stopCamera(false);

  q('upload').addEventListener('change', async (e) => {
    const list = [...(e.target.files || [])];
    if (!list.length) return;
    const quality = parseFloat(q('quality').value) || 0.85;
    status(`Importing ${list.length} image(s)…`);
    for (const f of list) {
      try {
        if (!f.type.startsWith('image/')) { status(`Skipped ${f.name}: not an image.`); continue; }
        await fileToPage(f, quality);
      } catch (err) { status(`Error on ${f.name}: ` + (err?.message || err)); break; }
    }
    e.target.value = '';
  });

  // Shell dropzone doubles as fallback upload: import dropped images as pages.
  page.onFiles((accepted) => {
    if (!accepted.length) return;
    if (accepted.length === 1 && accepted[0] === syntheticFile) return; // own seed echo
    const quality = parseFloat(q('quality')?.value) || 0.85;
    (async () => {
      for (const f of accepted) {
        try {
          if (f === syntheticFile) continue;
          if (!String(f.type || '').startsWith('image/')) continue;
          await fileToPage(f, quality);
        } catch (err) { status('Error: ' + (err?.message || err)); break; }
      }
    })();
  });

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
          s.src = src;
          s.onload = res;
          s.onerror = rej;
          document.head.appendChild(s);
        });
        if (globalThis.PDFLib) return globalThis.PDFLib;
      } catch { /* try next */ }
    }
    throw new Error('Could not load pdf-lib@1.17.1');
  }

  page.runBtn('Download PDF', async () => {
    try {
      if (!pages.length) { status('Capture or upload at least one page first.'); return; }
      if (pages.length > MAX_PAGES) throw new Error(`Page-count guard: ${pages.length} pages (cap ${MAX_PAGES}).`);
      status('Loading pdf-lib…');
      const { PDFDocument } = await loadPdfLib();
      const out = await PDFDocument.create();
      const A4 = [595.28, 841.89];
      let done = 0;
      for (const p of pages) {
        status(`Embedding page ${done + 1}/${pages.length}…`);
        const img = await out.embedJpg(p.dataUrl);
        const pg = out.addPage(A4);
        const s = Math.min(A4[0] / img.width, A4[1] / img.height);
        const w = img.width * s;
        const h = img.height * s;
        pg.drawImage(img, { x: (A4[0] - w) / 2, y: (A4[1] - h) / 2, width: w, height: h });
        done += 1;
        setProgress(done / pages.length);
      }
      saveBytes(await out.save({ useObjectStreams: true }), 'scan.pdf', 'application/pdf');
      status(`Done — ${pages.length} page(s) → scan.pdf (grayscale ${q('gray').checked ? 'on' : 'off'}).`);
    } catch (e) { status('Error: ' + (e?.message || e)); }
  });

  renderThumbs();
  return () => {
    destroyed = true;
    pages = [];
    syntheticFile = null;
    try { stopCamera(true); } catch { /* ignore */ }
    page.cleanup();
  };
}
