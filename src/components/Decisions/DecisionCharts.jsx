// ─────────────────────────────────────────────────────────────────────────────
// DecisionCharts — Choices option visualisers (Sonuswealth).
//
// Three presentational charts that let a non-expert read a choice at a glance.
// All text is real HTML at fixed px sizes (NOT SVG <text>, which scales with
// container width and blew labels up to ~20px against 13px cards — founder
// 2026-06-06: "the format is too big, it doesn't match the rest of the
// analysis"). Lines/areas use SVG with NO text inside; every label is HTML
// positioned around the plot. Theme CSS variables only; works light + dark.
//
//   1. PathComparisonChart — proper-weight horizontal bars comparing each
//      option's change vs today on ONE headline metric (net worth / IHT /
//      financial-health score). Negatives diverge left of a today-marker in
//      coral; positives right in accent. The single comparison surface — the
//      option cards no longer repeat these numbers.
//
//   2. DecisionTrajectoryChart — where each option takes your net worth OVER
//      TIME (today → horizon), one line per option, with a today anchor, the
//      net growth rate stated, and a labelled range of outcomes. For decisions
//      where time is the point (pension, mortgage, drawdown). Decumulating
//      curves turn over — no infinite-growth lie.
//
//   3. BeforeAfterBar — today vs after-this-choice for a single metric, delta
//      called out. Used on the recommendation step.
//
// Pure presentational: no data fetching, no hardcoded amounts.
// ─────────────────────────────────────────────────────────────────────────────

const POS_COLOR = 'var(--c-acc)'
const NEG_COLOR = 'var(--c-coral, #FF6F7D)'
// Up to 3 option lines on the trajectory — distinct, theme-safe hues.
const SERIES_COLORS = ['var(--c-acc)', '#C58CFF', '#FFB347']

// Compact £ — ≥1m → £1.2m, ≥10k → £55k, below that exact with commas (£930,
// £2,030) so small values aren't lossily rounded next to large ones.
function fmtCompact(v) {
  const n = Number(v) || 0
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `£${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}m`
  if (abs >= 10_000)    return `£${Math.round(abs / 1_000)}k`
  return `£${Math.round(abs).toLocaleString('en-GB')}`
}

function fmtSigned(v) {
  const n = Number(v) || 0
  if (n === 0) return '£0'
  return `${n > 0 ? '+' : '−'}${fmtCompact(n)}`
}

// Headline-metric metadata. valueKey → how to read/label/aim each metric.
//   betterUp: a positive change points right (good). For IHT a SMALLER bill is
//   better, so we flip the bar direction but keep the displayed figure honest.
const METRIC = {
  nw:     { caption: 'Net-worth change vs today',          unit: '£',   betterUp: true,  signed: true },
  iht:    { caption: 'Inheritance-tax change vs today',    unit: '£',   betterUp: false, signed: true },
  fq:     { caption: 'Financial-health score change',      unit: 'pts', betterUp: true,  signed: true },
  // A LEVEL (income you keep AFTER tax, each year), not a change-vs-today —
  // signed:false so bars read "£10k" not "+£10k". This is the NET figure, so the
  // bar ties out exactly with the "Income you keep / yr" factor on the cards
  // (founder 2026-06-06: the bar showed net while the card led with gross rent —
  // two numbers for one quantity).
  income: { caption: 'Income you keep each year (after tax)', unit: '£', betterUp: true,  signed: false },
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PathComparisonChart — the single headline comparison
// ─────────────────────────────────────────────────────────────────────────────

// `scrub` (optional) makes the bars draggable: the options share ONE input (the
// amount lever), so grabbing any bar and dragging left/right scrubs that shared
// amount and ALL bars rescale together (founder 2026-06-07: "these bars should
// be sliders too"). Relative drag (delta from grab point), so a bar never snaps
// to the cursor — the fill still encodes the OUTCOME, not the input, so the
// comparison is preserved. The labelled OptionLever above stays the precise /
// keyboard-accessible control and moves in lockstep.
export function PathComparisonChart({ paths, valueKey = 'nw', axisLabel, scrub }) {
  const list = Array.isArray(paths) ? paths.filter(Boolean).slice(0, 4) : []
  const meta = METRIC[valueKey] || METRIC.nw
  const axisCaption = axisLabel || meta.caption
  const canScrub = !!(scrub && scrub.lever && scrub.lever.max != null && typeof scrub.onChange === 'function')

  // Relative pointer-drag → adjust the shared amount by the horizontal delta from
  // the grab point. No jump-to-cursor (which would be wrong here, since the fill
  // is the outcome, not the amount). Keyboard users use the OptionLever above.
  const startScrub = (e) => {
    if (!canScrub) return
    e.preventDefault()
    const L = scrub.lever, min = L.min ?? 0, max = L.max, step = L.step || 1
    const el = e.currentTarget
    const trackW = el.getBoundingClientRect().width || 1
    const x0 = e.clientX, v0 = Number(scrub.value)
    try { el.setPointerCapture(e.pointerId) } catch { /* ignore */ }
    const move = (ev) => {
      const dx = (ev.clientX ?? x0) - x0
      let v = v0 + (dx / trackW) * (max - min)
      v = Math.round(v / step) * step
      scrub.onChange(Math.max(min, Math.min(max, v)))
    }
    const end = () => {
      try { el.releasePointerCapture(e.pointerId) } catch { /* ignore */ }
      el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', end); el.removeEventListener('pointercancel', end)
    }
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end)
  }

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

  const rows = list.map((p, i) => {
    const raw = Number(p?.simulation?.delta?.[valueKey]) || 0
    const dirValue = meta.betterUp ? raw : -raw   // good direction always points right
    return {
      id: p?.id ?? `path-${i}`,
      label: p?.plainLabel || p?.title || p?.label || `Option ${i + 1}`,
      raw,
      dirValue,
    }
  })

  const maxAbs = Math.max(1, ...rows.map(r => Math.abs(r.dirValue)))
  const anyNeg = rows.some(r => r.dirValue < 0)

  // One unit for the WHOLE chart so bars never mix "£2,030" with "£15k".
  const useK = meta.unit === '£' && maxAbs >= 10_000
  const signed = meta.signed !== false   // income is a LEVEL → no leading '+'
  const fmtBar = (n) => {
    const plus = signed ? '+' : ''
    if (meta.unit === 'pts') {
      const s = n > 0 ? plus : n < 0 ? '−' : ''
      return n === 0 ? '0 pts' : `${s}${Math.abs(Math.round(n))} pts`
    }
    const a = Math.abs(n), s = n > 0 ? plus : n < 0 ? '−' : ''
    if (a === 0) return '£0'
    if (a >= 1_000_000) return `${s}£${(a / 1e6).toFixed(1)}m`
    if (useK) return `${s}£${Math.round(a / 1000)}k`
    return `${s}£${Math.round(a).toLocaleString('en-GB')}`
  }

  const BAR_H = 22

  return (
    <div className="sw-card sw-card-elevated" style={cardStyle}>
      <div className="sw-eyebrow">Compare your options</div>
      <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 3, marginBottom: 14 }}>{axisCaption}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {rows.map(r => {
          const pct = Math.min(100, (Math.abs(r.dirValue) / maxAbs) * 100)
          const barColor = r.dirValue < 0 ? NEG_COLOR : POS_COLOR
          // The displayed figure colour follows the REAL change, not the
          // direction-normalised bar (a smaller IHT bill is shown as a negative
          // figure but a rightward/green bar).
          const goodChange = meta.betterUp ? r.raw > 0 : r.raw < 0
          // A £0 income option (you keep it / sell for cash) earns no rent — that's
          // a real choice, not a disabled one. Show "None", keep the row readable
          // (text2, not the muted text3 that reads as greyed-out), and render an
          // empty-state nub so the track isn't mistaken for a switched-off control
          // (G-3, audit BM-9 — founder 2026-06-06: "why are Keep / Sell greyed out").
          const isZeroIncome = valueKey === 'income' && r.raw === 0
          const valueColor = isZeroIncome ? 'var(--c-text2)'
            : r.raw === 0 ? 'var(--c-text3)' : (goodChange ? POS_COLOR : NEG_COLOR)
          // Income is a LEVEL — display it with the exact same £ formatter the
          // option cards use (fmtCompact ≡ the cards' fmt), so the bar string and
          // the "Income you keep / yr" card string are identical, never "£10k vs
          // £9,990" (founder 2026-06-06). nw/iht/fq keep the signed chart formatter.
          const valueText = isZeroIncome ? 'None'
            : valueKey === 'income' ? fmtCompact(r.raw) : fmtBar(r.raw)
          const scrubProps = canScrub
            ? { onPointerDown: startScrub, style: { cursor: 'ew-resize', touchAction: 'none' }, title: 'Drag to change the amount — all options update together' }
            : {}
          return (
            <div key={r.id}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', minWidth: 0, overflowWrap: 'anywhere' }}>{r.label}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: valueColor, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{valueText}</span>
              </div>
              {anyNeg ? (
                <div {...scrubProps} style={{ position: 'relative', height: BAR_H, borderRadius: 7, background: 'var(--c-surface2)', border: '1px solid var(--c-border)', ...(scrubProps.style || {}) }}>
                  <div style={{ position: 'absolute', top: -3, bottom: -3, left: '50%', width: 2, background: 'var(--c-text3)', opacity: 0.5, borderRadius: 2 }} />
                  {Math.abs(r.dirValue) > 0 && (
                    <div style={{ position: 'absolute', top: 2, bottom: 2, borderRadius: 5, background: barColor, width: `calc(${pct / 2}% - 1px)`, left: r.dirValue >= 0 ? '50%' : `calc(${50 - pct / 2}% + 1px)` }} />
                  )}
                  {canScrub && <BarGrip />}
                </div>
              ) : (
                <div {...scrubProps} style={{ position: 'relative', height: BAR_H, borderRadius: 7, background: 'var(--c-surface2)', border: '1px solid var(--c-border)', overflow: 'hidden', display: 'flex', alignItems: 'center', paddingLeft: isZeroIncome ? 10 : 0, ...(scrubProps.style || {}) }}>
                  {isZeroIncome
                    ? <span style={{ fontSize: 10, color: 'var(--c-text3)', fontStyle: 'italic' }}>earns no rent — see cash &amp; estate below</span>
                    : <div style={{ width: `${pct}%`, height: '100%', borderRadius: 5, background: barColor, minWidth: pct > 0 ? 4 : 0 }} />}
                  {canScrub && !isZeroIncome && <BarGrip />}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ fontSize: 10.5, color: 'var(--c-text3)', marginTop: 12, lineHeight: 1.5 }}>
        {canScrub && <><strong style={{ color: 'var(--c-text2)' }}>Drag any bar</strong> (or the slider above) to change the amount — all options share it and update together.{' '}</>}
        {!signed
          ? 'Longer bars mean more income kept after tax. Options earning no rent show "None" — their value is the cash or estate change on the cards below. Rental income is taxed at your rate; ISA and pension income is not.'
          : anyNeg
            ? 'The line marks today — longer bars to the right are better, to the left are worse.'
            : 'Longer bars are better. All figures are the change versus where you are today.'}
        {valueKey === 'iht' && ' A bar to the right means a smaller inheritance-tax bill.'}
      </div>
    </div>
  )
}

// Drag affordance shown on the right of an interactive comparison bar — two faint
// vertical rails that read as "grab here" without competing with the fill.
function BarGrip() {
  return (
    <div aria-hidden style={{ position: 'absolute', right: 6, top: 0, bottom: 0, display: 'flex', alignItems: 'center', gap: 2, pointerEvents: 'none', opacity: 0.55 }}>
      <span style={{ width: 2, height: 10, borderRadius: 2, background: 'var(--c-text3)' }} />
      <span style={{ width: 2, height: 10, borderRadius: 2, background: 'var(--c-text3)' }} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. DecisionTrajectoryChart — how much each option adds, over time
// ─────────────────────────────────────────────────────────────────────────────
//
// Plots the EXTRA net worth each option builds up versus today (the decision's
// effect), NOT absolute net worth — because the engine gives a decision delta,
// not a total-net-worth projection. Plotting absolute NW would draw a flat line
// for "do nothing" and imply zero growth, which is false. Here "do nothing"
// sits on the zero line and the others diverge from it; the endpoint equals the
// option's net-worth change, so it reconciles with the comparison bar. A faint
// band (±20%, widening with time) shows the result is a modelled range. This is
// a simple model on the user's assumptions, not a forecast — stated below.

export function DecisionTrajectoryChart({ paths, horizon }) {
  const list = (Array.isArray(paths) ? paths : []).filter(p => {
    const d = p?.simulation?.delta?.nw
    const ab = (p?.simulation?.after?.nw != null && p?.simulation?.before?.nw != null)
      ? p.simulation.after.nw - p.simulation.before.nw : null
    return Number.isFinite(d) || Number.isFinite(ab)
  }).slice(0, 3)

  if (list.length < 1) return null

  const H = Math.max(1, Math.round(horizon || list[0]?.simulation?.horizon || 10))
  const W = 600, PLOT_H = 150           // viewBox units; SVG scales but holds NO text
  const STEPS = 24

  const series = list.map((p, i) => {
    const d = p?.simulation?.delta?.nw
    const change = Number.isFinite(d) ? d : (p.simulation.after.nw - p.simulation.before.nw)
    return {
      id: p?.id ?? `t-${i}`,
      label: p?.plainLabel || p?.title || `Option ${i + 1}`,
      color: SERIES_COLORS[i % SERIES_COLORS.length],
      change,
      decumulates: change < 0,
      // Extra net worth building up from £0 (today) to `change` at the horizon.
      // Band = ±20% of the change, widening with time.
      pts: Array.from({ length: STEPS + 1 }, (_, s) => {
        const f = s / STEPS
        const t = f * H
        return { t, mid: change * f, lo: change * 0.8 * f, hi: change * 1.2 * f }
      }),
    }
  })

  // Shared scale across all series + bands; always include zero (the baseline).
  const allVals = series.flatMap(s => s.pts.flatMap(p => [p.mid, p.lo, p.hi])).concat(0)
  const minV = Math.min(...allVals), maxV = Math.max(...allVals)
  const span = Math.max(1, maxV - minV)
  const x = (t) => (t / H) * W
  const y = (v) => PLOT_H - ((v - minV) / span) * PLOT_H

  const line = (pts, key) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ')
  const band = (pts) => {
    const top = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(p.hi).toFixed(1)}`).join(' ')
    const bot = pts.slice().reverse().map(p => `L${x(p.t).toFixed(1)},${y(p.lo).toFixed(1)}`).join(' ')
    return `${top} ${bot} Z`
  }

  const anyDecum = series.some(s => s.decumulates)

  return (
    <div className="sw-card sw-card-elevated" style={cardStyle}>
      <div className="sw-eyebrow">How much each option adds, over time</div>
      <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 3, marginBottom: 12 }}>
        Extra net worth each option builds up versus today, over the next {H} years
      </div>

      {/* Plot: SVG holds only lines/areas (no text → no scaling trap). */}
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${PLOT_H}`} width="100%" height={PLOT_H} preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
          {/* zero baseline (= today / do-nothing) + today divider on the left */}
          <line x1="0" y1={y(0)} x2={W} y2={y(0)} stroke="var(--c-border)" strokeWidth="1.5" />
          <line x1="0" y1="0" x2="0" y2={PLOT_H} stroke="var(--c-text3)" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
          {series.map(s => (
            <path key={`b-${s.id}`} d={band(s.pts)} fill={s.color} opacity="0.10" stroke="none" />
          ))}
          {series.map(s => (
            <path key={`l-${s.id}`} d={line(s.pts, 'mid')} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {/* x-axis labels as HTML (fixed px) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--c-text3)', marginTop: 4 }}>
          <span>Today</span>
          <span>in {H} years</span>
        </div>
      </div>

      {/* Legend + endpoints as HTML rows (fixed px) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
        {series.map(s => (
          <div key={`leg-${s.id}`} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7, minWidth: 0 }}>
              <span style={{ width: 14, height: 3, borderRadius: 2, background: s.color, flexShrink: 0, alignSelf: 'center' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text)', minWidth: 0, overflowWrap: 'anywhere' }}>{s.label}</span>
            </span>
            <span style={{ fontSize: 12, fontWeight: 800, flexShrink: 0, fontVariantNumeric: 'tabular-nums', color: s.change > 0 ? POS_COLOR : s.change < 0 ? NEG_COLOR : 'var(--c-text3)' }}>
              {fmtSigned(s.change)}
            </span>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 10.5, color: 'var(--c-text3)', marginTop: 12, lineHeight: 1.5 }}>
        A model on your own assumptions, not a forecast. The shaded band shows how the result could vary.
        {anyDecum && ' Lines that fall show money being drawn down over time.'}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. BeforeAfterBar — today vs after this choice (recommendation step)
// ─────────────────────────────────────────────────────────────────────────────

export function BeforeAfterBar({ label = 'Net worth', before, after }) {
  const b = Number(before) || 0
  const a = Number(after) || 0
  const delta = a - b
  const improves = delta >= 0
  const deltaColor = delta === 0 ? 'var(--c-text3)' : (improves ? POS_COLOR : NEG_COLOR)

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
          <div style={{ fontSize: 16, fontWeight: 880, color: deltaColor, letterSpacing: -0.3, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
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
              <div style={{ height: 12, borderRadius: 7, background: 'var(--c-surface2)', border: '1px solid var(--c-border)', overflow: 'hidden' }}>
                <div style={{ width: `${pctOf(bar.value)}%`, height: '100%', borderRadius: 5, background: bar.after ? (improves ? POS_COLOR : NEG_COLOR) : 'var(--c-text3)', opacity: bar.after ? 1 : 0.5 }} />
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.5 }}>
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
