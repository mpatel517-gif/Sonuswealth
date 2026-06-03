/**
 * Supabase Client Configuration
 *
 * Exports two clients:
 * - supabase: For client-side operations (uses anon key, respects RLS)
 * - supabaseAdmin: For server-side/admin operations (uses service role, bypasses RLS)
 *
 * Usage:
 *   import { supabase } from '@/lib/supabase';
 *   const { data, error } = await supabase.from('finio_entities').select();
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Check .env.local');
}

/**
 * Client-side Supabase client
 * - Uses anon key (public, safe to expose)
 * - Respects Row Level Security policies
 * - Use for all user-facing operations
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

/**
 * Table names (canonical, avoid typos)
 */
export const TABLES = {
  ENTITIES: 'finio_entities',
  ENTITY_RELATIONSHIPS: 'finio_entity_relationships',
  EVENTS: 'finio_events',
  BUNDLE_SNAPSHOTS: 'finio_bundle_snapshots',
  SCHEDULED_ACTIVATIONS: 'finio_scheduled_activations',
  USER_CONNECTIONS: 'finio_user_connections',
  CMA_BUNDLE: 'finio_cma_bundle',
  // Phase 2 data layer (migration 011)
  RULES_BUNDLES: 'finio_rules_bundles',
  MACRO_VARIABLES: 'finio_macro_variables',
  MACRO_HISTORY: 'finio_macro_history',
  PERSONAS: 'finio_personas',
  PERSONA_SNAPSHOTS: 'finio_persona_snapshots',
  TEST_AUDIT_LOG: 'finio_test_audit_log',
  // Point-in-time wealth + guidance history (migration 020)
  NET_WORTH_HISTORY: 'finio_net_worth_history',
  GUIDANCE_SNAPSHOTS: 'finio_guidance_snapshots',
};

/**
 * View names
 */
export const VIEWS = {
  PENDING_ACTIVATIONS: 'v_pending_activations',
  EXPIRING_CONSENTS: 'v_expiring_consents',
  CMA_CURRENT: 'v_cma_current',
  EVENT_CLUSTERS: 'v_event_clusters',
};

/**
 * Event families (for filtering finio_events)
 */
export const EVENT_FAMILIES = {
  RISK: 'RISK',
  MM: 'MM',       // MyMoney
  CF: 'CF',       // Cashflow
  TE: 'TE',       // Tax & Estate
  TL: 'TL',       // Timeline
  FQ: 'FQ',       // Finio Score
  RULES: 'RULES',
  CMA: 'CMA',
  USER: 'USER',
  APQ: 'APQ',
  EXPLAINER: 'EXPLAINER',
  DOC: 'DOC',
  DECISION: 'DECISION',
};

export default supabase;
