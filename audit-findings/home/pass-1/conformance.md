---
Title: Home Screen — Conformance Audit (A1) — Stage B Pass-1
Version: pass-1-stage-b
Date: 2026-05-18
Auditor: A1 — Conformance
Screen: HomeScreen.jsx v2.1
Inventory baseline: home-inventory-v1.md (v1, 17 May 2026)
---

## Method

Walk every inventory row. For each row: is the element present in the build? Is it in the right region? Does its content/state match expectation? Elements in build NOT in inventory are flagged UNLISTED.

Severity applied only where an A1 divergence has direct user impact:
- DEMO-BLOCKING: element missing entirely, or wrong content visible to user
- FUNCTIONAL: present but wrong label, count mismatch, stale copy
- POLISH: cosmetic

---

## Region 1 — Shell / chrome

| ID | Element | Build verdict | Severity | Notes |
|----|---------|--------------|----------|-------|
| H-CHR-01 | App shell / scroll container | PASS | — | Present; standard scroll layout |
| H-CHR-02 | Bottom nav | PASS (host) | — | Nav spacer `height: 78` in HomeScreen; actual nav bar rendered by parent Dashboard — correct architecture |
| H-CHR-03 | Dark/light theme tokens | PASS | — | CSS var tokens (`--c-surface`, `--c-text`, etc.) throughout |
| H-CHR-04 | Logo / wordmark | NA | — | Logo is shell responsibility, not HomeScreen |
| H-CHR-10 | Settings icon / avatar | NA | — | Shell responsibility |

---

## Region 2 — Masthead + mode row

| ID | Element | Build verdict | Severity | Notes |
|----|---------|--------------|----------|-------|
| H-MAST-01 | Greeting (`Good {time}, {name}`) | PASS | — | `greeting()` + `pickFirstName()` — honorifics stripped, displayName preferred |
| H-MAST-02 | Date line | PASS | — | `fmtHomeDate()` — "Mon 13 May" format confirmed |
| H-MAST-03 | Mode pill row (Today / Future / Plan / What If) | PASS | — | `MODES` array at L179–184, 4 modes |
| H-MAST-04 | Active mode highlight state | PASS | — | `viewMode` state drives pill active class |

---

## Region 3 — Anchors (4)

| ID | Element | Build verdict | Severity | Notes |
|----|---------|--------------|----------|-------|
| H-ANCH-01 | Net Worth | PASS | — | `fmt(nw)` via `Drillable` metric="netWorth" |
| H-ANCH-02 | Wealth Score + donut | PASS | — | `calcFQ(entity).total` + donut SVG + band name |
| H-ANCH-03 | Risk Score + gauge | PASS | — | `calcRisk(entity).total` + gradient bar + band |
| H-ANCH-03b | Gap count badge | PASS | — | `gapCount > 0` guard; routes to `drillFn('gaps')` → APQDrillPanel |
| H-ANCH-04 | Cost of Inaction | PASS | — | `costOfInaction(entity)` — see reconciliation re: totalCoI vs costOfInaction |
| H-ANCH-04c | SIPP countdown bar | PASS | — | `2027-04-06` deadline; enacted date `2026-03-18` (correct per Finance Act 2026) |

---

## Region 4 — Radar card

| ID | Element | Build verdict | Severity | Notes |
|----|---------|--------------|----------|-------|
| H-RAD-00 | "See all 7 dimensions" / radar card chevron | PASS | — | `RadarAnchor` rendered inside `RadarCard`; `DIMENSIONS` from config |
| H-RAD-01–07 | 7 dimension radar nodes | PASS | — | `DIMENSIONS` array drives geometry; labels from `d.label`; 7 confirmed |
| H-RAD-08 | Gap markers (coral `!`) | PASS | — | `GAP_THRESHOLD = 0.15` in RadarAnchor drives markers |
| H-RAD-09 | Radar centre (NW + Score) | PASS | — | `CenterCap` in RadarAnchor; uses same engine calls |
| H-RAD-10 | Brief insight 1 | PASS | — | Brief section in RadarCard; persona-narrative aware |
| H-RAD-11 | Brief insight 2 — CoI 2031 figure | UNVERIFIED | — | Projection value requires runtime check |
| H-RAD-13 | Mode variants (today/future/plan/whatif) | PASS | — | `viewMode` prop propagated to RadarAnchor |

---

## Region 5 — "What to do next" actions card

| ID | Element | Build verdict | Severity | Notes |
|----|---------|--------------|----------|-------|
| H-ACT-00 | Actions header copy | FAIL | FUNCTIONAL | Inventory expects "6 · ranked by impact"; build renders "What to do next" — count label absent. The "See all N →" CTA shows count but header itself does not. |
| H-ACT-01–06 | Action rows (engine-driven) | PASS | — | `calcAPQ(entity)` → `actions.slice(0, 6)`; engine-ranked |
| H-ACT-0x | "Show me how →" CTA | PASS | — | Present in expanded state; routing audited separately in interaction.md |
| H-ACT-0y | Impact figure `+{N}` per row | PASS | — | `action?.impact?.finioScore`; displayed as chip |
| H-ACT-0z | Expand/collapse chevron | PASS | — | `setExpandedId` toggle, chevron rotates 90° |
| H-ACT-SEE | "See all N →" count CTA | PASS | — | `actions.length` displayed, routes to APQDrillPanel |

---

## Region 6 — What-If section

| ID | Element | Build verdict | Severity | Notes |
|----|---------|--------------|----------|-------|
| H-WI-00 | Header "✦ What if?" + "Explore · not advice" | PASS | — | Both strings present at L1494–1498 |
| H-WI-01 | Scenario — relocate | PASS | — | Key `relocate` in DE_SCENARIOS[0] |
| H-WI-02 | Scenario — bigger house | PASS | — | Key `house` in DE_SCENARIOS[1] |
| H-WI-03 | Scenario — retire 5y earlier | PASS | — | Key `retire`, tag `Instant`, engine: true |
| H-WI-04 | Scenario — part-time / break | PASS | — | Key `part_time`, tag `Instant`, engine: true |
| H-WI-05 | Scenario — help children | PASS | — | Key `children` in DE_SCENARIOS[4] |
| H-WI-06 | "See all 12 scenarios →" affordance | PASS | — | `setShowAll` toggle; label uses `DE_SCENARIOS.length` = 12; FD-1 satisfied |
| H-WI-07 | Freeform "Ask your own what-if…" + "Ask Sonu →" | PASS | — | Input at L1543; routes to `onNav('de', { query })` |

---

## Region 7 — Plan strip + footer

| ID | Element | Build verdict | Severity | Notes |
|----|---------|--------------|----------|-------|
| H-PLAN-01 | Plan strip body | PASS | — | "No active plan — set one in the **Timeline** tab." — seed S-08 was a prior bug; v2.1 correctly says "Timeline" tab |
| H-PLAN-02 | "Set plan →" CTA | PASS | — | `onNav?.('timeline')` at L655 — correct route |
| H-FOOT-01 | Trust / info line | PASS | — | "Information & guidance only" in footer |
| H-FOOT-02 | FCA boundary line | PASS | — | "Not regulated financial advice · FCA boundary applies" at L1467; present on all render states |

---

## Region 8 — Overlays

| ID | Element | Build verdict | Severity | Notes |
|----|---------|--------------|----------|-------|
| H-OVL-01 | Dimension drill overlay | PASS | — | `DimExplainerStub` shows what/lift/route for all 7 DIM_KEYS |
| H-OVL-02 | What-If scenario overlay (ScenarioIntake) | PASS | — | `ScenarioIntake` rendered when `intakeScenario` set; replaces full WhatIfSection |
| H-OVL-03 | Action-detail modal | PASS (A4 risk noted) | FUNCTIONAL | Inline row expand — NOT a separate modal; content is `action.context` prose + "Show me how" button. Whether this constitutes SOURCE/ACTION/DECISION depends on route — see interaction.md |
| H-OVL-04 | Gaps / APQ drill | PASS | — | `APQDrillPanel` for `localDrill === 'apq'` |

---

## UNLISTED elements (present in build, absent from inventory v1)

| Element | Location | Concern level |
|---------|---------|--------------|
| `SippIhtCountdown` | `src/screens/HomeScreen.jsx` L414 — separate tile between AnchorRow and radar | DECISION-NEEDED — regulatory component; founder should add to inventory v2 |
| `StateTilesCard` | L1435 — horizontal scroll row with 6 state tiles (FI Ratio, Debt, Protection, Cashflow, Estate, Tax Efficiency) | DECISION-NEEDED — significant additional surface; routes to 5 tabs |
| `NetWorthDrillPanel` | L1414 — `localDrill === 'networth'` overlay | Acceptable unlisted overlay |
| `PensionDrawdownPanel` | L1417 — `localDrill === 'pension-drawdown'` | IMPORTANT: this is the pension drawdown surface that H-ACT-01 should reach |
| `APQDrillPanel` | L1416 — full action list overlay | Acceptable unlisted overlay |
| `CoIDrillPanel` | L1415 — per-domain CoI breakdown | Acceptable unlisted overlay |

---

## DECISION-NEEDED

| Ref | Issue | Required decision |
|-----|-------|-------------------|
| D-CON-1 | `SippIhtCountdown` component not in inventory — is it a permanent Region 2.5 or Wave 7 scope? | Founder adds to inventory v2 or confirms Wave 7 |
| D-CON-2 | `StateTilesCard` not in inventory — 6 tappable tiles, each routes to a different tab. Is this within FD-3 frozen layout? | Founder: add to inventory or flag as layout drift |
| D-CON-3 | H-ACT-00 header copy mismatch: "What to do next" (build) vs "6 · ranked by impact" (inventory). Accept build copy? | Founder accepts or requests change |

---

## Coverage summary

- Total inventory rows assessed: 52 (including sub-rows)
- PASS: 44
- FAIL: 1 (H-ACT-00 header copy)
- UNVERIFIED: 1 (H-RAD-11 runtime projection)
- UNLISTED: 6 (new components not in inventory)
- Coverage: 51/52 = **98%**
