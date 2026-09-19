// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// CDN-BLOCK: with all pinned CDNs unreachable, the shell + routing stay alive
// and every tool degrades to a useful placeholder/error — no crash, no upload.
import { test, expect } from '@playwright/test';
import { CDN_HOSTS, installZeroUploadGuard, expectZeroUploads } from './fixtures.js';

test.beforeEach(async ({ page }) => {
  // Abort pinned CDNs by host glob; same-origin traffic is never intercepted
  // (a /.*/ catch-all + continue() can abort the initial navigation itself).
  for (const h of CDN_HOSTS) {
    await page.route(`https://${h}/**`, (route) => route.abort('blockedbyclient'));
  }
});

test('cdn-block home grid works offline', async ({ page }, testInfo) => {
  const violations = await installZeroUploadGuard(page, testInfo);
  await page.goto('#/');
  await expect(page.locator('.tool-grid .card')).toHaveCount(34);
  expectZeroUploads(violations);
});

test('cdn-block tool route degrades gracefully', async ({ page }, testInfo) => {
  const violations = await installZeroUploadGuard(page, testInfo);
  await page.goto('#/pdf-merge');
  // Either the real tool (cached/inline) or the shell placeholder — both are useful.
  await expect(page.locator('#view h2').first()).toBeVisible();
  await expect(page.locator('#view')).toContainText(/Merge|module not loaded|check network|On-device only/i);
  expectZeroUploads(violations);
});
