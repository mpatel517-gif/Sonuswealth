/**
 * src/components/DecisionTree/index.jsx — Decision Engine tree renderer
 *
 * Renders any validated DE tree regardless of event type.
 * No event-specific logic. One renderer handles all 60 events.
 * Spec: plan §Phase 2 Tree Renderer, D-DE-3.
 */

import { useState } from 'react'
import OptionCard from './OptionCard.jsx'

// ── Helpers ──────────────────────────────────────────────────────────────────

function deadlineColor(days) {
  if (days == null) return 'var(--c-text3)'
  if (days < 90)   return 'var(--c-acc3)'
  if (days < 365)  return 'var(--c-gold)'
  return 'var(--c-text3)'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CompoundChipBar({ events, onDropEvent }) {
  if (!events || events.length <= 1) return null
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
      {events.map(id => (
        <span key={id} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 999,
          background: 'var(--c-acc-bg, rgba(93,219,194,.10))',
          border: '1px solid var(--c-acc)',
          color: 'var(--c-acc)', fontSize: 12, fontWeight: 600,
        }}>
          {id.replace(/_/g, ' ')}
          {onDropEvent && (
            <button onClick={() => onDropEvent(id)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--c-acc)', fontSize: 14, lineHeight: 1, padding: 0,
            }} aria-label={`Remove ${id}`}>×</button>
          )}
        </span>
      ))}
    </div>
  )
}

function DeadlineChips({ conflicts }) {
  const deadlineConflicts = (conflicts ?? []).filter(c => c.with && c.severity)
  if (!deadlineConflicts.length) return null
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0' }}>
      {deadlineConflicts.map((c, i) => {
        const days = c.daysRemaining
        const col = deadlineColor(days)
        return (
          <span key={i} style={{
            padding: '3px 10px', borderRadius: 999, fontSize: 12,
            border: `1px solid ${col}`, color: col,
            background: `${col}18`,
          }}>
            {c.with}{days != null ? ` — ${days}d` : ''}
          </span>
        )
      })}
    </div>
  )
}

function ConflictBand({ conflict }) {
  const isCross = Array.isArray(conflict.between)
  return (
    <div style={{
      margin: '8px 0', padding: '10px 14px', borderRadius: 8,
      background: 'rgba(255,111,125,.10)',
      borderLeft: '3px solid var(--c-acc3)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ color: 'var(--c-acc3)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {conflict.severity?.toUpperCase() ?? 'CONFLICT'}
        </span>
        {isCross && (
          <span style={{ color: 'var(--c-text3)', fontSize: 12 }}>
            ({conflict.between.join(' × ')})
          </span>
        )}
      </div>
      <div style={{ fontWeight: 600, color: 'var(--c-text)', fontSize: 14, marginBottom: 2 }}>
        {conflict.with}
      </div>
      <div style={{ color: 'var(--c-text2)', fontSize: 13 }}>
        {conflict.note}
      </div>
    </div>
  )
}

function ResearchSources({ research }) {
  const [open, setOpen] = useState(false)
  if (!research?.length) return null
  return (
    <div style={{ marginTop: 16, borderTop: '1px solid var(--c-sep)', paddingTop: 12 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--c-text3)', fontSize: 12, padding: 0,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ transform: open ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform .2s' }}>▶</span>
        Sources ({research.length})
      </button>
      {open && (
        <ul style={{ margin: '8px 0 0', padding: '0 0 0 16px', listStyle: 'none' }}>
          {research.map((r, i) => (
            <li key={i} style={{ fontSize: 12, color: 'var(--c-text2)', marginBottom: 4 }}>
              <span style={{
                fontFamily: 'monospace', fontSize: 11,
                color: r.source === 'rules-uk.js' ? 'var(--c-acc)' : 'var(--c-gold)',
                marginRight: 6,
              }}>[{r.source}]</span>
              {r.fact}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DecisionTree({ tree, events, onCommit, onSaveScenario, onDropEvent }) {
  const [expandedId, setExpandedId] = useState(null)
  const [showUnconsidered, setShowUnconsidered] = useState(false)

  if (!tree) return (
    <div style={{ color: 'var(--c-text3)', padding: 24, textAlign: 'center' }}>
      No decision tree to display.
    </div>
  )

  const isCompound = (tree.events ?? []).length > 1
  const recommendedId = tree.recommendation?.pathId
  const enginePure = tree._validation?.dropped === 0

  // Separate named options from unconsidered (option D or last option)
  const allOptions = tree.options ?? []
  const mainOptions = allOptions.filter(o => o.id !== 'D')
  const unconsideredOption = allOptions.find(o => o.id === 'D') ?? null

  return (
    <div style={{
      fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
      color: 'var(--c-text)',
      maxWidth: 900, margin: '0 auto',
    }}>
      {/* Compound event chips */}
      <CompoundChipBar events={tree.events} onDropEvent={onDropEvent} />

      {/* Decision question */}
      <h2 style={{
        fontSize: 20, fontWeight: 700, margin: '0 0 8px',
        color: 'var(--c-text)', lineHeight: 1.3,
      }}>{tree.decision}</h2>

      {/* Contextual statement */}
      {tree.statement && (
        <p style={{
          fontSize: 14, color: 'var(--c-text2)', margin: '0 0 12px', lineHeight: 1.6,
        }}>{tree.statement}</p>
      )}

      {/* Compound statement (if compound) */}
      {isCompound && tree.compoundStatement && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, margin: '0 0 12px',
          background: 'rgba(93,219,194,.08)', borderLeft: '3px solid var(--c-acc)',
        }}>
          <div style={{ fontSize: 12, color: 'var(--c-acc)', fontWeight: 700, marginBottom: 4 }}>
            COMBINED IMPACT
          </div>
          <div style={{ fontSize: 13, color: 'var(--c-text2)' }}>{tree.compoundStatement}</div>
        </div>
      )}

      {/* Engine pure badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {enginePure ? (
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 999,
            background: 'rgba(93,219,194,.12)', color: 'var(--c-acc)',
            border: '1px solid rgba(93,219,194,.3)', fontWeight: 600,
          }}>Engine-pure ✓</span>
        ) : (
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 999,
            background: 'rgba(255,189,89,.12)', color: 'var(--c-gold)',
            border: '1px solid rgba(255,189,89,.3)', fontWeight: 600,
          }}>⚠ {tree._validation?.dropped} consequences dropped</span>
        )}
        {tree._partialConfidence && (
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 999,
            background: 'rgba(255,189,89,.12)', color: 'var(--c-gold)',
            border: '1px solid rgba(255,189,89,.3)',
          }}>Partial confidence</span>
        )}
      </div>

      {/* Deadline chips from conflicts */}
      <DeadlineChips conflicts={tree.conflicts} />

      {/* High-severity conflict bands */}
      {(tree.conflicts ?? []).filter(c => c.severity === 'high').map((c, i) => (
        <ConflictBand key={i} conflict={c} />
      ))}

      {/* Options grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 420px), 1fr))',
        gap: 12, margin: '16px 0',
      }}>
        {mainOptions.map(option => (
          <OptionCard
            key={option.id}
            option={option}
            isRecommended={option.id === recommendedId}
            isUnconsidered={false}
            expanded={expandedId === option.id}
            onToggle={() => setExpandedId(id => id === option.id ? null : option.id)}
            onCommit={() => onCommit?.(option.id)}
            onSaveScenario={() => onSaveScenario?.(option.id)}
          />
        ))}
      </div>

      {/* Show unconsidered toggle */}
      {(unconsideredOption || tree.unconsidered) && (
        <div style={{ margin: '8px 0 16px', textAlign: 'center' }}>
          {!showUnconsidered ? (
            <button onClick={() => setShowUnconsidered(true)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--c-acc)', fontSize: 14, fontWeight: 600, padding: '8px 0',
              textDecoration: 'underline', textDecorationStyle: 'dotted',
            }}>
              + Show the option you didn't think of
            </button>
          ) : (
            unconsideredOption
              ? (
                <OptionCard
                  option={unconsideredOption}
                  isRecommended={false}
                  isUnconsidered={true}
                  expanded={expandedId === 'D'}
                  onToggle={() => setExpandedId(id => id === 'D' ? null : 'D')}
                  onCommit={() => onCommit?.('D')}
                  onSaveScenario={() => onSaveScenario?.('D')}
                />
              )
              : (
                <div style={{
                  padding: '12px 16px', borderRadius: 10, margin: '0 auto',
                  maxWidth: 420, background: 'var(--c-surface2)',
                  border: '1px solid rgba(93,219,194,.25)',
                  textAlign: 'left',
                }}>
                  <div style={{ fontSize: 11, color: 'var(--c-acc)', fontWeight: 700, marginBottom: 6 }}>
                    UNCONSIDERED PATH
                  </div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{tree.unconsidered.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--c-text2)' }}>{tree.unconsidered.why}</div>
                </div>
              )
          )}
        </div>
      )}

      {/* Medium/low conflict bands */}
      {(tree.conflicts ?? []).filter(c => c.severity !== 'high').map((c, i) => (
        <ConflictBand key={`m${i}`} conflict={c} />
      ))}

      {/* Recommendation */}
      {tree.recommendation && (
        <div style={{
          margin: '16px 0 12px', padding: '12px 16px', borderRadius: 10,
          background: 'var(--c-surface2)', borderLeft: '3px solid var(--c-acc)',
        }}>
          <div style={{ fontSize: 12, color: 'var(--c-acc)', fontWeight: 700, marginBottom: 4 }}>
            SONUSWEALTH PERSPECTIVE
          </div>
          <div style={{ fontSize: 14, color: 'var(--c-text)', lineHeight: 1.5 }}>
            {tree.recommendation.rationale}
          </div>
        </div>
      )}

      {/* Adviser CTA */}
      {tree._adviserCTA?.show && (
        <div style={{
          margin: '12px 0', padding: '12px 16px', borderRadius: 10,
          background: 'rgba(255,189,89,.08)', border: '1px solid rgba(255,189,89,.25)',
        }}>
          <div style={{ fontSize: 12, color: 'var(--c-gold)', fontWeight: 700, marginBottom: 4 }}>
            ADVISER REVIEW SUGGESTED
          </div>
          <div style={{ fontSize: 13, color: 'var(--c-text2)' }}>{tree._adviserCTA.message}</div>
        </div>
      )}

      {/* Research sources */}
      <ResearchSources research={tree.research} />

      {/* FCA disclaimer */}
      <p style={{
        fontSize: 11, color: 'var(--c-text3)', marginTop: 16, lineHeight: 1.5,
      }}>
        Not regulated financial advice — verify with a qualified FCA-authorised adviser before acting.
      </p>
    </div>
  )
}
