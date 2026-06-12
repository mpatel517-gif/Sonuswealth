# parse-document — Claude Vision document parser (W5-5b)

Server endpoint behind Data Capture's **Upload** and **Scan** channels. Holds
`ANTHROPIC_API_KEY` server-side and returns FP-5 parsed fields. The client
adapter (`src/services/parsers/anthropic-vision.js`) already POSTs to `/api/parse`
expecting this function's response shape.

## Status: DEPLOY-READY, INERT

The code is complete and mirrors the proven `ask-sonu-proxy` security model
(JWT gate, CORS allow-list, sanitised upstream errors). It does **nothing** in
production until the founder performs the four activation steps below — until
then DataCapture stays on its honest empty-state path and never shows fabricated
fields. This is deliberate: flipping the switch before the key exists would make
a dead path look live (CLAUDE.md §9 CTA-honesty).

## Activation (founder — needs the secret)

```bash
# 1. Set the key as a function secret (NEVER in the repo / .env / vault)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set PARSE_APP_ORIGIN=https://your-app-origin

# 2. Deploy
supabase functions deploy parse-document

# 3. Route /api/parse → this function
#    Vercel: add a rewrite  { "source": "/api/parse",
#      "destination": "https://<project>.supabase.co/functions/v1/parse-document" }
#    (or call the function URL directly from anthropic-vision.js PARSE_ENDPOINT)
```

```js
// 4. Wire the client provider (src/services/parser.js PROVIDERS map)
'anthropic-vision': (await import('./parsers/anthropic-vision.js')).default,
// and in src/screens/DataCapture.jsx flip:
const REAL_PARSER_WIRED = true
// set VITE_PARSER=anthropic-vision (or setParserProvider('anthropic-vision'))
```

## Contract

- **In:** `multipart/form-data` with `file` (image/* or application/pdf, ≤12MB)
  and optional `docTypeHint`. `Authorization: Bearer <supabase-jwt>` required.
- **Out:** `{ docType, fields[], warnings[], latencyMs }` where each field is
  `{ id, label, value, unit('gbp'|'date'|'text'), wrapper, confidence, source }`.
  `wrapper` vocabulary matches `DataCapture.WRAPPER_ROUTE` so a parsed £ field
  routes straight onto the balance sheet via `toAssetEventPayload`.

## Privacy

The uploaded document is sent to Anthropic for OCR (disclosed in capture consent
copy). No document bytes are persisted by this function — parse is transient.
Verify this matches the privacy policy before go-live (D2 lane).

## Verification before declaring live (CLAUDE.md §9.5)

1. Upload a real sample statement → FP-5 modal shows real extracted figures.
2. Accept a £ field → confirm NW moves by that amount (tie-out via preview_eval).
3. Confirm low-confidence fields flag amber and require review.
4. Confirm a non-financial image returns `fields: []` + a warning (no hallucination).
