# Tasks: planly-ui-tracks (web)

- [ ] 1. Add `web/planly-wizard/` routes (sprint, day, locked fallback).
- [ ] 2. Build `SprintView` + `DailyCard` components per render-delta.
- [ ] 3. Mirror `TeaserGuard.client` (no bypass, placeholder only).
- [ ] 4. Build API client (ETag, op poll 1s->2s->5s cap 60s, Idempotency-Key).
- [ ] 5. Scope CSP `connect-src` to Planly origin; keep `sw.js` byte-identical.
- [ ] 6. Update `privacy.js` allowlist for new routes only.
- [ ] 7. A11y pass (labels, focus, contrast); verify no toolbox bleed.
