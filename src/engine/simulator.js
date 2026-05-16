// ─────────────────────────────────────────────────────────
// FINIO SIMULATOR ENGINE
// simulate(entity, overrides) → new FQ data with ripple effects
// netWorthImpact(entity, overrides) → £ delta vs baseline
// RIPPLE_MAP → cross-dimension dependencies
// ─────────────────────────────────────────────────────────

import { calcFQ, netWorth, ihtDynamic } from './fq-calculator.js'

// ─────────────────────────────────────────────────────────
// SLIDER DEFINITIONS PER DIMENSION
// Each slider: key, label, min, max, step, unit, defaultFn
// primary: shown by default. secondary: revealed on "More options"
// ─────────────────────────────────────────────────────────

export const SLIDERS = {
  behaviour: {
    primary: [
      { key: 'savingsRate',   label: 'Monthly savings rate', min: 0, max: 2000, step: 50,  unit: '£/mo',  defaultFn: () => 200 },
      { key: 'billsOnTime',   label: 'Bills paid on time',   min: 0, max: 100,  step: 5,   unit: '%',     defaultFn: () => 100 },
    ],
    secondary: [
      { key: 'reviewFreq',    label: 'Financial reviews/yr', min: 0, max: 12,   step: 1,   unit: '/yr',   defaultFn: () => 1 },
    ],
  },

  capital: {
    primary: [
      { key: 'retirementTarget', label: 'Target retirement income', min: 20000, max: 100000, step: 1000, unit: '£/yr', defaultFn: e => e.targetIncome || 50000 },
      { key: 'growthRate',       label: 'Investment growth rate',   min: 1,     max: 12,     step: 0.5,  unit: '%',    defaultFn: () => 5 },
    ],
    secondary: [
      { key: 'drawdownAge',      label: 'Drawdown start age',       min: 55,    max: 80,     step: 1,    unit: 'yrs',  defaultFn: e => e.age || 62 },
    ],
  },

  tax: {
    primary: [
      { key: 'drawdown',         label: 'Annual SIPP drawdown',     min: 0,     max: 50000,  step: 500,  unit: '£/yr', defaultFn: e => e.drawdown || 0 },
      { key: 'isaContribution',  label: 'ISA contribution this yr', min: 0,     max: 20000,  step: 500,  unit: '£/yr', defaultFn: () => 0 },
    ],
    secondary: [
      { key: 'cgtHarvest',       label: 'CGT harvesting amount',    min: 0,     max: 20000,  step: 500,  unit: '£/yr', defaultFn: () => 0 },
    ],
  },

  protection: {
    primary: [
      { key: 'lifeAmount',       label: 'Life insurance amount',    min: 0,     max: 1000000, step: 25000, unit: '£', defaultFn: () => 0 },
      { key: 'lifeInTrust',      label: 'Written into trust?',      min: 0,     max: 1,      step: 1,    unit: 'bool', defaultFn: () => 0 },
    ],
    secondary: [
      { key: 'criticalIllness',  label: 'Critical illness cover',   min: 0,     max: 500000, step: 25000, unit: '£', defaultFn: () => 0 },
    ],
  },

  cashflow: {
    primary: [
      { key: 'emergencyFund',    label: 'Emergency fund',           min: 0,     max: 200000, step: 5000, unit: '£',    defaultFn: e => e.assets?.cash?.total || 0 },
      { key: 'monthlySpend',     label: 'Monthly spending',         min: 1000,  max: 10000,  step: 100,  unit: '£/mo', defaultFn: () => 3167 },
    ],
    secondary: [],
  },

  debt: {
    primary: [
      { key: 'debtTotal',        label: 'Total outstanding debt',   min: 0,     max: 500000, step: 5000, unit: '£',    defaultFn: () => 0 },
    ],
    secondary: [
      { key: 'debtRate',         label: 'Average interest rate',    min: 0,     max: 25,     step: 0.5,  unit: '%',    defaultFn: () => 0 },
    ],
  },

  estate: {
    primary: [
      { key: 'drawdown',         label: 'Annual SIPP drawdown',     min: 0,     max: 50000,  step: 500,  unit: '£/yr', defaultFn: e => e.drawdown || 0 },
      { key: 'willInPlace',      label: 'Will in place & current?', min: 0,     max: 1,      step: 1,    unit: 'bool', defaultFn: () => 0 },
    ],
    secondary: [
      { key: 'lpaDone',          label: 'LPA registered?',          min: 0,     max: 1,      step: 1,    unit: 'bool', defaultFn: () => 0 },
      { key: 'nominationsReviewed', label: 'Pension nominations current?', min: 0, max: 1,   step: 1,    unit: 'bool', defaultFn: () => 0 },
    ],
  },
}

// ─────────────────────────────────────────────────────────
// RIPPLE MAP
// When slider X changes, these OTHER dimensions are affected.
// Used to animate secondary dimension dots on the radar.
// ─────────────────────────────────────────────────────────

export const RIPPLE_MAP = {
  drawdown:          ['tax', 'estate'],   // more drawdown → better tax + estate
  isaContribution:   ['tax'],
  cgtHarvest:        ['tax'],
  lifeAmount:        ['protection', 'estate'],
  lifeInTrust:       ['protection', 'estate'],
  criticalIllness:   ['protection'],
  emergencyFund:     ['cashflow'],
  monthlySpend:      ['cashflow'],
  debtTotal:         ['debt'],
  retirementTarget:  ['capital'],
  growthRate:        ['capital'],
  willInPlace:       ['estate'],
  lpaDone:           ['estate'],
  nominationsReviewed: ['estate'],
}

// ─────────────────────────────────────────────────────────
// BUILD SIMULATED ENTITY
// Takes entity + flat overrides object → returns modified entity
// ─────────────────────────────────────────────────────────

function buildSimEntity(entity, overrides) {
  const e = JSON.parse(JSON.stringify(entity)) // deep clone

  if (overrides.drawdown !== undefined) {
    e.drawdown = overrides.drawdown
  }

  if (overrides.retirementTarget !== undefined) {
    e.targetIncome = overrides.retirementTarget
  }

  if (overrides.lifeAmount !== undefined) {
    e.assets.protection.lifeInsurance.exists = overrides.lifeAmount > 0
    e.assets.protection.lifeInsurance.amount = overrides.lifeAmount
  }

  if (overrides.lifeInTrust !== undefined) {
    e.assets.protection.lifeInsurance.inTrust = overrides.lifeInTrust === 1
  }

  if (overrides.criticalIllness !== undefined) {
    e.assets.protection.criticalIllness.exists = overrides.criticalIllness > 0
    e.assets.protection.criticalIllness.amount = overrides.criticalIllness
  }

  if (overrides.emergencyFund !== undefined) {
    e.assets.cash.total = overrides.emergencyFund
    e.assets.cash.own   = Math.min(overrides.emergencyFund, e.assets.cash.own || overrides.emergencyFund)
  }

  if (overrides.isaContribution !== undefined) {
    // ISA contribution shifts cash → ISA
    const shift = Math.min(overrides.isaContribution, e.assets.cash.total)
    e.assets.isa.value  += shift
    e.assets.cash.total -= shift
    e.assets.cash.own    = Math.max(0, (e.assets.cash.own || 0) - shift)
  }

  return e
}

// ─────────────────────────────────────────────────────────
// SIMULATE
// Returns: { fqData, simEntity, rippleDims, deltaFQ }
// ─────────────────────────────────────────────────────────

export function simulate(entity, overrides = {}) {
  const simEntity = buildSimEntity(entity, overrides)
  const fqData    = calcFQ(simEntity)
  const baseFQ    = calcFQ(entity)

  // Determine which dims were touched by these overrides
  const rippleDims = new Set()
  Object.keys(overrides).forEach(key => {
    if (RIPPLE_MAP[key]) RIPPLE_MAP[key].forEach(d => rippleDims.add(d))
  })

  return {
    fqData,
    simEntity,
    rippleDims: [...rippleDims],
    deltaFQ:    fqData.total - baseFQ.total,
    baseFQ:     baseFQ.total,
  }
}

// ─────────────────────────────────────────────────────────
// NET WORTH IMPACT
// Returns today's simulated net worth vs current, and delta
// ─────────────────────────────────────────────────────────

export function netWorthImpact(entity, overrides = {}) {
  const simEntity  = buildSimEntity(entity, overrides)
  const current    = netWorth(entity)
  const simulated  = netWorth(simEntity)
  return {
    current,
    simulated,
    delta: simulated - current,
  }
}

// ─────────────────────────────────────────────────────────
// IHT IMPACT
// Returns current vs simulated IHT exposure (post-2027)
// ─────────────────────────────────────────────────────────

export function ihtImpact(entity, overrides = {}) {
  const simEntity = buildSimEntity(entity, overrides)
  const current   = ihtDynamic(entity,    true, entity.drawdown || 0)
  const simulated = ihtDynamic(simEntity, true, simEntity.drawdown || 0)
  return {
    currentIHT:   current.iht,
    simulatedIHT: simulated.iht,
    delta:        simulated.iht - current.iht,
  }
}

// ─────────────────────────────────────────────────────────
// GET DEFAULT SLIDER VALUES FOR A DIMENSION + ENTITY
// ─────────────────────────────────────────────────────────

export function defaultSliderValues(dimKey, entity) {
  const def = {}
  const cfg = SLIDERS[dimKey]
  if (!cfg) return def
  ;[...cfg.primary, ...cfg.secondary].forEach(s => {
    def[s.key] = s.defaultFn(entity)
  })
  return def
}
