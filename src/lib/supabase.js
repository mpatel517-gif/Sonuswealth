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
