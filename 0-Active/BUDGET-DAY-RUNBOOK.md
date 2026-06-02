# Budget-day runbook

**Created:** 2026-05-28 (L4-8)

What to do when the Chancellor stands up. This is the once-per-six-months process for turning Budget announcements into a verified, deployed rules-bundle update. The whole loop is ~4 hours of focused work for an experienced operator — most of which is verification, not authoring.

---

## Trigger

You get the signal in one of three ways, ordered by speed:

1. **cron-budget-watch alert** (L4-3) — a gov.uk rate page changed; the founder gets a Slack message within 24h
2. **Manual** — you watched the Budget speech and know rates moved
3. **User report** — a user notices their numbers feel wrong (this is the failure mode this runbook exists to prevent)

## Outputs

Every successful run produces:
1. A new `src/rules/UK-2027.1.X.json` (or whatever the next version is)
2. A `_correctionLog` entry inside `_meta` listing every changed value with HMRC reference
3. The L4-4 regression baseline re-captured + committed
4. The `_pending_changes` block in the next-year DRAFT bundle updated
5. A `git tag rules-uk-2027.1.X` so the bundle version is locked in version control

---

## Step-by-step

### 1. Start from the DRAFT skeleton

The next year's skeleton already exists at `src/rules/UK-2027.1.0-DRAFT.json` (L4-8). The skeleton's `_pending_changes` array lists everything we already know is coming (Royal Assent items, carryovers, deferred announcements). Read it first.

```bash
cat src/rules/UK-2027.1.0-DRAFT.json | jq '._meta._pending_changes'
```

### 2. Copy the current verified bundle as the starting point

```bash
cp src/rules/UK-2026.1.1.json src/rules/UK-2027.1.0.json
```

Then edit `_meta` in the new file:
- `version`: new identifier (e.g. `UK-2027.1.0`)
- `taxYear`: `2027/28`
- `effectiveFrom` / `effectiveTo`: align with tax year boundaries
- `supersedes`: previous version
- `verifiedBy`: TBC until step 5
- `_correctionLog`: empty array — fill as you go

### 3. Apply known changes from the DRAFT _pending_changes

Walk each entry in the DRAFT's `_pending_changes`. For each one whose `effectiveFrom` falls inside the new bundle's window:
- Apply the change to the new bundle
- Add a `_correctionLog` entry citing the source (e.g. "Autumn Budget 2025; Finance Act 2026 s12")
- Don't delete the `_pending_changes` entry from the DRAFT — the DRAFT lives on as the perpetual "what's coming" inbox

### 4. Apply any new Budget announcements

For each rate the Budget moved, do:
1. Locate the HMRC / OBR source page
2. Cross-check against the gov.uk authoritative URL (often archived under `assets.publishing.service.gov.uk/.../<topic>.pdf`)
3. Update the JSON value
4. Add a `_correctionLog` entry with the new value + source URL

**Strongly preferred process:** spawn the `sonuswealth-tax-accountant` skill agent with the Budget statement as context. Have it walk the bundle vs the announcement and flag every field that should move. Then YOU verify each one — don't accept the agent's list blindly.

### 5. Validation pass

```bash
# Re-run the engine against all 12 dynamic personas with the new bundle
node tests/dynamic-onboarding.mjs --bundle UK-2027.1.0

# Re-run the static regression suite against the new bundle
node tests/r08-validate.js

# Sanity-check a known Bruce calculation against HMRC's free online calculator
# at https://www.gov.uk/estimate-income-tax — compare the two figures
```

If any persona fails or any sanity-check is off, the bundle is wrong. Don't ship — go back to step 4.

### 6. Re-capture the L4-4 regression baseline

```bash
# This will produce a baseline using the NEW bundle as the current state
npm run regression:capture -- --out tests/regression-baseline.json
```

Then verify the diff against the OLD baseline shows expected drift:

```bash
git diff tests/regression-baseline.json | head -40
```

If a persona's hero numbers drift in an unexpected way, the bundle change is wrong.

### 7. Verify the bundle

Edit `_meta.verifiedBy` and `_meta.verificationDate`. The verifiedBy field should say WHO did the verification + WHEN, e.g.:

```json
"verifiedBy": "founder + tax-accountant agent — coverage doc v1.4 + HMRC/DWP published rates (web-verified Nov 2026)",
"verificationDate": "November 2026"
```

### 8. Update the next-year DRAFT

In `src/rules/UK-2028.1.0-DRAFT.json` (or whatever the NEXT-next-year skeleton is), update the `_pending_changes` block with anything announced for 2028+ that we now know about.

### 9. Commit + tag

```bash
git add src/rules/UK-2027.1.0.json src/rules/UK-2027.1.0-DRAFT.json tests/regression-baseline.json
git commit -m "Rules: UK-2027.1.0 verified post-Autumn-Budget-2026

Major changes:
- Pensions enter the estate for IHT (April 2027)
- Cash-ISA cap activated for under-65s
- [whatever else]

See bundle _meta._correctionLog for full per-value sourcing."
git tag rules-uk-2027.1.0
git push origin main --tags
```

### 10. Deploy

The new bundle is now LIVE for any user whose `as-of date` falls in 2027/28. There's no separate deploy step for rules-bundle updates — they ship via the normal Vite build because they're imported JSON. CI will run the full test suite + secrets scan automatically.

If a user previously had a snapshot taken under UK-2026.1.1, the L4-7 stale-snapshot detector will surface a banner showing the bundle drift and offer "Recompute under today's rules."

---

## When to bump the version qualifier

| Change type | Version bump |
|---|---|
| New tax-year bundle (Budget Day update) | Major: `UK-2026.X` → `UK-2027.1.0` |
| Correction to a value in the current year (e.g. a typo found post-deploy) | Patch: `UK-2027.1.0` → `UK-2027.1.1` |
| New rule structure / new field added | Minor: `UK-2027.1.0` → `UK-2027.2.0` |

Patch updates are CLEANUP — they should never change a user's £ figures by more than rounding. If a patch moves a hero number by > £100 for any persona, it's not a patch, it's a correction that needs major-version honesty.

---

## When the runbook fails

If you discover after deployment that a value is wrong:

1. **Don't panic, don't backdate.** Fix the value, increment the patch version, redeploy. Snapshots taken under the wrong patch will surface as stale via L4-7.
2. **Add a `_correctionLog` entry** explaining what was wrong, when it was wrong, what got fixed.
3. **Re-capture the regression baseline.**
4. **Slack the founder** so they can decide whether to email any users whose displayed figures were materially wrong.

---

## File map

| Path | Purpose |
|---|---|
| `src/rules/UK-YYYY.X.Y.json` | A verified rules bundle (committed, immutable) |
| `src/rules/UK-YYYY.X.Y-DRAFT.json` | The next-year skeleton with `_pending_changes` inbox |
| `0-Active/BUDGET-DAY-RUNBOOK.md` | This file |
| `tests/regression-baseline.json` | The L4-4 baseline (re-captured every bundle bump) |
| `src/engine/_bundle.js` | Selects the active bundle based on `asOfDate` |
| `scripts/sync-tax-bundle.mjs` (`npm run sync:tax`) | Verify-and-patch sync: researches the ~35 headline figures vs gov.uk/HMRC and diffs/patches `src/rules/UK-2026.1.1.json` in place. Safe by default (offline check); `--live` to research, `--apply` to patch. Replaces the deleted `update-rules-uk.mjs` (which wrote the prototype-only `app-prototype/rules-uk.js`). |
