// ─────────────────────────────────────────────────────────────────────────────
// LENS: IFA (HOLISTIC)
//
// Perspective: a UK Independent Financial Adviser doing a holistic suitability
// review. Concerns: asset allocation vs life stage, risk capacity vs tolerance,
// emergency fund, costs (TER, platform), rebalancing discipline, diversification,
// concentration risk, suitability evidence trail.
//
// Distinct from Tax Accountant (year-end tax optimisation), Pension Specialist
// (pension-rule depth), and Trust Lawyer (estate transfer). The IFA owns the
// holistic picture: are you on track for your goals given your risk profile?
//
// Citations:
//   FCA   = Financial Conduct Authority handbook
//   COBS  = Conduct of Business Sourcebook (suitability requirements)
//   CFA   = CFA Institute portfolio construction principles
// ─────────────────────────────────────────────────────────────────────────────

import {
  SEVERITY, URGENCY, fmt, pct,
  ageAt, grossAssets, grossIncome,
  observation, recommendation, redFlag,
} from './_base.js';

const REF = {
  TARGET_EQUITY_BY_AGE: [   // rule-of-thumb: 110-age (mild defensive)
    { ageMax: 30, equity: 0.90 },
    { ageMax: 40, equity: 0.85 },
    { ageMax: 50, equity: 0.75 },
    { ageMax: 60, equity: 0.65 },
    { ageMax: 70, equity: 0.55 },
    { ageMax: 80, equity: 0.45 },
    { ageMax: 99, equity: 0.35 },
  ],
  EMERGENCY_FUND_MONTHS_MIN: 3,
  EMERGENCY_FUND_MONTHS_TARGET: 6,
  TER_BENCHMARK_LOW: 0.0045,           // 0.45% — fair platform + low-cost trackers
  TER_BENCHMARK_HIGH: 0.0095,          // above this = costly
  REBALANCE_BAND_TOLERANCE: 0.05,      // 5% drift triggers rebalance
  SINGLE_STOCK_CONCENTRATION_WARN: 0.10,  // 10% in one position = flag
  ANNUAL_REVIEW_MONTHS: 12,
};

function targetEquityFor(age) {
  const band = REF.TARGET_EQUITY_BY_AGE.find(b => age <= b.ageMax)
  return band?.equity ?? 0.50
}

function computeAssetMix(persona) {
  const a = persona.assets || {}
  const cash = (a.cash?.value ?? 0) + (a.cash?.total ?? 0)
  const isa  = a.isa?.value ?? 0
  const gia  = a.portfolio?.value ?? 0
  const sipp = a.sipp?.total ?? 0
  const property = (a.residence?.value ?? 0) +
                   ((Array.isArray(a.property) ? a.property : []).reduce((s, p) => s + (+p.estimatedValue || +p.value || 0), 0))
  // Heuristic equity proportion within wrappers:
  //   ISA/SIPP: assume 80% equity (typical accumulator)
  //   GIA: assume 90% equity (lower wrappers = more discretionary)
  //   Cash: 0% equity
  //   Property: 0% equity (not in liquid mix; excluded from rebalance math)
  const liquidEquity = isa * 0.80 + sipp * 0.80 + gia * 0.90
  const liquidTotal = isa + sipp + gia + cash
  const equityPct = liquidTotal > 0 ? liquidEquity / liquidTotal : 0
  return { cash, isa, gia, sipp, property, liquidTotal, equityPct }
}

export const lens = {
  id: 'ifa-holistic',
  name: 'IFA (Holistic)',
  short_name: 'IFA',
  display_avatar: '📊',
  expertise_domain: ['allocation', 'risk', 'cashflow', 'suitability', 'costs', 'rebalancing'],
  description: 'A UK Independent Financial Adviser running a holistic suitability review — allocation, risk, costs, emergency fund.',

  // ─── RELEVANCE ─────────────────────────────────────────────────────────────
  is_relevant(persona) {
    const assets = grossAssets(persona)
    if (assets < 50000) return { score: 0.4, reason: 'Limited liquid wealth — review of basics still valuable' }
    return { score: 0.9, reason: 'Holistic suitability review valuable across allocation, risk, and costs' }
  },

  // ─── OBSERVE ───────────────────────────────────────────────────────────────
  observe(persona, asOfDate = new Date()) {
    const obs = []
    const age = ageAt(persona, asOfDate) ?? 0
    const mix = computeAssetMix(persona)
    const monthlyExp = persona.monthlyExpenditure ?? 0
    const lastReviewMonths = persona.last_review_months_ago ?? null

    // OBS-1: Allocation vs target
    if (mix.liquidTotal > 50000) {
      const target = targetEquityFor(age)
      const drift = mix.equityPct - target
      if (Math.abs(drift) > REF.REBALANCE_BAND_TOLERANCE) {
        obs.push(observation({
          id: 'IFA-OBS-01',
          severity: Math.abs(drift) > 0.15 ? SEVERITY.HIGH : SEVERITY.MEDIUM,
          category: 'allocation',
          text: `Liquid portfolio is ${pct(mix.equityPct)} equity vs life-stage target ${pct(target)} for age ${age}. Drift ${drift > 0 ? '+' : ''}${pct(drift)} — ${drift > 0 ? 'over-exposed to equity volatility going into decumulation' : 'under-exposed; growth runway diminished'}.`,
          citation: 'FCA COBS 9 (suitability) + CFA Institute Lifecycle Investing',
          finding: { actualEquity: mix.equityPct, targetEquity: target, drift },
        }))
      } else {
        obs.push(observation({
          id: 'IFA-OBS-01b',
          severity: SEVERITY.LOW,
          category: 'allocation',
          text: `Allocation ${pct(mix.equityPct)} equity is within ${pct(REF.REBALANCE_BAND_TOLERANCE)} of life-stage target ${pct(target)}. Continue annual rebalancing.`,
          citation: 'FCA COBS 9 + CFA Institute',
          finding: { actualEquity: mix.equityPct, targetEquity: target },
        }))
      }
    }

    // OBS-2: Emergency fund vs monthly expenditure
    if (monthlyExp > 0) {
      const months = mix.cash / monthlyExp
      if (months < REF.EMERGENCY_FUND_MONTHS_MIN) {
        obs.push(observation({
          id: 'IFA-OBS-02',
          severity: SEVERITY.HIGH,
          category: 'emergency_fund',
          text: `Cash buffer ${fmt(mix.cash)} covers only ${months.toFixed(1)} months of expenses (${fmt(monthlyExp)}/mo). Below 3-month FCA-recommended minimum. A shock forces selling growth assets at a low.`,
          citation: 'FCA Financial Lives Survey 2024',
          finding: { cashMonths: months, monthlyExp, cashBuffer: mix.cash },
        }))
      } else if (months < REF.EMERGENCY_FUND_MONTHS_TARGET) {
        obs.push(observation({
          id: 'IFA-OBS-02b',
          severity: SEVERITY.MEDIUM,
          category: 'emergency_fund',
          text: `Cash buffer ${fmt(mix.cash)} = ${months.toFixed(1)} months of expenses. Above 3-month minimum but below 6-month target — adequate for normal volatility, thin for a redundancy + market drop.`,
          citation: 'FCA Financial Lives Survey 2024',
          finding: { cashMonths: months, monthlyExp, target: REF.EMERGENCY_FUND_MONTHS_TARGET },
        }))
      }
    }

    // OBS-3: Annual review currency
    if (lastReviewMonths != null && lastReviewMonths > REF.ANNUAL_REVIEW_MONTHS) {
      obs.push(observation({
        id: 'IFA-OBS-03',
        severity: lastReviewMonths > 24 ? SEVERITY.HIGH : SEVERITY.MEDIUM,
        category: 'suitability',
        text: `Last formal review ${lastReviewMonths} months ago. FCA suitability requires annual review — circumstances, risk profile, and product appropriateness can drift in 12 months.`,
        citation: 'FCA COBS 9.2 (annual suitability)',
        finding: { lastReviewMonths },
      }))
    }

    // OBS-4: Concentration risk in single holding
    const holdings = persona.assets?.portfolio?.holdings || []
    const totalLiquid = mix.liquidTotal
    holdings.forEach(h => {
      const v = +h.currentValue || +h.value || 0
      const pctOfPortfolio = totalLiquid > 0 ? v / totalLiquid : 0
      if (pctOfPortfolio > REF.SINGLE_STOCK_CONCENTRATION_WARN) {
        obs.push(observation({
          id: 'IFA-OBS-04-' + (h.ticker || h.name || 'pos').toLowerCase(),
          severity: pctOfPortfolio > 0.20 ? SEVERITY.HIGH : SEVERITY.MEDIUM,
          category: 'concentration',
          text: `${h.ticker || h.name || 'Single position'} is ${pct(pctOfPortfolio)} of liquid wealth (${fmt(v)}). Above 10% single-stock concentration threshold — idiosyncratic risk dominates. A scandal, earnings miss, or sector shift could materially damage net worth.`,
          citation: 'CFA Institute diversification principles + FCA COBS 9',
          finding: { position: h.ticker || h.name, value: v, pctOfPortfolio },
        }))
      }
    })

    // OBS-5: Cash drag (large cash > 18 months of expenses)
    if (monthlyExp > 0 && mix.cash > monthlyExp * 18) {
      const excess = mix.cash - monthlyExp * REF.EMERGENCY_FUND_MONTHS_TARGET
      const dragVsIsa = excess * (0.05 - 0.005)   // assume cash 0.5% vs invested ~5% real return
      obs.push(observation({
        id: 'IFA-OBS-05',
        severity: SEVERITY.MEDIUM,
        category: 'cash_drag',
        text: `Holding ${fmt(mix.cash)} in cash is well above your ${REF.EMERGENCY_FUND_MONTHS_TARGET}-month buffer. Excess ${fmt(excess)} earning <0.5% loses ~${fmt(dragVsIsa)}/yr in real terms vs equivalent diversified portfolio.`,
        citation: 'CFA Institute opportunity-cost principles',
        finding: { cash: mix.cash, excess, annualDrag: dragVsIsa },
      }))
    }

    return obs
  },

  // ─── RECOMMEND ─────────────────────────────────────────────────────────────
  recommend(persona, asOfDate = new Date()) {
    const recs = []
    const age = ageAt(persona, asOfDate) ?? 0
    const mix = computeAssetMix(persona)
    const monthlyExp = persona.monthlyExpenditure ?? 0
    const target = targetEquityFor(age)
    const drift = mix.equityPct - target

    // REC-1: Rebalance if drift > 5%
    if (Math.abs(drift) > REF.REBALANCE_BAND_TOLERANCE && mix.liquidTotal > 50000) {
      const rebalanceAmount = Math.abs(drift) * mix.liquidTotal
      const direction = drift > 0 ? 'reduce equity' : 'increase equity'
      recs.push(recommendation({
        id: 'IFA-REC-01',
        strategy_id: 'STRAT-REBALANCE',
        headline: `Rebalance — ${direction} by ${fmt(rebalanceAmount)} to hit ${pct(target)} target`,
        drill_down: `Your liquid mix is ${pct(mix.equityPct)} equity vs target ${pct(target)} for age ${age}. Drift of ${pct(Math.abs(drift))} translates to a rebalance of ${fmt(rebalanceAmount)}. Execute inside tax wrappers (SIPP, ISA) to avoid CGT — sell over-weight asset class, buy under-weight class within the same wrapper. If only achievable in GIA, sequence the trades to use your annual ${fmt(3000)} CGT allowance.`,
        action_steps: [
          'Identify which asset classes are over/under-weight',
          'Execute rebalancing trades inside SIPP and ISA first (no CGT)',
          'If GIA rebalancing required, stagger to use £3,000 annual CGT allowance',
          'Set a rebalancing trigger: review when any class drifts >5% from target',
        ],
        impact: { gbp_per_year: Math.round(Math.abs(drift) * mix.liquidTotal * 0.015), time_horizon: 'compounded over decumulation horizon', certainty: 0.78 },
        risk: { reversibility: 'fully reversible', downside: 'transaction costs and any spread; CGT if executed in GIA', complexity: 'low' },
        citation: 'CFA Institute Lifecycle Investing + FCA COBS 9.2 (ongoing suitability)',
        assumptions: { wrappers_available: 'SIPP and ISA have headroom to absorb trades', no_lock_ups: 'no exit penalties on current funds' },
        flip_conditions: 'If you have a strong market view that justifies the drift, document the deviation in your suitability file.',
        fca_boundary: 'Information only — execute via your platform or with adviser confirmation.',
        common_mistakes: [
          'Rebalancing in GIA when SIPP/ISA could absorb the trade tax-free',
          'Frequent rebalancing — annual or trigger-based is sufficient',
          'Not documenting the deviation if you hold a different view from the model',
        ],
      }))
    }

    // REC-2: Build emergency fund if below 3 months
    if (monthlyExp > 0 && mix.cash / monthlyExp < REF.EMERGENCY_FUND_MONTHS_MIN) {
      const targetCash = monthlyExp * REF.EMERGENCY_FUND_MONTHS_TARGET
      const shortfall = targetCash - mix.cash
      recs.push(recommendation({
        id: 'IFA-REC-02',
        strategy_id: 'STRAT-EMERGENCY-FUND',
        headline: `Build emergency fund to ${fmt(targetCash)} — top up ${fmt(shortfall)}`,
        drill_down: `Below-minimum cash buffer means any shock (redundancy, illness, urgent home repair) forces selling growth assets at potentially the wrong moment. Build to ${REF.EMERGENCY_FUND_MONTHS_TARGET} months of expenses — for you that's ${fmt(targetCash)}, requiring ${fmt(shortfall)} top-up. Hold in a high-interest easy-access account or money-market fund (currently ~4.5%) — not the current account.`,
        action_steps: [
          'Open a high-interest easy-access savings account (currently ~4.5% AER)',
          'Move ${fmt(Math.min(shortfall, mix.gia * 0.3))} from GIA over 3-6 months',
          'Direct future surplus income into the cash buffer until target hit',
          'Then resume normal investment contributions',
        ],
        impact: { gbp_per_year: 0, time_horizon: 'permanent protection', certainty: 0.95 },
        risk: { reversibility: 'fully reversible', downside: 'opportunity cost — buffer earns less than invested capital', complexity: 'low' },
        citation: 'FCA Financial Lives 2024 + CFA Institute behavioural finance',
        assumptions: { stable_income: 'or alternative source of income to fund top-up', cash_account_available: 'open access to a competitive savings rate' },
        flip_conditions: 'If your income is highly stable + multiple income sources, 3 months may suffice. If self-employed or commission-based, hold 9-12 months.',
        fca_boundary: 'Information only.',
        common_mistakes: [
          'Holding emergency fund in current account at 0%',
          'Equating ISA as "cash" — ISAs are tax wrappers, contents can be volatile',
        ],
      }))
    }

    // REC-3: Annual review if last review > 12 months
    const lastReviewMonths = persona.last_review_months_ago ?? null
    if (lastReviewMonths != null && lastReviewMonths > REF.ANNUAL_REVIEW_MONTHS) {
      recs.push(recommendation({
        id: 'IFA-REC-03',
        strategy_id: 'STRAT-ANNUAL-REVIEW',
        headline: 'Schedule a formal suitability review',
        drill_down: `FCA COBS 9.2 requires annual review of suitability — circumstances change, risk profile drifts, products go in and out of suitability. Your last review was ${lastReviewMonths} months ago. A formal review (~90 minutes) covers: capacity for loss, time horizon, ESG preferences, costs, beneficiary nominations, and any life events since.`,
        action_steps: [
          'Schedule a 90-min review with an FCA-authorised adviser',
          'Update risk-profile questionnaire (RPQ)',
          'Review all beneficiary nominations across pensions and life policies',
          'Document the conversation — suitability evidence trail',
        ],
        impact: { gbp_per_year: 0, time_horizon: 'ongoing', certainty: 0.90 },
        risk: { reversibility: 'no risk to schedule a review', downside: 'time cost only', complexity: 'low' },
        citation: 'FCA COBS 9.2',
        assumptions: { adviser_available: 'have an existing relationship or willing to engage one' },
        flip_conditions: 'None — annual review is standard practice for advised clients.',
        fca_boundary: 'Information only.',
        common_mistakes: [
          'Treating an automated platform review as a suitability review',
          'Not updating risk profile after major life events',
        ],
      }))
    }

    // REC-4: Reduce single-stock concentration
    const holdings = persona.assets?.portfolio?.holdings || []
    const totalLiquid = mix.liquidTotal
    const concentrated = holdings.find(h => {
      const v = +h.currentValue || +h.value || 0
      return totalLiquid > 0 && v / totalLiquid > REF.SINGLE_STOCK_CONCENTRATION_WARN
    })
    if (concentrated) {
      const v = +concentrated.currentValue || +concentrated.value || 0
      const reduceTo = totalLiquid * REF.SINGLE_STOCK_CONCENTRATION_WARN
      const reduceBy = v - reduceTo
      recs.push(recommendation({
        id: 'IFA-REC-04',
        strategy_id: 'STRAT-REDUCE-CONCENTRATION',
        headline: `Reduce ${concentrated.ticker || concentrated.name} position by ${fmt(reduceBy)} to below 10%`,
        drill_down: `${concentrated.ticker || concentrated.name} is currently ${pct(v / totalLiquid)} of your liquid wealth. Above 10% single-position concentration, idiosyncratic risk (this company specifically) dominates over market risk. Trim to ~10% over 2-3 tax years to manage CGT, redirect proceeds into a diversified tracker. If the position is in your ISA or SIPP, no CGT applies — execute faster.`,
        action_steps: [
          'Tranche the sale across 2-3 tax years to use £3,000 CGT allowance each',
          'If in ISA/SIPP, no tax on sale — execute over weeks',
          'Reinvest proceeds in a low-cost global tracker (TER <0.30%)',
        ],
        impact: { gbp_one_off: Math.round(reduceBy * 0.05), time_horizon: 'permanent risk reduction', certainty: 0.85 },
        risk: { reversibility: 'irreversible at the position level (CGT realised)', downside: 'opportunity cost if the stock outperforms', complexity: 'medium' },
        citation: 'CFA Institute diversification principles',
        assumptions: { tax_wrapper_known: 'depends whether held in GIA/ISA/SIPP', cgt_allowance: '£3,000 annual exempt amount per person' },
        flip_conditions: 'If the position is your own employer with vesting restrictions, sell as soon as restrictions lift.',
        fca_boundary: 'Information only.',
        common_mistakes: [
          'All-in-one-go disposal — wastes CGT allowance over multiple years',
          'Reinvesting proceeds back into another concentrated position',
        ],
      }))
    }

    return recs
  },

  red_flags(persona) {
    const flags = []
    const mix = computeAssetMix(persona)
    const monthlyExp = persona.monthlyExpenditure ?? 0
    if (monthlyExp > 0 && mix.cash / monthlyExp < 1) {
      flags.push(redFlag({
        id: 'IFA-RF-01',
        urgency: URGENCY.IMMEDIATE,
        action: 'Build cash buffer immediately — less than 1 month of expenses available',
        deadline: 'Within 60 days',
        cost_of_inaction: 'Forced sale of growth assets at potentially the worst moment if shock occurs',
        citation: 'FCA Financial Lives 2024',
      }))
    }
    return flags
  },

  what_if_prompts(persona) {
    return [
      'What if markets dropped 20% tomorrow — how exposed am I?',
      'What if I retired 5 years earlier with current allocation?',
      'Should I de-risk going into decumulation?',
    ]
  },
}
