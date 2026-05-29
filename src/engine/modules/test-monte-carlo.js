// =====================================================================
// SONUSWEALTH — parts/3-Engine/lib/test-monte-carlo.js
// =====================================================================
// Smoke tests for shared monte-carlo lib.
//
// Built:    s17b-1 (7 May 2026 · Phase B)
// Run:      node test-monte-carlo.js
// Exit:     0 if all pass, 1 if any fail
//
// Stochastic tests use mulberry32 for determinism (fixed seed → fixed
// expected values to high precision). Where convergence-only assertions
// are made, large N (10000+) and reasonable tolerances are used.
// =====================================================================

import * as mc from './monte-carlo.js';

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

function testTrue(name, cond, why = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else {
    fail++;
    const msg = `  ✗ ${name}${why ? ' — ' + why : ''}`;
    console.log(msg);
    FAILURES.push(msg);
  }
}

function testThrows(name, fn) {
  try { fn(); fail++; const m = `  ✗ ${name}: expected throw`; console.log(m); FAILURES.push(m); }
  catch (e) { pass++; console.log(`  ✓ ${name} (threw)`); }
}

function section(label) { console.log(`\n--- ${label} ---`); }

console.log('=== monte-carlo.js smoke tests ===');

// ---------------------------------------------------------------------
section('§B — mulberry32 PRNG');
// ---------------------------------------------------------------------
const rng1 = mc.mulberry32(42);
const rng2 = mc.mulberry32(42);
const seq1 = [rng1(), rng1(), rng1(), rng1(), rng1()];
const seq2 = [rng2(), rng2(), rng2(), rng2(), rng2()];
testTrue('same seed → identical sequence',
         seq1.every((v, i) => v === seq2[i]));

const rng3 = mc.mulberry32(43);
const seq3 = [rng3(), rng3(), rng3()];
testTrue('different seeds → different sequences',
         seq1[0] !== seq3[0] || seq1[1] !== seq3[1] || seq1[2] !== seq3[2]);

// All values in [0, 1)
const rng4 = mc.mulberry32(12345);
let allInRange = true;
let allUnique = new Set();
for (let i = 0; i < 1000; i++) {
  const v = rng4();
  if (v < 0 || v >= 1) allInRange = false;
  allUnique.add(v);
}
testTrue('1000 samples all in [0, 1)', allInRange);
testTrue('1000 samples all distinct (no obvious cycling)', allUnique.size === 1000);

// Mean of large N from uniform[0,1) ≈ 0.5
const rng5 = mc.mulberry32(99);
let usum = 0;
const N = 50000;
for (let i = 0; i < N; i++) usum += rng5();
test('uniform mean over 50k ≈ 0.5', usum / N, 0.5, 0.01);

// ---------------------------------------------------------------------
section('§C — sampleNormal');
// ---------------------------------------------------------------------
// Convergence: 50k samples from N(0,1) → mean ≈ 0, std ≈ 1
{
  const rng = mc.mulberry32(7);
  const xs = [];
  for (let i = 0; i < 50000; i++) xs.push(mc.sampleNormal(0, 1, rng));
  const s = mc.summarise(xs);
  test('N(0,1) sample mean ≈ 0', s.mean, 0, 0.02);
  test('N(0,1) sample stdDev ≈ 1', s.stdDev, 1, 0.02);
}

// Convergence: N(7, 2) → mean ≈ 7, std ≈ 2
{
  const rng = mc.mulberry32(8);
  const xs = [];
  for (let i = 0; i < 50000; i++) xs.push(mc.sampleNormal(7, 2, rng));
  const s = mc.summarise(xs);
  test('N(7, 2) sample mean ≈ 7', s.mean, 7, 0.05);
  test('N(7, 2) sample stdDev ≈ 2', s.stdDev, 2, 0.05);
}

// stdDev = 0 collapses to mean
{
  const rng = mc.mulberry32(9);
  const v = mc.sampleNormal(5, 0, rng);
  test('sampleNormal(5, 0) = 5', v, 5);
}

// ---------------------------------------------------------------------
section('§C — logNormalParamsFromMeanStd');
// ---------------------------------------------------------------------
// Round-trip: arithmetic mean=1.07, std=0.15 → sample → recover mean/std
{
  const { mu, sigma } = mc.logNormalParamsFromMeanStd(1.07, 0.15);
  const rng = mc.mulberry32(11);
  const xs = [];
  for (let i = 0; i < 100000; i++) xs.push(mc.sampleLognormal(mu, sigma, rng));
  const s = mc.summarise(xs);
  test('lognormal arithmetic mean recovered ≈ 1.07', s.mean, 1.07, 0.005);
  test('lognormal arithmetic stdDev recovered ≈ 0.15', s.stdDev, 0.15, 0.005);
  testTrue('lognormal samples all > 0', xs.every(x => x > 0));
}

// mu=0, sigma=0 → constant 1
{
  const v = mc.sampleLognormal(0, 0, mc.mulberry32(12));
  test('lognormal(0,0) = 1', v, 1);
}

// ---------------------------------------------------------------------
section('§D — simulate');
// ---------------------------------------------------------------------
// Trivial: deterministic increment, no rng usage
{
  const result = mc.simulate({
    runs: 3,
    periods: 5,
    initialState: { x: 0 },
    step: (state, period) => ({ x: state.x + 1 }),
    rng: mc.mulberry32(1),
  });
  testEqual('simulate trajectories.length = runs', result.trajectories.length, 3);
  testEqual('simulate trajectory[0].length = periods + 1', result.trajectories[0].length, 6);
  testEqual('simulate final state x = 5', result.trajectories[0][5].x, 5);
  testEqual('simulate terminations[0] = periods', result.terminations[0], 5);
}

// Stochastic: seeded → reproducible
{
  const cfg = (seed) => ({
    runs: 4,
    periods: 10,
    initialState: () => ({ value: 1000 }),
    step: (state, period, rng) => ({
      value: state.value * (1 + mc.sampleNormal(0.05, 0.10, rng)),
    }),
    rng: mc.mulberry32(seed),
  });
  const r1 = mc.simulate(cfg(42));
  const r2 = mc.simulate(cfg(42));
  testTrue('seeded simulate fully reproducible',
           JSON.stringify(r1.trajectories) === JSON.stringify(r2.trajectories));
  const r3 = mc.simulate(cfg(43));
  testTrue('different seed → different trajectories',
           JSON.stringify(r1.trajectories) !== JSON.stringify(r3.trajectories));
}

// Early termination
{
  const result = mc.simulate({
    runs: 2,
    periods: 100,
    initialState: { v: 100 },
    step: (state, period) => ({ v: state.v - 10 }),
    terminate: (state) => state.v <= 0,
    rng: mc.mulberry32(1),
  });
  testEqual('simulate terminates early when condition met', result.terminations[0], 10);
  testEqual('simulate trajectory truncates to termination',
            result.trajectories[0].length, 11);  // initial + 10 periods
}

// initialState as function — fresh state each run (no shared mutation)
{
  const result = mc.simulate({
    runs: 2,
    periods: 3,
    initialState: () => ({ items: [] }),  // fresh array each run
    step: (state, period) => {
      state.items.push(period);
      return state;
    },
    rng: mc.mulberry32(1),
  });
  testEqual('initialState fn: run 1 final items.length = 3',
            result.trajectories[0][3].items.length, 3);
  testEqual('initialState fn: run 2 final items.length = 3 (not 6 — fresh)',
            result.trajectories[1][3].items.length, 3);
}

// ---------------------------------------------------------------------
section('§E — summarise');
// ---------------------------------------------------------------------
// [1..10] hand-verified
{
  const s = mc.summarise([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  testEqual('count = 10', s.count, 10);
  testEqual('min = 1', s.min, 1);
  testEqual('max = 10', s.max, 10);
  test('mean = 5.5', s.mean, 5.5);
  test('median = 5.5', s.median, 5.5);
  // pop stdDev of [1..10] = sqrt(8.25) ≈ 2.8723
  test('stdDev = sqrt(8.25)', s.stdDev, Math.sqrt(8.25));
  // PERCENTILE.INC of [1..10]:
  //   p25: 0.25 * 9 = 2.25 → 1+2.25*1 = 3.25 (interpolate index 2,3 → 3,4)
  //                       wait: index 2.25 → between sorted[2]=3 and sorted[3]=4
  //                       3 + 0.25*(4-3) = 3.25
  test('p25 = 3.25', s.p25, 3.25);
  test('p50 = 5.5', s.p50, 5.5);
  test('p75 = 7.75', s.p75, 7.75);
  // p5: idx = 0.05 * 9 = 0.45 → 1 + 0.45*(2-1) = 1.45
  test('p5 = 1.45', s.p5, 1.45);
  // p95: idx = 0.95 * 9 = 8.55 → 9 + 0.55*(10-9) = 9.55
  test('p95 = 9.55', s.p95, 9.55);
}

// Single-value array
{
  const s = mc.summarise([42]);
  testEqual('single value count = 1', s.count, 1);
  testEqual('single value mean = 42', s.mean, 42);
  testEqual('single value stdDev = 0', s.stdDev, 0);
  testEqual('single value p5 = 42', s.p5, 42);
  testEqual('single value p95 = 42', s.p95, 42);
}

// Empty array
{
  const s = mc.summarise([]);
  testEqual('empty count = 0', s.count, 0);
  testTrue('empty mean = NaN', Number.isNaN(s.mean));
  testTrue('empty stdDev = NaN', Number.isNaN(s.stdDev));
}

// Symmetric: mean = median
{
  const s = mc.summarise([-5, -3, -1, 1, 3, 5]);
  testTrue('symmetric: mean = median', Math.abs(s.mean - s.median) < 1e-12);
  test('symmetric mean = 0', s.mean, 0);
}

// ---------------------------------------------------------------------
section('§F — probAbove / probBelow');
// ---------------------------------------------------------------------
testEqual('probAbove([1..10], 5) = 5/10 = 0.5',
          mc.probAbove([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5), 0.5);
testEqual('probAbove strict (>): probAbove([1..10], 10) = 0',
          mc.probAbove([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 10), 0);
testEqual('probBelow([1..10], 5) = 4/10 = 0.4',
          mc.probBelow([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5), 0.4);
testEqual('probAbove empty array = 0', mc.probAbove([], 0), 0);
testEqual('probBelow empty array = 0', mc.probBelow([], 0), 0);

// Convergence: P(N(0,1) > 0) ≈ 0.5
{
  const rng = mc.mulberry32(13);
  const xs = [];
  for (let i = 0; i < 20000; i++) xs.push(mc.sampleNormal(0, 1, rng));
  test('P(N(0,1) > 0) ≈ 0.5', mc.probAbove(xs, 0), 0.5, 0.02);
  // P(N(0,1) > 1.96) ≈ 0.025
  test('P(N(0,1) > 1.96) ≈ 0.025', mc.probAbove(xs, 1.96), 0.025, 0.005);
}

// ---------------------------------------------------------------------
section('§Z — input validation (throws)');
// ---------------------------------------------------------------------
testThrows('mulberry32 NaN seed', () => mc.mulberry32(NaN));
testThrows('sampleNormal NaN mean', () => mc.sampleNormal(NaN, 1));
testThrows('sampleNormal negative stdDev', () => mc.sampleNormal(0, -1));
testThrows('sampleLognormal negative sigma', () => mc.sampleLognormal(0, -0.1));
testThrows('logNormalParams mean = 0', () => mc.logNormalParamsFromMeanStd(0, 0.1));
testThrows('logNormalParams negative mean', () => mc.logNormalParamsFromMeanStd(-1, 0.1));
testThrows('simulate runs = 0', () => mc.simulate({
  runs: 0, periods: 5, initialState: {}, step: () => ({})
}));
testThrows('simulate periods = 0', () => mc.simulate({
  runs: 1, periods: 0, initialState: {}, step: () => ({})
}));
testThrows('simulate runs = 1.5', () => mc.simulate({
  runs: 1.5, periods: 5, initialState: {}, step: () => ({})
}));
testThrows('simulate missing step', () => mc.simulate({
  runs: 1, periods: 5, initialState: {}
}));
testThrows('simulate missing initialState', () => mc.simulate({
  runs: 1, periods: 5, step: () => ({})
}));
testThrows('simulate null config', () => mc.simulate(null));
testThrows('summarise non-array', () => mc.summarise('foo'));
testThrows('summarise NaN element', () => mc.summarise([1, NaN, 3]));
testThrows('probAbove non-array', () => mc.probAbove('foo', 0));
testThrows('probAbove NaN threshold', () => mc.probAbove([1, 2, 3], NaN));

// ---------------------------------------------------------------------
console.log(`\n=== RESULT ===`);
console.log(`${pass} passed, ${fail} failed (${pass + fail} total)`);
if (fail > 0) {
  console.log('\nFAILURES:');
  FAILURES.forEach(f => console.log(f));
  process.exit(1);
}
process.exit(0);
