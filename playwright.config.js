// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// P1 bounded E2E harness: static shell served locally, zero uploads.
// Run: npx playwright test  (or: npx playwright test --project=chromium)
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PW_PORT || 8123);
const BASE = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: BASE,
    acceptDownloads: true,
    screenshot: 'only-on-failure',
    trace: 'off',
  },
  // 3 browsers => smoke "34x3": 34 tools x 3 browser projects.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: `python3 -m http.server ${PORT}`,
    url: BASE,
    reuseExistingServer: true,
    timeout: 15_000,
  },
});
