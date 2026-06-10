// src/components/Reports/reports/CashflowProjection.jsx — RPT-CASHFLOW-1.
// Cashflow Statement tree + funded-ratio / cashflow-health context + narrative.
import { monthlySurplus, fundedRatio, cashflowHealth } from '../../../engine/fq-calculator.js'
import { buildCashflowStatement } from '../statements/cashflowStatement.js'
import StatementTree from '../StatementTree.jsx'
import { narrative } from '../deterministicNarrative.js'

export default function CashflowProjection({ entity, personaId }) {
  const cf = buildCashflowStatement(entity, 'UK-2026.1')
  const ms = monthlySurplus(entity, 'UK-2026.1')
  const net = ms.surplus - ms.deficit
  let fr = null, ch = null
  try { fr = fundedRatio(entity) } catch { /* */ }
  try { ch = cashflowHealth(entity, 'UK-2026.1') } catch { /* */ }
  const text = narrative('cashflow', { net })

  const chip = (label, val) => (
    <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text2)' }}>
      {label}: <strong style={{ color: 'var(--c-text)' }}>{val}</strong>
    </span>
  )

  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ fontSize: 13, color: 'var(--c-text2)', lineHeight: 1.55, margin: 0 }}>{text}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {fr && fr.ratio != null && chip('Funded ratio', `${Math.round(fr.ratio * 100)}%`)}
        {fr && fr.insufficient_data && chip('Funded ratio', 'Awaiting data')}
        {ch && ch.total != null && chip('Cashflow health', `${ch.total}/100`)}
      </div>
      <StatementTree statement={cf} personaId={personaId} />
      <div style={{ fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.5 }}>
        Forward projection (next 5 years) is an estimate based on current contributions and market assumptions.
      </div>
    </div>
  )
}
