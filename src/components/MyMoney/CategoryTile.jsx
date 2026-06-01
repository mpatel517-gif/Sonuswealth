import { useId } from 'react'
import ExplainerChip from '../shared/Explainer.jsx'
import TappableNumber from '../shared/TappableNumber.jsx'
import { MiniTrendLines } from './L3/MiniTrendLines.jsx'

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

// L-02 fix: lay-readable wrapper labels mirror MyMoney.jsx WRAPPER_LABEL.
// Replaces the old `label.replace('_', ' ')` which produced "BOND ON" /
// "BOND OFF" reading as switch states.
const WRAPPER_LAY_LABEL = {
  PENSION:  'Pension',
  ISA:      'ISA',
  GIA:      'GIA',
  CASH:     'Cash',
  PROPERTY: 'Property',
  EIS:      'EIS',
  SEIS:     'SEIS',
  VCT:      'VCT',
  TRUST:    'Trust',
  BOND_ON:  'Onshore bond',
  BOND_OFF: 'Offshore bond',
  STATE:    'State',
  OTHER:    'Other',
}

// Compose a top-3 wrapper composition from rows; everything else collapsed
// into "Other". Returns array of { label, value, share, displayPct }.
// V-2 fix (2026-05-28): displayPct uses Hamilton (largest-remainder) method
// so the printed percentages always sum to exactly 100. Previously each
// segment was independently Math.round(share*100), which produced 53+48=101
// on Bruce's ISA/GIA breakdown. share (raw fraction) is kept for bar widths.
function composeWrappers(rows) {
  if (!rows?.length) return []
  const byW = {}
  for (const r of rows) {
    const w = r.wrapper || 'OTHER'
    byW[w] = (byW[w] || 0) + (+r.value || 0)
  }
  const sorted = Object.entries(byW).sort((a, b) => b[1] - a[1])
  const top3 = sorted.slice(0, 3)
  const restTotal = sorted.slice(3).reduce((s, [, v]) => s + v, 0)
  if (restTotal > 0) top3.push(['OTHER', restTotal])
  const total = top3.reduce((s, [, v]) => s + v, 0) || 1
  const segments = top3.map(([w, v]) => ({ label: w, value: v, share: v / total }))
  // Hamilton method: floor each, hand out leftover units to segments with the
  // largest fractional remainders. Guarantees Σ displayPct === 100 (or 0).
  const raw = segments.map(s => s.share * 100)
  const floors = raw.map(r => Math.floor(r))
  const remainders = raw.map((r, i) => ({ i, frac: r - floors[i] }))
  let leftover = 100 - floors.reduce((s, n) => s + n, 0)
  remainders.sort((a, b) => b.frac - a.frac)
  const display = floors.slice()
  for (let k = 0; k < leftover && k < remainders.length; k++) {
    display[remainders[k].i] += 1
  }
  return segments.map((s, i) => ({ ...s, displayPct: display[i] }))
}

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
  changeLabel = null,     // basis for changePct, e.g. "12-mo" — removes "+0.2% of what?" ambiguity
  composition = null,     // { count, noun, series: number[][] } — reveals an aggregate IS N items + per-item trend
  crossLink = null,       // { label, onClick } — when the action lives on another screen, link to it
  onView,
  onAdd,
}) {
  // C-10: unique gradient ID per component instance — prevents all tiles sharing the same gradient
  const uid = useId()
  const gradientId = `spark-${uid.replace(/:/g, '')}`

  const total = subtotal != null ? subtotal : rows.reduce((s, r) => s + (+r.value || 0), 0)
  const isEmpty = (rows.length === 0) && (subtotal == null || subtotal === 0)
  const wrappers = composeWrappers(rows)
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
            <MiniTrendLines series={trendSeries} width={64} height={22} strokeWidth={1.3} />
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

      {/* Hero value — tappable to fire "What if?" sheet (HIGH #4) */}
      <div
        onClick={(e) => e.stopPropagation()}
        data-tieout={id ? `money.cat.${id}` : undefined}
        data-tieout-raw={!isEmpty ? String(liability ? -Math.abs(total) : total) : undefined}
        style={{
          fontSize: 24, fontWeight: 880, color: valueColor,
          letterSpacing: -0.5, lineHeight: 1, marginBottom: 4,
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
      {/* domainCodes (engineering taxonomy codes) intentionally hidden — kept as a
          prop for internal use only per the plain-English principle. */}
      <div style={{ marginBottom: 12 }} />

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
              across {items.length} {composition.noun}{items.length !== 1 ? 's' : ''}
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
            {/* Few holdings → show the drillable chips inline (the founder's
                "ISA / GIA on one line" pattern). Many holdings (e.g. persona-c's
                8 pensions) → DON'T list them inline; that balloons the tile and
                voids its row-mates. Show one "See all N → " button that opens the
                full drill (the breakdown + per-pot leaf screens). Founder
                2026-06-01: "a button to see the detail and then all the screens
                we had." The colour bar above still carries the at-a-glance mix. */}
            {(() => {
              const LEGEND_MAX = 4
              const sorted = [...items].sort((a, b) => (+b.value || 0) - (+a.value || 0))
              // Many holdings → don't list them and don't add a "See all N" button:
              // the "across N" count above and the tile's own "View detail →" footer
              // already carry it (founder 2026-06-01: "across 8" + "see all 8" + "view
              // detail" is three ways to say one thing — keep one count + View detail).
              // The colour bar above stays as the at-a-glance mix.
              if (sorted.length > LEGEND_MAX) return null
              return (
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', fontSize: 10, color: 'var(--c-text3)' }}>
                  {sorted.map((it, i) => (
                    <button
                      key={(it.name || '') + i}
                      type="button"
                      className="sw-press"
                      onClick={drill ? () => drill(it) : undefined}
                      aria-label={drill ? `Open ${it.name} detail` : undefined}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: '1px solid transparent', padding: '4px 6px', borderRadius: 6, cursor: drill ? 'pointer' : 'default', color: 'inherit', fontSize: 'inherit', minHeight: 28 }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: it.color || WRAPPER_TONE.OTHER, display: 'inline-block' }} />
                      <span style={{ fontWeight: 700, color: 'var(--c-text2)' }}>{it.short || it.name}</span>
                      <span>{Math.round(((+it.value || 0) / totalVal) * 100)}%</span>
                    </button>
                  ))}
                </div>
              )
            })()}
          </div>
        )
      })()}

      {/* Composition mini-bar — only when there are ≥2 wrappers (a single
          wrapper renders a pointless "X 100%" bar, which the founder flagged). */}
      {!isEmpty && !composition && wrappers.length > 1 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{
            height: 6, borderRadius: 100,
            background: 'var(--c-surface2)',
            display: 'flex', overflow: 'hidden',
            transformOrigin: 'left center',
            animation: 'sw-bar-grow 0.9s var(--ease-out-expo) both',
          }}>
            {wrappers.map(w => (
              <div key={w.label}
                style={{
                  width: `${w.share * 100}%`,
                  background: WRAPPER_TONE[w.label] || WRAPPER_TONE.OTHER,
                  boxShadow: `0 0 6px ${WRAPPER_TONE[w.label] || WRAPPER_TONE.OTHER}55`,
                }}
                title={`${w.label}: ${fmt(w.value)} (${w.displayPct}%)`} />
            ))}
          </div>
          <div style={{
            display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap',
            fontSize: 10, color: 'var(--c-text3)',
          }}>
            {wrappers.slice(0, 3).map(w => {
              const chipLabel = WRAPPER_LAY_LABEL[w.label] || w.label.replace(/_/g, ' ')
              return (
                <button
                  key={w.label}
                  type="button"
                  className="sw-press"
                  onClick={(e) => {
                    e.stopPropagation()
                    window.dispatchEvent(new CustomEvent('sonus:ask', {
                      detail: {
                        question: `Show me my ${chipLabel} ${(label || id || 'holdings').toLowerCase()} in detail`,
                        seed: { category: id, chip: w.label, value: w.value, share: w.share },
                      },
                    }))
                  }}
                  aria-label={`Ask about ${chipLabel} in ${label || id}`}
                  title={`Ask Sonu about your ${chipLabel} holdings`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: 'none', border: '1px solid transparent',
                    padding: '4px 6px', borderRadius: 6, cursor: 'pointer',
                    color: 'inherit', fontSize: 'inherit',
                    minHeight: 28,
                    transition: 'border-color 0.15s ease, background 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = `color-mix(in srgb, ${WRAPPER_TONE[w.label] || WRAPPER_TONE.OTHER} 40%, transparent)`
                    e.currentTarget.style.background = `color-mix(in srgb, ${WRAPPER_TONE[w.label] || WRAPPER_TONE.OTHER} 8%, transparent)`
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'transparent'
                    e.currentTarget.style.background = 'none'
                  }}
                >
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: WRAPPER_TONE[w.label] || WRAPPER_TONE.OTHER,
                    display: 'inline-block',
                  }} />
                  <span style={{ fontWeight: 700, color: 'var(--c-text2)' }}>
                    {chipLabel}
                  </span>
                  <span>{w.displayPct}%</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

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
