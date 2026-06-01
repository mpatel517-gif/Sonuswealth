// ─────────────────────────────────────────────────────────────────────────────
// InvestmentsDrillDown — wrapper-by-wrapper view of Domain C/D/E/F.
//
// ONION MODEL (founder 2026-06-01): investments span tax wrappers that are taxed
// nothing alike. Layer 1 = a drawer per wrapper (ISA · General account ·
// EIS/SEIS/VCT · Bonds · Alternatives). Layer 2 = tap a drawer → ONLY that
// wrapper's tax treatment + its dedicated mechanics (ISA room / CGT / relief
// clocks / 5% allowance) + its holdings. Layer 3 = tap a holding →
// AssetDetailOverlay leaf with the researched InvestmentDecisions modeller.
//
// Domains: C — ISA · D — GIA & unwrapped · E — EIS/SEIS/VCT · F — Investment bonds.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import OverlayShell from '../shared/OverlayShell.jsx'
import TaxTreatmentBlock from './TaxTreatmentBlock.jsx'
import { DrillStackProvider, useDrillStackContext } from './L3/DrillStack.jsx'
import { DrillableNumber } from './L3/DrillableNumber.jsx'
import { MiniTrendLines } from './L3/MiniTrendLines.jsx'
import DrillContextStub, { SectorMixStub } from './DrillContextStub.jsx'
import AssetDetailOverlay from './AssetDetailOverlay.jsx'
import {
  getWrapper as canonicalWrapper,
} from '../../engine/selectors/index.js'
import { holdingClock } from '../../engine/persona-helpers.js'
import { BRAND } from '../../config/brand.js'
import { TAX } from '../../engine/fq-calculator.js'

// Fold legacy slot shapes (a.isa, a.portfolio) into the canonical items[] array.
function foldLegacyInvestments(entity) {
  const a = entity?.assets || {}
  const out = []
  if (Array.isArray(a.investments)) out.push(...a.investments)
  // Only fold the legacy scalar shape when the canonical array does NOT already
  // carry that wrapper — otherwise it double-counts. The OLD guard only skipped
  // when an existing _legacy ISA/GIA was present, but personas like Mr T hold
  // real (non-legacy) ISA/GIA entries inside `investments[]` AND the scalar
  // `a.isa`/`a.portfolio`, so the scalar was added on top (ISA £46.6k + GIA £24.8k
  // counted twice → drill read £183k vs the £112k tile). (Audit 2026-06-01.)
  const hasWrapper = (w) => out.some(i => canonicalWrapper(i) === w)
  if (a.isa && (a.isa.value || a.isa.total) && !hasWrapper('ISA')) {
    out.push({
      id: 'legacy-isa', name: 'Stocks & Shares ISA (consolidated)', type: 'stocks-and-shares-ISA',
      value: +(a.isa.value || a.isa.total || 0), balance: +(a.isa.value || a.isa.total || 0),
      provider: a.isa.provider || 'Provider not captured', wrapper: 'ISA', _legacy: true,
    })
  }
  if (a.portfolio && (a.portfolio.value || a.portfolio.total) && !hasWrapper('GIA')) {
    out.push({
      id: 'legacy-portfolio', name: 'General Investment Account (consolidated)', type: 'gia-portfolio',
      value: +(a.portfolio.value || a.portfolio.total || 0), balance: +(a.portfolio.value || a.portfolio.total || 0),
      provider: a.portfolio.provider || 'Provider not captured', wrapper: 'GIA', _legacy: true,
    })
  }
  return out
}

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

function groupLine(val, rate = 0.06) {
  const rM = Math.pow(1 + rate, 1 / 12) - 1
  const out = []
  for (let i = 11; i >= 0; i--) out.push(Math.round((+val || 0) / Math.pow(1 + rM, i)))
  return out
}

const WRAPPER_TONE = {
  ISA: '#5DDBC2', GIA: '#BA8CFF', EIS: '#FF598C', SEIS: '#FF6B6B', VCT: '#E77BFF',
  BOND_ON: '#FFB347', BOND_OFF: '#FF9500', OTHER: '#657286',
}

function inferWrapper(item) {
  const w = canonicalWrapper(item)
  return w === 'UNKNOWN' ? 'OTHER' : w
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

function Disclosure({ title, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginTop: 10, background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14, overflow: 'hidden' }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'transparent', border: 'none', color: 'var(--c-text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 12, fontWeight: 700 }}>
        <span>{title}</span><span style={{ fontSize: 14, color: 'var(--c-text3)' }}>{open ? '–' : '+'}</span>
      </button>
      {open && <div style={{ padding: '0 14px 12px', fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.5 }}>{children}</div>}
    </div>
  )
}

function Chip({ children, tone = 'neutral' }) {
  const bg = tone === 'good' ? 'color-mix(in srgb, var(--c-acc) 14%, transparent)' : tone === 'warn' ? 'color-mix(in srgb, #FF9500 14%, transparent)' : tone === 'bad' ? 'color-mix(in srgb, var(--c-coral, #FF6F7D) 14%, transparent)' : 'var(--c-surface2)'
  const fg = tone === 'good' ? 'var(--c-acc)' : tone === 'warn' ? '#FF9500' : tone === 'bad' ? 'var(--c-coral, #FF6F7D)' : 'var(--c-text2)'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 100, background: bg, color: fg, fontSize: 9, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', border: `1px solid color-mix(in srgb, ${fg} 30%, transparent)` }}>{children}</span>
  )
}

// Layer-1 sub-category drawer (the peel).
function Drawer({ icon, color, label, count, value, line, onOpen }) {
  return (
    <button type="button" onClick={onOpen} className="sw-press" style={{
      display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      padding: '14px 16px', borderRadius: 16, border: '1px solid var(--c-border)', background: 'var(--card-bg2)', cursor: 'pointer', textAlign: 'left', marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <span style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: 'grid', placeItems: 'center', background: `color-mix(in srgb, ${color} 14%, var(--c-surface2))`, color, fontSize: 18 }}>{icon}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: 'var(--c-text)' }}>{label}</div>
          <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>{count} holding{count === 1 ? '' : 's'}</div>
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

// A holding row inside a Layer-2 group → opens the leaf.
function HoldingRow({ it, last, onOpen }) {
  const isAlt = isAlternative(it)
  const w = isAlt ? 'ALT' : inferWrapper(it)
  const tone = isAlt ? '#FFD700' : (WRAPPER_TONE[w] || WRAPPER_TONE.OTHER)
  return (
    <button type="button" onClick={onOpen} className="sw-press" style={{
      width: '100%', textAlign: 'left', padding: '11px 14px', borderBottom: last ? 'none' : '1px solid var(--c-sep)',
      border: 'none', borderRadius: 0, background: 'transparent', color: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: tone, boxShadow: `0 0 6px ${tone}`, flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</div>
          <div style={{ fontSize: 10, color: 'var(--c-text3)' }}>{it.provider || it.type} · {w.replace('_', ' ')}</div>
          {it._legacy && <div style={{ marginTop: 4 }}><Chip tone="warn">Detail not captured · tap to add cost basis</Chip></div>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>{fmt(it.value || it.balance)}</span>
        <span style={{ fontSize: 14, color: 'var(--c-text3)' }}>›</span>
      </div>
    </button>
  )
}

export default function InvestmentsDrillDown(props) {
  return (
    <DrillStackProvider>
      <InvestmentsDrillDownInner {...props} />
    </DrillStackProvider>
  )
}

function InvestmentsDrillDownInner({ entity, personaId, onBack, onHome }) {
  const [selected, setSelected] = useState(null)
  const [openGroup, setOpenGroup] = useState(null)   // null | ISA | GIA | relief | bonds | alt
  const items = foldLegacyInvestments(entity)
  // M5 founder decision (2026-05-26) + audit (2026-06-01): alt-class holdings —
  // crypto/gold/art/PE/wine/collectible AND the venture-relief wrappers
  // EIS/SEIS/VCT — are surfaced on the ALTERNATIVES tile/drill, NOT here. Excluding
  // them makes this drill tie out to the Savings & Investments tile subtotal
  // (ISA/GIA/bonds only, £112k/5 for Mr T) and removes the duplicate-information
  // overlap with the Alternatives drill (the founder's "no duplicate" rule).
  const RELIEF_WRAPPERS = ['EIS', 'SEIS', 'VCT']
  const wrapperItems = items.filter(i => !isAlternative(i) && !RELIEF_WRAPPERS.includes(inferWrapper(i)))
  const altItems = []  // alt-class is owned by the Alternatives surface

  const byWrapper = wrapperItems.reduce((acc, it) => {
    const w = inferWrapper(it)
    acc[w] = (acc[w] || 0) + (+(it.balance_gbp ?? it.balance ?? it.value ?? 0))
    return acc
  }, {})
  const altTotal = altItems.reduce((s, i) => s + (+(i.balance_gbp ?? i.balance ?? i.value ?? 0)), 0)
  const total = Object.values(byWrapper).reduce((s, v) => s + v, 0) + altTotal

  // ISA allowance tracker
  const isaContribCurrent = wrapperItems.filter(i => inferWrapper(i) === 'ISA').reduce((s, i) => s + (+i.contribution_current_tax_year || 0), 0)
  const isaAllowance = TAX?.isaAllowance ?? 20000
  const isaRemain = Math.max(isaAllowance - isaContribCurrent, 0)
  const isaTotalBalance = byWrapper.ISA || 0
  const isaContribUnknown = isaTotalBalance > 0 && isaContribCurrent === 0

  // CGT exposure on GIA
  const giaItems = wrapperItems.filter(i => inferWrapper(i) === 'GIA' || inferWrapper(i) === 'OTHER')
  const giaWithCostBase = giaItems.filter(i => i.cost_base != null || i.embedded_gain != null)
  const giaWithoutCostBase = giaItems.filter(i => !(i.cost_base != null || i.embedded_gain != null))
  const giaEmbeddedGain = giaWithCostBase.reduce((s, i) => {
    if (i.cost_base != null) return s + ((+i.value || +i.balance || 0) - (+i.cost_base || 0))
    if (i.embedded_gain != null) return s + (+i.embedded_gain || 0)
    return s
  }, 0)
  const cgtAnnualExempt = TAX.cgaAllowance ?? 3000
  const cgtTaxable = Math.max(giaEmbeddedGain - cgtAnnualExempt, 0)
  const reliefSchemes = wrapperItems.filter(i => ['EIS', 'SEIS', 'VCT'].includes(inferWrapper(i)))
  const bondItems = wrapperItems.filter(i => ['BOND_ON', 'BOND_OFF'].includes(inferWrapper(i)))
  const holdingCount = wrapperItems.length

  const drillStack = useDrillStackContext()
  const investmentsBreakdown = [
    ...Object.entries(byWrapper).map(([w, v]) => ({ label: `${w} wrapper`, value: fmt(v) })),
    ...(altTotal > 0 ? [{ label: 'Alternatives (crypto / wine / PE)', value: fmt(altTotal) }] : []),
  ]

  // ── Sub-category groups (the onion's first peel) ──────────────────────────
  const GROUP_DEFS = [
    { key: 'ISA',    icon: '◈', color: WRAPPER_TONE.ISA,     label: 'ISA',              wraps: ['ISA'] },
    { key: 'GIA',    icon: '▦', color: WRAPPER_TONE.GIA,     label: 'General account',  wraps: ['GIA', 'OTHER'] },
    { key: 'bonds',  icon: '◆', color: WRAPPER_TONE.BOND_ON, label: 'Investment bonds', wraps: ['BOND_ON', 'BOND_OFF'] },
  ]
  const groups = GROUP_DEFS.map(g => {
    const holdings = wrapperItems.filter(it => g.wraps.includes(inferWrapper(it)))
    const value = holdings.reduce((s, i) => s + (+(i.balance_gbp ?? i.balance ?? i.value ?? 0)), 0)
    return { ...g, holdings, value, count: holdings.length }
  }).filter(g => g.count > 0)
  if (altTotal > 0) groups.push({ key: 'alt', icon: '✦', color: '#FFD700', label: 'Alternatives', holdings: altItems, value: altTotal, count: altItems.length, wraps: [] })

  const G = groups.find(g => g.key === openGroup)
  const shellBack = openGroup ? () => setOpenGroup(null) : onBack
  const openLeaf = (it) => setSelected(it)

  return (
    <OverlayShell title={G ? `Investments · ${G.label}` : 'Savings & investments · drill-down'}
      subtitle={
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'baseline' }}>
          <DrillableNumber
            metric="Total invested assets" value={fmt(total)}
            formula={`${holdingCount} holding${holdingCount === 1 ? '' : 's'} across ${Object.keys(byWrapper).length} wrapper type${Object.keys(byWrapper).length === 1 ? '' : 's'}${altTotal > 0 ? ' plus alternatives' : ''}.`}
            source={`${holdingCount} holding${holdingCount === 1 ? '' : 's'} on file — latest valuation per asset`}
            confidence="high" breakdown={investmentsBreakdown} onDrill={drillStack.pushNumber}
          />
          <span style={{ fontSize: 13, color: 'var(--c-text3)' }}>· {holdingCount} holding{holdingCount === 1 ? '' : 's'}</span>
        </span>
      }
      onBack={shellBack} onHome={onHome}>
      <div style={{ padding: '16px 16px 40px' }}>

        {/* ── LAYER 1 — wrapper drawers ──────────────────────────────────── */}
        {!openGroup && (
          <>
            <div className="sw-eyebrow" style={{ fontStyle: 'italic', marginBottom: 12, color: 'var(--c-text3)', letterSpacing: 0.6 }}>
              Your money sits in different tax wrappers — each taxed its own way. Tap one to go deeper.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              <Tile label="Total invested" value={fmt(total)} tone="good" />
              <Tile label="Wrappers" value={String(groups.length)} sub={`${holdingCount} holdings`} />
            </div>
            {groups.map(g => (
              <Drawer key={g.key} icon={g.icon} color={g.color} label={g.label} count={g.count} value={g.value} line={groupLine(g.value)} onOpen={() => setOpenGroup(g.key)} />
            ))}
          </>
        )}

        {/* ── LAYER 2 — one wrapper's tax + mechanics + holdings ─────────── */}
        {G && (
          <>
            {/* Tax treatment — only this wrapper(s) */}
            {G.key !== 'alt' && (
              <Section title="How this is taxed">
                <div style={{ display: 'grid', gap: 10 }}>
                  {[...new Set(G.holdings.map(inferWrapper))].filter(w => w !== 'OTHER').map(w => (
                    <TaxTreatmentBlock key={w} wrapper={w} />
                  ))}
                </div>
              </Section>
            )}

            {/* ISA mechanics */}
            {G.key === 'ISA' && (
              <Section title="This year's ISA room" sub={`£${isaAllowance.toLocaleString()} per person per tax year. Up to £12,000 of that can sit in cash if you're under 65.`}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 8 }}>
                  <Tile label="Current ISA balance" value={fmt(isaTotalBalance)} sub="Across all years" />
                  <Tile label="Used this year" value={fmt(isaContribCurrent)} sub={`of ${fmt(isaAllowance)}`} />
                  <Tile label="Room remaining" value={fmt(isaRemain)} tone={isaRemain > 0 ? 'good' : 'neutral'} sub="Bed-and-ISA candidate" />
                </div>
                {isaContribUnknown && <div style={{ marginBottom: 8 }}><Chip tone="warn">Contribution history not captured · this-year usage shown as nil</Chip></div>}
                <div style={{ height: 8, borderRadius: 100, background: 'var(--c-surface2)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, (isaContribCurrent / isaAllowance) * 100)}%`, height: '100%', background: 'var(--c-acc)', boxShadow: '0 0 8px var(--c-acc)' }} />
                </div>
              </Section>
            )}

            {/* GIA mechanics */}
            {G.key === 'GIA' && (
              <Section title="Capital gains tax if you sold today" sub={`First £${cgtAnnualExempt.toLocaleString()} of gain is tax-free each year. Above that, 18% (basic) or 24% (higher / additional).`}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                  <Tile label="Embedded gain" value={fmt(giaEmbeddedGain)} tone={giaEmbeddedGain > cgtAnnualExempt ? 'warn' : 'neutral'} />
                  <Tile label="Annual exempt" value={fmt(cgtAnnualExempt)} sub="Tax-free disposal" />
                  <Tile label="Taxable on full sale" value={fmt(cgtTaxable)} tone={cgtTaxable > 0 ? 'warn' : 'good'} sub="At marginal CGT rate" />
                </div>
                {giaWithoutCostBase.length > 0 && <div style={{ marginTop: 8 }}><Chip tone="warn">Cost basis missing for {giaWithoutCostBase.length} holding{giaWithoutCostBase.length === 1 ? '' : 's'} · CGT estimate excludes them</Chip></div>}
                <Disclosure title="Share-pooling — how UK CGT matches disposals">
                  HMRC matches a disposal to acquisitions in this order: (1) same-day, (2) within the next 30 days (the "bed-and-breakfast" rule), (3) the s104 share pool — an averaged pool of all earlier holdings. The order affects which acquisition cost is used, especially when you sell and re-buy a similar asset soon after. Bed & ISA bridges wrappers so the 30-day rule does not block it.
                </Disclosure>
              </Section>
            )}

            {/* Relief-scheme mechanics */}
            {G.key === 'relief' && (
              <Section title="Holding-period clocks" sub="Income-tax relief in: 30% EIS, 50% SEIS, 30% VCT. Sell too early and the relief is clawed back — three years for EIS/SEIS, five for VCT.">
                <div style={{ display: 'grid', gap: 6, background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14, padding: '10px 12px' }}>
                  {reliefSchemes.map((s, i) => {
                    const clock = holdingClock(s)
                    const w = clock?.wrapper || inferWrapper(s)
                    const yearsRequired = clock?.yearsRequired || (w === 'VCT' ? 5 : 3)
                    const yearsHeld = clock?.yearsHeld
                    const reliefAtRisk = clock?.reliefAtRisk ?? false
                    const heldStr = yearsHeld != null ? yearsHeld.toFixed(1) : '—'
                    return (
                      <div key={(s.id || 'rs') + i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.4 }}>
                          <strong style={{ color: 'var(--c-text)' }}>{s.name || w}</strong>: {heldStr} of {yearsRequired} yr held. Income-tax relief repayable if disposed before {yearsRequired} years.
                        </div>
                        {reliefAtRisk && <Chip tone="warn">Relief at risk</Chip>}
                        {!reliefAtRisk && yearsHeld != null && <Chip tone="good">Cleared</Chip>}
                      </div>
                    )
                  })}
                </div>
              </Section>
            )}

            {/* Bond mechanics */}
            {G.key === 'bonds' && (
              <Section title="Your 5%-per-year tax-deferred withdrawal" sub="Withdraw 5% of the original investment each policy year with no immediate tax. More than that is a chargeable event, taxed at your marginal rate with top-slicing relief.">
                <div style={{ background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14, overflow: 'hidden' }}>
                  {bondItems.map((b, i) => {
                    const used = (+b.withdrawal_5pct_used_pct || 0) * 100
                    return (
                      <div key={b.id || i} style={{ padding: '12px 14px', borderBottom: i < bondItems.length - 1 ? '1px solid var(--c-sep)' : 'none' }}>
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
                          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>{fmt(b.value || b.balance)}</div>
                        </div>
                        <div style={{ height: 6, borderRadius: 100, background: 'var(--c-surface2)', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, used)}%`, height: '100%', background: used > 70 ? '#FF9500' : 'var(--c-acc)' }} />
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 4 }}>{used.toFixed(0)}% of cumulative 5% allowance used</div>
                      </div>
                    )
                  })}
                </div>
              </Section>
            )}

            {/* Alternatives note */}
            {G.key === 'alt' && (
              <Section title="Alternatives" sub="Crypto, wine, art, private equity — their own rules (CGT on disposal, illiquid, hard to value). Full detail lives on the Alternatives tile; here are the holdings inside your investments.">
                <div />
              </Section>
            )}

            {/* Holdings list — tap to the leaf + decision modeller */}
            <Section title="Your holdings" sub="Tap a holding for its full detail and what you can do.">
              <div style={{ background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14, overflow: 'hidden' }}>
                {G.holdings.map((it, i) => (
                  <HoldingRow key={it.id || i} it={it} last={i === G.holdings.length - 1} onOpen={() => openLeaf(it)} />
                ))}
              </div>
            </Section>

            {G.key === 'GIA' && (
              <DrillContextStub
                eyebrow="Sector · currency · factors"
                title="Sector breakdown, currency exposure, factor tilts, top holdings across your funds"
                preview={<SectorMixStub />}
                bullets={['Look-through holdings across every ETF / fund', 'Currency exposure (GBP / USD / EUR / other)', 'Factor tilts — value, growth, quality, low-vol', 'Concentration: top-10 holdings as % of total']}
                askQuestion="What is my real sector and currency exposure across all my funds combined?"
              />
            )}
          </>
        )}

        <p style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 16, lineHeight: 1.5 }}>{BRAND.disclaimer}</p>
      </div>

      {selected && (
        <AssetDetailOverlay
          asset={selected}
          domain={isAlternative(selected) ? 'alternatives' : 'investments'}
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
