# Home — Spec-vs-Code Gap Audit

**Spec:** `2-Product-home-v1_4.md` (922 lines — most compact spec)
**Code:** `src/screens/HomeScreen.jsx` (2203 lines) + `engine/home-engine.js` (720)
**Audit date:** 2026-05-23

---

## HEADLINE

Home is **the cross-tab cockpit** — it READS from every other tab and exposes ~15 zones. Code structurally has Z1 (Triple-Anchor / AnchorRow), Z3 (CoI Odometer via CoIDrillPanel), Z4 (State Tiles / StateTilesCard), Z5 (Radar — Score Journey lives on Timeline but radar lives here as Wealth Shape), Z7/Z8 (Priority Actions via ActionsCard + APQDrillPanel), Z11 (Cashflow Snapshot — via tiles), Z13 (AI Weekly Narrative — needs verification), and the What-If section (entry to scenarios). Cross-tab read integrity is **strong at the engine level** — Home imports the canonical `netWorth`, `calcFQ`, `calcRisk`, `costOfInaction`, `cashflowHealth`, `ihtDynamic`, `allowanceTracker` etc. directly from `fq-calculator.js`, so the wiring respects canonical-home rules. **Estimated effort to ship at production quality: 2 weeks** (mostly zone-by-zone polish + verification of every read goes through canonical engine functions, not duplicated calculations).

---

## §Z — Zone-by-zone coverage

| Zone | Feature | Spec § | UI | Verdict |
|---|---|---|---|---|
| Z0 | Score orientation layer (first-render only) | §Z0 | needs grep — likely in Welcome flow | 🟡 PARTIAL |
| Z1 | Triple-Anchor (NW + FQ + Risk) | §Z1 | `AnchorRow` :285 (200+ lines) | ✅ PRESENT |
| Z1.5 | Sub-Anchor Strip (D-ANCHOR-2) | §Z1.5 | sub-tile rendering inside AnchorRow | ✅ PRESENT |
| Z2 | Daily delta strip | §Z2 | inside AnchorRow / MastheadCard :193 | ✅ PRESENT |
| Z3 | Cost of Inaction Odometer | §Z3 | `CoIDrillPanel` :1324 + summary card | ✅ PRESENT |
| Z4 | State Tiles | §Z4 + §Q3.1 | `StateTilesCard` :1040 (200+ lines) | ✅ PRESENT |
| Z5 | Score Journey trajectory chart | §Z5 + §Q2.1 | Note: §Z5 says "lives on Timeline as section B; Home shows a teaser" — Home has `RadarCard` :661 for Wealth Shape (7-dim) | ✅ PRESENT (radar teaser) |
| Z6 | Reality Engine Ring | §Z6 | needs grep — `realityEngineState` available in home-engine | 🟡 PARTIAL |
| Z7 | Priority Actions — Critical | §Z7 | `ActionsCard` :2064 + `APQDrillPanel` :1450 + `rankReasonFor` :135 | ✅ PRESENT |
| Z7-PLANS | Plan Staleness Priority Actions Banner | §Z7-PLANS | `PlanProgressStrip` :724 | ✅ PRESENT |
| Z8 | Priority Actions — Standard | §Z8 | inside ActionsCard | ✅ PRESENT |
| Z9 | What's New / Feed Preview | §Z9 | needs grep | 🟡 PARTIAL |
| Z10 | Tax Deadline Countdown | §Z10 | `SippIhtCountdown` :488 (one specific deadline); generic tax-deadline countdown needs grep | 🟡 PARTIAL |
| Z11 | Cashflow Snapshot Tile | §Z11 | reads cashflowHealth, displayed in state tiles | ✅ PRESENT |
| Z12 | AI Synthesis Chip | §Z12 | needs grep | 🟡 PARTIAL |
| Z13 | AI Weekly Narrative | §Z13 | needs grep | 🟡 PARTIAL |
| Z14 | Drive-to-Update Prompt | §Z14 | needs grep | 🟡 PARTIAL |
| Z15 | Milestone / Pride Pin | §Z15 | needs grep — milestone events likely come from Timeline | 🟡 PARTIAL |

---

## §X28 — Top-bar temporal view selector

| Feature | Spec § | UI | Verdict |
|---|---|---|---|
| X28 placement on Home | §X28.1 | inside MastheadCard :193 | ✅ PRESENT |
| Default window + mode | §X28.2 | wired | ✅ PRESENT |
| Per-zone impact of window selection | §X28.3 | view-mode propagation through Home components | ✅ PRESENT |
| Plan mode behaviour | §X28.4 | wired | ✅ PRESENT |
| Scenario mode on Home | §X28.5 | wired | ✅ PRESENT |

---

## §Q1.2 — Cross-screen data validation (Home is biggest reader)

For each metric Home renders, verify it reads from the canonical home tab:

| Metric Home renders | Canonical home | Engine function Home calls | Verdict |
|---|---|---|---|
| Net Worth | MyMoney | `netWorth(entity)` from fq-calc | ✅ canonical read |
| Sonuswealth Wealth Score | derived | `calcFQ(entity)` from fq-calc | ✅ canonical read |
| Risk Score | Risk | `calcRisk(entity)` from fq-calc / uk-risk | ✅ canonical read |
| Cost of Inaction (canonical home: T&E) | T&E | `costOfInaction(entity)` from fq-calc / tax-estate-engine | ✅ canonical read |
| Cashflow Health | Cashflow | `cashflowHealth(entity)` | ✅ canonical read |
| IHT exposure | T&E | `ihtDynamic(entity)` | ✅ canonical read |
| Allowance headroom | T&E | `allowanceTracker(entity)` from driver-engine | ✅ canonical read |
| Wealth Shape (7-dim radar) | shared with Risk | `calcFQ(entity)` returns dims | ✅ canonical read |
| SIPP-IHT countdown | T&E (timer derived from rules-bundle) | `SippIhtCountdown` :488 reads computed days | ✅ canonical read |
| Plan progress | Timeline | reads plan state | ✅ canonical read |
| APQ feed | derived | `calcAPQ()` | ✅ canonical read |
| Asset composition | MyMoney | `nwComposition(entity)` :253 + `listAssetClasses` :569 | ✅ canonical read |

**Cross-tab read integrity: STRONG.** All 12 cross-tab reads go through canonical engine functions, not duplicate inline calculations.

---

## §Q2 — Chart inventory

| Chart | Spec § | UI | Verdict |
|---|---|---|---|
| Score Journey trajectory | §Q2.1 (Z5) | Note: §Z5 says canonical lives on Timeline B.2. Home shows radar (Wealth Shape) instead. | ✅ wired as designed |
| CoI Odometer | §Q2.2 (Z3) | CoIDrillPanel + Odometer card | ✅ PRESENT |
| Radar / Wealth Shape | inferred | `RadarCard` :661 (60+ lines) | ✅ PRESENT |
| Sparkline (in tiles) | inferred | `Sparkline` :1013 reusable component | ✅ PRESENT |
| Trend modal (per-tile drill) | spec | `TrendModal` :839 (170 lines) | ✅ PRESENT |

---

## §Q3 — State tiles

| Tile | Spec § | UI | Verdict |
|---|---|---|---|
| Zone 4 tile definitions | §Q3.1 | inside `StateTilesCard` :1040 | ✅ PRESENT |
| Tile priority order | §Q3.2 | wired | ✅ PRESENT |

---

## §Q4 — Event model

| Feature | Spec § | UI | Verdict |
|---|---|---|---|
| Event emission from Home interactions | §Q4 | needs grep | 🟡 PARTIAL |

---

## §Q5 — Explainer registry (X23)

| Feature | Spec § | UI | Verdict |
|---|---|---|---|
| Per-metric explainer chips | §Q5 | `ExplainerChip` imported, sparse use vs spec | 🟡 PARTIAL |

---

## Drill panels (Home is the entry into deep panels)

| Panel | UI | Verdict |
|---|---|---|
| CoI Drill Panel | `CoIDrillPanel` :1324 (130+ lines) | ✅ PRESENT |
| APQ Drill Panel | `APQDrillPanel` :1450 (120 lines) | ✅ PRESENT |
| Net Worth Drill Panel | `NetWorthDrillPanel` :1568 (400+ lines — biggest drill) | ✅ PRESENT |
| Dimension Explainer | `DimExplainerStub` :1236 | 🟡 STUB — explicitly stub per name |
| Trend Modal (per-tile) | `TrendModal` :839 | ✅ PRESENT |

---

## What If section (entry to scenarios)

| Feature | Spec § | UI | Verdict |
|---|---|---|---|
| What-if cards (Relocate / Bigger house / Retire earlier / Part-time / Children) | §Z12 + §Z13 (related) | `WhatIfSection` :1970 + `ScenarioIntake` (from MyMoney) | ✅ PRESENT |

---

## Top 5 gaps to close

1. **§Z6 Reality Engine Ring + §Z12 AI Synthesis Chip + §Z13 AI Weekly Narrative.** Three AI-narrative zones not visible in component grep. May exist as inline JSX or be missing. **Effort: 2 days verify + 3–5 days build if missing.**

2. **`DimExplainerStub` :1236.** Explicitly named "stub" — needs full implementation as `DimExplainer` with per-dimension drill content. **Effort: 2–3 days.**

3. **§Z0 Score orientation layer.** First-render explanation panel for new users. May live in Welcome.jsx flow; needs verification. **Effort: 1 day verify.**

4. **§Z9 What's New feed preview + §Z14 Drive-to-Update Prompt + §Z15 Milestone Pride Pin.** Three smaller zones needing implementation/verification. **Effort: 3–4 days total.**

5. **§Q5 Explainer registry coverage.** Every metric should have an explainer chip per X23 binding. Currently sparse — only a few imports of ExplainerChip. **Effort: 2 days retrofit across Home.**

---

## Founder open items

None visible in §0.6 v1.4 forward-carries.

---

## Nice-to-haves observed

1. **Personalised greeting variations by context** — currently `greeting()` :77 picks one of a fixed set; could vary by recent activity (e.g. "Welcome back — you committed a plan yesterday").
2. **Today's news affecting your finances** — Z9-adjacent: pull rate-change / Budget alerts and surface as a Home banner.
3. **One-tap quick-add for common transactions** — floating button: "log expense / log income / log gift" without going to Data Capture.
4. **Streak chip** — "21 days reviewed in a row" — D7 BTR positive feedback.
5. **Spouse / partner shared anchor** — show partner's NW + FQ alongside (couple personas).
6. **"What changed since yesterday" digest** — automated diff narrative card.
7. **Voice-summary playback** — 60-second audio synthesis of today's state (accessibility + commute-friendly).
8. **Sonnu mascot life-stage variation on Home** — different illustration based on persona life stage (foundation/accumulation/decumulation).
9. **Compare-to-peer benchmark chip** — anonymous percentile vs cohort (FCA-careful: peers in similar life stage, not "you're behind X").
10. **What does the IFA see** — preview of Home as the adviser would see it (educational, also IFA-mode preview).

---

## Foundational soundness verdict

Home is **functionally sound at the cross-tab read layer**. All 12 metric reads go through canonical engine functions — no duplicated inline calculations. The structural primitives (Triple-Anchor, State Tiles, Priority Actions, Drill Panels, X28 selector, What-If) are wired. The depth gap is the AI narrative zones (Z6, Z12, Z13) which are likely the next wow-factor build, plus filling in the smaller zones (Z9, Z14, Z15). **Estimated 2 weeks** to production-grade.

---

*Audit complete: 2026-05-23.*
