/**
 * src/components/shared/ConfidenceChip.jsx
 *
 * Phase 7 CX-3 + Phase 8 DS primitive (2026-05-28)
 *
 * Lifted from the local ConfBadge in Risk.jsx — shared so any surface
 * (Home anchor row, Cashflow PoS card, TaxEstate IHT projection) can show
 * a "high/medium/low confidence" chip without re-implementing the colour
 * and label logic locally.
 *
 * Audit CX-3: "Confidence chip never rendered anywhere" — was only used on
 * Risk. Now exported so Home + Cashflow + Tax can consume.
 *
 * Variant prop:
 *   - level: 'high' | 'medium' | 'low'  → semantic colour
 *   - size:  'sm' | 'md'                 → density
 *
 * Example:
 *   <ConfidenceChip level={risk.confidenceLevel} />
 */

export default function ConfidenceChip({ level = 'low', size = 'sm', label }) {
  const cls = {
    high:   'sw-chip-blue',
    medium: 'sw-chip-amber',
    low:    'sw-chip-coral',
  }[level] || 'sw-chip-coral'

  const sizeCls = size === 'md' ? '' : 'sw-chip-sm'

  const text = label || {
    high:   'High confidence',
    medium: 'Medium confidence',
    low:    'Low confidence',
  }[level] || 'Confidence pending'

  return (
    <span
      className={`sw-chip ${sizeCls} ${cls}`}
      role="status"
      aria-label={text}
    >
      {text}
    </span>
  )
}
