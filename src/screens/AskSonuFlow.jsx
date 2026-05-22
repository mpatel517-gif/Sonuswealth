// ─────────────────────────────────────────────────────────────────────────────
// ASK SONU FLOW
//
// Single-engine, two-surface answer flow. Replaces the old "pick a chip"
// situation tab. User types ANY life question, system asks 0-3 adaptive
// follow-ups (information-gain), then shows a hierarchical answer:
//
//   Personal intro · Sonu's call · Why · 3 supporting · Other (collapsed) · 4 challenges
//
// Powered by /engine/ask-sonu — deterministic, no LLM call required.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect } from 'react'
import { askSonu, addAnswer } from '../engine/ask-sonu/index.js'

const STARTER_PROMPTS = [
  'I want to retire and withdraw £70k a year from my pension',
  'How can I reduce my IHT before April 2027?',
  'I want to relocate abroad — what should I think about?',
  'I\'m getting divorced — what matters financially?',
  'I want to give £100k to my children',
  'Should I sell my business next year?',
]

function fmtGBP(n) {
  if (n == null) return '—'
  if (Math.abs(n) >= 1000000) return '£' + (n/1000000).toFixed(1) + 'M'
  if (Math.abs(n) >= 1000)    return '£' + (n/1000).toFixed(0) + 'k'
  return '£' + Math.round(n).toLocaleString('en-GB')
}

const CATEGORY_ICON = {
  tax_pension:  '💰',
  iht:          '🏛',
  relocation:   '🌍',
  relocation_lifestyle: '🌍',
  family:       '👥',
  healthcare:   '🏥',
  protection:   '🛡',
  investment:   '📈',
  lifestyle:    '🌅',
}

const CATEGORY_LABEL = {
  tax_pension:  'Tax & Pension',
  iht:          'IHT & Legacy',
  relocation:   'Cross-Border',
  relocation_lifestyle: 'Lifestyle',
  family:       'Family Law',
  healthcare:   'Later Life',
  protection:   'Protection',
  investment:   'Investment',
  lifestyle:    'Lifestyle',
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function QueryInput({ onSubmit, disabled }) {
  const [val, setVal] = useState('')
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus() }, [])

  const submit = () => {
    const q = val.trim()
    if (!q || disabled) return
    onSubmit(q)
  }

  return (
    <div style={{ padding: '20px 16px 8px' }}>
      <div className="sw-eyebrow" style={{ marginBottom: 8 }}>Ask Sonu anything</div>
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px', lineHeight: 1.25 }}>
        One clear answer.<br/>Plus the path to get there.
      </h2>
      <p style={{ fontSize: 13, color: 'var(--c-text2)', lineHeight: 1.55, margin: '0 0 16px' }}>
        Describe any life or money question in plain English. Sonu routes to the right specialists,
        asks at most 3 follow-ups, then gives you the lead recommendation plus 4 paths you can challenge.
      </p>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          ref={ref}
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder='e.g. "I want to retire and live on £70k a year"'
          disabled={disabled}
          style={{
            flex: 1, padding: '12px 14px', borderRadius: 12,
            border: '1.5px solid var(--c-sep)',
            background: 'var(--c-surface)', color: 'var(--c-text)',
            fontSize: 14, fontFamily: 'inherit', outline: 'none',
          }}
        />
        <button onClick={submit} disabled={!val.trim() || disabled} style={{
          padding: '12px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
          background: val.trim() && !disabled ? 'var(--c-acc)' : 'var(--c-surface2)',
          color: val.trim() && !disabled ? '#0B1F3A' : 'var(--c-text3)',
          fontWeight: 800, fontSize: 14, fontFamily: 'inherit',
        }}>Ask</button>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>
          Or try one of these
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {STARTER_PROMPTS.map((p, i) => (
            <button
              key={i}
              onClick={() => { setVal(p); onSubmit(p) }}
              style={{
                padding: '7px 12px', borderRadius: 999,
                background: 'var(--c-surface2)', border: '1px solid var(--c-sep)',
                color: 'var(--c-text2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                textAlign: 'left',
              }}
            >{p}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

function FollowUpQuestion({ question, hint, candidates, progress, onAnswer, onSkip }) {
  const [val, setVal] = useState('')
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus() }, [])

  return (
    <div style={{
      margin: '16px',
      padding: 18, borderRadius: 14,
      background: 'var(--c-surface)', border: '1.5px solid var(--c-acc)',
      animation: 'sw-fade-up .3s ease',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 10,
      }}>
        <div className="sw-eyebrow">Sonu wants to know · {progress.asked + 1} of {progress.cap}</div>
        <button onClick={onSkip} style={{
          background: 'none', border: 'none', color: 'var(--c-text3)',
          cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
        }}>Skip → answer now</button>
      </div>

      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, lineHeight: 1.35 }}>
        {question}
      </div>

      {hint && (
        <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 12, fontStyle: 'italic' }}>
          {hint}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          ref={ref}
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && val.trim() && onAnswer(val.trim())}
          placeholder='Type your answer…'
          style={{
            flex: 1, padding: '10px 12px', borderRadius: 10,
            border: '1px solid var(--c-sep)',
            background: 'var(--c-surface2)', color: 'var(--c-text)',
            fontSize: 14, fontFamily: 'inherit', outline: 'none',
          }}
        />
        <button onClick={() => val.trim() && onAnswer(val.trim())} disabled={!val.trim()} style={{
          padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: val.trim() ? 'var(--c-acc)' : 'var(--c-surface2)',
          color: val.trim() ? '#0B1F3A' : 'var(--c-text3)',
          fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
        }}>Continue</button>
      </div>

      {candidates && candidates.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed var(--c-sep)' }}>
          <div style={{ fontSize: 10, color: 'var(--c-text3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Considering so far
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {candidates.slice(0, 5).map(c => (
              <div key={c.id} style={{
                fontSize: 11, padding: '3px 8px', borderRadius: 999,
                background: 'var(--c-surface2)', color: 'var(--c-text2)',
                border: '1px solid var(--c-sep)',
              }}>{c.title}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function LeadCard({ lead }) {
  const impact = lead.impact || {}
  return (
    <div style={{
      margin: '12px 16px 8px',
      padding: 20, borderRadius: 16,
      background: 'linear-gradient(135deg, rgba(93,219,194,0.16) 0%, rgba(93,219,194,0.04) 100%)',
      border: '2px solid var(--c-acc)',
      boxShadow: '0 4px 16px rgba(93,219,194,0.15)',
    }}>
      <div className="sw-eyebrow" style={{ color: 'var(--c-acc)', marginBottom: 8 }}>
        ✨ Sonu's call
      </div>
      <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.3, marginBottom: 8 }}>
        {lead.title}
      </div>
      <div style={{ fontSize: 14, color: 'var(--c-text)', lineHeight: 1.55, marginBottom: 12 }}>
        {lead.one_liner}
      </div>

      {impact.why && (
        <div style={{
          padding: 12, borderRadius: 10,
          background: 'var(--c-surface2)', border: '1px solid var(--c-sep)',
          fontSize: 13, color: 'var(--c-text2)', lineHeight: 1.6, marginBottom: 10,
        }}>
          <div style={{ fontSize: 10, color: 'var(--c-text3)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4, fontWeight: 700 }}>
            Why this, for you
          </div>
          {impact.why}
        </div>
      )}

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12 }}>
        {impact.gbp_saved != null && impact.gbp_saved > 0 && (
          <div>
            <div style={{ color: 'var(--c-text3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6 }}>Estimated saving</div>
            <div style={{ color: 'var(--c-acc)', fontSize: 15, fontWeight: 800 }}>{fmtGBP(impact.gbp_saved)}</div>
          </div>
        )}
        {impact.time_horizon && (
          <div>
            <div style={{ color: 'var(--c-text3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6 }}>Horizon</div>
            <div style={{ color: 'var(--c-text)', fontSize: 13, fontWeight: 700 }}>{impact.time_horizon}</div>
          </div>
        )}
        {impact.certainty && (
          <div>
            <div style={{ color: 'var(--c-text3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6 }}>Certainty</div>
            <div style={{ color: 'var(--c-text)', fontSize: 13, fontWeight: 700 }}>{impact.certainty}</div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--c-sep)',
        fontSize: 10, color: 'var(--c-text3)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span>📚 {lead.citation}</span>
        <span>{CATEGORY_ICON[lead.category] || '🔍'} {CATEGORY_LABEL[lead.category] || lead.category}</span>
      </div>
    </div>
  )
}

function SupportingList({ supporting }) {
  if (!supporting.length) return null
  return (
    <div style={{ margin: '8px 16px' }}>
      <div className="sw-eyebrow" style={{ marginBottom: 10 }}>That compounds with</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
        {supporting.map((s, i) => (
          <div key={s.id} style={{
            padding: 14, borderRadius: 12,
            background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 13 }}>{CATEGORY_ICON[s.category] || '·'}</span>
              <div style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{s.title}</div>
              {s.impact?.gbp_saved > 0 && (
                <div style={{ fontSize: 11, color: 'var(--c-acc)', fontWeight: 800 }}>
                  +{fmtGBP(s.impact.gbp_saved)}
                </div>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.5 }}>
              {s.one_liner}
            </div>
            {s.impact?.why && (
              <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 6, lineHeight: 1.5, fontStyle: 'italic' }}>
                {s.impact.why}
              </div>
            )}
            <div style={{ marginTop: 6, fontSize: 10, color: 'var(--c-text3)' }}>📚 {s.citation}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function OtherList({ others }) {
  const [open, setOpen] = useState(false)
  if (!others.length) return null
  return (
    <div style={{ margin: '12px 16px' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '12px 14px', borderRadius: 10,
          background: 'var(--c-surface2)', border: '1px solid var(--c-sep)',
          color: 'var(--c-text)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <span style={{ fontWeight: 700 }}>
          {open ? '▾' : '▸'} {others.length} other considerations
        </span>
        <span style={{ color: 'var(--c-text3)', fontSize: 11 }}>tap to expand</span>
      </button>
      {open && (
        <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
          {others.map(o => (
            <div key={o.id} style={{
              padding: '10px 12px', borderRadius: 10,
              background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
              fontSize: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12 }}>{CATEGORY_ICON[o.category] || '·'}</span>
                <div style={{ fontWeight: 700, flex: 1 }}>{o.title}</div>
              </div>
              <div style={{ color: 'var(--c-text2)', marginTop: 3, lineHeight: 1.5, fontSize: 11 }}>{o.one_liner}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ChallengesList({ challenges }) {
  if (!challenges.length) return null
  return (
    <div style={{ margin: '12px 16px' }}>
      <div className="sw-eyebrow" style={{ marginBottom: 10, color: 'var(--c-coral)' }}>
        Challenge Sonu — alternative paths
      </div>
      <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 10, lineHeight: 1.5 }}>
        Same inputs always produce the same recommendation. But you can override Sonu by picking a different value-weighting:
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
        {challenges.map((c, i) => (
          <div key={i} style={{
            padding: 12, borderRadius: 10,
            background: 'var(--c-surface)', border: '1px dashed var(--c-coral)',
          }}>
            <div style={{
              fontSize: 10, color: 'var(--c-coral)', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4,
            }}>
              If you weight {c.value_shift || 'differently'}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{c.title}</div>
            <div style={{ fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.5 }}>{c.one_liner}</div>
            {c.impact?.why && (
              <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 5, fontStyle: 'italic' }}>{c.impact.why}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ReasoningTraceCard({ trace }) {
  const [open, setOpen] = useState(false)
  if (!trace?.length) return null
  return (
    <div style={{ margin: '12px 16px' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--c-acc)', fontSize: 11, fontFamily: 'inherit',
          padding: 0, textDecoration: 'underline', textAlign: 'left',
        }}
      >
        {open ? 'Hide' : 'How did Sonu get here?'}
      </button>
      {open && (
        <div style={{ marginTop: 8, padding: 12, borderRadius: 10,
          background: 'var(--c-surface2)', border: '1px solid var(--c-sep)' }}>
          {trace.map((t, i) => (
            <div key={i} style={{ marginBottom: i < trace.length - 1 ? 8 : 0, fontSize: 11 }}>
              <div style={{ fontWeight: 700, color: 'var(--c-text)' }}>{i + 1}. {t.step}</div>
              <div style={{ color: 'var(--c-text2)', marginTop: 2, lineHeight: 1.5 }}>{t.detail}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function OffOntologyState({ message, suggested, onPick }) {
  return (
    <div style={{ margin: '16px', padding: 18, borderRadius: 14,
      background: 'var(--c-surface)', border: '1px solid var(--c-gold)' }}>
      <div className="sw-eyebrow" style={{ color: 'var(--c-gold)', marginBottom: 8 }}>
        Outside my coverage
      </div>
      <div style={{ fontSize: 13, color: 'var(--c-text)', lineHeight: 1.55, marginBottom: 12 }}>
        {message}
      </div>
      {suggested && suggested.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {suggested.map((s, i) => (
            <button key={i} onClick={() => onPick(s)} style={{
              padding: '6px 10px', borderRadius: 999,
              background: 'var(--c-surface2)', border: '1px solid var(--c-sep)',
              color: 'var(--c-text2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
            }}>{s}</button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main flow
// ─────────────────────────────────────────────────────────────────────────────

export default function AskSonuFlow({ entity }) {
  const [query, setQuery]             = useState(null)
  const [knownFacts, setKnownFacts]   = useState({})
  const [questionsAsked, setAsked]    = useState(0)
  const [response, setResponse]       = useState(null)
  const [loading, setLoading]         = useState(false)

  const submitQuery = (q) => {
    setQuery(q)
    setKnownFacts({})
    setAsked(0)
    setLoading(true)
    setTimeout(() => {
      const r = askSonu(q, entity, { knownFacts: {}, questionsAsked: 0 })
      setResponse(r)
      setLoading(false)
    }, 400)  // small UX delay so the user perceives Sonu "thinking"
  }

  const answerQuestion = (rawValue) => {
    const factKey = response?.fact_key
    if (!factKey) return
    const nextFacts = addAnswer(knownFacts, factKey, rawValue)
    const nextAsked = questionsAsked + 1
    setKnownFacts(nextFacts)
    setAsked(nextAsked)
    setLoading(true)
    setTimeout(() => {
      const r = askSonu(query, entity, { knownFacts: nextFacts, questionsAsked: nextAsked })
      setResponse(r)
      setLoading(false)
    }, 350)
  }

  const skipToAnswer = () => {
    setLoading(true)
    setTimeout(() => {
      const r = askSonu(query, entity, { knownFacts, questionsAsked, forceAnswer: true })
      setResponse(r)
      setLoading(false)
    }, 300)
  }

  const startOver = () => {
    setQuery(null)
    setKnownFacts({})
    setAsked(0)
    setResponse(null)
  }

  // ── Render states ──────────────────────────────────────────────────────────

  if (!query) {
    return <QueryInput onSubmit={submitQuery} disabled={loading} />
  }

  if (loading) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', display: 'inline-block',
          border: '3px solid var(--c-acc)', borderTopColor: 'transparent',
          animation: 'sw-spin 0.8s linear infinite',
        }} />
        <div style={{ marginTop: 12, fontSize: 13, color: 'var(--c-text2)' }}>
          Sonu is thinking…
        </div>
        <style>{`@keyframes sw-spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (!response) return null

  // Header: the user's query (echo) + start-over button
  const header = (
    <div style={{
      padding: '14px 16px', borderBottom: '1px solid var(--c-sep)',
      background: 'var(--c-surface)', display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="sw-eyebrow" style={{ marginBottom: 2 }}>Your question</div>
        <div style={{ fontSize: 13, color: 'var(--c-text)', fontWeight: 600,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>"{query}"</div>
      </div>
      <button onClick={startOver} style={{
        background: 'none', border: '1px solid var(--c-sep)',
        color: 'var(--c-acc)', padding: '6px 12px', borderRadius: 8,
        fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
      }}>← Start over</button>
    </div>
  )

  // NEED_INFO — ask the next question
  if (response.status === 'NEED_INFO') {
    return (
      <div>
        {header}
        <FollowUpQuestion
          question={response.question}
          hint={response.hint}
          candidates={response.candidates_so_far}
          progress={response.progress}
          onAnswer={answerQuestion}
          onSkip={skipToAnswer}
        />
      </div>
    )
  }

  // READY — show the answer
  const a = response.answer

  if (a.off_ontology) {
    return (
      <div>
        {header}
        <OffOntologyState
          message={a.message}
          suggested={a.suggested_rephrases}
          onPick={(s) => submitQuery(s)}
        />
      </div>
    )
  }

  return (
    <div>
      {header}

      {/* Personal intro */}
      <div style={{ padding: '14px 16px 4px', fontSize: 13, color: 'var(--c-text2)', lineHeight: 1.5 }}>
        {a.intro}
      </div>

      <LeadCard lead={a.lead} />
      <SupportingList supporting={a.supporting} />
      <OtherList others={a.otherConsiderations} />
      <ChallengesList challenges={a.challenges} />
      <ReasoningTraceCard trace={a.reasoning_trace} />

      {/* FCA boundary */}
      <div style={{
        margin: '16px', padding: '10px 14px', borderRadius: 10,
        background: 'var(--c-surface2)', border: '1px solid var(--c-sep)',
        fontSize: 10, color: 'var(--c-text3)', lineHeight: 1.5,
      }}>
        <strong>Information not advice.</strong> {a.lead?.fca_boundary || 'Personal circumstances vary — confirm with a regulated adviser before acting.'}
      </div>
    </div>
  )
}
