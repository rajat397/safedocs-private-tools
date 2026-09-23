# Proposal: planly-hireable-tracks (backend)

## Why
Planly ships generic daily strings today. The hireable library
(`docs/product/planly/tracks-hireable-v2.json`: 75 tasks,
5 tracks x 5 levels L0-L4) has no backend home, so plans cannot
reference verifiable tasks, progress, or completion evidence.

## What
Wire hireable tracks into the Planly backend:

- `Daily.tasks`: `string[]` -> `DailyTask[]` objects
  (`taskId`, `doing_verb`, `title`, `minutes`, `done_criteria`,
  `planly_check`, `confidence`, `miss_rule`).
- New `ResourceRef` schema: `{ url, attribution, license_note }`,
  link-only, no copied upstream content.
- New `Track` schema: `{ id, title, level, sprint, taskIds[] }`.
- `PlanFull`: add `tracks[]` + `progress { done, total }`.
- Readjust: accept completion delta
  `{ taskId, confidence 1-5, evidence }` alongside `missedDate`.
- Teaser frozen: no teaser fields change in this proposal.

## Scope
- `planly-java` contracts (openapi.yaml + DTOs)
- `PlanStore` persistence + migration
- `PlanController` validation
- Snapshot tests (+ G1 fixture update)

## Non-goals
- No UI work (see `planly-ui-tracks`).
- No ranking, streaks, or notifications.
- No toolbox bleed; separate origin stays LOCKED.

## Attributions (link-only)
- [Hello Interview © Optick Labs](https://www.hellointerview.com)
- [Tech Interview Handbook MIT](https://github.com/yangshun/tech-interview-handbook)
- [Primer MIT](https://primer.style)
