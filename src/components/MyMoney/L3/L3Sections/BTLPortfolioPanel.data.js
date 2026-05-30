// BTLPortfolioPanel.data.js — pure data builder for the BTL Portfolio L3 panel.
//
// Pure JS (no JSX) so Node ESM tests import without a JSX loader.
//
// Schema-agnostic: handles both FLAT persona-a..g shape (isRental + rentalGrossAnnual)
// and NESTED mrT-landlord shape (assets.property[] with $ref entries resolved from
// rental_portfolio.properties[]).
//
// $ref resolution: mrT-landlord stores property rows as { "$ref": "btl-1" } inside
// assets.property[].  The real objects live in rental_portfolio.properties[].
// We resolve on the fly using a local refMap so the array index (realIdx) remains
// the true index into assets.property[] — critical for editable paths.

import { fmt } from '../../../../engine/fq-calculator.js'
import { netWorth } from '../../../../engine/fq-calculator.js'

// ── $ref resolver ─────────────────────────────────────────────────────────────
function resolvePropertyRefs(entity) {
  const raw = entity?.assets?.property
  if (!Array.isArray(raw)) return []

  // Build refMap from rental_portfolio.properties[] if present
  const refSources = entity?.rental_portfolio?.properties
  const refMap = {}
  if (Array.isArray(refSources)) {
    for (const rp of refSources) {
      if (rp?.id) refMap[rp.id] = rp
    }
  }

  return raw.map((p, idx) => {
    if (p && typeof p === 'object' && p['$ref']) {
      const resolved = refMap[p['$ref']]
      if (!resolved) return { _raw: p, _idx: idx, _resolved: false }
      return { ...resolved, _idx: idx, _resolved: true }
    }
    return { ...p, _idx: idx, _resolved: true }
  })
}

// ── BTL filter ────────────────────────────────────────────────────────────────
// A property qualifies as BTL if it has any rental income signal or is flagged
// explicitly. Main residence (type=main-residence, no rental signal) excluded.
function isBTL(p) {
  if (!p || !p._resolved) return false
  const hasRentalFlag  = p.isRental === true
  const hasGrossAnnual = p.rentalGrossAnnual != null && +p.rentalGrossAnnual > 0
  const hasGrossRent   = p.gross_rent_annual != null && +p.gross_rent_annual > 0
  const hasRentalInc   = p.rental_income != null && +p.rental_income > 0
  const hasRentalIncome = p.rentalIncome != null && +p.rentalIncome > 0
  return hasRentalFlag || hasGrossAnnual || hasGrossRent || hasRentalInc || hasRentalIncome
}

// ── Gross-rent field resolver ─────────────────────────────────────────────────
function grossRentField(p) {
  if (p.rentalGrossAnnual != null) return 'rentalGrossAnnual'
  if (p.gross_rent_annual != null) return 'gross_rent_annual'
  if (p.rental_income    != null) return 'rental_income'
  return 'rentalIncome'
}

function grossRentValue(p) {
  return +(p.rentalGrossAnnual ?? p.gross_rent_annual ?? p.rental_income ?? p.rentalIncome ?? 0)
}

function netRentValue(p) {
  return +(p.rentalNetAnnual ?? p.net_rent_annual ?? p.rentalNetAnnual ?? 0)
}

// ── Label ─────────────────────────────────────────────────────────────────────
function propLabel(p) {
  return p.address || p.description || p.name || 'Let property'
}

/**
 * Build BTL rows from entity.
 *
 * @param {object} entity
 * @returns {{
 *   properties: Array<{
 *     idx: number,
 *     name: string,
 *     value: number,
 *     grossRent: number,
 *     netRent: number,
 *     grossField: string,
 *     prop: object,
 *     drill: object|null,
 *   }>,
 *   totalValue: number,
 *   totalGrossRent: number,
 *   totalNetRent: number,
 *   grossYield: number,
 *   concentration: number,
 * }}
 */
export function buildBTLRows(entity) {
  const resolved   = resolvePropertyRefs(entity)
  const btlProps   = resolved.filter(isBTL)
  const nw         = netWorth(entity)

  const properties = btlProps.map(p => {
    const value     = +(p.value ?? p.value_gbp ?? 0)
    const grossRent = grossRentValue(p)
    const netRent   = netRentValue(p)
    const gField    = grossRentField(p)
    const addr      = propLabel(p)
    const idx       = p._idx

    return {
      idx,
      name:       addr,
      value,
      grossRent,
      netRent,
      grossField: gField,
      prop:       p,
      // drill payload shape (consumed by BTLPortfolioPanel.jsx to pass to
      // DrillableNumber → onDrill).  propertyL5 is imported in the JSX layer
      // so we store the raw editable descriptor here.
      editableValue: {
        path:         `assets.property[${idx}].value`,
        label:        `${addr} — property value`,
        currentValue: value,
        unit:         '£',
      },
    }
  })

  const totalValue     = properties.reduce((s, p) => s + p.value, 0)
  const totalGrossRent = properties.reduce((s, p) => s + p.grossRent, 0)
  const totalNetRent   = properties.reduce((s, p) => s + p.netRent, 0)
  const grossYield     = totalValue > 0 ? totalGrossRent / totalValue : 0
  const concentration  = nw > 0 ? totalValue / nw : 0

  return {
    properties,
    totalValue,
    totalGrossRent,
    totalNetRent,
    grossYield,
    concentration,
  }
}
