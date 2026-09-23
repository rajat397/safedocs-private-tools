-- V2: operations + entitlements (Phase 2).
-- Idempotency: UNIQUE (draft_id, idempotency_key). TTL 24h; expired rows serve
-- 410 OP_GONE, then the hourly cron hard-DELETEs them (reuse only after DELETE).

CREATE TABLE IF NOT EXISTS operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'accepted'
    CHECK (status IN ('accepted','running','succeeded','failed')),
  plan_id uuid,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ttl_expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  UNIQUE (draft_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS entitlements (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  can_generate bool NOT NULL DEFAULT true,
  can_read_full bool NOT NULL DEFAULT true,
  can_readjust bool NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON operations, entitlements TO app_role;

-- Durable enqueue: live-row replay (200 path), expired raise (410 path),
-- else single INSERT (202 path). duplicate=0 by construction.
CREATE OR REPLACE FUNCTION rpc_generate_enqueue(
  p_draft uuid, p_key text, p_snapshot int,
  p_caller_user uuid, p_caller_draft uuid)
RETURNS TABLE (op_id uuid, created boolean) AS $$
DECLARE
  v_row operations%ROWTYPE;
  v_version int;
  v_status text;
BEGIN
  IF p_caller_user IS NULL AND p_caller_draft IS DISTINCT FROM p_draft THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0004';
  END IF;
  SELECT version, status INTO v_version, v_status FROM drafts WHERE id = p_draft;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'draft_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_status = 'discarded' THEN
    RAISE EXCEPTION 'discarded' USING ERRCODE = 'P0006';
  END IF;
  IF p_snapshot IS NOT NULL AND p_snapshot <> v_version THEN
    RAISE EXCEPTION 'step_stale' USING ERRCODE = 'P0009';
  END IF;
  SELECT * INTO v_row FROM operations
    WHERE draft_id = p_draft AND idempotency_key = p_key;
  IF FOUND THEN
    IF v_row.ttl_expires_at <= now() THEN
      RAISE EXCEPTION 'op_gone' USING ERRCODE = 'P0005';
    END IF;
    RETURN QUERY SELECT v_row.id, false;
    RETURN;
  END IF;
  INSERT INTO operations (draft_id, idempotency_key, status,
      ttl_expires_at)
    VALUES (p_draft, p_key, 'accepted', now() + interval '24 hours')
  ON CONFLICT (draft_id, idempotency_key) DO NOTHING
  RETURNING operations.id INTO v_row.id;
  IF v_row.id IS NULL THEN
    SELECT * INTO v_row FROM operations
      WHERE draft_id = p_draft AND idempotency_key = p_key;
    IF v_row.ttl_expires_at <= now() THEN
      RAISE EXCEPTION 'op_gone' USING ERRCODE = 'P0005';
    END IF;
    RETURN QUERY SELECT v_row.id, false;
    RETURN;
  END IF;
  RETURN QUERY SELECT v_row.id, true;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION rpc_operation_complete(
  p_op uuid, p_plan uuid, p_status text, p_error text)
RETURNS void AS $$
BEGIN
  UPDATE operations SET status = p_status, plan_id = p_plan,
    error_code = p_error, updated_at = now()
    WHERE id = p_op;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION
  rpc_generate_enqueue(uuid,text,int,uuid,uuid),
  rpc_operation_complete(uuid,uuid,text,text)
TO app_role;
