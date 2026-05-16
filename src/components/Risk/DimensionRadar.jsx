// ─────────────────────────────────────────────────────────────────────────────
// DimensionRadar — 7-axis radar of Risk dims (NOT Jit's Wealth radar).
// Risk dims: incomeRes / liquidity / protCov / debtVuln / concRisk / depExp /
//            behaviouralTrack — each with a fixed max from calcRisk().
// ─────────────────────────────────────────────────────────────────────────────

import { calcRisk } from '../../engine/fq-calculator.js'

const DIMS = [
  { key: 'incomeRes',        label: 'Income',     max: 20, angle: -90 },
  { key: 'liquidity',        label: 'Liquidity',  max: 18, angle: -38 },
  { key: 'protCov',          label: 'Protection', max: 18, angle:  14 },
  { key: 'debtVuln',         label: 'Debt',       max: 15, angle:  66 },
  { key: 'concRisk',         label: 'Diversify',  max: 12, angle: 118 },
  { key: 'depExp',           label: 'Family',     max: 10, angle: 170 },
  { key: 'behaviouralTrack', label: 'Behaviour',  max:  7, angle: 222 },
]

function rad(d) { return d * Math.PI / 180 }
function pt(cx, cy, r, deg) {
  return { x: cx + r * Math.cos(rad(deg)), y: cy + r * Math.sin(rad(deg)) }
}

export default function DimensionRadar({ entity }) {
  const risk = calcRisk(entity)
  const cx = 160, cy = 160, maxR = 110

  const dimsData = DIMS.map(d => {
    const score = risk.dims?.[d.key] || 0
    const frac = Math.min(1, score / d.max)
    return { ...d, score, frac, point: pt(cx, cy, frac * maxR, d.angle) }
  })

  const dataPath = dimsData.map((d, i) =>
    `${i === 0 ? 'M' : 'L'}${d.point.x.toFixed(1)},${d.point.y.toFixed(1)}`
  ).join(' ') + ' Z'

  const rings = [0.25, 0.50, 0.75, 1.0]

  return (
    <div className="card">
      <div className="card-title">Resilience Dimensions</div>
      <svg viewBox="0 0 320 320" width="100%" style={{ overflow: 'visible' }}>
        {rings.map(r => (
          <circle
            key={r} cx={cx} cy={cy} r={r * maxR}
            fill="none" stroke="var(--c-sep)" strokeWidth="0.75"
          />
        ))}
        {DIMS.map((d, i) => {
          const o = pt(cx, cy, maxR, d.angle)
          return (
            <line
              key={i} x1={cx} y1={cy} x2={o.x.toFixed(1)} y2={o.y.toFixed(1)}
              stroke="var(--c-sep)" strokeWidth="0.5"
            />
          )
        })}
        <path
          d={dataPath}
          fill="rgba(122,167,255,0.18)"
          stroke="var(--c-acc2)" strokeWidth="2" strokeLinejoin="round"
        />
        {dimsData.map(d => (
          <circle
            key={d.key} cx={d.point.x} cy={d.point.y} r="4"
            fill="var(--c-acc2)"
            stroke="rgba(8,14,26,0.6)" strokeWidth="1"
          />
        ))}
        {DIMS.map(d => {
          const lp = pt(cx, cy, maxR + 18, d.angle)
          const anchor = lp.x > cx + 10 ? 'start' : lp.x < cx - 10 ? 'end' : 'middle'
          return (
            <text
              key={d.key} x={lp.x} y={lp.y + 3}
              fontSize="11" fontWeight="700"
              fill="var(--c-text2)" textAnchor={anchor}
              fontFamily="DM Sans,sans-serif"
            >
              {d.label}
            </text>
          )
        })}
        <text
          x={cx} y={cy + 5} fontSize="20" fontWeight="800"
          fill="var(--c-text)" textAnchor="middle"
          fontFamily="DM Sans,sans-serif"
        >
          {risk.total}
        </text>
      </svg>
      <div style={{
        display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:6,
        marginTop:8, fontSize:'var(--fs-small)',
      }}>
        {dimsData.map(d => (
          <div key={d.key} style={{
            display:'flex', justifyContent:'space-between',
            padding:'4px 8px',
            background:'var(--c-surface2)', borderRadius:6,
          }}>
            <span style={{ color:'var(--c-text3)' }}>{d.label}</span>
            <span style={{ color:'var(--c-text)', fontWeight:700 }}>
              {d.score}/{d.max}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
