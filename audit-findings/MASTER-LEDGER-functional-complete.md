# Sonuswealth — FUNCTIONAL Backlog Complete
**Date:** 2026-05-18 | **Build:** ✓ 137 modules, 0 errors, 321ms

---

## All FUNCTIONAL fixes applied

### MyMoney + Reports + Stage C noted items
| Fix | File |
|-----|------|
| debt/tax priority cards: adviser caveat added to all branches | MyMoney.jsx:2193–2197, 2222–2224 |
| Reports footer: `BRAND.rulesLabel()` replaces raw `rulesVersion · dataDate` | Reports.jsx:204 |
| CoI hero sub-label: "(pension & ISA optimisation)" disambiguates from totalCoI ranking | MyMoney.jsx:1471 |
| RiskOverlay Wealth sub-anchor: "· Wealth" → "· Wealth Score" | RiskOverlay.jsx:92 |
| Dashboard legacy comment: "FQ score" → "Wealth Score" | Dashboard.jsx:404 |

### PivotView polish
| Fix | File:line |
|-----|-----------|
| P-3: InsuranceView policy rows `key={i}` → `key={it.id \|\| it.label \|\| i}` | PivotView.jsx:414 |
| P-2: BondsView "Not captured yet" group: conditional on `missingTypes.length > 0` | PivotView.jsx:625–641 |
| P-1: PivotToggle right-fade mask on scroll container | PivotView.jsx:788–791 |
| F-4: BondsView coupon-missing row: "Add coupon →" affordance added | PivotView.jsx:602–614 |

### Cashflow + EfficientFrontier
| Fix | File |
|-----|------|
| viewMode: mode-context chip added for forecast/plan modes; Phase 2 note on state | Cashflow.jsx:530, ~722 |
| EfficientFrontier: TODO comment — `cf_portfolioEfficiency` needs reference field from cma-2026.json | EfficientFrontier.jsx:58 |

---

## Investigation findings (no code fix needed)

**Cashflow viewMode stale names:** Audit report referenced 'stress'/'projection' but actual values are 'actual'/'forecast'/'plan'/'scenario' (aligned to X28TopBar). All 4 modes ARE user-selectable. Content branching deferred to Phase 2 — now labelled honestly with mode-context chips.

**EfficientFrontier benchmark:** `cma-2026.json` exists at `src/rules/cma-2026.json` with full asset class data. However `cf_portfolioEfficiency()` doesn't return a `reference` field — hardcoded 60/40 fallback always fires. Fix requires engine change: add reference benchmark derivation from CMA asset weights. TODO comment added.

---

## What remains (engine-layer deferrals only)

| Item | Notes |
|------|-------|
| Year-by-year IHT projections | `ihtProjection()` / `ihtTimeline()` not built |
| Shock card month-by-month drawdown survival trajectory | New engine capability needed |
| "What if" pill real scenario library | Wave 7 scope |
| EfficientFrontier reference from CMA bundle | `cf_portfolioEfficiency()` needs reference field |
| PivotView X28/What-If wiring | Wave 2 architectural (all 4 pivots compute from raw entity) |

---

## Audit completion status

| Stage | Status |
|-------|--------|
| Stage A — inventory (10 screens) | ✅ Complete |
| Stage B pass-1 — full iceberg | ✅ Complete (~79 DB found) |
| Wave 4 — DB fixes | ✅ Complete (~74 DB fixed) |
| Stage B pass-2 — regression check | ✅ Complete (0 new DB, 9 regressions fixed) |
| Stage B pass-3 — fix verification | ✅ Complete (stopping rule satisfied) |
| Wave 5 — FUNCTIONAL triage | ✅ Complete |
| Stage B pass-1b — PivotView | ✅ Complete (3 DB + 3 F fixed) |
| Stage C — cross-screen reconciliation | ✅ Complete (7 bugs fixed) |
| FUNCTIONAL backlog | ✅ Complete |
| Engine-layer deferrals | ⏳ Wave 6/7 scope |
