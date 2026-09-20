// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/page-numbers.js — page numbers with format, position, start number, prefix/suffix. (P2 shell UI.)
import { shell } from '../_lib/page.js';

export async function mount(el, ctx = {}) {
  const tool = (ctx && ctx.tool) || { id: 'pdf-page-numbers', accept: '.pdf,application/pdf', multiple: false };
  const TOOL_ID = tool.id || 'pdf-page-numbers';
  const ACCEPT = tool.accept || '.pdf,application/pdf';
  const MAX_PAGES = 500;
  const page = shell(el, tool, ctx);
  const status = page.status;
  const q = (s) => page.root.querySelector(`[data-f="${s}"]`);

  page.optionsEl.innerHTML = `
    <label style="display:grid;gap:4px;font-size:13px;font-weight:600">Password (if encrypted)
      <input type="password" data-f="pw" placeholder="Optional" autocomplete="off"
        style="padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-weight:400" />
    </label>
    <label style="display:grid;gap:4px;font-size:13px;font-weight:600">Format
      <input type="text" data-f="fmt" value="{p} / {n}" placeholder="{p} / {n}"
        style="padding:8px;border:1px solid #e2e8f0;border-radius:8px" />
      <span class="muted" style="font-size:11px">Tokens: {p}=page, {n}=total, {P}=zero-padded page (3 digits), {N}=zero-padded total</span>
    </label>
    <label style="display:grid;gap:4px;font-size:13px;font-weight:600">Prefix
      <input type="text" data-f="prefix" placeholder="(none)" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px" />
    </label>
    <label style="display:grid;gap:4px;font-size:13px;font-weight:600">Suffix
      <input type="text" data-f="suffix" placeholder="(none)" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px" />
    </label>
    <label style="display:grid;gap:4px;font-size:13px;font-weight:600">Start number
      <input type="number" data-f="start" value="1" min="1" max="9999"
        style="padding:8px;border:1px solid #e2e8f0;border-radius:8px" />
    </label>
    <label style="display:grid;gap:4px;font-size:13px;font-weight:600">Font size
      <input type="number" data-f="size" value="10" min="6" max="24"
        style="padding:8px;border:1px solid #e2e8f0;border-radius:8px" />
    </label>
    <label style="display:grid;gap:4px;font-size:13px;font-weight:600">Font
      <select data-f="font" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px">
        <option value="Helvetica">Helvetica</option>
        <option value="HelveticaBold">Helvetica Bold</option>
        <option value="TimesRoman">Times Roman</option>
        <option value="TimesRomanBold">Times Bold</option>
        <option value="Courier">Courier</option>
        <option value="CourierBold">Courier Bold</option>
      </select>
    </label>
    <label style="display:grid;gap:4px;font-size:13px;font-weight:600">Color
      <input type="color" data-f="color" value="#404040" style="height:32px;border:none;border-radius:8px" />
    </label>
    <label style="display:grid;gap:4px;font-size:13px;font-weight:600">Position
      <select data-f="pos" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px">
        <option value="bottom-center">Bottom center</option>
        <option value="bottom-right">Bottom right</option>
        <option value="bottom-left">Bottom left</option>
        <option value="top-center">Top center</option>
        <option value="top-right">Top right</option>
        <option value="top-left">Top left</option>
      </select>
    </label>
    <label style="display:grid;gap:4px;font-size:13px;font-weight:600">Margin from edge (pt)
      <input type="number" data-f="margin" value="24" min="6" max="100"
        style="padding:8px;border:1px solid #e2e8f0;border-radius:8px" />
    </label>
    <label style="display:grid;gap:4px;font-size:13px;font-weight:600">Pages (blank = all, e.g. 1,3,5-7)
      <input type="text" data-f="pages" placeholder="All pages"
        style="padding:8px;border:1px solid #e2e8f0;border-radius:8px" />
    </label>
    <p class="muted" style="font-size:12px;margin:4px 0">100% on-device. Uses pdf-lib vector text — numbers remain selectable/searchable.</p>`;

  let files = [];
  page.onFiles((accepted) => { files = [...accepted]; });

  function revalidate(list) {
    try {
      if (typeof ctx.checkFiles === 'function') {
        const r = ctx.checkFiles(list, { toolId: TOOL_ID, accept: ACCEPT, multiple: false });
        if (r && r.rejected && r.rejected.length) {
          status('Rejected: ' + r.rejected.map((x) => `${x.file?.name || 'file'}: ${x.reason}`).join(' | '));
        }
        if (r && r.accepted && r.accepted.length) return r.accepted[0];
        return null;
      }
    } catch { /* fall through */ }
    return list[0] || null;
  }

  function saveBytes(bytes, filename, mime = 'application/pdf') {
    if (typeof ctx.download === 'function') return ctx.download(bytes, filename, mime);
    return page.addDownload(bytes, filename, `Download ${filename}`);
  }

  function parsePages(str, n) {
    str = (str || '').trim();
    if (!str) return null;
    const out = [];
    for (const part of str.split(',')) {
      const t = part.trim();
      if (!t) continue;
      const m = t.match(/^(\d+)\s*-\s*(\d+)$/);
      if (m) {
        const lo = Math.min(+m[1], +m[2]); const hi = Math.max(+m[1], +m[2]);
        for (let p = lo; p <= hi; p++) {
          if (p < 1 || p > n) throw new Error(`Page ${p} out of range (1–${n}).`);
          if (!out.includes(p - 1)) out.push(p - 1);
        }
      } else if (/^\d+$/.test(t)) {
        const p = +t;
        if (p < 1 || p > n) throw new Error(`Page ${p} out of range (1–${n}).`);
        if (!out.includes(p - 1)) out.push(p - 1);
      } else {
        throw new Error(`Bad token "${t}" (use e.g. 1,3,5-7).`);
      }
    }
    if (!out.length) throw new Error('No valid pages in selection.');
    out.sort((a, b) => a - b);
    return out;
  }

  async function loadPdfLib() {
    if (globalThis.PDFLib) return globalThis.PDFLib;
    try {
      const m = await import('https://esm.sh/pdf-lib@1.17.1');
      const lib = m.default ?? m;
      if (lib?.PDFDocument) { globalThis.PDFLib = lib; return lib; }
    } catch { /* fall through */ }
    for (const src of [
      'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
      'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
    ]) {
      try {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = src; s.async = true; s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
        if (globalThis.PDFLib) return globalThis.PDFLib;
      } catch { /* try next */ }
    }
    throw new Error('Could not load pdf-lib@1.17.1 (check network).');
  }

  function assertPdfHeader(bytes) {
    if (!bytes || bytes.length < 5 || bytes[0] !== 0x25 || bytes[1] !== 0x50
      || bytes[2] !== 0x44 || bytes[3] !== 0x46 || bytes[4] !== 0x2D) {
      throw new Error('Not a PDF (missing %PDF header).');
    }
  }

  async function loadPdfWithPassword(PDFDocument, bytes, getPassword) {
    assertPdfHeader(bytes);
    const pw = (getPassword && getPassword()) || '';
    try {
      return await PDFDocument.load(bytes, pw ? { password: pw } : {});
    } catch (e) {
      const msg = String((e && e.message) || e);
      if ((e && e.name === 'PasswordNeededException') || /password|encrypted|PasswordNeeded/i.test(msg)) {
        throw new Error(pw ? 'Encrypted PDF needs the correct password: ' + msg : 'This PDF is encrypted — enter its password and try again.');
      }
      throw e;
    }
  }

  function formatLabel(fmt, pageNum, totalPages, startNum) {
    const p = pageNum - startNum + 1;
    const P = String(p).padStart(3, '0');
    const N = String(totalPages).padStart(3, '0');
    return fmt
      .replaceAll('{p}', String(p))
      .replaceAll('{P}', P)
      .replaceAll('{n}', String(totalPages))
      .replaceAll('{N}', N);
  }

  function getPosition(pos, width, textWidth, textHeight, margin) {
    switch (pos) {
      case 'bottom-center':
        return { x: width / 2 - textWidth / 2, y: margin };
      case 'bottom-right':
        return { x: width - margin - textWidth, y: margin };
      case 'bottom-left':
        return { x: margin, y: margin };
      case 'top-center':
        return { x: width / 2 - textWidth / 2, y: height - margin - textHeight };
      case 'top-right':
        return { x: width - margin - textWidth, y: height - margin - textHeight };
      case 'top-left':
        return { x: margin, y: height - margin - textHeight };
      default:
        return { x: width / 2 - textWidth / 2, y: margin };
    }
  }

  page.runBtn('Add page numbers & download', async (got, api) => {
    const file = revalidate(got);
    if (!file) { api.status('Pick a PDF first.'); return; }
    api.status('Loading pdf-lib…');
    const { PDFDocument, StandardFonts, rgb } = await loadPdfLib();
    const doc = await loadPdfWithPassword(PDFDocument, new Uint8Array(await file.arrayBuffer()), () => q('pw').value);
    const n = doc.getPageCount();
    if (n > MAX_PAGES) throw new Error(`Page-count guard: PDF has ${n} pages (cap ${MAX_PAGES}).`);

    const fmt = q('fmt').value || '{p} / {n}';
    const prefix = q('prefix').value || '';
    const suffix = q('suffix').value || '';
    const startNum = Math.max(1, parseInt(q('start').value, 10) || 1);
    const fontSize = Math.min(24, Math.max(6, parseInt(q('size').value, 10) || 10));
    const fontName = q('font').value;
    const font = await doc.embedFont(StandardFonts[fontName]);
    const colorHex = q('color').value;
    const r = parseInt(colorHex.slice(1, 3), 16) / 255;
    const g = parseInt(colorHex.slice(3, 5), 16) / 255;
    const b = parseInt(colorHex.slice(5, 7), 16) / 255;
    const position = q('pos').value;
    const margin = Math.max(6, parseInt(q('margin').value, 10) || 24);
    const targets = parsePages(q('pages').value, n) ?? doc.getPageIndices();

    for (const idx of targets) {
      const pg = doc.getPage(idx);
      const { width, height } = pg.getSize();
      const label = prefix + formatLabel(fmt, idx + 1, n, startNum) + suffix;
      const tw = font.widthOfTextAtSize(label, fontSize);
      const th = fontSize;
      const coords = getPosition(position, width, tw, th, margin);
      pg.drawText(label, { x: coords.x, y: coords.y, size: fontSize, font, color: rgb(r, g, b) });
    }

    const outBytes = await doc.save({ useObjectStreams: true });
    assertPdfHeader(outBytes);
    saveBytes(outBytes, file.name.replace(/\.pdf$/i, '') + '-numbered.pdf', 'application/pdf');
    try { q('pw').value = ''; } catch {}
    api.status(`Done — page numbers added to ${targets.length} of ${n} page(s).`);
  });

  return () => page.cleanup();
}