// ─────────────────────────────────────────────────────────────────────────────
// income-readers.js — canonical readers for two concepts that were each read
// from several disagreeing fields (the meta-finding: one concept, many paths).
//
// PURE LEAF MODULE — imports nothing from the engine, so any module can import
// it without circular-dependency risk. Both functions are total (null-safe) and
// deterministic (no Date()).
//
//   pensionContributionsThisYear(entity)  — fixes F-004 (silent-£0 AA). Four
//     consumers previously read four different fields: canonical-metrics read
//     entity.pensionContributions; tax-estate-engine read
//     entity.pension.contributionsThisYear; taxable-income read
//     entity.income.pensionContributions; _contributionCoI read the root again.
//     They disagreed whenever a persona populated only one shape. This is the
//     ONE reader they now all call.
//
//   partnerGrossIncome(entity)            — fixes F-001 (partner income invisible
//     to the engine → household shows a false deficit). Returns the partner's
//     GROSS income only. Partner NET (after the partner's INDEPENDENT tax — UK
//     spouses are taxed separately, so this is NEVER added to the individual's
//     taxable income) is computed by the caller in fq-calculator.cashflowFlow.
// ─────────────────────────────────────────────────────────────────────────────

function num(v) { const n = +v; return Number.isFinite(n) ? n : 0 }

/**
 * Canonical current-tax-year pension contribution (gross, all pots) for Annual
 * Allowance / tax-relief purposes. Scalar alias fields are the SAME figure in
 * different schemas → take MAX. Only if no scalar is present do we derive from
 * per-pot contribution fields (summed). Never adds a scalar to per-pot (that
 * would double-count).
 * @param {object} entity
 * @returns {number} gross annual contribution this tax year
 */
export function pensionContributionsThisYear(entity) {
  if (!entity || typeof entity !== 'object') return 0
  const inc = entity.income || {}
  // Scalar aliases — same number, different schema. MAX, never SUM.
  const scalar = Math.max(
    num(entity.pensionContributions),
    num(entity.pension && entity.pension.contributionsThisYear),
    num(inc.pensionContributions),
    num(inc.pensionContribs),
  )
  if (scalar > 0) return Math.round(scalar)

  // No scalar declared → derive from per-pot contribution fields.
  const a = entity.assets || {}
  let perPot = 0
  // DB/occupational pots carrying explicit annual or monthly split.
  for (const p of (Array.isArray(a.pensions) ? a.pensions : [])) {
    perPot += num(p.annual_contribution)
    perPot += (num(p.contribution_monthly_personal) + num(p.contribution_monthly_employer)) * 12
  }
  // DC accumulation pots under assets.sipp.pensions[].
  const sippPots = (a.sipp && Array.isArray(a.sipp.pensions)) ? a.sipp.pensions : []
  for (const p of sippPots) {
    perPot += num(p.monthlyContribution) * 12
    perPot += (num(p.contribution_monthly_personal) + num(p.contribution_monthly_employer)) * 12
    perPot += num(p.annual_contribution)
  }
  return Math.round(perPot)
}

/**
 * Canonical partner/spouse GROSS income for HOUSEHOLD cashflow only. Reads every
 * known shape and sums the distinct components (employment + self-employment +
 * state pension in payment), MAX-ing aliases of the same component. Returns 0
 * for a single person, so callers that add this are no-ops for non-couples.
 *
 * IMPORTANT: this is for the household spendable-cashflow view. It must NOT be
 * added to the individual's taxable income — partners are taxed independently.
 * @param {object} entity
 * @param {number} [partnerAge] - if known, gates partner state pension into payment
 * @returns {number} partner gross annual income
 */
export function partnerGrossIncome(entity, partnerAge) {
  if (!entity || typeof entity !== 'object') return 0
  const inc = entity.income || {}
  const partner = entity.partner || {}
  const spouse = entity.spouse || {}

  // Partner employment gross — aliases of the same figure across shapes → MAX.
  const employment = Math.max(
    num(partner.income && partner.income.annualGross),  // W5-5a capture write
    num(partner.income && partner.income.employment),
    num(inc.employmentPartner),                          // persona-family shape
    num(inc.partnerEmployment),
    num(spouse.income),                                  // marriage-allowance shape (gross proxy)
    num(spouse.gross_salary),
  )
  const selfEmp = Math.max(
    num(partner.income && partner.income.selfEmployed),
    num(inc.selfEmploymentPartner),
  )
  // Partner state pension counts only once in payment. We rarely know the
  // partner's age; include it only when an explicit partner age is supplied AND
  // reaches the stated start age (default 67). Conservative: when age unknown,
  // do NOT assume it is in payment (avoids inflating household income).
  const spPartner = inc.statePensionPartner || (partner.income && partner.income.statePension) || null
  let statePension = 0
  if (spPartner) {
    const start = num(spPartner.startAge) || 67
    if (partnerAge != null && num(partnerAge) >= start) {
      statePension = num(spPartner.annual) || num(spPartner)
    }
  }
  return Math.round(employment + selfEmp + statePension)
}
