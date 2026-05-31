// src/engine/decumulation-plan.js
// Pure, deterministic, Node-importable. Produces the guided withdrawal
// sequence + flags for a set of pension pots. Info/guidance only — every
// reason is framed as "advisers generally…", never "you should".
// Spec: docs/superpowers/specs/2026-05-31-pension-surface-redesign-design.md §3 (Decide).

const YEAR_MS = 365.25 * 24 * 3600 * 1000

// SIPP / personal = self-invested (user controls drawdown).
// Everything else (DB, occupational DC, legacy, workplace) = verify first.
export function classifyPot(pot = {}) {
  const t = String(pot.type || '').toLowerCase()
  if (/sipp|self|personal/.test(t)) return 'self-invested'
  return 'workplace-legacy'
}

// A pot needs review if its nomination is stale (>2y) or it is legacy/DB
// (guarantees unverified). `now` injectable for deterministic tests.
export function potsNeedingReview(pots = [], { now = new Date() } = {}) {
  return pots.filter(p => {
    const stale = p.nominationDate
      ? (now - new Date(p.nominationDate)) > 2 * YEAR_MS
      : true
    return stale || classifyPot(p) === 'workplace-legacy'
  })
}

// Build the ordered, reasoned sequence. `now`/`iht2027` injectable for tests.
export function buildDecumulationPlan(pots = [], opts = {}) {
  const {
    age = 65,
    now = new Date(),
    iht2027 = new Date('2027-04-06'),
    flexibleIncomeTaken = false,
  } = opts

  const legacy = pots.filter(p => classifyPot(p) === 'workplace-legacy')
  const sipps  = pots.filter(p => classifyPot(p) === 'self-invested')
  const steps = []

  if (legacy.length) {
    steps.push({
      action: 'verify',
      title: `Check your ${legacy.length > 1 ? 'workplace/legacy pensions' : legacy[0].name} first`,
      reason: 'Legacy and workplace schemes can carry protected tax-free cash, a protected retirement age, or safeguarded/guaranteed benefits. Advisers generally verify these before drawing anything — the pot may be worth more left untouched. Safeguarded benefits over £30,000 legally require regulated advice to transfer.',
    })
  }
  steps.push({
    action: 'tax-free-cash',
    title: 'Take tax-free cash in phases',
    reason: 'Up to 25% across your pots is tax-free (within the Lump Sum Allowance). Phasing it, rather than taking it all at once, preserves death-benefit flexibility and keeps more invested.',
  })
  if (sipps.length) {
    steps.push({
      action: 'flex',
      title: `Flex your ${sipps.length > 1 ? 'SIPPs' : sipps[0].name} for income`,
      reason: 'Self-invested pots are your adjustable income engine — you can vary withdrawals year to year to manage tax bands and sequence-of-returns risk.',
    })
  }
  steps.push({
    action: 'time-2027',
    title: 'Time it against 6 April 2027',
    reason: 'Until April 2027 pensions sit outside your estate, so the usual order is to spend other money first and leave pensions last. From April 2027 they count toward inheritance tax — which can flip the logic toward drawing or gifting sooner.',
  })

  const sequence = steps.map((s, i) => ({ ...s, order: i + 1 }))

  const flags = []
  if (legacy.length) flags.push({ code: 'VERIFY_LEGACY', severity: 'warn', message: `${legacy.length} workplace/legacy scheme${legacy.length > 1 ? 's need' : ' needs'} checking for guarantees before action.` })
  if (flexibleIncomeTaken) flags.push({ code: 'MPAA', severity: 'warn', message: 'You may have triggered the Money Purchase Annual Allowance — future contributions could be capped at the MPAA, not the full Annual Allowance.' })
  const daysTo2027 = Math.round((iht2027 - now) / (24 * 3600 * 1000))
  if (daysTo2027 > 0 && daysTo2027 <= 365) flags.push({ code: 'IHT_2027_SOON', severity: 'info', message: `Pensions enter your estate for inheritance tax in ${daysTo2027} days.` })
  const accessAge = 55 // 57 from April 2028 — sourced from TAX at call sites that have it
  if (age < accessAge) flags.push({ code: 'NO_ACCESS_YET', severity: 'info', message: `Personal pensions are normally accessible from age ${accessAge}.` })

  return { sequence, flags }
}

// Pick the factor that most argues for draining a pot sooner, vs its rankable
// peers (the `charges`/`rets` passed in are the flex set only, so a legacy
// pot's outlier charge can't mask a SIPP-vs-SIPP fee gap). Names the figure.
function _dominantReason(s, charges, rets) {
  const maxCharge = Math.max(...charges), minRet = Math.min(...rets)
  const chargeLeads = s.factors.charge === maxCharge && maxCharge > 0 && charges.some(c => c !== maxCharge)
  const growthLeads = s.factors.growth === minRet && rets.some(r => r !== minRet)
  if (chargeLeads) return `Higher charge (${(s.factors.charge * 100).toFixed(2)}%) than the other pots — drain it sooner to cut lifetime fees.`
  if (growthLeads) return `Lower expected growth (${(s.factors.growth * 100).toFixed(1)}%) — drain before the faster-growing pots so they compound.`
  return 'Lower charge and similar growth — keep it ahead of the legacy pot; capture its fund to refine the order.'
}

// Rank pots into a draw-order: which to turn into income first, and why.
// Pure — each pot may carry `expectedReturn` (fraction), `charge` (fraction),
// `value`, and `expectedReturnSource` ('actual' suppresses the unknown flag).
// Legacy/guarantee-risk pots are deferred to the end (verify before drawing).
// Drain-sooner score = 0.5·charge + 0.3·(1−growth) + 0.2·value (min-max normed).
export function rankDrawOrder(pots = []) {
  if (!pots.length) return { ranked: [] }
  const charges = pots.map(p => +p.charge || 0)
  const rets = pots.map(p => +p.expectedReturn || 0)
  const vals = pots.map(p => +p.value || 0)
  const norm = (arr, v) => { const mn = Math.min(...arr), mx = Math.max(...arr); return mx === mn ? 0.5 : (v - mn) / (mx - mn) }

  const scored = pots.map(p => {
    const legacy = classifyPot(p) === 'workplace-legacy'
    const drainScore = 0.5 * norm(charges, +p.charge || 0) + 0.3 * (1 - norm(rets, +p.expectedReturn || 0)) + 0.2 * norm(vals, +p.value || 0)
    const unknowns = []
    if (!(+p.charge)) unknowns.push('charge')
    if (p.expectedReturnSource !== 'actual') unknowns.push('actual fund return')
    if (legacy) unknowns.push('exit penalty / guarantee')
    return { pot: p, legacy, drainScore, factors: { charge: +p.charge || 0, growth: +p.expectedReturn || 0, value: +p.value || 0 }, unknowns }
  })

  const flex = scored.filter(s => !s.legacy).sort((a, b) => b.drainScore - a.drainScore || b.factors.value - a.factors.value)
  const keep = scored.filter(s => s.legacy)
  const ordered = [...flex, ...keep]
  const n = ordered.length
  // Compare each flex pot only against other flex pots, so a legacy pot's
  // outlier charge can't mask a SIPP-vs-SIPP fee difference.
  const flexCharges = flex.length ? flex.map(s => s.factors.charge) : [0]
  const flexRets = flex.length ? flex.map(s => s.factors.growth) : [0]

  const ranked = ordered.map((s, i) => ({
    ...s,
    order: i + 1,
    priority: s.legacy ? 'verify-keep' : (i === 0 ? 'draw-first' : i === n - 1 ? 'keep-longest' : 'middle'),
    primaryReason: s.legacy
      ? 'Verify guarantees/penalties before drawing — may be worth keeping.'
      : _dominantReason(s, flexCharges, flexRets),
  }))
  return { ranked }
}
