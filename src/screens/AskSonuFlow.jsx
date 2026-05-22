// ─────────────────────────────────────────────────────────────────────────────
// ASK SONU FLOW v2 — scannable, intent-aware, advisor-attributed
//
//   Question echo (you asked → Sonu says) — always at the top
//   Lead card: headline + saving + 3 action steps + advisor chip
//   Supporting (collapsed by default, one-liners only)
//   Other considerations (collapsed)
//   Challenges (4 alternative paths)
//   Reasoning trace (one tap away)
//
// Layout capped at 760px and centered. No prose paragraphs by default —
// reasoning lives behind a "Why this" tap-to-expand.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect } from 'react'
import { askSonu, addAnswer } from '../engine/ask-sonu/index.js'

const MAX_W = 760

const STARTER_PROMPTS = [
  'I want to draw down £80k a year from April 2027 — most tax-efficient way?',
  'How can I reduce my IHT before April 2027?',
  'I want to relocate to Portugal with my kids — what should I think about?',
  'I\'m getting divorced — what matters financially?',
  'I want to give £100k to my children',
  'We live together but aren\'t married — what do we need to worry about?',
]

function fmtGBP(n) {
  if (n == null) return '—'
  if (Math.abs(n) >= 1000000) return '£' + (n/1000000).toFixed(1) + 'M'
  if (Math.abs(n) >= 1000)    return '£' + (n/1000).toFixed(0) + 'k'
  return '£' + Math.round(n).toLocaleString('en-GB')
}

const CATEGORY_ICON = {
  tax_pension:'💰', iht:'🏛', relocation:'🌍', relocation_lifestyle:'🌍',
  family:'👥', healthcare:'🏥', protection:'🛡', investment:'📈', lifestyle:'🌅',
}

// ─────────────────────────────────────────────────────────────────────────────
// QueryInput — landing
// ─────────────────────────────────────────────────────────────────────────────
function QueryInput({ onSubmit, disabled }) {
  const [val, setVal] = useState('')
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus() }, [])

  const submit = (text) => {
    const q = (text ?? val).trim()
    if (!q || disabled) return
    onSubmit(q)
  }

  return (
    <div style={{ maxWidth: MAX_W, margin: '0 auto', padding: '24px 16px 12px' }}>
      <div className="sw-eyebrow" style={{ marginBottom: 6 }}>Ask Sonu anything</div>
      <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 8px', lineHeight: 1.2 }}>
        One clear answer.<br />Plus the path to get there.
      </h2>
      <p style={{ fontSize: 13, color: 'var(--c-text2)', lineHeight: 1.5, margin: '0 0 16px' }}>
        Describe any money question in plain English. Sonu asks at most 3 follow-ups,
        then gives you the lead recommendation, action steps, and 4 paths you can challenge.
      </p>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          ref={ref}
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder='e.g. "I want to draw down £80k from April 2027 most tax-efficiently"'
          disabled={disabled}
          style={{
            flex: 1, padding: '12px 14px', borderRadius: 12,
            border: '1.5px solid var(--c-sep)',
            background: 'var(--c-surface)', color: 'var(--c-text)',
            fontSize: 14, fontFamily: 'inherit', outline: 'none',
          }}
        />
        <button onClick={() => submit()} disabled={!val.trim() || disabled} style={{
          padding: '12px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
          background: val.trim() && !disabled ? 'var(--c-acc)' : 'var(--c-surface2)',
          color: val.trim() && !disabled ? '#0B1F3A' : 'var(--c-text3)',
          fontWeight: 800, fontSize: 14, fontFamily: 'inherit',
        }}>Ask</button>
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 10, color: 'var(--c-text3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>
          Or pick one
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          {STARTER_PROMPTS.map((p, i) => (
            <button
              key={i}
              onClick={() => submit(p)}
              style={{
                padding: '10px 14px', borderRadius: 10,
                background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
                color: 'var(--c-text)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                textAlign: 'left', lineHeight: 1.4,
              }}
            >{p}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FollowUpQuestion
// ─────────────────────────────────────────────────────────────────────────────
function FollowUpQuestion({ question, hint, progress, onAnswer, onSkip }) {
  const [val, setVal] = useState('')
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus() }, [])

  return (
    <div style={{ maxWidth: MAX_W, margin: '16px auto', padding: '0 16px' }}>
      <div style={{
        padding: 18, borderRadius: 14,
        background: 'var(--c-surface)', border: '1.5px solid var(--c-acc)',
        animation: 'sw-fade-up .3s ease',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div className="sw-eyebrow">Sonu wants to know · {progress.asked + 1} of {progress.cap}</div>
          <button onClick={onSkip} style={{
            background: 'none', border: 'none', color: 'var(--c-text3)',
            cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
          }}>Skip → answer with what we have</button>
        </div>

        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, lineHeight: 1.35 }}>{question}</div>
        {hint && <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 12, fontStyle: 'italic' }}>{hint}</div>}

        <div style={{ display: 'flex', gap: 8 }}>
          <input ref={ref} value={val} onChange={e => setVal(e.target.value)}
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
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Question echo — always at the top of any READY answer
// ─────────────────────────────────────────────────────────────────────────────
function QuestionEcho({ query, intro, directAnswer }) {
  return (
    <div style={{
      maxWidth: MAX_W, margin: '0 auto',
      padding: '20px 16px 12px',
    }}>
      <div className="sw-eyebrow" style={{ marginBottom: 6 }}>You asked</div>
      <div style={{
        fontSize: 15, color: 'var(--c-text)', fontWeight: 600,
        lineHeight: 1.4, fontStyle: 'italic', marginBottom: 14,
      }}>"{query}"</div>

      <div className="sw-eyebrow" style={{ marginBottom: 6, color: 'var(--c-acc)' }}>
        ✨ Sonu's answer
      </div>
      <div style={{
        fontSize: 18, color: 'var(--c-text)', fontWeight: 800,
        lineHeight: 1.35, marginBottom: 10,
      }}>{directAnswer}</div>
      {intro && (
        <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.45 }}>{intro}</div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LeadCard v2 — headline + saving + 3 action steps + advisor chip
// ─────────────────────────────────────────────────────────────────────────────
function LeadCard({ lead }) {
  const [showWhy, setShowWhy] = useState(false)
  const impact = lead.impact || {}

  return (
    <div style={{ maxWidth: MAX_W, margin: '0 auto', padding: '4px 16px' }}>
      <div style={{
        padding: 18, borderRadius: 16,
        background: 'linear-gradient(135deg, rgba(93,219,194,0.12) 0%, rgba(93,219,194,0.02) 100%)',
        border: '2px solid var(--c-acc)',
        boxShadow: '0 4px 16px rgba(93,219,194,0.10)',
      }}>
        {/* Headline */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>{CATEGORY_ICON[lead.category] || '✦'}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.3 }}>{lead.title}</div>
            <div style={{ fontSize: 12, color: 'var(--c-text2)', marginTop: 3, lineHeight: 1.5 }}>{lead.one_liner}</div>
          </div>
        </div>

        {/* Big numbers strip */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 16,
          padding: '10px 0', marginBottom: 12,
          borderTop: '1px solid var(--c-sep)', borderBottom: '1px solid var(--c-sep)',
        }}>
          {impact.gbp_saved != null && impact.gbp_saved > 0 && (
            <Stat label="Estimated saving" value={fmtGBP(impact.gbp_saved)} valueColor="var(--c-acc)" />
          )}
          {impact.time_horizon && <Stat label="Horizon" value={impact.time_horizon} />}
          {impact.certainty && <Stat label="Certainty" value={impact.certainty} />}
        </div>

        {/* 3 action steps — the takeaway */}
        {lead.action_steps?.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div className="sw-eyebrow" style={{ marginBottom: 8 }}>What to do</div>
            <ol style={{ paddingLeft: 20, margin: 0 }}>
              {lead.action_steps.map((step, i) => (
                <li key={i} style={{
                  fontSize: 13, color: 'var(--c-text)', lineHeight: 1.55,
                  marginBottom: i < lead.action_steps.length - 1 ? 8 : 0,
                }}>{step}</li>
              ))}
            </ol>
          </div>
        )}

        {/* Advisor chip + Why this toggle */}
        <div style={{
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8,
          paddingTop: 10, borderTop: '1px dashed var(--c-sep)',
        }}>
          {lead.advisors?.length > 0 && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 999,
              background: 'var(--c-surface2)', border: '1px solid var(--c-sep)',
              fontSize: 11, color: 'var(--c-text2)',
            }}>
              <span style={{ color: 'var(--c-acc)', fontWeight: 700 }}>From:</span>
              <span>{lead.advisors.join(' + ')}</span>
            </div>
          )}
          <button onClick={() => setShowWhy(s => !s)} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            color: 'var(--c-acc)', fontSize: 11, fontFamily: 'inherit',
            textDecoration: 'underline',
          }}>{showWhy ? 'Hide' : 'Why this, for you'}</button>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 10, color: 'var(--c-text3)' }}>📚 {lead.citation}</div>
        </div>

        {showWhy && impact.why && (
          <div style={{
            marginTop: 12, padding: 12, borderRadius: 10,
            background: 'var(--c-surface2)', border: '1px solid var(--c-sep)',
            fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.6,
          }}>{impact.why}</div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, valueColor }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: 'var(--c-text3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: valueColor || 'var(--c-text)' }}>{value}</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Supporting & Other & Challenges & Trace — denser, capped width
// ─────────────────────────────────────────────────────────────────────────────
function MiniCard({ play, accent = 'sep', showSaving = false }) {
  return (
    <div style={{
      padding: 12, borderRadius: 10,
      background: 'var(--c-surface)', border: `1px ${accent === 'dashed' ? 'dashed' : 'solid'} var(--c-${accent === 'sep' ? 'sep' : accent})`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 14 }}>{CATEGORY_ICON[play.category] || '·'}</span>
        <div style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{play.title}</div>
        {showSaving && play.impact?.gbp_saved > 0 && (
          <div style={{ fontSize: 11, color: 'var(--c-acc)', fontWeight: 800 }}>+{fmtGBP(play.impact.gbp_saved)}</div>
        )}
      </div>
      <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.5 }}>{play.one_liner}</div>
      {play.advisors?.length > 0 && (
        <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 6 }}>
          From: {play.advisors.join(' + ')}
        </div>
      )}
    </div>
  )
}

function SupportingList({ supporting }) {
  if (!supporting.length) return null
  return (
    <div style={{ maxWidth: MAX_W, margin: '12px auto', padding: '0 16px' }}>
      <div className="sw-eyebrow" style={{ marginBottom: 8 }}>That compounds with</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {supporting.map((s) => <MiniCard key={s.id} play={s} showSaving />)}
      </div>
    </div>
  )
}

function OtherList({ others }) {
  const [open, setOpen] = useState(false)
  if (!others.length) return null
  return (
    <div style={{ maxWidth: MAX_W, margin: '12px auto', padding: '0 16px' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', padding: '10px 14px', borderRadius: 10,
        background: 'var(--c-surface2)', border: '1px solid var(--c-sep)',
        color: 'var(--c-text)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontWeight: 700 }}>{open ? '▾' : '▸'} {others.length} other considerations</span>
        <span style={{ color: 'var(--c-text3)', fontSize: 11 }}>tap to expand</span>
      </button>
      {open && (
        <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
          {others.map((o) => <MiniCard key={o.id} play={o} />)}
        </div>
      )}
    </div>
  )
}

function ChallengesList({ challenges }) {
  if (!challenges.length) return null
  return (
    <div style={{ maxWidth: MAX_W, margin: '12px auto', padding: '0 16px' }}>
      <div className="sw-eyebrow" style={{ marginBottom: 8, color: 'var(--c-coral)' }}>
        Challenge Sonu — alternative paths
      </div>
      <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 8, lineHeight: 1.5 }}>
        Same inputs always produce the same answer. Override by picking a different value-weighting:
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {challenges.map((c, i) => (
          <div key={i} style={{
            padding: 12, borderRadius: 10,
            background: 'var(--c-surface)', border: '1px dashed var(--c-coral)',
          }}>
            <div style={{
              fontSize: 10, color: 'var(--c-coral)', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4,
            }}>If you weight {c.value_shift || 'differently'}</div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{c.title}</div>
            <div style={{ fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.5 }}>{c.one_liner}</div>
            {c.advisors?.length > 0 && (
              <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 5 }}>
                From: {c.advisors.join(' + ')}
              </div>
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
    <div style={{ maxWidth: MAX_W, margin: '12px auto', padding: '0 16px' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--c-acc)', fontSize: 11, fontFamily: 'inherit',
        padding: 0, textDecoration: 'underline', textAlign: 'left',
      }}>{open ? 'Hide' : 'How did Sonu get here?'}</button>
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
    <div style={{ maxWidth: MAX_W, margin: '16px auto', padding: '0 16px' }}>
      <div style={{
        padding: 18, borderRadius: 14,
        background: 'var(--c-surface)', border: '1px solid var(--c-gold)',
      }}>
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
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main flow
// ─────────────────────────────────────────────────────────────────────────────
export default function AskSonuFlow({ entity }) {
  const [query, setQuery]           = useState(null)
  const [knownFacts, setKnownFacts] = useState({})
  const [questionsAsked, setAsked]  = useState(0)
  const [response, setResponse]     = useState(null)
  const [loading, setLoading]       = useState(false)

  const submitQuery = (q) => {
    setQuery(q)
    setKnownFacts({})
    setAsked(0)
    setLoading(true)
    setTimeout(() => {
      setResponse(askSonu(q, entity, { knownFacts: {}, questionsAsked: 0 }))
      setLoading(false)
    }, 350)
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
      setResponse(askSonu(query, entity, { knownFacts: nextFacts, questionsAsked: nextAsked }))
      setLoading(false)
    }, 300)
  }

  const skipToAnswer = () => {
    setLoading(true)
    setTimeout(() => {
      setResponse(askSonu(query, entity, { knownFacts, questionsAsked, forceAnswer: true }))
      setLoading(false)
    }, 250)
  }

  const startOver = () => {
    setQuery(null); setKnownFacts({}); setAsked(0); setResponse(null)
  }

  if (!query) return <QueryInput onSubmit={submitQuery} disabled={loading} />

  if (loading) {
    return (
      <div style={{ maxWidth: MAX_W, margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', display: 'inline-block',
          border: '3px solid var(--c-acc)', borderTopColor: 'transparent',
          animation: 'sw-spin 0.8s linear infinite',
        }} />
        <div style={{ marginTop: 14, fontSize: 13, color: 'var(--c-text2)' }}>Sonu is thinking…</div>
        <style>{`@keyframes sw-spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (!response) return null

  // Header with start-over
  const header = (
    <div style={{
      maxWidth: MAX_W, margin: '0 auto', padding: '12px 16px 0',
      display: 'flex', justifyContent: 'flex-end',
    }}>
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
        <div style={{ maxWidth: MAX_W, margin: '8px auto 0', padding: '0 16px' }}>
          <div className="sw-eyebrow" style={{ marginBottom: 4 }}>You asked</div>
          <div style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--c-text2)' }}>"{query}"</div>
        </div>
        <FollowUpQuestion
          question={response.question}
          hint={response.hint}
          progress={response.progress}
          onAnswer={answerQuestion}
          onSkip={skipToAnswer}
        />
      </div>
    )
  }

  const a = response.answer

  if (a.off_ontology) {
    return (
      <div>
        {header}
        <OffOntologyState message={a.message} suggested={a.suggested_rephrases} onPick={(s) => submitQuery(s)} />
      </div>
    )
  }

  return (
    <div>
      {header}
      <QuestionEcho query={query} intro={a.intro} directAnswer={a.direct_answer} />

      {a.intent_mismatch && (
        <div style={{ maxWidth: MAX_W, margin: '4px auto 8px', padding: '0 16px' }}>
          <div style={{
            padding: '8px 12px', borderRadius: 8,
            background: 'rgba(255,214,110,0.10)', border: '1px solid var(--c-gold)',
            fontSize: 11, color: 'var(--c-gold)', lineHeight: 1.4,
          }}>
            Heads up — I didn't find a perfect match for your exact intent. Lead below is the closest play; tap "Challenge Sonu" for alternative angles.
          </div>
        </div>
      )}

      <LeadCard lead={a.lead} />
      <SupportingList supporting={a.supporting} />
      <OtherList others={a.otherConsiderations} />
      <ChallengesList challenges={a.challenges} />
      <ReasoningTraceCard trace={a.reasoning_trace} />

      <div style={{ maxWidth: MAX_W, margin: '16px auto 24px', padding: '0 16px' }}>
        <div style={{
          padding: '10px 14px', borderRadius: 10,
          background: 'var(--c-surface2)', border: '1px solid var(--c-sep)',
          fontSize: 10, color: 'var(--c-text3)', lineHeight: 1.5,
        }}>
          <strong>Information not advice.</strong> {a.lead?.fca_boundary || 'Personal circumstances vary — confirm with a regulated adviser before acting.'}
        </div>
      </div>
    </div>
  )
}
