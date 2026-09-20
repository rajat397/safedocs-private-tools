// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava. Source-available - see /LICENSE. Commercial use requires permission: rajat242003@gmail.com.
/**
 * core/model-loader.js — Singleton model loader with OPFS caching and progress.
 * Loads models from pinned CDN URLs (vendor/cdn-pins.js) with SRI verification.
 * Caches in Origin Private File System (OPFS) for >50MB models (SW limit).
 * Reference-counted: multiple tools can share the same model.
 */

import { PINS } from '../vendor/cdn-pins.js';

const MODEL_CACHE = new Map();
const LOADING_PROMISES = new Map();

let opfsRoot = null;
let opfsQuotaRequested = false;

async function getOpfsRoot() {
  if (opfsRoot) return opfsRoot;
  if (!('storage' in navigator) || !('getDirectory' in navigator.storage)) {
    console.warn('[model-loader] OPFS not supported, falling back to memory cache');
    return null;
  }
  try {
    opfsRoot = await navigator.storage.getDirectory();
    return opfsRoot;
  } catch (e) {
    console.warn('[model-loader] OPFS access denied:', e);
    return null;
  }
}

async function requestPersistentStorage() {
  if (opfsQuotaRequested) return true;
  opfsQuotaRequested = true;
  try {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      const granted = await navigator.storage.persist();
      console.log('[model-loader] Persistent storage:', granted ? 'granted' : 'denied');
      return granted;
    }
  } catch (e) {
    console.warn('[model-loader] persist() failed:', e);
  }
  return false;
}

async function cacheModelInOpfs(pinKey, modelData) {
  const root = await getOpfsRoot();
  if (!root) return;
  try {
    const fileHandle = await root.getFileHandle(`${pinKey}.model`, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(modelData);
    await writable.close();
    console.log(`[model-loader] Cached ${pinKey} to OPFS (${modelData.byteLength} bytes)`);
  } catch (e) {
    console.warn('[model-loader] OPFS write failed:', e);
  }
}

async function loadModelFromOpfs(pinKey) {
  const root = await getOpfsRoot();
  if (!root) return null;
  try {
    const fileHandle = await root.getFileHandle(`${pinKey}.model`);
    const file = await fileHandle.getFile();
    return await file.arrayBuffer();
  } catch {
    return null;
  }
}

async function fetchWithProgress(url, onProgress) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  if (!response.body || !onProgress) return response;

  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  let loaded = 0;

  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        loaded += value.length;
        controller.enqueue(value);
        onProgress(loaded, total);
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  });
}

async function loadModuleFromPin(pin, onLog) {
  const urls = pin.esm || pin.umd || [];
  let lastErr = null;

  for (const url of urls) {
    try {
      onLog?.(`Loading module from ${url}...`);
      const mod = await import(/* @vite-ignore */ url);
      if (mod) return mod;
    } catch (e) {
      lastErr = e;
      onLog?.(`Failed to load from ${url}: ${e}`);
    }
  }
  throw lastErr || new Error(`No module URLs for pin`);
}

export async function loadModel(
  pinKey,
  options = {}
) {
  const { onProgress, onLog, forceReload = false } = options;

  if (!forceReload && MODEL_CACHE.has(pinKey)) {
    const cached = MODEL_CACHE.get(pinKey);
    cached.refCount++;
    onLog?.(`Model ${pinKey} already loaded (refCount=${cached.refCount})`);
    return cached;
  }

  if (!forceReload && LOADING_PROMISES.has(pinKey)) {
    onLog?.(`Model ${pinKey} already loading, waiting...`);
    const model = await LOADING_PROMISES.get(pinKey);
    model.refCount++;
    return model;
  }

  const pin = PINS[pinKey];
  if (!pin) throw new Error(`Unknown model pin: ${pinKey}`);

  onLog?.(`Loading model ${pinKey} (${pin.approxSize || 'unknown size'})...`);

  const loadingPromise = (async () => {
    await requestPersistentStorage();

    let modelData = null;
    const cacheStrategy = pin.cacheStrategy || pin.model?.cacheStrategy || 'opfs';

    if (cacheStrategy === 'opfs' && !forceReload) {
      modelData = await loadModelFromOpfs(pinKey);
      if (modelData) {
        onLog?.(`Loaded ${pinKey} from OPFS cache`);
      }
    }

    let module;
    let worker;

    if (pinKey === 'ben2-onnx') {
      const transformers = await loadModuleFromPin(pin, onLog);
      const { AutoModel, AutoProcessor, env } = transformers;
      env.allowLocalModels = true;
      env.useBrowserCache = false;

      const model = await AutoModel.from_pretrained(pin.model.id, {
        revision: pin.model.revision,
        dtype: 'q8',
        progress_callback: (p) => onProgress?.(p.loaded, p.total),
      });
      const processor = await AutoProcessor.from_pretrained(pin.model.id, {
        revision: pin.model.revision,
      });
      module = { model, processor, transformers };
    } else if (pinKey === 'realcugan') {
      const tf = await loadModuleFromPin(pin, onLog);
      await tf.setBackend('webgl');
      await tf.ready();
      module = { tf, models: pin.models };
    } else if (pinKey === 'deoldify-quant') {
      const ort = await loadModuleFromPin(pin, onLog);
      const session = await ort.InferenceSession.create(pin.model.url, {
        executionProviders: ['wasm'],
      });
      module = { ort, session };
    } else if (pinKey === 'vtracer') {
      const vtracer = await loadModuleFromPin(pin, onLog);
      module = { vtracer };
    } else {
      module = await loadModuleFromPin(pin, onLog);
    }

    const loadedModel = {
      module,
      worker,
      ready: Promise.resolve(),
      refCount: 1,
      pinKey,
      size: modelData?.byteLength || 0,
    };

    if (modelData && cacheStrategy === 'opfs') {
      await cacheModelInOpfs(pinKey, modelData);
    }

    MODEL_CACHE.set(pinKey, loadedModel);
    return loadedModel;
  })();

  LOADING_PROMISES.set(pinKey, loadingPromise);

  try {
    const result = await loadingPromise;
    return result;
  } finally {
    LOADING_PROMISES.delete(pinKey);
  }
}

export function releaseModel(pinKey) {
  const cached = MODEL_CACHE.get(pinKey);
  if (!cached) return;
  cached.refCount--;
  if (cached.refCount <= 0) {
    try { cached.worker?.terminate(); } catch {}
    MODEL_CACHE.delete(pinKey);
    try { console.log(`[model-loader] Model ${pinKey} released and evicted`); } catch {}
  }
}

export function getCachedModel(pinKey) {
  return MODEL_CACHE.get(pinKey);
}

export function getAllCachedModels() {
  return Array.from(MODEL_CACHE.values());
}

export async function preloadModels(pinKeys, onProgress) {
  for (const pinKey of pinKeys) {
    await loadModel(pinKey, {
      onProgress: (loaded, total) => onProgress?.(pinKey, loaded, total),
      onLog: (msg) => console.log(`[model-loader] ${msg}`),
    });
  }
}