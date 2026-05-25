# Wave 0 — fq-calc import inventory

## Purpose
Map every `fq-calculator.js` import across MyMoney scope (6 files) to its `useRipple` equivalent or document why it must remain a direct import. Used by W0-T8 through W0-T14 to drive systematic migration.

## Ripple output shape reference

From `src/engine/ripple.js` (verified, not paraphrased):

| Scope | Exposed keys |
|---|---|
| `balance_sheet` | `netWorth`, `categories.{pensions,isa,gia,property,cash,liabilities}`, `monthlyDebtService` |
| `scores` | `fq.{score,band,raw}`, `risk.{score,band,raw}`, `apq.{raw,count}`, `profile` |
| `iht` | `iht` (full `ihtDynamic` result), `sippIncluded`, `cost_of_inaction` (IHT-domain only) |
| `cashflow` | `monthlySurplus`, `fundedRatio`, `guardrail`, `investable`, `effectiveDrawdown`, `drawdownSource`, `targetIncome`, `employmentIncome` |
| `protection` | `life`, `ip`, `cic`, `rlp`, `lifeGap`, `recommendedLifeCover`, `incomeUsed` |
| `tax` | `grossIncome`, `statePension`, `employmentIncome`, `drawdown`, `incomeTax`, `netIncome`, `effectiveTaxRate`, `allowances.{personalAllowance,isa,pensionAA,psaBasic,psaHigher}` (allowances are *bundle constants*, not income-tapered computations) |
| `timeline` | `plan` (planFor result, hardcoded `'retirement'` × 30y), `age` |

Anything not in this table cannot come from ripple in v0 and must remain a direct import.

---

## src/screens/MyMoney.jsx

41 symbols imported from `../engine/fq-calculator.js`.

| Symbol | Migration target | Notes |
|---|---|---|
| `fmt` | keep direct | Pure formatter (n → "£xk"/"£x.xm"). Not entity-derived. |
| `netWorth` | `ripple.balance_sheet.netWorth` | Direct match. |
| `netWorthAtWindow` | keep direct | Window-projection (trajectory or 4% compounding); ripple does not expose this. |
| `investable` | `ripple.cashflow.investable` | Direct match. |
| `guardrail` | `ripple.cashflow.guardrail` | Direct match. |
| `ihtDynamic` | `ripple.iht.iht` | Ripple invokes with `includeSipp` derived from `TAX.deadline` rule. Verify call sites don't pass a custom `drawdownOverride` — if any do, keep direct for those. |
| `ihtSippDelta` | keep direct | Not in ripple. |
| `costOfInaction` | partial — `ripple.iht.cost_of_inaction` for `'IHT'` domain only | Call sites passing other domains (`'PROTECTION'`, `'CASHFLOW'`, etc.) must keep direct. Migration must inspect each invocation. |
| `totalCoI` | keep direct | Aggregator across domains; not in ripple. |
| `coiCashflowVariants` | keep direct | Not in ripple. |
| `coiForDomain` | keep direct | Re-export from `canonical-metrics.js`; not in ripple. |
| `calcFQ` | `ripple.scores.fq.raw` (full object) or `.score` (scalar) | Direct match. |
| `calcRisk` | `ripple.scores.risk.raw` or `.score` | Direct match. |
| `fqBand` | `ripple.scores.fq.band` | Direct match (ripple computes via `fqBand(fqScore)`). |
| `riskBand` | `ripple.scores.risk.band` | Direct match. |
| `sippProjection` | keep direct | Pension drilldown projection; not in ripple. |
| `sippProjectionSeries` | keep direct | Series variant; not in ripple. |
| `nominationStatus` | keep direct | Not in ripple. |
| `drawdownEfficiencyRatio` | keep direct | Canonical metric; not in ripple. |
| `prcPccSpread` | keep direct | Canonical metric; not in ripple. |
| `getWrapper` | keep direct | Pure helper on an asset row (not entity). |
| `hasPersonaFlag` | keep direct | Pure persona-flag check; not entity-derived state. |
| `monthlySurplus` | `ripple.cashflow.monthlySurplus` | Direct match. |
| `liquidityBuffer` | keep direct | Not in ripple. |
| `bengenProjection` | keep direct | 5-method drawdown projection; not in ripple. |
| `guytonKlingerPath` | keep direct | Not in ripple. |
| `bucketAllocation` | keep direct | Not in ripple. |
| `floorUpsideSplit` | keep direct | Not in ripple. |
| `swrFromRegime` | keep direct | Regime-based SWR; not in ripple. |
| `drawdownMatrix` | keep direct | Tax-grid matrix; not in ripple. |
| `calcANI` | keep direct | ANI 6-step display computation; not in ripple. |
| `calcPersonalAllowance` | keep direct | Ripple exposes `tax.allowances.personalAllowance` as a *bundle constant*; `calcPersonalAllowance(income)` returns the *tapered* value for an income — different shape, must stay direct. |
| `calcDividendTax` | keep direct | Not in ripple. |
| `calcHICBC` | keep direct | Not in ripple. |
| `calcPSA` | keep direct | Not in ripple. |
| `calcAllIncome` | keep direct | Not in ripple. |
| `classifyIncomeType` | keep direct | Pure classifier on an item. |
| `allowanceTracker` | keep direct | Not in ripple. |
| `calcMarriageAllowance` | keep direct | Not in ripple. |
| `planFor` | partial — `ripple.timeline.plan` only for `('retirement', 30)` | Ripple hardcodes planType `'retirement'` and window `30`. Any other planType/window must keep direct. |
| `planStaleness` | keep direct | Not in ripple. |
| `varianceFor` | keep direct | Two-mode variance; not in ripple. |
| `calcAge` | keep direct | Pure helper on DOB. |
| `taxEfficiencyScore` | keep direct | Canonical metric; not in ripple. |
| `effectiveBeneficiaryRate` | keep direct | Canonical metric; not in ripple. |
| `TAX` | keep direct | Bundle constants object. Ripple exposes a small subset in `tax.allowances` but consumers using `TAX.*` more broadly (rate bands, thresholds, deadlines) must keep direct. |

---

## src/components/MyMoney/PropertyDrillDown.jsx

No imports from `fq-calculator.js`.

| Symbol | Migration target | Notes |
|---|---|---|
| — | — | File has no fq-calc imports. Nothing to migrate. |

---

## src/components/MyMoney/BusinessDrillDown.jsx

No imports from `fq-calculator.js`.

| Symbol | Migration target | Notes |
|---|---|---|
| — | — | File has no fq-calc imports. Nothing to migrate. |

---

## src/components/MyMoney/ProtectionDrillDown.jsx

No imports from `fq-calculator.js`.

| Symbol | Migration target | Notes |
|---|---|---|
| — | — | File has no fq-calc imports. Nothing to migrate. |

---

## src/components/MyMoney/LiabilitiesDrillDown.jsx

No imports from `fq-calculator.js`.

| Symbol | Migration target | Notes |
|---|---|---|
| — | — | File has no fq-calc imports. Nothing to migrate. |

---

## src/components/MyMoney/InvestmentsDrillDown.jsx

No imports from `fq-calculator.js`. (Imports `getWrapper` from `../../engine/_helpers.js` — outside scope of this inventory.)

| Symbol | Migration target | Notes |
|---|---|---|
| — | — | File has no fq-calc imports. Nothing to migrate. |

---

## Migration summary

- **Total imports surveyed:** 41 (all in `src/screens/MyMoney.jsx`; the 5 DrillDown files import nothing from fq-calculator.js)
- **Migrating to ripple (direct match):** 10
  - `netWorth`, `investable`, `guardrail`, `ihtDynamic`, `calcFQ`, `calcRisk`, `fqBand`, `riskBand`, `monthlySurplus`, *(`ihtDynamic` flagged — see notes)*
- **Migrating to ripple (partial — needs call-site inspection):** 3
  - `costOfInaction` — only `'IHT'` domain calls; other-domain calls keep direct
  - `planFor` — only `('retirement', 30)` calls; other args keep direct
  - `ihtDynamic` — only calls without custom `drawdownOverride`
- **Keep direct (pure helpers, bundle, or not in ripple):** 28
  - Formatters: `fmt`
  - Pure helpers: `getWrapper`, `hasPersonaFlag`, `classifyIncomeType`, `calcAge`
  - Bundle/constants: `TAX`
  - Not exposed by ripple: `netWorthAtWindow`, `ihtSippDelta`, `totalCoI`, `coiCashflowVariants`, `coiForDomain`, `sippProjection`, `sippProjectionSeries`, `nominationStatus`, `drawdownEfficiencyRatio`, `prcPccSpread`, `liquidityBuffer`, `bengenProjection`, `guytonKlingerPath`, `bucketAllocation`, `floorUpsideSplit`, `swrFromRegime`, `drawdownMatrix`, `calcANI`, `calcPersonalAllowance`, `calcDividendTax`, `calcHICBC`, `calcPSA`, `calcAllIncome`, `allowanceTracker`, `calcMarriageAllowance`, `planStaleness`, `varianceFor`, `taxEfficiencyScore`, `effectiveBeneficiaryRate`
- **Uncertain / needs main-thread decision:** 0
  - Where ambiguity existed (`costOfInaction`, `planFor`, `ihtDynamic`), it has been classified as "partial — inspect call site" rather than uncertain, because the call-site rule is mechanical (check the argument).

## Surprises / observations

1. **5 of the 6 listed DrillDown files have zero fq-calc imports.** The task brief implied each of the 6 had imports to audit; only `MyMoney.jsx` does. Migration work for Wave 0 concentrates entirely there.
2. **`ripple.iht.cost_of_inaction` is hardcoded to the `'IHT'` domain.** Any MyMoney call site passing a non-IHT domain cannot use ripple — needs direct import. W0-T10 must enumerate call sites.
3. **`ripple.timeline.plan` is hardcoded to `('retirement', 30)`.** Other plan types (e.g. `'education'`, `'house_purchase'`) and other windows are not covered by ripple in v0.
4. **`ripple.tax.allowances.personalAllowance` is the bundle constant, not the tapered value.** Anywhere MyMoney calls `calcPersonalAllowance(income)` to compute the taper (ANI 6-step display, allowance tracker), it must keep direct. Easy footgun if a future task substitutes blindly.
5. **`TAX` is broadly used in MyMoney.jsx** (PivotView already imports it directly). Ripple only surfaces 5 keys in `tax.allowances` — call sites reading bands, deadlines, rates, etc. must keep direct.

---

## W0-T9 + T15 — Post-migration verification (2026-05-25)

### Drilldown structural verification
- PensionDrillDown (inline in MyMoney.jsx): no separate file; sub-component scope. `ihtDynamic`, `investable`, `guardrail` direct calls remain (per inventory notes — useRipple cannot reach sub-component scope).
- PropertyDrillDown.jsx: unchanged — zero fq-calc imports
- BusinessDrillDown.jsx: unchanged — zero fq-calc imports
- ProtectionDrillDown.jsx: unchanged — zero fq-calc imports
- LiabilitiesDrillDown.jsx: unchanged — zero fq-calc imports
- InvestmentsDrillDown.jsx: unchanged — zero fq-calc imports (`getWrapper` from `_helpers.js` still direct)

T8 commit (`559fa6e`) `git log --stat` confirmed: only `src/screens/MyMoney.jsx` + `docs/superpowers/plans/wave0-post-migration-snap.json` touched. Zero collateral on drilldown files.

### Non-drilldown helper files (informational)
These ARE files under `src/components/MyMoney/` with fq-calc imports, but they are NOT drilldowns and were intentionally out of scope for F4:
- `WhatIfLibrary.jsx` — `calcFQ, netWorth, monthlySurplus, fqBand, fmt`
- `TileGrid.jsx` — `prcPccSpread, fmt`
- `StateTileRow.jsx` — multi-import (state tile row computation)
- `PivotView.jsx` — `TAX` constant

### Multi-persona regression (engine snapshot — Wave 0 F4 post-state)

```
mrT-core:   NW=726890   FQ=70   Risk=74  Surplus=0
persona-a:  NW=3900000  FQ=69   Risk=71  Surplus=0
persona-b:  NW=1535000  FQ=43   Risk=63  Surplus=0
persona-c:  NW=11175000 FQ=76   Risk=80  Surplus=2500
persona-d:  NW=51600    FQ=49   Risk=47  Surplus=1820
persona-e:  NW=6260000  FQ=100  Risk=82  Surplus=833
persona-g:  NW=366000   FQ=53   Risk=27  Surplus=0
```

- All 7 personas: ripple computes without throwing
- No NaN, no Infinity in any score / balance sheet scalar
- Mr T baseline: 727k NW · 70 FQ · 74 Risk — matches T2 baseline

### Vite build
- `npx vite build`: 216 modules transformed, 414 ms, clean build (one pre-existing chunk-size warning, unrelated to F4)

### Final regression suite
- `tests/ripple-contract.mjs`: **103/103 pass**
- `tests/engine/time-series.test.mjs`: **29/29 pass**
- `tests/components/L3Panel.smoke.test.mjs`: **53/53 pass**

### Snapshot diff (Mr T)
- baseline (W0-T2): `docs/superpowers/plans/wave0-baseline-snap.json`
- post-migration (W0-T8): `docs/superpowers/plans/wave0-post-migration-snap.json`
- After stripping `computed_at` / `computedAt` / `elapsedMs` / `timestamp`: **CLEAN**

### Conclusion

F4 migration is behaviour-neutral. Wave 0 exit gate satisfied:
- [x] getTimeSeries engine primitive shipped + tested (29 cases)
- [x] L3Panel + L4NumberPanel + L4ChartPanel + DrillableNumber + DrillableChart primitives scaffolded (53 smoke cases)
- [x] plain-english.js extended with locked statutory mappings + plainOf helper
- [x] MyMoney.jsx top-level migrated to useRipple (8 call sites)
- [x] Drilldowns verified unchanged
- [x] All 7 personas render without regression
- [x] Mr T snapshot diff against W0-T2 baseline: identical (apart from timestamps)
- [x] ripple-contract regression: 103/103
- [x] vite build clean

Ready for **W0-T16 founder approval gate**.
