# Tax & Estate Screen — Element Inventory v1

**Screen:** Sonuswealth Tax & Estate (build target: React in `src/screens/TaxEstate.jsx`)
**Design baseline:** none provided — the React component IS the structural truth (per inventory-builder rule).
**Reconciliation baseline:** engine — `src/engine/fq-calculator.js` (facade) + `src/engine/modules/uk-estate-2026-1-1.js` + `src/engine/modules/uk-tax-2026-1-1.js` + `src/engine/modules/UK-2026.1.1.json`
**Intent reference (NOT a conformance target):** `2-Product/2-Product-tax-estate-v1_6.md`
**Date:** 17 May 2026

---

## Why this file exists

This is the **fixed target** the whole audit measures against. Every interactive or
data-bearing element on Tax & Estate is one numbered row. The audit does not "find
mistakes" — it walks this list and records a verdict per row. That is the only thing
that makes "99% confident" a real statement: it means *N of M rows verified PASS*, not
a feeling.

**This file is the worksheet.** Auditor agents fill the `Verdict` columns. Do not add
or remove rows except via the "inventory drift" rule in the runbook. If the build
contains an element not listed here, that is itself a finding (`UNLISTED`).

---

## The six assertions (every row is tested against all six)

| # | Assertion | Fails when… |
|---|-----------|-------------|
| A1 | **Identified** — element exists in the build and matches this row | Element missing from build, or build has an element not in this inventory |
| A2 | **Drillable** — if it is a number, action, or nav element, interacting with it does something | Tapping is dead / no handler / no visible response |
| A3 | **Destination correct** — it resolves to the surface that **owns its subject** | A pension action lands on Cashflow; a tax number lands on Risk; etc. |
| A4 | **Destination coherent** — the landing is a usable continuation: it shows the SOURCE, an ACTION, or a DECISION | Lands on a generic modal, a dead-end, a screen top with no context, or an unrelated view |
| A5 | **Plain English** — label + any explainer readable by a non-expert in one pass; jargon translated; information-not-advice (FCA) | Unexplained jargon (BPR/RNRB/NRB/APR/FIG/TRF/LPA/taper) without inline explainer; advice-phrased copy; figure with no plain meaning |
| A6 | **Reconciled** — every number traces to an engine function and matches value + format everywhere it appears | Hardcoded number; `fmt()` not used; same metric shows two values/formats; CoI does not equal `totalCoI(e)` |

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
| FD-NAME-1 | **Product name is `Sonuswealth` (D-NAME-2, locked 9 May 2026 — supersedes Sonuswealth and Finio).** Source of truth: `src/config/brand.js` (`BRAND.name`). Casing: logo / wordmark = `sonuswealth` (lowercase); body text, titles, aria-labels, score strings = `Sonuswealth` (sentence case). Every `Sonuswealth` or `Finio` in user-facing strings = FUNCTIONAL FAIL (A5/A6). |
| FD-LOGO-1 | Brand assets live at `G:\My Drive\All Work\6.Finio\1-Clusters\Codex UI\deliverables\sonuswealth-site\assets\{favicons,logo,mascot,videos}`. Conformance-auditor checks that every surface uses the right logo variant per theme. |
| FD-MASCOT-1 | Mascot is **Sonnu (owl)**, 6 life-stage forms. Placement on screens is **Wave 7 enhancement scope**, not in-audit; audit treats absence of Sonnu as not-a-finding. |
| FD-CROSS-1 | **Tax & Estate owns the *consequence* for pension/SIPP/drawdown** — IHT £ stacking over time, 6 Apr 2027 SIPP-IHT effective date, year-by-year estate-tax projection. Canonical drawdown "doing" surface is My Money; T&E shows the if-you-don't view. Each surface owns its angle; cross-surface links are explicit. CoI on T&E must equal the CoI number on Home (H-ANCH-04) and the CoI number on MyMoney — same value, same format. |
| FD-TE-1 | **SIPP IHT is ENACTED 2026** (Royal Assent 18 March 2026, effective 6 April 2027). Confirm in `src/engine/modules/UK-2026.1.1.json`. Any UI text that says "PROPOSED" for SIPP IHT is a seed finding. The build already renders an "Enacted · FA 2026" chip next to the Pension-IHT countdown — auditor verifies wording. |

---

## ELEMENT TABLE

> `Owns-subject destination` is the **expected** A3/A4 target — the auditor checks the
> build against this. Where it reads "dedicated panel," a coherent in-context drill
> (overlay or sub-screen) is acceptable; a bare tab-jump is not.

### Region 1 — Shell / chrome / header

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TE-CHR-01 | Back-to-Home button ("← Home") | NAV | Home screen | UNVERIFIED | wired to `onHome` prop |
| TE-CHR-02 | Live-rules pill ("Live · {BRAND.rulesVersion}") | DATA | SOURCE — rules version detail | UNVERIFIED | non-interactive; verify `BRAND.rulesVersion` resolves to UK-2026.1.x, not stale; A6 |
| TE-CHR-03 | X28 top-bar window selector | ACTION | filter state = window | UNVERIFIED | `x28Window` default `current-tax-year`; verify all options change displayed numbers |
| TE-CHR-04 | X28 top-bar view-mode toggle | ACTION | mode state = actual/projection | UNVERIFIED | `viewMode` default `actual`; verify each value affects numbers below |
| TE-CHR-05 | X28 top-bar rules-version + data-date label | DATA | SOURCE — rules version detail | UNVERIFIED | A6 — must equal TE-CHR-02 |
| TE-CHR-06 | Disclaimer footer line (`BRAND.disclaimer`) | DATA | NA | UNVERIFIED | A5 — FCA info-not-advice framing must be present on every state |
| TE-CHR-07 | Disclaimer rules-version + data-date footer | DATA | NA | UNVERIFIED | A6 — must equal TE-CHR-02 / TE-CHR-05 |

### Region 2 — Triple anchor (top-line numbers, every screen)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TE-ANCH-01 | Net Worth anchor | ANCHOR | SOURCE — My Money asset breakdown | UNVERIFIED | wired via `onDrillMetric('netWorth')`; reconcile to `netWorth(e)`; RECONCILE: Home/MyMoney |
| TE-ANCH-02 | Wealth Score anchor (+ delta vs last visit) | ANCHOR | SOURCE — score breakdown | UNVERIFIED | `calcFQ(e)`; `deltaFQ` computed from `fqSince` snapshot; wired `onDrillMetric('wealthScore')`; RECONCILE: Home topbar / Home anchor |
| TE-ANCH-03 | Risk anchor | ANCHOR | Risk screen | UNVERIFIED | wired `onOpenRisk`; `calcRisk(e)`; RECONCILE: Home |

### Region 3 — Plan staleness banner / accordion

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TE-PLAN-01 | Plan staleness banner (single plan, inline) | DATA | NA / ACTION via Review | UNVERIFIED | renders when exactly 1 plan in `plans` array (estate/gift/tax) is stale; render position differs desktop (above sub-tab) vs mobile (after dual-number) |
| TE-PLAN-02 | Plan staleness accordion header ("N plan reviews due") | ACTION | expands list | UNVERIFIED | renders when ≥2 stale plans; D-TE-PLAN-ANTI-NAGGER-1 |
| TE-PLAN-03 | Plan-list summary line in accordion (label · label · label) | DATA | NA | UNVERIFIED | each plan label: Estate / Gifting / Tax |
| TE-PLAN-04 | Accordion expand chevron | ACTION | toggles open | UNVERIFIED | |
| TE-PLAN-05 | "Review" pill per plan (Estate / Gifting / Tax) | ACTION | DECISION — plan-review surface | UNVERIFIED | wired `onDrillMetric('plan:estate' / 'plan:gift' / 'plan:tax')`; verify each destination exists |

### Region 4 — Sub-tab segmented control (Tax | Estate)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TE-TAB-01 | Sub-tab "Tax" | ACTION | sub-tab state = tax | UNVERIFIED | persisted to `localStorage[sonuswealth.te.subTab]` |
| TE-TAB-02 | Sub-tab "Estate" | ACTION | sub-tab state = estate | UNVERIFIED | smart-default: estate unless pre-decum + no IHT due |
| TE-TAB-03 | Tax tab badge (open-action count) | DATA | SOURCE — list of open tax actions | UNVERIFIED | computed: ISA remaining / CGT remaining / dividend used / 60% taper |
| TE-TAB-04 | Estate tab badge (open-action count) | DATA | SOURCE — list of open estate actions | UNVERIFIED | computed: no will / no LPA / cohabiting red / missing nominees |

### Region 5 — Sub-anchor strip (3 cells, swaps by sub-tab)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TE-SUB-T1 | Tax sub-anchor A — "YTD tax" | DATA | SOURCE — `te_taxThisYear` breakdown | UNVERIFIED | non-interactive (no `onTap`); A2 fails if tapping does nothing |
| TE-SUB-T1a | YTD tax DiffBadge (vs last snapshot) | DATA | SOURCE — change history | UNVERIFIED | reads `taxSince` from snapshot |
| TE-SUB-T2 | Tax sub-anchor B — "ANI" | DATA | SOURCE — ANI 6-step computation | UNVERIFIED | non-interactive; should drill to TE-TAX-ANI-* |
| TE-SUB-T2a | ANI taper-band warning ("⚠ 60% taper band") | DATA | NA | UNVERIFIED | shows when ANI in £100k–£125,140 |
| TE-SUB-T3 | Tax sub-anchor C — "Allowances %" | DATA | SOURCE — allowance tracker | UNVERIFIED | non-interactive; A2 — should likely drill to AllowanceDrillPanel |
| TE-SUB-E1 | Estate sub-anchor A — "IHT today" | DATA | SOURCE — IHTDrillPanel | UNVERIFIED | non-interactive (no `onTap`); A2 — IHT figure should be drillable |
| TE-SUB-E2 | Estate sub-anchor B — "Family receives" | DATA | SOURCE — BeneficiaryChain / IHTDrillPanel | UNVERIFIED | non-interactive |
| TE-SUB-E3 | Estate sub-anchor C — "Pension-IHT countdown (N days)" | ACTION | SOURCE — IHTDualNumber card (scrollIntoView) | UNVERIFIED | wired `onTap=scrollToIHTDual`; verify scroll lands on TE-EST-IHT-* card |
| TE-SUB-E3a | "Enacted · FA 2026" status chip on E3 | DATA | NA | UNVERIFIED | A5 — FD-TE-1 verification; non-interactive title="Royal Assent 18 Mar 2026 — effective 6 Apr 2027" |
| TE-SUB-E3b | E3 sub-line "Until 6 Apr 2027 · Finance Act 2026" | DATA | NA | UNVERIFIED | A5 |

### Region 6 — NRI / cross-border notice (conditional)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TE-NRI-01 | NRI banner (renders when `entity.type === 'nri'`) | DATA | NA | UNVERIFIED | A5 — verify copy is plain English; flags India bundle gap |

---

## TAX SUB-TAB

### Region 7 — Tax summary card (§5.3 / §5.4)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TE-TAX-SUM-01 | Card title "This year — tax position" | DATA | NA | UNVERIFIED | |
| TE-TAX-SUM-02 | Sub-line "Gross X · ANI Y · Effective rate Z" | DATA | SOURCE — `te_taxThisYear` + `calcANI` | UNVERIFIED | A6 — reconcile to engine |
| TE-TAX-SUM-03 | ProvenanceChip (HMRC bands UK-2026.1 + sources) | DATA | SOURCE — provenance modal | UNVERIFIED | verify chip is interactive |
| TE-TAX-SUM-04 | Tile — Income tax (YTD) | DATA | SOURCE — IncomeTaxDetail | UNVERIFIED | non-interactive; A2 — should drill |
| TE-TAX-SUM-05 | Tile — Dividend tax | DATA | SOURCE — DividendDetail | UNVERIFIED | non-interactive |
| TE-TAX-SUM-06 | Tile — CGT | DATA | SOURCE — CGTDetail / CGTDrillPanel | UNVERIFIED | non-interactive |
| TE-TAX-SUM-07 | Tile — NIC | DATA | SOURCE — `te_nicsDetail` | UNVERIFIED | non-interactive |
| TE-TAX-SUM-08 | Total-tax-this-year strip | DATA | SOURCE — IncomeTaxDetail | UNVERIFIED | A6 — must reconcile to sum of tiles; non-interactive |

### Region 8 — Income tax detail (§5.5 + §5.5.2)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TE-TAX-IT-01 | Card title "Income tax detail" + sub | DATA | NA | UNVERIFIED | sub identifies Scottish/Welsh/rUK bands |
| TE-TAX-IT-02 | ExplainerChip TE-1 (IHT/tax explainer) | ACTION | SOURCE — explainer overlay | UNVERIFIED | wired to shared ExplainerChip id="TE-1"; verify content covers SIPP-IHT enacted |
| TE-TAX-IT-03 | 60% taper warning banner | DATA | NA | UNVERIFIED | renders when ANI 100k–`TAX.art` (125,140); A5 — plain English |
| TE-TAX-IT-04 | Stepped marginal-rate vertical bars chart | DATA | SOURCE — `te_incomeTaxDetail` bands | UNVERIFIED | non-interactive; A2 — bars should be hoverable/drillable |
| TE-TAX-IT-05 | Per-band row(s) — label + rate + amount + bar | DATA | SOURCE — band-detail | UNVERIFIED | one row per band; non-interactive; A6 reconcile to engine; **band names use raw `_` separators (e.g. `basic_rate`) — A5 jargon risk** |

### Region 9 — ANI stepwise (§5.5.3 — UK-IT-19)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TE-TAX-ANI-01 | Card title "Adjusted Net Income (ANI)" + sub "UK-IT-19" | DATA | NA | UNVERIFIED | A5 — "UK-IT-19" is jargon code; should have plain-English explainer |
| TE-TAX-ANI-02 | Row 1 — "Total taxable income" | DATA | SOURCE | UNVERIFIED | non-interactive |
| TE-TAX-ANI-03 | Row 2 — "Add: grossed-up gift aid (×1.25)" | DATA | SOURCE | UNVERIFIED | |
| TE-TAX-ANI-04 | Row 3 — "Less: pension contributions" | DATA | SOURCE | UNVERIFIED | |
| TE-TAX-ANI-05 | Row 4 — "Less: trade losses" | DATA | SOURCE | UNVERIFIED | |
| TE-TAX-ANI-06 | Row 5 — "Less: qualifying interest paid" | DATA | SOURCE | UNVERIFIED | |
| TE-TAX-ANI-07 | Row 6 — "Adjusted Net Income" (bold total) | DATA | SOURCE | UNVERIFIED | A6 — must equal TE-SUB-T2 value |

### Region 10 — Salary sacrifice optimiser (§5.6)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TE-TAX-SS-01 | Card title "Salary sacrifice optimiser" + NIC saving sub | DATA | NA | UNVERIFIED | renders only when salary > 0 |
| TE-TAX-SS-02 | Sacrifice amount label + value | DATA | NA | UNVERIFIED | live updates with slider |
| TE-TAX-SS-03 | Slider input (0 → min(60k, salary)) | ACTION | DECISION — sacrifice scenario | UNVERIFIED | local state only; does NOT persist or push to engine; A2/A4 — verify it changes downstream numbers, not just the in-card label |
| TE-TAX-SS-04 | 2029 NIC cap horizon warning | DATA | NA | UNVERIFIED | renders when `horizon.show_horizon_warning`; A5 — plain English |

### Region 11 — CGT detail card (§5.7)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TE-TAX-CGT-01 | Card title "Capital Gains Tax" + sub | DATA | NA | UNVERIFIED | |
| TE-TAX-CGT-02 | Annual exemption progress bar (used/total) | DATA | SOURCE — CGTDrillPanel | UNVERIFIED | non-interactive |
| TE-TAX-CGT-03 | Tile — Tax due | DATA | SOURCE — CGTDrillPanel | UNVERIFIED | |
| TE-TAX-CGT-04 | Tile — Carry-forward losses | DATA | SOURCE | UNVERIFIED | |
| TE-TAX-CGT-05 | Chip — "BADR 14% → 18% in 2026/27" | DATA | NA | UNVERIFIED | A5 — "BADR" jargon (Business Asset Disposal Relief) — verify inline explainer |
| TE-TAX-CGT-06 | Chip — "Bed-and-ISA opportunity" | ACTION | ACTION — bed-and-ISA flow | UNVERIFIED | rendered as Chip; non-interactive in source — should be CTA |
| TE-TAX-CGT-07 | Chip — "Spousal transfer headroom" | DATA | NA | UNVERIFIED | non-interactive; A2 — should drill |
| TE-TAX-CGT-08 | "Detail ›" L3 chip → CGTDrillPanel | ACTION | SOURCE — CGT breakdown | UNVERIFIED | wired `setDrillView('cgt')` |

### Region 12 — Dividend detail (§5.8)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TE-TAX-DIV-01 | Card title "Dividend tax" + sub w/ effective rate + GIA | DATA | NA | UNVERIFIED | sub uses raw `£X.toLocaleString()` not `fmt()` — A6 format inconsistency |
| TE-TAX-DIV-02 | Dividend allowance progress bar | DATA | SOURCE | UNVERIFIED | |
| TE-TAX-DIV-03 | Chip — "Basic 10.75%" | DATA | NA | UNVERIFIED | A5 — rate jargon needs context; reconcile to engine |
| TE-TAX-DIV-04 | Chip — "Higher 35.75%" | DATA | NA | UNVERIFIED | A6 — these rates hardcoded in JSX; must trace to UK-2026.1.1.json |
| TE-TAX-DIV-05 | Chip — "Add'l 39.35%" | DATA | NA | UNVERIFIED | A6 — hardcoded |
| TE-TAX-DIV-06 | Tax paid strip | DATA | SOURCE | UNVERIFIED | non-interactive |
| TE-TAX-DIV-07 | "Move to ISA saves £X / year" banner | ACTION | ACTION — move-to-ISA flow | UNVERIFIED | renders as info banner — A2 should be CTA; verify destination |

### Region 13 — Allowances strip (§5.9)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TE-TAX-ALL-01 | Card title "Allowance utilisation" + composite % sub | DATA | NA | UNVERIFIED | A6 — composite must equal TE-SUB-T3 |
| TE-TAX-ALL-02 | Row — ISA | DATA | SOURCE — AllowanceDrillPanel/ISA | UNVERIFIED | non-interactive |
| TE-TAX-ALL-03 | Row — PSA | DATA | SOURCE — AllowanceDrillPanel/PSA | UNVERIFIED | A5 — "PSA" jargon (Personal Savings Allowance) |
| TE-TAX-ALL-04 | Row — CGT | DATA | SOURCE | UNVERIFIED | |
| TE-TAX-ALL-05 | Row — Dividend | DATA | SOURCE | UNVERIFIED | |
| TE-TAX-ALL-06 | Row — Pers. Allow | DATA | SOURCE | UNVERIFIED | A5 — "Pers. Allow" abbreviated label |
| TE-TAX-ALL-07 | Cash-ISA £12k cap horizon banner | DATA | NA | UNVERIFIED | A6 — "£12,000" + "6 Apr 2027" + "£8,000" hardcoded in JSX; must trace to UK-2026.1.1.json; A5 — "S&S, IFISA, or LISA" jargon |
| TE-TAX-ALL-08 | "Detail ›" L3 chip → AllowanceDrillPanel | ACTION | SOURCE — allowance breakdown | UNVERIFIED | wired `setDrillView('allowances')` |

### Region 14 — Self Assessment (§5.10)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TE-TAX-SA-01 | Card title "Self Assessment" + SA100 deadline | DATA | NA | UNVERIFIED | A6 — deadline fallback hardcoded `'2027-01-31'` if engine returns null; A5 — "SA100" jargon |
| TE-TAX-SA-02 | Tile — Balance due | DATA | SOURCE | UNVERIFIED | non-interactive |
| TE-TAX-SA-03 | Tile — Filing required? + reason | DATA | SOURCE | UNVERIFIED | non-interactive |

### Region 15 — Drawdown matrix (§5.11 / Q2.2)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TE-TAX-DD-01 | Card title "Drawdown matrix" + recommended/guardrail sub | DATA | NA | UNVERIFIED | per FD-CROSS-1: drawdown DOING surface is MyMoney/Cashflow — T&E shows consequence (IHT saved); verify card frames it that way |
| TE-TAX-DD-02 | Sticky header row (Drawdown · Tax · Net · IHT saved) | DATA | NA | UNVERIFIED | |
| TE-TAX-DD-03 | Drawdown row (per entry) | DATA | SOURCE — drawdown scenario | UNVERIFIED | non-interactive; A2 — rows should be tappable for scenario projection |
| TE-TAX-DD-04 | Row — current-drawdown highlight (amber glow) | DATA | NA | UNVERIFIED | matches user's existing drawdown ±2500 |
| TE-TAX-DD-05 | Row — recommended-drawdown highlight (mint tint) | DATA | NA | UNVERIFIED | |
| TE-TAX-DD-06 | Row — 60% band highlight (coral tint) | DATA | NA | UNVERIFIED | when 100k ≤ drawdown ≤ `TAX.art` |
| TE-TAX-DD-07 | "60%" pulsing chip on in-depth rows | DATA | NA | UNVERIFIED | A5 — chip says "60%" only; needs explainer "effective rate due to PA taper" |
| TE-TAX-DD-08 | IHT-saved column value (per row) | DATA | SOURCE — IHT delta detail | UNVERIFIED | A6 — reconcile to `ihtSippDelta` / engine; non-interactive |

### Region 16 — Non-Dom card (§5.12 — conditional)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TE-TAX-ND-01 | Card title "Non-Dom regime (FIG / TRF)" + sub | DATA | NA | UNVERIFIED | renders only when FIG or TRF eligible; A5 — "FIG" / "TRF" jargon |
| TE-TAX-ND-02 | FIG status block | DATA | SOURCE — `figStatus` | UNVERIFIED | shows status + years remaining |
| TE-TAX-ND-03 | TRF status block | DATA | SOURCE — `trfStatus` | UNVERIFIED | shows rate + deadline |

---

## ESTATE SUB-TAB

### Region 17 — Inheritance Story (§13.9 — primary lead)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TE-EST-IS-01 | Hero eyebrow "If you died today" + intro line | DATA | NA | UNVERIFIED | A5 |
| TE-EST-IS-02 | Line — Gross IHT-relevant estate | DATA | SOURCE — IHTDrillPanel | UNVERIFIED | non-interactive (no `cta`); A6 — reconcile to `te_ihtExposure.gross_estate` |
| TE-EST-IS-03 | Line — Deductions (debts + funeral) | DATA | SOURCE | UNVERIFIED | conditional on totalDeductions > 0 |
| TE-EST-IS-04 | Line — Spouse exemption | DATA | SOURCE | UNVERIFIED | conditional on spouseExempt > 0 |
| TE-EST-IS-05 | Line — NRB + RNRB allowances covered | DATA | SOURCE | UNVERIFIED | A5 — "tax-free band" / "residence allowance" plain phrasing OK |
| TE-EST-IS-06 | Line — Charity 36% rate | DATA | SOURCE | UNVERIFIED | conditional |
| TE-EST-IS-07 | Line — Taxable + IHT due (warn severity) | DATA | SOURCE — IHTDrillPanel | UNVERIFIED | A6 — IHT figure must equal TE-SUB-E1 + TE-EST-IHT-* |
| TE-EST-IS-07a | Line — "Your £325k tax-free band covers everything" | DATA | NA | UNVERIFIED | A6 — **£325k hardcoded in JSX** (line 94 InheritanceStory) — must trace to UK-2026.1.1.json NRB |
| TE-EST-IS-08 | Line — "Family receives approximately £X" | DATA | SOURCE | UNVERIFIED | A6 — reconcile to `beneficiary_value`; equal to TE-SUB-E2 |
| TE-EST-IS-09 | Line — Probate 6–9 months | DATA | NA | UNVERIFIED | A5 — generalisation; verify |
| TE-EST-IS-10 | Line — Beneficiaries with `cta='beneficiaries'` | ACTION | SOURCE — BeneficiaryChain | UNVERIFIED | **DEAD CTA: `InheritanceStory` is rendered without `onDrillMetric` prop in TaxEstate.jsx line 2438 — tap does nothing (A2 FAIL)** |
| TE-EST-IS-11 | Footer hint "Tap any line to see the calculation behind it" | DATA | NA | UNVERIFIED | A5/A2 — copy promises drill, but only beneficiaries line has `cta` and even that is dead; misleading |

### Region 18 — Estate plan badge (§6.2)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TE-EST-PB-01 | Badge eyebrow + target value | DATA | NA | UNVERIFIED | |
| TE-EST-PB-02 | Staleness chip ("Xmo since review") | DATA | NA | UNVERIFIED | non-interactive |
| TE-EST-PB-03 | "No plan yet" warn chip (fallback) | DATA | NA / ACTION | UNVERIFIED | A2 — should be CTA to create plan |

### Region 19 — Estate CoI odometer (§6.3)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TE-EST-COI-01 | CoI odometer total (estatePlanning domain) | DATA | SOURCE — CoI breakdown | UNVERIFIED | **RECONCILE: Home (H-ANCH-04) / MyMoney**. Note: this card shows ONLY the `estatePlanning` domain of CoI — Home's CoI is the **total** across all domains. Verify whether the user-visible labels make that clear (A5/A6 ambiguity). |
| TE-EST-COI-02 | Daily-rate sub-line | DATA | NA | UNVERIFIED | `estCoI / daysLeft()`; A6 — `daysLeft()` reconcile to Home |
| TE-EST-COI-03 | Provenance list ("Estate planning shortfall · RNRB taper loss · Will/LPA gaps") | DATA | SOURCE | UNVERIFIED | A5 |
| TE-EST-COI-04 | byAction breakdown (each domain w/ value > 0) | DATA | SOURCE | UNVERIFIED | each row non-interactive |
| TE-EST-COI-05 | Cascade halo trigger on value change | DATA | NA | UNVERIFIED | visual only |

### Region 20 — IHT dual-number card (§6.4)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TE-EST-IHT-01 | Card title "IHT exposure — dual view" + sub | DATA | NA | UNVERIFIED | |
| TE-EST-IHT-02 | ExplainerChip TE-1 | ACTION | SOURCE — SIPP-IHT explainer | UNVERIFIED | FD-TE-1 — must reflect ENACTED, not PROPOSED |
| TE-EST-IHT-03 | "Today" tile — IHT due number (animated `<Num>`) | DATA | SOURCE — IHTDrillPanel | UNVERIFIED | non-interactive (no onClick on tile); A2 — should drill |
| TE-EST-IHT-04 | "Today" tile — effective rate + family receives sub | DATA | NA | UNVERIFIED | A6 reconcile |
| TE-EST-IHT-05 | "Today" tile — "Confirmed reliefs ✓" chip | DATA | NA | UNVERIFIED | conditional on apr_bpr.allowance_used > 0 |
| TE-EST-IHT-06 | "Today" tile — note line (pre/post-2027 rules indicator) | DATA | NA | UNVERIFIED | A5 |
| TE-EST-IHT-07 | "After 6 Apr 2027" tile — IHT due (pulsing glow) | DATA | SOURCE — IHTDrillPanel | UNVERIFIED | non-interactive; A2 should drill; **A6 — when today < 2027 path uses `ihtDynamic(e, true)` not `te_ihtExposure` → potential mismatch with IHTDrillPanel which uses `te_ihtExposure`** |
| TE-EST-IHT-08 | "After 6 Apr 2027" tile — effective rate + family receives sub | DATA | NA | UNVERIFIED | |
| TE-EST-IHT-09 | "After 6 Apr 2027" tile — Confirmed reliefs chip | DATA | NA | UNVERIFIED | conditional |
| TE-EST-IHT-10 | "After 6 Apr 2027" tile — note "Pension in estate" | DATA | NA | UNVERIFIED | A5 |
| TE-EST-IHT-11 | Estate-vs-thresholds gauge (NRB+RNRB) | DATA | SOURCE — IHTDrillPanel | UNVERIFIED | non-interactive |
| TE-EST-IHT-12 | "Breakdown ›" L3 chip → IHTDrillPanel | ACTION | SOURCE — IHT waterfall | UNVERIFIED | wired `setDrillView('iht')` |

### Region 21 — Plan staleness accordion (mobile only repeat — see Region 3)

> Mobile renders the same `PlanStalenessAccordion` after the IHT dual-number card. IDs `TE-PLAN-01..05` apply.

### Region 22 — Will & LPA card (§6.9, X27 canonical)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TE-EST-WL-01 | Card title "Will & power of attorney (LPA)" + sub | DATA | NA | UNVERIFIED | A5 — "LPA" jargon in title |
| TE-EST-WL-02 | "Will current" / "No current will" accessory chip | DATA | NA | UNVERIFIED | |
| TE-EST-WL-03 | RED cohabiting-no-will banner | DATA | NA / ACTION | UNVERIFIED | renders on `RED_COHABITING_NO_WILL` flag; A2 — should be CTA to write will |
| TE-EST-WL-04 | Tile — Will status | DATA | SOURCE | UNVERIFIED | non-interactive |
| TE-EST-WL-05 | Tile — Power of attorney (LPA) | DATA | SOURCE | UNVERIFIED | A5 — "Property + finance" / "Health + welfare" abbreviations |
| TE-EST-WL-06 | "Cost of dying intestate: £X" banner | DATA | SOURCE — `noWillCoI` breakdown | UNVERIFIED | A6 — reconcile to CoI total / cross-screen |
| TE-EST-WL-07 | Intestacy distribution title + rules line | DATA | NA | UNVERIFIED | A5 |
| TE-EST-WL-08 | Intestacy beneficiary row(s) — name + share + pct | DATA | SOURCE | UNVERIFIED | one row per beneficiary; non-interactive |

### Region 23 — IHT waterfall card (§6.5)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TE-EST-WF-01 | Card title "IHT waterfall — what reduces the bill?" + animated savings sub | DATA | NA | UNVERIFIED | A5 |
| TE-EST-WF-02 | "Couples £5m business + agricultural relief pool" chip (couples) | DATA | NA | UNVERIFIED | A5 — verify plain English |
| TE-EST-WF-03 | Waterfall stage bar (per stage, e.g. baseline / spouse / NRB / RNRB / gifts / BPR) | DATA | SOURCE | UNVERIFIED | non-interactive |
| TE-EST-WF-04 | SliderRow — SIPP drawdown (0 → 120k) | ACTION | DECISION — what-if scenario | UNVERIFIED | local state only; A2 — drives in-card recompute only |
| TE-EST-WF-05 | SliderRow — Gifts to trust (0 → 500k) | ACTION | DECISION — what-if scenario | UNVERIFIED | local state; A5 — "gifts to trust" needs explainer |
| TE-EST-WF-06 | SliderRow — BPR positioning (0 → 500k) | ACTION | DECISION — what-if scenario | UNVERIFIED | A5 — "BPR" jargon + "pre vs post 30-Oct-2024" date jargon |

### Region 24 — Gift clock (§6.6)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TE-EST-GC-01 | Card title "Gift clock — 7-year rule" + count sub | DATA | NA | UNVERIFIED | A5 |
| TE-EST-GC-02 | ExplainerChip TE-2 | ACTION | SOURCE — 7-year-rule explainer | UNVERIFIED | |
| TE-EST-GC-03 | Gift row (per gift) — RingChart % | DATA | SOURCE | UNVERIFIED | one per gift |
| TE-EST-GC-04 | Gift row — amount + recipient line | DATA | SOURCE | UNVERIFIED | |
| TE-EST-GC-05 | Gift row — date + years-elapsed | DATA | SOURCE | UNVERIFIED | |
| TE-EST-GC-06 | Gift row — taper % chip / "IHT-free" chip | DATA | NA | UNVERIFIED | A5 — "taper" jargon |
| TE-EST-GC-07 | Gift row — "Today: £X IHT" chip (if not IHT-free) | DATA | SOURCE — IHT-on-death detail | UNVERIFIED | non-interactive |

### Region 25 — Trust simulator (§6.7 — RevealCard, life-stage gated)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TE-EST-TR-00 | RevealCard wrapper "Trust simulator" + 10-yr chip | ACTION | expands body | UNVERIFIED | gated to preretirement+ life stages |
| TE-EST-TR-01 | Card title "Trust 10-year periodic charge" + sub | DATA | NA | UNVERIFIED | A5 — "periodic charge" jargon |
| TE-EST-TR-02 | Per-trust block — "Trust N" label | DATA | NA | UNVERIFIED | one per trust |
| TE-EST-TR-03 | Per-trust — "LOW · deed not in Vault" warn chip | DATA | NA / ACTION | UNVERIFIED | A2 — should be CTA to upload deed |
| TE-EST-TR-04 | Per-trust — Next charge date | DATA | SOURCE | UNVERIFIED | |
| TE-EST-TR-05 | Per-trust — Years to next charge | DATA | SOURCE | UNVERIFIED | |
| TE-EST-TR-06 | Per-trust — Rate | DATA | NA | UNVERIFIED | |
| TE-EST-TR-07 | Per-trust — Estimated charge | DATA | SOURCE | UNVERIFIED | |

### Region 26 — BPR & APR mechanics (§6.12 — RevealCard, smart gate)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TE-EST-BPR-00 | RevealCard wrapper "BPR & APR mechanics" | ACTION | expands body | UNVERIFIED | gate: `hasBPREligibleHoldings` → all stages; else consolidation+ |
| TE-EST-BPR-01 | Card title "BPR & APR" + sub (£2.5m or £5m couples) | DATA | NA | UNVERIFIED | A5 — "BPR/APR" jargon; A6 — caps hardcoded fallback `2500000 / 5000000` |
| TE-EST-BPR-02 | HalfCircleGauge of BPR/APR usage % | DATA | SOURCE | UNVERIFIED | |
| TE-EST-BPR-03 | Used/cap progress bar | DATA | SOURCE | UNVERIFIED | |
| TE-EST-BPR-04 | Tile — Tier 1 (full 100%) | DATA | SOURCE — BPRDrillPanel | UNVERIFIED | non-interactive |
| TE-EST-BPR-05 | Tile — AIM (Tier 2 50%) | DATA | SOURCE | UNVERIFIED | A5 — "AIM" / "Tier 2" jargon |
| TE-EST-BPR-06 | Chip — "Pre-30-Oct-2024 trusts: 100% relief" | DATA | NA | UNVERIFIED | A5 — date + relief % combination needs context |
| TE-EST-BPR-07 | Chip — "Post-30-Oct-2024 trusts: 50% above £1m" | DATA | NA | UNVERIFIED | A5/A6 — date + £1m hardcoded |
| TE-EST-BPR-08 | Chip — "7-yr refresh applies" | DATA | NA | UNVERIFIED | A5 — jargon |
| TE-EST-BPR-09 | Chip — "Instalment option available" | DATA | NA | UNVERIFIED | A5 |
| TE-EST-BPR-10 | Chip — "CPI indexation (post-2030)" | DATA | NA | UNVERIFIED | A5 — "CPI" jargon |
| TE-EST-BPR-11 | APR sub-card — qualifies + reason | DATA | SOURCE | UNVERIFIED | A5 — "APR" = Agricultural Property Relief, needs explainer |
| TE-EST-BPR-12 | "Asset detail ›" L3 chip → BPRDrillPanel | ACTION | SOURCE — BPR asset breakdown | UNVERIFIED | wired `setDrillView('bpr')` |

### Region 27 — Pension nominations (§6.8)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TE-EST-NM-01 | Card title "Pension nominations" + count sub | DATA | NA | UNVERIFIED | |
| TE-EST-NM-02 | Pension row (per pension) — provider/name | DATA | SOURCE — pension nomination detail | UNVERIFIED | non-interactive; A2 — should be CTA to set nominee when missing |
| TE-EST-NM-03 | "Nominee set" / "No nominee" chip | DATA | NA | UNVERIFIED | |
| TE-EST-NM-04 | "Stale" chip | DATA | NA | UNVERIFIED | |

### Region 28 — Beneficiary chain (§6.10)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TE-EST-BC-01 | Card title "Beneficiary chain" + sub | DATA | NA | UNVERIFIED | A5 |
| TE-EST-BC-02 | BeneficiarySankey diagram (animated `<DrawSVG>`) | DATA | SOURCE | UNVERIFIED | A6 — gross/IHT/net values must reconcile to `te_ihtExposure`; nodes appear non-interactive (no per-node onClick) |

### Region 29 — RNRB planning (§6.11)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TE-EST-RN-01 | Card title "RNRB planning" + sub w/ effective + lost amounts | DATA | NA | UNVERIFIED | A5 — "RNRB" / "taper" jargon |
| TE-EST-RN-02 | Eligibility accessory chip ("Eligible" / reason) | DATA | NA | UNVERIFIED | |
| TE-EST-RN-03 | £2m taper warning banner | DATA | NA | UNVERIFIED | A6 — **`taperStart = 2000000` and `taperEnd = 2350000` hardcoded in JSX (lines 1407-1408)** — must trace to UK-2026.1.1.json |
| TE-EST-RN-04 | Gross estate gauge bar | DATA | SOURCE | UNVERIFIED | |
| TE-EST-RN-05 | Downsizing credit line (conditional) | DATA | SOURCE | UNVERIFIED | A5 |

### Region 30 — IHT-since-last-visit diff chip (conditional)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TE-EST-DF-01 | "IHT exposure since last visit" label + DeltaChip | DATA | SOURCE — IHT history | UNVERIFIED | renders only when |Δ| > 100 |

---

## L3 OVERLAY PANELS

### Region 31 — IHTDrillPanel (full-screen overlay, opened by TE-EST-IHT-12)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TE-DRL-IHT-01 | Back button "← Back" | NAV | close drill (returns to estate) | UNVERIFIED | wired `onClose` |
| TE-DRL-IHT-02 | Header title "IHT exposure breakdown" | DATA | NA | UNVERIFIED | |
| TE-DRL-IHT-03 | Hero — "IHT due today" + value (`fmt`) | DATA | SOURCE | UNVERIFIED | A6 — equal to TE-EST-IHT-03 (Today tile) |
| TE-DRL-IHT-04 | Hero — effective rate + family receives sub | DATA | NA | UNVERIFIED | |
| TE-DRL-IHT-05 | Hero — "From your data" chip | DATA | NA | UNVERIFIED | |
| TE-DRL-IHT-06 | Waterfall step row — Gross estate | DATA | SOURCE | UNVERIFIED | A6 — **`nilRate ?? 325000`, `rnrb ?? 0` defaults hardcoded in JSX (lines 1861-1862)** — must trace to UK-2026.1.1.json |
| TE-DRL-IHT-07 | Waterfall step row — Nil-rate band | DATA | SOURCE | UNVERIFIED | |
| TE-DRL-IHT-08 | Waterfall step row — Residence NRB | DATA | SOURCE | UNVERIFIED | A5 — "Residence NRB" jargon |
| TE-DRL-IHT-09 | Waterfall step row — Taxable estate | DATA | SOURCE | UNVERIFIED | |
| TE-DRL-IHT-10 | Waterfall step row — IHT @ 40% | DATA | NA | UNVERIFIED | A6 — 40% hardcoded in label; must trace to engine rate |
| TE-DRL-IHT-11 | Waterfall step row — Family receives | DATA | SOURCE | UNVERIFIED | |
| TE-DRL-IHT-12 | Estate composition section (`wfall.steps`) | DATA | SOURCE | UNVERIFIED | conditional |
| TE-DRL-IHT-13 | Action chip "Gifts, trusts, and pension nominations can reduce this figure" | DATA | NA / ACTION | UNVERIFIED | A2 — pure copy, no CTA; should link to relevant cards |
| TE-DRL-IHT-14 | Footer "Based on UK IHT rules · Finance Act 2026 · Not regulated advice" | DATA | NA | UNVERIFIED | A5 FCA framing |

### Region 32 — AllowanceDrillPanel (full-screen overlay, opened by TE-TAX-ALL-08)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TE-DRL-AL-01 | Back button "← Back" | NAV | close drill | UNVERIFIED | |
| TE-DRL-AL-02 | Header title "Allowance tracker" | DATA | NA | UNVERIFIED | |
| TE-DRL-AL-03 | Hero — composite usage % + sub | DATA | SOURCE | UNVERIFIED | A6 — equal to TE-TAX-ALL-01 sub |
| TE-DRL-AL-04 | Hero — "From your data" chip | DATA | NA | UNVERIFIED | |
| TE-DRL-AL-05 | Allowance row — ISA | DATA | SOURCE | UNVERIFIED | A6 — limit fallback `TAX.isa_limit ?? 20000` hardcoded; verify resolves |
| TE-DRL-AL-06 | Allowance row — PSA | DATA | NA | UNVERIFIED | A6/A5 — desc has hardcoded "£1,000 basic rate · £500 higher rate · £0 additional" |
| TE-DRL-AL-07 | Allowance row — CGT exemption | DATA | SOURCE | UNVERIFIED | A6 — `TAX.cgt_exemption ?? 3000` hardcoded fallback |
| TE-DRL-AL-08 | Allowance row — Dividend allowance | DATA | SOURCE | UNVERIFIED | A6 — `TAX.dividend_allowance ?? 500` hardcoded fallback |
| TE-DRL-AL-09 | Allowance row — Personal Allowance | DATA | SOURCE | UNVERIFIED | A6/A5 — `TAX.personal_allowance ?? 12570` hardcoded; desc "£100k ANI" + "£125,140" hardcoded |
| TE-DRL-AL-10 | Per-row remaining-line ("£X remaining this tax year") | DATA | SOURCE | UNVERIFIED | |
| TE-DRL-AL-11 | Empty state "No allowance data available" | DATA | NA | UNVERIFIED | |
| TE-DRL-AL-12 | Footer "Based on UK 2026/27 thresholds · Not regulated advice" | DATA | NA | UNVERIFIED | A5 |

### Region 33 — BPRDrillPanel (full-screen overlay, opened by TE-EST-BPR-12)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TE-DRL-BPR-01 | Back button "← Back" | NAV | close drill | UNVERIFIED | |
| TE-DRL-BPR-02 | Header title "Business Property Relief" | DATA | NA | UNVERIFIED | A5 |
| TE-DRL-BPR-03 | Empty state "No BPR-eligible assets detected" | DATA | NA | UNVERIFIED | |
| TE-DRL-BPR-04 | BPR-eligible asset row (per asset) | DATA | SOURCE | UNVERIFIED | A6 — **BPR rate logic hardcoded in JSX: trading=100% / mixed=50% (line 1632) — not engine-derived**; rate detection by regex on description |
| TE-DRL-BPR-05 | Asset row — name + current value | DATA | SOURCE | UNVERIFIED | |
| TE-DRL-BPR-06 | Asset row — BPR rate + type label | DATA | NA | UNVERIFIED | A5 |
| TE-DRL-BPR-07 | Asset row — Relief amount | DATA | SOURCE | UNVERIFIED | |
| TE-DRL-BPR-08 | Total BPR relief footer line | DATA | SOURCE | UNVERIFIED | |
| TE-DRL-BPR-09 | Holding-period caveat banner ("BPR must be held ≥2 years…") | DATA | NA | UNVERIFIED | A5 |
| TE-DRL-BPR-10 | Footer "Information only · Not regulated advice…" | DATA | NA | UNVERIFIED | A5 |

### Region 34 — CGTDrillPanel (full-screen overlay, opened by TE-TAX-CGT-08)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| TE-DRL-CGT-01 | Back button "← Back" | NAV | close drill | UNVERIFIED | |
| TE-DRL-CGT-02 | Header title "Capital Gains Tax" | DATA | NA | UNVERIFIED | |
| TE-DRL-CGT-03 | Unrealised gains card title | DATA | NA | UNVERIFIED | |
| TE-DRL-CGT-04 | Row — Investments (GIA/portfolio) | DATA | SOURCE | UNVERIFIED | conditional on invGain > 0 |
| TE-DRL-CGT-05 | Row — GIA | DATA | SOURCE | UNVERIFIED | conditional on giaGain > 0 |
| TE-DRL-CGT-06 | Empty state "No unrealised gains detected" | DATA | NA | UNVERIFIED | |
| TE-DRL-CGT-07 | Total unrealised gains row | DATA | SOURCE | UNVERIFIED | |
| TE-DRL-CGT-08 | "If crystallised this year" card title | DATA | NA | UNVERIFIED | |
| TE-DRL-CGT-09 | Annual exempt amount row | DATA | NA | UNVERIFIED | A6 — `TAX.cgt.exempt ?? TAX.cgt.annual_exempt_amount ?? 3000` hardcoded fallback (line 1736) |
| TE-DRL-CGT-10 | Taxable gain row | DATA | SOURCE | UNVERIFIED | |
| TE-DRL-CGT-11 | CGT @ 18% (basic rate) row | DATA | NA | UNVERIFIED | A6 — **18% rate hardcoded in JSX (line 1738), not engine-derived** |
| TE-DRL-CGT-12 | CGT @ 24% (higher rate) row | DATA | NA | UNVERIFIED | A6 — **24% rate hardcoded in JSX (line 1739)**; must trace to UK-2026.1.1.json |
| TE-DRL-CGT-13 | "Consider harvesting up to £X in gains…" tip banner | DATA | NA / ACTION | UNVERIFIED | A5 — verges on advice phrasing; A2 — could be CTA |
| TE-DRL-CGT-14 | Footer "Information only · Not regulated advice · Rates per UK-2026.1" | DATA | NA | UNVERIFIED | A5 |

---

## SEED FINDINGS (pre-identified — agents start with these, then extend)

These are *already known* from reading the React component. They are not the list —
they are the proof the method works. Agents must confirm each, assign severity, and
find the rest.

| Seed | Element(s) | Issue | Likely severity |
|------|-----------|-------|-----------------|
| S-01 | TE-EST-IS-10 / TE-EST-IS-11 | `InheritanceStory` rendered without `onDrillMetric` prop (TaxEstate.jsx line 2438) — the beneficiaries-line `cta` is dead, and the footer hint "Tap any line to see the calculation behind it" misleads the user. | DEMO-BLOCKING |
| S-02 | TE-EST-IS-07a | Hero copy uses hardcoded `£325k tax-free band` string (InheritanceStory.jsx line 94) — must trace to NRB in UK-2026.1.1.json | FUNCTIONAL |
| S-03 | TE-EST-RN-03 | RNRB taper window hardcoded in JSX: `taperStart = 2000000`, `taperEnd = 2350000` (lines 1407–1408) | FUNCTIONAL |
| S-04 | TE-DRL-IHT-06/07 | IHT drill hardcoded defaults `nilRate ?? 325000`, `rnrb ?? 0` (lines 1861–1862) — same hardcode pattern | FUNCTIONAL |
| S-05 | TE-DRL-IHT-10 | "IHT @ 40%" label hardcoded — must trace to engine rate not string literal | POLISH→FUNCTIONAL |
| S-06 | TE-DRL-CGT-11/12 | CGT rates 18%/24% hardcoded in JSX (lines 1738–1739); not driven by UK-2026.1.1.json | FUNCTIONAL |
| S-07 | TE-DRL-CGT-09 | CGT exempt amount uses `?? 3000` fallback, comment in TaxEstate.jsx code confirms engine should be source | FUNCTIONAL |
| S-08 | TE-DRL-AL-05..09 | AllowanceDrillPanel uses `?? 20000 / 3000 / 500 / 12570` hardcoded fallbacks (lines 2007–2011) | FUNCTIONAL |
| S-09 | TE-DRL-AL-06/09 | PSA + PA `desc` strings contain hardcoded thresholds ("£1,000 / £500 / £0", "£100k", "£125,140") | FUNCTIONAL |
| S-10 | TE-TAX-IT-03 | 60% taper logic uses hardcoded `100000` in TaxEstate.jsx (line 451) — comment acknowledges `TAX.paTaperStart/paTaperEnd` should be added to exports | FUNCTIONAL |
| S-11 | TE-DRL-BPR-04 | BPR relief rate (100% trading vs 50% mixed) decided in JSX via regex on description (line 1632), not engine | FUNCTIONAL |
| S-12 | TE-TAX-IT-05 | Income-tax band labels render raw engine keys with `_` separators (e.g. `basic_rate`) — A5 jargon | POLISH |
| S-13 | TE-TAX-ALL-07 | Cash-ISA £12k cap horizon banner hardcodes `£12,000` / `6 Apr 2027` / `£8,000` in JSX (lines 763–765) | FUNCTIONAL |
| S-14 | TE-TAX-DIV-03/04/05 | Dividend rate chips hardcoded "10.75% / 35.75% / 39.35%" (lines 695–697) — must trace to engine | FUNCTIONAL |
| S-15 | TE-EST-IHT-07 | "After 6 Apr 2027" tile uses `ihtDynamic(e, true)` while IHTDrillPanel uses `te_ihtExposure` — engine path divergence risk for the same number | FUNCTIONAL |
| S-16 | TE-EST-COI-01 | EstateCoIOdometer shows only `byDomain.estatePlanning` slice — Home/MyMoney show `totalCoI(e)` total; user-visible label may imply they are the same number | DEMO-BLOCKING (RECONCILE: Home/MyMoney) |
| S-17 | TE-SUB-E1, TE-SUB-E3, TE-EST-IHT-03/07 | IHT/CoI numbers on T&E must equal the same value formatted the same way on Home (H-ANCH-04) and MyMoney — verify per FD-CROSS-1 | DEMO-BLOCKING (RECONCILE: Home/MyMoney) |
| S-18 | TE-EST-WL-03 | "RED · Cohabiting partner with no current will" banner is information-only — no CTA to write a will; A2/A4 candidate | FUNCTIONAL |
| S-19 | TE-EST-NM-02 | "No nominee" rows have no CTA to set a nominee — pure status display | FUNCTIONAL |
| S-20 | TE-TAX-CGT-06 / TE-TAX-DIV-07 | "Bed-and-ISA opportunity" chip and "Move to ISA saves £X" banner are non-interactive — should be CTAs to action surfaces | FUNCTIONAL |
| S-21 | global jargon | BPR / APR / RNRB / NRB / AIM / FIG / TRF / SA100 / PSA / BADR / LPA / "taper" / "Pre-30-Oct-2024 trusts" appear without inline plain-English explainers; ExplainerChips TE-1 / TE-2 used in only 2 places | FUNCTIONAL |
| S-22 | TE-CHR-02 / TE-CHR-05 / TE-CHR-07 | Live-rules pill, X28 label, and disclaimer footer all read `BRAND.rulesVersion` — verify single value across instances (A6) | POLISH |
| S-23 | TE-EST-IHT-02 / TE-TAX-IT-02 | ExplainerChip TE-1 — must reflect ENACTED SIPP-IHT (FD-TE-1), not "PROPOSED" wording | DEMO-BLOCKING |
| S-24 | TE-TAX-DD-01 | Drawdown matrix lives on T&E (consequence-owning surface per FD-CROSS-1) but card title doesn't tell user the *doing* surface is MyMoney/Cashflow | POLISH |
| S-25 | TE-TAX-DIV-01 | DividendDetail sub uses raw `£${(div.gia_exposed || 0).toLocaleString()}` — does not use `fmt()` like other numbers (A6 format inconsistency) | POLISH |
| S-26 | TE-TAX-SS-03 / TE-EST-WF-04/05/06 | Sliders are local-state only — they recompute display in-card but do not feed `entity` / engine, so triple anchor + CoI numbers above do not move while user slides | FUNCTIONAL |

---

## COVERAGE MATH (this replaces "99% confident")

Total inventory rows: **227** (including sub-rows across 34 regions).

```
Coverage  = (rows with verdict ≠ UNVERIFIED) / (total rows)
Pass rate = (rows PASS) / (rows PASS + rows FAIL)
```

A pass is **complete** only when Coverage = 100% (every row has a verdict).
The audit **terminates** per the runbook stopping rule — not at a round number.
"99% confident" is only a legitimate claim when Coverage = 100% and it is restated as:
*"X of Y rows verified PASS; Z FAIL, all POLISH-severity and backlogged."*

---

*— end tax-estate-screen-element-inventory-v1.md —*
