-- V4: readjustments append-only (Phase 4). base_version must name a real
-- plans.version for the family. Writes ONLY through rpc_readjust_append.

CREATE TABLE IF NOT EXISTS readjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  base_version int NOT NULL CHECK (base_version >= 1),
  delta jsonb NOT NULL,
  author_user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE readjustments ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON readjustments TO app_role;
REVOKE UPDATE, DELETE ON readjustments FROM app_role;

DROP TRIGGER IF EXISTS readj_no_mut ON readjustments;
CREATE TRIGGER readj_no_mut BEFORE UPDATE OR DELETE ON readjustments
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- Sole writer: verifies base_version exists, appends the delta row, enqueues
-- the follow-up operation for the materialised head+1 plan.
CREATE OR REPLACE FUNCTION rpc_readjust_append(
  p_plan uuid, p_base int, p_delta jsonb, p_key text,
  p_caller_user uuid, p_caller_draft uuid)
RETURNS TABLE (readjustment_id uuid, op_id uuid) AS $$
DECLARE
  v_draft uuid;
  v_exists boolean;
  v_rid uuid;
  v_op uuid;
BEGIN
  IF p_caller_user IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0004';
  END IF;
  SELECT draft_id INTO v_draft FROM plans WHERE id = p_plan;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_not_found' USING ERRCODE = 'P0002';
  END IF;
  SELECT EXISTS (SELECT 1 FROM plans
    WHERE draft_id = v_draft AND version = p_base) INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'stale_base' USING ERRCODE = 'P0011';
  END IF;
  INSERT INTO readjustments (plan_id, base_version, delta, author_user_id)
    VALUES (p_plan, p_base, p_delta, p_caller_user)
  RETURNING readjustments.id INTO v_rid;
  INSERT INTO operations (draft_id, idempotency_key, status, ttl_expires_at)
    VALUES (v_draft, p_key, 'accepted', now() + interval '24 hours')
  ON CONFLICT (draft_id, idempotency_key) DO NOTHING
  RETURNING operations.id INTO v_op;
  IF v_op IS NULL THEN
    SELECT id INTO v_op FROM operations
      WHERE draft_id = v_draft AND idempotency_key = p_key;
  END IF;
  RETURN QUERY SELECT v_rid, v_op;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION
  rpc_readjust_append(uuid,int,jsonb,text,uuid,uuid)
TO app_role;
