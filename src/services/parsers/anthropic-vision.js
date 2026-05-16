// ─────────────────────────────────────────────────────────────────────────────
// ANTHROPIC VISION PARSER — production swap-in for mock.js.
//
// NOT WIRED YET. This file documents the contract so the next-session swap is
// one config change. Steps to enable:
//
//   1. Add to PROVIDERS in services/parser.js:
//        'anthropic-vision': (await import('./parsers/anthropic-vision.js')).default,
//      (lazy import so the mock build doesn't ship the SDK.)
//
//   2. Provide ANTHROPIC_API_KEY via OS env var (per user_security_context — no .env).
//      The browser cannot call Anthropic directly (CORS); the call goes through a
//      thin server endpoint POST /api/parse that proxies the request with the key
//      held server-side. See /server/parse.ts (to be added).
//
//   3. Set VITE_PARSER_PROVIDER=anthropic-vision in the build env, or call
//      setParserProvider('anthropic-vision') at app start.
//
// The function below is the client-side adapter. It POSTs the file to the
// server endpoint and unmarshals the JSON response into the FP-5 ParseResult
// shape. The server endpoint is responsible for the actual Claude Vision call
// with structured output schema enforcement.
// ─────────────────────────────────────────────────────────────────────────────

const PARSE_ENDPOINT = '/api/parse'

export default async function anthropicVisionProvider(file, opts = {}) {
  const form = new FormData()
  form.append('file', file)
  if (opts.docTypeHint) form.append('docTypeHint', opts.docTypeHint)

  const res = await fetch(PARSE_ENDPOINT, {
    method: 'POST',
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
