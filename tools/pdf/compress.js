// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/compress.js — lossless re-save + raster mode (canvas JPEG q0.7).
export async function mount(el, ctx = {}) {
  el.innerHTML = `
    <div style="display:grid;gap:10px">
      <label style="font-size:13px;font-weight:600">Source PDF
        <input type="file" data-f="file" accept="application/pdf,.pdf" />
      </label>
      <label style="font-size:13px;font-weight:600">Password (if encrypted)
        <input type="password" data-f="pw" placeholder="Optional" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px" />
      </label>
      <label style="font-size:13px;font-weight:600">Mode
        <select data-f="mode" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px">
          <option value="lossless">Lossless re-save (object streams, metadata scrub)</option>
          <option value="raster">Rasterize pages → JPEG q0.7 (much smaller, flattens)</option>
        </select>
      </label>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button data-f="go">Compress & download</button></div>
      <div data-f="status" style="font-size:13px;color:#64748b"></div>
    </div>`;
  const q = (s) => el.querySelector(`[data-f="${s}"]`);
  const status = (m) => { q("status").textContent = m; };
  const trackedUrls = [];
  const liveCanvases = new Set();
  const MAX_PAGES = 100;

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
  function saveBytes(bytes, filename, mime = "application/pdf") {
    if (typeof ctx.download === "function") return ctx.download(bytes, filename, mime);
    const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    trackedUrls.push(url);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => { URL.revokeObjectURL(url); }, 5000);
  }
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

  const onGo = async () => {
    let tmpCanvas = null;
    try {
      const f = q("file").files[0];
      if (!f) { status("Pick a PDF."); return; }
      capsInfo("compress");
      const chk = checkCaps([f], { toolId: "compress", accept: ".pdf,application/pdf", multiple: false });
      const file = (chk && chk.accepted && chk.accepted.length) ? chk.accepted[0] : f;
      if (chk && chk.accepted && !chk.accepted.length) return;
      const mode = q("mode").value;
      const orig = new Uint8Array(await file.arrayBuffer());
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
        const pdf = await openPdfWithPassword(pdfjsLib, orig.slice(), () => q("pw").value);
        if (pdf.numPages > MAX_PAGES) throw new Error(`Page-count guard: PDF has ${pdf.numPages} pages (cap ${MAX_PAGES} for raster).`);
        const out = await PDFDocument.create();
        const scale = clampScale(1.5);
        for (let i = 1; i <= pdf.numPages; i++) {
          status(`Rasterizing page ${i}/${pdf.numPages} (JPEG q0.7)…`);
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale });
          tmpCanvas = document.createElement("canvas");
          liveCanvases.add(tmpCanvas);
          tmpCanvas.width = Math.floor(viewport.width);
          tmpCanvas.height = Math.floor(viewport.height);
          const c2d = tmpCanvas.getContext("2d");
          c2d.fillStyle = "#fff"; c2d.fillRect(0, 0, tmpCanvas.width, tmpCanvas.height);
          await page.render({ canvasContext: c2d, viewport }).promise;
          const dataUrl = tmpCanvas.toDataURL("image/jpeg", 0.7);
          const jpg = await out.embedJpg(dataUrl);
          const p = out.addPage([jpg.width, jpg.height]);
          p.drawImage(jpg, { x: 0, y: 0, width: jpg.width, height: jpg.height });
          // Canvas cleanup to free RAM.
          tmpCanvas.width = 0; tmpCanvas.height = 0;
          liveCanvases.delete(tmpCanvas);
          tmpCanvas = null;
        }
        const bytes = await out.save({ useObjectStreams: true });
        saveBytes(bytes, file.name.replace(/.pdf$/i, "") + "-raster-q07.pdf", "application/pdf");
        status(`Done — rasterized ${pdf.numPages} pages at JPEG q0.7. ${orig.length} → ${bytes.length} bytes.`);
      }
      try { q("pw").value = ""; } catch {}
    } catch (e) { status("Error: " + (e?.message || e)); }
    finally {
      try {
        if (tmpCanvas) { tmpCanvas.width = 0; tmpCanvas.height = 0; liveCanvases.delete(tmpCanvas); }
      } catch {}
    }
  };
  q("go").addEventListener("click", onGo);
  return () => {
    try { trackedUrls.forEach((u) => URL.revokeObjectURL(u)); } catch {}
    try { liveCanvases.forEach((c) => { c.width = 0; c.height = 0; }); liveCanvases.clear(); } catch {}
    el.innerHTML = "";
  };
}
