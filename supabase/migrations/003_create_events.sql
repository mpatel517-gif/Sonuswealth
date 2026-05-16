-- Migration 003: Create finio_events table (canonical event store)
-- Source: 3-Engine-supabase-event-store-schema-v1_0.md §2.3

CREATE TABLE finio_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id       UUID        NOT NULL REFERENCES finio_entities(id),
  event_type      TEXT        NOT NULL,       -- see §4 event type registry
  event_family    TEXT        GENERATED ALWAYS AS (
                                split_part(event_type, '_', 1)
                              ) STORED,       -- 'RISK', 'MM', 'CF', 'TE', 'TL', 'FQ', 'RULES',
                                              -- 'CMA', 'USER', 'APQ', 'EXPLAINER', 'DOC', 'DECISION'
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_at    TIMESTAMPTZ,               -- NULL = occurred_at; set for future-dated events
  correlation_id  UUID,                      -- NULL for standalone events; shared for related clusters
  bundle_id       TEXT,                      -- e.g. 'UK-2026.1' — bundle active at computation time
  jurisdiction    TEXT        NOT NULL DEFAULT 'UK',
  source          TEXT        NOT NULL
                              CHECK (source IN (
                                'user',       -- user-initiated action
                                'engine',     -- engine recompute (autonomous)
                                'scheduler',  -- daily scheduler job
                                'aggregator', -- Open Banking aggregator push/pull
                                'admin'       -- founder admin entry
                              )),
  payload         JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE finio_events IS
  'Canonical event store. Append-only. No row is ever updated or deleted. '
  'State is computed from events. Source: Foundation v1.0 §3.4 event-sourced state principle.';
