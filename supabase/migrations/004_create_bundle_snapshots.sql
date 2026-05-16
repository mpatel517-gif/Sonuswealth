-- Migration 004: Create finio_bundle_snapshots table
-- Source: 3-Engine-supabase-event-store-schema-v1_0.md §2.4

CREATE TABLE finio_bundle_snapshots (
  id                    TEXT        PRIMARY KEY,
                                    -- e.g. 'snap_2027_04_06_uk_2027_1' — human-readable
  bundle_id             TEXT        NOT NULL,   -- 'UK-2027.1'
  previous_bundle_id    TEXT,                   -- 'UK-2026.1'; NULL for first bundle
  jurisdiction          TEXT        NOT NULL DEFAULT 'UK',
  activated_at          TIMESTAMPTZ NOT NULL,
  diff                  JSONB       NOT NULL,
                                    -- [{ rule, from, to, frozenUntil? }]
  affected_user_count   INTEGER,               -- computed at activation; NULL until known
  activation_event_id   UUID        REFERENCES finio_events(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE finio_bundle_snapshots IS
  'Immutable. One row per bundle activation. Enables X22 breadcrumb tracing. '
  'Source: EDA spec v1.0 §5.3.';
