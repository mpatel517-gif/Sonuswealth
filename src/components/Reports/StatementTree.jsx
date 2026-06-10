// src/components/Reports/StatementTree.jsx
// Recursive statement-tree renderer with period-comparison columns + drill.
// Forward columns are live engine reads (passed in as the node value for the
// active horizon). Backward columns render the honest-absence chip until a real
// snapshot exists (D-RPT-SP1-C) — NEVER synthetic backward history.

import { useState } from 'react'
import { DrillableNumber } from '../MyMoney/L3/DrillableNumber.jsx'
import { useDrillStackContext } from '../MyMoney/L3/DrillStack.jsx'
import { money, deltaStr } from './format.js'
import { priorPeriodSnapshot } from '../../state/report-snapshots.js'

// Honest-absence cell for backward columns with no captured snapshot.
function AbsenceCell({ first }) {
  return (
    <span title="No history yet — capturing from today" style={{
      fontSize: 10, color: 'var(--c-text3)', whiteSpace: 'nowrap',
    }}>
      {first ? 'No history yet' : '—'}
    </span>
  )
}

function Row({ node, depth, personaId, snapshotKey }) {
  const [open, setOpen] = useState(depth === 0)
  const { pushNumber } = useDrillStackContext()
  const hasChildren = Array.isArray(node.children) && node.children.length > 0
  const isTotal = !!node.isTotal

  // Backward columns: only the root/total node maps to a captured snapshot field
  // (netWorth). Sub-lines show '—' absence. This avoids faking per-line history.
  const priorMonth = snapshotKey ? priorPeriodSnapshot(personaId, 'lastMonth') : null
  const priorYear = snapshotKey ? priorPeriodSnapshot(personaId, 'lastYear') : null
  const priorVal = (snap) => (snap && snapshotKey && snap[snapshotKey] != null ? snap[snapshotKey] : null)

  const drill = () => pushNumber({
    metric: node.label,
    value: money(node.value),
    formula: node.formula,
    source: node.source,
    confidence: node.confidence || 'high',
    breakdown: hasChildren
      ? node.children.map(c => ({ label: c.label, value: money(c.value) }))
      : undefined,
  })

  return (
    <>
      <div className="sw-stmt-row" style={{
        display: 'grid',
        gridTemplateColumns: '1fr repeat(5, minmax(56px, max-content))',
        alignItems: 'center', gap: 8,
        padding: '7px 0', paddingLeft: depth * 16,
        borderBottom: '1px solid var(--c-sep)',
        borderTop: isTotal ? '2px solid var(--c-border)' : 'none',
        fontWeight: isTotal ? 800 : depth === 0 ? 700 : 500,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {hasChildren ? (
            <button onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label={`Toggle ${node.label}`} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text3)',
              fontSize: 11, width: 16, flexShrink: 0,
            }}>{open ? '▾' : '▸'}</button>
          ) : <span style={{ width: 16, flexShrink: 0 }} />}
          <span style={{ fontSize: 13, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {node.label}
          </span>
        </div>
        {/* This month (LIVE) — drillable */}
        <span style={{ fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          <DrillableNumber metric={node.label} value={money(node.value)} confidence={node.confidence || 'high'} onDrill={drill} />
        </span>
        {/* Last month (honest-absence unless captured) */}
        <span className="sw-stmt-back" style={{ textAlign: 'right' }}>
          {priorVal(priorMonth) != null
            ? <span style={{ fontSize: 11, color: 'var(--c-text3)' }} title="captured">{deltaStr(node.value, priorVal(priorMonth))}</span>
            : <AbsenceCell first={depth === 0} />}
        </span>
        {/* This year (LIVE) */}
        <span style={{ fontSize: 12, textAlign: 'right', color: 'var(--c-text2)', fontVariantNumeric: 'tabular-nums' }}>{money(node.value)}</span>
        {/* Last year (honest-absence unless captured) */}
        <span className="sw-stmt-back" style={{ textAlign: 'right' }}>
          {priorVal(priorYear) != null
            ? <span style={{ fontSize: 11, color: 'var(--c-text3)' }} title="captured">{deltaStr(node.value, priorVal(priorYear))}</span>
            : <AbsenceCell first={depth === 0} />}
        </span>
        {/* Next 5 years (projected flag) */}
        <span style={{ fontSize: 11, textAlign: 'right', color: 'var(--c-text3)' }} title="Projected — forward estimate">proj.</span>
      </div>
      {hasChildren && open && node.children.map(c => (
        <Row key={c.key} node={c} depth={depth + 1} personaId={personaId} snapshotKey={null} />
      ))}
    </>
  )
}

export default function StatementTree({ statement, personaId }) {
  // snapshotKey: which captured field the ROOT total maps to for backward columns.
  // Balance Sheet root === netWorth → 'netWorth'. Income/Cashflow have no captured
  // field yet → null (all backward cells show honest-absence).
  const snapshotKey = statement.key === 'balance-sheet' ? 'netWorth' : null
  return (
    <div data-statement={statement.key}>
      {/* Column header */}
      <div className="sw-stmt-row sw-stmt-header" style={{
        display: 'grid', gridTemplateColumns: '1fr repeat(5, minmax(56px, max-content))',
        gap: 8, padding: '4px 0', borderBottom: '1px solid var(--c-border)',
        fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--c-text3)', fontWeight: 700,
      }}>
        <span>{statement.periodNote || 'Line item'}</span>
        <span style={{ textAlign: 'right' }}>This month</span>
        <span className="sw-stmt-back" style={{ textAlign: 'right' }}>Last month</span>
        <span style={{ textAlign: 'right' }}>This year</span>
        <span className="sw-stmt-back" style={{ textAlign: 'right' }}>Last year</span>
        <span style={{ textAlign: 'right' }}>Next 5y</span>
      </div>
      {statement.nodes.map(n => (
        <Row key={n.key} node={n} depth={0} personaId={personaId}
          snapshotKey={n.key === 'networth' ? snapshotKey : null} />
      ))}
    </div>
  )
}
