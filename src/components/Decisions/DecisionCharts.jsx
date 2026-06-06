// ─────────────────────────────────────────────────────────────────────────────
// DecisionCharts — Decision Engine option visualisers (Sonuswealth).
//
// Two presentational SVG charts that let a non-expert read a decision at a
// glance. Both follow the Cashflow chart house style (FundedRatioGauge /
// PoSChart): theme CSS variables only, labelled axes, sw-stroke-draw draw-in,
// var(--c-radar-glow) glow, var(--c-coral) for negatives. Work in light + dark.
//
//   1. PathComparisonChart — horizontal diverging bars comparing each option's
//      net-worth (or IHT) change vs today. Negatives extend left of a centre
//      zero line in coral; positives extend right in accent. 2–4 options.
//
//   2. BeforeAfterBar — two adjacent bars (before vs after) for a single metric
//      with the delta called out. Positive change accent, negative coral.
//
// Pure presentational: no data fetching, no hardcoded amounts.
// ─────────────────────────────────────────────────────────────────────────────

// Compact £ formatter — ≥1m → £1.2m, ≥1000 → £55k, else whole pounds.
function fmtCompact(v) {
  const n = Number(v) || 0
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `£${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}m`
  if (abs >= 1_000)     return `£${Math.round(abs / 1_000)}k`
  return `£${Math.round(abs)}`
}

// Signed compact £ — +£55k, −£21k, £0. Uses a true minus sign for negatives.
function fmtSigned(v) {
  const n = Number(v) || 0
  if (n === 0) return '£0'
  return `${n > 0 ? '+' : '−'}${fmtCompact(n)}`
}

const POS_COLOR = 'var(--c-acc)'
const NEG_COLOR = 'var(--c-coral, #FF6F7D)'

const AXIS_LABEL = {
  nw:  'Net-worth change vs today',
  iht: 'Inheritance-tax change vs today',
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PathComparisonChart
// ─────────────────────────────────────────────────────────────────────────────

// Confidence may arrive as a 0–1 number or as 'HIGH'/'MED'/'LOW' (engine paths).
function fmtConfidence(c) {
  if (c == null) return '—'
  if (typeof c === 'number') return `${Math.round(c * 100)}%`
  const m = { HIGH: 'high', MED: 'medium', MEDIUM: 'medium', LOW: 'low' }
  return m[String(c).toUpperCase()] || String(c).toLowerCase()
}

export function PathComparisonChart({ paths, valueKey = 'nw', axisLabel }) {
  const list = Array.isArray(paths) ? paths.filter(Boolean).slice(0, 4) : []
  const axisCaption = axisLabel || AXIS_LABEL[valueKey] || 'Change vs today'

  if (list.length < 2) {
    return (
      <div className="sw-card sw-card-elevated" style={cardStyle}>
        <div className="sw-eyebrow" style={{ marginBottom: 8 }}>Compare your options</div>
        <div style={{ fontSize: 12, color: 'var(--c-text3)', maxWidth: 240 }}>
          Add at least two options to compare how each changes your money.
        </div>
      </div>
    )
  }

  // Pull the comparable value for each path. For IHT a smaller bill is good, so
  // we flip the sign so "better outcome" always points right in accent — but we
  // keep the displayed figure honest by labelling it as the change in the bill.
  const rows = list.map((p, i) => {
    const raw = Number(p?.simulation?.delta?.[valueKey]) || 0
    const value = valueKey === 'iht' ? -raw : raw   // good direction = right
    return {
      id: p?.id ?? `path-${i}`,
      label: p?.plainLabel || p?.title || `Option ${i + 1}`,
      raw,                                   // figure as it really is
      value,                                 // direction-normalised for the bar
      confidence: p?.simulation?.confidence,
      riskLevel: p?.riskLevel,
    }
  })

  const maxAbs = Math.max(1, ...rows.map(r => Math.abs(r.value)))
  const anyNeg = rows.some(r => r.value < 0)

  // Layout — viewBox in abstract units so it scales to any container width.
  const W = 360
  const ROW_H = 46
  const PAD = { top: 30, right: 14, bottom: 22, left: 14 }
  const plotW = W - PAD.left - PAD.right
  const H = PAD.top + rows.length * ROW_H + PAD.bottom

  // Zero baseline: centred if any negatives, else hard-left (all-positive looks
  // wrong diverging from the middle when nothing goes left).
  const zeroX = anyNeg ? PAD.left + plotW / 2 : PAD.left
  const halfW = anyNeg ? plotW / 2 : plotW
  const barH = 16

  return (
    <div className="sw-card sw-card-elevated" style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
        <div>
          <div className="sw-eyebrow">Compare your options</div>
          <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 4 }}>
            {axisCaption}
          </div>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`Bar chart comparing ${rows.length} options by ${axisCaption}. ${rows.map(r => `${r.label}: ${fmtSigned(r.raw)}`).join('. ')}.`}
        style={{ display: 'block', marginTop: 8, overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="dc-pos-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={POS_COLOR} stopOpacity="0.65" />
            <stop offset="1" stopColor={POS_COLOR} stopOpacity="1" />
          </linearGradient>
          <linearGradient id="dc-neg-grad" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0" stopColor={NEG_COLOR} stopOpacity="0.65" />
            <stop offset="1" stopColor={NEG_COLOR} stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* Axis caption lives once, in the card header above (no SVG duplicate). */}

        {/* Zero reference line */}
        <line x1={zeroX} y1={PAD.top - 4} x2={zeroX} y2={H - PAD.bottom + 4}
          stroke="var(--c-text3)" strokeWidth="1" strokeDasharray="2 3" opacity="0.7" />
        <text x={zeroX} y={H - PAD.bottom + 16}
          textAnchor="middle" fontSize="8.5" fontWeight="700"
          fill="var(--c-text3)" fontFamily="Inter,sans-serif">
          today
        </text>

        {rows.map((r, i) => {
          const rowTop = PAD.top + i * ROW_H
          const barY = rowTop + 18
          const len = (Math.abs(r.value) / maxAbs) * halfW
          const isNeg = r.value < 0
          const barX = isNeg ? zeroX - len : zeroX
          const fill = isNeg ? 'url(#dc-neg-grad)' : 'url(#dc-pos-grad)'
          const valueColor = (r.raw < 0) ? NEG_COLOR : (r.raw > 0 ? POS_COLOR : 'var(--c-text3)')
          // Value label: outside the bar end by default, but if it would clip the
          // chart edge (long bar), draw it INSIDE the bar in white so it's never
          // cut off (founder 2026-06-06: "+£8" / "+£4" were clipped).
          const NEAR = 54
          const endX = isNeg ? barX : barX + len
          const fitsOutside = Math.abs(r.value) === 0
            || (isNeg ? (endX - NEAR > PAD.left) : (endX + NEAR < W - 2))
          const labelInside = !fitsOutside
          const labelX = labelInside
            ? (isNeg ? endX + 6 : endX - 6)
            : (isNeg ? barX - 6 : barX + len + 6)
          const labelAnchor = labelInside ? (isNeg ? 'start' : 'end') : (isNeg ? 'end' : 'start')
          const labelFill = labelInside ? 'rgba(255,255,255,0.97)' : valueColor
          // Track behind each bar so empty rows still read as a lane.
          const trackX = anyNeg ? PAD.left : zeroX
          const trackW = anyNeg ? plotW : halfW

          return (
            <g key={r.id}>
              {/* Option name above its bar */}
              <text x={anyNeg ? PAD.left : zeroX} y={rowTop + 10}
                fontSize="11" fontWeight="700"
                fill="var(--c-text)" fontFamily="Inter,sans-serif">
                {r.label}
              </text>

              {/* Lane track */}
              <rect x={trackX} y={barY} width={trackW} height={barH} rx={barH / 2}
                fill="var(--c-surface2)" stroke="var(--c-border)" strokeWidth="0.75" opacity="0.7" />

              {/* The bar */}
              {Math.abs(r.value) > 0 && (
                <rect
                  className="sw-stroke-draw"
                  x={barX} y={barY} width={Math.max(2, len)} height={barH} rx={barH / 2}
                  fill={fill}
                  style={{ filter: 'drop-shadow(0 0 8px var(--c-radar-glow))' }} />
              )}

              {/* Value label (£) — outside the bar, or inside it when near the edge */}
              <text x={labelX} y={barY + barH / 2 + 4}
                textAnchor={labelAnchor} fontSize="11.5" fontWeight="800"
                fill={labelFill} fontFamily="Inter,sans-serif"
                style={{ fontVariantNumeric: 'tabular-nums' }}>
                {fmtSigned(r.raw)}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Plain-English legend + per-option confidence (text, no jargon) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10, fontSize: 11, color: 'var(--c-text3)' }}>
        <span style={legendItem}>
          <span style={{ ...swatch, background: POS_COLOR }} /> Better than today
        </span>
        <span style={legendItem}>
          <span style={{ ...swatch, background: NEG_COLOR }} /> Worse than today
        </span>
      </div>

      {rows.some(r => r.confidence != null) && (
        <div style={{ marginTop: 8, fontSize: 10.5, color: 'var(--c-text3)', lineHeight: 1.5 }}>
          {rows.filter(r => r.confidence != null).map(r => (
            <div key={`conf-${r.id}`}>
              <strong style={{ color: 'var(--c-text2)' }}>{r.label}</strong>
              {' — '}how sure we are: {fmtConfidence(r.confidence)}.
            </div>
          ))}
        </div>
      )}

      {valueKey === 'iht' && (
        <div style={{ marginTop: 8, fontSize: 10.5, color: 'var(--c-text3)', lineHeight: 1.5 }}>
          A bar pointing right means a smaller inheritance-tax bill — better for what you leave behind.
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. BeforeAfterBar
// ─────────────────────────────────────────────────────────────────────────────

export function BeforeAfterBar({ label = 'Net worth', before, after }) {
  const b = Number(before) || 0
  const a = Number(after) || 0
  const delta = a - b
  const improves = delta >= 0
  const deltaColor = delta === 0 ? 'var(--c-text3)' : (improves ? POS_COLOR : NEG_COLOR)

  const W = 360
  const PAD = { top: 26, right: 14, bottom: 26, left: 14 }
  const plotW = W - PAD.left - PAD.right
  const barH = 22
  const gap = 14
  const H = PAD.top + barH * 2 + gap + PAD.bottom

  // Scale both bars to the larger of the two (or 1 to avoid /0). Negative values
  // are shown as zero-length bars but still labelled honestly.
  const maxVal = Math.max(1, Math.abs(b), Math.abs(a))
  const lenOf = (v) => (Math.max(0, v) / maxVal) * plotW

  const bars = [
    { key: 'before', name: 'Today', value: b, y: PAD.top },
    { key: 'after',  name: 'After this choice', value: a, y: PAD.top + barH + gap },
  ]

  return (
    <div className="sw-card sw-card-elevated" style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div className="sw-eyebrow">{label}: before and after</div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 18, fontWeight: 880, color: deltaColor,
            letterSpacing: -0.3, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
          }}>
            {fmtSigned(delta)}
          </div>
          <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--c-text3)', letterSpacing: '0.07em', textTransform: 'uppercase', marginTop: 3 }}>
            {delta === 0 ? 'No change' : improves ? 'Better off' : 'Worse off'}
          </div>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`${label}: today ${fmtCompact(b)}, after this choice ${fmtCompact(a)}. Change ${fmtSigned(delta)}.`}
        style={{ display: 'block', marginTop: 6, overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="dc-ba-after" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={improves ? POS_COLOR : NEG_COLOR} stopOpacity="0.6" />
            <stop offset="1" stopColor={improves ? POS_COLOR : NEG_COLOR} stopOpacity="1" />
          </linearGradient>
        </defs>

        {bars.map(bar => {
          const len = lenOf(bar.value)
          const isAfter = bar.key === 'after'
          const fill = isAfter ? 'url(#dc-ba-after)' : 'var(--c-text3)'
          const valColor = bar.value < 0 ? NEG_COLOR : 'var(--c-text)'
          return (
            <g key={bar.key}>
              <text x={PAD.left} y={bar.y - 4}
                fontSize="10" fontWeight="700"
                fill="var(--c-text2)" fontFamily="Inter,sans-serif">
                {bar.name}
              </text>

              {/* Track */}
              <rect x={PAD.left} y={bar.y} width={plotW} height={barH} rx={barH / 2}
                fill="var(--c-surface2)" stroke="var(--c-border)" strokeWidth="0.75" opacity="0.7" />

              {/* Value bar */}
              {bar.value > 0 && (
                <rect
                  className={isAfter ? 'sw-stroke-draw' : undefined}
                  x={PAD.left} y={bar.y} width={Math.max(2, len)} height={barH} rx={barH / 2}
                  fill={fill}
                  opacity={isAfter ? 1 : 0.55}
                  style={isAfter ? { filter: 'drop-shadow(0 0 8px var(--c-radar-glow))' } : undefined} />
              )}

              {/* £ value label at the bar end */}
              <text
                x={Math.min(W - PAD.right, PAD.left + Math.max(len, 0) + 8)}
                y={bar.y + barH / 2 + 4}
                textAnchor={len > plotW - 70 ? 'end' : 'start'}
                fontSize="12" fontWeight="800"
                fill={valColor} fontFamily="Inter,sans-serif"
                style={{ fontVariantNumeric: 'tabular-nums' }}>
                {fmtCompact(bar.value)}
              </text>
            </g>
          )
        })}
      </svg>

      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.5 }}>
        {delta === 0
          ? <>This choice leaves your <strong style={{ color: 'var(--c-text)' }}>{label.toLowerCase()}</strong> unchanged.</>
          : <>This choice moves your <strong style={{ color: 'var(--c-text)' }}>{label.toLowerCase()}</strong> from{' '}
              <strong style={{ color: 'var(--c-text)' }}>{fmtCompact(b)}</strong> to{' '}
              <strong style={{ color: deltaColor }}>{fmtCompact(a)}</strong>{' '}
              — {improves ? 'a gain' : 'a fall'} of <strong style={{ color: deltaColor }}>{fmtCompact(Math.abs(delta))}</strong>.</>}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared style tokens (theme variables only)
// ─────────────────────────────────────────────────────────────────────────────

const cardStyle = {
  padding: 18,
  background: 'var(--card-bg2)',
  border: '1px solid var(--c-border)',
  borderRadius: 'var(--r-lg, 20px)',
  boxShadow: 'var(--sh2)',
}

const legendItem = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
}

const swatch = {
  width: 14,
  height: 6,
  borderRadius: 100,
  display: 'inline-block',
}
