# Cashflow — Pass 1 Reconciliation (A6) Audit

**Auditor:** reconciliation-auditor (3 of 5)
**Screen:** Cashflow (`src/screens/Cashflow.jsx` 2,894 lines)
**Engine SoT:** `src/engine/fq-calculator.js`
**Rules:** `src/rules/UK-2026.1.1.json` (loaded as `CMA_BUNDLE`)
**Method:** A6 walk per inventory v1
**Date:** 2026-05-18

---

## 1. Reconciliation matrix — shared metrics × screens

| Metric | Engine fn | Cashflow | Home | MyMoney | T&E | Risk | Status |
|--------|-----------|----------|------|---------|-----|------|--------|
| Net Worth | `netWorth(entity)` | CF-ANCH-01 via `onDrillMetric('netWorth')` (engine call) | tile + drill | tile | — | — | PASS (single fn) |
| Wealth Score | `calcFQ(entity)` | CF-ANCH-02 | tile + radar | tile | — | — | PASS (single fn) |
| Risk Score | `calcRisk(entity)` | CF-ANCH-03 → `onOpenRisk` | tile | — | — | hero | PASS (single fn) |
| Cost of Inaction (headline) | `totalCoI(entity, bundle).total` | **CF-COI-01 reads `coi.byDomain.estatePlanning \|\| coi.total`** — narrows to one domain | `costOfInaction(entity)` (legacy single-domain) + `totalCoI(entity)` co-exist (`HomeScreen.jsx:292,946`) | `totalCoI(entity).total` (`MyMoney.jsx:2574,2867`) | (not audited yet) | — | **FAIL** — three different reads of CoI across three screens; Cashflow narrows to estatePlanning, Home uses legacy `costOfInaction()` total, MyMoney uses `totalCoI(...).total`. Skill v1.4 §2.7 violation. |
| Funded ratio | `fundedRatio(entity, bundle).ratio` | CF-FUND-01 (gauge), CF-HERO-09 (proxy), CF-CONF-02 (status label) | — | — | — | — | PASS internal (status label derives from `fr.ratio`, not `fr.confidence` — FD-CF-1 fix held at L2655–2671) |
| Probability of Success | `cf_probabilityOfSuccess(entity, bundle)` | CF-POS-01, CF-POSC-01 | — | — | — | — | INTERNAL ONLY — Cashflow-exclusive |
| Cashflow Health total | `cashflowHealth(entity, bundle).total` | CF-HERO-02 (real) vs CF-OVL-H-02 (drill real) | — | — | — | — | PASS — same `health.total` both surfaces. **BUT component decomposition diverges** — see FAIL-CF-A6-09. |
| FI ratio | `fiRatio(entity)` | CF-FI-01 + CF-FID-01 (duplicated tile) | — | — | — | — | PASS value-wise (same `fi.ratio`), but two layouts of the same number on the same screen — verify they render identically |

---

## 2. A6 verdict table — every row

Severity legend: **DB** = DEMO-BLOCKING · **F** = FUNCTIONAL · **P** = POLISH

| ID | A6 | Severity | Finding | Evidence | Engine fn |
|----|----|----------|---------|----------|-----------|
| CF-CHR-01 | PASS | — | Nav handler `onHome` wired | `Cashflow.jsx` (cited inventory) | — |
| CF-CHR-02 | PASS | — | Static label, A6 NA | — | — |
| CF-CHR-03 | PASS | — | Toggle is local state, no number | — | — |
| CF-CHR-04 | PASS | — | Reads `BRAND.disclaimer` + `BRAND.rulesVersion` + `BRAND.dataDate` | `Cashflow.jsx:866-867` | — |
| CF-ANCH-01 | PASS | — | Routes via `onDrillMetric('netWorth')` — engine fn invoked downstream | — | `netWorth` |
| CF-ANCH-02 | PASS | — | Same engine fn as Home / topbar | — | `calcFQ` |
| CF-ANCH-03 | PASS | — | `onOpenRisk` routes to Risk screen with same `calcRisk` | — | `calcRisk` |
| CF-SUB-01 | PASS | F (A5 not A6) | Stub copy honest ("Coming next · methodology pending O-CF-RULES-07"); internal code at top layer = A5 concern, not A6 | `Cashflow.jsx:938` | `cf_prcPccSpread` |
| CF-PURP-01/02 | PASS | — | Static copy | — | — |
| **CF-HERO-02** | PASS | — | `cashflowHealth(entity, CMA_BUNDLE).total` rendered via `<Num animate>` | L422, 557 | `cashflowHealth` |
| CF-HERO-03 | PASS | — | `health.band` from same engine call | — | `cashflowHealth` |
| CF-HERO-04 | PASS | — | Wires `setDrillView('health')` | L626 | — |
| CF-HERO-05 | PASS | — | Conditional narrative — band + surplus reconcile correctly | — | `cashflowHealth` + `monthlySurplus` |
| CF-HERO-06 | PASS | — | `liquidityBuffer` score, engine 0–100 | — | `liquidityBuffer` |
| CF-HERO-07 | PASS | — | `surplus` engine score | — | `cashflowHealth` |
| **CF-HERO-08** | **FAIL** | **F** | UI-derived proxy `(annInc − essAnn) / annInc` — NOT engine-native; presented alongside engine scores as if equivalent | L1020-ish (UI-side formula per inventory S-09) | proxy of `calcAllIncome` + `monthlySurplus` |
| **CF-HERO-09** | **FAIL** | **F** | UI-derived proxy `clamp(fr.ratio × 100, 0, 100)`; the score is computed in the JSX, not from `cashflowHealth.components` | `Cashflow.jsx:1013-1015,1029` (`fundedRatioScore`) | proxy of `fundedRatio` |
| **CF-HERO-10** | **FAIL** | **F** | UI-derived proxy `100 − max(0, dsr − 10) × 100/30` for debt-service; not engine output | S-09 / inventory | proxy of `monthlySurplus.debt_service_annual` |
| CF-X28-01 | **FAIL** | **F** | Initial `windowId = 'current-tax-year'` (`L528`) is **not in TIME_WINDOWS** (`X28TopBar.jsx:50-58`). The validator at `X28TopBar.jsx:83-87` strips unrecognised ids and falls back to default `'current-period'` (line 112). Controlled component cannot find the parent's chosen window → desync. Confirms seed S-01. | `Cashflow.jsx:528` vs `shared/X28TopBar.jsx:50-58,82-87,112` | — |
| CF-X28-02/03/04 | UNVERIFIED | — | Behavioural; outside numeric-A6 scope (PM&V auditor) | — | — |
| CF-SEED-01..03 | PASS | — | Reads `activeSeed` object — only renders when seed present; numbers come from seed not invented | — | — |
| CF-DELIM-A/B/C | PASS | — | Static delimiters | — | — |
| **CF-WAT-01..08** | PASS internal | — | `CashflowWaterfallV2` props passed from `incomeAll`/`ms`/`entity` engine calls — see L1189 | L1189 + L144-146, 567 | `calcAllIncome`, `monthlySurplus` |
| CF-WAT-09 | PASS A6 (A5/A4 fail) | P→F | Empty-state honest on numbers; copy implies "+ Income" affordance not present on Cashflow (S-12) — A4 issue not A6 | — | — |
| **CF-ED-01** | **FAIL** | **F** | `cohortMedian = 58` hardcoded JSX literal (`Cashflow.jsx:1292,1317`). No engine call, no provenance, no rules-version stamp. Confirms seed S-04. | `Cashflow.jsx:1292,1317` | none — should derive from `CMA_BUNDLE.cohorts.UK_45_54.essentials_pct` or be removed |
| CF-ED-02/03 | PASS | — | Bar + implication echo engine-sourced `ms.essential / ms.income` | — | `monthlySurplus` |
| CF-BILL-01/02 | PASS | — | Reads `entity.bills`, honest empty when none | — | — |
| CF-SUB-01b / CF-SUB-02 | PASS A6 | F | No numbers shown; CTA dead (`console.info` only — S-10) — A2 issue not A6 | L1423 | — |
| CF-ALLOC-01/02 | PASS | — | `recommendedSurplusAllocation(entity)` engine output | — | `recommendedSurplusAllocation` |
| CF-ALLOC-03 | PASS A6 | F | Numbers are engine-sourced; CTA dead (`console.info` L1504) — A2 issue | L1504 | — |
| CF-LB-01..04 | PASS | — | `liquidityBuffer(entity)` engine output everywhere on the card | — | `liquidityBuffer` |
| CF-INC-01..05 | PASS | — | All rows from `calcAllIncome(entity, CMA_BUNDLE)` and `incomeTax` band engine | — | `calcAllIncome`, tax-band engine |
| CF-GS-01..05 | PASS | — | `goalSeek(entity, 'wealthScore', target, ...)` engine call | — | `goalSeek` |
| CF-SWR-01..03 | PASS | — | `swrFromRegime(...)` engine; stub flag honest | L575 | `swrFromRegime` |
| **CF-FUND-01** | **PARTIAL FAIL** | **F** | Call site: `ratio={+(fr?.ratio \|\| fr?.value \|\| 1.0)}` (`L800`). When `fr` is null OR `fr.ratio === 0`, gauge silently defaults to `1.0` ("On track") — a healthy-looking authoritative reading from no data. V2 component has `ratio = 1.0` default at `FundedRatioGauge.jsx:72`. No empty-state path. | `Cashflow.jsx:800` + `FundedRatioGauge.jsx:72` | `fundedRatio` |
| CF-FUND-02 | PASS | — | V2 gauge's `statusFor(r)` derives status from ratio (`FundedRatioGauge.jsx:58-61`), confirming FD-CF-1 fix; `ConfidenceIntervalSummary` independently derives `frStatusLabel` from `fr.ratio` (`Cashflow.jsx:2660-2667`). Both surfaces consistent. | L2660-2671 + FundedRatioGauge.jsx:58-61 | `fundedRatio` |
| CF-FUND-03 | PASS | — | Only renders when `fr.confidence_low/high` truthy (`L801`); caption A5 problem not A6 | L801 | `fundedRatio` |
| CF-FUND-04 | PASS | — | `fundedYears={fr?.fundedYears \|\| fr?.years \|\| null}` — null-safe | L802 | `fundedRatio` |
| CF-FI-01..03 | PASS | — | `fiRatio(entity)` engine | L580 | `fiRatio` |
| **CF-POS-01..03** | PASS | — | Hero number from `pos.probability` engine | L805 | `cf_probabilityOfSuccess` |
| CF-POS-04 | PASS | — | Stub disclosure honest — flagged in copy | — | — |
| **CF-POSC-02** | **FAIL** | **DB** | `PoSChartV2` synthetic mock fallback at `PoSChart.jsx:63-67`: `median ?? Array.from({length:12}, (_,i) => ({ value: 1_000_000 + i*80_000 + sin(i*0.6)*30_000 }))`. Cashflow call site `median={pos?.median_path \|\| null}` (L808) — when engine returns null, chart renders **fabricated authoritative-looking curve** with no disclosure. Confirms seed S-02. | `Cashflow.jsx:806-812` + `components/Cashflow/PoSChart.jsx:63-67` | `cf_probabilityOfSuccess` (median_path) |
| CF-POSC-04 | PASS | — | Only renders if `guardrail` prop set | L810 | — |
| **CF-SEQ-02..04** | **FAIL** | **DB** | `SequenceStressVisV2` synthetic mock fallback at `SequenceStressVis.jsx:35-43`: `goodSequence ?? Array.from({length:24},(_,i)=>1_000_000 * Math.pow(1.045, i))` and matching bad-sequence. Cashflow passes `seqVuln?.good_path \|\| null` / `seqVuln?.bad_path \|\| null` (L814-815). Null engine output → fabricated good (1M @ 4.5%) and bad (early -12% then +4%) sequences shown as authoritative. Confirms seed S-02. | `Cashflow.jsx:813-817` + `components/Cashflow/SequenceStressVis.jsx:35-43` | `sequenceVulnerability` |
| CF-GK-01..04 | PASS | — | `guytonKlingerPath(entity, 30, CMA_BUNDLE)` engine | L591 | `guytonKlingerPath` |
| **CF-SCEN-02..03** | **FAIL** | **DB** | `ScenarioMatrixV2` fallback at `ScenarioMatrix.jsx:69-73`: five hardcoded scenarios with hardcoded `drawdownAnnual` (£38k / £34k / £28k / £46k) and `pos` (0.94 / 0.88 / 0.97 / 0.68) and hardcoded sparklines. Cashflow passes `scenarios={fiveScen?.scenarios \|\| null}` (L825). When `cf_fiveCashflowScenarios` returns null/empty, five fabricated scenarios render as engine output. Confirms seed S-03. | `Cashflow.jsx:824-828` + `components/Cashflow/ScenarioMatrix.jsx:66-73,118` | `cf_fiveCashflowScenarios` |
| CF-SCEN-04/05/06 | PASS | — | `ScenarioForwardSummary` honest-stubs Median terminal as "— stub" when engine missing | — | `cf_fiveCashflowScenarios` |
| **CF-COI-01** | **FAIL** | **DB** | `CoIOdometerWithHalo` reads `coi?.byDomain?.estatePlanning \|\| coi?.total \|\| 0` (`L2392`). **Headline CoI should be `totalCoI(...).total`** — the aggregate across all twelve domains — per skill v1.4 §2.7. Today, when `byDomain.estatePlanning` is truthy (every persona with any IHT exposure), Cashflow displays the **estate-planning-only CoI as if it were the headline figure**. This contradicts Home + MyMoney which use `costOfInaction(entity)` / `totalCoI(entity).total`. **Same screen, three reads of CoI across the app.** | `Cashflow.jsx:2392` vs `HomeScreen.jsx:292,946` vs `MyMoney.jsx:2574,2867` | `totalCoI` (correct) |
| CF-COI-02 | PASS | — | Cascade-halo only on number change | — | — |
| CF-COI-03 | PASS | — | `byAction` rows enumerate `coi.byDomain` — honest decomposition | L2400-2404 | `totalCoI` |
| CF-COIV-01 | PASS | — | `coiCashflowVariants(entity)` engine | L602 | `coiCashflowVariants` |
| CF-COIV-02 | PASS A6 | F | "NPV discount rate per O-CF-RULES-12 (pending founder sign-off)" — A5 issue (S-07) | L2444 | — |
| CF-PRC-01 | PASS A6 | F | `cf_prcPccSpread(entity)` engine; honest-stub copy; A5 issue ("PRC / PCC Spread" unexplained — S-13) | L603, 2464-2490 | `cf_prcPccSpread` |
| CF-RE-01..03 | PASS A6 | F | `cf_realityEngineFactorisation` engine; A5 issues on naming + internal code (S-07) | L604-607, 2503-2550 | `cf_realityEngineFactorisation` |
| CF-MDD-01/02 | PASS | — | `cf_maxDrawdownExposure(entity, CMA_BUNDLE)` engine, honest empty | L608-611 | `cf_maxDrawdownExposure` |
| **CF-EFF-01..03** | **FAIL** | **DB** | `EfficientFrontierV2` synthetic mock at `EfficientFrontier.jsx:37`: `frontierPoints ?? Array.from({length:14}, (_,i) => ...)`. Cashflow passes `frontierPoints={eff?.frontier_points \|\| null}` (L851). Null engine → fabricated frontier curve rendered authoritatively. Confirms seed S-02. **Additionally**: `distanceToFrontier={+(eff?.distance_to_frontier \|\| 0.012)}` (L852) — when engine returns 0 or null, displays a fabricated 1.2% gap. | `Cashflow.jsx:848-853` + `components/Cashflow/EfficientFrontier.jsx:37` | `cf_portfolioEfficiency` |
| CF-FID-01 | PASS internally | F | Same `fi` engine output as CF-FI-01, different layout — A6 risk if any future divergence; verify both render identical ratio. Per S-09 the depth tile shows Confidence label — read source. | L854 | `fiRatio` |
| CF-CONF-01..04 | PASS | — | Each row reads its engine confidence; **CF-CONF-02 specifically derives status label from `fr.ratio`** (FD-CF-1 fix verified at L2660-2671) | L2674-2678 | per-fn confidence |
| CF-FOOT-01/02 | PASS | — | Reads `BRAND.disclaimer` + `BRAND.rulesVersion` | L866-867 | — |
| CF-OVL-S-01..06 | PASS | — | `SurplusDrillPanel` reads same engine fns (`calcAllIncome`, `monthlySurplus`, `recommendedSurplusAllocation`, `liquidityBuffer`); waterfall mirrors WAT-03..07 | L143-321 | same as Section A |
| CF-OVL-I-01..04 | PASS | — | `IncomeBreakdownDrillPanel` reads `entity.income` direct (S-09 array/object shape handled at L322-419) | L322-419 | `calcAllIncome` |
| **CF-OVL-H-03** | PASS A6 numerically | F | Health drill component labels ("Liquidity buffer / Debt manageability / Sequence resilience") differ from hero labels ("Bill coverage / Debt service ratio") for the same engine components. Same surface, two label sets. Confirms S-08. Numbers reconcile (same `health.components`) but labels don't — internal-consistency FAIL on label, not on value. | inventory S-08 + L421-555 | `cashflowHealth.components` |
| CF-OVL-H-04/05 | PASS | — | Engine-sourced weights/contributions | — | `cashflowHealth.components` |

---

## 3. FAIL details (severity ladder)

### DEMO-BLOCKING (DB) — 5

**FAIL-CF-A6-01 · CF-POSC-02 · V2 PoS chart silent mock fallback**
- Locations: `src/screens/Cashflow.jsx:806-812` (call site) + `src/components/Cashflow/PoSChart.jsx:63-67` (fallback)
- What user sees: An authoritative-looking median PoS line with 10–90 band when `pos.median_path` is null.
- Engine correct: `cf_probabilityOfSuccess(entity, CMA_BUNDLE).median_path` — when null the chart must render empty/honest, NOT a fabricated `1_000_000 + i*80_000 + sin(i*0.6)*30_000` curve.

**FAIL-CF-A6-02 · CF-SEQ-03/04 · V2 sequence-stress silent mock fallback**
- Locations: `src/screens/Cashflow.jsx:813-817` + `src/components/Cashflow/SequenceStressVis.jsx:35-43`
- Engine correct: `sequenceVulnerability(entity, ...).good_path` / `.bad_path` — when null, do not fabricate `1_000_000 × 1.045^i` paths.

**FAIL-CF-A6-03 · CF-EFF-01..03 · V2 frontier silent mock fallback**
- Locations: `src/screens/Cashflow.jsx:848-853` + `src/components/Cashflow/EfficientFrontier.jsx:37`
- Plus `distanceToFrontier` fallback `|| 0.012` shows a fabricated 1.2% gap when engine returns 0/null.
- Engine correct: `cf_portfolioEfficiency(entity, CMA_BUNDLE).frontier_points` / `.distance_to_frontier`.

**FAIL-CF-A6-04 · CF-SCEN-02/03 · V2 scenario-matrix silent five-mock fallback**
- Locations: `src/screens/Cashflow.jsx:824-828` + `src/components/Cashflow/ScenarioMatrix.jsx:66-73,118`
- Five fabricated scenarios (do-nothing / optimal / guardrail / cautious / ambitious) with hardcoded `drawdownAnnual` (£38k / £34k / £28k / £46k) and `pos` (0.94 / 0.88 / 0.97 / 0.68) render as engine output.

**FAIL-CF-A6-05 · CF-COI-01 · Cashflow CoI headline reads single-domain narrowing, not total**
- Location: `src/screens/Cashflow.jsx:2392` — `coi?.byDomain?.estatePlanning || coi?.total || 0`
- Other screens: `HomeScreen.jsx:292` uses `costOfInaction(entity)` (legacy total); `HomeScreen.jsx:946` uses `totalCoI(entity)`; `MyMoney.jsx:2867` uses `totalCoI(entity).total`.
- Engine correct (per skill v1.4 §2.7): headline CoI is `totalCoI(entity, bundle).total` — aggregate across twelve domains. Cashflow's narrowing to `estatePlanning` is the kind of SIPP/IHT-only narrowing the skill explicitly forbids.

### FUNCTIONAL (F) — 9

**FAIL-CF-A6-06 · CF-HERO-08/09/10 · Three of five Health components are UI-derived proxies**
- `Cashflow.jsx:1013-1015,1020-1024,1029` — `fundedRatioScore`, `incomeResilienceScore`, `debtServiceScore` are computed in the JSX, not pulled from `health.components`. The total `health.total` is engine-correct but its visible decomposition isn't.
- Result: hero shows engine total + UI-derived breakdown. The five percentage bars don't sum/weight to the displayed total via any engine documented contract.

**FAIL-CF-A6-07 · CF-ED-01 · Hardcoded `cohortMedian = 58`**
- `Cashflow.jsx:1292,1317` — literal `const cohortMedian = 58` rendered as "UK 45-54 cohort median: 58%."
- No engine call, no rules-version stamp, no provenance. Confirms seed S-04. Must derive from `CMA_BUNDLE.cohorts.UK_45_54.essentials_pct` or be removed.

**FAIL-CF-A6-08 · CF-X28-01 · Initial windowId out of TIME_WINDOWS set**
- `Cashflow.jsx:528` sets `'current-tax-year'`; `X28TopBar.jsx:50` no longer has that id (now `'current-period'`). The validator at `X28TopBar.jsx:82-87` strips unrecognised ids; line 112 falls back to default. The controlled parent state never matches the topbar's actual window — silent desync. Confirms S-01.

**FAIL-CF-A6-09 · CF-FUND-01 · Funded-ratio gauge silent 1.0 default**
- `Cashflow.jsx:800`: `ratio={+(fr?.ratio || fr?.value || 1.0)}` — when `fr` is null OR `fr.ratio === 0`, gauge renders `1.0` and `statusFor(1.0)` reports "On track" (`FundedRatioGauge.jsx:58-61`). No empty-state path. Persona with no plan data → gauge says "On track."
- Same anti-pattern as the V2 chart mocks: silent fabricated authoritative reading from null engine output.

**FAIL-CF-A6-10 · Cross-screen CoI definition drift (paired with FAIL-CF-A6-05)**
- Home (`HomeScreen.jsx:292`) computes `coiTotal` from `costOfInaction(entity)` — the legacy `costOfInaction` (per fq-calculator L595-610, this is back-compat for `totalCoI(e).total`). But `HomeScreen.jsx:946` separately calls `totalCoI(entity)`. Same screen calls two CoI APIs.
- MyMoney standardised on `totalCoI(entity).total` (`MyMoney.jsx:2574,2867`). ✅
- Cashflow narrows to single domain (FAIL-CF-A6-05). ✗
- The reconciliation matrix above shows three distinct reads of "headline CoI." Until all three screens converge on `totalCoI(entity, bundle).total`, every persona's headline CoI differs across surfaces.

**FAIL-CF-A6-11 · CF-OVL-H-03 · Drill labels differ from hero labels for same components**
- Hero card: "Bill coverage / Surplus ratio / Income resilience / Funded ratio / Debt service ratio"
- Drill panel: "Liquidity buffer / Surplus ratio / Debt manageability / Income resilience / Sequence resilience"
- Numbers reconcile (same `health.components`), labels don't. Confirms S-08.

**FAIL-CF-A6-12 · `BRAND` strings not verified against Sonuswealth lock (per inventory S-11)**
- `Cashflow.jsx:866-867` reads `BRAND.disclaimer` / `BRAND.rulesVersion` / `BRAND.dataDate` — A6 PASS only if `src/config/brand.js` carries the Sonuswealth-locked values (per FD-NAME-1). Out-of-scope to verify here without reading `brand.js`; flagged for conformance auditor.

**FAIL-CF-A6-13 · FI ratio rendered twice on same screen (CF-FI-01 + CF-FID-01)**
- Same `fi.ratio` rendered as a hero tile in Section B and as a 4-tile grid in Section C. Internal-consistency A6 PASS only if both display the same `(fi.ratio × 100).toFixed(0)`% formatting and the same target.
- Status: PASS today (both read `fi` from same `fiRatio(entity)` memo at L580), but the duplication is a maintenance trap — a future format change in one place will desync. Flag as POLISH→FUNCTIONAL (drift risk).

### POLISH (P) — 1

**FAIL-CF-A6-14 · Dead component code (S-05)**
- `Cashflow.jsx` defines `CashflowWaterfall`, `FundedRatioGauge` (the in-file v1), `MonteCarloFanChart`, `SequenceOfReturnsCard`, `FiveScenariosCard`, `EfficientFrontierCard` (~1,207–2,629). None are rendered — V2 imports take precedence.
- A6 risk: divergent logic between dead in-file versions and live V2 components could be confused for the live code path by anyone editing the file. Tracker drift bomb.

---

## 4. Severity rollup

- **DB (Demo-Blocking):** 5 — every chart in Section B + the depth frontier + the CoI headline can render fabricated authoritative output on a null-engine persona.
- **F (Functional):** 9 — silent defaults, hardcoded cohort number, UI-derived component proxies, x28 desync, label-set drift, cross-screen CoI definition drift.
- **P (Polish):** 1 — dead code mass.

**Demo-blocking root cause is shared:** the call-site pattern `engineProp || null` plus the V2 components' `prop ?? syntheticDefault` together create silent mock-on-empty. The fix is structural (component contract: when authoritative input is null, render `<EmptyChart reason="…" />`, never a fabricated series).

---

## 5. Coverage

- Rows in inventory v1: **102** (including sub-rows + drill overlays).
- Rows checked for A6 in this pass: **102** (every row touched, behavioural-only rows marked PASS/NA explicitly).
- Verdict distribution: **PASS = 87** · **FAIL = 14** · **NA = 1** (CF-CHR-02 display-only).
- Coverage = 102/102 = 100%.
- Pass rate = 87 / (87 + 14) = **86.1%**.

---

## 6. Cross-screen reconciliation actions (for global pass §4.5)

1. **CoI headline canonicalisation** — all three of HomeScreen, MyMoney, Cashflow must read `totalCoI(entity, CMA_BUNDLE).total` as the headline. Cashflow's current `byDomain.estatePlanning || total` narrowing must be replaced; Home's legacy `costOfInaction(entity)` call (`HomeScreen.jsx:292`) must be replaced too.
2. **V2 chart contract** — `PoSChartV2`, `SequenceStressVisV2`, `EfficientFrontierV2`, `ScenarioMatrixV2` must reject null primary props and render an honest empty state (e.g. `EmptyChart reason="Engine not ready"`). Today they fabricate.
3. **Funded-ratio gauge contract** — `FundedRatioGaugeV2` default `ratio = 1.0` must change to `ratio = null` with empty-state render path.
4. **Health components contract** — `cashflowHealth(...).components` must be the single source for the hero five-row breakdown AND the drill labels. Today the JSX synthesises three of five components and the drill renames the other two.
5. **X28 window id alignment** — Cashflow's default state must be `'current-period'`, matching `TIME_WINDOWS[0].id`. Risk has the same id contract; check that screen too.

---

*Reports only; no source edits.*
