// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/images-to-pdf.js — images (PNG/JPG/WebP) → PDF. Client-side only. (P2 shell UI.)
import { shell } from '../_lib/page.js';
export async function mount(el, ctx = {}) {
  const tool = (ctx && ctx.tool) || {};
  const page = shell(el, tool, ctx);
  const status = page.status;
  const setProgress = page.setProgress;
  const q = (s) => page.root.querySelector(`[data-f="${s}"]`);

  page.optionsEl.innerHTML = `
    <label>Page size
      <select data-f="size">
        <option value="fit">Fit to each image</option>
        <option value="a4">A4 (fit inside)</option>
      </select>
    </label>`;

  let files = [];
  page.onFiles((accepted) => { files = [...accepted]; });

  const liveCanvases = new Set();
  const MAX_IMAGES = 100;

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

  page.runBtn("Convert & download", async (got) => {
    let tmpCanvas = null;
    try {
      files = [...(got || [])];
      if (!files.length) { status("Pick images first."); return; }
      const chk = checkCaps(files, { toolId: "images-to-pdf", accept: "image/*", multiple: true });
      let useFiles = files;
      if (chk) {
        if (chk.accepted && chk.accepted.length) useFiles = chk.accepted;
        else return;
      }
      if (useFiles.length > MAX_IMAGES) throw new Error(`Page-count guard: ${useFiles.length} images (cap ${MAX_IMAGES}). Reduce the batch.`);
      status("Loading pdf-lib…");
      const { PDFDocument } = await loadPdfLib();
      const out = await PDFDocument.create();
      const A4 = [595.28, 841.89];
      let done = 0;
      for (const f of useFiles) {
        status("Embedding " + f.name + "…");
        const buf = new Uint8Array(await f.arrayBuffer());
        let img;
        const isPng = f.type.includes("png") || /\.png$/i.test(f.name);
        try { img = isPng ? await out.embedPng(buf) : await out.embedJpg(buf); }
        catch {
          // webp/other → draw via canvas → jpg
          const bmp = await createImageBitmap(new Blob([buf]));
          tmpCanvas = document.createElement("canvas");
          liveCanvases.add(tmpCanvas);
          tmpCanvas.width = bmp.width; tmpCanvas.height = bmp.height;
          tmpCanvas.getContext("2d").drawImage(bmp, 0, 0);
          const url = tmpCanvas.toDataURL("image/jpeg", 0.85);
          img = await out.embedJpg(url);
          tmpCanvas.width = 0; tmpCanvas.height = 0;
          liveCanvases.delete(tmpCanvas);
          tmpCanvas = null;
        }
        if (q("size").value === "a4") {
          const p = out.addPage(A4);
          const s = Math.min(A4[0] / img.width, A4[1] / img.height);
          const w = img.width * s, h = img.height * s;
          p.drawImage(img, { x: (A4[0] - w) / 2, y: (A4[1] - h) / 2, width: w, height: h });
        } else {
          const p = out.addPage([img.width, img.height]);
          p.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        }
        done += 1;
        setProgress(done / useFiles.length);
      }
      saveBytes(await out.save({ useObjectStreams: true }), "images.pdf", "application/pdf");
      status(`Done — ${useFiles.length} image(s) → PDF.`);
    } catch (e) { status("Error: " + (e?.message || e)); }
    finally {
      try { if (tmpCanvas) { tmpCanvas.width = 0; tmpCanvas.height = 0; } } catch {}
    }
  });
  return () => {
    files = [];
    try { liveCanvases.forEach((c) => { c.width = 0; c.height = 0; }); liveCanvases.clear(); } catch {}
    page.cleanup();
  };
}
