// tests/decumulation-plan.mjs — guided withdrawal sequence contract.
import { classifyPot, potsNeedingReview, buildDecumulationPlan, rankDrawOrder } from '../src/engine/decumulation-plan.js'

let fails = 0, passes = 0
const log = (ok, m) => { ok ? (passes++, console.log('✓ ' + m)) : (fails++, console.log('✗ ' + m)) }

const POTS = [
  { name: 'Vanguard SIPP',   value: 420000, type: 'SIPP',       charge: 0.0045, nominationDate: '2025-01-01' },
  { name: 'Hargreaves SIPP', value: 280000, type: 'SIPP',       charge: 0.0045, nominationDate: '2025-03-01' },
  { name: 'Wayne DC',        value: 150000, type: 'Legacy DC',  charge: 0.0090, nominationDate: '2019-01-01' },
]

console.log('\n── classifyPot ──')
log(classifyPot(POTS[0]) === 'self-invested', 'SIPP → self-invested')
log(classifyPot(POTS[2]) === 'workplace-legacy', 'Legacy DC → workplace-legacy')
log(classifyPot({ type: 'Occupational DB' }) === 'workplace-legacy', 'DB → workplace-legacy')

console.log('\n── potsNeedingReview ──')
{
  const r = potsNeedingReview(POTS, { now: new Date('2026-05-31') })
  log(r.length === 1 && r[0].name === 'Wayne DC', 'stale nomination (>2y) flagged; fresh ones not')
}

console.log('\n── buildDecumulationPlan ──')
{
  const p = buildDecumulationPlan(POTS, { age: 63, iht2027: new Date('2027-04-06'), now: new Date('2026-05-31'), flexibleIncomeTaken: false })
  log(Array.isArray(p.sequence) && p.sequence.length >= 4, 'sequence has ≥4 ordered steps')
  log(p.sequence[0].action === 'verify' && /legacy|guarantee|safeguard/i.test(p.sequence[0].reason), 'legacy ring-fenced as step 1 (verify)')
  log(p.sequence.some(s => s.action === 'tax-free-cash'), 'includes a tax-free-cash step')
  log(p.sequence.some(s => s.action === 'flex'), 'includes a flex-the-SIPPs step')
  log(p.sequence[p.sequence.length - 1].action === 'time-2027', 'final step times against April 2027')
  log(p.sequence.every((s, i) => s.order === i + 1), 'orders are 1..n contiguous')
  log(p.flags.some(f => f.code === 'VERIFY_LEGACY'), 'flags VERIFY_LEGACY when a legacy pot exists')
  log(p.flags.some(f => f.code === 'IHT_2027_SOON'), 'flags IHT_2027_SOON when within 365 days')
}
{
  const p = buildDecumulationPlan(POTS, { age: 63, iht2027: new Date('2027-04-06'), now: new Date('2026-05-31'), flexibleIncomeTaken: true })
  log(p.flags.some(f => f.code === 'MPAA'), 'flags MPAA when flexible income already taken')
}
{
  const p = buildDecumulationPlan([POTS[0], POTS[1]], { age: 63, iht2027: new Date('2027-04-06'), now: new Date('2026-05-31') })
  log(!p.flags.some(f => f.code === 'VERIFY_LEGACY'), 'no legacy flag when all pots are SIPPs')
  log(p.sequence[0].action !== 'verify', 'no verify step when nothing to verify')
}

console.log('\n── rankDrawOrder ──')
{
  const pots = [
    { name: 'Vanguard SIPP',   value: 420000, type: 'SIPP',      charge: 0.0045, expectedReturn: 0.076 },
    { name: 'Hargreaves SIPP', value: 280000, type: 'SIPP',      charge: 0.0045, expectedReturn: 0.076 },
    { name: 'Wayne DC',        value: 150000, type: 'Legacy DC', charge: 0.0090, expectedReturn: 0.076 },
  ]
  const { ranked } = rankDrawOrder(pots)
  log(ranked.length === 3, 'ranks all pots')
  log(ranked.every((r, i) => r.order === i + 1), 'orders contiguous 1..n')
  log(ranked[ranked.length - 1].pot.name === 'Wayne DC', 'legacy pot deferred to last (verify-keep)')
  log(ranked[ranked.length - 1].priority === 'verify-keep', 'legacy priority = verify-keep')
  log(ranked[ranked.length - 1].unknowns.includes('exit penalty / guarantee'), 'legacy flags penalty/guarantee unknown')
  log(ranked.every(r => r.unknowns.includes('actual fund return')), 'all flag actual-fund-return unknown (no captured returns)')
}
{
  // higher charge drains first when growth equal
  const pots = [
    { name: 'Low fee',  value: 100000, type: 'SIPP', charge: 0.0030, expectedReturn: 0.07 },
    { name: 'High fee', value: 100000, type: 'SIPP', charge: 0.0090, expectedReturn: 0.07 },
  ]
  const { ranked } = rankDrawOrder(pots)
  log(ranked[0].pot.name === 'High fee', 'higher-charge pot drains first')
  log(/Higher charge/.test(ranked[0].primaryReason), 'reason cites charge')
}
{
  // lower growth drains first when charge equal
  const pots = [
    { name: 'Slow', value: 100000, type: 'SIPP', charge: 0.005, expectedReturn: 0.03 },
    { name: 'Fast', value: 100000, type: 'SIPP', charge: 0.005, expectedReturn: 0.09 },
  ]
  const { ranked } = rankDrawOrder(pots)
  log(ranked[0].pot.name === 'Slow', 'lower-growth pot drains first (keep the fast one longer)')
  log(ranked[ranked.length - 1].priority === 'keep-longest', 'fastest grower = keep-longest')
}
{
  const captured = [{ name: 'X', value: 1, type: 'SIPP', charge: 0.005, expectedReturn: 0.07, expectedReturnSource: 'actual' }]
  log(!rankDrawOrder(captured).ranked[0].unknowns.includes('actual fund return'), 'captured actual return suppresses the unknown flag')
}

console.log(`\ndecumulation-plan — pass=${passes} fail=${fails}`)
process.exit(fails === 0 ? 0 : 1)
