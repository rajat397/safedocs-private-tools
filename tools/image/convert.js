// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/image/convert.js — vanilla ES module, zero upload.
// Convert JPEG/PNG/WebP via createImageBitmap(imageOrientation:'from-image')
// -> canvas -> toBlob(target mime, quality). Round-trip output is a decodable
// image. No external libs (lazy: none needed).
// Contract: export function mount(el, ctx) -> cleanup function.

const TOOL_ID = 'image-compress'; // closest caps profile (no dedicated convert id)
const ACCEPT = 'image/jpeg,image/png,image/webp';

function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function safeType(f) { return String(f?.type || '').toLowerCase(); }
function safeName(f) { return String(f?.name || '').toLowerCase(); }
function isHeic(f) {
  const t = safeType(f);
  const n = safeName(f);
  return t.includes('heic') || t.includes('heif') || n.endsWith('.heic') || n.endsWith('.heif');
}

async function loadBitmap(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => rej(new Error('could not decode image (unsupported type?)'));
        im.src = url;
      });
      return { _imgEl: img, width: img.naturalWidth, height: img.naturalHeight, close() {} };
    } finally { try { URL.revokeObjectURL(url); } catch {} }
  }
}

/** Pure helper (no DOM). Exported for tests. */
export async function convert(blob, { mime = 'image/png', quality = 0.9, maxDim = 0 } = {}) {
  const f = blob instanceof File ? blob : new File([blob], 'in', { type: blob?.type || 'image/png' });
  const bmp = await loadBitmap(f);
  let w = bmp.width, ht = bmp.height;
  if (maxDim > 0 && Math.max(w, ht) > maxDim) {
    const s = maxDim / Math.max(w, ht);
    w = Math.round(w * s); ht = Math.round(ht * s);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = ht;
  const c2 = canvas.getContext('2d');
  if (bmp._imgEl) c2.drawImage(bmp._imgEl, 0, 0, w, ht); else c2.drawImage(bmp, 0, 0, w, ht);
  if (bmp.close) bmp.close();
  try {
    const out = await new Promise((res, rej) => {
      if (mime === 'image/png') canvas.toBlob(b => b ? res(b) : rej(new Error('encode failed')), mime);
      else canvas.toBlob(b => b ? res(b) : rej(new Error('encode failed')), mime, quality);
    });
    return out;
  } finally {
    canvas.width = canvas.height = 0;
  }
}

export function mount(el, ctx = {}) {
  const log = (...a) => { (ctx.log || console.log)('[convert]', ...a); };
  let inUrl = null, outUrl = null, outBlob = null, srcFile = null;
  let dead = false;
  const urls = new Set();
  const track = (u) => { if (u) urls.add(u); return u; };
  const revoke = (u) => { try { if (u) { URL.revokeObjectURL(u); urls.delete(u); } } catch {} };
  const revokeAll = () => { for (const u of [...urls]) revoke(u); };

  const maxImageDim = () => {
    try {
      const caps = typeof ctx.activeCaps === 'function' ? ctx.activeCaps(TOOL_ID) : null;
      if (caps && Number.isFinite(+caps.maxImageDim)) return +caps.maxImageDim;
    } catch {}
    return 12000;
  };

  el.innerHTML = '';
  const root = h(`<div class="imgtool">
    <p class="muted">100% local — decode then re-encode to JPEG / PNG / WebP.</p>
    <label>Image <input type="file" accept="image/jpeg,image/png,image/webp" /></label>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin:8px 0;align-items:end">
      <label>Target <select data-in="fmt">
        <option value="image/jpeg">JPEG (.jpg)</option>
        <option value="image/png">PNG (.png)</option>
        <option value="image/webp">WebP (.webp)</option>
      </select></label>
      <label>Quality (JPEG/WebP) <input type="range" min="0.1" max="1" step="0.05" value="0.9" data-in="q" /> <b data-out="qv">0.90</b></label>
      <label>Max dimension (px, 0 = keep) <input type="number" min="0" max="8192" value="0" data-in="max" style="width:90px" /></label>
    </div>
    <div class="row"><button data-act="go">Convert</button>
      <a data-act="dl" hidden>Download converted</a></div>
    <div data-slot="meta" class="muted"></div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px">
      <figure style="margin:0"><figcaption class="muted">Before</figcaption><img data-slot="before" style="max-width:220px;display:none"/></figure>
      <figure style="margin:0"><figcaption class="muted">After</figcaption><img data-slot="after" style="max-width:220px;display:none"/></figure>
    </div>
    <div data-slot="log" class="muted" aria-live="polite"></div>
  </div>`);
  el.appendChild(root);
  const q = s => root.querySelector(s);
  const fileInput = q('input[type=file]'), btn = q('[data-act=go]'), dl = q('[data-act=dl]'),
        meta = q('[data-slot=meta]'), imgB = q('[data-slot=before]'), imgA = q('[data-slot=after]'),
        logBox = q('[data-slot=log]'), fmtSel = q('[data-in=fmt]'),
        qIn = q('[data-in=q]'), qV = q('[data-out=qv]'), maxIn = q('[data-in=max]');
  const say = m => { logBox.textContent = m; log(m); };
  qIn.addEventListener('input', () => { qV.textContent = (+qIn.value).toFixed(2); });

  function gateFile(f) {
    if (!f) return null;
    if (isHeic(f)) {
      say('HEIC/HEIF is not decodable in this browser via canvas — convert to JPEG/PNG first.');
      return null;
    }
    if (typeof ctx.checkFiles === 'function') {
      try {
        const r = ctx.checkFiles([f], { toolId: TOOL_ID, accept: ACCEPT, multiple: false });
        const rej = (r?.rejected || []).find(x => x.file === f);
        if (rej) { say('Rejected: ' + rej.reason); return null; }
        if (r?.accepted && !r.accepted.includes(f)) { say('File not accepted for this tool.'); return null; }
      } catch (e) { log('checkFiles failed (non-fatal):', e?.message || e); }
    }
    return f;
  }

  fileInput.addEventListener('change', () => {
    revoke(inUrl); revoke(outUrl); inUrl = outUrl = null; outBlob = null;
    imgA.style.display = 'none'; dl.hidden = true;
    const raw = fileInput.files?.[0] || null;
    srcFile = gateFile(raw);
    if (!raw) { meta.textContent = ''; imgB.style.display = 'none'; return; }
    if (!srcFile) { meta.textContent = ''; imgB.style.display = 'none'; fileInput.value = ''; return; }
    inUrl = track(URL.createObjectURL(srcFile));
    imgB.src = inUrl; imgB.style.display = 'block';
    meta.textContent = `Input: ${srcFile.name || 'image'} · ${safeType(srcFile) || 'unknown'} · ${(srcFile.size / 1024).toFixed(1)} KB`;
  });

  btn.addEventListener('click', async () => {
    if (!srcFile) { say('Choose an image first.'); return; }
    if (isHeic(srcFile)) { say('HEIC/HEIF is not decodable in this browser via canvas — convert to JPEG/PNG first.'); return; }
    btn.disabled = true;
    try {
      const mime = fmtSel.value, quality = Math.min(1, Math.max(0.1, +qIn.value || 0.9));
      const bmp = await loadBitmap(srcFile);
      let w = bmp.width, ht = bmp.height;
      const cap = maxImageDim();
      if (Math.max(w, ht) > cap) {
        if (bmp.close) bmp.close();
        say(`Image ${w}×${ht} exceeds this device's max dimension (${cap}px) — set Max dimension below ${cap}px.`);
        return;
      }
      const max = +maxIn.value || 0;
      if (max > 0 && Math.max(w, ht) > max) {
        const s = max / Math.max(w, ht);
        w = Math.round(w * s); ht = Math.round(ht * s);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = ht;
      const c2 = canvas.getContext('2d');
      if (bmp._imgEl) c2.drawImage(bmp._imgEl, 0, 0, w, ht); else c2.drawImage(bmp, 0, 0, w, ht);
      if (bmp.close) bmp.close();
      const blob = await new Promise((res, rej) => {
        if (mime === 'image/png') canvas.toBlob(b => b ? res(b) : rej(new Error('encode failed')), mime);
        else canvas.toBlob(b => b ? res(b) : rej(new Error('encode failed')), mime, quality);
      });
      canvas.width = canvas.height = 0;
      // Round-trip check: ensure output decodes (decode URL is transient, never shown).
      try {
        const check = await loadBitmap(new File([blob], 'check', { type: mime }));
        if (check.close) check.close();
      } catch (e) {
        say('Failed: output did not round-trip decode (' + (e?.message || e) + ')');
        return;
      }
      revoke(outUrl); outBlob = blob; outUrl = track(URL.createObjectURL(blob));
      imgA.src = outUrl; imgA.style.display = 'block';
      const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
      dl.href = outUrl; dl.download = 'converted.' + ext; dl.hidden = false;
      meta.textContent += ` → Output: ${mime} · ${(blob.size / 1024).toFixed(1)} KB · ${w}×${ht}`;
      say(`Converted to ${mime} — round-trip decode OK, opens cleanly.`);
    } catch (e) { say('Failed: ' + (e?.message || e)); }
    finally { btn.disabled = false; }
  });

  log('mounted');
  function cleanup() {
    if (dead) return;
    dead = true;
    revokeAll();
    inUrl = outUrl = null; outBlob = null; srcFile = null;
    el.innerHTML = '';
    log('unmounted');
  }
  cleanup.convert = convert;
  Object.defineProperty(cleanup, 'output', { get: () => outBlob });
  return cleanup;
}
export default { mount, convert };
