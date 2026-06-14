# ⚡ Activate the Decision Engine + Ask Sonu (real Claude) — founder steps

**Diagnosed 2026-06-13 (via Supabase MCP, read-only):** the real blocker for the
DE "joke" / fallback trees is **not just the key** — the `ask-sonu-proxy` edge
function the client calls **is not deployed** on project `yknnfglfbpcyxcllrvmd`
(only `cron-context-pull` + `cron-rules-activation` are live). Setting the key
alone does nothing until the proxy exists. The MCP is read-only so I couldn't
deploy it; run these from the repo root:

```bash
# 1) Rotate first — the old VITE_ANTHROPIC_KEY was bundled client-side (treat as compromised)
#    console.anthropic.com → revoke old, create new.

# 2) Set the key (NEW rotated key) — your secret, never in repo
supabase secrets set ANTHROPIC_API_KEY=sk-ant-api03-...  --project-ref yknnfglfbpcyxcllrvmd

# 3) Deploy the proxy (already written + self-contained, JWT-gated, inert until key set)
supabase functions deploy ask-sonu-proxy  --project-ref yknnfglfbpcyxcllrvmd

# 4) (optional) usage logging — proxy works without it (best-effort insert)
supabase db push   # applies 014_ask_usage_log.sql

# 5) (prod, recommended) lock CORS to your origin
supabase secrets set ASK_APP_ORIGIN=https://app.sonuswealth.com  --project-ref yknnfglfbpcyxcllrvmd
```

**Build env (confirm set wherever you build):**
`VITE_SUPABASE_URL=https://yknnfglfbpcyxcllrvmd.supabase.co` + `VITE_SUPABASE_ANON_KEY=...`

**⚠️ Auth prerequisite — the catch:** the proxy requires a real signed-in Supabase
session (binds Anthropic spend to a user). The DE/Ask only call real Claude when
**logged in**. The **demo personas (`?demo=mrt`) have no session → they keep the
honestly-labelled fallback trees.** To SEE real trees, test as a signed-in user,
not a demo. Models the client sends: DE `claude-opus-4-7`, Ask `claude-sonnet-4-6`
(both current; the function's `DEFAULT_MODEL` is stale but never used).

**Verify:** sign in → Ask Sonu question → Network shows `/functions/v1/ask-sonu-proxy`
returning Anthropic shape → DE question shows a real tree with NO "Illustrative" banner.

---

# Activate real document reading (Upload / Scan) — founder steps

**Status as of 2026-06-13:** the parser pipeline is fully built and the client
is now **fully env-driven — no source edits required**. Document upload works
*today* on the demo (mock) parser with figures clearly flagged as illustrative.
Real Claude Vision reading turns on the moment you do the steps below.

I closed three activation gaps this session so the only things left are your
server steps + build env (nothing to edit in code):
1. The client adapter now **attaches your Supabase session JWT** — the edge
   function is JWT-gated, so without this every real parse 401'd.
2. The endpoint is now **env-overridable** (`VITE_PARSE_ENDPOINT`) — point
   straight at the function, no Vercel rewrite needed if you'd rather not.
3. The DataCapture Upload/Scan gate is now **driven by the same env var** that
   selects the provider — no `REAL_PARSER_WIRED` source edit to remember.

---

## Step 1 — Server (only you: your secret + your Supabase project)

```bash
# Put the key in the edge function's secrets (NEVER in the repo / .env)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   --project-ref <your-ref>

# Deploy the (already-written) parser function
supabase functions deploy parse-document            --project-ref <your-ref>
```

The function at `supabase/functions/parse-document/index.ts` is complete:
JWT-gated, CORS allow-list, Claude Vision call, returns FP-5 fields. Its model
is now `claude-sonnet-4-6` and is itself overridable via a `VISION_MODEL` secret
if you want Opus for harder scans.

Optional, recommended: lock CORS to your origin —
`supabase secrets set PARSE_APP_ORIGIN=https://app.sonuswealth.com`.

## Step 2 — Build env (two vars, set wherever you build — Vercel/CI/`.env.local`)

```bash
VITE_PARSER_PROVIDER=anthropic-vision
# ONE of:
#   (a) add a Vercel rewrite  "/api/parse" -> "<supabase-url>/functions/v1/parse-document"
#   (b) OR skip the rewrite and point the client straight at the function:
VITE_PARSE_ENDPOINT=https://<your-ref>.supabase.co/functions/v1/parse-document
```

`VITE_PARSER_PROVIDER=anthropic-vision` does **both** jobs: it selects the real
provider *and* opens the Upload/Scan gate in Data Capture. That's the single
switch. (There's also `VITE_REAL_PARSER=true` if you ever wire a different real
provider.)

That's the whole activation. No source files to touch.

## Auth prerequisite

Real parsing needs a signed-in Supabase session (the JWT binds Anthropic spend
to a user, same as Ask Sonu). In demo/offline mode there's no session, so the
app stays on the mock parser — the real adapter is never reached. Make sure
`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` are set and the user is
authenticated before expecting live reads.

## Verify after activation

Upload a real SA302 into a 5-year tax-record row (Tax & Estate → Tax record ·
last 5 years → a prior year → Upload return). The banner should NOT say "demo
parse"; the figures should match the document; nothing stores until you confirm.
