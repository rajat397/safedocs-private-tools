// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava. Source-available - see /LICENSE. Commercial use requires permission: rajat242003@gmail.com.
/**
 * tools/image-bgremove/index.js — AI Background Removal (BEN2-ONNX via Transformers.js v4)
 * 100% on-device, zero upload. Apache-2.0 licensed model.
 * Contract: export function mount(el, ctx) -> cleanup function (7-step shell).
 */
import { shell } from '../_lib/page.js';
import { loadModel, releaseModel } from '../../core/model-loader.js';
import { mountComparisonSlider } from '../../ui/comparison-slider.js';

const TOOL_ID = 'image-bgremove';
const ACCEPT = 'image/jpeg,image/png,image/webp';
const MODEL_PIN = 'ben2-onnx';

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

/** Pure-ish helper (needs DOM canvas): remove background -> PNG with alpha. */
export async function removeBackground(blob, onProgress) {
  const file = blob instanceof File ? blob : new File([blob], 'in', { type: blob?.type || 'image/png' });
  const bmp = await loadBitmap(file);
  const w = bmp.width;
  const h = bmp.height;

  const loaded = await loadModel(MODEL_PIN, {
    onProgress: (ld, total) => { try { onProgress?.(total ? ld / total : 0.1); } catch {} },
    onLog: (msg) => console.log('[bgremove]', msg),
  });
  const { model, processor } = loaded.module;

  const canvas = drawToCanvas(bmp, w, h);
  if (bmp.close) { try { bmp.close(); } catch {} }
  const inputTensor = await processor(canvas);
  try { onProgress?.(0.3); } catch {}

  const output = await model(inputTensor);
  try { onProgress?.(0.7); } catch {}

  const mask = output[0];
  const maskData = mask.data;
  const maskW = mask.dims[mask.dims.length - 1];
  const maskH = mask.dims[mask.dims.length - 2];

  const outCanvas = document.createElement('canvas');
  outCanvas.width = w; outCanvas.height = h;
  const outCtx = outCanvas.getContext('2d');
  outCtx.drawImage(canvas, 0, 0);
  const imageData = outCtx.getImageData(0, 0, w, h);
  const pixels = imageData.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const mx = Math.min(Math.floor((x * maskW) / w), maskW - 1);
      const my = Math.min(Math.floor((y * maskH) / h), maskH - 1);
      pixels[(y * w + x) * 4 + 3] = Math.round(maskData[my * maskW + mx] * 255);
    }
  }
  outCtx.putImageData(imageData, 0, 0);
  canvas.width = canvas.height = 0;
  try { onProgress?.(0.9); } catch {}
  const out = await canvasToBlob(outCanvas, 'image/png', 1.0);
  outCanvas.width = outCanvas.height = 0;
  try { onProgress?.(1.0); } catch {}
  return out;
}

export async function mount(el, ctx = {}) {
  const tool = (ctx && ctx.tool) || { id: TOOL_ID, accept: ACCEPT, multiple: false };
  const page = shell(el, tool, ctx);
  const log = (...a) => { try { (ctx.log || console.log)('[bgremove]', ...a); } catch {} };

  page.optionsEl.innerHTML = `
    <p class="muted" style="font-size:12px;margin:0">100% local — BEN2-ONNX (Apache-2.0) via Transformers.js. First run downloads the model once (~44–88 MB), then it is cached on-device (OPFS). Files never leave your device.</p>
    <div data-slot="comparison"></div>`;
  const comparisonSlot = page.optionsEl.querySelector('[data-slot="comparison"]');
  let sliderCleanup = null;
  let current = [];

  page.onFiles((files) => {
    current = [...(files || [])];
    if (sliderCleanup) { try { sliderCleanup(); } catch {} sliderCleanup = null; }
    try { comparisonSlot.innerHTML = ''; } catch {}
  });

  page.runBtn('Remove background', async (files, api) => {
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
      const blob = await removeBackground(file, (f) => api.setProgress(f));
      const dt = Math.round(performance.now() - t0);
      api.clearOutput();
      if (typeof ctx.download === 'function') ctx.download(blob, 'no-bg.png', 'image/png');
      else api.addDownload(blob, 'no-bg.png', 'Download PNG');
      const outUrl = URL.createObjectURL(blob);
      const { destroy } = mountComparisonSlider(comparisonSlot, {
        beforeSrc: inUrl,
        afterSrc: outUrl,
        beforeLabel: 'Original',
        afterLabel: 'Background removed',
        downloadFilename: 'no-bg.png',
      });
      sliderCleanup = destroy;
      api.status(`Done in ${dt}ms — background removed on-device. Open the result and check edges before sharing.`);
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

export default { mount, removeBackground };
