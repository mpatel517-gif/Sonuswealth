// src/screens/ReportsViewer.jsx
// Tab-aware Reports & Financial-Statements hub (SP-1). Renders engine numbers;
// never originates one. Replaces the disabled Reports.jsx stub body.
//
// Navigation (founder direction 2026-06-10): drawer → sub-drawer → report in a
// new (full-screen) window — the same depth pattern as the rest of the app.
//   L1 HUB        — tap Reports → a list of report CATEGORIES (drawers).
//   L2 SUB-DRAWER — tap a category → the reports inside it (skipped when a
//                   category holds a single report — it opens straight away).
//   L3 REPORT     — tap a report → it opens FULL-SCREEN; ← Back steps out one
//                   level, ⌂ Home exits. (A "new window" within the SPA: the
//                   report takes over the screen so drill + tie-outs keep state.)
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

// Report registry. `kind`: 'statement' | 'report' | 'soon'.
const INDEX = {
  'balance-sheet':     { label: 'What you own & owe (Balance Sheet)',     kind: 'statement', sub: 'Assets, liabilities & net worth' },
  'income-statement':  { label: 'Money in & out (Income Statement)',  kind: 'statement', sub: 'Income − tax − spending = surplus' },
  'cashflow-statement':{ label: 'Where your money goes (Cashflow Statement)', kind: 'statement', sub: 'Money in, money out, net' },
  'nw':                { label: 'Net Worth Snapshot', kind: 'report',    sub: 'Where your wealth sits today' },
  'cashflow':          { label: 'Cashflow Projection', kind: 'report',   sub: 'Your surplus, projected forward' },
  'tax':               { label: 'Tax Summary',        kind: 'report',    sub: 'Self-Assessment estimate for your accountant' },
  'estate':            { label: 'Estate Plan',        kind: 'report',    sub: 'Inheritance tax & what your family receives' },
  'custom':            { label: 'Custom report',      kind: 'soon',      sub: 'Pick sections from any report', soon: 'custom builder (SP-5)' },
}

// L1 categories (drawers). Each holds one or more reports (L2 sub-drawer).
const CATEGORIES = [
  { id: 'statements', icon: '📊', label: 'Financial statements', sub: 'Balance sheet · income · cashflow', items: ['balance-sheet', 'income-statement', 'cashflow-statement'] },
  { id: 'position',   icon: '📈', label: 'Net worth & cashflow', sub: 'Where you stand · where it’s heading', items: ['nw', 'cashflow'] },
  { id: 'tax',        icon: '🧾', label: 'Tax',                  sub: 'Self-Assessment summary for your accountant', items: ['tax'] },
  { id: 'estate',     icon: '⚖️', label: 'Estate',               sub: 'Inheritance tax & your estate plan', items: ['estate'] },
  { id: 'custom',     icon: '🧩', label: 'Custom report',        sub: 'Build your own — coming soon', items: ['custom'] },
]

// Active tab → the category to open straight into (still drawer-first; we just
// surface the most relevant drawer's contents for the tab you came from).
function categoryForTab(tab) {
  if (tab === 'tax') return 'tax'
  if (tab === 'flow') return 'statements'
  return null // home / money / other → start at the hub
}

export default function ReportsViewer({ entity, personaId, onBack, onHome, activeTab, onCommit }) {
  // Navigation state: cat = open category (null → hub), rep = open report (null → list).
  const [cat, setCat] = useState(() => categoryForTab(activeTab))
  const [rep, setRep] = useState(null)

  // Capture a position snapshot on open (D-RPT-SP1-C capture hook).
  useEffect(() => {
    if (entity && personaId) captureSnapshot(personaId, entity)
  }, [entity, personaId])

  // Record report generation when a report (not statement) is opened full-screen.
  useEffect(() => {
    const item = rep && INDEX[rep]
    if (item && item.kind === 'report' && personaId) recordReportGenerated(personaId, rep)
  }, [rep, personaId])

  const snapshotDate = useMemo(() => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), [])

  const catObj = CATEGORIES.find(c => c.id === cat) || null
  const repObj = rep ? INDEX[rep] : null

  // Open a category: single-report categories jump straight to the report.
  function openCategory(c) {
    if (c.items.length === 1) { setCat(c.id); setRep(c.items[0]) }
    else { setCat(c.id); setRep(null) }
  }
  // Step back one level. Report → its category list (or hub if the category held
  // a single report). Category list → hub. Hub → exit the viewer.
  function back() {
    if (rep) {
      const single = catObj && catObj.items.length === 1
      setRep(null)
      if (single) setCat(null)
    } else if (cat) {
      setCat(null)
    } else {
      onBack && onBack()
    }
  }

  const level = rep ? 'report' : cat ? 'category' : 'hub'
  const title = rep ? repObj?.label : cat ? catObj?.label : 'Reports'

  function renderReport(id) {
    switch (id) {
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
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--c-text3)' }}>
            <div style={{ fontSize: 34, marginBottom: 10 }}>🧩</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text2)' }}>Custom report</div>
            <div style={{ fontSize: 12.5, marginTop: 8, maxWidth: 320, marginInline: 'auto', lineHeight: 1.5 }}>Pick sections from any report to build your own — coming in the custom builder (SP-5).</div>
          </div>
        )
      default: return null
    }
  }

  // A tappable drawer/sub-drawer row.
  function NavRow({ icon, label, sub, soon, onClick }) {
    return (
      <button onClick={onClick} className="sw-press sw-lift" style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
        padding: '14px 16px', marginBottom: 10, borderRadius: 14,
        background: 'var(--c-surface)', border: '1px solid var(--c-border)', cursor: 'pointer',
      }}>
        {icon && <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: 'var(--c-text)' }}>
            {label}{soon && <span style={{ fontSize: 10, marginLeft: 8, color: 'var(--c-text3)', fontWeight: 600 }}>soon</span>}
          </span>
          {sub && <span style={{ display: 'block', fontSize: 12, color: 'var(--c-text3)', marginTop: 2, lineHeight: 1.4 }}>{sub}</span>}
        </span>
        <span style={{ fontSize: 18, color: 'var(--c-acc)', flexShrink: 0 }}>›</span>
      </button>
    )
  }

  return (
    <DrillStackProvider>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--c-bg)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--c-sep)', flexShrink: 0 }}>
          <button onClick={back} className="sw-press" style={{ padding: '4px 10px', borderRadius: 8, background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text2)', fontSize: 13, cursor: 'pointer' }}>← Back</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--c-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{BRAND.name} · {title}</div>
            <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>
              {level === 'report' ? <>As at {snapshotDate} · {BRAND.rulesLabel()}</> : 'Reports & financial statements'}
            </div>
          </div>
          {onHome && (
            <button onClick={onHome} style={{ padding: '6px 12px', borderRadius: 999, background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text2)', fontSize: 12, cursor: 'pointer' }}>⌂ Home</button>
          )}
        </div>

        {/* Body — one level at a time */}
        <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
          {level === 'hub' && (
            <div style={{ padding: 16, maxWidth: 560, marginInline: 'auto' }}>
              <div style={{ fontSize: 12.5, color: 'var(--c-text3)', marginBottom: 14, lineHeight: 1.5 }}>
                Every report is a live, frozen view of your own figures — choose an area to open it.
              </div>
              {CATEGORIES.map(c => (
                <NavRow key={c.id} icon={c.icon} label={c.label} sub={c.sub} onClick={() => openCategory(c)} />
              ))}
            </div>
          )}

          {level === 'category' && catObj && (
            <div style={{ padding: 16, maxWidth: 560, marginInline: 'auto' }}>
              {catObj.items.map(id => {
                const r = INDEX[id]
                return <NavRow key={id} label={r.label} sub={r.sub} soon={r.kind === 'soon'} onClick={() => setRep(id)} />
              })}
            </div>
          )}

          {level === 'report' && (
            <>
              {renderReport(rep)}
              <div style={{ padding: '0 14px' }}>
                <FCADisclaimerFooter variant="footer" />
              </div>
            </>
          )}
        </div>

        {/* Footer action bar — only on a full-screen report */}
        {level === 'report' && (
          <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderTop: '1px solid var(--c-sep)', flexShrink: 0, background: 'var(--c-bg)' }}>
            <button type="button" disabled title="PDF export — SP-3" aria-label="PDF export — coming in SP-3" style={{ flex: 1, padding: '8px 12px', borderRadius: 10, background: 'var(--c-surface2)', color: 'var(--c-text3)', border: '1px solid var(--c-border)', fontSize: 12, fontWeight: 700, cursor: 'not-allowed', opacity: 0.65 }}>
              Export PDF — SP-3
            </button>
            <button type="button" disabled title="Share with adviser — SP-4" aria-label="Share with adviser — coming in SP-4" style={{ flex: 1, padding: '8px 12px', borderRadius: 10, background: 'transparent', color: 'var(--c-text3)', border: '1px solid var(--c-border)', fontSize: 12, fontWeight: 700, cursor: 'not-allowed', opacity: 0.65 }}>
              Share with adviser — SP-4
            </button>
          </div>
        )}
      </div>
    </DrillStackProvider>
  )
}
