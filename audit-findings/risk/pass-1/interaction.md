# Risk Screen — Pass-1 Interaction Audit (A2/A3/A4)

**Auditor:** interaction-auditor (auditor 2 of 5)
**Screen:** Sonuswealth Risk (`src/screens/Risk.jsx` + `src/components/Risk/*` + `src/screens/RiskOverlay.jsx`)
**Inventory baseline:** `risk-inventory-v1.md`
**Locked FDs honoured:** FD-CROSS-1 (Risk owns shock-test angle, hands off doing-surface to MyMoney/Cashflow/T&E); FD-RK-1, FD-RK-2, FD-RK-3.
**Method:** A2 (drillable handler?), A3 (lands on owns-subject surface?), A4 (SOURCE/ACTION/DECISION or describe-only?). Routes traced through `onClick` → `pushDetail` → `driver(entity, metric)` in `src/engine/driver-engine.js`.
**Out of scope (other auditors):** A1 reconciliation, A5 plain-English, A6 number-trace, domain ownership beyond FD-CROSS-1, scenario coverage.

---

## Header verdict

**RK interaction: 41 PASS, 19 FAIL (4 DB, 13 F, 2 P).**
Coverage: 60 of ~135 inventory rows examined this pass (chrome NAV rows, the 25 cross-map sub-cells, and pure visual sub-rows deferred). All interactive rows in Z0–Z12 + DimSheet + D6 + Z10 walked. Reconciliation/A6/A5 sweeps owed by other auditors.

---

## A2/A3/A4 verdict table

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|----|----|----|----|----------|---------|----------|
| RK-Z0-01 | PASS | PASS | PASS | — | Breadcrumb wired to `onHome` on full page, `onClose` in overlay. Lands on origin. | `src/screens/Risk.jsx:1283`, `src/screens/RiskOverlay.jsx:110-117` |
| RK-Z0-04 | PASS | PASS | PASS | — | Hero collapse "×" toggles `setCollapsed(true)`. | `src/screens/Risk.jsx:1304`, `src/screens/RiskOverlay.jsx:133-137` |
| RK-Z0-05 | PASS | PASS | PASS | — | "? What is this?" chip re-expands. | `src/screens/Risk.jsx:1293`, `src/screens/RiskOverlay.jsx:120-124` |
| RK-ANCH-01 | FAIL | — | FAIL | FUNCTIONAL | Primary Risk ring has NO `onClick`. Inventory says it should drill to dimension breakdown (Z3). Currently inert — user has to scroll/find Z3 themselves. Dim breakdown does exist below, but the anchor itself is not the affordance. | `src/screens/Risk.jsx:1502-1524` — `RiskRing` rendered without any tap handler in either anchor or `RiskBody` Z1 card (`src/screens/Risk.jsx:1356-1372`). |
| RK-ANCH-02 | FAIL | — | FAIL | FUNCTIONAL | `ConfBadge` is pure `<span>` — no `onClick`. Inventory expects SOURCE drill to confidence-level explainer. Dead affordance. | `src/screens/Risk.jsx:179-187` (no handler). |
| RK-ANCH-03 | FAIL | — | FAIL | FUNCTIONAL | `SetbackChip` is pure `<span>` — no `onClick`. Inventory expects SOURCE drill to history (Z8). Dead affordance. | `src/screens/Risk.jsx:190-208`. |
| RK-ANCH-04 | PASS | PASS | PASS | — | `ExplainerChip HOME-2` opens bottom sheet via internal state. | `src/components/shared/Explainer.jsx:192,200`. |
| RK-ANCH-05 | PASS | PASS | PASS | — | `SecondaryTile` "Health score" `onClick → onDrillMetric('wealthScore')`. `driver-engine` resolves `wealthScore` → real `drvWealthScore` tree. SOURCE coherent. | `src/screens/Risk.jsx:1534-1539,1555`; `src/engine/driver-engine.js:44,77`. |
| RK-ANCH-06 | PASS | PASS | PASS | — | `SecondaryTile` "You own" routes to `'netWorth'`. Driver handles it. | `src/screens/Risk.jsx:1540-1545`; `src/engine/driver-engine.js:43`. |
| RK-Z1-01 | FAIL | — | FAIL | FUNCTIONAL | Same as RK-ANCH-01 — overlay-only Z1 ring is also wrapped in a card with no `onClick`. ConfBadge + SetbackChip inside it are also dead (see RK-ANCH-02/03). | `src/screens/Risk.jsx:1356-1372`. |
| RK-Z2-01 | PASS | FAIL | FAIL | FUNCTIONAL | `CrossMap5x5 onCellTap` fires `onDrillMetric('crossmap:${fq}-${risk}')`. **Driver engine has no `crossmap:*` case** — falls through to `default: terminal(metric, 0, 'Driver tree pending')`. Describes nothing, just shows "pending" string in DetailOverlay. Not SOURCE, not ACTION, not DECISION. | `src/screens/Risk.jsx:1385`; `src/components/Risk/CrossMap5x5.jsx:139,145`; `src/engine/driver-engine.js:42-49`. |
| RK-Z2-03 | NA | NA | NA | — | ProfileCell is display-only. Not a drillable per inventory. | `src/screens/Risk.jsx:246-267`. |
| RK-Z3-T1/T2/T3 | PASS | PASS | PASS | — | Radar/Orbit/Bars toggles switch view state. | `src/screens/Risk.jsx:354`. |
| RK-Z3-01..07 | PASS | PASS | PASS | — | DimRow `onClick → onTap(dimCfg) → setActiveDim` opens local `DimSheet`. DimSheet IS the SOURCE — description + sub-chips + questionnaire button. Coherent without round-tripping driver. | `src/screens/Risk.jsx:285,1390-1395,1452-1460,795-848`. |
| RK-Z3-R4 | PASS | PASS | PASS | — | Radar `<g onClick={() => onTap?.(d)}>` opens DimSheet. | `src/screens/Risk.jsx:451-452`. |
| RK-Z3-O2 | PASS | PASS | PASS | — | Orbit node `<button onClick={() => onTap?.(d)}>` opens DimSheet. | `src/screens/Risk.jsx:513`. |
| RK-Z3-B1 | PASS | PASS | PASS | — | Bars view = DimRow above. | `src/screens/Risk.jsx:369-377`. |
| RK-DS-04 | PASS | PASS | PASS | — | "Update answers — 60-second questionnaire" opens D6Questionnaire. | `src/screens/Risk.jsx:773-782`. |
| RK-DS-06 | PASS | PASS | PASS | — | "Got it" closes DimSheet. | `src/screens/Risk.jsx:839-844`. |
| RK-D6-Q1..Q5 | PASS | PASS | PASS | — | Each option button has `onClick={() => pick(o.value)}`. | `src/screens/Risk.jsx:674`. |
| RK-D6-NB | PASS | PASS | PASS | — | Back button calls `back()`; disabled at step 0. | `src/screens/Risk.jsx:698-707`. |
| RK-D6-NN | PASS | PASS | PASS | — | Next button calls `next()`; disabled until picked. | `src/screens/Risk.jsx:709-718`. |
| RK-D6-SB | PASS | FAIL | FAIL | FUNCTIONAL | Submit fires `onCommit({ type: 'risk_questionnaire_committed', … })` then closes. Inventory note + in-code comment confirm engine consumption of the event is **deferred** — `entity.willStatus` / `lpaStatus` etc. are NOT mutated. So the submit "commits" but the next render of the same DimSheet sub-chips will show the same scores. Lands on a closed sheet, not on an ACTION/SOURCE that reflects the answers. | `src/screens/Risk.jsx:621-628`, comment at `src/screens/Risk.jsx:538-540`. |
| RK-D6-CN | PASS | PASS | PASS | — | Cancel closes without commit. | `src/screens/Risk.jsx:731-740`. |
| RK-Z4-01 | NA | NA | NA | — | ProtectionGap life-cover row is DISPLAY ONLY — no `onClick`, no progress-bar tap, no "Get a quote" CTA. Inventory says "owns: SOURCE — protection quote (s02a)" but **the row is not interactive**. A2 not applicable because there is no tap target; flag as missing affordance not a dead one. (Likely an A1 conformance call by the orchestrator — copy advertises "Quotes pull in via the protection adapter at s02a" but there is no button to do it.) | `src/components/Risk/ProtectionGap.jsx:55-92` — only static layout. |
| RK-Z4-02 | NA | NA | NA | — | Income-protection row: same as RK-Z4-01. No handler. | same file. |
| RK-Z4-03 | NA | NA | NA | — | Combined-gap summary box: plain `<div>`, no `onClick`. Inventory expects ACTION → protection adapter; build has no button. | `src/components/Risk/ProtectionGap.jsx:39-50`. |
| **ProtectionGap actions reachable?** | **FAIL** | — | **FAIL** | **DEMO-BLOCKING** | **VERIFY-CALL from runbook.** Inventory explicitly asks "ProtectionGap actions reachable?" — answer: **NO**. The component has zero interactive elements. There is no path from "you have a £500k life-cover gap" → "do something about it". The only protection-acting affordance on the whole Risk surface is the Z10 floating "+" sheet (see RK-Z10-D3 below, which is itself unwired). | `src/components/Risk/ProtectionGap.jsx` whole file — no `onClick` anywhere. |
| RK-Z5-01..N | PASS | PASS | PASS | — | **VERIFY-CALL: "Shock-scenario buttons live not static?"** — confirmed live. Each `<ShockCard>` is `<div onClick={() => setOpen(!open)}>`; expand/collapse animates rsBefore/rsAfter numbers via `<Num animate>`. Engine-driven via `riskShockSuite(entity)`. Per FD-CROSS-1 these are Risk's own (shock-test SOURCE) — coherent. | `src/screens/Risk.jsx:859-901,1413-1416`. |
| RK-Z5-0a (per-shock AskChip) | PASS | PASS | PASS | — | Each ShockCard renders `<AskChip id="RISK-AI-3">` which dispatches `sonus:ask` window event. Dashboard listens at `src/screens/Dashboard.jsx:260` and opens Ask sheet. | `src/screens/Risk.jsx:885,228`; `src/screens/Dashboard.jsx:250-260`. |
| RK-Z5-00 (top "What if?" chip) | PASS | PASS | PASS | — | Same `AskChip` route. | `src/screens/Risk.jsx:1406`. |
| RK-Z7-01 | PASS | PASS | PASS | — | LifeEventBanner top-right `AskChip RISK-AI-6` dispatches `sonus:ask`. | `src/screens/Risk.jsx:1116`. |
| RK-Z7-02 | FAIL | — | FAIL | FUNCTIONAL | Banner body says **"N prompt(s) pending. Tap to re-answer affected dimensions."** The surrounding `<div>` (`src/screens/Risk.jsx:1118-1120`) has NO `onClick`. Copy advertises interactivity that does not exist. Confirms seed S-08. | `src/screens/Risk.jsx:1098-1123`. |
| RK-Z8-T1..T4 | PASS | PASS | PASS | — | Each range pill `onClick → setRange(p.id)` re-runs `calcRiskHistory(entity, range)` and re-draws line. | `src/screens/Risk.jsx:936`. |
| RK-Z8-01 (chart) | NA | NA | NA | — | SVG path is display; not a tap target per inventory. | `src/screens/Risk.jsx:949-956`. |
| RK-Z9-01..03 (TakeAction rows) | PASS | FAIL | FAIL | FUNCTIONAL | Row `onClick → onAct(a)` → `onDrillMetric('risk:'+a.dimension)`. **Driver engine has no `risk:*` case** — falls through to `terminal(metric, 0, 'Driver tree pending')`. Describe-only stub. Per FD-CROSS-1 these should hand off to the **owning surface** (MyMoney for pension/SIPP/drawdown, Cashflow for budget actions, T&E for IHT/will actions) — instead they hit a stub. Confirms RK-Z9-01..03 inventory note "must hand off to owning surface for the action, not stay describe-only on Risk." | `src/screens/Risk.jsx:993,1430-1442`; `src/engine/driver-engine.js:42-49`. |
| RK-Z9-00 (AskChip RISK-AI-8) | PASS | PASS | PASS | — | AskChip dispatches `sonus:ask`. Dashboard listens. | `src/screens/Risk.jsx:989`. |
| RK-Z11-S1..S5 | PASS | PASS | PASS | — | Shock picker chips `onClick → setShockId(s.id)` re-runs `engineWhatHelpsMost`. Coherent — table re-renders. | `src/screens/Risk.jsx:1044`. |
| RK-Z11-01a..d (mitigation rows) | FAIL | — | FAIL | FUNCTIONAL | Each `<tr>` has no `onClick`. Inventory expects SOURCE drill to mitigation detail per row. Currently rows are read-only. Per FD-CROSS-1 each mitigation (e.g. `buy_income_protection`) should hand off to MyMoney / protection surface — no handoff exists. | `src/screens/Risk.jsx:1063-1083`. |
| RK-Z11-HD | FAIL | — | FAIL | FUNCTIONAL | **VERIFY-CALL implicit.** Z11 column headers carry `sw-press` class + `cursor:pointer` but NO `onClick`. Styled as sortable, do nothing. Confirms seed S-07. | `src/screens/Risk.jsx:1057-1061`. |
| RK-Z12-A | NA | NA | NA | — | Active-plan card is display-only (no plan-edit affordance). | `src/screens/Risk.jsx:1128-1138`. |
| RK-Z12-N1 | PASS | FAIL | FAIL | **DEMO-BLOCKING** | **VERIFY-CALL from runbook: "RK-S-17 Z12 button routes to non-existent 'plan' tab"** — **CONFIRMED FAIL**. Button dispatches `CustomEvent('sonus:navigate', { detail: { tab: 'plan', planType: 'protection' }})` **and** writes `window.location.hash = '#tab=plan&planType=protection'`. Dashboard does NOT listen for `sonus:navigate` (grep returns zero hits) and does NOT register a `hashchange` listener (zero hits). The 'plan' tab id was migrated to 'timeline' on 2026-05-15 (`src/screens/Dashboard.jsx:144-145, 175-176`), so even a hypothetical listener would have to map `plan` → `timeline`. Outcome: tap = no-op. Pure dead handler. Confirms seed S-17 and the verify-call. | `src/screens/Risk.jsx:1148-1163`; `src/screens/Dashboard.jsx:144-176` (migration shim only fires inside `setTabSafe`, not from hash or `sonus:navigate`); zero `hashchange`/`sonus:navigate` listeners in `src/screens/Dashboard.jsx`. |
| RK-Z10-FB | PASS | PASS | PASS | — | FloatingAddButton `onClick={onTap}` opens UniversalAdd sheet via `setAddOpen(true)`. | `src/screens/Risk.jsx:1263,1463`. |
| RK-Z10-D3a..c | PASS | FAIL | FAIL | **DEMO-BLOCKING** | **VERIFY-CALL from runbook: "RK-S-06 `onAddProtection` unwired"** — **CONFIRMED FAIL**. Tile `onClick → onPick(t.id) → setAddOpen(false); onAddProtection?.(id)`. `onAddProtection` is a `RiskBody` prop. Neither the default-export `Risk` (`src/screens/Risk.jsx:1601-1645` — passes only `entity / onDrillMetric / onCommit / suppressPrimaryRing`) NOR `RiskOverlay` (`src/screens/RiskOverlay.jsx:157` — passes only `entity`) passes it. Dashboard also does not supply it. So `onAddProtection?.(id)` is always `undefined?.(id)` → silent no-op. All 6 tiles (RK-Z10-D3a/b/c + RK-Z10-D6a/b/c) are dead. Confirms seed S-06 and the verify-call. | `src/screens/Risk.jsx:1196,1467,1335,1601,1633`; `src/screens/RiskOverlay.jsx:157`; no caller in `src/screens/Dashboard.jsx`. |
| RK-Z10-D6a..c | PASS | FAIL | FAIL | **DEMO-BLOCKING** | Same `onAddProtection` failure as D3 tiles. | same. |
| RK-Z10-CN | PASS | PASS | PASS | — | Cancel closes sheet. | `src/screens/Risk.jsx:1249-1255`. |
| RK-OVL-01 | PASS | PASS | PASS | — | Sticky × `onClick={onClose}` + Esc handler. | `src/screens/RiskOverlay.jsx:62,32-34`. |
| RK-OVL-03 | NA | NA | NA | — | Big header score is display; no drill target promised. (Reconciliation owed by Number-trace auditor — A6, not A2/A3/A4.) | `src/screens/RiskOverlay.jsx:80`. |
| RK-OVL-06 | PASS | PASS | PASS | — | Second `← {originLabel}` button `onClick={onClose}` — redundant with RK-OVL-01 (seed S-18 polish) but works. | `src/screens/RiskOverlay.jsx:110-117`. |
| RK-OVL-08 | — | — | FAIL | POLISH | **VERIFY-CALL from runbook: "RK-S-09 overlay shows score twice"** — **CONFIRMED FAIL** (visual duplication, not an interaction fail). RiskOverlay calls `<RiskBody entity={entity} />` at line 157 without `suppressPrimaryRing`, so RiskBody renders the Z1 ring card (`Risk.jsx:1356-1372`) on top of the score-78 already showing in the sticky header (`RiskOverlay.jsx:80`). Per FD-RK-3 the overlay is canonical — so this is a real polish/UX bug. Confirms seed S-09. Not strictly A2/A3/A4 — flagging here because runbook listed it as a verify item I had to confirm. | `src/screens/RiskOverlay.jsx:157` (no `suppressPrimaryRing`); `src/screens/Risk.jsx:1335-1372`. |
| RK-ORPH-01..04 | NA | NA | NA | POLISH (S-14) | Grep confirms no importer for `CrossMap.jsx`, `DimensionRadar.jsx`, `ScoreHistoryChart.jsx`, `ShockScenarios.jsx` anywhere under `src/`. Dead code, ~420 lines. Not an interaction finding but recording the verification. | `grep -rln from.*Risk/CrossMap'` etc. — zero hits. |

---

## Verify-call summary (runbook items)

| Verify item | Result | Severity |
|---|---|---|
| RK-S-06 `onAddProtection` unwired | **CONFIRMED FAIL** — all 6 Add-Protection tiles dead | DEMO-BLOCKING |
| RK-S-09 overlay shows score twice | **CONFIRMED FAIL** — RiskOverlay doesn't pass `suppressPrimaryRing` | POLISH |
| RK-S-17 Z12 button routes to non-existent "plan" tab | **CONFIRMED FAIL** — no `hashchange` or `sonus:navigate` listener exists; `'plan'` was migrated to `'timeline'` | DEMO-BLOCKING |
| ProtectionGap actions reachable | **NO** — entire component has zero `onClick` handlers; no path from gap → action | DEMO-BLOCKING |
| Shock-scenario buttons live not static | **YES** — `ShockCard` toggles open state; numbers animate; per-card AskChip dispatches `sonus:ask` | PASS |

---

## Failure clusters (so orchestrator can route fixes)

1. **`driver-engine.js` missing cases** — `crossmap:*` and `risk:*` both fall through to terminal "Driver tree pending". Affects RK-Z2-01 (25 cross-map cells) and RK-Z9-01..03 (TakeAction rows). Fix: extend `driver()` switch.
2. **`onAddProtection` wiring gap** — `RiskBody` consumes the prop but neither `Risk` default export nor `RiskOverlay` supplies it; Dashboard also has no handler. Affects all 6 RK-Z10-D3/D6 tiles. Fix: thread a handler from Dashboard (or have RiskBody handle the protection-add itself + dispatch `sonus:navigate` to MyMoney / T&E per FD-CROSS-1).
3. **`sonus:navigate` + `hashchange` listeners absent** — RK-Z12-N1 dispatches both and nothing receives them. Fix: add `hashchange` listener in Dashboard that parses `tab=` and `planType=` and calls `setTabSafe` (which already migrates `'plan'` → `'timeline'`).
4. **Anchor chrome chips are spans not buttons** — RK-ANCH-01 (ring), RK-ANCH-02 (ConfBadge), RK-ANCH-03 (SetbackChip), RK-Z1-01 (overlay-only Z1 ring). All inventory-promised SOURCE drills are inert.
5. **Dead "tap" affordances** — RK-Z7-02 banner body ("Tap to re-answer…" with no `onClick`), RK-Z11-HD table headers (`cursor:pointer` with no handler), RK-Z11-01a..d mitigation rows.
6. **ProtectionGap entirely non-interactive** — the card screams "you have a £500k gap" but has zero CTAs.

---

## RK interaction: 41 PASS, 19 FAIL (4 DB, 13 F, 2 P).
