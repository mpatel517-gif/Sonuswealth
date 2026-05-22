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
function buildPrompt(query, persona, knownFacts) {
  const personaSummary = summarisePersona(persona)
  const playMenu = buildPlayMenu()
  const factsKnown = Object.keys(knownFacts || {}).length
    ? Object.entries(knownFacts).filter(([,v]) => v != null && v !== '').map(([k,v]) => `${k}: ${v}`).join(' · ')
    : '(none yet)'

  return `You are Sonu — a UK personal-finance reasoning engine for an FCA-regulated information service (not advice).

THE USER ASKED:
"""
${query}
"""

USER'S PROFILE (deterministic — facts you can use freely):
${personaSummary}

CLARIFICATIONS ALREADY GIVEN (from prior follow-ups in this session):
${factsKnown}

YOUR 11 SPECIALIST LENSES (you can consult these — list which ones inform your answer):
${LENSES.join(' · ')}

YOUR PLAY MENU — the ONLY recommendations you are allowed to use as lead/supporting/challenge.
Each play has a stable id; you MUST return ids from this list verbatim. You cannot invent plays.
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
OUTCOME B — ANSWER WITH A LEAD
──────────────────────────────────────────────
Use this when you have enough to pick a confident lead play.

Schema:
{
  "status": "answer",
  "intent": "draw | preserve | restructure | plan",
  "confidence": 0.0-1.0,
  "direct_answer": "ONE sentence — the lead recommendation in plain English. The user must be able to read this and know if you understood. Echo the question's key intent. Max 25 words.",
  "intro": "ONE sentence opening with what you know about this user (age, key assets, situation). Max 30 words.",
  "lead_play_id": "must_match_a_play_id_from_menu_above",
  "supporting_play_ids": ["array", "of", "2-3", "play_ids"],
  "challenge_play_ids": ["array", "of", "2-4", "alternative", "play_ids"],
  "rationale": "Two sentences max. Why THIS lead for THIS persona. Reference one specific number from the profile.",
  "advisors_consulted": ["array of 1-3 lens names from the 11"],
  "adjacent_to_kg": false  // set true if the user's query is OUTSIDE the play menu and you've picked the closest matches as a best-effort. The UI will warn the user.
}

──────────────────────────────────────────────
RULES (non-negotiable)
──────────────────────────────────────────────
1. play_ids MUST come from the menu above. Invented ids = invalid response.
2. Never fabricate UK tax law, IHT rules, or pension rules. If you don't know, mark adjacent_to_kg: true and pick the closest play.
3. Same input → same output. Be deterministic.
4. No promises about returns or specific market outcomes.
5. Default to ASK if the cash purpose, time horizon, or marital status would meaningfully change the recommendation and you can't infer it.
6. When the query is about CASH (savings, deposits, money market), the purpose of the cash is usually the discriminating fact. ASK before assuming wrapper migration plays apply (those are for investments with gains, not raw cash).
7. Output ONLY the JSON object. Nothing before, nothing after. No code fences.`
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
    if (typeof parsed.lead_play_id  !== 'string') return { ok: false, reason: 'answer: missing lead_play_id' }
    if (!VALID_PLAY_IDS.has(parsed.lead_play_id)) return { ok: false, reason: `answer: invalid lead_play_id "${parsed.lead_play_id}"` }

    // Filter supporting/challenge to only valid IDs (don't reject the whole response for one bad ID)
    parsed.supporting_play_ids = (parsed.supporting_play_ids || []).filter(id => VALID_PLAY_IDS.has(id) && id !== parsed.lead_play_id)
    parsed.challenge_play_ids  = (parsed.challenge_play_ids  || []).filter(id => VALID_PLAY_IDS.has(id) && id !== parsed.lead_play_id)

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
export async function routeWithLLM(query, persona, knownFacts = {}, signal = null) {
  const apiKey = typeof import.meta !== 'undefined'
    ? (import.meta.env?.VITE_ANTHROPIC_KEY || import.meta.env?.VITE_ANTHROPIC_API_KEY)
    : null

  if (!apiKey) {
    return { ok: false, reason: 'no_api_key', fallback: true }
  }

  const prompt = buildPrompt(query, persona, knownFacts)

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
        max_tokens:  1200,
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
