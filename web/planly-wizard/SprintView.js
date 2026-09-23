export class SprintView {
  constructor(router) {
    this.router = router;
  }

  render(sprintInfo, plan, entitled) {
    const { sprintId, track } = sprintInfo;
    const sprint = this.findSprintData(plan, sprintId);
    if (!sprint) return this.renderError('Sprint not found');

    const section = document.createElement('section');
    section.className = 'sprint-view';
    section.dataset.sprintId = sprintId;

    const progress = this.calculateProgress(plan, sprint);
    const progressPercent = sprint.taskIds.length > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0;

    section.innerHTML = `
      <header class="sprint-header">
        <div class="sprint-meta">
          <span class="track-badge">${track.title.toUpperCase()}</span>
          <span class="level-badge">${sprint.level}</span>
          <span class="sprint-id">${sprintId}</span>
        </div>
        <div class="progress-bar" role="progressbar" aria-valuenow="${progressPercent}" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-fill" style="width: ${progressPercent}%"></div>
        </div>
        <div class="progress-text">${progress.done} / ${progress.total} tasks done</div>
      </header>
      <ul class="daily-list" role="list"></ul>
      ${!entitled ? '<div class="locked-notice">Upgrade to unlock full plan details</div>' : ''}
    `;

    const list = section.querySelector('.daily-list');
    sprint.taskIds.forEach(taskId => {
      const daily = plan.full.dailies.find(d => d.taskId === taskId);
      if (daily) {
        const li = document.createElement('li');
        li.className = 'daily-item';
        li.innerHTML = `
          <div class="daily-summary">
            <span class="daily-verb">${daily.doing_verb}</span>
            <span class="daily-title">${daily.title}</span>
            <span class="daily-minutes">${daily.minutes} min</span>
          </div>
          ${entitled ? `
            <button class="daily-expand" data-daily-id="${daily.taskId}" aria-expanded="false">
              Expand
            </button>
          ` : '<span class="locked">🔒</span>'}
        `;
        list.appendChild(li);
      }
    });

    if (entitled) {
      list.querySelectorAll('.daily-expand').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const dailyId = e.target.dataset.dailyId;
          this.router.showDaily(dailyId);
        });
      });
    }

    return section;
  }

  findSprintData(plan, sprintId) {
    for (const track of plan.full.tracks) {
      if (track.sprints.includes(sprintId)) {
        return { ...track, sprintId };
      }
    }
    return null;
  }

  calculateProgress(plan, sprint) {
    let done = 0;
    const total = sprint.taskIds.length;
    for (const taskId of sprint.taskIds) {
      const daily = plan.full.dailies.find(d => d.taskId === taskId);
      if (daily && daily.confidence && daily.confidence >= 3) {
        done++;
      }
    }
    return { done, total };
  }

  renderError(message) {
    const div = document.createElement('div');
    div.className = 'error';
    div.textContent = message;
    return div;
  }
}