# Stage C — CoI Reconciliation
**Date:** 2026-05-18

## Per-surface audit

| Surface | Function called | Bundle arg | Value displayed | Is canonical total? |
|---------|----------------|------------|-----------------|---------------------|
| Home (anchor strip) | `costOfInaction(entity)` — no domain arg | none | treats return as number OR `c?.total` | PARTIAL — `costOfInaction` from `fq-calculator.js` takes `actionDomain`, not a bundle; called without domain arg means it returns a per-domain value or number, not the same object as `totalCoI()` |
| Home (SIPP-IHT row) | `costOfInaction(entity, 'sipp_iht')` | `'sipp_iht'` domain | `sippCoi` scalar | PARTIAL — intentional single-domain slice; labelled correctly as exposure |
| Home (CoI Drill Panel L3) | `totalCoI(entity)` | none | `coiObj.total` + `byDomain` breakdown | YES — canonical aggregate |
| MyMoney (hero card "Cost of waiting") | `coiCashflowVariants(entity)` | none | sum of `Object.values(coiV)` | PARTIAL — cashflow-specific variants only (drawdown + wrapper); not the same as `totalCoI().total` |
| MyMoney (Phase 1F ranking section) | `totalCoI(entity)` | none | `coi.total` as `totalCoIEst` + `coi.byDomain[id]` for rows | YES — canonical aggregate |
| TaxEstate (CoI odometer) | `totalCoI(entity)` | none | `coi.total` | YES — canonical aggregate (comment confirms: "Fix 4: show total CoI, not just the estatePlanning domain slice") |
| Cashflow (CoI odometer) | `totalCoI(entity, CMA_BUNDLE)` | `CMA_BUNDLE` (`cma-2026.json`) | `coi.total` | PARTIAL — bundle arg differs from all other surfaces (none pass a bundle); `CMA_BUNDLE` may filter or scope the engine differently |
| Cashflow (`CoIOdometerWithHalo` component) | reads from `coi` object | inherits Cashflow's `CMA_BUNDLE` | `coi?.total ?? coi?.byDomain?.estatePlanning ?? 0` | PARTIAL — fallback path exposes `byDomain.estatePlanning` slice if `total` is falsy; a £0 total would silently render a domain slice |
| Timeline (gift clock / calendar rows) | `costOfInaction(entity, 'sipp_iht')` | `'sipp_iht'` domain | `coi` scalar + per-day rate | PARTIAL — intentional single-domain slice; spec §19.1 says T&E is canonical, Timeline is read-only consumer |

---

## Inconsistencies found

### IC-1 — Home anchor uses `costOfInaction()` not `totalCoI()` for the headline figure
**File:** `src/screens/HomeScreen.jsx` line 293  
**Code:** `const coiTotal = safe(() => { const c = costOfInaction(entity); return typeof c === 'number' ? c : (c?.total || 0) }, 0)`  
**Problem:** `costOfInaction` from `fq-calculator.js` signature is `costOfInaction(e, actionDomain)` — called without a domain arg it returns a per-domain default, not the aggregate total. The guard `c?.total` only fires if the function happens to return an object; if it returns a number, the anchor strip shows that number, which is not the same value as `totalCoI(entity).total`. All other "total" displays call `totalCoI()` directly. The anchor strip should call `totalCoI(entity).total` for consistency.

### IC-2 — Cashflow passes `CMA_BUNDLE` to `totalCoI`; all other surfaces pass nothing
**File:** `src/screens/Cashflow.jsx` line 602  
**Code:** `const coi = useMemo(() => totalCoI(entity, CMA_BUNDLE), [entity])`  
**Problem:** The `totalCoI` engine function signature is `totalCoI(entity, bundle)`. Home, MyMoney, and TaxEstate all call `totalCoI(entity)` (no bundle). Cashflow passes `CMA_BUNDLE` (`cma-2026.json`). If `bundle` affects thresholds or tax-year assumptions, Cashflow's `coi.total` will differ from the figure on Home/MyMoney/TaxEstate for the same entity. This is a cross-screen discrepancy in the "total" number.

### IC-3 — `CoIOdometerWithHalo` fallback silently shows `byDomain.estatePlanning` if total is falsy
**File:** `src/screens/Cashflow.jsx` line 2418  
**Code:** `const total = coi?.total ?? coi?.byDomain?.estatePlanning ?? 0`  
**Problem:** If `totalCoI()` returns `{ total: 0, byDomain: { estatePlanning: 45000 } }` (a valid state where all domains except estatePlanning net to zero), the odometer will display `£45,000` — the estate-planning slice — not the aggregate total. This is a latent partial-slice display bug in a component that labels itself as showing "Total CoI."

### IC-4 — MyMoney "Cost of waiting" hero uses `coiCashflowVariants`, not `totalCoI`
**File:** `src/screens/MyMoney.jsx` lines 1469–1471  
**Code:** `hero: fmt(Object.values(coiV).reduce((s, v) => s + v, 0))`  
**Problem:** The hero figure summing `coiCashflowVariants()` (drawdown + wrapper + contribution + allowance) is a different calculation path from `totalCoI().total`. The Phase 1F ranking section on the same screen correctly uses `totalCoI(entity).total`. A user comparing the hero card to the ranking aggregate will see two different "total" CoI numbers on the same screen. The labelling says "Cost of waiting" vs "Cost of inaction" which partially mitigates confusion, but the numbers won't reconcile.

---

## Verdict

**NEEDS-WORK**

Four inconsistencies, two of which (IC-1, IC-2) will produce different £ totals across screens for the same entity. Priority order for fixes:

1. **IC-2** (Cashflow bundle) — highest risk; a systematic offset across all Cashflow CoI figures vs Home/MyMoney/T&E
2. **IC-1** (Home anchor calls wrong function) — headline number on most-visited screen is from wrong call path
3. **IC-3** (CoIOdometerWithHalo fallback) — silent partial-slice; fix fallback to `0` not `byDomain.estatePlanning`
4. **IC-4** (MyMoney dual-path) — labelling distinguishes them but the numbers won't reconcile; decide whether hero card should match `totalCoI` or stay as cashflow-specific variants with explicit disclosure
