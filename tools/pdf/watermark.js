// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/watermark.js — diagonal text overlay on pages (optionally subset). (P2 shell UI.)
import { shell } from '../_lib/page.js';
export async function mount(el, ctx = {}) {
  const tool = (ctx && ctx.tool) || {};
  const page = shell(el, tool, ctx);
  const status = page.status;
  const q = (s) => page.root.querySelector(`[data-f="${s}"]`);

  page.optionsEl.innerHTML = `
    <label>Password (if encrypted)
      <input type="password" data-f="pw" placeholder="Optional" />
    </label>
    <label>Text
      <input data-f="text" value="CONFIDENTIAL" />
    </label>
    <label>Pages (blank = all)
      <input data-f="pages" placeholder="all" />
    </label>
    <label>Opacity
      <input data-f="op" type="number" value="0.25" step="0.05" min="0.05" max="1" />
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

  function parsePages(str, n, warnings = []) {
    str = (str || "").trim().toLowerCase();
    if (!str || str === "all") return Array.from({ length: n }, (_, i) => i);
    const out = new Set();
    for (const part of str.split(",")) {
      const t = part.trim();
      if (!t) continue;
      const m = t.match(/^(\d+)\s*-\s*(\d+)$/);
      if (m) {
        let a = +m[1], b = +m[2]; if (a > b) [a, b] = [b, a];
        if (a > n || b < 1) { warnings.push(`Range "${t}" out of range (1–${n}) — skipped.`); continue; }
        const ca = Math.max(1, a), cb = Math.min(n, b);
        if (ca !== a || cb !== b) warnings.push(`Range "${t}" truncated to ${ca}-${cb} (PDF has ${n} pages).`);
        for (let p = ca; p <= cb; p++) out.add(p - 1);
      }
      else if (/^\d+$/.test(t)) {
        const v = +t;
        if (v >= 1 && v <= n) out.add(v - 1);
        else warnings.push(`Page ${v} out of range (1–${n}) — skipped.`);
      }
      else throw new Error(`Bad token "${t}"`);
    }
    return [...out].sort((a, b) => a - b);
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

  page.runBtn("Apply watermark & download", async (got) => {
    try {
      files = [...(got || [])];
      const f = files[0];
      if (!f) { status("Pick a PDF."); return; }
      const chk = checkCaps([f], { toolId: "watermark", accept: ".pdf,application/pdf", multiple: false });
      const file = (chk && chk.accepted && chk.accepted.length) ? chk.accepted[0] : f;
      if (chk && chk.accepted && !chk.accepted.length) return;
      const text = q("text").value || "CONFIDENTIAL";
      const op = Math.min(1, Math.max(0.05, parseFloat(q("op").value || "0.25")));
      status("Loading pdf-lib…");
      const { PDFDocument, StandardFonts, rgb, degrees } = await loadPdfLib();
      const doc = await loadPdfWithPassword(PDFDocument, new Uint8Array(await file.arrayBuffer()), () => q("pw").value);
      const n = doc.getPageCount();
      if (n > 500) throw new Error(`Page-count guard: PDF has ${n} pages (cap 500).`);
      const font = await doc.embedFont(StandardFonts.HelveticaBold);
      const warnings = [];
      const targets = parsePages(q("pages").value, n, warnings);
      if (!targets.length) { status("No pages match (all out of range)." + (warnings.length ? " " + warnings.join(" ") : "")); return; }
      for (const i of targets) {
        const pg = doc.getPage(i);
        const { width, height } = pg.getSize();
        const size = Math.min(width, height) / 8;
        const tw = font.widthOfTextAtSize(text, size);
        pg.drawText(text, {
          x: width / 2 - (tw / 2) * Math.cos(Math.PI / 4),
          y: height / 2,
          size, font,
          color: rgb(0.6, 0.1, 0.1),
          opacity: op,
          rotate: degrees(45),
        });
      }
      const bytes = await doc.save({ useObjectStreams: true });
      saveBytes(bytes, file.name.replace(/\.pdf$/i, "") + "-watermarked.pdf", "application/pdf");
      try { q("pw").value = ""; } catch {}
      const warnTxt = warnings.length ? " Warnings: " + warnings.join(" ") : "";
      status(`Done — watermark "${text}" on ${targets.length} of ${n} page(s).${warnTxt}`);
    } catch (e) { status("Error: " + (e?.message || e)); }
  });
  return () => {
    files = [];
    try { q("pw").value = ""; } catch {}
    page.cleanup();
  };
}
