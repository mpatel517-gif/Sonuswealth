// ─────────────────────────────────────────────────────────────────────────────
// TemporalMode — the ONE shared Now/Future/Plan/What-if mode every tab obeys.
//
// WHY THIS EXISTS
//   The temporal anchor (Today / Future / Plan / What-if) was implemented as
//   fragmented LOCAL state: HomeScreen owned a `viewMode`, TaxEstate and Cashflow
//   each had their own partial copies, and MyMoney/Risk/Timeline had none. So
//   switching to "Future" on Home did nothing on the other tabs. This lifts the
//   mode to one provider at the Dashboard level; every tab reads the same value
//   and re-renders its projected/scenario state from it.
//
// MODES (keys match HomeScreen's existing enum so no per-screen relabelling):
//   actual   → Today     — figures as they are now
//   forecast → Future    — projected forward (uses the CMA assumptions)
//   plan     → Plan      — committed scenario (SCENARIO_SAVED)
//   scenario → What-if   — live, unsaved scenario the user is dragging
//
// Persisted to localStorage so the chosen lens survives a reload, mirroring the
// theme/assumptions pattern. Pure React context — no engine coupling here; tabs
// decide what each mode means for their own content.
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react'

export const TEMPORAL_MODES = [
  { id: 'actual',   label: 'Today' },
  { id: 'forecast', label: 'Future' },
  { id: 'plan',     label: 'Plan' },
  { id: 'scenario', label: 'What-if' },
]

export const TEMPORAL_MODE_LABEL = {
  actual: 'Today', forecast: 'Future', plan: 'Plan', scenario: 'What-if',
}

const VALID = new Set(TEMPORAL_MODES.map(m => m.id))
const STORAGE_KEY = 'sonus.temporalMode'

const TemporalModeContext = createContext(null)

export function TemporalModeProvider({ children, initialMode = 'actual' }) {
  const [mode, _setMode] = useState(() => {
    try {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
      if (saved && VALID.has(saved)) return saved
    } catch (_) { /* ignore */ }
    return VALID.has(initialMode) ? initialMode : 'actual'
  })

  const setMode = useCallback((next) => {
    if (!VALID.has(next)) return
    _setMode(next)
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, next) } catch (_) { /* ignore */ }
  }, [])

  // Keep document attribute in sync — lets CSS/snapshot tooling read the mode.
  useEffect(() => {
    try { document?.documentElement?.setAttribute('data-temporal-mode', mode) } catch (_) { /* ignore */ }
  }, [mode])

  const value = useMemo(() => ({
    mode,
    setMode,
    modes: TEMPORAL_MODES,
    label: TEMPORAL_MODE_LABEL[mode],
    isFuture:   mode === 'forecast',
    isPlan:     mode === 'plan',
    isScenario: mode === 'scenario',
    isToday:    mode === 'actual',
  }), [mode, setMode])

  return (
    <TemporalModeContext.Provider value={value}>
      {children}
    </TemporalModeContext.Provider>
  )
}

/**
 * Read the shared temporal mode. Safe outside a provider (returns a static
 * 'actual' shape) so a tab rendered in isolation/tests never crashes.
 */
export function useTemporalMode() {
  const ctx = useContext(TemporalModeContext)
  if (!ctx) {
    return {
      mode: 'actual', setMode: () => {}, modes: TEMPORAL_MODES,
      label: 'Today', isFuture: false, isPlan: false, isScenario: false, isToday: true,
    }
  }
  return ctx
}
