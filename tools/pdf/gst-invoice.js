// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/gst-invoice.js — India GST Tax Invoice generator (seller/buyer GSTIN,
// HSN/SAC, CGST+SGST vs IGST auto, amount-in-words, logo + signature). pdf-lib only.
import { shell } from '../_lib/page.js';
import { PINS } from '../../vendor/cdn-pins.js';

const PDF_LIB_PIN = PINS['pdf-lib']?.version || '1.17.1';
const PDF_LIB_ESM = PINS['pdf-lib']?.esm || [`https://esm.sh/pdf-lib@${PDF_LIB_PIN}`];
const PDF_LIB_UMD = PINS['pdf-lib']?.umd || [];

const STATES = [
  ['01', 'Jammu & Kashmir'], ['02', 'Himachal Pradesh'], ['03', 'Punjab'],
  ['04', 'Chandigarh'], ['05', 'Uttarakhand'], ['06', 'Haryana'],
  ['07', 'Delhi'], ['08', 'Rajasthan'], ['09', 'Uttar Pradesh'],
  ['10', 'Bihar'], ['11', 'Sikkim'], ['12', 'Arunachal Pradesh'],
  ['13', 'Nagaland'], ['14', 'Manipur'], ['15', 'Mizoram'],
  ['16', 'Tripura'], ['17', 'Meghalaya'], ['18', 'Assam'],
  ['19', 'West Bengal'], ['20', 'Jharkhand'], ['21', 'Odisha'],
  ['22', 'Chhattisgarh'], ['23', 'Madhya Pradesh'], ['24', 'Gujarat'],
  ['25', 'Daman & Diu'], ['26', 'Dadra & Nagar Haveli'], ['27', 'Maharashtra'],
  ['28', 'Andhra Pradesh'], ['29', 'Karnataka'], ['30', 'Goa'],
  ['31', 'Lakshadweep'], ['32', 'Kerala'], ['33', 'Tamil Nadu'],
  ['34', 'Puducherry'], ['35', 'Andaman & Nicobar'], ['36', 'Telangana'],
  ['37', 'Andhra Pradesh (New)'], ['38', 'Ladakh'],
];
const GST_RATES = [0, 0.25, 3, 5, 12, 18, 28];
const ALPHA36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/;

export function gstinCheckDigit(first14) {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const code = ALPHA36.indexOf(first14[i]);
    if (code < 0) return null;
    const prod = code * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(prod / 36) + (prod % 36);
  }
  return ALPHA36[(36 - (sum % 36)) % 36];
}

export function validateGstin(v) {
  const s = String(v || '').trim().toUpperCase();
  if (!s) return { ok: false, reason: 'empty' };
  if (s.length !== 15) return { ok: false, reason: 'must be 15 characters' };
  if (!GSTIN_RE.test(s)) return { ok: false, reason: 'bad format (27ABCDE1234F1Z5 pattern)' };
  const want = gstinCheckDigit(s.slice(0, 14));
  if (s[14] !== want) return { ok: false, reason: `bad checksum — 15th char should be ${want}` };
  return { ok: true, state: s.slice(0, 2) };
}

export function validateHsn(v) {
  const s = String(v || '').trim();
  if (!s) return { ok: false, reason: 'empty' };
  if (!/^\d{4,8}$/.test(s)) return { ok: false, reason: 'HSN/SAC must be 4–8 digits' };
  return { ok: true };
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n) {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
}
function threeDigits(n) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  let out = h ? ONES[h] + ' Hundred' + (r ? ' ' : '') : '';
  if (r) out += twoDigits(r);
  return out;
}

export function amountInWordsIndian(amount) {
  const n = Math.round(Number(amount) || 0);
  if (!Number.isFinite(n) || n < 0) return 'Zero Rupees Only';
  if (n === 0) return 'Zero Rupees Only';
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thou = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  const parts = [];
  if (crore) parts.push(threeDigits(crore) + ' Crore');
  if (lakh) parts.push(twoDigits(lakh) + ' Lakh');
  if (thou) parts.push(twoDigits(thou) + ' Thousand');
  if (rest) parts.push(threeDigits(rest));
  const paise = Math.round((Number(amount) - n) * 100);
  let out = parts.join(' ') + ' Rupees';
  if (paise > 0) out += ' and ' + twoDigits(paise) + ' Paise';
  return out + ' Only';
}

export function fmtINR(n) {
  const v = Number(n) || 0;
  return 'Rs. ' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function mount(el, ctx = {}) {
  const tool = (ctx && ctx.tool) || {};
  const page = shell(el, tool, ctx);
  const status = page.status;
  const q = (s) => page.root.querySelector(`[data-f="${s}"]`);

  let syntheticFile = null;
  const ensureRunnable = () => {
    if (!page.getFiles().length && !syntheticFile) {
      syntheticFile = new File(['gst-invoice'], 'gst-invoice.json', { type: 'application/json' });
      page.setFiles([syntheticFile]);
    }
  };

  const stateOpts = (sel) => STATES.map(([c, n]) =>
    `<option value="${c}"${c === sel ? ' selected' : ''}>${c} — ${n}</option>`).join('');
  const rateOpts = (sel) => GST_RATES.map((r) =>
    `<option value="${r}"${String(r) === String(sel) ? ' selected' : ''}>${r}%</option>`).join('');
  const today = new Date().toISOString().slice(0, 10);

  page.optionsEl.innerHTML = `
    <fieldset style="border:1px solid var(--line);border-radius:8px;padding:10px;display:grid;gap:8px">
      <legend style="font-weight:600;font-size:13px">Seller</legend>
      <label>Business name <input type="text" data-f="s-name" placeholder="Acme Traders" /></label>
      <label>Address <textarea data-f="s-addr" rows="2" placeholder="Shop 4, MG Road, Bengaluru 560001"></textarea></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <label>GSTIN <input type="text" data-f="s-gstin" placeholder="29ABCDE1234F1Z5" maxlength="15" style="text-transform:uppercase" /></label>
        <label>State <select data-f="s-state">${stateOpts('29')}</select></label>
      </div>
      <div class="muted" style="font-size:12px" data-f="s-hint"></div>
    </fieldset>
    <fieldset style="border:1px solid var(--line);border-radius:8px;padding:10px;display:grid;gap:8px">
      <legend style="font-weight:600;font-size:13px">Buyer (bill to)</legend>
      <label>Buyer name <input type="text" data-f="b-name" placeholder="Customer name" /></label>
      <label>Buyer address <textarea data-f="b-addr" rows="2" placeholder="Buyer address"></textarea></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <label>Buyer GSTIN (optional for B2C) <input type="text" data-f="b-gstin" placeholder="—" maxlength="15" style="text-transform:uppercase" /></label>
        <label>Place of supply <select data-f="pos">${stateOpts('29')}</select></label>
      </div>
      <div class="muted" style="font-size:12px" data-f="b-hint"></div>
      <div class="muted" style="font-size:12px" data-f="tax-mode"></div>
    </fieldset>
    <fieldset style="border:1px solid var(--line);border-radius:8px;padding:10px;display:grid;gap:8px">
      <legend style="font-weight:600;font-size:13px">Invoice</legend>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <label>Invoice no <input type="text" data-f="inv-no" value="INV-001" /></label>
        <label>Date <input type="date" data-f="inv-date" value="${today}" /></label>
        <label>Reverse charge <select data-f="rcm"><option value="No">No</option><option value="Yes">Yes</option></select></label>
      </div>
      <label>Notes (optional) <input type="text" data-f="notes" placeholder="Payment due in 7 days" /></label>
      <label>UPI ID for payment (printed on invoice, QR-ready) <input type="text" data-f="upi" placeholder="acme@upi" /></label>
    </fieldset>
    <fieldset style="border:1px solid var(--line);border-radius:8px;padding:10px;display:grid;gap:8px">
      <legend style="font-weight:600;font-size:13px">Line items</legend>
      <div data-f="items" style="display:grid;gap:8px"></div>
      <div class="btnrow">
        <button type="button" class="secondary" data-f="add-item">+ Add item</button>
      </div>
      <div class="muted" style="font-size:12px" data-f="items-hint"></div>
    </fieldset>
    <fieldset style="border:1px solid var(--line);border-radius:8px;padding:10px;display:grid;gap:8px">
      <legend style="font-weight:600;font-size:13px">Branding &amp; signatory</legend>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <label>Logo (PNG/JPG) <input type="file" data-f="logo" accept="image/png,image/jpeg" /></label>
        <label>Signature image (PNG/JPG) <input type="file" data-f="sigimg" accept="image/png,image/jpeg" /></label>
      </div>
      <label>Authorised signatory name <input type="text" data-f="signame" placeholder="For Acme Traders" /></label>
    </fieldset>
    <div class="notice" data-f="preview" style="font-size:13px"></div>`;

  const itemsEl = q('items');
  function addItem(pref = {}) {
    const row = document.createElement('div');
    row.dataset.row = 'item';
    row.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr auto;gap:6px;align-items:end';
    row.innerHTML = `
      <label style="font-size:12px">Desc<input type="text" data-c="desc" value="${(pref.desc || '').replace(/"/g, '&quot;')}" placeholder="Item / service" /></label>
      <label style="font-size:12px">HSN/SAC<input type="text" data-c="hsn" value="${pref.hsn || ''}" placeholder="8471" maxlength="8" /></label>
      <label style="font-size:12px">Qty<input type="number" data-c="qty" value="${pref.qty ?? 1}" min="0" step="0.01" /></label>
      <label style="font-size:12px">Rate (₹)<input type="number" data-c="rate" value="${pref.rate ?? 1000}" min="0" step="0.01" /></label>
      <label style="font-size:12px">GST%<select data-c="gst">${rateOpts(pref.gst ?? 18)}</select></label>
      <button type="button" class="secondary" data-c="rm" aria-label="Remove item">✕</button>`;
    row.querySelector('[data-c="rm"]').addEventListener('click', () => { row.remove(); refresh(); });
    row.querySelectorAll('input,select').forEach((n) => n.addEventListener('input', refresh));
    itemsEl.append(row);
    return row;
  }
  addItem({ desc: 'Consulting services', hsn: '9983', qty: 1, rate: 10000, gst: 18 });

  q('add-item').addEventListener('click', () => { addItem(); refresh(); });

  function readItems() {
    return [...itemsEl.querySelectorAll('[data-row="item"]')].map((r) => ({
      desc: r.querySelector('[data-c="desc"]').value.trim() || 'Item',
      hsn: r.querySelector('[data-c="hsn"]').value.trim(),
      qty: Math.max(0, Number(r.querySelector('[data-c="qty"]').value) || 0),
      rate: Math.max(0, Number(r.querySelector('[data-c="rate"]').value) || 0),
      gst: Number(r.querySelector('[data-c="gst"]').value) || 0,
    }));
  }

  function totals() {
    const items = readItems();
    let taxable = 0, tax = 0;
    for (const it of items) {
      const base = it.qty * it.rate;
      taxable += base;
      tax += (base * it.gst) / 100;
    }
    return { items, taxable, tax, grand: taxable + tax };
  }

  function refresh() {
    const sg = validateGstin(q('s-gstin').value);
    q('s-hint').textContent = q('s-gstin').value.trim()
      ? (sg.ok ? `✓ Seller GSTIN valid (state ${sg.state}).` : `✕ Seller GSTIN: ${sg.reason}.`)
      : 'Seller GSTIN required for a GST invoice.';
    const bRaw = q('b-gstin').value.trim();
    if (bRaw) {
      const bg = validateGstin(bRaw);
      q('b-hint').textContent = bg.ok ? `✓ Buyer GSTIN valid (B2B).` : `✕ Buyer GSTIN: ${bg.reason}.`;
    } else {
      q('b-hint').textContent = 'No buyer GSTIN — treated as B2C.';
    }
    const badHsn = readItems().filter((it) => !validateHsn(it.hsn).ok).length;
    q('items-hint').textContent = badHsn ? `⚠ ${badHsn} item(s) have invalid HSN/SAC (need 4–8 digits).` : 'HSN/SAC looks OK.';
    const sameState = q('s-state').value === q('pos').value;
    q('tax-mode').textContent = sameState
      ? 'Intra-state supply → CGST + SGST (rate split 50/50).'
      : 'Inter-state supply → IGST (full rate).';
    const t = totals();
    q('preview').innerHTML = `Taxable ${fmtINR(t.taxable)} · Tax ${fmtINR(t.tax)} · <strong>Total ${fmtINR(t.grand)}</strong><br><span class="muted">${amountInWordsIndian(t.grand)}</span>`;
  }
  page.optionsEl.addEventListener('input', refresh);
  page.optionsEl.addEventListener('change', refresh);
  ensureRunnable();
  refresh();

  function saveBytes(bytes, filename, mime = 'application/pdf') {
    if (ctx && typeof ctx.download === 'function') return ctx.download(bytes, filename, mime);
    const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function loadPdfLib() {
    if (globalThis.PDFLib?.PDFDocument) return globalThis.PDFLib;
    try {
      const m = await import(/* @vite-ignore */PDF_LIB_ESM[0]);
      const lib = m.default ?? m;
      if (lib?.PDFDocument) { globalThis.PDFLib = lib; return lib; }
    } catch { /* fall through to UMD */ }
    for (const src of PDF_LIB_UMD) {
      try {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = src; s.onload = res; s.onerror = rej;
          document.head.append(s);
        });
        if (globalThis.PDFLib?.PDFDocument) return globalThis.PDFLib;
      } catch { /* try next */ }
    }
    throw new Error(`Could not load pdf-lib@${PDF_LIB_PIN}`);
  }

  async function readImage(input) {
    const f = input?.files?.[0];
    if (!f) return null;
    const buf = await f.arrayBuffer();
    return { bytes: buf, type: f.type || '' };
  }

  page.onFiles(() => { ensureRunnable(); });
  page.runBtn('Generate GST invoice PDF', async () => {
    try {
      ensureRunnable();
      const sGstin = q('s-gstin').value.trim().toUpperCase();
      const sg = validateGstin(sGstin);
      if (!sg.ok) { status(`Fix seller GSTIN: ${sg.reason}.`); return; }
      const bRaw = q('b-gstin').value.trim().toUpperCase();
      if (bRaw) {
        const bg = validateGstin(bRaw);
        if (!bg.ok) { status(`Fix buyer GSTIN: ${bg.reason}.`); return; }
      }
      const t = totals();
      if (!t.items.length) { status('Add at least one line item.'); return; }
      const bad = t.items.find((it) => !validateHsn(it.hsn).ok);
      if (bad) { status(`Fix HSN/SAC for "${bad.desc}" — 4–8 digits required.`); return; }
      if (!(t.grand > 0)) { status('Total must be greater than zero.'); return; }
      const invNo = q('inv-no').value.trim() || 'INV-001';
      if (!/^[A-Za-z0-9/\-]{1,20}$/.test(invNo)) { status('Invoice no: letters/digits/-//, max 20 chars.'); return; }

      status('Loading pdf-lib…');
      const { PDFDocument, StandardFonts, rgb } = await loadPdfLib();
      const doc = await PDFDocument.create();
      const helv = await doc.embedFont(StandardFonts.Helvetica);
      const bold = await doc.embedFont(StandardFonts.HelveticaBold);
      const A4 = [595.28, 841.89];
      const M = 36;
      const W = A4[0] - M * 2;
      const ink = rgb(0.1, 0.1, 0.1);
      const grey = rgb(0.42, 0.42, 0.42);
      const line = rgb(0.8, 0.8, 0.8);

      const logo = await readImage(q('logo'));
      const sig = await readImage(q('sigimg'));
      let logoImg = null, sigImg = null;
      const tryEmbed = async (img) => {
        if (!img) return null;
        try {
          if (/png/i.test(img.type) || !/jpeg|jpg/i.test(img.type)) return await doc.embedPng(img.bytes);
          return await doc.embedJpg(img.bytes);
        } catch {
          try { return await doc.embedJpg(img.bytes); } catch { return await doc.embedPng(img.bytes); }
        }
      };
      try { logoImg = await tryEmbed(logo); } catch { logoImg = null; }
      try { sigImg = await tryEmbed(sig); } catch { sigImg = null; }

      const sName = q('s-name').value.trim() || 'Seller';
      const sAddr = q('s-addr').value.trim();
      const bName = q('b-name').value.trim() || 'Buyer';
      const bAddr = q('b-addr').value.trim();
      const sState = q('s-state');
      const pos = q('pos');
      const sameState = sState.value === pos.value;
      const invDate = q('inv-date').value || today;
      const upi = q('upi').value.trim();
      const notes = q('notes').value.trim();
      const signame = q('signame').value.trim() || sName;
      const rcm = q('rcm').value;

      let pg = doc.addPage(A4);
      let y = A4[1] - M;
      const need = (h) => { if (y - h < M + 60) { pg = doc.addPage(A4); y = A4[1] - M; } };
      const text = (s, x, yy, { f = helv, size = 9, c = ink, max = W } = {}) => {
        pg.drawText(String(s).replace(/[\u{10000}-\u{10FFFF}]/gu, '?'), { x, y: yy, size, font: f, color: c, maxWidth: max });
      };
      const rule = () => { pg.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.75, color: line }); };

      // Header
      let hx = M;
      if (logoImg) {
        const lw = 64, lh = 64 * (logoImg.height / logoImg.width);
        pg.drawImage(logoImg, { x: M, y: y - Math.min(lh, 48), width: lw, height: Math.min(lh, 48) });
        hx = M + lw + 10;
      }
      text('TAX INVOICE', hx, y - 6, { f: bold, size: 17 });
      text(`Original for recipient · ${rcm === 'Yes' ? 'Reverse charge: Yes' : 'Reverse charge: No'}`, hx, y - 21, { size: 8, c: grey });
      y -= 34; rule(); y -= 12;

      // Seller / buyer / meta
      text(sName, M, y, { f: bold, size: 11 }); y -= 13;
      for (const ln of sAddr.split('\n').slice(0, 2)) { if (ln.trim()) { text(ln.trim(), M, y, { size: 8.5, c: grey }); y -= 11; } }
      text(`GSTIN: ${sGstin} · State: ${sState.value} ${sState.selectedOptions[0]?.textContent?.split('—')[1]?.trim() || ''}`, M, y, { size: 8.5 });
      y -= 14; rule(); y -= 12;
      text(`Bill to: ${bName}`, M, y, { f: bold, size: 10 }); y -= 12;
      for (const ln of bAddr.split('\n').slice(0, 2)) { if (ln.trim()) { text(ln.trim(), M, y, { size: 8.5, c: grey }); y -= 11; } }
      if (bRaw) { text(`Buyer GSTIN: ${bRaw}`, M, y, { size: 8.5 }); y -= 11; }
      text(`Invoice ${invNo} · Date ${invDate} · Place of supply: ${pos.value} ${(pos.selectedOptions[0]?.textContent || '').split('—')[1] || ''}`, M, y, { size: 8.5 });
      y -= 8;
      text(sameState ? 'Intra-state: CGST + SGST apply' : 'Inter-state: IGST applies', M, y - 4, { size: 8, c: grey });
      y -= 18;

      // Table
      const cols = [30, 220, 62, 48, 62, 52, 69]; // # desc hsn qty rate gst amount
      const colX = []; let cx = M;
      for (const w of cols) { colX.push(cx); cx += w; }
      const head = ['#', 'Item', 'HSN/SAC', 'Qty', 'Rate', 'GST%', 'Amount'];
      need(24);
      pg.drawRectangle({ x: M, y: y - 4, width: W, height: 18, color: rgb(0.94, 0.94, 0.94) });
      head.forEach((h, i) => text(h, colX[i] + 4, y, { f: bold, size: 8 }));
      y -= 16;
      t.items.forEach((it, idx) => {
        need(16);
        const amt = it.qty * it.rate * (1 + it.gst / 100);
        const cells = [String(idx + 1), it.desc.slice(0, 42), it.hsn,
          String(it.qty), it.rate.toFixed(2), it.gst + '%', amt.toFixed(2)];
        cells.forEach((c, i) => text(c, colX[i] + 4, y, { size: 8, max: cols[i] - 8 }));
        y -= 13;
      });
      rule(); y -= 12;

      // Totals
      need(120);
      const right = (label, val, b = false) => {
        text(label, M + W - 210, y, { f: b ? bold : helv, size: b ? 10 : 9 });
        const v = String(val);
        text(v, M + W - helv.widthOfTextAtSize(v, 9) - 2, y, { f: b ? bold : helv, size: 9 });
        y -= 13;
      };
      right('Taxable value:', fmtINR(t.taxable));
      if (sameState) {
        right(`CGST (${(t.items[0]?.gst || 0) / 2}% blended):`, fmtINR(t.tax / 2));
        right(`SGST (${(t.items[0]?.gst || 0) / 2}% blended):`, fmtINR(t.tax / 2));
      } else {
        right('IGST:', fmtINR(t.tax));
      }
      right('Grand total:', fmtINR(t.grand), true);
      y -= 4;
      text('Amount in words:', M, y, { f: bold, size: 8.5 }); y -= 11;
      for (const ln of wrapWords(amountInWordsIndian(t.grand), 92)) { text(ln, M, y, { size: 8.5 }); y -= 11; }
      y -= 4; rule(); y -= 10;

      if (upi) {
        need(30);
        text(`Pay via UPI: ${upi}  (QR-ready — paste this ID in any UPI app to generate a collect QR)`, M, y, { size: 8.5 });
        y -= 14;
      }
      if (notes) { text(`Notes: ${notes.slice(0, 140)}`, M, y, { size: 8.5, c: grey }); y -= 13; }
      y -= 4;
      text('Declaration: This is a computer-generated GST invoice. Goods/services as described above.', M, y, { size: 7.5, c: grey });
      y -= 16;

      // Signature
      need(80);
      text(`For ${signame}`, M + W - 200, y, { f: bold, size: 9 }); y -= 12;
      if (sigImg) {
        const sw = 110, sh = 44 * (sigImg.height / sigImg.width);
        pg.drawImage(sigImg, { x: M + W - 160, y: y - Math.min(sh, 40), width: sw, height: Math.min(sh, 40) });
        y -= 46;
      } else { y -= 30; }
      text('Authorised signatory', M + W - 200, y, { size: 8, c: grey }); y -= 14;

      // Footer
      pg.drawLine({ start: { x: M, y: M + 14 }, end: { x: M + W, y: M + 14 }, thickness: 0.5, color: line });
      pg.drawText('Generated on-device · verify GSTIN checksum & HSN before filing GSTR-1', {
        x: M, y: M + 3, size: 7, font: helv, color: grey,
      });

      const bytes = await doc.save({ useObjectStreams: true });
      const safe = invNo.replace(/[^A-Za-z0-9-]+/g, '-');
      saveBytes(bytes, `${safe}.pdf`, 'application/pdf');
      page.setProgress(1);
      status(`Done — ${invNo} · ${t.items.length} item(s) · total ${fmtINR(t.grand)} (${sameState ? 'CGST+SGST' : 'IGST'}).`);
    } catch (e) { status('Error: ' + (e?.message || e)); }
  });

  function wrapWords(s, per) {
    const words = String(s).split(/\s+/);
    const out = []; let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > per) { out.push(cur.trim()); cur = w; }
      else cur += ' ' + w;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  return () => { page.cleanup(); };
}
