// ─────────────────────────────────────────────────────────────────────────────
// Edge Function: dsar-export (L1-2, 2026-05-28)
//
// GDPR Article 15 — Right of access. Returns the authenticated user's full
// personal data as a downloadable JSON file.
//
// What we export:
//   1. Auth user record (id, email, created_at, last_sign_in_at)
//   2. Entity record (financial position the user has stored)
//   3. Events (event-store rows belonging to the user)
//   4. Ask Sonu usage log (token counts only — no message content)
//   5. Entity relationships (couple / IFA links)
//   6. Bundle snapshots authored by the user
//
// What we DON'T export:
//   - Aggregate analytics data (no PII bound to it)
//   - Service logs (Sentry/PostHog — those have their own export flows)
//   - Other users' data, even where it touches via relationships
//
// Auth: requires a valid Supabase JWT. Returns the data for THAT user only.
//
// Deploy:
//   supabase functions deploy dsar-export
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ASK_APP_ORIGIN = Deno.env.get('ASK_APP_ORIGIN') ?? '*';

function corsHeaders(origin: string | null): Record<string, string> {
  const allow =
    ASK_APP_ORIGIN === '*' ? '*'
    : ASK_APP_ORIGIN.split(',').map(s => s.trim()).includes(origin ?? '') ? (origin ?? '')
    : '';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  };
}

function jsonResponse(body: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

serve(async (req) => {
  const cors = corsHeaders(req.headers.get('Origin'));

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405, cors);
  }

  // ── Auth ────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return jsonResponse({ error: 'auth_required' }, 401, cors);
  }
  const jwt = authHeader.slice(7).trim();
  if (!jwt) return jsonResponse({ error: 'auth_required' }, 401, cors);

  const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userErr } = await supa.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return jsonResponse({ error: 'auth_invalid' }, 401, cors);
  }
  const userId = userData.user.id;

  // ── Fetch user-scoped data ──────────────────────────────────────────────
  // We use the service role client so RLS doesn't block — but we filter
  // strictly by user_id, so the user only ever sees their own rows.
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const tasks = await Promise.allSettled([
    admin.from('finio_entities').select('*').eq('user_id', userId),
    admin.from('finio_events').select('*').eq('user_id', userId),
    admin.from('finio_entity_relationships').select('*').eq('user_id', userId),
    admin.from('finio_bundle_snapshots').select('*').eq('user_id', userId),
    admin.from('finio_ask_usage_log').select('*').eq('user_id', userId),
    admin.from('finio_user_connections').select('*').eq('user_id', userId),
  ]);

  const pick = (i: number) => tasks[i].status === 'fulfilled'
    ? (tasks[i] as PromiseFulfilledResult<{ data: unknown }>).value.data
    : { error: 'fetch_failed' };

  const exportBlob = {
    export_metadata: {
      generated_at: new Date().toISOString(),
      user_id: userId,
      gdpr_article: '15',
      format: 'json',
      version: 'dsar-v1.0',
    },
    auth_user: {
      id: userData.user.id,
      email: userData.user.email,
      created_at: userData.user.created_at,
      last_sign_in_at: userData.user.last_sign_in_at,
      // Intentionally NOT returning: encrypted_password, raw_user_meta_data
      // beyond email, or any Supabase internal fields.
    },
    entities: pick(0),
    events: pick(1),
    entity_relationships: pick(2),
    bundle_snapshots: pick(3),
    ask_usage_log: pick(4),
    user_connections: pick(5),
  };

  return jsonResponse(exportBlob, 200, {
    ...cors,
    'Content-Disposition': `attachment; filename="sonuswealth-export-${userId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json"`,
  });
});
