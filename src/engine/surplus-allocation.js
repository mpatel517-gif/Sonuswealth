// ─────────────────────────────────────────────────────────────────────────────
// SURPLUS ALLOCATION ENGINE — "where should my next £1 go?"  (accumulation twin
// of the per-holding draw-order sequencer, decumulation-sequence.js).
//
// Founder 2026-06-05: "if I have surplus cashflow what should I do with it —
// should I reinvest, if so where and how?" The decumulation side answers where
// to TAKE money from; this answers where to PUT it. Same pattern: score the
// candidate homes on transparent factors, weight by the user's priority,
// recommend an allocation + the WHY.
//
// STANCE (information / guidance — NOT advice): every home is scored on its
// factual tax/relief/access/return consequence ("here is what happens to your
// next £1 in each"), never "buy fund X" or "you should". One illustration of a
// goals-based allocation, gated by compliance before ship.
//
// Pure & deterministic. Thresholds from the TAX bundle, never hardcoded.
// ─────────────────────────────────────────────────────────────────────────────

import { TAX, liquidityBuffer } from './fq-calculator.js'
import { incomeTaxDetail } from './tax-estate-engine.js'

const FCA = 'One illustration of where spare cashflow could go, scored on your priority and the current rules — the tax/access consequences of each home, not a personal recommendation or a product to buy. Verify with a qualified UK adviser.'

// Priority → factor weights (tax relief/shelter · expected growth · access/
// flexibility · safety/certainty). The recommended home is the one whose factor
// profile best fits what the user says matters — surfaced, not hidden.
const PRIORITY_WEIGHTS = {
  grow:   { tax: 0.30, growth: 0.45, access: 0.10, safety: 0.15 },
  flex:   { tax: 0.20, growth: 0.20, access: 0.50, safety: 0.10 },
  derisk: { tax: 0.15, growth: 0.15, access: 0.20, safety: 0.50 },
}

const pctRate = (x) => `${(Math.round((+x || 0) * 1000) / 10)}%`

/**
 * @param {object} entity
 * @param {object} [opts] { priority:'grow'|'flex'|'derisk', surplusMonthly:number }
 */
export function allocateSurplus(entity = {}, opts = {}) {
  const priority = opts.priority || 'grow'
  const surplusMonthly = Math.max(0, Math.round(+opts.surplusMonthly || 0))
  const surplusAnnual = surplusMonthly * 12

  // Marginal rate drives pension-relief attractiveness.
  let marginal = 0.2
  try { marginal = incomeTaxDetail(entity)?.marginal_rate ?? 0.2 } catch { /* */ }
  const higherRate = marginal >= 0.4

  // Buffer state — how many months of essentials are held.
  let buf = null
  try { buf = liquidityBuffer(entity) } catch { /* */ }
  const bufMonths = buf?.months != null ? buf.months : null
  const bufTarget = 6
  const bufShortMonths = bufMonths != null ? Math.max(0, bufTarget - bufMonths) : 0

  // High-interest debt (a guaranteed, tax-free "return" = the rate avoided).
  const liab = Array.isArray(entity?.liabilities) ? entity.liabilities : []
  const hiDebt = liab.map(l => ({ name: l.name || l.type || 'Debt', rate: +l.apr || +l.interest_rate || +l.rate || 0, bal: +l.outstanding_balance || +l.balance || 0 }))
    .filter(d => d.rate >= 0.06 && d.bal > 0)
    .sort((a, b) => b.rate - a.rate)
  const topDebt = hiDebt[0] || null

  // ISA headroom this year.
  const isaUsed = +(entity?.assets?.isa?.value ?? entity?.assets?.isa?.total ?? 0)
  const isaAllow = +TAX.isaAllowance || 20000
  const isaHeadroomAnnual = Math.max(0, isaAllow - 0) // contribution headroom is the allowance (held value ≠ this year's use; treat allowance as the cap)

  // ── Candidate homes (only those that apply), each scored 0–100 on 4 factors ──
  const homes = []
  if (topDebt) homes.push({
    id: 'debt', name: `Clear ${topDebt.name}`, capMonthly: Math.round(topDebt.bal / 12) || surplusMonthly,
    tax: 60, growth: Math.min(100, Math.round((topDebt.rate / 0.10) * 90)), access: 40, safety: 100,
    reason: `Paying it off is a guaranteed ${pctRate(topDebt.rate)} return, tax-free — nothing in the market beats clearing ${pctRate(topDebt.rate)} debt with certainty.`,
  })
  if (bufShortMonths > 0) homes.push({
    id: 'buffer', name: 'Top up your safety buffer', capMonthly: Math.round((buf?.monthlyEssential || surplusMonthly) * bufShortMonths) || surplusMonthly,
    tax: 40, growth: 25, access: 100, safety: 95,
    reason: `You hold about ${Math.round(bufMonths)} month${Math.round(bufMonths) === 1 ? '' : 's'} of essentials; ${bufTarget} months is the usual floor. Cash here earns little but stops a shock forcing you to sell investments at a bad time.`,
  })
  homes.push({
    id: 'pension', name: 'Pension (SIPP / workplace)', capMonthly: Math.round((+TAX.pensionAA || 60000) / 12),
    tax: higherRate ? 95 : 65, growth: 80, access: 15, safety: 55,
    reason: `Gets ${Math.round(marginal * 100)}% tax relief on the way in${higherRate ? ' (you’re a higher-rate taxpayer — this is the most tax-efficient £)' : ''}, and grows tax-free. Trade-off: locked until age 57. If your employer matches, this almost always wins.`,
  })
  homes.push({
    id: 'isa', name: 'Stocks & Shares ISA', capMonthly: Math.round(isaHeadroomAnnual / 12),
    tax: 75, growth: 80, access: 95, safety: 60,
    reason: `No relief on the way in, but grows completely tax-free and you can access it any time. Up to ${'£' + isaAllow.toLocaleString()}/yr. The flexible workhorse.`,
  })
  homes.push({
    id: 'gia', name: 'General investment account', capMonthly: surplusMonthly,
    tax: 35, growth: 80, access: 85, safety: 55,
    reason: `No wrapper, so gains use your £${(+TAX.cgaAllowance || 3000).toLocaleString()} CGT allowance then are taxed — use this once pension and ISA are full.`,
  })

  const W = PRIORITY_WEIGHTS[priority] || PRIORITY_WEIGHTS.grow
  const scored = homes.map(h => {
    const weighted = Math.round(W.tax * h.tax + W.growth * h.growth + W.access * h.access + W.safety * h.safety)
    return { ...h, scores: { tax: h.tax, growth: h.growth, access: h.access, safety: h.safety }, weighted }
  }).sort((a, b) => b.weighted - a.weighted).map((h, i) => ({ ...h, rank: i + 1 }))

  // ── Recommended ALLOCATION — fill the surplus down the ranked homes, capped ──
  let rem = surplusMonthly
  const allocation = []
  for (const h of scored) {
    if (rem <= 0) break
    const amt = Math.max(0, Math.min(rem, h.capMonthly || rem))
    if (amt <= 0) continue
    allocation.push({ id: h.id, name: h.name, amount: amt, reason: h.reason })
    rem -= amt
  }

  return {
    priority,
    surplusMonthly, surplusAnnual,
    candidates: scored,
    winnerId: scored[0]?.id || null,
    winnerName: scored[0]?.name || null,
    allocation,
    factors: ['Tax relief / shelter', 'Expected growth', 'Access & flexibility', 'Safety / certainty'],
    weights: W,
    marginalRate: marginal,
    headline: scored[0] ? `Put your next £ into ${scored[0].name} first — best fit for "${priority === 'grow' ? 'grow fastest' : priority === 'flex' ? 'stay flexible' : 'cut risk'}".` : 'No surplus to allocate.',
    disclaimer: FCA,
  }
}
