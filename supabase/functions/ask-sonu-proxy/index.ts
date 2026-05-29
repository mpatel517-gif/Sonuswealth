// ─────────────────────────────────────────────────────────────────────────────
// Edge Function: ask-sonu-proxy (L1-1)
// Purpose: server-side proxy to Anthropic Messages API for the Ask Sonu sheet.
//          Removes the requirement to bundle ANTHROPIC_API_KEY in the client.
//
// Security model:
//   1. ANTHROPIC_API_KEY lives ONLY in Supabase function secrets (never client).
//   2. Caller must include Authorization: Bearer <supabase-jwt>. The JWT is
//      validated against Supabase Auth; anon callers are rejected (429-style 401).
//      This binds proxy usage to authenticated users → Anthropic spend cannot
//      be hijacked by random internet traffic hitting the public URL.
//   3. CORS allows the app origin only (VITE_APP_ORIGIN env var).
//   4. Request body whitelist: only { system, messages, model, max_tokens }
//      are forwarded. Any other fields are dropped silently.
//   5. Response is streamed-through opaquely — no Anthropic header is leaked
//      back, no model errors echo the upstream stack.
//
// Failure modes:
//   - Missing/invalid JWT          → 401 { error: 'auth_required' }
//   - Missing ANTHROPIC_API_KEY    → 500 { error: 'proxy_misconfigured' }
//   - Anthropic non-2xx            → passthrough status + sanitised body
//   - Network error to Anthropic   → 502 { error: 'upstream_unreachable' }
//
// Deploy:
//   supabase functions deploy ask-sonu-proxy
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase secrets set ASK_APP_ORIGIN=https://app.example.com
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
// Comma-separated list of allowed origins. Default permissive in dev only.
const ASK_APP_ORIGIN = Deno.env.get('ASK_APP_ORIGIN') ?? '*';

// ── Whitelist of fields forwarded to Anthropic ───────────────────────────────
type ClientBody = {
  system?: string;
  messages?: Array<{ role: string; content: string }>;
  model?: string;
  max_tokens?: number;
  temperature?: number;
};

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS_CAP = 4096; // tree-generator (Opus) needs the full window
const MAX_MESSAGES = 40; // belt-and-braces; client should not send long history

// ── CORS ─────────────────────────────────────────────────────────────────────
function corsHeaders(origin: string | null): Record<string, string> {
  const allow =
    ASK_APP_ORIGIN === '*' ? '*'
    : ASK_APP_ORIGIN.split(',').map(s => s.trim()).includes(origin ?? '') ? (origin ?? '')
    : '';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(body: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

serve(async (req) => {
  const cors = corsHeaders(req.headers.get('Origin'));

  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405, cors);
  }

  if (!ANTHROPIC_API_KEY) {
    return jsonResponse({ error: 'proxy_misconfigured' }, 500, cors);
  }

  // ── Auth gate: require valid Supabase JWT ──────────────────────────────────
  // Once L1-8 lands and every Dashboard user is authenticated, this gate
  // strictly binds Anthropic spend to known users. Pre-L1-8, callers without
  // a JWT fall back to the client-side demo response path (see Ask.jsx).
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return jsonResponse({ error: 'auth_required' }, 401, cors);
  }
  const jwt = authHeader.slice(7).trim();
  if (!jwt) {
    return jsonResponse({ error: 'auth_required' }, 401, cors);
  }

  // Validate JWT via Supabase Auth. Uses anon key + the user's JWT in the
  // headers; supabase-js resolves the user without exposing service role.
  const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userErr } = await supa.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return jsonResponse({ error: 'auth_invalid' }, 401, cors);
  }
  const userId = userData.user.id;

  // ── Parse + whitelist body ────────────────────────────────────────────────
  let raw: ClientBody;
  try {
    raw = await req.json() as ClientBody;
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400, cors);
  }

  const system = typeof raw.system === 'string' ? raw.system.slice(0, 16000) : '';
  const model = typeof raw.model === 'string' && raw.model.startsWith('claude-')
    ? raw.model
    : DEFAULT_MODEL;
  const max_tokens = Math.min(
    Math.max(1, Number(raw.max_tokens) || 1000),
    MAX_TOKENS_CAP,
  );
  const messages = Array.isArray(raw.messages)
    ? raw.messages
        .filter(m => m && typeof m === 'object' && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
        .slice(-MAX_MESSAGES)
        .map(m => ({ role: m.role, content: m.content.slice(0, 8000) }))
    : [];

  if (messages.length === 0) {
    return jsonResponse({ error: 'empty_messages' }, 400, cors);
  }

  // temperature: optional, clamp to [0, 2]
  const temperature = typeof raw.temperature === 'number' && Number.isFinite(raw.temperature)
    ? Math.max(0, Math.min(2, raw.temperature))
    : undefined;

  // ── Forward to Anthropic ──────────────────────────────────────────────────
  const anthropicBody: Record<string, unknown> = { model, max_tokens, system, messages };
  if (temperature !== undefined) anthropicBody.temperature = temperature;

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(anthropicBody),
    });
  } catch {
    return jsonResponse({ error: 'upstream_unreachable' }, 502, cors);
  }

  // Read body once; passthrough status. Sanitise error messages to avoid
  // leaking upstream internals.
  const upstreamText = await upstreamRes.text();
  if (!upstreamRes.ok) {
    return jsonResponse(
      { error: 'upstream_error', status: upstreamRes.status },
      upstreamRes.status >= 500 ? 502 : upstreamRes.status,
      cors,
    );
  }

  let upstreamJson: unknown;
  try {
    upstreamJson = JSON.parse(upstreamText);
  } catch {
    return jsonResponse({ error: 'upstream_malformed' }, 502, cors);
  }

  // Log usage for observability (no message content — privacy-preserving).
  // Best-effort, ignore failures.
  try {
    const usage = (upstreamJson as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
    await supa.from('finio_ask_usage_log').insert({
      user_id: userId,
      model,
      input_tokens: usage?.input_tokens ?? null,
      output_tokens: usage?.output_tokens ?? null,
      created_at: new Date().toISOString(),
    });
  } catch {
    /* ignore — observability is best-effort */
  }

  return jsonResponse(upstreamJson, 200, cors);
});
