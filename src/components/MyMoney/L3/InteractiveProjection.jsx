// InteractiveProjection.jsx — the projection as a CONTROL, made compliant.
// The future is uncertain, so we never draw one confident line: we show a
// low/mid/high BAND and frame the number as the user's own assumption, not a
// forecast (FCA: clear/fair/not-misleading; Consumer Duty: no false certainty).
// Real-terms is the DEFAULT — a near-retiree should see today's-money first.
// Growth is bounded to a defensible band so the headline can't be dialled to a
// flattering fiction. Assumptions are adjusted IN CONTEXT (this slider) — no
// yank to Settings.
import { useState, useMemo } from 'react'
import { projectSeries } from '../../../engine/projection.js'

const fmt = (n) => {
  const a = Math.abs(Math.round(+n || 0))
  if (a >= 1e6) return `£${(a / 1e6).toFixed(2)}m`
  if (a >= 1e3) return `£${(a / 1e3).toFixed(0)}k`
  return `£${a.toLocaleString('en-GB')}`
}

const MIN_RATE = 0.02, MAX_RATE = 0.07   // defensible band for a de-risking pot
const SPREAD = 0.02                       // ± around the chosen mid → low/high

export function InteractiveProjection({ now = 0, baselineRate = 0.05, inflation = 0.025, years = 10, retirementAge = 67, contributionPerYear = 0 }) {
  // Clamp the incoming assumption into the defensible band; default the slider to it.
  const clampedBaseline = Math.min(MAX_RATE, Math.max(MIN_RATE, baselineRate))
  const [rate, setRate] = useState(clampedBaseline)
  const [real, setReal] = useState(true)   // today's money by default

  const toEff = (r) => real ? Math.max(0, r - inflation) : r
  const mid = useMemo(() => projectSeries(now, toEff(rate), years, contributionPerYear), [now, rate, real, inflation, years, contributionPerYear])
  const low = useMemo(() => projectSeries(now, toEff(Math.max(0, rate - SPREAD)), years, contributionPerYear), [now, rate, real, inflation, years, contributionPerYear])
  const high = useMemo(() => projectSeries(now, toEff(Math.min(MAX_RATE + SPREAD, rate + SPREAD)), years, contributionPerYear), [now, rate, real, inflation, years, contributionPerYear])

  const endMid = mid[mid.length - 1] || now
  const endLow = low[low.length - 1] || now
  const endHigh = high[high.length - 1] || now

  // Geometry — shared y-scale; shaded band between low/high, mid line on top.
  const W = 300, H = 116, pad = 8
  const all = [...low, ...high]
  const mn = Math.min(...all), mx = Math.max(...all), span = mx - mn || 1
  const xAt = (i, len) => pad + (len <= 1 ? 0 : (i / (len - 1)) * (W - 2 * pad))
  const yAt = (v) => H - pad - ((v - mn) / span) * (H - 2 * pad)
  const pts = (s) => s.map((v, i) => `${xAt(i, s.length).toFixed(1)},${yAt(v).toFixed(1)}`)
  const bandPts = [...pts(high), ...pts(low).reverse()].join(' ')
  const endX = xAt(mid.length - 1, mid.length)

  return (
    <div style={{ background: 'var(--c-surface,rgba(255,255,255,0.04))', borderRadius: 'var(--r-lg,14px)', padding: 14 }}>
      <div className="sw-eyebrow">IF IT GREW AT {(rate * 100).toFixed(1)}% — VALUE AT AGE {retirementAge}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
        <div style={{ fontSize: 'var(--fs-hero,30px)', fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{fmt(endMid)}</div>
        <div style={{ fontSize: 12, color: 'var(--c-text3)', fontVariantNumeric: 'tabular-nums' }}>range {fmt(endLow)}–{fmt(endHigh)}</div>
      </div>
      <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 2 }}>{real ? "in today's money" : 'in future pounds'} · your assumption, not a forecast</div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="projection range" style={{ display: 'block', marginTop: 6 }}>
        <polygon points={bandPts} fill="color-mix(in srgb, var(--c-acc,#5ddbc2) 18%, transparent)" />
        <polyline fill="none" stroke="var(--c-acc,#5ddbc2)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={pts(mid).join(' ')} />
        <circle cx={endX} cy={yAt(endMid)} r="3.5" fill="var(--c-acc,#5ddbc2)" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--c-text3)', marginTop: -2 }}>
        <span>now · {fmt(now)}</span><span>age {retirementAge}</span>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--c-text2)' }}>
          <span style={{ fontWeight: 600 }}>Test a growth rate</span>
          <span style={{ fontWeight: 800, color: 'var(--c-acc,#5ddbc2)', fontVariantNumeric: 'tabular-nums' }}>{(rate * 100).toFixed(1)}% / yr</span>
        </div>
        <input type="range" min={MIN_RATE * 100} max={MAX_RATE * 100} step={0.1} value={(rate * 100).toFixed(1)} onChange={e => setRate(+e.target.value / 100)} style={{ width: '100%', marginTop: 6, accentColor: 'var(--c-acc,#5ddbc2)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--c-text3)' }}>{Math.round(MIN_RATE * 100)}–{Math.round(MAX_RATE * 100)}% · this pot's assumption {(clampedBaseline * 100).toFixed(1)}%</span>
          <button type="button" onClick={() => setReal(r => !r)} style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999, border: '1px solid var(--c-border,rgba(255,255,255,0.18))', background: real ? 'var(--c-acc,#5ddbc2)' : 'transparent', color: real ? '#06231f' : 'var(--c-text2)', cursor: 'pointer' }}>
            {real ? "Today's money" : 'Future pounds'}
          </button>
        </div>
      </div>

      <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 8 }}>
        An illustration based on a rate you choose — not a forecast or a promise. Real returns vary year to year and can fall. {real ? `Shown after ${(inflation * 100).toFixed(1)}% inflation. ` : ''}Income planning lives on Cashflow.
      </div>
    </div>
  )
}
