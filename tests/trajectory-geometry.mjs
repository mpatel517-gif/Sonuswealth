// tests/trajectory-geometry.mjs — pure geometry contract for TrajectoryBar.
import { trajectorySegments } from '../src/components/MyMoney/L3/trajectory-geometry.js'

let fails = 0, passes = 0
const log = (ok, m) => { ok ? (passes++, console.log('✓ ' + m)) : (fails++, console.log('✗ ' + m)) }

console.log('\n── trajectorySegments ──')
{
  const s = trajectorySegments(100, 150, 180, 'grow')
  log(Math.abs(s.nowPct + s.futurePct + s.planPct - 100) < 0.01, 'grow segments sum to 100%')
  log(s.nowPct > s.futurePct && s.futurePct > s.planPct, 'grow ordering now>future>plan widths')
}
{
  const s = trajectorySegments(100, 100, 100, 'grow')
  log(Math.abs(s.nowPct - 100) < 0.01, 'flat node → all width is Now')
  log(s.futurePct === 0 && s.planPct === 0, 'flat node → no future/plan extension')
}
{
  const s = trajectorySegments(200, 150, 120, 'shrink')
  log(s.direction === 'shrink', 'carries direction')
  log(s.nowPct + s.futurePct + s.planPct <= 100.01, 'shrink widths bounded')
}
{
  const s = trajectorySegments(0, 0, 0, 'grow')
  log(s.nowPct === 0 && s.futurePct === 0 && s.planPct === 0, 'all-zero → empty bar, no NaN')
}

console.log(`\ntrajectory geometry — pass=${passes} fail=${fails}`)
process.exit(fails === 0 ? 0 : 1)
