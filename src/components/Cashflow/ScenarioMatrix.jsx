// ─────────────────────────────────────────────────────────────────────────────
// ScenarioMatrix — Cashflow §B 5-cashflow-scenarios picker.
//
// NOT a radio list (Stitch reference uses radios — we don't). Each scenario is
// a glass card row with:
//   · Name + 1-line description
//   · Annual draw amount
//   · Inline NW spark (12-year trajectory under that scenario)
//   · PoS chip (mint / gold / coral by threshold)
//   · Active state: glass border + accent glow + tiny scale lift
//
// Taps a row to select it; the parent component recomputes everything
// downstream of the selection (typically PoSChart overlay).
// ─────────────────────────────────────────────────────────────────────────────

function fmtCompact(v) {
  if (Math.abs(v) >= 1_000_000) return `£${(v / 1_000_000).toFixed(1)}m`
  if (Math.abs(v) >= 1_000)     return `£${(v / 1_000).toFixed(0)}k`
  return `£${Math.round(v)}`
}

function fmtPos(pos) {
  if (pos == null) return '—'
  return `${Math.round(pos * 100)}%`
}

function posTone(pos) {
  if (pos == null) return 'neutral'
  if (pos >= 0.9)  return 'mint'
  if (pos >= 0.75) return 'gold'
  return 'coral'
}

const TONE_COLOR = {
  mint:    'var(--c-acc)',
  gold:    'var(--c-gold)',
  coral:   'var(--c-coral, #FF6F7D)',
  neutral: 'var(--c-text3)',
}

// Tiny spark — pure SVG, no library.
function Spark({ points, color }) {
  if (!points?.length) return null
  const W = 80, H = 24
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = Math.max(1, max - min)
  const xs = points.map((_, i) => (i / (points.length - 1 || 1)) * (W - 4) + 2)
  const ys = points.map(v => H - 2 - ((v - min) / range) * (H - 4))
  let d = `M${xs[0].toFixed(1)},${ys[0].toFixed(1)}`
  for (let i = 1; i < points.length; i++) d += ` L${xs[i].toFixed(1)},${ys[i].toFixed(1)}`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ flexShrink: 0 }}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
    </svg>
  )
}

export default function ScenarioMatrix({
  scenarios = [],
  activeId = null,
  onSelect,
}) {
  // Provide a sensible default if no scenarios passed (so the component is
  // visually meaningful in isolation / Storybook-style rendering).
  const items = (scenarios && scenarios.length) ? scenarios : [
    { id: 'do-nothing', name: 'Do nothing',       desc: 'Current trajectory unchanged.',           drawdownAnnual: 0,      pos: 0.0,  spark: [10, 8, 6, 4, 2, 0, -2, -4, -6, -8, -10, -12] },
    { id: 'optimal',    name: 'Optimal',          desc: 'Engine-modelled best path.',              drawdownAnnual: 38_000, pos: 0.94, spark: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21] },
    { id: 'guardrail',  name: 'Guardrail-adjust', desc: 'Guyton-Klinger dynamic drawdown.',        drawdownAnnual: 34_000, pos: 0.88, spark: [10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15, 16] },
    { id: 'cautious',   name: 'Cautious',         desc: 'Lower draw, longer runway.',              drawdownAnnual: 28_000, pos: 0.97, spark: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22] },
    { id: 'ambitious',  name: 'Ambitious',        desc: 'Higher draw, accept sequence risk.',      drawdownAnnual: 46_000, pos: 0.68, spark: [10, 10, 10, 9, 9, 8, 7, 6, 5, 4, 3, 2] },
  ]

  return (
    <div className="sw-card sw-card-elevated" style={{
      padding: 14,
      background: 'var(--card-bg2)',
      border: '1px solid var(--c-border)',
      borderRadius: 'var(--r-lg, 20px)',
      boxShadow: 'var(--sh2)',
    }}>
      <div className="sw-eyebrow" style={{ marginBottom: 10 }}>
        Cashflow scenarios
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map(s => {
          const active = activeId === s.id
          const tone = posTone(s.pos)
          const color = TONE_COLOR[tone]
          return (
            <button
              key={s.id}
              onClick={() => onSelect?.(s.id)}
              className={`sw-pressable ${active ? 'sw-pill-active' : ''}`}
              style={{
                '--pill-tone': color,
                display: 'grid',
                gridTemplateColumns: '1fr 80px 60px',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                background: active ? undefined : 'var(--c-surface2)',
                border: active ? undefined : '1px solid var(--c-border)',
                borderRadius: 14,
                cursor: 'pointer',
                textAlign: 'left',
              }}>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-text)' }}>
                    {s.name}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--c-text3)' }}>
                    {fmtCompact(s.drawdownAnnual)}/yr
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 3, lineHeight: 1.5 }}>
                  {s.desc}
                </div>
              </div>
              <Spark points={s.spark} color={color} />
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: 15, fontWeight: 800, color,
                  letterSpacing: -0.2, lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {fmtPos(s.pos)}
                </div>
                <div style={{
                  fontSize: 9, fontWeight: 700, color: 'var(--c-text3)',
                  letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 3,
                }}>
                  PoS
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
