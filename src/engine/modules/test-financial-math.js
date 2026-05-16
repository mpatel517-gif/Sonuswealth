// =====================================================================
// CAELIXA — parts/3-Engine/lib/test-financial-math.js
// =====================================================================
// Smoke tests for shared financial-math lib.
//
// Built:    s17b-1 (7 May 2026 · Phase A)
// Run:      node test-financial-math.js
// Exit:     0 if all pass, 1 if any fail
//
// Test sources:
//   [BMA] Brealey/Myers/Allen worked examples (Ch. 2-3, Ch. 5)
//   [CII-AF4] CII AF4 Investment Planning sample calculations
//   Hand-verified textbook formulas
//
// No bundle required (lib has no bundle dependency).
// =====================================================================

import * as fm from './financial-math.js';

let pass = 0, fail = 0;
const FAILURES = [];

const TOL = 1e-4;

function approx(actual, expected, tol = TOL) {
  if (typeof actual !== 'number' || typeof expected !== 'number') return false;
  return Math.abs(actual - expected) < tol;
}

function test(name, actual, expected, tol = TOL) {
  if (approx(actual, expected, tol)) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    const msg = `  ✗ ${name}: got ${actual}, expected ${expected} (tol ${tol})`;
    console.log(msg);
    FAILURES.push(msg);
  }
}

function testEqual(name, actual, expected) {
  if (actual === expected) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    const msg = `  ✗ ${name}: got ${actual}, expected ${expected}`;
    console.log(msg);
    FAILURES.push(msg);
  }
}

function testThrows(name, fn) {
  try {
    fn();
    fail++;
    const msg = `  ✗ ${name}: expected throw, none happened`;
    console.log(msg);
    FAILURES.push(msg);
  } catch (e) {
    pass++;
    console.log(`  ✓ ${name} (threw: "${e.message}")`);
  }
}

function section(label) {
  console.log(`\n--- ${label} ---`);
}

console.log('=== financial-math.js smoke tests ===');

// ---------------------------------------------------------------------
section('§B — pv / fv (single sum)');
// ---------------------------------------------------------------------
// PV of £1000 in 10 years at 5% = £613.91 [BMA Ch.2]
test('pv(1000, 0.05, 10) = 613.913253', fm.pv(1000, 0.05, 10), 613.913253);
test('fv(1000, 0.05, 10) = 1628.894627', fm.fv(1000, 0.05, 10), 1628.894627);
test('pv(0, 0.05, 10) = 0', fm.pv(0, 0.05, 10), 0);
test('fv(amount, 0, n) = amount (no growth)', fm.fv(500, 0, 30), 500);
test('pv at zero rate = amount', fm.pv(500, 0, 30), 500);
test('fv negative rate (deflation)', fm.fv(1000, -0.02, 10), 1000 * Math.pow(0.98, 10));
test('pv/fv round-trip', fm.pv(fm.fv(1234, 0.07, 15), 0.07, 15), 1234, 1e-9);

// ---------------------------------------------------------------------
section('§C — annuity (PV/FV)');
// ---------------------------------------------------------------------
// Standard annuity: £100/yr for 10 yrs at 5% [CII-AF4]
test('pvAnnuity(100, 0.05, 10) ordinary = 772.173493',
     fm.pvAnnuity(100, 0.05, 10), 772.173493);
test('pvAnnuity(100, 0.05, 10) due = 810.782168',
     fm.pvAnnuity(100, 0.05, 10, 'due'), 810.782168);
test('fvAnnuity(100, 0.05, 10) ordinary = 1257.789254',
     fm.fvAnnuity(100, 0.05, 10), 1257.789254);
test('fvAnnuity(100, 0.05, 10) due = 1320.678717',
     fm.fvAnnuity(100, 0.05, 10, 'due'), 1320.678717);
test('pvAnnuity zero rate = pmt × n', fm.pvAnnuity(100, 0, 10), 1000);
test('fvAnnuity zero rate = pmt × n', fm.fvAnnuity(100, 0, 10), 1000);
// Due is ordinary × (1+r)
test('due = ordinary × (1+r) [pv]',
     fm.pvAnnuity(100, 0.05, 10, 'due'),
     fm.pvAnnuity(100, 0.05, 10) * 1.05, 1e-9);

// ---------------------------------------------------------------------
section('§D — pmt');
// ---------------------------------------------------------------------
// 30-yr £200k mortgage at 5% APR (monthly) = -£1,073.64 [CII-CF6 standard]
test('pmt(200000, 0.05/12, 360) ≈ -1073.6435',
     fm.pmt(200000, 0.05/12, 360), -1073.643517, 0.001);
// Fund £100k in 20 years at 6% annual savings
test('pmt(0, 0.06, 20, 100000) ≈ -2718.46',
     fm.pmt(0, 0.06, 20, 100000), -2718.456370, 0.01);
// Zero rate: PV/n
test('pmt zero rate = -PV/n', fm.pmt(12000, 0, 12), -1000);
// pmt × n with zero rate and FV
test('pmt zero rate, FV residual', fm.pmt(0, 0, 10, 1000), -100);

// ---------------------------------------------------------------------
section('§E — npv / npvBreakdown');
// ---------------------------------------------------------------------
// Standard project: -1000 outflow + 200/year for 6 years at 10% discount [BMA Ch.2]
// Hand calc: -1000 + 200*(1-1.1^-6)/0.1 = -1000 + 200*4.355261 = -128.94785
test('npv(0.10, [-1000, 200×6]) = -128.948',
     fm.npv(0.10, [-1000, 200, 200, 200, 200, 200, 200]), -128.947368, 0.001);
test('npv(0, sum) = sum',
     fm.npv(0, [-1000, 300, 300, 300, 300]), 200);
test('npv empty array = 0', fm.npv(0.05, []), 0);
test('npv single value = that value', fm.npv(0.05, [42]), 42);
// Period 0 is NOT discounted
test('npv([100, 0, 0]) = 100 regardless of rate',
     fm.npv(0.99, [100, 0, 0]), 100);

// npvBreakdown structure
const bd = fm.npvBreakdown(0.05, [100, 100, 100]);
testEqual('npvBreakdown contributions length', bd.contributions.length, 3);
test('npvBreakdown period 0 pv = cashflow',
     bd.contributions[0].pv, 100);
test('npvBreakdown period 1 pv = cf/1.05',
     bd.contributions[1].pv, 100 / 1.05);
test('npvBreakdown value matches npv',
     bd.value, fm.npv(0.05, [100, 100, 100]), 1e-12);

// ---------------------------------------------------------------------
section('§F — irr');
// ---------------------------------------------------------------------
// Level annuity: -1000 + 200/yr × 10. IRR ≈ 15.10%
const cf1 = [-1000, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200];
const irr1 = fm.irr(cf1);
test('irr level annuity ≈ 0.15101', irr1, 0.15101, 0.001);
test('npv(irr1, cf1) ≈ 0', fm.npv(irr1, cf1), 0, 1e-6);

// Mixed cashflows
const cf2 = [-1000, 300, 400, 500];
const irr2 = fm.irr(cf2);
test('npv(irr2, cf2) ≈ 0', fm.npv(irr2, cf2), 0, 1e-6);

// No sign change → null
testEqual('irr all positive → null', fm.irr([100, 100, 100]), null);
testEqual('irr all negative → null', fm.irr([-100, -100, -100]), null);
testEqual('irr too short → null', fm.irr([100]), null);
testEqual('irr empty → null', fm.irr([]), null);

// ---------------------------------------------------------------------
section('§G — Fisher (real / nominal)');
// ---------------------------------------------------------------------
// 5% nominal, 2% inflation → 2.94% real [textbook]
test('realFromNominal(0.05, 0.02) = 0.029412',
     fm.realFromNominal(0.05, 0.02), 0.029411764706, 1e-9);
test('nominalFromReal(0.029412, 0.02) → 0.05',
     fm.nominalFromReal(0.029411764706, 0.02), 0.05, 1e-9);
// Round-trip
test('Fisher round-trip nominal→real→nominal',
     fm.nominalFromReal(fm.realFromNominal(0.07, 0.03), 0.03), 0.07, 1e-12);
// Zero inflation: real = nominal
test('zero inflation: real = nominal',
     fm.realFromNominal(0.05, 0), 0.05);
// Negative inflation (deflation): real > nominal
const realDef = fm.realFromNominal(0.02, -0.01);
testEqual('deflation: real > nominal', realDef > 0.02, true);

// ---------------------------------------------------------------------
section('§H — rate conversion');
// ---------------------------------------------------------------------
// 5% APR monthly compounded → ~5.116% effective annual
test('EAR from monthly periodic',
     fm.effectiveAnnualFromPeriodic(0.05/12, 12), 0.051161898, 1e-6);
// Round-trip
test('rate conversion round-trip',
     fm.effectiveAnnualFromPeriodic(
       fm.periodicFromEffectiveAnnual(0.05, 12), 12),
     0.05, 1e-12);
// Zero periodic rate
test('zero periodic → zero EAR',
     fm.effectiveAnnualFromPeriodic(0, 12), 0);

// ---------------------------------------------------------------------
section('§Z — input validation (throws)');
// ---------------------------------------------------------------------
testThrows('pv NaN amount', () => fm.pv(NaN, 0.05, 10));
testThrows('pv Infinity rate', () => fm.pv(100, Infinity, 10));
testThrows('pv rate = -1 (invalid)', () => fm.pv(100, -1, 10));
testThrows('pv rate < -1 (invalid)', () => fm.pv(100, -1.5, 10));
testThrows('npv non-array', () => fm.npv(0.05, 'not-an-array'));
testThrows('npv NaN inside cashflows', () => fm.npv(0.05, [100, NaN, 50]));
testThrows('pmt zero periods', () => fm.pmt(1000, 0.05, 0));
testThrows('pvAnnuity bad type', () => fm.pvAnnuity(100, 0.05, 10, 'bogus'));
testThrows('fvAnnuity bad type', () => fm.fvAnnuity(100, 0.05, 10, 'bogus'));
testThrows('pmt bad type', () => fm.pmt(1000, 0.05, 10, 0, 'bogus'));
testThrows('realFromNominal inflation = -1', () => fm.realFromNominal(0.05, -1));
testThrows('effAnnual periodsPerYear = 0', () => fm.effectiveAnnualFromPeriodic(0.05, 0));
testThrows('effAnnual periodsPerYear < 0', () => fm.effectiveAnnualFromPeriodic(0.05, -12));

// ---------------------------------------------------------------------
console.log(`\n=== RESULT ===`);
console.log(`${pass} passed, ${fail} failed (${pass + fail} total)`);
if (fail > 0) {
  console.log('\nFAILURES:');
  FAILURES.forEach(f => console.log(f));
  process.exit(1);
}
process.exit(0);
