// ─────────────────────────────────────────────────────────────────────────────
// LENS: PENSION SPECIALIST
//
// Perspective: a UK Pension Transfer Specialist / SIPP & SSAS adviser.
// Concerns: State Pension eligibility, Annual Allowance, MPAA, LSA, carry-
// forward, decumulation strategy, scheme consolidation, April 2027 SIPP IHT.
//
// Distinct from Tax Accountant by depth on pension-specific rules rather
// than year-end planning across wrappers.
//
// Citations:
//   FA   = Finance Act <year>
//   PTM  = HMRC Pensions Tax Manual
//   SPA  = State Pension Act 2014
// ─────────────────────────────────────────────────────────────────────────────

import {
  SEVERITY, URGENCY, fmt, daysToTaxYearEnd, daysToSippIht,
  ageAt, grossIncome,
  observation, recommendation, redFlag,
} from './_base.js';

const REF = {
  ANNUAL_ALLOWANCE: 60000,
  MPAA: 10000,
  LSA: 268275,
  STATE_PENSION_AGE: 67,
  STATE_PENSION_FULL: 11502,                 // 2025-26 full new State Pension
  STATE_PENSION_QUALIFY_YEARS: 35,           // for full nSP
  STATE_PENSION_MIN_YEARS: 10,               // minimum for any nSP
  DEFERMENT_UPLIFT_PCT: 0.058,               // 5.8% per year deferred (1% per 9 weeks)
  CARRY_FORWARD_YEARS: 3,
  HR_THRESHOLD: 50270,
  AR_THRESHOLD: 125140,
  PA_TAPER_START: 100000,
  TAPERED_AA_THRESHOLD: 260000,              // adjusted income threshold
};

export const lens = {
  id: 'pension-specialist',
  name: 'Pension Specialist',
  short_name: 'Pension',
  display_avatar: '🏦',
  expertise_domain: ['pensions', 'state_pension', 'sipp', 'ssas', 'mpaa', 'lsa', 'drawdown', 'consolidation'],
  description: 'A UK Pension Transfer Specialist reviewing your pension position — Annual Allowance, drawdown structure, State Pension, scheme consolidation.',

  // ─── RELEVANCE ─────────────────────────────────────────────────────────────
  is_relevant(persona) {
    const sipp = persona.assets?.sipp?.total ?? 0;
    const pension = persona.assets?.pension?.value ?? 0;
    const totalPension = sipp + pension;
    const age = ageAt(persona) ?? 0;

    if (totalPension === 0 && age < 50) {
      return { score: 0.2, reason: 'No declared pension and pre-accumulation phase' };
    }
    if (age >= 55 || totalPension > 250000) {
      return { score: 1.0, reason: 'At or near pension freedoms age, or substantial pension wealth — full pension planning relevance' };
    }
    if (totalPension > 50000) {
      return { score: 0.7, reason: 'Active pension accumulation — contribution and consolidation review valuable' };
    }
    return { score: 0.5, reason: 'Standard pension planning relevance' };
  },

  // ─── OBSERVE ───────────────────────────────────────────────────────────────
  observe(persona, asOfDate = new Date()) {
    const obs = [];
    const age = ageAt(persona, asOfDate) ?? 0;
    const sipp = persona.assets?.sipp?.total ?? 0;
    const pension = persona.assets?.pension?.value ?? 0;
    const totalPension = sipp + pension;
    const income = grossIncome(persona);
    const niYears = persona.ni_record?.qualifying_years ?? null;
    const carryForward = persona.pension?.carry_forward_available ?? 0;
    const aaContribThisYear = persona.contributions_this_year?.pension ?? 0;
    const mpaaTriggered = persona.pension?.mpaa_triggered === true;

    // PS-OBS-1: State Pension qualifying-years status
    if (niYears != null && age < REF.STATE_PENSION_AGE) {
      if (niYears < REF.STATE_PENSION_MIN_YEARS) {
        obs.push(observation({
          id: 'PS-OBS-01a',
          severity: SEVERITY.HIGH,
          category: 'state_pension',
          text: `You have ${niYears} qualifying NI years. Below the 10-year minimum — you would receive zero State Pension. ${REF.STATE_PENSION_MIN_YEARS - niYears} more years needed for ANY entitlement.`,
          citation: 'SPA 2014 s.4 (minimum qualifying period)',
          finding: { niYears, minRequired: REF.STATE_PENSION_MIN_YEARS, currentEntitlement: 0 },
        }));
      } else if (niYears < REF.STATE_PENSION_QUALIFY_YEARS) {
        const projected = Math.round(REF.STATE_PENSION_FULL * (niYears / REF.STATE_PENSION_QUALIFY_YEARS));
        const missing = REF.STATE_PENSION_QUALIFY_YEARS - niYears;
        obs.push(observation({
          id: 'PS-OBS-01b',
          severity: SEVERITY.MEDIUM,
          category: 'state_pension',
          text: `You have ${niYears} of ${REF.STATE_PENSION_QUALIFY_YEARS} NI years for full State Pension. Current projection: ${fmt(projected)}/yr. ${missing} more years (or voluntary Class 3 contributions at £179.40/yr each) would reach the full ${fmt(REF.STATE_PENSION_FULL)}.`,
          citation: 'SPA 2014 Sch 1 + HMRC NIM41200 (voluntary Class 3)',
          finding: { niYears, full: REF.STATE_PENSION_QUALIFY_YEARS, projected, fullEntitlement: REF.STATE_PENSION_FULL },
        }));
      } else {
        obs.push(observation({
          id: 'PS-OBS-01c',
          severity: SEVERITY.LOW,
          category: 'state_pension',
          text: `${niYears} qualifying NI years secures the full new State Pension of ${fmt(REF.STATE_PENSION_FULL)}/yr from age ${REF.STATE_PENSION_AGE}.`,
          citation: 'SPA 2014 Sch 1',
          finding: { niYears, fullEntitlement: REF.STATE_PENSION_FULL },
        }));
      }
    }

    // PS-OBS-2: Annual Allowance + carry-forward headroom
    const aaAvailable = REF.ANNUAL_ALLOWANCE - aaContribThisYear;
    const totalHeadroom = aaAvailable + carryForward;
    if (income > REF.HR_THRESHOLD && totalHeadroom > 10000) {
      const marginalRate = income >= REF.AR_THRESHOLD ? 0.45 : 0.40;
      const reliefValue = Math.round(totalHeadroom * marginalRate);
      obs.push(observation({
        id: 'PS-OBS-02',
        severity: SEVERITY.MEDIUM,
        category: 'annual_allowance',
        text: `Pension contribution headroom: ${fmt(totalHeadroom)} (${fmt(aaAvailable)} current AA + ${fmt(carryForward)} carry-forward, ${REF.CARRY_FORWARD_YEARS}-year rolling window). At your marginal rate, full use generates ${fmt(reliefValue)} tax relief.`,
        citation: 'FA 2004 s.227 (AA) + s.228A (carry-forward) + PTM055100',
        finding: { aaAvailable, carryForward, totalHeadroom, reliefValue, marginalRate },
      }));
    }

    // PS-OBS-3: MPAA triggered → reduced AA
    if (mpaaTriggered) {
      const remainingAA = Math.max(0, REF.MPAA - aaContribThisYear);
      obs.push(observation({
        id: 'PS-OBS-03',
        severity: SEVERITY.HIGH,
        category: 'mpaa',
        text: `Your MPAA has been triggered (flexible drawdown taken). Your money-purchase Annual Allowance is restricted to ${fmt(REF.MPAA)}/yr — ${fmt(remainingAA)} remaining this year. Carry-forward does NOT apply to MPAA-restricted contributions.`,
        citation: 'FA 2017 s.10 + PTM056510 (MPAA)',
        finding: { mpaaLimit: REF.MPAA, remaining: remainingAA },
      }));
    }

    // PS-OBS-4: Tapered AA risk (very high earners)
    if (income > REF.TAPERED_AA_THRESHOLD) {
      const taperedAA = Math.max(10000, REF.ANNUAL_ALLOWANCE - (income - REF.TAPERED_AA_THRESHOLD) / 2);
      obs.push(observation({
        id: 'PS-OBS-04',
        severity: SEVERITY.HIGH,
        category: 'tapered_aa',
        text: `Adjusted income of ${fmt(income)} exceeds £260,000 — your Annual Allowance tapers down to ${fmt(taperedAA)}. Contributing above this triggers an Annual Allowance charge at marginal rate.`,
        citation: 'FA 2004 s.228ZA (tapered AA, threshold £260k, taper to £10k)',
        finding: { adjustedIncome: income, taperedAA },
      }));
    }

    // PS-OBS-5: LSA usage tracking (Lump Sum Allowance, replaces LTA)
    if (sipp > 0 && age >= 55) {
      const lsaUsed = persona.pension_history?.lsa_used ?? 0;
      const lsaRemaining = REF.LSA - lsaUsed;
      const maxTfc = Math.min(sipp * 0.25, lsaRemaining);
      obs.push(observation({
        id: 'PS-OBS-05',
        severity: lsaRemaining < sipp * 0.25 ? SEVERITY.HIGH : SEVERITY.LOW,
        category: 'lsa',
        text: `Lump Sum Allowance: ${fmt(REF.LSA)} lifetime cap on tax-free cash. ${fmt(lsaUsed)} used so far, ${fmt(lsaRemaining)} remaining. Maximum TFC you can take from current SIPP: ${fmt(maxTfc)}.`,
        citation: 'FA 2024 s.32 + Sch 9 (LSA, replacing LTA from 6 April 2024)',
        finding: { lsaTotal: REF.LSA, lsaUsed, lsaRemaining, maxTfc },
      }));
    }

    // PS-OBS-6: April 2027 SIPP IHT inclusion — pension-specific angle
    if (sipp > 100000) {
      const days = daysToSippIht(asOfDate);
      if (days > 0) {
        const exposureAtDeath = sipp * 0.40;
        obs.push(observation({
          id: 'PS-OBS-06',
          severity: days < 365 ? SEVERITY.HIGH : SEVERITY.MEDIUM,
          category: 'sipp_iht',
          text: `Pension freedoms strategy needs re-thinking before April 2027 (${days} days). Currently SIPP nominees can inherit IHT-free; from 6 April 2027 unused SIPP enters the IHT estate. At current value, ${fmt(exposureAtDeath)} of IHT exposure created. Affects "spend-other-assets-first" decumulation logic.`,
          citation: 'FA 2026 s.99 (Royal Assent 18 March 2026; effective 6 April 2027)',
          finding: { sipp, days, exposureAtDeath },
        }));
      }
    }

    // PS-OBS-7: Multiple pension pots → consolidation candidate
    const pensionCount = (persona.pension?.pots ?? []).length;
    if (pensionCount >= 3 && totalPension > 100000) {
      obs.push(observation({
        id: 'PS-OBS-07',
        severity: SEVERITY.LOW,
        category: 'consolidation',
        text: `You have ${pensionCount} separate pension pots totalling ${fmt(totalPension)}. Consolidation may reduce annual fees (typical saving 0.3-0.7% AMC) and simplify drawdown — but only if the receiving scheme offers equivalent guarantees, drawdown flexibility, and protected tax-free cash where relevant.`,
        citation: 'PTM103100 (transfers) + FCA pension transfer rules',
        finding: { pensionCount, totalPension },
      }));
    }

    return obs;
  },

  // ─── RECOMMEND ─────────────────────────────────────────────────────────────
  recommend(persona, asOfDate = new Date()) {
    const recs = [];
    const age = ageAt(persona, asOfDate) ?? 0;
    const sipp = persona.assets?.sipp?.total ?? 0;
    const income = grossIncome(persona);
    const niYears = persona.ni_record?.qualifying_years ?? null;
    const carryForward = persona.pension?.carry_forward_available ?? 0;
    const aaContribThisYear = persona.contributions_this_year?.pension ?? 0;
    const aaAvailable = REF.ANNUAL_ALLOWANCE - aaContribThisYear;
    const totalHeadroom = aaAvailable + carryForward;

    // REC-1: Use carry-forward before April 2027
    if (income > REF.HR_THRESHOLD && totalHeadroom > 20000) {
      const useAmount = Math.min(totalHeadroom, income - REF.PA_TAPER_START);
      const marginalRate = income >= REF.AR_THRESHOLD ? 0.45 : 0.40;
      const reliefAmount = Math.round(useAmount * marginalRate);
      recs.push(recommendation({
        id: 'PS-REC-01',
        strategy_id: 'STRAT-CARRY-FORWARD',
        headline: `Use ${fmt(useAmount)} of pension headroom before April 2027`,
        drill_down: `You have ${fmt(totalHeadroom)} of contribution headroom (${fmt(aaAvailable)} current AA + ${fmt(carryForward)} carry-forward from the previous 3 years). At your marginal rate of ${(marginalRate * 100).toFixed(0)}%, the tax relief on a ${fmt(useAmount)} contribution is ${fmt(reliefAmount)}. Carry-forward is "use it or lose it" on a 3-year rolling window — last year's allowance disappears each April. Pre-2027 contributions also help reduce the future IHT-exposed estate.`,
        action_steps: [
          'Verify the £${(useAmount / 1000).toFixed(0)}k fits within your earnings (cannot contribute more than 100% of earned income)',
          'Check no MPAA has been triggered (would limit you to £10k AA)',
          'Make the contribution via SIPP provider before 5 April year-end',
          'Reclaim higher/additional-rate relief via Self Assessment',
        ],
        impact: { gbp_per_year: reliefAmount, time_horizon: 'this tax year', certainty: 0.92 },
        risk: { reversibility: 'irreversible — locked until age 55+', downside: 'reduces liquid capital; affected by April 2027 IHT rule if SIPP retained at death', complexity: 'medium' },
        citation: 'FA 2004 s.227-228A (AA + carry-forward) + PTM055100',
        assumptions: { earnings_sufficient: 'must have UK earnings ≥ contribution', no_mpaa: 'MPAA not yet triggered', under_lta: 'LSA headroom available for future TFC' },
        flip_conditions: 'If estate already under IHT thresholds, gifting may dominate. If you expect to need liquidity within 10 years, ISA may be preferred.',
        fca_boundary: 'Information only — pension contributions are irreversible. Confirm with a qualified pension specialist.',
        common_mistakes: [
          'Forgetting MPAA triggers prevent carry-forward',
          'Over-contributing past actual earnings (refund + interest charges)',
          'Not reclaiming higher-rate relief via Self Assessment',
        ],
      }));
    }

    // REC-2: Defer State Pension (relevant for higher earners still working at SPA)
    if (age >= REF.STATE_PENSION_AGE - 5 && age <= REF.STATE_PENSION_AGE + 3 && income > REF.HR_THRESHOLD) {
      const yearsDefer = 2;
      const baseAmount = REF.STATE_PENSION_FULL;
      const upliftedAmount = baseAmount * (1 + REF.DEFERMENT_UPLIFT_PCT * yearsDefer);
      const annualUplift = upliftedAmount - baseAmount;
      const breakevenYears = (baseAmount * yearsDefer) / annualUplift;
      recs.push(recommendation({
        id: 'PS-REC-02',
        strategy_id: 'STRAT-DEFER-SP',
        headline: `Defer State Pension ${yearsDefer} years — uplift ${fmt(annualUplift)}/yr for life`,
        drill_down: `Deferring State Pension increases the eventual amount by ${(REF.DEFERMENT_UPLIFT_PCT * 100).toFixed(1)}% per year (1% per 9 weeks). Deferring ${yearsDefer} years takes the full nSP from ${fmt(baseAmount)} to ${fmt(upliftedAmount)} — an extra ${fmt(annualUplift)}/yr for life. While you defer, you also avoid State Pension stacking on top of your salary at higher-rate tax. Breakeven point: approximately ${breakevenYears.toFixed(1)} years after eventual claim.`,
        action_steps: [
          'Notify DWP that you wish to defer (or simply do not claim at SPA)',
          'No paperwork beyond non-claim is required',
          'Re-evaluate every year — you can claim at any time',
        ],
        impact: { gbp_per_year: Math.round(annualUplift), time_horizon: 'permanent uplift from eventual claim', certainty: 0.88 },
        risk: { reversibility: 'you can claim at any time during deferment', downside: 'if you die before breakeven, deferment loses value', complexity: 'low' },
        citation: 'SPA 2014 s.16 + Pensions Act 2014 Sch 1 (deferral uplift 1%/9 weeks)',
        assumptions: { life_expectancy: 'breakeven needs ~17yrs after claim — works best if you expect to live to mid-80s', still_earning: 'works if you have other income through deferment period' },
        flip_conditions: 'If you stop working earlier than expected, claim early. If health changes, claim immediately.',
        fca_boundary: 'Information only. Consider against your wider income plan.',
        common_mistakes: [
          'Deferring without considering family longevity',
          'Forgetting that deferred State Pension is taxable when claimed',
        ],
      }));
    }

    // REC-3: Voluntary Class 3 NICs to fill State Pension gaps
    if (niYears != null && niYears >= REF.STATE_PENSION_MIN_YEARS && niYears < REF.STATE_PENSION_QUALIFY_YEARS && age < REF.STATE_PENSION_AGE) {
      const yearsToFill = Math.min(REF.STATE_PENSION_QUALIFY_YEARS - niYears, REF.STATE_PENSION_AGE - age);
      const costPerYear = 824.20;             // 2025-26 Class 3 (52 weeks × £15.85)
      const totalCost = Math.round(yearsToFill * costPerYear);
      const annualSpUplift = (REF.STATE_PENSION_FULL / REF.STATE_PENSION_QUALIFY_YEARS) * yearsToFill;
      const breakeven = totalCost / annualSpUplift;
      recs.push(recommendation({
        id: 'PS-REC-03',
        strategy_id: 'STRAT-CLASS3-FILL',
        headline: `Fill ${yearsToFill} NI years via Class 3 voluntary contributions`,
        drill_down: `Each missing NI year reduces your nSP by ${fmt(REF.STATE_PENSION_FULL / REF.STATE_PENSION_QUALIFY_YEARS)}. Class 3 voluntary contributions cost £15.85/week (£824.20 for 52 weeks). Filling ${yearsToFill} years costs ~${fmt(totalCost)} and uplifts your eventual State Pension by ${fmt(annualSpUplift)}/yr for life. Breakeven: ~${breakeven.toFixed(1)} years after claim.`,
        action_steps: [
          'Get your State Pension forecast at gov.uk/check-state-pension',
          'Check which past years are still available (typically up to 6 years back)',
          'Pay HMRC voluntary contributions reference for specific years',
          'Verify uplift via fresh State Pension forecast after payment',
        ],
        impact: { gbp_per_year: Math.round(annualSpUplift), time_horizon: 'permanent uplift from State Pension age', certainty: 0.94 },
        risk: { reversibility: 'voluntary contributions are non-refundable', downside: 'lose value if you die very young', complexity: 'low' },
        citation: 'SSCBA 1992 s.13 + HMRC NIM41200 (voluntary Class 3 contributions)',
        assumptions: { full_years_available: 'check which years are open with HMRC — typically last 6', state_pension_unchanged: 'Class 3 quotes are at current rules' },
        flip_conditions: 'If you have plenty of NI years already and are short on cash, skip. If life expectancy is significantly reduced, skip.',
        fca_boundary: 'Information only — verify forecast and which years to fill via HMRC.',
        common_mistakes: [
          'Filling years that are already credited (e.g. via NI from employment)',
          'Forgetting the 6-year window for back-filling',
          'Not double-checking via fresh State Pension forecast',
        ],
      }));
    }

    // REC-4: Pre-2027 SIPP drawdown to escape April 2027 IHT inclusion
    if (sipp > 250000 && age >= 55) {
      const tfcAvailable = Math.min(sipp * 0.25, REF.LSA);
      const ihtSaved = Math.round(tfcAvailable * 0.40);
      recs.push(recommendation({
        id: 'PS-REC-04',
        strategy_id: 'STRAT-PRE-2027-TFC',
        headline: `Crystallise ${fmt(tfcAvailable)} tax-free cash before April 2027`,
        drill_down: `From 6 April 2027 unused SIPP enters the IHT estate. Taking the 25% tax-free cash (${fmt(tfcAvailable)}) BEFORE that date removes it from IHT exposure permanently. If you then re-route the TFC into your ISA wrapper or gift it under the normal-expenditure-out-of-income exemption, it is also protected from future IHT. Estimated IHT saving on the TFC alone: ${fmt(ihtSaved)}. This is the single most-time-sensitive pension lever you have.`,
        action_steps: [
          'Open a flexi-access drawdown wrapper with your SIPP provider',
          'Crystallise the full 25% TFC (or in tranches if cashflow allows)',
          'Re-invest into ISAs (£20k/yr per adult), gift via normal-expenditure exemption, or spend',
          'Note: this does NOT trigger MPAA — only taking taxable income does',
        ],
        impact: { gbp_lifetime: ihtSaved, time_horizon: 'permanent IHT reduction', certainty: 0.90 },
        risk: { reversibility: 'TFC crystallisation is irreversible', downside: 'removing the asset from tax-free pension growth environment; future returns now in ISA/cash', complexity: 'medium' },
        citation: 'FA 2026 s.99 (pension IHT inclusion) + FA 2004 s.166 (PCLS)',
        assumptions: { lsa_available: 'LSA headroom sufficient for full TFC', estate_above_thresholds: 'IHT only applies if estate above NRB+RNRB', no_imminent_death: 'works only if you live past April 2027 + 7 years for PETs' },
        flip_conditions: 'If estate already well below £1M NRB+RNRB threshold, IHT is not a concern. If life expectancy < April 2027, irrelevant.',
        fca_boundary: 'Information only — irreversible crystallisation. Specialist advice essential.',
        common_mistakes: [
          'Triggering MPAA by taking taxable income alongside TFC',
          'Re-investing TFC back into the same SIPP — defeats the purpose',
          'Forgetting to write nominations on the residual SIPP',
        ],
      }));
    }

    return recs;
  },

  // ─── RED FLAGS ─────────────────────────────────────────────────────────────
  red_flags(persona, asOfDate = new Date()) {
    const flags = [];
    const niYears = persona.ni_record?.qualifying_years ?? null;
    const age = ageAt(persona, asOfDate) ?? 0;

    if (niYears != null && niYears < REF.STATE_PENSION_MIN_YEARS && age >= 50) {
      flags.push(redFlag({
        id: 'PS-RF-01',
        urgency: URGENCY.URGENT,
        action: 'Get State Pension forecast and decide on voluntary contributions',
        deadline: 'Within 12 months — back-filling window closes after 6 years',
        cost_of_inaction: 'Permanent loss of State Pension entitlement worth £11,502/yr from age 67',
        citation: 'SPA 2014 s.4 + NIM41200',
      }));
    }
    return flags;
  },

  // ─── WHAT-IF PROMPTS ───────────────────────────────────────────────────────
  what_if_prompts(persona) {
    const prompts = [];
    const sipp = persona.assets?.sipp?.total ?? 0;
    const age = ageAt(persona) ?? 0;
    if (sipp > 250000) prompts.push('What if I took my 25% tax-free cash now instead of waiting?');
    if (age >= 55) prompts.push('What if I deferred State Pension by 2 years?');
    if (sipp > 100000) prompts.push('What happens to my pension under the April 2027 IHT change?');
    prompts.push('Should I consolidate my pension pots?');
    return prompts;
  },
};
