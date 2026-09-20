// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/flatten-annots.js — flatten annotations + form fields into page content (vector, non-interactive). pdf-lib only.
import { shell } from '../_lib/page.js';

export async function mount(el, ctx = {}) {
  const tool = (ctx && ctx.tool) || { id: 'pdf-flatten-annots', accept: '.pdf,application/pdf', multiple: false };
  const TOOL_ID = tool.id || 'pdf-flatten-annots';
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
      <legend style="font-size:13px;font-weight:600">Flatten options</legend>
      <label style="display:flex;gap:8px;align-items:center">
        <input type="checkbox" data-f="flat-annots" checked /> Flatten annotations (comments, highlights, stamps, links)
      </label>
      <label style="display:flex;gap:8px;align-items:center">
        <input type="checkbox" data-f="flat-forms" checked /> Flatten form fields (widgets → static text/appearance)
      </label>
      <label style="display:flex;gap:8px;align-items:center">
        <input type="checkbox" data-f="flat-links" /> Flatten link annotations (convert to plain text)
      </label>
    </fieldset>
    <label style="display:grid;gap:4px;font-size:13px;font-weight:600">Pages (blank = all, e.g. 1,3,5-7)
      <input type="text" data-f="pages" placeholder="All pages"
        style="padding:8px;border:1px solid #e2e8f0;border-radius:8px" />
    </label>
    <p class="muted" style="font-size:12px;margin:4px 0">
      100% on-device, pdf-lib only (no rasterization). Annotations and form fields are converted to
      vector page content — text stays selectable where possible. Links become plain text unless "Flatten link annotations" is checked.
      Not a redaction tool: already-flattened content is unaffected.
    </p>`;

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

  function rgbFromHex(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return { r, g, b };
  }

  async function drawAnnotationAppearance(pg, annot, doc, font, { r, g, b }) {
    const subtype = annot.get('Subtype')?.name;
    const rect = annot.get('Rect');
    if (!rect || !rect.size) return;

    const [x1, y1, x2, y2] = rect.map((n) => Number(n));
    const width = x2 - x1;
    const height = y2 - y1;
    if (width <= 0 || height <= 0) return;

    const contents = annot.get('Contents')?.decode() || '';
    const fontSize = Math.min(12, Math.max(8, height * 0.4));

    switch (subtype) {
      case 'FreeText': {
        const da = annot.get('DA')?.decode() || '';
        let color = { r, g, b };
        const rgMatch = da.match(/([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+rg/);
        if (rgMatch) color = { r: +rgMatch[1], g: +rgMatch[2], b: +rgMatch[3] };
        pg.drawText(contents, { x: x1 + 2, y: y1 + 2, size: fontSize, font, color: rgbFromHex(`#${Math.round(color.r*255).toString(16).padStart(2,'0')}${Math.round(color.g*255).toString(16).padStart(2,'0')}${Math.round(color.b*255).toString(16).padStart(2,'0')}`) });
        break;
      }
      case 'Text':
      case 'FreeText':
      case 'Stamp': {
        pg.drawText(contents || '[Annotation]', { x: x1 + 2, y: y1 + 2, size: fontSize, font, color: rgb(r, g, b) });
        break;
      }
      case 'Highlight':
      case 'Underline':
      case 'Squiggly':
      case 'StrikeOut': {
        pg.drawRectangle({ x: x1, y: y1, width, height, borderColor: rgb(r, g, b), borderWidth: 1, opacity: 0.3 });
        break;
      }
      case 'Square':
      case 'Circle': {
        pg.drawRectangle({ x: x1, y: y1, width, height, borderColor: rgb(r, g, b), borderWidth: 2 });
        break;
      }
      case 'Line': {
        const l = annot.get('L');
        if (l && l.size === 4) {
          pg.drawLine({
            start: { x: Number(l.get(0)), y: Number(l.get(1)) },
            end: { x: Number(l.get(2)), y: Number(l.get(3)) },
            color: rgb(r, g, b), thickness: 2,
          });
        }
        break;
      }
      case 'Link': {
        const uri = annot.get('A')?.get('URI')?.decode();
        if (uri) {
          pg.drawText(`Link: ${uri}`, { x: x1, y: y1, size: fontSize, font, color: rgb(0, 0, 1) });
        }
        break;
      }
      default: {
        if (contents) pg.drawText(contents, { x: x1 + 2, y: y1 + 2, size: fontSize, font, color: rgb(r, g, b) });
      }
    }
  }

  async function flattenFormFields(pg, doc, font, color) {
    const acroForm = doc.catalog.get('AcroForm');
    if (!acroForm) return 0;
    const fields = acroForm.get('Fields');
    if (!fields || !fields.size) return 0;

    let count = 0;
    for (const fieldRef of fields) {
      try {
        const field = doc.context.lookup(fieldRef);
        if (!field) continue;
        const ft = field.get('FT')?.name;
        const rect = field.get('Rect');
        if (!rect || !rect.size) continue;
        const [x1, y1, x2, y2] = rect.map((n) => Number(n));
        const width = x2 - x1;
        const height = y2 - y1;
        if (width <= 0 || height <= 0) continue;

        const value = field.get('V')?.decode?.() || field.get('V')?.toString?.() || '';
        const fontSize = Math.min(12, Math.max(8, height * 0.6));

        let display = '';
        if (ft === 'Btn') {
          const kids = field.get('Kids');
          if (kids) {
            for (const kidRef of kids) {
              const kid = doc.context.lookup(kidRef);
              if (kid?.get('AS')?.name === 'Yes' || kid?.get('V')?.name === 'Yes') {
                display = '☑';
                break;
              }
            }
            if (!display) display = '☐';
          } else {
            display = field.get('AS')?.name === 'Yes' || field.get('V')?.name === 'Yes' ? '☑' : '☐';
          }
        } else if (ft === 'Ch') {
          const opts = field.get('Opt');
          if (opts && opts.size) {
            const idx = field.get('V')?.decode?.() ? opts.findIndex((o) => o.decode?.() === field.get('V').decode()) : -1;
            display = idx >= 0 ? opts.get(idx)?.decode?.() || '' : '';
          }
        } else {
          display = value;
        }

        if (display) {
          pg.drawText(display, { x: x1 + 2, y: y1 + 2, size: fontSize, font, color });
          count++;
        }
        try { field.delete('V'); } catch {}
      } catch { /* skip field */ }
    }
    return count;
  }

  page.runBtn('Flatten annotations & forms & download', async (got, api) => {
    const file = revalidate(got);
    if (!file) { api.status('Pick a PDF first.'); return; }
    api.status('Loading pdf-lib…');
    const { PDFDocument, PDFName, StandardFonts, rgb } = await loadPdfLib();
    const doc = await loadPdfWithPassword(PDFDocument, new Uint8Array(await file.arrayBuffer()), () => q('pw').value);
    const n = doc.getPageCount();
    if (n > MAX_PAGES) throw new Error(`Page-count guard: PDF has ${n} pages (cap ${MAX_PAGES}).`);

    const flatAnnots = q('flat-annots').checked;
    const flatForms = q('flat-forms').checked;
    const flatLinks = q('flat-links').checked;
    const targets = parsePages(q('pages').value, n) ?? doc.getPageIndices();

    const font = await doc.embedFont(StandardFonts.Helvetica);
    const color = rgb(0.25, 0.25, 0.25);
    const annotColor = rgb(0.6, 0.1, 0.1);

    let annotCount = 0;
    let formCount = 0;
    let linkCount = 0;

    for (const idx of targets) {
      const pg = doc.getPage(idx);

      if (flatAnnots) {
        const annotsKey = PDFName.of('Annots');
        let annots = null;
        try { annots = pg.node.get(annotsKey); } catch {}
        if (annots) {
          const resolved = doc.context.lookup(annots);
          if (resolved && resolved.size) {
            for (const annotRef of resolved) {
              try {
                const annot = doc.context.lookup(annotRef);
                if (!annot) continue;
                const subtype = annot.get('Subtype')?.name;
                if (subtype === 'Link' && !flatLinks) continue;
                await drawAnnotationAppearance(pg, annot, doc, font, { r: 0.6, g: 0.1, b: 0.1 });
                annotCount++;
              } catch { /* skip */ }
            }
          }
          try { pg.node.delete(annotsKey); } catch {}
        }
      }

      if (flatForms) {
        formCount += await flattenFormFields(pg, doc, font, color);
      }
    }

    if (flatForms) {
      try {
        const acroForm = doc.catalog.get('AcroForm');
        if (acroForm) {
          acroForm.delete('Fields');
          acroForm.delete('NeedAppearances');
          doc.catalog.delete(PDFName.of('AcroForm'));
        }
      } catch { /* ignore */ }
    }

    const outBytes = await doc.save({ useObjectStreams: true });
    assertPdfHeader(outBytes);
    saveBytes(outBytes, file.name.replace(/\.pdf$/i, '') + '-flattened-annots.pdf', 'application/pdf');
    try { q('pw').value = ''; } catch {}

    const parts = [];
    if (annotCount) parts.push(`${annotCount} annotation(s)`);
    if (linkCount) parts.push(`${linkCount} link(s)`);
    if (formCount) parts.push(`${formCount} form field(s)`);
    const detail = parts.length ? ` — flattened ${parts.join(', ')}` : ' — nothing to flatten';
    api.status(`Done — processed ${targets.length} of ${n} page(s).${detail}. Result is non-interactive.`);
  });

  return () => page.cleanup();
}