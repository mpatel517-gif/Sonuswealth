# A6 — Reconciliation Audit · Reports · Pass 1
**Date:** 2026-05-18
**Auditor:** A6 (Reconciliation)
**Source:** `src/screens/Reports.jsx` · `src/config/brand.js` · `reports-inventory-v1.md`
**Scope:** Every numeric or engine-sourced value in the current stub. Phase 2 forward-look rows noted.

---

## Context

Reports.jsx is a Phase-3 stub. **No engine figures are rendered on screen.** All engine imports are commented out (line 21). The screen renders only:
- Static copy strings (tile titles, body text, page-count strings)
- UI chrome (buttons, fieldset, banner)

There are **zero live numeric figures on screen.** A6 reconciliation for Phase 1 (stub) is therefore primarily about:
1. Whether pre-declared claims (page counts, date facts) trace to authoritative sources
2. Whether BRAND values are correctly referenced (they are NOT — BRAND is not imported)
3. Whether the Phase 2 engine contract in the header comment is complete and correct

---

## Live figures on screen — Pass 1

### None.

No `netWorth`, no `ihtDynamic`, no `costOfInaction`, no tax figures, no cashflow values. All engine imports commented. The `REPORT_TYPES` array contains only descriptor strings.

---

## Pre-declared claims audit

### Page-count chips

These are claims about Phase 2 PDF output, not live engine figures. They cannot be reconciled to an engine function — they are design-time estimates that must be verified when Phase 2 generation ships.

| Row | Claimed pages | Reconcilable now? | Verdict |
|-----|--------------|-------------------|---------|
| RP-EST-03 | 6–8 pages | No — Phase 2 scope | BLOCKED |
| RP-TAX-03 | 4–6 pages | No — Phase 2 scope | BLOCKED |
| RP-CF-03 | 5–7 pages | No — Phase 2 scope | BLOCKED |
| RP-NW-03 | 3–5 pages | No — Phase 2 scope | BLOCKED |
| RP-CUS-03 | variable | NA | NA |

**A6 flag for Phase 2:** when PDF generation lands, page-count chips must be verified against actual rendered page counts. If actual output lands outside the claimed range, chips are misleading.

### Date claim — SIPP-IHT "April 2027 (enacted)"

- **Row:** RP-EST-04 (line 27 of Reports.jsx)
- **Claim:** "SIPP enters estate from April 2027 (enacted)"
- **SoT check:** Memory `project_sipp_iht_enacted_2026` — Royal Assent 18 March 2026; effective April 2027. Factually correct.
- **Format check:** `BRAND.nextRulesDate = '2027-04-06'` in brand.js. The copy uses "April 2027" which matches the month but is a **hardcoded string**, not bound to `BRAND.nextRulesDate`.
- **Drift risk:** If rules change (e.g. effective date deferred by statutory instrument), this copy must be manually updated rather than auto-updating.
- **Verdict:** Factually correct today but FUNCTIONAL defect — should be `BRAND.nextRulesDate` template, not hardcoded.

### Rules-bundle promise

- **Row:** RP-INT-01 (line 103)
- **Claim:** "generated from your current data + the rules bundle active that day"
- **SoT:** `BRAND.rulesVersion = 'UK-2026.1'`, `BRAND.rulesLabel()`, `BRAND.dataDate = 'April 2026'`
- **Rendered?** NO. `BRAND` is not imported. No rules-version strip on screen.
- **Verdict:** Promise made, not fulfilled. FUNCTIONAL (RP-FOOT-03).

---

## Engine contract completeness (header comment check)

The Phase 2 contract in lines 8–17 lists these engine reads:

```
netWorth · ihtDynamic · costOfInaction · incomeTax ·
cashflowHealth · trajectoryData · calcFQ · calcRisk
```

| Engine function | Report type that needs it | In fq-calculator.js? | Notes |
|----------------|--------------------------|----------------------|-------|
| `netWorth` | Net Worth, Estate, Custom | To verify (import path commented) | BRAND.netWorth string exists; engine fn assumed |
| `ihtDynamic` | Estate plan | To verify | Used on T&E screen |
| `costOfInaction` | Estate plan | To verify | Used on T&E screen |
| `incomeTax` | Tax summary | To verify | Used on T&E screen |
| `cashflowHealth` | Cashflow projection | To verify | Used on Cashflow screen |
| `trajectoryData` | Cashflow projection | To verify | Used on Cashflow screen |
| `calcFQ` | Net Worth, general | To verify | Core engine function |
| `calcRisk` | Risk sections | To verify | Core engine function |

**A6 verdict:** Contract is plausible (functions appear on other screens per prior audits) but cannot be verified until import is uncommented. Phase 2 must confirm each function exists in `fq-calculator.js` at the exact named export before generation wires.

---

## Cross-screen reconciliation (Phase 2 forward-look)

Per FD-CROSS-1 and the inventory spec rule: "Every figure in a generated report must equal the same figure on its source surface in the same `fmt()` format."

| Report figure | Source surface | Expected engine call | Risk |
|--------------|----------------|---------------------|------|
| Net Worth | Home / My Money | `netWorth(entity)` | Must equal Home's H-ANCH-01 and MyMoney's net worth card — same `fmt()` applied |
| IHT exposure | Tax & Estate | `ihtDynamic(entity)` | Must equal T&E's IHT projection — same `fmt()` applied |
| Cost of Inaction | Tax & Estate | `costOfInaction(entity)` | Must equal T&E's CoI pill (cross-surface CoI reconciliation known issue from Home audit) |
| Income tax | Tax & Estate | `incomeTax(entity)` | Must equal T&E's income-tax breakdown |
| Cashflow / funded-ratio | Cashflow | `cashflowHealth(entity)` | Must equal Cashflow's funded-ratio gauge |
| Wealth Score (FQ) | Home / reports header | `calcFQ(entity)` | Must equal Home score — same `scoreShort` format |
| Risk Score | Risk | `calcRisk(entity)` | Must equal Risk screen risk band |

**None of these can be verified until Phase 2 generation ships.** All BLOCKED.

---

## Materiality threshold

- **Spec claim:** £500 or 0.5% NW (line 17 header comment)
- **Rendered on screen?** No.
- **SoT:** Must read from `BRAND` constant or engine constant — not hardcode.
- **Current status:** Not implemented. Phase 2 concern.

---

## Summary

| Category | Verdict |
|----------|---------|
| Live engine figures on screen | None — correct for stub phase |
| SIPP-IHT date claim | Correct fact; hardcoded string (FUNCTIONAL) |
| Rules-bundle promise | Made but not rendered (FUNCTIONAL) |
| Page-count chips | Unverifiable claims (BLOCKED, verify at Phase 2) |
| Engine contract completeness | Plausible; cannot confirm until import uncommented |
| Cross-screen reconciliation | All BLOCKED until Phase 2 |

**Pass 1 A6 conclusion:** No live figure mismatches because no live figures exist. The two reconciliation defects are both deferred-promise failures (rules-version strip and SIPP date hardcoding) — both FUNCTIONAL severity.
