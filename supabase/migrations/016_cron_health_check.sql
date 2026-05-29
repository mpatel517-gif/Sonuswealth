-- ============================================================================
-- SONUSWEALTH — L4-2 CRON HEALTH CHECK
-- Date: 2026-05-28
-- Migration: 016_cron_health_check
--
-- Closes the silent-cron-death failure mode. cron-context-pull and
-- cron-rules-activation run daily and write to specific tables; if either
-- silently stops running (Edge Function moved, secret rotated, deno runtime
-- error), the founder has no way to know — macro data goes stale invisibly
-- and the activation queue piles up.
--
-- This migration adds:
--   1. finio_cron_status — append-only check log
--   2. cron-health-check-hourly — runs every hour, calls the Edge Function
--      cron-health-check which:
--        a. Queries the latest write to each monitored table
--        b. Compares against the per-cron threshold (interval + grace window)
--        c. Inserts a row into finio_cron_status for every check
--        d. If anything is stale, POSTs to CRON_SLACK_WEBHOOK env
--
-- A 26-hour grace window for daily crons tolerates one missed run before
-- escalating. Sub-day crons (when we add them later) get a tighter window
-- in the Edge Function's MONITORS array.
-- ============================================================================

CREATE TABLE IF NOT EXISTS finio_cron_status (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cron_name     text NOT NULL,
  -- 'healthy' | 'stale' | 'unknown' (no rows in the monitored table yet)
  status        text NOT NULL CHECK (status IN ('healthy', 'stale', 'unknown')),
  last_seen     timestamptz,            -- when the cron last wrote
  age_seconds   integer,                 -- how long ago that was, at check time
  threshold_seconds integer NOT NULL,    -- the per-cron tolerance
  checked_at    timestamptz NOT NULL DEFAULT now(),
  notes         text
);

CREATE INDEX IF NOT EXISTS idx_cron_status_name_checked
  ON finio_cron_status (cron_name, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_status_stale
  ON finio_cron_status (checked_at DESC)
  WHERE status = 'stale';

ALTER TABLE finio_cron_status ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies — read via service role only (admin metric).

COMMENT ON TABLE finio_cron_status IS
  'L4-2 append-only cron freshness log. Service-role read only. Insert per cron per check.';

-- ── Register cron-health-check schedule ────────────────────────────────────
-- Every hour at minute 7 (off the 00 boundary so it doesn't collide with the
-- midnight rules-activation cron's measurement window).
SELECT cron.schedule(
  'cron-health-check-hourly',
  '7 * * * *',
  $$
  SELECT
    net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/cron-health-check',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
