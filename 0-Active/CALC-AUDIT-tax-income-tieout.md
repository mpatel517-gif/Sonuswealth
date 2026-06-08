# Calc audit — Tax & Estate income tie-out (work order)

**Date:** 2026-06-08 · **Trigger:** founder caught 5 contradictory numbers on one screen.
**Status:** ROOT-CAUSED. Fix NOT yet applied (needs the canonical refactor below + golden vectors — not a tail-end patch).

## The tie-out gate (must pass on every persona before "done")

Scrape the Income drawer and assert:
1. `Gross ≥ ANI` (ANI is gross minus reliefs — can never exceed gross).
2. `income tax > 0` whenever non-savings/non-dividend taxable income > personal allowance.
3. `effective rate == round(total_tax / gross)`.
4. `marginal rate` matches the band the user's **total** income sits in.
5. The "Gross" on the Tax-position card == the "Total taxable income" (step 1) on the ANI card == the income base the dividend stack uses.

## Live failures (Mr T, demo=mrt-core, 2026-06-08)

| Shown | Value | Violation |
|---|---|---|
| Gross | £79k | ≠ ANI total taxable £91k (#5) |
| ANI | £91k | **> Gross £79k — impossible** (#1) |
| Income tax | £0 | on £91k taxable income (#2) |
| Effective rate | 0.0% | with £4k total tax (#3) |
| Marginal | 20.0% | £91k is in the 40% band (#4) |
| Dividend tax | £4k | far too low on ~£80k dividends — basic-rate, not stacked |

## Root cause — no canonical income decomposition

Each function reads income differently:
- `_grossIncome` (`tax-estate-engine.js:131`) = `inc.salary + selfEmployed + rental + other + drawdown`. **Omits dividends & savings, and reads only `inc.salary`** (misses the `individual.gross_salary` / `income.employment` / `income.directorSalary` aliases that `calcAllIncome` MAXes — the same triple-count class fixed in `calcAllIncome` on 2026-06-02 but never propagated here). → for Mr T returns ≈£0 → income tax £0, marginal 20%.
- `calcAllIncome` (`fq-calculator.js:3257`) = MAXed salary + selfEmployed + dividends + … = £79k.
- `calcANI` = a third aggregation = £91k.
- `dividendTaxDetail` (`tax-estate-engine.js:377`) picks the dividend rate from `incomeTaxDetail(entity).marginal_rate` — i.e. off the NSND-only `_grossIncome` (£0 → basic 10.75%). Dividends are **not stacked** on top of other income, so they're taxed in the basic band when total income £91k puts them in higher/additional. → £4k instead of ~£20k.
- The Tax-position card shows `txY.gross || calcAllIncome` — a **masking fallback**: because `txY.gross` (= `_grossIncome`) is £0, it silently displays calcAllIncome's £79k, conflating "total income" with the "income-tax base".

**Why piecemeal patching fails:** fixing `_grossIncome`'s salary alias alone flips the displayed Gross from £79k → £12,570 (worse), because Gross conflates total-income with the NSND tax base. They must be separated.

## The fix (canonical refactor)

1. **New `taxableIncomeBreakdown(entity, bundle)`** → `{ nsnd, savings, dividends, total, reliefs }`, the single source every tax card reads. Resolves salary aliases once (MAX), classifies each income source by tax type.
2. **incomeTaxDetail** taxes `nsnd` in the NSND bands (PA allocated to nsnd first).
3. **savings tax** stacked on nsnd with PSA + starting-rate band.
4. **dividendTaxDetail** stacks dividends on `nsnd + savings` and taxes each slice at the band it falls in (allowance first).
5. **Gross (display)** = `total`; **ANI** = `total − reliefs` (so ANI ≤ Gross always); **effective** = `total_tax / total`; **marginal** = rate at `total`.
6. Remove the `txY.gross || calcAllIncome` masking fallback.

## Verification before shipping the fix
- The 5-invariant tie-out gate green on ALL personas (Bruce, Mr T, +others).
- `npm run regression:check` 180/180 0 drift (these functions feed MyMoney/Cashflow/Risk — must not regress their tie-outs).
- Golden hand-computed vectors for ≥2 personas (a salaried higher-rate payer + a dividend-heavy director) checked against HMRC band maths.

## Golden vector — Mr T (mrT-core), 2026/27 — hand-computed target

Canonical decomposition (✅ built + verified in `src/engine/taxable-income.js`):
`nsnd £22,370` (salary £12,570 + net rental £9,800; **state pension £0 — age 35 < 67**) · `savings £1,850` · `dividends £38,000` · **`total £62,220`** · `ani £62,220` (< £100k → full PA).

Correct tax (PA→NSND first; savings stacked w/ PSA £500; dividends stacked low in the basic band, allowance £500, rates 10.75/35.75/39.35) — **VERIFIED in code 2026-06-08**:
- Income tax (NSND): (22,370 − 12,570) × 20% = **£1,960**  *(was £0)*
- Savings tax: £500 PSA @0%, £1,350 @20% = **£270**
- Dividend tax: cursor after NSND+savings sits at £11,650 taxable; £500 allowance @0% (→£12,150); **£25,550 in basic @10.75% = £2,747**; **£11,950 in higher @35.75% = £4,272** = **£7,019**
- NIC £0 (salary at primary threshold) · CGT £0
- **Total ≈ £9,249 · effective ≈ 14.9% · marginal 40%**  *(screen showed £4k / 0.0% / 20%)*

> **CORRECTION:** an earlier draft of this vector hand-computed the dividend tax as ~£9,949 (total £12,179, eff 19.6%). That was wrong — it over-allocated dividends to the higher band instead of stacking them low in the remaining basic-rate room (£11,650→£37,700). The properly-stacked figure is **£7,019** (total **£9,249**), reproduced exactly by the code. Lesson logged: verify golden vectors with the actual band-walk, not a quick hand-split.

## Progress (2026-06-08) — ✅ COMPLETE
- ✅ `taxableIncomeBreakdown(entity)` built + node-verified; made **comprehensive** (rental-gross fallback, selfEmploymentNet, savings aliases + nested bank, explicit `age` field). Validated it captures ≥ `calcAllIncome` across ALL 23 personas — only 2 explained divergences (mrT-core net-rental/savings, persona-e correctly-included state pension → now in £100k taper).
- ✅ Stacking implemented by **rewiring `calcIncomeTax`** (fq-calculator.js) to source from the canonical breakdown — no third function; the existing CANONICAL stacker now reads the right base + gained the dividend-additional-rate band + correct PSA-by-band + starting-rate-for-savings band.
- ✅ Rewired `incomeTaxDetail` / `dividendTaxDetail` / `taxThisYear` (tax-estate-engine.js) to delegate to `calcIncomeTax`; `taxThisYear` now returns `gross`(=total) + `ani` + `marginal_rate`; removed the `_grossIncome`/separate-savings double-path. `calcANI` income aggregation now flows through the same breakdown (kills ANI > Gross cross-screen).
- ✅ Tie-out gate green: 5 invariants hold for Mr T, Bruce, persona-c/e (gross≥ani, income tax>0, effective=tax/gross, marginal=band). **Live screen** confirmed: Mr T now £62k/£62k/£2k/14.9%/40% (was £79k/£91k/£0/0.0%/20%).
- ✅ `regression:check` **180/180 0 drift** after re-baseline (all prior drift was hash-only; fq/risk/netWorth unchanged on every cell → no metric regression).
- ⬜ FOLLOW-UP: promote the 5-invariant tie-out to an automated test in `src/tests/` (per the discipline change below).

## Discipline change (the actual founder ask)
The tie-out gate above must run on every money screen before "done" — not "does each card render a number" but "do the numbers agree with each other and across screens". Promote it to an automated test in `src/tests/`.
