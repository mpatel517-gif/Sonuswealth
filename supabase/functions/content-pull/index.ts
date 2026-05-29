// ─────────────────────────────────────────────────────────────────────────────
// Edge Function: content-pull (L3-5 — 2026-05-28)
//
// Returns the active user-facing copy bundle from finio_content. The client
// (src/hooks/useContent.js) fetches this once per session and merges it on
// top of the static src/content/uk-en.json bundled with the JS chunk.
//
// Why this is a separate function from cron-context-pull:
//   * Different blast radius. cron-context-pull writes service-role
//     economic data; content-pull is anon-read only and writes nothing.
//   * Different schedule. Macro context refreshes daily; content can be
//     edited any time and clients refresh per session (no cron needed
//     unless we add CDN edge caching).
//
// Auth posture:
//   * Anonymous GET allowed — copy is public-by-design (it's literally
//     the text users see). No PII. RLS in 015_finio_content.sql blocks
//     anyone from reading inactive rows or writing.
//   * No JWT requirement. The ask-sonu-proxy needed auth because the
//     downstream call was billable; this one is free + read-only.
//
// CORS:
//   * Allow the production origin + localhost dev. Configurable via env.
//   * `CONTENT_APP_ORIGIN` env var, defaults to '*' in dev.
//
// Response shape:
//   { version, locale, lastUpdated, bundle: { 'home.heroEyebrow': '…', … } }
//
// `version` is the max version across all rows — lets the client compare
// against a cached bundle and skip the merge if nothing changed.
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_ORIGIN                = Deno.env.get('CONTENT_APP_ORIGIN') ?? '*';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  APP_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, authorization',
  'Access-Control-Max-Age':       '3600',
};

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'GET') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  // Locale via querystring (default uk-en — only locale supported today).
  const url    = new URL(req.url);
  const locale = (url.searchParams.get('locale') || 'uk-en').slice(0, 16);

  // Use service-role so the function can read inactive rows for an admin
  // diagnostic endpoint later if needed. Today the SELECT filters active=true
  // so the response shape is identical to what RLS would allow anon to see.
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from('finio_content')
    .select('key, value, version, updated_at')
    .eq('locale', locale)
    .eq('active', true);

  if (error) {
    console.error('[content-pull] db error:', error.message);
    return json({ error: 'db_error' }, 500);
  }

  // Flatten rows into a key→value map. Track max version + last updated.
  let maxVersion = 0;
  let lastUpdated: string | null = null;
  const bundle: Record<string, string> = {};
  for (const row of data ?? []) {
    bundle[row.key] = row.value;
    if (row.version > maxVersion) maxVersion = row.version;
    if (!lastUpdated || row.updated_at > lastUpdated) lastUpdated = row.updated_at;
  }

  return json(
    {
      locale,
      version:     maxVersion,
      lastUpdated, // ISO ts of the most recently edited row in this locale
      count:       Object.keys(bundle).length,
      bundle,
    },
    200,
    // Allow short browser caching — clients refresh on session start anyway,
    // and bursty traffic shouldn't hammer the function.
    { 'Cache-Control': 'public, max-age=60' }
  );
});

function json(body: unknown, status: number, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...CORS_HEADERS,
      ...extra,
    },
  });
}
