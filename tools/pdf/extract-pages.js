// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/extract-pages.js — extract selected pages (e.g. 1,3-5) into a single PDF. Client-side only. (P2 shell UI.)
import { shell } from '../_lib/page.js';
export async function mount(el, ctx = {}) {
  const tool = (ctx && ctx.tool) || {};
  const page = shell(el, tool, ctx);
  const status = page.status;
  const q = (s) => page.root.querySelector(`[data-f="${s}"]`);
  const TOOL_ID = (ctx && ctx.tool && ctx.tool.id) || "pdf-extract-pages";

  page.optionsEl.innerHTML = `
    <label>Password (if encrypted)
      <input type="password" data-f="pw" placeholder="Optional" />
    </label>
    <label>Pages (e.g. 1,3-5)
      <input type="text" data-f="pages" placeholder="1,3-5" />
    </label>`;

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

  // Range spec like "1,3-5" -> sorted unique 0-based subset for copyPages.
  function parsePages(str, pageCount, warnings = []) {
    str = (str || "").trim().toLowerCase();
    if (!str) throw new Error("Enter pages, e.g. 1,3-5");
    const picked = [];
    for (const part of str.split(",")) {
      const t = part.trim();
      if (!t) continue;
      const m = t.match(/^(\d+)\s*-\s*(\d+)$/);
      if (m) {
        let a = +m[1], b = +m[2];
        if (a > b) [a, b] = [b, a];
        if (a > pageCount) { warnings.push(`Range "${t}" out of range (1–${pageCount}) — skipped.`); continue; }
        if (b > pageCount) { warnings.push(`Range "${t}" truncated to ${a}-${pageCount} (PDF has ${pageCount} pages).`); b = pageCount; }
        if (a < 1) a = 1;
        for (let p = a; p <= b; p++) picked.push(p - 1);
      } else if (/^\d+$/.test(t)) {
        const p = +t;
        if (p >= 1 && p <= pageCount) picked.push(p - 1);
        else warnings.push(`Page ${p} out of range (1–${pageCount}) — skipped.`);
      } else throw new Error(`Bad page token: "${t}" (use like 1,3-5)`);
    }
    const subset = [...new Set(picked)].sort((x, y) => x - y);
    if (picked.length !== subset.length) warnings.push("Note: duplicate pages removed.");
    if (!subset.length) throw new Error("No valid pages (all skipped as out of range).");
    return subset;
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
      try { await loadScript(src); if (globalThis.PDFLib) return globalThis.PDFLib; } catch {}
    }
    throw new Error("Could not load pdf-lib@1.17.1 (check network).");
  }
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.async = true; s.onload = res; s.onerror = () => rej(new Error("fail " + src));
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
        if (!pw) throw new Error("This PDF is encrypted — enter its password and try again.");
        try { return await PDFDocument.load(bytes, { password: pw }); }
        catch (e2) { throw new Error("Encrypted PDF needs the correct password: " + ((e2 && e2.message) || e2)); }
      }
      throw e;
    }
  }

  page.runBtn("Extract & download", async (got) => {
    try {
      files = [...(got || [])];
      const f = files[0];
      if (!f) { status("Pick a PDF first."); return; }
      const chk = checkCaps([f], { toolId: TOOL_ID, accept: ".pdf,application/pdf", multiple: false });
      const file = (chk && chk.accepted && chk.accepted.length) ? chk.accepted[0] : f;
      if (chk && chk.accepted && !chk.accepted.length) return;
      status("Loading pdf-lib…");
      const { PDFDocument } = await loadPdfLib();
      const src = await loadPdfWithPassword(PDFDocument, new Uint8Array(await file.arrayBuffer()), () => q("pw").value);
      const n = src.getPageCount();
      const MAX_PAGES = 500;
      if (n > MAX_PAGES) throw new Error(`Page-count guard: PDF has ${n} pages (cap ${MAX_PAGES}).`);
      const warnings = [];
      const subset = parsePages(q("pages").value, n, warnings);
      const out = await PDFDocument.create();
      const pages = await out.copyPages(src, subset);
      pages.forEach((p) => out.addPage(p));
      const bytes = await out.save();
      const base = file.name.replace(/\.pdf$/i, "");
      saveBytes(bytes, `${base}-extract-(p${subset.map((i) => i + 1).join(",")}).pdf`, "application/pdf");
      try { q("pw").value = ""; } catch {}
      const warnTxt = warnings.length ? " Warnings: " + warnings.join(" ") : "";
      status(`Done — extracted ${subset.length}/${n} page(s): ${subset.map((i) => i + 1).join(", ")}.${warnTxt}`);
    } catch (e) { status("Error: " + (e?.message || e)); }
    finally { try { q("pw").value = ""; } catch {} }
  });
  return () => {
    files = [];
    try { q("pw").value = ""; } catch {}
    page.cleanup();
  };
}
