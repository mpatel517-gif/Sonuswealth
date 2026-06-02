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
import { amortise, payoffLabel } from './debtMath.js'
import { classifyLiability, gapLiabilityTypes } from '../../engine/liability-taxonomy.js'

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

// B8 fix (2026-06-01): personas use 'student_loan_plan2' (underscore + plan suffix)
// while these functions tested only for 'student-loan' (hyphen). Normalise by
// replacing all hyphens/underscores with a single canonical form before matching.
function _normLoanType(loan) {
  return (loan.type || '').toLowerCase().replace(/_/g, '-')
}
function _isStudentLoan(loan) {
  const t = _normLoanType(loan)
  return t.includes('student') && (t.includes('loan') || t.includes('plan'))
}

// Category + estate-deductibility now come from the single canonical taxonomy
// (src/engine/liability-taxonomy.js) instead of a local if-chain. The old chain
// was stale: it mis-filed 'second-charge-mortgage' as a Residential mortgage
// (it matched 'mortgage' first) and dumped 'hmrc-self-assessment' and 'bnpl'
// into "Other loan" (founder 2026-06-02). classifyLiability() resolves by
// longest-matching substring so the specific type always wins.
function loanCategory(loan) {
  return classifyLiability(loan.type).label
}

function isEstateDeductible(loan) {
  // Student loans (and the pension-sharing debit) are estateDeductible:false in
  // the taxonomy — written off on death, not an estate liability.
  return classifyLiability(loan.type).estateDeductible
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
    // Normalise otherLoans field names — personas store `rate` (0.0385) and
    // `monthlyPayment`, but this drill reads `interest_rate` + `monthly_payment`.
    // Without this the BTL row showed "APR 0.00% · monthly n/a" while the tile
    // correctly showed 3.9% / £1k/mo (founder 2026-06-01: "check all the actions").
    ...otherLoans.map(l => ({
      ...l,
      interest_rate: l.interest_rate != null ? l.interest_rate : (l.apr != null ? l.apr : l.rate),
      monthly_payment: l.monthly_payment != null ? l.monthly_payment : l.monthlyPayment,
    })),
  ].filter(Boolean)
    // Only show debts the person actually has — a £0 residential mortgage was
    // rendering as "−£0 · APR not recorded" and counting toward "2 LOANS"
    // (founder 2026-06-01: only show what they have; check all the rows).
    .filter(l => (+l.outstanding || +l.outstanding_balance || 0) > 0)

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

  // Group by debt type (R15 — categorised like the pension drill). Within a
  // group, keep the highest-APR-first order from sortedLoans. Groups themselves
  // are ordered by total balance (largest commitment first), so the biggest
  // claim on the estate leads.
  const loanGroups = (() => {
    const m = new Map()
    for (const l of sortedLoans) {
      const cat = loanCategory(l)
      const out = +l.outstanding || +l.outstanding_balance || 0
      if (!m.has(cat)) m.set(cat, { cat, loans: [], total: 0 })
      const g = m.get(cat)
      g.loans.push(l)
      g.total += out
    }
    return [...m.values()].sort((a, b) => b.total - a.total)
  })()

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

        {/* Section 1 — the ONE thing not shown elsewhere: how much of the debt
            reduces the estate. Total is already in the header; mortgage / other-
            loan splits are in Section 3's type groups. Showing them again here as
            number tiles was the redundancy the founder flagged ("£215k four
            times"). Kept: estate-deductible (the IFA insight) + its counterpart. */}
        <Section title="1 · What it means for your estate" sub="Real debts (money borrowed for value) reduce your estate for inheritance tax. Student loans don't — they're written off on death, so they don't affect your estate.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
            <Tile label="Reduces your estate" value={fmt(estateDeductible)} tone="good" sub="Deducted before IHT" />
            {studentTotal > 0 && <Tile label="Not in estate" value={fmt(studentTotal)} tone="warn" sub="Written off on death" />}
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

        {/* Section 3 — grouped by type (R15: categorised like the pension drill —
            grouped by type → per-debt row → per-debt leaf, not a flat list).
            Each group is a scheme-type card with its own subtotal; within a group
            debts are ordered highest-APR first. Founder 2026-06-01: "Liabilities
            drill … not categorised properly like pensions … scrambled, cluttered." */}
        <Section title="3 · Each debt in detail" sub="Grouped by type, highest-rate first. Interest rate, rate type, when your fix ends, and the monthly payment. A fix ending within 24 months is the trigger to start remortgage planning.">
          {loanGroups.length === 0 && (
            <div style={{ padding: 16, fontSize: 12, color: 'var(--c-text3)', textAlign: 'center', fontStyle: 'italic', background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14 }}>
              No liabilities captured. Tap + Add on the Liabilities tile to record a loan.
            </div>
          )}
          {loanGroups.map((grp) => (
            <div key={grp.cat} style={{ marginBottom: 12 }}>
              {/* Group header ONLY when the group holds ≥2 debts — a header that
                  repeats the single row beneath it (label + balance) is pure
                  redundancy (founder 2026-06-01: "shambles"). A lone debt renders
                  as just its row; the row's label already names the type. */}
              {grp.loans.length >= 2 && (
                <div style={{
                  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                  padding: '0 2px 6px', marginBottom: 2,
                }}>
                  <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--c-text2)', letterSpacing: 0.3 }}>{grp.cat}</span>
                    <span style={{ fontSize: 10, color: 'var(--c-text3)' }}>{grp.loans.length} debts</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-coral, #FF6F7D)', fontVariantNumeric: 'tabular-nums' }}>−{fmt(grp.total)}</span>
                </div>
              )}
              <div style={{ background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14, overflow: 'hidden' }}>
                {grp.loans.map((l, i) => {
                  const cat = loanCategory(l)
                  const rate = +l.interest_rate || +l.apr || 0
                  const out = +l.outstanding || +l.outstanding_balance || 0
                  const monthly = +l.monthly_payment || +l.repayment_from_salary_monthly || 0
                  const rateType = l.rate_type || l.rateType
                  const fixYear = rateType && /(\d{4})/.exec(rateType)?.[1]
                  const fixApproachingSoon = fixYear && (+fixYear - new Date().getFullYear()) <= 2
                  const deductible = isEstateDeductible(l)
                  // Single source of debt maths — kills the old "~5637 months"
                  // (470-yr) interest-only bug (founder 2026-06-01). rate is a
                  // decimal here (0.054) → ×100 for amortise's percent input.
                  const am = amortise(out, rate * 100, monthly)
                  const hasApr = rate > 0
                  return (
                    <button
                      key={l.id || i}
                      type="button"
                      onClick={() => {
                        // Pass decision-modeller context alongside the loan so
                        // DebtDecisions can size the overpayment slider and apply
                        // the correct marginal rate without re-computing from entity.
                        // _marginalRate: 0.4 placeholder — no ANI selector exists yet
                        // on this drill; replace with engine selector when available.
                        const _marginalRate = 0.4
                        // _surplusCash: cash above a ~6-month essentials buffer.
                        // entity.profile?.monthlyEssentials * 6 if captured; else
                        // fall back to raw cashTotal (conservative — no buffer sized).
                        const essentials6m = entity.profile?.monthlyEssentials
                          ? entity.profile.monthlyEssentials * 6
                          : 0
                        const _surplusCash = essentials6m > 0
                          ? Math.max(0, cashTotal - essentials6m)
                          : cashTotal
                        setSelected({ ...l, _marginalRate, _surplusCash })
                      }}
                      className="sw-press"
                      aria-label={`Open ${l.label || cat} detail`}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        padding: '14px',
                        borderBottom: i < grp.loans.length - 1 ? '1px solid var(--c-sep)' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {l.label || cat} <span style={{ color: 'var(--c-text3)', fontWeight: 500 }}>›</span>
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--c-coral, #FF6F7D)', fontVariantNumeric: 'tabular-nums' }}>
                          −{fmt(out)}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 8 }}>
                        {l.lender || cat} · {monthly ? `£${monthly}/mo` : 'monthly n/a'} · APR {pct(rate)}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
                        {hasApr ? payoffLabel(am) : 'APR not recorded'}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          {sortedLoans.length > 1 && (
            <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 4, lineHeight: 1.5 }}>
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

        {/* Section 4 — taxonomy gaps. Sourced from the canonical taxonomy
            (common types not already held) so this row mirrors exactly what the
            + Add control on the Liabilities tile can create — no more advertising
            types nothing could add (founder 2026-06-02). */}
        {(() => {
          const heldTypes = allLoans.map(l => l.type)
          const gaps = gapLiabilityTypes(heldTypes)
          if (gaps.length === 0) return null
          return (
            <Section title="4 · Not captured yet" sub="Common UK debt types you don't have on file — add any from the + Add control on the Liabilities tile.">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {gaps.map(t => (
                  <span key={t.id} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '6px 12px', borderRadius: 100,
                    background: 'var(--c-surface2)', border: '1px dashed var(--c-border)',
                    color: 'var(--c-text3)', fontSize: 11, fontWeight: 600,
                  }}><span>{t.icon}</span>+ {t.label}</span>
                ))}
              </div>
            </Section>
          )
        })()}

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
