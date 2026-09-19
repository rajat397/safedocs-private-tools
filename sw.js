// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava. Source-available - see /LICENSE. Commercial use requires permission: rajat242003@gmail.com.
/* Offline-first service worker: precache the shell, runtime-cache GETs.
 * Same-origin GETs are cached freely; cross-origin GETs are cached ONLY for
 * the pinned library CDNs in vendor/cdn-pins.js (js/traineddata, no file
 * bytes). See PRIVACY.md "Exceptions" for the offline-limit note. */
const VERSION = 'toolbox-shell-v5';
const PRECACHE = [
  './',
  './index.html',
  './404.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './core/router.js',
  './core/registry.js',
  './core/dropzone.js',
  './core/privacy.js',
  './core/utils.js',
  './core/caps.js',
  './core/search.js',
  './core/recents.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './tools/_lib/tool.css',
  './tools/_lib/page.js',
  './tools/image-compress/tool.js',
  './tools/image-exif/tool.js',
  './tools/image/exif-remove.js',
  './tools/image/compress.js',
  './tools/image/convert.js',
  './tools/video/index.js',
  './tools/video/acceptance.gif',
  './tools/pdf/preview.js',
  './tools/pdf/text-to-pdf.js',
  './tools/pdf/n-up.js',
  './tools/pdf/redact-burn.js',
  './tools/pdf/compress.js',
  './tools/pdf/target-size.js',
  './tools/pdf/unlock-view.js',
  './tools/pdf/remove-annotations.js',
  './tools/pdf/reorder.js',
  './tools/pdf/metadata-edit.js',
  './tools/pdf/pdf-to-images.js',
  './tools/pdf/crop.js',
  './tools/pdf/watermark.js',
  './tools/pdf/grayscale.js',
  './tools/pdf/scrub.js',
  './tools/pdf/rotate.js',
  './tools/pdf/extract-pages.js',
  './tools/pdf/add-remove-pages.js',
  './tools/pdf/split.js',
  './tools/pdf/pagenum.js',
  './tools/pdf/extract-images.js',
  './tools/pdf/split-by-size.js',
  './tools/pdf/flatten.js',
  './tools/pdf/merge.js',
  './tools/pdf/to-text.js',
  './tools/pdf/images-to-pdf.js',
  './tools/pdf/protect.js',
  './tools/zip/index.js',
  './tools/zip/files.zip',
  './tools/sign/index.js',
  './tools/sign/signature.png',
  './tools/ocr/index.js',
  './tools/ocr/fixture.js',
  './tools/ocr/fixture.png',
  './tools/pii/verhoeff.js',
  './tools/pii/aadhaar-pan.js',
  './tools/pii/redact.js',
  './tools/pii-mask/tool.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .then(() => self.clients.claim())
      .then(() => caches.open(VERSION))
      .then((cache) => cache.keys())
      .then((keys) => {
        const manifest = {
          version: VERSION,
          cachedUrls: keys.map((req) => req.url),
          timestamp: Date.now(),
        };
        return caches.open(VERSION).then((c) => c.put(
          new Request('./manifest.json'),
          new Response(JSON.stringify(manifest, null, 2), { headers: { 'Content-Type': 'application/json' } })
        ));
      })
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
  if (res.type === 'opaque') return true;
  if (!res.ok) return false;
  const len = Number(res.headers.get('content-length') || 0);
  if (len > 50 * 1024 * 1024) return false;
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
    caches.match(request, { ignoreSearch: false }).then((cached) => {
      const fetchPromise = fetch(request).then((res) => {
        if (cacheable(request, res)) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(request, copy)).catch(() => {});
        }
        return res;
      }).catch(() => {
        if (request.mode === 'navigate') return caches.match('./index.html');
      });
      return cached || fetchPromise;
    })
  );
});