# ask-sonu-proxy — Deployment Notes

**L1-1 (2026-05-28)** — Removes Anthropic API key from client bundle.

## What this function does

- Receives `{ system, messages, model, max_tokens, temperature? }` from the client.
- Validates a Supabase JWT (rejects anon callers with 401).
- Forwards to `api.anthropic.com/v1/messages` with the **server-side** `ANTHROPIC_API_KEY`.
- Logs token usage (no content) to `finio_ask_usage_log`.

## Pre-deploy actions (founder)

**1. Rotate the leaked keys.** The previous `VITE_ANTHROPIC_KEY` was in client bundles for an unknown window. Treat as compromised.
- Go to https://console.anthropic.com → Settings → API Keys
- Revoke the existing key
- Create a new key

**2. Rotate Trading212 key.** Same exposure — was also `VITE_`-prefixed in `.env.local`.

**3. Set the proxy secret.** From the repo root:

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-api03-...   # NEW rotated key
supabase secrets set ASK_APP_ORIGIN=https://your-app-origin.com   # production only
```

For local dev, `ASK_APP_ORIGIN` can stay unset (defaults to `*`).

**4. Apply migration 014.**

```bash
supabase db push
```

This creates `finio_ask_usage_log` with RLS so users see only their own rows.

**5. Deploy the function.**

```bash
supabase functions deploy ask-sonu-proxy
```

**6. Remove old client-side key from local env.** Edit `.env.local`:
- Delete the line `VITE_ANTHROPIC_KEY=...`
- Delete the line `VITE_ANTHROPIC_API_KEY=...` if present

The client no longer reads it. Leaving it in `.env.local` is unnecessary risk.

## Verification

After deploy, from the app:

1. Sign in (must be an authenticated Supabase session — anon falls back to demo response).
2. Open Ask Sonu → ask a finance question.
3. Network tab: request goes to `<supabase-url>/functions/v1/ask-sonu-proxy`, not `api.anthropic.com`.
4. Response payload matches Anthropic's Messages API response shape.
5. `select * from finio_ask_usage_log order by created_at desc limit 5` shows your row.

## Failure modes

| Status | Body                     | Means                                      |
|--------|--------------------------|--------------------------------------------|
| 401    | `auth_required`          | No Authorization header                    |
| 401    | `auth_invalid`           | JWT bad or expired                         |
| 400    | `invalid_json`           | Body not JSON                              |
| 400    | `empty_messages`         | `messages` array missing or empty          |
| 500    | `proxy_misconfigured`    | `ANTHROPIC_API_KEY` env var not set        |
| 502    | `upstream_unreachable`   | Anthropic API unreachable from Supabase    |
| 502    | `upstream_malformed`     | Anthropic returned non-JSON                |
| ≥400   | `upstream_error`+status  | Anthropic returned non-2xx (e.g. quota)    |

In all failure cases, the client's `getDemoResponse` fallback runs (see `src/screens/Ask.jsx:send`).

## Future hardening

- Per-user rate limit (PostgreSQL stored proc, e.g. 60 calls/hour).
- Per-user spend cap (compute monthly token total from `finio_ask_usage_log`).
- Streamed SSE response (currently buffered — fine for sub-2k tokens).
- Anthropic prompt caching headers (cuts cost ~50% for repeated system prompts).
