// ─────────────────────────────────────────────────────────────────────────────
// PoSChart — Probability-of-Success with Monte Carlo confidence ribbon.
// Cashflow §B.4 per spec v1.7.
//
// Visual design (Phase 2 Batch C — my opinion, not Stitch imitation):
//   · Large central percentage (94%) anchors the eye
//   · 1000-path Monte Carlo is rendered as a 10/90 percentile band
//     (smooth gradient fill from accent to transparent)
//   · Median path drawn as a stroke with drop-shadow glow + draw-in animation
//   · Vertical "now" marker as a dashed accent line
//   · Optional guardrail annotation chip at a specific year on the median path
//   · X-axis years (every 3rd year labelled) and Y-axis £k (3 gridlines)
//
// Component takes generic shape so it can be wired to cf_probabilityOfSuccess
// without coupling.
// ─────────────────────────────────────────────────────────────────────────────

const W = 360, H = 200
const PAD = { top: 10, right: 12, bottom: 28, left: 32 }
const pw = W - PAD.left - PAD.right
const ph = H - PAD.top - PAD.bottom

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

function buildBandPath(upper, lower) {
  if (!upper.length || !lower.length) return ''
  let d = `M${upper[0].x.toFixed(1)},${upper[0].y.toFixed(1)}`
  for (const u of upper.slice(1)) d += ` L${u.x.toFixed(1)},${u.y.toFixed(1)}`
  for (let i = lower.length - 1; i >= 0; i--) d += ` L${lower[i].x.toFixed(1)},${lower[i].y.toFixed(1)}`
  d += ' Z'
  return d
}

function fmtCompact(v) {
  if (Math.abs(v) >= 1_000_000) return `£${(v / 1_000_000).toFixed(1)}m`
  if (Math.abs(v) >= 1_000)     return `£${(v / 1_000).toFixed(0)}k`
  return `£${Math.round(v)}`
}

export default function PoSChart({
  probability = 0.94,
  median = null,         // [{ year, value }]
  bands = null,          // { p10: [], p90: [] }
  nowYear = new Date().getFullYear(),
  guardrail = null,      // { year, value, label }
  horizonYears = 30,
}) {
  // Synthesise default series if not provided. Median rises gently then
  // gradually flattens; p10/p90 widen with horizon.
  const rawSeries = median ?? Array.from({ length: 12 }, (_, i) => ({
    year: nowYear + (i * (horizonYears / 11)),
    value: 1_000_000 + i * 80_000 + Math.sin(i * 0.6) * 30_000,
  }))
  const series = rawSeries.length ? rawSeries : [{ year: nowYear, value: 1_000_000 }]
  const p10 = (bands?.p10 && bands.p10.length) ? bands.p10 : series.map((p, i) => {
    const widen = (i / series.length) * 0.35
    return { year: p.year, value: p.value * (1 - widen) }
  })
  const p90 = (bands?.p90 && bands.p90.length) ? bands.p90 : series.map((p, i) => {
    const widen = (i / series.length) * 0.30
    return { year: p.year, value: p.value * (1 + widen) }
  })

  const minY = Math.min(...p10.map(p => p.value), 0)
  const maxY = Math.max(...p90.map(p => p.value), 1)
  const minX = series[0].year
  const maxX = series[series.length - 1].year

  const xAt = (year) => PAD.left + ((year - minX) / Math.max(1, maxX - minX)) * pw
  const yAt = (val)  => PAD.top + ph - ((val - minY) / Math.max(1, maxY - minY)) * ph

  const medianPts = series.map(p => ({ x: xAt(p.year), y: yAt(p.value) }))
  const p10Pts    = p10.map(p => ({ x: xAt(p.year), y: yAt(p.value) }))
  const p90Pts    = p90.map(p => ({ x: xAt(p.year), y: yAt(p.value) }))

  const bandPath = buildBandPath(p90Pts, p10Pts)
  const medianPath = smoothPath(medianPts)
  const nowX = xAt(nowYear)

  const pct = Math.round(probability * 100)
  const pctTone = pct >= 90 ? 'mint' : pct >= 75 ? 'gold' : 'coral'
  const pctColor = pctTone === 'mint' ? 'var(--c-acc)' : pctTone === 'gold' ? 'var(--c-gold)' : 'var(--c-coral, #FF6F7D)'

  // Year labels — every 5 years
  const yearLabels = []
  for (let y = Math.ceil(minX / 5) * 5; y <= maxX; y += 5) {
    yearLabels.push({ x: xAt(y), label: String(y) })
  }

  // Guardrail annotation
  const guardPt = guardrail
    ? { x: xAt(guardrail.year), y: yAt(guardrail.value) }
    : null

  return (
    <div className="sw-card sw-card-elevated" style={{
      padding: 18,
      background: 'var(--card-bg2)',
      border: '1px solid var(--c-border)',
      borderRadius: 'var(--r-lg, 20px)',
      boxShadow: 'var(--sh2)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
        <div>
          <div className="sw-eyebrow">Probability of Success</div>
          <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 4 }}>
            1,000-path Monte Carlo · {horizonYears}-year horizon
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 36, fontWeight: 880, color: pctColor,
            letterSpacing: -0.5, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
          }}>{pct}%</div>
          <div style={{
            fontSize: 9, fontWeight: 800, color: 'var(--c-text3)',
            letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 4,
          }}>Plan survives</div>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', marginTop: 10 }}>
        <defs>
          <linearGradient id="pos-band-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--c-acc)" stopOpacity="0.32" />
            <stop offset="1" stopColor="var(--c-acc)" stopOpacity="0.06" />
          </linearGradient>
        </defs>

        {/* Y-axis gridlines (3) */}
        {[0.25, 0.5, 0.75].map(t => {
          const y = PAD.top + ph * t
          const val = maxY - (maxY - minY) * t
          return (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y}
                stroke="var(--c-sep)" strokeWidth="0.5" strokeDasharray="2 3" opacity="0.5" />
              <text x={PAD.left - 6} y={y + 3}
                textAnchor="end" fontSize="9" fill="var(--c-text3)"
                fontFamily="Inter,sans-serif">
                {fmtCompact(val)}
              </text>
            </g>
          )
        })}

        {/* 10–90 percentile band */}
        <path d={bandPath} fill="url(#pos-band-grad)" stroke="none" />

        {/* Median path */}
        <path d={medianPath}
          className="sw-stroke-draw"
          fill="none"
          stroke="var(--c-acc)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeDasharray="700"
          style={{
            '--sw-draw-len': '700',
            filter: 'drop-shadow(0 0 12px var(--c-radar-glow))',
          }} />

        {/* Now marker */}
        <line x1={nowX} y1={PAD.top} x2={nowX} y2={PAD.top + ph}
          stroke="var(--c-text2)" strokeWidth="1" strokeDasharray="3 3" opacity="0.55" />
        <text x={nowX} y={PAD.top - 2}
          textAnchor="middle" fontSize="9" fontWeight="700"
          fill="var(--c-text2)"
          fontFamily="Inter,sans-serif">
          now
        </text>

        {/* Guardrail annotation if present */}
        {guardPt && (
          <g>
            <circle cx={guardPt.x} cy={guardPt.y} r="4"
              fill="var(--c-gold)"
              style={{ filter: 'drop-shadow(0 0 6px var(--c-gold-bg))' }} />
            <text x={guardPt.x + 8} y={guardPt.y - 6}
              fontSize="9" fontWeight="700"
              fill="var(--c-gold)"
              fontFamily="Inter,sans-serif">
              {guardrail.label || 'guardrail'}
            </text>
          </g>
        )}

        {/* Year labels */}
        {yearLabels.map(l => (
          <text key={l.label} x={l.x} y={H - 8}
            textAnchor="middle" fontSize="9" fill="var(--c-text3)"
            fontFamily="Inter,sans-serif">
            {l.label}
          </text>
        ))}
      </svg>

      <div style={{
        display: 'flex', gap: 14, marginTop: 12,
        fontSize: 11, color: 'var(--c-text3)',
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 3, background: 'var(--c-acc)', borderRadius: 100, display: 'inline-block' }} />
          Median path
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 6, background: 'color-mix(in srgb, var(--c-acc) 25%, transparent)', borderRadius: 3, display: 'inline-block' }} />
          10–90 percentile
        </span>
      </div>
    </div>
  )
}
