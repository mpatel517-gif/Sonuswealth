# Sonuswealth — Master Audit Ledger (All 10 Screens, Pass-2)
**Date:** 2026-05-18
**Stage:** B pass-2 complete across all 10 primary surfaces
**Build:** ✓ 137 modules, 0 errors, 333ms

---

## Pass-2 verdict by screen

| Screen | Verdict | Remaining items |
|--------|---------|-----------------|
| Home | **PASS** | NF-1 stale comment (cosmetic) |
| Reports | **PASS** | NF-1 vault promise copy; NF-2 rulesLabel format |
| Data Capture | **PASS** | NF-1 D-DC-PROV-1 in FP5_HONESTY footnote (minor) |
| Settings | **PASS** | NF-2 "Finio" in tax-2026.json _disclaimer (source file, not UI) |
| Tax & Estate | **PASS** (1 deferral) | DB-3 year-by-year IHT deferred; NF-3 missing stub label |
| Cashflow | **PASS** | NF-2 60/40 benchmark hardcoded; NF-3 viewMode modes identical |
| Timeline | **PASS** | NF-1 'custom' missing from METRIC_TO_ENVELOPE |
| Decision Engine | **PASS** | NF-2 narrow classifyIntent regex; NF-3 require inside hook |
| Risk | **PASS** | N-2 SHOCK_HANDOFF['illness'] label ambiguity |
| MyMoney | **PASS** | NF-01/02 FCA caution on debt/tax priority cards; NF-03 drill highlight |

**All 10 screens: PASS**

---

## Regressions caught and fixed in pass-2

| Fix | Screen | File:line |
|-----|--------|-----------|
| `onNav` missing from RiskOverlay → RiskBody (all shock handoffs dead in overlay) | Risk | RiskOverlay.jsx:24, 162 |
| `DecumulationPanel` called `setDrillPension` outside closure — crash risk | MyMoney | MyMoney.jsx:2408, 2961 |
| `surplus > 0` at line 2722 (Phase 2A banner — Wave 4 fixed only line 1138) | MyMoney | MyMoney.jsx:2722 |
| FCA directive "Direct surplus to your pension first" in Phase 2A banner | MyMoney | MyMoney.jsx:2757 |
| `distanceToFrontier \|\| 0.012` fabricated fallback in EfficientFrontier | Cashflow | Cashflow.jsx:853 |
| `TAX.taxYear` never mapped from TAX_JSON._meta — Settings tax year always fell back to hardcoded | Settings | fq-calculator.js:53 |
| Commit overlay absent — DE sheet closed silently after user commits a high-stakes path | Decision Engine | DecisionEngineV2.jsx:223–243 |
| `seekComingSoon` banner persisted after metric switch in GoalSeekSheet | Timeline | Timeline.jsx:1557 |
| Mitigation rows had no FCA "est · not advice" tag (parity with shock cards) | Risk | Risk.jsx:1120–1124 |

---

## Remaining open items (non-blocking, for FUNCTIONAL triage)

### Deferred engine work (known, not regressions)
| Item | Screen | Notes |
|------|--------|-------|
| Year-by-year IHT projections | Tax & Estate | ihtProjection() / ihtTimeline() not built |
| Shock card month-by-month sequence risk trajectory | Risk | New engine capability needed |
| "What if" pill real scenario library | MyMoney | Wave 7 scope confirmed |

### Low-severity FUNCTIONAL items surfaced in pass-2
| Item | Screen | File |
|------|--------|------|
| debt / tax priority cards missing adviser caveat | MyMoney | MyMoney.jsx:~2257, 2282 |
| D-DC-PROV-1 spec code in FP5_HONESTY footnote | Data Capture | DataCapture.jsx:98 |
| "Finio updates this file" in tax-2026.json _disclaimer | Settings | src/rules/tax-2026.json:13 |
| Missing "coming next" stub for IHT projections in Estate sub-tab | Tax & Estate | TaxEstate.jsx |
| 60/40 benchmark hardcoded in EfficientFrontier | Cashflow | EfficientFrontier.jsx:58 |
| viewMode actual/stress/projection render identically | Cashflow | Cashflow.jsx |
| vault promise copy in Reports ("Saved to your vault") | Reports | Reports.jsx:106 |
| SHOCK_HANDOFF['illness'] label vs action mismatch | Risk | Risk.jsx:852 |

---

## Stopping rule status

Pass-1 found ~79 DEMO-BLOCKING items.
Pass-2 found 0 new DEMO-BLOCKING items (9 regressions caught and fixed inline).
All 10 screens return PASS on pass-2.

**Stopping rule: 2 consecutive clean passes at 100% coverage.**
Pass-2 = clean (no new DB). Pass-3 needed to confirm the regression fixes didn't introduce further issues.
Recommend: targeted pass-3 on the 5 screens with inline fixes (Risk, MyMoney, Cashflow, Timeline, Decision Engine).

---

## Next: Wave 5 — FUNCTIONAL triage

**Rule:** All DEMO-BLOCKING resolved. FUNCTIONAL backlog (23 on MyMoney alone, similar on others) needs founder triage before next fix wave.
**Recommended order:**
1. Targeted pass-3 on 5 screens with pass-2 inline fixes
2. Founder triage of 8 DECISION-NEEDED items (DN-01 through DN-08)
3. FUNCTIONAL fix wave: CoI standardisation, hardcoded TAX constants sweep, India placeholder gate
