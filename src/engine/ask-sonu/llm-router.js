// ─────────────────────────────────────────────────────────────────────────────
// ASK SONU — LLM ROUTER
//
// The thinking layer. Claude Sonnet 4.6, temp=0, JSON-only output.
// Returns one of two outcomes:
//
//   { status: 'ask',    question, options, why_asking }       — needs clarification
//   { status: 'answer', intent, direct_answer, lead_play_id,  — confident enough
//                       supporting_play_ids, challenge_paths,
//                       rationale, advisors, confidence }
//
// Constraints respected:
//   - LLM can only pick play_ids that EXIST in the KG (validated post-call)
//   - All citations come from KG records (not the LLM)
//   - All money math comes from play.compute_impact(persona) (not the LLM)
//   - LLM writes only: direct_answer, rationale (≤ 2 sentences), questions
//   - Same query+persona+temp=0 → same answer
//
// On any failure (API down, invalid JSON, invalid play IDs) the caller falls
// back to the deterministic engine — demo never blanks.
// ─────────────────────────────────────────────────────────────────────────────

import { PLAYS } from './knowledge-graph.js'
import { ADVISORS_BY_CATEGORY } from './play-actions.js'
import { summariseTaxYearState } from './tax-year-state.js'

const API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL   = 'claude-sonnet-4-6'
const TIMEOUT_MS = 15000

const LENSES = [
  'Tax Accountant', 'Pension Specialist', 'Trust Lawyer',
  'IFA (Holistic)', 'Insurance Adviser', 'Investment Adviser',
  'Philanthropy Adviser', 'Later Life Adviser', 'Cross-Border Specialist',
  'Mortgage Adviser', 'Family Law Specialist',
]

// ─────────────────────────────────────────────────────────────────────────────
// Build a compact persona summary for the prompt
// ─────────────────────────────────────────────────────────────────────────────
function summarisePersona(p) {
  if (!p) return 'No persona on file'

  const num = (v) => {
    if (v == null) return 0
    if (typeof v === 'number') return v
    if (Array.isArray(v)) return v.reduce((s, x) => s + num(x?.value ?? x?.currentValue ?? x), 0)
    if (typeof v === 'object') return num(v.value ?? v.currentValue ?? v.total ?? 0)
    const n = parseFloat(v); return Number.isFinite(n) ? n : 0
  }
  const fmt = (n) => '£' + Math.round(n).toLocaleString('en-GB')

  const age = p.age || (p.dob ? (new Date().getFullYear() - (typeof p.dob === 'number' ? p.dob : new Date(p.dob).getFullYear())) : null)
  const pot = num(p.assets?.sipp) + num(p.assets?.pensions) + num(p.assets?.pension)
  const isa = num(p.assets?.isa)
  const gia = num(p.assets?.gia) + num(p.assets?.investments)
  const home = num(p.assets?.property) + num(p.assets?.home)
  const cash = num(p.assets?.cash)
  const marital = p.maritalStatus || p.marital_status || 'unknown'
  const work = p.work_status || p.workStatus || 'unknown'
  const income = num(p.income?.annual) || num(p.income)
  const deps = Array.isArray(p.dependents) ? p.dependents.map(d => d?.age).filter(Number.isFinite) : []

  const lines = []
  if (age)    lines.push(`Age: ${age}`)
  if (marital !== 'unknown') lines.push(`Marital: ${marital}`)
  if (work    !== 'unknown') lines.push(`Work status: ${work}`)
  if (income) lines.push(`Annual income: ${fmt(income)}`)
  if (pot)    lines.push(`Pensions: ${fmt(pot)}`)
  if (isa)    lines.push(`ISAs: ${fmt(isa)}`)
  if (gia)    lines.push(`GIA: ${fmt(gia)}`)
  if (home)   lines.push(`Home: ${fmt(home)}`)
  if (cash)   lines.push(`Cash: ${fmt(cash)}`)
  if (deps.length) lines.push(`Dependents: ${deps.length} (ages ${deps.join(', ')})`)
  if (p.jurisdiction || p.country) lines.push(`Jurisdiction: ${p.jurisdiction || p.country}`)

  return lines.join(' · ')
}

// ─────────────────────────────────────────────────────────────────────────────
// Build the play menu (the LLM picks from THIS list, nothing else)
// ─────────────────────────────────────────────────────────────────────────────
function buildPlayMenu() {
  return PLAYS.map(p => ({
    id: p.id,
    title: p.title,
    one_liner: p.one_liner,
    category: p.category,
    triggers: p.triggers,
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// The prompt — tightly scoped, asks for JSON
// ─────────────────────────────────────────────────────────────────────────────
function buildPrompt(query, persona, knownFacts, taxYearState, lensSummary) {
  const personaSummary = summarisePersona(persona)
  const taxStateSummary = taxYearState ? summariseTaxYearState(taxYearState) : '(not computed)'
  const playMenu = buildPlayMenu()
  const factsKnown = Object.keys(knownFacts || {}).length
    ? Object.entries(knownFacts).filter(([,v]) => v != null && v !== '').map(([k,v]) => `${k}: ${v}`).join(' · ')
    : '(none yet)'

  return `You are Sonu — a UK personal-finance reasoning engine for an FCA-regulated information service (not advice).

THE USER ASKED:
"""
${query}
"""

USER'S STATIC PROFILE (deterministic — facts you can use freely):
${personaSummary}

USER'S CURRENT TAX-YEAR STATE (CRITICAL — use this to decide if allowance-based plays apply):
  · ${taxStateSummary}

CLARIFICATIONS ALREADY GIVEN (from prior follow-ups in this session):
${factsKnown}

═══════════════════════════════════════════════════════════════════
EXPERT SPECIALISTS HAVE ALREADY ANALYSED THIS PERSONA
═══════════════════════════════════════════════════════════════════
These are observations + recommendations from the 11 expert lenses
(${LENSES.join(' · ')}).
The observations are GROUND TRUTH — use them as facts you can cite. The
recommendations are the experts' direct suggestions for THIS persona,
allowance-aware. Treat them with high weight.

${lensSummary || '(no specialists scored above relevance threshold)'}

═══════════════════════════════════════════════════════════════════
YOUR PLAY MENU — the only recommendations you can use as lead/supporting/challenge.
═══════════════════════════════════════════════════════════════════
Each play has a stable id; you MUST return ids from this list verbatim.
You cannot invent plays. If no play title fits the query, use Outcome C (freeform).
${JSON.stringify(playMenu, null, 2)}

═══════════════════════════════════════════════════════════════════
RESPONSE PROTOCOL
═══════════════════════════════════════════════════════════════════

Return STRICT JSON. No prose outside the JSON object. No code fences.

You have TWO possible outcomes. Choose one:

──────────────────────────────────────────────
OUTCOME A — ASK A CLARIFYING QUESTION
──────────────────────────────────────────────
Use this when you genuinely cannot pick a confident lead play without one
critical piece of information. The bar is high — do not ask if you can
already answer with reasonable confidence.

Examples of when to ASK:
- Query mentions "maturing cash" but the purpose of the cash isn't stated.
  Answer changes 180° between "emergency reserve" and "growth capital".
- Query says "should I move abroad" with no hint of destination, work
  status, or family situation.
- Query is vague: "what should I do with my money" with no context.

Schema:
{
  "status": "ask",
  "question": "One direct question (max 18 words)",
  "options": [
    { "label": "Short button label", "value": "snake_case_value" },
    { "label": "...", "value": "..." }
    // 3-5 options. Include "Not sure" as last option if helpful.
  ],
  "why_asking": "One sentence — what changes if I know this. Max 25 words.",
  "fact_key": "snake_case_key_we_will_remember_this_answer_under"
}

──────────────────────────────────────────────
OUTCOME B — ANSWER WITH A KG PLAY (preferred when one matches)
──────────────────────────────────────────────
Use this when one of the plays in the menu above is a TRUE match for the
user's actual question — not just a keyword-adjacent match. The play's
TITLE must be coherent with what the user is asking. If the play title
mentions one thing (e.g. "pension drawdown") and the user is asking
about another (e.g. "fixed deposits"), DO NOT pick that play — use
Outcome C (freeform) instead.

Schema:
{
  "status": "answer",
  "mode": "play",
  "intent": "draw | preserve | restructure | plan",
  "confidence": 0.0-1.0,
  "direct_answer": "ONE sentence — the lead recommendation, in the user's vocabulary. Must align with the chosen play's title. Max 25 words.",
  "intro": "ONE sentence opening with what you know about this user. Max 30 words.",
  "lead_play_id": "must_match_a_play_id_from_menu_above_AND_the_title_must_fit_the_question",
  "supporting_play_ids": ["array", "of", "2-3", "play_ids"],
  "challenge_play_ids": ["array", "of", "2-4", "alternative", "play_ids"],
  "rationale": "Two sentences max. Why THIS play for THIS persona. Reference one specific number from the profile.",
  "advisors_consulted": ["array of 1-3 lens names from the 11"]
}

──────────────────────────────────────────────
OUTCOME C — FREEFORM ANSWER (when no play matches well)
──────────────────────────────────────────────
Use this when the user's question is real and answerable, but the play
menu above doesn't have a play whose title fits. You provide your own
action steps + citations, drawn from accurate UK tax/legal/regulatory
knowledge. The UI will mark this clearly as "general guidance".

CRITICAL: citations must reference REAL UK legislation, HMRC manuals,
or FCA rules (e.g. "ITA 2007 s.35", "IHTA 1984 s.18", "FCA COBS 9").
DO NOT fabricate citations.

Schema:
{
  "status": "answer",
  "mode": "freeform",
  "intent": "draw | preserve | restructure | plan",
  "confidence": 0.0-1.0,
  "direct_answer": "ONE sentence — the actual answer. Max 25 words.",
  "intro": "ONE sentence opening with what you know about this user. Max 30 words.",
  "category": "tax_pension | iht | investment | protection | family | healthcare | lifestyle",
  "action_steps": [
    "First concrete step (≤ 25 words, includes specific numbers where relevant)",
    "Second step",
    "Third step (3-5 steps total)"
  ],
  "citations": ["Real UK legal/regulatory reference 1", "..."],
  "rationale": "Two sentences max. Why THIS path for THIS persona. Reference one specific number from the profile.",
  "advisors_consulted": ["array of 1-3 lens names from the 11"],
  "alternative_paths": [
    { "title": "Short title", "one_liner": "What it is and when you'd pick this", "value_shift": "what you'd be prioritising" },
    "...3 to 4 alternatives total..."
  ]
}

──────────────────────────────────────────────
RULES (non-negotiable)
──────────────────────────────────────────────
1. play_ids in Outcome B MUST come from the menu above AND have a title that fits the user's question.
2. Never fabricate UK tax law, IHT rules, pension rules, or citations. Real references only.
3. Same input → same output. Be deterministic.
4. No promises about returns or specific market outcomes.

STATE-AWARENESS (this is what makes you different from a generic LLM):
5. You can see the user's CURRENT TAX-YEAR STATE above. Use it. Examples:
   - If isa_remaining = 0 → DO NOT recommend ISA top-up this year. Instead say "first thing next April" or pick a different play.
   - If pension_aa.remaining < 1000 → DO NOT recommend pension top-ups. Mention carry-forward only if available.
   - If mpaa_triggered → only £10k annual contribution allowed; warn the user.
   - If pa.tapered → £100k taper is active; recommend bonus-to-pension if not already maxed.
   - If days_to_tax_year_end < 60 → flag urgency for this-year actions.
   - If days_to_sipp_iht > 0 and < 730 → SIPP-IHT deadline is live; preservation plays MORE urgent.
6. Lens observations are expert-grade ground truth. Reference them by category when citing reasoning.
7. If you recommend a play whose action_steps would reference an allowance the user has already used,
   your direct_answer MUST modify the recommendation to reflect what is actually possible (e.g.
   "wait until 6 April" or "use your spouse's unused ISA" or "via GIA + CGT allowance instead").

WHEN TO ASK vs ANSWER:
8. ASK (Outcome A) when:
   - The cash purpose, time horizon, or marital status would change the recommendation 180° and isn't stated or inferrable.
   - The user's question contains "what should I do" with multiple plausible interpretations.
9. CASH queries (fixed deposits, savings, deposits, money market): the cash PURPOSE is usually the discriminating fact.
   Do NOT silently assume "growth" — either ASK or use FREEFORM with all the contingencies stated.
10. For Outcome B, the lead play TITLE must be a direct fit for what the user asked. If the closest play title
    mentions something the user didn't ask about, use FREEFORM (Outcome C) instead.

OUTPUT:
11. Output ONLY the JSON object. Nothing before, nothing after. No code fences.`
}

// ─────────────────────────────────────────────────────────────────────────────
// Validate the LLM response — guards against hallucinated play IDs etc.
// ─────────────────────────────────────────────────────────────────────────────
const VALID_PLAY_IDS = new Set(PLAYS.map(p => p.id))

function validateResponse(parsed) {
  if (!parsed || typeof parsed !== 'object') return { ok: false, reason: 'not an object' }

  if (parsed.status === 'ask') {
    if (typeof parsed.question !== 'string' || parsed.question.length < 5) return { ok: false, reason: 'ask: missing question' }
    if (!Array.isArray(parsed.options) || parsed.options.length < 2) return { ok: false, reason: 'ask: needs ≥2 options' }
    if (typeof parsed.fact_key !== 'string')                          return { ok: false, reason: 'ask: missing fact_key' }
    return { ok: true }
  }

  if (parsed.status === 'answer') {
    if (typeof parsed.direct_answer !== 'string') return { ok: false, reason: 'answer: missing direct_answer' }

    // Default mode if LLM omitted it
    if (!parsed.mode) parsed.mode = parsed.lead_play_id ? 'play' : 'freeform'

    if (parsed.mode === 'play') {
      if (typeof parsed.lead_play_id !== 'string') return { ok: false, reason: 'answer/play: missing lead_play_id' }
      if (!VALID_PLAY_IDS.has(parsed.lead_play_id)) return { ok: false, reason: `answer/play: invalid lead_play_id "${parsed.lead_play_id}"` }
      // Filter supporting/challenge to only valid IDs
      parsed.supporting_play_ids = (parsed.supporting_play_ids || []).filter(id => VALID_PLAY_IDS.has(id) && id !== parsed.lead_play_id)
      parsed.challenge_play_ids  = (parsed.challenge_play_ids  || []).filter(id => VALID_PLAY_IDS.has(id) && id !== parsed.lead_play_id)
    } else if (parsed.mode === 'freeform') {
      if (!Array.isArray(parsed.action_steps) || parsed.action_steps.length < 2) {
        return { ok: false, reason: 'answer/freeform: needs ≥2 action_steps' }
      }
      if (!Array.isArray(parsed.citations) || parsed.citations.length === 0) {
        return { ok: false, reason: 'answer/freeform: needs ≥1 citation' }
      }
      parsed.alternative_paths = Array.isArray(parsed.alternative_paths) ? parsed.alternative_paths.slice(0, 4) : []
    } else {
      return { ok: false, reason: `answer: unknown mode "${parsed.mode}"` }
    }

    if (typeof parsed.confidence !== 'number') parsed.confidence = 0.7
    if (parsed.confidence < 0.5) return { ok: false, reason: `answer: low confidence ${parsed.confidence}` }

    return { ok: true }
  }

  return { ok: false, reason: `unknown status "${parsed.status}"` }
}

// ─────────────────────────────────────────────────────────────────────────────
// Robust JSON extraction — handles fenced output if the LLM disobeys
// ─────────────────────────────────────────────────────────────────────────────
function extractJSON(text) {
  if (!text) return null
  // Strip code fences if present
  const cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```\s*$/g, '').trim()
  // Find the first { and matching last }
  const first = cleaned.indexOf('{')
  const last  = cleaned.lastIndexOf('}')
  if (first === -1 || last === -1 || last <= first) return null
  try {
    return JSON.parse(cleaned.slice(first, last + 1))
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────
export async function routeWithLLM(query, persona, opts = {}, signal = null) {
  const { knownFacts = {}, taxYearState = null, lensSummary = '' } = opts

  const apiKey = typeof import.meta !== 'undefined'
    ? (import.meta.env?.VITE_ANTHROPIC_KEY || import.meta.env?.VITE_ANTHROPIC_API_KEY)
    : null

  if (!apiKey) {
    return { ok: false, reason: 'no_api_key', fallback: true }
  }

  const prompt = buildPrompt(query, persona, knownFacts, taxYearState, lensSummary)

  // Add our own timeout on top of the caller's signal
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  if (signal) signal.addEventListener?.('abort', () => ctrl.abort())

  const t0 = Date.now()
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'x-api-key':                                  apiKey,
        'anthropic-version':                          '2023-06-01',
        'anthropic-dangerous-direct-browser-access':  'true',
        'content-type':                               'application/json',
      },
      body: JSON.stringify({
        model:       MODEL,
        max_tokens:  2000,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText)
      return { ok: false, reason: `http_${res.status}`, error: errText, fallback: true }
    }

    const data = await res.json()
    const raw = data?.content?.[0]?.text || ''
    const parsed = extractJSON(raw)
    if (!parsed) {
      return { ok: false, reason: 'parse_failed', raw: raw.slice(0, 300), fallback: true }
    }

    const valid = validateResponse(parsed)
    if (!valid.ok) {
      return { ok: false, reason: `validation: ${valid.reason}`, parsed, fallback: true }
    }

    return {
      ok: true,
      result: parsed,
      ms: Date.now() - t0,
    }
  } catch (err) {
    return {
      ok: false,
      reason: err.name === 'AbortError' ? 'timeout' : `error: ${err.message}`,
      fallback: true,
    }
  } finally {
    clearTimeout(timer)
  }
}
