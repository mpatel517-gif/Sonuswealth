// ─────────────────────────────────────────────────────────────────────────────
// NWTrajectoryChart — three NW scenarios with longevity band markers.
// All series come from engine trajectoryData(); longevity ages are constants
// agreed in the design system (conservative 85 · median 88 · optimistic 92).
// ─────────────────────────────────────────────────────────────────────────────

import { fmt, trajectoryData } from '../../engine/fq-calculator.js'

const LONGEVITY = [
  { id: 'conservative', age: 85, label: '85' },
  { id: 'median',       age: 88, label: '88' },
  { id: 'optimistic',   age: 92, label: '92' },
]

export default function NWTrajectoryChart({ entity }) {
  const data = trajectoryData(entity)
  if (!data?.doNothing?.length) return null

  const all = [
    ...(data.doNothing || []),
    ...(data.draw25 || []),
    ...(data.draw377 || []),
  ].map(d => d.nw)
  const maxV = Math.max(...all, 1)
  const ages = data.doNothing.map(d => d.age)
  const minAge = ages[0] ?? 0
  const maxAge = Math.max(ages[ages.length - 1] ?? 0, 92)

  const W = 320, H = 180, pL = 8, pR = 8, pT = 14, pB = 24
  const pw = W - pL - pR, ph = H - pT - pB

  const px = age => pL + ((age - minAge) / (maxAge - minAge || 1)) * pw
  const py = nw  => pT + ph - (nw / maxV) * ph

  function path(series) {
    if (!series?.length) return ''
    return series.map((d, i) =>
      `${i === 0 ? 'M' : 'L'}${px(d.age).toFixed(1)},${py(d.nw).toFixed(1)}`
    ).join(' ')
  }

  const series = [
    { d: data.doNothing, c: 'var(--c-acc3)', w: 1.8, label: 'Conservative' },
    { d: data.draw25,    c: 'var(--c-acc2)', w: 2.0, label: 'Median'       },
    { d: data.draw377,   c: 'var(--c-acc)',  w: 2.5, label: 'Optimistic'   },
  ]

  return (
    <div className="card">
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        marginBottom: 6,
      }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Net worth to age 92</div>
      </div>

      <div style={{ display:'flex', gap:12, marginBottom:8, flexWrap:'wrap' }}>
        {series.map(s => (
          <div key={s.label} style={{
            display:'flex', alignItems:'center', gap:5,
            fontSize: 'var(--fs-label)', color:'var(--c-text3)',
          }}>
            <div style={{
              width: 14, height: 3, borderRadius: 100, background: s.c,
            }} />
            {s.label}
          </div>
        ))}
        <div style={{
          marginLeft: 'auto',
          display:'flex', alignItems:'center', gap:5,
          fontSize: 'var(--fs-label)', color:'var(--c-text3)',
        }}>
          <span style={{
            width: 2, height: 12, background: 'var(--c-gold)', display:'inline-block',
          }} />
          Longevity 85 · 88 · 92
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow:'visible', display:'block' }}>
        {/* Y gridlines */}
        {[0, 0.5, 1].map(t => (
          <line
            key={t}
            x1={pL} y1={pT + ph - t * ph}
            x2={W - pR} y2={pT + ph - t * ph}
            stroke="var(--c-sep)" strokeWidth="0.75" strokeDasharray="2 3"
          />
        ))}

        {/* Longevity vertical bands */}
        {LONGEVITY.map(L => (
          <g key={L.id}>
            <line
              x1={px(L.age).toFixed(1)} y1={pT}
              x2={px(L.age).toFixed(1)} y2={pT + ph}
              stroke="var(--c-gold)" strokeWidth="1.2" strokeDasharray="3 3"
              opacity="0.6"
            />
            <text
              x={px(L.age).toFixed(1)} y={pT - 2}
              fontSize="9" fill="var(--c-gold)" textAnchor="middle"
              fontFamily="DM Sans,sans-serif"
            >
              {L.label}
            </text>
          </g>
        ))}

        {/* Series lines */}
        {series.map(s => {
          const d = path(s.d)
          if (!d) return null
          return (
            <path
              key={s.label}
              d={d} fill="none"
              stroke={s.c} strokeWidth={s.w} strokeLinecap="round"
            />
          )
        })}

        {/* X axis labels — every other age */}
        {ages.map((a, i) => (i % 2 === 0) ? (
          <text
            key={a} x={px(a).toFixed(1)} y={H - 6}
            fontSize="9" fill="var(--c-text3)" textAnchor="middle"
            fontFamily="DM Sans,sans-serif"
          >
            {a}
          </text>
        ) : null)}

        {/* Y axis: peak label */}
        <text
          x={pL + 4} y={pT + 8}
          fontSize="9" fill="var(--c-text3)" textAnchor="start"
          fontFamily="DM Sans,sans-serif"
        >
          {fmt(Math.round(maxV))}
        </text>
      </svg>

      <div style={{
        marginTop: 8, fontSize: 'var(--fs-small)', color:'var(--c-text2)', lineHeight: 1.5,
      }}>
        Three scenarios from the engine trajectory model. Longevity bands at 85,
        88, and 92 mark the conservative, median, and optimistic planning ages.
      </div>
    </div>
  )
}
