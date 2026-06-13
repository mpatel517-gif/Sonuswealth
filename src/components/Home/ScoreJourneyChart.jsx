// ─────────────────────────────────────────────────────────────────────────────
// ScoreJourneyChart — Home §Z5 (D-SCORE-JOURNEY-1).
//
// The spec's primary Home chart: three inter-related time series on a shared time
// axis — Net Worth (£, left axis) + Wealth Score (0–100, right axis) + Risk Score
// (0–100, right axis) — so the relationship between wealth growth, behavioural
// health and risk management is visible at once (a table/sparklines can't show it).
//
// Founder decision (2026-06-13): COEXISTS with the radar, does not replace it.
//
// Data: canonical fq-calculator readers netWorthHistory / scoreTrajectory /
// riskTrajectory, each [{date, value, confidence}]. These return HISTORY only
// (scores are not projected forward in the engine yet — only NW projects, via
// trajectoryData). So this v1 plots the history window honestly and flags the
// synthesised/low-confidence portion rather than fabricating a forward score line.
// Colours per §Q2.1: NW --c-acc · Wealth --c-acc2 · Risk --c-acc3.
// ─────────────────────────────────────────────────────────────────────────────

import { fmt, netWorthHistory, scoreTrajectory, riskTrajectory } from '../../engine/fq-calculator.js'

export default function ScoreJourneyChart({ entity }) {
  let nwSeries = [], scoreSeries = [], riskSeries = []
  try {
    nwSeries = netWorthHistory(entity) || []
    scoreSeries = scoreTrajectory(entity) || []
    riskSeries = riskTrajectory(entity) || []
  } catch { /* fall through to empty-state */ }

  const n = Math.min(nwSeries.length, scoreSeries.length, riskSeries.length)
  if (n < 2) return null // not enough points to draw a line — honest empty (render nothing)

  // Align to the shared last-n window.
  const nw = nwSeries.slice(-n), sc = scoreSeries.slice(-n), rk = riskSeries.slice(-n)
  const nwVals = nw.map(d => +d.value || 0)
  const nwMax = Math.max(...nwVals, 1)
  const nwMin = Math.min(...nwVals, 0)
  const anySynthetic = [...nw, ...sc, ...rk].some(d => d.confidence === 'LOW')

  const W = 320, H = 150, pL = 6, pR = 6, pT = 10, pB = 16
  const pw = W - pL - pR, ph = H - pT - pB
  const x = i => pL + (i / (n - 1)) * pw
  const yNW = v => pT + ph - ((v - nwMin) / ((nwMax - nwMin) || 1)) * ph
  const yScore = v => pT + ph - (Math.max(0, Math.min(100, v)) / 100) * ph
  const pathOf = (arr, yfn) => arr.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${yfn(+d.value || 0).toFixed(1)}`).join(' ')

  const SERIES = [
    { key: 'nw',    label: 'Net worth',    colour: 'var(--c-acc)',  path: pathOf(nw, yNW),    latest: fmt(nwVals[n - 1]) },
    { key: 'score', label: 'Wealth Score', colour: 'var(--c-acc2)', path: pathOf(sc, yScore), latest: `${Math.round(+sc[n - 1].value || 0)}` },
    { key: 'risk',  label: 'Risk Score',   colour: 'var(--c-acc3)', path: pathOf(rk, yScore), latest: `${Math.round(+rk[n - 1].value || 0)}` },
  ]

  return (
    <div className="sw-card" style={{ margin: '4px 16px 0', padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--c-text)' }}>Your journey</div>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--c-text3)' }}>
          Last {n} months
        </span>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--c-text2)', lineHeight: 1.5, marginBottom: 10 }}>
        Net worth, Wealth Score and Risk Score together — so you can see how they move in relation to each other.
      </div>

      {/* Legend with latest values */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 8 }}>
        {SERIES.map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 16, height: 3, borderRadius: 100, background: s.colour, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--c-text2)' }}>{s.label}</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: s.colour, fontVariantNumeric: 'tabular-nums' }}>{s.latest}</span>
          </div>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
        aria-label={`Trajectory: net worth ${SERIES[0].latest}, Wealth Score ${SERIES[1].latest}, Risk Score ${SERIES[2].latest}`}
        style={{ display: 'block' }}>
        {/* baseline */}
        <line x1={pL} y1={pT + ph} x2={W - pR} y2={pT + ph} stroke="var(--c-sep)" strokeWidth="1" />
        {SERIES.map(s => (
          <path key={s.key} d={s.path} fill="none" stroke={s.colour}
            strokeWidth={s.key === 'nw' ? 2.4 : 2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {/* endpoint dots */}
        {SERIES.map(s => {
          const last = s.key === 'nw' ? yNW(nwVals[n - 1]) : yScore(+ (s.key === 'score' ? sc : rk)[n - 1].value || 0)
          return <circle key={s.key} cx={x(n - 1)} cy={last} r="2.6" fill={s.colour} />
        })}
      </svg>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--c-text3)', marginTop: 2 }}>
        <span>£ left axis</span><span>Scores 0–100 right axis</span>
      </div>

      {anySynthetic && (
        <div style={{ fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.45, marginTop: 8 }}>
          Trend estimated from your current position — it sharpens as your real month-by-month history builds up.
        </div>
      )}
    </div>
  )
}
