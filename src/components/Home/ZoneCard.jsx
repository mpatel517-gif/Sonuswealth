// ─────────────────────────────────────────────────────────────────────────────
// ZoneCard — reusable card wrapper for Home zones (Z1–Z14).
// Implements the 9-zone card anatomy: title strip · subtitle · body · footer.
// Visual tokens come from CSS variables; no hardcoded colours.
// ─────────────────────────────────────────────────────────────────────────────

export default function ZoneCard({
  zoneId,
  title,
  subtitle,
  accentColour,
  rightChip,
  footer,
  onTap,
  children,
}) {
  return (
    <div
      onClick={onTap}
      role={onTap ? 'button' : undefined}
      style={{
        margin: '0 16px 10px',
        background: 'var(--c-surface)',
        border: '1px solid var(--c-border)',
        borderRadius: 20,
        padding: '14px 16px',
        cursor: onTap ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {accentColour && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: 3, background: accentColour, opacity: 0.85,
        }} />
      )}

      {(title || rightChip || zoneId) && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 8, marginBottom: subtitle ? 4 : 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {zoneId && (
              <span style={{
                fontSize: 'var(--fs-label)', fontWeight: 700,
                color: 'var(--c-text3)',
                textTransform: 'uppercase', letterSpacing: 0.8,
                flexShrink: 0,
              }}>
                {zoneId}
              </span>
            )}
            {title && (
              <span style={{
                fontSize: 'var(--fs-title)', fontWeight: 700,
                color: 'var(--c-text)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {title}
              </span>
            )}
          </div>
          {rightChip}
        </div>
      )}

      {subtitle && (
        <div style={{
          fontSize: 'var(--fs-small)',
          color: 'var(--c-text3)',
          marginBottom: 10, lineHeight: 1.5,
        }}>
          {subtitle}
        </div>
      )}

      <div>{children}</div>

      {footer && (
        <div style={{
          marginTop: 10, paddingTop: 8,
          borderTop: '1px solid var(--c-sep)',
          fontSize: 'var(--fs-small)',
          color: 'var(--c-text3)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          {footer}
        </div>
      )}
    </div>
  )
}
