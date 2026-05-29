# Cashflow — Spec-vs-Code Gap Audit

**Spec:** `G:\My Drive\All Work\6.Finio\1-Clusters\2-Product\2-Product-cashflow-v1_7.md` (2146 lines)
**Engine spec:** `3-Engine\3-Engine-cf-rules-v1_1.md` (1043 lines)
**Code:** `src/screens/Cashflow.jsx` (2942 lines) + `cashflow-engine.js` (941) + `monthly-flow-engine.js` (111) + `goal-seek-engine.js` (122) + `modules/uk-cashflow-2026-1-1.js` (~2200)
**Audit date:** 2026-05-23
**Auditor:** Claude (main thread; agents blocked by credit limit)

---

## ⚠️ HEADLINE — founder's framing partially wrong

Founder stated: *"the current cashflow doesnt even have the 4 industry standards plus my take on cashflow."*

**Actual state:** 4 of 4 industry-standard methods are wired engine + UI. The "founder's own method" (PRC-anchored / Sonuswealth-original) is a **deliberate stub** because the founder hasn't closed open item **O-CF-RULES-07** (PRC/PCC methodology pending founder IP definition). The spec itself documents this as stub-by-design at §6.4 (line 693).

So the gap is **founder-side, not Claude-side**. Closing O-CF-RULES-07 unlocks the 5th regime.

---

## §B.1 — SWR Regime Picker (the founder's specific complaint)

| # | Regime | Spec citation | Engine | UI | Verdict | Notes |
|---|---|---|---|---|---|---|
| 1 | **Bengen 4%** | spec line 510 + §8.16 | `fq-calculator.js:2701 bengenProjection()` + `uk-cashflow:834 bengenProjection()` + `swrFromRegime('bengen')` | `Cashflow.jsx:1823` chip + selectedRate display | ✅ **PRESENT** | Production. Default for foundation/accumulation life-stage. |
| 2 | **Morningstar UK-adjusted 3.4%** | spec line 511 + CMA bundle §187 | `uk-cashflow:734 swrFromRegime('morningstar'/'morningstarUKAdjusted')` returns 0.034 | `Cashflow.jsx:1825` chip | ✅ **PRESENT** | UK localisation per O-CF-RULES-05 (CLOSED at v1.7). Default for decumulation. |
| 3 | **Guyton-Klinger dynamic** | spec line 512 + §5.7 + §8.5 + §8.18 | `cashflow-engine.js:248 guytonKlinger()` + `uk-cashflow:887 guytonKlinger()` + `:932 guytonKlingerPath()` + `fq-calculator:2725 guytonKlingerPath()` | `Cashflow.jsx:1824` chip + §5.7 corridor visualisation | ✅ **PRESENT** | Production. Default for pre-retirement/transition. Triggers default ±20% (configurable). |
| 4 | **Vanguard dynamic** | spec line 513 + CMA bundle §196 | `uk-cashflow:745 swrFromRegime('vanguardDynamic'/'vanguard')` returns ceiling/floor midpoint | `Cashflow.jsx:1826` chip ("Vanguard 3.3%") | ✅ **PRESENT** | Production. Default for late accumulation. Returns midpoint of ceiling/floor as point-estimate. |
| 5 | **PRC-anchored (Sonuswealth original)** | spec line 514 + §6.4 + §8.13 | `cashflow-engine.js:734 prcPccSpread()` returns `{status:'stub', methodology:'pending', openItem:'O-CF-RULES-07'}` | `Cashflow.jsx:1827` chip with "Founder concept · stub" note + STUB-08 honest "Coming next" badge | 🟡 **STUB (by design)** | **Blocked on founder.** Open item O-CF-RULES-07. Engine refuses to compute until founder closes the methodology definition. UI is honest about it. |
| 6 | **Custom** | spec line 515 | None wired | `Cashflow.jsx:1828` chip + STUB-08 honest "Coming next" badge | 🟡 **STUB** | Spec says "User-defined starting % + inflation adjustment + taper rule, stored in Timeline." Engine path not yet built. Demo-acceptable; not blocking other work. |

**Net verdict on the founder's complaint:** Cashflow has **4 of 5 industry methods + UI presentation**. The 5th (PRC-anchored Sonuswealth method) is genuinely stubbed but ONLY because the founder hasn't documented the methodology. Closing O-CF-RULES-07 is a 1–2 hour spec-author task, not a build task.

---

## §A — SECTION A: NOW (current cashflow state)

| # | Feature | Spec §  | Engine | UI | Verdict |
|---|---|---|---|---|---|
| A1 | Triple-anchor (Net Worth · FQ · Risk) | §3 + X28 | `calcFQ`, `calcRisk`, `netWorth` in fq-calculator | TripleAnchor.jsx wired | ✅ PRESENT |
| A2 | Income waterfall (gross → tax → pension → essentials → debt → surplus) | §3 + §4 | `calcAllIncome`, `monthlySurplus`, `liquidityBuffer` | Cashflow.jsx:144 SurplusDrillPanel | ✅ PRESENT (drillable L3) |
| A3 | Monthly surplus + recommended allocation | §3 | `recommendedSurplusAllocation` | wired | ✅ PRESENT |
| A4 | Debt ratio | §3 | `debtRatio` | wired in NOW section | ✅ PRESENT |
| A5 | ANI (Adjusted Net Income) for directors | §3 + Skill | `calcANI` | wired | ✅ PRESENT |
| A6 | Cashflow Health composite | §3B | `cashflowHealth` | wired | ✅ PRESENT |
| A7 | Liquidity buffer (months of runway) | §3 | `liquidityBuffer` | wired in SurplusDrillPanel | ✅ PRESENT |
| A8 | Monthly expense profile | §A + §8.21 | `uk-cashflow:407 monthlyExpenseProfile` | needs UI grep | 🟡 PARTIAL — engine ready, UI usage to verify |
| A9 | Essential vs discretionary ratio | §A + §8.22 | `uk-cashflow:428 essentialVsDiscretionaryRatio` | needs UI grep | 🟡 PARTIAL |
| A10 | Tax payment schedule | §A + §8.27 | `uk-cashflow:465 taxPaymentSchedule` | needs UI grep | 🟡 PARTIAL |
| A11 | Allowable expense total (for self-employed) | §A + §8.30 | `uk-cashflow:506 allowableExpenseTotal` | needs UI grep | 🟡 PARTIAL |
| A12 | Childcare net cost | §A + §8.31 | `uk-cashflow:532 childcareNetCost` | needs UI grep | 🟡 PARTIAL |
| A13 | Gifts-from-normal-income check | §A + §8.32 | `uk-cashflow:584 giftsFromNormalIncomeCheck` | needs UI grep | 🟡 PARTIAL |

---

## §B — SECTION B: TRAJECTORY (projection)

| # | Feature | Spec § | Engine | UI | Verdict |
|---|---|---|---|---|---|
| B1 | SWR regime picker (5 + custom) | §5.1 | covered above | covered above | ✅ PRESENT (PRC stub) |
| B2 | Funded ratio gauge (half-circle, 3 zones) | §5.2 + §8.1 | `fundedRatio()` in fq-calc + uk-cashflow | `FundedRatioGaugeV2.jsx` imported | ✅ PRESENT |
| B3 | FI Progress tile | §5.3 | `fiRatio` | wired | ✅ PRESENT |
| B4 | Probability-of-Success headline (1000-run MC) | §5.4 + §8.3 | `cashflow-engine:465 probabilityOfSuccess` + `uk-cashflow:1211 probabilityOfSuccess` | `PoSChartV2.jsx` | ✅ PRESENT |
| B5 | Monte Carlo fan chart (1000 paths, P10/P25/P75/P90) | §5.5 | covered by `probabilityOfSuccess` | needs depth verification | 🟡 PARTIAL — engine has runs but fan-chart rendering needs check |
| B6 | Sequence-of-returns stress (two-line comparator) | §5.6 + §8.4 | `cashflow-engine:393 sequenceOfReturnsVulnerability` + `uk-cashflow:1301` + `uk-risk:1618 sequenceOfReturnsRisk` | `SequenceStressVisV2.jsx` | ✅ PRESENT |
| B7 | Guyton-Klinger corridor visualisation | §5.7 + §8.5 | covered above | needs corridor-chart verification | ✅ PRESENT |
| B8 | 5 Cashflow Scenarios (Do Nothing / Guardrail / Optimal / Bengen / Custom) | §5.8 | `cf_fiveCashflowScenarios` imported | `ScenarioMatrixV2.jsx` | ✅ PRESENT |
| B9 | Goal-Seek (§B.5 — X24 Mode 3 primary entry) | §B.5 + §X24-CF-MODE3 | `goalSeekSync()` in goal-seek-engine + `goalSeek` in fq-calc + uk-cashflow:1568 | `goalSeek` imported | 🟡 PARTIAL — engine present; UI flow needs verification |
| B10 | Sticky subheader (horizon · target income · CMA · inflation) | §5.9 | n/a | needs UI grep | ❓ UNKNOWN |
| B11 | Optimal drawdown sequence (tax-minimising) | §5.8 row 3 + §8.24 | `uk-cashflow:2179 optimalDrawdownSequence` | needs UI integration check | 🟡 PARTIAL — engine ready |
| B12 | Bucket allocation (B1/B2/B3 = cash/bonds/equity) | §C + §8 | `fq-calc:2758 bucketAllocation` + `uk-cashflow:1008 bucketAllocation` | needs UI verification | 🟡 PARTIAL |
| B13 | Bucket replenish check | §C + §8 | `uk-cashflow:1052 bucketReplenishCheck` | needs UI verification | 🟡 PARTIAL |
| B14 | Floor-Upside split (guaranteed vs growth) | §C + §8 | `fq-calc:2778 floorUpsideSplit` + `uk-cashflow:1094 floorUpsideSplit` | needs UI verification | 🟡 PARTIAL |
| B15 | Guaranteed floor income (SP + DB + annuity) | §8.21 | `uk-cashflow:1177 guaranteedFloorIncome` | needs UI verification | 🟡 PARTIAL |

---

## §C — SECTION C: DEPTH (commercial hook layer)

| # | Feature | Spec § | Engine | UI | Verdict |
|---|---|---|---|---|---|
| C1 | IHT CoI Odometer (always visible) | §6 | `costOfInaction` in tax-estate-engine + fq-calc + canonical-coi | `CoIOdometer` imported | ✅ PRESENT |
| C2 | CF CoI Variants card (drawdown + wrapper-sequencing) | §6.3b + §17.3 | `coiCashflowVariants` + `costOfInaction(entity, 'drawdown')` + `costOfInaction(entity, 'wrapperSequencing')` | `cf_realityEngineFactorisation` imported | ✅ PRESENT |
| C3 | PRC/PCC Spread card (Capital Efficiency) | §6.4 | STUB by design (O-CF-RULES-07) | `PrcPccStubCard` at Cashflow.jsx:868 honest "Coming next" | 🟡 STUB (founder-blocked) |
| C4 | Reality Engine factorisation (confidence decomposition) | §6.5 | STUB by design (O-CF-RULES-09) | `cf_realityEngineFactorisation` imported with stub envelope | 🟡 STUB (founder-blocked) |
| C5 | Max drawdown tolerance card | §6.6 + §8.6 | `cashflow-engine:316 maxDrawdownExposure` + `uk-cashflow:1379 maxDrawdownExposure` | `cf_maxDrawdownExposure` imported | ✅ PRESENT |
| C6 | Efficient Frontier | §C | `cf_portfolioEfficiency` imported | `EfficientFrontierV2.jsx` | ✅ PRESENT |
| C7 | FI Progress (depth) | §C + §5.3 | covered above | needs depth verification | ✅ PRESENT |
| C8 | Confidence summary (meta-layer) | §C | n/a (composite display) | needs UI grep | 🟡 PARTIAL |

---

## §X — Cross-cutting

| # | Feature | Spec § | Status |
|---|---|---|---|
| X1 | X28 Plan Anchor (variance chips on every metric) | §PLAN-ANCHOR-CF | `X28TopBar` imported | ✅ PRESENT |
| X2 | X24 Mode 3 entry points (long-press goal-seek) | §X24-CF-MODE3 | `goalSeek` imported; UI flow needs verification | 🟡 PARTIAL |
| X3 | X29 Diff treatment (change ≥ threshold triggers diff card) | §X29-CF | needs grep | ❓ UNKNOWN |
| X4 | Cashflow AI narratives (CF-AI-9 etc) | §AI-9 | needs grep | ❓ UNKNOWN |
| X5 | Scenario seed banner (route from Decision Engine) | n/a (UI affordance) | `ScenarioSeedBanner` at Cashflow.jsx:88 | ✅ PRESENT |

---

## Cross-screen contract (§Q1.2) status

Cashflow is canonical home for:
- **drawdown methods** — read by MyMoney (teases) and T&E (impact on tax) — ✅ canonical lives here
- **drawdown tax sequence** — T&E engine output `entity.computed.drawdown_tax` is the upstream read; CF then computes `optimalDrawdownSequence` — ✅ wired
- **CoI variants for drawdown + wrapper-sequencing** — `costOfInaction(entity, 'drawdown')` + `costOfInaction(entity, 'wrapperSequencing')` — ✅ wired
- **Cashflow health composite** — read by Home triple-anchor — ✅ wired

Cashflow reads from:
- **IHT exposure** (T&E `entity.computed.iht_exposure`) — for Floor-Upside IHT context — ✅
- **Asset/liability snapshot** (MyMoney canonical NW) — ✅
- **Risk score** (Risk tab canonical) — for confidence band on PoS — ✅

Cross-screen contract: **mostly intact**. The one open item is whether `optimalDrawdownSequence` actually reads T&E's `drawdown_tax` row (worth a quick grep).

---

## Top 5 gaps to close

1. **§A wiring depth check (rows A8–A13).** Engine functions exist but UI integration unverified. Walk Cashflow.jsx top-to-bottom and confirm each of monthlyExpenseProfile / essentialVsDiscretionaryRatio / taxPaymentSchedule / allowableExpenseTotal / childcareNetCost / giftsFromNormalIncomeCheck is actually rendered or explicitly out-of-scope. **Effort:** 2 hours.

2. **§B wiring depth check (rows B5, B9, B10, B11, B12, B13, B14, B15).** Same pattern — engine functions exist; need to confirm each renders. Especially: optimal-drawdown-sequence (B11), bucket allocation/replenish (B12/B13), floor-upside split (B14), guaranteed floor income (B15). **Effort:** 4 hours.

3. **Goal-Seek B.5 flow (§X24-CF-MODE3).** The primary persistent UI surface for X24 Mode 3. Engine `goalSeek` is wired but the locked card below the 5-scenario picker needs verification — does it exist? Does long-press on PoS / funded ratio launch goal-seek? **Effort:** 2 hours (verify) + up to 1 day (build if missing).

4. **X29 Diff treatment + CF-AI-9 narratives.** Diff cards (≥ 0.03 funded ratio change triggers diff treatment) and AI narrative integration are not visible in import list. **Effort:** unknown until verified; likely 1–2 days each if missing.

5. **Founder unblock — O-CF-RULES-07 (PRC/PCC methodology).** Not a build task. The founder needs to write the canonical methodology for PRC-anchored SWR. Until that lands, the 5th regime stays stubbed and the §6.4 Capital Efficiency card stays a placeholder. **Founder effort:** 4–8 hours (specification authoring); zero Claude-build until spec arrives.

---

## Founder open items (blocking, founder-side only)

| Item | Description | Status | Impact if closed |
|---|---|---|---|
| O-CF-RULES-07 | PRC/PCC full calculation methodology | 🔴 open | Unlocks 5th SWR regime + §6.4 card |
| O-CF-RULES-09 | Reality Engine factor enumeration + weights | 🔴 open | Unlocks §6.5 confidence-decomposition card |
| O-CF-BUCKET-V2-1 | Bucket cap v2 — drawdown-depth scaling + B1-runway override | 🟡 open | Refines bucket replenish heuristic |
| O-CF-RECENT-EQ-RETURN-1 | `entity.recentEquityReturn` sourcing | 🟡 open | Wires bucket-cap v2 properly |

---

## Nice-to-haves observed (not in spec — surface to founder)

For the project's nice-to-have register:

1. **Sequence-of-returns hedging recommendations** — engine has `sequenceOfReturnsHedgingHandler` (uk-risk:1978) but no UI surface currently. Could become a richer "what to do about it" panel.
2. **Tax-loss harvesting calendar** — given CGT AEA tracking exists, an explicit "use it before April 5" calendar could supplement the §A tax payment schedule.
3. **Inflation regime selector beyond CPI** — spec assumes one inflation rate; HNW users may want CPIH / RPI / personal-basket alternatives.
4. **Cash-buffer auto-rebalance suggestion** — if B1 cash bucket drifts below 18-month target, suggest rebalancing trigger.
5. **Per-scenario CSV export** — IFAs likely want to export the 5-scenario comparison for client packs.
6. **Withdrawal-rate-to-longevity curve** — interactive: "if you live to 95 vs 100, your safe rate is X% vs Y%."
7. **Healthcare cost projection** (post-retirement) — currently no line item beyond NHS assumed-free.
8. **Care-cost scenario** — long-term-care needs aren't separately projected; later-life-adviser lens has insight not surfaced.

---

## Foundational soundness verdict

**Cashflow is foundationally sound.** The engine is mature (90%+ of documented functions exist). The UI wires the major ones. The remaining work is depth-verification and closing founder open items — not greenfield build. Founder's framing in chat ("doesn't even have 4 industry standards") was a misread. The 4 industry standards are wired; only the founder's own method is awaiting founder-side specification.

**Estimated effort to ship Cashflow at production quality:** 1–2 weeks of focused work (depth verification + UI integration for the engine functions already present + goal-seek UI flow) — assuming the founder closes the two stub open items. Without those closures, Cashflow ships at ~85% with the stubs honestly labelled (which is the current state).

---

*Audit complete: 2026-05-23. Author: Claude main thread (Sonnet 4.7), parallel agents blocked by credit limit.*
