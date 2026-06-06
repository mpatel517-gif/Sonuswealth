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

// Compact £ formatter — ≥1m → £1.2m, ≥10k → £55k, below that exact with commas
// (£930, £2,030) so small values aren't lossily rounded to "£2k" or shown in a
// different style next to large ones (founder 2026-06-06: "+£930" beside "+£2k").
function fmtCompact(v) {
  const n = Number(v) || 0
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `£${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}m`
  if (abs >= 10_000)    return `£${Math.round(abs / 1_000)}k`
  return `£${Math.round(abs).toLocaleString('en-GB')}`
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
  // One unit for the WHOLE chart so bars never mix "£2,030" with "£15k" (founder
  // 2026-06-06). If the biggest bar is ≥£10k, everything shows in £k; else exact.
  const useK = maxAbs >= 10_000
  const fmtBar = (n) => {
    const a = Math.abs(n), s = n > 0 ? '+' : n < 0 ? '−' : ''
    if (a === 0) return '£0'
    if (a >= 1_000_000) return `${s}£${(a / 1e6).toFixed(1)}m`
    if (useK) return `${s}£${Math.round(a / 1000)}k`
    return `${s}£${Math.round(a).toLocaleString('en-GB')}`
  }

  return (
    <div className="sw-card sw-card-elevated" style={cardStyle}>
      <div className="sw-eyebrow">Compare your options</div>
      <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 3, marginBottom: 12 }}>{axisCaption}</div>

      {/* HTML rows (not a width-scaled SVG) so the type sizes MATCH the option
          cards below — an SVG at width:100% blew labels up to ~20px against the
          13px cards (founder 2026-06-06: "the format is too big, it doesn't
          match the rest of the analysis"). */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map(r => {
          const pct = Math.min(100, (Math.abs(r.value) / maxAbs) * 100)
          const barColor = r.value < 0 ? NEG_COLOR : POS_COLOR
          const valueColor = r.raw < 0 ? NEG_COLOR : (r.raw > 0 ? POS_COLOR : 'var(--c-text3)')
          return (
            <div key={r.id}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>{r.label}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: valueColor, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{fmtBar(r.raw)}</span>
              </div>
              {anyNeg ? (
                <div style={{ position: 'relative', height: 7, borderRadius: 100, background: 'var(--c-surface2)', border: '1px solid var(--c-border)' }}>
                  <div style={{ position: 'absolute', top: -2, bottom: -2, left: '50%', width: 1, background: 'var(--c-text3)', opacity: 0.6 }} />
                  {Math.abs(r.value) > 0 && (
                    <div style={{ position: 'absolute', top: 0, bottom: 0, borderRadius: 100, background: barColor, width: `${pct / 2}%`, left: r.value >= 0 ? '50%' : `${50 - pct / 2}%` }} />
                  )}
                </div>
              ) : (
                <div style={{ height: 7, borderRadius: 100, background: 'var(--c-surface2)', border: '1px solid var(--c-border)', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', borderRadius: 100, background: barColor }} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {anyNeg && (
        <div style={{ fontSize: 10.5, color: 'var(--c-text3)', marginTop: 10 }}>
          The line marks today — bars to the right are better than today, to the left are worse.
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

  // HTML rows (not a width-scaled SVG) so the type matches the surrounding cards
  // — same reasoning as PathComparisonChart (founder 2026-06-06).
  const maxVal = Math.max(1, Math.abs(b), Math.abs(a))
  const pctOf = (v) => Math.min(100, (Math.max(0, v) / maxVal) * 100)
  const bars = [
    { key: 'before', name: 'Today', value: b, after: false },
    { key: 'after',  name: 'After this choice', value: a, after: true },
  ]

  return (
    <div className="sw-card sw-card-elevated" style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <div className="sw-eyebrow">{label}: before and after</div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 16, fontWeight: 880, color: deltaColor,
            letterSpacing: -0.3, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
          }}>
            {fmtSigned(delta)}
          </div>
          <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--c-text3)', letterSpacing: '0.07em', textTransform: 'uppercase', marginTop: 3 }}>
            {delta === 0 ? 'No change' : improves ? 'Better off' : 'Worse off'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {bars.map(bar => {
          const valColor = bar.value < 0 ? NEG_COLOR : 'var(--c-text)'
          return (
            <div key={bar.key}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text2)' }}>{bar.name}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: valColor, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{fmtCompact(bar.value)}</span>
              </div>
              <div style={{ height: 9, borderRadius: 100, background: 'var(--c-surface2)', border: '1px solid var(--c-border)', overflow: 'hidden' }}>
                <div style={{ width: `${pctOf(bar.value)}%`, height: '100%', borderRadius: 100, background: bar.after ? (improves ? POS_COLOR : NEG_COLOR) : 'var(--c-text3)', opacity: bar.after ? 1 : 0.5 }} />
              </div>
            </div>
          )
        })}
      </div>

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
