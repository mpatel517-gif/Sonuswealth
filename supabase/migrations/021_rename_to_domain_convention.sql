-- ============================================================================
-- SONUSWEALTH — TABLE NAMING OVERHAUL: domain groups, drop the `finio_` app-prefix
-- Date: 2026-06-03
-- Migration: 021_rename_to_domain_convention
--
-- Founder direction (2026-06-03): the app-name prefix carries no information in a
-- single-app database — group tables by DOMAIN instead, and make linkage legible.
-- This migration:
--   (1) renames all 15 tables into domain groups (core_/market_/persona_/ops_/wealth_),
--   (2) closes the 4 remaining RLS gaps, mirroring the policy patterns already in use.
--
-- SAFE-BY-CONSTRUCTION:
--   · RENAME preserves every FK, index, policy, grant and trigger — Postgres rewires
--     FK references to the renamed table automatically. No drop/recreate needed.
--   · No view shims: pre-launch, all runtime tables are empty (app reads repo JSON),
--     and the code refs (src/lib/supabase.js TABLES + literals) are updated in the
--     same change set, so there is no live traffic to bridge.
--   · FK COLUMNS are deliberately NOT renamed — they are already `_id`-suffixed and
--     sensible (entity_id, persona_id, entity_a_id/_b_id). Column renames carry extra
--     code blast-radius and are a separate pass if ever needed.
--   · Wrapped in a transaction — all-or-nothing. Reversible (rename back) if needed.
-- ============================================================================

BEGIN;

-- ── core_ : the user's real financial graph ─────────────────────────────────
ALTER TABLE public.finio_entities              RENAME TO core_entities;
ALTER TABLE public.finio_entity_relationships  RENAME TO core_entity_links;
ALTER TABLE public.finio_events                RENAME TO core_events;
ALTER TABLE public.finio_user_connections      RENAME TO core_user_connections;

-- ── market_ : external reference data the engine reads ──────────────────────
ALTER TABLE public.finio_rules_bundles   RENAME TO market_rules_bundles;
ALTER TABLE public.finio_macro_variables RENAME TO market_macro_variables;
ALTER TABLE public.finio_macro_history   RENAME TO market_macro_history;
ALTER TABLE public.finio_cma_bundle      RENAME TO market_cma_bundle;

-- ── persona_ : test fixtures + their computed snapshots ─────────────────────
ALTER TABLE public.finio_personas          RENAME TO persona_fixtures;
ALTER TABLE public.finio_persona_snapshots RENAME TO persona_snapshots;

-- ── ops_ : system / telemetry / scheduler ──────────────────────────────────
ALTER TABLE public.finio_test_audit_log        RENAME TO ops_test_audit_log;
ALTER TABLE public.finio_bundle_snapshots      RENAME TO ops_bundle_activations;
ALTER TABLE public.finio_scheduled_activations RENAME TO ops_scheduled_activations;

-- ── wealth_ : point-in-time position + guidance ────────────────────────────
ALTER TABLE public.finio_net_worth_history  RENAME TO wealth_net_worth_history;
ALTER TABLE public.finio_guidance_snapshots RENAME TO wealth_guidance_snapshots;

-- ── Close the 4 RLS gaps (mirroring the patterns already in this DB) ────────
-- core_entity_links: household links → entity-scoped on EITHER party,
-- matching core_entities / core_events.
ALTER TABLE public.core_entity_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS entity_links_scoped ON public.core_entity_links;
CREATE POLICY entity_links_scoped ON public.core_entity_links FOR ALL TO public
  USING (
    entity_a_id = current_setting('app.current_entity_id', true)::uuid
    OR entity_b_id = current_setting('app.current_entity_id', true)::uuid
  );

-- market_cma_bundle: reference data the engine reads client-side, like
-- market_macro_* / market_rules_bundles → anon SELECT.
ALTER TABLE public.market_cma_bundle ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read_cma ON public.market_cma_bundle;
CREATE POLICY anon_read_cma ON public.market_cma_bundle FOR SELECT TO anon USING (true);

-- ops_bundle_activations + ops_scheduled_activations: system/admin tables written
-- by the scheduler (service_role). No client should read them → RLS ON with NO
-- permissive policy means only service_role (which bypasses RLS) can touch them.
ALTER TABLE public.ops_bundle_activations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_scheduled_activations ENABLE ROW LEVEL SECURITY;

-- Tell PostgREST to reload its schema cache so the API sees the new names.
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ── Rollback (if ever needed): rename each table back to its finio_ name and
--    drop the three new policies. Kept as a comment for reference.
