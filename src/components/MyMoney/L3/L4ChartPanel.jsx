// ─────────────────────────────────────────────────────────────────────────────
// L4ChartPanel — full-screen chart drill panel.
//
// Per design doc §2.4 — four control groups + the chart area:
//   1. Time window pills (1M/3M/6M/1Y/3Y/5Y/10Y/All)
//   2. Comparison overlay (None/Prior period/Benchmark/Plan/Another asset)
//   3. Chart type (Line/Area/Candle/Bar) — Wave 0 ships Line; rest = placeholder
//   4. Annotations (Contributions/Withdrawals/Life events/Macro/Volatility)
//
// Plus a hero block (current window's value + delta) and the chart canvas.
//
// Real chart rendering (SVG line + area + comparison overlay + annotations)
// lands in Wave 4. Wave 0 ships the SHELL with working time-window state
// + getTimeSeries integration + data-honesty (PP-7) gap rendering.
//
// Imports `getTimeSeries` from `src/engine/time-series.js` (W0-T3).
//
// Props:
//   - metric         : passed to getTimeSeries
//   - defaultWindow  : initial window selection
//   - granularity    : passed to getTimeSeries
//   - entity         : the persona entity object
//   - onBack         : callback when user dismisses (panel-stack manager handles nav)
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { getTimeSeries } from '../../../engine/time-series.js'

const TIME_WINDOWS = ['1M', '3M', '6M', '1Y', '3Y', '5Y', '10Y', 'All']
const COMPARISONS  = ['None', 'Prior period', 'Benchmark', 'Plan target', 'Another asset']
const CHART_TYPES  = ['Line', 'Area', 'Candle', 'Bar']
const ANNOTATIONS  = ['Contributions', 'Withdrawals', 'Life events', 'Macro events', 'Volatility band']

export function L4ChartPanel({
  metric,
  defaultWindow = '1Y',
  granularity   = 'month',
  entity,
  onBack,
}) {
  const [window, setWindow]           = useState(defaultWindow)
  const [comparison, setComparison]   = useState('None')
  const [chartType, setChartType]     = useState('Line')
  const [annotations, setAnnotations] = useState({ Contributions: false, Withdrawals: false, 'Life events': true, 'Macro events': false, 'Volatility band': false })

  const series = getTimeSeries(entity, metric, window, granularity)

  // Hero summary — current value (last point) + delta from first point in window
  const firstValue = series.points[0]?.value ?? null
  const lastValue  = series.points[series.points.length - 1]?.value ?? null
  const delta = (firstValue != null && lastValue != null) ? lastValue - firstValue : null
  const deltaPct = (firstValue != null && firstValue !== 0 && delta != null) ? (delta / firstValue) * 100 : null

  return (
    <div
      className="sw-l4-chart-panel"
      data-metric={metric}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 14,
      }}
    >
      {/* Hero */}
      <div
        className="sw-l4-hero"
        style={{
          background: 'linear-gradient(180deg, rgba(93,219,194,0.10), rgba(93,219,194,0.02))',
          border: '1px solid rgba(93,219,194,0.3)',
          borderRadius: 8,
          padding: '12px 14px',
        }}
      >
        <div
          className="sw-eyebrow"
          style={{
            fontSize: 8,
            opacity: 0.6,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {metric} · {window}
        </div>
        <div
          className="sw-l4-value"
          style={{
            fontSize: 26,
            fontWeight: 850,
            color: 'var(--c-text, #fff)',
          }}
        >
          {lastValue != null ? formatValue(lastValue) : 'No data'}
        </div>
        {delta != null && (
          <div
            style={{
              fontSize: 10,
              opacity: 0.75,
              marginTop: 3,
            }}
          >
            {delta >= 0 ? '↑' : '↓'} {formatValue(Math.abs(delta))}
            {deltaPct != null && ` (${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%)`}
            {' over '}{window}
          </div>
        )}
        {series.gaps && series.gaps.length > 0 && (
          <div
            className="sw-l4-data-honesty"
            style={{
              fontSize: 9,
              marginTop: 6,
              padding: '4px 6px',
              background: 'rgba(255,180,120,0.10)',
              border: '1px dashed rgba(255,180,120,0.3)',
              borderRadius: 4,
              color: 'rgba(255,180,120,0.95)',
            }}
          >
            {series.gaps.map((g, i) => (
              <div key={i}>⚠ {g.reason}{g.from && g.to ? ` (${g.from} → ${g.to})` : ''}</div>
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div
        className="sw-l4-controls"
        style={{
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 8,
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <ControlGroup label="TIME WINDOW">
          <PillRow items={TIME_WINDOWS} selected={window} onSelect={setWindow} />
        </ControlGroup>
        <ControlGroup label="COMPARE WITH">
          <PillRow items={COMPARISONS} selected={comparison} onSelect={setComparison} />
        </ControlGroup>
        <ControlGroup label="CHART TYPE">
          <PillRow items={CHART_TYPES} selected={chartType} onSelect={setChartType} />
        </ControlGroup>
        <ControlGroup label="SHOW ON CHART">
          <ToggleRow items={ANNOTATIONS} state={annotations} onToggle={(key) => setAnnotations(s => ({ ...s, [key]: !s[key] }))} />
        </ControlGroup>
      </div>

      {/* Chart canvas */}
      <div
        className="sw-l4-chart-area"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8,
          padding: 12,
          minHeight: 220,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
        }}
      >
        {series.points.length === 0
          ? <div style={{ fontSize: 11, opacity: 0.65 }}>
              No data for this metric · window {window}
            </div>
          : <>
              <div style={{ fontSize: 10, opacity: 0.5 }}>
                ✦ {chartType} rendering wires in Wave 4
              </div>
              <div style={{ fontSize: 9, opacity: 0.5, marginTop: 4 }}>
                {series.points.length} points loaded · {series.confidence} confidence
              </div>
              <div style={{ fontSize: 9, opacity: 0.4, marginTop: 4 }}>
                Comparison: {comparison} · Annotations: {Object.entries(annotations).filter(([_, v]) => v).map(([k]) => k).join(', ') || 'none'}
              </div>
            </>}
      </div>
    </div>
  )
}

function ControlGroup({ label, children }) {
  return (
    <div className="sw-l4-control-group">
      <div
        style={{
          fontSize: 8,
          opacity: 0.5,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  )
}

function PillRow({ items, selected, onSelect }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {items.map(item => (
        <button
          key={item}
          type="button"
          onClick={() => onSelect(item)}
          style={{
            padding: '3px 9px',
            borderRadius: 10,
            background: selected === item ? 'rgba(93,219,194,0.15)' : 'rgba(255,255,255,0.04)',
            border: '1px solid ' + (selected === item ? 'rgba(93,219,194,0.4)' : 'rgba(255,255,255,0.08)'),
            color: selected === item ? 'var(--c-acc, #5ddbc2)' : 'inherit',
            fontSize: 10,
            fontWeight: selected === item ? 600 : 400,
            cursor: 'pointer',
            opacity: selected === item ? 1 : 0.7,
          }}
        >
          {item}
        </button>
      ))}
    </div>
  )
}

function ToggleRow({ items, state, onToggle }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {items.map(item => (
        <button
          key={item}
          type="button"
          onClick={() => onToggle(item)}
          aria-pressed={!!state[item]}
          style={{
            padding: '3px 9px',
            borderRadius: 10,
            background: state[item] ? 'rgba(93,219,194,0.15)' : 'rgba(255,255,255,0.04)',
            border: '1px solid ' + (state[item] ? 'rgba(93,219,194,0.4)' : 'rgba(255,255,255,0.08)'),
            color: state[item] ? 'var(--c-acc, #5ddbc2)' : 'inherit',
            fontSize: 10,
            fontWeight: state[item] ? 600 : 400,
            cursor: 'pointer',
            opacity: state[item] ? 1 : 0.7,
          }}
        >
          {item}
        </button>
      ))}
    </div>
  )
}

// Minimal currency / number formatter used in hero. Domain-specific formatters
// land per metric in Wave 1+. For Wave 0, use the same heuristic as the
// existing `fmt` helper in fq-calculator.js.
function formatValue(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `£${(n / 1_000_000).toFixed(2)}m`
  if (abs >= 1_000)     return `£${(n / 1_000).toFixed(1)}k`
  return `£${n.toFixed(0)}`
}
