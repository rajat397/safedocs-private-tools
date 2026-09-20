// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/edit-content.js — add text, images, shapes, freehand draw to PDF pages. pdf-lib only, static ES module.
import { shell } from '../_lib/page.js';

const PDF_LIB_PIN = '1.17.1';

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
    <fieldset style="border:1px solid var(--line);border-radius:8px;padding:10px;display:grid;gap:8px">
      <legend style="font-weight:600;font-size:13px">Mode</legend>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px"><input type="radio" name="mode" value="text" checked> Add text</label>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px"><input type="radio" name="mode" value="image"> Add image</label>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px"><input type="radio" name="mode" value="shape"> Add shape</label>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px"><input type="radio" name="mode" value="draw"> Freehand draw</label>
    </fieldset>
    <div data-f="text-opts" style="display:grid;gap:8px">
      <label>Text <input type="text" data-f="text" placeholder="Your text here" required /></label>
      <label>Font
        <select data-f="font">
          <option value="Helvetica">Helvetica</option>
          <option value="Helvetica-Bold">Helvetica Bold</option>
          <option value="Helvetica-Oblique">Helvetica Oblique</option>
          <option value="Helvetica-BoldOblique">Helvetica Bold Oblique</option>
          <option value="Times-Roman">Times Roman</option>
          <option value="Times-Bold">Times Bold</option>
          <option value="Times-Italic">Times Italic</option>
          <option value="Times-BoldItalic">Times Bold Italic</option>
          <option value="Courier">Courier</option>
          <option value="Courier-Bold">Courier Bold</option>
          <option value="Courier-Oblique">Courier Oblique</option>
          <option value="Courier-BoldOblique">Courier Bold Oblique</option>
        </select>
      </label>
      <label>Size <input type="number" data-f="size" value="14" min="6" max="144" step="1" /></label>
      <label>Color <input type="color" data-f="color" value="#0f172a" /></label>
      <label>Opacity <input type="range" data-f="opacity" min="0" max="1" step="0.05" value="1" /> <span data-f="opacity-val">1.0</span></label>
      <p class="muted" style="margin:0;font-size:12px">Click on a page to place text. Drag to move.</p>
    </div>
    <div data-f="image-opts" hidden style="display:grid;gap:8px">
      <label>Image file
        <input type="file" data-f="imgfile" accept="image/*,.jpg,.jpeg,.png,.webp" />
      </label>
      <label>Opacity <input type="range" data-f="img-opacity" min="0" max="1" step="0.05" value="1" /> <span data-f="img-opacity-val">1.0</span></label>
      <p class="muted" style="margin:0;font-size:12px">Click on a page to place image. Drag corners to resize.</p>
    </div>
    <div data-f="shape-opts" hidden style="display:grid;gap:8px">
      <label>Shape
        <select data-f="shape">
          <option value="rect">Rectangle</option>
          <option value="ellipse">Ellipse</option>
          <option value="line">Line</option>
        </select>
      </label>
      <label>Stroke color <input type="color" data-f="stroke-color" value="#0f172a" /></label>
      <label>Fill color <input type="color" data-f="fill-color" value="#3b82f6" /></label>
      <label>Fill <input type="checkbox" data-f="fill-enabled" checked /></label>
      <label>Stroke width <input type="number" data-f="stroke-width" value="2" min="0.5" max="20" step="0.5" /></label>
      <label>Opacity <input type="range" data-f="shape-opacity" min="0" max="1" step="0.05" value="1" /> <span data-f="shape-opacity-val">1.0</span></label>
      <p class="muted" style="margin:0;font-size:12px">Click and drag on a page to draw shape.</p>
    </div>
    <div data-f="draw-opts" hidden style="display:grid;gap:8px">
      <label>Stroke color <input type="color" data-f="draw-color" value="#0f172a" /></label>
      <label>Stroke width <input type="number" data-f="draw-width" value="2" min="0.5" max="20" step="0.5" /></label>
      <label>Opacity <input type="range" data-f="draw-opacity" min="0" max="1" step="0.05" value="1" /> <span data-f="draw-opacity-val">1.0</span></label>
      <p class="muted" style="margin:0;font-size:12px">Draw on pages. Click to start, drag to draw.</p>
    </div>
    <label>Page to edit
      <select data-f="page-select">
        <option value="">All pages (for multi-page mode)</option>
      </select>
    </label>
    <p class="muted" style="margin:0;font-size:12px">Preview renders first 20 pages. Edits apply to selected page(s).</p>`;

  const infoEl = document.createElement('div');
  infoEl.dataset.f = 'info';
  infoEl.className = 'muted';
  infoEl.style.cssText = 'font-size:13px;margin-bottom:8px';
  page.outputEl.append(infoEl);

  const canvasWrap = document.createElement('div');
  canvasWrap.dataset.f = 'canvas-wrap';
  canvasWrap.style.cssText = 'position:relative;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#f8fafc';
  page.outputEl.append(canvasWrap);

  const canvas = document.createElement('canvas');
  canvas.dataset.f = 'canvas';
  canvas.style.cssText = 'display:block;touch-action:none;cursor:crosshair';
  canvasWrap.appendChild(canvas);

  const overlay = document.createElement('div');
  overlay.dataset.f = 'overlay';
  overlay.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none';
  canvasWrap.appendChild(overlay);

  let files = [];
  let pdfDoc = null;
  let pdfjsLib = null;
  let currentPageIndex = 0;
  let scale = 1.0;
  let viewport = null;
  let editItems = [];
  let selectedItem = null;
  let dragState = null;
  let imageFile = null;
  let drawPath = [];
  let isDrawing = false;

  const liveUrls = new Set();
  const track = (url) => { liveUrls.add(url); return url; };
  const revokeAll = () => { for (const u of liveUrls) { try { URL.revokeObjectURL(u); } catch {} } liveUrls.clear(); };

  function checkCaps(list, opts) {
    try {
      if (typeof ctx.checkFiles === 'function') {
        const r = ctx.checkFiles(list, opts);
        if (r && r.rejected && r.rejected.length) {
          status('Rejected: ' + r.rejected.map((x) => `${x.file?.name || 'file'}: ${x.reason}`).join(' | '));
        }
        return r;
      }
    } catch {}
    return null;
  }

  async function loadPdfLib() {
    if (globalThis.PDFLib) return globalThis.PDFLib;
    try {
      const m = await import('https://esm.sh/pdf-lib@1.17.1');
      const lib = m.default ?? m;
      if (lib?.PDFDocument) { globalThis.PDFLib = lib; return lib; }
    } catch {}
    for (const src of [
      'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
      'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
    ]) {
      try { await new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); if (globalThis.PDFLib) return globalThis.PDFLib; } catch {}
    }
    throw new Error('Could not load pdf-lib@1.17.1');
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
          globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          return globalThis.pdfjsLib;
        }
      } catch {}
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
        try { return await pdfjsLib.getDocument({ data: data.slice(), password: pw }).promise; }
        catch (e2) { if (e2 && e2.name === 'PasswordNeededException') throw new Error('Wrong password for this encrypted PDF.'); throw new Error('Could not open encrypted PDF: ' + ((e2 && e2.message) || e2)); }
      }
      throw e;
    }
  }

  function renderPage(pdf, pageNum) {
    return new Promise(async (resolve, reject) => {
      try {
        const pg = await pdf.getPage(pageNum);
        viewport = pg.getViewport({ scale });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = viewport.width + 'px';
        canvas.style.height = viewport.height + 'px';
        overlay.style.width = viewport.width + 'px';
        overlay.style.height = viewport.height + 'px';
        const c2d = canvas.getContext('2d');
        c2d.fillStyle = '#fff';
        c2d.fillRect(0, 0, canvas.width, canvas.height);
        await pg.render({ canvasContext: c2d, viewport }).promise;
        renderOverlay();
        resolve();
      } catch (e) { reject(e); }
    });
  }

  function renderOverlay() {
    overlay.innerHTML = '';
    const c2d = canvas.getContext('2d');
    c2d.save();
    c2d.setTransform(1, 0, 0, 1, 0, 0);
    c2d.clearRect(0, 0, canvas.width, canvas.height);
    c2d.restore();

    editItems.filter(item => item.page === currentPageIndex).forEach((item, idx) => {
      const div = document.createElement('div');
      div.className = 'edit-item';
      div.dataset.idx = idx;
      div.style.cssText = 'position:absolute;pointer-events:auto;cursor:move;border:2px dashed var(--blue);border-radius:4px;background:rgba(59,130,246,0.1)';
      div.title = 'Drag to move, drag corners to resize';
      overlay.appendChild(div);
      updateOverlayItem(div, item);
    });
  }

  function updateOverlayItem(div, item) {
    const x = item.x * scale;
    const y = item.y * scale;
    const w = item.width * scale;
    const h = item.height * scale;
    div.style.left = x + 'px';
    div.style.top = y + 'px';
    div.style.width = w + 'px';
    div.style.height = h + 'px';
    div.innerHTML = '';
    if (item.type === 'text') {
      div.textContent = item.text;
      div.style.fontSize = (item.size * scale) + 'px';
      div.style.fontFamily = item.font;
      div.style.color = item.color;
      div.style.opacity = item.opacity;
      div.style.whiteSpace = 'nowrap';
      div.style.display = 'flex';
      div.style.alignItems = 'center';
      div.style.justifyContent = 'center';
    } else if (item.type === 'image') {
      const img = document.createElement('img');
      img.src = item.src;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'contain';
      img.style.opacity = item.opacity;
      div.appendChild(img);
    } else if (item.type === 'shape') {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.style.width = '100%';
      svg.style.height = '100%';
      svg.setAttribute('viewBox', `0 0 ${item.width} ${item.height}`);
      if (item.shape === 'rect') {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', '0');
        rect.setAttribute('y', '0');
        rect.setAttribute('width', item.width);
        rect.setAttribute('height', item.height);
        rect.setAttribute('fill', item.fillEnabled ? item.fillColor : 'none');
        rect.setAttribute('stroke', item.strokeColor);
        rect.setAttribute('stroke-width', item.strokeWidth);
        rect.setAttribute('opacity', item.opacity);
        svg.appendChild(rect);
      } else if (item.shape === 'ellipse') {
        const ell = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        ell.setAttribute('cx', item.width / 2);
        ell.setAttribute('cy', item.height / 2);
        ell.setAttribute('rx', item.width / 2);
        ell.setAttribute('ry', item.height / 2);
        ell.setAttribute('fill', item.fillEnabled ? item.fillColor : 'none');
        ell.setAttribute('stroke', item.strokeColor);
        ell.setAttribute('stroke-width', item.strokeWidth);
        ell.setAttribute('opacity', item.opacity);
        svg.appendChild(ell);
      } else if (item.shape === 'line') {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', '0');
        line.setAttribute('y1', '0');
        line.setAttribute('x2', item.width);
        line.setAttribute('y2', item.height);
        line.setAttribute('stroke', item.strokeColor);
        line.setAttribute('stroke-width', item.strokeWidth);
        line.setAttribute('opacity', item.opacity);
        svg.appendChild(line);
      }
      div.appendChild(svg);
    } else if (item.type === 'draw') {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.style.width = '100%';
      svg.style.height = '100%';
      svg.setAttribute('viewBox', `0 0 ${item.width} ${item.height}`);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', item.path);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', item.color);
      path.setAttribute('stroke-width', item.width);
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('opacity', item.opacity);
      svg.appendChild(path);
      div.appendChild(svg);
    }

    const handles = ['nw', 'ne', 'sw', 'se'];
    handles.forEach(pos => {
      const h = document.createElement('div');
      h.className = 'resize-handle';
      h.dataset.pos = pos;
      h.style.cssText = 'position:absolute;width:10px;height:10px;background:var(--blue);border:2px solid #fff;border-radius:50%;pointer-events:auto;cursor:' + (pos === 'nw' || pos === 'se' ? 'nwse-resize' : 'nesw-resize');
      if (pos === 'nw') { h.style.left = '-5px'; h.style.top = '-5px'; }
      else if (pos === 'ne') { h.style.right = '-5px'; h.style.top = '-5px'; }
      else if (pos === 'sw') { h.style.left = '-5px'; h.style.bottom = '-5px'; }
      else if (pos === 'se') { h.style.right = '-5px'; h.style.bottom = '-5px'; }
      div.appendChild(h);
    });

    const del = document.createElement('div');
    del.className = 'delete-handle';
    del.style.cssText = 'position:absolute;top:-16px;right:-16px;width:20px;height:20px;background:#ef4444;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;cursor:pointer;pointer-events:auto';
    del.textContent = '×';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      editItems = editItems.filter((_, i) => i !== parseInt(div.dataset.idx));
      renderOverlay();
    });
    div.appendChild(del);
  }

  function screenToPdf(x, y) {
    return { x: x / scale, y: (canvas.height - y) / scale };
  }

  function pdfToScreen(x, y) {
    return { x: x * scale, y: canvas.height - y * scale };
  }

  canvasWrap.addEventListener('pointerdown', (e) => {
    const mode = page.root.querySelector('input[name="mode"]:checked')?.value || 'text';
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const target = e.target.closest('.edit-item');
    if (target && target.dataset.idx !== undefined) {
      const idx = parseInt(target.dataset.idx);
      const item = editItems.filter(i => i.page === currentPageIndex)[idx];
      if (item) {
        const handle = e.target.closest('.resize-handle');
        if (handle) {
          dragState = { type: 'resize', item, handle: handle.dataset.pos, startX: x, startY: y, startW: item.width, startH: item.height };
          e.preventDefault();
          return;
        }
        dragState = { type: 'move', item, startX: x, startY: y, startItemX: item.x, startItemY: item.y };
        selectedItem = item;
        e.preventDefault();
        return;
      }
    }

    if (mode === 'text') {
      const text = q('text').value;
      if (!text) { status('Enter text first.'); return; }
      const pdfPt = screenToPdf(x, y);
      const item = {
        type: 'text',
        page: currentPageIndex,
        text,
        x: pdfPt.x,
        y: pdfPt.y,
        width: 100,
        height: 20,
        font: q('font').value,
        size: parseFloat(q('size').value),
        color: q('color').value,
        opacity: parseFloat(q('opacity').value)
      };
      editItems.push(item);
      renderOverlay();
    } else if (mode === 'image' && imageFile) {
      const pdfPt = screenToPdf(x, y);
      const item = {
        type: 'image',
        page: currentPageIndex,
        src: imageFile,
        x: pdfPt.x,
        y: pdfPt.y,
        width: 100,
        height: 100,
        opacity: parseFloat(q('img-opacity').value)
      };
      editItems.push(item);
      renderOverlay();
    } else if (mode === 'shape') {
      dragState = {
        type: 'draw-shape',
        shape: q('shape').value,
        strokeColor: q('stroke-color').value,
        fillColor: q('fill-color').value,
        fillEnabled: q('fill-enabled').checked,
        strokeWidth: parseFloat(q('stroke-width').value),
        opacity: parseFloat(q('shape-opacity').value),
        startX: x, startY: y,
        startPdfX: screenToPdf(x, y).x,
        startPdfY: screenToPdf(x, y).y
      };
    } else if (mode === 'draw') {
      isDrawing = true;
      const pdfPt = screenToPdf(x, y);
      drawPath = [{ x: pdfPt.x, y: pdfPt.y }];
    }
  });

  window.addEventListener('pointermove', (e) => {
    if (!dragState && !isDrawing) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (dragState) {
      if (dragState.type === 'move') {
        const dx = (x - dragState.startX) / scale;
        const dy = (y - dragState.startY) / scale;
        dragState.item.x = dragState.startItemX + dx;
        dragState.item.y = dragState.startItemY - dy;
        renderOverlay();
      } else if (dragState.type === 'resize') {
        const dx = (x - dragState.startX) / scale;
        const dy = (y - dragState.startY) / scale;
        let newW = dragState.startW + dx;
        let newH = dragState.startH - dy;
        if (dragState.handle.includes('w')) { dragState.item.x = dragState.item.x + dragState.item.width - newW; dragState.item.width = newW; }
        else { dragState.item.width = newW; }
        if (dragState.handle.includes('n')) { dragState.item.y = dragState.item.y + dragState.item.height - newH; dragState.item.height = newH; }
        else { dragState.item.height = newH; }
        renderOverlay();
      } else if (dragState.type === 'draw-shape') {
        const pdfPt = screenToPdf(x, y);
        const w = pdfPt.x - dragState.startPdfX;
        const h = pdfPt.y - dragState.startPdfY;
        dragState.item = {
          type: 'shape',
          page: currentPageIndex,
          shape: dragState.shape,
          x: dragState.startPdfX,
          y: dragState.startPdfY,
          width: w,
          height: h,
          strokeColor: dragState.strokeColor,
          fillColor: dragState.fillColor,
          fillEnabled: dragState.fillEnabled,
          strokeWidth: dragState.strokeWidth,
          opacity: dragState.opacity
        };
        renderOverlay();
      }
    } else if (isDrawing) {
      const pdfPt = screenToPdf(x, y);
      drawPath.push({ x: pdfPt.x, y: pdfPt.y });
      renderDrawPreview();
    }
  });

  window.addEventListener('pointerup', () => {
    if (dragState?.type === 'draw-shape' && dragState.item) {
      if (Math.abs(dragState.item.width) > 5 && Math.abs(dragState.item.height) > 5) {
        editItems.push(dragState.item);
      }
      dragState = null;
      renderOverlay();
    } else if (isDrawing && drawPath.length > 1) {
      const xs = drawPath.map(p => p.x);
      const ys = drawPath.map(p => p.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const pathData = 'M ' + drawPath.map((p, i) => (i === 0 ? '' : 'L ') + (p.x - minX) + ' ' + (p.y - minY)).join(' ');
      editItems.push({
        type: 'draw',
        page: currentPageIndex,
        path: pathData,
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        color: q('draw-color').value,
        width: parseFloat(q('draw-width').value),
        opacity: parseFloat(q('draw-opacity').value)
      });
      drawPath = [];
      isDrawing = false;
      renderOverlay();
    } else {
      dragState = null;
      isDrawing = false;
    }
  });

  function renderDrawPreview() {
    const c2d = canvas.getContext('2d');
    c2d.save();
    c2d.setTransform(1, 0, 0, 1, 0, 0);
    c2d.clearRect(0, 0, canvas.width, canvas.height);
    const pg = pdfjsLib.getDocument({ data: new Uint8Array(await files[0].arrayBuffer()) }).promise.then(p => p.getPage(currentPageIndex + 1));
    c2d.restore();
    if (drawPath.length > 1) {
      c2d.strokeStyle = q('draw-color').value;
      c2d.lineWidth = parseFloat(q('draw-width').value) * scale;
      c2d.globalAlpha = parseFloat(q('draw-opacity').value);
      c2d.lineCap = 'round';
      c2d.lineJoin = 'round';
      c2d.beginPath();
      drawPath.forEach((p, i) => {
        const s = pdfToScreen(p.x, p.y);
        if (i === 0) c2d.moveTo(s.x, s.y);
        else c2d.lineTo(s.x, s.y);
      });
      c2d.stroke();
    }
  }

  async function loadAndPreview(file) {
    status('Loading pdf.js…');
    pdfjsLib = await loadPdfJs();
    const pdf = await openPdfWithPassword(pdfjsLib, new Uint8Array(await file.arrayBuffer()), () => q('pw').value);
    pdfDoc = pdf;
    const pageSelect = q('page-select');
    pageSelect.innerHTML = '<option value="">All pages</option>';
    const maxPages = Math.min(pdf.numPages, 20);
    for (let i = 1; i <= maxPages; i++) {
      const opt = document.createElement('option');
      opt.value = i - 1;
      opt.textContent = `Page ${i}`;
      pageSelect.appendChild(opt);
    }
    pageSelect.value = '0';
    currentPageIndex = 0;
    status(`Loaded ${pdf.numPages} page(s). Click on page to add content.`);
    await renderPage(pdf, 1);
  }

  page.onFiles(async (accepted) => {
    files = [...accepted];
    if (files[0]) {
      editItems = [];
      await loadAndPreview(files[0]).catch(err => status('Error: ' + (err?.message || err)));
    }
  });

  q('page-select').addEventListener('change', async () => {
    if (!pdfDoc) return;
    currentPageIndex = parseInt(q('page-select').value) || 0;
    await renderPage(pdfDoc, currentPageIndex + 1);
  });

  const modeRadios = page.root.querySelectorAll('input[name="mode"]');
  modeRadios.forEach(r => r.addEventListener('change', () => {
    const mode = r.value;
    q('text-opts').hidden = mode !== 'text';
    q('image-opts').hidden = mode !== 'image';
    q('shape-opts').hidden = mode !== 'shape';
    q('draw-opts').hidden = mode !== 'draw';
  }));

  q('opacity').addEventListener('input', () => q('opacity-val').textContent = parseFloat(q('opacity').value).toFixed(2));
  q('img-opacity').addEventListener('input', () => q('img-opacity-val').textContent = parseFloat(q('img-opacity').value).toFixed(2));
  q('shape-opacity').addEventListener('input', () => q('shape-opacity-val').textContent = parseFloat(q('shape-opacity').value).toFixed(2));
  q('draw-opacity').addEventListener('input', () => q('draw-opacity-val').textContent = parseFloat(q('draw-opacity').value).toFixed(2));

  q('imgfile').addEventListener('change', (e) => {
    imageFile = e.target.files?.[0] ? URL.createObjectURL(e.target.files[0]) : null;
    if (imageFile) track(imageFile);
  });

  page.runBtn('Apply edits & download', async (got) => {
    let tmpCanvas = null;
    try {
      files = [...(got || [])];
      const f = files[0];
      if (!f) { status('Pick a PDF.'); return; }
      const chk = checkCaps([f], { toolId: 'pdf-edit-content', accept: '.pdf,application/pdf', multiple: false });
      const file = (chk && chk.accepted && chk.accepted.length) ? chk.accepted[0] : f;
      if (chk && chk.accepted && !chk.accepted.length) return;

      status('Loading pdf-lib…');
      const { PDFDocument, rgb, StandardFonts } = await loadPdfLib();
      const orig = new Uint8Array(await file.arrayBuffer());
      const pdf = await PDFDocument.load(orig, { ignoreEncryption: true });

      const pages = pdf.getPages();
      for (const item of editItems) {
        if (item.page >= pages.length) continue;
        const page = pages[item.page];
        const { width: pw, height: ph } = page.getSize();

        if (item.type === 'text') {
          const font = await pdf.embedStandardFont(StandardFonts[item.font.replace(/-/g, '')] || StandardFonts.Helvetica);
          page.drawText(item.text, {
            x: item.x,
            y: ph - item.y - item.size,
            size: item.size,
            font,
            color: rgb(...hexToRgb(item.color)),
            opacity: item.opacity
          });
        } else if (item.type === 'image') {
          const imgBytes = await fetch(item.src).then(r => r.arrayBuffer());
          let img;
          if (item.src.startsWith('data:image/png') || item.src.endsWith('.png')) img = await pdf.embedPng(new Uint8Array(imgBytes));
          else img = await pdf.embedJpg(new Uint8Array(imgBytes));
          page.drawImage(img, {
            x: item.x,
            y: ph - item.y - item.height,
            width: item.width,
            height: item.height,
            opacity: item.opacity
          });
        } else if (item.type === 'shape') {
          const c = rgb(...hexToRgb(item.strokeColor));
          const fc = rgb(...hexToRgb(item.fillColor));
          const x = item.x;
          const y = ph - item.y - item.height;
          if (item.shape === 'rect') {
            if (item.fillEnabled) page.drawRectangle({ x, y, width: item.width, height: item.height, color: fc, opacity: item.opacity });
            page.drawRectangle({ x, y, width: item.width, height: item.height, borderColor: c, borderWidth: item.strokeWidth, opacity: item.opacity });
          } else if (item.shape === 'ellipse') {
            page.drawEllipse({ x: x + item.width / 2, y: y + item.height / 2, xScale: item.width / 2, yScale: item.height / 2, color: item.fillEnabled ? fc : undefined, borderColor: c, borderWidth: item.strokeWidth, opacity: item.opacity });
          } else if (item.shape === 'line') {
            page.drawLine({ start: { x, y: y + item.height }, end: { x: x + item.width, y }, color: c, thickness: item.strokeWidth, opacity: item.opacity });
          }
        } else if (item.type === 'draw') {
          const c = rgb(...hexToRgb(item.color));
          const pathCmds = parseSvgPath(item.path);
          page.drawSvgPath(pathCmds, { x: item.x, y: ph - item.y - item.height, color: c, thickness: item.width, opacity: item.opacity });
        }
      }

      const bytes = await pdf.save({ useObjectStreams: true });
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = track(URL.createObjectURL(blob));
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name.replace(/\.pdf$/i, '') + '-edited.pdf';
      a.className = 'btn';
      a.textContent = 'Download edited PDF';
      page.outputEl.innerHTML = '';
      page.outputEl.appendChild(a);
      status(`Done — ${editItems.length} edit(s) applied.`);
      try { q('pw').value = ''; } catch {}
    } catch (e) { status('Error: ' + (e?.message || e)); }
    finally {
      try { if (tmpCanvas) { tmpCanvas.width = 0; tmpCanvas.height = 0; } } catch {}
    }
  });

  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : [0, 0, 0];
  }

  function parseSvgPath(d) {
    return d;
  }

  return () => {
    files = [];
    editItems = [];
    revokeAll();
    try { q('pw').value = ''; } catch {}
    page.cleanup();
  };
}