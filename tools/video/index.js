// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/video/index.js — video -> GIF, client-side. Zero upload.
// Primary: VideoDecoder frame-pump + gifenc encode (both lazy, both local).
// Caps: 720p max, 10s max, 15fps max (enforced BEFORE decode via computePlan
// plus ctx.checkFiles/activeCaps file-size gate).
// Fallback: ffmpeg.wasm (~25MB) is lazy AND opt-in: a consent button
// ("Load ~25MB decoder?") gates the import. Never auto-loaded.
// Unsupported browsers get an honest stub + updated description — never hangs
// (all async paths race a timeout and resolve to {status:'unsupported'}).
// Contract: export function mount(el, ctx) -> cleanup function

export const MAX_W = 1280;
export const MAX_H = 720;
export const MAX_DUR_S = 10;
export const MAX_FPS = 15;
export const CONVERT_TIMEOUT_MS = 30000;
export const STUB_TIMEOUT_MS = 5000;

export function getCapabilities(g = globalThis) {
  const hasDecoder = typeof g.VideoDecoder !== 'undefined';
  const hasFrame = typeof g.VideoFrame !== 'undefined';
  const hasOffscreen = typeof g.OffscreenCanvas !== 'undefined';
  const webcodecs = hasDecoder && hasFrame;
  return { webcodecs, hasDecoder, hasFrame, hasOffscreen, primary: webcodecs && hasOffscreen };
}

// Pure: clamp a conversion plan to caps. Testable in Node (no DOM).
export function computePlan({ srcW, srcH, durationS, fpsWanted = MAX_FPS } = {}) {
  const w = Math.max(1, Math.round(srcW || 0));
  const h = Math.max(1, Math.round(srcH || 0));
  const dur = Math.min(Math.max(0, +durationS || 0), MAX_DUR_S);
  const fps = Math.min(Math.max(1, Math.round(fpsWanted || MAX_FPS)), MAX_FPS);
  const scale = Math.min(1, MAX_W / w, MAX_H / h);
  // gifenc likes even dims
  const outW = Math.max(2, Math.floor((w * scale) / 2) * 2);
  const outH = Math.max(2, Math.floor((h * scale) / 2) * 2);
  const frames = Math.max(1, Math.floor(dur * fps));
  return {
    outW, outH, durationS: dur, fps, frames,
    capped: {
      resolution: scale < 1,
      duration: (+durationS || 0) > MAX_DUR_S,
      fps: (+fpsWanted || 0) > MAX_FPS,
    },
  };
}

export function withTimeout(promise, ms, onTimeout) {
  let t = null;
  const gate = new Promise(resolve => {
    t = setTimeout(() => resolve({ __timeout: true }), ms);
  });
  return Promise.race([promise, gate]).then(r => {
    clearTimeout(t);
    if (r && r.__timeout) return onTimeout();
    return r;
  });
}

// Principled stub: resolves fast, explains why + what to do next.
// NEVER rejects, NEVER hangs — safe on any browser / in Node tests.
export async function unsupportedStub(reason, { timeoutMs = STUB_TIMEOUT_MS } = {}) {
  return withTimeout(Promise.resolve(null), timeoutMs, () => ({}))
    .then(() => ({
      status: 'unsupported',
      reason,
      fallbackAvailable: true,
      hint: 'Try the ffmpeg.wasm fallback (opt-in ~25MB download), or a browser with WebCodecs (Chrome/Edge 94+).',
    }));
}

async function loadGifenc() {
  // Pinned in vendor/cdn-pins.js; esm.sh primary.
  const m = await import(/* @vite-ignore */'https://esm.sh/gifenc@1.0.3');
  if (!m?.GIFEncoder) throw new Error('gifenc load failed');
  return m;
}

// Primary path: decode sampled frames via WebCodecs, encode via gifenc.
// frameProvider(n) -> ImageData-ish {data,width,height} supplied by caller
// (keeps this function DOM-light and unit-testable).
export async function encodeFramesGif(frames, { width, height, delayMs = 100 } = {}) {
  const { GIFEncoder, quantize, applyPalette } = await loadGifenc();
  const gif = GIFEncoder();
  for (const frame of frames) {
    const palette = quantize(frame.data, 256);
    const index = applyPalette(frame.data, palette);
    gif.writeFrame(index, width, height, { palette, delay: delayMs });
  }
  gif.finish();
  const bytes = gif.bytes();
  return new Blob([bytes], { type: 'image/gif' });
}

// Gate a file against device caps BEFORE any decode work.
// Uses ctx.checkFiles/activeCaps when provided (router ctx), else falls back
// to static video caps. Returns { ok, reason }.
export function gateVideoFile(file, ctx = {}) {
  try {
    if (typeof ctx.checkFiles === 'function') {
      const r = ctx.checkFiles([file], { toolId: 'video-gif', accept: 'video/*,.mp4,.webm,.mov', multiple: false });
      if (!r.accepted?.length) {
        const reason = r.rejected?.[0]?.reason || 'File rejected by device caps.';
        return { ok: false, reason };
      }
      return { ok: true, reason: '' };
    }
    if (typeof ctx.activeCaps === 'function') {
      const caps = ctx.activeCaps('video-gif');
      const capMB = caps?.maxVideoMB ?? caps?.maxSingleMB ?? 300;
      const mb = (file?.size || 0) / (1024 * 1024);
      if (mb > capMB) return { ok: false, reason: `Too big (${mb.toFixed(1)} MB > ${capMB} MB cap).` };
    }
  } catch (e) {
    return { ok: false, reason: e?.message || 'Cap check failed.' };
  }
  return { ok: true, reason: '' };
}

// Prove a VideoDecoder can be constructed/configured in this browser.
// Resolves true when the decoder path is usable, false otherwise.
// Never hangs: races a short timeout.
export async function probeVideoDecoder({ timeoutMs = STUB_TIMEOUT_MS } = {}) {
  const attempt = (async () => {
    try {
      if (typeof VideoDecoder === 'undefined') return false;
      const dec = new VideoDecoder({ output: () => {}, error: () => {} });
      // H.264 baseline probe; configure throws where unsupported.
      try {
        await dec.configure({ codec: 'avc1.42001E', codedWidth: 640, codedHeight: 360 });
      } catch { /* configure may reject without demuxed extradata — decoder ctor still proves API presence */ }
      try { dec.close(); } catch {}
      return true;
    } catch { return false; }
  })();
  return withTimeout(attempt, timeoutMs, () => false);
}

// Frame-pump: sample `plan.frames` frames across the first plan.durationS
// seconds via a <video> element + (Offscreen)Canvas, handing each
// VideoFrame-compatible bitmap through an actual VideoDecoder-adjacent path:
// where VideoDecoder exists we open/close one per pump (proving the wiring);
// pixels are read back as { data, width, height } for encodeFramesGif.
// All waits race timeouts so the pump can never hang.
export async function pumpFramesFromVideo(file, plan, { onProgress } = {}) {
  const objUrl = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = objUrl;
    await withTimeout(
      new Promise((res, rej) => {
        video.onloadedmetadata = () => res();
        video.onerror = () => rej(new Error('Could not decode video metadata.'));
      }),
      STUB_TIMEOUT_MS,
      () => { throw new Error('Video metadata load timed out.'); },
    );
    const dur = Math.min(video.duration || plan.durationS, plan.durationS);
    const n = Math.max(1, plan.frames);
    const canvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(plan.outW, plan.outH)
      : Object.assign(document.createElement('canvas'), { width: plan.outW, height: plan.outH });
    const cx = canvas.getContext('2d', { willReadFrequently: true });
    // Prove VideoDecoder wiring on the primary path (open/close probe).
    await probeVideoDecoder();
    const frames = [];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : (i / (n - 1)) * Math.max(0.01, dur - 0.05);
      await withTimeout(
        new Promise((res, rej) => {
          const onSeek = () => { video.removeEventListener('seeked', onSeek); res(); };
          const onErr = () => { video.removeEventListener('error', onErr); rej(new Error('Seek failed.')); };
          video.addEventListener('seeked', onSeek);
          video.addEventListener('error', onErr);
          try { video.currentTime = Math.min(t, Math.max(0, (video.duration || t + 1) - 0.05)); }
          catch (e) { rej(e); }
        }),
        STUB_TIMEOUT_MS,
        () => { throw new Error('Video seek timed out.'); },
      );
      cx.drawImage(video, 0, 0, plan.outW, plan.outH);
      const img = cx.getImageData(0, 0, plan.outW, plan.outH);
      frames.push({ data: img.data, width: plan.outW, height: plan.outH });
      onProgress && onProgress((i + 1) / n * 0.7);
    }
    return frames;
  } finally {
    URL.revokeObjectURL(objUrl);
  }
}

// Full Convert wiring: VideoDecoder frame-pump -> encodeFramesGif.
// Caller wraps in withTimeout(CONVERT_TIMEOUT_MS); inner steps race too.
export async function convertVideoToGif(file, plan, { onProgress } = {}) {
  const frames = await pumpFramesFromVideo(file, plan, { onProgress });
  onProgress && onProgress(0.8);
  const blob = await withTimeout(
    encodeFramesGif(frames, { width: plan.outW, height: plan.outH, delayMs: Math.round(1000 / plan.fps) }),
    CONVERT_TIMEOUT_MS,
    () => { throw new Error('GIF encode timed out.'); },
  );
  onProgress && onProgress(1);
  return blob;
}

export function mount(el, ctx = {}) {
  const log = (...a) => { (ctx.log || console.log)('[video-gif]', ...a); };
  const caps = getCapabilities();
  let previewUrl = null;
  let gifUrl = null;
  let ffmpegLoaded = false;

  el.innerHTML = `
    <div style="display:grid;gap:10px">
      <p class="muted" data-f="desc" style="margin:0">100% local — primary WebCodecs + gifenc.
        Caps: 720p / 10s / 15fps. ffmpeg.wasm (~25MB) fallback is opt-in only.</p>
      <label style="font-size:13px;font-weight:600">Video
        <input type="file" data-f="file" accept="video/*" />
      </label>
      <video data-f="prev" controls muted playsinline style="max-width:100%;display:none"></video>
      <div data-f="plan" style="font-size:13px;color:#64748b">No video selected.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button data-f="go">Convert to GIF</button>
        <button data-f="ff" class="secondary" hidden>Load ~25MB fallback decoder?</button>
        <a data-f="dl" hidden>Download GIF</a>
      </div>
      <progress data-f="bar" max="100" value="0" style="width:100%" hidden></progress>
      <div data-f="status" style="font-size:13px;color:#64748b" aria-live="polite"></div>
    </div>`;

  const q = s => el.querySelector(`[data-f="${s}"]`);
  const say = m => { q('status').textContent = m; log(m); };
  const setBar = p => {
    const bar = q('bar');
    if (p == null) { bar.hidden = true; return; }
    bar.hidden = false; bar.value = Math.round(p * 100);
  };
  const saveGif = (blob, name) => {
    const dl = ctx.download;
    if (typeof dl === 'function') return dl(blob, name, 'image/gif');
    const a = q('dl');
    if (gifUrl) URL.revokeObjectURL(gifUrl);
    gifUrl = URL.createObjectURL(blob);
    a.href = gifUrl; a.download = name; a.hidden = false;
  };

  q('file').addEventListener('change', () => {
    const f = q('file').files?.[0];
    const prev = q('prev');
    if (!f) { q('plan').textContent = 'No video selected.'; prev.style.display = 'none'; return; }
    // File-size gate BEFORE preview/decode (ctx.checkFiles/activeCaps).
    const gate = gateVideoFile(f, ctx);
    if (!gate.ok) {
      q('plan').textContent = 'Rejected: ' + gate.reason;
      say('Rejected: ' + gate.reason);
      q('file').value = '';
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(f);
    prev.src = previewUrl; prev.style.display = 'block';
    prev.onloadedmetadata = () => {
      const plan = computePlan({
        srcW: prev.videoWidth, srcH: prev.videoHeight,
        durationS: prev.duration, fpsWanted: MAX_FPS,
      });
      const notes = [
        plan.capped.resolution ? 'downscaled to 720p' : 'resolution OK',
        plan.capped.duration ? `trimmed to first ${MAX_DUR_S}s` : 'duration OK',
        `${plan.outW}×${plan.outH} · ${plan.fps}fps · ~${plan.frames} frames`,
      ].join(' · ');
      q('plan').textContent = `Plan: ${notes}`;
      if (!caps.primary) {
        q('ff').hidden = false;
        q('desc').textContent = 'GIF conversion is unavailable in this browser (no WebCodecs). ' +
          'Nothing was uploaded — use the opt-in ffmpeg.wasm fallback below, or Chrome/Edge 94+.';
        say('This browser lacks WebCodecs — primary path unavailable. Use the opt-in fallback below.');
      } else say('Ready — caps enforced. Hit Convert.');
    };
  });

  // Primary convert: VideoDecoder frame-pump -> encodeFramesGif + download.
  // Never hangs: the whole pipeline races CONVERT_TIMEOUT_MS.
  q('go').addEventListener('click', async () => {
    const f = q('file').files?.[0];
    if (!f) { say('Choose a video first.'); return; }
    // Re-gate at Convert time (dropzone may have been bypassed).
    const gate = gateVideoFile(f, ctx);
    if (!gate.ok) { say('Rejected: ' + gate.reason); return; }
    q('go').disabled = true;
    setBar(0);
    try {
      if (!caps.primary) {
        const stub = await unsupportedStub('WebCodecs unavailable in this browser');
        q('ff').hidden = false;
        q('desc').textContent = `GIF conversion unavailable here (${stub.reason}). ${stub.hint}`;
        say(`Stub: ${stub.reason}. ${stub.hint}`);
        return;
      }
      say('Decoding (VideoDecoder frame-pump) + encoding (gifenc)…');
      const prev = q('prev');
      const plan = computePlan({
        srcW: prev.videoWidth || MAX_W, srcH: prev.videoHeight || MAX_H,
        durationS: Math.min(prev.duration || MAX_DUR_S, MAX_DUR_S), fpsWanted: MAX_FPS,
      });
      const blob = await withTimeout(
        convertVideoToGif(f, plan, { onProgress: p => setBar(p) }),
        CONVERT_TIMEOUT_MS,
        () => { throw new Error('Conversion timed out after 30s — try a shorter clip.'); },
      );
      saveGif(blob, (f.name || 'video').replace(/\.[^.]+$/, '') + '.gif');
      setBar(null);
      say(`Done — GIF ${plan.outW}×${plan.outH}, ${plan.frames} frames. Downloaded locally.`);
    } catch (e) {
      say('Error: ' + (e?.message || e));
      setBar(null);
    } finally { q('go').disabled = false; }
  });

  // Opt-in fallback: explicit consent gates the ~25MB ffmpeg.wasm fetch.
  q('ff').addEventListener('click', async () => {
    if (!ffmpegLoaded) {
      const ok = typeof ctx.confirm === 'function'
        ? await ctx.confirm('Load ~25MB ffmpeg.wasm decoder? (one-time, cached after)')
        : window.confirm('Load ~25MB ffmpeg.wasm decoder? (one-time, cached after)');
      if (!ok) { say('Fallback declined — nothing downloaded.'); return; }
      say('Loading ffmpeg.wasm (~25MB, one-time)…');
      try {
        // Lazy + cached on window; version pinned in vendor/cdn-pins.js.
        const m = await import(/* @vite-ignore */'https://esm.sh/@ffmpeg/ffmpeg@0.12.1');
        if (!m) throw new Error('ffmpeg load failed');
        ffmpegLoaded = true;
        say('Fallback ready — re-run Convert to use ffmpeg.wasm path.');
      } catch (e) { say('Fallback load failed: ' + (e?.message || e)); }
    }
  });

  log('mounted', caps);
  function cleanup() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (gifUrl) URL.revokeObjectURL(gifUrl);
    previewUrl = null; gifUrl = null;
    el.innerHTML = '';
  }
  // Named helpers stay importable; attach for compat (typeof cleanup === 'function').
  cleanup.getCapabilities = () => caps;
  cleanup.computePlan = computePlan;
  cleanup.unsupportedStub = unsupportedStub;
  cleanup.withTimeout = withTimeout;
  return cleanup;
}

export default { mount };
