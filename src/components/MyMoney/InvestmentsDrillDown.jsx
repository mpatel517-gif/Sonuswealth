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
import { getWrapper as canonicalWrapper } from '../../engine/_helpers.js'

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
  const items = a.investments || []

  // Subtotals by wrapper tier — start from the spec investments[] then fold in
  // legacy flat slots (a.isa / a.portfolio) so panels render for personas on
  // either schema shape.
  const byWrapper = items.reduce((acc, it) => {
    const w = inferWrapper(it)
    acc[w] = (acc[w] || 0) + (+it.value || +it.balance || 0)
    return acc
  }, {})
  if (a.isa?.value != null) byWrapper.ISA = (byWrapper.ISA || 0) + (+a.isa.value || 0)
  else if (typeof a.isa === 'number') byWrapper.ISA = (byWrapper.ISA || 0) + (+a.isa || 0)
  if (a.portfolio?.value != null) byWrapper.GIA = (byWrapper.GIA || 0) + (+a.portfolio.value || 0)
  const total = Object.values(byWrapper).reduce((s, v) => s + v, 0)

  // ISA allowance tracker (current tax-year)
  const isaContribCurrent = items
    .filter(i => inferWrapper(i) === 'ISA')
    .reduce((s, i) => s + (+i.contribution_current_tax_year || 0), 0)
  const isaAllowance = 20000
  const isaRemain = Math.max(isaAllowance - isaContribCurrent, 0)

  // CGT exposure on GIA
  const giaItems = items.filter(i => inferWrapper(i) === 'GIA')
  const giaEmbeddedGain = giaItems.reduce((s, i) => {
    if (i.cost_base != null) return s + ((+i.value || +i.balance || 0) - (+i.cost_base || 0))
    if (i.embedded_gain != null) return s + (+i.embedded_gain || 0)
    return s
  }, 0)
  const cgtAnnualExempt = 3000
  const cgtTaxable = Math.max(giaEmbeddedGain - cgtAnnualExempt, 0)

  // EIS / SEIS / VCT clawback tracker
  const reliefSchemes = items.filter(i => ['EIS', 'SEIS', 'VCT'].includes(inferWrapper(i)))

  // Bond 5% allowance
  const bondItems = items.filter(i => ['BOND_ON', 'BOND_OFF'].includes(inferWrapper(i)))

  return (
    <OverlayShell title="Savings & investments · drill-down"
      subtitle={`${fmt(total)} · ${items.length} holdings`}
      onBack={onBack} onHome={onHome}>
      <div style={{ padding: '16px 16px 40px' }}>

        {/* Section 1 — wrapper composition */}
        <Section title="1 · Where your investments sit by tax wrapper" sub="ISAs and pensions are first-line tax shelters. A general investment account (GIA) is fully chargeable. EIS / SEIS schemes get income-tax relief plus inheritance relief. Bonds run on a different tax regime entirely.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
            <Tile label="Total invested" value={fmt(total)} tone="good" />
            <Tile label="ISA value" value={fmt(byWrapper.ISA || 0)} sub="Tax-free wrapper" />
            <Tile label="GIA value" value={fmt(byWrapper.GIA || 0)} sub="Chargeable" />
            <Tile label="EIS/SEIS/VCT" value={fmt((byWrapper.EIS || 0) + (byWrapper.SEIS || 0) + (byWrapper.VCT || 0))} sub="IT relief schemes" />
            <Tile label="Bonds" value={fmt((byWrapper.BOND_ON || 0) + (byWrapper.BOND_OFF || 0))} sub="Chargeable event regime" />
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

        {/* Section 2 — ISA allowance */}
        <Section title="2 · This year's ISA room" sub={`£${isaAllowance.toLocaleString()} per person per tax year. Up to £12,000 of that can sit in cash if you're under 65.`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 8 }}>
            <Tile label="Used this year" value={fmt(isaContribCurrent)} sub={`of ${fmt(isaAllowance)}`} />
            <Tile label="Remaining" value={fmt(isaRemain)} tone={isaRemain > 0 ? 'good' : 'neutral'} sub="Bed-and-ISA candidate" />
          </div>
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
          </Section>
        )}

        {/* Section 4 — EIS/SEIS/VCT clawback */}
        {reliefSchemes.length > 0 && (
          <Section title="4 · Higher-risk schemes with tax relief (EIS · SEIS · VCT)" sub="Income tax back on the way in: 30% for EIS, 50% for SEIS, 20% for VCT (from April 2026). Sell too early and the relief is clawed back — three years for EIS/SEIS, five for VCT.">
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

        {/* Section 6 — All holdings */}
        <Section title="6 · All holdings">
          <div style={{ background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14, overflow: 'hidden' }}>
            {items.map((it, i) => {
              const w = inferWrapper(it)
              const tone = WRAPPER_TONE[w] || WRAPPER_TONE.OTHER
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
