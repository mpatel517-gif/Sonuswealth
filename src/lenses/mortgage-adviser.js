// ─────────────────────────────────────────────────────────────────────────────
// LENS: MORTGAGE ADVISER
//
// Perspective: a UK CeMAP-qualified independent mortgage adviser covering
// residential, BTL, remortgage, affordability, fixed-vs-variable, and
// equity-release alternatives. Distinct from Later-Life on equity release
// (this lens covers the mortgage product itself; Later-Life covers
// when-to-take and care-funding intersection).
//
// Citations:
//   FCA MCOB = Mortgages Conduct of Business
//   BoE rates and stress-test guidance
//   PRA Mortgage Lending standards
//   Section 24 = Finance Act 2017 BTL mortgage interest restriction
// ─────────────────────────────────────────────────────────────────────────────

import {
  SEVERITY, URGENCY, fmt, pct,
  ageAt, grossAssets, grossIncome,
  observation, recommendation, redFlag,
} from './_base.js';

const REF = {
  TYPICAL_2YR_FIXED: 0.048,           // ~4.8% mid-2025
  TYPICAL_5YR_FIXED: 0.045,
  BOE_BASE: 0.045,
  STRESS_TEST_UPLIFT: 0.03,           // +3% stress test
  AFFORDABILITY_DTI_MAX: 4.5,         // typical LTI cap
  AFFORDABILITY_DTI_HIGH: 5.5,        // some lenders, higher salaries
  LTV_HIGH: 0.85,
  LTV_LOW: 0.60,
  BTL_INTEREST_COVER: 1.45,           // typical ICR
  S24_HIGHER_RATE_RESTRICTION: 0.20,  // 20% relief cap (was full marginal)
};

export const lens = {
  id: 'mortgage-adviser',
  name: 'Mortgage Adviser',
  short_name: 'Mortgage',
  display_avatar: '🏠',
  expertise_domain: ['mortgage', 'btl', 'remortgage', 'affordability', 'equity_release_intro'],
  description: 'A UK CeMAP-qualified independent mortgage adviser covering residential, BTL, and remortgage decisions.',

  is_relevant(persona) {
    const mortgage = persona.liabilities?.mortgage?.outstanding ?? 0
    const propertyValue = (persona.assets?.residence?.value ?? 0) +
      ((Array.isArray(persona.assets?.property) ? persona.assets.property : []).reduce((s, p) => s + (+p.estimatedValue || +p.value || 0), 0))
    if (mortgage === 0 && propertyValue === 0) return { score: 0.2, reason: 'No mortgage, no property — limited mortgage planning' }
    if (mortgage > 0) return { score: 1.0, reason: 'Active mortgage — full review essential' }
    if (propertyValue > 500000) return { score: 0.6, reason: 'Property owner — remortgage and equity-release planning relevant' }
    return { score: 0.5, reason: 'Standard mortgage relevance' }
  },

  observe(persona, asOfDate = new Date()) {
    const obs = []
    const mortgage = persona.liabilities?.mortgage?.outstanding ?? 0
    const propertyValue = persona.assets?.residence?.value ?? 0
    const fixedEnd = persona.liabilities?.mortgage?.fixed_period_ends
    const currentRate = persona.liabilities?.mortgage?.current_rate
    const income = grossIncome(persona)
    const age = ageAt(persona, asOfDate) ?? 0
    const btl = (Array.isArray(persona.assets?.property) ? persona.assets.property : [])
      .filter(p => (p.type || '').toLowerCase().includes('btl') || (p.use || '').toLowerCase().includes('rental'))

    // OBS-1: Mortgage end-of-fixed-rate countdown
    if (fixedEnd) {
      const end = new Date(fixedEnd)
      const monthsLeft = Math.round((end - asOfDate) / (1000 * 60 * 60 * 24 * 30))
      if (monthsLeft <= 12 && monthsLeft > 0) {
        const remortgageWindow = monthsLeft <= 6 ? 'imminent — within 6 months' : `${monthsLeft} months`
        obs.push(observation({
          id: 'MO-OBS-01',
          severity: monthsLeft <= 6 ? SEVERITY.HIGH : SEVERITY.MEDIUM,
          category: 'remortgage_window',
          text: `Fixed-rate ends in ${monthsLeft} months. Lock new rate ${remortgageWindow}. Lenders typically allow new rate-lock 6 months ahead with no penalty for early switch. Reverting to SVR (typically 8-9%) instead of remortgaging costs ${fmt(Math.round(mortgage * 0.04))} extra interest per year on your ${fmt(mortgage)} balance.`,
          citation: 'FCA MCOB 7 + lender SVR rate sheets',
          finding: { monthsLeft, mortgage, svrCost: mortgage * 0.04 },
        }))
      }
    }

    // OBS-2: Loan-to-income ratio
    if (mortgage > 0 && income > 0) {
      const lti = mortgage / income
      if (lti > REF.AFFORDABILITY_DTI_HIGH) {
        obs.push(observation({
          id: 'MO-OBS-02',
          severity: SEVERITY.HIGH,
          category: 'affordability',
          text: `Loan-to-income ratio ${lti.toFixed(1)} is above typical lender caps (4.5-5.5×). Stress test at base+3% (${pct(REF.BOE_BASE + REF.STRESS_TEST_UPLIFT)}) implies monthly cost ${fmt(Math.round(mortgage * (REF.BOE_BASE + REF.STRESS_TEST_UPLIFT) / 12))}. If rates rise, affordability tightens significantly.`,
          citation: 'PRA Mortgage Lending Standards + BoE Stress Test 2024',
          finding: { lti, mortgage, income, stressedMonthly: Math.round(mortgage * (REF.BOE_BASE + REF.STRESS_TEST_UPLIFT) / 12) },
        }))
      }
    }

    // OBS-3: BTL Section 24 impact
    if (btl.length > 0) {
      const totalBtlValue = btl.reduce((s, p) => s + (+p.estimatedValue || +p.value || 0), 0)
      const totalBtlMortgage = btl.reduce((s, p) => s + (+p.mortgage || 0), 0)
      const annualInterest = totalBtlMortgage * REF.TYPICAL_5YR_FIXED
      const reliefLost = income >= 50270 ? Math.round(annualInterest * (income >= 125140 ? 0.25 : 0.20)) : 0
      obs.push(observation({
        id: 'MO-OBS-03',
        severity: reliefLost > 5000 ? SEVERITY.HIGH : SEVERITY.MEDIUM,
        category: 's24',
        text: `${btl.length} BTL ${btl.length === 1 ? 'property' : 'properties'} with total mortgage ${fmt(totalBtlMortgage)}. Section 24 restricts mortgage interest relief to 20% basic-rate credit. As ${income >= 125140 ? 'an additional-rate' : 'a higher-rate'} taxpayer, you lose ${fmt(reliefLost)}/yr of relief vs the pre-2017 full-deduction rules.`,
        citation: 'Finance Act 2017 s.41-42 (BTL interest restriction) + ITTOIA 2005',
        finding: { btlCount: btl.length, totalBtlMortgage, reliefLost },
      }))
    }

    // OBS-4: Equity-release readiness for older homeowners
    if (mortgage === 0 && propertyValue > 500000 && age >= 60) {
      const ltvAvailable = age >= 75 ? 0.50 : age >= 65 ? 0.40 : 0.30
      const equityReleaseAccessible = Math.round(propertyValue * ltvAvailable)
      obs.push(observation({
        id: 'MO-OBS-04',
        severity: SEVERITY.LOW,
        category: 'equity_release',
        text: `Mortgage-free home worth ${fmt(propertyValue)}. At age ${age}, equity release (lifetime mortgage) typically offers ~${pct(ltvAvailable)} LTV = ${fmt(equityReleaseAccessible)} accessible. Useful contingency for care costs, gifting to children, or income top-up. Not advisable to take pre-emptively — compound interest at ~6.5% erodes the estate.`,
        citation: 'FCA Equity Release Council standards + lifetime mortgage product data',
        finding: { propertyValue, ltvAvailable, accessible: equityReleaseAccessible },
      }))
    }

    return obs
  },

  recommend(persona, asOfDate = new Date()) {
    const recs = []
    const mortgage = persona.liabilities?.mortgage?.outstanding ?? 0
    const fixedEnd = persona.liabilities?.mortgage?.fixed_period_ends
    const income = grossIncome(persona)
    const btl = (Array.isArray(persona.assets?.property) ? persona.assets.property : [])
      .filter(p => (p.type || '').toLowerCase().includes('btl') || (p.use || '').toLowerCase().includes('rental'))

    // REC-1: Remortgage with fixed-rate ending within 12 months
    if (fixedEnd && mortgage > 0) {
      const end = new Date(fixedEnd)
      const monthsLeft = Math.round((end - asOfDate) / (1000 * 60 * 60 * 24 * 30))
      if (monthsLeft <= 12 && monthsLeft > 0) {
        const newRate = REF.TYPICAL_5YR_FIXED
        const svrRate = REF.BOE_BASE + 0.04
        const annualSaving = Math.round(mortgage * (svrRate - newRate))
        recs.push(recommendation({
          id: 'MO-REC-01',
          strategy_id: 'STRAT-REMORTGAGE',
          headline: `Remortgage before fixed-rate ends — save ${fmt(annualSaving)}/yr vs SVR`,
          drill_down: `Lenders allow new rate-lock 6 months ahead with no early-switch penalty. Falling onto SVR (typically 8-9%) for even 1-2 months costs ${fmt(Math.round(mortgage * (svrRate - newRate) / 12))} per month. Use a whole-of-market broker (LendingTree, L&C, etc.) — many products are intermediary-only and not available on lender websites.`,
          action_steps: [
            'Engage whole-of-market broker 6 months before fixed-rate ends',
            'Compare new fixed-rate against tracker (consider rate-cut timing)',
            'Consider 2-yr vs 5-yr fix vs lifetime tracker — depends on rate outlook',
            'Complete formal application with documents ready (3mo payslips, ID, bank statements)',
          ],
          impact: { gbp_per_year: annualSaving, time_horizon: 'duration of new fixed period', certainty: 0.90 },
          risk: { reversibility: 'early redemption charge if you switch mid-term', downside: 'arrangement fee (£500-2,000) and broker fee', complexity: 'medium' },
          citation: 'FCA MCOB 7 + intermediary mortgage market rates',
          assumptions: { credit_ok: 'standard credit profile', employment_stable: 'lenders prefer stable employment' },
          flip_conditions: 'If selling within 12 months, may prefer SVR with no early redemption charge.',
          fca_boundary: 'Information only — mortgage advice is regulated. Use FCA-authorised broker.',
          common_mistakes: ['Letting fixed-rate roll onto SVR by inertia', 'Going direct to one lender vs whole-of-market broker'],
        }))
      }
    }

    // REC-2: BTL incorporation review (S24 mitigation)
    if (btl.length >= 2 && income >= 50270) {
      const totalBtlValue = btl.reduce((s, p) => s + (+p.estimatedValue || +p.value || 0), 0)
      const totalBtlMortgage = btl.reduce((s, p) => s + (+p.mortgage || 0), 0)
      const annualInterest = totalBtlMortgage * REF.TYPICAL_5YR_FIXED
      const reliefLost = Math.round(annualInterest * 0.20)
      recs.push(recommendation({
        id: 'MO-REC-02',
        strategy_id: 'STRAT-BTL-INCORPORATION',
        headline: `Review BTL incorporation — recover ${fmt(reliefLost)}/yr of Section 24 relief`,
        drill_down: `Holding BTL in a Special Purpose Vehicle (Ltd company) sidesteps S24 because mortgage interest is fully deductible against corporation tax. Trade-offs: SDLT on transfer (3% additional, sometimes higher), CGT on disposal of personally-held property to the company, higher mortgage rates (~0.5% premium for Ltd company BTL). Above 3-4 properties at higher-rate tax, incorporation often pays back within 5-8 years.`,
        action_steps: [
          'Get specialist tax adviser to model your specific portfolio (personal vs Ltd)',
          'Quantify SDLT + CGT cost of transferring existing properties',
          'Consider incremental approach — incorporate NEW purchases, leave existing personal',
          'Decide on Ltd company structure (single SPV vs holding structure)',
        ],
        impact: { gbp_per_year: reliefLost, time_horizon: 'permanent once incorporated', certainty: 0.78 },
        risk: { reversibility: 'transfer to Ltd is irreversible practically', downside: 'SDLT + CGT on transfer; higher Ltd company mortgage rates', complexity: 'high' },
        citation: 'Finance Act 2017 s.41-42 + Corporation Tax Act 2010',
        assumptions: { multi_property_portfolio: 'works best for 3+ BTL properties', higher_rate_taxpayer: 'no benefit at basic rate' },
        flip_conditions: 'Single BTL property — usually personal holding still wins (CGT exemption on disposal). Selling soon — defer incorporation.',
        fca_boundary: 'Information only — specialist BTL tax adviser essential.',
        common_mistakes: ['Incorporating without modelling SDLT/CGT', 'Forgetting Ltd mortgage rates are higher', 'Missing the cost of transferring existing portfolio'],
      }))
    }

    return recs
  },

  red_flags(persona, asOfDate = new Date()) {
    const flags = []
    const fixedEnd = persona.liabilities?.mortgage?.fixed_period_ends
    const mortgage = persona.liabilities?.mortgage?.outstanding ?? 0
    if (fixedEnd && mortgage > 0) {
      const end = new Date(fixedEnd)
      const monthsLeft = Math.round((end - asOfDate) / (1000 * 60 * 60 * 24 * 30))
      if (monthsLeft <= 3 && monthsLeft > 0) {
        flags.push(redFlag({
          id: 'MO-RF-01',
          urgency: URGENCY.IMMEDIATE,
          action: 'Lock new rate within 30 days — SVR uplift imminent',
          deadline: `Fixed-rate ends in ${monthsLeft} month${monthsLeft === 1 ? '' : 's'}`,
          cost_of_inaction: `~${fmt(Math.round(mortgage * 0.04 / 12))}/mo on SVR vs new fix`,
          citation: 'FCA MCOB 7 + lender SVR rates',
        }))
      }
    }
    return flags
  },

  what_if_prompts(persona) {
    return [
      'What if I fixed for 2 years vs 5 years?',
      'What if I overpaid £500/mo on my mortgage?',
      'What if I incorporated my BTL portfolio?',
    ]
  },
}
