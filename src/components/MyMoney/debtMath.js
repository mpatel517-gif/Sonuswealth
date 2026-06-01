// ─────────────────────────────────────────────────────────────────────────────
// debtMath — the ONE correct amortisation calc for every liability surface
// (tile sparkline, per-debt leaf, the "What you owe" drill). DRY so the
// 470-year / "5637 months" interest-only bug (founder 2026-06-01) cannot
// reappear in one place after being fixed in another.
//
// Honest by construction:
//   · no payment basis        → status 'no-payment'  (don't invent a payoff)
//   · payment ≤ interest       → status 'interest-only' (balance not reducing)
//   · payment >  interest      → status 'amortising' with a REAL payoff
// All outputs are estimates from the captured balance/rate/payment — label as
// such in the UI; never present a projected payoff as a fact.
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
