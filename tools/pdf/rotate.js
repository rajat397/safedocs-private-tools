// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/rotate.js — rotate pages 90/180/270 (all or selected). Client-side only, zero upload. (P2 shell UI.)
import { shell } from '../_lib/page.js';
export async function mount(el, ctx = {}) {
  const tool = (ctx && ctx.tool) || {};
  const page = shell(el, tool, ctx);
  const status = page.status;
  const q = (s) => page.root.querySelector(`[data-f="${s}"]`);
  const TOOL_ID = (ctx && ctx.tool && ctx.tool.id) || "pdf-rotate";

  page.optionsEl.innerHTML = `
    <label>Password (if encrypted)
      <input type="password" data-f="pw" placeholder="Optional" />
    </label>
    <label>Rotation (clockwise)
      <select data-f="angle">
        <option value="90">90&deg;</option>
        <option value="180">180&deg;</option>
        <option value="270">270&deg;</option>
      </select>
    </label>
    <label>Pages (blank = all, e.g. 1,3,5-7)
      <input type="text" data-f="pages" placeholder="All pages" />
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
        if (!pw) throw new Error("This PDF is encrypted — enter its password and try again.");
        try { return await PDFDocument.load(bytes, { password: pw }); }
        catch (e2) { throw new Error("Encrypted PDF needs the correct password: " + ((e2 && e2.message) || e2)); }
      }
      throw e;
    }
  }

  function parsePages(str, n) {
    str = (str || "").trim();
    if (!str) return null; // null = all pages
    const out = [];
    for (const part of str.split(",")) {
      const t = part.trim();
      if (!t) continue;
      const m = t.match(/^(\d+)\s*-\s*(\d+)$/);
      if (m) {
        let a = +m[1], b = +m[2];
        const step = a <= b ? 1 : -1;
        for (let p = a; step > 0 ? p <= b : p >= b; p += step) {
          if (p < 1 || p > n) throw new Error(`Page ${p} out of range (1–${n}).`);
          if (!out.includes(p - 1)) out.push(p - 1);
        }
      } else if (/^\d+$/.test(t)) {
        const p = +t;
        if (p < 1 || p > n) throw new Error(`Page ${p} out of range (1–${n}).`);
        if (!out.includes(p - 1)) out.push(p - 1);
      } else throw new Error(`Bad token "${t}" (use e.g. 1,3,5-7).`);
    }
    if (!out.length) throw new Error("No valid pages in selection.");
    out.sort((a, b) => a - b);
    return out;
  }

  page.runBtn("Rotate & download", async (got) => {
    try {
      files = [...(got || [])];
      const f = files[0];
      if (!f) { status("Pick a PDF."); return; }
      const chk = checkCaps([f], { toolId: TOOL_ID, accept: ".pdf,application/pdf", multiple: false });
      const file = (chk && chk.accepted && chk.accepted.length) ? chk.accepted[0] : f;
      if (chk && chk.accepted && !chk.accepted.length) return;
      const angle = +(q("angle").value || 90);
      if (![90, 180, 270].includes(angle)) throw new Error("Pick a rotation of 90, 180, or 270 degrees.");
      status("Loading pdf-lib…");
      const { PDFDocument, degrees } = await loadPdfLib();
      const buf = new Uint8Array(await file.arrayBuffer());
      const src = await loadPdfWithPassword(PDFDocument, buf, () => q("pw").value);
      const n = src.getPageCount();
      const MAX_PAGES = 500;
      if (n > MAX_PAGES) throw new Error(`Page-count guard: PDF has ${n} pages (cap ${MAX_PAGES}).`);
      const targets = parsePages(q("pages").value, n) ?? src.getPageIndices();
      status("Rotating…");
      for (const idx of targets) {
        const pg = src.getPage(idx);
        const cur = pg.getRotation().angle;
        pg.setRotation(degrees((cur + angle) % 360));
      }
      const bytes = await src.save();
      saveBytes(bytes, file.name.replace(/\.pdf$/i, "") + `-rotated-${angle}.pdf`, "application/pdf");
      try { q("pw").value = ""; } catch {}
      const scope = targets.length === n ? "all pages" : `pages ${targets.map((i) => i + 1).join(",")}`;
      status(`Done — rotated ${scope} by ${angle}° clockwise. (100% client-side)`);
    } catch (e) {
      status("Error: " + (e?.message || e));
    }
    finally { try { q("pw").value = ""; } catch {} }
  });
  return () => {
    files = [];
    try { q("pw").value = ""; } catch {}
    page.cleanup();
  };
}
