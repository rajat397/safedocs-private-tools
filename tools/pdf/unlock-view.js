// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/unlock-view.js — open a password-protected PDF you own, save an unencrypted copy.
// Honest copy: removes the password only if you know it. No cracking, no brute-force,
// no bypass. Uses pinned pdf-lib@1.17.1 only (same pin as tools/pdf + tools/sign).
// (P2 shell UI.)
import { shell } from '../_lib/page.js';
export async function mount(el, ctx = {}) {
  const tool = (ctx && ctx.tool) || {};
  const page = shell(el, tool, ctx);
  const status = page.status;
  const q = (s) => page.root.querySelector(`[data-f="${s}"]`);
  const TOOL_ID = (ctx && ctx.tool && ctx.tool.id) || "pdf-unlock-view";
  let srcBytes = null;

  page.optionsEl.innerHTML = `
    <label>Password (required — file stays locked without it)
      <input type="password" data-f="pw" placeholder="Enter the known password" autocomplete="off" />
    </label>
    <label style="display:flex;gap:8px;align-items:flex-start;font-weight:400">
      <input type="checkbox" data-f="own" style="margin-top:3px" />
      <span>I own this PDF (or have the owner's permission) to remove its password for viewing.</span>
    </label>
    <p style="font-size:12px;color:#475569;margin:0;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:8px">This copies the file without a password <strong>only if you know the correct password</strong>. It cannot crack, guess, or bypass unknown passwords. Everything runs on-device; nothing is uploaded.</p>`;

  const inspectBtn = document.createElement("button");
  inspectBtn.type = "button";
  inspectBtn.className = "secondary";
  inspectBtn.textContent = "Open & inspect";
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
      try {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = src; s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
        if (globalThis.PDFLib) return globalThis.PDFLib;
      } catch {}
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
        if (!pw) throw new Error("This PDF is encrypted — enter its password. Wrong or missing passwords cannot be bypassed.");
        try {
          return await PDFDocument.load(bytes, { password: pw });
        } catch (e2) {
          throw new Error("Could not open encrypted PDF (wrong password or unsupported encryption): " + ((e2 && e2.message) || e2));
        }
      }
      throw e;
    }
  }
  function requirePermission() {
    if (!q("own").checked) {
      status("Tick the permission checkbox to confirm you own this file (or have permission).");
      return false;
    }
    return true;
  }
  function clearSecrets() {
    try { q("pw").value = ""; } catch {}
    try { if (srcBytes) srcBytes.fill(0); } catch {}
    srcBytes = null;
  }

  const onInspect = async () => {
    try {
      const f = files[0] || page.getFiles()[0];
      if (!f) { status("Pick a PDF."); return; }
      if (!requirePermission()) return;
      const chk = checkCaps([f], { toolId: TOOL_ID, accept: ".pdf,application/pdf", multiple: false });
      const file = (chk && chk.accepted && chk.accepted.length) ? chk.accepted[0] : f;
      if (chk && chk.accepted && !chk.accepted.length) return;
      if (!q("pw").value) { status("Enter the known password — encrypted files cannot be opened without it."); return; }
      status("Loading pdf-lib…");
      const { PDFDocument } = await loadPdfLib();
      srcBytes = new Uint8Array(await file.arrayBuffer());
      const doc = await loadPdfWithPassword(PDFDocument, srcBytes, () => q("pw").value);
      const n = doc.getPageCount();
      if (n > 500) throw new Error("Page-count guard: too many pages (cap 500).");
      q("meta").textContent = `Opened: ${file.name}\nPages: ${n}\nPassword accepted — ready to save an unencrypted copy.`;
      status("Opened with the password you supplied (on-device).");
    } catch (e) { status("Error: " + (e?.message || e)); }
    finally { try { q("pw").value = ""; } catch {} }
  };

  page.runBtn("Unlock & download copy", async (got) => {
    let outBytes = null;
    try {
      files = [...(got || [])];
      const f = files[0];
      if (!f) { status("Pick a PDF."); return; }
      if (!requirePermission()) return;
      const chk = checkCaps([f], { toolId: TOOL_ID, accept: ".pdf,application/pdf", multiple: false });
      const file = (chk && chk.accepted && chk.accepted.length) ? chk.accepted[0] : f;
      if (chk && chk.accepted && !chk.accepted.length) return;
      if (!q("pw").value) { status("Enter the known password — this tool does not crack unknown passwords."); return; }
      status("Loading pdf-lib…");
      const { PDFDocument } = await loadPdfLib();
      srcBytes = new Uint8Array(await file.arrayBuffer());
      const src = await loadPdfWithPassword(PDFDocument, srcBytes, () => q("pw").value);
      if (src.getPageCount() > 500) throw new Error("Page-count guard: too many pages (cap 500).");
      // Rebuild pages into a fresh document: the copy carries no password/encryption.
      const out = await PDFDocument.create();
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((p) => out.addPage(p));
      out.setCreator("toolbox-unlock-view(unencrypted copy)");
      out.setProducer("toolbox-unlock-view(unencrypted copy)");
      outBytes = await out.save({ useObjectStreams: true });
      saveBytes(outBytes, file.name.replace(/\.pdf$/i, "") + "-unlocked.pdf", "application/pdf");
      clearSecrets();
      try { if (outBytes) outBytes.fill(0); } catch {}
      outBytes = null;
      q("meta").textContent = "";
      status("Done — unencrypted copy saved. Password field cleared.");
    } catch (e) { status("Error: " + (e?.message || e)); }
    finally {
      clearSecrets();
      try { if (outBytes) outBytes.fill(0); } catch {}
    }
  });

  inspectBtn.addEventListener("click", onInspect);
  return () => {
    files = [];
    clearSecrets();
    try { q("own").checked = false; } catch {}
    page.cleanup();
  };
}
