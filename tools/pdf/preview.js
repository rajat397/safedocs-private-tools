// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/preview.js — render PDF pages via pdf.js into canvas thumbnails. No download needed.
export async function mount(el, ctx = {}) {
  el.innerHTML = `
    <div style="display:grid;gap:10px">
      <label style="font-size:13px;font-weight:600">Source PDF
        <input type="file" data-f="file" accept="application/pdf,.pdf" />
      </label>
      <label style="font-size:13px;font-weight:600">Password (if encrypted)
        <input type="password" data-f="pw" placeholder="Optional" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px" />
      </label>
      <div style="display:flex;gap:8px;align-items:center;font-size:13px;flex-wrap:wrap">
        <button data-f="go">Preview</button>
        <span data-f="info" style="color:#64748b"></span>
      </div>
      <div data-f="pages" style="display:flex;gap:10px;flex-wrap:wrap"></div>
      <div data-f="status" style="font-size:13px;color:#64748b"></div>
    </div>`;
  const q = (s) => el.querySelector(`[data-f="${s}"]`);
  const status = (m) => { q("status").textContent = m; };
  const trackedUrls = [];
  const liveCanvases = new Set();
  const MAX_PREVIEW = 20;

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
  function clampScale(s, fallback = 1.0) {
    s = parseFloat(s);
    if (!Number.isFinite(s)) return fallback;
    return Math.min(3, Math.max(0.5, s));
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

  function clearPages() {
    try { liveCanvases.forEach((c) => { c.width = 0; c.height = 0; }); liveCanvases.clear(); } catch {}
    q("pages").innerHTML = "";
  }

  async function render(file) {
    status("Loading pdf.js…");
    capsInfo("preview");
    const chk = checkCaps([file], { toolId: "preview", accept: ".pdf,application/pdf", multiple: false });
    const useFile = (chk && chk.accepted && chk.accepted.length) ? chk.accepted[0] : file;
    if (chk && chk.accepted && !chk.accepted.length) return;
    const pdfjsLib = await loadPdfJs();
    const pdf = await openPdfWithPassword(pdfjsLib, new Uint8Array(await useFile.arrayBuffer()), () => q("pw").value);
    // Page-count guard: only render first MAX_PREVIEW.
    if (pdf.numPages > 200) status(`Note: large PDF (${pdf.numPages} pages) — preview limited to first ${MAX_PREVIEW}.`);
    q("info").textContent = `${pdf.numPages} page(s) · ${useFile.name}`;
    clearPages();
    const scale = clampScale(1.0);
    const max = Math.min(pdf.numPages, MAX_PREVIEW);
    for (let i = 1; i <= max; i++) {
      status(`Rendering ${i}/${pdf.numPages}…`);
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      liveCanvases.add(canvas);
      canvas.width = Math.floor(viewport.width); canvas.height = Math.floor(viewport.height);
      canvas.style.cssText = "max-width:200px;border:1px solid #e2e8f0;border-radius:8px;background:#fff";
      canvas.title = `Page ${i}`;
      const c2d = canvas.getContext("2d");
      c2d.fillStyle = "#fff"; c2d.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: c2d, viewport }).promise;
      const wrap = document.createElement("div");
      wrap.style.cssText = "display:grid;gap:4px;justify-items:center;font-size:12px;color:#64748b";
      wrap.appendChild(canvas);
      const lab = document.createElement("span"); lab.textContent = `p${i}`;
      wrap.appendChild(lab);
      q("pages").appendChild(wrap);
    }
    status(pdf.numPages > MAX_PREVIEW ? `Showing first ${MAX_PREVIEW} of ${pdf.numPages} pages (page-count guard).` : `Done — ${pdf.numPages} page(s).`);
  }

  const onGo = async () => {
    try {
      const f = q("file").files[0];
      if (!f) { status("Pick a PDF."); return; }
      await render(f);
    } catch (e) { status("Error: " + (e?.message || e)); }
  };
  const onChange = async (e) => {
    if (e.target.files[0]) { try { await render(e.target.files[0]); } catch (err) { status("Error: " + (err?.message || err)); } }
  };
  q("go").addEventListener("click", onGo);
  q("file").addEventListener("change", onChange);
  return () => {
    try { trackedUrls.forEach((u) => URL.revokeObjectURL(u)); } catch {}
    try { liveCanvases.forEach((c) => { c.width = 0; c.height = 0; }); liveCanvases.clear(); } catch {}
    el.innerHTML = "";
  };
}
