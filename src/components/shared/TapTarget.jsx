/**
 * src/components/shared/TapTarget.jsx
 *
 * Phase 8 — S4 DS primitive (2026-05-28)
 *
 * Accessibility-first tappable wrapper. Solves the audit's "keyboard-dead
 * div onClick" pattern (CROSS-SURFACE-PATTERNS #5): every interactive
 * region MUST be a real button/a/role=button with proper keyboard handling.
 *
 * Renders a <button> by default with:
 *   - `type="button"` (never submits forms)
 *   - 44×44 min hit area (Apple HIG / WCAG)
 *   - `cursor: pointer` only when actually interactive
 *   - Enter/Space keyboard activation (free via <button>)
 *
 * Props:
 *   - onTap (required) — fires on click + keyboard activation
 *   - href — when set, renders <a> instead of <button>
 *   - disabled — true → no events fire, aria-disabled, dim styling
 *   - ariaLabel — required for icon-only targets; defaults to children if string
 *
 * Use:
 *   <TapTarget onTap={openDrill} ariaLabel="Open net-worth drill">
 *     <NetWorthTile />
 *   </TapTarget>
 */

export default function TapTarget({
  onTap,
  href,
  disabled = false,
  ariaLabel,
  children,
  style = {},
  className = '',
  ...rest
}) {
  const baseStyle = {
    background: 'none',
    border: 'none',
    padding: 0,
    margin: 0,
    color: 'inherit',
    font: 'inherit',
    textAlign: 'inherit',
    minHeight: 44,
    minWidth: 44,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'inherit',
    ...style,
  }

  const resolvedLabel =
    ariaLabel || (typeof children === 'string' ? children : undefined)

  if (href) {
    return (
      <a
        href={disabled ? undefined : href}
        aria-disabled={disabled || undefined}
        aria-label={resolvedLabel}
        className={`sw-tap-target ${className}`}
        style={{ ...baseStyle, textDecoration: 'none' }}
        onClick={disabled ? (e) => e.preventDefault() : undefined}
        {...rest}
      >
        {children}
      </a>
    )
  }

  return (
    <button
      type="button"
      disabled={disabled}
      aria-disabled={disabled || undefined}
      aria-label={resolvedLabel}
      className={`sw-tap-target ${className}`}
      style={baseStyle}
      onClick={(e) => { if (!disabled) onTap?.(e) }}
      {...rest}
    >
      {children}
    </button>
  )
}
