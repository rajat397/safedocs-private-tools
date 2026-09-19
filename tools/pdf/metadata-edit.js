// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/metadata-edit.js — view & edit PDF info-dict metadata. pdf-lib only, client-side. (P2 shell UI.)
import { shell } from '../_lib/page.js';
export async function mount(el, ctx = {}) {
  const tool = (ctx && ctx.tool) || {};
  const page = shell(el, tool, ctx);
  const status = page.status;
  const q = (s) => page.root.querySelector(`[data-f="${s}"]`);
  const TOOL_ID = (ctx && ctx.tool && ctx.tool.id) || "pdf-metadata-edit";
  const MAX_PAGES = 500;

  page.optionsEl.innerHTML = `
    <label>Password (if encrypted)
      <input type="password" data-f="pw" placeholder="Optional" />
    </label>
    <label>Title <input type="text" data-f="title" placeholder="(keep)" /></label>
    <label>Author <input type="text" data-f="author" placeholder="(keep)" /></label>
    <label>Subject <input type="text" data-f="subject" placeholder="(keep)" /></label>
    <label>Keywords (comma-separated) <input type="text" data-f="keywords" placeholder="(keep)" /></label>
    <label>Creator <input type="text" data-f="creator" placeholder="(keep)" /></label>
    <label>Producer <input type="text" data-f="producer" placeholder="(keep)" /></label>
    <p class="muted" style="margin:0;font-size:12px">100% on-device. Edits the document info dictionary only (Title/Author/Subject/Keywords/Creator/Producer). Blank fields are left unchanged; XMP streams and embedded file metadata are not touched.</p>`;

  const inspectBtn = document.createElement("button");
  inspectBtn.type = "button";
  inspectBtn.className = "secondary";
  inspectBtn.textContent = "Inspect metadata";
  page.optionsEl.append(inspectBtn);

  const metaEl = document.createElement("div");
  metaEl.dataset.f = "meta";
  metaEl.className = "muted";
  metaEl.style.cssText = "font-size:12px;white-space:pre-wrap";
  page.outputEl.append(metaEl);

  let files = [];
  page.onFiles((accepted) => { files = [...accepted]; });

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
  function info(doc) {
    return ["Title", "Author", "Subject", "Keywords", "Producer", "Creator"].map((k) => {
      let v = "";
      try { v = doc["get" + k]?.() ?? ""; } catch { v = ""; }
      if (Array.isArray(v)) v = v.join(", ");
      return `${k}: ${v || "(empty)"}`;
    }).join("\n");
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
    throw new Error("Could not load pdf-lib@1.17.1 (check network).");
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
      const f = files[0] || page.getFiles()[0];
      if (!f) { status("Pick a PDF."); return; }
      const chk = checkCaps([f], { toolId: TOOL_ID, accept: ".pdf,application/pdf", multiple: false });
      const file = (chk && chk.accepted && chk.accepted.length) ? chk.accepted[0] : f;
      if (chk && chk.accepted && !chk.accepted.length) return;
      const { PDFDocument } = await loadPdfLib();
      const doc = await loadPdfWithPassword(PDFDocument, new Uint8Array(await file.arrayBuffer()), () => q("pw").value);
      if (doc.getPageCount() > MAX_PAGES) throw new Error(`Page-count guard: PDF has ${doc.getPageCount()} pages (cap ${MAX_PAGES}).`);
      q("meta").textContent = info(doc);
      status("Inspected (client-side). Blank edit fields keep existing values.");
    } catch (e) { status("Error: " + (e?.message || e)); }
  };

  page.runBtn("Save & download", async (got) => {
    try {
      files = [...(got || [])];
      const f = files[0];
      if (!f) { status("Pick a PDF."); return; }
      const chk = checkCaps([f], { toolId: TOOL_ID, accept: ".pdf,application/pdf", multiple: false });
      const file = (chk && chk.accepted && chk.accepted.length) ? chk.accepted[0] : f;
      if (chk && chk.accepted && !chk.accepted.length) return;
      status("Loading pdf-lib…");
      const { PDFDocument } = await loadPdfLib();
      const doc = await loadPdfWithPassword(PDFDocument, new Uint8Array(await file.arrayBuffer()), () => q("pw").value);
      if (doc.getPageCount() > MAX_PAGES) throw new Error(`Page-count guard: PDF has ${doc.getPageCount()} pages (cap ${MAX_PAGES}).`);
      const setIf = (val, fn) => { if (val !== "") { try { fn(val); } catch (e) { throw new Error("Could not set field: " + (e?.message || e)); } } };
      setIf(q("title").value, (v) => doc.setTitle(v));
      setIf(q("author").value, (v) => doc.setAuthor(v));
      setIf(q("subject").value, (v) => doc.setSubject(v));
      if (q("keywords").value !== "") doc.setKeywords(q("keywords").value.split(",").map((s) => s.trim()).filter(Boolean));
      setIf(q("creator").value, (v) => doc.setCreator(v));
      setIf(q("producer").value, (v) => doc.setProducer(v));
      const bytes = await doc.save({ useObjectStreams: true });
      assertPdfHeader(bytes);
      saveBytes(bytes, file.name.replace(/\.pdf$/i, "") + "-metadata.pdf", "application/pdf");
      try { q("pw").value = ""; } catch {}
      q("meta").textContent = info(doc);
      status("Done — info-dict fields updated. Re-open Inspect to verify; XMP metadata (if any) unchanged.");
    } catch (e) { status("Error: " + (e?.message || e)); }
  });
  inspectBtn.addEventListener("click", onInspect);
  return () => {
    files = [];
    try { q("pw").value = ""; } catch {}
    page.cleanup();
  };
}
