// BTLPortfolioPayloads.js — pure payload builders for the BTL Portfolio L3 panel.
//
// No React.  Returns { formula, source, confidence, breakdown } objects consumed
// by DrillableNumber in BTLPortfolioPanel.jsx.
//
// Per-property editing is handled via propertyL5 in the JSX layer.
// These builders cover portfolio-level summary rows only (read-only, no editable).

import { fmt } from '../../../../engine/fq-calculator.js'

// ── Total BTL value payload ───────────────────────────────────────────────────
export function btlTotalPayload(properties, totalValue) {
  const breakdown = properties.length > 0
    ? properties.map(p => ({
        label: p.name,
        value: fmt(p.value),
      }))
    : [{ label: 'No BTL properties', value: '—' }]

  return {
    formula:    'Sum of current estimated values across all buy-to-let properties in assets.property[].',
    source:     'assets.property[] — value field per let unit (resolved from rental_portfolio.properties[] where $ref used)',
    confidence: properties.length > 0 ? 'high' : 'low',
    breakdown,
  }
}

// ── Total gross rent payload ──────────────────────────────────────────────────
export function btlGrossRentPayload(properties, totalGrossRent) {
  const breakdown = properties.length > 0
    ? properties.map(p => ({
        label: p.name,
        value: fmt(p.grossRent),
      }))
    : [{ label: 'No rental income recorded', value: '—' }]

  return {
    formula:    'Sum of gross annual rental income across all let properties, before mortgage interest, allowable expenses, and the S24 restriction.',
    source:     'assets.property[] — rentalGrossAnnual / gross_rent_annual / rental_income per let unit',
    confidence: properties.length > 0 ? 'high' : 'low',
    breakdown,
  }
}

// ── Total net rent payload ────────────────────────────────────────────────────
export function btlNetRentPayload(properties, totalNetRent) {
  const breakdown = properties.length > 0
    ? properties.map(p => ({
        label: p.name,
        value: p.netRent > 0 ? fmt(p.netRent) : 'Not recorded',
      }))
    : [{ label: 'No net rental data', value: '—' }]

  return {
    formula:    'Sum of net annual rental income across let properties, after allowable expenses (excludes S24-restricted mortgage interest which is handled separately as a tax credit).',
    source:     'assets.property[] — rentalNetAnnual / net_rent_annual per let unit; may be absent if not recorded',
    confidence: properties.some(p => p.netRent > 0) ? 'medium' : 'low',
    breakdown,
  }
}

// ── Gross yield payload ───────────────────────────────────────────────────────
export function btlYieldPayload(grossYield, totalGrossRent, totalValue) {
  return {
    formula:    `Gross yield = total gross annual rent ÷ total portfolio value = ${fmt(totalGrossRent)} ÷ ${fmt(totalValue)}`,
    source:     'assets.property[] — gross rent fields / value fields; no deductions applied',
    confidence: totalValue > 0 && totalGrossRent > 0 ? 'high' : 'low',
    breakdown:  [
      { label: 'Total gross annual rent', value: fmt(totalGrossRent) },
      { label: 'Total portfolio value',   value: fmt(totalValue) },
      { label: 'Gross yield',             value: `${(grossYield * 100).toFixed(2)}%` },
    ],
  }
}

// ── Concentration payload ─────────────────────────────────────────────────────
export function btlConcentrationPayload(concentration, totalValue) {
  return {
    formula:    'BTL portfolio value as a share of total net worth (via netWorth(entity)).',
    source:     'assets.property[] BTL value sum ÷ netWorth(entity)',
    confidence: totalValue > 0 ? 'medium' : 'low',
    breakdown:  [
      { label: 'BTL portfolio value', value: fmt(totalValue) },
      { label: 'Share of net worth',  value: `${(concentration * 100).toFixed(1)}%` },
    ],
  }
}
