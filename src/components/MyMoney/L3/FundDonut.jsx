// FundDonut.jsx — part-to-whole donut for "what's inside this pot" (charting law:
// composition gets a part-to-whole visual, not only a list). Pure SVG arcs on a
// shared palette so it lines up with the fund rows beneath it. Zero/empty-safe.
const PALETTE = ['var(--c-acc,#5ddbc2)', 'var(--c-gold,#E8B84B)', 'var(--c-violet,#9B8CFF)', 'var(--c-coral,#FF6F7D)', 'var(--c-text3,#8895a7)']

const fmt = (n) => {
  const a = Math.abs(Math.round(+n || 0))
  if (a >= 1e6) return `£${(a / 1e6).toFixed(2)}m`
  if (a >= 1e3) return `£${(a / 1e3).toFixed(0)}k`
  return `£${a.toLocaleString('en-GB')}`
}

export function FundDonut({ funds = [], colors = PALETTE, size = 116, thickness = 18 }) {
  const items = (funds || []).map(f => ({ name: f.name, value: +f.value || 0 })).filter(f => f.value > 0)
  const total = items.reduce((s, f) => s + f.value, 0)
  if (!total) return null

  const r = (size - thickness) / 2
  const cx = size / 2, cy = size / 2
  const circ = 2 * Math.PI * r
  let offset = 0
  const arcs = items.map((f, i) => {
    const frac = f.value / total
    const seg = { ...f, frac, color: colors[i % colors.length], dash: frac * circ, gap: circ - frac * circ, off: offset }
    offset += frac * circ
    return seg
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="fund composition" style={{ display: 'block' }}>
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {arcs.map((a, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={a.color} strokeWidth={thickness}
            strokeDasharray={`${a.dash.toFixed(2)} ${a.gap.toFixed(2)}`} strokeDashoffset={(-a.off).toFixed(2)} opacity="0.85" />
        ))}
      </g>
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="13" fontWeight="800" fill="var(--c-text)" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(total)}</text>
      <text x={cx} y={cy + 11} textAnchor="middle" fontSize="7" fill="var(--c-text3,#8895a7)">{items.length} holdings</text>
    </svg>
  )
}
