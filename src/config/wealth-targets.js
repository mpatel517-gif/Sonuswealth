// ─────────────────────────────────────────────────────────────────────────────
// WEALTH TARGETS — derived target shape per life stage
//
// Answers the question: "what does a healthy Wealth Score polygon look like
// for someone in this life stage?" The radar overlays this target shape so
// the user can SEE the gap between where they are and where they're aiming.
//
// Resolution chain (priority order):
//   1. Persona-specific plan target  → entity.plans → wealth plan target.dims
//   2. Life-stage default target     → LIFE_STAGE_TARGETS below
//   3. Algorithmic fallback          → composeTargetFromScore(75, entity)
//
// Source for layer 2:
//   1-Foundation/AUTHORITY-MAP.md life-stage band system + 3-Engine archetype
//   targets. The numbers below codify the spec's "Resilient" shape per stage:
//   what dim distribution sums to a ~75 Wealth Score (Resilient band) for that
//   life-stage's WEIGHTS. Foundation cluster owns the canonical weights; this
//   file is the projection of those weights into reachable dim targets.
//
// lifeStage codes (per engine `lifeStageFor(age)`):
//   1 = Foundation     (under 25)
//   2 = Accumulation   (25–35)
//   3 = Growth         (35–50)
//   4 = Consolidation  (50–60)
//   5 = Pre-retirement (60–67)
//   6 = Decumulation   (67–80)
//   7 = Legacy         (80+)
// ─────────────────────────────────────────────────────────────────────────────

import { DIMENSIONS } from './dimensions.js'
import { lifeStageFor } from '../engine/fq-calculator.js'

// Target shapes per life stage. Each value is target POINTS for that dim,
// bounded by DIMENSIONS[i].max. The dim ordering follows DIMENSIONS.
//
// Reading the table: at Foundation stage we expect strong Behaviour + Cashflow
// (building habits) but minimal Capital + Estate (no wealth yet). At
// Decumulation we expect strong Capital + Estate (drawdown phase, will/LPA
// done) and relaxed Behaviour (you've already built the habits).
//
// Each row sums to ~75 of the dim total (the "Resilient" band threshold).
const LIFE_STAGE_TARGETS = {
  1: { behaviour: 14, capital:  6, tax:  8, protection:  8, cashflow: 12, debt:  9, estate:  8 },  // Foundation
  2: { behaviour: 16, capital: 10, tax: 12, protection: 10, cashflow: 13, debt: 10, estate: 12 },  // Accumulation
  3: { behaviour: 17, capital: 13, tax: 14, protection: 13, cashflow: 13, debt: 11, estate: 16 },  // Growth
  4: { behaviour: 17, capital: 15, tax: 15, protection: 14, cashflow: 13, debt: 12, estate: 20 },  // Consolidation
  5: { behaviour: 16, capital: 16, tax: 16, protection: 14, cashflow: 14, debt: 12, estate: 23 },  // Pre-retirement
  6: { behaviour: 15, capital: 15, tax: 15, protection: 13, cashflow: 14, debt: 12, estate: 25 },  // Decumulation
  7: { behaviour: 14, capital: 13, tax: 14, protection: 13, cashflow: 13, debt: 11, estate: 26 },  // Legacy
}

// Sanity check: every value ≤ its dim's max
function _validateTargets() {
  for (const [stage, dims] of Object.entries(LIFE_STAGE_TARGETS)) {
    for (const d of DIMENSIONS) {
      const v = dims[d.key]
      if (v == null) {
        console.warn(`[wealth-targets] stage ${stage} missing dim ${d.key}`)
      } else if (v > d.max) {
        console.warn(`[wealth-targets] stage ${stage} ${d.key}=${v} exceeds max ${d.max}`)
      }
    }
  }
}
if (typeof window !== 'undefined' && window.__DEV__) _validateTargets()

/**
 * Resolve the target shape for an entity. Walks the priority chain.
 * Returns a dim map { behaviour, capital, tax, ... } where each value is
 * the target points for that dim (NOT the percent — for percent compute
 * value / DIMENSIONS.find(d => d.key === key).max).
 *
 * @param {object} entity
 * @returns {{ dims: object, source: 'plan' | 'life-stage' | 'algorithmic' }}
 */
export function getWealthTarget(entity) {
  if (!entity) return { dims: LIFE_STAGE_TARGETS[3], source: 'life-stage' }

  // 1 — plan-specific target if it has per-dim shape
  const plans = Array.isArray(entity.plans) ? entity.plans : []
  const wealthPlan = plans.find(p => p?.type === 'wealth' || p?.type === 'wealthScore')
  const planDims = wealthPlan?.target?.dims || wealthPlan?.targetValue?.dims
  if (planDims && typeof planDims === 'object') {
    return { dims: planDims, source: 'plan' }
  }

  // 2 — life-stage default
  const age = entity?.age ?? entity?.person?.age ?? 0
  let stage = entity?.lifeStage
  if (!stage) {
    try { stage = lifeStageFor(age) } catch { stage = 3 }
  }
  const stageDims = LIFE_STAGE_TARGETS[stage] || LIFE_STAGE_TARGETS[3]
  return { dims: stageDims, source: 'life-stage' }
}

/**
 * For a given current FQ dim map, compute which dims have material gaps to
 * the target (frac delta > threshold). Returns dim keys flagged.
 *
 * A "gap" surfaces only when current is at least `threshold` (default 0.15
 * fraction of dim.max) below target. Small gaps are noise; large gaps are
 * actionable.
 *
 * @param {object} currentDims  — { behaviour: 14, capital: 8, ... }
 * @param {object} targetDims   — same shape
 * @param {number} threshold    — minimum frac delta to flag (default 0.15)
 * @returns {string[]} dim keys with material gaps
 */
export function gapDims(currentDims, targetDims, threshold = 0.15) {
  if (!currentDims || !targetDims) return []
  const gaps = []
  for (const d of DIMENSIONS) {
    const cur = currentDims[d.key] ?? 0
    const tgt = targetDims[d.key] ?? 0
    const delta = (tgt - cur) / d.max
    if (delta >= threshold) gaps.push(d.key)
  }
  return gaps
}

/**
 * Per-dim momentum coefficients for the Future view.
 * Each value is the assumed yearly fractional change in a dim's score if the
 * entity continues their current behaviour. Used by RadarAnchor's Future
 * mode to project the polygon forward without touching the engine.
 *
 * Behaviour: stable (habits don't drift much).
 * Capital:   +6%/yr (compounding assumption).
 * Tax:       slow improvement as people use more allowances.
 * Protection: stable (you have it or you don't).
 * Cashflow:  slight upward drift (career progression).
 * Debt:      amortising (-12%/yr by default).
 * Estate:    drifts up slowly (people do their wills eventually).
 */
export const FUTURE_MOMENTUM = {
  behaviour:  0.00,
  capital:    0.06,
  tax:        0.04,
  protection: 0.02,
  cashflow:   0.03,
  debt:      -0.12,
  estate:     0.05,
}

/**
 * Project a current dim map forward by `years`. Bounded by dim.max so growth
 * doesn't run off the chart. Debt dim: lower is worse, so the negative
 * momentum drives the score DOWN (interpretation flipped) — see fq-calculator
 * for debt scoring; we keep it monotonic for the polygon's sake.
 *
 * @param {object} currentDims
 * @param {number} years
 * @returns {object} projected dim map
 */
export function projectDimsForward(currentDims, years = 5) {
  if (!currentDims) return {}
  const out = {}
  for (const d of DIMENSIONS) {
    const cur = currentDims[d.key] ?? 0
    const m   = FUTURE_MOMENTUM[d.key] ?? 0
    // Compound annually: value grows toward (or away from) its max
    let projected = cur
    for (let i = 0; i < years; i++) {
      if (m >= 0) {
        // Closes 1-m of the remaining headroom each year (asymptote toward max)
        projected = projected + (d.max - projected) * (m * 0.5)
      } else {
        // Negative momentum: dim erodes by |m| per year (e.g. debt amortises score down)
        projected = Math.max(0, projected * (1 + m))
      }
    }
    out[d.key] = Math.min(d.max, Math.max(0, projected))
  }
  return out
}
