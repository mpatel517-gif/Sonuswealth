// ─────────────────────────────────────────────────────────────────────────────
// InvestmentsDrillDown — wrapper-by-wrapper view of Domain C/D/E/F.
//
// Domains in scope (3-Engine-mm-asset-taxonomy-v1_0.md):
//   · C — ISA wrappers (Cash ISA · S&S ISA · IFISA · LISA · JISA)
//   · D — GIA & unwrapped (equities · funds · ETFs · gilts · bonds)
//   · E — EIS / SEIS / VCT (tax-efficient schemes with relief schedule)
//   · F — Investment bonds (onshore · offshore · with-profits · endowment)
//
// What this panel surfaces:
//   1. Total invested + breakdown by wrapper tier
//   2. ISA allowance utilisation (£20k cap; £12k cash sub-limit)
//   3. Embedded CGT exposure in GIA (cost basis vs market value)
//   4. EIS/SEIS/VCT clawback tracker (3yr / 5yr minimum hold)
//   5. Investment-bond 5% cumulative withdrawal allowance used
//   6. Per-item list with wrapper chip + tax-treatment chips
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import OverlayShell from '../shared/OverlayShell.jsx'
import TaxTreatmentBlock from './TaxTreatmentBlock.jsx'
import DrillContextStub, { SectorMixStub } from './DrillContextStub.jsx'
import AssetDetailOverlay from './AssetDetailOverlay.jsx'
// S1 selector migration (Phase 2)
import {
  getWrapper as canonicalWrapper,
  cash as cashTotal,
  investments as investmentsTotal,
  pensions as pensionTotal,
  properties as propertyTotal,
} from '../../engine/selectors/index.js'
import { holdingClock } from '../../engine/persona-helpers.js'
import { BRAND } from '../../config/brand.js'
import { TAX } from '../../engine/fq-calculator.js'
import { LiquidityLadder } from '../charts/index.js'

// Fold legacy slot shapes (a.isa, a.portfolio) into the canonical items[] array
// so per-item iterators render Bruce-shape personas alongside Mr T-shape ones.
// Returns a single unified list. Items added from legacy slots carry _legacy: true
// so the UI can surface a "cost basis not captured" chip.
function foldLegacyInvestments(entity) {
  const a = entity?.assets || {}
  const out = []
  if (Array.isArray(a.investments)) out.push(...a.investments)
  if (a.isa && (a.isa.value || a.isa.total) &&
      !out.some(i => (i.id === 'legacy-isa') || (canonicalWrapper(i) === 'ISA' && i._legacy))) {
    out.push({
      id: 'legacy-isa',
      name: 'Stocks & Shares ISA (consolidated)',
      type: 'stocks-and-shares-ISA',
      value: +(a.isa.value || a.isa.total || 0),
      balance: +(a.isa.value || a.isa.total || 0),
      provider: a.isa.provider || 'Provider not captured',
      wrapper: 'ISA',
      _legacy: true,
    })
  }
  if (a.portfolio && (a.portfolio.value || a.portfolio.total) &&
      !out.some(i => (i.id === 'legacy-portfolio') || (canonicalWrapper(i) === 'GIA' && i._legacy))) {
    out.push({
      id: 'legacy-portfolio',
      name: 'General Investment Account (consolidated)',
      type: 'gia-portfolio',
      value: +(a.portfolio.value || a.portfolio.total || 0),
      balance: +(a.portfolio.value || a.portfolio.total || 0),
      provider: a.portfolio.provider || 'Provider not captured',
      wrapper: 'GIA',
      _legacy: true,
    })
  }
  return out
}

// Classify items as "alternatives" so per-wrapper totals exclude them and a
// dedicated tile + per-item view shows what's actually there. Mr T-shape:
// type === 'crypto' / 'private-equity' / 'wine' / 'gold' / 'art'. Persona may
// also tag items with wrapper === 'ALT'.
const ALT_TYPES = new Set(['crypto', 'private-equity', 'wine', 'gold', 'art', 'collectible'])
function isAlternative(item) {
  if (!item) return false
  if (String(item.wrapper || '').toUpperCase() === 'ALT') return true
  return ALT_TYPES.has(String(item.type || '').toLowerCase())
}

function fmt(v) {
  const n = Math.round(+v || 0)
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${n < 0 ? '−' : ''}£${(abs / 1_000_000).toFixed(2)}m`
  if (abs >= 1_000)     return `${n < 0 ? '−' : ''}£${(abs / 1_000).toFixed(0)}k`
  return `${n < 0 ? '−' : ''}£${abs.toLocaleString()}`
}

const WRAPPER_TONE = {
  ISA:      '#5DDBC2',
  GIA:      '#BA8CFF',
  EIS:      '#FF598C',
  SEIS:     '#FF6B6B',
  VCT:      '#E77BFF',
  BOND_ON:  '#FFB347',
  BOND_OFF: '#FF9500',
  OTHER:    '#657286',
}

function inferWrapper(item) {
  // Use the canonical engine resolver (spec §2.1 D-WRAPPER-FIRST-1). UNKNOWN
  // is preserved as-is so the parent can surface the "needs wrapper" hint.
  const w = canonicalWrapper(item)
  return w === 'UNKNOWN' ? 'OTHER' : w
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

function Disclosure({ title, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{
      marginTop: 10, background: 'var(--card-bg2)',
      border: '1px solid var(--c-border)', borderRadius: 14, overflow: 'hidden',
    }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', textAlign: 'left', padding: '10px 14px',
          background: 'transparent', border: 'none', color: 'var(--c-text)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          fontSize: 12, fontWeight: 700,
        }}>
        <span>{title}</span>
        <span style={{ fontSize: 14, color: 'var(--c-text3)' }}>{open ? '–' : '+'}</span>
      </button>
      {open && (
        <div style={{
          padding: '0 14px 12px', fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.5,
        }}>
          {children}
        </div>
      )}
    </div>
  )
}

function Chip({ children, tone = 'neutral' }) {
  const bg = tone === 'good' ? 'color-mix(in srgb, var(--c-acc) 14%, transparent)'
    : tone === 'warn' ? 'color-mix(in srgb, #FF9500 14%, transparent)'
    : tone === 'bad' ? 'color-mix(in srgb, var(--c-coral, #FF6F7D) 14%, transparent)'
    : 'var(--c-surface2)'
  const fg = tone === 'good' ? 'var(--c-acc)' : tone === 'warn' ? '#FF9500' : tone === 'bad' ? 'var(--c-coral, #FF6F7D)' : 'var(--c-text2)'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 100, background: bg, color: fg,
      fontSize: 9, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
      border: `1px solid color-mix(in srgb, ${fg} 30%, transparent)`,
    }}>{children}</span>
  )
}

export default function InvestmentsDrillDown({ entity, personaId, onBack, onHome }) {
  const [selected, setSelected] = useState(null)
  const a = entity.assets || {}
  // CRIT-3 fix: fold legacy a.isa / a.portfolio slots into items[] so iterators
  // render for Bruce-shape personas, not just Mr T-shape personas with items[].
  const items = foldLegacyInvestments(entity)

  // Split alternatives off so the wrapper grouping below is meaningful — wine,
  // crypto, PE are NOT wrapper-tagged on disk and would otherwise lump into
  // OTHER, distorting both Section 1 tiles and Section 1b Tax-treatment block.
  const wrapperItems = items.filter(i => !isAlternative(i))
  const altItems = items.filter(isAlternative)

  // Subtotals by wrapper tier (alternatives excluded). The legacy slots are
  // already folded into items, so no need for the previous a.isa / a.portfolio
  // patch-up at the bottom of this block.
  const byWrapper = wrapperItems.reduce((acc, it) => {
    const w = inferWrapper(it)
    acc[w] = (acc[w] || 0) + (+(it.balance_gbp ?? it.balance ?? it.value ?? 0))
    return acc
  }, {})
  const altTotal = altItems.reduce((s, i) => s + (+(i.balance_gbp ?? i.balance ?? i.value ?? 0)), 0)
  // Section-1 hero total includes alternatives so it matches the L1 tile, but
  // per-wrapper totals below remain alternatives-free for tax-treatment clarity.
  const total = Object.values(byWrapper).reduce((s, v) => s + v, 0) + altTotal

  // ISA allowance tracker (current tax-year). Legacy ISA slot has no
  // per-tax-year contribution field — we can only report current balance, not
  // this-year usage. Surface that limitation as a chip below.
  const isaContribCurrent = wrapperItems
    .filter(i => inferWrapper(i) === 'ISA')
    .reduce((s, i) => s + (+i.contribution_current_tax_year || 0), 0)
  const isaAllowance = 20000
  const isaRemain = Math.max(isaAllowance - isaContribCurrent, 0)
  const isaTotalBalance = byWrapper.ISA || 0
  const isaContribUnknown = isaTotalBalance > 0 && isaContribCurrent === 0

  // CGT exposure on GIA. Split GIA items into those with cost basis on file
  // (Mr T crypto, etc.) and those without (Bruce legacy portfolio) — the latter
  // cannot contribute to embedded-gain so we surface a "cost basis missing"
  // amber chip rather than silently reporting £0.
  const giaItems = wrapperItems.filter(i => inferWrapper(i) === 'GIA')
  const giaWithCostBase = giaItems.filter(i => i.cost_base != null || i.embedded_gain != null)
  const giaWithoutCostBase = giaItems.filter(i => !(i.cost_base != null || i.embedded_gain != null))
  const giaEmbeddedGain = giaWithCostBase.reduce((s, i) => {
    if (i.cost_base != null) return s + ((+i.value || +i.balance || 0) - (+i.cost_base || 0))
    if (i.embedded_gain != null) return s + (+i.embedded_gain || 0)
    return s
  }, 0)
  // CGT annual exempt amount — sourced from active rules bundle (TAX.cgaAllowance)
  // so it tracks Budget changes rather than drifting from a hard-coded literal.
  const cgtAnnualExempt = TAX.cgaAllowance ?? 3000
  const cgtTaxable = Math.max(giaEmbeddedGain - cgtAnnualExempt, 0)

  // EIS / SEIS / VCT clawback tracker
  const reliefSchemes = wrapperItems.filter(i => ['EIS', 'SEIS', 'VCT'].includes(inferWrapper(i)))

  // Bond 5% allowance
  const bondItems = wrapperItems.filter(i => ['BOND_ON', 'BOND_OFF'].includes(inferWrapper(i)))

  // Holding count — folded list is already complete (includes legacy slots).
  const holdingCount = items.length

  return (
    <OverlayShell title="Savings & investments · drill-down"
      subtitle={`${fmt(total)} · ${holdingCount} holding${holdingCount === 1 ? '' : 's'}`}
      onBack={onBack} onHome={onHome}>
      <div style={{ padding: '16px 16px 40px' }}>

        {/* v0.3 — distinctive subtitle */}
        <div className="sw-eyebrow" style={{
          fontStyle: 'italic', marginBottom: 14, color: 'var(--c-text3)', letterSpacing: 0.6,
        }}>
          How your investments are taxed and held
        </div>

        {/* Section 1 — wrapper composition. Alternatives broken out as their
            own tile so the wrapper-tax-treatment block below stays meaningful. */}
        <Section title="1 · Where your investments sit by tax wrapper" sub="ISAs and pensions are first-line tax shelters. A general investment account (GIA) is fully chargeable. EIS / SEIS schemes get income-tax relief plus inheritance relief. Bonds run on a different tax regime entirely. Alternatives (crypto, wine, art, private equity) have their own rules — see the dedicated drill.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
            <Tile label="Total invested" value={fmt(total)} tone="good" />
            <Tile label="ISA value" value={fmt(byWrapper.ISA || 0)} sub="Tax-free wrapper" />
            <Tile label="GIA value" value={fmt(byWrapper.GIA || 0)} sub="Chargeable" />
            <Tile label="EIS/SEIS/VCT" value={fmt((byWrapper.EIS || 0) + (byWrapper.SEIS || 0) + (byWrapper.VCT || 0))} sub="IT relief schemes" />
            <Tile label="Bonds" value={fmt((byWrapper.BOND_ON || 0) + (byWrapper.BOND_OFF || 0))} sub="Chargeable event regime" />
            {altTotal > 0 && (
              <Tile label="Alternatives" value={fmt(altTotal)} sub={`${altItems.length} item${altItems.length === 1 ? '' : 's'} · separate drill`} />
            )}
          </div>
        </Section>

        {/* Section 1b — Tax treatment per wrapper (spec §2.3) */}
        {Object.keys(byWrapper).filter(w => w !== 'OTHER' && byWrapper[w] > 0).length > 0 && (
          <Section title="Tax treatment by wrapper" sub="The three taxes that apply to each wrapper, in plain English. ⓘ chips open the rule detail.">
            <div style={{ display: 'grid', gap: 10 }}>
              {Object.entries(byWrapper)
                .filter(([w, v]) => w !== 'OTHER' && v > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([w]) => (
                  <TaxTreatmentBlock key={w} wrapper={w} />
                ))}
            </div>
          </Section>
        )}

        {/* Section 2 — ISA allowance + accumulated balance */}
        <Section title="2 · This year's ISA room" sub={`£${isaAllowance.toLocaleString()} per person per tax year. Up to £12,000 of that can sit in cash if you're under 65.`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 8 }}>
            <Tile label="Current ISA balance" value={fmt(isaTotalBalance)} sub="Accumulated across all years" />
            <Tile label="Used this year" value={fmt(isaContribCurrent)} sub={`of ${fmt(isaAllowance)}`} />
            <Tile label="Room remaining" value={fmt(isaRemain)} tone={isaRemain > 0 ? 'good' : 'neutral'} sub="Bed-and-ISA candidate" />
          </div>
          {isaContribUnknown && (
            <div style={{ marginBottom: 8 }}>
              <Chip tone="warn">Contribution history not captured · this-year usage shown as nil</Chip>
            </div>
          )}
          <div style={{
            height: 8, borderRadius: 100, background: 'var(--c-surface2)', overflow: 'hidden',
          }}>
            <div style={{
              width: `${Math.min(100, (isaContribCurrent / isaAllowance) * 100)}%`,
              height: '100%', background: 'var(--c-acc)',
              boxShadow: '0 0 8px var(--c-acc)',
            }} />
          </div>
        </Section>

        {/* Section 3 — CGT exposure */}
        {giaItems.length > 0 && (
          <Section title="3 · Capital gains tax you'd pay if you sold today" sub={`First £${cgtAnnualExempt.toLocaleString()} of gain is tax-free per year. Above that, gains are taxed at 18% (basic rate) or 24% (higher / additional rate).`}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
              <Tile label="Embedded gain" value={fmt(giaEmbeddedGain)} tone={giaEmbeddedGain > cgtAnnualExempt ? 'warn' : 'neutral'} />
              <Tile label="Annual exempt" value={fmt(cgtAnnualExempt)} sub="Tax-free disposal" />
              <Tile label="Taxable on full sale" value={fmt(cgtTaxable)} tone={cgtTaxable > 0 ? 'warn' : 'good'} sub="At marginal CGT rate" />
            </div>
            {giaWithoutCostBase.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <Chip tone="warn">Cost basis missing for {giaWithoutCostBase.length} holding{giaWithoutCostBase.length === 1 ? '' : 's'} · CGT estimate excludes them</Chip>
              </div>
            )}
            {/* IFA HIGH-15 — share-pooling / 30-day matching rule */}
            <Disclosure title="Share-pooling — how UK CGT matches disposals">
              When you dispose of shares of the same class, HMRC matches the disposal to acquisitions in this order: (1) same-day, (2) within the next 30 days (the "bed-and-breakfast" rule), (3) the s104 share pool — an averaged pool of all earlier holdings. The matching order affects which acquisition cost is used to compute the gain, especially relevant when you sell and re-buy a similar asset soon after.
            </Disclosure>
          </Section>
        )}

        {/* Section 4 — EIS/SEIS/VCT clawback */}
        {reliefSchemes.length > 0 && (
          <Section title="4 · Higher-risk schemes with tax relief (EIS · SEIS · VCT)" sub="Income tax back on the way in: 30% for EIS, 50% for SEIS, 30% for VCT (subscriptions up to £200,000/yr). Sell too early and the relief is clawed back — three years for EIS/SEIS, five for VCT.">
            {/* IFA HIGH-14 — holding-period clocks per scheme */}
            <div style={{
              marginBottom: 10, padding: '10px 12px',
              background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14,
            }}>
              <div style={{
                fontSize: 10, fontWeight: 800, color: 'var(--c-text3)',
                letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8,
              }}>Holding-period clocks</div>
              <div style={{ display: 'grid', gap: 6 }}>
                {reliefSchemes.map((s, i) => {
                  // Canonical engine resolver: persona-helpers.holdingClock()
                  // covers EIS / SEIS / VCT with statute-correct hold periods.
                  const clock = holdingClock(s)
                  const w = clock?.wrapper || inferWrapper(s)
                  const yearsRequired = clock?.yearsRequired || (w === 'VCT' ? 5 : 3)
                  const yearsHeld = clock?.yearsHeld
                  const reliefAtRisk = clock?.reliefAtRisk ?? false
                  const heldStr = yearsHeld != null ? yearsHeld.toFixed(1) : '—'
                  const name = s.name || w
                  return (
                    <div key={(s.id || 'rs') + i} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      gap: 8, flexWrap: 'wrap',
                    }}>
                      <div style={{ fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.4 }}>
                        <strong style={{ color: 'var(--c-text)' }}>{name}</strong>: {heldStr} of {yearsRequired} yr held. Income-tax relief is repayable if disposed before {yearsRequired} years; CGT exemption (EIS/SEIS) and IHT BPR (EIS/SEIS where qualifying) are similarly conditional.
                      </div>
                      {reliefAtRisk && <Chip tone="warn">Relief at risk</Chip>}
                      {!reliefAtRisk && yearsHeld != null && <Chip tone="good">Cleared</Chip>}
                    </div>
                  )
                })}
              </div>
            </div>
            <div style={{ background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14, overflow: 'hidden' }}>
              {reliefSchemes.map((s, i) => {
                const w = inferWrapper(s)
                const yearsHeld = s.year_purchased ? (new Date().getFullYear() - s.year_purchased) : null
                const minHold = s.minimum_hold_years || (w === 'VCT' ? 5 : 3)
                const inHold = yearsHeld != null && yearsHeld < minHold
                return (
                  <div key={s.id || i} style={{
                    padding: '12px 14px',
                    borderBottom: i < reliefSchemes.length - 1 ? '1px solid var(--c-sep)' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <Chip tone="neutral">{w}</Chip>
                        {s.income_tax_relief_claimed > 0 && <Chip tone="good">IT relief {fmt(s.income_tax_relief_claimed)}</Chip>}
                        {inHold && <Chip tone="warn">Clawback risk · {yearsHeld}/{minHold}y</Chip>}
                        {!inHold && yearsHeld != null && <Chip tone="good">Clear · {yearsHeld}y</Chip>}
                        {w === 'EIS' && <Chip tone="good">BPR after 2y</Chip>}
                        {w === 'SEIS' && <Chip tone="good">BPR after 2y</Chip>}
                        {w === 'VCT' && <Chip tone="bad">No BPR</Chip>}
                        {w === 'VCT' && (
                          <span title="VCT — 30% income tax relief on subscriptions up to £200,000/yr. Must hold 5 years. Dividends tax-free." style={{ display: 'inline-flex' }}>
                            <Chip tone="good">VCT 30% IT relief · £200k/yr · 5y hold · tax-free divs</Chip>
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(s.value || s.balance)}
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>
        )}

        {/* Section 5 — Investment bonds */}
        {bondItems.length > 0 && (
          <Section title="5 · Investment bonds — your 5%-per-year tax-deferred withdrawal" sub="You can withdraw 5% of the original investment each policy year with no immediate tax. Anything more is treated as a chargeable event and taxed at your marginal rate, with top-slicing relief available.">
            <div style={{ background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14, overflow: 'hidden' }}>
              {bondItems.map((b, i) => {
                const used = (+b.withdrawal_5pct_used_pct || 0) * 100
                return (
                  <div key={b.id || i} style={{
                    padding: '12px 14px',
                    borderBottom: i < bondItems.length - 1 ? '1px solid var(--c-sep)' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>{b.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <Chip>{inferWrapper(b) === 'BOND_ON' ? 'Onshore' : 'Offshore'}</Chip>
                          {inferWrapper(b) === 'BOND_ON' && <Chip tone="good">BR credit 20%</Chip>}
                          {inferWrapper(b) === 'BOND_OFF' && <Chip tone="warn">No BR credit</Chip>}
                          <Chip>Top-slicing available</Chip>
                        </div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>
                        {fmt(b.value || b.balance)}
                      </div>
                    </div>
                    <div style={{ height: 6, borderRadius: 100, background: 'var(--c-surface2)', overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(100, used)}%`, height: '100%',
                        background: used > 70 ? '#FF9500' : 'var(--c-acc)',
                      }} />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 4 }}>
                      {used.toFixed(0)}% of cumulative 5% allowance used
                    </div>
                  </div>
                )
              })}
            </div>
            {/* IFA MED-23 — top-slicing relief explainer */}
            <Disclosure title="Top-slicing relief — how it works">
              Top-slicing relief spreads the chargeable-event gain over the number of years the bond was held to find the average annual gain. That average is applied at your marginal rate, then multiplied back up. Where a partial encashment pushes you into a higher band only in that one year, top-slicing typically reduces total tax. Available on UK life bonds (chargeable-event certificate) and offshore bonds. The 5% withdrawal rule lets you withdraw up to 5% of the original premium per year (cumulative up to 100%) without triggering a chargeable event.
            </Disclosure>
          </Section>
        )}

        {/* Section 5b — Knowledge-hall context (sector mix + currency + factors) */}
        <DrillContextStub
          eyebrow="Sector · currency · factors"
          title="Sector breakdown, currency exposure, factor tilts, top holdings across all your funds"
          preview={<SectorMixStub />}
          bullets={[
            'Look-through holdings across every ETF / fund in your portfolio',
            'Currency exposure (GBP / USD / EUR / JPY / other)',
            'Factor tilts — value, growth, quality, low-vol, size',
            'Concentration risk: top-10 holdings as % of total invested',
            'Cost ladder: TER, transaction costs, spread, total cost of ownership',
          ]}
          askQuestion="What is my real sector and currency exposure across all my ETFs and funds combined?"
        />

        {/* Section 6 — All holdings (includes legacy slots + alternatives so
            the count matches the subtitle) */}
        <Section title="6 · All holdings">
          <div style={{ background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14, overflow: 'hidden' }}>
            {items.map((it, i) => {
              const isAlt = isAlternative(it)
              const w = isAlt ? 'ALT' : inferWrapper(it)
              const tone = isAlt ? '#FFD700' : (WRAPPER_TONE[w] || WRAPPER_TONE.OTHER)
              return (
                <button
                  key={it.id || i}
                  type="button"
                  onClick={() => setSelected(it)}
                  className="sw-press"
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '11px 14px',
                    borderBottom: i < items.length - 1 ? '1px solid var(--c-sep)' : 'none',
                    border: 'none', borderRadius: 0, background: 'transparent', color: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', background: tone,
                      boxShadow: `0 0 6px ${tone}`,
                    }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {it.name}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--c-text3)' }}>
                        {it.provider || it.type} · {w.replace('_', ' ')}
                      </div>
                      {it._legacy && (
                        <div style={{ marginTop: 4 }}>
                          <Chip tone="warn">Detail not captured · tap to add cost basis</Chip>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(it.value || it.balance)}
                    </span>
                    <span style={{ fontSize: 14, color: 'var(--c-text3)' }}>›</span>
                  </div>
                </button>
              )
            })}
            {items.length === 0 && (
              <div style={{ padding: 16, fontSize: 12, color: 'var(--c-text3)', textAlign: 'center', fontStyle: 'italic' }}>
                No investments captured yet. Tap + Add on the Investments tile to start.
              </div>
            )}
          </div>
        </Section>

        {/* v0.3 — CGT current rates info block (statute cites) */}
        <Section title="CGT — current rates">
          <div style={{
            padding: '12px 14px', background: 'var(--card-bg2)',
            border: '1px solid var(--c-border)', borderRadius: 14,
            fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.5,
          }}>
            Capital Gains Tax — basic-rate band 18%, above basic-rate band 24%. Annual exempt amount £{(TAX.cgaAllowance ?? 3000).toLocaleString()} ({TAX.taxYear || '2026/27'}). Section 222 (residence relief) and Section 165 (gift hold-over) may apply.
          </div>
          {/* v0.3 — 30-day bed-and-breakfast chip (TCGA s106A) */}
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <span title="30-day rule (TCGA s106A) — shares sold and re-bought within 30 days don't crystallise the loss/gain. ISA bed-and-ISA permitted (different wrapper). GIA-to-GIA bed-and-breakfast disallowed." style={{ display: 'inline-flex' }}>
              <Chip tone="warn">30-day rule (TCGA s106A) · bed-and-ISA OK · GIA-to-GIA disallowed</Chip>
            </span>
            {/* v0.3 — top-slicing relief chip (ITTOIA s535) */}
            <span title="Top-slicing relief (ITTOIA s535) — gains on offshore / onshore bonds spread across number-of-years of policy life. Reduces marginal rate on chargeable event gains." style={{ display: 'inline-flex' }}>
              <Chip tone="good">Top-slicing relief (ITTOIA s535) · bond chargeable events</Chip>
            </span>
          </div>
        </Section>

        {/* v0.3 — Liquidity ladder (R8 signature, ISA + GIA highlighted) */}
        <Section title="Liquidity ladder">
          <LiquidityLadder
            ariaLabel="Liquidity ladder for investments drill — ISA and GIA emphasised."
            tiers={[
              { label: 'Days', items: [
                { name: 'Cash (instant access)', value: cashTotal(entity) },
              ]},
              { label: 'Weeks', items: [
                { name: 'GIA (T+2 settlement)', value: byWrapper.GIA || 0 },
                { name: 'ISA (immediate, penalty-free)', value: byWrapper.ISA || 0 },
              ]},
              { label: 'Months', items: [
                { name: 'Investments (other wrappers)', value: Math.max(0, investmentsTotal(entity) - (byWrapper.GIA || 0) - (byWrapper.ISA || 0)) },
              ]},
              { label: 'Years', items: [
                { name: 'Pension (age 55+ / NMPA)', value: pensionTotal(entity) },
                { name: 'Property', value: propertyTotal(entity) },
              ]},
            ]}
          />
        </Section>

        <p style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 16, lineHeight: 1.5 }}>
          {BRAND.disclaimer}
        </p>
      </div>
      {selected && (
        <AssetDetailOverlay
          asset={selected}
          domain="investments"
          category="investments"
          itemType={selected.type}
          personaId={personaId}
          onBack={() => setSelected(null)}
          onHome={onHome}
        />
      )}
    </OverlayShell>
  )
}
