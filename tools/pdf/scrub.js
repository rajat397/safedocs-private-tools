// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/scrub.js — clear Title/Author/Producer (+Subject/Creator/Keywords/dates).
export async function mount(el, ctx = {}) {
  el.innerHTML = `
    <div style="display:grid;gap:10px">
      <label style="font-size:13px;font-weight:600">Source PDF
        <input type="file" data-f="file" accept="application/pdf,.pdf" />
      </label>
      <label style="font-size:13px;font-weight:600">Password (if encrypted)
        <input type="password" data-f="pw" placeholder="Optional" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px" />
      </label>
      <div data-f="meta" style="font-size:12px;color:#64748b;white-space:pre-wrap"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button data-f="inspect">Inspect metadata</button>
        <button data-f="go">Scrub & download</button>
      </div>
      <div data-f="status" style="font-size:13px;color:#64748b"></div>
    </div>`;
  const q = (s) => el.querySelector(`[data-f="${s}"]`);
  const status = (m) => { q("status").textContent = m; };
  const trackedUrls = [];

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
  function info(doc) {
    return ["Title", "Author", "Subject", "Keywords", "Producer", "Creator"].map((k) => {
      const fn = "get" + k;
      let v = "";
      try { v = doc[fn]?.() ?? ""; } catch { v = ""; }
      if (Array.isArray(v)) v = v.join(", ");
      return `${k}: ${v || "(empty)"}`;
    }).join("n");
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

  const onInspect = async () => {
    try {
      const f = q("file").files[0];
      if (!f) { status("Pick a PDF."); return; }
      capsInfo("scrub");
      const chk = checkCaps([f], { toolId: "scrub", accept: ".pdf,application/pdf", multiple: false });
      const file = (chk && chk.accepted && chk.accepted.length) ? chk.accepted[0] : f;
      if (chk && chk.accepted && !chk.accepted.length) return;
      const { PDFDocument } = await loadPdfLib();
      const doc = await loadPdfWithPassword(PDFDocument, new Uint8Array(await file.arrayBuffer()), () => q("pw").value);
      if (doc.getPageCount() > 500) throw new Error("Page-count guard: too many pages (cap 500).");
      q("meta").textContent = info(doc);
      status("Inspected (client-side).");
    } catch (e) { status("Error: " + (e?.message || e)); }
  };

  const onGo = async () => {
    try {
      const f = q("file").files[0];
      if (!f) { status("Pick a PDF."); return; }
      capsInfo("scrub");
      const chk = checkCaps([f], { toolId: "scrub", accept: ".pdf,application/pdf", multiple: false });
      const file = (chk && chk.accepted && chk.accepted.length) ? chk.accepted[0] : f;
      if (chk && chk.accepted && !chk.accepted.length) return;
      status("Loading pdf-lib…");
      const { PDFDocument } = await loadPdfLib();
      const doc = await loadPdfWithPassword(PDFDocument, new Uint8Array(await file.arrayBuffer()), () => q("pw").value);
      if (doc.getPageCount() > 500) throw new Error("Page-count guard: too many pages (cap 500).");
      doc.setTitle(""); doc.setAuthor(""); doc.setSubject("");
      doc.setKeywords([]); doc.setProducer(""); doc.setCreator("");
      try { doc.setCreationDate(new Date(0)); doc.setModificationDate(new Date(0)); } catch {}
      const bytes = await doc.save({ useObjectStreams: true });
      saveBytes(bytes, file.name.replace(/.pdf$/i, "") + "-scrubbed.pdf", "application/pdf");
      try { q("pw").value = ""; } catch {}
      q("meta").textContent = info(doc);
      status("Done — Title/Author/Producer (+all info dict) cleared.");
    } catch (e) { status("Error: " + (e?.message || e)); }
  };
  q("inspect").addEventListener("click", onInspect);
  q("go").addEventListener("click", onGo);
  return () => {
    try { trackedUrls.forEach((u) => URL.revokeObjectURL(u)); } catch {}
    el.innerHTML = "";
  };
}
