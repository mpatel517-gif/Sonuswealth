// DCvsDBPayloads.js — pure payload builders for the DC vs DB L3 panel.
//
// NO React. Pure JS objects consumed by DrillableNumber.
// All exported functions return { formula, source, confidence, breakdown, editable? }.
//
// pensionSchemeL5 import: READ-ONLY — this file does not modify TierA-DrillPayloads.js.

import { fmt } from '../../../../engine/fq-calculator.js'
import { pensionSchemeL5 } from './TierA-DrillPayloads.js'
import { ILLUSTRATIVE_RATE, ILLUSTRATIVE_YEARS } from './DCvsDBPanel.data.js'

const pct = (r) => `${(r * 100).toFixed(2)}%`

/**
 * Hero payload — total pension mix (DC pots + DB CETVs).
 */
export function pensionMixHeroPayload({ dcTotal, dbCapitalEquiv, dbAnnual, total }) {
  return {
    formula: 'DC pots (sum of SIPP / workplace balances) + DB capital equivalent (CETV if provided, else pvAnnuity at 3% real over 25 years).',
    source: 'entity.assets.sipp.pensions[] + entity.assets.pensions[] via buildPensionMix()',
    confidence: 'medium',
    breakdown: [
      { label: 'Flexible pot (DC)',           value: fmt(dcTotal) },
      { label: 'Guaranteed income (DB) — capital equiv', value: fmt(dbCapitalEquiv) },
      { label: 'DB guaranteed income/yr',     value: `${fmt(dbAnnual)}/yr` },
      { label: 'Total shown',                 value: fmt(total) },
    ],
  }
}

/**
 * DC scheme row payload.
 * Delegates to pensionSchemeL5 (imported read-only from TierA-DrillPayloads.js).
 *
 * @param {object} scheme  — dcSchemes[] entry from buildPensionMix
 * @param {object} rawScheme — the raw persona object for this scheme
 */
export function dcSchemePayload(scheme, rawScheme) {
  const source = scheme.source === 'sipp'
    ? `entity.assets.sipp.pensions[${scheme.idx}]`
    : `entity.assets.pensions[${scheme.idx}]`

  const editablePath = scheme.source === 'sipp'
    ? `assets.sipp.pensions[${scheme.idx}].value`
    : `assets.pensions[${scheme.idx}].value`

  return pensionSchemeL5(
    rawScheme,
    source,
    { path: editablePath, label: scheme.name, currentValue: scheme.value, unit: '£' },
  )
}

/**
 * DB scheme row payload — shows annual income + CETV + income↔capital equivalence.
 *
 * @param {object} scheme  — dbSchemes[] entry from buildPensionMix
 * @param {object} rawScheme — the raw persona object for this scheme
 */
export function dbSchemePayload(scheme, rawScheme) {
  const cetvEditPath = `assets.pensions[${scheme.idx}].cetv`
  const cetvLabel    = scheme.cetvIsEstimate
    ? `CETV (not provided — tap to enter; estimated at ${pct(ILLUSTRATIVE_RATE)} real / ${ILLUSTRATIVE_YEARS} yr)`
    : 'Cash-equivalent transfer value (CETV)'

  const rows = []
  if (rawScheme.scheme || rawScheme.scheme_name) {
    rows.push({ label: 'Scheme', value: rawScheme.scheme || rawScheme.scheme_name })
  }
  if (rawScheme.status) rows.push({ label: 'Status', value: rawScheme.status })
  rows.push({ label: 'Guaranteed income', value: `${fmt(scheme.annual)}/yr` })
  if (rawScheme.spouse_pension_pct != null) {
    rows.push({ label: 'Spouse pension', value: `${(rawScheme.spouse_pension_pct * 100).toFixed(0)}% on death` })
  }
  if (rawScheme.inflation_linkage) {
    rows.push({ label: 'Inflation linkage', value: rawScheme.inflation_linkage })
  }
  rows.push({ label: cetvLabel, value: scheme.cetv != null ? fmt(scheme.cetv) : `~${fmt(scheme.capitalEquiv)} (illustrative)` })
  rows.push({
    label: `Capital equivalent (${pct(ILLUSTRATIVE_RATE)} real, ${ILLUSTRATIVE_YEARS} yr horizon)`,
    value: fmt(scheme.capitalEquiv),
  })
  rows.push({
    label: 'How we get capital equivalent',
    value: `pvAnnuity(${fmt(scheme.annual)}/yr, ${pct(ILLUSTRATIVE_RATE)}, ${ILLUSTRATIVE_YEARS} yr) = ${fmt(scheme.capitalEquiv)}. This is illustrative — use your actual CETV when available.`,
  })

  return {
    metric: `DB pension · ${scheme.name}`,
    formula: `Guaranteed annual income ${fmt(scheme.annual)}/yr. Capital equivalent via pvAnnuity at ${pct(ILLUSTRATIVE_RATE)} real over ${ILLUSTRATIVE_YEARS} years = ${fmt(scheme.capitalEquiv)}. If a CETV is available, that overrides the estimate.`,
    source: `entity.assets.pensions[${scheme.idx}] — DB scheme record`,
    confidence: scheme.cetvIsEstimate ? 'medium' : 'high',
    breakdown: rows,
    editable: { path: cetvEditPath, label: 'CETV (£)', currentValue: scheme.cetv ?? 0, unit: '£' },
  }
}

/**
 * Comparison row — DB guaranteed income expressed as capital equivalent vs DC pot.
 * Read-only (no editable).
 */
export function dcVsDbComparisonPayload({ dcTotal, dbCapitalEquiv, dbAnnual }) {
  const ratio = dcTotal > 0 ? dbCapitalEquiv / dcTotal : null
  return {
    formula: `DB capital equivalent (pvAnnuity @ ${pct(ILLUSTRATIVE_RATE)} real, ${ILLUSTRATIVE_YEARS} yr) vs DC pot size.`,
    source: 'buildPensionMix() — dcTotal + dbCapitalEquiv',
    confidence: 'medium',
    breakdown: [
      { label: 'Flexible pot (DC)',             value: fmt(dcTotal) },
      { label: 'Guaranteed income (DB) — capital equiv', value: fmt(dbCapitalEquiv) },
      { label: 'DB / DC ratio',                 value: ratio != null ? `${(ratio * 100).toFixed(0)}%` : 'n/a' },
      { label: 'DB income/yr',                  value: `${fmt(dbAnnual)}/yr` },
      { label: 'Discount rate used',            value: pct(ILLUSTRATIVE_RATE) },
      { label: 'Horizon used',                  value: `${ILLUSTRATIVE_YEARS} years` },
      { label: 'Why 3% real?',                  value: 'Illustrative only. Your actual CETV (from your scheme) is the authoritative figure; tap the CETV row on your DB scheme to enter it.' },
    ],
  }
}
