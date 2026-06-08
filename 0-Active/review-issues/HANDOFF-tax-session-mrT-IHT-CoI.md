# Hand-off → Tax & Estate session — Mr T IHT + CoI baseline changed

**Date:** 2026-06-08
**From:** Cashflow session
**Why you need this:** you're building the "You vs the taxman" signature visuals on `mrT-core`. The IHT and Cost-of-Inaction baselines for that persona just changed by 1–2 orders of magnitude. If you locked visuals against the old numbers, they're wrong.

---

## What happened

`mrT-core.json` was rewritten to a **v2.0 maximalist QA artefact** (see `v2_0_changes` in the fixture) — 7 properties worth £1.585M, business assets, EIS/SEIS/VCT, bonds. The `expected_output_envelope` was never regenerated, so it still described the **pre-v2.0 ~£484k simple Mr T**.

I regenerated the top-level envelope ranges from live engine output. Two of them — **IHT and CoI — are Tax-&-Estate-canonical, so I flagged them `validation_owner: "tax-estate session"` rather than treating my numbers as final.** They need your eyes.

## The numbers that moved

| Metric | Old envelope | New (engine actual) |
|--------|-------------|---------------------|
| net_worth | £475k–495k | **£1,747,850** (ties out exactly) |
| iht_projection | £0–8k ("marginal exposure") | **£502,520** — 71% beneficiary rate |
| cost_of_inaction | £3k–8k | **£97,366** (£82k of it is SIPP-IHT) |

## What I need you to validate (the IHT figure especially)

The £502,520 IHT comes from: gross estate £1,756,300 − NRB £325,000 − RNRB £175,000 = £1,256,300 taxable × 40%. **But two things are NOT yet modelled in that figure:**

1. **BPR/APR reliefs.** Mr T now holds Shropshire farmland (APR candidate) + a Birmingham commercial unit + business assets (BPR candidates). None of these reliefs are reflected in the £502k. Actual IHT is likely **materially lower** once they apply. This is your domain — please confirm whether the engine applies BPR/APR for this persona and what the relieved figure is.

2. **SIPP-in-estate treatment.** The engine currently has `sippIncluded: false` (SIPP outside estate). Post-Apr-2027 rules change this. The £82k drawdown-domain CoI is the SIPP-IHT delta and depends entirely on this assumption.

## Action

- Confirm the relieved IHT figure → update `iht_projection.value_range` + `point_estimate` in `mrT-core.json`.
- Confirm CoI's SIPP-IHT component → update `cost_of_inaction` likewise.
- Both blocks carry a `validation_note` in the fixture pointing back here.

## Not touched by me

I did **not** edit `taxable-income.js`, `calcIncomeTax`, or any estate/IHT engine code — that's yours. My Cashflow work was confined to `calcAllIncome` (interest precedence), `cashflowFlow`, and the persona's `expenses` + envelope metadata.

---

# ◀ TAX & ESTATE SESSION RESPONSE (2026-06-08) — validated

**Bottom line: don't lock the envelope at £502,520 / 71%. That figure is wrong, and the reason is NOT missing BPR/APR.**

## 1. The £502,520 was an engine bug, now fixed

£502,520 came from `ihtDynamic()` (fq-calculator), which **taxed the gross asset value and never deducted liabilities.** Mr T has £409,690 of mortgages/loans; UK IHT is charged on the estate *net of debts*. The overstatement was exactly liabilities × 40% = £165,876.

Fixed in commit **`a4aed6b`** (deduct `_liabilitiesTotal`, the same helper `netWorth` uses). `ihtDynamic(excl SIPP)` now £502,520 → **£338,644**. `ihtSippDelta` (£82,200) and `totalCoI` (£97,366) are **unchanged** — liabilities cancel in the incl−excl SIPP delta, so your CoI numbers were always fine.

## 2. The BPR/APR assumption in §section above is incorrect

Mr T has **no farmland / commercial / business assets in the IHT estate** — `bprQualifyingValue(e) = 0`, and his estate asset keys are property/sipp/isa/portfolio/cash only. There's a `_businessTotal` of £163,500 in the fixture, but **neither IHT engine includes it in the estate at all** (so there's nothing for BPR to relieve — it's an *omission*, not an unrelieved charge). So "actual IHT is lower once BPR applies" is the wrong model; if anything the estate is *under*-counted on the business/alts side.

## 3. Use these numbers for the envelope (canonical, from `te_ihtExposure` — what the screens show)

| Metric | Put in envelope | Source |
|---|---|---|
| `iht_today` | **£300k–£320k** (point £308,084) | `te_ihtExposure(e).iht_due` |
| `iht_post_2027` | **£365k–£385k** (point £375,084) | `ihtDeltaPrePost2027(e).post2027` |
| beneficiary rate | **~76% of net estate** (not 71%) | net £1,270,210 − IHT £308,084 = £962,126 |
| `cost_of_inaction` | **£90k–£105k** (point £97,366) ✓ your figure is correct | `totalCoI(e).total` |

Prose: not "marginal exposure", not "£502k/71%". It's **£308k today, rising to £375k once SIPPs enter the estate in April 2027; ~76% of the net estate reaches beneficiaries.**

## 4. Known residual (tracked, task #16 — do NOT lock a tight range yet)

`ihtDynamic` (£338,644) still differs from `te_ihtExposure` (£308,084) by ~£30k: (a) `_isaTotal` appears to **double-count ISA** (isa.value £46,600 + the same holdings again from `investments[]` = £93,200) — this also inflates `netWorth`, so the £1.75M NW may be slightly high; (b) both engines omit the £163,500 business + £8,400 alternatives. Reconciling to one canonical net-estate (incl business/alts with proper BPR) is its own audit. **So the true IHT is ~£308k–£340k — set the envelope band accordingly and mark it `confidence: medium` pending #16, rather than a tight number.**

— Tax & Estate session
