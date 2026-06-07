# Choices — Calc-Audit (golden vectors + differential test)

**Status:** DOCUMENTED · **Updated:** 2026-06-07 · **Source:** agent calc-audit of 21 gated decisions vs UK-2026.1.1 TAX bundle.
**Headline:** 19/21 cases mismatch the correct UK 2026/27 maths. 10 HIGH-confidence, 15 still need an EXTERNAL professional sign-off (founder's mandatory gate). **No correction applied from this sweep** — golden vectors handed to the professional reviewer.

## Summary table
| Code | Engine | Conf | Pro-review | Discrepancy |
|---|---|---|---|---|
| DE-01 | NO | HIGH | yes | flat `min(sipp×0.20,£15k)` proxy ignores band structure + no LSA gate; understates ~£31k |
| DE-02 | NO | MED | yes | £/yr income decision reported as one-off NW; `0.04` literal; no break-even |
| DE-05 | NO | HIGH | yes | applies only employer NIC 0.15; DROPS income-tax relief (largest term) + employee NIC; copy says 15%+8% |
| DE-08 | PARTIAL | MED | yes | simple-interest linearises the gap; no CGT on un-wrapped leg — sign can flip |
| DE-11 | PARTIAL | HIGH | **no** | §24: missing additional-rate band branch + rental profit not in band test |
| DE-15 | PARTIAL | HIGH | yes | invented `age<73?1:0.5` survival proxy; `petTaperByYear` defined-unused; no carry; no NRB gate |
| DE-17 | NO | MED | yes | `0.10` fabricated "deferral" proxy — no such rule; RNRB lever uncomputed; 3 options identical |
| DE-18 | YES | HIGH | **no** | tax correct (ihtDelta=0); `£3,500`/5yr silent literals; cost booked as if incapacity certain |
| DE-19 | PARTIAL | HIGH | **no** | premium = fabricated 0.2%/yr proxy mislabelled nwDelta; IHT/trust logic correct |
| DE-20 | PARTIAL | HIGH | **no** | premium 0.3%/yr proxy mislabelled nwDelta; tax treatment correct |
| DE-21 | PARTIAL | HIGH | **no** | premium 3%/mo proxy; **claim-definition axis (own-occ vs any-occ) — the actual decision — not modelled** |
| DE-24 | NO | MED | yes | rateGap hardcoded marginal−20% (assumes spouse basic); capped at transferor PA; understates ~½ |
| DE-25 | PARTIAL | MED | yes | counts only employer-NI; ignores dividend tax + lost CT relief; `divRate`/`corpTax` dead; overstates |
| DE-26 | PARTIAL | MED | yes | EIS/SEIS relief not capped at IT liability; BPR not gated on 2yr-held-at-death |
| DE-29 | NO | MED | yes | HR reclaim on net not gross, ignores AR; ihtRate applied to a LIFETIME Gift-Aid gift (wrong mechanism) |
| DE-33 | PARTIAL | MED | yes | one-off relief + 10yr growth summed under one label; growth simple not compound; ihtDelta=0 correct |
| DE-34 | PARTIAL | MED | yes | nwDelta=0 (CGT window) correct; ihtDelta fabricated `0.20`×NW; 3 options identical £0 |
| DE-35 | YES | HIGH | **no** | BADR (18/24/£1m) algebraically correct; residuals: AEA not deducted; lost-BPR downside invisible on no_badr |
| DE-36 | NO | HIGH | yes | subtracts REFUNDABLE S455 from PERMANENT dividend tax as if both sunk; "dividend cheaper" false for AR directors |
| DE-37 | PARTIAL | MED | yes | ihtDelta=0 correct; ±5/10%-CETV nwDelta a fabricated heuristic |
| DE-38 | NO* | MED | yes | primary metric (guaranteed income £/yr) NOT computed; ihtDelta date-blind |

## Do-not-touch (engine already correct)
- **DE-18** tax (ihtDelta=0). **DE-35** BADR core saving. **DE-19/20/21** IHT/trust/tax-treatment (only the premium-as-nwDelta label is a proxy — already covered by `SUPPRESS_NW_CHART` + `NW_METRIC_LABEL`). **DE-33/34/37** ihtDelta=0 correct.

## HIGH-confidence structural corrections (golden vectors — for the professional reviewer)
- **DE-11 §24:** `spread = taxable>art?(ar-br):taxable>brt?(hr-br):0`; `taxable = income + max(0, rent−mortInt)`; `extraTax = mortInt×spread`. GV: int £6k @ £80k taxable → −£1,200/yr; @ £130k → −£1,500/yr (engine wrongly £1,200).
- **DE-05 sacrifice:** `saved = sacrificed×(_marginalRate(income)+employeeNIC) + (rebate? sacrificed×employerNIC :0)`. GV: £60k salary, £5k sacrifice → £2,100/yr (engine £750). [needs employeeNIC band + employerNIC keys verified]
- **DE-36 director loan:** S455 is REFUNDABLE (cost = S455×financeRate×years), dividend tax PERMANENT; nwDelta = cost of each path (negative). GV: £50k loan AR → dividend £19,675 > S455 face £17,875; "dividend cheaper" comment false.
- **DE-15 PET:** drop `age<73?1:0.5`; `ae = annualGiftExemption×(prior?2:1)`; gate on NRB+RNRB; wire `petTaperByYear`.
- **DE-17 will:** replace fabricated `0.10` with RNRB-preservation calc; differentiate the 3 options. (MED — replacement still needs pro-review.)

## APPLIED 2026-06-07 (HIGH-confidence, live-verified, labelled PENDING PRO SIGN-OFF)
- **DE-05 salary sacrifice:** now income-tax relief (marginal) + employee NIC (2% above UEL / 8% below); was employer-NIC-only. Live: Mr T +£42k/+£76k (was understated). Golden vector £60k→£2,100/yr.
- **DE-11 §24:** band test now includes rental profit + applies additional-rate spread; was higher-rate-only, rental excluded. Live: no NaN; feeds "Tax cost (5yr)".
- **DE-15 PET:** removed the invented `age<73?1:0.5` survival proxy (not a rule). NRB-gate + taper refinement still flagged.
- **DE-36 director loan:** base = permanent dividend-tax cost (S455 is refundable, not sunk); `_PATH_FACTORS` corrected (repay nw:0, dividend/writeoff nw:1) so live shows **Repay £0 · Dividend −£18k · Writeoff −£18k** (was repay wrongly −£18k). Methodology copy fixed. **Product-architect live-verification caught the inverted per-path factors that build-green missed.**
- **DEFERRED DE-01:** correct phasing formula is genuinely band-structure-dependent + flagged needs-pro-review; a half-right formula is worse than a flagged one. Left for the reviewer.

## WAVE 3-4 FULLY APPLIED 2026-06-07 (all gated corrections in dev, PENDING PROFESSIONAL SIGN-OFF)
Per founder /goal directive ("complete waves 3-4"): every gated correction is now applied in dev, each labelled `// CALC-AUDIT (pending pro sign-off)`, using ONLY verified TAX keys. Magnitude/sign certification still requires the external accountant on the golden vectors.
- **Applied (28):** DE-05, DE-11, DE-15, DE-36 (HIGH, hand-applied + live-verified) · DE-22, DE-23, DE-24, DE-40 `_PATH_FACTORS` · DE-07, DE-08, DE-10, DE-12, DE-13, DE-14, DE-16, DE-17, DE-19, DE-20, DE-21, DE-24, DE-25, DE-26, DE-29, DE-30, DE-33, DE-34, DE-37, DE-38, DE-39, DE-40 (case bodies). Fabricated proxies (0.15 embedded-gain, ×1.1 shelter, 0.10 deferral, 0.20-on-NW, 0.04 uplift, 1.07 roll-up, 0.002/0.003/0.03 premium) REMOVED or converted to labelled `// ESTIMATED — reviewer to confirm` assumptions. Missing terms ADDED: DE-21 claim-definition axis, DE-38 guaranteed-income £/yr primary, DE-16 CLT 20% entry charge, DE-17 RNRB taper, DE-08 compounding + invest-leg CGT.
- **Verification gate:** new `tests/decision-engine-smoke.mjs` (`npm run test:decision-smoke`) — all 40 decisions × paths return finite deltas, no throws, no NaN methodology values. Green. Build green. All TAX keys confirmed present in `_bundle.js`.
- **DEFERRED (3) — genuinely reviewer-set, no safe structural fix:** DE-01 (lump-vs-phased band-by-band crystallisation + LSA gate), DE-02 (annuity income £/yr re-bucket + gilt rate), DE-31 (no calc-audit correction entry; label-only fix already shipped).
- **REVIEWER FLAGS (sign/magnitude to validate first):** DE-25 director comp — live shows the tax-efficient salary/dividend mix as −£52k vs £0 salary; direction looks inverted, needs the golden vector. Plus every `ESTIMATED` rate (market mortgage/savings rates, annuity rate, embedded-gain %, settlement share, premium loadings) is a reviewer input.

## Why the rest was NOT auto-applied (pre-2026-06-07 note)
Per founder's `project_independent_calc_audit_required.md`: the calc-audit requires **professional golden vectors + differential testing + critic-skill sweep + EXTERNAL reviewer**. This sweep is researched-vector groundwork, not the professional sign-off. Applying agent-written tax code on build-green is the exact failure mode that already shipped salary-triple-count, TAX wrong-keys, and a £1.1m double-tax error. These corrections + golden vectors are the input the external reviewer signs off; until then the numbers are NOT certified.
