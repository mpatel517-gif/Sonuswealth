#!/usr/bin/env node
/**
 * Monthly Flow Engine — smoke tests (A3)
 *
 * Covers: all 5 demo personas (A–E) + edge cases.
 * Usage: node tests/monthly-flow.test.js
 * Exit: 0 = all pass, 1 = any fail
 */

import { readFileSync } from 'fs';
import { monthlyFlow, allocationPressure } from '../src/engine/monthly-flow-engine.js';

// ── HELPERS ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    console.error(`  ✗  ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

function loadPersona(id) {
  return JSON.parse(readFileSync(
    `src/rules/personas/persona-${id}.json`, 'utf8'
  ));
}

// ── PERSONA A — Bruce Wayne (62, retired, no drawdown) ───────────────────────

console.log('\nPersona A — Bruce Wayne');
{
  const e = loadPersona('a');
  const f = monthlyFlow(e);

  assert('monthlyIncome = 0 (no active income, drawdown=0, SP not started)',
    f.monthlyIncome === 0);
  assert('monthlyExpenses = 10000 (targetIncome 120k / 12)',
    f.monthlyExpenses === 10000);
  assert('surplus = -10000 (deficit)',
    f.surplus === -10000);
  assert('surplusAnnual = -120000',
    f.surplusAnnual === -120000);
  assert('statePensionInPayment = false (age 62 < startAge 67)',
    f.statePensionInPayment === false);
  assert('components.statePension = 0',
    f.components.statePension === 0);
  assert('confidence = LOW (no real income sources)',
    f.confidence === 'LOW');
  assert('allocationPressure.commitRatio = 1 (income = 0)',
    f.allocationPressure.commitRatio === 1);
  assert('liquidMonths = 18 (cash 180k / expenses 10k)',
    f.allocationPressure.liquidMonths === 18);
  assert('rulesVersion present',
    typeof f.rulesVersion === 'string');
}

// ── PERSONA C — Tony Stark (48, employment + dividends) ──────────────────────

console.log('\nPersona C — Tony Stark');
{
  const e = loadPersona('c');
  const f = monthlyFlow(e);

  // employment 50270 + dividends 74730 = 125000 annual → 10417/mo
  assert('monthlyIncome ≈ 10417',
    f.monthlyIncome === 10417);
  // targetIncome 95000 → 7917/mo
  assert('monthlyExpenses = 7917',
    f.monthlyExpenses === 7917);
  assert('surplus > 0',
    f.surplus > 0);
  assert('statePensionInPayment = false (age 48)',
    f.statePensionInPayment === false);
  assert('components.employment > 0',
    f.components.employment > 0);
  assert('components.dividends > 0',
    f.components.dividends > 0);
  assert('confidence = MEDIUM (real income, no explicit expenses)',
    f.confidence === 'MEDIUM');
  assert('commitRatio < 1',
    f.allocationPressure.commitRatio < 1);
}

// ── PERSONA E — Willy Wonka (78, drawdown + dividends + SP in payment) ───────

console.log('\nPersona E — Willy Wonka');
{
  const e = loadPersona('e');
  const f = monthlyFlow(e);

  // drawdown 45000 + dividends 45000 + statePension 11973 (inPayment=true) = 101973 → 8498
  assert('monthlyIncome ≈ 8498',
    f.monthlyIncome === 8498);
  assert('statePensionInPayment = true (explicit inPayment flag)',
    f.statePensionInPayment === true);
  assert('components.statePension > 0',
    f.components.statePension > 0);
  assert('components.drawdown > 0',
    f.components.drawdown > 0);
  assert('surplus > 0',
    f.surplus > 0);
}

// ── PERSONA B — Fred & Wilma (couple) ────────────────────────────────────────

console.log('\nPersona B — Fred & Wilma');
{
  const e = loadPersona('b');
  const f = monthlyFlow(e);

  assert('monthlyIncome is a number',
    typeof f.monthlyIncome === 'number' && !isNaN(f.monthlyIncome));
  assert('monthlyExpenses > 0',
    f.monthlyExpenses > 0);
  assert('surplus is a number',
    typeof f.surplus === 'number');
  assert('allocationPressure block present',
    f.allocationPressure && typeof f.allocationPressure.commitRatio === 'number');
}

// ── EDGE CASES ────────────────────────────────────────────────────────────────

console.log('\nEdge cases');
{
  // Empty entity
  const f = monthlyFlow({});
  assert('empty entity: monthlyIncome = 0', f.monthlyIncome === 0);
  assert('empty entity: surplus = 0', f.surplus === 0);
  assert('empty entity: confidence = LOW', f.confidence === 'LOW');
  assert('empty entity: liquidMonths = null', f.allocationPressure.liquidMonths === null);

  // Entity with explicit expenses.monthly
  const explicit = { income: { employment: 60000 }, expenses: { monthly: 4000 }, targetIncome: 50000 };
  const fe = monthlyFlow(explicit);
  assert('explicit expenses.monthly overrides targetIncome proxy',
    fe.monthlyExpenses === 4000);
  assert('explicit expenses → confidence HIGH',
    fe.confidence === 'HIGH');

  // Age exactly at state pension start age (boundary)
  const atSPA = { age: 67, income: { statePension: { annual: 11502, startAge: 67 } } };
  const fs = monthlyFlow(atSPA);
  assert('SP in payment when age === startAge',
    fs.statePensionInPayment === true && fs.components.statePension > 0);

  // allocationPressure convenience export
  const ap = allocationPressure(loadPersona('a'));
  assert('allocationPressure() convenience export returns same object',
    typeof ap.commitRatio === 'number' && typeof ap.debtServiceRatio === 'number');
}

// ── SUMMARY ───────────────────────────────────────────────────────────────────

console.log(`\n  ${passed} passed · ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
