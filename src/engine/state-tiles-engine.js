// ─────────────────────────────────────────────────────────────────────────────
// SONUSWEALTH STATE-TILES ENGINE — A5
// Four milestone state functions: Safety Net · Debt Free · FI · Beneficiary
// D-MM-7 DECIDED (foundation v1.3). Q-F PLSA fix is PROD-blocker; not demo-blocker.
// Pure functions. No side effects. No global state.
// ─────────────────────────────────────────────────────────────────────────────

import { TAX, lifeStageFor, calcAge } from './fq-calculator.js';

// Life-stage target months for Safety Net. D-MM-7 Q-B: 18-month cap lifted.
// Pending move to rules bundle at Phase 2 (O-HOME-1).
const SAFETY_NET_MONTHS = { 1: 3, 2: 4, 3: 5, 4: 6, 5: 12, 6: 18, 7: 18 };

function _isaVal(a) {
  return typeof a.isa === 'number' ? a.isa : (a.isa?.value ?? a.isa?.total ?? 0);
}

function _inv(entity) {
  const a = entity.assets ?? {};
  return (a.sipp?.total ?? 0) + _isaVal(a) + (a.portfolio?.value ?? 0)
       + (a.cash?.own ?? a.cash?.total ?? 0);
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safety Net state — emergency cash buffer vs life-stage month target.
 * @param {object} entity
 * @returns {{ tile, achieved, status, currentMonths, targetMonths, progress, cashAmount, monthlyEssentials, confidence, rulesVersion }}
 */
export function safetyNetState(entity) {
  const age   = entity.age ?? (entity.individual?.dob ? calcAge(entity.individual.dob) : 30);
  const stage = entity.lifeStage ?? lifeStageFor(age).stage;
  const monthlyEssentials = (entity.targetIncome ?? 50000) / 12;

  const a             = entity.assets ?? {};
  const cash          = a.cash?.own ?? a.cash?.total ?? 0;
  const targetMonths  = SAFETY_NET_MONTHS[stage] ?? 6;
  const currentMonths = monthlyEssentials > 0 ? cash / monthlyEssentials : 0;
  const achieved      = currentMonths >= targetMonths;
  const progress      = Math.min(100, Math.round((currentMonths / targetMonths) * 100));

  return {
    tile:              'safety_net',
    achieved,
    status:            achieved                          ? 'ACHIEVED'
                     : currentMonths >= targetMonths * 0.5 ? 'ON_TRACK'
                     : 'IN_PROGRESS',
    currentMonths:     Math.round(currentMonths * 10) / 10,
    targetMonths,
    progress,
    cashAmount:        Math.round(cash),
    monthlyEssentials: Math.round(monthlyEssentials),
    confidence:        (monthlyEssentials > 0 && cash > 0) ? 'HIGH' : 'LOW',
    rulesVersion:      entity.rulesVersion ?? 'UK-2026.1',
  };
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Debt Free state — total outstanding debt.
 * @param {object} entity
 * @returns {{ tile, achieved, status, totalDebt, mortgageOutstanding, otherDebt, projectedFreeDate, progress, confidence, rulesVersion }}
 */
export function debtFreeState(entity) {
  const liab     = entity.liabilities ?? {};
  const mortgage = liab.mortgage?.outstanding ?? liab.mortgage?.outstanding_balance ?? 0;
  const other    = (liab.otherLoans ?? []).reduce((s, l) =>
    s + (l.outstanding ?? l.outstanding_balance ?? l.outstanding_balance_gbp ?? 0), 0);
  const totalDebt = mortgage + other;
  const achieved  = totalDebt === 0;

  let projectedFreeDate = null;
  if (!achieved && (liab.mortgage?.remainingYears ?? 0) > 0) {
    const d = new Date();
    d.setFullYear(d.getFullYear() + Math.ceil(liab.mortgage.remainingYears));
    projectedFreeDate = d.toISOString().substring(0, 7);
  }

  // £0 = 100%, scales linearly to £1m = 0%
  const progress = achieved ? 100
    : Math.max(0, Math.min(99, Math.round(Math.max(0, 1 - totalDebt / 1_000_000) * 100)));

  return {
    tile:                'debt_free',
    achieved,
    status:              achieved ? 'ACHIEVED' : 'IN_PROGRESS',
    totalDebt:           Math.round(totalDebt),
    mortgageOutstanding: Math.round(mortgage),
    otherDebt:           Math.round(other),
    projectedFreeDate,
    progress,
    confidence:          'HIGH',
    rulesVersion:        entity.rulesVersion ?? 'UK-2026.1',
  };
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * FI state — investable assets projected to retirement vs capital required at SWR.
 * Uses pension + ISA + portfolio + cash (not property). Confidence MEDIUM (no CMA).
 * @param {object} entity
 * @returns {{ tile, achieved, status, fundedRatio, progress, requiredAssets, projectedAssets, retirementAge, horizonYears, targetIncome, swr, confidence, rulesVersion }}
 */
export function fiState(entity) {
  const age           = entity.age ?? 30;
  const retirementAge = entity.retirementAge ?? TAX.spa;
  const horizon       = Math.max(0, retirementAge - age);
  const targetIncome  = entity.targetIncome ?? 50000;
  const investable    = _inv(entity);

  if (investable < 10_000 || targetIncome === 0) {
    return {
      tile: 'fi', achieved: false, status: 'INSUFFICIENT_DATA',
      fundedRatio: null, progress: 0,
      requiredAssets: null, projectedAssets: null,
      retirementAge, horizonYears: horizon, targetIncome,
      swr: TAX.swr, confidence: 'INSUFFICIENT',
      rulesVersion: entity.rulesVersion ?? 'UK-2026.1',
    };
  }

  const stage  = entity.lifeStage ?? lifeStageFor(age).stage;
  const swr    = entity.swrOverride ?? (stage >= 5 ? 0.037 : TAX.swr);
  const growth = entity.assets?.sipp?.growth ?? 0.05;

  const projectedNominal = horizon > 0
    ? investable * Math.pow(1 + growth, horizon)
    : investable;
  const targetNominal  = targetIncome * Math.pow(1.025, Math.max(0, horizon));
  const requiredAssets = Math.round(targetNominal / swr);
  const ratio          = requiredAssets > 0 ? projectedNominal / requiredAssets : 0;
  const achieved       = ratio >= 1.0;
  const progress       = Math.min(100, Math.round(ratio * 100));

  return {
    tile:            'fi',
    achieved,
    status:          achieved ? 'ACHIEVED' : ratio >= 0.75 ? 'ON_TRACK' : 'IN_PROGRESS',
    fundedRatio:     Math.round(ratio * 100) / 100,
    progress,
    requiredAssets,
    projectedAssets: Math.round(projectedNominal),
    retirementAge,
    horizonYears:    horizon,
    targetIncome,
    swr,
    confidence:      'MEDIUM',
    rulesVersion:    entity.rulesVersion ?? 'UK-2026.1',
  };
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Beneficiary state — estate readiness: will + nominations + LPA + trust structure.
 * Nomination staleness: 3-year threshold (pending move to rules bundle).
 * Q-K dual pre/post-2027 number is a display concern — engine returns raw data only.
 * @param {object} entity
 * @returns {{ tile, achieved, status, progress, score, maxScore, gaps, willOk, nominationsOk, lpaOk, lifeInTrust, hasTrustGifts, sippAtRisk, staleNomCount, daysToDeadline, confidence, rulesVersion }}
 */
export function beneficiaryState(entity) {
  const a    = entity.assets  ?? {};
  const prot = a.protection   ?? {};

  const willOk = entity.willStatus === 'current';
  const lpaOk  = entity.lpaStatus  === 'both';

  const pensions  = a.sipp?.pensions ?? [];
  const staleNoms = pensions.filter(p => {
    if (!p.nominationDate) return true;
    return (Date.now() - new Date(p.nominationDate)) > 3 * 365.25 * 86400000;
  });
  const nominationsOk = pensions.length === 0 || staleNoms.length === 0;

  const lifeInTrust   = !!(prot.lifeInsurance?.exists && prot.lifeInsurance?.inTrust);
  const hasTrustGifts = !!(a.trustGifts);

  // TAX.deadline from tax-2026.json (Finance Act 2026: 6 April 2027)
  const daysToDeadline = Math.max(0, (TAX.deadline - Date.now()) / 86400000);
  const sippAtRisk     = (a.sipp?.total ?? 0) > 0
                      && (entity.drawdown ?? 0) === 0
                      && daysToDeadline < 730;

  let score = 0;
  if (willOk)                       score++;
  if (nominationsOk)                score++;
  if (lpaOk)                        score++;
  if (lifeInTrust || hasTrustGifts) score++;

  const achieved = score === 4 && !sippAtRisk;
  const progress = Math.round((score / 4) * 100);

  const gaps = [];
  if (!willOk)        gaps.push('will_not_current');
  if (!nominationsOk) gaps.push('nominations_stale');
  if (!lpaOk)         gaps.push('lpa_missing');
  if (!lifeInTrust)   gaps.push('life_not_in_trust');
  if (sippAtRisk)     gaps.push('sipp_entering_estate');

  return {
    tile:          'beneficiary',
    achieved,
    status:        achieved ? 'ACHIEVED' : score >= 3 ? 'ON_TRACK' : 'IN_PROGRESS',
    progress,
    score,
    maxScore:      4,
    gaps,
    willOk,
    nominationsOk,
    lpaOk,
    lifeInTrust,
    hasTrustGifts,
    sippAtRisk,
    staleNomCount:  staleNoms.length,
    daysToDeadline: Math.round(daysToDeadline),
    confidence:     'HIGH',
    rulesVersion:   entity.rulesVersion ?? 'UK-2026.1',
  };
}
