// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE-CMA LAYER — single read path for capital-market assumptions.
//
// WHY THIS EXISTS
//   Before this module, ~8 call sites imported `cma-2026.json` statically and
//   passed it straight into the engine. A user who wants to "play with the
//   percentages" had no way to make an override reach all of them. This module
//   is the ONE place the live assumptions are read from. Every consumer should
//   call getActiveCMA() (or the useActiveCMA() hook) instead of importing the
//   JSON directly, so a single override flows everywhere.
//
// THE BASELINE-PRESERVATION CONTRACT (numeric integrity — CLAUDE.md §9.5)
//   The engines read a SCALAR `growth` (0.058) + `worstDecile`, NOT the 8
//   asset-class returns. The baseline 5.8% is net of a haircut and is NOT the
//   weight-blend of the per-class returns (that comes to ~6.16%). So we must
//   NOT recompute growth from the table — that would move the number with zero
//   user edits. Instead, per-class edits apply as a WEIGHTED DELTA on top of the
//   baseline scalar:
//       growth_effective = growth_baseline + Σ weightᵢ · (returnᵢ − returnᵢ_baseline)
//   At baseline every delta is 0 → growth stays EXACTLY 0.058. This is what
//   keeps the "starts at baseline" promise honest.
//
// PERSISTENCE
//   Assumptions are a GLOBAL user preference (their market view), not per-persona
//   data — so they persist via localStorage (mirroring sonus.settings.*), not the
//   per-persona event store. hydrateCMA() is called once on app boot.
//
// NODE-SAFE: plain JS, no React, no DOM beyond a guarded localStorage. Importable
// by tests and by .data.js builders. The React glue is in src/state/useActiveCMA.js.
// ─────────────────────────────────────────────────────────────────────────────

import BASELINE from '../rules/cma-2026.json' with { type: 'json' }

const STORAGE_KEY = 'sonus.assumptions.cma'

// ── mutable refs ─────────────────────────────────────────────────────────────
let _override = null          // the user's diff, or null when at baseline
let _active   = BASELINE      // baseline ⊕ override (derived; never mutate BASELINE)
let _version  = 0             // bumps on every change — cheap re-render signal
const _subs = new Set()       // onCMAChange callbacks

// Portfolio weights used to convert per-class return deltas into a scalar growth
// delta. Defaults to the 'balanced' profile; em_equity carries weight 0 there.
function _weights() {
  return BASELINE.defaultPortfolioWeights?.balanced || {}
}

function _clone(o) { return JSON.parse(JSON.stringify(o)) }

// Recompute the effective scalar growth from per-class return deltas.
function _deriveGrowth(activeClasses) {
  const w = _weights()
  let delta = 0
  for (const key of Object.keys(BASELINE.assetClasses || {})) {
    const base = BASELINE.assetClasses[key]?.expectedReturn ?? 0
    const cur  = activeClasses?.[key]?.expectedReturn ?? base
    delta += (w[key] || 0) * (cur - base)
  }
  return BASELINE.growth + delta
}

// Recompute worstDecile.annual_equiv from per-class volatility deltas. A higher
// blended volatility → a deeper worst-decile loss (more negative). Scaled by the
// ratio of new blended vol to baseline blended vol so baseline is preserved.
function _deriveWorstDecile(activeClasses) {
  const w = _weights()
  const blend = (classes) => {
    let v = 0
    for (const key of Object.keys(BASELINE.assetClasses || {})) {
      const base = BASELINE.assetClasses[key]?.volatility ?? 0
      const cur  = classes?.[key]?.volatility ?? base
      v += (w[key] || 0) * cur
    }
    return v
  }
  const baseVol = blend(BASELINE.assetClasses)
  const curVol  = blend(activeClasses)
  const ratio   = baseVol > 0 ? curVol / baseVol : 1
  const base    = BASELINE.worstDecile?.annual_equiv ?? -0.082
  return {
    ...(BASELINE.worstDecile || {}),
    annual_equiv: +(base * ratio).toFixed(4),
  }
}

// Rebuild _active from BASELINE + _override, enforcing the baseline contract.
function _rebuild() {
  if (!_override || Object.keys(_override).length === 0) {
    _active = BASELINE
  } else {
    const next = _clone(BASELINE)
    // inflation — direct scalar override
    if (typeof _override.inflation === 'number') next.inflation = _override.inflation
    // per-asset-class overrides (expectedReturn / volatility)
    if (_override.assetClasses) {
      for (const [key, patch] of Object.entries(_override.assetClasses)) {
        if (!next.assetClasses[key]) continue
        if (typeof patch.expectedReturn === 'number') next.assetClasses[key].expectedReturn = patch.expectedReturn
        if (typeof patch.volatility === 'number')     next.assetClasses[key].volatility     = patch.volatility
      }
      // derive the scalars the engine actually reads
      next.growth      = +_deriveGrowth(next.assetClasses).toFixed(5)
      next.worstDecile = _deriveWorstDecile(next.assetClasses)
    }
    next._meta = { ...(next._meta || {}), modified: true }
    _active = next
  }
  _version++
  for (const fn of _subs) { try { fn(_active) } catch (_) { /* swallow */ } }
}

// ── public API ───────────────────────────────────────────────────────────────

/** Live assumptions object the engine/UI should read. Never null. */
export function getActiveCMA()  { return _active }
/** The pristine published assumptions (for reset + "vs baseline" deltas). */
export function getBaselineCMA() { return BASELINE }
/** The user's diff, or null when unmodified. */
export function getCMAOverride() { return _override }
/** Monotonic counter — bumps on every change. */
export function getCMAVersion()  { return _version }
/** True when the user has moved any assumption off baseline. */
export function isCMAModified()  { return _override != null && Object.keys(_override).length > 0 }

/**
 * Replace the whole override diff. Pass null/{} to clear (→ baseline).
 * @param {object|null} ov  { inflation?, assetClasses?: { key: { expectedReturn?, volatility? } } }
 */
export function setCMAOverride(ov) {
  _override = (ov && typeof ov === 'object' && Object.keys(ov).length) ? _clone(ov) : null
  _rebuild()
  _persist()
}

/**
 * Merge a partial patch into the current override (single-dial edits).
 * Deep-merges assetClasses by key. Inflation is a direct scalar.
 * @param {object} patch
 */
export function patchCMA(patch) {
  if (!patch || typeof patch !== 'object') return
  const next = _override ? _clone(_override) : {}
  if (typeof patch.inflation === 'number') next.inflation = patch.inflation
  if (patch.assetClasses) {
    next.assetClasses = next.assetClasses || {}
    for (const [key, p] of Object.entries(patch.assetClasses)) {
      next.assetClasses[key] = { ...(next.assetClasses[key] || {}), ...p }
    }
  }
  setCMAOverride(next)
}

/** Reset a single asset-class field, or the whole table, back to baseline. */
export function resetCMAField(key, field) {
  if (!_override?.assetClasses?.[key]) return
  const next = _clone(_override)
  delete next.assetClasses[key][field]
  if (Object.keys(next.assetClasses[key]).length === 0) delete next.assetClasses[key]
  if (next.assetClasses && Object.keys(next.assetClasses).length === 0) delete next.assetClasses
  setCMAOverride(next)
}

/** Reset every assumption back to the published baseline. */
export function resetCMA() {
  _override = null
  _rebuild()
  _persist()
}

/** Subscribe to changes. Returns an unsubscribe handle. */
export function onCMAChange(fn) {
  if (typeof fn !== 'function') return () => {}
  _subs.add(fn)
  return () => { _subs.delete(fn) }
}

// ── persistence (browser only; guarded for node tests) ───────────────────────
function _persist() {
  try {
    if (typeof localStorage === 'undefined') return
    if (_override) localStorage.setItem(STORAGE_KEY, JSON.stringify(_override))
    else localStorage.removeItem(STORAGE_KEY)
  } catch (_) { /* private mode / no storage — silently skip */ }
}

/** Read any persisted override from localStorage and apply it. Call once on boot. */
export function hydrateCMA() {
  try {
    if (typeof localStorage === 'undefined') return
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') { _override = parsed; _rebuild() }
  } catch (_) { /* corrupt payload — ignore, stay at baseline */ }
}
