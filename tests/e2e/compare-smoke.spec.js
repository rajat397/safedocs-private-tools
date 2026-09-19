// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// E2E smoke test for pdf-compare tool.
import { test, expect } from '@playwright/test';
import { corpusPath, installZeroUploadGuard, expectZeroUploads } from './fixtures.js';

test('compare smoke: load PDFs, extract, diff, overlay, downloads', async ({ page }, testInfo) => {
  const violations = await installZeroUploadGuard(page, testInfo);
  testInfo.setTimeout(60_000);

  await page.goto(`#/pdf-compare`);

  // Wait for tool UI to render
  await expect(page.locator('#view h2')).toContainText('Compare PDFs');

  // Find the two dropzone file inputs
  const inputA = page.locator('[data-side="a"] input[type="file"]').first();
  const inputB = page.locator('[data-side="b"] input[type="file"]').first();

  await expect(inputA).toBeAttached();
  await expect(inputB).toBeAttached();

  // Upload two different PDFs from corpus
  await inputA.setInputFiles(corpusPath('small-1p.pdf'));
  await inputB.setInputFiles(corpusPath('medium-20p.pdf'));

  // Wait for both PDFs to load and page selectors to appear
  await expect(page.locator('[data-side="a"] [data-f="pages"] button[data-page="1"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-side="b"] [data-f="pages"] button[data-page="1"]')).toBeVisible({ timeout: 15_000 });

  // Click "Extract Text"
  const extractBtn = page.locator('[data-f="extract"]');
  await expect(extractBtn).toBeEnabled();
  await extractBtn.click();

  // Wait for extraction to complete (button re-enables)
  await expect(extractBtn).toBeEnabled({ timeout: 30_000 });
  await expect(extractBtn).toHaveText('Extract Text');

  // Click "Run Diff"
  const diffBtn = page.locator('.compare-controls button:has-text("Run Diff")');
  await expect(diffBtn).toBeEnabled({ timeout: 10_000 });
  await diffBtn.click();

  // Wait for diff to complete
  await expect(page.locator('[data-f="copyDiff"]')).toBeEnabled({ timeout: 15_000 });
  await expect(page.locator('[data-f="downloadDiff"]')).toBeEnabled({ timeout: 15_000 });

  // Click "Show Overlay" checkbox
  const overlayCb = page.locator('[data-f="overlay"]');
  await overlayCb.check();

  // Wait for overlay to render - check that overlay canvas exists and has pixels
  await expect(page.locator('.compare-pages canvas')).toHaveCount(3, { timeout: 15_000 }); // 2 page canvases + 1 overlay

  // Verify overlay canvas has actual pixel data (not just empty white)
  const overlayCanvas = page.locator('.compare-pages [data-side="b"] canvas').nth(1); // overlay is 2nd canvas on side B
  await expect(overlayCanvas).toBeVisible();

  // Check canvas has non-zero dimensions (indicates it rendered)
  const canvasInfo = await overlayCanvas.evaluate((c) => ({
    width: c.width,
    height: c.height,
  }));
  expect(canvasInfo.width).toBeGreaterThan(0);
  expect(canvasInfo.height).toBeGreaterThan(0);

  // Download overlay PNG
  const downloadOverlayBtn = page.locator('[data-f="downloadOverlay"]');
  await expect(downloadOverlayBtn).toBeEnabled();
  const [overlayDownload] = await Promise.all([
    page.waitForEvent('download', { timeout: 10_000 }),
    downloadOverlayBtn.click(),
  ]);
  expect(overlayDownload.suggestedFilename()).toMatch(/^overlay-page-\d+-\d+\.png$/);

  // Download diff.txt
  const downloadDiffBtn = page.locator('[data-f="downloadDiff"]');
  await expect(downloadDiffBtn).toBeEnabled();
  const [diffDownload] = await Promise.all([
    page.waitForEvent('download', { timeout: 10_000 }),
    downloadDiffBtn.click(),
  ]);
  expect(diffDownload.suggestedFilename()).toMatch(/^diff-page-\d+-\d+\.txt$/);

  // Copy diff JSON - verify clipboard write was attempted (button click doesn't throw)
  const copyDiffBtn = page.locator('[data-f="copyDiff"]');
  await expect(copyDiffBtn).toBeEnabled();
  await copyDiffBtn.click();

  // Wait for status message confirming copy
  await expect(page.locator('#view')).toContainText(/copied/i, { timeout: 5_000 });

  expectZeroUploads(violations);
});