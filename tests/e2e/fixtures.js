// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Shared P1 E2E fixtures: tool lists, corpus map, zero-upload guard.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// All 34 tools in core/registry.js order (smoke "34x3" = 34 tools x 3 browsers).
export const TOOLS_34 = [
  'pdf-merge', 'split', 'compress', 'images-to-pdf', 'pdf-to-images',
  'protect', 'scrub', 'watermark', 'pagenum', 'flatten', 'reorder',
  'image-convert', 'image-exif', 'image-compress', 'pii-mask', 'ocr',
  'video-gif', 'sign', 'zip', 'pdf-rotate', 'pdf-add-remove-pages',
  'pdf-extract-pages', 'pdf-target-size', 'pdf-grayscale', 'text-to-pdf',
  'pdf-to-text', 'pdf-unlock-view', 'pdf-redact-burn',
  'pdf-metadata-edit', 'pdf-split-by-size', 'pdf-crop',
  'pdf-extract-images', 'pdf-remove-annotations', 'pdf-n-up',
];

// 25 tools that accept PDFs (deep "25x7" = 25 tools x 7 corpus files).
// Excluded: images-to-pdf/image-*/pii-mask/video-gif/zip/text-to-pdf (non-PDF
// inputs) and ocr (scan pipeline covered separately).
export const PDF_TOOLS_25 = [
  'pdf-merge', 'split', 'compress', 'pdf-to-images', 'protect', 'scrub',
  'watermark', 'pagenum', 'flatten', 'reorder', 'sign', 'pdf-rotate',
  'pdf-add-remove-pages', 'pdf-extract-pages', 'pdf-target-size',
  'pdf-grayscale', 'pdf-to-text', 'pdf-unlock-view', 'pdf-redact-burn',
  'pdf-metadata-edit', 'pdf-split-by-size', 'pdf-crop',
  'pdf-extract-images', 'pdf-remove-annotations', 'pdf-n-up',
];

export const CORPUS_7 = [
  'small-1p.pdf', 'medium-20p.pdf', 'large-168p.pdf', 'encrypted.pdf',
  'corrupt.pdf', 'image-scan.pdf', 'form.pdf',
];

export const corpusPath = (name) => path.join(here, 'corpus', name);

const UPLOAD_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Fail the test on any upload-shaped request (POST/PUT with a body).
 * GETs (tool chunks, pinned CDN libs, data:) always pass through.
 * Returns the violations array for custom assertions.
 */
export async function installZeroUploadGuard(page, testInfo) {
  const violations = [];
  page.on('request', (req) => {
    const method = req.method().toUpperCase();
    if (UPLOAD_METHODS.has(method)) {
      const url = req.url();
      // Same-origin service-worker POSTs must not exist in this app either.
      violations.push(`${method} ${url}`);
    }
  });
  page.__uploadViolations = violations;
  return violations;
}

export function expectZeroUploads(violations) {
  if (violations.length) {
    throw new Error(`zero-upload violated: ${violations.join(' | ')}`);
  }
}

export const CDN_HOSTS = ['esm.sh', 'cdn.jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare.com'];
