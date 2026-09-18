// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava. Source-available - see /LICENSE. Commercial use requires permission: rajat242003@gmail.com.
/**
 * Zero-upload enforcement.
 * The whole toolbox is static + on-device. This module installs a runtime
 * guard that throws if any code path ever tries to exfiltrate file bytes
 * via fetch, XHR, sendBeacon, form submit, or WebSocket.
 * Legit GETs (tool chunks, pinned CDN libraries, data) still work — needed
 * for lazy import() and offline use. See PRIVACY.md "Exceptions".
 */

let installed = false;

export function containsFileBytes(body) {
  if (body == null) return false;
  if (body instanceof Blob) return true; // File extends Blob
  if (body instanceof FormData) {
    for (const v of body.values()) {
      if (v instanceof Blob) return true;
    }
    return false;
  }
  if (body instanceof ArrayBuffer) return body.byteLength > 0;
  if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView?.(body)) {
    // TypedArray / DataView — raw bytes that could be file content.
    return body.byteLength > 0;
  }
  if (body instanceof URLSearchParams) return false; // plain key=value text
  if (typeof body === 'string') {
    // The toolbox never needs to upload anything: any non-empty string
    // body on an upload method is treated as potential exfiltration
    // (base64 data-URL, file text, JSON-wrapped bytes, etc).
    return body.length > 0;
  }
  return false;
}

function isUploadMethod(method) {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method || 'GET').toUpperCase());
}

/** Resolve effective { method, body, url } from fetch(input, init). */
function describeFetch(input, init = {}) {
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return {
      url: input.url,
      method: init.method ?? input.method ?? 'GET',
      body: init.body !== undefined ? init.body : null, // Request body already locked; method check still applies below
      fromRequest: true,
      request: input,
    };
  }
  return { url: String(input?.url ?? input ?? ''), method: init.method ?? 'GET', body: init.body ?? null, fromRequest: false };
}

function block(msg) {
  throw new Error(`[privacy-guard] Blocked: ${msg} File bytes must never leave the device.`);
}

export function installUploadGuard() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  // fetch() — inspect init AND Request objects.
  const origFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const d = describeFetch(input, init);
    if (isUploadMethod(d.method)) {
      if (d.body != null && containsFileBytes(d.body)) block(`fetch ${d.method} with file-like body.`);
      // Request object carrying a body: the body stream can't be re-read
      // safely here, so block any Request-with-body on upload methods.
      // Same-origin GETs and bodyless calls pass through untouched.
      if (d.fromRequest && init.body === undefined && d.request.body != null) {
        block(`fetch ${d.method} with a Request body.`);
      }
      // No legitimate upload path exists in this app: a string/ArrayBuffer
      // body on POST/PUT/PATCH is exfil-shaped even without Blob proof.
      if (typeof d.body === 'string' && d.body.length > 0) block(`fetch ${d.method} with string body.`);
    }
    return origFetch(input, init);
  };

  // XMLHttpRequest — method captured at open(), body inspected at send().
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, ...rest) {
    this.__tbMethod = method;
    return origOpen.call(this, method, ...rest);
  };
  XMLHttpRequest.prototype.send = function (body) {
    if (isUploadMethod(this.__tbMethod) && body != null && containsFileBytes(body)) {
      block('XHR upload of file bytes.');
    }
    return origSend.call(this, body);
  };

  // sendBeacon (always a POST)
  if (navigator.sendBeacon) {
    const origBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url, data) => {
      if (data != null && containsFileBytes(data)) {
        console.warn('[privacy-guard] Blocked beacon with file bytes.');
        return false;
      }
      return origBeacon(url, data);
    };
  }

  // Form submit — a classic exfil bypass (multipart upload without fetch/XHR).
  if (typeof HTMLFormElement !== 'undefined') {
    const origSubmit = HTMLFormElement.prototype.submit;
    HTMLFormElement.prototype.submit = function () {
      const enc = (this.enctype || '').toLowerCase();
      const hasFileInput = this.querySelector?.('input[type="file"]') != null;
      if (hasFileInput || enc === 'multipart/form-data') {
        block('form submit carrying files.');
      }
      return origSubmit.call(this);
    };
    window.addEventListener('submit', (e) => {
      const form = e.target;
      if (form instanceof HTMLFormElement) {
        const hasFileInput = form.querySelector?.('input[type="file"]') != null;
        const fd = (() => { try { return new FormData(form); } catch { return null; } })();
        if (hasFileInput || (fd && containsFileBytes(fd))) {
          e.preventDefault();
          e.stopImmediatePropagation();
          block('form submit carrying files.');
        }
      }
    }, true);
  }

  // WebSocket — binary frames could carry file bytes off-device.
  if (typeof WebSocket !== 'undefined' && !WebSocket.__tbGuarded) {
    const OrigWS = WebSocket;
    const GuardedWS = function (...args) {
      const ws = new OrigWS(...args);
      const origSend = ws.send;
      ws.send = function (data) {
        if (data != null && containsFileBytes(data)) block('WebSocket send of file bytes.');
        return origSend.call(this, data);
      };
      return ws;
    };
    GuardedWS.prototype = OrigWS.prototype;
    Object.setPrototypeOf(GuardedWS, OrigWS);
    GuardedWS.__tbGuarded = true;
    window.WebSocket = GuardedWS;
  }
}

/** Test hook: scans shell sources for obvious upload patterns. Returns issues[]. */
export function auditForUploads(source) {
  const issues = [];
  const patterns = [
    [/fetch\s*\([^)]*method\s*:\s*['"]POST['"]/gi, 'fetch POST pattern found'],
    [/fetch\s*\([^)]*method\s*:\s*['"]PUT['"]/gi, 'fetch PUT pattern found'],
    [/new\s+WebSocket\s*\(/g, 'WebSocket constructor found'],
    [/\.submit\s*\(\)/g, 'form submit() call found'],
  ];
  for (const [re, msg] of patterns) {
    if (re.test(source)) issues.push(msg);
  }
  return issues;
}
