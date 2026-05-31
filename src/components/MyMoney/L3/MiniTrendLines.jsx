// MiniTrendLines.jsx — pure SVG. N polylines on a shared y-scale so multiple
// pots are visually comparable. No data fetching, no engine calls.
// series: number[][] (one array per line). Empty/zero-safe (renders nothing).

const PALETTE = ['var(--c-acc,#5ddbc2)', 'var(--c-gold,#E8B84B)', 'var(--c-violet,#9B8CFF)', 'var(--c-coral,#FF6F7D)']

export function MiniTrendLines({ series = [], colors = PALETTE, width = 88, height = 28, strokeWidth = 1.5 }) {
  const lines = (series || []).filter(s => Array.isArray(s) && s.length > 1)
  if (!lines.length) return null
  const all = lines.flat()
  const min = Math.min(...all), max = Math.max(...all)
  const span = max - min || 1
  const x = (i, len) => (len <= 1 ? 0 : (i / (len - 1)) * (width - strokeWidth)) + strokeWidth / 2
  const y = (v) => height - strokeWidth / 2 - ((v - min) / span) * (height - strokeWidth)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="projected trend" style={{ display: 'block' }}>
      {lines.map((s, li) => (
        <polyline
          key={li}
          fill="none"
          stroke={colors[li % colors.length]}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
          points={s.map((v, i) => `${x(i, s.length).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}
          opacity={0.9}
        />
      ))}
    </svg>
  )
}
