# Cron alerts setup (L4-6)

**Created:** 2026-05-28
**Shared helper:** `supabase/functions/_shared/notify.ts`
**Used by:** cron-health-check, cron-budget-watch, cron-cma-refresh (when adopted), future crons

---

## Why this exists

Each Edge Function used to inline its own Slack POST with its own error handling. This grew to 4 copies before this consolidation. The shared `notify.ts` helper exposes three functions that any cron can use:

```ts
await postSlack(text)                     // best-effort Slack
await sendEmail(subject, text, html?)     // best-effort SendGrid
await notify(severity, subject, text)     // both, with severity routing
```

All three are fire-and-forget: they never throw, never fail the cron.

## Founder setup steps

### 1. Slack webhook (required for any cron alerts)

```bash
# Get the URL from Slack → Apps → Incoming Webhooks. Pick #sonuswealth-alerts.
supabase secrets set CRON_SLACK_WEBHOOK="https://hooks.slack.com/services/T.../B.../xxx"
```

Verify:
```bash
supabase secrets list | grep CRON_SLACK
```

### 2. SendGrid email (optional — only for `severity:'urgent'` alerts)

```bash
supabase secrets set CRON_SENDGRID_API_KEY="SG.xxx"
supabase secrets set CRON_SENDGRID_FROM="alerts@sonuswealth.example"   # must be a verified sender
supabase secrets set CRON_SENDGRID_TO="founder@sonuswealth.example"    # alert recipient
```

Verify:
```bash
supabase secrets list | grep CRON_SENDGRID
```

### 3. Smoke test the channels

After deploying any cron that uses `notify()`, manually trigger it and watch:
- Slack channel for the message
- Email inbox for urgent-severity messages

If Slack message lands but email doesn't, check Edge logs:
```bash
supabase functions logs <function-name> --tail
```
Look for `[notify] SendGrid HTTP 401` (key wrong) or `403` (sender not verified).

## Severity routing rules

| Severity | When to use | Where it goes |
|---|---|---|
| `info`   | Successful refresh, e.g. cron ran + wrote N rows | Slack only |
| `warn`   | Soft anomaly worth knowing about, e.g. PLSA reference date 80 days old | Slack only |
| `urgent` | Cron failed, multiple crons stale, budget page changed | Slack + email |

Crons should pick severity based on whether the founder needs to do something today:
- "fyi, cron ran and found 3 new PLSA figures" → `info`
- "fyi, gilt yield endpoint returned 503 (will retry next week)" → `warn`
- "**alert**: 3 of 5 crons stale, no fresh macro data in 36h" → `urgent`

## Adopting `notify()` in an existing cron

Replace:

```ts
const SLACK_WEBHOOK = Deno.env.get('CRON_SLACK_WEBHOOK') || '';
if (anyStale && SLACK_WEBHOOK) {
  await fetch(SLACK_WEBHOOK, { method: 'POST', ..., body: JSON.stringify({ text }) });
}
```

With:

```ts
import { notify } from '../_shared/notify.ts';
if (anyStale) await notify('warn', 'cron-name', text);
```

Then remove the local `SLACK_WEBHOOK` import + the inline fetch. Re-deploy the function.

## Migration map (existing crons)

| Function | Status |
|---|---|
| cron-health-check | Inline Slack post — todo: migrate to `notify('urgent', 'cron-health', ...)` |
| cron-budget-watch | Inline Slack post — todo: migrate to `notify('warn',  'budget-watch', ...)` |
| cron-cma-refresh  | No alerts today — add `notify('info', 'cma-refresh', summary)` for ops visibility |
| cron-context-pull (v2) | No alerts today — add `notify('warn', 'context-pull', summary)` on partial failures |

Migration tracked as L4-6b.
