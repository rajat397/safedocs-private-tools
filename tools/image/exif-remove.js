// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/image/exif-remove.js — vanilla ES module, zero upload.
// Strips EXIF by re-encoding via createImageBitmap -> canvas -> toBlob.
// createImageBitmap with imageOrientation:'from-image' bakes orientation so
// the output needs no EXIF orientation tag. Canvas re-encode drops ALL
// APPn markers => 0 EXIF tags in output. No external libs (lazy: none needed).
// Contract: export function mount(el, ctx) -> cleanup function.

const TOOL_ID = 'image-exif';
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
  // Bake EXIF orientation during decode.
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image', premultiplyAlpha: 'default' });
  } catch {
    // Fallback for older browsers: <img> + object URL.
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => rej(new Error('could not decode image (unsupported type?)'));
        im.src = url;
      });
      return { _imgEl: img, width: img.naturalWidth, height: img.naturalHeight, close() {} };
    } finally {
      try { URL.revokeObjectURL(url); } catch {}
    }
  }
}

function drawToCanvas(src, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  if (src._imgEl) ctx.drawImage(src._imgEl, 0, 0, w, h);
  else ctx.drawImage(src, 0, 0, w, h);
  return c;
}

function toBlob(canvas, type, quality) {
  return new Promise((res, rej) => {
    if (type === 'image/png') canvas.toBlob(b => b ? res(b) : rej(new Error('encode failed')), type);
    else canvas.toBlob(b => b ? res(b) : rej(new Error('encode failed')), type, quality);
  });
}

/** Pure helper (no DOM): strip EXIF from a Blob. Exported for tests. */
export async function strip(blob) {
  const f = blob instanceof File ? blob : new File([blob], 'in', { type: blob?.type || 'image/jpeg' });
  const bmp = await loadBitmap(f);
  const canvas = drawToCanvas(bmp, bmp.width, bmp.height);
  if (bmp.close) bmp.close();
  try {
    const out = await toBlob(canvas, 'image/jpeg', 0.92);
    return out;
  } finally {
    canvas.width = canvas.height = 0;
  }
}

export function mount(el, ctx = {}) {
  const log = (...a) => { (ctx.log || console.log)('[exif-remove]', ...a); };
  let inUrl = null, outUrl = null, outBlob = null, srcFile = null;
  let dead = false;
  // Unified ObjectURL tracking: every URL we hand to <img>/<a> is registered
  // here and revoked exactly once on replace/unmount.
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
    <p class="muted">100% local — file never uploads. Re-encodes pixels; drops all EXIF/APP markers.</p>
    <label>Image (JPG/PNG/WebP) <input type="file" accept="image/jpeg,image/png,image/webp" /></label>
    <div class="row" style="margin:8px 0">
      <button data-act="strip">Strip EXIF</button>
      <a data-act="dl" hidden download="stripped.jpg">Download clean image</a>
    </div>
    <div data-slot="meta" class="muted"></div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px">
      <figure style="margin:0"><figcaption class="muted">Before</figcaption><img data-slot="before" style="max-width:220px;display:none"/></figure>
      <figure style="margin:0"><figcaption class="muted">After (0 EXIF tags)</figcaption><img data-slot="after" style="max-width:220px;display:none"/></figure>
    </div>
    <div data-slot="log" class="muted" aria-live="polite"></div>
  </div>`);
  el.appendChild(root);
  const q = s => root.querySelector(s);
  const fileInput = q('input[type=file]'), btn = q('[data-act=strip]'),
        dl = q('[data-act=dl]'), meta = q('[data-slot=meta]'),
        imgB = q('[data-slot=before]'), imgA = q('[data-slot=after]'),
        logBox = q('[data-slot=log]');

  const say = m => { logBox.textContent = m; log(m); };

  function gateFile(f) {
    if (!f) return null;
    if (isHeic(f)) {
      say('HEIC/HEIF is not decodable in this browser via canvas — convert to JPEG/PNG first, then strip EXIF here.');
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
    say('Loaded locally. Press Strip EXIF.');
  });

  btn.addEventListener('click', async () => {
    if (!srcFile) { say('Choose an image first.'); return; }
    if (isHeic(srcFile)) { say('HEIC/HEIF is not decodable in this browser via canvas — convert to JPEG/PNG first.'); return; }
    btn.disabled = true;
    try {
      const t0 = performance.now();
      const bmp = await loadBitmap(srcFile);
      const w = bmp.width, ht = bmp.height;
      const cap = maxImageDim();
      if (Math.max(w, ht) > cap) {
        if (bmp.close) bmp.close();
        say(`Image ${w}×${ht} exceeds this device's max dimension (${cap}px) — downscale with Compress first.`);
        return;
      }
      const canvas = drawToCanvas(bmp, w, ht);
      if (bmp.close) bmp.close();
      // Keep container: JPEG photo -> JPEG (EXIF only exists meaningfully there);
      // PNG/WebP input -> same type to avoid lossy surprise. JPEG quality 0.92.
      let type = safeType(srcFile);
      if (type !== 'image/png' && type !== 'image/webp') type = 'image/jpeg';
      const blob = await toBlob(canvas, type, 0.92);
      canvas.width = canvas.height = 0; // free pixel buffer
      revoke(outUrl);
      outBlob = blob;
      outUrl = track(URL.createObjectURL(blob));
      imgA.src = outUrl; imgA.style.display = 'block';
      const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
      dl.href = outUrl; dl.download = 'stripped.' + ext; dl.hidden = false;
      const dt = Math.round(performance.now() - t0);
      meta.textContent += ` → Output: ${type} · ${(blob.size / 1024).toFixed(1)} KB · ${w}×${ht} · ${dt}ms`;
      say(`Done: canvas re-encode dropped all APPn/EXIF markers → 0 tags. Orientation baked (${w}×${ht}).`);
    } catch (e) { say('Failed: ' + (e?.message || e)); }
    finally { btn.disabled = false; }
  });

  log('mounted');
  // Router contract: return a cleanup function (called on route change).
  function cleanup() {
    if (dead) return;
    dead = true;
    revokeAll();
    inUrl = outUrl = null; outBlob = null; srcFile = null;
    el.innerHTML = '';
    log('unmounted');
  }
  // Backward-compat test hooks attached to the function (still typeof 'function').
  cleanup.strip = strip;
  Object.defineProperty(cleanup, 'output', { get: () => outBlob });
  return cleanup;
}
export default { mount, strip };
