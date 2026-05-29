// ─────────────────────────────────────────────────────────────────────────────
// BusinessDrillDown — per-business panel for Domain H + Domain I.
//
// What this panel surfaces:
//   1. Total business value (companies + share schemes + DLA)
//   2. BPR position — qualifying value within £2.5m combined cap from April 2026
//   3. BADR position — 5%+ shareholding, officer/employee, 2yr hold
//   4. Per-company shareholding, trading vs investment, IHT relief eligibility
//   5. Share scheme holdings (EMI / CSOP / SAYE / SIP / unapproved) with vesting
//   6. Director's loan account (asset or liability + S455 risk)
//
// Spec sources: 3-Engine-mm-asset-taxonomy-v1_0.md Domain H/I; MyMoney v2.7 §11–§13.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import OverlayShell from '../shared/OverlayShell.jsx'
import { DrillStackProvider, useDrillStackContext } from './L3/DrillStack.jsx'
import { DrillableNumber } from './L3/DrillableNumber.jsx'
import ExplainerChip from '../shared/Explainer.jsx'
import TaxTreatmentBlock from './TaxTreatmentBlock.jsx'
import DrillContextStub, { BusinessActivityStub } from './DrillContextStub.jsx'
import AssetDetailOverlay from './AssetDetailOverlay.jsx'
import { BRAND } from '../../config/brand.js'
import { TAX } from '../../engine/fq-calculator.js'

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

// L3-1b (2026-05-28): DrillStack wrapper per README pattern.
export default function BusinessDrillDown(props) {
  return (
    <DrillStackProvider>
      <BusinessDrillDownInner {...props} />
    </DrillStackProvider>
  )
}

function BusinessDrillDownInner({ entity, personaId, onBack, onHome }) {
  const drillStack = useDrillStackContext()
  const [selected, setSelected] = useState(null)
  const a = entity.assets || {}
  const companies = entity.companies || []
  const businessAssets = entity.business_assets || a.business_assets || []
  const shareSchemes = entity.share_schemes || a.share_schemes || []
  const dla = entity.directors_loan || a.directors_loan

  // Total business value (companies + business_assets + share schemes + DLA if asset)
  const companiesValue = companies.reduce((s, c) => s + (+c.share_value_gbp || +c.value || 0), 0)
  const businessAssetsValue = businessAssets.reduce((s, b) => s + (+b.value || +b.value_gbp || 0), 0)
  const shareSchemesValue = shareSchemes.reduce((s, sc) => s + (+sc.estimated_value || +sc.value_gbp || 0), 0)
  const dlaValue = dla?.in_credit ? (+dla.balance || 0) : 0
  const total = companiesValue + businessAssetsValue + shareSchemesValue + dlaValue

  // BPR-qualifying value
  const bprQualifying = [
    ...companies.filter(c => c.trading_status === 'trading').map(c => +c.share_value_gbp || +c.value || 0),
    ...businessAssets.filter(b => b.qualifies_for_bpr).map(b => +b.value || +b.value_gbp || 0),
  ].reduce((s, v) => s + v, 0)
  const bprCap = 2_500_000
  const bprAboveCap = Math.max(bprQualifying - bprCap, 0)

  return (
    <OverlayShell title="Business assets · drill-down"
      subtitle={
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'baseline' }}>
          <DrillableNumber
            metric="Total business value"
            value={fmt(total)}
            formula={`Sum of every private-company holding + share-scheme position. ${companies.length} compan${companies.length === 1 ? 'y' : 'ies'} + ${shareSchemes.length} share scheme${shareSchemes.length === 1 ? '' : 's'}.`}
            source={`${companies.length + shareSchemes.length} holding${companies.length + shareSchemes.length === 1 ? '' : 's'} on file`}
            confidence="high"
            breakdown={[
              ...companies.map((c, i) => ({ label: c.name || `Company #${i + 1}`, value: fmt(+(c.value ?? c.value_gbp ?? 0)) })),
              ...shareSchemes.map((s, i) => ({ label: s.name || `Share scheme #${i + 1}`, value: fmt(+(s.value ?? s.value_gbp ?? 0)) })),
            ]}
            onDrill={drillStack.pushNumber}
          />
          <span style={{ fontSize: 13, color: 'var(--c-text3)' }}>· {companies.length} compan{companies.length === 1 ? 'y' : 'ies'} · {shareSchemes.length} scheme{shareSchemes.length === 1 ? '' : 's'}</span>
        </span>
      }
      onBack={onBack} onHome={onHome}>
      <div style={{ padding: '16px 16px 40px' }}>

        {/* Distinctive subtitle (v0.3 delta 1) */}
        <div className="sw-eyebrow" style={{ fontStyle: 'italic', color: 'var(--c-text3)', marginBottom: 10 }}>
          How your business pays you, and what you keep
        </div>

        {/* Section 1 — composition */}
        <Section title="1 · Composition">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
            <Tile label="Total business" value={fmt(total)} tone="good" />
            <Tile label="Company equity" value={fmt(companiesValue)} />
            <Tile label="Share schemes" value={fmt(shareSchemesValue)} sub="EMI / RSU / SIP / SAYE" />
            {dla && <Tile label="Director's loan" value={fmt(dla.balance)} sub={dla.in_credit ? 'Asset (in credit)' : 'Liability'} tone={dla.in_credit ? 'good' : 'warn'} />}
          </div>
        </Section>

        {/* Section 1b — Tax treatment summary (spec §2.3) */}
        <Section title="Tax treatment · GIA + Business Relief" sub="Companies, share schemes, and BPR-qualifying GIA carry GIA tax treatment plus IHT relief on qualifying value.">
          <TaxTreatmentBlock
            wrapper="GIA"
            asset={{ type: 'gia', qualifies_for_bpr: bprQualifying > 0 }}
            label="Tax treatment · Business assets"
          />
        </Section>

        {/* Section 2 — IHT relief position */}
        <Section title={<><span>2 · </span><Term id="MM-BPR">BPR</Term><span> position (April 2026)</span></>} sub="Business Property Relief — combined £2,500,000 cap on 100% relief assets (unquoted shares, business chattels). Excess + AIM-listed shares get 50% relief. Finance Act 2026 effective April 2026.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 8 }}>
            <Tile label="BPR-qualifying" value={fmt(bprQualifying)} tone={bprQualifying > 0 ? 'good' : 'neutral'} />
            <Tile label="£2.5m combined cap" value={fmt(bprCap)} sub="From April 2026" />
            <Tile label="Above cap (50% relief)" value={fmt(bprAboveCap)} tone={bprAboveCap > 0 ? 'warn' : 'good'} sub={bprAboveCap > 0 ? 'Effective IHT 20%' : 'Within cap'} />
          </div>
          <div style={{
            height: 8, borderRadius: 100, background: 'var(--c-surface2)', overflow: 'hidden',
            display: 'flex',
          }}>
            <div style={{
              width: `${Math.min(100, (Math.min(bprQualifying, bprCap) / bprCap) * 100)}%`,
              height: '100%', background: 'var(--c-acc)', boxShadow: '0 0 8px var(--c-acc)',
            }} />
            {bprAboveCap > 0 && (
              <div style={{
                width: `${Math.min(100 - (Math.min(bprQualifying, bprCap) / bprCap) * 100, (bprAboveCap / bprCap) * 100)}%`,
                height: '100%', background: '#FF9500',
              }} />
            )}
          </div>
        </Section>

        {/* Section 3 — companies */}
        {companies.length > 0 && (
          <Section title="3 · Companies" sub={
            <>Trading vs investment company test is the gateway for <Term id="MM-BPR">BPR</Term> + <Term id="MM-BADR">BADR</Term>. &gt;50% investment income = investment company.</>
          }>
            <div style={{ background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14, overflow: 'hidden' }}>
              {companies.map((c, i) => {
                const trading = c.trading_status === 'trading'
                const sharePct = (+c.shareholding_pct || 0) * 100
                const fivePct = sharePct >= 5
                return (
                  <div key={c.id || i} style={{
                    padding: '14px',
                    borderBottom: i < companies.length - 1 ? '1px solid var(--c-sep)' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>{c.name}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>
                        {fmt(c.share_value_gbp || c.value)}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 8 }}>
                      {c.role || 'Shareholder'} · {sharePct.toFixed(0)}% · turnover {fmt(c.annual_turnover)}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {trading && <Chip tone="good">Trading</Chip>}
                      {!trading && <Chip tone="bad">Investment co — no BPR</Chip>}
                      {trading && <Chip tone="good">BPR eligible</Chip>}
                      {trading && fivePct && <Chip tone="good">BADR · 5%+ qualifying</Chip>}
                      {trading && !fivePct && <Chip tone="warn">BADR · &lt;5% holding</Chip>}
                      {/* TODO: source from TAX once corp tax small/main rates are exposed on the rules bundle */}
                      <Chip>Corp tax 19/25%</Chip>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelected({ asset: { ...c, value: +c.share_value_gbp || +c.value || 0, type: 'company' }, category: 'business', itemType: 'company' })}
                      className="sw-press"
                      style={{
                        marginTop: 10, padding: '8px 12px', borderRadius: 10,
                        border: '1px solid var(--c-border)', background: 'var(--c-surface2)',
                        color: 'var(--c-text)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      View details <span style={{ color: 'var(--c-text3)' }}>›</span>
                    </button>
                  </div>
                )
              })}
            </div>
          </Section>
        )}

        {/* Section 4 — share schemes */}
        {shareSchemes.length > 0 && (
          <Section title="4 · Shares you got through work" sub="Tax-advantaged schemes (EMI, CSOP, SAYE, SIP) skip income tax and National Insurance at exercise. Unapproved options get both. Concentration risk: too much wealth tied to a single employer's share price.">
            <div style={{ background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14, overflow: 'hidden' }}>
              {shareSchemes.map((s, i) => {
                const t = s.scheme_type
                const tax = t === 'EMI' ? 'EMI — no IT at grant; BADR from grant date'
                  : t === 'CSOP' ? 'CSOP — no IT if 3yr hold'
                  : t === 'SAYE' ? 'SAYE — no IT at exercise; ISA/pension transfer in 90 days'
                  : t === 'SIP' ? 'SIP — no IT if 5yr hold'
                  : 'Unapproved — IT + NIC on exercise gain'
                return (
                  <div key={s.id || i} style={{
                    padding: '14px',
                    borderBottom: i < shareSchemes.length - 1 ? '1px solid var(--c-sep)' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>{s.employer || s.scheme_type}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>
                        {fmt(s.estimated_value || s.value_gbp)}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 8 }}>{tax}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Chip tone="good">{t}</Chip>
                      {s.vesting_status && <Chip>{s.vesting_status}</Chip>}
                      {s.vested_count != null && <Chip>{s.vested_count.toLocaleString()} vested</Chip>}
                      {s.unvested_count > 0 && <Chip tone="warn">{s.unvested_count.toLocaleString()} unvested</Chip>}
                      <Chip tone="warn">Concentration risk</Chip>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelected({ asset: { ...s, value: +s.estimated_value || +s.value_gbp || 0, name: s.employer ? `${s.employer} · ${s.scheme_type}` : s.scheme_type, type: s.scheme_type }, category: 'business', itemType: 'share-scheme' })}
                      className="sw-press"
                      style={{
                        marginTop: 10, padding: '8px 12px', borderRadius: 10,
                        border: '1px solid var(--c-border)', background: 'var(--c-surface2)',
                        color: 'var(--c-text)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      View details <span style={{ color: 'var(--c-text3)' }}>›</span>
                    </button>
                  </div>
                )
              })}
            </div>
          </Section>
        )}

        {/* Section 5 — DLA */}
        {dla && (
          <Section title="5 · Money owed between you and your company" sub={dla.in_credit
              ? 'Credit balance — the company owes you. Counts as a personal asset for inheritance tax.'
              : 'Debit balance — you owe the company. If unpaid 9 months after the year-end, the company pays an extra 33.75% corporation tax (refunded once you repay). If the balance is over £10k and interest is below HMRC\'s official rate, HMRC treats the cheap loan as a taxable benefit.'}>
            <div style={{ background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>
                  {dla.in_credit ? 'In credit' : 'Outstanding loan to director'}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: dla.in_credit ? 'var(--c-acc)' : 'var(--c-coral, #FF6F7D)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(dla.balance)}
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>{dla.note}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                {dla.in_credit ? (
                  <>
                    <Chip tone="good">Personal asset</Chip>
                    <Chip>In estate</Chip>
                  </>
                ) : (
                  <>
                    <Chip tone="bad">S455 exposure</Chip>
                    <Chip tone="warn">s455 — {((TAX.s455Rate ?? 0.3375) * 100).toFixed(2)}% charge on director loans &gt; £10,000 outstanding 9 months after year-end</Chip>
                    {(+dla.balance || 0) > 10000 && <Chip tone="warn">BIK threshold breached</Chip>}
                  </>
                )}
              </div>
            </div>
          </Section>
        )}

        {/* Employer NIC (v0.3 delta 3) */}
        <Section title="Employer NIC">
          <div style={{ background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14, padding: 14 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <Chip tone="warn">Rate {((TAX.employerNICRate ?? 0.15) * 100).toFixed(0)}%</Chip>
              <Chip tone="good">Employment allowance £{(TAX.employmentAllowance ?? 10500).toLocaleString()}/yr</Chip>
              <Chip>Secondary threshold £{(TAX.employerNICThreshold ?? 5000).toLocaleString()}</Chip>
            </div>
            <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.5 }}>
              Employer NIC is 15% on salary above the secondary threshold. Employment allowance of £{(TAX.employmentAllowance ?? 10500).toLocaleString()}/yr available to most small companies (raised from £5,000 in April 2025; group cap applies).
            </div>
          </div>
        </Section>

        {/* Salary sacrifice mechanic (v0.3 delta 5) */}
        <Section title="Salary sacrifice — pension contribution mechanic">
          <div style={{ background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.5, marginBottom: 10 }}>
              Salary sacrifice — employee swaps salary for employer pension contribution. Saves employee NIC 8% and employer NIC 15% on sacrificed amount. Pension grows tax-relieved. NMW floor and contract-variation discipline required.
            </div>
            <div style={{
              background: 'var(--c-surface2)', border: '1px dashed var(--c-border)', borderRadius: 10,
              padding: 10, fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.5,
            }}>
              <div style={{ fontWeight: 700, color: 'var(--c-text2)', marginBottom: 4 }}>Worked example</div>
              £10,000 salary sacrificed = £10,000 into pension + ~£2,300 NIC saving (employee 8% + employer 15%).
            </div>
          </div>
        </Section>

        {/* Section 6 — taxonomy gaps */}
        {/* Section 5b — Knowledge-hall context (filings + sector + valuation) */}
        <DrillContextStub
          eyebrow="Activity · sector · valuation"
          title="Companies House filings, sector trend, valuation multiples for your line of business"
          preview={<BusinessActivityStub />}
          bullets={[
            'Companies House: filed accounts headlines, directors, PSCs',
            'Trading vs investment classification (matters for BPR eligibility)',
            'Sector benchmark: 12-month trend, average EV / EBITDA',
            'Director\'s loan account watch: S455 trigger window, BIK threshold',
            'Exit-route framing: trade sale, EMT, IPO — what each path implies for tax',
          ]}
          askQuestion="What does my company look like compared to others in its sector — accounts, trading position, valuation?"
        />

        <Section title="6 · Not captured yet" sub="Other business structures you could add here:">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {['Sole trader', 'Partnership', 'LLP interest', 'AIM shares', 'EOT', 'Intellectual property', 'Earn-out', 'CSOP options', 'SAYE', 'SIP free/partnership/matching/dividend shares', 'LTIPs / RSUs', 'Growth shares', 'PISCES holding'].map(t => (
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
          domain="business"
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
