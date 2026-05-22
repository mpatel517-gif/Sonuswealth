// ─────────────────────────────────────────────────────────────────────────────
// LENS: PHILANTHROPY ADVISER
//
// Perspective: a UK charity / impact-giving specialist (often a STEP-qualified
// solicitor or CAF / DAF manager). Covers Gift Aid, charity 10% IHT rule,
// Donor Advised Funds (DAF), Charitable Incorporated Organisations (CIO),
// matched giving via employer.
//
// Citations:
//   ITA  = Income Tax Act 2007
//   IHTA = Inheritance Tax Act 1984
//   CTA  = Corporation Tax Act 2010
//   HMRC Charities Outreach
// ─────────────────────────────────────────────────────────────────────────────

import {
  SEVERITY, URGENCY, fmt, pct,
  ageAt, grossAssets, grossIncome,
  observation, recommendation, redFlag,
} from './_base.js';

const REF = {
  CHARITY_10PCT: 0.10,
  IHT_RATE: 0.40,
  IHT_REDUCED_RATE: 0.36,
  GIFT_AID_BASIC_RATE: 0.25,            // £25 gross uplift per £100 net
  HR_RELIEF: 0.20,                      // higher-rate taxpayer extra reclaim
  AR_RELIEF: 0.25,                      // additional-rate extra reclaim
  HR_THRESHOLD: 50270,
  AR_THRESHOLD: 125140,
};

export const lens = {
  id: 'philanthropy-adviser',
  name: 'Philanthropy Adviser',
  short_name: 'Philanthropy',
  display_avatar: '💝',
  expertise_domain: ['gift_aid', 'charity_10pct', 'daf', 'cio', 'matched_giving'],
  description: 'A UK philanthropy specialist optimising charitable giving — Gift Aid, charity 10% IHT, DAF, CIO.',

  is_relevant(persona) {
    const charitable = persona.charitable_giving?.annual ?? persona.estate_plan?.charitable_gift ?? 0
    const income = grossIncome(persona)
    const estate = grossAssets(persona)
    if (charitable === 0 && estate < 500000) return { score: 0.2, reason: 'No declared giving + modest estate' }
    if (charitable > 0 || (income > 100000 && estate > 1000000)) {
      return { score: 0.85, reason: 'Active giving or high-net-worth — optimisation valuable' }
    }
    return { score: 0.5, reason: 'Standard philanthropy review applicable' }
  },

  observe(persona, asOfDate = new Date()) {
    const obs = []
    const income = grossIncome(persona)
    const charitable = persona.charitable_giving?.annual ?? 0
    const giftAidClaimed = persona.charitable_giving?.gift_aid_claimed === true
    const estate = grossAssets(persona)
    const ihtTaxable = Math.max(0, estate - 325000 - (persona.estate_plan?.passes_to_descendants_property > 0 ? 175000 : 0))
    const willCharity = persona.estate_plan?.charitable_gift ?? 0

    // OBS-1: Gift Aid not claimed despite higher-rate income
    if (charitable > 0 && income > REF.HR_THRESHOLD && !giftAidClaimed) {
      const grossedUp = charitable * 1.25
      const hrReclaim = Math.round(grossedUp * REF.HR_RELIEF)
      obs.push(observation({
        id: 'PH-OBS-01',
        severity: SEVERITY.MEDIUM,
        category: 'gift_aid',
        text: `You give ${fmt(charitable)}/yr to charity but Gift Aid is not claimed. The charity loses ${fmt(charitable * REF.GIFT_AID_BASIC_RATE)} of basic-rate uplift. As a higher-rate taxpayer, you also lose ${fmt(hrReclaim)} of personal income-tax relief via Self Assessment.`,
        citation: 'ITA 2007 s.413-415 (Gift Aid) + s.414 (HR relief)',
        finding: { annual: charitable, charityLoss: charitable * REF.GIFT_AID_BASIC_RATE, personalReclaim: hrReclaim },
      }))
    }

    // OBS-2: Charity 10% IHT rule
    if (ihtTaxable > 200000 && willCharity < ihtTaxable * REF.CHARITY_10PCT) {
      const requiredGift = Math.round(ihtTaxable * REF.CHARITY_10PCT)
      const ihtSaving = Math.round(ihtTaxable * (REF.IHT_RATE - REF.IHT_REDUCED_RATE))
      const netCostToBeneficiaries = requiredGift - ihtSaving
      obs.push(observation({
        id: 'PH-OBS-02',
        severity: SEVERITY.LOW,
        category: 'charity_10pct',
        text: `Charity 10% rule: leaving ${fmt(requiredGift)} (10% of taxable estate) to charity drops IHT rate from 40% to 36%. Charity gets ${fmt(requiredGift)}; your other beneficiaries save ${fmt(ihtSaving)} of IHT. Net cost to beneficiaries: ${fmt(netCostToBeneficiaries)} for ${fmt(requiredGift)} of charitable impact.`,
        citation: 'IHTA 1984 Sch 1A para 3 + FA 2012 s.209',
        finding: { requiredGift, ihtSaving, netCost: netCostToBeneficiaries },
      }))
    }

    // OBS-3: DAF candidate (high givers without a vehicle)
    if (charitable > 5000 && !persona.charitable_giving?.daf_in_place) {
      obs.push(observation({
        id: 'PH-OBS-03',
        severity: SEVERITY.LOW,
        category: 'daf',
        text: `Annual giving of ${fmt(charitable)} would benefit from a Donor Advised Fund. Bunch multiple years' giving into one tax year (max income-tax relief), then distribute to charities over time. Providers: CAF, NPT UK, Stewardship, Prism the Gift Fund. Setup minimum £10k-25k; ongoing fees ~1%.`,
        citation: 'HMRC Charities Outreach + CAF Donor Advised Fund guidance',
        finding: { annual: charitable, vehicleMissing: true },
      }))
    }

    // OBS-4: No charitable provision in will despite IHT exposure
    if (ihtTaxable > 500000 && willCharity === 0) {
      obs.push(observation({
        id: 'PH-OBS-04',
        severity: SEVERITY.LOW,
        category: 'will_charity',
        text: `Estate exposed to IHT (${fmt(ihtTaxable)} taxable) but no charitable bequest in the will. Even modest charitable provision (e.g. 5%) signals intent and is reviewable each year via a codicil if circumstances change.`,
        citation: 'STEP code of practice + IHTA 1984',
        finding: { ihtTaxable, currentCharitableBequest: 0 },
      }))
    }

    return obs
  },

  recommend(persona, asOfDate = new Date()) {
    const recs = []
    const income = grossIncome(persona)
    const charitable = persona.charitable_giving?.annual ?? 0
    const giftAidClaimed = persona.charitable_giving?.gift_aid_claimed === true
    const estate = grossAssets(persona)
    const ihtTaxable = Math.max(0, estate - 325000 - (persona.estate_plan?.passes_to_descendants_property > 0 ? 175000 : 0))
    const willCharity = persona.estate_plan?.charitable_gift ?? 0

    // REC-1: Tick the Gift Aid box
    if (charitable > 0 && !giftAidClaimed) {
      const grossedUp = charitable * 1.25
      const hrReclaim = income > REF.HR_THRESHOLD ? Math.round(grossedUp * (income >= REF.AR_THRESHOLD ? REF.AR_RELIEF : REF.HR_RELIEF)) : 0
      const charityUplift = Math.round(charitable * REF.GIFT_AID_BASIC_RATE)
      const totalValue = charityUplift + hrReclaim
      recs.push(recommendation({
        id: 'PH-REC-01',
        strategy_id: 'STRAT-GIFT-AID',
        headline: `Claim Gift Aid on your ${fmt(charitable)}/yr — ${fmt(totalValue)} combined value`,
        drill_down: `Tick the Gift Aid box on each donation. The charity reclaims 25p in £1 from HMRC (${fmt(charityUplift)} extra to causes you support). If you pay higher-rate tax, you also reclaim the difference via Self Assessment box "Charitable Giving" — for you, that's ${fmt(hrReclaim)} back from HMRC each year. Total value created: ${fmt(totalValue)}.`,
        action_steps: [
          'Tick Gift Aid declaration with each charity (or one-off bulk declaration)',
          'Track total annual giving for Self Assessment',
          'Box 5 Self Assessment: enter total Gift-Aided amount',
        ],
        impact: { gbp_per_year: totalValue, time_horizon: 'ongoing', certainty: 0.98 },
        risk: { reversibility: 'fully reversible', downside: 'must be UK taxpayer paying enough income tax to cover the relief', complexity: 'low' },
        citation: 'ITA 2007 s.413-415 + s.414 (HR relief)',
        assumptions: { uk_taxpayer: 'must pay UK income tax in the relevant year', adequate_tax_paid: 'tax paid must equal or exceed the Gift Aid reclaim' },
        flip_conditions: 'If you are not a UK taxpayer (e.g. retired with all income from non-taxable sources), do not tick Gift Aid.',
        fca_boundary: 'Information only.',
        common_mistakes: [
          'Ticking Gift Aid without sufficient tax paid (HMRC will reclaim)',
          'Forgetting to enter on Self Assessment for HR relief',
        ],
      }))
    }

    // REC-2: Will: 10% to charity to drop IHT rate
    if (ihtTaxable > 200000 && willCharity < ihtTaxable * REF.CHARITY_10PCT) {
      const requiredGift = Math.round(ihtTaxable * REF.CHARITY_10PCT)
      const ihtSaving = Math.round(ihtTaxable * (REF.IHT_RATE - REF.IHT_REDUCED_RATE))
      recs.push(recommendation({
        id: 'PH-REC-02',
        strategy_id: 'STRAT-WILL-10PCT',
        headline: `Will: leave 10% of taxable estate (${fmt(requiredGift)}) to charity → IHT rate drops to 36%`,
        drill_down: `Leaving at least 10% of your post-NRB taxable estate to a qualifying UK charity (or registered EU equivalent) drops the IHT rate on the rest from 40% to 36%. The charity receives ${fmt(requiredGift)}; your other beneficiaries' IHT bill drops by ${fmt(ihtSaving)}. Net to them: they "pay" ${fmt(requiredGift - ihtSaving)} for ${fmt(requiredGift)} of impact.`,
        action_steps: [
          'Choose a qualifying UK charity or CIO',
          'Engage solicitor to draft a percentage gift (not fixed amount — protects against estate growth)',
          'Solicitor verifies 10% test calculation against post-NRB taxable estate',
          'Review every 5 years or after major life events',
        ],
        impact: { gbp_lifetime: ihtSaving, time_horizon: 'applies at death', certainty: 0.92 },
        risk: { reversibility: 'fully reversible during life via will codicil', downside: 'beneficiaries inherit slightly less than non-charity will', complexity: 'low' },
        citation: 'IHTA 1984 Sch 1A para 3 + FA 2012 s.209',
        assumptions: { charity_qualifies: 'must be UK or EU charity or CASC', will_drafted_correctly: 'percentage gift, not fixed amount' },
        flip_conditions: 'If beneficiaries strongly oppose, alternative IHT mitigation routes available.',
        fca_boundary: 'Information only — solicitor required to draft.',
        common_mistakes: [
          'Specifying fixed amount instead of percentage',
          'Using non-qualifying charity (e.g. foreign)',
          'Misapplying 10% to gross estate (it is post-NRB)',
        ],
      }))
    }

    // REC-3: Set up DAF
    if (charitable > 5000 && !persona.charitable_giving?.daf_in_place) {
      recs.push(recommendation({
        id: 'PH-REC-03',
        strategy_id: 'STRAT-DAF',
        headline: 'Set up a Donor Advised Fund for tax-efficient bunching',
        drill_down: `A DAF lets you contribute a lump sum in one tax year (maxing your tax relief that year) and then distribute to specific charities over future years. Useful when you have a high-income tax year (bonus, business exit) and want the tax relief now without choosing charities yet. CAF, NPT UK, Stewardship are major UK providers. Setup minimum £10-25k; annual fees ~1%; investments inside the DAF grow tax-free.`,
        action_steps: [
          'Choose a DAF provider matching your charitable interests (CAF for breadth, Stewardship for evangelical, etc.)',
          'Contribute lump sum — relief in the tax year of contribution',
          'Recommend grants from the DAF to specific charities over time',
        ],
        impact: { gbp_per_year: Math.round(charitable * REF.HR_RELIEF), time_horizon: 'compounded over years of bunching', certainty: 0.86 },
        risk: { reversibility: 'irreversible once contributed', downside: 'fees on the DAF; cannot reclaim for personal use', complexity: 'medium' },
        citation: 'CAF + NPT UK DAF programmes + ITA 2007 s.413',
        assumptions: { sufficient_income: 'enough income to absorb the tax relief in the contribution year', strategic_giver: 'comfortable not naming charities at the outset' },
        flip_conditions: 'If you prefer fixed monthly direct debits to charities, a DAF adds friction. If income is stable, less benefit from bunching.',
        fca_boundary: 'Information only — DAF setup is administrative, not regulated investment advice.',
        common_mistakes: [
          'Contributing to a DAF in a low-income year (relief wasted)',
          'Picking a high-fee retail DAF when institutional options exist',
        ],
      }))
    }

    return recs
  },

  red_flags(persona) { return [] },

  what_if_prompts(persona) {
    return [
      'What if I gave 10% of my estate to charity?',
      'What if I set up a Donor Advised Fund this tax year?',
      'How much extra would my favourite charity get if I claimed Gift Aid properly?',
    ]
  },
}
