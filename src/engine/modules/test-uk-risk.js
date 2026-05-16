// =====================================================================
// CAELIXA — parts/3-Engine/test-uk-risk.js
// =====================================================================
// Smoke tests for uk-risk-2026-1-1.js v1.0
// Target: ~120 assertions across §B–§N
//
// Run: node test-uk-risk.js
// =====================================================================

import {
  BAND_DEFINITIONS,
  RISK_DIMENSION_MAX_POINTS,
  riskBand,
  D1_mapIncomeResilience,
  D1_fallback,
  D2_mapLiquidityBuffer,
  D2_fallback,
  D5_mapConcentration,
  D5_fallback,
  D3_computeProtectionCoverage,
  D4_computeDebtVulnerability,
  D6_computeDependencyExposure,
  D7_computeBTR,
  recommendedLifeCover,
  recommendedCICover,
  recommendedIPRatio,
  recommendedKeyPersonCover,
  protectionGapCard,
  shockJobLoss,
  shockIllness,
  shockMarketDrop,
  shockRateRise,
  shockDeath,
  runCombinedShock,
  lifeEventReopen,
  projectBTR,
  riskActionSet,
  determineConfidence,
  calcRisk,
  buildRiskCoIExtras,
  portfolioRebalancingHandler,
  sequenceOfReturnsHedgingHandler,
  sequenceOfReturnsRisk,
  maxDrawdownVolatility,
  mvPortfolioFrontier,
} from './uk-risk-2026-1-1.js';

let pass = 0, fail = 0;
const failures = [];
function assert(cond, msg) {
  if (cond) pass++;
  else { fail++; failures.push(msg); console.error('FAIL: ' + msg); }
}
function approx(a, b, tol = 1e-6) {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) <= tol;
}

// =====================================================================
// Shared fixtures
// =====================================================================

const minimalBundle = {
  _meta: { version: 'UK-2026.1-test' },
  riskCalibration: {
    incomeHaircutSelfEmployed: 0.20,
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
    illnessCostMonthly: 500,
    ucMonthlyEstimateSingle: 800,
    ucMonthlyEstimateCouple: 1300,
    keyPersonRevenueMultiple: 1.0,
    keyPersonPbtMultiple: 5,
    liquidityTargetByLifeStage: {
      Foundation: { single_no_deps: 3, default: 3 },
      Acceleration: { default: 4 },
      Consolidation: { default: 5 },
      Peak: { default: 5 },
      Transition: { default: 6 },
      Decumulation: { default: 12 },
      Legacy: { default: 24 },
    },
  },
  iht: {
    nilRateBand: 325000, residenceNilRateBand: 175000,
    residenceNilRateBandTaperStart: 2000000, residenceNilRateBandFrozenTo: '2030-04-05',
  },
};

const cmaBundle = {
  effective_until: '2026-12-31',
  inflationPath: [{ year: 2026, cpi: 0.02 }],
  giltYields: [{ duration_years: 1, yield: 0.04 }, { duration_years: 10, yield: 0.045 }],
  cashRate: { rate: 0.0375 },
  equityReturns: {
    uk: { mean: 0.058, std_dev: 0.155 },
    global: { mean: 0.062, std_dev: 0.145 },
    emerging: { mean: 0.075, std_dev: 0.215 },
  },
  bondReturns: {
    short: { mean: 0.038, std_dev: 0.030 },
    medium: { mean: 0.042, std_dev: 0.062 },
    corporateCredit: { mean: 0.050, std_dev: 0.075 },
  },
  propertyGrowthRate: { value: 0.012, std_dev: 0.18 },
  correlationMatrix: {
    assetClasses: ['uk_equity', 'global_equity_ex_uk', 'em_equity', 'uk_gilts_short', 'uk_gilts_medium', 'uk_corp_credit', 'property_reit', 'cash'],
    matrix: [
      [1.0, 0.85, 0.72, -0.10, -0.05, 0.45, 0.65, 0.05],
      [0.85, 1.0, 0.78, -0.12, -0.08, 0.42, 0.62, 0.03],
      [0.72, 0.78, 1.0, -0.05, 0.0, 0.40, 0.55, 0.02],
      [-0.10, -0.12, -0.05, 1.0, 0.85, 0.55, 0.10, 0.35],
      [-0.05, -0.08, 0.0, 0.85, 1.0, 0.70, 0.15, 0.25],
      [0.45, 0.42, 0.40, 0.55, 0.70, 1.0, 0.45, 0.18],
      [0.65, 0.62, 0.55, 0.10, 0.15, 0.45, 1.0, 0.08],
      [0.05, 0.03, 0.02, 0.35, 0.25, 0.18, 0.08, 1.0],
    ],
  },
};

// =====================================================================
// §1 — BAND_DEFINITIONS + RISK_DIMENSION_MAX_POINTS frozen consts
// =====================================================================
console.log('§1 — frozen consts');

assert(Object.isFrozen(BAND_DEFINITIONS), '1.1 BAND_DEFINITIONS frozen');
assert(BAND_DEFINITIONS.length === 5, '1.2 5 bands');
assert(BAND_DEFINITIONS[0].name === 'Exposed', '1.3 first = Exposed');
assert(BAND_DEFINITIONS[4].name === 'Resilient', '1.4 last = Resilient');
assert(Object.isFrozen(RISK_DIMENSION_MAX_POINTS), '1.5 max points frozen');
assert(RISK_DIMENSION_MAX_POINTS.D1 === 20, '1.6 D1=20');
assert(RISK_DIMENSION_MAX_POINTS.D2 === 18, '1.7 D2=18');
assert(RISK_DIMENSION_MAX_POINTS.D3 === 18, '1.8 D3=18');
assert(RISK_DIMENSION_MAX_POINTS.D4 === 15, '1.9 D4=15');
assert(RISK_DIMENSION_MAX_POINTS.D5 === 12, '1.10 D5=12');
assert(RISK_DIMENSION_MAX_POINTS.D6 === 10, '1.11 D6=10');
assert(RISK_DIMENSION_MAX_POINTS.D7 === 7, '1.12 D7=7');
const totalMax = Object.values(RISK_DIMENSION_MAX_POINTS).reduce((s, v) => s + v, 0);
assert(totalMax === 100, `1.13 total max = 100 (got ${totalMax})`);

// =====================================================================
// §2 — riskBand boundary rule (D-RISK-BOUNDARY-1)
// =====================================================================
console.log('§2 — riskBand boundaries');

assert(riskBand(0).name === 'Exposed', '2.1 score=0 → Exposed');
assert(riskBand(19).name === 'Exposed', '2.2 score=19 → Exposed');
assert(riskBand(20).name === 'Vulnerable', '2.3 score=20 → Vulnerable (boundary upper)');
assert(riskBand(39).name === 'Vulnerable', '2.4 score=39 → Vulnerable');
assert(riskBand(40).name === 'Managed', '2.5 score=40 → Managed (D-RISK-BOUNDARY-1)');
assert(riskBand(59).name === 'Managed', '2.6 score=59 → Managed');
assert(riskBand(60).name === 'Protected', '2.7 score=60 → Protected (boundary upper)');
assert(riskBand(79).name === 'Protected', '2.8 score=79 → Protected');
assert(riskBand(80).name === 'Resilient', '2.9 score=80 → Resilient (boundary upper)');
assert(riskBand(100).name === 'Resilient', '2.10 score=100 → Resilient');

// =====================================================================
// §3 — D1 mapping + fallback
// =====================================================================
console.log('§3 — D1 income resilience');

assert(D1_mapIncomeResilience(0) === 0, '3.1 signal=0 → 0');
assert(D1_mapIncomeResilience(50) === 10, '3.2 signal=50 → 10');
assert(D1_mapIncomeResilience(100) === 20, '3.3 signal=100 → 20');
assert(D1_mapIncomeResilience(NaN) === 0, '3.4 NaN → 0');
{
  const fb = D1_fallback({
    income: { annualGross: 60000 },
    expenses: { monthlyEssentials: 2000 },
    liabilities: { annualDebtService: 6000 },
  });
  assert(fb.score >= 0 && fb.score <= 20, `3.5 fallback in range (${fb.score})`);
  assert(fb.confidence === 'Low', '3.6 fallback confidence Low');
}
{
  const fb = D1_fallback({ income: { annualGross: 0 } });
  assert(fb.score === 0, '3.7 zero income → 0 score');
}

// =====================================================================
// §4 — D2 life-stage mapping + fallback
// =====================================================================
console.log('§4 — D2 liquidity buffer');

// Consolidation default target = 5
assert(D2_mapLiquidityBuffer(0, 'Consolidation', 'default', minimalBundle) === 0,
  '4.1 0mo → 0');
assert(D2_mapLiquidityBuffer(5, 'Consolidation', 'default', minimalBundle) === 18,
  '4.2 5mo at 5mo target → 18');
assert(D2_mapLiquidityBuffer(2.5, 'Consolidation', 'default', minimalBundle) === 10,
  '4.3 2.5mo (50% target) → 10 (band: 50-65% → 10)');
assert(D2_mapLiquidityBuffer(10, 'Consolidation', 'default', minimalBundle) === 18,
  '4.4 above target → 18 (capped)');
// Foundation single = 3mo target
assert(D2_mapLiquidityBuffer(3, 'Foundation', 'single_no_deps', minimalBundle) === 18,
  '4.5 Foundation single 3mo → 18');
// Decumulation = 12mo target
assert(D2_mapLiquidityBuffer(6, 'Decumulation', 'default', minimalBundle) === 10,
  '4.6 Decumulation 6mo (50% of 12) → 10');
// Legacy = 24mo target
assert(D2_mapLiquidityBuffer(24, 'Legacy', 'default', minimalBundle) === 18,
  '4.7 Legacy 24mo → 18');
{
  const fb = D2_fallback({
    cashAndCashEquivalents: 15000,
    expenses: { monthlyEssentials: 3000 },
    lifeStage: 'Consolidation',
  }, minimalBundle);
  assert(fb.score >= 0 && fb.score <= 18, `4.8 fallback in range (${fb.score})`);
  assert(fb.confidence === 'Low', '4.9 fallback confidence Low');
}

// =====================================================================
// §5 — D5 mapping + fallback
// =====================================================================
console.log('§5 — D5 concentration');

assert(D5_mapConcentration(0) === 0, '5.1 signal=0 → 0');
assert(D5_mapConcentration(50) === 6, '5.2 signal=50 → 6');
assert(D5_mapConcentration(100) === 12, '5.3 signal=100 → 12');
{
  // Concentrated single holding (90% in one asset)
  const e = {
    investableAssets: {
      total: 100000,
      holdings: [
        { value: 90000, l1Category: 'equity' },
        { value: 10000, l1Category: 'cash' },
      ],
    },
  };
  const fb = D5_fallback(e);
  assert(fb.score < 6, `5.4 highly concentrated (90%) → low score (got ${fb.score})`);
  assert(fb.largestPct >= 0.85, '5.5 largestPct ≥ 0.85');
  assert(fb.distinctL1 === 2, '5.6 distinctL1 = 2');
}
{
  // Diversified — 5 categories at 20% each
  const e = {
    investableAssets: {
      total: 100000,
      holdings: [
        { value: 20000, l1Category: 'equity' },
        { value: 20000, l1Category: 'bonds' },
        { value: 20000, l1Category: 'property' },
        { value: 20000, l1Category: 'business' },
        { value: 20000, l1Category: 'alternatives' },
      ],
    },
  };
  // 5 cats at 20% each: largest in 15-24% band → primary=48; secondary=40 → signal=88 → score=11
  const fb = D5_fallback(e);
  assert(fb.score === 11, `5.7 diversified 5×20% (largest=20% in 15-24% band) → score=11 (got ${fb.score})`);
}

// =====================================================================
// §6 — Recommended cover formulas
// =====================================================================
console.log('§6 — Recommended cover');

{
  // Income £60k, debt £200k, 1 child age 5
  const e = {
    income: { annualGross: 60000 },
    liabilities: { mortgageOutstanding: 200000, otherSecuredDebts: 0, unsecuredDebts: 0 },
    dependants: { count: 1, youngestAge: 5 },
  };
  const r = recommendedLifeCover(e, minimalBundle);
  // baseFloor = max(200k, 600k) = 600k
  // depCost = 1 × 12000 × (18-5) = 156000
  // total = 756000
  assert(r.recommended === 756000, `6.1 life cover = £756k (got £${r.recommended})`);
  assert(r.breakdown.baseFloor === 600000, '6.2 baseFloor = 600k');
  assert(r.breakdown.depCost === 156000, '6.3 depCost = 156k');
}
{
  // No deps, low debt
  const e = { income: { annualGross: 50000 }, liabilities: {}, dependants: { count: 0 } };
  const r = recommendedLifeCover(e, minimalBundle);
  assert(r.recommended === 500000, `6.4 no-dep £50k income → £500k (got ${r.recommended})`);
}
{
  const r = recommendedCICover({ income: { annualGross: 80000 } }, minimalBundle);
  assert(r.recommended === 240000, `6.5 CI = 3×80k = 240k (got ${r.recommended})`);
}
{
  const r = recommendedIPRatio({ income: { annualGross: 60000 } }, minimalBundle);
  // 60k/12 × 0.65 = 3250
  assert(approx(r.targetMonthlyBenefit, 3250, 0.01),
    `6.6 IP target = £3250/mo (got ${r.targetMonthlyBenefit})`);
}
{
  // Director with revenue + PBT
  const e = {
    flags: ['director'],
    business: { annualRevenue: 1000000, profitBeforeTax: 250000 },
  };
  const r = recommendedKeyPersonCover(e, minimalBundle);
  assert(r.applicable === true, '6.7 director applicable');
  // max(1×rev=1M, 5×PBT=1.25M) = 1.25M
  assert(r.recommended === 1250000, `6.8 KP cover = £1.25M (got ${r.recommended})`);
}
{
  // Non-director
  const r = recommendedKeyPersonCover({ flags: [] }, minimalBundle);
  assert(r.applicable === false, '6.9 non-director KP not applicable');
}

// =====================================================================
// §7 — protectionGapCard
// =====================================================================
console.log('§7 — protectionGapCard');

{
  const e = {
    income: { annualGross: 60000 },
    liabilities: { mortgageOutstanding: 100000 },
    dependants: { count: 0 },
    protectionPolicies: { life: { sumAssured: 300000 } },
  };
  const card = protectionGapCard(e, 'life', minimalBundle);
  // recommended = max(100k, 600k) = 600k; existing 300k; gap 300k
  assert(card.recommended === 600000, '7.1 life recommended £600k');
  assert(card.existing === 300000, '7.2 life existing £300k');
  assert(card.gap === 300000, '7.3 life gap £300k');
  assert(card.maxSubScore === 7, '7.4 non-director life max=7');
  // sub-score = 300k/600k × 7 = 3.5
  assert(approx(card.subScore, 3.5, 0.01), `7.5 life subScore=3.5 (got ${card.subScore})`);
}
{
  // Director CI
  const e = {
    flags: ['director'],
    income: { annualGross: 100000 },
    protectionPolicies: { ci: { sumAssured: 100000 } },
  };
  const card = protectionGapCard(e, 'ci', minimalBundle);
  assert(card.maxSubScore === 5, '7.6 director CI max=5');
  // recommended 300k, existing 100k → 1/3 × 5 = 1.67
  assert(approx(card.subScore, 1.67, 0.01), `7.7 director CI subScore (got ${card.subScore})`);
}
{
  // Non-director key_person → not applicable
  const card = protectionGapCard({ flags: [] }, 'key_person', minimalBundle);
  assert(card.applicable === false, '7.8 non-director KP gap not applicable');
}
// Unknown coverage type
{
  let threw = false;
  try { protectionGapCard({}, 'invalid', minimalBundle); } catch (e) { threw = true; }
  assert(threw, '7.9 unknown coverageType throws');
}

// =====================================================================
// §8 — D3_computeProtectionCoverage with floors
// =====================================================================
console.log('§8 — D3 floors');

// Score floor: dependants but no policies → cap at 5
{
  const e = {
    income: { annualGross: 50000 },
    dependants: { count: 2, youngestAge: 8 },
    protectionPolicies: {},
  };
  const d3 = D3_computeProtectionCoverage(e, minimalBundle);
  assert(d3.score <= 5, `8.1 deps + 0 policies → cap 5 (got ${d3.score})`);
  assert(d3.floorApplied === true, '8.2 floor applied');
}
// Score floor: no deps, no director → min 2
{
  const e = {
    income: { annualGross: 50000 },
    dependants: { count: 0 },
    protectionPolicies: {},
    flags: [],
  };
  const d3 = D3_computeProtectionCoverage(e, minimalBundle);
  assert(d3.score >= 2, `8.3 no-deps no-director → min 2 (got ${d3.score})`);
}
// Confidence Low when no policies recorded
{
  const e = { income: { annualGross: 50000 }, dependants: { count: 0 } };
  const d3 = D3_computeProtectionCoverage(e, minimalBundle);
  assert(d3.confidence === 'Low', '8.4 no policies recorded → confidence Low');
}
// High confidence: all policies present (non-director)
{
  const e = {
    income: { annualGross: 50000 },
    liabilities: {},
    dependants: { count: 0 },
    flags: [],
    protectionPolicies: {
      life: { sumAssured: 500000 },
      ci: { sumAssured: 150000 },
      ip: { monthlyBenefit: 2700 },
    },
  };
  const d3 = D3_computeProtectionCoverage(e, minimalBundle);
  assert(d3.confidence === 'High', `8.5 all policies → confidence High (got ${d3.confidence})`);
  assert(d3.score >= 15, `8.6 fully covered → score ≥ 15 (got ${d3.score})`);
}

// =====================================================================
// §9 — D4_computeDebtVulnerability
// =====================================================================
console.log('§9 — D4 debt vulnerability');

// Zero debt → max 15
{
  const e = { liabilities: { items: [] }, income: { annualGross: 60000 }, assets: [] };
  const d4 = D4_computeDebtVulnerability(e, minimalBundle);
  assert(d4.score === 15, `9.1 zero debt → 15 (got ${d4.score})`);
  assert(d4.subScores.leverage === 5, '9.2 leverage=5');
  assert(d4.subScores.debtService === 7, '9.3 debt service=7');
  assert(d4.subScores.rateSensitivity === 3, '9.4 rate sens=3');
}
// Moderate debt
{
  const e = {
    income: { annualGross: 80000 },
    assets: [{ value: 600000 }],
    liabilities: {
      items: [{
        outstandingBalance: 200000, monthlyPayment: 1100, interestRate: 0.045,
        rateType: 'fixed', remainingTermMonths: 240, fixedTermExpiryMonths: 36,
      }],
    },
  };
  const d4 = D4_computeDebtVulnerability(e, minimalBundle);
  // leverage 200/600 = 33% → sub1=3
  assert(d4.subScores.leverage === 3, `9.5 leverage 33% → 3 (got ${d4.subScores.leverage})`);
  // DSR = 1100×12 / 80k = 16.5% → sub2=5
  assert(d4.subScores.debtService === 5, `9.6 DSR 16% → 5 (got ${d4.subScores.debtService})`);
  // 100% fixed → sub3=3
  assert(d4.subScores.rateSensitivity === 3, '9.7 100% fixed → 3');
}
// Variable rate exposure
{
  const e = {
    income: { annualGross: 60000 },
    assets: [{ value: 300000 }],
    liabilities: {
      items: [{
        outstandingBalance: 150000, monthlyPayment: 800, interestRate: 0.055,
        rateType: 'variable', remainingTermMonths: 180,
      }],
    },
  };
  const d4 = D4_computeDebtVulnerability(e, minimalBundle);
  assert(d4.subScores.rateSensitivity === 0, `9.8 100% variable → 0 (got ${d4.subScores.rateSensitivity})`);
  assert(d4.shockInputs.monthly_service_increase_200bps > 0,
    '9.9 +200bps stress > 0');
  assert(d4.shockInputs.variable_rate_monthly_service === 800,
    `9.10 var monthly service = 800 (got ${d4.shockInputs.variable_rate_monthly_service})`);
}

// =====================================================================
// §10 — D6_computeDependencyExposure
// =====================================================================
console.log('§10 — D6 dependency');

// No deps, no LPA → 9
{
  const e = { dependants: { count: 0 } };
  const d6 = D6_computeDependencyExposure(e, null, minimalBundle);
  assert(d6.score === 9, `10.1 no deps, no LPA → 9 (got ${d6.score})`);
  assert(d6.mode === 'no_dependants', '10.2 mode=no_dependants');
}
// No deps, LPA both → 10
{
  const e = { dependants: { count: 0 }, lpaStatus: 'both' };
  const d6 = D6_computeDependencyExposure(e, null, minimalBundle);
  assert(d6.score === 10, `10.3 no deps + LPA both → 10 (got ${d6.score})`);
}
// Max with deps: will=3, nom=2, trust=2, lpa=2, guardian=1
{
  const e = {
    dependants: { count: 2, youngestAge: 5 },
    willStatus: 'current_professional',
    pensionNominationStatus: 'all_named',
    protectionPolicies: { life: { sumAssured: 500000, inTrust: true } },
    lpaStatus: 'both',
    guardianStatus: 'named',
  };
  const d6 = D6_computeDependencyExposure(e, null, minimalBundle);
  assert(d6.score === 10, `10.4 max config with deps → 10 (got ${d6.score})`);
  assert(d6.mode === 'with_dependants', '10.5 mode=with_dependants');
}
// Minimum with deps: nothing in place
{
  const e = { dependants: { count: 1, youngestAge: 10 } };
  const d6 = D6_computeDependencyExposure(e, null, minimalBundle);
  assert(d6.score === 0, `10.6 nothing in place → 0 (got ${d6.score})`);
}
// Old will + financial-only LPA
{
  const e = {
    dependants: { count: 1, youngestAge: 12 },
    willStatus: 'old',
    lpaStatus: 'financial_only',
  };
  const d6 = D6_computeDependencyExposure(e, null, minimalBundle);
  // will=1, nom=0, trust=0, lpa=1, guardian=0 (no will so no guardian)
  assert(d6.score === 2, `10.7 old will + fin LPA → 2 (got ${d6.score})`);
}

// =====================================================================
// §11 — D7_computeBTR tenure gates + decay
// =====================================================================
console.log('§11 — D7 BTR');

// Tenure < 3mo → 0, not available
{
  const e = {
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(), // 30 days ago
  };
  const d7 = D7_computeBTR(e, undefined, minimalBundle);
  assert(d7.score === 0, '11.1 tenure < 3mo → score 0');
  assert(d7.available === false, '11.2 tenure < 3mo → not available');
}
// Tenure 3-11mo → cap 3
{
  const e = {
    createdAt: new Date(Date.now() - 6 * 30.44 * 86400000).toISOString(),
    btrEvents: [
      { eventType: 'BTR_POSITIVE', timestamp: new Date(Date.now() - 30 * 86400000).toISOString(), payload: { weight: 0.5 } },
      { eventType: 'BTR_POSITIVE', timestamp: new Date(Date.now() - 60 * 86400000).toISOString(), payload: { weight: 0.5 } },
      { eventType: 'BTR_POSITIVE', timestamp: new Date(Date.now() - 90 * 86400000).toISOString(), payload: { weight: 0.5 } },
      { eventType: 'BTR_POSITIVE', timestamp: new Date(Date.now() - 120 * 86400000).toISOString(), payload: { weight: 0.5 } },
      { eventType: 'BTR_POSITIVE', timestamp: new Date(Date.now() - 150 * 86400000).toISOString(), payload: { weight: 0.5 } },
      { eventType: 'BTR_POSITIVE', timestamp: new Date(Date.now() - 170 * 86400000).toISOString(), payload: { weight: 0.5 } },
    ],
  };
  const d7 = D7_computeBTR(e, undefined, minimalBundle);
  assert(d7.cap === 3, '11.3 6mo tenure → cap 3');
  assert(d7.score <= 3, `11.4 score ≤ cap (got ${d7.score})`);
  assert(d7.available === true, '11.5 available');
}
// Tenure 12-23mo → cap 5
{
  const e = {
    createdAt: new Date(Date.now() - 18 * 30.44 * 86400000).toISOString(),
    btrEvents: [],
  };
  const d7 = D7_computeBTR(e, undefined, minimalBundle);
  assert(d7.cap === 5, `11.6 18mo tenure → cap 5 (got ${d7.cap})`);
}
// Tenure 24+mo → cap 7
{
  const e = {
    createdAt: new Date(Date.now() - 30 * 30.44 * 86400000).toISOString(),
    btrEvents: [],
  };
  const d7 = D7_computeBTR(e, undefined, minimalBundle);
  assert(d7.cap === 7, `11.7 30mo tenure → cap 7 (got ${d7.cap})`);
}
// Missed deadline reduces
{
  const e = {
    createdAt: new Date(Date.now() - 12 * 30.44 * 86400000).toISOString(),
    btrEvents: [
      { eventType: 'BTR_POSITIVE', timestamp: new Date(Date.now() - 30 * 86400000).toISOString(), payload: { weight: 2.0 } },
      { eventType: 'BTR_NEGATIVE', timestamp: new Date(Date.now() - 60 * 86400000).toISOString(), payload: { action: 'deadline_missed' } },
    ],
  };
  const d7 = D7_computeBTR(e, undefined, minimalBundle);
  assert(d7.eventSummary.missedDeadlineReductions === 0.5,
    `11.8 missed deadline -0.5 (got ${d7.eventSummary.missedDeadlineReductions})`);
}

// =====================================================================
// §12 — Shocks
// =====================================================================
console.log('§12 — Shocks');

// Shock 1 — job loss applicable for working-age single
{
  const e = {
    lifeStage: 'Consolidation',
    expenses: { monthlyEssentials: 2500 },
    cashAndCashEquivalents: 15000,
    liabilities: { annualDebtService: 6000 },
  };
  const s1 = shockJobLoss(e, minimalBundle, 6);
  assert(s1.applicable === true, '12.1 working-age applicable');
  // monthly shock = 800 - 2500 - 500 = -2200
  assert(s1.monthlyCashflowShock === -2200,
    `12.2 monthly shock = -2200 (got ${s1.monthlyCashflowShock})`);
  // 6mo total = -13200
  assert(s1.nwImpact === -13200, `12.3 6mo NW impact = -13200 (got ${s1.nwImpact})`);
  // months survived = 15000 / 2200 ≈ 6
  assert(s1.monthsSurvived === 6, `12.4 monthsSurvived ≈ 6 (got ${s1.monthsSurvived})`);
}
// Shock 1 — retired N/A
{
  const s1 = shockJobLoss({ lifeStage: 'Decumulation' }, minimalBundle);
  assert(s1.applicable === false, '12.5 Decumulation not applicable');
}
// Shock 1 — director N/A
{
  const s1 = shockJobLoss({ flags: ['director'], lifeStage: 'Peak' }, minimalBundle);
  assert(s1.applicable === false, '12.6 director not applicable (Shock 1B v1.x)');
}

// Shock 2 — illness
{
  const e = {
    income: { annualGross: 60000 },
    expenses: { monthlyEssentials: 2500 },
    liabilities: { annualDebtService: 12000 },
    employment: { sickPayWeeks: 4, sickPayRate: 1.0 },
    protectionPolicies: { ip: { monthlyBenefit: 2000 }, ci: { sumAssured: 50000 } },
  };
  const s2 = shockIllness(e, minimalBundle);
  assert(s2.applicable === true, '12.7 illness applicable');
  assert(s2.ciPayout === 50000, '12.8 CI payout reflected');
  assert(typeof s2.nwImpact === 'number', '12.9 NW impact numeric');
}

// Shock 3 — market drop
{
  const e = { investableAssets: { total: 500000 }, cashAndCashEquivalents: 50000 };
  const s3 = shockMarketDrop(e, minimalBundle, 0.30);
  // non-cash = 450k; -30% = -135k
  assert(s3.nwImpact === -135000, `12.10 -30% market = -135k (got ${s3.nwImpact})`);
  assert(s3.cashUnaffected === 50000, '12.11 cash unaffected');
}
// Shock 3 default = -30%
{
  const e = { investableAssets: { total: 100000 }, cashAndCashEquivalents: 10000 };
  const s3 = shockMarketDrop(e, minimalBundle);
  // 90k × -0.30 = -27k
  assert(s3.nwImpact === -27000, '12.12 default -30% drop');
}

// Shock 4 — rate rise
{
  const e = {
    income: { annualGross: 80000 },
    liabilities: {
      items: [{
        outstandingBalance: 200000, monthlyPayment: 1100, interestRate: 0.04,
        rateType: 'variable', remainingTermMonths: 240,
      }],
    },
  };
  const s4 = shockRateRise(e, minimalBundle, 200);
  assert(s4.monthlyIncrease > 0, `12.13 +200bps increases monthly (got ${s4.monthlyIncrease})`);
  assert(s4.imminentExpiryFlag === false, '12.14 no imminent fixed expiry');
}
// Shock 4 — fixed expiring within 12mo flag
{
  const e = {
    income: { annualGross: 80000 },
    liabilities: {
      items: [{
        outstandingBalance: 200000, monthlyPayment: 1100, interestRate: 0.035,
        rateType: 'fixed', remainingTermMonths: 240, fixedTermExpiryMonths: 6,
      }],
    },
  };
  const s4 = shockRateRise(e, minimalBundle, 200);
  assert(s4.imminentExpiryFlag === true, '12.15 imminent expiry flag set');
}

// Shock 5 — death
{
  const e = {
    netWorth: 800000,
    income: { annualGross: 60000 },
    protectionPolicies: { life: { sumAssured: 500000, inTrust: false } },
  };
  // Mock ihtDynamicFn returning 50k IHT
  const s5 = shockDeath(e, minimalBundle, () => ({ totalIht: 50000 }));
  assert(s5.lifePayout || s5.lifeAssurancePayout === 500000, '12.16 life payout reflected');
  assert(s5.ihtLiability === 50000, '12.17 IHT liability from injected fn');
  assert(s5.lifeInTrust === false, '12.18 not in trust');
}
// Shock 5 — life in trust
{
  const e = {
    netWorth: 800000,
    protectionPolicies: { life: { sumAssured: 500000, inTrust: true } },
  };
  const s5 = shockDeath(e, minimalBundle, () => ({ totalIht: 0 }));
  assert(s5.lifeInTrust === true, '12.19 in trust flagged');
  assert(s5.notes.some(n => n.includes('trust')), '12.20 trust noted');
}
// Shock 5 — without ihtDynamicFn injection
{
  const s5 = shockDeath({ netWorth: 100000 }, minimalBundle);
  assert(s5.notes.some(n => n.includes('ihtDynamicFn')), '12.21 missing fn noted');
}

// runCombinedShock stub
{
  const r = runCombinedShock({}, ['shock1', 'shock2'], minimalBundle);
  assert(r.status === 'OPEN', '12.22 combined stub returns OPEN');
}

// =====================================================================
// §13 — lifeEventReopen 16-event matrix
// =====================================================================
console.log('§13 — Life-event reopen');

const lifeEventCases = [
  ['marriage', ['D3', 'D6'], 'Medium'],
  ['divorce', ['D3', 'D4', 'D6'], 'High'],
  ['child_birth', ['D3', 'D6'], 'High'],
  ['dependant_death', ['D3', 'D6'], 'High'],
  ['partner_death', ['D1', 'D3', 'D4', 'D6'], 'Critical'],
  ['employment_change_self_emp', ['D1', 'D3'], 'High'],
  ['employment_change_employed', ['D1', 'D3'], 'Medium'],
  ['redundancy', ['D1', 'D2', 'D3'], 'High'],
  ['jurisdiction_move', ['D1', 'D3', 'D4', 'D5', 'D6'], 'High'],
  ['property_purchase', ['D4', 'D5', 'D2'], 'Medium'],
  ['property_sale', ['D2', 'D4', 'D5'], 'Medium'],
  ['inheritance', ['D2', 'D5', 'D6'], 'Medium'],
  ['serious_illness', ['D1', 'D2', 'D3'], 'High'],
  ['retirement', ['D1', 'D3', 'D4', 'D6'], 'High'],
  ['business_sale', ['D4', 'D5', 'D6'], 'High'],
  ['pension_crystallisation', ['D1', 'D2'], 'Medium'],
];
let leNum = 1;
for (const [evt, dims, prio] of lifeEventCases) {
  const r = lifeEventReopen({}, evt);
  assert(r.recognised === true, `13.${leNum}a ${evt} recognised`);
  assert(JSON.stringify(r.dimensionIds) === JSON.stringify(dims),
    `13.${leNum}b ${evt} dims correct`);
  assert(r.priority === prio, `13.${leNum}c ${evt} priority ${prio}`);
  leNum++;
}
// Unknown event
{
  const r = lifeEventReopen({}, 'unknown_event');
  assert(r.recognised === false, '13.17 unknown event not recognised');
  assert(r.dimensionIds.length === 0, '13.18 unknown → empty dims');
}

// =====================================================================
// §14 — projectBTR
// =====================================================================
console.log('§14 — projectBTR');

{
  const low = projectBTR({}, 12, 'low');
  const med = projectBTR({}, 12, 'medium');
  const high = projectBTR({}, 12, 'high');
  assert(low.projected12mo <= med.projected12mo, '14.1 low ≤ medium @ 12mo');
  assert(med.projected12mo <= high.projected12mo, '14.2 medium ≤ high @ 12mo');
  assert(low.projected3mo < low.projected12mo, '14.3 3mo < 12mo (low)');
  assert(high.projected12mo <= 7, '14.4 capped at 7');
}

// =====================================================================
// §15 — riskActionSet
// =====================================================================
console.log('§15 — riskActionSet');

{
  const e = {
    income: { annualGross: 60000 },
    expenses: { monthlyEssentials: 2500 },
    cashAndCashEquivalents: 5000,
    dependants: { count: 2, youngestAge: 8 },
    protectionPolicies: {},
    liabilities: {
      items: [{
        outstandingBalance: 200000, monthlyPayment: 1100, interestRate: 0.04,
        rateType: 'variable', remainingTermMonths: 240,
      }],
    },
  };
  const actions = riskActionSet(e, minimalBundle, 5);
  assert(Array.isArray(actions), '15.1 returns array');
  assert(actions.length <= 5, '15.2 respects n=5 limit');
  // Largest delta first
  for (let i = 1; i < actions.length; i++) {
    assert(actions[i - 1].scoreDelta >= actions[i].scoreDelta,
      `15.3 sorted desc at idx ${i}`);
  }
  // Should include life cover gap (deps + zero policies)
  const hasLifeAction = actions.some(a => a.actionId === 'close_life_gap');
  assert(hasLifeAction, '15.4 includes close_life_gap action');
}

// =====================================================================
// §16 — determineConfidence
// =====================================================================
console.log('§16 — determineConfidence');

assert(determineConfidence({ D1: { confidence: 'High' } }) === 'High', '16.1 all High');
assert(determineConfidence({ D1: { confidence: 'High' }, D2: { confidence: 'Medium' } }) === 'Medium',
  '16.2 mixed → Medium');
assert(determineConfidence({ D1: { confidence: 'Medium' }, D2: { confidence: 'Low' } }) === 'Low',
  '16.3 includes Low → Low');
assert(determineConfidence({}) === 'High', '16.4 empty → High (no constraints)');

// =====================================================================
// §17 — calcRisk master orchestrator
// =====================================================================
console.log('§17 — calcRisk');

{
  const e = {
    age: 40,
    lifeStage: 'Consolidation',
    income: { annualGross: 70000 },
    expenses: { monthlyEssentials: 2800 },
    cashAndCashEquivalents: 20000,
    dependants: { count: 1, youngestAge: 7 },
    flags: [],
    protectionPolicies: {
      life: { sumAssured: 600000 },
      ci: { sumAssured: 200000 },
      ip: { monthlyBenefit: 3000 },
    },
    investableAssets: {
      total: 200000,
      holdings: [
        { value: 100000, l1Category: 'pension' },
        { value: 50000, l1Category: 'isa' },
        { value: 50000, l1Category: 'gia' },
      ],
    },
    liabilities: {
      items: [{
        outstandingBalance: 200000, monthlyPayment: 1100, interestRate: 0.04,
        rateType: 'fixed', remainingTermMonths: 240, fixedTermExpiryMonths: 36,
      }],
      annualDebtService: 13200,
    },
    assets: [{ value: 350000 }],
    willStatus: 'current_professional',
    pensionNominationStatus: 'all_named',
    lpaStatus: 'both',
    guardianStatus: 'named',
    createdAt: new Date(Date.now() - 25 * 30.44 * 86400000).toISOString(),
  };
  const r = calcRisk(e, minimalBundle);
  assert(typeof r.score === 'number', '17.1 score is number');
  assert(r.score >= 0 && r.score <= 100, `17.2 score in [0,100] (got ${r.score})`);
  assert(r.band !== undefined, '17.3 band present');
  assert(r.band.name !== undefined, '17.4 band has name');
  assert(r.dimensions.D1 && r.dimensions.D7, '17.5 all dimensions present');
  assert(r.computedAt !== undefined, '17.6 timestamp present');
  assert(typeof r.confidence === 'string', '17.7 confidence string');
  assert(Array.isArray(r.actionSet), '17.8 actionSet array');
  assert(r.shockInputs !== undefined, '17.9 shockInputs present');
  // Score = D1+D2+D3+D4+D5+D6+D7
  const sum = r.dimensions.D1.score + r.dimensions.D2.score + r.dimensions.D3.score
            + r.dimensions.D4.score + r.dimensions.D5.score + r.dimensions.D6.score
            + r.dimensions.D7.score;
  assert(r.score === sum, `17.10 score = sum of dims (${r.score} vs ${sum})`);
  // bundleVersion populated from _meta
  assert(r.bundleVersion === 'UK-2026.1-test', '17.11 bundleVersion from _meta');
}
// calcRisk with cross-engine fns injected
{
  const e = {
    age: 40, lifeStage: 'Consolidation',
    income: { annualGross: 60000 },
    expenses: { monthlyEssentials: 2500 },
    cashAndCashEquivalents: 12500,
    dependants: { count: 0 },
    flags: [],
    protectionPolicies: {},
    liabilities: { items: [], annualDebtService: 0 },
    assets: [{ value: 200000 }],
    createdAt: new Date(Date.now() - 36 * 30.44 * 86400000).toISOString(),
  };
  const ctx = {
    cashflowHealthFn: () => ({ components: { incomeResilience: 75 } }),
    liquidityBufferFn: () => ({ months: 5 }),
    concentrationRiskFn: () => ({ signal: 80 }),
  };
  const r = calcRisk(e, minimalBundle, 'corr-123', ctx);
  assert(r.dimensions.D1.confidence === 'High', '17.12 D1 high confidence with cf fn');
  assert(r.dimensions.D2.confidence === 'High', '17.13 D2 high confidence');
  assert(r.dimensions.D5.confidence === 'High', '17.14 D5 high confidence');
  assert(r.correlationId === 'corr-123', '17.15 correlationId propagated');
  assert(r.dimensions.D1.score === D1_mapIncomeResilience(75), '17.16 D1 mapped from signal');
}

// =====================================================================
// §18 — buildRiskCoIExtras
// =====================================================================
console.log('§18 — buildRiskCoIExtras');

{
  const extras = buildRiskCoIExtras({ age: 45, longevityAge: 92 }, cmaBundle);
  assert(extras.cma === cmaBundle, '18.1 cma included');
  assert(extras.horizonYears === 47, `18.2 horizon = 47 (got ${extras.horizonYears})`);
  assert(extras.currentAge === 45, '18.3 currentAge = 45');
}
{
  const extras = buildRiskCoIExtras({}, cmaBundle);
  assert(extras.currentAge === null, '18.4 missing age → null');
  assert(extras.horizonYears === 25, `18.5 default 25 horizon (got ${extras.horizonYears})`);
}

// =====================================================================
// §19 — Cashflow consumer wires (§N)
// =====================================================================
console.log('§19 — Cashflow consumer wires');

{
  const e = {
    age: 65, lifeStage: 'Decumulation',
    investableAssets: { total: 500000 },
    targetIncomeReal: 25000,
    cashflowHorizonYears: 25,
    portfolioAllocation: {
      uk_equity: 0.30, global_equity_ex_uk: 0.30, em_equity: 0.05,
      uk_gilts_short: 0.05, uk_gilts_medium: 0.15, uk_corp_credit: 0.05,
      property_reit: 0.05, cash: 0.05,
    },
  };
  const sor = sequenceOfReturnsRisk(e, cmaBundle, 200);  // small N for speed
  assert(sor.value !== undefined, '19.1 sequenceOfReturnsRisk value present');
  assert(sor.breakdown.mcRuns === 200, '19.2 mcRuns reflected');
  assert(sor.breakdown.probabilityOfDepletion >= 0 && sor.breakdown.probabilityOfDepletion <= 1,
    '19.3 probability in [0,1]');
  assert(sor.rules.some(r => r.includes('Cholesky-MC')), '19.4 rule cites Cholesky');
}
{
  const e = {
    portfolioAllocation: {
      uk_equity: 0.50, global_equity_ex_uk: 0.30, uk_gilts_medium: 0.20,
    },
    statedDrawdownTolerance: 0.20,
  };
  const dd = maxDrawdownVolatility(e, cmaBundle);
  assert(dd.value > 0, `19.5 implied DD > 0 (got ${dd.value})`);
  assert(dd.breakdown.gap !== null, '19.6 gap computed (stated tolerance present)');
  assert(dd.rules.some(r => r.includes('CMA-vol-derived DD')), '19.7 rule cites CMA-vol');
}
{
  const e = {
    portfolioAllocation: {
      uk_equity: 0.60, uk_gilts_medium: 0.40,
    },
  };
  const fr = mvPortfolioFrontier(e, cmaBundle);
  assert(typeof fr.value === 'number', '19.8 frontier sharpe numeric');
  assert(fr.breakdown.frontierSharpe !== undefined, '19.9 frontier sharpe in breakdown');
  assert(fr.breakdown.currentEquityShare === 0.60, '19.10 current equity share captured');
}
// Missing CMA → INSUFFICIENT_DATA
{
  const r = sequenceOfReturnsRisk({}, null);
  assert(r.status === 'INSUFFICIENT_DATA', '19.11 missing cma → INSUFFICIENT_DATA');
}
{
  const r = maxDrawdownVolatility({}, null);
  assert(r.status === 'INSUFFICIENT_DATA', '19.12 maxDD no cma → INSUFFICIENT_DATA');
}

// =====================================================================
// §20 — Canonical CoI handlers
// =====================================================================
console.log('§20 — Canonical CoI handlers (§L)');

// portfolioRebalancingHandler — no entity
{
  const r = portfolioRebalancingHandler(null, minimalBundle, {});
  assert(r.status === 'NOT_APPLICABLE', '20.1 no entity → NOT_APPLICABLE');
}
// portfolioRebalancingHandler — no cma → OPEN
{
  const r = portfolioRebalancingHandler({ investableAssets: { total: 100000 } }, minimalBundle, {});
  assert(r.status === 'OPEN', '20.2 no cma → OPEN');
}
// portfolioRebalancingHandler — happy path
{
  const e = {
    investableAssets: { total: 200000 },
    portfolioAllocation: { uk_equity: 0.50, uk_gilts_medium: 0.50 },
  };
  const ctx = buildRiskCoIExtras(e, cmaBundle);
  const r = portfolioRebalancingHandler(e, minimalBundle, ctx);
  assert(['IMPLEMENTED', 'NOT_APPLICABLE'].includes(r.status),
    `20.3 status valid (got ${r.status})`);
  assert(Array.isArray(r.currentPath), '20.4 currentPath array');
  assert(Array.isArray(r.optimalPath), '20.5 optimalPath array');
  assert(r.action.currentDescription !== undefined, '20.6 action.currentDescription');
  assert(r.action.optimalDescription !== undefined, '20.7 action.optimalDescription');
}
// sequenceOfReturnsHedgingHandler — pre-retirement → NOT_APPLICABLE
{
  const e = { age: 45, lifeStage: 'Peak' };
  const ctx = buildRiskCoIExtras(e, cmaBundle);
  const r = sequenceOfReturnsHedgingHandler(e, minimalBundle, ctx);
  assert(r.status === 'NOT_APPLICABLE', `20.8 pre-retirement → NOT_APPLICABLE (got ${r.status})`);
}
// sequenceOfReturnsHedgingHandler — decumulation
{
  const e = {
    age: 65, lifeStage: 'Decumulation',
    investableAssets: { total: 500000 },
    targetIncomeReal: 25000,
    cashflowHorizonYears: 25,
    portfolioAllocation: {
      uk_equity: 0.40, uk_gilts_medium: 0.40, cash: 0.20,
    },
  };
  const ctx = buildRiskCoIExtras(e, cmaBundle);
  const r = sequenceOfReturnsHedgingHandler(e, minimalBundle, ctx);
  assert(['IMPLEMENTED', 'NOT_APPLICABLE'].includes(r.status),
    `20.9 decumulation status valid (got ${r.status})`);
  assert(r.action.currentDescription !== undefined, '20.10 currentDescription');
}

// =====================================================================
// §21 — Integration with canonical CoI (extras pattern end-to-end)
// =====================================================================
console.log('§21 — End-to-end CoI integration');

{
  // Verify handlers compose cleanly with canonical-coi.js
  // (Just confirms shape contract — full test in canonical-coi tests)
  const e = {
    age: 65, lifeStage: 'Decumulation',
    investableAssets: { total: 500000 },
    targetIncomeReal: 25000, cashflowHorizonYears: 25,
    portfolioAllocation: { uk_equity: 0.40, uk_gilts_medium: 0.40, cash: 0.20 },
  };
  const ctx = buildRiskCoIExtras(e, cmaBundle);
  const result = sequenceOfReturnsHedgingHandler(e, minimalBundle, ctx);
  // Contract per foundation §10.12
  assert('status' in result, '21.1 contract: status');
  assert('currentPath' in result, '21.2 contract: currentPath');
  assert('optimalPath' in result, '21.3 contract: optimalPath');
  assert('action' in result, '21.4 contract: action');
  assert('rules' in result, '21.5 contract: rules');
  assert('currentDescription' in result.action, '21.6 contract: action.currentDescription');
  assert('optimalDescription' in result.action, '21.7 contract: action.optimalDescription');
  assert('outcome' in result.action, '21.8 contract: action.outcome');
}

// =====================================================================
// REPORT
// =====================================================================

console.log('');
console.log(`uk-risk smoke: ${pass}/${pass + fail} passing (${fail} failures)`);
if (fail > 0) {
  console.log('FAILURES:');
  failures.forEach(f => console.log('  - ' + f));
  process.exit(1);
}
process.exit(0);
