// ─────────────────────────────────────────────────────────────────────────────
// ScoreHistoryChart — Z8 sparkline + own picker (1/3/6/12 months).
// IMPORTANT: this picker is NOT the X28 time-window. Risk is point-in-time;
// only the *history* window is selectable here. Real history data comes from
// the score-history store at s02a — today we render a deterministic preview.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { calcRisk } from '../../engine/fq-calculator.js'

const PICKERS = [
  { id: '1m',  label: '1mo',  points: 4  },
  { id: '3m',  label: '3mo',  points: 12 },
  { id: '6m',  label: '6mo',  points: 24 },
  { id: '12m', label: '12mo', points: 52 },
]

// Deterministic placeholder series anchored to current score until the
// history store is wired (s02a).
function buildSeries(currentScore, points) {
  const arr = []
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1)
    const drift = Math.sin(i * 0.6) * 4 - (1 - t) * 6
    arr.push(Math.max(0, Math.min(100, Math.round(currentScore + drift))))
  }
  arr[arr.length - 1] = currentScore // ensure end matches "now"
  return arr
}

export default function ScoreHistoryChart({ entity }) {
  const [pickerId, setPickerId] = useState('3m')
  const picker = PICKERS.find(p => p.id === pickerId) || PICKERS[1]
  const risk = calcRisk(entity)
  const series = buildSeries(risk.total, picker.points)

  const W = 320, H = 80, pL = 8, pR = 8, pT = 8, pB = 8
  const pw = W - pL - pR, ph = H - pT - pB
  const px = i => pL + (i / (Math.max(series.length - 1, 1))) * pw
  const py = v => pT + ph - (v / 100) * ph

  const path = series.map((v, i) =>
    `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(v).toFixed(1)}`
  ).join(' ')

  const start = series[0], end = series[series.length - 1]
  const delta = end - start

  return (
    <div className="card">
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        marginBottom: 8,
      }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Score History</div>
        <div style={{
          display:'flex', background:'var(--c-surface2)', borderRadius:100,
          padding:3, gap:2,
        }}>
          {PICKERS.map(p => (
            <button
              key={p.id} onClick={() => setPickerId(p.id)}
              style={{
                background: pickerId === p.id ? 'var(--c-acc)' : 'transparent',
                color: pickerId === p.id ? 'var(--c-bg)' : 'var(--c-text2)',
                border: 'none', cursor: 'pointer',
                padding: '4px 10px', borderRadius: 100,
                fontSize: 'var(--fs-label)', fontWeight: 700,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display:'block' }}>
        <path
          d={path} fill="none"
          stroke={delta >= 0 ? 'var(--c-acc)' : 'var(--c-acc3)'}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        />
        <circle
          cx={px(series.length - 1).toFixed(1)} cy={py(end).toFixed(1)} r="3"
          fill={delta >= 0 ? 'var(--c-acc)' : 'var(--c-acc3)'}
        />
      </svg>

      <div style={{
        display:'flex', justifyContent:'space-between', marginTop:6,
        fontSize:'var(--fs-small)',
      }}>
        <span style={{ color:'var(--c-text3)' }}>{picker.label} ago: <strong style={{ color:'var(--c-text)' }}>{start}</strong></span>
        <span style={{ color:'var(--c-text3)' }}>Today: <strong style={{ color:'var(--c-text)' }}>{end}</strong></span>
        <span style={{
          fontWeight:700,
          color: delta >= 0 ? 'var(--c-acc)' : 'var(--c-acc3)',
        }}>
          {delta >= 0 ? '+' : ''}{delta}
        </span>
      </div>
    </div>
  )
}
