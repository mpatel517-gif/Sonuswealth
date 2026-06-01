// ─────────────────────────────────────────────────────────────────────────────
// ASK SONU FLOW v3 — LLM-routed, hero-card layout, collapsed sections
//
// Hero (above fold):
//   Question echo · Sonu's direct answer · personal context
//   Lead card: title + big £ saving + 3 action steps + advisor chip + citation
//
// Collapsed below (tap to expand):
//   Why this, for you (rationale)
//   What compounds with this (2-3 supporting)
//   Challenge Sonu (4 alternative paths)
//   How did Sonu get here? (reasoning trace)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect } from 'react'
import { askSonu, addAnswer } from '../engine/ask-sonu/index.js'

const MAX_W = 760

const STARTER_PROMPTS = [
  'I want to draw down £80k a year from April 2027 — most tax-efficient way?',
  'I have multiple fixed deposit accounts about to mature — what should I do?',
  'How can I reduce my IHT before April 2027?',
  'I want to relocate to Portugal with my kids',
  'I\'m getting divorced — what matters financially?',
  'I want to give £100k to my children',
]

const LOADING_PHASES = [
  'Reading your situation…',
  'Consulting the relevant specialists…',
  'Cross-checking against your profile…',
  'Synthesising the answer…',
]

function fmtGBP(n) {
  if (n == null) return '—'
  if (Math.abs(n) >= 1_000_000) return '£' + (n / 1_000_000).toFixed(1) + 'M'
  if (Math.abs(n) >= 1_000)     return '£' + (n / 1_000).toFixed(0) + 'k'
  return '£' + Math.round(n).toLocaleString('en-GB')
}

const CATEGORY_ICON = {
  tax_pension:'💰', iht:'🏛', relocation:'🌍', relocation_lifestyle:'🌍',
  family:'👥', healthcare:'🏥', protection:'🛡', investment:'📈', lifestyle:'🌅',
}

// ─────────────────────────────────────────────────────────────────────────────
// Landing / query input
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
      <p style={{ fontSize: 13, color: 'var(--c-text2)', lineHeight: 1.5, margin: '0 0 18px' }}>
        Type any money question. Sonu reads it, picks the right specialists from a panel of 11,
        and gives you the lead recommendation in plain English — with action steps and 4 paths you can challenge.
      </p>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          ref={ref}
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder='e.g. "I have fixed deposits maturing — what should I do?"'
          disabled={disabled}
          style={{
            flex: 1, padding: '12px 14px', borderRadius: 12,
            border: '1.5px solid var(--c-sep)',
            background: 'var(--c-surface)', color: 'var(--c-text)',
            fontSize: 14, fontFamily: 'inherit', outline: 'none',
          }}
        />
        <button onClick={() => submit()} disabled={!val.trim() || disabled} style={{
          padding: '12px 22px', borderRadius: 12, border: 'none', cursor: 'pointer',
          background: val.trim() && !disabled ? 'var(--c-acc)' : 'var(--c-surface2)',
          color: val.trim() && !disabled ? 'var(--c-on-accent, #0B1F3A)' : 'var(--c-text3)',
          fontWeight: 800, fontSize: 14, fontFamily: 'inherit',
        }}>Ask</button>
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 10, color: 'var(--c-text3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>
          Or pick one
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          {STARTER_PROMPTS.map((p, i) => (
            <button key={i} onClick={() => submit(p)} style={{
              padding: '10px 14px', borderRadius: 10,
              background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
              color: 'var(--c-text)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              textAlign: 'left', lineHeight: 1.4,
            }}>{p}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading — phased so 2-4s feels intentional
// ─────────────────────────────────────────────────────────────────────────────
function LoadingState() {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setPhase(p => Math.min(p + 1, LOADING_PHASES.length - 1)), 900)
    return () => clearInterval(t)
  }, [])
  return (
    <div style={{ maxWidth: MAX_W, margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%', display: 'inline-block',
        border: '3px solid var(--c-acc)', borderTopColor: 'transparent',
        animation: 'sw-spin 0.8s linear infinite',
      }} />
      <div style={{ marginTop: 16, fontSize: 13, color: 'var(--c-text2)', fontWeight: 600 }}>
        {LOADING_PHASES[phase]}
      </div>
      <div style={{ marginTop: 8, fontSize: 10, color: 'var(--c-text3)' }}>
        Sonu may take a few seconds for novel questions
      </div>
      <style>{`@keyframes sw-spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Follow-up question — supports BOTH chip options (LLM-provided) and free text (deterministic)
// ─────────────────────────────────────────────────────────────────────────────
function FollowUpQuestion({ question, hint, options, whyAsking, progress, onAnswer, onSkip }) {
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
          <div className="sw-eyebrow">Sonu needs one thing first · {progress.asked + 1} of {progress.cap}</div>
          <button onClick={onSkip} style={{
            background: 'none', border: 'none', color: 'var(--c-text3)',
            cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
          }}>Skip → answer now</button>
        </div>

        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, lineHeight: 1.35 }}>{question}</div>
        {(whyAsking || hint) && (
          <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 14, fontStyle: 'italic' }}>
            {whyAsking || hint}
          </div>
        )}

        {Array.isArray(options) && options.length > 0 ? (
          <div style={{ display: 'grid', gap: 6 }}>
            {options.map((opt, i) => (
              <button key={i} onClick={() => onAnswer(opt.value, opt.label)} style={{
                padding: '10px 14px', borderRadius: 10, textAlign: 'left',
                background: 'var(--c-surface2)', border: '1px solid var(--c-sep)',
                color: 'var(--c-text)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                lineHeight: 1.4,
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--c-acc)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--c-sep)'}
              >{opt.label}</button>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <input ref={ref} value={val} onChange={e => setVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && val.trim() && onAnswer(val.trim(), val.trim())}
              placeholder='Type your answer…'
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 10,
                border: '1px solid var(--c-sep)',
                background: 'var(--c-surface2)', color: 'var(--c-text)',
                fontSize: 14, fontFamily: 'inherit', outline: 'none',
              }}
            />
            <button onClick={() => val.trim() && onAnswer(val.trim(), val.trim())} disabled={!val.trim()} style={{
              padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: val.trim() ? 'var(--c-acc)' : 'var(--c-surface2)',
              color: val.trim() ? 'var(--c-on-accent, #0B1F3A)' : 'var(--c-text3)',
              fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
            }}>Continue</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// THE HERO — question echo + direct answer + lead card, all in one block
// Renders DIFFERENTLY for play-backed vs freeform answers.
// ─────────────────────────────────────────────────────────────────────────────
function HeroBlock({ query, answer }) {
  const lead = answer.lead || {}
  const impact = lead.impact || {}
  const isFreeform = answer.mode === 'freeform' || answer.freeform === true
  const state = answer.taxYearState

  // Build a compact state-aware tag list (only show interesting/nonzero items)
  const stateTags = []
  if (state) {
    if (state.isa) stateTags.push({ label: 'ISA', value: `£${state.isa.remaining.toLocaleString()} left`, urgent: state.isa.remaining === 0 })
    if (state.pension_aa) stateTags.push({ label: 'Pension AA', value: `£${state.pension_aa.remaining.toLocaleString()} left`, urgent: state.pension_aa.remaining < 5000 })
    if (state.mpaa_triggered) stateTags.push({ label: 'MPAA', value: 'triggered', urgent: true })
    if (state.pa?.tapered) stateTags.push({ label: '£100k taper', value: 'active', urgent: true })
    if (state.days_to_sipp_iht > 0 && state.days_to_sipp_iht < 730) {
      stateTags.push({ label: 'SIPP-IHT', value: `${state.days_to_sipp_iht}d`, urgent: state.days_to_sipp_iht < 365 })
    }
    if (state.days_to_tax_year_end < 60) {
      stateTags.push({ label: 'Year end', value: `${state.days_to_tax_year_end}d`, urgent: true })
    }
  }

  return (
    <div style={{ maxWidth: MAX_W, margin: '0 auto', padding: '16px 16px 4px' }}>
      {/* Question echo */}
      <div className="sw-eyebrow" style={{ marginBottom: 4 }}>You asked</div>
      <div style={{
        fontSize: 13, color: 'var(--c-text2)', fontStyle: 'italic',
        lineHeight: 1.5, marginBottom: 14,
      }}>"{query}"</div>

      {/* Direct answer banner */}
      <div className="sw-eyebrow" style={{ marginBottom: 4, color: 'var(--c-acc)' }}>
        ✨ Sonu's answer
      </div>
      <div style={{
        fontSize: 19, fontWeight: 800, color: 'var(--c-text)',
        lineHeight: 1.35, marginBottom: 10,
      }}>{answer.direct_answer || lead.title || '—'}</div>

      {/* Personal context */}
      {answer.intro && (
        <div style={{
          fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.5,
          marginBottom: 10,
        }}>{answer.intro}</div>
      )}

      {/* Tax-year state tags — the visible signal that Sonu knows what's used */}
      {stateTags.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 6,
          marginBottom: 14, paddingBottom: 12,
          borderBottom: '1px dashed var(--c-sep)',
        }}>
          <div style={{ fontSize: 10, color: 'var(--c-text3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700, alignSelf: 'center', marginRight: 4 }}>
            This year:
          </div>
          {stateTags.map((t, i) => (
            <div key={i} style={{
              padding: '3px 8px', borderRadius: 999,
              background: t.urgent ? 'rgba(255,111,125,0.15)' : 'var(--c-surface2)',
              border: `1px solid ${t.urgent ? 'var(--c-coral)' : 'var(--c-sep)'}`,
              fontSize: 10, color: t.urgent ? 'var(--c-coral)' : 'var(--c-text2)',
              fontWeight: 600,
            }}>
              {t.label}: <strong>{t.value}</strong>
            </div>
          ))}
        </div>
      )}

      {/* Lenses consulted — visible attribution of which experts informed this */}
      {answer.lenses_consulted?.length > 0 && (
        <div style={{
          fontSize: 10, color: 'var(--c-text3)', marginBottom: 12,
          lineHeight: 1.4,
        }}>
          <strong style={{ color: 'var(--c-acc)' }}>Sonu consulted:</strong>{' '}
          {answer.lenses_consulted.slice(0, 5).map(l => l.name).join(' · ')}
        </div>
      )}

      {/* Freeform: simpler card — no contradicting play title */}
      {isFreeform ? (
        <div style={{
          marginTop: 4, padding: 18, borderRadius: 16,
          background: 'linear-gradient(135deg, rgba(255,214,110,0.10) 0%, rgba(255,214,110,0.02) 100%)',
          border: '2px solid var(--c-gold)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 22 }}>{CATEGORY_ICON[lead.category] || '✦'}</span>
            <div className="sw-eyebrow" style={{ color: 'var(--c-gold)' }}>General guidance · not from a curated play</div>
          </div>

          {lead.action_steps?.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div className="sw-eyebrow" style={{ marginBottom: 10 }}>What to do</div>
              <ol style={{ paddingLeft: 22, margin: 0 }}>
                {lead.action_steps.map((step, i) => (
                  <li key={i} style={{
                    fontSize: 13, color: 'var(--c-text)', lineHeight: 1.55,
                    marginBottom: i < lead.action_steps.length - 1 ? 8 : 0,
                  }}>{step}</li>
                ))}
              </ol>
            </div>
          )}

          {/* Advisor chip + citations stack */}
          <div style={{
            paddingTop: 10, borderTop: '1px dashed var(--c-sep)',
            display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8,
          }}>
            {lead.advisors?.length > 0 && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 11px', borderRadius: 999,
                background: 'var(--c-surface2)', border: '1px solid var(--c-sep)',
                fontSize: 11, color: 'var(--c-text2)',
              }}>
                <span style={{ color: 'var(--c-acc)', fontWeight: 700 }}>Consulted:</span>
                <span>{lead.advisors.join(' + ')}</span>
              </div>
            )}
            <div style={{ flex: 1 }} />
            <div style={{ fontSize: 10, color: 'var(--c-text3)', textAlign: 'right', maxWidth: '60%' }}>
              📚 {lead.citations?.length ? lead.citations.join(' · ') : lead.citation}
            </div>
          </div>
        </div>
      ) : (
        /* Play-backed: full card with play title + £saving + steps + citation */
        <div style={{
          marginTop: 4, padding: 18, borderRadius: 16,
          background: 'linear-gradient(135deg, rgba(93,219,194,0.10) 0%, rgba(93,219,194,0.02) 100%)',
          border: '2px solid var(--c-acc)',
          boxShadow: '0 4px 16px rgba(93,219,194,0.10)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
            <span style={{ fontSize: 26, lineHeight: 1 }}>{CATEGORY_ICON[lead.category] || '✦'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.3, marginBottom: 3 }}>{lead.title}</div>
              <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.5 }}>{lead.one_liner}</div>
            </div>
            {impact.gbp_saved > 0 && (
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 9, color: 'var(--c-text3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700, marginBottom: 2 }}>Saving</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--c-acc)', lineHeight: 1 }}>{fmtGBP(impact.gbp_saved)}</div>
                {impact.time_horizon && <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 2 }}>{impact.time_horizon}</div>}
              </div>
            )}
          </div>

          {lead.action_steps?.length > 0 && (
            <div style={{ marginBottom: 14, paddingTop: 12, borderTop: '1px solid var(--c-sep)' }}>
              <div className="sw-eyebrow" style={{ marginBottom: 10 }}>What to do</div>
              <ol style={{ paddingLeft: 22, margin: 0 }}>
                {lead.action_steps.map((step, i) => (
                  <li key={i} style={{
                    fontSize: 13, color: 'var(--c-text)', lineHeight: 1.55,
                    marginBottom: i < lead.action_steps.length - 1 ? 8 : 0,
                  }}>{step}</li>
                ))}
              </ol>
            </div>
          )}

          <div style={{
            display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8,
            paddingTop: 10, borderTop: '1px dashed var(--c-sep)',
          }}>
            {lead.advisors?.length > 0 && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 11px', borderRadius: 999,
                background: 'var(--c-surface2)', border: '1px solid var(--c-sep)',
                fontSize: 11, color: 'var(--c-text2)',
              }}>
                <span style={{ color: 'var(--c-acc)', fontWeight: 700 }}>Consulted:</span>
                <span>{lead.advisors.join(' + ')}</span>
              </div>
            )}
            <div style={{ flex: 1 }} />
            <div style={{ fontSize: 10, color: 'var(--c-text3)' }}>📚 {lead.citation}</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Collapsible section — used by everything below the fold
// ─────────────────────────────────────────────────────────────────────────────
function Collapsible({ label, sublabel, defaultOpen = false, children, accentColor }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ maxWidth: MAX_W, margin: '8px auto', padding: '0 16px' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', padding: '12px 14px', borderRadius: 10,
        background: 'var(--c-surface2)', border: '1px solid var(--c-sep)',
        color: 'var(--c-text)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        textAlign: 'left',
      }}>
        <span style={{ fontWeight: 700, color: accentColor || 'var(--c-text)' }}>
          {open ? '▾' : '▸'} {label}
        </span>
        {sublabel && <span style={{ color: 'var(--c-text3)', fontSize: 11 }}>{sublabel}</span>}
      </button>
      {open && <div style={{ marginTop: 8 }}>{children}</div>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Mini card — used by supporting & others
// ─────────────────────────────────────────────────────────────────────────────
function MiniCard({ play, accent = 'sep', showSaving = false, valueShift }) {
  return (
    <div style={{
      padding: 12, borderRadius: 10,
      background: 'var(--c-surface)',
      border: `1px ${accent === 'dashed' ? 'dashed' : 'solid'} var(--c-${accent === 'sep' ? 'sep' : accent})`,
    }}>
      {valueShift && (
        <div style={{
          fontSize: 10, color: 'var(--c-coral)', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4,
        }}>If you weight {valueShift}</div>
      )}
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

// ─────────────────────────────────────────────────────────────────────────────
// Off-ontology / failure state
// ─────────────────────────────────────────────────────────────────────────────
function OffOntologyState({ answer, onPick }) {
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
          {answer.intro || answer.message}
        </div>
        {answer.suggested_rephrases && answer.suggested_rephrases.length > 0 && (
          <div style={{ display: 'grid', gap: 6 }}>
            {answer.suggested_rephrases.map((s, i) => (
              <button key={i} onClick={() => onPick(s)} style={{
                padding: '8px 12px', borderRadius: 10, textAlign: 'left',
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

  const callEngine = async (q, facts, asked, force = false) => {
    setLoading(true)
    try {
      const r = await askSonu(q, entity, { knownFacts: facts, questionsAsked: asked, forceAnswer: force })
      setResponse(r)
    } finally {
      setLoading(false)
    }
  }

  const submitQuery = (q) => {
    setQuery(q)
    setKnownFacts({})
    setAsked(0)
    setResponse(null)
    callEngine(q, {}, 0)
  }

  const answerQuestion = (rawValue, displayLabel) => {
    const factKey = response?.fact_key
    if (!factKey) return
    const nextFacts = addAnswer(knownFacts, factKey, rawValue)
    const nextAsked = questionsAsked + 1
    setKnownFacts(nextFacts)
    setAsked(nextAsked)
    callEngine(query, nextFacts, nextAsked)
  }

  const skipToAnswer = () => callEngine(query, knownFacts, questionsAsked, true)
  const startOver    = () => { setQuery(null); setKnownFacts({}); setAsked(0); setResponse(null) }

  if (!query) return <QueryInput onSubmit={submitQuery} disabled={loading} />
  if (loading || !response) return <LoadingState />

  // Header with start-over + source indicator
  const sourceLabel = response.source === 'llm' ? 'Sonu (LLM-routed)' :
                      response.source === 'deterministic' ? 'Sonu (deterministic)' : ''
  const header = (
    <div style={{
      maxWidth: MAX_W, margin: '0 auto', padding: '12px 16px 0',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <div style={{ fontSize: 10, color: 'var(--c-text3)' }}>
        {sourceLabel} {response.ms ? `· ${(response.ms/1000).toFixed(1)}s` : ''}
        {response._fallback_used && <span style={{ color: 'var(--c-gold)' }}> · fell back from LLM ({response._llm_failure})</span>}
      </div>
      <button onClick={startOver} style={{
        background: 'none', border: '1px solid var(--c-sep)',
        color: 'var(--c-acc)', padding: '6px 12px', borderRadius: 8,
        fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
      }}>← Start over</button>
    </div>
  )

  // NEED_INFO branch
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
          options={response.options}
          whyAsking={response.why_asking}
          progress={response.progress}
          onAnswer={answerQuestion}
          onSkip={skipToAnswer}
        />
      </div>
    )
  }

  // READY — off-ontology
  const a = response.answer
  if (a.off_ontology || !a.lead) {
    return (
      <div>
        {header}
        <OffOntologyState answer={a} onPick={(s) => submitQuery(s)} />
      </div>
    )
  }

  // READY — full answer
  return (
    <div>
      {header}

      {a.adjacent_to_kg && (
        <div style={{ maxWidth: MAX_W, margin: '8px auto 0', padding: '0 16px' }}>
          <div style={{
            padding: '8px 12px', borderRadius: 8,
            background: 'rgba(255,214,110,0.10)', border: '1px solid var(--c-gold)',
            fontSize: 11, color: 'var(--c-gold)', lineHeight: 1.4,
          }}>
            ⚠ Your question is adjacent to my exact play menu — Sonu picked the closest matches. For specifics outside this guidance, a regulated adviser conversation is the right next step.
          </div>
        </div>
      )}

      <HeroBlock query={query} answer={a} />

      {/* ── Collapsed sections below the fold ─────────────────────────── */}

      {a.rationale && (
        <Collapsible label="Why this, for you" sublabel="tap to expand" defaultOpen={false}>
          <div style={{ maxWidth: MAX_W, margin: '0 auto', padding: '0 16px' }}>
            <div style={{
              padding: 14, borderRadius: 10,
              background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
              fontSize: 13, color: 'var(--c-text)', lineHeight: 1.65,
            }}>
              {a.rationale}
              {a.lead?.impact?.why && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--c-sep)',
                  fontSize: 12, color: 'var(--c-text2)' }}>
                  {a.lead.impact.why}
                </div>
              )}
            </div>
          </div>
        </Collapsible>
      )}

      {a.supporting?.length > 0 && (
        <Collapsible label={`What compounds with this`} sublabel={`${a.supporting.length} plays`}>
          <div style={{ maxWidth: MAX_W, margin: '0 auto', padding: '0 16px', display: 'grid', gap: 6 }}>
            {a.supporting.map(s => <MiniCard key={s.id} play={s} showSaving />)}
          </div>
        </Collapsible>
      )}

      {a.challenges?.length > 0 && (
        <Collapsible label="Challenge Sonu — alternative paths" sublabel={`${a.challenges.length} options`} accentColor="var(--c-coral)">
          <div style={{ maxWidth: MAX_W, margin: '0 auto', padding: '0 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 8, lineHeight: 1.5 }}>
              Same inputs always produce the same answer. Override by picking a different value-weighting:
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {a.challenges.map((c, i) => (
                <MiniCard key={i} play={c} accent="coral" valueShift={c.value_shift} />
              ))}
            </div>
          </div>
        </Collapsible>
      )}

      {a.reasoning_trace?.length > 0 && (
        <Collapsible label="How did Sonu get here?" sublabel={`${a.reasoning_trace.length} steps`}>
          <div style={{ maxWidth: MAX_W, margin: '0 auto', padding: '0 16px' }}>
            <div style={{ padding: 14, borderRadius: 10,
              background: 'var(--c-surface)', border: '1px solid var(--c-sep)' }}>
              {a.reasoning_trace.map((t, i) => (
                <div key={i} style={{ marginBottom: i < a.reasoning_trace.length - 1 ? 10 : 0, fontSize: 12 }}>
                  <div style={{ fontWeight: 700, color: 'var(--c-text)' }}>{i + 1}. {t.step}</div>
                  <div style={{ color: 'var(--c-text2)', marginTop: 2, lineHeight: 1.5 }}>{t.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </Collapsible>
      )}

      {/* FCA disclaimer */}
      <div style={{ maxWidth: MAX_W, margin: '20px auto 32px', padding: '0 16px' }}>
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
