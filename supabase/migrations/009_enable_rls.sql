-- Migration 009: Enable Row Level Security
-- Source: 3-Engine-supabase-event-store-schema-v1_0.md §5

-- Enable RLS on all user-facing tables
ALTER TABLE finio_entities          ENABLE ROW LEVEL SECURITY;
ALTER TABLE finio_events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE finio_user_connections  ENABLE ROW LEVEL SECURITY;

-- finio_entities: user sees only their own entity
-- (auth.uid() mapped to entity.id at onboarding — relationship stored in auth metadata)
CREATE POLICY entities_self_only ON finio_entities
  FOR ALL USING (id = current_setting('app.current_entity_id', true)::UUID);

-- finio_events: user sees only events for their entity
CREATE POLICY events_entity_scoped ON finio_events
  FOR ALL USING (entity_id = current_setting('app.current_entity_id', true)::UUID);

-- finio_user_connections: user sees only their connections
CREATE POLICY connections_entity_scoped ON finio_user_connections
  FOR ALL USING (entity_id = current_setting('app.current_entity_id', true)::UUID);

-- Note: finio_bundle_snapshots, finio_scheduled_activations, finio_cma_bundle
-- have no RLS — admin/scheduler data, not user-facing directly.
-- Engine functions read these tables as service role.

COMMENT ON POLICY entities_self_only ON finio_entities IS
  'RLS: Users see only their own entity. Service role bypasses for admin/scheduler.';

COMMENT ON POLICY events_entity_scoped ON finio_events IS
  'RLS: Users see only events for their entity. Service role bypasses.';

COMMENT ON POLICY connections_entity_scoped ON finio_user_connections IS
  'RLS: Users see only their aggregator connections. Service role bypasses.';
