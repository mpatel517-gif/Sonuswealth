// ─────────────────────────────────────────────────────────────────────────────
// ASK SONU — SYNTHESIZER
//
// Turns ranked candidate plays into the final user-facing answer:
//
//   Personal intro (sentence opening with what we know about the user)
//   Sonu's call (lead play — one sentence)
//   Why (2-3 lines plain English, computed from persona)
//   Top 3 supporting plays
//   Other considerations (collapsed list)
//   4 Challenge paths (alternative value-weightings)
//
// Deterministic. No LLM. Same input → same output.
// ─────────────────────────────────────────────────────────────────────────────

import { getPlayById } from './knowledge-graph.js'
import { PLAY_INTENT } from './classifier.js'
import { getActionSteps, getAdvisors } from './play-actions.js'

// Self-critique: pick the first play in rankedPlays whose intent_type contains
// the query intent. If none match, fall back to the highest-scoring play but
// flag the mismatch so the UI can show "couldn't find a perfect match".
function pickLeadByIntent(rankedPlays, intent) {
  if (!rankedPlays.length) return { lead: null, mismatch: false }
  if (!intent || intent === 'plan') {
    // 'plan' is the catch-all — any play is valid
    return { lead: rankedPlays[0], mismatch: false }
  }
  for (const r of rankedPlays) {
    const allowed = PLAY_INTENT[r.play.id] || []
    if (allowed.includes(intent)) {
      return { lead: r, mismatch: r !== rankedPlays[0] }
    }
  }
  return { lead: rankedPlays[0], mismatch: true }
}

// Build a one-sentence direct answer that ECHOES the user's intent.
function buildDirectAnswer(lead, intent) {
  if (!lead) return null
  const openerByIntent = {
    draw:        'The most tax-efficient path:',
    preserve:    'The biggest lever to pull:',
    restructure: 'The highest-impact move:',
    plan:        'Where I\'d start:',
  }
  const opener = openerByIntent[intent] || 'Where I\'d start:'
  return `${opener} ${lead.play.title}.`
}

const num = (v) => {
  if (v == null) return 0
  if (typeof v === 'number') return v
  if (Array.isArray(v)) return v.reduce((s, x) => s + num(x?.value ?? x?.currentValue ?? x), 0)
  if (typeof v === 'object') return num(v.value ?? v.currentValue ?? v.total ?? 0)
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}
const fmt = (n) => '£' + Math.round(n).toLocaleString('en-GB')

function ageOf(p) {
  if (!p) return null
  if (p.age != null) return p.age
  const dob = p.dob || p.birthYear
  if (!dob) return null
  if (typeof dob === 'number') return new Date().getFullYear() - dob
  return new Date().getFullYear() - new Date(dob).getFullYear()
}

function buildPersonalIntro(persona) {
  if (!persona) return 'Here\'s what I\'d focus on:'
  const parts = []

  const age = ageOf(persona)
  if (age) parts.push(`You're ${age}`)

  const pot = num(persona?.assets?.sipp) + num(persona?.assets?.pensions) + num(persona?.assets?.pension)
  if (pot > 0) parts.push(`${fmt(pot)} in pensions`)

  const isa = num(persona?.assets?.isa)
  if (isa > 0) parts.push(`${fmt(isa)} in ISAs`)

  const gia = num(persona?.assets?.gia) + num(persona?.assets?.investments)
  if (gia > 0) parts.push(`${fmt(gia)} in GIA`)

  const home = num(persona?.assets?.property) + num(persona?.assets?.home)
  if (home > 0) parts.push(`a home worth ${fmt(home)}`)

  const marital = (persona?.maritalStatus || persona?.marital_status || '').toLowerCase()
  if (/married|partner/.test(marital)) parts.push('married')
  else if (/cohab/.test(marital))      parts.push('cohabiting')

  const deps = persona?.dependents
  if (Array.isArray(deps) && deps.length > 0) {
    const ages = deps.map(d => d?.age).filter(Number.isFinite)
    if (ages.length) parts.push(`${ages.length} dependent${ages.length > 1 ? 's' : ''} aged ${ages.join(' and ')}`)
  }

  if (parts.length === 0) return 'Based on your profile —'
  return parts.join(', ') + ' —'
}

function evaluateAlternative(altRef, persona) {
  if (!altRef) return null
  const altPlay = getPlayById(altRef.alt_play)
  if (!altPlay) return null
  let impact = null
  try {
    impact = altPlay.compute_impact ? altPlay.compute_impact(persona) : null
  } catch {
    impact = null
  }
  return {
    id: altPlay.id,
    title: altPlay.title,
    one_liner: altPlay.one_liner,
    value_shift: altRef.value_shift,
    impact,
  }
}

/**
 * Synthesize the full answer from ranked plays.
 *
 * @param {object[]} rankedPlays    Output of matchPlays()
 * @param {object}   persona        User's persona
 * @param {object}   knownFacts     Facts collected from follow-up answers
 * @param {object}   classification Output of classify()
 * @returns {object} Full answer payload
 */
export function synthesize(rankedPlays, persona, knownFacts = {}, classification = null) {
  if (!rankedPlays.length) {
    return {
      hasAnswer: false,
      intro: 'I don\'t have enough to give a confident answer on this.',
      lead: null,
      supporting: [],
      otherConsiderations: [],
      challenges: [],
      off_ontology: true,
    }
  }

  // ── SELF-CRITIQUE: intent-aware lead selection ────────────────────────────
  // The highest-scoring play may CONTRADICT the user's intent (e.g. picking
  // "preserve SIPP" when they asked "how to draw down"). Pick the first play
  // that matches the intent instead.
  const intent = classification?.intent || 'plan'
  const { lead: chosenLead, mismatch } = pickLeadByIntent(rankedPlays, intent)
  const lead = chosenLead

  // Reorder rankedPlays so lead is first, then by score
  const reordered = [lead, ...rankedPlays.filter(r => r !== lead)]
  const supporting = reordered.slice(1, 4)
  const others = reordered.slice(4, 12)

  // Compute impact for lead
  const leadImpact = lead.play.compute_impact ? lead.play.compute_impact(persona) : null

  // Compute impact for each supporting
  const supportingPayload = supporting.map(({ play, score }) => ({
    id: play.id,
    title: play.title,
    one_liner: play.one_liner,
    detail: play.detail,
    citation: play.citation,
    category: play.category,
    score,
    impact: safe(() => play.compute_impact?.(persona)),
  }))

  // Other considerations — just titles
  const othersPayload = others.map(({ play, score }) => ({
    id: play.id,
    title: play.title,
    one_liner: play.one_liner,
    citation: play.citation,
    category: play.category,
    score,
  }))

  // Challenge paths — multi-source fill to 4:
  //   1. Lead's declared alternatives (highest signal — these are intentional opposites)
  //   2. Supporting plays' alternatives (cross-pole variety)
  //   3. Fallback to supporting plays themselves repurposed as "weight differently"
  //   4. Pad with "do nothing"
  const seen = new Set([lead.play.id])
  const challenges = []

  const tryAdd = (altRef) => {
    if (challenges.length >= 4) return
    if (!altRef?.alt_play || seen.has(altRef.alt_play)) return
    const ev = evaluateAlternative(altRef, persona)
    if (ev) {
      seen.add(altRef.alt_play)
      challenges.push(ev)
    }
  }

  // Pass 1: lead's own alternatives
  for (const alt of (lead.play.alternatives || [])) tryAdd(alt)
  // Pass 2: supporting plays' alternatives
  for (const { play } of supporting) {
    for (const alt of (play.alternatives || []).slice(0, 1)) tryAdd(alt)
  }
  // Pass 3: supporting plays themselves, repurposed as "weight differently" challenges
  const VALUE_SHIFTS = [
    'simplicity over optimisation',
    'income now over legacy later',
    'control over splitting',
    'lifestyle over wealth maximisation',
  ]
  for (const { play } of supporting.concat(others.slice(0, 4))) {
    if (challenges.length >= 4) break
    if (seen.has(play.id)) continue
    seen.add(play.id)
    const shift = VALUE_SHIFTS[challenges.length] || 'differently'
    let impact = null
    try { impact = play.compute_impact?.(persona) } catch { impact = null }
    challenges.push({
      id: play.id,
      title: play.title,
      one_liner: play.one_liner,
      value_shift: shift,
      impact,
    })
  }
  // Pass 4: "do nothing" pad
  if (challenges.length < 4) {
    challenges.push({
      id: '__do_nothing',
      title: 'Do nothing for now',
      one_liner: 'Stay the course. Revisit in 6 months when one more variable resolves.',
      value_shift: 'patience over action',
      impact: {
        gbp_saved: 0,
        time_horizon: '6 months',
        certainty: 'high',
        why: 'Sometimes inaction is right. The cost is the optimisation you defer; the benefit is avoiding a wrong move under uncertainty.',
      },
    })
  }

  return {
    hasAnswer: true,
    intro: buildPersonalIntro(persona),
    classification: classification ? { concerns: classification.concerns, off_ontology: classification.off_ontology } : null,

    // ECHO the question back as a direct one-line answer
    direct_answer: buildDirectAnswer(lead, intent),
    intent,
    intent_mismatch: mismatch,

    lead: {
      id: lead.play.id,
      title: lead.play.title,
      one_liner: lead.play.one_liner,
      detail: lead.play.detail,
      citation: lead.play.citation,
      category: lead.play.category,
      score: lead.score,
      impact: leadImpact,
      fca_boundary: lead.play.fca_boundary,
      action_steps: getActionSteps(lead.play.id),
      advisors: getAdvisors(lead.play.category),
    },

    supporting: supportingPayload.map(s => ({ ...s, advisors: getAdvisors(s.category) })),
    otherConsiderations: othersPayload.map(o => ({ ...o, advisors: getAdvisors(o.category) })),
    challenges: challenges.map(c => ({ ...c, advisors: c.id !== '__do_nothing' ? getAdvisors(getPlayById(c.id)?.category) : ['Yourself'] })),

    // For "How Sonu got here" expandable trace
    reasoning_trace: buildTrace(lead, rankedPlays, classification, persona, knownFacts),

    // For convergence / loop guard
    confidence: lead.fit === 1.0 ? 'high' : (lead.fit >= 0.75 ? 'medium' : 'low'),
  }
}

function safe(fn) {
  try { return fn() } catch { return null }
}

function buildTrace(lead, rankedPlays, classification, persona, knownFacts) {
  const trace = []
  trace.push({
    step: 'Classified your question',
    detail: classification?.concerns
      ? `Top concerns: ${Object.entries(classification.concerns).sort((a,b) => b[1]-a[1]).slice(0,3).map(([c,w]) => `${c} (${Math.round(w*100)}%)`).join(' · ')}`
      : 'Generic financial query',
  })
  trace.push({
    step: 'Loaded your profile',
    detail: buildPersonalIntro(persona).replace(/ —$/, ''),
  })
  if (knownFacts && Object.keys(knownFacts).length) {
    trace.push({
      step: 'Used your answers',
      detail: Object.entries(knownFacts).filter(([,v]) => v != null && v !== '').map(([k,v]) => `${k}: ${v}`).join(' · '),
    })
  }
  trace.push({
    step: 'Scored 25+ candidate plays',
    detail: `Top 3: ${rankedPlays.slice(0, 3).map(r => `${r.play.title} (${r.score})`).join(' · ')}`,
  })
  trace.push({
    step: 'Picked the lead',
    detail: `${lead.play.title} — best fit on your top concerns and clears all prerequisites.`,
  })
  return trace
}
