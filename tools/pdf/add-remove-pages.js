// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/add-remove-pages.js — delete ranges, insert pages from a second PDF, add blank pages. Client-side only.
export async function mount(el, ctx = {}) {
  el.innerHTML = `
    <div style="display:grid;gap:10px">
      <label style="font-size:13px;font-weight:600">Source PDF
        <input type="file" data-f="file" accept="application/pdf,.pdf" />
      </label>
      <label style="font-size:13px;font-weight:600">Password for source (if encrypted)
        <input type="password" data-f="pw" placeholder="Optional" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px" />
      </label>
      <label style="font-size:13px;font-weight:600">Delete pages (e.g. 2, 4-5 — blank = keep all)
        <input type="text" data-f="delete" placeholder="2, 4-5" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px" />
      </label>
      <label style="font-size:13px;font-weight:600">Insert from second PDF (optional)
        <input type="file" data-f="insFile" accept="application/pdf,.pdf" />
      </label>
      <label style="font-size:13px;font-weight:600">Password for insert PDF (if encrypted)
        <input type="password" data-f="insPw" placeholder="Optional" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px" />
      </label>
      <label style="font-size:13px;font-weight:600">Insert pages (e.g. 1-2 — blank = all)
        <input type="text" data-f="insRanges" placeholder="all" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px" />
      </label>
      <label style="font-size:13px;font-weight:600">Insert at position (1-based, blank/end = append)
        <input type="text" data-f="insAt" placeholder="e.g. 3" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px" />
      </label>
      <div style="display:grid;gap:8px;grid-template-columns:1fr 1fr">
        <label style="font-size:13px;font-weight:600">Blank pages to add
          <input type="number" data-f="blankCount" min="0" max="100" value="0" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px;width:100%" />
        </label>
        <label style="font-size:13px;font-weight:600">Blank at position (blank/end = append)
          <input type="text" data-f="blankAt" placeholder="e.g. 1" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px" />
        </label>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button data-f="go">Apply & download</button>
      </div>
      <div data-f="status" style="font-size:13px;color:#64748b"></div>
    </div>`;

  const q = (s) => el.querySelector(`[data-f="${s}"]`);
  const status = (m) => { q("status").textContent = m; };
  const TOOL_ID = (ctx && ctx.tool && ctx.tool.id) || "pdf-add-remove-pages";
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
        if (!pw) throw new Error("An input PDF is encrypted — enter its password and try again.");
        try { return await PDFDocument.load(bytes, { password: pw }); }
        catch (e2) { throw new Error("Encrypted PDF needs the correct password: " + ((e2 && e2.message) || e2)); }
      }
      throw e;
    }
  }

  // "2, 4-5" -> sorted unique 0-based indices, clipped to [0, n). Blank = [].
  function parseDeleteRanges(str, n, warnings = []) {
    str = (str || "").trim();
    if (!str) return [];
    const set = new Set();
    for (const part of str.split(",")) {
      const t = part.trim();
      if (!t) continue;
      const m = t.match(/^(\d+)\s*-\s*(\d+)$/);
      if (m) {
        let a = +m[1], b = +m[2];
        if (a > b) [a, b] = [b, a];
        if (a > n) { warnings.push(`Delete range "${t}" out of range (1–${n}) — skipped.`); continue; }
        if (b > n) { warnings.push(`Delete range "${t}" truncated to ${a}-${n} (PDF has ${n} pages).`); b = n; }
        for (let p = Math.max(1, a); p <= b; p++) set.add(p - 1);
      } else if (/^\d+$/.test(t)) {
        const p = +t;
        if (p >= 1 && p <= n) set.add(p - 1);
        else warnings.push(`Delete page ${p} out of range (1–${n}) — skipped.`);
      } else throw new Error(`Bad delete token: "${t}" (use like 2, 4-5)`);
    }
    return [...set].sort((x, y) => x - y);
  }

  // "1-2, 5" / "" / "all" -> 0-based indices into a doc with n pages.
  function parseInsertRanges(str, n) {
    str = (str || "").trim().toLowerCase();
    if (!str || str === "all") return Array.from({ length: n }, (_, i) => i);
    const out = [];
    for (const part of str.split(",")) {
      const t = part.trim();
      if (!t) continue;
      const m = t.match(/^(\d+)\s*-\s*(\d+)$/);
      if (m) {
        let a = +m[1], b = +m[2];
        if (a > b) [a, b] = [b, a];
        for (let p = Math.max(1, a); p <= Math.min(n, b); p++) out.push(p - 1);
      } else if (/^\d+$/.test(t)) {
        const p = +t;
        if (p >= 1 && p <= n) out.push(p - 1);
      } else throw new Error(`Bad insert token: "${t}" (use like 1-2, 5)`);
    }
    if (!out.length) throw new Error("No valid insert pages (all out of range).");
    return out;
  }

  // 1-based UI position -> 0-based clamp into [0, count]. Blank = count (append).
  function parsePosition(str, count) {
    str = (str || "").trim();
    if (!str) return count;
    const p = Number.parseInt(str, 10);
    if (!Number.isFinite(p)) throw new Error(`Bad position: "${str}" (use a 1-based page number or leave blank for end)`);
    return Math.min(Math.max(p - 1, 0), count);
  }

  const onGo = async () => {
    try {
      const f = q("file").files[0];
      if (!f) { status("Pick a source PDF first."); return; }
      capsInfo(TOOL_ID);
      const chk = checkCaps([f], { toolId: TOOL_ID, accept: ".pdf,application/pdf", multiple: false });
      const file = (chk && chk.accepted && chk.accepted.length) ? chk.accepted[0] : f;
      if (chk && chk.accepted && !chk.accepted.length) return;

      const insFileRaw = q("insFile").files[0] || null;
      let insFile = insFileRaw;
      if (insFileRaw) {
        const chk2 = checkCaps([insFileRaw], { toolId: TOOL_ID, accept: ".pdf,application/pdf", multiple: false });
        if (chk2) {
          if (chk2.accepted && chk2.accepted.length) insFile = chk2.accepted[0];
          else return;
        }
      }

      status("Loading pdf-lib…");
      const { PDFDocument } = await loadPdfLib();
      const src = await loadPdfWithPassword(PDFDocument, new Uint8Array(await file.arrayBuffer()), () => q("pw").value);
      const n = src.getPageCount();
      const MAX_PAGES = 500;
      if (n > MAX_PAGES) throw new Error(`Page-count guard: source PDF has ${n} pages (cap ${MAX_PAGES}).`);

      const warnings = [];
      const delIdx = parseDeleteRanges(q("delete").value, n, warnings);

      // Start from a copy of the source so embedded resources survive.
      const out = await PDFDocument.create();
      const basePages = await out.copyPages(src, src.getPageIndices());
      basePages.forEach((p) => out.addPage(p));

      // 1) Delete (descending so indices stay valid).
      const delDesc = [...delIdx].sort((a, b) => b - a);
      for (const idx of delDesc) out.removePage(idx);
      if (delIdx.length && out.getPageCount() === 0 && !insFile && !(Number.parseInt((q("blankCount").value || "0"), 10) > 0)) {
        throw new Error("Refusing to delete every page with nothing to add — uncheck a page or add blank/insert pages.");
      }

      let inserted = 0;
      let blankAdded = 0;

      // 2) Insert pages copied from the second PDF at the requested position.
      if (insFile) {
        const insSrc = await loadPdfWithPassword(PDFDocument, new Uint8Array(await insFile.arrayBuffer()), () => q("insPw").value);
        const insN = insSrc.getPageCount();
        if (insN > MAX_PAGES) throw new Error(`Page-count guard: insert PDF has ${insN} pages (cap ${MAX_PAGES}).`);
        const wantIdx = parseInsertRanges(q("insRanges").value, insN);
        if (out.getPageCount() + wantIdx.length > MAX_PAGES) {
          throw new Error(`Page-count guard: result would exceed ${MAX_PAGES} pages (${out.getPageCount()} + ${wantIdx.length}).`);
        }
        const copied = await out.copyPages(insSrc, wantIdx);
        let at = parsePosition(q("insAt").value, out.getPageCount());
        for (const pg of copied) {
          out.insertPage(at, pg);
          at += 1;
          inserted += 1;
        }
      }

      // 3) Add blank pages (appended via addPage, or spliced via insertPage).
      const blankCount = Math.max(0, Number.parseInt((q("blankCount").value || "0"), 10) || 0);
      if (blankCount > 0) {
        if (out.getPageCount() + blankCount > MAX_PAGES) {
          throw new Error(`Page-count guard: adding ${blankCount} blank page(s) would exceed ${MAX_PAGES} pages.`);
        }
        if (blankCount > 100) throw new Error("Blank-page guard: at most 100 blank pages per run.");
        const blankAtRaw = (q("blankAt").value || "").trim();
        let size = [595.28, 841.89]; // A4 fallback
        try {
          if (out.getPageCount() > 0) {
            const s = out.getPage(0).getSize();
            if (s && s.width > 0 && s.height > 0) size = [s.width, s.height];
          }
        } catch {}
        if (!blankAtRaw) {
          for (let i = 0; i < blankCount; i++) { out.addPage(size.slice()); blankAdded += 1; }
        } else {
          let at = parsePosition(blankAtRaw, out.getPageCount());
          for (let i = 0; i < blankCount; i++) { out.insertPage(at, size.slice()); at += 1; blankAdded += 1; }
        }
      }

      if (!delIdx.length && !inserted && !blankAdded) { status("Nothing to do — enter pages to delete, pick an insert PDF, or add blank pages."); return; }

      const bytes = await out.save();
      const base = (file.name || "document.pdf").replace(/\.pdf$/i, "");
      saveBytes(bytes, `${base}-edited.pdf`, "application/pdf");
      try { q("pw").value = ""; } catch {}
      try { q("insPw").value = ""; } catch {}
      const warnTxt = warnings.length ? " Warnings: " + warnings.join(" ") : "";
      status(`Done — ${n} → ${out.getPageCount()} pages (deleted ${delIdx.length}, inserted ${inserted}, blank ${blankAdded}).${warnTxt} (100% client-side)`);
    } catch (e) { status("Error: " + (e?.message || e)); }
    finally { try { q("pw").value = ""; } catch {} try { q("insPw").value = ""; } catch {} }
  };
  q("go").addEventListener("click", onGo);
  return () => {
    try { trackedUrls.forEach((u) => URL.revokeObjectURL(u)); } catch {}
    try { q("pw").value = ""; } catch {}
    try { q("insPw").value = ""; } catch {}
    el.innerHTML = "";
  };
}
