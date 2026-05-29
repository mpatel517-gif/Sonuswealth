/**
 * Sonuswealth · src/state/ripple.jsx
 *
 * React hook for the single ripple path. Memoizes rippleEffect output keyed
 * on (entity reference, bundle version, scopes). Use this hook on any screen
 * that needs derived state — replaces ad-hoc calls to calcFQ / calcRisk /
 * ihtDynamic / etc. scattered across the codebase.
 *
 * Usage:
 *   const ripple = useRipple(entity)
 *   const nw     = ripple.balance_sheet?.netWorth
 *   const score  = ripple.scores?.fq?.score
 *   const iht    = ripple.iht?.iht?.iht  // ihtDynamic returns {iht, breakdown}
 *
 *   // Scope to just what's needed (skip unused subsystems on simpler tiles):
 *   const justScores = useRipple(entity, ['scores'])
 *
 * Cache invalidation:
 *   - entity reference changes (because applyEvents produces a new object on
 *     every committed event) → recompute
 *   - bundle version changes (setBundle called by boot hook or harness) →
 *     recompute
 *   - scopes array contents change → recompute
 */

import { useMemo } from 'react'
import { rippleEffect, SCOPE } from '../engine/ripple.js'
import { getBundleVersion } from '../engine/_bundle.js'

// Re-export scope constants so consumers don't need two imports.
export { SCOPE }

/**
 * Compute and memoize the ripple output for an entity.
 *
 * @param {object} entity  effective entity (post-event-fold)
 * @param {string[]} [scopes=['all']]  which scopes to compute
 * @returns {object}  ripple output { balance_sheet, scores, iht, cashflow,
 *                                    protection, tax, timeline, _meta }
 */
export function useRipple(entity, scopes = ['all']) {
  // Bundle version is a stable scalar that changes whenever setBundle is
  // called. We read it once per render and use it as a memo dependency so
  // a bundle swap (e.g. cron-rules-activation fires a new bundle) re-derives
  // all numbers without requiring entity identity to change.
  const bundleVer = getBundleVersion()

  // Scopes array is usually a literal; we key on its joined form to avoid
  // false invalidation when callers pass a fresh array with same contents.
  const scopesKey = Array.isArray(scopes) ? scopes.join(',') : 'all'

  return useMemo(
    () => rippleEffect(entity, null, scopes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entity, bundleVer, scopesKey]
  )
}

/**
 * Variant that takes an explicit change event. Use when the caller wants the
 * ripple output to log which event triggered it (showing up in `_meta.change`).
 * In v0 the change is metadata only — the engine still does a full recompute.
 *
 * @param {object} entity
 * @param {object|null} change
 * @param {string[]} [scopes=['all']]
 */
export function useRippleForChange(entity, change, scopes = ['all']) {
  const bundleVer = getBundleVersion()
  const scopesKey = Array.isArray(scopes) ? scopes.join(',') : 'all'
  const changeKey = change?.type ? `${change.type}:${change.ts || ''}` : ''
  return useMemo(
    () => rippleEffect(entity, change, scopes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entity, bundleVer, scopesKey, changeKey]
  )
}
