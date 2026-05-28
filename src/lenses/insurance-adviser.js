// ─────────────────────────────────────────────────────────────────────────────
// LENS: INSURANCE / PROTECTION ADVISER
//
// Perspective: a UK protection specialist (Defaqto-rated panel) reviewing your
// resilience to four shocks: death, critical illness, long-term inability to
// work, and (for couples) loss of one income. Also assesses business-protection
// needs (key-person, shareholder/partnership protection) where applicable.
//
// Distinct from IFA — IFA covers the holistic plan; this lens drills the
// specific protection gap and quantifies it as £ exposure.
//
// Citations:
//   FCA   = Financial Conduct Authority
//   FOS   = Financial Ombudsman Service guidance on protection
//   ABI   = Association of British Insurers Statement of Best Practice
//   IFS   = Institute for Fiscal Studies
// ─────────────────────────────────────────────────────────────────────────────

import {
  SEVERITY, URGENCY, fmt, pct,
  ageAt, grossAssets, grossIncome,
  observation, recommendation, redFlag,
} from './_base.js';

const REF = {
  LIFE_COVER_MULTIPLE_INCOME: 10,           // industry rule-of-thumb: 10× gross
  LIFE_COVER_MULTIPLE_EXPENSES: 240,        // OR 20 years of expenses
  CRITICAL_ILLNESS_FLOOR: 50000,            // minimum useful sum assured
  INCOME_PROTECTION_REPLACEMENT_PCT: 0.65,  // typical IP covers 50-70% of gross
  IP_MAX_AGE_NEW_POLICY: 55,                // policies harder to source past 55
  CHILDREN_MAX_AGE_FOR_PROTECTION: 21,      // until financially independent
  PREMIUM_AGE_INCREASE_PER_YEAR: 0.12,      // 12% typical premium uplift per yr of delay
  KEY_PERSON_TRIGGER_VALUE: 250000,         // business asset triggering key-person review
};

function computeProtectionGaps(persona, age) {
  const income = grossIncome(persona)
  const lifeCover = persona.assets?.protection?.life_cover_sum_assured ?? 0
  const ciCover   = persona.assets?.protection?.ci_cover_sum_assured ?? 0
  const ipMonthlyBenefit = persona.assets?.protection?.ip_monthly_benefit ?? 0
  const monthlyExp = persona.monthlyExpenditure ?? 0
  const dependants = persona.dependants ?? []
  const businessValue = (Array.isArray(persona.assets?.business_assets) ? persona.assets.business_assets : [])
    .reduce((s, b) => s + (+b.currentValue || +b.value || 0), 0)

  // Life cover need: max of 10× gross OR 20 years of expenses, less existing assets that could
  // self-insure (excluding pension which may not be liquid pre-55)
  const liquidAssets = (persona.assets?.isa?.value ?? 0) + (persona.assets?.portfolio?.value ?? 0) + (persona.assets?.cash?.value ?? 0)
  const lifeNeed = Math.max(income * REF.LIFE_COVER_MULTIPLE_INCOME, monthlyExp * REF.LIFE_COVER_MULTIPLE_EXPENSES)
  const lifeGap = Math.max(0, lifeNeed - liquidAssets - lifeCover)

  // CI need: 2× gross income or £100k as a floor
  const ciNeed = Math.max(REF.CRITICAL_ILLNESS_FLOOR, income * 2)
  const ciGap = Math.max(0, ciNeed - ciCover)

  // IP need: 65% of gross income / 12 monthly benefit
  const ipNeed = Math.round((income * REF.INCOME_PROTECTION_REPLACEMENT_PCT) / 12)
  const ipGap = Math.max(0, ipNeed - ipMonthlyBenefit)

  return { income, lifeCover, lifeNeed, lifeGap, ciCover, ciNeed, ciGap, ipMonthlyBenefit, ipNeed, ipGap, dependants, businessValue }
}

export const lens = {
  id: 'insurance-adviser',
  name: 'Insurance / Protection',
  short_name: 'Protection',
  display_avatar: '🛡️',
  expertise_domain: ['life_cover', 'critical_illness', 'income_protection', 'business_protection', 'whole_of_life_trust'],
  description: 'A UK Protection Specialist quantifying your exposure to death, critical illness, and loss-of-income shocks.',

  // ─── RELEVANCE ─────────────────────────────────────────────────────────────
  is_relevant(persona) {
    const dependants = persona.dependants ?? []
    const hasIncome = grossIncome(persona) > 0
    const hasBusiness = (persona.assets?.business_assets ?? []).length > 0
    if (dependants.length === 0 && !hasIncome && !hasBusiness) {
      return { score: 0.3, reason: 'No dependants, no income, no business — limited protection planning' }
    }
    if (dependants.length > 0 || hasBusiness) {
      return { score: 1.0, reason: 'Dependants or business interests — full protection review essential' }
    }
    return { score: 0.6, reason: 'Some protection considerations applicable' }
  },

  // ─── OBSERVE ───────────────────────────────────────────────────────────────
  observe(persona, asOfDate = new Date()) {
    const obs = []
    const age = ageAt(persona, asOfDate) ?? 0
    const g = computeProtectionGaps(persona, age)

    // OBS-1: Life cover gap
    if (g.lifeGap > 100000) {
      const dependantCount = g.dependants.length
      obs.push(observation({
        id: 'INS-OBS-01',
        severity: dependantCount > 0 ? SEVERITY.HIGH : SEVERITY.MEDIUM,
        category: 'life_cover',
        text: `Life cover gap: ${fmt(g.lifeGap)}. Need approximately ${fmt(g.lifeNeed)} (10× gross income or 20 years of expenses, whichever higher), have ${fmt(g.lifeCover)} cover + ${fmt(g.lifeNeed - g.lifeGap - g.lifeCover)} self-insuring liquid assets.${dependantCount > 0 ? ` With ${dependantCount} dependant${dependantCount === 1 ? '' : 's'}, this is a material exposure.` : ''}`,
        citation: 'ABI Statement of Best Practice on Life Cover (2024 update)',
        finding: g,
      }))
    } else if (g.lifeGap === 0 && g.lifeCover > 0) {
      obs.push(observation({
        id: 'INS-OBS-01b',
        severity: SEVERITY.LOW,
        category: 'life_cover',
        text: `Life cover ${fmt(g.lifeCover)} plus ${fmt(g.lifeNeed - g.lifeGap - g.lifeCover)} self-insuring assets covers the ${fmt(g.lifeNeed)} estimated need. Periodic review still required as needs change.`,
        citation: 'ABI Statement of Best Practice',
        finding: g,
      }))
    }

    // OBS-2: Critical illness gap
    if (g.ciGap > 0 && age < 60) {
      const annualPremiumEst = Math.round(g.ciGap * 0.004 * (1 + (age - 40) * 0.05))
      obs.push(observation({
        id: 'INS-OBS-02',
        severity: g.ciGap > 100000 ? SEVERITY.HIGH : SEVERITY.MEDIUM,
        category: 'critical_illness',
        text: `Critical Illness cover gap: ${fmt(g.ciGap)}. Statistical probability of CI claim before age 65 is approximately 1-in-4 for males, 1-in-5 for females (CRUK + BHF stats). Typical premium for the gap amount at your age: ~${fmt(annualPremiumEst)}/yr.`,
        citation: 'CRUK Cancer Statistics 2024 + BHF Heart Statistics 2024',
        finding: { gap: g.ciGap, estimatedPremium: annualPremiumEst },
      }))
    }

    // OBS-3: Income protection gap
    if (g.ipGap > 0 && age < REF.IP_MAX_AGE_NEW_POLICY) {
      obs.push(observation({
        id: 'INS-OBS-03',
        severity: SEVERITY.HIGH,
        category: 'income_protection',
        text: `Income Protection gap: need ${fmt(g.ipNeed)}/mo (65% of gross), have ${fmt(g.ipMonthlyBenefit)}/mo. Long-term illness or injury risk is the single biggest financial vulnerability for working-age people — Government statutory sick pay is £116.75/wk for max 28 weeks. Underwriting harder past age 55.`,
        citation: 'ABI Income Protection Statement + DWP SSP rates 2025',
        finding: { gap: g.ipGap, ipNeed: g.ipNeed, currentBenefit: g.ipMonthlyBenefit },
      }))
    } else if (age >= REF.IP_MAX_AGE_NEW_POLICY && g.ipGap > 0) {
      obs.push(observation({
        id: 'INS-OBS-03b',
        severity: SEVERITY.MEDIUM,
        category: 'income_protection',
        text: `Income Protection gap exists but at age ${age}, new policies are increasingly hard to source — most providers will not write new business past 55. Consider PHI / sick-pay arrangements through employer or self-fund via larger cash buffer.`,
        citation: 'ABI Income Protection underwriting standards',
        finding: { gap: g.ipGap, age, newPolicyDifficulty: 'high' },
      }))
    }

    // OBS-4: Premium age increase opportunity cost
    if (g.lifeGap > 100000 && age < 60) {
      const oneYrPremiumIncrease = g.lifeGap * 0.0015 * REF.PREMIUM_AGE_INCREASE_PER_YEAR
      obs.push(observation({
        id: 'INS-OBS-04',
        severity: SEVERITY.MEDIUM,
        category: 'premium_age',
        text: `Each year of delay on protection costs approximately 12% on premiums. For your gap of ${fmt(g.lifeGap)}, a one-year delay means roughly ${fmt(oneYrPremiumIncrease)}/yr more for the same cover — compounded over the policy term.`,
        citation: 'ABI underwriting age tables',
        finding: { oneYearDelayCost: oneYrPremiumIncrease },
      }))
    }

    // OBS-5: Business owner — key-person / shareholder protection
    if (g.businessValue > REF.KEY_PERSON_TRIGGER_VALUE) {
      obs.push(observation({
        id: 'INS-OBS-05',
        severity: SEVERITY.HIGH,
        category: 'business_protection',
        text: `Business assets of ${fmt(g.businessValue)} create key-person and shareholder-protection considerations. If you (or a partner) die or suffer critical illness, the business needs liquidity to: buy out the affected party's share, replace the key contributor, and weather operational disruption. Typically needs ${fmt(g.businessValue * 0.50)}-${fmt(g.businessValue)} of cover via cross-option agreement.`,
        citation: 'ICAEW + STEP joint guidance on business protection',
        finding: { businessValue: g.businessValue, suggestedKeyPersonCover: g.businessValue * 0.75 },
      }))
    }

    // OBS-6: Policies in trust check (for existing policies)
    const policiesInTrust = persona.assets?.protection?.policies_in_trust === true
    if (g.lifeCover > 100000 && policiesInTrust === false) {
      obs.push(observation({
        id: 'INS-OBS-06',
        severity: SEVERITY.MEDIUM,
        category: 'policy_trust',
        text: `Life cover of ${fmt(g.lifeCover)} is NOT held in trust. On death the payout falls into the estate — subject to IHT and probate delay. Writing the policy in trust costs nothing, takes weeks not months to pay out, and keeps the proceeds outside the estate.`,
        citation: 'IHTA 1984 + ABI trust deed guidance',
        finding: { lifeCover: g.lifeCover, ihtImpactIfNotInTrust: g.lifeCover * 0.40 },
      }))
    }

    return obs
  },

  // ─── RECOMMEND ─────────────────────────────────────────────────────────────
  recommend(persona, asOfDate = new Date()) {
    const recs = []
    const age = ageAt(persona, asOfDate) ?? 0
    const g = computeProtectionGaps(persona, age)
    const isMortgageInPlace = (persona.liabilities?.mortgage?.outstanding ?? 0) > 0

    // REC-1: Take out life cover to close the gap
    if (g.lifeGap > 100000 && age < 70) {
      const termYears = isMortgageInPlace ? 25 : Math.max(20, 75 - age)
      const annualPremium = Math.round(g.lifeGap * 0.0010 * (1 + (age - 40) * 0.04))
      recs.push(recommendation({
        id: 'INS-REC-01',
        strategy_id: 'STRAT-LIFE-COVER',
        headline: `Take out ${fmt(g.lifeGap)} level term life cover for ${termYears} years`,
        drill_down: `Close the life cover gap with level-term assurance. Level (not decreasing) preserves the sum assured throughout the term. ${termYears}-year term gets you to age ${age + termYears} — past the period when dependants are most reliant. Write the policy in trust from the outset (zero extra cost) so the payout pays directly to beneficiaries, outside the IHT estate, in weeks not months. Indicative annual premium: ${fmt(annualPremium)} for a healthy non-smoker at your age — locked-in level premium for the term.`,
        action_steps: [
          'Get a whole-of-market quote rated Defaqto 4★ or higher — a qualified protection adviser can compare the live insurer panel',
          'Disclose all material health/lifestyle facts upfront — non-disclosure invalidates the claim',
          'Set up bare trust with named beneficiaries (templates from the insurer at no charge)',
          'Single direct debit; review every 5 years or after life events',
        ],
        impact: { gbp_per_year: -annualPremium, gbp_one_off: g.lifeGap, time_horizon: termYears + ' years', certainty: 0.92 },
        risk: { reversibility: 'lapses if premium not paid; underwriting cannot be reversed', downside: 'premiums lost if no claim made in term', complexity: 'low' },
        citation: 'ABI Statement of Best Practice + FCA COBS 9 (suitability) + IHTA 1984 s.21 (trust)',
        assumptions: { healthy_underwriting: 'standard rates assume reasonable health', non_smoker_rates: 'smokers add ~80% to premium' },
        flip_conditions: 'If estate is large enough to self-insure dependants comfortably, may not be needed. If single with no dependants, often not needed.',
        fca_boundary: 'Information only — protection sale is a regulated activity. Use an FCA-authorised whole-of-market adviser.',
        common_mistakes: [
          'Not writing the policy in trust (loses the IHT and probate-speed benefits)',
          'Taking a decreasing-term policy when level was needed',
          'Forgetting to update beneficiaries after divorce / death / new children',
        ],
      }))
    }

    // REC-2: Take out Income Protection
    if (g.ipGap > 0 && age < REF.IP_MAX_AGE_NEW_POLICY) {
      const annualPremium = Math.round(g.ipGap * 12 * 0.015 + 200)
      recs.push(recommendation({
        id: 'INS-REC-02',
        strategy_id: 'STRAT-INCOME-PROTECTION',
        headline: `Take out Income Protection — ${fmt(g.ipNeed)}/mo benefit to age 65`,
        drill_down: `Income protection pays a monthly tax-free benefit if you cannot work due to illness or injury, typically after a 1-6 month deferred period and to a maximum benefit period of state pension age. Long-term sickness is statistically more likely than death pre-65 — yet most people insure life, not income. Premium scales with deferred period (longer deferral = cheaper) and own-occupation definition (own-occ = more expensive but pays out on inability to do YOUR job, not ANY job).`,
        action_steps: [
          'Quote from whole-of-market protection broker — typically 4-6 weeks underwriting',
          'Choose deferred period: align with employer sick pay (e.g. 3 months if employer pays 3 months)',
          'Choose own-occupation definition (worth the extra premium)',
          'Index-link the benefit to RPI/CPI to keep pace with inflation',
        ],
        impact: { gbp_per_year: -annualPremium, gbp_one_off: g.ipGap * 12 * 5, time_horizon: 'to age 65', certainty: 0.88 },
        risk: { reversibility: 'lapses if premium not paid; cannot re-underwrite if health deteriorates', downside: 'premiums lost if no claim ever made', complexity: 'medium' },
        citation: 'ABI Income Protection Statement + DWP SSP rates',
        assumptions: { still_working: 'requires earned income to underwrite', no_pre_existing_conditions: 'pre-existing conditions excluded or rated' },
        flip_conditions: 'If you have employer permanent health insurance (PHI) covering 60%+ of income to age 65, gap may already be closed. Confirm with HR.',
        fca_boundary: 'Information only — protection sale is regulated.',
        common_mistakes: [
          'Choosing too long a deferred period (out of cash buffer before benefit starts)',
          '"Any-occupation" definition — much harder to claim against',
          'Not index-linking the benefit',
        ],
      }))
    }

    // REC-3: Critical illness cover
    if (g.ciGap > 50000 && age < 60) {
      const annualPremium = Math.round(g.ciGap * 0.004 * (1 + (age - 40) * 0.05))
      recs.push(recommendation({
        id: 'INS-REC-03',
        strategy_id: 'STRAT-CRITICAL-ILLNESS',
        headline: `Take out ${fmt(g.ciGap)} Critical Illness cover`,
        drill_down: `Critical Illness pays a lump sum on diagnosis of one of the conditions in the policy schedule (typically 40+ conditions including major cancers, heart attack, stroke, MS). Used to pay off mortgage, fund lifestyle adjustments, or buy time for recovery. Combine with life cover from the same provider for lower combined premium ("life and CI combined" is usually cheaper than two separate policies).`,
        action_steps: [
          'Quote life + CI combined from the same Defaqto 5-star provider',
          'Check schedule includes the major conditions and ABI+ enhancements',
          'Confirm partial-payout conditions (early-stage cancer, etc.)',
          'Disclose all medical history upfront',
        ],
        impact: { gbp_per_year: -annualPremium, gbp_one_off: g.ciGap, time_horizon: 'typically to age 65', certainty: 0.85 },
        risk: { reversibility: 'lapses on non-payment', downside: 'premiums lost if no claim; condition exclusions if disclosed', complexity: 'medium' },
        citation: 'ABI Statement of Best Practice on Critical Illness + Defaqto ratings',
        assumptions: { fair_underwriting: 'standard rates require reasonable health', non_smoker_rates: 'smokers add 80-100%' },
        flip_conditions: 'If you have substantial assets (>£1M) that could absorb the financial shock, CI cover provides less marginal value.',
        fca_boundary: 'Information only — protection sale is regulated.',
        common_mistakes: [
          'Buying CI without checking the schedule of conditions',
          'Not stacking with life cover for combined-premium saving',
        ],
      }))
    }

    // REC-4: Put existing life cover in trust
    const policiesInTrust = persona.assets?.protection?.policies_in_trust === true
    if (g.lifeCover > 100000 && policiesInTrust === false) {
      const ihtSaving = Math.round(g.lifeCover * 0.40)
      recs.push(recommendation({
        id: 'INS-REC-04',
        strategy_id: 'STRAT-POLICY-IN-TRUST',
        headline: `Put your ${fmt(g.lifeCover)} life policy in trust — zero cost, ${fmt(ihtSaving)} IHT saving`,
        drill_down: `Writing your existing life policy in trust takes 4-6 weeks, costs nothing, and moves the entire ${fmt(g.lifeCover)} payout outside your IHT estate. At your IHT rate of 40%, that's ${fmt(ihtSaving)} of inheritance tax saved. Bonus: trust payouts skip probate, so beneficiaries get the money in weeks rather than the 6-12 months a probated payout takes.`,
        action_steps: [
          'Request trust deed templates from your insurer (almost all offer free bare-trust templates)',
          'Choose trustees (typically spouse + 1-2 others)',
          'Name beneficiaries (review for life events: marriage, divorce, deaths)',
          'Sign and lodge the trust deed with the insurer',
        ],
        impact: { gbp_lifetime: ihtSaving, time_horizon: 'permanent IHT removal of payout', certainty: 0.95 },
        risk: { reversibility: 'trust is technically irrevocable; choose trustees carefully', downside: 'lose ability to change beneficiaries unilaterally', complexity: 'low' },
        citation: 'IHTA 1984 s.21 + ABI trust deed guidance',
        assumptions: { competent_trustees: 'select trustees who will outlive you', clear_beneficiaries: 'name primary + secondary' },
        flip_conditions: 'None for term assurance — trust is universally beneficial. Whole-of-life may require periodic review.',
        fca_boundary: 'Information only — trust deed is a legal document. Solicitor may be helpful for non-standard situations.',
        common_mistakes: [
          'Naming a single trustee with no replacement',
          'Forgetting to update beneficiaries after life events',
          'Choosing a discretionary trust when a bare trust suffices',
        ],
      }))
    }

    return recs
  },

  red_flags(persona) {
    const flags = []
    const g = computeProtectionGaps(persona, ageAt(persona) ?? 0)
    if (g.dependants.length > 0 && g.lifeGap > 500000) {
      flags.push(redFlag({
        id: 'INS-RF-01',
        urgency: URGENCY.URGENT,
        action: 'Source life cover quote within 30 days — every month delayed adds ~1% to premium',
        deadline: 'Within 30 days',
        cost_of_inaction: `${fmt(g.lifeGap)} exposure for dependants; premium uplift ~£${Math.round(g.lifeGap * 0.0015 / 12)}/mo per month of delay`,
        citation: 'ABI underwriting age tables',
      }))
    }
    return flags
  },

  what_if_prompts(persona) {
    return [
      'What if I died tomorrow — would my family be OK financially?',
      'What if I had a stroke or cancer diagnosis in the next 5 years?',
      'What if I could not work for 24 months due to illness?',
      'Should I put my existing life policy in trust?',
    ]
  },
}
