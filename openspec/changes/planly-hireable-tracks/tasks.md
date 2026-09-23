# Tasks: planly-hireable-tracks (backend)

- [ ] 1. Update `planly-java` contracts: `DailyTask`, `ResourceRef`,
  `Track`, `PlanFull tracks[]+progress`, readjust completion delta.
- [ ] 2. Migrate + update `PlanStore` (persist objects, derive progress).
- [ ] 3. Validate in `PlanController` (400 on string tasks, bad confidence).
- [ ] 4. Update snapshot tests + G1 fixture for new shapes.
- [ ] 5. Verify ETag round-trip on plan fetch after update.
- [ ] 6. Add seed loader for `docs/product/planly/tracks-hireable-v2.json`
  (75 tasks, 5 tracks x 5 levels; link-only attributions).
- [ ] 7. Add `validate` script (contract + snapshot + seed count == 75).
