-- V1: drafts, steps, identity_links (Phase 1).
-- Normative: GRANT SELECT only; all writes go through RPCs (SECURITY DEFINER).
-- RLS deny-by-default; RPCs take explicit p_caller_user / p_caller_draft args
-- (never auth.uid() in transaction mode).

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM app_role, anon, authenticated;

CREATE TABLE IF NOT EXISTS drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES auth.users(id),
  anon_id uuid NOT NULL DEFAULT gen_random_uuid(),
  version int NOT NULL DEFAULT 1 CHECK (version >= 1),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','generating','generated','abandoned','discarded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (owner_user_id IS NOT NULL OR anon_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS steps (
  draft_id uuid NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
  n int NOT NULL CHECK (n BETWEEN 1 AND 6),
  payload jsonb NOT NULL DEFAULT '{}',
  version int NOT NULL DEFAULT 1 CHECK (version >= 1),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (draft_id, n)
);

CREATE TABLE IF NOT EXISTS identity_links (
  draft_id uuid PRIMARY KEY REFERENCES drafts(id) ON DELETE CASCADE,
  anon_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (anon_id, draft_id)
);

ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_links ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON drafts, steps, identity_links TO app_role;

-- Single-statement OCC step put: exactly one UPDATE with version predicate.
CREATE OR REPLACE FUNCTION rpc_step_put(
  p_draft uuid, p_n int, p_payload jsonb, p_expected int,
  p_caller_user uuid, p_caller_draft uuid)
RETURNS TABLE (n int, version int) AS $$
DECLARE
  v_status text;
BEGIN
  IF p_caller_user IS NULL AND p_caller_draft IS DISTINCT FROM p_draft THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0004';
  END IF;
  SELECT status INTO v_status FROM drafts WHERE id = p_draft;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'draft_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_status = 'discarded' THEN
    RAISE EXCEPTION 'discarded' USING ERRCODE = 'P0006';
  END IF;
  IF p_n < 1 OR p_n > 6 THEN
    RAISE EXCEPTION 'bad_step' USING ERRCODE = 'P0007';
  END IF;
  IF p_n >= 2 THEN
    RAISE EXCEPTION 'step_unprobed' USING ERRCODE = 'P0008';
  END IF;
  INSERT INTO steps (draft_id, n, payload, version, updated_at)
    VALUES (p_draft, p_n, p_payload, 1, now())
  ON CONFLICT (draft_id, n) DO UPDATE
    SET payload = EXCLUDED.payload,
        version = steps.version + 1,
        updated_at = now()
    WHERE steps.version = p_expected;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'version_conflict' USING ERRCODE = 'P0009';
  END IF;
  UPDATE drafts SET version = version + 1, updated_at = now()
    WHERE id = p_draft;
  RETURN QUERY SELECT p_n, s.version FROM steps s
    WHERE s.draft_id = p_draft AND s.n = p_n;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Lossless idempotent bind: first call wins, replays report merged=false.
CREATE OR REPLACE FUNCTION rpc_draft_bind(
  p_draft uuid, p_anon uuid, p_caller_user uuid, p_caller_draft uuid)
RETURNS TABLE (merged boolean, owner uuid) AS $$
DECLARE
  v_owner uuid;
  v_anon uuid;
BEGIN
  IF p_caller_user IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0004';
  END IF;
  IF p_caller_draft IS DISTINCT FROM p_draft THEN
    PERFORM 1 FROM drafts WHERE id = p_draft AND owner_user_id = p_caller_user;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0004';
    END IF;
  END IF;
  SELECT owner_user_id, anon_id INTO v_owner, v_anon FROM drafts
    WHERE id = p_draft;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'draft_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_owner IS NOT NULL AND v_owner <> p_caller_user THEN
    RAISE EXCEPTION 'bound_to_other' USING ERRCODE = 'P0003';
  END IF;
  INSERT INTO identity_links (draft_id, anon_id, user_id)
    VALUES (p_draft, p_anon, p_caller_user)
  ON CONFLICT (draft_id) DO NOTHING;
  IF v_owner IS NULL THEN
    UPDATE drafts SET owner_user_id = p_caller_user, version = version + 1,
      updated_at = now() WHERE id = p_draft;
    RETURN QUERY SELECT true, p_caller_user;
  ELSE
    RETURN QUERY SELECT false, v_owner;
  END IF;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION rpc_draft_discard(
  p_draft uuid, p_caller_user uuid, p_caller_draft uuid)
RETURNS TABLE (id uuid, status text) AS $$
BEGIN
  IF p_caller_user IS NULL AND p_caller_draft IS DISTINCT FROM p_draft THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0004';
  END IF;
  UPDATE drafts SET status = 'discarded', updated_at = now()
    WHERE drafts.id = p_draft AND drafts.status <> 'discarded';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'discarded' USING ERRCODE = 'P0006';
  END IF;
  RETURN QUERY SELECT p_draft, 'discarded'::text;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION
  rpc_step_put(uuid,int,jsonb,int,uuid,uuid),
  rpc_draft_bind(uuid,uuid,uuid,uuid),
  rpc_draft_discard(uuid,uuid,uuid)
TO app_role;
