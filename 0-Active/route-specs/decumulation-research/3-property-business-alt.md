Title: Decumulation Decision Taxonomy — Property, Business & Alternative Assets
Version: 1.0
Date: 2026-06-03
Status: DOCUMENTED
Cluster: 3-Engine / decumulation
File name: 3-property-business-alt.md
Purpose: Per-holding draw-classification taxonomy for property, business and alternative assets to close the engine gap where £2,250k of property is NOT modelled as an income source. Info/guidance only — factual factors, NOT regulated advice.

**Summary:** Maps every property/business/alternative asset type to how it produces income, its costs, tax on income+disposal, reliefs at stake, IHT/death treatment, a DRAW-CLASSIFICATION enum, and the data fields the engine must capture.
**Tags:** #engine #decumulation #property #business #alternatives #cgt #iht #bpr #badr
**Updated:** 2026-06-03

---

## §0 — VERIFIED 2026/27 RULE BASE (read before the table)

All figures below were web-verified 2026-06-03. Status flags: **ENACTED** = in force / Royal Assent; **ANNOUNCED** = government-confirmed forward change; **ESTIMATED** = market/behavioural, not statutory.

| Rule | 2026/27 value | Status | Note for engine |
|---|---|---|---|
| CGT residential property | **18% basic-band / 24% higher-band** | ENACTED | Rate depends on where the gain sits stacked on income; 60-day report+pay window |
| CGT other assets (crypto, art, commercial, shares) | 18% / 24% | ENACTED | Same split rates as residential since Oct-2024 Budget aligned them |
| CGT Annual Exempt Amount | **£3,000** | ENACTED | Down from £6,000 (23/24) → £3,000 (24/25 on). Per person. No AEA "beyond £3k" |
| Private Residence Relief (PRR) | Full exemption on main home | ENACTED | Lost on let portion / >0.5ha grounds / business-use portion / periods of absence beyond final-9-month rule |
| FHL regime | **ABOLISHED 6 Apr 2025** | ENACTED | No BADR, no rollover, no gift hold-over, no capital allowances on new spend, no pension relevant-earnings, finance cost now basic-rate-restricted like BTL |
| Section 24 (BTL mortgage interest) | **20% basic-rate tax credit only** | ENACTED | Individuals taxed on GROSS rent; interest is a 20% credit not a deduction → effective rates can exceed 50%. LTD companies still deduct 100% |
| BADR rate | **18%** | ENACTED | Was 10% → 14% (Apr-2025) → **18% (6 Apr 2026)**. Memory note: do NOT cite 14% for 2026/27 |
| BADR lifetime limit | **£1,000,000** | ENACTED | 2-year ownership + trading + officer/employee + ≥5% holding for company. Gains above limit at standard 18/24% |
| BPR/APR 100% relief cap | **£2,500,000** combined APR+BPR per person | ANNOUNCED | **UPDATE: raised from the originally-legislated £1m on 23 Dec 2025.** Above £2.5m → 50% relief = effective 20% IHT. Effective 6 Apr 2026 |
| BPR transferable between spouses | Up to **£5m** combined free | ANNOUNCED | £2.5m each; spousal/CP exemption still applies on first death |
| Dividend tax | **10.75% basic / 35.75% higher / 39.35% additional** | ENACTED | **UPDATE: basic & higher each +2pp from 6 Apr 2026** (was 8.75%/33.75%). Additional unchanged |
| Dividend allowance | **£500** | ENACTED | 0% band but still consumes basic-rate band |
| S455 directors'-loan charge | **35.75%** on loans advanced on/after 6 Apr 2026 | ENACTED | Was 33.75%; pre-6-Apr-2026 loans stay 33.75%. Reclaimable on repayment (form L2P) |
| Chattels £6,000 rule | Gain exempt if proceeds ≤£6,000; marginal relief 5/3 × (proceeds − £6,000) | ENACTED | Applies to non-wasting chattels (art, antiques, jewellery, wine cellared long-term) |
| Wasting-asset exemption | CGT-exempt if predicted life ≤50yrs | ENACTED | **Classic/vintage cars always exempt** (cars are wasting assets). Most machinery, boats, clocks/watches |
| Crypto | CGT asset, 18/24%; income tax if mining/staking/airdrop as income | ENACTED | HMRC treats as property for CGT; pooling (s104) cost basis; same-day & 30-day matching rules |
| Equity release / lifetime mortgage | Cash released is **NOT taxable income** | ENACTED | Min age 55; rolled-up compound interest; reduces estate → reduces IHT; downsizing-protection clause lets repay w/o ERC |
| Optimal director salary | £5,000 (NIC secondary threshold) or £12,570 (PA) | ESTIMATED | £6,708 LEL = min for State Pension qualifying year |

Sources listed in §6.

---

## §1 — PER-TYPE DECISION TABLE

DRAW-CLASSIFICATION enum used below:
- **NOT-INCOME** — not a drawdown pot at all (main residence)
- **DOWNSIZE-LEVER** / **EQUITY-RELEASE-OPTION** — capital extractable only via housing transaction, not a yield stream
- **INCOME-PRODUCING-KEEP** — held for the yield; selling kills the income (rental, royalties, REIT dividend)
- **SELL-FOR-CAPITAL-WITH-CGT** — disposable for lump capital but triggers a CGT event
- **RELIEF-PROTECTED-DONT-SELL-EARLY** — selling forfeits an IHT relief (BPR business); hold to death is tax-optimal
- **ILLIQUID-LAST-RESORT** — no reliable market/price, long sale time, not sequence-able like a liquid pot

### PROPERTY (taxonomy: property — 14 types)

| Asset | How it produces income | Costs / frictions | Tax on income / disposal | Reliefs at stake | IHT / death | DRAW-CLASS |
|---|---|---|---|---|---|---|
| Main residence | None as held. Capital only via **downsizing** or **equity release** | SDLT on replacement purchase, estate-agent+legal ~2-3%, moving cost; ER rolled-up interest compounds | Sale **CGT-exempt under PRR**; ER cash not taxable | PRR (full) — lost if let / business-use / >0.5ha | In estate at full value; RNRB up to £175k if passed to direct descendants | **NOT-INCOME** (+ DOWNSIZE-LEVER / EQUITY-RELEASE-OPTION) |
| BTL / rental property | Net rent after costs | Voids, agent 8-12%, maintenance, Section-24 interest drag, ~5-6% to sell, illiquid (weeks-months) | Rent at marginal income tax (gross, 20% interest credit); sale CGT 18/24% residential | None special (FHL reliefs gone) | Full value in estate; no BPR (investment not trade) | **INCOME-PRODUCING-KEEP** vs **SELL-FOR-CAPITAL-WITH-CGT** (the core tension — see Q3) |
| Holiday let (ex-FHL) | Net letting income | As BTL + higher management/seasonality; voids worse | Income tax on profit; **CGT 18/24% — no BADR/rollover since Apr-2025** | FHL reliefs **all abolished** | Full value; no BPR unless genuine serviced-trade (rare) | **INCOME-PRODUCING-KEEP** / **SELL-FOR-CAPITAL-WITH-CGT** |
| Commercial property (direct) | Rent (often FRI lease, lower running cost) | Illiquid, large lot size, tenant-default/void risk, valuation drift | Rent at income tax; sale CGT 18/24% (non-residential) | Possible BADR if part of own trading premises sold with business | Full value; BPR only if used in own trading co | **INCOME-PRODUCING-KEEP** / **SELL-FOR-CAPITAL-WITH-CGT** |
| REITs (listed) | Dividends (PID taxed as property income, non-PID as normal dividend) | Liquid (sell same/next day), spread only | PID at marginal income-tax rate (20% withheld); capital gain CGT 18/24% | None | In estate at market value | **INCOME-PRODUCING-KEEP** (liquid — can also sequence like a fund) |
| Property funds (open-ended) | Distributions | Liquidity gates/suspension risk on bricks-and-mortar funds | Distribution + CGT on units | None | In estate | **INCOME-PRODUCING-KEEP** / sequence-able if liquid |

### BUSINESS (taxonomy: business — 16 types)

| Asset | How it produces income | Costs / frictions | Tax on income / disposal | Reliefs at stake | IHT / death | DRAW-CLASS |
|---|---|---|---|---|---|---|
| Sole trader | Trading profit drawn directly | Personal liability; profit = income whether drawn or not | Income tax + Class 4 NIC on profit; CGT 18/24% + BADR on sale of business | BADR (18%, £1m); BPR (100% to £2.5m) | Business assets get BPR if qualifying trade | **RELIEF-PROTECTED-DONT-SELL-EARLY** (BPR) / income while trading |
| Partnership share | Profit share | Illiquid interest, partnership-agreement exit terms | Income tax on profit share; CGT+BADR on disposal of interest | BADR; BPR on partnership interest | BPR if trading partnership | **RELIEF-PROTECTED-DONT-SELL-EARLY** |
| LTD company shares (owner-managed) | **Salary + dividends + pension contribution** mix | Double-tax friction (CT then dividend tax); illiquid private shares | Salary: income tax+NIC. Dividend: 10.75/35.75/39.35% after £500. Sale: CGT 18/24%, BADR 18% to £1m | BADR (≥5%, officer/employee, 2yr); BPR 100% to £2.5m on unquoted trading shares | Unquoted trading-co shares BPR-qualifying | **RELIEF-PROTECTED-DONT-SELL-EARLY** + owner-director income mix (see Q5) |
| BPR-qualifying business assets | Held within the trade | Must remain a qualifying trade (>50% trading, not investment) | — | **BPR 100% to £2.5m, 50% above** | The whole point: held to death = IHT relief | **RELIEF-PROTECTED-DONT-SELL-EARLY** (see Q2) |
| EMI / unapproved share options | Exercise → shares → sell | Vesting conditions, exercise cost, exit liquidity | EMI: CGT on exercise-to-sale gain, BADR can apply (2yr from grant); unapproved: income tax+NIC at exercise | BADR (EMI relaxed 2yr-from-grant rule) | Options/shares in estate at value | **SELL-FOR-CAPITAL-WITH-CGT** (event-driven, not a yield) |
| Directors' loan account (credit) | Repayable to director tax-free | If overdrawn → S455 35.75% charge to company | Repayment of credit balance = not taxable; overdrawn = S455 + benefit-in-kind | — | Credit balance is an estate asset (loan owed to director) | **SELL-FOR-CAPITAL** (extract credit balance first — cheapest cash) |

### ALTERNATIVES (taxonomy: alternatives — 11 types)

| Asset | How it produces income | Costs / frictions | Tax on income / disposal | Reliefs at stake | IHT / death | DRAW-CLASS |
|---|---|---|---|---|---|---|
| Crypto | None (no yield unless staking) | Volatile, exchange/withdrawal fees, lost-key risk; liquid for majors | CGT 18/24% (s104 pooling); staking/mining as income | None | In estate at market value | **SELL-FOR-CAPITAL-WITH-CGT** (liquid majors sequence-able; alts illiquid) |
| Collectibles / art / wine / classic cars | None | High spread (auction 15-25% buyer+seller premium), authentication, storage/insurance; slow sale | **Classic cars CGT-EXEMPT (wasting asset)**; art/antiques/jewellery = non-wasting chattel, £6k rule + marginal relief; long-cellared wine may be wasting | Chattels £6k exemption | In estate at market value | **ILLIQUID-LAST-RESORT** (cars also tax-free to sell — flag as efficient capital) |
| Gold / commodities | None (some yield on commodity funds) | Storage/spread; **physical gold sovereigns/Britannias are legal tender → CGT-exempt** | Bullion bars CGT 18/24%; UK legal-tender gold coins CGT-exempt | CGT exemption on UK gold coins | In estate | **SELL-FOR-CAPITAL** (coins efficient); bars CGT-bearing |
| P2P lending | Interest income | Default/platform risk, capital locked to term | Interest at marginal income tax (PSA may cover); losses relievable in narrow cases | None | In estate at outstanding-principal value | **INCOME-PRODUCING-KEEP** (term-locked, not instantly liquid) |
| Forestry / woodland | Timber sales; some let/sporting income | Very long cycle, specialist market, slow sale | **Commercial woodland: timber income & growth CGT-exempt**; land element CGT | Commercial woodland 100% BPR after 2yr; timber exemptions | Commercial woodland BPR-qualifying | **ILLIQUID-LAST-RESORT** + **RELIEF-PROTECTED** (BPR) |
| Farmland | Rent / farming profit | Illiquid, AHA/FBT tenancy terms | Income tax on rent/profit; CGT on sale | **APR** (now capped with BPR at £2.5m 100%) | APR-qualifying agricultural value | **ILLIQUID-LAST-RESORT** + **RELIEF-PROTECTED** (APR) |
| IP / royalties | Royalty stream (book, patent, music, licensing) | Income decays; valuation hard; assignment illiquid | Royalties at marginal income tax; assignment = CGT (or income if trade) | Possible BADR if part of a trade sold | Royalty right in estate at capitalised value | **INCOME-PRODUCING-KEEP** (a genuine non-portfolio income source the engine ignores today) |

---

## §2 — FIVE KEY ANSWERS

**Q1 — Why main residence is NOT a drawdown pot but IS a downsizing/equity-release lever.**
A home produces zero income while you live in it — it cannot be "drawn from" like an ISA. Capital is locked behind a housing transaction. Two levers unlock it: (a) **downsizing** — sell, buy cheaper, bank the difference (PRR makes the sale CGT-free; cost is SDLT on the replacement + ~2-3% transaction + emotional/illiquidity friction); (b) **equity release / lifetime mortgage** — borrow against it from age 55, cash is not taxable income, no repayment until death/care, but rolled-up compound interest can double the debt in ~12 years at 6% and erodes the estate. The engine must model the home as a NOT-INCOME asset with two optional capital-unlock events, never as a yielding pot. Both levers reduce the estate and therefore reduce IHT.

**Q2 — Why a BPR-qualifying business should usually NOT be sold early.**
BPR gives 100% IHT relief (now on the first £2.5m combined APR+BPR per person, ANNOUNCED 23 Dec 2025, up from the £1m originally legislated; 50% above). Hold the qualifying trading business to death and that value passes IHT-free up to the cap. **Sell it while alive and you convert a 0%-IHT asset into cash that is fully in the estate at 40%** — and you pay CGT on the sale (BADR 18% to £1m, then 18/24%). So an early sale can incur both CGT now AND 40% IHT later on the proceeds, versus near-zero tax on a hold-to-death. The relief is forfeited the moment the business stops being a qualifying trade (>50% trading test) or is sold. Decumulation logic: draw income FROM the business (salary/dividend) but do not liquidate the BPR-qualifying capital early unless the cap is exceeded.

**Q3 — Rental property: income-producing (keep) vs sell-for-capital (the tension).**
Keep: net rent is a real income stream, but Section 24 caps mortgage-interest relief at a 20% credit (individuals taxed on gross rent), so a leveraged higher-rate landlord can face effective rates >50%, plus voids, agent fees and maintenance erode yield. Sell: realises capital but triggers a residential CGT event at 18/24% with only a £3,000 AEA, 60-day report-and-pay, and ~5-6% transaction cost — and permanently ends the income. The engine must weigh net-of-Section-24 yield against the CGT-and-friction hit of disposal, and flag that the decision is irreversible. There is no BPR shelter (investment, not a trade), so the property sits at full value in the estate either way — a reason some hold for step-up-free transfer rather than sell.

**Q4 — Why illiquid alternatives (art, forestry, farmland, classic cars) are last-resort, not sequence-able.**
Liquid pots (cash, funds, listed equities, REITs, major crypto) have a daily price and settle in days — you can draw a precise £X on a schedule. Illiquid alternatives have no reliable price, wide bid-ask (auction premiums 15-25%), and sale times of months to years; you cannot "draw £2,000 of forestry this month." They are lumpy, all-or-nothing disposals with valuation uncertainty. So the engine must classify them ILLIQUID-LAST-RESORT: available for a one-off capital raise late in sequence, never as a metered income source. Nuance the engine should surface: some are tax-efficient to sell (classic cars and UK gold coins are CGT-exempt; commercial woodland timber is CGT-exempt and BPR-qualifying) — efficient capital but still illiquid.

**Q5 — Owner-director: salary / dividend / pension-contribution interplay in winding down.**
Three extraction routes with different tax: (1) **Salary** — deductible for the company, but income tax + NIC; optimal ~£5,000 (employer-NIC secondary threshold) or up to £12,570 PA, and £6,708 LEL secures a State Pension qualifying year. (2) **Dividends** — paid from post-CT profit (double tax), now 10.75/35.75/39.35% after a £500 allowance (basic & higher each rose 2pp on 6 Apr 2026). (3) **Employer pension contribution** — corporation-tax-deductible, no NIC, grows tax-free, and (post-2027 SIPP-IHT change) timing matters for estate. Winding down, the sequence is typically: clear any **directors'-loan credit balance first** (tax-free cash), take low salary + dividends to fill basic-rate band, divert surplus to employer pension, and **preserve the BPR-qualifying shares to death rather than liquidate** (Q2). Watch S455 (35.75% on new overdrawn loans from Apr-2026) if cash is extracted as a loan rather than dividend/salary.

---

## §3 — PROPOSED ENGINE DATA FIELDS

Fields the engine must capture so these assets become modellable income/capital sources (currently the £2,250k property gap).

**Shared (all three categories):**
`assetType` (from taxonomy), `currentValue`, `acquisitionValue`, `acquisitionDate`, `ownershipYears`, `drawClassification` (enum above), `liquidityDays` (est. time-to-cash), `disposalCostPct`.

**Property:**
`isMainResidence` (bool), `prrEligible` + `prrApportionmentPct`, `rentalGrossAnnual`, `rentalNetAnnual`, `mortgageOutstanding`, `mortgageInterestAnnual`, `section24Applies` (bool, false if held in LTD), `voidAssumptionPct`, `managementCostPct`, `isFHLLegacy` (bool — flags lost reliefs), `equityReleaseEligible` (age≥55 + main residence), `downsizeTargetValue`.

**Business:**
`legalForm` (sole/partnership/ltd), `isTradingBusiness` (>50% trading test), `bprQualifying` (bool), `bprQualifyingValue`, `badrEligible` (2yr + ≥5% + officer/employee), `badrLifetimeUsed` (track against £1m), `directorSalary`, `dividendsTaken`, `pensionEmployerContribution`, `directorsLoanBalance` (signed — credit vs overdrawn), `shareholdingPct`.

**Alternatives:**
`isWastingAsset` (bool — classic car etc., CGT-exempt), `isChattel` (bool — £6k rule), `isCgtExemptCoin` (UK legal-tender gold), `royaltyAnnualIncome`, `royaltyDecayRate`, `isCommercialWoodland` (CGT-exempt timber + BPR), `isAgricultural` (APR), `cryptoPoolCostBasis` (s104), `interestAnnual` (P2P), `termLockEndDate`.

**Cross-cutting IHT/CGT:**
`estateInclusionValue`, `cgtUnrealisedGain` (= currentValue − acquisitionValue), `cgtRateBand` (18 vs 24 by stacking), `reliefAtRisk` (PRR / BPR / APR / BADR — what a sale forfeits).

---

## §4 — ENGINE BEHAVIOUR NOTES

- **Never** model main residence as a yielding pot. Model it as NOT-INCOME with two event hooks: `downsize()` and `equityRelease()`.
- **Sequence ordering** for capital raises should respect liquidity AND relief protection: liquid+CGT-cheap first (directors'-loan credit, gold coins, classic cars), then liquid+CGT-bearing (crypto majors, REITs), then illiquid (BTL, commercial), and BPR/APR-protected business held to LAST (or never) because early sale forfeits IHT relief.
- **Income sources the engine currently ignores but should add:** net rental (Section-24-adjusted), royalties (with decay), P2P interest, REIT/property-fund distributions, owner-director salary+dividend stream.
- **Flag irreversibility** on any SELL-FOR-CAPITAL of an income-producing asset (rental, royalty) — the income does not come back.
- **Relief-loss warnings** are the highest-value methodology surface (per memory: surface logic to user): "Selling this business now forfeits £X of BPR — holding to death saves ~£Y IHT."

---

## §5 — STATUS / CONFIDENCE

- **High confidence (statute / Royal Assent):** CGT rates+AEA, PRR, FHL abolition, Section 24, BADR 18%/£1m, dividend rates+allowance, S455 35.75%, chattels/wasting-asset rules, crypto CGT treatment, equity-release tax treatment.
- **ANNOUNCED but watch for Finance-Act drafting:** BPR/APR £2.5m cap (raised from £1m on 23 Dec 2025) and £5m spousal combined — confirm final legislation before hard-coding; the originally-legislated figure was £1m, so any stale source citing £1m is pre-23-Dec-2025.
- **Unverifiable / needs human check:** the precise interaction of the £2.5m APR+BPR cap with **trusts and successive transfers** (anti-fragmentation rules still being finalised) was not cleanly resolvable from public sources as of 2026-06-03 — flag for a Chartered tax adviser before the engine applies the cap across multiple gifts/trusts.

---

## §6 — SOURCES (with status)

CGT residential 18/24% + £3k AEA + PRR — ENACTED:
- https://www.gov.uk/capital-gains-tax/rates
- https://www.propertytaxpartners.co.uk/blog/capital-gains-tax/cgt-rates-property-2026-27-current-rates-explained
- https://www.ii.co.uk/learn/tax/capital-gains-tax/allowance-rates

BPR/APR £2.5m cap (raised from £1m, announced 23 Dec 2025) — ANNOUNCED:
- https://www.rossmartin.co.uk/sme-tax-news/8773-apr-and-bpr-threshold-to-increase-from-gbp1-million-to-gbp2-5-million
- https://www.att.org.uk/technical/news/government-announces-changes-new-aprbpr-restrictions-6-april-2026
- https://commonslibrary.parliament.uk/research-briefings/cbp-10181/
- https://www.cooperparry.com/business-property-relief-2026/

BADR 18% / £1m lifetime — ENACTED:
- https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg64174
- https://brodies.com/insights/wills-and-estate-planning/business-asset-disposal-relief-badr-what-is-changing-on-6-april-2026/
- https://www.bytestart.co.uk/self-employed-tax/business-asset-disposal-relief-small-business/

FHL abolition (6 Apr 2025) — ENACTED:
- https://www.accaglobal.com/gb/en/technical-activities/technical-resources-search/2024/October/Furnished-holiday-lettings-tax-regime-abolished-1-April-2025.html
- https://www.saffery.com/insights/articles/furnished-holiday-lettings-tax-regime/

Section 24 mortgage-interest restriction — ENACTED:
- https://thetaxlead.co.uk/blog/property-tax/section-24-mortgage-interest-restriction-landlords.html
- https://www.propertypassport.uk/guides/section-24-mortgage-interest-restriction-landlords

Dividend rates 10.75/35.75/39.35% + £500 allowance + director salary — ENACTED:
- https://www.1stformations.co.uk/blog/tax-efficient-directors-salary-and-dividends/
- https://www.thp.co.uk/salary-vs-dividends-2026/
- https://sleek.com/uk/resources/tax-on-dividends-uk/

S455 35.75% (from 6 Apr 2026) — ENACTED:
- https://www.walterdawson.co.uk/s455-tax-on-overdrawn-directors-loan-accounts/
- https://puremagazine.co.uk/s455-tax/

Chattels £6k + wasting assets (classic cars exempt) — ENACTED:
- https://gofile.co.uk/knowledgebase/capital-gains-tax/cgt-chattels/
- https://www.saffery.com/insights/articles/do-i-have-to-pay-tax-when-selling-or-gifting-personal-possessions/
- https://www.thp.co.uk/cgt-exempt-assets-in-the-uk-gold-coins-and-more/

Crypto CGT — ENACTED:
- https://www.blockpit.io/tax-guides/crypto-tax-united-kingdom-hmrc

Equity release / lifetime mortgage tax + downsizing — ENACTED:
- https://www.ageuk.org.uk/information-advice/money-legal/income-tax/equity-release/
- https://www.keyadvice.co.uk/equity-release/equity-release-tax-guide
- https://www.aviva.co.uk/retirement/equity-release/knowledge-centre/releasing-equity-to-buy-property/
