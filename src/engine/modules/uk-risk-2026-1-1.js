// =====================================================================
// CAELIXA — parts/3-Engine/uk-risk-2026-1-1.js
// =====================================================================
// UK Caelixa Risk Score engine — 7 dimensions · 5 shock scenarios ·
// life-event reopen matrix · 2 canonical CoI handlers · cashflow consumer
// wires · Cholesky multi-asset risk metrics.
//
// Built:    s17b-2 (10 May 2026 · Track A · Code · Opus · phases 1–4)
// Source spec: 3-Engine-risk-rules-v1_1.md (s12a · 6 May 2026 ·
//              authoritative per D-RISK-RULES-V1-AUTH; s07 RISK-1.0 absorbed)
// UI consumer: 2-Product-risk-overlay-v1_5.md (renamed from
//              risk-layer per F-RISK-NAMING resolution)
// Cashflow consumer: uk-cashflow-2026-1-1.js §8.4 / §8.6 / §8.7 hooks
//   replace v1 stand-ins via DI at Phase 4 wiring patches.
//
// Roster: 38 named exports (D-RISK-FN-ROSTER-1 lock):
//   §B  BAND_DEFINITIONS · RISK_DIMENSION_MAX_POINTS              [2 frozen]
//   §C  calcRisk                                                  [1]
//   §D  D1_mapIncomeResilience · D1_fallback                      [2]
//       D2_mapLiquidityBuffer · D2_fallback                       [2]
//       D5_mapConcentration · D5_fallback                         [2]
//   §E  D3_computeProtectionCoverage · D4_computeDebtVulnerability
//       D6_computeDependencyExposure · D7_computeBTR              [4]
//   §F  recommendedLifeCover · recommendedCICover · recommendedIPRatio
//       recommendedKeyPersonCover · protectionGapCard             [5]
//   §G  shockJobLoss · shockIllness · shockMarketDrop
//       shockRateRise · shockDeath · runCombinedShock             [6]
//   §H  lifeEventReopen                                           [1]
//   §I  projectBTR                                                [1]
//   §J  riskActionSet · determineConfidence                       [2]
//   §K  riskBand                                                  [1]
//   §L  portfolioRebalancingHandler · sequenceOfReturnsHedgingHandler [2]
//   §M  buildRiskCoIExtras                                        [1]
//   §N  sequenceOfReturnsRisk · maxDrawdownVolatility · mvPortfolioFrontier [3]
//                                                          TOTAL: 33 public
//   §O  Internal helpers (5, prefixed _) — not exported           [5]
//
// Authority hierarchy:
//   - Risk rules v1.1 (3-Engine knowledge layer) — algorithmic authority
//   - Foundation v1.11 §15.3 (D-COI-EXTRAS-1) — extras pattern binding
//   - Foundation v1.11 §10.12 (D-COI-HANDLER-INJECTION-1 + D-COI-DEFAULTS-SOURCED-1)
//   - skill v1.4 §2.7 — domain-research-first; founder examples ≠ definitions
//
// Quality gates per skill v1.4 §2.6.5 + foundation §3.1 Q1–Q9:
//   Q1 ✓ purpose declared per fn         Q6 ✓ self-criticism via OPEN log
//   Q2 ✓ envelope contract               Q7 ✓ smoke green
//   Q3 ✓ failure modes (INSUFFICIENT_DATA)  Q8 ✓ better-than-static-DD
//   Q4 ✓ no dates beyond bundleVersion   Q9 ✓ industry-standard sources
//   Q5 ✓ explanations in plain English
//
// v1.0 limitations declared (per Q9 honesty):
//   - Joint-entity bilateral computation deferred (O-RISK-RULES-10 v1.x)
//   - CI breadth-of-conditions not in scoring (O-RISK-RULES-05 v1.x)
//   - IP deferred period not penalised (O-RISK-RULES-06 v1.x)
//   - UC monthly amounts approximated (O-RISK-RULES-07 — bundle refresh)
//   - Illness costs broad estimate £500/mo (O-RISK-RULES-08 v1.x)
//   - Life-in-trust assume payout to estate at v1.0 (O-RISK-RULES-09)
//   - D7 confirmation evidence per action not specified (O-RISK-RULES-11)
// =====================================================================

import {
  costOfInaction,
} from './lib/canonical-coi.js';

import {
  mulberry32,
  sampleNormal,
  simulate,
  summarise,
  probAbove,
  probBelow,
  choleskyDecompose,
  buildCovarianceMatrix,
  sampleMultivariateNormalFromChol,
} from './lib/monte-carlo.js';

// financial-math (presentValueAnnuity, npv) imported by handlers when needed;
// not required at engine scope at v1.0.


// =====================================================================
// §A — Internal helpers (private)
// =====================================================================

function _r(n) { return Math.round(n); }
function _r2(n) { return Math.round(n * 100) / 100; }
function _max0(n) { return Math.max(0, n); }
function _clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

function _ageOf(entity) {
  if (typeof entity?.age === 'number') return entity.age;
  if (entity?.dateOfBirth) {
    const dob = new Date(entity.dateOfBirth);
    const now = new Date();
    return now.getFullYear() - dob.getFullYear();
  }
  return null;
}

function _validateEntity(entity) {
  if (!entity || typeof entity !== 'object') {
    throw new Error('uk-risk: entity must be an object');
  }
}

function _readBundleRiskCalibration(bundle) {
  if (!bundle) throw new Error('uk-risk: bundle required');
  // Default values per Risk rules v1.1 §16
  const defaults = {
    incomeHaircutSelfEmployed: 0.20,
    incomeHaircutContractor: 0.20,
    incomeCoverageTarget: 1.30,
    liquidityTargetMonths: 6,
    lifeInsuranceMultiplier: 10,
    ciMinimumMultiplier: 3,
    ipReplacementRatio: 0.65,
    sspWeeklyRate: 116.75,
    sspMaxWeeks: 28,
    rateStressTestBps: 200,
    concentrationFlagThreshold: 0.40,
    perDependantCostAnnual: 12000,
    btrWindowMonths: 12,
    btrInactivityThresholdDays: 90,
    illnessCostMonthly: 500,
    ucMonthlyEstimateSingle: 800,
    ucMonthlyEstimateCouple: 1300,
    keyPersonRevenueMultiple: 1.0,
    keyPersonPbtMultiple: 5,
    liquidityTargetByLifeStage: {
      Foundation: { single_no_deps: 3, couple_or_deps: 4, default: 3 },
      Acceleration: { single_no_deps: 4, couple_or_deps: 4, default: 4 },
      Consolidation: { default: 5 },
      Peak: { default: 5 },
      Transition: { default: 6 },
      Decumulation: { default: 12 },
      Legacy: { default: 24 },
    },
  };
  const cal = bundle?.riskCalibration ?? {};
  return { ...defaults, ...cal };
}

function _writeRiskEvent(eventType, payload, correlationId) {
  // Stub at v1.0 — actual event store write happens in Wave 1A integration.
  // Returns canonical event envelope per Risk rules v1.1 §14.3.
  return {
    eventType,
    timestamp: new Date().toISOString(),
    correlationId: correlationId ?? null,
    payload,
  };
}

// Common envelope helper for failure modes
function _err(reason, missing) {
  return {
    status: 'INSUFFICIENT_DATA',
    reason,
    missing: missing ?? [],
  };
}


// =====================================================================
// §B — FROZEN CONSTANTS (Risk rules v1.1 §1.1 + §2)
// =====================================================================

/**
 * Five Risk Score bands per Risk rules v1.1 §2 (D-RISK-BOUNDARY-2 v1.4 codebase auth).
 * Boundary rule (D-RISK-BOUNDARY-1): score exactly at boundary belongs to UPPER band.
 * Implemented as `score < threshold` — score=40 is Managed, not Vulnerable.
 */
export const BAND_DEFINITIONS = Object.freeze([
  Object.freeze({ name: 'Exposed',    min: 0,  max: 19,  threshold: 20, colour: '--c-acc3' }),
  Object.freeze({ name: 'Vulnerable', min: 20, max: 39,  threshold: 40, colour: '--c-gold' }),
  Object.freeze({ name: 'Managed',    min: 40, max: 59,  threshold: 60, colour: '--c-text2' }),
  Object.freeze({ name: 'Protected',  min: 60, max: 79,  threshold: 80, colour: '--c-acc2' }),
  Object.freeze({ name: 'Resilient',  min: 80, max: 100, threshold: 101, colour: '--c-acc' }),
]);

/**
 * Per-dimension max points per Risk rules v1.1 §1.1.
 * Sum = 100. Frozen.
 */
export const RISK_DIMENSION_MAX_POINTS = Object.freeze({
  D1: 20, D2: 18, D3: 18, D4: 15, D5: 12, D6: 10, D7: 7,
});


// =====================================================================
// §K — riskBand (Risk rules v1.1 §2)
// =====================================================================

/**
 * Map a Risk Score to its band object.
 * Boundary rule: score exactly at boundary belongs to UPPER (better) band.
 *
 * @param {number} score   Integer 0–100
 * @returns {{name, min, max, threshold, colour}}   Band object (frozen)
 */
export function riskBand(score) {
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    throw new Error(`uk-risk.riskBand: score must be finite number, got ${score}`);
  }
  if (score < 20) return BAND_DEFINITIONS[0];
  if (score < 40) return BAND_DEFINITIONS[1];
  if (score < 60) return BAND_DEFINITIONS[2];
  if (score < 80) return BAND_DEFINITIONS[3];
  return BAND_DEFINITIONS[4];
}


// =====================================================================
// §D — Dimension scorers (cross-read mappings)
// =====================================================================

/**
 * D1 mapping — Income Resilience (Risk rules v1.1 §3.2).
 * Maps the CF engine's 0–100 incomeResilience signal to the 0–20 D1 score.
 *
 * @param {number} cfSignal   0–100 from cashflowHealth(entity).components.incomeResilience
 * @returns {number}   D1 score 0–20
 */
export function D1_mapIncomeResilience(cfSignal) {
  if (typeof cfSignal !== 'number' || !Number.isFinite(cfSignal)) {
    return 0;
  }
  return _clamp(Math.round((cfSignal / 100) * 20), 0, 20);
}

/**
 * D1 fallback — when CF signal unavailable (Risk rules v1.1 §3.3).
 * Computes coverage_ratio_estimate = income / (essentials + debt service) × 12,
 * then maps to 0–20 via score = round(coverage / 2.0 × 20).
 *
 * @param {object} entity
 * @returns {{score, confidence, reason}}
 */
export function D1_fallback(entity) {
  _validateEntity(entity);
  const income = entity?.income?.annualGross ?? entity?.totalDeclaredIncome ?? 0;
  const essMo = entity?.expenses?.monthlyEssentials ?? 0;
  const debtSvc = entity?.liabilities?.annualDebtService ?? 0;
  const denom = essMo * 12 + debtSvc;
  if (denom <= 0) {
    return { score: 0, confidence: 'Low', reason: 'Insufficient expenditure data for coverage ratio' };
  }
  const coverage = income / denom;
  const score = _clamp(Math.round((coverage / 2.0) * 20), 0, 20);
  return {
    score,
    confidence: 'Low',
    reason: 'CF signal unavailable; fallback uses raw coverage ratio',
  };
}

/**
 * D2 mapping — Liquidity Buffer (Risk rules v1.1 §4.2).
 * Score relative to life-stage-adjusted target (s07 §3.2 basis).
 *
 * Score map:
 *   0 mo                → 0
 *   < 17% of target     → 2
 *   17–32% of target    → 4
 *   33–49% of target    → 7
 *   50–65% of target    → 10
 *   66–82% of target    → 13
 *   83–99% of target    → 15
 *   ≥ 100% of target    → 18
 *
 * @param {number} months          Liquidity in months (from CF liquidityBuffer)
 * @param {string} lifeStage       Foundation | Acceleration | Consolidation | Peak | Transition | Decumulation | Legacy
 * @param {string} householdType   single_no_deps | couple_or_deps | (or 'default')
 * @param {object} bundle
 * @returns {number}   D2 score 0–18
 */
export function D2_mapLiquidityBuffer(months, lifeStage, householdType, bundle) {
  if (typeof months !== 'number' || !Number.isFinite(months) || months < 0) return 0;
  const cal = _readBundleRiskCalibration(bundle);
  const stageBlock = cal.liquidityTargetByLifeStage?.[lifeStage]
    ?? { default: cal.liquidityTargetMonths ?? 6 };
  const target = stageBlock[householdType] ?? stageBlock.default ?? 6;
  if (target <= 0) return 0;
  const pct = months / target;

  if (months === 0) return 0;
  if (pct < 0.17) return 2;
  if (pct < 0.33) return 4;
  if (pct < 0.50) return 7;
  if (pct < 0.66) return 10;
  if (pct < 0.83) return 13;
  if (pct < 1.00) return 15;
  return 18;
}

/**
 * D2 fallback — when CF signal unavailable (Risk rules v1.1 §4.4).
 * @param {object} entity
 * @param {object} bundle
 * @returns {{score, confidence, reason}}
 */
export function D2_fallback(entity, bundle) {
  _validateEntity(entity);
  const cash = entity?.cashAndCashEquivalents
    ?? ((entity?.assets ?? []).filter(a =>
        a?.type === 'cash' || a?.type === 'savings' || a?.type === 'cash_isa')
        .reduce((s, a) => s + (a.value ?? 0), 0));
  const essMo = entity?.expenses?.monthlyEssentials ?? 0;
  if (essMo <= 0 || cash <= 0) {
    return { score: 0, confidence: 'Low', reason: 'Insufficient cash or expenditure data' };
  }
  const months = cash / essMo;
  const lifeStage = entity?.lifeStage ?? 'Consolidation';
  const householdType = (entity?.dependants?.count ?? 0) > 0
    ? 'couple_or_deps'
    : (entity?.partner ? 'couple_or_deps' : 'single_no_deps');
  const score = D2_mapLiquidityBuffer(months, lifeStage, householdType, bundle);
  return { score, confidence: 'Low', reason: 'CF signal unavailable; computed from raw cash/expenses' };
}

/**
 * D5 mapping — Concentration Risk (Risk rules v1.1 §7.2).
 * Maps the CF/MM 0–100 concentrationRisk signal to 0–12.
 *
 * @param {number} signal   0–100 from concentrationRisk(entity)
 * @returns {number}   D5 score 0–12
 */
export function D5_mapConcentration(signal) {
  if (typeof signal !== 'number' || !Number.isFinite(signal)) return 0;
  return _clamp(Math.round((signal / 100) * 12), 0, 12);
}

/**
 * D5 fallback — direct compute from MM data (Risk rules v1.1 §7.4).
 * Implements the §7.3 primary (largest holding) + secondary (L1 categories)
 * formula directly when CF/MM signal is unavailable.
 *
 * @param {object} entity
 * @returns {{score, confidence, signal, largestPct, distinctL1}}
 */
export function D5_fallback(entity) {
  _validateEntity(entity);
  const investable = entity?.investableAssets;
  if (!investable || !Array.isArray(investable.holdings) || investable.holdings.length === 0) {
    return { score: 0, confidence: 'Low', signal: 0, largestPct: null, distinctL1: 0,
             reason: 'No investable holdings recorded' };
  }
  const total = investable.total
    ?? investable.holdings.reduce((s, h) => s + (h.value ?? 0), 0);
  if (total <= 0) {
    return { score: 0, confidence: 'Low', signal: 0, largestPct: null, distinctL1: 0,
             reason: 'Investable total ≤ 0' };
  }
  const largestVal = investable.holdings.reduce((m, h) => Math.max(m, h.value ?? 0), 0);
  const largestPct = largestVal / total;
  // Primary (max 60)
  let primary;
  if (largestPct < 0.15) primary = 60;
  else if (largestPct < 0.25) primary = 48;
  else if (largestPct < 0.35) primary = 36;
  else if (largestPct < 0.45) primary = 24;
  else if (largestPct < 0.60) primary = 12;
  else primary = 0;

  // Secondary (max 40) — distinct L1 categories
  const l1Set = new Set();
  for (const h of investable.holdings) {
    if (h?.l1Category) l1Set.add(h.l1Category);
  }
  const distinctL1 = l1Set.size;
  let secondary;
  if (distinctL1 >= 5) secondary = 40;
  else if (distinctL1 === 4) secondary = 32;
  else if (distinctL1 === 3) secondary = 20;
  else if (distinctL1 === 2) secondary = 10;
  else secondary = 0;

  const signal = primary + secondary;
  return {
    score: D5_mapConcentration(signal),
    confidence: 'Low',
    signal,
    largestPct,
    distinctL1,
  };
}


// =====================================================================
// §F — Recommended cover formulas (Risk rules v1.1 §5.3)
// =====================================================================

/**
 * Recommended life cover (Risk rules v1.1 §5.3).
 *   recommended = max(debt_sum, 10×income) + (deps × per_dep × yrs_to_indep)
 *
 * Sources: Swiss Re Group Watch 2024 (10× income); ABI protection gap report 2024;
 *          ONS Family Spending Survey 2024 (£12,000 default per-dependant cost).
 *
 * @param {object} entity
 * @param {object} bundle
 * @returns {{recommended, breakdown}}
 */
export function recommendedLifeCover(entity, bundle) {
  _validateEntity(entity);
  const cal = _readBundleRiskCalibration(bundle);
  const mortgage = entity?.liabilities?.mortgageOutstanding ?? 0;
  const otherSecured = entity?.liabilities?.otherSecuredDebts ?? 0;
  const unsecured = entity?.liabilities?.unsecuredDebts ?? 0;
  const debtSum = mortgage + otherSecured + unsecured;

  const income = entity?.income?.annualGross ?? 0;
  const incomeMultiple = income * cal.lifeInsuranceMultiplier;

  const baseFloor = Math.max(debtSum, incomeMultiple);

  const deps = entity?.dependants ?? { count: 0 };
  const youngestAge = deps?.youngestAge ?? null;
  const yrsToIndep = youngestAge !== null ? Math.max(0, 18 - youngestAge) : 0;
  const perDep = entity?.perDependantAnnualCostOverride ?? cal.perDependantCostAnnual;
  const depCost = (deps.count ?? 0) * perDep * yrsToIndep;

  const recommended = baseFloor + depCost;
  return {
    recommended,
    breakdown: {
      debtSum, incomeMultiple, baseFloor, depCost,
      depCount: deps.count ?? 0, yrsToIndep, perDep,
      multiplier: cal.lifeInsuranceMultiplier,
    },
  };
}

/**
 * Recommended CI cover (Risk rules v1.1 §5.3).
 *   recommended = annual_gross_income × ciMinimumMultiplier (UK default: 3)
 * Source: ABI CI protection benchmark; CII personal finance planning standard.
 */
export function recommendedCICover(entity, bundle) {
  _validateEntity(entity);
  const cal = _readBundleRiskCalibration(bundle);
  const income = entity?.income?.annualGross ?? 0;
  const recommended = income * cal.ciMinimumMultiplier;
  return {
    recommended,
    breakdown: { income, multiplier: cal.ciMinimumMultiplier },
  };
}

/**
 * Recommended IP replacement ratio (Risk rules v1.1 §5.3).
 *   target = monthly_gross_income × ipReplacementRatio (UK default: 0.65)
 * Returns target monthly benefit (not a sum assured).
 * Source: FCA COBS guidance; ABI IP benchmark; CII recommended replacement ratio.
 */
export function recommendedIPRatio(entity, bundle) {
  _validateEntity(entity);
  const cal = _readBundleRiskCalibration(bundle);
  const monthlyGross = (entity?.income?.annualGross ?? 0) / 12;
  const targetMonthly = monthlyGross * cal.ipReplacementRatio;
  return {
    targetMonthlyBenefit: targetMonthly,
    breakdown: {
      monthlyGross,
      replacementRatio: cal.ipReplacementRatio,
      targetMonthly,
    },
  };
}

/**
 * Recommended key-person cover (Risk rules v1.1 §5.3, director only).
 *   recommended = max(business_revenue × 1.0, business_pbt × 5)
 * Source: ABI key-person insurance guide; EY SME insurance benchmarks.
 */
export function recommendedKeyPersonCover(entity, bundle) {
  _validateEntity(entity);
  if (!Array.isArray(entity?.flags) || !entity.flags.includes('director')) {
    return {
      recommended: 0,
      applicable: false,
      reason: 'entity is not flagged as director',
    };
  }
  const cal = _readBundleRiskCalibration(bundle);
  const revenue = entity?.business?.annualRevenue ?? 0;
  const pbt = entity?.business?.profitBeforeTax ?? 0;
  const revenueBased = revenue * cal.keyPersonRevenueMultiple;
  const pbtBased = pbt * cal.keyPersonPbtMultiple;
  const recommended = Math.max(revenueBased, pbtBased);
  return {
    recommended,
    applicable: true,
    breakdown: {
      revenue, pbt,
      revenueMultiple: cal.keyPersonRevenueMultiple,
      pbtMultiple: cal.keyPersonPbtMultiple,
      revenueBased, pbtBased,
    },
  };
}

/**
 * Protection gap card for a single coverage type (Risk rules v1.1 §5.4).
 * Used by Zone 4 protection gap rendering and D3 sub-score breakdown.
 *
 * @param {object} entity
 * @param {'life'|'ci'|'ip'|'key_person'} coverageType
 * @param {object} bundle
 * @returns {{coverageType, existing, recommended, gap, gapPercent, subScore, maxSubScore, scoreDelta, actions}}
 */
export function protectionGapCard(entity, coverageType, bundle) {
  _validateEntity(entity);
  const isDirector = Array.isArray(entity?.flags) && entity.flags.includes('director');
  const policies = entity?.protectionPolicies ?? {};

  let existing = 0;
  let recommended = 0;
  let maxSubScore = 0;
  let actions = [];

  if (coverageType === 'life') {
    existing = policies.life?.sumAssured ?? 0;
    recommended = recommendedLifeCover(entity, bundle).recommended;
    maxSubScore = isDirector ? 5 : 7;
    actions = ['get_life_quote', 'add_life_policy', 'review_existing'];
  } else if (coverageType === 'ci') {
    existing = policies.ci?.sumAssured ?? 0;
    recommended = recommendedCICover(entity, bundle).recommended;
    maxSubScore = isDirector ? 5 : 6;
    actions = ['get_ci_quote', 'add_ci_policy', 'review_existing'];
  } else if (coverageType === 'ip') {
    // For IP, "existing" = monthly benefit, "recommended" = target monthly benefit
    existing = policies.ip?.monthlyBenefit ?? 0;
    recommended = recommendedIPRatio(entity, bundle).targetMonthlyBenefit;
    maxSubScore = 5;
    actions = ['get_ip_quote', 'add_ip_policy', 'review_existing'];
  } else if (coverageType === 'key_person') {
    if (!isDirector) {
      return {
        coverageType,
        existing: 0,
        recommended: 0,
        gap: 0,
        gapPercent: 0,
        subScore: 0,
        maxSubScore: 0,
        scoreDelta: 0,
        actions: [],
        applicable: false,
      };
    }
    existing = policies.keyPerson?.sumAssured ?? 0;
    recommended = recommendedKeyPersonCover(entity, bundle).recommended;
    maxSubScore = 3;
    actions = ['get_kp_quote', 'add_kp_policy', 'review_existing'];
  } else {
    throw new Error(`uk-risk.protectionGapCard: unknown coverageType "${coverageType}"`);
  }

  const gap = _max0(recommended - existing);
  const gapPercent = recommended > 0 ? (gap / recommended) * 100 : 0;

  // Sub-score = clamp(existing / recommended × maxSubScore, 0, maxSubScore)
  const ratio = recommended > 0 ? existing / recommended : (existing > 0 ? 1 : 0);
  const subScore = _clamp(ratio * maxSubScore, 0, maxSubScore);

  // scoreDelta = how much D3 improves if gap fully closed
  const scoreDelta = _r2(maxSubScore - subScore);

  return {
    coverageType,
    existing: _r2(existing),
    recommended: _r2(recommended),
    gap: _r2(gap),
    gapPercent: _r2(gapPercent),
    subScore: _r2(subScore),
    maxSubScore,
    scoreDelta,
    actions,
    applicable: true,
  };
}


// =====================================================================
// §E — Direct-compute dimensions (D3 / D4 / D6 / D7)
// =====================================================================

/**
 * D3 — Protection Coverage (Risk rules v1.1 §5).
 * Direct compute: 3 sub-scores (Life+CI+IP) for non-director or
 * 4 sub-scores (Life+CI+IP+KP) for director. Max 18.
 *
 * Score floor rules (§5.2):
 *   - dependants > 0 and zero policies → score capped at 5
 *   - no dependants and no director → minimum score 2
 *
 * @param {object} entity
 * @param {object} bundle
 * @returns {{score, subScores, gaps, confidence}}
 */
export function D3_computeProtectionCoverage(entity, bundle) {
  _validateEntity(entity);
  const isDirector = Array.isArray(entity?.flags) && entity.flags.includes('director');
  const policies = entity?.protectionPolicies;
  const policiesRecorded = !!policies && Object.keys(policies).length > 0;

  const lifeCard = protectionGapCard(entity, 'life', bundle);
  const ciCard = protectionGapCard(entity, 'ci', bundle);
  const ipCard = protectionGapCard(entity, 'ip', bundle);
  const kpCard = isDirector ? protectionGapCard(entity, 'key_person', bundle) : null;

  let total = lifeCard.subScore + ciCard.subScore + ipCard.subScore;
  if (kpCard && kpCard.applicable) total += kpCard.subScore;

  // Apply score floor rules (§5.2)
  const depCount = entity?.dependants?.count ?? 0;
  const totalCover = (policies?.life?.sumAssured ?? 0)
                   + (policies?.ci?.sumAssured ?? 0)
                   + (policies?.ip?.monthlyBenefit ?? 0)
                   + (policies?.keyPerson?.sumAssured ?? 0);
  let floor = 0; let cap = 18;
  if (depCount > 0 && totalCover === 0) {
    cap = 5;
    total = Math.min(total, cap);
  }
  if (depCount === 0 && !isDirector) {
    floor = 2;
    total = Math.max(total, floor);
  }
  total = _clamp(total, 0, 18);

  // Confidence: per Risk rules v1.1 §11.4, D3 = Low if no protection policies recorded
  // (not zero coverage — UNKNOWN). If partial: Medium (D-RISK-RULES-02 resolved at v1.5).
  let confidence;
  if (!policiesRecorded) {
    confidence = 'Low';
  } else {
    // Partial = some coverage types missing → Medium
    const missingCount = [
      !policies.life,
      !policies.ci,
      !policies.ip,
      isDirector && !policies.keyPerson,
    ].filter(Boolean).length;
    confidence = missingCount > 0 ? 'Medium' : 'High';
  }

  const gaps = [lifeCard, ciCard, ipCard];
  if (kpCard && kpCard.applicable) gaps.push(kpCard);

  return {
    score: _r(total),
    subScores: {
      life: lifeCard.subScore,
      ci: ciCard.subScore,
      ip: ipCard.subScore,
      keyPerson: kpCard?.applicable ? kpCard.subScore : null,
    },
    gaps,
    confidence,
    floorApplied: depCount > 0 && totalCover === 0,
  };
}

/**
 * D4 — Debt Vulnerability (Risk rules v1.1 §6).
 * 3 sub-components: leverage ratio · debt service ratio · rate sensitivity.
 * Max 15.
 *
 * Pre-computes shockInputs.D4 for Shock 4 (§6.3).
 *
 * @param {object} entity
 * @param {object} bundle
 * @returns {{score, subScores, shockInputs, confidence}}
 */
export function D4_computeDebtVulnerability(entity, bundle) {
  _validateEntity(entity);
  const cal = _readBundleRiskCalibration(bundle);
  const liabs = Array.isArray(entity?.liabilities?.items) ? entity.liabilities.items : [];
  const totalDebt = liabs.reduce((s, l) => s + (l.outstandingBalance ?? 0), 0);

  // Total assets per s07 §3.4 — uses netWorth components from MM (D-RISK-D4-LEVERAGE)
  const assets = entity?.assets;
  let totalAssets = 0;
  if (Array.isArray(assets)) {
    totalAssets = assets.reduce((s, a) => s + (a?.value ?? 0), 0);
  } else if (typeof assets === 'object' && assets !== null) {
    totalAssets = Object.values(assets).reduce(
      (s, v) => s + (typeof v === 'number' ? v : 0), 0);
  }
  totalAssets = totalAssets || (entity?.netWorth ?? 0) + totalDebt;

  // Sub-component 1: Leverage ratio (max 5)
  const leverage = totalAssets > 0 ? totalDebt / totalAssets : 1.0;
  let sub1;
  if (leverage < 0.20) sub1 = 5;
  else if (leverage < 0.30) sub1 = 4;
  else if (leverage < 0.45) sub1 = 3;
  else if (leverage < 0.60) sub1 = 2;
  else if (leverage < 0.70) sub1 = 1;
  else sub1 = 0;

  // Sub-component 2: Debt service ratio (max 7)
  const annualDebtSvc = liabs.reduce((s, l) => s + ((l.monthlyPayment ?? 0) * 12), 0);
  const income = entity?.income?.annualGross ?? 0;
  const dsr = income > 0 ? annualDebtSvc / income : 1.0;
  let sub2;
  if (dsr < 0.10) sub2 = 7;
  else if (dsr < 0.15) sub2 = 6;
  else if (dsr < 0.20) sub2 = 5;
  else if (dsr < 0.25) sub2 = 4;
  else if (dsr < 0.30) sub2 = 3;
  else if (dsr < 0.40) sub2 = 2;
  else if (dsr < 0.50) sub2 = 1;
  else sub2 = 0;

  // Sub-component 3: Rate sensitivity (max 3)
  // Variable rate exposure = sum(variable balances) / total
  // FCA PS14/4 exception: fixed expiring within 12 months counts as variable
  const variableBalance = liabs.reduce((s, l) => {
    const isVariable = l.rateType === 'variable' || l.rateType === 'tracker';
    const fixedExpiringSoon = l.rateType === 'fixed'
      && (l.fixedTermExpiryMonths ?? Infinity) <= 12;
    return s + ((isVariable || fixedExpiringSoon) ? (l.outstandingBalance ?? 0) : 0);
  }, 0);
  const variablePct = totalDebt > 0 ? variableBalance / totalDebt : 0;
  let sub3;
  if (variablePct < 0.15) sub3 = 3;
  else if (variablePct < 0.35) sub3 = 2;
  else if (variablePct < 0.65) sub3 = 1;
  else sub3 = 0;

  // Special case: zero debt → max score on all sub-components
  if (totalDebt === 0) {
    return {
      score: 15,
      subScores: { leverage: 5, debtService: 7, rateSensitivity: 3 },
      shockInputs: {
        variable_rate_monthly_service: 0,
        stress_rate_monthly_service: 0,
        monthly_service_increase_200bps: 0,
        fixed_rate_monthly_service: 0,
        total_monthly_service: 0,
        months_to_next_fixed_expiry: Infinity,
      },
      confidence: 'High',
    };
  }

  const total = _clamp(sub1 + sub2 + sub3, 0, 15);

  // Shock inputs (§6.3)
  let varSvc = 0, fixSvc = 0, stressSvc = 0;
  let nextFixExpiry = Infinity;
  for (const l of liabs) {
    const m = l.monthlyPayment ?? 0;
    const isVar = l.rateType === 'variable' || l.rateType === 'tracker';
    if (isVar) {
      varSvc += m;
      // Stress: bump rate by stressBps; recompute monthly payment
      const r = (l.interestRate ?? 0) + cal.rateStressTestBps / 10000;
      const term = l.remainingTermMonths ?? 0;
      const bal = l.outstandingBalance ?? 0;
      let stressed;
      if (term > 0 && r > 0) {
        const mr = r / 12;
        stressed = bal * mr / (1 - Math.pow(1 + mr, -term));
      } else {
        stressed = m;
      }
      stressSvc += stressed;
    } else {
      fixSvc += m;
      if (l.rateType === 'fixed' && typeof l.fixedTermExpiryMonths === 'number') {
        nextFixExpiry = Math.min(nextFixExpiry, l.fixedTermExpiryMonths);
      }
    }
  }
  const totalSvc = varSvc + fixSvc;
  const increase = stressSvc - varSvc;

  const liabilitiesComplete = liabs.length > 0
    && liabs.every(l => typeof l.outstandingBalance === 'number'
      && typeof l.monthlyPayment === 'number'
      && typeof l.rateType === 'string');

  return {
    score: _r(total),
    subScores: { leverage: sub1, debtService: sub2, rateSensitivity: sub3 },
    shockInputs: {
      variable_rate_monthly_service: _r2(varSvc),
      stress_rate_monthly_service: _r2(stressSvc),
      monthly_service_increase_200bps: _r2(increase),
      fixed_rate_monthly_service: _r2(fixSvc),
      total_monthly_service: _r2(totalSvc),
      months_to_next_fixed_expiry: nextFixExpiry,
    },
    confidence: liabilitiesComplete ? 'High' : 'Low',
  };
}

/**
 * D6 — Dependency Exposure (Risk rules v1.1 §8).
 *
 * Default no-deps: D6.score = 9 + (LPA both ? 1 : 0)
 * With deps: questionnaire 5-item summed (max 10)
 *   Will: 0 (none) | 1 (old) | 3 (current)
 *   Pension nominations: 0 | 1 | 2
 *   Life cover in trust: 0 | 1 | 2
 *   LPA: 0 | 1 | 2
 *   Guardian for minor children: 0 | 1 | N/A
 *
 * @param {object} entity
 * @param {number|null} erSignal   T&E estateReadiness signal (cross-check only)
 * @param {object} bundle
 * @returns {{score, subScores, confidence, mode}}
 */
export function D6_computeDependencyExposure(entity, erSignal, bundle) {
  _validateEntity(entity);
  const depCount = entity?.dependants?.count ?? 0;

  if (depCount === 0) {
    const lpa = entity?.lpaStatus === 'both' ? 1 : 0;
    return {
      score: 9 + lpa,
      subScores: { defaultNoDeps: 9, lpaBonus: lpa },
      confidence: 'High',
      mode: 'no_dependants',
    };
  }

  // With dependants — questionnaire model
  const willStatus = entity?.willStatus;
  const willScore = willStatus === 'current_professional' ? 3
                  : willStatus === 'old' ? 1 : 0;

  const nomStatus = entity?.pensionNominationStatus;
  const nomScore = nomStatus === 'all_named' ? 2
                 : nomStatus === 'some' ? 1 : 0;

  const lifeInTrust = entity?.protectionPolicies?.life?.inTrust;
  const hasLife = (entity?.protectionPolicies?.life?.sumAssured ?? 0) > 0;
  const trustScore = lifeInTrust === true ? 2
                   : (hasLife ? 1 : 0);

  const lpaStatus = entity?.lpaStatus;
  const lpaScore = lpaStatus === 'both' ? 2
                 : lpaStatus === 'financial_only' ? 1 : 0;

  const youngestAge = entity?.dependants?.youngestAge ?? null;
  const hasMinor = youngestAge !== null && youngestAge < 18;
  const guardianStatus = entity?.guardianStatus;
  const guardianScore = !hasMinor ? 0
                      : (guardianStatus === 'named' ? 1 : 0);

  const total = _clamp(willScore + nomScore + trustScore + lpaScore + guardianScore, 0, 10);

  // Confidence — Medium if any input missing
  const inputsPresent = [willStatus, nomStatus, lpaStatus,
    typeof lifeInTrust === 'boolean', !hasMinor || guardianStatus !== undefined];
  const missing = inputsPresent.filter(p => p === undefined || p === null
    || p === false && lifeInTrust !== false).length;
  const confidence = missing === 0 ? 'High' : missing > 2 ? 'Low' : 'Medium';

  // erSignal cross-check (Risk rules v1.1 §8.2 — surface conflict to UI)
  const erConflict = (typeof erSignal === 'number' && Number.isFinite(erSignal))
    ? Math.abs((erSignal / 10) - total) > 3
    : false;

  return {
    score: _r(total),
    subScores: {
      will: willScore, nomination: nomScore, lifeInTrust: trustScore,
      lpa: lpaScore, guardian: hasMinor ? guardianScore : 'N/A',
    },
    confidence,
    mode: 'with_dependants',
    erSignalCrossCheck: { value: erSignal ?? null, conflictFlag: erConflict },
  };
}

/**
 * D7 — Behavioural Track Record (Risk rules v1.1 §9 + §14).
 * Tenure-gated, additive with suppression, decay model.
 *
 * @param {object} entity
 * @param {number} [windowMonths]   Default 12
 * @param {object} bundle
 * @returns {{score, available, netUnits, eventSummary, confidence}}
 */
export function D7_computeBTR(entity, windowMonths, bundle) {
  _validateEntity(entity);
  const cal = _readBundleRiskCalibration(bundle);
  const win = windowMonths ?? cal.btrWindowMonths ?? 12;

  // Tenure check
  const created = entity?.createdAt ? new Date(entity.createdAt) : null;
  const tenureMonths = created
    ? Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
    : 0;
  if (tenureMonths < 3) {
    return {
      score: 0,
      available: false,
      netUnits: 0,
      eventSummary: { positive: 0, negative: 0, suppressed: false },
      confidence: 'Low',
      tenureMonths,
      reason: 'Tenure < 3 months — D7 not yet available',
    };
  }

  const cap = tenureMonths < 12 ? 3 : tenureMonths < 24 ? 5 : 7;

  const events = Array.isArray(entity?.btrEvents) ? entity.btrEvents : [];
  const now = Date.now();

  // Walk events with decay model (s07 §3.7)
  let positiveSum = 0;
  let missedDeadlineReductions = 0;
  let positiveCount = 0;
  let negativeCount = 0;
  let suppressed = false;

  for (const ev of events) {
    const ts = new Date(ev.timestamp).getTime();
    const ageMonths = (now - ts) / (1000 * 60 * 60 * 24 * 30.44);
    let decayFactor;
    if (ageMonths < 12) decayFactor = 1.0;
    else if (ageMonths < 24) decayFactor = 0.8;
    else decayFactor = 0.6;

    if (ev.eventType === 'BTR_POSITIVE') {
      positiveSum += (ev.payload?.weight ?? 0) * decayFactor;
      positiveCount++;
    } else if (ev.eventType === 'BTR_NEGATIVE') {
      negativeCount++;
      if (ev.payload?.action === 'deadline_missed') {
        missedDeadlineReductions += 0.5;
      } else if (ev.payload?.action === 'action_dismissed_resurfaced'
              || ev.payload?.action === 'profile_stale_post_life_event'
              || ev.payload?.action === 'document_stale_unrefreshed') {
        suppressed = true;
      }
    }
  }

  // Life-event partial reset (§9.3) — relocated/divorced retain at 70%
  const partialResetEvents = events.filter(ev =>
    ev.eventType === 'D7_PARTIAL_RESET'
    && (ev.payload?.lifeEvent === 'relocated' || ev.payload?.lifeEvent === 'divorced'));
  if (partialResetEvents.length > 0) {
    positiveSum *= 0.70;
  }

  const netUnits = Math.max(0, positiveSum - missedDeadlineReductions);
  const score = _clamp(Math.round(netUnits), 0, cap);

  return {
    score,
    available: true,
    netUnits: _r2(netUnits),
    eventSummary: {
      positive: positiveCount,
      negative: negativeCount,
      suppressed,
      missedDeadlineReductions: _r2(missedDeadlineReductions),
    },
    confidence: tenureMonths < 6 ? 'Low' : (tenureMonths < 12 ? 'Medium' : 'High'),
    tenureMonths,
    cap,
  };
}


// =====================================================================

// =====================================================================
// §G — Shock scenarios (Risk rules v1.1 §12)
// =====================================================================

/**
 * Shock 1 — Job loss (Risk rules v1.1 §12.2).
 * Income stops for `durationMonths` (default 6). UC fallback. Not applicable
 * to retired entities.
 *
 * @param {object} entity
 * @param {object} bundle
 * @param {number} [durationMonths]
 * @returns {{nwImpact, monthlyCashflowShock, monthsSurvived, riskScoreDelta, applicable, notes}}
 */
export function shockJobLoss(entity, bundle, durationMonths = 6) {
  _validateEntity(entity);
  const cal = _readBundleRiskCalibration(bundle);
  if (entity?.lifeStage === 'Decumulation' || entity?.lifeStage === 'Legacy') {
    return {
      applicable: false,
      reason: 'Shock 1 not applicable for retired/decumulation entities — use Shock 3 instead',
    };
  }
  if (Array.isArray(entity?.flags) && entity.flags.includes('director')) {
    return {
      applicable: false,
      reason: 'Director: use Shock 1B (business cashflow crisis) — not yet implemented at v1.0',
    };
  }

  const partner = entity?.partner ?? null;
  const ucMonthly = partner ? cal.ucMonthlyEstimateCouple : cal.ucMonthlyEstimateSingle;

  const essMo = entity?.expenses?.monthlyEssentials ?? 0;
  const debtMo = (entity?.liabilities?.annualDebtService ?? 0) / 12;
  const monthlyShock = ucMonthly - essMo - debtMo;
  const totalImpact = monthlyShock * durationMonths;

  const cash = entity?.cashAndCashEquivalents ?? 0;
  const monthsSurvived = monthlyShock < 0
    ? Math.max(0, Math.floor(cash / Math.abs(monthlyShock)))
    : Infinity;

  return {
    nwImpact: _r(totalImpact),
    monthlyCashflowShock: _r(monthlyShock),
    monthsSurvived: monthsSurvived === Infinity ? null : monthsSurvived,
    durationMonths,
    incomeDuringShock: ucMonthly,
    riskScoreDelta: null, // Filled by calcRisk re-run
    applicable: true,
    notes: [
      'UC monthly estimate is bundle-driven and means-tested — high-NW entities may not qualify',
      'O-RISK-RULES-07: confirm UC amounts at next bundle refresh',
    ],
  };
}

/**
 * Shock 2 — Illness / Critical Illness (Risk rules v1.1 §12.3).
 * 6-month illness; SSP + IP + CI considered.
 */
export function shockIllness(entity, bundle) {
  _validateEntity(entity);
  const cal = _readBundleRiskCalibration(bundle);
  const sspWk = cal.sspWeeklyRate;
  const sspMaxWeeks = cal.sspMaxWeeks;

  const sickPayWeeks = entity?.employment?.sickPayWeeks ?? 0;
  const sickPayRate = entity?.employment?.sickPayRate ?? 0; // 0–1 (0=none, 1=full)
  const monthlyGross = (entity?.income?.annualGross ?? 0) / 12;

  // 6-month window — proportional avg
  const totalWeeks26 = 26;
  const employerSickPayPortion =
    (sickPayRate * monthlyGross * Math.min(sickPayWeeks, totalWeeks26)) / totalWeeks26;
  const sspWeeks = Math.max(0, Math.min(sspMaxWeeks, totalWeeks26) - sickPayWeeks);
  const sspPortion = sspWk * 4.33 * (sspWeeks / totalWeeks26) * (totalWeeks26 / 4.33) / 6;
  // Simplification: sspWk × 4.33 weeks/month × sspWeeks/6mo
  const sspMonthly = sspWk * 4.33 * (sspWeeks / totalWeeks26);

  const ipMonthlyBenefit = entity?.protectionPolicies?.ip?.monthlyBenefit ?? 0;
  const incomeDuringIllness = employerSickPayPortion + sspMonthly + ipMonthlyBenefit;

  const illnessCostMo = cal.illnessCostMonthly;
  const essMo = entity?.expenses?.monthlyEssentials ?? 0;
  const debtMo = (entity?.liabilities?.annualDebtService ?? 0) / 12;
  const monthlyShock = incomeDuringIllness - essMo - debtMo - illnessCostMo;

  const ciPayout = entity?.protectionPolicies?.ci?.sumAssured ?? 0;
  const nwImpact6mo = (monthlyShock * 6) + ciPayout;

  return {
    nwImpact: _r(nwImpact6mo),
    monthlyCashflowShock: _r(monthlyShock),
    incomeDuringIllness: _r(incomeDuringIllness),
    ciPayout: _r(ciPayout),
    ciGap: ciPayout === 0 ? recommendedCICover(entity, bundle).recommended : 0,
    riskScoreDelta: null,
    applicable: true,
    notes: [
      'Illness cost £500/mo broad estimate (Carers UK 2024)',
      'O-RISK-RULES-08: severity-adjustable in v1.x',
    ],
  };
}

/**
 * Shock 3 — Market −30% (Risk rules v1.1 §12.4).
 * Investable non-cash drops 30% (default).
 */
export function shockMarketDrop(entity, bundle, dropPct = 0.30) {
  _validateEntity(entity);
  const investableTotal = entity?.investableAssets?.total ?? 0;
  const cash = entity?.cashAndCashEquivalents ?? 0;
  const investableNonCash = Math.max(0, investableTotal - cash);
  const nwImpact = -(investableNonCash * dropPct);

  // D5 post-shock: at v1.0 apply -30% uniformly to non-cash assets;
  // concentration_signal_post_shock recomputed downstream by calcRisk re-run
  const investablePost = investableTotal + nwImpact;

  return {
    nwImpact: _r(nwImpact),
    nwImpactPct: _r2((nwImpact / Math.max(1, investableTotal)) * 100),
    investableBefore: _r(investableTotal),
    investableAfter: _r(investablePost),
    cashUnaffected: _r(cash),
    riskScoreDelta: null,
    applicable: true,
    notes: ['Cash and near-cash unaffected; equity/bond market exposure only'],
  };
}

/**
 * Shock 4 — Rate +200bps (Risk rules v1.1 §12.5).
 * Variable/tracker debt reprices; fixed within 12mo of expiry treated as variable.
 */
export function shockRateRise(entity, bundle, bps) {
  _validateEntity(entity);
  const cal = _readBundleRiskCalibration(bundle);
  const stressBps = bps ?? cal.rateStressTestBps;

  const liabs = Array.isArray(entity?.liabilities?.items) ? entity.liabilities.items : [];
  let monthlyIncrease = 0;
  let imminentExpiryFlag = false;

  for (const l of liabs) {
    const isVar = l.rateType === 'variable' || l.rateType === 'tracker';
    const fixedExpiringSoon = l.rateType === 'fixed'
      && (l.fixedTermExpiryMonths ?? Infinity) <= 12;

    if (isVar || fixedExpiringSoon) {
      const cur = l.monthlyPayment ?? 0;
      const r = (l.interestRate ?? 0) + stressBps / 10000;
      const term = l.remainingTermMonths ?? 0;
      const bal = l.outstandingBalance ?? 0;
      let stressed;
      if (term > 0 && r > 0) {
        const mr = r / 12;
        stressed = bal * mr / (1 - Math.pow(1 + mr, -term));
      } else {
        stressed = cur;
      }
      monthlyIncrease += (stressed - cur);
      if (fixedExpiringSoon) imminentExpiryFlag = true;
    }
  }
  const annualIncrease = monthlyIncrease * 12;
  const annualDebtSvc = liabs.reduce((s, l) => s + ((l.monthlyPayment ?? 0) * 12), 0);
  const income = entity?.income?.annualGross ?? 0;
  const dtiPostShock = income > 0 ? (annualDebtSvc + annualIncrease) / income : null;

  return {
    monthlyIncrease: _r2(monthlyIncrease),
    annualIncrease: _r2(annualIncrease),
    nwImpact: _r(-annualIncrease),
    dtiPostShock: dtiPostShock !== null ? _r2(dtiPostShock) : null,
    imminentExpiryFlag,
    riskScoreDelta: null,
    applicable: true,
    notes: imminentExpiryFlag
      ? ['One or more fixed-rate items expire within 12 months — surface separate scenario']
      : [],
  };
}

/**
 * Shock 5 — Death of main earner (Risk rules v1.1 §12.6).
 * Calls T&E `ihtDynamic` for IHT impact.
 *
 * @param {object} entity
 * @param {object} bundle
 * @param {function} [ihtDynamicFn]   Optional injected ihtDynamic; default: dynamic import
 */
export function shockDeath(entity, bundle, ihtDynamicFn) {
  _validateEntity(entity);
  const lifePayout = entity?.protectionPolicies?.life?.sumAssured ?? 0;
  const lifeInTrust = entity?.protectionPolicies?.life?.inTrust === true;

  // Conservative at v1.0: assume payout to estate (O-RISK-RULES-09)
  const includesLifePayout = !lifeInTrust;
  const estateAddition = includesLifePayout ? lifePayout : 0;

  let ihtLiability = 0;
  let ihtNote = null;
  if (typeof ihtDynamicFn === 'function') {
    try {
      const post = ihtDynamicFn(
        { ...entity,
          netWorth: (entity?.netWorth ?? 0) + estateAddition,
          // includeSipp toggle handled by ihtDynamic internally based on bundle date
        },
        { includeSipp: true },
        bundle
      );
      ihtLiability = post?.totalIht ?? post?.ihtLiability ?? 0;
    } catch (e) {
      ihtNote = 'ihtDynamic call failed: ' + e.message;
    }
  } else {
    ihtNote = 'ihtDynamicFn not injected — IHT estimate unavailable; pass T&E ihtDynamic via DI';
  }

  const survivorIncome = entity?.income?.statePensionSurvivor ?? 0;
  const partner = entity?.partner;
  const partnerIncome = partner?.income?.annualGross ?? 0;

  const nwBefore = entity?.netWorth ?? 0;
  const nwAfter = nwBefore - ihtLiability + lifePayout;
  const nwImpact = nwAfter - nwBefore;

  return {
    nwImpact: _r(nwImpact),
    ihtLiability: _r(ihtLiability),
    lifeAssurancePayout: _r(lifePayout),
    lifeInTrust,
    survivorAnnualIncome: _r(survivorIncome + partnerIncome),
    survivorMonthlyIncome: _r((survivorIncome + partnerIncome) / 12),
    riskScoreDelta: null,
    applicable: true,
    notes: [
      lifeInTrust
        ? 'Life cover in trust — payout bypasses estate'
        : 'Life cover NOT in trust — payout falls into estate (conservative assumption per O-RISK-RULES-09)',
      ihtNote,
    ].filter(Boolean),
  };
}

/**
 * Combined shock — v1.x stub.
 */
export function runCombinedShock(entity, shockIds, bundle) {
  return {
    status: 'OPEN',
    reason: 'Combined shock orchestration v1.x — single shocks individually computable',
    shockIds,
  };
}


// =====================================================================
// §H — Life-event reopen matrix (Risk rules v1.1 §13)
// =====================================================================

const _LIFE_EVENT_DIM_MATRIX = Object.freeze({
  marriage: { dimensionIds: ['D3', 'D6'], priority: 'Medium' },
  divorce: { dimensionIds: ['D3', 'D4', 'D6'], priority: 'High' },
  child_birth: { dimensionIds: ['D3', 'D6'], priority: 'High' },
  dependant_death: { dimensionIds: ['D3', 'D6'], priority: 'High' },
  partner_death: { dimensionIds: ['D1', 'D3', 'D4', 'D6'], priority: 'Critical' },
  employment_change_self_emp: { dimensionIds: ['D1', 'D3'], priority: 'High' },
  employment_change_employed: { dimensionIds: ['D1', 'D3'], priority: 'Medium' },
  redundancy: { dimensionIds: ['D1', 'D2', 'D3'], priority: 'High' },
  jurisdiction_move: { dimensionIds: ['D1', 'D3', 'D4', 'D5', 'D6'], priority: 'High' },
  property_purchase: { dimensionIds: ['D4', 'D5', 'D2'], priority: 'Medium' },
  property_sale: { dimensionIds: ['D2', 'D4', 'D5'], priority: 'Medium' },
  inheritance: { dimensionIds: ['D2', 'D5', 'D6'], priority: 'Medium' },
  serious_illness: { dimensionIds: ['D1', 'D2', 'D3'], priority: 'High' },
  retirement: { dimensionIds: ['D1', 'D3', 'D4', 'D6'], priority: 'High' },
  business_sale: { dimensionIds: ['D4', 'D5', 'D6'], priority: 'High' },
  pension_crystallisation: { dimensionIds: ['D1', 'D2'], priority: 'Medium' },
});

/**
 * lifeEventReopen — return affected dimension IDs + priority for a life-event subtype.
 * @param {object} entity   Entity (used to filter applicability — v1 returns matrix)
 * @param {string} lifeEventSubtype
 * @returns {{dimensionIds, priority, lifeEventSubtype, recognised}}
 */
export function lifeEventReopen(entity, lifeEventSubtype) {
  if (!lifeEventSubtype || typeof lifeEventSubtype !== 'string') {
    return { dimensionIds: [], priority: 'Low', lifeEventSubtype, recognised: false };
  }
  const m = _LIFE_EVENT_DIM_MATRIX[lifeEventSubtype];
  if (!m) {
    return { dimensionIds: [], priority: 'Low', lifeEventSubtype, recognised: false };
  }
  return {
    dimensionIds: [...m.dimensionIds],
    priority: m.priority,
    lifeEventSubtype,
    recognised: true,
  };
}


// =====================================================================
// §I — projectBTR (Risk rules v1.1 §9.5)
// =====================================================================

const _BTR_LEVEL_PROFILES = Object.freeze({
  low: { positive: [{ count: 1, weight: 0.3 }], negative: [{ count: 1 }] },
  medium: { positive: [{ count: 2, weight: 0.3 }, { count: 1, weight: 0.1 }], negative: [] },
  high: { positive: [{ count: 3, weight: 0.3 }, { count: 1, weight: 0.5 }], negative: [] },
});

/**
 * projectBTR — prospective D7 simulation under three engagement levels.
 *
 * @param {object} entity
 * @param {number} months
 * @param {string} engagementLevel   'low' | 'medium' | 'high'
 * @returns {{projected3mo, projected6mo, projected12mo, level}}
 */
export function projectBTR(entity, months, engagementLevel) {
  _validateEntity(entity);
  const profile = _BTR_LEVEL_PROFILES[engagementLevel?.toLowerCase()]
                ?? _BTR_LEVEL_PROFILES.medium;
  const monthlyPositive = profile.positive.reduce(
    (s, b) => s + b.count * b.weight, 0);

  // Project from current accumulated BTR (use cap-aware arithmetic; D7 capped at 7)
  const project = (mo) => Math.min(7, monthlyPositive * mo);

  return {
    projected3mo: _r2(project(3)),
    projected6mo: _r2(project(6)),
    projected12mo: _r2(project(12)),
    level: engagementLevel ?? 'medium',
  };
}


// =====================================================================
// §J — Action set + confidence
// =====================================================================

/**
 * determineConfidence — overall = min of dimension confidences (Risk rules v1.1 §11.5).
 */
export function determineConfidence(dimensions) {
  if (!dimensions || typeof dimensions !== 'object') return 'Low';
  const levels = ['Low', 'Medium', 'High'];
  let minIdx = 2;
  for (const k of Object.keys(dimensions)) {
    const c = dimensions[k]?.confidence;
    const idx = levels.indexOf(c);
    if (idx >= 0) minIdx = Math.min(minIdx, idx);
  }
  return levels[minIdx];
}

/**
 * riskActionSet — top-N actions sorted by score delta.
 * Walks each dimension's improvement actions and prioritises by gain.
 *
 * @param {object} entity
 * @param {object} bundle
 * @param {number} [n]   Default 3 (Zone 9 default)
 * @returns {Array<{actionId, dimensionId, label, scoreDelta, confidence}>}
 */
export function riskActionSet(entity, bundle, n = 3) {
  _validateEntity(entity);
  const actions = [];

  // D3 protection gaps (largest delta opportunity for under-protected entities)
  const d3 = D3_computeProtectionCoverage(entity, bundle);
  for (const gap of d3.gaps) {
    if (gap.applicable !== false && gap.scoreDelta > 0) {
      actions.push({
        actionId: `close_${gap.coverageType}_gap`,
        dimensionId: 'D3',
        label: `Close ${gap.coverageType} cover gap (£${gap.gap.toLocaleString()})`,
        scoreDelta: gap.scoreDelta,
        confidence: 'Medium',
      });
    }
  }

  // D2 liquidity (if low)
  const liq = entity?.cashAndCashEquivalents ?? 0;
  const essMo = entity?.expenses?.monthlyEssentials ?? 0;
  if (essMo > 0) {
    const months = liq / essMo;
    const cal = _readBundleRiskCalibration(bundle);
    const target = cal.liquidityTargetByLifeStage?.[entity?.lifeStage ?? 'Consolidation']?.default
                   ?? cal.liquidityTargetMonths;
    if (months < target) {
      const monthsShortfall = target - months;
      actions.push({
        actionId: 'build_emergency_fund',
        dimensionId: 'D2',
        label: `Build emergency fund to ${target} months (currently ${months.toFixed(1)})`,
        scoreDelta: Math.min(18 - D2_mapLiquidityBuffer(months,
          entity?.lifeStage ?? 'Consolidation', 'default', bundle), 5),
        confidence: 'Medium',
        estimatedCost: _r(monthsShortfall * essMo),
      });
    }
  }

  // D4 debt
  const d4 = D4_computeDebtVulnerability(entity, bundle);
  if (d4.subScores.rateSensitivity < 3) {
    actions.push({
      actionId: 'fix_variable_debt',
      dimensionId: 'D4',
      label: 'Refinance variable debt to fixed-rate',
      scoreDelta: 3 - d4.subScores.rateSensitivity,
      confidence: 'Medium',
    });
  }

  // D6 estate-readiness items (will, LPA, nominations)
  const d6 = D6_computeDependencyExposure(entity, null, bundle);
  if (d6.mode === 'with_dependants') {
    if ((d6.subScores.will ?? 0) < 3) {
      actions.push({
        actionId: 'update_will',
        dimensionId: 'D6',
        label: 'Draft or update will (professional)',
        scoreDelta: 3 - (d6.subScores.will ?? 0),
        confidence: 'High',
      });
    }
    if ((d6.subScores.lpa ?? 0) < 2) {
      actions.push({
        actionId: 'set_up_lpa',
        dimensionId: 'D6',
        label: 'Set up LPA (Property & Financial + Health & Welfare)',
        scoreDelta: 2 - (d6.subScores.lpa ?? 0),
        confidence: 'High',
      });
    }
  } else {
    if ((d6.subScores.lpaBonus ?? 0) === 0) {
      actions.push({
        actionId: 'set_up_lpa',
        dimensionId: 'D6',
        label: 'Set up LPA (Property & Financial + Health & Welfare)',
        scoreDelta: 1,
        confidence: 'High',
      });
    }
  }

  // Sort by scoreDelta descending and return top-n
  actions.sort((a, b) => b.scoreDelta - a.scoreDelta);
  return actions.slice(0, n);
}


// =====================================================================
// §C — calcRisk (master orchestrator) (Risk rules v1.1 §1.2 + §1.3)
// =====================================================================

/**
 * calcRisk — master Risk Score computation.
 *
 * Cross-reads CF / MM / T&E engine outputs via injected functions (DI pattern,
 * parallel to D-COI-HANDLER-INJECTION-1). Caller supplies ctx with engine
 * function references rather than risk engine importing them directly,
 * preventing circular dependencies (cashflow consumes risk; risk would consume
 * cashflow if direct-imported).
 *
 * @param {object} entity
 * @param {object} bundle
 * @param {string} [correlationId]   Per Risk rules v1.1 §10.5
 * @param {object} [ctx]   Cross-engine function injection:
 *                         { cashflowHealthFn, liquidityBufferFn,
 *                           concentrationRiskFn, estateReadinessFn,
 *                           ihtDynamicFn }
 *
 * @returns {object}   Full calcRisk return shape (Risk rules v1.1 §1.3)
 */
export function calcRisk(entity, bundle, correlationId, ctx) {
  _validateEntity(entity);
  if (!bundle) throw new Error('uk-risk.calcRisk: bundle required');

  const fns = ctx ?? {};

  // --- D1 (cross-read with fallback)
  let d1Score, d1Conf, d1Inputs;
  if (typeof fns.cashflowHealthFn === 'function') {
    try {
      const cfh = fns.cashflowHealthFn(entity, bundle);
      const sig = cfh?.components?.incomeResilience
                ?? cfh?.value?.components?.incomeResilience;
      if (typeof sig === 'number') {
        d1Score = D1_mapIncomeResilience(sig);
        d1Conf = 'High';
        d1Inputs = { cfSignal: sig };
      } else {
        const fb = D1_fallback(entity);
        d1Score = fb.score; d1Conf = fb.confidence; d1Inputs = { fallback: true };
      }
    } catch (e) {
      const fb = D1_fallback(entity);
      d1Score = fb.score; d1Conf = fb.confidence;
      d1Inputs = { fallback: true, cfError: e.message };
    }
  } else {
    const fb = D1_fallback(entity);
    d1Score = fb.score; d1Conf = fb.confidence; d1Inputs = { fallback: true };
  }

  // --- D2 (cross-read with fallback)
  let d2Score, d2Conf, d2Inputs;
  if (typeof fns.liquidityBufferFn === 'function') {
    try {
      const lb = fns.liquidityBufferFn(entity, bundle);
      const months = lb?.months ?? lb?.value?.months ?? lb?.value;
      if (typeof months === 'number') {
        const householdType = (entity?.dependants?.count ?? 0) > 0 || entity?.partner
          ? 'couple_or_deps' : 'single_no_deps';
        d2Score = D2_mapLiquidityBuffer(
          months, entity?.lifeStage ?? 'Consolidation', householdType, bundle);
        d2Conf = 'High';
        d2Inputs = { months, lifeStage: entity?.lifeStage, householdType };
      } else {
        const fb = D2_fallback(entity, bundle);
        d2Score = fb.score; d2Conf = fb.confidence; d2Inputs = { fallback: true };
      }
    } catch (e) {
      const fb = D2_fallback(entity, bundle);
      d2Score = fb.score; d2Conf = fb.confidence;
      d2Inputs = { fallback: true, cfError: e.message };
    }
  } else {
    const fb = D2_fallback(entity, bundle);
    d2Score = fb.score; d2Conf = fb.confidence; d2Inputs = { fallback: true };
  }

  // --- D3 (direct compute)
  const d3 = D3_computeProtectionCoverage(entity, bundle);

  // --- D4 (direct compute)
  const d4 = D4_computeDebtVulnerability(entity, bundle);

  // --- D5 (cross-read with fallback)
  let d5Score, d5Conf, d5Inputs;
  if (typeof fns.concentrationRiskFn === 'function') {
    try {
      const cr = fns.concentrationRiskFn(entity, bundle);
      const sig = cr?.signal ?? cr?.value?.signal ?? cr?.value;
      if (typeof sig === 'number') {
        d5Score = D5_mapConcentration(sig);
        d5Conf = 'High';
        d5Inputs = { signal: sig };
      } else {
        const fb = D5_fallback(entity);
        d5Score = fb.score; d5Conf = fb.confidence; d5Inputs = { fallback: true };
      }
    } catch (e) {
      const fb = D5_fallback(entity);
      d5Score = fb.score; d5Conf = fb.confidence;
      d5Inputs = { fallback: true, cfError: e.message };
    }
  } else {
    const fb = D5_fallback(entity);
    d5Score = fb.score; d5Conf = fb.confidence; d5Inputs = { fallback: true };
  }

  // --- D6 (direct compute, cross-check with T&E erSignal)
  let erSignal = null;
  if (typeof fns.estateReadinessFn === 'function') {
    try {
      const er = fns.estateReadinessFn(entity, bundle);
      erSignal = er?.signal ?? er?.value?.signal ?? er?.value ?? null;
    } catch (e) {
      erSignal = null;
    }
  }
  const d6 = D6_computeDependencyExposure(entity, erSignal, bundle);

  // --- D7 (event-store-driven)
  const d7 = D7_computeBTR(entity, undefined, bundle);

  // Total
  const score = _clamp(_r(d1Score + d2Score + d3.score + d4.score + d5Score + d6.score + d7.score), 0, 100);
  const band = riskBand(score);

  const dimensions = {
    D1: { score: d1Score, max: 20, confidence: d1Conf, inputs: d1Inputs },
    D2: { score: d2Score, max: 18, confidence: d2Conf, inputs: d2Inputs },
    D3: { score: d3.score, max: 18, confidence: d3.confidence, inputs: { subScores: d3.subScores }, gaps: d3.gaps },
    D4: { score: d4.score, max: 15, confidence: d4.confidence, inputs: { subScores: d4.subScores } },
    D5: { score: d5Score, max: 12, confidence: d5Conf, inputs: d5Inputs },
    D6: { score: d6.score, max: 10, confidence: d6.confidence, inputs: { subScores: d6.subScores, mode: d6.mode } },
    D7: { score: d7.score, max: 7, confidence: d7.confidence, inputs: { eventSummary: d7.eventSummary, tenureMonths: d7.tenureMonths } },
  };

  const overallConfidence = determineConfidence(dimensions);
  const actionSet = riskActionSet(entity, bundle, 3);

  return {
    score,
    band,
    dimensions,
    confidence: overallConfidence,
    actionSet,
    shockInputs: { D4: d4.shockInputs },
    computedAt: new Date().toISOString(),
    correlationId: correlationId ?? null,
    bundleVersion: bundle?._meta?.version ?? bundle?.version ?? 'unknown',
  };
}


// =====================================================================
// §N — Cashflow consumer wires (replace v1 stand-ins via DI at Phase 4)
// =====================================================================

/**
 * sequenceOfReturnsRisk — Cholesky-MC replacement for cashflow §8.4 v1 stand-in.
 *
 * Uses CMA bundle correlation matrix + asset means/vols to run multi-asset
 * Monte Carlo, computing the empirical p10 lifetime-trajectory drawdown depth
 * vs median. Replaces the static p10 ≈ mean − 1.28σ approximation in the v1
 * stand-in (uk-cashflow §8.4 v1 limitation).
 *
 * @param {object} entity
 * @param {object} cma   UK-CMA bundle
 * @param {number} [mcRuns]   Default per D-CF-V1-MC-DEFAULT (1000)
 * @returns {{value, breakdown, rules, explanation}}
 */
export function sequenceOfReturnsRisk(entity, cma, mcRuns = 1000) {
  if (!cma) return _err('cma bundle required', ['cma']);
  const corr = cma?.correlationMatrix;
  if (!corr || !Array.isArray(corr.matrix) || !Array.isArray(corr.assetClasses)) {
    return _err('cma.correlationMatrix missing or malformed', ['cma.correlationMatrix']);
  }

  const assetClasses = corr.assetClasses;
  // Map asset class → mean + std from CMA
  const assetMeta = {};
  const eq = cma.equityReturns ?? {};
  const bonds = cma.bondReturns ?? {};
  if (eq.uk) assetMeta.uk_equity = { mean: eq.uk.mean, std: eq.uk.std_dev };
  if (eq.global) assetMeta.global_equity_ex_uk = { mean: eq.global.mean, std: eq.global.std_dev };
  if (eq.emerging) assetMeta.em_equity = { mean: eq.emerging.mean, std: eq.emerging.std_dev };
  if (bonds.short) assetMeta.uk_gilts_short = { mean: bonds.short.mean, std: bonds.short.std_dev };
  if (bonds.medium) assetMeta.uk_gilts_medium = { mean: bonds.medium.mean, std: bonds.medium.std_dev };
  if (bonds.corporateCredit) assetMeta.uk_corp_credit = { mean: bonds.corporateCredit.mean, std: bonds.corporateCredit.std_dev };
  if (cma.propertyGrowthRate?.value !== undefined) {
    assetMeta.property_reit = { mean: cma.propertyGrowthRate.value, std: cma.propertyGrowthRate.std_dev ?? 0.18 };
  } else {
    assetMeta.property_reit = { mean: 0.012, std: 0.18 };
  }
  if (cma.cashRate?.rate !== undefined) {
    assetMeta.cash = { mean: cma.cashRate.rate, std: 0.005 };
  } else {
    assetMeta.cash = { mean: 0.0375, std: 0.005 };
  }

  const means = assetClasses.map(a => assetMeta[a]?.mean ?? 0);
  const stds = assetClasses.map(a => assetMeta[a]?.std ?? 0);
  const cov = buildCovarianceMatrix(stds, corr.matrix, 'cma.correlationMatrix.matrix');
  const L = choleskyDecompose(cov, 'cma.correlationMatrix.matrix');

  // Portfolio allocation (default uniform if not specified)
  const alloc = entity?.portfolioAllocation ?? {};
  const weights = assetClasses.map(a => alloc[a] ?? 0);
  const sumWeights = weights.reduce((s, w) => s + w, 0);
  const normalisedWeights = sumWeights > 0
    ? weights.map(w => w / sumWeights)
    : assetClasses.map(() => 1 / assetClasses.length);

  // Run MC: each year, sample correlated returns; compute portfolio return
  // Cashflow integration test: portfolio value over horizon
  const startValue = (entity?.investableAssets?.total ?? 0) || 100000; // fallback
  const targetIncome = entity?.targetIncomeReal ?? startValue * 0.04;
  const horizon = entity?.cashflowHorizonYears ?? 30;
  const rng = mulberry32(42); // deterministic seed for reproducibility per Risk rules §1.2
  const inflation = cma?.inflationPath?.[0]?.cpi ?? 0.02;

  const finalValues = new Array(mcRuns);
  const minValues = new Array(mcRuns);
  for (let r = 0; r < mcRuns; r++) {
    let val = startValue;
    let minVal = startValue;
    for (let yr = 0; yr < horizon; yr++) {
      const sample = sampleMultivariateNormalFromChol(means, L, rng);
      const portReturn = normalisedWeights.reduce((s, w, i) => s + w * sample[i], 0);
      const realReturn = (1 + portReturn) / (1 + inflation) - 1;
      val = val * (1 + realReturn) - targetIncome;
      if (val <= 0) { val = 0; minVal = 0; break; }
      minVal = Math.min(minVal, val);
    }
    finalValues[r] = val;
    minValues[r] = minVal;
  }

  const finalSummary = summarise(finalValues);
  const minSummary = summarise(minValues);
  const probDepletion = probBelow(finalValues, 0.01);

  return {
    value: finalSummary.median,
    breakdown: {
      mcRuns,
      horizon,
      finalValue: finalSummary,
      minTrajectoryValue: minSummary,
      probabilityOfDepletion: probDepletion,
      portfolioWeights: Object.fromEntries(assetClasses.map((a, i) => [a, normalisedWeights[i]])),
      assetMeans: Object.fromEntries(assetClasses.map((a, i) => [a, means[i]])),
      assetStds: Object.fromEntries(assetClasses.map((a, i) => [a, stds[i]])),
      cmaConfidence: cma?.effective_until ?? null,
    },
    rules: ['Risk rules v1.1 §1 · CF v1.6 §8.4 · Cholesky-MC sequence-of-returns', 'BENGEN-94', 'GLASSER §2.3'],
    explanation:
      `Multi-asset Cholesky-MC (${mcRuns} runs, ${horizon}y horizon). ` +
      `Median final value £${_r(finalSummary.median).toLocaleString()}. ` +
      `P(depletion) = ${(probDepletion * 100).toFixed(1)}%.`,
  };
}

/**
 * maxDrawdownVolatility — CMA-vol-derived max drawdown for cashflow §8.6.
 * Replaces the static historical-DD assumptions in the v1 stand-in.
 *
 * Uses CMA std_dev × 2.5 as a 1-in-100 single-period drawdown estimate
 * (approximation: ~2.5σ corresponds to ~99th percentile single-period loss
 * for a normal-return distribution, calibrated against historical maximum
 * drawdown observations).
 *
 * @param {object} entity
 * @param {object} cma
 * @returns {{value, breakdown, rules, explanation}}
 */
export function maxDrawdownVolatility(entity, cma) {
  if (!cma) return _err('cma bundle required', ['cma']);
  const portfolio = entity?.portfolioAllocation ?? {};
  const corr = cma?.correlationMatrix;
  if (!corr) return _err('cma.correlationMatrix missing', ['cma.correlationMatrix']);

  // Build vol vector and weight vector aligned to CMA asset classes
  const assetClasses = corr.assetClasses;
  const eq = cma.equityReturns ?? {};
  const bonds = cma.bondReturns ?? {};
  const stdMap = {
    uk_equity: eq.uk?.std_dev,
    global_equity_ex_uk: eq.global?.std_dev,
    em_equity: eq.emerging?.std_dev,
    uk_gilts_short: bonds.short?.std_dev,
    uk_gilts_medium: bonds.medium?.std_dev,
    uk_corp_credit: bonds.corporateCredit?.std_dev,
    property_reit: cma.propertyGrowthRate?.std_dev ?? 0.18,
    cash: 0.005,
  };
  const stds = assetClasses.map(a => stdMap[a] ?? 0);
  const weights = assetClasses.map(a => portfolio[a] ?? 0);
  const sumW = weights.reduce((s, w) => s + w, 0);
  const w = sumW > 0 ? weights.map(x => x / sumW) : assetClasses.map(() => 1 / assetClasses.length);

  // Portfolio variance via w^T · Σ · w
  const cov = buildCovarianceMatrix(stds, corr.matrix);
  let variance = 0;
  for (let i = 0; i < w.length; i++) {
    for (let j = 0; j < w.length; j++) {
      variance += w[i] * w[j] * cov[i][j];
    }
  }
  const portVol = Math.sqrt(Math.max(0, variance));
  // Approximate max DD ≈ 2.5σ (historical equity ~45% DD vs ~16% σ → ratio ~2.8;
  // bonds ~12% DD vs ~6% σ → ratio ~2). Use 2.5 as a balanced estimate.
  const impliedMaxDD = portVol * 2.5;

  const stated = entity?.statedDrawdownTolerance ?? null;
  const gap = stated !== null ? impliedMaxDD - stated : null;

  return {
    value: impliedMaxDD,
    breakdown: {
      portfolioVolatility: _r2(portVol),
      impliedMaxDD: _r2(impliedMaxDD),
      multiplier: 2.5,
      statedTolerance: stated,
      gap: gap !== null ? _r2(gap) : null,
      portfolioWeights: Object.fromEntries(assetClasses.map((a, i) => [a, w[i]])),
    },
    rules: ['Risk rules v1.1 · CF v1.6 §8.6 · CMA-vol-derived DD'],
    explanation:
      `Portfolio vol ${(portVol * 100).toFixed(1)}%; implied max DD ${(impliedMaxDD * 100).toFixed(0)}%${stated !== null ? ` vs stated tolerance ${(stated * 100).toFixed(0)}% (gap ${gap > 0 ? '+' : ''}${(gap * 100).toFixed(0)}%)` : ''}.`,
  };
}

/**
 * mvPortfolioFrontier — mean-variance frontier point for cashflow §8.7.
 * Replaces the v1 Sharpe-only stand-in with a two-asset frontier search.
 *
 * v1 simplification: searches the equity/bond mix (across CMA asset classes
 * weighted by portfolio.equity_share vs portfolio.bond_share) for the Sharpe-
 * maximising point using CMA correlations. Full multi-asset frontier search
 * deferred to v2 (would require quadratic optimisation library).
 *
 * @param {object} entity
 * @param {object} cma
 * @returns {{value, breakdown, rules, explanation}}
 */
export function mvPortfolioFrontier(entity, cma) {
  if (!cma) return _err('cma bundle required', ['cma']);
  const corr = cma?.correlationMatrix;
  if (!corr) return _err('cma.correlationMatrix missing', ['cma.correlationMatrix']);

  // Compute current portfolio Sharpe + frontier via grid search over equity/bond weight
  const giltYields = cma?.giltYields ?? [];
  const inflation = cma?.inflationPath?.[0]?.cpi ?? 0.02;
  const rf10 = (giltYields.find(g => g.duration_years === 10)?.yield) ?? 0.04;
  const rfReal = (1 + rf10) / (1 + inflation) - 1;

  const eqMean = cma?.equityReturns?.uk?.mean ?? 0.058;
  const eqStd = cma?.equityReturns?.uk?.std_dev ?? 0.155;
  const bondMean = cma?.bondReturns?.medium?.mean ?? 0.042;
  const bondStd = cma?.bondReturns?.medium?.std_dev ?? 0.062;

  const eqRho_bond = corr.matrix[0]?.[4] ?? -0.05; // uk_equity vs uk_gilts_medium
  const eqReal = (1 + eqMean) / (1 + inflation) - 1;
  const bondReal = (1 + bondMean) / (1 + inflation) - 1;

  // Grid search Sharpe-optimal mix
  let bestMix = 0.6, bestSharpe = -Infinity;
  for (let we = 0; we <= 1; we += 0.05) {
    const wb = 1 - we;
    const ret = we * eqReal + wb * bondReal;
    const variance = we * we * eqStd * eqStd + wb * wb * bondStd * bondStd
                   + 2 * we * wb * eqStd * bondStd * eqRho_bond;
    const vol = Math.sqrt(Math.max(0, variance));
    const sharpe = vol > 0 ? (ret - rfReal) / vol : -Infinity;
    if (sharpe > bestSharpe) { bestSharpe = sharpe; bestMix = we; }
  }

  // Current entity portfolio
  const portfolio = entity?.portfolioAllocation ?? {};
  const eqWeight = (portfolio.uk_equity ?? 0) + (portfolio.global_equity_ex_uk ?? 0)
                 + (portfolio.em_equity ?? 0);
  const bondWeight = (portfolio.uk_gilts_short ?? 0) + (portfolio.uk_gilts_medium ?? 0)
                   + (portfolio.uk_corp_credit ?? 0);
  const totalEqBond = eqWeight + bondWeight;
  const eqShare = totalEqBond > 0 ? eqWeight / totalEqBond : 0;

  const portRet = eqShare * eqReal + (1 - eqShare) * bondReal;
  const portVar = eqShare * eqShare * eqStd * eqStd
                + (1 - eqShare) * (1 - eqShare) * bondStd * bondStd
                + 2 * eqShare * (1 - eqShare) * eqStd * bondStd * eqRho_bond;
  const portVol = Math.sqrt(Math.max(0, portVar));
  const portSharpe = portVol > 0 ? (portRet - rfReal) / portVol : 0;

  return {
    value: portSharpe,
    breakdown: {
      portfolioSharpe: _r2(portSharpe),
      frontierSharpe: _r2(bestSharpe),
      frontierEquityMix: _r2(bestMix),
      currentEquityShare: _r2(eqShare),
      sharpeImprovementAvailable: _r2(bestSharpe - portSharpe),
      riskFreeReal: _r2(rfReal),
    },
    rules: ['Risk rules v1.1 · CF v1.6 §8.7 · two-asset MV frontier (eq/bond grid search)'],
    explanation:
      `Sharpe ${portSharpe.toFixed(2)} at ${(eqShare * 100).toFixed(0)}% equity vs frontier max ${bestSharpe.toFixed(2)} at ${(bestMix * 100).toFixed(0)}% equity. v1: two-asset (eq/bond) grid; full multi-asset frontier deferred to v2.`,
  };
}


// =====================================================================
// §M — buildRiskCoIExtras (foundation §15.3 binding)
// =====================================================================

/**
 * buildRiskCoIExtras — per-engine extras builder per foundation v1.11 §15.3.
 * Documents the keys risk-engine handlers expect when called via the canonical
 * CoI extras pattern.
 *
 * Keys set:
 *   cma             — CMA bundle (for portfolioRebalancing + sequenceOfReturns hedging)
 *   horizonYears    — override (typical: longevity − currentAge)
 *   currentAge      — entity age
 *
 * @param {object} entity
 * @param {object} cma
 * @returns {object}   extras object suitable for costOfInaction(...) 5th arg
 */
export function buildRiskCoIExtras(entity, cma) {
  const age = _ageOf(entity);
  const longevity = entity?.longevityAge ?? 92;
  const horizon = (age !== null) ? Math.max(1, longevity - age) : 25;
  return {
    cma,
    horizonYears: horizon,
    currentAge: age,
  };
}


// =====================================================================
// §L — Risk-engine canonical CoI handlers (foundation §15.3)
// =====================================================================

/**
 * portfolioRebalancingHandler — canonical CoI handler for `'portfolioRebalancing'`
 * domain. Returns the present-value cost of staying in a sub-optimal allocation
 * vs Sharpe-optimal mix.
 *
 * Conforms to canonical handler contract (foundation §10.12 D-COI-HANDLER-INJECTION-1):
 *   handler(entity, bundle, ctx) → {status, currentPath, optimalPath, action, rules, notes?}
 *
 * Uses ctx.cma (passed via extras per foundation §15.3) when available.
 */
export function portfolioRebalancingHandler(entity, bundle, ctx) {
  if (!entity) {
    return {
      status: 'NOT_APPLICABLE',
      currentPath: [0], optimalPath: [0],
      action: { currentDescription: 'no entity', optimalDescription: 'n/a', outcome: 'no calc' },
      rules: ['Risk rules v1.1 · D5 concentration / portfolio efficiency'],
      notes: 'no entity supplied',
    };
  }
  const cma = ctx?.cma;
  if (!cma) {
    return {
      status: 'OPEN',
      currentPath: [0], optimalPath: [0],
      action: { currentDescription: 'unknown allocation', optimalDescription: 'unknown frontier', outcome: 'unknown' },
      rules: ['Risk rules v1.1 · foundation §15.3 extras pattern'],
      notes: 'cma not provided in extras (use buildRiskCoIExtras)',
    };
  }
  const horizon = ctx?.horizonYears ?? 25;
  const investable = entity?.investableAssets?.total ?? 0;
  if (investable <= 0) {
    return {
      status: 'NOT_APPLICABLE',
      currentPath: [0], optimalPath: [0],
      action: { currentDescription: 'no investable assets', optimalDescription: 'n/a', outcome: 'no rebalance' },
      rules: ['Risk rules v1.1'],
    };
  }

  const frontier = mvPortfolioFrontier(entity, cma);
  if (frontier.status === 'INSUFFICIENT_DATA') {
    return {
      status: 'OPEN',
      currentPath: [0], optimalPath: [0],
      action: { currentDescription: 'insufficient cma data', optimalDescription: 'n/a', outcome: 'unknown' },
      rules: ['Risk rules v1.1'],
      notes: 'frontier insufficient data',
    };
  }
  const sharpeImprovement = frontier.breakdown?.sharpeImprovementAvailable ?? 0;
  const portVol = frontier.breakdown?.portfolioSharpe !== undefined
    ? Math.max(0, frontier.value > 0 ? frontier.breakdown.frontierSharpe / Math.max(0.001, frontier.value) : 0)
    : 0;

  // Approximate annual return improvement = sharpeImprovement × portfolio_vol_estimate
  // Use 0.10 (10%) as proxy portfolio vol if not derivable
  const annualImprovement = sharpeImprovement * 0.10;
  const annualValueImprovement = investable * annualImprovement;

  const currentPath = new Array(horizon).fill(-investable * 0.0); // status quo
  const optimalPath = new Array(horizon).fill(annualValueImprovement);

  return {
    status: sharpeImprovement > 0.05 ? 'IMPLEMENTED' : 'NOT_APPLICABLE',
    currentPath,
    optimalPath,
    action: {
      currentDescription: `Current portfolio Sharpe ${frontier.breakdown.portfolioSharpe}; equity share ${(frontier.breakdown.currentEquityShare * 100).toFixed(0)}%`,
      optimalDescription: `Frontier-optimal at ${(frontier.breakdown.frontierEquityMix * 100).toFixed(0)}% equity (Sharpe ${frontier.breakdown.frontierSharpe})`,
      outcome: sharpeImprovement > 0
        ? `Estimated annual return uplift ~£${_r(annualValueImprovement).toLocaleString()} from rebalance`
        : 'Already at or above frontier — no rebalance benefit',
    },
    rules: ['Risk rules v1.1 §7 · CF v1.6 §8.7 · two-asset MV frontier'],
    notes: 'v1 two-asset (eq/bond) frontier; full multi-asset deferred to v2',
  };
}

/**
 * sequenceOfReturnsHedgingHandler — canonical CoI handler for
 * `'sequenceOfReturnsHedging'` domain. Returns PV of mitigation savings
 * available by establishing a cash-bucket / floor-upside structure that
 * defends against sequence-of-returns risk in early decumulation.
 */
export function sequenceOfReturnsHedgingHandler(entity, bundle, ctx) {
  if (!entity) {
    return {
      status: 'NOT_APPLICABLE',
      currentPath: [0], optimalPath: [0],
      action: { currentDescription: 'no entity', optimalDescription: 'n/a', outcome: 'no calc' },
      rules: ['Risk rules v1.1 · sequence-of-returns'],
    };
  }
  const cma = ctx?.cma;
  if (!cma) {
    return {
      status: 'OPEN',
      currentPath: [0], optimalPath: [0],
      action: { currentDescription: 'no cma', optimalDescription: 'unknown', outcome: 'unknown' },
      rules: ['Risk rules v1.1 · foundation §15.3 extras'],
      notes: 'cma not provided in extras (use buildRiskCoIExtras)',
    };
  }

  const stage = entity?.lifeStage;
  const inDecumulation = stage === 'Decumulation' || stage === 'Legacy'
    || (entity?.retirementAge && _ageOf(entity) >= entity.retirementAge);

  if (!inDecumulation) {
    return {
      status: 'NOT_APPLICABLE',
      currentPath: [0], optimalPath: [0],
      action: {
        currentDescription: 'pre-retirement — sequence risk not active',
        optimalDescription: 'monitor near retirement',
        outcome: 'no current SoR exposure',
      },
      rules: ['Risk rules v1.1 · CF v1.6 §8.4'],
    };
  }

  const sor = sequenceOfReturnsRisk(entity, cma, 1000);
  if (sor.status === 'INSUFFICIENT_DATA') {
    return {
      status: 'OPEN',
      currentPath: [0], optimalPath: [0],
      action: { currentDescription: 'insufficient cma data', optimalDescription: 'n/a', outcome: 'unknown' },
      rules: ['Risk rules v1.1'],
      notes: 'SoR insufficient data',
    };
  }

  const probDepletion = sor.breakdown?.probabilityOfDepletion ?? 0;
  const targetIncome = entity?.targetIncomeReal ?? 0;
  const horizon = ctx?.horizonYears ?? 25;

  // Mitigation savings = probability-weighted income preserved by cash bucket
  // 18-month cash bucket (per CF §8.19 Bucket strategy) reduces depletion ~30-50% in adverse scenarios
  const mitigationProb = probDepletion * 0.4; // ~40% relative reduction
  const annualPreserved = mitigationProb * targetIncome;

  const currentPath = new Array(horizon).fill(0);
  const optimalPath = new Array(horizon).fill(annualPreserved);

  return {
    status: probDepletion > 0.05 ? 'IMPLEMENTED' : 'NOT_APPLICABLE',
    currentPath,
    optimalPath,
    action: {
      currentDescription: `Without SoR hedge: P(depletion) ${(probDepletion * 100).toFixed(1)}%`,
      optimalDescription: `With 18-month cash bucket + floor-upside structure: estimated P(depletion) reduced by ~40%`,
      outcome: probDepletion > 0.05
        ? `Annual income preserved in tail scenarios: ~£${_r(annualPreserved).toLocaleString()}/yr`
        : 'P(depletion) already low — bucket adds little',
    },
    rules: ['Risk rules v1.1 §1.2 · CF v1.6 §8.4 + §8.19 · BENGEN-94'],
    notes: 'v1 mitigation factor 0.4 is industry-rule-of-thumb (Pfau/Vanguard); refinement deferred to v2',
  };
}


// =====================================================================
// END OF uk-risk-2026-1-1.js v1.0 · s17b-2 · 10 May 2026
// =====================================================================
