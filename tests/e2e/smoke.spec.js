// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// SMOKE 34x3: every tool route loads with 3 asserts each —
// (1) tool heading renders, (2) a file entry point exists, (3) on-device notice.
import { test, expect } from '@playwright/test';
import { TOOLS_34, installZeroUploadGuard, expectZeroUploads } from './fixtures.js';

for (const id of TOOLS_34) {
  test(`smoke ${id} loads offline`, async ({ page }, testInfo) => {
    const violations = await installZeroUploadGuard(page, testInfo);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e?.message || e)));

    await page.goto(`#/${id}`);
    // (1) route resolved to the tool (not "Unknown tool")
    await expect(page.locator('#view h2').first()).toBeVisible();
    await expect(page.locator('#view')).not.toContainText('Unknown tool');
    // (2) file entry point: real tool has <input type=file>, shell fallback has .dropzone.
    const entry = page.locator('#view input[type="file"], #view .dropzone');
    await expect(entry.first()).toBeVisible();
    await expect(page.locator('#view .warnbox')).toHaveCount(0);
    // (3) on-device notice (real tool) or caps line (placeholder) — never an upload form
    await expect(page.locator('#view')).toContainText(/On-device only|Accepted types/i);
    await expect(page.locator('#view form[enctype="multipart/form-data"]')).toHaveCount(0);

    expect(errors.filter((m) => !/Could not load|check network|CDN/i.test(m))).toEqual([]);
    expectZeroUploads(violations);
  });
}

test('smoke home grid lists 34 tools', async ({ page }, testInfo) => {
  const violations = await installZeroUploadGuard(page, testInfo);
  await page.goto('#/');
  await expect(page.locator('.tool-grid .card')).toHaveCount(34);
  expectZeroUploads(violations);
});
