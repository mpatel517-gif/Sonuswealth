import { useId } from 'react'
import ExplainerChip from '../shared/Explainer.jsx'
import TappableNumber from '../shared/TappableNumber.jsx'

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
// into "Other". Returns array of { label, value, share }.
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
  return top3.map(([w, v]) => ({ label: w, value: v, share: v / total }))
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
      minHeight: 200,
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

        {/* 12-month sparkline — center-flex so it stretches to fill */}
        {!isEmpty && Array.isArray(series) && series.length >= 2 && (() => {
          const W = 64, H = 22, pad = 2
          const xs = series.map((_, i) => pad + (i / (series.length - 1)) * (W - pad * 2))
          const maxV = Math.max(...series.map(v => +v || 0))
          const minV = Math.min(...series.map(v => +v || 0))
          const span = Math.max(maxV - minV, 1)
          const ys = series.map(v => H - pad - (((+v || 0) - minV) / span) * (H - pad * 2))
          const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
          const fillPath = `${path} L${xs[xs.length - 1].toFixed(1)},${H - pad} L${xs[0].toFixed(1)},${H - pad} Z`
          const stroke = liability ? 'var(--c-coral, #FF6F7D)' : 'var(--c-acc)'
          return (
            <div style={{ position: 'relative', flexShrink: 0 }}>
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
            </div>
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
            <div style={{
              fontSize: 11, fontWeight: 700, color: changeColor,
              marginTop: 3, fontVariantNumeric: 'tabular-nums',
            }}>
              {changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%
            </div>
          )}
        </div>
      </div>

      {/* Hero value */}
      <div style={{
        fontSize: 24, fontWeight: 880, color: valueColor,
        letterSpacing: -0.5, lineHeight: 1, marginBottom: 4,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {isEmpty ? '—' : fmt(liability ? -Math.abs(total) : total)}
      </div>
      {/* domainCodes (engineering taxonomy codes) intentionally hidden — kept as a
          prop for internal use only per the plain-English principle. */}
      <div style={{ marginBottom: 12 }} />

      {/* Composition mini-bar (only if not empty) */}
      {!isEmpty && wrappers.length > 0 && (
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
                title={`${w.label}: ${fmt(w.value)} (${Math.round(w.share * 100)}%)`} />
            ))}
          </div>
          <div style={{
            display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap',
            fontSize: 10, color: 'var(--c-text3)',
          }}>
            {wrappers.slice(0, 3).map(w => (
              <span key={w.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: WRAPPER_TONE[w.label] || WRAPPER_TONE.OTHER,
                  display: 'inline-block',
                }} />
                <span style={{ fontWeight: 700, color: 'var(--c-text2)' }}>
                  {WRAPPER_LAY_LABEL[w.label] || w.label.replace(/_/g, ' ')}
                </span>
                <span>{Math.round(w.share * 100)}%</span>
              </span>
            ))}
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
        {status && !isEmpty && (
          <div
            onClick={(e) => e.stopPropagation()}
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
          </div>
        )}
        {isEmpty && (
          <div style={{
            fontSize: 11, color: 'var(--c-text3)', marginBottom: 12, lineHeight: 1.5,
            fontStyle: 'italic',
          }}>
            {empty || 'No items yet. Tap Add to capture.'}
          </div>
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
