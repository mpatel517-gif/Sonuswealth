// ─────────────────────────────────────────────────────────────────────────────
// ShockScenarios — three what-ifs sized off live entity numbers.
// Real shock-test engine wires in at s02a via simulateAction().
// ─────────────────────────────────────────────────────────────────────────────

import { fmt, netWorth, investable } from '../../engine/fq-calculator.js'

export default function ShockScenarios({ entity }) {
  const nw  = netWorth(entity)
  const inv = investable(entity)
  const target = entity.targetIncome || 0

  const scenarios = [
    {
      id: 'market30',
      icon: '📉',
      title: 'Markets fall 30%',
      detail: 'Equity portfolio drops by 30% in a single year.',
      impact: -Math.round(inv * 0.3),
      runway: target > 0
        ? `${Math.round((inv * 0.7) / target * 12) / 12} yr at target spend`
        : 'Set target income',
    },
    {
      id: 'incomeLost',
      icon: '🛑',
      title: 'Income lost for 12 months',
      detail: 'Job loss or extended illness with no income protection in force.',
      impact: -target,
      runway: target > 0
        ? `${Math.round(((entity.assets?.cash?.total || 0) / target) * 12) / 12} mo cash`
        : 'Set target income',
    },
    {
      id: 'rates',
      icon: '💸',
      title: 'Rates rise 2pp',
      detail: 'Mortgage refinance hits 2 percentage points higher.',
      impact: -Math.round((entity.liabilities?.mortgage?.outstanding || 0) * 0.02),
      runway: 'Per year',
    },
  ]

  return (
    <div className="card">
      <div className="card-title">Shock Scenarios</div>
      <div style={{
        fontSize: 'var(--fs-small)', color: 'var(--c-text2)',
        marginBottom: 12, lineHeight: 1.5,
      }}>
        Stress tests against your current net worth ({fmt(nw)}). Numbers are
        first-order approximations — full simulation runs at s02a.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {scenarios.map(s => (
          <div key={s.id} style={{
            background: 'var(--c-surface2)',
            borderRadius: 12, padding: '12px 14px',
            display: 'flex', alignItems: 'flex-start', gap: 12,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'var(--c-acc3-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, flexShrink: 0,
            }}>
              {s.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', gap: 8,
                marginBottom: 2,
              }}>
                <span style={{
                  fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--c-text)',
                }}>
                  {s.title}
                </span>
                <span style={{
                  fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--c-acc3)',
                  flexShrink: 0,
                }}>
                  {s.impact < 0 ? '−' : ''}{fmt(Math.abs(s.impact))}
                </span>
              </div>
              <div style={{
                fontSize: 'var(--fs-small)', color: 'var(--c-text2)',
                lineHeight: 1.4, marginBottom: 4,
              }}>
                {s.detail}
              </div>
              <div style={{
                fontSize: 'var(--fs-label)', color: 'var(--c-text3)',
                textTransform: 'uppercase', letterSpacing: 0.5,
              }}>
                {s.runway}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
