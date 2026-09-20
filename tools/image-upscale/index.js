// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava. Source-available - see /LICENSE. Commercial use requires permission: rajat242003@gmail.com.
/**
 * tools/image-upscale/index.js — AI Upscaling (Real-CUGAN via TF.js)
 * 100% on-device, zero upload. Apache-2.0 licensed models.
 * Contract: export function mount(el, ctx) -> cleanup function (7-step shell).
 */
import { shell } from '../_lib/page.js';
import { loadModel, releaseModel } from '../../core/model-loader.js';
import { mountComparisonSlider } from '../../ui/comparison-slider.js';

const TOOL_ID = 'image-upscale';
const ACCEPT = 'image/jpeg,image/png,image/webp';
const MODEL_PIN = 'realcugan';

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

function drawToCanvas(src, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  if (src._imgEl) ctx.drawImage(src._imgEl, 0, 0, w, h);
  else ctx.drawImage(src, 0, 0, w, h);
  return c;
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((res, rej) => {
    if (type === 'image/png') canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), type);
    else canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), type, quality);
  });
}

/** Pure-ish helper (needs DOM canvas): upscale -> Blob. */
export async function upscaleImage(blob, scale, onProgress) {
  const s = scale === 4 ? 4 : 2;
  const file = blob instanceof File ? blob : new File([blob], 'in', { type: blob?.type || 'image/png' });
  const bmp = await loadBitmap(file);
  const w = bmp.width;
  const h = bmp.height;

  const loaded = await loadModel(MODEL_PIN, {
    onProgress: (ld, total) => { try { onProgress?.(total ? (ld / total) * 0.3 : 0.1); } catch {} },
    onLog: (msg) => console.log('[upscale]', msg),
  });
  const { tf, models } = loaded.module;
  const info = models[`${s}x`];
  if (!info) throw new Error(`Model for ${s}x not found`);
  try { onProgress?.(0.3); } catch {}

  const model = await tf.loadGraphModel(info.url);
  try { onProgress?.(0.5); } catch {}
  const canvas = drawToCanvas(bmp, w, h);
  if (bmp.close) { try { bmp.close(); } catch {} }
  const input = tf.browser.fromPixels(canvas).toFloat().div(255).expandDims(0);
  canvas.width = canvas.height = 0;
  const output = await model.executeAsync(input);
  try { input.dispose(); } catch {}
  try { onProgress?.(0.7); } catch {}
  const result = output.clipByValue(0, 1).mul(255).cast('int32');
  try { output.dispose(); } catch {}

  const outCanvas = document.createElement('canvas');
  outCanvas.width = w * s; outCanvas.height = h * s;
  await tf.browser.toPixels(result, outCanvas);
  try { result.dispose(); } catch {}
  try { onProgress?.(0.9); } catch {}
  const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const out = await canvasToBlob(outCanvas, outType, outType === 'image/png' ? 1.0 : 0.92);
  outCanvas.width = outCanvas.height = 0;
  try { onProgress?.(1.0); } catch {}
  return out;
}

export async function mount(el, ctx = {}) {
  const tool = (ctx && ctx.tool) || { id: TOOL_ID, accept: ACCEPT, multiple: false };
  const page = shell(el, tool, ctx);
  const log = (...a) => { try { (ctx.log || console.log)('[upscale]', ...a); } catch {} };

  page.optionsEl.innerHTML = `
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:end">
      <label style="display:grid;gap:4px;font-size:13px;font-weight:600">Scale
        <select data-f="scale" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px">
          <option value="2">2×</option>
          <option value="4">4×</option>
        </select>
      </label>
    </div>
    <p class="muted" style="font-size:12px;margin:0">100% local — Real-CUGAN (Apache-2.0) via TensorFlow.js. First run downloads a ~3 MB model, cached on-device. Files never leave your device.</p>
    <div data-slot="comparison"></div>`;
  const q = (s) => page.optionsEl.querySelector(`[data-f="${s}"]`);
  const comparisonSlot = page.optionsEl.querySelector('[data-slot="comparison"]');
  let sliderCleanup = null;
  let current = [];

  page.onFiles((files) => {
    current = [...(files || [])];
    if (sliderCleanup) { try { sliderCleanup(); } catch {} sliderCleanup = null; }
    try { comparisonSlot.innerHTML = ''; } catch {}
  });

  page.runBtn('Upscale', async (files, api) => {
    const list = (files && files.length ? files : current);
    if (!list.length) { api.status('Pick an image first.'); return; }
    let file = list[0];
    try {
      if (typeof ctx.checkFiles === 'function') {
        const r = ctx.checkFiles([file], { toolId: TOOL_ID, accept: ACCEPT, multiple: false });
        const rej = (r?.rejected || []).find((x) => x.file === file);
        if (rej) { api.status('Rejected: ' + rej.reason); return; }
        if (r?.accepted?.length) file = r.accepted[0];
      }
    } catch (e) { log('checkFiles failed (non-fatal):', e?.message || e); }
    const scale = parseInt(q('scale')?.value || '2', 10) === 4 ? 4 : 2;
    const t0 = performance.now();
    api.status('Loading model…');
    api.setProgress(0.05);
    const inUrl = URL.createObjectURL(file);
    try {
      const blob = await upscaleImage(file, scale, (f) => api.setProgress(f));
      const dt = Math.round(performance.now() - t0);
      api.clearOutput();
      const ext = blob.type === 'image/png' ? 'png' : 'jpg';
      if (typeof ctx.download === 'function') ctx.download(blob, `upscaled-${scale}x.${ext}`, blob.type);
      else api.addDownload(blob, `upscaled-${scale}x.${ext}`, 'Download upscaled');
      const outUrl = URL.createObjectURL(blob);
      const { destroy } = mountComparisonSlider(comparisonSlot, {
        beforeSrc: inUrl,
        afterSrc: outUrl,
        beforeLabel: 'Original',
        afterLabel: `${scale}× upscaled`,
        downloadFilename: `upscaled-${scale}x.${ext}`,
      });
      sliderCleanup = destroy;
      api.status(`Done in ${dt}ms — ${scale}× upscale on-device. Compare with the slider, then download.`);
      api.setProgress(1);
    } catch (e) {
      api.status('Failed: ' + (e?.message || e));
    } finally {
      try { setTimeout(() => URL.revokeObjectURL(inUrl), 10000); } catch {}
    }
  });

  log('mounted');
  return () => {
    try { if (sliderCleanup) sliderCleanup(); } catch {}
    try { releaseModel(MODEL_PIN); } catch {}
    try { page.cleanup(); } catch {}
    log('unmounted');
  };
}

export default { mount, upscaleImage };
