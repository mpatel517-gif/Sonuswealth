-- ============================================================================
-- 011b — Grant service_role write access to data-layer tables.
-- Run after 011_create_data_layer.sql if seed script errors "permission denied".
-- Idempotent; safe to re-run.
-- ============================================================================

GRANT ALL ON TABLE finio_rules_bundles       TO service_role;
GRANT ALL ON TABLE finio_macro_variables     TO service_role;
GRANT ALL ON TABLE finio_macro_history       TO service_role;
GRANT ALL ON TABLE finio_personas            TO service_role;
GRANT ALL ON TABLE finio_persona_snapshots   TO service_role;
GRANT ALL ON TABLE finio_test_audit_log      TO service_role;

-- Also grant to authenticated (for app-side reads/writes scoped by RLS)
GRANT SELECT ON TABLE finio_rules_bundles    TO authenticated, anon;
GRANT SELECT ON TABLE finio_macro_variables  TO authenticated, anon;
GRANT SELECT ON TABLE finio_macro_history    TO authenticated, anon;
GRANT SELECT ON TABLE finio_personas         TO authenticated, anon;
GRANT SELECT ON TABLE finio_persona_snapshots TO authenticated, anon;
GRANT SELECT ON TABLE finio_test_audit_log   TO authenticated, anon;

-- Ensure future tables in public also work
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
