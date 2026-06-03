// scripts/goal-engine-demo.mjs
// Human-readable dump of what the goal engine produces — run before the UI
// exists, to SEE the result. Usage: npm run demo:goals  [or: node scripts/goal-engine-demo.mjs]
import { readFileSync } from 'node:fs'
import { goalSpec } from '../src/engine/goal-engine.js'
import { solveDecumulation, extractDecumulationContext } from '../src/engine/decumulation-solver.js'
import { solveAccumulation } from '../src/engine/accumulation-solver.js'
import { compareMethods } from '../src/engine/withdrawal-methods.js'

const NOW = new Date('2026-06-03')
const load = (f) => JSON.parse(readFileSync(new URL(`../src/rules/personas/${f}`, import.meta.url)))
const BRUCE = load('persona-a.json'), MRT = load('mrT-core.json')
const gp = (n) => '£' + Math.round(n).toLocaleString()
const gk = (n) => '£' + Math.round(n / 1000) + 'k'
const gm = (n) => '£' + (Math.round(n / 1e5) / 10) + 'm'
const hr = (c = '─') => console.log(c.repeat(78))

// ════════════════════════════════════════════════════════════════════════════
hr('═'); console.log('  BRUCE WAYNE · 62 · DECUMULATOR   (?demo=a)'); hr('═')

const bSpec = goalSpec(BRUCE)
const bCtx = extractDecumulationContext(BRUCE)
console.log(`\nGoals (auto-derived from his data, ranked by the budgeting rule):`)
bSpec.goals.filter(g => !g.alwaysOn).forEach((g, i) =>
  console.log(`   ${i + 1}. ${g.type.padEnd(18)} priority ${g.priority}  (${g.shortfallTolerance})`))
console.log(`\nHis money:  pension ${gk(bCtx.pots.pension)} · ISA ${gk(bCtx.pots.isa)} · GIA ${gk(bCtx.pots.gia)} · cash ${gk(bCtx.pots.cash)}`)
console.log(`            property ${gm(bCtx.property)} · secure income ${gk(bCtx.secure.rental + bCtx.secure.dividends)}/yr · target ${gk(bCtx.incomeTargetAnnual)}/yr net`)

const bRes = solveDecumulation({ entity: BRUCE, goalSpec: bSpec, opts: { now: NOW } })

console.log(`\n┌─ RANKED WITHDRAWAL PATHS  (primary goal: ${bRes.binding.primaryGoal}) ──────────────`)
console.log(`│  ${'#'.padEnd(2)} ${'sequence'.padEnd(38)} ${'lifetime tax'.padStart(12)} ${'after-IHT'.padStart(10)} funds-to`)
bRes.rankedPaths.forEach(p =>
  console.log(`│  ${String(p.rank).padEnd(2)} ${p.name.padEnd(38)} ${gk(p.totalTaxCost).padStart(12)} ${gm(p.afterIhtEstate).padStart(10)}   age ${p.depletedAtAge || '95+'}`))
console.log(`└─ (label these "ranked under your priorities", never "optimal/best" — compliance)`)

const top = bRes.rankedPaths[0]
console.log(`\nWHY #1 WON — score breakdown:`)
Object.entries(top.scoreBreakdown).forEach(([goal, b]) =>
  console.log(`   ${goal.padEnd(18)} ${b.objective.padEnd(34)} ${typeof b.value === 'number' ? (b.value > 9999 ? gk(b.value) : b.value) : b.value} (${b.better} = better)`))

console.log(`\nTHE VISIBLE PATH — year-by-year (first 5 + last):`)
console.log(`   ${'age'.padEnd(4)} ${'draw from'.padEnd(12)} ${'gross'.padStart(8)} ${'tax'.padStart(8)} ${'net'.padStart(8)}  PCLS`)
const sched = top.schedule
;[...sched.slice(0, 5), sched[sched.length - 1]].forEach(y =>
  console.log(`   ${String(y.age).padEnd(4)} ${String(y.fromAsset).padEnd(12)} ${gk(y.grossFromPots).padStart(8)} ${gk(y.tax).padStart(8)} ${gk(y.net).padStart(8)}  ${y.pclsTaxFree ? gk(y.pclsTaxFree) : '–'}`))

console.log(`\nRATIONALE (plain-English, shown to the user):`)
top.rationale.forEach(s => console.log(`   • ${s}`))

console.log(`\nRECOMMENDED METHOD: ${bRes.recommendedMethod.label}`)
console.log(`   ${bRes.recommendedMethod.why}`)

console.log(`\nTHE 5 WITHDRAWAL METHODS on a ${gm(bCtx.pots.pension + bCtx.pots.isa + bCtx.pots.gia + bCtx.pots.cash)} pot (30y, ${gk(bCtx.secure.rental)} essentials):`)
const cmp = compareMethods({ portfolio: bCtx.pots.pension + bCtx.pots.isa + bCtx.pots.gia + bCtx.pots.cash, years: 30, growth: 0.05, inflation: 0.025, essentialsAnnual: 28000, age: 62 })
cmp.forEach(m => console.log(`   ${(m.label + (m.recommended ? ' ★' : '')).padEnd(34)} yr1 ${gk(m.year1Withdrawal).padStart(7)}  ${m.lastsHorizon ? 'lasts 30y' : 'runs low age ' + m.depletesAtAge}`))

console.log(`\n"HOW WE WORKED THIS OUT" — methodology (every rule, sourced):`)
bRes.methodology.rules.forEach(r => console.log(`   • ${r.rule}  [${r.source} · ${r.status}]`))
console.log(`\nASSUMPTIONS (editable by the user):`)
bRes.methodology.assumptions.forEach(a => console.log(`   • ${a.name}: ${a.value}`))
console.log(`\nHONESTY / COVERAGE caveats:`)
bRes.coverage.unknowns.forEach(u => console.log(`   ⚠ ${u}`))
console.log(`\n${bRes.disclaimer}`)

// ════════════════════════════════════════════════════════════════════════════
console.log('\n'); hr('═'); console.log('  MR T · 35 · ACCUMULATOR   (?demo=mrt)'); hr('═')
const mSpec = goalSpec(MRT)
const mRes = solveAccumulation({ entity: MRT, goalSpec: mSpec, opts: { now: NOW } })
console.log(`\nHeadline: ${mRes.headline}`)
console.log(`\nPer-goal:`)
mRes.perGoal.forEach(g => {
  console.log(`   ${g.type.padEnd(18)} ${g.onTrackPct != null ? (g.onTrackPct + '% on track') : '(info)'}`)
  if (g.lever) console.log(`      → ${g.lever}`)
})
console.log(`\nAssumptions: ${mRes.coverage.assumptions.join(' · ')}`)
console.log(`\n${mRes.disclaimer}`)
hr('═')
