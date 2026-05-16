// ─────────────────────────────────────────────────────────────────────────────
// PlanStalenessBanner — anti-cry-wolf staleness alerts
// Spec: home §Z7-PLANS · mymoney plan section · cashflow §B
//       tax-estate §6.2 · timeline §E
//
// Renders critical-only by default. Stack collapses to `maxBanners` (default 3),
// overflow surfaces as a "+N more" chip.
//
// Critical = monthsSinceReview > 24 OR plan affects an active deadline within
// 30 days (passed in via `isCritical` from the engine).
//
// Props:
//   plans       Array<{ type, lastReviewedAt?, monthsSinceReview, isStale,
//                       isCritical, deadlineDays?, label? }>
//   maxBanners  number (default 3)
//   onReview    (plan) => void   — wired to §S-plans deep-link by parent
//   onDismiss   (plan) => void   — optional; lets caller suppress one banner
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'

function planLabel(plan) {
  if (plan.label) return plan.label
  const t = (plan.type || '').replace(/[-_]/g, ' ')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function reasonText(plan) {
  if (plan.deadlineDays != null && plan.deadlineDays <= 30) {
    return `Deadline in ${plan.deadlineDays} day${plan.deadlineDays === 1 ? '' : 's'} — last reviewed ${plan.monthsSinceReview} mo ago`
  }
  if (plan.monthsSinceReview > 24) {
    return `Not reviewed in ${plan.monthsSinceReview} months — likely out of date`
  }
  return `Last reviewed ${plan.monthsSinceReview} months ago`
}

// Critical → coral chip; ordinary stale → amber chip.
function staleChip(plan) {
  const critical = (plan.deadlineDays != null && plan.deadlineDays <= 30)
                    || plan.monthsSinceReview > 24
  const cls = critical ? 'sw-chip sw-chip-sm sw-chip-coral'
                       : 'sw-chip sw-chip-sm sw-chip-amber'
  const label = `${plan.monthsSinceReview} mo ago`
  return <span className={cls}>{label}</span>
}

export default function PlanStalenessBanner({
  plans = [],
  maxBanners = 3,
  onReview,
  onDismiss,
}) {
  const [dismissed, setDismissed] = useState(() => new Set())

  const critical = plans.filter(p =>
    p && p.isCritical && !dismissed.has(p.type)
  )
  if (!critical.length) return null

  const visible = critical.slice(0, maxBanners)
  const overflow = critical.length - visible.length

  function handleDismiss(plan) {
    setDismissed(prev => {
      const next = new Set(prev)
      next.add(plan.type)
      return next
    })
    onDismiss?.(plan)
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: '0 16px', marginBottom: 12,
    }}>
      {visible.map((plan, i) => (
        <div
          key={plan.type}
          className={`sw-fade-in-up${plan.isCritical ? ' sw-pulse-glow' : ''}`}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px',
            background: 'var(--c-surface)',
            border: '1px solid color-mix(in srgb, var(--c-gold) 30%, transparent)',
            borderLeft: '4px solid var(--c-gold)',
            borderRadius: '0 12px 12px 0',
            animationDelay: `${i * 60}ms`,
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>⚠</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--c-text)',
              display: 'flex', alignItems: 'center', gap: 8,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              <span style={{
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                minWidth: 0, flex: '0 1 auto',
              }}>
                {planLabel(plan)} plan needs review
              </span>
              {staleChip(plan)}
            </div>
            <div style={{
              fontSize: 'var(--fs-small)', color: 'var(--c-text3)',
              marginTop: 2, lineHeight: 1.4,
            }}>
              {reasonText(plan)}
            </div>
          </div>
          <button
            onClick={() => onReview?.(plan)}
            style={{
              padding: '6px 12px',
              background: 'var(--c-gold)',
              color: 'var(--c-on-gold, #1a1300)',
              border: 'none', borderRadius: 100,
              fontSize: 'var(--fs-small)', fontWeight: 700,
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            Review
          </button>
          <button
            onClick={() => handleDismiss(plan)}
            aria-label="Dismiss"
            style={{
              background: 'none', border: 'none',
              color: 'var(--c-text3)',
              fontSize: 16, cursor: 'pointer',
              padding: 4, flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      ))}

      {overflow > 0 && (
        <button
          onClick={() => { /* intentionally no-op — parent can override via onReview */ }}
          style={{
            alignSelf: 'flex-end',
            padding: '4px 10px',
            background: 'var(--c-surface2)',
            border: '1px solid var(--c-border)',
            color: 'var(--c-text3)',
            fontSize: 'var(--fs-label)', fontWeight: 700,
            borderRadius: 100, cursor: 'pointer',
            letterSpacing: 0.4,
          }}
        >
          +{overflow} more
        </button>
      )}
    </div>
  )
}

export { PlanStalenessBanner }
