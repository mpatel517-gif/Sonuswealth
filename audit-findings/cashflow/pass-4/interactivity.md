# Cashflow — Pass 4 — INTERACTIVITY (multi-variable + back-solve)

**Scope:** Every drawer / interactive surface on the Cashflow tab, measured against the founder bar:
> "interactive = all equations, not one variable" + "back-solver everywhere — drag the OUTCOME, the engine solves the LEVER."

**The two reference standards (the bar):**
- **MethodDetail** (per-method drawer, `Cashflow.jsx:3507`) — 3 forward sliders (pot / draw / growth) **+** a back-solve slider ("make it last to age" → `solveDrawScaleForAge` bisection solves the draw). This is the gold standard.
- **ScenarioForwardSummary** (drawdown drawer, `Cashflow.jsx:3672`) — back-solve income hero (drag target £ → whole plan re-solves via `solveDecumulation`) + 2 assumption sliders (horizon, growth) + reorderable priority list + route picker. Also gold standard.

Anything that is a static read, a single slider, or a multi-input panel with **no** back-solve fails the bar to some degree.

A1 exists/labelled · A2 responds (and to HOW MANY variables) · A3 source/derivation honest · A4 reflects live state · A5 empty/edge handled · A6 FCA-safe.
Severity: **P0** broken/dead · **P1** fails the multi-variable+back-solve bar where it clearly should meet it · **P2** single-variable where multi/back-solve would add real value · **P3** static read where dynamism is optional/nice-to-have.

---

## Findings table

| ID | A1 | A2 | A3 | A4 | A5 | A6 | Severity | Finding | Evidence |
|----|----|----|----|----|----|----|----------|---------|----------|
| CF-INT-01 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | **MethodDetail meets the bar.** 3 forward sliders + 1 back-solve. Reference standard. | `Cashflow.jsx:3507-3561` |
| CF-INT-02 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | **ScenarioForwardSummary (drawdown drawer) meets the bar.** Back-solve income hero + 2 sliders + priority reorder + route picker, all re-solve `solveDecumulation` live. | `Cashflow.jsx:3672-3860` |
| CF-INT-03 | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | **P1** | **Funded gauge has NO back-solve.** `FundedRatioGaugeV2` is display-only; the only adjustable input is the SWR regime picker (1 discrete variable). Obvious missing solve: "what pot / what monthly contribution reaches 1.0×?" The bar explicitly names this case. | gauge `Cashflow.jsx:2021`, picker `2022/2720`, component static (no controls found) |
| CF-INT-04 | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | **P2** | **SWR picker is single-variable** (pick 1 of 6 regimes → drives gauge). Legit lever (A2 fix wired `opts.swrRegime` into `fundedRatio`), but it's the *only* interactivity on the whole "Will my money last?" tile besides the FI tile. 2 of 6 regimes (prc_anchored, custom) are stubs that silently fall back to Bengen — "Custom" implies an editable rate that doesn't exist. | `Cashflow.jsx:2720-2776`; stub fallback `2725,2753-2758` |
| CF-INT-05 | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | **P1** | **"What if markets fall?" has ZERO adjustable stress.** SequenceStressHero, PoSChartV2, SequenceStressVisV2, GuytonKlingerCorridor are all static reads. No drag-the-shock control, no "how bad a crash / what early-years return survives the plan?" back-solve. A markets-stress surface with no adjustable stress is the headline gap. The GK corridor is even hardcoded ±20% (`balance*1.2`/`*0.8`), not engine-derived. | tile `Cashflow.jsx:2026-2040`; SequenceStressHero `2887`; GK corridor `3010-3061`, hardcoded band `3028,3031` |
| CF-INT-06 | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | **P1** | **GoalSeekCard ("What would change it most?") is single-variable + framed backwards.** One slider (target Wealth Score 50–100) + "Find paths" button. It's a *forward* picker labelled as goal-seek. No back-solve on the levers themselves (income, contribution, retire age). The tile promises "top levers / what-if & goal-seek" but delivers a 1-knob target picker that lists 3 path rows. This is the weakest of the four trajectory tiles vs its own promise. | tile `Cashflow.jsx:2041`; card `4055-4151`; slider `4084-4089` |
| CF-INT-07 | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | **P3** | **Hero (two-lens PurposeStatement) is a static read.** No control to flex the inputs behind the two lenses; the live levers live one tap down (drawdown drawer). Acceptable as a summary, but the hero numbers themselves don't drag (memory: "hero numbers don't drill"). | `Cashflow.jsx:1595-1722` |
| CF-INT-08 | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | **P3** | **"Am I OK right now?" drawer is read-only across the board.** Sankey, waterfall, essentials split, subscriptions, surplus allocator, liquidity, income-by-source — all static. Drill chips (`setDrillView`) open *more* static breakdowns. No "what if I cut £X spend / add £Y income → surplus & runway re-solve" lever anywhere in the NOW section. | content `Cashflow.jsx:1164-1209`; drawers `196-712` |
| CF-INT-09 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | **LifeStageOverrideChip** — segmented control commits a real PREFERENCE_SET event; flips accumulator/decumulator face. Single-variable but correct (the engine only has 2 branches). | `Cashflow.jsx:2076-2107` |
| CF-INT-10 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | **X28TopBar Today/Future/Plan** — wired to shared temporal store. But Future/Plan currently show "(coming soon)" — the toggle responds, content doesn't branch yet (acknowledged in code). | `Cashflow.jsx:1264-1322` |
| CF-INT-11 | ✅ | ❌ | ⚠️ | ✅ | ✅ | ✅ | **P2** | **§C "What's it costing?" tile — all engine-internals cards are static reads.** CoI odometer, CoI variants, MaxDrawdown, EfficientFrontier, FI-depth, ConfidenceInterval = Stat grids / % displays, no controls. CoI is the one number that *begs* a back-solve ("what action closes £X of this cost?") and there is none. CoI variants card still shows "NPV discount-rate methodology in progress." | reveal `Cashflow.jsx:1400-1465`; cards `4173-4357` |
| CF-INT-12 | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | **P3** | **Priority reorder uses ▲▼ buttons, not drag.** Functional and re-solves correctly, but "reorderable priorities" reads as a lesser interaction than the founder's drag model. Cosmetic vs the bar. | `Cashflow.jsx:3840-3856` |
| CF-INT-13 | ✅ | ⚠️ | ✅ | ⚠️ | ✅ | ✅ | **P2** | **MethodDetail back-solve slider has `dirty={false}` hardwired** (`3558`) and its displayed value is recomputed from current state each render, so dragging it *commands* a solve but the thumb doesn't track a persisted "target age" — it snaps back to `lastsAge`. Works as a momentary command, but A4 (reflects committed state) is weaker than the income back-solve in CF-INT-02 which holds its value. Minor UX inconsistency between the two back-solvers. | `Cashflow.jsx:3558, 3527, 3488-3502` |
| CF-INT-14 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | **SurplusAllocator / deficit explainer** responds to surplus vs deficit state honestly (the surplus-clamp fix). Read-only by design (it's an allocation suggestion list). | `Cashflow.jsx:2372+` |

---

## Per-drawer summary — variables adjustable / back-solve? / verdict

### Hero — two-lens PurposeStatement
- **Adjustable:** none (pure read).
- **Back-solve:** no.
- **Verdict:** STATIC read. Acceptable as the 10-second answer band, but the hero £ figures don't drag and there's no inline lever. P3.

### "Am I OK right now?" (now / Sankey / waterfall / liquidity)
- **Adjustable:** drill chips → open further static breakdown panels. Today/Future/Plan toggle (content not branched yet).
- **Back-solve:** no.
- **Verdict:** Entirely STATIC. No "cut spend / add income → surplus + runway re-solve" lever anywhere — the most-used everyday section has zero what-if. P3 (it's a status section) but a notable gap vs the bar.

### "Will my money last?" (funded gauge + SWR picker + FI)
- **Adjustable:** SWR regime (1 of 6 discrete). FI tile read-only. Gauge read-only.
- **Back-solve:** **NO** — and this is the textbook case the bar names ("funded gauge with no 'what reaches 1.0×?' solve").
- **Verdict:** SINGLE-VARIABLE. Fails the bar. P1 (missing back-solve) + P2 (single lever + 2 stub regimes).

### "Where my income comes from" (drawdown plan → ScenarioForwardSummary)
- **Adjustable:** target income (back-solve hero), plan-to-age, growth, priority order, route selection. Plus nested MethodsComparison → MethodDetail (3 sliders + back-solve).
- **Back-solve:** **YES** (income hero) + nested (last-to-age).
- **Verdict:** MEETS THE BAR. Multi-variable + back-solve + downstream re-solve (routes, tax, money-map). Reference standard.

### "What if markets fall?" (sequence / MC / GK)
- **Adjustable:** **nothing.**
- **Back-solve:** no.
- **Verdict:** STATIC. The stress is fixed (1-in-5 path, ±20% GK corridor hardcoded). No adjustable shock, no "what crash survives the plan?" solve. P1 — fails the bar precisely where the bar flags ("markets-fall with no adjustable stress").

### "What would change it most?" (goal-seek → GoalSeekCard)
- **Adjustable:** 1 slider (target Wealth Score) + Find paths button.
- **Back-solve:** no (it's a forward target picker mislabelled as goal-seek; the *levers* aren't adjustable and the engine returns ranked paths, not a solved lever value).
- **Verdict:** SINGLE-VARIABLE. Weakest tile vs its own "top levers" promise. P1/P2.

### "How fast can I spend?" (methods → MethodsComparison → MethodDetail)
- **Adjustable:** per-method drawer: starting pot, draw level, growth + back-solve "last to age."
- **Back-solve:** **YES.**
- **Verdict:** MEETS THE BAR (decumulators only). Reference standard. Minor: back-solve thumb doesn't persist (CF-INT-13).

### "What's it costing?" (CoI / engine internals)
- **Adjustable:** nothing (Show-methodology toggle only opens/closes).
- **Back-solve:** no.
- **Verdict:** STATIC. CoI £ is the prime candidate for "what action removes £X?" back-solve and has none. P2.

---

## Scoreboard (founder's requested counts)

- **Drawers/surfaces that are STATIC (no controls):** 4 — Hero, "Am I OK right now?", "What if markets fall?", "What's it costing?".
- **Single-variable only:** 2 — "Will my money last?" (SWR regime), "What would change it most?" (target slider). (Plus LifeStageChip + Today/Future/Plan as legitimately-single controls.)
- **Meeting the multi-variable + back-solve bar:** 2 — "Where my income comes from" (drawdown) and "How fast can I spend?" (methods). Both are decumulator-only, so an **accumulator sees ZERO surfaces that meet the bar.**

---

## Self-criticism / coverage gate

1. **Coverage:** Every interactive entry point enumerated from the source — all `useState`, all `<input type="range">` (4 total: 3 in solver context + 1 in GoalSeek), all `onChange`/`onClick` levers, all 7 trajectory/now/cost tiles + nested drawers. No interactive surface was sampled-not-enumerated.
2. **Persona blind spot (important):** The two bar-meeting surfaces both gate on `decSolve?.rankedPaths?.length` (decumulators only). For an **accumulator** the drawdown + methods tiles don't render — so an accumulator's *entire* Cashflow tab has no multi-variable+back-solve surface (only the SWR regime + Wealth-Score slider). This is arguably the single biggest finding and is not a per-component bug but a coverage gap; flagged under the scoreboard. Did not over-state it as P0 because the surfaces correctly hide rather than show empty drawers.
3. **Runtime not verified:** This is a static source audit. I did NOT run Preview MCP to confirm the sliders actually re-solve live for a real persona, nor screenshot the back-solve thumb behaviour in CF-INT-13. Per CLAUDE.md §9.5 a runtime tie-out (drag income → routes/tax/money-map move; drag SWR → gauge moves) should confirm A2 before any "fixed" claim. Findings about *presence/absence* of controls are reliable from source; findings about *liveness* (CF-INT-13 thumb persistence) are inferred from code, not observed.
4. **Engine files:** Confirmed `solveDecumulation`, `methodPath`/`compareMethods`, `goalSeek`, `fundedRatio`, `swrFromRegime` are imported and wired; did not re-audit their internal math (out of scope — that's the calc-accuracy slice). The back-solve in CF-INT-01/02/05 relies on `solveDrawScaleForAge` (local bisection) and `solveDecumulation` (engine) respectively — both real, not stubs.
5. **Possible false-negative:** I treated the CoI/markets-fall absence of controls as a finding rather than intended scope. If the founder intends these as deliberately read-only "verdict" surfaces, CF-INT-05/11 drop from P1→P2. But the bar ("back-solver everywhere") plus the explicit "markets-fall with no adjustable stress" example in the brief make P1 the right call for CF-INT-05.

---

**Top 3 findings (for the 5-line return):**
1. CF-INT-05 — "What if markets fall?" has zero adjustable stress (all static; GK corridor hardcoded ±20%). P1.
2. CF-INT-03 — Funded gauge has no "what reaches 1.0×?" back-solve; only a single-variable SWR regime picker drives it. P1.
3. Coverage gap — both bar-meeting surfaces are decumulator-only, so an accumulator sees no multi-variable+back-solve surface at all.
