// ─────────────────────────────────────────────────────────────────────────────
// WhatIfLibrary — 6 pre-defined What-If scenarios for the MyMoney screen.
// Shown when X28TopBar viewMode === 'scenario'.
//
// Each scenario applies a delta function to a clone of `entity`, then
// recomputes calcFQ / netWorth / monthlySurplus so we can show directional
// deltas.  Numbers are estimates — all cards carry "est · not advice" tag.
//
// Spec ref: 2-Product-mymoney-v2_7.md §X28-SCENARIO
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
// S1 selector migration (Phase 2)
import { netWorth, fq as calcFQ } from '../../engine/selectors/index.js'
import { monthlySurplus, fqBand, fmt } from '../../engine/fq-calculator.js'

// ── Scenario definitions ────────────────────────────────────────────────────
// Each delta is a pure function: entity → modified entity clone.
// Kept deliberately simple — directional, not precise.

const SCENARIOS = [
  {
    id: 'redundancy',
    label: 'Lose my job',
    subtitle: 'Income drops to £0',
    icon: '⚡',
    color: '#FF6F7D',
    colorBg: 'color-mix(in srgb, #FF6F7D 8%, var(--c-surface))',
    delta: (e) => ({
      ...e,
      income: {
        ...(e.income || {}),
        gross: 0,
        net: 0,
        salary: 0,
      },
    }),
  },
  {
    id: 'pay-rise-20',
    label: '+20% pay rise',
    subtitle: 'Gross salary up 20%',
    icon: '↑',
    color: '#4ADE80',
    colorBg: 'color-mix(in srgb, #4ADE80 8%, var(--c-surface))',
    delta: (e) => {
      const gross = e.income?.gross || e.income?.salary || 0
      return {
        ...e,
        income: {
          ...(e.income || {}),
          gross: Math.round(gross * 1.2),
          salary: Math.round((e.income?.salary || gross) * 1.2),
        },
      }
    },
  },
  {
    id: 'max-pension',
    label: 'Max pension this year',
    subtitle: 'Use full Annual Allowance (£60k)',
    icon: '🏦',
    color: '#FFB347',
    colorBg: 'color-mix(in srgb, #FFB347 8%, var(--c-surface))',
    delta: (e) => {
      // Increase pension value by the gap between current contributions
      // and the £60k AA.  Treat as a lump to keep it simple.
      const currentSipp = e.assets?.sipp?.total || 0
      const annualAllowance = 60000
      const existingContrib = (() => {
        const pensions = e.assets?.pensions || []
        return pensions.reduce((s, p) => s + (+p.contribution_monthly_personal || 0) * 12, 0)
      })()
      const extraContrib = Math.max(0, annualAllowance - existingContrib)
      return {
        ...e,
        assets: {
          ...(e.assets || {}),
          sipp: {
            ...(e.assets?.sipp || {}),
            total: currentSipp + extraContrib,
          },
          // Reduce cash by the same amount to reflect the outflow
          cash: {
            ...(e.assets?.cash || {}),
            total: Math.max(0, (e.assets?.cash?.total || 0) - extraContrib),
          },
        },
      }
    },
  },
  {
    id: 'rate-rise-2pct',
    label: 'Rates +2%',
    subtitle: 'Mortgage payments increase if tracker/variable',
    icon: '📈',
    color: '#F97316',
    colorBg: 'color-mix(in srgb, #F97316 8%, var(--c-surface))',
    delta: (e) => {
      // Find mortgage liability and increase monthly payment by 2% of balance / 12
      const liabilities = e.liabilities || e.assets?.liabilities || {}
      const mortgageBalance = liabilities.mortgage?.outstanding || liabilities.mortgage?.balance || 0
      const extraMonthly = Math.round((mortgageBalance * 0.02) / 12)
      return {
        ...e,
        _rateRiseExtra: extraMonthly,  // consumed by surrogate income reduction
        income: {
          ...(e.income || {}),
          // Subtract extra mortgage cost from net take-home (simplification)
          net: Math.max(0, (e.income?.net || (e.income?.gross || 0) * 0.65) - extraMonthly * 12),
        },
      }
    },
  },
  {
    id: 'early-retire',
    label: 'Retire at 55',
    subtitle: 'Stop working, draw from pension',
    icon: '⛵',
    color: '#818CF8',
    colorBg: 'color-mix(in srgb, #818CF8 8%, var(--c-surface))',
    delta: (e) => ({
      ...e,
      age: Math.min(e.age || 40, 55),
      income: {
        ...(e.income || {}),
        gross: 0,
        salary: 0,
        net: 0,
      },
      // Add drawdown from SIPP as income proxy
      drawdown: e.drawdown || Math.round((e.assets?.sipp?.total || 0) * 0.04),
    }),
  },
  {
    id: 'property-sale',
    label: 'Sell main home',
    subtitle: 'Realise property equity',
    icon: '🏠',
    color: '#38BDF8',
    colorBg: 'color-mix(in srgb, #38BDF8 8%, var(--c-surface))',
    delta: (e) => {
      const propertyValue = e.assets?.residence?.value || 0
      const mortgageBalance =
        (e.liabilities?.mortgage?.outstanding || 0) ||
        (e.assets?.liabilities?.mortgage?.outstanding || 0)
      const proceeds = Math.max(0, propertyValue - mortgageBalance)
      return {
        ...e,
        assets: {
          ...(e.assets || {}),
          residence: { ...(e.assets?.residence || {}), value: 0 },
          cash: {
            ...(e.assets?.cash || {}),
            total: (e.assets?.cash?.total || 0) + proceeds,
          },
        },
        liabilities: {
          ...(e.liabilities || {}),
          mortgage: { outstanding: 0, balance: 0 },
        },
      }
    },
  },
]

// ── Helper: compute scenario metrics ────────────────────────────────────────

function computeMetrics(entity) {
  try {
    const fq = calcFQ(entity)
    const nw = netWorth(entity)
    const ms = monthlySurplus(entity)
    const surplus = ms.surplus > 0 ? ms.surplus : -(ms.deficit || 0)
    return { score: fq.total, netWorth: nw, surplus }
  } catch {
    return { score: 0, netWorth: 0, surplus: 0 }
  }
}

function applyScenario(entity, scenario) {
  try {
    return scenario.delta(entity)
  } catch {
    return entity
  }
}

// ── Delta chip helpers ────────────────────────────────────────────────────────

function deltaColor(val) {
  if (val > 0) return '#4ADE80'
  if (val < 0) return '#FF6F7D'
  return 'var(--c-text3)'
}

function deltaSign(val) {
  if (val > 0) return '+'
  if (val < 0) return ''
  return '±'
}

function DeltaRow({ label, base, scenario, format }) {
  const diff = scenario - base
  const color = deltaColor(diff)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--c-text3)' }}>{label}</span>
      <span style={{
        fontSize: 12, fontWeight: 700, color,
        background: `${color}18`,
        padding: '2px 7px', borderRadius: 20,
      }}>
        {deltaSign(diff)}{format(diff)}
      </span>
    </div>
  )
}

// ── ScenarioCard ─────────────────────────────────────────────────────────────

function ScenarioCard({ scenario, baseMetrics, entity, expanded, onToggle }) {
  const modifiedEntity = applyScenario(entity, scenario)
  const scenarioMetrics = computeMetrics(modifiedEntity)

  const scoreDiff = Math.round(scenarioMetrics.score - baseMetrics.score)
  const nwDiff = scenarioMetrics.netWorth - baseMetrics.netWorth
  const surplusDiff = scenarioMetrics.surplus - baseMetrics.surplus

  const hasAnyChange = scoreDiff !== 0 || nwDiff !== 0 || surplusDiff !== 0

  return (
    <div
      style={{
        background: expanded ? scenario.colorBg : 'var(--c-surface)',
        border: `1px solid ${expanded ? scenario.color + '40' : 'var(--c-border)'}`,
        borderRadius: 16,
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'background 200ms, border-color 200ms',
      }}
      onClick={() => onToggle(expanded ? null : modifiedEntity)}
      role="button"
      aria-expanded={expanded}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: expanded ? 12 : 0 }}>
        <span style={{
          fontSize: 20, lineHeight: 1,
          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
        }}>
          {scenario.icon}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)', lineHeight: 1.3 }}>
            {scenario.label}
          </div>
          <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 1 }}>
            {scenario.subtitle}
          </div>
        </div>
        {/* Quick delta badges on collapsed state */}
        {!expanded && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
            {scoreDiff !== 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: deltaColor(scoreDiff),
                background: `${deltaColor(scoreDiff)}18`,
                padding: '2px 6px', borderRadius: 20,
              }}>
                {deltaSign(scoreDiff)}{scoreDiff} pts
              </span>
            )}
            {surplusDiff !== 0 && (
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: deltaColor(surplusDiff),
                background: `${deltaColor(surplusDiff)}15`,
                padding: '2px 6px', borderRadius: 20,
              }}>
                {deltaSign(surplusDiff)}{fmt(Math.abs(surplusDiff))}/mo
              </span>
            )}
          </div>
        )}
        <span style={{
          fontSize: 10, color: 'var(--c-text3)', marginLeft: 4,
          transform: expanded ? 'rotate(180deg)' : 'none',
          transition: 'transform 200ms',
        }}>▾</span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div>
          {hasAnyChange ? (
            <>
              <DeltaRow
                label="Wealth Score"
                base={baseMetrics.score}
                scenario={scenarioMetrics.score}
                format={(d) => `${Math.abs(Math.round(d))} pts`}
              />
              <DeltaRow
                label="Monthly surplus"
                base={baseMetrics.surplus}
                scenario={scenarioMetrics.surplus}
                format={(d) => `${fmt(Math.abs(Math.round(d)))}/mo`}
              />
              <DeltaRow
                label="Net worth"
                base={baseMetrics.netWorth}
                scenario={scenarioMetrics.netWorth}
                format={(d) => fmt(Math.abs(Math.round(d)))}
              />
            </>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--c-text3)', fontStyle: 'italic' }}>
              No data to run this scenario — add your financial details first.
            </div>
          )}

          <div style={{
            marginTop: 10,
            fontSize: 10, fontWeight: 700,
            color: 'var(--c-text3)', letterSpacing: 0.5,
            textTransform: 'uppercase',
          }}>
            est · not advice
          </div>
        </div>
      )}
    </div>
  )
}

// ── WhatIfLibrary ─────────────────────────────────────────────────────────────

export default function WhatIfLibrary({ entity, onScenarioSelect }) {
  const [expandedId, setExpandedId] = useState(null)
  const baseMetrics = computeMetrics(entity || {})

  function handleToggle(scenarioId, modifiedEntity) {
    const next = expandedId === scenarioId ? null : scenarioId
    setExpandedId(next)
    if (onScenarioSelect) onScenarioSelect(next ? modifiedEntity : null)
  }

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 16, fontWeight: 800,
          color: 'var(--c-text)', marginBottom: 4,
        }}>
          What if?
        </div>
        <div style={{ fontSize: 12, color: 'var(--c-text3)', lineHeight: 1.5 }}>
          Explore how life events would change your wealth score, surplus, and net worth.
          Tap any card to see the impact.
        </div>
        <div style={{
          display: 'inline-block', marginTop: 8,
          fontSize: 10, fontWeight: 700, color: 'var(--c-text3)',
          background: 'var(--c-tint-neutral-2)', padding: '3px 9px',
          borderRadius: 20, letterSpacing: 0.5, textTransform: 'uppercase',
        }}>
          Estimates only · Not financial advice
        </div>
      </div>

      {/* Scenario cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {SCENARIOS.map(scenario => (
          <ScenarioCard
            key={scenario.id}
            scenario={scenario}
            baseMetrics={baseMetrics}
            entity={entity || {}}
            expanded={expandedId === scenario.id}
            onToggle={(modifiedEntity) => handleToggle(scenario.id, modifiedEntity)}
          />
        ))}
      </div>

      {/* Footer nudge */}
      <div style={{
        marginTop: 20, padding: '12px 14px',
        background: 'var(--c-surface)',
        border: '1px solid var(--c-border)',
        borderRadius: 12,
        fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.5,
      }}>
        These are directional estimates based on your current data. For a personalised
        analysis of any scenario, speak with a qualified financial adviser.
        Numbers use the same engine as your live wealth score.
      </div>
    </div>
  )
}
