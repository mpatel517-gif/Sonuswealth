#!/usr/bin/env node
// Reconcile smoke — verify timeline + risk + state-tiles + C98 stateTileJourney
// import + return non-error shapes against Bruce fixture.

import { readFileSync } from 'fs';
import {
  calcAPQTimeline, calcMilestones, calcGoalProgress,
  calcScoreHistory, calcRiskHistory,
  listScenarios, openScenario, saveScenario, updateScenario, deleteScenario,
} from '../src/engine/timeline-engine.js';
import {
  runShock, riskShockSuite, whatWouldHelpMost, projectBTR,
} from '../src/engine/risk-engine.js';
import {
  safetyNetState, debtFreeState, fiState, beneficiaryState,
} from '../src/engine/state-tiles-engine.js';
import { stateTileJourney } from '../src/engine/home-engine.js';

let pass = 0, fail = 0;
const ok = (label, cond) => cond ? (console.log(`  ✓ ${label}`), pass++) : (console.error(`  ✗ ${label}`), fail++);

const bruce = JSON.parse(readFileSync('src/rules/personas/persona-a.json', 'utf8'));

console.log('\nTimeline');
ok('calcAPQTimeline returns array', Array.isArray(calcAPQTimeline(bruce)));
ok('calcMilestones has achieved + projected',
   ['achieved','projected'].every(k => k in calcMilestones(bruce)));
ok('calcScoreHistory returns object', typeof calcScoreHistory(bruce, '12mo') === 'object');
ok('calcRiskHistory returns object', typeof calcRiskHistory(bruce, '12mo') === 'object');
const sc = saveScenario({ label: 'smoke', userId: 'u1', entityId: 'e1', data: {} });
ok('saveScenario returns id', !!sc?.scenarioId);
ok('listScenarios returns array', Array.isArray(listScenarios('u1', {})));
ok('openScenario returns object', typeof openScenario(sc.scenarioId, 'snapshot', bruce) === 'object');
ok('updateScenario returns object', typeof updateScenario(sc.scenarioId, { label: 'updated' }) === 'object');
ok('deleteScenario returns object', typeof deleteScenario(sc.scenarioId) === 'object');

console.log('\nRisk');
const shock = runShock(bruce, 'job_loss');
ok('runShock returns nwDelta + fqDelta + rsDelta',
   ['nwDelta','fqDelta','rsDelta'].every(k => k in shock));
const suite = riskShockSuite(bruce);
ok('riskShockSuite has 5 shocks',
   ['job_loss','illness','market_fall','rate_rise','death'].every(k => k in suite));
ok('whatWouldHelpMost has mitigations array',
   Array.isArray(whatWouldHelpMost(bruce, 'job_loss')?.mitigations));
ok('projectBTR returns object', typeof projectBTR(bruce, 12, 'medium') === 'object');

console.log('\nState tiles');
ok('safetyNetState has tile + progress',
   ['tile','progress'].every(k => k in safetyNetState(bruce)));
ok('debtFreeState has tile', 'tile' in debtFreeState(bruce));
ok('fiState has tile', 'tile' in fiState(bruce));
ok('beneficiaryState has tile', 'tile' in beneficiaryState(bruce));

console.log('\nC98 stateTileJourney (Home + state-tiles integration)');
const j1 = stateTileJourney(bruce, 'safety_net');
ok('safety_net journey has direction', 'direction' in j1);
const j2 = stateTileJourney(bruce, 'fi');
ok('fi journey has coiOfDelay key', 'coiOfDelay' in j2);
const j3 = stateTileJourney(bruce, 'beneficiary');
ok('beneficiary journey has tileState', 'tileState' in j3);
let threw = false;
try { stateTileJourney(bruce, 'unknown_tile'); } catch { threw = true; }
ok('unknown tile throws', threw);

console.log(`\n──────────\nReconcile smoke: ${pass}/${pass + fail} pass`);
process.exit(fail ? 1 : 0);
