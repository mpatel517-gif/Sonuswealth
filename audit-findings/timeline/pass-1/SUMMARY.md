# Timeline Screen — Stage B Pass-1 SUMMARY
**Date:** 2026-05-18 | **Coverage:** 130/130 rows, 100%

## Counts

| Severity | Count |
|----------|-------|
| DEMO-BLOCKING | 8 |
| FUNCTIONAL | ~26 |
| POLISH | ~12 |

## All DEMO-BLOCKING findings

| # | Element ID | Finding | File:line |
|---|-----------|---------|-----------|
| DB-1 | TL-CAL-04..11 | All 8 calendar rows are static `<div>` — no `onClick`. Every tap is dead. FD-CROSS-1 completely violated for §C. | Timeline.jsx CalendarEntryRow |
| DB-2 | TL-GM-04a-h | All 8 goal templates route to `'goal-create'` which has no branch in Dashboard.jsx:471–505 — silent blank screen. | Dashboard.jsx:471–505 |
| DB-3 | TL-OVL-03 / TL-GM-02a/02b | MilestoneDrillPanel is describe-only — zero ACTION CTAs. "Use Goal Seek" is copy without a button. | interaction.md |
| DB-4 | TL-CAL-04c vs H-ANCH-04 | CoI mismatch: Timeline uses `costOfInaction(entity)` (12-domain aggregate); Home uses `costOfInaction(entity, 'sipp_iht')` (domain-specific). Same row, different £ values. | reconciliation.md |
| DB-5 | TL-CAL-04a vs H-ANCH-04a | daysLeft drift: Timeline uses `Math.round`, Home uses inline `Math.ceil` — differ ±1 day on same deadline. | reconciliation.md |
| DB-6 | TL-CAL-04 / TL-X28-04 | `'6 Apr 2027'` hardcoded literal — stale post-deadline; format drifts vs Home `'6 April 2027'`. `dataDate` fallback is `'UK-2026.1'` (rules version, not a date). | Timeline.jsx:684 |
| DB-7 | TL-OVL-01a | GoalSeekSheet: only 4 of 12 metrics handled; 8 options fall to `default: achieves = sim.scoreDelta` — returns score delta unrelated to user's target. | scenario.md |
| DB-8 | TL-OVL-01e | `commitGoalSeekPath` wrong envelope type — "Estate plan" goal creates `custom` type; Estate PlanRow stays "Not set". | scenario.md |

## Top 3 fix priorities

**P1 — Wire all calendar rows (fixes DB-1)**
`CalendarEntryRow` needs `onClick` + per-entry `onNav`. Routing: `sipp-iht`→T&E, `isa-reset`→MyMoney, `sa-deadline`→T&E, `state-pension`→Cashflow, `nominations`→MyMoney, `trust-gift`→T&E, `mortgage-fix`→MyMoney, `apq-*`→`safeRoute(action)`.

**P2 — Fix goal-create route + MilestoneDrillPanel CTA (fixes DB-2, DB-3)**
Change goal-template handler to `openGoalSeek(t.plan_type)` (reuses existing infra). Add one "Set a target" CTA to MilestoneDrillPanel → `onOpenGoalSeek(milestone.metric)`.

**P3 — Align CoI + daysLeft + date label (fixes DB-4, DB-5, DB-6)**
(a) Timeline L668: `costOfInaction(entity)` → `costOfInaction(entity, 'sipp_iht')`.
(b) HomeScreen.jsx:421: replace `Math.ceil` with imported `daysLeft()`.
(c) Timeline L684: replace `'6 Apr 2027'` literal with `new Date(TAX.deadline).toLocaleDateString('en-GB', ...)`. Fix `dataDate` fallback to `BRAND.dataDate`.
