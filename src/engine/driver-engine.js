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

import { netWorth, calcFQ, calcRisk, monthlySurplus, totalCoI, TAX, fqBreakdown, riskBreakdown } from './fq-calculator.js'
import {
  ihtExposure,
  willLpaStatus,
  nominationStatus,
  allowanceTracker,
  incomeTaxDetail,
  cgtDetail,
} from './tax-estate-engine.js'
import { DIM_BY_KEY } from '../config/dimensions.js'

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
    case 'plan:estate':    return drvPlanEstate(entity, level)
    case 'plan:gift':      return drvPlanGift(entity, level)
    case 'plan:tax':       return drvPlanTax(entity, level)
    default:
      // Wealth- or risk-score DIMENSION tapped from the score drill (e.g.
      // 'behaviour', 'capital', 'incomeRes'). drvWealthScore/drvRiskScore list
      // these as drivers, so a tap re-enters here — resolve to the dimension's
      // plain-English definition + current value (score unit, so no £) instead
      // of the "not yet wired" stub.
      {
        const dim = drvDimension(entity, metric)
        if (dim) return dim
      }
      return terminal(metric, 0, `Drill detail for "${metric}" is not yet wired into the driver tree. Tap Ask Sonu below to ask about ${metric}, or open the underlying tab for the raw data.`)
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
  const bd = safe(() => fqBreakdown(entity), {})
  return {
    metric: 'wealthScore',
    value: fq.total || 0,
    unit: 'score',
    formula: `Seven dimensions sum to a raw ${fq.raw ?? '—'}, then ×${(fq.momentum ?? 1).toFixed(2)} for action-momentum = ${fq.total ?? 0}. Tap any dimension to see exactly how it's built.`,
    source: 'engine',
    confidence: 'high',
    terminal: false,
    drivers: level >= 1 ? [] : Object.keys(dims).map(key => ({
      metric: key,
      value: dims[key]?.value ?? dims[key] ?? 0,
      unit: 'score',
      formula: bd[key]?.summary || dims[key]?.formula || `${key} dimension contribution`,
      breakdown: bd[key] || null, // structured parts → DetailOverlay renders a table
      source: 'engine',
      confidence: 'medium',
      terminal: true,
      drivers: [],
    })),
  }
}

const RISK_DIM_DESCRIPTIONS = {
  incomeRes:        'How resilient your income is — sources, stability, and what happens if the primary source stops.',
  liquidity:        'Whether you hold enough accessible cash to absorb a shock without selling investments.',
  protCov:          'How well protected against loss of income, death, or serious illness.',
  debtVuln:         'Whether your debt level amplifies financial risk — leverage, debt service, and rate exposure.',
  concRisk:         'Whether wealth is over-concentrated in a single asset, employer, or asset class.',
  depExp:           'Whether dependants would be provided for — will, nominations, power of attorney.',
  behaviouralTrack: 'Financial behaviour over time — earns through consistent action and engagement.',
}

function drvRiskScore(entity, level) {
  const risk = safe(() => calcRisk(entity), { total: 0, dims: {} })
  const dims = risk.dims || {}
  const bd = safe(() => riskBreakdown(entity), {})
  return {
    metric: 'riskScore',
    value: risk.total || 0,
    unit: 'score',
    formula: `Seven resilience dimensions sum to ${risk.total ?? 0} of 100. Higher = more resilient to shocks. Tap any dimension to see how it's built.`,
    source: 'engine',
    confidence: risk.confidence?.level || 'medium',
    terminal: false,
    drivers: level >= 1 ? [] : Object.keys(dims).map(key => ({
      metric: key,
      value: dims[key]?.value ?? dims[key] ?? 0,
      unit: 'score',
      formula: bd[key]?.summary || RISK_DIM_DESCRIPTIONS[key] || `Contributes to your overall financial resilience score.`,
      breakdown: bd[key] || null, // structured parts → DetailOverlay renders a table
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

// ─── Plan review driver decompositions ──────────────────────────────────────

function drvPlanEstate(entity, level) {
  const expo    = safe(() => ihtExposure(entity), null)
  const wls     = safe(() => willLpaStatus(entity), null)
  const ns      = safe(() => nominationStatus(entity), null)
  const ihtDue  = expo?.iht_due ?? 0

  const willExists   = wls?.will?.exists || wls?.will?.current || false
  const lpaExists    = wls?.lpa?.property_financial?.exists || wls?.lpa?.propertyFinance || false
  const hwLpa        = wls?.lpa?.health_welfare?.exists || false
  const willStale    = wls?.will?.stale_flag || false
  const lpaFlags     = wls?.flags || []

  // Nomination coverage: count pensions missing a nominee
  const nsList       = Array.isArray(ns?.pensions) ? ns.pensions : Array.isArray(ns) ? ns : []
  const uncoveredPensions = nsList.filter(p => !(p.nominee || p.beneficiary || p.has_nomination)).length
  const sippInEstate = expo ? (expo.gross_estate - (expo.net_estate ?? expo.gross_estate)) === 0 : false

  const flags = [
    ...lpaFlags,
    ...(uncoveredPensions > 0 ? [`${uncoveredPensions} pension(s) without beneficiary nomination`] : []),
  ]

  const formula = [
    `IHT exposure: £${ihtDue.toLocaleString()} (${expo ? Math.round((expo.effective_iht_rate || 0) * 100) + '% effective rate' : 'no data'}).`,
    `Will: ${willExists ? (willStale ? 'exists — may need review (5+ yrs)' : 'current') : 'MISSING'}.`,
    `LPA (Property & Finance): ${lpaExists ? 'registered' : 'NOT registered'}.`,
    `LPA (Health & Welfare): ${hwLpa ? 'registered' : 'NOT registered'}.`,
    flags.length > 0 ? `Issues: ${flags.join(' · ')}.` : 'No outstanding flags.',
  ].join(' ')

  return {
    metric: 'plan:estate',
    value: ihtDue,
    unit: 'gbp',
    formula,
    source: 'engine',
    confidence: expo?.confidence || 'medium',
    terminal: false,
    drivers: level >= 1 ? [] : [
      { metric: 'will',         value: willExists ? 1 : 0, unit: 'count',
        formula: willExists ? (willStale ? 'Will exists but is 5+ years old — review advised.' : 'Current will in place.') : 'No will found — estate passes under intestacy rules.',
        source: 'engine', confidence: 'medium', terminal: true, drivers: [] },
      { metric: 'lpa',          value: (lpaExists ? 1 : 0) + (hwLpa ? 1 : 0), unit: 'count',
        formula: `Property & Finance LPA: ${lpaExists ? 'registered' : 'not registered'}. Health & Welfare LPA: ${hwLpa ? 'registered' : 'not registered'}.`,
        source: 'engine', confidence: 'medium', terminal: true, drivers: [] },
      { metric: 'nominations',  value: uncoveredPensions, unit: 'count',
        formula: uncoveredPensions === 0 ? 'All pensions have beneficiary nominations on file.' : `${uncoveredPensions} pension(s) lack a beneficiary nomination — pension trustees decide on death.`,
        source: 'engine', confidence: 'medium', terminal: true, drivers: [] },
      { metric: 'ihtExposure',  value: ihtDue, unit: 'gbp',
        formula: expo ? `Net estate £${(expo.net_estate || 0).toLocaleString()} · NRB £${(expo.nrb?.available || 0).toLocaleString()} · RNRB £${(expo.rnrb?.available || 0).toLocaleString()} · Taxable £${(expo.taxable_estate || 0).toLocaleString()} @ 40%.` : 'IHT exposure not computed — check asset data.',
        source: 'engine', confidence: expo?.confidence || 'medium', terminal: true, drivers: [] },
    ],
  }
}

function drvPlanGift(entity, level) {
  const giftExemption = TAX.giftExemption  // UK annual gift exemption
  const estate        = entity?.estate || {}
  const gifts         = estate.gifts || []
  const trustGifts    = estate.trustGifts ? [estate.trustGifts] : []
  const allGifts      = [...gifts, ...trustGifts]
  const now           = new Date()

  // Gifts within the 7-year window
  const within7yr = allGifts.filter(g => {
    if (!g.date) return false
    const yr = (now - new Date(g.date)) / (1000 * 60 * 60 * 24 * 365.25)
    return yr < 7
  })
  const totalPETs   = within7yr.reduce((s, g) => s + (g.amount || g.total || 0), 0)
  const giftUsed    = estate.annualGiftUsed || 0
  const giftRemaining = Math.max(0, giftExemption - giftUsed)

  const formula = [
    `Annual gift exemption (2026-27): £${giftExemption.toLocaleString()} — £${giftRemaining.toLocaleString()} remaining.`,
    totalPETs > 0
      ? `${within7yr.length} gift(s) totalling £${totalPETs.toLocaleString()} within the 7-year taper window — IHT applies on a sliding scale if death occurs before 7 years.`
      : 'No potentially exempt transfers (PETs) recorded within the last 7 years.',
    within7yr.length > 0
      ? `Oldest gift in window: ${within7yr.reduce((oldest, g) => !oldest || new Date(g.date) < new Date(oldest.date) ? g : oldest, null)?.date ?? 'unknown'}.`
      : '',
  ].filter(Boolean).join(' ')

  return {
    metric: 'plan:gift',
    value: totalPETs,
    unit: 'gbp',
    formula,
    source: 'engine',
    confidence: allGifts.length > 0 ? 'medium' : 'low',
    terminal: false,
    drivers: level >= 1 ? [] : [
      { metric: 'annualExemption', value: giftRemaining, unit: 'gbp',
        formula: `£${giftExemption.toLocaleString()} annual gift exemption. £${giftUsed.toLocaleString()} used this tax year, £${giftRemaining.toLocaleString()} remaining. Unused exemption carries forward one year.`,
        source: 'engine', confidence: 'medium', terminal: true, drivers: [] },
      { metric: 'petWindow', value: totalPETs, unit: 'gbp',
        formula: within7yr.length > 0
          ? `${within7yr.length} PET(s) totalling £${totalPETs.toLocaleString()} still within 7-year window. Taper relief applies after year 3: 80%→60%→40%→20%→0% of original IHT charge.`
          : 'No PETs in 7-year window. All previous gifts are IHT-free.',
        source: 'engine', confidence: allGifts.length > 0 ? 'medium' : 'low', terminal: true, drivers: [] },
    ],
  }
}

function drvPlanTax(entity, level) {
  const itd   = safe(() => incomeTaxDetail(entity), null)
  const cgtd  = safe(() => cgtDetail(entity), null)
  const allow = safe(() => allowanceTracker(entity), null)

  const marginalRate  = itd?.marginal_rate ?? 0
  const totalTax      = itd?.total_tax ?? 0
  const band          = marginalRate >= 0.45 ? 'Additional rate (45%)' : marginalRate >= 0.40 ? 'Higher rate (40%)' : marginalRate >= 0.20 ? 'Basic rate (20%)' : 'Personal allowance (0%)'
  const cgtRemaining  = allow?.cgt?.remaining ?? (cgtd ? Math.max(0, (cgtd.annual_exempt_amount || 3000) - (cgtd.total_gains || 0)) : 3000)
  const isaRemaining  = allow?.isa?.remaining ?? 0
  const pensionRemain = allow?.pension_aa?.current_year?.remaining ?? allow?.pension?.remaining ?? 0

  const formula = [
    `Income tax band: ${band}. Estimated annual income tax: £${(totalTax || 0).toLocaleString()}.`,
    `CGT annual exempt amount remaining: £${cgtRemaining.toLocaleString()}.`,
    `ISA allowance remaining: £${isaRemaining.toLocaleString()} of £20,000.`,
    `Pension annual allowance remaining: £${pensionRemain.toLocaleString()} of £60,000.`,
    marginalRate >= 0.40 ? 'Consider pension contributions to reduce adjusted net income and recover personal allowance.' : '',
  ].filter(Boolean).join(' ')

  return {
    metric: 'plan:tax',
    value: totalTax,
    unit: 'gbp',
    formula,
    source: 'engine',
    confidence: itd ? 'medium' : 'low',
    terminal: false,
    drivers: level >= 1 ? [] : [
      { metric: 'incomeTaxBand', value: marginalRate, unit: 'pct',
        formula: `Marginal rate: ${Math.round(marginalRate * 100)}%. ${band}. Total estimated income tax this year: £${(totalTax || 0).toLocaleString()}.`,
        source: 'engine', confidence: itd ? 'medium' : 'low', terminal: true, drivers: [] },
      { metric: 'cgtHeadroom', value: cgtRemaining, unit: 'gbp',
        formula: `CGT annual exemption: £3,000. £${cgtRemaining.toLocaleString()} unused. Gains above this are taxed at 18% (basic) or 24% (higher/additional) for residential property, 10%/20% for other assets.`,
        source: 'engine', confidence: 'medium', terminal: true, drivers: [] },
      { metric: 'isaRoom', value: isaRemaining, unit: 'gbp',
        formula: `ISA annual allowance: £20,000. £${isaRemaining.toLocaleString()} remaining this tax year. Cash ISA cap of £12,000 applies from 6 April 2027.`,
        source: 'engine', confidence: 'medium', terminal: true, drivers: [] },
      { metric: 'pensionRoom', value: pensionRemain, unit: 'gbp',
        formula: `Pension annual allowance: £60,000 (tapered for income above £260,000). £${pensionRemain.toLocaleString()} remaining. Carry-forward of unused allowance from prior 3 years may apply.`,
        source: 'engine', confidence: 'medium', terminal: true, drivers: [] },
    ],
  }
}

// ─── Dimension leaf resolver ─────────────────────────────────────────────────
// A wealth- or risk-score dimension, tapped from the score drill. Returns a
// coherent terminal node (definition + current value) so the tap explains the
// dimension instead of dead-ending. Returns null if `metric` isn't a dimension.
function dimValue(raw) {
  if (raw && typeof raw === 'object') return raw.value ?? 0
  return raw ?? 0
}
function drvDimension(entity, metric) {
  const wd = DIM_BY_KEY[metric]
  if (wd) {
    const fq = safe(() => calcFQ(entity), { dims: {} })
    const value = dimValue(fq.dims?.[metric])
    const bd = safe(() => fqBreakdown(entity)[metric], null)
    const how = bd?.summary ? ` How it's built: ${bd.summary}` : ''
    return {
      metric, value, unit: 'score',
      formula: `${wd.definition} You're at ${Math.round(value)} of a possible ${wd.max} on this dimension.${how}`,
      breakdown: bd || null, // structured parts → DetailOverlay renders a table
      source: 'engine', confidence: 'medium', terminal: true, drivers: [],
    }
  }
  if (RISK_DIM_DESCRIPTIONS[metric]) {
    const risk = safe(() => calcRisk(entity), { dims: {} })
    const value = dimValue(risk.dims?.[metric])
    const bd = safe(() => riskBreakdown(entity)[metric], null)
    const how = bd?.summary ? ` How it's built: ${bd.summary}` : ''
    const max = bd?.max ? ` of ${bd.max}` : ''
    return {
      metric, value, unit: 'score',
      formula: `${RISK_DIM_DESCRIPTIONS[metric]} You're at ${Math.round(value)}${max} on this resilience dimension.${how}`,
      breakdown: bd || null, // structured parts → DetailOverlay renders a table
      source: 'engine', confidence: 'medium', terminal: true, drivers: [],
    }
  }
  return null
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
