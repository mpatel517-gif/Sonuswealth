// tests/l2-8-mrt-uirenderable.mjs
//
// L2-8 contract test: every mrT-* fixture must satisfy isUiRenderable
// (root-level `name` is a non-empty string). This is the gate
// PersonaSelect uses to decide whether a fixture can be loaded into the UI
// or whether it's "engine fixture, not UI-renderable yet."
//
// Run via `npm run test:l2-8-uirenderable`.

import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { netWorth, investable } from '../src/engine/fq-calculator.js'
import { detectSchema, warnIfLegacy } from '../src/engine/persona-normalizer.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const personasDir = join(__dirname, '..', 'src', 'rules', 'personas')

// Mirror of App.jsx:isUiRenderable — keep this in sync if App.jsx changes.
function isUiRenderable(entity) {
  if (!entity || typeof entity !== 'object') return false
  if (typeof entity.name === 'string' && entity.name.length > 0) return true
  return false
}

let fails = 0
let passes = 0
const log = (ok, msg) => {
  if (ok) { passes += 1; console.log(`✓ ${msg}`) }
  else    { fails  += 1; console.log(`✗ ${msg}`) }
}

const allMrT = (await readdir(personasDir))
  .filter(f => f.startsWith('mrT-') && f.endsWith('.json'))
  .sort()

console.log(`\n── Case 1 — isUiRenderable for all ${allMrT.length} mrT-* fixtures ──`)
for (const file of allMrT) {
  const raw = await readFile(join(personasDir, file), 'utf8')
  const e = JSON.parse(raw)
  log(isUiRenderable(e), `${file} → isUiRenderable (name='${e.name || '(none)'}')`)
}

// ── Case 2 — root.name matches individual.name (no semantic drift) ─────────
console.log('\n── Case 2 — root.name === individual.name (no drift) ──')
for (const file of allMrT) {
  const e = JSON.parse(await readFile(join(personasDir, file), 'utf8'))
  const indName = e.individual?.name
  if (!indName) {
    log(true, `${file} → no individual.name (skipped)`)
    continue
  }
  log(e.name === indName, `${file} → root='${e.name}' === individual='${indName}'`)
}

// ── Case 3 — engine still produces finite netWorth for every fixture ───────
console.log('\n── Case 3 — netWorth/investable still finite after migration ──')
for (const file of allMrT) {
  const e = JSON.parse(await readFile(join(personasDir, file), 'utf8'))
  const nw = netWorth(e)
  const inv = investable(e)
  const ok = Number.isFinite(nw) && Number.isFinite(inv) && inv >= 0
  log(ok, `${file} → netWorth=£${nw.toLocaleString('en-GB')} investable=£${inv.toLocaleString('en-GB')}`)
}

// ── Case 4 — root.dob present where individual.dob exists ──────────────────
console.log('\n── Case 4 — root.dob lifted where individual.dob exists ──')
for (const file of allMrT) {
  const e = JSON.parse(await readFile(join(personasDir, file), 'utf8'))
  const indDob = e.individual?.dob
  if (!indDob) { log(true, `${file} → no individual.dob (skipped)`); continue }
  log(e.dob === indDob, `${file} → root.dob='${e.dob}' === individual.dob='${indDob}'`)
}

// ── Case 5 — root.age computed or lifted where ages exist ──────────────────
console.log('\n── Case 5 — root.age present where computable ──')
for (const file of allMrT) {
  const e = JSON.parse(await readFile(join(personasDir, file), 'utf8'))
  const hasDob = e.individual?.dob || e.dob
  if (!hasDob && e.individual?.age == null) {
    log(true, `${file} → no age signal (skipped)`)
    continue
  }
  log(typeof e.age === 'number' && e.age > 0 && e.age < 120,
    `${file} → root.age=${e.age}`)
}

// ── Summary ───────────────────────────────────────────────────────────────
const total = passes + fails
console.log(`\n${'─'.repeat(67)}`)
console.log(`L2-8 mrT-UI-renderable test — pass=${passes} fail=${fails} total=${total}`)
console.log('═'.repeat(67))
process.exit(fails === 0 ? 0 : 1)
