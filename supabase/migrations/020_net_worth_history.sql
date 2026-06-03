-- ============================================================================
-- SONUSWEALTH — NET-WORTH HISTORY + GUIDANCE SNAPSHOTS (point-in-time)
-- Date: 2026-06-03
-- Migration: 020_net_worth_history
--
-- Founder requirement (2026-06-03): a recommended route is a pure function of
-- the wealth snapshot — change the wealth and the route can change. So we must:
--   (1) store NET WORTH by date, so any guidance can be reproduced against the
--       information available AT THAT TIME (Consumer Duty / auditability), and
--   (2) store the GUIDANCE route as a dated snapshot, stamped with the data
--       date it was computed from.
--
-- Both tables are point-in-time: a row is "the position / the advice as known
-- on as_of". Queries ask "what did we know / advise on or before date X".
-- ============================================================================

-- ── Position by date ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS finio_net_worth_history (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id      text NOT NULL,                 -- entity within the user's household
  as_of          date NOT NULL,                 -- the date the DATA reflects
  net_worth      bigint NOT NULL,               -- £ (rounded)
  pots           jsonb NOT NULL DEFAULT '{}',   -- {pension, isa, gia, cash, property}
  rules_version  text,
  snapshot_hash  text NOT NULL,                 -- change-detection / dedupe
  payload        jsonb NOT NULL,                -- the full financialSnapshot()
  captured_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, person_id, as_of)            -- one snapshot per person per data-date
);

-- "position as known on/before date X" → (user_id, person_id, as_of DESC)
CREATE INDEX IF NOT EXISTS idx_nwh_person_asof
  ON finio_net_worth_history (user_id, person_id, as_of DESC);

-- ── Guidance route by date ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS finio_guidance_snapshots (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id      text NOT NULL,
  kind           text NOT NULL,                 -- 'decumulation' | 'accumulation'
  as_of          date,                          -- data date the route was computed from
  snapshot_hash  text NOT NULL,                 -- ties the route to the position it used
  primary_goal   text,
  result         jsonb NOT NULL,                -- the stamped solver output (route + provenance)
  generated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guid_person_gen
  ON finio_guidance_snapshots (user_id, person_id, generated_at DESC);

-- ── RLS: users see/write only their own rows ────────────────────────────────
ALTER TABLE finio_net_worth_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE finio_guidance_snapshots ENABLE ROW LEVEL SECURITY;

-- DROP-then-CREATE so this migration is safely re-runnable (Postgres has no
-- CREATE POLICY IF NOT EXISTS). Lets the file live in a batch the founder runs
-- in one go without erroring if it was applied before.
DROP POLICY IF EXISTS "nwh_owner_select" ON finio_net_worth_history;
DROP POLICY IF EXISTS "nwh_owner_write"  ON finio_net_worth_history;
DROP POLICY IF EXISTS "nwh_owner_update" ON finio_net_worth_history;
DROP POLICY IF EXISTS "guid_owner_select" ON finio_guidance_snapshots;
DROP POLICY IF EXISTS "guid_owner_write"  ON finio_guidance_snapshots;

CREATE POLICY "nwh_owner_select" ON finio_net_worth_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "nwh_owner_write" ON finio_net_worth_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "nwh_owner_update" ON finio_net_worth_history
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "guid_owner_select" ON finio_guidance_snapshots
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "guid_owner_write" ON finio_guidance_snapshots
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE finio_net_worth_history IS
  'Point-in-time net-worth snapshots by data-date. Guidance is reproduced against the position as known then.';
COMMENT ON TABLE finio_guidance_snapshots IS
  'Stored guidance routes, each stamped with the data-date + snapshot hash it was computed from.';
