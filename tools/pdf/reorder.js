// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/reorder.js — reorder pages via order spec like "3,1,2" or "2-4,1".
export async function mount(el, ctx = {}) {
  el.innerHTML = `
    <div style="display:grid;gap:10px">
      <label style="font-size:13px;font-weight:600">Source PDF
        <input type="file" data-f="file" accept="application/pdf,.pdf" />
      </label>
      <label style="font-size:13px;font-weight:600">Password (if encrypted)
        <input type="password" data-f="pw" placeholder="Optional" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px" />
      </label>
      <label style="font-size:13px;font-weight:600">New order (e.g. 3,1,2 or 2-4,1)
        <input type="text" data-f="order" placeholder="3,1,2" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px" />
      </label>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button data-f="go">Reorder & download</button>
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

  function parseOrder(str, n, warnings = []) {
    str = (str || "").trim();
    if (!str) throw new Error("Enter a new order, e.g. 3,1,2");
    const out = [];
    for (const part of str.split(",")) {
      const t = part.trim();
      if (!t) continue;
      const m = t.match(/^(\d+)\s*-\s*(\d+)$/);
      if (m) {
        let a = +m[1], b = +m[2];
        if (a < 1 || a > n || b < 1 || b > n) {
          warnings.push(`Range "${t}" includes pages out of range (1–${n}) — clipped.`);
        }
        const step = a <= b ? 1 : -1;
        for (let p = a; step > 0 ? p <= b : p >= b; p += step) {
          if (p < 1 || p > n) continue;
          out.push(p - 1);
        }
      } else if (/^\d+$/.test(t)) {
        const p = +t;
        if (p < 1 || p > n) { warnings.push(`Page ${p} out of range (1–${n}) — skipped.`); continue; }
        out.push(p - 1);
      } else throw new Error(`Bad token "${t}"`);
    }
    if (!out.length) throw new Error("No valid pages in order.");
    const seen = new Set(out);
    if (seen.size !== out.length) warnings.push("Warning: duplicates in order — pages will be duplicated in output.");
    if (seen.size !== n) warnings.push(`Note: order covers ${seen.size}/${n} unique pages${seen.size < n ? " (some pages omitted)" : " (all pages covered)"}.`);
    return out;
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
      capsInfo("reorder");
      const chk = checkCaps([f], { toolId: "reorder", accept: ".pdf,application/pdf", multiple: false });
      const file = (chk && chk.accepted && chk.accepted.length) ? chk.accepted[0] : f;
      if (chk && chk.accepted && !chk.accepted.length) return;
      status("Loading pdf-lib…");
      const { PDFDocument } = await loadPdfLib();
      const src = await loadPdfWithPassword(PDFDocument, new Uint8Array(await file.arrayBuffer()), () => q("pw").value);
      const n = src.getPageCount();
      if (n > 500) throw new Error(`Page-count guard: PDF has ${n} pages (cap 500).`);
      const warnings = [];
      const order = parseOrder(q("order").value, n, warnings);
      const out = await PDFDocument.create();
      const pages = await out.copyPages(src, order);
      pages.forEach((p) => out.addPage(p));
      saveBytes(await out.save(), file.name.replace(/.pdf$/i, "") + "-reordered.pdf", "application/pdf");
      try { q("pw").value = ""; } catch {}
      const warnTxt = warnings.length ? " " + warnings.join(" ") : "";
      status(`Done — new order: ${order.map((i) => i + 1).join(",")}.${warnTxt}`);
    } catch (e) { status("Error: " + (e?.message || e)); }
  };
  q("go").addEventListener("click", onGo);
  return () => {
    try { trackedUrls.forEach((u) => URL.revokeObjectURL(u)); } catch {}
    el.innerHTML = "";
  };
}
