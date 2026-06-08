// src/engine/withdrawal-methods.js
// ─────────────────────────────────────────────────────────────────────────────
// The 5 withdrawal-RATE methods (step 2c). Different axis from the decumulation
// solver's draw-ORDER: these answer "how MUCH is sustainable to draw each year?"
// The active goal selects which method fits; the MethodDrawer shows them side by
// side. Pure & deterministic (constant-return projection — NOT Monte Carlo; the
// existing guytonKlingerPath uses Math.random so we do NOT reuse it).
//
// Rates come from swrFromRegime (one source). FCA: methods are general
// approaches advisers reference, shown as illustration, never "you should".
//
// Design: ~/.claude/plans/goal-engine-design.md §3c
// ─────────────────────────────────────────────────────────────────────────────

import { swrFromRegime } from './fq-calculator.js'

export const METHODS = {
  bengen: {
    id: 'bengen', label: 'Bengen 4% rule', source: 'Bengen 1994',
    summary: 'Draw 4% of the starting pot, then increase that £ amount with inflation each year. Simple and predictable, but rigid in bad markets.',
    strength: 'predictable income', weakness: 'ignores how the portfolio is actually doing',
  },
  guyton_klinger: {
    id: 'guyton_klinger', label: 'Guyton-Klinger guardrails', source: 'Guyton & Klinger 2006',
    summary: 'Start higher (~4.5-5%) and adjust: cut the rise in bad years, take a raise in good years. More income on average, but it varies.',
    strength: 'higher lifetime income', weakness: 'income can be cut after poor returns',
  },
  vanguard: {
    id: 'vanguard', label: 'Vanguard dynamic spending', source: 'Vanguard UK',
    summary: 'Draw a fixed % of the CURRENT pot each year, but cap how far the £ income can rise or fall (a ceiling and floor). Balances stability and responsiveness.',
    strength: 'responsive but smoothed', weakness: 'income still moves with markets',
  },
  bucket: {
    id: 'bucket', label: 'Bucket strategy', source: 'Cash / medium / growth buckets',
    summary: 'Hold 2 years of spending in cash, ~5 in medium-risk, the rest in growth. Spend the cash bucket so you never sell growth assets in a downturn.',
    strength: 'protects against bad timing', weakness: 'needs active refilling discipline',
  },
  floor_guardrail: {
    id: 'floor_guardrail', label: 'Sonuswealth floor + guardrail', source: 'Sonuswealth (hybrid)',
    summary: 'Guarantee your ESSENTIAL spending at a safe fixed rate (secure it first), then flex only the DISCRETIONARY part with guardrails. Fixes the main flaw of the others: it never cuts the income you actually need.',
    strength: 'essentials never cut; upside flexes', weakness: 'needs an essentials figure',
    recommended: true,
  },
}

const _rate = (regime) => swrFromRegime(regime).rate

// Deterministic year-by-year path for one method.
// opts: { portfolio, years, growth, inflation, essentialsAnnual, age }
export function methodPath(methodId, opts = {}) {
  const P = +opts.portfolio || 0
  const years = Math.max(1, +opts.years || 30)
  const g = opts.growth != null ? +opts.growth : 0.05
  const infl = opts.inflation != null ? +opts.inflation : 0.025
  const essentials = +opts.essentialsAnnual || 0
  const age0 = +opts.age || 65
  // UI lever: scale the draw up/down (1 = the method's own rate). Enables a
  // "how much you take" slider and back-solving a target (e.g. last-to-age).
  const rs = opts.rateScale != null ? +opts.rateScale : 1
  const out = []
  let bal = P

  if (methodId === 'bengen') {
    let w = P * _rate('bengen') * rs                         // 4% of initial × draw lever
    for (let y = 1; y <= years; y++) {
      const draw = Math.min(w, Math.max(0, bal))
      bal = Math.max(0, bal * (1 + g) - draw)
      out.push({ year: y, age: age0 + y - 1, withdrawal: Math.round(draw), balance: Math.round(bal), rule: 'inflation-linked' })
      w *= (1 + infl)
    }
    return out
  }

  if (methodId === 'guyton_klinger') {
    const initRate = _rate('guyton_klinger') * rs           // ~4.5% × draw lever
    let w = P * initRate
    for (let y = 1; y <= years; y++) {
      const draw = Math.min(w, Math.max(0, bal))
      bal = Math.max(0, bal * (1 + g) - draw)
      const curRate = bal > 0 ? w / bal : 1
      let rule = 'inflation'
      if (curRate > initRate * 1.2) { w *= 0.90; rule = 'guardrail: cut 10%' }       // capital-preservation
      else if (curRate < initRate * 0.8 && y > 1) { w *= 1.10; rule = 'guardrail: raise 10%' } // prosperity
      else w *= (1 + infl)
      out.push({ year: y, age: age0 + y - 1, withdrawal: Math.round(draw), balance: Math.round(bal), rule })
    }
    return out
  }

  if (methodId === 'vanguard') {
    const rate = _rate('vanguard') * rs                     // ~3.3% of current × draw lever
    let prev = P * rate
    for (let y = 1; y <= years; y++) {
      let target = bal * rate
      const ceiling = prev * 1.05, floor = prev * 0.975     // +5% / -2.5% bands
      const w = Math.min(ceiling, Math.max(floor, target))
      const draw = Math.min(w, Math.max(0, bal))
      bal = Math.max(0, bal * (1 + g) - draw)
      out.push({ year: y, age: age0 + y - 1, withdrawal: Math.round(draw), balance: Math.round(bal), rule: 'dynamic ±band' })
      prev = w
    }
    return out
  }

  if (methodId === 'bucket') {
    // Spend from a 2yr cash bucket; growth bucket compounds, refilled annually.
    const rate = _rate('bengen') * rs
    let w = P * rate
    for (let y = 1; y <= years; y++) {
      const draw = Math.min(w, Math.max(0, bal))
      // Growth on the non-cash portion only (~cash = 2yrs of spend held flat).
      const cashHeld = Math.min(bal, draw * 2)
      const growthPortion = Math.max(0, bal - cashHeld)
      bal = Math.max(0, cashHeld + growthPortion * (1 + g) - draw)
      out.push({ year: y, age: age0 + y - 1, withdrawal: Math.round(draw), balance: Math.round(bal), rule: 'spend cash bucket' })
      w *= (1 + infl)
    }
    return out
  }

  if (methodId === 'floor_guardrail') {
    // Essentials floor: fixed real, inflation-linked, never cut. Discretionary:
    // the safe rate applied to the pot above the floor's capital cost, flexed
    // with guardrails. Total = floor + discretionary.
    const floorCost = essentials                            // the income that must never be cut
    let floor = floorCost
    const initRate = _rate('guyton_klinger')
    let disc = Math.max(0, P * _rate('bengen') * rs - floorCost) // discretionary headroom × draw lever
    for (let y = 1; y <= years; y++) {
      const want = floor + disc
      const draw = Math.min(want, Math.max(0, bal))
      bal = Math.max(0, bal * (1 + g) - draw)
      // Floor always inflation-links; discretionary takes the guardrail hit first.
      floor *= (1 + infl)
      const curRate = bal > 0 ? (floor + disc) / bal : 1
      let rule = 'floor secured'
      if (curRate > initRate * 1.25 && disc > 0) { disc *= 0.85; rule = 'floor secured; discretionary cut' }
      else if (curRate < initRate * 0.8 && y > 1) { disc *= 1.10; rule = 'floor secured; discretionary raise' }
      else disc *= (1 + infl)
      out.push({ year: y, age: age0 + y - 1, withdrawal: Math.round(draw), balance: Math.round(bal), rule })
    }
    return out
  }

  throw new Error(`Unknown withdrawal method: ${methodId}`)
}

// Year-1 withdrawal + whether the pot lasts the horizon, for all 5 methods —
// the data the MethodDrawer compares.
export function compareMethods(opts = {}) {
  return Object.keys(METHODS).map(id => {
    const path = methodPath(id, opts)
    const depletes = path.find(p => p.balance <= 0)
    return {
      ...METHODS[id],
      year1Withdrawal: path[0]?.withdrawal ?? 0,
      endingBalance: path[path.length - 1]?.balance ?? 0,
      depletesAtAge: depletes ? depletes.age : null,
      lastsHorizon: !depletes,
      path,
    }
  })
}

// Which method best fits the active goal (the goal selects the method).
export function recommendMethodForGoal(goalType) {
  switch (goalType) {
    case 'income_floor':       return 'floor_guardrail'   // essentials must never be cut
    case 'max_lifetime_spend': return 'guyton_klinger'    // highest average income
    case 'legacy':             return 'bengen'            // lower, steadier draw preserves capital
    case 'min_lifetime_tax':   return 'vanguard'          // smooth, controllable draws
    default:                   return 'floor_guardrail'
  }
}
