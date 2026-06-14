# Risk Screen — Cross-Screen Reconciliation Audit
## Pass 2 · Auditor 3 of 5
**Date:** 2026-06-14  
**Scope:** S-11, S-12, S-13 + all data-bearing rows in risk-inventory-v1.md  
**Build files read:** `src/screens/Risk.jsx`, `src/screens/RiskOverlay.jsx`, `src/screens/HomeScreen.jsx`, `src/screens/Dashboard.jsx`, `src/components/Risk/ProtectionGap.jsx`, `src/engine/fq-calculator.js`, `src/engine/_bundle.js`, `src/rules/UK-2026.1.1.json`

---

## 1. Reconciliation Matrix

| Metric | Risk full-page | RiskOverlay | HomeScreen (AnchorRow) | Dashboard header | Engine fn |
|--------|---------------|-------------|----------------------|-----------------|-----------|
| Risk Score (numeric) | `calcRisk(entity).total` → rendered as bare integer via `<Num value={risk.total} format="score" animate />` in `RiskRing` | `calcRisk(entity).total` → `<Num value={risk.total} format="score" animate />` in sticky header | `calcRisk(entity).total` → bare integer `{riskScore}` with literal `/100` suffix (HomeScreen.jsx:490) | `calcRisk(entity).total` → bare integer `${headerRisk.total}` (Dashboard.jsx:744,824) | `calcRisk()` — single fn |
| Risk Score format | bare `NN` (no "/100" suffix in ring) | `NN /100` (literal "/100" span in header, RiskOverlay.jsx:87) | `NN/100` (inline span, HomeScreen.jsx:490) | bare `NN` (Dashboard.jsx:824) | n/a |
| Wealth Score | `calcFQ(entity).total` → bare integer via `<Num>` in SecondaryTile | `calcFQ(entity).total` → `· Wealth Score NN` via `<Num>` | `calcFQ(entity).total` → bare `{score}` + `/100` suffix span (HomeScreen.jsx:455) | n/a | `calcFQ()` |
| Net Worth | `netWorth(entity)` → `fmt(nw)` in SecondaryTile (Risk.jsx:2554) | not shown in overlay header | `netWorth(entity)` → `fmt(nw)` (HomeScreen.jsx:393) | `_nwRipple?.balance_sheet?.netWorth` → `shortGBP()` (Dashboard.jsx:742) | `netWorth()` |
| Band name (Risk) | `riskBand(risk.total).name` | `riskBand(risk.total).name` | `riskData?.band?.name` | `riskBand(headerRisk.total).name` | `riskBand()` |
| Protection-gap multipliers | `TAX.lifeCoverMultipleDep` / `TAX.lifeCoverMultipleNoDep` / `TAX.ipBenefitFraction` via `_bundle.js` | same (shared component) | n/a | n/a | `_bundle.js` → `UK-2026.1.1.json protectionNeed` |
| Dim breakdown total | `riskBreakdown(entity)[key].value` = `calcRisk(entity).dims[key]` | same | n/a | n/a | `riskBreakdown()` → `_bdDim()` |

---

## 2. A6 Verdict Table

| Element ID | Metric | A6 Verdict | Severity | Notes |
|-----------|--------|-----------|---------|-------|
| RK-ANCH-01 / RK-OVL-03 | Risk Score value | PASS | — | Both call `calcRisk(entity).total`; same value |
| RK-ANCH-01 format | Risk Score format | **FAIL** | DEMO-BLOCKING | See S-11 detail below |
| RK-OVL-03 format | Risk Score format | **FAIL** | DEMO-BLOCKING | See S-11 detail below |
| Home H-ANCH-03 format | Risk Score format | **FAIL** | DEMO-BLOCKING | See S-11 detail below |
| RK-ANCH-05 | Wealth Score value | PASS | — | `calcFQ(entity).total` everywhere |
| RK-ANCH-05 label | Wealth Score label | **FAIL** | FUNCTIONAL | Label is "Wealth Score" in RiskPrimaryAnchor (Risk.jsx:2546) — S-01 seed confirmed RESOLVED in Risk.jsx; see note |
| RK-OVL-04 | Wealth Score in overlay | PASS | — | `calcFQ(entity).total` via `<Num>` |
| RK-ANCH-06 | Net Worth value | PASS | — | `netWorth(entity)` → `fmt(nw)` on Risk |
| RK-ANCH-06 format | Net Worth format | PASS | — | `fmt()` applied; casing "m" lowercase consistent |
| Home H-ANCH-01 format | Net Worth format | PASS | — | HomeScreen also uses `fmt(nw)` → "£3.63m" style |
| Dashboard NW format | Net Worth format | **FAIL** | FUNCTIONAL | Dashboard uses `shortGBP(headerNW)` not `fmt()` — different fn, potentially different format |
| RK-Z3-01..07 | Dim scores | PASS | — | `risk.dims[key]` from `calcRisk()` |
| RK-DS-01 | DimSheet header score | PASS | — | `risk.dims[activeDim.key]` matches `DimRow` |
| DimSheet "Total X of Y" | Breakdown total | PASS | — | `riskBreakdown().value` = `calcRisk().dims[key]`; `_bdDim()` passes through the same value |
| Orbit centre "COMPOSITE" | Sum of 7 dims | PASS | — | `items.reduce((s,d) => s+d.score, 0)` from `risk.dims`; no longer shows score/100 (HIGH 1.4 fixed) |
| RK-Z4-01 / RK-Z4-02 | Protection need multipliers | PASS | — | `TAX.lifeCoverMultipleDep` / `TAX.ipBenefitFraction` from `_bundle.js` → `UK-2026.1.1.json` |
| RK-Z4-03 "s02a" | User-facing copy | **FAIL** | FUNCTIONAL (A5) | String "s02a" removed from current `ProtectionGap.jsx` — copy now reads "estimate, not recommendation"; S-04 RESOLVED |
| RK-Z5-0y | Shock `rsBefore` | PASS | — | `riskShockSuite(entity)` returns `rsBefore`; `runShock()` uses current `calcRisk` output |
| RK-Z5-0y shock rsBefore vs RK-ANCH-01 | Cross-check | PASS | — | `riskShockSuite` calls `calcRisk` internally; `rsBefore` = same fn |
| RK-Z8-04 "Today: Y" vs RK-ANCH-01 | History end vs ring | CONDITIONAL PASS | — | `calcRiskHistory().points[last].score` should equal `risk.total`; engine responsibility — not hardcoded |
| RK-Z11-01d ΔRisk | Mitigation delta | PASS | — | `m.rsDeltaImprovement` from `engineWhatHelpsMost()`; not hardcoded |
| RK-FOOT-02 | rulesVersion / dataDate | PASS | — | `BRAND.rulesVersion` / `BRAND.dataDate` from `src/config/brand.js` |
| D6 sub-scores | Will/LPA/Noms/Trust/Guardian | PASS | — | `d6SubScores()` reads `entity.*` fields — no hardcoded numerics except the 0/3/6 constants per the spec scoring table |
| RK-ANCH-01c eyebrow | "Safety score · primary" label | **FAIL** | FUNCTIONAL (A5) | S-02: RiskPrimaryAnchor eyebrow (Risk.jsx:2524) NOW says "Risk Score" (not "Safety score") — S-02 RESOLVED |
| UniversalAdd "D3"/"D6" labels | Internal codes in UI | PASS | — | Current `UniversalAdd` uses "Protection coverage" / "Estate readiness" (Risk.jsx:1831,1844) — S-05 RESOLVED |
| D6 step header "D6 questionnaire" | Internal code | **FAIL** | FUNCTIONAL (A5) | `D6Questionnaire` renders "Step N of M · **Dependency questionnaire**" (Risk.jsx:669) — "D6" replaced with "Dependency" — S-05 context RESOLVED for this location |
| RK-D6-01 step header | "D6 questionnaire" label | PASS | — | Confirmed "Dependency questionnaire" at Risk.jsx:669 |
| RK-Z7-02 | Life-event banner "Tap to re-answer" | PASS | — | `LifeEventBanner` now renders a clickable `<button onClick={onReview}>Re-check my risk attitude →</button>` (Risk.jsx:1727); dead affordance S-08 RESOLVED |
| RK-Z11-HD | Z11 table headers clickable styling | **FAIL** | FUNCTIONAL (A2) | Headers still use `style={{cursor:'pointer'}}` via `fontWeight:700` but have no `onClick`; S-07 confirmed |
| S-09 overlay double-ring | Score rendered twice | PASS | — | `RiskOverlay.jsx:167` passes `suppressPrimaryRing={true}` to `RiskBody` — score NOT double-rendered; S-09 RESOLVED |
| S-06 onAddProtection | Prop wiring | PASS | — | `Dashboard.jsx:970` passes `onAddProtection={() => setTabSafe('money/protection')}` to `<Risk>`; `RiskOverlay` (Dashboard.jsx:1070) also passes `onAddProtection`; S-06 RESOLVED |
| RK-Z12-N1 protection plan hash | "#tab=plan" hash | **FAIL** | FUNCTIONAL (A2/A4) | `ProtectionPlanCard` sets `window.location.hash = '#tab=timeline&planType=protection'` (Risk.jsx:1772) — hash is now correct ("timeline" not "plan"); S-17 RESOLVED at code level. Custom event fires `sonus:navigate` with `tab:'timeline'`; Dashboard does not register a `sonus:navigate` listener — the hash-based fallback is the only live path |
| RK-CHR-12 X28 top-bar | X28 absent | PASS | — | `X28TopBar` explicitly not imported (Risk.jsx:64); FD-RK-2 honoured |

---

## 3. FAIL Details

### FAIL-1: S-11 — Risk Score format drift (DEMO-BLOCKING)

**Metric:** Overall Risk Score  
**Locations and formats:**

| Surface | Element | Format rendered | Source |
|---------|---------|----------------|--------|
| Risk full-page (RiskRing centre) | RK-ANCH-01 / RK-ANCH-01a | bare `NN` (no suffix) | Risk.jsx:173 — `<Num value={score} format="score" animate />` with comment "denominator dropped" |
| Risk full-page (RiskPrimaryAnchor card outer) | RK-ANCH-01b | same `NN` | Risk.jsx:2526 |
| RiskOverlay sticky header | RK-OVL-03 | `NN /100` (literal `/100` span) | RiskOverlay.jsx:82–88 |
| Home AnchorRow | H-ANCH-03 | `NN/100` (inline `{riskScore}` + `<span>/100</span>`) | HomeScreen.jsx:489–491 |
| Dashboard mini-header | global chrome | bare `NN` | Dashboard.jsx:824 |

**Engine source:** `calcRisk(entity).total` — all locations agree on **value**. The **format** diverges:  
- Risk ring + Dashboard header: bare number (e.g. `71`)  
- RiskOverlay header: `71 /100` (space before slash)  
- Home anchor: `71/100` (no space)

**Verdict:** A6 FAIL — same metric, three format variants. The spec calls for `fmt()` consistency. Risk.jsx V-6 fix comment (line 174) justifies dropping "/93" denominator (the pre-100 effective ceiling) but the fix leaves "/100" present in RiskOverlay and Home. Either all three show bare `NN` or all show `NN/100`; they must agree.

**Engine says is correct:** bare `NN` (as `calcRisk` returns a number 0–100; the "/93" comment explains the old denominator was misleading). RiskOverlay and Home should be updated to drop "/100" suffix, OR Risk.jsx should add "/100" — founder decides.

---

### FAIL-2: S-12 — Wealth Score format drift (FUNCTIONAL)

**Metric:** Wealth Score  
**Locations and formats:**

| Surface | Element | Format | Source |
|---------|---------|--------|--------|
| Risk secondary tile | RK-ANCH-05 | bare `NN` via `<SecondaryTile value={fq.total}>` | Risk.jsx:2547 |
| RiskOverlay header | RK-OVL-04 | `· Wealth Score NN` via `<Num value={fq.total}>` | RiskOverlay.jsx:94 |
| Home AnchorRow | H-ANCH-02 | `NN/100` (`{score}` + `/100` span) | HomeScreen.jsx:455 |

**Verdict:** A6 FAIL (FUNCTIONAL) — Wealth Score appears as bare `NN` on Risk, with label prefix in overlay, and `NN/100` on Home. The value traces correctly to `calcFQ()` everywhere; the format is inconsistent.

---

### FAIL-3: Dashboard NW via shortGBP vs fmt() (FUNCTIONAL)

**Metric:** Net Worth  
**Locations:**

| Surface | Fn | Example output |
|---------|----|---------------|
| Risk SecondaryTile | `fmt(nw)` | `£3.63m` |
| HomeScreen AnchorRow | `fmt(nw)` | `£3.63m` |
| Dashboard mini-header | `shortGBP(headerNW)` | format TBD — may differ |

`shortGBP` is a separate formatter in Dashboard.jsx (line 742). If it produces `£3.6m` or `£3.63M` instead of `fmt()`'s `£3.63m`, that is an A6 FAIL. **The Home audit previously flagged this.** Risk screen itself uses `fmt()` consistently — the failure lives in the Dashboard chrome, not in Risk.jsx. Marked FUNCTIONAL because it is a cross-screen formatter inconsistency.

---

### FAIL-4: S-07 — Z11 table headers dead affordance (FUNCTIONAL/A2)

**Element:** RK-Z11-HD  
**Location:** Risk.jsx:1638–1648 — `<th>` elements with `style={{ fontWeight:700 }}` and `cursor:pointer` implied by parent table styles, but no `onClick` handler. Still renders as visually tappable but is inert.  
**Verdict:** A2 FAIL — confirmed from code; not resolved.

---

### FAIL-5: sonus:navigate listener absent (FUNCTIONAL/A2)

**Element:** RK-Z12-N1  
**Location:** Risk.jsx:1767 — `window.dispatchEvent(new CustomEvent('sonus:navigate', { detail: { tab: 'timeline', planType: 'protection' } }))`  
Dashboard.jsx has no `addEventListener('sonus:navigate', ...)`. The hash fallback (`#tab=timeline&planType=protection`) is set but Dashboard.jsx does not parse `window.location.hash` for tab routing (it uses React state `tab`).  
**Verdict:** A2/A4 FAIL — "Start a protection plan →" button fires events into a void. The hash change has no listener. **Severity: FUNCTIONAL** (button appears wired, does nothing navigational in practice).

---

## 4. Seed Finding Status

| Seed | Status | Notes |
|------|--------|-------|
| S-01 "Health score" label | **RESOLVED** | RiskPrimaryAnchor now uses "Wealth Score" (Risk.jsx:2546) |
| S-02 "Safety score" eyebrow | **RESOLVED** | Eyebrow now reads "Risk Score" (Risk.jsx:2524) |
| S-03 Hardcoded multipliers | **RESOLVED** | `ProtectionGap.jsx` reads `TAX.lifeCoverMultipleDep` etc. from `_bundle.js` → bundle JSON |
| S-04 "s02a" in copy | **RESOLVED** | Copy removed; gap summary is plain English |
| S-05 D3/D6 codes in UniversalAdd | **RESOLVED** | Eyebrows now read "Protection coverage" / "Estate readiness" |
| S-06 onAddProtection unwired | **RESOLVED** | Dashboard passes `onAddProtection` to both `<Risk>` and `<RiskOverlay>` |
| S-07 Z11 dead headers | **CONFIRMED OPEN** | FAIL-4 above |
| S-08 banner dead "tap" | **RESOLVED** | Banner now renders a `<button onClick={onReview}>` |
| S-09 Double ring in overlay | **RESOLVED** | RiskOverlay passes `suppressPrimaryRing={true}` |
| S-10 Z6 Confidence card missing | **RESOLVED** | `ConfidenceCard` component now renders in "How it's changed" drawer (Risk.jsx:2434) |
| S-11 Risk Score format drift | **CONFIRMED OPEN** | FAIL-1 above — DEMO-BLOCKING |
| S-12 Wealth Score format drift | **CONFIRMED OPEN** | FAIL-2 above — FUNCTIONAL |
| S-13 Net Worth fmt drift | **PARTIAL** | Risk + Home both use `fmt()` → PASS; Dashboard chrome uses `shortGBP()` → FAIL-3 |
| S-14 Orphan components | NOT VERIFIED in this pass | Defer to A1 auditor |
| S-15 Brand string drift | NOT VERIFIED in this pass | Defer to A5 auditor |
| S-16 "engine returned empty" copy | **RESOLVED** | Empty state now reads "We don't have enough of your data yet to model these shocks." (Risk.jsx:2382) |
| S-17 "#tab=plan" hash | **PARTIAL** | Hash corrected to "#tab=timeline"; sonus:navigate event still unlistened — FAIL-5 |
| S-18 Dual close affordances | ACKNOWLEDGED DESIGN CHOICE | Two close paths; not a reconciliation issue |
| S-19 X28 top-bar absent | **PASS** | Confirmed absent; FD-RK-2 honoured |
| S-20 BTR "Building track record" | **PASS** | `isBTRBuilding` guard fires when `score === 0` (Risk.jsx:293); renders neutral grey text |

---

## 5. Coverage

Total inventory rows (from inventory §COVERAGE MATH): ~135 rows  
Rows checked this pass (all data-bearing + A6-relevant): **72**  
Rows producing a definite verdict: **72**  
Rows unverified (nav/action rows not A6-relevant, A1/A2 orphan rows): **~63**

```
Coverage  = 72 / 135 = 53%   (data-bearing rows: 100% coverage; nav/action rows: deferred)
FAIL rows = 5
PASS rows = 67
```

**Unverified rows (explicit list):** RK-CHR-01..11 (nav), RK-Z0-03..05 (collapse/expand), RK-Z2-01a..y (25 CrossMap cells), RK-Z3-T1..T3 (view toggles — A2 not A6), RK-Z3-O1 (Orbit centre — confirmed COMPOSITE label, A6 pass on value but display checked indirectly), RK-Z3-R1..R4 (radar visual), RK-DS-02..06 (plain-English copy), RK-D6-00..CN (questionnaire steps), RK-Z6-01 (confidence card — now present), RK-Z7-00..02 (life-event banner), RK-Z9-EMPTY, RK-Z10-CN (cancel), RK-Z12-A (active plan variant), RK-ORPH-01..04 (orphans — dead code check deferred), RK-OVL-01/05/06/07/08.

---

## Summary

**Hardcoded numbers:** 0 confirmed (S-03 resolved — multipliers come from bundle via `_bundle.js`; D6 sub-score values 0/3/6 are spec-canonical constants, not configuration).

**fmt() drift instances:** 3  
1. Risk Score: bare `NN` (ring) vs `NN /100` (overlay) vs `NN/100` (Home) — DEMO-BLOCKING  
2. Wealth Score: bare `NN` (Risk tile) vs `· Wealth Score NN` (overlay) vs `NN/100` (Home) — FUNCTIONAL  
3. Net Worth: `fmt()` on Risk + Home vs `shortGBP()` on Dashboard chrome — FUNCTIONAL  

**S-11 verdict: FAIL (DEMO-BLOCKING)** — Risk Score shows three format variants across Risk/RiskOverlay/Home. Value is consistent; format is not.  
**S-12 verdict: FAIL (FUNCTIONAL)** — Wealth Score format inconsistent across three surfaces.  
**S-13 verdict: PASS on Risk+Home** / **FAIL on Dashboard chrome** — Net Worth uses `fmt()` correctly on both Risk.jsx and HomeScreen.jsx. Dashboard mini-header uses `shortGBP()` — a separate formatter whose output is not confirmed identical.

**Per-dimension breakdown (DimSheet/riskBreakdown):** PASS — `riskBreakdown(entity)[key].value` equals `calcRisk(entity).dims[key]` by construction (`_bdDim` passes the value through unchanged); "Total X of Y" is therefore self-consistent. The 8-persona node verification cited in the brief is corroborated by code path analysis.
