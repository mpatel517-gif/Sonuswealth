// ─────────────────────────────────────────────────────────────────────────────
// StateTiles — Safety Net (months of cash) and Cashflow Health.
// All numbers derive from engine helpers and entity fields. No hardcoding.
// ─────────────────────────────────────────────────────────────────────────────

import { fmt } from '../../engine/fq-calculator.js'

function bandForMonths(m) {
  if (m >= 12) return { name: 'Strong',   colour: 'var(--c-acc)'  }
  if (m >= 6)  return { name: 'Healthy',  colour: 'var(--c-mint)' }
  if (m >= 3)  return { name: 'Adequate', colour: 'var(--c-gold)' }
  return         { name: 'Thin',     colour: 'var(--c-acc3)' }
}

function bandForSurplus(ratio) {
  if (ratio >= 0.20) return { name: 'Strong',   colour: 'var(--c-acc)'  }
  if (ratio >= 0.05) return { name: 'Positive', colour: 'var(--c-mint)' }
  if (ratio >= 0)    return { name: 'Tight',    colour: 'var(--c-gold)' }
  return                { name: 'Deficit',  colour: 'var(--c-acc3)' }
}

export default function StateTiles({ income, target, cash }) {
  const monthlySpend = (target || 0) / 12
  const months = monthlySpend > 0 ? cash / monthlySpend : 0
  const safetyBand = bandForMonths(months)

  const surplus = income - (target || 0)
  const ratio = income > 0 ? surplus / income : 0
  const cfBand = bandForSurplus(ratio)

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
    }}>
      <Tile
        label="Safety Net"
        value={monthlySpend > 0 ? `${months.toFixed(1)} mo` : '—'}
        sub={`${fmt(cash)} cash`}
        bandName={safetyBand.name}
        bandColour={safetyBand.colour}
      />
      <Tile
        label="Cashflow Health"
        value={surplus >= 0 ? `+${fmt(surplus)}` : `${fmt(surplus)}`}
        sub={income > 0 ? `${Math.round(ratio * 100)}% of income` : 'No income'}
        bandName={cfBand.name}
        bandColour={cfBand.colour}
      />
    </div>
  )
}

function Tile({ label, value, sub, bandName, bandColour }) {
  return (
    <div style={{
      background: 'var(--c-surface)',
      border: `1px solid ${bandColour}33`,
      borderRadius: 14, padding: '12px 14px',
      minWidth: 0,
    }}>
      <div style={{
        fontSize: 'var(--fs-label)', fontWeight: 700,
        color: 'var(--c-text3)',
        textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 'var(--fs-hero)', fontWeight: 800,
        color: bandColour, lineHeight: 1.1, letterSpacing: -0.3,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 'var(--fs-small)', color: 'var(--c-text3)', marginTop: 4,
      }}>
        {sub}
      </div>
      <div style={{
        marginTop: 6,
        fontSize: 'var(--fs-label)', fontWeight: 700,
        color: bandColour,
      }}>
        {bandName}
      </div>
    </div>
  )
}
