// ─────────────────────────────────────────────────────────────────────────────
// DecisionDrawers — "Decisions you can make here", surfaced on the screen that
// owns each topic (My Money / Cashflow / Tax & Estate / Risk). Founder 2026-06-06:
// no standalone Decisions tab; decisions live in context as categorised drawers.
//
// Tapping a decision calls onOpen(id) → Dashboard opens the Decision Engine
// seeded straight into that decision (DecisionEngine initialDecisionId).
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { categoriesForScreen, titleOf } from '../../engine/decision-catalogue.js'

export default function DecisionDrawers({ screen, onOpen, heading = 'Choices you can make here', variant = 'drawers' }) {
  const cats = categoriesForScreen(screen)
  const [open, setOpen] = useState(() => new Set())
  const [sel, setSel] = useState(cats[0]?.id || null)
  if (!cats.length) return null

  const toggle = (id) => setOpen(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  const DecisionRow = (id) => (
    <button key={id}
      onClick={() => onOpen?.(id)}
      className="sw-tile sw-tile-interactive sw-press"
      style={{
        textAlign: 'left', cursor: 'pointer', padding: '10px 12px', width: '100%',
        display: 'flex', alignItems: 'center', gap: 10,
        border: '1px solid var(--c-border)', marginBottom: 4,
      }}>
      {/* Founder 2026-06-08: internal decision code (DE-NN) is not shown to
          users — replaced with a neutral marker. */}
      <span aria-hidden style={{ fontSize: 12, color: 'var(--c-acc)', flexShrink: 0, width: 16, textAlign: 'center' }}>◈</span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>{titleOf(id)}</span>
      <span style={{ fontSize: 16, color: 'var(--c-text3)', fontWeight: 700, flexShrink: 0 }}>›</span>
    </button>
  )

  // ── Chip variant — category pills (like the Balance Sheet / Income Statement
  //    nav) + the selected category's decisions below. Founder 2026-06-06. ──
  if (variant === 'chips') {
    const active = cats.find(c => c.id === sel) || cats[0]
    return (
      <div style={{ marginTop: 4 }}>
        {heading && <div className="sw-eyebrow" style={{ marginBottom: 10 }}>{heading}</div>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {cats.map(c => {
            const on = c.id === active.id
            return (
              <button key={c.id} onClick={() => setSel(c.id)} className="sw-press"
                style={{
                  padding: '7px 13px', borderRadius: 999, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700,
                  border: `1px solid ${on ? 'var(--c-acc)' : 'var(--c-border)'}`,
                  background: on ? 'var(--c-acc-bg)' : 'var(--c-surface2)',
                  color: on ? 'var(--c-acc)' : 'var(--c-text2)',
                }}>
                <span style={{ fontSize: 13 }}>{c.icon}</span>{c.label}
                <span style={{ fontSize: 11, opacity: 0.7 }}>{c.ids.length}</span>
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {active.ids.map(id => DecisionRow(id))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div className="sw-eyebrow" style={{ marginBottom: 8 }}>{heading}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {cats.map(cat => {
          const isOpen = open.has(cat.id)
          return (
            <div key={cat.id} className="sw-tile" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--c-border)' }}>
              <button
                onClick={() => toggle(cat.id)}
                aria-expanded={isOpen}
                className="sw-press"
                style={{
                  width: '100%', cursor: 'pointer', background: isOpen ? 'var(--c-acc-bg)' : 'var(--c-surface2)',
                  border: 'none', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
                }}>
                <span style={{ fontSize: 16, color: 'var(--c-acc)', width: 22, textAlign: 'center', flexShrink: 0 }}>{cat.icon}</span>
                <span style={{ flex: 1, textAlign: 'left', fontSize: 14, fontWeight: 800, color: 'var(--c-text)' }}>{cat.label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text3)' }}>{cat.ids.length}</span>
                <span style={{ fontSize: 14, color: 'var(--c-text3)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s', width: 14, textAlign: 'center' }}>›</span>
              </button>
              {isOpen && (
                <div style={{ padding: '8px 10px 4px' }}>
                  {cat.ids.map(id => (
                    <button key={id}
                      onClick={() => onOpen?.(id)}
                      className="sw-tile sw-tile-interactive sw-press"
                      style={{
                        textAlign: 'left', cursor: 'pointer', padding: '10px 12px', width: '100%',
                        display: 'flex', alignItems: 'center', gap: 10,
                        border: '1px solid var(--c-border)', marginBottom: 4,
                      }}>
                      <span aria-hidden style={{ fontSize: 12, color: 'var(--c-acc)', width: 16, textAlign: 'center', flexShrink: 0 }}>◈</span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>{titleOf(id)}</span>
                      <span style={{ fontSize: 16, color: 'var(--c-text3)', fontWeight: 700, flexShrink: 0 }}>›</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
