// ─────────────────────────────────────────────────────────────────────────────
// L4NumberPanel — full-screen drill panel for any drillable number.
//
// Per design doc §2.4 — 6 sections:
//   1. Restated big number + plain-English explanation
//   2. Formula breakdown (HOW THIS IS CALCULATED)
//   3. Source provenance (WHERE THE DATA CAME FROM + confidence)
//   4. Visual breakdown (chart of the calculation — Wave 4 wires DrillableChart)
//   5. Action chips (X24 mode 2 — populated per metric in Wave 1+)
//   6. "What if this were different?" affordance (X24 mode 3 — Wave 5)
//
// This is the SHELL. Per-metric content lives in domain modules that pass
// `breakdown`, `formula`, `source`, etc. through DrillableNumber → L4 stack.
//
// Props (all optional except metric):
//   - metric      : string identifier (also rendered as eyebrow)
//   - value       : display string (the restated number)
//   - formula     : plain-English calculation breakdown
//   - source      : provenance string
//   - confidence  : 'high' | 'medium' | 'low'
//   - breakdown   : array of { label, value, ... } — Section 4 visual breakdown
//   - actions     : array of { label, onClick } — Section 5 action chips
//   - whatIf      : { available: boolean, hint?: string } — Section 6 gate
//   - onBack      : callback invoked when user dismisses the panel (e.g. back button)
// ─────────────────────────────────────────────────────────────────────────────

import { DrillableNumber } from './DrillableNumber.jsx'
import { useDrillStackContext } from './DrillStack.jsx'

export function L4NumberPanel({
  metric,
  value,
  formula,
  source,
  confidence = 'medium',
  breakdown,
  actions,
  whatIf,
  onBack,
}) {
  // L5+ recursive drill: any breakdown row carrying a `drill` payload
  // pushes the next-level L panel onto the stack when tapped.
  const { pushNumber } = useDrillStackContext()
  return (
    <div
      className="sw-l4-number-panel"
      data-metric={metric}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 14,
      }}
    >
      {/* Section 1 — Restated big number + plain-English explanation */}
      <div
        className="sw-l4-restated"
        style={{
          background: 'linear-gradient(180deg, rgba(93,219,194,0.10), rgba(93,219,194,0.02))',
          border: '1px solid rgba(93,219,194,0.3)',
          borderRadius: 8,
          padding: '16px 18px',
        }}
      >
        <div
          className="sw-eyebrow"
          style={{
            fontSize: 9,
            opacity: 0.6,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 4,
          }}
        >
          {metric}
        </div>
        <div
          className="sw-l4-value"
          style={{
            fontSize: 32,
            fontWeight: 850,
            color: 'var(--c-text, #fff)',
            letterSpacing: '-0.02em',
          }}
        >
          {value ?? '—'}
        </div>
      </div>

      {/* Section 2 — Formula breakdown */}
      <L4Section label="HOW THIS IS CALCULATED">
        <div style={{ fontSize: 11, fontWeight: 600 }}>
          {formula ?? 'Formula breakdown not yet wired for this metric'}
        </div>
      </L4Section>

      {/* Section 3 — Source provenance */}
      <L4Section label="WHERE THE DATA CAME FROM">
        <div style={{ fontSize: 11, fontWeight: 600 }}>{source ?? '—'}</div>
        <div style={{ fontSize: 9, opacity: 0.65, marginTop: 3 }}>
          Confidence: {confidence}
        </div>
      </L4Section>

      {/* Section 4 — Visual breakdown. Rows with a `.drill` payload become
          drillable; tapping them pushes the next L panel onto the stack
          (L4 → L5 → L6 — DrillStack supports arbitrary depth). */}
      <L4Section label="VISUAL BREAKDOWN">
        {breakdown
          ? <BreakdownList items={breakdown} pushNumber={pushNumber} />
          : <div style={{ fontSize: 9, opacity: 0.65 }}>
              Chart wires in Wave 4 · breakdown not provided
            </div>}
      </L4Section>

      {/* Section 5 — Action chips (X24 mode 2) */}
      <L4Section label="WHAT YOU CAN DO">
        {actions && actions.length > 0
          ? <ActionChips actions={actions} />
          : <div style={{ fontSize: 9, opacity: 0.65 }}>
              Action chips populated per metric in Wave 1+
            </div>}
      </L4Section>

      {/* Section 6 — X24 "What if this were different?" affordance */}
      <L4Section label="WHAT IF THIS WERE DIFFERENT?">
        {whatIf?.available
          ? <div style={{ fontSize: 11, fontWeight: 600 }}>{whatIf.hint ?? 'Adjust this value to see ripple effects across other tabs'}</div>
          : <div style={{ fontSize: 9, opacity: 0.65 }}>
              Goal-seek (X24 mode 3) wires per metric in Wave 5
            </div>}
      </L4Section>
    </div>
  )
}

// Reusable section frame — keeps every L4 section visually consistent.
function L4Section({ label, children }) {
  return (
    <div
      className="sw-l4-section"
      style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        padding: 10,
      }}
    >
      <div
        className="sw-l3-row-label"
        style={{
          fontSize: 8,
          opacity: 0.55,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  )
}

// Section-4 breakdown list. Each row carries an optional `.drill` payload
// (the next-level L panel content). When present, the value is rendered as
// a DrillableNumber that pushes the drill payload onto the stack.
function BreakdownList({ items, pushNumber }) {
  if (!Array.isArray(items) || items.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map((item, i) => (
        <div
          key={item.key ?? i}
          data-breakdown-row={item.key ?? i}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 10,
          }}
        >
          <span style={{ opacity: 0.7 }}>{item.label}</span>
          {item.drill && typeof pushNumber === 'function' ? (
            <span style={{ fontWeight: 600 }}>
              <DrillableNumber
                metric={item.drill.metric ?? item.label}
                value={item.value}
                formula={item.drill.formula}
                source={item.drill.source}
                confidence={item.drill.confidence}
                breakdown={item.drill.breakdown}
                onDrill={pushNumber}
              >
                {item.value}
              </DrillableNumber>
            </span>
          ) : (
            <span style={{ fontWeight: 600 }}>{item.value}</span>
          )}
        </div>
      ))}
    </div>
  )
}

// Section-5 action chips — wired to onClick callbacks from domain module.
function ActionChips({ actions }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {actions.map((action, i) => (
        <button
          key={action.key ?? i}
          type="button"
          onClick={action.onClick}
          style={{
            background: 'rgba(93,219,194,0.10)',
            border: '1px solid rgba(93,219,194,0.3)',
            color: 'var(--c-acc, #5ddbc2)',
            borderRadius: 12,
            padding: '4px 10px',
            fontSize: 10,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}
