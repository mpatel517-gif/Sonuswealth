// ─────────────────────────────────────────────────────────────────────────────
// IncomeBreakdown — horizontal stacked bar of income sources.
// Sources read from entity.income.* — no hardcoded amounts.
// ─────────────────────────────────────────────────────────────────────────────

import { fmt } from '../../engine/fq-calculator.js'

const SOURCE_COLOURS = {
  employment:     'var(--c-acc2)',
  statePension:   'var(--c-acc)',
  privatePension: 'var(--c-mint)',
  dividends:      'var(--c-violet)',
  rentalIncome:   'var(--c-gold)',
  overseasIncome: 'var(--c-acc3)',
  other:          'var(--c-text3)',
}

const SOURCE_LABELS = {
  employment:     'Employment',
  statePension:   'State pension',
  privatePension: 'Private pension',
  dividends:      'Dividends',
  rentalIncome:   'Rental income',
  overseasIncome: 'Overseas income',
  other:          'Other',
}

export function buildIncomeRows(entity) {
  const inc = entity?.income || {}
  const age = entity?.age || 0
  const sp  = inc.statePension?.annual || 0
  const spStartAge = inc.statePension?.startAge || 67
  const spEffective = age >= spStartAge ? sp : 0

  const rows = [
    { key: 'employment',     value: inc.employment     || 0 },
    { key: 'statePension',   value: spEffective },
    { key: 'privatePension', value: entity?.drawdown   || 0 },
    { key: 'dividends',      value: inc.dividends      || 0 },
    { key: 'rentalIncome',   value: inc.rentalIncome   || 0 },
    { key: 'overseasIncome', value: inc.overseasIncome || 0 },
  ].filter(r => r.value > 0)

  const total = rows.reduce((s, r) => s + r.value, 0)
  return { rows, total }
}

export default function IncomeBreakdown({ entity }) {
  const { rows, total } = buildIncomeRows(entity)

  if (total === 0) {
    return (
      <div style={{
        background: 'var(--c-surface)',
        border: '1px solid var(--c-border)',
        borderRadius: 16, padding: '14px 16px',
        textAlign: 'center', color: 'var(--c-text3)',
        fontSize: 'var(--fs-small)',
      }}>
        No income sources recorded yet.
      </div>
    )
  }

  return (
    <div style={{
      background: 'var(--c-surface)',
      border: '1px solid var(--c-border)',
      borderRadius: 16, padding: '14px 16px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div style={{
          fontSize: 'var(--fs-label)', fontWeight: 700,
          color: 'var(--c-text3)',
          textTransform: 'uppercase', letterSpacing: 0.8,
        }}>
          Annual Income
        </div>
        <div style={{ fontSize: 'var(--fs-title-lg)', fontWeight: 800, color: 'var(--c-text)' }}>
          {fmt(total)}
        </div>
      </div>

      {/* Stacked bar */}
      <div style={{
        display: 'flex', height: 10, borderRadius: 100, overflow: 'hidden',
        background: 'var(--c-surface2)', marginBottom: 12,
      }}>
        {rows.map(r => (
          <div
            key={r.key}
            title={`${SOURCE_LABELS[r.key]}: ${fmt(r.value)}`}
            style={{
              width: `${(r.value / total) * 100}%`,
              background: SOURCE_COLOURS[r.key],
              transition: 'width .4s ease',
            }}
          />
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(r => {
          const pct = Math.round((r.value / total) * 100)
          return (
            <div key={r.key} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              fontSize: 'var(--fs-body)',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: SOURCE_COLOURS[r.key], flexShrink: 0,
              }} />
              <span style={{ color: 'var(--c-text2)', flex: 1 }}>{SOURCE_LABELS[r.key]}</span>
              <span style={{ color: 'var(--c-text3)' }}>{pct}%</span>
              <span style={{ color: 'var(--c-text)', fontWeight: 600, minWidth: 70, textAlign: 'right' }}>
                {fmt(r.value)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
