# Tax & Estate — Pass-1 Audit SUMMARY
**Date:** 2026-05-18
**Auditors run:** A1 Conformance · A2/A3/A4 Interaction · A6 Reconciliation · A5 Domain · Scenario
**Inventory:** `tax-estate-inventory-v1.md` · 227 rows · 34 regions
**Component:** `src/screens/TaxEstate.jsx` (2551 lines) + `InheritanceStory.jsx` + `BeneficiarySankey.jsx` + `uk-estate-2026-1-1.js` + `tax-estate-engine.js`

---

## 1 — Finding counts (by severity)

| Auditor | DEMO-BLOCKING | FUNCTIONAL | POLISH | Notes |
|---------|:---:|:---:|:---:|-------|
| A1 Conformance | 1 | 0 | 0 | 226/227 PASS |
| A2/A3/A4 Interaction | 3 | 22 | 2 | 18 PASS, 27 FAIL |
| A6 Reconciliation | 2 | 18 | 5 | 13 PASS, 25 FAIL |
| A5 Domain | 4 | 24 | 12 | 19 PASS, 40 FAIL (64-row scope) |
| Scenario | 6 | 12 | 4 | 0 PASS — no time projections exist |
| **UNIQUE deduped** | **8** | **~40** | **~15** | Multi-auditor overlaps collapsed |

Raw totals pre-dedup: 16 DB · 76 F · 23 P. Deduped: ~63 findings.

---

## 2 — All DEMO-BLOCKING findings

| DB# | ID(s) | Finding | Fix |
|-----|-------|---------|-----|
| DB-1 | TE-EST-IS-10 / TE-EST-IS-11 | `<InheritanceStory entity={entity} />` at TaxEstate.jsx:2438 is missing `onDrillMetric` prop. The `cta='beneficiaries'` line silently no-ops via `onDrillMetric?.()`. Footer "Tap any line to see the calculation behind it" actively lies. Two-layer dead: prop absent AND `driver-engine.js` has no `beneficiaries` case. | TaxEstate.jsx:2438 — add `onDrillMetric={onDrillMetric}`; driver-engine.js — add `beneficiaries` case |
| DB-2 | TE-PLAN-05 | `onDrillMetric('plan:estate')` etc. via PlanStalenessAccordion hits `terminal('plan:estate', 0, 'Driver tree pending')` at driver-engine.js:48. Three plans, three dead drills. | driver-engine.js — add `plan:estate`, `plan:gift`, `plan:tax` cases |
| DB-3 | TE-EST-WL-03 | Cohabiting RED banner ("the single highest-risk gap") is a static `<div>` with no onClick. Names the gap, provides no path to fix it. TaxEstate.jsx:1294-1305. | Add `<button>` routing to will/LPA data-capture flow |
| DB-4 | TE-EST-COI-01 | EstateCoIOdometer reads `totalCoI(e).byDomain.estatePlanning` (domain slice). Home reads total `costOfInaction(e)`. MyMoney reads `totalCoI(e).total`. Same "Cost of Inaction" label, three different numbers. Violates FD-CROSS-1 + skill v1.4 §2.7. | TaxEstate.jsx:1507 — change to `coi?.total || 0`; add estate-slice sub-breakdown below |
| DB-5 | TE-EST-IHT-07 | "After 6 Apr 2027" tile uses `ihtDynamic(entity, true)` + manual reshape (TaxEstate.jsx:922–937). IHTDrillPanel uses `te_ihtExposure(entity)` (line 1857). Two paths for the same number — can show different `iht_due` values for the same entity in the same session. | Unify: call `te_ihtExposure(entity, bundle, { postPension: true })` in both places |
| DB-6 | TE-EST-BPR-07 | Chip "Post-30-Oct-2024 trusts: 50% above **£1m**" is **factually wrong**. `UK-2026.1.1.json:142-143` states `aprBprCombinedAllowance = 2500000` ("100% within £2.5m, 50% above"). £1m is from superseded consultation papers. £1.5m-per-person factual error on the domain-correctness screen. | TaxEstate.jsx:1482 — replace `'£1m'` with `fmt(TAX_JSON.inheritanceTax.aprBprCombinedAllowance)` |
| DB-7 | TE-EST-WF-04/05/06 | IHT waterfall sliders feed `useState({ sippDraw,gift,bpr })` local-state only. `ihtWaterfall(entity, deltas)` recomputes the in-card bar only. Triple anchor, CoI odometer, IHT dual-number stay frozen. A scenario that doesn't propagate to the page is a toy. Also: gifts slider has no date axis despite engine accepting `gift_date`. | TaxEstate.jsx:1025 — wire deltas to entity scenario context; propagate so anchors/CoI recompute |
| DB-8 | Screen-wide | **Zero year-by-year IHT projections exist.** FD-CROSS-1 mandates "year-by-year consequence view". `ihtProjection` / `ihtTimeline` functions are absent from both `tax-estate-engine.js` and `TaxEstate.jsx`. Every scenario element is a single-shot snapshot. The screen's central narrative (6 Apr 2027 SIPP-IHT reform) demands a year-by-year IHT chart that does not exist. | New: add `ihtYearByYear(entity, horizonYears)` to engine; render as chart on Estate sub-tab |

---

## 3 — Coverage

```
Total inventory rows:    227
Rows with verdict:       227 / 227 — Coverage 100%

Audit pass-rates (per auditor):
  A1 Conformance:          226 PASS / 1 FAIL    = 99.6%
  A2/A3/A4 Interaction:     18 PASS / 27 FAIL   = 40.0%
  A6 Reconciliation:        13 PASS / 25 FAIL   = 34.2%
  A5 Domain (64-row scope): 19 PASS / 40 FAIL   = 32.2%
  Scenario (22-row scope):   0 PASS / 22 FAIL   =  0.0%

Seed findings confirmed: 21 / 21 (100%)
New findings beyond seeds: 3 (DB-6 BPR £1m error; DB-8 no year-by-year trajectory; BPRDrillPanel wrong rate taxonomy)

FD-TE-1 (SIPP IHT ENACTED): PASS — "Enacted · FA 2026" chip + TE-1 explainer correct
FD-NAME-1 (no Sonuswealth/Finio): PASS — 0 matches in TaxEstate.jsx
```

---

## 4 — Top 3 fix priorities

### Priority 1 — Wire `onDrillMetric` into InheritanceStory + add driver cases (DB-1, DB-2)
Two one-line changes.

1. `TaxEstate.jsx:2438`:
   ```jsx
   // BEFORE
   <InheritanceStory entity={entity} />
   // AFTER
   <InheritanceStory entity={entity} onDrillMetric={onDrillMetric} />
   ```
2. `src/engine/driver-engine.js` — add cases for `beneficiaries`, `plan:estate`, `plan:gift`, `plan:tax` so drills land on SOURCE/DECISION surfaces rather than "Driver tree pending".

Without (1), the footer "Tap any line to see the calculation behind it" is an active lie on the primary lead card. Without (2), even the fixed prop lands on a dead frame.

---

### Priority 2 — Fix the £1.5m BPR factual error + unify IHT engine path (DB-6, DB-5)

1. `TaxEstate.jsx:1482` — replace `'£1m'` with the engine value. Any IFA reviewing this screen in a demo will catch it immediately.

2. `TaxEstate.jsx:922-937` — remove the manual `ihtDynamic(entity, true)` reshape inside `IHTDualNumber`. Call `te_ihtExposure(entity, bundle, { postPension: true })` for the After-2027 branch. The `IHTDrillPanel` already calls `te_ihtExposure`; making the dual-number use the same path eliminates the cross-card divergence.

---

### Priority 3 — Fix CoI cross-screen consistency + wire 5 dead sub-anchors (DB-4 + FUNCTIONAL)

1. `TaxEstate.jsx:1507` — change `byDomain.estatePlanning` to `total`. Add a sub-breakdown row showing the estate-planning share if wanted.

2. Add `onTap` to 5 sub-anchors that currently have none (TE-SUB-T1 → tax detail, TE-SUB-T2 → ANI scroll, TE-SUB-T3 → `setDrillView('allowances')`, TE-SUB-E1 → `setDrillView('iht')`, TE-SUB-E2 → scroll to BeneficiaryChain). The pattern is already set by TE-SUB-E3 (`scrollToIHTDual`). Five ≤5-minute fixes removing 5 FUNCTIONAL dead taps from the highest-visibility strip on the screen.

---

## Appendix — Seed confirmation status

All 21 pre-seeded findings confirmed in code:

| Seed | ID | Confirmed | Severity |
|------|----|-----------|---------|
| S-01 | TE-EST-IS-10/11 | YES | DB (DB-1) |
| S-02 | TE-EST-IS-07a | YES | FUNCTIONAL (InheritanceStory.jsx:94 £325k literal) |
| S-03 | TE-EST-RN-03 | YES | FUNCTIONAL (TaxEstate.jsx:1407-1408 RNRB taper hardcode) |
| S-04 | TE-DRL-IHT-06/07 | YES | FUNCTIONAL (TaxEstate.jsx:1861-1862 nilRate/rnrb fallback) |
| S-05 | TE-DRL-IHT-10 | YES | FUNCTIONAL→POLISH (TaxEstate.jsx:1875 "IHT @ 40%" literal) |
| S-06 | TE-DRL-CGT-11/12 | YES | FUNCTIONAL (TaxEstate.jsx:1738-1739 CGT 18%/24% hardcoded) |
| S-07 | TE-DRL-CGT-09 | YES | FUNCTIONAL (TaxEstate.jsx:1736 CGT exempt ?? 3000) |
| S-08 | TE-DRL-AL-05..09 | YES | FUNCTIONAL (TaxEstate.jsx:2007-2011 allowance fallbacks) |
| S-09 | TE-DRL-AL-06/09 | YES | FUNCTIONAL (PSA/PA desc hardcoded) |
| S-10 | TE-TAX-IT-03 | YES | FUNCTIONAL (TaxEstate.jsx:451 taper 100000 hardcoded) |
| S-11 | TE-DRL-BPR-04 | YES | FUNCTIONAL+DOMAIN (BPRDrillPanel regex-based rate = wrong taxonomy) |
| S-12 | TE-TAX-IT-05 | YES | POLISH (band labels raw engine keys) |
| S-13 | TE-TAX-ALL-07 | YES | FUNCTIONAL (cash-ISA £12k/£8k hardcoded) |
| S-14 | TE-TAX-DIV-03/04/05 | YES | FUNCTIONAL (dividend rates hardcoded) |
| S-15 | TE-EST-IHT-07 | YES | DB (DB-5 engine path divergence) |
| S-16 | TE-EST-COI-01 | YES | DB (DB-4 CoI slice vs total) |
| S-17 | TE-SUB-E1/E3 + IHT | YES | DB (subsumed by DB-4/DB-5) |
| S-18 | TE-EST-WL-03 | YES | DB (DB-3) |
| S-19 | TE-EST-NM-02 | YES | FUNCTIONAL (no nominee CTA) |
| S-20 | TE-TAX-CGT-06 / TE-TAX-DIV-07 | YES | FUNCTIONAL (opportunity chips non-interactive) |
| S-21 | global jargon | YES | POLISH (BPR/APR/RNRB/NRB/AIM/FIG/TRF/LPA unexplained) |

New findings beyond seeds:
- **DB-6** — TE-EST-BPR-07 £1m vs £2.5m factual error (not pre-seeded — new DB)
- **DB-7** — TE-EST-WF-04/05/06 sliders don't push to entity (S-26 partial; upgraded to DB)
- **DB-8** — No year-by-year IHT projection anywhere on screen (structural absence confirmed)
- TE-EST-BPR-07 cross-confirms with MyMoney pass-1 BPR error (same bug, two screens)
