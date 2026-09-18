// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/pagenum.js — page-number text overlay (bottom-center).
export async function mount(el, ctx = {}) {
  el.innerHTML = `
    <div style="display:grid;gap:10px">
      <label style="font-size:13px;font-weight:600">Source PDF
        <input type="file" data-f="file" accept="application/pdf,.pdf" />
      </label>
      <label style="font-size:13px;font-weight:600">Password (if encrypted)
        <input type="password" data-f="pw" placeholder="Optional" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px" />
      </label>
      <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:13px">
        <label>Format <input data-f="fmt" value="{p} / {n}" style="padding:6px;border:1px solid #e2e8f0;border-radius:8px;width:110px" /></label>
        <label>Size <input data-f="size" type="number" value="10" min="6" max="24" style="padding:6px;border:1px solid #e2e8f0;border-radius:8px;width:64px" /></label>
        <label>Pages <input data-f="pages" placeholder="all" style="padding:6px;border:1px solid #e2e8f0;border-radius:8px;width:110px" /></label>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button data-f="go">Add numbers & download</button></div>
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

  const onGo = async () => {
    try {
      const f = q("file").files[0];
      if (!f) { status("Pick a PDF."); return; }
      capsInfo("pagenum");
      const chk = checkCaps([f], { toolId: "pagenum", accept: ".pdf,application/pdf", multiple: false });
      const file = (chk && chk.accepted && chk.accepted.length) ? chk.accepted[0] : f;
      if (chk && chk.accepted && !chk.accepted.length) return;
      status("Loading pdf-lib…");
      const { PDFDocument, StandardFonts, rgb } = await loadPdfLib();
      const doc = await loadPdfWithPassword(PDFDocument, new Uint8Array(await file.arrayBuffer()), () => q("pw").value);
      const n = doc.getPageCount();
      if (n > 500) throw new Error(`Page-count guard: PDF has ${n} pages (cap 500).`);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const size = Math.min(24, Math.max(6, +q("size").value || 10));
      const fmt = q("fmt").value || "{p} / {n}";
      const warnings = [];
      const targets = parsePages(q("pages").value, n, warnings);
      if (!targets.length) { status("No pages match (all out of range)." + (warnings.length ? " " + warnings.join(" ") : "")); return; }
      for (const i of targets) {
        const page = doc.getPage(i);
        const { width } = page.getSize();
        const label = fmt.replaceAll("{p}", String(i + 1)).replaceAll("{n}", String(n));
        const tw = font.widthOfTextAtSize(label, size);
        page.drawText(label, { x: width / 2 - tw / 2, y: 24, size, font, color: rgb(0.25, 0.25, 0.25) });
      }
      const bytes = await doc.save({ useObjectStreams: true });
      saveBytes(bytes, file.name.replace(/.pdf$/i, "") + "-numbered.pdf", "application/pdf");
      try { q("pw").value = ""; } catch {}
      const warnTxt = warnings.length ? " Warnings: " + warnings.join(" ") : "";
      status(`Done — numbered ${targets.length} of ${n} pages as "${fmt}".${warnTxt}`);
    } catch (e) { status("Error: " + (e?.message || e)); }
  };
  q("go").addEventListener("click", onGo);
  return () => {
    try { trackedUrls.forEach((u) => URL.revokeObjectURL(u)); } catch {}
    el.innerHTML = "";
  };
}
