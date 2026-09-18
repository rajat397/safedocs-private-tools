// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/images-to-pdf.js — images (PNG/JPG/WebP) → PDF. Client-side only.
export async function mount(el, ctx = {}) {
  el.innerHTML = `
    <div style="display:grid;gap:10px">
      <label style="font-size:13px;font-weight:600">Images (in order)
        <input type="file" data-f="files" accept="image/*" multiple />
      </label>
      <label style="font-size:13px;font-weight:600">Page size
        <select data-f="size" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px">
          <option value="fit">Fit to each image</option>
          <option value="a4">A4 (fit inside)</option>
        </select>
      </label>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button data-f="go">Convert & download</button></div>
      <div data-f="status" style="font-size:13px;color:#64748b"></div>
    </div>`;
  const q = (s) => el.querySelector(`[data-f="${s}"]`);
  const status = (m) => { q("status").textContent = m; };
  const trackedUrls = [];
  const liveCanvases = new Set();
  const MAX_IMAGES = 100;
  let files = [];

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

  q("files").addEventListener("change", (e) => {
    files = [...e.target.files];
    capsInfo("images-to-pdf");
    const chk = checkCaps(files, { toolId: "images-to-pdf", accept: "image/*", multiple: true });
    if (chk && chk.accepted) {
      // Keep accepted list for next step; show rejected reasons via status.
      files = chk.accepted.length ? chk.accepted : files;
    }
  });

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

  const onGo = async () => {
    let tmpCanvas = null;
    try {
      if (!files.length) { status("Pick images first."); return; }
      capsInfo("images-to-pdf");
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
      }
      saveBytes(await out.save({ useObjectStreams: true }), "images.pdf", "application/pdf");
      status(`Done — ${useFiles.length} image(s) → PDF.`);
    } catch (e) { status("Error: " + (e?.message || e)); }
    finally {
      try { if (tmpCanvas) { tmpCanvas.width = 0; tmpCanvas.height = 0; } } catch {}
    }
  };
  q("go").addEventListener("click", onGo);
  return () => {
    try { trackedUrls.forEach((u) => URL.revokeObjectURL(u)); } catch {}
    try { liveCanvases.forEach((c) => { c.width = 0; c.height = 0; }); liveCanvases.clear(); } catch {}
    files = [];
    el.innerHTML = "";
  };
}
