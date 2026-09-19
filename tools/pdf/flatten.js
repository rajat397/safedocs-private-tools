// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/flatten.js — raster burn: render each page via pdf.js, rebuild PDF (burns forms/annotations). (P2 shell UI.)
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
    <label>Quality
      <select data-f="q">
        <option value="0.85">High (JPEG q0.85, 2x)</option>
        <option value="0.7" selected>Balanced (JPEG q0.7, 1.5x)</option>
      </select>
    </label>
    <p class="muted" style="margin:0;font-size:12px">Raster-burn flattens forms/annotations into pixels. Text is no longer selectable.</p>`;

  let files = [];
  page.onFiles((accepted) => { files = [...accepted]; });

  const liveCanvases = new Set();
  const MAX_PAGES = 100;

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
    throw new Error("Could not load pdf.js");
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

  page.runBtn("Flatten & download", async (got) => {
    let tmpCanvas = null;
    try {
      files = [...(got || [])];
      const f = files[0];
      if (!f) { status("Pick a PDF."); return; }
      const chk = checkCaps([f], { toolId: "flatten", accept: ".pdf,application/pdf", multiple: false });
      const file = (chk && chk.accepted && chk.accepted.length) ? chk.accepted[0] : f;
      if (chk && chk.accepted && !chk.accepted.length) return;
      const qual = parseFloat(q("q").value);
      const scale = clampScale(qual >= 0.85 ? 2 : 1.5);
      status("Loading libs…");
      const [{ PDFDocument }, pdfjsLib] = [await loadPdfLib(), await loadPdfJs()];
      const orig = new Uint8Array(await file.arrayBuffer());
      const pdf = await openPdfWithPassword(pdfjsLib, orig.slice(), () => q("pw").value);
      if (pdf.numPages > MAX_PAGES) throw new Error(`Page-count guard: PDF has ${pdf.numPages} pages (cap ${MAX_PAGES} for raster burn).`);
      const out = await PDFDocument.create();
      for (let i = 1; i <= pdf.numPages; i++) {
        status(`Burning page ${i}/${pdf.numPages}…`);
        const pg = await pdf.getPage(i);
        const viewport = pg.getViewport({ scale });
        tmpCanvas = document.createElement("canvas");
        liveCanvases.add(tmpCanvas);
        tmpCanvas.width = Math.floor(viewport.width); tmpCanvas.height = Math.floor(viewport.height);
        const c2d = tmpCanvas.getContext("2d");
        c2d.fillStyle = "#fff"; c2d.fillRect(0, 0, tmpCanvas.width, tmpCanvas.height);
        await pg.render({ canvasContext: c2d, viewport }).promise;
        const img = await out.embedJpg(tmpCanvas.toDataURL("image/jpeg", qual));
        const p = out.addPage([img.width, img.height]);
        p.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        tmpCanvas.width = 0; tmpCanvas.height = 0;
        liveCanvases.delete(tmpCanvas);
        tmpCanvas = null;
        setProgress(i / pdf.numPages);
      }
      const bytes = await out.save({ useObjectStreams: true });
      saveBytes(bytes, file.name.replace(/\.pdf$/i, "") + "-flattened.pdf", "application/pdf");
      try { q("pw").value = ""; } catch {}
      status(`Done — flattened ${pdf.numPages} page(s) to image-only PDF.`);
    } catch (e) { status("Error: " + (e?.message || e)); }
    finally {
      try { if (tmpCanvas) { tmpCanvas.width = 0; tmpCanvas.height = 0; liveCanvases.delete(tmpCanvas); } } catch {}
    }
  });
  return () => {
    files = [];
    try { liveCanvases.forEach((c) => { c.width = 0; c.height = 0; }); liveCanvases.clear(); } catch {}
    try { q("pw").value = ""; } catch {}
    page.cleanup();
  };
}
