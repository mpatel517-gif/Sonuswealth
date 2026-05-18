# Reports Screen — Element Inventory v1

**Screen:** Sonuswealth Reports (build target: React in `src/screens/Reports.jsx`)
**Design baseline:** none on disk — Reports.jsx is Phase-3 stub (FIX-14, 2026-05-15). The component IS the structural truth.
**Reconciliation baseline:** brand SoT — `src/config/brand.js` (`BRAND.scoreFull`, `BRAND.disclaimer`, `BRAND.rulesLabel()`). Engine SoT (when Phase 2 wires) — `src/engine/fq-calculator.js` (`netWorth · ihtDynamic · costOfInaction · incomeTax · cashflowHealth · trajectoryData · calcFQ · calcRisk`).
**Intent reference (NOT a conformance target):** `2-Product-reports-v1_1.md` — cited inline in source (5 report types · on-demand + weekly/monthly · materiality threshold £500 or 0.5% NW · AI narrative as commentary).
**Date:** 17 May 2026

---

## Why this file exists

This is the **fixed target** the whole audit measures against. Every interactive or data-bearing element on Reports is one numbered row. The audit does not "find mistakes" — it walks this list and records a verdict per row.

**This file is the worksheet.** Auditor agents fill the `Verdict` columns.

---

## The six assertions (every row tested against all six)

| # | Assertion | Fails when… |
|---|-----------|-------------|
| A1 | **Identified** — element exists in build and matches this row | Element missing, or build has unlisted element |
| A2 | **Drillable** — interacting does something | Dead handler / no response |
| A3 | **Destination correct** — resolves to surface owning its subject | Pension action lands on Cashflow; tax number lands on Risk |
| A4 | **Destination coherent** — landing shows SOURCE, ACTION, or DECISION | Generic modal / dead-end / unrelated view |
| A5 | **Plain English** — readable in one pass; jargon translated; FCA stance | Unexplained jargon; advice-phrased copy |
| A6 | **Reconciled** — number traces to engine fn, matches value+format everywhere | Hardcoded number; `fmt()` not used; same metric two values |

**Verdict values:** `PASS` · `FAIL` · `NA` · `UNVERIFIED` (default) · `BLOCKED`.
**Severity:** `DEMO-BLOCKING` · `FUNCTIONAL` · `POLISH`.

**Reports-specific rule.** Every figure in a generated report (Phase 2) must equal the same figure on its source surface in the same `fmt()` format. Flag with **"RECONCILE: source surface"** in Notes.

---

## Confirmed founder decisions

| FD | Decision |
|----|----------|
| FD-NAME-1 | **Product name is `Sonuswealth` (D-NAME-2, locked 9 May 2026 — supersedes Caelixa, Finio).** SoT: `src/config/brand.js` (`BRAND.name`). Casing: logo = `sonuswealth` lowercase; body/titles/aria = `Sonuswealth` sentence case. Every `Caelixa` or `Finio` in user-facing strings = FUNCTIONAL FAIL. |
| FD-LOGO-1 | Brand assets at `G:\My Drive\All Work\6.Finio\1-Clusters\Codex UI\deliverables\sonuswealth-site\assets\{favicons,logo,mascot,videos}`. Wrong-theme logo variant = DEMO-BLOCKING if below WCAG AA. |
| FD-MASCOT-1 | Mascot is **Sonnu (owl)**, 6 life-stage forms. Wave 7 scope — absence not-a-finding. |
| FD-CROSS-1 | **Reports owns the artifact** — exportable / shareable representations of state at a point in time. Wealth statement, IHT-readiness report, drawdown plan, tax-allowance summary. Every report is a frozen view of one or more other surfaces. Reports never *originates* a number, it *renders* one. |
| FD-RP-1 | **Report branding uses `BRAND.scoreFull` ('Sonuswealth Wealth Score') and `BRAND.disclaimer`.** Caelixa-branded report headers = DEMO-BLOCKING (highest-risk leak surface). Phase 2 PDF renderer MUST pull from `brand.js`, never hardcode. |
| FD-RP-2 | **Stub phase is CTA-honest.** All Generate/Schedule buttons disabled, labelled "Coming next — Phase 2". Per founder rule, any button looking clickable but doing nothing = DEMO-BLOCKING. Confirm disabled state is real, not visual fake. |
| FD-RP-3 | **Tax-touching reports must carry FCA disclaimer.** `BRAND.disclaimer` MUST appear on Estate plan, Tax summary, Cashflow projection, and any Custom containing tax sections. Absence = DEMO-BLOCKING. Net Worth snapshot borderline — flag for founder ruling. |

---

## ELEMENT TABLE

> Reports.jsx is a Phase-3 STUB. Buttons `disabled`; `onGenerate` destructured then `void`-ed. Most ACTION rows expect Verdict = `BLOCKED`. Audit still asserts: (i) disabled-state rendered correctly (FD-RP-2), (ii) labels plain English (A5), (iii) pre-declared figures/page-counts traceable to engine + spec (A6), (iv) branding is Sonuswealth (FD-NAME-1, FD-RP-1).

### Region 1 — Shell / chrome

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| RP-CHR-01 | "← Home" back button (conditional on `onBack`) | NAV | Home screen | UNVERIFIED | only renders if `onBack` prop passed; verify Dashboard wires it |
| RP-CHR-02 | Eyebrow "Reports" | DATA | NA | UNVERIFIED | A5 |
| RP-CHR-03 | H1 "On-demand or scheduled" | DATA | NA | UNVERIFIED | A5 |

### Region 2 — Phase 2 honesty banner

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| RP-BAN-01 | Honesty banner (`role="status"`, amber tint) | DATA | NA | UNVERIFIED | FD-RP-2; verify role=status announces to AT |
| RP-BAN-02 | Banner copy "Reports are in build. Templates locked…" | DATA | NA | UNVERIFIED | A5; FD-RP-2 |

### Region 3 — Intro paragraph

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| RP-INT-01 | Intro "Each report will be generated from your current data + the rules bundle active that day…" | DATA | NA | UNVERIFIED | A5; reconciles to `BRAND.rulesLabel()` — confirm "rules bundle active that day" matches `BRAND.rulesVersion`/`appliedSince` |
| RP-INT-02 | Mention "share with your adviser, accountant, or family" | DATA | NA | UNVERIFIED | A5; FCA framing — information-stance OK |

### Region 4 — Period selector (disabled fieldset)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| RP-PER-00 | `<fieldset disabled>` wrapper | DATA | NA | UNVERIFIED | FD-RP-2; confirm `disabled` blocks interaction + `opacity:0.7` cues affordance |
| RP-PER-01 | Legend "Period · Selection coming with Generate Phase 2" | DATA | NA | UNVERIFIED | A5; CTA-honesty |
| RP-PER-02 | Radio — "Tax year · 6 Apr – 5 Apr" | INPUT | mode state = tax-year (Phase 2) | BLOCKED | `disabled`; defaultChecked; reconcile dates to UK tax-year SoT |
| RP-PER-03 | Radio — "Calendar year · 1 Jan – 31 Dec" | INPUT | mode state = calendar (Phase 2) | BLOCKED | `disabled` |
| RP-PER-04 | Radio — "Custom range · Pick your own dates" | INPUT | DECISION — date-range picker (Phase 2) | BLOCKED | `disabled`; needs picker component |

### Region 5 — Report tile: Estate plan

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| RP-EST-01 | Tile container `.sw-tile` (id:'estate') | DATA | NA | UNVERIFIED | |
| RP-EST-02 | Title "Estate plan" | DATA | NA | UNVERIFIED | A5 |
| RP-EST-03 | Page-count chip "6–8 pages" | DATA | NA | UNVERIFIED | A6 — verify Phase 2 PDF lands in range |
| RP-EST-04 | Body copy "SIPP enters estate from April 2027 (enacted)…" | DATA | NA | UNVERIFIED | A6 — RECONCILE: rules-uk SIPP-IHT; per memory `project_sipp_iht_enacted_2026` Royal Assent 18 Mar 2026, effective April 2027; verify `BRAND.nextRulesDate`='2027-04-06' |
| RP-EST-05 | "Coming next — Phase 2" generate button | ACTION | ACTION — generate Estate report → vault | BLOCKED | `disabled`; aria-label correct; FD-RP-2 |
| RP-EST-06 | "Schedule — Phase 2" button | ACTION | ACTION — schedule weekly/monthly | BLOCKED | `disabled`; FD-RP-2 |
| RP-EST-07 | (Phase 2) Report header brand string | DATA | NA | UNVERIFIED | FD-RP-1 — must use `BRAND.scoreFull`, no Caelixa/Finio |
| RP-EST-08 | (Phase 2) Body figures (IHT, gifts, nominations, will/LPA) | DATA | SOURCE — Tax & Estate | UNVERIFIED | A6; RECONCILE: T&E `ihtDynamic`, `costOfInaction` |
| RP-EST-09 | (Phase 2) FCA disclaimer on Estate report | DATA | NA | UNVERIFIED | FD-RP-3; A5 — `BRAND.disclaimer` verbatim |

### Region 6 — Report tile: Tax summary

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| RP-TAX-01 | Tile container (id:'tax') | DATA | NA | UNVERIFIED | |
| RP-TAX-02 | Title "Tax summary" | DATA | NA | UNVERIFIED | A5 |
| RP-TAX-03 | Page-count chip "4–6 pages" | DATA | NA | UNVERIFIED | A6 |
| RP-TAX-04 | Body copy "Income tax, allowances, dividends, CGT, pension contribution headroom…" | DATA | NA | UNVERIFIED | A5 |
| RP-TAX-05 | "Coming next — Phase 2" generate button | ACTION | ACTION — generate Tax report → vault | BLOCKED | `disabled` |
| RP-TAX-06 | "Schedule — Phase 2" button | ACTION | ACTION — schedule | BLOCKED | `disabled` |
| RP-TAX-07 | (Phase 2) Report header brand string | DATA | NA | UNVERIFIED | FD-RP-1 |
| RP-TAX-08 | (Phase 2) Income-tax figures | DATA | SOURCE — T&E `incomeTax` | UNVERIFIED | RECONCILE: T&E income-tax breakdown |
| RP-TAX-09 | (Phase 2) Allowances (£20K ISA, £3K CGT, etc.) | DATA | SOURCE — rules-uk + T&E | UNVERIFIED | RECONCILE: per memory `feedback_always_check_rules_uk` — figures MUST come from rules-uk.js / tax-2026.json, NEVER hardcoded |
| RP-TAX-10 | (Phase 2) FCA disclaimer | DATA | NA | UNVERIFIED | FD-RP-3 |

### Region 7 — Report tile: Cashflow projection

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| RP-CF-01 | Tile container (id:'cashflow') | DATA | NA | UNVERIFIED | |
| RP-CF-02 | Title "Cashflow projection" | DATA | NA | UNVERIFIED | A5 |
| RP-CF-03 | Page-count chip "5–7 pages" | DATA | NA | UNVERIFIED | A6 |
| RP-CF-04 | Body copy "12-month forward cashflow…funded-ratio + sustainable spend rate" | DATA | NA | UNVERIFIED | A5; "funded-ratio" jargon — verify defined inside report |
| RP-CF-05 | "Coming next — Phase 2" generate button | ACTION | ACTION — generate Cashflow report → vault | BLOCKED | `disabled` |
| RP-CF-06 | "Schedule — Phase 2" button | ACTION | ACTION — schedule | BLOCKED | `disabled` |
| RP-CF-07 | (Phase 2) Report header brand string | DATA | NA | UNVERIFIED | FD-RP-1 |
| RP-CF-08 | (Phase 2) 12-month forward projection | DATA | SOURCE — Cashflow `trajectoryData`, `cashflowHealth` | UNVERIFIED | RECONCILE: trajectory; verify horizon=12mo matches body claim |
| RP-CF-09 | (Phase 2) Funded-ratio + sustainable spend rate | DATA | SOURCE — Cashflow engine | UNVERIFIED | RECONCILE: `cashflowHealth` output; A5 — define terms in-report |
| RP-CF-10 | (Phase 2) FCA disclaimer | DATA | NA | UNVERIFIED | FD-RP-3 |

### Region 8 — Report tile: Net Worth snapshot

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| RP-NW-01 | Tile container (id:'nw') | DATA | NA | UNVERIFIED | |
| RP-NW-02 | Title "Net Worth snapshot" | DATA | NA | UNVERIFIED | A5 |
| RP-NW-03 | Page-count chip "3–5 pages" | DATA | NA | UNVERIFIED | A6 |
| RP-NW-04 | Body copy "Everything you own and owe, grouped by wrapper, with trend data…" | DATA | NA | UNVERIFIED | A5; "wrapper" jargon — verify defined |
| RP-NW-05 | "Coming next — Phase 2" generate button | ACTION | ACTION — generate NW report → vault | BLOCKED | `disabled` |
| RP-NW-06 | "Schedule — Phase 2" button | ACTION | ACTION — schedule | BLOCKED | `disabled` |
| RP-NW-07 | (Phase 2) Report header brand string | DATA | NA | UNVERIFIED | FD-RP-1 |
| RP-NW-08 | (Phase 2) Asset/liability breakdown | DATA | SOURCE — My Money `netWorth` | UNVERIFIED | RECONCILE: My Money composition; format must match Home anchor (£3.63m vs £3.63M — same fmt issue as Home S-06) |
| RP-NW-09 | (Phase 2) Trend data over selected window | DATA | SOURCE — My Money NW history | UNVERIFIED | RECONCILE: NW history fn |
| RP-NW-10 | (Phase 2) FCA disclaimer (borderline — non-tax) | DATA | NA | UNVERIFIED | FD-RP-3 — founder ruling needed; default include |

### Region 9 — Report tile: Custom report

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| RP-CUS-01 | Tile container (id:'custom') | DATA | NA | UNVERIFIED | |
| RP-CUS-02 | Title "Custom report" | DATA | NA | UNVERIFIED | A5 |
| RP-CUS-03 | Page-count chip "variable" | DATA | NA | UNVERIFIED | A5 — confirm "variable" reads cleanly |
| RP-CUS-04 | Body copy "Pick sections…Save the template for recurring use." | DATA | NA | UNVERIFIED | A5 |
| RP-CUS-05 | "Coming next — Phase 2" generate button | ACTION | DECISION — section picker → generate | BLOCKED | `disabled`; needs section-selection UI |
| RP-CUS-06 | "Schedule — Phase 2" button | ACTION | ACTION — schedule saved template | BLOCKED | `disabled` |
| RP-CUS-07 | (Phase 2) Section picker UI | INPUT | DECISION — sections from Estate/Tax/Cashflow/NW | UNVERIFIED | not in source — Phase 2 add |
| RP-CUS-08 | (Phase 2) "Save template" affordance | ACTION | ACTION — persist template | UNVERIFIED | mentioned in body but no UI — A1 risk when wired |
| RP-CUS-09 | (Phase 2) FCA disclaimer (conditional on tax sections) | DATA | NA | UNVERIFIED | FD-RP-3 |

### Region 10 — Footer

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| RP-FOOT-01 | Footer "PDF/CSV export coming in Phase 2 (D-RPT-EXPORT-1)." | DATA | NA | UNVERIFIED | A5; FD-RP-2 — CTA-honest |
| RP-FOOT-02 | **MISSING** — Trust line / FCA boundary on screen itself | DATA | NA | UNVERIFIED | A5; Home has H-FOOT-01/02 — Reports has NEITHER. Likely FUNCTIONAL fail given §9 audit gate + FD-RP-3 |
| RP-FOOT-03 | **MISSING** — `BRAND.rulesLabel()` strip ("Rules: UK-2026.1 · Last verified: April 2026") | DATA | NA | UNVERIFIED | A6; intro promises "rules bundle active that day" but no visible rules-version pill |

### Region 11 — Cross-cutting / global

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| RP-G-01 | Screen-wide brand audit — every visible string vs `BRAND.*` | DATA | NA | UNVERIFIED | FD-NAME-1; grep "Caelixa"/"Finio"/"FQ Score" in stub + Phase 2 templates |
| RP-G-02 | Screen-wide theme audit (light+dark × mobile+iPad+laptop) | DATA | NA | UNVERIFIED | §9 audit gate; amber banner legibility in dark |
| RP-G-03 | (Phase 2) PDF renderer brand variant per theme | DATA | NA | UNVERIFIED | FD-LOGO-1; PDFs typically light-on-white — confirm renderer variant choice |
| RP-G-04 | (Phase 2) `onGenerate(reportId, mode)` contract | ACTION | ACTION — Dashboard handler | UNVERIFIED | contract documented in source header; verify Dashboard exposes matching prop |
| RP-G-05 | (Phase 2) Materiality threshold £500 or 0.5% NW | DATA | SOURCE — engine threshold | UNVERIFIED | spec-cited; verify reads `BRAND` or engine constant, not hardcoded |
| RP-G-06 | (Phase 2) AI-narrative commentary section | DATA | NA (AI-generated) | UNVERIFIED | spec rule: "AI narrative as commentary, never source of truth" — every figure in narrative must also appear in structured section |
| RP-G-07 | Empty state — what user sees BEFORE any report exists | DATA | NA | UNVERIFIED | currently 5-tile catalog IS the screen; intro promises "Saved to your vault" but no vault list / entry point — either remove promise or stub the list |

---

## SEED FINDINGS

| Seed | Element(s) | Issue | Likely severity |
|------|-----------|-------|-----------------|
| S-01 | RP-FOOT-02 | Reports screen has NO trust line / NO FCA boundary line — Home has both. FD-RP-3 says tax-touching surfaces need disclaimer; Reports lists 4 tax-touching reports yet shows nothing | DEMO-BLOCKING |
| S-02 | RP-FOOT-03 / RP-INT-01 | Intro copy promises "rules bundle active that day" but no visible rules-version strip; `BRAND.rulesLabel()` not rendered on screen | FUNCTIONAL |
| S-03 | RP-EST-04 | Body copy hardcodes "April 2027 (enacted)" SIPP-IHT date — consistent today but will drift; should template-bind to `BRAND.nextRulesDate` | FUNCTIONAL |
| S-04 | RP-CUS-08 | Body promises "Save the template for recurring use" but no Save-template UI in stub or contract notes — feature mentioned without affordance | FUNCTIONAL |
| S-05 | RP-NW-04 / RP-CF-04 | "wrapper" and "funded-ratio" used without inline plain-English definition on a surface that targets non-experts + accountants — needs one-line gloss | POLISH |
| S-06 | RP-G-04 | Source destructures `onGenerate` then immediately `void onGenerate` — Dashboard contract documented but unwired. Verify Dashboard actually passes `onGenerate` so Phase 2 flip is one-line as claimed | FUNCTIONAL |
| S-07 | RP-PER-02 | Period radio `defaultChecked` on 'Tax year' but `disabled` — when Phase 2 wires, confirm `defaultChecked` survives the disabled→enabled flip (React `defaultChecked` only applies at mount) | FUNCTIONAL |
| S-08 | RP-G-01 | Brand audit not run on this surface — Reports is highest-risk leak surface per FD-RP-1 (exports/PDFs); grep Caelixa/Finio/FQ Score across stub + Phase 2 templates when they land | DEMO-BLOCKING (if any leak found) |
| S-09 | RP-G-07 | No "vault" / "your past reports" empty state — intro says "Saved to your vault with a timestamp" but no list of past reports, no entry point. Either remove the promise (CTA-honesty) or stub the vault list | FUNCTIONAL |
| S-10 | RP-BAN-01 | Banner uses `var(--c-tint-amber, rgba(255,179,71,.10))` with `var(--c-border)` outline — amber-on-dark may fail WCAG AA contrast; verify in dark theme snap | POLISH |
| S-11 | RP-CHR-01 | Back button renders only if `onBack` prop present — if Dashboard ever forgets to pass it, user has no in-screen escape (relies on sidebar nav). Defensive default would be safer | POLISH |
| S-12 | RP-EST-03 / RP-TAX-03 / RP-CF-03 / RP-NW-03 | Page-count chips ("6–8 pages" etc.) are claims about Phase 2 output — when generation wires, audit must confirm actual PDF page counts land in claimed ranges or chip is a lie | FUNCTIONAL |

---

## COVERAGE MATH

Total inventory rows: **76** (including Phase 2 forward-look rows).

```
Coverage  = (rows with verdict ≠ UNVERIFIED) / (total rows)
Pass rate = (rows PASS) / (rows PASS + rows FAIL)
```

A pass is **complete** only when Coverage = 100%. "99% confident" = *"X of Y rows verified PASS; Z FAIL, all POLISH-severity and backlogged."*

**Stub-phase coverage note.** Phase-2 forward-look rows (RP-EST-07–09, RP-TAX-07–10, RP-CF-07–10, RP-NW-07–10, RP-CUS-07–09, RP-G-03–06) are expected `BLOCKED` until Phase 2 wires generation. At Phase 2 cutover, flip the `BLOCKED` set to `UNVERIFIED` and run.

---

*— end reports-inventory-v1.md —*
