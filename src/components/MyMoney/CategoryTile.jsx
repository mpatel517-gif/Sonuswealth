import { useId, useState } from 'react'
import ExplainerChip from '../shared/Explainer.jsx'
import TappableNumber from '../shared/TappableNumber.jsx'
import { MiniTrendLines } from './L3/MiniTrendLines.jsx'
import { TrajectoryBar } from './TrajectoryBar.jsx'

const _f = (n) => {
  const a = Math.abs(Math.round(+n || 0))
  if (a >= 1e6) return `£${(a / 1e6).toFixed(2)}m`
  if (a >= 1e3) return `£${(a / 1e3).toFixed(0)}k`
  return `£${a.toLocaleString('en-GB')}`
}

// Inline "→ £X" that sits next to the value (founder: not a bar under it). Tap
// reveals the exact now / future / plan. Plan tip in gold when it adds.
function InlineFuture({ now = 0, future = 0, plan = null, lens = 'now' }) {
  const [open, setOpen] = useState(false)
  const p = plan == null ? future : Math.max(future, +plan)
  const tip = p > future ? p : future
  if (!open) {
    return (
      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        aria-label="Show now, future and plan"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, fontWeight: 800, color: p > future ? 'var(--c-gold,#E8B84B)' : 'var(--c-text3)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', alignSelf: 'center' }}>
        → {_f(tip)}
      </button>
    )
  }
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(false) }}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 10, fontWeight: 700, color: 'var(--c-text2)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', alignSelf: 'center', display: 'inline-flex', gap: 8 }}>
      <span><span style={{ color: 'var(--c-acc,#5ddbc2)' }}>now</span> {_f(now)}</span>
      <span><span style={{ color: 'var(--c-text3)' }}>future</span> {_f(future)}</span>
      {p > future && <span><span style={{ color: 'var(--c-gold,#E8B84B)' }}>plan</span> {_f(p)}</span>}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CategoryTile — rich tile for one of the 10 balance-sheet categories.
//
// Founder direction 2026-05-12: "i dont want to see lines · why not show in
// Tiles (More information about it easy to drill down)". Replaces the line-bar
// BalanceSheet rendering. Each tile is a glass card that summarises a category
// at a glance with: icon + change pill + hero value + composition mini-bar +
// status chip + drill link.
//
// Visual contract:
//   · Glass border + gradient surface (matches Phase 2 Batch B tokens)
//   · Hero value uses .sw-hero-num (responsive clamp 34–50px)
//   · Composition bar shows top-3 wrapper splits as a colour-segmented track
//   · 1–2 status chips surface what an adviser would call out
//   · Footer "View detail →" link drills into the category
//   · Liability variant uses coral treatment
// ─────────────────────────────────────────────────────────────────────────────

// Pluralize a noun for the "across N {noun}" composition line. Naive +s gave
// "propertys" / "policys" (MONEY-TILE-TEMPLATE R6 audit, founder 2026-06-01).
function pluralize(noun = '', n = 2) {
  if (n === 1) return noun
  if (/[^aeiou]y$/i.test(noun)) return noun.slice(0, -1) + 'ies'   // property → properties
  if (/(s|x|z|ch|sh)$/i.test(noun)) return noun + 'es'             // box → boxes
  return noun + 's'
}

function fmt(v, opts = {}) {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `${v < 0 ? '−' : ''}£${(abs / 1_000_000).toFixed(2)}m`
  if (abs >= 1_000)     return `${v < 0 ? '−' : ''}£${(abs / 1_000).toFixed(0)}k`
  return `${v < 0 ? '−' : ''}£${Math.round(abs).toLocaleString()}`
}

function pct(v, total) {
  if (!total) return 0
  return Math.round((v / total) * 100)
}

const WRAPPER_TONE = {
  PENSION:  '#7AA7FF',
  ISA:      '#5DDBC2',
  GIA:      '#BA8CFF',
  EIS:      '#FF598C',
  SEIS:     '#FF6B6B',
  VCT:      '#E77BFF',
  BOND_ON:  '#FFB347',
  BOND_OFF: '#FF9500',
  PROPERTY: '#FF9F0A',
  CASH:     '#34C759',
  TRUST:    '#BDA5FF',
  STATE:    '#8FA8C8',
  OTHER:    '#657286',
}

// WRAPPER_LAY_LABEL + composeWrappers REMOVED (MONEY-TILE-TEMPLATE R6) — they
// powered the wrapper-% legend, the second composition pattern now deleted.

export default function CategoryTile({
  id,
  icon = '◆',
  label,
  domainCodes = '',
  rows = [],
  subtotal,
  changePct = null,       // e.g. +1.2 / -0.4 / null
  status = null,          // { label: 'BPR ELIGIBLE', tone: 'good' | 'warn' | 'bad' }
  contextLine = null,     // e.g. "£41k of pension room left this year"
  costOfInaction = null,  // e.g. "£18.5k of tax relief lost if not used by April 5"
  liability = false,
  empty = null,           // optional empty-state copy override
  series = null,          // 12-month back-cast values for the sparkline (oldest → newest)
  trendSeries = null,     // number[][] — when set, the top sparkline shows one line PER item (e.g. per pension) instead of a single category line
  trajectory = null,      // { now, future, plan } — Pattern A temporal bar (spec 2026-06-01)
  activeLens = 'now',     // 'now' | 'future' | 'plan' — global temporal lens, emphasises a length
  horizonLabel = '',      // e.g. "10-year horizon" — labels the future end of the trajectory bar
  changeLabel = null,     // basis for changePct, e.g. "12-mo" — removes "+0.2% of what?" ambiguity
  composition = null,     // { count, noun, series: number[][] } — reveals an aggregate IS N items + per-item trend
  crossLink = null,       // { label, onClick } — when the action lives on another screen, link to it
  onView,
  onAdd,
  onWhatIf = null,        // per-item what-if, scoped to this topic (spec 2026-06-01)
}) {
  // C-10: unique gradient ID per component instance — prevents all tiles sharing the same gradient
  const uid = useId()
  const gradientId = `spark-${uid.replace(/:/g, '')}`

  const total = subtotal != null ? subtotal : rows.reduce((s, r) => s + (+r.value || 0), 0)
  const isEmpty = (rows.length === 0) && (subtotal == null || subtotal === 0)
  const accentColor = liability ? 'var(--c-coral, #FF6F7D)' : 'var(--c-acc)'
  const valueColor = liability ? 'var(--c-coral, #FF6F7D)' : 'var(--c-text)'
  const changeColor = changePct == null
    ? 'var(--c-text3)'
    : changePct >= 0
    ? 'var(--c-acc)'
    : 'var(--c-coral, #FF6F7D)'

  return (
    <div className="sw-card sw-cinema sw-pressable" style={{
      padding: 16,
      background: 'var(--card-bg2)',
      border: `1px solid ${liability ? 'color-mix(in srgb, var(--c-coral, #FF6F7D) 25%, var(--c-border))' : 'var(--c-border)'}`,
      borderRadius: 'var(--r-lg, 20px)',
      boxShadow: 'var(--sh)',
      position: 'relative',
      overflow: 'hidden',
      cursor: onView ? 'pointer' : 'default',
      transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
      // Heights synchronise per ROW via the grid (align-items:stretch) + the
      // wrapper's height:100% — not a fixed 320 floor. The old floor forced a
      // void into any tile with less than 320px of content (sparse Liabilities,
      // empty states) AND still couldn't equalise tiles taller than 320 (the
      // Pensions pill with COW + SIPP-IHT chip). Now the tile fills its cell;
      // the tallest tile in a row sets that row's height, no artificial gap.
      // (Founder 2026-05-31: "not equal in size … looks not synchronized.")
      minHeight: 0,
      height: '100%',
      display: 'flex', flexDirection: 'column',
    }}
    onClick={onView}>

      {/* Top row — icon + sparkline + change pill */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
        {/* Icon is a button so tapping it explicitly triggers the drill, with clear cursor */}
        <button
          onClick={(e) => { e.stopPropagation(); onView?.() }}
          aria-label={`Open ${label || id} detail`}
          title={`Tap to explore ${label || id}`}
          style={{
            width: 36, height: 36, borderRadius: 12,
            background: `color-mix(in srgb, ${accentColor} 12%, var(--c-surface2))`,
            border: `1px solid color-mix(in srgb, ${accentColor} 25%, transparent)`,
            color: accentColor,
            display: 'grid', placeItems: 'center',
            fontSize: 16, fontWeight: 800,
            flexShrink: 0,
            cursor: onView ? 'pointer' : 'default',
            transition: 'transform 0.15s ease, background 0.15s ease',
          }}
          onMouseEnter={e => { if (onView) e.currentTarget.style.background = `color-mix(in srgb, ${accentColor} 22%, var(--c-surface2))` }}
          onMouseLeave={e => { e.currentTarget.style.background = `color-mix(in srgb, ${accentColor} 12%, var(--c-surface2))` }}
        >{icon}</button>

        {/* 12-month sparkline — center-flex so it stretches to fill.
            Wave 0.6 founder fix: "spark not drillable". Wrapped in a button
            that fires sonus:ask so tapping the line opens an Ask Sonu
            conversation about this category's trend. */}
        {/* Multi-line trend: one line per item (e.g. per pension) — founder:
            "the first spark line, replace it with the 3 you just created". */}
        {!isEmpty && Array.isArray(trendSeries) && trendSeries.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              window.dispatchEvent(new CustomEvent('sonus:ask', {
                detail: { question: `How are my ${(label || id || 'holdings').toLowerCase()} trending?`, context: { metric: 'categoryTrendMulti', category: id } },
              }))
            }}
            aria-label={`Ask Sonu about ${label || id} trend`}
            title="Tap to ask Sonu about this trend"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}
          >
            <MiniTrendLines series={trendSeries} width={64} height={22} strokeWidth={1.3} mode="absolute" />
          </button>
        )}
        {!isEmpty && !trendSeries && Array.isArray(series) && series.length >= 2 && (() => {
          const W = 64, H = 22, pad = 2
          const xs = series.map((_, i) => pad + (i / (series.length - 1)) * (W - pad * 2))
          const maxV = Math.max(...series.map(v => +v || 0))
          const minV = Math.min(...series.map(v => +v || 0))
          const span = Math.max(maxV - minV, 1)
          const ys = series.map(v => H - pad - (((+v || 0) - minV) / span) * (H - pad * 2))
          const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
          const fillPath = `${path} L${xs[xs.length - 1].toFixed(1)},${H - pad} L${xs[0].toFixed(1)},${H - pad} Z`
          const stroke = liability ? 'var(--c-coral, #FF6F7D)' : 'var(--c-acc)'
          const sparkQ = `How is my ${(label || id || 'this').toLowerCase()} trending?`
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                window.dispatchEvent(new CustomEvent('sonus:ask', {
                  detail: {
                    question: sparkQ,
                    context: { metric: 'categoryTrend', category: id, series },
                  },
                }))
              }}
              aria-label={`Ask Sonu about ${label || id} trend`}
              title={`Tap to ask Sonu: ${sparkQ}`}
              style={{
                position: 'relative', flexShrink: 0,
                background: 'none', border: 'none', padding: 0,
                cursor: 'pointer', display: 'block',
              }}
            >
              <svg
                viewBox={`0 0 ${W} ${H}`}
                width={W}
                height={H}
                aria-hidden="true"
                style={{ display: 'block', opacity: 0.85 }}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={stroke} stopOpacity="0.32" />
                    <stop offset="100%" stopColor={stroke} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={fillPath} fill={`url(#${gradientId})`} />
                <path
                  d={path}
                  fill="none"
                  stroke={stroke}
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ filter: `drop-shadow(0 0 3px ${stroke}88)` }}
                />
              </svg>
              <span style={{
                position: 'absolute', bottom: 1, left: 1,
                fontSize: 9, color: 'var(--c-text3)', opacity: 0.7,
                lineHeight: 1, pointerEvents: 'none',
              }}>est.</span>
            </button>
          )
        })()}

        <div style={{ textAlign: 'right' }}>
          <div className="sw-eyebrow" style={{
            fontSize: 10, color: 'var(--c-text3)',
            letterSpacing: 0.8,
          }}>
            {label}
          </div>
          {changePct != null && !isEmpty && (
            <div style={{ marginTop: 3 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: changeColor,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%
              </div>
              {changeLabel && (
                <div style={{ fontSize: 8, color: 'var(--c-text3)', letterSpacing: 0.3, lineHeight: 1 }}>{changeLabel}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Hero value + trajectory bar — the now→future→plan BAR sits NEXT TO the
          value (founder 2026-06-01: bar next to the value, not under it; show
          future AND plan, not one figure). Solid = now, faint = future drift,
          gold tip = plan boost. Tap the bar for the exact 3-way. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div
          onClick={(e) => e.stopPropagation()}
          data-tieout={id ? `money.cat.${id}` : undefined}
          data-tieout-raw={!isEmpty ? String(liability ? -Math.abs(total) : total) : undefined}
          style={{
            fontSize: 24, fontWeight: 880, color: valueColor,
            letterSpacing: -0.5, lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}>
          {isEmpty ? '—' : (
            <TappableNumber
              value={Math.abs(total)}
              display={fmt(liability ? -Math.abs(total) : total)}
              size="hero"
              question={`What if my ${(label || id || 'this').toLowerCase()} changed?`}
              context={{ metric: 'categoryTotal', category: id, liability }}
            />
          )}
        </div>
        {!isEmpty && trajectory && trajectory.future > trajectory.now && (
          <div style={{ flex: 1, minWidth: 130 }} onClick={(e) => e.stopPropagation()}>
            <TrajectoryBar now={trajectory.now} future={trajectory.future} plan={trajectory.plan} active={activeLens} />
          </div>
        )}
      </div>

      {/* Composition reveal — aggregate IS N items, shown as ONE colour-
          segmented bar (same pattern as the ISA/GIA wrapper bar), each segment
          + chip drillable into that item. Replaces the trivial "X 100%" bar. */}
      {!isEmpty && composition && composition.items?.length > 0 && (() => {
        const items = composition.items
        const totalVal = items.reduce((s, it) => s + (+it.value || 0), 0) || 1
        const drill = composition.onDrill
        return (
          <div style={{ marginBottom: 10 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 11, color: 'var(--c-text2)', fontWeight: 600, marginBottom: 6 }}>
              across {items.length} {pluralize(composition.noun, items.length)}
            </div>
            <div style={{ height: 8, borderRadius: 100, background: 'var(--c-surface2)', display: 'flex', overflow: 'hidden' }}>
              {items.map((it, i) => (
                <div
                  key={(it.name || '') + i}
                  role={drill ? 'button' : undefined}
                  aria-label={drill ? `Open ${it.name}` : undefined}
                  onClick={drill ? () => drill(it) : undefined}
                  title={`${it.name}: ${fmt(it.value)}`}
                  style={{ width: `${((+it.value || 0) / totalVal) * 100}%`, background: it.color || WRAPPER_TONE.OTHER, cursor: drill ? 'pointer' : 'default', boxShadow: `0 0 6px ${it.color || WRAPPER_TONE.OTHER}55` }}
                />
              ))}
            </div>
            {/* No name legend on the tile. Listing the individual holdings
                (Vanguard / Hargreaves / Wayne) is surface-level detail that
                breaks the macOS principle (PP-2: simple surface, depth on tap)
                and repeats what the drill shows. The colour bar above stays the
                at-a-glance mix and each segment is still drillable; names live in
                View detail. (Founder 2026-06-01 — recorded so it stops recurring.) */}
          </div>
        )
      })()}

      {/* Wrapper-% legend REMOVED (MONEY-TILE-TEMPLATE R6, founder 2026-06-01):
          it was a SECOND composition pattern ("ISA 53% · GIA 47%") that made
          adjacent tiles inconsistent. There is now ONE pattern only — the
          `composition` block above ("across N {noun}" + drillable bar), built for
          every multi-holding tile in MyMoney.jsx. No second code path. */}

      {/* Context line + cost-of-inaction sub-line + status chip */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        {contextLine && !isEmpty && (
          <div style={{
            fontSize: 11, color: 'var(--c-text2)', marginBottom: costOfInaction ? 4 : 8, lineHeight: 1.4,
          }}>
            {contextLine}
          </div>
        )}
        {costOfInaction && !isEmpty && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              fontSize: 10, color: 'var(--c-coral, #FF6F7D)', marginBottom: 8, lineHeight: 1.4,
              paddingLeft: 8, borderLeft: '2px solid color-mix(in srgb, var(--c-coral, #FF6F7D) 40%, transparent)',
              fontWeight: 600,
            }}>
            <span style={{
              fontSize: 8, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase',
              color: 'var(--c-coral, #FF6F7D)', opacity: 0.7, display: 'block', marginBottom: 1,
            }}>Cost of waiting</span>
            <TappableNumber
              display={costOfInaction}
              value={0}
              question={`What if I acted on this ${(label || id || 'gap').toLowerCase()} gap this week? — ${costOfInaction}`}
              context={{ metric: 'costOfInaction', category: id, line: costOfInaction }}
            >
              {costOfInaction}
            </TappableNumber>
          </div>
        )}
        {status && !isEmpty && (() => {
          // v0.3 R1 §5 — when status.onTap is provided (e.g. SIPP-IHT chip on
          // Pensions tile carrying the iht-delta deep-link seed), the chip
          // becomes a button with its own tap target distinct from the tile
          // body. Without onTap, the chip is a static label as before.
          const isTappable = typeof status.onTap === 'function'
          const Tag = isTappable ? 'button' : 'div'
          return (
            <Tag
              type={isTappable ? 'button' : undefined}
              onClick={(e) => {
                e.stopPropagation()
                if (isTappable) status.onTap(e)
              }}
              aria-label={isTappable ? `${status.label} — open detail` : undefined}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: 100,
                background: statusBg(status.tone),
                color: statusFg(status.tone),
                border: `1px solid ${statusBorder(status.tone)}`,
                fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
                textTransform: 'uppercase',
                alignSelf: 'flex-start',
                marginBottom: 12,
                cursor: isTappable ? 'pointer' : 'default',
              }}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: statusFg(status.tone),
                boxShadow: `0 0 6px ${statusFg(status.tone)}`,
              }} />
              <span>{status.label}</span>
              {/* Drillable explainer — chip opens registry entry on click.
                  Each status mapped to its canonical definition via id. */}
              {status.explainerId && <ExplainerChip id={status.explainerId} size={13} />}
            </Tag>
          )
        })()}
        {isEmpty && (
          <div style={{
            fontSize: 11, color: 'var(--c-text3)', marginBottom: 12, lineHeight: 1.5,
            fontStyle: 'italic',
          }}>
            {empty || 'No items yet. Tap Add to capture.'}
          </div>
        )}

        {/* Cross-screen link — when the action lives on another tab (e.g.
            drawdown strategy on Cashflow), surface a navigable link here. */}
        {crossLink && !isEmpty && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); crossLink.onClick?.() }}
            className="sw-press"
            style={{
              display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 10px', marginBottom: 8, borderRadius: 10,
              background: `color-mix(in srgb, ${accentColor} 8%, transparent)`,
              border: `1px solid color-mix(in srgb, ${accentColor} 22%, transparent)`,
              color: accentColor, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}>
            <span>{crossLink.label}</span><span aria-hidden>→</span>
          </button>
        )}

        {/* Footer — view detail + add */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: 10, borderTop: '1px solid var(--c-sep)', gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button onClick={(e) => { e.stopPropagation(); onView?.() }}
              aria-label={`View ${label || id || 'category'} detail`}
              className="sw-press"
              style={{
                background: 'transparent', border: 'none',
                color: accentColor,
                fontSize: 11, fontWeight: 800, letterSpacing: 0.3,
                cursor: 'pointer', padding: 0,
              }}>
              View detail →
            </button>
            {/* Per-item What-if (founder 2026-06-01): scoped to THIS topic only —
                distinct from the tab-level and global what-ifs. */}
            {onWhatIf && (
              <button onClick={(e) => { e.stopPropagation(); onWhatIf(id) }}
                aria-label={`What if — ${label || id || 'this'}`}
                className="sw-press"
                style={{
                  background: 'transparent', border: 'none',
                  color: 'var(--c-text3)',
                  fontSize: 11, fontWeight: 800, letterSpacing: 0.3,
                  cursor: 'pointer', padding: 0,
                }}>
                What if ⚡
              </button>
            )}
          </div>
          <button onClick={(e) => { e.stopPropagation(); onAdd?.(id) }}
            className="sw-press"
            style={{
              background: `color-mix(in srgb, ${accentColor} 10%, transparent)`,
              border: `1px dashed color-mix(in srgb, ${accentColor} 40%, transparent)`,
              color: accentColor,
              padding: '4px 10px', borderRadius: 100,
              fontSize: 10, fontWeight: 800, letterSpacing: 0.4,
              cursor: 'pointer',
            }}>
            + Add
          </button>
        </div>
      </div>
    </div>
  )
}

function statusBg(tone) {
  if (tone === 'good') return 'color-mix(in srgb, var(--c-acc) 12%, transparent)'
  if (tone === 'warn') return 'color-mix(in srgb, var(--c-gold) 12%, transparent)'
  if (tone === 'bad')  return 'color-mix(in srgb, var(--c-coral, #FF6F7D) 12%, transparent)'
  return 'var(--c-surface2)'
}
function statusFg(tone) {
  if (tone === 'good') return 'var(--c-acc)'
  if (tone === 'warn') return 'var(--c-gold)'
  if (tone === 'bad')  return 'var(--c-coral, #FF6F7D)'
  return 'var(--c-text3)'
}
function statusBorder(tone) {
  if (tone === 'good') return 'color-mix(in srgb, var(--c-acc) 30%, transparent)'
  if (tone === 'warn') return 'color-mix(in srgb, var(--c-gold) 30%, transparent)'
  if (tone === 'bad')  return 'color-mix(in srgb, var(--c-coral, #FF6F7D) 30%, transparent)'
  return 'var(--c-border)'
}
