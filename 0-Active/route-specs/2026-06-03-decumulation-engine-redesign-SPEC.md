Title: Decumulation Engine Redesign — Per-Holding, Feature-Aware, Evaluate-then-Sequence
Version: 1.0
Date: 2026-06-03
Status: DOCUMENTED
Cluster: 3-Engine (decumulation solver) + 2-Product (MyMoney/Cashflow/Timeline) + asset-taxonomy
File name: 2026-06-03-decumulation-engine-redesign-SPEC.md
Purpose: Consolidate four research files into one founder-review spec to replace the engine's 4-bucket tax-only decumulation model with a per-holding, feature-aware, evaluate-then-sequence solver.

**Summary:** The solver today aggregates every asset into 4 pots (pension/ISA/GIA/cash) and sequences by marginal tax alone — blind to per-holding charges, guarantees (GAR/DB/annuity), protected tax-free cash, embedded CGT gains, relief-locks (EIS/SEIS/VCT), illiquidity, and the £2.25m of property it never models as income. This spec defines a draw-classification taxonomy over the 115-type asset taxonomy, a per-holding data model, an evaluate-then-exclude pre-pass, a 7-step goal-weighted + 2027-IHT-overlay sequencer, a drillable network diagram with a secure-income node, the 2026/27 rule-currency corrections (all marked verify-before-use), and a 3-phase migration plan.
**Tags:** #engine #decumulation #per-holding #sequencing #iht2027 #taxonomy #cgt #pensions
**Updated:** 2026-06-03

> **Stance (information / guidance / storage — NOT regulated advice).** Every classification below is a factual factor set the engine surfaces so a user can see how a number was derived. Output is "here is the tax/feature consequence of disposing X", never "sell X first" or "you should". The legacy / min-tax / draw-order outputs are the closest to a personal recommendation → gated by `sonuswealth-compliance` + `ifa-auditor` before ship. No product surfacing, no lead-gen, FCA boundary on every path.

---

## 1 — Problem

### What the current solver does (`src/engine/decumulation-solver.js`)
- `extractDecumulationContext` collapses everything into `ctx.pots = { pension, isa, gia, cash }` — four scalar aggregates. DB/annuity/state are at least partly stripped into a `secure` floor, but every DC scheme, every ISA, every GIA line and every cash account is summed into one number per bucket.
- `generateCandidatePaths` emits 4–5 fixed pot-order arrays (`gia-first`, `isa-first`, `pension-first`, `fill-band`, `goal-tuned`).
- `simulatePath` grows the 4 pots at one `ctx.growth`, funds the net target by bisection on total gross drawn, applies a single `giaGainFraction` (default 0.4) to ALL GIA disposals, PCLS at flat 25% capped by LSA, and an IHT/2027-flip + post-75 double-tax at the horizon.
- `buildNetwork` makes one node per non-zero pot + an income sink.

### What it must do
Move from **aggregate-and-sequence-by-tax** to **evaluate-each-holding-then-sequence**:
- **Per-holding, not per-bucket** — two £100k GIAs with £3k vs £60k embedded gain cost £0 vs ~£13.7k to realise; aggregation averages that away. Same for two "ISAs", two "cash" accounts, two legacy pensions.
- **Feature-aware** — respect per-holding charges (1–2% legacy AMC drag), guarantees (GAR ~9–11% ≈ 40% of fund value, DB, annuity), protected TFC (>25%, lost on transfer), GMP, MVR/exit penalties, relief-locks (EIS/SEIS 3yr, VCT 5yr), bond 5%/top-slicing, embedded CGT gain, FSCS £120k caps, cash ROLE (emergency/reserve/surplus), and illiquidity.
- **Evaluate-then-sequence** — classify and EXCLUDE non-drawable holdings (guaranteed income, annuitise-don't-draw, relief-locked, not-income) BEFORE any ordering; route specialist flags to an advice prompt; compute the secure-income floor first; only then sequence the genuine drawable residual.

### The specific gaps this closes
1. Aggregation to 4 pots erases per-holding cost/gain/guarantee/relief signal.
2. Per-holding **charges** ignored → can't say "drain the 1.8% legacy pot before the 0.15% SIPP".
3. **GAR** ignored → a pot worth ~40% more annuitised gets blended into drawdown and thrown away.
4. **Protected TFC** ignored → flat-25% PCLS understates tax-free cash and a "consolidate" suggestion silently destroys the protection.
5. **Embedded-gain / loss-harvest** ignored → one `giaGainFraction` for all GIA; no bed-&-ISA or loss-harvest candidate lists; no CGT-uplift-on-death lens.
6. **Relief-locks** ignored → EIS/SEIS/VCT can be "drawn" mid-clock, clawing back relief worth more than the disposal raises.
7. **£2.25m property + business + alternatives** never modelled as income or capital-unlock levers; rental/royalty/REIT/director-mix income streams missing.

---

## 2 — Draw-Classification Taxonomy

One enum across all categories. `DRAW-DOWN` · `GUARANTEED-INCOME-NOT-A-POT` · `ANNUITISE-DONT-DRAW` · `CONSOLIDATE-OR-DRAW-FIRST` · `RELIEF-LOCKED-DONT-SELL-EARLY` · `DRAW-WITH-CGT-MANAGEMENT` · `EMERGENCY-BUFFER` · `SEQUENCE-RISK-RESERVE` · `ILLIQUID-LAST-RESORT` · `NOT-INCOME` · `SPECIALIST-ADVICE-FLAG`. (Plus `DRAW-FIRST-LOW-RETURN`, `DRAW-LAST-TAX-FREE`, `DRAW-EARLY-CGT-EXEMPT` as ordering hints layered on top.)

**Table is 58 rows** mapping every income-relevant taxonomy ID to its classification. Conditional rows (one ID → different class by feature flag) are shown as a single row with the condition in the reason.

| Taxonomy ID | DRAW-CLASSIFICATION | One-line reason |
|---|---|---|
| **PENSIONS** | | |
| SIPP | DRAW-DOWN | DC pot; 25% PCLS / marginal; in estate from Apr 2027 |
| SSAS | DRAW-DOWN | DC; flag liquidity-constrained if property-dominated |
| WORKPLACE_DC | DRAW-DOWN | DC; check small-pot ≤£10k route first (avoids MPAA) |
| GPP | DRAW-DOWN | DC individual contract; no guarantees typically |
| MASTER_TRUST | DRAW-DOWN | DC; may need transfer to a drawdown-capable provider |
| STAKEHOLDER | DRAW-DOWN | Charge-capped DC; flexible |
| PERSONAL_PENSION | CONSOLIDATE-OR-DRAW-FIRST / ANNUITISE-DONT-DRAW (if GAR) | High-charge/with-profits → drain first; GAR present → annuitise |
| DC_DEFERRED | CONSOLIDATE-OR-DRAW-FIRST / ANNUITISE-DONT-DRAW / SPECIALIST | The "hidden gem" — high GAR/protected-TFC probability; branch on what's found |
| DB | GUARANTEED-INCOME-NOT-A-POT | CETV is a transfer price, not a balance; income floor |
| DB_CARE | GUARANTEED-INCOME-NOT-A-POT | CPI/RPI-revalued guaranteed income |
| DB_PUBLIC | GUARANTEED-INCOME-NOT-A-POT | Often unfunded/untransferable; income floor |
| DB_HYBRID | DB part = GUARANTEED-INCOME-NOT-A-POT; DC part = DRAW-DOWN | Split for modelling |
| RAC_S226 | ANNUITISE-DONT-DRAW (GAR) / SPECIALIST (protected TFC) | Pre-1988; frequently GAR + protected TFC ≠ 25% |
| SECTION_32 | SPECIALIST-ADVICE-FLAG | GMP underpin + safeguarded; >£30k advice-gated |
| QROPS | SPECIALIST-ADVICE-FLAG | Cross-border, Overseas Transfer Charge, jurisdiction rules |
| STATE | GUARANTEED-INCOME-NOT-A-POT | Triple-locked lifetime income; defines pre-STP bridge window |
| FAD | DRAW-DOWN | Already crystallised; MPAA already triggered |
| UFPLS | DRAW-DOWN | Lump-sum mode; 25%/75% per withdrawal; triggers MPAA |
| ANNUITY | GUARANTEED-INCOME-NOT-A-POT | Income stream; capital gone; irreversible |
| ANNUITY_ENHANCED | GUARANTEED-INCOME-NOT-A-POT | As annuity; income floor |
| **INVESTMENTS** | | |
| ISA_SS | DRAW-LAST-TAX-FREE (DRAW-DOWN) | Tax-free growth; but IHT/band-management can flip earlier |
| ISA_CASH | DRAW-DOWN (tax-free) | Tax-free; cheap liquid top-up; can serve EMERGENCY-BUFFER |
| LISA | DRAW-DOWN from 60 / SPECIALIST before 60 | 25% penalty if <60 & not first-home/terminal |
| IFISA | DRAW-DOWN if liquid / ILLIQUID-LAST-RESORT | P2P term-locked; not FSCS-protected |
| JISA_SS / JISA_CASH | NOT-INCOME | Child's asset, locked to 18 |
| HTB_ISA | SPECIALIST-ADVICE-FLAG | Purpose-locked bonus; 2029/30 claim deadline |
| GIA | DRAW-WITH-CGT-MANAGEMENT | Phase disposals to AEA; per-line embedded gain |
| EQUITIES | DRAW-WITH-CGT-MANAGEMENT | s104 pool; AIM may carry 50% BPR |
| GILTS | DRAW-EARLY-CGT-EXEMPT | Gain CGT-exempt; coupon taxable (PSA) |
| CORP_BONDS | DRAW-EARLY-CGT-EXEMPT if QCB / DRAW-WITH-CGT-MANAGEMENT | QCB flag flips treatment entirely |
| FUNDS (OEIC/UT) | DRAW-WITH-CGT-MANAGEMENT | Same GIA mechanics; acc vs inc units, equalisation |
| INV_TRUST | DRAW-WITH-CGT-MANAGEMENT | Discount/premium affects realisable value |
| ETF | DRAW-WITH-CGT-MANAGEMENT | Capture UK reporting status (non-reporting = income gain) |
| ETC_GOLD | DRAW-WITH-CGT-MANAGEMENT | Commodity ETC; no income; 18/24% |
| REIT | DRAW-WITH-CGT-MANAGEMENT (income-producing) | PID taxed as property income; liquid, sequence-able |
| STRUCTURED | SPECIALIST-ADVICE-FLAG | Maturity/barrier-locked; tax-wrapper-dependent |
| FX_INVEST | DRAW-WITH-CGT-MANAGEMENT | FX gain + CGT; £6k personal-use exemption |
| BOND_ON | SPECIALIST-ADVICE-FLAG | 5% allowance + top-slicing (since last event); 20% credit |
| BOND_OFF | SPECIALIST-ADVICE-FLAG | Gross roll-up, no credit; whole-life top-slicing |
| BOND_WP | SPECIALIST-ADVICE-FLAG | MVR on early surrender; 5%/top-slice |
| BOND_CR | SPECIALIST-ADVICE-FLAG | Chargeable-event regime; commonly in trust |
| EIS | RELIEF-LOCKED-DONT-SELL-EARLY | 3yr hold; early sale claws back 30% + crystallises deferred gain |
| SEIS | RELIEF-LOCKED-DONT-SELL-EARLY | 3yr hold; claws back 50% + reinvestment relief |
| VCT | RELIEF-LOCKED-DONT-SELL-EARLY (capital) / dividends drawable now tax-free | 5yr hold for income relief; dividends tax-free no min-hold |
| **PROPERTY** | | |
| RESIDENCE | NOT-INCOME (+ downsize / equity-release levers) | No yield; PRR-exempt sale; ER cash not taxable |
| SECOND_HOME | DRAW-WITH-CGT-MANAGEMENT (ILLIQUID) | No PRR; residential CGT 18/24%, 60-day report |
| OVERSEAS | DRAW-WITH-CGT-MANAGEMENT (ILLIQUID) | Worldwide gains taxable UK; local taxes/succession |
| BTL | INCOME-PRODUCING-KEEP / SELL-FOR-CAPITAL-WITH-CGT | Net rent (Section 24) vs irreversible CGT sale |
| HMO | INCOME-PRODUCING-KEEP / SELL-FOR-CAPITAL-WITH-CGT | As BTL, higher yield/compliance |
| HOLIDAY_LET | INCOME-PRODUCING-KEEP / SELL-FOR-CAPITAL-WITH-CGT | Ex-FHL: all reliefs abolished Apr 2025 |
| MIXED_USE | INCOME-PRODUCING-KEEP / SELL-FOR-CAPITAL | Apportioned CGT/SDLT; partial BPR if commercial trades |
| SHARED_OWNERSHIP | ILLIQUID-LAST-RESORT | Owned share only; staircasing dynamics |
| COMMERCIAL | INCOME-PRODUCING-KEEP / SELL-FOR-CAPITAL-WITH-CGT | Rent; BPR only if own trading premises |
| LAND (agricultural) | ILLIQUID-LAST-RESORT + RELIEF-LOCKED (APR) | APR-qualifying; selling forfeits relief |
| WOODLAND | ILLIQUID-LAST-RESORT + RELIEF-LOCKED (BPR) | Timber income CGT-exempt; 100% BPR after 2yr |
| DEVELOPMENT_LAND | SELL-FOR-CAPITAL-WITH-CGT (ILLIQUID) | Investor vs trader; no BPR likely |
| EQUITY_RELEASE | NOT-INCOME (capital-unlock note) | Borrowing, not a disposal; rolled-up interest; reduces estate |
| HOME_REVERSION | NOT-INCOME | Disposed % already left estate |
| **BUSINESS** | | |
| PSC_EQUITY | RELIEF-LOCKED-DONT-SELL-EARLY (+ director income mix) | BPR 100% to £2.5m; early sale = CGT now + 40% IHT on proceeds |
| LTD_INVESTMENT | SELL-FOR-CAPITAL-WITH-CGT | Investment co: no BADR, no BPR |
| SOLE_TRADER | RELIEF-LOCKED-DONT-SELL-EARLY / income while trading | BPR if trading; draw profit, don't liquidate early |
| PARTNERSHIP | RELIEF-LOCKED-DONT-SELL-EARLY | BPR on trading-partnership interest |
| LLP | RELIEF-LOCKED-DONT-SELL-EARLY / SELL-FOR-CAPITAL | BPR if trading |
| BPR_AIM | RELIEF-LOCKED-DONT-SELL-EARLY | 50% BPR from Apr 2026; effective 20% IHT |
| EOT | SELL-FOR-CAPITAL-WITH-CGT | 50% of gain CGT-chargeable post-Oct 2024 |
| IP_ASSET | INCOME-PRODUCING-KEEP (royalties) | Royalty stream the engine ignores today; decays |
| DLA (credit) | SELL-FOR-CAPITAL (draw first — cheapest cash) | Repayment of credit balance not taxable |
| EMI / CSOP / SAYE / SIP / RSU / UNAPPROVED_OPTIONS / GROWTH_SHARES | SELL-FOR-CAPITAL-WITH-CGT (event-driven) | Exercise/vest events, not a yield stream; relief clocks vary |
| **CASH** | | |
| CURRENT | EMERGENCY-BUFFER + DRAW-FIRST-LOW-RETURN | Working float; instant |
| SAVINGS (easy-access) | DRAW-FIRST-LOW-RETURN (host EMERGENCY-BUFFER) | Instant; surplus spent first in normal markets |
| NOTICE | SEQUENCE-RISK-RESERVE | Notice lag = not emergency-grade |
| REGULAR_SAVER | SEQUENCE-RISK-RESERVE / DRAW-FIRST | Withdrawal-restricted; model the cap |
| FIXED (fixed-rate bond) | SEQUENCE-RISK-RESERVE | Break penalty (60–180d interest) gates early draw |
| ISA_CASH (cash ISA) | DRAW-LATER-AMONG-CASH (tax-free shelter) | Spend taxable cash first; preserve tax-free |
| PREMIUM_BONDS | DRAW-FIRST-LOW-RETURN | Prizes tax-free; lumpy; NS&I no FSCS cap |
| NSI_INCOME | DRAW-FIRST-LOW-RETURN / large-balance EMERGENCY-BUFFER | Treasury-backed, no £120k cap |
| NSI_INDEX | SEQUENCE-RISK-RESERVE | RPI-linked; held to maturity |
| FX_ACCOUNT | ILLIQUID-LAST-RESORT (income) | FX + CGT friction; not a clean income source |
| OFFSHORE_CASH | DRAW-WITH-CGT-MANAGEMENT (interest) | Worldwide interest taxable; no UK protection |
| CHILDREN_SAVINGS | NOT-INCOME | Not the holder's to draw |
| MMF (money-market fund) | SEQUENCE-RISK-RESERVE | T+1 settle; NOT FSCS-protected; not emergency-grade |
| **ALTERNATIVES** | | |
| CRYPTO | SELL-FOR-CAPITAL-WITH-CGT (majors) / ILLIQUID (alts) | s104 pooling; majors sequence-able |
| GOLD | SELL-FOR-CAPITAL (coins CGT-exempt) / CGT (bars) | UK legal-tender coins exempt; bars 18/24% |
| ART / WINE / JEWELLERY / COLLECTIBLE | ILLIQUID-LAST-RESORT | Non-wasting chattels; £6k rule; slow, wide-spread sale |
| CLASSIC_CARS | ILLIQUID-LAST-RESORT (CGT-exempt wasting asset) | Tax-free to sell but still illiquid |
| PE | ILLIQUID-LAST-RESORT | No market; valuations are estimates |
| P2P | INCOME-PRODUCING-KEEP (term-locked) | Interest; not instantly liquid; not FSCS |
| CROWDFUNDING | ILLIQUID-LAST-RESORT / SPECIALIST (relief check) | Start-up risk; SEIS/EIS status changes everything |
| FORESTRY | ILLIQUID-LAST-RESORT + RELIEF-LOCKED (BPR) | Timber income exempt; BPR after 2yr |
| **SECURE INCOME (non-pension cross-ref)** | | |
| Purchased-life annuity (PLA) | GUARANTEED-INCOME-NOT-A-POT | Capital element tax-free, only interest taxed |
| Rental income (stream) | GUARANTEED-INCOME-NOT-A-POT (floor layer) | Property income; depleted only if property sold |

*(Protection products — LIFE, CI, IP, PMI etc. — are NOT-INCOME for decumulation; they pay on event/death, not as drawdown, so they are excluded from the sequenceable set by construction and omitted from the table above except where noted.)*

---

## 3 — Proposed Per-Holding Data Model

Union of the "engine must capture" fields across all four files, grouped by category. TypeScript-ish; these are the attributes the **persona fixtures** and the **engine** must carry per holding (today they hold one scalar per bucket).

```ts
// Shared base — every holding
interface HoldingBase {
  id: string
  taxonomyId: string            // SIPP | ISA_SS | GIA | BTL | PSC_EQUITY | SAVINGS | CRYPTO ...
  category: 'pensions'|'investments'|'property'|'business'|'cash'|'alternatives'
  provider?: string
  currentValue: number          // OR null for DB/state/annuity (not a balance)
  isPot: boolean                // false => guaranteed income, exclude from drawable set
  drawClassification?: string   // DERIVED, not stored (see §4)
  liquidityDays?: number        // est. time-to-cash
  disposalCostPct?: number
  estateTreatment: 'in' | 'outside' | 'from-2027'
  flaggedNonSpendable?: boolean // user lock (e.g. "never sell the home")
  methodologyBlock?: object     // rule applied + source URL + status + plain-English formula
}

interface PensionScheme extends HoldingBase {
  // guaranteed income (DB / state / annuity)
  guaranteedAnnual?: number
  inflationLinked?: 'CPI'|'RPI'|'fixed'|'none'
  survivorPct?: number; guaranteePeriodYears?: number
  isSafeguarded?: boolean       // DB, GAR, GMP => true
  cetv?: number                 // DB transfer price (NOT spendable)
  // charges
  amc?: number; ocf?: number; platformFee?: number; exitPenaltyPct?: number; adviceFeePct?: number
  // guarantees on DC/legacy pots
  gar?: boolean; garRate?: number
  protectedTfcPct?: number; protectedTfcType?: 'SSPTFC'|'primary'|'enhanced'  // null => standard 25%
  withProfits?: boolean; mvrApplies?: boolean; mvrFreeDate?: string; guaranteedBonus?: boolean
  gmp?: boolean; gmpAge?: number
  // access / status
  crystallised?: boolean; pclsTakenSoFar?: number; mpaaTriggered?: boolean
  smallPotEligible?: boolean    // value <= 10000
  protectedPensionAge?: number; normalRetirementDate?: string
  lsaUsedSoFar?: number         // counts toward £268,275
}

interface InvestmentHolding extends HoldingBase {
  wrapperClass: 'ISA_FAMILY'|'UNWRAPPED'|'VENTURE_RELIEF'|'INSURANCE_BOND'|'FIXED_INCOME'|'STRUCTURED'
  // CGT / cost-base (unwrapped + venture)
  bookCost?: number; acquisitionDate?: string
  embeddedGainPct?: number      // (currentValue - bookCost)/currentValue
  unrealisedLossFlag?: boolean  // harvest candidate
  s104Pool?: object
  // income character
  dividendYield?: number; interestBearing?: boolean
  reportingStatus?: 'UK-reporting'|'non-reporting'  // ETF/offshore fund income-gain risk
  isQcb?: boolean
  // ISA family
  isaFlexible?: boolean; lisaAccessAge?: number; lisaQualifyingPurpose?: string
  childDob?: string; holdsAimBpr?: boolean
  // venture reliefs
  reliefHoldingEndDate?: string // 3yr EIS/SEIS, 5yr VCT — DON'T-TOUCH gate
  incomeReliefClaimed?: number; incomeReliefRate?: number
  deferredGainParked?: number; cgtReinvestReliefClaimed?: number
  // insurance bonds
  bondLocation?: 'ONSHORE'|'OFFSHORE'; premiumPaid?: number; bondSegments?: number
  cumulative5pctUsed?: number; yearsInForce?: number; lastChargeableEvent?: string
  nonResidentYears?: number; livesAssured?: number
  // structured
  structureType?: 'deposit'|'note'; maturityDate?: string; autocallDates?: string[]
  barrierLevel?: number; taxTreatment?: 'income'|'cgt'
}

interface PropertyHolding extends HoldingBase {
  acquisitionValue?: number; acquisitionDate?: string; ownershipYears?: number
  isMainResidence?: boolean; prrEligible?: boolean; prrApportionmentPct?: number
  rentalGrossAnnual?: number; rentalNetAnnual?: number
  mortgageOutstanding?: number; mortgageInterestAnnual?: number
  section24Applies?: boolean     // false if held in LTD
  voidAssumptionPct?: number; managementCostPct?: number
  isFHLLegacy?: boolean
  equityReleaseEligible?: boolean; downsizeTargetValue?: number
}

interface BusinessHolding extends HoldingBase {
  legalForm?: 'sole'|'partnership'|'ltd'|'llp'
  isTradingBusiness?: boolean    // >50% trading test
  bprQualifying?: boolean; bprQualifyingValue?: number
  badrEligible?: boolean; badrLifetimeUsed?: number
  directorSalary?: number; dividendsTaken?: number; pensionEmployerContribution?: number
  directorsLoanBalance?: number  // signed: credit (+) vs overdrawn (-)
  shareholdingPct?: number
  royaltyAnnualIncome?: number; royaltyDecayRate?: number
}

interface CashSecureHolding extends HoldingBase {
  balance: number; ccy?: string
  rate?: number; rateType?: 'fixed'|'variable'|'prize'
  access?: { kind: 'instant'|'notice'|'fixedTerm'; noticeDays?: number; termEnd?: string;
             breakPenaltyDays?: number; earlyAccessAllowed?: boolean }
  taxWrapper?: 'none'|'cashISA'|'sippCashLeg'|'giaCashLeg'
  protection?: { scheme: 'FSCS'|'NSI_TREASURY'|'NONE'; licenceId?: string; capped?: boolean }
  roleHint?: 'EMERGENCY-BUFFER'|'SEQUENCE-RISK-RESERVE'|'DRAW-FIRST-LOW-RETURN'
}

interface SecureIncomeStream {              // never enters the sequence
  streamType: 'state'|'DB'|'lifetimeAnnuity'|'PLA'|'rental'
  grossAnnual: number
  taxTreatment: 'fullyTaxable'|'capitalElementExempt'|'propertyIncome'
  startAge?: number; inPayment?: boolean
  escalation?: 'tripleLock'|'CPI'|'RPI'|'level'
  survivorPct?: number
  flaggedNonSpendable: true
  cetv?: number                            // DB context only, never sequenced
}

// Cross-cutting CGT/IHT (any holding)
interface TaxLens {
  estateInclusionValue?: number
  cgtUnrealisedGain?: number               // currentValue - acquisitionValue
  cgtRateBand?: 18 | 24
  reliefAtRisk?: ('PRR'|'BPR'|'APR'|'BADR'|'GAR'|'protectedTFC')[]
}
```

---

## 4 — Evaluation / Exclusion Pass (pre-sequencing)

A deterministic pre-pass that runs BEFORE candidate-path generation. Replaces the implicit "everything that isn't DB is a drawable pot" of the current `extractDecumulationContext`.

```
function evaluateHoldings(holdings, opts):
  secureIncome = []; excluded = []; specialist = []; sequenceable = []
  for h in holdings:
    cls = classify(h)                         // derive DRAW-CLASSIFICATION
    switch cls:
      GUARANTEED-INCOME-NOT-A-POT,
      ANNUITISE-DONT-DRAW            -> secureIncome.push(streamFrom(h)); continue
      RELIEF-LOCKED-DONT-SELL-EARLY:
         if h.reliefHoldingEndDate > now -> excluded.push(h, 'relief clock running'); continue
         else                            -> sequenceable.push(h)   // clock expired, now efficient
      NOT-INCOME                     -> excluded.push(h, 'not a drawdown source'); continue
      SPECIALIST-ADVICE-FLAG         -> specialist.push(h); excluded.push(h, 'specialist'); continue
      EMERGENCY-BUFFER               -> reserve.emergency.push(h); continue  // never drawn for income
      SEQUENCE-RISK-RESERVE          -> reserve.sequence.push(h)             // conditional (down-market)
      default (DRAW-DOWN,
        DRAW-WITH-CGT-MANAGEMENT,
        DRAW-FIRST-LOW-RETURN, ...)  -> sequenceable.push(h)
    if h.flaggedNonSpendable -> excluded.push(h, 'user lock')

  // classify() derivation (pensions example; extends per category)
  if !h.isPot                                   -> GUARANTEED-INCOME-NOT-A-POT
  elif h.gar                                    -> ANNUITISE-DONT-DRAW
  elif h.gmp || h.protectedTfcPct>0.25
        || (h.isSafeguarded && h.cetv>30000)    -> SPECIALIST-ADVICE-FLAG
  elif h.reliefHoldingEndDate > now             -> RELIEF-LOCKED-DONT-SELL-EARLY
  elif h.amc high && noGuarantee
        && exitCost < chargeSaving              -> CONSOLIDATE-OR-DRAW-FIRST
  elif wrapper==UNWRAPPED                       -> DRAW-WITH-CGT-MANAGEMENT
  else                                          -> DRAW-DOWN

  // Secure-income floor (Step 3 input)
  netFloorIncome = Σ net(secureIncome[].grossAnnual, by taxTreatment)
  return { secureIncome, excluded, specialist, reserve, sequenceable, netFloorIncome }
```

- Excluded GUARANTEED + ANNUITISE + RELIEF-LOCKED + NOT-INCOME are shown but never ordered.
- SPECIALIST holdings (GMP, protected-TFC, bonds, QROPS, structured, GAR-decision) route to an **advice-prompt surface** ("this holding has features that need a qualified adviser to value — here's why"), FCA-safe, no recommendation.
- `netFloorIncome` is computed here and handed to Step 3.

---

## 5 — Goal-Weighted Sequencing Algorithm (7 steps)

The doctrine from file 4b as engine pseudo-logic. Goals enter at Step 5; the 2027-IHT overlay at Step 7.

```
// STEP 1 — Exclude guaranteed & non-spendable (done in §4 evaluateHoldings)
{ secureIncome, excluded, specialist, reserve, sequenceable, netFloorIncome } = evaluateHoldings(...)
// also remove pre-access-age pensions (cannot draw before 55, rising to 57 from 6 Apr 2028)

// STEP 2 — Classify every sequenceable holding by feature
for h in sequenceable:
  tag(h, { wrapper, taxOnWithdrawal, liquidityPenalty, embeddedGain, returnVol, protection, cashRole })
  // two "ISAs" / two "cash" / two GIA lines can now sequence differently

// STEP 3 — Cover the essentials floor from secure income FIRST
residualNeed = max(0, requiredIncome - netFloorIncome)
if netFloorIncome >= essentials: portfolio funds discretionary only (more freedom)
else: shortfall is a HARD goal -> consider securing (annuity/floor) before flexing  // PenFund/FlexFund split
// only residualNeed is sequenced

// STEP 4 — Set the cash buffer / bucket structure (sequence-of-returns defence)
buffer = 1..3yr of residualNeed from reserve (EMERGENCY-BUFFER + SEQUENCE-RISK-RESERVE)
// market-state branch (the dynamic bit):
//   NORMAL/up year -> draw per Step-6 tax-band order
//   DOWN year      -> draw from buffer / Bucket-1 INSTEAD of selling depressed equities; refill in strong years
//   tax-free sources (ISA, PCLS) also serve as down-market draw w/o adding taxable income

// STEP 5 — Apply the goal-weighted ordering objective (GOALS ENTER HERE)
baseOrder = switch goalSpec.primary:
  income_floor / never_run_out   -> secure floor; draw lowest-volatility first; conservative SWR
  min_lifetime_tax               -> band-fill (Step 6); spread taxable pension; time PCLS; gift surplus
  max_lifetime_spend             -> dynamic/guardrail SWR; GIA-first to kill tax drag; higher draw
  greatest_net_return            -> deplete GIA first (highest tax drag), then ISA/pension
  legacy / max_after_iht_estate  -> Step 7 overlay (pension may go FIRST)
// per-holding within a bucket: CONSOLIDATE-OR-DRAW-FIRST (high-charge) before low-charge;
// DRAW-WITH-CGT-MANAGEMENT lines ordered by embedded-gain ascending (low-gain first, harvest losses)

// STEP 6 — Fill tax bands each year (within the goal order)
1. use personal allowance (£PA) with taxable pension — esp. pre-STP bridge years
2. fill basic-rate band (to £BRT) with pension; STOP before higher rate
3. top up rest from tax-free sources (ISA, 25% PCLS) so total stays under next band
4. use starting-rate-for-savings (£5k, tapered) + PSA for cash interest where unused
5. phase the PCLS (don't take 25% in one lump)
6. watch cliff edges: £100k PA taper, £60k HICBC, additional-rate £125,140

// STEP 7 — Post-2027 IHT overlay (can REVERSE Step 5/6) — IHT OVERLAY ENTERS HERE
if (deathYear >= 2027) && estate IHT-exposed && goal in {legacy, min_lifetime_tax}:
  // unused DC pension now in estate -> IHT 40% + beneficiary income tax (>60% combined post-75)
  flip: draw pension DURING lifetime within basic-rate band; take 25% PCLS;
        recycle net into ISA or gift-from-surplus-income; preserve ISA/wrapper-transferable
else (non-IHT-exposed or pre-2027): classic ISA-before-pension order stands
```

Withdrawal-RATE methods (Bengen / Guyton-Klinger / Vanguard-dynamic / Bucket / floor+guardrail) are **orthogonal** — they set HOW MUCH, this sets WHERE FROM; the goal selects both. Output: 2–4 comparable selectable paths, each with `schedule[]`, `scoreBreakdown`, `rationale[]`, `methodology`.

---

## 6 — Network-Diagram Impact

Today `buildNetwork` emits 4 pot nodes + an income sink. The per-holding model feeds a **drillable two-level diagram**:

- **Type-level summary nodes** (top layer) — one node per taxonomy *type present* (e.g. "SIPP", "GIA", "BTL", "Easy-access savings"), value = sum of its holdings, classification badge. macOS principle: simple surface, depth on tap.
- **Drill to per-holding** — tapping a type node expands to its individual holdings (each with embedded-gain %, charge, relief clock, FSCS headroom). This is where the per-line `estimatedDisposalTax`, bed-&-ISA candidates, loss-harvest candidates and relief-locks become visible.
- **SECURE-INCOME node** — a distinct node fed by State Pension + DB + annuity + PLA + rental, flowing INTO the income sink as the floor. It is NOT a source you can deplete; rendered as a guaranteed inflow that shrinks `residualNeed`. Visually separates "floor income" from "portfolio draw".
- **Excluded / flagged holdings shown but marked not-drawn** — relief-locked (with a countdown to `reliefHoldingEndDate`), illiquid-last-resort, specialist-advice-flagged, and user-locked holdings appear in the diagram greyed / dashed with a reason chip ("relief clock: 14 months", "needs adviser: GMP", "illiquid"), so the user sees the whole balance sheet, not just the drawable slice.
- **Edges** carry draw order + per-line `taxCost` (currently `null`), and `alternatives` carry the other ranked paths for branching.

---

## 7 — Rule-Currency Corrections (VERIFY BEFORE IMPLEMENTING)

The researchers flagged these 2026/27 figures. **NONE are to be hardcoded.** Every calculation reads the live value from `rules-uk.js` / the `TAX` bundle (`src/engine/fq-calculator.js`) per memory `feedback_always_check_rules_uk.md` + `accuracy-auditor` skill. This table is a *change-watch list*, not a source of constants.

| Rule | Stated 2026/27 value | File STATUS | Verify-before-implementing |
|---|---|---|---|
| CGT AEA | £3,000 | ENACTED | VERIFY vs TAX bundle `cgaAllowance` |
| CGT rates (non-property + residential) | 18% / 24% | ENACTED | VERIFY vs `cgtBasic`/`cgtHigher` |
| Dividend allowance | £500 | ENACTED | VERIFY vs TAX bundle |
| Dividend rates (+2pp from 6 Apr 2026) | 10.75% / 35.75% / 39.35% | ENACTED | VERIFY — basic & higher rose 2pp; do not reuse 8.75/33.75 |
| PSA | £1,000 / £500 / £0 | ENACTED | VERIFY vs bundle |
| Starting rate for savings | £5,000 band, tapered, frozen to 2030/31 | ENACTED | VERIFY freeze + taper logic |
| ISA allowance | £20,000 (cash sub-cap from Apr 2026) | ENACTED | VERIFY sub-cap detail |
| LISA withdrawal charge | 25% (≈6.25% own-money loss) | ENACTED | VERIFY |
| VCT income relief | 20% from 6 Apr 2026 (was 30%), 5yr hold | ENACTED — CHANGED 2026 | VERIFY — do not reuse 30% |
| EIS / SEIS income relief | 30% / 50%, 3yr hold | ENACTED | VERIFY hold periods + clawback |
| AIM-BPR / unlisted | 50% from 6 Apr 2026 (was 100%) → eff. 20% IHT | ENACTED — CHANGED 2026 | VERIFY — do not reuse 100% |
| BPR/APR 100% relief cap | £2,500,000 combined (£5m spousal) | ANNOUNCED (23 Dec 2025; was £1m) | VERIFY final Finance-Act drafting; any £1m source is stale |
| BADR rate | 18% | ENACTED | VERIFY — do not cite 10% or 14% for 2026/27 |
| BADR lifetime limit | £1,000,000 | ENACTED | VERIFY |
| S455 directors'-loan charge | 35.75% (loans on/after 6 Apr 2026) | ENACTED | VERIFY — pre-Apr-2026 loans stay 33.75% |
| Section 24 BTL interest | 20% credit only (individuals); LTD deducts 100% | ENACTED | VERIFY |
| FHL regime | ABOLISHED 6 Apr 2025 | ENACTED | VERIFY no BADR/rollover applied to ex-FHL |
| MPAA | £10,000 | ENACTED | VERIFY vs bundle |
| LSA (PCLS cap) | £268,275 | ENACTED | VERIFY vs `TAX.lsa` |
| Pensions in IHT estate | from 6 Apr 2027 (spouse/charity exempt) | ENACTED (FA 2026) | VERIFY date-gate + exemptions; admin mechanics still settling |
| NMPA → 57 | from 6 Apr 2028 (protected pension age) | ENACTED | VERIFY pre-access-age exclusion |
| Full new State Pension | £241.30/wk = £12,548/yr; triple-lock +4.8% | ENACTED | VERIFY vs `statePensionFull` |
| FSCS deposit protection | £120,000 per licence (from 1 Dec 2025) | ENACTED — CORRECTS prior £85k | VERIFY — taxonomy prose still says £85k (M01/M02) |
| Safeguarded-benefit advice threshold | >£30,000 (DB/GAR/GMP) | ENACTED (FG21/3) | VERIFY |
| Gilts / QCBs | CGT-EXEMPT | ENACTED | VERIFY QCB flag handling |
| Bond gains rate change | 22%/42%/47% + 22% onshore credit from 6 Apr 2027 | ENACTED (future-effective) | VERIFY date-gate; NOT live in 26/27 |
| Chattels exemption | £6,000 (marginal relief to £15k) | ENACTED | VERIFY |
| Premium Bonds prize rate | 3.30% → 3.80% (Jul 2026) | ENACTED | Indicative, read live; not rule-grade |
| QROPS Overseas Transfer Charge | 25% (EEA scope tightened Budget 2024) | ESTIMATED (file 1 could not re-verify) | VERIFY current HMRC scope before relying |
| State pension deferral uplift | ~1%/9wk (≈5.8%/yr) | ESTIMATED (file 1 could not verify) | VERIFY vs GOV.UK before use |
| Optimal director salary | £5,000 / £12,570 (£6,708 LEL) | ESTIMATED | Behavioural, not statutory — VERIFY thresholds |

---

## 8 — Migration Impact

### `src/engine/decumulation-solver.js`
- **`extractDecumulationContext`** — biggest change. Stop collapsing to `ctx.pots = {pension,isa,gia,cash}`. Build `ctx.holdings[]` (per-holding records, §3) + run `evaluateHoldings` (§4) to produce `secureIncome`, `excluded`, `specialist`, `reserve`, `sequenceable`, `netFloorIncome`. Keep a derived 4-pot view as a *compat shim* during P1 so existing tests pass.
- **`generateCandidatePaths`** — orders become per-holding-aware lists (or a comparator), not 4-element pot arrays. Goal mapping (Step 5) preserved; per-holding tie-breakers (charge, embedded-gain, cash role) added.
- **`simulatePath`** — per-holding growth (not one `ctx.growth`), per-line CGT (not one `giaGainFraction`), relief-lock exclusion, cash-role + market-state branch, bond 5%/top-slicing, protected-TFC ≠ flat 25%. The bisection-on-net-target core can stay.
- **`buildNetwork`** — two-level (type → holding) + SECURE-INCOME node + excluded/flagged nodes (§6).

### Persona fixture data model
- Fixtures currently store bucket scalars (`a.sipp.total`, `a.isa.value`, `a.gia.value`, `a.cash.total`). Must carry **per-holding arrays** with the §3 fields. Mr T (memory: holds HMO/overseas/second-home, business £3.2M, EIS/SEIS/VCT) is the stress fixture — needs GAR/protected-TFC/relief-clock/embedded-gain/charge fields populated to exercise every branch. The £2.25m property + business income streams must be modelled, not dropped.

### Existing node tests (`decumulation-solver.mjs`, 67 tests)
- Tests asserting `ctx.pots` shape, 4-element order arrays, single `giaGainFraction`, and `buildNetwork` 4-node output **will need updating**. Keep the compat shim in P1 so the suite stays green while the new path lands behind it; migrate assertions in P2/P3. New tests: classification table coverage, exclusion-pass correctness, floor computation, per-line CGT, relief-lock gating, secure-income node.

### Phasing
- **P1 — data model + eval/exclusion pass.** Add §3 per-holding records + §4 `evaluateHoldings` (classify, exclude, compute `netFloorIncome`). Compat shim derives the old 4-pot view → 67 tests stay green. Add classification + exclusion tests.
- **P2 — per-holding sequencing.** Rewrite `generateCandidatePaths`/`simulatePath` for per-holding growth, per-line CGT, relief-locks, cash roles + market-state branch, bond/protected-TFC mechanics. Migrate fixture data + the affected tests.
- **P3 — network drill-down + secure node.** Two-level drillable diagram, SECURE-INCOME node, excluded/flagged-but-shown holdings, per-edge tax cost. Wire to MyMoney/Cashflow/Timeline surfaces.

---

## 9 — Open Decisions for Founder

1. **Per-asset-class growth defaults (decision "B").** Today one `ctx.growth` (5%). Per-holding lets each asset class carry its own default (cash ~4%, equities ~5–7%, property ~3%). Adopt class-based defaults, or keep a single rate until real per-holding rates exist? (Affects how much fixture data is mandatory.)
2. **Persona data granularity.** How deep must fixtures go? Full §3 fields per holding is a large data lift. Minimum viable = `taxonomyId` + value + the 2–3 fields that drive the classification (gar, protectedTfcPct, reliefHoldingEndDate, embeddedGainPct, amc). Mandate the full model, or a tiered "required-for-classification" subset with graceful degradation?
3. **Flag-and-exclude vs model.** For GAR, DB-income, GMP, protected-TFC, structured products: flag-and-exclude to a SPECIALIST advice prompt (safe, simple), or attempt to MODEL them (e.g. estimate GAR annuitised income, DB net income)? File 1 leans flag-and-exclude for GAR/GMP/protected-TFC; DB income IS modelled as a floor. Confirm the line.
4. **Cash buffer sizing.** 1yr / 2yr / 3yr of `residualNeed`? Half of UK advisers use 1–2yr; T. Rowe Price models 2–3yr. Pick a default + make it editable, or infer from the goal (income_floor → larger)?
5. **Market-state branch input.** The dynamic down-market draw needs a "market state" signal. Deterministic illustration (alternate good/bad years), user-toggle ("show a down-market year"), or omit until P3? Affects honesty labelling.
6. **2027-IHT overlay default.** Apply the pension-first flip automatically for IHT-exposed legacy/min-tax goals, or always show BOTH orders side-by-side and let the user compare (more FCA-safe, less prescriptive)? File 4b + compliance lean toward present-both.
7. **Illiquid/relief-locked in the sequence.** Show illiquid-last-resort and relief-locked holdings as a *late capital-raise option* in the path, or keep them purely excluded-and-displayed until the user explicitly opts in? (Avoids implying a steer to sell the business/home.)
