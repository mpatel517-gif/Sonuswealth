// ─────────────────────────────────────────────────────────────────────────────
// Num — number primitive (X15)
// Spec: architecture-master §14.
//
// Wraps every number we render so the rest of the app stops sprinkling
// formatting + confidence + diff + balances-hidden logic everywhere. Threads:
//
//   · format       'currency' | 'percent' | 'score' | 'days' | 'plain'
//   · confidence   'high' | 'medium' | 'low'  → font-style adjustment
//   · diff         { since, value } → renders DiffBadge inline
//   · hideBalances boolean → renders █-blocks instead of digits
//   · animate      boolean (default false) → counter-animates between values
//                  on change and band-flashes for 1200ms
//
// Composes with DiffBadge from Diff.jsx.
// Animation hooks live in src/hooks/useAnimation.jsx.
// ─────────────────────────────────────────────────────────────────────────────

import { DiffBadge } from './Diff.jsx'
import { useCounterAnimation, useDeltaFlash } from '../../hooks/useAnimation.jsx'

const CONF_STYLE = {
  high:   { fontStyle: 'normal', opacity: 1     },
  medium: { fontStyle: 'normal', opacity: 0.92  },
  low:    { fontStyle: 'italic', opacity: 0.78  },
}

function fmt(value, format) {
  if (value == null || !Number.isFinite(value)) return '—'
  switch (format) {
    case 'currency': {
      const abs = Math.abs(value)
      // Compact for large amounts: £1.2M, £45.3k
      if (abs >= 1_000_000) return `£${(value / 1_000_000).toFixed(2)}M`
      if (abs >= 10_000)    return `£${(value / 1_000).toFixed(1)}k`
      return '£' + Math.round(value).toLocaleString('en-GB')
    }
    case 'percent': return `${value.toFixed(1)}%`
    case 'score':   return `${Math.round(value)}`
    case 'days':    return `${Math.round(value)} day${Math.round(value) === 1 ? '' : 's'}`
    case 'plain':
    default:        return String(value)
  }
}

// Block-glyph ledger for hide-balances state. Picks an interesting-looking
// length so the eye doesn't read it as zero.
function obscure(format) {
  if (format === 'currency') return '£•••••'
  if (format === 'percent')  return '••%'
  if (format === 'score')    return '••'
  if (format === 'days')     return '•• days'
  return '•••'
}

// Tiny inner that runs the rAF animation only when `animate` is true. Hooks
// must be top-level inside a component — pulling this into its own component
// keeps the no-animation path zero-cost.
function AnimatedSpan({ value, format, style, children, ...rest }) {
  const formatted = useCounterAnimation(value, {
    duration: 800,
    format: (n) => fmt(n, format),
  })
  const flashing = useDeltaFlash(value)
  return (
    <span
      style={style}
      data-flash={flashing ? 'true' : undefined}
      className={flashing ? 'sw-band-flash' : undefined}
      {...rest}
    >
      {formatted}
      {children}
    </span>
  )
}

export default function Num({
  value,
  format = 'plain',
  confidence,
  diff,
  hideBalances = false,
  animate = false,
  children,           // optional unit suffix or sub-text
  style,
  ...rest
}) {
  const conf = CONF_STYLE[confidence] || {}

  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: 6,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: -0.2,
    transition: 'opacity .3s, color .3s',
    ...conf,
    ...style,
  }

  if (hideBalances) {
    return (
      <span style={baseStyle} {...rest}>
        <span>{obscure(format)}</span>
        {children}
      </span>
    )
  }

  // Animated path — only when explicitly opted-in and the value is finite.
  if (animate && typeof value === 'number' && Number.isFinite(value)) {
    return (
      <span style={baseStyle} {...rest}>
        <AnimatedSpan value={value} format={format}>
          {children}
        </AnimatedSpan>
        {diff && diff.value != null && (
          <DiffBadge
            value={diff.value}
            since={diff.since}
            format={diff.format || (format === 'plain' ? undefined : format)}
          />
        )}
      </span>
    )
  }

  // Static path (default — preserves existing behaviour).
  const text = fmt(value, format)
  return (
    <span style={baseStyle} {...rest}>
      <span>{text}</span>
      {children}
      {diff && diff.value != null && (
        <DiffBadge
          value={diff.value}
          since={diff.since}
          format={diff.format || (format === 'plain' ? undefined : format)}
        />
      )}
    </span>
  )
}

export { Num, fmt as fmtNum }
