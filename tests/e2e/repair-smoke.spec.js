// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// B07 — E2E smoke test for PDF repair: corrupt.pdf -> Analyze & Repair -> download -> verify.
import { test, expect } from '@playwright/test';
import { corpusPath, installZeroUploadGuard, expectZeroUploads } from './fixtures.js';
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';

test('repair smoke: corrupt.pdf recovers objects and pages, downloads repaired file', async ({ page }, testInfo) => {
  const violations = await installZeroUploadGuard(page, testInfo);
  testInfo.setTimeout(60_000); // pdf-lib CDN load + repair can take a while

  // Navigate to the repair tool (hash route, tool id is 'repair')
  await page.goto('#/repair');

  // Wait for tool to load and dropzone to be ready
  const dropzone = page.locator('#view .dropzone, #view input[type="file"]').first();
  await expect(dropzone).toBeVisible({ timeout: 15_000 });

  // Upload corrupt.pdf via the dropzone input
  const fileInput = page.locator('#view .dropzone input[type="file"], #view input[type="file"]').first();
  await fileInput.setInputFiles(corpusPath('corrupt.pdf'));

  // Click "Analyze & Repair" button
  const runBtn = page.locator('#view [data-action="run"]').first();
  await expect(runBtn).toBeEnabled({ timeout: 10_000 });
  await runBtn.click();

  // Wait for repair to complete - status shows recovery report
  const statusEl = page.locator('#view [data-slot="status"]').first();
  await expect(statusEl).toContainText('Recovery Report', { timeout: 45_000 });

  // Parse the recovery report from status text
  const statusText = await statusEl.innerText();
  console.log('Repair status:', statusText);

  // Assert: objects fixed > 0
  const objectsFixedMatch = statusText.match(/Objects fixed:\s*(\d+)/);
  expect(objectsFixedMatch, 'Objects fixed should be reported').toBeTruthy();
  const objectsFixed = parseInt(objectsFixedMatch[1], 10);
  expect(objectsFixed).toBeGreaterThan(0);

  // Assert: pages recovered > 0
  const pagesRecoveredMatch = statusText.match(/Pages recovered:\s*(\d+)/);
  expect(pagesRecoveredMatch, 'Pages recovered should be reported').toBeTruthy();
  const pagesRecovered = parseInt(pagesRecoveredMatch[1], 10);
  expect(pagesRecovered).toBeGreaterThan(0);

  // Click "Download repaired.pdf" link
  const downloadLink = page.locator('#view .tool-output a.btn').first();
  await expect(downloadLink).toBeVisible({ timeout: 10_000 });

  // Capture the download
  const downloadPromise = page.waitForEvent('download');
  await downloadLink.click();
  const download = await downloadPromise;

  // Save downloaded file to temp location
  const downloadPath = path.join('/tmp', `repaired-${Date.now()}.pdf`);
  await download.saveAs(downloadPath);

  // Verify repaired PDF opens and has pages (in Node.js context using pdf-lib)
  const bytes = fs.readFileSync(downloadPath);
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pageCount = pdf.getPageCount();

  expect(pageCount).toBeGreaterThan(0);
  expect(pageCount).toBe(pagesRecovered); // page count should match recovered pages

  // Cleanup
  fs.unlinkSync(downloadPath);

  expectZeroUploads(violations);
});