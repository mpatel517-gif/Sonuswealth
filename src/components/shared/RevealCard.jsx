// ─────────────────────────────────────────────────────────────────────────────
// RevealCard — toggleable card chrome with header + chevron
// Spec: home §CR.1, every tab.
//
// State persisted in localStorage at `persistKey`. If `lifeStageGate` is
// provided, the card renders ONLY when entity.lifeStage matches one of the
// listed stages. If `pinByConcern` is set and entity.concerns includes that
// key, the card force-opens (overriding any persisted "closed" state).
//
// Props:
//   cardId           string (used for aria + persistence fallback)
//   title            string
//   defaultOpen      boolean — initial open state if no persisted value
//   persistKey       string — localStorage key (defaults to `revealcard:${cardId}`)
//   lifeStageGate    string[] — render only when entity.lifeStage in this set
//   pinByConcern     string — force-open when entity.concerns includes this key
//   entity           object — needed only if lifeStageGate or pinByConcern set
//   headerAccessory  ReactNode — rendered in header right slot (chips, badges)
//   children         ReactNode
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'

function readOpen(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    return raw === '1'
  } catch { return fallback }
}
function writeOpen(key, open) {
  try { localStorage.setItem(key, open ? '1' : '0') } catch { /* silent */ }
}

export default function RevealCard({
  cardId,
  title,
  defaultOpen = false,
  persistKey,
  lifeStageGate = null,
  pinByConcern = null,
  entity = null,
  headerAccessory = null,
  children,
}) {
  const key = persistKey || `revealcard:${cardId}`

  // Pin-by-concern: if active concern matches, force-open and skip persisted state
  const forceOpen = !!(pinByConcern
    && Array.isArray(entity?.concerns)
    && entity.concerns.includes(pinByConcern))

  // Hooks declared first (rules-of-hooks) — gate after.
  const [open, setOpen] = useState(() =>
    forceOpen ? true : readOpen(key, defaultOpen)
  )
  useEffect(() => {
    if (forceOpen) setOpen(true)
  }, [forceOpen])

  // Life-stage gate (after hooks so render skips cleanly)
  if (lifeStageGate && Array.isArray(lifeStageGate) && lifeStageGate.length) {
    const stage = entity?.lifeStage
    if (!stage || !lifeStageGate.includes(stage)) return null
  }

  function toggle() {
    if (forceOpen) return // user can't close a pinned card
    const next = !open
    setOpen(next)
    writeOpen(key, next)
  }

  return (
    <section
      aria-labelledby={`rc-${cardId}-title`}
      data-open={open ? 'true' : 'false'}
      style={{
        // Phase 2 Batch B — glass-edge surface with subtle inner gradient and
        // soft shadow. Uses existing tokens only (--c-surface, --c-border,
        // --shadow-card-sm) so the parallel theme session keeps full control
        // of the colour primitives.
        background:
          'linear-gradient(180deg, color-mix(in srgb, var(--c-surface2) 60%, var(--c-surface)) 0%, var(--c-surface) 100%)',
        border: '1px solid var(--c-border)',
        borderRadius: 18,
        marginBottom: 12,
        overflow: 'hidden',
        boxShadow: open
          ? 'var(--shadow-card-md, 0 8px 24px rgba(0,0,0,0.18))'
          : 'var(--shadow-card-sm, 0 2px 8px rgba(0,0,0,0.08))',
        transition: 'box-shadow 200ms ease, border-color 200ms ease',
      }}
    >
      {/*
        Header row uses role="button" rather than a real <button> element so
        the headerAccessory can contain its own interactive controls (e.g.
        ExplainerChip is a <button>). Nested HTML <button> elements are
        invalid and trigger React 18 hydration errors. role="button" + keyboard
        handler preserves accessibility without the structural conflict.
      */}
      <div
        role="button"
        tabIndex={forceOpen ? -1 : 0}
        onClick={() => { if (!forceOpen) toggle() }}
        onKeyDown={(e) => {
          if (forceOpen) return
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() }
        }}
        aria-expanded={open}
        aria-controls={`rc-${cardId}-body`}
        aria-disabled={forceOpen || undefined}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '16px 18px',
          background: 'transparent',
          textAlign: 'left',
          cursor: forceOpen ? 'default' : 'pointer',
        }}
      >
        <span
          id={`rc-${cardId}-title`}
          style={{
            fontSize: 'var(--fs-label)', fontWeight: 700,
            color: 'var(--c-text3)',
            textTransform: 'uppercase', letterSpacing: 0.8,
            flex: 1, minWidth: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {title}
          {forceOpen && (
            <span style={{
              marginLeft: 8,
              fontSize: 'var(--fs-label)',
              color: 'var(--c-acc)',
              fontWeight: 700,
            }}>
              · pinned
            </span>
          )}
        </span>

        {headerAccessory && (
          <span
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            // Stop propagation so an inner button (ExplainerChip etc.) doesn't
            // also toggle the card.
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {headerAccessory}
          </span>
        )}

        {!forceOpen && (
          <span style={{
            // Phase 2 Batch B chevron — pill background with rotate-on-open.
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 22, height: 22, borderRadius: '50%',
            fontSize: 13, lineHeight: 1, fontWeight: 700,
            color: open ? 'var(--c-acc)' : 'var(--c-text3)',
            background: open
              ? 'color-mix(in srgb, var(--c-acc) 12%, transparent)'
              : 'var(--c-surface2)',
            border: '1px solid var(--c-border)',
            transition: 'transform .25s cubic-bezier(.4,.0,.2,1), background .25s ease, color .25s ease',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          }}>
            ›
          </span>
        )}
      </div>

      {open && (
        <div
          id={`rc-${cardId}-body`}
          style={{
            padding: '14px 18px 18px',
            borderTop: '1px solid var(--c-sep)',
            // Subtle fade-in so opening doesn't feel jarring.
            animation: 'sw-fade-in 220ms ease-out',
          }}
        >
          {children}
        </div>
      )}
    </section>
  )
}

export { RevealCard }
