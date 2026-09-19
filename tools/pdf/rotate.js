// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/rotate.js — rotate pages 90/180/270 (all or selected). Client-side only, zero upload.
export async function mount(el, ctx = {}) {
  el.innerHTML = `
    <div style="display:grid;gap:10px">
      <label style="font-size:13px;font-weight:600">Source PDF
        <input type="file" data-f="file" accept="application/pdf,.pdf" />
      </label>
      <label style="font-size:13px;font-weight:600">Password (if encrypted)
        <input type="password" data-f="pw" placeholder="Optional" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px" />
      </label>
      <label style="font-size:13px;font-weight:600">Rotation (clockwise)
        <select data-f="angle" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px">
          <option value="90">90&deg;</option>
          <option value="180">180&deg;</option>
          <option value="270">270&deg;</option>
        </select>
      </label>
      <label style="font-size:13px;font-weight:600">Pages (blank = all, e.g. 1,3,5-7)
        <input type="text" data-f="pages" placeholder="All pages" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px" />
      </label>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button data-f="go">Rotate & download</button>
      </div>
      <div data-f="status" style="font-size:13px;color:#64748b"></div>
    </div>`;

  const q = (s) => el.querySelector(`[data-f="${s}"]`);
  const status = (m) => { q("status").textContent = m; };
  const TOOL_ID = (ctx && ctx.tool && ctx.tool.id) || "pdf-rotate";
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

  const onGo = async () => {
    try {
      const f = q("file").files[0];
      if (!f) { status("Pick a PDF."); return; }
      capsInfo(TOOL_ID);
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
        const page = src.getPage(idx);
        const cur = page.getRotation().angle;
        page.setRotation(degrees((cur + angle) % 360));
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
  };
  q("go").addEventListener("click", onGo);
  return () => {
    try { trackedUrls.forEach((u) => URL.revokeObjectURL(u)); } catch {}
    try { q("pw").value = ""; } catch {}
    el.innerHTML = "";
  };
}
