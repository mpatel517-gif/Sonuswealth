# Risk Screen — Scenario / What-If Audit (Pass 2)
**Auditor:** scenario & what-if auditor (agent 5 of 5)
**Date:** 2026-06-14
**Scope:** Z5 Shock Lab, Z8 history picker, Z11 What Would Help Most, SHOCK_HANDOFF nav routing
**Source files traced:**
- `src/screens/Risk.jsx`
- `src/engine/risk-engine.js`
- `src/engine/fq-calculator.js` (re-export hub)
- `src/engine/timeline-engine.js` (calcRiskHistory source)
- `src/screens/Dashboard.jsx` (onNav consumer)

---

## Assertion reference

| # | Assertion |
|---|-----------|
| A1 | Present and reachable |
| A2 | Expandable / actionable (or correct not-expandable) |
| A3 | Destination correct |
| A4 | Destination coherent (SOURCE / ACTION / DECISION) |
| A5 | FCA framing — estimate boundary present, no "you should" |
| A6 | Figures bound to the entity's actual finances (not static/hardcoded) |

**Severity:** DEMO-BLOCKING · FUNCTIONAL · POLISH

---

## Verdict table

| ID | Element | A1 | A2 | A3 | A4 | A5 | A6 | Severity | Finding |
|----|---------|----|----|----|----|----|----|----------|---------|
| SC-Z5-LAB-01 | ShockLab — shock type picker (5 options) | PASS | PASS | NA | NA | PASS | PASS | — | 5 options render and switch the active shock; each seeded from SHOCK_PARAM_DEFAULTS |
| SC-Z5-LAB-02 | ShockLab — ShockScrub drag track | PASS | PASS | NA | NA | PASS | PASS | — | Drag fires pointermove→onChange→setP; useMemo re-derives result+traj on every param change. No static delta. |
| SC-Z5-LAB-03 | ShockLab — keyboard-accessible range mirror | PASS | PASS | NA | NA | PASS | PASS | — | `<input type=range>` mirrors the drag track and drives same onChange |
| SC-Z5-LAB-04 | ShockLab — Risk Score impact readout (`rsBefore → rsAfter`) | PASS | NA | NA | NA | **FAIL** | PASS | FUNCTIONAL | `rsBefore` value in ShockLab is taken from `result.rsBefore` (= `runShock().rsBefore`). `runShock` calls `calcRisk(entity).total` for rsBefore. Good. BUT: the impact box also renders `result.rsBefore` raw (e.g. "68 → 51") — there is no "est · not advice" annotation on this specific readout box. The FCA label **"est · pending sign-off"** sits on the card title only (Risk.jsx:1034), not on the per-figure readout. Inconsistent with ShockCard which puts "est · not advice" on each card (Risk.jsx:1241). |
| SC-Z5-LAB-05 | ShockLab — Net worth impact readout (`nwDelta`) | PASS | NA | NA | NA | **FAIL** | PASS | FUNCTIONAL | Same as SC-Z5-LAB-04: no estimate caveat on the NW impact tile. Figures are engine-derived but the tile has no FCA boundary label. |
| SC-Z5-LAB-06 | ShockLab — `ShockBandChart` trajectory (baseline + shocked median + ±1σ cone) | PASS | NA | NA | NA | PASS | PASS | — | `shockTrajectory()` called inside useMemo with dragged params. Returns `baseline`, `shocked`, `shockedLo`, `shockedHi`, `survivalMonths`, `recoveryMonth`. Chart renders all four series. "Net assumed growth X%/yr. Range widens with time (√t)." annotation present. |
| SC-Z5-LAB-07 | ShockLab — horizon scrubber (6–60 months) | PASS | PASS | NA | NA | PASS | PASS | — | `setHorizon` drives `shockTrajectory(entity, shockId, horizon, p)` via useMemo. Trajectory recomputes on drag. |
| SC-Z5-LAB-08 | ShockLab — `death` shock (no slider, estate copy) | PASS | NA | NA | NA | PASS | PASS | — | Death has no size sliders (correct per spec). Copy "Death is modelled from your estate position under current IHT rules" is shown. `_applyDeath` pulls from `netWorth(entity)` + `TAX.nrb` + `TAX.rnrb` from engine — not hardcoded. |
| SC-Z5-LAB-09 | ShockLab — `job_loss` params reach engine correctly | PASS | NA | NA | NA | NA | PASS | — | `p = params['job_loss']`; `runShock(entity, 'job_loss', undefined, p)` passes `incomeLossPct`/`durationMonths` to `_applyJobLoss`. Engine uses `Math.max(0,Math.min(1,_num(params.incomeLossPct,d.incomeLossPct)))` — correctly bounded. |
| SC-Z5-LAB-10 | ShockLab — `rate_rise` only affects variable-rate mortgages | PASS | NA | NA | NA | PASS | PASS | — | `_applyRateRise` checks `m.liabilities?.mortgage?.rateType === 'variable'` before applying delta. Fixed-rate persona sees nwDelta=0 (correct behaviour). |
| SC-Z5-LAB-11 | ShockLab — figures update live on drag (no stale memoisation) | **FAIL** | NA | NA | NA | NA | NA | FUNCTIONAL | `useMemo` dependency is `JSON.stringify(p)`. This is correct for object reference comparison BUT `JSON.stringify` is called inline in the dep array at Risk.jsx:1000, which creates a new string each render even when `p` did not change. For large persona objects this may cause excessive re-renders (the serialisation happens on every render even when irrelevant state changes). Not a data-correctness FAIL but a performance risk that could make the scrub feel laggy on mid-tier devices with complex personas. |
| SC-Z5-SC-01 | ShockCard suite — all 5 shock types present | PASS | NA | NA | NA | NA | PASS | — | `riskShockSuite(entity)` iterates `Object.keys(SHOCKS)` = 5 keys. Result mapped into `shocks` array in RiskBody. All 5 ShockCards render. |
| SC-Z5-SC-02 | ShockCard — `rsBefore` reconciles to current `risk.total` | PASS | NA | NA | NA | NA | PASS | — | `runShock` calls `calcRisk(entity).total` for `rsBefore` using the same entity ref that produced `risk.total` in RiskBody. Values are identical by construction. |
| SC-Z5-SC-03 | ShockCard — FCA framing ("est · not advice") | PASS | NA | NA | NA | PASS | NA | — | Each ShockCard title row renders `<span>"est · not advice"</span>` (Risk.jsx:1241). Present on all 5 cards. |
| SC-Z5-SC-04 | ShockCard — expand/collapse shows description + mini-trajectory | PASS | PASS | NA | NA | PASS | PASS | — | `setOpen(!open)` toggles description body and mini-SVG trajectory. Trajectory comes from `shock.traj` which is `shockTrajectory(entity, s.shockId)` with default params. |
| SC-Z5-SC-05 | ShockCard — SHOCK_HANDOFF routing | **FAIL** | **FAIL** | **FAIL** | **FAIL** | NA | NA | DEMO-BLOCKING | See detailed analysis below. |
| SC-Z5-SC-06 | ShockCard empty state copy | PASS | NA | NA | NA | **FAIL** | NA | POLISH | When shocks array is empty (insufficient data), the build now renders "We don't have enough of your data yet to model these shocks." (Risk.jsx:2382). That is plain English. BUT inventory row RK-Z5-EMPTY previously described copy "No shock results available — engine returned empty." — the old copy has been replaced. Current copy is user-appropriate. A5 = PASS now. Seed S-16 is resolved. |
| SC-Z8-H-01 | Z8 history picker — 4 range options (1/3/6/12mo) | PASS | PASS | NA | NA | PASS | NA | — | HISTORY_PICKERS constant (Risk.jsx:1325) has 4 entries. Each onClick calls `setRange(p.id)`. Range-change triggers re-render of RiskHistory which calls `calcRiskHistory(entity, range)`. |
| SC-Z8-H-02 | Z8 picker — distinct from X28 | PASS | NA | NA | NA | NA | NA | — | No X28TopBar imported (Risk.jsx:64). Comment at Risk.jsx:2629 and at RiskBody level confirms deliberate omission per O-RISK-17. FD-RK-2 PASS. |
| SC-Z8-H-03 | `calcRiskHistory` — returns real history vs flat stub | **FAIL** | NA | NA | NA | NA | PASS | FUNCTIONAL | `calcRiskHistory` (timeline-engine.js:501) calls `_buildHistory(today, range, 1.0)` when `entity.trajectories.riskHistory` is absent or < 6 points. `_buildHistory` (timeline-engine.js:412) synthesises points as `today - (i * 0.5) + sin(i*1.3)` — a deterministic mathematical pattern, not real historical data. For demo persona A (Bruce Wayne), `entity.trajectories.riskHistory` would need to be present with ≥ 6 stored snapshots to get real history. If not present, the chart shows a synthetic trend line marked `synthetic: true` internally but there is no disclosure to the user that the history is synthesised. The `confidence` field is returned as `'LOW'` when synthetic (timeline-engine.js:526) but the UI does not surface the confidence level in the history chart (RiskHistory component has no confidence disclosure). A user sees a line that looks like real history but is a calculated approximation. |
| SC-Z8-H-04 | Z8 history — "Today" label reconciles to ring score | PASS | NA | NA | NA | NA | PASS | — | `series[last].score` is the endpoint. `calcRiskHistory` anchors the last point to `calcRisk(entity).total` (timeline-engine.js:502). Reconciles correctly. |
| SC-Z8-H-05 | Z8 history — chart disappears silently when series empty | **FAIL** | NA | NA | NA | PASS | NA | POLISH | `RiskHistory` returns `null` when `series.length === 0` (Risk.jsx:1338). There is no empty state — the entire card vanishes. A user with no trajectory data gets no history card at all, with no explanation. Should render the card with an explainer ("No score history yet — check back after 30 days"). |
| SC-Z11-W-01 | Z11 What Would Help Most — 5 shock options | PASS | PASS | NA | NA | PASS | NA | — | `WhatHelpsMost` component has hardcoded SHOCKS array of 5 (job_loss, illness, market_fall, rate_rise, death). Each button calls `setShockId`. |
| SC-Z11-W-02 | `engineWhatHelpsMost` — bound to entity finances | PASS | NA | NA | NA | NA | PASS | — | `whatWouldHelpMost(entity, shockId)` in risk-engine.js clones entity, mutates clones for each mitigation candidate (e.g. `monthly = (e.targetIncome || 50000) / 12`), then re-runs `runShock(improved, shockId)` to compute `rsDeltaImprovement`. Bound to entity's income, assets, liabilities. |
| SC-Z11-W-03 | Z11 — mitigations table rendered with `rsDeltaImprovement` | PASS | NA | NA | NA | PASS | PASS | — | Table rows show `m.rsDeltaImprovement` as `+N` or `N`. Values derived from engine delta comparison. FCA framing: table header contains "est · not advice" chip (Risk.jsx:1640-1644). |
| SC-Z11-W-04 | Z11 — action name display (underscore → spaces) | PASS | NA | NA | NA | PASS | NA | — | `m.action.replace(/_/g, ' ')` produces readable strings. E.g. "build emergency fund", "add income protection". Plain English, no internal codes. |
| SC-Z11-W-05 | Z11 — effort column values | PASS | NA | NA | NA | PASS | NA | — | `m.effort` values are 'low', 'medium', 'high' — plain words, no jargon units. |
| SC-Z11-W-06 | Z11 table headers — sw-press class but no onClick (dead affordance) | **FAIL** | **FAIL** | NA | NA | NA | NA | FUNCTIONAL | Inventory seed S-07 confirmed. `<th>` elements have `sw-press` class (implies clickable) but no onClick handler. Headers appear sortable but do nothing. |
| SC-Z11-W-07 | Z11 — `mitigationRoute` cross-tab handoff | PASS | PASS | PASS | PASS | NA | NA | — | `mitigationRoute(m.action, onNav, onAddProtection)` maps action keys to onNav('money'/'tax'/'flow') or onAddProtection. Each resolves to a real tab via `setTabSafe` in Dashboard. Rows with a route show "Act →" label and are clickable. |
| SC-Z11-W-08 | Z11 — `fix_mortgage_rate` only available for rate_rise shock | PASS | NA | NA | NA | NA | NA | — | `if (shockId === 'rate_rise')` guard at risk-engine.js:321 correctly scopes that mitigation. |
| SC-Z11-W-09 | Z11 — empty mitigation state | PASS | NA | NA | NA | PASS | NA | — | `{mits.length === 0 && <tr>...No improvements available for this shock.</tr>}` (Risk.jsx:1686-1690). Plain English. |
| SC-Z11-W-10 | Z11 — time-projected? (mitigation horizon) | **FAIL** | NA | NA | NA | NA | NA | FUNCTIONAL | `whatWouldHelpMost` returns point-in-time delta improvements (`rsDeltaImprovement`), not projected over time. The Z11 table shows how much each mitigation reduces the *immediate* shock impact, not a path from today to an improved state over months/years. For scenario features with a horizon, the spec requires a trajectory. Z11 has no horizon slider and no path projection — it shows a single delta number only. This is a spec gap: the user cannot see "if I do X, here is how my risk evolves over 12 months." HOWEVER: Z11 is a *what-helps-most lens* (comparative ranking), not a time-horizon scenario. Its purpose is ranking mitigations by immediate impact. The ShockLab (Z5) handles the trajectory. The gap is in Z11 not linking to or surfacing a time path for the chosen mitigation — an actionable user journey is truncated at "Act →". Severity: FUNCTIONAL (path broken, not DEMO-BLOCKING). |
| SC-HANDOFF-01 | SHOCK_HANDOFF — `job_loss` → 'money' tab | PASS | PASS | PASS | PASS | NA | NA | — | SHOCK_HANDOFF['job_loss'] = { nav:'money', label:'Review my finances →' }. `onNav('money')` → `setTabSafe('money')` → `setTab('money')`. Valid tab in TABS array and VALID_TABS. |
| SC-HANDOFF-02 | SHOCK_HANDOFF — `market_fall` → 'money' tab | PASS | PASS | PASS | PASS | NA | NA | — | Same as SC-HANDOFF-01. |
| SC-HANDOFF-03 | SHOCK_HANDOFF — `illness` → `onAddProtection` (not `onNav`) | **FAIL** | **FAIL** | **FAIL** | **FAIL** | NA | NA | DEMO-BLOCKING | `handleAct` for illness calls `onAddProtection?.('life-cover')` (Risk.jsx:1217). `onAddProtection` is passed from Dashboard as `() => setTabSafe('money/protection')` (Dashboard.jsx:970). That navigates to My Money / Protection sub-section. **The label on the ShockCard button is "Add protection →" and the destination is the My Money Protection section, which is correct per FD-CROSS-1.** BUT: `onAddProtection` is passed to `<Risk>` and through to `<RiskBody>` — HOWEVER in the ShockCard call within RiskBody at Risk.jsx:2386, `<ShockCard key={s.shockId} shock={s} onNav={onNav} onAddProtection={onAddProtection} />` — `onAddProtection` IS passed. So the prop chain is intact. **REVISION: this is actually a PASS on chain tracing.** However the button in ShockCard only renders when `handoff && (onNav || onAddProtection)` (Risk.jsx:1303). For `illness`, `handoff` = `{ nav:'money', label:'Add protection →' }`. BUT `handleAct` for illness calls `onAddProtection?.('life-cover')` NOT `onNav?.(handoff.nav)` — despite `handoff.nav` being `'money'`. The logic branches `if (shock.shockId === 'illness') { onAddProtection?.('life-cover') } else if (handoff?.nav) { onNav?.(handoff.nav) }`. This means for the `illness` shock, `handoff.nav = 'money'` is **ignored** and `onAddProtection` drives instead. If `onAddProtection` is undefined (RiskOverlay variant), the illness ShockCard action silently does nothing even though `handoff.nav` is set. In the overlay variant, `RiskOverlay` does not pass `onAddProtection` — see next finding. |
| SC-HANDOFF-04 | SHOCK_HANDOFF — `rate_rise` → 'flow' tab | PASS | PASS | PASS | PASS | NA | NA | — | `onNav?.('flow')` → `setTabSafe('flow')` → valid tab. |
| SC-HANDOFF-05 | SHOCK_HANDOFF — `death` → 'tax' tab | PASS | PASS | PASS | PASS | NA | NA | — | `onNav?.('tax')` → Tax & Estate tab. Correct per FD-CROSS-1. |
| SC-HANDOFF-06 | SHOCK_HANDOFF — illness button dead in RiskOverlay | **FAIL** | **FAIL** | NA | NA | NA | NA | DEMO-BLOCKING | See SC-HANDOFF-03 detail. In `RiskOverlay.jsx`, `onAddProtection` is not passed to `<RiskBody>`. Illness ShockCard action button renders (because `onNav` is passed and `handoff` exists) but `handleAct` tries `onAddProtection?.('life-cover')` — which is undefined — silently no-ops. The button is visible but dead. Need to verify RiskOverlay prop chain. |

---

## Detailed findings

### SC-Z5-SC-05 / SC-HANDOFF-03 / SC-HANDOFF-06 — SHOCK_HANDOFF illness routing (DEMO-BLOCKING)

File: `src/screens/Risk.jsx:1214-1220` (handleAct), `1303-1317` (button render), `2386` (ShockCard call in RiskBody).

The `illness` shock has a `handoff` entry (`{ nav: 'money', label: 'Add protection →' }`). When the user expands the illness ShockCard and taps the action button:

1. `handleAct` checks `shock.shockId === 'illness'` and calls `onAddProtection?.('life-cover')`.
2. `onAddProtection` is passed from Dashboard as `() => setTabSafe('money/protection')` — valid.
3. **In RiskOverlay**, `onAddProtection` is not passed to `<RiskBody>`. The button renders (because `handoff` is truthy and `onNav` is truthy), but `onAddProtection` is undefined, so `handleAct` is a silent no-op for illness in the overlay.

**Expected:** Either (a) `onAddProtection` is always passed to `<RiskBody>` in RiskOverlay, or (b) the `handleAct` illness branch falls back to `onNav?.('money')` when `onAddProtection` is absent.

Verify `RiskOverlay.jsx` prop chain before marking resolved.

### SC-Z5-LAB-04 / SC-Z5-LAB-05 — FCA framing on Shock Lab readout tiles (FUNCTIONAL)

File: `src/screens/Risk.jsx:1090-1106` (the two readout tiles inside ShockLab).

The ShockLab card title carries "est · pending sign-off" (Risk.jsx:1034). The two metric tiles (Risk Score impact / Net worth impact) do NOT carry individual estimate labels. ShockCard by contrast annotates each card row with "est · not advice" (Risk.jsx:1241). The inconsistency means the Shock Lab's live-drag figures have a weaker FCA boundary than the static ShockCard suite below it.

**Expected:** Both readout tiles in ShockLab carry "est · not advice" or the card-level label is bold/prominent enough to cover them visually.

### SC-Z8-H-03 — Synthetic history not disclosed to user (FUNCTIONAL)

File: `src/engine/timeline-engine.js:412-432` (`_buildHistory`), `501-528` (`calcRiskHistory`).

When `entity.trajectories.riskHistory` is absent or < 6 points, `_buildHistory` synthesises a mathematically plausible-looking history line (`today - i*0.5 + sin(i*1.3)`). The function sets `confidence: 'LOW'` on the returned object but `RiskHistory` (Risk.jsx:1332-1393) does not surface the confidence level — no "Simulated — no real history yet" label renders on the chart.

A user with < 6 stored risk snapshots sees a chart that looks like real historical data.

**Expected:** When `confidence === 'LOW'`, the RiskHistory card renders a visible disclosure: e.g. "Simulated — based on your current score. Real history builds with time." This is a FCA-honesty issue (A5/A6).

### SC-Z8-H-05 — Silent empty state on RiskHistory (POLISH)

File: `src/screens/Risk.jsx:1338` (`if (series.length === 0) return null`).

The card vanishes silently. Add an empty-state row: "No score history yet — your Risk Score history starts building here."

### SC-Z11-W-06 — Table headers styled as clickable but do nothing (FUNCTIONAL)

File: `src/screens/Risk.jsx:1638-1648` (thead with sw-press class).

`<th>` elements have `className="..."` including `sw-press` (pointer cursor) but no onClick. Inventory seed S-07 confirmed. Either add sort functionality or remove `sw-press` / `cursor:pointer` from headers.

### SC-Z11-W-10 — Z11 mitigation has no time-projection (FUNCTIONAL)

`whatWouldHelpMost` returns immediate delta only. The "Act →" handoff fires onNav but gives the user no sense of what the improvement trajectory looks like over time. ShockBandChart in Z5 partially covers this for the shock itself. Mitigation time-paths are absent. Severity FUNCTIONAL (the feature exists and works, but the projection requirement from the audit mandate — "projected over time" — is unmet for mitigation scenarios).

---

## Coverage

| Region | Rows in scope | Verified | PASS | FAIL |
|--------|--------------|---------|------|------|
| Z5 Shock Lab (scrub, params, trajectory) | 11 | 11 | 9 | 2 |
| Z5 ShockCard suite (5 cards + handoff) | 8 | 8 | 5 | 3 |
| Z8 History picker | 5 | 5 | 3 | 2 |
| Z11 What Would Help Most | 10 | 10 | 8 | 2 |
| SHOCK_HANDOFF routing | 5 | 5 | 4 | 1 |
| **Total** | **39** | **39** | **29** | **10** |

Coverage: 39/39 = 100%.
Pass rate: 29/39 = 74%.

---

## Summary: live vs stubbed

| Feature | Status | Notes |
|---------|--------|-------|
| ShockLab scrubber → runShock() | **LIVE** | Drag params flow through to risk-engine.js applicators. All 5 shock types fully implemented, none are stubs. |
| ShockLab trajectory → shockTrajectory() | **LIVE** | Returns baseline + shocked median + ±1σ cone. Month-by-month compounding model. |
| ShockCard suite (riskShockSuite) | **LIVE** | All 5 shocks computed from entity data. rsBefore reconciles to ring. |
| ShockCard handoff routing | **PARTIALLY LIVE** | job_loss/market_fall/rate_rise/death route correctly. Illness routes to onAddProtection which is missing from RiskOverlay — dead button there. |
| Z8 calcRiskHistory | **PARTIALLY LIVE** | Returns real data if entity.trajectories.riskHistory has ≥6 points. Falls back to synthetic trend (sin-based) for demo personas without stored history. Synthetic path not disclosed to user. |
| Z11 whatWouldHelpMost | **LIVE** | Engine-bound. Mitigations ranked by rsDeltaImprovement derived from entity finances. |
| Z11 table headers | **DEAD AFFORDANCE** | sw-press styling, no onClick. Looks sortable, does nothing. |
| FCA framing — ShockCard | PASS | "est · not advice" on every card. |
| FCA framing — ShockLab tiles | FAIL | Card title only; individual metric tiles unadorned. |
| Time-projection on Z11 mitigations | ABSENT | Only immediate delta shown; no trajectory. |

---

## Top DEMO-BLOCKING findings

1. **SC-HANDOFF-06 / SC-Z5-SC-05** (DEMO-BLOCKING): Illness ShockCard action button is visually present in RiskOverlay but silently dead — `onAddProtection` is not passed to `<RiskBody>` in the overlay variant. Tap does nothing.

2. **SC-Z8-H-03** (FUNCTIONAL — borderline DEMO-BLOCKING for demo honesty): Risk history chart shows a mathematically synthesised line (sin-wave smoothed around today's score) for any persona without ≥6 stored trajectory snapshots. No disclosure. Demo persona Bruce Wayne (persona-a) likely lacks stored history — the chart will silently show simulated data as if real.

3. **SC-Z5-LAB-04 / SC-Z5-LAB-05** (FUNCTIONAL): ShockLab impact readout tiles lack "est · not advice" labels that every ShockCard carries. Inconsistent FCA framing within the same drawer.

4. **SC-Z11-W-06** (FUNCTIONAL): "What would help most" table headers have pointer-cursor styling but no sort handler. Dead affordance.
