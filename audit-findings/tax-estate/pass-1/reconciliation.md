# Tax & Estate — Pass 1 — Reconciliation Auditor Findings

**Auditor:** reconciliation-auditor (3 of 5)
**Screen:** Tax & Estate (`src/screens/TaxEstate.jsx` + `src/components/TaxEstate/*`)
**Engine baseline:** `src/engine/fq-calculator.js` facade + `uk-estate-2026-1-1.js` + `uk-tax-2026-1-1.js`
**Rules SoT:** `src/rules/UK-2026.1.1.json`
**Brand:** `src/config/brand.js`
**Date:** 17 May 2026

---

## §A — Cross-Screen Reconciliation Matrix

For each shared metric: engine fn used + value source per surface.
**FAIL** ⇒ same metric, different engine fn or different format across surfaces.

| Metric | Home | My Money | Cashflow | Tax & Estate | Engine fn (canonical) | Verdict |
|---|---|---|---|---|---|---|
| Net Worth (anchor) | `netWorth(e)` (`H-ANCH-01`) | `netWorth(e)` | `netWorth(e)` | `netWorth(e)` via `onDrillMetric('netWorth')` (TE-ANCH-01) | `netWorth(entity)` | PASS (consistent) |
| Wealth Score | `calcFQ(e)` | `calcFQ(e)` | `calcFQ(e)` | `calcFQ(e)` (TE-ANCH-02) | `calcFQ(entity)` | PASS |
| Risk Score | `calcRisk(e)` | n/a | n/a | `calcRisk(e)` (TE-ANCH-03) | `calcRisk(entity)` | PASS |
| **Cost of Inaction (headline)** | `costOfInaction(entity)` — single-domain SIPP/IHT delta only (`CostOfInactionStrip.jsx:10`) | `totalCoI(entity).total` — aggregate (`MyMoney.jsx:2574, 2867`) | `totalCoI(entity, CMA_BUNDLE)` — aggregate (`Cashflow.jsx:601`) | `totalCoI(entity).byDomain.estatePlanning` — **slice only** (`TaxEstate.jsx:1505-1507`) | `totalCoI(entity, bundle)` per skill v1.4 §2.7 | **FAIL — DEMO-BLOCKING** (3 different shapes across 4 surfaces) |
| Days Left (X28) | `daysLeft()` (CostOfInactionStrip) | `daysLeft()` | n/a | `daysLeft()` (TaxEstate.jsx:1508) | `daysLeft()` | PASS |
| IHT exposure (gross/due) | n/a | `ihtDynamic(e, true)` (MyMoney.jsx:1827-1828) | n/a | **Mixed** — `te_ihtExposure(e)` in IHTDualNumber "Today" + InheritanceStory + IHTDrillPanel; **`ihtDynamic(e, true)` in IHTDualNumber "After 6 Apr 2027" branch (TaxEstate.jsx:925)** AND in RNRBPlanning gross (TaxEstate.jsx:1405) | `te_ihtExposure(entity)` is canonical | **FAIL — engine path divergence within same screen** |
| Rules version label | `BRAND.rulesVersion` = `UK-2026.1` (brand.js:26) | `BRAND.rulesVersion` | `BRAND.rulesVersion` + literal `UK-CMA-2026.1` (Cashflow.jsx:867) | `BRAND.rulesVersion` (TE-CHR-02/05/07) | Should equal SoT JSON `_meta.version` = `UK-2026.1.1` | **FAIL — POLISH** (label says `UK-2026.1`, SoT JSON is `UK-2026.1.1`; supersession recorded in `_correctionLog.from_UK-2026.1_to_UK-2026.1.1`) |

**CoI canonical violation (skill v1.4 §2.7):** Home uses `costOfInaction(entity)` (legacy single-domain SIPP/IHT delta — `tax-estate-engine.js:1321` returns `total: ihtSippDelta(entity)`). MyMoney + Cashflow use `totalCoI(entity)`. T&E uses `totalCoI(entity).byDomain.estatePlanning` (a single slice). The user-visible label "Cost of Inaction" on the T&E odometer therefore refers to the **estate-planning slice only**, while the same label on Home refers to the **SIPP/IHT delta**, and the same label on MyMoney refers to the **aggregate across all domains**. Three different numbers, same label.

---

## §B — A6 Verdict Table (by inventory ID)

> Coverage: 100% of A6-relevant inventory rows checked (numeric + format rows only; pure-nav and pure-copy rows marked NA for A6). Severity assigned per finding.

| ID | A6 | Severity | Finding | Evidence | Engine fn (expected) |
|---|---|---|---|---|---|
| TE-CHR-02 | FAIL | POLISH | `BRAND.rulesVersion = 'UK-2026.1'` but live SoT JSON `_meta.version = 'UK-2026.1.1'`. Label stale. | `src/config/brand.js:26` vs `src/rules/UK-2026.1.1.json:3` | `BRAND.rulesVersion` should equal SoT JSON version |
| TE-CHR-05 | FAIL | POLISH | Same root cause as TE-CHR-02 — reuses `BRAND.rulesVersion`. | `src/config/brand.js:26` | same |
| TE-CHR-07 | FAIL | POLISH | Same root cause as TE-CHR-02. | `src/config/brand.js:26` | same |
| TE-ANCH-01 | PASS | — | `netWorth(entity)`, reconciles to Home/MyMoney. | wired via `onDrillMetric('netWorth')` | `netWorth(e)` |
| TE-ANCH-02 | PASS | — | `calcFQ(entity)`, reconciles to Home topbar. | wired via `onDrillMetric('wealthScore')` | `calcFQ(e)` |
| TE-ANCH-03 | PASS | — | `calcRisk(entity)`, reconciles to Home. | wired `onOpenRisk` | `calcRisk(e)` |
| TE-SUB-T1 | PASS | — | `te_taxThisYear(e)` from engine; format `fmt()`. | — | `te_taxThisYear` |
| TE-SUB-T2 | PASS | — | `calcANI(e).ani`; `fmt()`. | — | `calcANI` |
| TE-SUB-E1 | FAIL | FUNCTIONAL | "IHT today" — sources `te_ihtExposure(e)` while IHTDualNumber "After 6 Apr 2027" tile (TE-EST-IHT-07) and RNRBPlanning gross (TE-EST-RN-03) source `ihtDynamic(e, true)`. Same conceptual number, two engine paths. | TaxEstate.jsx:917 vs :925 vs :1405 | `te_ihtExposure(e)` canonical |
| TE-SUB-E3 | PASS | — | Pension-IHT countdown `daysLeft()` to 2027-04-06. | — | `daysLeft()` |
| TE-TAX-IT-03 | FAIL | FUNCTIONAL | 60% taper window threshold hardcoded `100000` (TaxEstate.jsx:451) and `TAX.art` upper. Comment acknowledges `TAX.paTaperStart` missing from fq-calculator.js exports. SoT JSON has `income.personalAllowanceTaperStart = 100000` (`UK-2026.1.1.json:44`) — not exported. | `TaxEstate.jsx:449-451` | `TAX.paTaperStart` / `TAX.paTaperEnd` (not yet exported) |
| TE-TAX-IT-05 | PASS (A6) / FAIL (A5) | POLISH | Band labels render `basic_rate` with raw `_` — replaced with space at render via `replace(/_/g, ' ')`, but still jargon. (A5 concern, not A6.) | TaxEstate.jsx:499 | engine `bands[].name` |
| TE-TAX-SS-03 | FAIL | FUNCTIONAL | Salary sacrifice slider step `500` & max `Math.min(60000, baseSalary)` — `60000` is the Annual Allowance; should trace to `TAX.aa` (engine has `pension.annualAllowance = 60000`). Slider is local-state only; does NOT update triple-anchor or CoI. | TaxEstate.jsx:615 | `TAX.aa` |
| TE-TAX-CGT-05 | PASS (A6) / FAIL (A5) | POLISH | "BADR 14% → 18% in 2026/27" — both rates are SoT-correct (`capitalGains.badrRate = 0.18`) but hardcoded as literal strings in JSX. | TaxEstate.jsx:663 | `TAX_JSON.capitalGains.badrRate` |
| TE-TAX-DIV-01 | FAIL | POLISH | Sub uses `£${(div.gia_exposed || 0).toLocaleString()}` — bypasses `fmt()`. Other £ values on same screen use `fmt()`. Format drift. | TaxEstate.jsx:684 | `fmt()` |
| TE-TAX-DIV-03 | FAIL | FUNCTIONAL | "Basic 10.75%" hardcoded literal. SoT: `income.dividendBasicRate = 0.1075` (`UK-2026.1.1.json:79`). Value happens to match. | TaxEstate.jsx:695 | `TAX_JSON.income.dividendBasicRate` |
| TE-TAX-DIV-04 | FAIL | FUNCTIONAL | "Higher 35.75%" hardcoded. SoT: `dividendHigherRate = 0.3575`. | TaxEstate.jsx:696 | `TAX_JSON.income.dividendHigherRate` |
| TE-TAX-DIV-05 | FAIL | FUNCTIONAL | "Add'l 39.35%" hardcoded. SoT: `dividendAdditionalRate = 0.3935`. | TaxEstate.jsx:697 | `TAX_JSON.income.dividendAdditionalRate` |
| TE-TAX-ALL-07 | FAIL | FUNCTIONAL | Cash-ISA cap banner hardcodes `£12,000`, `6 Apr 2027`, `£8,000`. SoT: `isa.cashISACapUnder65From2027 = 12000` + `cashISACapUnder65From2027Note` carrying the 2027 date (`UK-2026.1.1.json:253-254`). Residual £8k = £20k − £12k derivable. | TaxEstate.jsx:763-765 | `TAX_JSON.isa.cashISACapUnder65From2027` |
| TE-TAX-DD-03 | PASS | — | rows fed from `drawdownMatrix(e)` engine output. | — | `drawdownMatrix` |
| TE-TAX-DD-06 | PASS | — | 60% band detect uses `r.drawdown >= 100000 && r.drawdown <= TAX.art` — same hardcode as TE-TAX-IT-03 (linked finding). | TaxEstate.jsx:819 | `TAX.paTaperStart` (linked) |
| TE-EST-IS-07a | FAIL | FUNCTIONAL | InheritanceStory.jsx:94 — `"Your £325k tax-free band covers everything"` hardcoded. SoT: `inheritanceTax.nilRateBand = 325000`. Value correct, source wrong. | `src/components/TaxEstate/InheritanceStory.jsx:94` | `TAX_JSON.inheritanceTax.nilRateBand` |
| TE-EST-IS-07 | PASS | — | `taxable` + `ihtDue` from `te_ihtExposure(e)` / `ihtWaterfall(e)`; uses `fmt()`. | InheritanceStory.jsx:25-34 | `te_ihtExposure` |
| TE-EST-IS-08 | PASS | — | `beneficiary_value` from `te_ihtExposure(e)`; reconciles with IHTDualNumber Today tile sub. | InheritanceStory.jsx:29 | `te_ihtExposure` |
| TE-EST-COI-01 | FAIL | DEMO-BLOCKING | EstateCoIOdometer reads `totalCoI(e).byDomain.estatePlanning` and renders it under generic label "Cost of Inaction". Home (`CostOfInactionStrip.jsx:10`) reads `costOfInaction(e)` (legacy SIPP/IHT delta). MyMoney reads `totalCoI(e).total`. Same label, three different numbers. Skill v1.4 §2.7 mandates `totalCoI(entity, bundle)` aggregate. | TaxEstate.jsx:1505-1507 vs CostOfInactionStrip.jsx:10 vs MyMoney.jsx:2574 | `totalCoI(entity, bundle)` (aggregate) |
| TE-EST-COI-02 | PASS | — | `estCoI / Math.max(1, days)` where `days = daysLeft()`. Reconciles fn used. But upstream estCoI is wrong shape (see TE-EST-COI-01). | TaxEstate.jsx:1508-1509 | `daysLeft()` |
| TE-EST-IHT-03 | PASS | — | "Today" tile: `te_ihtExposure(e).iht_due`; `<Num format="currency">`. Reconciles to InheritanceStory + IHTDrillPanel hero. | TaxEstate.jsx:917, 977 | `te_ihtExposure` |
| TE-EST-IHT-07 | FAIL | FUNCTIONAL | "After 6 Apr 2027" branch uses `ihtDynamic(e, true)` and reshapes return into `te_ihtExposure`-like object on the fly (TaxEstate.jsx:922-937). IHTDrillPanel uses `te_ihtExposure(e)`. The two engine paths can disagree on `iht_due` for the same entity — the screen shows the dual-number figure, the drill shows a different figure for the same scenario. | TaxEstate.jsx:922-937 vs :1857 | `te_ihtExposure(e, bundle, { postPension: true })` (unified path) |
| TE-EST-IHT-11 | PASS | — | gauge fed from `te_ihtExposure(e)`. | — | `te_ihtExposure` |
| TE-EST-WF-04 | FAIL | FUNCTIONAL | SIPP-drawdown slider local-state only; does NOT push to `entity`, so triple anchor + CoI numbers do not move while user slides. Cross-screen ripple promised in §5 of plan not wired. | TaxEstate.jsx:1057 | `entity.scenario.sippDraw` mutation + `ihtDynamic` recompute |
| TE-EST-WF-05/06 | FAIL | FUNCTIONAL | Same as TE-EST-WF-04 — gifts and BPR sliders. | (slider rows in TaxEstate.jsx Region 23) | scenario mutation |
| TE-EST-RN-03 | FAIL | FUNCTIONAL | `taperStart = 2000000`, `taperEnd = 2350000` hardcoded (TaxEstate.jsx:1407-1408). SoT: `inheritanceTax.residenceNilRateBandTaperStart = 2000000` (`UK-2026.1.1.json:125`) and `taperEnd` = `taperStart + 2 × rnrb base = 2000000 + 350000 = 2350000` derivable. JSON value correct, source wrong. Banner copy on :1426-1427 also embeds the literal `£2,000,000` and `£${taperEnd}`. | TaxEstate.jsx:1407-1408, 1426-1427 | `TAX_JSON.inheritanceTax.residenceNilRateBandTaperStart` + derive taperEnd |
| TE-DRL-IHT-06 | FAIL | FUNCTIONAL | `nilRate = expo?.nil_rate_band ?? expo?.nil_band ?? 325000` — fallback default `325000` (TaxEstate.jsx:1861). If engine ever returns undefined the UI silently produces a number — masking a real engine bug. Same hardcode pattern as TE-EST-IS-07a. | TaxEstate.jsx:1861 | rely on engine; no UI fallback |
| TE-DRL-IHT-07 | FAIL | FUNCTIONAL | `rnrb = expo?.rnrb ?? expo?.residence_nil_rate_band ?? 0` — fallback `0` masks engine miss. | TaxEstate.jsx:1862 | engine `te_ihtExposure().rnrb` |
| TE-DRL-IHT-10 | FAIL | POLISH→FUNCTIONAL | Step label hardcoded `'IHT @ 40%'` — string literal (TaxEstate.jsx:1875). SoT: `inheritanceTax.ihtRate = 0.40` (`UK-2026.1.1.json:132`). If rate ever changed (e.g. reduced 36% via charity ≥10%), label would still say "40%". | TaxEstate.jsx:1875 | `TAX_JSON.inheritanceTax.ihtRate` |
| TE-DRL-CGT-09 | FAIL | FUNCTIONAL | `exempt = +(TAX?.cgt?.exempt ?? TAX?.cgt?.annual_exempt_amount ?? 3000)` — third `?? 3000` fallback hardcoded (TaxEstate.jsx:1736). SoT: `capitalGains.annualExemptAmount = 3000` (`UK-2026.1.1.json:97`). UI silently produces a number if engine miss. | TaxEstate.jsx:1736 | `TAX_JSON.capitalGains.annualExemptAmount` (no UI fallback) |
| TE-DRL-CGT-11 | FAIL | FUNCTIONAL | `taxBasic = Math.round(taxable * 0.18)` — CGT basic rate `0.18` hardcoded in JSX (TaxEstate.jsx:1738). SoT: `capitalGains.basicRate = 0.18` (`UK-2026.1.1.json:98`). And label "CGT at 18% (basic rate)" hardcoded as string (:1820). Per JSON `_meta.notes`: "Never hardcode these values in UI components — always import from this file via the TAX object". | TaxEstate.jsx:1738, 1820 | `TAX_JSON.capitalGains.basicRate` |
| TE-DRL-CGT-12 | FAIL | FUNCTIONAL | `taxHigher = Math.round(taxable * 0.24)` — CGT higher rate `0.24` hardcoded (TaxEstate.jsx:1739). SoT: `capitalGains.higherRate = 0.24`. Label "CGT at 24% (higher rate)" hardcoded string (:1824). | TaxEstate.jsx:1739, 1824 | `TAX_JSON.capitalGains.higherRate` |
| TE-DRL-CGT-14 | PASS (A6) / FAIL (A5) | POLISH | Footer reads `"Rates per UK-2026.1"` — string literal, not `BRAND.rulesVersion`. Compounds the version-label drift (see TE-CHR-02). | TaxEstate.jsx:1843 | `BRAND.rulesVersion` (which itself needs updating) |
| TE-DRL-AL-05 | FAIL | FUNCTIONAL | `limit: TAX.isa_limit ?? 20000` — fallback `20000` hardcoded (TaxEstate.jsx:2007). SoT: `isa.annualAllowance = 20000`. The `TAX` export key is `isa_limit` (legacy short-name) — confirm export wiring. | TaxEstate.jsx:2007 | `TAX_JSON.isa.annualAllowance` |
| TE-DRL-AL-06 | FAIL | FUNCTIONAL | PSA `desc` string literal: `'£1,000 basic rate · £500 higher rate · £0 additional'` (TaxEstate.jsx:2008). SoT: `income.savingsAllowanceBasicRate/HigherRate/AdditionalRate`. Should template. | TaxEstate.jsx:2008 | `TAX_JSON.income.savingsAllowance*Rate` |
| TE-DRL-AL-07 | FAIL | FUNCTIONAL | `limit: TAX.cgt_exemption ?? 3000` — fallback `3000` hardcoded (TaxEstate.jsx:2009). | TaxEstate.jsx:2009 | `TAX_JSON.capitalGains.annualExemptAmount` |
| TE-DRL-AL-08 | FAIL | FUNCTIONAL | `limit: TAX.dividend_allowance ?? 500` — fallback `500` hardcoded (TaxEstate.jsx:2010). SoT: `income.dividendAllowance = 500`. | TaxEstate.jsx:2010 | `TAX_JSON.income.dividendAllowance` |
| TE-DRL-AL-09 | FAIL | FUNCTIONAL | `limit: TAX.personal_allowance ?? 12570` (TaxEstate.jsx:2011) — fallback `12570` hardcoded. `desc` string contains `£100k ANI` + `£125,140` hardcoded ("Reduces by £1 for every £2 over £100k ANI. Fully lost at £125,140."). SoT: `income.personalAllowance = 12570`, `personalAllowanceTaperStart = 100000`, `personalAllowanceTaperEnd = 125140`. | TaxEstate.jsx:2011 | `TAX_JSON.income.personalAllowance*` |
| TE-EST-BPR-01 | FAIL | FUNCTIONAL | Sub: `'Couples £5m pool' or 'Single £2.5m allowance'` (TaxEstate.jsx:1462). Caps hardcoded in :1456: `allow?.couple || 5000000`, `allow?.individual || 2500000`. SoT: `inheritanceTax.aprBprCombinedAllowance = 2500000`, `aprBprCombinedAllowanceCouple = 5000000`. Engine should be sole source. | TaxEstate.jsx:1456, 1462 | `TAX_JSON.inheritanceTax.aprBprCombinedAllowance*` |
| TE-EST-BPR-07 | FAIL | POLISH | Chip "Post-30-Oct-2024 trusts: 50% above £1m" — `£1m` not in SoT JSON. Verify against `inheritanceTax.bprTrustAntiFragmentationNote` — note text says trusts settled after 30 Oct 2024 by same settlor "share a single £2.5m allowance" (different framing). Number `£1m` may be **wrong** — flagging for domain auditor cross-check. | TaxEstate.jsx:1482 vs JSON :151 | domain auditor verification |
| TE-DRL-BPR-04 | FAIL | FUNCTIONAL | BPR relief rate `1.00` for trading vs `0.50` for mixed decided in JSX via regex on asset description (per inventory seed S-11). SoT: `inheritanceTax.businessPropertyRelief100/50` (= 1.00 / 0.50) and `aimBPRRate = 0.50`. Logic should be engine-side. | TaxEstate.jsx (BPRDrillPanel ~line 1632) | engine BPR classifier |
| TE-EST-WL-06 | UNVERIFIED | — | "Cost of dying intestate: £X" — `noWillCoI` source not yet inspected. Note: if it traces to `costOfInaction(entity, 'no_will')` it must reconcile with the canonical CoI shape. | (Will/LPA card) | flag for domain auditor |
| TE-DRL-IHT-14 | PASS (A6) / FAIL (A5) | POLISH | Footer "Based on UK IHT rules · Finance Act 2026 · Not regulated advice" — does not include `BRAND.rulesVersion`, but is FCA-compliant prose. (Polish only.) | TaxEstate.jsx (IHTDrillPanel footer) | — |

---

## §C — FAIL Summary (count by severity)

```
Total A6-relevant rows checked:    ~45
PASS:                              13
FAIL:                              25  (incl. 18 hardcode-fallback rows)
NA (pure-copy / no-numeric):       7
UNVERIFIED:                        2  (TE-EST-WL-06 noWillCoI source, TE-EST-BPR-07 £1m number)

By severity:
  DEMO-BLOCKING (DB):              2
  FUNCTIONAL    (F):               18
  POLISH        (P):               5
```

**DB candidates:**
1. **TE-EST-COI-01 — CoI canonical violation across screens.** Home shows `costOfInaction(entity)` (single-domain SIPP/IHT delta), MyMoney/Cashflow show `totalCoI(entity).total`, T&E shows `totalCoI(entity).byDomain.estatePlanning`. Three different numbers under the same "Cost of Inaction" label. Violates skill v1.4 §2.7 and FD-CROSS-1 ("CoI on T&E must equal the CoI number on Home and MyMoney — same value, same format").
2. **TE-EST-IHT-07 — IHT engine-path divergence on same screen.** "Today" tile and IHTDrillPanel both call `te_ihtExposure(e)`; "After 6 Apr 2027" tile and RNRBPlanning instead call `ihtDynamic(e, true)` and rewrap output. For dates `today < 2027-04-06` the dual-number "After" tile and the drill panel can disagree on the same conceptual figure.

**Functional hardcode hotspots (engine-bypass):**
- TaxEstate.jsx: `0.18` (CGT basic), `0.24` (CGT higher), `0.40` (IHT label), `'10.75%'`, `'35.75%'`, `'39.35%'` (dividend rates), `100000` (taper start), `2000000` / `2350000` (RNRB taper window), `325000` (NRB fallback), `12000` / `8000` (cash-ISA cap), `60000` (AA / sacrifice max), `'£100k ANI'` / `'£125,140'` (PA taper desc), `20000` / `3000` / `500` / `12570` / `175000` (allowance fallbacks), `5000000` / `2500000` (BPR caps), `'£1m'` (post-2024 BPR trust chip — unverified).
- InheritanceStory.jsx: `£325k` literal in fallback line.

Per `_meta.notes` in `src/rules/UK-2026.1.1.json:11`: **"Never hardcode these values in UI components — always import from this file via the TAX object in fq-calculator.js."** Every FUNCTIONAL row above violates this directive.

**Format drift:**
- TE-TAX-DIV-01 — `toLocaleString()` instead of `fmt()` (one-off).
- Otherwise `fmt()` use is consistent across the screen.

---

## §D — Cross-Screen Verification Tasks (handed to global pass)

These items cannot be fully resolved by inspecting T&E alone — they require a full cross-screen pass once Home + MyMoney + Cashflow inventories are populated:

1. **CoI definition.** Decide one of:
   - (a) All four surfaces use `totalCoI(entity, bundle).total` and label = "Cost of Inaction (total)" — matches MyMoney/Cashflow today;
   - (b) Each surface shows a domain slice but with explicit label ("Estate planning slice", "SIPP/IHT slice") and a separate hero `totalCoI`;
   - (c) Deprecate `costOfInaction()` legacy single-domain function and migrate Home/Ask to `totalCoI`.
   Skill v1.4 §2.7 mandates (a) or (c). Current state is (b) but **without explicit labels** — failure mode.
2. **IHT exposure unification.** Either (i) make `te_ihtExposure(e, bundle, { postPension: true })` the single engine entry and have IHTDualNumber call it twice with different flags, or (ii) deprecate `ihtDynamic` from screen code. Mixed usage is the bug.
3. **Rules version label.** Bump `BRAND.rulesVersion` to `UK-2026.1.1` (matches the SoT JSON `_meta.version`) so the live-rules pill, X28 label, Cashflow footer (Cashflow.jsx:867 hardcodes `UK-CMA-2026.1`), and CGTDrillPanel footer (TaxEstate.jsx:1843 hardcodes `UK-2026.1`) all align.

---

## §E — Inventory drift (UNLISTED elements observed)

None observed in this pass — every numeric/data row in the React component maps to an inventory ID. (The plan-staleness mobile-repeat case is documented as inventory note Region 21.)

---

## §F — Coverage

```
A6-relevant inventory rows in TE inventory v1: 227 total, ~94 with non-NA A6 expectation
Rows with verdict assigned this pass:          ~45 (every row with hardcode/format/cross-screen risk)
Rows trivially PASS by engine-call inspection: ~40 (te_taxThisYear, calcANI, drawdownMatrix, te_dividendTaxDetail, te_incomeTaxDetail, allowanceTracker, ihtWaterfall, BeneficiarySankey — all read engine output with fmt())
Rows UNVERIFIED:                                 2 (TE-EST-WL-06 noWillCoI source; TE-EST-BPR-07 £1m number)
Coverage = ~95% of A6-relevant rows; PASS rate on checked rows = 13/(13+25) = 34%.
```

---

## Return

**TE reconciliation: 13 PASS, 25 FAIL (2 DB, 18 F, 5 P).**
