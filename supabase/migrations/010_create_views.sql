-- Migration 010: Create views
-- Source: 3-Engine-supabase-event-store-schema-v1_0.md §6

-- Pending activations — scheduler hot path
CREATE VIEW v_pending_activations AS
  SELECT id, bundle_id, rule_key, scheduled_at, actions
  FROM finio_scheduled_activations
  WHERE status = 'pending'
    AND activated_at IS NULL
    AND scheduled_at <= now()
  ORDER BY scheduled_at ASC;

-- Expiring consents — daily consent-expiry job
CREATE VIEW v_expiring_consents AS
  SELECT id, entity_id, aggregator, consent_expires_at,
         EXTRACT(DAY FROM (consent_expires_at - now())) AS days_remaining
  FROM finio_user_connections
  WHERE connection_status = 'active'
    AND consent_expires_at BETWEEN now() AND now() + INTERVAL '10 days'
  ORDER BY consent_expires_at ASC;

-- Current CMA context — engine read pattern
CREATE VIEW v_cma_current AS
  SELECT jurisdiction, source_key, metric_key, value, unit, reference_date, fetched_at, confidence
  FROM finio_cma_bundle
  WHERE is_current = true
  ORDER BY jurisdiction, metric_key;

-- Correlation clusters — Timeline §D grouping
CREATE VIEW v_event_clusters AS
  SELECT correlation_id,
         array_agg(event_type ORDER BY occurred_at) AS event_types,
         min(occurred_at)                           AS cluster_started_at,
         max(occurred_at)                           AS cluster_completed_at,
         count(*)                                   AS event_count
  FROM finio_events
  WHERE correlation_id IS NOT NULL
  GROUP BY correlation_id;

COMMENT ON VIEW v_pending_activations IS 'Scheduler hot path: pending bundle activations.';
COMMENT ON VIEW v_expiring_consents IS 'Daily job: consents expiring within 10 days.';
COMMENT ON VIEW v_cma_current IS 'Engine read: current CMA context values.';
COMMENT ON VIEW v_event_clusters IS 'Timeline: correlated event clusters.';
