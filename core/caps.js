// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava. Source-available - see /LICENSE. Commercial use requires permission: rajat242003@gmail.com.
/**
 * Device caps: keep tools usable on phones (memory, CPU, offline cache).
 * Router/dropzone consult these before accepting files. Tools may add
 * per-tool overrides via TOOL_CAPS.
 */

export const CAPS = {
  desktop: { maxSingleMB: 200, maxTotalMB: 500, maxFiles: 50, maxVideoMB: 300, maxImageDim: 12000 },
  mobile: { maxSingleMB: 50, maxTotalMB: 150, maxFiles: 20, maxVideoMB: 100, maxImageDim: 8000 },
};

/** Per-tool tightening (merged over the active profile). */
export const TOOL_CAPS = {
  'video-gif': { mobile: { maxSingleMB: 100, maxTotalMB: 150 } },
  ocr: { mobile: { maxSingleMB: 25, maxTotalMB: 100 } },
};

export function isMobile() {
  try {
    if (window.matchMedia?.('(pointer: coarse)').matches) return true;
  } catch { /* ignore */ }
  return (navigator.userAgentData?.mobile
    ?? /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || ''))
    || (window.innerWidth || 1024) < 768;
}

export function activeCaps(toolId) {
  const mobile = isMobile();
  const base = { ...(mobile ? CAPS.mobile : CAPS.desktop) };
  const over = TOOL_CAPS[toolId]?.[mobile ? 'mobile' : 'desktop'];
  return { mobile, ...base, ...over };
}

function acceptMatches(file, accept) {
  if (!accept || accept.trim() === '' || accept.trim() === '*/*') return true;
  const name = (file.name || '').toLowerCase();
  const type = (file.type || '').toLowerCase();
  return accept.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).some((rule) => {
    if (rule === '*/*') return true;
    if (rule.startsWith('.')) return name.endsWith(rule);
    if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1));
    return type === rule;
  });
}

/**
 * Validate a file list against caps. Never rejects the whole batch:
 * returns { accepted, rejected: [{ file, reason }] } so the UI can explain.
 */
export function checkFiles(files, { toolId = '', accept = '*/*', multiple = true } = {}) {
  const caps = activeCaps(toolId);
  const list = [...(files || [])];
  const accepted = [];
  const rejected = [];
  const push = (file, reason) => rejected.push({ file, reason });

  if (!multiple && list.length > 1) {
    list.slice(1).forEach((f) => push(f, 'This tool takes a single file.'));
  }
  const eligible = multiple ? list : list.slice(0, 1);
  if (eligible.length > caps.maxFiles) {
    eligible.slice(caps.maxFiles).forEach((f) => push(f, `Max ${caps.maxFiles} files on this device.`));
  }
  let total = 0;
  for (const f of eligible.slice(0, caps.maxFiles)) {
    if (!acceptMatches(f, accept)) {
      push(f, `Type not accepted (${f.type || 'unknown'}).`);
      continue;
    }
    const mb = f.size / (1024 * 1024);
    const singleCap = f.type.startsWith('video/') ? caps.maxVideoMB : caps.maxSingleMB;
    if (mb > singleCap) {
      push(f, `Too big (${mb.toFixed(1)} MB > ${singleCap} MB ${caps.mobile ? 'mobile' : 'desktop'} cap).`);
      continue;
    }
    if ((total + f.size) / (1024 * 1024) > caps.maxTotalMB) {
      push(f, `Batch would exceed ${caps.maxTotalMB} MB total cap.`);
      continue;
    }
    total += f.size;
    accepted.push(f);
  }
  return { ok: rejected.length === 0 && accepted.length > 0, accepted, rejected, caps };
}
