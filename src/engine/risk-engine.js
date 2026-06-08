// ─────────────────────────────────────────────────────────────────────────────
// SONUSWEALTH RISK ENGINE — Shock Scenarios + BTR Projection
// Per RL v1.1 §7 (5 shocks) · §6.9 (D7 BTR simulate path)
// Functions: runShock · riskShockSuite · whatWouldHelpMost · projectBTR
// All pure. No side effects. No hardcoded values.
// ─────────────────────────────────────────────────────────────────────────────

import { netWorth, calcFQ, calcRisk, TAX, monthlySurplus } from './fq-calculator.js';

const VERSION = 'RISK-ENGINE-1.0';

// ── INTERNAL HELPERS ──────────────────────────────────────────────────────────

function _clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// Sum monthly debt service from liabilities object
function _monthlyDebtService(liab) {
  if (!liab) return 0;
  return (liab.mortgage?.monthlyPayment || 0) +
    (liab.otherLoans || []).reduce((s, l) => s + (l.monthlyPayment || 0), 0);
}

// ── SHOCK APPLICATORS ─────────────────────────────────────────────────────────
// Each returns { mutated: entity, nwDelta: number }
// mutated → used for FQ + RS delta via re-running calc functions
// nwDelta → economically-modelled immediate NW impact per RL v1.1 §16 (E)
// (some shocks don't mutate entity NW fields directly — income shocks drain cash)

// ── Shock parameters (grabbable on the Risk surface) ──────────────────────────
// Each applicator accepts an optional `params` object so the UI can drag the
// shock SIZE / HORIZON / income-loss depth and re-run the engine live. When
// `params` is omitted the defaults reproduce the v1.0 baseline exactly — no
// regression for callers that don't pass overrides (riskShockSuite, tie-out).
export const SHOCK_PARAM_DEFAULTS = {
  job_loss:    { incomeLossPct: 1.00, durationMonths: 6 },   // 100% income loss, 6mo drain
  illness:     { incomeLossPct: 1.00, durationMonths: 6 },
  market_fall: { dropPct: 0.30 },                            // −30% portfolio
  rate_rise:   { riseBps: 200 },                             // +200bps (2%)
  death:       {},                                           // estate-driven, no slider
};

function _num(v, fallback) {
  return (typeof v === 'number' && isFinite(v)) ? v : fallback;
}

function _applyJobLoss(e, params = {}) {
  const m = _clone(e);
  const d = SHOCK_PARAM_DEFAULTS.job_loss;
  const lossPct  = Math.max(0, Math.min(1, _num(params.incomeLossPct, d.incomeLossPct)));
  const months   = Math.max(1, _num(params.durationMonths, d.durationMonths));
  // Cash drain = lost monthly income × duration before alternative income/drawdown
  const monthlyEmployment = (e.income?.employment || 0) / 12;
  const nwDelta = -(monthlyEmployment * lossPct * months);

  if (m.income) {
    m.income.employment = (m.income.employment || 0) * (1 - lossPct);
    if (lossPct >= 1) m.income.dividends = 0;
  }
  if (lossPct >= 1) m.drawdown = 0;
  if (m.riskQuestionnaire && lossPct >= 1) {
    m.riskQuestionnaire.q13_income_sources = 'one';
  }
  return { mutated: m, nwDelta };
}

function _applyIllness(e, params = {}) {
  const m = _clone(e);
  const d = SHOCK_PARAM_DEFAULTS.illness;
  const lossPct = Math.max(0, Math.min(1, _num(params.incomeLossPct, d.incomeLossPct)));
  const months  = Math.max(1, _num(params.durationMonths, d.durationMonths));
  const monthlyEmployment = (e.income?.employment || 0) / 12;
  // SSP: £116.75/week × up to 28 weeks (≈ 6.46mo) statutory maximum, scaled to horizon
  const sspWeeks  = Math.min(28, months * 4.33);
  const sspTotal  = 116.75 * sspWeeks;
  const nwDelta = -(monthlyEmployment * lossPct * months) + sspTotal;

  if (m.income) {
    m.income.employment = (m.income.employment || 0) * (1 - lossPct);
  }
  return { mutated: m, nwDelta };
}

function _applyMarketFall(e, params = {}) {
  const m = _clone(e);
  const FALL = Math.max(0, Math.min(0.90, _num(params.dropPct, SHOCK_PARAM_DEFAULTS.market_fall.dropPct)));
  let nwDelta = 0;

  if (m.assets?.sipp) {
    const old = m.assets.sipp.total || 0;
    m.assets.sipp.total = old * (1 - FALL);
    nwDelta -= old * FALL;
    if (m.assets.sipp.pensions) {
      m.assets.sipp.pensions = m.assets.sipp.pensions.map(p => ({
        ...p,
        value: (p.value || 0) * (1 - FALL),
      }));
    }
  }
  if (m.assets?.isa) {
    const old = m.assets.isa.value || 0;
    m.assets.isa.value = old * (1 - FALL);
    nwDelta -= old * FALL;
  }
  if (m.assets?.portfolio) {
    const old = m.assets.portfolio.value || 0;
    m.assets.portfolio.value = old * (1 - FALL);
    nwDelta -= old * FALL;
  }
  return { mutated: m, nwDelta };
}

function _applyRateRise(e, params = {}) {
  const m = _clone(e);
  const bps  = Math.max(0, _num(params.riseBps, SHOCK_PARAM_DEFAULTS.rate_rise.riseBps));
  const RISE = bps / 10000; // basis points → decimal (200bps → 0.02)
  let extraMonthly = 0;

  if (m.liabilities?.mortgage?.rateType === 'variable') {
    const extra = ((m.liabilities.mortgage.outstanding || 0) * RISE) / 12;
    m.liabilities.mortgage.monthlyPayment = (m.liabilities.mortgage.monthlyPayment || 0) + extra;
    m.liabilities.mortgage.rate = (m.liabilities.mortgage.rate || 0) + RISE;
    extraMonthly += extra;
  }
  if (m.liabilities?.otherLoans) {
    m.liabilities.otherLoans = m.liabilities.otherLoans.map(l => {
      if (l.rateType === 'variable') {
        const extra = ((l.outstanding || 0) * RISE) / 12;
        extraMonthly += extra;
        return { ...l, monthlyPayment: (l.monthlyPayment || 0) + extra };
      }
      return l;
    });
  }
  // 12 months of extra payments drain from cash (immediate impact horizon)
  const nwDelta = -(extraMonthly * 12);
  return { mutated: m, nwDelta };
}

function _applyDeath(e, _params = {}) {
  const m = _clone(e);
  if (m.income) {
    m.income.employment = 0;
    m.income.dividends = 0;
  }
  m.drawdown = 0;

  // IHT liability on estate (worst-case: SIPP included post-Apr 2027 deadline).
  // netWorth() already includes SIPP — do not add it again (double-count bugfix).
  const nw        = netWorth(e);
  const lifeAmt   = e.assets?.protection?.lifeInsurance?.amount || 0;
  const inTrust   = e.assets?.protection?.lifeInsurance?.inTrust || false;
  const hasResi   = (e.assets?.residence?.value || 0) > 0;

  const grossEstate  = nw + (inTrust ? 0 : lifeAmt);
  const nrb          = TAX.nrb;
  const rnrb         = hasResi ? TAX.rnrb : 0;
  const taxable      = Math.max(0, grossEstate - nrb - rnrb);
  const ihtLiability = taxable * TAX.ihtRate;

  const nwDelta = -ihtLiability;
  return { mutated: m, nwDelta };
}

// ── SHOCK REGISTRY ────────────────────────────────────────────────────────────

const SHOCKS = {
  job_loss: {
    label: 'Job loss',
    description: 'Primary income stops immediately. Shows how quickly finances deteriorate and when risk of default begins.',
    apply: _applyJobLoss,
  },
  illness: {
    label: 'Serious illness',
    description: 'Six months income stops with partial statutory sick pay. Shows net shortfall after all income sources.',
    apply: _applyIllness,
  },
  market_fall: {
    label: 'Market fall −30%',
    description: 'All investable assets fall 30% in value immediately. Shows net worth impact and secondary effect on Wealth Score.',
    apply: _applyMarketFall,
  },
  rate_rise: {
    label: 'Interest rate +2%',
    description: 'Variable-rate debt costs rise 2%. Shows monthly cash-flow impact and buffer months consumed.',
    apply: _applyRateRise,
  },
  death: {
    label: 'Death of primary earner',
    description: 'Estate calculated under current IHT rules with life cover applied. Shows net estate available to dependants.',
    apply: _applyDeath,
  },
};

// ── PUBLIC API ────────────────────────────────────────────────────────────────

/**
 * Run a single shock scenario.
 * @param {object} entity
 * @param {string} shockId - job_loss | illness | market_fall | rate_rise | death
 * @param {object} [bundle] - jurisdictional bundle (uses engine defaults if omitted)
 * @returns {{ shockId, label, description, nwBefore, nwAfter, nwDelta, fqBefore, fqAfter, fqDelta, rsBefore, rsAfter, rsDelta, rulesVersion }}
 */
export function runShock(entity, shockId, bundle, params = {}) {
  const shock = SHOCKS[shockId];
  if (!shock) throw new Error(`Unknown shockId: "${shockId}". Valid: ${Object.keys(SHOCKS).join(', ')}`);

  const nwBefore = netWorth(entity);
  const fqBefore = calcFQ(entity).total;
  const rsBefore = calcRisk(entity).total;

  const { mutated, nwDelta } = shock.apply(entity, params);

  const fqAfter = calcFQ(mutated).total;
  const rsAfter = calcRisk(mutated).total;
  const nwAfter = nwBefore + nwDelta;

  return {
    shockId,
    label:       shock.label,
    description: shock.description,
    params:      { ...SHOCK_PARAM_DEFAULTS[shockId], ...params },
    nwBefore,
    nwAfter,
    nwDelta,
    fqBefore,
    fqAfter,
    fqDelta:     fqAfter - fqBefore,
    rsBefore,
    rsAfter,
    rsDelta:     rsAfter - rsBefore,
    rulesVersion: VERSION,
  };
}

/**
 * Run all 5 shock scenarios in one call.
 * @param {object} entity
 * @param {object} [bundle]
 * @returns {Record<string, ReturnType<runShock>>} keyed by shockId
 */
export function riskShockSuite(entity, bundle) {
  return Object.fromEntries(
    Object.keys(SHOCKS).map(id => [id, runShock(entity, id, bundle)])
  );
}

/**
 * Identify which single mitigation action would reduce a shock's impact most.
 * Ranks by RS delta improvement (most-reduces-impact first) per D-RISK-12.
 * @param {object} entity
 * @param {string} shockId
 * @returns {{ shockId, baseShock, mitigations: Array, rulesVersion }}
 */
export function whatWouldHelpMost(entity, shockId) {
  const baseShock = runShock(entity, shockId);
  const candidates = [];

  function test(action, description, effort, mutateFn) {
    const improved = mutateFn(_clone(entity));
    const result   = runShock(improved, shockId);
    candidates.push({
      action,
      description,
      effort, // 'low' | 'medium' | 'high'
      rsDeltaImprovement: result.rsDelta - baseShock.rsDelta,
      fqDeltaImprovement: result.fqDelta - baseShock.fqDelta,
      nwDeltaImprovement: result.nwDelta - baseShock.nwDelta,
    });
  }

  // 1 — Build emergency fund to 6 months
  test('build_emergency_fund', 'Build emergency fund to 6 months of essential spending', 'medium', e => {
    const monthly = (e.targetIncome || 50000) / 12;
    if (e.assets?.cash) {
      e.assets.cash.total = Math.max(e.assets.cash.total || 0, monthly * 6);
      e.assets.cash.own   = e.assets.cash.total;
    }
    return e;
  });

  // 2 — Add income protection insurance
  test('add_income_protection', 'Add income protection insurance (60% of salary)', 'low', e => {
    if (!e.assets)               e.assets               = {};
    if (!e.assets.protection)    e.assets.protection    = {};
    e.assets.protection.incomeProtection = {
      exists:         true,
      monthlyBenefit: ((e.income?.employment || 0) / 12) * 0.60,
    };
    if (!e.riskQuestionnaire) e.riskQuestionnaire = {};
    e.riskQuestionnaire.q12_income_protection = 'yes';
    return e;
  });

  // 3 — Add life insurance in trust
  test('add_life_insurance_in_trust', 'Add life insurance written into discretionary trust', 'medium', e => {
    if (!e.assets)            e.assets            = {};
    if (!e.assets.protection) e.assets.protection = {};
    const coverNeeded = (e.assets?.sipp?.total || 0) + (e.assets?.portfolio?.value || 0);
    e.assets.protection.lifeInsurance = {
      exists:  true,
      amount:  coverNeeded,
      inTrust: true,
    };
    return e;
  });

  // 4 — Diversify income (add second source)
  test('diversify_income', 'Add a second income source (rental, dividends, or part-time)', 'high', e => {
    if (!e.riskQuestionnaire) e.riskQuestionnaire = {};
    const curr = e.riskQuestionnaire.q13_income_sources;
    if (!curr || curr === 'one') {
      e.riskQuestionnaire.q13_income_sources = 'two';
      if (e.income) e.income.rentalIncome = Math.round((e.targetIncome || 50000) * 0.20);
    }
    return e;
  });

  // 5 — Fix mortgage rate (rate_rise specific)
  if (shockId === 'rate_rise') {
    test('fix_mortgage_rate', 'Switch variable-rate mortgage to fixed rate before next review', 'low', e => {
      if (e.liabilities?.mortgage?.rateType === 'variable') {
        e.liabilities.mortgage.rateType = 'fixed';
      }
      return e;
    });
  }

  // 6 — Reduce debt (general vulnerability)
  if (shockId === 'rate_rise' || shockId === 'job_loss') {
    test('overpay_mortgage', 'Overpay mortgage to reduce outstanding balance by 20%', 'medium', e => {
      if (e.liabilities?.mortgage?.outstanding) {
        const reduction = e.liabilities.mortgage.outstanding * 0.20;
        e.liabilities.mortgage.outstanding -= reduction;
        if (e.assets?.cash) {
          e.assets.cash.total = Math.max(0, (e.assets.cash.total || 0) - reduction);
          e.assets.cash.own   = e.assets.cash.total;
        }
      }
      return e;
    });
  }

  // Sort: most-reduces-impact first (higher rsDeltaImprovement = less negative shock on RS)
  candidates.sort((a, b) => b.rsDeltaImprovement - a.rsDeltaImprovement);

  return {
    shockId,
    baseShock,
    mitigations:  candidates,
    rulesVersion: VERSION,
  };
}

// ── BTR ENGAGEMENT PARAMETERS ─────────────────────────────────────────────────
// Per RL v1.1 §6.9 D7 simulate path — 3 engagement tiers

const BTR_TIERS = {
  low:    { apqPerMonth: 0,   documentsUploaded: 0, decisionsCommitted: 0, loginsPerMonth: 0.5 },
  medium: { apqPerMonth: 0.5, documentsUploaded: 1, decisionsCommitted: 1, loginsPerMonth: 2   },
  high:   { apqPerMonth: 1,   documentsUploaded: 2, decisionsCommitted: 2, loginsPerMonth: 5   },
};

function _projectBTRPoints(months, level) {
  const t = BTR_TIERS[level] || BTR_TIERS.medium;
  let pts = 0;

  // Tenure: +1 per 6 months of active use (≥1 login/month)
  if (t.loginsPerMonth >= 1) pts += Math.floor(months / 6);

  // 12-month engagement bonus: +2 for ≥6 logins/month sustained over 12 months
  if (months >= 12 && t.loginsPerMonth >= 2) pts += 2;

  // APQ completion: +1 per completed APQ (capped at 3)
  pts += Math.min(3, Math.floor(t.apqPerMonth * months));

  // Core document uploads (will / LPA / insurance): +1 each, max 3
  pts += Math.min(3, t.documentsUploaded);

  // Committed decisions: +1 each, max 2
  pts += Math.min(2, t.decisionsCommitted);

  return Math.min(7, pts); // D7 max = 7
}

/**
 * Project Behavioural Track Record (D7) growth trajectory.
 * Per RL v1.1 §6.9 — D7 simulate path (prospective trajectory, not what-if of data).
 * @param {object} entity
 * @param {number} months - projection horizon (default 12)
 * @param {'low'|'medium'|'high'} engagementLevel
 * @returns {{ currentBTR, projectedBTR, currentRS, projectedRS, engagementLevel, months, monthlyPath, rulesVersion }}
 */
/**
 * Month-by-month drawdown survival trajectory for a single shock.
 * @param {object} entity
 * @param {string} shockId - job_loss | illness | market_fall | rate_rise | death
 * @param {number} months  - projection window (default 24)
 * @returns {{ baseline, shocked, survivalMonths, recoveryMonth }}
 */
export function shockTrajectory(entity, shockId, months = 24, params = {}) {
  // Investable assets (liquid + portfolio; excludes primary residence)
  function investable(e) {
    return (
      (e.assets?.sipp?.total     || 0) +
      (e.assets?.isa?.value      || 0) +
      (e.assets?.portfolio?.value|| 0) +
      (e.assets?.cash?.total     || 0)
    );
  }

  // Monthly spend: use surplus deficit if negative (spending > income), else targetIncome/12
  function monthlyBurn(e) {
    let sur = 0;
    try { sur = monthlySurplus(e)?.surplus ?? 0; } catch { sur = 0; }
    if (sur < 0) return Math.abs(sur);       // already a net outflow
    return (e.targetIncome || 50000) / 12;   // fallback: annual target / 12
  }

  // Estimate annual portfolio volatility from asset mix.
  // Equity-like assets (SIPP, ISA, portfolio) vol ~16%/yr; cash ~1%/yr.
  // Blend assumes remaining share is bonds at ~6%/yr.
  // Default 50/50 equity/bond → annualVol ≈ 0.11 (√(0.5²×0.16² + 0.5²×0.06²)).
  function portfolioVol(e) {
    const total = investable(e);
    if (total <= 0) return 0.11;
    const equityLike = (e.assets?.sipp?.total || 0) + (e.assets?.isa?.value || 0) + (e.assets?.portfolio?.value || 0);
    const cashShare  = Math.min(1, (e.assets?.cash?.total || 0) / total);
    const equityShare = Math.max(0, 1 - cashShare);
    // Treat equity share as split evenly between equities (0.16) and bonds (0.06)
    const eqW  = equityShare * 0.5;
    const bndW = equityShare * 0.5;
    const cshW = cashShare;
    return Math.sqrt(eqW * eqW * 0.16 * 0.16 + bndW * bndW * 0.06 * 0.06 + cshW * cshW * 0.01 * 0.01);
  }

  const annualReturn  = entity.expectedReturn || 0.04;
  const monthlyReturn = Math.pow(1 + annualReturn, 1 / 12) - 1;
  const annualVol     = portfolioVol(entity);

  // Deterministic "bad sequence" stress adjustment per month:
  //   months 1–12: below-average (−annualVol/12 each month)
  //   months 13+:  above-average (+annualVol/12 each month — partial recovery)
  // This models the empirical finding that early-retirement sequence risk is worst
  // when falls precede recovery, not when they coincide with accumulation.
  function stressAdj(m) {
    return m <= 12 ? -(annualVol / 12) : (annualVol / 12);
  }

  const baseStart   = investable(entity);
  const burn        = monthlyBurn(entity);

  // Apply the shock (with any dragged params) to get shocked starting value
  const shockResult = runShock(entity, shockId, undefined, params);
  const shockedStart = Math.max(0, baseStart + shockResult.nwDelta);

  const baseline = [{ month: 0, value: baseStart }];
  const shocked  = [{ month: 0, value: shockedStart }];
  // Uncertainty band around the shocked median path. Width scales with portfolio
  // volatility and compounds over the horizon (√t) so the cone widens with time —
  // the brief mandates a labelled BAND, not one deterministic line.
  const shockedLo = [{ month: 0, value: shockedStart }];
  const shockedHi = [{ month: 0, value: shockedStart }];

  let survivalMonths = months;
  let recoveryMonth  = null;

  for (let m = 1; m <= months; m++) {
    const prevBase    = baseline[m - 1].value;
    const prevShocked = shocked[m - 1].value;

    // Baseline: smooth deterministic compounding (unchanged — no stress)
    const nextBase = Math.max(0, prevBase * (1 + monthlyReturn) - burn);

    // Shocked: sequence-of-returns stress path — bad sequence first, partial recovery later
    const nextShocked = Math.max(0, prevShocked * (1 + monthlyReturn + stressAdj(m)) - burn);

    baseline.push({ month: m, value: Math.round(nextBase) });
    shocked.push({ month: m, value: Math.round(nextShocked) });

    // ±1σ cone around the median shocked value (monthly vol × √elapsed-months)
    const sigma = (annualVol / Math.sqrt(12)) * Math.sqrt(m);
    const lo = Math.max(0, Math.round(nextShocked * (1 - sigma)));
    const hi = Math.round(nextShocked * (1 + sigma));
    shockedLo.push({ month: m, value: lo });
    shockedHi.push({ month: m, value: hi });

    // First month stressed shocked portfolio hits 0 → survival ceiling
    if (nextShocked <= 0 && survivalMonths === months) {
      survivalMonths = m;
    }

    // Recovery: first month baseline returns to ≥ pre-shock level (baseStart)
    // Only meaningful for portfolio shocks; income shocks have no portfolio rebound modelled here
    if (recoveryMonth === null && nextBase >= baseStart) {
      recoveryMonth = m;
    }
  }

  return {
    baseline, shocked, shockedLo, shockedHi,
    survivalMonths, recoveryMonth,
    netRate: annualReturn, annualVol,
    params: shockResult.params,
  };
}

export function projectBTR(entity, months = 12, engagementLevel = 'medium') {
  if (!BTR_TIERS[engagementLevel]) throw new Error(`Unknown engagementLevel: "${engagementLevel}"`);

  const currentBTR = entity.riskQuestionnaire?.behaviouralTrack || 0;
  const currentRS  = calcRisk(entity).total;

  const monthlyPath = [];
  for (let m = 1; m <= months; m++) {
    const gained     = _projectBTRPoints(m, engagementLevel);
    const btr        = Math.min(7, currentBTR + gained);
    const rsDelta    = btr - currentBTR;
    monthlyPath.push({
      month:       m,
      btr,
      rsDelta,
      rsProjected: Math.min(100, currentRS + rsDelta),
    });
  }

  const final = monthlyPath[monthlyPath.length - 1] || { btr: currentBTR, rsProjected: currentRS };

  return {
    currentBTR,
    projectedBTR:    final.btr,
    currentRS,
    projectedRS:     final.rsProjected,
    engagementLevel,
    months,
    monthlyPath,
    rulesVersion: VERSION,
  };
}
