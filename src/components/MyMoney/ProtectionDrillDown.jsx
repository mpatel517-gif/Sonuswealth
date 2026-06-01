// ─────────────────────────────────────────────────────────────────────────────
// ProtectionDrillDown — per-policy panel for Domain J (life/CI/IP) + K/L (insurance).
//
// What this panel surfaces:
//   1. Coverage summary: life · CI · IP · PMI gap analysis
//   2. Per-policy detail with trust status + provider + premium
//   3. Months-of-cover from IP benefit (Risk D1 link)
//   4. In-trust check — outside estate for IHT vs in estate
//   5. General + business insurance grouped at bottom
//
// Spec sources: 3-Engine-mm-asset-taxonomy-v1_0.md Domain J/K/L; MyMoney v2.7 §14–§16.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import OverlayShell from '../shared/OverlayShell.jsx'
import { DrillStackProvider, useDrillStackContext } from './L3/DrillStack.jsx'
import { DrillableNumber } from './L3/DrillableNumber.jsx'
import DrillContextStub, { ClaimsPaidStub } from './DrillContextStub.jsx'
import AssetDetailOverlay from './AssetDetailOverlay.jsx'
import { BRAND } from '../../config/brand.js'
import { monthlyEssentials as getMonthlyEssentials } from '../../engine/selectors/index.js'

function fmt(v) {
  const n = Math.round(+v || 0)
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${n < 0 ? '−' : ''}£${(abs / 1_000_000).toFixed(2)}m`
  if (abs >= 1_000)     return `${n < 0 ? '−' : ''}£${(abs / 1_000).toFixed(0)}k`
  return `${n < 0 ? '−' : ''}£${abs.toLocaleString()}`
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

function PolicyRow({ title, exists, amount, premium, provider, inTrust, extras = [], onTap }) {
  const body = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>{title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: exists ? 'var(--c-text)' : 'var(--c-text3)', fontVariantNumeric: 'tabular-nums' }}>
            {exists ? fmt(amount) : '—'}
          </div>
          {exists && onTap && <span style={{ fontSize: 14, color: 'var(--c-text3)' }}>›</span>}
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 8 }}>
        {exists ? `${provider || 'Provider unknown'} · ${premium ? `£${premium}/mo` : 'premium n/a'}` : 'No cover in place'}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {exists ? (
          <>
            <Chip tone="good">Active</Chip>
            {inTrust === true && <Chip tone="good">In trust · outside estate</Chip>}
            {inTrust === false && <Chip tone="warn">Not in trust · in estate</Chip>}
            {extras.map(e => <Chip key={e.label} tone={e.tone || 'neutral'}>{e.label}</Chip>)}
          </>
        ) : (
          <Chip tone="bad">Gap</Chip>
        )}
      </div>
    </>
  )
  if (exists && onTap) {
    return (
      <button type="button" onClick={onTap} className="sw-press"
        style={{
          padding: '14px', width: '100%', textAlign: 'left',
          background: 'transparent', border: 'none', borderRadius: 0,
          color: 'inherit', cursor: 'pointer', display: 'block',
        }}>
        {body}
      </button>
    )
  }
  return <div style={{ padding: '14px' }}>{body}</div>
}

// L3-1b (2026-05-28): DrillStack wrapper per README pattern.
export default function ProtectionDrillDown(props) {
  return (
    <DrillStackProvider>
      <ProtectionDrillDownInner {...props} />
    </DrillStackProvider>
  )
}

function ProtectionDrillDownInner({ entity, personaId, onBack, onHome }) {
  const drillStack = useDrillStackContext()
  const [selected, setSelected] = useState(null)
  const p = entity.assets?.protection || {}
  const generalInsurance = entity.general_insurance || entity.assets?.general_insurance || []
  const businessInsurance = entity.business_insurance || entity.assets?.business_insurance || []

  const life = p.lifeInsurance || {}
  const ci = p.criticalIllness || {}
  const ip = p.incomeProtection || {}
  const pmi = p.pmi || {}
  const relevantLife = p.relevantLifePlan || {}
  const keyPerson = p.keyPerson || {}

  const totalLifeCover = (life.exists ? +life.amount || 0 : 0) + (relevantLife.exists ? +relevantLife.amount || 0 : 0)
  const ipMonthly = ip.exists ? +ip.monthlyBenefit || 0 : 0
  // P1-17 (2026-05-28): hardcoded £2,500 fallback hid the failure mode —
  // a retiree (employment=0) saw "need £0 of cover" because annualIncome
  // collapsed to 0 AND essentials hit the £2,500 hardcode, producing a
  // garbage cover-need calculation. Now we read essentials from the
  // canonical helper. If it returns 0 we DON'T fake a number — we set
  // monthsCovered to null and let the UI render the empty state.
  const _essRead = getMonthlyEssentials(entity)
  const monthlyEssentials = _essRead.monthly || 0
  const essentialsAreEstimated = !!_essRead.isEstimate || monthlyEssentials === 0
  const monthsCovered = (ipMonthly > 0 && monthlyEssentials > 0)
    ? ipMonthly / monthlyEssentials
    : null

  // Gap score — rudimentary count of the four core types
  const coreCount = [life.exists, ci.exists, ip.exists, pmi.exists].filter(Boolean).length
  const gapTone = coreCount >= 3 ? 'good' : coreCount === 2 ? 'warn' : 'bad'

  // P15 regression fix: life-stage filter moved BELOW annualIncome declaration
  // because `showIncomeProtection` references annualIncome. The original
  // placement (above line 174) caused a TDZ ReferenceError that crashed the
  // whole component — both /money/business + /money/protection routes went
  // blank because they share the import. Filter now derived after annualIncome.

  // IFA HIGH-7 + MED-34 — protection cover gap (rule-of-thumb only, not advice).
  // P1-16 (2026-05-28): include dividends + rental + self-employment net.
  // Previously annualIncome only read employment/salary fields, which
  // under-stated cover need by 4-6× for directors (income shifted to
  // dividends), landlords (rental), and self-employed.
  const indAge = +(entity.individual?.age ?? entity.age ?? 0) || 0
  const annualIncome = Math.max(
    +(entity.income?.employment || 0),
    +(entity.income?.salary || 0),
    +(entity.gross_salary || 0),
  ) + (+entity.income?.dividends || 0)
    + (+entity.income?.rentalIncome || 0)
    + (+entity.income?.selfEmploymentNet || 0)
    + (+entity.income?.directorSalary || 0)

  // P13-8 (2026-05-28, IFA hardening): life-stage filter on which gap cards
  // are clinically relevant. Below annualIncome so the IP gate sees real income.
  const _lifeStage = String(entity?.lifeStage || entity?.life_stage || '').toLowerCase()
  const _lifeStageNum = +entity?.lifeStage
  const _ageForFilter = +(entity?.age ?? entity?.individual?.age ?? 0) || 0
  const _isPreservation = _lifeStage === 'preservation' || _lifeStage === 'legacy' || _lifeStageNum === 6
  const showLifeCover = true
  const showCriticalIllness = !_isPreservation && _ageForFilter < 70
  const showIncomeProtection = !_isPreservation && annualIncome > 0
  const showPMI = true
  const liabsMortgage = +(entity.liabilities?.mortgage?.outstanding || 0)
  const otherLoansArr = entity.liabilities?.other_loans || entity.liabilities?.otherLoans || []
  const otherLoansSum = Array.isArray(otherLoansArr)
    ? otherLoansArr.reduce((s, l) => s + +(l.outstanding || l.balance || 0), 0)
    : 0
  const remainingLiabilities = liabsMortgage + otherLoansSum
  const annualEssentials = monthlyEssentials * 12
  const needLifeCover = indAge > 0 && indAge < 50
    ? 10 * annualIncome
    : remainingLiabilities + 3 * annualEssentials
  const currentLifeCover = totalLifeCover
  const lifeCoverGap = Math.max(0, needLifeCover - currentLifeCover)

  // ── Context blob injected into every setSelected asset so ProtectionDecisions
  // can model decisions without re-computing from entity. Step 2 contract.
  const _ctx = {
    _annualIncome:  annualIncome,
    _dependents:    +(entity.profile?.dependents ?? entity.dependents ?? 0),
    _totalCover:    totalLifeCover,
    _coverGap:      lifeCoverGap,
  }

  return (
    <OverlayShell title="Protection · drill-down"
      subtitle={coreCount === 0 ? 'No protection on file' : (
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'baseline' }}>
          <DrillableNumber
            metric="Total life cover"
            value={fmt(totalLifeCover)}
            formula={`Sum of life-insurance sums-assured across all in-force policies. ${coreCount} of 4 core layers in place (life / critical illness / income protection / PMI).`}
            source={`${coreCount}/4 core policies on file`}
            confidence="high"
            breakdown={[{ label: `${coreCount}/4 core layers`, value: fmt(totalLifeCover) }]}
            onDrill={drillStack.pushNumber}
          />
          <span style={{ fontSize: 13, color: 'var(--c-text3)' }}>· {coreCount}/4 core</span>
        </span>
      )}
      onBack={onBack} onHome={onHome}>
      <div style={{ padding: '16px 16px 40px' }}>

        {/* Distinctive subtitle — v0.3 eyebrow */}
        <div
          className="sw-eyebrow"
          style={{ fontStyle: 'italic', color: 'var(--c-text3)', marginBottom: 10 }}
        >
          What&apos;s covered, by whom, and when it pays
        </div>

        {/* Section 1 — overview */}
        <Section title="1 · What's covered and where the gaps are" sub="Four cover types — life, critical illness, income protection, private medical. Life cover policies written into a discretionary trust are typically held outside the estate for IHT. The structure depends on personal circumstances — beneficiaries, trustees, scheme rules.">
          {/* IFA HIGH-7 + MED-34 — life cover gap (rule-of-thumb, information only) */}
          <div style={{
            marginBottom: 10, padding: '10px 12px',
            background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14,
            fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.5,
          }}>
            {lifeCoverGap > 0
              ? <>Cover gap — <strong style={{ color: 'var(--c-coral, #FF6F7D)' }}>{fmt(lifeCoverGap)}</strong>. Based on a rule-of-thumb need of {fmt(needLifeCover)} versus current cover {fmt(currentLifeCover)}.</>
              : <>Current cover <strong style={{ color: 'var(--c-acc)' }}>{fmt(currentLifeCover)}</strong> is at or above the rule-of-thumb need of {fmt(needLifeCover)}.</>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
            <Tile label="Pillars covered" value={`${coreCount}/4`} tone={gapTone} sub="Life · CI · IP · PMI" />
            <Tile label="Total life cover" value={fmt(totalLifeCover)} tone="good" sub="Term + relevant life" />
            <Tile label="IP monthly benefit" value={fmt(ipMonthly)} sub="Tax-free if employee-paid" />
            <Tile
              label="Months of cover"
              value={monthsCovered == null ? '—' : monthsCovered.toFixed(1)}
              tone={monthsCovered == null ? 'neutral' : monthsCovered >= 6 ? 'good' : 'warn'}
              sub={monthsCovered == null
                ? 'Add monthly essentials to see months of cover'
                : essentialsAreEstimated
                  ? `vs ${fmt(monthlyEssentials)} essentials (estimated)`
                  : `vs ${fmt(monthlyEssentials)} essentials`}
            />
          </div>
        </Section>

        {/* Section 2 — life / CI / IP / PMI */}
        <Section title="2 · Your core policies">
          {/* P13-8 (2026-05-28, IFA hardening): life-stage context note when
              some cover types aren't clinically relevant. The cards still render
              (transparency), but with reduced-emphasis explainer copy. */}
          {(!showCriticalIllness || !showIncomeProtection) && (
            <div style={{
              marginBottom: 10, padding: '8px 12px',
              background: 'var(--c-tint-neutral)',
              borderRadius: 10, fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.5,
            }}>
              At your life-stage, {!showIncomeProtection && 'income protection becomes less relevant once employment income stops'}
              {!showCriticalIllness && !showIncomeProtection && '; '}
              {!showCriticalIllness && 'critical illness cover is typically prohibitive to underwrite past 70'}
              . Life cover discussions shift toward IHT framing rather than income replacement.
            </div>
          )}
          <div style={{ background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14, overflow: 'hidden' }}>
            {showLifeCover && (
              <PolicyRow title="Life assurance — term" exists={life.exists} amount={life.amount} premium={life.premium} provider={life.provider}
                inTrust={life.inTrust}
                extras={[
                  life.term_years && { label: `${life.term_years}y term` },
                  life.start_date && { label: `Since ${String(life.start_date).slice(0,4)}` },
                ].filter(Boolean)}
                onTap={() => setSelected({ asset: { ...life, ..._ctx, name: 'Life assurance — term', type: 'life-cover', value: life.amount }, category: 'protection', itemType: 'life' })} />
            )}
            {showCriticalIllness && (
              <>
                <div style={{ borderTop: '1px solid var(--c-sep)' }} />
                <PolicyRow title="Critical illness cover" exists={ci.exists} amount={ci.amount} premium={ci.premium} provider={ci.provider}
                  onTap={() => setSelected({ asset: { ...ci, ..._ctx, name: 'Critical illness cover', type: 'critical-illness', value: ci.amount }, category: 'protection', itemType: 'critical-illness' })} />
              </>
            )}
            {showIncomeProtection && (
              <>
                <div style={{ borderTop: '1px solid var(--c-sep)' }} />
                <PolicyRow title="Income protection" exists={ip.exists} amount={ip.exists ? ((+ip.monthlyBenefit || 0) * 12) : 0} premium={ip.premium} provider={ip.provider}
                  extras={[
                    ip.deferred_period_weeks != null && { label: `${ip.deferred_period_weeks}-wk deferred` },
                    ip.cover_pct_of_salary != null && { label: `${Math.round(ip.cover_pct_of_salary * 100)}% of salary` },
                  ].filter(Boolean)}
                  onTap={() => setSelected({ asset: { ...ip, ..._ctx, name: 'Income protection', type: 'income-protection', value: (+ip.monthlyBenefit || 0) * 12 }, category: 'protection', itemType: 'income-protection' })} />
              </>
            )}
            {showPMI && (
              <>
                <div style={{ borderTop: '1px solid var(--c-sep)' }} />
                <PolicyRow title="Private medical (PMI)" exists={pmi.exists} amount={0} premium={pmi.premium} provider={pmi.provider}
                  onTap={() => setSelected({ asset: { ...pmi, ..._ctx, name: 'Private medical (PMI)', type: 'pmi', value: 0 }, category: 'protection', itemType: 'pmi' })} />
              </>
            )}
          </div>
        </Section>

        {/* Section 3 — business-specific protection */}
        {(relevantLife.exists || keyPerson.exists || p.shareholderProtection?.exists) && (
          <Section title="3 · Business-specific protection" sub="Relevant life: company pays the premium (tax-deductible), payout in trust sits outside your estate. Keyman: covers loss of a critical person. Shareholder protection: funds a buyout when a shareholder dies.">
            <div style={{ background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14, overflow: 'hidden' }}>
              {relevantLife.exists && (
                <PolicyRow title="Relevant life plan" exists={true} amount={relevantLife.amount} premium={relevantLife.premium} provider={relevantLife.provider}
                  inTrust={true}
                  extras={[{ label: 'Corp tax deductible', tone: 'good' }, relevantLife.via_company && { label: 'Via company' }].filter(Boolean)}
                  onTap={() => setSelected({ asset: { ...relevantLife, ..._ctx, name: 'Relevant life plan', type: 'relevant-life', value: relevantLife.amount }, category: 'protection', itemType: 'relevant-life' })} />
              )}
              {relevantLife.exists && keyPerson.exists && <div style={{ borderTop: '1px solid var(--c-sep)' }} />}
              {keyPerson.exists && (
                <PolicyRow title="Keyperson insurance" exists={true} amount={keyPerson.amount} premium={keyPerson.premium} provider={keyPerson.provider}
                  extras={[{ label: 'Business asset' }]}
                  onTap={() => setSelected({ asset: { ...keyPerson, ..._ctx, name: 'Keyperson insurance', type: 'keyperson', value: keyPerson.amount }, category: 'protection', itemType: 'keyperson' })} />
              )}
            </div>
          </Section>
        )}

        {/* Section 4 — general insurance */}
        {generalInsurance.length > 0 && (
          <Section title="4 · General insurance" sub="Home, contents, car, travel. Doesn't add to your net worth, but cover gaps matter for resilience.">
            <div style={{ background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14, overflow: 'hidden' }}>
              {generalInsurance.map((g, i) => {
                const gType = g.type || 'general'
                return (
                <button
                  key={g.id || i}
                  type="button"
                  onClick={() => setSelected({ asset: { ...g, ..._ctx, name: gType.replace(/-/g, ' '), type: gType, value: g.cover_amount, source: g.source || 'manual' }, category: 'protection', itemType: gType })}
                  className="sw-press"
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '12px 14px', cursor: 'pointer',
                    borderBottom: i < generalInsurance.length - 1 ? '1px solid var(--c-sep)' : 'none',
                    border: 'none', borderRadius: 0, background: 'transparent', color: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
                  }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>{gType.replace(/-/g, ' ')}</div>
                    <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>
                      {g.provider} · £{g.premium_annual || 0}/yr · cover {fmt(g.cover_amount)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Chip>Annual</Chip>
                    <span style={{ fontSize: 14, color: 'var(--c-text3)' }}>›</span>
                  </div>
                </button>
                )
              })}
            </div>
          </Section>
        )}

        {/* Section 5 — business insurance */}
        {businessInsurance.length > 0 && (
          <Section title="5 · Cover your business needs" sub="Professional indemnity is required for regulated professions. Employers' liability is legally required if you employ anyone — including casual or part-time. Premiums are a deductible business expense.">
            <div style={{ background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14, overflow: 'hidden' }}>
              {businessInsurance.map((bi, i) => {
                const biType = bi.type || 'business'
                return (
                <button
                  key={bi.id || i}
                  type="button"
                  onClick={() => setSelected({ asset: { ...bi, ..._ctx, name: biType.replace(/-/g, ' '), type: biType, value: bi.cover_amount, source: bi.source || 'manual' }, category: 'protection', itemType: biType })}
                  className="sw-press"
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '12px 14px', cursor: 'pointer',
                    borderBottom: i < businessInsurance.length - 1 ? '1px solid var(--c-sep)' : 'none',
                    border: 'none', borderRadius: 0, background: 'transparent', color: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
                  }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>{biType.replace(/-/g, ' ')}</div>
                    <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>
                      {bi.provider} · £{bi.premium_annual || 0}/yr · cover {fmt(bi.cover_amount)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Chip tone="good">Allowable</Chip>
                    <span style={{ fontSize: 14, color: 'var(--c-text3)' }}>›</span>
                  </div>
                </button>
                )
              })}
            </div>
          </Section>
        )}

        {/* Section 5c — PET-with-cover overlay (v0.3 signature) */}
        {(() => {
          const gifts = entity.gifts || []
          const now = Date.now()
          const taperRate = (yearsElapsed) => {
            if (yearsElapsed < 3) return 1.00
            if (yearsElapsed < 4) return 0.80
            if (yearsElapsed < 5) return 0.60
            if (yearsElapsed < 6) return 0.40
            if (yearsElapsed < 7) return 0.20
            return 0.00
          }
          const livePets = gifts
            .filter(g => g.dateGiven)
            .map(g => {
              const t = new Date(g.dateGiven).getTime()
              const yearsElapsed = (now - t) / (365.25 * 24 * 3600 * 1000)
              return { ...g, yearsElapsed, yearsRemaining: Math.max(0, 7 - yearsElapsed) }
            })
            .filter(g => g.yearsElapsed < 7)

          const inTrustCoverPool =
            (life.exists && life.inTrust ? +life.amount || 0 : 0) +
            (relevantLife.exists ? +relevantLife.amount || 0 : 0)

          return (
            <Section title="PET-with-cover overlay" sub="7-year taper × gift-inter-vivos cover">
              <div style={{
                background: 'var(--card-bg2)', border: '1px solid var(--c-border)',
                borderRadius: 14, overflow: 'hidden',
              }}>
                {livePets.length === 0 ? (
                  <div style={{ padding: '14px', fontSize: 12, color: 'var(--c-text3)', lineHeight: 1.5 }}>
                    No lifetime gifts recorded — no PET exposure to overlay.
                  </div>
                ) : (
                  livePets.map((g, i) => {
                    const amt = +g.amount || 0
                    const rate = taperRate(g.yearsElapsed)
                    const taperedLiability = Math.round(amt * 0.40 * rate)
                    const coverShortfall = Math.max(0, taperedLiability - inTrustCoverPool)
                    return (
                      <div key={g.id || i} style={{
                        padding: '12px 14px',
                        borderBottom: i < livePets.length - 1 ? '1px solid var(--c-sep)' : 'none',
                        display: 'flex', flexDirection: 'column', gap: 6,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>
                            Gift {fmt(amt)} {g.recipient ? `→ ${g.recipient}` : ''}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>
                            {g.yearsRemaining.toFixed(1)}y to clear
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <Chip>{Math.round(rate * 100)}% taper rate</Chip>
                          <Chip tone="warn">IHT exposure {fmt(taperedLiability)}</Chip>
                          {coverShortfall > 0
                            ? <Chip tone="bad">Cover shortfall {fmt(coverShortfall)}</Chip>
                            : <Chip tone="good">Covered by in-trust pool</Chip>}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              <div style={{
                marginTop: 10, padding: '10px 12px',
                background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14,
                fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.5,
              }}>
                <strong style={{ color: 'var(--c-text)' }}>Gift inter-vivos</strong> — term assurance that covers the 7-year tapering IHT liability on lifetime gifts. Cover steps down each year matching taper. Not a transactional product on this surface.
              </div>
              <div style={{
                marginTop: 8, padding: '10px 12px',
                background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14,
                fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.5,
              }}>
                <strong style={{ color: 'var(--c-text)' }}>Gift With Reservation of Benefit (FA 1986 s102)</strong> — a gift you continue to benefit from is treated as still part of your estate for IHT. Examples: house gifted but still lived in rent-free; chattels gifted but still used.
              </div>
            </Section>
          )
        })()}

        {/* Section 5b — Knowledge-hall context (claims-paid + Defaqto + provider quality) */}
        <DrillContextStub
          eyebrow="Provider quality · claims paid"
          title="How often each insurer actually pays out, Defaqto ratings, alternative cover shapes"
          preview={<ClaimsPaidStub />}
          bullets={[
            'Annual claims-paid percentage by provider (ABI published data)',
            'Defaqto rating for each policy you hold',
            'Trust setup checklist — putting life cover outside your estate',
            'Sum-assured gap analysis: dependants × multiplier vs current cover',
            'Income protection waiting-period and benefit-cap detail per policy',
          ]}
          askQuestion="How does my insurer's claims-paid record compare, and where are the gaps in my cover?"
        />

        {/* Section 6 — taxonomy gaps */}
        <Section title="6 · Not captured yet" sub="Other protection products you could add here:">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {['Family income benefit', 'Whole of life', 'Mortgage payment protection', 'Group life (DIS)', 'Group income protection', 'Shareholder protection', 'Long-term care', 'Travel insurance', 'Legal expenses', 'Specialist valuables', 'Employers\' liability', 'D&O', 'Cyber', 'Business interruption'].map(t => (
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
          asset={selected.asset}
          domain="protection"
          category={selected.category}
          itemType={selected.itemType}
          personaId={personaId}
          onBack={() => setSelected(null)}
          onHome={onHome}
        />
      )}
    </OverlayShell>
  )
}
