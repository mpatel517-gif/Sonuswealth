// TaxObligationsPanel.data.js — pure data builder, no React.
//
// Extracted so the L3 contract test can node-import without JSX loader.
// The panel JSX imports from here; the test imports from here.
//
// Per CLAUDE.md §6: no hardcoded tax rates or thresholds — all figures
// come from engine selectors (incomeTaxDetail, nicsDetail, dividendTaxDetail).

import { incomeTaxDetail, nicsDetail, dividendTaxDetail } from '../../../../engine/tax-estate-engine.js'
import { fmt } from '../../../../engine/fq-calculator.js'

export const TAX_TYPE_LABELS = {
  incomeTax:   'Income tax',
  nic:         'National Insurance',
  dividendTax: 'Dividend tax',
}

/**
 * Build a sorted (largest-first) list of tax type rows.
 *
 * @param {object} entity
 * @returns {{
 *   rows: Array<{ key:string, label:string, value:number, fmtValue:string, detail:object }>,
 *   total: number,
 *   typeCount: number,
 * }}
 */
export function buildTaxRows(entity) {
  const detail = incomeTaxDetail(entity)
  const nics   = nicsDetail(entity)
  const divd   = dividendTaxDetail(entity)

  const incomeTaxVal   = detail?.total_tax   ?? 0
  const nicTotal       = nics?.total_nic     ?? 0
  const dividendTaxVal = divd?.tax_paid      ?? 0

  const raw = [
    { key: 'incomeTax',   value: incomeTaxVal,   detail: detail },
    { key: 'nic',         value: nicTotal,        detail: nics   },
    { key: 'dividendTax', value: dividendTaxVal,  detail: divd   },
  ]

  const present = raw.filter(r => r.value > 0)
  const total   = raw.reduce((s, r) => s + r.value, 0)

  return {
    rows: raw
      .map(r => ({
        key:      r.key,
        label:    TAX_TYPE_LABELS[r.key],
        value:    r.value,
        fmtValue: fmt(r.value),
        detail:   r.detail,
      }))
      .sort((a, b) => b.value - a.value),
    total,
    typeCount: present.length,
  }
}
