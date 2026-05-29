// =====================================================================
// SONUSWEALTH — parts/3-Engine/test-cross-engine-cf-risk.js
// =====================================================================
// Cross-engine integration smoke for Phase 4 wiring.
// Tests that uk-cashflow.js §8.4/§8.6/§8.7 delegate to uk-risk engine
// when riskEngineFns is injected, and fall back to v1 stand-ins when not.
// =====================================================================

import {
  sequenceOfReturnsVulnerability,
  maxDrawdownExposure,
  portfolioEfficiency,
} from './uk-cashflow-2026-1-1.js';

import {
  sequenceOfReturnsRisk,
  maxDrawdownVolatility,
  mvPortfolioFrontier,
} from './uk-risk-2026-1-1.js';

let pass = 0, fail = 0;
const failures = [];
function assert(cond, msg) {
  if (cond) pass++; else { fail++; failures.push(msg); console.error('FAIL: ' + msg); }
}

const cmaBundle = {
  effective_until: '2026-12-31',
  inflationPath: [{ year: 2026, cpi: 0.02 }],
  giltYields: [{ duration_years: 1, yield: 0.04 }, { duration_years: 10, yield: 0.045 }],
  cashRate: { rate: 0.0375 },
  swrRegimes: { bengen: { rate: 0.04 } },
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

const entity = {
  age: 65, lifeStage: 'Decumulation',
  retirementAge: 65, longevityAge: 92,
  investableAssets: { total: 500000 },
  targetIncomeReal: 25000,
  cashflowHorizonYears: 25,
  portfolioAllocation: {
    uk_equity: 0.30, global_equity_ex_uk: 0.30, em_equity: 0.05,
    uk_gilts_short: 0.05, uk_gilts_medium: 0.15, uk_corp_credit: 0.05,
    property_reit: 0.05, cash: 0.05,
  },
  statedDrawdownTolerance: 0.20,
  retirementAssets: 500000,
};

console.log('§1 — §8.4 sequenceOfReturnsVulnerability DI delegation');

// Without risk engine injected — uses v1 stand-in
{
  const r = sequenceOfReturnsVulnerability(entity, cmaBundle);
  assert(r.amount !== undefined, '1.1 v1 stand-in returns amount');
  assert(!r.breakdown?.source?.includes('uk-risk'),
    '1.2 v1 stand-in NOT marked as uk-risk source');
}

// With risk engine injected — delegates
{
  const fns = { sequenceOfReturnsRisk: (e, c) => sequenceOfReturnsRisk(e, c, 100) };
  const r = sequenceOfReturnsVulnerability(entity, cmaBundle, fns);
  assert(r.amount !== undefined, '1.3 DI returns amount');
  assert(r.breakdown?.source?.includes('uk-risk'),
    `1.4 DI marks source as uk-risk (got ${r.breakdown?.source})`);
  assert(r.rules.some(rule => rule.includes('Cholesky-MC') || rule.includes('GLASSER')),
    '1.5 DI cites Cholesky-MC sources');
}

console.log('§2 — §8.6 maxDrawdownExposure DI delegation');

// Without risk engine — v1 stand-in
{
  const r = maxDrawdownExposure(entity, cmaBundle);
  assert(r.amount !== undefined, '2.1 v1 stand-in returns amount');
  assert(!r.breakdown?.source?.includes('uk-risk'),
    '2.2 v1 stand-in NOT delegated');
}

// With risk engine — CMA-vol-derived
{
  const fns = { maxDrawdownVolatility };
  const r = maxDrawdownExposure(entity, cmaBundle, fns);
  assert(r.amount !== undefined, '2.3 DI returns amount');
  assert(r.breakdown?.source?.includes('uk-risk'),
    '2.4 DI marks source as uk-risk');
  assert(r.rules.some(rule => rule.includes('CMA-vol-derived DD')),
    '2.5 DI cites CMA-vol-derived');
}

console.log('§3 — §8.7 portfolioEfficiency DI delegation');

// Without risk engine — v1 60/40 Sharpe
{
  const r = portfolioEfficiency(entity, cmaBundle);
  assert(typeof r.amount === 'number', '3.1 v1 returns Sharpe number');
  assert(!r.breakdown?.source?.includes('uk-risk'),
    '3.2 v1 stand-in NOT delegated');
}

// With risk engine — MV frontier
{
  const fns = { mvPortfolioFrontier };
  const r = portfolioEfficiency(entity, cmaBundle, fns);
  assert(typeof r.amount === 'number', '3.3 DI returns Sharpe number');
  assert(r.breakdown?.source?.includes('uk-risk'),
    '3.4 DI marks source as uk-risk');
  assert(r.breakdown?.frontierSharpe !== undefined,
    '3.5 DI exposes frontier Sharpe');
}

console.log('§4 — DI failure modes (graceful fallback)');

// Risk engine throwing → falls back to v1
{
  const fns = { sequenceOfReturnsRisk: () => { throw new Error('engine error'); } };
  let threw = false;
  try {
    const r = sequenceOfReturnsVulnerability(entity, cmaBundle, fns);
    assert(r.amount !== undefined, '4.1 throwing engine → v1 fallback returns amount');
    assert(!r.breakdown?.source?.includes('uk-risk'),
      '4.2 fallback to v1 (not delegated source)');
  } catch (e) { threw = true; }
  assert(!threw, '4.3 fallback graceful — no propagated throw');
}

// Risk engine returning INSUFFICIENT_DATA → falls back to v1
{
  const fns = { maxDrawdownVolatility: () => ({ status: 'INSUFFICIENT_DATA' }) };
  const r = maxDrawdownExposure(entity, cmaBundle, fns);
  assert(r.amount !== undefined, '4.4 INSUFFICIENT_DATA → v1 fallback');
  assert(!r.breakdown?.source?.includes('uk-risk'),
    '4.5 fallback to v1 on INSUFFICIENT_DATA');
}

// =====================================================================
// REPORT
// =====================================================================
console.log('');
console.log(`Cross-engine smoke: ${pass}/${pass + fail} passing (${fail} failures)`);
if (fail > 0) {
  console.log('FAILURES:');
  failures.forEach(f => console.log('  - ' + f));
  process.exit(1);
}
process.exit(0);
