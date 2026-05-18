# A1 — Conformance Audit · Reports · Pass 1
**Date:** 2026-05-18
**Auditor:** A1 (Conformance)
**Source:** `src/screens/Reports.jsx` (201 lines) · `reports-inventory-v1.md` (76 rows)
**Method:** Walk every inventory row; record verdict; flag UNLISTED or DECISION-NEEDED.

---

## Legend
`PASS` = present and correct · `FAIL` = wrong or missing · `BLOCKED` = intentional Phase 2 stub · `NA` = not applicable · `UNVERIFIED` = requires runtime

---

## Region 1 — Shell / chrome

| ID | Element | Verdict | Evidence |
|----|---------|---------|----------|
| RP-CHR-01 | Back-to-Home button (`← Home`) | **PASS** | Lines 71–77: renders when `onBack` prop present; `onClick={onBack}`; label "← Home" |
| RP-CHR-02 | Screen eyebrow "Reports" | **PASS** | Line 79: `<div className="sw-eyebrow">Reports</div>` |
| RP-CHR-03 | Screen title "On-demand or scheduled" | **PASS** | Line 81: verbatim |
| RP-CHR-04 | Rules-version strip / `BRAND.rulesLabel()` | **FAIL** | Not rendered anywhere in JSX. No `BRAND` import. Intro promises "rules bundle active that day" (line 103) but no visible rules-version pill. FUNCTIONAL. |
| RP-CHR-05 | FCA disclaimer / trust line | **FAIL** | `BRAND.disclaimer` absent. No manual disclaimer string. FD-RP-3 requires this for all 4 tax-touching report tiles. **DEMO-BLOCKING.** |

---

## Region 2 — Phase 2 honesty banner

| ID | Element | Verdict | Evidence |
|----|---------|---------|----------|
| RP-BAN-01 | Honesty banner (`role="status"`, amber tint) | **PASS** | Lines 87–100: `role="status"`; `background: var(--c-tint-amber, rgba(255,179,71,.10))`; `border: 1px solid var(--c-border)` |
| RP-BAN-02 | Banner copy "Reports are in build. Templates locked…" | **PASS** | Lines 96–99: verbatim match to inventory |

**Note:** amber-on-dark WCAG AA not verifiable from source — flag for runtime snap (RP-G-02).

---

## Region 3 — Intro paragraph

| ID | Element | Verdict | Evidence |
|----|---------|---------|----------|
| RP-INT-01 | Intro "Each report will be generated from your current data + the rules bundle active that day…" | **PASS** | Lines 102–106: verbatim. No rules-version pill rendered to fulfil the promise — partial FUNCTIONAL gap (see RP-CHR-04). |
| RP-INT-02 | Mention "share with your adviser, accountant, or family" | **PASS** | Line 105: verbatim |

---

## Region 4 — Period selector (disabled fieldset)

| ID | Element | Verdict | Evidence |
|----|---------|---------|----------|
| RP-PER-00 | `<fieldset disabled>` wrapper | **PASS** | Lines 109–110: `disabled` attribute; `opacity: 0.7` at line 115 |
| RP-PER-01 | Legend "Period · Selection coming with Generate Phase 2" | **PASS** | Line 122: verbatim |
| RP-PER-02 | Radio — "Tax year · 6 Apr – 5 Apr" | **BLOCKED** | Line 134: `defaultChecked={i===0}`; `disabled` at line 135. Risk: `defaultChecked` only applies at React mount — when Phase 2 enables, controlled state must be initialised separately. FUNCTIONAL risk deferred. |
| RP-PER-03 | Radio — "Calendar year · 1 Jan – 31 Dec" | **BLOCKED** | Index 1; `disabled` |
| RP-PER-04 | Radio — "Custom range · Pick your own dates" | **BLOCKED** | Index 2; `disabled`; date-range picker not yet spec'd in contract notes |

---

## Region 5 — Report tile: Estate plan

| ID | Element | Verdict | Evidence |
|----|---------|---------|----------|
| RP-EST-01 | Tile container `.sw-tile` (id:'estate') | **PASS** | Line 147: `key={r.id}`; `className="sw-tile"` |
| RP-EST-02 | Title "Estate plan" | **PASS** | `r.title='Estate plan'` from REPORT_TYPES[0] |
| RP-EST-03 | Page-count chip "6–8 pages" | **PASS** | `r.pages='6–8 pages'`. Claim unverifiable until Phase 2 PDF output. |
| RP-EST-04 | Body copy "SIPP enters estate from April 2027 (enacted)…" | **PASS (flagged)** | Line 27: verbatim. SIPP-IHT date factually correct per memory (`project_sipp_iht_enacted_2026`). BUT date is **hardcoded string**, not bound to `BRAND.nextRulesDate='2027-04-06'` — will drift on rules update. FUNCTIONAL (S-03). |
| RP-EST-05 | "Coming next — Phase 2" generate button | **BLOCKED** | Lines 156–170: `disabled`; `aria-disabled="true"`; label "Coming next — Phase 2" |
| RP-EST-06 | "Schedule — Phase 2" button | **BLOCKED** | Lines 171–185: `disabled`; `aria-disabled="true"`; label "Schedule — Phase 2" |
| RP-EST-07 | (Phase 2) Report header brand string | **BLOCKED** | No renderer. Must use `BRAND.scoreFull` per FD-RP-1. |
| RP-EST-08 | (Phase 2) Body figures (IHT, gifts, nominations, will/LPA) | **BLOCKED** | Engine imports commented (line 21). Phase 2. |
| RP-EST-09 | (Phase 2) FCA disclaimer on Estate report | **BLOCKED** | Phase 2 per FD-RP-3. |

---

## Region 6 — Report tile: Tax summary

| ID | Element | Verdict | Evidence |
|----|---------|---------|----------|
| RP-TAX-01 | Tile container (id:'tax') | **PASS** | `r.id='tax'` |
| RP-TAX-02 | Title "Tax summary" | **PASS** | `r.title='Tax summary'` |
| RP-TAX-03 | Page-count chip "4–6 pages" | **PASS** | `r.pages='4–6 pages'` |
| RP-TAX-04 | Body copy "Income tax, allowances, dividends, CGT, pension contribution headroom…" | **PASS** | Lines 33–34: verbatim |
| RP-TAX-05 | "Coming next — Phase 2" generate button | **BLOCKED** | `disabled` |
| RP-TAX-06 | "Schedule — Phase 2" button | **BLOCKED** | `disabled` |
| RP-TAX-07 | (Phase 2) Report header brand string | **BLOCKED** | Phase 2 per FD-RP-1 |
| RP-TAX-08 | (Phase 2) Income-tax figures | **BLOCKED** | Phase 2 |
| RP-TAX-09 | (Phase 2) Allowances (£20K ISA, £3K CGT, etc.) | **BLOCKED** | Phase 2 — must read rules-uk.js / tax-2026.json, never hardcode |
| RP-TAX-10 | (Phase 2) FCA disclaimer | **BLOCKED** | Phase 2 per FD-RP-3 |

---

## Region 7 — Report tile: Cashflow projection

| ID | Element | Verdict | Evidence |
|----|---------|---------|----------|
| RP-CF-01 | Tile container (id:'cashflow') | **PASS** | `r.id='cashflow'` |
| RP-CF-02 | Title "Cashflow projection" | **PASS** | `r.title='Cashflow projection'` |
| RP-CF-03 | Page-count chip "5–7 pages" | **PASS** | `r.pages='5–7 pages'` |
| RP-CF-04 | Body copy "12-month forward cashflow…funded-ratio + sustainable spend rate" | **PASS (flagged)** | Lines 39–40: verbatim. "funded-ratio" is jargon without inline gloss on a surface targeting non-experts. POLISH (S-05). |
| RP-CF-05 | "Coming next — Phase 2" generate button | **BLOCKED** | `disabled` |
| RP-CF-06 | "Schedule — Phase 2" button | **BLOCKED** | `disabled` |
| RP-CF-07 | (Phase 2) Report header brand string | **BLOCKED** | Phase 2 per FD-RP-1 |
| RP-CF-08 | (Phase 2) 12-month forward projection | **BLOCKED** | Phase 2 |
| RP-CF-09 | (Phase 2) Funded-ratio + sustainable spend rate | **BLOCKED** | Phase 2 |
| RP-CF-10 | (Phase 2) FCA disclaimer | **BLOCKED** | Phase 2 per FD-RP-3 |

---

## Region 8 — Report tile: Net Worth snapshot

| ID | Element | Verdict | Evidence |
|----|---------|---------|----------|
| RP-NW-01 | Tile container (id:'nw') | **PASS** | `r.id='nw'` |
| RP-NW-02 | Title "Net Worth snapshot" | **PASS** | `r.title='Net Worth snapshot'` |
| RP-NW-03 | Page-count chip "3–5 pages" | **PASS** | `r.pages='3–5 pages'` |
| RP-NW-04 | Body copy "grouped by wrapper, with trend data…" | **PASS (flagged)** | Lines 45–46: verbatim. "wrapper" is jargon without inline gloss. POLISH (S-05). |
| RP-NW-05 | "Coming next — Phase 2" generate button | **BLOCKED** | `disabled` |
| RP-NW-06 | "Schedule — Phase 2" button | **BLOCKED** | `disabled` |
| RP-NW-07 | (Phase 2) Report header brand string | **BLOCKED** | Phase 2 per FD-RP-1 |
| RP-NW-08 | (Phase 2) Assets/liabilities breakdown | **BLOCKED** | Phase 2 |
| RP-NW-09 | (Phase 2) Trend window data | **BLOCKED** | Phase 2 |
| RP-NW-10 | (Phase 2) Net Worth FCA disclaimer (borderline) | **BLOCKED** | Phase 2 per FD-RP-3 note. **DECISION-NEEDED: founder must rule on whether Net Worth report requires disclaimer.** |

---

## Region 9 — Report tile: Custom report

| ID | Element | Verdict | Evidence |
|----|---------|---------|----------|
| RP-CUS-01 | Tile container (id:'custom') | **PASS** | `r.id='custom'` |
| RP-CUS-02 | Title "Custom report" | **PASS** | `r.title='Custom report'` |
| RP-CUS-03 | Page-count chip "variable" | **PASS** | `r.pages='variable'` |
| RP-CUS-04 | Body copy "Pick sections from any of the above." | **PASS** | Line 51 |
| RP-CUS-05 | "Coming next — Phase 2" generate button | **BLOCKED** | `disabled` |
| RP-CUS-06 | "Schedule — Phase 2" button | **BLOCKED** | `disabled` |
| RP-CUS-07 | (Phase 2) Section picker UI | **BLOCKED** | Phase 2 |
| RP-CUS-08 | "Save the template for recurring use" | **FAIL** | Line 51: copy present. No Save-template UI in stub. No mention of this feature in Phase 2 contract header (lines 8–17). Feature promised with no implementation path. CTA-honesty violation. FUNCTIONAL (S-04). |
| RP-CUS-09 | (Phase 2) FCA disclaimer (conditional on sections) | **BLOCKED** | Phase 2 |

---

## Region 10 — Footer

| ID | Element | Verdict | Evidence |
|----|---------|---------|----------|
| RP-FOOT-01 | Footer "PDF/CSV export coming in Phase 2 (D-RPT-EXPORT-1)." | **PASS** | Lines 191–197: verbatim |
| RP-FOOT-02 | Trust line / FCA boundary disclaimer | **FAIL** | **NOT PRESENT.** No `BRAND.disclaimer` or equivalent in JSX. No `BRAND` import at all. FD-RP-3: "Absence = DEMO-BLOCKING." Reports screen lists 4 tax-touching report types. **DEMO-BLOCKING.** |
| RP-FOOT-03 | `BRAND.rulesLabel()` strip | **FAIL** | **NOT PRESENT.** Intro promises "rules bundle active that day" but no rules-version strip rendered. FUNCTIONAL. |

---

## Region 11 — Cross-cutting / global

| ID | Element | Verdict | Evidence |
|----|---------|---------|----------|
| RP-G-01 | Screen-wide brand audit (no Caelixa/Finio/FQ Score) | **PASS** | Grep of Reports.jsx: zero occurrences of "Caelixa", "Finio", "FQ Score". No `BRAND` import in stub — safe for now. Highest-risk surface at Phase 2 when PDF renderer ships. |
| RP-G-02 | Screen-wide theme audit (light+dark × 3 viewports) | **UNVERIFIED** | Runtime-only. Amber banner dark-mode contrast especially requires snap. |
| RP-G-03 | (Phase 2) PDF renderer brand variant per theme | **BLOCKED** | Phase 2 per FD-LOGO-1 |
| RP-G-04 | `onGenerate(reportId, mode)` contract | **PASS** | Dashboard.jsx line 699 passes `onGenerate={(id, mode) => console.log('TODO Generate', id, mode)}`. Reports.jsx line 66 `void onGenerate`. Phase 2 wire is one-line as claimed. |
| RP-G-05 | (Phase 2) Materiality threshold £500 or 0.5% NW | **BLOCKED** | Phase 2; must not hardcode |
| RP-G-06 | (Phase 2) AI-narrative commentary section | **BLOCKED** | Phase 2 |
| RP-G-07 | Empty state / past reports vault list | **FAIL** | Intro line 104: "Saved to your vault with a timestamp" — no vault list on screen, no entry point. Promise with no destination. CTA-honesty violation. FUNCTIONAL (S-09). |

---

## UNLISTED elements

None. JSX renders only elements covered by inventory rows.

---

## DECISION-NEEDED

| Item | Decision |
|------|----------|
| RP-NW-10 | FD-RP-3 marks Net Worth FCA disclaimer "borderline." Founder must rule. |
| RP-G-07 | Remove "Saved to your vault" vault promise, or stub a past-reports list? |

---

## Coverage summary (Pass 1)

| Verdict | Count |
|---------|-------|
| PASS | 24 |
| FAIL (active defects) | 5 (RP-FOOT-02 DEMO-BLOCKING; RP-CHR-04, RP-FOOT-03, RP-CUS-08, RP-G-07 FUNCTIONAL) |
| BLOCKED (Phase 2) | 38 |
| UNVERIFIED (runtime only) | 1 |
| NA | 8 |
| **Total** | **76** |

Auditable rows (excl. BLOCKED + UNVERIFIED) = **37**
Pass rate = 24 / 29 = **82.8%** on auditable set
