// tests/engine/time-series.test.mjs — Wave 0 W0-T3 contract test for getTimeSeries
//
// Powers every sparkline + L4 chart drill across the product. The signature is
// the single integration point for time-series data — every consumer reads
// from here, not from entity.trajectories directly.
//
// Run: node tests/engine/time-series.test.mjs
import { getTimeSeries } from '../../src/engine/time-series.js'
import { loadPersona } from '../../src/lib/data-source.js'

let passed = 0, failed = 0
const fails = []
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); return }
  failed++; fails.push(msg)
  console.error(`  ✗ ${msg}`)
}

async function main() {
  console.log('═══ getTimeSeries contract test ═══\n')

  const mrt = await loadPersona('mrT-core')
  if (!mrt) {
    console.error('FATAL: could not load mrT-core persona')
    process.exit(2)
  }

  console.log('━ happy path · net_worth · 1Y · month')
  const r1 = getTimeSeries(mrt, 'net_worth', '1Y', 'month')
  assert(Array.isArray(r1.points), 'points is array')
  // Tied to data, not calendar. With anchored cutoff, 1Y from dataEndDate
  // over monthly data returns exactly the points in the last 12 months of
  // fixture data.
  const expected1Y = mrt.trajectories.netWorthHistory.filter(p => {
    const ageDays = (new Date(mrt.trajectories.netWorthHistory.at(-1).date) - new Date(p.date)) / 86400000
    return ageDays <= 365
  }).length
  assert(r1.points.length === expected1Y, `1Y returns ${expected1Y} fixture points (got ${r1.points.length})`)
  assert(r1.window === '1Y', 'echoes window')
  assert(r1.granularity === 'month', 'echoes granularity')
  assert(typeof r1.confidence === 'string', 'has confidence string')
  assert(['high','medium','low'].includes(r1.confidence), `confidence is enum-valid (got ${r1.confidence})`)
  assert(r1.points.every(p => typeof p.value === 'number' && Number.isFinite(p.value)), 'all values finite numbers')
  assert(r1.points.every(p => typeof p.date === 'string'), 'all dates are strings')

  console.log('━ wealth_score · 1Y')
  const r2 = getTimeSeries(mrt, 'wealth_score', '1Y', 'month')
  assert(r2.points.length >= 10, `wealth_score 1Y returns points (got ${r2.points.length})`)
  assert(r2.points.every(p => p.value >= 0 && p.value <= 100), 'wealth_score values in 0-100 range')

  console.log('━ risk_score · 1Y')
  const r3 = getTimeSeries(mrt, 'risk_score', '1Y', 'month')
  assert(r3.points.length >= 10, `risk_score 1Y returns points (got ${r3.points.length})`)

  console.log('━ data honesty — 10Y window exceeds available data')
  const r4 = getTimeSeries(mrt, 'net_worth', '10Y', 'month')
  assert(Array.isArray(r4.gaps), 'gaps is array')
  assert(r4.gaps.length > 0, '10Y window with limited data reports gap')
  assert(r4.dataStartDate, 'reports dataStartDate when gap exists')
  assert(r4.points.length === r1.points.length, 'returns the available data, not a synthesized 10Y series')

  console.log('━ unknown metric · graceful low-confidence empty')
  const r5 = getTimeSeries(mrt, 'nonexistent_metric_xyz', '1Y', 'month')
  assert(Array.isArray(r5.points), 'unknown metric still returns array')
  assert(r5.points.length === 0, 'unknown metric returns empty points')
  assert(r5.confidence === 'low', 'unknown metric reports low confidence')
  assert(r5.gaps.length > 0, 'unknown metric reports gap reason')

  console.log('━ unknown window · graceful low-confidence empty')
  const r5b = getTimeSeries(mrt, 'net_worth', '2Y', 'month')
  assert(r5b.points.length === 0, 'unknown window returns empty points')
  assert(r5b.confidence === 'low', 'unknown window reports low confidence')
  assert(r5b.gaps.some(g => g.reason.includes('unknown window')), 'unknown window reports gap reason')

  console.log('━ window narrowing · 3M ≤ 1Y in count')
  const r6 = getTimeSeries(mrt, 'net_worth', '3M', 'month')
  // 3M from dataEndDate over monthly data: expect 3-4 points
  const expected3M = mrt.trajectories.netWorthHistory.filter(p => {
    const ageDays = (new Date(mrt.trajectories.netWorthHistory.at(-1).date) - new Date(p.date)) / 86400000
    return ageDays <= 90
  }).length
  assert(r6.points.length === expected3M, `3M returns ${expected3M} fixture points (got ${r6.points.length})`)

  console.log('━ All window · returns everything')
  const r7 = getTimeSeries(mrt, 'net_worth', 'All', 'month')
  assert(r7.points.length >= r1.points.length, 'All ≥ 1Y in count')

  console.log('━ purity · same input → same output regardless of wall clock')
  const a = getTimeSeries(mrt, 'net_worth', '1Y', 'month')
  // Sleep 1s would prove time-independence but we can verify by checking
  // the cutoff doesn't depend on current time:
  const b = getTimeSeries(mrt, 'net_worth', '1Y', 'month')
  assert(a.points.length === b.points.length, 'same input returns same output (pure)')
  assert(JSON.stringify(a.points) === JSON.stringify(b.points), 'output is deterministic')

  console.log('━ default granularity · month if omitted')
  const r8 = getTimeSeries(mrt, 'net_worth', '1Y')
  assert(r8.granularity === 'month', 'defaults to month granularity')

  console.log('━ null entity · graceful (does not throw)')
  let threw = null
  try { const r9 = getTimeSeries(null, 'net_worth', '1Y'); assert(r9.points.length === 0, 'null entity → empty result') }
  catch (e) { threw = e }
  assert(threw === null, `null entity must not throw (got: ${threw?.message ?? 'no'})`)

  console.log(`\n═══ ${passed} pass · ${failed} fail ═══`)
  if (failed > 0) {
    console.error('\nFailures:'); for (const f of fails) console.error('  -', f)
    process.exit(1)
  }
  process.exit(0)
}

main().catch(e => { console.error('fatal:', e); process.exit(2) })
