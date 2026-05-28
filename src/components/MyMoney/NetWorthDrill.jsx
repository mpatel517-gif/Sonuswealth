// ─────────────────────────────────────────────────────────────────────────────
// NetWorthDrill — L3 drill panel opened from the TripleAnchor net-worth tap.
//
// Surfaces:
//   1. Hero      — current NW, MoM delta chip, 12-mo sparkline of
//                  entity.trajectories.netWorthHistory
//   2. What moved — month-on-month attribution bars (relocated from L2
//                  TileGrid; same math, just lifted into the drill so the
//                  L2 stays scan-friendly and the detail is one tap away)
//   3. Components — assets vs liabilities split using ripple.balance_sheet
//                  .categories (pensions / ISA / GIA / property / cash /
//                  liabilities)
//   4. Footer    — BRAND.disclaimer (info/guidance/storage stance)
//
// Spec sources: MyMoney v2.7 §Net-worth drill; FD-CROSS-1 (every L2 number
// has an L3 home); macOS principle (simple surface, depth on tap).
// ─────────────────────────────────────────────────────────────────────────────
import OverlayShell from '../shared/OverlayShell.jsx'
import { BRAND } from '../../config/brand.js'

function fmt(v) {
  const n = Math.round(+v || 0)
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${n < 0 ? '−' : ''}£${(abs / 1_000_000).toFixed(2)}m`
  if (abs >= 1_000)     return `${n < 0 ? '−' : ''}£${(abs / 1_000).toFixed(0)}k`
  return `${n < 0 ? '−' : ''}£${abs.toLocaleString()}`
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

// 12-mo SVG sparkline of raw NW values (absolute, not normalized — drill is
// the right place to see actual trajectory, unlike the cross-category L2
// sparklines which are normalized for comparability).
function NWSparkline({ data, width = 320, height = 80 }) {
  if (!Array.isArray(data) || data.length < 2) return null
  const W = width, H = height, pad = 4
  const vals = data.map(p => {
    const v = p != null && typeof p === 'object' ? +p.value : +p
    return Number.isFinite(v) ? v : 0
  })
  const maxV = Math.max(...vals)
  const minV = Math.min(...vals)
  const span = Math.max(maxV - minV, 1)
  const xs = vals.map((_, i) => pad + (i / (vals.length - 1)) * (W - pad * 2))
  const ys = vals.map(v => H - pad - ((v - minV) / span) * (H - pad * 2))
  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  const areaPath = `${path} L${xs[xs.length - 1].toFixed(1)},${(H - pad).toFixed(1)} L${xs[0].toFixed(1)},${(H - pad).toFixed(1)} Z`
  const rising = vals[vals.length - 1] >= vals[0]
  const stroke = rising ? 'var(--c-acc)' : 'var(--c-coral, #FF6F7D)'
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} aria-hidden="true" style={{ display: 'block', marginTop: 8 }}>
      <path d={areaPath} fill={stroke} fillOpacity="0.12" />
      <path d={path} fill="none" stroke={stroke} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="3" fill={stroke} />
    </svg>
  )
}

export default function NetWorthDrill({ entity, ripple, onClose, onHome }) {
  const traj = entity?.trajectories?.netWorthHistory || []
  const curr = ripple?.balance_sheet?.netWorth ?? (traj.length ? (+traj[traj.length - 1]?.value || +traj[traj.length - 1] || 0) : 0)
  const prev = traj.length >= 2 ? (+traj[traj.length - 2]?.value || +traj[traj.length - 2] || 0) : 0
  const totalDelta = curr - prev

  const cats = ripple?.balance_sheet?.categories || {}
  const pensions = +cats.pensions || 0
  const isa = +cats.isa || 0
  const gia = +cats.gia || 0
  const property = +cats.property || 0
  const cash = +cats.cash || 0
  const liabilities = +cats.liabilities || 0
  const totalAssets = pensions + isa + gia + property + cash

  // Attribution math — same shape as the relocated L2 block, but driven off
  // the balance-sheet categories from ripple (rather than the legacy `map`
  // local in TileGrid). The intent is identical: every component participates,
  // residual is shown honestly, bars reconcile.
  const weightedTotal = pensions + isa + gia + property + cash + Math.abs(liabilities)
  const share = (w) => weightedTotal > 0 ? (w / weightedTotal) * totalDelta : 0
  const attrBars = [
    { label: 'Pensions',      value: share(pensions), color: '#7AA7FF' },
    { label: 'ISA',           value: share(isa),      color: 'var(--c-acc)' },
    { label: 'GIA',           value: share(gia),      color: 'var(--c-acc)' },
    { label: 'Property',      value: share(property), color: '#FFB347' },
    { label: 'Cash',          value: share(cash),     color: '#34C759' },
    { label: 'Debt change',   value: share(Math.abs(liabilities)), color: 'var(--c-coral, #FF6F7D)' },
  ].filter(b => Math.abs(b.value) >= 1)
  const attributed = attrBars.reduce((s, b) => s + b.value, 0)
  const residual = totalDelta - attributed
  if (Math.abs(residual) >= 1) {
    attrBars.push({ label: 'Unattributed', value: residual, color: 'var(--c-text3)' })
  }
  const maxDelta = Math.max(1, ...attrBars.map(b => Math.abs(b.value)))
  const barMaxW = 100

  const components = [
    { label: 'Pensions',    value: pensions, color: '#7AA7FF' },
    { label: 'ISA',         value: isa,      color: 'var(--c-acc)' },
    { label: 'GIA',         value: gia,      color: 'var(--c-acc)' },
    { label: 'Property',    value: property, color: '#FFB347' },
    { label: 'Cash',        value: cash,     color: '#34C759' },
  ].filter(c => c.value > 0)

  const deltaPct = prev > 0 ? (totalDelta / prev) * 100 : 0
  const deltaSign = totalDelta >= 0 ? '+' : '−'
  const deltaColor = totalDelta >= 0 ? 'var(--c-acc)' : 'var(--c-coral, #FF6F7D)'

  return (
    <OverlayShell
      title="Net worth · this month"
      subtitle={`${fmt(curr)} · ${deltaSign}${fmt(Math.abs(totalDelta))} MoM`}
      onBack={onClose}
      onHome={onHome}
    >
      <div style={{ padding: '16px 16px 40px' }}>

        {/* ── 1. Hero ─────────────────────────────────────────────────────── */}
        <Section title="1 · Where you stand">
          <div style={{
            background: 'var(--c-surface)', border: '1px solid var(--c-border)',
            borderRadius: 14, padding: '16px 18px',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {fmt(curr)}
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 100,
                background: `color-mix(in srgb, ${deltaColor} 14%, transparent)`,
                color: deltaColor,
                fontSize: 12, fontWeight: 800, letterSpacing: 0.4,
                border: `1px solid color-mix(in srgb, ${deltaColor} 30%, transparent)`,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {deltaSign}{fmt(Math.abs(totalDelta))}
                {prev > 0 && <span style={{ opacity: 0.8, marginLeft: 2 }}>· {deltaSign}{Math.abs(deltaPct).toFixed(1)}%</span>}
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
              {fmt(prev)} → {fmt(curr)} · last 12 months
            </div>
            <NWSparkline data={traj.slice(-12)} />
          </div>
        </Section>

        {/* ── 2. What moved this month ────────────────────────────────────── */}
        {attrBars.length > 0 && (
          <Section
            title="2 · What moved this month"
            sub="Pro-rata attribution across the balance sheet. Bars reconcile: Opening + Σ(changes) = Closing. Estimated split based on category weights; “Unattributed” absorbs any residual not yet wired to per-category history."
          >
            <div style={{
              background: 'var(--c-surface)', border: '1px solid var(--c-border)',
              borderRadius: 14, padding: '14px 16px',
            }}>
              {attrBars.map((b, i) => {
                const barW = (Math.abs(b.value) / maxDelta) * barMaxW
                const isPos = b.value >= 0
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 84, fontSize: 11, color: 'var(--c-text3)', textAlign: 'right', flexShrink: 0 }}>
                      {b.label}
                    </div>
                    <div style={{ flex: 1, position: 'relative', height: 20 }}>
                      <div style={{
                        position: 'absolute',
                        [isPos ? 'left' : 'right']: 0,
                        width: `${barW}%`,
                        height: '100%',
                        background: b.color,
                        borderRadius: 4,
                        opacity: 0.85,
                      }} />
                    </div>
                    <div style={{ width: 64, fontSize: 11, fontWeight: 700, color: b.color, textAlign: 'right', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                      {`${isPos ? '+' : '−'}${fmt(Math.abs(b.value))}`}
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>
        )}

        {/* ── 3. Components ───────────────────────────────────────────────── */}
        <Section title="3 · Components" sub="What the net-worth number is made of, right now.">
          <div style={{
            background: 'var(--c-surface)', border: '1px solid var(--c-border)',
            borderRadius: 14, padding: '12px 16px',
          }}>
            {components.map((c, i) => (
              <div key={c.label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: i < components.length - 1 ? '1px solid var(--c-border)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color }} />
                  <span style={{ fontSize: 12, color: 'var(--c-text2)' }}>{c.label}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(c.value)}
                </span>
              </div>
            ))}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '10px 0 4px', marginTop: 4,
              borderTop: '1px solid var(--c-border)',
            }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--c-text3)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Total assets
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-acc)', fontVariantNumeric: 'tabular-nums' }}>
                {fmt(totalAssets)}
              </span>
            </div>
            {liabilities > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--c-text3)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  Liabilities
                </span>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-coral, #FF6F7D)', fontVariantNumeric: 'tabular-nums' }}>
                  −{fmt(liabilities)}
                </span>
              </div>
            )}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '8px 0 0', marginTop: 4,
              borderTop: '2px solid var(--c-border)',
            }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--c-text)' }}>
                Net worth
              </span>
              <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>
                {fmt(curr)}
              </span>
            </div>
          </div>
        </Section>

        <p style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 16, lineHeight: 1.5 }}>
          {BRAND.disclaimer}
        </p>
      </div>
    </OverlayShell>
  )
}
