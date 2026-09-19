// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/target-size.js — shrink PDF to ~1/2/5MB via raster JPEG quality loop. (P2 shell UI.)
import { shell } from '../_lib/page.js';
export async function mount(el, ctx = {}) {
  const tool = (ctx && ctx.tool) || {};
  const page = shell(el, tool, ctx);
  const status = page.status;
  const setProgress = page.setProgress;
  const q = (s) => page.root.querySelector(`[data-f="${s}"]`);
  const TOOL_ID = (ctx && ctx.tool && ctx.tool.id) || "pdf-target-size";

  page.optionsEl.innerHTML = `
    <label>Password (if encrypted)
      <input type="password" data-f="pw" placeholder="Optional" />
    </label>
    <label>Target size
      <select data-f="preset">
        <option value="1048576">~1 MB</option>
        <option value="2097152" selected>~2 MB</option>
        <option value="5242880">~5 MB</option>
      </select>
    </label>
    <p class="muted" style="margin:0;font-size:12px">Best-effort: rasterizes pages to JPEG, stepping quality down until under target (±30% tolerance, else warns with closest).</p>`;

  let files = [];
  page.onFiles((accepted) => { files = [...accepted]; });

  const liveCanvases = new Set();
  const RASTER_MAX_DESKTOP = 200;
  const RASTER_MAX_MOBILE = 50;
  // Same raster memory guard as compress.js (LIMITS max image dim 12000px/8000px).
  const RASTER_MAX_PIXELS = 16000000; // 16MP per page
  const RASTER_MIN_SCALE = 0.4;

  function capsInfo(toolId) {
    try { if (typeof ctx.activeCaps === "function") return ctx.activeCaps(toolId); } catch {}
    return null;
  }
  function rasterDimCap(mobile) {
    try {
      const c = capsInfo(TOOL_ID);
      if (c && Number.isFinite(+c.maxImageDim)) return +c.maxImageDim;
    } catch {}
    return mobile ? 8000 : 12000;
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
    return Math.min(3, Math.max(RASTER_MIN_SCALE, s));
  }
  function fmt(n) {
    if (n >= 1048576) return (n / 1048576).toFixed(2) + " MB";
    if (n >= 1024) return (n / 1024).toFixed(1) + " KB";
    return n + " B";
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

  page.runBtn("Shrink & download", async (got) => {
    let tmpCanvas = null;
    let pdfDoc = null;
    try {
      files = [...(got || [])];
      const f = files[0];
      if (!f) { status("Pick a PDF."); return; }
      const chk = checkCaps([f], { toolId: TOOL_ID, accept: ".pdf,application/pdf", multiple: false });
      const file = (chk && chk.accepted && chk.accepted.length) ? chk.accepted[0] : f;
      if (chk && chk.accepted && !chk.accepted.length) return;
      const target = parseInt(q("preset").value, 10);
      if (!Number.isFinite(target) || target <= 0) { status("Pick a target size."); return; }
      const targetLabel = q("preset").selectedOptions?.[0]?.textContent?.trim() || fmt(target);
      const orig = new Uint8Array(await file.arrayBuffer());
      const origLen = orig.length;
      status("Loading pdf-lib…");
      const { PDFDocument } = await loadPdfLib();

      // Fast path: lossless re-save with object streams — no quality loss.
      try {
        const src = await loadPdfWithPassword(PDFDocument, orig, () => q("pw").value);
        if (src.getPageCount() > 500) throw new Error("Page-count guard: too many pages (cap 500).");
        src.setTitle(""); src.setAuthor(""); src.setProducer(""); src.setCreator("");
        src.setSubject(""); src.setKeywords([]);
        const lossless = await src.save({ useObjectStreams: true, addDefaultPage: false });
        if (lossless.length <= target) {
          saveBytes(lossless, file.name.replace(/\.pdf$/i, "") + `-target-${targetLabel.replace(/[^0-9a-z]+/gi, "")}.pdf`, "application/pdf");
          status(`Done — already fits: lossless re-save ${fmt(origLen)} → ${fmt(lossless.length)} (target ${targetLabel}). No quality loss.`);
          try { q("pw").value = ""; } catch {}
          return;
        }
      } catch (e) {
        // Lossless path fails for some inputs (e.g. needs raster anyway);
        // fall through to raster loop unless it's a guard/password error.
        const msg = String((e && e.message) || e || "");
        if (/Page-count guard|encrypted|password/i.test(msg)) throw e;
      }

      status("Loading pdf.js for raster loop…");
      const pdfjsLib = await loadPdfJs();
      // Pass `orig` directly — openPdfWithPassword makes the single
      // working copy internally (avoids double-cloning the input).
      const pdf = await openPdfWithPassword(pdfjsLib, orig, () => q("pw").value);
      pdfDoc = pdf;
      const mobile = isMobileDevice();
      const rasterMax = mobile ? RASTER_MAX_MOBILE : RASTER_MAX_DESKTOP;
      const maxDim = rasterDimCap(mobile);
      const deviceLabel = mobile ? "mobile" : "desktop";
      if (pdf.numPages > rasterMax) throw new Error(`Page-count guard: PDF has ${pdf.numPages} pages (cap ${rasterMax} for raster on ${deviceLabel}). Try Split into <=${rasterMax}-page parts, or use Desktop (cap ${RASTER_MAX_DESKTOP}).`);
      const baseScale = mobile ? 1.0 : pdf.numPages > 150 ? 1.0 : pdf.numPages > 100 ? 1.2 : 1.5;

      // Quality loop: high quality first, step down until under target.
      // First under-target hit wins (best quality meeting target).
      const rawAttempts = [
        { scale: baseScale, quality: 0.75 },
        { scale: baseScale, quality: 0.6 },
        { scale: baseScale, quality: 0.45 },
        { scale: baseScale * 0.75, quality: 0.4 },
        { scale: 0.6, quality: 0.3 },
        { scale: 0.5, quality: 0.22 },
      ];
      // Clamp + dedupe so small docs don't repeat identical passes.
      const seen = new Set();
      const attempts = [];
      for (const a of rawAttempts) {
        const s = clampScale(a.scale);
        const key = s.toFixed(2) + "@" + a.quality.toFixed(2);
        if (seen.has(key)) continue;
        seen.add(key);
        attempts.push({ scale: s, quality: a.quality });
      }

      let best = null; // smallest bytes so far
      let met = null; // first bytes meeting target

      for (let a = 0; a < attempts.length; a++) {
        const { scale, quality } = attempts[a];
        const out = await PDFDocument.create();
        setProgress((a / attempts.length) * 0.9);
        for (let i = 1; i <= pdf.numPages; i++) {
          try {
            status(`Attempt ${a + 1}/${attempts.length} (scale ${scale.toFixed(2)}, JPEG q${quality}) — page ${i}/${pdf.numPages}…`);
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
                  throw new Error(`Page ${i}/${pdf.numPages} too large to rasterize safely (${vw}×${vh}px exceeds 16MP / ${maxDim}px cap). Try Split into smaller pages.`);
                }
                viewport = pg.getViewport({ scale: pageScale });
                vw = Math.floor(viewport.width);
                vh = Math.floor(viewport.height);
                if (vw * vh > RASTER_MAX_PIXELS || vw > maxDim || vh > maxDim || vw < 1 || vh < 1) {
                  throw new Error(`Page ${i}/${pdf.numPages} too large to rasterize safely (${vw}×${vh}px exceeds 16MP / ${maxDim}px cap). Try Split into smaller pages.`);
                }
                status(`Attempt ${a + 1}/${attempts.length} downscaled to ${vw}×${vh} — page ${i}/${pdf.numPages}…`);
              }
              tmpCanvas = document.createElement("canvas");
              liveCanvases.add(tmpCanvas);
              tmpCanvas.width = vw;
              tmpCanvas.height = vh;
              const c2d = tmpCanvas.getContext("2d");
              c2d.fillStyle = "#fff"; c2d.fillRect(0, 0, tmpCanvas.width, tmpCanvas.height);
              await pg.render({ canvasContext: c2d, viewport }).promise;
              const dataUrl = tmpCanvas.toDataURL("image/jpeg", quality);
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
            const msg = String((e && e.message) || e || "");
            if (!/too large to rasterize safely|Page-count guard/.test(msg) && /memory|allocation|array buffer|OOM|Maximum call|out of/i.test(msg)) {
              throw new Error(`Out of memory rasterizing page ${i}/${pdf.numPages} (${msg}). Try Split into <=${rasterMax}-page parts.`);
            }
            throw e;
          }
          setProgress(((a + i / pdf.numPages) / attempts.length) * 0.9);
          await new Promise((r) => setTimeout(r, 0));
          if (i % 20 === 0) await new Promise((r) => setTimeout(r, 50));
        }
        const bytes = await out.save({ useObjectStreams: true });
        if (!best || bytes.length < best.bytes.length) best = { bytes, ...attempts[a] };
        status(`Attempt ${a + 1}/${attempts.length} (q${quality}) → ${fmt(bytes.length)} (target ${targetLabel})…`);
        if (bytes.length <= target) { met = { bytes, ...attempts[a] }; break; }
      }

      const chosen = met || best;
      if (!chosen) throw new Error("Raster loop produced no output.");
      const outLabel = targetLabel.replace(/[^0-9a-z]+/gi, "");
      saveBytes(chosen.bytes, file.name.replace(/\.pdf$/i, "") + `-target-${outLabel}.pdf`, "application/pdf");
      setProgress(1);
      if (met) {
        status(`Done — ${fmt(origLen)} → ${fmt(met.bytes.length)} (target ${targetLabel}, scale ${met.scale.toFixed(2)}, JPEG q${met.quality}).`);
      } else if (chosen.bytes.length <= target * 1.3) {
        status(`Done (approximate) — closest ${fmt(chosen.bytes.length)} vs target ${targetLabel} (within +30%, scale ${chosen.scale.toFixed(2)}, JPEG q${chosen.quality}). Original ${fmt(origLen)}.`);
      } else {
        status(`Warning: could not reach ${targetLabel} — smallest was ${fmt(chosen.bytes.length)} (scale ${chosen.scale.toFixed(2)}, JPEG q${chosen.quality}). Downloaded closest; try Split or a larger target. Original ${fmt(origLen)}.`);
      }
      try { q("pw").value = ""; } catch {}
    } catch (e) { status("Error: " + (e?.message || e)); }
    finally {
      try { q("pw").value = ""; } catch {}
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
