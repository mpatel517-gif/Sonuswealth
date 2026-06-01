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

export function TrajectoryBar({ now = 0, future = null, plan = null, active = 'now', height = 7, invert = false, interactive = true }) {
  const [open, setOpen] = useState(false)

  // When embedded inside another tappable element (e.g. a pension PotRow's
  // row <button>), render the wrapper as a <div>, not a <button> — a button
  // nested in a button is invalid HTML and throws a React hydration error
  // (audit 2026-06-01). Standalone callers keep the interactive expand.
  const wrapStyle = { display: 'block', width: '100%', background: 'none', border: 'none', padding: 0, cursor: interactive ? 'pointer' : 'default', textAlign: 'left' }
  const toggle = (e) => { e.stopPropagation(); setOpen(o => !o) }

  // Liability mode: the balance SHRINKS (now ≥ future ≥ plan). Lower is better,
  // so the headline reads in accent-green and the bar shows how much gets cleared.
  // Segments L→R: [coral = still owed at plan][gold = extra cleared by plan]
  // [faint green = cleared on the current schedule]. Total width = now.
  if (invert) {
    const n = Math.max(0, +now)
    const f = future == null ? n : Math.min(n, Math.max(0, +future))
    const p = plan == null ? f : Math.min(f, Math.max(0, +plan))
    const max = Math.max(n, 1)
    const pc = (v) => `${(v / max) * 100}%`
    const remaining = p
    const clearedByPlan = Math.max(0, f - p)
    const clearedBySchedule = Math.max(0, n - f)
    const tip = (plan != null && p < f) ? p : f
    const inner = (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, display: 'flex', height, borderRadius: 100, overflow: 'hidden', background: 'var(--c-surface2,rgba(255,255,255,0.06))' }}>
            <div style={{ width: pc(remaining), background: 'var(--c-coral,#FF6F7D)', opacity: active === 'now' ? 1 : 0.92 }} />
            {clearedByPlan > 0 && <div style={{ width: pc(clearedByPlan), background: 'var(--c-gold,#E8B84B)', opacity: 0.85 }} />}
            {clearedBySchedule > 0 && <div style={{ width: pc(clearedBySchedule), background: 'var(--c-acc,#5ddbc2)', opacity: active === 'future' ? 0.5 : 0.32 }} />}
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: (clearedBySchedule > 0 || clearedByPlan > 0) ? 'var(--c-acc,#5ddbc2)' : 'var(--c-text3)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>→ {fmt(tip)}</span>
        </div>
        {open && (
          <div style={{ display: 'flex', gap: 10, marginTop: 5, fontSize: 10, color: 'var(--c-text2)', flexWrap: 'wrap', fontVariantNumeric: 'tabular-nums' }}>
            <span><span style={{ color: 'var(--c-coral,#FF6F7D)', fontWeight: 800 }}>Now</span> {fmt(n)}</span>
            {clearedBySchedule > 0 && <span><span style={{ color: 'var(--c-text3)', fontWeight: 800 }}>Future</span> {fmt(f)}</span>}
            {clearedByPlan > 0 && <span><span style={{ color: 'var(--c-acc,#5ddbc2)', fontWeight: 800 }}>Plan</span> {fmt(p)}</span>}
          </div>
        )}
      </>
    )
    return interactive
      ? <button type="button" onClick={toggle} aria-label="Now, future and plan balance — tap for exact figures" style={wrapStyle}>{inner}</button>
      : <div style={wrapStyle}>{inner}</div>
  }

  const n = Math.max(0, +now)
  const f = future == null ? n : Math.max(0, +future)
  // Plan is NOT clamped to future: a committed decision can LOWER a category
  // (sell / gift removes the asset). Up → gold tip; down → coral tip + a "given
  // up vs future" coral segment, so downside plans are honestly visible, not
  // hidden (founder 2026-06-01: a planned sale must show on the tile).
  const p = plan == null ? f : Math.max(0, +plan)
  const planUp = p > f + 1
  const planDown = p < f - 1
  const max = Math.max(n, f, p, 1)
  const pct = (v) => `${(v / max) * 100}%`
  // Drift kept vs cut: when the plan lowers the end value, only the part up to
  // the plan endpoint is "kept" drift; the remainder to future is shown coral.
  const keptDrift = planDown ? Math.max(0, Math.min(f, p) - n) : Math.max(0, f - n)
  const cutLen = planDown ? Math.max(0, f - Math.max(n, p)) : 0
  const planLen = planUp ? (p - f) : 0
  const tip = planUp ? p : (planDown ? p : f)
  const tipColor = planUp ? 'var(--c-gold,#E8B84B)' : (planDown ? 'var(--c-coral,#FF6F7D)' : 'var(--c-text3)')

  const inner = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, display: 'flex', height, borderRadius: 100, overflow: 'hidden', background: 'var(--c-surface2,rgba(255,255,255,0.06))' }}>
          <div style={{ width: pct(Math.min(n, planDown ? p : n)), background: 'var(--c-acc,#5ddbc2)', opacity: active === 'now' ? 1 : 0.92 }} />
          {keptDrift > 0 && <div style={{ width: pct(keptDrift), background: 'var(--c-acc,#5ddbc2)', opacity: active === 'future' ? 0.55 : 0.34 }} />}
          {cutLen > 0 && <div style={{ width: pct(cutLen), background: 'var(--c-coral,#FF6F7D)', opacity: 0.7 }} />}
          {planLen > 0 && <div style={{ width: pct(planLen), background: 'var(--c-gold,#E8B84B)', opacity: 0.85 }} />}
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: tipColor, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>→ {fmt(tip)}</span>
      </div>
      {open && (
        <div style={{ display: 'flex', gap: 10, marginTop: 5, fontSize: 10, color: 'var(--c-text2)', flexWrap: 'wrap', fontVariantNumeric: 'tabular-nums' }}>
          <span><span style={{ color: 'var(--c-acc,#5ddbc2)', fontWeight: 800 }}>Now</span> {fmt(n)}</span>
          {Math.abs(f - n) > 1 && <span><span style={{ color: 'var(--c-text3)', fontWeight: 800 }}>Future</span> {fmt(f)}</span>}
          {(planUp || planDown) && <span><span style={{ color: tipColor, fontWeight: 800 }}>Plan</span> {fmt(p)}</span>}
        </div>
      )}
    </>
  )
  return interactive
    ? <button type="button" onClick={toggle} aria-label="Now, future and plan — tap for exact figures" style={wrapStyle}>{inner}</button>
    : <div style={wrapStyle}>{inner}</div>
}
