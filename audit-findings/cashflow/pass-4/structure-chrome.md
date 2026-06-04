# Cashflow Tab — Pass 4 Audit · STRUCTURE, CHROME & DEAD CONTROLS

**Scope:** every interactive / nav / structural element on the Cashflow tab. Read-only audit.
**Build read:** `src/screens/Cashflow.jsx` (4662 lines), `src/components/shared/X28TopBar.jsx`, `src/components/Cashflow/*`.
**Spec:** `2-Product/2-Product-cashflow-v1_7.md` (intent reference; build is structural truth).
**Date:** 2026-06-04

Assertions: A1 Identified · A2 Drillable · A3 Destination correct · A4 Destination coherent (real SOURCE/ACTION/DECISION) · A5 Plain English · A6 Reconciled.
`✓` pass · `✗` fail · `~` partial · `n/a` not applicable.

---

## Element enumeration + assertions

| ID | A1 | A2 | A3 | A4 | A5 | A6 | Severity | Finding | Evidence |
|----|----|----|----|----|----|----|----------|---------|----------|
| C-01 Header "Back" | ✓ | ✓ | ✓ | ✓ | ✓ | n/a | — | Back routes to prev screen or Home (goBackOrHome). Clean. | Cashflow.jsx:1227 |
| C-02 Header title "Cashflow" | ✓ | n/a | n/a | n/a | ✓ | n/a | — | Static label, correct. | Cashflow.jsx:1235 |
| C-03 Header right slot | ✓ | n/a | n/a | n/a | n/a | n/a | — | P&L toggle removed (founder 2026-06-04); now a 1px spacer. No dead chrome remains. | Cashflow.jsx:1236-1240 |
| C-04 X28TopBar window-row | ✓ | n/a | n/a | n/a | ✓ | n/a | — | `showWindowRow={false}` — tax-year/rules/NOW row intentionally hidden to avoid dup with global header. Dedup correctly applied. | Cashflow.jsx:1270; X28TopBar.jsx:171 |
| C-05 viewMode "Today" (actual) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | Default mode; renders live now/trajectory content. Real. | Cashflow.jsx:1014,1267 |
| C-06 viewMode "Future" (forecast) | ✓ | ~ | ✗ | ✗ | ✓ | n/a | **DEMO-BLOCKING** | NO-OP: tab toggles but content does not branch — shows today's figures + "(coming soon)" chip. A primary nav control that changes nothing. | Cashflow.jsx:1011-1013,1319 |
| C-07 viewMode "Plan" (plan) | ✓ | ~ | ✗ | ✗ | ✓ | n/a | **DEMO-BLOCKING** | NO-OP: same as Future — toggles, shows today's figures + "plan-vs-actual isn't on this tab yet (coming soon)". Dead primary nav. | Cashflow.jsx:1011-1013,1320 |
| C-08 viewMode "What if" (scenario) | ✓ | ~ | ~ | ~ | ✓ | n/a | FUNCTIONAL | Only branches when a scenarioSeed lands from another screen (shows ScenarioSeedBanner). Tapping the tab directly with no seed = same content as Today, no scenario affordance surfaces. Half-wired. | Cashflow.jsx:1025-1030,1302-1304 |
| C-09 viewMode context chip | ✓ | n/a | n/a | n/a | ✓ | n/a | POLISH | Honest "(coming soon)" disclosure for Future/Plan. Acceptable stopgap but advertises that 2 of 4 modes are dead. Remove when modes branch. | Cashflow.jsx:1308-1322 |
| C-10 Life-stage chip "Auto" | ✓ | ✓ | ✓ | ✓ | ✓ | n/a | — | Real: clears override → engine re-infers; "detected: …" hint shows. | Cashflow.jsx:2097,2100-2104 |
| C-11 Life-stage chip "Building wealth" | ✓ | ✓ | ✓ | ✓ | ✓ | n/a | — | Commits PREFERENCE_SET → entity.preferences.lifeStageOverride; inferLifeStage/inferBranch read it → hero + tiles flip on refold. Verified live path. | Cashflow.jsx:2081,2098 |
| C-12 Life-stage chip "Drawing income" | ✓ | ✓ | ✓ | ✓ | ✓ | n/a | — | As C-11, sets 'decumulator'. PurposeStatement + sustain/drawdown tiles re-derive from same entity. | Cashflow.jsx:2099,1612-1613 |
| C-13 Hero PurposeStatement Lens A | ✓ | ✗ | n/a | n/a | ✓ | ~ | FUNCTIONAL | Two-lens hero reads well but is NOT drillable — no tap target on the hero number (memory: "hero numbers don't drill"). tieout keys present (cashflow.hero.plan/fi) but no on-tap handler. | Cashflow.jsx:1635-1645,1710 |
| C-14 Hero PurposeStatement Lens B | ✓ | ✗ | n/a | n/a | ✓ | ~ | FUNCTIONAL | Same as C-13 — static read, no drill. Funded% / PoS% shown but not tappable to the resilience tile that owns them. | Cashflow.jsx:1649-1660,1711 |
| C-15 Tile "Am I OK right now?" (now) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | Opens overlay → Sankey + waterfall + splits + income. msNet = surplus−deficit ties to Home. Real, deep. | Cashflow.jsx:1351-1358,1164-1209 |
| C-16 "now" overlay → "Breakdown ›" (surplus) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | Opens SurplusDrillPanel — income→deductions waterfall w/ L4 DrillableNumber chaining. Real ACTION/SOURCE. | Cashflow.jsx:1174-1186,196 |
| C-17 "now" overlay → "Breakdown ›" (income) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | Opens IncomeBreakdownDrillPanel w/ by-tax-band L4 drill. Real. | Cashflow.jsx:1194-1205,448 |
| C-18 SubscriptionTracker "+ Add manually" | ✓ | ✗ | ✗ | ✗ | ~ | n/a | **DEMO-BLOCKING** | DEAD CONTROL: button onClick only `console.info()`s — no route, no modal, no entry. Labeled "(coming next)" but it is a tappable button that does nothing visible. | Cashflow.jsx:2341-2365 |
| C-19 SubscriptionTracker card | ✓ | ✗ | n/a | ~ | ✓ | ✓ | POLISH | Read-only; empty for personas with no `subscriptions[]`. Honest "coming soon" chip. No detection path yet (Open Banking Phase 1.2). | Cashflow.jsx:2309-2340 |
| C-20 SurplusAllocator | ✓ | ✗ | n/a | ~ | ✓ | ✓ | POLISH | Static priority list of where to put surplus; no per-row action/drill. Reads recommendedSurplusAllocation. Describe-only. | Cashflow.jsx:2372,1190 |
| C-21 LiquidityBufferCard | ✓ | ✗ | n/a | ~ | ✓ | ✓ | POLISH | Static read of liquidityBuffer months. No drill. | Cashflow.jsx:2468,1191 |
| C-22 IncomeBySourceCard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | Has its own "Breakdown ›" → income drill (C-17). | Cashflow.jsx:2540,1192-1206 |
| C-23 EssentialsDiscretionarySplit | ✓ | ✗ | n/a | ~ | ✓ | ~ | POLISH | Static bar vs ONS cohort median (hardcoded 58, sourced). No drill into category breakdown (no category list exists — see C-37). | Cashflow.jsx:2214,1188 |
| C-24 IncomeBreakdownByBand | ✓ | ✗ | n/a | ~ | ✓ | ✓ | POLISH | Static read of by-tax-band income. Not tappable (the band drill lives only in the income overlay). | Cashflow.jsx:2642,1207 |
| C-25 Tile "Will my money last?" (lastability) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | Adaptive (decum: "To age N"; accum: "% to FI"). Opens FundedRatioGauge + SwrPicker + FiProgress. Real. | Cashflow.jsx:1969-1973,2020-2024 |
| C-26 lastability → SwrRegimePicker "Bengen" | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | Drives the gauge (swrRegime threaded to fundedRatio — prior dead-control fixed). Real. | Cashflow.jsx:2022,1082 |
| C-27 lastability → SwrRegimePicker "PRC-anchored" | ✓ | ~ | ✗ | ✗ | ✓ | ✗ | FUNCTIONAL | STUB: not engine-backed — silently returns Bengen rate. Honestly chipped "Coming next" + note, but tapping it does not change the SWR. | Cashflow.jsx:2721-2725,2753-2758 |
| C-28 lastability → SwrRegimePicker "Custom" | ✓ | ~ | ✗ | ✗ | ✓ | ✗ | FUNCTIONAL | STUB: as C-27 — falls back to Bengen, no custom-rate input. Dead option dressed as a choice. | Cashflow.jsx:2725,2753-2758 |
| C-29 lastability → FundedRatioGaugeV2 | ✓ | ✗ | n/a | ✓ | ✓ | ✓ | POLISH | Reads fundedRatio(entity,{swrRegime}). Visual only, no tap-drill into the gap math. | Cashflow.jsx:2021 |
| C-30 lastability → FiProgressTile | ✓ | ✗ | n/a | ✓ | ✓ | ✓ | POLISH | Static FI multiple read. No drill. | Cashflow.jsx:2023,2847 |
| C-31 Tile "Where my income comes from" (drawdown) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | Decum-only; gated on rankedPaths (avoids empty-drawer bug). Opens ScenarioMatrixWithRecompute. Real. | Cashflow.jsx:1988-1994,2025 |
| C-32 Tile "What if markets fall?" (resilience) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | Opens SequenceStressHero + PoS fan + sequence vis + GK corridor. Real, engine-fed. | Cashflow.jsx:1998,2026-2040 |
| C-33 Tile "What would change it most?" (whatif) | ✓ | ✓ | ✓ | ✗ | ~ | ~ | FUNCTIONAL | A4 MISMATCH: tile headline "Top levers" / sub "what-if & goal-seek" but content is GoalSeekCard which goal-seeks to a target **Wealth Score** (a Home/score metric), not a cashflow lever-sensitivity view. Question asked ≠ answer delivered; arguably wrong subject for Cashflow. | Cashflow.jsx:1999,2041,4055-4060 |
| C-34 whatif → GoalSeek slider + "Find paths" | ✓ | ✓ | ~ | ~ | ✓ | ~ | FUNCTIONAL | Slider + button are live (re-runs goalSeek). But target is Wealth Score, and rows show generic action kinds/amounts — borders on advice framing ("Increase pension by £X"). Subject belongs to Home score, not Cashflow. | Cashflow.jsx:4084-4148 |
| C-35 Tile "How fast can I spend?" (methods) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | Decum-only. Drawer-rows → per-method MethodDetail with live sliders + back-solve. Genuinely interactive (best surface on the tab). | Cashflow.jsx:1360-1371,3608,3503 |
| C-36 methods → MethodDetail sliders/back-solve | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | Pot / draw / growth sliders + "make it last to age" back-solver all recompute methodPath live. Real ACTION. | Cashflow.jsx:3513-3559 |
| C-37 Tile "What's it costing?" (costs) | ✓ | ✓ | ✓ | ✓ | ~ | ✓ | POLISH | Opens EngineInternalsReveal (alwaysOpen) — CoI + PRC/PCC + Reality Engine + MDD + EF. Engineer-jargon density high for a top-level tile; CoI total ties to totalCoI. | Cashflow.jsx:1373-1375,1400 |
| C-38 Story-banner / Health hero | ✓ | n/a | n/a | n/a | ✓ | n/a | — | Cashflow Health Score hero + heatmap REMOVED (founder 2026-06-04). Documented, not orphaned in tree. | Cashflow.jsx:1289-1298 |
| C-39 MoneyXDrawer statement strip | ✓ | n/a | n/a | n/a | n/a | n/a | — | REMOVED (founder 2026-06-04) — was dup cross-statement nav. Correctly gone. | Cashflow.jsx:1253-1259 |
| C-40 Disclaimer footer | ✓ | n/a | n/a | n/a | ✓ | ✓ | — | FCA disclaimer + rules/CMA version stamp. Correct. | Cashflow.jsx:1383-1386 |
| C-41 ScenarioSeedBanner "Clear" | ✓ | ✓ | ✓ | ✓ | ✓ | n/a | — | Dismisses active seed. Real. | Cashflow.jsx:175-185,1303 |

### Missing structural elements (spec §1.7 / §2.1 vs build)

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| C-42 Bill calendar | ✗ in tree | **FUNCTIONAL** | `BillCalendar` component is DEFINED but NEVER MOUNTED — not in nowSectionContent nor any tile. Orphaned dead code. Spec §2.1 + §4.6 require it in Section A. (Memory: "bill calendar on Timeline" — but spec still lists it here; if intentionally moved, delete the orphan + note.) | Cashflow.jsx:2257 (def); absent from 1164-1209 render |
| C-43 Expense categories list | ✗ | **FUNCTIONAL** | Spec §2.1 Section A "Expense categories list" has NO component at all. EssentialsDiscretionarySplit (C-23) shows a 2-way split but no per-category breakdown. Gap. | spec §2.1 line 224; no match in Cashflow.jsx |
| C-44 Monthly seasonality heatmap | n/a | POLISH | `CashflowCalendarHeatmap` + `CashflowMoneySankey`-adjacent heatmap DEFINED but NOT MOUNTED (removed for placeholder-data honesty, line 1296). Orphaned code; delete to avoid drift. | Cashflow.jsx:886 (def); not rendered |
| C-45 Income timeline / "when things change" | ✗ | FUNCTIONAL | No income-over-time / life-events timeline tile. A real retirement cashflow tool shows when state pension starts, DB kicks in, mortgage ends. Not in spec §1.7 explicitly but a known category gap; partially deferred to Timeline tab. | n/a (absent) |
| C-46 Tax-over-time view | ✗ | FUNCTIONAL | No year-by-year tax projection tile. The "costs" tile shows CoI/charges but not forward tax drag across drawdown years (MethodDetail table shows draw/pot, not tax). Known gap. | n/a (absent) |

---

## Severity roll-up

- **DEMO-BLOCKING (3):** C-06 Future no-op, C-07 Plan no-op, C-18 Subscription "Add manually" dead button.
- **FUNCTIONAL (9):** C-08 scenario half-wired, C-13/C-14 hero not drillable, C-27/C-28 SWR stubs, C-33/C-34 whatif wrong-subject, C-42 Bill calendar orphaned, C-43 expense-categories missing, C-45 income-timeline missing, C-46 tax-over-time missing. *(C-13/C-14 counted as one pair → 9 distinct.)*
- **POLISH (10+):** C-09, C-19, C-20, C-21, C-23, C-24, C-29, C-30, C-37, C-44.

---

## Self-criticism gate — what I did NOT verify

1. **Runtime, not just static.** I did not run the dev server / Preview MCP. The no-op verdicts on C-06/C-07 are from code (content is gated only by `viewMode !== 'actual'` showing a chip, with no per-mode branch in the tile tree) — high confidence, but a runtime snap at each mode × theme would confirm nothing else branches.
2. **Numeric tie-outs not executed.** I reasoned msNet/CoI reconciliation from code comments, not a live `preview_eval` DOM scrape (CLAUDE.md §9.5 Gate 2). A second auditor should tie out: hero target = secure + pots; Sankey gross = waterfall gross = Home surplus; CoI tile total = totalCoI().
3. **Component-internal files unread.** I did not open `src/components/Cashflow/*` (FundedRatioGauge, PoSChart, ScenarioMatrix, CashflowWaterfall, SequenceStressVis, EfficientFrontier V2). They could harbor their own dead controls or hardcoded fallbacks inside the overlays.
4. **Sub-components past line 2780 only sampled.** GuytonKlingerCorridor, SequenceStressHero, ScenarioMatrixWithRecompute, FundedRatioGauge (local), CfCoiVariantsCard, Reality/MDD/EF cards (lines ~2780–4055, 4173+) read by name/grep only — a second pass should enumerate each control inside the resilience + drawdown + costs overlays as its own row.
5. **Whether Bill calendar was deliberately relocated.** Memory says bill calendar belongs on Timeline; spec §2.1 still lists it on Cashflow. I flagged the orphan but did NOT confirm the founder's current intent — could be "delete orphan" not "wire it back."
6. **Accumulator vs decumulator coverage.** I traced the decumulator path (methods/drawdown tiles appear). I did not verify against an accumulator persona that the gated tiles (drawdown, methods) correctly hide AND that no empty overlay is reachable — a second auditor should load both persona shapes.
7. **A second auditor might catch:** keyboard/focus traps on the fixed-overlay tiles (zIndex 500/600 stacking; Back button focus on open); whether the `key={viewMode::windowId}` remount drops scroll position or re-fires heavy MC memos on every window change (perf); and whether the "costs" tile's engineer jargon (PRC/PCC, Reality Engine) violates the macOS "internal codes never at top layer" principle at the tile's first-open depth.
