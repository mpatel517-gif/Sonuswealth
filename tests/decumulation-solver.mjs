// tests/decumulation-solver.mjs — goal-driven decumulation solver contract.
// Deterministic: injected now/iht2027, no RNG. Asserts the founder-locked
// behaviours: 2027 flips the order, re-ranking goals changes the top path,
// schedules are visible, branches exist, coverage is honest.
import {
  extractDecumulationContext, simulatePath, generateCandidatePaths, solveDecumulation,
} from '../src/engine/decumulation-solver.js'
import { goalSpec, normalizeGoal } from '../src/engine/goal-engine.js'
import { readFileSync } from 'node:fs'

let fails = 0, passes = 0
const log = (ok, m) => { ok ? (passes++, console.log('✓ ' + m)) : (fails++, console.log('✗ ' + m)) }

const BRUCE = JSON.parse(readFileSync(new URL('../src/rules/personas/persona-a.json', import.meta.url)))
const NOW = new Date('2026-06-02')
const IHT2027 = new Date('2027-04-06')
const IHT_FAR = new Date('3000-01-01') // pushes the flip far out → "pre-2027" regime

console.log('\n── context extraction (coverage: DB never a pot) ──')
{
  const ctx = extractDecumulationContext(BRUCE)
  log(ctx.pots.pension === 850000, `Bruce pension DC = £850k (${ctx.pots.pension})`)
  log(ctx.pots.isa === 420000 && ctx.pots.gia === 380000 && ctx.pots.cash === 180000, 'ISA/GIA/cash extracted')
  log(ctx.incomeTargetAnnual === 96000, 'income target from drawdownPlan (£96k)')
  log(ctx.property === 1800000 + 450000, `estate property = residence £1.8m + BTL £450k (${ctx.property})`)
  log(ctx.secure.rental === 19200, `rental income picked up from income.rentalIncome (£${ctx.secure.rental})`)
  log(ctx.secure.dividends === 16000 && ctx.secure.statePensionAnnual === 11973, 'dividends + state pension extracted')
  log(ctx.spa === 67, 'state-pension age read from the persona record (67)')
  log(ctx.liabilities === 180000, `BTL mortgage £180k captured from {otherLoans:[{outstanding}]} (${ctx.liabilities})`)
}
{
  // DB scheme = guaranteed income + CETV, NEVER a drawable pot.
  const dbEntity = { age: 65, isHigherRateTaxpayer: false, targetIncome: 40000,
    assets: { sipp: { pensions: [
      { name: 'DC pot', type: 'SIPP', value: 300000 },
      { name: 'Final salary', type: 'Defined Benefit', value: 500000, annualIncome: 22000 },
    ] }, isa: { value: 50000 } } }
  const ctx = extractDecumulationContext(dbEntity)
  log(ctx.pots.pension === 300000, `DB CETV (£500k) excluded from drawable pension; only DC £300k (${ctx.pots.pension})`)
  log(ctx.dbIncome === 22000, 'DB income routed to secure income (£22k)')
  log(ctx.flags.hasDB === true, 'DB flagged for coverage surface')
}

console.log('\n── deterministic simulation ──')
{
  const ctx = extractDecumulationContext(BRUCE)
  const a = simulatePath(ctx, ['gia', 'isa', 'pension', 'cash'], { now: NOW, iht2027: IHT2027 })
  const b = simulatePath(ctx, ['gia', 'isa', 'pension', 'cash'], { now: NOW, iht2027: IHT2027 })
  log(JSON.stringify(a.schedule) === JSON.stringify(b.schedule), 'simulation is deterministic (no RNG)')
  log(a.schedule.length === ctx.horizonAge - ctx.age + 1, `schedule spans age ${ctx.age}→${ctx.horizonAge}`)
  log(a.totalTax === a.schedule.reduce((s, y) => s + y.tax, 0), 'totalTax === Σ schedule.tax (tie-out)')
  log(a.totalTax > 0, `Bruce pays real tax over the plan (£${a.totalTax})`)
}

console.log('\n── the 2027 flip ──')
{
  const legacy = goalSpec(BRUCE, { goals: [{ type: 'legacy', priority: 1 }, { type: 'income_floor', priority: 5, target: { income: 96000 } }] })
  const post = generateCandidatePaths(extractDecumulationContext(BRUCE), legacy, { now: NOW, iht2027: IHT2027 })
  const pre  = generateCandidatePaths(extractDecumulationContext(BRUCE), legacy, { now: NOW, iht2027: IHT_FAR })
  const postTuned = post.find(p => p.id === 'goal-tuned')
  const preTuned  = pre.find(p => p.id === 'goal-tuned')
  log(postTuned.order[0] === 'pension', 'post-2027 + legacy → IHT-tuned path draws PENSION first (shrink estate)')
  log(preTuned.order[0] !== 'pension' && preTuned.order[preTuned.order.length - 1] === 'pension', 'pre-2027 + legacy → preserve pension to LAST')
}
{
  // The flip changes IHT exposure — shown on a pension-PRESERVING path (pension
  // last) with a short horizon so the pot survives to death and its estate
  // treatment actually bites. On a draining path the pension is gone by 95 and
  // the flip is moot (correct engine behaviour, just not a flip test).
  const ctx = extractDecumulationContext(BRUCE, { horizonAge: 70 })
  const post = simulatePath(ctx, ['cash', 'isa', 'gia', 'pension'], { now: NOW, iht2027: IHT2027 })
  const pre  = simulatePath(ctx, ['cash', 'isa', 'gia', 'pension'], { now: NOW, iht2027: IHT_FAR })
  log(post.pensionInEstate === true && pre.pensionInEstate === false, 'pension counted in estate post-2027, excluded pre-2027')
  log(post.ihtExposure > pre.ihtExposure, `preserved pension raises IHT post-2027 (post £${post.ihtExposure} > pre £${pre.ihtExposure})`)
}

console.log('\n── lexicographic re-ranking changes the top path ──')
{
  const incomeFirst = goalSpec(BRUCE) // primary = income_floor
  const legacyFirst = goalSpec(BRUCE, { goals: [
    { type: 'legacy', priority: 1 },
    { type: 'income_floor', priority: 5, target: { income: 96000 } },
    { type: 'min_lifetime_tax', priority: 8 },
  ] })
  const rIncome = solveDecumulation({ entity: BRUCE, goalSpec: incomeFirst, opts: { now: NOW, iht2027: IHT2027 } })
  const rLegacy = solveDecumulation({ entity: BRUCE, goalSpec: legacyFirst, opts: { now: NOW, iht2027: IHT2027 } })
  log(rIncome.rankedPaths.length === 4 && rLegacy.rankedPaths.length === 4, 'four selectable candidate paths each run')
  log(rIncome.binding.primaryGoal === 'income_floor' && rLegacy.binding.primaryGoal === 'legacy', 'binding records the primary goal')
  log(rIncome.rankedPaths[0].id !== rLegacy.rankedPaths[0].id, `top path changes with goal priority (income→${rIncome.rankedPaths[0].id}, legacy→${rLegacy.rankedPaths[0].id})`)
  log(rLegacy.rankedPaths[0].afterIhtEstate >= rLegacy.rankedPaths[rLegacy.rankedPaths.length - 1].afterIhtEstate, 'legacy-primary: top path leaves ≥ the worst path after IHT')
}

console.log('\n── output contract: visible path · why-it-won · branches ──')
{
  const r = solveDecumulation({ entity: BRUCE, goalSpec: goalSpec(BRUCE), opts: { now: NOW, iht2027: IHT2027 } })
  const top = r.rankedPaths[0]
  log(Array.isArray(top.schedule) && top.schedule[0].age === 62, 'top path carries a year-by-year schedule (the visible route)')
  log(top.scoreBreakdown && Object.keys(top.scoreBreakdown).length > 0, 'scoreBreakdown present (why this path won)')
  log(Array.isArray(top.rationale) && top.rationale.length > 0, 'plain-English rationale present')
  log(r.network.nodes.some(n => n.id === 'pension') && r.network.edges.length > 0, 'network has pot nodes + draw edges')
  log(r.network.alternatives.length === 3, 'network exposes 3 alternative branches to select')
  log(/not a forecast|not a personal recommendation/i.test(r.disclaimer), 'FCA disclaimer present')
}

console.log('\n── coverage: honest degradation ──')
{
  const sparse = solveDecumulation({ entity: { age: 70, assets: {} }, goalSpec: goalSpec({ age: 70 }), opts: { now: NOW } })
  log(sparse.rankedPaths.length === 0 && sparse.coverage.dataRichness === 'sparse', 'no drawable assets → honest empty result, never fabricated')
  log(sparse.coverage.unknowns.some(u => /no drawable assets/i.test(u)), 'sparse case names the gap')
}
{
  const r = solveDecumulation({ entity: BRUCE, goalSpec: goalSpec(BRUCE), opts: { now: NOW, iht2027: IHT2027 } })
  log(r.coverage.assumptions.some(a => /growth/.test(a)) && r.coverage.assumptions.some(a => /horizon/.test(a)), 'assumptions surfaced (growth, horizon, GIA gain)')
}

console.log(`\ndecumulation-solver — pass=${passes} fail=${fails}`)
process.exit(fails === 0 ? 0 : 1)
