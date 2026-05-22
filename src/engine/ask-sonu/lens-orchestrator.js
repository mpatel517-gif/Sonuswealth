// ─────────────────────────────────────────────────────────────────────────────
// ASK SONU — LENS ORCHESTRATOR
//
// Fires all 11 professional lenses against the persona, filters by relevance,
// returns a compact summary of expert-graded observations + recommendations
// for the LLM router prompt.
//
// The lenses are the EXPERTISE LAYER:
//   - tax-accountant.js     — UK tax + ISA allowance tracking + PSA
//   - pension-specialist.js — AA, MPAA, LSA, state pension
//   - trust-lawyer.js       — IHT, RNRB, charity 10% rule, LPA
//   - ifa-holistic.js       — allocation, emergency fund, drift
//   - insurance-adviser.js  — life, CI, IP protection gaps
//   - investment-adviser.js — TER, concentration, cash drag
//   - philanthropy-adviser.js — Gift Aid, DAFs
//   - later-life-adviser.js — care costs, equity release, LPA
//   - cross-border-specialist.js — SRT, FIG, deemed dom
//   - mortgage-adviser.js   — remortgage, LTI, S24
//   - family-law-specialist.js — divorce, cohab, prenups
//
// These lenses ALREADY consume tax-year state internally (e.g. Tax Accountant
// reads contribution_current_tax_year on ISAs). Their outputs are
// allowance-aware by construction.
// ─────────────────────────────────────────────────────────────────────────────

import { LENS_REGISTRY, runLens } from '../../lenses/index.js'

const MIN_RELEVANCE = 0.4

/**
 * Fire all 11 lenses, filter by relevance, return their outputs.
 *
 * @param {object} persona    User entity
 * @param {Date}   [asOfDate]
 * @returns {{
 *   active: Array<{ id, name, score, observations, recommendations, red_flags }>,
 *   summary_for_llm: string,
 * }}
 */
export function consultLenses(persona, asOfDate = new Date()) {
  if (!persona) return { active: [], summary_for_llm: '' }

  const active = []

  for (const lens of LENS_REGISTRY) {
    let rel = { score: 0, reason: '' }
    try {
      rel = lens.is_relevant(persona, asOfDate) || rel
    } catch {
      continue
    }
    if (!rel || rel.score < MIN_RELEVANCE) continue

    let runResult = null
    try {
      runResult = runLens(lens, persona, asOfDate, {})
    } catch {
      continue
    }

    // Truncate observation/recommendation text so the LLM prompt doesn't bloat
    const obs = (runResult.observations || []).slice(0, 4).map(o => ({
      severity: o.severity,
      category: o.category,
      text: trim(o.text, 240),
      citation: o.citation,
    }))
    const recs = (runResult.recommendations || []).slice(0, 3).map(r => ({
      strategy: r.strategy_id || r.id,
      headline: trim(r.headline, 140),
      drill_down: trim(r.drill_down, 240),
      gbp_lifetime: r.impact?.gbp_lifetime || r.impact?.gbp_saved || null,
      citation: r.citation,
    }))
    const flags = (runResult.red_flags || []).slice(0, 2).map(f => ({
      urgency: f.urgency,
      action: trim(f.action, 140),
      deadline: f.deadline,
    }))

    active.push({
      id: lens.id,
      name: lens.name,
      score: rel.score,
      reason: rel.reason,
      observations: obs,
      recommendations: recs,
      red_flags: flags,
    })
  }

  // Sort by relevance (highest first)
  active.sort((a, b) => b.score - a.score)

  return {
    active,
    summary_for_llm: formatForLLM(active),
  }
}

function trim(s, n) {
  if (!s) return ''
  if (s.length <= n) return s
  return s.slice(0, n - 1).trimEnd() + '…'
}

function formatForLLM(active) {
  if (!active.length) return '(no specialists scored above relevance threshold for this persona)'

  const blocks = active.map(lens => {
    const parts = []
    parts.push(`═══ ${lens.name} (relevance ${Math.round(lens.score * 100)}%) ═══`)
    if (lens.reason) parts.push(`  reason: ${lens.reason}`)

    if (lens.observations.length) {
      parts.push('  OBSERVATIONS:')
      lens.observations.forEach(o => {
        parts.push(`    • [${o.severity}] ${o.text}`)
        if (o.citation) parts.push(`      cite: ${o.citation}`)
      })
    }
    if (lens.recommendations.length) {
      parts.push('  RECOMMENDS:')
      lens.recommendations.forEach(r => {
        const gbp = r.gbp_lifetime ? ` (~£${r.gbp_lifetime.toLocaleString()})` : ''
        parts.push(`    → ${r.headline}${gbp}`)
        if (r.drill_down) parts.push(`      ${r.drill_down}`)
        if (r.citation) parts.push(`      cite: ${r.citation}`)
      })
    }
    if (lens.red_flags.length) {
      parts.push('  RED FLAGS:')
      lens.red_flags.forEach(f => {
        parts.push(`    🚩 [${f.urgency}] ${f.action}${f.deadline ? ` — by ${f.deadline}` : ''}`)
      })
    }
    return parts.join('\n')
  })

  return blocks.join('\n\n')
}
