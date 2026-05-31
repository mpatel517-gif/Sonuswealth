// ─────────────────────────────────────────────────────────────────────────────
// LiabilityTile — per-debt tile matching CategoryTile rhythm but tuned for
// liabilities. Built after founder UX pass 3: "Liabilities is not following
// the asset look and feel why".
//
// Visual structure mirrors CategoryTile (~320px, sw-card, sw-cinema):
//   · Top row     — icon (mortgage / card / loan) + 12-month debt sparkline
//                   (trending DOWN if amortising) + YoY change pill
//   · Hero value  — outstanding balance in coral
//   · APR chip    — colour-coded: red >15%, amber 8–15%, green <8%
//   · Avalanche   — small marker on the highest-APR debt (cost optimisation
//                   hint; FCA-safe phrasing — mathematical, not advisory)
//   · Context     — monthly cost + annualised interest cost at current APR
//   · Tap         — opens LiabilitiesDrillDown via setActiveDrill
//
// FCA boundary: every chip is information, not advice. "Highest APR — costs
// most per £ owed" is a fact about money math, not a recommendation to
// prioritise it. The pay-down decision is the user's.
// ─────────────────────────────────────────────────────────────────────────────

import { useId } from 'react'
import TappableNumber from '../shared/TappableNumber.jsx'

function fmt(v) {
  const n = +v || 0
  const abs = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  if (abs >= 1_000_000) return `${sign}£${(abs / 1_000_000).toFixed(2)}m`
  if (abs >= 1_000)     return `${sign}£${(abs / 1_000).toFixed(0)}k`
  return `${sign}£${abs.toLocaleString()}`
}

// Icon glyphs by liability type — same set used elsewhere in MyMoney so the
// visual language stays consistent.
const ICONS = {
  mortgage:        '⌖',
  credit_card:     '◉',
  card:            '◉',
  personal_loan:   '⊟',
  loan:            '⊟',
  car:             '⛁',
  student:         '⎈',
  hire_purchase:   '⊞',
  buy_now:         '◇',
  bnpl:            '◇',
  default:         '⚠',
}

function iconFor(type = '') {
  const t = type.toLowerCase().replace(/[\s-]+/g, '_')
  return ICONS[t] || ICONS.default
}

// APR band — cost severity colour. Below 5% = effectively free money (often
// secured / inflation-eroded). 5-8% = mortgage band. 8-15% = unsecured loan
// band. 15%+ = credit card / BNPL territory.
function aprBand(apr) {
  if (apr == null) return { tone: 'unknown', color: 'var(--c-text3)' }
  if (apr >= 15)   return { tone: 'high',    color: '#FF4D5E' }
  if (apr >= 8)    return { tone: 'mid',     color: '#FFB347' }
  if (apr >= 5)    return { tone: 'low-mid', color: '#FFD06B' }
  return            { tone: 'low',     color: 'var(--c-acc)' }
}

export default function LiabilityTile({
  type,                   // 'mortgage' | 'credit_card' | 'personal_loan' | ...
  label,                  // display label e.g. "Mortgage", "Credit card"
  balance,                // outstanding £ amount (positive number)
  apr,                    // % e.g. 5.2 (not 0.052)
  monthly,                // £/month payment
  series = null,          // 12-month back-cast balance values (oldest → newest)
  yoyChangePct = null,    // YoY balance change (negative = paying down — good)
  isAvalanche = false,    // true if this is the highest-APR debt in the set
  onView,                 // tap-anywhere → drill open
}) {
  const uid = useId()
  const gradientId = `liabspark-${uid.replace(/:/g, '')}`

  const accent = 'var(--c-coral, #FF6F7D)'
  const band = aprBand(apr)
  const annualInterest = apr != null ? balance * (apr / 100) : null

  // changeColor — DOWN is GOOD for debt (paying it off). So invert: negative
  // YoY = green / accent, positive = coral (debt grew).
  const changeColor = yoyChangePct == null
    ? 'var(--c-text3)'
    : yoyChangePct <= 0
    ? 'var(--c-acc)'
    : accent

  return (
    <div className="sw-card sw-cinema sw-pressable" style={{
      padding: 16,
      background: 'var(--card-bg2)',
      border: `1px solid color-mix(in srgb, ${accent} 25%, var(--c-border))`,
      borderRadius: 'var(--r-lg, 20px)',
      boxShadow: 'var(--sh)',
      position: 'relative',
      overflow: 'hidden',
      cursor: onView ? 'pointer' : 'default',
      transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
      // Was minHeight:320 — a single sparse mortgage tile became a giant void.
      // Size to content; the grid equalises siblings per row (founder 2026-05-31).
      minHeight: 0,
      height: '100%',
      display: 'flex', flexDirection: 'column',
    }}
    onClick={onView}>

      {/* Avalanche-priority badge — top-right corner notification. Renders only
          on the highest-APR debt across the persona's liability set.
          Phrasing is mathematical (highest interest rate) not advisory. */}
      {isAvalanche && (
        <div
          title="This debt costs the most per £ owed at its current APR. Paying it down faster reduces total interest."
          style={{
            position: 'absolute', top: 10, right: 10,
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', borderRadius: 999,
            background: `color-mix(in srgb, ${band.color} 20%, transparent)`,
            border: `1px solid color-mix(in srgb, ${band.color} 55%, transparent)`,
            color: band.color,
            fontSize: 9, fontWeight: 800,
            letterSpacing: 0.6, textTransform: 'uppercase',
            zIndex: 2,
          }}>
          ▲ Highest APR
        </div>
      )}

      {/* Top row — icon + sparkline + label & change */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
        <button
          onClick={(e) => { e.stopPropagation(); onView?.() }}
          aria-label={`Open ${label} detail`}
          title={`Tap to explore ${label}`}
          style={{
            width: 36, height: 36, borderRadius: 12,
            background: `color-mix(in srgb, ${accent} 12%, var(--c-surface2))`,
            border: `1px solid color-mix(in srgb, ${accent} 25%, transparent)`,
            color: accent,
            display: 'grid', placeItems: 'center',
            fontSize: 16, fontWeight: 800,
            flexShrink: 0,
            cursor: onView ? 'pointer' : 'default',
            transition: 'transform 0.15s ease, background 0.15s ease',
          }}
        >{iconFor(type)}</button>

        {Array.isArray(series) && series.length >= 2 && (() => {
          const W = 64, H = 22, pad = 2
          const xs = series.map((_, i) => pad + (i / (series.length - 1)) * (W - pad * 2))
          const maxV = Math.max(...series.map(v => +v || 0))
          const minV = Math.min(...series.map(v => +v || 0))
          const span = Math.max(maxV - minV, 1)
          const ys = series.map(v => H - pad - (((+v || 0) - minV) / span) * (H - pad * 2))
          const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
          const fillPath = `${path} L${xs[xs.length - 1].toFixed(1)},${H - pad} L${xs[0].toFixed(1)},${H - pad} Z`
          // Stroke colour follows the debt-trend semantic: amortising (going
          // down) = accent green, growing = coral.
          const trending = series[series.length - 1] - series[0]
          const stroke = trending <= 0 ? 'var(--c-acc)' : accent
          const sparkQ = `How is my ${(label || 'this debt').toLowerCase()} balance trending?`
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                window.dispatchEvent(new CustomEvent('sonus:ask', {
                  detail: {
                    question: sparkQ,
                    context: { metric: 'liabilityTrend', type, label, series },
                  },
                }))
              }}
              aria-label={`Ask Sonu about ${label} trend`}
              title={`Tap to ask: ${sparkQ}`}
              style={{
                position: 'relative', flexShrink: 0,
                background: 'none', border: 'none', padding: 0,
                cursor: 'pointer', display: 'block',
              }}
            >
              <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true" style={{ display: 'block', opacity: 0.85 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={stroke} stopOpacity="0.32" />
                    <stop offset="100%" stopColor={stroke} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={fillPath} fill={`url(#${gradientId})`} />
                <path d={path} fill="none" stroke={stroke} strokeWidth="1.4"
                  strokeLinecap="round" strokeLinejoin="round"
                  style={{ filter: `drop-shadow(0 0 3px ${stroke}88)` }} />
              </svg>
              <span style={{
                position: 'absolute', bottom: 1, left: 1,
                fontSize: 9, color: 'var(--c-text3)', opacity: 0.7,
                lineHeight: 1, pointerEvents: 'none',
              }}>12m</span>
            </button>
          )
        })()}

        <div style={{ textAlign: 'right', paddingRight: isAvalanche ? 70 : 0 }}>
          <div className="sw-eyebrow" style={{
            fontSize: 10, color: 'var(--c-text3)',
            letterSpacing: 0.8, textTransform: 'capitalize',
          }}>
            {label}
          </div>
          {yoyChangePct != null && (
            <div style={{
              fontSize: 11, fontWeight: 700, color: changeColor,
              marginTop: 3, fontVariantNumeric: 'tabular-nums',
            }}>
              {yoyChangePct >= 0 ? '+' : ''}{yoyChangePct.toFixed(1)}%
            </div>
          )}
        </div>
      </div>

      {/* Hero balance — coral. Shown as a negative number so the user reads
          it as "money out" not just "money". TappableNumber gives the ⚡ "what
          if" route into Ask Sonu about debt scenarios. */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          fontSize: 24, fontWeight: 880, color: accent,
          letterSpacing: -0.5, lineHeight: 1, marginBottom: 4,
          fontVariantNumeric: 'tabular-nums',
        }}>
        <TappableNumber
          value={balance}
          display={fmt(-Math.abs(balance))}
          size="hero"
          question={`What if I paid down my ${(label || 'this debt').toLowerCase()} faster?`}
          context={{ metric: 'liabilityBalance', type, label, balance, apr, monthly }}
        />
      </div>

      <div style={{ marginBottom: 12 }} />

      {/* APR chip — primary cost signal. Colour-coded by band. */}
      {apr != null && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          <span
            title={
              band.tone === 'high'   ? 'High-cost debt: 15% APR or more'
              : band.tone === 'mid'  ? 'Mid-cost debt: 8–15% APR'
              : band.tone === 'low-mid' ? 'Low-mid cost: 5–8% APR'
              : 'Low-cost debt: under 5% APR'
            }
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 9px', borderRadius: 999,
              background: `color-mix(in srgb, ${band.color} 14%, transparent)`,
              border: `1px solid color-mix(in srgb, ${band.color} 35%, transparent)`,
              color: band.color,
              fontSize: 11, fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
            }}>
            {apr.toFixed(1)}% APR
          </span>
          {monthly > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 9px', borderRadius: 999,
              background: 'var(--c-surface2)',
              border: '1px solid var(--c-border)',
              color: 'var(--c-text2)',
              fontSize: 11, fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {fmt(monthly)}/mo
            </span>
          )}
        </div>
      )}

      {/* Annualised interest cost — money math, not advice. Shows the user
          how much interest they're paying per year at the current APR. */}
      {annualInterest != null && annualInterest > 0 && (
        <div style={{
          fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.45,
          marginBottom: 8,
        }}>
          <span style={{ color: 'var(--c-text3)' }}>Interest at this APR · </span>
          <span style={{ color: accent, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {fmt(annualInterest)}/yr
          </span>
        </div>
      )}

      {/* Spacer to push the drill prompt to the bottom — keeps tile rhythm. */}
      <div style={{ flex: 1 }} />

      {/* Bottom drill prompt — same affordance pattern as CategoryTile. */}
      <button
        onClick={(e) => { e.stopPropagation(); onView?.() }}
        style={{
          background: 'none', border: 'none', padding: '8px 0 0 0',
          textAlign: 'left', cursor: 'pointer',
          color: 'var(--c-text3)', fontSize: 11, fontWeight: 600,
          letterSpacing: 0.3,
          transition: 'color 0.15s ease',
        }}
        onMouseEnter={e => e.currentTarget.style.color = accent}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text3)'}
      >
        Open drill →
      </button>
    </div>
  )
}
