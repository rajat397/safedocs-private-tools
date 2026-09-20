// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava. Source-available - see /LICENSE. Commercial use requires permission: rajat242003@gmail.com.
/**
 * vendor/cdn-pins.js — Pinned CDN manifest for all heavy dependencies.
 * Every heavy lib in tools/* lazy-loads from these pinned CDNs at first use,
 * then caches (module singleton / globalThis / OPFS / IDB).
 * This file exists so pins live in ONE place. It performs zero fetches.
 */

export const PINS = {
  // Existing pins
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

  // NEW: Image Tools MVP pins
  'ben2-onnx': {
    version: '1.0.0',
    usedBy: 'tools/image-bgremove',
    license: 'Apache-2.0',
    esm: [
      'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.4.0/dist/transformers.min.js',
      'https://unpkg.com/@huggingface/transformers@3.4.0/dist/transformers.min.js',
    ],
    model: {
      id: 'prithivMLmods/BEN2-ONNX',
      revision: 'main',
      files: ['model_q8.onnx', 'config.json', 'preprocessor_config.json'],
      approxSize: '~44-88 MB (int8 quantized)',
      cacheStrategy: 'opfs',
    },
    requires: ['wasm-simd'],
    approxSize: '~44-88 MB (model) + ~2 MB (transformers.js)',
  },

  'realcugan': {
    version: '1.0.0',
    usedBy: 'tools/image-upscale',
    license: 'Apache-2.0',
    esm: [
      'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js',
      'https://unpkg.com/@tensorflow/tfjs@4.22.0/dist/tf.min.js',
    ],
    backend: [
      'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-webgl@4.22.0/dist/tf-backend-webgl.min.js',
      'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-webgpu@4.22.0/dist/tf-backend-webgpu.min.js',
    ],
    models: {
      '2x': {
        url: 'https://raw.githubusercontent.com/xororz/web-realesrgan/main/models/realcugan/2x-conservative-64/model.json',
        size: '2.6 MB',
      },
      '4x': {
        url: 'https://raw.githubusercontent.com/xororz/web-realesrgan/main/models/realcugan/4x-conservative-64/model.json',
        size: '2.9 MB',
      },
    },
    cacheStrategy: 'opfs',
    requires: ['webgl2'],
    approxSize: '~3 MB (model) + ~1 MB (tfjs)',
  },

  'deoldify-quant': {
    version: '1.0.0',
    usedBy: 'tools/image-colorize',
    license: 'MIT',
    esm: [
      'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.min.js',
      'https://unpkg.com/onnxruntime-web@1.20.1/dist/ort.min.js',
    ],
    model: {
      url: 'https://huggingface.co/linmingren/openmodels/resolve/main/models/deoldify/deoldify.quant.onnx',
      approxSize: '~35 MB (quantized)',
      cacheStrategy: 'opfs',
    },
    requires: ['wasm-simd'],
    approxSize: '~35 MB (model) + ~1 MB (ort)',
  },

  'vtracer': {
    version: '0.6.0',
    usedBy: 'tools/image-vectorize',
    license: 'Apache-2.0',
    esm: [
      'https://cdn.jsdelivr.net/npm/vtracer-wasm@0.6.0/dist/vtracer-wasm.min.js',
      'https://unpkg.com/vtracer-wasm@0.6.0/dist/vtracer-wasm.min.js',
    ],
    wasm: [
      'https://cdn.jsdelivr.net/npm/vtracer-wasm@0.6.0/dist/vtracer_bg.wasm',
      'https://unpkg.com/vtracer-wasm@0.6.0/dist/vtracer_bg.wasm',
    ],
    cacheStrategy: 'opfs',
    requires: ['wasm-simd'],
    approxSize: '~1.5 MB (WASM)',
  },

  // Converter pins
  docx: {
    version: '8.5.0',
    usedBy: 'tools/convert (docx export)',
    esm: ['https://esm.sh/docx@8.5.0'],
    umd: [
      'https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js',
      'https://unpkg.com/docx@8.5.0/build/index.umd.js',
    ],
    approxSize: '~300KB (cached on module singleton)',
  },
  xlsx: {
    version: '0.18.5',
    usedBy: 'tools/convert (xlsx export)',
    license: 'Apache-2.0',
    esm: ['https://esm.sh/xlsx@0.18.5'],
    umd: [
      'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
      'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js',
    ],
    approxSize: '~900KB (cached on globalThis.XLSX)',
  },
  pptxgenjs: {
    version: '3.12.0',
    usedBy: 'tools/convert (pptx export)',
    esm: ['https://esm.sh/pptxgenjs@3.12.0'],
    umd: [
      'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js',
      'https://unpkg.com/pptxgenjs@3.12.0/dist/pptxgen.bundle.js',
    ],
    approxSize: '~500KB (cached on globalThis.PptxGenJS)',
  },
  heic2any: {
    version: '0.0.4',
    usedBy: 'tools/convert (heic input)',
    license: 'MIT',
    esm: ['https://esm.sh/heic2any@0.0.4'],
    umd: [
      'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js',
      'https://unpkg.com/heic2any@0.0.4/dist/heic2any.min.js',
    ],
    approxSize: '~300KB (cached on globalThis.heic2any)',
  },
};

export default { PINS };