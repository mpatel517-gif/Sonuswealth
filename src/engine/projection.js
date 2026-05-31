// ─────────────────────────────────────────────────────────────────────────────
// projection.js — pure per-node projection engine for the temporal experience (#18).
//
// Computes Now / Future / Plan for any taxonomy node by compounding its value to
// a horizon age at the CMA asset-class rate (reusing financial-math.js fv/fvAnnuity).
//   · Now    = today's value.
//   · Future = drift — grown on autopilot (no new decisions).
//   · Plan   = Future + committed scenario deltas (caller supplies a pre-folded
//              plan entity; see projectTaxonomy planEntity).
//
// No React. Node-importable. Baseline-safe: horizon == now ⇒ value unchanged.
// Spec: docs/superpowers/specs/2026-05-30-temporal-experience-design.md §3.
// ─────────────────────────────────────────────────────────────────────────────

import { getActiveCMA } from './cma.js'
import { fv, fvAnnuity } from './modules/financial-math.js'

// Taxonomy node type (taxonomy.js keys) → CMA asset class driving its growth.
// Unknown → blended portfolio growth (cma.growth) so nothing silently reads 0.
const CLASS_FOR_TYPE = {
  'pension-sipp': 'global_equity', 'pension-personal': 'global_equity',
  'pension-occupational-dc': 'global_equity', 'pension-ssas': 'global_equity',
  'pension-avc': 'global_equity', 'pension-occupational-db': 'uk_gilts',
  'isa-stocks-shares': 'global_equity', 'isa-lifetime': 'global_equity',
  'isa-junior': 'global_equity', 'gia': 'global_equity',
  'isa-cash': 'cash', 'cash-current': 'cash', 'cash-savings': 'cash',
  'cash-easy-access': 'cash', 'cash-fixed-term': 'cash',
  'property-residence': 'property', 'property-btl': 'property',
  'property-second-home': 'property', 'property-commercial': 'property',
  'property-overseas': 'property',
  'alt-aim': 'alternatives', 'alt-eis': 'alternatives', 'alt-seis': 'alternatives',
  'alt-vct': 'alternatives', 'alt-crypto': 'alternatives', 'alt-art': 'alternatives',
  'alt-physical-gold': 'alternatives',
  'bond-onshore': 'corp_bonds', 'bond-offshore': 'corp_bonds',
}

export function growthRateFor(nodeType, cma = getActiveCMA()) {
  const cls = CLASS_FOR_TYPE[nodeType]
  if (cls && cma.assetClasses?.[cls]) return cma.assetClasses[cls].expectedReturn
  return cma.growth
}

// Compound `now` for `years` at annual `rate`, optionally adding a yearly
// end-of-year contribution. Reuses canonical TVM helpers so math matches the
// rest of the engine. years<=0 ⇒ returns `now` (baseline-safe).
// NB financial-math signatures: fv(amount, rate, periods) · fvAnnuity(payment, rate, periods).
export function projectValue(now, rate, years, contributionPerYear = 0) {
  const y = Math.max(0, Math.floor(years || 0))
  if (y === 0) return now
  const grown = fv(now, rate, y)
  const fromContribs = contributionPerYear ? fvAnnuity(contributionPerYear, rate, y) : 0
  return grown + fromContribs
}

// Yearly value path from now to horizon (inclusive both ends) for sparklines.
// years<=0 ⇒ [now]. Reuses projectValue so the path matches the point engine.
export function projectSeries(now, rate, years, contributionPerYear = 0) {
  const y = Math.max(0, Math.floor(years || 0))
  const out = []
  for (let t = 0; t <= y; t++) out.push(Math.round(projectValue(now, rate, t, contributionPerYear)))
  return out
}

// Project one node to the horizon. Assets/income grow via projectValue; a node
// flagged direction:'shrink' (liability) amortises toward zero at its rate/payment.
export function projectNode(node, opts = {}) {
  const { currentAge, horizonAge, direction = 'grow', cma = getActiveCMA() } = opts
  const years = Math.max(0, (horizonAge ?? currentAge ?? 0) - (currentAge ?? 0))
  const now = +node.value || 0
  if (years === 0) return now

  if (direction === 'shrink') {
    const r = (+node.rate || 0) / 12
    const pmt = +node.monthlyPayment || 0
    const n = years * 12
    if (pmt <= 0) return now
    let bal
    if (r === 0) bal = now - pmt * n
    else bal = now * Math.pow(1 + r, n) - pmt * ((Math.pow(1 + r, n) - 1) / r)
    return Math.max(0, Math.round(bal))
  }

  const rate = growthRateFor(node.type, cma)
  const contrib = (+node.monthlyContribution || 0) * 12
  return Math.round(projectValue(now, rate, years, contrib))
}

// Collect the projectable nodes of an entity (investable + property + liabilities).
function _collect(e) {
  const rows = []
  const a = e?.assets || {}
  const push = (value, type, dir = 'grow', extra = {}) => {
    if (!value) return
    rows.push({ value: +value, type, direction: dir, ...extra })
  }
  ;(a.sipp?.pensions || []).forEach(p => push(p.value, 'pension-sipp', 'grow', { monthlyContribution: p.monthlyContribution }))
  ;(a.pensions || []).forEach(p => push(p.balance || p.cetv || p.value, 'pension-occupational-db'))
  ;(a.investments || []).forEach(i => push(i.value || i.balance, /ISA/i.test(i.type || '') ? 'isa-stocks-shares' : 'gia'))
  ;(a.bank || []).forEach(b => push(b.balance, 'cash-savings'))
  if (a.residence) push(a.residence.value, 'property-residence')
  ;(a.property || []).forEach(p => push(p.value || p.value_gbp, 'property-btl'))
  ;(a.alternatives || []).forEach(x => push(x.value || x.value_gbp, 'alt-crypto'))
  return rows
}

// Walk an entity's nodes, project each to the horizon, return rows + totals.
// `plan` applies committed-scenario deltas when the caller passes a pre-folded
// `planEntity` (base ⊕ SCENARIO_SAVED); without it, plan === future.
export function projectTaxonomy(entity, opts = {}) {
  const { horizonAge, cma = getActiveCMA(), planEntity = null } = opts
  const currentAge = entity?.age ?? 65
  const baseRows = _collect(entity)
  const byNode = baseRows.map(n => ({
    type: n.type,
    now: n.value,
    future: projectNode(n, { currentAge, horizonAge, direction: n.direction, cma }),
  }))
  const planRows = planEntity ? _collect(planEntity) : baseRows
  const planTotal = planRows.reduce((s, n) =>
    s + projectNode(n, { currentAge, horizonAge, direction: n.direction, cma }), 0)
  return {
    byNode,
    totals: {
      now:    byNode.reduce((s, n) => s + n.now, 0),
      future: byNode.reduce((s, n) => s + n.future, 0),
      plan:   planTotal,
    },
  }
}
