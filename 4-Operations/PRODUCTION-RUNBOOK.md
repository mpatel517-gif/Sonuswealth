# Production runbook & incident response

**Owner:** founder
**Created:** 2026-05-28 (L5-10)
**Last updated:** 2026-05-28

Single doc you read when something is broken or you suspect it might be. Everything else is reference material; this is the operational picture.

---

## Where to look when X happens

| Symptom | Where to look first | Common cause |
|---|---|---|
| User reports wrong £ figures | `tests/regression-baseline.json` + latest `regression-result-*.json` artifact | Rules-bundle update overnight; check L4-7 stale-snapshot banner |
| App crashes on a screen | Sentry (`window.Sentry`) + observability.js logs | Uncaught error in a selector; check L1-3 ErrorBoundary catches |
| Ask Sonu returns nothing | `supabase functions logs ask-sonu-proxy --tail` | Anthropic key rotated / proxy down |
| Copy didn't update after edit | `supabase functions logs content-pull --tail` + `select * from finio_content order by updated_at desc limit 5` | Live overlay cached for 30 min in sessionStorage; or `_meta.version` not bumped |
| Cron looks broken | `select * from finio_cron_status order by checked_at desc limit 20` | Cron-health-check will Slack you — see L4-2 DEPLOY.md |
| Slack alert fires | Edge function logs for the named cron + `tests/reports/` artifact (regression) | Look at the cron's DEPLOY.md "When the alert fires" section |
| CI is red | GitHub Actions → which test gate failed | One of 12 test gates — each is its own diagnostic |
| Login broken | `supabase functions logs` + auth.users table | Supabase Auth down / email confirmation flow stuck |
| Numbers different across screens | Run the cross-screen tie-out: `npm run test:dynamic` | A new selector skipped a normalisation path — engine bug |

---

## Monitoring touchpoints

| Channel | What lands there | Severity |
|---|---|---|
| Slack `#sonuswealth-alerts` (via `CRON_SLACK_WEBHOOK`) | All cron alerts + nightly regression drift | varies |
| Email (via `CRON_SENDGRID_TO`) | Only `severity:'urgent'` from `notify()` helper | high |
| Sentry | Uncaught render errors + window.onerror + unhandledrejection | high |
| PostHog | Page views + custom events (`track()` from observability.js) | low |
| GitHub Actions | CI failures (red mainline) + nightly regression artifact | varies |
| `supabase functions logs` | Edge function stdout/stderr | varies |

If a channel is silent for more than 24h, ask yourself: is it really silent or is the channel broken?

---

## Test gates (CI runs these on every PR)

10 gates as of L5-10:

1. `lint` — eslint
2. `build` — vite build
3. `test:r08` — r08 validation
4. `test:home` — home-engine smoke
5. `test:qa` — visual QA
6. `test:dynamic` — 12 synthetic personas × 20 selectors (L2-4)
7. `test:l2-3-gate` — validateEntity at Onboarding (L2-3)
8. `test:l2-6a-gate` — validateEvent at EventsProvider (L2-6a)
9. `test:l2-5a-persist` — Onboarding device-side resume (L2-5a)
10. `test:l3-4-bundle` — content bundle shape (L3-4)
11. `test:l4-2-cron-health` — cron staleness decision (L4-2)
12. `test:l4-4-regression-diff` — nightly regression diff math (L4-4)
13. `test:l4-10-safe-storage` — LRU eviction (L4-10)
14. `test:l4-7-snapshot-version` — stale snapshot detection (L4-7)
15. `test:l4-3-budget-watch` — budget-watch page registry (L4-3)
16. `test:l5-2-fixtures` — vulnerability fixtures (L5-2)
17. `secrets-scan` — grep dist/ for sk-ant-* / sk-or-* / api.anthropic.com (L1-5)

Plus the weekly cadence (per DoD §weekly):
- Full `--all-personas --hybrid` rules-validator run
- MCP snap at 3 viewports × 2 themes × 4 personas across 7 main routes
- `supabase functions list` audit
- 5-commit CI history check

---

## Deployable artifacts

What ships to production:

| Artifact | How it deploys | Frequency | Approver |
|---|---|---|---|
| App bundle (Vite build of `dist/`) | `vercel deploy` or `gh-pages` (TBD) | per PR merge | founder |
| Supabase migrations | `supabase db push` | per migration | founder |
| Edge Functions | `supabase functions deploy <name>` | per change | founder |
| Rules bundle (UK-YYYY.X.Y.json) | Bundled into app — no separate deploy | per Budget Day (see BUDGET-DAY-RUNBOOK.md) | founder + tax-accountant agent |
| Content bundle (finio_content rows) | SQL UPDATE in Supabase dashboard | any time | founder (live, no review) |
| Slack webhook / SendGrid keys | `supabase secrets set …` | rare | founder |

Nothing in this list deploys automatically. Every push is a deliberate act.

---

## Common failure modes & responses

### 1. Anthropic key leaked / rotated

**Symptoms:** Ask Sonu returns 401 / 429. Proxy logs show repeated `Bearer …` failures.

**Response:**
1. Rotate at console.anthropic.com
2. `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...` (proxy reads this)
3. Verify: `curl -X POST https://<project>.supabase.co/functions/v1/ask-sonu-proxy ...`

**Prevention:** L1-1 moved the key server-side. Don't put it in the client bundle.

### 2. Rules bundle update breaks regression

**Symptoms:** `regression-nightly` workflow fails. Slack alert. Drifted cells list in artifact.

**Response:**
1. Was the bundle update deliberate? If yes, re-capture baseline (`npm run regression:capture`), commit, push.
2. If no, find the unintended change. Look at the bundle's `_correctionLog` diff vs the commit before the alert started.
3. Revert the bundle entry. Re-run `regression:check`.

**Prevention:** BUDGET-DAY-RUNBOOK.md step 5 — sanity-check against HMRC's free calculator before committing.

### 3. Cron silently stops running

**Symptoms:** cron-health-check Slack alert "🔴 <cron-name> — last write 50h ago, threshold 26h".

**Response:**
1. `supabase functions logs <cron-name> --tail` — look for the latest invocation
2. If never invoked: check `select * from cron.job_run_details order by start_time desc limit 5`
3. If invocations failing: read the error. Common: service-role key rotated without updating the secret.

**Prevention:** L4-2 cron-health-check is exactly this. Without it you wouldn't notice for weeks.

### 4. Content edit doesn't show up

**Symptoms:** Edited a row in finio_content, refreshed app, still old text.

**Response:**
1. Check sessionStorage in DevTools — `sw_content_live_v1` is cached for 30 min
2. Open private window, navigate to app — should show new text
3. If still old: `supabase functions logs content-pull --tail` to verify the function ran on session-start
4. Confirm the row was actually updated: `select * from finio_content where key = '...'`

**Prevention:** L3-5 — live overlay is fail-soft. Static `uk-en.json` is the floor.

### 5. localStorage full

**Symptoms:** Persona reset on reload. Onboarding progress lost. Console warning from L4-10 (`L4-10 safe-storage`).

**Response:**
1. Open DevTools → Application → Local Storage → sonuswealth-app-origin
2. Look at the size — if near 5MB, the LRU should have evicted but maybe didn't because keys weren't indexed
3. Clear the storage. User loses non-persisted state but app keeps working.

**Prevention:** L4-10b is the migration that wires all existing call sites to `safe-storage`. Track its progress.

### 6. Snapshot vs current bundle mismatch

**Symptoms:** User reports numbers feel different from last week.

**Response:**
1. L4-7 should surface a stale-snapshot banner — confirm user sees it
2. Click "Recompute under today's rules" — numbers should align with current dashboard
3. If banner didn't fire: snapshot may not carry a `bundle_id`; check `snapshotBundleId(snapshot)` returns non-null

**Prevention:** L4-7 wired at snapshot-reading screens (L4-7b — tracked).

---

## Rollback procedures

### App bundle

1. Vercel: `vercel rollback` (point at previous deploy)
2. GitHub Pages: revert the deploy commit, push

### Supabase migration

Most migrations are additive. To roll back:

```bash
# Find the migration to roll back
ls supabase/migrations/

# Apply the rollback (write manually — supabase CLI doesn't auto-generate down migrations)
psql $DATABASE_URL -c "DROP TABLE finio_xyz;"
```

For policies / RLS: `ALTER TABLE foo DISABLE ROW LEVEL SECURITY;` undoes L4-9.

### Edge Function

```bash
# Roll back to a previous version (Supabase keeps deployment history)
supabase functions deploy <name> --import-map-path supabase/functions/<name>/import_map.json \
  --version-id <previous-version-id>
```

Or just revert the source file + redeploy.

### Rules bundle

NEVER backdate a bundle. Fix forward:
1. Increment patch version (UK-2027.1.0 → UK-2027.1.1)
2. Document the correction in `_meta._correctionLog`
3. Re-capture regression baseline
4. Push

---

## Post-incident review template

After any production incident (even a small one), write a 1-page review and commit it to `4-Operations/incidents/YYYY-MM-DD-short-title.md`:

```markdown
# Incident: <title>

**Date:** YYYY-MM-DD HH:MM TZ
**Duration:** N minutes
**Severity:** P0 / P1 / P2
**Reporter:** how we found out

## What happened
2–3 sentences.

## Impact
Users affected, $ at stake, regulatory implications.

## Root cause
1 paragraph.

## Timeline
- HH:MM — first signal
- HH:MM — investigation started
- HH:MM — root cause identified
- HH:MM — fix applied
- HH:MM — verified resolved

## What worked
Things that helped resolve it faster.

## What didn't work
Things that delayed resolution.

## Action items
- [ ] @founder — short-term fix (immediate)
- [ ] @founder — medium-term fix (this week)
- [ ] @founder — prevention (this quarter)
```

The point of the template isn't bureaucracy — it's making sure the same incident doesn't recur because nobody wrote down what caused it last time.

---

## File map

| Path | Use |
|---|---|
| `0-Active/DEFINITION-OF-DONE.md` | DoD gate — every ticket evidence string |
| `0-Active/BUDGET-DAY-RUNBOOK.md` | What to do on a Budget Day (L4-8) |
| `4-Operations/PRODUCTION-RUNBOOK.md` | This file |
| `4-Operations/incidents/` | Post-incident reviews |
| `supabase/functions/*/DEPLOY.md` | Per-function deployment guides |
| `supabase/functions/NOTIFY-SETUP.md` | Alerts plumbing setup (L4-6) |
| `tests/harness/REGRESSION-DEPLOY.md` | Nightly regression activation (L4-4) |

---

## Escalation

If you're 30 minutes in and not making progress:
1. Disable the affected feature with a feature flag if possible
2. Roll back the change that likely caused it
3. Write a one-line Slack message: "Incident on X. Rolling back. Investigation continues."

If users are getting wrong £ figures and you can't isolate the cause, take the app offline (display a maintenance page) rather than letting them act on bad numbers. Regulatory exposure outweighs a few hours of downtime.
