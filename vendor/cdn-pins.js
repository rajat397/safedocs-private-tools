// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava. Source-available - see /LICENSE. Commercial use requires permission: rajat242003@gmail.com.
// vendor/cdn-pins.js — STUB manifest only. No vendored code, no heavy imports.
// Every heavy lib in tools/ocr|video|sign|zip lazy-loads from these pinned
// CDNs at first use, then caches (module singleton / globalThis / IDB).
// This file exists so pins live in ONE place. It performs zero fetches.

export const PINS = {
  'tesseract.js': {
    version: '7',
    usedBy: 'tools/ocr',
    esm: [
      'https://cdn.jsdelivr.net/npm/tesseract.js@7/dist/tesseract.esm.min.js',
      'https://unpkg.com/tesseract.js@7/dist/tesseract.esm.min.js',
    ],
    assets: 'traineddata lang packs (eng, hin) — GET once, cacheMethod:write',
    approxSize: '~3MB js + ~12MB eng + ~4MB hin (cached)',
  },
  gifenc: {
    version: '1.0.3',
    usedBy: 'tools/video (primary encode)',
    esm: ['https://esm.sh/gifenc@1.0.3'],
    approxSize: '~30KB',
  },
  '@ffmpeg/ffmpeg': {
    version: '0.12.1',
    usedBy: 'tools/video (OPT-IN fallback only)',
    esm: ['https://esm.sh/@ffmpeg/ffmpeg@0.12.1'],
    approxSize: '~25MB — gated behind explicit user consent, never auto-loaded',
  },
  'pdf-lib': {
    version: '1.17.1',
    usedBy: 'tools/sign (embed) — same pin as tools/pdf',
    esm: ['https://esm.sh/pdf-lib@1.17.1'],
    umd: [
      'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
      'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
    ],
    approxSize: '~600KB (cached on globalThis.PDFLib)',
  },
  jszip: {
    version: '3.10.1',
    usedBy: 'tools/zip',
    esm: ['https://esm.sh/jszip@3.10.1'],
    umd: ['https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'],
    approxSize: '~100KB',
  },
  'pdf.js': {
    version: '3.11.174',
    usedBy: 'tools/pdf',
    license: 'Apache-2.0',
    umd: [
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
    ],
    worker: [
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
    ],
    approxSize: '~1MB (cached on globalThis.pdfjsLib)',
  },
};

export default { PINS };
