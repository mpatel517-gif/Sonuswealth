// ─────────────────────────────────────────────────────────────────────────────
// Sonuswealth Decision Engine — pure functions, no side effects
// Exports: simulateAction, enumeratePaths, generateRecommendation
// ─────────────────────────────────────────────────────────────────────────────

import {
  netWorth, calcFQ, calcRisk, TAX, fmt,
  te_ihtExposure, allowanceTracker, monthlySurplus,
  calcAge,
} from './fq-calculator.js'

const FCA_BOUNDARY = 'Information and guidance only. Not personal advice — verify with a qualified FCA-authorised adviser before acting.'

// ── Helpers ──────────────────────────────────────────────────────────────────

function _nw(entity)  { try { return netWorth(entity) }    catch { return 0 } }
function _fq(entity)  { try { return calcFQ(entity).total } catch { return 0 } }
function _risk(entity){ try { return calcRisk(entity).total } catch { return 0 } }
function _iht(entity) {
  try { return te_ihtExposure(entity).chargeableEstate * TAX.ihtRate } catch { return 0 }
}
function _age(entity)  { return entity?.individual?.age || entity?.age || 0 }

function _annualIncome(entity) {
  const inc = entity?.income
  if (!inc) return entity?.targetIncome || 50000
  return (inc.salary || 0) + (inc.selfEmployed || 0) + (inc.rental || 0) +
         (inc.dividends || 0) + (inc.other || 0)
}

// ── Per-path factors ──────────────────────────────────────────────────────────
// simulateAction computes ONE headline impact per decision (the main action vs the
// status quo). Each enumerated path is a *variant* of that action — so without a
// per-path factor every candidate echoed the identical net-worth / IHT / certainty
// (founder 2026-06-06: "on my money tab the decisions all the values are the same").
// This table scales the headline by path: status-quo paths → ~0 change, the fuller
// action → full impact, partials in between, and certainty tracks the path's risk.
// Factors are RELATIVE first-pass directional modelling; bespoke absolute per-path
// tax math (APS, MPAA/LSA phasing, 2027 IHT flip) is Phase B.
const _PATH_FACTORS = {
  'DE-01': { lump: { nw: 0.15, conf: 'MED' }, phased: { nw: 1, conf: 'MED' }, defer: { nw: 1.3, iht: 1, conf: 'LOW' } },
  'DE-02': { buy_now: { nw: 0.1, conf: 'MED' }, defer_5: { nw: 1, conf: 'MED' }, drawdown: { nw: 0.7, conf: 'LOW' } },
  'DE-03': { no_change: { nw: 0, iht: 0, fq: 0, conf: 'HIGH' }, top_up: { nw: 1, iht: 1, conf: 'MED' }, carryback: { nw: 1.5, iht: 1.4, conf: 'LOW' } },
  'DE-04': { workplace_only: { nw: 0.8, iht: 0.6, conf: 'MED' }, split: { nw: 1, iht: 1, conf: 'MED' }, sipp_only: { nw: 0.5, iht: 1, conf: 'HIGH' } },
  'DE-05': { no_sacrifice: { nw: 0, iht: 0, fq: 0, conf: 'HIGH' }, partial: { nw: 1, iht: 1, conf: 'MED' }, maximum: { nw: 1.8, iht: 1.6, conf: 'MED' } },
  'DE-06': { cash_isa: { nw: 0.1, conf: 'HIGH' }, ss_isa: { nw: 1, conf: 'MED' }, lisa: { nw: 1.15, conf: 'MED' }, split_blend: { nw: 0.7, conf: 'MED' } },
  'DE-07': { hold_gia: { nw: 0, fq: 0, conf: 'HIGH' }, bed_isa: { nw: 1, conf: 'HIGH' }, phased_bed: { nw: 0.9, conf: 'MED' } },
  'DE-08': { overpay: { nw: 0.5, conf: 'HIGH' }, offset: { nw: 0.45, conf: 'HIGH' }, invest: { nw: 1, conf: 'LOW' }, split: { nw: 0.75, conf: 'MED' } },
  'DE-09': { keep_use: { nw: 0, iht: 0, conf: 'MED' }, let: { nw: 0.4, iht: 0, conf: 'MED' }, sell_isa_pension: { nw: 1, iht: 1, conf: 'MED' }, sell_btl_replace: { nw: 0.6, iht: 0.5, conf: 'MED' } },
  'DE-10': { fix_2yr: { nw: 0.9, conf: 'MED' }, fix_5yr: { nw: 1, conf: 'HIGH' }, tracker: { nw: 0.7, conf: 'LOW' }, offset_re: { nw: 0.8, conf: 'MED' } },
  'DE-11': { hold_btl: { nw: 1, conf: 'MED' }, incorporate: { nw: 0.3, conf: 'MED' }, sell_btl: { nw: 0, conf: 'HIGH' } },
  'DE-12': { no_release: { nw: 0, iht: 0, conf: 'HIGH' }, drawdown_er: { nw: 0.5, iht: 0.4, conf: 'MED' }, lump_er: { nw: 1, iht: 1, conf: 'LOW' } },
  'DE-13': { current_acct: { nw: 0, fq: 0, conf: 'HIGH' }, easy_access: { nw: 1, conf: 'HIGH' }, premium_bond: { nw: 0.95, conf: 'HIGH' } },
  'DE-14': { instant_only: { nw: 0, conf: 'HIGH' }, ladder_3: { nw: 0.5, conf: 'HIGH' }, ladder_12: { nw: 1, conf: 'HIGH' } },
  'DE-15': { annual_exempt: { iht: 0.1, conf: 'HIGH' }, pet_gift: { iht: 1, conf: 'MED' }, trust_gift: { iht: 1, conf: 'LOW' } },
  'DE-16': { bare_trust: { iht: 1, conf: 'HIGH' }, disc_trust: { iht: 0.6, conf: 'MED' }, iip_trust: { iht: 0.7, conf: 'MED' } }, // bare=outright PET (full removal after 7yr) beats discretionary=CLT (20% entry charge + periodic) on net IHT relief — was inverted
  'DE-17': { simple_will: { nw: 0.9, conf: 'MED' }, mirror_will: { nw: 0.95, conf: 'MED' }, li_trust_will: { nw: 1, iht: 1, conf: 'HIGH' } },
  'DE-18': { no_lpa: { nw: 0, conf: 'HIGH' }, fin_lpa: { nw: 0.7, conf: 'MED' }, both_lpas: { nw: 1, conf: 'HIGH' } },
  'DE-19': { term: { nw: 0.8, conf: 'MED' }, fib: { nw: 0.9, conf: 'MED' }, wol_trust: { nw: 1, iht: 1, conf: 'LOW' } },
  'DE-20': { no_ci: { nw: 0, conf: 'HIGH' }, top_up_ci: { nw: 0.6, conf: 'MED' }, full_ci: { nw: 1, conf: 'LOW' } },
  'DE-21': { any_occ: { nw: 0.5, conf: 'MED' }, own_occ: { nw: 1, conf: 'HIGH' }, budget_ip: { nw: 0.7, conf: 'MED' } },
  'DE-22': { no_harvest: { nw: 0, conf: 'HIGH' }, harvest_now: { nw: 1, conf: 'HIGH' }, harvest_isa: { nw: 1.1, conf: 'HIGH' } },
  'DE-23': { hold_loss: { nw: 0, conf: 'MED' }, realise_loss: { nw: 1, conf: 'HIGH' }, rebuy_isa: { nw: 1.1, conf: 'HIGH' } },
  'DE-24': { no_transfer: { nw: 0, conf: 'HIGH' }, asset_xfer: { nw: 1, conf: 'HIGH' }, isa_max: { nw: 0.8, conf: 'HIGH' } },
  'DE-25': { salary_only: { nw: 0, conf: 'MED' }, optimal_mix: { nw: 1, conf: 'HIGH' }, pension_route: { nw: 1.1, iht: 1, conf: 'MED' } },
  'DE-26': { no_eis: { nw: 0, conf: 'HIGH' }, seis: { nw: 1.1, conf: 'LOW' }, eis: { nw: 1, conf: 'LOW' } },
  'DE-27': { no_vct: { nw: 0, conf: 'HIGH' }, vct_5k: { nw: 0.3, conf: 'MED' }, vct_max: { nw: 1, conf: 'LOW' } },
  'DE-28': { no_bpr: { nw: 0, iht: 0, conf: 'MED' }, bpr_aim: { nw: 1, iht: 1, conf: 'LOW' }, bpr_unlisted: { nw: 0.9, iht: 1, conf: 'MED' } },
  'DE-29': { no_give: { nw: 0, iht: 0, conf: 'MED' }, gift_aid: { nw: 0.5, conf: 'HIGH' }, legacy: { iht: 1, conf: 'HIGH' } },
  'DE-30': { no_plan: { nw: 0, conf: 'MED' }, jisa: { nw: 1, conf: 'MED' }, bare_trust_edu: { nw: 0.8, conf: 'MED' } },
  'DE-31': { work_through: { nw: 0, conf: 'HIGH' }, short_break: { nw: 0.5, conf: 'MED' }, full_sabbat: { nw: 1, conf: 'LOW' } },
  'DE-32': { cash_hold: { nw: 0, iht: 0, conf: 'HIGH' }, pension_wrap: { nw: 1, iht: 1, conf: 'MED' }, diversified: { nw: 0.9, iht: 0.7, conf: 'MED' } },
  'DE-33': { bank_hold: { nw: 0, iht: 0, conf: 'HIGH' }, wrap_max: { nw: 1, iht: 1, conf: 'MED' }, property: { nw: 0.9, iht: 0, conf: 'LOW' } },
  'DE-34': { clean_break: { nw: 1, conf: 'HIGH' }, maintenance: { nw: 0.7, conf: 'MED' }, deferred: { nw: 0.5, conf: 'LOW' } },
  'DE-35': { no_badr: { nw: 0, conf: 'MED' }, badr_claim: { nw: 1, conf: 'HIGH' }, earnout: { nw: 0.8, conf: 'MED' } },
  'DE-36': { repay_loan: { nw: 1, conf: 'HIGH' }, div_clear: { nw: 0.7, conf: 'MED' }, write_off: { nw: 0.2, conf: 'LOW' } },
  'DE-37': { keep_db: { nw: 0, iht: 0, conf: 'HIGH' }, transfer_dc: { nw: 1, iht: 1, conf: 'LOW' }, partial_xfer: { nw: 0.5, iht: 0.5, conf: 'MED' } },
  'DE-38': { full_drawdown: { nw: 1, conf: 'LOW' }, partial_annuity: { nw: 0.6, conf: 'MED' }, full_annuity: { nw: 0.2, conf: 'HIGH' } },
  'DE-39': { stay_uk: { nw: 0, conf: 'HIGH' }, plan_exit: { nw: 0.7, conf: 'MED' }, immediate_exit: { nw: 1, conf: 'LOW' } },
  'DE-40': { self_fund: { nw: 1, conf: 'MED' }, deferred_payment: { nw: 0.8, conf: 'MED' }, ltc_insurance: { nw: 0.6, conf: 'HIGH' } },
}

// Resolve a path's {nw, iht, fq, conf} factor. Falls back to a status-quo/risk
// model for the generic 2-path default and any unmapped path id.
function _pathFactor(decisionType, pathId, riskLevel) {
  const ov = _PATH_FACTORS[decisionType]?.[pathId]
  if (ov) return { nw: ov.nw ?? 1, iht: ov.iht ?? (ov.nw === 0 ? 0 : 1), fq: ov.fq ?? (ov.nw === 0 ? 0 : 1), conf: ov.conf }
  if (/^(no_|none$|hold_|keep)/.test(pathId || '')) return { nw: 0, iht: 0, fq: 0, conf: 'HIGH' }
  const byRisk = {
    low:    { nw: 0.7, iht: 0.7, fq: 0.8, conf: 'HIGH' },
    medium: { nw: 0.9, iht: 0.9, fq: 0.9, conf: 'MED' },
    high:   { nw: 1,   iht: 1,   fq: 1,   conf: 'LOW' },
  }
  return byRisk[riskLevel] || { nw: 1, iht: 1, fq: 1 }
}

// Marginal income-tax rate for this entity — replaces hardcoded 40/45% in relief
// and cost decisions. 2026/27 bands from TAX.
function _marginalRate(income) {
  if (income > (TAX.art ?? 125140)) return TAX.ar ?? 0.45
  if (income > (TAX.brt ?? 50270))  return TAX.hr ?? 0.40
  if (income > (TAX.pa  ?? 12570))  return TAX.br ?? 0.20
  return 0
}

// Dividend tax rate by the entity's marginal band (directors are usually HR/AR).
function _dividendRate(income) {
  if (income > (TAX.art ?? 125140)) return TAX.dividendAR ?? 0.3935
  if (income > (TAX.brt ?? 50270))  return TAX.dividendHR ?? 0.3575
  return TAX.dividendBR ?? 0.1075
}

// ── simulateAction ────────────────────────────────────────────────────────────

/**
 * Compute before/after snapshot for a given decision type.
 * Returns { before, after, delta, horizon, confidence }
 */
export function simulateAction(entity, decisionType, params = {}) {
  const nwBefore   = _nw(entity)
  const fqBefore   = _fq(entity)
  const riskBefore = _risk(entity)
  const ihtBefore  = _iht(entity)
  const age        = _age(entity)
  const income     = _annualIncome(entity)

  let nwDelta = 0, fqDelta = 0, riskDelta = 0, ihtDelta = 0, horizon = 20, confidence = 'MED'

  switch (decisionType) {

    case 'DE-01': { // Drawdown: lump sum vs phased
      const sipp = entity?.assets?.sipp?.total || 0
      // Phased drawdown reduces income tax vs lump-sum crystallisation
      const taxSaved = sipp > 0 ? Math.min(sipp * 0.20, 15000) : 0
      nwDelta    = taxSaved
      fqDelta    = taxSaved > 5000 ? 4 : taxSaved > 0 ? 2 : 0
      ihtDelta   = 0
      horizon    = 10
      confidence = 'MED'
      break
    }

    case 'DE-02': { // Annuity: buy or defer?
      const sipp = entity?.assets?.sipp?.total || 0
      // Deferring annuity by 5 years at typical rate uplift vs buying now
      const deferGain = sipp > 0 ? sipp * 0.04 * 5 : 0 // simplified: 4%/yr × 5yr
      nwDelta    = deferGain
      fqDelta    = deferGain > 10000 ? 3 : 1
      ihtDelta   = 0
      horizon    = 5
      confidence = 'LOW'
      break
    }

    case 'DE-03': { // Pension contribution: top up vs MPAA risk
      const aa          = TAX.pensionAA || 60000
      const currentContrib = entity?.assets?.sipp?.annualContrib || 0
      const headroom    = Math.max(0, Math.min(aa, income) - currentContrib)
      nwDelta    = headroom * _marginalRate(income)   // benefit = tax relief retained, at YOUR marginal rate (not a flat 45%)
      fqDelta    = headroom > 10000 ? 5 : headroom > 2000 ? 2 : 0
      ihtDelta   = 0 // unused pensions count toward the estate from Apr 2027 (enacted) — a contribution no longer lastingly removes value from your estate
      horizon    = Math.max(1, 57 - age)
      confidence = 'MED'
      break
    }

    case 'DE-04': { // SIPP vs workplace pension routing
      const workplacePct = entity?.assets?.pension?.employerMatch || 0.03
      const salary       = entity?.income?.salary || income
      const employerGain = salary * workplacePct
      nwDelta    = employerGain * Math.min(20, Math.max(0, 60 - age))
      fqDelta    = employerGain > 2000 ? 4 : 1
      ihtDelta   = 0 // pensions enter the estate from Apr 2027 (enacted) — no lasting IHT relief from routing contributions
      horizon    = Math.max(1, 60 - age)
      confidence = 'MED'
      break
    }

    case 'DE-05': { // Salary sacrifice: increase / decrease
      const salary     = entity?.income?.salary || income
      const sacrificed = Math.min(salary * 0.05, 5000)
      // NI saved on sacrificed amount: 8% employee + 15% employer on portion (2026/27)
      const niSaved    = sacrificed * (TAX.employerNICRate ?? 0.15)
      nwDelta    = niSaved * Math.min(20, Math.max(0, 65 - age))
      fqDelta    = niSaved > 500 ? 3 : 1
      ihtDelta   = 0 // pensions enter the estate from Apr 2027 (enacted) — sacrifice no longer removes value from your estate
      horizon    = Math.max(1, 65 - age)
      confidence = 'MED'
      break
    }

    case 'DE-06': { // ISA: stocks & shares vs cash vs LISA split
      const cap = TAX.isaAllowance || 20000
      // Differential growth on what you can actually invest THIS year — the lower
      // of the ISA allowance and your investable surplus/cash — not a flat constant.
      const investableIsa = Math.max(0, Math.min(cap, params.monthlySurplus ? params.monthlySurplus * 12 : (entity?.assets?.cash?.savings || cap)))
      nwDelta    = investableIsa * (TAX.growthDefault ?? 0.05) * 10
      fqDelta    = 3
      ihtDelta   = 0
      horizon    = 10
      confidence = 'MED'
      break
    }

    case 'DE-07': { // GIA → ISA bed-and-ISA execution
      const gia = entity?.assets?.gia?.value || 50000
      const cap = TAX.isaAllowance || 20000
      const wrapped = Math.min(gia, cap)
      // CGT exempt on future gains once wrapped; cgt on gains above annual exempt on bed
      const cgtOnBed = Math.max(0, wrapped * 0.15 - TAX.cgaAllowance) * TAX.cgtHigher // 0.15 = embedded-gain proxy
      nwDelta    = wrapped * 0.05 * 10 - cgtOnBed  // 5%/yr sheltered minus bed cost
      fqDelta    = 2
      ihtDelta   = 0
      horizon    = 10
      confidence = 'MED'
      break
    }

    case 'DE-08': { // Mortgage: overpay, offset, or invest?
      const mortgage = entity?.liabilities?.mortgage?.balance || 200000
      const rate     = entity?.liabilities?.mortgage?.rate    || 0.045
      const surplus  = params.monthlySurplus || 500
      const annualSurplus = surplus * 12
      // Invest outperforms overpay when return > mortgage rate net of tax
      const investReturn = annualSurplus * (TAX.growthDefault ?? 0.05) * 10
      const overpayReturn = annualSurplus * rate * 10
      nwDelta    = investReturn - overpayReturn
      fqDelta    = nwDelta > 0 ? 3 : 1
      ihtDelta   = 0
      horizon    = 10
      confidence = 'MED'
      break
    }

    case 'DE-09': { // Property: keep, sell, or let?
      const propertyValue = entity?.assets?.property?.total || 450000
      const isa           = entity?.assets?.isa?.value || 0
      // Best path: sell + wrap — tax saved vs status quo
      const assumedGain = Math.max(0, propertyValue - 125000) // assumed acquisition base (model proxy)
      const cgtDue   = assumedGain * TAX.cgtHigher
      const sheltered = Math.min(TAX.isaAllowance, propertyValue - cgtDue) + Math.min(TAX.pensionAA, income)
      nwDelta    = sheltered * (TAX.growthDefault ?? 0.05) * 10  // sheltered growth for 10yr
      fqDelta    = 5
      ihtDelta   = -(propertyValue * TAX.ihtRate - (propertyValue * 0.10)) // partial estate removal (0.10 = retained-share proxy)
      horizon    = 10
      confidence = 'MED'
      break
    }

    case 'DE-10': { // Remortgage: fix vs tracker vs offset
      const balance = entity?.liabilities?.mortgage?.balance || 200000
      const currentRate = entity?.liabilities?.mortgage?.rate || 0.065
      const fixedRate   = 0.045
      nwDelta    = (currentRate - fixedRate) * balance * 5
      fqDelta    = 2
      ihtDelta   = 0
      horizon    = 5
      confidence = 'MED'
      break
    }

    case 'DE-11': { // BTL: §24 exposure review
      const rentalIncome = entity?.income?.rental || 18000
      const mortgageInt  = entity?.liabilities?.mortgage?.interest || 6000
      // §24 restricts relief to basic rate on mortgage interest — HR taxpayers lose (hr − br)
      const extraTax = mortgageInt * (Math.min(income, TAX.art) > TAX.brt ? (TAX.hr - TAX.br) : 0)
      nwDelta    = extraTax > 0 ? -(extraTax * 5) : 0  // cost of staying vs restructure
      fqDelta    = extraTax > 1000 ? -2 : 0
      ihtDelta   = 0
      horizon    = 5
      confidence = 'MED'
      break
    }

    case 'DE-12': { // Equity release: lifetime mortgage assessment
      const propertyValue = entity?.assets?.property?.total || 450000
      const releaseRate   = 0.55 // max LTV for equity release
      const released      = propertyValue * releaseRate * 0.25 // typical drawdown
      // A lifetime mortgage is a LOAN, not wealth: ~neutral today, then net worth
      // erodes as interest rolls up. The debt does reduce the taxable estate.
      const rolledInterest = released * (Math.pow(1.07, 15) - 1) // ~7%/yr rolled up over the horizon
      nwDelta    = -(rolledInterest)
      fqDelta    = 2
      ihtDelta   = -(released * TAX.ihtRate) // the loan/spent cash reduces the estate
      horizon    = 15
      confidence = 'LOW'
      break
    }

    case 'DE-13': { // Emergency fund: size and location
      const monthlySpend = (income / 12) * 0.7
      const target6mo    = monthlySpend * 6
      const current      = entity?.assets?.cash?.savings || 5000
      const gap          = Math.max(0, target6mo - current)
      // Moving cash to premium bond / easy-access HYSA vs current account
      nwDelta    = (target6mo * 0.045 - target6mo * 0.02) * 3 // rate uplift × 3yr
      fqDelta    = gap > 5000 ? 3 : 1
      ihtDelta   = 0
      horizon    = 3
      confidence = 'HIGH'
      break
    }

    case 'DE-14': { // Cash ladder: build a 12-month bond ladder
      const cashToLadder = entity?.assets?.cash?.savings || 30000
      // Gilts / fixed-term bonds vs instant access: ~1.5% pickup
      nwDelta    = cashToLadder * 0.015 * 2
      fqDelta    = 2
      ihtDelta   = 0
      horizon    = 2
      confidence = 'HIGH'
      break
    }

    case 'DE-15': { // Gifting: structure £X to children (7-year PET)
      const gift = params.giftAmount || 50000
      const annualExempt = TAX.annualGiftExemption
      const pet = Math.max(0, gift - annualExempt)
      // IHT saved if donor survives 7 years: full IHT rate on PET (taper applies 3–7yr)
      const ihtSaved = pet * TAX.ihtRate
      nwDelta    = 0
      fqDelta    = 1
      ihtDelta   = -(ihtSaved * (age < 73 ? 1 : 0.5)) // discount if survival uncertain
      horizon    = 7
      confidence = 'MED'
      break
    }

    case 'DE-16': { // Trust: bare, discretionary, or interest-in-possession
      const trustAssets = params.trustValue || 100000
      nwDelta    = 0
      fqDelta    = 1
      ihtDelta   = -(trustAssets * TAX.ihtRate * 0.8) // assets leave estate minus entry-charge proxy (0.8)
      horizon    = 10
      confidence = 'LOW'
      break
    }

    case 'DE-17': { // Will: simple, mirror, or life-interest
      const estate = _nw(entity)
      const nrb = TAX.nrb + TAX.rnrb
      const exposure = Math.max(0, estate - nrb)
      // Mirror will / life-interest trust can defer IHT to second death
      ihtDelta   = -(exposure * 0.10) // modest deferral saving (0.10 = deferral proxy, not a tax rate)
      nwDelta    = 0
      fqDelta    = 1
      horizon    = 20
      confidence = 'LOW'
      break
    }

    case 'DE-18': { // LPA: financial and health setup
      // No direct NW impact; cost of not having LPA is professional deputy fees
      const deputyCost = 3500 // annual deputy cost if incapacitated without LPA
      nwDelta    = deputyCost * 5 // avoided cost
      fqDelta    = 2
      ihtDelta   = 0
      horizon    = 5
      confidence = 'MED'
      break
    }

    case 'DE-19': { // Life cover: term, FIB, or whole-of-life in trust
      const debtCover = (entity?.liabilities?.mortgage?.balance || 0) + (income * 10)
      const premiumCost = debtCover * 0.002 * 10 // rough 0.2%/yr over 10yr
      nwDelta    = -(premiumCost)
      fqDelta    = 3 // risk score improvement (protection gap closed)
      ihtDelta   = 0 // in-trust policies sit outside estate
      horizon    = 10
      confidence = 'MED'
      break
    }

    case 'DE-20': { // Critical illness: add or top up
      const ciAmount = income * 3
      const ciPremium = ciAmount * 0.003 * 5
      nwDelta    = -(ciPremium)
      fqDelta    = 2
      ihtDelta   = 0
      horizon    = 5
      confidence = 'MED'
      break
    }

    case 'DE-21': { // Income protection: own-occ vs any-occ
      const monthlyBenefit = income / 12 * 0.60
      const ipPremium      = monthlyBenefit * 0.03 * 12 * 5
      nwDelta    = -(ipPremium)
      fqDelta    = 3
      ihtDelta   = 0
      horizon    = 5
      confidence = 'MED'
      break
    }

    case 'DE-22': { // CGT crystallisation: harvest allowance now
      const cgtExempt = TAX.cgaAllowance || 3000
      const gains     = entity?.assets?.gia?.unrealisedGain || 20000
      const harvested = Math.min(gains, cgtExempt)
      // Future CGT saved by crystallising within the exempt amount now
      nwDelta    = harvested * TAX.cgtHigher  // higher-rate CGT avoided on this tranche
      fqDelta    = 2
      ihtDelta   = 0
      horizon    = 1
      confidence = 'HIGH'
      break
    }

    case 'DE-23': { // Loss harvesting: realise losses against gains
      const losses = entity?.assets?.gia?.unrealisedLoss || 10000
      const gains  = entity?.assets?.gia?.unrealisedGain || 20000
      const offset = Math.min(losses, gains)
      nwDelta    = offset * TAX.cgtHigher  // CGT saved at higher rate
      fqDelta    = 2
      ihtDelta   = 0
      horizon    = 1
      confidence = 'HIGH'
      break
    }

    case 'DE-24': { // Spousal transfer: equalise allowances
      // Move income/gains from the higher earner to a lower-rate spouse: saving =
      // shiftable higher-band income (capped by spouse PA headroom) × the rate gap.
      const shiftable = Math.max(0, income - (TAX.brt ?? 50270))
      const rateGap   = Math.max(0, _marginalRate(income) - (TAX.br ?? 0.20))
      const savingsOnTransfer = Math.min(shiftable, TAX.pa ?? 12570) * rateGap
      nwDelta    = savingsOnTransfer * 5
      fqDelta    = 2
      ihtDelta   = 0 // inter-spouse transfers are IHT-exempt — equalising doesn't change combined-estate IHT
      horizon    = 5
      confidence = 'MED'
      break
    }

    case 'DE-25': { // Dividend vs salary mix (Ltd Co director)
      const salary   = entity?.income?.salary || income
      const divRate  = TAX.dividendBR ?? 0.1075 // 2026/27 basic-rate dividend (was stale 8.75%)
      const corpTax  = TAX.corpMainRate ?? 0.25
      // Optimal: salary to NI secondary threshold, rest as dividends
      const niThresh    = TAX.employerNICThreshold ?? 5000 // 2026/27 secondary threshold (was stale £9,100)
      const optSalary   = Math.min(salary, niThresh)
      const divIncome   = salary - optSalary
      const niSaved     = (salary - optSalary) * (TAX.employerNICRate ?? 0.15) // 2026/27 employer NI 15% (was stale 13.8%)
      nwDelta    = niSaved * 5
      fqDelta    = 3
      ihtDelta   = 0
      horizon    = 5
      confidence = 'MED'
      break
    }

    case 'DE-26': { // EIS / SEIS: invest for relief
      const invest = params.eisAmount || 20000
      const seis   = invest <= 200000  // SEIS annual investment limit £200k (ITA 2007; no bundle key)
      const relief = seis ? invest * TAX.seisITRate : invest * TAX.eisITRate
      const lossRelief = invest * (seis ? 0.855 : 0.765) // after income tax credit (model proxy)
      nwDelta    = relief  // upfront income tax relief
      fqDelta    = 2
      ihtDelta   = -(invest * TAX.ihtRate) // BPR after 2yr removes the value from the estate → IHT saved at the IHT rate (mirrors DE-28)
      horizon    = 3
      confidence = 'LOW'
      break
    }

    case 'DE-27': { // VCT: build a tax-relief ladder
      const vctAmount = params.vctAmount || 20000
      const relief    = vctAmount * (TAX.vctITRate ?? 0.20)  // 2026/27 VCT IT relief 20% (was stale 30% — FA 2026)
      nwDelta    = relief
      fqDelta    = 1
      ihtDelta   = 0
      horizon    = 5
      confidence = 'LOW'
      break
    }

    case 'DE-28': { // BPR portfolio: 2-year IHT planning
      const bprInvest = params.bprAmount || 100000
      // After 2yr qualifying period, full IHT exemption
      ihtDelta   = -(bprInvest * TAX.ihtRate)
      nwDelta    = bprInvest * 0.06 * 2 // typical AIM return (market assumption)
      fqDelta    = 3
      horizon    = 2
      confidence = 'MED'
      break
    }

    case 'DE-29': { // Charitable giving: payroll, gift aid, legacy
      const donation = params.donationAmount || 5000
      const giftAid  = donation * 0.25  // 25p per £1 for charity (basic-rate gross-up, structural)
      const taxBack   = income > TAX.brt ? donation * (TAX.hr - TAX.br) : 0  // HR reclaim
      nwDelta    = taxBack
      fqDelta    = 1
      ihtDelta   = -(donation * TAX.ihtRate) // charitable gift leaves the estate → IHT saved at the IHT rate
      horizon    = 1
      confidence = 'HIGH'
      break
    }

    case 'DE-30': { // School fees / education funding plan
      const yearsToStart  = Math.max(1, params.yearsToSchool || 5)
      const feePerYear    = params.annualFees || 18000
      const totalFees     = feePerYear * 13 // primary + secondary
      // Junior ISA + parental ISA vs unsheltered savings
      const shelterSaving = totalFees * 0.20 * 0.05 * yearsToStart
      nwDelta    = shelterSaving
      fqDelta    = 2
      ihtDelta   = 0
      horizon    = yearsToStart + 13
      confidence = 'MED'
      break
    }

    case 'DE-31': { // Career break / sabbatical affordability
      const months       = params.breakMonths || 6
      const monthlySpend = (income / 12) * 0.80
      const totalCost    = monthlySpend * months
      const liquidAssets = (entity?.assets?.cash?.savings || 0) + (entity?.assets?.isa?.value || 0) * 0.5
      nwDelta    = -(totalCost)
      fqDelta    = liquidAssets > totalCost ? 0 : -3
      ihtDelta   = 0
      horizon    = months / 12
      confidence = 'HIGH'
      break
    }

    case 'DE-32': { // Redundancy: lump-sum deployment
      const lumpSum = params.redundancyAmount || 50000
      const taxFree = Math.min(TAX.redundancyTaxFree, lumpSum)
      const taxable = Math.max(0, lumpSum - taxFree)
      // Optimal: pension + ISA wrap of post-tax balance
      const netOfTax = taxable * (1 - _marginalRate(income)) // what's left after YOUR marginal rate, not a flat 45%
      nwDelta    = (taxFree + netOfTax) * (TAX.growthDefault ?? 0.05) * 10
      fqDelta    = 4
      ihtDelta   = 0 // pensions enter the estate from Apr 2027 (enacted) — no lasting IHT relief
      horizon    = 10
      confidence = 'MED'
      break
    }

    case 'DE-33': { // Inheritance receipt: deploy £X received
      const received  = params.inheritanceAmount || 100000
      const pensionAA = Math.min(TAX.pensionAA || 60000, income)
      const toISA     = TAX.isaAllowance || 20000
      const toSIPP    = Math.min(pensionAA, received - toISA)
      // Consistent model: pension relief at YOUR marginal rate + growth on both wrappers.
      nwDelta    = toSIPP * _marginalRate(income) + (toSIPP + toISA) * (TAX.growthDefault ?? 0.05) * 10
      fqDelta    = 5
      ihtDelta   = 0 // pensions enter the estate from Apr 2027 (enacted) — no lasting IHT relief
      horizon    = 10
      confidence = 'MED'
      break
    }

    case 'DE-34': { // Divorce: financial settlement structuring
      const totalAssets = _nw(entity)
      // CGT on asset splits between spouses during tax year of separation — 3yr window
      // Transfers between spouses are CGT-free in the year of separation + the
      // following 3 tax years (TCGA 1992 s58, extended by FA 2023) — no CGT in-window.
      nwDelta    = 0
      fqDelta    = -3
      ihtDelta   = -(totalAssets * 0.20 * TAX.ihtRate) // assets leaving your estate REDUCE your IHT (≤0 is good)
      horizon    = 3
      confidence = 'LOW'
      break
    }

    case 'DE-35': { // Business sale: exit + BADR planning
      const saleProceeds = params.saleProceeds || 500000
      const badrLimit    = TAX.badrLifetimeLimit
      const gain         = params.gain ?? Math.max(0, saleProceeds * 0.7) // CGT is on the GAIN, not gross proceeds (base-cost proxy if not supplied)
      const gainOnBADR   = Math.min(gain, badrLimit)
      const gainOver     = Math.max(0, gain - badrLimit)
      const cgtBADR      = gainOnBADR * TAX.badrRate  // BADR rate (FA 2026 = 18%)
      const cgtNormal    = gainOver   * TAX.cgtHigher
      const cgtStandard  = gain * TAX.cgtHigher
      nwDelta    = cgtStandard - cgtBADR - cgtNormal  // CGT saving vs no BADR, on the gain
      fqDelta    = 5
      ihtDelta   = (saleProceeds * TAX.ihtRate * 0.5) // selling a BPR-qualifying business LOSES that relief → estate (and IHT) goes UP
      horizon    = 1
      confidence = 'MED'
      break
    }

    case 'DE-36': { // Director loan: extract or repay
      const dlBalance = entity?.liabilities?.directorLoan?.balance || 50000
      // Section 455 tax if not repaid within 9 months of year end (CTA 2010 s455)
      const s455 = dlBalance * TAX.s455Rate
      // Repay vs declare dividend to clear
      const divTax = dlBalance * _dividendRate(income) // directors are usually higher/additional-rate dividend payers
      nwDelta    = s455 - divTax  // dividend cheaper than 455 charge
      fqDelta    = 2
      ihtDelta   = 0
      horizon    = 1
      confidence = 'HIGH'
      break
    }

    case 'DE-37': { // Pension transfer: DB → DC suitability
      const dbCETV = params.cetvAmount || 400000
      const dbAnnual = params.dbPension || 15000
      const dcExpected = dbCETV * 0.05 * Math.max(1, 65 - age)
      // Transfer rarely beneficial unless CETVF > 30× annual pension
      const transferFactor = dbAnnual > 0 ? dbCETV / dbAnnual : 0
      nwDelta    = transferFactor > 30 ? dbCETV * 0.10 : -(dbCETV * 0.05)
      fqDelta    = transferFactor > 30 ? 2 : -2
      ihtDelta   = 0 // DC pensions enter the estate from Apr 2027 (enacted) — a DB→DC transfer no longer creates an IHT-free legacy
      horizon    = Math.max(1, 65 - age)
      confidence = 'LOW'
      break
    }

    case 'DE-38': { // Annuity reshape after partial drawdown
      const sippRemaining = entity?.assets?.sipp?.total || 100000
      const partialAnnuity = sippRemaining * 0.50
      // Buy guaranteed income on half; keep half in drawdown
      // Buying an annuity converts capital to income — net worth is ~neutral at
      // purchase (the £/yr guaranteed income is its own metric, not a NW gain).
      nwDelta    = 0
      fqDelta    = 3
      ihtDelta   = -(partialAnnuity * TAX.ihtRate) // capital converted to income leaves the estate
      horizon    = 10
      confidence = 'MED'
      break
    }

    case 'DE-39': { // Emigration: UK tax residency exit planning
      const ukAssets = _nw(entity)
      // Deemed disposal on exit; rebasing CGT base cost (0.15 = assumed embedded-gain proxy)
      const cgtOnExit = Math.max(0, ukAssets * 0.15) * TAX.cgtHigher
      nwDelta    = -(cgtOnExit)
      fqDelta    = 1
      ihtDelta   = 0 // UK IHT follows domicile / long-term residence, NOT tax residence — emigrating doesn't remove the estate from IHT until the LTR/deemed-domicile clock unwinds
      horizon    = 3
      confidence = 'LOW'
      break
    }

    case 'DE-40': { // Long-term care: self-fund vs deferred payment
      const carePerYear  = 60000 // market assumption — typical residential care cost/yr (no bundle key)
      const carePotential = 3 // average LTC duration years
      const totalCost    = carePerYear * carePotential
      const propertyValue = entity?.assets?.property?.total || 450000
      // Deferred payment preserves assets but rolls up interest at ~7%
      const deferredCost = totalCost * 1.07 ** carePotential
      nwDelta    = -(totalCost)
      fqDelta    = -2
      ihtDelta   = -(Math.min(totalCost, propertyValue) * TAX.ihtRate) // estate reduced by what care actually consumes, capped at the asset
      horizon    = 3
      confidence = 'LOW'
      break
    }

    default: {
      nwDelta = 0; fqDelta = 0; riskDelta = 0; horizon = 10; confidence = 'LOW'
    }
  }

  // ── Per-path modulation (founder 2026-06-06) ─────────────────────────────────
  // enumeratePaths passes pathId + riskLevel so each candidate diverges instead of
  // echoing one identical simulation. See _PATH_FACTORS above.
  if (params.pathId) {
    const f = _pathFactor(decisionType, params.pathId, params.riskLevel)
    nwDelta  = Math.round(nwDelta  * f.nw)
    ihtDelta = Math.round(ihtDelta * f.iht)
    fqDelta  = Math.round(fqDelta  * f.fq)
    if (f.conf) confidence = f.conf
  }

  return {
    before:     { nw: nwBefore, fq: fqBefore, risk: riskBefore, iht: ihtBefore },
    after:      {
      nw:  nwBefore + nwDelta,
      fq:  Math.min(100, fqBefore + fqDelta),
      risk: riskBefore + riskDelta,
      iht: Math.max(0, ihtBefore + ihtDelta),
    },
    delta:      { nw: nwDelta, fq: fqDelta, risk: riskDelta, iht: ihtDelta },
    horizon,
    confidence,
  }
}

// ── enumeratePaths ────────────────────────────────────────────────────────────

/**
 * Returns 2–4 decision paths for the user to compare.
 * Each path: { id, label, riskLevel, detail, simulation }
 */
export function enumeratePaths(entity, decisionType) {
  const income = _annualIncome(entity)
  const age    = _age(entity)
  const aa     = TAX.pensionAA || 60000

  const _fmt = (n) => n >= 1000 ? `£${Math.round(n / 1000)}k` : `£${n}`
  const _gbp = (n) => `£${Math.round(n).toLocaleString('en-GB')}`
  const _pc  = (r) => `${+(r * 100).toFixed(2)}%`

  const pathDefs = {
    'DE-01': [
      { id: 'lump',   label: 'Take lump sum now',            riskLevel: 'high',   detail: 'Crystallises full tax liability in one year — may push into higher band.' },
      { id: 'phased', label: 'Phase drawdown over 5–10 yrs', riskLevel: 'medium', detail: `Spread income across years to stay within basic-rate band (${_gbp(TAX.brt)}).` },
      { id: 'defer',  label: 'Defer — keep invested',        riskLevel: 'low',    detail: 'SIPP stays sheltered; access from age 57. Reduces IHT if you die before drawing.' },
    ],
    'DE-02': [
      { id: 'buy_now',  label: 'Buy annuity now',         riskLevel: 'medium', detail: 'Locks in a guaranteed income. Rate set at today\'s gilt yield.' },
      { id: 'defer_5',  label: 'Defer 5 years',           riskLevel: 'medium', detail: 'Annuity rate rises ~4–6% per year of deferral — worth ~20–30% more income.' },
      { id: 'drawdown', label: 'Flexi-access drawdown',   riskLevel: 'high',   detail: 'Invest and draw flexibly. No guaranteed income; longevity risk remains.' },
    ],
    'DE-03': [
      { id: 'no_change', label: 'Keep current contributions',               riskLevel: 'high',   detail: 'Leave tax relief headroom unused.' },
      { id: 'top_up',    label: `Top up to £${Math.round(Math.min(aa, income) / 1000)}k`,    riskLevel: 'medium', detail: 'Exploit full annual allowance. 40–45% tax relief applies.' },
      { id: 'carryback', label: 'Use carry-forward from prior 3 years',     riskLevel: 'low',    detail: `${_fmt(aa * 3)} potential carry-forward if unused allowances exist.` },
    ],
    'DE-04': [
      { id: 'workplace_only', label: 'Workplace scheme only',       riskLevel: 'high',   detail: 'Employer match captured, but contributions capped at scheme rules.' },
      { id: 'split',          label: 'Split: workplace + SIPP',     riskLevel: 'medium', detail: 'Max employer match first; overflow into SIPP for flexibility.' },
      { id: 'sipp_only',      label: 'SIPP only (self-employed)',   riskLevel: 'low',    detail: 'Full AA control; add Nest/SIPP. No employer match available.' },
    ],
    'DE-05': [
      { id: 'no_sacrifice', label: 'No salary sacrifice',           riskLevel: 'high',   detail: 'Pay full NI on earnings above primary threshold.' },
      { id: 'partial',      label: 'Sacrifice 5% of salary',        riskLevel: 'medium', detail: `Saves employer NI (15%) which may be passed back as extra pension.` },
      { id: 'maximum',      label: 'Maximise sacrifice to pension AA', riskLevel: 'low', detail: 'Combine salary sacrifice + SIPP to hit full annual allowance tax-efficiently.' },
    ],
    'DE-09': [
      { id: 'keep_use',         label: 'Keep & use as primary residence', riskLevel: 'high',   detail: 'No CGT today. Full £450k in estate. Zero income generated.' },
      { id: 'let',              label: 'Let on AST (£1,800/mo gross)',    riskLevel: 'medium', detail: '~£16,700 net/yr after §24 costs. Asset stays in estate.' },
      { id: 'sell_isa_pension', label: 'Sell & wrap into ISA + pension',  riskLevel: 'low',    detail: 'CGT crystallised (~£35k). £415k liquid. Future growth sheltered.' },
      { id: 'sell_btl_replace', label: 'Sell & buy yielding BTL',         riskLevel: 'medium', detail: '~£22k/yr but concentration risk unchanged. CGT triggered.' },
    ],
    'DE-06': [
      { id: 'cash_isa',    label: 'Cash ISA only',                 riskLevel: 'low',    detail: 'Capital protected. No inflation-beating return. Good for short-term goals.' },
      { id: 'ss_isa',      label: 'Stocks & shares ISA',           riskLevel: 'high',   detail: 'Higher expected real return (~4–6%/yr). Suitable if horizon ≥ 5 years.' },
      { id: 'lisa',        label: 'LISA (under-40, first home)',   riskLevel: 'medium', detail: '25% govt bonus on up to £4k/yr. Locked until first home or age 60.' },
      { id: 'split_blend', label: 'Split: S&S ISA + cash reserve', riskLevel: 'medium', detail: '£14k S&S ISA + £6k cash ISA. Balanced growth with accessible buffer.' },
    ],
    'DE-07': [
      { id: 'hold_gia',   label: 'Hold in GIA — no action',    riskLevel: 'high',   detail: 'Future gains taxed at 18–24%. No sheltering.' },
      { id: 'bed_isa',    label: 'Bed-and-ISA this tax year',   riskLevel: 'low',    detail: 'Sell in GIA, rebuy inside ISA. CGT on bed; future gains sheltered.' },
      { id: 'phased_bed', label: 'Phase over 2–3 tax years',    riskLevel: 'medium', detail: 'Spread CGT across years using £3k annual exempt each year.' },
    ],
    'DE-08': [
      { id: 'overpay',  label: 'Overpay mortgage',         riskLevel: 'low',    detail: 'Guaranteed risk-free return equal to your mortgage rate.' },
      { id: 'offset',   label: 'Offset account',           riskLevel: 'low',    detail: 'Parking savings against mortgage balance cuts interest without locking in.' },
      { id: 'invest',   label: 'Invest surplus instead',   riskLevel: 'high',   detail: 'Higher expected return long term but mortgage interest continues accruing.' },
      { id: 'split',    label: 'Split: overpay + invest',  riskLevel: 'medium', detail: 'Reduce interest risk while capturing growth. £250/mo each path.' },
    ],
    'DE-10': [
      { id: 'fix_2yr',   label: '2-year fix',      riskLevel: 'medium', detail: 'Lower rate now; refinance risk when deal ends.' },
      { id: 'fix_5yr',   label: '5-year fix',      riskLevel: 'low',    detail: 'Certainty for 5 years. Higher rate than 2yr currently.' },
      { id: 'tracker',   label: 'Base-rate tracker', riskLevel: 'high', detail: 'Follows BOE rate. Beneficial if rates fall; costly if they rise.' },
      { id: 'offset_re', label: 'Offset mortgage',  riskLevel: 'medium', detail: 'Link savings to reduce interest. Flexible; no fixed rate security.' },
    ],
    'DE-11': [
      { id: 'hold_btl',     label: 'Hold & review annually',      riskLevel: 'high',   detail: `§24 restricts interest relief to ${_pc(TAX.br)} basic rate. HR taxpayers lose out.` },
      { id: 'incorporate',  label: 'Incorporate to Ltd Co',        riskLevel: 'medium', detail: 'Corp tax (25%) on profits; full interest deductible. SDLT + CGT on transfer.' },
      { id: 'sell_btl',     label: 'Sell — exit the BTL',         riskLevel: 'low',    detail: 'CGT at 24%; capital released. End §24 drag and management overhead.' },
    ],
    'DE-12': [
      { id: 'no_release',   label: 'No equity release',             riskLevel: 'low',    detail: 'Property stays intact in estate. No roll-up interest eroding legacy.' },
      { id: 'drawdown_er',  label: 'Drawdown lifetime mortgage',    riskLevel: 'medium', detail: 'Access cash in tranches; interest only rolls on drawn amount.' },
      { id: 'lump_er',      label: 'Lump-sum lifetime mortgage',    riskLevel: 'high',   detail: 'Full release now. Maximum liquidity; maximum roll-up cost.' },
    ],
    'DE-13': [
      { id: 'current_acct', label: 'Keep in current account',    riskLevel: 'high',   detail: 'Instant access; near-zero interest. Real value erodes.' },
      { id: 'easy_access',  label: 'Easy-access savings (4.5%)', riskLevel: 'low',    detail: 'FSCS protected. Instant access. Beats inflation currently.' },
      { id: 'premium_bond', label: 'Premium bonds',              riskLevel: 'low',    detail: 'Tax-free prize fund. Equivalent rate ~4.4%. Max £50k.' },
    ],
    'DE-14': [
      { id: 'instant_only', label: 'Instant access only',       riskLevel: 'high',   detail: 'All cash liquid. Low rate (~3.5%).' },
      { id: 'ladder_3',     label: '3-rung ladder (1/2/3mo)',   riskLevel: 'medium', detail: 'Stagger 1-, 2-, 3-month fixed bonds. Rate uplift ~0.5%.' },
      { id: 'ladder_12',    label: '12-rung monthly ladder',    riskLevel: 'low',    detail: 'Each month a tranche matures. Rate ~4.8–5.1% on 12mo gilts.' },
    ],
    'DE-15': [
      { id: 'annual_exempt', label: 'Annual exemption only (£3k)',   riskLevel: 'low',    detail: 'Tax-free. No PET clock. Max £6k with prior year carry.' },
      { id: 'pet_gift',      label: 'Outright PET to children',      riskLevel: 'medium', detail: '7-year clock starts immediately. Taper relief from year 3.' },
      { id: 'trust_gift',    label: 'Gift into discretionary trust',  riskLevel: 'high',   detail: 'Immediate entry charge if > NRB. Flexibility on distribution.' },
    ],
    'DE-16': [
      { id: 'bare_trust',  label: 'Bare trust',                      riskLevel: 'low',    detail: 'Simple; beneficiary entitled at 18. No IHT entry charge. No flexibility.' },
      { id: 'disc_trust',  label: 'Discretionary trust',             riskLevel: 'medium', detail: 'Flexible distributions. 10-year periodic IHT charge (6%).' },
      { id: 'iip_trust',   label: 'Interest-in-possession trust',    riskLevel: 'medium', detail: 'Income to named beneficiary; capital to remaindermen on death.' },
    ],
    'DE-17': [
      { id: 'simple_will',  label: 'Simple will',          riskLevel: 'medium', detail: 'Outright gifts on death. Works for straightforward estates.' },
      { id: 'mirror_will',  label: 'Mirror wills',         riskLevel: 'medium', detail: 'Spouses leave everything to each other, then children. Simple but inflexible.' },
      { id: 'li_trust_will',label: 'Life-interest trust will', riskLevel: 'low', detail: 'Survivor has income; capital protected for children. Useful in blended families.' },
    ],
    'DE-18': [
      { id: 'no_lpa',      label: 'No LPA — do nothing',    riskLevel: 'high',   detail: 'Court of Protection deputyship needed if incapacitated. £3k+ and 9+ months.' },
      { id: 'fin_lpa',     label: 'Financial LPA only',     riskLevel: 'medium', detail: 'Covers property and financial affairs. Most urgent.' },
      { id: 'both_lpas',   label: 'Both LPAs (fin + health)',riskLevel: 'low',   detail: 'Full coverage. £164 per LPA to register (2026 fee). Essential if 45+.' },
    ],
    'DE-19': [
      { id: 'term',       label: 'Level-term life cover',         riskLevel: 'medium', detail: 'Cheapest per £ of cover. Expires at term end. No cash value.' },
      { id: 'fib',        label: 'Family income benefit (FIB)',   riskLevel: 'medium', detail: 'Monthly income to family on death. Cheaper than lump-sum term.' },
      { id: 'wol_trust',  label: 'Whole-of-life in trust',       riskLevel: 'low',    detail: 'IHT planning vehicle. Premiums guaranteed; trust keeps proceeds outside estate.' },
    ],
    'DE-20': [
      { id: 'no_ci',      label: 'No critical illness cover',  riskLevel: 'high',   detail: 'Income protection + savings as sole backstop.' },
      { id: 'top_up_ci',  label: 'Top up to 3× salary',       riskLevel: 'medium', detail: 'Covers 3 years of income replacement on serious illness diagnosis.' },
      { id: 'full_ci',    label: 'Full CI + mortgage payoff',  riskLevel: 'low',    detail: 'Mortgage-linked sum plus income buffer. Comprehensive but costly.' },
    ],
    'DE-21': [
      { id: 'any_occ',    label: 'Any-occupation definition',  riskLevel: 'high',   detail: 'Pays only if unable to do any job. Cheapest; hardest to claim.' },
      { id: 'own_occ',    label: 'Own-occupation definition',  riskLevel: 'low',    detail: 'Pays if unable to do your specific job. Gold standard.' },
      { id: 'budget_ip',  label: 'Budget IP to state benefit', riskLevel: 'medium', detail: 'Tops up state incapacity benefit. Lower premium; shorter claim period.' },
    ],
    'DE-22': [
      { id: 'no_harvest',  label: 'No action',                         riskLevel: 'high',   detail: 'Annual CGT exempt (£3k) wasted. Future disposal fully taxed.' },
      { id: 'harvest_now', label: `Realise ${_gbp(TAX.cgaAllowance)} gain this tax year`,    riskLevel: 'low',    detail: 'Sell and rebuy (bed-and-breakfast rules: wait 30 days or use spouse/ISA).' },
      { id: 'harvest_isa', label: 'Realise gain + rebuy inside ISA',   riskLevel: 'low',    detail: 'Bed-and-ISA: use £20k ISA allowance to shelter future gains.' },
    ],
    'DE-23': [
      { id: 'hold_loss',    label: 'Hold and wait for recovery',        riskLevel: 'medium', detail: 'No tax benefit; may recover. Avoids crystallising loss.' },
      { id: 'realise_loss', label: 'Realise loss to offset gains',      riskLevel: 'low',    detail: 'Loss offsets gains this year; excess losses carried forward.' },
      { id: 'rebuy_isa',    label: 'Realise loss, rebuy in ISA',        riskLevel: 'low',    detail: 'Loss offset + future gains sheltered. Use ISA allowance to rebuy.' },
    ],
    'DE-24': [
      { id: 'no_transfer',  label: 'Hold in your name',                 riskLevel: 'high',   detail: "Tax charged at your marginal rate. Lower-rate spouse's allowances unused." },
      { id: 'asset_xfer',   label: 'Transfer income-producing assets',  riskLevel: 'low',    detail: "Rental or dividend income taxed at spouse's lower rate. No CGT between spouses." },
      { id: 'isa_max',      label: 'Max both ISA allowances',           riskLevel: 'low',    detail: '£40k combined ISA shelter. Equalises tax-free returns automatically.' },
    ],
    'DE-25': [
      { id: 'salary_only',   label: 'Full PAYE salary',                riskLevel: 'medium', detail: 'Simple. NI on full amount. No corp tax saving.' },
      { id: 'optimal_mix',   label: 'Salary to NI threshold + divs',   riskLevel: 'low',    detail: `${_gbp(TAX.employerNICThreshold)} salary + dividends. Minimises NI and corp tax.` },
      { id: 'pension_route', label: 'Employer pension contribution',    riskLevel: 'low',    detail: 'Company contributes direct to SIPP. Corp tax relief + no NI.' },
    ],
    'DE-26': [
      { id: 'no_eis',    label: 'No EIS/SEIS — hold cash/GIA',  riskLevel: 'low',    detail: 'No relief but capital fully accessible. No binary startup risk.' },
      { id: 'seis',      label: `SEIS (up to £200k, ${_pc(TAX.seisITRate)} relief)`, riskLevel: 'high', detail: `${_pc(TAX.seisITRate)} income tax relief + CGT/IHT benefits. Very high investment risk.` },
      { id: 'eis',       label: `EIS (up to £1m, ${_pc(TAX.eisITRate)} relief)`,   riskLevel: 'high',  detail: `${_pc(TAX.eisITRate)} relief + IHT after 2yr. Illiquid 3yr minimum hold.` },
    ],
    'DE-27': [
      { id: 'no_vct',    label: 'No VCT',                      riskLevel: 'low',    detail: 'No relief; capital liquid and accessible.' },
      { id: 'vct_5k',    label: `VCT £5k (${_gbp(5000 * TAX.vctITRate)} relief)`,     riskLevel: 'medium', detail: 'Modest relief; 5yr hold required. Tax-free dividends.' },
      { id: 'vct_max',   label: `VCT £200k (max, ${_pc(TAX.vctITRate)} relief)`, riskLevel: 'high',   detail: `${_gbp(200000 * TAX.vctITRate)} income tax reclaim. High concentration in smaller companies.` },
    ],
    'DE-28': [
      { id: 'no_bpr',     label: 'No BPR — existing estate',   riskLevel: 'high',   detail: 'IHT at 40% on qualifying estate. No relief.' },
      { id: 'bpr_aim',    label: 'AIM portfolio (BPR eligible)', riskLevel: 'high',  detail: 'IHT-free after 2yr. Volatile; some AIM stocks illiquid.' },
      { id: 'bpr_unlisted',label: 'Unlisted BPR portfolio',    riskLevel: 'medium', detail: 'Managed BPR funds; lower volatility than AIM. 2yr qualifying period.' },
    ],
    'DE-29': [
      { id: 'no_give',    label: 'No charitable giving',        riskLevel: 'medium', detail: 'Estate taxed at 40% IHT; no charitable deduction.' },
      { id: 'gift_aid',   label: 'Gift Aid one-off donation',   riskLevel: 'low',    detail: 'Charity receives 125% of gift. HR taxpayer reclaims extra 20%.' },
      { id: 'legacy',     label: '10% legacy reduces IHT rate', riskLevel: 'low',    detail: `Leave ≥10% estate to charity: IHT rate drops ${_pc(TAX.ihtRate)}→${_pc(TAX.ihtRate - 0.04)} on remainder.` },
    ],
    'DE-30': [
      { id: 'no_plan',    label: 'No formal plan — ad-hoc',       riskLevel: 'high',   detail: 'Fees paid from income/savings as they arise. Cash-flow shock risk.' },
      { id: 'jisa',       label: 'Junior ISA (£9,000/yr)',         riskLevel: 'medium', detail: 'Tax-free growth; accessible at 18. Long compounding runway.' },
      { id: 'bare_trust_edu', label: 'Bare trust + parental contributions', riskLevel: 'low', detail: "Income taxed at child's rate. Flexible investment mandate." },
    ],
    'DE-31': [
      { id: 'work_through', label: 'Keep working — no break',     riskLevel: 'low',    detail: 'Income continues; no savings draw-down. NI record intact.' },
      { id: 'short_break',  label: '3-month break (cash-funded)', riskLevel: 'medium', detail: 'Emergency fund covers 3 months. Career re-entry straightforward.' },
      { id: 'full_sabbat',  label: '6–12 month sabbatical',       riskLevel: 'high',   detail: 'Investment portfolio + savings bridge. NI gap + career re-entry risk.' },
    ],
    'DE-32': [
      { id: 'cash_hold',   label: 'Park in savings — no action',  riskLevel: 'high',   detail: 'Capital idle; inflation erodes real value over time.' },
      { id: 'pension_wrap',label: 'Max pension contribution',      riskLevel: 'low',    detail: 'Use AA headroom. 40–45% tax relief; IHT-free from April 2027.' },
      { id: 'diversified', label: 'Pension + ISA + invest GIA',   riskLevel: 'medium', detail: 'Layer wrappers: pension → ISA → GIA. Optimises tax and liquidity.' },
    ],
    'DE-33': [
      { id: 'bank_hold',   label: 'Hold in bank account',           riskLevel: 'high',   detail: 'No strategy. Taxed on interest; no growth plan.' },
      { id: 'wrap_max',    label: 'ISA + pension + GIA waterfall',  riskLevel: 'medium', detail: 'Max ISA (£20k) + pension (AA headroom) + remainder in GIA.' },
      { id: 'property',    label: 'Deploy into BTL property',       riskLevel: 'high',   detail: 'Income-generating but illiquid. §24 applies to interest.' },
    ],
    'DE-34': [
      { id: 'clean_break',  label: 'Clean-break settlement',         riskLevel: 'low',    detail: 'No ongoing dependency. Pension sharing order recommended.' },
      { id: 'maintenance',  label: 'Spousal maintenance order',      riskLevel: 'medium', detail: 'Monthly income; reviewable. Ongoing financial link.' },
      { id: 'deferred',     label: 'Deferred sale of family home',   riskLevel: 'high',   detail: 'Mesher order — home sold on trigger event (youngest child 18). CGT deferred.' },
    ],
    'DE-35': [
      { id: 'no_badr',    label: `Sell without BADR — ${_pc(TAX.cgtHigher)} CGT`,   riskLevel: 'high',   detail: 'Full CGT rate. No planning.' },
      { id: 'badr_claim', label: `BADR — ${_pc(TAX.badrRate)} on first ${_gbp(TAX.badrLifetimeLimit)} gain`,  riskLevel: 'low',    detail: `Ensure 2yr qualifying period met. Trustees check. Max lifetime gain ${_gbp(TAX.badrLifetimeLimit)}.` },
      { id: 'earnout',    label: 'Staged earnout structure',       riskLevel: 'medium', detail: 'Spread proceeds over 2–3 years. Tax payment deferred; BADR on each tranche.' },
    ],
    'DE-36': [
      { id: 'repay_loan',  label: 'Repay director loan',             riskLevel: 'low',    detail: 'Clears S455 exposure. No tax cost. Requires company liquidity.' },
      { id: 'div_clear',   label: 'Declare dividend to clear',       riskLevel: 'medium', detail: `Tax at ${_pc(TAX.dividendBR)}–${_pc(TAX.dividendAR)}. Avoids S455 if dividend before year-end.` },
      { id: 'write_off',   label: 'Write off loan (BIK + CT)',       riskLevel: 'high',   detail: 'Taxed as employment income + BIK charge. Rarely optimal.' },
    ],
    'DE-37': [
      { id: 'keep_db',    label: 'Retain DB scheme',               riskLevel: 'low',    detail: 'Guaranteed income; inflation-linked. Safeguarded benefit. Default for most.' },
      { id: 'transfer_dc',label: 'Transfer to SIPP (CETV)',        riskLevel: 'high',   detail: `Requires FCA-regulated advice if CETV > ${_gbp(TAX.safeguardedAdviceThreshold)}. Loses guarantees.` },
      { id: 'partial_xfer',label: 'Partial transfer (AVC only)',   riskLevel: 'medium', detail: 'Transfer AVC element only; retain defined benefit core.' },
    ],
    'DE-38': [
      { id: 'full_drawdown', label: 'Continue full flexi-drawdown',  riskLevel: 'high',   detail: 'Full investment risk; longevity risk retained.' },
      { id: 'partial_annuity',label: 'Part-annuity part-drawdown',  riskLevel: 'medium', detail: 'Guaranteed income floor + growth potential. Sequence-of-returns hedge.' },
      { id: 'full_annuity',  label: 'Full annuity now',             riskLevel: 'low',    detail: 'Longevity insured. No growth upside. Rate locks in at purchase.' },
    ],
    'DE-39': [
      { id: 'stay_uk',     label: 'Remain UK resident',            riskLevel: 'low',    detail: 'No exit charge. Continue UK tax treatment.' },
      { id: 'plan_exit',   label: 'Plan residency exit carefully', riskLevel: 'medium', detail: 'Statutory Residence Test: ≤15 ties / ≤45 days. Prepare deemed disposal.' },
      { id: 'immediate_exit',label: 'Immediate departure this year', riskLevel: 'high', detail: 'Deemed disposal triggers immediately. CGT on unrealised gains. Seek advice.' },
    ],
    'DE-40': [
      { id: 'self_fund',   label: 'Self-fund from assets/income',  riskLevel: 'medium', detail: 'Full control. Assets depleted but estate control maintained.' },
      { id: 'deferred_payment',label: 'Deferred payment agreement', riskLevel: 'medium', detail: 'LA charges against property; paid on death/sale. Interest ~7%/yr.' },
      { id: 'ltc_insurance',label: 'LTC insurance / immediate annuity', riskLevel: 'low', detail: 'Guaranteed care costs. Expensive; must buy before care needed.' },
    ],
  }

  const paths = (pathDefs[decisionType] || [
    { id: 'none',   label: 'Take no action',       riskLevel: 'high',   detail: 'Status quo maintained.' },
    { id: 'action', label: 'Implement this change', riskLevel: 'medium', detail: 'Impact depends on current position.' },
  ]).map(p => ({
    ...p,
    simulation: simulateAction(entity, decisionType, { pathId: p.id, riskLevel: p.riskLevel }),
  }))

  return paths
}

// ── generateRecommendation ───────────────────────────────────────────────────

/**
 * Produce a plain-English recommendation for the chosen decision path.
 * Returns { summary, steps, sources, fcaBoundary, confidence, impact }
 */
export function generateRecommendation(entity, decisionType, chosenPath) {
  const sim     = simulateAction(entity, decisionType, chosenPath ? { pathId: chosenPath.id, riskLevel: chosenPath.riskLevel } : {})
  const nwGain  = sim.delta.nw
  const fqGain  = sim.delta.fq
  const ihtSave = Math.abs(sim.delta.iht)
  const age     = _age(entity)
  const income  = _annualIncome(entity)
  const aa      = TAX.pensionAA || 60000

  // Match the UI formatter: exact with commas below £10k, £k to £999k, £m above.
  const _fmt = (n) => {
    const a = Math.abs(n), s = n < 0 ? '−' : ''
    if (a >= 1_000_000) return `${s}£${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}m`
    if (a >= 10_000)    return `${s}£${Math.round(a / 1000)}k`
    return `${s}£${Math.round(a).toLocaleString('en-GB')}`
  }
  // Exact comma-formatted £ + trailing-zero-stripped % — for interpolating live
  // TAX thresholds/rates into copy (no hardcoded figures in user-facing strings).
  const _gbp = (n) => `£${Math.round(n).toLocaleString('en-GB')}`
  const _pc  = (r) => `${+(r * 100).toFixed(2)}%`

  const summaries = {
    'DE-01': `Phased drawdown spreads your SIPP income across multiple tax years, keeping you in the basic-rate band (up to ${_gbp(TAX.brt)}) and saving meaningful income tax versus a single crystallisation. Over ${sim.horizon} years the tax difference compounds materially.`,
    'DE-02': `Deferring annuity purchase by ${sim.horizon} years could increase your guaranteed income by 20–30% at today's gilt rates. The break-even depends on longevity — get a quote at each review year before committing.`,
    'DE-03': `Increasing your pension contribution exploits tax relief at your marginal rate — every £1 contributed costs less than £1 net. At age ${age} you have ${Math.max(0, 57 - age)} years of sheltered compounding before minimum access age.`,
    'DE-04': `Routing overflow above your workplace scheme into a SIPP gives you investment flexibility while still capturing the employer match. SIPP also removes the pot from your estate (relevant from April 2027).`,
    'DE-05': `Salary sacrifice reduces your National Insurance bill (15% employer + 8% employee on the sacrificed portion). The NI saving alone — ${_fmt(income * 0.05 * (TAX.employerNICRate ?? 0.15))} annually at 5% sacrifice — is pure gain before investment returns.`,
    'DE-09': `Based on the ranked paths, ${chosenPath?.label || 'the top path'} scores highest against your weights. ${nwGain > 0 ? `Projected net-worth benefit: ${_fmt(nwGain)} over ${sim.horizon} years.` : ''} ${ihtSave > 0 ? `IHT exposure reduced by ~${_fmt(ihtSave)}.` : ''}`,
    'DE-06': `Stocks & shares ISAs outperform cash over horizons of 5+ years — the real return differential is ~3%/yr historically. A LISA adds a 25% government bonus but locks capital until first home purchase or age 60. Blend S&S ISA with a cash buffer only if you need access within 2–3 years.`,
    'DE-07': `Bed-and-ISA crystallises a small CGT charge now in exchange for sheltering all future gains inside the ISA wrapper. At the £20k annual allowance it takes ${Math.max(1, Math.round((entity?.assets?.gia?.value || 50000) / 20000))} tax years to migrate a typical GIA. Spreading over multiple years uses the annual exempt amount (${_gbp(TAX.cgaAllowance)}) each time to reduce the CGT cost.`,
    'DE-08': `Overpaying delivers a guaranteed risk-free return equal to your mortgage rate (${((entity?.liabilities?.mortgage?.rate || 0.045) * 100).toFixed(1)}%). Investing in equities is expected to outperform over 7+ years but carries sequence-of-returns risk. An offset account gives the rate benefit with full flexibility — best of both if your lender offers it at no premium.`,
    'DE-10': `Fixing for 5 years eliminates refinance risk and budgeting uncertainty. The tracker suits borrowers with a large offset savings pot or who expect base rates to fall materially within 12 months. Offset mortgages save interest on the net balance — powerful if you hold £30k+ in savings.`,
    'DE-11': `Section 24 restricts mortgage interest relief to the basic rate (20%) regardless of your marginal rate. For a higher-rate taxpayer this turns a profitable BTL negative on a net basis. Incorporating removes the restriction but triggers SDLT and CGT on the transfer — model both exit and restructure NPVs before deciding.`,
    'DE-12': `Equity release provides liquidity without a forced property sale, but roll-up interest typically doubles the loan balance every 10–12 years at current rates. The no-negative-equity guarantee protects the estate from a shortfall but will consume most or all property value if you live into your late 80s. A drawdown facility minimises roll-up by delaying draws.`,
    'DE-13': `Six months of net expenditure (${_fmt(income * 0.7 / 2)}) is the standard emergency fund target. Holding excess beyond that in a current account destroys real value — easy-access savings at 4.5% or premium bonds are materially better at identical risk. Anything above 6 months should be laddered into short-dated bonds.`,
    'DE-14': `A 12-rung monthly bond ladder yields ~${((0.048 + 0.051) / 2 * 100).toFixed(1)}% on the 12-month tranche while keeping one tranche liquid each month. This beats instant-access rates (~3.5–4.0%) with no meaningful additional risk. Gilts are backed by HMT and interest is free of CGT.`,
    'DE-15': `The 7-year PET clock starts on the date of the gift. Taper relief reduces the IHT charge on the gift by 20% per year from year 3 onwards — so a gift made at age 65 has a good actuarial chance of escaping IHT entirely. Use the annual exemption (${_gbp(TAX.annualGiftExemption)}, plus the same prior-year carry) first at zero cost before starting the PET clock.`,
    'DE-16': `A bare trust is simplest and cheapest but inflexible — the beneficiary gains absolute entitlement at 18. A discretionary trust preserves family flexibility and protects against beneficiary divorce or bankruptcy, but attracts a 10-year periodic IHT charge of up to 6%. An IIP trust bridges: income beneficiary named now, capital distributed later.`,
    'DE-17': `Mirror wills are simple but leave each spouse's half of joint assets fully exposed to sideways disinheritance on remarriage. A life-interest trust will ring-fences the first spouse's share for children while giving the survivor use of the home and income for life. Appropriate for blended families or where there are children from prior relationships.`,
    'DE-18': `An LPA costs £164 to register (per LPA, 2026) — a fraction of the £3,500+ annual cost of a Court of Protection deputy if you lose capacity without one. The financial LPA is the most urgent; the health LPA covers medical decisions. Both can be set up in the same session with a solicitor or via the Gov.uk portal.`,
    'DE-19': `Level-term life is cheapest per £ of cover and covers the mortgage and income replacement gap. Family income benefit (FIB) pays a monthly income to dependants rather than a lump sum — better matched to cash-flow needs and typically 25% cheaper than an equivalent lump-sum policy. Writing any policy in trust keeps the payout outside your estate.`,
    'DE-20': `Critical illness cover pays a tax-free lump sum on diagnosis of a listed condition — heart attack, stroke, cancer cover ~80% of claims. Topping up to 3× salary buys 3 years of income replacement at zero income-tax cost. Premiums are not tax-deductible (personal policy) so suit tax-efficient surplus income.`,
    'DE-21': `Own-occupation income protection pays if you cannot do your specific job — a surgeon who loses dexterity qualifies even if they could work in a shop. Any-occupation is cheapest but almost never pays for a professional. Defer the excess period to 13 or 26 weeks (matching employer sick pay) to reduce premiums materially.`,
    'DE-22': `The annual CGT exempt amount is now just ${_gbp(TAX.cgaAllowance)} — use it or lose it each April. Selling and rebuying 30+ days later (or immediately into an ISA via bed-and-ISA) resets your base cost at no net cost except the bid-offer spread and any broker fee. Stacking this annually compounds into a meaningful tax saving over time.`,
    'DE-23': `Realising losses in a down market offsets gains from other disposals this year — or carries forward indefinitely to offset future gains. Rebuying inside an ISA (bed-and-ISA) after selling captures the loss and shelters future recovery gains. The 30-day same-asset rule applies; use a spouse account or ISA to rebuy immediately.`,
    'DE-24': `Inter-spouse transfers are free of CGT and IHT. Moving income-producing assets to the lower-rate spouse reduces the household tax bill each year without any gain trigger. Each spouse can also max their own £20k ISA allowance independently — the household tax-free shelter doubles to £40k/yr.`,
    'DE-25': `The optimal director salary is around the ${_gbp(TAX.employerNICThreshold)} secondary NI threshold where employer NI is zero and the personal allowance is largely covered by dividends. Dividends above the basic rate threshold attract ${_pc(TAX.dividendHR)}; pension contributions via the company attract corp tax relief (${_pc(TAX.corpMainRate)}) and no NI — routing surplus above the higher-rate threshold (${_gbp(TAX.brt)}) into a SIPP is usually superior to dividends.`,
    'DE-26': `EIS/SEIS are high-risk investments in early-stage companies — expect 30–50% failure rates in the portfolio. The tax reliefs (${_pc(TAX.seisITRate)} SEIS income relief, CGT deferral, loss relief) can reduce downside to ~15p per £1 invested in the worst case. These suit higher-rate taxpayers with a genuine tolerance for illiquidity over 3+ years.`,
    'DE-27': `VCT income tax relief (${_pc(TAX.vctITRate)}) is the headline attraction, plus tax-free dividends. The 5-year holding requirement and limits on secondary market liquidity are the key constraints. Building a VCT ladder — investing a fixed amount each tax year — smoothes manager and vintage risk. Stick to generalist VCTs from established managers (Octopus, Foresight, Pembroke).`,
    'DE-28': `AIM-listed and unlisted BPR-qualifying investments become IHT-free after just 2 years — faster than the 7-year PET route. The trade-off is investment risk: AIM portfolios carry sector concentration and liquidity risk. Managed BPR funds (Octopus AIM IHT, Foresight) spread across 20–30 names. Confirm qualifying status at inception — not all AIM shares qualify.`,
    'DE-29': `Gift Aid tops up every £1 donated to £1.25 at no cost to you; higher-rate taxpayers reclaim a further 20p via self-assessment (25p if additional-rate). Payroll giving is pre-tax — a 40% taxpayer gives £600 but only costs them £360. Leaving ≥10% of your net estate to charity reduces the IHT rate on the remainder from ${_pc(TAX.ihtRate)} to ${_pc(TAX.ihtRate - 0.04)}.`,
    'DE-30': `School fees planning works best with a long runway. A Junior ISA at ${_gbp(TAX.jisaAllowance)}/yr from birth produces ~£${Math.round(TAX.jisaAllowance * 18 * 1.05 / 1000)}k by age 18 at 5%/yr — enough for independent secondary school fees. Grandparent contributions to JISAs avoid IHT via regular-giving-from-income exemption if structured correctly.`,
    'DE-31': `A career break is affordable if liquid assets cover spending for the break plus a 20% buffer for re-employment lag. Check your NI record — a voluntary contribution of £824 buys one qualifying year if your record has gaps. Negotiate an unpaid leave arrangement rather than resignation where possible to preserve employment rights and employer references.`,
    'DE-32': `The first ${_gbp(TAX.redundancyTaxFree)} of a redundancy payment is tax-free regardless of length of service (statutory or enhanced). The balance is taxed as employment income — pension contributions from the taxable excess attract full tax relief and remove the amount from the income-tax calculation, turning the redundancy into a compounding IHT-free pot.`,
    'DE-33': `An inheritance windfall should be deployed in wrapper priority order: pension (tax relief + April 2027 IHT exemption) → ISA (tax-free growth) → GIA (least tax-efficient, last resort). A 30-day rule of doing nothing immediately prevents regret decisions while markets are volatile or emotions are running high after bereavement.`,
    'DE-34': `A clean-break financial order eliminates ongoing dependency and financial contact — strongly preferred where possible. Pension sharing orders ring-fence pension rights at the date of settlement; offsetting against property is risky as it trades a liquid, growing asset for an illiquid one. CGT between spouses is free in the tax year of separation and for 3 years after — use this window.`,
    'DE-35': `Business Asset Disposal Relief (BADR) reduces CGT to ${_pc(TAX.badrRate)} on the first ${_gbp(TAX.badrLifetimeLimit)} of qualifying gains — saving up to ${_gbp(TAX.badrLifetimeLimit * (TAX.cgtHigher - TAX.badrRate))} versus the standard ${_pc(TAX.cgtHigher)} rate. The 2-year qualifying period (≥5% shares, trading company, officer or employee) must be met at completion. Structuring via an earnout can spread proceeds and preserve BADR on each tranche.`,
    'DE-36': `A Section 455 charge of ${_pc(TAX.s455Rate)} applies to outstanding director loans at the company year-end (9 months to pay). Declaring a dividend to clear the loan is almost always cheaper than the S455 — but the dividend must be legal (sufficient distributable reserves). Repaying from personal funds is cleanest and avoids any income tax event.`,
    'DE-37': `Pension transfer advice is mandatory if the CETV exceeds ${_gbp(TAX.safeguardedAdviceThreshold)}. For most people, the DB guarantee (inflation-linked, spouse's pension, no investment risk) is worth retaining. Transfer to DC makes sense primarily for those with short life expectancy, no dependants, and a desire for IHT-free legacy (from April 2027 SIPPs enter the estate — verify current rules at the point of transfer).`,
    'DE-38': `A partial annuity — buying a guaranteed income floor while retaining a drawdown pot — hedges longevity risk without sacrificing all growth potential. The annuity rate is highest when bought late (rates rise with age); deferring by 5 years typically adds 25–30% to the annual income. Model the crossover point between annuity income and drawdown depletion at your life expectancy.`,
    'DE-39': `UK tax residency exit requires satisfying the Statutory Residence Test — broadly, spending ≤16 days in the UK (automatic non-resident) or navigating the sufficient ties test. Deemed disposal of assets triggers a CGT event on exit; rebasing base costs in the new jurisdiction may partially offset this. UK residential property gains remain taxable in the UK regardless of residence.`,
    'DE-40': `Local authority care funding kicks in only when assets fall below ${_gbp(TAX.laCareUpperCapital)} (England). Self-funding gives choice of provider and room type; the deferred payment agreement preserves assets while in care but rolls up at ~7% interest. A long-term care immediate-needs annuity (INA) — bought at the point of entering care — provides certainty and removes the longevity risk of self-funding.`,
  }

  const stepSets = {
    'DE-01': [
      'Map your SIPP value and current drawdown rate',
      `Model income against the basic-rate threshold (${_gbp(TAX.brt)}) each year`,
      'Instruct your scheme to phase payments across tax years',
      'Review annually — thresholds change with each Budget',
    ],
    'DE-02': [
      'Get annuity quotes now to establish a baseline rate',
      'Model longevity break-even (typically age 82–85)',
      'Set a diary reminder to requote every 12 months until purchase',
      'Consider flexi-access drawdown as a bridge while deferring',
    ],
    'DE-03': [
      'Check unused carry-forward allowances (3 prior tax years)',
      `Confirm your annual allowance — tapered if adjusted income > ${_gbp(TAX.taperedAAAdj)}`,
      'Instruct your scheme to increase contribution',
      'Consider lump-sum contribution if carry-forward is available',
    ],
    'DE-04': [
      'Confirm employer match rate and scheme cut-off point',
      'Open a SIPP if you don\'t already have one',
      'Redirect earnings above employer-match threshold to SIPP',
      'Review investment options in each wrapper for cost efficiency',
    ],
    'DE-05': [
      'Check your employer offers salary sacrifice (most do)',
      'Calculate NI saving: sacrificed amount × 0.15 (employer NI saved)',
      'Submit sacrifice election before payroll cut-off',
      'Review annually if salary or allowances change',
    ],
    'DE-09': [
      'Confirm property value and CGT gain (current value minus purchase price + costs)',
      `Calculate CGT liability at ${_pc(TAX.cgtHigher)} on gain above the annual exempt amount (${_gbp(TAX.cgaAllowance)})`,
      'Model post-CGT proceeds split across ISA + pension wrappers',
      'Get a letting agent appraisal if considering BTL',
    ],
    'DE-06': [
      'Check your goal horizon: <2yr → cash ISA; 2–5yr → split; 5yr+ → S&S ISA',
      'If under 40 and saving for a first home, open a LISA (£4k/yr, 25% bonus)',
      'Max the £20k ISA allowance before April 5th each year — it does not roll over',
      'Review fund charges: S&S ISA TER should be ≤0.20% for index funds',
    ],
    'DE-07': [
      'Identify GIA holdings with unrealised gains and their base cost',
      `Calculate CGT on bed: (sale proceeds − base cost − ${_gbp(TAX.cgaAllowance)} exempt) × ${_pc(TAX.cgtHigher)}`,
      'Sell in GIA; wait 30 days and rebuy (or use spouse/ISA to rebuy immediately)',
      'Set a diary reminder each April to repeat for next year\'s £20k ISA allowance',
    ],
    'DE-08': [
      'Check mortgage terms: overpayment limits (usually 10%/yr penalty-free)',
      'Compare mortgage rate vs likely net investment return after tax',
      'If lender offers offset, calculate interest saved on your average cash balance',
      'Review annually when fixed rate is within 6 months of expiry',
    ],
    'DE-10': [
      'Get comparison quotes from a whole-of-market mortgage broker 3–6 months before expiry',
      'Compare 2yr vs 5yr fixes: model break-even if rates move ±1%',
      'Check Early Repayment Charge (ERC) on current deal before switching',
      'If you have £30k+ savings, ask specifically for offset mortgage options',
    ],
    'DE-11': [
      `Calculate your net rental profit after Section 24 (interest at ${_pc(TAX.br)} relief only)`,
      'Model BTL in Ltd Co: corp tax vs personal income tax; SDLT + CGT on transfer',
      'Get a RICS valuation if considering sale — CGT base cost needs verification',
      'Review annually after October Budget for any BTL policy changes',
    ],
    'DE-12': [
      'Get at least 3 equity release quotes via an Equity Release Council-approved adviser',
      'Model roll-up interest at 6–7%/yr — project balance at age 85, 90, 95',
      'Check if drawdown facility is available (reduces interest roll-up)',
      'Discuss inheritance protection guarantee with family before proceeding',
    ],
    'DE-13': [
      'Calculate 3-month and 6-month net spending targets',
      'Move emergency fund from current account to easy-access savings (4.5%) now',
      'Consider Premium Bonds for amounts above £10k (tax-free; FSCS-equivalent)',
      'Review once per year and top up if spending has increased',
    ],
    'DE-14': [
      'Identify the total cash pool to ladder (above your 1-month instant access buffer)',
      'Buy 12 fixed-term bonds/gilts maturing monthly over the next year',
      'On each maturity, reinvest proceeds into a new 12-month bond',
      'Use a platform that allows gilt purchases at no dealing charge (e.g. interactive investor)',
    ],
    'DE-15': [
      `Use the ${_gbp(TAX.annualGiftExemption)} annual exemption first (plus prior year carry if unused)`,
      'Document gift date, amount, and recipient — needed for executors later',
      'Do not put conditions on the gift — must be unconditional to qualify as PET',
      `Review with solicitor if total lifetime gifts exceed the ${_gbp(TAX.nrb)} NRB`,
    ],
    'DE-16': [
      'Define the trust objective: control (discretionary) vs simplicity (bare)',
      'Choose trustees — at least two, ideally a professional for discretionary trusts',
      'Instruct a solicitor to draft the trust deed — typical cost £1,500–£3,000',
      'Register with HMRC Trust Registration Service within 90 days of creation',
    ],
    'DE-17': [
      'List all assets and whether they are owned jointly or solely',
      'Decide on executors and guardians (for minor children) before the solicitor appointment',
      'If blended family, consider a life-interest trust for the family home',
      'Sign and witness the will correctly — keep original with solicitor, copy at home',
    ],
    'DE-18': [
      'Download the LPA forms from gov.uk or instruct a solicitor',
      'Choose your attorneys — people you trust absolutely; separate choices for financial vs health',
      'Register both LPAs with the Office of the Public Guardian (£164 per LPA)',
      'Inform your bank once registered — some banks require a certified copy',
    ],
    'DE-19': [
      'Calculate your protection gap: outstanding mortgage + income × years to retirement',
      'Get quotes for level-term, FIB, and whole-of-life — compare on a monthly premium basis',
      'Write the policy in trust on the same day as inception — free and immediate',
      'Review coverage when mortgage balance changes or after each child is born',
    ],
    'DE-20': [
      'Check any existing group CI via employer benefits — it counts toward total coverage',
      'Target at least 2× salary for a single person; 3× for primary earner with dependants',
      'Request full definitions of "critical illness" — not all policies cover the same conditions',
      'Review when you have a material change in health — pre-existing conditions affect terms',
    ],
    'DE-21': [
      'Confirm your employer\'s sick pay period — set deferred period to match (13 or 26 weeks)',
      'Insist on own-occupation definition unless budget forces any-occupation',
      'Cover at least 50–60% of gross income (HMRC limits IP benefit to ~65%)',
      'Index-link the benefit to inflation — fixed benefits erode in real terms over a career',
    ],
    'DE-22': [
      'Identify GIA holdings with unrealised gains below £3,000 net',
      'Sell those holdings before April 5th to use this year\'s exempt amount',
      'Wait 30 days and rebuy in GIA (or rebuy inside ISA immediately)',
      'Document disposal proceeds and base cost for your self-assessment return',
    ],
    'DE-23': [
      'Identify GIA holdings with unrealised losses — sort by loss size',
      'Check if you have capital gains this year to offset (including property disposals)',
      'Sell the loss-making holdings before April 5th to crystallise the loss this tax year',
      'Report losses on self-assessment even if no gain this year — they carry forward indefinitely',
    ],
    'DE-24': [
      'Identify income-producing assets: rental property, GIA dividends, savings interest',
      'Transfer asset to lower-rate spouse via a written declaration (property: TR1 form)',
      'Ensure both spouses use their full £20k ISA allowance each year independently',
      'Revisit if income levels change significantly (promotion, career break)',
    ],
    'DE-25': [
      `Set salary around the ${_gbp(TAX.employerNICThreshold)} secondary NI threshold for the year`,
      'Pay remainder as dividends — declare from distributable reserves only',
      'Route surplus above dividend basic-rate band into employer pension contribution',
      'Review annually after each Budget as dividend rates and thresholds change',
    ],
    'DE-26': [
      'Confirm EIS/SEIS qualifying status with the company (HMRC advance assurance)',
      'Request SEIS3/EIS3 certificate after investment — needed for tax relief claim',
      'Claim relief via self-assessment in the tax year of investment (or carry back one year)',
      'Treat EIS/SEIS as a 3+ year illiquid holding — build a portfolio of 10+ companies',
    ],
    'DE-27': [
      'Research VCT managers: 5yr NAV total return and dividend record',
      'Invest before April 5th each tax year — relief allocated to that year',
      'Hold for minimum 5 years — selling early triggers relief clawback',
      'Diversify across 2–3 VCT managers to reduce single-manager concentration risk',
    ],
    'DE-28': [
      'Verify BPR eligibility of target investments with the manager upfront',
      'Start the 2-year qualifying clock immediately — do not wait until later',
      'Reinvest dividends within the portfolio to maintain qualifying status',
      'Keep BPR portfolio invested continuously — any gap resets the 2-year clock',
    ],
    'DE-29': [
      'Claim Gift Aid on all donations — give the charity your self-assessment status',
      'Higher-rate taxpayers: claim additional relief via self-assessment (20% reclaim)',
      'Set up payroll giving via employer if available — pre-tax giving at no admin cost',
      'If planning a legacy, instruct your solicitor to include the 10% charitable gift clause',
    ],
    'DE-30': [
      `Open a Junior ISA (${_gbp(TAX.jisaAllowance)}/yr allowance) as early as possible — compounding time is key`,
      'Model total fee cost: confirm school choice and fee inflation assumption (typically 4–5%/yr)',
      'Consider grandparent contributions — regular gifts from income are IHT-free if habitual',
      'Review at age 12 — switch to lower-risk investments as fees are 6 years away',
    ],
    'DE-31': [
      'Calculate total cost of break: monthly spend × months + re-entry buffer (2–3 months)',
      'Check liquid assets: cash savings + ISA withdrawable without penalty',
      'Verify NI record — buy voluntary Class 3 NICs (£824/yr) for any gaps before leaving',
      'Negotiate unpaid leave or sabbatical with employer before resigning',
    ],
    'DE-32': [
      `Confirm tax-free element — first ${_gbp(TAX.redundancyTaxFree)} is free regardless of service length`,
      'Calculate tax on the excess and model pension contribution to reduce income-tax charge',
      'Deploy in wrapper order: pension (AA headroom) → ISA → emergency fund → GIA',
      'Do not make irreversible investment decisions within 30 days of redundancy',
    ],
    'DE-33': [
      'Pause 30 days before deploying — emotional decisions after bereavement rarely optimal',
      'Check pension annual allowance headroom — inheritance can fund a large pension top-up',
      'Max ISA this year and next (£20k each) — inheritance funds can be used for regular ISA',
      'If inheritance is very large (>£500k), engage a fee-only IFA for a full financial plan',
    ],
    'DE-34': [
      'Ensure a financial order is made by the court — verbal agreements are not binding',
      'Get a pension sharing order if either party has a defined benefit pension',
      'Do not transfer assets out of the matrimonial home without legal advice — may prejudice settlement',
      'Review wills and LPAs immediately on separation — they may still name your ex',
    ],
    'DE-35': [
      'Verify BADR eligibility: ≥5% share, trading company, officer/employee for ≥2 years',
      'Instruct a tax adviser to review the deal structure before heads of terms are signed',
      'Consider deferred consideration (earnout) to spread CGT across tax years',
      'Deploy sale proceeds: pension (up to AA) → ISA → EIS/SEIS for further relief',
    ],
    'DE-36': [
      'Check the company year-end date — S455 applies to loans outstanding 9 months after year-end',
      'Confirm available distributable reserves before declaring a dividend to clear the loan',
      'If repaying from personal funds, document the repayment date clearly for HMRC',
      'Review DLA policy in articles of association — some limit director borrowing',
    ],
    'DE-37': [
      'Request a full CETV statement (valid 3 months) from the DB scheme',
      `Obtain a pension transfer analysis from a pension transfer specialist (PTS) — mandatory for CETV > ${_gbp(TAX.safeguardedAdviceThreshold)}`,
      'If transferring, choose a SIPP with a wide investment mandate and low platform costs',
      'Retain a copy of all advice documents — needed for scheme administrator and HMRC',
    ],
    'DE-38': [
      'Get an annuity quote for 50% of the remaining SIPP at current rates',
      'Model the guaranteed income floor vs projected drawdown income at your target spending level',
      'Compare with deferring the annuity 3–5 years — rate uplift may justify waiting',
      'Nominate your drawdown pot beneficiaries in writing — SIPP nomination form with provider',
    ],
    'DE-39': [
      'Run the Statutory Residence Test (HMRC RDRM) for the proposed departure year',
      'Instruct a cross-border tax adviser before the start of the tax year of departure',
      'Review deemed disposal rules — file a departure return with HMRC in the year of exit',
      'Consider timing disposals: gains accrued before departure may be rebased in destination country',
    ],
    'DE-40': [
      'Request a financial assessment from the local authority — triggers the deferred payment option',
      'Get a quote for an immediate-needs annuity (INA) from Bupa, Legal & General, or similar',
      'Compare self-funding NPV vs INA: INA wins if you live significantly beyond average care duration',
      'Update the LPA and will to reflect the care-funding strategy chosen',
    ],
  }

  return {
    summary:     summaries[decisionType] || `Taking action on ${decisionType} has a projected net-worth impact of ${_fmt(nwGain)} over ${sim.horizon} years.`,
    steps:       stepSets[decisionType] || ['Review your current position', 'Quantify the headroom available', 'Take the first action', 'Set a review reminder'],
    sources:     ['From your data', 'UK 2026/27 tax rules', 'Sonuswealth engine'],
    fcaBoundary: FCA_BOUNDARY,
    confidence:  sim.confidence,
    impact:      { nwGain, fqGain, ihtSave, horizon: sim.horizon },
    // Methodology receipt (founder 2026-06-06) — how this was worked out, traceable
    // to bedrock: your data + named, dated tax rules + the assumptions used.
    methodology: {
      basis: 'Worked out from your own assets and income, run against the current UK tax rules.',
      assumptions: [
        `Investment growth assumed at ${_pc(TAX.growthDefault ?? 0.05)} a year, before charges and inflation.`,
        'Figures are shown in today’s money.',
        `Projected over ${sim.horizon} years.`,
        chosenPath ? `Based on the option: ${(chosenPath.plainLabel || chosenPath.title || chosenPath.label || '').replace(/\.$/, '')}.` : null,
      ].filter(Boolean),
      rules: [
        { name: 'Inheritance tax rate', value: _pc(TAX.ihtRate), status: 'In force' },
        { name: 'Pensions counted in your estate', value: 'from April 2027', status: 'Enacted (Royal Assent, March 2026)' },
        { name: 'Pension annual allowance', value: _gbp(TAX.pensionAA || 60000), status: 'In force' },
      ],
      rulesVersion: 'UK 2026/27',
    },
  }
}

// ── stressTest ───────────────────────────────────────────────────────────────

/**
 * Re-run the chosen option against three setbacks, using the user's OWN assets,
 * so "what is it testing against?" has a real answer. Deterministic worst-case
 * (a fuller scenario simulation is Phase 2). Returns per-shock £ impacts on the
 * user's actual position + a resilience verdict for the chosen option.
 */
export function stressTest(entity, decisionType, path) {
  const sim     = path?.simulation
    || simulateAction(entity, decisionType, path ? { pathId: path.id, riskLevel: path.riskLevel } : {})
  const nwGain  = sim?.delta?.nw || 0
  const horizon = sim?.horizon || 10
  const nw      = _nw(entity)
  const num     = (v) => +v || 0
  const r       = (n) => Math.round(n)
  const a       = entity?.assets || {}

  // Market-exposed assets (equities held in ISA / GIA / SIPP / pensions / investments).
  const equityExposure =
      num(a.isa?.value) + num(a.gia?.value) + num(a.sipp?.total)
    + (Array.isArray(a.pensions)    ? a.pensions.reduce((s, p) => s + num(p.balance_gbp || p.value || p.total), 0) : 0)
    + (Array.isArray(a.investments) ? a.investments.reduce((s, p) => s + num(p.value || p.balance_gbp || p.balance), 0) : 0)
  const mortgage =
      num(entity?.liabilities?.mortgage?.balance)
    + (Array.isArray(entity?.liabilities)
        ? entity.liabilities.filter(l => /mortgage/i.test(l.type || '')).reduce((s, l) => s + num(l.balance || l.balance_gbp), 0)
        : 0)

  const shocks = [
    {
      id: 'market', label: 'Markets fall 30%',
      plain: 'A sharp stock-market drop, like 2008 or 2020.',
      affects: equityExposure > 0 ? 'Your investments and pensions' : 'You hold little in the markets',
      impact: -(r(equityExposure * 0.30)),
    },
    {
      id: 'rates', label: 'Interest rates rise 2%',
      plain: 'Borrowing costs more; some savings pay a little more.',
      affects: mortgage > 0 ? 'Your mortgage and other borrowing (per year)' : 'You have little borrowing to be hit',
      impact: -(r(mortgage * 0.02)),
    },
    {
      id: 'inflation', label: 'Inflation runs at 6%',
      plain: 'Prices rise faster than planned, so your money buys less.',
      affects: 'The real value of your whole position (per year)',
      impact: -(r(Math.max(nw, 0) * (0.06 - 0.025))),
    },
  ]

  // Resilience of the CHOSEN option (not the whole portfolio): guaranteed / cash /
  // status-quo options ride these out; growth-reliant options are more exposed.
  const resilience = path?.riskLevel === 'high'
    ? 'sensitive'
    : path?.riskLevel === 'low' ? 'resilient' : 'moderate'

  return { shocks, nwGain, horizon, resilience, exposure: { equityExposure: r(equityExposure), mortgage: r(mortgage) } }
}
