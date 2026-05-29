# cron-cma-refresh — Deployment notes

**Created:** 2026-05-28 (L4-5)
**Depends on:** migrations `007_create_cma_bundle.sql` (existing) + `017_cron_cma_refresh.sql` (new)
**Schedule:** Monday 06:00 UTC weekly
**Auth:** service-role
**Blast radius:** writes only to `finio_cma_bundle`. Fetches from BoE + Yahoo Finance + (hardcoded) PLSA RLS figures.

---

## What it pulls

| Source | Metric key | Cadence | Licence |
|---|---|---|---|
| BoE 10-year gilt yield (IUDMNZC, daily) | `gilt_yield_10y` | Latest daily figure | OGL |
| Yahoo Finance FTSE 100 | `ftse_100_close` | Latest close | commercial_free |
| PLSA Retirement Living Standards 2025 | `rls_minimum_single`, `rls_moderate_single`, `rls_comfortable_single`, and the couple variants | Manual quarterly update (constant in source) | commercial_restricted |

PLSA RLS values are hardcoded inside `index.ts` because the PLSA only publishes via PDF — no scraping endpoint. When the PLSA releases a new quarterly bulletin (April / October), update the `PLSA_CURRENT` constant in `index.ts` and redeploy. The function reports `plsa.stale = true` in its response when the reference date is > 100 days old, so cron-health-check surfaces the staleness.

## Steps (founder only)

1. **Apply migration 017** (registers the weekly schedule):
   ```bash
   supabase db push
   ```

2. **Deploy the function**:
   ```bash
   supabase functions deploy cron-cma-refresh
   ```

3. **Manual smoke test**:
   ```bash
   curl -X POST \
     -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
     https://<project>.supabase.co/functions/v1/cron-cma-refresh
   ```
   Expected: `{ ok: true, writtenCount: 8, attempted: 8, errors: [], plsa: {...} }`.
   The 8 rows are 1 gilt + 1 FTSE + 6 PLSA metrics.

4. **Verify rows**:
   ```sql
   SELECT metric_key, value, reference_date, fetched_at
   FROM finio_cma_bundle
   WHERE is_current = true
   ORDER BY metric_key;
   ```

5. **Cron-health-check pickup**: nothing to do — the MONITORS registry in `supabase/functions/_shared/cron-health.js` already lists `cron-cma-refresh` with an 8-day threshold. The next hourly health check will start watching it once the first row lands.

## When the PLSA publishes new figures

1. Update the `PLSA_CURRENT` constant in `index.ts`:
   - `reference_date` to the new bulletin date
   - `values[]` to the new GBP/year figures (six entries: minimum/moderate/comfortable × single/couple)
2. `supabase functions deploy cron-cma-refresh`
3. Trigger manually so the new values land same-day:
   ```bash
   curl -X POST -H "Authorization: Bearer $SUPABASE_ANON_KEY" https://<project>.supabase.co/functions/v1/cron-cma-refresh
   ```
