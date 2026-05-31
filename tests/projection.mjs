// tests/projection.mjs
// Contract test for the per-node projection engine (src/engine/projection.js) +
// the applyEvents includeScenarios split. Run: node tests/projection.mjs

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import {
  growthRateFor, projectValue, projectNode, projectTaxonomy,
} from '../src/engine/projection.js'
import { getBundle } from '../src/engine/_bundle.js'
import CMA from '../src/rules/cma-2026.json' with { type: 'json' }

getBundle()
const personasDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'rules', 'personas')
const loadP = async f => JSON.parse(await readFile(join(personasDir, f), 'utf8'))

let fails = 0, passes = 0
const log = (ok, m) => { ok ? (passes++, console.log('✓ ' + m)) : (fails++, console.log('✗ ' + m)) }
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e

// ── Task 1 — growthRateFor ──────────────────────────────────────────────────
console.log('\n── growthRateFor ──')
log(near(growthRateFor('pension-sipp', CMA), CMA.assetClasses.global_equity.expectedReturn), 'pension → global_equity')
log(near(growthRateFor('property-btl', CMA), CMA.assetClasses.property.expectedReturn), 'property → property')
log(near(growthRateFor('cash-savings', CMA), CMA.assetClasses.cash.expectedReturn), 'cash → cash')
log(near(growthRateFor('alt-crypto', CMA), CMA.assetClasses.alternatives.expectedReturn), 'alt → alternatives')
log(growthRateFor('totally-unknown', CMA) === CMA.growth, 'unknown → blended growth fallback')

// ── Task 2 — projectValue ───────────────────────────────────────────────────
console.log('\n── projectValue ──')
log(projectValue(100000, 0.05, 0) === 100000, 'years=0 → unchanged (baseline)')
log(Math.round(projectValue(100000, 0.05, 10)) === 162889, '£100k @5% 10y = £162,889')
log(projectValue(100000, 0.05, 10, 6000) > projectValue(100000, 0.05, 10), 'contributions raise result')
log(Number.isFinite(projectValue(100000, 0.05, 10, 6000)), 'finite with contributions')
log(projectValue(100000, 0.05, -3) === 100000, 'negative years clamps to now')

// ── Task 3 — projectNode ────────────────────────────────────────────────────
console.log('\n── projectNode ──')
log(projectNode({ value: 420000, type: 'pension-sipp' }, { currentAge: 62, horizonAge: 62 }) === 420000, 'horizon=now → unchanged')
log(projectNode({ value: 420000, type: 'pension-sipp' }, { currentAge: 62, horizonAge: 72, cma: CMA }) > 420000, 'pension grows 10y')
{
  const liab = { value: 200000, type: 'mortgage-residence', monthlyPayment: 1200, rate: 0.04 }
  const f = projectNode(liab, { currentAge: 40, horizonAge: 50, direction: 'shrink' })
  log(f < 200000, 'mortgage shrinks toward horizon')
  log(f >= 0, 'never negative')
}

// ── Task 4 — projectTaxonomy ────────────────────────────────────────────────
console.log('\n── projectTaxonomy ──')
{
  const e = await loadP('persona-a.json')
  const r = projectTaxonomy(e, { horizonAge: e.age ?? 62, cma: CMA })  // horizon == now
  log(r.totals.now > 0, `now total > 0 (£${Math.round(r.totals.now).toLocaleString()})`)
  log(r.totals.future === r.totals.now, 'horizon=now → future === now (baseline)')
  log(r.totals.plan === r.totals.future, 'plan === future (no committed scenarios)')
}
{
  const e = await loadP('persona-c.json')
  const r = projectTaxonomy(e, { horizonAge: 85, cma: CMA })
  log(r.totals.future > r.totals.now, `future > now over horizon (£${Math.round(r.totals.future).toLocaleString()} > £${Math.round(r.totals.now).toLocaleString()})`)
  log(Number.isFinite(r.totals.future), 'future finite')
  log(Array.isArray(r.byNode) && r.byNode.length > 0, `byNode populated (${r.byNode.length} nodes)`)
}

// NOTE: the Future-vs-Plan event-class split (applyEvents includeScenarios) is
// deferred to 1d/1f where Plan is actually computed — applyEvents lives in the
// JSX provider file and isn't Node-importable. projectTaxonomy already accepts a
// pre-folded `planEntity`, so the engine here stays pure + Node-tested.

const total = passes + fails
console.log(`\n${'─'.repeat(60)}\nprojection engine — pass=${passes} fail=${fails} total=${total}\n${'═'.repeat(60)}`)
process.exit(fails === 0 ? 0 : 1)
