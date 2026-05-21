/**
 * src/screens/DecisionEngineV2.jsx — Dynamic Decision Engine screen
 *
 * New dynamic engine — one screen handles all 60 ontology events.
 * Wraps useOrchestrator + DecisionTree component.
 *
 * Opened from:
 *   a) HomeScreen "Ask any life question" entry point
 *   b) Ask.jsx when intent === 'act' | 'model' (finance-shaped query)
 *   c) Pre-matched eventIds (e.g. from What-if cinema chips)
 *
 * Spec: plan §Phase 4, D-DE-2.
 * The original 9-step wizard (DecisionEngine.jsx) remains for existing property flow.
 */

import { useState, useEffect, useRef } from 'react'
import { useOrchestrator, DE_STATE }   from '../de/orchestrator.js'
import DecisionTree                    from '../components/DecisionTree/index.jsx'

// ── Starter questions ─────────────────────────────────────────────────────────

const STARTER_QUESTIONS = [
  { q: 'Should I buy a second property?',              event: 'buy_second_home' },
  { q: 'Can I afford to retire in 3 years?',           event: 'retire' },
  { q: 'How do I reduce my IHT before April 2027?',   event: 'iht_planning' },
  { q: "I'm going part-time — what's the impact?",     event: 'part_time' },
  { q: 'What do I do with a large inheritance?',       event: 'inheritance_received' },
  { q: 'Should I set up a trust for my children?',     event: 'setup_trust' },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function InputBar({ onSubmit, loading, placeholder }) {
  const [val, setVal] = useState('')
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus() }, [])

  const submit = () => {
    const q = val.trim()
    if (!q || loading) return
    onSubmit(q)
    setVal('')
  }

  return (
    <div style={{
      display: 'flex', gap: 10, padding: '12px 16px',
      background: 'var(--c-surface)', borderTop: '1px solid var(--c-sep)',
      position: 'sticky', bottom: 0, zIndex: 10,
    }}>
      <input
        ref={ref}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submit()}
        placeholder={placeholder ?? 'Ask any life question…'}
        disabled={loading}
        style={{
          flex: 1, padding: '10px 14px', borderRadius: 10,
          border: '1px solid var(--c-sep)',
          background: 'var(--c-surface2)', color: 'var(--c-text)',
          fontSize: 14, fontFamily: 'inherit', outline: 'none',
        }}
      />
      <button onClick={submit} disabled={!val.trim() || loading} style={{
        padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
        background: val.trim() && !loading ? 'var(--c-acc)' : 'var(--c-surface2)',
        color: val.trim() && !loading ? 'var(--c-acc-contrast, #0B1F3A)' : 'var(--c-text3)',
        fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
        transition: 'background .15s',
      }}>
        {loading ? '…' : 'Go'}
      </button>
    </div>
  )
}

function LoadingIndicator({ fsm }) {
  const LABELS = {
    [DE_STATE.ONTOLOGY_MATCH]:      'Matching your question…',
    [DE_STATE.MULTI_EVENT_COMPOSE]: 'Merging event contexts…',
    [DE_STATE.CONTEXT_GATHER]:      'Reading your financial picture…',
    [DE_STATE.PROMPT_BUILD]:        'Assembling prompt…',
    [DE_STATE.CLAUDE_CALL]:         'Generating decision tree…',
    [DE_STATE.VALIDATE]:            'Validating with engines…',
    [DE_STATE.FOLLOW_UP]:           'Processing your answers…',
  }
  const label = LABELS[fsm]
  if (!label) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '20px', color: 'var(--c-text2)', fontSize: 14,
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
        border: '2px solid var(--c-acc)', borderTopColor: 'transparent',
        animation: 'de-spin 0.8s linear infinite',
      }} />
      {label}
      <style>{`@keyframes de-spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function FollowUpPanel({ followUp, round, onAnswer }) {
  const [answers, setAnswers] = useState([])
  if (!followUp?.needsFollowUp) return null

  const set = (i, v) => setAnswers(prev => { const a = [...prev]; a[i] = v; return a })
  const ready = followUp.questions.every((_, i) => (answers[i] ?? '').trim())

  return (
    <div style={{
      margin: '16px 20px', padding: 16, borderRadius: 12,
      background: 'var(--c-surface2)', border: '1px solid var(--c-sep)',
    }}>
      <div style={{
        fontSize: 12, color: 'var(--c-text3)', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12,
      }}>Round {round} of 3 — a few more details</div>

      {followUp.questions.map((q, i) => (
        <div key={i} style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 13, color: 'var(--c-text2)', display: 'block', marginBottom: 5 }}>{q}</label>
          <input
            value={answers[i] ?? ''}
            onChange={e => set(i, e.target.value)}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 8, boxSizing: 'border-box',
              border: '1px solid var(--c-sep)', background: 'var(--c-surface)',
              color: 'var(--c-text)', fontSize: 14, fontFamily: 'inherit',
            }}
          />
        </div>
      ))}

      <button
        onClick={() => onAnswer(followUp.questions, answers, round)}
        disabled={!ready}
        style={{
          padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
          background: ready ? 'var(--c-acc)' : 'var(--c-surface3)',
          color: ready ? 'var(--c-acc-contrast, #0B1F3A)' : 'var(--c-text3)',
          fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
        }}
      >Refine tree</button>
    </div>
  )
}

function IdleState({ onSelect }) {
  return (
    <div style={{ padding: '24px 20px' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>Ask any life question</h2>
      <p style={{ fontSize: 14, color: 'var(--c-text2)', margin: '0 0 20px', lineHeight: 1.6 }}>
        Describe a financial life decision in plain English. The engine produces a real decision tree —
        options, consequences, deadlines, risks, and the option you didn't think of.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {STARTER_QUESTIONS.map(({ q, event }, i) => (
          <button
            key={i}
            onClick={() => onSelect(q, [event])}
            style={{
              padding: '7px 13px', borderRadius: 999,
              border: '1px solid var(--c-sep)',
              background: 'var(--c-surface2)', color: 'var(--c-text2)',
              fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >{q}</button>
        ))}
      </div>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

/**
 * @param {object}   props.entity             User financial entity
 * @param {string}   [props.initialQuery]     Auto-run on mount
 * @param {string[]} [props.initialEventIds]  Pre-matched events (skip matching)
 * @param {function} [props.onClose]          Called on close/commit/save
 */
export default function DecisionEngineV2({ entity, initialQuery, initialEventIds, onClose }) {
  const orc = useOrchestrator(entity)
  const [currentQuery, setCurrentQuery] = useState('')
  const [followUpRound, setFollowUpRound] = useState(0)
  const [commitDone, setCommitDone] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (initialQuery && orc?.isIdle) {
      setCurrentQuery(initialQuery)
      orc.run(initialQuery, { eventIds: initialEventIds })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (orc?.tree) {
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    }
  }, [orc?.tree])

  if (!orc) return null

  const handleSubmit = (q, preEvents) => {
    setCurrentQuery(q)
    setFollowUpRound(0)
    orc.run(q, { eventIds: preEvents ?? initialEventIds })
  }

  const handleFollowUp = async (questions, answers, round) => {
    setFollowUpRound(round)
    await orc.answerFollowUp(questions, answers, round, currentQuery)
  }

  const handleDropEvent = (eventId) => {
    const updated = (orc.eventIds ?? []).filter(id => id !== eventId)
    if (updated.length > 0) orc.run(currentQuery, { eventIds: updated })
  }

  const handleCommit = (pathId) => {
    const planId = orc.commit(pathId)
    setCommitDone(true)
    setTimeout(() => onClose?.({ committed: true, planId, pathId }), 1500)
  }

  const handleSaveScenario = (pathId) => {
    const draftId = orc.saveScenario(pathId)
    onClose?.({ saved: true, draftId, pathId })
  }

  if (commitDone) return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      height:'100%', gap:16, background:'var(--c-bg)', color:'var(--c-text)',
    }}>
      <div style={{ fontSize:40 }}>✓</div>
      <div style={{ fontSize:16, fontWeight:700 }}>Plan committed</div>
      <div style={{ fontSize:12, color:'var(--c-text3)' }}>Taking you to your Timeline…</div>
    </div>
  )

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
      color: 'var(--c-text)', background: 'var(--c-bg)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px', borderBottom: '1px solid var(--c-sep)',
        background: 'var(--c-surface)', flexShrink: 0,
      }}>
        {onClose && (
          <button
            onClick={() => { orc.cancel(); orc.reset(); onClose({ cancelled: true }) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text3)', fontSize: 18, padding: 0 }}
          >←</button>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Decision Engine</div>
          <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>60 life events · engine-pure · FCA-compliant</div>
        </div>
        {orc.isLoading && (
          <button onClick={orc.cancel} style={{
            padding: '4px 10px', borderRadius: 6, border: '1px solid var(--c-sep)',
            background: 'none', color: 'var(--c-text3)', fontSize: 12, cursor: 'pointer',
            fontFamily: 'inherit',
          }}>Cancel</button>
        )}
        {orc.isDone && (
          <button onClick={() => { orc.reset(); setCurrentQuery('') }} style={{
            padding: '4px 10px', borderRadius: 6, border: '1px solid var(--c-sep)',
            background: 'none', color: 'var(--c-acc)', fontSize: 12, cursor: 'pointer',
            fontFamily: 'inherit',
          }}>New</button>
        )}
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Idle state */}
        {orc.isIdle && !currentQuery && (
          <IdleState onSelect={handleSubmit} />
        )}

        {/* Loading */}
        <LoadingIndicator fsm={orc.fsm} />

        {/* Error */}
        {orc.error && (
          <div style={{
            margin: '16px 20px', padding: '12px 16px', borderRadius: 10,
            background: 'rgba(255,111,125,.08)', border: '1px solid var(--c-acc3)',
            color: 'var(--c-acc3)', fontSize: 14,
          }}>
            {orc.error === 'service_unavailable'
              ? 'Service temporarily unavailable — please try again later.'
              : `Something went wrong — please try again.`}
          </div>
        )}

        {/* Empty result — tree null after run completed OR pipeline cancelled mid-flight */}
        {!orc.isLoading && !orc.tree && !orc.error && currentQuery && !orc.followUp?.needsFollowUp && (
          <div style={{ margin: '20px', padding: '16px 18px', borderRadius: 14, background: 'var(--c-surface)', border: '1px solid var(--c-sep)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text)', marginBottom: 6 }}>Couldn't generate a decision tree</div>
            <div style={{ fontSize: 13, color: 'var(--c-text2)', lineHeight: 1.6, marginBottom: 14 }}>
              This can happen if the AI service isn't reachable (check your API key in <code style={{ fontSize: 11, background: 'var(--c-surface2)', padding: '1px 5px', borderRadius: 4 }}>.env.local</code>) or the question needs rephrasing. Try being more specific — e.g. "Should I start pension drawdown before April 2027?" rather than a general topic.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => handleSubmit(currentQuery)} style={{ padding: '8px 16px', borderRadius: 100, background: 'var(--c-acc)', border: 'none', color: 'var(--c-bg)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Try again →
              </button>
              <button onClick={() => { setCurrentQuery(''); orc.reset?.() }} style={{ padding: '8px 16px', borderRadius: 100, background: 'var(--c-surface2)', border: '1px solid var(--c-sep)', color: 'var(--c-text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                New question
              </button>
            </div>
          </div>
        )}

        {/* Tree */}
        {orc.tree && (
          <div ref={scrollRef} style={{ padding: '16px 20px' }}>
            {/* Validation summary */}
            {orc.report && (
              <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 8, display: 'flex', gap: 12 }}>
                <span>{orc.report.validated} engine-validated consequences</span>
                {orc.report.dropped > 0 && (
                  <span style={{ color: 'var(--c-gold)' }}>⚠ {orc.report.dropped} dropped</span>
                )}
              </div>
            )}
            <DecisionTree
              tree={orc.tree}
              events={orc.eventIds}
              onCommit={handleCommit}
              onSaveScenario={handleSaveScenario}
              onDropEvent={(orc.eventIds?.length ?? 0) > 1 ? handleDropEvent : null}
            />
          </div>
        )}

        {/* Follow-up */}
        {orc.followUp?.needsFollowUp && !orc.isLoading && (
          <FollowUpPanel
            followUp={orc.followUp}
            round={followUpRound + 1}
            onAnswer={handleFollowUp}
          />
        )}
      </div>

      {/* Input bar */}
      <InputBar
        onSubmit={handleSubmit}
        loading={orc.isLoading}
        placeholder={orc.tree ? 'Ask a follow-up or try another question…' : 'Ask any life question…'}
      />
    </div>
  )
}
