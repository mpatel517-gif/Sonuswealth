// InteractiveProjection.jsx — the projection becomes a CONTROL, not a picture.
// Drag the growth rate, toggle today's-money vs future-pounds, and the curve +
// the "value at retirement" readout move live. Ghost line = your baseline
// assumption, so every drag is framed against it. Reuses projectSeries.
import { useState, useMemo } from 'react'
import { projectSeries } from '../../../engine/projection.js'

const fmt = (n) => {
  const a = Math.abs(Math.round(+n || 0))
  if (a >= 1e6) return `£${(a / 1e6).toFixed(2)}m`
  if (a >= 1e3) return `£${(a / 1e3).toFixed(0)}k`
  return `£${a.toLocaleString('en-GB')}`
}

export function InteractiveProjection({ now = 0, baselineRate = 0.05, inflation = 0.025, years = 10, retirementAge = 67, onOpenAssumptions }) {
  const [rate, setRate] = useState(baselineRate)
  const [real, setReal] = useState(false)

  const effRate = real ? Math.max(0, rate - inflation) : rate
  const baseEff = real ? Math.max(0, baselineRate - inflation) : baselineRate
  const series = useMemo(() => projectSeries(now, effRate, years), [now, effRate, years])
  const baseSeries = useMemo(() => projectSeries(now, baseEff, years), [now, baseEff, years])

  const end = series[series.length - 1] || now
  const baseEnd = baseSeries[baseSeries.length - 1] || now
  const delta = end - baseEnd
  const moved = Math.abs(rate - baselineRate) > 1e-9

  // Geometry — share a y-scale across both lines so they're comparable.
  const W = 300, H = 120, pad = 8
  const all = [...series, ...baseSeries]
  const mn = Math.min(...all), mx = Math.max(...all), span = mx - mn || 1
  const xAt = (i, len) => pad + (len <= 1 ? 0 : (i / (len - 1)) * (W - 2 * pad))
  const yAt = (v) => H - pad - ((v - mn) / span) * (H - 2 * pad)
  const poly = (s) => s.map((v, i) => `${xAt(i, s.length).toFixed(1)},${yAt(v).toFixed(1)}`).join(' ')
  const areaPts = `${pad},${(H - pad).toFixed(1)} ${poly(series)} ${(W - pad).toFixed(1)},${(H - pad).toFixed(1)}`
  const endX = xAt(series.length - 1, series.length), endY = yAt(end)

  return (
    <div style={{ background: 'var(--c-surface,rgba(255,255,255,0.04))', borderRadius: 'var(--r-lg,14px)', padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 }}>
        <div>
          <div className="sw-eyebrow">PROJECTED VALUE AT AGE {retirementAge}</div>
          <div style={{ fontSize: 'var(--fs-hero,30px)', fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{fmt(end)}</div>
        </div>
        {moved && (
          <div style={{ fontSize: 12, fontWeight: 700, color: delta >= 0 ? 'var(--c-good,#5DDBA8)' : 'var(--c-coral,#FF6F7D)', fontVariantNumeric: 'tabular-nums' }}>
            {delta >= 0 ? '+' : '−'}{fmt(delta)}<span style={{ fontSize: 9, color: 'var(--c-text3)', fontWeight: 500 }}> vs baseline</span>
          </div>
        )}
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="interactive projection" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="ip-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--c-acc,#5ddbc2)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--c-acc,#5ddbc2)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* baseline ghost */}
        <polyline fill="none" stroke="var(--c-text3,#8895a7)" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.6" points={poly(baseSeries)} />
        {/* current */}
        <polygon fill="url(#ip-fill)" points={areaPts} />
        <polyline fill="none" stroke="var(--c-acc,#5ddbc2)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={poly(series)} />
        <circle cx={endX} cy={endY} r="3.5" fill="var(--c-acc,#5ddbc2)" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--c-text3)', marginTop: -2 }}>
        <span>now · {fmt(now)}</span><span>age {retirementAge}</span>
      </div>

      {/* Growth control */}
      <div style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--c-text2)' }}>
          <span style={{ fontWeight: 600 }}>Growth assumption</span>
          <span style={{ fontWeight: 800, color: 'var(--c-acc,#5ddbc2)', fontVariantNumeric: 'tabular-nums' }}>{(rate * 100).toFixed(1)}% / yr</span>
        </div>
        <input type="range" min={1} max={12} step={0.1} value={(rate * 100).toFixed(1)} onChange={e => setRate(+e.target.value / 100)} style={{ width: '100%', marginTop: 6, accentColor: 'var(--c-acc,#5ddbc2)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--c-text3)' }}>baseline {(baselineRate * 100).toFixed(1)}%{moved ? ' · ' : ''}{moved && <button type="button" onClick={() => setRate(baselineRate)} style={{ background: 'none', border: 'none', color: 'var(--c-acc,#5ddbc2)', cursor: 'pointer', padding: 0, fontSize: 10 }}>reset</button>}</span>
          <button type="button" onClick={() => setReal(r => !r)} style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999, border: '1px solid var(--c-border,rgba(255,255,255,0.18))', background: real ? 'var(--c-acc,#5ddbc2)' : 'transparent', color: real ? '#06231f' : 'var(--c-text2)', cursor: 'pointer' }}>
            {real ? "Today's money" : 'Future pounds'}
          </button>
        </div>
      </div>

      <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 8 }}>
        Drag to test growth. {real ? `After ${(inflation * 100).toFixed(1)}% inflation. ` : ''}Assumption, not a forecast.{onOpenAssumptions && <> <button type="button" onClick={onOpenAssumptions} style={{ background: 'none', border: 'none', color: 'var(--c-acc,#5ddbc2)', cursor: 'pointer', padding: 0, fontSize: 10 }}>Set all assumptions →</button></>}
      </div>
    </div>
  )
}
