# L4-4 — Nightly persona regression: activation guide

**Created:** 2026-05-28
**Decision logic:** `tests/harness/regression-diff.mjs` (unit-tested via `npm run test:l4-4-regression-diff`)
**Capture:** `tests/harness/regression-capture.mjs` · `npm run regression:capture`
**Check:** `tests/harness/regression-check.mjs` · `npm run regression:check`
**CI workflow:** `.github/workflows/regression-nightly.yml` (currently `workflow_dispatch` only)

---

## What this catches

A rules-bundle update or persona-fixture edit that silently moves £fq / £risk / £netWorth on the canonical persona × tax-year matrix. Without this, an engine drift goes unnoticed until a user opens the app and asks "why is my net worth £40k different from last week."

The diff covers three layers:
1. **Hero numbers** — FQ, Risk, Net Worth — checked against tolerance per row
2. **Snapshot hash** — FNV-1a over the canonical-stringified full snapshot — catches sub-field drift even when hero numbers are unchanged
3. **Row presence** — a baseline row missing from the fresh run = drift; a new row in fresh = informational (logged, not alerted)

---

## Activation steps (founder)

### 1. Capture the baseline once

```bash
npm run regression:capture
```

This will run `generateSnapshot()` for ~27 personas × 1 year = ~27 snapshots. Takes 30s–2min depending on machine.

Output: `tests/regression-baseline.json`

If you want a wider grid:
```bash
npm run regression:capture -- --years 2024/25,2025/26,2026/27
```

### 2. Commit the baseline

```bash
git add tests/regression-baseline.json
git commit -m "L4-4: seed nightly regression baseline (27 cells)"
git push
```

### 3. Verify the check passes locally

```bash
npm run regression:check
```

Expected: `✓ No drift` and exit code 0. If you get drift on a freshly-captured baseline, the capture and check were not deterministic — open an issue, do not enable the cron yet.

### 4. Add the Slack secret

GitHub repo → Settings → Secrets and variables → Actions → New repository secret:
- **Name:** `CRON_SLACK_WEBHOOK`
- **Value:** Slack incoming webhook URL (same one used by `cron-health-check`; can be the same value)

### 5. Enable the schedule

Edit `.github/workflows/regression-nightly.yml`. Uncomment the `schedule` and `push` triggers. Commit + push.

```yaml
on:
  schedule:
    - cron: '17 3 * * *'
  push:
    branches: [main]
    paths:
      - 'src/engine/**'
      - 'src/rules/**'
      - 'tests/regression-baseline.json'
  workflow_dispatch:
```

### 6. Confirm the first run

GitHub repo → Actions → regression-nightly → manually trigger once via "Run workflow". The run should pass (no drift against the just-captured baseline). The Slack post step will skip (no drift = no alert).

---

## When the alert fires — what to do

1. **Read the report artifact.** Each workflow run uploads `tests/reports/regression-result-<iso>.json`. Download it, look at the `drifted` array — each row tells you which persona × year drifted and why.
2. **Was it intentional?** A rules-bundle update for the new tax year should drift numbers — that's working as designed. If yes, re-capture and commit a new baseline:
   ```bash
   npm run regression:capture
   git add tests/regression-baseline.json
   git commit -m "Update regression baseline after rules update for <reason>"
   git push
   ```
3. **Was it accidental?** A code change moved numbers without you meaning to. Revert the change or fix the engine bug. Don't update the baseline — that's how the 200-ticket "complete but broken" pile started.
4. **Tolerance feels too tight?** Override per-run via env:
   ```yaml
   - name: Run regression diff
     run: REGRESSION_NW_REL=0.01 npm run regression:check
   ```
   Don't loosen tolerances in the default unless you have a written reason in the commit message. Loose tolerances kill the alert.

---

## Why this is GH Actions, not a Supabase Edge Function

Edge Functions run Deno without filesystem access to the repo source. The regression harness imports `src/engine/*`, `src/lib/data-source.js`, and `src/rules/personas/*.json` — none of those are reachable from a deployed Edge Function. GH Actions has the whole repo + node, so the harness runs as-is.

Trade-off: GH Actions cron is "best effort" (sometimes drifts by 5–15 min on the schedule). For regression detection that's fine — the diff is what matters, not the exact minute.

## File map

| Path | Purpose |
|---|---|
| `tests/harness/regression-diff.mjs` | Pure decision module — `diffCells`, `hashSnapshot`, `formatAlert`, `DEFAULT_TOLERANCE` |
| `tests/harness/regression-capture.mjs` | CLI — re-seeds baseline |
| `tests/harness/regression-check.mjs` | CLI — runs fresh capture + diffs vs baseline, non-zero exit on drift |
| `tests/l4-4-regression-diff.mjs` | Unit test for the decision module (CI-gated) |
| `tests/regression-baseline.json` | Baseline state — committed to repo, updated only when rules change deliberately |
| `tests/reports/regression-result-*.json` | Per-run output, GH Actions artifact |
| `.github/workflows/regression-nightly.yml` | Nightly schedule |
