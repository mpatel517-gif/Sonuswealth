// ─────────────────────────────────────────────────────────────────────────────
// v0.3 ROUTE-SPECS — PHASE 1 SANITY TEST
//
// Verifies:
//   · 28 new TAX bundle keys exist with correct values (MASTER-SPEC §3.4)
//   · 4 new engine helpers exist and are callable
//   · paFreezeUntil is '2031-04-05' (NOT 2030)
//   · srsAllowance is NOT in TAX (was fabricated in v0.2)
//   · monteCarloPOS perf < 500ms at 5000 simulations
//
// Run: node tests/v0.3-bundle.test.js
// Exit code: 0 = pass, 1 = fail.
// ─────────────────────────────────────────────────────────────────────────────

import { TAX } from '../src/engine/_bundle.js';
import { runwayWithDrawdown } from '../src/engine/_helpers.js';
import { ihtProjection, ihtDeltaPrePost2027 } from '../src/engine/canonical-metrics.js';
import { monteCarloPOS } from '../src/engine/scenarios.js';

let pass = 0, fail = 0;
const fails = [];

function check(label, actual, expected) {
  const ok = actual === expected;
  if (ok) { pass++; console.log(`  ✓ ${label}`); }
  else    { fail++; fails.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); console.log(`  ✗ ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`); }
}

function checkTruthy(label, actual) {
  const ok = !!actual;
  if (ok) { pass++; console.log(`  ✓ ${label}`); }
  else    { fail++; fails.push(`${label}: was falsy (${JSON.stringify(actual)})`); console.log(`  ✗ ${label}: was falsy`); }
}

function checkDeep(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; console.log(`  ✓ ${label}`); }
  else    { fail++; fails.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); console.log(`  ✗ ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`); }
}

// ── §A — Bundle key existence + values ─────────────────────────────────────
console.log('\n§A — Bundle keys (MASTER-SPEC §3.4)');

// Income tax / NIC
check('adjustedNetIncomeCliff', TAX.adjustedNetIncomeCliff, 100000);
check('nicClass1Main', TAX.nicClass1Main, 0.08);
check('nicClass4Main', TAX.nicClass4Main, 0.06);
check('employerNICRate', TAX.employerNICRate, 0.15);
check('employerNICThreshold', TAX.employerNICThreshold, 5000);
check('hicbcFloor', TAX.hicbcFloor, 60000);
check('hicbcCeiling', TAX.hicbcCeiling, 80000);

// Dividends
check('dividendBR', TAX.dividendBR, 0.1075);
check('dividendHR', TAX.dividendHR, 0.3575);
check('dividendAR', TAX.dividendAR, 0.3935);

// Pension
check('taperedAATIThreshold', TAX.taperedAATIThreshold, 200000);
check('taperedAAAdj (pre-existing)', TAX.taperedAAAdj, 260000);
check('taperedAAFloor (pre-existing)', TAX.taperedAAFloor, 10000);
checkTruthy('statePensionFull (pre-existing) ~ £12,547', Math.abs(TAX.statePensionFull - 12547.6) < 1);
check('s455Rate', TAX.s455Rate, 0.3375);

// IHT / Estate
check('bprCombinedCap', TAX.bprCombinedCap, 2500000);
check('aimBPRRate', TAX.aimBPRRate, 0.50);
checkDeep('petTaperByYear', TAX.petTaperByYear, [0, 0, 0, 0.2, 0.4, 0.6, 0.8, 1.0]);
check('smallGiftsExemption', TAX.smallGiftsExemption, 250);
check('weddingGiftToChild', TAX.weddingGiftToChild, 5000);
check('weddingGiftToGrandchild', TAX.weddingGiftToGrandchild, 2500);
check('weddingGiftOther', TAX.weddingGiftOther, 1000);
check('annualGiftExemption', TAX.annualGiftExemption, 3000);
check('normalExpenditureFromIncome', TAX.normalExpenditureFromIncome, true);

// CGT / Property / VCT
check('cgtBasic', TAX.cgtBasic, 0.18);
check('cgtHigher', TAX.cgtHigher, 0.24);
check('badrRate', TAX.badrRate, 0.18);
check('sdltAdditionalProperty', TAX.sdltAdditionalProperty, 0.05);
check('vctITRate', TAX.vctITRate, 0.20);

// Freeze
check('paFreezeUntil', TAX.paFreezeUntil, '2031-04-05');

// Anti-existence
check('srsAllowance NOT present (was fabricated)', TAX.srsAllowance, undefined);

// ── §B — Helpers exist + callable on a sample entity ────────────────────────
console.log('\n§B — Engine helpers callable');

const accumEntity = {
  age: 35,
  lifeStage: 2,
  assets: {
    bank: [{ balance: 30000 }],
    pensions: [{ balance: 80000, type: 'sipp' }],
    property: [{ value_gbp: 400000 }],
  },
  liabilities: [{ outstanding_balance: 200000, type: 'mortgage' }],
  monthlyExpenditure: 2500,
  income: { employment: 70000 },
  dependants: [{ relationship: 'child' }],
};

const decumEntity = {
  age: 62,
  lifeStage: 5,
  flexibleDrawdownTriggered: true,
  assets: {
    bank: [{ balance: 50000 }],
    pensions: [{ balance: 850000, type: 'sipp' }],
    property: [{ value_gbp: 1500000 }],
  },
  liabilities: [],
  monthlyExpenditure: 8500,
  drawdown: 96000,
  income: { employment: 0 },
  dependants: [{ relationship: 'child' }],
};

// B1 — runwayWithDrawdown
const accumRunway = runwayWithDrawdown(accumEntity, 12);
checkTruthy('runwayWithDrawdown(accum) returns object', accumRunway && typeof accumRunway === 'object');
check('runwayWithDrawdown(accum).isDecum === false', accumRunway.isDecum, false);
check('runwayWithDrawdown(accum).plannedDrawdownOverHorizon === 0', accumRunway.plannedDrawdownOverHorizon, 0);
checkTruthy('runwayWithDrawdown(accum).months > 0', accumRunway.months > 0);

const decumRunway = runwayWithDrawdown(decumEntity, 12);
check('runwayWithDrawdown(decum).isDecum === true', decumRunway.isDecum, true);
checkTruthy('runwayWithDrawdown(decum).plannedDrawdownOverHorizon === 96000 (scalar fallback)',
  decumRunway.plannedDrawdownOverHorizon === 96000);
// IFA face-fall #1: Bruce-style decum runway includes drawdown so months > cash-only
const cashOnlyMonths = 50000 / 8500; // 5.88
checkTruthy(`runwayWithDrawdown(decum).months > cash-only (${cashOnlyMonths.toFixed(1)})`,
  decumRunway.months > cashOnlyMonths);

// B2 — ihtProjection pre-2027
const today = ihtProjection(decumEntity, '2026-04-06');
checkTruthy('ihtProjection(today) returns object', today && typeof today === 'object');
check('ihtProjection(today).pensionsIncluded === false', today.pensionsIncluded, false);
checkTruthy('ihtProjection(today).gross > 0', today.gross > 0);
checkTruthy('ihtProjection(today).ihtDue >= 0', today.ihtDue >= 0);

// B2 — ihtProjection post-2027
const post = ihtProjection(decumEntity, '2027-04-06');
check('ihtProjection(post-2027).pensionsIncluded === true', post.pensionsIncluded, true);
checkTruthy('ihtProjection(post-2027).gross > today.gross (pension included)', post.gross > today.gross);
checkTruthy('ihtProjection(post-2027).ihtDue >= today.ihtDue', post.ihtDue >= today.ihtDue);

// B3 — ihtDeltaPrePost2027
const delta = ihtDeltaPrePost2027(decumEntity);
checkTruthy('ihtDeltaPrePost2027 returns object', delta && typeof delta === 'object');
check('ihtDeltaPrePost2027.delta = post - today', delta.delta, post.ihtDue - today.ihtDue);
checkTruthy('ihtDeltaPrePost2027.daysUntilApril2027 >= 0', delta.daysUntilApril2027 >= 0);
checkTruthy('ihtDeltaPrePost2027.todayDetail present', delta.todayDetail && delta.todayDetail.ihtDue === today.ihtDue);

// B4 — monteCarloPOS
console.log('\n§C — Monte Carlo POS perf');
const mcStart = Date.now();
const mc = monteCarloPOS(decumEntity, [96000, 96000, 96000, 96000, 96000], { simulations: 5000, terminalAge: 95 });
const mcElapsed = Date.now() - mcStart;
checkTruthy('monteCarloPOS returns object', mc && typeof mc === 'object');
checkTruthy('monteCarloPOS.probability is number 0-100', typeof mc.probability === 'number' && mc.probability >= 0 && mc.probability <= 100);
checkTruthy('monteCarloPOS.percentilesByAge is array', Array.isArray(mc.percentilesByAge));
checkTruthy('monteCarloPOS.percentilesByAge has rows', mc.percentilesByAge.length > 0);
checkTruthy(`monteCarloPOS perf < 500ms (got ${mcElapsed}ms)`, mcElapsed < 500);
checkTruthy('monteCarloPOS first row has p10/p50/p90', mc.percentilesByAge[0].p10 !== undefined && mc.percentilesByAge[0].p50 !== undefined && mc.percentilesByAge[0].p90 !== undefined);

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n──────────────────────────`);
console.log(`v0.3 Phase 1 sanity test`);
console.log(`PASS: ${pass}`);
console.log(`FAIL: ${fail}`);
if (fail > 0) {
  console.log(`\nFailures:`);
  for (const f of fails) console.log(`  · ${f}`);
  process.exit(1);
}
console.log(`\nAll checks passed.`);
process.exit(0);
