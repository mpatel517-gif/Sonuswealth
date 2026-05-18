# Risk Screen — Element Inventory v1

**Screen:** Sonuswealth Risk (build target: React in `src/screens/Risk.jsx` + `src/screens/RiskOverlay.jsx`)
**Design baseline:** none on disk — Risk has no Stitch HTML mockup; the React component IS the structural truth.
**Reconciliation baseline:** engine — `src/engine/fq-calculator.js` (`calcRisk`, `riskBand`, `riskShockSuite`, `calcRiskHistory`, `whatWouldHelpMost`, `lifeEventPaths`, `calcAPQ`, `planFor`, `financialProfile`) + `src/engine/modules/uk-risk-2026-1-1.js` (7-dim spec + sub-scoring).
**Intent reference (NOT a conformance target):** `2-Product/2-Product-risk-layer-v1_6.md` — zone map (Z0–Z12), §1.1 / §2.1 / §2.3 / §2.7 D-ANCHOR-2, §8.1 confidence levels, §33c O-RISK-17 (no X28 on Risk).
**Engine reference (locked):** `src/engine/modules/uk-risk-2026-1-1.js` — 7 dimensions, max scores per dim. Per `CLAUDE.md` memory `feedback_always_check_rules_uk`, every Risk number on screen must trace here (or to `fq-calculator.js`), not training data.
**Date:** 17 May 2026

---

## Why this file exists

This is the **fixed target** the whole audit measures against. Every interactive or
data-bearing element on Risk is one numbered row. The audit does not "find mistakes" —
it walks this list and records a verdict per row. That is the only thing that makes
"99% confident" a real statement: it means *N of M rows verified PASS*, not a feeling.

**This file is the worksheet.** Auditor agents fill the `Verdict` columns. Do not add
or remove rows except via the "inventory drift" rule in the runbook (§6). If the build
contains an element not listed here, that is itself a finding (`UNLISTED`).

Risk has two surfaces sharing one body composition (`RiskBody`): the **full-page**
`Risk.jsx` (when nav lands on the Risk tab) and the **sheet overlay** `RiskOverlay.jsx`
(when the Risk Score tile of the triple-anchor is tapped on Home / My Money / etc.).
Both must reconcile to the same engine output — Region 9 below lists overlay-only chrome
that does NOT exist on the full page.

---

## The six assertions (every row is tested against all six)

| # | Assertion | Fails when… |
|---|-----------|-------------|
| A1 | **Identified** — element exists in the build and matches this row | Element missing from build, or build has an element not in this inventory |
| A2 | **Drillable** — if it is a number, action, or nav element, interacting with it does something | Tapping is dead / no handler / no visible response |
| A3 | **Destination correct** — it resolves to the surface that **owns its subject** | A pension action lands on Cashflow; a tax number lands on Risk; etc. |
| A4 | **Destination coherent** — the landing is a usable continuation: it shows the SOURCE, an ACTION, or a DECISION | Lands on a generic modal, a dead-end, a screen top with no context, or an unrelated view |
| A5 | **Plain English** — label + any explainer readable by a non-expert in one pass; jargon translated; information-not-advice (FCA) | Unexplained jargon; advice-phrased copy; figure with no plain meaning |
| A6 | **Reconciled** — every number traces to an engine function and matches value + format everywhere it appears | Hardcoded number; `fmt()` not used; same metric shows two values/formats |

**Drill destination taxonomy (A3 + A4).** Every drillable element must resolve to one of:
- **SOURCE** — the breakdown / detail / provenance of where a number came from.
- **ACTION** — a place to *do* the thing (a panel, a flow).
- **DECISION** — a place to weigh options and commit (scenario engine, plan).

If a drillable element resolves to *none* of these, A4 = FAIL.

**Verdict values:** `PASS` · `FAIL` · `NA` · `UNVERIFIED` (default) · `BLOCKED` (cannot test).
**Severity (set by orchestrator on any FAIL):** `DEMO-BLOCKING` · `FUNCTIONAL` · `POLISH`.

---

## Confirmed founder decisions (auditors treat these as fixed — do NOT flag against the stale spec)

| FD | Decision |
|----|----------|
| FD-NAME-1 | **Product name is `Sonuswealth` (D-NAME-2, locked 9 May 2026 — supersedes Caelixa and Finio).** Source of truth: `src/config/brand.js` (`BRAND.name`). Casing: logo / wordmark = `sonuswealth` (lowercase, see `BRAND.nameDisplay`); body text, titles, aria-labels, page `<title>`, score strings = `Sonuswealth` (sentence case); marketing slogans (footer-tier only) may use ALL CAPS. Every `Caelixa` or `Finio` in user-facing strings = FUNCTIONAL FAIL (A5/A6). Engine-module disclaimers + comments are queued for Wave 4 Morph sweep. |
| FD-CROSS-1 | **Risk owns *the shock test* for pension/SIPP/drawdown — drawdown survival under sequence risk, market downturn, longevity stress.** Canonical "doing" surface for pension/SIPP/drawdown actions is **My Money**; Risk shows the *can-this-survive* view. Every Risk shock-scenario / what-helps-most / take-action row must therefore drill to *its own* shock-test detail (SOURCE) OR hand off to the action's owning surface (ACTION on My Money / Cashflow / T&E); never to a describe-only modal. |
| FD-LOGO-1 | Brand assets live at `G:\My Drive\All Work\6.Finio\1-Clusters\Codex UI\deliverables\sonuswealth-site\assets\{favicons,logo,mascot,videos}`. Conformance-auditor checks that every surface uses the right logo variant per theme (light/dark) and flags the faded-purple dark variant as DEMO-BLOCKING wherever it appears below WCAG AA contrast. |
| FD-MASCOT-1 | Mascot is **Sonnu (owl)**, 6 life-stage forms: Starting Out · Growing Wealth · Planning Ahead · Peak Complexity · Securing Tomorrow · Leaving a Legacy. Placement on screens is **Wave 7 enhancement scope**, not in-audit; audit treats absence of Sonnu as not-a-finding. |
| FD-RK-1 | **Risk Score is 7-dimensional** per `2-Product-risk-layer-v1_6.md` + `src/engine/modules/uk-risk-2026-1-1.js`: **Income Resilience (max 20) · Liquidity Buffer (18) · Protection Coverage (18) · Debt Vulnerability (15) · Concentration Risk (12) · Dependency Exposure (10) · Behavioural Track (7)**. NOTE: Home's radar uses 7 *plain-English* labels — **Habits · Own · Tax · Safety · Flow · Debt · Legacy** — those map to the Wealth Score (`calcFQ`) dimensions, NOT to Risk's 7 dims. Reconciliation: **the *overall* Risk Score (e.g. 78/100)** on Risk must equal Home anchor H-ANCH-03 in the *same `fmt()` format*; the per-dim values do NOT reconcile to Home's radar (different model). Auditor must flag any per-dim Risk score that pretends to be the same axis as a Home radar dim. |
| FD-RK-2 | **No X28 on Risk** per spec §33c O-RISK-17. Risk Score is point-in-time. The only temporal cut here is the Z8 history picker (`1mo / 3mo / 6mo / 12mo`), which is a **local control distinct from X28**. Auditor must flag any X28 top-bar / FY / RY / TY12 affordance on Risk as DEMO-BLOCKING. |
| FD-RK-3 | **Risk is canonically an overlay** (D-ARCH-2). The full-page surface exists during transition. Both render the same `RiskBody`. If the two diverge in any row of the inventory, the overlay is canonical and the full page is the FAIL. |

---

## ELEMENT TABLE

> `Owns-subject destination` is the **expected** A3/A4 target — the auditor checks the
> build against this. Where it reads "dedicated panel," a coherent in-context drill
> (overlay or sub-screen) is acceptable; a bare tab-jump is not.
>
> Many of these elements have **two instances** — one in the full-page `Risk.jsx`
> surface, one in the `RiskOverlay.jsx` sheet. Unless flagged otherwise the auditor
> must test BOTH and they must reconcile to each other.

### Region 1 — Shell / chrome (full-page Risk only)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| RK-CHR-01 | Sidebar nav — Home | NAV | Home screen | UNVERIFIED | rendered by Dashboard chrome, not Risk.jsx itself; included for completeness |
| RK-CHR-02 | Sidebar nav — My Money | NAV | My Money screen | UNVERIFIED | |
| RK-CHR-03 | Sidebar nav — Cashflow | NAV | Cashflow screen | UNVERIFIED | |
| RK-CHR-04 | Sidebar nav — Tax & Estate | NAV | Tax & Estate screen | UNVERIFIED | |
| RK-CHR-05 | Sidebar nav — Risk | NAV | self (active state) | UNVERIFIED | |
| RK-CHR-06 | Sidebar nav — Timeline | NAV | Timeline screen | UNVERIFIED | |
| RK-CHR-07 | Sidebar nav — Ask Sonu | NAV | Ask Sonu surface | UNVERIFIED | |
| RK-CHR-08 | Persona switcher | ACTION | persona-select control | UNVERIFIED | demo-only |
| RK-CHR-09 | Topbar score chip (Wealth + sparkline) | DATA | SOURCE — Wealth Score breakdown | UNVERIFIED | RECONCILE: Home topbar H-CHR-10 |
| RK-CHR-10 | Bell / notifications icon | NAV | notifications surface | UNVERIFIED | |
| RK-CHR-11 | Settings (⚙) icon | NAV | Settings surface | UNVERIFIED | |
| RK-CHR-12 | **No X28 top-bar** (FD-RK-2 enforced) | NA | NA — must NOT appear | UNVERIFIED | If any FY / RY / TY12 / time-window selector renders on Risk → DEMO-BLOCKING |

### Region 2 — Z0 X25 hero caption + X22 breadcrumb

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| RK-Z0-01 | X22 breadcrumb "← Home" (or `originLabel`) | NAV | back to origin (Home / My Money / wherever overlay opened from) | UNVERIFIED | `onHome` handler / `onClose` in overlay |
| RK-Z0-02 | X25 hero caption card — italic Georgia quote: *"If something went wrong tomorrow — would I survive it financially?"* | DATA | NA (display) | UNVERIFIED | A5 — verify plain-English; FCA-safe (question, not promise) |
| RK-Z0-03 | X25 hero caption sub-line: "See where you're resilient, where you're exposed, and what a shock to each would mean in pounds." | DATA | NA (display) | UNVERIFIED | A5 |
| RK-Z0-04 | Hero collapse "×" button | ACTION | collapses to "? What is this?" chip | UNVERIFIED | per-overlay memory; resets on remount |
| RK-Z0-05 | Hero re-expand chip ("? What is this?") | ACTION | re-expands hero card | UNVERIFIED | |

### Region 3 — Z1 Risk-primary anchor (full-page only — `RiskPrimaryAnchor`)

> Spec §2.3 + §2.7 D-ANCHOR-2: Risk inverts the triple-anchor hierarchy. Risk primary (large, left); Wealth + NW secondary (right, stacked). Sticky on scroll.

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| RK-ANCH-01 | Risk Score ring (primary, large) — score + band name | ANCHOR | SOURCE — dimension breakdown (Z3 below) | UNVERIFIED | `calcRisk(entity).total`; RECONCILE: Home H-ANCH-03 (same value, same `fmt()`) |
| RK-ANCH-01a | Ring fill animation (1500ms elastic settle, counter-up via `<Num animate>`) | DATA | NA (visual) | UNVERIFIED | A6 — verify final value matches `risk.total` |
| RK-ANCH-01b | Ring centre text: score number + band name + "Risk Score" label | DATA | NA (echo of ring) | UNVERIFIED | A5 — band names are jargon-translated per FD-RK-1 |
| RK-ANCH-01c | Eyebrow "Safety score · primary" | DATA | NA (display) | UNVERIFIED | A5 — uses "Safety score" not "Risk Score" — flag if labels conflict across the same anchor |
| RK-ANCH-02 | ConfBadge — High / Medium / Low confidence chip | DATA | SOURCE — confidence-level explainer | UNVERIFIED | `risk.confidenceLevel` from engine; A5 plain-English |
| RK-ANCH-03 | SetbackChip — appears only when 1-month drop ≥ 5 points | DATA | SOURCE — history detail (Z8) | UNVERIFIED | pulse-glow when triggered; verify trigger via `calcRiskHistory(entity,'1mo')` |
| RK-ANCH-04 | ExplainerChip `HOME-2` | ACTION | SOURCE — explainer overlay | UNVERIFIED | A5 — same chip ID as Home; copy must match |
| RK-ANCH-05 | Secondary tile — "Health score" (Wealth Score value + band) | DATA | SOURCE — Wealth Score breakdown | UNVERIFIED | `calcFQ(e).total`; onTap → `onDrillMetric('wealthScore')`; RECONCILE: Home H-ANCH-02. **Labelled "Health score" here, "Wealth Score" everywhere else — A5/A6 likely conflict.** |
| RK-ANCH-06 | Secondary tile — "You own" (Net Worth, `fmt()`) | DATA | SOURCE — My Money asset breakdown | UNVERIFIED | `netWorth(e)`; onTap → `onDrillMetric('netWorth')`; RECONCILE: Home H-ANCH-01 (same value, same `fmt()`) |

### Region 4 — Z1 ring (RiskBody, overlay-only when `suppressPrimaryRing=true`)

> Suppressed on full-page Risk (because RK-ANCH-01 already shows the ring). Renders in the `RiskOverlay.jsx` sheet.

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| RK-Z1-01 | Z1 ring card (overlay variant) — `RiskRing` + ConfBadge + SetbackChip + ExplainerChip | DATA | SOURCE — dimension breakdown | UNVERIFIED | Same ring component as RK-ANCH-01; A6 — must show *identical* value to overlay header (RK-OVL-02) and to RK-ANCH-01 when reached from full page |

### Region 5 — Z2 Financial Profile Map (5×5 CrossMap)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| RK-Z2-00 | Eyebrow "Financial Profile Map" | DATA | NA | UNVERIFIED | |
| RK-Z2-01 | `CrossMap5x5` grid — 25 cells (Wealth band × Risk band) | DATA | SOURCE — profile-cell detail (`crossmap:<fq>-<risk>`) | UNVERIFIED | onCellTap → `onDrillMetric(\`crossmap:${cell.fq}-${cell.risk}\`)`; A2 verify handler in build |
| RK-Z2-01a..y | Each of 25 cells | DATA | SOURCE — that cell's archetype detail | UNVERIFIED | enumerated as sub-rows during audit |
| RK-Z2-02 | Active-cell highlight (user's current fq×risk position) | DATA | NA (visual) | UNVERIFIED | `mapFqBand(fq.band.name)` × `mapRiskBand(risk.band.name)`; A6 must equal RK-ANCH-01 + RK-ANCH-05 bands |
| RK-Z2-03 | ProfileCell card below map — band name + implication copy | DATA | NA (display) | UNVERIFIED | `financialProfile(entity)`; A5 — verify implication is plain English not jargon |

### Region 6 — Z3 Resilience Dimensions panel (7-dim, 3-view toggle)

> The Risk Score's 7 dimensions. Per FD-RK-1 these are NOT the same axes as Home's radar — auditor must NOT reconcile these to Home H-RAD-01..07.

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| RK-Z3-00 | Card eyebrow "Resilience" + title "Resilience Dimensions" + `ExplainerChip RISK-1` | DATA | SOURCE — methodology explainer | UNVERIFIED | A5 |
| RK-Z3-T1 | View toggle — Radar | ACTION | switches view to heptagonal radar | UNVERIFIED | A2 |
| RK-Z3-T2 | View toggle — Orbit | ACTION | switches view to orbit nodes | UNVERIFIED | |
| RK-Z3-T3 | View toggle — Bars (default) | ACTION | switches view to stacked bars | UNVERIFIED | |
| RK-Z3-01 | Dim — Income Resilience (max 20) | DATA | dimension drill → DimSheet | UNVERIFIED | `risk.dims.incomeRes`; A5 jargon-translated |
| RK-Z3-02 | Dim — Liquidity Buffer (max 18) | DATA | DimSheet | UNVERIFIED | `risk.dims.liquidity`; A5 |
| RK-Z3-03 | Dim — Protection Coverage (max 18) | DATA | DimSheet | UNVERIFIED | `risk.dims.protCov`; A5 |
| RK-Z3-04 | Dim — Debt Vulnerability (max 15) | DATA | DimSheet | UNVERIFIED | `risk.dims.debtVuln`; A5 |
| RK-Z3-05 | Dim — Concentration Risk (max 12) | DATA | DimSheet | UNVERIFIED | `risk.dims.concRisk`; A5 |
| RK-Z3-06 | Dim — Dependency Exposure (max 10) — D6 | DATA | DimSheet (with D6 sub-chips + questionnaire) | UNVERIFIED | `risk.dims.depExp`; A5 — verify "Dependency Exposure" not "D6 sub-scoring" in user copy |
| RK-Z3-07 | Dim — Behavioural Track (max 7) — D7 | DATA | DimSheet | UNVERIFIED | `risk.dims.behaviouralTrack`; **CRIT 1.3 already addressed: special-cased to neutral grey "Building track record — needs 90 days" when score=0; verify no red 0/7 leak** |
| RK-Z3-R1 | Radar view — heptagonal SVG polygon | DATA | SOURCE — dim detail on tap | UNVERIFIED | `bandColour` drives stroke + tinted fill (CRIT 1.5 — verify NOT hardcoded mint) |
| RK-Z3-R2 | Radar guide polygons (×4 at 0.25/0.5/0.75/1) | DATA | NA (visual) | UNVERIFIED | |
| RK-Z3-R3 | Radar spokes (×7) | DATA | NA (visual) | UNVERIFIED | |
| RK-Z3-R4 | Radar dim labels + pct (×7) | DATA | tap node → DimSheet | UNVERIFIED | A2 each node |
| RK-Z3-O1 | Orbit view — centre composite "sum of 7 dims" | DATA | NA | UNVERIFIED | HIGH 1.4 addressed — verify NOT showing "78/100" (would duplicate ring) |
| RK-Z3-O2 | Orbit view — 7 dim nodes around ring | ACTION | DimSheet | UNVERIFIED | A2 each node |
| RK-Z3-B1 | Bars view — 7 `DimRow` rows (stacked, animated 800ms width fill, staggered 60ms reveal) | ACTION | DimSheet on row tap | UNVERIFIED | A2 each row |

### Region 7 — DimSheet (dimension detail overlay reached from Z3)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| RK-DS-01 | Sheet header — icon tile + dim label + `score/max · pct%` | DATA | NA | UNVERIFIED | A6 — score must equal Z3 row |
| RK-DS-02 | Description body — `RISK_DIM_DESCRIPTIONS[key]` | DATA | NA | UNVERIFIED | A5 — verify plain-English per dim; 7 strings hardcoded in Risk.jsx |
| RK-DS-03 | D6 sub-chips block (only when `key === 'depExp'`) | DATA | NA | UNVERIFIED | renders `D6SubChips`; 5 sub-rows |
| RK-DS-03a | D6 sub — Will | DATA | NA | UNVERIFIED | `d6SubScores` derives from `entity.willStatus`; values: current=6 / basic|outdated=3 / else=0 |
| RK-DS-03b | D6 sub — Power of attorney | DATA | NA | UNVERIFIED | `entity.lpaStatus` both=6 / financial_only|health_only=3 / else=0 |
| RK-DS-03c | D6 sub — Nominations | DATA | NA | UNVERIFIED | `entity.nominationsStatus` all=6 / partial=3 / else=0 |
| RK-DS-03d | D6 sub — Life-in-trust | DATA | NA | UNVERIFIED | derived from `entity.assets.protection.lifeInsurance.{exists,inTrust}` + dependants |
| RK-DS-03e | D6 sub — Guardian | DATA | NA | UNVERIFIED | `entity.guardianStatus` + dependants count |
| RK-DS-04 | "Update answers — 60-second questionnaire →" button | ACTION | opens `D6Questionnaire` | UNVERIFIED | A2 |
| RK-DS-05 | Behavioural-track "How to earn points" box (only when `key === 'behaviouralTrack'`) | DATA | NA | UNVERIFIED | A5 — copy hardcoded in Risk.jsx |
| RK-DS-06 | "Got it" close button | ACTION | closes sheet | UNVERIFIED | A2 |

### Region 8 — D6 Questionnaire (5-step flow)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| RK-D6-00 | Progress strip (5 bars, fill-to-step) | DATA | NA | UNVERIFIED | |
| RK-D6-01 | Step header "Step N of 5 · D6 questionnaire" | DATA | NA | UNVERIFIED | A5 — "D6" is an internal code surfaced in copy; flag if jargon |
| RK-D6-Q1 | Question 1 — "Is your will up to date?" + 3 options (current/basic/none) | ACTION | answer selection | UNVERIFIED | A5 verify wording neutral |
| RK-D6-Q2 | Question 2 — "Do you have a Power of Attorney (LPA)?" + 4 options | ACTION | answer selection | UNVERIFIED | A5 — "LPA" defined in subtitle |
| RK-D6-Q3 | Question 3 — "Are pension and death-benefit nominations recorded?" + 3 options | ACTION | answer selection | UNVERIFIED | A5 — "nominations" defined inline |
| RK-D6-Q4 | Question 4 — "Is your life cover written in trust?" + 3 options | ACTION | answer selection | UNVERIFIED | A5 — "in trust" defined inline |
| RK-D6-Q5 | Question 5 — "Are guardians named for any dependants?" + 4 options | ACTION | answer selection | UNVERIFIED | A5 |
| RK-D6-NB | Back button (disabled on step 0) | ACTION | step − 1 | UNVERIFIED | |
| RK-D6-NN | Next button (steps 0–3) | ACTION | step + 1 | UNVERIFIED | disabled until picked |
| RK-D6-SB | Submit answers (step 4) | ACTION | fires `risk_questionnaire_committed` event via `onCommit`, closes sheet | UNVERIFIED | A2 verify event payload reaches engine — **NOTE: engine consumption deferred per code comment "follow-up engine work — out of scope here"** |
| RK-D6-CN | Cancel button | ACTION | closes sheet without commit | UNVERIFIED | |

### Region 9 — Z4 Protection Gap card (`<ProtectionGap />`)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| RK-Z4-00 | Card title "Protection Gap" | DATA | NA | UNVERIFIED | |
| RK-Z4-01 | Life cover row — have / need / bar / gap | DATA | SOURCE — protection-quote (s02a per code comment) | UNVERIFIED | `lifeCoverNeed = dependants>0 ? target*10 : target*5` — **this multiplier (10× / 5× income) is HARDCODED in ProtectionGap.jsx, not from engine module. A6 risk: should trace to rules-uk.js or engine.** |
| RK-Z4-01a | Suggested-cover sub-line "Suggested: 10× income" / "5× income" | DATA | NA | UNVERIFIED | A6 same hardcoded multiplier as above |
| RK-Z4-02 | Income protection row — have / need / bar / gap | DATA | SOURCE — IP quote | UNVERIFIED | `ipNeed = target*0.6` (60% of target income) — **also HARDCODED; A6 risk** |
| RK-Z4-02a | "Suggested: 60% of target income" sub-line | DATA | NA | UNVERIFIED | A6 |
| RK-Z4-03 | Combined-gap summary box — `fmt(lifeGap + ipGap)` + "Quotes pull in via the protection adapter at s02a" | DATA | ACTION — protection adapter | UNVERIFIED | **"s02a" is an internal route code surfaced in user copy — A5 FAIL likely. Also a "coming next" pointer that may not be wired.** |

### Region 10 — Z5 Shock Scenarios (`riskShockSuite`)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| RK-Z5-00 | Eyebrow "Stress Tests" + title "Shock Scenarios — recomputed by engine" + `AskChip RISK-AI-3 "What if?"` | DATA | NA | UNVERIFIED | A5 verify "Stress Tests" / "Shock Scenarios" both acceptable |
| RK-Z5-01..N | `ShockCard` rows — one per shock returned by `riskShockSuite(entity)` | ACTION | expand/collapse + Ask Sonu | UNVERIFIED | Engine drives the count; A1 must equal number of shocks in suite. **No fallback if empty other than "engine returned empty" string — verify in build.** |
| RK-Z5-0x | Each shock — label | DATA | NA | UNVERIFIED | A5 plain-English |
| RK-Z5-0y | Each shock — "Risk N → M (Δ) · Wealth N → M · NW ±fmt" line | DATA | SOURCE — engine recompute | UNVERIFIED | A6 — `shock.rsBefore / rsAfter / rsDelta / fqBefore / fqAfter / nwDelta`; `fmt()` applied to NW; **RECONCILE: rsBefore must equal current `risk.total` (RK-ANCH-01)** |
| RK-Z5-0z | Each shock — description body (on expand) | DATA | NA | UNVERIFIED | A5 |
| RK-Z5-0a | AskChip `RISK-AI-3` "What would I do?" inline on each card | ACTION | Ask Sonu w/ seeded question | UNVERIFIED | dispatches `sonus:ask` event; A2 verify listener |
| RK-Z5-EMPTY | Empty state "No shock results available — engine returned empty." | DATA | NA | UNVERIFIED | engineer-facing language — A5 likely FAIL |

### Region 11 — Z6 Confidence card

> Spec calls for a dedicated Z6 Confidence card. **In the build, confidence is rendered only as a `ConfBadge` chip on RK-ANCH-02 / RK-Z1-01 — there is no separate Z6 card.** Flag as missing element (A1) if spec is the conformance target.

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| RK-Z6-01 | Z6 Confidence card (spec §8.1) — semantic level + breakdown | DATA | SOURCE — confidence-level detail | UNVERIFIED | **NOT PRESENT in current build — only the chip in RK-ANCH-02 exists. UNLISTED element absence — orchestrator decides if A1 FAIL or out-of-scope.** |

### Region 12 — Z7 Life-event banner

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| RK-Z7-00 | Banner card (slide-in 400ms from top) — renders only when `lifeEventPaths(entity).length > 0` | DATA | NA | UNVERIFIED | |
| RK-Z7-01 | Title "Life event detected — review your risk profile" + `AskChip RISK-AI-6 "What should I review?"` | DATA + ACTION | Ask Sonu | UNVERIFIED | A5 |
| RK-Z7-02 | Body "N prompt(s) pending. Tap to re-answer affected dimensions." | DATA | ACTION — D6 questionnaire / dim re-answer | UNVERIFIED | **"Tap to re-answer" copy suggests interactivity but body has NO onClick — A2 likely FAIL (dead affordance)** |

### Region 13 — Z8 Score History card

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| RK-Z8-00 | Card title "Score History · always live" | DATA | NA | UNVERIFIED | A5 — "always live" is internal phrasing |
| RK-Z8-T1 | Range picker — 1mo | ACTION | re-renders chart at 1mo | UNVERIFIED | distinct from X28 (FD-RK-2) |
| RK-Z8-T2 | Range picker — 3mo (default) | ACTION | re-renders | UNVERIFIED | |
| RK-Z8-T3 | Range picker — 6mo | ACTION | re-renders | UNVERIFIED | |
| RK-Z8-T4 | Range picker — 12mo | ACTION | re-renders | UNVERIFIED | |
| RK-Z8-01 | SVG line chart — score series over range | DATA | SOURCE — daily score points | UNVERIFIED | `calcRiskHistory(entity, range).points`; `DrawSVG` re-draws on range change |
| RK-Z8-02 | End-point dot | DATA | NA | UNVERIFIED | colour = mint if delta ≥0 else danger |
| RK-Z8-03 | "Nmo ago: X" label | DATA | NA | UNVERIFIED | A6 must match series[0].score |
| RK-Z8-04 | "Today: Y" label | DATA | NA | UNVERIFIED | A6 must match series[last].score AND match RK-ANCH-01 |
| RK-Z8-05 | Delta label (+/−N) | DATA | NA | UNVERIFIED | A6 computed = end − start |

### Region 14 — Z9 Take Action top-3

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| RK-Z9-00 | Card title "Take Action — top 3 for Risk" + `AskChip RISK-AI-8 "Which to prioritise?"` | DATA + ACTION | Ask Sonu | UNVERIFIED | |
| RK-Z9-01 | Action row 1 — title + detail + `+impact.riskScore` chip | ACTION | SOURCE/ACTION — `risk:<dimension>` drill OR `sonus:action` event | UNVERIFIED | `onAct` first tries `onDrillMetric('risk:'+a.dimension)`, fallback to `sonus:action` event. **Verify listener wired in Dashboard.** Per FD-CROSS-1 must hand off to owning surface (My Money / Cashflow / T&E) for the action, not stay describe-only on Risk. |
| RK-Z9-02 | Action row 2 | ACTION | same as above | UNVERIFIED | |
| RK-Z9-03 | Action row 3 | ACTION | same as above | UNVERIFIED | |
| RK-Z9-EMPTY | Empty state — component returns `null` when no actions with `riskScore > 0` | NA | NA | UNVERIFIED | silent empty — verify never shows on prod personas |

### Region 15 — Z11 "What would help most" lens

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| RK-Z11-00 | Card title "What would help most" + `ExplainerChip RISK-1` | DATA | NA | UNVERIFIED | |
| RK-Z11-S1 | Shock picker chip — Job loss (default) | ACTION | re-runs `engineWhatHelpsMost(entity,'job_loss')` | UNVERIFIED | |
| RK-Z11-S2 | Shock picker chip — Illness | ACTION | `engineWhatHelpsMost(entity,'illness')` | UNVERIFIED | |
| RK-Z11-S3 | Shock picker chip — Market −30% | ACTION | `'market_fall'` | UNVERIFIED | A5 verify "Market −30%" plain English |
| RK-Z11-S4 | Shock picker chip — Rate +2% | ACTION | `'rate_rise'` | UNVERIFIED | A5 |
| RK-Z11-S5 | Shock picker chip — Death | ACTION | `'death'` | UNVERIFIED | A5 — single-word "Death" — verify tone-appropriate |
| RK-Z11-01 | Mitigations table — top 5 rows | DATA | SOURCE — mitigation detail | UNVERIFIED | from `engineWhatHelpsMost`; per row: action name, effort, ΔRisk |
| RK-Z11-01a | Each row — action name (underscores → spaces) | DATA | NA | UNVERIFIED | A5 — engine keys like `buy_income_protection` rendered with `replace(/_/g,' ')`; verify result reads as English |
| RK-Z11-01b | Each row — description sub-line | DATA | NA | UNVERIFIED | A5 |
| RK-Z11-01c | Each row — effort cell | DATA | NA | UNVERIFIED | A5 verify "effort" units are explained |
| RK-Z11-01d | Each row — ΔRisk cell `+N` | DATA | NA | UNVERIFIED | A6 |
| RK-Z11-EMPTY | "No improvements available for this shock." | DATA | NA | UNVERIFIED | A5 |
| RK-Z11-HD | Table headers — Action / Effort / Δ Risk (have `sw-press` + cursor:pointer but no onClick) | NA | NA | UNVERIFIED | **Headers are styled as clickable but do nothing — A2 FAIL (dead affordance)** |

### Region 16 — Z12 Protection Plan anchor

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| RK-Z12-A | Active-plan variant — title "Active Protection Plan" + "Last updated: X" body | DATA | NA | UNVERIFIED | renders when `planFor(entity,'protection')` returns truthy |
| RK-Z12-N | No-plan variant — title "Protection Plan" + body + button | DATA | NA | UNVERIFIED | pulse-glow card |
| RK-Z12-N1 | "Start a protection plan →" button | ACTION | DECISION — plan builder on Timeline tab | UNVERIFIED | Dispatches `sonus:navigate` event + sets `window.location.hash = '#tab=plan&planType=protection'`. **Per code comment: "Full builder ships in Phase 2" + footer "Opens the Timeline tab with a protection-plan seed" — verify the receiving listener exists; otherwise it's a dead handler.** |
| RK-Z12-N2 | Footer "Opens the Timeline tab with a protection-plan seed. Full builder ships in Phase 2." | DATA | NA | UNVERIFIED | A5 — explicit "coming next" copy is acceptable per founder rules |

### Region 17 — Z10 Universal Add Protection (`+` floating button + sheet)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| RK-Z10-FB | FloatingAddButton — fixed bottom-right `+` (60×60, pulse-glow) | ACTION | opens UniversalAdd sheet | UNVERIFIED | A2 |
| RK-Z10-00 | UniversalAdd sheet — title "Add to your safety net" | DATA | NA | UNVERIFIED | |
| RK-Z10-D3 | Section eyebrow "Protection coverage · D3" + subtitle | DATA | NA | UNVERIFIED | A5 — "D3" internal code in user copy — flag |
| RK-Z10-D3a | Tile — Life cover | ACTION | calls `onAddProtection('life')` then closes sheet | UNVERIFIED | **`onAddProtection` is a prop — `Risk.jsx` default-export does NOT pass it to `<RiskBody>`. A2 FAIL likely (dead handler unless overlay variant supplies it).** |
| RK-Z10-D3b | Tile — Income protection | ACTION | `'ip'` | UNVERIFIED | same as above |
| RK-Z10-D3c | Tile — Critical illness | ACTION | `'cic'` | UNVERIFIED | same |
| RK-Z10-D6 | Section eyebrow "Estate readiness · D6" + subtitle | DATA | NA | UNVERIFIED | A5 — "D6" code in user copy |
| RK-Z10-D6a | Tile — Will | ACTION | `'will'` | UNVERIFIED | A2 same `onAddProtection` issue |
| RK-Z10-D6b | Tile — Lasting power of attorney | ACTION | `'lpa'` | UNVERIFIED | |
| RK-Z10-D6c | Tile — Nominations | ACTION | `'noms'` | UNVERIFIED | |
| RK-Z10-FT | Footer "Document storage and policy capture ship in Phase 2 — picking now seeds a 'coming next' follow-up on the Timeline." | DATA | NA | UNVERIFIED | A5 — explicit "coming next" |
| RK-Z10-CN | Cancel button | ACTION | closes sheet | UNVERIFIED | |

### Region 18 — Disclaimer footer

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| RK-FOOT-01 | Footer — `BRAND.disclaimer` | DATA | NA | UNVERIFIED | A5 + FCA boundary — must be present every state |
| RK-FOOT-02 | Footer — `BRAND.rulesVersion · BRAND.dataDate` | DATA | NA | UNVERIFIED | A6 — values from `src/config/brand.js` |

### Region 19 — RiskOverlay chrome (overlay-only; not present on full page)

> These elements exist ONLY in `RiskOverlay.jsx`. The shared `RiskBody` (Regions 4–17) renders below this header in the overlay.

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| RK-OVL-01 | Sticky overlay header — close (×) button | ACTION | closes overlay (`onClose`) | UNVERIFIED | A2 — also Esc-to-close handler |
| RK-OVL-02 | Header eyebrow "Risk Score · point-in-time" | DATA | NA | UNVERIFIED | A5 — "point-in-time" is jargon, but matches FD-RK-2 architectural intent |
| RK-OVL-03 | Header big score — `<Num value={risk.total} format="score" animate />` + "/100" | DATA | NA | UNVERIFIED | **A6 — must equal RK-ANCH-01 (full page) AND H-ANCH-03 (Home).** |
| RK-OVL-04 | Header inline Wealth sub-anchor — "· Wealth NN" | DATA | NA | UNVERIFIED | A6 — must equal RK-ANCH-05 / H-ANCH-02 |
| RK-OVL-05 | Header band name (under score) | DATA | NA | UNVERIFIED | A5 |
| RK-OVL-06 | Overlay-internal X22 breadcrumb "← {originLabel}" | NAV | closes overlay | UNVERIFIED | second close affordance besides RK-OVL-01 |
| RK-OVL-07 | Overlay disclaimer footer (inline, separate from full-page footer) | DATA | NA | UNVERIFIED | duplicates RK-FOOT-01/02 in overlay |
| RK-OVL-08 | Z1 ring is NOT suppressed in overlay (no `suppressPrimaryRing` flag) — so RK-Z1-01 renders in addition to header score | DATA | NA | UNVERIFIED | **Potential duplication — the overlay shows the score in the sticky header AND again in RK-Z1-01 ring card just below. A6/A1 — possible double-render of identical value.** |

### Region 20 — Orphan components (declared on disk, not imported by Risk.jsx or RiskOverlay.jsx)

> These files exist in `src/components/Risk/` but are not reached from the Risk surface. They are recorded here so the auditor can confirm dead code OR find an unwired surface that should be present.

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| RK-ORPH-01 | `CrossMap.jsx` (101 lines) | NA | unreachable | UNVERIFIED | Likely superseded by `CrossMap5x5` (shared). Confirm via Grep — if no other importer, dead code candidate. |
| RK-ORPH-02 | `DimensionRadar.jsx` (112 lines) | NA | unreachable | UNVERIFIED | Possibly superseded by inline `RadarHeptaView` in Risk.jsx. Dead code candidate. |
| RK-ORPH-03 | `ScoreHistoryChart.jsx` (104 lines) | NA | unreachable | UNVERIFIED | Possibly superseded by inline `RiskHistory` in Risk.jsx. Dead code candidate. |
| RK-ORPH-04 | `ShockScenarios.jsx` (104 lines) | NA | unreachable | UNVERIFIED | Possibly superseded by inline `ShockCard` + `riskShockSuite` map in Risk.jsx. Dead code candidate. |

---

## SEED FINDINGS (pre-identified — agents start with these, then extend)

These are *already known* from reading Risk.jsx + RiskOverlay.jsx + ProtectionGap.jsx end-to-end. They are not the list — they are the proof the method works. Agents must confirm each, assign severity, and find the rest.

| Seed | Element(s) | Issue | Likely severity |
|------|-----------|-------|-----------------|
| S-01 | RK-ANCH-05 | Secondary tile labelled **"Health score"** for the Wealth Score value. Everywhere else (Home, My Money, RK-OVL-04 "Wealth NN", `calcFQ`) it's "Wealth Score". Same metric, two names on one screen. | FUNCTIONAL (A5/A6) |
| S-02 | RK-ANCH-01c | Eyebrow says **"Safety score · primary"** but the ring centre says "Risk Score" and the band names use "vulnerable/cautious/managed/protected/resilient" (resilience framing). Three different framings of the same number above the same ring. | FUNCTIONAL (A5) |
| S-03 | RK-Z4-01 / RK-Z4-02 | Protection-need multipliers (10×/5× income for life cover; 60% for IP) are **HARDCODED in `ProtectionGap.jsx`** — not from `rules-uk.js` or the engine module. Per CLAUDE.md `feedback_always_check_rules_uk` this is a violation. | FUNCTIONAL (A6) |
| S-04 | RK-Z4-03 | User-facing summary string contains **"s02a"** — internal route code surfaced in copy ("Quotes pull in via the protection adapter at s02a"). | FUNCTIONAL (A5) |
| S-05 | RK-Z10-D3 / RK-Z10-D6 | UniversalAdd sheet eyebrows surface internal dimension codes **"D3"** and **"D6"** in user copy. Same pattern as RK-D6-01 "D6 questionnaire" step header. | FUNCTIONAL (A5) |
| S-06 | RK-Z10-D3a..c / RK-Z10-D6a..c | `onAddProtection` prop is consumed by `<RiskBody>` but the default-export `Risk` component **does not pass it through** — verify Dashboard supplies it. If not, all 6 Add-Protection tiles dispatch to `undefined`. | DEMO-BLOCKING (A2) if unwired |
| S-07 | RK-Z11-HD | Z11 table headers have `sw-press` class and `cursor:pointer` but **no `onClick` handler** — they're styled as sortable but do nothing. Dead affordance. | FUNCTIONAL (A2) |
| S-08 | RK-Z7-02 | Life-event banner body says "Tap to re-answer affected dimensions" but the banner has **no onClick** — copy implies interactivity that doesn't exist. | FUNCTIONAL (A2) |
| S-09 | RK-OVL-08 | RiskOverlay does NOT pass `suppressPrimaryRing` to `<RiskBody>`, so the **score renders twice** in the overlay: once in the sticky header (RK-OVL-03) and once in the Z1 ring card (RK-Z1-01) just below. Visual duplication. | POLISH→FUNCTIONAL |
| S-10 | RK-Z6-01 | Spec calls for a dedicated **Z6 Confidence card**; build only renders a `ConfBadge` chip on the anchor. Missing element if the spec is the conformance target. | FUNCTIONAL (A1) |
| S-11 | RK-ANCH-01 ↔ Home H-ANCH-03 ↔ RK-OVL-03 | **RECONCILE: Home.** Overall Risk Score must match across all three. Auditor must verify same value AND same `fmt()` format (e.g. "78" vs "78/100" vs "78%"). | DEMO-BLOCKING (A6) |
| S-12 | RK-ANCH-05 ↔ Home H-ANCH-02 ↔ RK-CHR-09 ↔ RK-OVL-04 | **RECONCILE: Home.** Wealth Score must match across topbar, anchor, overlay header, Home. | DEMO-BLOCKING (A6) |
| S-13 | RK-ANCH-06 ↔ Home H-ANCH-01 | **RECONCILE: Home.** Net Worth must match in value AND `fmt()` format (the Home audit already flagged £3.63m vs £3.63M conflict — verify Risk doesn't reproduce). | DEMO-BLOCKING (A6) |
| S-14 | RK-ORPH-01..04 | 4 components on disk (`CrossMap.jsx`, `DimensionRadar.jsx`, `ScoreHistoryChart.jsx`, `ShockScenarios.jsx`) are not imported anywhere reachable from Risk. Either dead code (~420 lines) or unwired feature. | POLISH (cleanup) |
| S-15 | global | Brand string drift sweep — verify no `Caelixa` / `Finio` / `FQ Score` strings render anywhere on Risk or RiskOverlay (per FD-NAME-1). | FUNCTIONAL (A5) |
| S-16 | RK-Z5-EMPTY | Empty state copy "No shock results available — engine returned empty." is engineer-facing; user should never see "engine" in copy. | POLISH (A5) |
| S-17 | RK-Z12-N1 | "Start a protection plan →" button dispatches `sonus:navigate` event + sets `window.location.hash` to `#tab=plan&planType=protection` — but there is **no "plan" tab in Sonuswealth nav** (plans live on Timeline). Verify the receiving listener actually routes to Timeline. Same pattern as Home seed S-08 ("Plan tab" referenced in copy without nav existing). | FUNCTIONAL (A2/A4) |
| S-18 | RK-OVL-01 + RK-OVL-06 | Overlay has **two close affordances** in close proximity: the sticky-header × button AND an in-body "← {originLabel}" breadcrumb just below it. Redundant; possibly intentional but worth verifying intent. | POLISH |
| S-19 | RK-CHR-12 | Verify no X28 top-bar / FY / RY / TY12 selector renders on Risk (FD-RK-2). If it does → DEMO-BLOCKING. | DEMO-BLOCKING (if present) |
| S-20 | RK-Z3-07 | Behavioural Track (D7) renders "Building track record — needs 90 days" when score=0. Verify this special-case actually fires (CRIT 1.3 fix) and isn't bypassed by non-zero hardcoded score from engine. | FUNCTIONAL (A2) |

---

## COVERAGE MATH (this replaces "99% confident")

Total inventory rows: **~135** counting sub-rows (Region 1: 12 · Region 2: 5 · Region 3: 6 · Region 4: 1 · Region 5: 4 + 25 sub-cells · Region 6: 17 · Region 7: 10 · Region 8: 13 · Region 9: 8 · Region 10: 8 · Region 11: nominal Z6 placeholder · Region 12: 3 · Region 13: 9 · Region 14: 5 · Region 15: 12 · Region 16: 4 · Region 17: 12 · Region 18: 2 · Region 19: 8 · Region 20: 4). Auditor will produce exact count at audit time.

```
Coverage  = (rows with verdict ≠ UNVERIFIED) / (total rows)
Pass rate = (rows PASS) / (rows PASS + rows FAIL)
```

A pass is **complete** only when Coverage = 100% (every row has a verdict).
The audit **terminates** per the runbook stopping rule — not at a round number.
"99% confident" is only a legitimate claim when Coverage = 100% and it is restated as:
*"X of Y rows verified PASS; Z FAIL, all POLISH-severity and backlogged."*

---

*— end risk-screen-element-inventory-v1.md —*
