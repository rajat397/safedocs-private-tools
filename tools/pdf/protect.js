// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/protect.js — honest hint-only copy. NOT encryption.
// pdf-lib cannot do real password encryption client-side, so this tool
// re-saves the file, records a protection hint in metadata only, clears
// the password field, and warns clearly. Never claims real encryption.
// (P2 shell UI.)
import { shell } from '../_lib/page.js';
export async function mount(el, ctx = {}) {
  const tool = (ctx && ctx.tool) || {};
  const page = shell(el, tool, ctx);
  const status = page.status;
  const q = (s) => page.root.querySelector(`[data-f="${s}"]`);
  const TOOL_ID = (ctx && ctx.tool && ctx.tool.id) || "protect";

  page.optionsEl.innerHTML = `
    <label>Password (hint only — NOT real protection)
      <input type="password" data-f="pw" placeholder="Hint label only" />
    </label>
    <label>Source password (if file is encrypted)
      <input type="password" data-f="srcpw" placeholder="Optional — only if source needs it" />
    </label>
    <p style="font-size:12px;color:#92400e;margin:0;background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:8px">Warning: this is NOT encryption. It copies the PDF and stores a metadata hint only. Anyone can open the file without a password. For real password protection use a server / desktop step (e.g. qpdf).</p>`;

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
        if (!pw) throw new Error("This PDF is encrypted — enter the source password and try again.");
        try {
          return await PDFDocument.load(bytes, { password: pw });
        } catch (e2) {
          throw new Error("Could not open encrypted PDF (wrong password or unsupported encryption): " + ((e2 && e2.message) || e2));
        }
      }
      throw e;
    }
  }

  page.runBtn("Apply hint & download", async (got) => {
    try {
      files = [...(got || [])];
      const f = files[0];
      if (!f) { status("Pick a PDF."); return; }
      const chk = checkCaps([f], { toolId: TOOL_ID, accept: ".pdf,application/pdf", multiple: false });
      const file = (chk && chk.accepted && chk.accepted.length) ? chk.accepted[0] : f;
      if (chk && chk.accepted && !chk.accepted.length) return;
      if (!q("pw").value) { status("Enter a hint label (it will NOT protect the file — see warning)."); return; }
      status("Loading pdf-lib…");
      const { PDFDocument } = await loadPdfLib();
      const src = await loadPdfWithPassword(PDFDocument, new Uint8Array(await file.arrayBuffer()), () => q("srcpw").value);
      const out = await PDFDocument.create();
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((p) => out.addPage(p));
      // Honest hint-only copy: metadata records the hint, file stays openable.
      out.setCreator("toolbox-protect(hint-only, not encrypted)");
      out.setSubject("Hint-only copy; NOT encrypted — password field cleared after save");
      out.setKeywords(["hint-only", "not-encrypted"]);
      const bytes = await out.save({ useObjectStreams: true });
      saveBytes(bytes, file.name.replace(/.pdf$/i, "") + "-hint-copy.pdf", "application/pdf");
      // Clear password fields immediately so nothing lingers in DOM.
      try { q("pw").value = ""; } catch {}
      try { q("srcpw").value = ""; } catch {}
      status("Done — hint-only copy saved (NOT encrypted; warning above applies). Password fields cleared.");
    } catch (e) { status("Error: " + (e?.message || e)); }
    finally { try { q("pw").value = ""; } catch {} try { q("srcpw").value = ""; } catch {} }
  });
  return () => {
    files = [];
    try { q("pw").value = ""; } catch {}
    try { q("srcpw").value = ""; } catch {}
    page.cleanup();
  };
}
