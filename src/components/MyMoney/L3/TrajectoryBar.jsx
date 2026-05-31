// TrajectoryBar.jsx — Pattern A bar (#18). One bar encodes Now/Future/Plan by
// length + shade. Big number = active lens; the other two are small ghosts.
// Geometry is the pure trajectorySegments() helper so this file stays
// presentational. Placed on every taxonomy node row + drill leaf.

import { trajectorySegments } from './trajectory-geometry.js'

const fmt = (n) => {
  const a = Math.abs(Math.round(+n || 0)), s = (+n || 0) < 0 ? '−' : ''
  if (a >= 1e6) return `${s}£${(a / 1e6).toFixed(2)}m`
  if (a >= 1e3) return `${s}£${(a / 1e3).toFixed(0)}k`
  return `${s}£${a.toLocaleString()}`
}

export function TrajectoryBar({ now, future, plan, direction = 'grow', activeMode = 'actual', horizonLabel, onExpand }) {
  const seg = trajectorySegments(now, future, plan, direction)
  const big = activeMode === 'forecast' ? future : activeMode === 'plan' ? plan : now
  const shrink = direction === 'shrink'

  return (
    <button
      type="button"
      onClick={onExpand}
      className="sw-press"
      data-trajectory-bar={direction}
      style={{
        display: 'block', width: '100%', textAlign: 'left', background: 'transparent',
        border: 'none', padding: '6px 0', cursor: onExpand ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontSize: 'var(--fs-body,15px)', fontWeight: 700, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>
          {fmt(big)}
        </span>
        <span style={{ fontSize: 10, color: 'var(--c-text3)', fontVariantNumeric: 'tabular-nums' }}>
          {fmt(now)} · {fmt(future)} · {fmt(plan)}
        </span>
      </div>
      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--c-surface2,rgba(255,255,255,0.06))' }}>
        {shrink ? (
          <>
            {/* remaining-under-plan (good = small) then the extra the plan clears */}
            <div style={{ width: `${seg.remainingPct}%`, background: 'var(--c-coral,#FF6F7D)' }} />
            <div style={{ width: `${seg.planPct}%`, background: 'var(--c-good,#5DDBA8)' }} />
          </>
        ) : (
          <>
            <div style={{ width: `${seg.nowPct}%`, background: 'var(--c-acc,#5ddbc2)' }} />
            <div style={{ width: `${seg.futurePct}%`, background: 'color-mix(in srgb, var(--c-acc,#5ddbc2) 45%, transparent)' }} />
            <div style={{ width: `${seg.planPct}%`, background: 'var(--c-good,#5DDBA8)' }} />
          </>
        )}
      </div>
      {horizonLabel && (
        <div style={{ fontSize: 9, color: 'var(--c-text3)', marginTop: 3 }}>
          {shrink ? 'now → paid down' : 'now → future → plan'} · {horizonLabel}
        </div>
      )}
    </button>
  )
}
