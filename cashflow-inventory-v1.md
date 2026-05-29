# Cashflow Screen — Element Inventory v1

**Screen:** Sonuswealth Cashflow (build target: React in `src/screens/Cashflow.jsx`)
**Design baseline:** none on disk — Stitch HTML for Cashflow not in scope. Walked component as structural truth.
**Reconciliation baseline:** engine — `src/engine/fq-calculator.js` (+ `src/engine/timeline-engine.js`); CMA bundle `src/rules/cma-2026.json`.
**Intent reference (NOT a conformance target):** `2-Product/2-Product-cashflow-v1_7.md` — single-scroll §A NOW → §B TRAJECTORY → §C DEPTH; use only for engine fn names, plain-English standard, FCA framing.
**Date:** 17 May 2026

---

## Why this file exists

This is the **fixed target** the whole Cashflow audit measures against. Every interactive or
data-bearing element on Cashflow is one numbered row. The audit does not "find mistakes" —
it walks this list and records a verdict per row. That is the only thing that makes
"99% confident" a real statement: it means *N of M rows verified PASS*, not a feeling.

**This file is the worksheet.** Auditor agents fill the `Verdict` columns. Do not add
or remove rows except via the "inventory drift" rule in the runbook. If the build
contains an element not listed here, that is itself a finding (`UNLISTED`).

---

## The six assertions (every row is tested against all six)

| # | Assertion | Fails when… |
|---|-----------|-------------|
| A1 | **Identified** — element exists in the build and matches this row | Element missing from build, or build has an element not in this inventory |
| A2 | **Drillable** — if it is a number, action, or nav element, interacting with it does something | Tapping is dead / no handler / no visible response |
| A3 | **Destination correct** — it resolves to the surface that **owns its subject** | A pension drawdown action lands on T&E; a tax-band number lands on Risk; etc. |
| A4 | **Destination coherent** — the landing is a usable continuation: it shows the SOURCE, an ACTION, or a DECISION | Lands on a generic modal, a dead-end, a screen top with no context, or an unrelated view |
| A5 | **Plain English** — label + any explainer readable by a non-expert in one pass; jargon translated; information-not-advice (FCA) | Unexplained jargon ("PRC/PCC spread", "PoS", "Guyton-Klinger", "Reality Engine") with no plain explainer; advice-phrased copy |
| A6 | **Reconciled** — every number traces to an engine function and matches value + format everywhere it appears | Hardcoded number; `fmt()` not used; same metric shows two values/formats; default mocks rendered as real engine output |

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
| FD-NAME-1 | **Product name is `Sonuswealth` (D-NAME-2, locked 9 May 2026 — supersedes Sonuswealth and Finio).** Source of truth: `src/config/brand.js` (`BRAND.name`). Casing: logo / wordmark = `sonuswealth` (lowercase, see `BRAND.nameDisplay`); body text, titles, aria-labels, page `<title>`, score strings = `Sonuswealth` (sentence case). Every `Sonuswealth` or `Finio` in user-facing strings = FUNCTIONAL FAIL (A5/A6). Engine-module disclaimers + comments are queued for Wave 4 Morph sweep. |
| FD-CROSS-1 | **Every critical action is a surface-instance, not a pointer.** Each surface presents the *angle it owns* with its own layout and its own data evidence; cross-surface links are explicit. On Cashflow, the screen owns **£/month effect** — monthly inflow change, tax-band ordering, sequence risk on cash, surplus allocation. A pension-drawdown affordance surfaced here owns the *cash-impact view* of drawdown; the canonical "doing" surface for actually starting drawdown is My Money. The drill-rule (A3) is satisfied when each Cashflow instance drills to *its own* cash-effect detail, not to T&E's IHT consequence or Risk's volatility consequence. |
| FD-LOGO-1 | Brand assets live at `G:\My Drive\All Work\6.Finio\1-Clusters\Codex UI\deliverables\sonuswealth-site\assets\{favicons,logo,mascot,videos}`. Conformance-auditor checks that every surface uses the right logo variant per theme (light/dark) and flags the faded-purple dark variant as DEMO-BLOCKING wherever it appears below WCAG AA contrast. (Cashflow has no logo render — confirm absence is intentional.) |
| FD-MASCOT-1 | Mascot is **Sonnu (owl)**, 6 life-stage forms. Placement on screens is **Wave 7 enhancement scope**, not in-audit; audit treats absence of Sonnu as not-a-finding. |
| FD-CF-1 | **Funded-ratio label bug (commit `533a8c0`) was fixed.** The `ConfidenceIntervalSummary` row for "Funded ratio" was previously rendering `fr.confidence` ("HIGH") — which is calculation certainty, not the ratio status — making a 0.32 ratio appear as "HIGH" (i.e. healthy). Code now derives a status label (`Over-funded` / `On track` / `Approaching target` / `Under-funded`) from `fr.ratio` directly (`Cashflow.jsx` §C.8, lines 2655–2700). Stage B verifies the fix held across personas and that no other surface still reads `fr.confidence` as a status. |

---

## ELEMENT TABLE

> `Owns-subject destination` is the **expected** A3/A4 target — the auditor checks the
> build against this. Where it reads "dedicated panel," a coherent in-context drill
> (overlay or sub-screen) is acceptable; a bare tab-jump is not.

### Region 1 — Header / chrome

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| CF-CHR-01 | Back-to-Home button (`← Home`) | NAV | Home screen | UNVERIFIED | wires `onHome` |
| CF-CHR-02 | Screen title — "Cashflow" | DATA | NA (display) | UNVERIFIED | A5 — must read "Cashflow" not jargon |
| CF-CHR-03 | Simple / P&L view toggle chip | ACTION | toggle `accountantMode` state | UNVERIFIED | tooltip says "Toggle simple / accountant view" but visible label flips between "P&L view" / "Simple view"; auditor checks label↔state honesty |
| CF-CHR-04 | Disclaimer footer (`BRAND.disclaimer` + rulesVersion + UK-CMA-2026.1 + dataDate) | DATA | NA | UNVERIFIED | A5 — FCA boundary line must be present every state |

### Region 2 — Triple anchor + sub-anchor

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| CF-ANCH-01 | Net Worth tile ("You own") | ANCHOR | SOURCE — My Money asset breakdown (via `onDrillMetric('netWorth')`) | UNVERIFIED | calls `onDrillMetric` — verify routing target |
| CF-ANCH-02 | Wealth Score tile ("Health score") | ANCHOR | SOURCE — score breakdown (via `onDrillMetric('wealthScore')`) | UNVERIFIED | `calcFQ(entity)`; must equal the same value shown on Home + topbar |
| CF-ANCH-03 | Risk Score tile ("Safety score") | ANCHOR | SOURCE — Risk screen (via `onOpenRisk`) | UNVERIFIED | `calcRisk(entity)` |
| CF-SUB-01 | Sub-anchor card — "Capital Efficiency · PRC – PCC spread" | DATA | SOURCE — PRC/PCC methodology detail | UNVERIFIED | renders "Coming next · methodology pending O-CF-RULES-07" when stub; A5 — verify a non-expert understands "PRC – PCC" |

### Region 3 — Purpose statement (§3A)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| CF-PURP-01 | Headline question — "Will your money last — and is what's coming in actually enough?" | DATA | NA (display) | UNVERIFIED | A5 |
| CF-PURP-02 | Subline — "See your income, expenses, and what the years ahead look like. In 35 seconds." | DATA | NA | UNVERIFIED | A5 — 35 seconds is a promise; conformance should verify it's at least roughly true |

### Region 4 — Cashflow Health Hero (§3B)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| CF-HERO-01 | Hero card eyebrow — "Cashflow Health Score" | DATA | NA | UNVERIFIED | |
| CF-HERO-02 | Hero score number (`health.total`) | DATA | SOURCE — health breakdown drill | UNVERIFIED | `cashflowHealth(entity, CMA_BUNDLE)`; animated via `<Num animate>` |
| CF-HERO-03 | Hero band chip (Critical / Stressed / Steady / Healthy / Thriving) | DATA | SOURCE — band thresholds | UNVERIFIED | `health.band`; colour token must match band |
| CF-HERO-04 | "Detail ›" chip (top-right) | ACTION | SOURCE — `HealthScoreDrillPanel` (see Region 11) | UNVERIFIED | wires `setDrillView('health')` |
| CF-HERO-05 | Surplus-contradiction inline note ("band reads Healthy but monthly surplus is £0") | DATA | NA — narrative caveat | UNVERIFIED | only renders when `health.band ∈ {Healthy, Thriving}` AND `surplusAnn ≤ 0`; A5 / A6 trust signal |
| CF-HERO-06 | Component row — Bill coverage (`liquidityBuffer`) | DATA | SOURCE — bill coverage detail | UNVERIFIED | sub-bar fills 0→score; engine 0–100 |
| CF-HERO-07 | Component row — Surplus ratio (`surplus`) | DATA | SOURCE — surplus breakdown drill | UNVERIFIED | |
| CF-HERO-08 | Component row — Income resilience (UI-derived) | DATA | SOURCE — income resilience explainer | UNVERIFIED | NOT engine-native; computed UI-side from `(annInc − essAnn) / annInc` — flag as proxy |
| CF-HERO-09 | Component row — Funded ratio (UI-derived from `fr.ratio`) | DATA | SOURCE — funded-ratio gauge (see CF-FUND-01) | UNVERIFIED | proxy score = `clamp(fr.ratio × 100, 0, 100)` |
| CF-HERO-10 | Component row — Debt service ratio (UI-derived from `ms.debt_service_annual / annInc`) | DATA | SOURCE — debt service detail | UNVERIFIED | proxy formula; verify scale honesty |

### Region 5 — X28 top bar

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| CF-X28-01 | Time-window selector (current button + dropdown of 8 windows) | ACTION | state = `windowId` | UNVERIFIED | initial state in Cashflow = `'current-tax-year'` BUT X28TopBar's `TIME_WINDOWS` ids are `'current-period'…'lifetime'` — id mismatch → topbar always falls back to a default; flag as A2/A6 |
| CF-X28-02 | View-mode pills — Today / Future / Plan / What if | ACTION | state = `viewMode`; re-keys section container to re-trigger reveal | UNVERIFIED | switching mode must change rendered figures, not just label |
| CF-X28-03 | "Now" pill (rules version + data date) | DATA / ACTION | SOURCE — rules version detail | UNVERIFIED | optional `onNowTap`; not wired here |
| CF-X28-04 | Mode auto-switch on window pick (5y→forecast, 10y/20y/lifetime→plan) | BEHAVIOUR | implicit state change | UNVERIFIED | verify by picking each window and observing mode pill |

### Region 6 — Scenario seed banner (conditional)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| CF-SEED-01 | Seed banner — "Modeling · {label}" | DATA | NA — visible affordance only | UNVERIFIED | only renders when `viewMode==='scenario'` AND `activeSeed` set; verify the trigger path (TappableNumber bus → `scenarioSeed` prop) actually surfaces it |
| CF-SEED-02 | Seed banner "current → proposed" deltas | DATA | NA | UNVERIFIED | A6 — both numbers must come from the seed object, not be invented |
| CF-SEED-03 | Seed banner "Clear" dismiss button | ACTION | clears `activeSeed` state | UNVERIFIED | |

### Region 7 — Section A · NOW (this month, this year)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| CF-DELIM-A | Section delimiter — letter "A" + title "NOW · This month, this year" | DATA | NA | UNVERIFIED | sticky on scroll |
| CF-WAT-01 | Cashflow waterfall card eyebrow ("Cashflow waterfall · Money in → out → what's left") | DATA | NA | UNVERIFIED | from `CashflowWaterfallV2` |
| CF-WAT-02 | Waterfall hero "Surplus" + value | DATA | SOURCE — surplus drill (see CF-WAT-08) | UNVERIFIED | A6 — must equal `gross − tax − pension − essentials − debt` |
| CF-WAT-03 | Waterfall step — Gross income | DATA | SOURCE — income breakdown (CF-INC-*) | UNVERIFIED | `incomeAll.gross_annual` |
| CF-WAT-04 | Waterfall step — Tax & NI | DATA | SOURCE — Tax & Estate tax breakdown | UNVERIFIED | A3 — Cashflow owns the £/mo *cash-effect*; the tax detail itself owns to T&E |
| CF-WAT-05 | Waterfall step — Pension contribution | DATA | SOURCE — My Money pension card | UNVERIFIED | derives from `entity.assets.sipp.contribMonthly` / `entity.pensionContribMonthly`; zero is honest |
| CF-WAT-06 | Waterfall step — Essentials | DATA | SOURCE — essentials breakdown | UNVERIFIED | `ms.essentials_annual` |
| CF-WAT-07 | Waterfall step — Debt service | DATA | SOURCE — My Money debt card | UNVERIFIED | `ms.debt_service_annual` |
| CF-WAT-08 | "Breakdown ›" chip (top-right of waterfall) | ACTION | SOURCE — `SurplusDrillPanel` | UNVERIFIED | wires `setDrillView('surplus')` |
| CF-WAT-09 | Waterfall empty state ("No income data… add a salary…") | DATA | NA / ACTION? | UNVERIFIED | A4 — copy mentions "+ Income" affordance; verify it exists or remove the implied CTA |
| CF-ED-01 | Essentials vs Discretionary hero % | DATA | SOURCE — essentials breakdown | UNVERIFIED | `ms.essential / ms.income`; cohort median **HARDCODED `58`** — seed finding |
| CF-ED-02 | Essentials vs Discretionary bar | DATA | NA (echo) | UNVERIFIED | |
| CF-ED-03 | Essentials implication line | DATA | NA | UNVERIFIED | A5 |
| CF-BILL-01 | Bill calendar card | DATA | SOURCE — bill detail | UNVERIFIED | empty-state honest when `entity.bills` empty |
| CF-BILL-02 | Bill calendar 28-day grid cells (×28) | DATA | NA | UNVERIFIED | due-day cells pulse-glow |
| CF-SUB-01b | Subscription tracker card | DATA | SOURCE — subscription detail | UNVERIFIED | chip "Manual add · Phase 1.2" when empty |
| CF-SUB-02 | "+ Add manually (coming next)" CTA | ACTION | ACTION — manual subscription entry | UNVERIFIED | currently only `console.info` — dead in product sense; honest label but A2 risk |
| CF-ALLOC-01 | Surplus allocator card header + monthly chip | DATA | NA | UNVERIFIED | renders Deficit explainer card if `surplus ≤ 0` |
| CF-ALLOC-02 | Allocator priority rows (per allocation returned by `recommendedSurplusAllocation`) | DATA | NA | UNVERIFIED | renders 0..N rows; each row has priority badge + label + reason + amount |
| CF-ALLOC-03 | Per-row "Set up" CTA | ACTION | ACTION — set up standing order for that priority | UNVERIFIED | currently `console.info` only; A2/A4 risk |
| CF-LB-01 | Liquidity Buffer hero (months × emoji band) | DATA | SOURCE — liquidity detail | UNVERIFIED | `liquidityBuffer(entity)` |
| CF-LB-02 | Liquidity Buffer band chip (Critical / Building / Covered) | DATA | NA | UNVERIFIED | A5 — explainer text on band thresholds |
| CF-LB-03 | Liquidity Buffer cash + monthly-essentials line | DATA | SOURCE — accessible-cash detail | UNVERIFIED | |
| CF-LB-04 | Liquidity Buffer progress bar (months / 6) | DATA | NA (echo) | UNVERIFIED | |
| CF-INC-01 | Income by source card eyebrow ("Income by source · Domain O") | DATA | NA | UNVERIFIED | A5 — "Domain O" jargon must be either explained or replaced |
| CF-INC-02 | Income-by-source rows (salary / dividends / rental / drawdown / interest / pension / selfemp / other) | DATA | SOURCE — per-source detail | UNVERIFIED | row per non-zero bucket; %  + absolute |
| CF-INC-03 | "Breakdown ›" chip on Income card | ACTION | SOURCE — `IncomeBreakdownDrillPanel` | UNVERIFIED | wires `setDrillView('income')` |
| CF-INC-04 | Income by tax band card eyebrow ("Income by tax band · UK ordering") | DATA | NA | UNVERIFIED | |
| CF-INC-05 | Tax-band rows (non_savings / savings / dividends / cgt) | DATA | SOURCE — Tax & Estate band detail | UNVERIFIED | only non-zero bands render; A3 — band detail itself owns to T&E |

### Region 8 — Section B · TRAJECTORY (this year to retirement)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| CF-DELIM-B | Section delimiter — letter "B" + title "TRAJECTORY · This year to retirement" | DATA | NA | UNVERIFIED | sticky |
| CF-GS-01 | Goal-Seek card eyebrow + "X24 mode 3" chip | DATA | NA | UNVERIFIED | A5 — "X24 mode 3" is internal jargon at the top layer (violates macOS principle) |
| CF-GS-02 | Goal-Seek slider (50 → 100, step 5) | ACTION | sets `target` local state | UNVERIFIED | |
| CF-GS-03 | Goal-Seek "Find paths" button | ACTION | DECISION — runs `goalSeek(entity, 'wealthScore', target, ...)` | UNVERIFIED | disabled until slider moved (dirty); button label flips Solving… / Up to date / Find paths |
| CF-GS-04 | Goal-Seek paths list (top 3) | DATA | DECISION — committed scenario | UNVERIFIED | each row: action.kind humanised + amount + gap |
| CF-GS-05 | Goal-Seek empty state ("No solver paths returned for this target.") | DATA | NA | UNVERIFIED | |
| CF-SWR-01 | SWR regime card header — "Withdrawal regime" | DATA | NA | UNVERIFIED | chip shows "Coming next" for stub regimes, `swr.source` otherwise |
| CF-SWR-02 | SWR regime pills (×6: Bengen, Guyton-Klinger, Morningstar, Vanguard, PRC-anchored, Custom) | ACTION | sets `swrRegime` state | UNVERIFIED | PRC-anchored + Custom are stub — engine returns Bengen fallback; verify honest copy when picked |
| CF-SWR-03 | SWR selected-rate / stub explainer line | DATA | SOURCE — methodology explainer | UNVERIFIED | A5 |
| CF-FUND-01 | Funded ratio gauge — half-arc SVG (`FundedRatioGaugeV2`) | DATA | SOURCE — funded-ratio components | UNVERIFIED | `fr.ratio` rendered as `r.toFixed(2)` in centre |
| CF-FUND-02 | Funded ratio status badge (Under-funded / Approaching target / On track / Over-funded) | DATA | NA | UNVERIFIED | **derived from ratio, NOT confidence — FD-CF-1 fix verifies this**; Stage B confirms 0.32 reads "Under-funded" not "HIGH" |
| CF-FUND-03 | Funded ratio confidence-band overlay arc + caption ("Confidence band: 0.85 – 1.18 (10–90 percentile)") | DATA | SOURCE — confidence methodology | UNVERIFIED | renders only when `fr.confidence_low/high` provided; A5 — "10–90 percentile" needs plain-English explainer |
| CF-FUND-04 | Funded ratio "Plan funds X years of target spending" context line | DATA | NA | UNVERIFIED | optional; from `fundedYears` prop (current call site doesn't pass it — verify it's intentional) |
| CF-FI-01 | FI Progress tile hero % | DATA | SOURCE — FI target detail | UNVERIFIED | `fi.ratio × 100`; "25× target rule" chip |
| CF-FI-02 | FI Progress sub-line ("{multiple}× current target · target {fmt(fiTarget)}") | DATA | NA | UNVERIFIED | |
| CF-FI-03 | FI Progress bar | DATA | NA (echo) | UNVERIFIED | |
| CF-POS-01 | PoS headline hero % | DATA | SOURCE — PoS methodology + paths | UNVERIFIED | `cf_probabilityOfSuccess` — 1000 MC runs |
| CF-POS-02 | PoS sub-line ("X of N paths sustain target income · Yy horizon") | DATA | NA | UNVERIFIED | |
| CF-POS-03 | PoS terminal-value summary (Median / P10 / P90) | DATA | SOURCE — MC distribution | UNVERIFIED | |
| CF-POS-04 | PoS stub-note ("monte-carlo.js v1.1 not yet present; current PoS uses single-Z Box-Muller — flagged stub") | DATA | NA | UNVERIFIED | A6 / A5 — honest stub disclosure; verify still accurate after engine work |
| CF-POSC-01 | PoS chart — eyebrow + hero % + "Plan survives" caption (`PoSChartV2`) | DATA | NA | UNVERIFIED | |
| CF-POSC-02 | PoS chart 10–90 percentile band + median path SVG | DATA | NA | UNVERIFIED | **A6 risk** — when `median`/`bands` props null, component falls back to **synthetic mock series** (`Array.from({length:12}, ...)`); verify the call site is wired with real engine output or the chart is HIDDEN, not silently mock |
| CF-POSC-03 | PoS chart "now" marker + year labels | DATA | NA | UNVERIFIED | |
| CF-POSC-04 | PoS chart guardrail annotation (gold dot + label) | DATA | SOURCE — guardrail rule | UNVERIFIED | only renders if `guardrail` prop set |
| CF-POSC-05 | PoS chart legend (Median path / 10–90 percentile) | DATA | NA | UNVERIFIED | |
| CF-SEQ-01 | Sequence-stress card — eyebrow + intro (`SequenceStressVisV2`) | DATA | NA | UNVERIFIED | A5 — "Same average return — different order" plain-English good |
| CF-SEQ-02 | Sequence-stress outcome-delta hero ("−£XXX") | DATA | SOURCE — sequence methodology | UNVERIFIED | computed from `goodEnd − badEnd` |
| CF-SEQ-03 | Sequence-stress good-sequence row (label + SVG path + end value) | DATA | NA | UNVERIFIED | **A6 risk** — fallback synthetic series `1_000_000 × 1.045^i` when `goodSequence` null; verify real data wired |
| CF-SEQ-04 | Sequence-stress bad-sequence row (label + SVG path + end value) | DATA | NA | UNVERIFIED | same mock-fallback risk |
| CF-GK-01 | Guyton-Klinger corridor card header + "±20% triggers" chip | DATA | NA | UNVERIFIED | A5 — "Guyton-Klinger" jargon at top layer |
| CF-GK-02 | GK corridor SVG (median path + ±20% envelope) | DATA | NA | UNVERIFIED | from `guytonKlingerPath(entity, 30, CMA_BUNDLE)` |
| CF-GK-03 | GK rule markers (prosperity dots + preservation dots) | DATA | SOURCE — GK rules explainer | UNVERIFIED | |
| CF-GK-04 | GK summary line ("Expected over Xy: N raises · M cuts.") | DATA | NA | UNVERIFIED | |
| CF-SCEN-01 | Scenario matrix card header — "Cashflow scenarios" (`ScenarioMatrixV2`) | DATA | NA | UNVERIFIED | |
| CF-SCEN-02 | Scenario row buttons (×N from `fiveScen.scenarios` or 5 mock defaults) | ACTION | DECISION — sets `activeId`, renders `ScenarioForwardSummary` | UNVERIFIED | **A6 risk** — when `scenarios` prop empty/null, component falls back to 5 **hardcoded mock scenarios** (do-nothing / optimal / guardrail / cautious / ambitious with hardcoded drawdownAnnual + pos + spark); demo-blocking if shown as real |
| CF-SCEN-03 | Scenario row sparkline + PoS % + drawdown/yr | DATA | NA | UNVERIFIED | |
| CF-SCEN-04 | Forward cashflow summary card (renders when scenario selected) | DATA | DECISION — committed scenario | UNVERIFIED | `ScenarioForwardSummary`; shows Annual draw / Horizon / Median terminal / Active id |
| CF-SCEN-05 | Forward summary "Median terminal" tile — value or "— stub" | DATA | NA | UNVERIFIED | honest stub when engine doesn't return terminal |
| CF-SCEN-06 | Forward summary disclaimer ("Per-scenario forward-cashflow table arrives when engine surfaces…") | DATA | NA | UNVERIFIED | A5 — honest |

### Region 9 — Section C · DEPTH (analytical layer)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| CF-DELIM-C | Section delimiter — letter "C" + title "DEPTH · Analytical layer" | DATA | NA | UNVERIFIED | sticky |
| CF-COI-01 | CoI odometer hero (`CoIOdometerWithHalo`) | DATA | SOURCE — Tax & Estate CoI breakdown | UNVERIFIED | reads `coi.byDomain.estatePlanning || coi.total`; A3 — **canonical CoI lives on T&E** (per Home FD), Cashflow shows the cash-effect angle; verify it equals the Home/T&E figure |
| CF-COI-02 | CoI odometer cascade-halo trigger on value change | BEHAVIOUR | NA | UNVERIFIED | `useCascadeTrigger` |
| CF-COI-03 | CoI byAction rows (from `coi.byDomain`) | DATA | SOURCE — per-domain CoI | UNVERIFIED | rendered via `CoIOdometer` internals |
| CF-COIV-01 | CF CoI variants card — "3+1" chip + 4 rows | DATA | SOURCE — variant methodology | UNVERIFIED | rows: Withdrawal sequence / Wrapper sequencing / Pension opportunity / Director / allowance |
| CF-COIV-02 | CoI variants — NPV disclosure ("NPV discount rate per O-CF-RULES-12 (pending founder sign-off)") | DATA | NA | UNVERIFIED | A5 — internal code at top layer (macOS principle violation) |
| CF-PRC-01 | PRC/PCC stub card (featured, pulse-glow) | DATA | SOURCE — PRC/PCC methodology | UNVERIFIED | renders "Coming next" when stub; "Founder concept" chip; A5 — "PRC / PCC Spread" needs plain-English explainer |
| CF-RE-01 | Reality Engine stub card (featured, pulse-glow) | DATA | SOURCE — Reality Engine methodology | UNVERIFIED | renders "Coming next" when `reality.status === 'stub'`; A5 — "Reality Engine" name doesn't tell user what it is |
| CF-RE-02 | Reality Engine factor bar (personal / system / external) — non-stub state | DATA | NA | UNVERIFIED | only when engine returns layers |
| CF-RE-03 | Reality Engine "Stub at v1.0 — factor weights pending O-CF-RULES-09" caveat | DATA | NA | UNVERIFIED | A5 — internal code at top layer |
| CF-MDD-01 | Max drawdown card hero severity chip + 4-tile grid | DATA | SOURCE — drawdown tolerance detail | UNVERIFIED | tiles: Implied MDD / Stated tolerance / Mismatch / 60/40 reference |
| CF-MDD-02 | Max drawdown insufficient-data fallback | DATA | NA | UNVERIFIED | honest empty |
| CF-EFF-01 | Efficient frontier card (`EfficientFrontierV2`) — eyebrow + "Gap to frontier · +X.X% / yr" | DATA | SOURCE — frontier methodology | UNVERIFIED | A6 risk — when `frontierPoints`/`userPosition` null, component falls back to **synthetic logarithmic frontier curve** (mock); demo-blocking if shown without disclosure |
| CF-EFF-02 | Frontier SVG (user dot + 60/40 reference dot + curve + vertical "to frontier" line) | DATA | NA | UNVERIFIED | |
| CF-EFF-03 | Frontier axis labels ("Expected return →", vol %) | DATA | NA | UNVERIFIED | |
| CF-FID-01 | FI Progress (depth) card — 4-tile grid (Ratio / Multiple / Achieved / Confidence) | DATA | SOURCE — FI target detail | UNVERIFIED | duplicates §B.3 in a different layout; A6 — must reconcile to CF-FI-* |
| CF-CONF-01 | Confidence summary card — "Cashflow Health" row | DATA | SOURCE — health confidence | UNVERIFIED | `health.confidence` |
| CF-CONF-02 | Confidence summary card — "Funded ratio" row (status label, NOT confidence) | DATA | SOURCE — funded-ratio status | UNVERIFIED | **FD-CF-1 — fixed in 533a8c0 to use derived status label, not `fr.confidence`** |
| CF-CONF-03 | Confidence summary card — "Probability of Success" row | DATA | SOURCE — PoS confidence | UNVERIFIED | `pos.confidence` |
| CF-CONF-04 | Confidence summary card — "Cost of Inaction" row | DATA | SOURCE — CoI confidence | UNVERIFIED | `coi.confidence` |

### Region 10 — Disclaimer footer

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| CF-FOOT-01 | `BRAND.disclaimer` line | DATA | NA | UNVERIFIED | A5 — FCA boundary |
| CF-FOOT-02 | Rules version + UK-CMA-2026.1 + Last verified date line | DATA | NA | UNVERIFIED | A6 — version strings must match `src/config/brand.js` |

### Region 11 — L3 drill overlays (reached from Cashflow, in scope)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| CF-OVL-S-01 | `SurplusDrillPanel` — back button | NAV | returns to Cashflow scroll position | UNVERIFIED | |
| CF-OVL-S-02 | Surplus drill hero (£/mo + £/yr summary) | DATA | NA | UNVERIFIED | |
| CF-OVL-S-03 | Surplus drill waterfall bars (6 steps) | DATA | SOURCE — per-step detail | UNVERIFIED | mirrors CF-WAT-03..07 |
| CF-OVL-S-04 | Surplus drill "Where to put the surplus" allocation rows | DATA | ACTION — allocator | UNVERIFIED | derived from `recommendedSurplusAllocation` |
| CF-OVL-S-05 | Surplus drill "Emergency buffer" card (months + band copy) | DATA | SOURCE — liquidity | UNVERIFIED | |
| CF-OVL-S-06 | Surplus drill footer ("Information only · Derived from your data · Not regulated advice") | DATA | NA | UNVERIFIED | A5 |
| CF-OVL-I-01 | `IncomeBreakdownDrillPanel` — back button | NAV | returns to Cashflow | UNVERIFIED | |
| CF-OVL-I-02 | Income drill source rows (Salary / Self-employment / Rental / Dividends / Pension / Other) | DATA | SOURCE — per-source detail | UNVERIFIED | reads `entity.income` directly — A6: array-vs-object shape both must be supported (see CAT-03 / CAT-04) |
| CF-OVL-I-03 | Income drill total row | DATA | NA | UNVERIFIED | |
| CF-OVL-I-04 | Income drill footer disclaimer | DATA | NA | UNVERIFIED | A5 |
| CF-OVL-H-01 | `HealthScoreDrillPanel` — back button | NAV | returns to Cashflow | UNVERIFIED | |
| CF-OVL-H-02 | Health drill total + band | DATA | NA | UNVERIFIED | |
| CF-OVL-H-03 | Health drill component rows (×5: Liquidity buffer / Surplus ratio / Debt manageability / Income resilience / Sequence resilience) | DATA | SOURCE — per-component detail | UNVERIFIED | reads `health.components`; **A6 — labels here ("Debt manageability", "Sequence resilience") DIFFER from the hero card labels ("Debt service ratio", "Sequence resilience"); verify intentional or rename** |
| CF-OVL-H-04 | Health drill per-row "{weight}% weight → {contribution}pts" caption | DATA | NA | UNVERIFIED | A5 — could read as advice if not careful |
| CF-OVL-H-05 | Health drill footer disclaimer | DATA | NA | UNVERIFIED | |

---

## SEED FINDINGS (pre-identified — agents start with these, then extend)

These are *already known* from reading the React component. They are not the list — they
are the proof the method works. Agents must confirm each, assign severity, and find the rest.

| Seed | Element(s) | Issue | Likely severity |
|------|-----------|-------|-----------------|
| S-01 | CF-X28-01 | Initial `windowId` state in `Cashflow.jsx` is `'current-tax-year'` but `X28TopBar.TIME_WINDOWS` uses id `'current-period'` — id mismatch means the controlled top bar can't find the window and silently falls back to a default. Default-state desync. | FUNCTIONAL |
| S-02 | CF-POSC-02, CF-SEQ-03/04, CF-EFF-01, CF-SCEN-02 | V2 chart components (`PoSChartV2`, `SequenceStressVisV2`, `EfficientFrontierV2`, `ScenarioMatrixV2`) fall back to **synthetic mock series** (e.g. `1_000_000 × 1.045^i`, hardcoded 5 scenarios with PoS 0.94/0.88/0.97/0.68) when their props are null. Cashflow renders them with engine-may-be-null props (e.g. `seqVuln?.good_path \|\| null`, `eff?.frontier_points \|\| null`). If engine returns null/undefined, the user sees an authoritative-looking chart driven by mocks — no disclosure. | DEMO-BLOCKING |
| S-03 | CF-SCEN-02 | Same as S-02 but specifically the 5 mock scenarios include hardcoded annual drawdown figures (£38k / £34k / £28k / £46k) and PoS values (94% / 88% / 97% / 68%) that look real. | DEMO-BLOCKING |
| S-04 | CF-ED-01 | "UK 45-54 cohort median: 58%" — `cohortMedian = 58` is **hardcoded** in `EssentialsDiscretionarySplit`. Not engine-sourced, no provenance. | FUNCTIONAL |
| S-05 | dead code | The file defines `CashflowWaterfall`, `FundedRatioGauge`, `MonteCarloFanChart`, `SequenceOfReturnsCard`, `FiveScenariosCard`, `EfficientFrontierCard` (lines ~1207–2629) but **none are rendered** — V2 imports take precedence. ~1,200 lines of dead component code with diverging logic from the V2 versions. | POLISH→FUNCTIONAL (drift risk) |
| S-06 | CF-FUND-02 (FD-CF-1) | Verify the funded-ratio label fix (commit 533a8c0) held across all renderers. Stage B must check both `ConfidenceIntervalSummary` (fixed) AND `FundedRatioGaugeV2`'s status (already derives from ratio via `statusFor`), AND the hero proxy at CF-HERO-09. No other surface should display `fr.confidence` as a "ratio status". | FUNCTIONAL |
| S-07 | CF-COIV-02, CF-RE-03, CF-GS-01 | Internal codes surfaced at the top layer of the UI: "O-CF-RULES-12 (pending founder sign-off)", "O-CF-RULES-09", "X24 mode 3". Violates the macOS principle (internal codes never at top layer — see project memory `feedback_finio_macos_principle.md`). | FUNCTIONAL |
| S-08 | CF-HERO-08/09/10 vs CF-OVL-H-03 | Hero card uses spec-aligned labels (Bill coverage / Surplus ratio / Income resilience / Funded ratio / Debt service ratio). Drill panel uses different labels (Liquidity buffer / Surplus ratio / Debt manageability / Income resilience / Sequence resilience). Same surface, two label sets for the same components. | FUNCTIONAL |
| S-09 | CF-HERO-08, CF-HERO-09, CF-HERO-10 | Three of five "Cashflow Health Score" components are **UI-derived proxies**, not engine outputs. Income resilience = `(annInc − essAnn) / annInc`; Funded-ratio score = `clamp(fr.ratio × 100, 0, 100)`; Debt-service score = `100 − max(0, dsr − 10) × 100/30`. Score total is `health.total` from engine but the component breakdown the user sees is a different mix. A6 risk — score and its visible decomposition don't fully reconcile. | FUNCTIONAL |
| S-10 | CF-SUB-02, CF-ALLOC-03 | "+ Add manually (coming next)" and per-priority "Set up" CTAs are buttons but their onClick is only `console.info('[…] action:', …)` — no user-visible response. Honest label, but A2 (drillable) fails for keyboard users without an aria-live region. | FUNCTIONAL |
| S-11 | global | Brand-string drift check — engine modules + spec comments still reference Sonuswealth / Finio in some places. Cashflow.jsx top-comment says "Sonuswealth Cashflow tab · v3 POLISHED" (good), but `BRAND.disclaimer` content must be checked against Sonuswealth lock. | FUNCTIONAL |
| S-12 | CF-WAT-09 | Empty-state copy ("add a salary, dividend, rental or pension stream via **+ Income**") implies a "+ Income" affordance on the screen that doesn't exist in Cashflow.jsx. Verify the affordance lives elsewhere (My Money?) and that the copy points users there explicitly, or remove the implication. | POLISH→FUNCTIONAL |
| S-13 | CF-SUB-01 / CF-PRC-01 | "PRC – PCC" sub-anchor and PRC/PCC Spread card use undefined acronyms at the top layer. Even when stub, the name appears in the hero / sub-anchor without a plain-English explainer. | FUNCTIONAL |
| S-14 | CF-GS-04 | Goal-Seek paths render `humanise(p.action.kind)` — converts camelCase keys to title-case words. If engine returns a key like `bedAndIsa` user sees "Bed And Isa" not a plain-English action. A5 risk depending on `goalSeek` output vocabulary. | POLISH→FUNCTIONAL |

---

## COVERAGE MATH (this replaces "99% confident")

Total inventory rows (count at audit time; v1 = 102 including sub-rows).

```
Coverage  = (rows with verdict ≠ UNVERIFIED) / (total rows)
Pass rate = (rows PASS) / (rows PASS + rows FAIL)
```

A pass is **complete** only when Coverage = 100% (every row has a verdict).
The audit **terminates** per the runbook stopping rule — not at a round number.
"99% confident" is only a legitimate claim when Coverage = 100% and it is restated as:
*"X of Y rows verified PASS; Z FAIL, all POLISH-severity and backlogged."*

---

*— end cashflow-screen-element-inventory-v1.md —*
