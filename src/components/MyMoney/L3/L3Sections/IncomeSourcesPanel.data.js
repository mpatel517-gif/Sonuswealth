// IncomeSourcesPanel.data.js — pure data builder, no React.
//
// Extracted so the L3-2 contract test can node-import without JSX loader.
// The panel JSX imports from here; the test imports from here.

import { statePensionAnnual } from '../../../../engine/_helpers.js'

export const SOURCE_LABELS = {
  employment:     'Employment',
  selfEmployed:   'Self-employment',
  dividends:      'Dividends',
  rental:         'Rental income',
  overseasIncome: 'Overseas income',
  statePension:   'State pension',
  drawdown:       'Pension drawdown',
  other:          'Other',
}

export const SOURCE_COLOURS = {
  employment:     'var(--c-acc2)',
  selfEmployed:   'var(--c-mint)',
  dividends:      'var(--c-violet)',
  rental:         'var(--c-gold)',
  overseasIncome: 'var(--c-acc3)',
  statePension:   'var(--c-acc)',
  drawdown:       'var(--c-text2)',
  other:          'var(--c-text3)',
}

/**
 * Build a sorted (largest-first) list of income sources with amount + share.
 * Reads via the same dual-schema-aware path annualIncome uses so totals
 * reconcile without separate rounding paths.
 *
 * @param {object} entity
 * @returns {{
 *   rows: Array<{ key:string, value:number, label:string, colour:string, share:number }>,
 *   total: number,
 *   sourceCount: number,
 * }}
 */
export function buildSourceRows(entity) {
  const ind = entity?.individual || {}
  const inc = entity?.income || {}

  // Salary: F1 fix — MAX not SUM across schemas.
  const employment = Math.max(
    +(ind.gross_salary || 0),
    +(inc.employment   || 0),
    +(inc.salary       || 0),
  )
  // Rental: aliases — MAX, not SUM.
  const rental = Math.max(+(inc.rental || 0), +(inc.rentalIncome || 0))

  const sp = statePensionAnnual(entity)
  const spStartAge = inc.statePension?.startAge || 67
  const age = +entity?.age || 0
  const statePension = age >= spStartAge ? sp : 0

  const raw = [
    { key: 'employment',     value: employment },
    { key: 'selfEmployed',   value: +(inc.selfEmployed   || 0) },
    { key: 'dividends',      value: +(inc.dividends      || 0) },
    { key: 'rental',         value: rental },
    { key: 'overseasIncome', value: +(inc.overseasIncome || 0) },
    { key: 'statePension',   value: statePension },
    { key: 'drawdown',       value: +entity?.drawdown    || 0 },
    { key: 'other',          value: +(inc.other          || 0) },
  ]

  const present = raw.filter(r => r.value > 0)
  const total = present.reduce((s, r) => s + r.value, 0)
  return {
    rows: present
      .map(r => ({
        ...r,
        label: SOURCE_LABELS[r.key],
        colour: SOURCE_COLOURS[r.key],
        share: total > 0 ? r.value / total : 0,
      }))
      .sort((a, b) => b.value - a.value),
    total,
    sourceCount: present.length,
  }
}
