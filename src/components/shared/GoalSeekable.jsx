// ─────────────────────────────────────────────────────────────────────────────
// GoalSeekable — wraps any numeric metric in forecast/plan/scenario modes.
// Long-press → "What if this were different?" slider opens.
// On commit → calls goalSeek() and surfaces ranked paths in a slide-over.
//
// Greys out on `mode === 'actual'` — actuals are immutable past values.
//
// Props:
//   metric    string  — canonical metric name
//   current   number  — current value (the starting point for the slider)
//   mode      string  — 'actual' | 'forecast' | 'plan' | 'scenario'
//   unit      string  — 'gbp' | 'pct' | 'score' | 'count'  (for slider display)
//   step      number  — slider increment
//   onCommit  fn(path) — user picked a path → caller applies via rippleEffect
//   children  any
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef } from 'react'
import { goalSeekSync } from '../../engine/goal-seek-engine.js'
import { ALIAS } from '../../copy/plain-english.js'

const LONG_PRESS_MS = 450

export default function GoalSeekable({
  metric, current, mode = 'forecast',
  unit = 'gbp', step,
  onCommit,
  children,
}) {
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState(current ?? 0)
  const [paths, setPaths] = useState(null)
  const pressTimer = useRef(null)
  const greyed = mode === 'actual'

  function startPress() {
    if (greyed) return
    pressTimer.current = setTimeout(() => {
      setTarget(current ?? 0)
      setPaths(null)
      setOpen(true)
    }, LONG_PRESS_MS)
  }
  function endPress() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }

  function runGoalSeek() {
    const result = goalSeekSync(null, metric, Number(target), null)
    setPaths(Array.isArray(result) ? result : [])
  }

  function commitPath(path) {
    setOpen(false)
    setPaths(null)
    onCommit?.(path)
  }

  return (
    <>
      <span
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        onContextMenu={(e) => {
          if (greyed) return
          e.preventDefault()
          setTarget(current ?? 0)
          setOpen(true)
        }}
        style={{
          display: 'inline',
          cursor: greyed ? 'default' : 'help',
          opacity: greyed ? 0.6 : 1,
          touchAction: 'manipulation',
        }}
        title={greyed
          ? 'Actuals are immutable — try Forecast, Plan, or Scenario.'
          : 'Hold to ask "what if this were different?"'}
      >
        {children}
      </span>

      {open && (
        <div className="sheet-overlay">
          <div className="sheet-backdrop" onClick={() => setOpen(false)} />
          <div className="sheet-panel" style={{ maxHeight: '85vh' }}>
            <div className="sheet-handle" />
            <div className="sw-eyebrow" style={{ marginBottom: 8 }}>
              What if {(ALIAS?.[metric]) || metric} were different?
            </div>

            {!paths && (
              <>
                <div style={{ fontSize: 14, color: 'var(--c-text2)', lineHeight: 1.5, marginBottom: 16 }}>
                  Current: <strong style={{ color: 'var(--c-text)' }}>{format(current, unit)}</strong>
                </div>
                <input
                  type="range"
                  min={Math.max(0, (current ?? 0) * 0.4)}
                  max={(current ?? 0) * 1.8 || 100000}
                  step={step ?? Math.max(1, Math.round((current ?? 0) * 0.01))}
                  value={target}
                  onChange={(e) => setTarget(Number(e.target.value))}
                  style={{ width: '100%' }}
                  aria-label={`Target ${metric}`}
                />
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--c-acc)', marginTop: 8 }}>
                  {format(target, unit)}
                </div>
                <button
                  onClick={runGoalSeek}
                  className="sw-press"
                  style={{
                    marginTop: 16, width: '100%', padding: '12px 20px',
                    background: 'var(--c-acc)', color: 'var(--c-on-accent, #06120f)',
                    border: 'none', borderRadius: 12,
                    fontSize: 14, fontWeight: 800, cursor: 'pointer',
                  }}
                >
                  Show me what changes
                </button>
              </>
            )}

            {paths && (
              <>
                <div style={{ fontSize: 13, color: 'var(--c-text2)', marginBottom: 12, lineHeight: 1.5 }}>
                  Three paths to reach <strong style={{ color: 'var(--c-text)' }}>{format(target, unit)}</strong>.
                  Tap one to commit.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {paths.map(p => (
                    <button
                      key={p.id}
                      onClick={() => commitPath(p)}
                      className="sw-tile sw-tile-interactive"
                      style={{ textAlign: 'left', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--c-text)' }}>
                          {p.name}
                        </div>
                        <span className="sw-chip sw-chip-sm sw-chip-mint">
                          {Math.round((p.feasibility ?? 0) * 100)}% feasible
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.5 }}>
                        {p.explanation}
                      </div>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setPaths(null)}
                  style={{
                    marginTop: 12, width: '100%', padding: '8px',
                    background: 'transparent', color: 'var(--c-text3)',
                    border: '1px solid var(--c-border)', borderRadius: 8,
                    fontSize: 12, cursor: 'pointer',
                  }}
                >
                  Try a different target
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function format(v, unit) {
  if (unit === 'pct') return `${(v || 0).toFixed(1)}%`
  if (unit === 'score') return Math.round(v || 0)
  if (unit === 'count') return v || 0
  return `£${Math.round(v || 0).toLocaleString()}`
}
