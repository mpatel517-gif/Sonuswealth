# PHASE 1 — UK Tax File Diff Report

**Date:** 2026-05-21
**Files compared:** 4 JSON files all claiming UK 2026/27 tax rules
**Verdict (top of page):** `src/engine/modules/UK-master-2026.1.1.json` is the canonical source. It is a strict superset of `src/rules/UK-2026.1.1.json` (which is identical in tax values) plus additional structured SRT + split-year blocks. The DeepSeek file (`src/rules/tax-2026.json`) is an **older v1.0 draft** with at least 9 stale figures and is now obsolete — there are zero new corrections in it that aren't already in the v1.1.1 files.

---

## 1. Top-level structure comparison

| File | Top-level keys | Schema family |
|---|---|---|
| `src/rules/UK-2026.1.1.json` | `_meta` (with `_correctionLog`), `_disclaimer`, `income`, `capitalGains`, `inheritanceTax`, `pension`, `isa`, `taxEfficientInvestments`, `property`, `nationalInsurance`, `trusts`, `overseas`, `welshIT`, `businessOwnerPersonal`, `corporationTax`, `allowancesAndReliefs`, `safeWithdrawalRate`, `bengenNote`, `milestones`, `_lastUpdated`, `_nextReviewDue` | v1.1.1 |
| `src/rules/tax-2026.json` | Same as above MINUS `welshIT`, MINUS `_correctionLog`, PLUS legacy flat aliases `personal_allowance`, `additional_rate_threshold`, `dividend_ordinary_rate`, `dividend_upper_rate`, `vct_income_relief` | v1.0 (older) |
| `src/engine/modules/UK-2026.1.1.json` | Identical to `src/rules/UK-2026.1.1.json` (Caelixa-branded text, otherwise byte-for-byte same values) | v1.1.1 |
| `src/engine/modules/UK-master-2026.1.1.json` | Same as `src/engine/modules/UK-2026.1.1.json` PLUS structured `overseas.statutoryResidenceTest` (full SRT matrix) PLUS structured `overseas.splitYearTreatment` (8 cases) PLUS extra `_meta._correctionLog.s17a3_2026-05-07_srt_splityear_addition` entry | v1.1.1 + SRT/SYT |

**Subset/superset chain:** `tax-2026.json (v1.0)` ⊂ `src/rules/UK-2026.1.1.json ≡ src/engine/modules/UK-2026.1.1.json` ⊂ `src/engine/modules/UK-master-2026.1.1.json`.

---

## 2. Per-rule comparison — values that differ

Showing only keys that differ OR are absent from at least one file. Identical keys across all four are summarised in §2b.

**Legend:** `R1` = `src/rules/UK-2026.1.1.json`, `R2` = `src/rules/tax-2026.json` (DeepSeek), `E1` = `src/engine/modules/UK-2026.1.1.json`, `EM` = `src/engine/modules/UK-master-2026.1.1.json`. **⚠** = disagreement (different non-trivial values).

| rule_key | R1 | R2 | E1 | EM |
|---|---|---|---|---|
| `_meta.version` | UK-2026.1.1 | UK-2026.1 ⚠ | UK-2026.1.1 | UK-2026.1.1 |
| `income.personalAllowanceFrozenTo` | 2030 | 2028 ⚠ | 2030 | 2030 |
| `income.scottishStarterRate` | 0.19 | — | 0.19 | 0.19 |
| `income.scottishRateBands2627` (full 6-band block) | present | — | present | present |
| `income.thresholdsFrozenTo` | 2030 | — | 2030 | 2030 |
| `income.highIncomeChildBenefitTaperEnd` | 80000 | — | 80000 | 80000 |
| `income.adjustedNetIncomeNote` | present | — | present | present |
| `capitalGains.investorsReliefRate` | 0.18 | 0.10 ⚠ | 0.18 | 0.18 |
| `capitalGains.spreadBettingExempt` | true | — | true | true |
| `inheritanceTax.residenceNilRateBandFrozenTo` | 2030 | — | 2030 | 2030 |
| `inheritanceTax.bprCPIIndexationFrozenUntil` | 2031-04-06 | — | 2031-04-06 | 2031-04-06 |
| `inheritanceTax.bprAllowanceIndividualRefreshYears` | 7 | — | 7 | 7 |
| `inheritanceTax.bprAllowanceTrustRefreshYears` | 10 | — | 10 | 10 |
| `inheritanceTax.bprTrustAntiFragmentationNote` | present | — | present | present |
| `inheritanceTax.intestacyStatutoryLegacy` | 322000 | — | 322000 | 322000 |
| `pension.taperedAnnualAllowanceThreshold` | — | 260000 | — | — |
| `pension.taperedAnnualAllowanceThresholdIncome` | 200000 | — | 200000 | 200000 |
| `pension.taperedAnnualAllowanceAdjustedIncome` | 260000 | — | 260000 | 260000 |
| `pension.statePensionFullAmount` | 12548 | 11502 ⚠ | 12548 | 12548 |
| `pension.statePensionWeeklyRate` | 241.30 | — | 241.30 | 241.30 |
| `pension.statePensionAgeRisingTo67By` | 2028 | — | 2028 | 2028 |
| `pension.salarySacrifice` (object) | present | spelled `salarysacrifice` ⚠ | present | present |
| `pension.salarySacrificeNICCap2029` | 2000 | — | 2000 | 2000 |
| `pension.juniorPensionContributionNet` | 2880 | — | 2880 | 2880 |
| `pension.juniorPensionContributionGross` | 3600 | — | 3600 | 3600 |
| `pension.nmpaCurrentTo2028` / `nmpaFrom2028` | 55 / 57 | — | 55 / 57 | 55 / 57 |
| `pension.ihtInclusionApril2027` | 2027-04-06 | — | 2027-04-06 | 2027-04-06 |
| `isa.cashISACapUnder65From2027` | 12000 | — | 12000 | 12000 |
| `taxEfficientInvestments.vct.incomeTaxRelief` | 0.20 | 0.20 | 0.20 | 0.20 (R2 also keeps legacy alias `vct_income_relief: 0.20`) |
| `taxEfficientInvestments.eis.grossAssetsLimitPreIssue` | 30000000 | — | 30000000 | 30000000 |
| `taxEfficientInvestments.eis.grossAssetsLimitPostIssue` | 35000000 | — | 35000000 | 35000000 |
| `property.sdlt.firstTimeBuyerRelief.zeroRateTo` | 300000 | 425000 ⚠ | 300000 | 300000 |
| `property.sdlt.firstTimeBuyerRelief.reducedRateTo` | 500000 | 625000 ⚠ | 500000 | 500000 |
| `property.sdlt.additionalPropertySurcharge` | 0.05 | 0.03 ⚠ | 0.05 | 0.05 |
| `property.rentalIncome.furnishedHolidayLettingsNote` (FHL abolished 2025) | present (April 2025) | older block `furnishedHolidayLettings` says 2024-04-06 ⚠ | present | present |
| `property.sdrtOnShares.rate` | 0.005 | — | 0.005 | 0.005 |
| `nationalInsurance.class1EmployerRate` | 0.15 | 0.138 ⚠ | 0.15 | 0.15 |
| `nationalInsurance.class1EmployerSecondaryThreshold` | 5000 | 9100 ⚠ | 5000 | 5000 |
| `nationalInsurance.class1EmployerSecondaryThresholdWeekly` | 96 | — | 96 | 96 |
| `nationalInsurance.class2Rate` | 0 | 3.45 ⚠ | 0 | 0 |
| `nationalInsurance.employmentAllowance` | 10500 | 5000 ⚠ | 10500 | 10500 |
| `nationalInsurance.stateNewPensionFullAmount` | 12548 | 11502 ⚠ | 12548 | 12548 |
| `nationalInsurance.autoEnrolmentTotal/Employee/Employer` | 0.08 / 0.05 / 0.03 | — | same | same |
| `nationalInsurance.salarySacrificeNISaving` | present (camelCase) | spelled `salarysacrificeNISaving` ⚠ | present | present |
| `allowancesAndReliefs.stateNewPensionFull` | 12548 | 11502 ⚠ | 12548 | 12548 |
| `allowancesAndReliefs.childBenefitHighIncomeTaperEnd` | 80000 | — | 80000 | 80000 |
| `allowancesAndReliefs.mtdItsa` (phase 1/2/3 block) | present | — | present | present |
| `allowancesAndReliefs.cashISACapUnder65From2027` | 12000 | — | 12000 | 12000 |
| `allowancesAndReliefs.giftAidGrossUpRate` | 0.25 | — | 0.25 | 0.25 |
| `allowancesAndReliefs.aniFormula` | present | — | present | present |
| `trusts.discretionaryTrust.itRateOnIncome` | 0.45 | — | 0.45 | 0.45 |
| `trusts.discretionaryTrust.itRateDividends` | 0.3935 | — | 0.3935 | 0.3935 |
| `trusts.discretionaryTrust.standardRateBand` | 1000 | — | 1000 | 1000 |
| `trusts.lpaSafeguardNote` | present | — | present | present |
| `overseas.figRegime` (full block) | present | — | present | present |
| `overseas.trfFacility` (full block w/ trfRate2526/2627/2728) | present | — | present | present |
| `overseas.statutoryResidenceTest` (structured: 3 auto-overseas tests, 3 auto-UK tests, sufficient-ties matrix, day-count rule) | stub `.note` only | stub `.note` only | stub `.note` only | full structured block ✓ |
| `overseas.splitYearTreatment` (8 cases + tie-break rules) | stub `.note` only | stub `.note` only | stub `.note` only | full structured block ✓ |
| `welshIT` (full block) | present | — ⚠ | present | present |
| `businessOwnerPersonal.investorsReliefRate` | 0.18 | 0.10 ⚠ | 0.18 | 0.18 |
| `businessOwnerPersonal.carriedInterest` (2026 trading-profit treatment) | present | — | present | present |
| Legacy snake_case aliases (`personal_allowance`, `additional_rate_threshold`, `dividend_ordinary_rate`, `dividend_upper_rate`, `vct_income_relief`) | — | present ⚠ | — | — |

### 2b. Values identical across all four files (sample, full list verified)

PA £12,570; basic rate 20%, higher 40%, additional 45%, additionalRateThreshold £125,140, basicRateThreshold £50,270, basicRateBand £37,700; ISA £20,000, JISA £9,000, LISA £4,000; CGT AEA £3,000, basic 18%, higher 24%, residential 18/24%, BADR 18% £1m lifetime; NRB £325,000, RNRB £175,000, RNRB taper start £2m, IHT 40%/36%, APR+BPR allowance £2.5m, AIM BPR 50%, taper relief schedule; Pension AA £60,000, MPAA £10,000, LSA £268,275, LSDBA £1,073,100, 25% PCLS; dividend allowance £500, basic 10.75%, higher 35.75%, additional 39.35%; PSA basic £1,000 / higher £500; trading & property allowances £1,000; rent-a-room £7,500; blind person £3,070; marriage allowance £1,260; Class 1 employee NI 8%/2%, Class 4 6%/2%; SIPP/DC IHT inclusion 2027-04-06; safe withdrawal 4%.

---

## 3. Critical disagreements (DeepSeek file vs the rest)

Every disagreement below is **R2 wrong, v1.1.1 right**. The v1.1.1 figures match current HMRC/DWP published 2026/27 rates and the founder-supplied ground-truth list.

| # | Key | R2 (DeepSeek) | v1.1.1 (R1/E1/EM) | Correct value (HMRC/DWP 2026/27) | Verdict |
|---|---|---|---|---|---|
| 1 | `pension.statePensionFullAmount` | 11502 | 12548 | £12,547.60 (£241.30 × 52, DWP 2026/27) | R2 is 2024/25 rate — STALE |
| 2 | `nationalInsurance.stateNewPensionFullAmount` | 11502 | 12548 | same as #1 | STALE |
| 3 | `allowancesAndReliefs.stateNewPensionFull` | 11502 | 12548 | same as #1 | STALE |
| 4 | `nationalInsurance.class1EmployerRate` | 0.138 | 0.15 | 15% (April 2025 Budget) | R2 pre-April-2025 — STALE |
| 5 | `nationalInsurance.class1EmployerSecondaryThreshold` | 9100 | 5000 | £5,000 (April 2025) | STALE |
| 6 | `nationalInsurance.employmentAllowance` | 5000 | 10500 | £10,500 (April 2025) | STALE |
| 7 | `nationalInsurance.class2Rate` | 3.45 | 0 | Class 2 abolished above SPT from April 2024 | STALE |
| 8 | `property.sdlt.firstTimeBuyerRelief.zeroRateTo` | 425000 | 300000 | £300,000 (reverted 1 April 2025) | STALE |
| 9 | `property.sdlt.firstTimeBuyerRelief.reducedRateTo` | 625000 | 500000 | £500,000 (reverted 1 April 2025) | STALE |
| 10 | `property.sdlt.additionalPropertySurcharge` | 0.03 | 0.05 | 5% (Autumn Budget Oct 2024, from 31 Oct 2024) | STALE |
| 11 | `capitalGains.investorsReliefRate` | 0.10 | 0.18 | 18% from April 2026 (aligned with BADR) | STALE |
| 12 | `businessOwnerPersonal.investorsReliefRate` | 0.10 | 0.18 | same as #11 | STALE |
| 13 | `income.personalAllowanceFrozenTo` | 2028 | 2030 | 2030/31 (Autumn Budget 2025) | STALE |
| 14 | `property.rentalIncome` FHL abolition date | 2024-04-06 | April 2025 | April 2025 (FA 2025) | STALE |
| 15 | `_meta.version` | UK-2026.1 | UK-2026.1.1 | n/a | older draft |
| 16 | `pension.salarysacrifice` / `nationalInsurance.salarysacrificeNISaving` | lowercase | camelCase `salarySacrifice` | code consumers expect camelCase | R2 has typo |
| 17 | Welsh IT block | missing | present | required (UK-WELSH-01..04) | R2 missing entire block |
| 18 | FIG regime / TRF facility / MTD ITSA / SRT structured / Split-year structured | missing | present (SRT+SYT structured only in EM) | required for 2026/27 engine | R2 missing |

Ground-truth checks against the founder list: PA £12,570 ✓ (all four), basic-rate-band-ends £50,270 ✓ (all four), higher 40% ✓, additional 45% above £125,140 ✓, ISA £20,000 ✓, Pension AA £60,000 ✓, MPAA £10,000 ✓, NRB £325,000 ✓, RNRB £175,000 ✓, IHT 40%/36% ✓, CGT 18/24% residential + 18/24% other ✓, Dividend allowance £500 ✓, SIPP IHT April 2027 ✓, NI Class 1 employee 8%/2% ✓, NI Class 4 6%/2% ✓ — all 15 anchor points present and correct in v1.1.1 files. None of these anchor values disagree across the four files; **every disagreement is in a non-anchor rule, and every one of them is R2 being stale.**

---

## 4. Recommendation

**Canonical source: `C:\Users\Powernet\Desktop\finio\src\engine\modules\UK-master-2026.1.1.json`.**

Why this one and not the other v1.1.1 files:

1. It is a strict **superset** of `src/rules/UK-2026.1.1.json` and `src/engine/modules/UK-2026.1.1.json` — every tax value in those files is identical here, plus it has the structured `statutoryResidenceTest` and `splitYearTreatment` blocks the engine needs to actually compute residency (the others only have a `.note` string).
2. It carries the `s17a3_2026-05-07_srt_splityear_addition` correction log entry documenting why the SRT/SYT blocks were upgraded, and it explicitly records the `UK-2026.1.1.json → UK-master-2026.1.1.json` filename rename decision (D-BUNDLE-FILENAME-1).
3. The `_meta.notes` field in all three v1.1.1 files explicitly states the engine loads via `fq-calculator.js` — and per the `reference_uk_tax_source_of_truth` memory, fq-calculator's `TAX` object loads from `src/engine/modules/`, not from `src/rules/`.

**DeepSeek corrections that should be merged into the canonical file: ZERO.**

There are no new corrections in `src/rules/tax-2026.json` that aren't already in `UK-master-2026.1.1.json`. Every value in R2 that differs from v1.1.1 is **older** (pre-Autumn-Budget-2025, pre-April-2025-Budget, or pre-Finance-Act-2026), not newer. The file is a v1.0 draft from before the Autumn 2025 / Finance Act 2026 refresh.

**Action items:**

1. **Delete or archive** `C:\Users\Powernet\Desktop\finio\src\rules\tax-2026.json`. It is stale on 11+ values and risks being loaded by mistake. If kept for history, rename to `archive/tax-2026.v1.0-superseded.json` and mark `_status: "SUPERSEDED-BY-UK-master-2026.1.1"`.
2. **Delete or hard-symlink** `C:\Users\Powernet\Desktop\finio\src\rules\UK-2026.1.1.json` → it has the right values but lacks the structured SRT/SYT blocks. Either delete (and update any importers to point at `src/engine/modules/UK-master-2026.1.1.json`) or replace its contents with the master file's contents.
3. **Delete or hard-symlink** `C:\Users\Powernet\Desktop\finio\src\engine\modules\UK-2026.1.1.json` for the same reason — it is the master minus SRT/SYT structured blocks.
4. **Single canonical path going forward:** `src/engine/modules/UK-master-2026.1.1.json`, loaded by `fq-calculator.js`. Update any `require`/`import` statements pointing at the other three files.
5. **Verification call needed:** before deleting, grep the codebase (`UK-2026.1.1.json`, `tax-2026.json`, `UK-master-2026.1.1`) and confirm which paths are actually imported. If imports point at the soon-to-be-deleted files, update imports first, then delete.

---

**Files audited:**
- `C:\Users\Powernet\Desktop\finio\src\rules\UK-2026.1.1.json` (40,126 bytes, 593 lines)
- `C:\Users\Powernet\Desktop\finio\src\rules\tax-2026.json` (26,169 bytes, 632 lines — v1.0 STALE)
- `C:\Users\Powernet\Desktop\finio\src\engine\modules\UK-2026.1.1.json` (39,522 bytes, 593 lines)
- `C:\Users\Powernet\Desktop\finio\src\engine\modules\UK-master-2026.1.1.json` (50,281 bytes, 999 lines — CANONICAL)
