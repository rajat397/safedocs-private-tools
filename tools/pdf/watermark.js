// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/watermark.js — text/image watermark, opacity, rotation, position, per-page or all pages. (P2 shell UI.)
import { shell } from '../_lib/page.js';

export async function mount(el, ctx = {}) {
  const tool = (ctx && ctx.tool) || { id: 'pdf-watermark', accept: '.pdf,application/pdf', multiple: false };
  const TOOL_ID = tool.id || 'pdf-watermark';
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
    <fieldset style="margin:8px 0;padding:8px;border:1px solid #e2e8f0;border-radius:8px">
      <legend style="font-size:13px;font-weight:600">Watermark type</legend>
      <label style="display:flex;gap:8px;align-items:center"><input type="radio" name="wtype" value="text" checked /> Text</label>
      <label style="display:flex;gap:8px;align-items:center"><input type="radio" name="wtype" value="image" /> Image</label>
    </fieldset>
    <div data-f="text-opts">
      <label style="display:grid;gap:4px;font-size:13px;font-weight:600">Text
        <input type="text" data-f="text" value="CONFIDENTIAL" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px" />
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
        <input type="color" data-f="color" value="#991a1a" style="height:32px;border:none;border-radius:8px" />
      </label>
    </div>
    <div data-f="image-opts" style="display:none">
      <label style="display:grid;gap:4px;font-size:13px;font-weight:600">Image file (PNG/JPG)
        <input type="file" data-f="img" accept="image/png,image/jpeg,image/webp" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px" />
      </label>
      <p class="muted" style="font-size:12px;margin:4px 0">PNG with transparency recommended. Max 5MB.</p>
    </div>
    <label style="display:grid;gap:4px;font-size:13px;font-weight:600">Opacity
      <input type="range" data-f="op" min="0.05" max="1" step="0.05" value="0.25" />
      <span data-f="op-val" style="font-size:12px;color:var(--muted)">0.25</span>
    </label>
    <label style="display:grid;gap:4px;font-size:13px;font-weight:600">Rotation (degrees)
      <input type="number" data-f="rot" value="45" step="15" min="-180" max="180"
        style="padding:8px;border:1px solid #e2e8f0;border-radius:8px" />
    </label>
    <label style="display:grid;gap:4px;font-size:13px;font-weight:600">Position
      <select data-f="pos" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px">
        <option value="diagonal">Diagonal (center)</option>
        <option value="center">Center</option>
        <option value="top-left">Top-left</option>
        <option value="top-right">Top-right</option>
        <option value="bottom-left">Bottom-left</option>
        <option value="bottom-right">Bottom-right</option>
      </select>
    </label>
    <label style="display:grid;gap:4px;font-size:13px;font-weight:600">Pages (blank = all, e.g. 1,3,5-7)
      <input type="text" data-f="pages" placeholder="All pages"
        style="padding:8px;border:1px solid #e2e8f0;border-radius:8px" />
    </label>
    <p class="muted" style="font-size:12px;margin:4px 0">100% on-device. Text watermarks use pdf-lib vector drawing; image watermarks are embedded and drawn on each target page.</p>`;

  const textOpts = q('text-opts');
  const imageOpts = q('image-opts');
  const wtypeRadios = page.root.querySelectorAll('input[name="wtype"]');
  wtypeRadios.forEach((r) => {
    r.addEventListener('change', () => {
      const isText = r.value === 'text';
      textOpts.style.display = isText ? 'block' : 'none';
      imageOpts.style.display = isText ? 'none' : 'block';
    });
  });

  const opSlider = q('op');
  const opVal = q('op-val');
  opSlider.addEventListener('input', () => { opVal.textContent = opSlider.value; });

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

  function getPositionCoords(pos, width, height, w, h, rotation) {
    const cx = width / 2;
    const cy = height / 2;
    const rad = (rotation * Math.PI) / 180;
    const cosR = Math.cos(rad);
    const sinR = Math.sin(rad);

    switch (pos) {
      case 'center':
        return { x: cx - (w / 2) * cosR, y: cy };
      case 'top-left':
        return { x: 0, y: height - h };
      case 'top-right':
        return { x: width - w, y: height - h };
      case 'bottom-left':
        return { x: 0, y: 0 };
      case 'bottom-right':
        return { x: width - w, y: 0 };
      case 'diagonal':
      default: {
        const tw = w * Math.abs(cosR) + h * Math.abs(sinR);
        return { x: cx - (tw / 2) * cosR, y: cy };
      }
    }
  }

  page.runBtn('Apply watermark & download', async (got, api) => {
    const file = revalidate(got);
    if (!file) { api.status('Pick a PDF first.'); return; }
    api.status('Loading pdf-lib…');
    const { PDFDocument, StandardFonts, rgb, degrees } = await loadPdfLib();
    const doc = await loadPdfWithPassword(PDFDocument, new Uint8Array(await file.arrayBuffer()), () => q('pw').value);
    const n = doc.getPageCount();
    if (n > MAX_PAGES) throw new Error(`Page-count guard: PDF has ${n} pages (cap ${MAX_PAGES}).`);

    const isText = page.root.querySelector('input[name="wtype"]:checked').value === 'text';
    const opacity = Math.min(1, Math.max(0.05, parseFloat(opSlider.value) || 0.25));
    const rotation = parseInt(q('rot').value, 10) || 0;
    const position = q('pos').value;
    const targets = parsePages(q('pages').value, n) ?? doc.getPageIndices();

    if (isText) {
      const text = q('text').value || 'CONFIDENTIAL';
      const fontName = q('font').value;
      const font = await doc.embedFont(StandardFonts[fontName]);
      const colorHex = q('color').value;
      const r = parseInt(colorHex.slice(1, 3), 16) / 255;
      const g = parseInt(colorHex.slice(3, 5), 16) / 255;
      const b = parseInt(colorHex.slice(5, 7), 16) / 255;

      for (const idx of targets) {
        const pg = doc.getPage(idx);
        const { width, height } = pg.getSize();
        const size = Math.min(width, height) / 8;
        const tw = font.widthOfTextAtSize(text, size);
        const coords = getPositionCoords(position, width, height, tw, size, rotation);
        pg.drawText(text, {
          x: coords.x, y: coords.y, size, font,
          color: rgb(r, g, b), opacity, rotate: degrees(rotation),
        });
      }
    } else {
      const imgFile = q('img').files?.[0];
      if (!imgFile) { api.status('Select an image file.'); return; }
      const imgBytes = new Uint8Array(await imgFile.arrayBuffer());
      let imgRef;
      if (imgFile.type === 'image/png') imgRef = await doc.embedPng(imgBytes);
      else imgRef = await doc.embedJpg(imgBytes);
      const { width: iw, height: ih } = imgRef.scale(1);
      const scale = 0.3;
      const dw = iw * scale;
      const dh = ih * scale;

      for (const idx of targets) {
        const pg = doc.getPage(idx);
        const { width, height } = pg.getSize();
        const coords = getPositionCoords(position, width, height, dw, dh, rotation);
        pg.drawImage(imgRef, { x: coords.x, y: coords.y, width: dw, height: dh, opacity, rotate: degrees(rotation) });
      }
    }

    const outBytes = await doc.save({ useObjectStreams: true });
    assertPdfHeader(outBytes);
    saveBytes(outBytes, file.name.replace(/\.pdf$/i, '') + '-watermarked.pdf', 'application/pdf');
    try { q('pw').value = ''; } catch {}
    api.status(`Done — ${isText ? 'text' : 'image'} watermark applied to ${targets.length} of ${n} page(s).`);
  });

  return () => page.cleanup();
}