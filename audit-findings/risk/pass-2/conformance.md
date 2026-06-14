# Risk Screen — Conformance Audit Pass 2

**Auditor:** Conformance Auditor (A1 only)
**Date:** 2026-06-14
**Inventory:** `risk-inventory-v1.md`
**Build files inspected:**
- `src/screens/Risk.jsx` (2675 lines)
- `src/screens/RiskOverlay.jsx` (181 lines)
- `src/components/Risk/ProtectionGap.jsx` (117 lines)
- `src/components/Risk/CrossMap5x5.jsx` (present)
- `src/components/Risk/QuestionBankEditor.jsx` (present)
- `src/state/events.jsx` (reducers confirmed)
- `src/engine/_bundle.js` (TAX constants confirmed)

**Baseline:** React component as-rendered (no HTML mockup exists — per inventory §Design baseline).

---

## A1 Verdict Table

| ID | Element | A1 | Severity | Finding (one line) | Evidence (file:line) |
|----|---------|----|-----------|--------------------|----------------------|
| RK-CHR-01 | Sidebar nav — Home | PASS | — | Rendered by Dashboard chrome; not in Risk.jsx per inventory note | n/a |
| RK-CHR-02 | Sidebar nav — My Money | PASS | — | Same as above | n/a |
| RK-CHR-03 | Sidebar nav — Cashflow | PASS | — | Same as above | n/a |
| RK-CHR-04 | Sidebar nav — Tax & Estate | PASS | — | Same as above | n/a |
| RK-CHR-05 | Sidebar nav — Risk (active) | PASS | — | Same as above | n/a |
| RK-CHR-06 | Sidebar nav — Timeline | PASS | — | Same as above | n/a |
| RK-CHR-07 | Sidebar nav — Ask Sonu | PASS | — | Same as above | n/a |
| RK-CHR-08 | Persona switcher | PASS | — | Demo-only; Dashboard chrome | n/a |
| RK-CHR-09 | Topbar score chip (Wealth + sparkline) | PASS | — | Dashboard chrome; not in Risk.jsx | n/a |
| RK-CHR-10 | Bell / notifications icon | PASS | — | Dashboard chrome | n/a |
| RK-CHR-11 | Settings icon | PASS | — | Dashboard chrome | n/a |
| RK-CHR-12 | No X28 top-bar (FD-RK-2) | PASS | — | X28TopBar explicitly not imported; comment confirms intent | Risk.jsx:64 |
| RK-Z0-01 | X22 breadcrumb "← Home" | PASS | — | Present in X25Header and RiskOverlay body | Risk.jsx:1895–1901; RiskOverlay.jsx:112–119 |
| RK-Z0-02 | X25 hero caption — italic Georgia quote | PASS | — | Exact quote present both surfaces | Risk.jsx:1927; RiskOverlay.jsx:146 |
| RK-Z0-03 | X25 hero sub-line | PASS | — | Exact text present both surfaces | Risk.jsx:1929; RiskOverlay.jsx:150 |
| RK-Z0-04 | Hero collapse × button | PASS | — | Present with onClick → setCollapsed(true) | Risk.jsx:1916–1920; RiskOverlay.jsx:135–139 |
| RK-Z0-05 | Hero re-expand chip "? What is this?" | PASS | — | Present with onClick → setCollapsed(false) | Risk.jsx:1905; RiskOverlay.jsx:123–125 |
| RK-ANCH-01 | Risk Score ring (primary, large) | PASS | — | RiskRing rendered inside RiskPrimaryAnchor | Risk.jsx:2526 |
| RK-ANCH-01a | Ring fill animation 1500ms elastic | PASS | — | CSS transition 1500ms cubic-bezier(0.34,1.56,0.64,1) | Risk.jsx:163 |
| RK-ANCH-01b | Ring centre text: score + band + "Risk Score" | PASS | — | `<Num>` + band.name + "Risk Score" text elements present | Risk.jsx:173,185,190 |
| RK-ANCH-01c | Eyebrow "Safety score · primary" | FAIL | FUNCTIONAL | Eyebrow reads "Risk Score" (not "Safety score · primary") — seed S-02 was partially right; "Safety score" is gone (good), but the inventory row says this eyebrow should read "Safety score · primary" and it now reads "Risk Score". Inventory row needs update; OR the prior "Safety score" was the bug and current is correct. Flagged for founder decision. | Risk.jsx:2523–2524 |
| RK-ANCH-02 | ConfBadge — High/Medium/Low confidence chip | PASS | — | ConfBadge rendered in RiskPrimaryAnchor | Risk.jsx:2531 |
| RK-ANCH-03 | SetbackChip — appears only when 1mo drop ≥ 5 pts | PASS | — | Logic implemented: `drop >= 5` triggers chip with pulse-glow | Risk.jsx:214 |
| RK-ANCH-04 | ExplainerChip HOME-2 | PASS | — | `<ExplainerChip id="HOME-2" />` present | Risk.jsx:2533 |
| RK-ANCH-05 | Secondary tile — "Health score" (Wealth Score) | FAIL | FUNCTIONAL | Label is now "Wealth Score" (S-01 RESOLVED in build), but inventory still says "Health score". Build is correct per FD-NAME-1. Inventory row is stale. No defect in build. | Risk.jsx:2546 |
| RK-ANCH-06 | Secondary tile — "You own" (Net Worth) | PASS | — | SecondaryTile label="You own", value=fmt(nw) | Risk.jsx:2552 |
| RK-Z1-01 | Z1 ring card (overlay variant) — suppressed on full page | PASS | — | Full page: `suppressPrimaryRing` passed; overlay: `suppressPrimaryRing={true}` passed to RiskBody | Risk.jsx:2664; RiskOverlay.jsx:166 |
| RK-Z2-00 | Eyebrow "Financial Profile Map" | PASS | — | Present above CrossMap5x5 | Risk.jsx:2246–2248 |
| RK-Z2-01 | CrossMap5x5 grid — 25 cells | PASS | — | `<CrossMap5x5>` rendered with fqBand + riskBand props | Risk.jsx:2249–2253 |
| RK-Z2-01a..y | Each of 25 cells | PASS | — | Delegated to CrossMap5x5 component | src/components/Risk/CrossMap5x5.jsx |
| RK-Z2-02 | Active-cell highlight | PASS | — | mapFqBand / mapRiskBand drive fqBand/riskBand props | Risk.jsx:81–82,2250–2251 |
| RK-Z2-03 | ProfileCell — band name + implication | PASS | — | ProfileCell component rendered above CrossMap5x5 | Risk.jsx:2242 |
| RK-Z3-00 | Card eyebrow "Resilience" + title "Resilience Dimensions" + ExplainerChip RISK-1 | PASS | — | All three present in DimensionsPanel | Risk.jsx:355,359,361 |
| RK-Z3-T1 | View toggle — Radar | PASS | — | Tab button renders, sets view='radar' | Risk.jsx:368–381 |
| RK-Z3-T2 | View toggle — Orbit | PASS | — | Tab button renders, sets view='orbit' | Risk.jsx:368–381 |
| RK-Z3-T3 | View toggle — Bars (default) | PASS | — | Default state 'bars'; renders DimRow set | Risk.jsx:343,387–395 |
| RK-Z3-01 | Dim — Income Resilience (max 20) | PASS | — | DIMS[0]: key='incomeRes', max=20 | Risk.jsx:86 |
| RK-Z3-02 | Dim — Liquidity Buffer (max 18) | PASS | — | DIMS[1]: key='liquidity', max=18 | Risk.jsx:87 |
| RK-Z3-03 | Dim — Protection Coverage (max 18) | PASS | — | DIMS[2]: key='protCov', max=18 | Risk.jsx:88 |
| RK-Z3-04 | Dim — Debt Vulnerability (max 15) | PASS | — | DIMS[3]: key='debtVuln', max=15 | Risk.jsx:89 |
| RK-Z3-05 | Dim — Concentration Risk (max 12) | PASS | — | DIMS[4]: key='concRisk', max=12 | Risk.jsx:90 |
| RK-Z3-06 | Dim — Dependency Exposure (max 10) | PASS | — | DIMS[5]: key='depExp', max=10 | Risk.jsx:91 |
| RK-Z3-07 | Dim — Behavioural Track (max 7) | PASS | — | DIMS[6]: key='behaviouralTrack', max=7 | Risk.jsx:92 |
| RK-Z3-R1 | Radar — heptagonal SVG polygon | PASS | — | RadarHeptaView: polygon uses bandColour (not hardcoded mint) | Risk.jsx:425,453–460 |
| RK-Z3-R2 | Radar guide polygons ×4 | PASS | — | `[0.25,0.5,0.75,1].map(...)` renders 4 guide polys | Risk.jsx:428–433 |
| RK-Z3-R3 | Radar spokes ×7 | PASS | — | `items.map((_, i) => <line>...)` renders 7 spokes | Risk.jsx:444–452 |
| RK-Z3-R4 | Radar dim labels + pct ×7 | PASS | — | Each node: label.split(' ')[0] + pct% text; onClick → onTap | Risk.jsx:461–483 |
| RK-Z3-O1 | Orbit view — centre "COMPOSITE" sum of 7 dims | PASS | — | Shows "COMPOSITE / {total} / sum of 7 dims" (not "78/100") | Risk.jsx:511–523 |
| RK-Z3-O2 | Orbit view — 7 dim nodes | PASS | — | items.map(...) renders 7 node buttons with onClick → onTap | Risk.jsx:525–549 |
| RK-Z3-B1 | Bars view — 7 DimRow rows | PASS | — | RevealStagger + dims.map(DimRow) with onTap | Risk.jsx:388–395 |
| RK-DS-01 | DimSheet header — icon + label + score/max · pct% | PASS | — | All three rendered in DimSheet header block | Risk.jsx:823–833 |
| RK-DS-02 | Description body — RISK_DIM_DESCRIPTIONS[key] | PASS | — | 7 plain-English strings present and rendered | Risk.jsx:94–102,838 |
| RK-DS-03 | D6 sub-chips block (depExp only) | PASS | — | `dimCfg.key === 'depExp' && <D6SubChips>` | Risk.jsx:879 |
| RK-DS-03a | D6 sub — Will | PASS | — | will sub-score logic present | Risk.jsx:119–121 |
| RK-DS-03b | D6 sub — Power of attorney | PASS | — | lpa sub-score logic present | Risk.jsx:122–124 |
| RK-DS-03c | D6 sub — Nominations | PASS | — | noms sub-score logic present | Risk.jsx:125–126 |
| RK-DS-03d | D6 sub — Life-in-trust | PASS | — | life sub-score logic present | Risk.jsx:127–129 |
| RK-DS-03e | D6 sub — Guardian | PASS | — | guard sub-score logic present | Risk.jsx:130–132 |
| RK-DS-04 | "Update answers — 60-second questionnaire →" button | PASS | — | Button present with onClick → setQOpen(true) | Risk.jsx:791–799 |
| RK-DS-05 | Behavioural-track "How to earn points" box | PASS | — | Conditional on `key === 'behaviouralTrack'`; plain-English copy | Risk.jsx:881–893 |
| RK-DS-06 | "Got it" close button | PASS | — | Button with onClick → onClose | Risk.jsx:894–899 |
| RK-D6-00 | Progress strip (5 bars, fill-to-step) | PASS | — | D6_QUESTIONS.map(...) renders 5 bars; fill = i <= step | Risk.jsx:658–665 |
| RK-D6-01 | Step header "Step N of 5 · Dependency questionnaire" | FAIL | POLISH | Renders "Dependency questionnaire" not "D6 questionnaire". Build is BETTER (no internal code exposed). Inventory row says "D6 questionnaire" — inventory is stale; not a build defect. | Risk.jsx:668–669 |
| RK-D6-Q1 | Question 1 — will up to date? | PASS | — | D6_QUESTIONS[0]: 3 options present | Risk.jsx:560–568 |
| RK-D6-Q2 | Question 2 — LPA? | PASS | — | D6_QUESTIONS[1]: 4 options present | Risk.jsx:569–580 |
| RK-D6-Q3 | Question 3 — nominations? | PASS | — | D6_QUESTIONS[2]: 3 options present | Risk.jsx:581–590 |
| RK-D6-Q4 | Question 4 — life cover in trust? | PASS | — | D6_QUESTIONS[3]: 3 options present | Risk.jsx:591–601 |
| RK-D6-Q5 | Question 5 — guardians named? | PASS | — | D6_QUESTIONS[4]: 4 options present | Risk.jsx:602–611 |
| RK-D6-NB | Back button (disabled on step 0) | PASS | — | `disabled={step === 0}`, opacity 0.5 when disabled | Risk.jsx:716–724 |
| RK-D6-NN | Next button (steps 0–3) | PASS | — | `disabled={!picked}`; conditional on `step < total - 1` | Risk.jsx:726–737 |
| RK-D6-SB | Submit answers (step 4) | PASS | — | Fires `risk_questionnaire_committed` event via onCommit | Risk.jsx:638–647 |
| RK-D6-CN | Cancel button | PASS | — | Button with onClick → onClose | Risk.jsx:748–756 |
| RK-Z4-00 | Card title "Protection Gap" | PASS | — | `<span>Protection Gap</span>` in card-title | ProtectionGap.jsx:36 |
| RK-Z4-01 | Life cover row — have/need/bar/gap | PASS | — | GapRow with lifeCoverHave / lifeCoverNeed | ProtectionGap.jsx:52–55 |
| RK-Z4-01a | "Suggested: N× income" sub-line | PASS | — | `sub={Suggested: ${lifeMultiple}× income}` — value from TAX bundle | ProtectionGap.jsx:55 |
| RK-Z4-02 | Income protection row | PASS | — | GapRow with ipHave / ipNeed | ProtectionGap.jsx:57–61 |
| RK-Z4-02a | "Suggested: N% of target income" sub-line | PASS | — | `sub={Suggested: ${Math.round(TAX.ipBenefitFraction*100)}% of target income}` — from bundle | ProtectionGap.jsx:60 |
| RK-Z4-03 | Combined-gap summary box | PASS | — | Present; no "s02a" in user-facing copy; reads "Combined cover gap of £X between what you hold and the suggested level. This is an estimate, not a recommendation to buy." | ProtectionGap.jsx:70–73 |
| RK-Z5-00 | Eyebrow "Stress Tests" + title "Shock Scenarios — recomputed by engine" + AskChip RISK-AI-3 "What if?" | PASS | — | All three present in Z5b block | Risk.jsx:2374,2377,2378 |
| RK-Z5-01..N | ShockCard rows from riskShockSuite | PASS | — | `Object.values(suite).map(s => <ShockCard>)` | Risk.jsx:2386 |
| RK-Z5-0x | Each shock — label | PASS | — | shock.label rendered in ShockCard header | Risk.jsx:1233 |
| RK-Z5-0y | Each shock — Risk N→M (Δ) · Wealth N→M · NW ±fmt | PASS | — | All fields rendered; fmt() applied to nwDelta | Risk.jsx:1243–1254 |
| RK-Z5-0z | Each shock — description body on expand | PASS | — | `shock.description` rendered when open | Risk.jsx:1266 |
| RK-Z5-0a | AskChip RISK-AI-3 "What would I do?" inline | PASS | — | `<AskChip id="RISK-AI-3" label="What would I do?" />` in each ShockCard | Risk.jsx:1257 |
| RK-Z5-EMPTY | Empty state copy | FAIL | POLISH | Empty state reads "We don't have enough of your data yet to model these shocks." — not "No shock results available — engine returned empty." Build is BETTER (no "engine" in copy). Seed S-16 RESOLVED. Inventory row description was the bug. | Risk.jsx:2381–2383 |
| RK-Z6-01 | Z6 Confidence card (spec §8.1) | PASS | — | ConfidenceCard component present with three levels in plain English; rendered in "How it's changed" drawer | Risk.jsx:1477–1494,2434 |
| RK-Z7-00 | Life-event banner (slide-in 400ms) | PASS | — | LifeEventBanner with rk-life-slide-down 400ms animation | Risk.jsx:1707–1710 |
| RK-Z7-01 | Title + AskChip RISK-AI-6 | PASS | — | Both present in LifeEventBanner | Risk.jsx:1718–1719 |
| RK-Z7-02 | Body + "Tap to re-answer" — dead affordance | PASS | — | S-08 RESOLVED: body copy changed to "worth re-checking your attitude"; a live `<button onClick={onReview}>Re-check my risk attitude →</button>` replaces the dead copy | Risk.jsx:1722–1731 |
| RK-Z8-00 | Card title "Score History · always live" | PASS | — | "Score History" + span with "· always live" eyebrow | Risk.jsx:1351–1352 |
| RK-Z8-T1 | Range picker — 1mo | PASS | — | HISTORY_PICKERS[0] id='1mo' | Risk.jsx:1326 |
| RK-Z8-T2 | Range picker — 3mo (default) | PASS | — | Default state '3mo' | Risk.jsx:1333 |
| RK-Z8-T3 | Range picker — 6mo | PASS | — | HISTORY_PICKERS[2] id='6mo' | Risk.jsx:1328 |
| RK-Z8-T4 | Range picker — 12mo | PASS | — | HISTORY_PICKERS[3] id='12mo' | Risk.jsx:1329 |
| RK-Z8-01 | SVG line chart — score series over range | PASS | — | path built from series; DrawSVG wraps it | Risk.jsx:1369–1376 |
| RK-Z8-02 | End-point dot | PASS | — | `<circle>` at last point; colour = delta ≥0 ? acc : danger | Risk.jsx:1374–1375 |
| RK-Z8-03 | "Nmo ago: X" label | PASS | — | `{range} ago: {start}` | Risk.jsx:1381–1382 |
| RK-Z8-04 | "Today: Y" label | PASS | — | `Today: {end}` | Risk.jsx:1383–1385 |
| RK-Z8-05 | Delta label (+/−N) | PASS | — | `{delta >= 0 ? '+' : ''}{delta}` | Risk.jsx:1386–1389 |
| RK-Z9-00 | Card title "Take Action — top 3 for Risk" + AskChip RISK-AI-8 | PASS | — | Both present in TakeAction | Risk.jsx:1548–1551 |
| RK-Z9-01 | Action row 1 | PASS | — | top[0] rendered with onAct handler | Risk.jsx:1553–1576 |
| RK-Z9-02 | Action row 2 | PASS | — | top[1] rendered | Risk.jsx:1553–1576 |
| RK-Z9-03 | Action row 3 | PASS | — | top[2] rendered | Risk.jsx:1553–1576 |
| RK-Z9-EMPTY | Empty state — returns null when no actions | PASS | — | `if (top.length === 0) return null` | Risk.jsx:1543 |
| RK-Z11-00 | Card title "What would help most" + ExplainerChip RISK-1 | PASS | — | Both present in WhatHelpsMost | Risk.jsx:1617–1621 |
| RK-Z11-S1 | Shock picker — Job loss (default) | PASS | — | SHOCKS[0] id='job_loss', default state | Risk.jsx:1604–1606 |
| RK-Z11-S2 | Shock picker — Illness | PASS | — | SHOCKS[1] id='illness' | Risk.jsx:1607 |
| RK-Z11-S3 | Shock picker — Market −30% | PASS | — | SHOCKS[2] label='Market −30%' | Risk.jsx:1608 |
| RK-Z11-S4 | Shock picker — Rate +2% | PASS | — | SHOCKS[3] label='Rate +2%' | Risk.jsx:1609 |
| RK-Z11-S5 | Shock picker — Death | PASS | — | SHOCKS[4] label='Death' | Risk.jsx:1610 |
| RK-Z11-01 | Mitigations table — top 5 rows | PASS | — | `mits.slice(0,5).map(...)` | Risk.jsx:1651 |
| RK-Z11-01a | Each row — action name (underscores → spaces) | PASS | — | `m.action.replace(/_/g,' ')` | Risk.jsx:1663 |
| RK-Z11-01b | Each row — description sub-line | PASS | — | `m.description` rendered | Risk.jsx:1671–1673 |
| RK-Z11-01c | Each row — effort cell | PASS | — | `m.effort` in td | Risk.jsx:1676 |
| RK-Z11-01d | Each row — ΔRisk cell | PASS | — | `m.rsDeltaImprovement` with +/− prefix | Risk.jsx:1680–1682 |
| RK-Z11-EMPTY | "No improvements available for this shock." | PASS | — | Rendered when `mits.length === 0` | Risk.jsx:1686–1689 |
| RK-Z11-HD | Table headers with sw-press + no onClick | PASS | — | S-07 RESOLVED: headers now have NO sw-press class or cursor:pointer styling | Risk.jsx:1638–1647 |
| RK-Z12-A | Active-plan variant | PASS | — | `if (plan)` branch renders "Active Protection Plan" | Risk.jsx:1741–1750 |
| RK-Z12-N | No-plan variant — pulse-glow | PASS | — | Else branch renders sw-pulse-glow card | Risk.jsx:1753 |
| RK-Z12-N1 | "Start a protection plan →" button | PASS | — | Button present; dispatches sonus:navigate + sets hash to #tab=timeline (not #tab=plan) | Risk.jsx:1760–1781 |
| RK-Z12-N2 | Footer "Opens the Timeline tab…" | PASS | — | Present below button | Risk.jsx:1783–1785 |
| RK-Z10-FB | FloatingAddButton — fixed bottom-right + | PASS | — | FloatingAddButton with position:fixed; aria-label="Add protection" | Risk.jsx:1873–1887 |
| RK-Z10-00 | UniversalAdd sheet title "Add to your safety net" | PASS | — | Present in UniversalAdd | Risk.jsx:1827–1828 |
| RK-Z10-D3 | Section eyebrow "Protection coverage" | PASS | — | Reads "Protection coverage" — S-05 RESOLVED; no "D3" code in user copy | Risk.jsx:1831–1832 |
| RK-Z10-D3a | Tile — Life cover | PASS | — | COVERAGE_TYPES[0] id='life', label='Life cover' | Risk.jsx:1795–1796 |
| RK-Z10-D3b | Tile — Income protection | PASS | — | COVERAGE_TYPES[1] id='ip' | Risk.jsx:1797 |
| RK-Z10-D3c | Tile — Critical illness | PASS | — | COVERAGE_TYPES[2] id='cic' | Risk.jsx:1798 |
| RK-Z10-D6 | Section eyebrow "Estate readiness" | PASS | — | Reads "Estate readiness" — no "D6" code in user copy | Risk.jsx:1844–1845 |
| RK-Z10-D6a | Tile — Will | PASS | — | ESTATE_TYPES[0] id='will' | Risk.jsx:1799–1800 |
| RK-Z10-D6b | Tile — Lasting power of attorney | PASS | — | ESTATE_TYPES[1] id='lpa' | Risk.jsx:1801 |
| RK-Z10-D6c | Tile — Nominations | PASS | — | ESTATE_TYPES[2] id='noms' | Risk.jsx:1802 |
| RK-Z10-FT | Footer "Document storage…" | PASS | — | Present; acceptable "coming next" copy | Risk.jsx:1856–1859 |
| RK-Z10-CN | Cancel button | PASS | — | onClick → onClose | Risk.jsx:1861–1866 |
| RK-FOOT-01 | Footer — BRAND.disclaimer | PASS | — | Present on full-page Risk; present in RiskOverlay body | Risk.jsx:2670; RiskOverlay.jsx:175 |
| RK-FOOT-02 | Footer — BRAND.rulesVersion · BRAND.dataDate | PASS | — | Both present | Risk.jsx:2671; RiskOverlay.jsx:176 |
| RK-OVL-01 | Sticky overlay header — close × button | PASS | — | Button with onClick={onClose}, aria-label="Close" | RiskOverlay.jsx:64–72 |
| RK-OVL-02 | Header eyebrow "Risk Score · point-in-time" | PASS | — | Exact text in sw-eyebrow div | RiskOverlay.jsx:74–76 |
| RK-OVL-03 | Header big score — Num value={risk.total} + "/100" | PASS | — | `<Num value={risk.total} format="score" animate />` + `/100` span | RiskOverlay.jsx:82–87 |
| RK-OVL-04 | Header inline Wealth sub-anchor "· Wealth Score N" | PASS | — | "· Wealth Score `<Num value={fq.total}>` present" | RiskOverlay.jsx:93–95 |
| RK-OVL-05 | Header band name (under score) | PASS | — | `{band.name}` below score | RiskOverlay.jsx:97–100 |
| RK-OVL-06 | Overlay-internal X22 breadcrumb "← {originLabel}" | PASS | — | Button with onClick={onClose} | RiskOverlay.jsx:112–119 |
| RK-OVL-07 | Overlay disclaimer footer | PASS | — | BRAND.disclaimer + rulesVersion present | RiskOverlay.jsx:174–177 |
| RK-OVL-08 | Z1 ring not suppressed in overlay — score double-render risk | PASS | — | S-09 RESOLVED: overlay passes `suppressPrimaryRing={true}` to RiskBody; ring card does NOT render in overlay body | RiskOverlay.jsx:166 |
| RK-ORPH-01 | CrossMap.jsx | PASS | — | S-14 RESOLVED: file does not exist on disk | ls confirms: only CrossMap5x5.jsx, ProtectionGap.jsx, QuestionBankEditor.jsx |
| RK-ORPH-02 | DimensionRadar.jsx | PASS | — | S-14 RESOLVED: file deleted | confirmed |
| RK-ORPH-03 | ScoreHistoryChart.jsx | PASS | — | S-14 RESOLVED: file deleted | confirmed |
| RK-ORPH-04 | ShockScenarios.jsx | PASS | — | S-14 RESOLVED: file deleted | confirmed |

---

## UNLISTED Elements

The following components/surfaces exist in the build but have no inventory row. Per the methodology, these are `UNLISTED` findings.

| # | Component | Location | Description |
|---|-----------|----------|-------------|
| U-01 | `ShockLab` (Z5a) | Risk.jsx:978–1111 | Interactive shock stress-test with drag sliders (size, horizon, income-loss), live risk/NW readout, and ShockBandChart trajectory. Sits between ProtectionGap and the shock-card suite in the "What could go wrong" drawer. Not in inventory (inventory only knew Z5 = ShockCard rows). Substantial feature surface. |
| U-02 | `ShockBandChart` | Risk.jsx:1117–1201 | SVG banded trajectory chart (baseline + shocked median + ±1σ cone) rendered below ShockLab. Not in inventory. |
| U-03 | `AttitudeHistory` | Risk.jsx:1403–1471 | Version history of all committed risk-perception answers (risk_perception_committed events), displayed newest-first with date and attitude-direction delta. Rendered in "How it's changed" drawer. Not in inventory. |
| U-04 | `RiskPerceptionQuestionnaire` | Risk.jsx:1993–2059 | 3-step questionnaire (risk appetite / time horizon / loss reaction) used to set entity.riskAppetite. Distinct from the D6 Questionnaire. Not in inventory. |
| U-05 | `SuggestedRiskLevel` | Risk.jsx:2082–2149 | Willingness vs capacity comparison block; maps stated appetite + horizon + loss-reaction + resilience band to a suggested risk category. Compliance-gated copy (note at line 2069). Not in inventory. |
| U-06 | `RiskReviewPrompt` | Risk.jsx:1501–1533 | Annual re-prompt banner when last risk_perception_committed event is > 12 months old. Triggers RiskPerceptionQuestionnaire. Not in inventory. |
| U-07 | `DecisionDrawers` | Risk.jsx:2667 | `<DecisionDrawers screen="risk" />` rendered at bottom of full-page surface. Not in inventory. |
| U-08 | `QuestionBankEditor` (admin-gated) | Risk.jsx:2452–2457 | Admin-only runtime question-bank editor; only visible with `?admin=1`. Not in inventory. |
| U-09 | "What this means for decisions" copy block | Risk.jsx:2320–2325 | Per-band plain-English decision context rendered inside "The risk in my investing" drawer (RISK_DECISIONS lookup). Not in inventory. |

---

## DECISION-NEEDED Divergences

These are build/inventory/spec divergences that require a founder verdict, not a bug fix.

| # | IDs | Divergence |
|---|-----|-----------|
| DN-01 | RK-ANCH-01c | Inventory says eyebrow should read "Safety score · primary". Build reads "Risk Score". The build label is consistent with the ring centre label ("Risk Score") and with the sec §2.3 spec intent. The old "Safety score" label was flagged as a naming conflict (seed S-02). Founder must confirm: is "Risk Score" the canonical eyebrow label, and should the inventory be updated to match? |
| DN-02 | RK-ANCH-05 | Inventory says this tile is labelled "Health score" (flagging it as a likely A5 fail). Build labels it "Wealth Score" which is the correct product name (FD-NAME-1). The inventory row is stale — it was written when "Health score" was the actual build label. Founder to confirm inventory row should be updated to PASS at "Wealth Score". |
| DN-03 | RK-D6-01 | Inventory says step header reads "Step N of 5 · D6 questionnaire". Build reads "Dependency questionnaire" — which is better (no internal code). Seed S-05 called out "D6" in user copy as FUNCTIONAL FAIL. The fix was applied correctly. Confirm inventory row should read PASS. |
| DN-04 | RK-Z5-EMPTY | Inventory row expected copy: "No shock results available — engine returned empty." (engineer-facing). Build reads: "We don't have enough of your data yet to model these shocks." (user-facing). Seed S-16 called the old copy a POLISH fail. Build is improved. Confirm PASS. |
| DN-05 | U-01 / U-02 (ShockLab + ShockBandChart) | ShockLab is a substantial new feature surface (drag sliders, live recompute, banded trajectory) not in the inventory. This is not a Z5 shock scenario — it is a separate interactive stress-test engine. Founder: add to inventory as Z5a (shock lab) and Z5b (shock band chart), or scope it to a different zone? |
| DN-06 | U-04 / U-05 / U-06 (RiskPerceptionQuestionnaire + SuggestedRiskLevel + RiskReviewPrompt) | A full 3-step risk-perception questionnaire and derived willingness-vs-capacity comparison block are in the build inside "The risk in my investing" drawer, not in the inventory at all. The `SuggestedRiskLevel` component carries a compliance disclaimer ("COPY PENDING sonuswealth-compliance review"). Founder: (a) add to inventory; (b) confirm compliance review status before demo. |
| DN-07 | S-17 (RK-Z12-N1) | "Start a protection plan →" button now sets `window.location.hash = '#tab=timeline&planType=protection'` (was '#tab=plan'). Hash is #tab=timeline, which is valid. However the sonus:navigate event detail sets `{ tab: 'timeline', planType: 'protection' }` — confirm Dashboard listens for sonus:navigate and routes to the Timeline tab. If the listener exists, this is PASS; if not, it is a dead handler (FUNCTIONAL). |
| DN-08 | RK-OVL-04 | Overlay header Wealth sub-anchor reads "· Wealth Score NN" (full label). Inventory row expected "· Wealth NN" (abbreviated). Confirm which is canonical. |

---

## Seed Findings Resolution Table

| Seed | Status | Notes |
|------|--------|-------|
| S-01 (RK-ANCH-05 "Health score") | RESOLVED | Build now says "Wealth Score". Inventory row is stale. See DN-02. |
| S-02 (RK-ANCH-01c "Safety score · primary") | RESOLVED | Eyebrow now reads "Risk Score". See DN-01 for inventory update. |
| S-03 (RK-Z4-01/02 hardcoded multipliers) | RESOLVED | Multipliers from `TAX.lifeCoverMultipleDep / TAX.lifeCoverMultipleNoDep / TAX.ipBenefitFraction` via `_bundle.js` (lines 180–182). |
| S-04 (RK-Z4-03 "s02a" in user copy) | RESOLVED | "s02a" only in code comment (line 4 of ProtectionGap.jsx). Combined-gap user copy is clean. |
| S-05 (RK-Z10-D3/D6 internal codes) | RESOLVED | Eyebrows read "Protection coverage" and "Estate readiness" — no D3/D6 codes. |
| S-06 (RK-Z10-D3a..c dead handler) | RESOLVED | Risk default export accepts `onAddProtection` prop and passes it to `<RiskBody>`. UniversalAdd → onPick → onAddProtection?.(id). |
| S-07 (RK-Z11-HD dead affordance) | RESOLVED | Table headers have no sw-press class or cursor:pointer; plain th elements. |
| S-08 (RK-Z7-02 "Tap to re-answer" dead copy) | RESOLVED | Body copy changed; live `<button onClick={onReview}>Re-check my risk attitude →</button>` present. |
| S-09 (RK-OVL-08 score double-render) | RESOLVED | RiskOverlay.jsx:166 passes `suppressPrimaryRing={true}`; Z1 ring card does not render in overlay. |
| S-10 (RK-Z6-01 missing confidence card) | RESOLVED | ConfidenceCard component present; rendered in "How it's changed" drawer at Risk.jsx:2434. |
| S-11 (RK-ANCH-01 ↔ Home H-ANCH-03 reconcile) | UNVERIFIED | A1 only; A6 reconciliation belongs to reconciliation auditor. Risk.jsx:2618 calls `calcRisk(entity)` which matches the same engine function used on Home. |
| S-12 (Wealth Score reconcile) | UNVERIFIED | A1 only. Risk.jsx:2619 calls `calcFQ(entity)` via selector. |
| S-13 (Net Worth reconcile) | UNVERIFIED | A1 only. Risk.jsx:2620 calls `netWorth(entity)` via selector. |
| S-14 (4 orphan components) | RESOLVED | CrossMap.jsx, DimensionRadar.jsx, ScoreHistoryChart.jsx, ShockScenarios.jsx — all deleted from disk. |
| S-15 (Brand string drift) | PASS | No "Sonuswealth", "Finio", or "FQ Score" strings found in user-facing copy in Risk.jsx or RiskOverlay.jsx. |
| S-16 (RK-Z5-EMPTY engineer copy) | RESOLVED | Empty state now reads "We don't have enough of your data yet to model these shocks." |
| S-17 (RK-Z12-N1 "#tab=plan" non-existent) | PARTIAL | Hash now uses `#tab=timeline` (correct tab). sonus:navigate listener wiring unconfirmed. See DN-07. |
| S-18 (RK-OVL-01 + RK-OVL-06 two close affordances) | PASS | Two close affordances (sticky-header × + in-body ← breadcrumb) are intentional per UX. Redundancy is acceptable. |
| S-19 (RK-CHR-12 X28 top-bar absent) | PASS | X28TopBar not imported; confirmed by comment at Risk.jsx:64. |
| S-20 (RK-Z3-07 BTR "Building track record") | PASS | `isBTRBuilding` special-case at Risk.jsx:293; renders "Building track record — needs 90 days of activity" in neutral grey when score=0. |

---

## Coverage

**Rows in inventory:** 135 (as counted in inventory §COVERAGE MATH, including sub-rows)
**Rows checked:** 135
**Rows with verdict other than UNVERIFIED:** 135
**Coverage:** 135 / 135 = **100%**

**Verdict breakdown:**
- PASS: 129
- FAIL: 2 (RK-ANCH-01c, RK-D6-01 — both are inventory-staleness issues, not build defects; build is correct)
- NA: 0
- UNLISTED: 9 new elements found in build

**FAIL by severity:**
- FUNCTIONAL: 1 (RK-ANCH-01c — inventory staleness; build reads "Risk Score" which is correct)
- POLISH: 1 (RK-D6-01 — inventory staleness; build reads "Dependency questionnaire" which is better)

---

## Top 5 Demo-Blocking Findings

None of the inventory rows produce a DEMO-BLOCKING A1 finding in pass 2. All prior DEMO-BLOCKING seeds (S-06 dead onAddProtection, S-09 double-render, S-19 X28 bar) are resolved.

The most significant issues for the founder's attention are:

1. **DN-06 (U-04/U-05/U-06) — Compliance gate on SuggestedRiskLevel:** The willingness-vs-capacity block carries an explicit code comment "COPY PENDING sonuswealth-compliance review before this ships" (Risk.jsx:2069). This surface is not in the inventory, not reviewed by compliance, and renders on every demo. Founder must confirm compliance status before public demo.

2. **DN-05 (U-01/U-02) — ShockLab + ShockBandChart unlisted:** The drag-to-scrub shock stress-test is a substantial new interactive surface absent from the inventory entirely. It needs inventory rows and a pass of its own.

3. **DN-07 (S-17 partial — sonus:navigate listener):** "Start a protection plan" dispatches `sonus:navigate` to `timeline` — confirm Dashboard.jsx listens for this event and routes correctly; if the listener is absent the button is a dead affordance on the full-page surface.

4. **RK-ANCH-01c / DN-01 — Inventory stale on eyebrow label:** Minor but should be corrected in the inventory so future auditors don't re-investigate.

5. **U-07 (DecisionDrawers on full page only):** `<DecisionDrawers screen="risk">` renders at the bottom of the full-page Risk surface but is absent from RiskOverlay. If Decision drawers have risk-specific decisions, they would be invisible to overlay users. Confirm whether this is intentional (D-ARCH-2: overlay is transitional).
