// ─────────────────────────────────────────────────────────────────────────────
// X28TopBar — temporal-view top-bar selector (Window + Mode + [Now] + rules)
// Spec: home-v1_4 §X28-HOME · mymoney §3.1-3.3 · cashflow §X28-CF · te §X28-TE
//
// Two rows:
//   Row 1  — TimeWindow pill (7 options) + rules-version chip + [Now] pill
//   Row 2  — 4-mode toggle  (Actual · Forecast · Plan · Scenario)
//
// The [Now] pill is the X28-invariant marker. It is dimmed in Plan and Scenario
// modes (those modes show counterfactual states, not "now"). In Actual/Forecast
// the pill is solid and tappable — tap re-snaps to current state.
//
// Persistence: window + viewMode written to localStorage under
//   'sonuswealth.temporal'  → { window, viewMode, ts }
// On mount, if no controlled value passed, hydrate from storage.
//
// Animation contract (caller responsibility):
//   When viewMode changes, the screen *content* under this bar should slide
//   in from the right. The pattern is:
//
//     <X28TopBar viewMode={mode} onViewModeChange={setMode} ... />
//     <div key={mode} className="sw-tab-slide">{ ...screen body... }</div>
//
//   Keying the wrapper on `mode` causes React to remount, so the .sw-tab-slide
//   keyframe re-fires per change. This component itself only animates the
//   active-mode indicator (sliding background pill) — it does NOT touch the
//   children of its parent.
//
// Props:
//   window            string   one of TIME_WINDOWS ids
//   viewMode          string   'actual' | 'forecast' | 'plan' | 'scenario'
//   onWindowChange    fn       (window-id) => void
//   onViewModeChange  fn       (mode)      => void
//   rulesVersion      string   default BRAND.rulesVersion
//   dataDate          string   default BRAND.dataDate
//   showNowPill       bool     default true
//   onNowTap          fn?      optional handler for the Now pill
//
// Sub-export:  TIME_WINDOWS  — array of {id,label,full}
// Sub-export:  VIEW_MODES    — array of {id,label}
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import { BRAND } from '../../config/brand.js'

// Spec §3.2: 7 forward-looking horizons + the historical-period selectors.
// Each window carries `years` for projection helpers, `direction` for forward
// vs back, and `defaultMode` so the bar auto-switches view-mode on window
// change (e.g. "5 years" defaults to Forecast, "10/20/Lifetime" to Plan).
// Horizon = the projection viewpoint in time (now / back / forward), NOT the tax
// year — the rule year is owned separately by the global YearStepper. Labels are
// deliberately relative ("This year", "Last year") with no hardcoded year number,
// which would otherwise contradict whatever rule year the stepper is on (founder
// 2026-06-08, year-stepper decoupling).
export const TIME_WINDOWS = [
  { id: 'current-period',  label: 'This year',  full: 'This year',                     years: 0,  direction: 'now',     defaultMode: 'actual'   },
  { id: 'calendar-year',   label: 'Jan–Dec',    full: 'Calendar year (Jan–Dec)',       years: 0,  direction: 'now',     defaultMode: 'actual'   },
  { id: 'last-period',     label: 'Last year',  full: 'Last year',                     years: -1, direction: 'back',    defaultMode: 'actual'   },
  { id: 'next-period',     label: 'Next year',  full: 'Next year',                      years: 1,  direction: 'forward', defaultMode: 'forecast' },
  { id: 'five-year',       label: '5 years',    full: '5-year horizon',                years: 5,  direction: 'forward', defaultMode: 'forecast' },
  { id: 'ten-year',        label: '10 years',   full: '10-year horizon',               years: 10, direction: 'forward', defaultMode: 'plan'     },
  { id: 'twenty-year',     label: '20 years',   full: '20-year horizon',               years: 20, direction: 'forward', defaultMode: 'plan'     },
  { id: 'lifetime',        label: 'Lifetime',   full: 'Lifetime',                      years: 50, direction: 'forward', defaultMode: 'plan'     },
]

// Plain-English viewMode labels per PP-9 + founder direction 2026-05-12.
// IDs stay stable for engine + persistence — labels are user-facing only.
//   actual   → Today     (where you stand now)
//   forecast → Future    (where you're projected to be)
//   plan     → Plan      (where you committed to going)
//   scenario → What if   (where you could go if you chose differently)
export const VIEW_MODES = [
  { id: 'actual',   label: 'Today'   },
  { id: 'forecast', label: 'Future'  },
  { id: 'plan',     label: 'Plan'    },
  { id: 'scenario', label: 'What if' },
]

const STORE_KEY = 'sonuswealth.temporal'

function readStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    // Validate against the current TIME_WINDOWS set — ids changed in the
    // spec-§3.2 reconcile (e.g. 'current-tax-year' → 'current-period'). Drop
    // stale stored values rather than carry them across sessions.
    if (parsed.window && !TIME_WINDOWS.some(w => w.id === parsed.window)) {
      return null
    }
    return parsed
  } catch { return null }
}
function writeStore(window, viewMode) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      window, viewMode, ts: Date.now(),
    }))
  } catch { /* quota / SSR — silent */ }
}

export default function X28TopBar({
  window: windowProp,
  viewMode: viewModeProp,
  onWindowChange,
  onViewModeChange,
  rulesVersion = BRAND.rulesVersion,
  dataDate = BRAND.dataDate,
  showNowPill = true,
  showWindowRow = true,
  // Hide the Today/Future/Plan/What-if view-mode tabs (keep only the optional
  // Choices toggle). Cashflow uses this: those modes are no-ops there, so showing
  // them was a dead control (sweep #54). Default keeps them for My Money etc.
  showViewModes = true,
  onNowTap,
  // Optional 5th tab next to the view modes (founder 2026-06-06): a "Decisions"
  // entry that, like "What if", swaps the screen content for the decision
  // categories. It is NOT a viewMode (doesn't touch the engine time-state) —
  // the screen owns a separate `decisionsActive` toggle via onDecisions.
  showDecisions = false,
  decisionsActive = false,
  onDecisions,
}) {
  // hydrate from storage if uncontrolled on first render
  const stored = useRef(readStore())
  const [windowState, setWindowState] = useState(
    windowProp || stored.current?.window || 'current-period'
  )
  const [modeState, setModeState] = useState(
    viewModeProp || stored.current?.viewMode || 'actual'
  )
  // sync from controlled props
  useEffect(() => { if (windowProp)   setWindowState(windowProp)   }, [windowProp])
  useEffect(() => { if (viewModeProp) setModeState(viewModeProp)   }, [viewModeProp])

  // persist on change + broadcast for cross-screen `useTaxYear` consumers
  // (CX-1, 2026-05-28). `storage` event only fires across tabs; this custom
  // event handles same-tab propagation so a TY-change in the TopBar updates
  // every screen consuming the hook without a page reload.
  useEffect(() => {
    writeStore(windowState, modeState)
    if (typeof window !== 'undefined') {
      try { window.dispatchEvent(new CustomEvent('sonus:taxyear', { detail: { window: windowState } })) }
      catch { /* old browsers — silent */ }
    }
  }, [windowState, modeState])

  const [open, setOpen] = useState(false)
  const current = TIME_WINDOWS.find(w => w.id === windowState) || TIME_WINDOWS[3]

  function pickWindow(w) {
    setWindowState(w.id)
    setOpen(false)
    onWindowChange?.(w.id)
    // Spec §3.2: each window has a default view-mode. When the user picks a
    // window whose default differs from the current mode, auto-switch — they
    // can override afterwards. Without this the Forecast/Plan modes never
    // surface naturally from "I want to see 10 years out".
    if (w.defaultMode && w.defaultMode !== modeState) {
      setModeState(w.defaultMode)
      onViewModeChange?.(w.defaultMode)
    }
  }
  function pickMode(m) {
    if (m.id === modeState) return
    setModeState(m.id)
    onViewModeChange?.(m.id)
  }

  const nowDimmed = modeState === 'plan' || modeState === 'scenario'

  // Tab list for Row 2 — view modes, plus an optional Decisions tab. Decisions
  // is tracked separately (decisionsActive), so when it's on, none of the
  // view-mode tabs read as active.
  const baseModes = showViewModes ? VIEW_MODES : []
  const tabs = showDecisions ? [...baseModes, { id: '__decisions', label: 'Choices' }] : baseModes
  const activeIdx = decisionsActive ? baseModes.length : baseModes.findIndex(m => m.id === modeState)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      padding: '10px 16px 12px',
      background: 'var(--c-bg)',
      borderBottom: '1px solid var(--c-sep)',
    }}>
      {/* ── Row 1 — Window pill · rules chip · Now pill ──────────────────── */}
      {/* Cashflow passes showWindowRow={false}: this row's tax-year selector +
          rules chip + NOW duplicate the global header's TAX YEAR control
          (founder 2026-06-04 — "one is duplicated"). */}
      {showWindowRow && (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, minHeight: 30,
      }}>
        {/* "Viewing" eyebrow — names this control as the projection viewpoint
            (HORIZON), distinct from the RULES year. Founder 2026-06-08. */}
        <span className="sw-eyebrow" style={{ fontSize: 10, letterSpacing: 0.5, color: 'var(--c-text3)' }}>
          Viewing
        </span>
        {/* Window pill — refined ghost chip with chevron */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setOpen(o => !o)}
            aria-haspopup="listbox"
            aria-expanded={open}
            title="HORIZON — where in time you're looking (a projection viewpoint). Does not change which year's tax law applies; that's the RULES year."
            className="sw-chip"
            style={{
              padding: '5px 10px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 11, opacity: 0.7 }}>◷</span>
            {current.label}
            <span style={{ fontSize: 9, opacity: 0.6 }}>{open ? '▲' : '▼'}</span>
          </button>

          {open && (
            <>
              <div
                onClick={() => setOpen(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 99 }}
              />
              <div
                role="listbox"
                style={{
                  position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                  minWidth: 240, zIndex: 100,
                  background: 'var(--c-surface)',
                  border: '1px solid var(--c-border)',
                  borderRadius: 14,
                  boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
                  overflow: 'hidden',
                }}
              >
                {TIME_WINDOWS.map((w, i) => {
                  const active = w.id === windowState
                  return (
                    <button
                      key={w.id}
                      role="option"
                      aria-selected={active}
                      onClick={() => pickWindow(w)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        width: '100%', padding: '10px 14px',
                        background: active ? 'var(--c-acc-bg)' : 'transparent',
                        border: 'none',
                        borderBottom: i === TIME_WINDOWS.length - 1 ? 'none' : '1px solid var(--c-sep)',
                        color: active ? 'var(--c-acc)' : 'var(--c-text)',
                        fontSize: 'var(--fs-body)', fontWeight: active ? 700 : 500,
                        cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <span>{w.full}</span>
                      {active && <span style={{ fontSize: 14 }}>✓</span>}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* spacer */}
        <div style={{ flex: 1 }} />

        {/* Rules-version chip — human-readable label, technical version in tooltip */}
        {/* V-7 fix (2026-05-28): label reflects the selected window. Prior
            version always rendered "UK tax 2026/27" regardless of whether the
            user picked Next year / 5y / etc. — that contradicted the window
            chip ("Next year") sitting right next to it. Now the chip slides
            forward/back with the selected tax year. */}
        {(() => {
          // Accept 2-part ("UK-2026.1") AND 3-part build ids ("UK-2026.1.1" =
          // TAX.ver). Without the optional 3rd segment a build id fails the match
          // and falls through to rendering the raw internal version (founder
          // 2026-06-08 — no internal rules-bundle code may surface to users).
          const m = rulesVersion?.match(/^UK-(\d{4})\.(\d+)(?:\.\d+)?$/)
          const baseYear = m ? +m[1] : null
          // Shift the displayed tax year by the window's `years` offset.
          // For multi-year horizons (5y/10y/20y/Lifetime) keep the base
          // engine-version year — those modes are projections, not single TYs.
          const displayYear =
            baseYear != null && Math.abs(current.years) === Math.abs(current.years) && Math.abs(current.years) <= 1
              ? baseYear + (current.years || 0)
              : baseYear
          const label = displayYear != null
            ? `UK tax ${displayYear}/${String(displayYear + 1).slice(-2)}`
            : rulesVersion
          const tip = current.years === 0
            ? `Current UK tax rules and allowances (${rulesVersion}) · Last verified: ${dataDate} · Tap any value to see what rules apply`
            : `Projected against the ${current.full.toLowerCase()} — engine version ${rulesVersion}. Future-year figures are extrapolated.`
          return (
            <span title={tip} className="sw-chip sw-chip-sm" style={{ letterSpacing: 0.3, cursor: 'help' }}>
              {label}
            </span>
          )
        })()}

        {/* [Now] pill — X28 invariant marker; mint outline, refined.
            V-7 fix (2026-05-28): hide the pill entirely when the user has
            selected a non-current window. Showing "NOW" while the chip says
            "Next year" contradicts itself — the pill is a *snap-to-now*
            affordance and a *current-state* marker, both of which become
            meaningless once the window is in the future or past. */}
        {showNowPill && current.direction === 'now' && (
          <button
            onClick={onNowTap}
            disabled={nowDimmed}
            aria-label={nowDimmed ? 'Now (dimmed in Plan / Scenario)' : 'Snap to now'}
            className={`sw-chip sw-chip-sm ${nowDimmed ? '' : 'sw-chip-mint sw-chip-outline'}`}
            style={{
              opacity: nowDimmed ? 0.45 : 1,
              cursor: nowDimmed ? 'default' : (onNowTap ? 'pointer' : 'default'),
              letterSpacing: 0.6,
              fontWeight: 700,
            }}
          >
            NOW
          </button>
        )}
      </div>
      )}

      {/* ── Row 2 — 4-mode ghost-tab toggle (subtle pale active state) ──── */}
      <div
        role="tablist"
        aria-label="View mode"
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
          gap: 2,
        }}
      >
        {/* Sliding indicator — pale tinted bg, no border, subtle */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0, bottom: 0,
            left: 0,
            width: `calc(100% / ${Math.max(1, tabs.length)})`,
            transform: `translateX(${Math.max(0, activeIdx) * 100}%)`,
            opacity: activeIdx < 0 ? 0 : 1, // no highlight when nothing is active (e.g. Choices-only bar, not toggled)
            background: 'var(--c-tint-neutral-2)',
            borderRadius: 'var(--r-md)',
            transition: 'transform var(--dur-normal, 350ms) var(--ease-out-cubic, cubic-bezier(0.33,1,0.68,1))',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
        {tabs.map(m => {
          const isDecisions = m.id === '__decisions'
          const active = isDecisions ? decisionsActive : (!decisionsActive && m.id === modeState)
          return (
            <button
              key={m.id}
              role="tab"
              aria-selected={active}
              onClick={() => {
                if (isDecisions) return onDecisions?.()
                if (m.id !== modeState) return pickMode(m)
                // Same view-mode tapped while Decisions is active → exit Decisions
                // (pickMode early-returns on unchanged mode, so signal directly).
                if (decisionsActive) onViewModeChange?.(m.id)
              }}
              className={`sw-tab-ghost${active ? ' is-active' : ''}`}
              style={{
                position: 'relative',
                zIndex: 1,
                background: 'transparent',
                padding: '7px 8px',
                fontSize: 13,
                fontWeight: isDecisions ? 700 : undefined,
                color: isDecisions && !active ? 'var(--c-acc)' : undefined,
              }}
            >
              {m.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Demo (commented out — uncomment to mount in a screen for visual check):
//
// export function X28TopBarDemo() {
//   const [w, setW] = useState('calendar-year')
//   const [m, setM] = useState('actual')
//   return (
//     <X28TopBar
//       window={w} viewMode={m}
//       onWindowChange={setW} onViewModeChange={setM}
//     />
//   )
// }
// ──────────────────────────────────────────────────────────────────────────────
