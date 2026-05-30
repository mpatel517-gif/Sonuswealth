// FlexiDrawdownPayloads.js — pure payload builders for DrillableNumber → L4.
//
// 2026-05-30: rewritten for the full CMA engine (probabilityOfSuccess) +
// today's-money / future-pounds toggle. Each builder returns
// { formula, source, confidence, breakdown, editable? }. No React.
//
// Plain English in the user-facing breakdown labels; the engine path is named
// in `source` for the curious.

import { fmt } from '../../../../engine/fq-calculator.js'

const drawSourceLabel = {
  custom: 'the amount you set',
  target: 'your target retirement income',
  default: '4% of your savings (a starting point)',
}

// Hero — "chance your money lasts".
export function posPayload(snap) {
  return {
    formula: `We ran ${snap.runs.toLocaleString()} simulated futures from age ${snap.startAge} to age ${snap.terminalAge}. Each future draws a different run of market returns (built from the market and inflation assumptions in the plan) and rises your yearly income with prices. The "chance it lasts" is the share of those futures where the money never runs out. The State Pension is added in from age ${snap.statePensionFrom}.`,
    source: 'cashflow-engine.probabilityOfSuccess(entity, CMA bundle, 2000 runs) — lognormal market returns, inflation as a yearly rising cost, State Pension included.',
    confidence: snap.pot > 0 ? 'high' : 'low',
    breakdown: [
      { label: 'Your retirement savings',      value: fmt(snap.pot) },
      { label: 'Income drawn each year',       value: `${fmt(snap.annualDraw)} (${drawSourceLabel[snap.drawSource]})` },
      { label: 'Simulated futures',            value: snap.runs.toLocaleString() },
      { label: 'Time horizon',                 value: `age ${snap.startAge} → ${snap.terminalAge}` },
      { label: 'Chance it lasts',              value: `${snap.pos}%` },
      { label: 'Inflation assumed',            value: `${Math.round(snap.inflation * 100)}% a year` },
      { label: 'State Pension included from',  value: `age ${snap.statePensionFrom}` },
    ],
  }
}

export function potPayload(snap) {
  return {
    formula: 'Your savings the model can draw on: pensions + ISAs + other investments + cash. Property is not counted because it cannot easily be spent in retirement.',
    source: 'engine.investable(entity) — pensions + ISAs + investments + cash (excludes property).',
    confidence: snap.pot > 0 ? 'high' : 'low',
    breakdown: [
      { label: 'Savings the model can draw on', value: fmt(snap.pot) },
      { label: 'Note', value: 'Tap the Wrappers or Pension panels for the per-pot breakdown.' },
    ],
  }
}

// Editable — the yearly income / drawdown. Wired to entity.drawdown.
export function annualDrawPayload(snap) {
  return {
    formula: snap.drawSource === 'default'
      ? 'No income figure is set yet, so the model uses 4% of your savings as a sensible starting point. Set your own figure to see how it changes the result.'
      : 'The income you plan to take each year. The model rises this with inflation every year, so your spending power stays roughly level.',
    source: snap.drawSource === 'custom' ? 'entity.drawdown (you set this)'
          : snap.drawSource === 'target' ? 'entity.targetIncome'
          : 'Starting point: 4% of your savings.',
    confidence: snap.drawSource === 'default' ? 'medium' : 'high',
    breakdown: [
      { label: 'Income each year',   value: fmt(snap.annualDraw) },
      { label: 'Roughly per month',  value: fmt(Math.round(snap.annualDraw / 12)) },
      { label: 'Where this comes from', value: drawSourceLabel[snap.drawSource] },
    ],
    editable: {
      path: 'drawdown',
      label: 'Income you draw each year',
      currentValue: snap.annualDraw,
      unit: '£',
    },
  }
}

// Shared helper for the three outcome rows — view = 'real' | 'nominal'.
function _bandPayload(snap, view, key, plainLabel) {
  const band = view === 'real' ? snap.real : snap.nominal
  const moneyNote = view === 'real'
    ? `Shown in today's money — future pounds adjusted back by ${Math.round(snap.inflation * 100)}% a year of inflation so you can compare with prices now.`
    : `Shown in future pounds — the actual £ figure at age ${snap.terminalAge}, before adjusting for ${Math.round(snap.inflation * 100)}%-a-year inflation.`
  return {
    formula: `${plainLabel} of the ${snap.runs.toLocaleString()} simulated futures, measured at age ${snap.terminalAge}. ${moneyNote}`,
    source: `cashflow-engine.probabilityOfSuccess — terminal-pot ${key} (${view === 'real' ? 'discounted to today' : 'nominal'}).`,
    confidence: snap.pot > 0 ? 'high' : 'medium',
    breakdown: [
      { label: 'Typical (middle) outcome',      value: fmt(band.p50) },
      { label: 'If markets are unkind (1 in 10)', value: fmt(band.p10) },
      { label: 'If markets are kind (1 in 10)',   value: fmt(band.p90) },
      { label: 'Shown as', value: view === 'real' ? "Today's money" : 'Future pounds' },
    ],
  }
}

export function typicalPotPayload(snap, view) {
  return _bandPayload(snap, view, 'median', 'The middle outcome')
}
export function unluckyPotPayload(snap, view) {
  return _bandPayload(snap, view, 'p10', 'A poor run for markets — the worst 1 in 10')
}
export function luckyPotPayload(snap, view) {
  return _bandPayload(snap, view, 'p90', 'A good run for markets — the best 1 in 10')
}
