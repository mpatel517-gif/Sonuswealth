// =====================================================================
// CAELIXA — parts/3-Engine/lib/test-canonical-coi-extras.js
// =====================================================================
// Supplementary smoke test for canonical-coi.js extras patch.
// Patched at s17b-1c-eng (Phase A · Option A · F-PHASE0-3 resolution).
//
// Run from parts/3-Engine/lib/:
//   node test-canonical-coi-extras.js
//
// This file is ADDITIVE — it does NOT replace test-canonical-coi.js
// (which carries the original 70 smoke tests from s17b-1a). At
// s17b-close, contents may be merged into test-canonical-coi.js.
//
// Coverage (10 tests):
//   §J.1 — 4-arg backward-compat (no extrasKeys field in ctx)
//   §J.2 — 5-arg with empty extras (extrasKeys = [])
//   §J.3 — 5-arg injecting custom key (handler receives it)
//   §J.4 — override resolved value (audit note appended)
//   §J.5 — reserved key blocked (resolverNotes)
//   §J.6 — bad extras type rejected (array)
//   §J.7 — bad extras type rejected (function)
//   §J.8 — extras null treated as absent
//   §J.9 — totalCoI passes extras through to all 12 domains
//   §J.10 — purity: extras don't leak across independent calls
// =====================================================================

import {
  ACTION_DOMAINS,
  DEFAULT_HANDLERS,
  composeHandlers,
  costOfInaction,
  totalCoI,
} from './canonical-coi.js';

let pass = 0, fail = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    const msg = detail ? `${name} — ${detail}` : name;
    failures.push(msg);
    console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`);
  }
}

function checkThrows(name, fn, msgFragment) {
  try {
    fn();
    fail++;
    failures.push(`${name} — expected throw, got success`);
    console.log(`  ✗ ${name} — expected throw`);
  } catch (e) {
    if (msgFragment && !e.message.includes(msgFragment)) {
      fail++;
      failures.push(`${name} — threw wrong msg: "${e.message}"`);
      console.log(`  ✗ ${name} — threw wrong msg: "${e.message}"`);
    } else {
      pass++;
      console.log(`  ✓ ${name}`);
    }
  }
}

// Minimal valid entity (must have age or DOB per _resolveCurrentAge)
const E = { age: 50 };

// Bundle minimal — uses defaults for everything (FCA 2% etc.)
const B = {};

// Probe handler that captures ctx for inspection
let _capturedCtx = null;
function makeProbeHandler() {
  _capturedCtx = null;
  return function probe(_entity, _bundle, ctx) {
    _capturedCtx = ctx;
    return {
      status: 'NOT_APPLICABLE',
      currentPath: [],
      optimalPath: [],
      action: { currentDescription: '', optimalDescription: '', outcome: '' },
      rules: [],
      notes: 'probe',
    };
  };
}

// IMPLEMENTED handler returning known cashflows for NPV-aware tests
function makeImplementedHandler(currentPath, optimalPath) {
  return function impl(_entity, _bundle, _ctx) {
    return {
      status: 'IMPLEMENTED',
      currentPath,
      optimalPath,
      action: {
        currentDescription: 'do nothing',
        optimalDescription: 'do something',
        outcome: 'better outcome',
      },
      rules: ['test-rule'],
    };
  };
}

// ============================================================
// §J.1 — 4-arg backward-compat: no extrasKeys field
// ============================================================
console.log('\n§J.1 — 4-arg backward-compat (extras absent)');
{
  const r = costOfInaction(E, 'estatePlanning', B, DEFAULT_HANDLERS);
  const ctxKeys = Object.keys(r.breakdown.ctx).sort();
  const expected = ['currentAge', 'discountRateReal', 'horizonYears', 'inflation', 'longevityAge'];
  check('ctx has exactly 5 keys (no extrasKeys field)', ctxKeys.length === 5);
  check('ctx keys are exactly the standard 5',
    JSON.stringify(ctxKeys) === JSON.stringify(expected),
    `got ${JSON.stringify(ctxKeys)}`);
  check('extrasKeys field absent', !('extrasKeys' in r.breakdown.ctx));
  check('amount is 0 (OPEN handler)', r.amount === 0);
  check('rules contain canonical citation', r.rules[0].includes('MM v2.6 §0.1'));
}

// ============================================================
// §J.2 — 5-arg with empty extras: extrasKeys = []
// ============================================================
console.log('\n§J.2 — 5-arg with empty extras');
{
  const r = costOfInaction(E, 'estatePlanning', B, DEFAULT_HANDLERS, {});
  check('extrasKeys field present', 'extrasKeys' in r.breakdown.ctx);
  check('extrasKeys is empty array',
    Array.isArray(r.breakdown.ctx.extrasKeys) && r.breakdown.ctx.extrasKeys.length === 0);
  check('amount unchanged from 4-arg call', r.amount === 0);
}

// ============================================================
// §J.3 — Inject custom key (handler receives ctx.cma)
// ============================================================
console.log('\n§J.3 — extras inject custom key (ctx.cma)');
{
  const probe = makeProbeHandler();
  const handlers = composeHandlers(DEFAULT_HANDLERS, { drawdown: probe });
  const fakeCMA = { giltYields: [{ duration_years: 10, yield: 0.0455 }] };
  const r = costOfInaction(E, 'drawdown', B, handlers, { cma: fakeCMA });

  check('handler received ctx.cma', _capturedCtx && _capturedCtx.cma === fakeCMA);
  check('ctx.cma giltYields array passed through',
    _capturedCtx && _capturedCtx.cma.giltYields[0].yield === 0.0455);
  check('extrasKeys lists "cma"',
    JSON.stringify(r.breakdown.ctx.extrasKeys) === JSON.stringify(['cma']));
  check('standard ctx fields still present',
    typeof _capturedCtx.discountRateReal === 'number' &&
    typeof _capturedCtx.horizonYears === 'number');
}

// ============================================================
// §J.4 — Override resolved value (discountRateReal)
// ============================================================
console.log('\n§J.4 — override discountRateReal via extras');
{
  const probe = makeProbeHandler();
  const handlers = composeHandlers(DEFAULT_HANDLERS, { drawdown: probe });
  const r = costOfInaction(E, 'drawdown', B, handlers, { discountRateReal: 0.0255 });

  check('ctx.discountRateReal overridden to 0.0255',
    _capturedCtx.discountRateReal === 0.0255);
  check('breakdown.ctx.discountRateReal reflects override',
    r.breakdown.ctx.discountRateReal === 0.0255);
  const overrideRule = r.rules.find(rule => rule.startsWith('[override] discountRateReal'));
  check('rules contain [override] audit note for discountRateReal',
    overrideRule !== undefined,
    `rules: ${JSON.stringify(r.rules)}`);
  check('override note records previous value',
    overrideRule && overrideRule.includes('was 0.02'));
  check('extrasKeys lists "discountRateReal"',
    JSON.stringify(r.breakdown.ctx.extrasKeys) === JSON.stringify(['discountRateReal']));
}

// ============================================================
// §J.4b — Override actually changes NPV (functional, not cosmetic)
// ============================================================
console.log('\n§J.4b — override changes NPV computation');
{
  // Path: -100 today, +200 in year 5. NPV at 2% real ≈ +81.13. NPV at 10% ≈ +24.18.
  const impl = makeImplementedHandler(
    [-100, 0, 0, 0, 0, 0],   // current: just lose 100 upfront
    [-100, 0, 0, 0, 0, 200]  // optimal: lose 100, gain 200 in year 5
  );
  const handlers = composeHandlers(DEFAULT_HANDLERS, { drawdown: impl });

  const rDefault = costOfInaction(E, 'drawdown', B, handlers);  // 2% default
  const rOverride = costOfInaction(E, 'drawdown', B, handlers, { discountRateReal: 0.10 });

  check('default rate produces non-zero CoI', rDefault.amount > 0);
  check('higher discount rate reduces CoI',
    rOverride.amount < rDefault.amount,
    `default=${rDefault.amount} override=${rOverride.amount}`);
}

// ============================================================
// §J.5 — Reserved key (resolverNotes) blocked
// ============================================================
console.log('\n§J.5 — reserved key blocked');
{
  checkThrows('extras with resolverNotes throws',
    () => costOfInaction(E, 'estatePlanning', B, DEFAULT_HANDLERS,
      { resolverNotes: ['malicious'] }),
    'resolverNotes');
}

// ============================================================
// §J.6 — Bad extras type (array) rejected
// ============================================================
console.log('\n§J.6 — array as extras rejected');
{
  checkThrows('extras as array throws',
    () => costOfInaction(E, 'estatePlanning', B, DEFAULT_HANDLERS, [1, 2, 3]),
    'plain object');
}

// ============================================================
// §J.7 — Bad extras type (function) rejected
// ============================================================
console.log('\n§J.7 — function as extras rejected');
{
  checkThrows('extras as function throws',
    () => costOfInaction(E, 'estatePlanning', B, DEFAULT_HANDLERS, () => ({})),
    'plain object');
}

// ============================================================
// §J.8 — extras = null treated as absent (no throw)
// ============================================================
console.log('\n§J.8 — null extras treated as absent');
{
  const r = costOfInaction(E, 'estatePlanning', B, DEFAULT_HANDLERS, null);
  check('no throw with null extras', true);
  check('ctx has no extrasKeys field', !('extrasKeys' in r.breakdown.ctx));
}

// ============================================================
// §J.9 — totalCoI passes extras through
// ============================================================
console.log('\n§J.9 — totalCoI passes extras to all 12 domains');
{
  const fakeCMA = { tag: 'unique-cma-marker' };
  const result = totalCoI(E, B, DEFAULT_HANDLERS, { cma: fakeCMA });

  check('totalCoI returns aggregate envelope',
    typeof result.amount === 'number' && result.breakdown.perDomain);
  check('all 12 domains have extrasKeys = ["cma"]',
    ACTION_DOMAINS.every(d =>
      JSON.stringify(result.breakdown.perDomain[d].breakdown.ctx.extrasKeys) ===
      JSON.stringify(['cma'])));
  check('domainCount is 12',
    result.breakdown.domainCount === 12);

  // Reject bad extras at totalCoI level too (early validation)
  checkThrows('totalCoI rejects bad extras early',
    () => totalCoI(E, B, DEFAULT_HANDLERS, [1, 2]),
    'plain object');
}

// ============================================================
// §J.10 — purity: extras don't leak across calls
// ============================================================
console.log('\n§J.10 — purity (no cross-call leakage)');
{
  const probe = makeProbeHandler();
  const handlers = composeHandlers(DEFAULT_HANDLERS, { drawdown: probe });

  // Call 1: with extras
  costOfInaction(E, 'drawdown', B, handlers, { customKey: 'value-1' });
  const ctx1Snapshot = { ..._capturedCtx };
  check('call 1 captured customKey', ctx1Snapshot.customKey === 'value-1');

  // Call 2: no extras
  costOfInaction(E, 'drawdown', B, handlers);
  check('call 2 has no customKey (no leak from call 1)',
    !('customKey' in _capturedCtx));

  // Call 3: different extras
  costOfInaction(E, 'drawdown', B, handlers, { customKey: 'value-3' });
  check('call 3 sees value-3 (not stale value-1)',
    _capturedCtx.customKey === 'value-3');
}

// ============================================================
// Summary
// ============================================================
console.log('\n' + '='.repeat(60));
console.log(`canonical-coi extras patch smoke: ${pass} pass, ${fail} fail`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  · ${f}`));
  process.exit(1);
}
console.log('='.repeat(60));
