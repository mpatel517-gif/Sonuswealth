// DecumulationPayloads.js — pure payload builders for the Decumulation L3 panel.
//
// Each builder returns { formula, source, confidence, breakdown, editable? }
// consumed by DrillableNumber → L4NumberPanel.
//
// NO React. NO side effects. Pure functions over snap (buildDecumulationSnapshot result).

import { fmt } from '../../../../engine/fq-calculator.js'

const placeholder = (label) => [{ label, value: 'No detail recorded yet' }]
const pctStr = (r, dp = 1) => `${(r * 100).toFixed(dp)}%`

// ── Hero ─────────────────────────────────────────────────────────────────────

/**
 * Hero payload — shows funded-ratio % or years-of-runway depending on data quality.
 */
export function decumulationHeroPayload(snap) {
  if (!snap.frInsufficient && snap.fundedRatioPct != null) {
    return {
      formula: `Funded ratio = projected assets at retirement ÷ assets required to fund target income at SWR. ${snap.fundedRatioPct}% means your projected pot covers ${snap.fundedRatioPct}% of what is needed.`,
      source: 'engine.fundedRatio(entity) — projects current investable at growth rate to retirement age, divides by (targetIncome ÷ SWR).',
      confidence: snap.frConfidence === 'HIGH' ? 'high' : snap.frConfidence === 'MEDIUM' || snap.frConfidence === 'MED-HIGH' ? 'medium' : 'low',
      breakdown: [
        { label: 'Funded ratio',           value: `${snap.fundedRatioPct}%` },
        { label: 'Investable assets now',  value: fmt(snap.investableAssets) },
        { label: 'Target annual income',   value: fmt(snap.targetIncome) },
        { label: 'Sustainable at SWR',     value: fmt(snap.sustainableIncome) },
        { label: 'SWR regime',             value: snap.swrLabel },
        { label: 'Years of runway',        value: `${snap.runwayYears} yrs` },
      ],
    }
  }
  // Fallback: runway years
  return {
    formula: `Simple capital-depletion cover: investable assets ÷ target annual income = years before pot runs out at constant spend (no growth assumed).`,
    source: 'engine.investable(entity) ÷ helpers.targetIncome(entity). fundedRatio returned INSUFFICIENT (insufficient assets or missing targetIncome).',
    confidence: 'low',
    breakdown: [
      { label: 'Investable assets',  value: fmt(snap.investableAssets) },
      { label: 'Target income',      value: fmt(snap.targetIncome) },
      { label: 'Years of cover',     value: `${snap.runwayYears} yrs` },
      { label: 'Note',               value: 'Add a targetIncome and pension balance to enable the full funded-ratio projection.' },
    ],
  }
}

// ── Row payloads ─────────────────────────────────────────────────────────────

/**
 * Target income row — EDITABLE.
 */
export function targetIncomePayload(snap) {
  return {
    formula: 'Annual income you want in retirement, in today\'s money. Used as the denominator for funded ratio and the benchmark for sustainable-income comparison.',
    source: 'entity.targetIncome (directly set) OR helpers.targetIncome(entity) = 60% of gross salary when not set.',
    confidence: snap.targetIncome > 0 ? 'high' : 'low',
    breakdown: [
      { label: 'Target annual income', value: fmt(snap.targetIncome) },
      { label: 'Note', value: snap.targetIncome > 0
          ? 'Set directly on your profile. Edit below to model a different target.'
          : 'Estimated at 60% of salary — set a real figure for accurate projections.' },
    ],
    editable: {
      path: 'targetIncome',
      label: 'Target annual income',
      currentValue: snap.targetIncome,
      unit: '£',
    },
  }
}

/**
 * Investable assets row — read-only.
 */
export function investablePayload(snap) {
  return {
    formula: 'Sum of liquid investable wrappers: ISA family + SIPP/pension pots + General Investment Account (GIA) + cash equivalents. Excludes primary residence equity (illiquid) and unrealised property gains.',
    source: 'engine.investable(entity) — walks both FLAT (assets.sipp.total + isa.value + portfolio.value + cash.total) and NESTED (pensionTotal + investmentsTotal + cashTotal) schemas.',
    confidence: snap.investableAssets > 0 ? 'medium' : 'low',
    breakdown: [
      { label: 'Total investable', value: fmt(snap.investableAssets) },
      { label: 'Includes', value: 'ISA + pension pots + GIA + cash' },
      { label: 'Excludes', value: 'Property equity, business assets, defined-benefit CETVs (unless nominated)' },
    ],
  }
}

/**
 * Funded ratio row — read-only.
 */
export function fundedRatioPayload(snap) {
  if (snap.frInsufficient) {
    return {
      formula: 'Funded ratio cannot be calculated — either investable assets are below £10,000 or no target income is set.',
      source: 'engine.fundedRatio(entity) returned INSUFFICIENT.',
      confidence: 'low',
      breakdown: placeholder('Funded ratio unavailable — add a pension balance and target income'),
    }
  }
  return {
    formula: `Projected assets at retirement ÷ required pot. Required pot = targetIncome ÷ SWR (${pctStr(snap.swrRate)}). Assets projected at 5% nominal growth over horizon. ${snap.fundedRatioPct}% = ${snap.fundedRatioPct >= 100 ? 'fully funded' : 'underfunded — gap to close'}.`,
    source: 'engine.fundedRatio(entity, null) — projects current investable forward, inflates targetIncome at 2.5%/yr, divides by (inflated target ÷ SWR).',
    confidence: snap.frConfidence === 'HIGH' ? 'high' : 'medium',
    breakdown: [
      { label: 'Funded ratio',    value: `${snap.fundedRatioPct}%` },
      { label: 'Interpretation',  value: snap.fundedRatioPct >= 100 ? 'Fully funded' : `${100 - snap.fundedRatioPct}% gap — projected pot below required` },
      { label: 'Model confidence', value: snap.frConfidence },
      { label: 'SWR used',        value: snap.swrLabel },
    ],
  }
}

/**
 * Sustainable income row — read-only.
 */
export function sustainableIncomePayload(snap) {
  return {
    formula: `Investable assets × safe withdrawal rate = maximum annual income the pot can sustain indefinitely without depleting. Uses ${snap.swrLabel}. Formula: £${snap.investableAssets.toLocaleString()} × ${pctStr(snap.swrRate)} = ${fmt(snap.sustainableIncome)}/yr.`,
    source: `engine.investable(entity) × engine.swrFromRegime('${snap.swrLabel.split(' ')[0].toLowerCase()}').rate. Regime chosen from entity.swrRegime or default bengen.`,
    confidence: snap.investableAssets > 0 ? 'medium' : 'low',
    breakdown: [
      { label: 'Investable assets',     value: fmt(snap.investableAssets) },
      { label: 'Safe withdrawal rate',  value: pctStr(snap.swrRate) },
      { label: 'Sustainable per year',  value: fmt(snap.sustainableIncome) },
      { label: 'Regime',                value: snap.swrLabel },
      { label: 'vs target income',      value: snap.onTrack ? `Covers target (${fmt(snap.targetIncome)}/yr)` : `Below target — gap of ${fmt(Math.max(0, snap.targetIncome - snap.sustainableIncome))}/yr` },
    ],
  }
}

/**
 * Runway / years of cover row — read-only.
 */
export function runwayYearsPayload(snap) {
  return {
    formula: `Simple capital-depletion cover: investable assets ÷ target annual income (no growth assumed — conservative floor). ${fmt(snap.investableAssets)} ÷ ${fmt(snap.targetIncome)} = ${snap.runwayYears} years at flat spend.`,
    source: 'engine.investable(entity) ÷ helpers.targetIncome(entity). No growth assumed — this is the worst-case (zero-return) floor.',
    confidence: snap.investableAssets > 0 && snap.targetIncome > 0 ? 'medium' : 'low',
    breakdown: [
      { label: 'Investable assets',   value: fmt(snap.investableAssets) },
      { label: 'Target income',       value: fmt(snap.targetIncome) },
      { label: 'Years of cover',      value: `${snap.runwayYears} yrs (zero-growth floor)` },
      { label: 'Note', value: 'Real runway is longer once investment growth is applied — see funded ratio for the growth-adjusted view.' },
    ],
  }
}
