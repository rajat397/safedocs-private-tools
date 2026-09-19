// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava. Source-available - see /LICENSE. Commercial use requires permission: rajat242003@gmail.com.
// tools/repair/index.js — recover corrupt PDFs: parse, fix trailer, walk prev chain, recover pages, reassemble via pdf-lib.

import { shell } from '../_lib/page.js';
import { parsePdf, fixTrailer, walkPrevChain, recoverPages, detectHeaderOffset, validateHeader } from '../../core/pdf/parse.ts';

const PDF_LIB_VERSION = '1.17.1';
let pdfLibLoaded = false;

async function loadPdfLib() {
  if (pdfLibLoaded && globalThis.PDFLib) return globalThis.PDFLib;
  try {
    const m = await import(/* @vite-ignore */ `https://esm.sh/pdf-lib@${PDF_LIB_VERSION}`);
    const lib = m.default ?? m;
    if (lib?.PDFDocument) {
      globalThis.PDFLib = lib;
      pdfLibLoaded = true;
      return lib;
    }
  } catch {}
  const urls = [
    `https://cdn.jsdelivr.net/npm/pdf-lib@${PDF_LIB_VERSION}/dist/pdf-lib.min.js`,
    `https://unpkg.com/pdf-lib@${PDF_LIB_VERSION}/dist/pdf-lib.min.js`,
  ];
  for (const src of urls) {
    try {
      await loadScript(src);
      if (globalThis.PDFLib) {
        pdfLibLoaded = true;
        return globalThis.PDFLib;
      }
    } catch {}
  }
  throw new Error(`Could not load pdf-lib@${PDF_LIB_VERSION} from CDN (check network).`);
}

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = res;
    s.onerror = () => rej(new Error('script failed: ' + src));
    document.head.appendChild(s);
  });
}

function formatReport(report) {
  const lines = [];
  lines.push(`<strong>Recovery Report</strong>`);
  lines.push(`Objects fixed: ${report.objectsFixed}`);
  lines.push(`Pages recovered: ${report.pagesRecovered}`);
  lines.push(`Orphans found: ${report.orphansFound}`);
  if (report.orphanDetails.length) {
    lines.push(`Orphan objects: ${report.orphanDetails.join(', ')}`);
  }
  if (report.warnings.length) {
    lines.push(`<span class="warn">Warnings: ${report.warnings.join('; ')}</span>`);
  }
  return lines.join('<br>');
}

function serializePDF(parsed) {
  const { header, trailer, objects } = parsed;
  const lines = [];
  lines.push(`%PDF-${header.version}`);
  lines.push('%âãÏÓ');

  const sortedObjNums = [...objects.keys()].sort((a, b) => a - b);
  const xrefOffset = lines.join('\n').length + 1;

  lines.push('xref');
  lines.push(`0 ${sortedObjNums.length + 1}`);
  lines.push('0000000000 65535 f ');

  const objOffsets = {};
  for (const objNum of sortedObjNums) {
    const obj = objects.get(objNum);
    objOffsets[objNum] = lines.join('\n').length + 1;
    const dataStr = new TextDecoder('latin1').decode(obj.data);
    lines.push(`${objNum} 0 obj`);
    lines.push(dataStr.trim());
    lines.push('endobj');
  }

  lines.push('trailer');
  lines.push('<<');
  lines.push(`  /Size ${sortedObjNums.length + 1}`);
  if (trailer.Root) lines.push(`  /Root ${trailer.Root.objNum} 0 R`);
  if (trailer.Info) lines.push(`  /Info ${trailer.Info.objNum} 0 R`);
  if (trailer.ID) {
    const id1 = Array.from(trailer.ID[0]).map(b => b.toString(16).padStart(2, '0')).join('');
    const id2 = Array.from(trailer.ID[1]).map(b => b.toString(16).padStart(2, '0')).join('');
    lines.push(`  /ID [ <${id1}> <${id2}> ]`);
  }
  lines.push('>>');
  lines.push('startxref');
  lines.push(String(xrefOffset));
  lines.push('%%EOF');

  return new TextEncoder().encode(lines.join('\n'));
}

export async function mount(el, ctx = {}) {
  const log = (...a) => (ctx.log || console.log)('[repair]', ...a);

  const tool = {
    id: 'repair',
    name: 'Repair PDF',
    accept: '.pdf,application/pdf',
    multiple: false,
  };

  const page = shell(el, tool, ctx);

  const liveUrls = new Set();
  const track = (url) => { liveUrls.add(url); return url; };
  const revokeAll = () => {
    for (const u of liveUrls) {
      try { URL.revokeObjectURL(u); } catch {}
    }
    liveUrls.clear();
  };

  page.onFiles((files) => {
    if (!files.length) return;
    page.status(`${files[0].name} — ready to analyze.`);
  });

  page.runBtn('Analyze & Repair', async (files, api) => {
    const file = files[0];
    api.setProgress(0.1);
    api.status('Parsing PDF structure…');

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    let parsed;
    try {
      api.setProgress(0.3);
      parsed = parsePdf(bytes);
      api.status('PDF parsed. Fixing trailer…');
    } catch (e) {
      api.status(`Parse failed: ${e.message}. Attempting recovery…`);
      try {
        const headerOffset = detectHeaderOffset(bytes);
        if (headerOffset === -1) throw new Error('No PDF header found');
        const headerBytes = bytes.slice(headerOffset, headerOffset + 20);
        const headerStr = new TextDecoder('latin1').decode(headerBytes);
        const validation = validateHeader(headerStr);
        throw new Error(`Invalid PDF: ${validation.issues.join(', ')}`);
      } catch {
        api.status('Error: File does not appear to be a valid PDF.');
        return;
      }
    }

    api.setProgress(0.5);
    const originalObjCount = parsed.objects.size;
    const fixedTrailer = fixTrailer(parsed.trailer, parsed.objects);
    let objectsFixed = 0;
    for (const [num, obj] of parsed.objects.entries()) {
      if (obj.parsed.type === 'xref-entry' && obj.parsed.inUse && obj.data.length > 0) {
        objectsFixed++;
      }
    }

    api.status('Walking previous xref chains…');
    api.setProgress(0.6);
    const mergedObjects = walkPrevChain(fixedTrailer, bytes, parsed.objects);
    const additionalObjects = mergedObjects.size - originalObjCount;

    api.status('Recovering pages…');
    api.setProgress(0.8);
    const { pages, orphans } = recoverPages(fixedTrailer, mergedObjects);

    const report = {
      objectsFixed: objectsFixed + additionalObjects,
      pagesRecovered: pages.length,
      orphansFound: orphans.length,
      orphanDetails: orphans.slice(0, 20).map(n => `obj ${n}`),
      warnings: [],
    };

    if (pages.length === 0) {
      report.warnings.push('No pages could be recovered from the page tree');
    }
    if (additionalObjects > 0) {
      report.warnings.push(`Recovered ${additionalObjects} additional objects from previous xref sections`);
    }

    api.setProgress(0.9);
    api.status('Reassembling PDF with pdf-lib…');

    let repairedBytes;
    try {
      const { PDFDocument } = await loadPdfLib();
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
      repairedBytes = await pdf.save();
    } catch (e) {
      log('pdf-lib reassembly failed, falling back to manual serialization:', e);
      try {
        repairedBytes = serializePDF({ ...parsed, trailer: fixedTrailer, objects: mergedObjects });
      } catch (e2) {
        api.status(`Error: Could not reassemble PDF: ${e2.message}`);
        return;
      }
    }

    const blob = new Blob([repairedBytes], { type: 'application/pdf' });
    const filename = file.name.replace(/\.pdf$/i, '') + '-repaired.pdf';

    api.addDownload(blob, filename, `Download ${filename}`);
    api.setProgress(1);
    api.status(formatReport(report));
    log('Repair complete:', report);
  });

  page.wireCaps();
  page.status('Drop a corrupt PDF to begin — everything stays on this device.');

  return () => {
    revokeAll();
    page.cleanup();
  };
}

export default { mount };