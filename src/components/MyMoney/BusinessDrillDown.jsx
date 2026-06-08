// ─────────────────────────────────────────────────────────────────────────────
// BusinessDrillDown — per-business panel for Domain H + Domain I.
//
// ONION MODEL (founder 2026-06-01): a company stake, work share-schemes and a
// director's loan are different things, taxed differently. Layer 1 = a drawer
// each (Company equity · Share schemes · Director's loan). Layer 2 = tap a
// drawer → only that strand's detail (BPR/BADR + companies · scheme tax · DLA /
// S455). Layer 3 = tap a holding → AssetDetailOverlay with the researched
// BusinessDecisions modeller (extract · sell · gift · pass on · DLA repay).
//
// Spec sources: 3-Engine-mm-asset-taxonomy-v1_0.md Domain H/I; MyMoney v2.7 §11–§13.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import OverlayShell from '../shared/OverlayShell.jsx'
import { DrillStackProvider, useDrillStackContext } from './L3/DrillStack.jsx'
import { DrillableNumber } from './L3/DrillableNumber.jsx'
import { MiniTrendLines } from './L3/MiniTrendLines.jsx'
import ExplainerChip from '../shared/Explainer.jsx'
import TaxTreatmentBlock from './TaxTreatmentBlock.jsx'
import DrillContextStub, { BusinessActivityStub } from './DrillContextStub.jsx'
import AssetDetailOverlay from './AssetDetailOverlay.jsx'
import { BRAND } from '../../config/brand.js'
import { TAX } from '../../engine/fq-calculator.js'

function Term({ children, id }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
      {children}<ExplainerChip id={id} size={13} />
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

function groupLine(val, rate = 0.07) {
  const rM = Math.pow(1 + rate, 1 / 12) - 1
  const out = []
  for (let i = 11; i >= 0; i--) out.push(Math.round((+val || 0) / Math.pow(1 + rM, i)))
  return out
}

function Tile({ label, value, sub, tone = 'neutral' }) {
  const fg = tone === 'good' ? 'var(--c-acc)' : tone === 'warn' ? '#FF9500' : tone === 'bad' ? 'var(--c-coral, #FF6F7D)' : 'var(--c-text)'
  return (
    <div className="sw-card" style={{ padding: 12, background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-text3)', letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: fg, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--c-text3)' }}>{sub}</div>}
    </div>
  )
}

function Chip({ children, tone = 'neutral' }) {
  const fg = tone === 'good' ? 'var(--c-acc)' : tone === 'warn' ? '#FF9500' : tone === 'bad' ? 'var(--c-coral, #FF6F7D)' : 'var(--c-text2)'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 100, background: `color-mix(in srgb, ${fg} 14%, transparent)`, color: fg, fontSize: 9, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', border: `1px solid color-mix(in srgb, ${fg} 30%, transparent)` }}>{children}</span>
  )
}

function Section({ title, sub, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--c-text3)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 10, lineHeight: 1.4 }}>{sub}</div>}
      {children}
    </div>
  )
}

function Drawer({ icon, color, label, count, sub, value, line, onOpen }) {
  return (
    <button type="button" onClick={onOpen} className="sw-press" style={{
      display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      padding: '14px 16px', borderRadius: 16, border: '1px solid var(--c-border)', background: 'var(--card-bg2)', cursor: 'pointer', textAlign: 'left', marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <span style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: 'grid', placeItems: 'center', background: `color-mix(in srgb, ${color} 14%, var(--c-surface2))`, color, fontSize: 18 }}>{icon}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: 'var(--c-text)' }}>{label}</div>
          <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>{sub}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <MiniTrendLines series={[line]} colors={[color]} width={56} height={22} />
        <div style={{ fontWeight: 800, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>{fmt(value)}</div>
        <span style={{ color: 'var(--c-text3)', fontSize: 18 }} aria-hidden>›</span>
      </div>
    </button>
  )
}

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
  const [openGroup, setOpenGroup] = useState(null)   // null | company | schemes | dla
  const a = entity.assets || {}
  const companies = entity.companies || []
  const businessAssets = entity.business_assets || a.business_assets || []
  const shareSchemes = entity.share_schemes || a.share_schemes || []
  const dla = entity.directors_loan || a.directors_loan

  const companiesValue = companies.reduce((s, c) => s + (+c.share_value_gbp || +c.value || 0), 0)
  const businessAssetsValue = businessAssets.reduce((s, b) => s + (+b.value || +b.value_gbp || 0), 0)
  // companies[] and business_assets[] often represent the SAME equity stake in
  // two shapes (Mr T: Synthetic Tech in both). companies[] is canonical — only
  // fall back to business_assets when there are no companies, so the £145k stake
  // isn't double-counted into £290k. (Founder 2026-06-01.)
  const companyEquity = companiesValue > 0 ? companiesValue : businessAssetsValue
  const companyCount = companies.length || businessAssets.length
  const shareSchemesValue = shareSchemes.reduce((s, sc) => s + (+sc.estimated_value || +sc.value_gbp || 0), 0)
  const dlaValue = dla?.in_credit ? (+dla.balance || 0) : 0
  const total = companyEquity + shareSchemesValue + dlaValue

  const bprQualifying = [
    ...companies.filter(c => c.trading_status === 'trading').map(c => +c.share_value_gbp || +c.value || 0),
    ...businessAssets.filter(b => b.qualifies_for_bpr).map(b => +b.value || +b.value_gbp || 0),
  ].reduce((s, v) => s + v, 0)
  const bprCap = TAX?.bprCombinedCap ?? 2_500_000
  const bprAboveCap = Math.max(bprQualifying - bprCap, 0)

  // ── Groups (the peel) ─────────────────────────────────────────────────────
  const groups = []
  if (companyEquity > 0) groups.push({ key: 'company', icon: '⚇', color: '#7AA7FF', label: 'Company equity', value: companyEquity, sub: `${companyCount} compan${companyCount === 1 ? 'y' : 'ies'}` })
  if (shareSchemesValue > 0) groups.push({ key: 'schemes', icon: '◷', color: '#BA8CFF', label: 'Share schemes', value: shareSchemesValue, sub: `${shareSchemes.length} scheme${shareSchemes.length === 1 ? '' : 's'} · EMI / RSU / SIP` })
  if (dla) groups.push({ key: 'dla', icon: '⇄', color: dla.in_credit ? '#34C759' : '#FF9500', label: "Director's loan", value: Math.abs(+dla.balance || 0), sub: dla.in_credit ? 'In credit — the company owes you' : 'Overdrawn — you owe the company' })

  const G = groups.find(g => g.key === openGroup)
  const shellBack = openGroup ? () => setOpenGroup(null) : onBack
  const openCompanyLeaf = (c) => setSelected({ asset: { ...c, value: +c.share_value_gbp || +c.value || 0, type: 'company' }, category: 'business', itemType: 'company' })
  const openSchemeLeaf = (s) => setSelected({ asset: { ...s, value: +s.estimated_value || +s.value_gbp || 0, name: s.employer ? `${s.employer} · ${s.scheme_type}` : s.scheme_type, type: s.scheme_type }, category: 'business', itemType: 'share-scheme' })
  const openDlaLeaf = () => setSelected({ asset: { ...dla, value: Math.abs(+dla.balance || 0), name: "Director's loan account", type: 'director-loan' }, category: 'business', itemType: 'dla' })

  return (
    <OverlayShell title={G ? `Business · ${G.label}` : 'Business assets · drill-down'}
      subtitle={
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'baseline' }}>
          <DrillableNumber
            metric="Total business value" value={fmt(total)}
            formula={`Sum of every private-company holding + share-scheme position. ${companies.length} compan${companies.length === 1 ? 'y' : 'ies'} + ${shareSchemes.length} share scheme${shareSchemes.length === 1 ? '' : 's'}.`}
            source={`${companies.length + shareSchemes.length} holding${companies.length + shareSchemes.length === 1 ? '' : 's'} on file`}
            confidence="high"
            breakdown={[
              ...companies.map((c, i) => ({ label: c.name || `Company #${i + 1}`, value: fmt(+(c.share_value_gbp ?? c.value ?? 0)) })),
              ...shareSchemes.map((s, i) => ({ label: s.name || s.scheme_type || `Share scheme #${i + 1}`, value: fmt(+(s.estimated_value ?? s.value_gbp ?? 0)) })),
            ]}
            onDrill={drillStack.pushNumber}
          />
          <span style={{ fontSize: 13, color: 'var(--c-text3)' }}>· {companies.length} compan{companies.length === 1 ? 'y' : 'ies'} · {shareSchemes.length} scheme{shareSchemes.length === 1 ? '' : 's'}</span>
        </span>
      }
      onBack={shellBack} onHome={onHome}>
      <div style={{ padding: '16px 16px 40px' }}>

        {/* ── LAYER 1 — drawers ──────────────────────────────────────────── */}
        {!openGroup && (
          <>
            <div className="sw-eyebrow" style={{ fontStyle: 'italic', color: 'var(--c-text3)', marginBottom: 12 }}>
              How your business pays you, and what you keep. Tap a strand to go deeper.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              <Tile label="Total business" value={fmt(total)} tone="good" />
              <Tile label="BPR-qualifying" value={fmt(bprQualifying)} tone={bprQualifying > 0 ? 'good' : 'neutral'} sub="100% IHT relief to £2.5m" />
            </div>
            {groups.map(g => (
              <Drawer key={g.key} icon={g.icon} color={g.color} label={g.label} sub={g.sub} value={g.value} line={groupLine(g.value)} onOpen={() => setOpenGroup(g.key)} />
            ))}
            <Section title="Not captured yet" sub="Other business structures you could add here:">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {['Sole trader', 'Partnership', 'LLP interest', 'AIM shares', 'EOT', 'Intellectual property', 'Earn-out', 'LTIPs / RSUs', 'Growth shares'].map(t => (
                  <span key={t} style={{ padding: '6px 12px', borderRadius: 100, background: 'var(--c-surface2)', border: '1px dashed var(--c-border)', color: 'var(--c-text3)', fontSize: 11, fontWeight: 600 }}>+ {t}</span>
                ))}
              </div>
            </Section>
          </>
        )}

        {/* ── LAYER 2 — Company equity ───────────────────────────────────── */}
        {openGroup === 'company' && (
          <>
            <Section title="How company shares are taxed" sub="Trading-company shares: CGT on sale (BADR if 5%+/2yr), 100% Business Relief on death to the £2.5m cap.">
              <TaxTreatmentBlock wrapper="GIA" asset={{ type: 'gia', qualifies_for_bpr: bprQualifying > 0 }} label="Tax treatment · Business assets" />
            </Section>
            <Section title={<><Term id="MM-BPR">BPR</Term><span> position (April 2026)</span></>} sub="100% relief on the first £2.5m of combined business/agricultural property; 50% above. Investment companies don't qualify.">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 8 }}>
                <Tile label="BPR-qualifying" value={fmt(bprQualifying)} tone={bprQualifying > 0 ? 'good' : 'neutral'} />
                <Tile label="£2.5m combined cap" value={fmt(bprCap)} sub="From April 2026" />
                <Tile label="Above cap (50% relief)" value={fmt(bprAboveCap)} tone={bprAboveCap > 0 ? 'warn' : 'good'} sub={bprAboveCap > 0 ? 'Effective IHT 20%' : 'Within cap'} />
              </div>
            </Section>
            <Section title="Your companies" sub="Tap a company for its full detail and what you can do.">
              <div style={{ background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14, overflow: 'hidden' }}>
                {companies.map((c, i) => {
                  const trading = c.trading_status === 'trading'
                  const sharePct = (+c.shareholding_pct || 0) * 100
                  const fivePct = sharePct >= 5
                  return (
                    <div key={c.id || i} style={{ padding: '14px', borderBottom: i < companies.length - 1 ? '1px solid var(--c-sep)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>{c.name}</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>{fmt(c.share_value_gbp || c.value)}</div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 8 }}>{c.role || 'Shareholder'} · {sharePct.toFixed(0)}% · turnover {fmt(c.annual_turnover)}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {trading ? <Chip tone="good">Trading</Chip> : <Chip tone="bad">Investment co — no BPR</Chip>}
                        {trading && <Chip tone="good">BPR eligible</Chip>}
                        {trading && fivePct && <Chip tone="good">BADR · 5%+ qualifying</Chip>}
                        {trading && !fivePct && <Chip tone="warn">BADR · &lt;5% holding</Chip>}
                        <Chip>Corp tax 19% to £50k · 25% over £250k</Chip>
                      </div>
                      <button type="button" onClick={() => openCompanyLeaf(c)} className="sw-press" style={{ marginTop: 10, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--c-border)', background: 'var(--c-surface2)', color: 'var(--c-text)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        Dig in <span style={{ color: 'var(--c-text3)' }}>›</span>
                      </button>
                    </div>
                  )
                })}
              </div>
            </Section>
            <Section title="Taking profit out — the mechanics">
              <div style={{ background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14, padding: 14, fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.5 }}>
                Employer NIC is {((TAX.employerNICRate ?? 0.15) * 100).toFixed(0)}% on salary above £{(TAX.employerNICThreshold ?? 5000).toLocaleString()} (employment allowance £{(TAX.employmentAllowance ?? 10500).toLocaleString()}/yr). Salary sacrifice into a pension saves employee NIC 8% + employer NIC 15% on the sacrificed amount and is Corporation-Tax deductible — the “Extract profit” modeller on a company leaf models dividend vs pension.
              </div>
            </Section>
            <DrillContextStub
              eyebrow="Activity · sector · valuation"
              title="Companies House filings, sector trend, valuation multiples"
              preview={<BusinessActivityStub />}
              bullets={['Filed accounts headlines, directors, PSCs', 'Trading vs investment (BPR gateway)', 'Sector benchmark: EV / EBITDA', 'Exit routes: trade sale, EMT, IPO']}
              askQuestion="What does my company look like compared to others in its sector?"
            />
          </>
        )}

        {/* ── LAYER 2 — Share schemes ────────────────────────────────────── */}
        {openGroup === 'schemes' && (
          <Section title="Shares you got through work" sub="Tax-advantaged schemes (EMI, CSOP, SAYE, SIP) skip income tax and NI at exercise; unapproved options get both. Watch concentration in one employer.">
            <div style={{ background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14, overflow: 'hidden' }}>
              {shareSchemes.map((s, i) => {
                const t = s.scheme_type
                const tax = t === 'EMI' ? 'EMI — no IT at grant; BADR from grant date'
                  : t === 'CSOP' ? 'CSOP — no IT if 3yr hold'
                  : t === 'SAYE' ? 'SAYE — no IT at exercise; ISA/pension transfer in 90 days'
                  : t === 'SIP' ? 'SIP — no IT if 5yr hold'
                  : 'Unapproved — IT + NIC on exercise gain'
                return (
                  <div key={s.id || i} style={{ padding: '14px', borderBottom: i < shareSchemes.length - 1 ? '1px solid var(--c-sep)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>{s.employer || s.scheme_type}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>{fmt(s.estimated_value || s.value_gbp)}</div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 8 }}>{tax}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Chip tone="good">{t}</Chip>
                      {s.vesting_status && <Chip>{s.vesting_status}</Chip>}
                      {s.vested_count != null && <Chip>{s.vested_count.toLocaleString()} vested</Chip>}
                      {s.unvested_count > 0 && <Chip tone="warn">{s.unvested_count.toLocaleString()} unvested</Chip>}
                    </div>
                    <button type="button" onClick={() => openSchemeLeaf(s)} className="sw-press" style={{ marginTop: 10, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--c-border)', background: 'var(--c-surface2)', color: 'var(--c-text)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      Dig in <span style={{ color: 'var(--c-text3)' }}>›</span>
                    </button>
                  </div>
                )
              })}
            </div>
          </Section>
        )}

        {/* ── LAYER 2 — Director's loan ──────────────────────────────────── */}
        {openGroup === 'dla' && dla && (
          <Section title="Money owed between you and your company" sub={dla.in_credit
              ? 'Credit balance — the company owes you. A personal asset, in your estate for IHT, repayable to you tax-free.'
              : "Debit balance — you owe the company. Unpaid 9 months + 1 day after year-end → 33.75% S455 charge (refunded on repayment); over £10k below the official rate is a benefit-in-kind."}>
            <div style={{ background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>{dla.in_credit ? 'In credit' : 'Outstanding loan to director'}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: dla.in_credit ? 'var(--c-acc)' : 'var(--c-coral, #FF6F7D)', fontVariantNumeric: 'tabular-nums' }}>{fmt(dla.balance)}</div>
              </div>
              {dla.note && <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>{dla.note}</div>}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                {dla.in_credit ? (<><Chip tone="good">Personal asset</Chip><Chip>In estate</Chip><Chip tone="good">Repayable tax-free</Chip></>)
                  : (<><Chip tone="bad">S455 exposure</Chip><Chip tone="warn">{((TAX.s455Rate ?? 0.3375) * 100).toFixed(2)}% over £10k</Chip></>)}
              </div>
              <button type="button" onClick={openDlaLeaf} className="sw-press" style={{ marginTop: 12, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--c-border)', background: 'var(--c-surface2)', color: 'var(--c-text)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Dig in <span style={{ color: 'var(--c-text3)' }}>›</span>
              </button>
            </div>
          </Section>
        )}

        <p style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 16, lineHeight: 1.5 }}>{BRAND.disclaimer}</p>
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
