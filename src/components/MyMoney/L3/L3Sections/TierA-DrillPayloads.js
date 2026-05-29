// TierA-DrillPayloads.js — pure data builders that turn a single row of a
// Tier-A panel into a DrillableNumber → L4NumberPanel payload.
//
// Plan reference: founder feedback 2026-05-29 — "I could not see a drill
// down on any of the values. I want this option on all drill downs."
//
// Each builder returns the four fields L4NumberPanel consumes:
//   { formula, source, confidence, breakdown }
//
// `formula` — plain-English calculation ("Sum of all property rents…")
// `source`  — which engine selector / entity path produced it
// `confidence` — 'high' | 'medium' | 'low' based on data signals present
// `breakdown` — array of { label, value } for the L4 visual breakdown list
//
// All builders are schema-agnostic: they walk both FLAT (persona-a..g) and
// NESTED (mrT-*) shapes, mirroring _helpers.js conventions. fmt() lives at
// the JSX side; this module returns raw numbers + strings ready for display.

import { fmt } from '../../../../engine/fq-calculator.js'

const placeholder = (label) => [{ label, value: 'No detail recorded yet' }]

// Helper — format a percentage rate consistently across L5 drills.
const pct = (n, dp = 2) => `${(n * 100).toFixed(dp)}%`

// ── L5 payload builders ────────────────────────────────────────────────────
// Each turns a single nested entity item (a pension scheme, a property, a
// protection policy, a liability) into the L panel content shape:
//   { metric, formula, source, confidence, breakdown }
// Returned object is consumed by BreakdownList → DrillableNumber → next L.

export function pensionSchemeL5(p, parentSource, editable) {
  if (!p) return null
  const balance = +(p.value ?? p.balance_gbp ?? p.balance ?? 0) || 0
  const rows = []
  if (p.provider)             rows.push({ label: 'Provider',                value: p.provider })
  if (p.type)                 rows.push({ label: 'Scheme type',             value: String(p.type) })
  rows.push({                    label: 'Current value',                    value: fmt(balance) })
  if (p.cetv != null)         rows.push({ label: 'Cash-equivalent transfer value', value: fmt(+p.cetv) })
  if (p.charge != null)       rows.push({ label: p.chargeIsEstimate ? 'Charge (estimate)' : 'Annual charge', value: pct(+p.charge) })
  if (p.transferEligible != null) rows.push({ label: 'Transfer eligible',   value: p.transferEligible ? 'Yes' : 'No' })
  if (p.crystalised)          rows.push({ label: 'Crystallised',            value: fmt(+p.crystalised) })
  if (p.tfcTaken)             rows.push({ label: 'Tax-free cash taken',     value: fmt(+p.tfcTaken) })
  if (p.nominationDate)       rows.push({ label: 'Death-benefit nomination updated', value: String(p.nominationDate) })
  if (p.growth != null)       rows.push({ label: 'Assumed growth',          value: pct(+p.growth) })
  if (p.pso_incoming_pending) rows.push({ label: 'Pending pension-sharing order', value: fmt(+p.pso_incoming_pending) })
  return {
    metric: `Pension scheme · ${p.name || p.provider || 'Unnamed'}`,
    formula: 'Single-scheme balance plus optional metadata (provider charges, transfer eligibility, nomination date). Aggregated by pensionTotal at the panel level.',
    source: `${parentSource} — single row drilled into its full record.`,
    confidence: 'high',
    breakdown: rows.length > 0 ? rows : placeholder('Scheme detail'),
    editable: editable || undefined,
  }
}

export function propertyL5(prop, parentSource, parentLabel = 'Property', editable) {
  if (!prop) return null
  const rows = []
  if (prop.address) rows.push({ label: 'Address', value: prop.address })
  if (prop.value != null || prop.value_gbp != null) {
    rows.push({ label: 'Current value', value: fmt(+(prop.value ?? prop.value_gbp)) })
  }
  if (prop.beneficial_interest_this_individual != null) {
    rows.push({ label: 'Your beneficial share', value: pct(+prop.beneficial_interest_this_individual, 0) })
  }
  if (prop.ownership) rows.push({ label: 'Ownership', value: String(prop.ownership) })
  if (prop.isRental != null) rows.push({ label: 'Let to tenants', value: prop.isRental ? 'Yes' : 'No' })
  if (prop.rentalGrossAnnual != null) rows.push({ label: 'Gross rental (yr)', value: fmt(+prop.rentalGrossAnnual) })
  if (prop.rentalNetAnnual != null)   rows.push({ label: 'Net rental (yr)',  value: fmt(+prop.rentalNetAnnual) })
  if (prop.rental_income != null && prop.rentalGrossAnnual == null) {
    rows.push({ label: 'Rental income (yr)', value: fmt(+prop.rental_income) })
  }
  if (prop.purchaseDate)  rows.push({ label: 'Purchase date',  value: String(prop.purchaseDate) })
  if (prop.purchasePrice != null) {
    rows.push({ label: 'Purchase price', value: fmt(+prop.purchasePrice) })
    if (prop.value != null) {
      const gain = +prop.value - +prop.purchasePrice
      rows.push({ label: 'Paper gain',  value: fmt(gain) })
    }
  }
  if (prop.growth != null) rows.push({ label: 'Assumed growth (yr)', value: pct(+prop.growth) })
  if (prop.status) rows.push({ label: 'Status', value: String(prop.status) })
  return {
    metric: `${parentLabel} · ${prop.name || prop.address || 'Unnamed property'}`,
    formula: 'Single-property record. Gross rental sums to the panel total before S24 mortgage-interest restriction; net subtracts mortgage interest and allowable expenses.',
    source: `${parentSource} — single row drilled into its full record.`,
    confidence: 'high',
    breakdown: rows.length > 0 ? rows : placeholder('Property detail'),
    editable: editable || undefined,
  }
}

export function investmentHoldingL5(inv, parentSource, parentLabel = 'Holding', editable) {
  if (!inv) return null
  const rows = []
  if (inv.provider) rows.push({ label: 'Provider', value: inv.provider })
  if (inv.type)     rows.push({ label: 'Wrapper / type', value: String(inv.type) })
  if (inv.wrapper)  rows.push({ label: 'Wrapper', value: String(inv.wrapper) })
  rows.push({ label: 'Current value', value: fmt(+(inv.balance_gbp ?? inv.balance ?? inv.value ?? inv.estimated_value ?? 0)) })
  if (inv.purchase_date)  rows.push({ label: 'Purchase date',  value: String(inv.purchase_date) })
  if (inv.purchase_value != null) rows.push({ label: 'Purchase value', value: fmt(+inv.purchase_value) })
  if (inv.annual_dividend != null) rows.push({ label: 'Annual dividend', value: fmt(+inv.annual_dividend) })
  if (inv.yield != null) rows.push({ label: 'Yield', value: pct(+inv.yield) })
  if (inv.bpr_qualifying != null) rows.push({ label: 'BPR qualifying', value: inv.bpr_qualifying ? 'Yes' : 'No' })
  if (inv.verified_by_user) rows.push({ label: 'User-verified', value: 'Yes' })
  if (inv.last_valuation_date) rows.push({ label: 'Last valued', value: String(inv.last_valuation_date) })
  return {
    metric: `${parentLabel} · ${inv.name || inv.provider || 'Unnamed holding'}`,
    formula: 'Single-holding record. Sums to the wrapper bucket at panel level.',
    source: `${parentSource} — single row drilled into its full record.`,
    confidence: inv.verified_by_user ? 'high' : 'medium',
    breakdown: rows.length > 0 ? rows : placeholder('Holding detail'),
    editable: editable || undefined,
  }
}

export function protectionPolicyL5(policy, kind, parentSource) {
  if (!policy || !policy.exists) return null
  const rows = []
  rows.push({ label: 'Cover type', value: kind })
  if (policy.provider) rows.push({ label: 'Provider', value: policy.provider })
  if (policy.amount != null) rows.push({ label: 'Sum assured', value: fmt(+policy.amount) })
  if (policy.monthlyBenefit != null && +policy.monthlyBenefit > 0) {
    rows.push({ label: 'Monthly benefit', value: fmt(+policy.monthlyBenefit) })
  }
  if (policy.premium != null) rows.push({ label: 'Premium (mo)', value: fmt(+policy.premium) })
  if (policy.inTrust != null) rows.push({ label: 'Written into trust', value: policy.inTrust ? 'Yes' : 'No (in estate)' })
  if (policy.type) rows.push({ label: 'Term type', value: String(policy.type) })
  if (policy.expiryAge != null) rows.push({ label: 'Cover expires at age', value: String(policy.expiryAge) })
  return {
    metric: `Protection · ${kind}`,
    formula: 'Single-policy record. The sum-assured pays out on the insured event; premiums are monthly amounts the insurer collects.',
    source: parentSource,
    confidence: 'high',
    breakdown: rows.length > 0 ? rows : placeholder(kind),
  }
}

export function liabilityL5(loan, kind, parentSource) {
  if (!loan) return null
  const rows = []
  rows.push({ label: 'Loan type', value: kind })
  if (loan.name) rows.push({ label: 'Loan name', value: loan.name })
  if (loan.outstanding != null) rows.push({ label: 'Outstanding balance', value: fmt(+loan.outstanding) })
  if (loan.monthlyPayment != null) rows.push({ label: 'Monthly payment', value: fmt(+loan.monthlyPayment) })
  if (loan.rate != null) rows.push({ label: 'Rate', value: pct(+loan.rate) })
  if (loan.rateType) rows.push({ label: 'Rate type', value: String(loan.rateType) })
  if (loan.remainingYears != null) rows.push({ label: 'Years remaining', value: String(loan.remainingYears) })
  if (loan.fixedRateExpiry) rows.push({ label: 'Fixed-rate expiry', value: String(loan.fixedRateExpiry) })
  if (loan.secured != null) rows.push({ label: 'Secured', value: loan.secured ? 'Yes' : 'No' })
  if (loan.property) rows.push({ label: 'Secured against', value: String(loan.property) })
  return {
    metric: `Liability · ${loan.name || kind}`,
    formula: 'Single-loan record. Mortgage interest restriction (S24) is applied at the cashflow layer, not here.',
    source: parentSource,
    confidence: 'high',
    breakdown: rows.length > 0 ? rows : placeholder(kind),
  }
}


// ── INCOME PAYLOADS ─────────────────────────────────────────────────────────

export function incomePayload(entity, sourceKey, total) {
  const ind = entity?.individual || {}
  const inc = entity?.income || {}
  const a   = entity?.assets   || {}

  switch (sourceKey) {
    case 'employment': {
      const fromGross  = +ind.gross_salary || 0
      const fromEmpl   = +inc.employment   || 0
      const fromSalary = +inc.salary       || 0
      const sources = [
        fromGross  > 0 && { label: 'individual.gross_salary', value: fmt(fromGross) },
        fromEmpl   > 0 && { label: 'income.employment',       value: fmt(fromEmpl) },
        fromSalary > 0 && { label: 'income.salary',           value: fmt(fromSalary) },
      ].filter(Boolean)
      return {
        formula: 'MAX of equivalent salary fields across schemas (not SUM — they describe the same underlying figure).',
        source: 'Salary read from any of: individual.gross_salary, income.employment, income.salary',
        confidence: sources.length > 0 ? 'high' : 'low',
        breakdown: sources.length > 0 ? sources : placeholder('Employment income'),
      }
    }

    case 'selfEmployed': {
      const v = +inc.selfEmployed || 0
      return {
        formula: 'Self-employment net profit before income tax + Class 4 NI.',
        source: 'income.selfEmployed (annual)',
        confidence: v > 0 ? 'high' : 'low',
        breakdown: v > 0
          ? [{ label: 'Annual net profit', value: fmt(v) }]
          : placeholder('Self-employed profit'),
      }
    }

    case 'dividends': {
      const v = +inc.dividends || 0
      // Iterate the REAL array with index so the L5 edit path targets the
      // correct assets.investments[i] record (not a filtered-array index).
      const fromInv = Array.isArray(a.investments)
        ? a.investments
            .map((x, idx) => ({ x, idx }))
            .filter(({ x }) => x?.annual_dividend > 0)
            .map(({ x, idx }) => ({
              label: x.name || x.type || 'Holding',
              value: fmt(+x.annual_dividend || 0),
              drill: investmentHoldingL5(x, 'assets.investments[]', 'Dividend-paying holding', {
                path: `assets.investments[${idx}].annual_dividend`,
                label: `${x.name || 'Holding'} annual dividend`,
                currentValue: +x.annual_dividend || 0,
                unit: '£',
              }),
            }))
        : []
      return {
        formula: 'Sum of dividend distributions across all holdings (UK + international).',
        source: fromInv.length > 0
          ? 'Per-holding annual_dividend on assets.investments[] (preferred) + income.dividends fallback'
          : 'income.dividends (annualised total)',
        confidence: fromInv.length > 0 ? 'high' : (v > 0 ? 'medium' : 'low'),
        breakdown: fromInv.length > 0
          ? fromInv
          : (v > 0
              ? [{ label: 'Annual dividends', value: fmt(v) }]
              : placeholder('Dividend income')),
      }
    }

    case 'rental': {
      // Rental: aliases — show the source path that was non-zero
      const rA = +inc.rental || 0
      const rB = +inc.rentalIncome || 0
      // Walk assets.property[] for let units. Iterate the REAL array with
      // index so the L5 edit path targets assets.property[i] correctly.
      // Each row carries a `drill` payload so tapping the gross-rent value
      // pushes the per-property L5 (which is itself editable).
      const fromProperties = (Array.isArray(a.property) ? a.property : [])
        .map((p, idx) => ({ p, idx }))
        .filter(({ p }) => p?.isRental || p?.rentalGrossAnnual > 0 || p?.rental_income > 0 || p?.rentalIncome > 0)
        .map(({ p, idx }) => {
          const grossField = p.rentalGrossAnnual != null ? 'rentalGrossAnnual'
                           : p.rental_income != null ? 'rental_income'
                           : 'rentalIncome'
          const grossVal = +(p.rentalGrossAnnual ?? p.rental_income ?? p.rentalIncome ?? 0)
          return {
            label: p.address || p.name || 'Let property',
            value: fmt(grossVal),
            drill: propertyL5(p, 'assets.property[]', 'Rental property', {
              path: `assets.property[${idx}].${grossField}`,
              label: `${p.address || p.name || 'Property'} — gross annual rent`,
              currentValue: grossVal,
              unit: '£',
            }),
          }
        })
      return {
        formula: 'Sum of gross rental income across all let properties, before allowable expenses (S24 mortgage-interest restriction applied separately).',
        source: fromProperties.length > 0
          ? 'Per-property rentalGrossAnnual on assets.property[]'
          : `income.${rA >= rB ? 'rental' : 'rentalIncome'} (alias-deduped via MAX)`,
        confidence: fromProperties.length > 0 ? 'high' : (total > 0 ? 'medium' : 'low'),
        breakdown: fromProperties.length > 0
          ? fromProperties
          : (total > 0
              ? [{ label: 'Annual rental income', value: fmt(total) }]
              : placeholder('Rental income')),
      }
    }

    case 'overseasIncome': {
      const v = +inc.overseasIncome || 0
      return {
        formula: 'Sum of overseas employment + investment income, pre-remittance.',
        source: 'income.overseasIncome',
        confidence: v > 0 ? 'medium' : 'low',
        breakdown: v > 0
          ? [{ label: 'Overseas total', value: fmt(v) }]
          : placeholder('Overseas income'),
      }
    }

    case 'statePension': {
      return {
        formula: 'Computed via the State-pension panel — accrued years × full amount / qualifying years.',
        source: 'income.statePension.annual OR derived from individual.state_pension_accrued_years',
        confidence: 'high',
        breakdown: [
          { label: 'Annual entitlement', value: fmt(total) },
          { label: 'Detail', value: 'See State-pension panel for derivation' },
        ],
      }
    }

    case 'drawdown': {
      const v = +entity?.drawdown || 0
      return {
        formula: 'Annualised pension drawdown across all in-flight schedules.',
        source: 'entity.drawdown (current-year schedule)',
        confidence: v > 0 ? 'high' : 'low',
        breakdown: v > 0
          ? [{ label: 'Annual drawdown', value: fmt(v) }]
          : placeholder('Drawdown'),
      }
    }

    case 'other': {
      const v = +inc.other || 0
      return {
        formula: 'Catch-all bucket — trust distributions, occasional income, unclassified.',
        source: 'income.other',
        confidence: 'low',
        breakdown: v > 0
          ? [{ label: 'Other income', value: fmt(v) }]
          : placeholder('Other income'),
      }
    }

    default:
      return {
        formula: 'Source-specific formula not yet wired for this category.',
        source: `income.${sourceKey}`,
        confidence: 'low',
        breakdown: placeholder(sourceKey),
      }
  }
}

// Total-income hero payload — describes the headline number itself.
export function incomeTotalPayload(entity, total, sourceCount) {
  return {
    formula: 'Sum of all reported income sources for the last 12 months (employment + self-employment + dividends + rental + overseas + state pension + drawdown + other).',
    source: 'engine.annualIncome(entity) — handles FLAT and NESTED schemas via MAX-of-aliases for salary and rental to avoid the F1 double-count.',
    confidence: sourceCount >= 3 ? 'high' : sourceCount >= 1 ? 'medium' : 'low',
    breakdown: [
      { label: 'Number of sources',    value: String(sourceCount) },
      { label: 'Annual total',         value: fmt(total) },
      { label: 'Note',                 value: 'Tap any row below to see per-source detail.' },
    ],
  }
}

// ── WRAPPERS PAYLOADS ───────────────────────────────────────────────────────

export function wrapperPayload(entity, bucketKey, total) {
  const a = entity?.assets || {}

  switch (bucketKey) {
    case 'isa': {
      const fromFlat   = +(a.isa?.value || 0)
      const breakdown = []
      if (fromFlat > 0) breakdown.push({ label: 'Legacy assets.isa.value', value: fmt(fromFlat) })
      // Real-index iteration so the L5 edit path targets assets.investments[i].
      ;(Array.isArray(a.investments) ? a.investments : [])
        .map((x, idx) => ({ x, idx }))
        .filter(({ x }) => /isa/i.test(x?.type || ''))
        .forEach(({ x: inv, idx }) => {
          const val = +(inv.balance_gbp ?? inv.balance ?? inv.value ?? 0)
          breakdown.push({
            label: inv.name || inv.provider || (inv.type || 'ISA holding'),
            value: fmt(val),
            drill: investmentHoldingL5(inv, 'assets.investments[] (ISA)', 'ISA holding', {
              path: `assets.investments[${idx}].value`,
              label: `${inv.name || inv.provider || 'ISA holding'} value`,
              currentValue: val,
              unit: '£',
            }),
          })
        })
      return {
        formula: 'Sum of all ISA-typed holdings on assets.investments[] plus legacy assets.isa.value.',
        source: 'engine.isaTotal(entity) — preferred reader; walks both schemas.',
        confidence: breakdown.length > 0 ? 'high' : 'low',
        breakdown: breakdown.length > 0 ? breakdown : placeholder('ISA detail'),
      }
    }

    case 'pension': {
      const sippFromArray = Array.isArray(a.sipp?.pensions)
        ? a.sipp.pensions
        : []
      const standalone = Array.isArray(a.pensions) ? a.pensions : []
      const breakdown = []
      // Real-index iteration (forEach keeps the true array index even when
      // DB rows are skipped) so the L5 edit path targets the right record.
      sippFromArray.forEach((p, idx) => {
        // Skip DB with zero value (CETV-informational only)
        if ((p.type === 'occupational-DB' || p.type === 'Occupational DB') && (p.value == null || +p.value === 0)) return
        const val = +(p.value ?? p.balance_gbp ?? p.balance ?? 0)
        breakdown.push({
          label: p.name || p.provider || (p.type || 'SIPP holding'),
          value: fmt(val),
          drill: pensionSchemeL5(p, 'assets.sipp.pensions[]', {
            path: `assets.sipp.pensions[${idx}].value`,
            label: `${p.name || p.provider || 'Pension'} value`,
            currentValue: val,
            unit: '£',
          }),
        })
      })
      standalone.forEach((p, idx) => {
        if (p.type === 'occupational-DB' && p.cetv == null) return
        const cetvField = p.cetv != null ? 'cetv' : p.balance_gbp != null ? 'balance_gbp' : p.balance != null ? 'balance' : 'value'
        const val = +(p.cetv ?? p.balance_gbp ?? p.balance ?? p.value ?? 0)
        breakdown.push({
          label: p.name || p.provider || (p.type || 'Pension'),
          value: fmt(val),
          drill: pensionSchemeL5(p, 'assets.pensions[]', {
            path: `assets.pensions[${idx}].${cetvField}`,
            label: `${p.name || p.provider || 'Pension'} value`,
            currentValue: val,
            unit: '£',
          }),
        })
      })
      // Legacy flat: only show if we found nothing nested
      if (breakdown.length === 0 && a.sipp?.total > 0) {
        breakdown.push({ label: 'Legacy assets.sipp.total', value: fmt(+a.sipp.total) })
      }
      return {
        formula: 'SIPP balance per holding + DB pension CETVs + standalone pensions. Occupational-DB rows with no CETV are skipped (FP-4 rule).',
        source: 'engine.pensionTotal(entity) — walks sipp.pensions[] + pensions[] + falls back to flat sipp.total when nothing nested.',
        confidence: breakdown.length > 0 ? 'high' : 'low',
        breakdown: breakdown.length > 0 ? breakdown : placeholder('Pension detail'),
      }
    }

    case 'gia': {
      const fromFlat   = +(a.portfolio?.value || 0)
      const giaRows = (Array.isArray(a.investments) ? a.investments : [])
        .map((x, idx) => ({ x, idx }))
        .filter(({ x }) => {
          const t = String(x?.type || '').toLowerCase()
          return t === 'gia' || t.includes('general-investment')
        })
      const breakdown = []
      if (fromFlat > 0 && giaRows.length === 0) {
        breakdown.push({ label: 'Legacy assets.portfolio.value', value: fmt(fromFlat) })
      }
      giaRows.forEach(({ x: inv, idx }) => {
        const val = +(inv.balance_gbp ?? inv.balance ?? inv.value ?? 0)
        breakdown.push({
          label: inv.name || inv.provider || 'GIA holding',
          value: fmt(val),
          drill: investmentHoldingL5(inv, 'assets.investments[] (GIA)', 'GIA holding', {
            path: `assets.investments[${idx}].value`,
            label: `${inv.name || inv.provider || 'GIA holding'} value`,
            currentValue: val,
            unit: '£',
          }),
        })
      })
      return {
        formula: 'Sum of GIA-typed holdings on assets.investments[] plus legacy assets.portfolio.value (only used when no nested array present).',
        source: 'engine.giaTotal(entity) preferred; per-row breakdown when investments[] available.',
        confidence: breakdown.length > 0 ? 'high' : 'low',
        breakdown: breakdown.length > 0 ? breakdown : placeholder('GIA detail'),
      }
    }

    case 'taxAdvAlt': {
      const breakdown = (Array.isArray(a.investments) ? a.investments : [])
        .map((x, idx) => ({ x, idx }))
        .filter(({ x }) => {
          const t = String(x?.type || '').toLowerCase()
          return t === 'eis' || t === 'seis' || t === 'vct' || t.includes('bond-')
        })
        .map(({ x: inv, idx }) => {
          const val = +(inv.balance_gbp ?? inv.balance ?? inv.value ?? 0)
          return {
            label: `${inv.type || 'Holding'} — ${inv.name || inv.provider || 'Unnamed'}`,
            value: fmt(val),
            drill: investmentHoldingL5(inv, 'assets.investments[] (tax-advantaged alt.)', 'Tax-advantaged holding', {
              path: `assets.investments[${idx}].value`,
              label: `${inv.name || inv.provider || inv.type || 'Holding'} value`,
              currentValue: val,
              unit: '£',
            }),
          }
        })
      return {
        formula: 'Sum of EIS + SEIS + VCT + onshore/offshore bond holdings on assets.investments[].',
        source: 'Per-holding walk on assets.investments[] keyed by type.',
        confidence: breakdown.length > 0 ? 'high' : 'low',
        breakdown: breakdown.length > 0 ? breakdown : placeholder('Tax-advantaged alternatives'),
      }
    }

    default:
      return {
        formula: 'Bucket-specific formula not yet wired.',
        source: `bucket key: ${bucketKey}`,
        confidence: 'low',
        breakdown: placeholder(bucketKey),
      }
  }
}

export function wrapperTotalPayload(entity, total, bucketCount) {
  return {
    formula: 'Sum of all wrapper buckets: ISA family + Pension (SIPP/SSAS) + General investment + Tax-advantaged alt.',
    source: 'engine.isaTotal + pensionTotal + giaTotal + walked investments[] for EIS/SEIS/VCT/Bonds.',
    confidence: bucketCount >= 2 ? 'high' : bucketCount >= 1 ? 'medium' : 'low',
    breakdown: [
      { label: 'Buckets in use', value: String(bucketCount) },
      { label: 'Total wrapped', value: fmt(total) },
      { label: 'Note', value: 'Tap any wrapper below to see per-holding detail.' },
    ],
  }
}

// ── STATE-PENSION PAYLOADS ──────────────────────────────────────────────────

export function statePensionEntitlementPayload(snap) {
  // snap = result of buildStatePensionSnapshot
  const accrual = snap.accruedYears
  const needed  = snap.qualifyingYearsNeeded
  const full    = snap.fullEntitlement

  return {
    formula: needed > 0
      ? `(accrued years ÷ qualifying years needed) × full amount = (${accrual} ÷ ${needed}) × ${fmt(full)}`
      : 'accrued years × proportion of full amount',
    source: 'income.statePension.annual when explicitly set; otherwise derived from individual.state_pension_accrued_years + TAX bundle (UK-2026.1).',
    confidence: snap.accruedYears > 0 ? 'high' : (snap.entitlementNow > 0 ? 'medium' : 'low'),
    breakdown: [
      { label: 'Accrued qualifying years', value: String(accrual) },
      { label: 'Needed for full amount',    value: String(needed) },
      { label: 'Full new State Pension',    value: fmt(full) },
      { label: 'Current entitlement',       value: fmt(snap.entitlementNow) },
      { label: 'State Pension age',         value: String(snap.spa) },
      { label: 'Years to SPA',              value: String(snap.yearsToSpa) },
    ],
  }
}

export function statePensionGapPayload(snap) {
  return {
    formula: `Gap = full amount − current entitlement = ${fmt(snap.fullEntitlement)} − ${fmt(snap.entitlementNow)}. Years missing = qualifying needed − accrued = ${snap.qualifyingYearsNeeded} − ${snap.accruedYears}, capped at years remaining to SPA (${snap.yearsToSpa}).`,
    source: 'TAX.statePensionFull − statePensionAnnual(entity); years from TAX.statePensionQualYears − accrued.',
    confidence: 'high',
    breakdown: [
      { label: 'Gap per year',          value: fmt(snap.gapToFull) },
      { label: 'Missing years (total)', value: String(snap.missingYears) },
      { label: 'Fillable by SPA',       value: String(snap.gapFillableBySpa) },
      { label: 'On-track for full?',    value: snap.onTrackForFull ? 'Yes' : 'No' },
    ],
  }
}
