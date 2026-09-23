# Proposal: planly-ui-tracks (web)

## Why
Backend tracks are useless without a greenfield surface in
`web/planly-wizard/`. Users need a sprint view and daily cards that
mirror `DailyTask` evidence (`planly_check`, confidence, miss rule).

## What
- `SprintView`: track header, level badge, progress counters.
- `DailyCard`: `doing_verb` / `title` / `minutes` / `done_criteria` /
  `planly_check` / confidence input / `miss_rule` display.
- Locked-track placeholders for teaser-gated tracks.
- `TeaserGuard.client` mirror of server gate (no bypass).
- API client: ETag (`If-None-Match`), op poll `1s -> 2s -> 5s`,
  cap 60s; `Idempotency-Key` on mutations.
- CSP `connect-src` scoped to Planly origin only.
- `sw.js` stays byte-identical; `privacy.js` allowlist updated.

## Scope
- `web/planly-wizard/` routes, components, client, styles only.

## Non-goals
- No toolbox bleed (separate origin LOCKED).
- No backend changes (see `planly-hireable-tracks`).
- No copied upstream content; attributions link-only.

## Attributions (link-only)
- [Hello Interview © Optick Labs](https://www.hellointerview.com)
- [Tech Interview Handbook MIT](https://github.com/yangshun/tech-interview-handbook)
- [Primer MIT](https://primer.style)
