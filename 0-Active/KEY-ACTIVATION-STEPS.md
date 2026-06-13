# Activate real document reading (Upload / Scan) — founder steps

**Status as of 2026-06-13:** the parser pipeline is fully built and the client
code is pre-wired. Document upload works *today* on the demo (mock) parser with
figures clearly flagged as illustrative. Real Claude Vision reading is **inert**
until the two server steps below — which need YOUR Anthropic key, so they're
yours to run. I've already done the code-side wiring (provider registered).

## What only you can do (your secret + your Supabase project)

```bash
# 1. Put the key in the edge function's secrets (NEVER in the repo / .env)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   --project-ref <your-ref>

# 2. Deploy the (already-written) parser function
supabase functions deploy parse-document            --project-ref <your-ref>
```

That's it for the server. The function at `supabase/functions/parse-document/index.ts`
is complete: JWT-gated, CORS allow-list, Claude Vision call, returns FP-5 fields.

## What I've already done (code side)

- Registered the `anthropic-vision` provider in `src/services/parser.js` (was commented out).
- The 5-year tax record's "Upload return" path already calls the shared parser,
  so it flips to real reading automatically once the provider is active.

## The two flips that turn it on (I can do these, or you can — trivial)

3. **Route** the client's `/api/parse` POST to the deployed function. Either add a
   Vercel rewrite `"/api/parse" -> "<supabase-url>/functions/v1/parse-document"`,
   or change `PARSE_ENDPOINT` in `src/services/parsers/anthropic-vision.js:25`
   to the function URL.
4. **Select** the provider + flip the gate:
   - `src/screens/DataCapture.jsx:32` → `const REAL_PARSER_WIRED = true`
   - set build env `VITE_PARSER_PROVIDER=anthropic-vision` (or call `setParserProvider('anthropic-vision')` at app start)

## One thing worth updating while you're in there

`supabase/functions/parse-document/index.ts:37` pins `VISION_MODEL =
'claude-sonnet-4-20250514'`. Consider bumping to the current Sonnet/Opus vision
model before go-live.

## Verify after activation

Upload a real SA302 into a 5-year tax-record row (Tax & Estate → Tax record ·
last 5 years → a prior year → Upload return). The banner should NOT say "demo
parse"; the figures should match the document; nothing stores until you confirm.
