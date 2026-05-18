// 🚨 SECURITY-CRITICAL: Anthropic API key is currently bundled into client JS.
// Tracking: D-ASK-SEC-1. Pre-launch blocker. Move to server-side proxy before any public access.
// ─────────────────────────────────────────────────────────────────────────────
// Ask.jsx — bottom-sheet content renderer (D-ASK-1, D-SHEET-1)
// ─────────────────────────────────────────────────────────────────────────────
// Spec: 2-Product-ai-ask-v1_0.md
//
// Sheet content only — parent (Dashboard) owns OverlayShell chrome + AskPill.
//
// Design-token / animation polish (this pass):
//   · `.sw-eyebrow` for "Ask Sonu" header label
//   · Greeting types out character-by-character on first open (50ms / char)
//   · Persona chips fan in via <RevealStagger> after greeting completes
//   · Each new assistant bubble enters with `.sw-fade-in-up`
//   · Provenance chips reveal 200ms after each assistant message
//   · Action chips use `.sw-chip` + `.sw-lift` + `.sw-press`
//   · Numbers in metric strip use <Num animate />
//   · Off-topic redirect uses subtle amber warning tint
//   · Decision Engine card uses `.sw-card-elevated`; active step `.sw-pulse-glow`
//   · Send button: ripple via `.sw-tap-ripple`; disabled when input empty
//   · Suggested chips coloured by domain (mint / blue / amber / coral / violet)
//
// Deviations fixed previously (kept):
//   1. Pill + sheet architecture (D-ASK-1, D-SHEET-1) — see Dashboard
//   2. Source disclosure chips on every response (D-ASK-6) — ProvenanceChip
//   3. FCA boundary rewrite layer (D-ASK-8) — fcaBoundaryCheck()
//   4. Three-response architecture Explain/Model/Act (§6) — classifyIntent()
//   5. Decision Engine 7-step skeleton (§11) — DecisionEnginePanel
//   6. Per-tab context injection (§5) — currentTab → buildSystemPrompt()
//   7. Persona-aware register (§14, §Q7A) — chipsForArchetype()
//   8. Off-topic redirect (D-ASK-2, §8.2) — isOffTopic() guard
//   9. 30-min / tab-switch session memory (D-ASK-3, §13.1) — useSessionMemory
//  10. Events (§17) — emitAskEvent() wrapper
//  11. API key exposure flag — comment block below
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect, useCallback } from 'react'
import { fmt, daysLeft, netWorth, costOfInaction, calcFQ, calcRisk, TAX } from '../engine/fq-calculator.js'
import { ProvenanceChip, Num, RevealStagger } from '../components/shared/index.js'

// ─────────────────────────────────────────────────────────────────────────────
// 🚨 SECURITY-CRITICAL FLAG (D-ASK-SEC-1)
// `import.meta.env.VITE_*` keys are bundled into the client. The Anthropic API
// key is exposed in the JS bundle on every Vite build.
// PRE-LAUNCH BLOCKER: replace fetch(...) with a server-side proxy
//   (e.g. /api/ask) that holds the secret server-side. Tracked: D-ASK-SEC-1.
// When VITE_ANTHROPIC_KEY is unset, the demo-response fallback path is the
// default (see send() try/catch — empty key → 401 → catch → getDemoResponse).
// ─────────────────────────────────────────────────────────────────────────────
const API_KEY = import.meta.env.VITE_ANTHROPIC_KEY || ''
const USE_DEMO_FALLBACK = !API_KEY

// Canonical FCA boundary string — used in static footer, per-response auto-append,
// and system-prompt instruction. ONE source of truth. (Fixes F-ASK-DUP-01.)
const FCA_BOUNDARY =
  'Not regulated financial advice — verify with a qualified FCA-authorised adviser before acting.'

const SESSION_TIMEOUT_MS = 30 * 60 * 1000 // §13.1 — 30 min idle clear
const TYPE_CHAR_MS       = 28              // greeting type-out cadence

// ─────────────────────────────────────────────────────────────────────────────
// 10. EVENTS (§17)
// ─────────────────────────────────────────────────────────────────────────────
function emitAskEvent(type, payload = {}) {
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent('finio:event', {
      detail: { type, ts: Date.now(), payload },
    }))
  }
  if (typeof console !== 'undefined') console.debug('[ASK_EVENT]', type, payload)
}

const EV = {
  ASK_SESSION_OPENED:        'ASK_SESSION_OPENED',
  ASK_QUERY_SUBMITTED:       'ASK_QUERY_SUBMITTED',
  ASK_RESPONSE_DELIVERED:    'ASK_RESPONSE_DELIVERED',
  ASK_FCA_BOUNDARY_FLAG:     'ASK_FCA_BOUNDARY_FLAG',
  ASK_MODEL_SAVED:           'ASK_MODEL_SAVED',
  DECISION_COMMITTED:        'DECISION_COMMITTED',
  ASK_DECISION_ENGINE_INVOKED:'ASK_DECISION_ENGINE_INVOKED',
  ASK_SESSION_CLOSED:        'ASK_SESSION_CLOSED',
  ASK_OFFTOPIC_REDIRECT:     'ASK_OFFTOPIC_REDIRECT',
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. FCA BOUNDARY REWRITE LAYER (D-ASK-8)
// ─────────────────────────────────────────────────────────────────────────────
const PROHIBITED_PATTERNS = [
  { re: /\byou should\b/gi,         to: 'one option is to' },
  { re: /\byou must\b/gi,           to: 'you may want to' },
  { re: /\byou need to\b/gi,        to: 'you might consider' },
  { re: /\bdo this now\b/gi,        to: 'model this and decide' },
  { re: /\bthe right answer is\b/gi,to: 'one option to consider is' },
  { re: /\bI recommend\b/gi,        to: 'you might consider' },
  { re: /\bstart drawdown\b/gi,     to: 'model drawdown' },
  { re: /\bbuy this\b/gi,           to: 'consider whether to buy' },
  { re: /\bsell this\b/gi,          to: 'consider whether to sell' },
]

const TAX_TOUCHING_RE = /\b(tax|iht|inheritance|nrb|rnrb|drawdown|gift|estate|allowance|capital gains|cgt|isa|sipp|pension)\b/i

function fcaBoundaryCheck(text) {
  if (!text) return { text: '', flagged: false, taxTouching: false }
  let out = text
  let flagged = false
  for (const { re, to } of PROHIBITED_PATTERNS) {
    if (re.test(out)) { flagged = true; out = out.replace(re, to) }
  }
  const taxTouching = TAX_TOUCHING_RE.test(out)
  // Note: per-bubble FCA line is rendered at render-time (only if bubble is
  // NOT the last one — otherwise footer covers it). See Bubble + render loop.
  // Strip any verify-line the model may have appended to avoid double display.
  out = out.replace(/\n*\*?Verify with .*?adviser[^*\n]*\*?\.?\s*$/i, '').trimEnd()
  if (flagged) emitAskEvent(EV.ASK_FCA_BOUNDARY_FLAG, { rewrites: true })
  return { text: out, flagged, taxTouching }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. INTENT CLASSIFICATION — Explain / Model / Act (§6)
// ─────────────────────────────────────────────────────────────────────────────
function classifyIntent(q) {
  const s = q.toLowerCase()
  if (/^(act|commit|do|execute|gift|drawdown now|nominate)\b/.test(s) || /\b(take action|want to act|going to act|ready to act)\b/.test(s)) return 'act'
  if (/\b(model|simulate|compare|what if|scenario|project|forecast)\b/.test(s)) return 'model'
  return 'explain'
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. OFF-TOPIC REDIRECT (D-ASK-2, §8.2)
// ─────────────────────────────────────────────────────────────────────────────
const FINANCE_TERMS = /\b(score|wealth|risk|tax|iht|inheritance|pension|sipp|isa|drawdown|estate|gift|will|lpa|nominat|protect|insur|mortgage|debt|cashflow|income|investment|portfolio|allowance|trust|bpr|cgt|rnrb|nrb|finio|caelixa|sonus|adviser|money|fund|bond|equity|property|rental|annuity|jurisdic|nri)\b/i

function isOffTopic(q) {
  if (!q || q.length < 3) return false
  return !FINANCE_TERMS.test(q)
}

const OFF_TOPIC_REPLY =
  'I can only help with your financial position — wealth, tax, estate, ' +
  'protection, cashflow, risk, and your Sonuswealth Wealth Score. Try one ' +
  'of the suggested questions below, or rephrase in those terms.'

// ─────────────────────────────────────────────────────────────────────────────
// 7. PERSONA-AWARE REGISTER (§14, §Q7A)
// Chip + tint pairs so suggestions render with semantic colour by domain.
// ─────────────────────────────────────────────────────────────────────────────
const ARCHETYPE_CHIPS = {
  bruce:    [
    { text: 'Model the three drawdown scenarios for me',          tint: 'amber'  },
    { text: 'How much IHT do I avoid by drawing £37,700/yr?',    tint: 'amber'  },
    { text: 'What happens if I delay drawdown one more year?',   tint: 'coral'  },
  ],
  tony:     [
    { text: 'Explain my BPR position',                            tint: 'mint'   },
    { text: 'Model gifting business shares into trust',           tint: 'violet' },
    { text: 'How does my company exit affect IHT?',               tint: 'amber'  },
  ],
  hermione: [
    { text: 'Which clients have a 2027 deadline?',                tint: 'coral'  },
    { text: 'Show practice-wide drawdown opportunity',            tint: 'blue'   },
    { text: 'Which clients need a nomination review?',            tint: 'mint'   },
  ],
  wonka:    [
    { text: 'How long does my portfolio last?',                   tint: 'blue'   },
    { text: 'Model sequence-of-returns risk',                     tint: 'amber'  },
    { text: 'What is my safe withdrawal rate?',                   tint: 'mint'   },
  ],
  priya:    [
    { text: 'Compare UK vs India tax position',                   tint: 'violet' },
    { text: 'Explain my domicile status',                         tint: 'blue'   },
    { text: 'Model NRI repatriation',                             tint: 'mint'   },
  ],
  default:  [
    { text: 'What moves my Wealth Score most?',                   tint: 'mint'   },
    { text: 'Explain my IHT exposure',                            tint: 'amber'  },
    { text: 'What should I prioritise this tax year?',            tint: 'blue'   },
    { text: 'How do I improve my tax efficiency?',                tint: 'violet' },
  ],
}

function chipsForArchetype(entity) {
  const a = (entity?.archetype || '').toLowerCase()
  if (ARCHETYPE_CHIPS[a]) return ARCHETYPE_CHIPS[a]
  if (entity?.isIFA) return ARCHETYPE_CHIPS.hermione
  return ARCHETYPE_CHIPS.default
}

// Auto-tint a follow-up string by keyword (used after API responses).
function tintFor(text) {
  const s = (text || '').toLowerCase()
  if (/\b(iht|estate|deadline|2027|inheritance)\b/.test(s))     return 'amber'
  if (/\b(risk|protect|insur|gap)\b/.test(s))                   return 'coral'
  if (/\b(score|wealth|caelixa|finio|sonus|sonuswealth|sonu)\b/.test(s)) return 'mint'
  if (/\b(tax|allowance|cgt|isa)\b/.test(s))                    return 'blue'
  if (/\b(gift|trust|bpr)\b/.test(s))                           return 'violet'
  return 'neutral'
}

function decorateChips(arr) {
  return (arr || []).map(c =>
    typeof c === 'string' ? { text: c, tint: tintFor(c) } : c
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. PER-TAB CONTEXT INJECTION (§5)
// ─────────────────────────────────────────────────────────────────────────────
const TAB_CONTEXT = {
  home:  'CONTEXT: User on Home tab. Frame around Wealth Score and the single highest-leverage move.',
  money: 'CONTEXT: User on My Money tab. Frame around portfolio, allocation, and BPR/ISA wrappers.',
  flow:  'CONTEXT: User on Cashflow tab. Frame around income, expenditure, and the 12-month runway.',
  tax:   'CONTEXT: User on Tax & Estate tab. Frame around IHT, drawdown options, and the April 2027 deadline.',
  risk:  'CONTEXT: User on Risk tab. Frame around resilience, protection gaps, and dependency exposure.',
  plan:  'CONTEXT: User on Timeline tab. Frame around life-arc and milestone planning.',
}

function buildSystemPrompt(entity, currentTab = 'home') {
  const fq   = calcFQ(entity)
  const nw   = netWorth(entity)
  const coi  = costOfInaction(entity)
  const days = daysLeft()
  const a    = entity.assets || {}
  const prot = a.protection || {}
  const inc  = entity.income || {}
  const liab = entity.liabilities || {}

  let risk = null
  // eslint-disable-next-line no-empty
  try { risk = calcRisk(entity) } catch {}

  const protLines = [
    prot.lifeInsurance?.exists
      ? `Life insurance ${fmt(prot.lifeInsurance.amount||0)}${prot.lifeInsurance.inTrust ? ' (in trust)' : ' (NOT in trust — adds to estate)'}`
      : 'No life insurance',
    prot.criticalIllness?.exists
      ? `Critical illness cover ${fmt(prot.criticalIllness.amount||0)}`
      : 'No critical illness cover',
    prot.incomeProtection?.exists
      ? 'Income protection in place'
      : 'No income protection',
  ].join(' · ')

  const liabLines = []
  if (liab.mortgage?.outstanding > 0)
    liabLines.push(`Mortgage ${fmt(liab.mortgage.outstanding)} (${liab.mortgage.rateType} rate, ${liab.mortgage.remainingYears} years remaining)`)
  ;(liab.otherLoans || []).forEach(l => liabLines.push(`${l.type || 'Loan'} ${fmt(l.outstanding)}`))
  const liabStr = liabLines.length ? liabLines.join(' · ') : 'No debt'

  const deadline = coi > 0 && days < 500
    ? `\nCRITICAL DEADLINE: DC pension enters estate for IHT in ${days} days (6 April 2027). Cost of inaction: ${fmt(coi)}.`
    : ''

  const vaultDocs = (entity?.documents || [])
    .map(d => `  - ${d.name} (${d.type}, uploaded ${d.uploaded_at?.slice(0,10) || 'unknown'})`)
    .join('\n')

  const systemParts = []
  if (vaultDocs) systemParts.push(`Vault documents on file:\n${vaultDocs}`)

  return `You are Sonuswealth AI — a financial planning intelligence assistant. You are NOT a regulated financial adviser. You provide planning guidance and education only.

FCA BOUNDARY RULES (STRICT):
- Never use "you should", "you must", "I recommend", "the right answer is", "do this now"
- Use "one option is", "you might consider", "model this and decide"
- Do NOT append a verify-line yourself. The UI displays the canonical boundary line: "${FCA_BOUNDARY}"

${TAB_CONTEXT[currentTab] || TAB_CONTEXT.home}

PERSON: ${entity.name}, age ${entity.age || '?'}, ${entity.lifeStageName || ''} stage.
${entity.archetype ? `ARCHETYPE: ${entity.archetype}` : ''}
${entity.isIFA ? 'ROLE: Independent Financial Adviser. Context: practice management and client intelligence.' : ''}
${entity.isCouple ? 'HOUSEHOLD: Couple account.' : ''}

WEALTH SCORE: ${fq.total}/100 · ${fq.band.name} (momentum ${fq.momentum?.toFixed(2) || '1.00'})
${risk ? `RISK SCORE: ${risk.total}/100 · ${risk.band.name} (confidence: ${risk.confidenceLevel || 'low'})` : ''}
NET WORTH: ${fmt(nw)}

ASSETS:
- Pension (SIPP/DC): ${fmt(a.sipp?.total || 0)} across ${a.sipp?.pensions?.length || 0} pension(s)
- ISA: ${fmt(a.isa?.value || 0)}
- Property: ${fmt((a.residence?.value||0)*(a.residence?.ownershipShare||1))}
- Portfolio/GIA: ${fmt(a.portfolio?.value || 0)}${a.portfolio?.bpr ? ' (BPR qualifying)' : ''}
- Cash: ${fmt(a.cash?.total || 0)}
${a.trustGifts ? `- Trust gifts: ${fmt(a.trustGifts.total)} (gifted ${a.trustGifts.date})` : ''}

INCOME:
- Employment: ${fmt(inc.employment || 0)}/yr
- Dividends: ${fmt(inc.dividends || 0)}/yr
- State Pension: ${fmt(inc.statePension?.annual || 0)}/yr from age ${inc.statePension?.startAge || 67}
- Current drawdown: ${fmt(entity.drawdown || 0)}/yr

PROTECTION: ${protLines}
LIABILITIES: ${liabStr}
WILL: ${entity.willStatus || 'not recorded'} · LPA: ${entity.lpaStatus || 'not recorded'}
${deadline}

RULES: ${TAX.ver} verified April 2026. Personal allowance ${fmt(TAX.pa)}. Basic rate band ${fmt(TAX.brl)}. IHT nil-rate band ${fmt(TAX.nrb)}. RNRB ${fmt(TAX.rnrb)}. IHT rate ${(TAX.ihtRate * 100).toFixed(0)}%.

Respond in 3–4 sentences maximum. Use their actual numbers. End with one option to consider (not a recommendation).${systemParts.length ? '\n\n' + systemParts.join('\n\n') : ''}`
}

// ─── Source attribution heuristic (§7.1 chip taxonomy — spec verbatim) ────
// Spec §7.1 declares 5 chip types with explicit labels:
//   - "From your data"
//   - "From UK-2026.1"
//   - "From your Vault"
//   - "General guidance"
//   - "From your data + UK-2026.1"   (mixed)
function inferSources(text) {
  const hasData = /\b(your|portfolio|pension|isa|sipp|cashflow|score)\b/i.test(text)
  const hasRules = TAX_TOUCHING_RE.test(text) || /\b(rules|allowance|nil-rate|rnrb|nrb)\b/i.test(text)
  const hasVault = /\b(uploaded|vault|statement|document)\b/i.test(text)
  const sources = []
  if (hasData && hasRules) sources.push('From your data + UK-2026.1')
  else if (hasData)        sources.push('From your data')
  else if (hasRules)       sources.push(`From ${TAX.ver}`)
  if (hasVault)            sources.push('From your Vault')
  if (sources.length === 0) sources.push('General guidance')
  return sources
}

// ─── Demo fallback responses ──────────────────────────────────────────────
// Net-drawdown estimator. Accounts for the user's existing taxable income
// stacking against PA + basic-rate band before applying 20% / 40% bands.
// (Fixes F-ASK-MATH-01 — was hardcoded £29,000.)
function estimateNetDrawdown(grossDrawdown, entity) {
  const inc = entity?.income || {}
  const otherTaxable =
    (inc.employment || 0) +
    (inc.dividends || 0) +
    (inc.statePension?.annual || 0) +
    (inc.rental || 0)
  const totalGross = otherTaxable + grossDrawdown
  // Tax slabs against TOTAL income, then attribute the drawdown's marginal portion.
  const totalTax = (function () {
    let taxed = 0
    let inc1 = Math.max(0, totalGross - TAX.pa)        // taxable above PA
    const brBand = Math.min(inc1, TAX.brl)              // basic-rate band
    taxed += brBand * TAX.br
    inc1 -= brBand
    const hrBand = Math.min(inc1, Math.max(0, TAX.art - TAX.brt))
    taxed += hrBand * TAX.hr
    inc1 -= hrBand
    taxed += inc1 * TAX.ar
    return taxed
  })()
  // Other-income tax baseline (what they'd pay without drawdown).
  const baseTax = (function () {
    let taxed = 0
    let inc1 = Math.max(0, otherTaxable - TAX.pa)
    const brBand = Math.min(inc1, TAX.brl)
    taxed += brBand * TAX.br
    inc1 -= brBand
    const hrBand = Math.min(inc1, Math.max(0, TAX.art - TAX.brt))
    taxed += hrBand * TAX.hr
    inc1 -= hrBand
    taxed += inc1 * TAX.ar
    return taxed
  })()
  const drawdownTax = Math.max(0, totalTax - baseTax)
  return Math.round(grossDrawdown - drawdownTax)
}

function getDemoResponse(question, entity) {
  const q    = question.toLowerCase()
  const fq   = calcFQ(entity)
  const coi  = costOfInaction(entity)
  const days = daysLeft()
  const sipp = entity.assets?.sipp?.total || 0

  if (q.includes('score') || q.includes('sonus') || q.includes('finio') || q.includes('wealth') || q.includes('caelixa') || q.includes('dimension')) {
    return {
      text: `Your Wealth Score of **${fq.total}/100** is in the **${fq.band.name}** band. The three dimensions with the most room to improve are: Estate (the pension deadline is the single biggest lever), Protection (no cover in place), and Tax Efficiency (allowances available). One option to consider: model pension drawdown for this tax year on the Tax & Estate screen to see the live IHT impact before deciding.`,
      followUps: ['What moves my score most?', 'How is my score calculated?', 'What does each dimension mean?'],
      metrics: [
        { label: 'Score',  value: fq.total, format: 'score',    confidence: 'high' },
        { label: 'CoI',    value: coi,       format: 'currency', confidence: 'medium' },
      ],
    }
  }
  if (q.includes('pension') || q.includes('drawdown') || q.includes('sipp')) {
    const drawGross = TAX.brl                              // full basic-rate band figure
    const drawNet   = estimateNetDrawdown(drawGross, entity)
    const ihtPct    = (TAX.ihtRate * 100).toFixed(0)
    return {
      text: `Your pension of **${fmt(sipp)}** will be subject to ${ihtPct}% IHT from April 2027 — **${days} days from now**. Drawing **${fmt(drawGross)}/year** of taxable pension stacks on top of your other income; for your profile that yields approximately **${fmt(drawNet)}/year net** after income tax. One option is to model the three drawdown scenarios on the Tax & Estate screen.`,
      followUps: ['What is the optimal drawdown amount?', 'How much tax will I pay on drawdown?', 'Should I consolidate my pensions first?'],
      metrics: [
        { label: 'Pension pot',         value: sipp,      format: 'currency', confidence: 'high' },
        { label: 'Days to deadline',    value: days,      format: 'days',     confidence: 'high' },
        { label: `Basic rate band`,     value: drawGross, format: 'currency', confidence: 'high' },
        { label: 'Net drawdown (est.)', value: drawNet,   format: 'currency', confidence: 'medium' },
      ],
    }
  }
  if (q.includes('iht') || q.includes('inheritance') || q.includes('estate')) {
    return {
      text: `The cost of inaction is **${fmt(coi)}** — that is the extra IHT your estate pays by not modelling drawdown before April 2027. Your nil-rate band and RNRB are your main shields on the property side. Every month of pension drawdown reduces both the pot and the IHT exposure simultaneously.`,
      followUps: ['How can I reduce my IHT?', 'What is the 7-year gift rule?', 'Should I increase my gifting?'],
      metrics: [
        { label: 'CoI',  value: coi,      format: 'currency', confidence: 'medium' },
        { label: 'NRB',  value: TAX.nrb,  format: 'currency', confidence: 'high' },
        { label: 'RNRB', value: TAX.rnrb, format: 'currency', confidence: 'high' },
      ],
    }
  }
  if (q.includes('risk') || q.includes('resilience') || q.includes('protection')) {
    let risk = null
    // eslint-disable-next-line no-empty
    try { risk = calcRisk(entity) } catch {}
    return {
      text: `${risk ? `Your Risk Score is **${risk.total}/100 · ${risk.band.name}**. ` : ''}Your biggest resilience gaps are: Protection Coverage (no insurance in place means a serious illness or early death leaves the estate exposed) and Dependency Exposure (no LPA registered). Addressing protection has the highest combined impact on both your Wealth Score and Risk Score.`,
      followUps: ['What insurance do I need?', 'What is an LPA and why does it matter?', 'What are shock scenarios?'],
      metrics: risk ? [{ label: 'Risk', value: risk.total, format: 'score', confidence: risk.confidenceLevel || 'medium' }] : [],
    }
  }
  return {
    text: `The pension drawdown decision before April 2027 is the highest-leverage area to model. Your Wealth Score is **${fq.total}/100 · ${fq.band.name}**. The current cost-of-inaction figure is **${fmt(coi)}**. One option is to open the Tax & Estate screen and model your options before committing.`,
    followUps: ['What is my biggest financial risk?', 'How do I improve my Wealth Score?', 'What should I do this tax year?'],
    metrics: [
      { label: 'Score', value: fq.total, format: 'score',    confidence: 'high' },
      { label: 'CoI',   value: coi,       format: 'currency', confidence: 'medium' },
    ],
  }
}

// ─── Markdown-lite renderer ───────────────────────────────────────────────
function renderInlineMarkdown(text) {
  const parts = (text || '').split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>
    if (p.startsWith('*') && p.endsWith('*'))   return <em key={i} style={{ color: 'var(--c-text3)' }}>{p.slice(1, -1)}</em>
    return <span key={i}>{p}</span>
  })
}

// ─── 5. DECISION ENGINE 7-STEP SKELETON (§11) ─────────────────────────────
const DE_STEPS = [
  { id: 1, name: 'Identify', body: 'Detect candidate decisions from your data and current tab context.' },
  { id: 2, name: 'Examine',  body: 'Pull current numbers, deadlines, and constraints.' },
  { id: 3, name: 'Compare',  body: 'Run the three canonical scenarios (status quo · option A · option B).' },
  { id: 4, name: 'Recommend',body: 'Surface the one option with the strongest cost-of-inaction reduction.' },
  { id: 5, name: 'Simulate', body: 'Preview the live impact on Wealth Score, Risk Score, and IHT.' },
  { id: 6, name: 'Commit',   body: 'Lock the decision via the event log.' },
  { id: 7, name: 'Confirm',  body: 'Confirmation screen + downstream notifications.' },
]

function DecisionEnginePanel({ topic, onCommit, onClose }) {
  const [step, setStep] = useState(1)
  useEffect(() => {
    emitAskEvent(EV.ASK_DECISION_ENGINE_INVOKED, { topic })
  }, [topic])

  const current = DE_STEPS.find(s => s.id === step)

  return (
    <div
      className="sw-card sw-card-elevated sw-fade-in-up"
      style={{
        padding: 14, marginBottom: 12,
        background: 'var(--c-surface)',
        borderRadius: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span className="sw-eyebrow" style={{ color: 'var(--c-mint-text, var(--c-acc))' }}>
          Decision Engine
        </span>
        <span style={{ fontSize: 11, color: 'var(--c-text3)' }}>· {topic}</span>
        <button
          onClick={onClose}
          aria-label="Close decision engine"
          className="sw-press"
          style={{
            marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--c-text3)', fontSize: 14,
          }}
        >✕</button>
      </div>

      {/* Step pills — staggered reveal, active step pulse-glows */}
      <RevealStagger
        interval={120}
        style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}
      >
        {DE_STEPS.map(s => {
          const isActive = s.id === step
          const isPast   = s.id < step
          return (
            <div
              key={s.id}
              className={isActive ? 'sw-pulse-glow' : ''}
              style={{
                padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700,
                background: isActive ? 'var(--c-acc)'
                          : isPast   ? 'var(--c-tint-mint)'
                                     : 'var(--c-surface2)',
                color: isActive ? '#000'
                     : isPast   ? 'var(--c-mint-text, var(--c-acc2))'
                                : 'var(--c-text3)',
                border: '1px solid var(--c-sep)',
              }}
            >
              {s.id}. {s.name}
            </div>
          )
        })}
      </RevealStagger>

      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)', marginBottom: 4 }}>
        Step {current.id}: {current.name}
      </div>
      <div style={{ fontSize: 13, color: 'var(--c-text2)', lineHeight: 1.5, marginBottom: 12 }}>
        {current.body}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => setStep(s => Math.max(1, s - 1))}
          disabled={step === 1}
          className="sw-press"
          style={{
            padding: '8px 14px', borderRadius: 100,
            background: 'var(--c-surface2)', border: '1px solid var(--c-sep)',
            color: 'var(--c-text2)', fontSize: 13, fontWeight: 600,
            cursor: step === 1 ? 'default' : 'pointer', opacity: step === 1 ? 0.5 : 1,
          }}>
          Back
        </button>
        {step < 6 && (
          <button
            onClick={() => setStep(s => s + 1)}
            className="sw-press sw-tap-ripple"
            style={{
              padding: '8px 14px', borderRadius: 100,
              background: 'var(--c-acc)', border: 'none',
              color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>
            Next →
          </button>
        )}
        {step === 6 && (
          <button
            onClick={() => {
              emitAskEvent(EV.DECISION_COMMITTED, { topic, via: 'decision_engine' })
              onCommit?.({ topic })
              setStep(7)
            }}
            className="sw-press sw-tap-ripple"
            style={{
              padding: '8px 14px', borderRadius: 100,
              background: 'var(--c-acc2)', border: 'none',
              color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>
            Commit
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Provenance — renders FIRST in bubble per spec §Q3A response anatomy ──
// (Fixes F-ASK-NAR-01 — previously delayed 200ms and rendered AFTER bubble.)
function FirstProvenance({ sources }) {
  return (
    <div className="sw-fade-in">
      <ProvenanceChip sources={sources} />
    </div>
  )
}

// ─── Bubble — assistant + provenance + action chips ───────────────────────
function Bubble({ msg, onAction, isFirstAssistant, typedText, isLast }) {
  const isUser = msg.role === 'user'

  // For the very first assistant message we type its content out in the parent.
  const content = isFirstAssistant && typeof typedText === 'string'
    ? typedText
    : msg.content

  // Off-topic redirect — subtle amber/coral warning tint
  const isOffTopicMsg = !isUser && /^I can only help with your financial position/.test(msg.content || '')

  return (
    <div
      className="sw-fade-in-up"
      style={{
        display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 12,
      }}
    >
      <div style={{
        maxWidth: '88%', display: 'flex', flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start', gap: 6,
      }}>
        {/* Source chip FIRST — spec §Q3A response anatomy element #1 */}
        {!isUser && msg.sources?.length > 0 && (
          <FirstProvenance sources={msg.sources} />
        )}

        <div style={{
          padding: '10px 14px',
          background: isUser
            ? 'var(--c-acc2)'
            : isOffTopicMsg
              ? 'var(--c-tint-amber, rgba(255,179,71,0.10))'
              : 'var(--c-surface)',
          border: isUser
            ? 'none'
            : isOffTopicMsg
              ? '1px solid var(--c-tint-amber-2, rgba(255,179,71,0.18))'
              : '1px solid var(--c-sep)',
          borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          fontSize: 14, lineHeight: 1.6,
          color: isUser ? '#fff' : 'var(--c-text)',
          whiteSpace: 'pre-wrap',
          boxShadow: isUser ? '0 2px 8px rgba(0,0,0,0.18)' : 'none',
        }}>
          {renderInlineMarkdown(content)}
          {isFirstAssistant && typedText !== msg.content && (
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block', width: 2, height: '1em',
                background: 'var(--c-text2)', marginLeft: 2,
                verticalAlign: 'text-bottom',
                animation: 'askCaret 1s steps(2) infinite',
              }}
            />
          )}
        </div>

        {/* Metric strip — animated counter for each value */}
        {!isUser && msg.metrics?.length > 0 && (
          <div className="sw-fade-in" style={{
            display: 'flex', flexWrap: 'wrap', gap: 10,
            padding: '8px 12px',
            background: 'var(--c-surface2)',
            border: '1px solid var(--c-sep)',
            borderRadius: 12, marginTop: 4,
          }}>
            {msg.metrics.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="sw-eyebrow">{m.label}</span>
                <Num
                  value={m.value}
                  format={m.format}
                  confidence={m.confidence}
                  animate
                  style={{ fontSize: 13, fontWeight: 700 }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Per-bubble FCA line — only when tax-touching AND not the last bubble
            (footer covers the last one). Fixes F-ASK-DUP-01 dup-displays. */}
        {!isUser && msg.taxTouching && !isLast && (
          <div className="sw-fade-in" style={{
            fontSize: 11, color: 'var(--c-text3)', fontStyle: 'italic',
            padding: '2px 4px', maxWidth: '100%',
          }}>
            {FCA_BOUNDARY}
          </div>
        )}

        {/* Age-gate amber warning — pension/IHT questions at 55+ */}
        {!isUser && msg.ageGateNote && (
          <div className="sw-fade-in" style={{
            fontSize: 12, color: 'var(--c-amber-text, #b45309)',
            background: 'var(--c-tint-amber, rgba(255,179,71,0.10))',
            border: '1px solid var(--c-tint-amber-2, rgba(255,179,71,0.25))',
            borderRadius: 10, padding: '6px 10px', maxWidth: '100%',
            lineHeight: 1.5,
          }}>
            ⚠ {msg.ageGateNote}
          </div>
        )}

        {/* Act preview */}
        {!isUser && msg.intent === 'act' && msg.actPreview && (
          <div className="sw-fade-in" style={{
            border: '1px dashed var(--c-acc)', borderRadius: 12,
            padding: 10, fontSize: 13, color: 'var(--c-text)',
            background: 'var(--c-acc-bg)', marginTop: 4,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Preview</div>
            <div style={{ marginBottom: 8 }}>{msg.actPreview}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => onAction?.('commit', msg)}
                className="sw-press sw-tap-ripple"
                style={{
                  padding: '7px 14px', borderRadius: 100,
                  background: 'var(--c-acc)', border: 'none',
                  color: '#000', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>
                Commit
              </button>
              {/* Route finance-shaped act/model queries to Decision Engine V2 */}
              <button
                onClick={() => onAction?.('decisionEngine', msg)}
                className="sw-press"
                style={{
                  padding: '7px 14px', borderRadius: 100,
                  background: 'none', border: '1px solid var(--c-acc)',
                  color: 'var(--c-acc)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>
                → Decision Engine
              </button>
            </div>
          </div>
        )}

        {/* Action chips */}
        {!isUser && msg.showActionChips && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
            {['Explain more', 'Model this', 'Act →'].map(a => (
              <button
                key={a}
                onClick={() => onAction?.(a.toLowerCase(), msg)}
                className="sw-chip sw-lift sw-press"
                style={{ cursor: 'pointer', fontWeight: 600 }}
              >
                {a}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Typing() {
  return (
    <div className="sw-fade-in" style={{ display: 'flex', gap: 6, padding: '8px 14px', marginBottom: 12 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 8, height: 8, borderRadius: '50%',
          background: 'var(--c-text3)',
          animation: `askBounce 1s ease-in-out infinite ${i * 0.15}s`,
        }} />
      ))}
    </div>
  )
}

// Chip-row for suggested questions. Each chip uses semantic tint.
function Chips({ suggestions, onTap }) {
  const items = decorateChips(suggestions)
  const TINT_CLASS = {
    mint:    'sw-chip-mint',
    blue:    'sw-chip-blue',
    coral:   'sw-chip-coral',
    amber:   'sw-chip-amber',
    violet:  'sw-chip-violet',
    neutral: '',
  }
  return (
    <RevealStagger
      interval={70}
      style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}
    >
      {items.map((s, i) => (
        <button
          key={i}
          onClick={() => onTap(s.text)}
          className={`sw-chip sw-chip-lg sw-lift sw-press ${TINT_CLASS[s.tint] || ''}`}
          style={{ cursor: 'pointer' }}
        >
          {s.text}
        </button>
      ))}
    </RevealStagger>
  )
}

const DIM_LABELS = {
  behaviour: 'Behaviour', capital: 'Capital', tax: 'Tax',
  protection: 'Protection', cashflow: 'Cashflow',
  debt: 'Debt', estate: 'Estate',
}

// ─── Opening message ──────────────────────────────────────────────────────
function getOpeningMessage(entity, currentTab) {
  const fq   = calcFQ(entity)
  const days = daysLeft()
  const coi  = costOfInaction(entity)
  const name = (entity.name || 'there').split(' ')[0]
  const sipp = entity.assets?.sipp?.total || 0

  let urgentLine
  if (coi > 0 && days < 500 && sipp > 0) {
    urgentLine = `\n\nThe most urgent thing in your financial picture: your pension of ${fmt(sipp)} enters your estate for inheritance tax in **${days} days**. The cost of waiting is **${fmt(coi)}**.`
  } else if (entity.isIFA) {
    urgentLine = `\n\nYou have ${entity.clientSummary?.length || 0} clients loaded. Ask me about any of them, or about your practice position.`
  } else {
    urgentLine = `\n\nYour **${fq.band.name}** score means ${
      fq.band.name === 'Exceptional' ? 'you are in excellent financial health — ask me what to protect.' :
      fq.band.name === 'Optimised'   ? 'you are doing well — ask me what the remaining opportunities are.' :
      fq.band.name === 'Established' ? 'your foundations are solid — ask me what moves you to the next level.' :
      fq.band.name === 'Building'    ? 'you are making good progress — ask me what to prioritise.' :
      'there are clear actions that you might consider — ask me where to model first.'
    }`
  }

  return `Hello ${name}. Your Sonuswealth Wealth Score is **${fq.total}/100 · ${fq.band.name}**.${urgentLine}\n\nWhat would you like to explore on your **${currentTab || 'home'}** view?`
}

// ─── Main sheet content ──────────────────────────────────────────────────
export default function Ask({
  entity,
  context,
  onClearContext,
  currentTab = 'home',
  onCommit,
}) {
  // 9. Session memory keyed on tab + 30-min idle
  const sessionKeyRef = useRef({ tab: currentTab, lastActivity: Date.now() })

  const [messages, setMessages] = useState(() => [
    { role: 'assistant', content: getOpeningMessage(entity, currentTab),
      sources: ['From your data'], showActionChips: false },
  ])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [chips, setChips]         = useState(() => chipsForArchetype(entity))
  const [decisionEngine, setDecisionEngine] = useState(null)
  const [copiedChat, setCopiedChat] = useState(false)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)
  const sendRef   = useRef(null)

  // ── Greeting type-out animation ────────────────────────────────────────
  // Types the first assistant message char-by-char on first open. Once typed,
  // chips fan in (handled below by `greetingDone` gate).
  const greetingFull = messages[0]?.content || ''
  const [typedCount, setTypedCount] = useState(0)
  const [greetingDone, setGreetingDone] = useState(false)

  useEffect(() => {
    if (!greetingFull) return
    if (typedCount >= greetingFull.length) {
      setGreetingDone(true)
      return
    }
    const t = setTimeout(() => setTypedCount(c => c + 1), TYPE_CHAR_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typedCount, greetingFull])

  // Open event
  useEffect(() => {
    emitAskEvent(EV.ASK_SESSION_OPENED, { tab: currentTab, archetype: entity?.archetype })
    return () => emitAskEvent(EV.ASK_SESSION_CLOSED, { tab: currentTab })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 9. Tab switch clears session — and re-types greeting
  useEffect(() => {
    if (sessionKeyRef.current.tab !== currentTab) {
      sessionKeyRef.current.tab = currentTab
      sessionKeyRef.current.lastActivity = Date.now()
      setMessages([{
        role: 'assistant', content: getOpeningMessage(entity, currentTab),
        sources: ['From your data'], showActionChips: false,
      }])
      setChips(chipsForArchetype(entity))
      setDecisionEngine(null)
      setTypedCount(0)
      setGreetingDone(false)
    }
  }, [currentTab, entity])

  // 9. 30-min idle clears session
  useEffect(() => {
    const t = setInterval(() => {
      const idle = Date.now() - sessionKeyRef.current.lastActivity
      if (idle > SESSION_TIMEOUT_MS && messages.length > 1) {
        emitAskEvent(EV.ASK_SESSION_CLOSED, { reason: 'idle_timeout' })
        setMessages([{
          role: 'assistant',
          content: 'Session reset after 30 minutes of inactivity. What would you like to explore now?',
          sources: ['From your data'], showActionChips: false,
        }])
        setChips(chipsForArchetype(entity))
        setTypedCount(0)
        setGreetingDone(false)
      }
    }, 60_000)
    return () => clearInterval(t)
  }, [messages.length, entity])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  // Dim-context entry (e.g. SimulatorPanel "Ask AI about [dim]")
  // ── plus ── TappableNumber "Ask Sonu" entry: { question, seed }. The seed
  // is appended as a quoted context block so the model can reason about the
  // specific before/after values the user asked about.
  useEffect(() => {
    if (!context) return
    if (context.dimKey) {
      const label = DIM_LABELS[context.dimKey] || context.dimKey
      const dimQ  = `Explain my ${label} score — what drives it, and what action would improve it most?`
      setMessages(prev => [...prev, { role: 'user', content: dimQ }])
      setTimeout(() => send(dimQ, { fromContext: true }), 50)
      onClearContext?.()
      return
    }
    if (context.question) {
      const seed = context.seed || null
      const seedSuffix = seed
        ? `\n\n(Context: ${[
            seed.label || seed.metric || seed.category,
            seed.current != null ? `current ${seed.formatted || seed.current}` : null,
            seed.proposed != null && seed.proposed !== seed.current ? `proposed ${seed.proposed}` : null,
            seed.line ? `“${seed.line}”` : null,
          ].filter(Boolean).join(' · ')})`
        : ''
      const q = context.question + seedSuffix
      setMessages(prev => [...prev, { role: 'user', content: q }])
      setTimeout(() => send(q, { fromContext: true }), 50)
      onClearContext?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context])

  const handleAction = useCallback((action, msg) => {
    sessionKeyRef.current.lastActivity = Date.now()
    const _send = sendRef.current || send
    if (action === 'explain more') {
      _send('Explain that further with the underlying numbers.')
    } else if (action === 'model this') {
      _send(`Model this scenario: ${msg.content.slice(0, 80)}`)
    } else if (action === 'act →' || action === 'act' || action === 'decisionengine') {
      setDecisionEngine({ topic: msg.intent === 'model' ? 'Model → Act' : (msg.content?.slice(0, 60) || 'Action') })
    } else if (action === 'commit') {
      emitAskEvent(EV.DECISION_COMMITTED, { from: 'sheet_preview' })
      onCommit?.({ via: 'ask_sheet', preview: msg.actPreview })
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Committed. The decision is now in your event log; downstream tabs will reflect it.',
        sources: ['From your data'], showActionChips: false,
      }])
    }
  }, [onCommit])

  async function send(text, opts = {}) {
    const q = (text || input).trim()
    if (!q) return
    sessionKeyRef.current.lastActivity = Date.now()
    setInput('')
    setChips([])
    const intent = classifyIntent(q)
    const userMsg = { role: 'user', content: q }
    setMessages(prev => (opts.fromContext ? prev : [...prev, userMsg]))
    setLoading(true)
    emitAskEvent(EV.ASK_QUERY_SUBMITTED, { intent, currentTab })

    if (isOffTopic(q)) {
      emitAskEvent(EV.ASK_OFFTOPIC_REDIRECT, { q })
      setTimeout(() => {
        setMessages(prev => [...prev, {
          role: 'assistant', content: OFF_TOPIC_REPLY,
          sources: ['General guidance'], showActionChips: false, intent: 'explain',
        }])
        setChips(chipsForArchetype(entity))
        setLoading(false)
      }, 350)
      return
    }

    // Age-gate: pension/IHT questions at 55+ carry extra regulated weight
    let ageGateNote = ''
    const isPensionIHTQ = /pension|drawdown|iht|inheritance|sipp|annuity/i.test(q)
    const userAge = entity?.individual?.age || entity?.age || 0
    if (isPensionIHTQ && userAge >= 55) {
      ageGateNote = `At ${userAge}, pension and estate decisions carry regulated tax implications — always verify with an FCA-authorised financial adviser.`
    }

    try {
      // Demo-fallback is the default when no API key is bundled. This prevents
      // a guaranteed 401 from leaking the absence of a key in network logs.
      if (USE_DEMO_FALLBACK) throw new Error('demo_fallback')
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: buildSystemPrompt(entity, currentTab),
          messages: history,
        }),
      })
      if (!res.ok) throw new Error('api error')
      const data = await res.json()
      const replyRaw = data.content?.find(b => b.type === 'text')?.text || ''
      const filtered = fcaBoundaryCheck(replyRaw)
      const sources  = inferSources(filtered.text)
      const reply = {
        role: 'assistant',
        content: filtered.text,
        sources,
        taxTouching: filtered.taxTouching,
        intent,
        showActionChips: true,
        ageGateNote: ageGateNote || undefined,
        ...(intent === 'act' ? { actPreview: 'Preview will simulate impact on Wealth Score, IHT, and Risk before you commit.' } : {}),
      }
      setMessages(prev => [...prev, reply])
      setChips(['Ask something else', 'Explain this further', 'Model this'])
      if (intent === 'act') setDecisionEngine({ topic: q.slice(0, 60) })
      emitAskEvent(EV.ASK_RESPONSE_DELIVERED, { intent, sources, fcaFlagged: filtered.flagged, taxTouching: filtered.taxTouching })
    } catch {
      const demo = getDemoResponse(q, entity)
      const filtered = fcaBoundaryCheck(demo.text)
      const sources  = inferSources(filtered.text)
      setTimeout(() => {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: filtered.text,
          sources,
          taxTouching: filtered.taxTouching,
          intent,
          metrics: demo.metrics || [],
          showActionChips: true,
          ageGateNote: ageGateNote || undefined,
          ...(intent === 'act' ? { actPreview: 'Preview will simulate impact on Wealth Score, IHT, and Risk before you commit.' } : {}),
        }])
        setChips(demo.followUps)
        if (intent === 'act') setDecisionEngine({ topic: q.slice(0, 60) })
        setLoading(false)
        emitAskEvent(EV.ASK_RESPONSE_DELIVERED, { intent, sources, fcaFlagged: filtered.flagged, taxTouching: filtered.taxTouching, demo: true })
      }, 800)
      return
    }
    setLoading(false)
  }

  // Keep sendRef current so memoized callbacks always call the latest send
  sendRef.current = send

  const canSend = !loading && input.trim().length > 0
  const typedSlice = greetingFull.slice(0, typedCount)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Eyebrow header strip — design-token hierarchy */}
      <div
        className="sw-fade-in"
        style={{
          padding: '10px 16px 6px',
          display: 'flex', alignItems: 'center', gap: 8,
          flexShrink: 0,
        }}
      >
        <span className="sw-eyebrow" style={{ color: 'var(--c-mint-text, var(--c-acc))' }}>
          Ask Sonu
        </span>
        <span style={{ fontSize: 10, color: 'var(--c-text3)' }}>
          · Rules UK-2026.1 · {currentTab} view
        </span>
        {messages.length > 1 && (
          <button
            type="button"
            onClick={() => {
              const text = messages
                .map(m => (m.role === 'user' ? `You: ${m.content}` : `Sonu: ${m.content}`))
                .join('\n\n')
              navigator.clipboard.writeText(text).then(() => {
                setCopiedChat(true)
                setTimeout(() => setCopiedChat(false), 1500)
              }).catch(() => {})
            }}
            title="Copy conversation to clipboard"
            style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              cursor: 'pointer', fontSize: 11, fontWeight: 600,
              color: copiedChat ? 'var(--c-mint-text, var(--c-acc))' : 'var(--c-text3)',
              padding: '2px 6px', borderRadius: 6,
              transition: 'color 200ms',
            }}
          >
            {copiedChat ? 'Copied!' : '⎘ Copy chat'}
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 16px 12px' }}>
        {messages.map((m, i) => (
          <Bubble
            key={i}
            msg={m}
            onAction={handleAction}
            isFirstAssistant={i === 0}
            isLast={i === messages.length - 1}
            typedText={i === 0 ? typedSlice : undefined}
          />
        ))}

        {loading && <Typing />}

        {decisionEngine && (
          <DecisionEnginePanel
            topic={decisionEngine.topic}
            onCommit={onCommit}
            onClose={() => setDecisionEngine(null)}
          />
        )}

        {/* Persona chips — fan in only after greeting types out */}
        {!loading && !decisionEngine && greetingDone && chips.length > 0 && (
          <Chips suggestions={chips} onTap={t => { setInput(''); send(t) }} />
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area + FCA disclaimer */}
      <div style={{
        padding: '10px 16px 16px', background: 'var(--c-bg)',
        borderTop: '1px solid var(--c-sep)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && canSend && send()}
            placeholder={`Ask about your ${currentTab} view…`}
            className="sw-ask-input"
            style={{
              flex: 1, background: 'var(--c-surface)',
              border: '1px solid var(--c-sep)',
              borderRadius: 100, padding: '11px 16px', fontSize: 14,
              color: 'var(--c-text)', outline: 'none',
              transition: 'border-color var(--dur-fast, 200ms), box-shadow var(--dur-fast, 200ms)',
            }}
          />
          <button
            type="button"
            disabled
            title="Voice input — coming soon"
            style={{
              width: 42, height: 42, borderRadius: '50%',
              background: 'var(--c-surface2)',
              color: 'var(--c-text3)',
              border: '1px solid var(--c-sep)', fontSize: 18,
              cursor: 'not-allowed', flexShrink: 0,
              opacity: 0.55,
            }}
          >🎤</button>
          <button
            onClick={() => canSend && send()}
            disabled={!canSend}
            aria-label="Send"
            className={`sw-press ${canSend ? 'sw-tap-ripple' : ''}`}
            style={{
              width: 42, height: 42, borderRadius: '50%',
              background: canSend ? 'var(--c-acc)' : 'var(--c-surface2)',
              color:      canSend ? '#000'         : 'var(--c-text3)',
              border: 'none', fontSize: 18,
              cursor: canSend ? 'pointer' : 'default',
              flexShrink: 0,
              transition: 'background var(--dur-fast, 200ms), color var(--dur-fast, 200ms), transform var(--dur-fast, 200ms)',
              boxShadow: canSend ? '0 4px 12px var(--c-acc-bg)' : 'none',
            }}
          >→</button>
        </div>
        <div className="sw-eyebrow" style={{ textAlign: 'center', marginTop: 8, opacity: 0.8 }}>
          {FCA_BOUNDARY}
        </div>
      </div>

      <style>{`
        @keyframes askBounce {
          0%,100% { transform: translateY(0); opacity: 0.4 }
          50%      { transform: translateY(-4px); opacity: 1 }
        }
        @keyframes askCaret {
          0%, 100% { opacity: 1 }
          50%      { opacity: 0 }
        }
        .sw-ask-input:focus {
          border-color: var(--c-acc, #2DF2C3) !important;
          box-shadow: 0 0 0 3px var(--c-acc-bg) !important;
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes askBounce { 0%,100% { transform: none; opacity: 0.6 } }
          @keyframes askCaret  { 0%,100% { opacity: 1 } }
        }
      `}</style>
    </div>
  )
}
