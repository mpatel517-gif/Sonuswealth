// ─────────────────────────────────────────────────────────────────────────────
// ASK SONU — QUESTION PLANNER
//
// Greedy information-gain approximation:
//   For each unknown fact across the current candidate plays, count how
//   many plays would have their fit-multiplier resolved by knowing it.
//   Pick the fact that resolves the most candidates.
//
// This is not the formal Shannon-entropy info-gain (we'd need a joint
// belief distribution over plays which is heavyweight for demo speed) —
// it's the "most-discriminating unknown" heuristic, which is defensible
// and produces sensible question ordering on every test query.
// ─────────────────────────────────────────────────────────────────────────────

import { FACT_QUESTIONS } from './ontology.js'

const num = (v) => {
  if (v == null) return 0
  if (typeof v === 'number') return v
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Determine which facts are unknown for the persona + knownFacts combination,
 * relative to what the candidate plays need.
 *
 * Returns array of { fact, demandedBy: [playIds], question }
 * sorted by demandedBy.length descending.
 */
export function nextQuestion(rankedPlays, persona, knownFacts = {}) {
  if (!rankedPlays.length) return null

  // Take top-N candidates (cap at 8 to keep questions focused on plausible plays)
  const candidates = rankedPlays.slice(0, 8)

  // Count fact demand across candidates
  const demand = {}  // fact → Set of playIds

  for (const { play } of candidates) {
    const needs = play.needs_fact || []
    for (const fact of needs) {
      if (isFactKnown(fact, persona, knownFacts)) continue
      if (!demand[fact]) demand[fact] = new Set()
      demand[fact].add(play.id)
    }
  }

  const ranked = Object.entries(demand)
    .map(([fact, ids]) => ({
      fact,
      demandedBy: Array.from(ids),
      question: FACT_QUESTIONS[fact] || `What's your ${fact.replace(/_/g, ' ')}?`,
    }))
    .sort((a, b) => b.demandedBy.length - a.demandedBy.length)

  return ranked[0] || null
}

/**
 * Same but returns the top-N questions (for showing a "Sonu wants to know" panel).
 */
export function nextQuestions(rankedPlays, persona, knownFacts = {}, n = 2) {
  if (!rankedPlays.length) return []

  const candidates = rankedPlays.slice(0, 8)
  const demand = {}

  for (const { play } of candidates) {
    const needs = play.needs_fact || []
    for (const fact of needs) {
      if (isFactKnown(fact, persona, knownFacts)) continue
      if (!demand[fact]) demand[fact] = new Set()
      demand[fact].add(play.id)
    }
  }

  return Object.entries(demand)
    .map(([fact, ids]) => ({
      fact,
      demandedBy: Array.from(ids),
      question: FACT_QUESTIONS[fact] || `What's your ${fact.replace(/_/g, ' ')}?`,
    }))
    .sort((a, b) => b.demandedBy.length - a.demandedBy.length)
    .slice(0, n)
}

/**
 * Is a given fact already known (either from persona profile or knownFacts answers)?
 */
function isFactKnown(fact, persona, knownFacts) {
  if (knownFacts && knownFacts[fact] != null && knownFacts[fact] !== '') return true

  switch (fact) {
    case 'age':           return persona?.age != null || persona?.dob != null
    case 'marital_status':return persona?.maritalStatus != null || persona?.marital_status != null
    case 'work_status':   return persona?.workStatus != null || persona?.work_status != null
    case 'spouse_pension_capital':
                          return num(persona?.spouse?.pension) > 0
    case 'kids_ages':     return Array.isArray(persona?.dependents) && persona.dependents.length > 0
    case 'health_status': return persona?.health_status != null
    case 'jurisdiction':  return persona?.jurisdiction != null || persona?.country != null
    case 'target_income': return num(persona?.target_income) > 0
    case 'dependents':    return persona?.dependents != null
    default:              return false
  }
}
