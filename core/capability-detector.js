// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava. Source-available - see /LICENSE. Commercial use requires permission: rajat242003@gmail.com.
/**
 * core/capability-detector.js — Browser capability detection for WebGPU, WASM, etc.
 * Used to gate tools that require specific capabilities (e.g., WebGPU for denoising).
 */

let cachedResult = null;

export async function detectCapabilities() {
  if (cachedResult) return cachedResult;

  const result = {
    webgpu: false,
    shaderF16: false,
    wasmSimd: false,
    sharedArrayBuffer: false,
    coopCoep: false,
    opfs: false,
    webgl2: false,
    webgl2Compute: false,
    memory: { jsHeapSizeLimit: 0 },
    isIOS: false,
    isSafari: false,
  };

  // WebGPU
  if ('gpu' in navigator) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        result.webgpu = true;
        result.shaderF16 = adapter.features.has('shader-f16');
      }
    } catch {
      // WebGPU not available
    }
  }

  // WASM SIMD
  result.wasmSimd = typeof WebAssembly === 'object' && 'validate' in WebAssembly;

  // SharedArrayBuffer
  result.sharedArrayBuffer = typeof SharedArrayBuffer === 'function';

  // COOP/COEP headers
  try {
    const resp = await fetch('/', { method: 'HEAD', cache: 'no-cache' });
    const coop = resp.headers.get('cross-origin-opener-policy');
    const coep = resp.headers.get('cross-origin-embedder-policy');
    result.coopCoep = coop === 'same-origin' && coep === 'require-corp';
  } catch {
    // Ignore
  }

  // OPFS
  result.opfs = 'storage' in navigator && 'getDirectory' in navigator.storage;

  // WebGL2
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  if (gl) {
    result.webgl2 = true;
    result.webgl2Compute = gl.getExtension('WEBGL_compute_shader') !== null;
  }

  // Memory info
  if ('deviceMemory' in navigator) {
    result.memory.deviceMemory = navigator.deviceMemory;
  }
  if ('memory' in performance) {
    const mem = performance.memory;
    if (mem && mem.jsHeapSizeLimit) {
      result.memory.jsHeapSizeLimit = mem.jsHeapSizeLimit;
    }
  }

  // iOS / Safari detection
  const ua = navigator.userAgent || '';
  result.isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  result.isSafari = /^((?!chrome|android).)*safari/i.test(ua);

  cachedResult = result;
  return result;
}

export function getCachedCapabilities() {
  return cachedResult;
}

export function requiresWebGPU() {
  return cachedResult?.webgpu === true;
}

export function requiresShaderF16() {
  return cachedResult?.shaderF16 === true;
}

export function isIOS() {
  return cachedResult?.isIOS === true;
}

export function isSafari() {
  return cachedResult?.isSafari === true;
}

export function getMemoryBudget() {
  const mem = cachedResult?.memory;
  const deviceMem = mem?.deviceMemory || 4; // GB
  const heapLimit = mem?.jsHeapSizeLimit || 2 * 1024 * 1024 * 1024; // bytes

  // Conservative budgets based on device memory
  const mobileBudget = Math.min(300 * 1024 * 1024, heapLimit * 0.3); // 300MB or 30% heap
  const desktopBudget = Math.min(1024 * 1024 * 1024, heapLimit * 0.5); // 1GB or 50% heap

  return { mobile: mobileBudget, desktop: desktopBudget };
}

export function checkToolRequirements(req) {
  const caps = cachedResult || { webgpu: false, shaderF16: false, wasmSimd: false, sharedArrayBuffer: false, opfs: false, memory: { jsHeapSizeLimit: 0 } };
  const missing = [];
  const details = {};

  if (req.webgpu) {
    details.webgpu = caps.webgpu;
    if (!caps.webgpu) missing.push('webgpu');
  }
  if (req.shaderF16) {
    details.shaderF16 = caps.shaderF16;
    if (!caps.shaderF16) missing.push('shader-f16');
  }
  if (req.wasmSimd) {
    details.wasmSimd = caps.wasmSimd;
    if (!caps.wasmSimd) missing.push('wasm-simd');
  }
  if (req.sharedArrayBuffer) {
    details.sharedArrayBuffer = caps.sharedArrayBuffer;
    if (!caps.sharedArrayBuffer) missing.push('shared-array-buffer');
  }
  if (req.opfs) {
    details.opfs = caps.opfs;
    if (!caps.opfs) missing.push('opfs');
  }
  if (req.minMemoryMB) {
    const budget = getMemoryBudget();
    const available = caps.isIOS ? budget.mobile : budget.desktop;
    details.memory = available >= req.minMemoryMB * 1024 * 1024;
    if (available < req.minMemoryMB * 1024 * 1024) missing.push(`memory-${req.minMemoryMB}MB`);
  }

  return { ok: missing.length === 0, missing, details };
}

export function getToolCapabilityBadge(req) {
  const check = checkToolRequirements(req);
  if (!check.ok) {
    if (check.missing.includes('webgpu') || check.missing.includes('shader-f16')) {
      return 'needs-webgpu';
    }
    if (check.missing.some(m => m.startsWith('memory-'))) {
      return 'desktop-only';
    }
    return 'unsupported';
  }
  return 'offline-ready';
}