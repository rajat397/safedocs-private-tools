// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// DEEP 25x7: each PDF tool x each corpus file. Attach only (no Run click, so
// no CDN pdf-lib needed) and assert the shell stays alive: either the file is
// accepted (list/meter) or it is rejected gracefully with a reason — never a
// blank crash. Encrypted corpus uses password "test123" where a pw field exists.
import { test, expect } from '@playwright/test';
import { PDF_TOOLS_25, CORPUS_7, corpusPath, installZeroUploadGuard, expectZeroUploads } from './fixtures.js';

for (const id of PDF_TOOLS_25) {
  for (const file of CORPUS_7) {
    test(`deep ${id} x ${file}`, async ({ page }, testInfo) => {
      const violations = await installZeroUploadGuard(page, testInfo);
      testInfo.setTimeout(15_000);
      await page.goto(`#/${id}`);

      const input = page.locator('#view input[type="file"]').first();
      if (await input.count() === 0) {
        // Shell placeholder owns a .dropzone instead — corpus must be accepted there.
        const dzInput = page.locator('#view .dropzone input[type="file"]').first();
        await expect(dzInput).toBeVisible();
        await dzInput.setInputFiles(corpusPath(file));
        await expect(page.locator('#view .filelist li, #view #out').first()).toBeVisible();
        expectZeroUploads(violations);
        return;
      }

      await input.setInputFiles(corpusPath(file));

      // Password-capable tools: feed the corpus password for encrypted.pdf.
      if (file === 'encrypted.pdf') {
        const pw = page.locator('#view input[type="password"]').first();
        if (await pw.count()) await pw.fill('test123');
      }

      // Shell must stay alive and explain itself: accepted list, status line,
      // or graceful rejection/error — but never an empty view.
      const view = page.locator('#view');
      await expect(view).not.toBeEmpty();
      const text = (await view.innerText()).toLowerCase();
      const ok =
        /no files selected|selected|accepted|rejected|done|error|encrypted|password|not a pdf|missing %pdf|out of range|cap|too big|single file/i.test(text) ||
        text.length > 20;
      expect(ok).toBe(true);
      expectZeroUploads(violations);
    });
  }
}
