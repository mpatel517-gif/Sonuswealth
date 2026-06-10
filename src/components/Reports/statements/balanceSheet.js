// src/components/Reports/statements/balanceSheet.js
// Pure mapper: entity → Balance Sheet StatementNode tree. Computes NOTHING new;
// every value is an engine helper. Assets is the SUM of the same 6 category
// helpers netWorth() uses, so Assets − Liabilities === netWorth() by construction.

import { netWorth } from '../../../engine/fq-calculator.js'
import {
  liabilitiesTotal,
  pensionTotal, investmentsTotal, propertyTotal, cashTotal,
  alternativesTotal, businessTotal,
} from '../../../engine/_helpers.js'

// Each node: { key, label, value, formula?, source?, confidence?, children? }
export function buildBalanceSheet(entity) {
  const e = entity || {}
  const pensions = pensionTotal(e)
  const investments = investmentsTotal(e)
  const property = propertyTotal(e)
  const cash = cashTotal(e)
  const alternatives = alternativesTotal(e)
  const business = businessTotal(e)
  const liabilities = liabilitiesTotal(e)
  const assets = pensions + investments + property + cash + alternatives + business
  const nw = netWorth(e)

  const cat = (key, label, value) => ({
    key, label, value,
    formula: `Engine category total for ${label.toLowerCase()} (schema-agnostic walker).`,
    source: 'Your holdings · asset taxonomy classification',
    confidence: 'high',
  })

  return {
    key: 'balance-sheet',
    title: 'Balance Sheet',
    rootValue: nw,
    rootLabel: 'Net Worth',
    nodes: [
      {
        key: 'assets', label: 'Assets', value: assets,
        formula: 'Sum of all asset categories (pensions + investments + property + cash + alternatives + business).',
        source: 'Engine asset walker', confidence: 'high',
        children: [
          cat('a-pensions', 'Pensions', pensions),
          cat('a-investments', 'Investments', investments),
          cat('a-property', 'Property', property),
          cat('a-cash', 'Cash', cash),
          cat('a-alternatives', 'Alternatives', alternatives),
          cat('a-business', 'Business', business),
        ].filter(n => n.value !== 0),
      },
      {
        key: 'liabilities', label: 'Liabilities', value: liabilities,
        formula: 'Sum of all outstanding debt balances (mortgages, loans, cards).',
        source: 'Engine liability walker · liability taxonomy', confidence: 'high',
        children: [],
      },
      {
        key: 'networth', label: 'Net Worth', value: nw, isTotal: true,
        formula: 'Assets − Liabilities (single engine total — netWorth()).',
        source: 'Engine netWorth()', confidence: 'high',
      },
    ],
  }
}
