import { SprintView } from './SprintView.js';
import { DailyCard } from './DailyCard.js';
import { TeaserGuardClient } from './TeaserGuardClient.js';
import { api } from './api.js';

const TEASER_ALLOWLIST = ['title', 'summary', 'stepCount', 'priceRange'];

class Router {
  constructor() {
    this.plan = null;
    this.entitled = false;
    this.teaserGuard = new TeaserGuardClient(TEASER_ALLOWLIST);
    this.sprintView = new SprintView(this);
    this.dailyCard = new DailyCard(this);
    this.currentView = null;
    this.planId = null;
    this.draftId = null;
  }

  async init() {
    // Check for planId in URL hash or query
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(window.location.search);
    this.planId = hash || params.get('planId');
    this.draftId = params.get('draftId');

    if (!this.planId) {
      this.renderLanding();
      return;
    }

    await this.loadPlan();
    this.renderTrackTabs();
    this.showDefaultSprint();
  }

  async loadPlan() {
    try {
      const headers = {};
      if (this.draftId) {
        headers['Cookie'] = `draftId=${this.draftId}`;
      }
      const response = await api.getPlan(this.planId, headers);
      this.plan = response.data;
      this.entitled = response.entitled;
    } catch (e) {
      console.error('Failed to load plan:', e);
      this.renderError('Failed to load plan. Please check your link.');
    }
  }

  renderLanding() {
    document.getElementById('app').innerHTML = `
      <section class="landing">
        <h2>Welcome to Planly</h2>
        <p>Your personalized 0→expert hireable prep plan.</p>
        <p>Open a plan link to get started.</p>
      </section>
    `;
  }

  renderError(message) {
    document.getElementById('app').innerHTML = `
      <section class="error">
        <h2>Error</h2>
        <p>${message}</p>
        <button onclick="location.reload()">Retry</button>
      </section>
    `;
  }

  renderTrackTabs() {
    if (!this.plan || !this.plan.full || !this.plan.full.tracks) return;

    const tabs = document.querySelector('.track-tabs');
    tabs.innerHTML = '';

    this.plan.full.tracks.forEach((track, index) => {
      const li = document.createElement('li');
      li.role = 'tab';
      li.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
      li.textContent = track.title.toUpperCase();
      li.dataset.trackId = track.id;
      li.addEventListener('click', () => this.switchTrack(track.id));
      tabs.appendChild(li);
    });
  }

  switchTrack(trackId) {
    document.querySelectorAll('.track-tabs li').forEach(li => {
      li.setAttribute('aria-selected', li.dataset.trackId === trackId);
    });
    this.showSprintForTrack(trackId);
  }

  showDefaultSprint() {
    if (this.plan?.full?.tracks?.[0]) {
      this.showSprintForTrack(this.plan.full.tracks[0].id);
    }
  }

  showSprintForTrack(trackId) {
    const track = this.plan.full.tracks.find(t => t.id === trackId);
    if (!track) return;

    const sprintId = track.sprints[0]; // Start with first sprint (L0)
    this.showSprint(sprintId);
  }

  showSprint(sprintId) {
    const sprint = this.findSprint(sprintId);
    if (!sprint) return;

    this.currentView = this.sprintView.render(sprint, this.plan, this.entitled);
    document.getElementById('app').innerHTML = '';
    document.getElementById('app').appendChild(this.currentView);
  }

  findSprint(sprintId) {
    for (const track of this.plan.full.tracks) {
      const sprint = track.sprints.find(s => s === sprintId);
      if (sprint) return { sprintId, track };
    }
    return null;
  }

  showDaily(dailyId) {
    const daily = this.findDaily(dailyId);
    if (!daily) return;

    this.currentView = this.dailyCard.render(daily, this.plan, this.entitled);
    document.getElementById('app').innerHTML = '';
    document.getElementById('app').appendChild(this.currentView);
  }

  findDaily(dailyId) {
    if (!this.plan.full.dailies) return null;
    return this.plan.full.dailies.find(d => d.taskId === dailyId);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.router = new Router();
  window.router.init();
});