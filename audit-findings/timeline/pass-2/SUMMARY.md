# Timeline — Stage B Pass-2 SUMMARY
**Date:** 2026-05-18

## DB fixes verification
| # | Finding | Status | Evidence |
|---|---------|--------|---------|
| DB-1 | Calendar rows onClick | FIXED | CalendarEntryRow:833 `onClick={() => calendarEntryNav(e, onNav)}` + cursor pointer |
| DB-2 | 8 goal templates routed to 'goal-create' | FIXED | handleCreateGoal:2389–2391 calls `openGoalSeek(template?.template_id)` |
| DB-3 | MilestoneDrillPanel zero ACTION CTAs | FIXED | :2281–2295 "Set a target →" button → onOpenGoalSeek |
| DB-4 | CoI mismatch | FIXED | Timeline.jsx:668 `costOfInaction(entity, 'sipp_iht')` — aligned with Home |
| DB-5 | daysLeft drift Math.round vs Math.ceil | PARTIAL/ACCEPTABLE | 1-day cosmetic residual. Both paths use engine daysLeft(). No fix needed. |
| DB-6 | '6 Apr 2027' hardcoded; bad dataDate fallback | FIXED | TAX.deadline instanceof Date guard + toLocaleDateString; dataDate fallback = new Date() |
| DB-7 | GoalSeekSheet 8/12 metrics returned score delta | FIXED | SUPPORTED_METRICS set; unsupported → seekComingSoon=true → "coming soon" UI |
| DB-8 | commitGoalSeekPath wrong envelope type | FIXED | METRIC_TO_ENVELOPE lookup table :1513–1527 |

## Regressions found
None.

## New findings + fixes
- **NF-2 (FIXED in pass-2):** `seekComingSoon` stale on metric change — persisted "coming soon" banner after switching to a supported metric. Fixed: `setSeekComingSoon(false)` added to select onChange (Timeline.jsx:1557)
- **NF-1 (LOW):** 'custom' missing from METRIC_TO_ENVELOPE — falls to `?? 'custom'` default. Functionally correct, fragile.
- **NF-3 (INFO):** daysLeft() uses Math.round (engine-level, pre-existing).

## Verdict
**PASS** — All 8 DB findings resolved or confirmed acceptable. NF-2 fixed inline. NF-1 in FUNCTIONAL backlog.
