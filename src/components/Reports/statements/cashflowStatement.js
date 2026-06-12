// src/components/Reports/statements/cashflowStatement.js
// Inflows ▸ sources · Outflows ▸ {essential, committed, debt service, tax} ▸ Net.
// Same monthly basis as Income Statement; net ties out to monthlySurplus NET.

import { monthlySurplus } from '../../../engine/fq-calculator.js'

export function buildCashflowStatement(entity, bundle = 'UK-2026.1') {
  const e = entity || {}
  const ms = monthlySurplus(e, bundle)
  const net = ms.surplus - ms.deficit
  const outflows = ms.essential + ms.committed + ms.debtService + ms.tax + (ms.protection || 0)

  return {
    key: 'cashflow-statement',
    title: 'Where your money goes (Cashflow Statement)',
    rootValue: net,
    rootLabel: 'Net Cashflow',
    periodNote: 'Monthly figures',
    nodes: [
      {
        key: 'inflows', label: 'Inflows', value: ms.income,
        formula: 'All income ÷ 12 (canonical cashflow waterfall).',
        source: 'Engine monthlySurplus()', confidence: 'high', children: [],
      },
      {
        key: 'outflows', label: 'Outflows', value: outflows,
        formula: 'Essential + committed + debt service + tax & NI + protection (monthly).',
        source: 'Engine monthlySurplus()', confidence: 'high',
        children: [
          { key: 'out-essential', label: 'Essential living', value: ms.essential, source: 'monthlySurplus()', confidence: 'high' },
          { key: 'out-committed', label: 'Committed (pension/ISA)', value: ms.committed, source: 'monthlySurplus()', confidence: 'high' },
          { key: 'out-debt', label: 'Debt service', value: ms.debtService, source: 'monthlySurplus()', confidence: 'high' },
          { key: 'out-tax', label: 'Tax & NI', value: ms.tax, source: 'monthlySurplus()', confidence: 'high' },
          { key: 'out-protection', label: 'Protection premiums', value: ms.protection || 0, source: 'monthlySurplus()', confidence: 'high' },
        ].filter(n => n.value !== 0),
      },
      {
        key: 'net', label: net >= 0 ? 'Net Cashflow (surplus)' : 'Net Cashflow (deficit)', value: net, isTotal: true,
        formula: 'Inflows − Outflows (NET = surplus − deficit).',
        source: 'Engine monthlySurplus()', confidence: 'high',
      },
    ],
  }
}
