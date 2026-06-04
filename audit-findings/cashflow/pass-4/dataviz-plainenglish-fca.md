Title:        Cashflow Pass-4 — DataViz / Sparklines / Plain-English (A5) / FCA audit
Version:      1.0
Date:         2026-06-04
Status:       DOCUMENTED
Cluster:      2-Product / Cashflow
File name:    dataviz-plainenglish-fca.md
Purpose:      Audit Cashflow tab tiles + drawers for chart grammar, sparkline/trajectory/composition parity with the MyMoney balance-sheet bar, A5 plain-English, and FCA framing.

**Summary:** The 7 Cashflow question-tiles are plain-text only — no sparkline, trajectory bar, or composition bar (founder's exact flag confirmed); drawer charts are mostly labelled, but the Guyton-Klinger corridor has unlabelled axes + a fabricated ±20% band, the funded-ratio gauge surfaces bare "funded ratio / 0.48" jargon, and sequence-stress lines lack a £ axis.
**Tags:** #cashflow #dataviz #plain-english #fca
**Updated:** 2026-06-04

Scope: `src/screens/Cashflow.jsx` + `src/components/Cashflow/{PoSChart,EfficientFrontier,SequenceStressVis,FundedRatioGauge,ScenarioMatrix}.jsx`, `src/components/charts/Sankey.jsx`.
Assertions: A1 right chart type · A2 labelled/legible (axes+units+today-divider) · A3 encodes insight (not decorative) · A4 viz-parity present where balance-sheet bar would have one · A5 plain-English (jargon translated in place) · A6 FCA (info/guidance, projections = "your assumption").

---

## Six-assertion findings table

| ID | A1 | A2 | A3 | A4 | A5 | A6 | Severity | Finding | Evidence (file:line) |
|---|---|---|---|---|---|---|---|---|---|
| CF-DV-01 | n/a | n/a | n/a | FAIL | pass | pass | **HIGH** | `QuestionTile` renders ONLY q-label + headline text + sub + "View ›". No sparkline, no trajectory bar, no composition bar. Every tile in the grid uses it → all 7 tiles lack viz grammar. This is the founder's exact flag ("no sparklines, or any trend charts" on cashflow tiles). | Cashflow.jsx:1932-1944 |
| CF-DV-02 | n/a | n/a | n/a | FAIL | pass | pass | **HIGH** | The whole-tab grid (`now`, `lastability`, `drawdown`, `methods`, `resilience`, `whatif`, `costs`) is built as plain QuestionTiles. The balance-sheet tile pattern (spark + trajectory + composition) was never ported to Cashflow. | Cashflow.jsx:1995-2010, 1349-1376 |
| CF-DV-03 | FAIL | **FAIL** | partial | n/a | FAIL | pass | **HIGH** | GuytonKlingerCorridor SVG has NO axis labels — no x (years), no y (£) despite a 40px left pad reserved for them. Worse, the ±20% "corridor" is hardcoded geometry (`balance*1.2` / `balance*0.8`), NOT engine-derived uncertainty — a decorative fake band presented as a scenario envelope. Violates "uncertainty as labelled scenario lines or a labelled band". | Cashflow.jsx:3010-3062 (band math 3026-3032; no axis text) |
| CF-DV-04 | pass | partial | pass | n/a | **FAIL** | pass | MED | FundedRatioGauge centre label is bare jargon "funded ratio" over a bare decimal "0.48". No plain-English at the gauge itself (the "your pots cover X%" translation lives only in the surrounding lens copy, not on the component). Founder explicitly named "funded ratio" as unexplained jargon. | FundedRatioGauge.jsx:157-166 |
| CF-DV-05 | partial | **FAIL** | partial | n/a | pass | pass | MED | SequenceStressVis good/bad lines have NO y-axis and NO £ scale — only an end-value + "end Nyr". You cannot read intermediate values or the depth of the early dip; the line shape is near-decorative. Needs a £ axis or at least start/trough/end value labels. | SequenceStressVis.jsx:112-165 |
| CF-DV-06 | pass | partial | pass | n/a | **FAIL** | pass | MED | EfficientFrontier axes labelled but jargon-heavy: "% vol", "Expected return →", "60/40 blend". No plain-English pass ("vol" = how bumpy; "expected return" = typical yearly growth). Buried in §C engine-internals so impact is lower, but it is user-reachable. | EfficientFrontier.jsx:130-151 |
| CF-DV-07 | pass | pass | pass | n/a | partial | pass | LOW | PoSChartV2 is a good chart: x-axis years, y-axis £k gridlines, p10–p90 band, "now" divider, legend, "1,000-path Monte Carlo / N-year horizon" caption. A2 strong. Minor: y-axis numbers via `fmtCompact` carry no explicit "£" axis caption next to the column; "Monte Carlo" is jargon (a one-word gloss would close A5). | PoSChart.jsx:109-220, 132 |
| CF-DV-08 | pass | n/a | pass | n/a | pass | pass | LOW | CashflowMoneySankey is the right part-to-whole/flow chart, ties out to a visible reconciliation strip (gross − tax − pension − essentials − debt = surplus/deficit), honest-hides on no income, models deficit as a virtual "From savings / borrowing" source. Strong. Minor: relies on Sankey lib internal labels for node legibility — verify node text renders on mobile width. | Cashflow.jsx:725-877 |
| CF-DV-09 | pass | n/a | pass | n/a | pass | pass | LOW | MethodsComparison drawer rows DO carry a MiniSparkline (pot trajectory) — proving the spark pattern exists in the codebase but was applied inside ONE drawer, not on the tiles. Spark is `aria-hidden` decorative (no axis) but acceptable as a glanceable row spark beside a labelled value. | Cashflow.jsx:3468-3483, 3643 |
| CF-DV-10 | pass | n/a | pass | n/a | pass | pass | LOW | No chart implies infinite growth: PoSChart median curves under draw, ScenarioMatrix sparks are decumulation trajectories (turn over), sequence lines deplete. Decumulating-assets-turn-over rule met. | PoSChart.jsx; ScenarioMatrix.jsx:8; SequenceStressVis.jsx |
| CF-PE-11 | n/a | n/a | n/a | n/a | **FAIL** | pass | MED | Unexplained jargon surfaced at the surface layer: "Sequence-of-returns stress" / "Sequence resilience" (Cashflow.jsx:2986, 603), "Guyton-Klinger" / "guardrails corridor" (3014, 3039), "SWR" / "Selected SWR" (2761), "Bengen / Morningstar / Vanguard" rule names (2707-2710), "funded ratio" (1765, FundedRatioGauge 165). Some have tooltips/notes, but A5 requires the plain meaning in place, not on hover. | Cashflow.jsx:603, 2761, 2986, 3014, 3039; FundedRatioGauge.jsx:165 |
| CF-FCA-12 | n/a | n/a | n/a | n/a | pass | partial | LOW | FCA framing is broadly strong — "Information only · Not regulated advice" footers (437/571/707), "An illustration, not advice" (3628), "not a personal recommendation" (3601), "discuss with a regulated adviser" (2956), projections framed as "on your assumptions" (3626). One borderline: a method is highlighted with a "#1 / fits your #1 priority" chip + accent border (3534, 3640) via `recommendMethodForGoal`. Defensible (matches the user's OWN stated priority + carries "not advice"), but the visual emphasis edges toward steering — keep the disclaimer adjacent and consider softening to "matches the goal you set". | Cashflow.jsx:3534, 3614, 3640 |
| CF-FCA-13 | n/a | n/a | n/a | n/a | pass | pass | LOW | "Withdrawal-rate assumption" picker is correctly framed as an assumption knob, stub regimes honestly flagged "Coming next / methodology pending" rather than faking a rate. Good A6. | Cashflow.jsx:2720-2774 |

---

## Tiles missing sparkline / trajectory / composition (the founder flag)

All tiles are rendered by `QuestionTile` (Cashflow.jsx:1932) which supports NONE of the three viz primitives. Every tile below is plain text (q + headline + sub + "View ›"):

| # | Tile key | Question | What viz it should carry (vs balance-sheet bar) | Source |
|---|---|---|---|---|
| 1 | `now` | Am I OK right now? | surplus/deficit **sparkline** (monthly net trend) + essentials-vs-discretionary **composition bar** | Cashflow.jsx:1351 |
| 2 | `lastability` | Will my money last? / Am I on track? (FI) | pot-balance **trajectory bar** to depletion age (decum) or FI-progress **composition/progress bar** (accum) | Cashflow.jsx:1969-1973 |
| 3 | `drawdown` | Where my income comes from | secure-vs-pots **composition bar** (it already computes the £47k + £49k split — perfect for a part-to-whole) | Cashflow.jsx:1988-1991 |
| 4 | `methods` | How fast can I spend? | spend-range **sparkline/bullet** (the lo–hi it already has as text) | Cashflow.jsx:1360-1362 |
| 5 | `resilience` | What if markets fall? | good-vs-bad **mini trajectory** (two-line spark) | Cashflow.jsx:1998 |
| 6 | `whatif` | What would change it most? | top-levers **bar** (relative impact composition) | Cashflow.jsx:1999 |
| 7 | `costs` | What's it costing? | cost-of-inaction **trajectory** or charges **composition bar** | Cashflow.jsx:1373-1375 |

Note: the spark machinery already exists (`MiniSparkline` at Cashflow.jsx:3468; ScenarioMatrix inline sparks; PoSChart). The gap is purely that `QuestionTile` was never given a `viz` slot. Cheapest fix: add an optional `viz` render-prop to QuestionTile and feed each tile a small spark/bar from data already computed in scope.

---

## Chart violations (Charting Standard)

1. **CF-DV-03 — Guyton-Klinger corridor:** unlabelled axes + **fabricated ±20% band** (hardcoded `*1.2`/`*0.8`, not engine uncertainty). Two violations: "both axes labelled with units" and "uncertainty as labelled scenario lines or a labelled band". HIGH.
2. **CF-DV-05 — Sequence-stress lines:** no y-axis / no £ scale; intermediate values unreadable. Violates "both axes labelled with units". MED.
3. **CF-DV-06 — Efficient Frontier:** axes present but jargon-only ("vol", "Expected return") — violates A5-in-chart. MED.
4. **Net-of-charges rate:** NOT stated on any projection chart (PoSChart, GK corridor, FundedRatioGauge, ScenarioMatrix). The standard requires "net-of-charges rate stated". The SWR picker shows a withdrawal rate but no chart states whether growth assumptions are gross or net of platform/fund charges. Cross-cutting MED — flag for the engine/copy layer.

(Total chart-grammar violations: 4 — 1 HIGH, 3 MED. Plus the net-of-charges omission spans all projection charts.)

---

## FCA / jargon issues count

- FCA: 1 borderline (CF-FCA-12, method "#1" emphasis) — LOW, defensible. Footers/disclaimers otherwise strong and pervasive.
- Jargon (A5) at surface layer: 6 distinct terms unexplained in place (funded ratio, sequence-of-returns, Guyton-Klinger/guardrails, SWR, Bengen/Morningstar/Vanguard, "vol"/"expected return"). See CF-PE-11 + CF-DV-04/06.
- Total FCA/jargon issues: **7** (1 FCA + 6 jargon families).

---

## Self-criticism coverage gate

- **Enumeration:** Every tile in the grid enumerated (7, all routed through one component) + every drawer chart reachable from a tile inspected (Sankey, waterfall, FundedRatioGauge, PoSChart, SequenceStressVis, GuytonKlinger, EfficientFrontier, ScenarioMatrix, MethodsComparison spark). Header answer-band copy also checked.
- **Not screenshotted:** This was a STATIC source audit (read-only, write to audit-findings only). Per CLAUDE.md §9.5, the sparkline-absence and axis-label findings should be confirmed in Preview MCP at 3 viewports × 2 themes before any fix is marked done — in particular Sankey node-label legibility on 375px (CF-DV-08) and whether GK/sequence charts clip without axes. Not done here (out of scope: read-only slice).
- **Assumptions:** Treated the 7-tile grid as "the tiles". If the founder counts only the 4 §B trajectory tiles as the "7 question-tiles", the finding is unchanged — those 4 are also plain QuestionTiles. The MiniSparkline-exists observation (CF-DV-09) is the strongest counter-evidence that the team CAN do tile sparks; I did not find it weakens the HIGH severity because it lives in a drawer, not a tile.
- **Confidence the tiles lack viz grammar: ~99%** — single shared component, no viz props, verified at definition + every call site. **Confidence on GK fabricated band: high** — band is literal arithmetic on the median, no engine input. **Confidence on net-of-charges omission: medium** — grepped chart components + SWR copy; did not trace the engine's growth-assumption provenance, so a net-of-charges statement could exist upstream in CMA copy not surfaced on the chart.
