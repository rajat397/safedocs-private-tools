// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/redact-burn.js — rect-select redaction on canvas preview, fillRect black, raster rebuild (burned copy). (P2 shell UI.)
import { shell } from '../_lib/page.js';
export async function mount(el, ctx = {}) {
  const tool = (ctx && ctx.tool) || {};
  const page = shell(el, tool, ctx);
  const status = page.status;
  const setProgress = page.setProgress;
  const q = (s) => page.root.querySelector(`[data-f="${s}"]`);
  const TOOL_ID = (ctx && ctx.tool && ctx.tool.id) || "pdf-redact-burn";

  page.optionsEl.innerHTML = `
    <label>Password (if encrypted)
      <input type="password" data-f="pw" placeholder="Optional" />
    </label>
    <div class="btnrow" style="margin-top:0">
      <button type="button" class="secondary" data-f="open">Open preview</button>
      <button type="button" class="secondary" data-f="prev">‹ Prev</button>
      <span data-f="plabel" class="muted" style="font-size:13px;align-self:center">no file</span>
      <button type="button" class="secondary" data-f="next">Next ›</button>
    </div>
    <p class="muted" style="margin:0;font-size:12px">Drag a rectangle on the preview to black it out. Repeat per page.</p>
    <div class="btnrow" style="margin-top:0">
      <button type="button" class="secondary" data-f="undo">Undo box</button>
      <button type="button" class="secondary" data-f="clearpage">Clear page boxes</button>
    </div>`;

  const cv = document.createElement("canvas");
  cv.dataset.f = "cv";
  cv.style.cssText = "max-width:100%;border:1px solid #e2e8f0;border-radius:8px;background:#fff;touch-action:none;cursor:crosshair";
  page.outputEl.append(cv);

  let files = [];
  page.onFiles((accepted) => { files = [...accepted]; });

  const liveCanvases = new Set();
  const RASTER_MAX_DESKTOP = 100;
  const RASTER_MAX_MOBILE = 25;
  const RASTER_MAX_PIXELS = 16000000;
  const RASTER_MIN_SCALE = 0.4;
  const BURN_SCALE = 1.5;
  const BURN_QUALITY = 0.85;

  let pdfDoc = null;
  let fileName = "redacted.pdf";
  let numPages = 0;
  let cur = 1;
  let baseCanvas = null; // offscreen pristine render of current page
  let baseScale = 1.5;
  let boxes = new Map(); // pageNum -> [{nx,ny,nw,nh}] normalized 0..1
  let drag = null;

  function capsInfo(toolId) {
    try { if (typeof ctx.activeCaps === "function") return ctx.activeCaps(toolId); } catch {}
    return null;
  }
  function checkCaps(list, opts) {
    try {
      if (typeof ctx.checkFiles === "function") {
        const r = ctx.checkFiles(list, opts);
        if (r && r.rejected && r.rejected.length) {
          status("Rejected: " + r.rejected.map((x) => `${x.file?.name || "file"}: ${x.reason}`).join(" | "));
        }
        return r;
      }
    } catch {}
    return null;
  }
  function isMobileDevice() {
    try {
      const c = capsInfo(TOOL_ID);
      if (c) {
        if (c.mobile === true || c.isMobile === true) return true;
        if (c.device === "mobile" || c.formFactor === "mobile") return true;
      }
      if (typeof ctx.isMobile === "boolean" && ctx.isMobile) return true;
      if (typeof ctx.isMobile === "function" && ctx.isMobile()) return true;
    } catch {}
    try {
      if (typeof navigator !== "undefined") {
        if (navigator.userAgentData && navigator.userAgentData.mobile === true) return true;
        if (/Mobi|Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "")) return true;
      }
      if (typeof matchMedia === "function" && typeof screen !== "undefined") {
        if (matchMedia("(pointer: coarse)").matches && Math.min(screen.width || 9999, screen.height || 9999) < 820) return true;
      }
    } catch {}
    return false;
  }
  function rasterDimCap(mobile) {
    try {
      const c = capsInfo(TOOL_ID);
      if (c && Number.isFinite(+c.maxImageDim)) return +c.maxImageDim;
    } catch {}
    return mobile ? 8000 : 12000;
  }
  function saveBytes(bytes, filename, mime = "application/pdf") { return ctx.download(bytes, filename, mime); }
  function clampScale(s, fallback = 1.5) {
    s = parseFloat(s);
    if (!Number.isFinite(s)) return fallback;
    return Math.min(3, Math.max(0.5, s));
  }

  async function loadPdfLib() {
    if (globalThis.PDFLib) return globalThis.PDFLib;
    try {
      const m = await import("https://esm.sh/pdf-lib@1.17.1");
      const lib = m.default ?? m;
      if (lib?.PDFDocument) { globalThis.PDFLib = lib; return lib; }
    } catch {}
    for (const src of [
      "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js",
      "https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js",
    ]) {
      try { await new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); if (globalThis.PDFLib) return globalThis.PDFLib; } catch {}
    }
    throw new Error("Could not load pdf-lib@1.17.1");
  }
  async function loadPdfJs() {
    if (globalThis.pdfjsLib) return globalThis.pdfjsLib;
    for (const src of [
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
      "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js",
    ]) {
      try {
        await new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
        if (globalThis.pdfjsLib) {
          globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          return globalThis.pdfjsLib;
        }
      } catch {}
    }
    throw new Error("Could not load pdf.js (check network).");
  }
  function assertPdfHeader(bytes) {
    if (!bytes || bytes.length < 5 || bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46 || bytes[4] !== 0x2D) throw new Error("Not a PDF (missing %PDF header)");
  }
  async function openPdfWithPassword(pdfjsLib, data, getPassword) {
    assertPdfHeader(data);
    const pw = (getPassword && getPassword()) || "";
    try {
      const task = pdfjsLib.getDocument(pw ? { data: data.slice(), password: pw } : { data: data.slice() });
      return await task.promise;
    } catch (e) {
      if ((e && e.name === "PasswordNeededException") || /password|encrypted/i.test(String((e && e.message) || e))) {
        if (!pw) throw new Error("This PDF is encrypted — enter its password and try again.");
        try {
          return await pdfjsLib.getDocument({ data: data.slice(), password: pw }).promise;
        } catch (e2) {
          if (e2 && e2.name === "PasswordNeededException") throw new Error("Wrong password for this encrypted PDF.");
          throw new Error("Could not open encrypted PDF: " + ((e2 && e2.message) || e2));
        }
      }
      throw e;
    }
  }

  function pageBoxes(n) {
    if (!boxes.has(n)) boxes.set(n, []);
    return boxes.get(n);
  }
  function boxCount() {
    let t = 0;
    boxes.forEach((v) => { t += v.length; });
    return t;
  }

  function repaint(previewRect = null) {
    const c = q("cv");
    if (!baseCanvas) return;
    c.width = baseCanvas.width;
    c.height = baseCanvas.height;
    const c2d = c.getContext("2d");
    c2d.fillStyle = "#fff";
    c2d.fillRect(0, 0, c.width, c.height);
    c2d.drawImage(baseCanvas, 0, 0);
    c2d.fillStyle = "#000";
    for (const b of pageBoxes(cur)) {
      c2d.fillRect(b.nx * c.width, b.ny * c.height, b.nw * c.width, b.nh * c.height);
    }
    if (previewRect) {
      c2d.fillStyle = "rgba(0,0,0,0.85)";
      c2d.fillRect(previewRect.x, previewRect.y, previewRect.w, previewRect.h);
      c2d.strokeStyle = "#fff";
      c2d.setLineDash([4, 3]);
      c2d.strokeRect(previewRect.x + 0.5, previewRect.y + 0.5, previewRect.w, previewRect.h);
      c2d.setLineDash([]);
    }
  }

  function canvasPos(evt) {
    const c = q("cv");
    const r = c.getBoundingClientRect();
    const cx = ((evt.clientX - r.left) / Math.max(1, r.width)) * c.width;
    const cy = ((evt.clientY - r.top) / Math.max(1, r.height)) * c.height;
    return {
      x: Math.min(c.width, Math.max(0, cx)),
      y: Math.min(c.height, Math.max(0, cy)),
    };
  }

  async function renderPage(n) {
    if (!pdfDoc) { status("Open a PDF first."); return; }
    cur = Math.min(numPages, Math.max(1, n));
    status(`Rendering page ${cur}/${numPages}…`);
    const pg = await pdfDoc.getPage(cur);
    try {
      const mobile = isMobileDevice();
      const maxDim = rasterDimCap(mobile);
      let scale = clampScale(mobile ? 1.0 : 1.5);
      let viewport = pg.getViewport({ scale });
      let vw = Math.floor(viewport.width);
      let vh = Math.floor(viewport.height);
      if (vw * vh > RASTER_MAX_PIXELS || vw > maxDim || vh > maxDim) {
        const fit = Math.min(Math.sqrt(RASTER_MAX_PIXELS / Math.max(1, vw * vh)), vw > 0 ? maxDim / vw : 1, vh > 0 ? maxDim / vh : 1);
        scale = scale * fit;
        if (!Number.isFinite(scale) || scale < RASTER_MIN_SCALE) throw new Error(`Page ${cur} too large to preview safely (${vw}×${vh}px exceeds 16MP / ${maxDim}px cap).`);
        viewport = pg.getViewport({ scale });
        vw = Math.floor(viewport.width);
        vh = Math.floor(viewport.height);
      }
      baseScale = scale;
      if (!baseCanvas) { baseCanvas = document.createElement("canvas"); liveCanvases.add(baseCanvas); }
      baseCanvas.width = vw;
      baseCanvas.height = vh;
      const c2d = baseCanvas.getContext("2d");
      c2d.fillStyle = "#fff";
      c2d.fillRect(0, 0, vw, vh);
      await pg.render({ canvasContext: c2d, viewport }).promise;
      repaint();
      const n2 = pageBoxes(cur).length;
      q("plabel").textContent = `p${cur}/${numPages} · ${n2} box(es) · total ${boxCount()}`;
      status(n2 ? `Page ${cur}/${numPages} — ${n2} black box(es). Drag for more.` : `Page ${cur}/${numPages} — drag to redact.`);
    } finally {
      try { await pg.cleanup?.(); } catch {}
    }
  }

  const onOpen = async () => {
    try {
      const f = files[0] || page.getFiles()[0];
      if (!f) { status("Pick a PDF."); return; }
      const chk = checkCaps([f], { toolId: TOOL_ID, accept: ".pdf,application/pdf", multiple: false });
      const file = (chk && chk.accepted && chk.accepted.length) ? chk.accepted[0] : f;
      if (chk && chk.accepted && !chk.accepted.length) return;
      status("Loading pdf.js…");
      const pdfjsLib = await loadPdfJs();
      if (pdfDoc) { try { await pdfDoc.destroy?.(); } catch {} pdfDoc = null; }
      boxes = new Map();
      cur = 1;
      fileName = file.name || "redacted.pdf";
      const data = new Uint8Array(await file.arrayBuffer());
      pdfDoc = await openPdfWithPassword(pdfjsLib, data, () => q("pw").value);
      numPages = pdfDoc.numPages;
      const mobile = isMobileDevice();
      const cap = mobile ? RASTER_MAX_MOBILE : RASTER_MAX_DESKTOP;
      if (numPages > cap) {
        const keep = pdfDoc;
        pdfDoc = null;
        numPages = 0;
        try { await keep.destroy?.(); } catch {}
        throw new Error(`Page-count guard: PDF has ${keep.numPages} pages (cap ${cap} on ${mobile ? "mobile" : "desktop"}). Split into ≤${cap}-page parts.`);
      }
      await renderPage(1);
    } catch (e) { status("Error: " + (e?.message || e)); }
    finally { try { q("pw").value = ""; } catch {} }
  };

  page.runBtn("Burn & download", async (got) => {
    let tmpCanvas = null;
    try {
      files = [...(got || [])];
      if (!pdfDoc) { status("Open a PDF preview first."); return; }
      if (!boxCount()) { status("No boxes yet — drag at least one rectangle on the preview."); return; }
      const mobile = isMobileDevice();
      const cap = mobile ? RASTER_MAX_MOBILE : RASTER_MAX_DESKTOP;
      const maxDim = rasterDimCap(mobile);
      if (numPages > cap) throw new Error(`Page-count guard: PDF has ${numPages} pages (cap ${cap} on ${mobile ? "mobile" : "desktop"}).`);
      status("Loading pdf-lib…");
      const { PDFDocument } = await loadPdfLib();
      const out = await PDFDocument.create();
      setProgress(0);
      for (let i = 1; i <= numPages; i++) {
        status(`Burning page ${i}/${numPages}…`);
        const pg = await pdfDoc.getPage(i);
        try {
          let scale = clampScale(BURN_SCALE);
          let viewport = pg.getViewport({ scale });
          let vw = Math.floor(viewport.width);
          let vh = Math.floor(viewport.height);
          if (vw * vh > RASTER_MAX_PIXELS || vw > maxDim || vh > maxDim) {
            const fit = Math.min(Math.sqrt(RASTER_MAX_PIXELS / Math.max(1, vw * vh)), vw > 0 ? maxDim / vw : 1, vh > 0 ? maxDim / vh : 1);
            scale = scale * fit;
            if (!Number.isFinite(scale) || scale < RASTER_MIN_SCALE) throw new Error(`Page ${i}/${numPages} too large to burn safely (${vw}×${vh}px exceeds 16MP / ${maxDim}px cap).`);
            viewport = pg.getViewport({ scale });
            vw = Math.floor(viewport.width);
            vh = Math.floor(viewport.height);
            if (vw * vh > RASTER_MAX_PIXELS || vw > maxDim || vh > maxDim || vw < 1 || vh < 1) throw new Error(`Page ${i}/${numPages} too large to burn safely (${vw}×${vh}px exceeds 16MP / ${maxDim}px cap).`);
          }
          tmpCanvas = document.createElement("canvas");
          liveCanvases.add(tmpCanvas);
          tmpCanvas.width = vw;
          tmpCanvas.height = vh;
          const c2d = tmpCanvas.getContext("2d");
          c2d.fillStyle = "#fff";
          c2d.fillRect(0, 0, vw, vh);
          await pg.render({ canvasContext: c2d, viewport }).promise;
          // Burn boxes as opaque pixels — no vector/text survives underneath.
          c2d.fillStyle = "#000";
          for (const b of pageBoxes(i)) {
            const bx = Math.round(b.nx * vw);
            const by = Math.round(b.ny * vh);
            const bw = Math.max(1, Math.round(b.nw * vw));
            const bh = Math.max(1, Math.round(b.nh * vh));
            c2d.fillRect(bx, by, bw, bh);
          }
          const img = await out.embedJpg(tmpCanvas.toDataURL("image/jpeg", BURN_QUALITY));
          const p = out.addPage([img.width, img.height]);
          p.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        } finally {
          try { await pg.cleanup?.(); } catch {}
        }
        tmpCanvas.width = 0;
        tmpCanvas.height = 0;
        liveCanvases.delete(tmpCanvas);
        tmpCanvas = null;
        setProgress(i / numPages);
        await new Promise((r) => setTimeout(r, 0));
      }
      const bytes = await out.save({ useObjectStreams: true });
      // New-file check before sharing: fresh raster copy, header + page count.
      assertPdfHeader(bytes);
      if (!bytes.length) throw new Error("Burn produced an empty file — not downloaded.");
      const verify = await PDFDocument.load(bytes.slice());
      if (verify.getPageCount() !== numPages) throw new Error(`Burn verification failed: output has ${verify.getPageCount()} pages, expected ${numPages}.`);
      try { verify.setTitle(""); verify.setAuthor(""); } catch {}
      const outName = fileName.replace(/\.pdf$/i, "") + "-redacted.pdf";
      saveBytes(bytes, outName, "application/pdf");
      try { q("pw").value = ""; } catch {}
      status(`Done — burned ${boxCount()} box(es) into a new image-only copy (${outName}). Open the COPY and visually confirm every box before sharing. Original text layer is discarded.`);
    } catch (e) { status("Error: " + (e?.message || e)); }
    finally {
      try { q("pw").value = ""; } catch {}
      try { if (tmpCanvas) { tmpCanvas.width = 0; tmpCanvas.height = 0; liveCanvases.delete(tmpCanvas); } } catch {}
      tmpCanvas = null;
    }
  });

  const onDown = (e) => {
    if (!baseCanvas) return;
    e.preventDefault();
    const p = canvasPos(e.touches ? e.touches[0] : e);
    drag = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
  };
  const onMove = (e) => {
    if (!drag) return;
    e.preventDefault();
    const p = canvasPos(e.touches ? e.touches[0] : e);
    drag.x1 = p.x;
    drag.y1 = p.y;
    repaint({
      x: Math.min(drag.x0, drag.x1),
      y: Math.min(drag.y0, drag.y1),
      w: Math.abs(drag.x1 - drag.x0),
      h: Math.abs(drag.y1 - drag.y0),
    });
  };
  const onUp = (e) => {
    if (!drag) return;
    if (e) { try { e.preventDefault(); } catch {} }
    const c = q("cv");
    const x = Math.min(drag.x0, drag.x1);
    const y = Math.min(drag.y0, drag.y1);
    const w = Math.abs(drag.x1 - drag.x0);
    const h = Math.abs(drag.y1 - drag.y0);
    drag = null;
    if (w < 4 || h < 4 || !c.width || !c.height) { repaint(); return; }
    pageBoxes(cur).push({ nx: x / c.width, ny: y / c.height, nw: w / c.width, nh: h / c.height });
    repaint();
    q("plabel").textContent = `p${cur}/${numPages} · ${pageBoxes(cur).length} box(es) · total ${boxCount()}`;
    status(`Box added on p${cur} (${pageBoxes(cur).length} here, ${boxCount()} total).`);
  };

  cv.addEventListener("mousedown", onDown);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  cv.addEventListener("touchstart", onDown, { passive: false });
  cv.addEventListener("touchmove", onMove, { passive: false });
  cv.addEventListener("touchend", onUp, { passive: false });
  const onPrev = () => renderPage(cur - 1).catch((e) => status("Error: " + (e?.message || e)));
  const onNext = () => renderPage(cur + 1).catch((e) => status("Error: " + (e?.message || e)));
  const onUndo = () => {
    const arr = pageBoxes(cur);
    arr.pop();
    repaint();
    q("plabel").textContent = numPages ? `p${cur}/${numPages} · ${arr.length} box(es) · total ${boxCount()}` : "no file";
    status("Undone (current page).");
  };
  const onClear = () => {
    boxes.set(cur, []);
    repaint();
    q("plabel").textContent = numPages ? `p${cur}/${numPages} · 0 box(es) · total ${boxCount()}` : "no file";
    status(`Cleared boxes on p${cur}.`);
  };
  q("open").addEventListener("click", onOpen);
  q("prev").addEventListener("click", onPrev);
  q("next").addEventListener("click", onNext);
  q("undo").addEventListener("click", onUndo);
  q("clearpage").addEventListener("click", onClear);

  return () => {
    files = [];
    try {
      if (baseCanvas) { baseCanvas.width = 0; baseCanvas.height = 0; liveCanvases.delete(baseCanvas); }
      liveCanvases.forEach((c) => { c.width = 0; c.height = 0; });
      liveCanvases.clear();
    } catch {}
    if (pdfDoc) { try { pdfDoc.destroy?.(); } catch {} pdfDoc = null; }
    baseCanvas = null;
    boxes = new Map();
    drag = null;
    try {
      cv.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      cv.removeEventListener("touchstart", onDown);
      cv.removeEventListener("touchmove", onMove);
      cv.removeEventListener("touchend", onUp);
    } catch {}
    try { q("pw").value = ""; } catch {}
    page.cleanup();
  };
}
