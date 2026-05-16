// ─────────────────────────────────────────────────────────────────────────────
// CostOfInactionStrip — sticky CoI ribbon.
// Always visible on Home and Tax & Estate when the entity has IHT-exposed
// pension capital. Numbers come from the engine — never hardcoded.
// ─────────────────────────────────────────────────────────────────────────────

import { fmt, costOfInaction, daysLeft } from '../../engine/fq-calculator.js'

export default function CostOfInactionStrip({ entity, onTap }) {
  const coi  = entity ? (costOfInaction(entity) || 0) : 0
  const days = daysLeft() || 0
  if (!(coi > 0 && days > 0)) return null

  const perDay = Math.round(coi / Math.max(1, days))

  return (
    <div
      onClick={onTap}
      role={onTap ? 'button' : undefined}
      style={{
        margin: '0 16px 10px',
        background: 'var(--c-acc3-bg)',
        border: '1px solid var(--c-acc3)',
        borderRadius: 14,
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
        cursor: onTap ? 'pointer' : 'default',
      }}
    >
      <span style={{ fontSize: 16 }} aria-hidden>⏳</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 'var(--fs-label)', fontWeight: 700,
          color: 'var(--c-acc3)',
          textTransform: 'uppercase', letterSpacing: 0.8,
        }}>
          Cost of Inaction
        </div>
        <div style={{
          fontSize: 'var(--fs-body)', color: 'var(--c-text)',
          fontWeight: 600, marginTop: 2, lineHeight: 1.4,
        }}>
          <strong style={{ color: 'var(--c-acc3)' }}>{fmt(coi)}</strong>{' '}
          at risk · {days} days · {fmt(perDay)}/day
        </div>
      </div>
      {onTap && (
        <span style={{ color: 'var(--c-text3)', fontSize: 'var(--fs-title)' }}>›</span>
      )}
    </div>
  )
}
