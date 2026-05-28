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
  // Empty state when engine hasn't returned scenarios — never show fabricated figures.
  if (!scenarios || !scenarios.length) {
    return (
      <div className="sw-card sw-card-elevated" style={{
        padding: 14,
        background: 'var(--card-bg2)',
        border: '1px solid var(--c-border)',
        borderRadius: 'var(--r-lg, 20px)',
        boxShadow: 'var(--sh2)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 120,
        gap: 8,
      }}>
        <div className="sw-eyebrow">Cashflow scenarios</div>
        <div style={{ fontSize: 12, color: 'var(--c-text3)', textAlign: 'center', maxWidth: 260 }}>
          Calculating… engine needs drawdown targets to model your cashflow scenarios.
        </div>
      </div>
    )
  }

  const items = scenarios

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
                    {s.name ?? s.label ?? s.id}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--c-text3)' }}>
                    {fmtCompact(s.drawdownAnnual ?? s.annual_drawdown ?? 0)}/yr
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 3, lineHeight: 1.5 }}>
                  {s.desc ?? (() => {
                    const id = s.id || s.name || ''
                    const map = {
                      do_nothing: 'No drawdown — portfolio compounds and depletes only via spending elsewhere.',
                      guardrail:  'Guyton-Klinger floor — protects capital in down years.',
                      optimal:    'Tax-efficient draw within basic-rate band.',
                      bengen_4pct:'Classic 4% safe-withdrawal rate.',
                      custom:     'Your manual drawdown target.',
                    }
                    return map[id] || ''
                  })()}
                </div>
              </div>
              <Spark
                points={s.spark ?? (s.annual_table || []).map(r => +(r.portfolio || 0))}
                color={color}
              />
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
