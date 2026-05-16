-- Migration 008: Create all indexes
-- Source: 3-Engine-supabase-event-store-schema-v1_0.md §3

-- finio_events — primary access patterns
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

-- finio_bundle_snapshots
CREATE INDEX idx_snapshots_bundle_id      ON finio_bundle_snapshots (bundle_id);
CREATE INDEX idx_snapshots_jurisdiction   ON finio_bundle_snapshots (jurisdiction, activated_at DESC);

-- finio_scheduled_activations — scheduler scan (hot path)
CREATE INDEX idx_sched_pending            ON finio_scheduled_activations (scheduled_at)
  WHERE status = 'pending' AND activated_at IS NULL;
CREATE INDEX idx_sched_bundle_id          ON finio_scheduled_activations (bundle_id);

-- finio_user_connections — consent expiry scan (daily job)
CREATE INDEX idx_conn_entity_id           ON finio_user_connections (entity_id);
CREATE INDEX idx_conn_expiring            ON finio_user_connections (consent_expires_at)
  WHERE connection_status = 'active';

-- finio_cma_bundle — engine lookup (hot path)
CREATE INDEX idx_cma_current             ON finio_cma_bundle (jurisdiction, metric_key)
  WHERE is_current = true;
CREATE INDEX idx_cma_history             ON finio_cma_bundle (jurisdiction, metric_key, reference_date DESC);

-- finio_entities
CREATE INDEX idx_entities_type           ON finio_entities (entity_type, jurisdiction);
