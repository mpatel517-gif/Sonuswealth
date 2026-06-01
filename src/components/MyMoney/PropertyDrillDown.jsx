// ─────────────────────────────────────────────────────────────────────────────
// PropertyDrillDown — per-property panel for Domain G.
//
// ONION MODEL (founder 2026-06-01 — "peel the layers"): a category that holds
// genuinely different sub-types (a main home vs a let property, taxed nothing
// alike) must NOT dump every tax block on one screen. It peels:
//   Layer 1  — the two SUB-CATEGORY drawers (Main residence / Let property),
//              each with its own value, equity and trend line.
//   Layer 2  — tap a drawer → only THAT type's detail + tax treatment.
//   Layer 3  — tap a property → AssetDetailOverlay leaf (analysis + the
//              decision criteria at the source).
//
// Spec sources: 3-Engine-mm-asset-taxonomy-v1_0.md Domain G; 2-Product-mymoney-v2_7.md §10.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import OverlayShell from '../shared/OverlayShell.jsx'
import ExplainerChip from '../shared/Explainer.jsx'
import TaxTreatmentBlock from './TaxTreatmentBlock.jsx'
// L3-1 (2026-05-28): drill-stack pattern (see PensionDrillDown for canonical example).
import { DrillStackProvider, useDrillStackContext } from './L3/DrillStack.jsx'
import { DrillableNumber } from './L3/DrillableNumber.jsx'
import { MiniTrendLines } from './L3/MiniTrendLines.jsx'
import DrillContextStub, { PropertyMapStub } from './DrillContextStub.jsx'
import AssetDetailOverlay from './AssetDetailOverlay.jsx'
import { BRAND } from '../../config/brand.js'
// S1 selector migration (Phase 2)
import {
  netWorth,
  liabilities as liabilitiesTotal,
  ani as calcANI,
} from '../../engine/selectors/index.js'

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

// 12-month back-cast trend from a value + an annual rate. One honest line per
// sub-category (residence vs let move differently), shown on each drawer.
function groupLine(val, rate) {
  const rM = Math.pow(1 + (rate || 0.04), 1 / 12) - 1
  const out = []
  for (let i = 11; i >= 0; i--) out.push(Math.round((+val || 0) / Math.pow(1 + rM, i)))
  return out
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

// Layer-1 sub-category drawer — the peel. Tapping opens that type's detail.
function Drawer({ icon, color, label, count, equity, value, line, onOpen }) {
  return (
    <button type="button" onClick={onOpen} className="sw-press" style={{
      display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      padding: '14px 16px', borderRadius: 16, border: '1px solid var(--c-border)',
      background: 'var(--card-bg2)', cursor: 'pointer', textAlign: 'left', marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <span style={{
          width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: 'grid', placeItems: 'center',
          background: `color-mix(in srgb, ${color} 14%, var(--c-surface2))`, color, fontSize: 18,
        }}>{icon}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: 'var(--c-text)' }}>{label}</div>
          <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>
            {count} {count === 1 ? 'property' : 'properties'} · {fmt(equity)} equity
          </div>
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

export default function PropertyDrillDown(props) {
  return (
    <DrillStackProvider>
      <PropertyDrillDownInner {...props} />
    </DrillStackProvider>
  )
}

function PropertyDrillDownInner({ entity, personaId, onBack, onHome }) {
  const [selected, setSelected] = useState(null)
  const [openGroup, setOpenGroup] = useState(null)   // null | 'residence' | 'let'
  const a = entity.assets || {}
  const residence = a.residence
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

  // Concentration check — residence share of gross assets (info, not advice).
  const residenceOwned = residenceValue * (+residence?.ownershipShare || 1)
  const grossAssets = netWorth(entity) + liabilitiesTotal(entity)
  const concentrationPct = grossAssets > 0 ? (residenceOwned / grossAssets) * 100 : 0
  const concentrationFlag = concentrationPct >= 40
  const concentrationTone = concentrationPct > 60 ? 'bad' : 'warn'

  // Marginal rate drives the CGT rate in the sell modeller (residential 24% vs
  // 18%). A hand-sum of entity.income missed a director's dividends/rental and
  // wrongly read basic-rate; the engine's ANI is the canonical figure.
  const _aniHint = (() => { try { return +calcANI(entity)?.ani || 0 } catch { return 0 } })()
  const grossIncome = _aniHint || ((+entity?.income?.salary || 0) + (+entity?.income?.dividends || 0) +
                      (+entity?.income?.rental || 0) + (+entity?.income?.other || 0))
  const isHigherRate = grossIncome >= 50270

  // Sub-category groups — the onion's first peel. Each drives one drawer.
  const groups = []
  if (residenceValue > 0) groups.push({ key: 'residence', icon: '⌂', color: '#FF9F0A', label: 'Main residence', value: residenceValue, equity: residenceEquity, count: 1, rate: 0.04 })
  if (btlValue > 0) groups.push({ key: 'let', icon: '⌖', color: '#FFB347', label: btls.length > 1 ? 'Let properties' : 'Let property', value: btlValue, equity: btlEquity, count: Math.max(1, btls.length), rate: 0.045 })

  const drillStack = useDrillStackContext()
  const propertyBreakdown = [
    ...(residenceValue > 0 ? [{ label: `Main residence · ${fmt(residenceValue)} GMV`, value: fmt(residenceEquity) + ' equity' }] : []),
    ...btls.map((b, i) => ({ label: `BTL #${i + 1}${b.address ? ' · ' + b.address.slice(0, 20) : ''}`, value: fmt(+b.value || +b.value_gbp || 0) })),
  ]

  const openResidenceLeaf = () => setSelected({ ...residence, type: 'residence', use: 'main', name: residence?.address || 'Main residence', _debt: primaryMortgage, _costBasis: +residence?.purchase_price || 0, _isResidence: true, _isHigherRate: isHigherRate })

  // OverlayShell back pops a sub-category first, then closes the whole drill.
  const shellBack = openGroup ? () => setOpenGroup(null) : onBack
  const groupLabel = openGroup === 'residence' ? 'Main residence' : openGroup === 'let' ? (btls.length > 1 ? 'Let properties' : 'Let property') : null

  return (
    <OverlayShell title={groupLabel ? `Property · ${groupLabel}` : 'Property · drill-down'}
      subtitle={
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'baseline' }}>
          <DrillableNumber
            metric="Total property value"
            value={fmt(totalPropertyValue)}
            formula={`Sum of main residence (${fmt(residenceValue)}) + ${btls.length} BTL${btls.length === 1 ? '' : 's'} (${fmt(btlValue)}). Gross — not net of mortgages.`}
            source={`${propertyBreakdown.length} propert${propertyBreakdown.length === 1 ? 'y' : 'ies'} on file`}
            confidence="high"
            breakdown={propertyBreakdown}
            onDrill={drillStack.pushNumber}
          />
          <span style={{ fontSize: 13, color: 'var(--c-text3)' }}>· {fmt(totalPropertyEquity)} equity</span>
        </span>
      }
      onBack={shellBack} onHome={onHome}>
      <div style={{ padding: '16px 16px 40px' }}>

        {/* ── LAYER 1 — sub-category drawers ─────────────────────────────── */}
        {!openGroup && (
          <>
            <div className="sw-eyebrow" style={{ fontStyle: 'italic', color: 'var(--c-text3)', marginBottom: 12 }}>
              Two kinds of property, taxed nothing alike. Tap one to go deeper.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              <Tile label="Total property" value={fmt(totalPropertyValue)} tone="good" />
              <Tile label="Total equity" value={fmt(totalPropertyEquity)} sub={`After ${fmt(primaryMortgage + btlMortgagesTotal)} debt`} />
            </div>

            {groups.map(g => (
              <Drawer key={g.key} icon={g.icon} color={g.color} label={g.label} count={g.count}
                equity={g.equity} value={g.value} line={groupLine(g.value, g.rate)}
                onOpen={() => setOpenGroup(g.key)} />
            ))}

            {concentrationFlag && (
              <div style={{ marginTop: 4, marginBottom: 16, padding: '10px 12px', borderRadius: 12, border: '1px solid color-mix(in srgb, var(--c-coral,#FF6F7D) 30%, transparent)', background: 'color-mix(in srgb, var(--c-coral,#FF6F7D) 7%, transparent)' }}>
                <Chip tone={concentrationTone}>{Math.round(concentrationPct)}% of net worth · illiquid</Chip>
                <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 6, lineHeight: 1.4 }}>
                  Property is {Math.round(concentrationPct)}% of your assets. Selling takes weeks to months and carries costs (agent fees, conveyancing, possible CGT on any non-PPR portion).
                </div>
              </div>
            )}

            <Section title="Not captured yet" sub="Other property types you could add here:">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {['Second home', 'Overseas property', 'Commercial property', 'Agricultural land', 'Woodland / forestry', 'HMO', 'Shared ownership', 'REITs', 'Equity release', 'Ground rents'].map(t => (
                  <span key={t} style={{ padding: '6px 12px', borderRadius: 100, background: 'var(--c-surface2)', border: '1px dashed var(--c-border)', color: 'var(--c-text3)', fontSize: 11, fontWeight: 600 }}>+ {t}</span>
                ))}
              </div>
            </Section>
          </>
        )}

        {/* ── LAYER 2 — Main residence ───────────────────────────────────── */}
        {openGroup === 'residence' && residence && (
          <>
            <Section title="How a main home is taxed" sub={
              <>Full <Term id="MM-PPR">PPR</Term> relief if always occupied. Last 9 months always deemed occupation. <Term id="MM-RNRB">RNRB</Term> up to £175k if it passes to direct descendants.</>
            }>
              <TaxTreatmentBlock wrapper="PROPERTY" asset={{ type: 'residence', use: 'main' }} label="Tax treatment · Main residence" />
            </Section>

            <Section title="The property">
              <div style={{ background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', marginBottom: 4 }}>{residence.address || 'Primary residence'}</div>
                <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 10 }}>
                  {residence.ownership === 'sole' ? 'Sole owner' : 'Joint'} · purchased {residence.purchase_date || '—'}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  <Chip tone="good">PPR eligible</Chip>
                  <Chip tone="good">RNRB qualifying</Chip>
                  <Chip>No 60-day reporting</Chip>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
                  <Tile label="Current value" value={fmt(residenceValue)} />
                  <Tile label="Cost basis" value={fmt(+residence.purchase_price || 0)} />
                  <Tile label="Embedded gain" value={fmt(residenceValue - (+residence.purchase_price || 0))} sub="Sheltered by PPR" tone="good" />
                  <Tile label="Mortgage" value={fmt(primaryMortgage)} />
                  <Tile label="Equity" value={fmt(residenceEquity)} tone="good" />
                </div>
                <button type="button" onClick={openResidenceLeaf} className="sw-press" style={{ marginTop: 12, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--c-border)', background: 'var(--c-surface2)', color: 'var(--c-text)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  View details <span style={{ color: 'var(--c-text3)' }}>›</span>
                </button>
              </div>
            </Section>

            <DrillContextStub
              eyebrow="Location · neighbourhood"
              title="Map preview, sold-price comparables, council tax band, EPC, drive-time to schools and town centre"
              preview={<PropertyMapStub />}
              bullets={[
                'Land Registry recent comparable sales within 0.5 mile',
                'Council tax band and current annual charge',
                'EPC band, energy efficiency suggestions',
                'Drive-time and walk-time to local schools (Ofsted ratings — info, not advice)',
              ]}
              askQuestion="What's it like to live near my main home — schools, council tax, recent sold prices, downsizing options in this postcode?"
            />
          </>
        )}

        {/* ── LAYER 2 — Let property ─────────────────────────────────────── */}
        {openGroup === 'let' && (
          <>
            <Section title="How a let property is taxed" sub={
              <><Term id="MM-S24">S24</Term> restricts mortgage-interest relief to a 20% basic-rate credit (since April 2020) — a material burden for higher/additional-rate landlords. 60-day CGT reporting on disposal. Residential CGT 18% / 24%.</>
            }>
              <TaxTreatmentBlock wrapper="PROPERTY" asset={{ type: 'btl', use: 'rental' }} label="Tax treatment · Buy-to-let" />
            </Section>

            <Section title={btls.length > 1 ? 'Your let properties' : 'The property'} sub="Tap a property for its full detail and what you can do.">
              <div style={{ background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14, overflow: 'hidden' }}>
                {btls.map((p, i) => {
                  const mortgage = btlMortgages.find(m => m.secured_on === p.id)
                  const debt = +mortgage?.outstanding || +mortgage?.outstanding_balance || 0
                  const equity = (+p.value || +p.value_gbp || 0) - debt
                  const annualRent = +p.annual_rent || (+p.monthly_rent || 0) * 12
                  const gain = (+p.value || +p.value_gbp || 0) - (+p.purchase_price || 0)
                  return (
                    <div key={p.id || i} style={{ padding: '14px', borderBottom: i < btls.length - 1 ? '1px solid var(--c-sep)' : 'none' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', marginBottom: 2 }}>{p.label || p.address || 'BTL'}</div>
                      <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 8 }}>{p.use || 'buy-to-let'} · purchased {p.purchase_date || 'n/a'}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                        <Chip tone="warn">S24: {p.s24_position || 'fully-restricted'}</Chip>
                        <Chip tone="bad">No PPR</Chip>
                        <Chip tone="bad">No BPR</Chip>
                        <Chip>60-day CGT reporting</Chip>
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
                            <Tile label="S24 impact" value={fmt(credit)} tone="warn"
                              sub={isHigherRate ? `Basic-rate credit (vs ${fmt(preS24)} pre-2020 relief · ~${fmt(netCost)} extra tax)` : 'Basic-rate credit on mortgage interest'} />
                          )
                        })()}
                      </div>
                      <button type="button"
                        onClick={() => setSelected({ ...p, type: p.type || 'btl', use: p.use || 'rental', name: p.name || p.address || 'Buy-to-let property', _debt: debt, _costBasis: +p.purchase_price || 0, _isResidence: false, _isHigherRate: isHigherRate })}
                        className="sw-press"
                        style={{ marginTop: 10, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--c-border)', background: 'var(--c-surface2)', color: 'var(--c-text)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        View details <span style={{ color: 'var(--c-text3)' }}>›</span>
                      </button>
                    </div>
                  )
                })}
              </div>
            </Section>

            <Section title="CGT on a let-property disposal — current rates">
              <div style={{ background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14, padding: 14, fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.5 }}>
                CGT — 18% in the basic-rate band, 24% above. No PPR relief on a let property (unless it was once your main home — then partial). Lettings relief £40,000 cap, only where you shared occupation.
              </div>
            </Section>
          </>
        )}

        <p style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 16, lineHeight: 1.5 }}>{BRAND.disclaimer}</p>
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
