// ─────────────────────────────────────────────────────────────────────────────
// CARRY-FORWARD STATE LEDGER  (M1·1B — founder 2026-06-08)
//
// UK tax is PATH-DEPENDENT: current and future tax can't be computed accurately
// from a single-year snapshot, because several reliefs consume PRIOR-YEAR state.
// This module is the ONE source for that bounded state — a ~10-field ledger the
// engine already knows how to consume (pension AA carry-forward, capital/rental/
// trading losses c/f, the 7-year IHT gift clock, MPAA-triggered status, LSA
// consumed, EIS/SEIS clocks, NI qualifying years, marriage allowance).
//
// This is NOT the historical-snapshot build ("where was my net worth in 2021").
// It is a small set of running balances + flags, captured once, not 6 annual
// financial reconstructions.
//
// HONEST-ABSENCE RULE (the whole point): when a field is unknown we DO NOT
// silently assume zero. We return the safe default AND mark it `provisional`
// with an `assumption` string, so every dependent number can be labelled
// "estimate — assumes no prior X" rather than presented as fact. Silent-zero is
// wrong in both directions and some directions are harmful (telling someone they
// have £60k pension headroom when MPAA caps them at £10k; showing a full £325k
// NRB when a £200k PET three years ago says otherwise).
//
// Resolution precedence per field (highest first):
//   1. explicit   — entity.carryForward.<field>  (user-entered, confidence HIGH)
//   2. prior-year — derived from a prior-year SA store (M2)  (confidence MED)
//   3. legacy     — existing entity shapes (pension.carryForward year-map,
//                   assets.cgt.carryForwardLosses, estate.gifts, …) (MED)
//   4. absence    — schema default + provisional:true + assumption  (LOW)
//
// Consumers: src/engine/ask-sonu/tax-year-state.js (pension AA via
// contributionRoom's priorYearsUnused), src/engine/sa-computation.js, and the
// L4NumberPanel confidence/source surface (provisional → low confidence badge).
// ─────────────────────────────────────────────────────────────────────────────

// Canonical default shape. `entity.carryForward` is distinct from the existing
// `entity.pension.carryForward` (a year-keyed object) and
// `entity.assets.cgt.carryForwardLosses` (a single number) — those remain the
// legacy sources this ledger reads from.
export const CARRY_FORWARD_SCHEMA = Object.freeze({
  pension_aa_unused:   [0, 0, 0],                    // [y-1, y-2, y-3] → contributionRoom's priorYearsUnused
  mpaa:                { triggered: false, date: null }, // null date = unknown
  lsa_used:            0,                            // Lump Sum Allowance already consumed (£)
  eis_seis:            [],                           // [{ date, amount, scheme:'EIS'|'SEIS'|'VCT' }]
  gifts_history:       [],                           // [{ date, amount, recipient? }] — 7-yr IHT clock
  losses:              { capital_cf: 0, rental_cf: 0, trading_cf: 0 }, // carried-forward losses (£)
  ni_qualifying_years: null,                         // null = unknown → provisional state-pension forecast
  marriage_allowance:  { transferred: false, direction: null }, // direction: 'in' | 'out' | null
})

const FIELDS = Object.keys(CARRY_FORWARD_SCHEMA)

// Human-readable "assumes no prior X" copy per field, surfaced when provisional.
const ASSUMPTION = {
  pension_aa_unused:   'assumes no unused pension allowance carried forward from the prior 3 years',
  mpaa:                'assumes the Money Purchase Annual Allowance has not been triggered',
  lsa_used:            'assumes no Lump Sum Allowance has been used by prior crystallisations',
  eis_seis:            'assumes no EIS/SEIS/VCT holdings in their relief-retention window',
  gifts_history:       'assumes no gifts made in the last 7 years',
  losses:              'assumes no capital, rental or trading losses carried forward',
  ni_qualifying_years: 'assumes a full National Insurance record for the state-pension forecast',
  marriage_allowance:  'assumes no Marriage Allowance has been transferred',
}

function _provenance(source, confidence, provisional, field) {
  const p = { source, confidence, provisional }
  if (provisional) p.assumption = ASSUMPTION[field]
  return p
}

// ── Legacy-shape readers ──────────────────────────────────────────────────────
// Each returns the resolved value, or `undefined` when the legacy shape carries
// no real data (so the resolver falls through to honest-absence).

// entity.pension.carryForward is a YEAR-KEYED object e.g.
//   { 'tax-2023-24': 0, 'tax-2024-25': 0, 'tax-2025-26': 0 }
// priorYearsUnused (consumed by uk-pension contributionRoom) is an ORDERED ARRAY
// [most-recent, …, oldest]. We sort the year keys DESCENDING and slice 3, so
// index 0 is the most recent prior year — matching carryForward()'s "current
// year first, then oldest prior year forward" usage. If every value is 0 we
// treat it as no-data (provisional), not authoritative-zero.
function _legacyPensionAaUnused(entity) {
  const cf = entity?.pension?.carryForward
  if (!cf || typeof cf !== 'object') return undefined
  const keys = Object.keys(cf).sort().reverse() // 'tax-2025-26' > 'tax-2024-25' > …
  if (keys.length === 0) return undefined
  const arr = keys.slice(0, 3).map((k) => +cf[k] || 0)
  while (arr.length < 3) arr.push(0)
  return arr.some((v) => v > 0) ? arr : undefined
}

function _legacyMpaa(entity) {
  if (entity?.mpaa_triggered === true || entity?.mpaaTriggered === true) {
    return { triggered: true, date: entity?.mpaa_date || entity?.mpaaDate || null }
  }
  return undefined // false/absent → can't distinguish "not triggered" from "unknown" → absence
}

function _legacyGifts(entity) {
  const g = entity?.estate?.gifts
  if (!Array.isArray(g) || g.length === 0) return undefined
  return g
    .map((x) => ({
      date: x.date || x.giftDate || null,
      amount: +(x.amount ?? x.value) || 0,
      recipient: x.recipient || x.to || undefined,
    }))
    .filter((x) => x.amount > 0)
}

function _legacyLosses(entity) {
  const capital = +entity?.assets?.cgt?.carryForwardLosses || 0
  const trading = +entity?.tradeLosses || 0 // calcANI already reads entity.tradeLosses
  if (capital === 0 && trading === 0) return undefined
  return { capital_cf: capital, rental_cf: 0, trading_cf: trading }
}

function _legacyMarriageAllowance(entity) {
  if (entity?.marriage_allowance_transferred === true || entity?.marriageAllowanceUsed === true) {
    return { transferred: true, direction: entity?.marriage_allowance_direction || null }
  }
  return undefined
}

const LEGACY_READERS = {
  pension_aa_unused:   _legacyPensionAaUnused,
  mpaa:                _legacyMpaa,
  lsa_used:            (e) => (+e?.lsa_used > 0 ? +e.lsa_used : undefined),
  eis_seis:            (e) => (Array.isArray(e?.eis_seis) && e.eis_seis.length ? e.eis_seis : undefined),
  gifts_history:       _legacyGifts,
  losses:             _legacyLosses,
  ni_qualifying_years: (e) => (Number.isFinite(+e?.niQualifyingYears) ? +e.niQualifyingYears : undefined),
  marriage_allowance:  _legacyMarriageAllowance,
}

function _isEmpty(field, value) {
  if (value == null) return true
  const def = CARRY_FORWARD_SCHEMA[field]
  if (Array.isArray(def)) return !Array.isArray(value) || value.every((v) => !v)
  if (Array.isArray(value)) return value.length === 0
  if (typeof def === 'object') return JSON.stringify(value) === JSON.stringify(def)
  return false
}

function _clone(v) {
  return Array.isArray(v) ? v.slice() : v && typeof v === 'object' ? { ...v } : v
}

/**
 * Build the resolved carry-forward ledger for an entity.
 *
 * @param {object} entity
 * @param {object|null} [priorYearStore] — a partial ledger derived from a
 *   prior-year SA store (M2 `deriveCarryForwardFromHistory`). Same field shape as
 *   CARRY_FORWARD_SCHEMA; only the fields it knows need be present. Optional in M1.
 * @returns {{ fields: object, provenance: Record<string,{source,confidence,provisional,assumption?}>, anyProvisional: boolean }}
 */
export function buildCarryForwardLedger(entity, priorYearStore = null) {
  const explicit = entity?.carryForward || {}
  const fields = {}
  const provenance = {}

  for (const field of FIELDS) {
    // 1. explicit (user-entered)
    if (field in explicit && !_isEmpty(field, explicit[field])) {
      fields[field] = _clone(explicit[field])
      provenance[field] = _provenance('user-entered', 'high', false, field)
      continue
    }
    // 2. prior-year store (M2)
    if (priorYearStore && field in priorYearStore && !_isEmpty(field, priorYearStore[field])) {
      fields[field] = _clone(priorYearStore[field])
      provenance[field] = _provenance('prior-year-return', 'med', false, field)
      continue
    }
    // 3. legacy entity shapes
    const legacy = LEGACY_READERS[field]?.(entity)
    if (legacy !== undefined && !_isEmpty(field, legacy)) {
      fields[field] = _clone(legacy)
      provenance[field] = _provenance('derived-from-existing-data', 'med', false, field)
      continue
    }
    // 4. honest absence — safe default, flagged provisional
    fields[field] = _clone(CARRY_FORWARD_SCHEMA[field])
    provenance[field] = _provenance('default', 'low', true, field)
  }

  const anyProvisional = FIELDS.some((f) => provenance[f].provisional)
  return { fields, provenance, anyProvisional }
}

/**
 * Convenience: prepend the provisional assumption to a formula string when the
 * driving field is provisional, so the L4NumberPanel "HOW THIS IS CALCULATED"
 * line reads honestly. Returns { formula, confidence } ready to spread into a
 * DrillableNumber payload.
 *
 * @param {object} ledger — result of buildCarryForwardLedger()
 * @param {string} field  — a CARRY_FORWARD_SCHEMA key
 * @param {string} formula
 * @param {string} [baseConfidence='high']
 */
export function applyProvenanceToFormula(ledger, field, formula, baseConfidence = 'high') {
  const p = ledger?.provenance?.[field]
  if (p?.provisional) {
    return { formula: `Estimate — ${p.assumption}. ${formula}`, confidence: 'low' }
  }
  return { formula, confidence: p?.confidence === 'med' ? 'med' : baseConfidence }
}
