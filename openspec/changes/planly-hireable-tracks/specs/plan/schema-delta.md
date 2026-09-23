# DELTA: plan schema (hireable tracks)

Base: `docs/product/planly/backend-spec.md`. Teaser sections frozen.

## ADDED Requirements

### Requirement: DailyTask object
The system SHALL represent each daily entry as a `DailyTask` object
with `taskId`, `doing_verb`, `title`, `minutes`, `done_criteria`,
`planly_check`, `confidence` (1-5, optional), and `miss_rule`.
The system MUST reject entries missing `taskId`, `title`, or
`done_criteria`.

#### Scenario: valid daily task accepted
- GIVEN a plan payload with a well-formed `DailyTask`
- WHEN `PlanController` validates the payload
- THEN the plan is accepted and the task persists verbatim.

#### Scenario: string task rejected
- GIVEN a daily entry as a plain string
- WHEN validation runs
- THEN the request fails with 400 and a field-level error.

### Requirement: ResourceRef link-only
The system SHALL expose `ResourceRef` as `{ url, attribution,
license_note }`. The system MUST NOT store copied upstream text.

#### Scenario: link-only reference
- GIVEN a task sourced from upstream
- WHEN the plan is read
- THEN `ResourceRef` contains only url + attribution links.

### Requirement: Track and progress
The system SHALL expose `Track { id, title, level L0-L4, sprint,
taskIds[] }`. `PlanFull` SHALL include `tracks[]` and
`progress { done, total }` derived from completed `taskIds`.

#### Scenario: progress counters
- GIVEN a plan with 2 of 5 tasks completed
- WHEN `PlanFull` is fetched
- THEN `progress` equals `{ done: 2, total: 5 }`.

### Requirement: completion delta on readjust
The system SHALL accept `{ taskId, confidence 1-5, evidence }`
alongside `missedDate` on readjust. The system MUST reject
confidence outside 1-5.

#### Scenario: confidence recorded
- GIVEN a readjust with `taskId`, `confidence: 4`, evidence link
- WHEN the op applies
- THEN progress advances and the delta is stored.
