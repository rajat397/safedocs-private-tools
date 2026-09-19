// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava. Source-available - see /LICENSE. Commercial use requires permission: rajat242003@gmail.com.
/**
 * Tool registry — the single source of truth for the toolbox grid + router.
 * Tool implementations live under tools/ (owned by other builders) and are
 * loaded lazily via import(). This file is metadata only: no tool code,
 * no file bytes, safe to precache.
 */

export const TOOLS = [
  { id: 'pdf-merge', name: 'Merge PDFs', desc: 'Combine PDFs into one, reorder pages.', cat: 'PDF', accept: '.pdf,application/pdf', multiple: true, keywords: ['merge', 'combine', 'join', 'stitch', 'append', 'join pdfs', 'combine pdfs'], synonyms: ['join pdfs', 'combine pdfs', 'merge pdfs', 'stitch pdfs', 'append pdfs'] },
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
  { id: 'pdf-rotate', name: 'Rotate PDF', desc: 'Rotate pages 90° / 180°, fix sideways scans.', cat: 'Organize', accept: '.pdf,application/pdf', multiple: false, keywords: ['rotate', 'orientation', 'turn', 'sideways', 'landscape', 'portrait'], synonyms: ['turn pdf', 'rotate pages', 'fix orientation'] },
  { id: 'pdf-add-remove-pages', name: 'Add / Remove pages', desc: 'Insert blank pages or delete unwanted pages.', cat: 'Organize', accept: '.pdf,application/pdf', multiple: false, keywords: ['add', 'remove', 'delete', 'insert', 'blank', 'pages'], synonyms: ['delete pages', 'insert pages', 'add blank page'] },
  { id: 'pdf-extract-pages', name: 'Extract pages', desc: 'Save selected pages as a new PDF.', cat: 'Organize', accept: '.pdf,application/pdf', multiple: false, keywords: ['extract', 'split', 'select', 'range', 'pages'], synonyms: ['extract page', 'save pages', 'pull pages out'] },
  { id: 'pdf-target-size', name: 'PDF to target size', desc: 'Compress PDF down to a target KB / MB size.', cat: 'Compress', accept: '.pdf,application/pdf', multiple: false, keywords: ['target', 'size', 'compress', 'shrink', 'kb', 'mb'], synonyms: ['shrink to size', 'compress to kb', 'reduce file size'] },
  { id: 'pdf-grayscale', name: 'Grayscale PDF', desc: 'Convert PDF to black & white for print / ink saving.', cat: 'Compress', accept: '.pdf,application/pdf', multiple: false, keywords: ['grayscale', 'grey', 'gray', 'bw', 'black and white', 'ink'], synonyms: ['black and white', 'convert to gray', 'b&w pdf'] },
  { id: 'text-to-pdf', name: 'Text → PDF', desc: 'Turn .txt / .md text into a PDF.', cat: 'Convert', accept: '.txt,.md,.csv,text/plain', multiple: false, keywords: ['text', 'txt', 'markdown', 'md', 'to pdf', 'create'], synonyms: ['txt to pdf', 'md to pdf', 'make pdf from text'] },
  { id: 'pdf-to-text', name: 'PDF → Text', desc: 'Extract selectable text from a PDF to .txt.', cat: 'Convert', accept: '.pdf,application/pdf', multiple: false, keywords: ['extract text', 'to text', 'txt', 'selectable', 'copy'], synonyms: ['pdf to txt', 'get text out', 'extract words'] },
  { id: 'pdf-unlock-view', name: 'Unlock / View PDF', desc: 'Open password-protected PDFs you own for viewing.', cat: 'Security', accept: '.pdf,application/pdf', multiple: false, keywords: ['unlock', 'decrypt', 'password', 'remove password', 'view'], synonyms: ['decrypt pdf', 'remove password', 'open locked pdf'] },
  { id: 'pdf-redact-burn', name: 'Redact & burn', desc: 'Permanently black-out text regions (burned in, not overlay).', cat: 'Security', accept: '.pdf,application/pdf', multiple: false, keywords: ['redact', 'burn', 'black out', 'permanent', 'censor', 'privacy'], synonyms: ['black out text', 'burn redactions', 'permanent redact'] },
  { id: 'pdf-metadata-edit', name: 'Edit metadata', desc: 'View & edit PDF title, author, keywords (info dictionary).', cat: 'PDF', accept: '.pdf,application/pdf', multiple: false, keywords: ['metadata', 'info', 'title', 'author', 'keywords', 'exif', 'properties'], synonyms: ['edit metadata', 'pdf info', 'change title', 'pdf properties'] },
  { id: 'pdf-split-by-size', name: 'Split by size', desc: 'Split a PDF into parts each under a target MB size.', cat: 'PDF', accept: '.pdf,application/pdf', multiple: false, keywords: ['split', 'size', 'chunk', 'parts', 'mb', 'divide'], synonyms: ['split by size', 'divide pdf', 'chunk pdf'] },
  { id: 'pdf-crop', name: 'Crop PDF', desc: 'Trim page margins via CropBox (vector, reversible).', cat: 'PDF', accept: '.pdf,application/pdf', multiple: false, keywords: ['crop', 'trim', 'margin', 'margins', 'cut', 'cropbox'], synonyms: ['crop pdf', 'trim margins', 'cut margins'] },
  { id: 'pdf-extract-images', name: 'Extract images', desc: 'Save embedded JPEG images from a PDF, no re-encode.', cat: 'PDF', accept: '.pdf,application/pdf', multiple: false, keywords: ['extract', 'images', 'pictures', 'photos', 'jpeg', 'jpg', 'embedded'], synonyms: ['extract images', 'get pictures out', 'save images'] },
  { id: 'pdf-remove-annotations', name: 'Remove annotations', desc: 'Strip comments, links & markup; keeps page text.', cat: 'PDF', accept: '.pdf,application/pdf', multiple: false, keywords: ['annotations', 'comments', 'markup', 'links', 'notes', 'highlight', 'strip'], synonyms: ['remove comments', 'strip annotations', 'delete markup'] },
  { id: 'pdf-n-up', name: 'N-up PDF', desc: 'Combine 2 or 4 pages per sheet for printing.', cat: 'PDF', accept: '.pdf,application/pdf', multiple: false, keywords: ['n-up', 'nup', '2-up', '4-up', 'impose', 'imposition', 'booklet', 'sheet', 'print'], synonyms: ['2 up', '4 up', 'pages per sheet', 'impose pdf'] },
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
 * MVP-1 T01 additions (all under tools/pdf/ to avoid new dirs):
 *   tools/pdf/{rotate,add-remove-pages,extract-pages,target-size,
 *     grayscale,text-to-pdf,to-text,unlock-view,redact-burn}.js
 * P3A additions (pdf-lib only, same dir):
 *   tools/pdf/{metadata-edit,split-by-size,crop,extract-images,
 *     remove-annotations,n-up}.js
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
  'pdf-rotate': './tools/pdf/rotate.js',
  'pdf-add-remove-pages': './tools/pdf/add-remove-pages.js',
  'pdf-extract-pages': './tools/pdf/extract-pages.js',
  'pdf-target-size': './tools/pdf/target-size.js',
  'pdf-grayscale': './tools/pdf/grayscale.js',
  'text-to-pdf': './tools/pdf/text-to-pdf.js',
  'pdf-to-text': './tools/pdf/to-text.js',
  'pdf-unlock-view': './tools/pdf/unlock-view.js',
  'pdf-redact-burn': './tools/pdf/redact-burn.js',
  'pdf-metadata-edit': './tools/pdf/metadata-edit.js',
  'pdf-split-by-size': './tools/pdf/split-by-size.js',
  'pdf-crop': './tools/pdf/crop.js',
  'pdf-extract-images': './tools/pdf/extract-images.js',
  'pdf-remove-annotations': './tools/pdf/remove-annotations.js',
  'pdf-n-up': './tools/pdf/n-up.js',
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

/**
 * Query alias → canonical term expansion so search is forgiving
 * (e.g. "decrypt" finds unlock, "bw" finds grayscale).
 * Applied as substring match: if the query contains the alias,
 * the canonical term is also matched against the tool haystack.
 * No new CDN; metadata only.
 */
const QUERY_SYNONYMS = {
  join: 'merge',
  merge: 'merge',
  combine: 'merge',
  stitch: 'merge',
  append: 'merge',
  'join pdfs': 'merge',
  'combine pdfs': 'merge',
  turn: 'rotate',
  orientation: 'rotate',
  sideways: 'rotate',
  delete: 'remove',
  drop: 'remove',
  insert: 'add',
  blank: 'add',
  pull: 'extract',
  shrink: 'compress',
  reduce: 'compress',
  smaller: 'compress',
  kb: 'target',
  mb: 'target',
  grey: 'grayscale',
  gray: 'grayscale',
  bw: 'grayscale',
  'b&w': 'grayscale',
  ink: 'grayscale',
  txt: 'text',
  markdown: 'text',
  decrypt: 'unlock',
  locked: 'unlock',
  password: 'unlock',
  censor: 'redact',
  'black out': 'redact',
  blackout: 'redact',
  burn: 'redact',
  permanent: 'redact',
  margin: 'crop',
  trim: 'crop',
  booklet: 'n-up',
  markup: 'annotations',
  comment: 'annotations',
};

export function searchTools(q) {
  const s = (q || '').trim().toLowerCase();
  if (!s) return TOOLS;
  const terms = [s];
  for (const [alias, canonical] of Object.entries(QUERY_SYNONYMS)) {
    if (s.includes(alias) && !terms.includes(canonical)) terms.push(canonical);
  }
  return TOOLS.filter((t) => {
    const hay = [
      t.id,
      t.name,
      t.desc,
      t.cat,
      ...((t.keywords || [])),
      ...((t.synonyms || [])),
    ].join(' ').toLowerCase();
    return terms.some((term) => hay.includes(term));
  });
}
