// ─────────────────────────────────────────────────────────────────────────────
// DrillableNumber — wraps any displayed number with PP-3 drillability.
//
// Per design doc §2.4 — every drillable number gets:
//   - A dotted underline (visual cue)
//   - Click/Enter/Space opens <L4NumberPanel> via onDrill callback
//   - Keyboard accessible (role=button + tabIndex)
//
// The L4 navigation itself is the caller's responsibility — DrillableNumber
// only invokes onDrill with a full payload. Wave 1 wires a panel-stack manager
// at the screen level (MyMoney.jsx) that listens for onDrill events and pushes
// L4 panels onto the breadcrumb stack.
//
// Props:
//   - metric      : string identifier (used for analytics + breadcrumb label)
//   - value       : display string (e.g. '£18,750 of £60,000 used')
//   - formula     : optional — plain-English calculation breakdown
//   - source      : optional — provenance string ("AJ Bell + Aviva statements")
//   - confidence  : 'high' | 'medium' | 'low'
//   - breakdown   : optional — array passed through to L4NumberPanel section 4
//   - onDrill     : callback fired on tap with full payload
//   - children    : optional override for the displayed text (defaults to value)
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'

export function DrillableNumber({
  metric,
  value,
  formula,
  source,
  confidence = 'high',
  breakdown,
  onDrill,
  children,
}) {
  const [hover, setHover] = useState(false)

  const handleActivate = () => {
    if (typeof onDrill === 'function') {
      onDrill({ metric, value, formula, source, confidence, breakdown })
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleActivate()
    }
  }

  return (
    <span
      className="sw-drillable-number"
      role="button"
      tabIndex={0}
      onClick={handleActivate}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        borderBottom: '1px dotted rgba(93, 219, 194, 0.4)',
        cursor: 'pointer',
        outline: hover ? '1px solid rgba(93, 219, 194, 0.15)' : 'none',
        outlineOffset: 2,
        padding: '0 2px',
        borderRadius: 2,
      }}
      aria-label={`Drill into ${metric}`}
    >
      {children ?? value}
    </span>
  )
}
