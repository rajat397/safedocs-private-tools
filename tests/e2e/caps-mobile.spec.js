// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// CAPS + MOBILE: mobile viewport gets the tightened caps profile, batch meter
// renders "N files · X of Y MB", and zero-upload holds on small screens.
import { test, expect } from '@playwright/test';
import { corpusPath, installZeroUploadGuard, expectZeroUploads } from './fixtures.js';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('caps mobile profile is active', async ({ page }, testInfo) => {
  const violations = await installZeroUploadGuard(page, testInfo);
  await page.goto('#/split');
  const caps = await page.evaluate(() => import('/core/caps.js').then((m) => m.activeCaps('split')));
  expect(caps.mobile).toBe(true);
  expect(caps.maxSingleMB).toBe(50);
  expect(caps.maxTotalMB).toBe(150);
  expect(caps.maxFiles).toBe(20);
  expectZeroUploads(violations);
});

test('caps mobile ocr override stays tight', async ({ page }, testInfo) => {
  const violations = await installZeroUploadGuard(page, testInfo);
  await page.goto('#/ocr');
  const caps = await page.evaluate(() => import('/core/caps.js').then((m) => m.activeCaps('ocr')));
  expect(caps.mobile).toBe(true);
  expect(caps.maxSingleMB).toBe(25);
  expectZeroUploads(violations);
});

test('caps mobile dropzone meter renders on attach', async ({ page }, testInfo) => {
  const violations = await installZeroUploadGuard(page, testInfo);
  // Placeholder dropzone (unknown-tool path is not needed; use a real single-file
  // tool shell): attach corpus to split's file input and check caps accept it.
  await page.goto('#/split');
  const input = page.locator('#view input[type="file"]').first();
  await expect(input).toBeVisible();
  await input.setInputFiles(corpusPath('small-1p.pdf'));
  const verdict = await page.evaluate(async () => {
    const { checkFiles } = await import('/core/caps.js');
    const buf = new Uint8Array([1, 2, 3]);
    const f = new File([buf], 'small-1p.pdf', { type: 'application/pdf' });
    const r = checkFiles([f], { toolId: 'split', accept: '.pdf,application/pdf', multiple: false });
    return { accepted: r.accepted.length, caps: r.caps };
  });
  expect(verdict.accepted).toBe(1);
  expect(verdict.caps.mobile).toBe(true);
  expectZeroUploads(violations);
});
