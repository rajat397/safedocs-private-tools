// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/split-by-size.js — split a PDF into parts each under a target MB size. pdf-lib only, client-side. (P2 shell UI.)
import { shell } from '../_lib/page.js';
export async function mount(el, ctx = {}) {
  const tool = (ctx && ctx.tool) || {};
  const page = shell(el, tool, ctx);
  const status = page.status;
  const setProgress = page.setProgress;
  const q = (s) => page.root.querySelector(`[data-f="${s}"]`);
  const TOOL_ID = (ctx && ctx.tool && ctx.tool.id) || "pdf-split-by-size";
  const MAX_PAGES = 500;

  page.optionsEl.innerHTML = `
    <label>Password (if encrypted)
      <input type="password" data-f="pw" placeholder="Optional" />
    </label>
    <label>Target size per part (MB)
      <select data-f="mb">
        <option value="1">1 MB</option>
        <option value="2">2 MB</option>
        <option value="5" selected>5 MB</option>
        <option value="10">10 MB</option>
        <option value="25">25 MB</option>
      </select>
    </label>
    <p class="muted" style="margin:0;font-size:12px">100% on-device. Pages are grouped greedily so each part stays under the target; shared PDF objects mean parts can vary slightly. A single page bigger than the target is emitted alone with a warning (pages are never rasterized or cut).</p>`;

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
    throw new Error("Could not load pdf-lib@1.17.1 (check network).");
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

  page.runBtn("Split by size & download", async (got) => {
    try {
      files = [...(got || [])];
      const f = files[0];
      if (!f) { status("Pick a PDF."); return; }
      const chk = checkCaps([f], { toolId: TOOL_ID, accept: ".pdf,application/pdf", multiple: false });
      const file = (chk && chk.accepted && chk.accepted.length) ? chk.accepted[0] : f;
      if (chk && chk.accepted && !chk.accepted.length) return;
      const targetMB = parseFloat(q("mb").value);
      if (!Number.isFinite(targetMB) || targetMB <= 0) throw new Error("Pick a target size (MB).");
      const targetBytes = Math.floor(targetMB * 1024 * 1024);
      status("Loading pdf-lib…");
      const { PDFDocument } = await loadPdfLib();
      const raw = new Uint8Array(await file.arrayBuffer());
      const src = await loadPdfWithPassword(PDFDocument, raw, () => q("pw").value);
      const n = src.getPageCount();
      if (n > MAX_PAGES) throw new Error(`Page-count guard: PDF has ${n} pages (cap ${MAX_PAGES}).`);
      if (n < 2) throw new Error("Nothing to split: PDF has only 1 page.");
      // Greedy pack: grow each chunk page-by-page, measuring the saved chunk.
      const chunks = [];
      let cur = [];
      const warnings = [];
      async function measure(idxs) {
        const tmp = await PDFDocument.create();
        const pages = await tmp.copyPages(src, idxs);
        pages.forEach((p) => tmp.addPage(p));
        return tmp.save({ useObjectStreams: true });
      }
      for (let i = 0; i < n; i++) {
        const trial = [...cur, i];
        const bytes = await measure(trial);
        if (bytes.length <= targetBytes || cur.length === 0) {
          cur = trial;
          if (cur.length === 1 && bytes.length > targetBytes) {
            warnings.push(`Page ${i + 1} alone is ${(bytes.length / 1048576).toFixed(1)} MB (over ${targetMB} MB target) — emitted solo.`);
          }
        } else {
          chunks.push(cur);
          cur = [i];
          status(`Packing… ${chunks.length} part(s) so far (page ${i + 1}/${n}).`);
          await new Promise((r) => setTimeout(r, 0));
        }
        setProgress((i + 1) / n / 2);
      }
      if (cur.length) chunks.push(cur);
      const base = file.name.replace(/\.pdf$/i, "");
      let k = 0;
      for (const idxs of chunks) {
        k++;
        status(`Saving part ${k}/${chunks.length}…`);
        const bytes = await measure(idxs);
        assertPdfHeader(bytes);
        saveBytes(bytes, `${base}-s${k}-p${idxs[0] + 1}-${idxs[idxs.length - 1] + 1}.pdf`, "application/pdf");
        setProgress(0.5 + (k / chunks.length) / 2);
        await new Promise((r) => setTimeout(r, 0));
      }
      try { q("pw").value = ""; } catch {}
      const warnTxt = warnings.length ? " Warnings: " + warnings.join(" ") : "";
      status(`Done — ${n}-page PDF split into ${chunks.length} part(s) targeting ≤ ${targetMB} MB each.${warnTxt}`);
    } catch (e) { status("Error: " + (e?.message || e)); }
  });
  return () => {
    files = [];
    try { q("pw").value = ""; } catch {}
    page.cleanup();
  };
}
