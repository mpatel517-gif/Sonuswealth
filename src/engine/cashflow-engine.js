// ─────────────────────────────────────────────────────────────────────────────
// CAELIXA CASHFLOW ENGINE  —  P3 · s02a
// Spec: 2-Product-cashflow-v1_0.md §8 + v1.1 patch
// Pure functions only. No side effects. No global state.
// CMA = Capital Market Assumptions bundle (UK-CMA-2026.1).
// Pass cma = null → all functions fall back to conservative hardcoded defaults.
// ─────────────────────────────────────────────────────────────────────────────

import {
  calcAge,
  incomeTax,
  lifeStageFor,
  TAX,
  ihtSippDelta as costOfInaction,
} from './fq-calculator.js';

// ── CMA DEFAULTS (used when no bundle passed) ─────────────────────────────────

const DEFAULT_AC = {
  uk_equity:     { expectedReturn: 0.072, volatility: 0.165 },
  global_equity: { expectedReturn: 0.076, volatility: 0.155 },
  uk_gilts:      { expectedReturn: 0.035, volatility: 0.080 },
  corp_bonds:    { expectedReturn: 0.045, volatility: 0.075 },
  cash:          { expectedReturn: 0.045, volatility: 0.008 },
};

const DEFAULT_GROWTH    = 0.058;
const DEFAULT_INFLATION = 0.027;
const DEFAULT_VOL       = 0.145;   // blended balanced-portfolio volatility

// ── HELPERS ───────────────────────────────────────────────────────────────────

function _age(entity) {
  if (entity?.individual?.dob) return calcAge(entity.individual.dob);
  return entity?.age ?? 0;
}

// Dual-path asset reader: handles both simple-path (a.sipp.total / a.isa.value)
// and complex-path (a.pensions[] / a.investments[]) entity formats.
function _assetVals(entity) {
  const a = entity?.assets ?? {};

  // Simple path (fundedRatio / calcRisk / persona format)
  let sipp = a.sipp?.total ?? 0;
  let isa  = a.isa?.value  ?? 0;
  let port = a.portfolio?.value ?? 0;
  let cash = a.cash?.total ?? 0;

  // Complex path (mrT fixture / production format) — used as fallback when simple = 0
  if (sipp === 0) {
    sipp = (a.pensions ?? [])
      .filter(p => !(p.type === 'occupational-DB' && p.cetv == null))
      .reduce((s, p) => s + (p.balance_gbp ?? p.balance ?? 0), 0);
  }
  if (isa === 0 && port === 0 && (a.investments ?? []).length > 0) {
    const invs = a.investments ?? [];
    const isaTot  = invs.filter(i => i.type === 'isa'  || (i.id ?? '').includes('isa'))
                        .reduce((s, i) => s + (i.estimated_value ?? i.balance_gbp ?? 0), 0);
    const portTot = invs.filter(i => i.type !== 'isa'  && !(i.id ?? '').includes('isa'))
                        .reduce((s, i) => s + (i.estimated_value ?? i.balance_gbp ?? 0), 0);
    isa  = isaTot  || 0;
    port = portTot || (isaTot === 0 ? invs.reduce((s, i) => s + (i.estimated_value ?? i.balance_gbp ?? 0), 0) : 0);
  }
  if (cash === 0) {
    cash = (a.bank ?? []).reduce((s, b) => s + (b.balance_gbp ?? b.balance ?? 0), 0);
  }

  return { sipp, isa, port, cash };
}

// Total investable (excludes property) — works across both entity path formats
function _investable(entity) {
  const { sipp, isa, port, cash } = _assetVals(entity);
  return sipp + isa + port + cash;
}

// SWR guardrail (avoids importing calcGuardrail which depends on calcInvestable/calcNetWorth)
function _guardrail(entity) {
  return Math.round(_investable(entity) * TAX.swr);
}

// Shim: same shape as fq-calculator calcInvestable but reads both entity path formats
function _inv(entity) {
  return { value: _investable(entity), confidence: 'MEDIUM', staleness_flags: [] };
}

function _cmaOk(cma) {
  if (!cma) return false;
  const exp = cma.expiryDate ?? cma._meta?.expiryDate;
  return !exp || new Date(exp) >= new Date();
}

function _confidence(cma, baseConfidence = 'MEDIUM') {
  if (!cma) return baseConfidence;
  return _cmaOk(cma) ? 'MED-HIGH' : 'LOW';
}

function _cmaBundle(cma) {
  return cma?._meta?.version ?? cma?.version ?? null;
}

// Box-Muller normal sample
function _rn() {
  let u, v;
  do { u = Math.random(); } while (u === 0);
  do { v = Math.random(); } while (v === 0);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function _pct(sorted, p) {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

// Return liabilities as a flat array regardless of entity shape
function _liabArr(entity) {
  const liab = entity?.liabilities;
  if (!liab) return [];
  if (Array.isArray(liab)) return liab;
  const out = [];
  if (liab.mortgage?.outstanding) {
    out.push({
      type: 'mortgage',
      outstanding_balance_gbp: liab.mortgage.outstanding,
      interest_rate: liab.mortgage.rate ?? liab.mortgage.interestRate ?? 0.048,
    });
  }
  for (const l of (liab.otherLoans ?? [])) {
    out.push({
      type: 'loan',
      outstanding_balance_gbp: l.outstanding ?? l.outstanding_balance_gbp ?? 0,
      interest_rate: l.rate ?? l.interestRate ?? 0.08,
    });
  }
  return out;
}

// Apply a decision array to produce a modified entity (deep-cloned)
function _applyDecisions(entity, decisions) {
  let e = JSON.parse(JSON.stringify(entity));
  for (const d of decisions) {
    if (!d?.type) continue;
    switch (d.type) {
      case 'payoff_mortgage': {
        const mort = _liabArr(entity).find(l => l.type === 'mortgage');
        const amt  = mort?.outstanding_balance_gbp ?? 0;
        if (Array.isArray(e.liabilities)) {
          e.liabilities = e.liabilities.filter(l => l.type !== 'mortgage');
        } else if (e.liabilities?.mortgage) {
          delete e.liabilities.mortgage;
        }
        if (e.assets?.cash) e.assets.cash.total = Math.max(0, (e.assets.cash.total ?? 0) - amt);
        break;
      }
      case 'shift_cash': {
        const { amount = 0, from = 'cash', to = 'isa' } = d;
        if (from === 'cash' && e.assets?.cash) {
          e.assets.cash.total = Math.max(0, (e.assets.cash.total ?? 0) - amount);
        }
        if (to === 'isa') {
          e.assets.isa = e.assets.isa ?? {};
          e.assets.isa.value = (e.assets.isa.value ?? 0) + amount;
        } else if (to === 'sipp') {
          e.assets.sipp = e.assets.sipp ?? {};
          e.assets.sipp.total = (e.assets.sipp.total ?? 0) + amount;
        }
        break;
      }
      case 'rebalance': {
        if (d.equity_weight !== undefined && e.assets?.portfolio) {
          e.assets.portfolio.growth =
            d.equity_weight * 0.072 + (1 - d.equity_weight) * 0.035;
        }
        break;
      }
    }
  }
  return e;
}

// ─────────────────────────────────────────────────────────────────────────────
// CF1 — swrRegime(entity, regime)
// XS effort. Returns parameters for the chosen SWR regime.
// Spec: cashflow-v1_0.md §8.10
// ─────────────────────────────────────────────────────────────────────────────

const _SWR_PARAMS = {
  bengen:         { rate: 0.040, label: 'Bengen 4%',           inflation_adjustment: 'annual_full' },
  morningstar:    { rate: 0.037, label: 'Morningstar 3.7%',    inflation_adjustment: 'annual_full' },
  guyton_klinger: { rate: 0.045, label: 'Guyton-Klinger 4.5%', inflation_adjustment: 'conditional' },
  vanguard:       { rate: 0.033, label: 'Vanguard 3.3%',       inflation_adjustment: 'annual_full' },
  prc_anchored:   { rate: 0.040, label: 'PRC-anchored',         inflation_adjustment: 'dynamic'     },
  custom:         { rate: null,  label: 'Custom',               inflation_adjustment: 'annual_full' },
};

const _SWR_RATIONALE = {
  bengen:         'Trinity Study 1994 — 4% withdrawal rate survives 30-year retirement in 95% of historical US scenarios.',
  morningstar:    'Morningstar 2022 — lower expected returns from current valuations warrant 3.7% for new retirees.',
  guyton_klinger: 'Variable-withdrawal guardrails — higher starting rate offset by cut rules when portfolio falls.',
  vanguard:       'Vanguard 2023 — conservative baseline reflecting compressed equity risk premium.',
  prc_anchored:   'Rate adjusts to personal return on capital spread — links withdrawal rate to actual portfolio performance.',
  custom:         'User-defined withdrawal rate.',
};

const _SWR_RULES = {
  bengen:         { no_cuts: true,  inflation_skip: false, prosperity_rule: null, preservation_rule: null },
  morningstar:    { no_cuts: true,  inflation_skip: false, prosperity_rule: null, preservation_rule: null },
  guyton_klinger: { no_cuts: false, inflation_skip: true,  prosperity_rule: 'raise 10% if rate > 120% baseline', preservation_rule: 'cut 10% if rate < 80% baseline' },
  vanguard:       { no_cuts: true,  inflation_skip: false, prosperity_rule: null, preservation_rule: null },
  prc_anchored:   { no_cuts: false, inflation_skip: false, prosperity_rule: 'dynamic via PRC spread',            preservation_rule: 'dynamic via PRC spread' },
  custom:         { no_cuts: false, inflation_skip: false, prosperity_rule: null, preservation_rule: null },
};

/**
 * SWR regime parameters for the chosen regime key.
 * @param {object} entity
 * @param {string} [regime]
 * @returns {{ regime, starting_rate, inflation_adjustment, label, rules, custom_params, rationale }}
 */
export function swrRegime(entity, regime) {
  const key    = regime ?? entity?.preferences?.swrRegime ?? 'bengen';
  const params = _SWR_PARAMS[key] ?? _SWR_PARAMS.bengen;
  const customRate = key === 'custom' ? (entity?.preferences?.customSwrRate ?? 0.04) : null;
  return {
    regime:               key,
    starting_rate:        customRate ?? params.rate,
    inflation_adjustment: params.inflation_adjustment,
    label:                params.label,
    rules:                _SWR_RULES[key] ?? null,
    custom_params:        key === 'custom' ? { rate: customRate } : null,
    rationale:            _SWR_RATIONALE[key] ?? '',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CF2 — guytonKlinger(entity, cma, triggers)
// S effort. Variable-withdrawal corridor — position + expected trigger count.
// Spec: cashflow-v1_0.md §8.4
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Guyton-Klinger variable-withdrawal corridor.
 * @param {object} entity
 * @param {object|null} [cma]
 * @param {{ prosperity: number, preservation: number }} [triggers]
 * @returns {{ baseline_rate, prosperity_threshold, preservation_threshold, current_rate, position, expected_triggers_in_horizon, horizon_years, alternative_parameters, confidence, cma_bundle }}
 */
export function guytonKlinger(entity, cma = null, triggers = { prosperity: 0.20, preservation: -0.20 }) {
  const age           = _age(entity);
  const retAge        = entity?.preferences?.retirementAge ?? TAX.spa;
  const targetIncome  = entity?.preferences?.targetIncomeReal ?? entity?.targetIncome ?? 50000;
  const inv           = _inv(entity);

  if (inv.value < 10_000 || targetIncome === 0) {
    return {
      baseline_rate: null, prosperity_threshold: null, preservation_threshold: null,
      current_rate: null, position: null, expected_triggers_in_horizon: null,
      horizon_years: null, alternative_parameters: null,
      confidence: 'INSUFFICIENT', insufficient_data: true, cma_bundle: _cmaBundle(cma),
    };
  }

  const startAge    = Math.max(age, retAge);
  const life        = lifeStageFor(startAge);
  const regimeKey   = entity?.preferences?.swrRegime ?? (life.stage >= 5 ? 'morningstar' : 'bengen');
  const baseRate    = _SWR_PARAMS[regimeKey]?.rate ?? 0.04;
  const prospRate   = baseRate * (1 + triggers.prosperity);
  const preservRate = Math.max(0, baseRate * (1 + triggers.preservation));
  const currentDD   = entity?.drawdown ?? 0;
  const currentRate = inv.value > 0 ? currentDD / inv.value : 0;

  let position = 'centre';
  if (currentRate >= prospRate)                   position = 'prosperity_triggered';
  else if (currentRate >= prospRate * 0.90)        position = 'approaching_prosperity';
  else if (currentRate <= preservRate)             position = 'preservation_triggered';
  else if (currentRate <= preservRate * 1.10)      position = 'approaching_preservation';

  const horizonYears = Math.max(0, 90 - startAge);
  // Historical GK: ~1 raise per 7yr, ~1 cut per 14yr
  const expectedRaises = Math.round(horizonYears / 7);
  const expectedCuts   = Math.round(horizonYears / 14);

  return {
    baseline_rate:          Math.round(baseRate   * 1000) / 1000,
    prosperity_threshold:   Math.round(prospRate  * 1000) / 1000,
    preservation_threshold: Math.round(preservRate * 1000) / 1000,
    current_rate:           Math.round(currentRate * 1000) / 1000,
    position,
    expected_triggers_in_horizon: { raises: expectedRaises, cuts: expectedCuts },
    horizon_years: horizonYears,
    alternative_parameters: {
      klinger_classic: { prosperity:  0.25, preservation: -0.25 },
      aggressive:      { prosperity:  0.15, preservation: -0.15 },
      conservative:    { prosperity:  0.30, preservation: -0.30 },
    },
    confidence:  _confidence(cma),
    cma_bundle:  _cmaBundle(cma),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CF3 — maxDrawdownExposure(entity, cma)
// S effort. Implied portfolio max drawdown vs stated tolerance.
// Spec: cashflow-v1_0.md §8.5
// ─────────────────────────────────────────────────────────────────────────────

// Historical 3σ max-drawdown per broad asset class
const _MDD = { equity: 0.50, bonds: 0.15, property: 0.35, cash: 0.02 };

/**
 * Portfolio implied max drawdown versus stated tolerance.
 * @param {object} entity
 * @param {object|null} [cma]
 * @returns {{ implied_max_drawdown, stated_tolerance, mismatch, mismatch_severity, contributors, rebalance_to_60_40, confidence, cma_bundle }}
 */
export function maxDrawdownExposure(entity, cma = null) {
  const inv = _inv(entity);

  if (inv.value < 10_000) {
    return {
      implied_max_drawdown: null, stated_tolerance: null, mismatch: null,
      mismatch_severity: 'insufficient_data', contributors: null,
      rebalance_to_60_40: null, confidence: 'INSUFFICIENT', insufficient_data: true,
      cma_bundle: _cmaBundle(cma),
    };
  }

  const a        = entity?.assets ?? {};
  const total    = inv.value;
  const { sipp: sippVal, isa: isaVal, port: portVal, cash: cashVal } = _assetVals(entity);

  // Assume pension/ISA/GIA are typical growth allocations (70% equity, 20% bonds, 10% alts)
  const equityVal   = (sippVal + isaVal) * 0.70 + portVal * 0.80;
  const bondsVal    = (sippVal + isaVal) * 0.20 + portVal * 0.10;
  const propertyVal = (a.property ?? []).reduce((s, p) => {
    if (p['$ref'] || p.status === 'disposed') return s;
    return s + (p.value_gbp ?? p.value ?? 0) * (p.beneficial_interest_this_individual ?? 1);
  }, 0);
  const gross = equityVal + bondsVal + propertyVal + cashVal;

  if (gross === 0) {
    return {
      implied_max_drawdown: null, stated_tolerance: null, mismatch: null,
      mismatch_severity: 'insufficient_data', contributors: null,
      rebalance_to_60_40: null, confidence: 'INSUFFICIENT', insufficient_data: true,
      cma_bundle: _cmaBundle(cma),
    };
  }

  const wE = equityVal   / gross;
  const wB = bondsVal    / gross;
  const wP = propertyVal / gross;
  const wC = cashVal     / gross;

  const implied = wE * _MDD.equity + wB * _MDD.bonds + wP * _MDD.property + wC * _MDD.cash;

  const rqMap = { 'over-20': 0.25, '10-20': 0.15, '5-10': 0.075, 'under-5': 0.04 };
  const stated = rqMap[entity?.riskQuestionnaire?.q_max_drawdown_tolerance] ?? 0.20;

  const mismatch  = Math.max(0, implied - stated);
  const severity  = mismatch > 0.20 ? 'high' : mismatch > 0.10 ? 'medium' : mismatch > 0.05 ? 'mild' : 'none';
  const bal60_40  = 0.60 * _MDD.equity + 0.40 * _MDD.bonds;

  const r = n => Math.round(n * 1000) / 1000;
  return {
    implied_max_drawdown: r(implied),
    stated_tolerance:     stated,
    mismatch:             r(mismatch),
    mismatch_severity:    severity,
    contributors: {
      equity:   r(wE * _MDD.equity),
      bonds:    r(wB * _MDD.bonds),
      property: r(wP * _MDD.property),
    },
    rebalance_to_60_40: r(bal60_40),
    confidence:  _confidence(cma),
    cma_bundle:  _cmaBundle(cma),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CF4 — sequenceOfReturnsVulnerability(entity, cma)
// M effort. Median vs adverse (worst-decile first 5yr) depletion comparison.
// Spec: cashflow-v1_0.md §8.3
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sequence-of-returns vulnerability: how bad early returns affect the plan.
 * @param {object} entity
 * @param {object|null} [cma]
 * @returns {{ median_depletion_age, adverse_depletion_age, vulnerability_years, vulnerability_pounds, bad_years_severity, mitigation_savings, confidence, cma_bundle }}
 */
export function sequenceOfReturnsVulnerability(entity, cma = null) {
  const age          = _age(entity);
  const retAge       = entity?.preferences?.retirementAge ?? TAX.spa;
  const targetIncome = entity?.preferences?.targetIncomeReal ?? entity?.targetIncome ?? 50000;
  const inv          = _inv(entity);

  if (inv.value < 10_000 || targetIncome === 0) {
    return {
      median_depletion_age: null, adverse_depletion_age: null,
      vulnerability_years: null, vulnerability_pounds: null,
      bad_years_severity: null, mitigation_savings: null,
      confidence: 'INSUFFICIENT', insufficient_data: true, cma_bundle: _cmaBundle(cma),
    };
  }

  const startAge   = Math.max(age, retAge);
  const spAge      = entity?.income?.statePension?.startAge ?? TAX.spa;
  const sp         = entity?.income?.statePension?.annual   ?? TAX.statePensionFull;
  const growth     = cma?.growth    ?? DEFAULT_GROWTH;
  const worstAnnual = cma?.worstDecile?.annual_equiv ?? -0.082;
  const MAX_HOR    = 50;

  function _sim(badFirst5) {
    let val = inv.value;
    for (let y = 0; y < MAX_HOR; y++) {
      const curAge = startAge + y;
      const spInc  = curAge >= spAge ? sp : 0;
      const draw   = Math.max(0, targetIncome - spInc);
      const ret    = (badFirst5 && y < 5) ? worstAnnual : growth;
      val = val * (1 + ret) - draw;
      if (val <= 0) return { depletionAge: curAge, terminalValue: 0 };
    }
    return { depletionAge: startAge + MAX_HOR, terminalValue: Math.max(0, val) };
  }

  const med  = _sim(false);
  const adv  = _sim(true);
  const vulnYrs = Math.max(0, med.depletionAge - adv.depletionAge);
  const vulnGbp = Math.max(0, med.terminalValue - adv.terminalValue);
  const severity = vulnYrs > 10 ? 'severe' : vulnYrs > 5 ? 'moderate' : 'mild';

  return {
    median_depletion_age:  med.depletionAge,
    adverse_depletion_age: adv.depletionAge,
    vulnerability_years:   vulnYrs,
    vulnerability_pounds:  Math.round(vulnGbp),
    bad_years_start_year:  0,
    bad_years_severity:    severity,
    mitigation_savings: {
      reduce_withdrawal_first_3yrs_10pct: Math.round(vulnYrs * 0.30),
      hold_3yr_cash_buffer:               Math.round(vulnYrs * 0.38),
      switch_to_gk_corridor:              Math.round(vulnYrs * 0.54),
    },
    confidence:  _confidence(cma),
    cma_bundle:  _cmaBundle(cma),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CF5 — probabilityOfSuccess(entity, cma, runs)
// M effort. Full Monte Carlo PoS with lognormal returns.
// Spec: cashflow-v1_0.md §8.2
// Predecessor: longevityProbability() in fq-calculator.js (MC-LITE-1.0)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Monte Carlo probability of success — fraction of paths that don't deplete.
 * @param {object} entity
 * @param {object|null} [cma]
 * @param {number} [runs=500]
 * @returns {{ pos, runs, successful_runs, median_terminal_value, p10_terminal_value, p25_terminal_value, p75_terminal_value, p90_terminal_value, median_depletion_age, p10_depletion_age, ... }}
 */
export function probabilityOfSuccess(entity, cma = null, runs = 500) {
  const age          = _age(entity);
  const retAge       = entity?.preferences?.retirementAge ?? TAX.spa;
  const targetIncome = entity?.preferences?.targetIncomeReal ?? entity?.targetIncome ?? 50000;
  const inv          = _inv(entity);

  if (inv.value < 10_000 || targetIncome === 0) {
    return {
      pos: null, runs, successful_runs: null,
      median_terminal_value: null, p10_terminal_value: null, p25_terminal_value: null,
      p75_terminal_value: null, p90_terminal_value: null,
      median_depletion_age: null, p10_depletion_age: null,
      confidence: 'INSUFFICIENT', insufficient_data: true, cma_bundle: _cmaBundle(cma),
    };
  }

  const startAge  = Math.max(age, retAge);
  const horizon   = Math.max(5, 90 - startAge);
  const spAge     = entity?.income?.statePension?.startAge ?? TAX.spa;
  const sp        = entity?.income?.statePension?.annual   ?? TAX.statePensionFull;
  const mu_raw    = cma?.growth ?? DEFAULT_GROWTH;
  const inflation = cma?.inflation ?? DEFAULT_INFLATION;
  // Blended vol: 60% equity (global), 40% bonds
  const eVol = cma?.assetClasses?.global_equity?.volatility ?? DEFAULT_AC.global_equity.volatility;
  const bVol = cma?.assetClasses?.uk_gilts?.volatility      ?? DEFAULT_AC.uk_gilts.volatility;
  const sigma = Math.sqrt(0.36 * eVol * eVol + 0.16 * bVol * bVol + 2 * 0.6 * 0.4 * eVol * bVol * -0.10);
  const mu    = Math.log(1 + mu_raw) - 0.5 * sigma * sigma;

  let survived = 0;
  const terminalVals = [];
  const depletionAges = [];

  for (let r = 0; r < runs; r++) {
    let val           = inv.value;
    let annualWithdraw = targetIncome;
    let depleted      = false;

    for (let y = 0; y < horizon; y++) {
      const curAge = startAge + y;
      const spInc  = curAge >= spAge ? sp : 0;
      const Z      = _rn();
      const ret    = Math.exp(mu + sigma * Z);
      const infShk = inflation + (_rn() * 0.005);   // ±0.5% inflation vol
      if (y > 0) annualWithdraw *= (1 + Math.max(0, infShk));
      const draw = Math.max(0, annualWithdraw - spInc);
      val = val * ret - draw;
      if (val <= 0) {
        depleted = true;
        depletionAges.push(curAge);
        break;
      }
    }

    if (!depleted) survived++;
    terminalVals.push(Math.max(0, Math.round(val)));
  }

  const tvSorted  = [...terminalVals].sort((a, b) => a - b);
  const daSorted  = [...depletionAges].sort((a, b) => a - b);

  return {
    pos:                    Math.round((survived / runs) * 100) / 100,
    runs,
    successful_runs:        survived,
    median_terminal_value:  _pct(tvSorted, 0.50),
    p10_terminal_value:     _pct(tvSorted, 0.10),
    p25_terminal_value:     _pct(tvSorted, 0.25),
    p75_terminal_value:     _pct(tvSorted, 0.75),
    p90_terminal_value:     _pct(tvSorted, 0.90),
    median_depletion_age:   daSorted.length ? _pct(daSorted, 0.50) : null,
    p10_depletion_age:      daSorted.length ? _pct(daSorted, 0.10) : null,
    cma_bundle:             _cmaBundle(cma),
    return_distribution:    'lognormal',
    inflation_model:        `random_walk_around_${Math.round(inflation * 100)}pct`,
    horizon_years:          horizon,
    retirement_age:         startAge,
    target_income_real:     targetIncome,
    confidence:             _confidence(cma),
    insufficient_data:      false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CF6 — portfolioEfficiency(entity, cma)
// M effort. Distance from Markowitz efficient frontier (3-asset approximation).
// Spec: cashflow-v1_0.md §8.6
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Portfolio position relative to efficient frontier.
 * @param {object} entity
 * @param {object|null} [cma]
 * @returns {{ portfolio_expected_return, portfolio_volatility, frontier_at_same_risk, return_gap, position, nearest_frontier_point, rebalance_delta_per_class, confidence, cma_bundle }}
 */
export function portfolioEfficiency(entity, cma = null) {
  const inv = _inv(entity);

  if (inv.value < 10_000) {
    return {
      portfolio_expected_return: null, portfolio_volatility: null,
      frontier_at_same_risk: null, return_gap: null, position: null,
      nearest_frontier_point: null, rebalance_delta_per_class: null,
      confidence: 'INSUFFICIENT', insufficient_data: true, cma_bundle: _cmaBundle(cma),
    };
  }

  const total  = inv.value;
  const { sipp: sippV, isa: isaV, port: portV, cash: cashV } = _assetVals(entity);

  const ac  = cma?.assetClasses ?? DEFAULT_AC;
  const cor = cma?.correlations ?? {};

  // Expected returns from CMA
  const rE = (ac.uk_equity?.expectedReturn ?? 0.072) * 0.5 +
             (ac.global_equity?.expectedReturn ?? 0.076) * 0.5;
  const rB = (ac.uk_gilts?.expectedReturn    ?? 0.035) * 0.5 +
             (ac.corp_bonds?.expectedReturn   ?? 0.045) * 0.5;
  const rC = ac.cash?.expectedReturn ?? 0.045;

  // Volatilities
  const vE_uk  = ac.uk_equity?.volatility     ?? 0.165;
  const vE_gl  = ac.global_equity?.volatility ?? 0.155;
  const corrEE = cor.uk_equity_global_equity  ?? 0.75;
  const vE     = Math.sqrt(0.25 * vE_uk * vE_uk + 0.25 * vE_gl * vE_gl +
                           2 * 0.5 * 0.5 * vE_uk * vE_gl * corrEE);
  const vB     = (ac.uk_gilts?.volatility  ?? 0.080) * 0.5 +
                 (ac.corp_bonds?.volatility ?? 0.075) * 0.5;
  const vC     = ac.cash?.volatility ?? 0.008;

  // Portfolio weights (assume pension/ISA = 70/20/10 E/B/C, GIA = 80/10/10)
  const equityAmt = (sippV + isaV) * 0.70 + portV * 0.80;
  const bondsAmt  = (sippV + isaV) * 0.20 + portV * 0.10;
  const cashAmt   = cashV + (sippV + isaV) * 0.10 + portV * 0.10;
  const grossW    = Math.max(1, equityAmt + bondsAmt + cashAmt);

  const wE = equityAmt / grossW;
  const wB = bondsAmt  / grossW;
  const wC = cashAmt   / grossW;

  const portRet = wE * rE + wB * rB + wC * rC;
  const corrEB  = cor.uk_equity_uk_gilts ?? -0.15;
  const portVar = wE*wE*vE*vE + wB*wB*vB*vB + wC*wC*vC*vC +
                  2*wE*wB*vE*vB*corrEB;
  const portVol = Math.sqrt(portVar);

  // Efficient frontier at same vol (Sharpe-optimal mix of equity + cash)
  const sharpeE      = (rE - rC) / vE;
  const frontRet     = rC + sharpeE * portVol;
  const returnGap    = Math.max(0, frontRet - portRet);
  const frontWE      = Math.min(1, portVol / vE);
  const frontWC      = Math.max(0, 1 - frontWE);

  // 60/40 reference derived from CMA data (not hardcoded)
  const ref6040Return = 0.6 * rE + 0.4 * rB;
  const ref6040Vol    = Math.sqrt(
    0.6 * 0.6 * vE * vE +
    0.4 * 0.4 * vB * vB +
    2 * 0.6 * 0.4 * corrEB * vE * vB
  );

  const r = n => Math.round(n * 1000) / 1000;
  return {
    portfolio_expected_return: r(portRet),
    portfolio_volatility:      r(portVol),
    frontier_at_same_risk:     r(frontRet),
    return_gap:                r(returnGap),
    position:                  returnGap < 0.002 ? 'on' : 'below_frontier',
    nearest_frontier_point: {
      expected_return: r(frontRet),
      volatility:      r(portVol),
      weights: { equity: r(frontWE), bonds: 0, cash: r(frontWC) },
    },
    rebalance_delta_per_class: {
      equity: r(frontWE - wE),
      bonds:  r(-wB),
      cash:   r(frontWC - wC),
    },
    reference: {
      label:          '60/40 blend',
      volatility:     r(ref6040Vol),
      expectedReturn: r(ref6040Return),
    },
    confidence:  _confidence(cma, 'MEDIUM'),
    cma_bundle:  _cmaBundle(cma),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CF7 — prcPccSpread(entity, decisions)
// L effort. Personal Return on Capital vs Personal Cost of Capital.
// v1.1: decisions is Decision[] (backward-compatible — single object also works).
// Spec: cashflow-v1_0.md §8.7 + v1.1 §6.4
// ─────────────────────────────────────────────────────────────────────────────

function _calcSpread(entity) {
  const inv   = _inv(entity);
  const total = Math.max(1, inv.value);
  const a     = entity?.assets ?? {};
  const { sipp: sippTotal, isa: isaTotal, port: portTotal, cash: cashTotal } = _assetVals(entity);

  // ── PRC blocks ────────────────────────────────────────────────────────────
  const prcBlocks = [];
  const _prcBlock = (name, val, ret) => {
    if (val <= 0) return;
    prcBlocks.push({ name, weight: val / total, return: ret, contribution_pp: (val / total) * ret * 100 });
  };

  _prcBlock('SIPP',      sippTotal, a.sipp?.growth      ?? 0.058);
  _prcBlock('ISA',       isaTotal,  a.isa?.growth        ?? 0.062);
  _prcBlock('Portfolio', portTotal, a.portfolio?.growth  ?? 0.068);

  if (cashTotal > 0) {
    _prcBlock('Cash', cashTotal, a.cash?.rate ?? 0.045);
  }

  const weightedPRC = prcBlocks.reduce((s, b) => s + b.contribution_pp, 0);

  // ── PCC blocks ────────────────────────────────────────────────────────────
  const pccBlocks = [];
  const liabilities = _liabArr(entity);
  const totalLiab   = liabilities.reduce((s, l) => s + (l.outstanding_balance_gbp ?? 0), 0);
  const base        = Math.max(1, total + totalLiab);

  for (const l of liabilities) {
    const bal  = l.outstanding_balance_gbp ?? 0;
    const rate = l.interest_rate ?? 0.048;
    if (bal > 0) {
      pccBlocks.push({
        name: l.type ?? 'Debt',
        weight:          bal / base,
        rate,
        contribution_pp: (bal / base) * rate * 100,
      });
    }
  }

  // Opportunity cost: cash above 6-month buffer vs best ISA rate
  const monthlyEssentials = (entity?.targetIncome ?? 50000) / 12;
  const excessCash = Math.max(0, cashTotal - monthlyEssentials * 6);
  if (excessCash > 0) {
    const oppRate = 0.011;
    pccBlocks.push({
      name:            'Opportunity cost (excess cash)',
      weight:          excessCash / base,
      rate:            oppRate,
      contribution_pp: (excessCash / base) * oppRate * 100,
    });
  }

  const weightedPCC = pccBlocks.reduce((s, b) => s + b.contribution_pp, 0);
  const spread      = weightedPRC - weightedPCC;

  const r2 = n => Math.round(n * 100) / 100;
  const r3 = n => Math.round(n * 1000) / 1000;
  return {
    spread_pp:  r2(spread),
    prc_blocks: prcBlocks.map(b => ({ ...b, weight: r2(b.weight), return: r3(b.return), contribution_pp: r2(b.contribution_pp) })),
    pcc_blocks: pccBlocks.map(b => ({ ...b, weight: r2(b.weight), rate:   r3(b.rate),   contribution_pp: r2(b.contribution_pp) })),
    confidence: inv.confidence ?? 'MEDIUM',
  };
}

/**
 * PRC / PCC spread — personal return on capital vs personal cost of capital.
 * decisions: single Decision object OR Decision[] (v1.1 multi-decision stack).
 * @param {object} entity
 * @param {object|object[]|null} [decisions]
 * @returns {{ spread_pp, prc_blocks, pcc_blocks, decision_applied, spread_pre_decision, spread_post_decision, confidence, cma_bundle }}
 */
export function prcPccSpread(entity, decisions = null) {
  const inv = _inv(entity);
  if (inv.value < 10_000) {
    return {
      spread_pp: null, prc_blocks: [], pcc_blocks: [],
      decision_applied: null, spread_pre_decision: null, spread_post_decision: null,
      confidence: 'INSUFFICIENT', insufficient_data: true, cma_bundle: null,
    };
  }

  const hasDecision = decisions !== null && decisions !== undefined &&
    (Array.isArray(decisions) ? decisions.length > 0 : true);

  if (!hasDecision) {
    const base = _calcSpread(entity);
    return {
      ...base,
      decision_applied:    null,
      spread_pre_decision: null,
      spread_post_decision: null,
      cma_bundle: null,
    };
  }

  const decArr   = Array.isArray(decisions) ? decisions : [decisions];
  const modEntity = _applyDecisions(entity, decArr);
  const pre  = _calcSpread(entity);
  const post = _calcSpread(modEntity);

  return {
    ...post,
    decision_applied:    decArr,
    spread_pre_decision: pre.spread_pp,
    spread_post_decision: post.spread_pp,
    cma_bundle: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CF8 — realityEngineFactorisation(entity, cma)
// L effort. Approximate variance decomposition: personal / system / external.
// FP-4 honesty: confidence always LOW at v1.0 (cohort data absent).
// Spec: cashflow-v1_0.md §8.8
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reality Engine variance decomposition across three agency layers.
 * Confidence is always LOW at v1.0 — stated explicitly per spec §22.5.
 * @param {object} entity
 * @param {object|null} [cma]
 * @returns {{ layers, cohort_comparison, confidence, cma_bundle }}
 */
export function realityEngineFactorisation(entity, cma = null) {
  const inv = _inv(entity);

  if (inv.value < 10_000) {
    return {
      layers: null, cohort_comparison: null,
      confidence: 'INSUFFICIENT', insufficient_data: true, cma_bundle: _cmaBundle(cma),
    };
  }

  const a   = entity?.assets ?? {};
  const age = _age(entity);
  const { isa: isaVal } = _assetVals(entity);

  // Sensitivity proxy: count active-engagement behaviours → scales personal share
  const activeBehaviours = [
    (entity?.drawdown ?? 0) > 0,
    isaVal > 50_000,
    entity?.willStatus === 'current',
    entity?.lpaStatus === 'both',
    (a.sipp?.pensions ?? []).some(p => p.nominationDate),
  ].filter(Boolean).length;

  // IHT exposure → scales financial-system share (rules matter more when exposed)
  const ihtExposureBonus = inv.value > 500_000 ? 0.04 : inv.value > 325_000 ? 0.02 : 0;

  const personalShare   = Math.min(0.55, 0.35 + activeBehaviours * 0.02);
  const financialShare  = Math.min(0.40, 0.28 + ihtExposureBonus);
  const externalShare   = Math.max(0.15, 1 - personalShare - financialShare);

  const personalDrivers = [
    'savings rate',
    'asset allocation',
    'spending discipline',
    ...(entity?.drawdown > 0 ? ['drawdown timing'] : []),
    ...(isaVal > 50_000      ? ['ISA wrapper use']  : []),
  ];

  const financialDrivers = [
    'IHT thresholds',
    'ISA allowance',
    'tax band freezes',
    age >= 55 ? 'SIPP drawdown rules' : 'pension annual allowance',
  ];

  const externalDrivers = ['inflation path', 'market returns', 'regulatory change'];

  const r2 = n => Math.round(n * 100) / 100;
  return {
    layers: {
      personal:         { share: r2(personalShare),  drivers: personalDrivers  },
      financial_system: { share: r2(financialShare), drivers: financialDrivers },
      external:         { share: r2(externalShare),  drivers: externalDrivers  },
    },
    cohort_comparison: {
      cohort_personal:   0.38,
      cohort_financial:  0.35,
      cohort_external:   0.27,
    },
    confidence:  'LOW',   // v1.0: approximate — stated per spec §22.5
    cma_bundle:  _cmaBundle(cma),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CF9 — fiveCashflowScenarios(entity, cma)
// L effort. Five canonical forward scenarios. Orchestrates CF2/CF3/CF5/guardrail.
// Spec: cashflow-v1_0.md §8.9
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Five canonical cashflow scenarios: Do Nothing, Guardrail, Optimal, Bengen 4%, Custom.
 * Uses 100 MC runs per scenario for performance (full 500 runs on standalone CF5 call).
 * @param {object} entity
 * @param {object|null} [cma]
 * @returns {{ scenarios, cma_bundle, confidence, insufficient_data }}
 */
export function fiveCashflowScenarios(entity, cma = null) {
  const inv = _inv(entity);

  if (inv.value < 10_000) {
    return {
      scenarios: [], confidence: 'INSUFFICIENT',
      insufficient_data: true, cma_bundle: _cmaBundle(cma),
    };
  }

  const age          = _age(entity);
  const retAge       = entity?.preferences?.retirementAge ?? TAX.spa;
  const targetIncome = entity?.preferences?.targetIncomeReal ?? entity?.targetIncome ?? 50000;
  const startAge     = Math.max(age, retAge);
  const spAge        = entity?.income?.statePension?.startAge ?? TAX.spa;
  const sp           = entity?.income?.statePension?.annual   ?? TAX.statePensionFull;
  const growth       = cma?.growth    ?? DEFAULT_GROWTH;
  const inflation    = cma?.inflation ?? DEFAULT_INFLATION;
  const horizonYrs   = Math.max(5, 90 - startAge);
  const startYr      = new Date().getFullYear();

  // Deterministic year-by-year projection for the annual table
  function _project(annualDD) {
    let val = inv.value;
    const table = [];
    let withdrawal = annualDD;
    for (let y = 0; y < horizonYrs; y++) {
      const curAge = startAge + y;
      const spInc  = curAge >= spAge ? sp : 0;
      if (y > 0) withdrawal *= (1 + inflation);
      const tax       = incomeTax(withdrawal, spInc);
      const netIncome = Math.max(0, withdrawal + spInc - tax);
      val = Math.max(0, val * (1 + growth) - withdrawal);
      table.push({
        year:       startYr + y,
        age:        curAge,
        income:     Math.round(withdrawal + spInc),
        tax:        Math.round(tax),
        net_income: Math.round(netIncome),
        portfolio:  Math.round(val),
      });
    }
    return { annual_table: table, terminal_value_median: Math.round(val) };
  }

  // Scenario definitions
  const guardrailAmt  = _guardrail(entity);
  const optimalDD     = Math.min(guardrailAmt, TAX.brl);
  const bengenDD      = Math.round(inv.value * 0.04);
  const customDD      = entity?.drawdown ?? 0;

  const scenarios = [
    { id: 'do_nothing',  label: 'Do Nothing', dd: 0           },
    { id: 'guardrail',   label: 'Guardrail',  dd: guardrailAmt },
    { id: 'optimal',     label: 'Optimal',    dd: optimalDD    },
    { id: 'bengen_4pct', label: 'Bengen 4%',  dd: bengenDD     },
    { id: 'custom',      label: 'Custom',     dd: customDD     },
  ].map(({ id, label, dd }) => {
    const scenEntity = { ...entity, drawdown: dd };
    const proj = _project(dd);
    const pos  = probabilityOfSuccess(scenEntity, cma, 100);  // 100 runs for speed
    const coi  = costOfInaction(scenEntity);
    return {
      id, label,
      annual_drawdown:       dd,
      annual_table:          proj.annual_table,
      pos:                   pos.pos,
      coi,
      terminal_value_median: proj.terminal_value_median,
    };
  });

  return {
    scenarios,
    cma_bundle:       _cmaBundle(cma),
    confidence:       _confidence(cma),
    insufficient_data: false,
  };
}
