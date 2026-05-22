// ─────────────────────────────────────────────────────────────────────────────
// ASK SONU — ORCHESTRATOR
//
// Public API. One function: askSonu(query, persona, opts).
// Routes through the LLM first (thinking layer); falls back to the
// deterministic engine if the LLM is unreachable / returns invalid JSON
// / picks unknown play IDs.
//
// Returns one of:
//   { status: 'NEED_INFO', question, options, ... }   — ask user
//   { status: 'READY',     answer, ... }              — show synthesized answer
//
// LLM provides: direct_answer, intro, intent, lead/supporting/challenge IDs,
//               advisors_consulted, rationale, ask-or-answer decision
// KG  provides: action_steps, citations, money math (compute_impact), titles
// ─────────────────────────────────────────────────────────────────────────────

import { classify }                from './classifier.js'
import { matchPlays, pickLead }    from './matcher.js'
import { nextQuestion }            from './planner.js'
import { synthesize }              from './synthesizer.js'
import { normaliseFact }           from './ontology.js'
import { routeWithLLM }            from './llm-router.js'
import { getPlayById }             from './knowledge-graph.js'
import { getActionSteps, getAdvisors } from './play-actions.js'

const MAX_QUESTIONS = 3
const fmt = (n) => '£' + Math.round(n).toLocaleString('en-GB')

// ─────────────────────────────────────────────────────────────────────────────
// LLM PATH — preferred. Returns a READY/NEED_INFO payload or null on failure.
// ─────────────────────────────────────────────────────────────────────────────
async function tryLLMPath(query, persona, knownFacts, questionsAsked) {
  const r = await routeWithLLM(query, persona, knownFacts)
  if (!r.ok) {
    return { ok: false, reason: r.reason }
  }
  const out = r.result

  // ─ NEED_INFO branch ─────────────────────────────────────────────────────
  if (out.status === 'ask') {
    return {
      ok: true,
      payload: {
        status: 'NEED_INFO',
        question: out.question,
        fact_key: out.fact_key,
        options: out.options,
        why_asking: out.why_asking,
        progress: { asked: questionsAsked, cap: MAX_QUESTIONS },
        source: 'llm',
        ms: r.ms,
      },
    }
  }

  // ─ READY branch — render via deterministic synthesizer using LLM-chosen IDs ─
  const leadPlay        = getPlayById(out.lead_play_id)
  const supportingPlays = (out.supporting_play_ids || []).map(getPlayById).filter(Boolean)
  const challengePlays  = (out.challenge_play_ids  || []).map(getPlayById).filter(Boolean)

  if (!leadPlay) return { ok: false, reason: 'lead_play_not_found_after_validation' }

  const leadImpact = safe(() => leadPlay.compute_impact?.(persona))

  // Compose the answer payload — LLM-written text + KG facts
  const answer = {
    hasAnswer: true,
    source: 'llm',
    intent: out.intent || 'plan',
    confidence: out.confidence,
    adjacent_to_kg: !!out.adjacent_to_kg,

    intro:         out.intro,
    direct_answer: out.direct_answer,
    rationale:     out.rationale,

    lead: {
      id:           leadPlay.id,
      title:        leadPlay.title,
      one_liner:    leadPlay.one_liner,
      detail:       leadPlay.detail,
      citation:     leadPlay.citation,
      category:     leadPlay.category,
      impact:       leadImpact,
      action_steps: getActionSteps(leadPlay.id),
      advisors:     out.advisors_consulted?.length
                      ? out.advisors_consulted
                      : getAdvisors(leadPlay.category),
      fca_boundary: leadPlay.fca_boundary,
    },

    supporting: supportingPlays.map(p => ({
      id: p.id,
      title: p.title,
      one_liner: p.one_liner,
      category: p.category,
      citation: p.citation,
      impact: safe(() => p.compute_impact?.(persona)),
      advisors: getAdvisors(p.category),
    })),

    challenges: challengePlays.slice(0, 4).map((p, i) => ({
      id: p.id,
      title: p.title,
      one_liner: p.one_liner,
      category: p.category,
      value_shift: VALUE_SHIFTS[i] || 'differently',
      impact: safe(() => p.compute_impact?.(persona)),
      advisors: getAdvisors(p.category),
    })),

    otherConsiderations: [],

    reasoning_trace: [
      { step: 'Read your question', detail: query },
      { step: 'Consulted',          detail: (out.advisors_consulted || []).join(' · ') || 'lenses unspecified' },
      { step: 'Picked the lead',    detail: `${leadPlay.title} — ${out.rationale || 'best fit'}` },
      { step: 'Confidence',         detail: `${Math.round((out.confidence || 0) * 100)}%` },
    ],
  }

  // Pad challenges with "do nothing" if LLM didn't supply enough
  while (answer.challenges.length < 4) {
    answer.challenges.push({
      id: '__do_nothing',
      title: 'Do nothing for now',
      one_liner: 'Stay the course. Revisit in 6 months when one more variable resolves.',
      value_shift: 'patience over action',
      advisors: ['Yourself'],
      impact: { gbp_saved: 0, time_horizon: '6 months', certainty: 'high',
                why: 'Sometimes inaction is right. The cost is the optimisation you defer.' },
    })
  }

  return {
    ok: true,
    payload: { status: 'READY', answer, source: 'llm', ms: r.ms },
  }
}

const VALUE_SHIFTS = [
  'simplicity over optimisation',
  'income now over legacy later',
  'control over splitting',
  'lifestyle over wealth maximisation',
]

function safe(fn) { try { return fn() } catch { return null } }

// ─────────────────────────────────────────────────────────────────────────────
// DETERMINISTIC PATH — fallback when LLM unreachable
// ─────────────────────────────────────────────────────────────────────────────
function deterministicAnswer(query, persona, knownFacts, questionsAsked, forceAnswer) {
  const classification = classify(query)
  const effectiveFacts = { ...(classification.implied_facts || {}), ...knownFacts }
  const ranked = matchPlays(classification, persona, effectiveFacts)

  if (!ranked.length && classification.off_ontology) {
    return {
      status: 'READY',
      source: 'deterministic',
      answer: {
        hasAnswer: false,
        off_ontology: true,
        intro: 'This question doesn\'t fit any of the patterns I\'ve been trained on yet — and the LLM router is also unavailable.',
        message: 'Try rephrasing in terms of: retirement, tax, IHT, gifting, relocation, family change, business exit, healthcare, or protection.',
        suggested_rephrases: [
          'How should I withdraw £70k a year from my pension?',
          'How can I reduce my IHT before April 2027?',
          'Should I relocate abroad?',
        ],
      },
      classification,
    }
  }

  const lead = pickLead(ranked)
  const canStillAsk = questionsAsked < MAX_QUESTIONS && !forceAnswer

  if (!lead && canStillAsk) {
    const q = nextQuestion(ranked, persona, effectiveFacts)
    if (q) {
      return {
        status: 'NEED_INFO',
        source: 'deterministic',
        question: q.question,
        fact_key: q.fact,
        options: null,  // deterministic planner doesn't suggest chips
        progress: { asked: questionsAsked, cap: MAX_QUESTIONS },
      }
    }
  }

  const answer = synthesize(ranked, persona, effectiveFacts, classification)
  answer.source = 'deterministic'
  return { status: 'READY', source: 'deterministic', answer, classification }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — async. LLM first, deterministic fallback.
// ─────────────────────────────────────────────────────────────────────────────
export async function askSonu(query, persona, opts = {}) {
  const knownFacts     = opts.knownFacts || {}
  const questionsAsked = opts.questionsAsked || 0
  const forceAnswer    = !!opts.forceAnswer
  const useLLM         = opts.useLLM !== false  // default on

  if (useLLM) {
    const llm = await tryLLMPath(query, persona, knownFacts, questionsAsked)
    if (llm.ok) {
      return { ...llm.payload, _fallback_used: false }
    }
    // Otherwise fall through to deterministic
    const det = deterministicAnswer(query, persona, knownFacts, questionsAsked, forceAnswer)
    return { ...det, _fallback_used: true, _llm_failure: llm.reason }
  }

  const det = deterministicAnswer(query, persona, knownFacts, questionsAsked, forceAnswer)
  return { ...det, _fallback_used: false, source: 'deterministic' }
}

/**
 * Stateless helper: merge a new follow-up answer into knownFacts.
 */
export function addAnswer(knownFacts, factKey, rawValue) {
  return {
    ...knownFacts,
    [factKey]: normaliseFact(factKey, rawValue),
  }
}

// Re-exports for tests / external use
export { classify, matchPlays, pickLead, nextQuestion, synthesize }
