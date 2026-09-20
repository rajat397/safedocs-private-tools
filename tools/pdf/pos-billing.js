// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/pos-billing.js — thermal POS bill generator (58/80mm). pdf-lib only, client-side, static.
import { shell } from '../_lib/page.js';
import { PINS } from '../../vendor/cdn-pins.js';

const PDF_LIB_PIN = PINS['pdf-lib']?.version || '1.17.1';
const PDF_LIB_ESM = PINS['pdf-lib']?.esm || [`https://esm.sh/pdf-lib@${PDF_LIB_PIN}`];
const PDF_LIB_UMD = PINS['pdf-lib']?.umd || [
  `https://cdn.jsdelivr.net/npm/pdf-lib@${PDF_LIB_PIN}/dist/pdf-lib.min.js`,
  `https://unpkg.com/pdf-lib@${PDF_LIB_PIN}/dist/pdf-lib.min.js`,
];

const MM_TO_PT = 72 / 25.4;
const WIDTHS = { '58': 58 * MM_TO_PT, '80': 80 * MM_TO_PT };
const GST_RATES = [0, 5, 12, 18, 28];
const FONT_SCALES = { S: -1, M: 0, L: 1.5 };

export async function mount(el, ctx = {}) {
  const tool = (ctx && ctx.tool) || {};
  const page = shell(el, tool, ctx);
  const status = page.status;
  const q = (s) => page.root.querySelector(`[data-f="${s}"]`);

  page.optionsEl.innerHTML = `
    <div style="display:grid;gap:10px">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <label>Paper width
        <select data-f="width">
          <option value="58">58mm (2.28")</option>
          <option value="80" selected>80mm (3.15")</option>
        </select>
      </label>
      <label>Font scale
        <select data-f="fscale">
          <option value="S">S — tiny (paper-save)</option>
          <option value="M" selected>M — standard</option>
          <option value="L">L — large</option>
        </select>
      </label>
    </div>
    <fieldset style="border:1px solid var(--line);border-radius:8px;padding:10px;display:grid;gap:8px">
      <legend style="font-weight:600;font-size:13px">Shop header</legend>
      <label>Shop name <input type="text" data-f="shop" value="Sharma General Store" maxlength="48" /></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <label>Phone <input type="text" data-f="phone" value="98765 43210" maxlength="24" /></label>
        <label>GSTIN <input type="text" data-f="gstin" value="" placeholder="Optional" maxlength="15" /></label>
      </div>
      <label>Address <input type="text" data-f="addr" value="12 Main Bazaar, New Delhi" maxlength="80" /></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <label>Bill no <input type="text" data-f="billno" value="B-0001" maxlength="20" /></label>
        <label>UPI ID (QR box) <input type="text" data-f="upi" value="shop@upi" maxlength="48" /></label>
      </div>
    </fieldset>
    <fieldset style="border:1px solid var(--line);border-radius:8px;padding:10px;display:grid;gap:8px">
      <legend style="font-weight:600;font-size:13px">Items (MRP − discount)</legend>
      <div data-f="items" style="display:grid;gap:6px"></div>
      <div class="btnrow" style="margin:0">
        <button type="button" class="secondary" data-f="add">+ Add item</button>
        <button type="button" class="secondary" data-f="reset">Reset demo</button>
      </div>
    </fieldset>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <label>GST mode
        <select data-f="gstmode">
          <option value="exclusive" selected>GST exclusive (add on top)</option>
          <option value="inclusive">GST inclusive (in price)</option>
        </select>
      </label>
      <label>GST rate %
        <select data-f="gstrate">
          ${GST_RATES.map((r) => `<option value="${r}"${r === 5 ? ' selected' : ''}>${r}%</option>`).join('')}
        </select>
      </label>
    </div>
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">
      <input type="checkbox" data-f="papersave" /> Paper-save mode (tight lines, no QR/barcode padding)
    </label>
    <label>Footer note
      <input type="text" data-f="footer" value="Thank you! Visit again." maxlength="80" />
    </label>
    </div>`;

  const itemsEl = q('items');
  const demoItems = () => ([
    { name: 'Atta 5kg', qty: 1, mrp: 275, disc: 5 },
    { name: 'Sugar 1kg', qty: 2, mrp: 45, disc: 0 },
    { name: 'Tea 250g', qty: 1, mrp: 140, disc: 10 },
  ]);

  function itemRow(it = { name: '', qty: 1, mrp: 0, disc: 0 }) {
    const row = document.createElement('div');
    row.dataset.row = 'item';
    row.style.cssText = 'display:grid;grid-template-columns:1fr 52px 64px 52px 28px;gap:4px;align-items:end';
    row.innerHTML = `
      <label style="font-size:11px">Item<input type="text" data-c="name" value="${escAttr(it.name)}" maxlength="40" /></label>
      <label style="font-size:11px">Qty<input type="number" data-c="qty" value="${it.qty}" min="0.01" max="9999" step="any" /></label>
      <label style="font-size:11px">MRP ₹<input type="number" data-c="mrp" value="${it.mrp}" min="0" max="9999999" step="any" /></label>
      <label style="font-size:11px">Off %<input type="number" data-c="disc" value="${it.disc}" min="0" max="100" step="any" /></label>
      <button type="button" class="secondary" data-c="del" title="Remove" style="padding:4px 0">×</button>`;
    row.querySelector('[data-c="del"]').addEventListener('click', () => {
      row.remove();
      if (!itemsEl.querySelector('[data-row="item"]')) addItem({ name: 'Item', qty: 1, mrp: 10, disc: 0 });
      refresh();
    });
    row.addEventListener('input', refresh);
    return row;
  }
  function addItem(it) { itemsEl.append(itemRow(it)); }
  function escAttr(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

  demoItems().forEach(addItem);
  q('add').addEventListener('click', () => { addItem({ name: '', qty: 1, mrp: 0, disc: 0 }); refresh(); });
  q('reset').addEventListener('click', () => { itemsEl.innerHTML = ''; demoItems().forEach(addItem); refresh(); });

  // Live totals + thermal preview (HTML mirror of the PDF layout).
  const preview = document.createElement('div');
  preview.dataset.f = 'preview';
  preview.style.cssText = 'border:1px dashed var(--line);border-radius:8px;padding:10px;font-size:13px;background:var(--card,#fff)';
  page.outputEl.append(preview);

  // Shell run guard needs >=1 file; this is a pure generator, so seed a
  // synthetic bill.json identity (same trick as text-to-pdf typed.txt).
  let syntheticFile = null;
  function ensureSeed() {
    try {
      if (!page.getFiles().length && !syntheticFile) {
        syntheticFile = new File(['{}'], 'bill.json', { type: 'application/json' });
        page.setFiles([syntheticFile]);
      }
    } catch {}
  }
  page.onFiles(() => { /* generator ignores uploads; keep seed */ });
  ['width', 'fscale', 'shop', 'phone', 'gstin', 'addr', 'billno', 'upi', 'gstmode', 'gstrate', 'papersave', 'footer']
    .forEach((f) => q(f)?.addEventListener('input', refresh));

  function readItems() {
    const rows = [...itemsEl.querySelectorAll('[data-row="item"]')];
    return rows.map((r) => {
      const v = (c) => r.querySelector(`[data-c="${c}"]`)?.value ?? '';
      return {
        name: String(v('name') || 'Item').slice(0, 40),
        qty: Math.max(0, Number(v('qty')) || 0),
        mrp: Math.max(0, Number(v('mrp')) || 0),
        disc: Math.min(100, Math.max(0, Number(v('disc')) || 0)),
      };
    }).filter((it) => it.qty > 0 && it.mrp >= 0).slice(0, 200);
  }

  function totals(items, gstRate, mode) {
    const mrpTotal = items.reduce((s, it) => s + it.qty * it.mrp, 0);
    const net = items.reduce((s, it) => s + it.qty * it.mrp * (1 - it.disc / 100), 0);
    const saved = mrpTotal - net;
    let base = net, gst = 0, grand = net;
    if (gstRate > 0) {
      if (mode === 'exclusive') { base = net; gst = net * gstRate / 100; grand = net + gst; }
      else { grand = net; base = net / (1 + gstRate / 100); gst = net - base; }
    }
    // Thermal printers hate paise dust: round grand to nearest rupee.
    const rounded = Math.round(grand);
    return { mrpTotal, net, saved, base, gst, grand, rounded, roundOff: rounded - grand };
  }

  const inr = (n) => 'Rs.' + (Number(n) || 0).toFixed(2);

  function refresh() {
    ensureSeed();
    const items = readItems();
    const t = totals(items, Number(q('gstrate')?.value || 0), q('gstmode')?.value || 'exclusive');
    const w = q('width')?.value || '80';
    preview.innerHTML = `
      <div style="text-align:center;font-weight:700">${escAttr(q('shop')?.value || 'Shop')}</div>
      <div style="text-align:center" class="muted">${escAttr(q('addr')?.value || '')}${q('phone')?.value ? ' · ' + escAttr(q('phone').value) : ''}</div>
      <hr /><div style="font-family:monospace;font-size:12px">
      ${items.map((it) => `<div>${escAttr(it.name)} × ${it.qty} @ ${inr(it.mrp)}${it.disc ? ` −${it.disc}%` : ''} = <b>${inr(it.qty * it.mrp * (1 - it.disc / 100))}</b></div>`).join('') || '<div class="muted">No items.</div>'}
      </div><hr />
      <div style="display:grid;gap:2px;font-size:13px">
        <div>MRP total: ${inr(t.mrpTotal)} · Saved: ${inr(t.saved)}</div>
        <div>GST (${q('gstrate')?.value || 0}%, ${q('gstmode')?.value}): ${inr(t.gst)}</div>
        <div style="font-size:16px;font-weight:800">Total: ${inr(t.rounded)}</div>
      </div>
      <div class="muted" style="font-size:12px;margin-top:4px">${w}mm · ${(itemsEl.querySelectorAll('[data-row="item"]') || []).length} rows · QR + Code128-text barcode print on PDF</div>`;
    if (!items.length) status('Add at least one item with qty > 0.');
    else status(`${items.length} item(s) · ${w}mm · Total ${inr(t.rounded)} — hit Download.`);
  }

  function saveBytes(bytes, filename, mime = 'application/pdf') { return ctx.download(bytes, filename, mime); }
  async function loadPdfLib() {
    if (globalThis.PDFLib) return globalThis.PDFLib;
    try {
      const m = await import(/* @vite-ignore */PDF_LIB_ESM[0]);
      const lib = m.default ?? m;
      if (lib?.PDFDocument) { globalThis.PDFLib = lib; return lib; }
    } catch {}
    for (const src of PDF_LIB_UMD) {
      try {
        await new Promise((res, rej) => {
          const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
        if (globalThis.PDFLib) return globalThis.PDFLib;
      } catch {}
    }
    throw new Error(`Could not load pdf-lib@${PDF_LIB_PIN} (check network).`);
  }

  // WinAnsi-safe: pdf-lib standard fonts can't shape astral/code-mapped glyphs.
  const safe = (s) => String(s ?? '').replace(/[\u{10000}-\u{10FFFF}]/gu, '?').replace(/[₹]/g, 'Rs.');
  const asciiBar = (s, n) => s.repeat(Math.max(1, Math.round(n)));

  page.runBtn('Download bill PDF', async () => {
    try {
      const items = readItems();
      if (!items.length) { status('Add at least one item with qty > 0.'); return; }
      if (items.length > 200) throw new Error('Item cap: 200 rows per bill (paper-save).');
      const widthKey = q('width')?.value || '80';
      const pageW = WIDTHS[widthKey] || WIDTHS['80'];
      const paperSave = !!q('papersave')?.checked;
      const fscale = FONT_SCALES[q('fscale')?.value] ?? 0;
      const gstRate = Number(q('gstrate')?.value || 0);
      const gstMode = q('gstmode')?.value || 'exclusive';
      const t = totals(items, gstRate, gstMode);

      status('Loading pdf-lib…');
      const { PDFDocument, StandardFonts, rgb } = await loadPdfLib();
      const doc = await PDFDocument.create();
      const helv = await doc.embedFont(StandardFonts.Helvetica);
      const helvB = await doc.embedFont(StandardFonts.HelveticaBold);
      const mono = await doc.embedFont(StandardFonts.Courier);
      const monoB = await doc.embedFont(StandardFonts.CourierBold);

      // Thermal-optimized type: narrow column → small base size; paper-save
      // tightens margins + line-height and skips QR/barcode padding.
      const base = Math.max(6, 8 + fscale - (paperSave ? 1 : 0));
      const lh = base * (paperSave ? 1.18 : 1.38);
      const margin = paperSave ? 6 : 10;
      const maxW = pageW - margin * 2;
      const ink = rgb(0, 0, 0);

      const wrap = (text, font, size) => {
        const words = safe(text).split(/\s+/).filter(Boolean);
        const out = []; let cur = '';
        const w = (s) => font.widthOfTextAtSize(s, size);
        for (const wd of words) {
          const cand = cur ? cur + ' ' + wd : wd;
          if (w(cand) <= maxW) { cur = cand; continue; }
          if (cur) out.push(cur);
          // Break overlong tokens char-by-char (GSTIN/UPI have no spaces).
          if (w(wd) > maxW) {
            let chunk = '';
            for (const ch of wd) {
              if (w(chunk + ch) <= maxW || !chunk) chunk += ch;
              else { out.push(chunk); chunk = ch; }
            }
            cur = chunk;
          } else cur = wd;
        }
        if (cur) out.push(cur);
        return out.length ? out : [''];
      };

      // Build logical lines first so page height is exact (one receipt).
      // Each entry: { text, font, size, align, gapAfter }
      const L = [];
      const shop = safe(q('shop')?.value || 'Shop').slice(0, 48) || 'Shop';
      L.push({ text: shop.toUpperCase(), font: helvB, size: base + 3, align: 'c' });
      const addr = safe(q('addr')?.value || '');
      if (addr) wrap(addr, helv, base - 0.5).forEach((x) => L.push({ text: x, font: helv, size: base - 0.5, align: 'c' }));
      const contact = [safe(q('phone')?.value || ''), safe(q('gstin')?.value || '') && ('GSTIN: ' + safe(q('gstin').value))].filter(Boolean).join('  ');
      if (contact) wrap(contact, helv, base - 0.5).forEach((x) => L.push({ text: x, font: helv, size: base - 0.5, align: 'c' }));
      const dashLen = Math.max(10, Math.floor(maxW / (mono.widthOfTextAtSize('-', base - 1) || 3)));
      const dash = asciiBar('-', Math.min(dashLen, widthKey === '58' ? 32 : 42));
      L.push({ text: dash, font: mono, size: base - 1, align: 'c' });
      const dt = new Date();
      const dtStr = dt.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      L.push({ text: `Bill: ${safe(q('billno')?.value || 'B-0001')}  ${safe(dtStr)}`, font: mono, size: base - 1, align: 'c' });
      L.push({ text: dash, font: mono, size: base - 1, align: 'c' });
      // Item lines: name on its own wrapped line(s), then qty×rate row.
      // Two-line layout survives 58mm without micro-fonts.
      const itemRows = [];
      items.forEach((it, i) => {
        const rate = it.mrp * (1 - it.disc / 100);
        const amt = it.qty * rate;
        wrap(`${i + 1}. ${safe(it.name)}`, helvB, base).forEach((x) => itemRows.push({ text: x, font: helvB, size: base, align: 'l' }));
        const left = `${it.qty} x ${inr(it.mrp)}${it.disc ? ` -${it.disc}%` : ''}`;
        const right = inr(amt);
        // Pad with dots to fill thermal width (cheap column alignment).
        const lw = mono.widthOfTextAtSize(left + '  ' + right, base);
        let dots = '';
        if (lw < maxW) {
          const dotW = mono.widthOfTextAtSize('.', base) || 2;
          dots = asciiBar('.', Math.min(40, Math.floor((maxW - lw) / dotW)));
        }
        itemRows.push({ text: `${left} ${dots} ${right}`, font: mono, size: base, align: 'l' });
      });
      L.push(...itemRows);
      L.push({ text: dash, font: mono, size: base - 1, align: 'c' });
      const row2 = (k, v) => {
        const right = v;
        const lw = mono.widthOfTextAtSize(k + '  ' + right, base);
        let dots = '';
        if (lw < maxW) {
          const dotW = mono.widthOfTextAtSize('.', base) || 2;
          dots = asciiBar('.', Math.min(40, Math.floor((maxW - lw) / dotW)));
        }
        return { text: `${k} ${dots} ${right}`, font: mono, size: base, align: 'l' };
      };
      L.push(row2('MRP total', inr(t.mrpTotal)));
      if (t.saved > 0.004) L.push(row2('You save', inr(t.saved)));
      if (gstRate > 0) {
        L.push(row2(`GST ${gstRate}% (${gstMode === 'inclusive' ? 'incl' : 'excl'})`, inr(t.gst)));
        if (gstMode === 'inclusive') L.push(row2('Taxable base', inr(t.base)));
      }
      if (Math.abs(t.roundOff) > 0.004) L.push(row2('Round-off', `${t.roundOff >= 0 ? '+' : '-'}Rs.${Math.abs(t.roundOff).toFixed(2)}`));
      L.push({ text: `TOTAL: ${inr(t.rounded)}`, font: monoB, size: base + 3, align: 'c', gapAfter: 2 });
      L.push({ text: dash, font: mono, size: base - 1, align: 'c' });

      const upi = safe(q('upi')?.value || '').slice(0, 48);
      const footer = safe(q('footer')?.value || 'Thank you! Visit again.');
      // Fixed-height graphic blocks (drawn after text).
      const qrH = (!paperSave && upi) ? 64 : 0;
      const barH = paperSave ? 30 : 44;
      const footerLines = footer ? wrap(footer, helvB, base) : [];

      let h = margin * 2 + 6;
      for (const ln of L) h += (ln.size * 1.18) + (ln.gapAfter || 0);
      h += qrH + barH + footerLines.length * (base * 1.18) + 10;
      if (h > 3000) throw new Error('Bill too long — split into fewer items (height guard).');

      const pg = doc.addPage([pageW, h]);
      let y = h - margin;
      const draw = (ln) => {
        y -= ln.size * 1.18;
        const wpx = ln.font.widthOfTextAtSize(ln.text, ln.size);
        const x = ln.align === 'c' ? margin + Math.max(0, (maxW - wpx) / 2) : margin;
        pg.drawText(ln.text, { x, y, size: ln.size, font: ln.font, color: ink });
        y -= (ln.gapAfter || 0);
      };
      L.forEach(draw);

      // UPI QR placeholder: bordered box with label + ID (no QR lib; static-only).
      if (qrH) {
        y -= 4;
        const bw = Math.min(maxW, 120);
        const bx = margin + (maxW - bw) / 2;
        pg.drawRectangle({ x: bx, y: y - qrH, width: bw, height: qrH, borderColor: ink, borderWidth: 1 });
        const t1 = 'UPI QR — scan to pay';
        pg.drawText(safe(t1), { x: bx + (bw - helv.widthOfTextAtSize(safe(t1), base - 1)) / 2, y: y - 14, size: base - 1, font: helv, color: ink });
        const t2 = safe(upi);
        const fs2 = t2.length > 22 ? base - 1.5 : base;
        pg.drawText(t2, { x: bx + (bw - mono.widthOfTextAtSize(t2, fs2)) / 2, y: y - 28, size: fs2, font: monoB, color: ink });
        pg.drawText(safe(`Pay ${inr(t.rounded)}`), { x: bx + (bw - helvB.widthOfTextAtSize(safe(`Pay ${inr(t.rounded)}`), base)) / 2, y: y - 42, size: base, font: helvB, color: ink });
        // Corner finder marks (QR affordance without a QR encoder).
        for (const [cx, cy] of [[bx + 4, y - 8], [bx + bw - 10, y - 8], [bx + 4, y - qrH + 4]]) {
          pg.drawRectangle({ x: cx, y: cy - 6, width: 6, height: 6, borderColor: ink, borderWidth: 1 });
        }
        y -= qrH + 4;
      }

      // Barcode (Code128-style via text): bar widths derived from bill-no char
      // codes + human-readable text below. Real scanners need a Code128 font/
      // encoder; this is a visual placeholder that stays thermal-readable.
      {
        const code = safe(q('billno')?.value || 'B-0001').slice(0, 20) || 'B-0001';
        y -= 4;
        const bw = maxW;
        let bx = margin;
        // Quiet zones.
        bx += 4;
        let avail = bw - 8;
        // Deterministic pseudo-Code128 widths from char codes (1–4 units).
        const units = [...code].flatMap((ch) => {
          const c = ch.charCodeAt(0);
          return [1 + (c % 3), 1 + ((c >> 2) % 2), 1 + ((c >> 4) % 3)];
        });
        const totalU = units.reduce((a, b) => a + b, 0) + units.length; // + gaps
        const u = avail / totalU;
        const barTop = y;
        const barBot = y - (barH - 14);
        let cx = bx;
        let dark = true;
        for (const wu of units) {
          if (dark) pg.drawRectangle({ x: cx, y: barBot, width: wu * u, height: barTop - barBot, color: ink });
          cx += wu * u + u * 0.5; // inter-char gap
          dark = !dark;
        }
        const label = `* ${code} *`;
        pg.drawText(label, { x: margin + (maxW - mono.widthOfTextAtSize(label, base - 0.5)) / 2, y: barBot - 10, size: base - 0.5, font: mono, color: ink });
        y = barBot - 14;
      }

      footerLines.forEach((x) => {
        y -= base * 1.18;
        pg.drawText(x, { x: margin + (maxW - helvB.widthOfTextAtSize(x, base)) / 2, y, size: base, font: helvB, color: ink });
      });
      y -= 6;
      pg.drawText(safe('Powered on-device · no upload'), { x: margin + (maxW - helv.widthOfTextAtSize('Powered on-device · no upload', base - 2)) / 2, y, size: base - 2, font: helv, color: ink });

      const bytes = await doc.save({ useObjectStreams: true });
      const stamp = (q('billno')?.value || 'bill').replace(/[^A-Za-z0-9-_]+/g, '-').slice(0, 24) || 'bill';
      saveBytes(bytes, `pos-${widthKey}mm-${stamp}.pdf`, 'application/pdf');
      status(`Done — ${widthKey}mm × ${Math.round((h / 72) * 25.4)}mm receipt, ${items.length} item(s), Total ${inr(t.rounded)}.`);
    } catch (e) { status('Error: ' + (e?.message || e)); }
  });

  refresh();
  return () => { try { page.cleanup(); } catch {} };
}
