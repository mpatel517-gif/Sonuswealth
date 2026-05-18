# Sonuswealth — Wave 6/7 Engine Features
**Date:** 2026-05-18 | **Build:** ✓ 138 modules, 0 errors, 319ms

---

## Features built

### IHT Year-by-Year Projections
| Part | Location | Detail |
|------|----------|--------|
| Engine | tax-estate-engine.js:1458–1525 | `ihtProjection(entity, horizonYears=10)` — yearly estate growth at 4%/expectedReturn, pension phase-in from 2027, annual gift deduction, per-year ihtDue |
| Re-export | fq-calculator.js | `ihtProjection` added to re-export block |
| UI | TaxEstate.jsx:1154 | `<IHTYearByYear>` RevealCard — 5-row table (Year / Est. estate / IHT due / vs today), 2027 row highlighted amber with "Pension enters estate", "est · not advice" chip |

### Shock Card Drawdown Survival Trajectory
| Part | Location | Detail |
|------|----------|--------|
| Engine | risk-engine.js | `shockTrajectory(entity, shockId, months=24)` — baseline + shocked month-by-month arrays, survivalMonths, recoveryMonth |
| Re-export | fq-calculator.js | `shockTrajectory` added to re-export block |
| UI | Risk.jsx | Pre-computed `traj` per shock; 120×40 SVG sparkline (grey baseline + red shocked) in expanded ShockCard panel; "Recovers ~Nmo" / "Portfolio lasts ~Nmo" label |

### EfficientFrontier CMA Reference Benchmark
| Part | Location | Detail |
|------|----------|--------|
| Engine | cashflow-engine.js:~616 | 60/40 reference computed from CMA-derived rE/rB/vE/vB/corrEB already in scope; added to `portfolioEfficiency` return object |
| UI | EfficientFrontier.jsx:~62 | Hardcoded fallback removed → `refArg ?? null`; reference dot/label guarded against null |

### PivotView X28/Scenario Wiring
| Part | Location | Detail |
|------|----------|--------|
| Component | PivotView.jsx:835 | `scenarioEntity=null` prop added; `activeEntity = scenarioEntity ?? entity`; all 4 sub-views receive `activeEntity` |
| Call site | MyMoney.jsx:2916 | `scenarioEntity={scenarioEntity || null}` passed through |
| Scaffold | MyMoney.jsx:~2477 | `const scenarioEntity = null` with TODO for X28 §4.3 wiring — no behaviour change until scenario-seed pipeline connected |

### What-If Scenario Library (Wave 7)
| Part | Location | Detail |
|------|----------|--------|
| Component | src/components/MyMoney/WhatIfLibrary.jsx | 6 scenarios: Lose job / +20% pay rise / Max pension / Rates +2% / Retire at 55 / Sell home. Each card: collapsed = label + score/surplus deltas; expanded = DeltaRow chips (Wealth Score ±pts, Surplus ±£/mo, NW ±£) + "est · not advice" tag |
| Wire | MyMoney.jsx:2662 | `viewMode === 'scenario'` renders `<WhatIfLibrary entity={entity} />` and suppresses main content |

---

## Complete audit + build history

| Wave | DB fixed | Features built | Build |
|------|---------|----------------|-------|
| Pass-1 audit | — | ~79 DB found | — |
| Wave 4 | ~74 DB | — | ✓ |
| Pass-2/3 | 9 regressions | — | ✓ |
| Wave 5 | — | 15 FUNCTIONAL fixes, 8 DN resolved | ✓ |
| Stage C | 7 cross-screen bugs | — | ✓ |
| FUNCTIONAL backlog | — | 9 further fixes | ✓ |
| Wave 6/7 | — | IHT projections, shock trajectory, EF CMA, PivotView X28, What-If library | ✓ 138 modules |

---

## Truly remaining (requires product decisions or significant new scope)

| Item | Why deferred |
|------|-------------|
| PivotView scenarioEntity pipeline | Scaffold in place; needs X28 scenario-seed to flow from MyMoney into PivotView |
| Shock trajectory: month-by-month engine accuracy | `shockTrajectory` uses simple linear burn — phase 2 accuracy needs Monte Carlo or sequence-of-returns simulation |
| ihtProjection taper/BPR/trust modelling | Current engine uses flat NRB/RNRB; taper relief, BPR caps, trust structures not yet modelled |
