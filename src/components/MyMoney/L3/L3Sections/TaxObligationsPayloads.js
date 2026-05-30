// TaxObligationsPayloads.js — pure payload builders for the Tax-obligations L3 panel.
//
// Mirrors the shape expected by DrillableNumber → L4NumberPanel:
//   { formula, source, confidence, breakdown, editable? }
//
// No React. No hardcoded tax rates. All values come from engine-selector output
// passed in as parameters.

import { fmt } from '../../../../engine/fq-calculator.js'

const placeholder = (label) => [{ label, value: 'No detail recorded yet' }]
const pct = (n, dp = 1) => `${(n * 100).toFixed(dp)}%`

// ── Tax total hero payload ────────────────────────────────────────────────────

/**
 * Hero payload — total income tax + NI + dividend tax.
 * @param {object} entity
 * @param {object} detail   — incomeTaxDetail output
 * @param {object} nics     — nicsDetail output
 * @param {object} divd     — dividendTaxDetail output
 */
export function taxTotalPayload(entity, detail, nics, divd) {
  const incomeTax   = detail?.total_tax  ?? 0
  const nicTotal    = nics?.total_nic    ?? 0
  const dividendTax = divd?.tax_paid     ?? 0
  const grandTotal  = incomeTax + nicTotal + dividendTax

  const breakdown = [
    { label: 'Income tax',         value: fmt(incomeTax)   },
    { label: 'National Insurance', value: fmt(nicTotal)    },
  ]
  if (dividendTax > 0) {
    breakdown.push({ label: 'Dividend tax', value: fmt(dividendTax) })
  }
  breakdown.push({ label: 'Grand total', value: fmt(grandTotal) })
  if (detail?.effective_rate != null) {
    breakdown.push({ label: 'Effective rate on gross income', value: pct(detail.effective_rate) })
  }

  const salary = entity?.income?.salary || entity?.individual?.gross_salary || 0
  const editable = salary > 0
    ? { path: 'income.salary', label: 'Annual salary', currentValue: salary, unit: '£' }
    : undefined

  return {
    formula: 'Sum of income tax + National Insurance contributions + dividend tax for the tax year.',
    source: 'incomeTaxDetail(entity) + nicsDetail(entity) + dividendTaxDetail(entity)',
    confidence: detail?.confidence || 'medium',
    breakdown,
    editable,
  }
}

// ── Income tax payload ─────────────────────────────────────────────────────────

/**
 * Payload for the income-tax row. Breakdown shows each tax band.
 * @param {object} entity
 * @param {object} detail — incomeTaxDetail output
 */
export function incomeTaxPayload(entity, detail) {
  const bands = Array.isArray(detail?.bands) ? detail.bands : []
  const gross = detail?.gross_income ?? 0
  const pa    = detail?.personal_allowance?.used ?? detail?.personal_allowance?.available ?? 0

  const breakdown = []

  if (gross > 0) {
    breakdown.push({ label: 'Gross income', value: fmt(gross) })
  }
  if (pa > 0) {
    breakdown.push({ label: 'Personal allowance used', value: fmt(pa) })
  }

  bands.forEach(band => {
    if (band.tax > 0) {
      // Use band.label if present; fall back to rate description. Never expose
      // raw acronyms like 'UEL' or 'PA' — the rule is plain-English label only.
      const bandLabel = band.label || `Tax band (${pct(band.rate, 0)} rate)`
      breakdown.push({ label: bandLabel, value: fmt(band.tax) })
    }
  })

  if (breakdown.length === 0) {
    breakdown.push(...placeholder('Income tax bands'))
  }

  if (detail?.total_tax != null) {
    breakdown.push({ label: 'Total income tax', value: fmt(detail.total_tax) })
  }

  const salary = entity?.income?.salary || entity?.individual?.gross_salary || 0
  const editable = salary > 0
    ? { path: 'income.salary', label: 'Annual salary', currentValue: salary, unit: '£' }
    : undefined

  return {
    formula: 'Income tax calculated band-by-band after deducting personal allowance. Each band applies its rate to the slice of taxable income that falls within it.',
    source: 'incomeTaxDetail(entity) — bands array with per-band tax amounts.',
    confidence: detail?.confidence || 'medium',
    breakdown,
    editable,
  }
}

// ── National Insurance payload ────────────────────────────────────────────────

/**
 * Payload for the NIC row. Breakdown shows Class 1 + Class 4 split.
 * @param {object} entity
 * @param {object} nics — nicsDetail output
 */
export function nicsPayload(entity, nics) {
  const c1  = nics?.class1     ?? 0
  const c4  = nics?.class4     ?? 0
  const tot = nics?.total_nic  ?? 0

  const breakdown = []
  if (c1 > 0) breakdown.push({ label: 'Employee contributions (salary)', value: fmt(c1) })
  if (c4 > 0) breakdown.push({ label: 'Self-employment contributions',   value: fmt(c4) })
  if (tot > 0) breakdown.push({ label: 'Total National Insurance',       value: fmt(tot) })
  if (breakdown.length === 0) breakdown.push(...placeholder('National Insurance'))

  const salary = entity?.income?.salary || entity?.individual?.gross_salary || 0
  const editable = salary > 0
    ? { path: 'income.salary', label: 'Annual salary', currentValue: salary, unit: '£' }
    : undefined

  return {
    formula: 'Employee Class 1 contributions on salary (between primary threshold and upper earnings limit) plus Class 4 on self-employment profits.',
    source: 'nicsDetail(entity) — class1, class4, total_nic.',
    confidence: nics?.confidence || 'medium',
    breakdown,
    editable,
  }
}

// ── Dividend tax payload ──────────────────────────────────────────────────────

/**
 * Payload for the dividend-tax row.
 * @param {object} entity
 * @param {object} divd — dividendTaxDetail output
 */
export function dividendTaxPayload(entity, divd) {
  const total    = divd?.total_dividend  ?? 0
  const shielded = divd?.isa_shielded    ?? 0
  const exposed  = divd?.gia_exposed     ?? 0
  const taxPaid  = divd?.tax_paid        ?? 0
  const allowUsed = divd?.allowance?.used ?? 0
  const allowRem  = divd?.allowance?.remaining ?? 0

  const breakdown = []
  if (total > 0)    breakdown.push({ label: 'Total dividends received',           value: fmt(total)     })
  if (shielded > 0) breakdown.push({ label: 'Shielded in ISA (tax-free)',          value: fmt(shielded)  })
  if (exposed > 0)  breakdown.push({ label: 'Outside ISA (taxable)',               value: fmt(exposed)   })
  if (allowUsed > 0) breakdown.push({ label: 'Dividend allowance used',            value: fmt(allowUsed) })
  if (allowRem > 0)  breakdown.push({ label: 'Allowance remaining',                value: fmt(allowRem)  })
  if (taxPaid > 0)  breakdown.push({ label: 'Dividend tax due',                    value: fmt(taxPaid)   })
  if (breakdown.length === 0) breakdown.push(...placeholder('Dividend tax'))

  return {
    formula: 'Dividend tax applied to dividends outside an ISA after deducting the annual dividend allowance, at the rate matching your income tax band.',
    source: 'dividendTaxDetail(entity) — gia_exposed, allowance, tax_paid.',
    confidence: divd?.confidence || 'low',
    breakdown,
  }
}
