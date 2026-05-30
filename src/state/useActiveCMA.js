// useActiveCMA — React binding for the active-CMA layer (src/engine/cma.js).
//
// Subscribing components re-render whenever any assumption changes, so a snapshot
// builder that reads getActiveCMA() recomputes with the new numbers. Pure read +
// the setter handles; no local copy of the assumptions is held here (the engine
// module is the single source of truth).

import { useSyncExternalStore, useCallback } from 'react'
import {
  getActiveCMA, getBaselineCMA, getCMAOverride, getCMAVersion,
  isCMAModified, onCMAChange, patchCMA, resetCMA, resetCMAField, setCMAOverride,
} from '../engine/cma.js'

// useSyncExternalStore wants a stable subscribe fn and a snapshot getter. We use
// the version counter as the snapshot so React re-renders on every change without
// us having to diff the (frozen) assumptions object.
function subscribe(cb) { return onCMAChange(cb) }
function getVersionSnapshot() { return getCMAVersion() }

/**
 * @returns {{
 *   cma: object,            // active assumptions (live)
 *   baseline: object,       // pristine published baseline
 *   override: object|null,  // the user's diff
 *   modified: boolean,      // any dial off baseline?
 *   version: number,
 *   patch: (partial) => void,
 *   set: (override) => void,
 *   reset: () => void,
 *   resetField: (key, field) => void,
 * }}
 */
export function useActiveCMA() {
  useSyncExternalStore(subscribe, getVersionSnapshot, getVersionSnapshot)
  const patch      = useCallback((p) => patchCMA(p), [])
  const set        = useCallback((o) => setCMAOverride(o), [])
  const reset      = useCallback(() => resetCMA(), [])
  const resetField = useCallback((k, f) => resetCMAField(k, f), [])
  return {
    cma:      getActiveCMA(),
    baseline: getBaselineCMA(),
    override: getCMAOverride(),
    modified: isCMAModified(),
    version:  getCMAVersion(),
    patch, set, reset, resetField,
  }
}
