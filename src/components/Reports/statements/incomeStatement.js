// src/components/Reports/statements/incomeStatement.js
// Income ▸ sources · less Tax ▸ bands · less Expenditure ▸ categories ▸ Surplus.
// monthlySurplus values are MONTHLY (annual ÷ 12). We render monthly to match
// the Cashflow tab. NET surplus = surplus − deficit (cashflow memo).

import { monthlySurplus, calcIncomeTax } from '../../../engine/fq-calculator.js'

export function buildIncomeStatement(entity, bundle = 'UK-2026.1') {
  const e = entity || {}
  const ms = monthlySurplus(e, bundle)
  const it = calcIncomeTax(e, bundle)
  const net = ms.surplus - ms.deficit
  const expenditure = ms.essential + ms.committed + ms.debtService

  return {
    key: 'income-statement',
    title: 'Income Statement',
    rootValue: net,
    rootLabel: 'Monthly Surplus',
    periodNote: 'Monthly figures',
    nodes: [
      {
        key: 'income', label: 'Income', value: ms.income,
        formula: 'Gross income ÷ 12 (all sources, canonical cashflow waterfall).',
        source: 'Engine monthlySurplus()', confidence: 'high', children: [],
      },
      {
        key: 'tax', label: 'less Tax & NI', value: ms.tax,
        formula: 'Income tax + NI ÷ 12. Annual income tax = calcIncomeTax().tax.',
        source: 'Engine calcIncomeTax() + NI', confidence: 'high',
        children: (it.byBand || []).filter(b => b.amount > 0).map((b, i) => ({
          key: `tax-band-${i}`,
          label: `${b.type.replace(/_/g, ' ')} @ ${Math.round(b.rate * 100)}%`,
          value: Math.round((b.amount * b.rate) / 12),
          formula: `£${Math.round(b.amount).toLocaleString('en-GB')} taxed @ ${Math.round(b.rate * 100)}% ÷ 12.`,
          source: 'calcIncomeTax().byBand', confidence: 'high',
        })),
      },
      {
        key: 'expenditure', label: 'less Expenditure', value: expenditure,
        formula: 'Essential + committed + debt service (monthly).',
        source: 'Engine monthlySurplus()', confidence: 'high',
        children: [
          { key: 'exp-essential', label: 'Essential living', value: ms.essential, source: 'monthlySurplus()', confidence: 'high' },
          { key: 'exp-committed', label: 'Committed (pension/ISA)', value: ms.committed, source: 'monthlySurplus()', confidence: 'high' },
          { key: 'exp-debt', label: 'Debt service', value: ms.debtService, source: 'monthlySurplus()', confidence: 'high' },
        ].filter(n => n.value !== 0),
      },
      {
        key: 'surplus', label: net >= 0 ? 'Monthly Surplus' : 'Monthly Deficit', value: net, isTotal: true,
        formula: 'Income − Tax & NI − Expenditure (NET = surplus − deficit).',
        source: 'Engine monthlySurplus()', confidence: 'high',
      },
    ],
  }
}
