-- V5: plan tracks + progress (Phase 5). Adds tracks array + progress to plans.full
-- via JSONB evolution; no new tables. Readjust delta now accepts completion
-- {taskId, confidence 1-5, evidence} alongside legacy missedDate.

-- No schema changes needed for plans table (full is jsonb).
-- Readjustments delta column already jsonb; new keys are additive.

-- Index for faster progress derivation (optional, for large datasets)
-- readjustments has plan_id; join plans to get draft_id when needed
CREATE INDEX IF NOT EXISTS idx_readjustments_plan_delta_task
  ON readjustments (plan_id, (delta->>'taskId'))
  WHERE delta ? 'taskId';

-- Comment for clarity
COMMENT ON COLUMN plans.full IS 'PlanFull JSONB: {sprints, dailies, metrics, tracks[], progress{done,total}}';
COMMENT ON COLUMN readjustments.delta IS 'ReadjustDelta JSONB: {missedDate} OR {taskId, confidence 1-5, evidence}';