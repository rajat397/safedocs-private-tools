// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/preview.js — render PDF pages via pdf.js into canvas thumbnails. No download needed. (P2 shell UI.)
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
    <p class="muted" style="margin:0;font-size:12px">Previews render on-device. No download needed.</p>`;

  const infoEl = document.createElement("div");
  infoEl.dataset.f = "info";
  infoEl.className = "muted";
  infoEl.style.cssText = "font-size:13px";
  page.outputEl.append(infoEl);

  const pagesEl = document.createElement("div");
  pagesEl.dataset.f = "pages";
  pagesEl.style.cssText = "display:flex;gap:10px;flex-wrap:wrap";
  page.outputEl.append(pagesEl);

  let files = [];
  const liveCanvases = new Set();
  const MAX_PREVIEW = 20;

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
      const pg = await pdf.getPage(i);
      const viewport = pg.getViewport({ scale });
      const canvas = document.createElement("canvas");
      liveCanvases.add(canvas);
      canvas.width = Math.floor(viewport.width); canvas.height = Math.floor(viewport.height);
      canvas.style.cssText = "max-width:200px;border:1px solid #e2e8f0;border-radius:8px;background:#fff";
      canvas.title = `Page ${i}`;
      const c2d = canvas.getContext("2d");
      c2d.fillStyle = "#fff"; c2d.fillRect(0, 0, canvas.width, canvas.height);
      await pg.render({ canvasContext: c2d, viewport }).promise;
      const wrap = document.createElement("div");
      wrap.style.cssText = "display:grid;gap:4px;justify-items:center;font-size:12px;color:#64748b";
      wrap.appendChild(canvas);
      const lab = document.createElement("span"); lab.textContent = `p${i}`;
      wrap.appendChild(lab);
      q("pages").appendChild(wrap);
      setProgress(i / max);
    }
    status(pdf.numPages > MAX_PREVIEW ? `Showing first ${MAX_PREVIEW} of ${pdf.numPages} pages (page-count guard).` : `Done — ${pdf.numPages} page(s).`);
  }

  page.onFiles((accepted) => {
    files = [...accepted];
    if (files[0]) render(files[0]).catch((err) => status("Error: " + (err?.message || err)));
  });

  page.runBtn("Preview", async (got) => {
    try {
      files = [...(got || [])];
      const f = files[0];
      if (!f) { status("Pick a PDF."); return; }
      await render(f);
    } catch (e) { status("Error: " + (e?.message || e)); }
  });
  return () => {
    files = [];
    try { liveCanvases.forEach((c) => { c.width = 0; c.height = 0; }); liveCanvases.clear(); } catch {}
    try { q("pw").value = ""; } catch {}
    page.cleanup();
  };
}
