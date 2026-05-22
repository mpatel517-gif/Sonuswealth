// ─────────────────────────────────────────────────────────────────────────────
// ASK SONU — ORCHESTRATOR
//
// Public API. One function: askSonu(query, persona, opts).
// Returns either:
//   { status: 'NEED_INFO', question, hint, candidates }   — ask the user
//   { status: 'READY',     answer }                       — show the answer
//
// Pure JavaScript. No React, no LLM, no API key. Deterministic.
// ─────────────────────────────────────────────────────────────────────────────

import { classify, topConcerns } from './classifier.js'
import { matchPlays, pickLead }  from './matcher.js'
import { nextQuestion, nextQuestions } from './planner.js'
import { synthesize }            from './synthesizer.js'
import { normaliseFact }         from './ontology.js'

const MAX_QUESTIONS = 3  // hard cap — never ask more than this

/**
 * Single-call API: pass query + persona + (optionally) known facts so far.
 * If the system needs more info to converge, returns NEED_INFO with a question.
 * Once it has enough or hits the cap, returns READY with the synthesized answer.
 *
 * @param {string} query        Free-text user question
 * @param {object} persona      User entity
 * @param {object} opts
 * @param {object} opts.knownFacts      Facts collected from prior follow-up rounds
 * @param {number} opts.questionsAsked  How many questions we've already asked
 * @param {boolean} opts.forceAnswer    Skip questioning, synthesize from what we have
 */
export function askSonu(query, persona, opts = {}) {
  const knownFacts     = opts.knownFacts || {}
  const questionsAsked = opts.questionsAsked || 0
  const forceAnswer    = !!opts.forceAnswer

  // 1. Classify
  const classification = classify(query)

  // 2. Merge implied facts (derived from the query itself) with explicit
  //    knownFacts (from the user's follow-up answers).
  //    Implied facts override the static persona but are themselves
  //    overridden by explicit user answers.
  const effectiveFacts = { ...(classification.implied_facts || {}), ...knownFacts }

  // 3. Match plays
  const ranked = matchPlays(classification, persona, effectiveFacts)

  // 4. Off-ontology fallback — if nothing matched, return the catch-all
  if (!ranked.length && classification.off_ontology) {
    return {
      status: 'READY',
      answer: {
        hasAnswer: false,
        off_ontology: true,
        intro: 'This question doesn\'t fit any of the patterns I\'ve been trained on yet.',
        message: 'I can route it to a regulated adviser, or you can try rephrasing in terms of: retirement, tax, IHT, gifting, relocation, family change, business exit, healthcare, or protection.',
        suggested_rephrases: [
          'How should I withdraw £70k a year from my pension?',
          'How can I reduce my IHT before April 2027?',
          'Should I relocate abroad?',
          'I\'m getting divorced — what should I focus on?',
        ],
      },
      classification,
    }
  }

  // 5. Decide: do we have enough to answer, or do we need to ask?
  const lead = pickLead(ranked)
  const canStillAsk = questionsAsked < MAX_QUESTIONS && !forceAnswer
  const needInfo = !lead && canStillAsk

  if (needInfo) {
    const q = nextQuestion(ranked, persona, effectiveFacts)
    if (q) {
      return {
        status: 'NEED_INFO',
        question: q.question,
        fact_key: q.fact,
        demandedBy: q.demandedBy,
        hint: `Knowing this helps me pick between ${q.demandedBy.length} candidate ${q.demandedBy.length === 1 ? 'play' : 'plays'}.`,
        candidates_so_far: ranked.slice(0, 5).map(r => ({ id: r.play.id, title: r.play.title, score: r.score })),
        progress: { asked: questionsAsked, cap: MAX_QUESTIONS },
        classification,
      }
    }
  }

  // 6. Synthesize answer
  const answer = synthesize(ranked, persona, effectiveFacts, classification)
  return {
    status: 'READY',
    answer,
    classification,
    debug: {
      ranked_count: ranked.length,
      top_scores: ranked.slice(0, 5).map(r => ({ id: r.play.id, score: r.score, fit: r.fit })),
      questions_asked: questionsAsked,
    },
  }
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

export { classify, topConcerns, matchPlays, pickLead, nextQuestion, nextQuestions, synthesize }
