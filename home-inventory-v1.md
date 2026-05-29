# Home Screen — Element Inventory v1

**Screen:** Sonuswealth Home (build target: React in `src/screens/HomeScreen.jsx`)
**Design baseline:** `13-home-whatif.html` (Home v2.9 + What-If overlay merge)
**Reconciliation baseline:** engine — `rules-uk.js` / `src/engine/fq-calculator.js` (+ `timeline-engine.js`)
**Intent reference (NOT a conformance target):** `2-Product-home-v1_4.md` — stale; use only for engine fn names, plain-English standard, FCA framing.
**Date:** 17 May 2026

---

## Why this file exists

This is the **fixed target** the whole audit measures against. Every interactive or
data-bearing element on Home is one numbered row. The audit does not "find mistakes" —
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

## Confirmed founder decisions (auditors treat these as fixed — do NOT flag against the stale spec)

| FD | Decision |
|----|----------|
| FD-NAME-1 | **Product name is `Sonuswealth` (D-NAME-2, locked 9 May 2026 — supersedes Sonuswealth and Finio).** Source of truth: `src/config/brand.js` (`BRAND.name`). Casing: logo / wordmark = `sonuswealth` (lowercase, see `BRAND.nameDisplay`); body text, titles, aria-labels, page `<title>`, score strings = `Sonuswealth` (sentence case); marketing slogans (footer-tier only) may use ALL CAPS. Every `Sonuswealth` or `Finio` in user-facing strings = FUNCTIONAL FAIL (A5/A6). Engine-module disclaimers + comments are queued for Wave 4 Morph sweep. |
| FD-CROSS-1 | **Every critical action is a surface-instance, not a pointer.** Each surface presents the *angle it owns* with its own layout and its own data evidence; cross-surface links are explicit. One canonical surface owns *the doing*; the others own attention / consequence / time / cash-effect / shock-test. The drill-rule (A3) is satisfied when each instance drills to *its own* angle's detail; only the canonical surface must be reachable in one tap from anywhere. Supersedes the "drill here only" wording in FD-MM-2. |
| FD-LOGO-1 | Brand assets live at `G:\My Drive\All Work\6.Finio\1-Clusters\Codex UI\deliverables\sonuswealth-site\assets\{favicons,logo,mascot,videos}`. Conformance-auditor checks that every surface uses the right logo variant per theme (light/dark) and flags the faded-purple dark variant as DEMO-BLOCKING wherever it appears below WCAG AA contrast. |
| FD-MASCOT-1 | Mascot is **Sonnu (owl)**, 6 life-stage forms: Starting Out · Growing Wealth · Planning Ahead · Peak Complexity · Securing Tomorrow · Leaving a Legacy. Placement on screens is **Wave 7 enhancement scope**, not in-audit; audit treats absence of Sonnu as not-a-finding. |
| FD-1 | **What-If section is RETAINED** and must support **more than 5 scenarios** (expandable / "see all"). The stale spec v1.4 does not zone it — ignore the spec on this point. |
| FD-2 | Screen **layout order is FROZEN** for the audit (Waves 0–6). No new components. "More info on Home" + What-If-per-bucket are Wave 7. |
| FD-3 | Home v2.9 layout (4 anchors · radar · actions · What-If · plan strip · footer) is the structural baseline. The spec's Z0/Z2/Z5-chart/Z6-ring/Z13-Z15 are **out of scope** — they are not in v2.9. |

---

## ELEMENT TABLE

> `Owns-subject destination` is the **expected** A3/A4 target — the auditor checks the
> build against this. Where it reads "dedicated panel," a coherent in-context drill
> (overlay or sub-screen) is acceptable; a bare tab-jump is not.

### Region 1 — Shell / chrome

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| H-CHR-01 | Sidebar nav — Home | NAV | self (active state) | UNVERIFIED | |
| H-CHR-02 | Sidebar nav — My Money | NAV | My Money screen | UNVERIFIED | |
| H-CHR-03 | Sidebar nav — Cashflow | NAV | Cashflow screen | UNVERIFIED | |
| H-CHR-04 | Sidebar nav — Tax & Estate | NAV | Tax & Estate screen | UNVERIFIED | |
| H-CHR-05 | Sidebar nav — Risk | NAV | Risk screen | UNVERIFIED | |
| H-CHR-06 | Sidebar nav — Timeline | NAV | Timeline screen | UNVERIFIED | |
| H-CHR-07 | Sidebar nav — Ask Sonu | NAV | Ask Sonu surface | UNVERIFIED | |
| H-CHR-08 | Persona switcher ("Switch persona →") | ACTION | persona-select control | UNVERIFIED | demo-only; confirm in/out of demo scope |
| H-CHR-09 | Data-freshness pill ("sources fresh · synced 2h") | DATA | SOURCE — data-sync detail | UNVERIFIED | reconcile "2h" to real sync state |
| H-CHR-10 | Topbar score chip (47 + sparkline) | DATA | SOURCE — Wealth Score breakdown | UNVERIFIED | must equal H-ANCH-02 value |
| H-CHR-11 | Bell / notifications icon | NAV | notifications surface | UNVERIFIED | |
| H-CHR-12 | Settings (⚙) icon | NAV | Settings surface | UNVERIFIED | |

### Region 2 — Masthead + mode row

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| H-MAST-01 | Greeting + name + date | DATA | NA (display) | UNVERIFIED | date must be live, not hardcoded "Fri 15 May" |
| H-MAST-02 | Mode button — Today | ACTION | mode state = today | UNVERIFIED | |
| H-MAST-03 | Mode button — Future | ACTION | mode state = future (radar/brief switch to `data-when=future`) | UNVERIFIED | |
| H-MAST-04 | Mode button — Plan | ACTION | mode state = plan (`data-when=plan`) | UNVERIFIED | reconcile with H-PLAN-01 "no active plan" |
| H-MAST-05 | Mode button — What if | ACTION | scrolls/opens What-If section (FD-1) | UNVERIFIED | |

### Region 3 — Anchors (4)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| H-ANCH-01 | Net Worth anchor (£3.63m) | ANCHOR | SOURCE — My Money asset breakdown | UNVERIFIED | `netWorth(e)`; **format: £3.63m here vs £3.63M in radar — A6 conflict** |
| H-ANCH-01a | NW sparkline + "+£180K in 6m" | DATA | SOURCE — NW history | UNVERIFIED | reconcile to history fn |
| H-ANCH-01b | "↑ £42K this week" delta | DATA | SOURCE — recent change detail | UNVERIFIED | |
| H-ANCH-01c | Composition bar — Pensions 42% | DATA | SOURCE — My Money, pensions | UNVERIFIED | each segment drillable |
| H-ANCH-01d | Composition bar — Home 28% | DATA | SOURCE — My Money, property | UNVERIFIED | |
| H-ANCH-01e | Composition bar — ISA 23% | DATA | SOURCE — My Money, ISA | UNVERIFIED | |
| H-ANCH-01f | Composition bar — Cash 7% | DATA | SOURCE — My Money, cash | UNVERIFIED | |
| H-ANCH-02 | Wealth Score anchor (47/100) | ANCHOR | SOURCE — score breakdown / radar detail | UNVERIFIED | `calcFQ(e)`; must equal H-CHR-10 + radar centre |
| H-ANCH-02a | Score donut (target 68 · gap 21) | DATA | SOURCE — score-vs-target detail | UNVERIFIED | reconcile target to engine, not hardcoded |
| H-ANCH-02b | "Established · 84 data points" | DATA | SOURCE — data-completeness detail | UNVERIFIED | |
| H-ANCH-03 | Risk anchor (56/100) | ANCHOR | SOURCE — Risk screen | UNVERIFIED | `calcRisk(e)` |
| H-ANCH-03a | Risk gauge (Conservative/Balanced/Aggressive) | DATA | SOURCE — Risk screen | UNVERIFIED | |
| H-ANCH-03b | "⚠ 3 gaps in radar →" link (`#gaps-link`) | ACTION | SOURCE — radar weak dimensions | UNVERIFIED | "3 gaps" must equal red `!` count on radar |
| H-ANCH-04 | Cost of Inaction anchor (£340K) | ANCHOR | SOURCE — Tax & Estate CoI breakdown | UNVERIFIED | **canonical `totalCoI` — NOT legacy `costOfInaction` stub** |
| H-ANCH-04a | "326 days to act" (`#coi-days-label`) | DATA | SOURCE — deadline detail | UNVERIFIED | `daysLeft()`; must be live, not hardcoded |
| H-ANCH-04b | CoI timeline bar (Today → 6 Apr 2027) | DATA | SOURCE — CoI projection | UNVERIFIED | |
| H-ANCH-04c | "SIPP enters estate … £610K by 2031" | DATA | SOURCE — CoI projection | UNVERIFIED | **£610K here vs £612K in radar insight — A6 conflict** |

### Region 4 — "Your wealth shape" radar card

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| H-RAD-00 | Card chevron "See all 7 dimensions" (`#btn-radar-detail`) | ACTION | SOURCE — all-dimensions detail | UNVERIFIED | |
| H-RAD-01 | Radar node — Habits (95) | DATA | dimension drill → owning tab | UNVERIFIED | `data-dim`; → `openDimDrill` |
| H-RAD-02 | Radar node — Own (78) | DATA | dimension drill → My Money | UNVERIFIED | |
| H-RAD-03 | Radar node — Tax (61) | DATA | dimension drill → Tax & Estate | UNVERIFIED | |
| H-RAD-04 | Radar node — Safety (0) | DATA | dimension drill → Risk | UNVERIFIED | |
| H-RAD-05 | Radar node — Flow (88) | DATA | dimension drill → Cashflow | UNVERIFIED | |
| H-RAD-06 | Radar node — Debt (71) | DATA | dimension drill → My Money / Cashflow | UNVERIFIED | |
| H-RAD-07 | Radar node — Legacy (18) | DATA | dimension drill → Tax & Estate | UNVERIFIED | |
| H-RAD-08 | Radar red "!" markers (×3) | DATA | SOURCE — weak-dimension detail | UNVERIFIED | count must equal H-ANCH-03b "3 gaps" |
| H-RAD-09 | Radar centre (NW £3.63M / Score 47) | DATA | NA (echo of anchors) | UNVERIFIED | **must match H-ANCH-01/02 incl. format** |
| H-RAD-10 | Brief insight 1 — protection (`#btn-review-protection`) | ACTION | ACTION — protection review | UNVERIFIED | "lifts Score 47→51" must reconcile |
| H-RAD-11 | Brief insight 2 — drawdown (`#btn-start-drawdown`) | ACTION | ACTION — pension drawdown panel | UNVERIFIED | see H-ACT-01; **same action, must route the same place** |
| H-RAD-12 | Brief insight 3 — legacy (`#btn-fix-legacy`) | ACTION | ACTION — legacy/will flow | UNVERIFIED | |
| H-RAD-13 | Brief mode variants (today/future/plan/whatif text) | DATA | NA | UNVERIFIED | each variant's figures must reconcile |
| H-RAD-14 | Brief rotation dots / "Insight 1 of 3" | ACTION | cycles insight | UNVERIFIED | |
| H-RAD-15 | "Drag any point to test what-if" | ACTION | DECISION — radar simulate | UNVERIFIED | drag must produce a real recompute, not a static label |

### Region 5 — "What to do next" actions card

> A3 principle: an action drills to the surface that **owns the action**, not the surface
> that owns its *consequence*. Drawdown is a pension action → pension surface, even though
> its consequence is IHT (T&E).

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| H-ACT-00 | Actions header "6 · ranked by impact" | DATA | NA | UNVERIFIED | count must equal actual rows; "ranked" must be true |
| H-ACT-01 | Action — Start pension drawdown (+34) | ACTION | ACTION — dedicated pension/SIPP drawdown panel (My Money) | UNVERIFIED | **HTML routes → T&E; build routes → Cashflow; both WRONG (founder ex. #5)** |
| H-ACT-02 | Action — Arrange life insurance in trust (+8) | ACTION | ACTION — protection flow (Risk) | UNVERIFIED | HTML routes → "Ask Sonu" — verify that is a real coherent landing |
| H-ACT-03 | Action — Consider pension consolidation (+3) | ACTION | ACTION — pension consolidation (My Money) | UNVERIFIED | HTML → My Money; **inconsistent with H-ACT-01 routing** |
| H-ACT-04 | Action — Use £20K ISA allowance (+2) | ACTION | ACTION — ISA contribution (My Money) | UNVERIFIED | |
| H-ACT-05 | Action — Use £3K CGT allowance (+1) | ACTION | ACTION — CGT/bed-and-ISA (Tax & Estate) | UNVERIFIED | |
| H-ACT-06 | Action — Write a basic will (Estate +18) | ACTION | ACTION/DECISION — will flow (Tax & Estate) | UNVERIFIED | HTML → "Ask Sonu" — verify coherent |
| H-ACT-0x | Each row's "Show me how" CTA | ACTION | must reach an ACTION/DECISION, not a generic modal | UNVERIFIED | founder ex. #1/#4 — modal that only describes is a FAIL on A4 |
| H-ACT-0y | Each row's impact figure (+34/+8/…) | DATA | SOURCE — score-impact basis | UNVERIFIED | must reconcile to engine, not hardcoded |
| H-ACT-0z | Each row expand/collapse chevron | ACTION | expands body | UNVERIFIED | |

### Region 6 — What-If section (FD-1: retained + expandable)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| H-WI-00 | What-If header "Explore · not advice" | DATA | NA | UNVERIFIED | FCA framing check (A5) |
| H-WI-01 | Scenario — relocate | SCENARIO | DECISION — scenario engine, 4 options | UNVERIFIED | must project current→target over the stated horizon |
| H-WI-02 | Scenario — bigger house | SCENARIO | DECISION — scenario engine, 4 options | UNVERIFIED | |
| H-WI-03 | Scenario — retire 5y earlier | SCENARIO | DECISION — scenario engine, 4 options | UNVERIFIED | tagged "Instant" — verify instant vs Ask-Sonu behaviour |
| H-WI-04 | Scenario — part-time / break | SCENARIO | DECISION — scenario engine, 4 options | UNVERIFIED | |
| H-WI-05 | Scenario — help children | SCENARIO | DECISION — scenario engine, 4 options | UNVERIFIED | |
| H-WI-06 | "See all / more scenarios" affordance | ACTION | expandable list >5 (FD-1) | UNVERIFIED | **screenshot shows "See all 12" — verify it exists & works** |
| H-WI-07 | Free-form what-if input + "Ask Sonu →" | ACTION | DECISION — scenario engine / Ask Sonu | UNVERIFIED | |

### Region 7 — Plan strip + footer

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| H-PLAN-01 | Plan strip body ("No active plan yet") | DATA | NA | UNVERIFIED | **build screenshot shows stray "0%" bar — reconcile** |
| H-PLAN-02 | "Set plan →" (`#btn-set-plan`) | ACTION | DECISION — plan creation | UNVERIFIED | copy says "Plan tab" but **no Plan in nav** — plans live in Timeline §E; reconcile |
| H-FOOT-01 | Trust line | DATA | NA | UNVERIFIED | A5 |
| H-FOOT-02 | FCA boundary line | DATA | NA | UNVERIFIED | A5 — must be present on every state |

### Region 8 — Overlays (reached from Home, in scope)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| H-OVL-01 | Dimension drill overlay | OVERLAY | shows what/why/gaps/improves + nav to owning tab | UNVERIFIED | nav target per `DIM_TAB` — verify each of 7 |
| H-OVL-02 | What-If scenario overlay (4-option engine) | OVERLAY | A/B/C/D options, each actionable, current-financials-bound, time-projected | UNVERIFIED | founder ex. #3 |
| H-OVL-03 | Action-detail modal | OVERLAY | must lead to a real ACTION/DECISION surface | UNVERIFIED | currently a describe-only modal — A4 risk |
| H-OVL-04 | Gaps toast | OVERLAY | SOURCE — radar gaps | UNVERIFIED | |

---

## SEED FINDINGS (pre-identified — agents start with these, then extend)

These are *already known* from reading the HTML, the build screenshots, and the founder's
examples. They are not the list — they are the proof the method works. Agents must
confirm each, assign severity, and find the rest.

| Seed | Element(s) | Issue | Likely severity |
|------|-----------|-------|-----------------|
| S-01 | H-ACT-01 | Pension drawdown routes to Cashflow (build) / T&E (HTML); should be a pension surface | DEMO-BLOCKING |
| S-02 | H-ACT-01/03 | Two pension actions route to different surfaces — no "owns-subject" principle applied | FUNCTIONAL |
| S-03 | H-ACT-0x / H-OVL-03 | "Show me how" reaches a describe-only modal, not an ACTION/DECISION (founder ex. #1/#4) | DEMO-BLOCKING |
| S-04 | H-ANCH-04 ↔ H-ACT-01 | CoI pill value does not reconcile to the pension-drawdown action it depends on (founder ex. #5) | DEMO-BLOCKING |
| S-05 | H-ANCH-04c ↔ H-RAD-11 | CoI 2031 figure shown as £610K and £612K on the same screen | FUNCTIONAL |
| S-06 | H-ANCH-01 ↔ H-RAD-09 | Net Worth formatted £3.63m vs £3.63M — `fmt()` not applied uniformly | POLISH→FUNCTIONAL |
| S-07 | H-PLAN-01 | Build shows a stray unlabelled "0%" progress bar with no active plan | FUNCTIONAL |
| S-08 | H-PLAN-02 | Copy references a "Plan tab" that does not exist in nav | FUNCTIONAL |
| S-09 | global | Brand string drift (Sonuswealth vs Sonuswealth) — CLI task T6 confirms it exists | FUNCTIONAL |
| S-10 | H-WI-06 | "See all 12" scenarios affordance — verify it exists and expands (FD-1) | FUNCTIONAL |
| S-11 | H-OVL-02 | What-If options must be time-projected (relocate-in-3-years projects the path), not static | DEMO-BLOCKING |

---

## COVERAGE MATH (this replaces "99% confident")

Total inventory rows (count at audit time; v1 ≈ 60 including sub-rows).

```
Coverage  = (rows with verdict ≠ UNVERIFIED) / (total rows)
Pass rate = (rows PASS) / (rows PASS + rows FAIL)
```

A pass is **complete** only when Coverage = 100% (every row has a verdict).
The audit **terminates** per the runbook stopping rule — not at a round number.
"99% confident" is only a legitimate claim when Coverage = 100% and it is restated as:
*"X of Y rows verified PASS; Z FAIL, all POLISH-severity and backlogged."*

---

*— end home-screen-element-inventory-v1.md —*
