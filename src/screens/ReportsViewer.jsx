// src/screens/ReportsViewer.jsx
// Tab-aware Reports & Financial-Statements hub (SP-1). Renders engine numbers;
// never originates one. Replaces the disabled Reports.jsx stub body.
import { useState, useMemo, useEffect } from 'react'
import { BRAND } from '../config/brand.js'
import FCADisclaimerFooter from '../components/Shell/FCADisclaimerFooter.jsx'
import { DrillStackProvider } from '../components/MyMoney/L3/DrillStack.jsx'
import StatementTree from '../components/Reports/StatementTree.jsx'
import { buildBalanceSheet } from '../components/Reports/statements/balanceSheet.js'
import { buildIncomeStatement } from '../components/Reports/statements/incomeStatement.js'
import { buildCashflowStatement } from '../components/Reports/statements/cashflowStatement.js'
import NetWorthSnapshot from '../components/Reports/reports/NetWorthSnapshot.jsx'
import CashflowProjection from '../components/Reports/reports/CashflowProjection.jsx'
import EstatePlan from '../components/Reports/reports/EstatePlan.jsx'
import SAComputationView from '../components/TaxEstate/SAComputationView.jsx'
import { captureSnapshot, recordReportGenerated } from '../state/report-snapshots.js'

// Index items. `kind`: 'statement' | 'report' | 'soon'.
const INDEX = [
  { id: 'balance-sheet', label: 'Balance Sheet', group: 'Financial statements', kind: 'statement' },
  { id: 'income-statement', label: 'Income Statement', group: 'Financial statements', kind: 'statement' },
  { id: 'cashflow-statement', label: 'Cashflow Statement', group: 'Financial statements', kind: 'statement' },
  { id: 'nw', label: 'Net Worth Snapshot', group: 'Reports', kind: 'report' },
  { id: 'cashflow', label: 'Cashflow Projection', group: 'Reports', kind: 'report' },
  { id: 'tax', label: 'Tax Summary', group: 'Reports', kind: 'report' },
  { id: 'estate', label: 'Estate Plan', group: 'Reports', kind: 'report' },
  { id: 'custom', label: 'Custom report', group: 'Reports', kind: 'soon', soon: 'custom builder (SP-5)' },
]

// Active tab → default selection (§3.4).
function defaultFor(tab) {
  if (tab === 'flow') return 'cashflow-statement'
  if (tab === 'tax') return 'tax'
  if (tab && tab.startsWith('money')) return 'balance-sheet'
  if (tab === 'home') return 'balance-sheet'
  return 'balance-sheet'
}

export default function ReportsViewer({ entity, personaId, onBack, onHome, activeTab, onCommit }) {
  const [sel, setSel] = useState(() => defaultFor(activeTab))

  // Capture a position snapshot on open (D-RPT-SP1-C capture hook).
  useEffect(() => {
    if (entity && personaId) captureSnapshot(personaId, entity)
  }, [entity, personaId])

  // Record report generation when a report (not statement) is viewed.
  useEffect(() => {
    const item = INDEX.find(i => i.id === sel)
    if (item && item.kind === 'report' && personaId) recordReportGenerated(personaId, sel)
  }, [sel, personaId])

  const snapshotDate = useMemo(() => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), [])
  const current = INDEX.find(i => i.id === sel) || INDEX[0]

  function renderContent() {
    switch (sel) {
      case 'balance-sheet':
        return <div style={{ padding: 14 }}><StatementTree statement={buildBalanceSheet(entity)} personaId={personaId} /></div>
      case 'income-statement':
        return <div style={{ padding: 14 }}><StatementTree statement={buildIncomeStatement(entity, 'UK-2026.1')} personaId={personaId} /></div>
      case 'cashflow-statement':
        return <div style={{ padding: 14 }}><StatementTree statement={buildCashflowStatement(entity, 'UK-2026.1')} personaId={personaId} /></div>
      case 'nw': return <NetWorthSnapshot entity={entity} personaId={personaId} />
      case 'cashflow': return <CashflowProjection entity={entity} personaId={personaId} />
      case 'tax': return <div style={{ padding: 14 }}><SAComputationView entity={entity} personaId={personaId} onCommit={onCommit} /></div>
      case 'estate': return <EstatePlan entity={entity} />
      case 'custom':
        return (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--c-text3)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🧩</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text2)' }}>Custom report</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Pick sections from any report — coming in the custom builder (SP-5).</div>
          </div>
        )
      default: return null
    }
  }

  const groups = [...new Set(INDEX.map(i => i.group))]

  return (
    <DrillStackProvider>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--c-bg)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--c-sep)', flexShrink: 0 }}>
          {onBack && (
            <button onClick={onBack} className="sw-press" style={{ padding: '4px 10px', borderRadius: 8, background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text2)', fontSize: 13, cursor: 'pointer' }}>← Back</button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--c-text)' }}>{BRAND.name} · {current.label}</div>
            <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>As at {snapshotDate} · {BRAND.rulesLabel()}</div>
          </div>
          {onHome && (
            <button onClick={onHome} style={{ padding: '6px 12px', borderRadius: 999, background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text2)', fontSize: 12, cursor: 'pointer' }}>⌂ Home</button>
          )}
        </div>

        {/* Body: index rail + content */}
        <div className="sw-reports-body" style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Index rail */}
          <nav aria-label="Reports index" style={{ width: 200, flexShrink: 0, borderRight: '1px solid var(--c-sep)', overflowY: 'auto', padding: '8px 0' }}>
            {groups.map(g => (
              <div key={g}>
                <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--c-text3)', fontWeight: 700, padding: '8px 14px 4px' }}>{g}</div>
                {INDEX.filter(i => i.group === g).map(i => {
                  const active = i.id === sel
                  return (
                    <button key={i.id} onClick={() => setSel(i.id)} style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px',
                      background: active ? 'var(--c-surface2)' : 'transparent', border: 'none',
                      borderLeft: active ? '2px solid var(--c-acc)' : '2px solid transparent',
                      color: active ? 'var(--c-text)' : 'var(--c-text2)', fontSize: 13,
                      fontWeight: active ? 700 : 500, cursor: 'pointer',
                    }}>
                      {i.label}
                      {i.kind === 'soon' && <span style={{ fontSize: 9, marginLeft: 6, color: 'var(--c-text3)' }}>soon</span>}
                    </button>
                  )
                })}
              </div>
            ))}
          </nav>

          {/* Content pane */}
          <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
            {renderContent()}
            <div style={{ padding: '0 14px' }}>
              <FCADisclaimerFooter variant="footer" />
            </div>
          </div>
        </div>

        {/* Footer action bar */}
        <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderTop: '1px solid var(--c-sep)', flexShrink: 0, background: 'var(--c-bg)' }}>
          <button type="button" disabled title="PDF export — SP-3" aria-label="PDF export — coming in SP-3" style={{ flex: 1, padding: '8px 12px', borderRadius: 10, background: 'var(--c-surface2)', color: 'var(--c-text3)', border: '1px solid var(--c-border)', fontSize: 12, fontWeight: 700, cursor: 'not-allowed', opacity: 0.65 }}>
            Export PDF — SP-3
          </button>
          <button type="button" disabled title="Share with adviser — SP-4" aria-label="Share with adviser — coming in SP-4" style={{ flex: 1, padding: '8px 12px', borderRadius: 10, background: 'transparent', color: 'var(--c-text3)', border: '1px solid var(--c-border)', fontSize: 12, fontWeight: 700, cursor: 'not-allowed', opacity: 0.65 }}>
            Share with adviser — SP-4
          </button>
        </div>
      </div>
    </DrillStackProvider>
  )
}
