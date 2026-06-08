# Cashflow Tab — Pass 4 Audit: RECONCILIATION (A6) + DOMAIN/IFA

**Scope:** Cashflow.jsx ↔ engine (fq-calculator.js, decumulation-solver.js, withdrawal-methods.js) ↔ HomeScreen.jsx cross-tab.
**Method:** static read of every displayed number → its engine fn. Live DOM tie-out flagged where code alone can't confirm a persona value.
**Date:** 2026-06-04

A-assertions key: A1 exists · A2 right value · A3 right format · A4 right drill dest · A5 right state/empty · **A6 reconciles (same metric = same value everywhere, traces to engine fn)**.

---

## SIX-ASSERTION TABLE

| ID | Assertion | Sev | Finding | Evidence (file:line) |
|----|-----------|-----|---------|----------------------|
| CF4-01 | A6 | **HIGH** | **Decumulator hero "£31k secure + £65k pots = £96k" residual is a DISPLAY reconstruction, not an engine field.** Code shows `secure = floor.grossAnnual`, then `residual = max(0, target − secure)`. The solver's actual `floor.residualNeed` is `target − netFloorIncome` (NET basis) — a different number. The sum ties cosmetically (forced) but the £65k shown is NOT what the engine says the pots deliver, and understates it (pots must withdraw MORE gross to net the residual after drawdown tax). Comment at :1626-1628 openly admits the mismatch. | Cashflow.jsx:1625-1629, 1642; decumulation-solver.js:579-582 |
| CF4-02 | A6 | **HIGH** | **Lens B "If markets disappoint X%" (fundedRatio) and Lens A "On track" (fiRatio) use DIFFERENT asset bases for what the UI frames as a paired view.** `fundedRatio` reads ONLY flat scalars `assets.sipp.total / isa / investments` (no cash, no array shapes). `fiRatio` calls `investable()` which sums nested/array pensions+investments+cash. They cannot reconcile, and `fundedRatio` returns INSUFFICIENT/null for typed-array personas (Bruce) → "Not enough investment data to stress-test" even when pots exist. **Needs live DOM tie-out on Bruce.** | fq-calculator.js:484-505 (491-494), 169-179, 2244-2256; Cashflow.jsx:1082-1083, 1651-1658 |
| CF4-03 | A6 | LOW | Hero reads `fr?.funded_ratio ?? fr?.ratio`; `fundedRatio` never returns key `funded_ratio` — dead first branch, silently falls through to `ratio`. Brittle (a future rename of `ratio` breaks silently). | Cashflow.jsx:1615; fq-calculator.js:538 |
| CF4-04 | A6 | INFO (PASS) | **Net surplus/deficit reconciles across NOW-tile · Sankey · waterfall · Home.** All four trace to one fn: `monthlySurplus` is derived from `cashflowFlow.surplusMonthly`; NOW-tile uses `msNet = surplus − deficit`; Home uses `cfMonthly = surplus>0 ? surplus : −deficit` (identical signed value). Waterfall/Sankey read `f.surplusAnnual` = `surplusMonthly × 12`. **Prior Home −£391 vs CF £0 bug is fixed.** | Cashflow.jsx:1065,1355,2148,759; fq-calculator.js:2652-2664,2740-2793; HomeScreen.jsx:1127,1135 |
| CF4-05 | A6 | LOW | Home calls `monthlySurplus(entity)` with **no bundle**; Cashflow calls `monthlySurplus(entity, CMA_BUNDLE)`. `cashflowFlow` forwards bundle to `calcIncomeTax`/`calcAllIncome`. If those don't resolve a default identical to CMA_BUNDLE when undefined, tax (hence surplus) can differ between tabs by the tax delta. **Needs live tie-out** (likely fine if engine defaults, but unverified in code). | HomeScreen.jsx:1127; Cashflow.jsx:210,1061; fq-calculator.js:2741-2742 |
| CF4-06 | A2/A6 | INFO (PASS) | "What's it costing?" tile = `coi.total` from `totalCoI(entity, CMA_BUNDLE)`; CoI odometer wrapper reads same `total`. No hardcoded CoI figure. (Per-domain breakdown depth not audited this pass.) | Cashflow.jsx:1144,1373,4153-4160 |
| CF4-07 | A2 | **MED** | **Per-method "lasts to age X / lasts horizon" is sequence-of-returns blind.** All 5 methods project on a CONSTANT return (`bal*(1+g)`, g≈5%) — no volatility/sequence. A pot "lasting to 95" under constant 5% can deplete a decade earlier under a poor early sequence. `compareMethods.depletesAtAge` is derived from this single path. Partly mitigated: MC `pos` shown separately + method `weakness` strings name the flaw — but the drawer's depletion verdict reads as a guarantee next to a £/yr figure. | withdrawal-methods.js:6-7,50-119, compareMethods; Cashflow.jsx:1130-1133,1363-1371 |
| CF4-08 | A2 | LOW | `methodsRange` tile headline and the MethodsComparison drawer both derive `essentialsAnnual = target × 0.6` (a proxy, not engine essentials). Tile passes `years` only; drawer passes `age`+`horizon` separately — same inputs, but two call sites that could drift. No single `compareMethods` memo shared. | Cashflow.jsx:1116-1127, 1363-1371 |
| CF4-09 | A2/A6 | LOW | Health-score input path: `surplusAnn` at :226 recomputes `gross−tax−pension−ess−debt` locally (omits NI + protection that `cashflowFlow` includes); :1789 uses `ms.surplus*12` (clamped, ignores deficit). Both diverge from canonical `cashflowFlow.surplusAnnual`. Affects the health-score band, not the headline surplus. | Cashflow.jsx:226,1789; fq-calculator.js:2780 |
| CF4-10 | A2 | INFO (PASS) | **DB / annuity / state pension correctly treated as income floor, never a drawable pot.** Solver routes them to `secureIncome`; floor.grossAnnual + residualNeed model the floor before any pot draw. State pension gated by SPA (`age >= ctx.spa`). | decumulation-solver.js:40,43,150-154,170,237,482-490,576-588 |
| CF4-11 | A2 | INFO (PASS) | **Income shown as £/yr (not just capital); full accumulate→draw-down lifecycle handled** via `inferLifeStage` → accumulator face (fiRatio/surplus, no funded doom) vs decumulator face (solver + depletion curve). Adaptive, no persona hardcoding. | fq-calculator.js:2698-2720; Cashflow.jsx:1612-1700 |

---

## RECONCILIATION MATRIX

| Surface | Displayed | Engine fn | Ties? |
|---|---|---|---|
| Hero Lens A "Your plan" target | `target` = `inputs.incomeTargetAnnual` | `solveDecumulation().inputs` | ✅ engine-sourced |
| Hero Lens A "secure £31k" | `floor.grossAnnual` | `solveDecumulation().floor.grossAnnual` | ✅ engine-sourced |
| Hero Lens A "pots £65k" | `target − floor.grossAnnual` (display calc) | ≠ `floor.residualNeed` (engine, net basis) | ❌ **reconstruction; not the engine residual** (CF4-01) |
| Hero Lens B "funded %" | `fr.ratio` | `fundedRatio(entity,CMA,{swrRegime})` | ⚠️ engine-sourced BUT asset base ≠ fiRatio/solver pots (CF4-02); null for array personas |
| Funded gauge (inside) | same `fundedRatioVal` | `fundedRatio` | ✅ single value w/ Lens B (one source) |
| NOW tile "In surplus/deficit £x/mo" | `msNet = ms.surplus − ms.deficit` | `monthlySurplus` ← `cashflowFlow.surplusMonthly` | ✅ |
| Sankey net sink | `f.surplusAnnual` | `cashflowFlow.surplusAnnual` | ✅ |
| Waterfall "Annual surplus" | `f.surplusAnnual` | `cashflowFlow.surplusAnnual` | ✅ |
| Sankey gross + sources | `f.gross` + Σ`incomeAll.items` | both = `calcAllIncome(entity).total` | ✅ |
| Home deficit banner | `cfMonthly` | `monthlySurplus(entity)` (no bundle) | ✅ value, ⚠️ bundle arg differs (CF4-05) |
| "What's it costing?" tile | `coi.total` | `totalCoI(entity,CMA)` | ✅ |
| Methods tile range | `min/max year1Withdrawal` | `compareMethods({...})` | ✅ ties to drawer (same inputs) |
| Method drawer worked example | `year1Withdrawal`, `depletesAtAge` | `compareMethods` → `methodPath` | ✅ value; ⚠️ constant-return depletion (CF4-07) |
| FI tile (accumulator) | `fi.ratio`, `fi.multiple` | `fiRatio(entity)` ← `investable()` | ✅ |

**No hardcoded headline £ figures found.** Prior magic-number fallbacks (£78k/£29k waterfall) confirmed removed; empty-states present (waterfall :2126, Sankey :750, methods sparse-guard). The only NON-engine number on a headline is the hero "pots £65k" display reconstruction (CF4-01).

---

## DOMAIN / IFA VERDICT

- ✅ Income is £/yr throughout; capital is means, not the headline.
- ✅ Lifecycle: accumulate→decumulate handled adaptively; curve turns over (DepletionCurve, real `potsEnd`).
- ✅ DB/annuity = income floor, never drawable; state pension SPA-gated and integrated into the floor.
- ✅ Withdrawal rates sourced from `swrFromRegime` (single source) — no method draws a nonsensical fixed 12%.
- ❌ **Sequence risk:** per-method "lasts to age X" is a constant-return statement (CF4-07). The MC fan is the honest counterpart but sits in a different surface; the depletion verdict should carry a "deterministic — see probability fan" caveat or it overstates certainty.
- ❌ **Funded-ratio coverage:** the metric that drives the decumulator's stress lens under-reads array-shape personas and excludes cash, diverging from fiRatio and the solver's own pot total (CF4-02). This is the highest-impact IFA-credibility gap: it shows "not enough data" to exactly the at-retirement users it's meant to serve, and where it does fire, the % rests on a narrower asset base than the plan it sits beside.

---

## SELF-CRITICISM GATE

- **Coverage:** Audited every headline £ number + the surplus/deficit chain across 4 surfaces + Home. NOT audited: per-domain CoI breakdown values, the PRC/PCC + Reality Engine stubs (known `{status:'stub'}`, out of A6 scope), SubscriptionTracker/EssentialsDiscretionary sub-numbers, SolverPanel slider live re-run values.
- **Live-DOM gaps (could not confirm from code alone):** CF4-02 (does Bruce actually trip INSUFFICIENT funded%?), CF4-05 (bundle-arg tax delta Home vs CF), and the exact £31k/£65k/£96k persona values vs solver output. These need `preview_eval` DOM scrape + a node-side `solveDecumulation(Bruce)` dump to close. Flagged, not asserted.
- **Strongest claim:** CF4-01 and CF4-02 are code-confirmed, not inferred. CF4-04 (the headline reconciliation win) is also code-confirmed via the single `cashflowFlow` source.
- **Weakest claim:** CF4-07 severity — arguably LOW since MC fan + weakness strings exist; rated MED because the depletion age is presented as a flat verdict adjacent to a £/yr number with no inline caveat. A founder/IFA could read "lasts to 95" as a promise.
- **Did NOT trust the checklist's ✅ marks.** Checklist claimed §5.2 funded gauge "wired; reconfirm tie-out" — reconfirmation FAILED on asset-base reconciliation (CF4-02). The ✅ was build-integrity, not tie-out.
