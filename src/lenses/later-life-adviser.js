// ─────────────────────────────────────────────────────────────────────────────
// LENS: LATER-LIFE ADVISER
//
// Perspective: a UK Society of Later Life Advisers (SOLLA-accredited) specialist
// covering care funding, Local Authority means-test thresholds, equity release,
// capacity planning, and deferred-payment agreements.
//
// Citations:
//   CA   = Care Act 2014
//   MCA  = Mental Capacity Act 2005
//   CASS = FCA Equity Release Council standards
//   LA  threshold rates from Department of Health & Social Care
// ─────────────────────────────────────────────────────────────────────────────

import {
  SEVERITY, URGENCY, fmt, pct,
  ageAt, grossAssets,
  observation, recommendation, redFlag,
} from './_base.js';

const REF = {
  LA_UPPER_THRESHOLD: 23250,        // above this, fully self-fund care
  LA_LOWER_THRESHOLD: 14250,        // below this, LA pays full (residual cost)
  ANNUAL_CARE_COST_RES: 45000,      // typical residential
  ANNUAL_CARE_COST_NURSING: 60000,  // typical nursing
  ANNUAL_CARE_COST_AT_HOME: 30000,  // home care, partial
  AVG_CARE_YEARS_NEEDED: 2.5,       // ONS / Alzheimer's Society
  CARE_DURATION_LONG_TAIL: 7,       // 90th percentile
  EQUITY_RELEASE_MIN_AGE: 55,
  EQUITY_RELEASE_LTV_60: 0.35,      // typical LTV at age 60
  EQUITY_RELEASE_LTV_75: 0.50,      // typical LTV at age 75
  AVG_INTEREST_RATE_LIFETIME_MORT: 0.065,
};

export const lens = {
  id: 'later-life-adviser',
  name: 'Later-Life Adviser',
  short_name: 'Later-Life',
  display_avatar: '🏥',
  expertise_domain: ['care_costs', 'la_means_test', 'equity_release', 'capacity', 'deferred_payment'],
  description: 'A UK Society of Later Life Advisers (SOLLA) specialist on care funding, equity release, and capacity planning.',

  is_relevant(persona) {
    const age = ageAt(persona) ?? 0
    if (age < 55) return { score: 0.2, reason: 'Pre-later-life — basic capacity planning only' }
    if (age >= 65) return { score: 0.95, reason: 'Active later-life planning relevance — care, capacity, equity release' }
    return { score: 0.7, reason: 'Approaching later-life — start planning now' }
  },

  observe(persona, asOfDate = new Date()) {
    const obs = []
    const age = ageAt(persona, asOfDate) ?? 0
    const assets = grossAssets(persona)
    const liquidAssets = (persona.assets?.cash?.value ?? 0) + (persona.assets?.isa?.value ?? 0) + (persona.assets?.portfolio?.value ?? 0)
    const lpaSigned = persona.estate_plan?.lpa_signed === true
    const propertyValue = (persona.assets?.residence?.value ?? 0) +
      ((Array.isArray(persona.assets?.property) ? persona.assets.property : []).reduce((s, p) => s + (+p.estimatedValue || +p.value || 0), 0))

    // OBS-1: Care cost projection
    if (age >= 55 && assets > REF.LA_UPPER_THRESHOLD) {
      const expectedCost = REF.ANNUAL_CARE_COST_RES * REF.AVG_CARE_YEARS_NEEDED
      const longTailCost = REF.ANNUAL_CARE_COST_NURSING * REF.CARE_DURATION_LONG_TAIL
      obs.push(observation({
        id: 'LL-OBS-01',
        severity: assets > 500000 ? SEVERITY.MEDIUM : SEVERITY.HIGH,
        category: 'care_projection',
        text: `Care cost projection: typical residential care ${fmt(REF.ANNUAL_CARE_COST_RES)}/yr × ${REF.AVG_CARE_YEARS_NEEDED}-year median stay = ${fmt(expectedCost)}. 90th-percentile (long stay in nursing care): ${fmt(longTailCost)}. Above ${fmt(REF.LA_UPPER_THRESHOLD)} you self-fund 100% — Local Authority only steps in when assets fall below threshold.`,
        citation: 'Care Act 2014 + ONS care-stay statistics + LA Charging Regulations',
        finding: { expectedCost, longTailCost, threshold: REF.LA_UPPER_THRESHOLD },
      }))
    }

    // OBS-2: LA means-test
    if (assets > REF.LA_UPPER_THRESHOLD) {
      obs.push(observation({
        id: 'LL-OBS-02',
        severity: SEVERITY.LOW,
        category: 'la_means_test',
        text: `Your liquid + property assets (${fmt(assets)}) exceed the £${REF.LA_UPPER_THRESHOLD.toLocaleString()} self-funding threshold by a wide margin. You will self-fund any care need entirely. The home is included in the assessment unless a qualifying person (spouse, dependent child) still lives there.`,
        citation: 'Care Act 2014 + LA Charging and Assessment Regs 2014 + DHSC threshold updates',
        finding: { assets, threshold: REF.LA_UPPER_THRESHOLD, ringFenceHome: false },
      }))
    }

    // OBS-3: LPA status
    if (!lpaSigned && age >= 55) {
      obs.push(observation({
        id: 'LL-OBS-03',
        severity: age >= 70 ? SEVERITY.HIGH : SEVERITY.MEDIUM,
        category: 'lpa',
        text: `No LPA recorded. At your age, this is the single highest-impact later-life action: without LPA, if you lose capacity, family must apply to Court of Protection (4-6 months, £1.5-3k cost, ongoing supervision fees). LPA must be made while you have capacity — every month of delay raises that risk.`,
        citation: 'MCA 2005 s.9-14 + Office of the Public Guardian',
        finding: { lpaSigned: false, age, courtOfProtectionCost: 2250 },
      }))
    }

    // OBS-4: Equity release potential
    if (age >= 60 && propertyValue > 300000) {
      const ltv = age >= 75 ? REF.EQUITY_RELEASE_LTV_75 : REF.EQUITY_RELEASE_LTV_60
      const accessible = Math.round(propertyValue * ltv)
      obs.push(observation({
        id: 'LL-OBS-04',
        severity: SEVERITY.LOW,
        category: 'equity_release',
        text: `Equity release is potentially available — at age ${age}, typical LTV is ${pct(ltv)} of property value ${fmt(propertyValue)} = ~${fmt(accessible)} accessible via lifetime mortgage. Interest compounds at ~6.5% (no monthly payments required); estate reduces by the borrowed amount + accrued interest at death.`,
        citation: 'FCA Equity Release Council standards (no-negative-equity guarantee)',
        finding: { propertyValue, ltv, accessible, interestRate: REF.AVG_INTEREST_RATE_LIFETIME_MORT },
      }))
    }

    return obs
  },

  recommend(persona, asOfDate = new Date()) {
    const recs = []
    const age = ageAt(persona, asOfDate) ?? 0
    const assets = grossAssets(persona)
    const lpaSigned = persona.estate_plan?.lpa_signed === true
    const propertyValue = (persona.assets?.residence?.value ?? 0) +
      ((Array.isArray(persona.assets?.property) ? persona.assets.property : []).reduce((s, p) => s + (+p.estimatedValue || +p.value || 0), 0))

    // REC-1: Sign LPA (if missing)
    if (!lpaSigned && age >= 55) {
      recs.push(recommendation({
        id: 'LL-REC-01',
        strategy_id: 'STRAT-LPA',
        headline: 'Sign Lasting Power of Attorney (Property + Health) within 30 days',
        drill_down: `Two LPAs (Property & Financial Affairs + Health & Welfare) cost £82 each to register with the OPG, or free if drafted via gov.uk. Compare to the Court of Protection alternative (4-6 months, £1.5-3k, ongoing supervision) if you lose capacity without LPA. 30-day cooling-off after registration before active.`,
        action_steps: [
          'Choose attorneys you trust (typically spouse + 1-2 children)',
          'Complete via gov.uk/power-of-attorney',
          'Register both LPAs with OPG',
          '30-day cooling-off before active',
        ],
        impact: { gbp_one_off: 2250, time_horizon: 'protection until death/revocation', certainty: 0.99 },
        risk: { reversibility: 'revocable while capacity retained', downside: 'minimal', complexity: 'low' },
        citation: 'MCA 2005 s.9-14',
        assumptions: { has_capacity: 'mental capacity required at signing' },
        flip_conditions: 'None — universally beneficial.',
        fca_boundary: 'Information only — legal document.',
        common_mistakes: ['Only completing one LPA', 'Single attorney with no replacement'],
      }))
    }

    // REC-2: Ring-fence care reserve
    if (age >= 60 && assets > REF.LA_UPPER_THRESHOLD * 3) {
      const ringFence = REF.ANNUAL_CARE_COST_NURSING * REF.CARE_DURATION_LONG_TAIL
      recs.push(recommendation({
        id: 'LL-REC-02',
        strategy_id: 'STRAT-CARE-RESERVE',
        headline: `Ring-fence ${fmt(ringFence)} as a 7-year care reserve`,
        drill_down: `Mental ringfence (not legally separated): identify ${fmt(ringFence)} of capital you would NOT use for lifestyle, gifting, or risky investment. Hold in low-volatility assets (money-market fund, short-dated bonds). Covers 90th-percentile care duration in nursing care — protects against the long-tail risk that drives most "I wish I'd planned" later-life regrets.`,
        action_steps: [
          'Identify which capital block is the care reserve',
          'Hold in low-volatility instruments (money-market fund, short-dated bonds)',
          'Document the intent in a letter of wishes alongside the will',
          'Review annually as care-cost inflation runs ~4-5%/yr',
        ],
        impact: { gbp_lifetime: ringFence, time_horizon: 'protection against long-tail care costs', certainty: 0.85 },
        risk: { reversibility: 'fully flexible — mental ring-fence', downside: 'opportunity cost — capital not deployed for growth', complexity: 'low' },
        citation: 'Care Act 2014 + ONS care-duration statistics',
        assumptions: { care_inflation: 'budget for 4-5% annual care-cost inflation', no_immediate_need: 'works only if you do not need care imminently' },
        flip_conditions: 'If long-term care insurance available + affordable, that can transfer the risk for a fixed premium.',
        fca_boundary: 'Information only.',
        common_mistakes: ['Reserve allocated to volatile equity (sequence risk)', 'Forgetting to update for care-cost inflation'],
      }))
    }

    // REC-3: Equity release education (NOT a recommendation to take — education)
    if (age >= 65 && propertyValue > 500000) {
      const ltv = age >= 75 ? REF.EQUITY_RELEASE_LTV_75 : REF.EQUITY_RELEASE_LTV_60
      const accessible = Math.round(propertyValue * ltv)
      recs.push(recommendation({
        id: 'LL-REC-03',
        strategy_id: 'STRAT-EQUITY-RELEASE-AWARE',
        headline: `Understand equity release as a contingency — ${fmt(accessible)} accessible if needed`,
        drill_down: `Don't take equity release pre-emptively, but understand it as a contingency. Lifetime mortgage at age ${age}: typical LTV ${pct(ltv)} = ${fmt(accessible)}. Interest compounds at ~6.5% (no monthly payments). Estate reduces by borrowed amount + accrued interest at death. No-negative-equity guarantee under FCA Equity Release Council standards. Better executed at higher age (more LTV available). Best deployed for care funding or to enable gifts during life.`,
        action_steps: [
          'Get quote from FCA Equity Release Council member firm at age 70',
          'Understand the no-negative-equity guarantee',
          'Document the contingency plan',
        ],
        impact: { gbp_one_off: accessible, time_horizon: 'contingency only', certainty: 0.75 },
        risk: { reversibility: 'once taken, interest accrues for life', downside: 'compound interest can consume the entire property equity', complexity: 'high' },
        citation: 'FCA Equity Release Council standards + Equity Release Council product list',
        assumptions: { ltv_at_age: 'LTV scales with age', interest_rate: 'rates change with base rate' },
        flip_conditions: 'If you have other liquid sources, prefer those over equity release.',
        fca_boundary: 'Information only — equity release is heavily regulated. Mandatory regulated advice from FCA-authorised firm before proceeding.',
        common_mistakes: ['Taking equity release too young (compound interest erodes estate)', 'Not understanding the no-negative-equity guarantee', 'Not telling family'],
      }))
    }

    return recs
  },

  red_flags(persona, asOfDate = new Date()) {
    const flags = []
    const age = ageAt(persona, asOfDate) ?? 0
    const lpaSigned = persona.estate_plan?.lpa_signed === true
    if (!lpaSigned && age >= 65) {
      flags.push(redFlag({
        id: 'LL-RF-01',
        urgency: URGENCY.IMMEDIATE,
        action: 'Sign LPA — every month delayed risks Court of Protection cost on capacity loss',
        deadline: 'Within 30 days',
        cost_of_inaction: '£1,500-3,000 Court of Protection cost + 4-6 month delay if capacity lost',
        citation: 'MCA 2005',
      }))
    }
    return flags
  },

  what_if_prompts(persona) {
    return [
      'What if I needed long-term care for 5 years?',
      'How much equity could I release from my home at 75?',
      'What happens if I lose mental capacity without LPA in place?',
    ]
  },
}
