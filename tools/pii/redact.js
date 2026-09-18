// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pii/redact.js — Aadhaar/PAN masker. Vanilla ES module, zero upload.
// All processing is local (canvas raster + regex/Verhoeff on caller text).
// No fetch, no worker CDN, no OCR upload — nothing leaves the browser.
//
// Model:
//   MANUAL drag-box overlay on canvas is MANDATORY (burn requires >=1 manual box).
//   Auto-detect is an ASSIST over pasted/extracted text (regex + Verhoeff for
//   Aadhaar, format-only for PAN). This tool makes NO OCR-coordinate claims:
//   text hits cannot be mapped to image pixels without an OCR engine, so the
//   assist lists candidates and offers movable placeholder boxes the user drags
//   into place, plus one-click text masking. The image burn is always what the
//   user boxed — solid opaque black raster, re-encoded, pixel-verified.
// Contract: export function mount(el, ctx = {}) -> cleanup function.

import { scanText, maskText, maskedDisplay } from './aadhaar-pan.js';
import { escapeHtml } from '../../core/utils.js';

const DISCLAIMER =
  'Local-only: files/text never upload. Aadhaar check = 12-digit format ' +
  '(first digit 2\u20139) + Verhoeff checksum only \u2014 not UIDAI verification. ' +
  'PAN check = format [A-Z]{5}[0-9]{4}[A-Z] only \u2014 not ITD verification. ' +
  'Auto-detect scans text you provide (no OCR); you must drag boxes over every ' +
  'ID on the image. Burn is irreversible solid-black raster.';

const BLACK = '#000000';
const MIN_BOX = 4; // px, in base-canvas pixels
const TOOL_ID = 'pii-mask';

function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function clampBox(b, W, Hh) {
  const x = Math.min(Math.max(0, Math.round(b.x)), W - 1);
  const y = Math.min(Math.max(0, Math.round(b.y)), Hh - 1);
  const w = Math.min(Math.round(b.w), W - x);
  const hh = Math.min(Math.round(b.h), Hh - y);
  if (w < MIN_BOX || hh < MIN_BOX) return null;
  return { x, y, w, h: hh };
}

/** Burn boxes into a 2D context: solid opaque black raster. */
export function burnBoxesInto(ctx2d, boxes) {
  ctx2d.save();
  ctx2d.globalAlpha = 1;
  ctx2d.globalCompositeOperation = 'source-over';
  ctx2d.fillStyle = BLACK;
  for (const b of boxes) ctx2d.fillRect(b.x, b.y, b.w, b.h);
  ctx2d.restore();
}

/**
 * Verify every box reads back solid opaque black at its center pixel.
 * getPixel(x,y) -> [r,g,b,a]. Returns { ok, failures }.
 */
export function verifySolidBlack(getPixel, boxes) {
  const failures = [];
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    const px = getPixel(b.x + Math.floor(b.w / 2), b.y + Math.floor(b.h / 2));
    if (!(px[0] === 0 && px[1] === 0 && px[2] === 0 && px[3] === 255)) {
      failures.push({ index: i, box: b, pixel: px });
    }
  }
  return { ok: failures.length === 0, failures };
}

export function mount(el, ctx = {}) {
  const log = (...a) => {
    (ctx.log || console.log)('[pii-redact]', ...a);
  };
  if (!el) throw new Error('mount(el): el is required');

  let dead = false;
  el.innerHTML = '';
  const root = h(`<div class="pii-redact" style="display:grid;gap:10px;max-width:760px">
    <p data-f="disclaimer" style="font-size:12px;color:#64748b;border:1px solid #e2e8f0;background:#f8fafc;padding:8px;border-radius:8px"></p>
    <label style="font-size:13px;font-weight:600">Image (local only, never uploads)
      <input data-f="file" type="file" accept="image/*" />
    </label>
    <div data-f="stage" style="position:relative;display:none;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;touch-action:none;user-select:none">
      <canvas data-f="base" style="display:block;width:100%"></canvas>
      <canvas data-f="overlay" style="position:absolute;inset:0;width:100%;height:100%;cursor:crosshair"></canvas>
    </div>
    <p class="muted" data-f="hint" style="font-size:12px;color:#64748b">No image yet. Load an image, then <strong>drag on the image</strong> to draw black-out boxes (mandatory). Alt+click a box to delete it.</p>
    <label style="font-size:13px;font-weight:600">Text to scan (paste OCR / nearby text) — auto-detect assist
      <textarea data-f="text" rows="3" style="width:100%;font:12px/1.5 monospace" placeholder="e.g. My Aadhaar 2345 6789 0123 and PAN ABCDE1234F"></textarea>
    </label>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button data-f="scan">Scan text</button>
      <button data-f="mask">Mask text</button>
      <button data-f="copy">Copy text</button>
      <button data-f="auto">Assist: add movable box per hit</button>
      <button data-f="burn">Burn boxes + re-validate</button>
      <button data-f="dl" disabled>Download redacted PNG</button>
      <button data-f="clear">Clear boxes</button>
    </div>
    <div data-f="cands" style="font-size:13px"></div>
    <div data-f="boxes" style="font-size:13px;color:#475569"></div>
    <div data-f="status" role="status" aria-live="polite" style="font-size:13px;color:#0f172a"></div>
  </div>`);
  el.appendChild(root);
  const q = (s) => root.querySelector(`[data-f="${s}"]`);
  const disclaimerEl = q('disclaimer');
  const fileInput = q('file');
  const stage = q('stage');
  const base = q('base');
  const overlay = q('overlay');
  const area = q('text');
  const btnScan = q('scan');
  const btnMask = q('mask');
  const btnCopy = q('copy');
  const btnAuto = q('auto');
  const btnBurn = q('burn');
  const btnDl = q('dl');
  const btnClear = q('clear');
  const candsEl = q('cands');
  const boxesEl = q('boxes');
  const statusEl = q('status');
  disclaimerEl.textContent = DISCLAIMER;

  const bctx = base.getContext('2d', { willReadFrequently: true });
  const octx = overlay.getContext('2d');

  const state = {
    boxes: [], // {x,y,w,h,source:'manual'|'auto'} in base-canvas pixels
    candidates: [],
    count: 0,
    imgName: 'redacted.png',
    burned: false,
    outBlob: null,
    outUrl: null,
    revealed: new Set(), // candidate indexes revealed via click-to-reveal
  };

  const say = (m) => {
    statusEl.textContent = m;
    log(m);
  };

  function renderOverlay() {
    octx.clearRect(0, 0, overlay.width, overlay.height);
    if (!overlay.width) return;
    // Dim everything slightly so boxes read clearly.
    octx.save();
    octx.fillStyle = 'rgba(15,23,42,0.08)';
    octx.fillRect(0, 0, overlay.width, overlay.height);
    for (const b of state.boxes) {
      octx.fillStyle = 'rgba(0,0,0,0.85)';
      octx.fillRect(b.x, b.y, b.w, b.h);
      octx.strokeStyle = b.source === 'manual' ? '#ef4444' : '#f59e0b';
      octx.lineWidth = Math.max(2, overlay.width / 400);
      octx.setLineDash([8, 5]);
      octx.strokeRect(b.x, b.y, b.w, b.h);
      octx.setLineDash([]);
    }
    octx.restore();
    renderBoxList();
  }

  function renderBoxList() {
    const manual = state.boxes.filter((b) => b.source === 'manual').length;
    boxesEl.innerHTML =
      state.boxes.length === 0
        ? 'Boxes: none yet — <strong>drag on the image to add a manual box (required before burn).</strong>'
        : `Boxes: ${state.boxes.length} (${manual} manual) ` +
          state.boxes
            .map(
              (b, i) =>
                `<span style="display:inline-block;margin:2px 4px 2px 0;border:1px solid #cbd5e1;border-radius:6px;padding:1px 6px">` +
                `#${i + 1} ${b.w}\u00d7${b.h}@${b.x},${b.y} [${b.source}] <a href="#" data-del="${i}" aria-label="delete box ${i + 1}">\u2715</a></span>`,
            )
            .join('');
    boxesEl.querySelectorAll('[data-del]').forEach((a) =>
      a.addEventListener('click', (e) => {
        e.preventDefault();
        state.boxes.splice(Number(a.dataset.del), 1);
        state.burned = false;
        renderOverlay();
      }),
    );
  }

  function renderCandidates(res) {
    if (!res.all.length) {
      candsEl.innerHTML = '<span style="color:#16a34a">Scan: 0 candidates — clean.</span>';
      return;
    }
    candsEl.innerHTML =
      `Scan: <strong>${res.count}</strong> actionable (${res.validAadhaar.length} Verhoeff-valid Aadhaar, ${res.pan.length} PAN-format)` +
      '<ul style="margin:6px 0;padding-left:18px">' +
      res.all
        .map((c, i) => {
          const tag =
            c.kind === 'pan'
              ? '<span style="color:#2563eb">PAN format-only</span>'
              : c.valid
                ? '<span style="color:#16a34a">Aadhaar Verhoeff-valid</span>'
                : '<span style="color:#b45309">Aadhaar-shaped, Verhoeff FAIL (review)</span>';
          // Masked by default (XXXX-1234); click-to-reveal shows raw once.
          const shown = state.revealed.has(i) ? c.raw : maskedDisplay(c);
          const esc = escapeHtml(shown);
          const toggle = state.revealed.has(i) ? 'hide' : 'show';
          return `<li><code>${esc}</code> — ${tag} <button data-reveal="${i}" style="font-size:12px" aria-label="${toggle} full value">${toggle}</button></li>`;
        })
        .join('') +
      '</ul><p class="muted" style="font-size:12px">Values masked by default — click show to reveal once.</p>';
    candsEl.querySelectorAll('[data-reveal]').forEach((b) =>
      b.addEventListener('click', () => {
        const i = Number(b.dataset.reveal);
        if (state.revealed.has(i)) state.revealed.delete(i);
        else state.revealed.add(i);
        renderCandidates({ ...res });
      }),
    );
  }

  function scan() {
    const res = scanText(area.value);
    state.candidates = res.all;
    state.count = res.count;
    state.revealed = new Set();
    renderCandidates(res);
    say(
      res.count === 0
        ? 'Scan: 0 actionable candidates.'
        : `Scan: ${res.count} actionable candidate(s). Drag boxes over each on the image.`,
    );
    return res;
  }

  /** Mask actionable spans in the textarea (one-click text masking). */
  function maskNow() {
    const { text: maskedText, masked } = maskText(area.value);
    area.value = maskedText;
    const after = scan();
    say(masked > 0 ? `Masked ${masked} span(s). Post-mask rescan: ${after.count} remaining.` : 'Nothing actionable to mask.');
    return { masked, remaining: after.count };
  }

  /** Copy with warning when live IDs are still present. */
  async function copyText() {
    const res = scanText(area.value);
    if (res.count > 0) {
      const ok = typeof window.confirm === 'function'
        ? window.confirm(`Warning: ${res.count} live ID(s) still in the text. Copy anyway? Mask first if this leaves the device.`)
        : false;
      if (!ok) {
        say(`Copy blocked: ${res.count} live ID(s) present — mask or clear first.`);
        return { copied: false, reason: 'ids-present' };
      }
    }
    try {
      await navigator.clipboard.writeText(area.value);
      say('Copied to clipboard.');
      return { copied: true };
    } catch {
      // Fallback for non-secure contexts: select + execCommand.
      try {
        area.focus(); area.select();
        const ok = document.execCommand('copy');
        say(ok ? 'Copied to clipboard.' : 'Copy failed — select and copy manually.');
        return { copied: !!ok };
      } catch (e) {
        say('Copy failed: ' + (e?.message || e));
        return { copied: false, reason: 'clipboard-error' };
      }
    }
  }

  /** Assist: one movable placeholder box per actionable hit (user must place). */
  function addAutoBoxes() {
    if (!base.width) {
      say('Load an image first — assist boxes need image dimensions.');
      return [];
    }
    const res = scanText(area.value);
    state.candidates = res.all;
    state.count = res.count;
    state.revealed = new Set();
    renderCandidates(res);
    const actionable = [...res.validAadhaar, ...res.pan];
    if (!actionable.length) {
      say('Assist: no actionable hits — nothing to box.');
      return [];
    }
    const W = base.width;
    const Hh = base.height;
    const bw = Math.round(W * 0.7);
    const bh = Math.max(MIN_BOX, Math.round(Hh * 0.06));
    actionable.forEach((_, i) => {
      const stacked = {
        x: Math.round(W * 0.15),
        y: Math.round(10 + i * (bh + 8)),
        w: bw,
        h: bh,
        source: 'auto',
      };
      const c = clampBox(stacked, W, Hh);
      if (c) state.boxes.push({ ...c, source: 'auto' });
    });
    state.burned = false;
    renderOverlay();
    say(
      `Assist: added ${actionable.length} movable box(es). DRAG them over the IDs — burn still needs ≥1 manual box.`,
    );
    return state.boxes;
  }

  /** Re-validate current text: returns rescan result (expect 0 after burn). */
  function rescan() {
    return scanText(area.value);
  }

  /**
   * Burn: solid-black raster fill of every box, re-encode PNG, pixel-verify,
   * mask actionable text spans, then rescan (must be 0 actionable).
   */
  async function burn() {
    if (!base.width) {
      say('Load an image first.');
      return { ok: false, reason: 'no-image' };
    }
    if (!state.boxes.length) {
      say('Draw at least one manual drag-box first — burn refused with 0 boxes.');
      return { ok: false, reason: 'no-boxes' };
    }
    if (!state.boxes.some((b) => b.source === 'manual')) {
      say('Burn requires ≥1 MANUAL drag-box (auto-assist alone is not enough). Drag a box on the image.');
      return { ok: false, reason: 'no-manual-box' };
    }
    // 1) Raster burn: opaque black, full overwrite.
    burnBoxesInto(bctx, state.boxes);
    renderOverlay();

    // 2) Pixel-verify each box center is (0,0,0,255).
    const getPixel = (x, y) => Array.from(bctx.getImageData(x, y, 1, 1).data);
    const pv = verifySolidBlack(getPixel, state.boxes);
    if (!pv.ok) {
      say(`Burn FAILED pixel check on ${pv.failures.length} box(es) — not sharing.`);
      return { ok: false, reason: 'pixel-check', failures: pv.failures };
    }

    // 3) Re-encode (drops any metadata path; proves raster is self-contained).
    const blob = await new Promise((res, rej) =>
      base.toBlob((b) => (b ? res(b) : rej(new Error('PNG re-encode failed'))), 'image/png'),
    );
    if (state.outUrl) { try { URL.revokeObjectURL(state.outUrl); } catch {} }
    state.outBlob = blob;
    state.outUrl = URL.createObjectURL(blob);
    btnDl.disabled = false;
    btnDl.textContent = `Download redacted PNG (${(blob.size / 1024).toFixed(1)} KB)`;

    // Confirm the re-encoded bytes decode to the same dimensions.
    await new Promise((res, rej) => {
      const img = new Image();
      const url = state.outUrl;
      img.onload = () => {
        const same = img.naturalWidth === base.width && img.naturalHeight === base.height;
        try { URL.revokeObjectURL(url); } catch {}
        state.outUrl = URL.createObjectURL(blob); // re-issue (onload revoke consumed it)
        btnDl.href = state.outUrl;
        btnDl.download = state.imgName;
        if (!same) rej(new Error('re-encoded dimensions changed'));
        else res();
      };
      img.onerror = () => rej(new Error('re-encoded PNG did not decode'));
      img.src = url;
    });

    // 4) Mask actionable text spans so rescan is clean, then re-validate.
    const { text: maskedText, masked } = maskText(area.value);
    area.value = maskedText;
    const after = rescan();
    state.count = after.count;
    state.candidates = after.all;
    state.revealed = new Set();
    renderCandidates(after);
    state.burned = after.count === 0;
    if (after.count === 0) {
      say(
        `Burned ${state.boxes.length} box(es) to solid black, re-encoded PNG (${(blob.size / 1024).toFixed(1)} KB), ` +
          `pixel-verified, masked ${masked} text span(s). Post-burn rescan: 0 candidates — clean.`,
      );
    } else {
      say(
        `Burned pixels OK but rescan still finds ${after.count} actionable candidate(s) — ` +
          'cover them with boxes / clear the text, then burn again before sharing.',
      );
    }
    return {
      ok: after.count === 0,
      boxes: state.boxes.length,
      masked,
      bytes: blob.size,
      rescan: after.count,
    };
  }

  function download() {
    if (!state.outBlob) {
      say('Burn first, then download.');
      return;
    }
    const dl = ctx.download;
    if (typeof dl === 'function') {
      dl(state.outBlob, state.imgName, 'image/png');
      return;
    }
    const a = document.createElement('a');
    a.href = state.outUrl;
    a.download = state.imgName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // ---- image loading (local only) ----
  function loadFile(file) {
    return new Promise((res, rej) => {
      if (!file) { rej(new Error('no file')); return; }
      // Re-validate against caps when the host provides checkFiles.
      if (typeof ctx.checkFiles === 'function') {
        try {
          const r = ctx.checkFiles([file], { toolId: TOOL_ID, accept: 'image/*', multiple: false });
          const rejHit = (r?.rejected || []).find((x) => x.file === file);
          if (rejHit) { rej(new Error(rejHit.reason)); return; }
        } catch (e) { log('checkFiles non-fatal:', e?.message || e); }
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        base.width = img.naturalWidth;
        base.height = img.naturalHeight;
        overlay.width = img.naturalWidth;
        overlay.height = img.naturalHeight;
        bctx.globalAlpha = 1;
        bctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        stage.style.display = 'block';
        state.boxes = [];
        state.burned = false;
        state.imgName = (String(file.name || 'image')).replace(/\.[a-z0-9]+$/i, '') + '.redacted.png';
        btnDl.disabled = true;
        btnDl.removeAttribute('href');
        renderOverlay();
        say(`Loaded ${img.naturalWidth}\u00d7${img.naturalHeight} locally. Drag boxes over every ID.`);
        res({ w: img.naturalWidth, h: img.naturalHeight });
      };
      img.onerror = () => {
        try { URL.revokeObjectURL(url); } catch {}
        rej(new Error('could not decode image'));
      };
      img.src = url;
    });
  }

  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (f) loadFile(f).catch((e) => say('Load failed: ' + e.message));
  });

  // ---- mandatory manual drag-box overlay (mouse + touch) ----
  let drag = null; // {x0,y0} in base-canvas pixels
  const toCanvas = (e) => {
    const r = overlay.getBoundingClientRect();
    const sx = overlay.width / r.width;
    const sy = overlay.height / r.height;
    return {
      x: (e.clientX - r.left) * sx,
      y: (e.clientY - r.top) * sy,
    };
  };
  const hitBox = (p) => {
    for (let i = state.boxes.length - 1; i >= 0; i--) {
      const b = state.boxes[i];
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return i;
    }
    return -1;
  };

  overlay.addEventListener('mousedown', (e) => {
    if (!base.width) return;
    const p = toCanvas(e);
    const hit = hitBox(p);
    if (e.altKey && hit >= 0) {
      state.boxes.splice(hit, 1);
      state.burned = false;
      renderOverlay();
      return;
    }
    drag = { x0: p.x, y0: p.y, moved: false };
    e.preventDefault();
  });
  overlay.addEventListener('mousemove', (e) => {
    if (!drag) return;
    const p = toCanvas(e);
    if (Math.hypot(p.x - drag.x0, p.y - drag.y0) > 3) drag.moved = true;
    renderOverlay();
    // Live rubber-band (manual, not yet committed).
    const x = Math.min(drag.x0, p.x);
    const y = Math.min(drag.y0, p.y);
    const w = Math.abs(p.x - drag.x0);
    const hh = Math.abs(p.y - drag.y0);
    octx.save();
    octx.strokeStyle = '#ef4444';
    octx.lineWidth = Math.max(2, overlay.width / 400);
    octx.setLineDash([8, 5]);
    octx.strokeRect(x, y, w, hh);
    octx.restore();
  });
  window.addEventListener('mouseup', (e) => {
    if (!drag) return;
    const p = toCanvas(e);
    const raw = {
      x: Math.min(drag.x0, p.x),
      y: Math.min(drag.y0, p.y),
      w: Math.abs(p.x - drag.x0),
      h: Math.abs(p.y - drag.y0),
    };
    drag = null;
    if (!base.width) return;
    const c = clampBox({ ...raw, source: 'manual' }, base.width, base.height);
    if (c) {
      state.boxes.push({ ...c, source: 'manual' }); // every drag commit = manual
      state.burned = false;
      say(`Manual box #${state.boxes.length} added (${c.w}\u00d7${c.h}).`);
    }
    renderOverlay();
  });
  // Touch support: one-finger drag draws; coordinates via touches[0].
  overlay.addEventListener(
    'touchstart',
    (e) => {
      if (!base.width) return;
      const t = e.touches[0];
      const p = toCanvas(t);
      drag = { x0: p.x, y0: p.y, moved: false };
      e.preventDefault();
    },
    { passive: false },
  );
  overlay.addEventListener(
    'touchmove',
    (e) => {
      if (!drag) return;
      e.preventDefault();
      renderOverlay();
      const t = e.touches[0];
      const p = toCanvas(t);
      octx.save();
      octx.strokeStyle = '#ef4444';
      octx.setLineDash([8, 5]);
      octx.strokeRect(Math.min(drag.x0, p.x), Math.min(drag.y0, p.y), Math.abs(p.x - drag.x0), Math.abs(p.y - drag.y0));
      octx.restore();
    },
    { passive: false },
  );
  overlay.addEventListener('touchend', (e) => {
    if (!drag) return;
    const t = e.changedTouches[0];
    const p = toCanvas(t);
    const c = clampBox(
      { x: Math.min(drag.x0, p.x), y: Math.min(drag.y0, p.y), w: Math.abs(p.x - drag.x0), h: Math.abs(p.y - drag.y0) },
      base.width,
      base.height,
    );
    drag = null;
    if (c) {
      state.boxes.push({ ...c, source: 'manual' });
      state.burned = false;
      say(`Manual box #${state.boxes.length} added (touch).`);
    }
    renderOverlay();
  });

  btnScan.addEventListener('click', scan);
  if (btnMask) btnMask.addEventListener('click', maskNow);
  if (btnCopy) btnCopy.addEventListener('click', () => copyText().catch((e) => say('Copy failed: ' + (e?.message || e))));
  btnAuto.addEventListener('click', addAutoBoxes);
  btnBurn.addEventListener('click', () => burn().catch((e) => say('Burn failed: ' + (e?.message || e))));
  btnDl.addEventListener('click', download);
  btnClear.addEventListener('click', () => {
    state.boxes = [];
    state.burned = false;
    renderOverlay();
    say('Boxes cleared. Drag new manual boxes before burning.');
  });

  // Preset text / image from ctx (tests, host apps). Still 100% local.
  if (typeof ctx.text === 'string') area.value = ctx.text;
  if (ctx.image) {
    const f = ctx.image;
    if (f instanceof Blob) loadFile(new File([f], f.name || 'image.png', { type: f.type || 'image/png' })).catch(() => {});
    else if (typeof f === 'string') {
      const img = new Image();
      img.onload = () => {
        base.width = img.naturalWidth;
        base.height = img.naturalHeight;
        overlay.width = img.naturalWidth;
        overlay.height = img.naturalHeight;
        bctx.drawImage(img, 0, 0);
        stage.style.display = 'block';
        renderOverlay();
      };
      img.src = f;
    }
  }

  log('mounted. ' + DISCLAIMER);

  // Router contract: return a cleanup function. Auto-clear sensitive state on unmount.
  function cleanup() {
    if (dead) return;
    dead = true;
    try { if (state.outUrl) URL.revokeObjectURL(state.outUrl); } catch {}
    state.outUrl = null; state.outBlob = null;
    state.boxes = []; state.candidates = []; state.count = 0;
    state.revealed = new Set(); state.burned = false;
    try { area.value = ''; } catch {}
    try { fileInput.value = ''; } catch {}
    el.innerHTML = '';
    log('unmounted (state auto-cleared)');
  }
  // Backward-compat test hooks attached to the function (still typeof function).
  cleanup.scan = scan;
  cleanup.rescan = rescan;
  cleanup.burn = burn;
  cleanup.maskNow = maskNow;
  cleanup.copyText = copyText;
  cleanup.addAutoBoxes = addAutoBoxes;
  cleanup.getBoxes = () => state.boxes.map((b) => ({ ...b }));
  cleanup.addBox = (box, source = 'manual') => {
    if (!base.width) throw new Error('load an image first');
    const c = clampBox(box, base.width, base.height);
    if (!c) throw new Error('box too small/out of bounds');
    state.boxes.push({ ...c, source });
    state.burned = false;
    renderOverlay();
    return state.boxes.length;
  };
  cleanup.clearBoxes = () => { state.boxes = []; renderOverlay(); };
  cleanup.getCandidates = () => state.candidates.map((c) => ({ ...c }));
  cleanup.getStatus = () => ({
    boxes: state.boxes.length,
    manual: state.boxes.filter((b) => b.source === 'manual').length,
    candidates: state.count,
    burned: state.burned,
    bytes: state.outBlob?.size ?? 0,
  });
  Object.defineProperty(cleanup, 'output', { get: () => state.outBlob });
  Object.defineProperty(cleanup, 'text', { get: () => area.value, set: (v) => { area.value = String(v); } });
  cleanup.disclaimer = DISCLAIMER;
  return cleanup;
}

export default { mount, burnBoxesInto, verifySolidBlack };
