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

## Discipline change (the actual founder ask)
The tie-out gate above must run on every money screen before "done" — not "does each card render a number" but "do the numbers agree with each other and across screens". Promote it to an automated test in `src/tests/`.
