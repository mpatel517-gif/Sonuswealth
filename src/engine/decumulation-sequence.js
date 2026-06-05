// ─────────────────────────────────────────────────────────────────────────────
// DECUMULATION — PER-HOLDING DRAW SEQUENCER  (engine P2)
//
// Spec: 0-Active/route-specs/2026-06-03-decumulation-engine-redesign-SPEC.md §5.
//
// The existing solver sequences by ASSET CLASS (gia → isa → pension → cash) — so
// "I have 5 pensions, which one first?" is unanswerable: they collapse into one
// "pension" node. This module orders the genuine drawable residual at the
// INDIVIDUAL-HOLDING level and, for every holding, states WHY it sits where it
// does (charge drag, embedded gain, wrapper tax, liquidity, IHT-2027 estate
// treatment). It is the per-holding answer the founder asked for: e.g.
// "Pension A (high charge) → ISA … no — Cash → GIA (low gain) → Nest (legacy) → AJ Bell SIPP → ISA last".
//
// STANCE (information / guidance — NOT advice): every entry is a factual factor
// set ("here is the tax/charge/liquidity consequence of drawing X"), never
// "you should sell X". One illustration of a goals-based method, not a personal
// recommendation. FCA boundary carried on the output.
//
// Pure & deterministic. All thresholds read from the TAX bundle, never hardcoded.
// ─────────────────────────────────────────────────────────────────────────────

import { TAX } from './fq-calculator.js'
import { normaliseHoldings } from './decumulation-holdings.js'
import { evaluateHoldings, DRAW_CLASS } from './decumulation-classify.js'

const FCA = 'One illustration of a goals-based draw order under your stated priorities and the current rules — not a forecast or a personal recommendation. Verify with a qualified UK adviser.'

// Which wrapper bucket a holding draws from (the coarse order), independent of
// the per-holding tiebreak that follows.
function wrapperOf(h) {
  if (h.category === 'pensions') return 'pension'
  if (h.category === 'cash') return 'cash'
  const t = String(h.taxonomyId || '')
  if (/^ISA|LISA|IFISA/.test(t) || h.wrapperClass === 'ISA_FAMILY') return 'isa'
  return 'gia' // GIA / equities / funds / investment trusts / ETFs etc.
}

// Goal → coarse wrapper order. The user's primary goal selects the spine; the
// per-holding tiebreak (charge, gain, value) orders within each wrapper. The
// 2027 IHT overlay can pull pensions EARLIER for an IHT-exposed legacy goal —
// surfaced as a note rather than silently reversing the spine (P3 will fully
// model it). Spec §5 step 5.
const WRAPPER_ORDER = {
  min_lifetime_tax:   ['cash', 'gia', 'pension', 'isa'],
  greatest_net_return:['gia', 'cash', 'pension', 'isa'],
  max_lifetime_spend: ['gia', 'cash', 'isa', 'pension'],
  income_floor:       ['cash', 'gia', 'isa', 'pension'],
  never_run_out:      ['cash', 'gia', 'isa', 'pension'],
  legacy:             ['cash', 'gia', 'isa', 'pension'], // pre-2027; overlay flips pension earlier
  default:            ['cash', 'gia', 'pension', 'isa'],
}

const pct = (x) => `${(Math.round((+x || 0) * 1000) / 10)}%`
const gbp = (x) => '£' + Math.round(+x || 0).toLocaleString()

// Friendly fallback names for holdings a fixture stores without a name (cash /
// GIA / ISA aggregates). Pensions usually carry their own provider name.
const PRETTY_TAXON = {
  SAVINGS: 'Easy-access savings', CURRENT: 'Current account', NOTICE: 'Notice account',
  FIXED: 'Fixed-rate savings', PREMIUM_BONDS: 'Premium Bonds',
  GIA: 'Investment account (GIA)', EQUITIES: 'Shares', FUNDS: 'Funds', ETF: 'ETFs', INV_TRUST: 'Investment trust',
  ISA_SS: 'Stocks & Shares ISA', ISA_CASH: 'Cash ISA', LISA: 'Lifetime ISA', IFISA: 'Innovative Finance ISA',
  SIPP: 'SIPP', SSAS: 'SSAS', WORKPLACE_DC: 'Workplace pension', GPP: 'Personal pension',
  GILTS: 'Gilts', CORP_BONDS: 'Corporate bonds',
}
const prettyName = (h) => h.name || h.provider || PRETTY_TAXON[h.taxonomyId] || h.taxonomyId

// Plain-English WHY for a single holding, from its draw class + features.
function reasonFor(h, wrapper, post2027) {
  const cls = h.drawClassification
  const charge = (+h.amc || 0) + (+h.ocf || 0)
  if (cls === DRAW_CLASS.DRAW_FIRST_LOW_RETURN || (wrapper === 'cash'))
    return `Low-return cash — spend this before your invested pots so they keep compounding.`
  if (cls === DRAW_CLASS.CONSOLIDATE_FIRST)
    return `High annual charge (${pct(charge)}) drags this legacy pot — drawing or consolidating it first stops fees eating your return.`
  if (wrapper === 'gia' || cls === DRAW_CLASS.CGT_MANAGED) {
    const g = h.embeddedGainPct != null ? ` (about ${pct(h.embeddedGainPct)} of it is gain)` : ''
    return `Held outside a tax wrapper${g} — realise gradually to use your ${gbp(TAX.cgaAllowance ?? TAX.cgtAllowance ?? 3000)} CGT allowance; lower-gain holdings first.`
  }
  if (cls === DRAW_CLASS.DRAW_LAST_TAX_FREE || wrapper === 'isa')
    return `Tax-free wrapper — keep it growing and draw it last (or for tax-free top-ups in higher-rate years).`
  if (cls === DRAW_CLASS.DRAW_EARLY_CGT_EXEMPT)
    return `CGT-exempt (gilts/QCB) — can be drawn early without a capital-gains charge.`
  if (wrapper === 'pension') {
    const chargeNote = charge > 0 ? ` Its charge is ${pct(charge)}` + (h._chargeRank === 'high' ? ' — higher than your other pensions, so it drains earlier.' : '.') : ''
    const iht = post2027 ? ' From 6 Apr 2027 unused pension counts toward your estate for IHT — drawing some within your basic-rate band can reduce that exposure.' : ' Pre-2027 it sits outside your estate, so it is usually kept until later.'
    return `Taxable on withdrawal — draw within your tax bands to avoid pushing into a higher rate.${chargeNote}${iht}`
  }
  return `Drawable holding ordered under your ${'priority'}.`
}

const _charge = (h) => (+h.amc || 0) + (+h.ocf || 0)

// Order the sequenceable holdings by a wrapper spine + per-holding tiebreaks.
// Pure; returns the ordered holdings (not yet mapped to the public shape).
function orderSequenceable(sequenceable, spine) {
  const pensions = sequenceable.filter(h => h.category === 'pensions')
  if (pensions.length > 1) {
    const maxC = Math.max(...pensions.map(_charge))
    pensions.forEach(p => { if (_charge(p) >= maxC && maxC > 0) p._chargeRank = 'high' })
  }
  const wrapRank = (h) => { const i = spine.indexOf(wrapperOf(h)); return i < 0 ? 99 : i }
  const within = (a, b) => {
    const w = wrapperOf(a)
    if (w === 'pension') { const d = _charge(b) - _charge(a); return d !== 0 ? d : (a.currentValue || 0) - (b.currentValue || 0) }
    if (w === 'gia') { const ga = a.embeddedGainPct ?? 1, gb = b.embeddedGainPct ?? 1; if (ga !== gb) return ga - gb }
    return (b.currentValue || 0) - (a.currentValue || 0)
  }
  return [...sequenceable].sort((a, b) => { const wr = wrapRank(a) - wrapRank(b); return wr !== 0 ? wr : within(a, b) })
}

// Named candidate STRATEGIES the engine compares (each a wrapper spine). The
// per-holding tiebreak then expands each into a full individual-holding order.
const ROUTE_ARCHETYPES = [
  { id: 'cash-first', name: 'Spend cash first', spine: ['cash', 'gia', 'pension', 'isa'] },
  { id: 'taxable-first', name: 'Taxable accounts first', spine: ['gia', 'cash', 'pension', 'isa'] },
  { id: 'pension-first', name: 'Pension first (IHT-led)', spine: ['pension', 'gia', 'cash', 'isa'] },
  { id: 'isa-preserve', name: 'Preserve pension (pre-2027)', spine: ['cash', 'gia', 'isa', 'pension'] },
  { id: 'isa-flex', name: 'Keep ISA flexible last', spine: ['cash', 'gia', 'pension', 'isa'] },
]

// Goal → factor weights (sum 1). Transparent: the winning route is the one whose
// factor profile best fits the user's stated priority — surfaced, not hidden.
const GOAL_WEIGHTS = {
  min_lifetime_tax:   { tax: 0.55, charge: 0.20, iht: 0.15, flex: 0.10 },
  legacy:             { tax: 0.15, charge: 0.10, iht: 0.60, flex: 0.15 },
  max_lifetime_spend: { tax: 0.35, charge: 0.20, iht: 0.05, flex: 0.40 },
  income_floor:       { tax: 0.25, charge: 0.20, iht: 0.10, flex: 0.45 },
}

// Score one ordered route on 4 transparent, directional factors (0–100 each).
// Honest proxies — labelled illustrative, not a guarantee. Differences between
// routes are real and reflect genuine trade-offs (tax vs IHT vs flexibility).
function scoreRoute(orderedHoldings, post2027) {
  const n = orderedHoldings.length || 1
  const total = orderedHoldings.reduce((s, h) => s + (h.currentValue || 0), 0) || 1
  // position weight: 0 (drawn first) → 1 (drawn last)
  const pos = (i) => i / Math.max(1, n - 1)
  let tax = 0, charge = 0, iht = 0, flex = 0
  orderedHoldings.forEach((h, i) => {
    const w = wrapperOf(h); const share = (h.currentValue || 0) / total; const p = pos(i)
    // TAX: good to draw cash/GIA early (allowances), pension mid (band-fill, avoid bunching), ISA late.
    if (w === 'cash') tax += share * (1 - p)
    if (w === 'gia') tax += share * (1 - p) * 0.9
    if (w === 'pension') tax += share * (1 - Math.abs(p - 0.55) * 2) // best drawn around the middle
    if (w === 'isa') tax += share * p
    // CHARGE: good to draw HIGH-charge holdings early.
    const c = _charge(h); charge += share * (c > 0 ? (c / 0.0125) * (1 - p) : 0.3 * (1 - p))
    // IHT (post-2027): pension in estate → drawing pension earlier reduces exposure; ISA preserved transferable.
    if (w === 'pension') iht += share * (post2027 ? (1 - p) : p)
    else if (w === 'isa') iht += share * (1 - p) * 0.4
    else iht += share * 0.5
    // FLEX: keeping accessible ISA/cash for later = more flexibility.
    if (w === 'isa' || w === 'cash') flex += share * p
    else flex += share * 0.4
  })
  const clamp = (x) => Math.max(0, Math.min(100, Math.round(x * 100)))
  return { tax: clamp(tax), charge: clamp(charge), iht: clamp(iht), flex: clamp(flex) }
}

const _factorial = (k) => { let r = 1; for (let i = 2; i <= k; i++) r *= i; return r }

// Map ordered holdings → the public per-holding shape (rank + reason etc.).
function mapOrder(ordered, post2027) {
  return ordered.map((h, i) => {
    const wrapper = wrapperOf(h)
    return {
      rank: i + 1, id: h.id, name: prettyName(h), label: prettyName(h),
      taxonomyId: h.taxonomyId, category: h.category, wrapper,
      value: h.currentValue || 0, charge: _charge(h) || null,
      embeddedGainPct: h.embeddedGainPct ?? null, drawClass: h.drawClassification,
      reason: reasonFor(h, wrapper, post2027),
    }
  })
}
function mapExcluded(ev) {
  const seen = new Set()
  return (ev.excluded || []).filter(e => {
    const k = e.holding?.id || `${e.holding?.taxonomyId}:${e.holding?.currentValue}:${e.reason}`
    if (seen.has(k)) return false
    seen.add(k); return true
  }).map(e => ({
    label: e.holding ? prettyName(e.holding) : 'Holding',
    value: e.holding?.currentValue || e.holding?.guaranteedAnnual || 0,
    reason: e.reason, drawClass: e.holding?.drawClassification,
  }))
}

/**
 * Evaluate the whole decision: how big the space is, which named strategies the
 * engine compared, their factor scores, and the winner for the chosen goal.
 * This is the "show what the engine considered + how many routes" surface.
 */
export function evaluateDrawRoutes(entity = {}, opts = {}) {
  const goal = opts.goal || 'min_lifetime_tax'
  const post2027 = opts.post2027 != null ? !!opts.post2027 : true
  let holdings = []
  try { holdings = normaliseHoldings(entity) } catch { holdings = [] }
  const ev = evaluateHoldings(holdings, opts)
  const seq = ev.sequenceable || []
  const weights = GOAL_WEIGHTS[goal] || GOAL_WEIGHTS.min_lifetime_tax

  const candidates = ROUTE_ARCHETYPES.map(a => {
    const ordered = orderSequenceable(seq, a.spine)
    const scores = scoreRoute(ordered, post2027)
    const weighted = Math.round(scores.tax * weights.tax + scores.charge * weights.charge + scores.iht * weights.iht + scores.flex * weights.flex)
    return { id: a.id, name: a.name, spine: a.spine, scores, weighted, orderLabels: ordered.map(prettyName) }
  }).sort((x, y) => y.weighted - x.weighted).map((c, i) => ({ ...c, rank: i + 1 }))

  const winner = candidates[0]
  // The displayed per-holding sequence IS the winning route — derived from the
  // SAME spine that won the scoring, so the answer is internally consistent
  // (no separate order table that could disagree with the winner).
  const winSpine = winner ? winner.spine : (WRAPPER_ORDER[goal] || WRAPPER_ORDER.default)
  const sequence = mapOrder(orderSequenceable(seq, winSpine), post2027)

  return {
    goal,
    sequenceableCount: seq.length,
    excludedCount: mapExcluded(ev).length + (ev.specialist || []).length,
    searchSpaceSize: _factorial(seq.length),
    factors: ['Annual charges', 'Wrapper tax (Income/CGT)', 'Embedded gains & CGT allowance', 'Growth rate', 'IHT estate treatment (2027)', 'Liquidity & access age', 'Guaranteed-income floor'],
    weights,
    candidates,
    winnerId: winner?.id || null,
    winnerName: winner?.name || null,
    sequence,
    excluded: mapExcluded(ev),
    specialist: (ev.specialist || []).map(h => ({ label: prettyName(h), reason: 'needs a specialist to value (GMP / protected cash / safeguarded)' })),
    secureIncome: (ev.secureIncome || []).map(s => ({ label: s.streamType || s.sourceTaxonomyId, grossAnnual: s.grossAnnual })),
    netFloorIncome: ev.netFloorIncome || 0,
    disclaimer: FCA,
  }
}

/**
 * Per-holding draw sequence.
 * @param {object} entity
 * @param {object} [opts] { goal: 'min_lifetime_tax'|'legacy'|..., post2027?: boolean }
 * @returns {{ goal, order, excluded, specialist, secureIncome, netFloorIncome, headline, disclaimer }}
 */
export function sequenceDrawHoldings(entity = {}, opts = {}) {
  // Thin wrapper over evaluateDrawRoutes so the sequence is always the WINNING
  // route (single source of truth — no separate order that could disagree).
  const r = evaluateDrawRoutes(entity, opts)
  const first = r.sequence[0]
  return {
    goal: r.goal,
    order: r.sequence,
    excluded: r.excluded,
    specialist: r.specialist,
    secureIncome: r.secureIncome,
    netFloorIncome: r.netFloorIncome,
    headline: first
      ? `Draw ${first.label} first, then work down the list — ordered to serve "${String(r.goal).replace(/_/g, ' ')}".`
      : 'No drawable holdings to sequence yet.',
    disclaimer: r.disclaimer,
  }
}
