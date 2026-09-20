// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava. Source-available - see /LICENSE. Commercial use requires permission: rajat242003@gmail.com.
/**
 * tests/e2e/upscale-smoke.spec.js — E2E smoke test for AI Upscaling.
 * Mirrors smoke.spec.js 3-assert contract: heading, file entry, on-device notice.
 */
import { test, expect } from '@playwright/test';
import { installZeroUploadGuard, expectZeroUploads } from './fixtures.js';

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test.describe('image-upscale', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/image-upscale');
    await expect(page.locator('#view h2').first()).toBeVisible();
  });

  test('loads offline with heading, file entry, on-device notice', async ({ page }, testInfo) => {
    const violations = await installZeroUploadGuard(page, testInfo);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e?.message || e)));
    await page.goto('/#/image-upscale');
    await expect(page.locator('#view h2').first()).toBeVisible();
    await expect(page.locator('#view')).not.toContainText('Unknown tool');
    const entry = page.locator('#view input[type="file"], #view .dropzone');
    await expect(entry.first()).toBeVisible();
    await expect(page.locator('#view .warnbox')).toHaveCount(0);
    await expect(page.locator('#view')).toContainText(/On-device only|Accepted types/i);
    await expect(page.locator('#view form[enctype="multipart/form-data"]')).toHaveCount(0);
    expect(errors.filter((m) => !/Could not load|check network|CDN/i.test(m))).toEqual([]);
    expectZeroUploads(violations);
  });

  test('has scale selector (2x, 4x)', async ({ page }) => {
    await expect(page.locator('#view select[data-f="scale"]')).toBeVisible();
    await expect(page.locator('#view select[data-f="scale"] option[value="2"]')).toHaveCount(1);
    await expect(page.locator('#view select[data-f="scale"] option[value="4"]')).toHaveCount(1);
  });

  test('accepts an image file locally', async ({ page }) => {
    await page.locator('#view input[type="file"]').setInputFiles({
      name: 'pixel.png',
      mimeType: 'image/png',
      buffer: PNG_1PX,
    });
    await expect(page.locator('#view')).toContainText(/pixel\.png|1 file/i);
  });
});
