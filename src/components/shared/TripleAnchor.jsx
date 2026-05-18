// ─────────────────────────────────────────────────────────────────────────────
// SONUSWEALTH — TRIPLE ANCHOR
// Three co-equal tiles at the top of every primary surface:
//   Net Worth  ·  Sonuswealth Wealth Score  ·  Sonuswealth Risk Score
// Per D-ANCHOR-1 (20 April 2026): equal weight, equal tile size, always
// rendered together. Never a twin-anchor, never a solo-anchor.
//
// Consumed by: every primary screen (Home, MyMoney, Cashflow, T&E, Risk,
//              Timeline, Ask).
// Props:
//   netWorthVal  number
//   fqTotal      number (0-100)
//   fqBand       { name, colour }
//   riskTotal    number (0-100)
//   riskBand     { name, colour }
//   deltaFQ      number — simulation delta (positive = better)
//   isSimulating boolean — shows delta chip when true
// ─────────────────────────────────────────────────────────────────────────────

import { fmt } from '../../engine/fq-calculator.js'

export default function TripleAnchor({
  netWorthVal,
  fqTotal,
  fqBand,
  riskTotal,
  riskBand,
  deltaFQ = 0,
  isSimulating = false,
  nwTrendPct = null,    // MoM % change in NW — shows trend arrow in the NW tile
  onWealthTap,
  onRiskTap,
  onNetWorthTap,
}) {
  // Defensive — bands should always be passed, but failing loudly in dev is worse
  // than failing gracefully in a demo. Per FP-4 we would rather show an explicit
  // gap than a confident wrong value.
  const safeFqBand   = fqBand   || { name: '—', colour: 'var(--c-text3)' }
  const safeRiskBand = riskBand || { name: '—', colour: 'var(--c-text3)' }

  return (
    <div style={{
      display:    'flex',
      alignItems: 'stretch',
      padding:    '12px 16px 0',
      gap:        8,
    }}>
      {/* ─── Tile 1 — Net Worth ─── */}
      <Tile label="You own" onTap={onNetWorthTap}>
        <HeroNumber colour="var(--c-text)">
          {typeof fmt === 'function' ? fmt(netWorthVal ?? 0) : '—'}
        </HeroNumber>
        {nwTrendPct != null && (
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{
              fontSize: 10, fontWeight: 700,
              color: nwTrendPct > 0.1 ? 'var(--c-acc)' : nwTrendPct < -0.1 ? 'var(--c-coral, #FF6F7D)' : 'var(--c-text3)',
            }}>
              {nwTrendPct > 0.1 ? '↑' : nwTrendPct < -0.1 ? '↓' : '→'}{' '}
              {Math.abs(nwTrendPct).toFixed(1)}% this month
            </span>
          </div>
        )}
      </Tile>

      {/* ─── Tile 2 — Sonuswealth Wealth Score ─── */}
      <Tile label="Wealth Score" borderColour={`${safeFqBand.colour}44`} onTap={onWealthTap}>
        <ArcGauge value={fqTotal ?? 0} colour={safeFqBand.colour} />
        {isSimulating && deltaFQ !== 0 && <DeltaChip delta={deltaFQ} />}
        <BandLabel colour={safeFqBand.colour}>{safeFqBand.name}</BandLabel>
      </Tile>

      {/* ─── Tile 3 — Sonuswealth Risk Score ─── */}
      <Tile label="Risk Score" borderColour={`${safeRiskBand.colour}44`} onTap={onRiskTap}>
        <ArcGauge value={riskTotal ?? 0} colour={safeRiskBand.colour} />
        <BandLabel colour={safeRiskBand.colour}>{safeRiskBand.name}</BandLabel>
      </Tile>
    </div>
  )
}

// ─── Sub-components (file-local; not exported) ──────────────────────────────

// ArcGauge — 220° SVG arc gauge for scores /100.
// Red zone <40 · amber 40-70 · green >70. Needle at current value.
function ArcGauge({ value = 0, colour = 'var(--c-acc)' }) {
  const W = 80, H = 52, cx = W / 2, cy = H - 6, r = 30
  const START_DEG = 200   // bottom-left
  const END_DEG   = 340   // bottom-right  (220° sweep)
  const SWEEP     = END_DEG - START_DEG  // 140... wait let me recalc

  // Arc goes from 200° to 340° clockwise (200° total sweep)
  // value 0 = 200°, value 100 = 340° (but visually: 0=left, 100=right bottom)
  // Let's use: start at 215° (bottom-left), end at 325° (bottom-right), 110° sweep each side = 220° total
  const ARC_START = 215  // degrees from top-right (SVG convention)
  const ARC_END   = 325
  const ARC_SWEEP = ARC_END - ARC_START  // = 110? No let's do full 220° correctly

  // Simplest correct approach: start = -200° from top = 160° in std coords
  // Use: start angle -200 deg from 3-o-clock = 160 deg. End = -20 deg = 340 deg. Sweep = 180+20=200?
  // Simpler: just hardcode using sin/cos directly
  const toRad = (deg) => (deg - 90) * Math.PI / 180  // 0° = top

  // Arc: starts at 200° (measured from top, clockwise), ends at 340°, sweep 140° each side
  // Better: starts at 225° from top, ends at 315° from top = 90° sweep. Too short.
  // FINAL: starts 210°, ends 330°, sweep 120° per side, total 240°
  const arcStart = 210
  const arcEnd   = 330
  const arcSweep = arcEnd - arcStart  // 120... but we want ~220°
  // OK let me just do: start=130° from positive X axis (SVG), end=50° from positive X
  // In SVG: 0° = 3-o-clock. Angles increase clockwise.
  // I want a bottom-open horseshoe: start ~135°, end ~45°, going clockwise via bottom
  // That's a sweep of 360-90 = 270°. Too much.
  // Standard gauge: start 135° end 45° going counter-clockwise = 90°. Too little.
  // Standard wealth gauge: 220° sweep, centered at bottom
  // Start: 160° (from SVG 0 = 3-o-clock). End: 20°. Going counter-clockwise from 160° to 20° = 140°. No.
  // Going clockwise from 160° to 380°(=20°) = 220°. YES.

  const SA = 160  // SVG degrees (0=right, increases clockwise)
  const EA = 380  // = 20 in SVG coords, reached going clockwise from 160
  const sweep = 220
  const needle = SA + (value / 100) * sweep

  function polarToCart(deg, radius = r) {
    const rad = (deg * Math.PI) / 180
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
  }

  const s = polarToCart(SA)
  const e = polarToCart(EA % 360)
  const n = polarToCart(needle)

  // Track arc path (grey background)
  const trackPath = `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 1 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`
  // Value arc (colored fill up to needle)
  const valueSweep = (value / 100) * sweep
  const largeArc   = valueSweep > 180 ? 1 : 0
  const vEnd = polarToCart(SA + valueSweep)
  const valuePath = valueSweep > 0
    ? `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${vEnd.x.toFixed(2)} ${vEnd.y.toFixed(2)}`
    : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 2 }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" style={{ overflow: 'visible' }}>
        {/* Track */}
        <path d={trackPath} fill="none" stroke="var(--c-surface2)" strokeWidth="5" strokeLinecap="round" />
        {/* Value arc */}
        {valuePath && (
          <path d={valuePath} fill="none" stroke={colour} strokeWidth="5" strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${colour}66)` }} />
        )}
        {/* Needle dot */}
        <circle cx={n.x.toFixed(2)} cy={n.y.toFixed(2)} r="4" fill={colour}
          style={{ filter: `drop-shadow(0 0 6px ${colour})` }} />
        {/* Score label */}
        <text x={cx} y={cy - 4} textAnchor="middle" fill={colour}
          fontSize="18" fontWeight="800" fontVariantNumeric="tabular-nums"
          style={{ fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="var(--c-text3)" fontSize="9">
          /100
        </text>
      </svg>
    </div>
  )
}

function Tile({ label, borderColour, onTap, children }) {
  return (
    <div
      onClick={onTap}
      role={onTap ? 'button' : undefined}
      className="sw-card"
      style={{
        flex:         1,
        background:   'var(--c-surface)',
        border:       `1px solid ${borderColour || 'var(--c-border2)'}`,
        borderRadius: 'var(--r-lg)',
        padding:      'var(--space-lg)',
        minWidth:     0,
        cursor:       onTap ? 'pointer' : 'default',
      }}>
      <div className="sw-eyebrow" style={{ marginBottom: 8 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function HeroNumber({ colour, children }) {
  return (
    <span style={{
      fontSize:      'var(--fs-hero)',
      fontWeight:    800,
      color:         colour,
      letterSpacing: -0.5,
      lineHeight:    1.1,
      transition:    'color .3s, background .3s',
      display:       'inline-block',
    }}>
      {children}
    </span>
  )
}

// Heuristic: pick a tinted-pill modifier from the band's hex/css colour.
// Falls back to neutral; band-name strings are kept human-readable.
function bandChipClass(colour) {
  const c = String(colour || '').toLowerCase()
  // Hex shortcuts (matches engine band palette)
  if (/--c-acc\b|2df2c3|7ef0a8|34c759|00e5a8/.test(c))   return 'sw-chip-mint'
  if (/--c-acc2\b|7aa7ff|7aa5ff|4d8eff|007aff/.test(c)) return 'sw-chip-blue'
  if (/--c-acc3\b|--c-coral\b|ff6f7d|ff8a8a|ff3b30/.test(c)) return 'sw-chip-coral'
  if (/--c-gold\b|ffbd59|ffb347|ffc988|ff9500/.test(c)) return 'sw-chip-amber'
  if (/--c-violet\b|ba8cff|c788f5|af52de/.test(c))      return 'sw-chip-violet'
  return ''
}

function BandLabel({ colour, children }) {
  const tone = bandChipClass(colour)
  return (
    <div style={{ marginTop: 8 }}>
      <span
        className={`sw-chip sw-chip-sm ${tone}`}
        style={!tone ? { color: colour } : undefined}
      >
        {children}
      </span>
    </div>
  )
}

function DeltaChip({ delta }) {
  const positive = delta > 0
  return (
    <span
      className={`sw-chip sw-chip-sm ${positive ? 'sw-chip-mint' : 'sw-chip-coral'}`}
      style={{ marginLeft: 2 }}
    >
      {positive ? '+' : ''}{Number.isFinite(delta) ? delta : 0}
    </span>
  )
}
