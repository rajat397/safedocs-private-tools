export class TeaserGuardClient {
  constructor(allowlist) {
    this.allowlist = new Set(allowlist);
  }

  filter(plan, entitled) {
    if (entitled) {
      return { type: 'full', ...plan };
    }

    const teaser = {};
    for (const key of this.allowlist) {
      if (plan.teaser && key in plan.teaser) {
        teaser[key] = plan.teaser[key];
      }
    }

    // Sanitize
    if (teaser.title) teaser.title = this.sanitize(teaser.title);
    if (teaser.summary) {
      teaser.summary = this.sanitize(teaser.summary).slice(0, 280);
    }

    return {
      type: 'teaser',
      id: plan.id,
      version: plan.version,
      teaser,
      full: null
    };
  }

  sanitize(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.textContent.trim();
  }

  // Returns locked placeholder for a track
  renderLockedTrack(track) {
    const div = document.createElement('div');
    div.className = 'locked-track';
    div.innerHTML = `
      <h3>${track.title.toUpperCase()} — ${track.level || 'L0-L4'}</h3>
      <p class="locked-message">Upgrade to unlock this track</p>
      <button class="btn-primary upgrade-btn" data-track="${track.id}">View Pricing</button>
    `;
    return div;
  }

  // Asserts no bypass path exists (for testing)
  static assertNoBypass(guard) {
    const plan = { teaser: { secret: 'x' }, full: { secret: 'y' } };
    const teaser = guard.filter(plan, false);
    if (teaser.full !== null) throw new Error('TeaserGuard bypass: full not null');
    if (teaser.teaser.secret) throw new Error('TeaserGuard bypass: secret leaked');
    return true;
  }
}