// ─────────────────────────────────────────────────────────────────────────────
// AlternativesDrillDown — drill-down for the Alternatives category tile.
//
// Founder complaint addressed: "Alternatives box is big and has no detail."
// CategoryTile rolled everything into "Other 100%" because items had no
// wrapper field. This drill normalises items by `type` (wine · art · gold ·
// crypto · pe · classic_car · watches · collectibles · eis · seis · vct)
// and surfaces composition, liquidity ladder, per-type tax treatment,
// IHT treatment, EIS/SEIS/VCT holding clocks, and valuation freshness.
//
// Information only. No advice verbs. Mechanical descriptions only.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import OverlayShell from '../shared/OverlayShell.jsx'
import { DrillStackProvider, useDrillStackContext } from './L3/DrillStack.jsx'
import { DrillableNumber } from './L3/DrillableNumber.jsx'
import AssetDetailOverlay from './AssetDetailOverlay.jsx'
import { holdingClock } from '../../engine/persona-helpers.js'
import { BRAND } from '../../config/brand.js'
import { LiquidityLadder } from '../charts/index.js'
// S1 selector migration (Phase 2)
import { cash as cashTotal, investments as investmentsTotal, pensions as pensionTotal, properties as propertyTotal } from '../../engine/selectors/index.js'
import { isaTotal, giaTotal } from '../../engine/_helpers.js'

function fmt(v) {
  const n = Math.round(+v || 0)
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${n < 0 ? '−' : ''}£${(abs / 1_000_000).toFixed(2)}m`
  if (abs >= 1_000)     return `${n < 0 ? '−' : ''}£${(abs / 1_000).toFixed(0)}k`
  return `${n < 0 ? '−' : ''}£${abs.toLocaleString()}`
}

function pct(v, total) { return total > 0 ? `${Math.round((v / total) * 100)}%` : '0%' }

// ── Type metadata ────────────────────────────────────────────────────────────
const TYPE_META = {
  wine:         { label: 'Wine',         tone: '#9B2C4A', liquidity: 'weeks',  liquidityStep: 3 },
  art:          { label: 'Art',          tone: '#BA8CFF', liquidity: 'months', liquidityStep: 4 },
  gold:         { label: 'Gold / bullion', tone: '#E0B84A', liquidity: 'days',   liquidityStep: 2 },
  crypto:       { label: 'Crypto',       tone: '#5DDBC2', liquidity: 'hours',  liquidityStep: 1 },
  pe:           { label: 'Private equity', tone: '#FF598C', liquidity: 'years',  liquidityStep: 5 },
  classic_car:  { label: 'Classic car',  tone: '#FF9500', liquidity: 'months', liquidityStep: 4 },
  watches:      { label: 'Watches',      tone: '#FFB347', liquidity: 'months', liquidityStep: 4 },
  collectibles: { label: 'Collectibles', tone: '#A0A8B8', liquidity: 'months', liquidityStep: 4 },
  eis:          { label: 'EIS',          tone: '#FF598C', liquidity: 'years',  liquidityStep: 5 },
  seis:         { label: 'SEIS',         tone: '#FF6B6B', liquidity: 'years',  liquidityStep: 5 },
  vct:          { label: 'VCT',          tone: '#E77BFF', liquidity: 'years',  liquidityStep: 5 },
  other:        { label: 'Other',        tone: '#657286', liquidity: 'months', liquidityStep: 4 },
}

// Liquidity ladder positions (left = fast, right = slow)
const LIQ_ORDER = ['hours', 'days', 'weeks', 'months', 'years']

// Per-type tax-treatment copy (information only)
const TAX_COPY = {
  wine: {
    cgt: 'Chattels exemption (s262 TCGA): single-disposal proceeds ≤ £6,000 = no CGT. Above £6k a marginal-relief formula caps the gain at 5/3 × (proceeds − £6,000).',
    iht: 'In the estate at market value at date of death. No automatic relief.',
  },
  art: {
    cgt: 'Same chattels rule as wine — £6k per-work exemption then marginal relief. Wasting-asset relief (expected life ≤50y) rarely applies.',
    iht: 'Estate value at market value. Conditional Exemption available for pre-eminent works (HMRC scheme).',
  },
  gold: {
    cgt: 'Investment-grade bullion: VAT-exempt. UK legal-tender coins (sovereigns post-1837, britannias) are CGT-exempt as legal tender. Gold ETFs and miner shares fall under standard CGT.',
    iht: 'Estate at market value. No special IHT treatment for physical bullion.',
  },
  crypto: {
    cgt: 'HMRC treats crypto as property. CGT on disposal at the saver\'s marginal rate. Share-pooling rules apply (s104 pool + 30-day matching). Staking and mining can be income or miscellaneous income depending on circumstances.',
    iht: 'In the estate at market value at date of death. Practical issue: heirs need access to keys/seed phrases.',
  },
  pe: {
    cgt: 'Standard CGT on disposal. Business Asset Disposal Relief may reduce CGT to 14% (rising to 18% from April 2026) on qualifying unquoted trading-company disposals up to £1m lifetime cap.',
    iht: 'Unquoted qualifying trading-company shares can attract BPR at 100% (up to £1m cap from April 2026, then 50% above). 2-year minimum hold.',
  },
  classic_car: {
    cgt: 'HMRC default: wasting-asset exempt from CGT (mechanical with finite useful life). Edge cases (museum-quality immutable provenance) can be challenged.',
    iht: 'Estate at market value. No special treatment.',
  },
  watches: {
    cgt: 'Chattels exemption applies (£6k per item rule). Mechanical watches are not treated as wasting assets by default — CGT applies above the threshold.',
    iht: 'Estate at market value.',
  },
  collectibles: {
    cgt: 'Chattels exemption (£6k per item). Sets/collections sold piecemeal can be assessed as a single asset if HMRC views them as a set.',
    iht: 'Estate at market value.',
  },
  eis: {
    cgt: 'Disposal gains after 3 years held = CGT-exempt if income-tax relief was claimed and retained. CGT deferral available on reinvested gains.',
    iht: '100% BPR after 2 years (qualifying trading companies).',
  },
  seis: {
    cgt: 'Disposal gains after 3 years held = CGT-exempt if income-tax relief was claimed. CGT reinvestment relief: up to 50% of gain reinvested into SEIS shares is exempt.',
    iht: '100% BPR after 2 years (qualifying trading companies).',
  },
  vct: {
    cgt: 'Dividends and disposal gains are exempt from UK tax provided shares were held ≥5 years and income-tax relief was retained.',
    iht: 'No BPR (VCTs are listed). In the estate at market value.',
  },
  other: {
    cgt: 'Default treatment depends on the asset class. Tap an item to capture details so the wrapper can be set.',
    iht: 'Default estate-value treatment.',
  },
}

// Normalise input — items array or per-type object → unified items list
function readAlternatives(entity) {
  const raw = entity?.assets?.alternatives
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw.map((it, idx) => normalizeItem(it, idx))
  }
  // Object form: { wine: [...], art: [...], gold: number, ... } or
  // { wine: { value: 8400 }, ... }
  const out = []
  for (const [k, v] of Object.entries(raw)) {
    if (Array.isArray(v)) {
      v.forEach((x, i) => out.push(normalizeItem({ ...x, type: x.type || k }, i)))
    } else if (typeof v === 'number') {
      out.push(normalizeItem({ type: k, value: v, name: TYPE_META[k]?.label || k }, 0))
    } else if (v && typeof v === 'object') {
      out.push(normalizeItem({ ...v, type: v.type || k }, 0))
    }
  }
  return out
}

function normalizeItem(it, idx) {
  const t = String(it.type || it.wrapper || 'other').toLowerCase().replace(/-/g, '_')
  const knownType = TYPE_META[t] ? t : 'other'
  return {
    id: it.id || `${knownType}-${idx}`,
    name: it.name || TYPE_META[knownType]?.label || 'Item',
    type: knownType,
    value: +(it.value_gbp ?? it.value ?? it.balance_gbp ?? it.balance ?? 0) || 0,
    lastValued: it.last_valuation_date || it.valuation_date || null,
    acquisitionDate: it.acquisition_date || it.purchase_date || it.start_date || null,
    raw: it,
  }
}

// Liquidity tier index for the ladder (1 = fastest, 5 = slowest)
function liquidityIndex(type) {
  return TYPE_META[type]?.liquidityStep ?? 4
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

function Chip({ children, tone = 'neutral' }) {
  const bg = tone === 'good' ? 'color-mix(in srgb, var(--c-acc) 14%, transparent)'
    : tone === 'warn' ? 'color-mix(in srgb, #FF9500 14%, transparent)'
    : tone === 'bad' ? 'color-mix(in srgb, var(--c-coral, #FF6F7D) 14%, transparent)'
    : 'var(--c-surface2)'
  const fg = tone === 'good' ? 'var(--c-acc)'
    : tone === 'warn' ? '#FF9500'
    : tone === 'bad' ? 'var(--c-coral, #FF6F7D)'
    : 'var(--c-text2)'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 100, background: bg, color: fg,
      fontSize: 9, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
      border: `1px solid color-mix(in srgb, ${fg} 30%, transparent)`,
    }}>{children}</span>
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

// L3-1b (2026-05-28): DrillStack wrapper per README pattern.
export default function AlternativesDrillDown(props) {
  return (
    <DrillStackProvider>
      <AlternativesDrillDownInner {...props} />
    </DrillStackProvider>
  )
}

function AlternativesDrillDownInner({ entity, personaId, onBack, onHome }) {
  const drillStack = useDrillStackContext()
  const [selected, setSelected] = useState(null)  // per-holding leaf drill
  const items = readAlternatives(entity)
  const total = items.reduce((s, i) => s + i.value, 0)

  // Group by type
  const byType = items.reduce((acc, it) => {
    if (!acc[it.type]) acc[it.type] = { type: it.type, total: 0, items: [] }
    acc[it.type].total += it.value
    acc[it.type].items.push(it)
    return acc
  }, {})
  const typeGroups = Object.values(byType).sort((a, b) => b.total - a.total)

  // Stale-valuation flag — v0.3 spec delta tightened to >90 days
  const now = Date.now()
  const NINETY_DAYS = 90 * 86400000
  const stale = items.filter(i => i.lastValued && (now - new Date(i.lastValued).getTime()) > NINETY_DAYS)

  // EIS/SEIS/VCT clock items
  const clockItems = items.filter(i => ['eis', 'seis', 'vct'].includes(i.type))

  // Empty state (persona-a Bruce has no alternatives)
  if (items.length === 0) {
    return (
      <OverlayShell title="Alternatives · drill-down" subtitle="No holdings captured"
        onBack={onBack} onHome={onHome}>
        <div style={{ padding: '24px 16px 40px' }}>
          {/* v0.3 R8 §1 — distinctive subtitle also rendered in empty path
              so the drill identity reads consistently across personas. */}
          <div className="sw-eyebrow" style={{ fontStyle: 'italic', color: 'var(--c-text3)', marginBottom: 14 }}>
            EIS, SEIS, VCT, AIM, and private holdings
          </div>

          <div className="sw-card" style={{
            padding: 16, background: 'var(--card-bg2)',
            border: '1px solid var(--c-border)', borderRadius: 14,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', marginBottom: 6 }}>
              No alternative holdings on this profile.
            </div>
            <div style={{ fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.5 }}>
              Alternatives are anything outside cash · investments · property · pensions · protection.
              Examples: wine, art, gold, crypto, classic cars, watches, EIS/SEIS/VCT, private equity.
              Each type has different tax treatment, liquidity profile, and valuation cadence.
            </div>
          </div>

          {/* v0.3 R8 §2 — AIM 50% BPR chip (information only, applies whether
              or not user holds AIM today — explains the relief when they consider it). */}
          <div className="sw-card" style={{ padding: '10px 14px', marginTop: 14 }}>
            <div className="sw-eyebrow" style={{ marginBottom: 4 }}>AIM 50% BPR</div>
            <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.5 }}>
              AIM shares listed on London AIM — 50% Business Property Relief
              if held 2+ years (Finance Act 2026). Combined BPR/APR cap £2.5m.
              Non-AIM unquoted shares may qualify at 100% within cap.
            </div>
          </div>

          {/* v0.3 R8 §3 — Liquidity ladder (Alternatives = slowest tier). */}
          <div style={{ marginTop: 14 }}>
            <LiquidityLadder
              ariaLabel="Liquidity ladder — Alternatives is the slowest tier · multi-year exit"
              tiers={[
                { label: 'Hours', items: [{ name: 'Cash', value: 0 }] },
                { label: 'Days', items: [{ name: 'ISA', value: 0 }] },
                { label: 'Weeks', items: [{ name: 'GIA', value: 0 }] },
                { label: 'Months', items: [{ name: 'Pension', value: 0 }, { name: 'Property', value: 0 }] },
                { label: 'Years', items: [{ name: 'Alternatives (multi-year exit)', value: 0 }] },
              ]}
            />
          </div>

          <p style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 16, lineHeight: 1.5 }}>
            {BRAND.disclaimer}
          </p>
        </div>
      </OverlayShell>
    )
  }

  return (
    <OverlayShell title="Alternatives · drill-down"
      subtitle={
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'baseline' }}>
          <DrillableNumber
            metric="Total alternatives"
            value={fmt(total)}
            formula={`${items.length} holding${items.length === 1 ? '' : 's'} across ${typeGroups.length} asset type${typeGroups.length === 1 ? '' : 's'}.`}
            source={`${items.length} holding${items.length === 1 ? '' : 's'} on file`}
            confidence="high"
            breakdown={typeGroups.map((g) => ({ label: g.label || g.type || 'Other', value: fmt(g.total) }))}
            onDrill={drillStack.pushNumber}
          />
          <span style={{ fontSize: 13, color: 'var(--c-text3)' }}>· {items.length} holding{items.length === 1 ? '' : 's'} · {typeGroups.length} type{typeGroups.length === 1 ? '' : 's'}</span>
        </span>
      }
      onBack={onBack} onHome={onHome}>
      <div style={{ padding: '16px 16px 40px' }}>

        <div
          className="sw-eyebrow"
          style={{ fontStyle: 'italic', color: 'var(--c-text3)', marginBottom: 10 }}
        >
          EIS, SEIS, VCT, AIM, and private holdings
        </div>

        {/* v0.3 spec delta — donut → horizontal stacked bar at cap.
            Switch: bar when >5 categories OR any slice <3%. Otherwise donut-equivalent
            (stacked horizontal bar variant kept minimal — the existing per-tile bars
            below already function as the donut alternative; this top strip provides
            the composition-at-a-glance signal the donut would have given.) */}
        {(() => {
          const useBar = typeGroups.length > 5 || typeGroups.some(g => total > 0 && (g.total / total) < 0.03)
          if (!useBar) return null
          return (
            <div className="sw-card" style={{
              padding: 12, background: 'var(--card-bg2)',
              border: '1px solid var(--c-border)', borderRadius: 14, marginBottom: 12,
            }}>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
                color: 'var(--c-text3)', marginBottom: 8,
              }}>
                Composition · stacked bar (small slices preserved)
              </div>
              <div style={{ display: 'flex', height: 14, borderRadius: 100, overflow: 'hidden', background: 'var(--c-surface2)' }}>
                {typeGroups.map(g => {
                  const meta = TYPE_META[g.type] || TYPE_META.other
                  const w = total > 0 ? (g.total / total) * 100 : 0
                  return (
                    <div
                      key={g.type}
                      title={`${meta.label} · ${fmt(g.total)} · ${pct(g.total, total)}`}
                      style={{ width: `${w}%`, height: '100%', background: meta.tone }}
                    />
                  )
                })}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, fontSize: 10, color: 'var(--c-text2)' }}>
                {typeGroups.map(g => {
                  const meta = TYPE_META[g.type] || TYPE_META.other
                  return (
                    <span key={g.type} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.tone }} />
                      {meta.label} {pct(g.total, total)}
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* Section 1 — Composition by type */}
        <Section title="1 · Composition by asset type"
          sub="Each type has its own tax regime, liquidity profile, and valuation cadence — grouped here rather than collapsed into 'Other'.">
          <div style={{ display: 'grid', gap: 10 }}>
            {typeGroups.map(g => {
              const meta = TYPE_META[g.type] || TYPE_META.other
              const w = total > 0 ? (g.total / total) * 100 : 0
              return (
                <div key={g.type} className="sw-card" style={{
                  padding: 12, background: 'var(--card-bg2)',
                  border: '1px solid var(--c-border)', borderRadius: 14,
                  borderLeft: `3px solid ${meta.tone}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text)' }}>
                      {meta.label}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(g.total)} · {pct(g.total, total)}
                    </div>
                  </div>
                  <div style={{ height: 6, borderRadius: 100, background: 'var(--c-surface2)', overflow: 'hidden', marginBottom: 8 }}>
                    <div style={{ width: `${w}%`, height: '100%', background: meta.tone }} />
                  </div>
                  <div style={{ display: 'grid', gap: 4 }}>
                    {g.items.map((it, i) => (
                      <button key={it.id || i}
                        type="button"
                        onClick={() => setSelected(it)}
                        className="sw-press"
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                          width: '100%', background: 'transparent', border: 'none', padding: '2px 0',
                          cursor: 'pointer', textAlign: 'left',
                          fontSize: 11, color: 'var(--c-text2)',
                        }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {it.name} <span style={{ color: 'var(--c-text3)' }}>›</span>
                        </span>
                        <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--c-text)', fontWeight: 600 }}>
                          {fmt(it.value)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </Section>

        {/* Section 2 — Liquidity ladder */}
        <Section title="2 · Liquidity profile"
          sub="How quickly each holding can convert to cash. Mechanical estimates based on market structure — auction cycles, exchange hours, lock-in periods.">
          <div className="sw-card" style={{
            padding: 12, background: 'var(--card-bg2)',
            border: '1px solid var(--c-border)', borderRadius: 14,
          }}>
            <div style={{
              display: 'grid', gridTemplateColumns: `repeat(${LIQ_ORDER.length}, 1fr)`,
              gap: 6, marginBottom: 10,
            }}>
              {LIQ_ORDER.map((tier, idx) => (
                <div key={tier} style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: 9, fontWeight: 700, color: 'var(--c-text3)',
                    letterSpacing: 0.4, textTransform: 'uppercase',
                  }}>{tier}</div>
                  <div style={{
                    height: 4, marginTop: 4, borderRadius: 2,
                    background: `color-mix(in srgb, var(--c-acc) ${100 - idx * 18}%, transparent)`,
                  }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {typeGroups.map(g => {
                const meta = TYPE_META[g.type] || TYPE_META.other
                const idx = liquidityIndex(g.type) - 1
                return (
                  <div key={g.type} style={{
                    display: 'grid', gridTemplateColumns: `repeat(${LIQ_ORDER.length}, 1fr)`,
                    gap: 6, alignItems: 'center',
                  }}>
                    {LIQ_ORDER.map((_, i) => (
                      <div key={i} style={{ textAlign: 'center' }}>
                        {i === idx && (
                          <div title={`${meta.label} — ${LIQ_ORDER[idx]}`} style={{
                            width: 12, height: 12, borderRadius: '50%',
                            background: meta.tone,
                            boxShadow: `0 0 8px ${meta.tone}`,
                            margin: '0 auto',
                          }} />
                        )}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop: 10, fontSize: 10, color: 'var(--c-text3)', lineHeight: 1.4 }}>
              Dots show typical disposal speed by type. Lock-in schemes (EIS/SEIS/VCT, PE) sit on the right; bullion and crypto on the left.
            </div>
          </div>
        </Section>

        {/* Section 3 — Per-type tax treatment */}
        <Section title="3 · Tax treatment by type"
          sub="Income tax · Capital gains tax · Inheritance tax — mechanical view per type. No 'should' or 'best to'.">
          <div style={{ display: 'grid', gap: 10 }}>
            {typeGroups.map(g => {
              const meta = TYPE_META[g.type] || TYPE_META.other
              const copy = TAX_COPY[g.type] || TAX_COPY.other
              return (
                <div key={g.type} className="sw-card" style={{
                  padding: 12, background: 'var(--card-bg2)',
                  border: '1px solid var(--c-border)', borderRadius: 14,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', background: meta.tone,
                    }} />
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text)' }}>
                      {meta.label}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: 6, fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.45 }}>
                    <div>
                      <Chip tone="neutral">CGT</Chip>
                      <span style={{ marginLeft: 6 }}>{copy.cgt}</span>
                    </div>
                    <div>
                      <Chip tone="neutral">IHT</Chip>
                      <span style={{ marginLeft: 6 }}>{copy.iht}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Section>

        {/* Section 4 — Estate / IHT view */}
        <Section title="4 · Inheritance-tax view"
          sub="What sits in the estate, what attracts Business Property Relief, and what falls outside the estate entirely.">
          <div className="sw-card" style={{
            padding: 12, background: 'var(--card-bg2)',
            border: '1px solid var(--c-border)', borderRadius: 14,
          }}>
            {/* v0.3 spec delta — AIM 50% BPR info chip */}
            <div style={{ marginBottom: 10, padding: 8,
              background: 'color-mix(in srgb, var(--c-acc) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--c-acc) 30%, transparent)',
              borderRadius: 10, fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.5,
            }}>
              <Chip tone="good">AIM · 50% BPR</Chip>
              <span style={{ marginLeft: 6 }}>
                AIM shares listed on London AIM — 50% Business Property Relief if held 2+ years (Finance Act 2026). Combined BPR/APR cap £2.5m. Non-AIM unquoted shares may qualify at 100% within cap.
              </span>
            </div>
            <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.55 }}>
              <li>Most alternatives sit in the estate at market value at date of death.</li>
              <li>BPR can apply to AIM-listed shares (50% from April 2026) and qualifying unquoted trading-company shares — up to a £1m combined BPR/APR cap from April 2026, then 50% above.</li>
              <li>EIS and SEIS holdings held &gt; 2 years can qualify for BPR (100% currently, subject to the new £1m cap from April 2026).</li>
              <li>VCTs do not qualify for BPR (listed).</li>
              <li>Lifetime gifts of chattels become PETs — 7-year clock with taper relief from year 3.</li>
              <li>Pre-eminent art donated via the Conditional Exemption scheme is removed from the estate while access conditions are met.</li>
            </ul>
          </div>
        </Section>

        {/* Section 5 — EIS/SEIS/VCT clocks */}
        {clockItems.length > 0 && (
          <Section title="5 · EIS / SEIS / VCT holding clocks"
            sub="Minimum hold to retain income-tax relief: EIS 3y · SEIS 3y · VCT 5y. Sell early and the relief is clawed back.">
            <div className="sw-card" style={{
              padding: 12, background: 'var(--card-bg2)',
              border: '1px solid var(--c-border)', borderRadius: 14,
            }}>
              <div style={{ display: 'grid', gap: 8 }}>
                {clockItems.map((it, i) => {
                  const clock = holdingClock(it.raw) || {
                    wrapper: it.type.toUpperCase(),
                    yearsHeld: 0,
                    yearsRequired: it.type === 'vct' ? 5 : 3,
                    reliefAtRisk: true,
                    status: 'in-clock',
                  }
                  const ratio = Math.min(1, clock.yearsHeld / clock.yearsRequired)
                  return (
                    <div key={it.id || i}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text)' }}>
                          {it.name}
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Chip tone="neutral">{clock.wrapper}</Chip>
                          {clock.reliefAtRisk
                            ? <Chip tone="bad">Relief at risk · {clock.yearsHeld.toFixed(1)}/{clock.yearsRequired}y</Chip>
                            : <Chip tone="good">Cleared · {clock.yearsHeld.toFixed(1)}y</Chip>}
                        </div>
                      </div>
                      <div style={{ height: 6, borderRadius: 100, background: 'var(--c-surface2)', overflow: 'hidden' }}>
                        <div style={{
                          width: `${ratio * 100}%`, height: '100%',
                          background: clock.reliefAtRisk ? '#FF9500' : 'var(--c-acc)',
                        }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </Section>
        )}

        {/* Section 6 — Valuation freshness */}
        <Section title="6 · Valuation freshness"
          sub="Alternatives have no live market price. Each value is only as current as its last valuation date.">
          <div className="sw-card" style={{
            padding: 12, background: 'var(--card-bg2)',
            border: '1px solid var(--c-border)', borderRadius: 14,
          }}>
            <div style={{ display: 'grid', gap: 6 }}>
              {items.map((it, i) => {
                const ageMs = it.lastValued ? (now - new Date(it.lastValued).getTime()) : null
                const isStale90 = ageMs !== null && ageMs > NINETY_DAYS
                const dateStr = it.lastValued || '—'
                return (
                  <div key={it.id || i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                    fontSize: 11, color: 'var(--c-text2)',
                  }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {it.name}
                    </span>
                    <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ color: 'var(--c-text3)' }}>{dateStr}</span>
                      {!it.lastValued && <Chip tone="neutral">Valuation date not recorded</Chip>}
                      {isStale90 && <Chip tone="warn">Valued &gt; 90 days ago — verify before acting</Chip>}
                    </span>
                  </div>
                )
              })}
            </div>
            {stale.length > 0 && (
              <Disclosure title="Why valuation cadence matters">
                Alternatives are illiquid: there's no continuous market quote. A holding last valued 18 months ago may bear little relation to today's market — auction comps for wine and art shift quarterly; gold and crypto move daily. The number shown on the tile is only as accurate as its last refresh.
              </Disclosure>
            )}
          </div>
        </Section>

        {/* v0.3 spec delta — Liquidity ladder (shared chart kit).
            Alternatives tier highlighted as Multi-year exit · slowest. */}
        <Section title="Liquidity ladder"
          sub="Where Alternatives sit on the household liquidity spectrum. EIS/VCT 3–7yr exit; unlisted equity decade+.">
          {(() => {
            const cashV = cashTotal(entity)
            const isaV = isaTotal(entity)
            const giaV = giaTotal(entity)
            const invFallback = (isaV + giaV) > 0 ? 0 : investmentsTotal(entity)
            const penV = pensionTotal(entity)
            const propV = propertyTotal(entity)
            return (
              <LiquidityLadder
                ariaLabel="Liquidity ladder · Alternatives is the slowest tier · multi-year exit"
                tiers={[
                  { label: 'Hours', items: cashV > 0 ? [{ name: 'Cash', value: cashV }] : [] },
                  { label: 'Days', items: [] },
                  { label: 'Weeks', items: [
                      ...(isaV > 0 ? [{ name: 'ISA', value: isaV }] : []),
                      ...(giaV > 0 ? [{ name: 'GIA', value: giaV }] : []),
                      ...(invFallback > 0 ? [{ name: 'Investments', value: invFallback }] : []),
                    ] },
                  { label: 'Months', items: [
                      ...(penV > 0 ? [{ name: 'Pension', value: penV }] : []),
                      ...(propV > 0 ? [{ name: 'Property', value: propV }] : []),
                    ] },
                  { label: 'Years', items: [
                      { name: 'Alternatives · Multi-year exit', value: total },
                    ] },
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
          domain="alternatives"
          category="alternatives"
          itemType={(selected.type || 'other').toUpperCase()}
          personaId={personaId}
          onBack={() => setSelected(null)}
          onHome={onHome}
        />
      )}
    </OverlayShell>
  )
}
