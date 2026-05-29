-- ============================================================================
-- SONUSWEALTH — L4-5 CRON CMA REFRESH SCHEDULE
-- Date: 2026-05-28
-- Migration: 017_cron_cma_refresh
--
-- Registers the weekly cron-cma-refresh Edge Function. The function itself
-- writes to the existing finio_cma_bundle table (migration 007), so no
-- schema change is needed here — only the schedule.
--
-- Cadence: Monday 06:00 UTC weekly. Picked Monday (gives BoE Friday-close
-- gilt yields + Friday's FTSE close time to land) and 06:00 (after UK
-- markets close + EU pre-open, before US market open).
-- ============================================================================

SELECT cron.schedule(
  'cron-cma-refresh-weekly',
  '0 6 * * 1',                                          -- Monday 06:00 UTC
  $$
  SELECT
    net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/cron-cma-refresh',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
