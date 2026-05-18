# MyMoney PivotView — Stage B Pass-1b SUMMARY
**Date:** 2026-05-18 | **Coverage:** 30/~30 rows
**File:** `src/components/MyMoney/PivotView.jsx` (811 lines)
**Pivots audited:** Income · Cash Flow · Insurance · Bonds + PivotToggle bar

## Counts
| Severity | Count |
|----------|-------|
| DEMO-BLOCKING | 3 |
| FUNCTIONAL | 5 |
| POLISH | 3 |

## All DEMO-BLOCKING findings
| # | Element | Finding | File:line |
|---|---------|---------|-----------|
| DB-1 | CashflowView insight block | FCA directive copy: "Priority order: (1) top up your ISA — £20k/yr tax-free growth, (2) pension contributions — 40–47% tax relief at your rate, (3) overpay debt…" — prescriptive action sequence, FCA COBS 9A | PivotView.jsx:745 |
| DB-2 | IncomeView tax band breakdown | Hardcoded: pa=12570, basicTop=50270, higherTop=125140, taper=100000 as literals — SoT is TAX.* from fq-calculator.js | PivotView.jsx:177–184 |
| DB-3 | IncomeView allowance tiles | Four hardcoded cap strings: "of £20,000 cap" (ISA), "of £60,000 cap" (AA), "of £3,000 cap" (CGT), "of £500 cap" (dividend). No MPAA flag when drawdown active (£10k applies). | PivotView.jsx:239–242 |

## FUNCTIONAL findings
| # | Element | Finding | File:line |
|---|---------|---------|-----------|
| F-1 | CashflowView essential spending | Fabricated fallback: `totalMonthlyIncome × 0.55` shown as real data, no "(estimated)" qualifier | PivotView.jsx:648 |
| F-2 | InsuranceView CI gap | Same `grossIncome × 0.55` fallback — CI gap computed off fabricated number | PivotView.jsx:311–312 |
| F-3 | All pivots | Zero X28/What-If wiring — all compute from raw `entity`, not scenario entity | PivotView.jsx:804–810 |
| F-4 | BondsView coupon missing | No affordance to add coupon data from coupon-missing row | PivotView.jsx:520 |
| F-5 | IncomeView dividend rates | Stale rate string "10.75%/35.75%/41.35%" (2024/25 rates); current 2025/26 = 8.75%/33.75%/39.35% | PivotView.jsx:113 |

## POLISH findings
- P-1: PivotToggle clips "Bonds" tab at 375px — no scroll affordance (:769–771)
- P-2: BondsView "Not captured yet" group renders unconditionally (:607–617)
- P-3: InsuranceView `key={i}` on policy rows — use id/label (:408)

## Verdict
**NEEDS-WORK** — 3 DB items must fix before demo. F-1/F-2/F-5 production-blocking. F-3 is Wave 2 architectural.
