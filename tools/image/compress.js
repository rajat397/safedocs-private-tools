// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/image/compress.js — vanilla ES module, zero upload.
// Compress via createImageBitmap(imageOrientation:'from-image') -> canvas
// scaled to max-dimension -> toBlob(mime, quality). No external libs.
// Contract: export function mount(el, ctx) -> cleanup function.

const TOOL_ID = 'image-compress';
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

function fit(w, ht, maxDim) {
  maxDim = Math.max(1, +maxDim || 1920);
  const m = Math.max(w, ht);
  if (m <= maxDim) return [w, ht];
  const s = maxDim / m;
  return [Math.round(w * s), Math.round(ht * s)];
}

/** Pure helper (no DOM). Exported for tests. */
export async function compress(blob, { quality = 0.8, maxDim = 1920, mime = 'image/jpeg' } = {}) {
  const f = blob instanceof File ? blob : new File([blob], 'in', { type: blob?.type || 'image/jpeg' });
  const bmp = await loadBitmap(f);
  const [w, ht] = fit(bmp.width, bmp.height, maxDim);
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
  const log = (...a) => { (ctx.log || console.log)('[compress]', ...a); };
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
    <p class="muted">100% local — downscale + re-encode. EXIF dropped as a side effect.</p>
    <label>Image <input type="file" accept="image/jpeg,image/png,image/webp" /></label>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin:8px 0;align-items:end">
      <label>Quality <input type="range" min="0.1" max="1" step="0.05" value="0.8" data-in="q" /> <b data-out="qv">0.80</b></label>
      <label>Max dimension (px) <input type="number" min="16" max="8192" value="1920" data-in="max" style="width:90px" /></label>
      <label>Format <select data-in="fmt">
        <option value="keep">Keep original</option>
        <option value="image/jpeg">JPEG (smallest photo)</option>
        <option value="image/webp">WebP (smallest)</option>
        <option value="image/png">PNG (lossless, big)</option>
      </select></label>
    </div>
    <div class="row"><button data-act="go">Compress</button>
      <a data-act="dl" hidden>Download compressed</a></div>
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
        logBox = q('[data-slot=log]'), qIn = q('[data-in=q]'), qV = q('[data-out=qv]'),
        maxIn = q('[data-in=max]'), fmtSel = q('[data-in=fmt]');
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
      const quality = Math.min(1, Math.max(0.1, +qIn.value || 0.8));
      const bmp = await loadBitmap(srcFile);
      const cap = maxImageDim();
      if (Math.max(bmp.width, bmp.height) > cap) {
        if (bmp.close) bmp.close();
        say(`Image ${bmp.width}×${bmp.height} exceeds this device's max dimension (${cap}px) — lower Max dimension below ${cap}px.`);
        return;
      }
      const [w, ht] = fit(bmp.width, bmp.height, maxIn.value);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = ht;
      const c2 = canvas.getContext('2d');
      if (bmp._imgEl) c2.drawImage(bmp._imgEl, 0, 0, w, ht); else c2.drawImage(bmp, 0, 0, w, ht);
      if (bmp.close) bmp.close();
      let mime = fmtSel.value === 'keep' ? safeType(srcFile) : fmtSel.value;
      if (mime !== 'image/png' && mime !== 'image/webp') mime = 'image/jpeg';
      // PNG input kept as PNG stays lossless; still shrinks if downscaled.
      const blob = await new Promise((res, rej) => {
        if (mime === 'image/png') canvas.toBlob(b => b ? res(b) : rej(new Error('encode failed')), mime);
        else canvas.toBlob(b => b ? res(b) : rej(new Error('encode failed')), mime, quality);
      });
      canvas.width = canvas.height = 0;
      revoke(outUrl); outBlob = blob; outUrl = track(URL.createObjectURL(blob));
      imgA.src = outUrl; imgA.style.display = 'block';
      const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
      dl.href = outUrl; dl.download = 'compressed.' + ext; dl.hidden = false;
      const saved = 100 * (1 - blob.size / srcFile.size);
      meta.textContent =
        `Input ${(srcFile.size / 1024).toFixed(1)} KB → Output ${(blob.size / 1024).toFixed(1)} KB ` +
        `(${saved >= 0 ? '-' : '+'}${Math.abs(saved).toFixed(1)}%) · ${w}×${ht} · q=${quality.toFixed(2)} · ${mime}`;
      say(saved > 0 ? `Compressed ${saved.toFixed(1)}% smaller.` : 'Output larger (try lower quality / JPEG/WebP, or PNG is lossless).');
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
  cleanup.compress = compress;
  Object.defineProperty(cleanup, 'output', { get: () => outBlob });
  return cleanup;
}
export default { mount, compress };
