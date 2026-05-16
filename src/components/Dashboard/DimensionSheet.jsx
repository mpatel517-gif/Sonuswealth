// DimensionSheet.jsx — Dimension detail bottom sheet
// Shows: score, definition, gaps, what would help, simulate button
// Created: 1 May 2026

import { dimByKey } from '../../config/dimensions.js'
import { SIZE, WEIGHT } from '../../config/typography.js'
import { whatWouldHelpMost } from '../../engine/risk-engine.js'
import { fmt } from '../../engine/fq-calculator.js'

// ── Gap detection per dimension ───────────────────────────────────────────────
function detectGaps(entity, dimKey) {
  const gaps = []

  switch (dimKey) {
    case 'protection':
      if (!entity.lifeInsurance?.inForce) gaps.push({ label: 'No life insurance', severity: 'high' })
      if (!entity.incomeProtection?.inForce) gaps.push({ label: 'No income protection', severity: 'high' })
      if ((entity.emergencyFund?.months ?? 0) < 3) gaps.push({ label: `Emergency fund: ${entity.emergencyFund?.months ?? 0} months`, severity: 'high' })
      if ((entity.emergencyFund?.months ?? 0) >= 3 && (entity.emergencyFund?.months ?? 0) < 6) gaps.push({ label: 'Emergency fund under 6 months', severity: 'medium' })
      break
    case 'tax':
      if ((entity.isaBudget?.used ?? 0) < (entity.isaBudget?.limit ?? 20000)) gaps.push({ label: 'ISA allowance unused', severity: 'medium' })
      if ((entity.pensionBudget?.used ?? 0) < (entity.pensionBudget?.limit ?? 60000)) gaps.push({ label: 'Pension allowance unused', severity: 'medium' })
      break
    case 'estate':
      if (!entity.will?.exists) gaps.push({ label: 'No will in place', severity: 'high' })
      if (!entity.lpa?.exists) gaps.push({ label: 'No lasting power of attorney', severity: 'medium' })
      if (!entity.pensionNomination?.complete) gaps.push({ label: 'Pension nomination incomplete', severity: 'medium' })
      break
    case 'debt':
      if ((entity.debt?.highInterest ?? 0) > 0) gaps.push({ label: `High-interest debt: ${fmt(entity.debt.highInterest)}`, severity: 'high' })
      if ((entity.debt?.creditCards ?? 0) > 5000) gaps.push({ label: 'Credit card balance elevated', severity: 'medium' })
      break
    case 'cashflow':
      if ((entity.surplus?.monthly ?? 0) < 0) gaps.push({ label: 'Monthly deficit', severity: 'high' })
      if ((entity.surplus?.monthly ?? 0) >= 0 && (entity.surplus?.monthly ?? 0) < 500) gaps.push({ label: 'Tight monthly surplus', severity: 'medium' })
      break
    case 'capital':
      if ((entity.fundedRatio ?? 1) < 0.8) gaps.push({ label: 'Retirement funding gap', severity: 'high' })
      if ((entity.investable ?? 0) < 50000) gaps.push({ label: 'Low investable assets', severity: 'medium' })
      break
    case 'behaviour':
      if (entity.missedPayments?.last12Months > 0) gaps.push({ label: 'Missed payments in last 12 months', severity: 'high' })
      if (!entity.budgetTracking?.active) gaps.push({ label: 'No active budget tracking', severity: 'low' })
      break
    default:
      break
  }

  // If no gaps detected, show positive message
  if (gaps.length === 0) {
    gaps.push({ label: 'No major gaps identified', severity: 'none' })
  }

  return gaps
}

// ── Severity styling ──────────────────────────────────────────────────────────
const severityStyles = {
  high:   { color: 'var(--c-coral-text)', bg: 'rgba(255,111,125,.08)', icon: '●' },
  medium: { color: 'var(--c-amber-text)', bg: 'rgba(255,189,89,.08)', icon: '●' },
  low:    { color: 'var(--c-text3)', bg: 'rgba(255,255,255,.04)', icon: '○' },
  none:   { color: 'var(--c-mint-text)', bg: 'rgba(126,240,168,.08)', icon: '✓' },
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DimensionSheet({ entity, dimKey, fqData, onSimulate, onClose }) {
  const dim = dimByKey(dimKey)
  if (!dim) return null

  const score = fqData?.dims?.[dimKey] ?? 0
  const pct = Math.round((score / dim.max) * 100)
  const gaps = detectGaps(entity, dimKey)

  // Get improvement suggestions from engine (if available)
  let suggestions = []
  try {
    const help = whatWouldHelpMost(entity, dimKey)
    if (help?.actions) {
      suggestions = help.actions.slice(0, 3)
    }
  } catch (e) {
    // Engine function may not support all dimensions yet
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 700,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      {/* Backdrop */}
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div style={{
        position: 'relative', zIndex: 1,
        maxHeight: '80vh', overflowY: 'auto',
        background: 'linear-gradient(180deg, rgba(18,24,34,.98), rgba(10,14,22,.99))',
        borderRadius: '24px 24px 0 0',
        padding: '12px 20px 32px',
        boxShadow: '0 -10px 50px rgba(0,0,0,.5)',
        animation: 'sheetUp .3s ease',
      }}>
        {/* Handle */}
        <div style={{ width: 40, height: 5, borderRadius: 3, background: 'rgba(255,255,255,.15)', margin: '0 auto 16px' }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
          <div>
            <span style={{ fontSize: SIZE.label, fontWeight: WEIGHT.medium, color: dim.colour, letterSpacing: '.1em', textTransform: 'uppercase' }}>{dim.formalLabel}</span>
            <h2 style={{ margin: '4px 0 0', fontSize: SIZE.titleLg || 20, fontWeight: WEIGHT.semibold, color: 'var(--c-text)' }}>{dim.label}</h2>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: SIZE.hero || 28, fontWeight: WEIGHT.bold, color: pct === 0 ? '#ff6f7d' : dim.colour }}>{pct}%</div>
            <div style={{ fontSize: SIZE.label, color: 'var(--c-text3)' }}>{score}/{dim.max} pts</div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,.06)', overflow: 'hidden', marginBottom: 20 }}>
          <div style={{
            width: `${Math.max(pct, 2)}%`, height: '100%', borderRadius: 99,
            background: pct === 0 ? '#ff6f7d' : `linear-gradient(90deg, ${dim.colour}88, ${dim.colour})`,
            transition: 'width .5s ease',
          }} />
        </div>

        {/* Definition */}
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: SIZE.label, fontWeight: WEIGHT.medium, color: 'var(--c-text3)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>What this measures</h3>
          <p style={{ fontSize: SIZE.body, lineHeight: 1.5, color: 'var(--c-text2)', margin: 0 }}>{dim.definition}</p>
        </div>

        {/* Gaps */}
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: SIZE.label, fontWeight: WEIGHT.medium, color: 'var(--c-text3)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>
            {gaps[0]?.severity === 'none' ? 'Status' : 'Your gaps'}
          </h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {gaps.map((gap, i) => {
              const style = severityStyles[gap.severity] || severityStyles.low
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 12,
                  background: style.bg, border: `1px solid ${style.color}22`,
                }}>
                  <span style={{ color: style.color, fontSize: 10 }}>{style.icon}</span>
                  <span style={{ fontSize: SIZE.body, color: style.color, fontWeight: WEIGHT.regular }}>{gap.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* What would help */}
        {suggestions.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: SIZE.label, fontWeight: WEIGHT.medium, color: 'var(--c-text3)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>What would help</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              {suggestions.map((s, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  padding: '12px 14px', borderRadius: 12,
                  background: 'rgba(45,242,195,.04)', border: '1px solid rgba(45,242,195,.15)',
                }}>
                  <span style={{ fontSize: SIZE.body, color: 'var(--c-text)' }}>{s.label || s.action || s}</span>
                  {s.impact && <span style={{ fontSize: SIZE.small, fontWeight: WEIGHT.semibold, color: 'var(--c-acc)' }}>+{s.impact} pts</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              padding: '14px 20px', borderRadius: 14, cursor: 'pointer',
              background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
              color: 'var(--c-text2)', fontSize: SIZE.body, fontWeight: WEIGHT.medium,
            }}
          >
            Close
          </button>
          <button
            onClick={() => onSimulate?.(dimKey)}
            style={{
              padding: '14px 20px', borderRadius: 14, cursor: 'pointer',
              background: 'linear-gradient(135deg, var(--c-acc), #8cffdd)', border: 'none',
              color: '#06120f', fontSize: SIZE.body, fontWeight: WEIGHT.semibold,
              boxShadow: '0 10px 30px rgba(45,242,195,.2)',
            }}
          >
            Simulate a fix
          </button>
        </div>
      </div>
    </div>
  )
}
