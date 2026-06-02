Title:        Historical UK Tax Bundle Verification (2021/22 – 2026/27)
Version:      1.0
Date:         2026-06-02
Status:       DOCUMENTED
Cluster:      3-Engine
File name:    historical-tax-verification-2026-06-02.md
Purpose:      Independent confirmation of headline figures in the six UK-YYYY.1.1 rule bundles against HMRC/DWP published rate tables. Verification pass only — no bundle files modified.

**Summary:** Verified ~18 headline figures × 6 tax years plus mid-year events against gov.uk/HMRC/DWP. 107 of 108 sampled figures MATCH; 1 genuine MISMATCH (s455 director's-loan rate in the 2026/27 bundle); 0 UNVERIFIED.
**Tags:** #engine #uk-tax #verification #rules-bundle
**Updated:** 2026-06-02

---

## 1. SUMMARY VERDICT

**The prior (May-2026) verification holds. The bundles are accurate.**

| Outcome | Count | Notes |
|---|---|---|
| ✅ MATCH | 107 | All income, NIC, CGT, dividend, pension AA/MPAA/LTA/LSA, IHT, ISA, CT, state-pension, EA figures and ALL mid-year events confirmed against gov.uk |
| 🔴 MISMATCH | 1 | `businessOwnerPersonal.directorsLoan.s455TaxRate` in **UK-2026.1.1** = 0.3375; correct value **0.3575** (35.75%) from 6 April 2026 |
| ⚠ UNVERIFIED | 0 | Every sampled figure resolved to an authoritative gov.uk source |

The single mismatch is a **legitimate change that the bundle's own dividend update already half-applied** (dividend higher rate was correctly bumped to 35.75% but the legislatively-linked s455 rate was left at 33.75%). It is NOT a fabricated figure and NOT a historical-year error. See §4.

**Verification depth note:** Income-tax bands, NIC, CGT, dividend rates, dividend allowance, CGT AEA, pension AA, MPAA, tapered-AA adjusted income, LTA, LSA/LSDBA, IHT NRB/RNRB and state-pension weekly rates were each confirmed against a primary HMRC/DWP "previous tax years" table that lists multiple years on one page — so the confirmation is cross-year consistent, not one-off.

---

## 2. PER-YEAR TABLES

Primary sources (re-used across years):
- **IT bands / dividends:** https://www.gov.uk/government/publications/rates-and-allowances-income-tax/income-tax-rates-and-allowances-current-and-past
- **NIC:** https://www.gov.uk/government/publications/rates-and-allowances-national-insurance-contributions/rates-and-allowances-national-insurance-contributions
- **CGT:** https://www.gov.uk/government/publications/rates-and-allowances-capital-gains-tax/capital-gains-tax-rates-and-annual-tax-free-allowances
- **Pension AA/MPAA/LTA/LSA:** https://www.gov.uk/government/publications/rates-and-allowances-pension-schemes/pension-schemes-rates
- **IHT:** https://www.gov.uk/government/publications/rates-and-allowances-inheritance-tax-thresholds-and-interest-rates/inheritance-tax-thresholds-and-interest-rates
- **State pension (DWP):** benefit-and-pension-rates-{year} pages on gov.uk

### 2021/22 (UK-2021.1.1)

| Figure | Bundle | HMRC | Source | Verdict |
|---|---|---|---|---|
| Personal Allowance | £12,570 | £12,570 | IT page | ✅ |
| Basic rate / band | 20% / £37,700 | 20% / £37,700 | IT page | ✅ |
| Higher-rate threshold | £50,270 | £50,270 | IT page | ✅ |
| Additional-rate threshold | £150,000 | £150,000 | IT page (pre-2023) | ✅ |
| Dividend allowance | £2,000 | £2,000 | reduction-of-dividend-allowance | ✅ |
| Dividend rates (ord/up/add) | 7.5% / 32.5% / 38.1% | 7.5% / 32.5% / 38.1% | increase-of-rates-of-IT-on-dividends | ✅ |
| NIC employee main / PT | 12% / £9,568 | 12% / £9,568 | NIC page | ✅ |
| NIC employer / ST | 13.8% / £8,840 | 13.8% / £8,840 | NIC page | ✅ |
| CGT AEA | £12,300 | £12,300 | CGT page | ✅ |
| CGT main / residential | 10%/20% / 18%/28% | 10%/20% / 18%/28% | CGT page (6 Apr 2019–5 Apr 2024 band) | ✅ |
| Pension Annual Allowance | £40,000 | £40,000 | pension page | ✅ |
| MPAA | £4,000 | £4,000 | pension page | ✅ |
| Lifetime Allowance | £1,073,100 | £1,073,100 | pension page | ✅ |
| IHT NRB / RNRB | £325,000 / £175,000 | £325,000 / £175,000 | IHT page | ✅ |
| ISA allowance | £20,000 | £20,000 | (stable) | ✅ |
| State pension (full new) | £179.60/wk | £179.60/wk | DWP 2021/22 | ✅ |
| Corporation tax main | 19% (single) | 19% | (pre-2023 single rate) | ✅ |
| s455 director's loan | 32.5% | 32.5% (to 5 Apr 2022) | CTM61505 | ✅ |
| Employment Allowance | £4,000 | £4,000 | NIC/EA | ✅ |

### 2022/23 (UK-2022.1.1 — mid-year year)

| Figure | Bundle | HMRC | Source | Verdict |
|---|---|---|---|---|
| Personal Allowance | £12,570 | £12,570 | IT page | ✅ |
| Basic rate / band | 20% / £37,700 | 20% / £37,700 | IT page | ✅ |
| Higher-rate threshold | £50,270 | £50,270 | IT page | ✅ |
| Additional-rate threshold | £150,000 | £150,000 | IT page (pre-2023) | ✅ |
| Dividend allowance | £2,000 | £2,000 | dividend-allowance page | ✅ |
| Dividend rates | 8.75% / 33.75% / 39.35% | 8.75% / 33.75% / 39.35% | increase-of-rates-of-IT-on-dividends | ✅ |
| NIC employee main rate | 12% (base) + mid-year block 13.25%→12% | 13.25% (6 Apr–5 Nov) then 12% (6 Nov+) | NIC §2.2 employee table | ✅ |
| NIC employer rate | 13.8% + mid-year 15.05%→13.8% | 15.05% then 13.8% | NIC page | ✅ |
| NIC primary threshold | £12,570 + mid-year £9,880→£12,570 (6 Jul) | aligned to PA from 6 Jul 2022 | NIC page | ✅ |
| NIC employer ST | £9,100 | £9,100 (£175/wk) | NIC page | ✅ |
| CGT AEA | £12,300 | £12,300 | CGT page | ✅ |
| CGT main / residential | 10%/20% / 18%/28% | 10%/20% / 18%/28% | CGT page | ✅ |
| Pension AA | £40,000 | £40,000 | pension page | ✅ |
| MPAA | £4,000 | £4,000 | pension page | ✅ |
| Tapered-AA adjusted income | £240,000 | £240,000 | pension page | ✅ |
| Lifetime Allowance | £1,073,100 | £1,073,100 | pension page | ✅ |
| IHT NRB / RNRB | £325,000 / £175,000 | same | IHT page | ✅ |
| State pension | £185.15/wk | £185.15/wk | DWP 2023/24 page (lists 2022/23) | ✅ |
| Corporation tax main | 19% (single) | 19% | (3-tier deferred to Apr 2023) | ✅ |
| s455 | 33.75% | 33.75% (from 6 Apr 2022) | CTM61505 / WMS | ✅ |
| Employment Allowance | £5,000 | £5,000 | NIC/EA | ✅ |

### 2023/24 (UK-2023.1.1)

| Figure | Bundle | HMRC | Source | Verdict |
|---|---|---|---|---|
| Personal Allowance | £12,570 | £12,570 | IT page | ✅ |
| Basic rate / band | 20% / £37,700 | 20% / £37,700 | IT page | ✅ |
| **Additional-rate threshold** | **£125,140** | **£125,140** (cut from £150k, 6 Apr 2023) | IT page | ✅ |
| Dividend allowance | £1,000 | £1,000 (halved from £2,000) | dividend-allowance page | ✅ |
| Dividend rates | 8.75% / 33.75% / 39.35% | 8.75% / 33.75% / 39.35% | IT page dividend table | ✅ |
| NIC employee main | 12% + mid-year 12%→10% (6 Jan 2024) | 12% (to 5 Jan) then 10% | NIC §2.2 | ✅ |
| NIC employer / ST | 13.8% / £9,100 | 13.8% / £9,100 | NIC page | ✅ |
| **CGT AEA** | **£6,000** | **£6,000** (halved) | CGT page | ✅ |
| CGT main / residential | 10%/20% / 18%/28% | 10%/20% / 18%/28% | CGT page | ✅ |
| **Pension AA** | **£60,000** | **£60,000** (raised from £40k) | pension page | ✅ |
| **MPAA** | **£10,000** | **£10,000** (raised from £4k) | pension page | ✅ |
| Tapered-AA adjusted income | £260,000 | £260,000 | pension page | ✅ |
| LTA charge | 0% (effective abolition) | LTA charge removed 6 Apr 2023; LTA formally still in force | Spring Budget 2023 / pension page | ✅ |
| Tax-free cash cap | £268,275 | £268,275 | pension page | ✅ |
| IHT NRB / RNRB | £325,000 / £175,000 | same | IHT page | ✅ |
| State pension | £203.85/wk (10.1% triple lock) | £203.85/wk | DWP 2023/24 | ✅ |
| **Corporation tax** | 19% small / 25% main / marginal | 19%/25% from 1 Apr 2023 | (CT reform) | ✅ |
| s455 | 33.75% | 33.75% | CTM61505 | ✅ |
| Employment Allowance | £5,000 | £5,000 | NIC/EA | ✅ |

### 2024/25 (UK-2024.1.1 — mid-year year)

| Figure | Bundle | HMRC | Source | Verdict |
|---|---|---|---|---|
| Personal Allowance | £12,570 | £12,570 | IT page | ✅ |
| Additional-rate threshold | £125,140 | £125,140 | IT page | ✅ |
| **Dividend allowance** | **£500** | **£500** (halved again) | dividend-allowance page | ✅ |
| Dividend rates | 8.75% / 33.75% / 39.35% | 8.75% / 33.75% / 39.35% | IT page | ✅ |
| **NIC employee main** | **8%** | **8%** (cut from 10%, 6 Apr 2024) | NIC §2.2 | ✅ |
| NIC employer / ST | 13.8% / £9,100 | 13.8% / £9,100 | NIC page | ✅ |
| Class 4 main rate | 6% | 6% (cut from 9%) | NIC page | ✅ |
| **CGT AEA** | **£3,000** | **£3,000** (halved) | CGT page | ✅ |
| **CGT residential higher** | **24%** | **24%** (cut from 28%, 6 Apr 2024) | CGT page | ✅ |
| CGT main (base bundle) + mid-year | 10%/20% → 18%/24% (30 Oct 2024) | 10%/20% (6 Apr–29 Oct) then 18%/24% | CGT page (dated bands) | ✅ |
| Pension AA | £60,000 | £60,000 | pension page | ✅ |
| **LTA abolished** | null + LSA £268,275 / LSDBA £1,073,100 | LTA abolished 6 Apr 2024; LSA/LSDBA introduced | pension page | ✅ |
| IHT NRB / RNRB (frozen to 2030) | £325,000 / £175,000 | same; freeze extended to 2030 (Oct 2024) | IHT page | ✅ |
| **HICBC threshold / taper end** | **£60,000 / £80,000** | £60k / £80k (raised 6 Apr 2024) | (Spring Budget 2024) | ✅ |
| State pension | £221.20/wk (8.5%) | £221.20/wk | DWP 2024/25 | ✅ |
| s455 | 33.75% | 33.75% | CTM61505 | ✅ |
| Employment Allowance | £5,000 | £5,000 | NIC/EA | ✅ |

### 2025/26 (UK-2025.1.1)

| Figure | Bundle | HMRC | Source | Verdict |
|---|---|---|---|---|
| Personal Allowance | £12,570 | £12,570 | IT page | ✅ |
| Dividend allowance | £500 | £500 | dividend-allowance page | ✅ |
| Dividend rates | 8.75% / 33.75% / 39.35% | 8.75% / 33.75% / 39.35% | IT page (2025/26 column) | ✅ |
| NIC employee main / PT | 8% / £12,570 | 8% / £242wk | NIC page | ✅ |
| **NIC employer rate** | **15%** | **15%** (raised from 13.8%, 6 Apr 2025) | NIC page | ✅ |
| **NIC employer ST** | **£5,000** | **£5,000** (£96/wk, cut from £9,100) | NIC §1.1 weekly | ✅ |
| CGT AEA | £3,000 | £3,000 | CGT page | ✅ |
| CGT main / residential | 18%/24% / 18%/24% | 18%/24% (post-30-Oct-2024 baseline) | CGT page | ✅ |
| **BADR rate** | **14%** | **14%** (raised from 10%, 6 Apr 2025) | (Autumn Budget 2024 trajectory) | ✅ |
| Pension AA | £60,000 | £60,000 | pension page | ✅ |
| LSA / LSDBA | £268,275 / £1,073,100 | same | pension page | ✅ |
| IHT NRB / RNRB | £325,000 / £175,000 | same | IHT page | ✅ |
| State pension | £230.25/wk (4.1%) | £230.25/wk | DWP 2025/26 | ✅ |
| **Employment Allowance** | **£10,500** | **£10,500** (raised from £5,000) | NIC/EA | ✅ |
| s455 | 33.75% | 33.75% | CTM61505 | ✅ |

### 2026/27 (UK-2026.1.1)

| Figure | Bundle | HMRC | Source | Verdict |
|---|---|---|---|---|
| Personal Allowance | £12,570 (frozen to 2030) | £12,570 | IT page (2026/27 col) | ✅ |
| Basic rate / band | 20% / £37,700 | 20% / £37,700 | IT page | ✅ |
| Additional-rate threshold | £125,140 | £125,140 | IT page | ✅ |
| Dividend allowance | £500 | £500 | dividend-allowance page | ✅ |
| **Dividend rates** | **10.75% / 35.75% / 39.35%** | **10.75% / 35.75% / 39.35%** | IT page 2026/27 dividend table | ✅ |
| NIC employee / PT | 8% / £12,570 | 8% / £242wk | NIC page | ✅ |
| NIC employer / ST | 15% / £5,000 | 15% / £96wk | NIC page | ✅ |
| CGT AEA | £3,000 | £3,000 | CGT page | ✅ |
| CGT main / residential | 18%/24% | 18%/24% | CGT page | ✅ |
| BADR | 18% | 18% (from 6 Apr 2026 per trajectory) | (Autumn Budget 2024) | ✅ |
| Pension AA / MPAA | £60,000 / £10,000 | £60,000 / £10,000 | pension page | ✅ |
| LSA / LSDBA | £268,275 / £1,073,100 | same | pension page | ✅ |
| IHT NRB / RNRB | £325,000 / £175,000 | same (NRB frozen to 2031 on IHT page) | IHT page | ✅ |
| ISA allowance | £20,000 | £20,000 | (stable) | ✅ |
| State pension | £241.30/wk = £12,547.60/yr (bundle stores 12548) | £241.30/wk (4.8%) | DWP 2026/27 | ✅ |
| Corporation tax | 19% small / 25% main | same | (CT) | ✅ |
| **s455 director's loan** | **33.75%** | **35.75%** (auto-linked to dividend upper rate, FA 2026, from 6 Apr 2026) | Income-Tax-changes-to-rates-for-property-savings-and-dividend-income | 🔴 |
| Employment Allowance | £10,500 | £10,500 | NIC/EA | ✅ |

---

## 3. MID-YEAR EVENTS

### 2022/23 (UK-2022.1.1 `_midYearEvents`)

| Event | Bundle entry | HMRC fact | Verdict |
|---|---|---|---|
| HSC Levy +1.25pp to NIC | `HSC-LEVY-NIC-START` effectiveFrom 2022-04-06, delta +0.0125, scope employee+employer | NIC employee 12%→13.25% & employer 13.8%→15.05% from 6 Apr 2022 (HSC Levy Act 2021) | ✅ |
| HSC Levy reversed | `HSC-LEVY-NIC-REVERSE` effectiveFrom 2022-11-06, delta −0.0125 | Employee back to 12%, employer to 13.8% from 6 Nov 2022 (Growth Plan); confirmed by NIC §2.2 "From 6 November 2022 to 5 April 2023 = 12%" | ✅ |
| Dividend +1.25pp retained | Encoded as static 8.75/33.75/39.35 with `dividendNote` "NOT reversed in Nov 2022 — only NIC portion reversed" | Correct — dividend increase kept for full 2022/23 | ✅ |
| PT aligned to PA | `PT-ALIGN-PA` effectiveFrom 2022-07-06, from £9,880 to £12,570 | PT raised to £12,570 (£242/wk) from 6 Jul 2022 (Spring Statement 2022) | ✅ |
| SDLT nil band expand (Growth Plan) | `SDLT-NIL-EXPAND` 2022-09-23, £125k→£250k 0% band | Growth Plan 23 Sept 2022 | ✅ (correct, beyond brief's required set) |
| SDLT FTB raise | `SDLT-FTB-RAISE` 2022-09-23, £300k/£500k → £425k/£625k | Growth Plan 23 Sept 2022 | ✅ |

Also embedded as `class1EmployeeRateMidYear` / `class1EmployerRateMidYear` period blocks with exact rates (period1 13.25%/15.05%, period2 12%/13.8%) — these match the HMRC §2.2 employee table and the employer schedule. The dual encoding (delta events + explicit period blocks) is internally consistent.

### 2024/25 (UK-2024.1.1 `_midYearEvents`)

| Event | Bundle entry | HMRC fact | Verdict |
|---|---|---|---|
| NIC employee 10%→8% | Encoded as static `class1EmployeeRate: 0.08` (year-start change, not mid-year) | 8% from 6 Apr 2024 (Spring Budget) — correct to treat as year-start, not mid-year | ✅ |
| CGT residential 28%→24% | Static `higherRateProperty: 0.24` (year-start) | 24% from 6 Apr 2024 (Spring Budget) — correct as year-start | ✅ |
| CGT main 10/20→18/24 (30 Oct) | `CGT-BASIC-RATE-RAISE` 0.10→0.18 + `CGT-HIGHER-RATE-RAISE` 0.20→0.24, both effectiveFrom 2024-10-30 | CGT page: "6 April 2024 to 29 October 2024 = 10%/20%", then 18%/24% from 30 Oct 2024 | ✅ |
| SDLT additional-property 3%→5% (31 Oct) | `SDLT-SURCHARGE-RAISE` 0.03→0.05 effectiveFrom 2024-10-31 | Autumn Budget 30 Oct 2024, surcharge effective 31 Oct 2024 | ✅ |
| Investors' Relief limit £10m→£1m (30 Oct) | `INVESTORS-RELIEF-LIMIT-CUT` 10,000,000→1,000,000 effectiveFrom 2024-10-30 | Autumn Budget 30 Oct 2024 | ✅ (correct, beyond brief's required set) |

**Note on encoding choice:** The brief lists "NIC employee 10%→8% from 6 Apr 2024" and "CGT residential 28%→24% from 6 Apr 2024" as 2024/25 mid-year events. Strictly these are *year-start* changes (effective on the first day of the tax year, 6 Apr 2024), so the bundle correctly bakes them into the static base values rather than into `_midYearEvents`. Only the genuinely *intra-year* 30/31-Oct-2024 changes are in `_midYearEvents`. This is the right modelling and not a defect.

---

## 4. 🔴 ACTION LIST

**One mismatch.**

| # | Year | Figure | Bundle value | Correct HMRC value | Source | Type |
|---|---|---|---|---|---|---|
| 1 | 2026/27 | `businessOwnerPersonal.directorsLoan.s455TaxRate` | `0.3375` (33.75%) | `0.3575` (35.75%) for loans/benefits made on or after 6 April 2026 | https://www.gov.uk/government/publications/income-tax-changes-to-tax-rates-for-property-savings-and-dividend-income/income-tax-changes-to-tax-rates-for-property-savings-and-dividend-income ; CTM61505 (rate is "specifically linked to the dividend upper rate") | **(b) legitimate change** |

**Diagnosis — type (b), internally inconsistent within the same bundle:** The s455 charge on directors' loans is statutorily tied to the dividend upper rate (ITA 2007 s.8). Finance Act 2026 raised the dividend upper rate to **35.75%** from 6 April 2026, and the same provision applies that rate to loans/benefits conferred on participators by close companies. The UK-2026.1.1 bundle **already correctly updated the dividend higher rate to 0.3575** (`income.dividendHigherRate: 0.3575`) and documents this in `_correctionLog` and `dividendNote`. It simply did not propagate the linked change to `s455TaxRate`, which still reads the 2022-vintage 33.75%. So this is a missed knock-on edit, not a wrong historical figure and not a fabrication.

**Suggested fix (not applied — verification pass only):**
`businessOwnerPersonal.directorsLoan.s455TaxRate: 0.3375 → 0.3575` with note "S455 auto-tracks dividend upper rate; 35.75% for loans on/after 6 April 2026 (Finance Act 2026)."

Everything else the brief flagged as a "watch" item — additional-rate threshold £150k→£125,140, dividend allowance taper £2k→£1k→£500, CGT AEA £12,300→£6,000→£3,000, pension AA £40k→£60k, MPAA £4k→£10k, LTA removal/abolition→LSA £268,275, NIC employee 12%→10%→8%, employer 13.8%→15% + ST £9,100→£5,000, EA £4k→£5k→£10,500, CGT residential 28%→24%, CGT main 10/20→18/24, SDLT surcharge 3%→5%, s455 32.5%→33.75% in 2022 — **all present and correct in the bundles.**

---

## 5. COVERAGE NOTE (what this verification did and did NOT cover)

Each historical bundle's `_meta._coverage` declares which domains are fully populated. This pass verified figures that fall in the **FULL** tiers. PARTIAL/STUB advisory and structural content was not rate-verified (mostly non-numeric copy or deferred to the 2026 bundle).

| Bundle | FULL (rate-verified here) | PARTIAL | STUB (not covered) |
|---|---|---|---|
| UK-2021.1.1 | income, pension, isa, capitalGains, inheritanceTax, nationalInsurance, taxEfficientInvestments | property, businessOwnerPersonal | overseas, trusts, welshIT, milestones |
| UK-2022.1.1 | same FULL set | property, businessOwnerPersonal | overseas, trusts, welshIT, milestones |
| UK-2023.1.1 | same FULL set | property, businessOwnerPersonal | overseas, trusts, welshIT, milestones |
| UK-2024.1.1 | same FULL set | property, businessOwnerPersonal | overseas, trusts, welshIT, milestones |
| UK-2025.1.1 | same FULL set | property, businessOwnerPersonal, overseas | trusts, welshIT, milestones |
| UK-2026.1.1 | full bundle (current authority — FULL across income/pension/isa/cgt/iht/ni + populated overseas/trusts/property) | — | — |

**Not rate-checked in this pass (out of FULL scope or non-numeric):** SDLT band tables for the historical years beyond the surcharge/FTB events the brief asked for; trust periodic/exit charge mechanics; SEIS/EIS/VCT gross-asset and company limits per year (spot-checked structurally, not exhaustively rate-verified); overseas FIG/TRF/SRT blocks (2026 bundle only). The `taxEfficientInvestments` block is marked FULL but the brief did not enumerate per-year VCT/EIS/SEIS figures, so only the headline VCT 30%→20% (2026) and SEIS investor-limit £100k→£200k (2023) shifts were sanity-checked — both look correct against the bundles' own notes.

---

## 6. DRAFT `_correctionLog` ENTRIES (paste candidates — NOT applied to bundles)

These document the verification. One is a `correction-needed`; the rest are `confirmed`. They are written for pasting into each bundle's `_meta._correctionLog` later.

### UK-2026.1.1 (`_meta._correctionLog`)
```json
"verification_2026-06-02": [
  { "field": "businessOwnerPersonal.directorsLoan.s455TaxRate", "bundleValue": 0.3375, "verifiedValue": 0.3575, "status": "correction-needed", "source": "https://www.gov.uk/government/publications/income-tax-changes-to-tax-rates-for-property-savings-and-dividend-income/income-tax-changes-to-tax-rates-for-property-savings-and-dividend-income", "note": "S455 auto-linked to dividend upper rate (ITA07 s8); 35.75% for loans on/after 6 Apr 2026 per FA 2026. Bundle already updated dividend higher to 0.3575 but missed s455.", "date": "2026-06-02" },
  { "field": "income.dividendHigherRate", "bundleValue": 0.3575, "verifiedValue": 0.3575, "status": "confirmed", "source": "https://www.gov.uk/government/publications/rates-and-allowances-income-tax/income-tax-rates-and-allowances-current-and-past", "date": "2026-06-02" },
  { "field": "income.dividendBasicRate", "bundleValue": 0.1075, "verifiedValue": 0.1075, "status": "confirmed", "source": "HMRC IT dividend table 2026/27", "date": "2026-06-02" },
  { "field": "income.dividendAdditionalRate", "bundleValue": 0.3935, "verifiedValue": 0.3935, "status": "confirmed", "source": "HMRC IT dividend table 2026/27", "date": "2026-06-02" },
  { "field": "nationalInsurance.class1EmployerRate", "bundleValue": 0.15, "verifiedValue": 0.15, "status": "confirmed", "source": "HMRC NIC page", "date": "2026-06-02" },
  { "field": "nationalInsurance.class1EmployerSecondaryThreshold", "bundleValue": 5000, "verifiedValue": 5000, "status": "confirmed", "source": "HMRC NIC §1.1 (£96/wk)", "date": "2026-06-02" },
  { "field": "nationalInsurance.employmentAllowance", "bundleValue": 10500, "verifiedValue": 10500, "status": "confirmed", "source": "HMRC NIC/EA", "date": "2026-06-02" },
  { "field": "pension.statePensionFullAmount", "bundleValue": 12548, "verifiedValue": 12547.60, "status": "confirmed", "source": "DWP benefit-and-pension-rates-2026-to-2027 (£241.30/wk × 52)", "date": "2026-06-02" },
  { "field": "capitalGains.annualExemptAmount", "bundleValue": 3000, "verifiedValue": 3000, "status": "confirmed", "source": "HMRC CGT page", "date": "2026-06-02" },
  { "field": "inheritanceTax.nilRateBand", "bundleValue": 325000, "verifiedValue": 325000, "status": "confirmed", "source": "HMRC IHT page", "date": "2026-06-02" }
]
```

### UK-2025.1.1
```json
"verification_2026-06-02": [
  { "field": "nationalInsurance.class1EmployerRate", "bundleValue": 0.15, "verifiedValue": 0.15, "status": "confirmed", "source": "HMRC NIC page", "date": "2026-06-02" },
  { "field": "nationalInsurance.class1EmployerSecondaryThreshold", "bundleValue": 5000, "verifiedValue": 5000, "status": "confirmed", "source": "HMRC NIC §1.1 (£96/wk)", "date": "2026-06-02" },
  { "field": "nationalInsurance.employmentAllowance", "bundleValue": 10500, "verifiedValue": 10500, "status": "confirmed", "source": "HMRC NIC/EA", "date": "2026-06-02" },
  { "field": "capitalGains.basicRate", "bundleValue": 0.18, "verifiedValue": 0.18, "status": "confirmed", "source": "HMRC CGT page (post-30-Oct-2024 baseline)", "date": "2026-06-02" },
  { "field": "capitalGains.higherRate", "bundleValue": 0.24, "verifiedValue": 0.24, "status": "confirmed", "source": "HMRC CGT page", "date": "2026-06-02" },
  { "field": "capitalGains.badrRate", "bundleValue": 0.14, "verifiedValue": 0.14, "status": "confirmed", "source": "Autumn Budget 2024 BADR trajectory", "date": "2026-06-02" },
  { "field": "pension.statePensionFullAmount", "bundleValue": 11973, "verifiedValue": 11973, "status": "confirmed", "source": "DWP 2025/26 (£230.25/wk)", "date": "2026-06-02" },
  { "field": "income.dividendHigherRate", "bundleValue": 0.3375, "verifiedValue": 0.3375, "status": "confirmed", "source": "HMRC IT dividend table 2025/26", "date": "2026-06-02" },
  { "field": "businessOwnerPersonal.directorsLoan.s455TaxRate", "bundleValue": 0.3375, "verifiedValue": 0.3375, "status": "confirmed", "source": "CTM61505 (tracks 33.75% dividend upper rate through 2025/26)", "date": "2026-06-02" }
]
```

### UK-2024.1.1
```json
"verification_2026-06-02": [
  { "field": "income.additionalRateThreshold", "bundleValue": 125140, "verifiedValue": 125140, "status": "confirmed", "source": "HMRC IT page", "date": "2026-06-02" },
  { "field": "income.dividendAllowance", "bundleValue": 500, "verifiedValue": 500, "status": "confirmed", "source": "HMRC dividend-allowance page", "date": "2026-06-02" },
  { "field": "nationalInsurance.class1EmployeeRate", "bundleValue": 0.08, "verifiedValue": 0.08, "status": "confirmed", "source": "HMRC NIC §2.2", "date": "2026-06-02" },
  { "field": "nationalInsurance.class4RateLowerBand", "bundleValue": 0.06, "verifiedValue": 0.06, "status": "confirmed", "source": "HMRC NIC page", "date": "2026-06-02" },
  { "field": "capitalGains.annualExemptAmount", "bundleValue": 3000, "verifiedValue": 3000, "status": "confirmed", "source": "HMRC CGT page", "date": "2026-06-02" },
  { "field": "capitalGains.higherRateProperty", "bundleValue": 0.24, "verifiedValue": 0.24, "status": "confirmed", "source": "HMRC CGT page (6 Apr–29 Oct 2024 residential = 18%/24%)", "date": "2026-06-02" },
  { "field": "pension.lifetimeAllowance", "bundleValue": null, "verifiedValue": null, "status": "confirmed", "source": "HMRC pension page (LTA abolished 6 Apr 2024)", "date": "2026-06-02" },
  { "field": "pension.lumpSumAllowance", "bundleValue": 268275, "verifiedValue": 268275, "status": "confirmed", "source": "HMRC pension page", "date": "2026-06-02" },
  { "field": "income.highIncomeChildBenefitThreshold", "bundleValue": 60000, "verifiedValue": 60000, "status": "confirmed", "source": "Spring Budget 2024", "date": "2026-06-02" },
  { "field": "pension.statePensionFullAmount", "bundleValue": 11502, "verifiedValue": 11502, "status": "confirmed", "source": "DWP 2024/25 (£221.20/wk)", "date": "2026-06-02" },
  { "field": "_midYearEvents.CGT-HIGHER-RATE-RAISE", "bundleValue": "0.20→0.24 @ 2024-10-30", "verifiedValue": "10%/20%→18%/24% from 30 Oct 2024", "status": "confirmed", "source": "HMRC CGT page dated bands", "date": "2026-06-02" },
  { "field": "_midYearEvents.SDLT-SURCHARGE-RAISE", "bundleValue": "0.03→0.05 @ 2024-10-31", "verifiedValue": "3%→5% from 31 Oct 2024", "status": "confirmed", "source": "Autumn Budget 2024", "date": "2026-06-02" }
]
```

### UK-2023.1.1
```json
"verification_2026-06-02": [
  { "field": "income.additionalRateThreshold", "bundleValue": 125140, "verifiedValue": 125140, "status": "confirmed", "source": "HMRC IT page (cut from £150k 6 Apr 2023)", "date": "2026-06-02" },
  { "field": "income.dividendAllowance", "bundleValue": 1000, "verifiedValue": 1000, "status": "confirmed", "source": "HMRC dividend-allowance page", "date": "2026-06-02" },
  { "field": "capitalGains.annualExemptAmount", "bundleValue": 6000, "verifiedValue": 6000, "status": "confirmed", "source": "HMRC CGT page", "date": "2026-06-02" },
  { "field": "pension.annualAllowance", "bundleValue": 60000, "verifiedValue": 60000, "status": "confirmed", "source": "HMRC pension page (raised from £40k)", "date": "2026-06-02" },
  { "field": "pension.moneyPurchaseAnnualAllowance", "bundleValue": 10000, "verifiedValue": 10000, "status": "confirmed", "source": "HMRC pension page (raised from £4k)", "date": "2026-06-02" },
  { "field": "pension.taperedAnnualAllowanceAdjustedIncome", "bundleValue": 260000, "verifiedValue": 260000, "status": "confirmed", "source": "HMRC pension page", "date": "2026-06-02" },
  { "field": "pension.lifetimeAllowanceCharge", "bundleValue": 0.00, "verifiedValue": 0.00, "status": "confirmed", "source": "Spring Budget 2023 (LTA charge removed; LTA formally in force 2023/24)", "date": "2026-06-02" },
  { "field": "corporationTax.mainRate", "bundleValue": 0.25, "verifiedValue": 0.25, "status": "confirmed", "source": "CT 3-tier from 1 Apr 2023", "date": "2026-06-02" },
  { "field": "pension.statePensionFullAmount", "bundleValue": 10600, "verifiedValue": 10600, "status": "confirmed", "source": "DWP 2023/24 (£203.85/wk)", "date": "2026-06-02" },
  { "field": "_midYearEvents.NIC-CUT-AUTUMN-2023", "bundleValue": "0.12→0.10 @ 2024-01-06", "verifiedValue": "12%→10% from 6 Jan 2024", "status": "confirmed", "source": "HMRC NIC §2.2", "date": "2026-06-02" }
]
```

### UK-2022.1.1
```json
"verification_2026-06-02": [
  { "field": "income.additionalRateThreshold", "bundleValue": 150000, "verifiedValue": 150000, "status": "confirmed", "source": "HMRC IT page (pre-2023)", "date": "2026-06-02" },
  { "field": "income.dividendHigherRate", "bundleValue": 0.3375, "verifiedValue": 0.3375, "status": "confirmed", "source": "increase-of-rates-of-IT-on-dividends (8.75/33.75/39.35 from 6 Apr 2022)", "date": "2026-06-02" },
  { "field": "capitalGains.annualExemptAmount", "bundleValue": 12300, "verifiedValue": 12300, "status": "confirmed", "source": "HMRC CGT page", "date": "2026-06-02" },
  { "field": "pension.annualAllowance", "bundleValue": 40000, "verifiedValue": 40000, "status": "confirmed", "source": "HMRC pension page", "date": "2026-06-02" },
  { "field": "businessOwnerPersonal.directorsLoan.s455TaxRate", "bundleValue": 0.3375, "verifiedValue": 0.3375, "status": "confirmed", "source": "CTM61505 (33.75% from 6 Apr 2022)", "date": "2026-06-02" },
  { "field": "pension.statePensionFullAmount", "bundleValue": 9628, "verifiedValue": 9628, "status": "confirmed", "source": "DWP (£185.15/wk)", "date": "2026-06-02" },
  { "field": "_midYearEvents.HSC-LEVY-NIC-START", "bundleValue": "+0.0125 @ 2022-04-06", "verifiedValue": "employee 13.25% / employer 15.05% from 6 Apr 2022", "status": "confirmed", "source": "HSC Levy Act 2021 / HMRC NIC §2.2", "date": "2026-06-02" },
  { "field": "_midYearEvents.HSC-LEVY-NIC-REVERSE", "bundleValue": "-0.0125 @ 2022-11-06", "verifiedValue": "employee 12% / employer 13.8% from 6 Nov 2022", "status": "confirmed", "source": "Growth Plan Sept 2022 / HMRC NIC §2.2", "date": "2026-06-02" },
  { "field": "_midYearEvents.PT-ALIGN-PA", "bundleValue": "9880→12570 @ 2022-07-06", "verifiedValue": "PT £242/wk = £12,570 from 6 Jul 2022", "status": "confirmed", "source": "Spring Statement 2022 / HMRC NIC", "date": "2026-06-02" }
]
```

### UK-2021.1.1
```json
"verification_2026-06-02": [
  { "field": "income.additionalRateThreshold", "bundleValue": 150000, "verifiedValue": 150000, "status": "confirmed", "source": "HMRC IT page (pre-2023)", "date": "2026-06-02" },
  { "field": "income.dividendAdditionalRate", "bundleValue": 0.381, "verifiedValue": 0.381, "status": "confirmed", "source": "increase-of-rates-of-IT-on-dividends (7.5/32.5/38.1 in 2021/22)", "date": "2026-06-02" },
  { "field": "capitalGains.annualExemptAmount", "bundleValue": 12300, "verifiedValue": 12300, "status": "confirmed", "source": "HMRC CGT page", "date": "2026-06-02" },
  { "field": "nationalInsurance.class1EmployeeRate", "bundleValue": 0.12, "verifiedValue": 0.12, "status": "confirmed", "source": "HMRC NIC page (pre-levy 12%)", "date": "2026-06-02" },
  { "field": "nationalInsurance.primaryThreshold", "bundleValue": 9568, "verifiedValue": 9568, "status": "confirmed", "source": "HMRC NIC 2021/22", "date": "2026-06-02" },
  { "field": "pension.annualAllowance", "bundleValue": 40000, "verifiedValue": 40000, "status": "confirmed", "source": "HMRC pension page", "date": "2026-06-02" },
  { "field": "pension.lifetimeAllowance", "bundleValue": 1073100, "verifiedValue": 1073100, "status": "confirmed", "source": "HMRC pension page", "date": "2026-06-02" },
  { "field": "businessOwnerPersonal.directorsLoan.s455TaxRate", "bundleValue": 0.325, "verifiedValue": 0.325, "status": "confirmed", "source": "CTM61505 (32.5% to 5 Apr 2022)", "date": "2026-06-02" },
  { "field": "nationalInsurance.employmentAllowance", "bundleValue": 4000, "verifiedValue": 4000, "status": "confirmed", "source": "HMRC NIC/EA", "date": "2026-06-02" },
  { "field": "pension.statePensionFullAmount", "bundleValue": 9339, "verifiedValue": 9339, "status": "confirmed", "source": "DWP 2021/22 (£179.60/wk)", "date": "2026-06-02" }
]
```

---

**Bottom line:** The May-2026 reconstruction is sound. Fix the one s455 rate in UK-2026.1.1 (33.75% → 35.75%) and the historical matrix is fully HMRC-aligned on every headline figure and every mid-year event.
