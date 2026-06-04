/**
 * Supabase Client Configuration
 *
 * Exports two clients:
 * - supabase: For client-side operations (uses anon key, respects RLS)
 * - supabaseAdmin: For server-side/admin operations (uses service role, bypasses RLS)
 *
 * Usage:
 *   import { supabase } from '@/lib/supabase';
 *   const { data, error } = await supabase.from('core_entities').select();
 */

import { createClient } from '@supabase/supabase-js';

// Guard import.meta.env — it's defined by Vite in the browser but undefined in
// a plain node context (tests), where unguarded access throws. Matches the
// optional-chaining pattern used across the rest of the engine/hooks.
const supabaseUrl = import.meta?.env?.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta?.env?.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Check .env.local');
}

/**
 * Client-side Supabase client
 * - Uses anon key (public, safe to expose)
 * - Respects Row Level Security policies
 * - Use for all user-facing operations
 */
// When configured, a real client. When NOT (node tests, or a dev/demo session
// with no .env.local), a safe no-op stub so the app boots into demo mode instead
// of crashing on `supabase.auth`/`supabase.from(...)`. Real backend behaviour is
// unchanged when the env is present.
function makeOfflineStub() {
  const offline = () => ({ error: new Error('Supabase offline — no env configured'), data: null });
  const query = () => {
    const result = { data: [], error: null };
    const b = { then: (res) => res(result), catch: () => b, finally: (f) => { f && f(); return b } };
    for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
      'like', 'ilike', 'is', 'in', 'contains', 'containedBy', 'order', 'limit', 'range', 'single',
      'maybeSingle', 'filter', 'match', 'or', 'not', 'csv', 'returns', 'throwOnError']) b[m] = () => b;
    return b;
  };
  return {
    _offline: true,
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signUp: async () => offline(),
      signInWithPassword: async () => offline(),
      signInWithOAuth: async () => offline(),
      signOut: async () => ({ error: null }),
      resetPasswordForEmail: async () => ({ error: null }),
      resend: async () => ({ error: null }),
      mfa: {
        enroll: async () => offline(), challenge: async () => offline(),
        verify: async () => offline(), listFactors: async () => ({ data: { totp: [] }, error: null }),
      },
    },
    from: query,
    rpc: async () => ({ data: null, error: null }),
    channel: () => ({ on() { return this }, subscribe() { return this }, unsubscribe() {} }),
    removeChannel: () => {},
  };
}

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  })
  : makeOfflineStub();

/**
 * Table names (canonical, avoid typos)
 */
// Domain-grouped names (migration 021): core_ = user's financial graph,
// market_ = external reference data, persona_ = test fixtures, ops_ = system,
// wealth_ = point-in-time position/guidance. The KEYS stay the same so callers
// (TABLES.PERSONAS etc.) are unaffected — only the table strings changed.
export const TABLES = {
  ENTITIES: 'core_entities',
  ENTITY_RELATIONSHIPS: 'core_entity_links',
  EVENTS: 'core_events',
  BUNDLE_SNAPSHOTS: 'ops_bundle_activations',
  SCHEDULED_ACTIVATIONS: 'ops_scheduled_activations',
  USER_CONNECTIONS: 'core_user_connections',
  CMA_BUNDLE: 'market_cma_bundle',
  // Reference data layer (migration 011 → renamed 021)
  RULES_BUNDLES: 'market_rules_bundles',
  MACRO_VARIABLES: 'market_macro_variables',
  MACRO_HISTORY: 'market_macro_history',
  PERSONAS: 'persona_fixtures',
  PERSONA_SNAPSHOTS: 'persona_snapshots',
  TEST_AUDIT_LOG: 'ops_test_audit_log',
  // Point-in-time wealth + guidance history (migration 020 → renamed 021)
  NET_WORTH_HISTORY: 'wealth_net_worth_history',
  GUIDANCE_SNAPSHOTS: 'wealth_guidance_snapshots',
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
 * Event families (for filtering core_events)
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
