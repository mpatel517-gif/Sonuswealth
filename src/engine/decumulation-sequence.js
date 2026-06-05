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

/**
 * Per-holding draw sequence.
 * @param {object} entity
 * @param {object} [opts] { goal: 'min_lifetime_tax'|'legacy'|..., post2027?: boolean }
 * @returns {{ goal, order, excluded, specialist, secureIncome, netFloorIncome, headline, disclaimer }}
 */
export function sequenceDrawHoldings(entity = {}, opts = {}) {
  const goal = opts.goal || 'min_lifetime_tax'
  const post2027 = opts.post2027 != null ? !!opts.post2027 : true
  let holdings = []
  try { holdings = normaliseHoldings(entity) } catch { holdings = [] }
  const ev = evaluateHoldings(holdings, opts)

  // Mark, within the pension bucket, the higher-charge pots so the reason can say
  // "higher than your other pensions" honestly.
  const pensions = ev.sequenceable.filter(h => h.category === 'pensions')
  if (pensions.length > 1) {
    const charges = pensions.map(p => (+p.amc || 0) + (+p.ocf || 0))
    const maxC = Math.max(...charges)
    pensions.forEach(p => { if (((+p.amc || 0) + (+p.ocf || 0)) >= maxC && maxC > 0) p._chargeRank = 'high' })
  }

  const spine = WRAPPER_ORDER[goal] || WRAPPER_ORDER.default
  const wrapRank = (h) => { const i = spine.indexOf(wrapperOf(h)); return i < 0 ? 99 : i }

  // Within a wrapper: pensions by charge DESC then value ASC (clear small/legacy
  // first); GIA by embedded-gain ASC (low-gain, low-CGT first); cash/isa by value DESC.
  const within = (a, b) => {
    const w = wrapperOf(a)
    if (w === 'pension') {
      const ca = (+a.amc || 0) + (+a.ocf || 0), cb = (+b.amc || 0) + (+b.ocf || 0)
      if (cb !== ca) return cb - ca
      return (a.currentValue || 0) - (b.currentValue || 0)
    }
    if (w === 'gia') {
      const ga = a.embeddedGainPct ?? 1, gb = b.embeddedGainPct ?? 1
      if (ga !== gb) return ga - gb
    }
    return (b.currentValue || 0) - (a.currentValue || 0)
  }

  const ordered = [...ev.sequenceable].sort((a, b) => {
    const wr = wrapRank(a) - wrapRank(b)
    return wr !== 0 ? wr : within(a, b)
  })

  const order = ordered.map((h, i) => {
    const wrapper = wrapperOf(h)
    return {
      rank: i + 1,
      id: h.id,
      name: prettyName(h),
      label: prettyName(h),
      taxonomyId: h.taxonomyId,
      category: h.category,
      wrapper,
      value: h.currentValue || 0,
      charge: (+h.amc || 0) + (+h.ocf || 0) || null,
      embeddedGainPct: h.embeddedGainPct ?? null,
      drawClass: h.drawClassification,
      reason: reasonFor(h, wrapper, post2027),
    }
  })

  // Dedupe excluded by id (the normaliser can emit a holding more than once when
  // a fixture carries both a typed array and an object shape).
  const _seen = new Set()
  const excluded = (ev.excluded || []).filter(e => {
    const k = e.holding?.id || `${e.holding?.taxonomyId}:${e.holding?.currentValue}:${e.reason}`
    if (_seen.has(k)) return false
    _seen.add(k); return true
  }).map(e => ({
    label: e.holding ? prettyName(e.holding) : 'Holding',
    value: e.holding?.currentValue || e.holding?.guaranteedAnnual || 0,
    reason: e.reason,
    drawClass: e.holding?.drawClassification,
  }))

  const first = order[0]
  const headline = first
    ? `Draw ${first.label} first, then work down the list — ordered to serve "${String(goal).replace(/_/g, ' ')}".`
    : 'No drawable holdings to sequence yet.'

  return {
    goal, order, excluded,
    specialist: (ev.specialist || []).map(h => ({ label: h.name || h.taxonomyId, reason: 'needs a specialist to value (GMP / protected cash / safeguarded)' })),
    secureIncome: (ev.secureIncome || []).map(s => ({ label: s.streamType || s.sourceTaxonomyId, grossAnnual: s.grossAnnual })),
    netFloorIncome: ev.netFloorIncome || 0,
    headline,
    disclaimer: FCA,
  }
}
