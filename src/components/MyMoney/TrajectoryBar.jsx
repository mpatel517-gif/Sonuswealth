// TrajectoryBar.jsx — Pattern A temporal primitive (founder 2026-06-01).
// One horizontal bar carries Now / Future / Plan as VISIBLE LENGTHS, not three
// competing numbers: solid = Now, faint extension = Future drift (autopilot
// growth to the horizon), accent tip = Plan boost (committed scenario deltas).
// The active lens just changes which length is emphasised; tap reveals the exact
// 3-way readout. Pure SVG/markup, no engine calls — caller passes the three
// values (computed once from projection.js so the inline what-if can't diverge).
import { useState } from 'react'

const fmt = (n) => {
  const a = Math.abs(Math.round(+n || 0))
  if (a >= 1e6) return `£${(a / 1e6).toFixed(2)}m`
  if (a >= 1e3) return `£${(a / 1e3).toFixed(0)}k`
  return `£${a.toLocaleString('en-GB')}`
}

export function TrajectoryBar({ now = 0, future = null, plan = null, active = 'now', horizonLabel = '', height = 10 }) {
  const [open, setOpen] = useState(false)
  const f = future == null ? now : Math.max(0, +future)
  const p = plan == null ? f : Math.max(f, +plan)         // plan never below future
  const n = Math.max(0, +now)
  const max = Math.max(n, f, p, 1)
  const pct = (v) => `${(v / max) * 100}%`

  const driftLen = Math.max(0, f - n)
  const planLen = Math.max(0, p - f)
  const hasFuture = driftLen > 0
  const hasPlan = planLen > 0

  // Active lens → which value is the headline length emphasised (border ring).
  const activeVal = active === 'plan' ? p : active === 'future' ? f : n

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
      aria-label="Now, future and plan — tap for exact figures"
      style={{ display: 'block', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
    >
      <div style={{ display: 'flex', height, borderRadius: 100, overflow: 'hidden', background: 'var(--c-surface2,rgba(255,255,255,0.06))' }}>
        {/* Now — solid */}
        <div style={{ width: pct(n), background: 'var(--c-acc,#5ddbc2)', opacity: active === 'now' ? 1 : 0.92 }} />
        {/* Future drift — faint extension */}
        {hasFuture && <div style={{ width: pct(driftLen), background: 'var(--c-acc,#5ddbc2)', opacity: 0.34 }} />}
        {/* Plan boost — accent tip */}
        {hasPlan && <div style={{ width: pct(planLen), background: 'var(--c-gold,#E8B84B)', opacity: 0.85 }} />}
      </div>

      {open ? (
        <div style={{ display: 'flex', gap: 10, marginTop: 5, fontSize: 10, color: 'var(--c-text2)', flexWrap: 'wrap', fontVariantNumeric: 'tabular-nums' }}>
          <span><span style={{ color: 'var(--c-acc,#5ddbc2)', fontWeight: 800 }}>Now</span> {fmt(n)}</span>
          {hasFuture && <span><span style={{ color: 'var(--c-text3)', fontWeight: 800 }}>Future</span> {fmt(f)}</span>}
          {hasPlan && <span><span style={{ color: 'var(--c-gold,#E8B84B)', fontWeight: 800 }}>Plan</span> {fmt(p)}</span>}
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 9, color: 'var(--c-text3)', letterSpacing: 0.3 }}>
          <span>now</span>
          {hasFuture && <span>{horizonLabel || 'future'}{hasPlan ? '' : ` ${fmt(f)}`}</span>}
          {hasPlan && <span style={{ color: 'var(--c-gold,#E8B84B)' }}>plan {fmt(p)}</span>}
        </div>
      )}
    </button>
  )
}
