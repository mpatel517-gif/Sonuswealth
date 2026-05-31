// InteractiveProjection.jsx — lifecycle projection obeying the charting law:
// labelled axes; gross AND net drawn so the charge drag is VISIBLE; the
// retirement age is DRAGGABLE (the user moves when they retire and the curve
// recomputes); accumulate → draw down so it turns over, extended past
// retirement to where the money is used. Today's-money default; framed as the
// user's assumption, not a forecast.
import { useState, useMemo } from 'react'

const fmt = (n) => {
  const a = Math.abs(Math.round(+n || 0))
  if (a >= 1e6) return `£${(a / 1e6).toFixed(2)}m`
  if (a >= 1e3) return `£${(a / 1e3).toFixed(0)}k`
  return `£${a.toLocaleString('en-GB')}`
}

const MIN_RATE = 0.02, MAX_RATE = 0.07

function lifecycle(now, rate, currentAge, retireAge, terminalAge, contrib, drawdownRate) {
  const out = []
  let v = now
  for (let age = currentAge; age < retireAge; age++) { out.push({ age, v }); v = v * (1 + rate) + contrib }
  out.push({ age: retireAge, v })
  const wd = v * drawdownRate
  for (let age = retireAge + 1; age <= terminalAge; age++) { v = Math.max(0, v * (1 + rate) - wd); out.push({ age, v }) }
  return out.map(p => ({ age: p.age, v: Math.round(p.v) }))
}

const SCEN = [
  { key: 'low', d: -0.02, c: 'var(--c-text3,#8895a7)' },
  { key: 'mid', d: 0, c: 'var(--c-acc,#5ddbc2)' },
  { key: 'high', d: 0.02, c: 'var(--c-gold,#E8B84B)' },
]

export function InteractiveProjection({ now = 0, baselineRate = 0.05, charge = 0, inflation = 0.025, currentAge = 60, retirementAge = 67, terminalAge = 95, contributionPerYear = 0, drawdownRate = 0.04 }) {
  const clampedBaseline = Math.min(MAX_RATE, Math.max(MIN_RATE, baselineRate))
  const [rate, setRate] = useState(clampedBaseline)
  const [real, setReal] = useState(true)
  const [retire, setRetire] = useState(Math.min(75, Math.max(currentAge + 1, retirementAge)))

  const drag = charge + (real ? inflation : 0)               // what charges (+inflation) take off
  const netOf = (gross) => Math.max(-0.05, gross - drag)

  const series = useMemo(() => SCEN.map(s => {
    const gross = Math.max(0, rate + s.d)
    return { ...s, gross, net: netOf(gross), pts: lifecycle(now, netOf(gross), currentAge, retire, terminalAge, contributionPerYear, drawdownRate) }
  }), [now, rate, real, charge, inflation, currentAge, retire, terminalAge, contributionPerYear, drawdownRate])

  // Gross path for the mid rate — drawn faint so the gap to the net line shows the cost of charges.
  const grossMid = useMemo(() => lifecycle(now, Math.max(0, rate), currentAge, retire, terminalAge, contributionPerYear, drawdownRate), [now, rate, currentAge, retire, terminalAge, contributionPerYear, drawdownRate])

  const mid = series.find(s => s.key === 'mid')
  const peak = mid.pts.find(p => p.age === retire)?.v ?? now
  const atTerminal = mid.pts[mid.pts.length - 1]?.v ?? 0

  const W = 320, H = 150, L = 6, R = 6, T = 10, B = 18
  const ages = mid.pts.map(p => p.age)
  const minAge = ages[0], maxAge = ages[ages.length - 1]
  const allV = [...series.flatMap(s => s.pts.map(p => p.v)), ...grossMid.map(p => p.v)]
  const maxV = Math.max(...allV, 1)
  const xAt = (age) => L + ((age - minAge) / (maxAge - minAge || 1)) * (W - L - R)
  const yAt = (v) => T + (1 - v / maxV) * (H - T - B)
  const lineOf = (pts) => pts.map(p => `${xAt(p.age).toFixed(1)},${yAt(p.v).toFixed(1)}`).join(' ')
  const retX = xAt(retire)

  return (
    <div style={{ background: 'var(--c-surface,rgba(255,255,255,0.04))', borderRadius: 'var(--r-lg,14px)', padding: 14 }}>
      <div className="sw-eyebrow">PROJECTED PATH · {real ? "TODAY'S MONEY" : 'FUTURE POUNDS'}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 2, flexWrap: 'wrap' }}>
        <div><span style={{ fontSize: 'var(--fs-hero,26px)', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmt(peak)}</span><span style={{ fontSize: 11, color: 'var(--c-text3)' }}> peak at {retire}</span></div>
        <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>→ {fmt(atTerminal)} left at {terminalAge}, drawing {(drawdownRate * 100).toFixed(0)}%/yr</div>
      </div>
      <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 1 }}>mid line is net {(mid.net * 100).toFixed(1)}% — after {(charge * 100).toFixed(2)}% charges{real ? ` + ${(inflation * 100).toFixed(1)}% inflation` : ''}. Your assumption, not a forecast.</div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="lifecycle projection" style={{ display: 'block', marginTop: 6 }}>
        {[0, 0.5, 1].map(f => {
          const v = maxV * f, y = yAt(v)
          return <g key={f}><line x1={L} y1={y} x2={W - R} y2={y} stroke="var(--c-border,rgba(255,255,255,0.08))" strokeWidth="1" /><text x={L} y={y - 2} fontSize="7" fill="var(--c-text3,#8895a7)">{fmt(v)}</text></g>
        })}
        {/* draggable retirement divider */}
        <line x1={retX} y1={T} x2={retX} y2={H - B} stroke="var(--c-acc,#5ddbc2)" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.8" />
        <text x={retX + 2} y={T + 7} fontSize="7" fill="var(--c-acc,#5ddbc2)" fontWeight="700">retire {retire} ▸</text>
        {/* gross reference (before charges) — the gap to the net mid line is the cost of fees */}
        <polyline fill="none" stroke="var(--c-text3,#8895a7)" strokeWidth="1" strokeDasharray="2 2" opacity="0.7" points={lineOf(grossMid)} />
        {/* net scenario lines */}
        {series.map(s => <polyline key={s.key} fill="none" stroke={s.c} strokeWidth={s.key === 'mid' ? 2.2 : 1.3} strokeLinejoin="round" points={lineOf(s.pts)} opacity={s.key === 'mid' ? 1 : 0.8} />)}
        {[minAge, retire, maxAge].map(a => <text key={a} x={xAt(a)} y={H - 6} fontSize="7" fill="var(--c-text3,#8895a7)" textAnchor={a === minAge ? 'start' : a === maxAge ? 'end' : 'middle'}>age {a}</text>)}
      </svg>

      <div style={{ display: 'flex', gap: 10, fontSize: 10, color: 'var(--c-text2)', marginTop: 2, flexWrap: 'wrap' }}>
        {series.map(s => <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 9, height: 2, background: s.c, display: 'inline-block' }} />{(s.gross * 100).toFixed(1)}% gross → {(s.net * 100).toFixed(1)}% net</span>)}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--c-text3)' }}><span style={{ width: 9, height: 0, borderTop: '1px dashed var(--c-text3,#8895a7)', display: 'inline-block' }} />gross (before {real ? 'charges & inflation' : 'charges'})</span>
      </div>

      {/* Draggable retirement age */}
      <div style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--c-text2)' }}>
          <span style={{ fontWeight: 600 }}>Retire at</span>
          <span style={{ fontWeight: 800, color: 'var(--c-acc,#5ddbc2)' }}>age {retire}</span>
        </div>
        <input type="range" min={currentAge + 1} max={75} step={1} value={retire} onChange={e => setRetire(+e.target.value)} style={{ width: '100%', marginTop: 6, accentColor: 'var(--c-acc,#5ddbc2)' }} />
      </div>

      {/* Growth rate (moves the middle line; low/high track ±2%) */}
      <div style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--c-text2)' }}>
          <span style={{ fontWeight: 600 }}>Growth (middle line)</span>
          <span style={{ fontWeight: 800, color: 'var(--c-acc,#5ddbc2)', fontVariantNumeric: 'tabular-nums' }}>{(rate * 100).toFixed(1)}% gross</span>
        </div>
        <input type="range" min={MIN_RATE * 100} max={MAX_RATE * 100} step={0.1} value={(rate * 100).toFixed(1)} onChange={e => setRate(+e.target.value / 100)} style={{ width: '100%', marginTop: 6, accentColor: 'var(--c-acc,#5ddbc2)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--c-text3)' }}>{Math.round(MIN_RATE * 100)}–{Math.round(MAX_RATE * 100)}% · this pot's assumption {(clampedBaseline * 100).toFixed(1)}%</span>
          <button type="button" onClick={() => setReal(r => !r)} style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999, border: '1px solid var(--c-border,rgba(255,255,255,0.18))', background: real ? 'var(--c-acc,#5ddbc2)' : 'transparent', color: real ? '#06231f' : 'var(--c-text2)', cursor: 'pointer' }}>{real ? "Today's money" : 'Future pounds'}</button>
        </div>
      </div>

      <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 8 }}>
        Drag retirement age and growth to test. Lines are net of charges{real ? ' and inflation' : ''}; the dashed line is before charges. The post-retirement fall assumes a {(drawdownRate * 100).toFixed(0)}% drawdown — your real income plan lives on Cashflow. Not a forecast; returns can fall.
      </div>
    </div>
  )
}
