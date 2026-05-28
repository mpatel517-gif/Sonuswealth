// ─────────────────────────────────────────────────────────────────────────────
// LENS: TAX ACCOUNTANT
//
// Perspective: a UK Chartered Tax Adviser (CTA) reviewing your annual position.
// Concerns: Income Tax, NIC, CGT, dividend tax, ISA/SIPP wrappers, year-end
// planning, allowances optimisation, cross-year smoothing.
//
// Citations refer to:
//   ITA   = Income Tax Act 2007
//   FA    = Finance Act <year>
//   TCGA  = Taxation of Chargeable Gains Act 1992
//   PTM   = HMRC Pensions Tax Manual (https://www.gov.uk/hmrc-internal-manuals/pensions-tax-manual)
//   ISAR  = Individual Savings Account Regulations 1998 (SI 1998/1870)
// ─────────────────────────────────────────────────────────────────────────────

import {
  SEVERITY, URGENCY, fmt, pct, daysToTaxYearEnd, daysToSippIht,
  ageAt, grossAssets, grossIncome,
  observation, recommendation, redFlag,
} from './_base.js';

// UK 2025/26 reference values (canonical, sourced from src/rules/UK-2026.1.1.json)
const REF = {
  PA: 12570,
  PA_TAPER_START: 100000,
  PA_TAPER_END: 125140,
  BR_BAND: 37700,                    // basic rate band on top of PA
  HR_THRESHOLD: 50270,
  AR_THRESHOLD: 125140,
  ISA: 20000,
  PENSION_AA: 60000,
  MPAA: 10000,
  CGT_AEA: 3000,
  DIVIDEND_ALLOWANCE: 500,
  TFC_LSA: 268275,                   // Lump Sum Allowance (replaces LTA from Apr 2024)
  HICBC_LOWER: 60000,
  HICBC_UPPER: 80000,
};

export const lens = {
  id: 'tax-accountant',
  name: 'Tax Accountant',
  short_name: 'Tax',
  display_avatar: '🧾',
  expertise_domain: ['income_tax', 'nic', 'cgt', 'dividend_tax', 'wrappers', 'year_end_planning'],
  description: 'A UK Chartered Tax Adviser reviewing your annual position for tax efficiency and year-end opportunities.',

  // ─── RELEVANCE ─────────────────────────────────────────────────────────────
  is_relevant(persona) {
    // Tax Accountant is relevant if persona has ANY income or any taxable wealth
    const income = grossIncome(persona);
    const assets = grossAssets(persona);
    if (income === 0 && assets < 50000) {
      return { score: 0.1, reason: 'Minimal income or wealth — limited tax planning value' };
    }
    if (income > REF.HR_THRESHOLD || assets > 500000) {
      return { score: 1.0, reason: 'Higher-rate income or substantial wealth — significant tax planning opportunities' };
    }
    return { score: 0.6, reason: 'Standard tax planning relevance' };
  },

  // ─── OBSERVE ───────────────────────────────────────────────────────────────
  observe(persona, asOfDate = new Date()) {
    const obs = [];
    const income = grossIncome(persona);
    const age = ageAt(persona, asOfDate);
    const sipp = persona.assets?.sipp?.total ?? 0;
    const isa  = persona.assets?.isa?.value ?? 0;
    const gia  = persona.assets?.portfolio?.value ?? 0;
    const isaUsedThisYear = persona.contributions_this_year?.isa ?? 0;

    // OBS-1: Personal Allowance taper
    if (income >= REF.PA_TAPER_START) {
      const taper = (income - REF.PA_TAPER_START) / 2;
      const effPA = Math.max(0, REF.PA - taper);
      const lostPA = REF.PA - effPA;
      const taxCost = Math.round(lostPA * 0.40);
      obs.push(observation({
        id: 'TA-OBS-01',
        severity: income >= REF.AR_THRESHOLD ? SEVERITY.HIGH : SEVERITY.MEDIUM,
        category: 'income_tax',
        text: `Income of ${fmt(income)} puts you in the £100k–£125,140 Personal Allowance taper band. ${income >= REF.AR_THRESHOLD ? 'PA fully lost' : `PA reduced to ${fmt(effPA)}`}, costing ${fmt(taxCost)} in additional tax. Effective marginal rate in this band is 60%.`,
        citation: 'ITA 2007 s.35',
        finding: { income, effPA, lostPA, taxCost },
      }));
    }

    // OBS-2: ISA allowance usage
    if (isa > 0 || persona.lifeStage >= 2) {
      const unused = Math.max(0, REF.ISA - isaUsedThisYear);
      if (unused > 0 && daysToTaxYearEnd(asOfDate) < 90) {
        obs.push(observation({
          id: 'TA-OBS-02',
          severity: SEVERITY.MEDIUM,
          category: 'wrappers',
          text: `${fmt(unused)} of your ${fmt(REF.ISA)} ISA allowance is unused with ${daysToTaxYearEnd(asOfDate)} days until April 5 deadline. ISA allowances cannot carry forward.`,
          citation: 'ISAR 1998 Reg 4 (annual subscription limit)',
          finding: { unused, days_left: daysToTaxYearEnd(asOfDate) },
        }));
      }
    }

    // OBS-3: SIPP value vs LSA (Lump Sum Allowance)
    if (sipp > 0) {
      const sipp25pct = sipp * 0.25;
      const lsaUsed = persona.pension_history?.lsa_used ?? 0;
      const lsaRemaining = REF.TFC_LSA - lsaUsed;
      if (sipp25pct > lsaRemaining) {
        obs.push(observation({
          id: 'TA-OBS-03',
          severity: SEVERITY.HIGH,
          category: 'pensions',
          text: `Your SIPP of ${fmt(sipp)} contains ${fmt(sipp25pct)} of potential tax-free cash, but your remaining Lump Sum Allowance is only ${fmt(lsaRemaining)}. Any TFC above this is taxed at marginal rate.`,
          citation: 'FA 2004 s.166 + PTM063210 (Pension Commencement Lump Sum)',
          finding: { sipp, sipp25pct, lsaRemaining },
        }));
      } else {
        obs.push(observation({
          id: 'TA-OBS-03a',
          severity: SEVERITY.LOW,
          category: 'pensions',
          text: `SIPP ${fmt(sipp)}: 25% tax-free cash entitlement is ${fmt(sipp25pct)}, well within your ${fmt(lsaRemaining)} Lump Sum Allowance.`,
          citation: 'FA 2004 s.166 + PTM063210',
          finding: { sipp, sipp25pct, lsaRemaining },
        }));
      }
    }

    // OBS-4: Pension Annual Allowance headroom
    const pensionContribThisYear = persona.contributions_this_year?.pension ?? 0;
    const aaAvailable = REF.PENSION_AA - pensionContribThisYear;
    const carryForward = persona.pension?.carry_forward_available ?? 0;
    const totalAaHeadroom = aaAvailable + carryForward;
    if (income > REF.HR_THRESHOLD && totalAaHeadroom > 10000) {
      obs.push(observation({
        id: 'TA-OBS-04',
        severity: SEVERITY.MEDIUM,
        category: 'pensions',
        text: `You have ${fmt(totalAaHeadroom)} of pension contribution headroom this year (${fmt(aaAvailable)} current AA + ${fmt(carryForward)} carry-forward). At your marginal rate of ${income >= REF.AR_THRESHOLD ? '45%' : '40%'}, full use would generate up to ${fmt(totalAaHeadroom * (income >= REF.AR_THRESHOLD ? 0.45 : 0.40))} in tax relief.`,
        citation: 'FA 2004 s.227 + PTM055100 (carry-forward)',
        finding: { aaAvailable, carryForward, totalAaHeadroom },
      }));
    }

    // OBS-5: CGT unrealised gains in GIA
    const giaGain = persona.assets?.portfolio?.unrealised_gain ?? 0;
    if (giaGain > REF.CGT_AEA) {
      obs.push(observation({
        id: 'TA-OBS-05',
        severity: SEVERITY.MEDIUM,
        category: 'cgt',
        text: `Your GIA holds ${fmt(giaGain)} of unrealised capital gains. Unused £3,000 CGT Annual Exempt Amount expires April 5 (${daysToTaxYearEnd(asOfDate)} days). Cannot carry forward.`,
        citation: 'TCGA 1992 s.3 + Sch 1 (annual exempt amount)',
        finding: { giaGain, aea: REF.CGT_AEA },
      }));
    }

    // OBS-6: SIPP IHT inclusion countdown (April 2027)
    if (sipp > 100000) {
      const days = daysToSippIht(asOfDate);
      if (days > 0) {
        const ihtIfDeathAfter = sipp * 0.40;
        obs.push(observation({
          id: 'TA-OBS-06',
          severity: days < 365 ? SEVERITY.HIGH : SEVERITY.MEDIUM,
          category: 'iht_pension',
          text: `SIPP of ${fmt(sipp)} enters Inheritance Tax estate from 6 April 2027 (${days} days). At current value, this exposes ${fmt(ihtIfDeathAfter)} to 40% IHT on death post-2027 if estate exceeds nil-rate bands.`,
          citation: 'Finance Act 2026 s.[pension-iht-inclusion] (Royal Assent 18 March 2026, effective 6 April 2027)',
          finding: { sipp, days, ihtIfDeathAfter },
        }));
      }
    }

    return obs;
  },

  // ─── RECOMMEND ─────────────────────────────────────────────────────────────
  recommend(persona, asOfDate = new Date()) {
    const recs = [];
    const income = grossIncome(persona);
    const age = ageAt(persona, asOfDate);
    const sipp = persona.assets?.sipp?.total ?? 0;
    const isa  = persona.assets?.isa?.value ?? 0;

    // REC-1: £100k taper escape via pension sacrifice (most valuable for high earners)
    if (income > REF.PA_TAPER_START && income < REF.PA_TAPER_END + 50000) {
      const sacrificeAmount = Math.min(income - REF.PA_TAPER_START, REF.PENSION_AA);
      const taxSaved = Math.round(sacrificeAmount * 0.60);   // 40% IT + PA recovery
      recs.push(recommendation({
        id: 'TA-REC-01',
        strategy_id: 'STRAT-100K-TAPER-ESCAPE',
        headline: `Sacrifice ${fmt(sacrificeAmount)} into pension to escape the £100k taper trap`,
        drill_down: `Your income of ${fmt(income)} is in the £100k–£125,140 Personal Allowance taper band where your effective marginal rate is 60% (40% income tax + 20% from the lost £1-per-£2 PA reduction). Salary-sacrificing ${fmt(sacrificeAmount)} into your pension would bring your taxable income to ${fmt(REF.PA_TAPER_START)}, restoring your full Personal Allowance and saving approximately ${fmt(taxSaved)} in tax this year. The sacrificed amount also accrues in your pension for retirement.`,
        action_steps: [
          'Confirm employer offers salary sacrifice (most do)',
          `Request ${fmt(sacrificeAmount)} sacrifice — typically arranged for next payroll`,
          'Confirm employer NIC saving (13.8% / 15%) is rebated to you (some employers split this)',
        ],
        impact: { gbp_per_year: taxSaved, time_horizon: 'this tax year + every future year you exceed £100k', certainty: 0.95 },
        risk: { reversibility: 'irreversible once contributed — locked until age 55+', downside: 'reduces take-home cashflow', complexity: 'low' },
        citation: 'ITA 2007 s.35 (PA taper) + FA 2004 s.188 (pension contributions)',
        assumptions: { still_employed: 'requires employment income', under_aa_cap: 'within £60k Annual Allowance' },
        flip_conditions: 'If you need the cash now for liquidity, ISA may be preferred even with lower tax efficiency',
        fca_boundary: 'Information only — salary sacrifice has irreversible consequences. Speak to a qualified financial adviser before acting.',
        common_mistakes: [
          'Over-sacrificing past £60k AA → 45% Annual Allowance charge',
          'Forgetting MPAA if you have already flexi-accessed any pension',
        ],
      }));
    }

    // REC-2: Phased TFC crystallisation (Bruce's flagship scenario)
    if (sipp > 500000 && age >= 55 && (persona.pension_history?.crystallisation_events ?? []).length === 0) {
      const tfcTotal = Math.min(sipp * 0.25, REF.TFC_LSA);
      const phasingYears = 10;
      const annualChunk = tfcTotal / phasingYears;
      const annualTaxable = annualChunk * 3;   // 75% taxable per crystallisation
      const annualSavingVsLumpSum = Math.round((annualTaxable - REF.HR_THRESHOLD) * 0.20);
      recs.push(recommendation({
        id: 'TA-REC-02',
        strategy_id: 'STRAT-PHASED-TFC',
        headline: `Phase your ${fmt(tfcTotal)} tax-free cash over ${phasingYears} years instead of lump sum`,
        drill_down: `Taking your full ${fmt(tfcTotal)} 25% tax-free cash in one year forces the remaining 75% (${fmt(sipp * 0.75)}) into drawdown and likely additional-rate tax bands. Instead, crystallise ${fmt(annualChunk)} per year for ${phasingYears} years. Each year you take ${fmt(annualChunk * 0.25)} tax-free + ${fmt(annualChunk * 0.75)} taxable. The taxable portion stays within basic-rate band where possible. Estimated tax saving vs lump-sum approach: ~${fmt(annualSavingVsLumpSum * phasingYears)} over the period, with the additional benefit that uncrystallised SIPP balance continues to grow tax-free.`,
        action_steps: [
          'Open a flexible drawdown arrangement with your SIPP provider',
          `Set up annual crystallisation of ${fmt(annualChunk)}`,
          'Coordinate with state pension start (age 66/67) to avoid stacking',
          'Review yearly — adjust if rules change or circumstances shift',
        ],
        impact: { gbp_per_year: annualSavingVsLumpSum, lifetime_gbp: annualSavingVsLumpSum * phasingYears, certainty: 0.85 },
        risk: { reversibility: 'each crystallisation irreversible', downside: 'death post-75 means beneficiaries pay marginal tax on remaining funds', complexity: 'medium' },
        citation: 'FA 2004 s.166 + PTM063210 (PCLS) + PTM088100 (flexi-access drawdown)',
        assumptions: { life_expectancy: 'assumes ≥10 years to take advantage of phasing', tax_rules_stable: 'phased over 10 years — Budgets may change rules', returns: 'assumes pension grows at sustainable rate' },
        flip_conditions: 'If life expectancy <5 years, lump-sum + spend may dominate. If estate already at IHT cap, accelerating drawdown may be preferred to push assets out via gifting.',
        fca_boundary: 'Information only. Pension crystallisation is irreversible — speak to a qualified pension specialist before acting.',
        common_mistakes: [
          'Phasing across more years than life expectancy supports',
          'Not factoring in state pension when it starts',
          'Crystallising past £268,275 Lump Sum Allowance and triggering additional charges',
        ],
      }));
    }

    // REC-3: ISA top-up + GIA reshuffle
    const giaValue = persona.assets?.portfolio?.value ?? 0;
    if (giaValue > 20000 && (persona.contributions_this_year?.isa ?? 0) < REF.ISA) {
      const isaToFill = REF.ISA - (persona.contributions_this_year?.isa ?? 0);
      recs.push(recommendation({
        id: 'TA-REC-03',
        strategy_id: 'STRAT-BED-AND-ISA',
        headline: `Bed-and-ISA: move ${fmt(isaToFill)} from GIA to ISA before April 5`,
        drill_down: `You hold ${fmt(giaValue)} in your General Investment Account (GIA), exposed to income tax on dividends and CGT on gains. Your ISA has ${fmt(isaToFill)} unused allowance this year. Sell ${fmt(isaToFill)} from your GIA — using your £3,000 CGT Annual Exempt Amount to minimise CGT — and immediately re-buy the same holdings inside your ISA. Future dividends and gains on this portion are then tax-free permanently. ISA allowances cannot be carried forward, so missing this deadline loses the wrapping opportunity for these specific funds.`,
        action_steps: [
          'Calculate which GIA holdings have lowest unrealised gains (minimise CGT)',
          `Sell ${fmt(isaToFill)} worth of these GIA holdings`,
          'Immediately re-buy the same holdings inside your ISA (most platforms automate this as "Bed and ISA")',
          'Complete before April 5',
        ],
        impact: { gbp_per_year: Math.round(isaToFill * 0.018), gbp_lifetime: Math.round(isaToFill * 0.018 * 25), certainty: 0.90 },
        risk: { reversibility: 'irreversible once sold — but can sell from ISA later if needed', downside: 'one-day market exposure between sale and repurchase', complexity: 'low' },
        citation: 'ISAR 1998 Reg 4 (annual limit) + TCGA 1992 s.3 (CGT AEA)',
        assumptions: { aea_unused: 'assumes £3,000 CGT AEA not already used this year', isa_unused: `assumes ${fmt(isaToFill)} of ISA allowance available` },
        flip_conditions: 'If GIA gains exceed £3,000 AEA, partial bed-and-ISA may be better than full sale.',
        fca_boundary: 'Information only. Bed-and-ISA timing matters — consult your platform and adviser.',
        common_mistakes: [
          'Selling holdings with large gains and breaching CGT AEA',
          'Forgetting to instruct re-purchase — leaving money in cash',
          'Bed-and-ISA-ing a Lifetime ISA position (different rules)',
        ],
      }));
    }

    // REC-4: SIPP IHT pre-2027 planning
    if (sipp > 500000 && daysToSippIht(asOfDate) < 730) {
      const ihtAvoided = Math.round(sipp * 0.40);
      recs.push(recommendation({
        id: 'TA-REC-04',
        strategy_id: 'STRAT-SIPP-PRE-2027',
        headline: `Pre-April-2027 SIPP strategy: ${daysToSippIht(asOfDate)} days to plan`,
        drill_down: `From 6 April 2027, defined contribution pensions (including SIPPs) enter the estate for Inheritance Tax. Your ${fmt(sipp)} SIPP currently sits outside the estate. From April 2027, this exposes up to ${fmt(ihtAvoided)} to 40% IHT on death (subject to nil-rate bands). Strategies to consider: (a) accelerate phased crystallisation pre-2027 to spend SIPP first; (b) gift surplus drawdown income to remove from estate (s.21 IHTA exemption for regular gifts out of normal expenditure); (c) review nominations to favour adult children with own pension allowance. The April 2027 effective date is fixed — Royal Assent received 18 March 2026.`,
        action_steps: [
          'Decide: spend SIPP first (favours pre-2027) vs preserve SIPP for beneficiaries (favours pre-75 death)',
          'Review beneficiary nominations for tax efficiency',
          'Project IHT exposure under both scenarios with adviser',
          'Re-check April 2027 — possible scheme to delay further (legislation still evolving)',
        ],
        impact: { gbp_lifetime: ihtAvoided, time_horizon: 'until April 6 2027', certainty: 0.75 },
        risk: { reversibility: 'crystallisation irreversible; gifting subject to 7-year clock', downside: 'spending SIPP early loses tax-free growth', complexity: 'high' },
        citation: 'Finance Act 2026 (Royal Assent 18 March 2026) — pension IHT inclusion from 6 April 2027',
        assumptions: { law_stable: 'assumes April 2027 implementation date holds (Government has confirmed)' },
        flip_conditions: 'If life expectancy >20 years, the time value of SIPP growth may exceed IHT cost.',
        fca_boundary: 'Information only. SIPP and IHT planning is high-stakes — speak to a Chartered Tax Adviser AND pension specialist together.',
        common_mistakes: [
          'Treating April 2027 as the gift deadline (it is the IHT inclusion date — gifts still need 7-year clock)',
          'Triggering MPAA early in haste',
        ],
      }));
    }

    // REC-5: CGT loss harvesting (if losses present)
    const giaLosses = persona.assets?.portfolio?.unrealised_loss ?? 0;
    if (giaLosses > 1000) {
      recs.push(recommendation({
        id: 'TA-REC-05',
        strategy_id: 'STRAT-CGT-LOSS-HARVEST',
        headline: `Realise ${fmt(giaLosses)} of capital losses to offset future gains`,
        drill_down: `You have ${fmt(giaLosses)} of unrealised losses in your GIA. Crystallising these before April 5 establishes them as offsettable losses — they can offset realised gains in the same year (after using your £3,000 AEA) and carry forward indefinitely. To avoid the 30-day "bed-and-breakfast" rule, the replacement holding must track the same exposure but be a different fund (e.g. switching from one FTSE 100 tracker family to another). A regulated adviser can confirm whether your specific holdings qualify.`,
        action_steps: [
          'Identify GIA holdings with unrealised losses',
          'Sell at a loss',
          'Replace with a similar but not identical fund (different provider, same index)',
          'Report on Self Assessment',
        ],
        impact: { gbp_lifetime: Math.round(giaLosses * 0.20), certainty: 0.85 },
        risk: { reversibility: 'partial — re-buying same security within 30 days disallows the loss', complexity: 'medium' },
        citation: 'TCGA 1992 s.16 (allowable losses) + s.106A (bed-and-breakfast 30-day rule)',
        assumptions: {},
        flip_conditions: 'If you expect holdings to recover strongly within 30 days, holding may dominate.',
        fca_boundary: 'Information only. Loss harvesting is subject to anti-avoidance rules — speak to a Tax Adviser.',
        common_mistakes: [
          'Re-buying within 30 days (disallows loss)',
          'Bed-and-breakfasting via spouse — also caught by anti-avoidance',
          'Not declaring the loss — required on Self Assessment',
        ],
      }));
    }

    // REC-6: Marriage Allowance (couples only)
    if (persona.isCouple && !persona.marriage_allowance_claimed) {
      const sp1 = grossIncome(persona);
      const sp2 = grossIncome(persona.spouse || {});
      const eligible = (Math.min(sp1, sp2) < REF.PA) && (Math.max(sp1, sp2) <= REF.HR_THRESHOLD);
      if (eligible) {
        recs.push(recommendation({
          id: 'TA-REC-06',
          strategy_id: 'STRAT-MARRIAGE-ALLOWANCE',
          headline: 'Claim Marriage Allowance — £252/yr + up to £1,008 backdated',
          drill_down: `One spouse earns below the Personal Allowance and the other is a basic-rate taxpayer. You qualify for Marriage Allowance, which transfers £1,260 of unused PA to the higher earner — saving £252/year. You can also backdate the claim 4 years, generating up to £1,008 of refunds. Application takes ~5 minutes via HMRC's personal tax account.`,
          action_steps: [
            'Lower-earning spouse logs into gov.uk personal tax account',
            'Apply for Marriage Allowance (named recipient: higher earner)',
            'Backdate the claim 4 years',
            'Refund typically processed within 6 weeks',
          ],
          impact: { gbp_per_year: 252, gbp_one_off: 1008, certainty: 1.0 },
          risk: { reversibility: 'fully reversible by cancelling', complexity: 'trivial' },
          citation: 'ITA 2007 s.55A–55C (Marriage Allowance / Transferable Personal Allowance)',
          assumptions: { both_married_or_cp: 'requires legal marriage or civil partnership' },
          flip_conditions: 'If higher-earning spouse moves into higher-rate band, Marriage Allowance disqualifies.',
          fca_boundary: 'Information only — Marriage Allowance is a statutory right, no advice needed to claim.',
          common_mistakes: [
            'Forgetting to backdate the claim',
            'Wrong direction of transfer (must be FROM lower-earner TO higher-earner)',
          ],
        }));
      }
    }

    return recs;
  },

  // ─── RED FLAGS ─────────────────────────────────────────────────────────────
  red_flags(persona, asOfDate = new Date()) {
    const flags = [];
    const income = grossIncome(persona);
    const sipp = persona.assets?.sipp?.total ?? 0;

    // FLAG-1: 60-day tax year-end approaching
    const daysLeft = daysToTaxYearEnd(asOfDate);
    if (daysLeft <= 60 && daysLeft > 0) {
      flags.push(redFlag({
        id: 'TA-FLAG-01',
        urgency: daysLeft <= 14 ? URGENCY.IMMEDIATE : URGENCY.URGENT,
        action: `${daysLeft} days to tax year-end — review ISA / CGT / pension contributions`,
        deadline: 'April 5',
        cost_of_inaction: 0,        // ranges per scenario
        citation: 'ITA 2007 Pt 2 (tax year definition)',
      }));
    }

    // FLAG-2: Income within £500 of a tax cliff
    for (const [name, threshold] of [
      ['Personal Allowance taper start', REF.PA_TAPER_START],
      ['Higher rate threshold', REF.HR_THRESHOLD],
      ['Personal Allowance fully lost', REF.PA_TAPER_END],
      ['Additional rate threshold', REF.AR_THRESHOLD],
      ['HICBC lower threshold', REF.HICBC_LOWER],
    ]) {
      if (income > threshold - 500 && income <= threshold) {
        flags.push(redFlag({
          id: `TA-FLAG-02-${threshold}`,
          urgency: URGENCY.SOON,
          action: `You are within £500 of the ${name} (${fmt(threshold)}). Small income changes trigger large tax effects.`,
          deadline: 'before tax year-end',
          cost_of_inaction: 0,
        }));
      }
    }

    return flags;
  },

  // ─── WHAT-IF PROMPTS ───────────────────────────────────────────────────────
  what_if_prompts(persona) {
    const prompts = [];
    if (grossIncome(persona) > REF.HR_THRESHOLD) {
      prompts.push('What if I sacrifice £20,000 of my bonus into pension this year?');
    }
    if ((persona.assets?.sipp?.total ?? 0) > 200000) {
      prompts.push('What if I start phased pension crystallisation next year?');
      prompts.push('What if I delay state pension by 3 years?');
    }
    if ((persona.assets?.portfolio?.value ?? 0) > 10000) {
      prompts.push('What if I bed-and-ISA before April 5?');
    }
    if (persona.isCouple) {
      prompts.push('What if I claim Marriage Allowance backdated 4 years?');
    }
    prompts.push('What if I move to Scotland — what would my income tax change to?');
    return prompts;
  },
};
