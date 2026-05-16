// ─────────────────────────────────────────────────────────────────────────────
// CashflowWaterfall — Cashflow §A hero.
//
// NOT a horizontal stacked bar (Stitch pattern). My design (Phase 2 Batch C):
//   · Vertical descending — gross income at top, surplus at bottom
//   · Each step is a horizontal bar with width proportional to its value
//   · Connecting trails between steps show the deduction flow
//   · Surplus (final step) highlighted in mint accent with subtle glow
//   · Each step has an annotation chip on the right showing the percentage of
//     gross income consumed
//   · Animated stroke + opacity on mount (Batch B animations)
//
// Reading direction matches mental model: top = money in, bottom = money left.
// ─────────────────────────────────────────────────────────────────────────────

function fmt(v) {
  if (Math.abs(v) >= 1_000_000) return `£${(v / 1_000_000).toFixed(1)}m`
  if (Math.abs(v) >= 1_000)     return `£${(v / 1_000).toFixed(0)}k`
  return `£${Math.round(v)}`
}

const DEFAULT_STEPS = [
  { id: 'income',     label: 'Gross income',         value: 78000, kind: 'income' },
  { id: 'tax',        label: 'Tax & NI',             value: -27000, kind: 'deduction', note: 'Higher-rate band' },
  { id: 'pension',    label: 'Pension contribution', value: -8000,  kind: 'deduction', note: '40% relief' },
  { id: 'essentials', label: 'Essentials',           value: -29000, kind: 'deduction', note: 'Mortgage + bills' },
  { id: 'debt',       label: 'Debt service',         value: -9000,  kind: 'deduction', note: 'Loans + cards' },
  { id: 'surplus',    label: 'Monthly surplus',      value: 5000,   kind: 'surplus' },
]

const TONE = {
  income:    'var(--c-text)',
  deduction: 'var(--c-coral, #FF6F7D)',
  surplus:   'var(--c-acc)',
}

export default function CashflowWaterfall({ steps = DEFAULT_STEPS }) {
  // Convert steps into running balance.
  let running = 0
  const enriched = steps.map(s => {
    const before = running
    running = s.kind === 'income' ? s.value : running + s.value
    return { ...s, runningBefore: before, runningAfter: running }
  })

  // Bar width is proportional to running balance after step (or to step value
  // for the initial income step). All bars share the same max for visual
  // comparability.
  const max = Math.max(...enriched.map(s => Math.abs(s.runningAfter)), Math.abs(enriched[0]?.value || 1))
  const gross = enriched[0]?.value || 1

  return (
    <div className="sw-card sw-card-elevated" style={{
      padding: 18,
      background: 'var(--card-bg2)',
      border: '1px solid var(--c-border)',
      borderRadius: 'var(--r-lg, 20px)',
      boxShadow: 'var(--sh2)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div className="sw-eyebrow">Cashflow waterfall</div>
          <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 4 }}>
            Money in → out → what's left
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 22, fontWeight: 880, color: 'var(--c-acc)',
            letterSpacing: -0.3, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
          }}>
            {fmt(running)}
          </div>
          <div style={{
            fontSize: 9, fontWeight: 800, color: 'var(--c-text3)',
            letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 3,
          }}>
            Surplus
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {enriched.map((s, i) => {
          const valueForBar = s.kind === 'income' ? s.value : Math.abs(s.runningAfter)
          const pct = Math.max(2, Math.min(100, (valueForBar / max) * 100))
          const color = TONE[s.kind]
          const isLast = i === enriched.length - 1
          const isFirst = i === 0
          const pctOfGross = Math.abs((s.kind === 'income' ? s.value : s.value) / gross * 100)

          return (
            <div key={s.id} className="sw-cinema"
              style={{
                position: 'relative',
                animationDelay: `${i * 80}ms`,
              }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '120px 1fr 90px',
                alignItems: 'center',
                gap: 12,
              }}>
                {/* Label */}
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 700,
                    color: isFirst || isLast ? 'var(--c-text)' : 'var(--c-text2)',
                    lineHeight: 1.2,
                  }}>
                    {s.label}
                  </div>
                  {s.note && (
                    <div style={{
                      fontSize: 10, color: 'var(--c-text3)', marginTop: 2,
                    }}>
                      {s.note}
                    </div>
                  )}
                </div>

                {/* Bar */}
                <div style={{
                  position: 'relative',
                  height: isLast || isFirst ? 32 : 22,
                  background: 'var(--c-surface2)',
                  borderRadius: 6,
                  overflow: 'hidden',
                  boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.10)',
                }}>
                  <div style={{
                    position: 'absolute',
                    inset: '2px',
                    width: `calc(${pct}% - 4px)`,
                    borderRadius: 4,
                    background: isLast
                      ? `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 70%, transparent))`
                      : isFirst
                      ? 'linear-gradient(90deg, var(--c-text), var(--c-text2))'
                      : `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 35%, transparent))`,
                    transformOrigin: 'left center',
                    animation: 'sw-bar-grow 0.9s var(--ease-out-expo) both',
                    animationDelay: `${i * 80 + 200}ms`,
                    boxShadow: isLast ? '0 0 12px var(--c-radar-glow)' : 'none',
                  }} />
                </div>

                {/* Value chip */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: 13, fontWeight: 800,
                    color: s.kind === 'income' ? 'var(--c-text)'
                         : s.kind === 'surplus' ? 'var(--c-acc)'
                         : 'var(--c-coral, #FF6F7D)',
                    letterSpacing: -0.2,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {s.kind === 'income' ? '' : s.value < 0 ? '−' : '+'}
                    {fmt(Math.abs(s.value))}
                  </div>
                  {!isFirst && (
                    <div style={{
                      fontSize: 9, color: 'var(--c-text3)', marginTop: 2,
                      fontWeight: 600,
                    }}>
                      {pctOfGross.toFixed(0)}% of gross
                    </div>
                  )}
                </div>
              </div>

              {/* Connecting trail to next step (visual deduction indicator) */}
              {!isLast && s.kind !== 'income' && (
                <div style={{
                  position: 'absolute',
                  left: 130, right: 100,
                  bottom: -4, height: 4,
                  background: 'linear-gradient(180deg, color-mix(in srgb, var(--c-coral, #FF6F7D) 25%, transparent), transparent)',
                  borderRadius: 2,
                  opacity: 0.5,
                  pointerEvents: 'none',
                }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
