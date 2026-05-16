// ─────────────────────────────────────────────────────────────────────────────
// EfficientFrontier — Cashflow §C portfolio efficiency.
//
// Visual design (Phase 2 Batch C):
//   · Scatter plot — X axis = volatility (annual stdev), Y axis = expected return
//   · Frontier curve plotted as a smooth path (the theoretical efficient mix)
//   · User position dot (accent + glow) showing actual portfolio
//   · 60/40 reference dot for comparison
//   · Distance-to-frontier chip showing how much return is left on the table
// ─────────────────────────────────────────────────────────────────────────────

function smoothPath(pts) {
  if (!pts.length) return ''
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    d += ` C${(p1.x + (p2.x - p0.x) / 6).toFixed(1)},${(p1.y + (p2.y - p0.y) / 6).toFixed(1)} `
      +  `${(p2.x - (p3.x - p1.x) / 6).toFixed(1)},${(p2.y - (p3.y - p1.y) / 6).toFixed(1)} `
      +  `${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
  }
  return d
}

export default function EfficientFrontier({
  userPosition: userPosArg,
  reference: refArg,
  frontierPoints = null,
  distanceToFrontier = 0.012,
}) {
  // Null-safe defaults — caller may pass null when engine output is sparse.
  const userPosition = userPosArg || { volatility: 0.13, expectedReturn: 0.052 }
  const reference    = refArg     || { label: '60/40', volatility: 0.10, expectedReturn: 0.058 }
  // Synthesise frontier if not provided. Risk-return roughly logarithmic.
  const front = frontierPoints ?? Array.from({ length: 14 }, (_, i) => {
    const vol = 0.02 + (i / 13) * 0.20
    const er  = 0.025 + Math.log(1 + vol * 10) * 0.03
    return { volatility: vol, expectedReturn: er }
  })

  const W = 320, H = 200
  const PAD = { top: 12, right: 16, bottom: 30, left: 36 }
  const pw = W - PAD.left - PAD.right
  const ph = H - PAD.top - PAD.bottom

  const xs = [userPosition.volatility, reference.volatility, ...front.map(p => p.volatility)]
  const ys = [userPosition.expectedReturn, reference.expectedReturn, ...front.map(p => p.expectedReturn)]
  const xMin = 0
  const xMax = Math.max(...xs) * 1.08 || 1
  const yMin = 0
  const yMax = Math.max(...ys) * 1.12 || 1

  const xAt = (v) => PAD.left + (v / xMax) * pw
  const yAt = (v) => PAD.top + ph - (v / yMax) * ph

  const frontPts = front.map(p => ({ x: xAt(p.volatility), y: yAt(p.expectedReturn) }))
  const frontPath = smoothPath(frontPts)

  const userPt = { x: xAt(userPosition.volatility), y: yAt(userPosition.expectedReturn) }
  const refPt  = { x: xAt(reference.volatility),   y: yAt(reference.expectedReturn) }

  const gapPct = Math.round(distanceToFrontier * 1000) / 10  // 1.2%

  return (
    <div className="sw-card sw-card-elevated" style={{
      padding: 16,
      background: 'var(--card-bg2)',
      border: '1px solid var(--c-border)',
      borderRadius: 'var(--r-lg, 20px)',
      boxShadow: 'var(--sh2)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div className="sw-eyebrow">Efficient frontier</div>
          <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 4 }}>
            Risk · return position vs the theoretical frontier
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 9, fontWeight: 800, color: 'var(--c-text3)',
            letterSpacing: 0.6, textTransform: 'uppercase',
          }}>
            Gap to frontier
          </div>
          <div style={{
            fontSize: 18, fontWeight: 800, color: 'var(--c-gold)',
            letterSpacing: -0.2, lineHeight: 1, marginTop: 4,
            fontVariantNumeric: 'tabular-nums',
          }}>
            +{gapPct.toFixed(1)}% / yr
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        {/* Y-axis gridlines */}
        {[0.25, 0.5, 0.75].map(t => {
          const y = PAD.top + ph * t
          const val = yMax * (1 - t)
          return (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y}
                stroke="var(--c-sep)" strokeWidth="0.5" strokeDasharray="2 3" opacity="0.5" />
              <text x={PAD.left - 6} y={y + 3}
                textAnchor="end" fontSize="9" fill="var(--c-text3)"
                fontFamily="Inter,sans-serif">
                {(val * 100).toFixed(1)}%
              </text>
            </g>
          )
        })}

        {/* X-axis tick labels */}
        {[0.05, 0.10, 0.15, 0.20].map(v => (
          <text key={v} x={xAt(v)} y={H - 8}
            textAnchor="middle" fontSize="9" fill="var(--c-text3)"
            fontFamily="Inter,sans-serif">
            {Math.round(v * 100)}% vol
          </text>
        ))}

        {/* Axis labels */}
        <text x={PAD.left} y={PAD.top - 2}
          textAnchor="start" fontSize="9" fontWeight="700"
          fill="var(--c-text3)" fontFamily="Inter,sans-serif"
          style={{ letterSpacing: 0.4, textTransform: 'uppercase' }}>
          Expected return →
        </text>

        {/* Frontier curve */}
        <path d={frontPath}
          className="sw-stroke-draw"
          fill="none" stroke="var(--c-acc)" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray="500"
          style={{
            '--sw-draw-len': '500',
            filter: 'drop-shadow(0 0 8px var(--c-radar-glow))',
          }} />

        {/* Reference dot (60/40) */}
        <circle cx={refPt.x} cy={refPt.y} r="5" fill="var(--c-text3)" stroke="var(--c-bg)" strokeWidth="1.5" />
        <text x={refPt.x + 10} y={refPt.y - 6}
          fontSize="9" fontWeight="700" fill="var(--c-text2)"
          fontFamily="Inter,sans-serif">
          {reference.label}
        </text>

        {/* User position dot — accent + glow */}
        <circle cx={userPt.x} cy={userPt.y} r="6.5" fill="var(--c-acc)"
          stroke="var(--c-bg)" strokeWidth="2"
          style={{ filter: 'drop-shadow(0 0 10px var(--c-radar-glow))' }} />
        <text x={userPt.x + 12} y={userPt.y - 8}
          fontSize="10" fontWeight="800" fill="var(--c-acc)"
          fontFamily="Inter,sans-serif">
          You
        </text>

        {/* Vertical "to frontier" line from user position straight up */}
        {front.length > 0 && (() => {
          // Find frontier ER at user's volatility
          const userVol = userPosition.volatility
          const closest = front.reduce((best, p) => Math.abs(p.volatility - userVol) < Math.abs(best.volatility - userVol) ? p : best, front[0])
          const targetY = yAt(closest.expectedReturn)
          return (
            <line x1={userPt.x} y1={userPt.y} x2={userPt.x} y2={targetY}
              stroke="var(--c-gold)" strokeWidth="1.5" strokeDasharray="3 3"
              opacity="0.7" />
          )
        })()}
      </svg>
    </div>
  )
}
