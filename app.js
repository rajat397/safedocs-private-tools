// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava. Source-available - see /LICENSE. Commercial use requires permission: rajat242003@gmail.com.
import { installUploadGuard } from './core/privacy.js';
import { initRouter } from './core/router.js';

installUploadGuard();

initRouter({
  view: document.getElementById('view'),
  search: document.getElementById('search'),
});

// Service worker: offline shell. Failure is non-fatal (e.g. file://).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(
      () => { document.getElementById('sw-status').textContent = 'offline support: on ✔'; },
      () => { document.getElementById('sw-status').textContent = 'offline support: unavailable'; },
    );
  });
} else {
  document.getElementById('sw-status').textContent = 'offline support: unavailable';
}
