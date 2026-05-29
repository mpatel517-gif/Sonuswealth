# content-pull — Deployment notes

**Created:** 2026-05-28 (L3-5)
**Depends on:** migration `015_finio_content.sql`
**Auth:** anonymous read (no JWT required)
**Blast radius:** can change marketing/empty-state/onboarding copy. Cannot change legal text, FCA disclaimer, tax rates, or engine outputs.

---

## Steps (founder only — Supabase CLI session required)

1. **Apply the migration.** Creates `finio_content` + 40 seed rows.
   ```bash
   supabase db push
   ```
   Verify: `supabase db remote commit` should show migration 015 applied; `select count(*) from finio_content` should return 40.

2. **Deploy the function.**
   ```bash
   supabase functions deploy content-pull
   ```

3. **Set the allowed origin** (production only — dev can stay `*`):
   ```bash
   supabase secrets set CONTENT_APP_ORIGIN=https://app.sonuswealth.example
   ```
   For staging, set to the staging origin instead.

4. **Smoke test from the client.**
   - Open the app
   - Network tab → expect a GET to `/functions/v1/content-pull?locale=uk-en`
   - Response JSON should include `count: 40` and a `bundle` map
   - sessionStorage should now contain `sw_content_live_v1`

5. **Live-edit smoke test.**
   In the SQL editor:
   ```sql
   UPDATE finio_content
      SET value = 'TEST OVERRIDE — remove me'
    WHERE key = 'cashflow.noBillsState' AND locale = 'uk-en';
   ```
   - Refresh the app (new session → cache wipe)
   - Navigate to Cashflow → Bills card empty state
   - Should now show "TEST OVERRIDE — remove me"
   - Revert:
     ```sql
     UPDATE finio_content
        SET value = 'No bills detected yet. Bill calendar populates once you add fixed bills (+ Bill) or connect Open Banking.'
      WHERE key = 'cashflow.noBillsState' AND locale = 'uk-en';
     ```

## What this does NOT need

* No cron registration — the function is pull-on-session-start, not scheduled.
* No JWT auth — copy is public-by-design.
* No new env vars beyond `CONTENT_APP_ORIGIN` (optional in dev).

## What's still pending (after deploy)

* **L3-4b mechanical sweep** — wrap the ~40 remaining inline copy strings across MyMoney / TaxEstate / Timeline / Risk / Home / Ask / Onboarding with `getContent(key, fallback)` or `useContent()`. The bundle keys are already shipped; the work is purely call-site wrapping.
* **Admin "Edit content" page** — current edit path is the Supabase SQL editor. A simple table view + per-row textarea would be the next step.
