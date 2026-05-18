// ─────────────────────────────────────────────────────────────────────────────
// SequenceStressVis — Cashflow §B sequence-of-returns vulnerability.
//
// Visual design (Phase 2 Batch C):
//   · Two stacked sparks — "Good sequence" (gains early) vs "Bad sequence"
//     (losses early) over the same horizon
//   · End-state delta chip showing the difference in £
//   · Mint stroke for good, coral for bad, with drop-shadow glow
//   · Title + plain-English context line
// ─────────────────────────────────────────────────────────────────────────────

function fmt(v) {
  if (Math.abs(v) >= 1_000_000) return `£${(v / 1_000_000).toFixed(1)}m`
  if (Math.abs(v) >= 1_000)     return `£${(v / 1_000).toFixed(0)}k`
  return `£${Math.round(v)}`
}

function buildPath(pts, W, H, padX = 4, padY = 6) {
  if (!pts?.length) return ''
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const range = Math.max(1, max - min)
  const xs = pts.map((_, i) => padX + (i / (pts.length - 1 || 1)) * (W - padX * 2))
  const ys = pts.map(v => padY + (H - padY * 2) * (1 - (v - min) / range))
  let d = `M${xs[0].toFixed(1)},${ys[0].toFixed(1)}`
  for (let i = 1; i < pts.length; i++) d += ` L${xs[i].toFixed(1)},${ys[i].toFixed(1)}`
  return d
}

export default function SequenceStressVis({
  goodSequence = null,    // [v0, v1, ...] (NW path over horizon under favourable sequence)
  badSequence  = null,    // same shape, unfavourable sequence
  horizonYears = 30,
}) {
  // If no engine data, show an empty state — never render fabricated paths.
  if (!goodSequence && !badSequence) {
    return (
      <div className="sw-card sw-card-elevated" style={{
        padding: 16,
        background: 'var(--card-bg2)',
        border: '1px solid var(--c-border)',
        borderRadius: 'var(--r-lg, 20px)',
        boxShadow: 'var(--sh2)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 100,
        gap: 8,
      }}>
        <div className="sw-eyebrow">Sequence-of-returns vulnerability</div>
        <div style={{ fontSize: 12, color: 'var(--c-text3)', textAlign: 'center', maxWidth: 260 }}>
          Calculating… engine needs portfolio and drawdown data to model sequence risk.
        </div>
      </div>
    )
  }

  const good = (goodSequence && goodSequence.length) ? goodSequence : [0]
  const bad  = (badSequence  && badSequence.length)  ? badSequence  : [0]

  const goodEnd = good[good.length - 1]
  const badEnd = bad[bad.length - 1]
  const delta = goodEnd - badEnd

  const W = 320, H = 60
  return (
    <div className="sw-card sw-card-elevated" style={{
      padding: 16,
      background: 'var(--card-bg2)',
      border: '1px solid var(--c-border)',
      borderRadius: 'var(--r-lg, 20px)',
      boxShadow: 'var(--sh2)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div className="sw-eyebrow">Sequence-of-returns vulnerability</div>
          <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 4, lineHeight: 1.5, maxWidth: 280 }}>
            Same average return — different order. Early losses do permanent damage in drawdown.
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{
            fontSize: 9, fontWeight: 800, color: 'var(--c-text3)',
            letterSpacing: 0.6, textTransform: 'uppercase',
          }}>
            Outcome delta
          </div>
          <div style={{
            fontSize: 22, fontWeight: 880,
            color: delta > 0 ? 'var(--c-coral, #FF6F7D)' : 'var(--c-text)',
            letterSpacing: -0.3, lineHeight: 1, marginTop: 4,
            fontVariantNumeric: 'tabular-nums',
          }}>
            −{fmt(Math.abs(delta))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Good sequence row */}
        <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 80px', alignItems: 'center', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-acc)',
              letterSpacing: 0.4, textTransform: 'uppercase' }}>
              Good sequence
            </div>
            <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 2 }}>
              Gains first
            </div>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
            <path d={buildPath(good, W, H)}
              className="sw-stroke-draw"
              fill="none" stroke="var(--c-acc)" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray="600"
              style={{
                '--sw-draw-len': '600',
                filter: 'drop-shadow(0 0 8px var(--c-radar-glow))',
              }} />
          </svg>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--c-text)',
              fontVariantNumeric: 'tabular-nums' }}>
              {fmt(goodEnd)}
            </div>
            <div style={{ fontSize: 9, color: 'var(--c-text3)', marginTop: 2 }}>
              end {horizonYears}yr
            </div>
          </div>
        </div>

        {/* Bad sequence row */}
        <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 80px', alignItems: 'center', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-coral, #FF6F7D)',
              letterSpacing: 0.4, textTransform: 'uppercase' }}>
              Bad sequence
            </div>
            <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 2 }}>
              Losses first
            </div>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
            <path d={buildPath(bad, W, H)}
              className="sw-stroke-draw"
              fill="none" stroke="var(--c-coral, #FF6F7D)" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray="600"
              style={{
                '--sw-draw-len': '600',
                filter: 'drop-shadow(0 0 8px var(--c-acc3-bg))',
              }} />
          </svg>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--c-text)',
              fontVariantNumeric: 'tabular-nums' }}>
              {fmt(badEnd)}
            </div>
            <div style={{ fontSize: 9, color: 'var(--c-text3)', marginTop: 2 }}>
              end {horizonYears}yr
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
