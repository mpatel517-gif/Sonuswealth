// ─────────────────────────────────────────────────────────────────────────────
// FundedRatioGauge — Cashflow §B plan anchor (per Cashflow v1.7 §2.1).
//
// Radial gauge showing the funded ratio (plan coverage): 0 to 1.4. Three zones:
//   · Under-funded   (0–0.85)    — coral
//   · Approaching    (0.85–1.0)  — amber
//   · On track       (1.0–1.1)   — mint accent
//   · Over-funded    (1.1+)      — soft mint
//
// Visual treatment per Batch B principles:
//   · 240° sweep arc (210°→30°) — leaves a 120° opening at the bottom
//   · Background track + score arc with stroke-draw animation
//   · Confidence band (10/90 percentile) rendered as a translucent overlay arc
//   · Hero number in centre with the ratio (1.18) + plain-English status
//   · Drop-shadow glow on the score arc
// ─────────────────────────────────────────────────────────────────────────────

const SIZE = 240
const CX = SIZE / 2
const CY = SIZE / 2
const R = SIZE * 0.36
const STROKE = 16

// Arc maths — sweep from 210° to 330° (clockwise = 240° total).
const ARC_START_DEG = 150       // 210° clockwise from 12 o'clock = -30° to the right at 3:30
const ARC_END_DEG = 30          // measured counterclockwise from positive x
const ARC_TOTAL_DEG = 240       // total sweep
const MAX_RATIO = 1.4

function ratioToAngle(ratio) {
  const clamped = Math.max(0, Math.min(MAX_RATIO, ratio))
  const pct = clamped / MAX_RATIO
  // Map 0..1 of ratio → ARC_START → ARC_END (going clockwise)
  // Using standard angle, sweep goes: 150° → 90° → 30° in CCW which is 210→270→330 in our system.
  // Simpler: parameterise t and use polar coords going CCW from 210°.
  const startRad = (180 + 30) * Math.PI / 180  // 210° in standard maths terms = pointing down-left
  const sweepRad = -ARC_TOTAL_DEG * Math.PI / 180  // negative = clockwise
  return startRad + sweepRad * pct
}

function pointAtRatio(ratio, radius = R) {
  const a = ratioToAngle(ratio)
  return {
    x: CX + radius * Math.cos(a),
    y: CY + radius * Math.sin(a),
  }
}

// SVG path for an arc from ratio0 to ratio1.
function arcPath(ratio0, ratio1, radius = R) {
  const p0 = pointAtRatio(ratio0, radius)
  const p1 = pointAtRatio(ratio1, radius)
  const sweep = ratio1 > ratio0 ? 0 : 1   // clockwise = sweep 0 in SVG
  const large = Math.abs(ratio1 - ratio0) / MAX_RATIO > 0.5 ? 1 : 0
  return `M${p0.x.toFixed(1)},${p0.y.toFixed(1)} A${radius},${radius} 0 ${large} ${sweep} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`
}

function statusFor(ratio) {
  if (ratio < 0.85) return { label: 'Under-funded', tone: 'coral', context: 'Plan target is more than current trajectory can cover.' }
  if (ratio < 1.0)  return { label: 'Approaching', tone: 'gold',  context: 'You’re close but a stress event would put you behind.' }
  if (ratio < 1.1)  return { label: 'On track',    tone: 'mint',  context: 'Plan coverage at target with a small margin.' }
  return                  { label: 'Over-funded',  tone: 'mint',  context: 'Comfortable margin above plan target.' }
}

const TONE_COLOR = {
  mint:  'var(--c-acc)',
  gold:  'var(--c-gold)',
  coral: 'var(--c-coral, #FF6F7D)',
}

export default function FundedRatioGauge({
  ratio = 1.0,
  confidence = null,    // { low: 0.85, high: 1.18 } percentile band
  fundedYears = null,   // optional context — "covers 27 years"
}) {
  const r = Number(ratio) || 0
  const status = statusFor(r)
  const color = TONE_COLOR[status.tone]
  const fillPath = arcPath(0, r)
  const trackPath = arcPath(0, MAX_RATIO)

  // Confidence band — rendered as a thinner arc overlay between low and high
  const confArc = confidence?.low != null && confidence?.high != null
    ? arcPath(confidence.low, confidence.high)
    : null

  return (
    <div className="sw-card sw-card-elevated" style={{
      padding: 20,
      background: 'var(--card-bg2)',
      border: '1px solid var(--c-border)',
      borderRadius: 'var(--r-lg, 20px)',
      boxShadow: 'var(--sh2)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div className="sw-eyebrow" style={{ marginBottom: 8 }}>
        Plan coverage · funded ratio
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap',
      }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{ flex: '0 1 200px', width: '100%', maxWidth: SIZE, height: 'auto', overflow: 'visible' }}>
          {/* Background track */}
          <path d={trackPath}
            fill="none"
            stroke="var(--c-sep)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            opacity="0.45" />

          {/* Zone marker ticks at 0.85 / 1.0 / 1.1 */}
          {[0.85, 1.0, 1.1].map(t => {
            const p = pointAtRatio(t, R)
            const inner = pointAtRatio(t, R - STROKE / 2 - 4)
            const outer = pointAtRatio(t, R + STROKE / 2 + 4)
            return (
              <line key={t}
                x1={inner.x.toFixed(1)} y1={inner.y.toFixed(1)}
                x2={outer.x.toFixed(1)} y2={outer.y.toFixed(1)}
                stroke="var(--c-text3)" strokeWidth="1.5" opacity="0.55" />
            )
          })}

          {/* Confidence band overlay */}
          {confArc && (
            <path d={confArc}
              fill="none"
              stroke={color}
              strokeWidth={STROKE + 4}
              strokeLinecap="round"
              opacity="0.18" />
          )}

          {/* Score arc — animated draw + glow */}
          <path d={fillPath}
            className="sw-stroke-draw"
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray="500"
            style={{
              '--sw-draw-len': '500',
              filter: 'drop-shadow(0 0 12px var(--c-radar-glow))',
            }} />

          {/* Hero number in centre */}
          <text x={CX} y={CY - 4}
            textAnchor="middle" dominantBaseline="middle"
            fontSize="40" fontWeight="800"
            fill="var(--c-text)"
            fontFamily="Inter,sans-serif"
            style={{ letterSpacing: '-0.5px' }}>
            {r.toFixed(2)}
          </text>
          <text x={CX} y={CY + 22}
            textAnchor="middle" dominantBaseline="middle"
            fontSize="10" fontWeight="700"
            fill="var(--c-text3)"
            fontFamily="Inter,sans-serif"
            style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            funded ratio
          </text>

          {/* Zone labels under the arc */}
          <text x={CX - R + 8} y={CY + R + 12}
            textAnchor="middle" fontSize="9" fontWeight="700"
            fill="var(--c-text3)"
            fontFamily="Inter,sans-serif">
            UNDER
          </text>
          <text x={CX} y={CY + R + 16}
            textAnchor="middle" fontSize="9" fontWeight="700"
            fill="var(--c-text3)"
            fontFamily="Inter,sans-serif">
            ON TRACK
          </text>
          <text x={CX + R - 8} y={CY + R + 12}
            textAnchor="middle" fontSize="9" fontWeight="700"
            fill="var(--c-text3)"
            fontFamily="Inter,sans-serif">
            OVER
          </text>
        </svg>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 100,
            background: `color-mix(in srgb, ${color} 14%, transparent)`,
            color, fontSize: 11, fontWeight: 800,
            letterSpacing: 0.4, textTransform: 'uppercase',
            marginBottom: 10,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: color,
              boxShadow: `0 0 8px ${color}`,
            }} />
            {status.label}
          </div>
          <div style={{
            fontSize: 14, fontWeight: 600, color: 'var(--c-text)',
            lineHeight: 1.5, marginBottom: 8,
          }}>
            {status.context}
          </div>
          {/* Plain-English meaning of the number itself — "what does 0.48 mean?"
              (founder 2026-06-05). The ratio is opaque without it. */}
          <div style={{
            fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.5, marginBottom: 10,
            padding: '7px 9px', borderRadius: 9,
            background: 'var(--c-surface2)', border: '1px solid var(--c-border)',
          }}>
            <strong style={{ color: 'var(--c-text)' }}>{r.toFixed(2)} means</strong> your investable pots
            would cover about <strong style={{ color }}>{Math.round(r * 100)}%</strong> of your target
            income for life at a safe withdrawal rate. <strong>1.00</strong> = pots alone fully cover it;
            below that, secure income (State Pension, DB) is expected to make up the rest.
          </div>
          {fundedYears != null && (
            <div style={{ fontSize: 12, color: 'var(--c-text2)' }}>
              Plan funds <strong style={{ color: 'var(--c-text)' }}>{fundedYears} years</strong> of target spending.
            </div>
          )}
          {confidence?.low != null && (
            <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 6 }}>
              Confidence band: {(confidence.low).toFixed(2)} – {(confidence.high).toFixed(2)} (10–90 percentile).
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
