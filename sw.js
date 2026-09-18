// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava. Source-available - see /LICENSE. Commercial use requires permission: rajat242003@gmail.com.
/* Offline-first service worker: precache the shell, runtime-cache GETs.
 * Same-origin GETs are cached freely; cross-origin GETs are cached ONLY for
 * the pinned library CDNs in vendor/cdn-pins.js (js/traineddata, no file
 * bytes). See PRIVACY.md "Exceptions" for the offline-limit note. */
const VERSION = 'toolbox-shell-v2';
const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './core/router.js',
  './core/registry.js',
  './core/dropzone.js',
  './core/privacy.js',
  './core/utils.js',
  './core/caps.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const CDN_ALLOW = new Set(['esm.sh', 'cdn.jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare.com']);

function cacheable(req, res) {
  if (!res) return false;
  // Opaque (no-cors) CDN responses carry no status/headers — cache by size-unknown, they are version-pinned libs.
  if (res.type === 'opaque') return true;
  if (!res.ok) return false;
  const len = Number(res.headers.get('content-length') || 0);
  if (len > 50 * 1024 * 1024) return false; // never fill quota with huge media
  const dest = req.destination;
  return dest === '' || ['document', 'script', 'style', 'image', 'font', 'manifest'].includes(dest);
}

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === location.origin;
  const pinnedCdn = !sameOrigin && CDN_ALLOW.has(url.hostname);
  if (!sameOrigin && !pinnedCdn) return;
  e.respondWith(
    caches.match(request, { ignoreSearch: false }).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((res) => {
        if (cacheable(request, res)) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(request, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    }),
  );
});
