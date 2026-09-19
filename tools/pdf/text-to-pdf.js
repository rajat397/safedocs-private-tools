// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/text-to-pdf.js — textarea / .txt / .md / .csv → PDF (Helvetica, wrapped). Client-side only. (P2 shell UI.)
import { shell } from '../_lib/page.js';
export async function mount(el, ctx = {}) {
  const tool = (ctx && ctx.tool) || {};
  const page = shell(el, tool, ctx);
  const status = page.status;
  const q = (s) => page.root.querySelector(`[data-f="${s}"]`);

  page.optionsEl.innerHTML = `
    <label>Text file (.txt / .md / .csv, optional)
      <input type="file" data-f="file" accept=".txt,.md,.csv,text/plain" />
    </label>
    <label>Text
      <textarea data-f="text" rows="10" placeholder="Paste or type text here, or pick a file above…"></textarea>
    </label>
    <label>Preset
      <select data-f="preset">
        <option value="S">S — compact (10pt)</option>
        <option value="M" selected>M — standard (12pt)</option>
        <option value="L">L — large (14pt)</option>
      </select>
    </label>`;

  let files = [];
  // The shell run guard needs ≥1 file, but this tool also accepts bare typed
  // text. When the textarea has text and no real file is selected, seed a
  // synthetic typed.txt so Run stays enabled; the run logic still prefers
  // the live textarea value. Identity-checked so real picks replace it.
  let syntheticFile = null;

  const PRESETS = { S: 10, M: 12, L: 14 };
  const MAX_CHARS = 500000;

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
    throw new Error("Could not load pdf-lib@1.17.1");
  }

  // Greedy word-wrap for one logical line. Splits overlong words char-by-char.
  function wrapLine(line, font, size, maxWidth) {
    const expanded = String(line).replace(/\t/g, "    ");
    if (!expanded.trim()) return [""];
    const width = (s) => font.widthOfTextAtSize(s, size);
    const tokens = expanded.split(/(\s+)/).filter((w) => w.length);
    const out = [];
    let cur = "";
    const flush = () => { out.push(cur.trimEnd()); cur = ""; };
    const breakWord = (word) => {
      let chunk = "";
      for (const ch of word) {
        if (width(chunk + ch) <= maxWidth || !chunk) chunk += ch;
        else { out.push(chunk); chunk = ch; }
      }
      return chunk;
    };
    for (const tok of tokens) {
      if (/^\s+$/.test(tok)) {
        if (!cur) continue; // collapse leading whitespace
        if (width(cur + tok.trimEnd()) <= maxWidth) cur += tok;
        else flush();
        continue;
      }
      const cand = cur ? cur + " " + tok : tok;
      if (width(cand) <= maxWidth) { cur = cand; continue; }
      if (cur) flush();
      cur = width(tok) <= maxWidth ? tok : breakWord(tok);
    }
    if (cur) flush();
    else if (!out.length) out.push("");
    return out;
  }

  async function loadTextFile(f) {
    const chk = checkCaps([f], { toolId: "text-to-pdf", accept: ".txt,.md,.csv,text/plain", multiple: false });
    const file = (chk && chk.accepted && chk.accepted.length) ? chk.accepted[0] : f;
    if (chk && chk.accepted && !chk.accepted.length) return;
    status("Reading " + file.name + "…");
    const text = await file.text();
    q("text").value = text;
    status(`Loaded ${file.name} (${text.length.toLocaleString()} chars).`);
  }

  page.onFiles((accepted) => {
    files = [...accepted];
    if (accepted.length === 1 && accepted[0] === syntheticFile) return; // our own seed echo
    syntheticFile = null;
    if (files[0]) loadTextFile(files[0]).catch((err) => status("Error: " + (err?.message || err)));
  });

  q("file").addEventListener("change", async (e) => {
    try {
      const f = e.target.files[0];
      if (!f) return;
      await loadTextFile(f);
    } catch (err) { status("Error: " + (err?.message || err)); }
  });

  q("text").addEventListener("input", () => {
    try {
      const hasText = (q("text").value || "").length > 0;
      const current = page.getFiles();
      const hasReal = current.some((f) => f !== syntheticFile);
      if (hasText && !hasReal && !syntheticFile) {
        syntheticFile = new File([q("text").value], "typed.txt", { type: "text/plain" });
        page.setFiles([syntheticFile]);
        files = page.getFiles();
      } else if (!hasText && syntheticFile && !hasReal) {
        syntheticFile = null;
        page.setFiles([]);
        files = [];
      }
    } catch {}
  });

  page.runBtn("Convert & download", async (got) => {
    try {
      files = [...(got || [])];
      let text = q("text").value || "";
      // If textarea empty but a file is picked, read it.
      if (!text) {
        const f = files.find((x) => x !== syntheticFile) || files[0] || q("file").files[0];
        if (f && f !== syntheticFile) {
          const chk = checkCaps([f], { toolId: "text-to-pdf", accept: ".txt,.md,.csv,text/plain", multiple: false });
          const file = (chk && chk.accepted && chk.accepted.length) ? chk.accepted[0] : f;
          if (chk && chk.accepted && !chk.accepted.length) return;
          text = await file.text();
          q("text").value = text;
        }
      }
      if (!text) { status("Type text or pick a .txt / .md / .csv file."); return; }
      if (text.length > MAX_CHARS) throw new Error(`Text too large: ${text.length.toLocaleString()} chars (cap ${MAX_CHARS.toLocaleString()}).`);
      const preset = q("preset").value || "M";
      const size = PRESETS[preset] || 12;
      status("Loading pdf-lib…");
      const { PDFDocument, StandardFonts, rgb } = await loadPdfLib();
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const A4 = [595.28, 841.89];
      const MARGIN = 48;
      const maxWidth = A4[0] - MARGIN * 2;
      const lineHeight = size * 1.4;
      const color = rgb(0.12, 0.12, 0.12);
      let pg = doc.addPage(A4);
      let y = A4[1] - MARGIN;
      const logical = text.replace(/\r\n/g, "\n").split("\n");
      for (const raw of logical) {
        const wrapped = wrapLine(raw, font, size, maxWidth);
        for (const line of wrapped) {
          if (y - lineHeight < MARGIN) { pg = doc.addPage(A4); y = A4[1] - MARGIN; }
          y -= lineHeight;
          // pdf-lib drawText renders WinAnsi; replace lone surrogates safely.
          const safe = line.replace(/[\u{10000}-\u{10FFFF}]/gu, "?");
          pg.drawText(safe, { x: MARGIN, y, size, font, color, maxWidth });
        }
      }
      const n = doc.getPageCount();
      if (n > 500) throw new Error(`Page-count guard: output has ${n} pages (cap 500). Shorten the text or use S preset.`);
      const f0 = files.find((x) => x !== syntheticFile) || q("file").files[0];
      const base = (f0?.name || "text").replace(/\.[^.]+$/, "") || "text";
      saveBytes(await doc.save({ useObjectStreams: true }), `${base}.pdf`, "application/pdf");
      status(`Done — ${text.length.toLocaleString()} chars → ${n} page(s) at ${preset} (${size}pt Helvetica).`);
    } catch (e) { status("Error: " + (e?.message || e)); }
  });
  return () => {
    files = [];
    syntheticFile = null;
    page.cleanup();
  };
}
