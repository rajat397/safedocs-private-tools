// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// TeaserGuard.client: mirror of server TeaserGuard. Locked tracks render
// placeholder only — no task detail, no bypass path exists by construction.
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function isUnlocked(track, entitlement) {
  if (!track || typeof track.id !== 'string') return false;
  const unlocked = entitlement?.unlocked;
  if (!Array.isArray(unlocked)) return false;
  return unlocked.includes(track.id);
}

export function gateTrack(track, entitlement) {
  if (!track) return { view: 'locked', reason: 'missing-track' };
  if (isUnlocked(track, entitlement)) return { view: 'full', reason: 'unlocked' };
  return { view: 'locked', reason: 'teaser-gated' };
}

export function renderLockedPlaceholder(track) {
  const title = typeof track?.title === 'string' ? track.title : 'Locked track';
  const el = document.createElement('article');
  el.className = 'planly-locked';
  el.setAttribute('aria-label', `Locked: ${title}`);
  el.innerHTML =
    `<h2 class="planly-locked-title">${escapeHtml(title)}</h2>` +
    `<div class="planly-lock-slot" aria-hidden="false">🔒 Locked — unlock to reveal tasks</div>`;
  return el;
}
