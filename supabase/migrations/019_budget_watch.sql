-- ============================================================================
-- SONUSWEALTH — L4-3 BUDGET WATCH
-- Date: 2026-05-28
-- Migration: 019_budget_watch
--
-- Watches HMRC / gov.uk rate pages for change so we hear about a Budget
-- announcement within 24h instead of a user reporting "my numbers feel
-- wrong since yesterday."
--
-- Approach: weekly HTTP HEAD on each URL, compare ETag + Last-Modified
-- vs the last stored value. Persist every probe (one row per URL per run)
-- so the founder can see the publication timeline.
--
-- HTML diffing is brittle — page restructures every quarter, content
-- moves to new URLs. Header diffing isn't perfect either (a CSS update
-- bumps Last-Modified without a Budget change) but it's cheap, reliable,
-- and gives a tractable signal: "this page changed — go read it."
-- ============================================================================

CREATE TABLE IF NOT EXISTS finio_budget_watch (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key        text NOT NULL,            -- 'income_tax_rates', 'iht_thresholds', etc.
  url             text NOT NULL,
  etag            text,
  last_modified   text,                      -- Last-Modified header verbatim
  content_length  integer,
  http_status     integer NOT NULL,
  changed         boolean NOT NULL,          -- true when etag or last_modified differs from previous
  prior_etag      text,
  prior_last_modified text,
  checked_at      timestamptz NOT NULL DEFAULT now(),
  notes           text
);

CREATE INDEX IF NOT EXISTS idx_budget_watch_page_checked
  ON finio_budget_watch (page_key, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_budget_watch_changed
  ON finio_budget_watch (checked_at DESC)
  WHERE changed = true;

ALTER TABLE finio_budget_watch ENABLE ROW LEVEL SECURITY;
-- Service-role only — admin / engine metric.

COMMENT ON TABLE finio_budget_watch IS
  'L4-3 weekly probe log for HMRC / gov.uk rate pages. Append-only. Service-role only.';

-- Register the cron — every Monday 04:00 UTC (before cron-cma-refresh at 06:00).
SELECT cron.schedule(
  'cron-budget-watch-weekly',
  '0 4 * * 1',
  $$
  SELECT
    net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/cron-budget-watch',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
