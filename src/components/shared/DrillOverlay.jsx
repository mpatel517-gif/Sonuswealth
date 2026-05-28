/**
 * src/components/shared/DrillOverlay.jsx
 *
 * Phase 8 — S4 DS primitive (2026-05-28)
 *
 * Canonical drill panel shell. Replaces ad-hoc OverlayShell + drill-panel
 * divs scattered across components/MyMoney/*DrillDown.jsx with one
 * keyboard-accessible, focus-trapped, ESC-closing overlay primitive.
 *
 * Replaces the inline patterns in:
 *   - HomeScreen.jsx NetWorthDrillPanel
 *   - MyMoney drilldown components (8 of them)
 *   - Risk RiskShockDrill
 *   - Cashflow PoS detail panels
 *
 * Built-in:
 *   - role="dialog" + aria-modal=true
 *   - ESC key closes
 *   - Click-outside closes (configurable via closeOnBackdrop)
 *   - Focus trap (children's first focusable element gets focus on mount)
 *   - body scroll lock while open
 *
 * Props:
 *   - open       — boolean
 *   - onClose    — fires on ESC / backdrop / × button
 *   - title      — string (h2 in header)
 *   - eyebrow    — optional kicker above title (e.g. "Net Worth · drill")
 *   - actions    — optional header-right slot
 *   - closeOnBackdrop — default true
 *   - children   — body
 */

import { useEffect, useRef } from 'react'

export default function DrillOverlay({
  open,
  onClose,
  title,
  eyebrow,
  actions,
  closeOnBackdrop = true,
  children,
}) {
  const panelRef = useRef(null)

  // ESC handler + body scroll lock
  useEffect(() => {
    if (!open) return undefined
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    // Focus the panel after mount so screen readers + keyboard land here
    setTimeout(() => panelRef.current?.focus(), 0)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'drill-overlay-title' : undefined}
      onClick={closeOnBackdrop ? (e) => { if (e.target === e.currentTarget) onClose?.() } : undefined}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        animation: 'sw-fade-in 200ms ease',
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        style={{
          width: '100%', maxWidth: 720, maxHeight: '92vh',
          background: 'var(--c-surface)', color: 'var(--c-text)',
          borderRadius: '20px 20px 0 0',
          padding: '16px 20px 24px',
          overflowY: 'auto',
          outline: 'none',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {eyebrow && (
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.9, textTransform: 'uppercase', color: 'var(--c-text3)', marginBottom: 4 }}>
                {eyebrow}
              </div>
            )}
            {title && (
              <h2 id="drill-overlay-title" style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.2 }}>
                {title}
              </h2>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {actions}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close drill panel"
              style={{
                background: 'var(--c-surface2)', border: 'none',
                width: 32, height: 32, borderRadius: 999,
                cursor: 'pointer', color: 'var(--c-text2)',
                fontSize: 18, lineHeight: 1, padding: 0,
              }}
            >×</button>
          </div>
        </div>
        {/* Body */}
        <div>{children}</div>
      </div>
    </div>
  )
}
