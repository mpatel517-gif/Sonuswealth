// TrajectoryBar.jsx — Pattern A temporal primitive (founder 2026-06-01).
// COMPACT: one line — a thin bar (Now solid · Future drift faint · Plan tip gold)
// plus the future figure inline. No "now/future" word row (it ate vertical space
// — founder: "place it after the value"). Tap expands to the exact 3-way readout.
// Pure markup; caller passes the three values (computed once from projection.js
// so the inline what-if can't diverge).
import { useState } from 'react'

const fmt = (n) => {
  const a = Math.abs(Math.round(+n || 0))
  if (a >= 1e6) return `£${(a / 1e6).toFixed(2)}m`
  if (a >= 1e3) return `£${(a / 1e3).toFixed(0)}k`
  return `£${a.toLocaleString('en-GB')}`
}

export function TrajectoryBar({ now = 0, future = null, plan = null, active = 'now', height = 7 }) {
  const [open, setOpen] = useState(false)
  const n = Math.max(0, +now)
  const f = future == null ? n : Math.max(0, +future)
  const p = plan == null ? f : Math.max(f, +plan)
  const max = Math.max(n, f, p, 1)
  const pct = (v) => `${(v / max) * 100}%`
  const driftLen = Math.max(0, f - n)
  const planLen = Math.max(0, p - f)
  const tip = p > f ? p : f                              // the "→ X" headline is plan if it adds, else future

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
      aria-label="Now, future and plan — tap for exact figures"
      style={{ display: 'block', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, display: 'flex', height, borderRadius: 100, overflow: 'hidden', background: 'var(--c-surface2,rgba(255,255,255,0.06))' }}>
          <div style={{ width: pct(n), background: 'var(--c-acc,#5ddbc2)', opacity: active === 'now' ? 1 : 0.92 }} />
          {driftLen > 0 && <div style={{ width: pct(driftLen), background: 'var(--c-acc,#5ddbc2)', opacity: active === 'future' ? 0.55 : 0.34 }} />}
          {planLen > 0 && <div style={{ width: pct(planLen), background: 'var(--c-gold,#E8B84B)', opacity: 0.85 }} />}
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: planLen > 0 ? 'var(--c-gold,#E8B84B)' : 'var(--c-text3)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>→ {fmt(tip)}</span>
      </div>
      {open && (
        <div style={{ display: 'flex', gap: 10, marginTop: 5, fontSize: 10, color: 'var(--c-text2)', flexWrap: 'wrap', fontVariantNumeric: 'tabular-nums' }}>
          <span><span style={{ color: 'var(--c-acc,#5ddbc2)', fontWeight: 800 }}>Now</span> {fmt(n)}</span>
          {driftLen > 0 && <span><span style={{ color: 'var(--c-text3)', fontWeight: 800 }}>Future</span> {fmt(f)}</span>}
          {planLen > 0 && <span><span style={{ color: 'var(--c-gold,#E8B84B)', fontWeight: 800 }}>Plan</span> {fmt(p)}</span>}
        </div>
      )}
    </button>
  )
}
