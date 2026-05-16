// ─────────────────────────────────────────────────────────────────────────────
// TileGrid — responsive grid of CategoryTiles for the Balance Sheet pivot.
// ─────────────────────────────────────────────────────────────────────────────

import CategoryTile from './CategoryTile.jsx'
import TappableNumber from '../shared/TappableNumber.jsx'
import { prcPccSpread, fmt as engineFmt } from '../../engine/fq-calculator.js'

// M-03 fix: single source-of-truth formatter shared with TripleAnchor
// (which uses `fmt` from fq-calculator.js). Previously TileGrid had its own
// `fmt` AND rendered the NW headline through <Num format="currency"> which
// uses yet a third formatter — producing "YOU OWN £727k" alongside
// "NET WORTH £726.9k" for the same number. All three rendering paths now
// route through the engine's canonical fmt().
function fmt(v) {
  return engineFmt(v)
}

// ── TrendBox — equal-height square card for the hero metrics ─────────────────
// All boxes forced to same height via parent gridAutoRows: '1fr' + height: 100%
function TrendBox({ label, labelDetail, color, children, question, value, context }) {
  const inner = (
    <div style={{
      background: `color-mix(in srgb, ${color} 10%, var(--c-surface2))`,
      border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
      borderRadius: 10,
      padding: '8px 9px',
      height: '100%',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      minWidth: 0,
    }}>
      <div>
        <div style={{
          fontSize: 8, fontWeight: 800, color: 'var(--c-text3)',
          textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {label}
        </div>
        {labelDetail && (
          <div style={{ fontSize: 7, color: 'var(--c-text3)', opacity: 0.65, marginBottom: 3 }}>
            {labelDetail}
          </div>
        )}
      </div>
      <div style={{
        fontSize: 11, fontWeight: 800, color,
        fontVariantNumeric: 'tabular-nums', lineHeight: 1.2,
        wordBreak: 'break-word',
      }}>
        {children}
      </div>
    </div>
  )
  if (!question) return inner
  return (
    <TappableNumber value={value} display={`${label}: ${String(children)}`}
      question={question} context={context} size="chip">
      {inner}
    </TappableNumber>
  )
}

// ── Mini sparkline — Phase 3E: normalized to % change from first data point ───
// All categories now show relative movement so they're visually comparable
// regardless of absolute £ magnitude (pensions £200k vs cash £12k).
function MiniSparkline({ data, color = 'var(--c-acc)', label, width = 100, height = 24 }) {
  if (!Array.isArray(data) || data.length < 2) return null
  const W = width, H = height, pad = 2
  const raw = data.map(p => {
    const v = p != null && typeof p === 'object' ? +p.value : +p
    return Number.isFinite(v) ? v : 0
  })
  const base = Math.abs(raw[0]) > 0 ? raw[0] : (Math.abs(raw[1]) > 0 ? raw[1] : 0)
  // C-09: if base is still 0 after checking first two points, no meaningful baseline — skip normalization
  if (base === 0) return null
  // Normalized to % change from baseline — enables cross-category comparison
  const vals = raw.map(v => ((v - base) / Math.abs(base)) * 100)
  const maxV = Math.max(...vals, 0.1)
  const minV = Math.min(...vals, -0.1)
  const span = Math.max(maxV - minV, 0.2)
  const xs = vals.map((_, i) => pad + (i / (vals.length - 1)) * (W - pad * 2))
  const ys = vals.map(v => H - pad - ((v - minV) / span) * (H - pad * 2))
  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  const rising = vals[vals.length - 1] >= 0
  const lineColor = color || (rising ? 'var(--c-acc)' : 'var(--c-coral, #FF6F7D)')
  // Zero line position
  const zeroY = H - pad - ((-minV) / span) * (H - pad * 2)
  const lastPct = vals[vals.length - 1]
  return (
    <div style={{ marginTop: 6 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true" style={{ display: 'block', opacity: 0.8 }}>
        {/* Zero reference line */}
        {zeroY > pad && zeroY < H - pad && (
          <line x1={pad} y1={zeroY.toFixed(1)} x2={W - pad} y2={zeroY.toFixed(1)}
            stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" strokeDasharray="2,2" />
        )}
        <path d={path} fill="none" stroke={lineColor} strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={xs[xs.length-1]} cy={ys[ys.length-1]} r="2" fill={lineColor} />
      </svg>
      {label && (
        <div style={{ fontSize: 8, color: 'var(--c-text3)', marginTop: 1, letterSpacing: 0.3,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{label}</span>
          <span style={{ color: lastPct >= 0 ? 'var(--c-acc)' : 'var(--c-coral, #FF6F7D)', fontWeight: 700 }}>
            {lastPct >= 0 ? '+' : ''}{lastPct.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  )
}

const PRIMARY_ORDER = ['pensions', 'investments', 'property', 'business', 'protection', 'liabilities']
const SECONDARY_ORDER = ['cash', 'alternatives', 'obligations']

const ICONS = {
  pensions:     '⌂',
  investments:  '◈',
  property:     '⌖',
  business:     '⚇',
  protection:   '◐',
  cash:         '£',
  liabilities:  '⚠',
  income:       '⇡',
  alternatives: '✦',
  obligations:  '⚖',
}

export default function TileGrid({
  netWorth = 0,
  totalAssets = 0,
  totalLiabilities = 0,
  categories = [],
  trajectory = null,
  monthlyEssentials = null,
  planTarget = null,
  projection = null,
  entity = null,
  onView,
  onAdd,
}) {
  let prcPcc = null
  try { prcPcc = entity ? prcPccSpread(entity) : null } catch { prcPcc = null }

  let momDelta = null, momPct = null, yoyDelta = null, yoyPct = null
  if (Array.isArray(trajectory) && trajectory.length >= 2) {
    const last = +trajectory[trajectory.length - 1]?.value || 0
    const prev = +trajectory[trajectory.length - 2]?.value || 0
    momDelta = last - prev
    momPct = prev > 0 ? (momDelta / prev) * 100 : 0
  }
  if (Array.isArray(trajectory) && trajectory.length >= 12) {
    const last = +trajectory[trajectory.length - 1]?.value || 0
    const yearAgo = +trajectory[trajectory.length - 12]?.value || 0
    yoyDelta = last - yearAgo
    yoyPct = yearAgo > 0 ? (yoyDelta / yearAgo) * 100 : 0
  }

  const debtRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0
  const yearsCovered = monthlyEssentials && monthlyEssentials > 0 ? netWorth / (monthlyEssentials * 12) : null
  const planPct = planTarget && planTarget > 0 ? (netWorth / planTarget) * 100 : null

  // Assets trend: last-month change as a pct
  const assetsMomPct = momDelta != null && totalAssets > 0 ? (momDelta / totalAssets) * 100 : null
  const liabMomPct = momDelta != null && totalLiabilities > 0 ? (-momDelta / totalLiabilities) * 100 : null

  const map = {}
  for (const c of categories) map[c.id] = c

  // Phase 1A — Liquidity split: Liquid / Pension / Illiquid / Alternatives.
  // Liquid       = cash + investments (sellable in <5 days, no lock-in)
  // Pension      = pensions (capital locked until 57, no spending power now)
  // Illiquid     = property + business (weeks/months to convert)
  // Alternatives = crypto / wine / art / gold / PE — distinct liquidity
  //   profile from both liquid and illiquid (M-10 fix). Previously omitted,
  //   so liquid + pension + illiquid didn't sum to 100% when a persona had
  //   anything in alternatives (e.g. Mr T's wine holding vanished).
  const liquidAmt     = (map.cash?.subtotal || 0) + (map.investments?.subtotal || 0)
  const semiLiquidAmt = map.pensions?.subtotal || 0
  const illiquidAmt   = (map.property?.subtotal || 0) + (map.business?.subtotal || 0)
  const altAmt        = map.alternatives?.subtotal || 0
  // Total used as the % denominator — sum of the four buckets, not net worth.
  // Net worth subtracts liabilities + can include income flows that aren't
  // part of any liquidity bucket, which used to make percentages misleading.
  const liqTotal = liquidAmt + semiLiquidAmt + illiquidAmt + altAmt
  const liquidPct     = liqTotal > 0 ? Math.round((liquidAmt / liqTotal) * 100) : 0
  const semiLiquidPct = liqTotal > 0 ? Math.round((semiLiquidAmt / liqTotal) * 100) : 0
  const illiquidPct   = liqTotal > 0 ? Math.round((illiquidAmt / liqTotal) * 100) : 0
  const altPct        = liqTotal > 0 ? Math.max(0, 100 - liquidPct - semiLiquidPct - illiquidPct) : 0
  const primary = PRIMARY_ORDER.map(id => map[id]).filter(Boolean)
  const secondary = SECONDARY_ORDER.map(id => map[id]).filter(Boolean)

  // Build the trend boxes — collect only the ones we have data for
  const trendBoxes = []
  if (planPct != null) {
    const color = planPct >= 80 ? 'var(--c-acc)' : planPct >= 40 ? '#FFB347' : 'var(--c-coral, #FF6F7D)'
    trendBoxes.push({ key: 'plan', label: 'Plan funded', labelDetail: '% of retirement goal', color,
      question: 'What if I bumped my plan target up or down?', value: planPct,
      context: { metric: 'planPct', current: planPct },
      children: `${planPct.toFixed(0)}%` })
  }
  if (yoyDelta != null) {
    const color = yoyDelta >= 0 ? 'var(--c-acc)' : 'var(--c-coral, #FF6F7D)'
    trendBoxes.push({ key: 'yoy', label: '1-year growth', labelDetail: 'net worth change', color,
      question: 'What drove my year-on-year net worth change?', value: Math.abs(yoyDelta),
      context: { metric: 'yoyDelta', current: yoyDelta },
      children: `${yoyDelta >= 0 ? '+' : '−'}${fmt(Math.abs(yoyDelta))}${yoyPct != null ? ` (${yoyPct >= 0 ? '+' : ''}${yoyPct.toFixed(1)}%)` : ''}` })
  }
  if (momDelta != null) {
    const color = momDelta >= 0 ? 'var(--c-acc)' : 'var(--c-coral, #FF6F7D)'
    trendBoxes.push({ key: 'mom', label: 'Last month', labelDetail: 'net worth change', color,
      question: 'What contributed to last month\'s change in net worth?', value: Math.abs(momDelta),
      context: { metric: 'momDelta', current: momDelta },
      children: `${momDelta >= 0 ? '+' : '−'}${fmt(Math.abs(momDelta))}${momPct != null ? ` (${momPct >= 0 ? '+' : ''}${momPct.toFixed(1)}%)` : ''}` })
  }
  {
    const color = debtRatio > 50 ? 'var(--c-coral, #FF6F7D)' : debtRatio > 30 ? '#FFB347' : 'var(--c-acc)'
    trendBoxes.push({ key: 'debt', label: 'Debt ratio', labelDetail: 'debt as % of assets', color,
      question: 'What if I paid down debt faster — how would my structural ratio shift?', value: debtRatio,
      context: { metric: 'debtRatio', current: debtRatio },
      children: `${debtRatio.toFixed(0)}%` })
  }
  if (yearsCovered != null) {
    trendBoxes.push({ key: 'runway', label: 'Time covered', labelDetail: 'wealth ÷ annual spending', color: 'var(--c-acc)',
      question: 'What if my essential spending rose — how much runway would I still have?', value: yearsCovered,
      context: { metric: 'yearsCovered', current: yearsCovered },
      children: yearsCovered >= 1 ? `${yearsCovered.toFixed(1)} yr` : `${(yearsCovered * 12).toFixed(0)} mo` })
  }
  if (prcPcc) {
    const color = prcPcc.band === 'STRONG' || prcPcc.band === 'COMFORTABLE' ? 'var(--c-acc)' : prcPcc.band === 'TIGHT' ? '#FFB347' : 'var(--c-coral, #FF6F7D)'
    trendBoxes.push({ key: 'cushion', label: 'Income buffer', labelDetail: 'income vs commitments', color,
      question: 'What if income dropped or outgoings rose — how thin would my buffer get?', value: prcPcc.spread,
      context: { metric: 'prcPcc', prc: prcPcc.prc, pcc: prcPcc.pcc },
      children: `${prcPcc.ratio.toFixed(1)}×` })
  }

  // Arrange into 2-col grid: pair them up
  const cols = 2
  const rows = Math.ceil(trendBoxes.length / cols)

  return (
    <div style={{ marginBottom: 16 }}>
      {/* ── Balance sheet hero card ──────────────────────────────────────── */}
      <div className="sw-card sw-card-elevated sw-cinema" style={{
        padding: 18,
        background: `linear-gradient(180deg, color-mix(in srgb, var(--c-acc) 14%, var(--card-bg2)), color-mix(in srgb, var(--c-acc) 4%, var(--card-bg2)))`,
        border: '1px solid color-mix(in srgb, var(--c-acc) 28%, transparent)',
        borderRadius: 'var(--r-lg, 20px)',
        boxShadow: 'var(--sh2), 0 0 24px color-mix(in srgb, var(--c-acc) 18%, transparent)',
        marginBottom: 12,
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>

          {/* Left — NW headline + sparkline + Assets / Liabilities */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sw-eyebrow" style={{ marginBottom: 4 }}>Balance sheet</div>
            <div style={{
              fontSize: 9, fontWeight: 800, color: 'var(--c-text3)',
              letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 2,
            }}>
              Net worth{projection ? ` · ${projection.viewMode || 'forecast'} · ${projection.windowLabel}` : ''}
            </div>
            <div style={{
              fontSize: 'clamp(28px, 4vw, 40px)',
              fontWeight: 880, color: 'var(--c-text)',
              letterSpacing: -0.5, lineHeight: 1.05,
              fontVariantNumeric: 'tabular-nums',
              textShadow: '0 0 18px var(--c-radar-glow)',
            }}>
              <TappableNumber
                value={netWorth}
                size="hero"
                question="What if my net worth grew faster — or slower — than the current trajectory?"
                context={{ metric: 'netWorth', current: netWorth, projection }}
              >
                {/* M-03 fix: render through engine fmt() so the hero number
                    is character-identical to the TripleAnchor "You own" tile
                    immediately above. Was <Num format="currency"/> which gave
                    "£727.0k" while TripleAnchor gave "£727k". */}
                {fmt(netWorth)}
              </TappableNumber>
            </div>

            {/* 12-month NW sparkline — trajectory trend */}
            <MiniSparkline
              data={trajectory}
              color={momDelta == null || momDelta >= 0 ? 'var(--c-acc)' : 'var(--c-coral, #FF6F7D)'}
              label="12-month net worth"
              width={110}
              height={22}
            />

            {/* Phase 1A — Liquidity split: what you can actually access.
                M-10 fix: alternatives bucket now rendered alongside
                liquid / pension / illiquid so liquid + pension + illiquid +
                alt = 100% on every persona. */}
            {(liquidAmt > 0 || semiLiquidAmt > 0 || illiquidAmt > 0 || altAmt > 0) && (
              <div style={{ marginTop: 8, marginBottom: 2 }}>
                <div style={{ fontSize: 8, fontWeight: 800, color: 'var(--c-text3)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 5 }}>
                  What you can access
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {liquidAmt > 0 && (
                    <div title="Cash + investments — accessible in days" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--c-acc)', display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontSize: 9, color: 'var(--c-text3)' }}>Liquid</span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--c-acc)', fontVariantNumeric: 'tabular-nums' }}>{fmt(liquidAmt)}</span>
                    </div>
                  )}
                  {semiLiquidAmt > 0 && (
                    <div title="Pension — locked until age 57" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: '#7AA7FF', display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontSize: 9, color: 'var(--c-text3)' }}>Pension</span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#7AA7FF', fontVariantNumeric: 'tabular-nums' }}>{fmt(semiLiquidAmt)}</span>
                    </div>
                  )}
                  {illiquidAmt > 0 && (
                    <div title="Property + business — weeks/months to sell" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: '#FFB347', display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontSize: 9, color: 'var(--c-text3)' }}>Illiquid</span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#FFB347', fontVariantNumeric: 'tabular-nums' }}>{fmt(illiquidAmt)}</span>
                    </div>
                  )}
                  {altAmt > 0 && (
                    <div title="Alternatives — crypto, wine, art, gold, PE" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: '#BA8CFF', display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontSize: 9, color: 'var(--c-text3)' }}>Alt</span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#BA8CFF', fontVariantNumeric: 'tabular-nums' }}>{fmt(altAmt)}</span>
                    </div>
                  )}
                </div>
                {/* Proportional liquidity bar — % computed off liqTotal so the
                    four segments always sum to 100% (M-10 fix). */}
                <div style={{ display: 'flex', height: 3, borderRadius: 100, overflow: 'hidden', marginTop: 5, background: 'var(--c-surface2)', gap: 1 }}>
                  {liquidAmt > 0     && <div style={{ width: `${liquidPct}%`,     background: 'var(--c-acc)' }} />}
                  {semiLiquidAmt > 0 && <div style={{ width: `${semiLiquidPct}%`, background: '#7AA7FF'      }} />}
                  {illiquidAmt > 0   && <div style={{ width: `${illiquidPct}%`,   background: '#FFB347'      }} />}
                  {altAmt > 0        && <div style={{ width: `${altPct}%`,        background: '#BA8CFF'      }} />}
                </div>
              </div>
            )}

            {projection && projection.currentValue != null && (
              <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 6 }}>
                vs today:{' '}
                <span style={{
                  fontWeight: 700,
                  color: netWorth >= projection.currentValue ? 'var(--c-acc)' : 'var(--c-coral, #FF6F7D)',
                }}>
                  {netWorth >= projection.currentValue ? '+' : '−'}{fmt(Math.abs(netWorth - projection.currentValue))}
                </span>
                {' '}· {projection.confidence} confidence
              </div>
            )}

            {/* Assets + Liabilities with trend arrows */}
            <div style={{ display: 'flex', gap: 20, marginTop: 14 }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--c-text3)',
                  letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 3 }}>
                  Assets
                  {assetsMomPct != null && (
                    <span style={{
                      fontSize: 8, fontWeight: 700, marginLeft: 4,
                      color: assetsMomPct >= 0 ? 'var(--c-acc)' : 'var(--c-coral, #FF6F7D)',
                    }}>
                      {assetsMomPct >= 0 ? '↑' : '↓'}{Math.abs(assetsMomPct).toFixed(1)}%
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--c-acc)',
                  fontVariantNumeric: 'tabular-nums' }}>
                  <TappableNumber value={totalAssets} display={fmt(totalAssets)} size="hero"
                    question="What if I shifted my asset mix — more pensions, less property?"
                    context={{ metric: 'totalAssets', current: totalAssets }}>
                    {fmt(totalAssets)}
                  </TappableNumber>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--c-text3)',
                  letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 3 }}>
                  Liabilities
                  {liabMomPct != null && (
                    <span style={{
                      fontSize: 8, fontWeight: 700, marginLeft: 4,
                      color: liabMomPct >= 0 ? 'var(--c-acc)' : 'var(--c-coral, #FF6F7D)',
                    }}>
                      {liabMomPct >= 0 ? '↓' : '↑'}{Math.abs(liabMomPct).toFixed(1)}%
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--c-coral, #FF6F7D)',
                  fontVariantNumeric: 'tabular-nums' }}>
                  <TappableNumber value={totalLiabilities} display={`−${fmt(totalLiabilities)}`} size="hero"
                    question="What if I overpaid debt — how much faster would I clear it?"
                    context={{ metric: 'totalLiabilities', current: totalLiabilities }}>
                    −{fmt(totalLiabilities)}
                  </TappableNumber>
                </div>
              </div>
            </div>
          </div>

          {/* Right — equal-height trend metric boxes */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: `repeat(${rows}, 1fr)`,
            gap: 6,
            flexShrink: 0,
            alignSelf: 'stretch',
            width: 180,
          }}>
            {trendBoxes.map(b => (
              <TrendBox
                key={b.key}
                label={b.label}
                labelDetail={b.labelDetail}
                color={b.color}
                question={b.question}
                value={b.value}
                context={b.context}
              >
                {b.children}
              </TrendBox>
            ))}
          </div>
        </div>
      </div>

      {/* Phase 3B — NW Waterfall: month-on-month attribution chart.
          M-01 fix: previously the waterfall attributed the entire MoM delta
          to the three highest positive asset categories only (pensions /
          investments / property). Liabilities, cash, alternatives, business
          and any unattributable residual were silently omitted — so Opening
          + Σ(bars) ≠ Closing on every persona. The waterfall now includes
          ALL primary asset categories, liability changes (when negative
          implies pay-down i.e. positive NW contribution), and an explicit
          "Unattributed" bar absorbing the residual so the bars always
          reconcile: Opening + Σ(deltas) = Closing. */}
      {Array.isArray(trajectory) && trajectory.length >= 2 && momDelta != null && (() => {
        const prev = +trajectory[trajectory.length - 2]?.value || 0
        const curr = +trajectory[trajectory.length - 1]?.value || 0
        const totalDelta = curr - prev

        // Pro-rata attribution of the MoM delta across ALL meaningful balance
        // -sheet components. Using subtotal weights is still an estimate (we
        // don't have per-category time series for Mr T's fixture) but at
        // least every component participates, and the residual is shown
        // honestly rather than hidden.
        const pensionSub = map.pensions?.subtotal     || 0
        const investSub  = map.investments?.subtotal  || 0
        const propSub    = map.property?.subtotal     || 0
        const cashSub    = map.cash?.subtotal         || 0
        const businessSub= map.business?.subtotal     || 0
        const altSub     = map.alternatives?.subtotal || 0
        const liabAbs    = Math.abs(totalLiabilities || 0)

        const weightedTotal = pensionSub + investSub + propSub + cashSub + businessSub + altSub + liabAbs
        if (totalDelta === 0 && weightedTotal === 0) return null

        // Attribute the delta proportionally — for every component, the
        // share of the delta = (weight / totalWeight) × totalDelta. Positive
        // totalDelta → positive shares; negative totalDelta → negative
        // shares. This handles both growth and decline symmetrically and
        // lets liabilities show up as a positive bar when paid down.
        const share = (w) => weightedTotal > 0 ? (w / weightedTotal) * totalDelta : 0
        const attrBars = [
          { label: 'Pensions',      value: share(pensionSub),  color: '#7AA7FF' },
          { label: 'Investments',   value: share(investSub),   color: 'var(--c-acc)' },
          { label: 'Property',      value: share(propSub),     color: '#FFB347' },
          { label: 'Cash',          value: share(cashSub),     color: '#34C759' },
          { label: 'Business',      value: share(businessSub), color: 'var(--c-acc)' },
          { label: 'Alternatives',  value: share(altSub),      color: '#BA8CFF' },
          // Liabilities: a reduction in debt is a positive NW contribution.
          // We use the absolute weight; the sign of the share follows
          // totalDelta. For a more honest read, label is "Debt change".
          { label: 'Debt change',   value: share(liabAbs),     color: 'var(--c-coral, #FF6F7D)' },
        ].filter(b => Math.abs(b.value) >= 1)  // drop pennies

        const attributed = attrBars.reduce((s, b) => s + b.value, 0)
        const residual = totalDelta - attributed
        if (Math.abs(residual) >= 1) {
          attrBars.push({
            label: 'Unattributed',
            value: residual,
            color: 'var(--c-text3)',
          })
        }

        const bars = [
          { label: 'Opening', value: prev, isBase: true, color: 'var(--c-text3)' },
          ...attrBars,
          { label: 'Closing', value: curr, isBase: true,
            color: totalDelta >= 0 ? 'var(--c-acc)' : 'var(--c-coral, #FF6F7D)' },
        ]

        const maxVal = Math.max(...bars.map(b => Math.abs(b.isBase ? b.value : b.value) + (b.isBase ? 0 : prev)))
        const barMaxW = 100  // % width for the widest bar

        return (
          <div style={{
            background: 'var(--c-surface)', border: '1px solid var(--c-border)',
            borderRadius: 14, padding: '14px 16px', marginBottom: 12,
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--c-text3)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10 }}>
              What moved your net worth this month
            </div>
            {bars.map((b, i) => {
              const barW = b.isBase
                ? (b.value / maxVal) * barMaxW
                : (Math.abs(b.value) / maxVal) * barMaxW
              const isPos = b.value >= 0
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 72, fontSize: 9, color: 'var(--c-text3)', textAlign: 'right', flexShrink: 0 }}>
                    {b.label}
                  </div>
                  <div style={{ flex: 1, position: 'relative', height: 18 }}>
                    <div style={{
                      position: 'absolute',
                      [isPos ? 'left' : 'right']: 0,
                      width: `${barW}%`,
                      height: '100%',
                      background: b.isBase ? `color-mix(in srgb, ${b.color} 30%, var(--c-surface2))` : b.color,
                      borderRadius: 3,
                      opacity: 0.85,
                    }} />
                  </div>
                  <div style={{ width: 52, fontSize: 9, fontWeight: 700, color: b.color, textAlign: 'right', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {b.isBase ? fmt(b.value) : `${isPos ? '+' : '−'}${fmt(Math.abs(b.value))}`}
                  </div>
                </div>
              )
            })}
            <div style={{ fontSize: 9, color: 'var(--c-text3)', marginTop: 4, fontStyle: 'italic' }}>
              Bars reconcile: Opening + Σ(changes) = Closing. Estimated
              attribution based on asset class proportions; "Unattributed"
              absorbs the residual from any movement not yet wired to
              per-category history.
            </div>
          </div>
        )
      })()}

      {/* ── All 9 category tiles in one unified grid ──────────────────────── */}
      <div className="sw-tile-grid sw-tile-grid-3" style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: 10,
        marginBottom: 12,
      }}>
        {[...primary, ...secondary].map((c, i) => (
          <div key={c.id} style={{ animationDelay: `${i * 60}ms` }}>
            <CategoryTile
              id={c.id}
              icon={ICONS[c.id]}
              label={c.label}
              domainCodes={c.domainCodes}
              rows={c.rows}
              subtotal={c.subtotal}
              changePct={c.changePct}
              status={c.status}
              contextLine={c.contextLine}
              liability={c.liability}
              empty={c.empty}
              series={c.series}
              costOfInaction={c.costOfInaction}
              onView={() => onView?.(c.id)}
              onAdd={onAdd}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
