// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava. Source-available - see /LICENSE. Commercial use requires permission: rajat242003@gmail.com.
// tools/compare/index.js — side-by-side PDF page comparison. P2 shell UI.

import { shell } from '../_lib/page.js';
import { PINS } from '../../vendor/cdn-pins.js';

export async function mount(el, ctx = {}) {
  const tool = (ctx && ctx.tool) || {};
  const page = shell(el, tool, ctx);
  const status = page.status;
  const setProgress = page.setProgress;

  // Two dropzones for two PDFs
  let filesA = [];
  let filesB = [];
  let pdfA = null;
  let pdfB = null;
  let pdfjsLib = null;

  // Hide the default single dropzone
  const defaultDzSlot = page.root.querySelector('[data-slot="dz"]');
  defaultDzSlot.innerHTML = '';

  // Build UI
  page.optionsEl.innerHTML = `
    <div class="compare-layout" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:12px">
      <div data-side="a" class="compare-side"></div>
      <div data-side="b" class="compare-side"></div>
    </div>
<div class="compare-controls" style="margin-top:16px;display:flex;gap:12px;flex-wrap:wrap;align-items:center">
        <label class="pill blue" style="cursor:pointer;font-size:13px">
          Sync scroll
          <input type="checkbox" data-f="sync" style="margin-left:8px;transform:translateY(1px)">
        </label>
        <label class="pill grey" style="cursor:pointer;font-size:13px">
          Link pages
          <input type="checkbox" data-f="link" checked style="margin-left:8px;transform:translateY(1px)">
        </label>
        <label class="pill grey" style="cursor:pointer;font-size:13px">
          Show Overlay
          <input type="checkbox" data-f="overlay" style="margin-left:8px;transform:translateY(1px)">
        </label>
        <label class="pill grey" style="cursor:pointer;font-size:13px;display:flex;align-items:center;gap:8px">
          Zoom
          <input type="range" data-f="zoom" min="0.5" max="3" step="0.1" value="1.5" style="width:100px">
          <span data-f="zoomVal" style="width:35px;text-align:right">1.5x</span>
        </label>
        <label class="pill grey" style="cursor:pointer;font-size:13px;display:flex;align-items:center;gap:8px">
          Opacity
          <input type="range" data-f="opacity" min="0" max="1" step="0.05" value="0.4" style="width:100px">
          <span data-f="opacityVal" style="width:35px;text-align:right">0.4</span>
        </label>
        <button type="button" class="pill green" data-f="extract" style="font-size:13px" disabled>Extract Text</button>
        <button type="button" class="pill blue" data-f="copyDiff" style="font-size:13px" disabled>Copy Diff JSON</button>
        <button type="button" class="pill blue" data-f="downloadOverlay" style="font-size:13px" disabled>Download Overlay PNG</button>
        <button type="button" class="pill blue" data-f="downloadDiff" style="font-size:13px" disabled>Download Diff.txt</button>
        <span class="muted" data-f="info" style="font-size:13px">Load two PDFs to compare</span>
      </div>
    <div class="compare-pages" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px"></div>
  `;

  const opts = page.optionsEl;
  const sides = { a: opts.querySelector('[data-side="a"]'), b: opts.querySelector('[data-side="b"]') };
const pagesEl = opts.querySelector('.compare-pages');
    const syncCb = opts.querySelector('[data-f="sync"]');
    const linkCb = opts.querySelector('[data-f="link"]');
    const overlayCb = opts.querySelector('[data-f="overlay"]');
    const zoomInput = opts.querySelector('[data-f="zoom"]');
    const zoomVal = opts.querySelector('[data-f="zoomVal"]');
    const opacityInput = opts.querySelector('[data-f="opacity"]');
    const opacityVal = opts.querySelector('[data-f="opacityVal"]');
    const extractBtn = opts.querySelector('[data-f="extract"]');
    const copyDiffBtn = opts.querySelector('[data-f="copyDiff"]');
    const downloadOverlayBtn = opts.querySelector('[data-f="downloadOverlay"]');
    const downloadDiffBtn = opts.querySelector('[data-f="downloadDiff"]');
    const infoEl = opts.querySelector('[data-f="info"]');

  async function loadPdfJs() {
    if (globalThis.pdfjsLib) return globalThis.pdfjsLib;
    const pin = PINS['pdf.js'];
    for (const src of pin.umd) {
      try {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = src;
          s.onload = res;
          s.onerror = rej;
          document.head.appendChild(s);
        });
        if (globalThis.pdfjsLib) {
          globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc = pin.worker[0];
          return globalThis.pdfjsLib;
        }
      } catch {}
    }
    throw new Error('Could not load pdf.js');
  }

  function assertPdfHeader(bytes) {
    if (!bytes || bytes.length < 5 || bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46 || bytes[4] !== 0x2d) {
      throw new Error('Not a PDF (missing %PDF header)');
    }
  }

  async function openPdf(data) {
    assertPdfHeader(data);
    const task = pdfjsLib.getDocument({ data: data.slice() });
    return await task.promise;
  }

  function createDropzone(side) {
    const sideEl = sides[side];
    sideEl.innerHTML = `
      <div class="dropzone" style="min-height:120px">
        <div class="dz-title">PDF ${side.toUpperCase()}</div>
        <div class="dz-sub">Drop or click to browse</div>
        <ul class="filelist" hidden></ul>
      </div>
      <div class="muted" style="font-size:12px;margin-top:4px" data-f="count">No file</div>
      <div data-f="pages" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"></div>
    `;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,application/pdf';
    input.multiple = false;
    input.hidden = true;
    sideEl.append(input);

    const list = sideEl.querySelector('.filelist');
    const countEl = sideEl.querySelector('[data-f="count"]');
    const pagesWrap = sideEl.querySelector('[data-f="pages"]');
    let dragDepth = 0;

    function renderFile(f) {
      if (!f) {
        list.hidden = true;
        countEl.textContent = 'No file';
        pagesWrap.innerHTML = '';
        return;
      }
      list.hidden = false;
      list.innerHTML = `<li><span>${f.name}</span><span class="muted">${(f.size / 1024 / 1024).toFixed(2)} MB</span></li>`;
      countEl.textContent = `${f.name} — ${pdfs[side]?.numPages || 0} pages`;
    }

    function renderPageSelectors(pdf, activePage = 1) {
      pagesWrap.innerHTML = '';
      if (!pdf) return;
      const max = Math.min(pdf.numPages, 50); // limit selectors to 50 pages
      for (let i = 1; i <= max; i++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pill ' + (i === activePage ? 'blue' : 'grey');
        btn.style.fontSize = '11px';
        btn.style.padding = '2px 8px';
        btn.textContent = i;
        btn.dataset.page = i;
        btn.addEventListener('click', () => selectPage(side, i));
        pagesWrap.appendChild(btn);
      }
      if (pdf.numPages > 50) {
        const more = document.createElement('span');
        more.className = 'muted';
        more.style.fontSize = '11px';
        more.style.alignSelf = 'center';
        more.textContent = `+${pdf.numPages - 50} more`;
        pagesWrap.appendChild(more);
      }
    }

    function selectPage(side, pageNum) {
      if (pdfs[side]) {
        renderCanvas(side, pageNum);
        updatePageButtons(side, pageNum);
        if (pdf.pages?.[pageNum - 1]?.textItems) {
          renderTextPanels();
        }
        if (linkCb.checked && pdfs[otherSide(side)]) {
          selectPage(otherSide(side), pageNum);
        }
      }
    }

    function updatePageButtons(side, activePage) {
      pagesWrap.querySelectorAll('button[data-page]').forEach(btn => {
        btn.className = 'pill ' + (parseInt(btn.dataset.page) === activePage ? 'blue' : 'grey');
      });
    }

    const dzEl = sideEl.querySelector('.dropzone');
    dzEl.addEventListener('click', (e) => { if (e.target === dzEl || e.target.closest('.dz-title') || e.target.closest('.dz-sub')) input.click(); });
    input.addEventListener('change', () => handleFile(input.files[0]));
    dzEl.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; dzEl.classList.add('drag'); });
    dzEl.addEventListener('dragover', (e) => e.preventDefault());
    dzEl.addEventListener('dragleave', (e) => { e.preventDefault(); if (--dragDepth <= 0) { dragDepth = 0; dzEl.classList.remove('drag'); } });
    dzEl.addEventListener('drop', (e) => { e.preventDefault(); dragDepth = 0; dzEl.classList.remove('drag'); handleFile(e.dataTransfer?.files?.[0]); });

    return {
      handleFile,
      renderFile,
      renderPageSelectors,
      selectPage,
      element: sideEl,
    };
  }

  const pdfs = { a: null, b: null };
  const canvases = { a: null, b: null };
  const currentPages = { a: 1, b: 1 };
  const dz = { a: createDropzone('a'), b: createDropzone('b') };

  async function handleFile(file, side) {
    if (!file || !file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      status('Please select a PDF file');
      return;
    }
    status('Loading pdf.js…');
    pdfjsLib = await loadPdfJs();
    status(`Opening ${file.name}…`);
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await openPdf(data);
    pdfs[side] = pdf;
    dz[side].renderFile(file);
    dz[side].renderPageSelectors(pdf, 1);
    currentPages[side] = 1;
    await renderCanvas(side, 1);
    infoEl.textContent = `PDF A: ${pdfs.a?.numPages || 0} pages · PDF B: ${pdfs.b?.numPages || 0} pages`;
    checkReady();
  }

  dz.a.handleFile = (f) => handleFile(f, 'a');
  dz.b.handleFile = (f) => handleFile(f, 'b');

  async function renderCanvas(side, pageNum) {
    const pdf = pdfs[side];
    if (!pdf || pageNum < 1 || pageNum > pdf.numPages) return;
    currentPages[side] = pageNum;
    const pg = await pdf.getPage(pageNum);
    const viewport = pg.getViewport({ scale: currentZoom });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx2d = canvas.getContext('2d');
    ctx2d.fillStyle = '#fff';
    ctx2d.fillRect(0, 0, canvas.width, canvas.height);
    await pg.render({ canvasContext: ctx2d, viewport }).promise;
    canvases[side] = canvas;
    updatePageDisplay();
  }

  function updatePageDisplay() {
    pagesEl.innerHTML = '';
    for (const side of ['a', 'b']) {
      const wrap = document.createElement('div');
      wrap.style.display = 'flex';
      wrap.style.flexDirection = 'column';
      wrap.style.alignItems = 'center';
      wrap.style.gap = '8px';
      wrap.style.position = 'relative';
      const label = document.createElement('div');
      label.className = 'muted';
      label.style.fontSize = '13px';
      label.textContent = `Page ${currentPages[side]} of ${pdfs[side]?.numPages || 0}`;
      wrap.appendChild(label);
      if (canvases[side]) {
        const c = canvases[side].cloneNode(true);
        c.style.maxWidth = '100%';
        c.style.border = '1px solid var(--line)';
        c.style.borderRadius = '8px';
        c.style.background = '#fff';
        wrap.appendChild(c);

        if (side === 'b' && pdfs.overlayCanvas && overlayCb.checked) {
          const overlay = pdfs.overlayCanvas.cloneNode(true);
          overlay.style.position = 'absolute';
          overlay.style.top = '0';
          overlay.style.left = '0';
          overlay.style.width = '100%';
          overlay.style.height = '100%';
          overlay.style.pointerEvents = 'none';
          overlay.style.zIndex = '10';
          overlay.style.borderRadius = '8px';
          wrap.style.position = 'relative';
          wrap.appendChild(overlay);
        }
      }
      pagesEl.appendChild(wrap);
    }
    if (syncCb.checked) {
      syncScroll();
    }
  }

  function syncScroll() {
    // For side-by-side canvases, sync is visual only (same scale)
    // Could add wheel listener to scroll both, but canvases are static images
  }

  function checkReady() {
    page.runBtn('Compare', async () => {
      if (!pdfs.a || !pdfs.b) {
        status('Load both PDFs first');
        return;
      }
      status(`Comparing page ${currentPages.a} vs ${currentPages.b}`);
    });

    if (pdfs.a && pdfs.b) {
      extractBtn.disabled = false;
    }
  }

  async function extractTextLayers() {
    if (!pdfs.a || !pdfs.b) {
      status('Load both PDFs first');
      return;
    }
    extractBtn.disabled = true;
    extractBtn.textContent = 'Extracting…';

    for (const side of ['a', 'b']) {
      const pdf = pdfs[side];
      pdf.pages = pdf.pages || [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        pdf.pages[i - 1] = {
          textItems: textContent.items.map(item => ({
            str: item.str,
            transform: item.transform,
            width: item.width,
            height: item.height,
            dir: item.dir
          }))
        };
        status(`Extracted page ${i}/${pdf.numPages} (${side.toUpperCase()})`);
      }
    }

    renderTextPanels();
    extractBtn.disabled = false;
    extractBtn.textContent = 'Extract Text';
    diffBtn.disabled = false;
    status('Text extraction complete');
  }

  function renderTextPanels() {
    pagesEl.innerHTML = '';
    for (const side of ['a', 'b']) {
      const pdf = pdfs[side];
      const wrap = document.createElement('div');
      wrap.style.display = 'flex';
      wrap.style.flexDirection = 'column';
      wrap.style.gap = '8px';
      wrap.style.flex = '1';
      wrap.style.minWidth = '0';

      const label = document.createElement('div');
      label.className = 'muted';
      label.style.fontSize = '13px';
      label.textContent = `PDF ${side.toUpperCase()} — ${pdf.numPages} pages`;
      wrap.appendChild(label);

      const pageText = document.createElement('div');
      pageText.style.flex = '1';
      pageText.style.overflow = 'auto';
      pageText.style.maxHeight = '500px';
      pageText.style.padding = '12px';
      pageText.style.border = '1px solid var(--line)';
      pageText.style.borderRadius = '8px';
      pageText.style.background = '#fff';
      pageText.style.fontFamily = 'monospace';
      pageText.style.fontSize = '12px';
      pageText.style.lineHeight = '1.5';
      pageText.style.whiteSpace = 'pre-wrap';
      pageText.style.wordBreak = 'break-word';

      const currentPage = currentPages[side];
      const pageData = pdf.pages?.[currentPage - 1];
      if (pageData) {
        const text = pageData.textItems.map(item => item.str).join(' ');
        pageText.textContent = text || '(no text)';
      } else {
        pageText.textContent = 'Select a page';
      }

      wrap.appendChild(pageText);
      pagesEl.appendChild(wrap);
    }

    if (syncCb.checked) {
      syncScroll();
    }
  }

  function otherSide(s) { return s === 'a' ? 'b' : 'a'; }

  let currentZoom = 1.5;
  let currentOpacity = 0.4;

  zoomInput.addEventListener('input', () => {
    currentZoom = parseFloat(zoomInput.value);
    zoomVal.textContent = currentZoom.toFixed(1) + 'x';
    if (pdfs.a || pdfs.b) {
      for (const side of ['a', 'b']) {
        if (currentPages[side]) {
          renderCanvas(side, currentPages[side]);
        }
      }
    }
  });

  opacityInput.addEventListener('input', () => {
    currentOpacity = parseFloat(opacityInput.value);
    opacityVal.textContent = currentOpacity.toFixed(2);
    if (overlayCb.checked && pdfs.diff && pdfs.a && pdfs.b) {
      const pageA = pdfs.a.pages[currentPages.a - 1];
      const pageB = pdfs.b.pages[currentPages.b - 1];
      if (pageA && pageB) {
        status('Rendering overlay…');
        renderOverlay(pageA, pageB, pdfs.diff).then(overlayCanvas => {
          if (overlayCanvas) {
            pdfs.overlayCanvas = overlayCanvas;
            updatePageDisplay();
          }
          status('Overlay ready');
        });
      }
    }
  });

  const diffBtn = document.createElement('button');
  diffBtn.type = 'button';
  diffBtn.className = 'pill green';
  diffBtn.style.fontSize = '13px';
  diffBtn.textContent = 'Run Diff';
  diffBtn.disabled = true;
  opts.querySelector('.compare-controls').appendChild(diffBtn);

  function getPageText(pageData) {
    if (!pageData || !pageData.textItems) return '';
    return pageData.textItems.map(item => item.str).join(' ');
  }

  function splitLines(text) {
    return text.split('\n');
  }

  function splitWords(line) {
    return line.match(/\S+|\s+/g) || [];
  }

  function myersDiff(a, b) {
    const n = a.length, m = b.length;
    const maxD = n + m;
    const v = new Array(2 * maxD + 1);
    const trace = [];

    for (let d = 0; d <= maxD; d++) {
      const vd = new Array(2 * d + 1);
      for (let k = -d; k <= d; k += 2) {
        let x, y;
        if (k === -d || (k !== d && v[k + 1 + maxD] < v[k - 1 + maxD])) {
          x = v[k + 1 + maxD];
        } else {
          x = v[k - 1 + maxD] + 1;
        }
        y = x - k;
        while (x < n && y < m && a[x] === b[y]) {
          x++; y++;
        }
        vd[k + d] = x;
        if (x >= n && y >= m) {
          trace.push({ d, v: vd });
          return buildPath(trace, a, b, n, m);
        }
      }
      trace.push({ d, v: vd });
    }
    return buildPath(trace, a, b, n, m);
  }

  function buildPath(trace, a, b, n, m) {
    const path = [];
    let x = n, y = m;
    for (let i = trace.length - 1; i >= 0; i--) {
      const { d, v } = trace[i];
      const k = x - y;
      const prevK = (k === -d || (k !== d && v[k + 1 + d] < v[k - 1 + d])) ? k + 1 : k - 1;
      const prevX = v[prevK + d];
      const prevY = prevX - prevK;
      while (x > prevX && y > prevY) {
        path.unshift({ type: 'equal', value: a[x - 1] });
        x--; y--;
      }
      if (x > prevX) {
        path.unshift({ type: 'remove', value: a[x - 1] });
        x--;
      } else if (y > prevY) {
        path.unshift({ type: 'add', value: b[y - 1] });
        y--;
      }
    }
    return path;
  }

  function diffTextLayers(pageA, pageB) {
    const textA = getPageText(pageA);
    const textB = getPageText(pageB);
    const linesA = splitLines(textA);
    const linesB = splitLines(textB);

    const lineDiff = myersDiff(linesA, linesB);

    const ops = [];
    let offset = 0;

    for (const lineOp of lineDiff) {
      if (lineOp.type === 'equal') {
        const line = lineOp.value;
        ops.push({ type: 'equal', text: line, offset, length: line.length });
        offset += line.length + 1;
      } else if (lineOp.type === 'remove') {
        const wordsA = splitWords(lineOp.value);
        const nextOp = lineDiff[lineDiff.indexOf(lineOp) + 1];
        if (nextOp && nextOp.type === 'add') {
          const wordsB = splitWords(nextOp.value);
          const wordDiff = myersDiff(wordsA, wordsB);
          for (const wordOp of wordDiff) {
            const text = wordOp.value;
            if (wordOp.type === 'equal') {
              ops.push({ type: 'equal', text, offset, length: text.length });
            } else if (wordOp.type === 'remove') {
              ops.push({ type: 'remove', text, offset, length: text.length });
            } else {
              ops.push({ type: 'add', text, offset, length: text.length });
            }
            offset += text.length;
          }
        } else {
          for (const word of wordsA) {
            ops.push({ type: 'remove', text: word, offset, length: word.length });
            offset += word.length;
          }
        }
        offset += 1;
      } else if (lineOp.type === 'add') {
        const wordsB = splitWords(lineOp.value);
        const prevOp = lineDiff[lineDiff.indexOf(lineOp) - 1];
        if (prevOp && prevOp.type === 'remove') {
          // Already handled in remove case
        } else {
          for (const word of wordsB) {
            ops.push({ type: 'add', text: word, offset, length: word.length });
            offset += word.length;
          }
          offset += 1;
        }
      }
    }

    return { ops };
  }

  async function renderOverlay(pageA, pageB, diff) {
    const pdfA = pdfs.a;
    const pdfB = pdfs.b;
    if (!pdfA || !pdfB) return null;

    const totalPages = Math.max(pdfA.numPages, pdfB.numPages);
    const useTiled = totalPages > 50;

    const scale = currentZoom;
    const maxDpi = 200;
    const dpi = 72 * scale;
    const effectiveScale = dpi > maxDpi ? maxDpi / 72 : scale;

    const pgA = await pdfA.getPage(currentPages.a);
    const pgB = await pdfB.getPage(currentPages.b);

    const viewportA = pgA.getViewport({ scale: effectiveScale });
    const viewportB = pgB.getViewport({ scale: effectiveScale });

    const offscreenA = document.createElement('canvas');
    offscreenA.width = Math.floor(viewportA.width);
    offscreenA.height = Math.floor(viewportA.height);
    const ctxA = offscreenA.getContext('2d');
    ctxA.fillStyle = '#fff';
    ctxA.fillRect(0, 0, offscreenA.width, offscreenA.height);
    await pgA.render({ canvasContext: ctxA, viewport: viewportA }).promise;

    const offscreenB = document.createElement('canvas');
    offscreenB.width = Math.floor(viewportB.width);
    offscreenB.height = Math.floor(viewportB.height);
    const ctxB = offscreenB.getContext('2d');
    ctxB.fillStyle = '#fff';
    ctxB.fillRect(0, 0, offscreenB.width, offscreenB.height);
    await pgB.render({ canvasContext: ctxB, viewport: viewportB }).promise;

    const overlayCanvas = document.createElement('canvas');
    overlayCanvas.width = offscreenB.width;
    overlayCanvas.height = offscreenB.height;
    const ctxOverlay = overlayCanvas.getContext('2d');

    ctxOverlay.drawImage(offscreenB, 0, 0);

    if (diff && diff.ops) {
      const textContentA = await pgA.getTextContent();
      const textContentB = await pgB.getTextContent();

      const itemsA = textContentA.items;
      const itemsB = textContentB.items;

      if (useTiled) {
        const tileSize = 1024;
        const tilesX = Math.ceil(offscreenB.width / tileSize);
        const tilesY = Math.ceil(offscreenB.height / tileSize);

        for (let ty = 0; ty < tilesY; ty++) {
          for (let tx = 0; tx < tilesX; tx++) {
            const tileX = tx * tileSize;
            const tileY = ty * tileSize;
            const tileW = Math.min(tileSize, offscreenB.width - tileX);
            const tileH = Math.min(tileSize, offscreenB.height - tileY);

            const tileCanvas = document.createElement('canvas');
            tileCanvas.width = tileW;
            tileCanvas.height = tileH;
            const tileCtx = tileCanvas.getContext('2d');
            tileCtx.drawImage(offscreenB, tileX, tileY, tileW, tileH, 0, 0, tileW, tileH);

            for (const op of diff.ops) {
              if (op.type === 'equal') continue;

              const color = op.type === 'add' ? `rgba(40, 167, 69, ${currentOpacity})` :
                            op.type === 'remove' ? `rgba(220, 53, 69, ${currentOpacity})` :
                            `rgba(255, 193, 7, ${currentOpacity})`;

              const targetItems = op.type === 'remove' ? itemsA : itemsB;
              const charWidth = targetItems.length > 0 ? (targetItems[0].width || 10) : 10;
              const startIdx = Math.floor(op.offset / charWidth);
              const endIdx = Math.min(startIdx + Math.ceil(op.length / charWidth), targetItems.length);

              for (let i = startIdx; i < endIdx && i < targetItems.length; i++) {
                const item = targetItems[i];
                const transform = item.transform;
                const x = (transform[4] * effectiveScale) - tileX;
                const y = tileH - ((offscreenB.height - (transform[5] * effectiveScale) - (item.height * effectiveScale)) - tileY);
                const w = item.width * effectiveScale;
                const h = item.height * effectiveScale;

                if (x + w > 0 && x < tileW && y + h > 0 && y < tileH) {
                  tileCtx.fillStyle = color;
                  tileCtx.fillRect(Math.max(0, x), Math.max(0, y), Math.min(w, tileW - x), Math.min(h, tileH - y));
                }
              }
            }

            ctxOverlay.drawImage(tileCanvas, tileX, tileY);
            await new Promise(r => setTimeout(r, 0));
          }
        }
      } else {
        let opIndex = 0;
        for (const op of diff.ops) {
          if (op.type === 'equal') {
            opIndex += op.length;
            continue;
          }

          const color = op.type === 'add' ? `rgba(40, 167, 69, ${currentOpacity})` :
                        op.type === 'remove' ? `rgba(220, 53, 69, ${currentOpacity})` :
                        `rgba(255, 193, 7, ${currentOpacity})`;

          const targetItems = op.type === 'remove' ? itemsA : itemsB;
          const charWidth = targetItems.length > 0 ? (targetItems[0].width || 10) : 10;
          const startIdx = Math.floor(op.offset / charWidth);
          const endIdx = Math.min(startIdx + Math.ceil(op.length / charWidth), targetItems.length);

          for (let i = startIdx; i < endIdx && i < targetItems.length; i++) {
            const item = targetItems[i];
            const transform = item.transform;
            const x = (transform[4] * effectiveScale);
            const y = offscreenB.height - (transform[5] * effectiveScale) - (item.height * effectiveScale);
            const w = item.width * effectiveScale;
            const h = item.height * effectiveScale;

            ctxOverlay.fillStyle = color;
            ctxOverlay.fillRect(x, y, w, h);
          }

          opIndex += op.length;
        }
      }
    }

    return overlayCanvas;
  }

  diffBtn.addEventListener('click', async () => {
    if (!pdfs.a || !pdfs.b) { status('Load both PDFs first'); return; }
    if (!pdfs.a.pages || !pdfs.b.pages) { status('Extract text first'); return; }

    const pageA = pdfs.a.pages[currentPages.a - 1];
    const pageB = pdfs.b.pages[currentPages.b - 1];

    if (!pageA || !pageB) { status('Select pages first'); return; }

    status('Computing diff…');
    const diff = diffTextLayers(pageA, pageB);
    pdfs.diff = diff;
    copyDiffBtn.disabled = false;
    downloadDiffBtn.disabled = false;
    status('Diff complete');
    renderDiffPanel(diff);

    if (overlayCb.checked) {
      status('Rendering overlay…');
      const overlayCanvas = await renderOverlay(pageA, pageB, diff);
      if (overlayCanvas) {
        pdfs.overlayCanvas = overlayCanvas;
        downloadOverlayBtn.disabled = false;
        updatePageDisplay();
      }
      status('Overlay ready');
    }
  });

  overlayCb.addEventListener('change', async () => {
    if (!pdfs.a || !pdfs.b || !pdfs.diff) {
      overlayCb.checked = false;
      return;
    }
    if (overlayCb.checked) {
      const pageA = pdfs.a.pages[currentPages.a - 1];
      const pageB = pdfs.b.pages[currentPages.b - 1];
      if (!pageA || !pageB) { overlayCb.checked = false; return; }
      status('Rendering overlay…');
      const overlayCanvas = await renderOverlay(pageA, pageB, pdfs.diff);
      if (overlayCanvas) {
        pdfs.overlayCanvas = overlayCanvas;
        updatePageDisplay();
      }
      status('Overlay ready');
    } else {
      pdfs.overlayCanvas = null;
      updatePageDisplay();
    }
  });

  copyDiffBtn.addEventListener('click', () => {
    if (!pdfs.diff) { status('No diff to copy'); return; }
    navigator.clipboard.writeText(JSON.stringify(pdfs.diff, null, 2))
      .then(() => status('Diff JSON copied to clipboard'))
      .catch(() => status('Failed to copy'));
  });

  downloadOverlayBtn.addEventListener('click', () => {
    if (!pdfs.overlayCanvas) { status('No overlay to download'); return; }
    pdfs.overlayCanvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `overlay-page-${currentPages.a}-${currentPages.b}.png`;
      a.click();
      URL.revokeObjectURL(url);
      status('Overlay PNG downloaded');
    }, 'image/png');
  });

  downloadDiffBtn.addEventListener('click', () => {
    if (!pdfs.diff) { status('No diff to download'); return; }
    const pageA = pdfs.a.pages[currentPages.a - 1];
    const pageB = pdfs.b.pages[currentPages.b - 1];
    if (!pageA || !pageB) { status('Select pages first'); return; }

    const textA = getPageText(pageA);
    const textB = getPageText(pageB);
    const linesA = splitLines(textA);
    const linesB = splitLines(textB);

    const lineDiff = myersDiff(linesA, linesB);

    let diffText = `--- PDF A page ${currentPages.a}\n+++ PDF B page ${currentPages.b}\n`;
    for (const op of lineDiff) {
      if (op.type === 'equal') {
        diffText += ` ${op.value}\n`;
      } else if (op.type === 'remove') {
        diffText += `-${op.value}\n`;
      } else if (op.type === 'add') {
        diffText += `+${op.value}\n`;
      }
    }

    const blob = new Blob([diffText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diff-page-${currentPages.a}-${currentPages.b}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    status('Diff.txt downloaded');
  });

  function renderDiffPanel(diff) {
    pagesEl.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = '8px';
    wrap.style.flex = '1';
    wrap.style.minWidth = '0';

    const label = document.createElement('div');
    label.className = 'muted';
    label.style.fontSize = '13px';
    label.textContent = 'Diff Result';
    wrap.appendChild(label);

    const diffEl = document.createElement('div');
    diffEl.style.flex = '1';
    diffEl.style.overflow = 'auto';
    diffEl.style.maxHeight = '500px';
    diffEl.style.padding = '12px';
    diffEl.style.border = '1px solid var(--line)';
    diffEl.style.borderRadius = '8px';
    diffEl.style.background = '#fff';
    diffEl.style.fontFamily = 'monospace';
    diffEl.style.fontSize = '12px';
    diffEl.style.lineHeight = '1.5';
    diffEl.style.whiteSpace = 'pre-wrap';
    diffEl.style.wordBreak = 'break-word';

    for (const op of diff.ops) {
      const span = document.createElement('span');
      span.textContent = op.text;
      if (op.type === 'add') {
        span.style.background = '#d4edda';
        span.style.color = '#155724';
      } else if (op.type === 'remove') {
        span.style.background = '#f8d7da';
        span.style.color = '#721c24';
        span.style.textDecoration = 'line-through';
      }
      diffEl.appendChild(span);
    }

    wrap.appendChild(diffEl);
    pagesEl.appendChild(wrap);
  }

  extractBtn.addEventListener('click', extractTextLayers);

  return () => {
    pdfs.a = pdfs.b = null;
    canvases.a = canvases.b = null;
    page.cleanup();
  };
}