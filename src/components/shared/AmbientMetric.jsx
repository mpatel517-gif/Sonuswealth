// ─────────────────────────────────────────────────────────────────────────────
// AmbientMetric — §13.5 magic family. Small SVG visualisations that sit next
// to numbers and give the metric a living, metaphorical feel:
//
//   <AmbientWaterGlass percent={0..1}>   — liquidity / cash buffer
//   <AmbientHourglass elapsed={0..1}>    — CoI countdown / time-to-impact
//   <AmbientSlope direction="up|down">    — score trajectory peek
//   <AmbientChannel percent={0..1}>      — cashflow / tax-bracket flow
//   <AmbientNestedRings count={3}>       — wrapper hierarchy peek
//
// All variants are inert — purely decorative, sized via CSS, theme-aware via
// tokens, respect `prefers-reduced-motion`. They never replace the number.
// ─────────────────────────────────────────────────────────────────────────────

const FILL = 'var(--c-acc)'
const SOFT = 'var(--c-text3)'
const SEP  = 'var(--c-sep)'

// ── Water glass ─────────────────────────────────────────────────────────────
// percent: 0 (empty) → 1 (full). Renders a small glass with water level.
export function AmbientWaterGlass({ percent = 0, size = 28, title }) {
  const p = Math.max(0, Math.min(1, percent))
  const W = 14, H = 22, glassTop = 4
  const waterTop = glassTop + (H - glassTop) * (1 - p)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${W} ${H + glassTop}`}
      aria-hidden={!title} aria-label={title} role={title ? 'img' : undefined}
      style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id="awg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={FILL} stopOpacity="0.85" />
          <stop offset="1" stopColor={FILL} stopOpacity="0.40" />
        </linearGradient>
      </defs>
      {/* Glass outline */}
      <rect x="1.5" y={glassTop} width={W - 3} height={H} rx="1.5"
        fill="none" stroke={SOFT} strokeWidth="0.9" opacity="0.55" />
      {/* Water */}
      <rect x="2.2" y={waterTop} width={W - 4.4}
        height={Math.max(0, H + glassTop - waterTop - 0.7)}
        fill="url(#awg)" rx="1" />
      {/* Surface highlight */}
      {p > 0 && (
        <line x1="2.2" y1={waterTop} x2={W - 2.2} y2={waterTop}
          stroke={FILL} strokeWidth="0.6" opacity="0.95" />
      )}
    </svg>
  )
}

// ── Hourglass ───────────────────────────────────────────────────────────────
// elapsed: 0 (all top) → 1 (all bottom). Sand piles in lower chamber as time
// passes (CoI compounds the longer you wait).
export function AmbientHourglass({ elapsed = 0.3, size = 28, title }) {
  const e = Math.max(0, Math.min(1, elapsed))
  const W = 16, H = 22
  return (
    <svg width={size} height={size} viewBox={`0 0 ${W} ${H}`}
      aria-hidden={!title} aria-label={title} role={title ? 'img' : undefined}
      style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id="ahg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--c-gold, #FFB347)" stopOpacity="0.90" />
          <stop offset="1" stopColor="var(--c-gold, #FFB347)" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      {/* Outline */}
      <path d={`M2 1 L${W - 2} 1 L${W / 2} ${H / 2} L${W - 2} ${H - 1} L2 ${H - 1} L${W / 2} ${H / 2} Z`}
        fill="none" stroke={SOFT} strokeWidth="0.9" opacity="0.6" strokeLinejoin="round" />
      {/* Top sand (drains as elapsed grows) */}
      <path d={`M3 2 L${W - 3} 2 L${W / 2 - 0.5 + (1 - e) * 0.5} ${H / 2 - 0.5} L${W / 2 + 0.5 - (1 - e) * 0.5} ${H / 2 - 0.5} Z`}
        fill="url(#ahg)" opacity={1 - e * 0.7} />
      {/* Bottom sand pile (grows with elapsed) */}
      <path d={`M${W / 2 - 0.4} ${H / 2 + 0.4} L${W / 2 + 0.4} ${H / 2 + 0.4} L${W - 3 - (1 - e) * 3} ${H - 2} L${3 + (1 - e) * 3} ${H - 2} Z`}
        fill="url(#ahg)" />
      {/* Falling thread */}
      {e > 0 && e < 1 && (
        <line x1={W / 2} y1={H / 2 + 0.2} x2={W / 2} y2={H / 2 + 2.5}
          stroke="var(--c-gold, #FFB347)" strokeWidth="0.5" opacity="0.85" />
      )}
    </svg>
  )
}

// ── Slope ───────────────────────────────────────────────────────────────────
// direction: 'up' or 'down'. Small mountain slope; gradient indicates trend.
export function AmbientSlope({ direction = 'up', size = 28, title }) {
  const up = direction === 'up'
  return (
    <svg width={size} height={size} viewBox="0 0 24 16"
      aria-hidden={!title} aria-label={title} role={title ? 'img' : undefined}
      style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id="asl" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor={up ? FILL : 'var(--c-acc3, #FF6F7D)'} stopOpacity="0.20" />
          <stop offset="1" stopColor={up ? FILL : 'var(--c-acc3, #FF6F7D)'} stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <path
        d={up
          ? 'M1 15 L7 11 L13 7 L19 4 L23 2 L23 15 Z'
          : 'M1 2 L7 5 L13 8 L19 12 L23 14 L23 15 L1 15 Z'}
        fill="url(#asl)" />
      <path
        d={up
          ? 'M1 15 L7 11 L13 7 L19 4 L23 2'
          : 'M1 2 L7 5 L13 8 L19 12 L23 14'}
        fill="none" stroke={up ? FILL : 'var(--c-acc3, #FF6F7D)'} strokeWidth="1" />
      {/* Walker dot */}
      <circle cx={up ? 19 : 19} cy={up ? 4 : 12} r="1.4"
        fill={up ? FILL : 'var(--c-acc3, #FF6F7D)'} />
    </svg>
  )
}

// ── Channel (flowing stream) ────────────────────────────────────────────────
// percent: 0 (low flow) → 1 (high flow). A horizontal stream with a marker
// crossing thresholds. Used for cashflow surplus / tax-bracket flow.
export function AmbientChannel({ percent = 0.5, size = 28, title }) {
  const p = Math.max(0, Math.min(1, percent))
  const W = 28, H = 12
  const markerX = 2 + p * (W - 4)
  return (
    <svg width={size * 1.6} height={size * 0.7} viewBox={`0 0 ${W} ${H}`}
      aria-hidden={!title} aria-label={title} role={title ? 'img' : undefined}
      style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id="ach" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={FILL} stopOpacity="0.10" />
          <stop offset="1" stopColor={FILL} stopOpacity="0.75" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="3" width={W - 1} height={H - 6} rx="2"
        fill="none" stroke={SEP} strokeWidth="0.7" />
      <rect x="1" y="3.5" width={p * (W - 2)} height={H - 7} rx="1.5"
        fill="url(#ach)" />
      {/* Threshold ticks at 25/50/75 */}
      {[0.25, 0.5, 0.75].map(t => (
        <line key={t}
          x1={t * W} y1="2.4" x2={t * W} y2="3.4"
          stroke={SOFT} strokeWidth="0.5" opacity="0.6" />
      ))}
      {/* Marker */}
      <circle cx={markerX} cy={H / 2} r="2" fill={FILL} />
    </svg>
  )
}

// ── Nested rings — wrapper hierarchy hint ───────────────────────────────────
export function AmbientNestedRings({ count = 3, size = 28, title }) {
  const n = Math.max(1, Math.min(5, count))
  const radii = Array.from({ length: n }, (_, i) => 4 + i * 3)
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      aria-hidden={!title} aria-label={title} role={title ? 'img' : undefined}
      style={{ flexShrink: 0 }}>
      {radii.map((r, i) => (
        <circle key={i} cx="12" cy="12" r={r}
          fill="none" stroke={FILL} strokeWidth="0.9"
          opacity={0.85 - i * 0.15} />
      ))}
    </svg>
  )
}
