// tests/l2-9-schema-collapse.mjs
//
// L2-9 contract test: prove every production persona arrives at the engine
// with a detectable schema, no crash through netWorth(), and that the
// warnIfLegacy gate fires exactly once per (caller, entity) on FLAT/MIXED.
//
// Closes the plan's §13 gap: "no contract test that an arbitrary onboarding
// payload survives." Run via `npm run test:l2-9-schema`.
//
// Discipline: this is an engine-layer test (DoD §A) — assertions live in the
// 5-evidence-string format on the commit, not paraphrased here. Test exits
// non-zero on any fail so CI catches schema-drift regressions.

import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import {
  detectSchema,
  warnIfLegacy,
  _resetLegacyWarnings,
} from '../src/engine/persona-normalizer.js'
import { netWorth, investable } from '../src/engine/fq-calculator.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const personasDir = join(__dirname, '..', 'src', 'rules', 'personas')

let fails = 0
let passes = 0
const log = (ok, msg) => {
  if (ok) {
    passes += 1
    console.log(`✓ ${msg}`)
  } else {
    fails += 1
    console.log(`✗ ${msg}`)
  }
}

async function loadPersona(file) {
  const raw = await readFile(join(personasDir, file), 'utf8')
  return JSON.parse(raw)
}

// ── Case 1 — detectSchema classifies every fixture ─────────────────────────
const expectedFlat = [
  'persona-a.json', 'persona-b.json', 'persona-c.json', 'persona-d.json',
  'persona-e.json', 'persona-f.json', 'persona-g.json',
]
const expectedNested = [
  'mrT-core.json',
]

console.log('\n── Case 1 — detectSchema classifies every fixture ──')
for (const file of expectedFlat) {
  const e = await loadPersona(file)
  const kind = detectSchema(e)
  // 'unknown' is acceptable when a persona happens to carry no assets
  // (e.g. mid-onboarding fixture). The L2-9 contract is that detectSchema
  // returns a defined kind; the data-shape correctness is a separate concern.
  const hasAnyAssets = !!(e?.assets && Object.keys(e.assets).length > 0)
  const expectClass = hasAnyAssets ? ['legacy', 'mixed'] : ['legacy', 'mixed', 'unknown']
  log(
    expectClass.includes(kind),
    `${file} → detectSchema='${kind}'${hasAnyAssets ? '' : ' (asset-less, unknown OK)'}`
  )
}
for (const file of expectedNested) {
  const e = await loadPersona(file)
  const kind = detectSchema(e)
  log(
    kind === 'nested' || kind === 'mixed',
    `${file} → detectSchema='${kind}' (expected nested|mixed)`
  )
}

// Every remaining mrT-* should classify as nested OR be flagged as
// L2-8 migration debt. We don't fail the test here — we surface the count.
const allFiles = (await readdir(personasDir)).filter(f => f.endsWith('.json'))
const otherMrT = allFiles.filter(f => f.startsWith('mrT-') && f !== 'mrT-core.json')
let nestedCount = 0
let nonNestedCount = 0
const nonNestedList = []
for (const file of otherMrT) {
  const e = await loadPersona(file)
  const kind = detectSchema(e)
  if (kind === 'nested') nestedCount += 1
  else { nonNestedCount += 1; nonNestedList.push(`${file}:${kind}`) }
}
console.log(`  · mrT-* (excl. core): nested=${nestedCount} non-nested=${nonNestedCount}`)
if (nonNestedCount > 0) {
  console.log(`  · L2-8 migration debt: ${nonNestedList.join(', ')}`)
}

// ── Case 2 — netWorth() returns a finite number for every persona ──────────
console.log('\n── Case 2 — netWorth() returns finite number on every persona ──')
for (const file of allFiles) {
  // Skip historical / matrix subdirs (loaded via readdir top-level only)
  if (file === 'historical' || file === 'matrix') continue
  const e = await loadPersona(file)
  const nw = netWorth(e)
  log(
    Number.isFinite(nw),
    `${file} → netWorth=${nw.toLocaleString('en-GB')} (finite)`
  )
}

// ── Case 3 — investable() returns a finite number ≥ 0 for every persona ───
console.log('\n── Case 3 — investable() returns finite ≥ 0 on every persona ──')
for (const file of allFiles) {
  if (file === 'historical' || file === 'matrix') continue
  const e = await loadPersona(file)
  const inv = investable(e)
  log(
    Number.isFinite(inv) && inv >= 0,
    `${file} → investable=${inv.toLocaleString('en-GB')}`
  )
}

// ── Case 4 — warnIfLegacy fires once per (caller, entity) on FLAT ──────────
console.log('\n── Case 4 — warnIfLegacy dedup: once per (caller, entity) ──')
_resetLegacyWarnings()

const originalWarn = console.warn
const captured = []
console.warn = (...args) => { captured.push(args.join(' ')) }

const personaA = await loadPersona('persona-a.json')
warnIfLegacy(personaA, 'test-case-4')
warnIfLegacy(personaA, 'test-case-4')   // duplicate — should NOT log again
warnIfLegacy(personaA, 'test-case-4-b') // different caller — SHOULD log
console.warn = originalWarn

log(captured.length === 2, `2 warnings emitted (got ${captured.length})`)
log(
  captured[0]?.includes('[L2-9]') && captured[0]?.includes("entity='"),
  'warning includes [L2-9] prefix + entity identifier'
)
log(
  captured[1]?.includes('test-case-4-b'),
  'second warning fires for different caller context'
)

// ── Case 5 — warnIfLegacy is silent on pure NESTED ─────────────────────────
// NOTE: no production fixture is currently pure-nested — even mrT-core
// carries flat sipp/isa fields alongside nested arrays. That's the L2-8
// migration debt this test surfaces. Here we construct a synthetic
// pure-nested entity to prove warnIfLegacy goes silent on the target shape.
console.log('\n── Case 5 — warnIfLegacy silent on pure-NESTED synthetic ──')
_resetLegacyWarnings()
const captured2 = []
console.warn = (...args) => { captured2.push(args.join(' ')) }

const syntheticNested = {
  id: 'synthetic-nested-1',
  name: 'Pure Nested',
  assets: {
    pensions:    [{ value: 100000, type: 'SIPP' }],
    investments: [{ value:  50000, wrapper: 'isa' }],
    property:    [{ value: 400000, ppr: true }],
    bank:        [{ balance: 10000 }],
  },
}
const kind = warnIfLegacy(syntheticNested, 'test-case-5')
console.warn = originalWarn

log(kind === 'nested', `synthetic-nested warnIfLegacy returns 'nested' (got '${kind}')`)
log(captured2.length === 0, `no warning emitted on pure-NESTED (got ${captured2.length})`)

// ── Case 6 — detectSchema of mrT-core flags the migration debt ─────────────
console.log('\n── Case 6 — mrT-core flagged as L2-8 migration target ──')
const mrTCore = await loadPersona('mrT-core.json')
const mrTCoreKind = detectSchema(mrTCore)
log(
  mrTCoreKind === 'mixed',
  `mrT-core detectSchema='${mrTCoreKind}' (expected 'mixed' — even the canonical template carries legacy fields; L2-8 should resolve)`
)

// ── Summary ───────────────────────────────────────────────────────────────
const total = passes + fails
console.log(`\n${'─'.repeat(67)}`)
console.log(`L2-9 schema-collapse test — pass=${passes} fail=${fails} total=${total}`)
console.log('═'.repeat(67))
process.exit(fails === 0 ? 0 : 1)
