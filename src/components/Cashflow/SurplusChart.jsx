// ─────────────────────────────────────────────────────────────────────────────
// SurplusChart — month-by-month income vs target. Inline SVG (no recharts).
// Stays under the 300-line cap and matches the project's hand-drawn aesthetic
// used in HomeScreen's NWTraj / RadarChart.
// ─────────────────────────────────────────────────────────────────────────────

import { fmt } from '../../engine/fq-calculator.js'

export default function SurplusChart({ income, target }) {
  const months = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']

  // Income paid evenly per month (employment / pensions usually monthly).
  // Target spend evenly distributed. Real implementation will read engine
  // forecastFor(entity, 'cashflow', window) once data is wired.
  const monthlyIncome = (income || 0) / 12
  const monthlyTarget = (target || 0) / 12

  const W = 320, H = 110, pL = 24, pR = 8, pT = 10, pB = 22
  const pw = W - pL - pR, ph = H - pT - pB
  const maxV = Math.max(monthlyIncome, monthlyTarget) * 1.15 || 1

  const px = i => pL + (i / (months.length - 1)) * pw
  const py = v => pT + ph - (v / maxV) * ph

  const incomePath = months.map((_, i) =>
    `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(monthlyIncome).toFixed(1)}`
  ).join(' ')

  const targetPath = months.map((_, i) =>
    `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(monthlyTarget).toFixed(1)}`
  ).join(' ')

  // Surplus area path (income minus target, only if surplus ≥ 0)
  const surplusArea = monthlyIncome >= monthlyTarget
    ? `M${pL},${py(monthlyTarget).toFixed(1)} L${(W - pR)},${py(monthlyTarget).toFixed(1)} L${(W - pR)},${py(monthlyIncome).toFixed(1)} L${pL},${py(monthlyIncome).toFixed(1)} Z`
    : null

  return (
    <div style={{
      background: 'var(--c-surface)',
      border: '1px solid var(--c-border)',
      borderRadius: 16, padding: '14px 16px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: 6,
      }}>
        <div style={{
          fontSize: 'var(--fs-label)', fontWeight: 700,
          color: 'var(--c-text3)',
          textTransform: 'uppercase', letterSpacing: 0.8,
        }}>
          Monthly Income vs Target
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 'var(--fs-label)' }}>
          <span style={{ color: 'var(--c-acc)' }}>● Income</span>
          <span style={{ color: 'var(--c-acc3)' }}>● Target</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        {/* Y axis ticks */}
        {[0, 0.5, 1].map(t => {
          const v = maxV * t
          return (
            <g key={t}>
              <line
                x1={pL} y1={py(v)} x2={W - pR} y2={py(v)}
                stroke="var(--c-sep)" strokeWidth="0.75" strokeDasharray="2 3"
              />
              <text
                x={pL - 4} y={py(v) + 3} fontSize="9" fill="var(--c-text3)"
                textAnchor="end" fontFamily="DM Sans,sans-serif"
              >
                {fmt(Math.round(v))}
              </text>
            </g>
          )
        })}

        {/* Surplus shading */}
        {surplusArea && (
          <path d={surplusArea} fill="var(--c-acc-bg)" />
        )}

        {/* Lines */}
        <path d={incomePath} fill="none" stroke="var(--c-acc)"  strokeWidth="2" strokeLinecap="round" />
        <path d={targetPath} fill="none" stroke="var(--c-acc3)" strokeWidth="2" strokeDasharray="4 3" />

        {/* X labels */}
        {months.map((m, i) =>
          (i % 2 === 0) ? (
            <text
              key={m} x={px(i)} y={H - 6} fontSize="9"
              fill="var(--c-text3)" textAnchor="middle"
              fontFamily="DM Sans,sans-serif"
            >
              {m}
            </text>
          ) : null
        )}
      </svg>

      <div style={{
        marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
        fontSize: 'var(--fs-small)',
      }}>
        <Stat label="Income/mo"  value={fmt(monthlyIncome)} colour="var(--c-acc)" />
        <Stat label="Target/mo"  value={fmt(monthlyTarget)} colour="var(--c-acc3)" />
        <Stat
          label="Surplus/mo"
          value={`${monthlyIncome - monthlyTarget >= 0 ? '+' : ''}${fmt(monthlyIncome - monthlyTarget)}`}
          colour={monthlyIncome >= monthlyTarget ? 'var(--c-acc)' : 'var(--c-acc3)'}
        />
      </div>
    </div>
  )
}

function Stat({ label, value, colour }) {
  return (
    <div style={{
      background: 'var(--c-surface2)', borderRadius: 10,
      padding: '6px 8px', textAlign: 'center',
    }}>
      <div style={{
        fontSize: 'var(--fs-label)', color: 'var(--c-text3)',
        textTransform: 'uppercase', letterSpacing: 0.5,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: colour, marginTop: 2 }}>
        {value}
      </div>
    </div>
  )
}
