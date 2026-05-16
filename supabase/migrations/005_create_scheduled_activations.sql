-- Migration 005: Create finio_scheduled_activations table
-- Source: 3-Engine-supabase-event-store-schema-v1_0.md §2.5

CREATE TABLE finio_scheduled_activations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id       TEXT        NOT NULL,
  rule_key        TEXT,                      -- specific rule within bundle; NULL = whole bundle
  scheduled_at    TIMESTAMPTZ NOT NULL,      -- the effective date (e.g. 2027-04-06T00:00:00Z)
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  actions         JSONB       NOT NULL,
                              -- ["recalculate_iht_all_users", "dispatch_apq_alert_affected_users",
                              --  "update_explainer_registry", "update_cost_of_inaction_baseline"]
  activated_at    TIMESTAMPTZ,               -- NULL = not yet activated; set on completion
  activation_event_id UUID    REFERENCES finio_events(id),
  retry_count     INTEGER     NOT NULL DEFAULT 0,
  last_error      TEXT,                      -- failure reason if status = 'failed'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE finio_scheduled_activations IS
  'Daily scheduler scans: WHERE scheduled_at <= now() AND activated_at IS NULL. '
  'Idempotent — activated_at guard prevents double-activation. '
  'Source: EDA spec v1.0 §5.1/§5.2.';
