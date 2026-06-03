Title: Per-Holding Decumulation Decision Taxonomy — Investment Wrappers
Version: 1.0
Date: 2026-06-03
Status: DOCUMENTED
Cluster: 3-Engine / 2-Product (decumulation)
File name: 2-investment-wrappers.md
Purpose: Research-grounded per-wrapper decumulation factor set to replace the engine's ISA/GIA bucket aggregation with a per-holding model that respects CGT, embedded gains, reliefs, clawbacks, and bond mechanics.

**Summary:** Per-wrapper decumulation factors (cost, drawdown tax, relief clawback risk, special mechanics, IHT/death, draw-classification, engine data fields) for 21 UK investment wrapper/asset types at 2026/27 rules, plus answers to the 5 key sequencing questions and a proposed per-holding data schema.
**Tags:** #engine #decumulation #investments #cgt #wrappers #tax
**Updated:** 2026-06-03

> **Stance:** Info / guidance / storage platform — NOT regulated advice. Everything below is a *factual factor set* the engine surfaces so a user can see how a number was derived. Never "you should". Output is "here is the tax consequence of disposing X" not "sell X first".

---

## 0 — Rules baseline verified for 2026/27 (do not trust memory; re-verify each Budget)

| Rule | Figure (2026/27) | Status | Notes |
|---|---|---|---|
| CGT Annual Exempt Amount (AEA) | **£3,000** | ENACTED | Down from £6,000 (23/24) and £12,300 (22/23). Per person, not transferable. |
| CGT rates (non-property) | **18% basic / 24% higher** | ENACTED | Aligned to property rates from 30 Oct 2024 Budget. |
| Dividend allowance | **£500** | ENACTED | Down from £1,000 (23/24) and £2,000. |
| Personal Savings Allowance | **£1,000 basic / £500 higher / £0 additional** | ENACTED | Covers interest from GIA cash, gilts, corporate bonds. |
| Starting rate for savings | £5,000 band (tapers above £12,570 non-savings income) | ENACTED | Relevant for low-other-income retirees drawing interest. |
| ISA annual allowance | **£20,000** (all ISA types combined) | ENACTED | LISA sub-cap £4,000 counts toward the £20k. |
| Flexible ISA | Cash/S&S/IFISA *can* be flexible (provider option); **LISA & JISA are NOT** | ENACTED | Flexible = withdraw + replace same tax year without using fresh allowance. |
| LISA withdrawal charge | **25%** on unauthorised withdrawal (≈6.25% net loss of own money) | ENACTED | Free access only: age 60+, first home ≤£450k, or terminal illness. |
| VCT income tax relief | **20%** for subscriptions from **6 Apr 2026** (was 30% to 5 Apr 2026) | ENACTED — CHANGED 2026 | Min-holding **5 years** to retain relief. Dividends tax-free, gains CGT-exempt (no min hold for those). |
| EIS income tax relief | **30%**, min-hold **3 years** | ENACTED | CGT-exempt on disposal after 3yr; **CGT deferral** of other gains until EIS disposal. |
| SEIS income tax relief | **50%**, min-hold **3 years**; up to **50% CGT reinvestment relief** (permanent, not deferral) | ENACTED | CGT-exempt on growth after 3yr. |
| Investment bond 5% allowance | **5% of premium p.a., cumulative**, tax-deferred (not tax-free) | ENACTED | Unused 5% carries forward. Withdrawals >cumulative 5% = chargeable event. |
| Onshore bond tax credit | **20% non-reclaimable credit** (fund taxed internally) | ENACTED | Top-sliced; basic-rate band gains = no further tax. |
| Offshore bond | **Gross roll-up, NO credit** — full gain taxed as income on chargeable event | ENACTED | Top-sliced over *whole* life of bond (vs onshore "since last event"). |
| Bond rate change (forward note) | From **6 Apr 2027**: bond gains taxed 22%/42%/47%; onshore credit 22% | ENACTED (future-effective) | Engine must date-gate; not yet live in 26/27. |
| AIM-ISA / unlisted BPR | **50%** relief from **6 Apr 2026** (was 100%) → effective **20% IHT** on AIM | ENACTED — CHANGED 2026 | 2-year hold still required. £1m 100%-relief allowance does NOT apply to AIM (AIM is 50% flat). |
| Gilts | **CGT-EXEMPT** (gain); interest taxable (PSA applies) | ENACTED | Disposal never a CGT event. |
| QCBs (qualifying corporate bonds) | **CGT-EXEMPT**; interest taxable (PSA) | ENACTED | Non-QCB corporate bonds CAN be chargeable — capture QCB flag. |

Sources at foot of doc.

---

## 1 — Per-wrapper decumulation factor table

Legend for **DRAW-CLASSIFICATION**:
`DRAW-EARLY-TAX-FREE` · `DRAW-WITH-CGT-MGMT` (use AEA, phase) · `DRAW-INCOME-TAXED` · `AVOID-EARLY-RELIEF-CLAWBACK` (don't-touch flag) · `SPECIALIST` (bond top-slicing / segment logic) · `DRAW-LAST` (tax-free + non-IHT-sheltered shelter to preserve).

| Wrapper (taxonomy ID) | Costs | Tax on drawdown / disposal | Reliefs / clawbacks at risk | Special mechanics | IHT / death | DRAW-CLASSIFICATION | Key engine fields |
|---|---|---|---|---|---|---|---|
| **ISA_SS** (S&S ISA) | Platform + OCF | **None** — disposals CGT-free, no income/div tax | None | Bed-and-ISA *into* it; flexible-withdrawal replace if provider supports | In estate (full IHT) unless AIM-BPR holdings inside | **DRAW-LAST** (tax-free growth, no CGT drag) — but see Q2 tension | `isaFlexible`, `holdsAimBpr` |
| **ISA_CASH** | Usually nil | None on withdrawal | None | Flexible replace if provider supports | In estate | DRAW-EARLY-TAX-FREE (if liquidity needed cheaply) | `isaFlexible`, `rate` |
| **LISA** | Platform + OCF (S&S) / nil (cash) | None if age 60+/qualifying; else **25% charge** on withdrawal | **LISA 25% penalty** if <60 & not first-home/terminal | Not flexible; £4k sub-cap | In estate | DRAW-EARLY-TAX-FREE *only from 60*; before 60 = penalty flag | `lisaAccessAge`, `qualifyingPurpose` |
| **IFISA** | Platform | None (interest tax-free in wrapper) | None | Illiquid (P2P loan terms) — may not be disposable on demand | In estate | DRAW-EARLY-TAX-FREE *if liquid*; flag illiquidity | `liquidityLockEnd` |
| **JISA_SS / JISA_CASH** | Platform/OCF | None | None | **Locked until child 18** — not the account-holder's to draw | In *child's* estate | NOT-DRAWABLE (locked) | `childDob`, `maturityDate` |
| **HTB_ISA** (legacy, closed to new) | Nil | None; 25% bonus only on completion (first-home) | Bonus lost if not used for qualifying purchase | Closed to new money 2019; existing run to 2030 claim | In estate | SPECIALIST (purpose-locked bonus) | `bonusClaimDeadline` |
| **GIA** (unwrapped) | Platform + OCF, dealing | **CGT on gain** (18/24%) over AEA; **dividends** taxed over £500; **interest** over PSA | None to lose, but *loss harvesting* available | **Phase disposals to use £3k AEA + £500 div allowance yearly; bed-and-ISA; in-specie transfer; CGT loss harvesting; pooling (s104)** | Full IHT; **CGT uplift to probate value on death (gains wiped)** | **DRAW-WITH-CGT-MGMT** (per-holding, see Q1 & Q5) | `embeddedGainPct`, `acquisitionDate`, `bookCost`, `s104Pool`, `unrealisedLoss`, `dividendYield` |
| **INVESTMENT_BOND_ONSHORE** | Product + fund + sometimes adviser/wrapper | **Income tax** on chargeable-event gain, **20% credit** (basic-rate-band gains nil further); top-sliced "since last event" | None | **5% tax-deferred withdrawal p.a. cumulative; segment surrender; top-slicing relief; chargeable event on full/segment surrender, death, assignment** | Chargeable event **on death** of last life assured → gain taxed in death year; bond can be in trust | **SPECIALIST** (5% allowance first; top-slice before big surrender) | `premiumPaid`, `bondSegments`, `cumulative5pctUsed`, `yearsInForce`, `lastChargeableEvent`, `livesAssured` |
| **INVESTMENT_BOND_OFFSHORE** | Product + fund (often higher) | **Income tax on FULL gain, NO credit**; top-sliced over **whole life** of bond (more relief) | None | Gross roll-up; same 5%/segment/top-slice mechanics; time-apportionment if non-UK-resident years | Chargeable event on death; trust-friendly | **SPECIALIST** (gross roll-up favours deferral; surrender in low-income year) | `premiumPaid`, `bondSegments`, `cumulative5pctUsed`, `yearsInForce`, `nonResidentYears`, `livesAssured` |
| **EIS** | Fund/dealing; illiquid | After 3yr: **CGT-EXEMPT** on growth. Before 3yr: CGT exemption lost **+ income-relief clawback** | **30% income relief clawed back + deferred gain crystallises if sold <3yr** | CGT **deferral** of other gains unwinds on disposal; loss relief if down | **IHT relief** (BPR-style, 2yr hold) — but verify post-2026 BPR reform applies | **AVOID-EARLY-RELIEF-CLAWBACK** (don't-touch until `reliefHoldingEndDate`) | `reliefHoldingEndDate`, `incomeReliefClaimed`, `deferredGainParked`, `holdingPeriodMonths` |
| **SEIS** | Fund/dealing; illiquid | After 3yr: **CGT-EXEMPT**. Before 3yr: clawback of 50% relief + reinvestment relief unwinds | **50% income relief + up to 50% CGT reinvestment relief clawed back if <3yr** | CGT reinvestment relief is **permanent exemption** (not deferral) once held | IHT relief (2yr BPR-style) | **AVOID-EARLY-RELIEF-CLAWBACK** | `reliefHoldingEndDate`, `incomeReliefClaimed`, `cgtReinvestReliefClaimed` |
| **VCT** | Annual mgmt charge (high) | **Dividends tax-free; gains CGT-exempt** (no min hold for these). Income relief: **5yr hold** to retain (20% on post-Apr-2026 subs) | **20% (post-6Apr26) income relief clawed back if sold <5yr** | Dividends are the *designed* income stream — tax-free yield without triggering clawback | In estate (no BPR on VCT) | **AVOID-EARLY-RELIEF-CLAWBACK** for *capital*; but **dividends drawable immediately tax-free** | `reliefHoldingEndDate` (5yr), `incomeReliefRate`, `subscriptionDate` |
| **OEIC / UNIT_TRUST** | OCF + platform | **CGT on gain over AEA; dividends £500; interest PSA** (depends on fund type) | None | Same GIA disposal mechanics (AEA phasing, bed-and-ISA, in-specie, harvesting); equalisation on first distribution | Full IHT; CGT uplift on death | **DRAW-WITH-CGT-MGMT** | `embeddedGainPct`, `acquisitionDate`, `bookCost`, `accInc` (acc vs inc units), `equalisation` |
| **INVESTMENT_TRUST** | OCF + platform + dealing; can trade at discount/premium | CGT on gain; dividends £500 | None | Discount/premium affects realisable value; gearing affects vol; bed-and-ISA | Full IHT | **DRAW-WITH-CGT-MGMT** | `embeddedGainPct`, `acquisitionDate`, `discountPct` |
| **ETF** | OCF + platform + dealing/spread | CGT on gain; **distributions: dividend or interest** (bond ETFs = interest); **non-reporting offshore ETFs taxed as income (offshore income gains)** | None | Reporting-status flag critical (UK reporting vs not); bed-and-ISA | Full IHT | **DRAW-WITH-CGT-MGMT** (capture reporting status) | `embeddedGainPct`, `acquisitionDate`, `reportingStatus`, `assetClass` |
| **SHARES_DIRECT** | Dealing + spread; no OCF | CGT on gain over AEA; dividends £500 | None | s104 pooling; same-day & 30-day bed-and-breakfast rules; bed-and-ISA; in-specie | Full IHT; CGT uplift on death; **AIM shares may carry 50% BPR** | **DRAW-WITH-CGT-MGMT** (per-line embedded gain) | `embeddedGainPct`, `acquisitionDate`, `s104Pool`, `isAim`, `bprEligible` |
| **GILTS** | Dealing/spread | **Gain CGT-EXEMPT**; coupon interest taxable (PSA) | None | Price pull-to-par; low-coupon gilts favoured by higher-rate (gain tax-free, low taxable income) | Full IHT | **DRAW-EARLY** for tax-efficient capital realisation (no CGT) | `couponRate`, `maturityDate`, `cleanPrice` |
| **CORPORATE_BONDS** | Dealing/spread | **QCB: gain CGT-EXEMPT**; non-QCB: chargeable. Interest taxable (PSA) | None | QCB vs non-QCB flag changes CGT treatment entirely | Full IHT | **DRAW-EARLY** if QCB (CGT-free); else CGT-MGMT | `isQcb`, `couponRate`, `maturityDate`, `embeddedGainPct` |
| **STRUCTURED_PRODUCT** | Often embedded (opaque) | **Depends on wrapper**: deposit-based = income/PSA; security-based (note) = CGT; some pay income | None | **Fixed maturity / barrier / autocall** — early exit may be illiquid or at MTM loss; tax treatment varies by structure | Full IHT | **SPECIALIST** (maturity-locked; capture tax-wrapper type) | `structureType` (deposit/note), `maturityDate`, `autocallDates`, `barrierLevel`, `taxTreatment` |

---

## 2 — The five key-question answers (for surfacing methodology to users)

### Q1 — Why GIA should usually be drawn using the £3k CGT allowance + dividend allowance each year (not one lump)

A lump-sum GIA disposal crystallises the **entire** embedded gain in one tax year. Only the first **£3,000** is covered by the AEA; the rest is taxed at 18% / 24%. By **phasing** disposals across tax years, the user can keep each year's realised gain at or near £3,000 and pay **£0 CGT** on that slice. The **£500 dividend allowance** and **PSA** further shelter the income the holding throws off while it's still held. Two amplifiers the engine should model:
- **Bed-and-ISA** — sell up to the AEA in the GIA, immediately repurchase inside the ISA (using the £20k allowance). Future growth becomes CGT-free, and the realised gain on the sold slice is within the AEA so £0 CGT. Resets the cost base higher.
- **Spousal transfer** — inter-spouse transfers are no-gain/no-loss, doubling available AEA (£6k) and using a lower-rate band. (Surface as a factor, not a directive.)

The engine cannot compute any of this from a single aggregated "GIA = £X" number. It needs **per-holding book cost and acquisition date** (see Q5).

### Q2 — Why ISA is often drawn LAST — and the tension that sometimes flips it earlier

**Draw-last logic:** ISA growth and withdrawals are entirely tax-free, so leaving money there lets the most tax-efficient pot compound longest. Critically, from **April 2027 unused pensions fall inside the IHT estate** — so for IHT-exposed users the pension is now often drawn *first* to spend down the soon-to-be-taxed pot, and the ISA (already in the estate, but tax-free for the living holder) sits in the middle. GIA is drawn early to harvest the AEA annually before gains balloon.

**The flip — why ISA sometimes goes earlier:**
1. **ISA is in the IHT estate at 40%** with no shelter (unless it holds AIM-BPR stock, now only 50% relief from Apr 2026). A pension drawn *within the lifetime* is income-taxed but the ISA gives nothing back to the estate. If the user is IHT-exposed and *not* spending the pension, spending the ISA reduces the taxable estate.
2. **Income-tax-band management** — ISA withdrawals are tax-free and don't count toward the basic-rate band, so a user near a cliff (e.g. £100k personal-allowance taper, child-benefit charge) may draw ISA to stay under the threshold rather than taxable pension/GIA income.
3. **Liquidity / cost** — cash ISA is the cheapest, most liquid pot for an unexpected need.

So the rule is *conditional*, not absolute. The engine should expose both arguments, not pick one.

### Q3 — Why selling EIS/SEIS/VCT inside the holding period claws back relief (the don't-touch flag)

These reliefs are **conditional on holding**:
- **EIS/SEIS: 3-year** minimum hold. Sell early → the 30% (EIS) / 50% (SEIS) income relief is **withdrawn (clawed back)**, the CGT-exemption on growth is lost, **and** for EIS any **deferred gain parked behind the investment crystallises immediately**. SEIS reinvestment relief (up to 50%) likewise unwinds.
- **VCT: 5-year** minimum hold to retain the income relief (20% on subscriptions from 6 Apr 2026). Sell early → relief clawed back. *But* VCT **dividends are tax-free with no minimum hold** and the capital gain is CGT-exempt — so the income stream is drawable without touching the capital that carries the clawback risk.

Engine consequence: each of these holdings carries a hard **`reliefHoldingEndDate`**. Before that date the disposal classification is **AVOID-EARLY-RELIEF-CLAWBACK** — a *don't-touch* flag the decumulation sequencer must respect ahead of pure tax-efficiency, because a forced early sale can cost more in clawed-back relief than the disposal raises. After the date, EIS/SEIS/VCT become genuinely tax-efficient sources (CGT-free growth).

### Q4 — How investment-bond 5% / top-slicing changes the order

Bonds invert the "draw tax-free first" heuristic because they have a **built-in tax-deferred income channel**:
- **5% rule:** the user can withdraw **5% of the original premium each year (cumulatively, carry-forward of unused)** with **no immediate tax** — deferred until a later chargeable event. So a bond can supply ~5%/yr of income for 20 years before any chargeable-event gain arises. This makes the bond a *natural early/steady* income source, not a last-resort pot.
- **Top-slicing relief:** when a full/segment surrender does trigger a chargeable-event gain, the gain is **sliced over the number of years held** (onshore: since last event; offshore: whole life) to test how much falls into higher/additional rate. Surrendering **in a low-other-income year** (e.g. post-retirement, pre-state-pension) can keep the sliced gain in the basic-rate band → onshore = no further tax (20% credit satisfies it); offshore = taxed but at the lowest marginal slice.
- **Segments:** surrendering **individual segments** rather than a partial withdrawal across the whole bond can produce a smaller, better-targeted gain.

So bonds are **SPECIALIST**: spend the 5% allowance steadily, time full/segment surrenders into low-income years, and use segment-level surrender to control the chargeable-event gain. Offshore's whole-life top-slicing and gross roll-up generally favour holding longer and surrendering in a deliberately low-income window.

### Q5 — Per-holding embedded gain: why aggregating GIA to one number loses the CGT picture

A GIA "value" of £100k tells the engine nothing about **tax cost to realise it**. Consider two £100k GIAs:
- Holding A: bought for £97k → £3k embedded gain → fully covered by the AEA → **£0 CGT** to sell entirely.
- Holding B: bought for £40k → £60k embedded gain → after £3k AEA, £57k taxed at up to 24% → **~£13.7k CGT** to sell entirely.

Same headline value, wildly different drawdown cost. Aggregation to one "GIA: £200k" number averages these away and makes the engine blind to the obvious move: **draw Holding A first (or harvest its small gain), defer Holding B, and bed-and-ISA the low-gain slices**. It also hides **loss-harvesting** opportunities (a holding below book cost can be sold to offset gains elsewhere — invisible if netted into a single figure). And it hides the **CGT uplift on death** consideration: a large-embedded-gain holding may be better *retained until death* (gain wiped at probate) than sold in life — a decision only visible per-holding.

Therefore the engine must store **acquisition cost, acquisition date, and embedded-gain % per holding line**, and run the CGT/AEA logic per line, not per bucket.

---

## 3 — Proposed per-holding data schema (engine must capture)

Replace bucket aggregation with a per-holding record. Common fields plus wrapper-specific extensions.

```
HoldingRecord {
  id
  taxonomyId            // ISA_SS | GIA | EIS | INVESTMENT_BOND_OFFSHORE | ...
  wrapperClass          // ISA_FAMILY | UNWRAPPED | VENTURE_RELIEF | INSURANCE_BOND | FIXED_INCOME | STRUCTURED
  currentValue
  // --- CGT / cost-base (UNWRAPPED + venture) ---
  bookCost              // s104 pooled cost
  acquisitionDate
  embeddedGainPct       // (currentValue - bookCost) / currentValue
  unrealisedLossFlag    // currentValue < bookCost → harvest candidate
  s104Pool              // pooled-cost detail for shares/funds
  // --- income character ---
  dividendYield
  interestBearing       // gilts/corp bonds/cash → PSA not div allowance
  reportingStatus       // ETF/offshore fund: UK-reporting vs not (income-gain risk)
  isQcb                 // corporate bond CGT-exempt flag
  // --- ISA family ---
  isaFlexible           // withdraw+replace same year without fresh allowance
  lisaAccessAge         // 60
  lisaQualifyingPurpose // first-home / terminal
  childDob              // JISA maturity gating
  holdsAimBpr           // AIM-in-ISA 50% BPR (post-6Apr26)
  // --- venture reliefs (EIS/SEIS/VCT) ---
  reliefHoldingEndDate  // 3yr EIS/SEIS, 5yr VCT — DON'T-TOUCH gate
  incomeReliefClaimed   // £ amount at risk of clawback
  incomeReliefRate      // 30 EIS / 50 SEIS / 20 VCT(post-Apr26)
  deferredGainParked    // EIS: other gain that crystallises on disposal
  cgtReinvestReliefClaimed // SEIS permanent exemption claimed
  // --- insurance bonds ---
  bondLocation          // ONSHORE | OFFSHORE
  premiumPaid
  bondSegments          // count + per-segment value
  cumulative5pctUsed    // 5% allowance consumed to date
  yearsInForce          // top-slicing divisor
  lastChargeableEvent   // onshore slicing reference
  nonResidentYears      // offshore time-apportionment
  livesAssured          // death = chargeable event trigger
  // --- structured ---
  structureType         // deposit (income/PSA) vs note (CGT)
  maturityDate
  autocallDates
  barrierLevel
  taxTreatment          // income | cgt
  // --- derived (engine computes) ---
  drawClassification    // DRAW-EARLY-TAX-FREE | DRAW-WITH-CGT-MGMT | DRAW-INCOME-TAXED |
                        // AVOID-EARLY-RELIEF-CLAWBACK | SPECIALIST | DRAW-LAST | NOT-DRAWABLE
  estimatedDisposalTax  // computed per-line, NOT per-bucket
  methodologyBlock      // rule applied + source URL + status + plain-English formula (per founder directive)
}
```

Engine rules that now become possible (and were impossible under bucket aggregation):
- Per-line `estimatedDisposalTax` and an **AEA-optimal phasing plan** across tax years.
- **Bed-and-ISA candidate list** (low-embedded-gain GIA lines ≤ remaining AEA + remaining ISA allowance).
- **Loss-harvest candidate list** (`unrealisedLossFlag`).
- **Don't-touch lock** on any holding with `reliefHoldingEndDate` in the future.
- **Bond 5%-allowance tracker** and low-income-year surrender windowing with top-slicing.
- **Death/IHT lens**: large-embedded-gain unwrapped holdings flagged for CGT-uplift-on-death; AIM-BPR (50%) vs full-IHT ISA distinction.

---

## 4 — Sources (with status)

CGT rates/AEA 2026/27 — ENACTED:
- https://www.gov.uk/guidance/capital-gains-tax-rates-and-allowances
- https://www.ii.co.uk/learn/tax/capital-gains-tax/allowance-rates

ISA / LISA / flexible-ISA — ENACTED:
- https://www.moneyhelper.org.uk/en/savings/types-of-savings/a-guide-to-lifetime-isas
- https://www.moneysavingexpert.com/savings/lifetime-isas/
- https://www.onefamily.com/lifetime-isa/lifetime-isa-withdrawal-charge/

VCT (20% from 6 Apr 2026, 5yr hold) — ENACTED, CHANGED 2026:
- https://www.wealthclub.co.uk/vct-tax-relief/
- https://octopusinvestments.com/resources/guides/vct-frequently-asked-questions/
- https://apexaccountants.tax/record-vct-fundraising-and-tax-relief-changes/

EIS / SEIS (relief, 3yr hold, CGT deferral/reinvestment) — ENACTED:
- https://www.saffery.com/insights/articles/eis-seis-vct-and-uk-investment-tax-reliefs-explained/
- https://www.bdo.co.uk/en-gb/insights/tax/corporate-tax/eis-seis-and-vct-tax-efficient-investments-a-guide-for-investors
- https://wealthvieu.com/uk/eis-seis-guide/

Investment bonds — 5%, top-slicing, onshore credit / offshore gross roll-up — ENACTED (2027 rate change ENACTED future-effective):
- https://techzone.aberdeenadviser.com/public/investment/Taxation-of-bonds
- https://www.mandg.com/wealth/adviser-services/tech-matters/investments-and-taxation/taxation-of-investment-bonds/offshore-bonds-taxation
- https://www.mandg.com/wealth/adviser-services/tech-matters/investments-and-taxation/taxation-of-investment-bonds/tax-deferred-allowance-bonds

AIM-ISA / BPR 100%→50% from 6 Apr 2026 — ENACTED, CHANGED 2026:
- https://www.rathbones.com/en-gb/wealth-management/knowledge-and-insight/business-property-relief-and-aim-changes-inheritance-tax
- https://adviser.royallondon.com/technical-central/protection-guidance/inheritance-tax-and-related-manuals/business-relief-changes/
- https://taxscape.deloitte.com/article/restrictions-on-agricultural-and-business-property-reliefs.aspx

Gilts / QCBs CGT-exempt; PSA / dividend allowance — ENACTED:
- https://www.gov.uk/guidance/gilt-edged-securities-exempt-from-capital-gains-tax
- https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg53703
- https://www.litrg.org.uk/savings-property/tax-savings-and-investments/tax-savings-income/personal-savings-allowance
- https://researchbriefings.files.parliament.uk/documents/CBP-10618/CBP-10618.pdf

---

## 5 — Caveats / unverified

- **JISA / HTB-ISA** decumulation factors are framed from general rules, not a fresh 2026/27 source pull this session (JISA is locked-until-18 so decumulation is largely N/A for the account holder; HTB-ISA is a legacy closed product with a 2030 bonus-claim deadline — verify deadline before surfacing).
- **STRUCTURED_PRODUCT** tax treatment is genuinely product-specific (deposit-based vs note-based); the engine must read the provider's tax-wrapper classification rather than assume — flagged `taxTreatment` as a required input, not a derived value.
- **EIS/SEIS IHT (BPR) interaction with the 6 Apr 2026 BPR reform** was not separately re-verified this session; treat as "BPR-style relief subject to the 2026 reform" and re-pull before relying on the relief rate.
