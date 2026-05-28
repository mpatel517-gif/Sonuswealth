// ─────────────────────────────────────────────────────────────────────────────
// CashFlowDrill — L3 drill panel opened from the SurplusTile hero tap.
//
// Why this exists: tapping the deficit/surplus hero used to fire `sonus:ask`,
// deflecting the user into a chat sheet when they were staring at a 4-figure
// monthly shortfall. A real decision panel belongs here, not a chat handoff.
//
// Sections:
//   1. Hero        — deficit → runway leads, deficit is sub; surplus → £/mo
//                    leads, annualised is sub. Tone reflects urgency band.
//   2. 12-mo bars  — entity.trajectories.cashflowHistory if seeded; else a
//                    single bar for this month. Anchored at zero, mint above
//                    coral below.
//   3. Sankey      — income left → spending allocation right. Re-uses the
//                    stacked-bar fallback already used on MyMoney.jsx since
//                    a real SVG sankey is out-of-scope for this pass.
//   4. Top items   — broad rows from monthlySurplus categories (essentials,
//                    debt service, committed) — granular line-item data is
//                    not on the entity shape yet, so we surface the buckets
//                    we DO have rather than fake item-level detail.
//   5. What-if     — 3 local sliders (cut essentials %, pause committed mo,
//                    refinance debt APR). Pure local state, no engine commit.
//   6. Footer      — BRAND.disclaimer (info/guidance/storage stance).
//
// Spec sources: MyMoney v2.7 §SurplusTile drill; FD-CROSS-1 (every L2 number
// owns an L3 home); founder critique 2026-05-25 (no chat deflection on hero).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import OverlayShell from '../shared/OverlayShell.jsx'
import { monthlySurplus, fmt } from '../../engine/fq-calculator.js'
import { BRAND } from '../../config/brand.js'

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

// 12-month history bar chart — anchored at zero. Mint above, coral below.
// Inline SVG. Falls back to a single bar if no history is seeded.
function HistoryBars({ data, height = 120 }) {
  const W = 320, H = height, pad = 8, axisLabelH = 14
  const plotH = H - pad - axisLabelH
  const maxAbs = Math.max(1, ...data.map(d => Math.abs(+d.value || 0)))
  const zeroY = pad + plotH / 2
  const barW = data.length > 0 ? Math.max(4, (W - pad * 2) / data.length - 3) : 0
  const monthAbbr = (i) => {
    const mo = new Date()
    mo.setMonth(mo.getMonth() - (data.length - 1 - i))
    return mo.toLocaleString('en-GB', { month: 'short' })[0]
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} aria-hidden="true" style={{ display: 'block' }}>
      {/* zero axis */}
      <line x1={pad} y1={zeroY} x2={W - pad} y2={zeroY}
        stroke="var(--c-sep)" strokeWidth="1" strokeDasharray="2,2" />
      {data.map((d, i) => {
        const v = +d.value || 0
        const h = (Math.abs(v) / maxAbs) * (plotH / 2)
        const x = pad + i * ((W - pad * 2) / data.length) + 1.5
        const y = v >= 0 ? zeroY - h : zeroY
        const color = v >= 0 ? 'var(--c-acc, #2DF2C3)' : 'var(--c-coral, #FF6F7D)'
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={Math.max(1, h)}
              fill={color} opacity="0.85" rx="2" />
            {(i === 0 || i === data.length - 1 || i % 3 === 0) && (
              <text x={x + barW / 2} y={H - 2} textAnchor="middle"
                style={{ fontSize: 8, fill: 'var(--c-text3)' }}>
                {monthAbbr(i)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// Inline stacked-bar fallback for the sankey section. A real SVG sankey is
// future work — this preserves the income → allocation read at L3.
function FlowBar({ m }) {
  const income = Math.max(m.income || 0, 1)
  const surplus = (m.surplus || 0) - (m.deficit || 0)
  const isDeficit = surplus < 0
  const segs = [
    { label: 'Essentials', v: m.essential || 0,   color: '#7AA7FF' },
    { label: 'Debt',       v: m.debtService || 0, color: '#FF6F7D' },
    { label: 'Committed',  v: m.committed || 0,   color: '#FFB347' },
  ].filter(s => s.v > 0)
  const tail = isDeficit
    ? { label: 'Shortfall', v: Math.abs(surplus), color: '#FF3B30' }
    : surplus > 0
      ? { label: 'Surplus', v: surplus, color: 'var(--c-acc, #2DF2C3)' }
      : null
  const all = tail ? [...segs, tail] : segs
  if (all.length === 0) return (
    <div style={{ fontSize: 11, color: 'var(--c-text3)', fontStyle: 'italic' }}>
      No allocation to break down yet.
    </div>
  )
  const total = Math.max(all.reduce((s, x) => s + x.v, 0), 1)
  const incomePct = isDeficit ? Math.min((income / total) * 100, 99) : null
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--c-text3)', marginBottom: 6 }}>
        Income → allocation · {fmt(income)}/mo
      </div>
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <div style={{ display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden', gap: 2 }}>
          {all.map((s, i) => (
            <div key={i} title={`${s.label}: ${fmt(s.v)}`} style={{
              flex: s.v, background: s.color,
              opacity: s.label === 'Shortfall' ? 1 : 0.85,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {(s.v / total) > 0.12 && (
                <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--c-bg, #051424)', whiteSpace: 'nowrap', padding: '0 4px' }}>
                  {fmt(s.v)}
                </span>
              )}
            </div>
          ))}
        </div>
        {incomePct != null && (
          <div title={`Income: ${fmt(income)}`} style={{
            position: 'absolute', top: -3, bottom: -3,
            left: `calc(${incomePct}% - 1px)`, width: 2,
            background: 'rgba(255,255,255,0.6)', borderRadius: 1,
          }} />
        )}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {all.map((s, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, opacity: 0.85 }} />
            <span style={{ fontSize: 10, color: 'var(--c-text3)' }}>{s.label}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-text2)', fontVariantNumeric: 'tabular-nums' }}>{fmt(s.v)}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function LineItemRow({ label, value, total, color, onAsk }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <button
      type="button"
      onClick={onAsk}
      className="sw-press"
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', borderRadius: 10,
        border: '1px solid var(--c-border)', background: 'var(--c-surface2)',
        color: 'var(--c-text)', cursor: 'pointer', marginBottom: 6,
      }}
    >
      <span style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 12, textAlign: 'left' }}>{label}</span>
      <span style={{ fontSize: 11, color: 'var(--c-text3)', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums', minWidth: 64, textAlign: 'right' }}>
        {fmt(value)}/mo
      </span>
    </button>
  )
}

function Slider({ label, value, min, max, step, format, onChange, deltaLabel }) {
  return (
    <div style={{
      background: 'var(--c-surface2)', border: '1px solid var(--c-border)',
      borderRadius: 10, padding: '10px 12px', marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text)' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--c-acc)', fontVariantNumeric: 'tabular-nums' }}>
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(+e.target.value)}
        style={{ width: '100%', accentColor: 'var(--c-acc, #2DF2C3)' }}
      />
      {deltaLabel && (
        <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
          {deltaLabel}
        </div>
      )}
    </div>
  )
}

export default function CashFlowDrill({ entity, ripple: _ripple, onClose, onHome }) {
  const m = monthlySurplus(entity)
  const surplus = (m.surplus || 0) - (m.deficit || 0)
  const isDeficit = surplus < 0
  const amt = Math.abs(surplus)

  // Runway calc — same shape as the inline tile (MyMoney.jsx L1205-1213).
  const cashLiquid = +(entity?.assets?.cash?.total || 0)
    || (entity?.assets?.cash_accounts || []).reduce((s, a) => s + (+a.balance_gbp || +a.balance || 0), 0)
    || +(entity?.assets?.cash?.value || 0)
  const monthsRunway = isDeficit && cashLiquid > 0 && amt > 0 ? cashLiquid / amt : null
  const urgent = monthsRunway != null && monthsRunway < 3
  const warn   = monthsRunway != null && monthsRunway < 6
  const heroColor = isDeficit
    ? (urgent ? 'var(--c-coral, #FF6F7D)' : warn ? '#FFB347' : 'var(--c-text)')
    : 'var(--c-acc, #2DF2C3)'

  // 12-month history — fallback to single bar if not seeded.
  const traj = entity?.trajectories?.cashflowHistory
  const history = Array.isArray(traj) && traj.length > 0
    ? traj.slice(-12).map(p => ({ value: typeof p === 'object' ? (+p.value || +p.surplus || -(+p.deficit || 0) || 0) : +p || 0 }))
    : [{ value: surplus }]

  // Top items — bucket-level rows from monthlySurplus. Granular line items
  // aren't on the entity shape yet; we surface what we DO have honestly
  // rather than faking item-level detail.
  const totalOutflow = (m.essential || 0) + (m.debtService || 0) + (m.committed || 0)
  const items = [
    { label: 'Essentials (rent, bills, food, transport)', value: m.essential || 0, color: '#7AA7FF', q: 'What are my essential bills made of?', ctx: { metric: 'essentialSpend' } },
    { label: 'Debt service (mortgage + loans)',           value: m.debtService || 0, color: '#FF6F7D', q: 'How is my debt service broken down?', ctx: { metric: 'debtService' } },
    { label: 'Committed (pension + ISA contributions)',   value: m.committed || 0, color: '#FFB347', q: 'What am I committed to pay each month?', ctx: { metric: 'committedSpend' } },
  ].filter(r => r.value > 0).sort((a, b) => b.value - a.value)

  // What-if sliders — pure local state, no engine commit.
  const [cutPct, setCutPct] = useState(0)
  const [pauseMo, setPauseMo] = useState(0)
  const [refiPct, setRefiPct] = useState(0)

  const essentialsSaved = ((m.essential || 0) * cutPct) / 100
  const committedSaved  = pauseMo > 0 ? (m.committed || 0) : 0  // pause = save this month's commit
  // Refi delta — best-effort estimate against mortgage balance.
  // Bug C fix (founder audit 2026-05-25): persona shape is
  // `liabilities.mortgage.outstanding` (not `.balance`), plus a BTL mortgage
  // typically lives inside `liabilities.otherLoans[]` with type 'btl' /
  // 'buy-to-let-mortgage' / 'mortgage'. Old detection missed both and showed
  // "no mortgage balance recorded" even with a £180k BTL on file.
  const liab = entity?.liabilities
  const primaryMortgage = +(liab?.mortgage?.outstanding ?? liab?.mortgage?.balance ?? 0) || 0
  const otherMortgageLoans = (liab?.otherLoans || [])
    .filter(l => /mortgage|btl|buy[- ]?to[- ]?let/i.test(l.type || l.name || ''))
    .reduce((s, l) => s + (+(l.outstanding ?? l.outstanding_balance ?? l.balance ?? 0) || 0), 0)
  const arrayMortgages = Array.isArray(liab)
    ? liab.filter(l => /mortgage|btl|buy[- ]?to[- ]?let/i.test(l.type || l.name || ''))
        .reduce((s, l) => s + (+(l.outstanding_balance ?? l.outstanding ?? l.balance ?? 0) || 0), 0)
    : 0
  const mortgageBalance = primaryMortgage + otherMortgageLoans + arrayMortgages
  const refiSaved = mortgageBalance > 0 ? (mortgageBalance * (refiPct / 100)) / 12 : 0
  const newSurplus = surplus + essentialsSaved + committedSaved + refiSaved

  const annualised = !isDeficit ? Math.round(amt * 12) : 0

  return (
    <OverlayShell
      title="Monthly cash flow"
      subtitle={isDeficit ? `${fmt(-amt)}/mo · ${monthsRunway != null ? `${monthsRunway < 1 ? Math.round(monthsRunway * 30) + 'd' : monthsRunway.toFixed(1) + 'mo'} runway` : 'shortfall'}` : `${fmt(amt)}/mo surplus`}
      onBack={onClose}
      onHome={onHome}
    >
      <div style={{ padding: '16px 16px 40px' }}>

        {/* ── 1. Hero ─────────────────────────────────────────────────────── */}
        <Section title="1 · Where you stand">
          <div style={{
            background: 'var(--c-surface)', border: '1px solid var(--c-border)',
            borderRadius: 14, padding: '18px 18px',
          }}>
            {isDeficit && monthsRunway != null ? (
              <>
                <div style={{ fontSize: 32, fontWeight: 800, color: heroColor, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                  {monthsRunway < 1
                    ? `${Math.round(monthsRunway * 30)} days runway`
                    : `${monthsRunway.toFixed(1)} months runway`}
                </div>
                <div style={{ fontSize: 12, color: 'var(--c-text3)', marginTop: 8, lineHeight: 1.5 }}>
                  −{fmt(amt)}/mo · liquid cash {fmt(cashLiquid)} ÷ monthly deficit
                </div>
              </>
            ) : isDeficit ? (
              <>
                <div style={{ fontSize: 32, fontWeight: 800, color: heroColor, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                  −{fmt(amt)}/mo
                </div>
                <div style={{ fontSize: 12, color: 'var(--c-text3)', marginTop: 8, lineHeight: 1.5 }}>
                  Spending exceeds income · no liquid cash recorded to compute runway
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 32, fontWeight: 800, color: heroColor, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                  +{fmt(amt)}/mo
                </div>
                <div style={{ fontSize: 12, color: 'var(--c-text3)', marginTop: 8, lineHeight: 1.5 }}>
                  {fmt(annualised)} per year to save or invest
                </div>
              </>
            )}
          </div>
        </Section>

        {/* ── 2. 12-month history ─────────────────────────────────────────── */}
        <Section title="2 · Last 12 months" sub={
          history.length > 1
            ? 'Mint = surplus month, coral = deficit month. Anchored at zero.'
            : 'No prior cashflow history seeded yet — only this month is shown. Once you keep tracking, this becomes a 12-month trend.'
        }>
          <div style={{
            background: 'var(--c-surface)', border: '1px solid var(--c-border)',
            borderRadius: 14, padding: '12px 12px 4px',
          }}>
            <HistoryBars data={history} />
          </div>
        </Section>

        {/* ── 3. This month's flow ────────────────────────────────────────── */}
        <Section title="3 · This month's flow" sub="Where your income lands. The white marker shows where income runs out — anything past it is the shortfall.">
          <div style={{
            background: 'var(--c-surface)', border: '1px solid var(--c-border)',
            borderRadius: 14, padding: '14px 16px',
          }}>
            <FlowBar m={m} />
          </div>
        </Section>

        {/* ── 4. Top spending buckets ─────────────────────────────────────── */}
        {items.length > 0 && (
          <Section
            title="4 · Biggest spending lines"
            sub="Ranked by £/month. Tap any row to ask Sonnu what's inside it. Per-item granularity (e.g. specific bills) becomes available as you upload statements."
          >
            <div>
              {items.map((it, i) => (
                <LineItemRow
                  key={i}
                  label={it.label}
                  value={it.value}
                  total={totalOutflow}
                  color={it.color}
                  onAsk={() => {
                    try {
                      window.dispatchEvent(new CustomEvent('sonus:ask', {
                        detail: { question: it.q, context: it.ctx },
                      }))
                    } catch (_) { /* no-op in non-browser */ }
                  }}
                />
              ))}
            </div>
          </Section>
        )}

        {/* ── 5. What if (sliders) ────────────────────────────────────────── */}
        <Section
          title="5 · What if you changed something"
          sub="Move the sliders. New monthly position updates live. Nothing is saved — this is a thinking sandbox, not a commit."
        >
          <div style={{
            background: 'var(--c-surface)', border: '1px solid var(--c-border)',
            borderRadius: 14, padding: '14px 16px',
          }}>
            <Slider
              label="Cut essentials by"
              value={cutPct} min={0} max={30} step={1}
              format={(v) => `${v}%`}
              onChange={setCutPct}
              deltaLabel={cutPct > 0 ? `saves ${fmt(essentialsSaved)}/mo` : 'no change'}
            />
            <Slider
              label="Pause committed contributions for"
              value={pauseMo} min={0} max={6} step={1}
              format={(v) => v === 0 ? 'no pause' : `${v} mo`}
              onChange={setPauseMo}
              deltaLabel={pauseMo > 0 ? `saves ${fmt(committedSaved)} this month (one-month figure)` : 'no change'}
            />
            <Slider
              label="Refinance debt at lower APR by"
              value={refiPct} min={0} max={3} step={0.25}
              format={(v) => `${v.toFixed(2)}pp`}
              onChange={setRefiPct}
              deltaLabel={refiPct > 0 && mortgageBalance > 0
                ? `estimated ${fmt(refiSaved)}/mo saved on mortgage interest`
                : mortgageBalance === 0 ? 'no mortgage balance recorded' : 'no change'}
            />

            <div style={{
              marginTop: 14, padding: '12px 14px', borderRadius: 10,
              background: 'var(--c-surface2)', border: '1px solid var(--c-border)',
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10,
            }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-text3)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  New monthly position
                </div>
                <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 2 }}>
                  was {surplus >= 0 ? '+' : '−'}{fmt(Math.abs(surplus))}/mo
                </div>
              </div>
              <div style={{
                fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
                color: newSurplus >= 0 ? 'var(--c-acc, #2DF2C3)' : 'var(--c-coral, #FF6F7D)',
              }}>
                {newSurplus >= 0 ? '+' : '−'}{fmt(Math.abs(Math.round(newSurplus)))}/mo
              </div>
            </div>
          </div>
        </Section>

        <p style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 16, lineHeight: 1.5, textAlign: 'center' }}>
          {BRAND.disclaimer}
        </p>
      </div>
    </OverlayShell>
  )
}
