const POLL_INTERVALS = [1000, 2000, 5000];
const POLL_CAP_MS = 60000;

export const api = {
  async getPlan(planId, extraHeaders = {}) {
    const headers = {
      'Accept': 'application/json',
      ...extraHeaders
    };

    const response = await fetch(`/v1/plans/${planId}`, { headers });
    const etag = response.headers.get('ETag');

    if (response.status === 304) {
      return { cached: true, etag };
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return { data, etag, entitled: data.full !== null };
  },

  async readjust(planId, baseVersion, delta, extraHeaders = {}) {
    const idempotencyKey = extraHeaders['Idempotency-Key'] || crypto.randomUUID();
    const headers = {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
      ...extraHeaders
    };

    const body = JSON.stringify({ baseVersion, delta });

    const response = await fetch(`/v1/plans/${planId}/readjustments`, {
      method: 'POST',
      headers,
      body
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${response.status}`);
    }

    return response.json();
  },

  async pollOperation(opId, onProgress, extraHeaders = {}) {
    const start = Date.now();
    let intervalIndex = 0;

    while (Date.now() - start < POLL_CAP_MS) {
      const interval = POLL_INTERVALS[Math.min(intervalIndex, POLL_INTERVALS.length - 1)];
      await new Promise(r => setTimeout(r, interval));
      intervalIndex++;

      try {
        const response = await fetch(`/v1/operations/${opId}`, {
          headers: { 'Accept': 'application/json', ...extraHeaders }
        });

        if (!response.ok) continue;

        const data = await response.json();
        if (onProgress) onProgress(data);

        if (data.status === 'completed' || data.status === 'failed') {
          return data;
        }
      } catch (e) {
        // Ignore poll errors, retry
      }
    }

    throw new Error('Operation polling timed out');
  }
};

export function generateIdempotencyKey() {
  return crypto.randomUUID();
}