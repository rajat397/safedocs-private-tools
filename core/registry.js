// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava. Source-available - see /LICENSE. Commercial use requires permission: rajat242003@gmail.com.
/**
 * Tool registry — the single source of truth for the toolbox grid + router.
 * Tool implementations live under tools/ (owned by other builders) and are
 * loaded lazily via import(). This file is metadata only: no tool code,
 * no file bytes, safe to precache.
 */

export const TOOLS = [
  { id: 'pdf-merge', name: 'Merge PDFs', desc: 'Combine PDFs into one, reorder pages.', cat: 'PDF', accept: '.pdf,application/pdf', multiple: true },
  { id: 'split', name: 'Split PDF', desc: 'Extract page ranges into new PDFs.', cat: 'PDF', accept: '.pdf,application/pdf' },
  { id: 'compress', name: 'Compress PDF', desc: 'Shrink PDF size, on-device.', cat: 'PDF', accept: '.pdf,application/pdf' },
  { id: 'images-to-pdf', name: 'Images → PDF', desc: 'Turn JPG / PNG / WebP photos into a PDF.', cat: 'PDF', accept: 'image/*,.jpg,.jpeg,.png,.webp', multiple: true },
  { id: 'pdf-to-images', name: 'PDF → Images', desc: 'Export PDF pages as PNG / JPG.', cat: 'PDF', accept: '.pdf,application/pdf' },
  { id: 'protect', name: 'Protect PDF', desc: 'Password-protect a PDF (local).', cat: 'PDF', accept: '.pdf,application/pdf' },
  { id: 'scrub', name: 'Scrub metadata', desc: 'Remove hidden metadata before sharing.', cat: 'Privacy', accept: '.pdf,application/pdf' },
  { id: 'watermark', name: 'Watermark PDF', desc: 'Stamp text across every page.', cat: 'PDF', accept: '.pdf,application/pdf' },
  { id: 'pagenum', name: 'Page numbers', desc: 'Add page numbers / Bates stamps.', cat: 'PDF', accept: '.pdf,application/pdf' },
  { id: 'flatten', name: 'Flatten PDF', desc: 'Flatten forms & annotations for safe sharing.', cat: 'PDF', accept: '.pdf,application/pdf' },
  { id: 'reorder', name: 'Reorder pages', desc: 'Reorder PDF pages via order spec (e.g. 3,1,2).', cat: 'PDF', accept: '.pdf,application/pdf' },
  { id: 'image-convert', name: 'Convert images', desc: 'Convert JPG / PNG / WebP between formats.', cat: 'Image', accept: 'image/*,.jpg,.jpeg,.png,.webp' },
  { id: 'image-exif', name: 'EXIF inspector', desc: 'View & strip GPS / camera data from photos.', cat: 'Image', accept: 'image/*,.jpg,.jpeg,.png,.webp,.heic' },
  { id: 'image-compress', name: 'Compress images', desc: 'Resize & recompress JPG / PNG / WebP.', cat: 'Image', accept: 'image/*,.jpg,.jpeg,.png,.webp', multiple: true },
  { id: 'pii-mask', name: 'Mask PII', desc: 'Redact emails, phones & IDs in text files.', cat: 'Privacy', accept: '.txt,.csv,.md,text/plain' },
  { id: 'ocr', name: 'OCR (on-device)', desc: 'Extract text from scans & photos, offline.', cat: 'Scan', accept: 'image/*,.jpg,.jpeg,.png,.webp,.pdf', multiple: true },
  { id: 'video-gif', name: 'Video → GIF', desc: 'Trim & convert short clips to GIF.', cat: 'Media', accept: 'video/*,.mp4,.webm,.mov' },
  { id: 'sign', name: 'Sign PDF', desc: 'Draw or type a signature, place on pages.', cat: 'PDF', accept: '.pdf,application/pdf' },
  { id: 'zip', name: 'ZIP files', desc: 'Bundle files into a ZIP archive.', cat: 'Files', accept: '*/*', multiple: true },
];

const BY_ID = new Map(TOOLS.map((t) => [t.id, t]));

/**
 * Exact module URL per tool id — must match real files under tools/.
 * Verified against the tree (no `tool.js` placeholders exist):
 *   tools/pdf/{merge,split,compress,images-to-pdf,pdf-to-images,protect,
 *     scrub,watermark,pagenum,flatten,reorder}.js
 *   tools/image/{exif-remove,compress,convert}.js
 *   tools/pii/redact.js, tools/ocr/index.js, tools/video/index.js,
 *   tools/sign/index.js, tools/zip/index.js
 */
const MODULES = {
  'pdf-merge': './tools/pdf/merge.js',
  split: './tools/pdf/split.js',
  compress: './tools/pdf/compress.js',
  'images-to-pdf': './tools/pdf/images-to-pdf.js',
  'pdf-to-images': './tools/pdf/pdf-to-images.js',
  protect: './tools/pdf/protect.js',
  scrub: './tools/pdf/scrub.js',
  watermark: './tools/pdf/watermark.js',
  pagenum: './tools/pdf/pagenum.js',
  flatten: './tools/pdf/flatten.js',
  reorder: './tools/pdf/reorder.js',
  'image-exif': './tools/image/exif-remove.js',
  'image-compress': './tools/image/compress.js',
  'image-convert': './tools/image/convert.js',
  'pii-mask': './tools/pii/redact.js',
  ocr: './tools/ocr/index.js',
  'video-gif': './tools/video/index.js',
  sign: './tools/sign/index.js',
  zip: './tools/zip/index.js',
};

/** Exact module URL for one tool (accepts id string or tool object). */
export function moduleCandidates(tool) {
  const id = typeof tool === 'string' ? tool : tool?.id;
  const exact = MODULES[id];
  return exact ? [exact] : [];
}

export function getTool(id) {
  return BY_ID.get(id) || null;
}

export function categories() {
  return [...new Set(TOOLS.map((t) => t.cat))];
}

export function searchTools(q) {
  const s = (q || '').trim().toLowerCase();
  if (!s) return TOOLS;
  return TOOLS.filter(
    (t) => t.id.includes(s) || t.name.toLowerCase().includes(s)
      || t.desc.toLowerCase().includes(s) || t.cat.toLowerCase().includes(s),
  );
}
