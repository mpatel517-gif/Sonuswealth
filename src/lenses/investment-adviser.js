// ─────────────────────────────────────────────────────────────────────────────
// LENS: INVESTMENT ADVISER
//
// Perspective: a UK Discretionary Investment Manager / CFA charterholder
// reviewing portfolio construction, costs, concentration, and behavioural
// risk. Sits between IFA (holistic) and Tax Accountant (tax-side) — owns the
// what-do-I-actually-hold and what-does-it-cost question.
//
// Citations:
//   FCA   = Financial Conduct Authority
//   CFA   = CFA Institute
//   PRIIP = Packaged Retail and Insurance-based Investment Products Regulation
// ─────────────────────────────────────────────────────────────────────────────

import {
  SEVERITY, URGENCY, fmt, pct,
  ageAt, grossAssets,
  observation, recommendation, redFlag,
} from './_base.js';

const REF = {
  TER_LOW: 0.0030,                  // 0.30% — global tracker territory
  TER_BENCHMARK: 0.0070,            // 0.70% — typical active fund
  TER_HIGH: 0.0120,                 // 1.20% — costly
  PLATFORM_FEE_BENCHMARK: 0.0035,
  CONCENTRATION_WARN: 0.10,
  CONCENTRATION_HIGH: 0.20,
  REBAL_BAND: 0.05,
  CASH_DRAG_THRESHOLD: 0.05,        // >5% of portfolio in cash = drag
  ESG_PREFERENCE_DEFAULT: false,
};

function _holdingValue(h) { return +h.currentValue || +h.value || 0 }

export const lens = {
  id: 'investment-adviser',
  name: 'Investment Adviser',
  short_name: 'Investment',
  display_avatar: '📈',
  expertise_domain: ['portfolio', 'costs', 'concentration', 'rebalancing', 'esg', 'fund_selection'],
  description: 'A UK CFA-charterholder discretionary investment manager reviewing portfolio construction, costs, and concentration.',

  is_relevant(persona) {
    const portfolioValue = (persona.assets?.portfolio?.value ?? 0) +
                           (persona.assets?.isa?.value ?? 0) +
                           (persona.assets?.sipp?.total ?? 0)
    if (portfolioValue < 25000) return { score: 0.3, reason: 'Limited investable assets — basic guidance applies' }
    if (portfolioValue > 250000) return { score: 1.0, reason: 'Substantial investable wealth — full portfolio review valuable' }
    return { score: 0.7, reason: 'Material investable assets — portfolio review valuable' }
  },

  observe(persona, asOfDate = new Date()) {
    const obs = []
    const portfolio = persona.assets?.portfolio ?? {}
    const holdings = Array.isArray(portfolio.holdings) ? portfolio.holdings : []
    const portfolioValue = portfolio.value ?? holdings.reduce((s, h) => s + _holdingValue(h), 0)
    const isa = persona.assets?.isa?.value ?? 0
    const sipp = persona.assets?.sipp?.total ?? 0
    const cash = persona.assets?.cash?.value ?? 0
    const totalLiquid = portfolioValue + isa + sipp + cash

    // OBS-1: TER vs benchmark
    const ter = portfolio.weighted_ter ?? persona.assets?.portfolio?.weighted_ter ?? null
    if (ter != null && portfolioValue > 50000) {
      if (ter > REF.TER_HIGH) {
        const excess = ter - REF.TER_LOW
        const annualCost = Math.round(portfolioValue * excess)
        obs.push(observation({
          id: 'INV-OBS-01',
          severity: SEVERITY.HIGH,
          category: 'costs',
          text: `Portfolio weighted TER is ${pct(ter, 2)} — well above ${pct(REF.TER_LOW, 2)} benchmark for a diversified passive equivalent. On ${fmt(portfolioValue)}, the excess cost is ${fmt(annualCost)}/yr — compounded over 20 years, that's ${fmt(annualCost * 30)} of lost growth.`,
          citation: 'FCA Asset Management Market Study 2017 + PRIIP cost disclosure',
          finding: { ter, benchmark: REF.TER_LOW, annualCost, twentyYearCost: annualCost * 30 },
        }))
      } else if (ter > REF.TER_BENCHMARK) {
        obs.push(observation({
          id: 'INV-OBS-01b',
          severity: SEVERITY.MEDIUM,
          category: 'costs',
          text: `Portfolio TER ${pct(ter, 2)} is above ${pct(REF.TER_BENCHMARK, 2)} benchmark. Some active management may be justified — check that costs are matched by alpha vs. a passive equivalent over 5+ years.`,
          citation: 'FCA Asset Management Market Study + SPIVA scorecards',
          finding: { ter, benchmark: REF.TER_BENCHMARK },
        }))
      }
    }

    // OBS-2: Concentration in single positions
    holdings.forEach(h => {
      const v = _holdingValue(h)
      const concPct = totalLiquid > 0 ? v / totalLiquid : 0
      if (concPct > REF.CONCENTRATION_WARN) {
        obs.push(observation({
          id: 'INV-OBS-02-' + (h.ticker || h.name || 'pos').toString().toLowerCase().replace(/\s+/g, '-'),
          severity: concPct > REF.CONCENTRATION_HIGH ? SEVERITY.HIGH : SEVERITY.MEDIUM,
          category: 'concentration',
          text: `${h.ticker || h.name || 'Position'} represents ${pct(concPct)} of liquid wealth (${fmt(v)}). Above 10% in a single position, idiosyncratic risk dominates over market risk — a single scandal, earnings miss, or sector shift could materially damage net worth.`,
          citation: 'CFA Institute portfolio construction + Modern Portfolio Theory',
          finding: { position: h.ticker || h.name, value: v, concentrationPct: concPct },
        }))
      }
    })

    // OBS-3: Cash drag in portfolio (excess cash inside investment accounts)
    if (cash > 0 && totalLiquid > 100000) {
      const cashPct = cash / totalLiquid
      if (cashPct > REF.CASH_DRAG_THRESHOLD * 2) {
        const drag = cash * (0.05 - 0.005)  // assume cash 0.5%, market 5% real
        obs.push(observation({
          id: 'INV-OBS-03',
          severity: SEVERITY.MEDIUM,
          category: 'cash_drag',
          text: `Cash represents ${pct(cashPct)} of liquid wealth (${fmt(cash)}). Above strategic-buffer needs, this earns ~4.5% in money-market funds vs. 5-8% in a diversified portfolio. Opportunity cost: ~${fmt(drag)}/yr in real terms.`,
          citation: 'CFA Institute opportunity-cost principles',
          finding: { cash, cashPct, annualDrag: drag },
        }))
      }
    }

    // OBS-4: Wrapper sequencing — invested capital in GIA when ISA headroom exists
    const isaUsedThisYear = persona.contributions_this_year?.isa ?? 0
    const isaHeadroom = Math.max(0, 20000 - isaUsedThisYear)
    if (portfolioValue > 20000 && isaHeadroom > 5000) {
      const taxSavingPerYr = Math.round(isaHeadroom * 0.04 * 0.20) // assume 4% yield, 20% tax saved
      obs.push(observation({
        id: 'INV-OBS-04',
        severity: SEVERITY.MEDIUM,
        category: 'wrapper_sequencing',
        text: `${fmt(isaHeadroom)} of ISA allowance unused while ${fmt(portfolioValue)} sits in a taxable GIA. Bed-and-ISA moves the holdings into the tax-free wrapper. CGT allowance £3,000 covers most disposals without tax.`,
        citation: 'ISAR 1998 + TCGA 1992 s.3 (CGT AEA)',
        finding: { isaHeadroom, portfolioValue, annualTaxSaving: taxSavingPerYr },
      }))
    }

    // OBS-5: Home country bias (rough heuristic — UK-only equity flagged)
    const ukOnly = holdings.length > 0 && holdings.every(h =>
      (h.market || h.exchange || '').toString().toUpperCase().includes('LSE') ||
      (h.currency || 'GBP') === 'GBP'
    )
    if (ukOnly && portfolioValue > 100000) {
      obs.push(observation({
        id: 'INV-OBS-05',
        severity: SEVERITY.MEDIUM,
        category: 'diversification',
        text: `Portfolio appears UK-only. UK equity is ~4% of global market cap; an internationally-diversified portfolio captures growth where it occurs. A globally-diversified allocation typically holds UK equity below 30% — discuss appropriate weights with a regulated investment adviser.`,
        citation: 'CFA Institute international diversification + MSCI All-Country World Index weights',
        finding: { ukConcentration: 1.0, globalUkBenchmark: 0.04 },
      }))
    }

    return obs
  },

  recommend(persona, asOfDate = new Date()) {
    const recs = []
    const portfolio = persona.assets?.portfolio ?? {}
    const holdings = Array.isArray(portfolio.holdings) ? portfolio.holdings : []
    const portfolioValue = portfolio.value ?? holdings.reduce((s, h) => s + _holdingValue(h), 0)
    const isa = persona.assets?.isa?.value ?? 0
    const sipp = persona.assets?.sipp?.total ?? 0
    const cash = persona.assets?.cash?.value ?? 0
    const totalLiquid = portfolioValue + isa + sipp + cash
    const ter = portfolio.weighted_ter ?? null

    // REC-1: Switch to low-cost trackers
    if (ter != null && ter > REF.TER_BENCHMARK && portfolioValue > 50000) {
      const targetTer = REF.TER_LOW
      const annualSaving = Math.round(portfolioValue * (ter - targetTer))
      recs.push(recommendation({
        id: 'INV-REC-01',
        strategy_id: 'STRAT-LOWER-TER',
        headline: `Switch to low-cost global trackers — save ${fmt(annualSaving)}/yr in fees`,
        drill_down: `Your weighted TER is ${pct(ter, 2)}. A diversified low-cost equivalent (Vanguard FTSE Global All Cap, iShares ACWI, HSBC FTSE All-World) sits at ~${pct(targetTer, 2)}. On ${fmt(portfolioValue)}, the fee gap costs ${fmt(annualSaving)}/yr — compounded at 5% over 20 years that's roughly ${fmt(annualSaving * 35)} of lost growth. Active management is justified ONLY when it consistently delivers net-of-cost alpha — SPIVA shows 70-90% of active funds underperform their benchmark over 5+ years.`,
        action_steps: [
          'Identify holdings with TER >0.50%',
          'Sequence sales inside tax wrappers (SIPP/ISA — no CGT)',
          'For GIA, stagger sales over 2-3 years to use £3k CGT allowance each',
          'Replace with broad-market trackers maintaining equity/bond split',
        ],
        impact: { gbp_per_year: annualSaving, time_horizon: 'permanent', certainty: 0.92 },
        risk: { reversibility: 'fully reversible', downside: 'transaction costs and CGT in GIA; possible bid-ask spread', complexity: 'medium' },
        citation: 'FCA Asset Management Market Study 2017 + SPIVA scorecards (S&P)',
        assumptions: { not_specialist_strategy: 'assumes funds are mainstream equity/bond — not e.g. private equity', long_horizon: 'cost compounds over 10+ years for full benefit' },
        flip_conditions: 'If you have demonstrated alpha (consistent 3-5yr outperformance NET of fees), case-by-case retention.',
        fca_boundary: 'Information only.',
        common_mistakes: [
          'All-at-once sale in GIA — wastes annual CGT allowance',
          'Switching to a cheap-but-tracking-error-prone tracker',
        ],
      }))
    }

    // REC-2: Reduce concentration
    const concentrated = holdings.find(h => {
      const v = _holdingValue(h)
      return totalLiquid > 0 && v / totalLiquid > REF.CONCENTRATION_WARN
    })
    if (concentrated) {
      const v = _holdingValue(concentrated)
      const reduceTo = totalLiquid * REF.CONCENTRATION_WARN
      const reduceBy = v - reduceTo
      recs.push(recommendation({
        id: 'INV-REC-02',
        strategy_id: 'STRAT-REDUCE-CONCENTRATION',
        headline: `Trim ${concentrated.ticker || concentrated.name} by ${fmt(reduceBy)} over 2-3 years`,
        drill_down: `Current concentration ${pct(v / totalLiquid)} is too high — single-position idiosyncratic risk dominates. Trim to ~10% of liquid wealth, redeploying proceeds into a global tracker. If in SIPP/ISA, no CGT — execute fast. If in GIA, stagger across tax years to use £3k CGT allowance each.`,
        action_steps: [
          'Quantify cost basis to estimate CGT exposure on disposal',
          'Sequence the sale: SIPP/ISA first (no CGT), then tranche the GIA',
          'Reinvest in global tracker maintaining your equity allocation',
          'Set a sell-down trigger if the position grows beyond 12% again',
        ],
        impact: { gbp_one_off: Math.round(reduceBy * 0.04), time_horizon: 'permanent risk reduction', certainty: 0.85 },
        risk: { reversibility: 'CGT once realised cannot be reversed', downside: 'opportunity cost if the stock outperforms after trim', complexity: 'medium' },
        citation: 'CFA Institute diversification principles',
        assumptions: { tax_wrapper_known: 'depends on GIA vs ISA vs SIPP', cgt_allowance: '£3,000 per person per year' },
        flip_conditions: 'If the position has restrictions (employer vesting, family business), trim as soon as restrictions lift.',
        fca_boundary: 'Information only.',
        common_mistakes: [
          'Selling all at once in GIA — wastes annual CGT allowance',
          'Reinvesting proceeds into another concentrated position',
        ],
      }))
    }

    // REC-3: Move excess cash to money-market fund
    if (cash > 50000 && totalLiquid > 100000) {
      const moveAmount = cash - 30000   // leave 30k buffer
      const interestUplift = Math.round(moveAmount * (0.045 - 0.005))
      recs.push(recommendation({
        id: 'INV-REC-03',
        strategy_id: 'STRAT-CASH-TO-MMF',
        headline: `Move ${fmt(moveAmount)} from current account to money-market fund — earn ${fmt(interestUplift)}/yr more`,
        drill_down: `Institutional money-market funds currently yield ~4.5% on overnight money with negligible credit risk. Keeping ${fmt(cash)} in a current account at 0-0.5% costs ~${fmt(interestUplift)}/yr in foregone interest. MMFs settle T+1, so liquidity is preserved for emergency-fund purposes. A regulated adviser can identify funds appropriate to your risk profile.`,
        action_steps: [
          'Open MMF position via your platform (most major platforms offer institutional MMFs)',
          'Move excess cash above your strategic buffer',
          'Re-evaluate quarterly as rates change',
        ],
        impact: { gbp_per_year: interestUplift, time_horizon: 'permanent (assuming rates hold)', certainty: 0.90 },
        risk: { reversibility: 'fully reversible — T+1 settlement', downside: 'rate cuts reduce yield; some MMFs have weekly redemption gates in stress', complexity: 'low' },
        citation: 'FCA Money Market Funds Regulation + IMMFA standards',
        assumptions: { rates_hold: 'rate cuts reduce yield', mmf_quality: 'use AAA-rated institutional MMF only' },
        flip_conditions: 'If interest rates collapse to <1%, reconsider allocation.',
        fca_boundary: 'Information only.',
        common_mistakes: [
          'Confusing money-market fund with "cash account" — MMFs are technically investments',
          'Using a retail MMF with higher cost',
        ],
      }))
    }

    return recs
  },

  red_flags(persona) {
    return []
  },

  what_if_prompts(persona) {
    return [
      'What if I switched my entire portfolio to low-cost trackers?',
      'What if WayneTech had a 30% drawdown next quarter?',
      'How much am I paying in fees over 20 years?',
    ]
  },
}
