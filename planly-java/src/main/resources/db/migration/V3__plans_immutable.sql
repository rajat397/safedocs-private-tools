-- V3: plans immutable (Phase 3). REVOKE + trigger + SELECT-only grants.
-- Writes go ONLY through rpc_plan_insert below; the app role has no direct
-- INSERT/UPDATE/DELETE on plans.

CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES drafts(id) ON DELETE RESTRICT,
  version int NOT NULL CHECK (version >= 1),
  teaser jsonb NOT NULL,
  "full" jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (draft_id, version)
);

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON plans TO app_role;
REVOKE UPDATE, DELETE ON plans FROM app_role;

CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'immutable_table %', TG_TABLE_NAME USING ERRCODE = '25001';
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS plans_no_mut ON plans;
CREATE TRIGGER plans_no_mut BEFORE UPDATE OR DELETE ON plans
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- Sole writer: next immutable version for a draft family.
CREATE OR REPLACE FUNCTION rpc_plan_insert(
  p_draft uuid, p_teaser jsonb, p_full jsonb)
RETURNS TABLE (id uuid, version int) AS $$
DECLARE
  v_next int;
  v_id uuid;
BEGIN
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_next FROM plans
    WHERE draft_id = p_draft;
  INSERT INTO plans (draft_id, version, teaser, "full")
    VALUES (p_draft, v_next, p_teaser, p_full)
  RETURNING plans.id INTO v_id;
  RETURN QUERY SELECT v_id, v_next;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION rpc_plan_insert(uuid,jsonb,jsonb) TO app_role;