# Ask Sonu — Coverage Scenario Library

**Version:** 1.0 (2026-05-22)
**Purpose:** Comprehensive test set of realistic UK IFA questions to exercise the Ask Sonu engine. Every query is something a real client would ask in plain English. Run all through `tests/run-ask-sonu-coverage.mjs`; results land in `tests/reports/COVERAGE-{date}.md`.

**Scoring:**
- ✅ PASS — lead + action steps coherent, state-aware, citation real
- ⚠ WEAK — answer plausible but missing nuance or wrong angle
- ❌ FAIL — wrong lead, hallucinated content, or off-ontology when it shouldn't be
- 🚫 EXPECTED_OFF — query genuinely outside our coverage (crypto, options, etc.)

**State-aware flag:** does the answer depend on the user's in-flight tax-year state (ISA used, AA used, MPAA, etc.)?

---

## Domain 1 — Retirement / Drawdown (10)

| ID | Query | Expected lead theme | State-aware |
|---|---|---|---|
| RET-01 | "I want to retire at 60 — can I afford to?" | Cashflow + bridge before SP + phased drawdown | yes |
| RET-02 | "What's the most tax-efficient way to draw £70k a year?" | Phase TFC + split with spouse + ISA recycling | yes |
| RET-03 | "Should I take my 25% tax-free cash now or phase it?" | Phase TFC over 4 years | yes |
| RET-04 | "I'm 67 and still working — should I take State Pension or defer?" | Defer for 5.8% uplift if average longevity | no |
| RET-05 | "I have £1M in SIPP — how much can I sustainably withdraw?" | 4% rule baseline, sequence risk, adjust for SP | yes |
| RET-06 | "Should I buy an annuity or stay in drawdown?" | Hybrid: annuitise floor income, drawdown the rest | yes |
| RET-07 | "I'm worried about running out — how do I budget?" | Cashflow modelling + 70/30 floor-flex split | yes |
| RET-08 | "Can I retire 5 years earlier than planned?" | Bridge funding + sequence risk + lifestyle test | yes |
| RET-09 | "When can I access my SIPP?" | Age 55 (57 from 2028 unless transitional rule) | no |
| RET-10 | "I'm 75 next year — what should I do with my pension?" | Pre-75 death-tax cliff, FAD vs annuity, beneficiary nominations | no |

## Domain 2 — IHT / Legacy (10)

| ID | Query | Expected lead theme | State-aware |
|---|---|---|---|
| IHT-01 | "How can I reduce my IHT bill?" | NRB + RNRB structure + 7yr gifts + surplus income | yes |
| IHT-02 | "What's the 7-year rule on gifts?" | Taper relief 3-7yr; full IHT in <3yr; clean at 7+ | yes |
| IHT-03 | "Should I set up a trust?" | Discretionary trust pros/cons + DGT for income retention | no |
| IHT-04 | "Can I leave everything to my kids tax-free?" | NRB £325k + RNRB £175k (taper at £2M); rest at 40% | yes |
| IHT-05 | "What about my home — is it taxed on death?" | RNRB applies if direct descendants; taper at £2M estate | yes |
| IHT-06 | "Should I gift £100k to my children now?" | PET starts 7yr clock + annual exemption £3k + surplus-income | yes |
| IHT-07 | "What's an AIM portfolio for IHT?" | BPR after 2yr hold = 100% IHT-free; volatility risk | yes |
| IHT-08 | "How does charity reduce IHT?" | 10%+ to charity → rate drops 40% → 36% | yes |
| IHT-09 | "How do I plan around the April 2027 SIPP-IHT change?" | Pre-2027 SIPP outside estate; consider DC strategy | yes |
| IHT-10 | "Spouse died — what about IHT?" | Transferable NRB + RNRB (TNRB, TRNRB) | no |

## Domain 3 — Property: Buy / Sell / Move (10)

| ID | Query | Expected lead theme | State-aware |
|---|---|---|---|
| PROP-01 | "Should I downsize my home?" | Release equity + IHT (RNRB downsize protection) + lifestyle | yes |
| PROP-02 | "I want to buy a bigger house — should I?" | SDLT cost + affordability vs other priorities + mortgage rate | yes |
| PROP-03 | "Should I buy a buy-to-let property?" | S24 interest restriction + 3% SDLT surcharge + yield reality | yes |
| PROP-04 | "Is BTL still profitable after S24?" | Personal vs Ltd: corp tax + dividend tax + admin cost | yes |
| PROP-05 | "Should I incorporate my BTL portfolio?" | Incorporation relief + ongoing complexity + SDLT trigger | yes |
| PROP-06 | "What about furnished holiday lets after the abolition?" | FHL regime ended 2025/26; transitional planning | yes |
| PROP-07 | "First-time buyer SDLT relief — am I eligible?" | £425k FTB threshold (£625k partial); never owned before | no |
| PROP-08 | "Should I buy a second home?" | SDLT 3% surcharge + capital gains on disposal + IHT estate | yes |
| PROP-09 | "Should I sell my BTL — too much hassle?" | CGT on disposal (PPR if main home), 28% residential rate | yes |
| PROP-10 | "How does CGT work on selling my BTL?" | Residential rate 24% post-Oct-2024; annual exempt £3k | yes |

## Domain 4 — Mortgage (8)

| ID | Query | Expected lead theme | State-aware |
|---|---|---|---|
| MORT-01 | "Should I pay off my mortgage with my inheritance?" | Rate comparison + liquidity + IHT (debt reduces estate) | yes |
| MORT-02 | "Should I overpay my mortgage or invest?" | After-tax mortgage rate vs expected ISA return + risk preference | yes |
| MORT-03 | "My fixed rate is ending — fixed or tracker?" | Yield curve + personal risk tolerance + time to next move | no |
| MORT-04 | "Offset mortgage — is it worth it?" | Tax-equivalent yield on cash + flexibility + complexity | yes |
| MORT-05 | "How much can I borrow with £80k income?" | LTI 4.5x typical + affordability stress test | no |
| MORT-06 | "Equity release — should I consider it?" | Last-resort + compound interest + RIO alternative | no |
| MORT-07 | "Should I remortgage to release equity for BTL?" | LTV cost + BTL deductibility (Ltd) + interest coverage | yes |
| MORT-08 | "Interest-only vs repayment?" | Capital risk + lender requirements + repayment vehicle | no |

## Domain 5 — Inheritance received (8)

| ID | Query | Expected lead theme | State-aware |
|---|---|---|---|
| INH-01 | "I inherited £200k — what should I do?" | Inventory: emergency fund + debt + ISA fill + pension + invest | yes |
| INH-02 | "Should I pay off my mortgage with inheritance?" | See MORT-01 analysis + don't lock all liquidity | yes |
| INH-03 | "Should I invest my inheritance?" | Wrapper sequencing + risk profile + time horizon | yes |
| INH-04 | "Should I gift my inheritance on to my children?" | Generation skip + 7yr clock + your own needs first | yes |
| INH-05 | "Can I refuse an inheritance to skip generations?" | Deed of variation within 2yr of death | no |
| INH-06 | "I inherited a property — sell or rent?" | CGT base = probate value + lettings yield + own needs | yes |
| INH-07 | "Inheritance after IHT — how do I deploy it?" | Same as INH-01 but post-tax | yes |
| INH-08 | "Should I put my inheritance in a trust?" | Trust types + tax cost + control trade-off | no |

## Domain 6 — Tax planning (10)

| ID | Query | Expected lead theme | State-aware |
|---|---|---|---|
| TAX-01 | "I'm earning £110k — what's the £100k taper trap?" | PA taper £1 per £2 over £100k = 60% marginal | yes |
| TAX-02 | "Should I salary sacrifice into pension?" | NI saving + employer top-up + AA headroom | yes |
| TAX-03 | "Carry-forward annual allowance — can I use it?" | Last 3yr unused AA + current-year first + check tapering | yes |
| TAX-04 | "Should I use the Marriage Allowance?" | Transfer £1,260 of PA if lower earner < £12,570 | yes |
| TAX-05 | "Bed and ISA — how does it work?" | Sell GIA → ISA, use CGT AEA + £20k subscription | yes |
| TAX-06 | "Should I crystallise capital gains?" | CGT AEA £3k + future rate risk + portfolio rebalancing | yes |
| TAX-07 | "How do I use my CGT annual exempt amount?" | Realise £3k gains/yr; bed-and-ISA or bed-and-spouse | yes |
| TAX-08 | "EIS / VCT — are they worth it?" | 30% income tax relief, CGT defer (EIS), illiquidity | yes |
| TAX-09 | "Dividend vs salary if I run my own company?" | Sub-£50k mostly dividend; above mix with pension contrib | yes |
| TAX-10 | "Should I make a pension contribution before tax year end?" | Use AA + carry-forward; deadline 5 April | yes |

## Domain 7 — Family change (8)

| ID | Query | Expected lead theme | State-aware |
|---|---|---|---|
| FAM-01 | "I'm getting married — what should we plan?" | Will update (or "in contemplation of"); ISA/pension nominations; allowance pooling | no |
| FAM-02 | "I'm getting divorced — what matters financially?" | Pension Sharing Orders + PODE report; CGT no-gain transfer | no |
| FAM-03 | "We're cohabiting — what protections do we need?" | Cohab IHT trap, declaration of trust, life cover in trust | no |
| FAM-04 | "Should I get a prenup?" | Post-Radmacher persuasive but not binding; protects pre-marital wealth | no |
| FAM-05 | "Having a baby — what should we do?" | Life cover + IP + Junior ISA + will update | no |
| FAM-06 | "Pension sharing in divorce — explain" | CETV-based pension share order; PODE strongly recommended | no |
| FAM-07 | "Will I lose my pension in divorce?" | Treated as matrimonial asset (esp. long marriages); sharing/offsetting | no |
| FAM-08 | "What happens to our joint mortgage in divorce?" | Transfer of equity + lender consent + affordability check | no |

## Domain 8 — Business exit (8)

| ID | Query | Expected lead theme | State-aware |
|---|---|---|---|
| BUS-01 | "I want to sell my business — best structure?" | Asset vs share sale + BADR + earn-out tax treatment | yes |
| BUS-02 | "BADR / Business Asset Disposal Relief — am I eligible?" | 10% rate on £1M lifetime limit; 2yr qualifying period | yes |
| BUS-03 | "Should I exit gradually or all at once?" | BADR limit + Investors' Relief + sequence of disposals | yes |
| BUS-04 | "Earn-out vs lump sum — tax difference?" | CGT timing + structure as deferred consideration | yes |
| BUS-05 | "Should I sell to my employees (EOT)?" | 0% CGT if EOT meets criteria; complex setup | yes |
| BUS-06 | "I'm winding down my company — most tax-efficient way?" | MVL + BADR if eligible; Distribution vs capital treatment | yes |
| BUS-07 | "Should I extract dividends or sell shares?" | BADR cliff; dividend tax bands vs capital gain | yes |
| BUS-08 | "Investors' Relief — am I eligible?" | 14% rate on £10M lifetime; 3yr hold; unlisted only | no |

## Domain 9 — Cross-border (8)

| ID | Query | Expected lead theme | State-aware |
|---|---|---|---|
| XB-01 | "I want to relocate abroad — what should I think about?" | SRT discipline + IHT 10yr tail + healthcare + schools | yes |
| XB-02 | "I'm new to the UK — what's the FIG regime?" | 4yr foreign income/gains exemption + sequence realisations | yes |
| XB-03 | "I'm returning to the UK after 10 years away" | SRT split-year + bring assets onshore pre-arrival | yes |
| XB-04 | "Should I move to Portugal under NHR?" | NHR ended 2024; IFICI replacement narrower | yes |
| XB-05 | "Should I move to Dubai/UAE?" | 0% income tax + visa/cost; UK IHT tail 10yr | yes |
| XB-06 | "I have property in India — UK tax implications?" | India-UK DTA + RNOR + foreign income disclosure | yes |
| XB-07 | "How does the Statutory Residence Test work?" | Automatic tests + ties test + day counting | yes |
| XB-08 | "Will my UK pension still be paid abroad?" | Yes; DTA determines taxation; QROPS only if appropriate | no |

## Domain 10 — Protection (6)

| ID | Query | Expected lead theme | State-aware |
|---|---|---|---|
| PROT-01 | "Do I need life insurance?" | Dependents + mortgage + estate IHT-debt cover | no |
| PROT-02 | "Critical illness vs income protection?" | IP = ongoing income, CI = lump sum on diagnosis | no |
| PROT-03 | "Should I write my life policy in trust?" | Yes if any IHT exposure; speed of payout | no |
| PROT-04 | "I'm self-employed — IP cover?" | Higher need; no SSP; long deferred period for cost | no |
| PROT-05 | "Key-person insurance for my business?" | Covers loss of key revenue-generator; tax treatment | no |
| PROT-06 | "Whole-of-life vs term?" | Term for needs ending; WoL for IHT cover written in trust | no |

## Domain 11 — Healthcare / later life (6)

| ID | Query | Expected lead theme | State-aware |
|---|---|---|---|
| HC-01 | "Will I have to sell my home for care fees?" | LA means-test £23,250 + cap of £86k from 2025 | no |
| HC-02 | "Equity release — should I?" | Last resort + compound interest + RIO alternative | no |
| HC-03 | "Long-term care planning — where do I start?" | Funding source + LPA + insurance options | no |
| HC-04 | "Do I need an LPA?" | Yes — both Property & Financial AND Health & Welfare | no |
| HC-05 | "What if I lose capacity without an LPA?" | Court of Protection deputyship £4k+ and 6-12 months | no |
| HC-06 | "Dementia in family — financial protection?" | LPA + assets in joint names + carer support assessment | no |

## Domain 12 — Investment portfolio (8)

| ID | Query | Expected lead theme | State-aware |
|---|---|---|---|
| INV-01 | "How should I allocate my £500k portfolio?" | Age-based equity allocation + diversification + cost | no |
| INV-02 | "TER on my portfolio — am I paying too much?" | Benchmark 0.3-0.5% target; high-cost = drag | no |
| INV-03 | "Should I move to passive funds?" | Cost saving + likely outperform active over time | no |
| INV-04 | "Concentration in one stock — what to do?" | CGT-managed reduction + diversification urgency | yes |
| INV-05 | "How much cash should I hold?" | 3-6 months expenses + tactical opportunity reserve | no |
| INV-06 | "Should I rebalance my portfolio?" | Annual or threshold-based (5% drift) | yes |
| INV-07 | "Emerging markets — worth the risk?" | Diversification benefit + volatility + 5-10% allocation | no |
| INV-08 | "Should I switch to ESG funds?" | Cost + tracking error + values alignment | no |

## Domain 13 — Cash / liquidity (8)

| ID | Query | Expected lead theme | State-aware |
|---|---|---|---|
| CASH-01 | "I have fixed deposits maturing — what to do?" | ASK: purpose → then ISA / gilts / emergency / GIA | yes |
| CASH-02 | "How much cash should I keep liquid?" | 3-6 months expenses + sinking funds | no |
| CASH-03 | "Money market funds vs cash ISA?" | Yield + tax wrapper + withdrawal access | yes |
| CASH-04 | "Should I buy gilts directly?" | Coupon taxable + capital gain CGT-free + DMO buying | yes |
| CASH-05 | "PSA — Personal Savings Allowance explained" | £1k basic / £500 higher / £0 additional; interest only | yes |
| CASH-06 | "My ISA is full this year — what next?" | April plan + spouse ISA + pension contrib + GIA | yes |
| CASH-07 | "Should I bed-and-SIPP my cash?" | Only if you need pension top-up AND AA available | yes |
| CASH-08 | "Cash savings rates have dropped — what now?" | Wrapper migration + gilt ladder + don't panic-equity | yes |

## Domain 14 — Education / kids (4)

| ID | Query | Expected lead theme | State-aware |
|---|---|---|---|
| EDU-01 | "School fees planning — how to fund?" | Grandparent gifting + dedicated ISA + bare trust | yes |
| EDU-02 | "Junior ISA — should I open one?" | Yes; £9k/yr; locked until 18 | no |
| EDU-03 | "Saving for kids' university?" | JISA + bare trust + parental savings strategy | yes |
| EDU-04 | "Should I gift to kids early for compounding?" | Bare trust under 18; outright at 18; 7yr IHT clock | yes |

## Domain 15 — Time / lifestyle / FIRE (4)

| ID | Query | Expected lead theme | State-aware |
|---|---|---|---|
| LIFE-01 | "Should I take a sabbatical?" | Income gap + AA preservation + emergency fund | yes |
| LIFE-02 | "FIRE — how do I plan?" | 4% rule + sequence risk + wrapper sequencing | yes |
| LIFE-03 | "Can I afford to go part-time?" | Cashflow + pension impact + healthcare benefit changes | yes |
| LIFE-04 | "I want to retire 5 years earlier — is it possible?" | Same as RET-08 + Wealth Score impact + bridge funding | yes |

## Off-scope sanity checks (6)

These SHOULD route to "outside my coverage" rather than guessing.

| ID | Query | Expected behaviour |
|---|---|---|
| OFF-01 | "Should I buy crypto?" | OFF-SCOPE → refuse cleanly |
| OFF-02 | "Should I trade options?" | OFF-SCOPE → refuse cleanly |
| OFF-03 | "What's the best forex broker?" | OFF-SCOPE → refuse cleanly |
| OFF-04 | "Day trading strategy?" | OFF-SCOPE → refuse cleanly |
| OFF-05 | "How do I get rich quick?" | OFF-SCOPE → refuse cleanly |
| OFF-06 | "Should I leverage with margin to buy stocks?" | OFF-SCOPE → refuse cleanly |

---

## Totals

| Domain | Count |
|---|---|
| Retirement / Drawdown | 10 |
| IHT / Legacy | 10 |
| Property | 10 |
| Mortgage | 8 |
| Inheritance received | 8 |
| Tax planning | 10 |
| Family change | 8 |
| Business exit | 8 |
| Cross-border | 8 |
| Protection | 6 |
| Healthcare / later life | 6 |
| Investment portfolio | 8 |
| Cash / liquidity | 8 |
| Education / kids | 4 |
| Time / lifestyle / FIRE | 4 |
| Off-scope sanity | 6 |
| **TOTAL** | **122** |

122 scenarios — exceeds the 100 target. Most are state-aware (the answer would change materially if tax-year allowances/usage differ).
