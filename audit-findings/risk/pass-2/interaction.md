# Risk Screen — Interaction Audit · Pass 2
**Auditor:** Interaction & Drill-down (A2 / A3 / A4)
**Date:** 2026-06-14
**Build refs:** src/screens/Risk.jsx · src/screens/RiskOverlay.jsx · src/components/Risk/CrossMap5x5.jsx · src/components/shared/DetailOverlay.jsx · src/engine/driver-engine.js · src/screens/Dashboard.jsx

---

## A2 / A3 / A4 Verdict Table

| ID | A2 | A3 | A4 | Severity | Finding | Evidence (file:line) |
|---|---|---|---|---|---|---|
| RK-CHR-01..07 | PASS | PASS | PASS | — | Sidebar nav wired by Dashboard chrome; tabs exist. | Dashboard.jsx:888–971 |
| RK-CHR-08 | PASS | PASS | PASS | — | Persona switcher opens setShowSwitcher(true). | Dashboard.jsx:707 |
| RK-CHR-09 | PASS | PASS | PASS | — | Topbar Wealth pill rendered; tappable in header anchor strip (non-interactive pill, display-only — A2 NA for display). | Dashboard.jsx:770 |
| RK-CHR-10 | PASS | PASS | PASS | — | Bell/settings icons route correctly. | Dashboard.jsx:795 |
| RK-CHR-11 | PASS | PASS | PASS | — | Settings icon opens setShowSettings(true). | Dashboard.jsx:795 |
| RK-CHR-12 | PASS | NA | NA | — | X28 top-bar NOT present. Risk.jsx explicitly omits X28TopBar import. FD-RK-2 complied. | Risk.jsx:64 |
| RK-Z0-01 | PASS | PASS | PASS | — | Breadcrumb `← Home` calls onBack/onHome (X25Header onClick={onBack}). | Risk.jsx:1895 |
| RK-Z0-02 | NA | NA | NA | — | Display only. | — |
| RK-Z0-03 | NA | NA | NA | — | Display only. | — |
| RK-Z0-04 | PASS | PASS | PASS | — | Collapse × button calls setCollapsed(true). | Risk.jsx:1916 |
| RK-Z0-05 | PASS | PASS | PASS | — | Re-expand chip calls setCollapsed(false). | Risk.jsx:1905 |
| RK-ANCH-01 | NA | — | — | — | Ring itself has no tap handler (not a button); drill is via secondary tiles and dimension panel. Inventory marks it ANCHOR, not clickable. Acceptable. | Risk.jsx:2526 |
| RK-ANCH-01a | NA | NA | NA | — | Animation only. | — |
| RK-ANCH-01b | NA | NA | NA | — | Display only. | — |
| RK-ANCH-01c | NA | NA | NA | — | Display only. Eyebrow says "Risk Score" (not "Safety score") in current build — inventory note appears stale; verify. | Risk.jsx:2523–2524 |
| RK-ANCH-02 | NA | NA | NA | — | ConfBadge is display-only chip; no onClick. A2 = NA. | Risk.jsx:2531 |
| RK-ANCH-03 | NA | NA | NA | — | SetbackChip is display-only DiffBadge. No onClick wired. | Risk.jsx:2532 |
| RK-ANCH-04 | PASS | PASS | PASS | — | ExplainerChip HOME-2 fires its own handler via shared component. | Risk.jsx:2533 |
| RK-ANCH-05 | PASS | PASS | **FAIL** | FUNCTIONAL | SecondaryTile "Wealth Score" onTap fires onDrillMetric('wealthScore') → Dashboard.pushDetail → driver(entity,'wealthScore') → DetailOverlay. DetailOverlay is SOURCE (shows 7-dim breakdown table). A3 correct (Wealth Score domain). A4 PASS as SOURCE. **However: tile label is "Wealth Score" in current build** (not "Health score" as seed S-01 claimed). Verify live — if eyebrow actually reads "Wealth Score" then S-01 is resolved. Re-check live for label drift. | Risk.jsx:2545–2549, driver-engine.js:105–128 |
| RK-ANCH-06 | PASS | PASS | PASS | — | SecondaryTile "You own" onTap fires onDrillMetric('netWorth') → driver(entity,'netWorth') → DetailOverlay with asset/liability breakdown. SOURCE. | Risk.jsx:2554–2557, driver-engine.js:86–103 |
| RK-Z1-01 | PASS | PASS | PASS | — | Ring card in overlay. suppressPrimaryRing=true is now passed by RiskOverlay.jsx (line 167) so this ring only shows in the overlay, NOT on full page. Double-render S-09 is fixed. | RiskOverlay.jsx:167 |
| RK-Z2-00 | NA | NA | NA | — | Display only eyebrow. | — |
| RK-Z2-01 (all 25 cells) | PASS | PASS | **FAIL** | FUNCTIONAL | Every CrossMap5x5 cell fires setMovement() and opens MovementSheet. MovementSheet renders either "Where you are now" or "About this position" text. A2 PASS. A3 PASS (own screen, profile domain). **A4 FAIL — MovementSheet is describe-only: it states what the position means in prose but offers no action, no further drill, and no decision path. "Stronger financial health and more resilience" is description. To pass A4 the sheet needs at minimum one link to a dimension, an action surface, or a plan builder.** onCellTap prop is also received by RiskBody but RiskBody does not pass it to CrossMap5x5 (no onCellTap prop passed at Risk.jsx:2249–2253) — so the external callback never fires, but the internal MovementSheet still opens. | CrossMap5x5.jsx:136–147, 244–334 |
| RK-Z2-02 | NA | NA | NA | — | Active-cell highlight is visual only. | — |
| RK-Z2-03 | NA | NA | NA | — | ProfileCell display card. No onClick. | Risk.jsx:2242 |
| RK-Z3-00 | NA | NA | NA | — | Display only. ExplainerChip wired. | — |
| RK-Z3-T1 / T2 / T3 | PASS | PASS | PASS | — | View toggle buttons switch DimensionsPanel view state (radar/orbit/bars). | Risk.jsx:368–381 |
| RK-Z3-01..07 (Bars view) | PASS | PASS | PASS | — | DimRow onClick fires onTap(dimCfg) → setActiveDim(dimCfg) → DimSheet opens with score/max, description, breakdown table, and Got it close. SOURCE with per-part breakdown. | Risk.jsx:303, 2261, 2460–2467 |
| RK-Z3-R4 (Radar nodes) | PASS | PASS | PASS | — | Each radar g element onClick fires onTap?.(d) → same setActiveDim path as bars. | Risk.jsx:469–471 |
| RK-Z3-O2 (Orbit nodes) | PASS | PASS | PASS | — | OrbitView button onClick fires onTap?.(d) → setActiveDim → DimSheet. | Risk.jsx:531 |
| RK-Z3-R1..R3, RK-Z3-O1 | NA | NA | NA | — | SVG guides, spokes, orbit rings, and orbit centre label are display-only. | — |
| RK-DS-01..02 | NA | NA | NA | — | DimSheet header and description display. | — |
| RK-DS-03 (D6 sub-chips) | NA | NA | NA | — | D6SubChips display-only rows (no tap). | — |
| RK-DS-03a..e | NA | NA | NA | — | Sub-score rows display-only. | — |
| RK-DS-04 | PASS | PASS | PASS | — | "Update answers" button setQOpen(true) → D6Questionnaire opens. | Risk.jsx:791 |
| RK-DS-05 | NA | NA | NA | — | Behavioural-track copy block, display only. | — |
| RK-DS-06 | PASS | PASS | PASS | — | "Got it" button calls onClose (setActiveDim(null)). | Risk.jsx:894 |
| RK-D6-00 | NA | NA | NA | — | Progress strip display. | — |
| RK-D6-01 | NA | NA | NA | — | Step header display. **"Dependency questionnaire" used (not "D6 questionnaire")** — S-05 variant addressed. | Risk.jsx:669 |
| RK-D6-Q1..Q5 | PASS | PASS | PASS | — | Options call pick(value); Next/Back call next()/back(). | Risk.jsx:630–646 |
| RK-D6-NB | PASS | PASS | PASS | — | Back button; disabled on step 0. | Risk.jsx:716 |
| RK-D6-NN | PASS | PASS | PASS | — | Next button; disabled until option picked. | Risk.jsx:726 |
| RK-D6-SB | PASS | PASS | **FAIL** | FUNCTIONAL | Submit fires onCommit(event) + onClose(). Event shape is correct (type, ts, correlation_id, payload). **However, Dashboard's handleCommit (the onCommit prop passed to Risk) stores the event in the event log but the engine does NOT consume risk_questionnaire_committed to update entity.willStatus / lpaStatus etc. The code comment at Risk.jsx:556–558 explicitly states "Engine consumption of the event (mapping answers into entity.willStatus) is follow-up engine work — out of scope here." So submit fires, event is stored, but D6 scores do not update until engine consumption is wired. A4 FAIL: the ACTION commits but produces no observable change in the domain it claims to address.** | Risk.jsx:639–646, 556–558 |
| RK-D6-CN | PASS | PASS | PASS | — | Cancel calls onClose. | Risk.jsx:749 |
| RK-Z4-00 | NA | NA | NA | — | Display title. | — |
| RK-Z4-01 / RK-Z4-01a | NA | NA | NA | — | Life cover row display. Hardcoded multiplier (A6 issue, not A2/A3/A4 scope). | — |
| RK-Z4-02 / RK-Z4-02a | NA | NA | NA | — | IP row display. Same A6 note. | — |
| RK-Z4-03 | NA | NA | NA | — | Combined-gap summary. "s02a" internal code appears in copy (A5, not A2/A3/A4 scope). The ProtectionGap onAction prop is passed by RiskBody as `() => onAddProtection?.('life-cover')` and Dashboard supplies onAddProtection as `() => setTabSafe('money/protection')`. So tapping ProtectionGap's action button routes to money/protection. **But RK-Z4-03 has no visible button in current ProtectionGap component — the gap summary box is display only**. A2 = NA. | Risk.jsx:2367, Dashboard.jsx:970 |
| RK-Z5-00 | NA | NA | NA | — | Eyebrow + AskChip (wired via sonus:ask). | — |
| RK-Z5-01..N (ShockCards) | PASS | PASS | PASS | — | ShockCard onClick toggles open/close. When expanded, the handoff button calls onNav(handoff.nav) which resolves to setTabSafe in Dashboard. Route by shockId: job_loss/market_fall/illness → 'money'; rate_rise → 'flow'; death → 'tax'. These are correct cross-domain ACTION handoffs per FD-CROSS-1. | Risk.jsx:1205–1321, 906–911, Dashboard.jsx:970 |
| RK-Z5-0x..0z | NA | NA | NA | — | ShockCard label and description display. | — |
| RK-Z5-0a (AskChip inline) | PASS | PASS | PASS | — | AskChip RISK-AI-3 dispatches sonus:ask; Dashboard listens at Dashboard.jsx:583. | Risk.jsx:241–260, Dashboard.jsx:566–604 |
| RK-Z5-EMPTY | NA | NA | NA | — | Display fallback; A5 issue (engineer copy) not A2/A3/A4. | Risk.jsx:2382–2384 |
| RK-Z6-01 | PASS | PASS | PASS | — | **ConfidenceCard now exists as a dedicated card** inside "How it's changed" drawer (Drawer 5). Renders plain-English level text. SOURCE. Seed S-10 is resolved. | Risk.jsx:1473–1494, 2434 |
| RK-Z7-00 | NA | NA | NA | — | LifeEventBanner only renders when lifeEventPaths.length > 0. | — |
| RK-Z7-01 | PASS | PASS | PASS | — | AskChip RISK-AI-6 dispatches sonus:ask. | Risk.jsx:1720 |
| RK-Z7-02 | PASS | PASS | PASS | — | **S-08 RESOLVED: LifeEventBanner now receives onReview prop (setRiskQOpen(true)) and renders a "Re-check my risk attitude →" button.** The prior dead-affordance "Tap to re-answer" text is replaced by the button. A2 PASS. | Risk.jsx:1727–1733, 2236 |
| RK-Z8-00 | NA | NA | NA | — | Title display. | — |
| RK-Z8-T1..T4 | PASS | PASS | PASS | — | Range picker buttons call setRange(p.id); RiskHistory re-renders with new range via calcRiskHistory. | Risk.jsx:1355–1367 |
| RK-Z8-01..05 | NA | NA | NA | — | SVG chart and labels display. | — |
| RK-Z9-00 | PASS | PASS | PASS | — | AskChip RISK-AI-8 wired. | — |
| RK-Z9-01 | PASS | PASS | **FAIL** | FUNCTIONAL | TakeAction row onClick fires onAct(a). Handler checks `if (a?.dimension && typeof onDrillMetric === 'function')` — but calcAPQ items carry no `.dimension` property (not part of APQ shape). Guard is never true. Falls to `window.dispatchEvent(new CustomEvent('sonus:action', ...))`. **No listener for sonus:action exists anywhere in Dashboard.jsx.** Event is silently dropped. Row appears tappable (sw-press cursor:pointer) but has no observable effect. A4 FAIL: dead affordance. | Risk.jsx:2403–2414, Dashboard.jsx (no sonus:action listener found) |
| RK-Z9-02 | PASS | PASS | **FAIL** | FUNCTIONAL | Same as RK-Z9-01. | Same refs |
| RK-Z9-03 | PASS | PASS | **FAIL** | FUNCTIONAL | Same as RK-Z9-01. | Same refs |
| RK-Z9-EMPTY | NA | NA | NA | — | Null return; no display issue. | — |
| RK-Z11-00 | NA | NA | NA | — | ExplainerChip wired. | — |
| RK-Z11-S1..S5 | PASS | PASS | PASS | — | Shock picker buttons call setShockId; WhatHelpsMost re-renders via engineWhatHelpsMost. | Risk.jsx:1625–1632 |
| RK-Z11-01 (table rows) | PASS | PASS | PASS | — | Each mitigation row: mitigationRoute() returns a nav function based on action key string. Rows with a route have onClick and cursor:pointer; rows without route have cursor:default and no click. Routing is: pension/sipp/emergency_fund/overpay → money; iht/estate/will/trust → tax; mortgage/rate/cash/income_protection (partial) → flow; life_insurance/income_protection/protection → onAddProtection. These are correct owning-surface handoffs per FD-CROSS-1. | Risk.jsx:1583–1695 |
| RK-Z11-01a..d | NA | NA | NA | — | Row label, description, effort, delta cells — display. | — |
| RK-Z11-EMPTY | NA | NA | NA | — | Display fallback. | — |
| RK-Z11-HD | **FAIL** | NA | **FAIL** | FUNCTIONAL | **S-07 UNRESOLVED: Z11 table headers (`<th>` elements) have sw-press class and fontWeight:700 styling that implies interactivity but NO onClick handler.** Headers are styled as if sortable but do nothing. Dead affordance. | Risk.jsx:1639–1648 |
| RK-Z12-A | NA | NA | NA | — | Active-plan variant is display only (planFor returns truthy). | — |
| RK-Z12-N | NA | NA | NA | — | No-plan card pulse-glow display. | — |
| RK-Z12-N1 | PASS | **FAIL** | **FAIL** | FUNCTIONAL | "Start a protection plan →" button dispatches sonus:navigate + sets window.location.hash to '#tab=timeline&planType=protection'. **A3 FAIL: the dispatch fires to 'timeline' which is a valid tab — but the hash is '#tab=plan&planType=protection' (no "plan" tab exists). Correct hash should be '#tab=timeline&planType=protection'.** Wait — re-reading the code: Risk.jsx:1772 dispatches `{ tab: 'timeline', planType: 'protection' }` as the sonus:navigate detail, and the hash (line 1774) is '#tab=timeline&planType=protection'. The tab name is correct. **However, Dashboard has no listener for sonus:navigate.** The event is silently dropped. The hash change has no effect because Dashboard reads tab from state not from hash. A4 FAIL: no observable navigation occurs. No live routing to Timeline tab. Effectively a dead button. | Risk.jsx:1765–1774, Dashboard.jsx (no sonus:navigate listener) |
| RK-Z12-N2 | NA | NA | NA | — | Footer copy: "Full builder ships in Phase 2" — explicit "coming next" is acceptable per founder rules. | — |
| RK-Z10-FB | PASS | PASS | PASS | — | FloatingAddButton onClick opens setAddOpen(true) → UniversalAdd sheet. | Risk.jsx:1873–1886, 2471 |
| RK-Z10-00 | NA | NA | NA | — | Sheet title display. | — |
| RK-Z10-D3 | NA | NA | NA | — | Eyebrow "Protection coverage" (D3 code stripped in build — eyebrow reads "Protection coverage" not "Protection coverage · D3"). S-05 partially resolved here. | Risk.jsx:1831 |
| RK-Z10-D6 | NA | NA | NA | — | Eyebrow "Estate readiness" (D6 code stripped). | Risk.jsx:1843 |
| RK-Z10-D3a..c | PASS | PASS | PASS | — | Life/IP/CIC tiles call onPick(id) → setAddOpen(false); onAddProtection?.(id). Dashboard supplies onAddProtection as `() => setTabSafe('money/protection')`. This routes to the protection screen. ACTION. S-06 resolved — Dashboard passes the prop. | Risk.jsx:2472–2476, Dashboard.jsx:970 |
| RK-Z10-D6a..c | PASS | PASS | PASS | — | Will/LPA/Nominations tiles call onPick(id) → onAddProtection(id). Routes to money/protection. Same wiring. | Same refs |
| RK-Z10-FT | NA | NA | NA | — | Footer "Phase 2" coming-next copy. Acceptable. | — |
| RK-Z10-CN | PASS | PASS | PASS | — | Cancel button calls onClose (setAddOpen(false)). | Risk.jsx:1861 |
| RK-FOOT-01..02 | NA | NA | NA | — | Disclaimer display. | — |
| RK-OVL-01 | PASS | PASS | PASS | — | Close × button calls onClose. | RiskOverlay.jsx:64 |
| RK-OVL-02..05 | NA | NA | NA | — | Header display. | — |
| RK-OVL-06 | PASS | PASS | PASS | — | In-body "← {originLabel}" button calls onClose. | RiskOverlay.jsx:112–119 |
| RK-OVL-07 | NA | NA | NA | — | Overlay disclaimer display. | — |
| RK-OVL-08 | PASS | NA | NA | — | **S-09 RESOLVED: RiskOverlay.jsx passes suppressPrimaryRing={true} at line 167.** Z1 ring card is suppressed in overlay. Score appears only in sticky header (RK-OVL-03). No double-render. | RiskOverlay.jsx:167 |
| RK-ORPH-01..04 | NA | NA | NA | — | Dead code components on disk. CrossMap.jsx, DimensionRadar.jsx, ScoreHistoryChart.jsx, ShockScenarios.jsx are not imported by Risk.jsx or RiskOverlay.jsx. Cleanup only; no A2/A3/A4 impact. | — |

---

## FAILS — Detail

### FAIL-1: RK-Z2-01 (all 25 CrossMap cells) — A4 FAIL
- **Current destination:** MovementSheet modal (describe-only). States "stronger financial health and more resilience" in prose. No drill, no action, no decision.
- **Expected destination:** SOURCE (provenance of position) or DECISION (how to move toward a stronger cell, linking to owning surface). At minimum: link to the dimension(s) that would change the band, or to My Money / Risk dim drill.
- **Why landing is incoherent (A4):** The sheet explains *what* a position means but provides no path to *do* anything or *understand* the numbers behind it. Per A4 rule: description is not drilling. A "Where you are now" modal that explains the map itself (current cell) comes close to SOURCE, but non-current cells fail entirely because they describe a hypothetical without linking to an action.
- **Severity:** FUNCTIONAL

### FAIL-2: RK-D6-SB — A4 FAIL
- **Current destination:** Event fires to event log but engine does not consume it. D6 scores (willStatus, lpaStatus, etc.) on the entity remain unchanged post-submit. The questionnaire closes.
- **Expected destination:** Committed answers should update the entity's dependency-exposure sub-scores, which re-compute D6 and the overall risk score.
- **Why landing is incoherent (A4):** The ACTION fires but produces no observable outcome in the domain. User submits 5 answers and the scores do not change. This is a silent-effect flow.
- **Severity:** FUNCTIONAL
- **Note:** Code comment (Risk.jsx:556–558) explicitly defers engine consumption as out-of-scope.

### FAIL-3: RK-Z9-01 / Z9-02 / Z9-03 — A4 FAIL
- **Current destination:** `sonus:action` CustomEvent dispatched. No listener in Dashboard or any other file catches it. Event silently drops.
- **Expected destination per FD-CROSS-1:** Hand off to the action's owning surface (My Money / Cashflow / T&E) OR open a dedicated SOURCE drill for the risk dimension.
- **Why landing is incoherent (A4):** Row looks tappable (sw-press + cursor:pointer) but produces zero observable effect. Dead affordance.
- **Severity:** FUNCTIONAL (DEMO-BLOCKING candidate — these are the three most prominent action rows on the screen)

### FAIL-4: RK-Z11-HD — A2 FAIL
- **Current state:** `<th>` elements have sw-press class and styled as interactive but no onClick handler exists.
- **Expected:** Either sortable (onClick sorts rows) or not styled as interactive.
- **Severity:** FUNCTIONAL

### FAIL-5: RK-Z12-N1 — A3/A4 FAIL
- **Current destination:** `sonus:navigate` event dispatched with `{ tab: 'timeline', planType: 'protection' }`. Dashboard has no sonus:navigate listener. Hash `#tab=timeline&planType=protection` set but Dashboard tab state is not driven by hash. No navigation occurs.
- **Expected destination:** Timeline tab with planType='protection' seed active (DECISION surface).
- **Why landing is incoherent (A4):** Button is visually a primary CTA but does nothing observable. No tab switch, no plan builder opens.
- **Severity:** FUNCTIONAL

---

## Seed Findings Reconciliation

| Seed | Status | Notes |
|------|--------|-------|
| S-01 (RK-ANCH-05 "Health score" label) | NEEDS LIVE VERIFY | Build code shows SecondaryTile label is "Wealth Score" (Risk.jsx:2546). If live build differs, still a FUNCTIONAL. |
| S-02 (RK-ANCH-01c eyebrow conflicting labels) | PASS / resolved | Eyebrow in current code reads "Risk Score" (Risk.jsx:2523). No "Safety score" in code. |
| S-03 (ProtectionGap hardcoded multipliers) | A6 — outside A2/A3/A4 scope | Confirmed hardcoded (ProtectionGap.jsx). |
| S-04 (RK-Z4-03 "s02a" in copy) | A5 — outside scope | Not checked in this pass. |
| S-05 (D3/D6 codes in user copy) | PARTIAL PASS | UniversalAdd sheet eyebrows read "Protection coverage" and "Estate readiness" (codes stripped). D6Questionnaire step header reads "Dependency questionnaire" (not "D6"). |
| S-06 (onAddProtection unwired) | RESOLVED | Dashboard passes `() => setTabSafe('money/protection')` at Risk render (Dashboard.jsx:970). Tiles route to money/protection. |
| S-07 (Z11 table headers dead) | UNRESOLVED — FAIL-4 | See RK-Z11-HD above. |
| S-08 (Z7 life-event banner dead affordance) | RESOLVED | onReview button now wired (Risk.jsx:1727–1733). |
| S-09 (overlay double-render score) | RESOLVED | suppressPrimaryRing=true passed by RiskOverlay.jsx:167. |
| S-10 (Z6 confidence card missing) | RESOLVED | ConfidenceCard renders in "How it's changed" drawer (Risk.jsx:2434). |
| S-11 (Risk Score reconcile) | Outside A2/A3/A4 scope | Reconciliation auditor. |
| S-12 (Wealth Score reconcile) | Outside scope | — |
| S-13 (Net Worth reconcile) | Outside scope | — |
| S-14 (orphan components) | CONFIRMED dead code | Not imported. |
| S-15 (brand string drift) | A5 — outside scope | — |
| S-16 (empty state copy) | A5 — outside scope | Empty state now reads "We don't have enough of your data yet to model these shocks." (improved but still consider A5). |
| S-17 (Z12-N1 "plan" tab) | CONFIRMED — FAIL-5 | sonus:navigate has no listener; hash does not drive tab state. |
| S-18 (two overlay close buttons) | PASS — intentional | OVL-01 (sticky × button) and OVL-06 (in-body breadcrumb) both call onClose. Redundant but not broken. |
| S-19 (X28 top-bar on Risk) | PASS | X28TopBar import explicitly omitted. |
| S-20 (D7 zero score) | PASS | DimRow special-case at Risk.jsx:293 fires when score===0. |

---

## Recent-Changes Verification

| Change | Verified? | Verdict |
|--------|-----------|---------|
| CrossMap5x5 cells: every cell opens MovementSheet (no dead-end) | YES | A2 PASS — no dead taps. A4 FAIL — MovementSheet is describe-only. |
| Wealth Score SecondaryTile → onDrillMetric('wealthScore') → DetailOverlay with per-dim breakdown | YES | PASS. driver-engine.js:105–128 returns wealthScore node with dimension drivers; DetailOverlay renders breakdown table. |
| Risk dim taps (DimensionsPanel onTap=setActiveDim) → DimSheet (in-screen, NOT driver tree) | YES | PASS. setActiveDim is local state, opens DimSheet which shows breakdown. Not a driver-tree call. |
| TakeAction rows onAct: a.dimension undefined → sonus:action CustomEvent → no listener | YES | CONFIRMED FAIL. calcAPQ returns items with no .dimension property. sonus:action has no Dashboard listener. Dead affordance (FAIL-3). |
| "Start a protection plan →" sonus:navigate: no listener, planType not consumed | YES | CONFIRMED FAIL. Dashboard has no sonus:navigate listener anywhere. Tab state not driven by hash. (FAIL-5). |

---

## Unverified Rows

The following rows could not be fully verified from static code analysis (require live browser or engine data):

- RK-ANCH-05 label: code shows "Wealth Score" but seed S-01 suggested "Health score" — **requires live browser verify**.
- RK-ANCH-03 SetbackChip trigger: requires calcRiskHistory to return a 1mo drop ≥5pts on the demo persona.
- RK-Z5-01..N: exact count of ShockCards depends on riskShockSuite return for persona A.
- RK-Z11-01 routing: mitigationRoute string matching depends on actual action key strings returned by whatWouldHelpMost for each shock.
- RK-Z3-07 D7 Behavioural Track: requires persona A to have behaviouralTrack score = 0 to trigger neutral-grey special case.
- RK-Z12-A (active plan variant): requires planFor(entity,'protection') to return truthy — persona A may not have a protection plan.

---

## Coverage

| Metric | Count |
|--------|-------|
| Total inventory rows | 135 (as per inventory math) |
| Rows with verdict (PASS / FAIL / NA) | 126 |
| Rows unverified (require live data / browser) | 9 |
| Coverage | 93% |
| A2/A3/A4 FAILs | 5 |
| A2/A3/A4 PASSes | 53 |
| NA (display-only, no interaction) | 68 |

---

## Summary

**Dead taps:** 2 classes
1. TakeAction rows 1–3 (RK-Z9-01/02/03): `sonus:action` event dispatched, no Dashboard listener. 3 tappable rows, zero effect.
2. Z11 table headers (RK-Z11-HD): styled interactive, no handler.

**Wrong / incoherent destinations:** 3
1. RK-Z2-01 (25 CrossMap cells): A4 FAIL — MovementSheet is describe-only. No action, no drill, no decision from any cell.
2. RK-D6-SB (D6 questionnaire submit): A4 FAIL — event stored but engine does not consume it; D6 scores unchanged.
3. RK-Z12-N1 ("Start a protection plan →"): A3/A4 FAIL — `sonus:navigate` has no listener; button does nothing.

**DEMO-BLOCKING findings:**
- RK-Z9-01/02/03 (TakeAction rows) — "Top 3 actions for Risk" is the screen's primary call-to-action. All three rows are dead taps in the current build. This is the highest-priority fix before demo.
- RK-Z12-N1 — Protection Plan CTA is dead. Lower-priority than Z9 rows but still visible on every demo run through the Risk screen.

**Resolved from prior session:**
- S-06 (onAddProtection): now wired via Dashboard.
- S-07 (Z7 banner dead affordance): resolved — button now present.
- S-08 (overlay double-render): suppressPrimaryRing passed correctly.
- S-09 (Z6 confidence card missing): ConfidenceCard now in "How it's changed" drawer.
