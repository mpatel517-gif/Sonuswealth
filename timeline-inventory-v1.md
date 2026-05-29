# Timeline Screen — Element Inventory v1

**Screen:** Sonuswealth Timeline (build target: React in `src/screens/Timeline.jsx`)
**Design baseline:** none on disk for Timeline v1.3 layout — component IS the structural truth (per inventory-builder spec).
**Reconciliation baseline:** engine — `src/engine/timeline-engine.js` (canonical for `calcAPQTimeline`, `calcMilestones`, `calcGoalProgress`, `calcScoreHistory`, `calcRiskHistory`, `listScenarios`) + `src/engine/fq-calculator.js` (canonical for `calcFQ`, `calcRisk`, `netWorth`, `fmt`, `daysLeft`, `fqTrajectory`, `lifeStageFor`, `calcAge`, `costOfInaction`, `nominationStatus`, `planFor`, `planStaleness`, `commitPlan`, `goalSeek`, `giftPct`, `taperBand`, `TAX`).
**Brand SoT:** `src/config/brand.js` (`BRAND.name` / `BRAND.nameDisplay`).
**Intent reference (NOT a conformance target):** `2-Product/2-Product-timeline-v1_3.md` — use for §X25 purpose, FCA phrasing, X28 window contract, D-SCORE-JOURNEY-1 mirror rule, §F-CANONICAL milestone-event ownership.
**Date:** 17 May 2026

> Note on unused panel files: `src/components/Timeline/NWTrajectoryChart.jsx` and `src/components/Timeline/PlansSection.jsx` exist on disk but are **not imported by Timeline.jsx**. They are out of scope for this audit. Flag separately if the founder wants them either wired in or removed.

---

## Why this file exists

This is the **fixed target** the whole audit measures against. Every interactive or
data-bearing element on Timeline is one numbered row. The audit does not "find mistakes" —
it walks this list and records a verdict per row. That is the only thing that makes
"99% confident" a real statement: it means *N of M rows verified PASS*, not a feeling.

**This file is the worksheet.** Auditor agents fill the `Verdict` columns. Do not add
or remove rows except via the "inventory drift" rule in the runbook (§6). If the build
contains an element not listed here, that is itself a finding (`UNLISTED`).

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

## Confirmed founder decisions (auditors treat these as fixed)

| FD | Decision |
|----|----------|
| FD-NAME-1 | **Product name is `Sonuswealth` (D-NAME-2, locked 9 May 2026 — supersedes Sonuswealth and Finio).** Source of truth: `src/config/brand.js` (`BRAND.name`). Casing: logo / wordmark = `sonuswealth` (lowercase, see `BRAND.nameDisplay`); body text, titles, aria-labels, page `<title>`, score strings = `Sonuswealth` (sentence case); marketing slogans (footer-tier only) may use ALL CAPS. Every `Sonuswealth` or `Finio` in user-facing strings = FUNCTIONAL FAIL (A5/A6). Engine-module disclaimers + comments are queued for Wave 4 Morph sweep. |
| FD-LOGO-1 | Brand assets live at `G:\My Drive\All Work\6.Finio\1-Clusters\Codex UI\deliverables\sonuswealth-site\assets\{favicons,logo,mascot,videos}`. Conformance-auditor checks that every surface uses the right logo variant per theme (light/dark) and flags the faded-purple dark variant as DEMO-BLOCKING wherever it appears below WCAG AA contrast. |
| FD-MASCOT-1 | Mascot is **Sonnu (owl)**, 6 life-stage forms: Starting Out · Growing Wealth · Planning Ahead · Peak Complexity · Securing Tomorrow · Leaving a Legacy. Placement on screens is **Wave 7 enhancement scope**, not in-audit; audit treats absence of Sonnu as not-a-finding. |
| FD-CROSS-1 | **Timeline owns *the when* for every critical action** — countdown to deadlines, dependent milestones, bill calendar, plan progress. The April-2027 SIPP-IHT countdown to `daysLeft()` lives here; the canonical "doing" surface is My Money (pension-drawdown panel) and Tax & Estate owns CoI projection. Timeline's drill-rule (A3) is satisfied when each row drills to *its own* angle's detail (deadline / dependency / commitment trail); it must NOT try to also be the canonical "do the thing" surface. CoI consumption is read-only on Timeline (spec §19.1). |
| FD-TL-1 | **Plans live on Timeline.** Per memory `feedback_read_prior_first.md`, all 8 `planTypes` (retirement · estate · cashflow · debt · gift · protection · tax · custom) surface on Timeline only. Home's plan strip (H-PLAN-01/02) drills here, not to a non-existent "Plan" tab. §E is the canonical plan-builder surface; §F.1 plan-funded headline is the canonical "Am I on track?" answer. |
| FD-TL-2 | **§B Score Journey is a READ-ONLY MIRROR** (spec §5.10, D-SCORE-JOURNEY-1). `scoreJourneyData` is pre-computed ONCE at `TimelineScreen` top and passed to `SectionB` as a prop. Skeleton renders up to 3s, then `{error:true}` fallback. SectionB does **not** call `calcScoreHistory()` directly. |
| FD-TL-3 | **§F is canonical owner of MILESTONE_* events** (§F-CANONICAL). Only §F writes `MILESTONE_DETECTED` / `MILESTONE_DISMISSED` / `MILESTONE_CELEBRATED`. Tap "Celebrate" must fire both `MILESTONE_CELEBRATED` and `MILESTONE_DISMISSED` via the `onCommit` prop / `commitPlan` event helper. |
| FD-TL-4 | **§A and §F are LIFETIME-anchored** — they do NOT respond to the X28 top-bar window. §B history range and §C forward calendar window ARE wired to X28 (`windowToHistoryRange()` + `horizonMonths` switch in SectionC). |

---

## ELEMENT TABLE

> `Owns-subject destination` is the **expected** A3/A4 target — the auditor checks the
> build against this. Where it reads "dedicated panel," a coherent in-context drill
> (overlay or sub-screen) is acceptable; a bare tab-jump is not.

### Region 1 — X28 top-bar

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TL-X28-01 | X28 top-bar — window picker (`windowId`) | ACTION | sets shared window state; scopes §B range + §C horizon | UNVERIFIED | options: current-month · last-30-days · current-tax-year · calendar-year · last-12-months · lifetime · custom |
| TL-X28-02 | X28 top-bar — viewMode toggle (`actual` / `plan`) | ACTION | switches §B forecast/plan overlay; pinned via D-SCORE-JOURNEY-1 deps | UNVERIFIED | spec §X28.6 "Plan-primary mode" |
| TL-X28-03 | X28 top-bar — rules-version badge (`TAX.ver`) | DATA | SOURCE — rules bundle detail | UNVERIFIED | must equal "UK-2026.1" from `TAX.ver`; reconcile with disclaimer footer |
| TL-X28-04 | X28 top-bar — data-date label (`entity.dataLastUpdated`) | DATA | SOURCE — data freshness | UNVERIFIED | fallback to `'UK-2026.1'` if missing — verify fallback is intentional vs bug |

### Region 2 — Triple Anchor (D-ANCHOR-1)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TL-ANCH-01 | Net Worth anchor card | ANCHOR | SOURCE — My Money asset breakdown (via `onDrillMetric('netWorth')`) | UNVERIFIED | `netWorth(e)`; counter-up via `Num animate`; **RECONCILE: Home H-ANCH-01 same value & format** |
| TL-ANCH-02 | Wealth Score anchor card | ANCHOR | SOURCE — score breakdown (via `onDrillMetric('wealthScore')`) | UNVERIFIED | `calcFQ(e)`; **RECONCILE: Home H-ANCH-02 + Home H-CHR-10 topbar chip** |
| TL-ANCH-02a | Wealth Score band sub-label (`fq.band.name`) | DATA | NA (display) | UNVERIFIED | A5 — must be plain-English ("Established" etc.), not internal code |
| TL-ANCH-03 | Risk Score anchor card | ANCHOR | SOURCE — Risk screen (via `onDrillMetric('riskScore')` else `handleRiskTap` → onNav('risk')) | UNVERIFIED | `calcRisk(e)`; **RECONCILE: Home H-ANCH-03 same value** |
| TL-ANCH-03a | Risk Score band sub-label (`risk.band.name`) | DATA | NA (display) | UNVERIFIED | A5 — plain English required |

### Region 3 — Sub-Anchor strip + X25 purpose

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TL-SUB-01 | Capital Efficiency (PRC/PCC) sub-anchor row | DATA | SOURCE — capital-efficiency detail (stub `O-FOUNDER-IP-01`) | UNVERIFIED | **Renders "—" + "Coming next" — verify FD-CTA-1 honesty: not labelled as interactive when wired-empty.** Stub on Timeline-only is acceptable; deceptive "interactive" label would be a FAIL |
| TL-PURP-01 | X25 purpose statement headline ("Where am I in my financial life — and where am I headed?") | DATA | NA (orientation copy) | UNVERIFIED | A5 — must read in one pass |
| TL-PURP-02 | X25 purpose statement sub-line | DATA | NA | UNVERIFIED | A5 |

### Region 4 — §F.1 Plan-Funded Headline (CRIT 1.1 / 4.1 / 7.1)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TL-PFH-00 | §F.1 card — empty-state ("You haven't set a plan yet.") | DATA | NA | UNVERIFIED | renders only when `planRows.filter(r => r.exists).length === 0` |
| TL-PFH-00a | Empty-state CTA "Set your first plan →" | ACTION | DECISION — goal-seek sheet (`openGoalSeek()` no metric) | UNVERIFIED | opens `GoalSeekSheet` with default `wealthScore` |
| TL-PFH-01 | §F.1 card — populated headline label (`Your plan · headline`) | DATA | NA | UNVERIFIED | |
| TL-PFH-02 | Plan name (`headline.label`) | DATA | NA (display) | UNVERIFIED | derived: retirement preferred, else first existing plan |
| TL-PFH-03 | Plan target line (`Target ${formatPlanTarget}` + optional `~Ny to target`) | DATA | NA (display) | UNVERIFIED | A5 — verify `formatPlanTarget` returns plain-English for all 8 plan-types; **reconcile to engine `planFor()` not hardcoded** |
| TL-PFH-04 | Tracking pill (`On track` / `Tracking behind` / `Off track` / `Awaiting data`) | DATA | NA (status) | UNVERIFIED | derived from `fundedPct` from `entity.scenarios[].deltaResults.fundedRatio` (most optimistic). A6: same status everywhere |
| TL-PFH-05 | Funded% percentage label | DATA | SOURCE — funded% derivation | UNVERIFIED | tabular-nums; `pctLabel = round(fundedPct * 100)%` |
| TL-PFH-06 | Funded% progress bar | DATA | NA (visualisation of TL-PFH-05) | UNVERIFIED | colour: success ≥100% / warning ≥85% / danger <85% |
| TL-PFH-07 | "Review · adjust this plan →" CTA | ACTION | DECISION — goal-seek sheet seeded with `headline.pt.id` | UNVERIFIED | calls `openGoalSeek(headline.pt.id)` |
| TL-PFH-08 | Footer caption ("Funded% derived from saved scenarios; the engine models — not advice.") | DATA | NA | UNVERIFIED | A5 — FCA phrasing check |

### Region 5 — §A Life Stage band (LIFETIME-anchored)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TL-LS-HEAD | §A section header pill ("A · Life stage · Where you sit on the path") | NAV | NA (sticky landmark) | UNVERIFIED | sticky top:56 |
| TL-LS-01 | Stage name hero (`stg.name`, e.g. "Consolidation") | DATA | SOURCE — stage rule detail | UNVERIFIED | `lifeStageFor(age)` |
| TL-LS-01a | Stage range + % through + age line ("45–55 · 42% through · Age 49") | DATA | NA (display) | UNVERIFIED | pctAnim counter-up; verify denominator math vs spec §4.3 |
| TL-LS-02 | "Stage N of 7" chip | DATA | NA | UNVERIFIED | |
| TL-LS-03 | Animated stage % progress bar | DATA | NA (visualisation of TL-LS-01a) | UNVERIFIED | `sw-bar-grow` 700ms animation |
| TL-LS-04 | 7-segment life-stage strip (one segment per stage) | DATA | NA (timeline visualisation) | UNVERIFIED | `RevealStagger`; current segment has `.sw-pulse-glow` |
| TL-LS-04a-g | 7 segment labels under strip (Fou · Acc · Con · Tra · Dec · Pre · Leg) | DATA | NA | UNVERIFIED | A5 — abbreviations ok if spec requires; flag if illegible |
| TL-LS-05 | "18" / "85+" anchor labels at strip ends | DATA | NA | UNVERIFIED | hardcoded age boundaries — match spec §4.3 |
| TL-LS-06 | On-chart implication line ("You enter X at age Y · primary change: …") | DATA | NA (display) | UNVERIFIED | A5 — verify all 7 `nextRule` strings are plain English; verify Legacy fallback copy |
| TL-LS-06a | DiffBadge years-to-next-stage ("▲Ny") | DATA | NA | UNVERIFIED | X29 milestone diff |
| TL-LS-07 | CausalityStripe (`DOB · entity.individual.dob`, `bundle: UK-2026.1`) | DATA | SOURCE — provenance | UNVERIFIED | X29 provenance |

### Region 6 — §B Score Journey (D-SCORE-JOURNEY-1)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TL-SJ-HEAD | §B section header pill ("B · Score journey · Your Wealth + Risk scores over the selected window") | NAV | NA (sticky landmark) | UNVERIFIED | |
| TL-SJ-SKEL | Skeleton state ("Computing your Score Journey…") | DATA | NA | UNVERIFIED | shows while `scoreJourneyData == null` (up to 3s) |
| TL-SJ-ERR | Error state ("Score Journey temporarily unavailable — try refreshing") | DATA | NA | UNVERIFIED | A5 — no refresh handler visible; verify whether the copy is honest |
| TL-SJ-00 | "Score journey" label + window meta (`window: {range}`) | DATA | NA | UNVERIFIED | |
| TL-SJ-00a | `ExplainerChip id="TL-1"` | OVERLAY | SOURCE — methodology explainer | UNVERIFIED | verify explainer copy exists for `TL-1` key |
| TL-SJ-01 | Range-picker — `1mo` button | ACTION | sets `rangeOverride='1mo'` | UNVERIFIED | active-state pill |
| TL-SJ-02 | Range-picker — `3mo` button | ACTION | sets `rangeOverride='3mo'` | UNVERIFIED | |
| TL-SJ-03 | Range-picker — `6mo` button | ACTION | sets `rangeOverride='6mo'` | UNVERIFIED | |
| TL-SJ-04 | Range-picker — `12mo` button | ACTION | sets `rangeOverride='12mo'` | UNVERIFIED | **Verify: range-picker exposes only 4 ranges but ScoreHistoryDrillPanel offers 5 (incl. all-time). Possible A5/A6 inconsistency** |
| TL-SJ-05 | B.1 twin-score card — Wealth Score value | DATA | SOURCE — score breakdown | UNVERIFIED | counter-up; **RECONCILE: TL-ANCH-02 same value** |
| TL-SJ-05a | B.1 twin-score card — Wealth Score band name | DATA | NA | UNVERIFIED | **RECONCILE: TL-ANCH-02a** |
| TL-SJ-05b | B.1 twin-score card — Wealth DiffBadge (`wΔ`) | DATA | NA | UNVERIFIED | derived from `hist.points[last] - hist.points[0]` |
| TL-SJ-06 | B.1 twin-score card — Risk Score value | DATA | SOURCE — risk score breakdown | UNVERIFIED | **RECONCILE: TL-ANCH-03 same value** |
| TL-SJ-06a | B.1 twin-score card — Risk band name | DATA | NA | UNVERIFIED | |
| TL-SJ-06b | B.1 twin-score card — Risk DiffBadge (`rΔ`) | DATA | NA | UNVERIFIED | |
| TL-SJ-07 | B.2 "Action levels" bars row (`fqTrajectory(entity)`) | DATA | SOURCE — action-level detail | UNVERIFIED | RevealStagger; each bar height = `(t.score/100)*64` |
| TL-SJ-07a | B.2 each bar — score label | DATA | NA | UNVERIFIED | |
| TL-SJ-07b | B.2 each bar — level label (`t.label`) | DATA | NA | UNVERIFIED | A5 — verify all level labels are plain English |
| TL-SJ-08 | B.3 Wealth Score history line — confidence label | DATA | SOURCE — confidence detail | UNVERIFIED | `${hist.confidence} confidence` — values: HIGH/MED/LOW |
| TL-SJ-08a | B.3 Wealth Score history — delta label (`+N pts (range)`) | DATA | NA | UNVERIFIED | |
| TL-SJ-08b | B.3 Wealth Score sparkline (`ScoreSparkline`) | DATA | SOURCE — full history (drill) | UNVERIFIED | `DrawSVG` 1200ms; annotated points are warning-coloured circles |
| TL-SJ-09 | B.4 Risk Score history line — confidence label | DATA | SOURCE — confidence detail | UNVERIFIED | |
| TL-SJ-09a | B.4 Risk Score history — delta label | DATA | NA | UNVERIFIED | **Note: colour-coded `rΔ <= 0` is success — Risk drop is good. Verify this is consistent everywhere** |
| TL-SJ-09b | B.4 Risk Score sparkline | DATA | SOURCE — full history (drill) | UNVERIFIED | |
| TL-SJ-10 | Plan-active mode banner ("Retirement plan active · Forecast-vs-Plan tracking enabled") | DATA | NA | UNVERIFIED | renders when `planActive` (plan present AND viewMode==='plan') |
| TL-SJ-11 | Plan-available switch CTA ("Retirement plan committed — switch to Plan view to overlay") | ACTION | sets `viewMode='plan'` via `onViewModeChange` | UNVERIFIED | renders when plan present AND viewMode !== 'plan' |
| TL-SJ-12 | No-plan hint ("No retirement plan yet — defaults to Forecast. Set a plan in §E to enable Plan-mode overlay.") | DATA | NA (orientation copy) | UNVERIFIED | A5 — "§E" jargon; consider plain-English ("Scenarios & Plans below"). RECONCILE with FD-TL-1 + TL-PFH-00a |
| TL-SJ-13 | LOW-confidence footer ("Score history is synthesised — activates when event log is live.") | DATA | NA (honesty disclosure) | UNVERIFIED | only when `hist.confidence === 'LOW'` |
| TL-SJ-14 | §B CausalityStripe (calcScoreHistory / calcRiskHistory / D-SCORE-JOURNEY-1 mirror) | DATA | SOURCE — provenance | UNVERIFIED | X29 provenance |
| TL-SJ-15 | "Detail ›" L3 drill chip (top-right of §B card) | ACTION | OVERLAY — `ScoreHistoryDrillPanel` (L3) | UNVERIFIED | only renders when scoreJourneyData ready + no error |

### Region 7 — §C Action Calendar (X28-windowed)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TL-CAL-HEAD | §C section header pill ("C · What's coming and when · Statutory · personal · action — sorted by urgency") | NAV | NA (sticky landmark) | UNVERIFIED | |
| TL-CAL-00 | Horizon meta label ("horizon: 12mo" or "lifetime") | DATA | NA | UNVERIFIED | derived from `horizonMonths` switch on `windowId` |
| TL-CAL-01 | Category filter chip — `Statutory` | ACTION | toggles inclusion of `category==='statutory'` rows | UNVERIFIED | all 3 chips on by default |
| TL-CAL-02 | Category filter chip — `Personal` | ACTION | toggles `category==='personal'` | UNVERIFIED | |
| TL-CAL-03 | Category filter chip — `Action` | ACTION | toggles `category==='action'` | UNVERIFIED | |
| TL-CAL-EMPTY | Empty-state line ("No calendar entries for selected categories within the X-month horizon.") | DATA | NA | UNVERIFIED | **Founder ex.: bill-calendar empty state with no ACTION is a flagged anti-pattern. Verify this is acceptable — adding "Add an event" / "Show longer horizon" CTA might be required.** |
| TL-CAL-04 | Calendar row — `sipp-iht` ("DC pensions enter estate for IHT") | DATA | SOURCE — T&E CoI projection (canonical CoI surface per FD-CROSS-1) | UNVERIFIED | date `'6 Apr 2027'` hardcoded — **RECONCILE: must match Home H-ANCH-04 / T&E "6 Apr 2027" / Cashflow strip; `daysAway = daysLeft()` must equal Home H-ANCH-04a "326 days to act"** |
| TL-CAL-04a | sipp-iht row — animated day counter ("N days remaining") | DATA | SOURCE — days-left detail | UNVERIFIED | `useCounterAnimation(e.daysAway)`; only when daysAway > 0 && ≤ 365 |
| TL-CAL-04b | sipp-iht row — coral chip "£X/day accruing" | DATA | SOURCE — CoI per-day detail | UNVERIFIED | `coiCount`; must reconcile to `costOfInaction(e) / daysLeft()` |
| TL-CAL-04c | sipp-iht row — total exposure label ("£X total exposure") | DATA | SOURCE — CoI total | UNVERIFIED | `costOfInaction(e)`; **RECONCILE: Home H-ANCH-04 "£340K"** |
| TL-CAL-05 | Calendar row — `isa-reset` ("ISA allowance resets — £X available") | DATA | SOURCE — ISA allowance detail (My Money) | UNVERIFIED | `TAX.isaAllowance`; date `5 Apr ${yr}` is computed |
| TL-CAL-06 | Calendar row — `sa-deadline` ("Self-assessment submission deadline") | DATA | SOURCE — SA detail (Tax & Estate) | UNVERIFIED | hardcoded `31 Jan ${yr+1}`; verify HMRC SA logic |
| TL-CAL-07 | Calendar row — `state-pension` ("State Pension begins") | DATA | SOURCE — state pension detail (Cashflow) | UNVERIFIED | `daysAway = yearsTo * 365` — verify rounding error tolerance |
| TL-CAL-08 | Calendar row(s) — `apq-*` (APQ deadline-linked) | DATA | SOURCE — APQ action surface (My Money / T&E by domain) | UNVERIFIED | `calcAPQTimeline(entity)`; `pension-drawdown` excluded; verify each title/detail is plain-English |
| TL-CAL-09 | Calendar row — `nominations` ("Pension nomination(s) need updating") | DATA | ACTION — pension nominations panel (My Money) | UNVERIFIED | renders Overdue chip; date='Overdue' hardcoded string |
| TL-CAL-10 | Calendar row — `trust-gift` ("Gift clock — N% elapsed towards IHT-free") | DATA | SOURCE — gift detail (Tax & Estate) | UNVERIFIED | `giftPct` + `taperBand`; renders GiftClockRing |
| TL-CAL-10a | trust-gift row — `GiftClockRing` SVG | DATA | NA (visualisation) | UNVERIFIED | 1100ms stroke-dashoffset animation |
| TL-CAL-11 | Calendar row — `mortgage-fix` ("Mortgage fixed rate expires") | DATA | SOURCE — mortgage detail (My Money / Cashflow) | UNVERIFIED | only when `entity.liabilities.mortgage.endDate` set & within window |
| TL-CAL-99 | Per-row date chip (`sw-chip-coral` / `sw-chip-amber` / `sw-chip-mint`) | DATA | NA (urgency band) | UNVERIFIED | `urgencyClass(daysAway, isOverdue)`: <90d coral · <180d amber · else mint |
| TL-CAL-99a | Per-row "Overdue" badge | DATA | NA | UNVERIFIED | renders when daysAway<0 OR (daysAway===null && category==='action') |
| TL-CAL-99b | Per-row CausalityStripe sources line ("↳ …") | DATA | SOURCE — provenance | UNVERIFIED | X29 provenance |

### Region 8 — §D Decision Log

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TL-DL-HEAD | §D section header pill ("D · Decision Log · Audit trail of every committed action") | NAV | NA (sticky landmark) | UNVERIFIED | |
| TL-DL-EMPTY | Decision-log empty state ("No decisions logged yet. As you commit Take Action paths from any tab, they appear here — your structured audit trail.") | DATA | NA | UNVERIFIED | A5 — readable |
| TL-DL-00 | Decision-count header ("N decisions logged") | DATA | NA | UNVERIFIED | |
| TL-DL-01 | Decision row — title (`d.title` or `d.type`) | DATA | NA | UNVERIFIED | tap-to-expand row |
| TL-DL-01a | Decision row — date (`d.date` or `committed_at.substring(0,10)`) | DATA | NA | UNVERIFIED | |
| TL-DL-01b | Decision row — detail (`d.detail`) | DATA | NA | UNVERIFIED | |
| TL-DL-01c | Decision row — DiffBadge (`impScore` from `d.impact.finioScore` or `d.impact.fqDelta`) | DATA | NA | UNVERIFIED | A5 — "Wealth Score impact" label; **A5/A6: `finioScore` field name still has legacy `finio` prefix — verify intent (engine internal vs displayed)** |
| TL-DL-01d | Decision row — expanded detail ("Source: X · Step-up: L1 · ID: Y") | DATA | SOURCE — decision provenance | UNVERIFIED | A5 — "L1" / "Step-up" jargon — verify spec defines this |
| TL-DL-01e | Decision row tap-to-expand chevron | ACTION | toggles `expanded` state | UNVERIFIED | implicit; whole row clickable via `sw-press` |
| TL-DL-02 | "+N more decisions in log" footer (when > 6) | DATA | NA | UNVERIFIED | **Verify: no actual "view all" CTA — if decisions grow > 6, those are invisible. Potential FUNCTIONAL gap** |

### Region 9 — §E Scenarios & Plans (canonical plan-builder per FD-TL-1)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TL-PLN-HEAD | §E section header pill ("E · Scenarios & Plans · 8 plan types · saved scenarios · goal-seek") | NAV | NA (sticky landmark) | UNVERIFIED | A5 — "goal-seek" jargon for non-experts |
| TL-PLN-00 | "Set a plan →" primary CTA (top of §E) | ACTION | DECISION — `GoalSeekSheet` via `openGoalSeek()` | UNVERIFIED | HIGH 5.4 was buried before, now top-of-section |
| TL-PLN-01 | "Active Plans" subsection header + count ("N/8 set") | DATA | NA | UNVERIFIED | |
| TL-PLN-02 | PlanRow — `retirement` (⊙ glyph) | DATA | SOURCE — plan detail (expand) | UNVERIFIED | `planFor(e, 'retirement')` |
| TL-PLN-03 | PlanRow — `estate` (◇ glyph) | DATA | SOURCE — plan detail (expand) | UNVERIFIED | |
| TL-PLN-04 | PlanRow — `cashflow` (≋ glyph) | DATA | SOURCE — plan detail (expand) | UNVERIFIED | |
| TL-PLN-05 | PlanRow — `debt` (⊟ glyph) | DATA | SOURCE — plan detail (expand) | UNVERIFIED | |
| TL-PLN-06 | PlanRow — `gift` (⬡ glyph) | DATA | SOURCE — plan detail (expand) | UNVERIFIED | |
| TL-PLN-07 | PlanRow — `protection` (⛨ glyph) | DATA | SOURCE — plan detail (expand) | UNVERIFIED | |
| TL-PLN-08 | PlanRow — `tax` (⚖ glyph) | DATA | SOURCE — plan detail (expand) | UNVERIFIED | |
| TL-PLN-09 | PlanRow — `custom` (◌ glyph) | DATA | SOURCE — plan detail (expand) | UNVERIFIED | |
| TL-PLN-0x | Per-row status chip (`Current` / `Stale` / `Not set`) | DATA | NA | UNVERIFIED | `planStaleness(e, pt.id)`; chip class mint/amber/none |
| TL-PLN-0y | Per-row target line (`reason · target X`) | DATA | NA (display) | UNVERIFIED | `formatPlanTarget(row)`; A5 — verify target string readable for all object shapes (netWorth / ihtCap / gapAmount / age) |
| TL-PLN-0z | Per-row expanded detail (Target · Window · Committed · Staleness) | DATA | SOURCE — plan envelope detail | UNVERIFIED | renders on tap when `exists` |
| TL-PLN-0w | Per-row "Edit · Goal-seek" CTA (inside expanded body) | ACTION | DECISION — GoalSeekSheet seeded with `pt.id` | UNVERIFIED | HIGH 5.3 fix; `stopPropagation` prevents row collapse |
| TL-PLN-10 | "Saved Scenarios" subsection header + count ("N saved") | DATA | NA | UNVERIFIED | scenarios from `resolveScenarios(entity)` |
| TL-PLN-10a | Saved-scenarios empty state ("No scenarios saved yet. Explore a What If from any tab to save your first.") | DATA | NA | UNVERIFIED | A5 |
| TL-PLN-11 | Saved-scenario row — name | DATA | NA | UNVERIFIED | sliced to first 4 |
| TL-PLN-11a | Saved-scenario row — meta ("date · source · rules_version") | DATA | SOURCE — scenario detail | UNVERIFIED | |
| TL-PLN-11b | Saved-scenario row — TrackingPill + funded% | DATA | NA | UNVERIFIED | **RECONCILE: same fundedPct shape as TL-PFH-04/05** |
| TL-PLN-12 | "View all" affordance for scenarios beyond first 4 | ACTION | NA — DOES NOT EXIST | UNVERIFIED | **GAP: §E shows scenarios.slice(0,4) but renders no "See all" CTA. If `entity.scenarios.length > 4`, the remainder are invisible. Potential FUNCTIONAL FAIL** |
| TL-PLN-13 | "View all" affordance for decisions beyond first 6 | ACTION | NA — DOES NOT EXIST in §D | UNVERIFIED | cross-ref TL-DL-02 |

### Region 10 — §F Goals & Milestones (LIFETIME-anchored · §F-CANONICAL owner of MILESTONE_*)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TL-GM-HEAD | §F section header pill ("F · Goals & Milestones · Achieved + projected — tap Celebrate to mark") | NAV | NA (sticky landmark) | UNVERIFIED | |
| TL-GM-01 | Pinned unacknowledged-milestone card ("Milestone reached: <label>") | DATA | NA | UNVERIFIED | renders top of `ms.achieved` filtered by `!celebrated && !dismissed` |
| TL-GM-01a | Pinned milestone — achieved date ("Achieved YYYY-MM-DD") | DATA | NA | UNVERIFIED | optional "(estimated from trajectory)" if `synthetic` |
| TL-GM-01b | "Celebrate" CTA on pinned milestone | ACTION | fires `MILESTONE_CELEBRATED` + `MILESTONE_DISMISSED` via `onCommit`; triggers `ConfettiBurst` | UNVERIFIED | per FD-TL-3 — verify both events emit |
| TL-GM-01c | "Got it" dismiss CTA on pinned milestone | ACTION | fires `MILESTONE_DISMISSED` via `onCommit` | UNVERIFIED | |
| TL-GM-01d | ConfettiBurst overlay | DATA | NA (visualisation) | UNVERIFIED | 14 radial dots, 1.1s animation |
| TL-GM-02 | Milestone-timeline subsection header ("Milestone timeline") | DATA | NA | UNVERIFIED | renders when `ms.achieved.length > 0 OR ms.projected.length > 0` |
| TL-GM-02a | Achieved milestone row (✓ green dot, "Done" chip) | ACTION | OVERLAY — `MilestoneDrillPanel` via `onMilestoneTap(m)` | UNVERIFIED | sliced to first 3 |
| TL-GM-02b | Projected milestone row (◌ dashed warning ring, "Projected" chip) | ACTION | fires `MILESTONE_DETECTED` then opens drill via `handleProjectedTap(m)` | UNVERIFIED | sliced to first 3; renders ProgressBar if `m.progress > 0` |
| TL-GM-03 | "Your goals (N)" subsection header (when `entity.goals.length > 0`) | DATA | NA | UNVERIFIED | |
| TL-GM-03a | Goal row — label + % | DATA | NA | UNVERIFIED | `calcGoalProgress(g, entity)` |
| TL-GM-03b | Goal row — progress bar | DATA | NA (visualisation) | UNVERIFIED | |
| TL-GM-03c | Goal row — projected hit-date line ("Projected: YYYY-MM · N months behind") | DATA | NA | UNVERIFIED | optional; `gp.aheadOrBehind` string |
| TL-GM-04 | Goal-templates grid (when no goals set) — 8 cards | ACTION | DECISION — goal-create via `onCreateGoal(t)` → `onNav('goal-create', { template })` | UNVERIFIED | RevealStagger 2-col grid |
| TL-GM-04a-h | Goal template — retire / mortgage / nw_target / emergency / income / iht_free / uni_fund / deposit | ACTION | DECISION — goal-create flow per `t.template_id` | UNVERIFIED | A5 — labels readable; verify `onNav('goal-create', …)` actually routes to a real flow |
| TL-GM-05 | Achieved-milestone tally footer ("N milestones achieved · most recent: <label>") | DATA | NA | UNVERIFIED | only when `ms.achieved.length > 0` |

### Region 11 — Disclaimer + chrome footer

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TL-DISC-01 | Disclaimer block ("Not regulated financial advice. Sonuswealth models scenarios…") | DATA | NA (FCA boundary) | UNVERIFIED | A5 — FCA phrasing check; brand name reconcile per FD-NAME-1 |
| TL-DISC-02 | Rules version + last-verified line ("UK-2026.1 · Last verified: …") | DATA | SOURCE — rules detail | UNVERIFIED | **RECONCILE: TL-X28-03 same `TAX.ver` value; same `entity.dataLastUpdated`** |

### Region 12 — Overlays (reached from Timeline, in scope)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TL-OVL-01 | `GoalSeekSheet` (lifted; sheet-overlay) | OVERLAY | DECISION — pick metric, run `goalSeek(e, metric, value, '12mo')`, commit a path via `commitPlan` | UNVERIFIED | seeded by `goalSeekMetric`; opened from TL-PFH-00a/07, TL-PLN-00, TL-PLN-0w |
| TL-OVL-01a | GoalSeekSheet — metric `<select>` (12 options: wealthScore/riskScore/netWorth/iht + 8 plan-types) | ACTION | sets `seekTarget.metric` | UNVERIFIED | A5 — "iht" should be plain-English ("IHT exposure" label is fine) |
| TL-OVL-01b | GoalSeekSheet — target value `<input type=number>` | ACTION | sets `seekTarget.value` | UNVERIFIED | no unit hint — verify A5 (number for what? £/score/age depends on metric) |
| TL-OVL-01c | GoalSeekSheet — "Find paths" CTA | ACTION | runs `goalSeek(e, metric, +value, '12mo', { maxAction: 200000 })` | UNVERIFIED | error-handled with empty array fallback |
| TL-OVL-01d | GoalSeekSheet — result row(s) ("<kind> · £X — achieves Y · gap Z") | DATA | NA | UNVERIFIED | sliced first 4 |
| TL-OVL-01e | GoalSeekSheet — "Commit this path" CTA per row | ACTION | builds plan envelope + `commitPlan(e, envelope)` → fires onCommit | UNVERIFIED | **A6: envelope.type is 'retirement' for wealthScore but 'custom' for everything else — verify intent; could lose plan-type fidelity for explicit retirement/estate/etc metrics** |
| TL-OVL-01f | GoalSeekSheet — no-paths empty state | DATA | NA | UNVERIFIED | "No paths found within constraints — try a less aggressive target." |
| TL-OVL-01g | GoalSeekSheet — "Close" button + backdrop tap | ACTION | resets results, closes sheet | UNVERIFIED | |
| TL-OVL-02 | `ScoreHistoryDrillPanel` (L3, full-screen) | OVERLAY | SOURCE — score trajectory detail | UNVERIFIED | opened from TL-SJ-15 "Detail ›" chip |
| TL-OVL-02a | ScoreHistoryDrillPanel — Back button | ACTION | closes drill (`setDrillView(null)`) | UNVERIFIED | |
| TL-OVL-02b | ScoreHistoryDrillPanel — hero twin-score (Wealth + Risk) | DATA | NA | UNVERIFIED | **RECONCILE: same value as TL-SJ-05/06 (no animation diff)** |
| TL-OVL-02c | ScoreHistoryDrillPanel — range picker (5 options incl. `all-time`) | ACTION | sets `activeRange` local state | UNVERIFIED | **Note: this state is NOT wired back to `scoreJourneyData`; sparklines use the parent-passed `hist.points`. Range change is cosmetic-only — A2/A6 risk** |
| TL-OVL-02d | ScoreHistoryDrillPanel — Wealth sparkline card | DATA | SOURCE — wealth history | UNVERIFIED | LOW-confidence footnote present |
| TL-OVL-02e | ScoreHistoryDrillPanel — Risk sparkline card | DATA | SOURCE — risk history | UNVERIFIED | |
| TL-OVL-02f | ScoreHistoryDrillPanel — 8-dimension breakdown bars | DATA | SOURCE — per-dim score detail | UNVERIFIED | **A5/A6: eyebrow says "8 dimensions" but `dims` comes from `fq.dims` which may be 7 per Risk v1.6 spec. Verify count is accurate** |
| TL-OVL-02g | ScoreHistoryDrillPanel — Action levels bars | DATA | SOURCE — action-level detail | UNVERIFIED | from `traj` |
| TL-OVL-02h | ScoreHistoryDrillPanel — disclaimer footer | DATA | NA | UNVERIFIED | A5 — "D-SCORE-JOURNEY-1" jargon at user-visible level; verify acceptability |
| TL-OVL-03 | `MilestoneDrillPanel` (L3, full-screen) | OVERLAY | SOURCE — milestone detail | UNVERIFIED | opened from TL-GM-02a/02b |
| TL-OVL-03a | MilestoneDrillPanel — Back button | ACTION | closes drill | UNVERIFIED | |
| TL-OVL-03b | MilestoneDrillPanel — status pill (Achieved/At risk/On track) | DATA | NA | UNVERIFIED | derived from `milestone.achieved` / `status` / `atRisk` |
| TL-OVL-03c | MilestoneDrillPanel — progress bar + % | DATA | NA | UNVERIFIED | optional; `pctNum` rounded |
| TL-OVL-03d | MilestoneDrillPanel — Current vs Target row | DATA | SOURCE — milestone target detail | UNVERIFIED | `fmt(num)` if numeric |
| TL-OVL-03e | MilestoneDrillPanel — "What would push this forward?" hint card | DATA | NA (guidance copy) | UNVERIFIED | A5 — FCA phrasing; generic copy if no shortfall; **note: no ACTION CTA in drill — drill is read-only, which may be intentional but verify against founder ex. #1 "describe-only modals are FAIL"** |
| TL-OVL-03f | MilestoneDrillPanel — disclaimer footer | DATA | NA | UNVERIFIED | A5 |
| TL-OVL-04 | `ExplainerChip id="TL-1"` overlay (opened from TL-SJ-00a) | OVERLAY | SOURCE — methodology explainer | UNVERIFIED | content not in Timeline.jsx — explainer key resolved by shared component |

---

## SEED FINDINGS (pre-identified — agents start with these, then extend)

These are *already known* from reading the React component, cross-referencing the founder
plans, and applying the seed-finding reminders. They are not the list — they are the proof
the method works. Agents must confirm each, assign severity, and find the rest.

| Seed | Element(s) | Issue | Likely severity |
|------|-----------|-------|-----------------|
| TL-S-01 | TL-CAL-04 / TL-CAL-04a | SIPP-IHT row date `'6 Apr 2027'` is a hardcoded string; `daysAway = daysLeft()` is engine-driven. **RECONCILE check: must equal Home H-ANCH-04a "326 days to act", T&E "6 Apr 2027", and Cashflow plan strips.** If `daysLeft()` returns a value that doesn't match Home, demo-blocking. | DEMO-BLOCKING |
| TL-S-02 | TL-CAL-04c ↔ TL-ANCH-* | sipp-iht "total exposure" uses `costOfInaction(e)` — must equal Home H-ANCH-04 "£340K" and T&E CoI breakdown. **RECONCILE: same value, same `fmt()` format everywhere.** | DEMO-BLOCKING |
| TL-S-03 | TL-CAL-09 ("Pension nomination(s) need updating") | Date string `'Overdue'` is hardcoded as the chip label; `daysAway = -1` is the only signal. If `nominationStatus()` returns stale items, the row shows "Overdue" with no concrete due-date — A5 partial fail (no "what overdue means" anchor). | FUNCTIONAL |
| TL-S-04 | TL-CAL-06 ("Self-assessment submission deadline") | Date `31 Jan ${yr+1}` is calculated from local `new Date()` — not from `TAX.deadline` or any rules-bundle source. Drift risk after midnight on 31 Jan; engine-bundle should own this. | FUNCTIONAL |
| TL-S-05 | TL-SJ-04 ↔ TL-OVL-02c | Range picker offers 4 ranges in §B (`1mo/3mo/6mo/12mo`) but ScoreHistoryDrillPanel offers 5 (incl. `all-time`). Inconsistent surface — A5/A6 risk. Drill-panel range change is also local-state-only (TL-OVL-02c note) — picking `all-time` in the drill does not refetch history. | FUNCTIONAL |
| TL-S-06 | TL-PLN-12 / TL-DL-02 | `scenarios.slice(0, 4)` and `decisions.slice(0, 6)` truncate without any "View all" affordance. If a user has >4 scenarios or >6 decisions, the rest are invisible. Bare "+N more decisions in log" footer in §D but no action. | FUNCTIONAL |
| TL-S-07 | TL-CAL-EMPTY | Calendar empty state ("No calendar entries for selected categories within the X-month horizon.") has no ACTION — no "Show longer horizon" / "Reset filters" / "Add a date". Founder rule: empty state without ACTION is flagged. | FUNCTIONAL |
| TL-S-08 | TL-SUB-01 | Capital Efficiency PRC/PCC row renders "—" + "Coming next" — verify per FD-CTA-1: row reads as informational (acceptable) but must not appear interactive (no hover lift, no chevron). If `sw-lift` / `sw-press` classes leak onto this row, it would be a FUNCTIONAL FAIL ("interactive label, dead handler"). | POLISH→FUNCTIONAL |
| TL-S-09 | TL-OVL-01e ("Commit this path") | `commitGoalSeekPath` builds envelope with `type: seekTarget.metric === 'wealthScore' ? 'retirement' : 'custom'`. Picking metric `estate`/`debt`/`gift`/`protection`/`tax` in TL-OVL-01a will commit a `custom` plan rather than the typed plan, breaking PlanRow status (TL-PLN-0x) reconciliation. | FUNCTIONAL |
| TL-S-10 | TL-OVL-01b | GoalSeekSheet target `<input type=number>` has no unit hint and no range validation. Metric `wealthScore` expects 0–100; `netWorth` expects £; `retirement` expects age. Same input handles all — A5 fail (jargon for non-experts). | FUNCTIONAL |
| TL-S-11 | TL-OVL-02f | ScoreHistoryDrillPanel eyebrow says "8 dimensions — weakest first" but per Risk v1.6 spec the dimensions count was reduced to 7. Hardcoded "8" label vs dynamic `dims.length` — A5/A6 conflict if `fq.dims` returns 7 keys. | POLISH→FUNCTIONAL |
| TL-S-12 | TL-OVL-03e | MilestoneDrillPanel "What would push this forward?" card has no ACTION CTA — drill is purely descriptive. Founder ex. #1/#4 ("describe-only modals are A4 FAIL"). May be intentional read-only by spec, but flag for founder confirmation. | FUNCTIONAL |
| TL-S-13 | TL-SJ-12 | "No retirement plan yet — defaults to Forecast. Set a plan in §E to enable Plan-mode overlay." references "§E" — section-letter jargon at user-visible level. A5 fail. Should read "Scenarios & Plans below" or carry an inline "Set a plan" button. | POLISH |
| TL-S-14 | TL-PLN-HEAD / TL-PLN-00 | §E section header purpose copy ("8 plan types · saved scenarios · goal-seek") uses internal-shorthand "goal-seek" at user-visible level — A5 fail; plain-English would be "set a target, see paths". TL-PLN-00 CTA label "Set a plan →" is acceptable. | POLISH |
| TL-S-15 | TL-DL-01c | Decision impact source field is `d.impact.finioScore` — internal field name still uses the legacy `finio` prefix (per FD-NAME-1, locked Sonuswealth). If this field name leaks into any user-visible string or aria-label, it's a FUNCTIONAL FAIL. Display label is "Wealth Score impact" so visible UI is safe; flag for engine-comment sweep (Wave 4 Morph). | POLISH |
| TL-S-16 | TL-PFH-04 (TrackingPill) | "Awaiting data" pill renders when `fundedPct == null` — but the §F.1 card still shows "Funded —%" + greyed bar. **POTENTIAL ANALOGUE OF HOME PlanProgressStrip BUG (08a22c7):** if a plan exists with no saved scenarios, the user sees "0%" + "On track" or similar contradictory pair. Audit: confirm `Awaiting data` + "—%" pair renders coherently in this state. | FUNCTIONAL |
| TL-S-17 | TL-CAL-04 / TL-CAL-04c / TL-CAL-05 | Multiple calendar entries use literal year string in date (`'6 Apr 2027'` baked in for `sipp-iht`). After April 2027 the row still renders this exact string — `daysAway` will go negative but the date label will not roll forward. Engine should own the date. | DEMO-BLOCKING (post-2027-04-06) |
| TL-S-18 | TL-OVL-01a | Metric `<select>` lists `'iht'` as an option (lowercase, abbreviation) — A5 partial fail. Other plan-type options use `Title Case` labels; `iht` should be "IHT exposure" or similar plain-English consistent with the rest. | POLISH |
| TL-S-19 | TL-GM-04 (Goal templates) | `onCreateGoal(t)` calls `onNav('goal-create', { template })` — verify a `goal-create` route/handler exists. If it routes to a generic modal or nowhere, founder ex. #1/#4 (describe-only modal = A4 FAIL) applies. | FUNCTIONAL |
| TL-S-20 | global | Brand string drift — verify zero `Sonuswealth` / `Finio` user-visible strings on Timeline (per FD-NAME-1). Engine comments (`finio-` prefixes, `finioScore` field) are deferred to Wave 4 Morph sweep but visible UI must already be clean. | FUNCTIONAL |
| TL-S-21 | Unused panel files | `src/components/Timeline/NWTrajectoryChart.jsx` + `PlansSection.jsx` are not imported by Timeline.jsx. Either spec calls for them (then this is a missing-element FAIL) or they should be removed/quarantined to keep the build target honest. | POLISH |

---

## COVERAGE MATH (this replaces "99% confident")

Total inventory rows (count at audit time; v1 ≈ 130 including sub-rows).

```
Coverage  = (rows with verdict ≠ UNVERIFIED) / (total rows)
Pass rate = (rows PASS) / (rows PASS + rows FAIL)
```

A pass is **complete** only when Coverage = 100% (every row has a verdict).
The audit **terminates** per the runbook stopping rule — not at a round number.
"99% confident" is only a legitimate claim when Coverage = 100% and it is restated as:
*"X of Y rows verified PASS; Z FAIL, all POLISH-severity and backlogged."*

---

*— end timeline-screen-element-inventory-v1.md —*
