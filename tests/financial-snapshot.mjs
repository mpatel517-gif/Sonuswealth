// tests/financial-snapshot.mjs — point-in-time snapshot + guidance stamping.
import { financialSnapshot, snapshotHash, stampGuidance } from '../src/engine/financial-snapshot.js'
import { goalSpec } from '../src/engine/goal-engine.js'
import { solveDecumulation } from '../src/engine/decumulation-solver.js'
import { solveAccumulation } from '../src/engine/accumulation-solver.js'
import { readFileSync } from 'node:fs'

let fails = 0, passes = 0
const log = (ok, m) => { ok ? (passes++, console.log('✓ ' + m)) : (fails++, console.log('✗ ' + m)) }
const BRUCE = JSON.parse(readFileSync(new URL('../src/rules/personas/persona-a.json', import.meta.url)))
const MRT = JSON.parse(readFileSync(new URL('../src/rules/personas/mrT-core.json', import.meta.url)))
const NOW = new Date('2026-06-03')

console.log('\n── financialSnapshot ──')
{
  const s = financialSnapshot(BRUCE)
  log(s.asOf === '2026-05-18', `as-of date read from the data (dataLastUpdated = ${s.asOf})`)
  log(s.netWorth > 0, `net worth captured (£${Math.round(s.netWorth / 1e6 * 10) / 10}m)`)
  log(s.pots.pension === 850000 && s.pots.property > 0, 'pots + property captured in the snapshot')
  log(s.personId === 'a' && s.schemaVersion === 1, 'carries personId + schema version')
}

console.log('\n── snapshotHash: stable + change-sensitive ──')
{
  const a = snapshotHash(financialSnapshot(BRUCE))
  const b = snapshotHash(financialSnapshot(BRUCE))
  log(a === b, 'same position → same hash (stable, for dedupe)')
  const changed = { ...BRUCE, assets: { ...BRUCE.assets, cash: { total: 999999 } } }
  log(snapshotHash(financialSnapshot(changed)) !== a, 'changed wealth → different hash (re-run signal)')
}

console.log('\n── guidance is stamped with the data date (decumulation) ──')
{
  const r = solveDecumulation({ entity: BRUCE, goalSpec: goalSpec(BRUCE), opts: { now: NOW } })
  log(r.asOf === '2026-05-18', `guidance carries asOf = the data date (${r.asOf})`)
  log(r.generatedAt === NOW.toISOString(), 'guidance carries generatedAt (when it was computed)')
  log(r.snapshot && r.snapshot.netWorth > 0 && r.snapshotHash, 'guidance embeds the snapshot it used + its hash')
  log(/as at 2026-05-18/.test(r.provenance) && /re-run/.test(r.provenance), 'provenance line states the data date + the re-run-if-changed rule')
}

console.log('\n── guidance is stamped (accumulation) ──')
{
  const r = solveAccumulation({ entity: MRT, goalSpec: goalSpec(MRT), opts: { now: NOW } })
  log(typeof r.asOf !== 'undefined' && r.snapshotHash, 'accumulation guidance is also stamped + hashed')
}

console.log('\n── the route is a function of the snapshot (changes with wealth) ──')
{
  const before = solveDecumulation({ entity: BRUCE, goalSpec: goalSpec(BRUCE), opts: { now: NOW } })
  // Halve the pension → different snapshot hash, and the ranking can shift.
  const poorer = { ...BRUCE, assets: { ...BRUCE.assets, sipp: { ...BRUCE.assets.sipp, total: 200000, pensions: [{ name: 'SIPP', type: 'SIPP', value: 200000 }] } } }
  const after = solveDecumulation({ entity: poorer, goalSpec: goalSpec(poorer), opts: { now: NOW } })
  log(before.snapshotHash !== after.snapshotHash, 'changed wealth → different snapshot hash on the guidance')
  log(before.snapshot.pots.pension !== after.snapshot.pots.pension, `route is computed from the snapshot (pension £${Math.round(before.snapshot.pots.pension/1000)}k → £${Math.round(after.snapshot.pots.pension/1000)}k)`)
}

console.log(`\nfinancial-snapshot — pass=${passes} fail=${fails}`)
process.exit(fails === 0 ? 0 : 1)
