# Cashflow — Stage B Pass-2 SUMMARY
**Date:** 2026-05-18

## DB fixes verification
| # | Finding | Status | Evidence |
|---|---------|--------|----------|
| DB-1 | Silent mock fallback 4 chart components | FIXED | All 4: null default → empty-state cards |
| DB-2 | Internal spec codes visible to users | FIXED | Codes in JSX comments only; never rendered to DOM |
| DB-3 | CoI showed only estatePlanning slice | FIXED | Cashflow.jsx:2418: `coi?.total ?? coi?.byDomain?.estatePlanning ?? 0` |
| DB-4 | probability \|\| 0.94 fabricated fallback | FIXED | `pos?.probability ?? pos?.success_pct ?? null` |
| DB-5 | viewMode no downstream effect | PARTIAL | Drives ScenarioSeedBanner + re-key; actual/stress/projection modes still render identically |
| DB-6 | windowId default 'current-tax-year' | FIXED | useState('current-period') :529 |
| DB-7 | Health hero labels inconsistent | FIXED | COMPONENTS array human labels; dual-lookup :493 |
| DB-8 | cohortMedian=58 undocumented | FIXED | Line 1319 annotated with ONS source |

## Regressions found
None. Null fallback removal did not crash — PoSChart null guard fires correctly.

## New findings + fixes
- **NF-1 (FIXED in pass-2):** `distanceToFrontier={+(eff?.distance_to_frontier || 0.012)}` fabrication risk fixed → `?? null` (Cashflow.jsx:853)
- **NF-2 (LOW):** EfficientFrontier.jsx:58 hardcoded 60/40 benchmark reference — acceptable scaffolding pre-CMA bundle
- **NF-3 (INFO):** viewMode actual/stress/projection produce no UI difference — UX clarification needed on whether X28TopBar hides non-scenario tabs

## Verdict
**PASS** — All 8 DB findings resolved or acceptable. NF-1 fixed. NF-2/NF-3 in FUNCTIONAL backlog.
