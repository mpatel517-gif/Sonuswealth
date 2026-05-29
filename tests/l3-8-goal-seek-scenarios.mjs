// tests/l3-8-goal-seek-scenarios.mjs
//
// L3-8 contract test: prove goal-seek and scenarios run REAL algorithms,
// not canned outputs. Founder's repeated flag: "calcs may not be dynamic
// for new users." Closes plan gaps #24 (goal-seek has no algorithm) and
// #25 (scenarios canned, not simulated).
//
// Two engines under test:
//   · goal-seek-engine.binarySearchSolver  (primitive)
//   · goal-seek-engine.solveMonthlyContributionForPot  (concrete wrapper)
//   · scenarios.monteCarloPOS  (already real — this test PROVES it via
//     varying-input → varying-output and percentile shape sanity)
//
// Run via `npm run test:l3-8-goal-seek`.

import {
  binarySearchSolver,
  solveMonthlyContributionForPot,
} from '../src/engine/goal-seek-engine.js'
import { monteCarloPOS } from '../src/engine/scenarios.js'

let fails = 0
let passes = 0
const log = (ok, msg) => {
  if (ok) { passes += 1; console.log(`✓ ${msg}`) }
  else    { fails  += 1; console.log(`✗ ${msg}`) }
}
const round = (n, dp = 0) => Math.round(n * Math.pow(10, dp)) / Math.pow(10, dp)

// ── Case 1 — binarySearchSolver converges on linear metric ─────────────────
console.log('\n── Case 1 — binarySearchSolver converges on linear ──')
{
  // metric(x) = 2x; target = 100; expected param ≈ 50
  const r = binarySearchSolver(x => 2 * x, 100, { min: 0, max: 200, tolerance: 0.01 })
  log(r.converged, `converged=true (got ${r.converged})`)
  log(Math.abs(r.parameter - 50) < 0.05, `parameter≈50 (got ${round(r.parameter, 3)})`)
  log(Math.abs(r.metric - 100) < 0.5, `metric≈100 (got ${round(r.metric, 2)})`)
  log(r.iterations < 25, `converged in <25 iterations (got ${r.iterations})`)
  log(r.feasibility > 0.7, `feasibility > 0.7 (got ${round(r.feasibility, 2)})`)
}

// ── Case 2 — binarySearchSolver handles non-linear (compound interest) ─────
console.log('\n── Case 2 — binarySearchSolver on compound interest ──')
{
  // FV of monthly C over 20y at 4% real = C × [((1+r)^240 − 1)/r]
  // Solve for C such that FV = 100,000
  const monthlyRate = Math.pow(1.04, 1/12) - 1
  const months = 240
  const fv = c => c * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
  const r = binarySearchSolver(fv, 100_000, { min: 0, max: 1000, tolerance: 10 })
  log(r.converged, `converged on compound (got ${r.converged})`)
  // Known closed-form answer: ~272/month
  log(Math.abs(r.parameter - 272) < 5, `monthly contribution ≈ 272 (got ${round(r.parameter)})`)
}

// ── Case 3 — binarySearchSolver returns infeasible cleanly ─────────────────
console.log('\n── Case 3 — infeasible returns feasibility=0 not crash ──')
{
  // metric maxes at 50; target = 100. Strongest setting can't satisfy.
  const r = binarySearchSolver(x => Math.min(50, x), 100, { min: 0, max: 200 })
  log(r.converged === false, `converged=false (got ${r.converged})`)
  log(r.feasibility < 1.0, `feasibility < 1 (got ${round(r.feasibility, 2)})`)
}

// ── Case 4 — solveMonthlyContributionForPot scales with target ─────────────
console.log('\n── Case 4 — solveMonthlyContributionForPot scales with target ──')
{
  const entity = { age: 35, assets: { sipp: { total: 50_000 } } }
  const small  = solveMonthlyContributionForPot(entity, 200_000, 65)
  const big    = solveMonthlyContributionForPot(entity, 800_000, 65)

  log(small.converged, `small target converged`)
  log(big.converged,   `big target converged`)
  log(big.monthlyContribution > small.monthlyContribution * 2,
    `4× pot target → much higher monthly (small=${small.monthlyContribution} big=${big.monthlyContribution})`)
  log(small.yearsToRetire === 30, `yearsToRetire=30 (got ${small.yearsToRetire})`)
  log(small.currentPot === 50000, `currentPot=50000 (got ${small.currentPot})`)
}

// ── Case 5 — solver returns ~0 when current pot already grows past target ──
console.log('\n── Case 5 — already-rich entity needs ~0 contribution ──')
{
  // £500k pot, 30 years at 4% real → ~£1.62M (no contribution needed for £200k target)
  const entity = { age: 35, assets: { sipp: { total: 500_000 } } }
  const r = solveMonthlyContributionForPot(entity, 200_000, 65)
  log(r.converged, `converged`)
  log(r.monthlyContribution < 100, `monthlyContribution < £100/mo (got £${r.monthlyContribution})`)
  log(r.projectedPot >= 200_000, `projectedPot ≥ target (got £${r.projectedPot.toLocaleString()})`)
}

// ── Case 6 — solver handles schema-drift (legacy flat vs nested arrays) ────
console.log('\n── Case 6 — solver schema-agnostic ──')
{
  const flat   = { age: 40, assets: { sipp: { total: 100_000 } } }
  const nested = { age: 40, assets: { pensions: [{ value: 100_000, type: 'SIPP' }] } }
  const rFlat   = solveMonthlyContributionForPot(flat,   500_000, 65)
  const rNested = solveMonthlyContributionForPot(nested, 500_000, 65)
  log(rFlat.currentPot === 100_000,   `flat: currentPot=100000`)
  log(rNested.currentPot === 100_000, `nested: currentPot=100000`)
  log(Math.abs(rFlat.monthlyContribution - rNested.monthlyContribution) <= 1,
    `flat ≡ nested monthly (flat=${rFlat.monthlyContribution} nested=${rNested.monthlyContribution})`)
}

// ── Case 7 — Monte Carlo varies with drawdown (proves not canned) ──────────
console.log('\n── Case 7 — monteCarloPOS varies with drawdown (proof of real sim) ──')
{
  const entity = { age: 65, assets: { sipp: { total: 600_000 } } }
  const cma = { mean: 0.04, stdev: 0.10, startAge: 65 }
  const conservative = monteCarloPOS(entity, 20_000, { simulations: 2000, terminalAge: 90, cmaAssumptions: cma })
  const aggressive   = monteCarloPOS(entity, 50_000, { simulations: 2000, terminalAge: 90, cmaAssumptions: cma })
  log(conservative.probability > aggressive.probability + 10,
    `conservative POS >> aggressive POS (${conservative.probability}% vs ${aggressive.probability}%)`)
  log(conservative.percentilesByAge.length === 26, `26 age-bands returned (66..90 + start)`)
  log(conservative.simulations === 2000, `simulations honoured (2000)`)
  log(conservative.durationMs < 2000, `runs < 2s (${conservative.durationMs}ms)`)
}

// ── Case 8 — Monte Carlo percentile bands monotone in p10 < p50 < p90 ──────
console.log('\n── Case 8 — percentile bands ordered p10 ≤ p50 ≤ p90 ──')
{
  const entity = { age: 65, assets: { sipp: { total: 600_000 } } }
  const out = monteCarloPOS(entity, 25_000, { simulations: 3000, terminalAge: 85 })
  let bandsOk = true
  for (const b of out.percentilesByAge) {
    if (!(b.p10 <= b.p50 && b.p50 <= b.p90)) {
      bandsOk = false
      console.log(`  · band age=${b.age}: p10=${b.p10} p50=${b.p50} p90=${b.p90} OUT-OF-ORDER`)
      break
    }
  }
  log(bandsOk, `all 21 bands ordered correctly`)
}

// ── Case 9 — Monte Carlo with zero drawdown → 100% survival ────────────────
console.log('\n── Case 9 — zero drawdown → POS=100% ──')
{
  const entity = { age: 65, assets: { sipp: { total: 600_000 } } }
  const out = monteCarloPOS(entity, 0, { simulations: 1000, terminalAge: 80 })
  log(out.probability === 100, `POS=100% with zero drawdown (got ${out.probability}%)`)
}

// ── Case 10 — Monte Carlo with massive drawdown → POS << 50% ───────────────
console.log('\n── Case 10 — unsustainable drawdown → POS very low ──')
{
  const entity = { age: 65, assets: { sipp: { total: 100_000 } } }
  const out = monteCarloPOS(entity, 50_000, { simulations: 1000, terminalAge: 90 })
  log(out.probability < 30, `POS < 30% for 50%/yr drawdown on small pot (got ${out.probability}%)`)
}

// ── Summary ───────────────────────────────────────────────────────────────
const total = passes + fails
console.log(`\n${'─'.repeat(67)}`)
console.log(`L3-8 goal-seek + scenarios test — pass=${passes} fail=${fails} total=${total}`)
console.log('═'.repeat(67))
process.exit(fails === 0 ? 0 : 1)
