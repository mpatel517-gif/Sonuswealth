// ─────────────────────────────────────────────────────────────────────────────
// LENS: TRUST LAWYER
//
// Perspective: a UK Private Client Solicitor / STEP-qualified Trust & Estate
// practitioner reviewing inheritance, capacity, and intergenerational planning.
//
// Concerns: IHT exposure (NRB, RNRB, transferable allowances), PETs 7-year
// clock, taper relief, will currency, LPA status, trust structures (DGT, AIM
// BPR, discretionary), April 2027 SIPP IHT change, domicile.
//
// Citations:
//   IHTA = Inheritance Tax Act 1984
//   MCA  = Mental Capacity Act 2005
//   STEP = Society of Trust and Estate Practitioners guidance
//   FA   = Finance Act <year>
// ─────────────────────────────────────────────────────────────────────────────

import {
  SEVERITY, URGENCY, fmt, daysToSippIht,
  ageAt, grossAssets,
  observation, recommendation, redFlag,
} from './_base.js';

const REF = {
  NRB: 325000,                     // Nil-Rate Band (frozen to April 2030)
  RNRB: 175000,                    // Residence Nil-Rate Band
  RNRB_TAPER_START: 2000000,       // estate over £2M loses £1 RNRB per £2
  IHT_RATE: 0.40,                  // standard rate
  IHT_REDUCED_RATE: 0.36,          // charity 10% rule
  CHARITY_10PCT_THRESHOLD: 0.10,
  ANNUAL_GIFT_EXEMPTION: 3000,
  SMALL_GIFTS: 250,
  WEDDING_GIFTS: { child: 5000, grandchild: 2500, other: 1000 },
  PET_YEARS: 7,
  TAPER_BANDS: [
    { fromYear: 0, toYear: 3, rate: 1.00 },
    { fromYear: 3, toYear: 4, rate: 0.80 },
    { fromYear: 4, toYear: 5, rate: 0.60 },
    { fromYear: 5, toYear: 6, rate: 0.40 },
    { fromYear: 6, toYear: 7, rate: 0.20 },
  ],
  BPR_HOLD_YEARS: 2,
};

function computeIHTExposure(persona) {
  const estate = grossAssets(persona);
  const charitable = persona.estate_plan?.charitable_gift ?? 0;
  const propertyToDescendants = (persona.estate_plan?.passes_to_descendants_property ?? 0) > 0;
  const spousePassed = persona.estate_plan?.spouse_unused_nrb_pct ?? 0;          // 0-1

  // NRB + transferable spouse NRB
  const nrb = REF.NRB * (1 + spousePassed);
  // RNRB only if property passes to direct descendants and estate < £2M (then tapers)
  let rnrb = 0;
  if (propertyToDescendants) {
    if (estate <= REF.RNRB_TAPER_START) {
      rnrb = REF.RNRB * (1 + spousePassed);   // assumed transferable
    } else {
      const taperLoss = Math.min((estate - REF.RNRB_TAPER_START) / 2, REF.RNRB * (1 + spousePassed));
      rnrb = Math.max(0, REF.RNRB * (1 + spousePassed) - taperLoss);
    }
  }
  const totalAllowance = nrb + rnrb;
  const taxable = Math.max(0, estate - totalAllowance);

  // Charity 10% rule: gifts >= 10% of estate AFTER NRB allow reduced rate 36%
  const reducedRateApplies = charitable >= taxable * REF.CHARITY_10PCT_THRESHOLD;
  const rate = reducedRateApplies ? REF.IHT_REDUCED_RATE : REF.IHT_RATE;
  const liability = Math.round(taxable * rate);

  return { estate, nrb, rnrb, totalAllowance, taxable, rate, liability, reducedRateApplies };
}

export const lens = {
  id: 'trust-lawyer',
  name: 'Trust Lawyer',
  short_name: 'Estate',
  display_avatar: '⚖️',
  expertise_domain: ['iht', 'trusts', 'wills', 'lpa', 'domicile', 'beneficiaries', 'intergenerational'],
  description: 'A UK Private Client Solicitor reviewing your estate plan, IHT exposure, capacity arrangements, and intergenerational transfers.',

  // ─── RELEVANCE ─────────────────────────────────────────────────────────────
  is_relevant(persona) {
    const estate = grossAssets(persona);
    const age = ageAt(persona) ?? 0;

    if (estate < REF.NRB && age < 50) {
      return { score: 0.3, reason: 'Estate below NRB — limited IHT planning relevance; LPA/will basics still apply' };
    }
    if (estate > REF.NRB * 2 || age >= 60) {
      return { score: 1.0, reason: 'Estate exposed to IHT or approaching life-stage decisions — full estate planning relevance' };
    }
    return { score: 0.7, reason: 'Estate planning review valuable' };
  },

  // ─── OBSERVE ───────────────────────────────────────────────────────────────
  observe(persona, asOfDate = new Date()) {
    const obs = [];
    const age = ageAt(persona, asOfDate) ?? 0;
    const iht = computeIHTExposure(persona);
    const sipp = persona.assets?.sipp?.total ?? 0;
    const lpaSigned = persona.estate_plan?.lpa_signed === true;
    const willCurrent = persona.estate_plan?.will_last_updated_year;
    const yearsSinceWillUpdate = willCurrent ? (new Date().getFullYear() - willCurrent) : null;
    const recentLifeEvent = persona.estate_plan?.recent_life_event ?? null;

    // TL-OBS-1: IHT exposure (always for any persona above NRB)
    if (iht.taxable > 0) {
      obs.push(observation({
        id: 'TL-OBS-01',
        severity: iht.liability > 500000 ? SEVERITY.HIGH : SEVERITY.MEDIUM,
        category: 'iht',
        text: `Estate of ${fmt(iht.estate)} versus available allowances ${fmt(iht.totalAllowance)} (NRB ${fmt(iht.nrb)} + RNRB ${fmt(iht.rnrb)}). Taxable: ${fmt(iht.taxable)} at ${(iht.rate * 100).toFixed(0)}% → IHT liability ${fmt(iht.liability)}.`,
        citation: 'IHTA 1984 s.7 (NRB) + s.8A (RNRB) + Sch 1A (RNRB taper)',
        finding: iht,
      }));
    } else if (iht.estate > REF.NRB) {
      obs.push(observation({
        id: 'TL-OBS-01b',
        severity: SEVERITY.LOW,
        category: 'iht',
        text: `Estate of ${fmt(iht.estate)} is within allowances (${fmt(iht.totalAllowance)}). No IHT liability projected — but stay alert: NRB and RNRB are frozen to April 2030 while asset prices rise.`,
        citation: 'IHTA 1984 s.7-8A + Spring Budget 2024 (allowance freeze)',
        finding: iht,
      }));
    }

    // TL-OBS-2: LPA status (critical at any age 50+)
    if (!lpaSigned && age >= 50) {
      obs.push(observation({
        id: 'TL-OBS-02',
        severity: SEVERITY.HIGH,
        category: 'lpa',
        text: `No Lasting Power of Attorney recorded. Without LPA, if you lose capacity through illness or accident, your family must apply to the Court of Protection — a process taking 4-6 months and costing £1,500-3,000. LPA must be made while you have capacity. The 30-day cooling-off period means it can be in force ~10 weeks after signing.`,
        citation: 'MCA 2005 s.9-14 (LPA) + Office of the Public Guardian',
        finding: { lpaSigned: false, age, courtOfProtectionCost: 2250 },
      }));
    }

    // TL-OBS-3: Will currency
    if (yearsSinceWillUpdate == null) {
      obs.push(observation({
        id: 'TL-OBS-03a',
        severity: SEVERITY.HIGH,
        category: 'will',
        text: `No will on record. Intestacy rules apply: estate distributed by statutory order (spouse first £322k + half the rest; children share the other half). RNRB requires the property to pass to direct descendants — intestacy may break this.`,
        citation: 'Administration of Estates Act 1925 + Inheritance and Trustees Powers Act 2014',
        finding: { willExists: false },
      }));
    } else if (yearsSinceWillUpdate >= 5) {
      obs.push(observation({
        id: 'TL-OBS-03b',
        severity: SEVERITY.MEDIUM,
        category: 'will',
        text: `Your will was last updated ${yearsSinceWillUpdate} years ago. STEP guidance recommends review at least every 5 years and after every major life event (marriage, divorce, birth, death of beneficiary, significant asset change).`,
        citation: 'STEP guidance + Wills Act 1837',
        finding: { yearsSinceUpdate: yearsSinceWillUpdate },
      }));
    }

    // TL-OBS-4: April 2027 SIPP IHT — trust-lawyer angle
    if (sipp > 100000) {
      const days = daysToSippIht(asOfDate);
      if (days > 0) {
        const additionalExposure = Math.round(sipp * iht.rate);
        obs.push(observation({
          id: 'TL-OBS-04',
          severity: days < 365 ? SEVERITY.HIGH : SEVERITY.MEDIUM,
          category: 'iht_pension',
          text: `From 6 April 2027 (${days} days) your SIPP enters the IHT estate. At current value this adds approximately ${fmt(additionalExposure)} to your liability. Combined with estate IHT of ${fmt(iht.liability)}, total post-2027 exposure: ${fmt(iht.liability + additionalExposure)}. Estate-side mitigation (gifting, trusts, BPR) becomes proportionally more important.`,
          citation: 'FA 2026 s.99 (pension IHT inclusion, Royal Assent 18 March 2026)',
          finding: { days, additionalExposure, totalPost2027: iht.liability + additionalExposure },
        }));
      }
    }

    // TL-OBS-5: RNRB taper risk (estate above £2M)
    if (iht.estate > REF.RNRB_TAPER_START) {
      const fullRnrb = REF.RNRB * (1 + (persona.estate_plan?.spouse_unused_nrb_pct ?? 0));
      const rnrbLost = fullRnrb - iht.rnrb;
      obs.push(observation({
        id: 'TL-OBS-05',
        severity: SEVERITY.MEDIUM,
        category: 'rnrb_taper',
        text: `Estate of ${fmt(iht.estate)} exceeds the £2M RNRB taper threshold. You lose £1 of RNRB for every £2 of estate value above £2M. RNRB lost: ${fmt(rnrbLost)} — equivalent to ${fmt(Math.round(rnrbLost * REF.IHT_RATE))} of additional IHT. Bringing the estate below £2M (gifting, BPR investments) preserves the full RNRB.`,
        citation: 'IHTA 1984 Sch 1A para 2-3 (RNRB taper)',
        finding: { estate: iht.estate, rnrbLost, taxImpact: Math.round(rnrbLost * REF.IHT_RATE) },
      }));
    }

    // TL-OBS-6: Charity 10% rule status
    const charitable = persona.estate_plan?.charitable_gift ?? 0;
    if (iht.taxable > 100000 && !iht.reducedRateApplies && charitable < iht.taxable * REF.CHARITY_10PCT_THRESHOLD) {
      const requiredGift = Math.round(iht.taxable * REF.CHARITY_10PCT_THRESHOLD);
      const ihtSavingIfApplied = Math.round(iht.taxable * (REF.IHT_RATE - REF.IHT_REDUCED_RATE));
      obs.push(observation({
        id: 'TL-OBS-06',
        severity: SEVERITY.LOW,
        category: 'charity_10pct',
        text: `Leaving 10% of your taxable estate to charity (${fmt(requiredGift)}) reduces the IHT rate on the rest from 40% to 36% — saving ${fmt(ihtSavingIfApplied)} for your other beneficiaries. The charity gets ${fmt(requiredGift)}; your beneficiaries effectively pay ${fmt(requiredGift - ihtSavingIfApplied)} for it.`,
        citation: 'IHTA 1984 Sch 1A para 3 + FA 2012 s.209 (reduced rate)',
        finding: { requiredGift, ihtSavingIfApplied },
      }));
    }

    // TL-OBS-7: Recent life event triggering review
    if (recentLifeEvent) {
      obs.push(observation({
        id: 'TL-OBS-07',
        severity: SEVERITY.HIGH,
        category: 'will_currency',
        text: `Recent life event recorded: ${recentLifeEvent}. STEP guidance: review will, LPA, beneficiary nominations, and trust deeds after every major life event. Failure to update can defeat IHT planning (e.g. ex-spouse remaining as pension nominee).`,
        citation: 'STEP code of professional conduct + Wills Act 1837 s.18A (revocation on marriage)',
        finding: { event: recentLifeEvent },
      }));
    }

    return obs;
  },

  // ─── RECOMMEND ─────────────────────────────────────────────────────────────
  recommend(persona, asOfDate = new Date()) {
    const recs = [];
    const age = ageAt(persona, asOfDate) ?? 0;
    const iht = computeIHTExposure(persona);
    const sipp = persona.assets?.sipp?.total ?? 0;
    const lpaSigned = persona.estate_plan?.lpa_signed === true;

    // REC-1: Sign LPA if missing (highest impact, lowest cost)
    if (!lpaSigned && age >= 50) {
      recs.push(recommendation({
        id: 'TL-REC-01',
        strategy_id: 'STRAT-SIGN-LPA',
        headline: `Sign Lasting Power of Attorney (Property + Health) within 30 days`,
        drill_down: `LPAs cost ~£82 each to register with the Office of the Public Guardian (or free if you complete via GOV.UK). They protect you against the alternative: if you lose capacity, your family must apply to the Court of Protection — taking 4-6 months and costing £1,500-3,000, with ongoing supervision fees. The two LPAs (Property & Financial Affairs + Health & Welfare) are separate documents. Both are needed.`,
        action_steps: [
          'Choose attorneys you trust completely (typically spouse + 1-2 children)',
          'Complete via gov.uk/power-of-attorney or solicitor (~£300-500 if professionally drafted)',
          'Register both LPAs with the Office of the Public Guardian',
          '30-day cooling-off period before activation',
        ],
        impact: { gbp_one_off: 2250, time_horizon: 'protection from age of signing until death or revocation', certainty: 0.99 },
        risk: { reversibility: 'fully revocable while capacity retained', downside: 'minimal — only failure to register is the risk', complexity: 'low' },
        citation: 'MCA 2005 s.9-14 + Office of the Public Guardian',
        assumptions: { capacity_now: 'must have mental capacity at signing', trusted_attorneys: 'choose attorneys carefully — they will have significant power' },
        flip_conditions: 'None — LPA is universally beneficial. Only delay is if attorney choice is unclear.',
        fca_boundary: 'Information only — legal document. Suggest using a solicitor for any complexity.',
        common_mistakes: [
          'Only completing one LPA (you need both Property and Health)',
          'Choosing a single attorney with no replacement',
          'Forgetting to inform attorneys they have been chosen',
        ],
      }));
    }

    // REC-2: Pre-2027 SIPP drawdown to escape April 2027 IHT
    if (sipp > 250000 && age >= 55 && daysToSippIht(asOfDate) > 30) {
      const tfcAvailable = sipp * 0.25;
      const ihtSaved = Math.round(tfcAvailable * iht.rate);
      recs.push(recommendation({
        id: 'TL-REC-02',
        strategy_id: 'STRAT-PRE-2027-SIPP',
        headline: `Crystallise ${fmt(tfcAvailable)} tax-free cash before April 2027 deadline`,
        drill_down: `Currently SIPP nominees inherit IHT-free; from 6 April 2027, unused SIPP enters the IHT estate. Crystallising the 25% tax-free cash (${fmt(tfcAvailable)}) before April 2027 permanently removes that portion from future IHT exposure. Route it to ISAs (£20k/yr each adult), the normal-expenditure-out-of-income exemption (unlimited if from surplus income, documented over 4+ years), or PETs (clear after 7 years). IHT saving on this portion alone: ${fmt(ihtSaved)}.`,
        action_steps: [
          'Open flexi-access drawdown with current SIPP provider',
          'Crystallise full 25% TFC (or in tranches across two tax years to bridge timing)',
          'Re-deploy into ISA wrapper, gift via normal-expenditure exemption, or fund PETs',
          'Document gift trail — HMRC requires evidence of normal-expenditure pattern',
        ],
        impact: { gbp_lifetime: ihtSaved, time_horizon: 'permanent IHT removal of the crystallised portion', certainty: 0.88 },
        risk: { reversibility: 'crystallisation is irreversible', downside: 'reduces residual SIPP — pension growth environment lost on that portion', complexity: 'medium' },
        citation: 'FA 2026 s.99 (pension IHT) + IHTA 1984 s.21 (normal expenditure out of income)',
        assumptions: { estate_above_thresholds: 'IHT exposure exists', lsa_available: 'TFC within Lump Sum Allowance' },
        flip_conditions: 'If estate is below £1M total allowance, IHT is not a concern. Otherwise the deadline is fixed.',
        fca_boundary: 'Information only — irreversible. Joint specialist advice (pension + estate) essential.',
        common_mistakes: [
          'Triggering MPAA by taking taxable income alongside TFC',
          'Re-investing the TFC into the same pension structure',
          'Not documenting the normal-expenditure-out-of-income evidence trail',
        ],
      }));
    }

    // REC-3: 7-year PETs if estate above NRB
    if (iht.taxable > 200000 && age < 80) {
      const giftAmount = Math.min(iht.taxable, 500000);   // suggest first tranche
      const ihtSaved = Math.round(giftAmount * iht.rate);
      recs.push(recommendation({
        id: 'TL-REC-03',
        strategy_id: 'STRAT-PETS-7YR',
        headline: `Gift ${fmt(giftAmount)} as Potentially Exempt Transfer — clear in 7 years`,
        drill_down: `Outright gifts to individuals (not trusts) are Potentially Exempt Transfers. Survive 7 years and the gift is fully exempt from IHT. Survive 3+ years and taper relief applies (year 3-4: 20% off, year 4-5: 40% off, year 5-6: 60% off, year 6-7: 80% off). On a ${fmt(giftAmount)} gift, full IHT saving after 7 years is ${fmt(ihtSaved)}. Annual gift exemption of ${fmt(REF.ANNUAL_GIFT_EXEMPTION)} can be used alongside. Wedding gifts to children: ${fmt(REF.WEDDING_GIFTS.child)}. Small gifts to anyone: ${fmt(REF.SMALL_GIFTS)} per recipient per year.`,
        action_steps: [
          'Identify amount you can afford to part with permanently (test against retirement cashflow)',
          'Document the gift in writing with the date',
          'Consider 7-year term life cover to protect the IHT liability if you die within the clock',
          'Track via personal records — executors will need evidence',
        ],
        impact: { gbp_lifetime: ihtSaved, time_horizon: 'full exemption after 7 years', certainty: 0.82 },
        risk: { reversibility: 'gifts are irreversible', downside: 'loss of control over capital; partial clawback if death within 7 years', complexity: 'medium' },
        citation: 'IHTA 1984 s.3A (PETs) + s.7(4) (taper relief)',
        assumptions: { retain_sufficient_capital: 'must not jeopardise own standard of living', life_expectancy: 'best value if you live 7+ years from gift date' },
        flip_conditions: 'If health is poor or life expectancy under 7 years, AIM BPR (2-year clock) dominates. If estate is below thresholds, no need.',
        fca_boundary: 'Information only — irreversible. Consider term life cover for 7-year period.',
        common_mistakes: [
          'Gifting and continuing to benefit (Gifts with Reservation of Benefit fully fail)',
          'Not documenting the gift date',
          'Ignoring the 14-year shadow on chargeable lifetime transfers (trusts)',
        ],
      }));
    }

    // REC-4: AIM BPR portfolio (2-year horizon)
    const gia = persona.assets?.portfolio?.value ?? 0;
    if (gia > 100000 && iht.taxable > 0 && age >= 55 && age < 85) {
      const allocAmount = Math.min(gia * 0.5, 500000);
      const ihtSaved = Math.round(allocAmount * iht.rate);
      recs.push(recommendation({
        id: 'TL-REC-04',
        strategy_id: 'STRAT-AIM-BPR',
        headline: `Allocate ${fmt(allocAmount)} to AIM BPR-qualifying portfolio — IHT-exempt after 2 years`,
        drill_down: `Shares in qualifying AIM-listed trading companies attract 100% Business Property Relief after just 2 years of ownership, removing them from the IHT estate. This is the fastest IHT-mitigation lever available (PETs need 7 years). On ${fmt(allocAmount)}, full BPR saves ${fmt(ihtSaved)} of IHT. Trade-off: AIM is significantly more volatile than mainstream equity — typical annual range ±20-25%. Use managed BPR portfolios (Octopus, Puma, Foresight, etc.) for diversification within the BPR-qualifying universe.`,
        action_steps: [
          'Engage AIM BPR specialist or use a packaged BPR service',
          'Move ${fmt(allocAmount)} from GIA into BPR-qualifying shares in tranches',
          'Hold 2+ years for BPR to apply (10-year rolling re-test required)',
          'Annual review: monitor that shares remain BPR-qualifying',
        ],
        impact: { gbp_lifetime: ihtSaved, time_horizon: '2-year hold for full BPR', certainty: 0.78 },
        risk: { reversibility: 'sell at any time, but BPR clock resets', downside: 'AIM volatility, BPR rules can change in future Budget', complexity: 'high' },
        citation: 'IHTA 1984 s.105-114 (Business Property Relief) + HMRC IHTM25131',
        assumptions: { risk_tolerance: 'comfortable with 25% drawdowns', diversification_via_basket: 'use managed AIM BPR portfolio not single stocks', hold_years: 'must hold 2 years' },
        flip_conditions: 'If risk-averse or close to age 85+, prefer Discretionary Gift Trust (DGT) or 7-yr PETs. If Budget removes AIM BPR, value disappears.',
        fca_boundary: 'Information only — higher-risk allocation. Specialist advice essential.',
        common_mistakes: [
          'Single-stock concentration in AIM BPR — use a diversified basket',
          'Selling within 2 years (loses BPR)',
          'Not retesting BPR qualification at 10-year mark',
        ],
      }));
    }

    // REC-5: Charity 10% rule to drop IHT rate to 36%
    const charitable = persona.estate_plan?.charitable_gift ?? 0;
    if (iht.taxable > 200000 && !iht.reducedRateApplies && charitable < iht.taxable * REF.CHARITY_10PCT_THRESHOLD) {
      const requiredGift = Math.round(iht.taxable * REF.CHARITY_10PCT_THRESHOLD);
      const ihtSavingIfApplied = Math.round(iht.taxable * (REF.IHT_RATE - REF.IHT_REDUCED_RATE));
      recs.push(recommendation({
        id: 'TL-REC-05',
        strategy_id: 'STRAT-CHARITY-10PCT',
        headline: `Will: 10% of taxable estate (${fmt(requiredGift)}) to charity → IHT rate drops to 36%`,
        drill_down: `Leaving at least 10% of your taxable estate (post-NRB) to a qualifying charity triggers IHT s.7(2) reduced rate of 36% on the rest. The charity receives ${fmt(requiredGift)}; your other beneficiaries' IHT bill drops by ${fmt(ihtSavingIfApplied)}. Net cost to beneficiaries: ${fmt(requiredGift - ihtSavingIfApplied)}. The "10% test" uses the post-NRB taxable estate — a slight nuance worth getting right via your solicitor. The provision is in the will, not lifetime gift.`,
        action_steps: [
          'Choose qualifying UK or EU charity / CIO',
          'Update will to specify percentage gift (not fixed amount — protects against estate-value changes)',
          'Solicitor checks the 10% test calculation is met after NRB',
        ],
        impact: { gbp_lifetime: ihtSavingIfApplied, time_horizon: 'applies at death', certainty: 0.92 },
        risk: { reversibility: 'change will at any time during life', downside: 'beneficiaries get less than non-charity will', complexity: 'low' },
        citation: 'IHTA 1984 Sch 1A para 3 + FA 2012 s.209',
        assumptions: { charity_qualifies: 'must be UK/EU charity or CASC', will_drafted_correctly: 'solicitor checks 10% test calculation' },
        flip_conditions: 'If beneficiaries strongly oppose charitable element, alternative IHT mitigation routes may be preferred.',
        fca_boundary: 'Information only — solicitor essential to draft 10% test correctly.',
        common_mistakes: [
          'Specifying fixed amount instead of percentage (estate growth breaks 10% threshold)',
          'Misapplying 10% to gross estate instead of post-NRB taxable',
          'Using non-qualifying charity (e.g. foreign)',
        ],
      }));
    }

    return recs;
  },

  // ─── RED FLAGS ─────────────────────────────────────────────────────────────
  red_flags(persona, asOfDate = new Date()) {
    const flags = [];
    const lpaSigned = persona.estate_plan?.lpa_signed === true;
    const age = ageAt(persona, asOfDate) ?? 0;
    const sippDays = daysToSippIht(asOfDate);
    const sipp = persona.assets?.sipp?.total ?? 0;

    if (!lpaSigned && age >= 60) {
      flags.push(redFlag({
        id: 'TL-RF-01',
        urgency: URGENCY.IMMEDIATE,
        action: 'Sign LPA (Property + Health) — must have capacity at signing',
        deadline: 'Now — every month delayed risks Court of Protection cost (~£2,250) on capacity loss',
        cost_of_inaction: 'Court of Protection cost £1,500-3,000 + 4-6 months delay if capacity lost',
        citation: 'MCA 2005 s.9-14',
      }));
    }
    if (sippDays > 0 && sippDays < 730 && sipp > 250000) {
      flags.push(redFlag({
        id: 'TL-RF-02',
        urgency: URGENCY.URGENT,
        action: 'Plan pre-2027 SIPP crystallisation strategy',
        deadline: `6 April 2027 — ${sippDays} days remaining`,
        cost_of_inaction: `~${fmt(Math.round(sipp * 0.25 * 0.40))} additional IHT exposure on retained tax-free cash`,
        citation: 'FA 2026 s.99',
      }));
    }
    return flags;
  },

  // ─── WHAT-IF PROMPTS ───────────────────────────────────────────────────────
  what_if_prompts(persona) {
    const prompts = [];
    const iht = computeIHTExposure(persona);
    if (iht.taxable > 0) prompts.push('What if I gifted £500k to my children today?');
    if (iht.estate > REF.RNRB_TAPER_START) prompts.push('What if I brought my estate below £2M before death?');
    prompts.push('What if I set up a discretionary trust for grandchildren?');
    prompts.push('What if I moved my GIA into AIM BPR-qualifying shares?');
    return prompts;
  },
};
