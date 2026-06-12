// ─────────────────────────────────────────────────────────────────────────────
// Onboarding — Wave 1 Agent E
// Seven questions, archetype-mapping placeholder, skip option, score reveal.
// Final summary uses engine-side onboardingPreview() — no inline math.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import {
  fmt, fqBand, riskBand, onboardingPreview,
} from '../engine/fq-calculator.js'

const STAGES = [
  { n:1, name:'Foundation',    range:'18–30', c:'var(--c-acc2)' },
  { n:2, name:'Accumulation',  range:'30–45', c:'var(--c-acc)'  },
  { n:3, name:'Consolidation', range:'45–55', c:'var(--c-gold)' },
  { n:4, name:'Transition',    range:'55–65', c:'var(--c-amber-text)' },
  { n:5, name:'Decumulation',  range:'65–75', c:'var(--c-acc3)' },
  { n:6, name:'Preservation',  range:'75–85', c:'var(--c-violet)' },
  { n:7, name:'Legacy',        range:'85+',   c:'var(--c-text3)' },
]

function stageFor(age) {
  if (age < 30) return STAGES[0]; if (age < 45) return STAGES[1]
  if (age < 55) return STAGES[2]; if (age < 65) return STAGES[3]
  if (age < 75) return STAGES[4]; if (age < 85) return STAGES[5]
  return STAGES[6]
}

// FIX-3.C — expanded from 7 to 11 questions to satisfy spec v1.1 §10 always-asked
// set: entry mode (§3), jurisdiction (§0A), age (Q1), income (Q3), liquid wealth
// (Q4), property (Q5), focus/concerns (Q7), setup, risk appetite, will (Q-A6),
// LPA (Q-A7). Wording for Q-A6/Q-A7 lifted verbatim from
// 2-Product-onboarding-v1_1.md §10.6/§10.7.
const QUESTIONS = [
  {
    id:'entryMode', step:1, type:'single',
    q:'How will you use Sonuswealth?',
    hint:'Routes you to the right experience. (Spec §3 entry-mode pre-fork.)',
    opts:[
      { id:'individual', ico:'👤', lbl:'For myself',                sub:'Personal financial planning'                  },
      { id:'ifa',        ico:'👔', lbl:'I am a financial adviser',  sub:'Practice + client onboarding (waitlist)'      },
      { id:'company',    ico:'🏢', lbl:'For my company',            sub:'Director / business planning (waitlist)'      },
      { id:'exploring',  ico:'🔍', lbl:'Just exploring',            sub:'No commitments — see what it does'            },
    ],
  },
  {
    id:'jurisdiction', step:2, type:'single',
    q:'Where are you tax resident?',
    hint:'Without this no number is correct. (Spec §Q3A rank 3.)',
    opts:[
      { id:'UK', ico:'🇬🇧', lbl:'United Kingdom', sub:'UK-2026.1 tax engine' },
      { id:'IN', ico:'🇮🇳', lbl:'India',          sub:'India coverage (waitlist)' },
      { id:'IE', ico:'🇮🇪', lbl:'Ireland',        sub:'Ireland coverage (waitlist)' },
      { id:'CA', ico:'🇨🇦', lbl:'Canada',         sub:'Canada coverage (waitlist)' },
      { id:'AU', ico:'🇦🇺', lbl:'Australia',      sub:'Australia coverage (waitlist)' },
      { id:'TH', ico:'🇹🇭', lbl:'Thailand',       sub:'Thailand coverage (waitlist)' },
    ],
  },
  {
    id:'age', step:3, type:'slider',
    q:'How old are you?',
    hint:'Age determines your life stage and how Sonuswealth weights your scores.',
  },
  {
    id:'income', step:4, type:'currencySlider',
    q:'What\'s your annual income?',
    hint:'Pre-tax. Includes salary, dividends, pension drawdown, rental — everything you receive in a year.',
    min:0, max:300000, step:1000, default:50000,
  },
  {
    id:'liquidWealth', step:5, type:'currencySlider',
    q:'How much do you hold in cash or investments?',
    hint:'Cash savings + ISA + general investments. Not property, not pensions.',
    min:0, max:1000000, step:5000, default:50000,
  },
  {
    id:'propertyValue', step:6, type:'currencySlider',
    q:'What\'s your property worth?',
    hint:'Your home + any rental property, total. Use 0 if you don\'t own.',
    min:0, max:2000000, step:25000, default:0,
  },
  {
    id:'focus', step:7, type:'multi',
    q:'What are your main financial priorities?',
    hint:'Select all that apply — Sonuswealth builds your dashboard around these.',
    opts:[
      { ico:'📈', lbl:'Grow my wealth',          sub:'Investments, ISA, pension contributions' },
      { ico:'🏠', lbl:'Property planning',        sub:'Buy, remortgage, or release equity'    },
      { ico:'🏖', lbl:'Retirement planning',      sub:'When can I retire? Will my money last?' },
      { ico:'🏛', lbl:'Reduce inheritance tax',   sub:'Protect what you leave behind'         },
      { ico:'💼', lbl:'Business & tax planning',  sub:'Director, self-employed, owner'        },
      { ico:'👨‍👩‍👧', lbl:'Family & protection',  sub:'Life cover, income protection, kids' },
      { ico:'🌍', lbl:'Cross-border finances',    sub:'Assets or income in multiple countries' },
      { ico:'📊', lbl:'Investment portfolio',     sub:'Stocks, ETFs, commodities, alternatives' },
    ],
  },
  {
    id:'setup', step:8, type:'multi',
    q:'What best describes your situation?',
    hint:'Shapes the intelligence layer. Select all that apply.',
    opts:[
      { ico:'👤', lbl:'I manage my own finances', sub:'Self-directed — no adviser'          },
      { ico:'👫', lbl:'Planning as a couple',     sub:'Combine household allowances'        },
      { ico:'👔', lbl:'I have a financial adviser', sub:'Share your dashboard with your IFA' },
      { ico:'🏢', lbl:'I run a business',         sub:'Director, sole trader, partnership'  },
      { ico:'📊', lbl:'I am a financial adviser', sub:'Access the IFA professional view'    },
      { ico:'🏦', lbl:'I manage client portfolios', sub:'Practice intelligence for IFAs'    },
    ],
  },
  {
    id:'riskAppetite', step:9, type:'single',
    q:'How comfortable are you with investment risk?',
    hint:'Used to set your Sonuswealth Risk Score baseline and frame the options we show you. Sonuswealth gives information and guidance, not personal investment advice.',
    opts:[
      { id:'cautious',   ico:'🛡',  lbl:'Cautious',   sub:'Capital preservation first — small steady returns' },
      { id:'balanced',   ico:'⚖',  lbl:'Balanced',   sub:'Mix of growth and stability — moderate volatility' },
      { id:'growth',     ico:'📈',  lbl:'Growth',     sub:'Higher long-term returns — accept market swings'  },
      { id:'aggressive', ico:'🚀',  lbl:'Aggressive', sub:'Maximise growth — comfortable with large drawdowns' },
    ],
  },
  {
    // Spec §10.6 Q-A6 — wording verbatim
    id:'willStatus', step:10, type:'single',
    q:'Do you have a will?',
    hint:'Proactive estate discovery. (Spec §10.6 Q-A6 — always asked.)',
    opts:[
      { id:'current',  ico:'✅', lbl:'Yes — current',                  sub:'Executed and not significantly changed since' },
      { id:'outdated', ico:'📜', lbl:'Yes — but it\'s old / out of date', sub:'Executed but circumstances have changed materially' },
      { id:'unsure',   ico:'❓', lbl:'Not sure',                        sub:'Have one but unclear whether it\'s still valid' },
      { id:'none',     ico:'⚠️', lbl:'No',                              sub:'Don\'t have one' },
    ],
  },
  {
    // Spec §10.7 Q-A7 — wording verbatim. Combined into single tile because
    // tile UI doesn't support compound Y/N matrices yet; LPA-property and
    // LPA-health captured as one of three states. Founder-flagged for Phase 2
    // to split into two flags per spec.
    id:'lpaStatus', step:11, type:'single',
    q:'Do you have Lasting Power of Attorney arrangements?',
    hint:'Spec §10.7 Q-A7 — always asked. LPAs come in two types in the UK.',
    opts:[
      { id:'both', ico:'🛡', lbl:'Yes — both types',  sub:'Property & financial AND health & welfare' },
      { id:'one',  ico:'⚖', lbl:'Yes — one type',     sub:'Only one of the two registered' },
      { id:'none', ico:'⚠️', lbl:'No / not sure',     sub:'Engine flags as gap; Estate Readiness reflects' },
    ],
  },
]

const TOTAL = QUESTIONS.length

// ─── Reveal screen ──────────────────────────────────────────────────────────
function RevealScreen({ answers, onContinue }) {
  const preview = onboardingPreview(answers)
  const wband = fqBand(preview.wealth)
  const rband = riskBand(preview.risk)
  const stage = stageFor(answers.age)

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'24px 24px 16px' }}>
      <div style={{
        textAlign:'center',
        fontSize:11, fontWeight:700, color:'var(--c-text3)',
        textTransform:'uppercase', letterSpacing:1, marginBottom:12,
      }}>
        Initial reading
      </div>
      <div style={{
        fontSize:24, fontWeight:800, color:'var(--c-text)',
        textAlign:'center', lineHeight:1.3, marginBottom:8,
      }}>
        Welcome to Sonuswealth
      </div>
      <div style={{
        textAlign:'center', fontSize:13, color:'var(--c-text2)',
        marginBottom:24, lineHeight:1.5,
      }}>
        Stage {stage.n} · {stage.name} · {stage.range}
      </div>

      {/* Two-up score tiles */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <ScoreTile
          label="Wealth Score"
          score={preview.wealth}
          band={wband}
        />
        <ScoreTile
          label="Risk Score"
          score={preview.risk}
          band={rband}
        />
      </div>

      <div style={{
        marginTop:20, padding:'14px 16px',
        background:'var(--c-surface)', border:'1px solid var(--c-border)',
        borderRadius:14,
      }}>
        <SummaryRow label="Annual income"      value={fmt(answers.income || 0)} />
        <SummaryRow label="Liquid wealth"      value={fmt(answers.liquidWealth || 0)} />
        <SummaryRow label="Property value"     value={fmt(answers.propertyValue || 0)} />
        <SummaryRow label="Risk appetite"
          value={(answers.riskAppetite || '—').replace(/^./, c => c.toUpperCase())} last />
      </div>

      <div style={{
        textAlign:'center', fontSize:11, color:'var(--c-text3)',
        margin:'18px 0 0', lineHeight:1.6,
      }}>
        These are preview readings. Your full score recalculates from your real
        position once you connect data or pick a demo persona.
      </div>

      <button onClick={() => onContinue(answers)} style={{
        marginTop:22, width:'100%', padding:15,
        background:'var(--c-acc)', color:'var(--c-on-accent, #0B1F3A)',
        border:'none', borderRadius:100,
        fontSize:16, fontWeight:700, cursor:'pointer',
        boxShadow:'var(--sh-acc)',
      }}>
        See my dashboard →
      </button>
    </div>
  )
}

function ScoreTile({ label, score, band }) {
  return (
    <div style={{
      background:'var(--c-surface)',
      border:`1px solid ${band.colour}55`,
      borderRadius:16, padding:'14px 16px',
    }}>
      <div style={{
        fontSize:11, fontWeight:700, color:'var(--c-text3)',
        textTransform:'uppercase', letterSpacing:0.8, marginBottom:6,
      }}>
        {label}
      </div>
      <div style={{
        fontSize:32, fontWeight:800, color:band.colour, lineHeight:1,
      }}>
        {score}
        <span style={{ fontSize:13, color:'var(--c-text3)', fontWeight:400 }}> /100</span>
      </div>
      <div style={{ fontSize:13, fontWeight:600, color:band.colour, marginTop:4 }}>
        {band.name}
      </div>
    </div>
  )
}

function SummaryRow({ label, value, last }) {
  return (
    <div style={{
      display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'8px 0',
      borderBottom: last ? 'none' : '1px solid var(--c-sep)',
    }}>
      <span style={{ fontSize:13, color:'var(--c-text2)' }}>{label}</span>
      <span style={{ fontSize:13, fontWeight:700, color:'var(--c-text)' }}>{value}</span>
    </div>
  )
}

// ─── Question body renderers ──────────────────────────────────────────────
function CurrencySlider({ value, min, max, step, onChange }) {
  return (
    <div>
      <div style={{ textAlign:'center', padding:'24px 0 28px' }}>
        <div style={{
          fontSize:64, fontWeight:800, color:'var(--c-text)',
          letterSpacing:-2, lineHeight:1,
        }}>
          {fmt(value)}
        </div>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseInt(e.target.value, 10))}
        style={{ width:'100%' }}
      />
      <div style={{
        display:'flex', justifyContent:'space-between', marginTop:8,
        fontSize:11, color:'var(--c-text3)',
      }}>
        <span>{fmt(min)}</span>
        <span>{fmt(max)}+</span>
      </div>
    </div>
  )
}

function MultiPicker({ opts, selected, onToggle }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:4 }}>
      {opts.map((o, i) => {
        const sel = selected.includes(i)
        return (
          <div key={i} onClick={() => onToggle(i)} style={{
            display:'flex', alignItems:'center', gap:14, padding:'14px 18px',
            background: sel ? 'var(--c-acc2-bg)' : 'var(--c-surface)',
            border:`1.5px solid ${sel ? 'var(--c-acc2)' : 'var(--c-border)'}`,
            borderRadius:16, cursor:'pointer', transition:'all .15s ease',
          }}>
            <div style={{
              width:44, height:44, borderRadius:12,
              background: sel ? 'rgba(122,167,255,.15)' : 'var(--c-surface2)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:20, flexShrink:0,
            }}>{o.ico}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:15, fontWeight:600, color:'var(--c-text)', marginBottom:2 }}>{o.lbl}</div>
              <div style={{ fontSize:11, color:'var(--c-text3)', lineHeight:1.4 }}>{o.sub}</div>
            </div>
            <div style={{
              width:22, height:22, borderRadius:6, flexShrink:0,
              border:`1.5px solid ${sel ? 'var(--c-acc2)' : 'var(--c-border2)'}`,
              background: sel ? 'var(--c-acc2)' : 'transparent',
              display:'flex', alignItems:'center', justifyContent:'center',
              transition:'all .15s ease',
            }}>
              {sel && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SinglePicker({ opts, selected, onSelect }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:4 }}>
      {opts.map(o => {
        const sel = selected === o.id
        return (
          <div key={o.id} onClick={() => onSelect(o.id)} style={{
            display:'flex', alignItems:'center', gap:14, padding:'14px 18px',
            background: sel ? 'var(--c-acc-bg)' : 'var(--c-surface)',
            border:`1.5px solid ${sel ? 'var(--c-acc)' : 'var(--c-border)'}`,
            borderRadius:16, cursor:'pointer', transition:'all .15s ease',
          }}>
            <div style={{
              width:44, height:44, borderRadius:'50%',
              background: sel ? 'rgba(45,242,195,.15)' : 'var(--c-surface2)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:20, flexShrink:0,
            }}>{o.ico}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:15, fontWeight:600, color:'var(--c-text)', marginBottom:2 }}>{o.lbl}</div>
              <div style={{ fontSize:11, color:'var(--c-text3)', lineHeight:1.4 }}>{o.sub}</div>
            </div>
            <div style={{
              width:22, height:22, borderRadius:'50%', flexShrink:0,
              border:`1.5px solid ${sel ? 'var(--c-acc)' : 'var(--c-border2)'}`,
              background: sel ? 'var(--c-acc)' : 'transparent',
            }} />
          </div>
        )
      })}
    </div>
  )
}

// ─── Main export ────────────────────────────────────────────────────────────
//
// L2-5a (2026-05-28): device-side save-and-continue. Onboarding state
// (current step + answers) persists to localStorage so a tab close / reload
// doesn't lose the user's progress. On reveal (complete) the key is cleared
// so the next signup starts fresh. Cross-device resume = L2-5b (separate
// ticket — needs an early email-collection step + Supabase magic link).
const _ONBOARDING_LS_KEY = 'sw_onboarding_progress_v1'
const _DEFAULT_ANSWERS = {
  // FIX-3.C — added entryMode, jurisdiction, willStatus, lpaStatus to satisfy
  // spec v1.1 always-asked set (§3 entry-mode, §0A JQ1, §10.6, §10.7).
  entryMode: null,
  jurisdiction: null,
  age: 38,
  income: 50000,
  liquidWealth: 50000,
  propertyValue: 0,
  focus: [],
  setup: [],
  riskAppetite: null,
  willStatus: null,
  lpaStatus: null,
}

function _loadOnboardingProgress() {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(_ONBOARDING_LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    // Schema-version guard: ignore stored progress whose shape doesn't match
    // the current default. This is the safe-by-design escape hatch for when
    // QUESTIONS / answer fields change in a future release.
    if (parsed.version !== 1) return null
    if (!parsed.answers || typeof parsed.answers !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

function _saveOnboardingProgress(step, answers) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(_ONBOARDING_LS_KEY, JSON.stringify({
      version: 1,
      step,
      answers,
      savedAt: Date.now(),
    }))
  } catch {
    // localStorage full / disabled (private window) — silent skip. Resume is
    // a nice-to-have, not a correctness requirement.
  }
}

function _clearOnboardingProgress() {
  if (typeof localStorage === 'undefined') return
  try { localStorage.removeItem(_ONBOARDING_LS_KEY) } catch {}
}

// Exported for the L2-5a test harness so it can drive the persistence path
// without mounting React.
export const _onboardingPersistenceForTests = {
  KEY: _ONBOARDING_LS_KEY,
  load:  _loadOnboardingProgress,
  save:  _saveOnboardingProgress,
  clear: _clearOnboardingProgress,
}

export default function Onboarding({ onComplete, onBack }) {
  // L2-5a — restore prior progress eagerly so the first render shows the user
  // where they left off, not the default state.
  const _restored = _loadOnboardingProgress()
  const [step,    setStep]    = useState(_restored?.step    ?? 0)
  const [reveal,  setReveal]  = useState(false)
  const [answers, setAnswers] = useState({
    ..._DEFAULT_ANSWERS,
    ...(_restored?.answers || {}),
  })
  // Show a brief "picked up where you left off" hint after a real restore
  // (not on first-ever visit). Cleared after 4 seconds or on next interaction.
  const [resumedHint, setResumedHint] = useState(!!_restored)
  useEffect(() => {
    if (!resumedHint) return
    const t = setTimeout(() => setResumedHint(false), 4000)
    return () => clearTimeout(t)
  }, [resumedHint])

  // Persist on every step / answer change. useEffect debounces by batching
  // sync state updates, so the cost is one write per render — fine for this
  // size of payload.
  useEffect(() => {
    if (reveal) return // don't keep saving after the user has completed
    _saveOnboardingProgress(step, answers)
  }, [step, answers, reveal])

  function update(id, value) { setAnswers(a => ({ ...a, [id]: value })) }
  function toggleMulti(id, idx) {
    setAnswers(a => {
      const arr = [...(a[id] || [])]
      const i = arr.indexOf(idx)
      if (i >= 0) arr.splice(i, 1); else arr.push(idx)
      return { ...a, [id]: arr }
    })
  }

  if (reveal) {
    return (
      <div style={{ position:'absolute', inset:0, background:'var(--c-bg)',
        display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'56px 24px 8px', flexShrink:0 }}>
          <div style={{ display:'flex', gap:5, marginBottom:14 }}>
            {Array.from({ length: TOTAL }, (_, i) => (
              <div key={i} style={{
                height:3, flex:1, borderRadius:100,
                background:'var(--c-acc)',
              }} />
            ))}
          </div>
        </div>
        <RevealScreen answers={answers} onContinue={onComplete} />
      </div>
    )
  }

  const q = QUESTIONS[step]
  const isLast = step === TOTAL - 1

  function canContinue() {
    if (q.type === 'multi')   return (answers[q.id]?.length || 0) > 0
    if (q.type === 'single')  return answers[q.id] != null
    return true
  }

  function next() {
    if (step < TOTAL - 1) setStep(s => s + 1)
    else { _clearOnboardingProgress(); setReveal(true) }
  }

  function back() {
    if (step === 0) onBack()
    else setStep(s => s - 1)
  }

  function skip() { _clearOnboardingProgress(); setReveal(true) }

  return (
    <div style={{ position:'absolute', inset:0, background:'var(--c-bg)',
      display:'flex', flexDirection:'column', overflow:'hidden' }}>

      {/* L2-5a resumed-hint banner — surfaces briefly after restoring from
          localStorage so the user knows their previous answers were kept.
          Auto-dismisses after 4 s (see effect above) or on any state change. */}
      {resumedHint && (
        <div
          role="status"
          onClick={() => setResumedHint(false)}
          style={{
            position: 'absolute',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 5,
            padding: '8px 14px',
            background: 'var(--c-acc, #2DF2C3)',
            color: 'var(--c-acc-contrast, #0B1F3A)',
            borderRadius: 100,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.3,
            boxShadow: 'var(--sh1, 0 2px 6px rgba(0,0,0,0.18))',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          ↩ Picked up where you left off
        </div>
      )}

      {/* Header */}
      <div style={{ padding:'56px 24px 16px', flexShrink:0 }}>
        <div style={{ display:'flex', gap:5, marginBottom:20 }}>
          {Array.from({ length: TOTAL }, (_, i) => (
            <div key={i} style={{
              height:3, flex:1, borderRadius:100,
              background: i < step ? 'var(--c-acc)' :
                          i === step ? 'var(--c-text2)' : 'var(--c-surface3)',
              transition:'background .3s ease',
            }} />
          ))}
        </div>
        <div style={{
          display:'flex', justifyContent:'space-between',
          fontSize:11, fontWeight:600, color:'var(--c-text3)',
          textTransform:'uppercase', letterSpacing:1, marginBottom:8,
        }}>
          <span>Step {q.step} of {TOTAL}</span>
          <button onClick={skip} style={{
            background:'none', border:'none', cursor:'pointer',
            color:'var(--c-acc)', fontSize:11, fontWeight:600,
            textTransform:'uppercase', letterSpacing:1, padding:0,
          }}>
            Skip →
          </button>
        </div>
        <div style={{ fontSize:26, fontWeight:800, color:'var(--c-text)', lineHeight:1.2, letterSpacing:-.5 }}>
          {q.q}
        </div>
        {q.hint && (
          <div style={{ fontSize:13, color:'var(--c-text3)', marginTop:6, lineHeight:1.5 }}>{q.hint}</div>
        )}
      </div>

      {/* Body */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px 24px', WebkitOverflowScrolling:'touch' }}>

        {q.type === 'slider' && (
          <div>
            <div style={{ textAlign:'center', padding:'24px 0 28px' }}>
              <div style={{ fontSize:96, fontWeight:800, color:'var(--c-text)', letterSpacing:-5, lineHeight:1 }}>
                {answers.age}
                <span style={{ fontSize:22, fontWeight:400, color:'var(--c-text3)' }}> yrs</span>
              </div>
              <div style={{
                display:'inline-flex', alignItems:'center', gap:8, marginTop:12,
                background:'var(--c-surface)', border:'1px solid var(--c-border2)',
                borderRadius:100, padding:'7px 16px',
                fontSize:13, fontWeight:600, color:'var(--c-text2)',
              }}>
                <div style={{ width:9, height:9, borderRadius:'50%', background: stageFor(answers.age).c }} />
                {stageFor(answers.age).name} · {stageFor(answers.age).range}
              </div>
            </div>
            <input type="range" min="18" max="100" value={answers.age}
              onChange={e => update('age', parseInt(e.target.value, 10))}
              style={{ width:'100%' }}
            />
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, fontSize:11, color:'var(--c-text3)' }}>
              <span>18</span><span>100</span>
            </div>
          </div>
        )}

        {q.type === 'currencySlider' && (
          <CurrencySlider
            value={answers[q.id]} min={q.min} max={q.max} step={q.step}
            onChange={v => update(q.id, v)}
          />
        )}

        {q.type === 'multi' && (
          <MultiPicker opts={q.opts} selected={answers[q.id] || []}
            onToggle={i => toggleMulti(q.id, i)} />
        )}

        {q.type === 'single' && (
          <SinglePicker opts={q.opts} selected={answers[q.id]}
            onSelect={v => update(q.id, v)} />
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding:'16px 24px', paddingBottom:'max(16px,env(safe-area-inset-bottom))',
        background:'var(--c-bg)', borderTop:'1px solid var(--c-border)', flexShrink:0,
      }}>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={back} style={{
            width:50, height:50, borderRadius:14,
            background:'var(--c-surface)', border:'1px solid var(--c-border2)',
            color:'var(--c-text2)', fontSize:18, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
          }}>←</button>
          <button onClick={next} disabled={!canContinue()} style={{
            flex:1, padding:15,
            background: canContinue() ? (isLast ? 'var(--c-acc)' : 'var(--c-text)') : 'var(--c-surface2)',
            color: canContinue() ? (isLast ? 'var(--c-on-accent, #0B1F3A)' : 'var(--c-bg)') : 'var(--c-text3)',
            border: `1px solid ${canContinue() ? 'transparent' : 'var(--c-border2)'}`,
            borderRadius:100, fontSize:16, fontWeight:700,
            transition:'all .2s ease',
            boxShadow: isLast && canContinue() ? 'var(--sh-acc)' : 'none',
          }}>
            {isLast ? 'See my scores →' : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  )
}
