// tests/decumulation-solver.mjs — goal-driven decumulation solver contract.
// Deterministic: injected now/iht2027, no RNG. Asserts the founder-locked
// behaviours: 2027 flips the order, re-ranking goals changes the top path,
// schedules are visible, branches exist, coverage is honest.
import {
  extractDecumulationContext, simulatePath, generateCandidatePaths, scorePaths, solveDecumulation,
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

console.log('\n── pension DOUBLE TAX (death ≥75, post-2027) ──')
{
  // Preserving a pension to a post-75 death is WORSE than draining it: the
  // pot suffers IHT *and* beneficiary income tax. (The bug the founder caught.)
  const ctx = extractDecumulationContext(BRUCE, { horizonAge: 88 }) // dies at 88, >75
  const preserve = simulatePath(ctx, ['cash', 'isa', 'gia', 'pension'], { now: NOW, iht2027: IHT2027 }) // pension last → big pot at death
  const drain    = simulatePath(ctx, ['pension', 'gia', 'cash', 'isa'], { now: NOW, iht2027: IHT2027 }) // pension first → small pot at death
  log(preserve.pensionRemainingAtDeath > drain.pensionRemainingAtDeath, `preserve leaves more pension at death (£${Math.round(preserve.pensionRemainingAtDeath/1000)}k vs £${Math.round(drain.pensionRemainingAtDeath/1000)}k)`)
  log(preserve.pensionDeathIncomeTax > 0, `preserved pension triggers beneficiary income tax (£${Math.round(preserve.pensionDeathIncomeTax/1000)}k)`)
  log(preserve.totalDeathTax > drain.totalDeathTax, `preserving pension costs MORE total death tax (£${Math.round(preserve.totalDeathTax/1000)}k vs £${Math.round(drain.totalDeathTax/1000)}k)`)
  log(drain.afterIhtEstate > preserve.afterIhtEstate, `draining the pension leaves heirs MORE after tax (drain £${Math.round(drain.afterIhtEstate/1e6)}m > preserve £${Math.round(preserve.afterIhtEstate/1e6)}m) — fixes the founder-caught bug`)
}
{
  // Death BEFORE 75 → no beneficiary income tax (IHT only).
  const young = extractDecumulationContext({ ...BRUCE, age: 60 }, { horizonAge: 72 })
  const s = simulatePath(young, ['cash', 'isa', 'gia', 'pension'], { now: NOW, iht2027: IHT2027 })
  log(s.pensionDeathIncomeTax === 0, 'death before 75 → no inherited-pension income tax (IHT only)')
}

console.log('\n── lexicographic scoring: the primary goal picks the winner ──')
{
  // Pure mechanism test (persona-independent): two paths that trade off, so the
  // active primary goal genuinely changes which wins. A leaves more estate +
  // less tax; B delivers more lifetime income.
  const sims = [
    { path: { id: 'A' }, sim: { successPct: 100, totalNetDelivered: 200, afterIhtEstate: 500, totalTax: 50, ihtExposure: 10, pensionDeathIncomeTax: 0 } },
    { path: { id: 'B' }, sim: { successPct: 100, totalNetDelivered: 300, afterIhtEstate: 400, totalTax: 80, ihtExposure: 10, pensionDeathIncomeTax: 0 } },
  ]
  const legacy = scorePaths(sims, { goals: [normalizeGoal({ type: 'legacy', priority: 1 })] })
  const spend  = scorePaths(sims, { goals: [normalizeGoal({ type: 'max_lifetime_spend', priority: 1 })] })
  const minTax = scorePaths(sims, { goals: [normalizeGoal({ type: 'min_lifetime_tax', priority: 1 })] })
  log(legacy[0].path.id === 'A', 'legacy primary → A (higher after-IHT estate)')
  log(spend[0].path.id === 'B', 'max-spend primary → B (higher lifetime income)')
  log(minTax[0].path.id === 'A', 'min-lifetime-tax primary → A (lower total tax)')
}
{
  // Persona-level invariant: the #1 path is the optimum of the primary objective.
  const legacyFirst = goalSpec(BRUCE, { goals: [
    { type: 'legacy', priority: 1 },
    { type: 'income_floor', priority: 5, target: { income: 96000 } },
  ] })
  const r = solveDecumulation({ entity: BRUCE, goalSpec: legacyFirst, opts: { now: NOW, iht2027: IHT2027 } })
  log(r.rankedPaths.length === 4, 'four selectable candidate paths run')
  log(r.binding.primaryGoal === 'legacy', 'binding records the primary goal')
  const maxEstate = Math.max(...r.rankedPaths.map(p => p.afterIhtEstate))
  log(r.rankedPaths[0].afterIhtEstate === maxEstate, 'legacy-primary: #1 path maximises after-IHT estate (the contract)')
  // And with the double-tax fix, the legacy winner is NOT the pension-preserving one.
  log(r.rankedPaths[0].method !== 'isa_first', `legacy winner is not preserve-pension (it is ${r.rankedPaths[0].method})`)
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

console.log('\n── methodology transparency (show the working to the user) ──')
{
  const r = solveDecumulation({ entity: BRUCE, goalSpec: goalSpec(BRUCE), opts: { now: NOW, iht2027: IHT2027 } })
  const m = r.methodology
  log(Array.isArray(m.rules) && m.rules.length >= 5, `methodology lists the rules applied (${m.rules.length})`)
  log(m.rules.every(rule => rule.source && rule.status && rule.plainEnglish), 'every rule carries a named source + status + plain-English explanation')
  log(m.rules.some(rule => /Finance Act 2026/.test(rule.source) && /2027/.test(rule.plainEnglish)), 'names the 2027 pension-in-estate rule with its legal source')
  log(m.rules.some(rule => rule.id === 'pension-double-tax' && /64%/.test(rule.plainEnglish)), 'explains the inherited-pension double tax (the bug, now a visible rule)')
  log(m.assumptions.some(a => a.editable && /growth/i.test(a.name)) && m.assumptions.some(a => /beneficiary/i.test(a.name)), 'assumptions surfaced as editable (growth, beneficiary rate, …)')
  log(/illustrative|not a forecast/i.test(m.note), 'FCA framing on the methodology note')
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
