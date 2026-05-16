// ─────────────────────────────────────────────────────────────────────────────
// PlansSection — Timeline §E. Lists active plans with staleness chips.
// Reads via planFor() / planStaleness() engine stubs (s02a fills these in).
// ─────────────────────────────────────────────────────────────────────────────

import { planFor, planStaleness } from '../../engine/fq-calculator.js'

function safe(fn, fallback) { try { return fn() } catch { return fallback } }

const PLAN_TYPES = [
  { id: 'protection', label: 'Protection plan', glyph: '⛨' },
  { id: 'drawdown',   label: 'Drawdown plan',   glyph: '⊿' },
  { id: 'estate',     label: 'Estate plan',     glyph: '◇' },
  { id: 'cashflow',   label: 'Cashflow plan',   glyph: '≋' },
]

export default function PlansSection({ entity, onWhatIf }) {
  return (
    <div className="card">
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        marginBottom: 12,
      }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Plans</div>
        <button onClick={onWhatIf} style={{
          background:'var(--c-acc-bg)', border:'1px solid rgba(45,242,195,.25)',
          color:'var(--c-acc)', fontSize:'var(--fs-small)', fontWeight: 600,
          borderRadius: 100, padding: '6px 12px', cursor: 'pointer',
        }}>
          What if? →
        </button>
      </div>

      {PLAN_TYPES.map((pt, i) => {
        const plan = safe(() => planFor(entity, pt.id), null)
        const stale = safe(() => planStaleness(entity, pt.id), null) || { stale: false, severity: 'none' }
        const exists = plan != null

        const chipColour = stale.stale
          ? (stale.severity === 'high' ? 'var(--c-acc3)' : 'var(--c-gold)')
          : 'var(--c-acc)'
        const chipLabel = exists ? (stale.stale ? 'Stale' : 'Current') : 'Not started'

        return (
          <div key={pt.id} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 0',
            borderBottom: i === PLAN_TYPES.length - 1 ? 'none' : '1px solid var(--c-sep)',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: exists ? 'var(--c-acc-bg)' : 'var(--c-surface2)',
              color: exists ? 'var(--c-acc)' : 'var(--c-text3)',
              fontSize: 'var(--fs-body)', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {pt.glyph}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--c-text)' }}>
                {pt.label}
              </div>
              <div style={{ fontSize: 'var(--fs-label)', color: 'var(--c-text3)', marginTop: 2 }}>
                {exists ? `Last updated: ${plan.lastUpdated || '—'}` : 'No active plan'}
              </div>
            </div>
            <div style={{
              fontSize: 'var(--fs-label)', fontWeight: 700, color: chipColour,
              background: `${chipColour}1a`, padding: '3px 8px', borderRadius: 100,
            }}>
              {chipLabel}
            </div>
          </div>
        )
      })}
    </div>
  )
}
