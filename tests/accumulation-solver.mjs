// tests/accumulation-solver.mjs — accumulation branch (the saver side of the
// one goal engine). Deterministic; verified on Mr T (35, accumulator).
import { extractAccumulationContext, solveAccumulation } from '../src/engine/accumulation-solver.js'
import { goalSpec } from '../src/engine/goal-engine.js'
import { readFileSync } from 'node:fs'

let fails = 0, passes = 0
const log = (ok, m) => { ok ? (passes++, console.log('✓ ' + m)) : (fails++, console.log('✗ ' + m)) }

const MRT = JSON.parse(readFileSync(new URL('../src/rules/personas/mrT-core.json', import.meta.url)))
const NOW = new Date('2026-06-02')

console.log('\n── context extraction (Mr T, accumulator) ──')
{
  const ctx = extractAccumulationContext(MRT)
  log(ctx.age === 35, `age 35 (${ctx.age})`)
  log(ctx.investable > 0, `investable assets found (£${Math.round(ctx.investable/1000)}k)`)
  log(ctx.monthlyContribution > 0, `current monthly saving picked up (£${ctx.monthlyContribution}/mo)`)
}

console.log('\n── solveAccumulation on Mr T ──')
{
  const spec = goalSpec(MRT) // primary = retire_by
  const r = solveAccumulation({ entity: MRT, goalSpec: spec, opts: { now: NOW } })
  log(r.branch === 'accumulation', 'branch = accumulation')
  log(r.binding.primaryGoal === 'retire_by', 'primary goal = retire_by')
  const ret = r.perGoal.find(g => g.type === 'retire_by')
  log(ret && ret.target === 2500000, `retire_by target = £2.5m (${ret?.target})`)
  log(ret && typeof ret.onTrackPct === 'number', `retire_by has an on-track % (${ret?.onTrackPct}%)`)
  log(ret && typeof ret.projected === 'number' && ret.projected > 0, `projects a future pot (£${Math.round((ret?.projected||0)/1e6*100)/100}m)`)
  log(ret && typeof ret.lever === 'string' && ret.lever.length > 0, `gives a lever to close/confirm the gap ("${ret?.lever}")`)
  log(r.headline && /retire by/i.test(r.headline), `headline answers the primary goal ("${r.headline}")`)
  log(/not a forecast|not a personal recommendation/i.test(r.disclaimer), 'FCA disclaimer present')
}

console.log('\n── lever logic: under-saver needs more, over-saver is on track ──')
{
  // Under-saver: tiny pot + tiny contribution vs a big target → needs more, lever > 0.
  const under = { age: 35, retirementAge: 60, targetIncome: 60000, monthlyContribution: 100,
    assets: { sipp: { total: 20000 } } }
  const spec = goalSpec(under, { goals: [{ type: 'retire_by', priority: 1, target: { lump: 2500000, age: 60 } }] })
  const r = solveAccumulation({ entity: under, goalSpec: spec, opts: { now: NOW } })
  const g = r.perGoal[0]
  log(g.onTrackPct < 100, `under-saver below 100% on track (${g.onTrackPct}%)`)
  log(/Save ~£/.test(g.lever) && g.gap > 0, `lever recommends saving more (gap £${Math.round(g.gap/1000)}k)`)
}
{
  // Over-saver: large pot already exceeds target → on track, lever confirms.
  const over = { age: 35, retirementAge: 60, monthlyContribution: 2000,
    assets: { sipp: { total: 800000 }, isa: { value: 400000 } } }
  const spec = goalSpec(over, { goals: [{ type: 'retire_by', priority: 1, target: { lump: 1000000, age: 60 } }] })
  const r = solveAccumulation({ entity: over, goalSpec: spec, opts: { now: NOW } })
  const g = r.perGoal[0]
  log(g.onTrackPct >= 100, `over-saver at/over 100% (${g.onTrackPct}%)`)
  log(/On track/.test(g.lever), 'lever confirms on-track (no extra saving demanded)')
}

console.log('\n── emergency buffer + sparse degradation ──')
{
  const e = { age: 40, expenses: { essentialsMonthly: 2000 }, assets: { cash: { total: 6000 } } }
  const spec = goalSpec(e, { goals: [{ type: 'emergency_buffer', priority: 1, target: { months: 6 } }] })
  const g = solveAccumulation({ entity: e, goalSpec: spec, opts: { now: NOW } }).perGoal[0]
  log(g.target === 12000 && g.onTrackPct === 50, `6mo buffer = £12k, £6k cash → 50% (${g.onTrackPct}%)`)
}
{
  const r = solveAccumulation({ entity: { age: 30 }, goalSpec: goalSpec({ age: 30 }), opts: { now: NOW } })
  log(r.perGoal.length === 0 && r.coverage.dataRichness === 'sparse', 'no assets/savings → honest sparse result')
}

console.log(`\naccumulation-solver — pass=${passes} fail=${fails}`)
process.exit(fails === 0 ? 0 : 1)
