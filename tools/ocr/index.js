// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/ocr/index.js — client-side OCR (English + Hindi). Zero upload.
// Image never leaves the device. The ONLY network GETs are the JS lib +
// traineddata lang packs, fetched once then cached (worker singleton +
// cacheMethod:'write' backed by IndexedDB/HTTP cache).
// Heavy: tesseract.js v7, lazy. Worker-only OCR (no main-thread work).
// Contract: export function mount(el, ctx) -> cleanup function

export const TESSERACT_PIN = '7';
export const TESSERACT_ESM = [
  'https://cdn.jsdelivr.net/npm/tesseract.js@7/dist/tesseract.esm.min.js',
  'https://unpkg.com/tesseract.js@7/dist/tesseract.esm.min.js',
];
export const DEFAULT_LANGS = ['eng', 'hin'];
// Dedupe key for the single lang-pack fetch (eng+hin fetched once per worker).
export const OEM_LSTM = 1;

export function normalizeLangs(langs) {
  const list = (Array.isArray(langs) ? langs : String(langs || '').split('+'))
    .map(s => String(s).trim().toLowerCase())
    .filter(s => /^[a-z]{3}$/.test(s));
  const uniq = [...new Set(list)];
  return uniq.length ? uniq : [...DEFAULT_LANGS];
}

export function langsKey(langs) {
  return normalizeLangs(langs).sort().join('+');
}

// Progress logger -> 0..1 fraction. Tesseract v7 logger messages:
// { status: 'recognizing text', progress: 0..1 } (+ load/model messages).
export function parseProgress(msg) {
  if (!msg || typeof msg !== 'object') return null;
  if (typeof msg.progress === 'number') {
    const p = Math.min(1, Math.max(0, msg.progress));
    return { status: String(msg.status || ''), progress: p };
  }
  return { status: String(msg.status || ''), progress: null };
}

let _tessMod = null;      // lazy tesseract module (imported once)
let _worker = null;       // singleton worker (lang packs fetched once)
let _workerKey = '';      // langs key the singleton was built for
let _workerInflight = null;

async function loadTesseract(onLog) {
  if (_tessMod) return _tessMod;
  let lastErr = null;
  for (const url of TESSERACT_ESM) {
    try {
      onLog && onLog('loading ocr engine…');
      _tessMod = await import(/* @vite-ignore */url);
      if (_tessMod && _tessMod.createWorker) return _tessMod;
      _tessMod = null;
    } catch (e) { lastErr = e; }
  }
  throw new Error('Could not load tesseract.js@7 from CDN (check network). ' + (lastErr?.message || ''));
}

// Singleton worker per langs key: guarantees the traineddata GET happens
// at most once per language set (concurrent callers share _workerInflight).
export async function ensureWorker(langs, { onProgress, onLog } = {}) {
  const key = langsKey(langs);
  if (_worker && _workerKey === key) return _worker;
  if (_workerInflight && _workerKey === key) return _workerInflight;
  if (_worker) { try { await _worker.terminate(); } catch {} _worker = null; }
  _workerKey = key;
  _workerInflight = (async () => {
    const T = await loadTesseract(onLog);
    // v7: createWorker(langs, oem, options). logger -> progress callback.
    // cacheMethod 'write' persists lang packs (GET once across sessions).
    const worker = await T.createWorker(key.split('+'), OEM_LSTM, {
      cacheMethod: 'write',
      logger: m => {
        const p = parseProgress(m);
        onProgress && onProgress(p || { status: String((m && m.status) || ''), progress: null });
      },
    });
    _worker = worker;
    _workerInflight = null;
    return worker;
  })().catch(e => { _workerInflight = null; _workerKey = ''; throw e; });
  return _workerInflight;
}

// Injectable recognize: pass a fake worker in tests, real worker in browser.
export async function recognizeWith(image, worker, { onProgress } = {}) {
  const { data } = await worker.recognize(image, {}, {});
  onProgress && onProgress({ status: 'done', progress: 1 });
  return String(data?.text ?? '');
}

// Gate an image against device caps BEFORE any decode/OCR work.
export function gateOcrFile(file, ctx = {}) {
  try {
    if (typeof ctx.checkFiles === 'function') {
      const r = ctx.checkFiles([file], { toolId: 'ocr', accept: 'image/*,.jpg,.jpeg,.png,.webp,.pdf', multiple: false });
      if (!r.accepted?.length) {
        return { ok: false, reason: r.rejected?.[0]?.reason || 'File rejected by device caps.' };
      }
      return { ok: true, reason: '' };
    }
    if (typeof ctx.activeCaps === 'function') {
      const caps = ctx.activeCaps('ocr');
      const capMB = caps?.maxSingleMB ?? 200;
      const mb = (file?.size || 0) / (1024 * 1024);
      if (mb > capMB) return { ok: false, reason: `Too big (${mb.toFixed(1)} MB > ${capMB} MB cap).` };
    }
  } catch (e) {
    return { ok: false, reason: e?.message || 'Cap check failed.' };
  }
  return { ok: true, reason: '' };
}

export function mount(el, ctx = {}) {
  const log = (...a) => { (ctx.log || console.log)('[ocr]', ...a); };
  let objUrl = null;
  let txtUrl = null;
  let lastText = '';

  el.innerHTML = `
    <div style="display:grid;gap:10px">
      <p class="muted" style="margin:0">100% local — image never uploads. Only the OCR lang pack
        (eng+hin) is downloaded once, then cached.</p>
      <label style="font-size:13px;font-weight:600">Image
        <input type="file" data-f="file" accept="image/*" />
      </label>
      <img data-f="prev" alt="preview" style="max-width:100%;display:none;border:1px solid #e2e8f0;border-radius:10px" />
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:end">
        <label style="font-size:13px;font-weight:600">Languages
          <select data-f="langs">
            <option value="eng+hin" selected>English + Hindi</option>
            <option value="eng">English only</option>
            <option value="hin">Hindi only</option>
          </select>
        </label>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button data-f="go">Recognize text</button>
        </div>
      </div>
      <progress data-f="bar" max="100" value="0" style="width:100%" hidden></progress>
      <div data-f="status" style="font-size:13px;color:#64748b" aria-live="polite">No image selected.</div>
      <pre data-f="out" style="white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px;font-size:13px;min-height:60px;margin:0"></pre>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button data-f="copy" class="secondary">Copy text</button>
        <button data-f="dl" class="secondary">Download .txt</button>
      </div>
    </div>`;

  const q = s => el.querySelector(`[data-f="${s}"]`);
  const say = m => { q('status').textContent = m; log(m); };
  const setBar = p => {
    const bar = q('bar');
    if (p == null) { bar.hidden = true; return; }
    bar.hidden = false;
    bar.value = Math.round(p * 100);
  };
  const revokeTxt = () => { if (txtUrl) { URL.revokeObjectURL(txtUrl); txtUrl = null; } };

  q('file').addEventListener('change', e => {
    if (objUrl) { URL.revokeObjectURL(objUrl); objUrl = null; }
    const f = e.target.files?.[0] || null;
    const prev = q('prev');
    if (!f) { prev.style.display = 'none'; say('No image selected.'); return; }
    // Cap gate BEFORE preview/decode.
    const gate = gateOcrFile(f, ctx);
    if (!gate.ok) {
      e.target.value = '';
      prev.style.display = 'none';
      say('Rejected: ' + gate.reason);
      return;
    }
    objUrl = URL.createObjectURL(f);
    prev.src = objUrl;
    prev.style.display = 'block';
    // Revoke the preview URL once the image has loaded (no leak),
    // keeping objUrl nulled so unmount stays idempotent.
    prev.onload = () => { if (objUrl) { URL.revokeObjectURL(objUrl); objUrl = null; } };
    say(`Ready: ${f.name} (${Math.round(f.size / 1024)} KB) — pick languages, then Recognize.`);
  });

  q('go').addEventListener('click', async () => {
    const f = q('file').files?.[0];
    if (!f) { say('Choose an image first.'); return; }
    const gate = gateOcrFile(f, ctx);
    if (!gate.ok) { say('Rejected: ' + gate.reason); return; }
    // Touch activeCaps explicitly so per-device OCR caps are honored.
    try { ctx.activeCaps && ctx.activeCaps('ocr'); } catch {}
    const langs = q('langs').value;
    q('go').disabled = true;
    setBar(0);
    try {
      say('Loading engine / lang pack (once, then cached)…');
      const text = await recognize(f, {
        langs,
        onLog: m => log(m),
        onProgress: p => { if (p?.progress != null) setBar(p.progress); },
      });
      lastText = text.trim();
      q('out').textContent = lastText || '(no text detected)';
      setBar(null);
      say(`Done — ${lastText.length} chars. Lang pack served from cache on repeat runs.`);
    } catch (e) {
      setBar(null);
      say('Error: ' + (e?.message || e));
    } finally { q('go').disabled = false; }
  });

  q('copy').addEventListener('click', async () => {
    if (!lastText.trim()) { say('Nothing to copy — run Recognize first.'); return; }
    try { await navigator.clipboard.writeText(lastText); say('Copied.'); }
    catch { say('Copy blocked by browser — select the text manually.'); }
  });

  q('dl').addEventListener('click', () => {
    if (!lastText.trim()) { say('Nothing to download — run Recognize first.'); return; }
    const dl = ctx.download;
    const bytes = new TextEncoder().encode(lastText);
    if (typeof dl === 'function') { dl(bytes, 'ocr.txt', 'text/plain'); return; }
    revokeTxt();
    txtUrl = URL.createObjectURL(new Blob([bytes], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = txtUrl;
    a.download = 'ocr.txt';
    document.body.appendChild(a); a.click();
    setTimeout(() => { revokeTxt(); try { a.remove(); } catch {} }, 4000);
  });

  log('mounted');
  function cleanup() {
    if (objUrl) URL.revokeObjectURL(objUrl);
    revokeTxt();
    objUrl = null;
    el.innerHTML = '';
  }
  cleanup.recognize = recognize;
  cleanup.ensureWorker = ensureWorker;
  cleanup.normalizeLangs = normalizeLangs;
  cleanup.langsKey = langsKey;
  cleanup.parseProgress = parseProgress;
  Object.defineProperty(cleanup, 'text', { get: () => lastText });
  return cleanup;
}

export default { mount };
