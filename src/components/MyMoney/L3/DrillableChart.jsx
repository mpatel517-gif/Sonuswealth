// ─────────────────────────────────────────────────────────────────────────────
// DrillableChart — wraps any chart with PP-3 + chart-drill behaviour.
//
// Default render: caller provides the inline chart JSX (sparkline, mini bar,
// gauge, etc.) as children. DrillableChart adds the drill affordance (dotted
// edge + hover outline + keyboard handler).
//
// Tap → invokes onDrill with the chart's metric + default window so the
// caller (panel-stack manager at MyMoney.jsx level) can push <L4ChartPanel>.
//
// Per design doc §2.4 — every chart, every screen uses this wrapper. Build
// once, reuse 30+ times.
//
// Props:
//   - metric         : string identifier (passed to getTimeSeries via L4 panel)
//   - defaultWindow  : per-chart story default ('1Y', '5Y', '10Y', 'All', etc.)
//   - granularity    : 'day' | 'week' | 'month' | 'quarter' | 'year' (default month)
//   - onDrill        : callback fired on tap with { metric, defaultWindow, granularity }
//   - children       : the inline chart JSX (sparkline, mini bar, gauge…)
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'

export function DrillableChart({
  metric,
  defaultWindow = '1Y',
  granularity   = 'month',
  onDrill,
  children,
}) {
  const [hover, setHover] = useState(false)

  const handleActivate = () => {
    if (typeof onDrill === 'function') {
      onDrill({ metric, defaultWindow, granularity })
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleActivate()
    }
  }

  return (
    <div
      className="sw-drillable-chart"
      role="button"
      tabIndex={0}
      data-metric={metric}
      onClick={handleActivate}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        borderBottom: '1px dotted rgba(93, 219, 194, 0.3)',
        cursor: 'pointer',
        outline: hover ? '1px solid rgba(93, 219, 194, 0.15)' : 'none',
        outlineOffset: 4,
        borderRadius: 4,
        padding: 2,
      }}
      aria-label={`Drill into ${metric} chart`}
    >
      {children}
    </div>
  )
}
