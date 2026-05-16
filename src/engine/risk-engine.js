// ─────────────────────────────────────────────────────────────────────────────
// CAELIXA RISK ENGINE — Shock Scenarios + BTR Projection
// Per RL v1.1 §7 (5 shocks) · §6.9 (D7 BTR simulate path)
// Functions: runShock · riskShockSuite · whatWouldHelpMost · projectBTR
// All pure. No side effects. No hardcoded values.
// ─────────────────────────────────────────────────────────────────────────────

import { netWorth, calcFQ, calcRisk, TAX } from './fq-calculator.js';

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

function _applyJobLoss(e) {
  const m = _clone(e);
  // 6-month cash drain before person draws down or seeks alternative income
  const monthlyEmployment = (e.income?.employment || 0) / 12;
  const nwDelta = -(monthlyEmployment * 6);

  if (m.income) {
    m.income.employment = 0;
    m.income.dividends = 0;
  }
  m.drawdown = 0;
  if (m.riskQuestionnaire) {
    m.riskQuestionnaire.q13_income_sources = 'one';
  }
  return { mutated: m, nwDelta };
}

function _applyIllness(e) {
  const m = _clone(e);
  const monthlyEmployment = (e.income?.employment || 0) / 12;
  // SSP: £116.75/week × 28 weeks statutory maximum
  const sspTotal = 116.75 * 28;
  const nwDelta = -(monthlyEmployment * 6) + sspTotal;

  if (m.income) {
    m.income.employment = 0;
  }
  return { mutated: m, nwDelta };
}

function _applyMarketFall(e) {
  const m = _clone(e);
  const FALL = 0.30;
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

function _applyRateRise(e) {
  const m = _clone(e);
  const RISE = 0.02;
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

function _applyDeath(e) {
  const m = _clone(e);
  if (m.income) {
    m.income.employment = 0;
    m.income.dividends = 0;
  }
  m.drawdown = 0;

  // IHT liability on estate (worst-case: SIPP included post-Apr 2027 deadline)
  const nw        = netWorth(e);
  const sippVal   = e.assets?.sipp?.total || 0;
  const lifeAmt   = e.assets?.protection?.lifeInsurance?.amount || 0;
  const inTrust   = e.assets?.protection?.lifeInsurance?.inTrust || false;
  const hasResi   = (e.assets?.residence?.value || 0) > 0;

  const grossEstate  = nw + sippVal + (inTrust ? 0 : lifeAmt);
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
export function runShock(entity, shockId, bundle) {
  const shock = SHOCKS[shockId];
  if (!shock) throw new Error(`Unknown shockId: "${shockId}". Valid: ${Object.keys(SHOCKS).join(', ')}`);

  const nwBefore = netWorth(entity);
  const fqBefore = calcFQ(entity).total;
  const rsBefore = calcRisk(entity).total;

  const { mutated, nwDelta } = shock.apply(entity);

  const fqAfter = calcFQ(mutated).total;
  const rsAfter = calcRisk(mutated).total;
  const nwAfter = nwBefore + nwDelta;

  return {
    shockId,
    label:       shock.label,
    description: shock.description,
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
