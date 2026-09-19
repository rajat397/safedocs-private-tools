// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// bench/run.js — Performance benchmark harness for tools. Node ESM + Playwright.

import { program } from 'commander';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOOLS, moduleCandidates } from '../core/registry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CORPUS_DIR = path.join(ROOT, 'tests/e2e/corpus');

program
  .name('bench')
  .description('Benchmark tools with headless Chromium')
  .option('--tool <name>', 'Run only this tool (id from registry)')
  .option('--ci', 'CI mode: headless, no traces, minimal output')
  .option('--out <dir>', 'Output directory for JSON results', 'bench/results')
  .option('--timeout <ms>', 'Per-tool timeout in ms', '120000')
  .option('--json', 'Machine-readable JSON output to stdout')
  .parse();

const opts = program.opts();
const CI = opts.ci === true;
const OUT_DIR = path.resolve(ROOT, opts.out);
const TIMEOUT = Number(opts.timeout);
const JSON_OUTPUT = opts.json === true;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getDemoFiles(toolId) {
  const pdfTools = new Set([
    'pdf-merge', 'split', 'compress', 'images-to-pdf', 'pdf-to-images',
    'protect', 'scrub', 'watermark', 'pagenum', 'flatten', 'reorder',
    'pdf-rotate', 'pdf-add-remove-pages', 'pdf-extract-pages',
    'pdf-target-size', 'pdf-grayscale', 'pdf-to-text',
    'pdf-unlock-view', 'pdf-redact-burn', 'pdf-metadata-edit',
    'pdf-split-by-size', 'pdf-crop', 'pdf-extract-images',
    'pdf-remove-annotations', 'pdf-n-up', 'sign'
  ]);
  const imageTools = new Set([
    'image-convert', 'image-exif', 'image-compress'
  ]);
  const multiFileTools = new Set([
    'pdf-merge', 'images-to-pdf', 'image-compress', 'ocr', 'zip'
  ]);

  if (pdfTools.has(toolId)) {
    const files = ['small-1p.pdf', 'medium-20p.pdf'].map(f => path.join(CORPUS_DIR, f));
    return multiFileTools.has(toolId) ? files : [files[0]];
  }
  if (imageTools.has(toolId)) {
    return [path.join(CORPUS_DIR, 'image-scan.pdf')];
  }
  if (toolId === 'video-gif') {
    return [path.join(CORPUS_DIR, 'small-1p.pdf')];
  }
  if (toolId === 'pii-mask') {
    return [path.join(CORPUS_DIR, 'small-1p.pdf')];
  }
  if (toolId === 'ocr') {
    return [path.join(CORPUS_DIR, 'image-scan.pdf')];
  }
  if (toolId === 'zip') {
    return [path.join(CORPUS_DIR, 'small-1p.pdf'), path.join(CORPUS_DIR, 'medium-20p.pdf')];
  }
  if (toolId === 'text-to-pdf') {
    return [path.join(CORPUS_DIR, 'small-1p.pdf')];
  }
  return [];
}

async function runTool(page, toolId, demoFiles) {
  const modulePaths = moduleCandidates(toolId);
  if (!modulePaths.length) {
    throw new Error(`No module found for tool: ${toolId}`);
  }
  const modulePath = modulePaths[0];

  await page.goto('about:blank');
  await page.addInitScript(() => {
    window.__BENCH__ = { start: performance.now(), metrics: null };
  });

  const toolModule = await page.evaluate(async (modPath) => {
    const mod = await import(modPath);
    return mod.default || mod;
  }, modulePath);

  const mountFn = toolModule.mount || toolModule.default?.mount;
  if (!mountFn) {
    throw new Error(`Tool ${toolId} does not export mount()`);
  }

  const fileHandles = await Promise.all(
    demoFiles.map(f => page.evaluateHandle(async (filePath) => {
      const fs = await import('fs');
      const buf = fs.readFileSync(filePath);
      return new File([buf], path.basename(filePath), { type: 'application/pdf' });
    }, f))
  );

  const result = await Promise.race([
    page.evaluate(async ({ mount, files, toolId }) => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const cleanup = mount(container, { 
        download: async (bytes, name, mime) => ({ bytes: bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), name, mime }),
        checkFiles: (files) => ({ accepted: files, rejected: [] }),
        activeCaps: () => ({ maxSingleMB: 200, maxTotalMB: 200, maxVideoMB: 300 }),
        log: console.log,
      });

      const perfStart = performance.now();
      const cpuStart = performance.now(); // proxy for CPU time in browser
      const memStart = performance.memory?.usedJSHeapSize || 0;
      let peakMem = memStart;
      let outputBytes = 0;
      let success = false;
      let error = null;

      const memInterval = setInterval(() => {
        if (performance.memory) {
          peakMem = Math.max(peakMem, performance.memory.usedJSHeapSize);
        }
      }, 10);

      try {
        let result;
        if (typeof cleanup.run === 'function') {
          result = await cleanup.run(files);
        } else if (typeof cleanup.convert === 'function') {
          result = await cleanup.convert(files);
        } else if (typeof cleanup.recognize === 'function') {
          result = await cleanup.recognize(files[0]);
        } else if (typeof cleanup.createZip === 'function') {
          result = await cleanup.createZip(files);
        } else if (typeof cleanup.embedPngInPdf === 'function') {
          const pngBlob = await cleanup.canvasToPngBlob(container.querySelector('canvas'));
          const pdfBytes = new Uint8Array(await files[0].arrayBuffer());
          const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
          result = await cleanup.embedPngInPdf(pdfBytes, pngBytes);
        }

        if (result?.bytes instanceof Uint8Array) {
          outputBytes = result.bytes.length;
        } else if (result?.files) {
          outputBytes = result.files.reduce((sum, f) => sum + (f.bytes?.length || 0), 0);
        }

        success = true;
      } catch (e) {
        error = e?.message || String(e);
      } finally {
        clearInterval(memInterval);
        const perfEnd = performance.now();
        const cpuEnd = performance.now();
        const wallMs = perfEnd - perfStart;
        const cpuMs = cpuEnd - cpuStart;
        const heapPeakMB = (peakMem - memStart) / (1024 * 1024);

        if (cleanup && typeof cleanup === 'function') {
          cleanup();
        }
        container.remove();

        return { wallMs, cpuMs, heapPeakMB, outputBytes, success, error };
      }
    }, { mount: mountFn, files: fileHandles, toolId }),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Tool timeout after ${TIMEOUT}ms`)), TIMEOUT)
    )
  ]);

  return result;
}

async function main() {
  ensureDir(OUT_DIR);

  let toolsToRun = TOOLS.map(t => t.id);
  if (opts.tool) {
    if (!toolsToRun.includes(opts.tool)) {
      console.error(`Tool not found: ${opts.tool}`);
      process.exit(1);
    }
    toolsToRun = [opts.tool];
  }

  if (!JSON_OUTPUT) {
    console.log(`[bench] Running ${toolsToRun.length} tool(s)...`);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const results = [];

  for (const toolId of toolsToRun) {
    const demoFiles = getDemoFiles(toolId);
    if (!demoFiles.length) {
      if (!JSON_OUTPUT) console.log(`[bench] ${toolId}: no demo files, skipping`);
      results.push({ tool: toolId, wallMs: 0, cpuMs: 0, heapPeakMB: 0, outputBytes: 0, success: false, error: 'No demo files' });
      continue;
    }

    if (!JSON_OUTPUT) console.log(`[bench] ${toolId}: starting...`);
    try {
      const res = await runTool(page, toolId, demoFiles);
      results.push({ tool: toolId, ...res });
      if (!JSON_OUTPUT) console.log(`[bench] ${toolId}: ${res.success ? 'OK' : 'FAIL'} (${res.wallMs.toFixed(0)}ms, heap: ${res.heapPeakMB.toFixed(1)}MB, out: ${res.outputBytes}B)`);
    } catch (e) {
      if (!JSON_OUTPUT) console.error(`[bench] ${toolId}: ERROR - ${e.message}`);
      results.push({ tool: toolId, wallMs: 0, cpuMs: 0, heapPeakMB: 0, outputBytes: 0, success: false, error: e.message });
    }
  }

  await browser.close();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = path.join(OUT_DIR, `bench-${timestamp}.json`);
  const output = { timestamp, results };
  fs.writeFileSync(outFile, JSON.stringify(output, null, 2));

  if (JSON_OUTPUT) {
    console.log(JSON.stringify(output));
  } else {
    console.log(`[bench] Results written to ${outFile}`);
  }

  const failed = results.filter(r => !r.success).length;
  if (failed > 0) process.exit(1);
}

main().catch(e => {
  console.error('[bench] Fatal:', e);
  process.exit(1);
});