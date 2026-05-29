// ─────────────────────────────────────────────────────────────────────────────
// goal-seek-engine — X24 Mode 3 outcome-back solver
// Architecture Master v1.3 §32.2 + §32.3
//
// `goalSeek(entity, targetMetric, targetValue, targetWindow, constraints?)`
// returns 2–4 ranked solution paths.
//
// Wave 1 scope:
//   · Stub solver — returns illustrative paths so UI primitives (GoalSeekable,
//     DecisionWheel) can render without waiting on full solver work.
//   · Ranking: feasibility descending, ripple-cost ascending.
//   · Per-path plain-English explainer (X25 binding).
//
// Wave 2 will add:
//   · Real constraint solver (single-variable: closed form; multi-variable: iterative)
//   · Per-target metric solvers (cashflow, IHT, drawdown, retire-age, …)
//   · Synchronous up to 800ms; async beyond — Arch Master §32.3
//   · AI ranking layer (G8 — deferred but interface ready)
//
// Note: this engine NEVER recommends specific commercial products (PP-1).
// Paths describe behaviours and allocations, not "buy X".
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} entity
 * @param {string} targetMetric  — canonical metric name (e.g. 'monthlySurplus', 'netWorth', 'retireAge')
 * @param {number} targetValue
 * @param {string} targetWindow  — X28 window id
 * @param {object} constraints   — optional {minLiquidity, maxPensionPot, …}
 * @returns {Promise<GoalSeekPath[]>}  — 2..4 paths ranked best-first
 */
export async function goalSeek(entity, targetMetric, targetValue, targetWindow, constraints = {}) {
  // Wave 1: synchronous stub. Wave 2: real solver, async beyond 800ms.
  const paths = generateStubPaths(entity, targetMetric, targetValue, targetWindow)
  return rank(paths)
}

/**
 * @typedef {object} GoalSeekPath
 * @property {string} id
 * @property {string} name          — short label ("The conservative path")
 * @property {string} explanation   — plain-English X25 narrative
 * @property {object} deltaEntity   — patch to apply on commit (consumed by rippleEffect)
 * @property {object[]} steps       — ordered list of behaviour changes
 * @property {number} feasibility   — 0..1 (1 = trivially achievable)
 * @property {number} rippleCost    — 0..1 (0 = no side-effects, 1 = total upheaval)
 * @property {string[]} alignedWith — Personal Constitution values this aligns with
 * @property {string[]} conflictsWith
 */

function generateStubPaths(entity, target, value, window) {
  // Three illustrative paths so UI surfaces have something to render.
  // Each path is named with a tone (cautious / balanced / bold) so the user
  // can recognise the trade-off at a glance.
  return [
    {
      id: 'p-cautious',
      name: 'The cautious path',
      explanation:
        `Reach ${value.toLocaleString()} ${target} by trimming discretionary outgoings ` +
        `and increasing pension contribution slightly. Lowest ripple, slowest result.`,
      deltaEntity: {},
      steps: [
        { label: 'Reduce discretionary spend by 8%', impact: 'monthly' },
        { label: 'Increase pension contribution by 1%', impact: 'monthly' },
      ],
      feasibility: 0.90,
      rippleCost: 0.15,
      alignedWith: ['liquidity:high', 'risk:low'],
      conflictsWith: [],
    },
    {
      id: 'p-balanced',
      name: 'The balanced path',
      explanation:
        `Reach ${value.toLocaleString()} ${target} via a mix of redirected savings, ` +
        `ISA top-up, and rebalanced GIA. Medium ripple, medium pace.`,
      deltaEntity: {},
      steps: [
        { label: 'Redirect savings surplus to ISA', impact: 'monthly' },
        { label: 'Rebalance GIA toward higher-yield mix', impact: 'one-off' },
        { label: 'Review subscription audit', impact: 'one-off' },
      ],
      feasibility: 0.72,
      rippleCost: 0.35,
      alignedWith: ['liquidity:medium', 'risk:medium'],
      conflictsWith: [],
    },
    {
      id: 'p-bold',
      name: 'The bold path',
      explanation:
        `Reach ${value.toLocaleString()} ${target} by repositioning a larger portion ` +
        `of GIA into growth assets and committing to a fixed monthly transfer. ` +
        `Highest ripple, fastest result. Requires comfort with a temporary dip in liquidity.`,
      deltaEntity: {},
      steps: [
        { label: 'Reposition GIA — growth-leaning rebalance', impact: 'one-off' },
        { label: 'Commit to fixed monthly transfer', impact: 'monthly' },
        { label: 'Defer one large discretionary purchase', impact: 'one-off' },
      ],
      feasibility: 0.55,
      rippleCost: 0.60,
      alignedWith: ['risk:high'],
      conflictsWith: ['liquidity:high'],
    },
  ]
}

// ─── Ranking: feasibility descending, ripple-cost ascending (Arch Master §32.3) ───
function rank(paths) {
  return [...paths].sort((a, b) => {
    const fa = (a.feasibility ?? 0) - (b.feasibility ?? 0)
    if (Math.abs(fa) > 0.05) return -fa // higher feasibility first
    return (a.rippleCost ?? 0) - (b.rippleCost ?? 0) // lower ripple cost first
  })
}

// ─── Sync wrapper for cheap goal-seeks (Arch Master §32.3 — under 800ms) ───
export function goalSeekSync(entity, target, value, window, constraints) {
  return rank(generateStubPaths(entity, target, value, window))
}

// ─────────────────────────────────────────────────────────────────────────────
// §2 — L3-8 real solver primitives (2026-05-29)
//
// Replaces the "canned paths" pattern (Wave 1) with a generic binary-search
// primitive callers can wrap for any monotonic single-variable target. The
// existing stub-path API stays for back-compat; new callers should prefer
// the primitive + a concrete wrapper.
//
// Why binary search over Newton-Raphson:
//   · Most personal-finance metrics (monthly surplus, retirement income,
//     drawdown sustainability) are monotonic in the input variable
//     (contribution rate, discretionary spend, retire age). Binary search
//     converges in log2(range/tolerance) iterations — typically 12-15 for
//     a 0-1 range at 0.0001 tolerance.
//   · No derivative computation. Works with any metric function including
//     ones that wrap Monte Carlo (where Newton-Raphson's derivative is noisy).
//   · Bounded iteration count → predictable < 800ms even on 5000-sim MC inside.
//
// Plan reference: ~/.claude/plans/why-do-you-have-async-balloon.md §L3-8.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generic monotonic single-variable binary-search solver.
 *
 * Finds the smallest value of `parameter` in [min, max] such that
 * `metricFn(parameter)` satisfies the comparison against `target`.
 *
 * @param {(p: number) => number} metricFn - pure function: parameter → metric
 * @param {number} target
 * @param {{
 *   min: number,
 *   max: number,
 *   tolerance?: number,        // converged when |metric - target| < tolerance
 *   maxIterations?: number,    // safety guard (default 40)
 *   direction?: 'gte' | 'lte', // 'gte' = find min param s.t. metric >= target
 * }} opts
 * @returns {{
 *   converged: boolean,
 *   parameter: number,         // best parameter found
 *   metric: number,            // metric at returned parameter
 *   iterations: number,
 *   feasibility: number,       // 1 if converged with margin, 0..1 otherwise
 * }}
 */
export function binarySearchSolver(metricFn, target, opts) {
  const {
    min,
    max,
    tolerance = 1,
    maxIterations = 40,
    direction = 'gte',
  } = opts || {}

  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
    return { converged: false, parameter: NaN, metric: NaN, iterations: 0, feasibility: 0 }
  }

  // Bounds check — if even the most aggressive setting can't hit target, infeasible.
  const metricAtMax = metricFn(max)
  const metricAtMin = metricFn(min)
  if (!Number.isFinite(metricAtMax) || !Number.isFinite(metricAtMin)) {
    return { converged: false, parameter: NaN, metric: NaN, iterations: 0, feasibility: 0 }
  }

  const satisfiesGte = (m) => m >= target
  const satisfiesLte = (m) => m <= target
  const satisfies = direction === 'gte' ? satisfiesGte : satisfiesLte

  // Early-exit: target already satisfied at the smallest/largest parameter.
  // For 'gte', if min already satisfies, that IS the smallest acceptable param.
  // For 'lte', if max already satisfies, that IS the largest acceptable param.
  if (direction === 'gte' && satisfies(metricAtMin)) {
    return { converged: true, parameter: min, metric: metricAtMin, iterations: 0, feasibility: 1.0 }
  }
  if (direction === 'lte' && satisfies(metricAtMax)) {
    return { converged: true, parameter: max, metric: metricAtMax, iterations: 0, feasibility: 1.0 }
  }

  // If the strongest setting still can't satisfy, return that boundary
  // with feasibility = how close we got.
  if (!satisfies(metricAtMax) && direction === 'gte') {
    const margin = Math.max(0, metricAtMax / target)
    return { converged: false, parameter: max, metric: metricAtMax, iterations: 0, feasibility: Math.min(1, margin) }
  }
  if (!satisfies(metricAtMin) && direction === 'lte') {
    return { converged: false, parameter: min, metric: metricAtMin, iterations: 0, feasibility: 0.0 }
  }

  // Standard bisection.
  let lo = min
  let hi = max
  let bestParam = direction === 'gte' ? max : min
  let bestMetric = direction === 'gte' ? metricAtMax : metricAtMin

  let i = 0
  for (; i < maxIterations; i++) {
    const mid = (lo + hi) / 2
    const m = metricFn(mid)
    if (!Number.isFinite(m)) {
      // Metric blew up at this param — narrow toward the known-good side.
      if (direction === 'gte') hi = mid; else lo = mid
      continue
    }
    if (satisfies(m)) {
      bestParam = mid
      bestMetric = m
      // For 'gte' we want the smallest param that satisfies → search lower.
      if (direction === 'gte') hi = mid; else lo = mid
    } else {
      if (direction === 'gte') lo = mid; else hi = mid
    }
    if (Math.abs(m - target) < tolerance) break
  }

  const margin = Math.abs(bestMetric - target)
  const converged = margin < tolerance || i < maxIterations
  // Feasibility decays with iterations used (lazy-solve preferred).
  const feasibility = converged ? Math.max(0.4, 1 - (i / maxIterations) * 0.4) : 0
  return { converged, parameter: bestParam, metric: bestMetric, iterations: i + 1, feasibility }
}

/**
 * Concrete solver: smallest monthly pension contribution that grows the
 * current pot to `targetPot` by `retireAge`, given a real-return assumption.
 *
 * Pure compounding model — no Monte Carlo here (fast path < 1ms). The
 * Probability-of-Success refinement is a separate call via scenarios.js.
 *
 * @param {object} entity - must have { age } and { assets.pensions[] | assets.sipp.total }
 * @param {number} targetPot
 * @param {number} retireAge
 * @param {{ realReturn?: number, maxMonthly?: number }} [opts]
 * @returns {{
 *   monthlyContribution: number,
 *   converged: boolean,
 *   projectedPot: number,
 *   feasibility: number,
 *   yearsToRetire: number,
 *   currentPot: number,
 * }}
 */
export function solveMonthlyContributionForPot(entity, targetPot, retireAge, opts = {}) {
  const { realReturn = 0.04, maxMonthly = 5000 } = opts
  const currentAge = +(entity?.age ?? entity?.individual?.age) || 40
  const yearsToRetire = Math.max(1, retireAge - currentAge)
  const months = yearsToRetire * 12
  const monthlyRate = Math.pow(1 + realReturn, 1 / 12) - 1

  // Current pot — duck-typed across schemas; sum what's there.
  const a = entity?.assets || {}
  let currentPot = 0
  if (Array.isArray(a.sipp?.pensions)) {
    for (const p of a.sipp.pensions) currentPot += +p.value || 0
  } else if (a.sipp?.total != null) {
    currentPot += +a.sipp.total || 0
  }
  if (Array.isArray(a.pensions)) {
    for (const p of a.pensions) currentPot += +(p.cetv ?? p.balance ?? p.value ?? 0) || 0
  }

  // Future value of current pot at retirement.
  const fvCurrent = currentPot * Math.pow(1 + realReturn, yearsToRetire)

  // Metric: FV of a series of monthly contributions C compounded at monthlyRate.
  // FV = C × [((1 + r)^n − 1) / r] + fvCurrent
  const metricFn = (monthly) => {
    if (monthly < 0) return -Infinity
    const annuityFactor = monthlyRate === 0
      ? months
      : (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate
    return fvCurrent + monthly * annuityFactor
  }

  const result = binarySearchSolver(metricFn, targetPot, {
    min: 0,
    max: maxMonthly,
    tolerance: Math.max(100, targetPot * 0.001), // £100 or 0.1% of target, whichever bigger
    maxIterations: 32,
    direction: 'gte',
  })

  return {
    monthlyContribution: Math.round(result.parameter),
    converged: result.converged,
    projectedPot: Math.round(result.metric),
    feasibility: result.feasibility,
    yearsToRetire,
    currentPot: Math.round(currentPot),
  }
}
