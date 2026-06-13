// ─────────────────────────────────────────────────────────────────────────────
// ProtectionGap — life cover and income protection vs estimated need.
// "Need" estimates derive from entity.targetIncome and dependants count;
// real underwriting comes via the protection-quote integration at s02a.
// ─────────────────────────────────────────────────────────────────────────────

import { fmt, TAX } from '../../engine/fq-calculator.js'

export default function ProtectionGap({ entity, onAction }) {
  const a    = entity.assets || {}
  const prot = a.protection  || {}
  const target = entity.targetIncome || 0
  const dependants = entity.dependants?.length || 0

  // Planning heuristics sourced from the rules bundle (UK-PROT-NEED-01) — never
  // hardcoded here (CLAUDE.md §6.2). Life cover ≈ multiple × income.
  const lifeMultiple = dependants > 0 ? TAX.lifeCoverMultipleDep : TAX.lifeCoverMultipleNoDep
  const lifeCoverNeed = target * lifeMultiple
  const lifeCoverHave = prot.lifeInsurance?.amount || 0
  const lifeGap = Math.max(0, lifeCoverNeed - lifeCoverHave)

  // Income protection ≈ bundle fraction of target income (annual benefit).
  const ipNeed = Math.round(target * TAX.ipBenefitFraction)
  const ipHave = (prot.incomeProtection?.monthlyBenefit || 0) * 12
  const ipGap = Math.max(0, ipNeed - ipHave)

  const hasGap = lifeGap + ipGap > 0

  return (
    <div
      className={`card sw-lift${hasGap && onAction ? ' sw-press' : ''}`}
      onClick={hasGap && onAction ? () => onAction() : undefined}
      style={hasGap && onAction ? { cursor: 'pointer' } : undefined}
    >
      <div className="card-title" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span>Protection Gap</span>
        {hasGap && onAction && (
          <button
            onClick={e => { e.stopPropagation(); onAction?.() }}
            className="sw-press"
            style={{
              fontSize: 11, fontWeight: 700,
              background: 'var(--c-acc3-bg)',
              color: 'var(--c-acc3)',
              border: '1px solid var(--c-acc3)',
              borderRadius: 100, padding: '4px 10px',
              cursor: 'pointer',
            }}
          >Review →</button>
        )}
      </div>
      <GapRow
        label="Life cover"
        have={lifeCoverHave} need={lifeCoverNeed}
        suffix="" sub={`Suggested: ${lifeMultiple}× income`}
      />
      <GapRow
        label="Income protection"
        have={ipHave} need={ipNeed}
        suffix="/yr" sub={`Suggested: ${Math.round(TAX.ipBenefitFraction * 100)}% of target income`}
      />

      <div style={{
        marginTop: 10, padding: '10px 12px',
        background: lifeGap + ipGap > 0 ? 'var(--c-acc3-bg)' : 'var(--c-acc-bg)',
        border: `1px solid ${lifeGap + ipGap > 0 ? 'var(--c-acc3)' : 'var(--c-acc)'}33`,
        borderRadius: 10,
        fontSize: 'var(--fs-small)', color: 'var(--c-text2)', lineHeight: 1.5,
      }}>
        {lifeGap + ipGap > 0
          ? <>Combined cover gap of <strong style={{ color:'var(--c-acc3)' }}>{fmt(lifeGap + ipGap)}</strong>{' '}
              between what you hold and the suggested level. This is an estimate, not a recommendation to buy.</>
          : <span style={{ color: 'var(--c-acc)' }}>Both cover lines meet the suggested need.</span>}
      </div>
    </div>
  )
}

function GapRow({ label, have, need, suffix = '', sub }) {
  const gap = Math.max(0, need - have)
  const pct = need > 0 ? Math.min(100, (have / need) * 100) : 0
  const colour = pct >= 100 ? 'var(--c-acc)' : pct >= 60 ? 'var(--c-gold)' : 'var(--c-acc3)'

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        display:'flex', justifyContent:'space-between', alignItems:'baseline',
        marginBottom: 4,
      }}>
        <div style={{ fontSize:'var(--fs-body)', fontWeight:600, color:'var(--c-text)' }}>
          {label}
        </div>
        <div style={{ fontSize:'var(--fs-small)', fontWeight:700, color: colour }}>
          {fmt(have)}{suffix} / {fmt(need)}{suffix}
        </div>
      </div>
      <div style={{
        height: 6, borderRadius: 100, overflow: 'hidden',
        background: 'var(--c-surface2)',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: colour, borderRadius: 100,
          transition: 'width .4s ease',
        }} />
      </div>
      <div style={{
        display:'flex', justifyContent:'space-between',
        fontSize: 'var(--fs-label)', color: 'var(--c-text3)', marginTop: 4,
      }}>
        <span>{sub}</span>
        {gap > 0 && <span>Gap: {fmt(gap)}{suffix}</span>}
      </div>
    </div>
  )
}
