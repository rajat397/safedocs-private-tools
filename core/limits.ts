// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava. Source-available - see /LICENSE. Commercial use requires permission: rajat242003@gmail.com.

export const DESKTOP_MAX_FILE_SIZE = 200 * 1024 * 1024;
export const MOBILE_MAX_FILE_SIZE = 50 * 1024 * 1024;
export const DESKTOP_MAX_BATCH_FILES = 50;
export const MOBILE_MAX_BATCH_FILES = 20;
export const DESKTOP_MAX_PAGES = 500;
export const MOBILE_MAX_PAGES = 100;

export interface Limits {
  maxFileSize: number;
  maxBatchFiles: number;
  maxPages: number;
}

export function getLimits(isMobile: boolean): Limits {
  return {
    maxFileSize: isMobile ? MOBILE_MAX_FILE_SIZE : DESKTOP_MAX_FILE_SIZE,
    maxBatchFiles: isMobile ? MOBILE_MAX_BATCH_FILES : DESKTOP_MAX_BATCH_FILES,
    maxPages: isMobile ? MOBILE_MAX_PAGES : DESKTOP_MAX_PAGES,
  };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[unitIndex]}`;
}

export function renderLimitBadge(limits: Limits, current: { files?: number; bytes?: number; pages?: number }): string {
  const fileCount = current.files ?? 0;
  const byteCount = current.bytes ?? 0;
  const pageCount = current.pages ?? 0;

  const fileFrac = limits.maxBatchFiles > 0 ? Math.max(0, Math.min(1, fileCount / limits.maxBatchFiles)) : 0;
  const byteFrac = limits.maxFileSize > 0 ? Math.max(0, Math.min(1, byteCount / limits.maxFileSize)) : 0;
  const pageFrac = limits.maxPages > 0 ? Math.max(0, Math.min(1, pageCount / limits.maxPages)) : 0;

  const maxFrac = Math.max(fileFrac, byteFrac, pageFrac);
  const percent = Math.round(maxFrac * 100);

  const fileLabel = `${fileCount} / ${limits.maxBatchFiles} files`;
  const byteLabel = `${formatBytes(byteCount)} / ${formatBytes(limits.maxFileSize)}`;
  const pageLabel = `${pageCount} / ${limits.maxPages} pages`;

  return `
<div class="limit-badge" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100" aria-label="Usage: ${percent}%">
  <div class="limit-badge__bar" style="width: ${percent}%"></div>
  <div class="limit-badge__labels">
    <span>${fileLabel}</span>
    <span>${byteLabel}</span>
    <span>${pageLabel}</span>
  </div>
</div>`.trim();
}