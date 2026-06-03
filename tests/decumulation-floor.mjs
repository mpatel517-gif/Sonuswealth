// tests/decumulation-floor.mjs — P1/P3 secure-income floor in the solve output +
// the SECURE-INCOME network node + excluded/flagged nodes. Resolves the founder's
// bug: the old map implied every pound of income came from drawable pots.
import assert from 'node:assert'
import { solveDecumulation } from '../src/engine/decumulation-solver.js'
import { goalSpec } from '../src/engine/goal-engine.js'
import { readFileSync } from 'node:fs'

let pass = 0, fail = 0
const t = (n, fn) => { try { fn(); pass++; console.log('✓', n) } catch (e) { fail++; console.log('✗', n, '\n   ', e.message) } }
const BRUCE = JSON.parse(readFileSync(new URL('../src/rules/personas/persona-a.json', import.meta.url)))

const gs = goalSpec(BRUCE, { goals: [
  { type: 'income_floor', priority: 1, target: { income: 96000 } },
  { type: 'min_lifetime_tax', priority: 2 },
] })
const r = solveDecumulation({ entity: BRUCE, goalSpec: gs, opts: { now: new Date('2026-06-02') } })

t('solve output carries a secure-income floor', () => {
  assert.ok(r.floor, 'floor present')
  assert.equal(r.floor.grossAnnual, 31173, `state pension £11,973 + BTL net rent £19,200, got ${r.floor.grossAnnual}`)
  assert.ok(r.floor.streams.length >= 2, 'floor itemises its streams')
})
t('residualNeed is target minus the floor — not the whole target', () => {
  assert.ok(r.floor.residualNeed > 0, 'residual exists')
  assert.ok(r.floor.residualNeed < 96000, `residual < target, got ${r.floor.residualNeed}`)
  assert.ok(r.floor.netAnnual > 0 && r.floor.netAnnual <= r.floor.grossAnnual, 'net floor sane')
})
t('network has a SECURE-INCOME node flowing into income', () => {
  const secure = r.network.nodes.find(n => n.kind === 'secure')
  assert.ok(secure, 'secure node present')
  assert.equal(secure.value, 31173, `secure node value, got ${secure?.value}`)
  assert.ok(r.network.edges.some(e => e.from === 'secure-income' && e.to === 'income' && e.kind === 'floor'), 'floor edge present')
})
t('residence is shown but excluded (not a drawdown source)', () => {
  const res = r.network.nodes.find(n => n.kind === 'excluded' && n.label === 'RESIDENCE')
  assert.ok(res, 'residence shown as excluded node')
})
t('pot nodes still present (legacy network contract intact)', () => {
  assert.ok(r.network.nodes.some(n => n.id === 'pension'), 'pension pot node present')
  assert.ok(r.network.alternatives.length >= 1, 'alternatives present')
})

console.log(`\ndecumulation-floor — pass=${pass} fail=${fail}`)
if (fail) process.exit(1)
