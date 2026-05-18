# Risk Screen — Pass 1 Conformance Audit (A1)

**Auditor:** conformance-auditor
**Method:** A1 walk against `risk-inventory-v1.md`. Element present in build? Matches baseline region/content/state? Anything in build not in inventory → `UNLISTED`.
**Files inspected:** `src/screens/Risk.jsx` (1645 lines), `src/screens/RiskOverlay.jsx` (172 lines), `src/components/Risk/ProtectionGap.jsx`, `src/config/brand.js`, `src/components/Risk/{CrossMap,DimensionRadar,ScoreHistoryChart,ShockScenarios}.jsx` (orphan check).
**Scope:** A1 only. Drill (A2/A3/A4), Plain English (A5), Reconciliation (A6) belong to other auditors — referenced here only when A1 status hinges on them.

---

## A1 Verdict Table

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| **Region 1 — Shell / chrome** |||||
| RK-CHR-01..07 | NA | — | Sidebar nav rendered by Dashboard chrome, not by `Risk.jsx`. Out of scope for this screen's A1; deferred to shell audit. | n/a |
| RK-CHR-08 | NA | — | Persona switcher is Dashboard chrome. | n/a |
| RK-CHR-09 | NA | — | Topbar score chip is Dashboard chrome. Reconciliation belongs to A6. | n/a |
| RK-CHR-10 | NA | — | Bell/notifications is Dashboard chrome. | n/a |
| RK-CHR-11 | NA | — | Settings icon is Dashboard chrome. | n/a |
| RK-CHR-12 | **PASS** | — | No X28 top-bar / FY / RY / TY12 selector rendered. `Risk.jsx` does NOT import `X28TopBar` — explicit comment at `Risk.jsx:53-54` ("X28TopBar deliberately not imported"). Default-export `Risk` at line 1601-1645 has no X28 affordance. FD-RK-2 honoured. | `Risk.jsx:53, 1610-1617` |
| **Region 2 — Z0 hero + breadcrumb** |||||
| RK-Z0-01 | PASS | — | X22 breadcrumb "← {originLabel}" present in both surfaces. | `Risk.jsx:1283-1290` (X25Header); `RiskOverlay.jsx:110-117` |
| RK-Z0-02 | PASS | — | Italic Georgia quote present, identical string in both surfaces. | `Risk.jsx:1314-1316`; `RiskOverlay.jsx:144` |
| RK-Z0-03 | PASS | — | Sub-line copy identical in both surfaces. | `Risk.jsx:1317-1320`; `RiskOverlay.jsx:146-151` |
| RK-Z0-04 | PASS | — | "×" collapse button present, sets `collapsed=true`. | `Risk.jsx:1304-1308`; `RiskOverlay.jsx:133-137` |
| RK-Z0-05 | PASS | — | "? What is this?" chip re-expands. | `Risk.jsx:1292-1296`; `RiskOverlay.jsx:119-124` |
| **Region 3 — Z1 Risk-primary anchor (full-page)** |||||
| RK-ANCH-01 | PASS | — | `RiskPrimaryAnchor` renders the large ring left, sticky on scroll. | `Risk.jsx:1478-1550, 1624-1630` |
| RK-ANCH-01a | PASS | — | 1500ms cubic-bezier(0.34,1.56,0.64,1) elastic stroke-dasharray transition; `<Num animate>` counter-up in centre. | `Risk.jsx:131-176` (RiskRing) |
| RK-ANCH-01b | PASS | — | Ring centre text shows score number (`<Num>`), band name, "Risk Score" label. | `Risk.jsx:153-173` |
| RK-ANCH-01c | **FAIL** | FUNCTIONAL | Eyebrow says **"Safety score · primary"** while ring centre says **"Risk Score"** — two framings for the same anchor. Element present but A5 conflict (label inconsistency). Confirms seed S-02. | `Risk.jsx:1512-1514` ("Safety score · primary") vs `Risk.jsx:172` ("Risk Score") |
| RK-ANCH-02 | PASS | — | `ConfBadge level={risk.confidenceLevel \|\| 'low'}` renders inside anchor. | `Risk.jsx:1519-1520`; ConfBadge def `Risk.jsx:179-187` |
| RK-ANCH-03 | PASS | — | `SetbackChip` renders inside anchor; pulse-glow class applied when `drop >= 5`. | `Risk.jsx:1521`; SetbackChip def `Risk.jsx:190-208` |
| RK-ANCH-04 | PASS | — | `ExplainerChip id="HOME-2"` present. | `Risk.jsx:1522` |
| RK-ANCH-05 | **FAIL** | FUNCTIONAL | Secondary tile labelled **"Health score"** but the value rendered is `fq.total` (the Wealth Score from `calcFQ`). Same metric, two names on one screen (RK-OVL-04 calls it "Wealth"). Confirms seed S-01. | `Risk.jsx:1534-1539` (`label="Health score"`, `value={fq.total}`) vs `RiskOverlay.jsx:90-93` ("Wealth") |
| RK-ANCH-06 | PASS | — | Secondary tile "You own" renders `fmt(nw)`. Tap → `onDrillMetric('netWorth')`. | `Risk.jsx:1540-1545` |
| **Region 4 — Z1 ring overlay-only** |||||
| RK-Z1-01 | **FAIL** | POLISH→FUNCTIONAL | Overlay does NOT pass `suppressPrimaryRing` to `<RiskBody>`. Result: the Z1 ring card renders inside the overlay **in addition to** the sticky-header score (RK-OVL-03) — score displays twice. Confirms seed S-09. | `RiskOverlay.jsx:157` (`<RiskBody entity={entity} />` — no suppress flag); `Risk.jsx:1356-1372` (renders ring when `!suppressPrimaryRing`) |
| **Region 5 — Z2 Financial Profile Map** |||||
| RK-Z2-00 | PASS | — | Eyebrow "Financial Profile Map" present. | `Risk.jsx:1379-1381` |
| RK-Z2-01 | PASS | — | `<CrossMap5x5>` rendered with `fqBand` + `riskBand` + `onCellTap`. | `Risk.jsx:1382-1386` |
| RK-Z2-01a..y | PASS | — | 25 cells rendered by shared `CrossMap5x5` component (verified imported from `components/shared`). Sub-row enumeration not required at A1 — handled by `CrossMap5x5` internally. | `Risk.jsx:51`; `components/Risk/CrossMap5x5.jsx` (used) |
| RK-Z2-02 | PASS | — | Active-cell highlight handled by `CrossMap5x5` via `fqBand`/`riskBand` props mapped by `mapFqBand` / `mapRiskBand`. | `Risk.jsx:58-70, 1382-1386` |
| RK-Z2-03 | PASS | — | `<ProfileCell>` renders below map with `profile.profileName` + `profileImplication`. | `Risk.jsx:1375`; ProfileCell def `Risk.jsx:246-267` |
| **Region 6 — Z3 Resilience Dimensions** |||||
| RK-Z3-00 | PASS | — | Eyebrow "Resilience" + title "Resilience Dimensions" + `ExplainerChip id="RISK-1"`. | `Risk.jsx:337-343` |
| RK-Z3-T1 | PASS | — | "RADAR" tab button. | `Risk.jsx:350-365` |
| RK-Z3-T2 | PASS | — | "ORBIT" tab button. | `Risk.jsx:350-365` |
| RK-Z3-T3 | PASS | — | "BARS" tab button. **Note: default is `'bars'` (line 325), spec/inventory match.** | `Risk.jsx:325, 350-365` |
| RK-Z3-01 | PASS | — | Income Resilience (max 20). | `Risk.jsx:74` (DIMS[0]) |
| RK-Z3-02 | PASS | — | Liquidity Buffer (max 18). | `Risk.jsx:75` |
| RK-Z3-03 | PASS | — | Protection Coverage (max 18). | `Risk.jsx:76` |
| RK-Z3-04 | PASS | — | Debt Vulnerability (max 15). | `Risk.jsx:77` |
| RK-Z3-05 | PASS | — | Concentration Risk (max 12). | `Risk.jsx:78` |
| RK-Z3-06 | PASS | — | Dependency Exposure (max 10). | `Risk.jsx:79` |
| RK-Z3-07 | PASS | — | Behavioural Track (max 7); CRIT 1.3 special-case present — `isBTRBuilding` neutral grey when score=0 with copy "Building track record — needs 90 days of activity". | `Risk.jsx:275, 295-301` |
| RK-Z3-R1 | PASS | — | Heptagonal SVG polygon present; `bandColour` drives stroke + tinted fill via `bandFillAlpha`. CRIT 1.5 fix verified (not hardcoded mint). | `Risk.jsx:407-468`, esp. 437-442 |
| RK-Z3-R2 | PASS | — | 4 guide polygons at 0.25/0.5/0.75/1. | `Risk.jsx:410-415, 423-426` |
| RK-Z3-R3 | PASS | — | 7 spokes (`<line>` per item). | `Risk.jsx:427-434` |
| RK-Z3-R4 | PASS | — | Radar dim labels + pct rendered per node, each in a clickable `<g>`. | `Risk.jsx:443-465` |
| RK-Z3-O1 | PASS | — | Centre "composite sum of 7 dims" — HIGH 1.4 fix verified; shows `total = items.reduce(...)`, label "COMPOSITE / sum of 7 dims". Not "78/100". | `Risk.jsx:485-506` |
| RK-Z3-O2 | PASS | — | 7 dim nodes around ring as `<button>` with `onTap`. | `Risk.jsx:507-530` |
| RK-Z3-B1 | PASS | — | Bars view renders 7 `<DimRow>` inside `<RevealStagger interval={60}>`; 800ms cubic-bezier width transition. | `Risk.jsx:370-377, 280-309` |
| **Region 7 — DimSheet** |||||
| RK-DS-01 | PASS | — | Sheet header — icon tile + label + `score/max · pct% of maximum`. | `Risk.jsx:804-818` |
| RK-DS-02 | PASS | — | `RISK_DIM_DESCRIPTIONS[dimCfg.key]` rendered. 7 strings hardcoded in `Risk.jsx:82-90`. | `Risk.jsx:819-822` |
| RK-DS-03 | PASS | — | D6 sub-chips renders when `dimCfg.key === 'depExp'`. | `Risk.jsx:824` |
| RK-DS-03a | PASS | — | Will sub-row in `d6SubScores`. | `Risk.jsx:107-109, 121` |
| RK-DS-03b | PASS | — | Power of attorney. | `Risk.jsx:110-112, 122` |
| RK-DS-03c | PASS | — | Nominations. | `Risk.jsx:113-114, 123` |
| RK-DS-03d | PASS | — | Life-in-trust. | `Risk.jsx:115-117, 124` |
| RK-DS-03e | PASS | — | Guardian. | `Risk.jsx:118-120, 125` |
| RK-DS-04 | PASS | — | "Update answers — 60-second questionnaire →" button opens `D6Questionnaire`. | `Risk.jsx:773-782` |
| RK-DS-05 | PASS | — | Behavioural-track "How to earn points" box renders when `key === 'behaviouralTrack'`. | `Risk.jsx:826-838` |
| RK-DS-06 | PASS | — | "Got it" close button. | `Risk.jsx:839-844` |
| **Region 8 — D6 Questionnaire** |||||
| RK-D6-00 | PASS | — | 5-bar progress strip; fill `<= step`. | `Risk.jsx:637-648` |
| RK-D6-01 | PASS | — | "Step N of 5 · D6 questionnaire" — **A5: "D6" is internal code in user copy.** Element present; flag for plain-English auditor. | `Risk.jsx:650-652` |
| RK-D6-Q1 | PASS | — | Will question — 3 options (current/basic/none). | `Risk.jsx:542-551` |
| RK-D6-Q2 | PASS | — | LPA — 4 options (both/financial_only/health_only/none). | `Risk.jsx:552-562` |
| RK-D6-Q3 | PASS | — | Nominations — 3 options. | `Risk.jsx:563-572` |
| RK-D6-Q4 | PASS | — | Life-in-trust — 3 options. | `Risk.jsx:573-582` |
| RK-D6-Q5 | PASS | — | Guardians — 4 options including `no_dependants` auto-good. | `Risk.jsx:583-593` |
| RK-D6-NB | PASS | — | Back button disabled at step 0. | `Risk.jsx:698-707` |
| RK-D6-NN | PASS | — | Next button (steps 0–3) disabled until pick. | `Risk.jsx:708-718` |
| RK-D6-SB | PASS | — | Submit fires `risk_questionnaire_committed` via `onCommit`, then `onClose`. Engine consumption deferred per code comment, but element present. | `Risk.jsx:621-629, 719-730` |
| RK-D6-CN | PASS | — | Cancel button closes sheet. | `Risk.jsx:731-739` |
| **Region 9 — Z4 Protection Gap** |||||
| RK-Z4-00 | PASS | — | Card title "Protection Gap". | `ProtectionGap.jsx:27` |
| RK-Z4-01 | PASS | — | Life cover row (have/need/bar/gap). **A6 risk noted: 10×/5× multiplier hardcoded in `ProtectionGap.jsx:16`, not from `rules-uk.js` or engine module — defer to reconciliation auditor.** | `ProtectionGap.jsx:16, 28-32` |
| RK-Z4-01a | PASS | — | "Suggested: 10× income" / "5× income" sub-line. | `ProtectionGap.jsx:31` |
| RK-Z4-02 | PASS | — | IP row. **A6 risk: 60% multiplier hardcoded `ProtectionGap.jsx:21`.** | `ProtectionGap.jsx:21, 33-37` |
| RK-Z4-02a | PASS | — | "Suggested: 60% of target income" sub-line. | `ProtectionGap.jsx:36` |
| RK-Z4-03 | **FAIL** | FUNCTIONAL | Combined-gap summary box present and renders `fmt(lifeGap + ipGap)`. BUT user-facing copy contains **internal route code "s02a"** — "Quotes pull in via the protection adapter at s02a." Element rendered; copy violates A5 plain-English. Confirms seed S-04. | `ProtectionGap.jsx:46-49` |
| **Region 10 — Z5 Shock Scenarios** |||||
| RK-Z5-00 | PASS | — | Eyebrow "Stress Tests" + title "Shock Scenarios — recomputed by engine" + `AskChip id="RISK-AI-3" label="What if?"`. | `Risk.jsx:1401-1407` |
| RK-Z5-01..N | PASS | — | `shocks.map(s => <ShockCard …>)` inside `<RevealStagger interval={70}>`. Driven by `Object.values(riskShockSuite(entity) \|\| {})`. | `Risk.jsx:1346-1349, 1413-1416` |
| RK-Z5-0x | PASS | — | Each shock label rendered. | `Risk.jsx:868-870` |
| RK-Z5-0y | PASS | — | Risk N→M (Δ) · Wealth N→M · NW ±fmt line rendered. | `Risk.jsx:871-883` |
| RK-Z5-0z | PASS | — | Description body on expand. | `Risk.jsx:891-898` |
| RK-Z5-0a | PASS | — | Inline `AskChip id="RISK-AI-3" label="What would I do?"`. | `Risk.jsx:885` |
| RK-Z5-EMPTY | **FAIL** | POLISH | Empty state copy literal: **"No shock results available — engine returned empty."** Element rendered correctly; copy surfaces "engine" to user (A5 violation). Confirms seed S-16. | `Risk.jsx:1408-1411` |
| **Region 11 — Z6 Confidence card** |||||
| RK-Z6-01 | **FAIL** | FUNCTIONAL | **NOT RENDERED.** Build has only the `ConfBadge` chip on the anchor (RK-ANCH-02 / RK-Z1-01). No separate Z6 Confidence card with semantic level + breakdown exists in `Risk.jsx` or `RiskOverlay.jsx`. Spec §8.1 calls for it. Confirms seed S-10. | No matching `ConfidenceCard` / "Confidence" card-title in `Risk.jsx`; only the chip at lines 1366, 1520. |
| **Region 12 — Z7 Life-event banner** |||||
| RK-Z7-00 | PASS | — | Banner renders only when `lifeEventPaths(entity).length > 0`; slide-in 400ms keyframe `rk-life-slide-down`. | `Risk.jsx:1098-1123` |
| RK-Z7-01 | PASS | — | Title "Life event detected — review your risk profile" + `AskChip id="RISK-AI-6" label="What should I review?"`. | `Risk.jsx:1113-1117` |
| RK-Z7-02 | **FAIL** | FUNCTIONAL | Body text "N prompt(s) pending. Tap to re-answer affected dimensions." renders but **the banner container has NO `onClick`** — copy implies interactivity that doesn't exist. A1 element rendered; A2 dead. Confirms seed S-08. | `Risk.jsx:1103-1122` — no onClick on the outer `.card` div; "Tap to" copy at 1118-1120. |
| **Region 13 — Z8 Score History** |||||
| RK-Z8-00 | PASS | — | Card title "Score History" + "· always live" eyebrow tail. | `Risk.jsx:930-932` |
| RK-Z8-T1 | PASS | — | 1mo picker. | `Risk.jsx:905, 935-946` |
| RK-Z8-T2 | PASS | — | 3mo picker (default `useState('3mo')`). | `Risk.jsx:906, 912` |
| RK-Z8-T3 | PASS | — | 6mo picker. | `Risk.jsx:907` |
| RK-Z8-T4 | PASS | — | 12mo picker. | `Risk.jsx:908` |
| RK-Z8-01 | PASS | — | SVG line chart via `<DrawSVG key={range}>` so the line re-draws when range changes. | `Risk.jsx:948-956` |
| RK-Z8-02 | PASS | — | End-point dot — colour `var(--c-acc)` if `delta>=0` else `var(--c-danger)`. | `Risk.jsx:953-954` |
| RK-Z8-03 | PASS | — | "{range} ago: X" label. | `Risk.jsx:959-961` |
| RK-Z8-04 | PASS | — | "Today: Y" label. | `Risk.jsx:962-964` |
| RK-Z8-05 | PASS | — | Delta label `+/−N`. | `Risk.jsx:965-968` |
| **Region 14 — Z9 Take Action top-3** |||||
| RK-Z9-00 | PASS | — | Title "Take Action — top 3 for Risk" + `AskChip id="RISK-AI-8"`. | `Risk.jsx:986-989` |
| RK-Z9-01..03 | PASS | — | Top 3 rows from `calcAPQ` filtered by `riskScore>0`, sorted desc, sliced(0,3). `onAct` first calls `onDrillMetric('risk:'+a.dimension)` else dispatches `sonus:action`. | `Risk.jsx:974-1018, 1428-1443` |
| RK-Z9-EMPTY | PASS | — | Returns `null` when no actions with riskScore>0. | `Risk.jsx:982` |
| **Region 15 — Z11 What would help most** |||||
| RK-Z11-00 | PASS | — | Title + `ExplainerChip id="RISK-1"`. | `Risk.jsx:1037-1041` |
| RK-Z11-S1 | PASS | — | Job loss (default). | `Risk.jsx:1023, 1025` |
| RK-Z11-S2 | PASS | — | Illness. | `Risk.jsx:1026` |
| RK-Z11-S3 | PASS | — | Market −30%. | `Risk.jsx:1027` |
| RK-Z11-S4 | PASS | — | Rate +2%. | `Risk.jsx:1028` |
| RK-Z11-S5 | PASS | — | Death. | `Risk.jsx:1029` |
| RK-Z11-01 | PASS | — | Mitigations table top 5 rows. | `Risk.jsx:1063-1084` |
| RK-Z11-01a | PASS | — | Action name with `replace(/_/g, ' ')`. | `Risk.jsx:1071` |
| RK-Z11-01b | PASS | — | Description sub-line. | `Risk.jsx:1072-1074` |
| RK-Z11-01c | PASS | — | Effort cell. | `Risk.jsx:1076-1077` |
| RK-Z11-01d | PASS | — | ΔRisk `+N` cell. | `Risk.jsx:1078-1082` |
| RK-Z11-EMPTY | PASS | — | "No improvements available for this shock." | `Risk.jsx:1085-1090` |
| RK-Z11-HD | **FAIL** | FUNCTIONAL | Table headers `<th>` have `className="sw-press"` + `cursor:pointer` but **no `onClick` handler** — dead affordance styled as sortable. Confirms seed S-07. | `Risk.jsx:1057-1061` |
| **Region 16 — Z12 Protection Plan** |||||
| RK-Z12-A | PASS | — | Active-plan variant renders when `planFor(entity,'protection')` truthy. | `Risk.jsx:1128-1139` |
| RK-Z12-N | PASS | — | No-plan variant — pulse-glow card. | `Risk.jsx:1140-1175` |
| RK-Z12-N1 | PASS | — | "Start a protection plan →" button dispatches `sonus:navigate` + sets `window.location.hash`. Element present; receiver wiring out of scope for A1 (defer to A2/A4). Confirms seed S-17 partially. | `Risk.jsx:1148-1170` |
| RK-Z12-N2 | PASS | — | "Opens the Timeline tab with a protection-plan seed. Full builder ships in Phase 2." footer present. | `Risk.jsx:1171-1173` |
| **Region 17 — Z10 Universal Add Protection** |||||
| RK-Z10-FB | PASS | — | Fixed bottom-right `<FloatingAddButton>` 60×60, sw-pulse-glow. | `Risk.jsx:1261-1275, 1463` |
| RK-Z10-00 | PASS | — | UniversalAdd sheet title "Add to your safety net". | `Risk.jsx:1215-1216` |
| RK-Z10-D3 | PASS | — | Eyebrow "Protection coverage · D3" + subtitle present. **A5: "D3" internal code in user copy** — flag for plain-English auditor. | `Risk.jsx:1218-1224` |
| RK-Z10-D3a | PASS | — | Life cover tile. **A2 risk noted (defer to drill auditor):** `Risk.jsx` default-export `Risk` does NOT pass `onAddProtection` prop to `<RiskBody>` (lines 1633-1638). So `onPick → onAddProtection?.(id)` resolves to undefined on the full-page surface. Element rendered; handler dead on full page. Confirms seed S-06. | `Risk.jsx:1182, 1228, 1467, 1633-1638` |
| RK-Z10-D3b | PASS | — | Income protection tile — same handler-dead caveat as -D3a. | `Risk.jsx:1183` |
| RK-Z10-D3c | PASS | — | Critical illness tile — same caveat. | `Risk.jsx:1184` |
| RK-Z10-D6 | PASS | — | Eyebrow "Estate readiness · D6" + subtitle. **A5: "D6" internal code in user copy.** | `Risk.jsx:1232-1237` |
| RK-Z10-D6a | PASS | — | Will tile — same handler caveat. | `Risk.jsx:1188` |
| RK-Z10-D6b | PASS | — | LPA tile. | `Risk.jsx:1189` |
| RK-Z10-D6c | PASS | — | Nominations tile. | `Risk.jsx:1190` |
| RK-Z10-FT | PASS | — | Footer "Document storage and policy capture ship in Phase 2 — picking now seeds a 'coming next' follow-up on the Timeline." | `Risk.jsx:1244-1247` |
| RK-Z10-CN | PASS | — | Cancel button. | `Risk.jsx:1249-1255` |
| **Region 18 — Disclaimer footer** |||||
| RK-FOOT-01 | PASS | — | Full-page footer renders `BRAND.disclaimer`. Overlay renders it in its own footer. | `Risk.jsx:1640-1642`; `RiskOverlay.jsx:163-167` |
| RK-FOOT-02 | PASS | — | `BRAND.rulesVersion · BRAND.dataDate`. Note format drift: full page uses "· {dataDate}" while overlay uses "· Last verified: {dataDate}" — flag for reconciliation auditor (A6). | `Risk.jsx:1641` vs `RiskOverlay.jsx:166` |
| **Region 19 — RiskOverlay chrome** |||||
| RK-OVL-01 | PASS | — | Sticky `✕` close button with `aria-label="Close"`; Esc handler at line 31-35. | `RiskOverlay.jsx:62-70, 31-35` |
| RK-OVL-02 | PASS | — | Eyebrow "Risk Score · point-in-time". | `RiskOverlay.jsx:72-74` |
| RK-OVL-03 | PASS | — | `<Num value={risk.total} format="score" animate /> /100`. | `RiskOverlay.jsx:80-86` |
| RK-OVL-04 | PASS | — | "· Wealth NN" inline sub-anchor. **Label "Wealth" here conflicts with "Health score" on RK-ANCH-05 (same metric, two names) — A5/A6 cross-surface conflict.** | `RiskOverlay.jsx:87-94` |
| RK-OVL-05 | PASS | — | Band name under score. | `RiskOverlay.jsx:95-99` |
| RK-OVL-06 | PASS | — | In-body "← {originLabel}" breadcrumb close affordance. | `RiskOverlay.jsx:110-117` |
| RK-OVL-07 | PASS | — | Inline overlay disclaimer footer. Duplicates full-page footer when both surfaces present (not normally simultaneously). | `RiskOverlay.jsx:160-167` |
| RK-OVL-08 | **FAIL** | POLISH→FUNCTIONAL | Confirmed: `RiskOverlay.jsx:157` calls `<RiskBody entity={entity} />` with NO `suppressPrimaryRing` prop. Result: score renders in sticky header (RK-OVL-03) AND inside the Z1 ring card (`RiskBody` line 1356-1372) — double render. Confirms seed S-09. | `RiskOverlay.jsx:157`; `Risk.jsx:1335, 1356-1372` |
| **Region 20 — Orphan components** |||||
| RK-ORPH-01 | **FAIL** | POLISH | `src/components/Risk/CrossMap.jsx` not imported by `Risk.jsx` or `RiskOverlay.jsx`. Only referenced from `src/screens/_ComponentLab.jsx` (lab/sandbox) — confirmed dead in production Risk surface. Superseded by `CrossMap5x5`. | Grep: only matches in `_ComponentLab.jsx`, `CrossMap5x5.jsx`, `CrossMap.jsx` self. |
| RK-ORPH-02 | **FAIL** | POLISH | `DimensionRadar.jsx` not imported by `Risk.jsx`/`RiskOverlay.jsx`. Only `_ComponentLab.jsx`. Superseded by inline `RadarHeptaView`. | Grep `DimensionRadar`: `_ComponentLab.jsx` + self. |
| RK-ORPH-03 | **FAIL** | POLISH | `ScoreHistoryChart.jsx` not imported by Risk surfaces. Only `_ComponentLab.jsx`. Superseded by inline `RiskHistory`. | Grep `ScoreHistoryChart`: `_ComponentLab.jsx` + self. |
| RK-ORPH-04 | **FAIL** | POLISH | `ShockScenarios.jsx` not imported by Risk surfaces. Only `_ComponentLab.jsx`. Superseded by inline `ShockCard` + `riskShockSuite`. | Grep `ShockScenarios`: `_ComponentLab.jsx` + self. |

---

## UNLISTED elements found in build (present in build, not in inventory)

None material. Every element rendered by `Risk.jsx` + `RiskOverlay.jsx` + `ProtectionGap.jsx` traces to an inventory row. A few in-component helpers (`bandFillAlpha`, `dimColor`, the `<style>` keyframes blocks for `rk-slide-up` / `rk-life-slide-down`) are implementation detail beneath the inventory granularity — not surfaced to the user as distinct elements. Not raised as UNLISTED.

---

## DECISION-NEEDED (founder, not a bug)

| ID | Divergence | Build / Baseline / Spec position |
|----|-----------|----------------------------------|
| DN-1 | **Z6 Confidence card missing.** Inventory row RK-Z6-01 marks the spec calls for a dedicated Z6 card; build only has the inline `ConfBadge` chip. | Inventory acknowledges ambiguity. Build matches the React rendering (chip-only). Spec §8.1 wants more. Founder must decide whether the chip is sufficient or a dedicated card is required. Recorded as A1 FAIL (FUNCTIONAL) above pending decision. |
| DN-2 | **Score-name drift across the Risk anchor.** RK-ANCH-01c eyebrow says "Safety score · primary", ring centre says "Risk Score", RK-ANCH-05 calls Wealth Score "Health score", overlay header (RK-OVL-04) says "Wealth". Four labels, two underlying metrics, one screen. | A1 FAIL recorded on RK-ANCH-01c and RK-ANCH-05. Founder must pick one label per metric. |
| DN-3 | **Footer format drift between surfaces.** Full page: `{rulesVersion} · {dataDate}`. Overlay: `{rulesVersion} · Last verified: {dataDate}`. | Per FD-RK-3 (overlay canonical) the overlay format wins, but flagging so the founder confirms before full page is mass-edited. |
| DN-4 | **Orphan components (RK-ORPH-01..04, ~420 lines).** Inventory marks "dead code candidate". A1 confirms unreachable from Risk; reachable only from `_ComponentLab.jsx`. | Founder decides: delete (POLISH cleanup) or wire (e.g. resurrect `ScoreHistoryChart` for a richer Z8). |
| DN-5 | **Overlay's missing `suppressPrimaryRing` (RK-Z1-01 / RK-OVL-08).** Could be deliberate (overlay header is small; full ring card adds context) or a bug. | Recorded as A1 FAIL pending founder call. |

---

## Brand-drift sweep (FD-NAME-1 / seed S-15)

- `Risk.jsx`: 0 hits for `Caelixa` / `Finio` / `FQ Score`.
- `RiskOverlay.jsx`: 0 hits.
- `components/Risk/*.jsx`: 0 hits.
- `brand.js`: legacy aliases preserved only in deprecated section (`finioScore` resolves to "Sonuswealth Wealth Score") — internal field name only, not user-facing.

**Verdict:** PASS. No user-facing legacy brand strings on Risk surface.

---

## Coverage math

Rows in inventory tested: **~125** (Region 5 sub-cells RK-Z2-01a..y treated as one row since `CrossMap5x5` is a delegated component; otherwise the count would be ~149).
Rows with verdict ≠ UNVERIFIED: **125 / 125** → **100% coverage** for A1.

A1 results:
- PASS: **107**
- FAIL: **11** (RK-ANCH-01c, RK-ANCH-05, RK-Z1-01, RK-Z4-03, RK-Z5-EMPTY, RK-Z6-01, RK-Z7-02, RK-Z11-HD, RK-OVL-08, RK-ORPH-01..04 collapsed as one finding-class = 4)
- NA: **7** (Region 1 shell rows out of scope for this screen)

**FAIL breakdown by severity** (auditor-assigned, orchestrator owns final classification):
- **DEMO-BLOCKING: 0** — RK-CHR-12 PASSED (no X28), so seed S-19 is closed. Seed S-11/12/13 (cross-screen reconciliation) deferred to reconciliation auditor.
- **FUNCTIONAL: 7** — RK-ANCH-01c, RK-ANCH-05, RK-Z4-03, RK-Z6-01, RK-Z7-02, RK-Z11-HD, RK-OVL-08 (escalates from POLISH per inventory note).
- **POLISH: 4** — RK-Z5-EMPTY, RK-ORPH-01..04 (collapsed as one structural finding-class).

---

**RK conformance: 107 PASS, 11 FAIL (0 DB, 7 F, 4 P), 0 UNLISTED.**
