# DELTA: ui render (tracks)

Base: greenfield `web/planly-wizard/`. Teaser content frozen.

## ADDED Requirements

### Requirement: SprintView
The UI SHALL render track title, level badge (L0-L4), sprint id,
and progress counters `{ done, total }`.

#### Scenario: sprint header
- GIVEN a plan with tracks and progress
- WHEN `SprintView` loads
- THEN header shows title, level, and `done/total`.

### Requirement: DailyCard
The UI SHALL render each `DailyTask` as a card with `doing_verb`,
`title`, `minutes`, `done_criteria`, `planly_check`, confidence
input (1-5), and `miss_rule`.

#### Scenario: card fields
- GIVEN a `DailyTask`
- WHEN the card renders
- THEN all seven fields are visible without overflow.

### Requirement: locked-track placeholder
The UI SHALL render locked tracks as placeholders with no task
detail, gated by `TeaserGuard.client`.

#### Scenario: locked track
- GIVEN a teaser-gated track
- WHEN rendered
- THEN only title + lock slot show; no bypass exists.

### Requirement: progress + confidence
The UI SHALL update counters on completion delta submit and MUST
reject confidence outside 1-5 client-side before sending.

#### Scenario: invalid confidence blocked
- GIVEN confidence `9`
- WHEN submitted
- THEN the client blocks with an inline error.
