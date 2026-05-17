import { useState } from 'react'
import { netWorth, calcFQ, calcRisk } from '../../engine/fq-calculator.js'

function safe(fn, fallback) { try { return fn() ?? fallback } catch { return fallback } }

function buildEntityContext(entity) {
  if (!entity) return ''
  const nw     = safe(() => netWorth(entity), 0)
  const age    = entity?.age || entity?.individual?.age || ''
  const fq     = safe(() => calcFQ(entity), { total: 0 })
  const risk   = safe(() => calcRisk(entity), { total: 0 })
  const sipp   = safe(() => {
    const a = entity?.assets || {}
    const n = v => typeof v === 'number' ? v
      : Array.isArray(v) ? v.reduce((s, x) => s + (+x.currentValue || +x.value || 0), 0)
      : +v?.total || +v?.value || 0
    return n(a.sipp) + n(a.pension) + n(a.pensions)
  }, 0)
  const income = safe(() => entity?.income?.salary || entity?.income?.total || 0, 0)
  const parts  = []
  if (age)        parts.push(`Age: ${age}`)
  if (nw)         parts.push(`Net worth: £${Math.round(nw / 1000)}k`)
  if (sipp)       parts.push(`Pension/SIPP: £${Math.round(sipp / 1000)}k`)
  if (income)     parts.push(`Annual income: £${Math.round(income / 1000)}k`)
  if (fq.total)   parts.push(`Wealth Score: ${fq.total}/100`)
  if (risk.total) parts.push(`Risk Score: ${risk.total}/100`)
  return parts.length ? `[My financial context: ${parts.join(' · ')}] ` : ''
}

// ── Question bank ─────────────────────────────────────────────────────────────

const QUESTIONS = {
  relocate: [
    { id: 'country',      q: 'Which country are you considering?',                    chips: ['Portugal', 'UAE', 'Spain', 'Kenya', 'Australia', 'Other'] },
    { id: 'country_other',q: 'Which country specifically?',                           type: 'text', showIf: a => a.country === 'Other' },
    { id: 'home',         q: 'What would you do with your UK home?',                  chips: ['Sell it', 'Rent it out', 'Keep it empty', 'Not decided'] },
    { id: 'working',      q: 'Are you still working?',                                chips: ['Full-time', 'Part-time', 'Retired', 'Self-employed'] },
    { id: 'partner',      q: 'Will a partner or spouse relocate with you?',           chips: ['Yes', 'No', 'Not decided'] },
    { id: 'timeline',     q: 'When are you planning this?',                           chips: ['Within 1 year', '1–3 years', '3–5 years', 'Just exploring'] },
    { id: 'duration',     q: 'How long do you plan to stay?',                         chips: ['Permanently', '5–10 years', 'Trial — see how it goes', 'Not sure'] },
    { id: 'lifestyle',    q: 'Target lifestyle cost vs your current UK spend?',        chips: ['Same level', '~20% cheaper', '~40% cheaper', 'Not sure'] },
    { id: 'income_uk',    q: 'Which UK income sources stay after moving?',             chips: ['Pension / SIPP', 'UK salary', 'UK rental income', 'Dividends', 'State pension', 'None'], multi: true },
    { id: 'healthcare',   q: 'Will you need regular access to UK healthcare?',         chips: ['Yes — ongoing treatment', 'Occasional — NHS visits fine', 'No — happy to go private'] },
  ],
  retire: [
    { id: 'target_age',   q: 'What retirement age are you modelling?',                chips: ['Right now', '1 year earlier', '2 years earlier', '3 years earlier', '5 years earlier'] },
    { id: 'income',       q: 'Target annual income in retirement?',                   chips: ['£50K', '£70K', '£85K — similar to now', '£100K', '£120K+'] },
    { id: 'income_order', q: 'Which pot would you draw from first?',                  chips: ['ISA first (tax-free)', 'SIPP first (IHT benefit)', 'Mix both optimally', 'Need advice'] },
    { id: 'partner',      q: 'Is a partner retiring at the same time?',               chips: ['Yes — same time', 'Yes — different timing', 'No partner', 'Not sure'] },
    { id: 'mortgage',     q: 'Mortgage status at your retirement date?',              chips: ['Paid off', 'Under 5 years left', '5–15 years left', 'Over 15 years left'] },
    { id: 'dependants',   q: 'Dependants relying on your income?',                    chips: ['None', 'Children in education', 'Adult children', 'Other dependants'] },
    { id: 'part_time',    q: 'Open to part-time work or consulting in early retirement?', chips: ['Yes — happy to', 'Maybe if needed', 'No — clean break wanted'] },
    { id: 'sipp_status',  q: 'Have you started addressing the SIPP IHT deadline (April 2027)?', chips: ['Yes — drawdown started', 'In progress with adviser', 'Not yet', 'What does this mean?'] },
  ],
  part_time: [
    { id: 'arrangement',  q: 'What arrangement are you considering?',                 chips: ['4-day week', '3-day week', '6-month sabbatical', '1-year career break'] },
    { id: 'reason',       q: "What's the main driver?",                               chips: ['Burnout or stress', 'Health reasons', 'Family or caring', 'A project or new venture', 'Just want more time'] },
    { id: 'income_target',q: 'What income could you comfortably live on?',            chips: ['£40K/yr', '£50K/yr', '£60–70K/yr', '£80K/yr', 'Zero — have enough saved'] },
    { id: 'duration',     q: 'How long would this last?',                             chips: ['3–6 months', '6–12 months', '1–2 years', 'Open-ended / indefinite'] },
    { id: 'employer',     q: 'Your employer situation?',                              chips: ['Still negotiating', 'Already agreed in principle', 'Self-employed / flexible', 'Would need to resign'] },
    { id: 'return',       q: 'Do you plan to return to full-time work?',              chips: ['Definitely yes', 'Probably yes', 'Maybe', 'Probably not'] },
    { id: 'pension',      q: 'Concerned about pension contributions during the break?', chips: ['Yes — key concern', 'Somewhat', 'Not really — enough saved already'] },
  ],
  house: [
    { id: 'target_value', q: 'Approximate value of the new property?',               chips: ['£1M', '£1.5M', '£2M', '£2.5M', '£3M+'] },
    { id: 'current_home', q: 'What would you do with your current home?',             chips: ['Sell it', 'Rent it out', 'Extend instead of moving', 'Not decided'] },
    { id: 'funding',      q: 'How would you fund the move?',                          chips: ['Sell + use ISA / cash', 'Remortgage the gap', 'Mix of both', 'Not sure yet'] },
    { id: 'mortgage',     q: 'Current mortgage remaining?',                           chips: ['Paid off', 'Under £200K', '£200K–£500K', 'Over £500K'] },
    { id: 'timeline',     q: 'When are you thinking of doing this?',                  chips: ['Within 6 months', '6–12 months', '1–2 years', 'Just exploring'] },
    { id: 'driver',       q: 'Primary reason for moving?',                            chips: ['More space', 'Better location', 'Garden or outside space', 'Renovation project', 'Investment / rental'] },
    { id: 'sipp_timing',  q: 'Have you factored in the April 2027 SIPP deadline when timing this?', chips: ['Yes — factored in', 'No — should I?', 'Not sure what this means'] },
  ],
  children: [
    { id: 'amount',       q: 'How much are you thinking of giving or lending?',       chips: ['£25K', '£50K', '£100K', '£150K', '£250K+'] },
    { id: 'count',        q: 'How many children are you helping?',                    chips: ['1', '2', '3 or more'] },
    { id: 'age',          q: "What age range are your children?",                     chips: ['Under 18', '18–25', '25–35', 'Mixed ages'] },
    { id: 'purpose',      q: 'Primary purpose of the help?',                          chips: ['Property deposit', 'General financial head-start', 'University or education', 'Starting a business', 'Not sure yet'] },
    { id: 'structure',    q: 'How would you prefer to structure it?',                 chips: ['Outright gift', 'Family trust', 'Family offset mortgage', 'Informal loan', 'Not sure — advise me'] },
    { id: 'priority',     q: 'What matters most to you?',                             chips: ['Reduce my IHT estate', 'Help them immediately', 'Keep some control', 'All three equally'] },
    { id: 'timing',       q: 'When are you planning this?',                           chips: ['This tax year', '1–2 years', '3–5 years', 'Exploring timing'] },
    { id: 'annual_gifts', q: 'Are you already using your £3K annual gift exemption?', chips: ['Yes', 'No — tell me more', 'Not sure'] },
  ],
}

const KEY_MAP = {
  relocate:  'relocate',
  house:     'house',
  retire:    'retire',
  part_time: 'part_time',
  children:  'children',
}

function buildEnrichedQuery(baseQuery, scenarioKey, answers, entity) {
  const ctx       = buildEntityContext(entity)
  const questions = QUESTIONS[scenarioKey] || []
  const parts = questions
    .filter(q => !q.showIf || q.showIf(answers))
    .map(q => {
      const val = answers[q.id]
      if (!val) return null
      const valStr = Array.isArray(val) ? val.join(', ') : val
      return `${q.q.replace(/\?$/, '')}: ${valStr}`
    })
    .filter(Boolean)
  const enriched = parts.length
    ? `${baseQuery} Here is additional context about my situation: ${parts.join('; ')}.`
    : baseQuery
  return ctx + enriched
}

export default function ScenarioIntake({ scenario, entity, onSubmit, onBack }) {
  const [answers, setAnswers] = useState({})

  const qKey = KEY_MAP[scenario.key] || scenario.key
  const allQs = QUESTIONS[qKey] || []
  const visibleQs = allQs.filter(q => !q.showIf || q.showIf(answers))

  function toggle(id, val, multi) {
    setAnswers(prev => {
      if (multi) {
        const cur = Array.isArray(prev[id]) ? prev[id] : []
        const next = cur.includes(val) ? cur.filter(x => x !== val) : [...cur, val]
        return { ...prev, [id]: next }
      }
      return { ...prev, [id]: prev[id] === val ? undefined : val }
    })
  }

  const answeredCount = visibleQs.filter(q => {
    const v = answers[q.id]
    return v && (Array.isArray(v) ? v.length > 0 : v.trim?.() !== '')
  }).length

  function handleSubmit() {
    const qKey2 = KEY_MAP[scenario.key] || scenario.key
    const enriched = buildEnrichedQuery(scenario.query, qKey2, answers, entity)
    onSubmit({ query: enriched, eventId: scenario.eventId })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--c-sep)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} aria-label="Back" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-acc)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, padding: 0, flexShrink: 0 }}>
          <span style={{ fontSize: 16 }}>←</span>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: 'var(--c-text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            {scenario.icon} What if?
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-text)', marginTop: 1, lineHeight: 1.2 }}>{scenario.label}</div>
        </div>
        <span style={{ fontSize: 11, color: 'var(--c-text3)', flexShrink: 0 }}>{answeredCount}/{visibleQs.length}</span>
      </div>

      {/* Questions */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 0' }}>
        {visibleQs.map(q => {
          const val = answers[q.id]
          return (
            <div key={q.id} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', marginBottom: 8, lineHeight: 1.3 }}>
                {q.q}
                {q.multi && <span style={{ fontSize: 10, color: 'var(--c-text3)', fontWeight: 500, marginLeft: 6 }}>select all</span>}
              </div>
              {q.type === 'text' ? (
                <input
                  value={val || ''}
                  onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
                  placeholder="Type your answer…"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--c-sep)', background: 'var(--c-surface2)', color: 'var(--c-text)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                />
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {q.chips.map(chip => {
                    const sel = q.multi ? (Array.isArray(val) && val.includes(chip)) : val === chip
                    return (
                      <button key={chip} onClick={() => toggle(q.id, chip, q.multi)} style={{
                        padding: '6px 12px', borderRadius: 999, fontFamily: 'inherit', cursor: 'pointer',
                        border: `1.5px solid ${sel ? 'var(--c-acc)' : 'var(--c-sep)'}`,
                        background: sel ? 'rgba(93,219,194,0.12)' : 'var(--c-surface2)',
                        color: sel ? 'var(--c-acc)' : 'var(--c-text2)',
                        fontSize: 12, fontWeight: sel ? 700 : 600,
                        transition: 'all 120ms ease',
                      }}>
                        {chip}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Submit */}
      <div style={{ padding: '12px 14px 16px', borderTop: '1px solid var(--c-sep)' }}>
        <button onClick={handleSubmit} style={{
          width: '100%', padding: '12px 20px', borderRadius: 999, border: 'none',
          background: 'var(--c-acc)', color: '#0B1F3A', fontSize: 13, fontWeight: 800,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Explore this scenario →
        </button>
        <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--c-text3)', marginTop: 6 }}>
          Your financial data is included automatically · FCA boundary applies
        </div>
      </div>
    </div>
  )
}
