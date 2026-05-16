// ─────────────────────────────────────────────────────────────────────────────
// CoIOdometer — animated Cost-of-Inaction hero number
// Spec: home §Z3 · tax-estate §6.3
//
// Hero number with rAF-driven counter animation when value changes. When a
// `dailyRate` is provided and there's no fixed `deadline`, the number ticks
// up live each second via useTicker (decoupled from React render via
// timestamp math).
//
// Confidence + provenance chips render below the number. Tap → byAction
// breakdown bottom sheet (only when `byAction` array provided).
//
// Animation pieces:
//   · useTicker            — accrues dailyRate per-second
//   · useCounterAnimation  — eases the displayed value between frames
//   · .sw-pulse-glow       — applied to the [Now] pill so it breathes
//
// Props:
//   totalCoI      number — pence-or-pounds depending on caller; we just format £
//   dailyRate     number — additional CoI accruing per day
//   deadline      Date|string — optional ISO; when present, no live tick
//   confidence    'high' | 'medium' | 'low'
//   provenance    string[] — sources displayed in chip ("CMA-2026.1" etc.)
//   byAction      Array<{label, amount, key?}> — breakdown for the sheet
//   showNowPill   boolean (default true)
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { useCounterAnimation, useTicker } from '../../hooks/useAnimation.jsx'

function fmtGBP(n) {
  if (!Number.isFinite(n)) return '£—'
  const v = Math.round(n)
  return '£' + v.toLocaleString('en-GB')
}

const CONF_CHIP = {
  high:   { cls: 'sw-chip sw-chip-sm sw-chip-blue',   label: 'High confidence'   },
  medium: { cls: 'sw-chip sw-chip-sm sw-chip-amber',  label: 'Medium confidence' },
  low:    { cls: 'sw-chip sw-chip-sm sw-chip-coral',  label: 'Low confidence'    },
}

export default function CoIOdometer({
  totalCoI = 0,
  dailyRate = 0,
  deadline = null,
  confidence = 'medium',
  provenance = [],
  byAction = null,
  showNowPill = true,
  onTap,
}) {
  // Live tick: dailyRate / 86400 seconds, 1Hz interval, gated by !deadline & rate > 0.
  const tickedValue = useTicker(
    totalCoI,
    dailyRate / 86_400,
    { enabled: !deadline && dailyRate > 0 },
  )

  // rAF counter animation on whatever the ticker emits this render.
  const heroText = useCounterAnimation(tickedValue, {
    duration: 800,
    format: fmtGBP,
  })

  const conf = CONF_CHIP[confidence] || CONF_CHIP.medium
  const [sheetOpen, setSheetOpen] = useState(false)
  const canExpand = Array.isArray(byAction) && byAction.length > 0

  return (
    <>
      <div
        onClick={() => {
          if (canExpand) setSheetOpen(true)
          onTap?.()
        }}
        className="sw-card"
        style={{
          position: 'relative',
          border: '1px solid var(--c-border)',
          borderRadius: 'var(--r-xl)',
          padding: 'var(--space-xl)',
          margin: '0 16px 12px',
          cursor: canExpand || onTap ? 'pointer' : 'default',
        }}
      >
        {/* [Now] pill — top-right; refined: thin mint-outline with mint text. */}
        {showNowPill && (
          <span
            className="sw-chip sw-chip-sm sw-chip-mint sw-chip-outline"
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              letterSpacing: 0.6,
            }}
          >
            NOW
          </span>
        )}

        <div style={{
          fontSize: 'var(--fs-label)', fontWeight: 700,
          color: 'var(--c-text3)',
          textTransform: 'uppercase', letterSpacing: 0.8,
          marginBottom: 6,
        }}>
          Cost of inaction
        </div>

        <div style={{
          fontSize: 'var(--fs-hero-lg, 36px)',
          fontWeight: 800,
          color: 'var(--c-acc3)',
          lineHeight: 1.05,
          letterSpacing: -0.5,
          fontVariantNumeric: 'tabular-nums',
          transition: 'transform .4s, color .4s',
        }}>
          {heroText}
        </div>

        {dailyRate > 0 && !deadline && (
          <div style={{
            fontSize: 'var(--fs-small)', color: 'var(--c-text3)',
            marginTop: 4,
          }}>
            +{fmtGBP(dailyRate)}/day · live
          </div>
        )}
        {deadline && (
          <div style={{
            fontSize: 'var(--fs-small)', color: 'var(--c-text3)',
            marginTop: 4,
          }}>
            Crystallises by {new Date(deadline).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </div>
        )}

        {/* Chips row */}
        <div style={{
          display: 'flex', gap: 6, flexWrap: 'wrap',
          marginTop: 12, paddingTop: 10,
          borderTop: '1px solid var(--c-sep)',
        }}>
          <span className={conf.cls}>{conf.label}</span>
          {(provenance || []).map(p => (
            <span key={p} className="sw-chip sw-chip-sm">
              {p}
            </span>
          ))}
          {canExpand && (
            <span style={{
              marginLeft: 'auto',
              fontSize: 'var(--fs-label)', fontWeight: 700,
              color: 'var(--c-acc2)',
              letterSpacing: 0.3,
            }}>
              Breakdown ›
            </span>
          )}
        </div>
      </div>

      {sheetOpen && (
        <CoISheet
          byAction={byAction}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  )
}

function CoISheet({ byAction, onClose }) {
  return (
    <div
      role="dialog" aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 680,
          background: 'var(--c-surface)',
          borderRadius: '20px 20px 0 0',
          padding: '20px 20px 28px',
          maxHeight: '78vh', overflowY: 'auto',
        }}
      >
        <div style={{
          width: 36, height: 5, borderRadius: 3,
          background: 'var(--c-sep)', margin: '0 auto 16px',
        }} />
        <div style={{
          fontSize: 'var(--fs-title)', fontWeight: 800,
          color: 'var(--c-text)', marginBottom: 14,
        }}>
          CoI by action
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {(byAction || []).map((row, i) => (
            <div key={row.key || row.label} style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center',
              padding: '11px 0',
              borderBottom: i === byAction.length - 1 ? 'none' : '1px solid var(--c-sep)',
            }}>
              <span style={{
                fontSize: 'var(--fs-body)', color: 'var(--c-text2)',
              }}>
                {row.label}
              </span>
              <span style={{
                fontSize: 'var(--fs-body)', fontWeight: 700,
                color: 'var(--c-acc3)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {fmtGBP(row.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export { CoIOdometer }
