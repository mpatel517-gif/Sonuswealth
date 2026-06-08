// ─────────────────────────────────────────────────────────────────────────────
// taxable-income.js — THE canonical income decomposition for all tax cards.
//
// Founder 2026-06-08: the Tax & Estate screen showed five contradictory numbers
// because _grossIncome / calcAllIncome / calcANI each derived income differently
// (salary aliases summed vs MAXed, state pension counted before it starts, gross
// vs net rental, dividends taxed off the NSND-only marginal). This module is the
// single source of truth: classify each income source ONCE, by tax type.
//
// Tax types (UK): NSND = non-savings non-dividend (salary, self-employment, net
// rental profit, pension drawdown, state pension once in payment); SAVINGS =
// interest; DIVIDENDS = dividend income (after ISA shielding).
//
// NOTE: figures remain PROVISIONAL pending the independent calc audit. This
// module is additive — it does not yet replace the live engine paths; the
// stacked-tax computation + screen rewiring follow, gated by golden vectors +
// regression:check on every persona.
// ─────────────────────────────────────────────────────────────────────────────

// Current tax-year start year (2026/27). Deterministic — no Date() so snapshots
// stay stable. Bump when the active bundle year changes.
const TAX_YEAR_START = 2026

function birthYear(entity) {
  const dob = entity?.individual?.dob || entity?.dob || ''
  const m = /(\d{4})/.exec(String(dob))
  return m ? +m[1] : null
}

function ageAtTaxYear(entity) {
  // Prefer an explicit age field (personas carry `age`/`individual.age`); fall
  // back to dob-derived. calcAllIncome only reads dob — so personas with `age`
  // but no dob (persona-a/e) had their state pension mis-gated there. Reading
  // the explicit age makes the state-pension cutoff correct for those.
  const ind = entity?.individual || {}
  const explicit = +(entity?.age || ind.age || entity?.currentAge || ind.currentAge || 0)
  if (explicit > 0) return explicit
  const by = birthYear(entity)
  return by == null ? null : TAX_YEAR_START - by
}

/**
 * Canonical income decomposition.
 * @returns {{ nsnd:number, savings:number, dividends:number, total:number,
 *             reliefs:number, ani:number, parts:object }}
 */
export function taxableIncomeBreakdown(entity) {
  const inc = entity?.income || {}
  const ind = entity?.individual || {}

  // Salary aliases are the SAME salary in different schemas — MAX, never SUM
  // (the triple-count bug class; calcAllIncome was fixed 2026-06-02, the tax
  // path was not).
  const salary = Math.max(
    +(ind.gross_salary || 0),
    +(inc.salary || 0),
    +(inc.employment || 0),
    +(inc.directorSalary || 0),
  )

  // selfEmployed / selfEmploymentNet are alias schemas for the same trade
  // profit — MAX, never SUM (calcAllIncome pushes both as items and would
  // double-count a persona carrying both).
  const selfEmp = Math.max(+(inc.selfEmployed || 0), +(inc.selfEmploymentNet || 0))

  // Rental is taxed on NET profit. Prefer an explicit net figure; fall back to
  // the gross `rentalIncome`/`rental` keys (best available when no net is
  // supplied — matches calcAllIncome's coverage so we never UNDER-count rent,
  // the bug that returned £0 rental for persona-a's £19,200).
  const rentalNet = +(inc.rentalIncomeNet ?? inc.rentalNet ?? inc.rentalIncome ?? inc.rental ?? 0)

  // State pension is income ONLY once it is in payment (age >= start age).
  const age = ageAtTaxYear(entity)
  const spStart = +(inc.statePension?.startAge || ind.state_pension_start_age || 67)
  const statePension = (age != null && age >= spStart)
    ? +(inc.statePension?.annual || inc.statePension || 0)
    : 0

  const drawdown = +(entity?.drawdown || inc.pensionDrawdown || 0)
  const other = +(inc.other || 0) + +(inc.overseasIncome || 0)

  const nsnd = salary + selfEmp + rentalNet + statePension + drawdown + other

  // Savings interest. Prefer an explicit summary figure (interest/savings/
  // savingsInterest are aliases — MAX); fall back to interest computed from
  // nested bank accounts (balance × rate) only when no explicit figure exists,
  // so the two sources are never added together.
  const explicitSavings = Math.max(
    +(inc.interest || 0),
    +(inc.savings || 0),
    +(inc.savingsInterest || 0),
  )
  const bankInterest = (entity?.assets?.bank || []).reduce(
    (s, b) => s + ((+b.balance || 0) * (+b.interest_rate || 0)), 0,
  )
  const savings = explicitSavings > 0 ? explicitSavings : Math.round(bankInterest)

  // Dividends (aliased like salary), net of ISA-shielded dividend income.
  const isaShield = +(entity?.assets?.isa?.dividendIncome || 0)
  const dividends = Math.max(0, Math.max(+(inc.dividends || 0), +(inc.directorDividends || 0)) - isaShield)

  // Reliefs that reduce adjusted net income (gross-up handled by caller if needed).
  const reliefs = +(inc.pensionContribs || inc.pensionContributions || 0) + +(inc.giftAid || 0)

  const total = nsnd + savings + dividends
  const ani = Math.max(0, total - reliefs)

  return {
    nsnd, savings, dividends, total, reliefs, ani,
    parts: { salary, selfEmp, rentalNet, statePension, drawdown, other, savings, dividends, isaShield, age, spStart },
  }
}
