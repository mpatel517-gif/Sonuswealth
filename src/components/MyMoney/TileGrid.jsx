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
  // Founder UX pass 4 (2026-05-26): the previous wrapper used size="chip" which
  // rendered the ⚡ bolt as a sibling node *next to* the tile via inline-flex,
  // making each tile narrower than its neighbour and breaking symmetry. The
  // corner-badge mode positions the bolt as an absolute top-right notification
  // dot inside the tile so every tile renders at equal width.
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
          paddingRight: 18,  // reserve space for corner bolt so labels don't collide
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
      question={question} context={context} size="corner">
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
  // Asset/liab MoM percentages were used by the inline ASSETS / LIABILITIES
  // block in the hero card, removed 2026-05-25 (founder audit round 6).
  // Kept as `_`-prefixed to flag the math is still derivable if the inline
  // block is ever resurrected — but they're not rendered today.
  const _assetsMomPct = momDelta != null && totalAssets > 0 ? (momDelta / totalAssets) * 100 : null
  const _liabMomPct = momDelta != null && totalLiabilities > 0 ? (-momDelta / totalLiabilities) * 100 : null
  void _assetsMomPct; void _liabMomPct;

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
  // Founder 2026-05-31: "only show what a person has." A category with no
  // holdings is NOT rendered as a (necessarily hollow) tile — discovery happens
  // through the Add-category control, and a newly-added category then takes its
  // place here. This removes the empty Business/Alternatives/Protection boxes
  // that competed with real holdings for attention.
  const hasData = (c) => !!c && ((Array.isArray(c.rows) && c.rows.length > 0) || +c.subtotal > 0)
  const primary = PRIMARY_ORDER.map(id => map[id]).filter(hasData)
  const secondary = SECONDARY_ORDER.map(id => map[id]).filter(hasData)

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
      children: yearsCovered >= 20 ? `20+ yr` : yearsCovered >= 1 ? `${yearsCovered.toFixed(1)} yr` : `${(yearsCovered * 12).toFixed(0)} mo` })
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
        {/* Founder UX pass 2 (2026-05-26): vertical stack — eyebrow +
            sparkline ribbon at top, metric tiles as ONE equal-width horizontal
            strip in the middle, WHAT YOU CAN ACCESS legend + bar at the
            bottom. Replaces the previous flex-row that put 6 metric tiles in a
            cramped 180px column to the right of the sparkline — visually
            asymmetric, hard to scan on mobile, and broke the layout's rhythm. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Row 1 — slim eyebrow + 12-month NW sparkline only.
              Founder fix 2026-05-26 (triple-NW): the £698k figure was rendering
              here AND in the FinancesHeroCard strip above AND in the X28 score
              chip. Three surfaces for one number. Removed the hero £ and the
              "+£6k this month" delta from this card; the strip is now the
              single canonical NW surface. Sparkline + delta context kept since
              they describe the *trend* not the value. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              <div className="sw-eyebrow" style={{ marginBottom: 2 }}>Balance sheet</div>
              <div style={{
                fontSize: 9, fontWeight: 800, color: 'var(--c-text3)',
                letterSpacing: 0.6, textTransform: 'uppercase',
              }}>
                Net worth trend{projection ? ` · ${projection.viewMode || 'forecast'} · ${projection.windowLabel}` : ''}
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                window.dispatchEvent(new CustomEvent('sonus:ask', {
                  detail: {
                    question: 'How did my net worth move over this period?',
                    context: { metric: 'netWorth', view: 'trend', trajectory },
                  },
                }))
              }}
              aria-label="Drill into net worth trend"
              title="Tap to ask Sonu about this trend"
              style={{
                background: 'none', border: 'none', padding: 0,
                cursor: 'pointer', display: 'flex', alignItems: 'center',
              }}
            >
              {(() => {
                const last12 = Array.isArray(trajectory) ? trajectory.slice(-12) : trajectory
                return (
                  <MiniSparkline
                    data={last12}
                    color={momDelta == null || momDelta >= 0 ? 'var(--c-acc)' : 'var(--c-coral, #FF6F7D)'}
                    label="12-month net worth"
                    width={140}
                    height={28}
                  />
                )
              })()}
            </button>
          </div>

          {/* Row 2 — Equal-width metric tiles strip (was crammed in a 180px
              column to the right of the sparkline). Now full-width, all tiles
              the same size, all on the same baseline. */}
          {trendBoxes.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.min(trendBoxes.length, 6)}, 1fr)`,
              gap: 6,
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
          )}

          {/* F-5 fix (2026-05-26 snap audit): "What you can access · liquidity
              timeline" is the third composition view on a single Balance Sheet
              surface — competing with the Marimekko signature above and the
              now-removed wrapper bar (F-4). Per spec §3 v0.3.1, liquidity
              should be encoded in the Marimekko legend overlay, not as a
              separate widget. Section gated to `false` to preserve the legacy
              logic below for safe re-enable, but the UI shows ZERO sections
              from this block. (Founder-grep proof: `WHAT YOU CAN ACCESS`
              should not appear in the rendered DOM after this gate.) */}
          {false && (
          <div style={{ minWidth: 0 }}>
            {(liquidAmt > 0 || semiLiquidAmt > 0 || illiquidAmt > 0 || altAmt > 0) && (() => {
              // Founder direction (Wave 0.6): "the buttons on the right look horrible —
              // place them in above the line and make them equal." Chips now render
              // as equal-width buttons in a grid, above the proportional bar.
              const segs = [
                liquidAmt > 0     && { key: 'liquid',     view: 'cash',         label: 'Liquid',   amt: liquidAmt,     color: 'var(--c-acc)', title: 'Cash + investments — accessible in days' },
                semiLiquidAmt > 0 && { key: 'pension',    view: 'pensions',     label: 'Pension',  amt: semiLiquidAmt, color: '#7AA7FF',      title: 'Pension — locked until age 57' },
                illiquidAmt > 0   && { key: 'illiquid',   view: 'property',     label: 'Illiquid', amt: illiquidAmt,   color: '#FFB347',      title: 'Property + business — weeks/months to sell' },
                altAmt > 0        && { key: 'alt',        view: 'alternatives', label: 'Alt',      amt: altAmt,        color: '#BA8CFF',      title: 'Alternatives — crypto, wine, art, gold, PE' },
              ].filter(Boolean)
              const chipBtn = {
                background: 'none', border: 'none', padding: '6px 8px',
                cursor: 'pointer', borderRadius: 8, color: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 4, minHeight: 36, width: '100%',
                transition: 'background 0.15s ease',
              }
              // HIGH-2: WHAT YOU CAN ACCESS amounts duplicated the wrapper bar
              // (HOW YOUR MONEY IS HELD) and category tiles — same £850k pension
              // shown 3 times on one screen. Reduce L1 to a labelled bar + dot
              // legend (no amounts). Amount + tap-to-drill stays via title + click.
              return (
                <div style={{ marginTop: 8, marginBottom: 2 }}>
                  <div style={{ fontSize: 8, fontWeight: 800, color: 'var(--c-text3)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 5 }}>
                    What you can access · liquidity timeline
                  </div>
                  {/* Compact legend — dots + labels only, no £ amounts (deduped vs wrapper bar). */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                    {segs.map(s => (
                      <button
                        key={s.key}
                        type="button"
                        title={`${s.label}: ${fmt(s.amt)} — tap to drill`}
                        onClick={(e) => { e.stopPropagation(); onView?.(s.view) }}
                        className="sw-press"
                        style={{
                          background: 'none', border: 'none', padding: '2px 4px',
                          cursor: 'pointer', borderRadius: 4, color: 'inherit',
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ fontSize: 10, color: 'var(--c-text2)' }}>{s.label}</span>
                      </button>
                    ))}
                  </div>
                  {/* Proportional liquidity bar — segments tappable. */}
                  <div style={{ display: 'flex', height: 6, borderRadius: 100, overflow: 'hidden', marginTop: 2, background: 'var(--c-surface2)', gap: 1 }}>
                    {segs.map(s => {
                      const pct = s.key === 'liquid' ? liquidPct
                        : s.key === 'pension' ? semiLiquidPct
                        : s.key === 'illiquid' ? illiquidPct
                        : altPct
                      return (
                        <button
                          key={s.key}
                          type="button"
                          aria-label={`${s.label}: ${fmt(s.amt)} — open detail`}
                          title={`${s.label}: ${fmt(s.amt)}`}
                          onClick={(e) => { e.stopPropagation(); onView?.(s.view) }}
                          style={{
                            width: `${pct}%`, background: s.color,
                            border: 'none', padding: 0, cursor: 'pointer',
                            height: '100%',
                          }}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })()}

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

          </div>
          )}{/* end F-5 disabled liquidity-timeline block */}
        </div>
      </div>

      {/* NW MoM attribution block — RELOCATED to NetWorthDrill (L3 panel,
          opened by tapping the NW number in TripleAnchor). Founder feedback:
          the attribution belongs in the drill, not on the scan-friendly L2.
          Same math + bars now live in
          src/components/MyMoney/NetWorthDrill.jsx (Section 2). Do not
          re-add inline here — L2 stays clean. */}

      {/* ── All 9 category tiles in one unified grid ──────────────────────── */}
      <div className="sw-tile-grid sw-tile-grid-3" style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: 10,
        marginBottom: 12,
      }}>
        {[...primary, ...secondary].map((c, i) => (
          <div key={c.id} style={{ animationDelay: `${i * 60}ms`, height: '100%' }}>
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
              trendSeries={c.trendSeries}
              trajectory={c.trajectory}
              activeLens={projection?.viewMode === 'plan' ? 'plan' : projection?.viewMode === 'forecast' ? 'future' : 'now'}
              horizonLabel={projection?.windowLabel || ''}
              changeLabel={c.changeLabel}
              composition={c.composition}
              crossLink={c.crossLink}
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
