// ─────────────────────────────────────────────────────────────────────────────
// ANTHROPIC VISION PARSER — production swap-in for mock.js.
//
// Client-side adapter to the `parse-document` Supabase edge function. It POSTs
// the file to the server endpoint and unmarshals the JSON response into the FP-5
// ParseResult shape. The edge function holds ANTHROPIC_API_KEY server-side and
// does the actual Claude Vision call.
//
// ACTIVATION IS ENV-DRIVEN — no source edit required:
//   1. Server (founder): `supabase secrets set ANTHROPIC_API_KEY=...` +
//      `supabase functions deploy parse-document`.
//   2. Endpoint: either keep '/api/parse' and add a Vercel rewrite to the
//      deployed function, OR set VITE_PARSE_ENDPOINT to the function URL
//      (https://<ref>.supabase.co/functions/v1/parse-document) — no rewrite then.
//   3. Provider: set VITE_PARSER_PROVIDER=anthropic-vision (this also opens the
//      DataCapture Upload/Scan gate — see DataCapture.jsx).
//
// AUTH: the edge function is JWT-gated (mirrors ask-sonu-proxy). We attach the
// caller's Supabase session token, exactly like the Ask + llm-router proxies.
// In demo/offline mode there is no session → no token → the call 401s, but the
// active provider there is 'mock', so this adapter is never reached.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from '../../lib/supabase.js'

const PARSE_ENDPOINT =
  (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_PARSE_ENDPOINT) || '/api/parse'

export default async function anthropicVisionProvider(file, opts = {}) {
  const form = new FormData()
  form.append('file', file)
  if (opts.docTypeHint) form.append('docTypeHint', opts.docTypeHint)

  // Attach the Supabase session JWT the edge function requires.
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData?.session?.access_token
  if (!accessToken) {
    throw new Error('Sign in to read documents — real parsing needs an authenticated session.')
  }

  const res = await fetch(PARSE_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
    signal: opts.signal,
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Parser failed (${res.status}): ${detail.slice(0, 120)}`)
  }
  const body = await res.json()
  // Server returns { docType, fields, latencyMs, warnings }.
  return {
    docType: body.docType || 'generic-statement',
    fields: Array.isArray(body.fields) ? body.fields : [],
    vendor: 'anthropic-vision',
    latencyMs: body.latencyMs,
    warnings: body.warnings || [],
  }
}
