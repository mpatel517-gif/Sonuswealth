// tests/scenario-engine.mjs — the ONE engine, three modes.
// Verifies that TEST-mode what-if deltas come off the SAME canonical selectors
// the rest of the app uses (no parallel surplus math), that SOLVE delegates to
// the goal solvers branch-correctly, that RANK surfaces a goal-relevant action,
// and that the whole thing is deterministic + stamped. Bruce (decum) + Mr T (accum).
import { readFileSync } from 'node:fs'
import {
  LEVERS, leverById, applyLevers, measure, runScenario, previewCommit,
} from '../src/engine/scenario-engine.js'
import { netWorth, cashflowFlow } from '../src/engine/fq-calculator.js'

let fails = 0, passes = 0
const log = (ok, m) => { ok ? (passes++, console.log('✓ ' + m)) : (fails++, console.log('✗ ' + m)) }
const load = (f) => JSON.parse(readFileSync(new URL(`../src/rules/personas/${f}`, import.meta.url)))
const BRUCE = load('persona-a.json')
const MRT = load('mrT-core.json')
const NOW = new Date('2026-06-03')

// ── registry sanity ──────────────────────────────────────────────────────────
console.log('\n── lever registry ──')
{
  log(LEVERS.length >= 8, `registry has the levers (${LEVERS.length})`)
  log(!!leverById('lose_job') && !!leverById('cut_essentials') && !!leverById('max_pension'),
    'income + cashflow + asset levers all present')
  const scopes = new Set(LEVERS.map(l => l.scope))
  log(scopes.has('position') && scopes.has('cashflow') && scopes.has('holding'),
    'all three scopes represented (position/cashflow/holding)')
  log(LEVERS.some(l => l.horizon) && LEVERS.some(l => l.robust === false),
    'horizon + robust:false flags present (honest about trajectory vs snapshot, and fragile asset pokes)')
}

// ── measure() reads canonical selectors (the divergence-killer) ───────────────
console.log('\n── measure() ties to canonical selectors ──')
{
  const m = measure(BRUCE, { now: NOW })
  log(m.netWorth === Math.round(netWorth(BRUCE)), `netWorth matches canonical (£${Math.round(m.netWorth/1e3)}k)`)
  const flow = cashflowFlow(BRUCE)
  log(m.surplusAnnual === Math.round(flow.surplusAnnual),
    `surplus matches cashflowFlow exactly (£${m.surplusAnnual}/yr) — no parallel math`)
  log(typeof m.ihtDue === 'number' && typeof m.fq === 'number', 'IHT + FQ measured')
}

// ── TEST mode: lose_job tanks income + surplus, computed canonically ──────────
console.log('\n── TEST mode — lose_job (Mr T, an earner) ──')
{
  const r = runScenario(MRT, { mode: 'test', pins: [{ id: 'lose_job' }], opts: { now: NOW } })
  log(r.mode === 'test', 'mode = test')
  const grossDelta = r.deltas.find(d => d.key === 'grossIncome')
  log(grossDelta && grossDelta.delta < 0, `losing the job drops canonical income (Δ £${grossDelta?.delta})`)
  const surplusDelta = r.deltas.find(d => d.key === 'surplusMonthly')
  log(surplusDelta && surplusDelta.delta < 0, `and lowers monthly surplus (Δ £${surplusDelta?.delta}/mo)`)
  log(surplusDelta && surplusDelta.better === false, 'surplus drop correctly flagged as NOT better')
  // tie-out: scenario surplus must equal a fresh canonical measure of the mutated entity
  const { entity: zeroInc } = applyLevers(MRT, [{ id: 'lose_job' }])
  log(r.scenario.surplusAnnual === Math.round(cashflowFlow(zeroInc).surplusAnnual),
    'scenario surplus == canonical cashflowFlow of the mutated entity (tie-out)')
}

// ── TEST mode: cut_essentials saves the EXACT canonical amount ────────────────
console.log('\n── TEST mode — cut_essentials sizes off canonical essentials ──')
{
  const base = measure(BRUCE)
  const pct = 10
  const r = runScenario(BRUCE, { mode: 'test', pins: [{ id: 'cut_essentials', value: pct }], opts: { now: NOW } })
  const expectedAnnualSaving = Math.round(base._flow.essentials * pct / 100)
  const got = r.scenario.surplusAnnual - r.baseline.surplusAnnual
  log(Math.abs(got - expectedAnnualSaving) <= 1,
    `cutting essentials ${pct}% raises surplus by exactly the canonical essentials share (£${got}/yr ≈ £${expectedAnnualSaving})`)
}

// ── TEST mode: horizon-only lever is honest about being a no-op on the snapshot ─
console.log('\n── TEST mode — growth_rate is horizon-only ──')
{
  const r = runScenario(BRUCE, { mode: 'test', pins: [{ id: 'growth_rate', value: 9 }], opts: { now: NOW } })
  log(r.deltas.length === 0, 'changing growth does not move today’s snapshot numbers')
  log(/projected path|trajectory/i.test(r.note || ''), 'and says so — routes user to "Your plan" (SOLVE)')
}

// ── SOLVE mode: branch-correct delegation ─────────────────────────────────────
console.log('\n── SOLVE mode — delegates to the goal solvers ──')
{
  const bruce = runScenario(BRUCE, { mode: 'solve', opts: { now: NOW } })
  log(bruce.mode === 'solve' && bruce.branch === 'decumulation', 'Bruce → decumulation solver')
  log(Array.isArray(bruce.rankedPaths) && bruce.rankedPaths.length > 0, 'returns ranked withdrawal paths')

  const mrt = runScenario(MRT, { mode: 'solve', opts: { now: NOW } })
  log(mrt.mode === 'solve' && mrt.branch === 'accumulation', 'Mr T → accumulation solver')
  log(!!mrt.headline, 'returns an accumulation headline')
}

// ── RANK mode: goal-relevant, sorted, actionable ──────────────────────────────
console.log('\n── RANK mode — What-next surfaces the top action ──')
{
  const r = runScenario(BRUCE, { mode: 'rank', opts: { now: NOW } })
  log(r.mode === 'rank', 'mode = rank')
  log(typeof r.targetMetric === 'string', `ranks against the primary goal's metric (${r.targetMetric} — ${r.targetMetricLabel})`)
  log(Array.isArray(r.actions), 'returns an action list')
  if (r.actions.length > 1) {
    log(r.actions[0].magnitude >= r.actions[1].magnitude, 'actions sorted by impact (largest first)')
  }
  log(r.actions.every(a => a.improves), 'every ranked action actually improves the goal metric')
}

// ── determinism ───────────────────────────────────────────────────────────────
console.log('\n── determinism (no RNG) ──')
{
  const a = runScenario(BRUCE, { mode: 'test', pins: [{ id: 'pay_change', value: 15 }], opts: { now: NOW } })
  const b = runScenario(BRUCE, { mode: 'test', pins: [{ id: 'pay_change', value: 15 }], opts: { now: NOW } })
  log(JSON.stringify(a.deltas) === JSON.stringify(b.deltas), 'same input → identical deltas')
}

// ── stamping + commit payload ─────────────────────────────────────────────────
console.log('\n── point-in-time stamp + commit payload ──')
{
  const r = runScenario(BRUCE, { mode: 'test', pins: [{ id: 'lose_job' }], opts: { now: NOW } })
  log(!!r.asOf && !!r.snapshotHash, `stamped with data date (${r.asOf}) + snapshot hash (${r.snapshotHash})`)
  const commit = previewCommit(BRUCE, [{ id: 'cut_essentials', value: 10 }], { now: NOW, label: 'Trim essentials' })
  log(commit.type === 'SCENARIO_SAVED', 'previewCommit builds a SCENARIO_SAVED payload')
  log(commit.payload && typeof commit.payload.deltas === 'object', 'payload carries category deltas for the cross-tab ripple')
  log(!!commit.payload.snapshotHash, 'payload is stamped (reproducible against the position it used)')
}

// ── pay_change directionality (up AND down), on the unambiguous income metric ──
// Surplus direction is entangled with an essentials-from-gross heuristic in the
// canonical engine, so we assert on grossIncome (clean) — and that the lever
// produces a non-empty delta either way.
console.log('\n── pay_change moves canonical income the right way both directions ──')
{
  const up = runScenario(MRT, { mode: 'test', pins: [{ id: 'pay_change', value: 20 }], opts: { now: NOW } })
  const down = runScenario(MRT, { mode: 'test', pins: [{ id: 'pay_change', value: -20 }], opts: { now: NOW } })
  const ug = up.deltas.find(d => d.key === 'grossIncome')
  const dg = down.deltas.find(d => d.key === 'grossIncome')
  log(ug && ug.delta > 0, `+20% pay → income up (Δ £${ug?.delta})`)
  log(dg && dg.delta < 0, `−20% pay → income down (Δ £${dg?.delta})`)
}

console.log(`\n${'─'.repeat(60)}\n${passes} passed, ${fails} failed\n`)
process.exit(fails ? 1 : 0)
