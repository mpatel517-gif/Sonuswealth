// ─────────────────────────────────────────────────────────────────────────────
// AskPill — persistent floating Ask AI pill (D-ASK-1)
// ─────────────────────────────────────────────────────────────────────────────
// Spec: 2-Product-ai-ask-v1_0.md §3 + §4
//   · 52px tall, anchored 86px above bottom (78 nav + 8 gap)
//   · Visible on every primary tab; hidden on sub-screens / overlays
//   · Tap → opens the Ask sheet (D-SHEET-1)
//   · Persona-aware register: chip prompt rotates by archetype (§14, §Q7A)
//
// Polish:
//   · Mint-tinted backdrop-blur surface, semi-transparent
//   · Subtle .sw-pulse-glow on the logo dot (ambient attention)
//   · Cross-fade placeholder text (200ms opacity) on tab change
//   · Hover lift via .sw-lift, tap press via .sw-press
//
// Props:
//   onTap          fn      — caller opens the sheet
//   hidden         bool    — caller forces hide on overlay / sub-screen
//   archetype      string  — optional persona archetype to colour the pill
//   tabHint        string  — current tab id, drives ambient prompt text
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'

// Ambient prompt, varies by tab. Spec §5 per-tab context injection.
const TAB_PROMPT = {
  home:  'Ask about your Wealth Score…',
  money: 'Ask about your portfolio…',
  flow:  'Ask about cashflow…',
  tax:   'Ask about IHT or drawdown…',
  risk:  'Ask about your Risk Score…',
  plan:  'Ask about your timeline…',
}

export default function AskPill({ onTap, hidden = false, tabHint = 'home' }) {
  // archetype prop reserved for §14 persona-aware register colour treatment
  const placeholder = TAB_PROMPT[tabHint] || 'Ask anything…'

  // Cross-fade the placeholder when tabHint changes (200ms opacity).
  const [shownText, setShownText]   = useState(placeholder)
  const [textVisible, setTextVisible] = useState(true)
  const firstRender = useRef(true)

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      setShownText(placeholder)
      return
    }
    // Fade out → swap → fade in
    setTextVisible(false)
    const t1 = setTimeout(() => setShownText(placeholder), 200)
    const t2 = setTimeout(() => setTextVisible(true),     220)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [placeholder])

  if (hidden) return null

  return (
    <button
      onClick={typeof onTap === 'function' ? onTap : undefined}
      aria-label="Open Ask AI"
      className="sw-lift sw-press sw-ask-pill"
      style={{
        // FIXED (not absolute) so it pins to the viewport bottom and does NOT
        // scroll up the page over content like the radar (founder 2026-06-01:
        // "covering the radar, it moves after I scroll"). left/right live in
        // .sw-ask-pill so desktop clears the 240px sidebar; mobile = 16/16.
        position: 'fixed',
        bottom: 86, // 78 nav + 8 gap
        height: 52,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 14px 0 10px',
        borderRadius: 26,
        // Theme-aware surface via tokens — `--card-bg2` swaps between dark and
        // light. Mint accent applies via color-mix so it scales to the theme
        // accent in both palettes.
        background: 'var(--card-bg2)',
        backdropFilter: 'blur(14px) saturate(140%)',
        WebkitBackdropFilter: 'blur(14px) saturate(140%)',
        border: '1px solid color-mix(in srgb, var(--c-acc) 25%, var(--c-border))',
        boxShadow: 'var(--sh2, 0 10px 28px rgba(0,0,0,0.20))',
        color: 'var(--c-text)',
        cursor: 'pointer',
      }}
    >
      {/* Logo dot — subtle pulse-glow draws the eye */}
      <div
        className="sw-pulse-glow"
        style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--c-acc, #7dffcf), var(--c-acc2, #20c7ff))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--c-on-accent, #07111f)', fontSize: 17, fontWeight: 800, flexShrink: 0,
          boxShadow: '0 4px 12px color-mix(in srgb, var(--c-acc) 30%, transparent)',
        }}
      >
        ✦
      </div>

      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <div
          style={{
            fontSize: 13, fontWeight: 700, color: 'var(--c-text)',
            lineHeight: 1.1, letterSpacing: 0.1,
          }}
        >
          Ask Sonu
        </div>
        <div
          style={{
            fontSize: 11, color: 'var(--c-text3)', marginTop: 2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            opacity: textVisible ? 1 : 0,
            transition: 'opacity 200ms var(--ease-out-cubic, cubic-bezier(0.33,1,0.68,1))',
          }}
        >
          {shownText}
        </div>
      </div>

      <span
        style={{
          fontSize: 16, color: 'var(--c-mint-text, #5DEACA)',
          fontWeight: 700, marginRight: 2,
        }}
        aria-hidden="true"
      >
        ›
      </span>
    </button>
  )
}
