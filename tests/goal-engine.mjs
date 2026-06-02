// tests/goal-engine.mjs — Goal Engine STEP 1 (model) contract.
// Pure model: taxonomy · normalisation · derivation · lexicographic ordering.
// No tax math / no solver here — those are the branch solvers (steps 2–3).
import {
  GOAL_TYPES, GOAL_TYPE_KEYS, inferBranch, normalizeGoal,
  orderGoals, deriveGoals, goalSpec,
} from '../src/engine/goal-engine.js'
import { readFileSync } from 'node:fs'

let fails = 0, passes = 0
const log = (ok, m) => { ok ? (passes++, console.log('✓ ' + m)) : (fails++, console.log('✗ ' + m)) }

const BRUCE = JSON.parse(readFileSync(new URL('../src/rules/personas/persona-a.json', import.meta.url)))
const MRT   = JSON.parse(readFileSync(new URL('../src/rules/personas/mrT-core.json', import.meta.url)))

console.log('\n── taxonomy completeness ──')
{
  const okAll = GOAL_TYPE_KEYS.every(k => {
    const m = GOAL_TYPES[k]
    return ['accumulation', 'decumulation', 'either'].includes(m.branch)
      && Number.isFinite(m.defaultPriority)
      && ['hard', 'soft'].includes(m.defaultShortfall)
      && typeof m.objective === 'string' && m.objective.length > 0
      && typeof m.question === 'string' && m.question.length > 0
  })
  log(okAll, `all ${GOAL_TYPE_KEYS.length} goal types carry branch/priority/shortfall/objective/question`)
  log(GOAL_TYPE_KEYS.includes('income_floor') && GOAL_TYPE_KEYS.includes('legacy') && GOAL_TYPE_KEYS.includes('retire_by'), 'taxonomy spans both stages (income_floor, legacy, retire_by present)')
  log(GOAL_TYPES.tax_efficiency.alwaysOn === true && GOAL_TYPES.risk_bound.alwaysOn === true, 'cross-stage constraints flagged alwaysOn')
}

console.log('\n── inferBranch ──')
log(inferBranch(BRUCE) === 'decumulation', 'Bruce (lifeStage 5) → decumulation')
log(inferBranch(MRT) === 'accumulation', 'Mr T (lifeStage 2) → accumulation')
log(inferBranch({ lifeStage: 2, preferences: { lifeStageOverride: 'decumulator' } }) === 'decumulation', 'override forces decumulation')
log(inferBranch({ age: 70, retirementAge: 67 }) === 'decumulation', 'age ≥ retirementAge → decumulation')

console.log('\n── normalizeGoal ──')
{
  const g = normalizeGoal({ type: 'legacy' })
  log(g.branch === 'decumulation' && g.priority === GOAL_TYPES.legacy.defaultPriority, 'fills branch + default priority')
  log(g.shortfallTolerance === 'soft' && g.objective === 'maximise_after_iht_estate', 'fills shortfall + objective')
  log(g.constraints.some(c => c.code === 'POST_2027_DRAW_PENSION_TO_SHRINK_ESTATE'), 'legacy imposes the post-2027 pension-draw constraint')
}
{
  const c = normalizeGoal({ type: 'legacy' }, { iht2027: new Date('2027-04-06') }).constraints.find(c => c.code === 'POST_2027_DRAW_PENSION_TO_SHRINK_ESTATE')
  log(c.activeFrom === new Date('2027-04-06').toISOString(), 'post-2027 constraint carries injectable activeFrom date (deterministic)')
}
{
  const g = normalizeGoal({ type: 'income_floor' })
  log(g.shortfallTolerance === 'hard', 'income_floor defaults to hard shortfall tolerance')
  log(g.constraints.some(c => c.code === 'SECURE_INCOME_COVERS_ESSENTIALS'), 'income_floor imposes secure-income-covers-essentials')
}
{
  // user-set priority/shortfall must win over defaults; idempotent re-normalise
  const once = normalizeGoal({ type: 'legacy', priority: 1, shortfallTolerance: 'hard' })
  const twice = normalizeGoal(once)
  log(once.priority === 1 && once.shortfallTolerance === 'hard', 'user-set priority/shortfall override defaults')
  log(twice.priority === 1 && twice.objective === once.objective, 'normalizeGoal is idempotent')
}
{
  const u = normalizeGoal({ type: 'not_a_real_type' })
  log(u.unknownType === true, 'unknown type tagged (not silently dropped)')
}

console.log('\n── orderGoals (the budgeting rule) ──')
{
  const ordered = orderGoals([
    normalizeGoal({ type: 'legacy' }),          // priority 10
    normalizeGoal({ type: 'income_floor' }),    // priority 2, hard
    normalizeGoal({ type: 'max_lifetime_spend' }), // priority 8
    normalizeGoal({ type: 'tax_efficiency' }),  // alwaysOn → last
  ])
  log(ordered[0].type === 'income_floor', 'lowest-priority-number / hard goal funded first')
  log(ordered[ordered.length - 1].type === 'tax_efficiency', 'alwaysOn constraint sorts to the end')
  log(ordered.map(g => g.type).join(',') === 'income_floor,max_lifetime_spend,legacy,tax_efficiency', 'full lexicographic order correct')
}
{
  // tie on priority → hard before soft
  const ordered = orderGoals([
    { type: 'A', priority: 5, shortfallTolerance: 'soft' },
    { type: 'B', priority: 5, shortfallTolerance: 'hard' },
  ])
  log(ordered[0].type === 'B', 'tie-break: hard before soft')
}
{
  // equal priority + shortfall → stable (original order preserved → deterministic)
  const ordered = orderGoals([
    { type: 'X', priority: 5, shortfallTolerance: 'soft' },
    { type: 'Y', priority: 5, shortfallTolerance: 'soft' },
  ])
  log(ordered[0].type === 'X' && ordered[1].type === 'Y', 'equal goals keep stable order (deterministic)')
}

console.log('\n── deriveGoals from real persona data ──')
{
  const g = deriveGoals(BRUCE)
  const types = g.map(x => x.type)
  log(types.includes('income_floor'), 'Bruce: retirement plan → income_floor (decumulation)')
  log(types.includes('legacy'), 'Bruce: estate plan → legacy')
  log(types.includes('min_lifetime_tax'), 'Bruce: tax plan → min_lifetime_tax (decumulation)')
  log(!types.includes('retire_by'), 'Bruce: no accumulation retire_by goal')
  const inc = g.find(x => x.type === 'income_floor')
  log(inc && inc.target.income === 96000, 'Bruce income goal picks up £96k/yr drawdown target (£8k/mo)')
}
{
  const g = deriveGoals(MRT)
  const types = g.map(x => x.type)
  log(types.includes('retire_by'), 'Mr T: retirement plan → retire_by (accumulation)')
  log(types.includes('gifting'), 'Mr T: gift plan → gifting')
  log(types.includes('maximise_relief'), 'Mr T: tax plan → maximise_relief (accumulation)')
  log(!types.includes('income_floor'), 'Mr T: no decumulation income_floor goal')
  const ret = g.find(x => x.type === 'retire_by')
  log(ret && ret.target.lump === 2500000, 'Mr T retire_by picks up £2.5m net-worth target')
}
{
  // protection plans must NOT become a funding goal
  const g = deriveGoals(BRUCE)
  log(!g.some(x => x.type === 'protection'), 'protection plan excluded from funding goals')
}

console.log('\n── goalSpec (derive → normalise → order) ──')
{
  const spec = goalSpec(BRUCE)
  log(spec.branch === 'decumulation', 'Bruce spec branch = decumulation')
  log(spec.primary && spec.primary.type === 'income_floor', 'Bruce primary goal = income_floor (highest priority funded)')
  log(spec.goals.every((g, i) => i === 0 || (spec.goals[i - 1].alwaysOn ? true : (g.priority >= spec.goals[i - 1].priority || g.alwaysOn))), 'Bruce goals in non-decreasing priority order')
}
{
  const spec = goalSpec(MRT)
  log(spec.branch === 'accumulation', 'Mr T spec branch = accumulation')
  log(spec.primary && spec.primary.branch === 'accumulation', 'Mr T primary goal is an accumulation goal')
}
{
  // determinism: identical input → identical output
  const a = JSON.stringify(goalSpec(BRUCE).goals.map(g => g.type))
  const b = JSON.stringify(goalSpec(BRUCE).goals.map(g => g.type))
  log(a === b, 'goalSpec deterministic across calls')
}

console.log(`\ngoal-engine — pass=${passes} fail=${fails}`)
process.exit(fails === 0 ? 0 : 1)
