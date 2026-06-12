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

import { useEffect, useRef } from 'react'

const FOCUSABLE = 'a[href],area[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),[tabindex]:not([tabindex="-1"])'

export default function OverlayShell({
  title,
  subtitle,
  onBack,
  onHome,
  rightSlot,
  children,
  contentStyle,
}) {
  const dialogRef = useRef(null)

  // a11y (D5): Escape returns via onBack; Tab is trapped inside the dialog so
  // keyboard focus can't leak to the screen behind a modal overlay. On open,
  // focus moves into the dialog; on close, it returns to the previously-focused
  // element so keyboard/screen-reader users aren't dropped at the top of the DOM.
  useEffect(() => {
    const prevFocus = typeof document !== 'undefined' ? document.activeElement : null
    const node = dialogRef.current
    // Move focus into the dialog (the container is tabIndex=-1 so it can hold focus).
    if (node) node.focus()

    function onKey(e) {
      if (e.key === 'Escape' && typeof onBack === 'function') { onBack(); return }
      if (e.key !== 'Tab' || !node) return
      const items = Array.from(node.querySelectorAll(FOCUSABLE))
        .filter(el => el.offsetParent !== null || el === node)
      if (items.length === 0) { e.preventDefault(); node.focus(); return }
      const first = items[0], last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      // Restore focus to where the user was before the overlay opened.
      if (prevFocus && typeof prevFocus.focus === 'function') {
        try { prevFocus.focus() } catch { /* element gone — ignore */ }
      }
    }
  }, [onBack])

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 500,
        background: 'var(--c-bg)',
        display: 'flex',
        flexDirection: 'column',
        outline: 'none',
      }}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          // D12 — respect the device safe-area (notch / Dynamic Island) at the top.
          padding: 'max(14px, env(safe-area-inset-top)) 16px 12px',
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
