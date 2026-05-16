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
import DrillContextStub, { ClaimsPaidStub } from './DrillContextStub.jsx'
import AssetDetailOverlay from './AssetDetailOverlay.jsx'

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

export default function ProtectionDrillDown({ entity, personaId, onBack, onHome }) {
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
  const monthlyEssentials = +entity.expenses?.essential_monthly || 2500
  const monthsCovered = ipMonthly > 0 ? ipMonthly / monthlyEssentials : 0

  // Gap score — rudimentary count of the four core types
  const coreCount = [life.exists, ci.exists, ip.exists, pmi.exists].filter(Boolean).length
  const gapTone = coreCount >= 3 ? 'good' : coreCount === 2 ? 'warn' : 'bad'

  return (
    <OverlayShell title="Protection · drill-down"
      subtitle={`${coreCount}/4 core · ${fmt(totalLifeCover)} life cover`}
      onBack={onBack} onHome={onHome}>
      <div style={{ padding: '16px 16px 40px' }}>

        {/* Section 1 — overview */}
        <Section title="1 · What's covered and where the gaps are" sub="Four cover types — life, critical illness, income protection, private medical. Life cover placed in trust sits outside your estate for inheritance tax.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
            <Tile label="Pillars covered" value={`${coreCount}/4`} tone={gapTone} sub="Life · CI · IP · PMI" />
            <Tile label="Total life cover" value={fmt(totalLifeCover)} tone="good" sub="Term + relevant life" />
            <Tile label="IP monthly benefit" value={fmt(ipMonthly)} sub="Tax-free if employee-paid" />
            <Tile label="Months of cover" value={monthsCovered.toFixed(1)} tone={monthsCovered >= 6 ? 'good' : 'warn'} sub={`vs ${fmt(monthlyEssentials)} essentials`} />
          </div>
        </Section>

        {/* Section 2 — life / CI / IP / PMI */}
        <Section title="2 · Your core policies">
          <div style={{ background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14, overflow: 'hidden' }}>
            <PolicyRow title="Life assurance — term" exists={life.exists} amount={life.amount} premium={life.premium} provider={life.provider}
              inTrust={life.inTrust}
              extras={[
                life.term_years && { label: `${life.term_years}y term` },
                life.start_date && { label: `Since ${String(life.start_date).slice(0,4)}` },
              ].filter(Boolean)}
              onTap={() => setSelected({ asset: { ...life, name: 'Life assurance — term', type: 'life-cover', value: life.amount }, category: 'protection', itemType: 'life' })} />
            <div style={{ borderTop: '1px solid var(--c-sep)' }} />
            <PolicyRow title="Critical illness cover" exists={ci.exists} amount={ci.amount} premium={ci.premium} provider={ci.provider}
              onTap={() => setSelected({ asset: { ...ci, name: 'Critical illness cover', type: 'critical-illness', value: ci.amount }, category: 'protection', itemType: 'critical-illness' })} />
            <div style={{ borderTop: '1px solid var(--c-sep)' }} />
            <PolicyRow title="Income protection" exists={ip.exists} amount={ip.exists ? ((+ip.monthlyBenefit || 0) * 12) : 0} premium={ip.premium} provider={ip.provider}
              extras={[
                ip.deferred_period_weeks != null && { label: `${ip.deferred_period_weeks}-wk deferred` },
                ip.cover_pct_of_salary != null && { label: `${Math.round(ip.cover_pct_of_salary * 100)}% of salary` },
              ].filter(Boolean)}
              onTap={() => setSelected({ asset: { ...ip, name: 'Income protection', type: 'income-protection', value: (+ip.monthlyBenefit || 0) * 12 }, category: 'protection', itemType: 'income-protection' })} />
            <div style={{ borderTop: '1px solid var(--c-sep)' }} />
            <PolicyRow title="Private medical (PMI)" exists={pmi.exists} amount={0} premium={pmi.premium} provider={pmi.provider}
              onTap={() => setSelected({ asset: { ...pmi, name: 'Private medical (PMI)', type: 'pmi', value: 0 }, category: 'protection', itemType: 'pmi' })} />
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
                  onTap={() => setSelected({ asset: { ...relevantLife, name: 'Relevant life plan', type: 'relevant-life', value: relevantLife.amount }, category: 'protection', itemType: 'relevant-life' })} />
              )}
              {relevantLife.exists && keyPerson.exists && <div style={{ borderTop: '1px solid var(--c-sep)' }} />}
              {keyPerson.exists && (
                <PolicyRow title="Keyperson insurance" exists={true} amount={keyPerson.amount} premium={keyPerson.premium} provider={keyPerson.provider}
                  extras={[{ label: 'Business asset' }]}
                  onTap={() => setSelected({ asset: { ...keyPerson, name: 'Keyperson insurance', type: 'keyperson', value: keyPerson.amount }, category: 'protection', itemType: 'keyperson' })} />
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
                  onClick={() => setSelected({ asset: { ...g, name: gType.replace(/-/g, ' '), type: gType, value: g.cover_amount, source: g.source || 'manual' }, category: 'protection', itemType: gType })}
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
                  onClick={() => setSelected({ asset: { ...bi, name: biType.replace(/-/g, ' '), type: biType, value: bi.cover_amount, source: bi.source || 'manual' }, category: 'protection', itemType: biType })}
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
