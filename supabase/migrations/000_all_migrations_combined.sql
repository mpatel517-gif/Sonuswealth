-- ============================================================================
-- SONUSWEALTH SUPABASE SCHEMA — ALL MIGRATIONS COMBINED
-- ============================================================================
-- Source: 3-Engine-supabase-event-store-schema-v1_0.md
-- Generated: 1 May 2026
--
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Click "New query"
-- 3. Paste this entire file
-- 4. Click "Run" (or Ctrl+Enter)
-- ============================================================================

-- ============================================================================
-- 001: CREATE ENTITIES TABLE
-- ============================================================================

CREATE TABLE finio_entities (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type     TEXT        NOT NULL
                              CHECK (entity_type IN (
                                'individual',
                                'couple_member',
                                'minor',
                                'company',
                                'trust',
                                'pension_scheme',
                                'ifa_practice',
                                'employer'
                              )),
  jurisdiction    TEXT        NOT NULL DEFAULT 'UK',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE finio_entities IS
  'Minimal entity table. Extended at Part 10 session.';

-- ============================================================================
-- 002: CREATE ENTITY RELATIONSHIPS TABLE
-- ============================================================================

CREATE TABLE finio_entity_relationships (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_a_id     UUID        NOT NULL REFERENCES finio_entities(id),
  entity_b_id     UUID        NOT NULL REFERENCES finio_entities(id),
  relationship    TEXT        NOT NULL,
  authority       TEXT        NOT NULL,
  effective_from  DATE        NOT NULL,
  effective_to    DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE finio_entity_relationships IS
  'Entity relationships. Extended at Part 10.';

-- ============================================================================
-- 003: CREATE EVENTS TABLE (CANONICAL EVENT STORE)
-- ============================================================================

CREATE TABLE finio_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id       UUID        NOT NULL REFERENCES finio_entities(id),
  event_type      TEXT        NOT NULL,
  event_family    TEXT        GENERATED ALWAYS AS (
                                split_part(event_type, '_', 1)
                              ) STORED,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_at    TIMESTAMPTZ,
  correlation_id  UUID,
  bundle_id       TEXT,
  jurisdiction    TEXT        NOT NULL DEFAULT 'UK',
  source          TEXT        NOT NULL
                              CHECK (source IN (
                                'user',
                                'engine',
                                'scheduler',
                                'aggregator',
                                'admin'
                              )),
  payload         JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE finio_events IS
  'Canonical event store. Append-only. State computed from events.';

-- ============================================================================
-- 004: CREATE BUNDLE SNAPSHOTS TABLE
-- ============================================================================

CREATE TABLE finio_bundle_snapshots (
  id                    TEXT        PRIMARY KEY,
  bundle_id             TEXT        NOT NULL,
  previous_bundle_id    TEXT,
  jurisdiction          TEXT        NOT NULL DEFAULT 'UK',
  activated_at          TIMESTAMPTZ NOT NULL,
  diff                  JSONB       NOT NULL,
  affected_user_count   INTEGER,
  activation_event_id   UUID        REFERENCES finio_events(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE finio_bundle_snapshots IS
  'Immutable. One row per bundle activation. X22 breadcrumb.';

-- ============================================================================
-- 005: CREATE SCHEDULED ACTIVATIONS TABLE
-- ============================================================================

CREATE TABLE finio_scheduled_activations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id       TEXT        NOT NULL,
  rule_key        TEXT,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  actions         JSONB       NOT NULL,
  activated_at    TIMESTAMPTZ,
  activation_event_id UUID    REFERENCES finio_events(id),
  retry_count     INTEGER     NOT NULL DEFAULT 0,
  last_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE finio_scheduled_activations IS
  'Daily scheduler state. Idempotent activation.';

-- ============================================================================
-- 006: CREATE USER CONNECTIONS TABLE
-- ============================================================================

CREATE TABLE finio_user_connections (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id               UUID        NOT NULL REFERENCES finio_entities(id),
  aggregator              TEXT        NOT NULL
                                      CHECK (aggregator IN (
                                        'truelayer',
                                        'salt_edge',
                                        'india_aa',
                                        'manual'
                                      )),
  connection_status       TEXT        NOT NULL DEFAULT 'active'
                                      CHECK (connection_status IN (
                                        'active',
                                        'broken',
                                        'revoked',
                                        'expired'
                                      )),
  jurisdiction            TEXT        NOT NULL DEFAULT 'UK',
  consent_established_at  TIMESTAMPTZ NOT NULL,
  consent_expires_at      TIMESTAMPTZ NOT NULL,
  last_refreshed_at       TIMESTAMPTZ,
  last_known_account_count INTEGER,
  aggregator_connection_ref TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE finio_user_connections IS
  'Class 3 Open Banking connections. UK: TrueLayer.';

-- ============================================================================
-- 007: CREATE CMA BUNDLE TABLE
-- ============================================================================

CREATE TABLE finio_cma_bundle (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction    TEXT        NOT NULL DEFAULT 'UK',
  source_key      TEXT        NOT NULL,
  metric_key      TEXT        NOT NULL,
  value           JSONB       NOT NULL,
  unit            TEXT,
  reference_date  DATE        NOT NULL,
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_url      TEXT,
  confidence      TEXT        NOT NULL DEFAULT 'high'
                              CHECK (confidence IN ('high', 'medium', 'low')),
  licence         TEXT,
  is_current      BOOLEAN     NOT NULL DEFAULT true,
  UNIQUE (jurisdiction, metric_key, reference_date)
);

COMMENT ON TABLE finio_cma_bundle IS
  'Class 2 context data. CMA = Context, Market, Assumptions.';

-- ============================================================================
-- 008: CREATE INDEXES
-- ============================================================================

-- finio_events indexes
CREATE INDEX idx_events_entity_id         ON finio_events (entity_id);
CREATE INDEX idx_events_event_type        ON finio_events (event_type);
CREATE INDEX idx_events_event_family      ON finio_events (event_family);
CREATE INDEX idx_events_correlation_id    ON finio_events (correlation_id)
  WHERE correlation_id IS NOT NULL;
CREATE INDEX idx_events_occurred_at       ON finio_events (occurred_at DESC);
CREATE INDEX idx_events_entity_family     ON finio_events (entity_id, event_family, occurred_at DESC);
CREATE INDEX idx_events_jurisdiction      ON finio_events (jurisdiction, event_type);
CREATE INDEX idx_events_bundle_id         ON finio_events (bundle_id)
  WHERE bundle_id IS NOT NULL;

-- finio_bundle_snapshots indexes
CREATE INDEX idx_snapshots_bundle_id      ON finio_bundle_snapshots (bundle_id);
CREATE INDEX idx_snapshots_jurisdiction   ON finio_bundle_snapshots (jurisdiction, activated_at DESC);

-- finio_scheduled_activations indexes
CREATE INDEX idx_sched_pending            ON finio_scheduled_activations (scheduled_at)
  WHERE status = 'pending' AND activated_at IS NULL;
CREATE INDEX idx_sched_bundle_id          ON finio_scheduled_activations (bundle_id);

-- finio_user_connections indexes
CREATE INDEX idx_conn_entity_id           ON finio_user_connections (entity_id);
CREATE INDEX idx_conn_expiring            ON finio_user_connections (consent_expires_at)
  WHERE connection_status = 'active';

-- finio_cma_bundle indexes
CREATE INDEX idx_cma_current             ON finio_cma_bundle (jurisdiction, metric_key)
  WHERE is_current = true;
CREATE INDEX idx_cma_history             ON finio_cma_bundle (jurisdiction, metric_key, reference_date DESC);

-- finio_entities indexes
CREATE INDEX idx_entities_type           ON finio_entities (entity_type, jurisdiction);

-- ============================================================================
-- 009: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE finio_entities          ENABLE ROW LEVEL SECURITY;
ALTER TABLE finio_events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE finio_user_connections  ENABLE ROW LEVEL SECURITY;

CREATE POLICY entities_self_only ON finio_entities
  FOR ALL USING (id = current_setting('app.current_entity_id', true)::UUID);

CREATE POLICY events_entity_scoped ON finio_events
  FOR ALL USING (entity_id = current_setting('app.current_entity_id', true)::UUID);

CREATE POLICY connections_entity_scoped ON finio_user_connections
  FOR ALL USING (entity_id = current_setting('app.current_entity_id', true)::UUID);

-- ============================================================================
-- 010: CREATE VIEWS
-- ============================================================================

CREATE VIEW v_pending_activations AS
  SELECT id, bundle_id, rule_key, scheduled_at, actions
  FROM finio_scheduled_activations
  WHERE status = 'pending'
    AND activated_at IS NULL
    AND scheduled_at <= now()
  ORDER BY scheduled_at ASC;

CREATE VIEW v_expiring_consents AS
  SELECT id, entity_id, aggregator, consent_expires_at,
         EXTRACT(DAY FROM (consent_expires_at - now())) AS days_remaining
  FROM finio_user_connections
  WHERE connection_status = 'active'
    AND consent_expires_at BETWEEN now() AND now() + INTERVAL '10 days'
  ORDER BY consent_expires_at ASC;

CREATE VIEW v_cma_current AS
  SELECT jurisdiction, source_key, metric_key, value, unit, reference_date, fetched_at, confidence
  FROM finio_cma_bundle
  WHERE is_current = true
  ORDER BY jurisdiction, metric_key;

CREATE VIEW v_event_clusters AS
  SELECT correlation_id,
         array_agg(event_type ORDER BY occurred_at) AS event_types,
         min(occurred_at)                           AS cluster_started_at,
         max(occurred_at)                           AS cluster_completed_at,
         count(*)                                   AS event_count
  FROM finio_events
  WHERE correlation_id IS NOT NULL
  GROUP BY correlation_id;

-- ============================================================================
-- DONE — Schema created successfully
-- ============================================================================
-- Tables: 7
-- Indexes: 17
-- Views: 4
-- RLS Policies: 3
-- ============================================================================
