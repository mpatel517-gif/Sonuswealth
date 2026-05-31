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
