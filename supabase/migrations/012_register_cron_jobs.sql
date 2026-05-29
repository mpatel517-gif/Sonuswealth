-- ============================================================================
-- SONUSWEALTH — PHASE 4 CRON JOBS REGISTRATION
-- Date: 2026-05-21
-- Uses pg_cron extension (available on Supabase by default) to schedule
-- Supabase Edge Functions invocations.
-- ============================================================================
-- BEFORE applying this migration:
--   1. Apply migration 011 first (creates the tables these crons write to)
--   2. Deploy the Edge Functions:
--      npx supabase functions deploy cron-context-pull
--      npx supabase functions deploy cron-rules-activation
--   3. Update the http_post() URL below if your Supabase project ref changes
-- ============================================================================

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;

-- ============================================================================
-- 012a: Daily 09:30 UTC — fetch UK CPI + BoE rate from ONS/BoE
-- ============================================================================
SELECT cron.schedule(
  'cron-context-pull-daily',
  '30 9 * * *',                                        -- 09:30 UTC every day
  $$
  SELECT
    net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/cron-context-pull',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- ============================================================================
-- 012b: Daily 00:01 UTC — activate scheduled rules
-- ============================================================================
SELECT cron.schedule(
  'cron-rules-activation-daily',
  '1 0 * * *',                                         -- 00:01 UTC every day
  $$
  SELECT
    net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/cron-rules-activation',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- ============================================================================
-- 012c: After applying, set the secrets (run once in SQL Editor):
--
--   ALTER DATABASE postgres SET app.supabase_url      = 'https://yknnfglfbpcyxcllrvmd.supabase.co';
--   ALTER DATABASE postgres SET app.service_role_key  = '<paste service_role here>';
--
-- Then reconnect to apply the GUCs.
-- ============================================================================

-- View scheduled jobs:
--   SELECT * FROM cron.job;
-- View execution history:
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
-- Unschedule:
--   SELECT cron.unschedule('cron-context-pull-daily');
