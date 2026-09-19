// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// DOWNLOAD MATRIX: core/utils download() accepts Blob / Uint8Array /
// ArrayBuffer / string, triggers a real download, and schedules
// URL.revokeObjectURL (memory hygiene). Zero uploads throughout.
import { test, expect } from '@playwright/test';
import { installZeroUploadGuard, expectZeroUploads } from './fixtures.js';

const CASES = [
  { name: 'Blob', make: `new Blob(['hello(blob)'], { type: 'text/plain' })` },
  { name: 'Uint8Array', make: `new Uint8Array([104, 105])` },
  { name: 'ArrayBuffer', make: `new Uint8Array([104, 105]).buffer` },
  { name: 'string', make: `'hello(string)'` },
];

for (const { name, make } of CASES) {
  test(`download-matrix ${name} downloads + revokes`, async ({ page }, testInfo) => {
    const violations = await installZeroUploadGuard(page, testInfo);
    testInfo.setTimeout(20_000);
    await page.goto('#/');

    // Spy object-URL lifetime.
    await page.evaluate(() => {
      window.__created = [];
      window.__revoked = [];
      const origCreate = URL.createObjectURL.bind(URL);
      const origRevoke = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = (b) => { const u = origCreate(b); window.__created.push(u); return u; };
      URL.revokeObjectURL = (u) => { window.__revoked.push(u); return origRevoke(u); };
    });

    const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
    await page.evaluate(({ makeSrc, fname }) => {
      // eslint-disable-next-line no-eval
      const input = eval(makeSrc);
      return import('/core/utils.js').then(({ download }) => download(input, fname, 'text/plain'));
    }, { makeSrc: make, fname: `matrix-${name}.txt` });

    const dl = await downloadPromise;
    expect(dl.suggestedFilename()).toBe(`matrix-${name}.txt`);

    // Memory hygiene: the helper revokes after 10s — wait for it (bounded 12s).
    await page.waitForFunction(() => window.__revoked.length > 0, null, { timeout: 12_000 });
    const { created, revoked } = await page.evaluate(() => ({
      created: window.__created, revoked: window.__revoked,
    }));
    expect(created.length).toBeGreaterThan(0);
    expect(revoked).toEqual(expect.arrayContaining(created));
    expectZeroUploads(violations);
  });
}

test('download-matrix rejects unsupported input', async ({ page }, testInfo) => {
  const violations = await installZeroUploadGuard(page, testInfo);
  await page.goto('#/');
  const err = await page.evaluate(() =>
    import('/core/utils.js').then(({ download }) => {
      try { download(12345, 'x.bin'); return 'no-throw'; }
      catch (e) { return String(e?.message || e); }
    }));
  expect(err).toMatch(/unsupported input/i);
  expectZeroUploads(violations);
});
