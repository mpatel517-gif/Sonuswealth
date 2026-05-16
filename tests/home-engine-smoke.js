// Smoke tests — A5 Home suite (home-engine.js)
// Run: node tests/home-engine-smoke.js
// All 6 functions tested against Bruce entity variant.

import {
  computeSinceLastVisit,
  whatActionWouldItTake,
  compositeTrajectory,
  cohortRankHistory,
  realityEngineState,
  prcPccCurrent,
} from '../src/engine/home-engine.js';

// ── Minimal entity (Bruce-like — SIPP-heavy · no drawdown · IHT exposed) ──────
const BRUCE = {
  age: 62,
  targetIncome: 120000,
  drawdown: 0,
  isHigherRateTaxpayer: true,
  jurisdiction: 'UK',
  archetype: 'wealth-concentrator',
  assets: {
    sipp: {
      total: 2_100_000,
      pensions: [
        { name: 'Main SIPP', balance: 2_100_000, nominationDate: '2019-03-01' },
      ],
    },
    isa:       { value: 200_000 },
    residence: { value: 1_800_000, mortgageBalance: 0 },
    portfolio:  { value: 300_000 },
    cash:       { total: 80_000 },
    protection: {
      lifeInsurance: { exists: true, inTrust: false, amount: 1_000_000 },
    },
  },
  income: { monthly: 0, statePension: { annual: 11502, startAge: 67, inPayment: false } },
  dependants: [{ type: 'child', age: 12 }, { type: 'child', age: 16 }],
  eventLog: [
    { eventType: 'API_PULL_VERIFIED', eventId: 'ev-001', label: 'Aviva pension updated', timestamp: new Date(Date.now() - 2 * 86_400_000).toISOString(), assetId: 'sipp', delta: 8400, actor: 'api' },
    { eventType: 'TE_IHT_RECALCULATED', eventId: 'ev-002', label: 'IHT recalculated', timestamp: new Date(Date.now() - 1 * 86_400_000).toISOString(), actor: 'system' },
  ],
};

let pass = 0;
let fail = 0;

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓  ${label}`);
    pass++;
  } else {
    console.error(`  ✗  ${label}${detail ? ` — ${detail}` : ''}`);
    fail++;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\nC97 computeSinceLastVisit');
{
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const r = computeSinceLastVisit(BRUCE, since);
  check('returns object',        typeof r === 'object' && r !== null);
  check('hasContent true',       r.hasContent === true);
  check('biggestMover present',  r.biggestMover !== null);
  check('biggestEvent present',  r.biggestEvent !== null);
  check('mostUrgentChange iht',  r.mostUrgentChange?.domain === 'iht');
  check('windowStart set',       typeof r.windowStart === 'string');
  check('rulesVersion set',      r.rulesVersion === 'HOME-1.0');

  // No events — empty entity
  const empty = computeSinceLastVisit({ age: 40 }, since);
  check('empty entity hasContent false', empty.hasContent === false);
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\nC99 whatActionWouldItTake');
{
  const currentFQ = 65; // approximate for Bruce
  const r = whatActionWouldItTake(BRUCE, 80, '2026-12');
  check('returns object',        typeof r === 'object' && r !== null);
  check('feasible is boolean',   typeof r.feasible === 'boolean');
  check('actionSet is array',    Array.isArray(r.actionSet));
  check('totalFqDelta >= 0',     r.totalFqDelta >= 0);
  check('confidence present',    ['HIGH','MED','LOW'].includes(r.confidence));
  check('rulesVersion set',      r.rulesVersion === 'HOME-1.0');

  // Already at target
  const already = whatActionWouldItTake(BRUCE, 0, '2026-12');
  check('already met: alreadyMet true', already.alreadyMet === true);

  // Action items have required fields
  if (r.actionSet.length > 0) {
    const a = r.actionSet[0];
    check('action item has id',       typeof a.action === 'string');
    check('action item has fqDelta',  typeof a.fqDelta === 'number');
    check('action item has achievable', typeof a.achievable === 'boolean');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\nC100 compositeTrajectory');
{
  const r = compositeTrajectory(BRUCE);
  check('returns object',           typeof r === 'object');
  check('yourLine is array',        Array.isArray(r.yourLine));
  check('yourLine non-empty',       r.yourLine.length > 0);
  check('cohortMedian is array',    Array.isArray(r.cohortMedian));
  check('projectedFan is array',    Array.isArray(r.projectedFan));
  check('yourLine has date/netWorth', r.yourLine[0]?.netWorth > 0 && typeof r.yourLine[0]?.date === 'string');
  check('projectedFan has p10/p50/p90', r.projectedFan[0]?.p10 < r.projectedFan[0]?.p90);
  check('cohortMedian has p25/p75', r.cohortMedian[0]?.p25 < r.cohortMedian[0]?.p75);
  check('confidence present',       r.confidence !== undefined);
  check('rulesVersion set',         r.rulesVersion === 'HOME-1.0');

  // No cohort, no fan
  const r2 = compositeTrajectory(BRUCE, null, false, false, []);
  check('cohortMedian null when excluded', r2.cohortMedian === null);
  check('projectedFan null when excluded', r2.projectedFan === null);

  // Scenario overlay
  const r3 = compositeTrajectory(BRUCE, null, false, false, [{ label: 'With drawdown', entityOverrides: { drawdown: 50000 } }]);
  check('scenarios present',        Array.isArray(r3.scenarios) && r3.scenarios.length > 0);
  check('scenario has label',       r3.scenarios[0]?.label === 'With drawdown');
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\nC101 cohortRankHistory');
{
  const r = cohortRankHistory(BRUCE, null, 12);
  check('returns object',            typeof r === 'object');
  check('monthlyRanks is array[12]', r.monthlyRanks.length === 12);
  check('each rank has month + percentile', r.monthlyRanks.every(m => typeof m.month === 'string' && m.percentile >= 1 && m.percentile <= 99));
  check('averageRank in range',      r.averageRank >= 1 && r.averageRank <= 99);
  check('trend valid',               ['climbing','stable','falling'].includes(r.trend));
  check('confidence LOW',            r.confidence === 'LOW');
  check('rulesVersion set',          r.rulesVersion === 'HOME-1.0');

  // Deterministic — same entity, same output
  const r2 = cohortRankHistory(BRUCE, null, 12);
  check('deterministic output', JSON.stringify(r.monthlyRanks) === JSON.stringify(r2.monthlyRanks));
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\nC102 realityEngineState');
{
  const r = realityEngineState(BRUCE);
  check('returns object',            typeof r === 'object');
  check('personal ring present',     typeof r.personal?.state === 'string');
  check('system ring present',       typeof r.system?.state === 'string');
  check('external ring present',     typeof r.external?.state === 'string');
  check('personal state valid',      ['calm','watch','active'].includes(r.personal.state));
  check('system state valid',        ['calm','watch','active'].includes(r.system.state));
  check('external state valid',      ['calm','watch','active'].includes(r.external.state));
  check('overallPressure valid',     ['low','medium','high'].includes(r.overallPressure));
  check('recommendedActions array',  Array.isArray(r.recommendedActions));
  check('personal has factors',      r.personal.factors.length > 0);
  check('system has finance_act factor', r.system.factors.some(f => f.id === 'finance_act_2026_dc_iht'));
  check('external has inflation',    r.external.factors.some(f => f.id === 'inflation'));

  // Bruce: stale nominations → personal watch expected
  check('Bruce personal not calm (stale nom)', r.personal.state !== 'calm');
  // Bruce: Finance Act 2026 within 1yr → system watch expected
  check('Bruce system at watch or active', r.system.state !== 'calm');
  // IHT recommendation present for Bruce
  check('review_iht_position recommended', r.recommendedActions.includes('review_iht_position'));
  check('rulesVersion set', r.rulesVersion === 'HOME-1.0');
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\nC103 prcPccCurrent');
{
  const r = prcPccCurrent(BRUCE);
  check('returns object',             typeof r === 'object');
  check('prcCurrent is number',       typeof r.prcCurrent === 'number');
  check('pccCurrent is number',       typeof r.pccCurrent === 'number');
  check('spread is number',           typeof r.spread === 'number');
  check('spreadDirection valid',      ['positive','negative'].includes(r.spreadDirection));
  check('bestDecision present',       r.bestDecision !== null);
  check('confidence present',         ['HIGH','MED','LOW','INSUFFICIENT'].includes(r.confidence));
  check('rulesVersion set',           r.rulesVersion === 'HOME-1.0');
  check('prc > 0 for Bruce',          r.prcCurrent > 0);
  check('spread = prc - pcc approx',  Math.abs(r.spread - (r.prcCurrent - r.pccCurrent)) < 0.1);

  // Insufficient data entity
  const poor = prcPccCurrent({ age: 40 });
  check('insufficient entity returns INSUFFICIENT', poor.confidence === 'INSUFFICIENT');
  check('insufficient entity spread null', poor.spread === null);
}

// ─────────────────────────────────────────────────────────────────────────────
const total = pass + fail;
console.log(`\n${'─'.repeat(50)}`);
console.log(`Home engine smoke: ${pass}/${total} pass${fail > 0 ? ` — ${fail} FAIL` : ''}`);
if (fail > 0) process.exit(1);
