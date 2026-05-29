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
import { DrillStackProvider, useDrillStackContext } from './L3/DrillStack.jsx'
import { DrillableNumber } from './L3/DrillableNumber.jsx'
import ExplainerChip from '../shared/Explainer.jsx'
import AssetDetailOverlay from './AssetDetailOverlay.jsx'
import { BRAND } from '../../config/brand.js'
import { LiquidityLadder } from '../charts/index.js'

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

// L3-1b (2026-05-28): DrillStack wrapper per README pattern.
export default function LiabilitiesDrillDown(props) {
  return (
    <DrillStackProvider>
      <LiabilitiesDrillDownInner {...props} />
    </DrillStackProvider>
  )
}

function LiabilitiesDrillDownInner({ entity, personaId, onBack, onHome }) {
  const drillStack = useDrillStackContext()
  const [selected, setSelected] = useState(null)
  const liabilities = entity.liabilities || {}
  const mortgage = liabilities.mortgage
  const otherLoans = liabilities.otherLoans || []

  const mortgageOutstanding = +mortgage?.outstanding || 0
  const otherTotal = otherLoans.reduce((s, l) => s + (+l.outstanding || +l.outstanding_balance || 0), 0)
  const totalDebt = mortgageOutstanding + otherTotal

  // LTV on primary residence — apply the household's ownership share so the
  // ratio reflects the value the household actually owns, not the gross
  // property value. (Joint owners commonly hold 50%; ignoring this overstates
  // the equity cushion and understates LTV.)
  const residenceValue = (+entity.assets?.residence?.value || 0) * (+entity.assets?.residence?.ownershipShare || 1)
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

  // Liquidity ladder tiers — asset sources that could pay down high-APR debt.
  const cashTotal = +entity.assets?.cash?.total
    || ((+entity.assets?.cash?.currentAccount || 0) + (+entity.assets?.cash?.savingsAccount || 0) + (+entity.assets?.cash?.emergencyFund || 0))
    || 0
  const isaTotal = +entity.assets?.isa?.total
    || (Array.isArray(entity.assets?.isa) ? entity.assets.isa.reduce((s, x) => s + (+x.value || 0), 0) : 0)
    || (+entity.assets?.isa?.value || 0)
  const giaTotal = +entity.assets?.gia?.total
    || (Array.isArray(entity.assets?.gia) ? entity.assets.gia.reduce((s, x) => s + (+x.value || 0), 0) : 0)
    || (+entity.assets?.gia?.value || 0)
  const pensionTotal = +entity.assets?.pension?.total
    || (Array.isArray(entity.assets?.pension) ? entity.assets.pension.reduce((s, x) => s + (+x.value || 0), 0) : 0)
    || (+entity.assets?.pension?.value || 0)
  const age = +entity.profile?.age || 0
  const liquidityTiers = [
    { label: 'Hours', items: cashTotal > 0 ? [{ name: 'Cash (immediate)', value: cashTotal }] : [] },
    { label: 'Days', items: isaTotal > 0 ? [{ name: 'ISA (penalty-free)', value: isaTotal }] : [] },
    { label: 'Weeks', items: giaTotal > 0 ? [{ name: 'GIA (T+2)', value: giaTotal }] : [] },
    { label: 'Months', items: [] },
    { label: 'Years', items: pensionTotal > 0 ? [{ name: age >= 55 ? 'Pension (accessible)' : 'Pension (55+)', value: pensionTotal }] : [] },
  ]

  // Sort: highest APR first; loans without APR sink to the bottom.
  const sortedLoans = [...allLoans].sort((a, b) => {
    const aRate = +a.interest_rate || +a.apr || 0
    const bRate = +b.interest_rate || +b.apr || 0
    if (aRate === 0 && bRate === 0) return 0
    if (aRate === 0) return 1
    if (bRate === 0) return -1
    return bRate - aRate
  })

  return (
    <OverlayShell title="What you owe · drill-down"
      subtitle={
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'baseline' }}>
          <DrillableNumber
            metric="Total debt"
            value={fmt(totalDebt)}
            formula={`Sum of every outstanding balance. ${allLoans.length} loan${allLoans.length === 1 ? '' : 's'}.`}
            source={`${allLoans.length} loan${allLoans.length === 1 ? '' : 's'} on file`}
            confidence="high"
            breakdown={allLoans.map((l, i) => ({
              label: l.label || l.type || `Loan #${i + 1}`,
              value: fmt(+(l.outstanding ?? l.outstanding_balance ?? 0)),
            }))}
            onDrill={drillStack.pushNumber}
          />
          <span style={{ fontSize: 13, color: 'var(--c-text3)' }}>total · {allLoans.length} loan{allLoans.length === 1 ? '' : 's'}</span>
        </span>
      }
      onBack={onBack} onHome={onHome}>
      <div style={{ padding: '16px 16px 40px' }}>

        <div className="sw-eyebrow" style={{ fontStyle: 'italic', color: 'var(--c-text3)', fontSize: 12, marginBottom: 16 }}>
          What you owe, what it costs, and the fastest path to zero
        </div>

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
          <div className="sw-eyebrow" style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-text3)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>
            Ordered by APR (highest first)
          </div>
          <div style={{ background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14, overflow: 'hidden' }}>
            {sortedLoans.map((l, i) => {
              const cat = loanCategory(l)
              const rate = +l.interest_rate || +l.apr || 0
              const out = +l.outstanding || +l.outstanding_balance || 0
              const monthly = +l.monthly_payment || +l.repayment_from_salary_monthly || 0
              const rateType = l.rate_type || l.rateType
              const fixYear = rateType && /(\d{4})/.exec(rateType)?.[1]
              const fixApproachingSoon = fixYear && (+fixYear - new Date().getFullYear()) <= 2
              const deductible = isEstateDeductible(l)
              // Payoff timeline — months at current minimums.
              const monthlyInterest = (rate * out) / 12
              const principalPerMonth = Math.max(1, monthly - monthlyInterest)
              const payoffMonths = out > 0 && monthly > 0 ? Math.ceil(out / principalPerMonth) : null
              const hasApr = rate > 0
              return (
                <div key={l.id || i} style={{
                  padding: '14px',
                  borderBottom: i < sortedLoans.length - 1 ? '1px solid var(--c-sep)' : 'none',
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
                  <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 8, fontStyle: 'italic' }}>
                    {hasApr
                      ? (payoffMonths ? `~ ${payoffMonths} months at current minimums` : 'Months to payoff at current rate — payment not recorded')
                      : 'APR not recorded'}
                  </div>
                </div>
              )
            })}
            {sortedLoans.length === 0 && (
              <div style={{ padding: 16, fontSize: 12, color: 'var(--c-text3)', textAlign: 'center', fontStyle: 'italic' }}>
                No liabilities captured. Tap + Add on the Liabilities tile to record a loan.
              </div>
            )}
          </div>
          {sortedLoans.length > 1 && (
            <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 10, lineHeight: 1.5 }}>
              Highest-APR debts close fastest by directing extra payments there.
            </div>
          )}
        </Section>

        {/* Section 3.5 — liquidity ladder of paydown sources */}
        {sortedLoans.length > 0 && (
          <Section title="Sources to pay down" sub="The tiers of money you could draw on to clear high-cost debt — ordered by how quickly they can be turned into cash without penalty.">
            <LiquidityLadder tiers={liquidityTiers} ariaLabel="Asset sources to pay down debt" />
            <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 10, lineHeight: 1.5 }}>
              Cash and ISA are first lines of defence against high-APR debt.
            </div>
          </Section>
        )}

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

        <p style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 16, lineHeight: 1.5 }}>
          {BRAND.disclaimer}
        </p>
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
