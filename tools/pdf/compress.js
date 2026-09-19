// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/compress.js — lossless re-save + raster mode (canvas JPEG q0.7). (P2 shell UI.)
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
    <label>Mode
      <select data-f="mode">
        <option value="lossless">Lossless re-save (object streams, metadata scrub)</option>
        <option value="raster">Rasterize pages → JPEG q0.7 (much smaller, flattens)</option>
      </select>
    </label>`;

  let files = [];
  page.onFiles((accepted) => { files = [...accepted]; });

  const liveCanvases = new Set();
  const RASTER_MAX_DESKTOP = 200;
  const RASTER_MAX_MOBILE = 50;
  // Raster memory guard (aligns with LIMITS max image dim 12000px/8000px):
  // a single A0 page at scale 1.0 is ~60MP+ (~240MB RGBA) and kills tabs.
  const RASTER_MAX_PIXELS = 16000000; // 16MP per page
  const RASTER_MIN_SCALE = 0.4;

  function capsInfo(toolId) {
    try { if (typeof ctx.activeCaps === "function") return ctx.activeCaps(toolId); } catch {}
    return null;
  }
  function rasterDimCap(mobile) {
    try {
      const c = capsInfo("compress");
      if (c && Number.isFinite(+c.maxImageDim)) return +c.maxImageDim;
    } catch {}
    return mobile ? 8000 : 12000;
  }

  function isMobileDevice() {
    try {
      const c = capsInfo("compress");
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
  async function loadPdfWithPassword(PDFDocument, bytes, getPassword) {
    assertPdfHeader(bytes);
    const pw = (getPassword && getPassword()) || "";
    try {
      return await PDFDocument.load(bytes, pw ? { password: pw } : {});
    } catch (e) {
      const msg = String((e && e.message) || e);
      if ((e && e.name === "PasswordNeededException") || /password|encrypted|PasswordNeeded/i.test(msg)) {
        if (!pw) throw new Error("This PDF is encrypted — enter its password and try again.");
        try { return await PDFDocument.load(bytes, { password: pw }); }
        catch (e2) { throw new Error("Encrypted PDF needs the correct password: " + ((e2 && e2.message) || e2)); }
      }
      throw e;
    }
  }
  async function openPdfWithPassword(pdfjsLib, data, getPassword) {
    assertPdfHeader(data);
    const pw = (getPassword && getPassword()) || "";
    // Single working copy: caller passes `orig` directly (no pre-slice);
    // we clone once here and hand ownership to pdf.js, then null refs for GC.
    let src = data;
    data = null;
    let buf = src.slice();
    try {
      const task = pdfjsLib.getDocument(pw ? { data: buf, password: pw } : { data: buf });
      buf = null; // ownership transferred to the pdf.js loading task
      return await task.promise;
    } catch (e) {
      buf = null;
      if ((e && e.name === "PasswordNeededException") || /password|encrypted/i.test(String((e && e.message) || e))) {
        if (!pw) throw new Error("This PDF is encrypted — enter its password and try again.");
        // First buffer was consumed by the failed task; re-clone sequentially
        // so only one live copy exists at a time.
        let retryBuf = src.slice();
        src = null;
        try {
          const retryTask = pdfjsLib.getDocument({ data: retryBuf, password: pw });
          retryBuf = null; // ownership transferred
          return await retryTask.promise;
        } catch (e2) {
          retryBuf = null;
          if (e2 && e2.name === "PasswordNeededException") throw new Error("Wrong password for this encrypted PDF.");
          throw new Error("Could not open encrypted PDF: " + ((e2 && e2.message) || e2));
        }
      }
      throw e;
    } finally {
      buf = null;
      src = null;
    }
  }

  page.runBtn("Compress & download", async (got) => {
    let tmpCanvas = null;
    let pdfDoc = null;
    let origLen = 0;
    try {
      files = [...(got || [])];
      const f = files[0];
      if (!f) { status("Pick a PDF."); return; }
      const chk = checkCaps([f], { toolId: "compress", accept: ".pdf,application/pdf", multiple: false });
      const file = (chk && chk.accepted && chk.accepted.length) ? chk.accepted[0] : f;
      if (chk && chk.accepted && !chk.accepted.length) return;
      const mode = q("mode").value;
      const orig = new Uint8Array(await file.arrayBuffer());
      origLen = orig.length;
      status("Loading pdf-lib…");
      const { PDFDocument } = await loadPdfLib();

      if (mode === "lossless") {
        const src = await loadPdfWithPassword(PDFDocument, orig, () => q("pw").value);
        if (src.getPageCount() > 500) throw new Error("Page-count guard: too many pages (cap 500).");
        src.setTitle(""); src.setAuthor(""); src.setProducer(""); src.setCreator("");
        src.setSubject(""); src.setKeywords([]); src.setProducer("");
        const bytes = await src.save({ useObjectStreams: true, addDefaultPage: false });
        saveBytes(bytes, file.name.replace(/.pdf$/i, "") + "-compressed.pdf", "application/pdf");
        const pct = Math.round((1 - bytes.length / orig.length) * 100);
        status(`Done — ${orig.length} → ${bytes.length} bytes (${pct >= 0 ? pct + "% smaller" : -pct + "% larger"}). Lossless re-save.`);
      } else {
        status("Loading pdf.js for raster mode…");
        const pdfjsLib = await loadPdfJs();
        // Pass `orig` directly — openPdfWithPassword makes the single
        // working copy internally (avoids double-cloning the input).
        const pdf = await openPdfWithPassword(pdfjsLib, orig, () => q("pw").value);
        pdfDoc = pdf;
        const mobile = isMobileDevice();
        const rasterMax = mobile ? RASTER_MAX_MOBILE : RASTER_MAX_DESKTOP;
        const maxDim = rasterDimCap(mobile);
        const deviceLabel = mobile ? "mobile" : "desktop";
        if (pdf.numPages > rasterMax) throw new Error(`Page-count guard: PDF has ${pdf.numPages} pages (cap ${rasterMax} for raster on ${deviceLabel}). Try Lossless mode, Split into <=${rasterMax}-page parts, or use Desktop (cap ${RASTER_MAX_DESKTOP}).`);
        const out = await PDFDocument.create();
        const baseScale = mobile ? 1.0 : pdf.numPages > 150 ? 1.0 : pdf.numPages > 100 ? 1.2 : 1.5;
        const scale = clampScale(baseScale);
        setProgress(0);
        for (let i = 1; i <= pdf.numPages; i++) {
          try {
            status(`Rasterizing page ${i}/${pdf.numPages} (JPEG q0.7)…`);
            const pg = await pdf.getPage(i);
            try {
              // Per-page pixel cap: downscale before render so huge pages
              // (e.g. A0 at scale 1.0) can't OOM the tab.
              let viewport = pg.getViewport({ scale });
              let vw = Math.floor(viewport.width);
              let vh = Math.floor(viewport.height);
              let pageScale = scale;
              const pixels = vw * vh;
              if (pixels > RASTER_MAX_PIXELS || vw > maxDim || vh > maxDim) {
                const fitPixels = Math.sqrt(RASTER_MAX_PIXELS / Math.max(1, pixels));
                const fitW = vw > 0 ? maxDim / vw : 1;
                const fitH = vh > 0 ? maxDim / vh : 1;
                const fit = Math.min(fitPixels, fitW, fitH);
                pageScale = scale * fit;
                if (!Number.isFinite(pageScale) || pageScale < RASTER_MIN_SCALE) {
                  throw new Error(`Page ${i}/${pdf.numPages} too large to rasterize safely (${vw}×${vh}px exceeds 16MP / ${maxDim}px cap). Try Lossless mode or Split into smaller pages.`);
                }
                viewport = pg.getViewport({ scale: pageScale });
                vw = Math.floor(viewport.width);
                vh = Math.floor(viewport.height);
                if (vw * vh > RASTER_MAX_PIXELS || vw > maxDim || vh > maxDim || vw < 1 || vh < 1) {
                  throw new Error(`Page ${i}/${pdf.numPages} too large to rasterize safely (${vw}×${vh}px exceeds 16MP / ${maxDim}px cap). Try Lossless mode or Split into smaller pages.`);
                }
                status(`Rasterizing page ${i}/${pdf.numPages} downscaled to ${vw}×${vh} (JPEG q0.7)…`);
              }
              tmpCanvas = document.createElement("canvas");
              liveCanvases.add(tmpCanvas);
              tmpCanvas.width = vw;
              tmpCanvas.height = vh;
              const c2d = tmpCanvas.getContext("2d");
              c2d.fillStyle = "#fff"; c2d.fillRect(0, 0, tmpCanvas.width, tmpCanvas.height);
              await pg.render({ canvasContext: c2d, viewport }).promise;
              const dataUrl = tmpCanvas.toDataURL("image/jpeg", 0.7);
              const jpg = await out.embedJpg(dataUrl);
              const p = out.addPage([jpg.width, jpg.height]);
              p.drawImage(jpg, { x: 0, y: 0, width: jpg.width, height: jpg.height });
            } finally {
              try { await pg.cleanup?.(); } catch {}
            }
            // Canvas cleanup to free RAM.
            tmpCanvas.width = 0; tmpCanvas.height = 0;
            liveCanvases.delete(tmpCanvas);
            tmpCanvas = null;
          } catch (e) {
            if (e && e.message && e.message.startsWith("Page-count guard:") === false) {
              const msg = String((e && e.message) || e || "");
              if (/memory|allocation|array buffer|OOM|Maximum call|out of/i.test(msg)) {
                throw new Error(`Out of memory rasterizing page ${i}/${pdf.numPages} (${msg}). Try Lossless mode or Split into <=${rasterMax}-page parts.`);
              }
            }
            throw e;
          }
          setProgress(i / pdf.numPages);
          await new Promise((r) => setTimeout(r, 0));
          if (i % 20 === 0) await new Promise((r) => setTimeout(r, 50));
        }
        const bytes = await out.save({ useObjectStreams: true });
        saveBytes(bytes, file.name.replace(/.pdf$/i, "") + "-raster-q07.pdf", "application/pdf");
        status(`Done — rasterized ${pdf.numPages} pages at JPEG q0.7. ${origLen} → ${bytes.length} bytes.`);
      }
      try { q("pw").value = ""; } catch {}
    } catch (e) { status("Error: " + (e?.message || e)); }
    finally {
      try {
        if (tmpCanvas) { tmpCanvas.width = 0; tmpCanvas.height = 0; liveCanvases.delete(tmpCanvas); }
      } catch {}
      // Release pdf.js resources on both success and error paths.
      if (pdfDoc) {
        try { await pdfDoc.destroy?.(); } catch {}
        pdfDoc = null;
      }
      tmpCanvas = null;
    }
  });
  return () => {
    files = [];
    try { liveCanvases.forEach((c) => { c.width = 0; c.height = 0; }); liveCanvases.clear(); } catch {}
    try { q("pw").value = ""; } catch {}
    page.cleanup();
  };
}
