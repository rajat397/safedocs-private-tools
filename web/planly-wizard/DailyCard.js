export class DailyCard {
  constructor(router) {
    this.router = router;
  }

  render(daily, plan, entitled) {
    const section = document.createElement('section');
    section.className = 'daily-card';
    section.dataset.dailyId = daily.taskId;

    const confidence = daily.confidence || 0;
    const confidenceStars = '★'.repeat(confidence) + '☆'.repeat(5 - confidence);

    section.innerHTML = `
      <header class="daily-header">
        <button class="back-btn" aria-label="Back to sprint">← Back</button>
        <h2>${daily.doing_verb}: ${daily.title}</h2>
        <span class="daily-meta">${daily.minutes} min • ${daily.level || ''}</span>
      </header>

      <div class="daily-body">
        <div class="daily-section">
          <h3>What you'll do</h3>
          <p>${daily.done_criteria}</p>
        </div>

        <div class="daily-section">
          <h3>Planly check</h3>
          <p class="planly-check">${daily.planly_check}</p>
        </div>

        <div class="daily-section">
          <h3>Confidence</h3>
          <div class="confidence-input">
            <label for="confidence-${daily.taskId}">Rate your confidence (1-5)</label>
            <input type="range" id="confidence-${daily.taskId}" min="1" max="5" value="${confidence}" ${!entitled ? 'disabled' : ''}>
            <span class="confidence-display">${confidenceStars} (${confidence}/5)</span>
          </div>
        </div>

        <div class="daily-section">
          <h3>If you miss this</h3>
          <p class="miss-rule">${daily.miss_rule}</p>
        </div>

        ${daily.url ? `
          <div class="daily-section resources">
            <h3>Resources</h3>
            <ul>
              <li><a href="${daily.url}" target="_blank" rel="noopener nofollow ugc" referrerpolicy="no-referrer">${daily.title}</a>
                <span class="attribution">${daily.attribution || ''} • ${daily.license_note || ''}</span>
              </li>
            </ul>
          </div>
        ` : ''}
      </div>

      <footer class="daily-footer">
        <button class="btn-primary complete-btn" ${!entitled ? 'disabled' : ''} data-daily-id="${daily.taskId}">
          ${confidence >= 3 ? 'Mark Complete' : 'Save Progress'}
        </button>
        <button class="btn-secondary back-btn" data-daily-id="${daily.taskId}">Back to Sprint</button>
      </footer>
    `;

    if (entitled) {
      const confidenceInput = section.querySelector(`#confidence-${daily.taskId}`);
      const confidenceDisplay = section.querySelector('.confidence-display');
      confidenceInput.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        confidenceDisplay.textContent = '★'.repeat(val) + '☆'.repeat(5 - val) + ` (${val}/5)`;
      });

      section.querySelector('.complete-btn').addEventListener('click', () => {
        this.submitCompletion(daily.taskId, confidenceInput.value);
      });
    }

    section.querySelectorAll('.back-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sprintId = this.findSprintForDaily(plan, daily.taskId);
        if (sprintId) this.router.showSprint(sprintId);
      });
    });

    return section;
  }

  findSprintForDaily(plan, taskId) {
    for (const track of plan.full.tracks) {
      for (const sprintId of track.sprints) {
        const sprint = this.findSprintData(plan, sprintId);
        if (sprint && sprint.taskIds.includes(taskId)) {
          return sprintId;
        }
      }
    }
    return null;
  }

  findSprintData(plan, sprintId) {
    for (const track of plan.full.tracks) {
      if (track.sprints.includes(sprintId)) {
        return { ...track, sprintId };
      }
    }
    return null;
  }

  async submitCompletion(dailyId, confidence) {
    const planId = this.router.planId;
    const draftId = this.router.draftId;
    const baseVersion = this.router.plan.version;

    const delta = {
      taskId: dailyId,
      confidence: parseInt(confidence, 10),
      evidence: `Completed ${new Date().toISOString().split('T')[0]}`
    };

    try {
      const headers = { 'Idempotency-Key': crypto.randomUUID() };
      if (draftId) headers['Cookie'] = `draftId=${draftId}`;

      await this.router.api.readjust(planId, baseVersion, delta, headers);
      // Refresh plan to get updated progress
      await this.router.loadPlan();
      // Go back to sprint
      const sprintId = this.findSprintForDaily(this.router.plan, dailyId);
      if (sprintId) this.router.showSprint(sprintId);
    } catch (e) {
      console.error('Failed to submit completion:', e);
      alert('Failed to save progress. Please try again.');
    }
  }
}