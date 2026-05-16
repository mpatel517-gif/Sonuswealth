// ─────────────────────────────────────────────────────────────────────────────
// ForgottenMoney — §13.4 magic tile for Home.
//
// Proactively surfaces unused/expiring/dormant money the user has rights to.
// Anti-leakage, not asset growth.
//
// 2026-05-12 (post audit Fix #7): per-line `whyHere` + `ifMissed` revealed
// via a tap to expand. Days-until-deadline rendered as a chip when present.
// User's audit said "needs more information, explaining, and why" — this
// closes that gap without inventing copy at render time (engine owns it).
//
// Engine: findForgottenMoney(entity, jurisdiction)
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { findForgottenMoney, totalForgotten } from '../../engine/forgotten-money-engine.js'

const URGENCY_COLOUR = {
  high:   'var(--c-coral)',
  medium: 'var(--c-gold)',
  low:    'var(--c-acc)',
}

const URGENCY_LABEL = {
  high:   'Act soon',
  medium: 'Worth doing',
  low:    'When you can',
}

export default function ForgottenMoney({ entity, onNavigate }) {
  const items = findForgottenMoney(entity) || []
  if (!items.length) return null
  const total = totalForgotten(items)
  const [expandedId, setExpandedId] = useState(null)

  return (
    <div className="sw-tile sw-fade-in" style={{ marginBottom: 12 }}>
      {/* Header — title + total */}
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div>
          <div className="sw-eyebrow" style={{ marginBottom: 2 }}>Forgotten money</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)' }}>
            Money you have rights to that you haven't claimed
          </div>
          <div style={{ fontSize: 11, color: 'var(--c-text2)', marginTop: 4, lineHeight: 1.5 }}>
            Ranked by urgency. Tap any row to see why it's on the list and what happens if it's missed.
          </div>
        </div>
        {total > 0 && (
          <div style={{
            fontSize: 22, fontWeight: 800, color: 'var(--c-gold)',
            letterSpacing: -0.5, flexShrink: 0,
          }}>
            £{Math.round(total).toLocaleString()}
          </div>
        )}
      </div>

      {/* Items list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.slice(0, 4).map(item => {
          const isOpen = expandedId === item.id
          return (
            <div
              key={item.id}
              style={{
                borderRadius: 10,
                background: 'var(--c-tint-neutral)',
                border: '1px solid var(--c-border)',
                overflow: 'hidden',
              }}
            >
              {/* Row — toggle */}
              <button
                onClick={() => setExpandedId(isOpen ? null : item.id)}
                className="sw-press"
                aria-expanded={isOpen}
                aria-controls={`fm-${item.id}-body`}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                }}
              >
                <span style={{
                  width: 7, height: 7, borderRadius: '50%', marginTop: 7,
                  background: URGENCY_COLOUR[item.urgency],
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex', alignItems: 'baseline', gap: 8, justifyContent: 'space-between',
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>
                      {item.label}
                    </span>
                    {item.amount != null && (
                      <span style={{ fontSize: 14, fontWeight: 800, color: URGENCY_COLOUR[item.urgency] }}>
                        £{Math.round(item.amount).toLocaleString()}
                      </span>
                    )}
                  </div>
                  {/* Urgency + deadline chips */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                    marginTop: 4,
                  }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 100,
                      background: `${URGENCY_COLOUR[item.urgency]}22`,
                      color: URGENCY_COLOUR[item.urgency],
                      fontSize: 10, fontWeight: 700, letterSpacing: 0.4,
                      textTransform: 'uppercase',
                    }}>
                      {URGENCY_LABEL[item.urgency]}
                    </span>
                    {item.daysUntilDeadline != null && item.daysUntilDeadline > 0 && (
                      <span style={{
                        fontSize: 11, color: 'var(--c-text3)',
                      }}>
                        {item.daysUntilDeadline} days to act
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.5, marginTop: 6,
                  }}>
                    {item.detail}
                  </div>
                </div>
                <span style={{
                  fontSize: 14, color: 'var(--c-text3)',
                  transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform .2s ease', flexShrink: 0, marginTop: 4,
                }}>›</span>
              </button>

              {/* Expanded body — whyHere + ifMissed + action button */}
              {isOpen && (
                <div
                  id={`fm-${item.id}-body`}
                  style={{
                    padding: '0 12px 12px',
                    borderTop: '1px solid var(--c-border)',
                    paddingTop: 10,
                    marginLeft: 25,
                  }}
                >
                  {item.whyHere && (
                    <div style={{ marginBottom: 8 }}>
                      <div className="sw-eyebrow" style={{
                        fontSize: 10, color: 'var(--c-acc)', marginBottom: 4, letterSpacing: 0.6,
                      }}>
                        Why this is on your list
                      </div>
                      <div style={{
                        fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.55,
                      }}>{item.whyHere}</div>
                    </div>
                  )}
                  {item.ifMissed && (
                    <div style={{ marginBottom: 10 }}>
                      <div className="sw-eyebrow" style={{
                        fontSize: 10, color: URGENCY_COLOUR[item.urgency],
                        marginBottom: 4, letterSpacing: 0.6,
                      }}>
                        If you don't act
                      </div>
                      <div style={{
                        fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.55,
                      }}>{item.ifMissed}</div>
                    </div>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); onNavigate?.(item.destination) }}
                    className="sw-press"
                    style={{
                      padding: '8px 16px',
                      background: 'var(--c-acc)',
                      color: 'var(--c-bg)',
                      border: 'none',
                      borderRadius: 100,
                      fontSize: 12, fontWeight: 700,
                      letterSpacing: 0.3,
                      cursor: 'pointer',
                    }}
                  >
                    {item.action} →
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
