// ─────────────────────────────────────────────────────────────────────────────
// Whisper — §13.7 magic: ambient ticker ribbon for non-urgent notifications.
//
// Premium UX = no nagging badge dots. Important-but-not-urgent items surface
// here, at the top of the screen, as quiet 22px-tall ticker text.
//
// Wave 1 scope:
//   · Accepts an array of whispers; renders one at a time; auto-cycles every 8s.
//   · Each whisper: { id, icon, text, cta?, onTap?, severity? }
//   · Snoozable per-item via X (Wave 2 — persists to event store).
//
// Wave 2 will add:
//   · Read-from event store for live whisper feed
//   · Severity-based prioritisation (GREY-AMBIENT tier extension to Notifications v1.0)
//   · Cross-tab whisper propagation
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'

export default function Whisper({
  whispers = [],
  cycleMs = 8000,
  onSnooze,
}) {
  const [idx, setIdx] = useState(0)
  const [visible, setVisible] = useState(true)

  // Auto-cycle when more than 1 whisper exists
  useEffect(() => {
    if (whispers.length <= 1) return
    let timeoutId = null
    const id = setInterval(() => {
      setVisible(false)
      timeoutId = setTimeout(() => {
        setIdx(i => (i + 1) % whispers.length)
        setVisible(true)
      }, 280)
    }, cycleMs)
    return () => { clearInterval(id); if (timeoutId) clearTimeout(timeoutId) }
  }, [whispers.length, cycleMs])

  if (!whispers.length) return null
  const w = whispers[idx]
  if (!w) return null

  return (
    <div
      className="sw-whisper"
      onClick={typeof w.onTap === 'function' ? w.onTap : undefined}
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 280ms ease' }}
    >
      <span className="sw-whisper-icon">{w.icon || '💡'}</span>
      <span className="sw-whisper-text">{w.text}</span>
      {w.cta && <span className="sw-whisper-cta">{w.cta} →</span>}
      {onSnooze && (
        <button
          onClick={(e) => { e.stopPropagation(); onSnooze(w.id) }}
          aria-label="Snooze whisper"
          style={{
            background: 'none', border: 'none', padding: 0,
            color: 'var(--c-text3)', fontSize: 11, cursor: 'pointer',
            marginLeft: 6, flexShrink: 0,
          }}
        >✕</button>
      )}
    </div>
  )
}
