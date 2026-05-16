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
