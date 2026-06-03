// tests/withdrawal-methods.mjs — the 5 withdrawal-rate methods (step 2c).
// Deterministic; verifies each method's signature behaviour + goal mapping.
import { METHODS, methodPath, compareMethods, recommendMethodForGoal } from '../src/engine/withdrawal-methods.js'

let fails = 0, passes = 0
const log = (ok, m) => { ok ? (passes++, console.log('✓ ' + m)) : (fails++, console.log('✗ ' + m)) }

const OPTS = { portfolio: 1000000, years: 30, growth: 0.05, inflation: 0.025, essentialsAnnual: 28000, age: 65 }

console.log('\n── the 5 methods exist with descriptions ──')
{
  const ids = Object.keys(METHODS)
  log(ids.length === 5, `exactly 5 methods (${ids.join(', ')})`)
  log(ids.includes('bengen') && ids.includes('guyton_klinger') && ids.includes('vanguard') && ids.includes('bucket') && ids.includes('floor_guardrail'), 'Bengen / GK / Vanguard / Bucket / floor+guardrail all present')
  log(METHODS.floor_guardrail.recommended === true, 'Sonuswealth floor+guardrail is flagged as the recommended hybrid')
  log(Object.values(METHODS).every(m => m.summary && m.strength && m.weakness && m.source), 'every method carries summary + strength + weakness + source')
}

console.log('\n── deterministic + signature behaviour ──')
{
  const a = methodPath('guyton_klinger', OPTS)
  const b = methodPath('guyton_klinger', OPTS)
  log(JSON.stringify(a) === JSON.stringify(b), 'guyton_klinger is deterministic (no RNG, unlike fq-calculator version)')
}
{
  const bengen = methodPath('bengen', OPTS)
  log(bengen[0].withdrawal === Math.round(OPTS.portfolio * 0.04), `Bengen year-1 = 4% of pot (£${bengen[0].withdrawal})`)
  log(bengen[1].withdrawal > bengen[0].withdrawal, 'Bengen income rises with inflation each year')
  log(bengen.length === 30, 'path spans the horizon')
}
{
  const van = methodPath('vanguard', OPTS)
  // Vanguard draws a % of CURRENT pot → year-1 lower than Bengen 4% (uses ~3.3%).
  log(van[0].withdrawal < methodPath('bengen', OPTS)[0].withdrawal, 'Vanguard year-1 draw below Bengen (lower base rate)')
  log(van.every(p => p.rule === 'dynamic ±band'), 'Vanguard applies its ceiling/floor band rule')
}
{
  const fg = methodPath('floor_guardrail', OPTS)
  log(fg.every(p => /floor/.test(p.rule)), 'floor+guardrail always secures the floor (essentials never the thing cut)')
  log(fg[0].withdrawal >= OPTS.essentialsAnnual, 'floor+guardrail year-1 covers at least the essentials floor')
}

console.log('\n── compareMethods (MethodDrawer data) ──')
{
  const cmp = compareMethods(OPTS)
  log(cmp.length === 5, 'compares all 5 methods')
  log(cmp.every(m => typeof m.year1Withdrawal === 'number' && 'lastsHorizon' in m && 'path' in m), 'each carries year-1 draw, lasts-horizon flag, full path')
  // Higher-rate methods draw more in year 1 than lower-rate ones.
  const bengen = cmp.find(m => m.id === 'bengen'), van = cmp.find(m => m.id === 'vanguard')
  log(bengen.year1Withdrawal > van.year1Withdrawal, 'Bengen draws more up-front than Vanguard (rate difference shows)')
}

console.log('\n── goal → method mapping ──')
{
  log(recommendMethodForGoal('income_floor') === 'floor_guardrail', 'income_floor → floor+guardrail (protect essentials)')
  log(recommendMethodForGoal('max_lifetime_spend') === 'guyton_klinger', 'max_lifetime_spend → Guyton-Klinger (highest average income)')
  log(recommendMethodForGoal('legacy') === 'bengen', 'legacy → Bengen (steadier draw preserves capital)')
  log(recommendMethodForGoal('min_lifetime_tax') === 'vanguard', 'min_lifetime_tax → Vanguard (smooth, controllable)')
}

console.log(`\nwithdrawal-methods — pass=${passes} fail=${fails}`)
process.exit(fails === 0 ? 0 : 1)
