// =====================================================================
// SONUSWEALTH — parts/3-Engine/lib/test-canonical-coi.js
// =====================================================================
// Smoke tests for canonical CoI module.
//
// Built:    s17b-1 (7 May 2026 · Phase C)
// Run:      node test-canonical-coi.js
// =====================================================================

import {
  ACTION_DOMAINS,
  DEFAULT_HANDLERS,
  composeHandlers,
  costOfInaction,
  totalCoI,
} from './canonical-coi.js';

let pass = 0, fail = 0;
const FAILURES = [];
const TOL = 1e-4;

function approx(a, e, t = TOL) {
  return typeof a === 'number' && typeof e === 'number' && Math.abs(a - e) < t;
}
function test(name, actual, expected, tol = TOL) {
  if (approx(actual, expected, tol)) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; const m = `  ✗ ${name}: got ${actual}, expected ${expected}`; console.log(m); FAILURES.push(m); }
}
function testEqual(name, actual, expected) {
  if (actual === expected) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; const m = `  ✗ ${name}: got ${actual}, expected ${expected}`; console.log(m); FAILURES.push(m); }
}
function testTrue(name, cond, why = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; const m = `  ✗ ${name}${why ? ' — ' + why : ''}`; console.log(m); FAILURES.push(m); }
}
function testThrows(name, fn) {
  try { fn(); fail++; const m = `  ✗ ${name}: expected throw`; console.log(m); FAILURES.push(m); }
  catch (e) { pass++; console.log(`  ✓ ${name} (threw)`); }
}
function section(label) { console.log(`\n--- ${label} ---`); }

console.log('=== canonical-coi.js smoke tests ===');

// Stable mock entity
const mockEntity = { age: 60 };

// ---------------------------------------------------------------------
section('§A — ACTION_DOMAINS canonical list');
// ---------------------------------------------------------------------
testEqual('exactly 12 canonical domains', ACTION_DOMAINS.length, 12);
testTrue('frozen', Object.isFrozen(ACTION_DOMAINS));
const expectedDomains = [
  'drawdown', 'wrapperSequencing', 'taxAllowances', 'pensionTiming',
  'estatePlanning', 'protection', 'contributions', 'debt',
  'gifting', 'propertyDecisions', 'investmentStrategy', 'longTermCare',
];
testTrue('matches MM v2.6 §0.1 canonical 12',
         expectedDomains.every(d => ACTION_DOMAINS.includes(d)));

// ---------------------------------------------------------------------
section('§B — DEFAULT_HANDLERS — all 12 stubbed as OPEN');
// ---------------------------------------------------------------------
for (const d of ACTION_DOMAINS) {
  testEqual(`DEFAULT_HANDLERS.${d} is a function`,
            typeof DEFAULT_HANDLERS[d], 'function');
}
const stubResult = DEFAULT_HANDLERS.pensionTiming({}, {}, {});
testEqual('default stub status = OPEN', stubResult.status, 'OPEN');
testTrue('default stub returns valid envelope shape',
         Array.isArray(stubResult.currentPath) && Array.isArray(stubResult.optimalPath)
           && stubResult.action && Array.isArray(stubResult.rules));

// ---------------------------------------------------------------------
section('§C — composeHandlers');
// ---------------------------------------------------------------------
const customPension = (e, b, ctx) => ({
  status: 'IMPLEMENTED',
  currentPath: [-1000, 0, 0],
  optimalPath: [0, 0, 0],
  action: { currentDescription: 'A', optimalDescription: 'B', outcome: 'C' },
  rules: ['custom'],
});
const composed = composeHandlers(DEFAULT_HANDLERS, { pensionTiming: customPension });
testEqual('composed.pensionTiming = custom', composed.pensionTiming, customPension);
testEqual('composed.estatePlanning = default', composed.estatePlanning, DEFAULT_HANDLERS.estatePlanning);
// Right-to-left precedence
const c2 = composeHandlers(
  { pensionTiming: () => 'first' },
  { pensionTiming: () => 'second' }
);
testEqual('composeHandlers: later overrides earlier', c2.pensionTiming(), 'second');
// Non-function entries skipped
const c3 = composeHandlers(DEFAULT_HANDLERS, { pensionTiming: 'not-a-function' });
testEqual('composeHandlers: non-function ignored', c3.pensionTiming, DEFAULT_HANDLERS.pensionTiming);

// ---------------------------------------------------------------------
section('§D — costOfInaction — OPEN handlers return amount = 0');
// ---------------------------------------------------------------------
{
  const r = costOfInaction(mockEntity, 'pensionTiming', {}, DEFAULT_HANDLERS);
  testEqual('OPEN handler amount = 0', r.amount, 0);
  testEqual('OPEN handler status flagged', r.breakdown.status, 'OPEN');
  testTrue('rules include MM §0.1', r.rules.some(r => r.includes('MM v2.6 §0.1')));
  testTrue('explanation flags status', r.explanation.includes('OPEN'));
}

// ---------------------------------------------------------------------
section('§E — costOfInaction — IMPLEMENTED handler computes NPV delta');
// ---------------------------------------------------------------------
{
  // currentPath: lose £1000 today, nothing else
  // optimalPath: gain £0 today, £500 in y1, £500 in y2
  // At 0% discount: currentNPV = -1000, optimalNPV = 1000, CoI = 2000
  const handler = (_e, _b, _ctx) => ({
    status: 'IMPLEMENTED',
    currentPath: [-1000, 0, 0],
    optimalPath: [0, 500, 500],
    action: {
      currentDescription: 'Lose £1000 today',
      optimalDescription: 'Gain £500 in years 1 and 2',
      outcome: 'Saves £2000 in today\'s money',
    },
    rules: ['handler-source-1'],
  });
  const bundle = { coi: { discountRateReal: 0 } };  // explicit zero for hand-check
  const handlers = composeHandlers(DEFAULT_HANDLERS, { pensionTiming: handler });
  const r = costOfInaction(mockEntity, 'pensionTiming', bundle, handlers);
  test('IMPLEMENTED amount = 2000', r.amount, 2000);
  test('breakdown.currentNPV = -1000', r.breakdown.currentNPV, -1000);
  test('breakdown.optimalNPV = 1000', r.breakdown.optimalNPV, 1000);
  testEqual('breakdown.status = IMPLEMENTED', r.breakdown.status, 'IMPLEMENTED');
  testTrue('explanation in plain English',
           r.explanation.includes('Continuing your current path') &&
           r.explanation.includes('costs £'));
  testTrue('rules combine canonical + handler + (no defaults — bundle had rate)',
           r.rules.some(s => s.includes('MM v2.6')) &&
           r.rules.includes('handler-source-1'));
}

// ---------------------------------------------------------------------
section('§F — CoI ≥ 0 axiom enforced (paths can be miscoded)');
// ---------------------------------------------------------------------
{
  // Adversarial handler: optimal path WORSE than current (should never happen,
  // but if a handler is buggy, infrastructure must enforce ≥ 0)
  const buggyHandler = (_e, _b, _ctx) => ({
    status: 'IMPLEMENTED',
    currentPath: [1000],     // user has £1000 today
    optimalPath: [-500],     // "optimal" loses £500 (mis-encoded)
    action: { currentDescription: 'A', optimalDescription: 'B', outcome: 'C' },
    rules: [],
  });
  const handlers = composeHandlers(DEFAULT_HANDLERS, { pensionTiming: buggyHandler });
  const r = costOfInaction(mockEntity, 'pensionTiming', {}, handlers);
  testEqual('floor-at-0 enforced when delta would be negative', r.amount, 0);
  // Breakdown still shows the raw NPVs for diagnostics
  test('breakdown.delta is the raw negative number (diagnostic)',
       r.breakdown.delta, -1500);
}

// ---------------------------------------------------------------------
section('§G — Discount rate applied correctly');
// ---------------------------------------------------------------------
{
  // currentPath = [-1000], optimalPath = [0, 0, 0, 0, 0, 1500]  (£1500 in 5 yrs)
  // At 5% real: optimalNPV = 1500 / 1.05^5 = 1175.286
  //             currentNPV = -1000
  //             delta = 2175.286
  const handler = (_e, _b, _ctx) => ({
    status: 'IMPLEMENTED',
    currentPath: [-1000],
    optimalPath: [0, 0, 0, 0, 0, 1500],
    action: { currentDescription: 'A', optimalDescription: 'B', outcome: 'C' },
    rules: [],
  });
  const bundle = { coi: { discountRateReal: 0.05 } };
  const handlers = composeHandlers(DEFAULT_HANDLERS, { pensionTiming: handler });
  const r = costOfInaction(mockEntity, 'pensionTiming', bundle, handlers);
  test('CoI with 5% discount ≈ 2175.286', r.amount, 2175.286, 0.01);
}

// ---------------------------------------------------------------------
section('§H — Bundle resolvers — defaults flagged in `rules`');
// ---------------------------------------------------------------------
{
  const handler = (_e, _b, ctx) => ({
    status: 'IMPLEMENTED',
    currentPath: [0],
    optimalPath: [0],
    action: { currentDescription: 'A', optimalDescription: 'B', outcome: 'C' },
    rules: [],
  });
  const handlers = composeHandlers(DEFAULT_HANDLERS, { pensionTiming: handler });
  // Empty bundle → all defaults
  const r = costOfInaction(mockEntity, 'pensionTiming', {}, handlers);
  testTrue('default discount rate flagged in rules',
           r.rules.some(s => s.includes('discountRateReal') && s.includes('default')));
  testTrue('default inflation flagged in rules',
           r.rules.some(s => s.includes('inflation') && s.includes('default')));
  testTrue('default horizon flagged in rules',
           r.rules.some(s => s.includes('horizon') && s.includes('default')));
  // ctx values reflect defaults
  test('ctx.discountRateReal default = 0.02', r.breakdown.ctx.discountRateReal, 0.02);
  test('ctx.inflation default = 0.02', r.breakdown.ctx.inflation, 0.02);
  test('ctx.longevityAge default = 88', r.breakdown.ctx.longevityAge, 88);
  test('ctx.horizonYears for age 60 = 28', r.breakdown.ctx.horizonYears, 28);
}

// Bundle with full overrides
{
  const handler = (_e, _b, _ctx) => ({
    status: 'IMPLEMENTED', currentPath: [0], optimalPath: [0],
    action: { currentDescription: 'A', optimalDescription: 'B', outcome: 'C' },
    rules: [],
  });
  const handlers = composeHandlers(DEFAULT_HANDLERS, { pensionTiming: handler });
  const bundle = {
    coi: {
      discountRateReal: 0.03,
      longevityBand: 'optimistic',
      longevityAges: { conservative: 85, median: 88, optimistic: 92 },
    },
    economic: { inflation: 0.025 },
  };
  const r = costOfInaction(mockEntity, 'pensionTiming', bundle, handlers);
  test('ctx.discountRateReal from bundle = 0.03', r.breakdown.ctx.discountRateReal, 0.03);
  test('ctx.inflation from bundle = 0.025', r.breakdown.ctx.inflation, 0.025);
  test('ctx.longevityAge optimistic = 92', r.breakdown.ctx.longevityAge, 92);
  test('ctx.horizonYears = 32 (92-60)', r.breakdown.ctx.horizonYears, 32);
  testTrue('no default rules flagged when bundle complete',
           !r.rules.some(s => s.startsWith('[default]')));
}

// dateOfBirth-based age
{
  const today = new Date();
  const dob50 = new Date(today.getFullYear() - 50, today.getMonth(), today.getDate());
  const ent = { dateOfBirth: dob50.toISOString() };
  const handler = (_e, _b, _ctx) => ({
    status: 'IMPLEMENTED', currentPath: [0], optimalPath: [0],
    action: { currentDescription: 'A', optimalDescription: 'B', outcome: 'C' },
    rules: [],
  });
  const handlers = composeHandlers(DEFAULT_HANDLERS, { pensionTiming: handler });
  const r = costOfInaction(ent, 'pensionTiming', {}, handlers);
  test('age resolved from dateOfBirth ≈ 50', r.breakdown.ctx.currentAge, 50, 1);
}

// ---------------------------------------------------------------------
section('§I — totalCoI aggregation');
// ---------------------------------------------------------------------
{
  // Two implemented domains, ten OPEN
  const pHandler = (_e, _b, _ctx) => ({
    status: 'IMPLEMENTED',
    currentPath: [-100], optimalPath: [0],
    action: { currentDescription: 'A', optimalDescription: 'B', outcome: 'C' },
    rules: ['p'],
  });
  const eHandler = (_e, _b, _ctx) => ({
    status: 'IMPLEMENTED',
    currentPath: [-200], optimalPath: [0],
    action: { currentDescription: 'A', optimalDescription: 'B', outcome: 'C' },
    rules: ['e'],
  });
  const bundle = { coi: { discountRateReal: 0 } };
  const handlers = composeHandlers(DEFAULT_HANDLERS, {
    pensionTiming: pHandler,
    estatePlanning: eHandler,
  });
  const r = totalCoI(mockEntity, bundle, handlers);
  test('totalCoI sums implemented = 300', r.amount, 300);
  testEqual('domainsImplemented length = 2', r.breakdown.domainsImplemented.length, 2);
  testEqual('domainsOpen length = 10', r.breakdown.domainsOpen.length, 10);
  testEqual('domainsImplemented contains pensionTiming',
            r.breakdown.domainsImplemented.includes('pensionTiming'), true);
  testEqual('domainsImplemented contains estatePlanning',
            r.breakdown.domainsImplemented.includes('estatePlanning'), true);
  testEqual('perDomain has all 12', Object.keys(r.breakdown.perDomain).length, 12);
  testTrue('explanation reports counts',
           r.explanation.includes('2 implemented') &&
           r.explanation.includes('10 domain'));
}

// All-stubbed → total = 0
{
  const r = totalCoI(mockEntity, {}, DEFAULT_HANDLERS);
  test('all-stubbed totalCoI = 0', r.amount, 0);
  testEqual('all-stubbed domainsImplemented = 0',
            r.breakdown.domainsImplemented.length, 0);
  testEqual('all-stubbed domainsOpen = 12',
            r.breakdown.domainsOpen.length, 12);
}

// ---------------------------------------------------------------------
section('§J — NOT_APPLICABLE handlers');
// ---------------------------------------------------------------------
{
  // E.g. longTermCare not relevant for an 18-year-old in MVP scope
  const naHandler = (_e, _b, _ctx) => ({
    status: 'NOT_APPLICABLE',
    currentPath: [], optimalPath: [],
    action: { currentDescription: 'n/a', optimalDescription: 'n/a', outcome: 'n/a' },
    rules: [],
    notes: 'Out of scope for this entity profile',
  });
  const handlers = composeHandlers(DEFAULT_HANDLERS, { longTermCare: naHandler });
  const r = costOfInaction(mockEntity, 'longTermCare', {}, handlers);
  testEqual('NOT_APPLICABLE amount = 0', r.amount, 0);
  testEqual('NOT_APPLICABLE status flagged', r.breakdown.status, 'NOT_APPLICABLE');
  // totalCoI counts these separately
  const t = totalCoI(mockEntity, {}, handlers);
  testEqual('totalCoI domainsNotApplicable contains longTermCare',
            t.breakdown.domainsNotApplicable.includes('longTermCare'), true);
}

// ---------------------------------------------------------------------
section('§Z — input validation');
// ---------------------------------------------------------------------
testThrows('costOfInaction missing entity',
  () => costOfInaction(null, 'pensionTiming', {}, DEFAULT_HANDLERS));
testThrows('costOfInaction invalid actionDomain',
  () => costOfInaction(mockEntity, 'notADomain', {}, DEFAULT_HANDLERS));
testThrows('costOfInaction non-string actionDomain',
  () => costOfInaction(mockEntity, 42, {}, DEFAULT_HANDLERS));
testThrows('costOfInaction missing handlers',
  () => costOfInaction(mockEntity, 'pensionTiming', {}, null));
testThrows('costOfInaction handler not in map',
  () => costOfInaction(mockEntity, 'pensionTiming', {}, { other: () => ({}) }));
testThrows('costOfInaction handler returns non-object',
  () => costOfInaction(mockEntity, 'pensionTiming', {}, { pensionTiming: () => 'string' }));
testThrows('costOfInaction handler invalid status',
  () => costOfInaction(mockEntity, 'pensionTiming', {}, {
    pensionTiming: () => ({ status: 'BOGUS', currentPath: [], optimalPath: [],
                            action: {currentDescription:'',optimalDescription:'',outcome:''}, rules: [] }),
  }));
testThrows('costOfInaction IMPLEMENTED missing paths',
  () => costOfInaction(mockEntity, 'pensionTiming', {}, {
    pensionTiming: () => ({ status: 'IMPLEMENTED',
                            action: {currentDescription:'',optimalDescription:'',outcome:''}, rules: [] }),
  }));
testThrows('costOfInaction IMPLEMENTED missing action',
  () => costOfInaction(mockEntity, 'pensionTiming', {}, {
    pensionTiming: () => ({ status: 'IMPLEMENTED', currentPath: [], optimalPath: [], rules: [] }),
  }));
testThrows('age cannot be resolved',
  () => costOfInaction({}, 'pensionTiming', {}, DEFAULT_HANDLERS));

// ---------------------------------------------------------------------
console.log(`\n=== RESULT ===`);
console.log(`${pass} passed, ${fail} failed (${pass + fail} total)`);
if (fail > 0) {
  console.log('\nFAILURES:');
  FAILURES.forEach(f => console.log(f));
  process.exit(1);
}
process.exit(0);
