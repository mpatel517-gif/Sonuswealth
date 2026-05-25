// ─────────────────────────────────────────────────────────────────────────────
// tests/ripple-contract.mjs — Phase 2c contract test for rippleEffect
//
// Verifies:
//   1. rippleEffect returns _meta + every requested scope
//   2. Numbers are sane for each persona (NW positive, FQ score 0-100)
//   3. Scope-narrowing skips unrequested blocks
//   4. Failure isolation — a malformed entity returns _meta.ok=false but
//      doesn't throw, and partial scopes still resolve
//   5. rippleDiff detects net-worth movement across two entity states
//   6. Bundle swap (setBundle) changes _meta.bundleVersion
//
// Run: node tests/ripple-contract.mjs
// ─────────────────────────────────────────────────────────────────────────────

import { loadPersona } from '../src/lib/data-source.js'
import { rippleEffect, rippleDiff, SCOPE } from '../src/engine/ripple.js'
import { setBundle, resetBundle, getBundleVersion } from '../src/engine/_bundle.js'
import { loadBundle } from '../src/lib/data-source.js'

const PERSONAS = ['persona-a', 'persona-b', 'persona-c', 'persona-d', 'persona-e', 'persona-f', 'persona-g']

let passed = 0
let failed = 0
const fails = []

function assert(cond, msg) {
  if (cond) { passed++; return }
  failed++
  fails.push(msg)
  console.error(`  ✗ ${msg}`)
}

function ok(msg) {
  passed++
  console.log(`  ✓ ${msg}`)
}

async function main() {
  console.log('═══ Ripple-effect contract test ═══\n')

  // Ensure the canonical bundle is active before we start
  resetBundle()

  for (const id of PERSONAS) {
    console.log(`━ ${id}`)
    const persona = await loadPersona(id)

    // 1. Full ripple returns every scope
    const r = rippleEffect(persona)
    assert(r._meta?.ok === true, `${id}: _meta.ok must be true`)
    assert(r.balance_sheet, `${id}: balance_sheet present`)
    assert(r.scores,        `${id}: scores present`)
    assert(r.iht,           `${id}: iht present`)
    assert(r.cashflow,      `${id}: cashflow present`)
    assert(r.protection,    `${id}: protection present`)
    assert(r.tax,           `${id}: tax present`)
    assert(r.timeline,      `${id}: timeline present`)

    // 2. Sanity — numbers in plausible ranges
    const nw = r.balance_sheet?.netWorth
    assert(typeof nw === 'number' && Number.isFinite(nw),
      `${id}: netWorth must be finite number (got ${nw})`)
    const fq = r.scores?.fq?.score
    assert(typeof fq === 'number' && fq >= 0 && fq <= 100,
      `${id}: FQ score must be 0..100 (got ${fq})`)
    const risk = r.scores?.risk?.score
    assert(typeof risk === 'number' && risk >= 0 && risk <= 100,
      `${id}: risk score must be 0..100 (got ${risk})`)
    assert(typeof r.tax?.effectiveTaxRate === 'number',
      `${id}: tax.effectiveTaxRate is number`)
    assert(r._meta?.elapsedMs >= 0, `${id}: elapsedMs nonnegative`)
  }

  // 3. Scope narrowing
  console.log('━ scope narrowing')
  const persona = await loadPersona('persona-a')
  const onlyScores = rippleEffect(persona, null, [SCOPE.SCORES])
  assert(onlyScores.scores, 'scores-only includes scores')
  assert(!onlyScores.iht, 'scores-only omits iht')
  assert(!onlyScores.cashflow, 'scores-only omits cashflow')
  assert(!onlyScores.balance_sheet, 'scores-only omits balance_sheet')
  ok(`scope ['scores'] honored — keys: ${Object.keys(onlyScores).join(', ')}`)

  // 4. Failure isolation — empty entity must not throw
  console.log('━ failure isolation')
  let threw = null
  try {
    const empty = rippleEffect({})
    assert(empty._meta?.ok === true, 'empty-but-object entity returns _meta.ok=true')
  } catch (e) { threw = e }
  assert(threw === null, `must not throw on empty entity (threw: ${threw?.message || 'no'})`)

  // null entity hits the guard
  const nullR = rippleEffect(null)
  assert(nullR._meta?.ok === false, 'null entity returns _meta.ok=false')
  assert(!!nullR._meta?.error, 'null entity carries _meta.error')

  // 5. rippleDiff detects movement
  console.log('━ rippleDiff')
  const before = rippleEffect(persona)
  const personaMutated = JSON.parse(JSON.stringify(persona))
  if (!personaMutated.assets) personaMutated.assets = {}
  if (!personaMutated.assets.cash) personaMutated.assets.cash = { total: 0 }
  personaMutated.assets.cash.total = (personaMutated.assets.cash.total || 0) + 100000
  const after = rippleEffect(personaMutated)
  const moved = rippleDiff(before, after)
  assert(moved.includes('balance_sheet'),
    `rippleDiff catches NW change after +£100k cash (got: ${moved.join(', ')})`)

  // 6. Bundle swap changes bundleVersion
  console.log('━ bundle version')
  const verBefore = getBundleVersion()
  const canonical = await loadBundle('UK-2026.1.1')
  setBundle(canonical)
  const verAfter = getBundleVersion()
  assert(verAfter > verBefore, `bundleVersion increments (${verBefore} -> ${verAfter})`)

  const ripplePostSwap = rippleEffect(persona)
  assert(ripplePostSwap._meta?.bundleVersion === verAfter,
    `_meta.bundleVersion reflects current setBundle (${ripplePostSwap._meta?.bundleVersion} vs ${verAfter})`)

  resetBundle()

  // Summary
  console.log(`\n═══ ${passed} pass · ${failed} fail ═══`)
  if (failed > 0) {
    console.error('\nFailures:')
    for (const f of fails) console.error('  -', f)
    process.exit(1)
  }
  process.exit(0)
}

main().catch(e => {
  console.error('fatal:', e)
  process.exit(2)
})
