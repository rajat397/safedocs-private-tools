// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava. Source-available - see /LICENSE. Commercial use requires permission: rajat242003@gmail.com.
import { installUploadGuard } from './core/privacy.js';
import { initRouter } from './core/router.js';
import { TOOLS } from './core/registry.js';

installUploadGuard();

// Visible version stamp: count stays sourced from the router's registry (TOOLS).
try {
  const count = (Array.isArray(TOOLS) && TOOLS.length) || 34;
  document.getElementById('app-version').textContent = `v4·${count} tools`;
} catch { /* static fallback "v4·34 tools" in HTML stays */ }

initRouter({
  view: document.getElementById('view'),
  search: document.getElementById('search'),
});

// Service worker: offline shell. Failure is non-fatal (e.g. file://).
// Shell version stamp (mirrors sw.js VERSION toolbox-shell-v4, short display).
const SW_VERSION = 'v4';
try { document.getElementById('sw-version').textContent = SW_VERSION; } catch { /* ignore */ }
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(
      () => {
        document.getElementById('sw-status').textContent = `offline support: on ✔ (${SW_VERSION})`;
        try { document.getElementById('sw-version').textContent = SW_VERSION; } catch { /* ignore */ }
      },
      () => { document.getElementById('sw-status').textContent = 'offline support: unavailable'; },
    );
  });
} else {
  document.getElementById('sw-status').textContent = 'offline support: unavailable';
}
