// FlexiDrawdownPayloads.js — pure payload builders for DrillableNumber → L4.
//
// Plan reference: MyMoney L3 Tier-A — pension drawdown sustainability.
//
// Each builder returns { formula, source, confidence, breakdown } consumed
// by DrillableNumber. No React. All values are pre-formatted strings or
// raw numbers ready for display.

import { fmt } from '../../../../engine/fq-calculator.js'

/**
 * Payload for the hero POS metric.
 * Explains the Monte Carlo simulation behind the % figure.
 *
 * @param {object} snap — result of buildDrawdownSnapshot
 * @returns {{ formula, source, confidence, breakdown }}
 */
export function posPayload(snap) {
  const drawDesc = snap.drawIsCustom
    ? `£${snap.annualDraw.toLocaleString()} (user-set entity.drawdown)`
    : `${fmt(snap.annualDraw)}/yr (4% illustrative default — no drawdown set)`

  return {
    formula: `Monte Carlo simulation: ${snap.simulations.toLocaleString()} random return paths, each run from age ${snap.startAge} to age ${snap.terminalAge}. Each path applies annual drawdown of ${drawDesc}, then applies a stochastic real return drawn from N(4%, 10%) (CMA assumptions: 4% real mean, 10% stdev). POS = fraction of paths where the pot remains above zero at age ${snap.terminalAge}.`,
    source: 'scenarios.monteCarloPOS(entity, annualDraw, { simulations:2000, terminalAge:95 }) — real simulation, not a rule-of-thumb.',
    confidence: snap.pot > 0 ? 'high' : 'low',
    breakdown: [
      { label: 'Pot at simulation start',    value: fmt(snap.pot) },
      { label: 'Annual drawdown assumed',    value: fmt(snap.annualDraw) },
      { label: 'Drawdown source',            value: snap.drawIsCustom ? 'entity.drawdown (user-set)' : '4% of pot (illustrative default)' },
      { label: 'Simulations run',            value: snap.simulations.toLocaleString() },
      { label: 'Projection horizon',         value: `age ${snap.startAge} → age ${snap.terminalAge}` },
      { label: 'Probability of survival',    value: `${snap.pos}%` },
      { label: 'Return assumption (mean)',   value: '4% real (CMA default)' },
      { label: 'Return assumption (stdev)',  value: '10% (CMA default)' },
    ],
  }
}

/**
 * Payload for the current pension pot row.
 * Explains pensionTotal composition.
 *
 * @param {object} snap
 * @returns {{ formula, source, confidence, breakdown }}
 */
export function potPayload(snap) {
  return {
    formula: 'Sum of all SIPP + workplace DC pensions via pensionTotal(entity). Occupational-DB entries without a CETV are excluded (FP-4 rule — DB income floor, not a liquidatable pot).',
    source: 'engine.pensionTotal(entity) — walks assets.sipp.pensions[], assets.pensions[], falls back to assets.sipp.total.',
    confidence: snap.pot > 0 ? 'high' : 'low',
    breakdown: [
      { label: 'Total pension pot', value: fmt(snap.pot) },
      { label: 'Note', value: 'Tap the Pension wrapper row for per-scheme breakdown.' },
    ],
  }
}

/**
 * Payload for the annual drawdown row — EDITABLE.
 * path: 'drawdown' on entity root.
 *
 * @param {object} snap
 * @returns {{ formula, source, confidence, breakdown, editable }}
 */
export function annualDrawPayload(snap) {
  return {
    formula: snap.drawIsCustom
      ? 'User-set annual drawdown amount. Edit to model a different withdrawal rate.'
      : 'Illustrative default: 4% of total pension pot. No drawdown schedule is set on this entity — update entity.drawdown to use a real figure.',
    source: snap.drawIsCustom
      ? 'entity.drawdown (user-set)'
      : 'Derived: 0.04 × pensionTotal(entity) — 4% illustrative default.',
    confidence: snap.drawIsCustom ? 'high' : 'medium',
    breakdown: [
      { label: 'Annual drawdown', value: fmt(snap.annualDraw) },
      { label: 'Drawdown source', value: snap.drawIsCustom ? 'User-set' : '4% of pot (default — tap to override)' },
      { label: 'Monthly equivalent', value: fmt(snap.annualDraw / 12) },
    ],
    editable: {
      path: 'drawdown',
      label: 'Annual drawdown amount',
      currentValue: snap.annualDraw,
      unit: '£',
    },
  }
}

/**
 * Payload for the median pot at terminal age row.
 *
 * @param {object} snap
 * @returns {{ formula, source, confidence, breakdown }}
 */
export function medianPotPayload(snap) {
  return {
    formula: `50th percentile pot value at age ${snap.terminalAge} across ${snap.simulations.toLocaleString()} Monte Carlo paths. Half of simulations end above this figure, half below.`,
    source: 'scenarios.monteCarloPOS — percentilesByAge[last].p50',
    confidence: snap.pos > 0 ? 'high' : 'medium',
    breakdown: [
      { label: `Median pot at age ${snap.terminalAge}`, value: fmt(snap.p50) },
      { label: 'Pessimistic (p10)',  value: fmt(snap.p10) },
      { label: 'Optimistic (p90)',   value: fmt(snap.p90) },
      { label: 'Note', value: 'Based on CMA assumptions: 4% real mean, 10% stdev.' },
    ],
  }
}

/**
 * Payload for p10 pessimistic pot row.
 *
 * @param {object} snap
 * @returns {{ formula, source, confidence, breakdown }}
 */
export function p10Payload(snap) {
  return {
    formula: `10th percentile pot at age ${snap.terminalAge} — the pot size in the bottom 10% of outcomes. Use this as the stress-test floor.`,
    source: 'scenarios.monteCarloPOS — percentilesByAge[last].p10',
    confidence: 'high',
    breakdown: [
      { label: `Pessimistic (p10) at age ${snap.terminalAge}`, value: fmt(snap.p10) },
      { label: 'Interpretation', value: '9 in 10 outcomes leave more than this in the pot.' },
    ],
  }
}

/**
 * Payload for p90 optimistic pot row.
 *
 * @param {object} snap
 * @returns {{ formula, source, confidence, breakdown }}
 */
export function p90Payload(snap) {
  return {
    formula: `90th percentile pot at age ${snap.terminalAge} — the pot size in the top 10% of outcomes. Use as the upside ceiling.`,
    source: 'scenarios.monteCarloPOS — percentilesByAge[last].p90',
    confidence: 'high',
    breakdown: [
      { label: `Optimistic (p90) at age ${snap.terminalAge}`, value: fmt(snap.p90) },
      { label: 'Interpretation', value: 'Only 1 in 10 outcomes leave more than this.' },
    ],
  }
}
