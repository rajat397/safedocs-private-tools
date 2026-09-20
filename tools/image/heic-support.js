// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/image/heic-support.js — vanilla ES module, zero upload (static-only).
// Dropzone for HEIC/HEIF/AVIF/WebP -> one PDF per batch, 100% on-device.
// Decode: HEIC/HEIF via lazy heic2any@0.0.4 (esm.sh) -> JPEG blob;
//   AVIF/WebP via createImageBitmap (+ <img> fallback) -> canvas -> JPEG.
// Embed: lazy pdf-lib@1.17.1 (esm.sh, jsdelivr/unpkg fallback) -> PDFDocument.
// Fallback: status/note message when a file cannot be decoded in this browser.
// Contract: export function mount(el, ctx) -> cleanup function.

import { shell } from '../_lib/page.js';

const TOOL_ID = 'heic-to-pdf';
const ACCEPT = 'image/heic,image/heif,image/avif,image/webp,.heic,.heif,.avif,.webp';
const HEIC2ANY_ESM = 'https://esm.sh/heic2any@0.0.4';
const PDF_LIB_ESM = 'https://esm.sh/pdf-lib@1.17.1';
const PDF_LIB_FALLBACKS = [
  'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
  'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
];
const MAX_IMAGES = 50;

function safeType(f) { return String(f?.type || '').toLowerCase(); }
function safeName(f) { return String(f?.name || '').toLowerCase(); }
function isHeic(f) {
  const t = safeType(f);
  const n = safeName(f);
  return t.includes('heic') || t.includes('heif') || t.includes('hej2k')
    || n.endsWith('.heic') || n.endsWith('.heif');
}
function kindOf(f) {
  if (isHeic(f)) return 'heic';
  const t = safeType(f);
  const n = safeName(f);
  if (t.includes('avif') || n.endsWith('.avif')) return 'avif';
  if (t.includes('webp') || n.endsWith('.webp')) return 'webp';
  return 'other';
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
        im.onerror = () => rej(new Error('could not decode image in this browser'));
        im.src = url;
      });
      return { _imgEl: img, width: img.naturalWidth, height: img.naturalHeight, close() {} };
    } finally { try { URL.revokeObjectURL(url); } catch {} }
  }
}

let heic2anyPromise = null;
function loadHeic2any() {
  if (globalThis.heic2any) return Promise.resolve(globalThis.heic2any);
  if (!heic2anyPromise) {
    heic2anyPromise = import(/* @vite-ignore */HEIC2ANY_ESM).then((m) => {
      const fn = m?.default ?? m?.heic2any ?? m;
      if (typeof fn !== 'function') throw new Error('heic2any did not export a function');
      globalThis.heic2any = fn;
      return fn;
    }).catch((e) => { heic2anyPromise = null; throw e; });
  }
  return heic2anyPromise;
}

async function loadPdfLib() {
  if (globalThis.PDFLib?.PDFDocument) return globalThis.PDFLib;
  try {
    const m = await import(/* @vite-ignore */PDF_LIB_ESM);
    const lib = m?.default ?? m;
    if (lib?.PDFDocument) { globalThis.PDFLib = lib; return lib; }
  } catch { /* fall through to UMD fallbacks */ }
  for (const src of PDF_LIB_FALLBACKS) {
    try {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = src; s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
      if (globalThis.PDFLib?.PDFDocument) return globalThis.PDFLib;
    } catch { /* try next */ }
  }
  throw new Error('Could not load pdf-lib@1.17.1 (check network).');
}

/**
 * Decode one input file to a JPEG data URL (+ dims). Pure-ish helper (DOM canvas only).
 * HEIC/HEIF -> heic2any -> JPEG blob -> bitmap -> canvas;
 * AVIF/WebP -> bitmap -> canvas. Throws with a user-facing fallback message on failure.
 */
export async function decodeToJpeg(file, { quality = 0.9 } = {}) {
  const kind = kindOf(file);
  let bytesBlob = file;
  if (kind === 'heic') {
    let convert;
    try {
      convert = await loadHeic2any();
    } catch {
      throw new Error('HEIC/HEIF unsupported here: decoder download failed (check network) — convert to JPEG/PNG first.');
    }
    let out;
    try {
      out = await convert({ blob: file, toType: 'image/jpeg', quality });
    } catch (e) {
      throw new Error('HEIC/HEIF unsupported here: could not decode this file (' + (e?.message || e) + ')');
    }
    const first = Array.isArray(out) ? out[0] : out;
    bytesBlob = first instanceof Blob ? first : new Blob([first], { type: 'image/jpeg' });
  }
  const src = bytesBlob instanceof File
    ? bytesBlob
    : new File([bytesBlob], file?.name || 'in', { type: bytesBlob?.type || file?.type || 'image/jpeg' });
  let bmp;
  try {
    bmp = await loadBitmap(src);
  } catch (e) {
    const label = kind === 'heic' ? 'HEIC/HEIF' : kind.toUpperCase();
    throw new Error(label + ' unsupported here: this browser cannot decode the image (' + (e?.message || e) + ')');
  }
  if (!bmp?.width || !bmp?.height) { try { bmp?.close?.(); } catch {} throw new Error('Could not read image dimensions.'); }
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width; canvas.height = bmp.height;
  try {
    const c2 = canvas.getContext('2d');
    if (bmp._imgEl) c2.drawImage(bmp._imgEl, 0, 0, canvas.width, canvas.height);
    else c2.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL('image/jpeg', quality);
    return { dataUrl: url, width: canvas.width, height: canvas.height };
  } finally {
    try { bmp.close?.(); } catch {}
    canvas.width = canvas.height = 0;
  }
}

export function mount(el, ctx = {}) {
  const tool = { ...(ctx.tool || {}), id: ctx.tool?.id || TOOL_ID, accept: ACCEPT, multiple: true };
  const page = shell(el, tool, ctx);
  const status = page.status;
  const setProgress = page.setProgress;
  const q = (s) => page.root.querySelector(`[data-f="${s}"]`);

  page.optionsEl.innerHTML = `
    <label>Page size
      <select data-f="size">
        <option value="fit">Fit to each image</option>
        <option value="a4">A4 (fit inside)</option>
      </select>
    </label>
    <label>JPEG quality <input type="range" data-f="q" min="0.5" max="1" step="0.05" value="0.9" /></label>
    <p class="muted" style="font-size:12px;margin:4px 0">100% local — HEIC via heic2any (lazy download), AVIF/WebP via canvas, PDF via pdf-lib.</p>`;

  let files = [];
  page.onFiles((accepted) => { files = [...accepted]; });

  function checkCaps(list) {
    try {
      if (typeof ctx.checkFiles === 'function') {
        const r = ctx.checkFiles(list, { toolId: TOOL_ID, accept: ACCEPT, multiple: true });
        if (r?.rejected?.length) {
          status('Rejected: ' + r.rejected.map((x) => `${x.file?.name || 'file'}: ${x.reason}`).join(' | '));
        }
        return r;
      }
    } catch { /* non-fatal */ }
    return null;
  }

  function saveBytes(bytes, filename, mime = 'application/pdf') {
    if (typeof ctx.download === 'function') return ctx.download(bytes, filename, mime);
    return page.addDownload(new Blob([bytes], { type: mime }), filename, `Download ${filename}`);
  }

  page.runBtn('Convert & download', async (got) => {
    try {
      files = [...(got || [])];
      if (!files.length) { status('Pick HEIC/HEIF/AVIF/WebP images first.'); return; }
      const chk = checkCaps(files);
      let useFiles = files;
      if (chk) {
        if (chk.accepted?.length) useFiles = chk.accepted;
        else return;
      }
      const bad = useFiles.filter((f) => kindOf(f) === 'other');
      if (bad.length) {
        status('Unsupported type: ' + bad.map((f) => f?.name || 'file').join(', ')
          + ' — this tool takes HEIC/HEIF/AVIF/WebP only.');
        return;
      }
      if (useFiles.length > MAX_IMAGES) {
        status(`Page-count guard: ${useFiles.length} images (cap ${MAX_IMAGES}). Reduce the batch.`);
        return;
      }
      const quality = Math.min(1, Math.max(0.5, +(q('q')?.value || 0.9)));
      const fitA4 = q('size')?.value === 'a4';
      status('Loading pdf-lib…');
      const { PDFDocument } = await loadPdfLib();
      const out = await PDFDocument.create();
      const A4 = [595.28, 841.89];
      let done = 0;
      const failures = [];
      for (const f of useFiles) {
        status(`Embedding ${f.name || kindOf(f)}… (${done + 1}/${useFiles.length})`);
        try {
          const { dataUrl, width, height } = await decodeToJpeg(f, { quality });
          const img = await out.embedJpg(dataUrl);
          if (fitA4) {
            const p = out.addPage(A4);
            const s = Math.min(A4[0] / img.width, A4[1] / img.height);
            const w = img.width * s, hgt = img.height * s;
            p.drawImage(img, { x: (A4[0] - w) / 2, y: (A4[1] - hgt) / 2, width: w, height: hgt });
          } else {
            const p = out.addPage([width || img.width, height || img.height]);
            p.drawImage(img, { x: 0, y: 0, width: width || img.width, height: height || img.height });
          }
        } catch (e) {
          failures.push(`${f?.name || 'file'}: ${e?.message || e}`);
        }
        done += 1;
        setProgress(done / useFiles.length);
      }
      if (done - failures.length === 0) {
        status('Failed: ' + (failures[0] || 'no image could be decoded in this browser.'));
        if (failures.length > 1) page.note(failures.map((x) => `<div>${String(x).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</div>`).join(''));
        return;
      }
      saveBytes(await out.save({ useObjectStreams: true }), 'heic-images.pdf', 'application/pdf');
      status(failures.length
        ? `Done — ${done - failures.length}/${done} image(s) → PDF. Skipped: ${failures.join(' | ')}`
        : `Done — ${useFiles.length} image(s) → PDF.`);
    } catch (e) { status('Error: ' + (e?.message || e)); }
  });

  return () => {
    files = [];
    heic2anyPromise = null;
    page.cleanup();
  };
}

export default { mount, decodeToJpeg };
