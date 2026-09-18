// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/split.js — extract page ranges into separate PDFs. Client-side only.
export async function mount(el, ctx = {}) {
  el.innerHTML = `
    <div style="display:grid;gap:10px">
      <label style="font-size:13px;font-weight:600">Source PDF
        <input type="file" data-f="file" accept="application/pdf,.pdf" />
      </label>
      <label style="font-size:13px;font-weight:600">Password (if encrypted)
        <input type="password" data-f="pw" placeholder="Optional" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px" />
      </label>
      <label style="font-size:13px;font-weight:600">Ranges (e.g. 1-3, 4-6, 8)
        <input type="text" data-f="ranges" placeholder="1-3, 4-6" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px" />
      </label>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button data-f="go">Split & download</button>
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

  function parseRanges(str, pageCount, warnings = []) {
    str = (str || "").trim().toLowerCase();
    if (!str || str === "all") return [Array.from({ length: pageCount }, (_, i) => i)];
    const groups = [];
    for (const part of str.split(",")) {
      const t = part.trim();
      if (!t) continue;
      const m = t.match(/^(\d+)\s*-\s*(\d+)$/);
      if (m) {
        let a = Math.max(1, +m[1]), b = Math.max(1, +m[2]);
        const origA = a, origB = b;
        if (a > b) [a, b] = [b, a];
        if (a > pageCount) { warnings.push(`Range "${t}" out of range (1–${pageCount}) — skipped.`); continue; }
        if (b > pageCount) { warnings.push(`Range "${origA}-${origB}" truncated to ${a}-${pageCount} (PDF has ${pageCount} pages).`); b = pageCount; }
        const idx = [];
        for (let p = a; p <= b; p++) idx.push(p - 1);
        if (idx.length) groups.push(idx);
      } else if (/^\d+$/.test(t)) {
        const p = +t;
        if (p >= 1 && p <= pageCount) groups.push([p - 1]);
        else warnings.push(`Page ${p} out of range (1–${pageCount}) — skipped.`);
      } else throw new Error(`Bad range token: "${t}" (use like 1-3, 5)`);
    }
    if (!groups.length) throw new Error("No valid ranges (all skipped as out of range).");
    return groups;
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

  const onGo = async () => {
    try {
      const f = q("file").files[0];
      if (!f) { status("Pick a PDF first."); return; }
      capsInfo("split");
      const chk = checkCaps([f], { toolId: "split", accept: ".pdf,application/pdf", multiple: false });
      const file = (chk && chk.accepted && chk.accepted.length) ? chk.accepted[0] : f;
      if (chk && chk.accepted && !chk.accepted.length) return;
      status("Loading pdf-lib…");
      const { PDFDocument } = await loadPdfLib();
      const src = await loadPdfWithPassword(PDFDocument, new Uint8Array(await file.arrayBuffer()), () => q("pw").value);
      const n = src.getPageCount();
      const MAX_PAGES = 500;
      if (n > MAX_PAGES) throw new Error(`Page-count guard: PDF has ${n} pages (cap ${MAX_PAGES}).`);
      const warnings = [];
      const groups = parseRanges(q("ranges").value, n, warnings);
      let i = 0;
      for (const idx of groups) {
        i++;
        const out = await PDFDocument.create();
        const pages = await out.copyPages(src, idx);
        pages.forEach((p) => out.addPage(p));
        const bytes = await out.save();
        const base = file.name.replace(/.pdf$/i, "");
        saveBytes(bytes, `${base}-part${i}-(p${idx[0] + 1}-${idx[idx.length - 1] + 1}).pdf`, "application/pdf");
      }
      try { q("pw").value = ""; } catch {}
      const warnTxt = warnings.length ? " Warnings: " + warnings.join(" ") : "";
      status(`Done — ${n}-page PDF split into ${groups.length} file(s).${warnTxt}`);
    } catch (e) { status("Error: " + (e?.message || e)); }
  };
  q("go").addEventListener("click", onGo);
  return () => {
    try { trackedUrls.forEach((u) => URL.revokeObjectURL(u)); } catch {}
    el.innerHTML = "";
  };
}
