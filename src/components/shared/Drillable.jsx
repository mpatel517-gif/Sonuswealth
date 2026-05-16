// ─────────────────────────────────────────────────────────────────────────────
// Drillable — PP-3 wrapper.
// Wraps any clickable number; tap pushes a detail frame onto the overlay stack.
//
// Usage:
//   <Drillable metric="netWorth" onOpen={pushDetail}>
//     <span className="metric">£{nw.toLocaleString()}</span>
//   </Drillable>
//
// The parent (Dashboard or screen) owns the overlay stack state and provides
// `onOpen(metric)`. This component just signals "the user wants to drill X".
//
// Visual affordance:
//   · Hairline mint underline on tappable numbers (Stitch-style typographic anchor)
//   · Subtle scale-down on press
//   · No hover state on touch devices
// ─────────────────────────────────────────────────────────────────────────────


export default function Drillable({
  metric,
  onOpen,
  inline = true,
  affordance = 'underline', // 'underline' | 'chip' | 'none'
  children,
}) {
  if (!metric || !onOpen) return children

  function handleTap(e) {
    e.stopPropagation()
    onOpen(metric)
  }

  // Inline mode — wrap the text in an interactive span
  if (inline) {
    return (
      <button
        onClick={handleTap}
        aria-label={`Drill into ${metric}`}
        className="sw-press"
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          color: 'inherit',
          font: 'inherit',
          textDecoration: affordance === 'underline'
            ? 'underline dotted color-mix(in srgb, var(--c-acc) 35%, transparent)' : 'none',
          textUnderlineOffset: '3px',
          textDecorationThickness: '1px',
          display: 'inline',
        }}
      >
        {children}
      </button>
    )
  }

  // Block mode — wrap an entire tile / chart card
  return (
    <div onClick={handleTap} style={{ cursor: 'pointer' }} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleTap(e) }}>
      {children}
    </div>
  )
}
