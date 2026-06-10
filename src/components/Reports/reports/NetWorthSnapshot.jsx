// src/components/Reports/reports/NetWorthSnapshot.jsx — RPT-NW-1.
// Triple-anchor (NW / Wealth / Risk) + Balance Sheet tree + narrative.
import { netWorth, calcFQ, calcRisk } from '../../../engine/fq-calculator.js'
import { buildBalanceSheet } from '../statements/balanceSheet.js'
import StatementTree from '../StatementTree.jsx'
import { narrative } from '../deterministicNarrative.js'
import { money } from '../format.js'

export default function NetWorthSnapshot({ entity, personaId }) {
  const bs = buildBalanceSheet(entity)
  const assets = bs.nodes.find(n => n.key === 'assets').value
  const liabilities = bs.nodes.find(n => n.key === 'liabilities').value
  const nw = netWorth(entity)
  let wealth = null, risk = null
  try { wealth = calcFQ(entity)?.total } catch { /* */ }
  try { risk = calcRisk(entity)?.total } catch { /* */ }
  const text = narrative('nw', { netWorth: nw, assets, liabilities })

  const anchor = (label, val) => (
    <div style={{ flex: 1, padding: '10px 12px', background: 'var(--c-surface2)', borderRadius: 12, border: '1px solid var(--c-border)' }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--c-text3)', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--c-text)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{val}</div>
    </div>
  )

  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {anchor('Net Worth', money(nw))}
        {anchor('Wealth Score', wealth != null ? `${wealth}` : '—')}
        {anchor('Risk Score', risk != null ? `${risk}` : '—')}
      </div>
      <p style={{ fontSize: 13, color: 'var(--c-text2)', lineHeight: 1.55, margin: 0 }}>{text}</p>
      <StatementTree statement={bs} personaId={personaId} />
    </div>
  )
}
