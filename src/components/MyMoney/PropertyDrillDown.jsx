// ─────────────────────────────────────────────────────────────────────────────
// PropertyDrillDown — per-property panel for Domain G.
//
// What this panel surfaces:
//   1. Residence vs BTL split + total equity (value − mortgage)
//   2. PPR status on the primary residence (always-occupied vs gap)
//   3. RNRB qualification — residence passing to direct descendants
//   4. Per-BTL S24 mortgage-interest position + 60-day reporting flag
//   5. CGT position on disposal (cost basis vs market value)
//
// Spec sources: 3-Engine-mm-asset-taxonomy-v1_0.md Domain G; 2-Product-mymoney-v2_7.md §10.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import OverlayShell from '../shared/OverlayShell.jsx'
import ExplainerChip from '../shared/Explainer.jsx'
import TaxTreatmentBlock from './TaxTreatmentBlock.jsx'
import DrillContextStub, { PropertyMapStub } from './DrillContextStub.jsx'
import AssetDetailOverlay from './AssetDetailOverlay.jsx'
import { BRAND } from '../../config/brand.js'
// S1 selector migration (Phase 2)
import {
  netWorth,
  liabilities as liabilitiesTotal,
  properties as propertyTotal,
  cash as cashTotal,
  investments as investmentsTotal,
  pensions as pensionTotal,
} from '../../engine/selectors/index.js'
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

export default function PropertyDrillDown({ entity, personaId, onBack, onHome }) {
  const [selected, setSelected] = useState(null)
  const a = entity.assets || {}
  const residence = a.residence
  // BTL portfolio — accept both the flat a.property[] schema and the
  // a.rental_portfolio.properties[] schema used by some personas.
  const btls = [
    ...(Array.isArray(a.property) ? a.property : []),
    ...(Array.isArray(a.rental_portfolio?.properties) ? a.rental_portfolio.properties : []),
  ]
  const liabilities = entity.liabilities || {}
  const primaryMortgage = liabilities.mortgage?.outstanding || 0
  const btlMortgages = (liabilities.otherLoans || [])
    .filter(l => (l.type || '').includes('buy-to-let') || (l.secured_on && btls.some(b => b.id === l.secured_on)))

  const residenceValue = +residence?.value || 0
  const residenceEquity = residenceValue - primaryMortgage
  const btlValue = btls.reduce((s, b) => s + (+b.value || +b.value_gbp || 0), 0)
  const btlMortgagesTotal = btlMortgages.reduce((s, l) => s + (+l.outstanding || +l.outstanding_balance || 0), 0)
  const btlEquity = btlValue - btlMortgagesTotal
  const totalPropertyValue = residenceValue + btlValue
  const totalPropertyEquity = residenceEquity + btlEquity

  // Concentration check — residence share of gross assets.
  // Threshold informational only (PP-9: plain English, info not advice).
  const residenceOwned = residenceValue * (+residence?.ownershipShare || 1)
  const grossAssets = netWorth(entity) + liabilitiesTotal(entity)
  const concentrationPct = grossAssets > 0 ? (residenceOwned / grossAssets) * 100 : 0
  const concentrationFlag = concentrationPct >= 40
  const concentrationTone = concentrationPct > 60 ? 'bad' : 'warn'  // urgent vs watch

  // Marginal-rate hint for S24 impact framing.
  const grossIncome = (+entity?.income?.salary || 0) + (+entity?.income?.dividends || 0) +
                      (+entity?.income?.rental || 0) + (+entity?.income?.other || 0)
  const isHigherRate = grossIncome >= 50270

  // Landlord-shape data — present on mrT-landlord persona via rental_portfolio.
  // Engine v1.0 spec §G.5 (disposed_properties), §G.7 (portfolio_summary.s24),
  // §G.3 (ppr_eligibility per property), §G.4 (ownership_split / beneficial
  // interest), §G.6 (hmo_licence_expiry). All info-only display.
  const portfolioS24 = a.rental_portfolio?.portfolio_summary?.section_24_restriction
  const disposed = a.rental_portfolio?.disposed_properties || entity.disposed_properties || []
  const primaryIndividualId = entity.primary_individual_id ||
    (Array.isArray(entity.individuals) ? entity.individuals[0]?.id : null)

  function fmtDate(d) {
    if (!d) return '—'
    const dt = new Date(d)
    if (isNaN(dt)) return String(d)
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  function daysUntil(d) {
    if (!d) return null
    const dt = new Date(d)
    if (isNaN(dt)) return null
    return Math.round((dt.getTime() - Date.now()) / 86400000)
  }

  return (
    <OverlayShell title="Property · drill-down"
      subtitle={`${fmt(totalPropertyValue)} GMV · ${fmt(totalPropertyEquity)} equity`}
      onBack={onBack} onHome={onHome}>
      <div style={{ padding: '16px 16px 40px' }}>

        <div
          className="sw-eyebrow"
          style={{ fontStyle: 'italic', color: 'var(--c-text3)', marginBottom: 10 }}
        >
          How your property is taxed, owned, and shaped
        </div>

        {/* Section 1 — composition */}
        <Section title="1 · What you own — main home vs let property"
          sub="Your main home has tax-free growth and a higher inheritance allowance. Let property has a fully taxable picture plus the post-2020 cap on mortgage interest relief.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
            <Tile label="Total property" value={fmt(totalPropertyValue)} tone="good" />
            <Tile label="Total equity" value={fmt(totalPropertyEquity)} sub={`After ${fmt(primaryMortgage + btlMortgagesTotal)} debt`} />
            <Tile label="Residence" value={fmt(residenceValue)} sub={`Equity ${fmt(residenceEquity)}`} />
            <Tile label="BTL portfolio" value={fmt(btlValue)} sub={`Equity ${fmt(btlEquity)}`} />
          </div>
        </Section>

        {/* Section 1b — Tax treatment by property type (spec §2.3) */}
        <Section title="Tax treatment by property type" sub="The three taxes that apply to each. ⓘ chips open the rule detail.">
          <div style={{ display: 'grid', gap: 10 }}>
            {residence && (
              <TaxTreatmentBlock
                wrapper="PROPERTY"
                asset={{ type: 'residence', use: 'main' }}
                label="Tax treatment · Main residence"
              />
            )}
            {btls.length > 0 && (
              <TaxTreatmentBlock
                wrapper="PROPERTY"
                asset={{ type: 'btl', use: 'rental' }}
                label="Tax treatment · Buy-to-let"
              />
            )}
          </div>
        </Section>

        {/* Section 2 — primary residence */}
        {residence && (
          <Section title="2 · Primary residence" sub={
            <>Full <Term id="MM-PPR">PPR</Term> relief if always occupied. Last 9 months always deemed occupation. <Term id="MM-RNRB">RNRB</Term> up to £175k if passes to direct descendants.</>
          }>
            <div style={{
              background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14,
              padding: 14,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', marginBottom: 4 }}>
                {residence.address || 'Primary residence'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 10 }}>
                {residence.ownership === 'sole' ? 'Sole owner' : 'Joint'} · purchased {residence.purchase_date || '—'}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                <Chip tone="good">PPR eligible</Chip>
                <Chip tone="good">RNRB qualifying</Chip>
                <Chip>No 60-day reporting</Chip>
                {concentrationFlag && (
                  <Chip tone={concentrationTone}>
                    {Math.round(concentrationPct)}% of net worth · illiquid
                  </Chip>
                )}
              </div>
              {concentrationFlag && (
                <div style={{
                  fontSize: 11, color: 'var(--c-text3)', marginBottom: 10, lineHeight: 1.4,
                }}>
                  Main home is {Math.round(concentrationPct)}% of total assets. Selling takes weeks to months and incurs costs (estate-agent fees, conveyancing, possible CGT on any non-PPR portion).
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
                <Tile label="Current value" value={fmt(residenceValue)} />
                <Tile label="Cost basis" value={fmt(+residence.purchase_price || 0)} />
                <Tile label="Embedded gain" value={fmt(residenceValue - (+residence.purchase_price || 0))} sub="Sheltered by PPR" tone="good" />
                <Tile label="Mortgage" value={fmt(primaryMortgage)} />
                <Tile label="Equity" value={fmt(residenceEquity)} tone="good" />
              </div>
            </div>
          </Section>
        )}

        {/* Section 3 — BTL portfolio */}
        {btls.length > 0 && (
          <Section title="3 · Buy-to-let portfolio" sub={
            <><Term id="MM-S24">S24</Term> mortgage interest restriction: only 20% basic-rate credit since April 2020. Material IT burden for HR/AR landlords. 60-day reporting on disposal. Residential CGT rates: 18% basic, 24% higher (since 30 Oct 2024). Non-residential property is now the same rates; carried interest is taxed differently — see Tax &amp; Estate.</>
          }>
            <div style={{ background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14, overflow: 'hidden' }}>
              {btls.map((p, i) => {
                const mortgage = btlMortgages.find(m => m.secured_on === p.id)
                const debt = +mortgage?.outstanding || +mortgage?.outstanding_balance || 0
                const equity = (+p.value || +p.value_gbp || 0) - debt
                const annualRent = +p.annual_rent || (+p.monthly_rent || 0) * 12
                const gain = (+p.value || +p.value_gbp || 0) - (+p.purchase_price || 0)
                return (
                  <div key={p.id || i} style={{
                    padding: '14px',
                    borderBottom: i < btls.length - 1 ? '1px solid var(--c-sep)' : 'none',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', marginBottom: 2 }}>
                      {p.label || p.address || 'BTL'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 8 }}>
                      {p.use || 'buy-to-let'} · purchased {p.purchase_date || 'n/a'}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                      <Chip tone="warn">S24: {p.s24_position || 'fully-restricted'}</Chip>
                      <Chip tone="bad">No PPR</Chip>
                      <Chip tone="bad">No BPR</Chip>
                      <Chip>60-day CGT reporting</Chip>
                      <Chip tone="warn">
                        SDLT — additional property surcharge +5% on each band above £40,000 since 31 Oct 2024. First-time buyers exempt up to £425,000 (zero band).
                      </Chip>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
                      <Tile label="Market value" value={fmt(p.value || p.value_gbp)} />
                      <Tile label="Cost basis" value={fmt(p.purchase_price)} />
                      <Tile label="Embedded gain" value={fmt(gain)} tone={gain > 0 ? 'warn' : 'neutral'} sub="Residential CGT 18% / 24%" />
                      <Tile label="Annual rent" value={fmt(annualRent)} sub="Gross" />
                      <Tile label="BTL mortgage" value={fmt(debt)} sub={mortgage?.rate_type || ''} />
                      <Tile label="Equity" value={fmt(equity)} tone={equity > 0 ? 'good' : 'bad'} />
                      {(+p.mortgage_interest_annual > 0 || +mortgage?.annual_interest > 0) && (() => {
                        const interest = +p.mortgage_interest_annual || +mortgage?.annual_interest || 0
                        const credit = interest * 0.20
                        const preS24 = interest * (isHigherRate ? 0.40 : 0.20)
                        const netCost = preS24 - credit
                        return (
                          <Tile
                            label="S24 impact"
                            value={fmt(credit)}
                            tone="warn"
                            sub={isHigherRate
                              ? `Basic-rate credit (vs ${fmt(preS24)} pre-2020 relief · ~${fmt(netCost)} extra tax)`
                              : 'Basic-rate credit on mortgage interest'}
                          />
                        )
                      })()}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelected(p)}
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

        {/* Section 3b — Knowledge-hall context (map + comparables + neighbourhood) */}
        <DrillContextStub
          eyebrow="Location · neighbourhood"
          title="Map preview, sold-price comparables, council tax band, EPC, drive-time to schools and town centre"
          preview={<PropertyMapStub />}
          bullets={[
            'Land Registry recent comparable sales within 0.5 mile',
            'Council tax band and current annual charge',
            'EPC band, energy efficiency suggestions',
            'Drive-time and walk-time to local schools (Ofsted ratings — info, not advice)',
            'Predicted rent at current market for the postcode',
          ]}
          askQuestion="What's it like to live near my property — schools, council tax, recent sold prices, downsizing options in this postcode?"
        />

        {/* Section 4 — taxonomy gaps */}
        <Section title="4 · Not captured yet" sub="Other property types you could add here:">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {['Second home', 'Overseas property', 'Commercial property', 'Agricultural land', 'Woodland / forestry', 'HMO', 'Shared ownership', 'REITs', 'Equity release', 'Ground rents'].map(t => (
              <span key={t} style={{
                padding: '6px 12px', borderRadius: 100,
                background: 'var(--c-surface2)', border: '1px dashed var(--c-border)',
                color: 'var(--c-text3)', fontSize: 11, fontWeight: 600,
              }}>+ {t}</span>
            ))}
          </div>
        </Section>

        {/* CGT current rates cite (v0.3 spec delta) */}
        <Section title="CGT on property disposal — current rates">
          <div style={{
            background: 'var(--card-bg2)', border: '1px solid var(--c-border)',
            borderRadius: 14, padding: 14, fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.5,
          }}>
            CGT — 18% in basic-rate band, 24% above. PPR relief (Section 222) full relief for main residence + final 9 months. Lettings relief £40,000 cap, only if shared occupation.
          </div>
        </Section>

        {/* Liquidity ladder (v0.3 spec delta) — Property = months tier (slowest) */}
        <Section title="Liquidity ladder">
          {(() => {
            const cashV = cashTotal(entity)
            const invV = investmentsTotal(entity)
            const penV = pensionTotal(entity)
            const propV = propertyTotal(entity)
            return (
              <LiquidityLadder
                ariaLabel="Liquidity ladder · Property is the slowest tier"
                tiers={[
                  { label: 'Hours', items: cashV > 0 ? [{ name: 'Cash', value: cashV }] : [] },
                  { label: 'Days',  items: [] },
                  { label: 'Weeks', items: invV > 0
                    ? [
                        { name: 'ISA', value: invV * 0.5 },
                        { name: 'GIA', value: invV * 0.5 },
                      ]
                    : [] },
                  { label: 'Months', items: [
                      ...(penV > 0 ? [{ name: 'Pension', value: penV }] : []),
                      ...(propV > 0 ? [{ name: 'Property (this tier · slowest)', value: propV }] : []),
                    ] },
                  { label: 'Years', items: [] },
                ]}
              />
            )
          })()}
        </Section>

        <p style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 16, lineHeight: 1.5 }}>
          {BRAND.disclaimer}
        </p>
      </div>
      {selected && (
        <AssetDetailOverlay
          asset={selected}
          domain="property"
          category="property"
          itemType={selected.use || selected.type || 'property'}
          personaId={personaId}
          onBack={() => setSelected(null)}
          onHome={onHome}
        />
      )}
    </OverlayShell>
  )
}
