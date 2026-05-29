-- ============================================================================
-- SONUSWEALTH — L4-9 RLS SWEEP ON ADMIN TABLES
-- Date: 2026-05-28
-- Migration: 018_admin_rls_sweep
--
-- Migration 009 deliberately left three tables without RLS:
--   - finio_bundle_snapshots
--   - finio_scheduled_activations
--   - finio_cma_bundle
--
-- Reasoning at the time: "admin/scheduler data, not user-facing." That's
-- correct for the engine code path, which reads as service role. But the
-- absence of RLS means the anon key (which ships in every browser bundle)
-- can read these tables. None of them contain user PII, but they DO
-- contain:
--   - finio_bundle_snapshots — engine output state (could leak metric
--     calculation results across users if entity_id ever lands in here)
--   - finio_scheduled_activations — rules update queue (could disclose
--     upcoming Budget changes before HMRC announces them)
--   - finio_cma_bundle — market context (public anyway, but no reason
--     to expose mass-download via anon key)
--
-- Fix: ENABLE RLS on each. No policies for anon / authenticated → all reads
-- + writes blocked at the table level. Service role still bypasses RLS so
-- the engine + Edge Functions are unaffected.
--
-- This is the recommended Supabase pattern for "internal-only" tables.
-- ============================================================================

ALTER TABLE finio_bundle_snapshots     ENABLE ROW LEVEL SECURITY;
ALTER TABLE finio_scheduled_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE finio_cma_bundle           ENABLE ROW LEVEL SECURITY;

-- No CREATE POLICY statements. RLS enabled + zero policies = anon and
-- authenticated roles can't see or modify rows. Service role bypasses
-- (which is the only path we want).

COMMENT ON TABLE finio_bundle_snapshots IS
  'Engine output snapshots. RLS enabled, no anon/authenticated policies — service-role only (L4-9 2026-05-28).';
COMMENT ON TABLE finio_scheduled_activations IS
  'Rules update queue. RLS enabled, no anon/authenticated policies — service-role only (L4-9 2026-05-28).';
COMMENT ON TABLE finio_cma_bundle IS
  'Class-2 market context. RLS enabled, no anon/authenticated policies — service-role only (L4-9 2026-05-28).';
