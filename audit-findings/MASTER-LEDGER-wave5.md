# Sonuswealth — Wave 5 FUNCTIONAL Fix Log
**Date:** 2026-05-18
**Build:** ✓ 137 modules, 0 errors, 331ms

---

## Founder decisions resolved

| DN | Decision | Action taken |
|----|----------|-------------|
| DN-01 | Ship DER/PRC/PCC/EBR formulas as-is | No code change — formulas remain in build |
| DN-02 | Delete DrawdownMatrixPanel dead code | Deleted function (~lines 1559–1617) from MyMoney.jsx |
| DN-03 | Label sparklines 'est.' | CategoryTile.jsx: 'est.' badge added to sparkline SVG wrapper |
| DN-04 | Audit PivotView now | Pass-1b complete — 3 DB found and fixed (see below) |
| DN-05 | SippIhtCountdown — Wave 7 | No change |
| DN-06 | StateTilesCard — Wave 7 | No change |
| DN-07 | Net Worth report disclaimer | Already resolved — Reports.jsx footer BRAND.disclaimer covers all report types |
| DN-08 | lifeEventPaths stub | Already fixed in Wave 4 |

---

## All fixes applied

### FUNCTIONAL items (existing backlog)
| Fix | Screen | File |
|-----|--------|------|
| FP5_HONESTY spec code `D-DC-PROV-1` removed from user-facing string | Data Capture | DataCapture.jsx:98 |
| "Finio updates this file" → "Sonuswealth" in tax-2026.json _disclaimer | Engine | src/rules/tax-2026.json:13 |
| "Coming next" stub added for year-by-year IHT projections | Tax & Estate | TaxEstate.jsx |
| Vault promise copy removed from Reports intro | Reports | Reports.jsx:~106 |
| SHOCK_HANDOFF['illness'] label: "Review protection" → "Add protection →" | Risk | Risk.jsx:855 |
| 'custom' added to METRIC_TO_ENVELOPE (belt-and-braces) | Timeline | Timeline.jsx:1525 |
| CoI sort: regex extraction → `coi.byDomain[id]` engine numerics | MyMoney | MyMoney.jsx:2884–2896 |
| classifyIntent widened: added "take action / want to act / going to act / ready to act" | Decision Engine | Ask.jsx:123 |

### PivotView pass-1b DB + F fixes
| Fix | File:line |
|-----|-----------|
| DB-1: FCA directive copy → factual context + adviser caveat | PivotView.jsx:751 |
| DB-2: Hardcoded tax thresholds → `TAX.pa ?? 12570`, `TAX.brt ?? 50270`, `TAX.art ?? 125140` | PivotView.jsx:179–181 |
| DB-3: Allowance caps → `TAX.isaAllowance / TAX.pensionAA / TAX.cgaAllowance / TAX.dividendAllowance` + MPAA flag | PivotView.jsx:241–247 |
| F-1: CashflowView essential spending fabricated fallback → labelled `(est.)` | PivotView.jsx:654,728 |
| F-2: InsuranceView CI gap fabricated fallback → labelled `(essentials estimated)` | PivotView.jsx:314–318,342–343 |
| F-5: Dividend rate string → 2025/26 rates 8.75%/33.75%/39.35% | PivotView.jsx:115 |

---

## Remaining open items (post-Wave 5)

### PivotView FUNCTIONAL backlog
| Item | File:line |
|------|-----------|
| F-3: No X28/What-If wiring in any pivot view (Wave 2 architectural) | PivotView.jsx:804–810 |
| F-4: BondsView coupon-missing row has no add-coupon affordance | PivotView.jsx:520 |
| P-1: PivotToggle clips at 375px — no scroll affordance | PivotView.jsx:769–771 |
| P-2: BondsView "Not captured yet" renders unconditionally | PivotView.jsx:607–617 |
| P-3: InsuranceView key={i} on policy rows | PivotView.jsx:408 |

### Remaining cross-screen FUNCTIONAL items
| Item | Screen | File |
|------|--------|------|
| debt/tax priority cards missing adviser caveat | MyMoney | MyMoney.jsx:~2257,2282 |
| BRAND.rulesLabel() not used — raw fields rendered instead | Reports | Reports.jsx |
| viewMode actual/stress/projection render identically | Cashflow | Cashflow.jsx |
| 60/40 benchmark hardcoded in EfficientFrontier | Cashflow | EfficientFrontier.jsx:58 |
| SHOCK_HANDOFF['illness'] action ambiguity (label fixed, action is Add sheet) | Risk | Risk.jsx:852 |

### Still deferred (engine-layer)
| Item | Screen |
|------|--------|
| Year-by-year IHT projections (ihtProjection/ihtTimeline) | Tax & Estate |
| Shock card month-by-month drawdown survival trajectory | Risk |
| "What if" pill real scenario library | MyMoney (Wave 7) |

---

## Next recommended step

**Stage C — cross-screen reconciliation audit**
Check that shared metrics (CoI, score, NW, surplus) are consistent across all surfaces that display them.
Key surfaces to cross-check: Home ↔ MyMoney (CoI, surplus), MyMoney ↔ Cashflow (surplus/£month), Risk ↔ Home (score format), T&E ↔ Home (CoI domain split).
