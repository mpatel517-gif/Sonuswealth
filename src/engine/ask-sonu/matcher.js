// ─────────────────────────────────────────────────────────────────────────────
// ASK SONU — PLAY MATCHER
//
// Given a classification (concerns + weights) + persona facts + known facts,
// score every play in the KG and return ranked candidates.
//
// Scoring:
//   raw_score = Σ over c in matching concerns: play.weight[c] × classification.concerns[c]
//   fit_multiplier = 1.0 if all prerequisites satisfied
//                    0.6 if any prerequisite unknown (we may still be in info-gather)
//                    0.0 if any prerequisite violated OR counter-indication active
//   final = raw_score × fit_multiplier
//
// Returns plays with final > 0, sorted descending.
// ─────────────────────────────────────────────────────────────────────────────

import { getAllPlays } from './knowledge-graph.js'

const num = (v) => {
  if (v == null) return 0
  if (typeof v === 'number') return v
  if (Array.isArray(v)) return v.reduce((s, x) => s + num(x?.value ?? x?.currentValue ?? x), 0)
  if (typeof v === 'object') return num(v.value ?? v.currentValue ?? v.total ?? 0)
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}
const ageOf = (p) => {
  if (!p) return 50
  if (p.age != null) return p.age
  const dob = p.dob || p.birthYear
  if (!dob) return 50
  if (typeof dob === 'number') return new Date().getFullYear() - dob
  return new Date().getFullYear() - new Date(dob).getFullYear()
}
const pensionPotOf = (p) => num(p?.assets?.sipp) + num(p?.assets?.pensions) + num(p?.assets?.pension)
const giaOf        = (p) => num(p?.assets?.gia) + num(p?.assets?.investments)
const estateOf     = (p) => pensionPotOf(p) + num(p?.assets?.isa) + giaOf(p) + num(p?.assets?.property) + num(p?.assets?.home) + num(p?.assets?.cash)
const incomeOf     = (p) => num(p?.income?.annual) || num(p?.income)

function fitMultiplier(play, persona, knownFacts) {
  const age = ageOf(persona)
  const pot = pensionPotOf(persona)
  const gia = giaOf(persona)
  const estate = estateOf(persona)
  const income = incomeOf(persona)
  // knownFacts (which include query-implied facts) ALWAYS override persona —
  // the user has told us their current situation, even if their stored profile
  // is stale. "I'm getting divorced" beats persona.maritalStatus='married'.
  const marital = (knownFacts?.marital_status || persona?.maritalStatus || persona?.marital_status || '').toLowerCase()
  const work    = (knownFacts?.work_status   || persona?.work_status   || persona?.workStatus    || '').toLowerCase()
  const risk    = (knownFacts?.risk_tolerance|| persona?.risk_tolerance|| '').toLowerCase()

  const pre = play.prerequisites || {}
  const con = play.counter_indications || {}

  // Hard counter-indications
  // (min_pension in counter_indications = "don't suggest this if pension too small to matter")
  if (con.min_pension != null && pot < con.min_pension) return 0
  if (Array.isArray(con.work_status) && con.work_status.some(s => work.includes(s))) return 0
  if (Array.isArray(con.marital_status) && con.marital_status.some(s => marital.includes(s))) return 0
  if (Array.isArray(con.risk_tolerance) && risk && con.risk_tolerance.includes(risk)) return 0
  if (con.kids_moving === false && knownFacts?.kids_moving === false) return 0
  if (con.age?.min != null && age >= con.age.min) return 0

  // Hard prerequisites — violations zero the score, unknowns soft-drop
  let unknownCount = 0
  if (pre.min_age != null && age < pre.min_age) return 0
  if (pre.max_age != null && age > pre.max_age) return 0
  if (pre.min_pension != null && pot < pre.min_pension) return 0
  if (pre.min_estate != null && estate < pre.min_estate) return 0
  if (pre.min_gia != null && gia < pre.min_gia) return 0
  if (Array.isArray(pre.marital_status)) {
    if (!marital) unknownCount++
    else if (!pre.marital_status.some(s => marital.includes(s))) return 0
  }
  if (Array.isArray(pre.work_status)) {
    if (!work) unknownCount++
    else if (!pre.work_status.some(s => work.includes(s))) return 0
  }
  if (pre.recent_arrival_uk === true && !persona?.recent_arrival_year && knownFacts?.recent_arrival_uk == null) {
    unknownCount++
  }
  if (pre.relocation_planned === true && !persona?.recent_departure_year && knownFacts?.relocation_destination == null) {
    unknownCount++
  }
  if (pre.kids_moving === true) {
    if (knownFacts?.kids_moving == null) unknownCount++
    else if (knownFacts.kids_moving !== true) return 0
  }
  if (pre.income_band === 'taper_zone') {
    if (!income) unknownCount++
    else if (income < 100000 || income > 125140) return 0
  }

  if (unknownCount === 0) return 1.0
  if (unknownCount === 1) return 0.75
  return 0.55
}

/**
 * Score all plays against the classification + persona + known facts.
 * Returns an array of { play, score, breakdown } sorted descending.
 */
export function matchPlays(classification, persona, knownFacts = {}) {
  const concerns = classification?.concerns || {}
  if (Object.keys(concerns).length === 0) return []

  const results = []
  for (const play of getAllPlays()) {
    // Concern-weighted raw score
    let raw = 0
    const matchedConcerns = []
    for (const triggerConcern of play.triggers) {
      if (concerns[triggerConcern] != null) {
        const playW = play.weight?.[triggerConcern] ?? 0.5
        const queryW = concerns[triggerConcern]
        raw += playW * queryW
        matchedConcerns.push({ concern: triggerConcern, playW, queryW, contrib: playW * queryW })
      }
    }
    if (raw === 0) continue

    const fit = fitMultiplier(play, persona, knownFacts)
    if (fit === 0) continue

    results.push({
      play,
      score: +(raw * fit).toFixed(3),
      raw: +raw.toFixed(3),
      fit,
      matchedConcerns,
    })
  }

  results.sort((a, b) => b.score - a.score)
  return results
}

/**
 * Pick a lead — the highest-scoring play, given convergence rules.
 * Returns null if no clear lead can be picked yet (caller should ask more questions).
 *
 * Lead picked when:
 *   - top play scores ≥ 0.4 AND
 *   - top play fit is 1.0 (all prerequisites known) OR
 *   - top play margin over runner-up ≥ 0.15 (clear winner even with some unknowns)
 */
export function pickLead(rankedPlays) {
  if (!rankedPlays.length) return null
  const top = rankedPlays[0]
  if (top.score < 0.4) return null
  if (top.fit >= 1.0) return top
  const runnerUp = rankedPlays[1]?.score ?? 0
  if (top.score - runnerUp >= 0.15) return top
  return null
}
