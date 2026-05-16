// ─────────────────────────────────────────────────────────────────────────────
// LiabilitiesDrillDown — per-loan panel for Domain N.
//
// What this panel surfaces:
//   1. Total debt + breakdown (residential mortgage · BTL · personal · cards)
//   2. LTV on residential property
//   3. Per-loan APR, rate type, fix expiry, monthly payment
//   4. Estate-deductible flag (genuine debts) vs not-deductible
//   5. Student loan position (excluded from estate — written off on death)
//
// Spec sources: 3-Engine-mm-asset-taxonomy-v1_0.md Domain N; MyMoney v2.7 §17.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import OverlayShell from '../shared/OverlayShell.jsx'
import ExplainerChip from '../shared/Explainer.jsx'
import AssetDetailOverlay from './AssetDetailOverlay.jsx'

function Term({ children, id }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
      {children}
      <ExplainerChip id={id} size={13} />
    </span>
  )
}

function fmt(v) {
  const n = Math.round(+v || 0)
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${n < 0 ? '−' : ''}£${(abs / 1_000_000).toFixed(2)}m`
  if (abs >= 1_000)     return `${n < 0 ? '−' : ''}£${(abs / 1_000).toFixed(0)}k`
  return `${n < 0 ? '−' : ''}£${abs.toLocaleString()}`
}

function pct(v) {
  return `${(v * 100).toFixed(2)}%`
}

function Tile({ label, value, sub, tone = 'neutral' }) {
  const fg = tone === 'good' ? 'var(--c-acc)' : tone === 'warn' ? '#FF9500' : tone === 'bad' ? 'var(--c-coral, #FF6F7D)' : 'var(--c-text)'
  return (
    <div className="sw-card" style={{
      padding: 12, background: 'var(--card-bg2)',
      border: '1px solid var(--c-border)', borderRadius: 14,
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-text3)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: fg, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: 'var(--c-text3)' }}>{sub}</div>}
    </div>
  )
}

function Chip({ children, tone = 'neutral' }) {
  const fg = tone === 'good' ? 'var(--c-acc)' : tone === 'warn' ? '#FF9500' : tone === 'bad' ? 'var(--c-coral, #FF6F7D)' : 'var(--c-text2)'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 100,
      background: `color-mix(in srgb, ${fg} 14%, transparent)`, color: fg,
      fontSize: 9, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
      border: `1px solid color-mix(in srgb, ${fg} 30%, transparent)`,
    }}>{children}</span>
  )
}

function Section({ title, sub, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 11, fontWeight: 800, color: 'var(--c-text3)',
        letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8,
      }}>{title}</div>
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 10, lineHeight: 1.4 }}>
          {sub}
        </div>
      )}
      {children}
    </div>
  )
}

function loanCategory(loan) {
  const t = (loan.type || '').toLowerCase()
  if (t.includes('buy-to-let') || t.includes('btl')) return 'BTL mortgage'
  if (t.includes('student-loan')) return 'Student loan'
  if (t.includes('credit-card')) return 'Credit card'
  if (t.includes('commercial')) return 'Commercial mortgage'
  if (t.includes('overdraft')) return 'Overdraft'
  if (t.includes('car') || t.includes('pcp') || t.includes('hp') || t.includes('lease')) return 'Car finance'
  if (t.includes('bridging')) return 'Bridging'
  if (t.includes('equity-release')) return 'Equity release'
  if (t.includes('personal') || t.includes('unsecured')) return 'Personal loan'
  return 'Other loan'
}

function isEstateDeductible(loan) {
  const t = (loan.type || '').toLowerCase()
  if (t.includes('student-loan')) return false
  return true
}

export default function LiabilitiesDrillDown({ entity, personaId, onBack, onHome }) {
  const [selected, setSelected] = useState(null)
  const liabilities = entity.liabilities || {}
  const mortgage = liabilities.mortgage
  const otherLoans = liabilities.otherLoans || []

  const mortgageOutstanding = +mortgage?.outstanding || 0
  const otherTotal = otherLoans.reduce((s, l) => s + (+l.outstanding || +l.outstanding_balance || 0), 0)
  const totalDebt = mortgageOutstanding + otherTotal

  // LTV on primary residence
  const residenceValue = +entity.assets?.residence?.value || 0
  const ltv = residenceValue > 0 ? mortgageOutstanding / residenceValue : 0

  // Estate-deductible total
  const studentLoans = otherLoans.filter(l => (l.type || '').includes('student'))
  const studentTotal = studentLoans.reduce((s, l) => s + (+l.outstanding || +l.outstanding_balance || 0), 0)
  const estateDeductible = totalDebt - studentTotal

  // Build a unified loan list for rendering
  const allLoans = [
    mortgage && { id: 'mortgage', type: 'residential-mortgage', label: 'Residential mortgage', outstanding: mortgage.outstanding, monthly_payment: mortgage.monthlyPayment, interest_rate: mortgage.rate, rate_type: mortgage.rateType, remainingYears: mortgage.remainingYears },
    ...otherLoans,
  ].filter(Boolean)

  return (
    <OverlayShell title="What you owe · drill-down"
      subtitle={`${fmt(totalDebt)} total · ${allLoans.length} loans`}
      onBack={onBack} onHome={onHome}>
      <div style={{ padding: '16px 16px 40px' }}>

        {/* Section 1 — composition */}
        <Section title="1 · What you owe" sub="Real debts (money borrowed for value) reduce your estate for inheritance tax. Student loans don't — they're written off on death, so they don't affect your estate.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
            <Tile label="Total debt" value={fmt(totalDebt)} tone="bad" />
            <Tile label="Mortgage" value={fmt(mortgageOutstanding)} />
            <Tile label="Other loans" value={fmt(otherTotal)} />
            <Tile label="Estate-deductible" value={fmt(estateDeductible)} tone="good" sub="Reduces IHT base" />
          </div>
        </Section>

        {/* Section 2 — LTV */}
        {residenceValue > 0 && (
          <Section title="2 · How much of your home is borrowed against" sub="Loan-to-value (LTV) is the mortgage outstanding as a share of the home's value. Under 60% is comfortable; 60–80% is normal; over 80% is stretched.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 8 }}>
              <Tile label="Property value" value={fmt(residenceValue)} />
              <Tile label="Mortgage" value={fmt(mortgageOutstanding)} />
              <Tile label="LTV" value={`${(ltv * 100).toFixed(1)}%`} tone={ltv < 0.6 ? 'good' : ltv < 0.8 ? 'neutral' : 'warn'} />
            </div>
            <div style={{ height: 8, borderRadius: 100, background: 'var(--c-surface2)', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(100, ltv * 100)}%`, height: '100%',
                background: ltv < 0.6 ? 'var(--c-acc)' : ltv < 0.8 ? '#FFB347' : '#FF6F7D',
              }} />
            </div>
          </Section>
        )}

        {/* Section 3 — per-loan */}
        <Section title="3 · Each debt in detail" sub="Interest rate, rate type, when your fix ends, and the monthly payment. A fix ending within 24 months is the trigger to start remortgage planning.">
          <div style={{ background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14, overflow: 'hidden' }}>
            {allLoans.map((l, i) => {
              const cat = loanCategory(l)
              const rate = +l.interest_rate || +l.apr || 0
              const out = +l.outstanding || +l.outstanding_balance || 0
              const monthly = +l.monthly_payment || +l.repayment_from_salary_monthly || 0
              const rateType = l.rate_type || l.rateType
              const fixYear = rateType && /(\d{4})/.exec(rateType)?.[1]
              const fixApproachingSoon = fixYear && (+fixYear - new Date().getFullYear()) <= 2
              const deductible = isEstateDeductible(l)
              return (
                <div key={l.id || i} style={{
                  padding: '14px',
                  borderBottom: i < allLoans.length - 1 ? '1px solid var(--c-sep)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <button
                      type="button"
                      onClick={() => setSelected(l)}
                      className="sw-press"
                      style={{
                        background: 'transparent', border: 'none', padding: 0,
                        textAlign: 'left', cursor: 'pointer',
                        fontSize: 13, fontWeight: 700, color: 'var(--c-text)',
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                      }}
                    >
                      {l.label || cat} <span style={{ color: 'var(--c-text3)', fontWeight: 500 }}>›</span>
                    </button>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--c-coral, #FF6F7D)', fontVariantNumeric: 'tabular-nums' }}>
                      −{fmt(out)}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 8 }}>
                    {l.lender || cat} · {monthly ? `£${monthly}/mo` : 'monthly n/a'} · APR {pct(rate)}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Chip tone="neutral">{cat}</Chip>
                    {rateType && <Chip tone={fixApproachingSoon ? 'warn' : 'neutral'}>{rateType}</Chip>}
                    {fixApproachingSoon && <Chip tone="warn">Remortgage soon</Chip>}
                    {rate >= 0.15 && <Chip tone="bad">High-cost</Chip>}
                    {deductible ? <Chip tone="good">Estate-deductible</Chip> : <Chip tone="warn">Not in estate</Chip>}
                    {cat === 'BTL mortgage' && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                        <Chip tone="warn">S24 20% credit only</Chip>
                        <ExplainerChip id="MM-S24" size={13} />
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
            {allLoans.length === 0 && (
              <div style={{ padding: 16, fontSize: 12, color: 'var(--c-text3)', textAlign: 'center', fontStyle: 'italic' }}>
                No liabilities captured. Tap + Add on the Liabilities tile to record a loan.
              </div>
            )}
          </div>
        </Section>

        {/* Section 4 — taxonomy gaps */}
        <Section title="4 · Not captured yet" sub="Other liability types you could add here:">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {['Interest-only mortgage', 'Commercial mortgage', 'Second charge', 'Bridging finance', 'Equity release', 'Overdraft', 'Car PCP', 'Car HP', 'Car lease', 'Postgraduate loan', 'HMRC tax liability', 'Business personal guarantee', 'Family loan', 'Pension debit (divorce)'].map(t => (
              <span key={t} style={{
                padding: '6px 12px', borderRadius: 100,
                background: 'var(--c-surface2)', border: '1px dashed var(--c-border)',
                color: 'var(--c-text3)', fontSize: 11, fontWeight: 600,
              }}>+ {t}</span>
            ))}
          </div>
        </Section>

      </div>
      {selected && (
        <AssetDetailOverlay
          asset={selected}
          domain="liabilities"
          category="liabilities"
          itemType={selected.type || 'loan'}
          personaId={personaId}
          onBack={() => setSelected(null)}
          onHome={onHome}
        />
      )}
    </OverlayShell>
  )
}
