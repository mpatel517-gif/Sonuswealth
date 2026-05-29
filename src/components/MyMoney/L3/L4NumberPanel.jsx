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

import { useState } from 'react'
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
  editable,
  onBack,
}) {
  // L5+ recursive drill: any breakdown row carrying a `drill` payload
  // pushes the next-level L panel onto the stack when tapped.
  // onEdit (from DrillStack context) commits an ASSET_FIELD_CORRECTED event
  // when the leaf is `editable` — this is the "correct this value" path.
  const { pushNumber, onEdit } = useDrillStackContext()
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

      {/* Section 5 — Edit / correct this value (full edit + provenance) +
          action chips. When the leaf is editable and a commit handler is
          wired, the user can correct the value right here — the founder's
          "how do I change this when it's wrong" path. */}
      <L4Section label="WHAT YOU CAN DO">
        {editable && typeof onEdit === 'function' && (
          <LeafEditForm
            editable={editable}
            onCommit={(payload) => {
              onEdit(payload)
              // Pop back to the live panel so the corrected value is visible
              // (the L3 panel re-reads from the now-updated effective entity).
              if (typeof onBack === 'function') onBack()
            }}
          />
        )}
        {actions && actions.length > 0 && <ActionChips actions={actions} />}
        {!editable && (!actions || actions.length === 0) && (
          <div style={{ fontSize: 9, opacity: 0.65 }}>
            Action chips populated per metric in Wave 1+
          </div>
        )}
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
                editable={item.drill.editable}
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

// ── Leaf edit form — "correct this value" with full provenance ─────────────
// editable: { path, label, currentValue, unit?, isCurrency? }
// onCommit(payload) receives the ASSET_FIELD_CORRECTED payload shape:
//   { path, value, source, confidence, label, document? }
// Source picker drives the default confidence (manual 1.0 / statement 0.95 /
// estimate 0.6); user can still see the implied confidence. Optional document
// attach captures a filename for the audit trail (full blob handling is a
// later concern — we record name/size/mime now).
function LeafEditForm({ editable, onCommit }) {
  const [open, setOpen]   = useState(false)
  const [raw, setRaw]     = useState(
    editable?.currentValue != null ? String(editable.currentValue) : ''
  )
  const [source, setSource] = useState('manual')
  const [docName, setDocName] = useState(null)

  const confidenceForSource = (s) =>
    s === 'statement' ? 0.95 : s === 'estimate' ? 0.6 : 1.0

  const handleFile = (e) => {
    const f = e.target.files && e.target.files[0]
    if (f) setDocName({ name: f.name, size: f.size, mime: f.type })
  }

  const submit = () => {
    const num = Number(String(raw).replace(/[^0-9.\-]/g, ''))
    if (!Number.isFinite(num)) return
    onCommit({
      path: editable.path,
      value: num,
      source,
      confidence: confidenceForSource(source),
      label: editable.label,
      ...(docName ? { document: docName } : {}),
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-leaf-edit-open=""
        style={{
          background: 'rgba(93,219,194,0.10)',
          border: '1px solid rgba(93,219,194,0.3)',
          color: 'var(--c-acc, #5ddbc2)',
          borderRadius: 12,
          padding: '5px 12px',
          fontSize: 10,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        ✎ Update / correct this value
      </button>
    )
  }

  const inputStyle = {
    background: 'var(--c-surface2, rgba(255,255,255,0.05))',
    border: '1px solid var(--c-border, rgba(255,255,255,0.15))',
    borderRadius: 6,
    padding: '6px 8px',
    fontSize: 12,
    color: 'var(--c-text, #fff)',
    width: '100%',
  }

  return (
    <div data-leaf-edit-form="" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div>
        <label style={{ fontSize: 9, opacity: 0.65, display: 'block', marginBottom: 3 }}>
          New value{editable.unit ? ` (${editable.unit})` : ''}
        </label>
        <input
          type="text"
          inputMode="decimal"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          data-leaf-edit-input=""
          style={inputStyle}
        />
      </div>

      <div>
        <label style={{ fontSize: 9, opacity: 0.65, display: 'block', marginBottom: 3 }}>
          Where is this figure from?
        </label>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { k: 'manual',    t: 'I know it' },
            { k: 'statement', t: 'Statement' },
            { k: 'estimate',  t: 'Estimate' },
          ].map((opt) => (
            <button
              key={opt.k}
              type="button"
              onClick={() => setSource(opt.k)}
              data-leaf-edit-source={opt.k}
              style={{
                flex: 1,
                background: source === opt.k ? 'rgba(93,219,194,0.18)' : 'transparent',
                border: `1px solid ${source === opt.k ? 'var(--c-acc, #5ddbc2)' : 'var(--c-border, rgba(255,255,255,0.15))'}`,
                color: source === opt.k ? 'var(--c-acc, #5ddbc2)' : 'var(--c-text2)',
                borderRadius: 6,
                padding: '5px 4px',
                fontSize: 10,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {opt.t}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 9, opacity: 0.55, marginTop: 4 }}>
          Recorded confidence: {Math.round(confidenceForSource(source) * 100)}%
        </div>
      </div>

      <div>
        <label style={{ fontSize: 9, opacity: 0.65, display: 'block', marginBottom: 3 }}>
          Attach supporting document (optional)
        </label>
        <input type="file" onChange={handleFile} style={{ fontSize: 10, color: 'var(--c-text3)' }} />
        {docName && (
          <div style={{ fontSize: 9, opacity: 0.7, marginTop: 2 }}>Attached: {docName.name}</div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
        <button
          type="button"
          onClick={submit}
          data-leaf-edit-save=""
          style={{
            flex: 1,
            background: 'var(--c-acc, #5ddbc2)',
            color: '#06231d',
            border: 'none',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 11,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          Save correction
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{
            background: 'transparent',
            color: 'var(--c-text2)',
            border: '1px solid var(--c-border, rgba(255,255,255,0.15))',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
