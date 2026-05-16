// ─────────────────────────────────────────────────────────────────────────────
// trajectorySeeder — pure helper that synthesises 12-month back-history and
// 12-month forward-projection arrays for any persona that doesn't carry
// `entity.trajectories.{netWorthHistory, scoreHistory, riskHistory}`.
//
// Personas that DO carry trajectories (Mr T, Bruce, Fred&Wilma, Tony, Hermione,
// Willy, Priya post-Phase-2-Batch-A.3) read the stored arrays directly via the
// engine functions. This seeder is the fallback for Anna Finch life-arc
// snapshots and any future personas.
//
// Algorithm
//   - Anchor = current netWorth() / fqTotal / riskTotal
//   - Growth rate by life-stage:
//     · Foundation (1)    → 8% p.a.   high relative growth, low base
//     · Accumulation (2)  → 7% p.a.   peak earning + saving
//     · Consolidation (3) → 6% p.a.
//     · Transition (4)    → 4% p.a.
//     · Decumulation (5)  → 1% p.a.   roughly flat post-drawdown
//     · Preservation (6)  → 0% p.a.
//     · Legacy (7)        → -0.5% p.a. measured glide
//   - Scores trend toward improvement: +1 to +6 over 12 months depending on
//     life stage (younger users improve faster).
//   - Risk trends with score but lags 1 month.
//
// All series include 12 monthly points covering the previous 12 months
// (oldest first). The "today" value at the end equals the entity's current
// netWorth() / calcFQ() / calcRisk() outputs.
// ─────────────────────────────────────────────────────────────────────────────

// Life-stage growth rates (annual). Index by entity.lifeStage (1..7).
const STAGE_GROWTH = {
  1: 0.08,  // Foundation — relative scale
  2: 0.07,  // Accumulation
  3: 0.06,  // Consolidation
  4: 0.04,  // Transition
  5: 0.01,  // Decumulation
  6: 0.00,  // Preservation
  7: -0.005, // Legacy
}

// Score improvement over 12 months by life stage (points).
const STAGE_SCORE_LIFT = {
  1: 6,   // young = visible compounding gains in habits
  2: 5,
  3: 3,
  4: 2,
  5: 1,
  6: 0,
  7: 0,
}

// Risk score lag: how many months it follows the score series by.
const RISK_LAG_MONTHS = 1

function clampScore(n) {
  return Math.max(0, Math.min(100, Math.round(n)))
}

function monthIso(offsetMonths) {
  // offsetMonths: -11 (oldest) ... 0 (current month)
  const d = new Date()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + offsetMonths)
  return d.toISOString().split('T')[0]
}

// Synthesise 12-month series ending at currentValue using compound growth.
// Returns array of { date, value } oldest-first.
function seriesBackwards(currentValue, annualGrowth, points = 12) {
  // Reverse-compound: each prior month value = current / (1 + monthly_growth)^k
  const monthly = Math.pow(1 + annualGrowth, 1 / 12)
  const out = []
  for (let k = points - 1; k >= 0; k--) {
    const months_ago = k
    const v = currentValue / Math.pow(monthly, months_ago)
    out.push({ date: monthIso(-months_ago), value: Math.round(v) })
  }
  return out
}

// Synthesise 12-month score series ending at currentScore with a per-month
// improvement (positive = improving). Returns oldest-first.
function scoreSeriesBackwards(currentScore, totalLift, points = 12) {
  const perStep = totalLift / Math.max(1, points - 1)
  const out = []
  for (let k = points - 1; k >= 0; k--) {
    const months_ago = k
    const v = currentScore - perStep * months_ago
    out.push({ date: monthIso(-months_ago), score: clampScore(v) })
  }
  return out
}

// Synthesise risk score series — follows score but lagged by RISK_LAG_MONTHS.
function riskSeriesBackwards(currentRisk, totalLift, points = 12) {
  const perStep = totalLift / Math.max(1, points - 1)
  const out = []
  for (let k = points - 1; k >= 0; k--) {
    const months_ago = k + RISK_LAG_MONTHS
    const v = currentRisk - perStep * months_ago
    out.push({ date: monthIso(-(k)), score: clampScore(v) })
  }
  return out
}

// Forward projection — same compounding pattern, currentValue is the start.
function seriesForward(currentValue, annualGrowth, points = 12) {
  const monthly = Math.pow(1 + annualGrowth, 1 / 12)
  const out = []
  for (let k = 1; k <= points; k++) {
    const v = currentValue * Math.pow(monthly, k)
    out.push({ date: monthIso(k), value: Math.round(v) })
  }
  return out
}

function scoreSeriesForward(currentScore, totalLift, points = 12) {
  const perStep = totalLift / Math.max(1, points)
  const out = []
  for (let k = 1; k <= points; k++) {
    const v = currentScore + perStep * k
    out.push({ date: monthIso(k), score: clampScore(v) })
  }
  return out
}

/**
 * Seed a 12-month back-history for net worth from an entity.
 * Reads entity.trajectories.netWorthHistory first if present.
 *
 * @param entity persona JSON
 * @param currentNw number — today's net worth (from netWorth(entity))
 * @returns { date, value }[] oldest-first
 */
export function seedNetWorthHistory(entity, currentNw) {
  const stored = entity?.trajectories?.netWorthHistory
  if (Array.isArray(stored) && stored.length >= 6) return stored
  const stage = entity?.lifeStage || 2
  const g = STAGE_GROWTH[stage] ?? 0.05
  return seriesBackwards(currentNw, g, 12)
}

/**
 * Seed a 12-month back-history for FinioScore.
 * Reads entity.trajectories.scoreHistory first if present.
 *
 * @param entity persona JSON
 * @param currentScore number — today's score
 * @returns { date, score }[] oldest-first
 */
export function seedScoreHistory(entity, currentScore) {
  const stored = entity?.trajectories?.scoreHistory
  if (Array.isArray(stored) && stored.length >= 6) return stored
  const stage = entity?.lifeStage || 2
  const lift = STAGE_SCORE_LIFT[stage] ?? 3
  return scoreSeriesBackwards(currentScore, lift, 12)
}

/**
 * Seed a 12-month back-history for Risk Score.
 * Reads entity.trajectories.riskHistory first if present.
 */
export function seedRiskHistory(entity, currentRisk) {
  const stored = entity?.trajectories?.riskHistory
  if (Array.isArray(stored) && stored.length >= 6) return stored
  const stage = entity?.lifeStage || 2
  const lift = STAGE_SCORE_LIFT[stage] ?? 3
  return riskSeriesBackwards(currentRisk, lift, 12)
}

/**
 * Forward NW projection for X28 Forecast mode — 12 months ahead.
 */
export function seedNetWorthForecast(entity, currentNw) {
  const stage = entity?.lifeStage || 2
  const g = STAGE_GROWTH[stage] ?? 0.05
  return seriesForward(currentNw, g, 12)
}

/**
 * Forward FinioScore projection for X28 Forecast mode.
 */
export function seedScoreForecast(entity, currentScore) {
  const stage = entity?.lifeStage || 2
  const lift = STAGE_SCORE_LIFT[stage] ?? 3
  return scoreSeriesForward(currentScore, lift, 12)
}

/**
 * Forward Risk projection.
 */
export function seedRiskForecast(entity, currentRisk) {
  const stage = entity?.lifeStage || 2
  const lift = STAGE_SCORE_LIFT[stage] ?? 3
  return scoreSeriesForward(currentRisk, lift, 12)
}

// Convenience: full back+forward bundle for a given metric.
export function seedFullTrajectory(entity, currentValue, kind = 'nw') {
  if (kind === 'nw') {
    return {
      history: seedNetWorthHistory(entity, currentValue),
      forecast: seedNetWorthForecast(entity, currentValue),
    }
  }
  if (kind === 'score') {
    return {
      history: seedScoreHistory(entity, currentValue),
      forecast: seedScoreForecast(entity, currentValue),
    }
  }
  if (kind === 'risk') {
    return {
      history: seedRiskHistory(entity, currentValue),
      forecast: seedRiskForecast(entity, currentValue),
    }
  }
  return { history: [], forecast: [] }
}
