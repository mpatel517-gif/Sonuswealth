# Sonuswealth Optimiser — 22 Scenarios (UK 2025/26)

**Purpose:** Beyond the £70k SIPP drawdown case (already mapped to 38 strategies), here are 22 OTHER recurring UK personal finance situations where the app delivers measurable savings. Each is computable from the persona JSON.

**Source for all figures:** `src/rules/UK-2026.1.1.json` (PA £12,570, basic rate band £37,700, higher rate 40% to £125,140, additional rate 45%, ISA £20,000, AA £60,000, MPAA £10,000, NRB £325,000, RNRB £175,000, CGT residential 18%/24%, dividend allowance £500).

---

## ACCUMULATION PHASE (working age)

### OPT-A01 — The £100k personal-allowance taper trap
**Trigger:** `income > 100000 AND income < 125140`
**Cost:** Effective marginal rate of 60% in the £25,140 window above £100k. Someone earning £125,000 pays £3,750 *more* tax than someone earning £100,000 in marginal terms.
**Worked example:** Salary £115,000. PA tapered: £12,570 - (£15,000/2) = £5,070. Tax saved on £25k bonus by sacrificing into pension: £15,000 (60% relief).
**Strategies:**
1. Salary sacrifice into pension to bring taxable income to £100k — saves £15k tax + recovers full PA + 8% NI relief = **£16,200/yr**
2. Charity gift aid — £15,000 gross gift extends basic-rate band, claws back £3,750 tax
3. EIS investment — 30% upfront relief + IHT-exempt after 2 years
**Fits:** persona-a if working, persona-c (Catherine, professional), any matrix `*-accumulation` archetype with income > £100k.

### OPT-A02 — Salary vs dividend mix for Ltd directors
**Trigger:** `hasBusiness AND archetype = 'ltd-director'`
**Cost:** A director taking £100k purely as salary pays ~£35,432 income tax + £4,478 employee NI + £15,000 employer NI = £54,910 effective drain.
**Worked example:** Optimal mix for £100k take-home: £12,570 salary (PA) + £37,700 dividend basic-rate + remaining as additional dividends → £24k tax saving vs all-salary.
**Strategies:**
1. £12,570 salary (uses PA, accrues NI year, deductible in company)
2. £37,700 dividends at 8.75% basic rate
3. Pension contribution from company (corporation-tax-deductible, no NI, £60k AA)
**Fits:** ltd-director-* matrix personas, tony-stark-series (when populated), persona-c if Ltd.

### OPT-A03 — Carry-forward annual allowance (3-year window)
**Trigger:** `pension.unused_aa_prior_years > 0 AND income > 60000`
**Cost:** Unused AA from 3 prior years drops off each April 6. A high earner with £150k unused over 3 years loses £67,500 of tax relief (45% × £150k) if not used.
**Worked example:** Director paid £50k bonus. Has £40k unused AA from 2022/23 + £20k from 2023/24. Can contribute up to £60k (current) + £60k carry-forward = £120k — all deductible.
**Strategies:**
1. Single-year mega contribution before April 6 deadline
2. Spread across 2 tax years to manage cashflow
3. Employer pension contribution to bypass own NI/income tax
**Fits:** persona-a, persona-c if professional; ltd-director-accumulation.

### OPT-A04 — Bonus → pension salary sacrifice
**Trigger:** `bonus > 0 AND income + bonus > 50270`
**Cost:** Bonus crossing higher-rate threshold = 40% income tax + 2% NI + 13.8% employer NI lost (sometimes returned to employee).
**Worked example:** £30k bonus on £60k base. Take cash: £12,600 IT + £600 NI = £13,200 keeps £16,800. Sacrifice 100%: £30k goes in pension + £4,140 employer NI saving optionally rebated.
**Strategies:**
1. Full sacrifice to pension — keeps 100% in wrapper
2. Partial sacrifice + ISA — balance liquidity vs lock-up
3. Charity payroll-giving — pre-tax donation
**Fits:** persona-a if employed, persona-b (Henry), any working-age matrix archetype.

### OPT-A05 — ISA vs SIPP vs GIA wrapper choice
**Trigger:** New investable surplus > £0
**Cost:** Wrong wrapper = lost relief or lost flexibility.
**Worked example:** £20k to invest. SIPP for higher-rate taxpayer = £20k gross + £5k tax claw = £33,333 effective vs £20k ISA + tax on gains.
**Strategies:**
1. Higher-rate earner → fill SIPP first (40% relief)
2. Basic-rate earner under-55 → ISA (locked too long otherwise)
3. Already used both → GIA + bed-and-ISA monthly
**Fits:** all accumulation personas.

### OPT-A06 — Marriage Allowance transfer
**Trigger:** `isCouple AND (spouseA.income < PA OR spouseB.income < PA)`
**Cost:** £252/yr lost forever if not claimed; backdatable 4 years = £1,008.
**Worked example:** Spouse 1 income £8,000 (under PA). Transfers £1,260 of PA to spouse 2 earning £40k. Spouse 2 saves £252/yr.
**Strategies:**
1. Claim Marriage Allowance via HMRC personal tax account (5 min)
2. Backdate 4 years (£1,008 cash refund)
3. Re-evaluate annually if income volatile
**Fits:** persona-b (Henry+Diana), any couple-* matrix.

---

## DECUMULATION PHASE (excluded: £70k SIPP — already covered)

### OPT-D01 — State pension deferral
**Trigger:** `age >= SPA AND other_income > 50270 AND state_pension_status = 'not_claimed'`
**Cost:** Drawing SP at higher-rate marginal = lose 40% of £12,548 = £5,019/yr forever.
**Worked example:** Bruce at 67 still drawing £80k from SIPP. Defer SP for 5 years → +5.8% × 5 = 29% enhancement → £16,187/yr at 72 when SIPP depleted.
**Strategies:**
1. Defer SP entirely until lower-income year
2. Defer & take lump-sum (taxed at marginal but with separate band)
3. Coordinate with spouse's SP deferral
**Fits:** persona-a (Bruce 62→67), persona-e (Wonka 78 — already claiming).

### OPT-D02 — Beneficiary drawdown vs death lump sum
**Trigger:** `age > 70 AND pension > 500k AND spouse OR children`
**Cost:** Death post-75 → beneficiary income taxed at marginal rate. Lump sum may push them into additional rate.
**Worked example:** £800k SIPP. Pre-75 death: spouse takes income tax-free (beneficiary drawdown). Post-75 death: each £80k drawn taxed at spouse's marginal — if 40% spouse, £32k lost annually.
**Strategies:**
1. Crystallise & spend SIPP first if post-75 risk high
2. Nominate adult children (multiple income recipients = use multiple PAs)
3. Bypass trust for IHT efficiency
**Fits:** persona-e (Wonka 78), persona-a closer to 75.

### OPT-D03 — Annuity vs drawdown vs hybrid mix
**Trigger:** `retired AND essential_spend > 30k AND longevity_risk_concern`
**Cost:** Pure drawdown leaves longevity risk; pure annuity gives no upside. Mismatch wastes capital.
**Worked example:** £600k pot. £300k annuity buys £18k/yr index-linked guaranteed (covers essentials); £300k drawdown for discretionary spend.
**Strategies:**
1. Annuity floor (essentials) + drawdown ceiling (discretionary)
2. Purchased Life Annuity (PLA) — capital element tax-free
3. With-profits annuity for inflation + upside
**Fits:** persona-a (Bruce decumulation), any *-decumulation matrix.

### OPT-D04 — MPAA trigger management
**Trigger:** `pension_flexibly_accessed AND want_to_keep_contributing`
**Cost:** Flexi-drawdown triggers MPAA = AA drops £60k → £10k. Lose £50k of pension tax relief headroom forever.
**Worked example:** Director took £5k flexi-drawdown to plug cashflow gap. Now wants to contribute £40k. Excess £30k triggers 45% annual allowance charge = £13,500.
**Strategies:**
1. Use UFPLS slicing instead of flexi-access (doesn't trigger MPAA for some forms)
2. Take 25% tax-free cash without crystallising taxable element
3. Phased crystallisation pre-trigger
**Fits:** persona-a if takes early drawdown, ltd-director-transition.

---

## PROPERTY & BTL

### OPT-P01 — S24 mortgage interest restriction
**Trigger:** `assets.btl.count > 0 AND mortgage > 0 AND income > basic_rate`
**Cost:** Pre-2017 deductible interest now only gets 20% basic-rate credit, even for higher-rate landlords.
**Worked example:** BTL income £24k, mortgage interest £10k. Old: profit £14k taxed at 40% = £5,600. New: profit £24k taxed at 40% = £9,600 minus £2,000 credit = £7,600. Extra £2,000/yr lost.
**Strategies:**
1. Incorporate BTL portfolio (Ltd company, deductible interest, 25% CT but more complex)
2. Switch to capital repayment (smaller deduction but builds equity)
3. Sell BTL & reinvest in REIT inside ISA
**Fits:** landlord-* matrix personas.

### OPT-P02 — BTL incorporation analysis
**Trigger:** `landlord AND portfolio > 500k AND age < 65`
**Cost:** Personal ownership = up to 45% on profit + S24 hit. Ltd = 19/25% CT + full interest deduction.
**Worked example:** £800k portfolio, £40k profit, £18k mortgage interest. Personal additional-rate: £14k tax. Ltd: £40k × 25% = £10k. Saves £4k/yr but needs ~£50k incorporation costs (SDLT, CGT, legal).
**Strategies:**
1. Section 162 incorporation relief (CGT rollover)
2. Hybrid LLP partnership structure
3. Gradual transfer via gifts to spouse first
**Fits:** landlord-consolidation, landlord-decumulation.

### OPT-P03 — FHL abolition transition (April 2025)
**Trigger:** `assets.fhl > 0` (Furnished Holiday Let)
**Cost:** From 6 April 2025, FHL loses tax advantages — no longer counts as trading for pension AA, no CGT BADR, mortgage interest restricted same as BTL. Holders losing ~£3k–£8k/yr in lost reliefs.
**Worked example:** £15k FHL profit, £8k mortgage interest. Pre-2025: full deduction + pensionable income = £2,800 tax. Post-2025: £15k taxed at 40% minus £1,600 credit = £4,400. Loses £1,600/yr.
**Strategies:**
1. Sell FHL before April 2025 to lock in 10% BADR CGT (was £30k saving on £300k gain)
2. Convert to long-let BTL (already lost the advantage anyway)
3. Incorporate before transition
**Fits:** any persona with FHL.

### OPT-P04 — SDLT first-time buyer relief
**Trigger:** `is_first_time_buyer AND property_price < 500000`
**Cost:** Missing the relief = up to £15k overpaid SDLT.
**Worked example:** First-time buyer at £450k. FTB relief: 0% to £300k, 5% on £150k = £7,500. Standard: £12,500. Saves £5,000.
**Strategies:**
1. Use FTB relief on purchase (one-time only, lifetime)
2. Buy under £500k threshold (above = lose all relief, pay standard)
3. Sole purchase if partner not FTB (loses relief if joint)
**Fits:** persona-d (Hugo, foundation), single-foundation matrix.

---

## CAPITAL GAINS

### OPT-C01 — CGT annual exemption + bed-and-ISA
**Trigger:** `GIA.gain_unrealised > 3000 AND ISA_unused_allowance > 0`
**Cost:** Unused £3k AEA = up to £720/yr (24% residential) or £600 (24% other) lost forever.
**Worked example:** Holds £25k Apple shares with £8k unrealised gain. Sell £3k gain in March → free. Re-buy inside ISA → wraps gain-free forever. Save £720/yr × every year held.
**Strategies:**
1. Annual bed-and-ISA at £20k limit (max 80% wrap rate)
2. Bed-and-spouse (transfer first, spouse sells using their AEA)
3. Loss harvest GIA in same year as gains
**Fits:** persona-a, persona-c, persona-e (large GIAs).

### OPT-C02 — Bed-and-spouse transfer
**Trigger:** `isCouple AND spouse.cgt_band < own AND unrealised_gain > AEA`
**Cost:** Realising £50k gain at higher rate: £12,000. After transfer to basic-rate spouse: £6,000. Saves £6,000.
**Worked example:** £100k holding with £40k gain. Transfer 50% to spouse (no CGT — spousal transfer). Both realise £20k gain using both £3k AEAs + lower band = ~£3,400 each. Total £6,800 vs £9,600 solo.
**Strategies:**
1. Pre-marriage transfer (gift, no CGT)
2. Same-year split realise to fill both AEAs
3. Combine with bed-and-ISA on each side
**Fits:** couple-* matrix, persona-b (Henry+Diana).

### OPT-C03 — EIS deferral relief
**Trigger:** `realising_large_gain > 50000 AND risk_tolerant`
**Cost:** £100k gain at 24% = £24,000 CGT. EIS defers indefinitely until EIS exit.
**Worked example:** Sale of business gives £200k gain. Invest £200k in EIS within 3 years (back or forward). All £48k CGT deferred. Plus 30% income relief on EIS = £60k income tax refund.
**Strategies:**
1. Single-year EIS deferral
2. Stagger across 3 years for risk diversification
3. Combine with VCT for 30% relief + dividend tax-free
**Fits:** business-sale events, persona-c if sells practice.

### OPT-C04 — Investors' Relief (now 18%)
**Trigger:** `unlisted_co_shares_held > 3yrs AND not_employee`
**Cost:** Standard CGT 24% vs IR 18%. £1M lifetime allowance.
**Worked example:** £300k gain on unlisted share holding (held >3 years, never employee). Standard: £72k. IR: £54k. Saves £18k.
**Strategies:**
1. Hold qualifying shares ≥3 yrs to unlock IR rate
2. Don't take employment in the company (disqualifies)
3. Combine with BADR if eligible
**Fits:** persona-c (if angel investor), ltd-director-decumulation.

---

## ESTATE PLANNING (beyond IHT 38-strategies)

### OPT-E01 — Surplus income gifting (s.21 IHTA)
**Trigger:** `annual_surplus > 5000 AND regular_giving_pattern OR willing_to_start`
**Cost:** Estate growth = future IHT at 40%. £10k/yr surplus into kids over 10 yrs = £100k removed from estate, IHT saving £40k.
**Worked example:** Pensioner drawing £70k, spending £55k. £15k/yr surplus. Set up direct debit to children £15k/yr "out of normal expenditure". After 5 yrs: £75k out of estate, £30k IHT saved. No 7-year clock applies.
**Strategies:**
1. Document gifting pattern (bank statements show regular pattern)
2. Use £3k annual exemption first (carry-forward 1 yr)
3. Wedding/grandchild gifts £5k/£2.5k extra
**Fits:** persona-a, persona-e (high surplus retirees).

### OPT-E02 — BPR-qualifying AIM portfolio
**Trigger:** `estate > NRB AND 2yr_horizon AND risk_tolerant`
**Cost:** Each £100k in standard portfolio = £40k IHT after death. AIM BPR-qualifying portfolio after 2 years held = 100% IHT-exempt.
**Worked example:** £200k moved to AIM BPR portfolio. After 2 years: £80k IHT saved. Volatility risk ~25% — but on £200k = £50k swing vs £80k cert IHT saving.
**Strategies:**
1. 5–10% of liquid estate into AIM BPR
2. Use AIM ISA for double tax shelter (income/CGT + IHT)
3. Combine with conventional EIS portfolio
**Fits:** persona-a, persona-c, persona-e (high estate).

### OPT-E03 — Charity 10% IHT rate reduction
**Trigger:** `taxable_estate > 100000 AND willing_to_leave_to_charity`
**Cost:** Standard IHT 40%. Leave 10% of net estate to charity → IHT rate drops to 36% on the rest.
**Worked example:** Estate £1M, post-NRB taxable £675k. Standard IHT: £270k. Leave £67.5k to charity (10% of net £675k). Remaining £607.5k taxed at 36% = £218.7k. Total estate to family: £713.8k vs £730k under standard — but charity gets £67.5k. NET to family is LESS but charitable goal achieved.
**Strategies:**
1. 10%-precise gift to charity (don't waste with more)
2. CAF charity account for flexible distribution
3. Pair with lifetime gift aid for double benefit
**Fits:** persona-e if charitable inclination, persona-c.

### OPT-E04 — Discounted Gift Trust (DGT)
**Trigger:** `estate > 1M AND wants_income_retention AND wants_IHT_reduction`
**Cost:** Standard gift = full 7-year wait. Outright gift loses income from gifted capital.
**Worked example:** £500k gift to DGT at age 70. £20k/yr income retained for life. Discount calculated by actuary: e.g. 50% based on life expectancy. Half = £250k immediately outside estate. Other half = PET, IHT-free after 7 years.
**Strategies:**
1. Single DGT for one beneficiary line
2. Multi-life DGT covering spouse + children
3. Combine with Loan Trust for full estate efficiency
**Fits:** persona-c, persona-e (estate > £1M, want income).

---

## CROSS-BORDER (deemed-dom, NRI, FIG regime)

### OPT-X01 — FIG (Foreign Income & Gains) 4-year regime
**Trigger:** `recently_uk_resident < 4yrs AND foreign_income > 0`
**Cost:** Default = worldwide income/gains taxed in UK. FIG regime makes first 4 years of foreign income/gains tax-free.
**Worked example:** Indian dual-resident moves to UK. £50k/yr Indian dividend income. Under FIG: £0 UK tax for 4 years. Standard: £20k IT/yr × 4 = £80k saved.
**Strategies:**
1. Elect into FIG for years 1-4 of UK residence
2. Defer foreign-source CGT events to within FIG window
3. Time long-term capital plans around the 4-year horizon
**Fits:** persona-g (Priya NRI).

### OPT-X02 — Indian NRE/NRO/EPF mapping
**Trigger:** `archetype = 'NRI' AND has_indian_assets`
**Cost:** NRE interest tax-free in India + UK reporting required. Wrong wrapper choice = double taxation.
**Worked example:** £100k NRE deposit earning 5% = £5k tax-free in India. UK treats as foreign income unless FIG. Without optimisation: £2k UK tax. With: £0.
**Strategies:**
1. NRE for tax-free Indian deposits
2. EPF transfer rules at UK retirement
3. India-UK DTA treaty positions
**Fits:** persona-g (exact match), any NRI matrix.

---

## LIFE EVENTS

### OPT-L01 — Cohabitation IHT trap
**Trigger:** `isCohabiting AND NOT married_or_civil_partnership AND combined_estate > NRB`
**Cost:** No spousal exemption → both partners get only £325k NRB each, transferred death = IHT bill. Married/CP couples get £1M (£650k NRB + £350k RNRB combined). Cohabiting could lose £270k vs married.
**Worked example:** Cohabiting couple, £900k estate held jointly. Death of first = £575k taxable at 40% = £230k IHT. Married: £0 (spousal exemption).
**Strategies:**
1. Marry or enter civil partnership (transformative)
2. Trust structures around the cohab relationship
3. Life insurance in trust to pay the IHT bill
**Fits:** cohab-sep matrix (3 archetypes).

### OPT-L02 — Divorce — pension sharing vs offsetting
**Trigger:** `lifeStage_event = divorce AND pensions_in_marriage > 0`
**Cost:** Wrong allocation method = £50k–£200k of long-term value lost.
**Worked example:** £600k joint pension + £400k house. Offsetting: spouse A takes pension (taxed eventually), spouse B takes house (CGT-free if PPR). 30-year horizon: pension grows to £1.5M (taxed at 30%) = £1.05M. House grows to £900k (tax-free). Offsetting trade saves £200k+ for spouse B.
**Strategies:**
1. Pension sharing order (PSO) — formal split
2. Offsetting — different assets matched at PV
3. Earmarking — old pre-2000 method, generally avoid
**Fits:** divorced-* matrix (6 archetypes).

---

## SUMMARY MATRIX

| ID | Title | Trigger persona feature | £ saving range/yr | Complexity |
|---|---|---|---|---|
| OPT-A01 | £100k taper trap | income £100k–£125k | £10k–£17k | Low |
| OPT-A02 | Salary/dividend mix | Ltd director | £20k–£25k | Medium |
| OPT-A03 | Carry-forward AA | unused AA + high income | £20k–£60k once | Low |
| OPT-A04 | Bonus → pension | bonus + 40% bracket | 25%–40% of bonus | Low |
| OPT-A05 | Wrapper choice | new surplus | varies | Low |
| OPT-A06 | Marriage Allowance | couple, one under PA | £252/yr | Trivial |
| OPT-D01 | State pension defer | post-SPA still drawing | £5k–£8k/yr | Medium |
| OPT-D02 | Beneficiary drawdown | post-75 risk | £10k–£40k/yr | Medium |
| OPT-D03 | Annuity-hybrid | retired, longevity-worried | varies | Medium |
| OPT-D04 | MPAA management | flexi-drawn + want contrib | £13k once | Medium |
| OPT-P01 | S24 mortgage relief | BTL holder + higher-rate | £2k/yr per BTL | High |
| OPT-P02 | BTL incorporation | portfolio > £500k | £4k/yr | Very high |
| OPT-P03 | FHL abolition | FHL holder | £1.5k–£8k/yr | Medium |
| OPT-P04 | SDLT FTB relief | first-time buyer | £5k–£15k once | Trivial |
| OPT-C01 | CGT AEA bed-and-ISA | unrealised gain | £720/yr | Low |
| OPT-C02 | Bed-and-spouse | couple + asymmetric income | £6k once | Low |
| OPT-C03 | EIS deferral | large gain event | varies | High |
| OPT-C04 | Investors' Relief | unlisted shares >3yr | £18k+ | Medium |
| OPT-E01 | Surplus gifting | retiree with surplus | £40k+ lifetime | Trivial |
| OPT-E02 | AIM BPR portfolio | estate > NRB | £80k+ lifetime | Medium |
| OPT-E03 | Charity 10% rule | charitable + large estate | shifts to charity | Low |
| OPT-E04 | DGT | estate > £1M + income need | £100k+ lifetime | High |
| OPT-X01 | FIG regime | new UK resident | £80k+ (4 yrs) | High |
| OPT-X02 | NRE/NRO mapping | NRI | varies | High |
| OPT-L01 | Cohabitation IHT | unmarried + estate > NRB | £270k lifetime | Trivial-then-Hard |
| OPT-L02 | Divorce pension/offset | divorce + pensions | £50k–£200k once | Very high |

**Plus the original £70k drawdown scenario (OPT-D00) with 38 strategies = 26 distinct scenarios × ~5 strategies avg = ~130 optimisation levers total.**

---

## How this fits the engine

Each scenario should map to:
1. A **trigger function** in `src/engine/optimiser-triggers.js` that returns true if the persona qualifies (`canApplyOptA01(persona)`)
2. A **savings calculator** in `src/engine/optimiser-savings.js` that returns the £ saving for THIS persona (`savingsFor_OptA01(persona)`)
3. A **strategy data file** at `src/rules/optimiser/OPT-A01.json` with the 3+ strategies, explainer, eligibility caveats
4. A **screen component** at `src/screens/Optimiser.jsx` that renders the top-5 wins for the active persona, with click-through cards

## Engine work estimate
- 26 trigger functions: ~30 lines each × 26 = 780 lines = 1 day
- 26 savings calculators: ~50 lines each = 1,300 lines = 2 days
- 26 strategy JSON files: 30 mins each = 13 hours
- Screen component: 1 day
- Regression harness extension to verify savings figures: 1 day
- **Total: ~6 working days**

## UI affordance — Optimiser tab placement
Sits between Tax & Estate and Timeline in the main nav. Two views:
1. **Top-5 personalised** — sorted by £ saving for THIS persona
2. **Full library (26)** — grouped by theme

---

*v1 authored 2026-05-21. Founder review needed before engine work begins. Subset for v0 MVP (top 8): A01, A04, D01, D04, P01, C01, E01, E02.*
