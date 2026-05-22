// ─────────────────────────────────────────────────────────────────────────────
// ASK SONU — TAX-YEAR STATE
//
// Builds a flat object describing the user's IN-FLIGHT tax-year position:
// what's been used, what's remaining, what deadlines are pending.
//
// Reuses the existing canonical engine functions — does NOT duplicate logic:
//   - allowanceTracker(entity, bundle) → ISA, PSA, CGT, dividend, PA
//   - TAX constants from fq-calculator
//   - daysToTaxYearEnd, daysToSippIht, ageAt from lenses/_base.js
//
// The returned object is passed through the Ask Sonu pipeline so every
// recommendation can be allowance-aware.
// ─────────────────────────────────────────────────────────────────────────────

import { allowanceTracker, TAX } from '../fq-calculator.js'
import { daysToTaxYearEnd, daysToSippIht, ageAt } from '../../lenses/_base.js'

function num(v) {
  if (v == null) return 0
  if (typeof v === 'number') return v
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

function currentTaxYearLabel(asOfDate = new Date()) {
  const y = asOfDate.getFullYear()
  // UK tax year starts 6 April
  const beforeApril = asOfDate.getMonth() < 3 || (asOfDate.getMonth() === 3 && asOfDate.getDate() < 6)
  const startYear = beforeApril ? y - 1 : y
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`
}

/**
 * Build the tax-year state object for a given entity.
 *
 * @param {object} entity   The user's persona/entity
 * @param {Date}   [asOfDate=now]
 * @returns {object} flat state object — see README for fields
 */
export function buildTaxYearState(entity, asOfDate = new Date()) {
  if (!entity) return null

  // Allowance tracker — canonical engine function, do not duplicate
  let tracker = {}
  try {
    tracker = allowanceTracker(entity, null) || {}
  } catch {
    tracker = {}
  }

  // Pension AA — tracker doesn't return this, compute from entity
  const pensionContribs = num(entity.pensionContributions)
                       || num(entity.pensionContribAnnual)
                       || num(entity.assets?.pensionContributions)
                       || 0
  const aaLimit = TAX.pensionAA || 60000
  // Tapered AA: reduces by £1 for every £2 of adjusted income above £260k,
  // floor at £10k. Approximate from gross income for the demo.
  const grossIncome = num(entity.income?.annual) || num(entity.income)
  let aaEffective = aaLimit
  let aaTapered = false
  if (grossIncome > 260000) {
    const reduction = Math.min((grossIncome - 260000) / 2, aaLimit - 10000)
    aaEffective = Math.max(10000, aaLimit - reduction)
    aaTapered = true
  }
  const aa = {
    limit: aaLimit,
    effective: aaEffective,
    used: Math.round(pensionContribs),
    remaining: Math.max(0, aaEffective - pensionContribs),
    tapered: aaTapered,
    pctUsed: Math.round((pensionContribs / aaEffective) * 100),
  }

  // MPAA — once triggered, only £10k AA. Look for marker field.
  const mpaaTriggered = !!entity.mpaa_triggered || !!entity.mpaaTriggered
  const mpaaRemaining = mpaaTriggered ? Math.max(0, 10000 - pensionContribs) : null

  // Gifts in 7-year IHT window — sum dated gifts
  const giftsInWindow = num(entity.gifts_current_tax_year)
                     + (Array.isArray(entity.gifts_history)
                        ? entity.gifts_history.reduce((s, g) => {
                            const giftDate = g.date ? new Date(g.date) : null
                            if (!giftDate) return s
                            const yrs = (asOfDate - giftDate) / (1000 * 60 * 60 * 24 * 365.25)
                            return yrs <= 7 ? s + num(g.amount) : s
                          }, 0)
                        : 0)

  // Marriage allowance — transferable £1,260 of PA from lower to higher earner
  const marriageAllowanceUsed = !!entity.marriage_allowance_transferred || !!entity.marriageAllowanceUsed

  // Days to deadlines
  const daysTaxYearEnd = daysToTaxYearEnd(asOfDate)
  const daysSippIht = daysToSippIht(asOfDate)

  // Age + dependents
  const age = ageAt(entity, asOfDate)
  const spa = 66  // State Pension Age (current default; check rules bundle for exact)
  const yearsToSpa = Math.max(0, spa - age)

  // Carry-forward of unused pension AA — last 3 years
  // Demo: derive from entity.pension_carry_forward_unused if set
  const carryForwardUnused = num(entity.pension_carry_forward_unused)

  return {
    // Allowances — what's USED and REMAINING this tax year
    isa:                tracker.isa      || { limit: 20000, used: 0, remaining: 20000, pctUsed: 0 },
    psa:                tracker.psa      || { limit: 1000,  used: 0, remaining: 1000,  pctUsed: 0 },
    cgt:                tracker.cgt      || { limit: 3000,  used: 0, remaining: 3000,  pctUsed: 0 },
    dividend:           tracker.dividend || { limit: 500,   used: 0, remaining: 500,   pctUsed: 0 },
    pa:                 tracker.pa       || { limit: 12570, effective: 12570, tapered: false, pctUsed: 0 },
    pension_aa:         aa,
    mpaa_triggered:     mpaaTriggered,
    mpaa_remaining:     mpaaRemaining,
    pension_carry_forward_unused: carryForwardUnused,

    // 7-year IHT clock
    gifts_in_7yr_window: Math.round(giftsInWindow),
    nrb_remaining:       Math.max(0, 325000 - giftsInWindow),

    // Marriage allowance
    marriage_allowance_used: marriageAllowanceUsed,
    marriage_allowance_available: !marriageAllowanceUsed && grossIncome < 50270,

    // Deadlines
    tax_year_label:           currentTaxYearLabel(asOfDate),
    days_to_tax_year_end:     daysTaxYearEnd,
    days_to_sipp_iht:         daysSippIht,
    sipp_iht_hit_2027:        daysSippIht <= 0,

    // Age-linked
    age,
    state_pension_age:        spa,
    years_to_state_pension:   yearsToSpa,
    can_access_pension:       age >= 55,

    // Utilization summary
    overall_pct_used:         tracker.utilization ?? 0,
  }
}

/**
 * One-line summary for the LLM prompt — emit only non-zero / interesting lines.
 */
export function summariseTaxYearState(state) {
  if (!state) return ''
  const lines = []
  lines.push(`Tax year: ${state.tax_year_label} (${state.days_to_tax_year_end} days left)`)

  if (state.isa)      lines.push(`ISA allowance: £${state.isa.used.toLocaleString()} used of £${state.isa.limit.toLocaleString()} — £${state.isa.remaining.toLocaleString()} remaining`)
  if (state.pension_aa) {
    const taperNote = state.pension_aa.tapered ? ` (TAPERED to £${state.pension_aa.effective.toLocaleString()})` : ''
    lines.push(`Pension AA: £${state.pension_aa.used.toLocaleString()} used of £${state.pension_aa.effective.toLocaleString()}${taperNote} — £${state.pension_aa.remaining.toLocaleString()} remaining`)
  }
  if (state.mpaa_triggered) lines.push(`⚠ MPAA TRIGGERED — only £${(state.mpaa_remaining || 0).toLocaleString()} pension contribution allowed this year`)
  if (state.psa && state.psa.limit > 0) lines.push(`PSA (savings interest): £${state.psa.remaining.toLocaleString()} remaining`)
  if (state.cgt) lines.push(`CGT annual exempt: £${state.cgt.remaining.toLocaleString()} remaining`)
  if (state.dividend) lines.push(`Dividend allowance: £${state.dividend.remaining.toLocaleString()} remaining`)
  if (state.pa && state.pa.tapered) lines.push(`Personal allowance: TAPERED (effective £${state.pa.effective.toLocaleString()} not £${state.pa.limit.toLocaleString()})`)
  if (state.marriage_allowance_available) lines.push('Marriage Allowance: AVAILABLE (not yet claimed)')
  if (state.gifts_in_7yr_window > 0) lines.push(`Gifts in 7-year IHT window: £${state.gifts_in_7yr_window.toLocaleString()}`)
  if (state.days_to_sipp_iht > 0 && state.days_to_sipp_iht < 730) {
    lines.push(`⏰ SIPP-IHT deadline: ${state.days_to_sipp_iht} days until 6 April 2027`)
  }
  if (state.can_access_pension === false) lines.push(`Pension access: NOT YET — needs age 55 (currently ${state.age})`)

  return lines.join('\n  · ')
}
