// ─────────────────────────────────────────────────────────────────────────────
// OverlayShell — unified chrome for every full-screen overlay
// ─────────────────────────────────────────────────────────────────────────────
// D08 / DQ-42 fix. Before: three inconsistent patterns (← Back · ✕ · Done).
// After: every full-screen overlay uses this shell.
//
// Contract:
//   · Top-left: always "← Back" — returns to the screen the user came from
//   · Top-right: optional "Home" pill — jumps straight to radar (bypassing deep
//     overlay stacks); renders only when onHome is passed
//   · Escape key: calls onBack
//   · Respects --c-bg / --c-sep / typography tokens from index.css
//
// Usage:
//   <OverlayShell title="Settings" onBack={() => setOpen(false)}>
//     ...content...
//   </OverlayShell>
//
// Bottom-sheet overlays (modal dialogs that don't replace the whole screen)
// keep their existing pattern; OverlayShell is for full-screen paths only.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react'

export default function OverlayShell({
  title,
  subtitle,
  onBack,
  onHome,
  rightSlot,
  children,
  contentStyle,
}) {
  // Escape key returns via onBack (not onHome — escape is always "go back one")
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && typeof onBack === 'function') onBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 500,
        background: 'var(--c-bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px 12px',
          borderBottom: '1px solid var(--c-sep)',
          flexShrink: 0,
          background: 'var(--c-bg)',
        }}
      >
        <button
          onClick={() => typeof onBack === 'function' && onBack()}
          aria-label="Back"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--c-acc)',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            padding: '4px 0',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 17, lineHeight: 1 }}>←</span>
          <span>Back</span>
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          {title && (
            <div
              style={{
                fontSize: 'var(--fs-title, 17px)',
                fontWeight: 700,
                color: 'var(--c-text)',
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {title}
            </div>
          )}
          {subtitle && (
            <div
              style={{
                fontSize: 'var(--fs-label, 11px)',
                color: 'var(--c-text3)',
                marginTop: 2,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {subtitle}
            </div>
          )}
        </div>

        {/* Optional right slot (e.g. score badge, Home pill) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {rightSlot}
          {onHome && (
            <button
              onClick={onHome}
              aria-label="Go to Home"
              style={{
                background: 'var(--c-surface2)',
                border: '1px solid var(--c-sep)',
                borderRadius: 100,
                padding: '6px 14px',
                fontSize: 'var(--fs-small, 13px)',
                fontWeight: 600,
                color: 'var(--c-text2)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                lineHeight: 1,
              }}
            >
              <span style={{ fontSize: 13 }}>⌂</span>
              <span>Home</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          ...contentStyle,
        }}
      >
        {children}
      </div>
    </div>
  )
}
