// ─────────────────────────────────────────────────────────────────────────────
// ThemeTogglePill — Stitch 58×38 pill toggle (replaces 36px floating circle)
//
// User feedback 2026-05-11: "Navigation is critical. I dont even see a switch
// from dark to light themes." The previous floating top-right circle was too
// small to notice. This pill — direct port from Google Stitch preview.html
// — is unmissable and lives in the screen header.
//
// Behaviour:
//   · Tap → flips theme (delegates to props.onToggle).
//   · Knob slides left↔right on toggle; gradient swaps to match destination.
//   · Active-state press feedback via .sw-press.
//
// Props:
//   theme      'dark' | 'light' — current theme (controlled).
//   onToggle   fn — caller flips theme state.
// ─────────────────────────────────────────────────────────────────────────────

export default function ThemeTogglePill({ theme = 'dark', onToggle }) {
  const isLight = theme === 'light'

  return (
    <button
      type="button"
      onClick={typeof onToggle === 'function' ? onToggle : undefined}
      aria-label={`Switch to ${isLight ? 'dark' : 'light'} theme`}
      title={`Switch to ${isLight ? 'dark' : 'light'} theme`}
      className="sw-press"
      style={{
        position: 'relative',
        width: 58,
        minHeight: 44,
        padding: '4px',
        borderRadius: 999,
        border: '1px solid var(--c-border)',
        background: isLight ? 'var(--c-surface2)' : 'rgba(13,18,27,0.72)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        flexShrink: 0,
        transition: 'background var(--dur-fast, 200ms) ease, border-color var(--dur-fast, 200ms) ease',
      }}
    >
      {/* Knob — slides between left/right; gradient reflects target theme */}
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          fontSize: 14,
          fontWeight: 800,
          // When light: knob right, dark gradient (indicates "switch to dark")
          // When dark:  knob left, mint gradient (indicates "switch to light")
          background: isLight
            ? 'linear-gradient(135deg, #111827, #1c3fe7)'
            : 'linear-gradient(135deg, #2df2c3, #a8ffe2)',
          color: isLight ? '#ffffff' : '#06120f',
          boxShadow: isLight
            ? '0 4px 10px rgba(17,24,39,0.30)'
            : '0 4px 10px color-mix(in srgb, var(--c-acc) 28%, transparent)',
          transform: `translateX(${isLight ? 20 : 0}px)`,
          transition: 'transform 0.3s var(--ease-out-cubic, cubic-bezier(0.33,1,0.68,1)), background 0.3s ease',
        }}
        aria-hidden="true"
      >
        {isLight ? '☾' : '☀'}
      </span>
    </button>
  )
}
