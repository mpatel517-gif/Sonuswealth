Title: Timeline tab — corrected scope (hardening pass, NOT a build)
Version: 1.0
Date: 2026-06-08
Status: DOCUMENTED
Cluster: 2-Product / Timeline
File name: TIMELINE-SCOPE-corrected.md
Purpose: Replace the incorrect "Timeline is underbuilt, defer the build" finding with the verified state and a tractable hardening scope.

**Summary:** Timeline §A–§F are fully built with real data, provenance, and honest empty states (1806px of content in an internally-scrolling `main`). The prior "underbuilt" call was a measurement error (read documentElement.scrollHeight 487 instead of main.scrollHeight 1806, at a 487px preview viewport, off a top-fold screenshot). Real remaining work = the flexibility mandate + 3 specific fixes — a hardening pass the size of Tax/Risk, not a ground-up build.
**Tags:** #timeline #scope #correction #flexibility
**Updated:** 2026-06-08

---

## VERIFIED CURRENT STATE (Bruce ?demo=a, live)

All six sections render with rich content + provenance + correct empty states:
- **§A Life stage** — Transition, Age 62, 70% through, Stage 4/7, 7-stage strip, "enter Decumulation at 65 · post-75 death-benefit rules", DOB provenance. ✅
- **§B Score journey** — Wealth 67 ▲+23, Risk 71 ▲+11, ACTION LEVELS (67→82→100), HIGH-confidence chips, calcScoreHistory/calcRiskHistory provenance. ✅
- **§C Action calendar** — pension nomination overdue, gift clock 33%, SA deadline 31 Jan 2027, DC-pensions-enter-estate 6 Apr 2027 (£1,130/day · £340k · 301 days), ISA reset; each with provenance. ✅ (this is the "bill/deadline calendar")
- **§D Decision log** — "No decisions logged yet" honest empty state. ✅
- **§E Scenarios & Plans** — 7/8 plans with stale/current chips, 3 saved scenarios. ✅
- **§F Goals & Milestones** — achieved + projected milestone timeline, 8 goal templates. ✅
- FCA info/guidance footer present. ✅

`main` = height:293px · overflow-y:auto · scrollHeight 1806 → content reachable by internal scroll (standard app-shell; cramped only because preview viewport is 487px).

## REAL GAPS (the actual scope)

### 1. Flexibility mandate — currently ZERO grabbable controls (rangeControls = 0)
- **Goal-seek target → ScrubTrack** (GoalSeek lives at Timeline.jsx ~1587; target is a typed `<input>` at ~1642). Drag the target, paths re-solve. **MUST NOT** reintroduce the infinite loop: the dropped agent version put `entity` (fresh ref each render) in a setState-ing useEffect dep array → "Maximum update depth exceeded". Use useMemo / stable deps / ref-guard (see feedback_strictmode_de_pattern). Reuse the committed `ScrubTrack` from TaxEstate.jsx (40e2175).
- **§A life-stage / retirement-age override** (spec §4.7 A.5 — currently absent). Drag retirement age → §A strip + the "enter Decumulation at N" marker + downstream projections.
- **§C gift amount/date adjustable** → gift-clock taper re-drives live (statutory dates stay fixed — correct). Other §C entries (SA, ISA, SIPP) are statutory/derived, not user-set.
- **§B** — surface any score-journey projection assumption as a control where a number is driven by one (else leave as read-only mirror per D-SCORE-JOURNEY-1).

### 2. Bug — "YOUR PLAN · HEADLINE … Awaiting data · Funded —"
`PlanFundedHeadline`/`TrackingPill` show null because `fundedPct` (Timeline.jsx:1266) reads `deltaResults.fundedRatio` from persona scenarios, and Bruce's 3 saved scenarios don't expose it for the Retirement headline plan. Wire fundedPct from the saved-scenario/plan data so the headline shows a real funded% (Bruce has 7/8 plans + 3 scenarios — there is data to read).

### 3. Code leak — "Capital Efficiency (PRC/PCC) — Coming next"
Internal PRC/PCC code at the top layer (PP-9 violation). Remove the dead sub-anchor.

### 4. Charts — verify ranges + today divider
§B/§F projections: confirm uncertainty shows as a labelled band (not single line) and a "today" divider exists; add if missing. NET compounded rate stated on any £ projection.

### 5. Regression guards
- No render loop (check console for "Maximum update depth" after every change).
- Debt/NW projections already unified (commit 10d64fe — netWorthAtHorizon); reuse, don't re-derive.
- CoI on Timeline is read-only from T&E per-action (`costOfInaction(entity).byAction[category]`) — already correct per spec §972; keep.

## EFFORT
Comparable to the Tax & Risk passes (single screen + a few engine touch-points). One build agent + one independent verification pass. NOT a multi-section ground-up build.

## VERIFY (§9.5)
Both personas (a, mrt-core); scrape §A–§F render + provenance; drag each new control and prove the driven number re-draws (scope the scrape to the control's card); tie-outs vs engine; console clean (no loop); screenshot after a server restart (Timeline screenshots have worked when Risk's didn't — try, don't fabricate).
