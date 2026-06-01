// MiniTrendLines.jsx — pure SVG. N polylines on a shared y-scale so multiple
// pots are visually comparable. No data fetching, no engine calls.
// series: number[][] (one array per line). Empty/zero-safe (renders nothing).

const PALETTE = ['var(--c-acc,#5ddbc2)', 'var(--c-gold,#E8B84B)', 'var(--c-violet,#9B8CFF)', 'var(--c-coral,#FF6F7D)']

export function MiniTrendLines({ series = [], colors = PALETTE, width = 88, height = 28, strokeWidth = 1.3, mode = 'pct' }) {
  // Each line is converted to % change from ITS OWN first point, then ALL lines
  // are plotted on ONE shared y-scale. This is what makes multiple holdings read
  // as genuinely different trends: a holding growing 12%/yr visibly rises above
  // one growing 5% (instead of every line being normalised to its own min/max,
  // which made same-shaped clones fill the box and look identical — founder
  // 2026-06-01: "Did you fix the multiple spark lines required?"). Subtle stroke
  // + soft glow keeps the prior single-line aesthetic.
  const lines = (series || []).filter(s => Array.isArray(s) && s.length > 1)
  if (!lines.length) return null
  // Each line = that holding's % change from its own start; ALL lines share one
  // y-scale. A sparkline's job is to show TREND, so we plot the growth slope, not
  // the absolute £ (which would make every line flat). Holdings growing faster
  // visibly rise above slower ones (Mr T investments fan from 4%→12%); holdings
  // that genuinely grow at the same rate sit together — honest, not a fake fan.
  // mode='absolute' (tiles): keep real £ heights on the shared scale, so N
  // different-sized holdings render as N visibly distinct lines even at the same
  // growth rate (a £385k residence sits above a £198k let property). The
  // separation is the real size difference — not a fabricated fan. mode='pct'
  // (drill): % change from each line's own start, to compare TREND/slope.
  const pctLines = mode === 'absolute'
    ? lines.map(s => s.map(v => +v || 0))
    : lines.map(s => {
        const base = s.find(v => Math.abs(+v) > 0)
        if (!base) return s.map(() => 0)
        return s.map(v => ((+v - base) / Math.abs(base)) * 100)
      })
  const all = pctLines.flat()
  let lo = Math.min(...all), hi = Math.max(...all)
  if (hi - lo < 0.5) { hi += 0.5; lo -= 0.5 }   // tiny/zero movement → keep a readable band
  const span = hi - lo
  const x = (i, len) => (len <= 1 ? 0 : (i / (len - 1)) * (width - strokeWidth)) + strokeWidth / 2
  const y = (v) => height - strokeWidth / 2 - ((v - lo) / span) * (height - strokeWidth)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="projected trend" style={{ display: 'block' }}>
      {pctLines.map((s, li) => {
        const stroke = colors[li % colors.length]
        return (
          <polyline
            key={li}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={s.map((v, i) => `${x(i, s.length).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}
            opacity={0.75}
            style={{ filter: `drop-shadow(0 0 2px color-mix(in srgb, ${stroke} 55%, transparent))` }}
          />
        )
      })}
    </svg>
  )
}
