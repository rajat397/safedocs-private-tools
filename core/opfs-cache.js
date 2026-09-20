// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava. Source-available - see /LICENSE. Commercial use requires permission: rajat242003@gmail.com.
/**
 * core/opfs-cache.js — OPFS (Origin Private File System) cache manager with LRU eviction.
 * Used for caching large model files (>50MB) that exceed Service Worker cache limits.
 * Requests persistent storage quota (200MB target).
 */

const MAX_CACHE_SIZE = 200 * 1024 * 1024; // 200 MB target
const CACHE_DIR_NAME = 'safedocs-models';

let cacheDir = null;
let cacheIndex = new Map();
let initialized = false;

async function getCacheDir() {
  if (cacheDir) return cacheDir;
  if (!('storage' in navigator) || !('getDirectory' in navigator.storage)) {
    return null;
  }
  try {
    const root = await navigator.storage.getDirectory();
    cacheDir = await root.getDirectoryHandle(CACHE_DIR_NAME, { create: true });
    return cacheDir;
  } catch (e) {
    console.warn('[opfs-cache] Failed to get cache directory:', e);
    return null;
  }
}

async function requestQuota() {
  try {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      await navigator.storage.persist();
    }
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      console.log(`[opfs-cache] Storage estimate: ${estimate.usage}/${estimate.quota} bytes`);
    }
    return true;
  } catch (e) {
    console.warn('[opfs-cache] Quota request failed:', e);
    return false;
  }
}

export async function initOPFSCache() {
  if (initialized) return true;
  const dir = await getCacheDir();
  if (!dir) return false;

  await requestQuota();

  // Rebuild index from existing files
  try {
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind === 'file' && name.endsWith('.model')) {
        const key = name.replace('.model', '');
        const file = await handle.getFile();
        cacheIndex.set(key, {
          key,
          size: file.size,
          lastAccessed: file.lastModified,
          handle,
        });
      }
    }
  } catch (e) {
    console.warn('[opfs-cache] Index rebuild failed:', e);
  }

  initialized = true;
  console.log(`[opfs-cache] Initialized with ${cacheIndex.size} entries, ${getTotalSize()} bytes`);
  return true;
}

function getTotalSize() {
  let total = 0;
  for (const entry of cacheIndex.values()) {
    total += entry.size;
  }
  return total;
}

async function evictLRU(requiredSpace) {
  const entries = Array.from(cacheIndex.values()).sort((a, b) => a.lastAccessed - b.lastAccessed);
  let freed = 0;

  for (const entry of entries) {
    if (freed >= requiredSpace) break;
    try {
      const dir = await getCacheDir();
      if (dir) {
        await dir.removeEntry(entry.key + '.model');
      }
      freed += entry.size;
      cacheIndex.delete(entry.key);
      console.log(`[opfs-cache] Evicted ${entry.key} (${entry.size} bytes)`);
    } catch (e) {
      console.warn('[opfs-cache] Eviction failed for', entry.key, e);
    }
  }
}

export async function cacheModel(key, data) {
  const dir = await getCacheDir();
  if (!dir) return false;

  const size = data.byteLength;
  const currentTotal = getTotalSize();

  if (currentTotal + size > MAX_CACHE_SIZE) {
    await evictLRU(currentTotal + size - MAX_CACHE_SIZE);
  }

  try {
    const handle = await dir.getFileHandle(`${key}.model`, { create: true });
    const writable = await handle.createWritable();
    await writable.write(data);
    await writable.close();

    cacheIndex.set(key, {
      key,
      size,
      lastAccessed: Date.now(),
      handle,
    });

    console.log(`[opfs-cache] Cached ${key} (${size} bytes), total: ${getTotalSize()}`);
    return true;
  } catch (e) {
    console.warn('[opfs-cache] Cache write failed:', e);
    return false;
  }
}

export async function getCachedModel(key) {
  const entry = cacheIndex.get(key);
  if (!entry) return null;

  try {
    const file = await entry.handle.getFile();
    entry.lastAccessed = Date.now();
    return await file.arrayBuffer();
  } catch (e) {
    console.warn('[opfs-cache] Cache read failed:', e);
    cacheIndex.delete(key);
    return null;
  }
}

export async function hasCachedModel(key) {
  return cacheIndex.has(key);
}

export async function removeCachedModel(key) {
  const entry = cacheIndex.get(key);
  if (!entry) return false;

  try {
    const dir = await getCacheDir();
    if (dir) {
      await dir.removeEntry(key + '.model');
    }
    cacheIndex.delete(key);
    return true;
  } catch (e) {
    console.warn('[opfs-cache] Remove failed:', e);
    return false;
  }
}

export async function clearCache() {
  const dir = await getCacheDir();
  if (!dir) return;

  try {
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind === 'file') {
        await dir.removeEntry(name);
      }
    }
    cacheIndex.clear();
    console.log('[opfs-cache] Cache cleared');
  } catch (e) {
    console.warn('[opfs-cache] Clear failed:', e);
  }
}

export function getCacheStats() {
  const totalSize = getTotalSize();
  return {
    entries: cacheIndex.size,
    totalSize,
    maxSize: MAX_CACHE_SIZE,
    utilization: totalSize / MAX_CACHE_SIZE,
  };
}

export function getCachedKeys() {
  return Array.from(cacheIndex.keys());
}