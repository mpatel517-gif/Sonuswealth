// ─────────────────────────────────────────────────────────────────────────────
// TappableNumber — X24 mode 3 primitive ("I want this different").
//
// Wraps any significant number with a tiny ⚡ chip. Tapping the chip opens a
// small "What if?" sheet with two routes:
//
//   1. Ask Sonu  → routes to /ask with a prefilled question
//   2. Tweak it   → routes to /cashflow?tab=scenario with this metric seeded
//
// Used wherever a user might reasonably say "what if this were different":
//   · Hero net-worth / assets / liabilities
//   · Per-tile cost-of-waiting lines
//   · Comparative MoM / YoY / Plan chips
//   · L3 drill numbers (per knowledge-halls memo)
//
// Spec source: foundation §1.3 X24 mode 3.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { createPortal } from 'react-dom'

function fmtNum(v, format) {
  const n = +v || 0
  if (format === 'currency') {
    const abs = Math.abs(n)
    const sign = n < 0 ? '−' : ''
    if (abs >= 1_000_000) return `${sign}£${(abs / 1_000_000).toFixed(2)}m`
    if (abs >= 1_000)     return `${sign}£${(abs / 1_000).toFixed(0)}k`
    return `${sign}£${abs.toLocaleString()}`
  }
  if (format === 'pct') return `${(n * 100).toFixed(1)}%`
  if (format === 'score') return `${Math.round(n)}`
  return String(n)
}

export default function TappableNumber({
  value,
  format = 'currency',
  display,                // pre-formatted string override
  question,               // "What happens if I sell my BTL?"
  context = {},           // { metric, assetId, wrapper, ... } — seeds Ask + scenario
  scenarioRoute = '/cashflow?tab=scenario',
  askRoute = '/ask',
  children,               // optional inline content shown inside the trigger
  size = 'inline',        // inline · hero · chip · corner
  style,
}) {
  const [open, setOpen] = useState(false)
  const formatted = display ?? fmtNum(value, format)

  const labelStyle = size === 'hero'
    ? { fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit' }
    : size === 'chip'
    ? { fontSize: 11, fontWeight: 700 }
    : {}

  // Founder UX pass 4 (2026-05-26): when size === 'corner', the bolt floats
  // as a top-right notification badge over the children rather than sitting
  // beside them. This stops the bolt from eating horizontal space + breaking
  // tile symmetry (asymmetric pills on the Balance Sheet hero card).
  if (size === 'corner') {
    return (
      <>
        <span
          style={{
            display: 'block', position: 'relative', width: '100%', height: '100%',
            ...style,
          }}
        >
          {children || formatted}
          <button
            type="button"
            aria-label={`What if this were different — ${question || formatted}`}
            onClick={(e) => { e.stopPropagation(); setOpen(true) }}
            className="sw-press"
            style={{
              position: 'absolute', top: 4, right: 4,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 16, height: 16, borderRadius: '50%',
              border: '1px solid var(--c-border)',
              background: 'var(--c-surface2)',
              color: 'var(--c-text3)',
              fontSize: 9, fontWeight: 700, lineHeight: 1,
              padding: 0, cursor: 'pointer', zIndex: 2,
              transition: 'color 200ms, border-color 200ms, transform 200ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--c-acc)'
              e.currentTarget.style.borderColor = 'var(--c-acc)'
              e.currentTarget.style.transform = 'scale(1.12)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--c-text3)'
              e.currentTarget.style.borderColor = 'var(--c-border)'
              e.currentTarget.style.transform = 'scale(1)'
            }}
          >
            ⚡
          </button>
        </span>
        {open && (
          <WhatIfSheet
            value={value}
            formatted={formatted}
            question={question}
            context={context}
            scenarioRoute={scenarioRoute}
            askRoute={askRoute}
            onClose={() => setOpen(false)}
          />
        )}
      </>
    )
  }

  return (
    <>
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          ...style,
        }}
      >
        <span style={labelStyle}>{children || formatted}</span>
        <button
          type="button"
          aria-label={`What if this were different — ${question || formatted}`}
          onClick={(e) => { e.stopPropagation(); setOpen(true) }}
          className="sw-press"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 18, height: 18, borderRadius: '50%',
            border: '1px solid var(--c-border)',
            background: 'var(--c-surface2)',
            color: 'var(--c-text3)',
            fontSize: 10, fontWeight: 700, lineHeight: 1,
            padding: 0, cursor: 'pointer',
            transition: 'color 200ms, border-color 200ms, transform 200ms',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--c-acc)'
            e.currentTarget.style.borderColor = 'var(--c-acc)'
            e.currentTarget.style.transform = 'scale(1.08)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--c-text3)'
            e.currentTarget.style.borderColor = 'var(--c-border)'
            e.currentTarget.style.transform = 'scale(1)'
          }}
        >
          ⚡
        </button>
      </span>
      {open && (
        <WhatIfSheet
          value={value}
          formatted={formatted}
          question={question}
          context={context}
          scenarioRoute={scenarioRoute}
          askRoute={askRoute}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function WhatIfSheet({ value, formatted, question, context, scenarioRoute, askRoute, onClose }) {
  const safeValue = +value || 0
  const [adj, setAdj] = useState(safeValue)
  const delta = (+adj || 0) - safeValue
  const deltaPct = safeValue !== 0 ? (delta / safeValue) * 100 : 0

  const askQuery = question || `What happens if this changes from ${formatted}?`
  const seed = { ...context, current: value, proposed: adj, formatted }
  // Hrefs are kept for accessibility / right-click / middle-click. JS path
  // intercepts and dispatches an in-app event so we keep persona context and
  // avoid a full page reload.
  const askHref = `${askRoute}?q=${encodeURIComponent(askQuery)}&seed=${encodeURIComponent(JSON.stringify(seed))}`
  const scenarioHref = `${scenarioRoute}&seed=${encodeURIComponent(JSON.stringify(seed))}`

  function launchAsk(e) {
    if (e) e.preventDefault()
    window.dispatchEvent(new CustomEvent('sonus:ask', { detail: { question: askQuery, seed } }))
    onClose()
  }
  function launchScenario(e) {
    if (e) e.preventDefault()
    window.dispatchEvent(new CustomEvent('sonus:scenario', { detail: { seed } }))
    onClose()
  }

  // Portal so the sheet escapes any ancestor with a CSS transform / filter /
  // will-change that would otherwise re-anchor `position: fixed`.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(8, 12, 22, 0.62)',
        backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        animation: 'sw-fade-in 200ms ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480,
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border)',
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          padding: '18px 18px 28px',
          boxShadow: '0 -28px 80px rgba(0, 0, 0, 0.45)',
          animation: 'sw-slide-up 280ms var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1))',
        }}
      >
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'var(--c-text3)', opacity: 0.4,
          margin: '0 auto 14px',
        }} />
        <div style={{
          fontSize: 10, fontWeight: 800, color: 'var(--c-text3)',
          letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6,
        }}>
          What if?
        </div>
        <div style={{
          fontSize: 16, fontWeight: 700, color: 'var(--c-text)',
          lineHeight: 1.35, marginBottom: 14,
        }}>
          {question || `What if ${formatted} were different?`}
        </div>

        {safeValue > 0 && (
          <div style={{
            background: 'var(--c-surface2)', borderRadius: 14,
            padding: 14, marginBottom: 14,
            border: '1px solid var(--c-sep)',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 11, color: 'var(--c-text3)', marginBottom: 6,
            }}>
              <span>Current</span>
              <span>{formatted}</span>
            </div>
            <input
              type="range"
              min={Math.round(safeValue * 0.5)}
              max={Math.round(safeValue * 1.5)}
              step={Math.max(1, Math.round(safeValue / 100))}
              value={adj}
              onChange={(e) => setAdj(+e.target.value)}
              style={{ width: '100%', accentColor: 'var(--c-acc)' }}
            />
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 12, marginTop: 6,
            }}>
              <span style={{ color: 'var(--c-text2)' }}>Proposed</span>
              <span style={{ color: 'var(--c-acc)', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                {fmtNum(adj, 'currency')}
                <span style={{
                  marginLeft: 8, fontSize: 11, fontWeight: 600,
                  color: delta >= 0 ? 'var(--c-acc)' : 'var(--c-coral, #FF6F7D)',
                }}>
                  {delta >= 0 ? '+' : ''}{deltaPct.toFixed(1)}%
                </span>
              </span>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gap: 8 }}>
          <a
            href={askHref}
            onClick={launchAsk}
            className="sw-press"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px 16px', borderRadius: 12,
              background: 'var(--c-acc)', color: 'var(--c-on-accent, #0B1F3A)',
              fontSize: 14, fontWeight: 800, textDecoration: 'none',
              boxShadow: '0 8px 24px rgba(45, 242, 195, 0.28)',
            }}
          >
            <span aria-hidden="true">☉</span> Ask Sonu what happens
          </a>
          <a
            href={scenarioHref}
            onClick={launchScenario}
            className="sw-press"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px 16px', borderRadius: 12,
              background: 'transparent', color: 'var(--c-text)',
              border: '1px solid var(--c-border)',
              fontSize: 14, fontWeight: 700, textDecoration: 'none',
            }}
          >
            Tweak in scenario mode →
          </a>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 16px', borderRadius: 12,
              background: 'transparent', color: 'var(--c-text3)',
              border: 'none', fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
