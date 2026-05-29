// ─────────────────────────────────────────────────────────────────────────────
// DrillStack — reusable L4-panel stack manager (L3-1, 2026-05-28)
//
// Founder pushback: "drilldowns are weak they dont go to another level —
// they stay at a particular level". L4 primitives (DrillableNumber,
// L4NumberPanel) already existed in src/components/MyMoney/L3/ but no
// production drill wired them up. This component closes that gap.
//
// Pattern:
//   1. A drill screen (e.g. PensionDrillDown) wraps its content with
//      <DrillStack>. The stack manages a list of L4 panels.
//   2. Inside the drill, any displayed number can become drillable by
//      wrapping it with the `<L4Drillable>` primitive (or by using
//      DrillableNumber directly with the `pushPanel` callback from
//      `useDrillStack()`).
//   3. When the user taps a drillable number, an L4 panel slides in on
//      top of the L3 content. The user can stack further drills, or
//      dismiss back through them.
//   4. The browser-back / escape / breadcrumb path all pop ONE panel; they
//      don't dismiss the whole drill unless the stack is empty.
//
// Why a stack rather than a single L4 overlay:
//   - Inside an L4 detail panel ("how is my pension total calculated"), a
//     user may want to drill further ("show me Aviva contributions over
//     time"). The spec allows two levels of nesting before "open in a
//     new full screen" becomes the right pattern.
//
// API:
//   const stack = useDrillStack()
//   <DrillStack stack={stack}>
//     <YourL3Content
//       onDrillNumber={stack.pushNumber}   // shorthand for pushPanel({ type:'number', ... })
//       onDrillChart={stack.pushChart}
//     />
//   </DrillStack>
//
// Or via context:
//   <DrillStackProvider>
//     <YourL3Content />
//   </DrillStackProvider>
//
//   // inside any descendant:
//   const { pushNumber } = useDrillStackContext()
//   <DrillableNumber metric="Pension total" onDrill={pushNumber} ... />
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { L4NumberPanel } from './L4NumberPanel.jsx'
import { L4ChartPanel } from './L4ChartPanel.jsx'

// ── Stack state hook ────────────────────────────────────────────────────────
// Each entry: { kind: 'number'|'chart', props: {…panel props}, id }
export function useDrillStack() {
  const [panels, setPanels] = useState([])

  const pushPanel = useCallback((entry) => {
    setPanels((p) => [...p, { ...entry, id: `${entry?.props?.metric || 'drill'}-${p.length}-${Date.now()}` }])
  }, [])

  const pushNumber = useCallback((payload) => {
    // payload from DrillableNumber: { metric, value, formula, source, confidence, breakdown }
    pushPanel({ kind: 'number', props: payload })
  }, [pushPanel])

  const pushChart = useCallback((payload) => {
    pushPanel({ kind: 'chart', props: payload })
  }, [pushPanel])

  const pop = useCallback(() => {
    setPanels((p) => p.slice(0, -1))
  }, [])

  const clear = useCallback(() => setPanels([]), [])

  // Escape key — pops one panel if any are open. Doesn't dismiss the
  // outer L3 drill (the consumer's existing OverlayShell handles that).
  useEffect(() => {
    if (panels.length === 0) return
    function onKey(e) {
      if (e.key === 'Escape') {
        e.stopPropagation()    // prevent OverlayShell from also catching
        pop()
      }
    }
    window.addEventListener('keydown', onKey, true)  // capture phase to beat OverlayShell
    return () => window.removeEventListener('keydown', onKey, true)
  }, [panels.length, pop])

  return { panels, pushPanel, pushNumber, pushChart, pop, clear, depth: panels.length }
}

// ── Visual stack ────────────────────────────────────────────────────────────
// Renders panels above the L3 content with a slide-in animation. Only the
// topmost panel is interactive; lower ones are visually dimmed.
export function DrillStack({ stack, children }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {children}
      {stack.panels.map((entry, i) => {
        const isTop = i === stack.panels.length - 1
        const PanelComponent = entry.kind === 'chart' ? L4ChartPanel : L4NumberPanel
        return (
          <div
            key={entry.id}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'var(--c-bg, #0a0a0a)',
              zIndex: 100 + i,
              overflowY: 'auto',
              pointerEvents: isTop ? 'auto' : 'none',
              opacity: isTop ? 1 : 0.0,
              transform: isTop ? 'translateY(0)' : 'translateY(4px)',
              transition: 'opacity 180ms ease, transform 180ms ease',
            }}
            role="dialog"
            aria-modal="true"
            aria-label={entry.props?.metric || 'Detail'}
          >
            {/* Breadcrumb header — back chevron + breadcrumb trail */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 14px',
                borderBottom: '1px solid var(--c-border, #333)',
                position: 'sticky',
                top: 0,
                background: 'var(--c-bg, #0a0a0a)',
                zIndex: 1,
              }}
            >
              <button
                type="button"
                onClick={stack.pop}
                aria-label="Back"
                style={{
                  background: 'var(--c-surface2)',
                  border: '1px solid var(--c-border)',
                  borderRadius: 8,
                  padding: '4px 10px',
                  color: 'var(--c-text2)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                ←
              </button>
              <div style={{
                fontSize: 10,
                color: 'var(--c-text3)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontWeight: 700,
              }}>
                {stack.panels.map((p, j) => (
                  <span key={p.id}>
                    {p.props?.metric || 'Detail'}{j < stack.panels.length - 1 ? ' › ' : ''}
                  </span>
                ))}
              </div>
            </div>
            <PanelComponent {...entry.props} onBack={stack.pop} />
          </div>
        )
      })}
    </div>
  )
}

// ── Context API — preferred for deep trees ─────────────────────────────────
const DrillStackContext = createContext(null)

// onEdit (optional): a commit handler invoked by L4NumberPanel's leaf edit
// form with an ASSET_FIELD_CORRECTED payload { path, value, source,
// confidence, label, document? }. When absent, leaves render read-only (no
// edit control), so the stack is safe to mount anywhere.
export function DrillStackProvider({ children, onEdit }) {
  const stack = useDrillStack()
  const value = { ...stack, onEdit }
  return (
    <DrillStackContext.Provider value={value}>
      <DrillStack stack={stack}>{children}</DrillStack>
    </DrillStackContext.Provider>
  )
}

export function useDrillStackContext() {
  const ctx = useContext(DrillStackContext)
  if (!ctx) {
    // Safe no-op default — drillable numbers gracefully degrade to non-interactive
    // when no provider is mounted (e.g. when the drill is rendered standalone in
    // a unit test).
    return {
      panels: [],
      pushPanel: () => {},
      pushNumber: () => {},
      pushChart: () => {},
      pop: () => {},
      clear: () => {},
      depth: 0,
      onEdit: undefined,
    }
  }
  return ctx
}
