// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava. Source-available - see /LICENSE. Commercial use requires permission: rajat242003@gmail.com.
/**
 * tools/image-vectorize/index.js — Vectorization (VTracer WASM)
 * 100% on-device, zero upload. Apache-2.0 licensed.
 * Contract: export function mount(el, ctx) -> cleanup function (7-step shell).
 */
import { shell } from '../_lib/page.js';
import { loadModel, releaseModel } from '../../core/model-loader.js';
import { mountComparisonSlider } from '../../ui/comparison-slider.js';

const TOOL_ID = 'image-vectorize';
const ACCEPT = 'image/jpeg,image/png,image/webp';
const MODEL_PIN = 'vtracer';

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

/** Pure-ish helper (needs DOM canvas): vectorize -> SVG Blob. */
export async function vectorizeImage(blob, options, onProgress) {
  const o = options || {};
  const file = blob instanceof File ? blob : new File([blob], 'in', { type: blob?.type || 'image/png' });
  const bmp = await loadBitmap(file);
  const w = bmp.width;
  const h = bmp.height;

  const loaded = await loadModel(MODEL_PIN, {
    onProgress: (ld, total) => { try { onProgress?.(total ? (ld / total) * 0.3 : 0.1); } catch {} },
    onLog: (msg) => console.log('[vectorize]', msg),
  });
  const { vtracer } = loaded.module;
  try { onProgress?.(0.3); } catch {}

  const canvas = drawToCanvas(bmp, w, h);
  if (bmp.close) { try { bmp.close(); } catch {} }
  const pixels = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  const rgba = new Uint8Array(pixels.buffer.slice(0));
  canvas.width = canvas.height = 0;
  try { onProgress?.(0.5); } catch {}

  const svgString = vtracer.convertImageToSVG(rgba, w, h, {
    colorMode: o.colorMode === 'binary' ? 'binary' : 'color',
    hierarchical: o.hierarchical === 'cutout' ? 'cutout' : 'stacked',
    mode: o.mode === 'polygon' ? 'polygon' : 'spline',
    filterSpeckle: Number.isFinite(+o.filterSpeckle) ? +o.filterSpeckle : 4,
    colorPrecision: Number.isFinite(+o.colorPrecision) ? +o.colorPrecision : 6,
    layerDifference: 16,
    cornerThreshold: 60,
    lengthThreshold: 4.0,
    maxIterations: 10,
    spliceThreshold: 45,
    pathPrecision: 8,
  });
  try { onProgress?.(0.8); } catch {}
  const out = new Blob([svgString], { type: 'image/svg+xml' });
  try { onProgress?.(1.0); } catch {}
  return out;
}

export async function mount(el, ctx = {}) {
  const tool = (ctx && ctx.tool) || { id: TOOL_ID, accept: ACCEPT, multiple: false };
  const page = shell(el, tool, ctx);
  const log = (...a) => { try { (ctx.log || console.log)('[vectorize]', ...a); } catch {} };

  page.optionsEl.innerHTML = `
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:end">
      <label style="display:grid;gap:4px;font-size:13px;font-weight:600">Mode
        <select data-f="mode" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px">
          <option value="spline">Spline (curves)</option>
          <option value="polygon">Polygon (straight)</option>
        </select>
      </label>
      <label style="display:grid;gap:4px;font-size:13px;font-weight:600">Color
        <select data-f="colorMode" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px">
          <option value="color">Color</option>
          <option value="binary">Binary (B&W)</option>
        </select>
      </label>
      <label style="display:grid;gap:4px;font-size:13px;font-weight:600">Hierarchical
        <select data-f="hierarchical" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px">
          <option value="stacked">Stacked</option>
          <option value="cutout">Cutout</option>
        </select>
      </label>
      <label style="display:grid;gap:4px;font-size:13px;font-weight:600">Filter speckle
        <input type="number" min="0" max="100" value="4" data-f="filterSpeckle" style="width:90px;padding:8px;border:1px solid #e2e8f0;border-radius:8px" />
      </label>
      <label style="display:grid;gap:4px;font-size:13px;font-weight:600">Color precision
        <input type="number" min="1" max="8" value="6" data-f="colorPrecision" style="width:90px;padding:8px;border:1px solid #e2e8f0;border-radius:8px" />
      </label>
    </div>
    <p class="muted" style="font-size:12px;margin:0">100% local — VTracer (Apache-2.0) WASM (~1.5 MB). Best on logos and flat graphics; files never leave your device.</p>
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

  page.runBtn('Vectorize', async (files, api) => {
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
    api.status('Loading module…');
    api.setProgress(0.05);
    const inUrl = URL.createObjectURL(file);
    try {
      const blob = await vectorizeImage(file, {
        colorMode: q('colorMode')?.value,
        hierarchical: q('hierarchical')?.value,
        mode: q('mode')?.value,
        filterSpeckle: q('filterSpeckle')?.value,
        colorPrecision: q('colorPrecision')?.value,
      }, (f) => api.setProgress(f));
      const dt = Math.round(performance.now() - t0);
      api.clearOutput();
      if (typeof ctx.download === 'function') ctx.download(blob, 'vectorized.svg', 'image/svg+xml');
      else api.addDownload(blob, 'vectorized.svg', 'Download SVG');
      const svgText = await blob.text();
      const svgUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgText)));
      const { destroy } = mountComparisonSlider(comparisonSlot, {
        beforeSrc: inUrl,
        afterSrc: svgUrl,
        beforeLabel: 'Original',
        afterLabel: 'Vectorized (SVG)',
        downloadFilename: 'vectorized.svg',
      });
      sliderCleanup = destroy;
      api.status(`Done in ${dt}ms — vectorized on-device (${(blob.size / 1024).toFixed(1)} KB SVG).`);
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

export default { mount, vectorizeImage };
