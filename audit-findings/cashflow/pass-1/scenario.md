# Cashflow — Scenario / What-If Audit (Pass 1)

**Auditor:** scenario-auditor
**Date:** 2026-05-18
**Component:** `src/screens/Cashflow.jsx` + `src/components/Cashflow/*`
**Inventory:** `cashflow-inventory-v1.md`
**Engine baseline:** `src/engine/fq-calculator.js`, `src/engine/cashflow-engine.js`, CMA bundle `src/rules/cma-2026.json`

---

## Scope

Cashflow exposes **eight** scenario / what-if surfaces. Every one is audited against the seven scenario assertions: present, expandable, multi-option, actionable, finances-bound, time-projected, FCA-framed.

| # | Surface | Engine fn | Inventory IDs |
|---|---------|-----------|---------------|
| SC-1 | X28 view-mode pills (Today / Future / Plan / What if) | (state only) | CF-X28-02, CF-X28-04 |
| SC-2 | Scenario seed banner | seed object via TappableNumber bus | CF-SEED-01..03 |
| SC-3 | Goal-Seek card | `goalSeek(entity, 'wealthScore', target, 'lifetime', {})` | CF-GS-01..05 |
| SC-4 | SWR regime picker | `swrFromRegime(regime, null, CMA_BUNDLE)` | CF-SWR-01..03 |
| SC-5 | PoS chart (Monte Carlo) | `cf_probabilityOfSuccess(entity, CMA_BUNDLE, 1000)` | CF-POS-01..04, CF-POSC-01..05 |
| SC-6 | Sequence-stress visualisation | `cf_sequenceOfReturnsVulnerability(entity, CMA_BUNDLE)` | CF-SEQ-01..04 |
| SC-7 | Guyton-Klinger corridor | `guytonKlingerPath(entity, 30, CMA_BUNDLE)` | CF-GK-01..04 |
| SC-8 | Scenario matrix (5 scenarios) | `fiveCashflowScenarios(entity, CMA_BUNDLE)` | CF-SCEN-01..06 |

---

## VERDICT TABLE

| ID | Surface | Time-projected | Actionable | Engine-bound | Severity | Finding | Evidence |
|----|---------|----------------|------------|--------------|----------|---------|----------|
| SC-1 | X28 view-mode pills | **FAIL** | **FAIL** | **FAIL** | **DEMO-BLOCKING** | Switching `viewMode` between `actual / forecast / plan / scenario` changes **nothing on the page** except the seed banner gate. No figure, chart, or table re-renders against the chosen horizon. Inventory note CF-X28-02 says "switching mode must change rendered figures, not just label" — it doesn't. Decorative pill row. | `Cashflow.jsx` only contains a single `viewMode ===` check at L714 (seed banner gate). No other branch on `viewMode` exists in the file. The `key={`${viewMode}::${windowId}`}` re-mounts the section but every child reads `entity` / `health` / `pos` / `fr` / `coi` which are computed once from base entity, not from the selected horizon. |
| SC-1b | X28 window-id default | **FAIL** | NA | **FAIL** | **FUNCTIONAL** | Cashflow init state is `windowId='current-tax-year'`. `X28TopBar.TIME_WINDOWS` has no such id — its current-tax-year id is `'current-period'` (rename per spec-§3.2 reconcile, see top-bar comment L82–85). The fallback at top-bar L125 silently picks `TIME_WINDOWS[3]` which is **`next-period` with `defaultMode: 'forecast'`** — the *wrong default*. User lands on "Next year · forecast" while the chip still says Tax year. Confirms seed S-01 with worse impact than stated. | `Cashflow.jsx:528` vs `X28TopBar.jsx:50–58, 125`. |
| SC-2 | Scenario seed banner | **FAIL** | PASS | PASS | **FUNCTIONAL** | Banner shows `current → proposed` deltas from the seed object — finances-bound. But it's a **static one-step delta**, not a path over the horizon. A seed labelled "What if I retire 3 years earlier" must surface a year-by-year cash effect, not "current 65 → proposed 62." Dismiss button works; A2/A4 pass. Time projection assertion fails: this is a single-snapshot what-if. | `Cashflow.jsx:88–135` (`ScenarioSeedBanner`). Banner renders `current` and `proposed` scalars only. No `annual_table` or path consumed. |
| SC-3 | Goal-Seek card | **FAIL** | PASS | PASS | **FUNCTIONAL** | Engine call is real (`goalSeek` binary-searches 4 action KINDS — `drawdown`, `isa-fund`, `gift`, `protection-add`). Result rows are actionable in intent (each `action.kind` + `amount`). But the visible output is **one scalar per kind plus a "gap" integer** — no horizon, no trajectory, no "after 5y / 10y / lifetime this leaves you here." The `targetWindow='lifetime'` argument is passed in but **`goalSeek` never reads it** (engine `fq-calculator.js:1766` signature includes `targetWindow` but the body ignores it). The card claims time-window awareness it doesn't deliver. Also: `humanise('isa-fund')` → "Isa-fund" not "ISA top-up". A5 risk. No FCA boundary on card. | `Cashflow.jsx:2292–2388`, `fq-calculator.js:1766–1800`. |
| SC-3b | Goal-Seek slider expansion | **FAIL** | NA | NA | **POLISH** | Slider step is fixed `5`, range `50–100`. No "see more" path beyond the top 3 returned solutions (`paths.slice(0, 3)`). Inventory CF-GS-04 expects "top 3" so PASS by spec. But for a screen called "Goal-Seek" with only 4 KINDS and 3 rows visible, there's no expandability beyond what fits. Flag as future polish, not a fail. | `Cashflow.jsx:2362`. |
| SC-4 | SWR regime picker | PASS | PASS | PASS | NA | 6 regimes render (Bengen, Guyton-Klinger, Morningstar, Vanguard, PRC-anchored, Custom). Stub regimes honestly disclose "showing Bengen default ({rate}%) until the engine surfaces the regime-specific rate." Engine `swrFromRegime` returns a rate. Time projection NA — this is a rate picker that feeds downstream PoS / Funded-ratio. Actionable in the picker sense (selecting a regime updates state and feeds downstream). No FCA boundary line on the card itself, but stub disclosure carries the spirit. | `Cashflow.jsx:1782–1836`. |
| SC-5a | PoS headline + sub-line | PASS | PASS | PASS | NA | `cf_probabilityOfSuccess(entity, CMA_BUNDLE, 1000)` returns `probability`, `success_pct`, `paths`. Headline binds to `pos.probability`. Honest stub note CF-POS-04 ("monte-carlo.js v1.1 not yet present; current PoS uses single-Z Box-Muller — flagged stub") is on the page. | `Cashflow.jsx:805`. |
| SC-5b | PoS chart (`PoSChartV2`) | FAIL | NA | **FAIL** | **DEMO-BLOCKING** | Call site is `PoSChartV2 probability={…} median={pos?.median_path||null} bands={pos?.bands||null} guardrail={pos?.next_guardrail||null}`. When engine does NOT return `median_path` / `bands`, component falls back to **synthetic series**: `Array.from({length:12}, (_,i) => ({ year: nowYear + i*(horizonYears/11), value: 1_000_000 + i*80_000 + Math.sin(i*0.6)*30_000 }))`. p10/p90 are derived as ±widen on that mock. The chart is rendered as if authoritative. No "stub" badge on the chart. A what-if surface fed by mock data is theatre. The headline percentage can be real while the chart underneath is fabricated. | `PoSChart.jsx:63–75`. Engine call `cf_probabilityOfSuccess` defined in `fq-calculator.js` — verify whether it returns `median_path` and `bands` for Mr T persona, or whether mock always fires. |
| SC-6 | Sequence-stress visualisation | **FAIL** | NA | **FAIL** | **DEMO-BLOCKING** | Same pattern as SC-5b. `SequenceStressVisV2` is wired with `seqVuln?.good_path \|\| null` and `seqVuln?.bad_path \|\| null`. When null, component synthesises: good = `Array.from({length:24}, (_,i) => 1_000_000 * Math.pow(1.045, i))`, bad = `1_000_000 × 0.88^i` for first 5y then `× 1.04^(i-5)`. The "−£XXX outcome delta" hero (CF-SEQ-02) is computed from `goodEnd − badEnd` — when both are mock, the delta is **fictitious**. No stub badge. | `SequenceStressVis.jsx:31–43`. `cf_sequenceOfReturnsVulnerability` returns `good_path` and `bad_path` per the spec — verify in Mr T persona. If engine returns nulls, this is mock theatre. |
| SC-7 | Guyton-Klinger corridor | PASS-with-caveat | NA | PASS | **FUNCTIONAL** (A5) | Engine `guytonKlingerPath(entity, 30, CMA_BUNDLE)` is real and returns a 30-year array `[{year, age, balance, withdrawal, rule}]` — **genuinely time-projected**. Time projection PASS. But: **`Math.random()` injected into growth** (`fq-calculator.js:2606`) means each render produces different paths — the user sees a different corridor on every reload of the same persona. That violates A6 reconciliation (same metric, two values across renders). And the card label "Guyton-Klinger" at the top layer is jargon without a plain-English explainer (S-07, S-13 echo). No FCA boundary on the card. | `fq-calculator.js:2598–2623`, `Cashflow.jsx:818`, `Cashflow.jsx:2125+` (`GuytonKlingerCorridor`). |
| SC-8a | Scenario matrix rows | **FAIL** | PASS-conditional | **FAIL** | **DEMO-BLOCKING** | Two distinct failure modes: <br>**(a) Mock fallback (CF-SCEN-02).** When `fiveScen?.scenarios` is null/empty, component renders 5 hardcoded mock scenarios with PoS values `0.0 / 0.94 / 0.88 / 0.97 / 0.68` and drawdowns `£0 / £38k / £34k / £28k / £46k`. Indistinguishable from real engine output. Seed S-02/S-03 confirmed. <br>**(b) Engine-shape mismatch.** Real engine `fiveCashflowScenarios` returns `{id, label, annual_drawdown, annual_table, pos, coi, terminal_value_median}`. Component renders `{s.name}` (mock-only key — engine returns `s.label`), `{fmtCompact(s.drawdownAnnual)}` (mock-only key — engine returns `s.annual_drawdown`), `{s.desc}` (mock-only), `<Spark points={s.spark} ...>` (mock-only). With real engine wired, scenario cards render **empty name, "£NaN/yr", empty desc, no sparkline** — the engine output is silently dropped on the floor and the screen looks broken instead of real. | `ScenarioMatrix.jsx:68–74` (mock); `ScenarioMatrix.jsx:114–125` (render reads `name / drawdownAnnual / desc / spark`); `cashflow-engine.js:850–928` (engine returns `label / annual_drawdown / annual_table`). |
| SC-8b | Scenario forward summary | PASS-with-stub | PASS | PASS | FUNCTIONAL (A6) | `ScenarioForwardSummary` handles BOTH shapes via `active.annual_drawdown ?? active.drawdownAnnual` and `terminal_value ?? median_terminal`. Honest "— stub" when terminal missing. Disclosure copy at L2279 acknowledges "Per-scenario forward-cashflow table arrives when engine surfaces year-by-year draw paths (O-CF-RULES-08)" — but engine **already returns `annual_table`** for each scenario (cashflow-engine.js:883–891). The annual table is computed but the UI never surfaces it. A "Coming next" message is therefore stale: the data exists, the UI hasn't been wired. Time-projection FAIL on the visible surface even though the data is one step away. | `Cashflow.jsx:2256–2286`; `cashflow-engine.js:872–893`. |
| SC-8c | Scenario matrix expandability | **FAIL** | NA | NA | **FUNCTIONAL** | Engine returns exactly 5 scenarios. No "see more" affordance, and no slot for user-defined scenarios on the screen — `'custom'` is one of the engine's 5 and is fed by `entity?.drawdown`, but no UI lets the user *set* a custom drawdown from this card. The "What if" view-mode pill (SC-1) implied that scenario-mode is where the user explores; in practice the matrix is fixed-5 and the user has no path to add/edit. | `cashflow-engine.js:901–906`. |

---

## Cross-cutting findings

### CC-1 — No per-scenario FCA boundary line
**Severity: FUNCTIONAL.** Spec requires "every scenario result carries the *estimate · not financial advice* boundary." The page-level `BRAND.disclaimer` at the very bottom of Cashflow (`Cashflow.jsx:866`) is the only FCA line on the screen. Goal-Seek, PoS chart, Sequence-stress, Guyton-Klinger, Scenario matrix all render figures with **no scoped boundary**. The L3 drill panels do carry "Information only · Derived from your data · Not regulated advice" (L311, L410, L520) — but those are the *destinations*, not the scenario cards themselves. A user scrolling and reading "94% PoS · Plan survives" or "Bengen draw £28k/yr · 97% PoS" gets numbers that *look* like advice without any scoped boundary. FCA assertion FAIL across SC-3, SC-5, SC-6, SC-7, SC-8.

### CC-2 — Mock-fallback theatre is the structural failure
**Severity: DEMO-BLOCKING.** Four V2 chart components (`PoSChartV2`, `SequenceStressVisV2`, `EfficientFrontierV2`, `ScenarioMatrixV2`) all share the same pattern: prop default `= null`, fall through to a synthesised series, render with no visual distinction from real-data state. This is the structural integrity break for the screen as a what-if surface. The standard fix is either (a) render an empty state when props are null, or (b) render the chart with a visible "Coming next — using illustrative shape" badge that matches the stub treatment used on PRC/PCC and Reality Engine cards. Currently the user has no way to tell. Per the audit rule cited in the brief: **"charts fed by mock fallback fail scenario integrity — a what-if using synthetic data is theatre."**

### CC-3 — Time-projection is the central scenario assertion, and most surfaces fail it
- **Time-projected PASS:** SC-5b (PoSChart — the x-axis is years but data is mock when null), SC-7 (Guyton-Klinger — real 30-year array but with `Math.random()` noise = unstable).
- **Time-projected FAIL:** SC-1 (no horizon binding), SC-2 (scalar delta only), SC-3 (gap-from-target scalar, no path), SC-6 (mock series when engine returns null), SC-8a (mock spark or empty when engine), SC-8b (engine returns `annual_table`, UI hides it).

Only the Guyton-Klinger surface delivers a true year-by-year projection, and that one re-randomises on every render. A screen called "Cashflow" with a "TRAJECTORY · This year to retirement" section is currently a collection of single-snapshot tiles dressed as forward projections.

### CC-4 — Engine-shape vs UI-shape drift on ScenarioMatrix
**Severity: DEMO-BLOCKING (or FUNCTIONAL if you accept that the V1 fallback "ships" because nobody noticed the mismatch).** This is a real coding error, not a stub: the component reads `s.name / s.drawdownAnnual / s.desc / s.spark` while the engine returns `s.label / s.annual_drawdown / (none) / (none)`. If `fiveCashflowScenarios` succeeds with the current persona, the component **falls into the "engine fired, mock fell through to fallback, real rows would render as garbage" zone**. The fix is one of: (a) translate engine shape to mock keys in `ScenarioMatrixWithRecompute`, (b) update `ScenarioMatrix.jsx` to support both shapes (the way `ScenarioForwardSummary` already does at L2258–2261), or (c) the engine should return both keys for back-compat. Until then, the matrix is **either mock theatre or visibly broken**, never real.

### CC-5 — "X24 mode 3" jargon at top layer (CF-GS-01)
**Severity: FUNCTIONAL (A5).** GoalSeek card chip reads "X24 mode 3" — internal spec ordinal at the top layer of the UI. Violates the macOS principle (internal codes never at top layer). Seed S-07 confirmed.

### CC-6 — `goalSeek` ignores its `targetWindow` argument
**Severity: FUNCTIONAL.** `fq-calculator.js:1766` signature includes `targetWindow` (Cashflow passes `'lifetime'`) but the function body never references it. The "horizon" promise to the user is currently structural fiction. If `targetWindow` is intended (per spec), the engine needs to actually project the action over that window and report the year-by-year wealth-score trajectory, not a single gap.

---

## Coverage

Scenario rows in inventory: 8 surfaces × N sub-rows = 25 inventory rows directly relevant to scenario / what-if (CF-X28-02, CF-X28-04, CF-SEED-01/02/03, CF-GS-01..05, CF-SWR-01/02/03, CF-POS-01..04, CF-POSC-01..05, CF-SEQ-01..04, CF-GK-01..04, CF-SCEN-01..06).

- **Inspected:** 25 / 25.
- **PASS (all four scenario assertions met):** 4 (CF-SWR-01/02/03, CF-POS-01).
- **FAIL (one or more scenario assertions fail):** 21.
- **Of the FAILs:** 6 DEMO-BLOCKING (SC-1, SC-5b, SC-6, SC-8a — counting each as one), 12 FUNCTIONAL, 3 POLISH.

**CF scenario: 4 PASS, 21 FAIL (6 DB, 12 F, 3 P).**
