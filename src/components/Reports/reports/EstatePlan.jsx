// src/components/Reports/reports/EstatePlan.jsx — RPT-ESTATE-1.
// IHT today + pre/post-2027 delta + CoI (numeric) + will/LPA presence.
import { ihtDeltaPrePost2027 } from '../../../engine/canonical-metrics.js'
import { totalCoI } from '../../../engine/fq-calculator.js'
import { narrative } from '../deterministicNarrative.js'
import { money } from '../format.js'

// Defensive will/LPA presence read (no vaultHasDocument export in SP-1).
function docPresent(entity, kinds) {
  const docs = entity?.documents || entity?.vault?.documents || entity?.estate?.documents || []
  const flags = entity?.estate || entity?.individual || {}
  if (Array.isArray(docs) && docs.some(d => kinds.some(k => new RegExp(k, 'i').test(String(d.type || d.kind || d.name || ''))))) return true
  if (kinds.some(k => flags[`has${k[0].toUpperCase()}${k.slice(1)}`] === true || flags[k] === true)) return true
  return false
}

export default function EstatePlan({ entity }) {
  let iht = { today: 0, post2027: 0, delta: 0, daysUntilApril2027: 0 }
  try { iht = ihtDeltaPrePost2027(entity) } catch { /* */ }
  let coi = 0
  try { coi = totalCoI(entity, 'UK-2026.1')?.total ?? 0 } catch { /* */ }
  const hasWill = docPresent(entity, ['will'])
  const hasLPA = docPresent(entity, ['lpa', 'lasting power'])
  const text = narrative('estate', { today: iht.today, delta: iht.delta })

  const row = (label, val, danger) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--c-sep)' }}>
      <span style={{ fontSize: 13, color: 'var(--c-text2)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: danger ? 'var(--c-danger)' : 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>{val}</span>
    </div>
  )
  const statusChip = (label, present) => (
    <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid var(--c-border)',
      background: present ? 'var(--c-tint-mint, rgba(0,229,168,.10))' : 'var(--c-surface2)',
      color: present ? 'var(--c-success, #00E5A8)' : 'var(--c-text3)' }}>
      {label}: {present ? 'on file' : 'not on file'}
    </span>
  )

  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ fontSize: 13, color: 'var(--c-text2)', lineHeight: 1.55, margin: 0 }}>{text}</p>
      <div>
        {row('IHT exposure today', money(iht.today))}
        {row('IHT exposure from April 2027', money(iht.post2027))}
        {row('Change (pension in estate)', money(iht.delta), iht.delta > 0)}
        {coi > 0 && row('Cost of inaction (all domains)', money(coi), true)}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {statusChip('Will', hasWill)}
        {statusChip('LPA', hasLPA)}
      </div>
    </div>
  )
}
