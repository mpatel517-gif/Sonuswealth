// ─────────────────────────────────────────────────────────────────────────────
// AssumptionsChip — point-of-use transparency for any projection that depends on
// the capital-market assumptions. Shows the growth + inflation actually used and
// links straight to the editor, so the numbers behind a forecast are never a
// black box. Drop it into the middle[] slot of a CMA-driven L3 panel.
//
// Tapping dispatches a decoupled window event the Dashboard listens for, opening
// Settings → Market assumptions (no prop-drilling through the drill stack).
// ─────────────────────────────────────────────────────────────────────────────

import { useActiveCMA } from '../../../state/useActiveCMA.js'

const pct = (r) => `${(r * 100).toFixed(1)}%`

export function AssumptionsChip() {
  const { cma, modified } = useActiveCMA()
  const open = () => {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('sonus:open-assumptions'))
  }
  return (
    <button
      type="button"
      onClick={open}
      data-assumptions-chip
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        padding: '8px 10px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
        border: '1px solid var(--c-border-subtle, rgba(255,255,255,0.08))',
        background: 'var(--c-surface, rgba(255,255,255,0.03))',
        color: 'var(--c-text2)', fontSize: 'var(--fs-xsmall, 11px)', lineHeight: 1.4,
      }}
    >
      <span aria-hidden style={{ fontSize: 13, opacity: 0.8 }}>📈</span>
      <span style={{ flex: 1 }}>
        Based on <strong style={{ color: 'var(--c-text)' }}>{pct(cma.growth)}</strong> growth
        {' · '}<strong style={{ color: 'var(--c-text)' }}>{pct(cma.inflation)}</strong> inflation a year
      </span>
      {modified && (
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
          padding: '2px 6px', borderRadius: 999,
          background: 'rgba(93,219,194,0.15)', color: 'var(--c-acc, #5ddbc2)',
        }}>
          Adjusted
        </span>
      )}
      <span aria-hidden style={{ color: 'var(--c-acc, #5ddbc2)', fontWeight: 600 }}>Adjust →</span>
    </button>
  )
}
