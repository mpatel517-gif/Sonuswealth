# Decision Engine ("Choices") — Gold-Standard Benchmark

**Purpose:** every one of the 40 decisions (DE-01…DE-40) must pass this benchmark. It is distilled from five fix-passes on the canonical property decision **DE-09**, where each founder complaint exposed a reusable issue class. DE-09 is the reference implementation; this doc is the contract every other decision is held to.

**Status:** DOCUMENTED · **Cluster:** decision-engine · **Updated:** 2026-06-06
**Summary:** 16 binary, code-checkable benchmark items + the verification gates that prove them, so all 40 decisions reach ~99% accuracy via a systematic pass, not whack-a-mole.
**Tags:** #decision-engine #benchmark #DE-09

---

## How DE-09 was fixed — the issue classes (each = a benchmark item)

| # | Founder complaint (DE-09) | Root cause | Generalised rule |
|---|---|---|---|
| 1 | "rent it out = −£8k cash freed" | overhead cost booked into the wrong metric bucket & mislabelled | **BM-3** right bucket |
| 2 | Weights step "static, can't change" | input whose only consequence (re-rank) was off-screen + "VIEW ONLY" badge | **BM-11** lever flows through; live consequence |
| 3 | "after 9 steps can I decide" | decision buried; flow didn't end in a synthesis | **BM-14** multi-factor answer |
| 4 | "if I rent it why -8k / show the income tax" | rental income tax computed nowhere | **BM-7** income tax shown |
| 5 | "3 factors are static / hardcoded" | amount lever trapped in the Options step's local state | **BM-11** lever flows through |
| 6 | "if CGT is £0 why show it" | same factor set shown for every option | **BM-6** option-aware factors |
| 7 | "rental income ≠ the bar" (twice) | chart plotted NET, card led with GROSS; + two different formatters | **BM-8** one number per quantity / tie-out |
| 8 | "why can't I drag the bar" | bars are outputs of one shared input | **BM-10** per-option what-if drawer |
| 9 | "why guess the rent" | default = value×5%, a market guess as fact | **BM-1** real data, no guessing |
| 10 | "Keep / Sell greyed out" | income chart zeroes non-income options | **BM-9** fair comparison |
| 11 | "methodology box is wrong" | `generateRecommendation.rules` hardcoded to 3 pension/IHT rules for ALL decisions | **BM-12** per-decision provenance |

---

## The 16 benchmark items (binary, code-checkable)

**A — Calculation correctness (engine: `src/engine/decision-engine.js`)**
- **BM-2** No hardcoded UK tax figures. All rates/thresholds from the `TAX` bundle (`_bundle.js _buildTAX`) via `_marginalRate(income)` / `_dividendRate(income)` / `TAX.*`. (`accuracy-auditor` rule.)
- **BM-3** Each engine delta is booked to the metric it actually is (net worth vs income vs tax-cost vs premium vs loan) and labelled honestly — never a premium/cost shown as "Net worth." (See `NW_METRIC_LABEL`, `SUPPRESS_NW_CHART`.)
- **BM-4** Correct signs: an estate reduction reads as IHT **down** (good); losing BPR reads as IHT **up**; a saving is +, a cost is −.
- **BM-5** Pensions enter the estate from Apr 2027 (enacted) → pension contributions give **no lasting IHT relief**: those ihtDeltas = 0.
- **BM-7** Income-generating options quantify the **income tax** (rental, dividend, etc.) at the user's marginal band, and show net "you keep."

**B — Real data, no guessing**
- **BM-1** Every input binds to the user's **real holdings/data** (e.g. the actual property + its value/rent from `entity`) where it exists. Where a value genuinely isn't known, it is an **explicit, adjustable assumption** with a sourced basis and `status: estimated` — never a silent market guess presented as a fact. (Memory: `feedback_surface_methodology_to_user`, `feedback_i_am_the_taxonomy_authority`.)

**C — Option-aware presentation (`src/screens/DecisionEngine.jsx`)**
- **BM-6** Each option shows **only the factors that are a real trade-off for that option**; never a £0 line that isn't the point (no CGT £0 on a rent option). Pattern: `propertyFactors(im, id)`.
- **BM-8** **One number per quantity, one label, everywhere.** The comparison bar string === the card factor string === the Answer factor === the Commit chip — same variable, same formatter. (Bar-vs-card is the highest-risk pair. §9.5 Gate 2.)
- **BM-9** **Fair comparison.** The comparison metric must not flatline options whose value sits on a different axis. Either compare each option on its own primary value, or show a multi-dimension view; an all-£0 bar that reads as "disabled" is a fault.

**D — Interactivity (PP-3 Goal-Seek)**
- **BM-10** **Per-option what-if drawer**: tap an option → model its OWN drivers (rent + costs for letting; purchase price + pension split for selling). Interactive, not static. Pattern: `propertyLeverSpecs` / `propertyDefaults` / `recomputePropertyOption` / `WhatIfPanel`.
- **BM-11** Levers live at the **wizard level** and flow through to ranking + Answer + Commit (not trapped in the Options preview). **Defaults must reproduce the headline numbers exactly** — one shared model for default and modelled (`impact = recompute({...defaults, ...overrides})`), so opening a drawer never makes a number jump.

**E — Provenance & content**
- **BM-12** **Per-decision methodology.** The "how this was worked out" rules are the ones that ACTUALLY apply to THIS decision (CGT rate + AEA + IHT for property-sell; income-tax bands + Rent-a-Room/property allowance for let; pension AA only for pension decisions). NOT a hardcoded generic list. (`generateRecommendation.methodology.rules` must be keyed by decisionType/option.)
- **BM-13** **Path-aware checklist + next-steps** match the CHOSEN option (letting steps for `let`, not sell/CGT). Use `checklistFor(decId, path.id)` first.
- **BM-15** Plain-English, FCA-safe: information/guidance, never advice ("you should/we recommend"), no product endorsement.

**F — Flow**
- **BM-14** The 7-station flow (Identify · Context · Options · Priorities · Answer · Stress-test · Commit) holds: every station carries a lever + dynamic guidance + a chart, and the flow ENDS in a multi-factor Answer (tax · net worth · income/return · risk · estate). Priorities re-ranks **live**; the wheel is draggable; no "Step N+1 of N" overshoot.

**G — Verification gate (how to KNOW, not assume)**
- **BM-16** Live-verified via Preview MCP, not just `npm run build`: walk the full flow on a **relevant persona** (Mr T accumulator `?demo=mrt-core`, Bruce decumulator `?demo=a`); scrape EVERY pair of visuals that show the same quantity and assert **string-equality** at default AND at a modelled lever value; confirm methodology, checklist, and factors are option-correct. Build/tests are necessary-not-sufficient.

---

## DE-09 reference patterns (what "good" looks like in code)

- `PROPERTY_PATHS` (options) → `propertyDefaults`/`recomputePropertyOption` (one model) → `propertyImpact` (default ≡ recompute(defaults)) → `propertyFactors` (option-aware) → `WhatIfPanel` (per-option levers) → wizard `optLevers` (flow-through) → `StepAnswer` (multi-factor) → `StepCommit` (path-aware checklist + provenance).
- The 39 engine decisions currently use the **generic** path (`enumeratePaths` + `simulateAction` + generic factor chips + the hardcoded methodology) — so they fail BM-6, BM-7, BM-9, BM-10, BM-11, BM-12 by construction. The fix is **generalisation**, not 39 bespoke builds: lift the DE-09 patterns into the shared engine path + a per-decision rules/lever map.

## Generalisable fixes (one change → many decisions)
- **G-1 (BM-12):** replace `generateRecommendation.methodology.rules` with a per-decisionType rules map. Fixes all 40 at once.
- **G-2 (BM-6/7):** derive option-aware factors from each decision's `simulation.delta` + a per-decision factor spec, the way `propertyFactors` does — shared component.
- **G-3 (BM-9):** smart comparison-metric selection that never renders an all-£0/identical bar set as the headline.
- **G-4 (BM-10/11):** extend the per-option what-if pattern to engine decisions via `leverFor` + `simulateAction` drivers.
- **G-5 (BM-1):** bind decision inputs to `entity` holdings; flag unknowns as `estimated` assumptions.

## Pass bar
A decision is COMPLETE when all 16 BM items pass AND BM-16 live verification is recorded (per-decision `.verify-DE-XX.md` with the tie-out scrapes). 99% target = ≤ a handful of POLISH-severity items open across the 40, zero DEMO-BLOCKING/FUNCTIONAL.
