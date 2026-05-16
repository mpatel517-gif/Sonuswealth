// ─────────────────────────────────────────────────────────────────────────────
// driver-engine — PP-3 (drillable to nth degree)
//
// `driver(entity, metric, level)` returns the drivers of any metric. Each
// driver is itself a metric, recursively drillable. Terminal nodes carry
// source + formula + confidence + provenance.
//
// Wave 1 scope:
//   · netWorth, wealthScore, riskScore, surplus, coi, ihtExposure
//   · One level deep (top-level drivers only)
//   · Terminal-node fallback when no deeper drill exists
//
// Wave 2 will add:
//   · Recursive drill paths for every metric
//   · Provenance from event store (which event introduced this value)
//   · Per-driver confidence (PP-7 — manual=1.0, AI=variable)
// ─────────────────────────────────────────────────────────────────────────────

import { netWorth, calcFQ, calcRisk, monthlySurplus, totalCoI } from './fq-calculator.js'

/**
 * @param {object} entity
 * @param {string} metric  — canonical metric name
 * @param {number} level   — depth of drill (0 = direct drivers, 1 = drivers of drivers, …)
 * @returns {DriverNode}
 *
 * DriverNode shape:
 *   {
 *     metric: 'string',                     — canonical metric name
 *     value:  number,                        — current value
 *     unit:   'gbp' | 'pct' | 'score' | 'count',
 *     drivers: DriverNode[],                — sub-drivers (empty at terminal)
 *     formula: 'string',                    — plain-English explainer
 *     source:  'engine' | 'manual' | 'ai',
 *     confidence: 'high' | 'medium' | 'low',
 *     terminal: boolean,                    — true if no deeper drill
 *   }
 */
export function driver(entity, metric, level = 0) {
  if (!entity || !metric) return terminal(metric, 0)

  switch (metric) {
    case 'netWorth':       return drvNetWorth(entity, level)
    case 'wealthScore':    return drvWealthScore(entity, level)
    case 'riskScore':      return drvRiskScore(entity, level)
    case 'monthlySurplus': return drvSurplus(entity, level)
    case 'coi':            return drvCoI(entity, level)
    default:               return terminal(metric, 0, 'Driver tree pending')
  }
}

// ─── Per-metric driver decompositions ───────────────────────────────────────

function drvNetWorth(entity, level) {
  const nw = safe(() => netWorth(entity), 0)
  return {
    metric: 'netWorth',
    value: nw,
    unit: 'gbp',
    formula: 'Sum of all assets across wrappers, minus all liabilities.',
    source: 'engine',
    confidence: 'high',
    terminal: false,
    drivers: level >= 1 ? [] : [
      { metric: 'assets',     value: safe(() => sumAssets(entity), 0), unit: 'gbp',
        formula: 'Sum of every owned asset.', source: 'engine', confidence: 'high', terminal: false, drivers: [] },
      { metric: 'liabilities', value: safe(() => sumLiabilities(entity), 0), unit: 'gbp',
        formula: 'Sum of every outstanding debt.', source: 'engine', confidence: 'high', terminal: false, drivers: [] },
    ],
  }
}

function drvWealthScore(entity, level) {
  const fq = safe(() => calcFQ(entity), { total: 0, dims: {} })
  const dims = fq.dims || {}
  return {
    metric: 'wealthScore',
    value: fq.total || 0,
    unit: 'score',
    formula: '8 dimensions weighted to your life stage. Higher = stronger overall financial health.',
    source: 'engine',
    confidence: 'high',
    terminal: false,
    drivers: level >= 1 ? [] : Object.keys(dims).map(key => ({
      metric: key,
      value: dims[key]?.value ?? dims[key] ?? 0,
      unit: 'score',
      formula: dims[key]?.formula || `${key} dimension contribution`,
      source: 'engine',
      confidence: 'medium',
      terminal: true,
      drivers: [],
    })),
  }
}

function drvRiskScore(entity, level) {
  const risk = safe(() => calcRisk(entity), { total: 0, dims: {} })
  const dims = risk.dims || {}
  return {
    metric: 'riskScore',
    value: risk.total || 0,
    unit: 'score',
    formula: '7 dimensions of financial resilience. Higher = more resilient to shocks.',
    source: 'engine',
    confidence: risk.confidence?.level || 'medium',
    terminal: false,
    drivers: level >= 1 ? [] : Object.keys(dims).map(key => ({
      metric: key,
      value: dims[key]?.value ?? dims[key] ?? 0,
      unit: 'score',
      formula: dims[key]?.label || `${key} dimension`,
      source: 'engine',
      confidence: 'medium',
      terminal: true,
      drivers: [],
    })),
  }
}

function drvSurplus(entity, level) {
  const surplus = safe(() => monthlySurplus(entity), 0)
  return {
    metric: 'monthlySurplus',
    value: surplus,
    unit: 'gbp',
    formula: 'Take-home income minus regular outgoings, per month.',
    source: 'engine',
    confidence: 'medium',
    terminal: false,
    drivers: [],
  }
}

function drvCoI(entity, level) {
  const coi = safe(() => totalCoI?.(entity) || 0, 0)
  return {
    metric: 'coi',
    value: coi,
    unit: 'gbp',
    formula: 'Cost of waiting — what you would lose to tax/IHT if no plan executed.',
    source: 'engine',
    confidence: 'medium',
    terminal: false,
    drivers: [],
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function safe(fn, fallback) {
  try { return fn() } catch { return fallback }
}

function terminal(metric, value, formula = 'Computed by engine.') {
  return {
    metric, value, unit: 'gbp', formula,
    source: 'engine', confidence: 'medium', terminal: true, drivers: [],
  }
}

function sumAssets(entity) {
  // Schema-agnostic sum
  const a = entity?.assets
  if (!a) return 0
  if (Array.isArray(a)) return a.reduce((s, x) => s + (x.value || 0), 0)
  return Object.values(a).reduce((s, v) => {
    if (typeof v === 'number') return s + v
    if (v && typeof v === 'object') return s + (v.total || v.value || 0)
    return s
  }, 0)
}

function sumLiabilities(entity) {
  const l = entity?.liabilities
  if (!l) return 0
  if (Array.isArray(l)) return l.reduce((s, x) => s + (x.amount || x.balance || 0), 0)
  return Object.values(l).reduce((s, v) => {
    if (typeof v === 'number') return s + v
    if (v && typeof v === 'object') return s + (v.total || v.amount || v.balance || 0)
    return s
  }, 0)
}
