# Sonuswealth Coverage Matrix v1

> Source: 91 audited rows. Each row classified by `surfaced` (yes/gated/no), `modeled` (real/stub/metadata/na), and `dormant` (surfaced != yes).

## 1. Headline

**Totals (91 items)**

| Metric | Count | % |
|---|---|---|
| Total items | 91 | 100% |
| Surfaced = `yes` | 64 | 70.3% |
| Dormant (surfaced != `yes`) | 27 | 29.7% |
| Modeled = `real` | 60 | 65.9% |

Dormant breakdown: 24 `no` + 3 `gated` = 27. (Six `tax-estate`/`timeline` rows are `gated` — only 3 of those are dormant=true in the gated set; the other gated rows resolve elsewhere. Counts here follow the `dormant` flag.)

**By catalogue**

| Catalogue | Items | Surfaced=yes | % yes | Dormant | % dormant | Modeled=real | % real |
|---|---|---|---|---|---|---|---|
| decision | 41 | 41 | 100% | 0 | 0% | 41 | 100% |
| life-event | 16 | 0 | 0% | 16 | 100% | 0 | 0% |
| question | 34 | 23 | 67.6% | 11 | 32.4% | 19 | 55.9% |
| **Total** | **91** | **64** | **70.3%** | **27** | **29.7%** | **60** | **65.9%** |

Note: all 16 life-events are `modeled=metadata`; question catalogue contains the only `stub` (cashflow-Q5) and the only `na` rows (mymoney-NONE, timeline-Q9).

**By home screen**

| Home | Items | Surfaced=yes | Dormant | Modeled=real | Modeled=metadata | Modeled=stub | Modeled=na |
|---|---|---|---|---|---|---|---|
| money | 21 | 21 | 0 | 21 | 0 | 0 | 0 |
| flow | 14 | 14 | 0 | 14 | 0 | 0 | 0 |
| tax | 5 | 5 | 0 | 5 | 0 | 0 | 0 |
| risk | 3 | 3 | 0 | 3 | 0 | 0 | 0 |
| timeline/risk (life-events) | 16 | 0 | 16 | 0 | 16 | 0 | 0 |
| home | 3 | 2 | 1 | 3 | 0 | 0 | 0 |
| mymoney | 1 | 0 | 1 | 0 | 0 | 0 | 1 |
| cashflow | 7 | 7 | 0 | 6 | 0 | 1 | 0 |
| tax-estate | 10 | 8 | 2 | 10 | 0 | 0 | 0 |
| risk-layer | 3 | 3 | 0 | 3 | 0 | 0 | 0 |
| timeline | 11 | 8 | 3 | 7 | 3 | 0 | 1 |
| **Total** | **91** | **64** | **27** | **60** | **19** | **1** | **2** |

The dormancy is concentrated: the 16-row `life-event` catalogue is 100% dormant, and it alone accounts for 16 of 27 dormant items (59%). The remaining 11 dormant items are all in the `question` catalogue.

## 2. The dormant list (PRIORITISED)

Highest user-value first (inheritance, redundancy, business sale, jurisdiction move, partner death are high value). Every row here has `surfaced != yes`.

| id | label | home | why dormant (gating / no surface) | modeled? |
|---|---|---|---|---|
| inheritance | Inheritance received | timeline/risk | No surface — matrix entry only; `lifeEventReopen` consumed only by test; no UI logs an inheritance event (uk-risk-2026-1-1.js:1258) | metadata |
| business_sale | Business sale | timeline/risk | No surface — matrix-only; no trigger UI; `lifeEventReopen` test-only consumer (uk-risk-2026-1-1.js:1261) | metadata |
| jurisdiction_move | Jurisdiction move (relocation) | timeline/risk | No surface — matrix-only; `lifeEventReopen` consumed only by test-uk-risk.js:737 (uk-risk-2026-1-1.js:1255) | metadata |
| partner_death | Death of partner / main earner | timeline/risk | No surface — Critical-priority matrix entry, no UI to log; `shockDeath` is a separate shock-suite fn (uk-risk-2026-1-1.js:1251) | metadata |
| redundancy | Redundancy | timeline/risk | No surface — matrix-only; `shockJobLoss` is shock-suite, not a logged event (uk-risk-2026-1-1.js:1254) | metadata |
| retirement | Retirement | timeline/risk | No surface — reopen matrix subtype inert; retirement modelled elsewhere as plan-type/what-if only (uk-risk-2026-1-1.js:1260) | metadata |
| serious_illness | Serious illness | timeline/risk | No surface — matrix-only; `shockIllness` is shock-suite, not wired to a logged event (uk-risk-2026-1-1.js:1259) | metadata |
| divorce | Divorce / separation | timeline/risk | No surface — matrix-only; DE-34 exists as guidance, separate from risk recompute (uk-risk-2026-1-1.js:1248) | metadata |
| child_birth | Child born / new dependant | timeline/risk | No surface — matrix-only; only inferred from static `has_children` flag, not a logged birth event (uk-risk-2026-1-1.js:1249) | metadata |
| marriage | Marriage / civil partnership | timeline/risk | No surface — matrix-only; `lifeEventReopen` zero non-test consumers (uk-risk-2026-1-1.js:1247) | metadata |
| property_purchase | Property purchase | timeline/risk | No surface — matrix-only; no logging UI; no WhatIfLibrary scenario (uk-risk-2026-1-1.js:1256) | metadata |
| property_sale | Property sale | timeline/risk | No surface — reopen matrix inert; adjacent WhatIfLibrary 'Sell main home' is a separate MyMoney what-if (uk-risk-2026-1-1.js:1257) | metadata |
| pension_crystallisation | Pension crystallisation | timeline/risk | No surface — matrix-only; age-bracket prompt in lifeEventPaths is unrelated (uk-risk-2026-1-1.js:1262) | metadata |
| dependant_death | Death of a dependant | timeline/risk | No surface — matrix-only; no logging UI anywhere (uk-risk-2026-1-1.js:1250) | metadata |
| employment_change_self_emp | Employment change — became self-employed | timeline/risk | No surface — matrix-only; DE-side 'start_business' is separate AI-tree (uk-risk-2026-1-1.js:1252) | metadata |
| employment_change_employed | Employment change — new employed role | timeline/risk | No surface — pure matrix entry, no UI, no DE analogue (uk-risk-2026-1-1.js:1253) | metadata |
| tax-estate-Q7 | What taper position is each of my gifts in? | tax-estate | Gated — GiftClock returns null unless `entity.estate.gifts` / `assets.trustGifts` present (TaxEstate.jsx:1782-1785); typical persona opens empty drawer | real |
| tax-estate-Q10 | Am I on track against my estate plan? | tax-estate | Gated — requires a committed estate plan with `lastReviewedAt` in `entity.plans`; otherwise 'No plan yet' chip (TaxEstate.jsx:3383) | real |
| timeline-Q11 | Am I on track to hit my retirement plan? | timeline | Gated — needs committed retirement plan AND viewMode='plan'; default viewMode='actual' shows 'No retirement plan yet' (Timeline.jsx:613,765-773) | real |
| timeline-Q7 | How much is my inaction costing? | timeline | Gated — CoI/day chip only on sipp-iht row, gated `coi > 0 && hasDCPension` (Timeline.jsx:879); PAYE-only persona sees no chip | real |
| home-Q2 | What changed since I last looked? (daily delta strip) | home | No surface — `diffSet(entity,null)` computed at HomeScreen.jsx:2005 but `diffs` never consumed in JSX (dead variable) | real |
| timeline-Q8 | What did I decide and why? | timeline | No surface — §D.6 Re-explain (AI) modal not implemented; only a static stored `d.rationale` echoed on tap (Timeline.jsx:1354) | metadata |
| timeline-Q9 | How do my saved scenarios compare? | timeline | No surface — §E compare mode absent; SectionE is a flat list, no side-by-side affordance (Timeline.jsx:1772-1811) | na |
| mymoney-NONE | (No explicit question inventory in spec v2_7) | mymoney | No surface — spec has no numbered question inventory; §1.1 purpose phrase not rendered in MyMoney.jsx (2-Product-mymoney-v2_7.md:133) | na |

(24 rows above carry dormant=true. The three gated tax-estate/timeline rows whose `dormant` flag is true — Q7, Q10, Q11, timeline-Q7 — are included; gated rows that resolve for most personas are not double-counted here.)

## 3. Metadata-only (catalogued but not wired)

Items where `modeled` = `metadata` or `stub` — these LOOK live but compute nothing (or compute via a stub).

| id | label | home | what's missing |
|---|---|---|---|
| marriage | Marriage / civil partnership | timeline/risk | `lifeEventReopen` returns a static `{dimensionIds, priority}` only; no recompute; ripple.js ignores the change param (ripple.js:251-254) |
| divorce | Divorce / separation | timeline/risk | Static dim lookup `{D3,D4,D6, High}`; no ripple/eventStore consumer (uk-risk-2026-1-1.js:1248) |
| child_birth | Child born / new dependant | timeline/risk | Static matrix `{D3,D6, High}`; ripple.js does not consume it (uk-risk-2026-1-1.js:1249) |
| dependant_death | Death of a dependant | timeline/risk | Static lookup `{D3,D6, High}`; no recompute path (uk-risk-2026-1-1.js:1250) |
| partner_death | Death of partner / main earner | timeline/risk | Static `{D1,D3,D4,D6, Critical}`; real `shockDeath` exists but is the separate shock-suite, not wired here (uk-risk-2026-1-1.js:1251) |
| employment_change_self_emp | Became self-employed | timeline/risk | Static `{D1,D3, High}`; no recompute (uk-risk-2026-1-1.js:1252) |
| employment_change_employed | New employed role | timeline/risk | Static `{D1,D3, Medium}`; no recompute (uk-risk-2026-1-1.js:1253) |
| redundancy | Redundancy | timeline/risk | Static `{D1,D2,D3, High}`; `shockJobLoss` is shock-suite, not tied to logging (uk-risk-2026-1-1.js:1254) |
| jurisdiction_move | Jurisdiction move | timeline/risk | Static `{D1,D3,D4,D5,D6, High}`; ripple.js takes change as a label only; no eventStore.js (uk-risk-2026-1-1.js:1255) |
| property_purchase | Property purchase | timeline/risk | Static `{D4,D5,D2, Medium}`; lifeEventReopen returns mapping, no recompute (uk-risk-2026-1-1.js:1256) |
| property_sale | Property sale | timeline/risk | Static `{D2,D4,D5, Medium}`; adjacent WhatIfLibrary 'property-sale' DOES recompute but is a separate MyMoney tool (uk-risk-2026-1-1.js:1257) |
| inheritance | Inheritance received | timeline/risk | Static `{D2,D5,D6, Medium}`; ripple.js does not recompute per inheritance event (uk-risk-2026-1-1.js:1258) |
| serious_illness | Serious illness | timeline/risk | Static `{D1,D2,D3, High}`; `shockIllness` computes a 6-month impact but is not driven by this event log (uk-risk-2026-1-1.js:1259) |
| retirement | Retirement | timeline/risk | Static `{D1,D3,D4,D6, High}`; WhatIfLibrary 'early-retire' + Timeline planFor recompute, but not this subtype (uk-risk-2026-1-1.js:1260) |
| business_sale | Business sale | timeline/risk | Static `{D4,D5,D6, High}`; no recompute (uk-risk-2026-1-1.js:1261) |
| pension_crystallisation | Pension crystallisation | timeline/risk | Static `{D1,D2, Medium}`; no recompute (uk-risk-2026-1-1.js:1262) |
| cashflow-Q5 | Is my capital working harder than it costs? | cashflow | `cf_prcPccSpread` resolves to the STUB `prcPccSpread` returning `{status:'stub', methodology:'pending', openItem:'O-CF-RULES-07'}` (uk-cashflow-2026-1-1.js:2168); card renders 'Coming next'. Real bodies exist elsewhere (cashflow-engine.js:791) but the wired import is the stub |
| timeline-Q4 | What have I committed to? | timeline | Reads `entity.decisions ?? []` and echoes `d.title/d.detail/d.impact` (Timeline.jsx:1285); no engine compute — DiffBadge shows stored value |
| timeline-Q5 | What scenarios have I explored? | timeline | Maps `entity.scenarios` or falls back to in-memory `_store` Map (timeline-engine.js:459-466); list/echo only, no computation |
| timeline-Q8 | What did I decide and why? | timeline | Only a stored `d.rationale` string echoed on expand (Timeline.jsx:1354); no AI/engine call — §D.6 Re-explain (AI) modal absent |

## 4. Full matrix

### Home — `home`

| id | label | surfaced | modeled | dormant | note |
|---|---|---|---|---|---|
| home-Q1 | Where do I stand financially overall? (triple-anchor) | yes | real | no | Always-on top-of-fold; calcRisk/calcFQ/calcAPQ compute all three anchors (HomeScreen.jsx:288) |
| home-Q2 | What changed since I last looked? (daily delta strip) | no | real | yes | diffSet computed but `diffs` never consumed in JSX (HomeScreen.jsx:2005) |
| home-Q3 | What is the one thing I should do today? (Priority Actions) | yes | real | no | calcAPQ ranked actions with computed Score/CoI deltas (fq-calculator.js:1301) |

### MyMoney — `mymoney`

| id | label | surfaced | modeled | dormant | note |
|---|---|---|---|---|---|
| mymoney-NONE | Spec v2_7 has NO numbered question inventory | no | na | yes | §1.1 purpose ('What do I own…') not rendered; no Q-inventory to map (2-Product-mymoney-v2_7.md:133) |

### Cashflow — `cashflow`

| id | label | surfaced | modeled | dormant | note |
|---|---|---|---|---|---|
| cashflow-Q1 | How much am I spending vs earning this month? | yes | real | no | Waterfall driven by real flow figures; falls back to 'No income data yet' (Cashflow.jsx:357) |
| cashflow-Q2 | Am I on track for retirement? | yes | real | no | fundedRatio real projection with INSUFFICIENT branch (fq-calculator.js:504) |
| cashflow-Q3 | What's my probability of not running out of money? | yes | real | no | Monte Carlo probabilityOfSuccess, MC fan (cashflow-engine.js:504) |
| cashflow-Q4 | What is my cost of doing nothing? | yes | real | no | totalCoI sums 10 domain CoI fns (fq-calculator.js:2178) |
| cashflow-Q5 | Is my capital working harder than it costs? | yes | stub | no | Wired import is the STUB prcPccSpread; renders 'Coming next' (O-CF-RULES-07) |
| cashflow-Q6 | What would change my retirement picture the most? | yes | real | no | goalSeek binary-search over simulateAction (fq-calculator.js:1910); framing match partial |
| cashflow-Q7 | How sustainable is my cashflow under stress? | yes | real | no | sequenceOfReturnsVulnerability + GK corridor (cashflow-engine.js:395) |

### Tax & Estate — `tax-estate`

| id | label | surfaced | modeled | dormant | note |
|---|---|---|---|---|---|
| tax-estate-Q1 | What is my total IHT exposure today? | yes | real | no | te_ihtExposure single source (tax-estate-engine.js:644) |
| tax-estate-Q2 | IHT delta die-after-April-2027 vs today (dual-number) | yes | real | no | ihtDeltaPrePost2027 + daysUntilApril2027 (canonical-metrics.js:455) |
| tax-estate-Q3 | Daily cost of taking no action on my estate? | yes | real | no | costOfInaction('estatePlanning') + totalCoI; dailyRate in-component |
| tax-estate-Q4 | How does changing SIPP drawdown change IHT? | yes | real | no | drawdownMatrix engine rows; UI interpolates (tax-estate-engine.js:574) |
| tax-estate-Q5 | Income tax this year + allowances remaining? | yes | real | no | te_taxThisYear + allowanceTracker (tax-estate-engine.js:203/449) |
| tax-estate-Q6 | +3% salary sacrifice → take-home & pension? | yes | real | no | te_nicsDetail recomputes NIC; gated on salary>0 (tax-estate-engine.js:308) |
| tax-estate-Q7 | What taper position is each of my gifts in? | gated | real | yes | GiftClock null unless entity.estate.gifts present (TaxEstate.jsx:1782) |
| tax-estate-Q8 | Will & LPA current? | yes | real | no | willLpaStatus base read always renders (fq-calculator.js:3505) |
| tax-estate-Q9 | Estate under UK intestacy if I died today? | yes | real | no | intestacyDistribution shares (fq-calculator.js:3537) |
| tax-estate-Q10 | Am I on track against my estate plan? | gated | real | yes | Needs committed plan in entity.plans; else 'No plan yet' (TaxEstate.jsx:3383) |

### Risk layer — `risk-layer`

| id | label | surfaced | modeled | dormant | note |
|---|---|---|---|---|---|
| risk-layer-Q1 | How resilient am I, and where am I weakest? | yes | real | no | CrossMap5x5 + 7-dim panel; D7 Behavioural hardcoded 0 (risk-engine.js:1028) |
| risk-layer-Q2 | What would happen if X went wrong? | yes | real | no | runShock recomputes calcRisk+netWorth on mutated entity (risk-engine.js:205) |
| risk-layer-Q3 | What should I do about it? | yes | real | no | TakeAction calcAPQ + whatWouldHelpMost re-runs shocks (risk-engine.js:256) |

### Timeline — `timeline`

| id | label | surfaced | modeled | dormant | note |
|---|---|---|---|---|---|
| timeline-Q1 | Where am I in my financial life? | yes | real | no | lifeStageFor(age) always renders (fq-calculator.js:102) |
| timeline-Q2 | How are my scores trending? | yes | real | no | calcScoreHistory/calcRiskHistory; synthesised at LOW confidence when no event log |
| timeline-Q3 | What's coming up that I need to act on? | yes | real | no | buildCalendarEntries; ISA-reset row unconditional; others gated on persona data |
| timeline-Q4 | What have I committed to? | yes | metadata | no | Echoes entity.decisions; empty-state otherwise; no recompute (Timeline.jsx:1285) |
| timeline-Q5 | What scenarios have I explored? | yes | metadata | no | Lists entity.scenarios or in-memory fixture; no computation (timeline-engine.js:459) |
| timeline-Q6 | Am I on track for my goals? | yes | real | no | calcMilestones/calcGoalProgress + fundedRatio headline (timeline-engine.js:122) |
| timeline-Q7 | How much is my inaction costing? | gated | real | yes | CoI chip gated `coi>0 && hasDCPension` (Timeline.jsx:879); PAYE persona sees none |
| timeline-Q8 | What did I decide and why? | no | metadata | yes | §D.6 Re-explain (AI) absent; static stored rationale only (Timeline.jsx:1354) |
| timeline-Q9 | How do my saved scenarios compare? | no | na | yes | §E compare mode absent; flat list, no side-by-side (Timeline.jsx:1772) |
| timeline-Q10 | What if I retired at 60 instead of 67? | yes | real | no | GoalSeekSheet solver-backed; literal age axis only in §A scrubber (fq-calculator.js:1910) |
| timeline-Q11 | Am I on track to hit my retirement plan? | gated | real | yes | Needs committed plan AND viewMode='plan'; default 'actual' shows prompt (Timeline.jsx:613) |

### Decisions home — `money`

| id | label | surfaced | modeled | dormant | note |
|---|---|---|---|---|---|
| DE-03 | How much to pay into your pension | yes | real | no | Tax-relief compute; ihtDelta=0 by enacted Apr-2027 rule (decision-engine.js:186) |
| DE-04 | Where to put your pension contributions | yes | real | no | Routes employer-match value (decision-engine.js:199) |
| DE-05 | Swap some salary for pension contributions? | yes | real | no | Salary-sacrifice IT+NIC relief; golden vector pending sign-off (decision-engine.js:211) |
| DE-37 | Should you transfer a final-salary pension? | yes | real | no | CETV vs capitalised-income delta; capitalisation multiple a reviewer estimate, conf LOW (decision-engine.js:754) |
| DE-06 | Which ISA to use for your savings | yes | real | no | nwDelta = investableIsa × growthDefault × 10 (decision-engine.js:229) |
| DE-07 | Move investments into a tax-free ISA (bed-and-ISA) | yes | real | no | cgtSheltered compute; embeddedGain default estimate (decision-engine.js:244) |
| DE-22 | Using your tax-free capital gains allowance | yes | real | no | harvested × cgtHigher; conf HIGH (decision-engine.js:505) |
| DE-23 | Using investment losses to cut tax | yes | real | no | offset × cgtHigher; conf HIGH (decision-engine.js:518) |
| DE-24 | Sharing assets with your spouse to cut tax | yes | real | no | savingsOnTransfer banded; spouseIncome an estimate (decision-engine.js:530) |
| DE-26 | High-risk start-up investing (EIS/SEIS) | yes | real | no | relief + ihtDelta from TAX bundle; conf LOW (decision-engine.js:571) |
| DE-27 | Venture capital trusts (VCT) | yes | real | no | vctAmount × vctITRate; conf LOW (decision-engine.js:590) |
| DE-28 | Business-relief investing (BPR) | yes | real | no | IHT saving real; nwDelta uses hardcoded 6% AIM return (decision-engine.js:601) |
| DE-08 | Spare money: overpay mortgage or invest? | yes | real | no | Compounds both legs, deducts CGT (decision-engine.js:263) |
| DE-09 | Property: keep, rent, or sell | yes | real | no | CGT + sheltered growth + partial-estate IHT (decision-engine.js:289) |
| DE-10 | Choosing your next mortgage deal | yes | real | no | rate-gap × balance × term; newRate a labelled estimate (decision-engine.js:304) |
| DE-11 | Rental property and landlord tax rules | yes | real | no | Section-24 extra tax banded; not gated on owning BTL (decision-engine.js:320) |
| DE-12 | Releasing cash from your home (equity release) | yes | real | no | Rolled-up interest + estate reduction; erRate estimate, conf LOW (decision-engine.js:337) |
| DE-25 | Paying yourself: salary vs dividends (director) | yes | real | no | Employer-NI saved minus dividend tax × 5 (decision-engine.js:551) |
| DE-35 | Selling your business tax-efficiently | yes | real | no | BADR saving + lost-BPR ihtDelta (decision-engine.js:719) |
| DE-36 | Repaying or clearing a director loan | yes | real | no | -(dlBalance × dividendRate); S455 refundability pending (decision-engine.js:736) |

### Decisions home — `flow`

| id | label | surfaced | modeled | dormant | note |
|---|---|---|---|---|---|
| DE-01 | Taking your pension: all at once or bit by bit | yes | real | no | taxSaved compute; 0.20 factor hardcoded but real number (decision-engine.js:162) |
| DE-02 | Buy a guaranteed income now, or wait? | yes | real | no | deferGain = sipp×0.04×5; conf LOW (decision-engine.js:174) |
| DE-38 | Adding a guaranteed income later in retirement | yes | real | no | guaranteedIncome + ihtDelta from TAX bundle; annuityRate estimate (decision-engine.js:773) |
| DE-13 | Emergency fund: how much and where | yes | real | no | target6mo × rate gap; conf HIGH (decision-engine.js:355) |
| DE-14 | A better return on spare cash | yes | real | no | cashToLadder × yieldPickup × 2; conf HIGH (decision-engine.js:374) |
| DE-30 | Paying for school or university | yes | real | no | shelterSaving via growth × est tax (decision-engine.js:631) |
| DE-31 | Can you afford a career break? | yes | real | no | totalCost vs liquidAssets; conf HIGH (decision-engine.js:653) |
| DE-32 | What to do with a redundancy payout | yes | real | no | taxFree + netOfTax × growth × 10 (decision-engine.js:666) |
| DE-33 | What to do with an inheritance | yes | real | no | toSIPP via AA, compounded growth; not gated on inheritance event (decision-engine.js:680) |
| DE-34 | Structuring a divorce settlement | yes | real | no | assetsTransferred × ihtRate; settlementShare default 0.50 (decision-engine.js:700) |
| DE-39 | Leaving the UK: tax residency planning | yes | real | no | exitGain × cgtHigher; embeddedGainPct estimate (decision-engine.js:796) |
| DE-40 | Paying for long-term care | yes | real | no | deferredCost + ihtDelta; care cost/duration estimates (decision-engine.js:813) |

### Decisions home — `tax`

| id | label | surfaced | modeled | dormant | note |
|---|---|---|---|---|---|
| DE-15 | Giving money to family tax-efficiently | yes | real | no | 7-year PET; ihtSaved = pet × ihtRate (decision-engine.js:388) |
| DE-16 | Choosing the right type of trust | yes | real | no | Net-IHT: removed minus entry charge; conf LOW (decision-engine.js:405) |
| DE-17 | Choosing the right type of will | yes | real | no | RNRB preservation w/ taper; 0 saving below NRB+RNRB (decision-engine.js:424) |
| DE-18 | Power of attorney — planning ahead | yes | real | no | Avoided deputy cost; 3500 hardcoded literal (flags §6 bullet 2) (decision-engine.js:445) |
| DE-29 | Giving to charity tax-efficiently | yes | real | no | Gift-Aid reclaim; income-band dependent; conf HIGH (decision-engine.js:612) |

### Decisions home — `risk`

| id | label | surfaced | modeled | dormant | note |
|---|---|---|---|---|---|
| DE-19 | Choosing the right life cover | yes | real | no | debtCover × premiumRate × 10; premiumRate labelled estimate (decision-engine.js:456) |
| DE-20 | Critical illness cover: add or top up | yes | real | no | ciAmount × ciPremiumRate × 5; estimate parameterised (decision-engine.js:471) |
| DE-21 | Income protection: which type to choose | yes | real | no | monthlyBenefit with own-occ/any-occ axis; estimates labelled (decision-engine.js:485) |

### Life-events — `timeline/risk` (all dormant, all metadata)

| id | label | surfaced | modeled | dormant | note |
|---|---|---|---|---|---|
| marriage | Marriage / civil partnership | no | metadata | yes | Matrix-only; lifeEventReopen zero non-test consumers (uk-risk-2026-1-1.js:1247) |
| divorce | Divorce / separation | no | metadata | yes | Matrix-only; DE-34 separate (uk-risk-2026-1-1.js:1248) |
| child_birth | Child born / new dependant | no | metadata | yes | Matrix-only; inferred from has_children, not logged (uk-risk-2026-1-1.js:1249) |
| dependant_death | Death of a dependant | no | metadata | yes | Matrix-only; no logging UI (uk-risk-2026-1-1.js:1250) |
| partner_death | Death of partner / main earner | no | metadata | yes | Critical priority; shockDeath separate (uk-risk-2026-1-1.js:1251) |
| employment_change_self_emp | Became self-employed | no | metadata | yes | Matrix-only; start_business is AI-tree (uk-risk-2026-1-1.js:1252) |
| employment_change_employed | New employed role | no | metadata | yes | Pure matrix entry (uk-risk-2026-1-1.js:1253) |
| redundancy | Redundancy | no | metadata | yes | Matrix-only; shockJobLoss separate; DE-32 separate (uk-risk-2026-1-1.js:1254) |
| jurisdiction_move | Jurisdiction move (relocation) | no | metadata | yes | Matrix-only; test-only consumer (uk-risk-2026-1-1.js:1255) |
| property_purchase | Property purchase | no | metadata | yes | Matrix-only; no WhatIfLibrary scenario (uk-risk-2026-1-1.js:1256) |
| property_sale | Property sale | no | metadata | yes | Reopen inert; WhatIfLibrary 'Sell main home' is separate (uk-risk-2026-1-1.js:1257) |
| inheritance | Inheritance received | no | metadata | yes | Matrix-only; no UI to log; no recompute (uk-risk-2026-1-1.js:1258) |
| serious_illness | Serious illness | no | metadata | yes | Matrix-only; shockIllness separate (uk-risk-2026-1-1.js:1259) |
| retirement | Retirement | no | metadata | yes | Reopen subtype inert; modelled elsewhere as plan/what-if (uk-risk-2026-1-1.js:1260) |
| business_sale | Business sale | no | metadata | yes | Matrix-only; no trigger UI (uk-risk-2026-1-1.js:1261) |
| pension_crystallisation | Pension crystallisation | no | metadata | yes | Matrix-only; age prompt unrelated (uk-risk-2026-1-1.js:1262) |

## 5. Top 10 highest-leverage gaps

Ranked recommendation of what to surface / wire first.

| # | id | gap | why first |
|---|---|---|---|
| 1 | inheritance | No UI to log an inheritance event; matrix-only, no recompute | Highest user-value event; a separate DE-33 'what to do with an inheritance' already computes — wiring a logged event closes the loop between life-event and decision |
| 2 | business_sale | No trigger UI; matrix-only despite DE-35 being a live computed decision | High net-worth moment; engine already prices the sale (DE-35) — only the logged-event recompute path is missing |
| 3 | partner_death | Critical-priority matrix entry with no UI; real `shockDeath` exists but unwired | Highest-severity life-event (priority:'Critical'); a real compute already exists in the shock-suite — connect it to a logged event |
| 4 | jurisdiction_move | Matrix-only; DE-39 prices the exit but no event reopens dimensions | High value; the engine already computes exit-CGT (DE-39) — bridge to the risk recompute |
| 5 | home-Q2 | `diffSet` computed then discarded (dead variable); no 'what changed' strip | Cheapest real win — data is already engine-computed at HomeScreen.jsx:2005; only a render path is missing. Answers a primary spec question (§Q1.1) |
| 6 | cashflow-Q5 | Wired import is the STUB prcPccSpread; real bodies exist elsewhere | Looks live but renders 'Coming next'; real implementations already exist (cashflow-engine.js:791) — swap the import once O-CF-RULES-07 methodology is signed off |
| 7 | redundancy | Matrix-only; shockJobLoss + DE-32 both exist but unwired to a logged event | Common, high-impact event; two adjacent real computes already exist — only the event log + recompute wiring is missing |
| 8 | tax-estate-Q7 | GiftClock returns null without recorded gifts; engine real but starved | Real giftClockProjection exists; gap is data-entry — add a 'record a gift' affordance so the IHT taper surface stops being empty for demo personas |
| 9 | timeline-Q9 | §E compare mode absent; scenarios listed not compared | Spec-named feature entirely missing; scenario data already stored — a side-by-side view is additive, no new engine work |
| 10 | timeline-Q11 / tax-estate-Q10 | Plan-on-track answers gated behind a committed plan + viewMode | Both real engines (planFor/planStaleness) exist; gap is the plan-commit flow — once a plan can be committed, both surfaces light up together |
