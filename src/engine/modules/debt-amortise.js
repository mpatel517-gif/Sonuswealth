// ─────────────────────────────────────────────────────────────────────────────
// debt-amortise — the ONE correct amortisation calc for EVERY liability surface.
//
// Engine-homed canonical version (moved here 2026-06-07 from
// components/MyMoney/debtMath.js so the engine — not a component — owns the
// single debt model). The old path re-exports these so existing imports keep
// working. Per the temporal-drilldown audit P1: a debt with payments trends to
// ZERO; it never grows unless genuinely interest-only / negative-amortising,
// and that case is labelled honestly (status 'interest-only').
//
// Honest by construction:
//   · no payment basis        → status 'no-payment'    (don't invent a payoff)
//   · payment ≤ interest       → status 'interest-only' (balance not reducing)
//   · payment >  interest      → status 'amortising'    with a REAL payoff
// All outputs are estimates from the captured balance/rate/payment — label as
// such in the UI; never present a projected payoff as a fact.
//
// No React. Node-importable. Pure (no Date.now()).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {number} balance   outstanding £ (positive)
 * @param {number} aprPct    annual interest rate as a PERCENT (e.g. 5.4), or null
 * @param {number} monthly   monthly payment £ (0/undefined if not captured)
 * @returns {{
 *   status:'amortising'|'interest-only'|'no-payment',
 *   monthlyInterest:number, interestYear1:number,
 *   payoffMonths:number|null, payoffYears:number|null,
 *   forward:(n:number)=>number[]   // n monthly balances going FORWARD from now
 * }}
 */
export function amortise(balance, aprPct, monthly) {
  const bal = Math.max(0, +balance || 0)
  const r = (+aprPct || 0) / 100 / 12        // monthly rate
  const pay = Math.max(0, +monthly || 0)
  const monthlyInterest = bal * r

  // Forward balance series at the current payment (clamped at 0).
  const forward = (n) => {
    const out = []
    let b = bal
    for (let i = 0; i < n; i++) {
      out.push(Math.round(b))
      const interest = b * r
      b = Math.max(0, b + interest - pay)
    }
    return out
  }

  if (pay <= 0) {
    return { status: 'no-payment', monthlyInterest, interestYear1: monthlyInterest * 12, payoffMonths: null, payoffYears: null, forward }
  }
  // Interest-only (or under-paying): payment doesn't exceed the interest, so the
  // balance never falls. 1.5% tolerance so a payment that *just* covers interest
  // isn't shown as a multi-century payoff.
  if (pay <= monthlyInterest * 1.015) {
    // interestYear1: a true interest-only loan pays exactly the interest.
    return { status: 'interest-only', monthlyInterest, interestYear1: monthlyInterest * 12, payoffMonths: null, payoffYears: null, forward }
  }

  // Amortising — real payoff.
  let payoffMonths
  if (r === 0) {
    payoffMonths = Math.ceil(bal / pay)
  } else {
    payoffMonths = Math.ceil(Math.log(pay / (pay - r * bal)) / Math.log(1 + r))
  }
  if (!Number.isFinite(payoffMonths) || payoffMonths < 0) payoffMonths = null

  // First-year interest — iterate 12 months (or to payoff if sooner).
  let b = bal, interestYear1 = 0
  const months1 = Math.min(12, payoffMonths || 12)
  for (let i = 0; i < months1; i++) {
    const interest = b * r
    interestYear1 += interest
    b = Math.max(0, b + interest - pay)
  }

  return {
    status: 'amortising',
    monthlyInterest,
    interestYear1,
    payoffMonths,
    payoffYears: payoffMonths != null ? payoffMonths / 12 : null,
    forward,
  }
}

// Human payoff string — YEARS, never raw months (founder 2026-06-01: "439
// months / 5637 months" unreadable). Interest-only/no-payment read honestly.
export function payoffLabel(am) {
  if (!am) return '—'
  if (am.status === 'interest-only') return 'Interest-only — balance not reducing'
  if (am.status === 'no-payment') return 'No payment recorded'
  const y = am.payoffYears
  if (y == null) return '—'
  if (y < 1) return `clears in ~${Math.round(y * 12)} mo`
  // A payment that only just exceeds the interest takes many decades to clear —
  // a precise "~58 yr" reads as broken even though it's correct. Cap the message.
  if (y > 40) return 'over 40 yr at this rate — mostly interest'
  return `clears in ~${y.toFixed(y < 10 ? 1 : 0)} yr`
}

// Calendar year it clears (uses a passed-in current year so the module stays
// pure — Date.now() is unavailable in some runtimes / breaks resume).
export function clearsYear(am, currentYear) {
  if (!am || am.payoffMonths == null) return null
  return currentYear + Math.round(am.payoffMonths / 12)
}

// ─────────────────────────────────────────────────────────────────────────────
// Entity-level liability enumeration + projection — the canonical "what does
// this person owe, and what will they owe in N years" used by Timeline's
// forecast, MyMoney's hero strip, and the Decision Engine. ONE debt model.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enumerate a person's captured debts into the {balance, apr(%), monthly} shape
 * amortise() consumes. Handles BOTH liability schemas (legacy object with
 * mortgage+otherLoans, and the array shape). APR is normalised to a PERCENT.
 * NB rates are stored as DECIMAL fractions in fixtures (0.054) → ×100 here.
 *
 * @param {object} entity
 * @returns {Array<{balance:number, apr:number, monthly:number, type?:string}>}
 */
export function enumerateDebts(entity) {
  const l = entity?.liabilities
  if (!l) return []
  const debts = []
  const norm = (raw) => {
    const v = +raw || 0
    // Stored as decimal fraction (<=1) ⇒ a percent; already-percent (>1) passes through.
    return v > 0 && v <= 1 ? v * 100 : v
  }

  if (Array.isArray(l)) {
    l.forEach(x => {
      const bal = +(x.outstanding_balance_gbp ?? x.outstanding_balance ?? x.balance ?? x.outstanding ?? 0) || 0
      if (!bal) return
      debts.push({
        balance: bal,
        apr: norm(x.apr ?? x.interest_rate ?? x.rate ?? 0),
        monthly: +(x.monthlyPayment ?? x.monthly_payment ?? x.repayment_from_salary_monthly ?? 0) || 0,
        type: x.type,
      })
    })
    return debts
  }

  // Legacy object shape — mortgage + otherLoans.
  const m = l.mortgage
  if (m && +m.outstanding > 0) {
    debts.push({
      balance: +m.outstanding,
      apr: norm(m.rate ?? m.apr ?? m.interest_rate ?? 0),
      monthly: +(m.monthlyPayment ?? m.monthly_payment ?? 0) || 0,
      type: 'mortgage',
    })
  }
  ;(l.otherLoans || []).forEach(x => {
    const bal = +(x.outstanding ?? x.outstanding_balance ?? x.balance ?? 0) || 0
    if (!bal) return
    debts.push({
      balance: bal,
      apr: norm(x.apr ?? x.interest_rate ?? x.rate ?? 0),
      monthly: +(x.monthlyPayment ?? x.monthly_payment ?? x.repayment_from_salary_monthly ?? 0) || 0,
      type: x.type,
    })
  })
  return debts
}

/**
 * Project total liabilities forward `years` by amortising every captured debt
 * through amortise() — debts with payments trend DOWN; interest-only / no-payment
 * debts are held FLAT (never grown). A `residualNow` (selector-only debt we can't
 * enumerate, e.g. property[].mortgage_outstanding) is held FLAT so we never
 * understate debt. years<=0 ⇒ enumerated-now + residual (today).
 *
 * @param {object} entity
 * @param {number} years
 * @param {number} [residualNow=0]  selector total minus enumerated total, held flat
 * @returns {number}
 */
export function liabilitiesAtHorizon(entity, years, residualNow = 0) {
  const debts = enumerateDebts(entity)
  const enumeratedNow = debts.reduce((s, d) => s + d.balance, 0)
  const residual = Math.max(0, +residualNow || 0)
  if (!years || years <= 0) return Math.round(enumeratedNow + residual)
  const months = Math.round(years * 12)
  const projected = debts.reduce((s, d) => {
    const am = amortise(d.balance, d.apr, d.monthly)
    // interest-only / no-payment ⇒ forward() holds balance flat (never grows).
    const series = am.forward(months + 1)
    return s + (series[months] ?? d.balance)
  }, 0)
  return Math.round(projected + residual)
}
