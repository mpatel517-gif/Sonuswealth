---
Title: Home Screen — Reconciliation Audit (A6) — Stage B Pass-1
Version: pass-1-stage-b
Date: 2026-05-18
Auditor: A6 — Reconciliation
Screen: HomeScreen.jsx v2.1
---

## Method

Walk every numeric row. Tests:
1. Engine-traced: does every number come from an engine function call?
2. Internal consistency: same metric shown twice agrees value AND format.
3. Cross-screen: NW / Wealth Score / Risk Score / CoI use same engine fn as MyMoney.jsx?
4. CoI is `totalCoI()` aggregate (12 domains), not single-domain `costOfInaction(domain)`.
5. Count reconciliation: stated counts match what renders.

---

## 1. Engine tracing — anchor row

| Metric | Build call | Hardcoded? | Verdict | Notes |
|--------|-----------|-----------|---------|-------|
| Net Worth | `netWorth(entity)` via `useMemo` in HomeScreen | NO | PASS | `fmt(nw)` used for display |
| Wealth Score | `calcFQ(entity).total` via `useMemo` | NO | PASS | |
| Risk Score | `calcRisk(entity).total` via `useMemo` | NO | PASS | |
| Cost of Inaction (AnchorRow) | `costOfInaction(entity)` at L292: `const coiTotal = safe(() => { const c = costOfInaction(entity); return typeof c === 'number' ? c : (c?.total || 0) }, 0)` | NO | **FAIL — A6** | Uses `costOfInaction()` (single-call back-compat wrapper), not `totalCoI()` directly. `costOfInaction()` with no domain arg maps to `totalCoI(e).total` per fq-calculator.js L605 — technically correct, but inconsistent with `CoIDrillPanel` which calls `totalCoI(entity)` directly at L946. Not a value error, but an A6 call-site inconsistency. |
| SIPP-IHT exposure (SippIhtCountdown) | `costOfInaction(entity, 'sipp_iht')` at L436 | NO | PASS | Domain-specific call is correct |
| CoI breakdown (CoIDrillPanel) | `totalCoI(entity)` at L946 | NO | PASS | Aggregate 12-domain call |
| Plan target value | `planFor(entity, 'retirement')` fields | NO | PASS | `plan.target` / `plan.progress` — engine-derived |
| SIPP IHT deadline date | `new Date('2027-04-06')` | YES (constant) | PASS | Regulatory constant — acceptable; not a financial figure |
| SIPP IHT enacted date | `new Date('2026-03-18')` | YES (constant) | PASS | Regulatory constant — correct (Royal Assent 18 Mar 2026) |

---

## 2. Internal consistency

### Net Worth format

- AnchorRow H-ANCH-01: `fmt(nw)` — uses shared `fmt()` formatter ✓
- RadarAnchor CenterCap: `fmtNW(n)` — **SEPARATE formatter** defined locally in RadarAnchor.jsx:
  ```js
  function fmtNW(n) {
    if (!n) return '£0'
    if (n >= 1e6) return `£${(n / 1e6).toFixed(n >= 10e6 ? 0 : 2)}M`  // → "£3.63M" (capital M)
    if (n >= 1e3) return `£${Math.round(n / 1e3)}k`
    return `£${Math.round(n)}`
  }
  ```
  The shared `fmt()` from fq-calculator.js uses `m` (lowercase) for millions. So:
  - AnchorRow: `fmt(3_630_000)` → `£3.63m` (lowercase m)
  - RadarAnchor CenterCap: `fmtNW(3_630_000)` → `£3.63M` (uppercase M)
  
  **This is seed S-06 — CONFIRMED FAIL.** Same metric, same entity, different format on same screen.

| ID | Verdict | Severity |
|----|---------|----------|
| H-ANCH-01 ↔ H-RAD-09 (seed S-06) | **FAIL** | FUNCTIONAL | Net Worth shown as `£3.63m` in anchor and `£3.63M` in radar centre — `fmt()` vs `fmtNW()` |

### CoI value consistency

- AnchorRow H-ANCH-04: `costOfInaction(entity)` → `totalCoI(e).total` (back-compat)
- CoIDrillPanel: `totalCoI(entity).total` — same value via different call path
- SippIhtCountdown: `costOfInaction(entity, 'sipp_iht')` — domain subset, different figure

The H-ANCH-04 CoI and CoIDrillPanel total should agree since both resolve to `totalCoI().total`. Value should be consistent. No direct duplicate display of the same metric in different formats observed (seed S-05 — CoI 2031 figure — relates to a projection in brief/radar which requires runtime verification).

### Seed S-05 status (H-ANCH-04c ↔ H-RAD-11)

The inventory flagged "CoI 2031 figure shown as £610K and £612K". H-ANCH-04 shows current CoI, not 2031 projection. H-RAD-11 is the brief insight which may show a projected figure. This discrepancy depends on how the brief calculates the forward-projection vs the anchor's current CoI. Cannot fully resolve without runtime — marked UNVERIFIED for numeric value.

### Score consistency

- Wealth Score: AnchorRow and RadarAnchor CenterCap both use `calcFQ(entity).total` from same `fq` useMemo — consistent ✓
- Risk Score: AnchorRow uses `calcRisk(entity).total` from same `risk` useMemo — consistent ✓

---

## 3. Cross-screen engine consistency

| Metric | HomeScreen call | MyMoney.jsx call | Match? |
|--------|----------------|-----------------|--------|
| Net Worth | `netWorth(entity)` (fq-calculator.js) | `netWorth(entity)` (fq-calculator.js) | PASS |
| Wealth Score | `calcFQ(entity)` (fq-calculator.js) | `calcFQ(entity)` (fq-calculator.js) | PASS |
| Risk Score | `calcRisk(entity)` (fq-calculator.js) | `calcRisk(entity)` (fq-calculator.js) | PASS |
| CoI | `costOfInaction(entity)` → `totalCoI().total` | `totalCoI(entity)` directly | PASS (functionally equivalent) |
| format | `fmt()` from fq-calculator.js | `fmt()` from fq-calculator.js | PASS (but RadarAnchor uses own `fmtNW`) |

---

## 4. CoI aggregate check

Specification: CoI must be `totalCoI()` aggregate across all 12 domains — not single-domain `costOfInaction(domain)`.

- H-ANCH-04 display: `costOfInaction(entity)` with no domain arg → fq-calculator L592: "back-compat (totalCoI(e).total)" → resolves to 12-domain aggregate ✓
- CoIDrillPanel: `totalCoI(entity)` explicitly — 12-domain ✓

**Audit note:** the `COI_DOMAIN_META` in HomeScreen.jsx lists only 10 domains (drawdown, wrapperSequencing, contributions, taxAllowances, estatePlanning, protection, debt, gifting, propertyDecisions, investmentStrategy). The `totalCoI()` engine aggregates 12. Missing from UI meta: `sipp_iht` and one other domain (check fq-calculator.js `byDomain`). This means the CoIDrillPanel domain breakdown may under-count vs the displayed total — domains with value but absent from `COI_DOMAIN_META` won't show a row.

| ID | Verdict | Severity | Notes |
|----|---------|----------|-------|
| CoI aggregate (H-ANCH-04) | PASS | — | Resolves to totalCoI aggregate |
| CoIDrillPanel breakdown | **FAIL** | FUNCTIONAL | `COI_DOMAIN_META` has 10 keys; `totalCoI()` engine has 12+ domains. Rows with value in missing domains are silently dropped from the breakdown. Total displayed ≠ sum of visible rows. |

---

## 5. Count reconciliation

| ID | Stated count | Rendered count | Verdict |
|----|-------------|----------------|---------|
| H-WI-06 "See all 12 scenarios" | `DE_SCENARIOS.length` (dynamic) | `DE_SCENARIOS` array has 12 entries | PASS |
| H-ACT-SEE "See all N →" | `actions.length` (dynamic) | `calcAPQ(entity)` result | PASS |
| H-RAD-08 gap markers | `gapCount` from `gapDims(fqData)` | Driven by `GAP_THRESH` + dimension values | PASS |
| H-ACT-00 action row count ("6") | Header doesn't show count | `actions.slice(0, 6)` renders up to 6 | FUNCTIONAL — no count label in header |
| H-RAD-00 "7 dimensions" | 7 (hardcoded in copy if present) | `DIMENSIONS` array length | UNVERIFIED — depends on dimensions.js |

---

## Summary of reconciliation findings

| ID | Severity | Element | Issue |
|----|----------|---------|-------|
| REC-01 | FUNCTIONAL | H-ANCH-01 ↔ H-RAD-09 (seed S-06 confirmed) | Net Worth displayed as `£3.63m` (AnchorRow, using `fmt()`) vs `£3.63M` (RadarAnchor CenterCap, using local `fmtNW()`) — same screen, different capitalisation |
| REC-02 | FUNCTIONAL | CoIDrillPanel breakdown | `COI_DOMAIN_META` has 10 domains; `totalCoI()` aggregates 12+. Any extra-domain CoI value is silently excluded from the breakdown rows, meaning total ≠ sum of visible rows |
| REC-03 | NOTE | H-ANCH-04 CoI call | Uses `costOfInaction(entity)` not `totalCoI(entity)` directly. Functionally equivalent (back-compat alias), but creates call-site inconsistency vs CoIDrillPanel. Low severity — note for cleanup. |
| REC-04 | UNVERIFIED | Seed S-05 (H-ANCH-04c ↔ H-RAD-11) | Brief insight CoI projection vs anchor CoI — requires runtime check to confirm or deny £610K/£612K discrepancy |

Total: 0 DEMO-BLOCKING, 2 FUNCTIONAL, 1 NOTE, 1 UNVERIFIED
