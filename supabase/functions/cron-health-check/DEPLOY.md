# cron-health-check — Deployment notes

**Created:** 2026-05-28 (L4-2)
**Depends on:** migration `016_cron_health_check.sql`
**Auth:** service-role only (pg_cron triggers via http_post with the bearer token)
**Blast radius:** writes to `finio_cron_status` only. Cannot read user data. Can POST to one external URL: `CRON_SLACK_WEBHOOK` (if set).

---

## What this does

Every hour at :07, queries the latest write timestamp of each cron's destination table:

| Cron | Watched table | Column | Threshold |
|---|---|---|---|
| `cron-context-pull` | `finio_macro_variables` | `effective_date` | 26h (daily + 2h grace) |
| `cron-rules-activation` | `finio_scheduled_activations` | `activated_at` | 26h (daily + 2h grace) |

For each:
- `healthy` — last write within threshold
- `stale` — last write older than threshold (alert + Slack post)
- `unknown` — no rows yet (silent, no alert — happens on first deploy)

One row appended to `finio_cron_status` per check per cron — so the founder can audit "when did context-pull last succeed?" without trawling Edge logs.

Slack alert fires ONLY on `stale`. `unknown` is silent because that's the expected state pre-first-run.

---

## Steps (founder only — Supabase CLI session required)

1. **Apply the migration.** Creates `finio_cron_status` + schedules hourly check.
   ```bash
   supabase db push
   ```
   Verify: `select * from cron.job where jobname = 'cron-health-check-hourly';` should return one row.

2. **Deploy the function.**
   ```bash
   supabase functions deploy cron-health-check
   ```

3. **Set the Slack webhook secret** (optional but recommended — without it, alerts go to Edge logs only):
   ```bash
   supabase secrets set CRON_SLACK_WEBHOOK=https://hooks.slack.com/services/T.../B.../xxx
   ```
   Get the URL from Slack → Apps → Incoming Webhooks. Pick a low-priority channel like `#sonuswealth-alerts`.

4. **Manual smoke test.**
   ```bash
   curl -X POST \
     -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
     https://<project>.supabase.co/functions/v1/cron-health-check
   ```
   Expected response: `{ ok: true, checkedAt: "...", summary: {...}, decisions: [...] }`.
   On first run after the cron tables are empty, expect `decisions: [{ status: 'unknown', ... }, ...]`.

5. **Verify the alert path.**
   In SQL editor, simulate staleness by inserting a fake old row, then re-trigger the function:
   ```sql
   -- Simulate cron-context-pull being 30h old (over the 26h threshold)
   INSERT INTO finio_macro_variables (key, value, effective_date)
   VALUES ('cpi_test_stale', 0.0, now() - interval '30 hours');
   ```
   ⚠ Only the LATEST row per table is checked, so this only works if no fresher real row exists. Skip this step in production. Use the unit test as the proof instead: `npm run test:l4-2-cron-health`.

6. **Audit the log.**
   ```sql
   SELECT cron_name, status, age_seconds, checked_at
   FROM finio_cron_status
   ORDER BY checked_at DESC LIMIT 20;
   ```

## When the alert fires — what to do

1. **Don't panic** — the cron may have just been slow. Wait for the next hour's check.
2. **Check the Edge Function logs** for the stale cron:
   ```bash
   supabase functions logs cron-context-pull --tail
   ```
3. **Common causes:**
   - Upstream data source (ONS, BoE, HMRC) returned 5xx — retry next run
   - Service-role key rotated and the secret wasn't updated — `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...`
   - Edge Function code thrown an unhandled error — fix + redeploy
   - pg_cron disabled or the schedule got unscheduled — `select cron.job_run_details` to confirm
4. **To silence the alert temporarily** (e.g. while you fix), unschedule the health check:
   ```sql
   SELECT cron.unschedule('cron-health-check-hourly');
   ```
   Re-schedule after the underlying cron is healthy:
   ```sql
   SELECT cron.schedule(
     'cron-health-check-hourly', '7 * * * *',
     $$SELECT net.http_post(...) AS request_id;$$
   );
   ```
   (Full body in migration 016.)

## Adding a new cron to the watch list

Edit `supabase/functions/_shared/cron-health.js` — add a `MONITORS` entry with `{ cronName, table, timestampColumn, thresholdSeconds, description }`. The CI test (`npm run test:l4-2-cron-health`) will verify the shape on next PR. No migration needed.
