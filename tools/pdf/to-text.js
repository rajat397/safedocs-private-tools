// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/to-text.js — extract selectable text via pdf.js getTextContent. Client-side only, no OCR.
export async function mount(el, ctx = {}) {
  el.innerHTML = `
    <div style="display:grid;gap:10px">
      <label style="font-size:13px;font-weight:600">Source PDF
        <input type="file" data-f="file" accept="application/pdf,.pdf" />
      </label>
      <label style="font-size:13px;font-weight:600">Password (if encrypted)
        <input type="password" data-f="pw" placeholder="Optional" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px" />
      </label>
      <p class="muted" style="margin:0;font-size:12px">Extracts the PDF&apos;s embedded (selectable) text only — no OCR. Scanned pages with no text layer are skipped.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button data-f="go">Extract text</button>
        <button data-f="copy" disabled>Copy</button>
        <button data-f="dl" disabled>Download .txt</button>
      </div>
      <label style="font-size:13px;font-weight:600">Extracted text
        <textarea data-f="out" readonly placeholder="Extracted text appears here…" style="width:100%;min-height:220px;padding:8px;border:1px solid #e2e8f0;border-radius:8px;font:12px/1.5 monospace;white-space:pre-wrap"></textarea>
      </label>
      <div data-f="status" style="font-size:13px;color:#64748b"></div>
    </div>`;
  const q = (s) => el.querySelector(`[data-f="${s}"]`);
  const status = (m) => { q("status").textContent = m; };
  const TOOL_ID = (ctx && ctx.tool && ctx.tool.id) || "pdf-to-text";
  const trackedUrls = [];
  let pdfDoc = null;
  let lastName = "extracted.txt";

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
  function setActionsEnabled(on) {
    q("copy").disabled = !on;
    q("dl").disabled = !on;
  }
  function saveText(text, filename) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    if (typeof ctx.download === "function") return ctx.download(blob, filename, "text/plain");
    const url = URL.createObjectURL(blob);
    trackedUrls.push(url);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 5000);
  }

  async function loadPdfJs() {
    if (globalThis.pdfjsLib) return globalThis.pdfjsLib;
    for (const src of [
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
      "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js",
    ]) {
      try {
        await new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
        if (globalThis.pdfjsLib) {
          globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          return globalThis.pdfjsLib;
        }
      } catch {}
    }
    throw new Error("Could not load pdf.js");
  }
  function assertPdfHeader(bytes) {
    if (!bytes || bytes.length < 5 || bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46 || bytes[4] !== 0x2D) throw new Error("Not a PDF (missing %PDF header)");
  }
  async function openPdfWithPassword(pdfjsLib, data, getPassword) {
    assertPdfHeader(data);
    const pw = (getPassword && getPassword()) || "";
    try {
      const task = pdfjsLib.getDocument(pw ? { data: data.slice(), password: pw } : { data: data.slice() });
      return await task.promise;
    } catch (e) {
      if ((e && e.name === "PasswordNeededException") || /password|encrypted/i.test(String((e && e.message) || e))) {
        if (!pw) throw new Error("This PDF is encrypted — enter its password and try again.");
        try {
          return await pdfjsLib.getDocument({ data: data.slice(), password: pw }).promise;
        } catch (e2) {
          if (e2 && e2.name === "PasswordNeededException") throw new Error("Wrong password for this encrypted PDF.");
          throw new Error("Could not open encrypted PDF: " + ((e2 && e2.message) || e2));
        }
      }
      throw e;
    }
  }

  const onGo = async () => {
    try {
      const f = q("file").files[0];
      if (!f) { status("Pick a PDF."); return; }
      capsInfo(TOOL_ID);
      const chk = checkCaps([f], { toolId: TOOL_ID, accept: ".pdf,application/pdf", multiple: false });
      const file = (chk && chk.accepted && chk.accepted.length) ? chk.accepted[0] : f;
      if (chk && chk.accepted && !chk.accepted.length) return;
      setActionsEnabled(false);
      q("out").value = "";
      status("Loading pdf.js…");
      const pdfjsLib = await loadPdfJs();
      const data = new Uint8Array(await file.arrayBuffer());
      try { if (pdfDoc && typeof pdfDoc.destroy === "function") await pdfDoc.destroy(); } catch {}
      pdfDoc = null;
      // Pass `data` directly — openPdfWithPassword makes the single
      // working copy internally (avoids double-cloning the input).
      const pdf = await openPdfWithPassword(pdfjsLib, data, () => q("pw").value);
      pdfDoc = pdf;
      if (pdf.numPages > 500) throw new Error(`Page-count guard: PDF has ${pdf.numPages} pages (cap 500).`);
      const pages = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        status(`Extracting page ${n}/${pdf.numPages}…`);
        const page = await pdf.getPage(n);
        const tc = await page.getTextContent();
        const lines = [];
        let lastY = null;
        for (const it of (tc.items || [])) {
          const s = typeof it.str === "string" ? it.str : "";
          // Insert a line break when the item moves to a new text row.
          try {
            const y = it.transform && it.transform[5];
            if (lastY !== null && typeof y === "number" && Math.abs(y - lastY) > 1 && lines.length && !lines[lines.length - 1].endsWith("\n")) lines.push("\n");
            if (typeof y === "number") lastY = y;
          } catch {}
          lines.push(s);
          if (it.hasEOL) lines.push("\n");
        }
        pages.push(lines.join("").replace(/[ \t]+\n/g, "\n").trim());
        try { page.cleanup(); } catch {}
      }
      const text = pages.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
      try { q("pw").value = ""; } catch {}
      if (!text) {
        setActionsEnabled(false);
        status("No selectable text found — this looks like a scanned PDF (image-only pages). Text extraction only reads embedded text and does no OCR; try the on-device OCR tool for scanned pages.");
        return;
      }
      q("out").value = text;
      lastName = file.name.replace(/\.pdf$/i, "") + ".txt" || "extracted.txt";
      setActionsEnabled(true);
      status(`Done — extracted ${text.length.toLocaleString()} characters from ${pdf.numPages} page(s). Embedded text only, no OCR. (100% client-side)`);
    } catch (e) { status("Error: " + (e?.message || e)); }
    finally { try { q("pw").value = ""; } catch {} }
  };
  const onCopy = async () => {
    try {
      const text = q("out").value || "";
      if (!text) { status("Nothing to copy yet — extract text first."); return; }
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        q("out").select();
        const ok = document.execCommand("copy");
        try { window.getSelection()?.removeAllRanges(); } catch {}
        if (!ok) throw new Error("clipboard blocked by the browser");
      }
      status("Copied extracted text to clipboard.");
    } catch (e) { status("Error: " + (e?.message || e)); }
  };
  const onDl = () => {
    try {
      const text = q("out").value || "";
      if (!text) { status("Nothing to download yet — extract text first."); return; }
      saveText(text, lastName);
      status("Downloaded " + lastName + ".");
    } catch (e) { status("Error: " + (e?.message || e)); }
  };
  q("go").addEventListener("click", onGo);
  q("copy").addEventListener("click", onCopy);
  q("dl").addEventListener("click", onDl);
  return () => {
    try { trackedUrls.forEach((u) => URL.revokeObjectURL(u)); } catch {}
    try { if (pdfDoc && typeof pdfDoc.destroy === "function") pdfDoc.destroy(); } catch {}
    pdfDoc = null;
    try { q("pw").value = ""; } catch {}
    el.innerHTML = "";
  };
}
