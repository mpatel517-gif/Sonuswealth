# Cashflow — Pass 1 — Interaction & Drill-down Audit (A2 / A3 / A4)

**Auditor:** interaction-auditor
**Component:** `src/screens/Cashflow.jsx` (2,894 lines) + `src/components/Cashflow/*`
**Inventory:** `cashflow-inventory-v1.md` v1
**FDs honoured:** FD-NAME-1, FD-CROSS-1 (Cashflow owns £/month effect), FD-LOGO-1, FD-MASCOT-1, FD-CF-1.
**Out of scope here:** A1, A5, A6, severity escalation (orchestrator owns), reconciliation (engine auditor), domain mapping owner-detail (cross-screen auditor).

> Method: walked every onClick / state setter / route call from `Cashflow.jsx` and verified the destination is a real SOURCE / ACTION / DECISION landing — not a describe-only modal, no-op, or wrong-domain jump. Inconsistencies between sibling elements are also flagged.

---

## A2 / A3 / A4 verdict table

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|---|---|---|---|---|---|---|
| CF-CHR-01 | PASS | PASS | PASS | — | `onHome` wired to back chevron; lands on Home (Dashboard `goHome`). | `Cashflow.jsx:633` |
| CF-CHR-02 | NA | NA | NA | — | Static title "Cashflow". | `Cashflow.jsx:636` |
| CF-CHR-03 | **FAIL** | NA | **FAIL** | DEMO-BLOCKING | Toggle chip flips its own label `Simple view` ↔ `P&L view` but does **nothing else**. The only consumer of `accountantMode` is the legacy `CashflowWaterfall` (dead code per inventory S-05); the active waterfall (`CashflowWaterfallReconciled`) does not receive or read it. Tapping is a no-op from the user's perspective — describes a mode change that doesn't happen. A2 fails (drillable but no effect); A4 fails (no SOURCE/ACTION/DECISION). | state set `Cashflow.jsx:530, 638`; consumer at `Cashflow.jsx:1207, 1227` — never rendered; active waterfall call site `Cashflow.jsx:740` passes no `accountantMode`. |
| CF-CHR-04 | NA | NA | NA | — | Static disclaimer. | `Cashflow.jsx:866` |
| CF-ANCH-01 | PASS | PASS | PASS | — | `onNetWorthTap → onDrillMetric('netWorth')` → Dashboard `pushDetail` (SOURCE — net-worth detail). | `Cashflow.jsx:658`; `Dashboard.jsx:498` |
| CF-ANCH-02 | PASS | PASS | PASS | — | `onWealthTap → onDrillMetric('wealthScore')` (SOURCE — score breakdown). | `Cashflow.jsx:659` |
| CF-ANCH-03 | PASS | PASS | PASS | — | `onRiskTap → onOpenRisk` opens Risk overlay (SOURCE/ACTION on Risk screen). | `Cashflow.jsx:660`; `Dashboard.jsx:497` |
| CF-SUB-01 | **FAIL** | **FAIL** | **FAIL** | FUNCTIONAL | Sub-anchor "Capital Efficiency · PRC – PCC" is rendered as a **plain `<div>`** with no handler. Expected (per inventory) destination: SOURCE — PRC/PCC methodology. No tap target exists. Whole-card stub state still warrants a drill-to-methodology (or be hidden). | `Cashflow.jsx:924–942` |
| CF-PURP-01 / 02 | NA | NA | NA | — | Static copy. | `Cashflow.jsx:947–953` |
| CF-HERO-01 | NA | NA | NA | — | Static eyebrow. | `Cashflow.jsx:1051` |
| CF-HERO-02 | **FAIL** | NA | **FAIL** | FUNCTIONAL | Hero score number `health.total` is rendered but **not directly drillable** — no onClick on the `<Num>` or its container. Inventory expects SOURCE — health breakdown drill. The only path is via the small "Detail ›" chip (CF-HERO-04), which works — but the headline number itself is dead to tap, which is the natural target. | `Cashflow.jsx:1059–1061` |
| CF-HERO-03 | NA | NA | NA | — | Band chip is decorative; no drill expected by inventory. | `Cashflow.jsx:1062–1067` |
| CF-HERO-04 | PASS | PASS | PASS | — | "Detail ›" chip wires `setDrillView('health')` → `HealthScoreDrillPanel` (SOURCE). | `Cashflow.jsx:687–698` |
| CF-HERO-05 | NA | NA | NA | — | Conditional narrative caveat. | `Cashflow.jsx:1070–1081` |
| CF-HERO-06 | **FAIL** | PASS | **FAIL** | FUNCTIONAL | "Bill coverage" component row has no onClick. Inventory expects SOURCE — bill coverage detail. Only the parent "Detail ›" chip drills. Per drill-everywhere principle, the row should be tappable to its own detail. **Inconsistency:** the same components in `HealthScoreDrillPanel` likewise have no row-level drill — both are flat. | `Cashflow.jsx:1085–1088, 1097–1119`; drill panel `Cashflow.jsx:491–517` |
| CF-HERO-07 | **FAIL** | PASS | **FAIL** | FUNCTIONAL | Same — "Surplus ratio" row not tappable. Should drill to SOURCE (surplus breakdown) — note that whole-card drill *does* exist (waterfall "Breakdown ›") but the hero row doesn't reach it. | same as CF-HERO-06 |
| CF-HERO-08 | **FAIL** | PASS | **FAIL** | FUNCTIONAL | "Income resilience" row not tappable. Expected SOURCE — income resilience explainer. None exists; even in `HealthScoreDrillPanel` there's no per-component drill. | same as CF-HERO-06 |
| CF-HERO-09 | **FAIL** | **FAIL** | **FAIL** | DEMO-BLOCKING | "Funded ratio" row not tappable. Worse: when user clicks the hero's "Detail ›" chip to reach `HealthScoreDrillPanel`, that panel's `COMPONENTS` array is `[liquidityBuffer, surplus, debtManageability, incomeResilience, sequenceRisk]` — **does not include `fundedRatio`**. So the visible hero component "Funded ratio" is genuinely undrillable: row is dead AND the panel that should own its detail omits it entirely. (FD-CF-1 fix held *inside* ConfidenceIntervalSummary, but a parallel drill bug exists in `HealthScoreDrillPanel`.) | hero label set `Cashflow.jsx:982–991, 1029`; drill panel labels `Cashflow.jsx:427–433` |
| CF-HERO-10 | **FAIL** | PASS | **FAIL** | FUNCTIONAL | "Debt service ratio" row not tappable. Same structural issue. Drill panel uses label "Debt manageability" — label drift makes the link ambiguous even if a future drill is added. | `Cashflow.jsx:430, 1030` |
| CF-X28-01 | **FAIL** | PASS | **FAIL** | FUNCTIONAL | Confirmed S-01. `Cashflow.jsx:528` initializes `windowId = 'current-tax-year'`, but `X28TopBar.TIME_WINDOWS[*].id` are `current-period … lifetime`. X28TopBar's validator at lines 82–86 drops unknown ids; `current` falls back to `'current-period'`. Result: user sees the topbar in its default state regardless of the parent's intent, and the value passed back via `onWindowChange` will not equal the initial. Drillable (it does select windows once user clicks), but the **initial state is silently desynced**. | `Cashflow.jsx:528`; `X28TopBar.jsx:50–51, 82–86, 112` |
| CF-X28-02 | PASS | PASS | PASS | — | View-mode pills toggle `viewMode`; container is keyed `${viewMode}::${windowId}` (line 720) so the re-render fires. | `Cashflow.jsx:706, 720` |
| CF-X28-03 | **FAIL** | **FAIL** | **FAIL** | POLISH | Inventory marks `onNowTap` as optional; Cashflow does not wire one. So the "Now" pill (if rendered by X28TopBar) is non-interactive on this screen — no SOURCE for rules version. | `Cashflow.jsx:704–709` (no onNowTap prop) |
| CF-X28-04 | PASS | PASS | PASS | — | X28TopBar's internal `defaultMode` per window changes `viewMode` via `onViewModeChange`; honoured by parent setState. | `X28TopBar.jsx` `defaultMode` field |
| CF-SEED-01 / 02 / 03 | PASS | PASS | PASS | — | Banner renders only when `viewMode==='scenario' && activeSeed`; deltas read from `seed` object; Clear/dismiss clears `activeSeed`. Real handler chain. | `Cashflow.jsx:88–141, 540–545, 714–716` |
| CF-DELIM-A / B / C | NA | NA | NA | — | Static delimiters. | `Cashflow.jsx:725, 783, 832` |
| CF-WAT-01 / 03–07 | **FAIL** | PASS | **FAIL** | FUNCTIONAL | Waterfall step rows (gross, tax, pension, essentials, debt) are SVG/HTML segments inside `CashflowWaterfallV2` with no per-step onClick — none of them drill individually. Inventory expects per-step SOURCE (income breakdown, T&E tax detail, MyMoney pension, MyMoney debt). Whole-card "Breakdown ›" chip works, but step-level drill is missing; per FD-CROSS-1 each step ought to land on its owning surface. | `CashflowWaterfall.jsx`; orchestrator `Cashflow.jsx:740–754` |
| CF-WAT-02 | **FAIL** | PASS | **FAIL** | FUNCTIONAL | Hero "Surplus" value inside V2 waterfall not directly tappable. Card-level drill via "Breakdown ›" exists. Same pattern: number is the natural drill target but isn't wired. | `Cashflow.jsx:740` |
| CF-WAT-08 | PASS | PASS | PASS | — | "Breakdown ›" chip → `setDrillView('surplus')` → `SurplusDrillPanel` (hero £/mo, waterfall bars, allocator, liquidity context — coherent SOURCE). | `Cashflow.jsx:742–754`; panel `Cashflow.jsx:143–316` |
| CF-WAT-09 | **FAIL** | **FAIL** | **FAIL** | FUNCTIONAL | Empty-state copy implies a "+ Income" CTA that doesn't exist on Cashflow. Copy is text-only — no affordance to land on. Per FD-CROSS-1, MyMoney is the doing-surface for adding income; the copy must hand off explicitly (label + tap target). | `CashflowWaterfall.jsx` empty branch |
| CF-ED-01 / 02 / 03 | NA | NA | NA | — | EssentialsDiscretionarySplit hero %, bar, line — no onClick; per inventory should drill to SOURCE — essentials breakdown, but none exists. Marking NA-as-A2 because inventory column for ED-01 is SOURCE expected; treating as **A3 FAIL** (no destination wired) — POLISH severity since the data is shown alongside, not gated behind, the missing drill. | `Cashflow.jsx:1288–…` |
| CF-BILL-01 / 02 | **FAIL** | **FAIL** | **FAIL** | FUNCTIONAL | BillCalendar card and 28-day grid cells have no onClick. Inventory expects SOURCE — bill detail. Cells visually pulse but are dead taps. | `Cashflow.jsx:1329–…` |
| CF-SUB-01b | **FAIL** | **FAIL** | **FAIL** | FUNCTIONAL | SubscriptionTracker card-level — no drill to subscription detail; only the dead "+ Add manually" CTA below. | `Cashflow.jsx:1381–…` |
| CF-SUB-02 | **FAIL** | NA | **FAIL** | FUNCTIONAL | Confirmed S-10. `onClick` is `console.info` only, no user-visible result, no aria-live, no route. Button performs no ACTION. Honest label ("coming next") softens the severity vs DEMO-BLOCKING but it's still a dead CTA. | `Cashflow.jsx:1417–1438` |
| CF-ALLOC-01 / 02 | NA | NA | NA | — | Allocator card and rows render data only; not expected to drill. | `Cashflow.jsx:1444–…` |
| CF-ALLOC-03 | **FAIL** | NA | **FAIL** | FUNCTIONAL | Confirmed S-10. Per-priority "Set up" button `onClick` is `console.info` only. No standing-order flow, no route. Same dead-CTA pattern as CF-SUB-02. | `Cashflow.jsx:1499–1517` |
| CF-LB-01 | **FAIL** | **FAIL** | **FAIL** | FUNCTIONAL | LiquidityBufferCard hero (months × emoji band) — no onClick. Inventory expects SOURCE — liquidity detail. | `Cashflow.jsx:1538–…` |
| CF-LB-02 / 03 / 04 | NA | NA | NA | — | Decorative sub-rows of LB card. | same |
| CF-INC-01 | NA | NA | NA | — | Eyebrow text. | `Cashflow.jsx:1607+` |
| CF-INC-02 | **FAIL** | **FAIL** | **FAIL** | FUNCTIONAL | Income-by-source rows are rendered but each row is a `<div>` with no onClick. Inventory expects per-source SOURCE drill. Only the whole-card "Breakdown ›" chip works (CF-INC-03). | `Cashflow.jsx:1607+` |
| CF-INC-03 | PASS | PASS | PASS | — | "Breakdown ›" chip → `setDrillView('income')` → `IncomeBreakdownDrillPanel` (sources list, totals, footer — coherent SOURCE). | `Cashflow.jsx:766–777`; panel `Cashflow.jsx:322–419` |
| CF-INC-04 | NA | NA | NA | — | Eyebrow. | — |
| CF-INC-05 | **FAIL** | **FAIL** | **FAIL** | FUNCTIONAL | Tax-band rows render no onClick. Per FD-CROSS-1 and inventory, band detail itself owns to Tax & Estate; rows should route to T&E. None do. | `Cashflow.jsx:1709+` |
| CF-GS-01 | NA | NA | NA | — | Eyebrow text. | `Cashflow.jsx:2312` |
| CF-GS-02 | PASS | NA | NA | — | Slider sets local `target`. Real handler. | `Cashflow.jsx:2321–2326` |
| CF-GS-03 | PASS | PASS | PASS | — | "Find paths" button runs `goalSeek()` and commits target — DECISION-grade. Disabled state honest. | `Cashflow.jsx:2300–2348` |
| CF-GS-04 | **FAIL** | **FAIL** | **FAIL** | FUNCTIONAL | Goal-Seek path rows render `humanise(p.action.kind)` + amount + gap, but the rows are `<div>` with no onClick — per inventory they should commit to a scenario (DECISION). Without a tap target, the user sees suggestions they can't activate. | `Cashflow.jsx:2362–2378` |
| CF-GS-05 | NA | NA | NA | — | Empty state copy. | `Cashflow.jsx:2380–2384` |
| CF-SWR-01 / 03 | NA | NA | NA | — | Display rows. | `Cashflow.jsx:1782+` |
| CF-SWR-02 | PASS | NA | NA | — | Each regime pill wires `onClick → onChange(r.id)` → updates `swrRegime` state. Stub regimes (`prc_anchored`, `custom`) honestly show "Coming next" / Bengen fallback notice — A4-honest. | `Cashflow.jsx:1800–1811` |
| CF-FUND-01 | **FAIL** | **FAIL** | **FAIL** | FUNCTIONAL | FundedRatioGaugeV2 gauge — no onClick on the SVG or value. Inventory expects SOURCE — funded-ratio components. No drill. | call site `Cashflow.jsx:799–803` |
| CF-FUND-02 | PASS (display) | NA | NA | — | FD-CF-1 verified: status badge derived from `ratio`, not `confidence`. (A6 / reconciliation owner verifies values; interaction passes.) | `FundedRatioGauge.jsx`; `Cashflow.jsx:2660–2667` |
| CF-FUND-03 | NA | NA | NA | — | Confidence overlay caption — display only. | `Cashflow.jsx:801` |
| CF-FUND-04 | NA | NA | NA | — | Optional context line. | — |
| CF-FI-01 | **FAIL** | **FAIL** | **FAIL** | FUNCTIONAL | FiProgressTile hero % — no onClick. Inventory expects SOURCE — FI target detail. None. | `Cashflow.jsx:1906+` |
| CF-FI-02 / 03 | NA | NA | NA | — | Echo lines. | — |
| CF-POS-01 | **FAIL** | **FAIL** | **FAIL** | FUNCTIONAL | PoSHeadline hero % — no onClick. Inventory expects SOURCE — PoS methodology + paths. None. | `Cashflow.jsx:1938+` |
| CF-POS-02 / 03 / 04 | NA | NA | NA | — | Sub-lines, terminal-value tiles, stub note — display only. | — |
| CF-POSC-01 to CF-POSC-05 | NA | NA | NA | — | PoSChartV2 chart panel — display only per inventory; no drill expected on chart itself. (Mock-fallback risk is A6, not interaction.) | `PoSChart.jsx`; call site `Cashflow.jsx:806–812` |
| CF-SEQ-01 to CF-SEQ-04 | NA | NA | NA | — | SequenceStressVisV2 — display. | `Cashflow.jsx:813–817` |
| CF-GK-01 to CF-GK-04 | NA | NA | NA | — | GuytonKlingerCorridor — display. | `Cashflow.jsx:818, 2125+` |
| CF-SCEN-01 | NA | NA | NA | — | Header. | — |
| CF-SCEN-02 | PASS | PASS | PASS | — | Scenario row buttons wire `onSelect(id) → setActiveId(id)` (`ScenarioMatrixWithRecompute`). Picking a scenario re-renders `ScenarioForwardSummary` → DECISION-grade landing. | `Cashflow.jsx:2235–2253` |
| CF-SCEN-03 / 04 / 05 / 06 | NA | NA | NA | — | Forward summary tiles + disclaimer — display. (Mock-fallback for missing engine output is A6.) | `Cashflow.jsx:2256–2286` |
| CF-COI-01 | **FAIL** | **FAIL** | **FAIL** | FUNCTIONAL | CoIOdometerWithHalo total renders but the wrapper does not wire a tap to Tax & Estate CoI breakdown. Per FD-CROSS-1, canonical CoI owns to T&E; Cashflow's cash-effect angle should still drill to **its own** cash-effect detail (none) or hand off explicitly to T&E (none). Whole odometer is non-interactive on this screen. | `Cashflow.jsx:2391–2410` |
| CF-COI-02 | NA | NA | NA | — | Cascade-halo behaviour — purely visual. | `Cashflow.jsx:2393` |
| CF-COI-03 | NA | NA | NA | — | byAction rows internal to CoIOdometer — not wired from Cashflow. | — |
| CF-COIV-01 / 02 | NA / **FAIL** | NA / **FAIL** | NA / **FAIL** | POLISH | Variants card and rows — no per-row drill to variant methodology (inventory expects SOURCE per row). | `Cashflow.jsx:2411+` |
| CF-PRC-01 | **FAIL** | **FAIL** | **FAIL** | FUNCTIONAL | PrcPccStubCard renders "Coming next" — no drill to methodology even as a stub. Same orphan pattern as CF-SUB-01. | `Cashflow.jsx:2453+, 845` |
| CF-RE-01 / 02 / 03 | **FAIL** | **FAIL** | **FAIL** | FUNCTIONAL | RealityEngineStubCard — no drill to methodology. | `Cashflow.jsx:2505+, 846` |
| CF-MDD-01 | **FAIL** | **FAIL** | **FAIL** | FUNCTIONAL | MaxDrawdownCard severity chip + tiles — no drill to drawdown tolerance detail. | `Cashflow.jsx:2557+, 847` |
| CF-MDD-02 | NA | NA | NA | — | Empty state. | — |
| CF-EFF-01 / 02 / 03 | NA | NA | NA | — | EfficientFrontierV2 — display. (Mock fallback = A6.) | `Cashflow.jsx:848–853` |
| CF-FID-01 | **FAIL** | **FAIL** | **FAIL** | POLISH | FiProgressDepthCard 4-tile grid — no drill. Plus duplicates CF-FI-* (label-drift / reconciliation = A6). | `Cashflow.jsx:2632+, 854` |
| CF-CONF-01 to CF-CONF-04 | **FAIL** | **FAIL** | **FAIL** | POLISH | ConfidenceIntervalSummary rows are `<div>` with no onClick; inventory expects per-row SOURCE drill (health, funded ratio, PoS, CoI confidence detail). None. (Note: the FD-CF-1 *content* fix is intact — status derived from ratio, not confidence.) | `Cashflow.jsx:2655–2700` |
| CF-FOOT-01 / 02 | NA | NA | NA | — | Static footer. | `Cashflow.jsx:865–868` |
| CF-OVL-S-01 | PASS | PASS | PASS | — | SurplusDrillPanel back button → `onClose` returns. | `Cashflow.jsx:197–207` |
| CF-OVL-S-02 to S-06 | NA | NA | NA | — | Display rows inside panel (hero, waterfall bars, allocator rows, buffer card, footer). | `Cashflow.jsx:215–313` |
| CF-OVL-I-01 | PASS | PASS | PASS | — | Income panel back button. | `Cashflow.jsx:322+` |
| CF-OVL-I-02 / 03 / 04 | NA | NA | NA | — | Panel display rows. | — |
| CF-OVL-H-01 | PASS | PASS | PASS | — | Health panel back button. | `Cashflow.jsx:453–459` |
| CF-OVL-H-02 | NA | NA | NA | — | Total + band display. | `Cashflow.jsx:470–484` |
| CF-OVL-H-03 | **FAIL** | **FAIL** | **FAIL** | DEMO-BLOCKING | Health panel component rows are `<div>` (no onClick), AND the panel renders only `[liquidityBuffer, surplus, debtManageability, incomeResilience, sequenceRisk]` — **missing `fundedRatio` and `debtServiceRatio`** which the hero displays. Labels also drift between hero and panel (`Bill coverage` vs `Liquidity buffer`; `Debt service ratio` vs `Debt manageability`). Same surface, two component vocabularies, no row-drill. | hero `Cashflow.jsx:982–991`; panel `Cashflow.jsx:427–433, 491–517` |
| CF-OVL-H-04 | NA | NA | NA | — | Caption text. | — |
| CF-OVL-H-05 | NA | NA | NA | — | Footer disclaimer. | — |

---

## A4 incoherence — landing types per dead drill

For every FAIL above, the missing landing is what the inventory expects:

- **SOURCE missing** (28 elements): all hero / chart / methodology numbers that show a result without a way to see how it was derived. Most acute: CF-HERO-09 funded-ratio (drill panel omits it entirely), CF-COI-01 (FD-CROSS-1 violation — no hand-off to T&E from cash-effect angle), CF-FUND-01 (the gauge is the visual hero of Section B and is dead-tap).
- **ACTION missing** (CF-SUB-02, CF-ALLOC-03): buttons that look like ACTIONs but are `console.info` only. Honest label is not a substitute for the affordance.
- **DECISION missing** (CF-GS-04): solver returns "do X to reach target Y" but rows aren't tappable to commit. Goal-Seek button itself works (CF-GS-03 PASS), so the chain is broken at the last step.
- **HAND-OFF missing** (CF-WAT-04, CF-WAT-05, CF-WAT-07, CF-INC-05, CF-COI-01): per FD-CROSS-1, these should route to their owner surfaces (T&E for tax, MyMoney for pension/debt). None do; the implied cross-screen drill is described but not wired.

---

## Cross-element inconsistency flags

1. **Hero rows vs Detail-chip drill** — CF-HERO-06 through CF-HERO-10 sit immediately above a "Detail ›" chip. User tries to tap a row, nothing happens; user tries to tap the chip, drill opens. Affordance is hidden. Whole-card-drill is the prevailing pattern on Cashflow; combined with rows that look like data buttons (with bars and contributions), this misleads.
2. **Hero label set vs HealthScoreDrillPanel label set** — confirmed S-08. Two vocabularies (`Bill coverage / Surplus ratio / Income resilience / Funded ratio / Debt service ratio` vs `Liquidity buffer / Surplus ratio / Debt manageability / Income resilience / Sequence resilience`) and a missing component (`fundedRatio`) — interaction-relevant because the user clicks "Detail ›" expecting to see the same five rows expanded, and instead lands on a different list.
3. **X28 topbar window-id mismatch** — confirmed S-01. Initial-render state in Cashflow uses an obsolete id; topbar drops it silently.

---

## Severity rollup (proposed; orchestrator owns final)

- **DEMO-BLOCKING (4):** CF-CHR-03 (toggle is a lie), CF-HERO-09 (Funded ratio drill silently missing in panel), CF-OVL-H-03 (panel doesn't match hero — drift demoable).
- **FUNCTIONAL (26):** all hero-row / waterfall-step / breakdown-row / card-hero dead-taps + CF-X28-01 + CF-SUB-02 + CF-ALLOC-03 + CF-GS-04 + CF-COI-01 + CF-SUB-01 + CF-PRC-01 + CF-RE-01 + CF-MDD-01 + CF-WAT-09 + CF-FUND-01 + CF-FI-01 + CF-POS-01 + CF-BILL-01 + CF-LB-01 + CF-INC-02 + CF-INC-05.
- **POLISH (5):** CF-X28-03 (optional onNowTap), CF-ED-01, CF-COIV-01/02, CF-FID-01, CF-CONF-01..04.

---

## Coverage

- Rows in inventory v1: 102 (Regions 1–11).
- Rows verdicted in this pass: 102 of 102 (100%).
- Interactive/data-bearing rows tested non-NA: 56.
- PASS: 21. FAIL: 35. NA: 46.
- (Counts include sub-rows treated as a single verdict line where the inventory groups them, e.g. CF-FOOT-01/02.)

---

## RETURN

**CF interaction: 21 PASS, 35 FAIL (4 DB, 26 F, 5 P).**
