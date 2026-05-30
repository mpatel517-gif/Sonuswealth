// TrustsPayloads.js — pure payload builders for TrustsPanel DrillableNumbers.
//
// Plan reference: LANE3-OUTSTANDING.md §1 Tier A (Trusts).
// Pure JS — no React. Consumed by TrustsPanel.jsx.
//
// Mirrors the pattern in TierA-DrillPayloads.js for per-item L5 payloads.

import { fmt } from '../../../../engine/fq-calculator.js'
import { buildTrustBreakdown, trustTypeLabel } from './TrustsPanel.data.js'

/**
 * Total hero payload — describes the sum across all trusts.
 *
 * @param {object} entity
 * @param {number} total
 * @param {number} count
 * @returns {{ formula, source, confidence, breakdown }}
 */
export function trustsTotalPayload(entity, total, count) {
  return {
    formula:    'Sum of trust_fund_value across all trust records on entity.trusts[].',
    source:     'entity.trusts[] — walked with real array index; no engine aggregator used.',
    confidence: count > 0 ? 'high' : 'low',
    breakdown:  [
      { label: 'Trusts recorded',  value: String(count) },
      { label: 'Total fund value', value: fmt(total) },
      { label: 'Note',             value: 'Tap any trust below to see fund detail and 10-year charge.' },
    ],
  }
}

/**
 * Per-trust L5 payload.
 * Editable path always targets trusts[${idx}].trust_fund_value.
 *
 * @param {object} trust   — single trust record from entity.trusts[idx]
 * @param {number} idx     — REAL index into entity.trusts[]
 * @param {string} parentSource
 * @returns {{ metric, formula, source, confidence, breakdown, editable }}
 */
export function trustL5(trust, idx, parentSource = 'entity.trusts[]') {
  if (!trust) return null

  const label = trustTypeLabel(trust.type)
  const value = +(trust.trust_fund_value ?? 0) || 0

  return {
    metric:    `${label} · Fund value`,
    formula:   'Current fund value as declared on trust record. Relevant-property-regime periodic charges assessed every 10 years from creation; exit charges apply on distributions.',
    source:    `${parentSource}[${idx}] — single trust record.`,
    confidence: 'high',
    breakdown: buildTrustBreakdown(trust),
    editable: {
      path:         `trusts[${idx}].trust_fund_value`,
      label:        `${label} fund value`,
      currentValue: value,
      unit:         '£',
    },
  }
}
