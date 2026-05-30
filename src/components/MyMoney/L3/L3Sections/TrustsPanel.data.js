// TrustsPanel.data.js — pure data builder for the Trusts L3 panel.
//
// Plan reference: LANE3-OUTSTANDING.md §1 Tier A (Trusts).
// Pure JS so node ESM tests import without JSX loader.
//
// Data source: entity.trusts[] (top-level — NOT assets.trusts[]).
// mrT-decum-complex.json places trusts at the entity root.

import { fmt } from '../../../../engine/fq-calculator.js'

/**
 * Map raw trust.type string to plain-English label.
 * No raw taxonomy codes in displayed labels.
 */
export function trustTypeLabel(type) {
  if (!type) return 'Trust'
  const t = String(type).toLowerCase()
  if (t.includes('discretionary')) return 'Discretionary trust'
  if (t.includes('bare'))          return 'Bare trust'
  if (t.includes('interest-in-possession') || t.includes('iip')) return 'Interest-in-possession trust'
  if (t.includes('accumulation'))  return 'Accumulation trust'
  if (t.includes('protective'))    return 'Protective trust'
  if (t.includes('charitable'))    return 'Charitable trust'
  if (t.includes('employee'))      return 'Employee benefit trust'
  return 'Trust'
}

/**
 * Build the trust rows for a persona.
 *
 * Strategy:
 *   · Walk entity.trusts[] with forEach so idx is the REAL array index
 *   · Each row carries idx + drill stub (populated by TrustsPayloads.js at JSX layer)
 *   · Degrade gracefully: no trusts → { rows:[], total:0, trustCount:0 }
 *
 * @param {object} entity
 * @returns {{
 *   rows: Array<{ key:string, label:string, sublabel:string, value:number, idx:number, drill:object }>,
 *   total: number,
 *   trustCount: number,
 * }}
 */
export function buildTrustRows(entity) {
  const trusts = Array.isArray(entity?.trusts) ? entity.trusts : []

  if (trusts.length === 0) {
    return { rows: [], total: 0, trustCount: 0 }
  }

  const rows = []
  let total = 0

  trusts.forEach((trust, idx) => {
    const value = +(trust.trust_fund_value ?? 0) || 0
    total += value

    const label = trustTypeLabel(trust.type)
    const sublabel = trust.settlor ? `Settlor: ${trust.settlor}` : ''

    rows.push({
      key:      trust.id || `trust-${idx}`,
      label,
      sublabel,
      value,
      idx,
      drill: {
        metric:  `${label} · Fund value`,
        formula: 'Current fund value as declared on trust record. Periodic charge is computed by the 10-yearly relevant-property regime calculation.',
        source:  `entity.trusts[${idx}]`,
        confidence: 'high',
        breakdown: buildTrustBreakdown(trust),
        editable: {
          path:         `trusts[${idx}].trust_fund_value`,
          label:        `${label} fund value`,
          currentValue: value,
          unit:         '£',
        },
      },
    })
  })

  return { rows, total, trustCount: trusts.length }
}

/**
 * Build the breakdown rows for a single trust record.
 * Used by both .data.js (for inline drill) and TrustsPayloads.js.
 */
export function buildTrustBreakdown(trust) {
  const rows = []
  if (trust.type)              rows.push({ label: 'Trust type',        value: trustTypeLabel(trust.type) })
  if (trust.settlor)           rows.push({ label: 'Settlor',            value: String(trust.settlor) })
  if (trust.trust_fund_value != null) {
    rows.push({ label: 'Fund value',         value: fmt(+trust.trust_fund_value) })
  }
  if (trust.trust_fund_growth_since_settlement != null) {
    rows.push({ label: 'Growth since settlement', value: fmt(+trust.trust_fund_growth_since_settlement) })
  }
  if (trust.ten_year_charge_next) {
    rows.push({ label: '10-year anniversary',  value: String(trust.ten_year_charge_next) })
  }
  if (trust.ten_year_charge_projected_at_then_value != null) {
    rows.push({ label: 'Projected periodic charge', value: fmt(+trust.ten_year_charge_projected_at_then_value) })
  }
  if (Array.isArray(trust.beneficiaries) && trust.beneficiaries.length > 0) {
    rows.push({ label: 'Beneficiaries',       value: `${trust.beneficiaries.length} named` })
  }
  if (trust.exit_charges_to_date != null) {
    rows.push({ label: 'Exit charges to date', value: fmt(+trust.exit_charges_to_date) })
  }
  return rows.length > 0 ? rows : [{ label: 'Trust detail', value: 'No additional detail recorded' }]
}
