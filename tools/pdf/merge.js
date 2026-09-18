// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/merge.js — merge multiple PDFs in order. Client-side only, zero upload.
export async function mount(el, ctx = {}) {
  el.innerHTML = `
    <div style="display:grid;gap:10px">
      <label style="font-size:13px;font-weight:600">Select PDFs (in merge order)
        <input type="file" data-f="files" accept="application/pdf,.pdf" multiple />
      </label>
      <label style="font-size:13px;font-weight:600">Password for encrypted sources (optional)
        <input type="password" data-f="pw" placeholder="If any PDF is encrypted" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px" />
      </label>
      <div data-f="list" style="font-size:13px;color:#64748b">No files selected.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button data-f="go">Merge & download</button>
      </div>
      <div data-f="status" style="font-size:13px;color:#64748b"></div>
    </div>`;

  const q = (s) => el.querySelector(`[data-f="${s}"]`);
  const status = (m) => { q("status").textContent = m; };
  const trackedUrls = [];
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
    q("list").textContent = files.length
      ? files.map((f, i) => `${i + 1}. ${f.name} (${Math.round(f.size / 1024)} KB)`).join("  ·  ")
      : "No files selected.";
  });

  async function loadPdfLib() {
    if (globalThis.PDFLib) return globalThis.PDFLib;
    try {
      const m = await import("https://esm.sh/pdf-lib@1.17.1");
      if (m && (m.PDFDocument || m.default?.PDFDocument)) {
        const lib = m.default ?? m;
        globalThis.PDFLib = lib;
        return lib;
      }
    } catch {}
    const urls = [
      "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js",
      "https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js",
    ];
    for (const src of urls) {
      try {
        await loadScript(src);
        if (globalThis.PDFLib) return globalThis.PDFLib;
      } catch {}
    }
    throw new Error("Could not load pdf-lib@1.17.1 from CDN (check network).");
  }
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.async = true; s.onload = res; s.onerror = () => rej(new Error("script failed: " + src));
      document.head.appendChild(s);
    });
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
        if (!pw) throw new Error("An input PDF is encrypted — enter its password and try again.");
        try { return await PDFDocument.load(bytes, { password: pw }); }
        catch (e2) { throw new Error("Encrypted PDF needs the correct password: " + ((e2 && e2.message) || e2)); }
      }
      throw e;
    }
  }

  const onGo = async () => {
    try {
      if (!files.length) { status("Pick at least 2 PDFs."); return; }
      capsInfo("pdf-merge");
      const chk = checkCaps(files, { toolId: "pdf-merge", accept: ".pdf,application/pdf", multiple: true });
      let useFiles = files;
      if (chk) {
        if (chk.accepted && chk.accepted.length) useFiles = chk.accepted;
        else return;
        if (chk.rejected && chk.rejected.length) status("Rejected: " + chk.rejected.map((x) => `${x.file?.name}: ${x.reason}`).join(" | "));
      }
      // Page-count guard: avoid OOM on huge merges.
      const MAX_PAGES = 500;
      if (useFiles.length < 2) { status("Pick at least 2 valid PDFs (after caps check)."); return; }
      status("Loading pdf-lib…");
      const { PDFDocument } = await loadPdfLib();
      status("Merging…");
      const out = await PDFDocument.create();
      let totalPages = 0;
      for (const f of useFiles) {
        const buf = new Uint8Array(await f.arrayBuffer());
        const src = await loadPdfWithPassword(PDFDocument, buf, () => q("pw").value);
        const n = src.getPageCount();
        if (totalPages + n > MAX_PAGES) throw new Error(`Page-count guard: merging would exceed ${MAX_PAGES} pages (${totalPages} + ${n}). Split the job.`);
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach((p) => out.addPage(p));
        totalPages += n;
      }
      const bytes = await out.save();
      saveBytes(bytes, "merged.pdf", "application/pdf");
      try { q("pw").value = ""; } catch {}
      status(`Done — ${out.getPageCount()} pages merged from ${useFiles.length} files. (100% client-side)`);
    } catch (e) {
      status("Error: " + (e?.message || e));
    }
  };
  q("go").addEventListener("click", onGo);
  return () => {
    try { trackedUrls.forEach((u) => URL.revokeObjectURL(u)); } catch {}
    files = [];
    el.innerHTML = "";
  };
}
