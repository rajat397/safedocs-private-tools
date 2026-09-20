// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava. Source-available - see /LICENSE. Commercial use requires permission: rajat242003@gmail.com.
/**
 * tools/image-colorize/index.js — AI Colorization (DeOldify-q via ONNX Runtime Web)
 * 100% on-device, zero upload. MIT licensed model.
 * Contract: export function mount(el, ctx) -> cleanup function (7-step shell).
 */
import { shell } from '../_lib/page.js';
import { loadModel, releaseModel } from '../../core/model-loader.js';
import { mountComparisonSlider } from '../../ui/comparison-slider.js';

const TOOL_ID = 'image-colorize';
const ACCEPT = 'image/jpeg,image/png,image/webp';
const MODEL_PIN = 'deoldify-quant';

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

function labToRgb(l, a, b) {
  const y = (l + 16) / 116;
  const x = a / 500 + y;
  const z = y - b / 200;
  const f = (t) => (t > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const X = f(x) * 0.95047;
  const Y = f(y);
  const Z = f(z) * 1.08883;
  const r0 = X * 3.2406 + Y * -1.5372 + Z * -0.4986;
  const g0 = X * -0.9689 + Y * 1.8758 + Z * 0.0415;
  const b0 = X * 0.0557 + Y * -0.2040 + Z * 1.0570;
  const srgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  return [
    Math.round(Math.max(0, Math.min(255, srgb(r0) * 255))),
    Math.round(Math.max(0, Math.min(255, srgb(g0) * 255))),
    Math.round(Math.max(0, Math.min(255, srgb(b0) * 255))),
  ];
}

/** Pure-ish helper (needs DOM canvas): colorize B&W -> Blob. */
export async function colorizeImage(blob, onProgress) {
  const file = blob instanceof File ? blob : new File([blob], 'in', { type: blob?.type || 'image/png' });
  const bmp = await loadBitmap(file);
  const w = bmp.width;
  const h = bmp.height;

  const loaded = await loadModel(MODEL_PIN, {
    onProgress: (ld, total) => { try { onProgress?.(total ? (ld / total) * 0.3 : 0.1); } catch {} },
    onLog: (msg) => console.log('[colorize]', msg),
  });
  const { ort, session } = loaded.module;
  try { onProgress?.(0.3); } catch {}

  const S = 256;
  const canvas = drawToCanvas(bmp, S, S);
  if (bmp.close) { try { bmp.close(); } catch {} }
  const gctx = canvas.getContext('2d');
  const pixels = gctx.getImageData(0, 0, S, S).data;
  const input = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) {
    input[i] = (0.299 * pixels[i * 4] + 0.587 * pixels[i * 4 + 1] + 0.114 * pixels[i * 4 + 2]) / 255.0;
  }
  canvas.width = canvas.height = 0;

  const feeds = { input: new ort.Tensor('float32', input, [1, 1, S, S]) };
  const results = await session.run(feeds);
  try { onProgress?.(0.7); } catch {}
  const abData = results.output.data;

  const labCanvas = document.createElement('canvas');
  labCanvas.width = S; labCanvas.height = S;
  const labCtx = labCanvas.getContext('2d');
  const labImage = labCtx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const idx = y * S + x;
      const [r, g, b2] = labToRgb(input[idx] * 100, abData[idx] * 255 - 128, abData[idx + S * S] * 255 - 128);
      labImage.data[idx * 4] = r; labImage.data[idx * 4 + 1] = g;
      labImage.data[idx * 4 + 2] = b2; labImage.data[idx * 4 + 3] = 255;
    }
  }
  labCtx.putImageData(labImage, 0, 0);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = w; outCanvas.height = h;
  outCanvas.getContext('2d').drawImage(labCanvas, 0, 0, w, h);
  labCanvas.width = labCanvas.height = 0;
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
  const log = (...a) => { try { (ctx.log || console.log)('[colorize]', ...a); } catch {} };

  page.optionsEl.innerHTML = `
    <p class="muted" style="font-size:12px;margin:0">100% local — DeOldify quantized (MIT) via ONNX Runtime Web. First run downloads a ~35 MB model, cached on-device. Best on grayscale photos; files never leave your device.</p>
    <div data-slot="comparison"></div>`;
  const comparisonSlot = page.optionsEl.querySelector('[data-slot="comparison"]');
  let sliderCleanup = null;
  let current = [];

  page.onFiles((files) => {
    current = [...(files || [])];
    if (sliderCleanup) { try { sliderCleanup(); } catch {} sliderCleanup = null; }
    try { comparisonSlot.innerHTML = ''; } catch {}
  });

  page.runBtn('Colorize', async (files, api) => {
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
    const t0 = performance.now();
    api.status('Loading model…');
    api.setProgress(0.05);
    const inUrl = URL.createObjectURL(file);
    try {
      const blob = await colorizeImage(file, (f) => api.setProgress(f));
      const dt = Math.round(performance.now() - t0);
      api.clearOutput();
      const ext = blob.type === 'image/png' ? 'png' : 'jpg';
      if (typeof ctx.download === 'function') ctx.download(blob, `colorized.${ext}`, blob.type);
      else api.addDownload(blob, `colorized.${ext}`, 'Download colorized');
      const outUrl = URL.createObjectURL(blob);
      const { destroy } = mountComparisonSlider(comparisonSlot, {
        beforeSrc: inUrl,
        afterSrc: outUrl,
        beforeLabel: 'Original (B&W)',
        afterLabel: 'Colorized',
        downloadFilename: `colorized.${ext}`,
      });
      sliderCleanup = destroy;
      api.status(`Done in ${dt}ms — colorized on-device. Compare with the slider, then download.`);
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

export default { mount, colorizeImage };
