// scripts/migrate-mrT-l2-8.mjs
//
// L2-8 fixture migration: lift `individual.{name,dob,age}` to root level on
// every mrT-* fixture so it satisfies App.jsx:isUiRenderable() (which checks
// `typeof entity.name === 'string'`). Engine-only fixtures previously stored
// all identity under `individual.*` per the engine-test convention; this
// brings them into the UI-renderable family so PersonaSelect can load them.
//
// Idempotent: skips files where root already has name. Does NOT mutate
// `individual.*` — the engine-test shape stays intact for back-compat.
//
// Computes `age` from `individual.dob` when age is absent everywhere.
//
// Run via: node scripts/migrate-mrT-l2-8.mjs

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const personasDir = join(__dirname, '..', 'src', 'rules', 'personas')

function yearsBetween(dob, to = new Date()) {
  if (!dob) return null
  const d = dob instanceof Date ? dob : new Date(dob)
  if (Number.isNaN(d.getTime())) return null
  const diff = to - d
  if (diff < 0) return 0
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))
}

const files = (await readdir(personasDir))
  .filter(f => f.startsWith('mrT-') && f.endsWith('.json'))

let migrated = 0
let skipped = 0
const report = []

for (const file of files) {
  const path = join(personasDir, file)
  const raw = await readFile(path, 'utf8')
  const json = JSON.parse(raw)

  const ind = json.individual || {}
  const hasRootName = typeof json.name === 'string' && json.name.length > 0
  const hasRootDob  = typeof json.dob  === 'string' && json.dob.length  > 0
  const hasRootAge  = typeof json.age  === 'number' && Number.isFinite(json.age)

  const wantedName = hasRootName ? json.name : ind.name
  const wantedDob  = hasRootDob  ? json.dob  : ind.dob
  const wantedAge  = hasRootAge  ? json.age  : (ind.age ?? yearsBetween(wantedDob))

  // Nothing to lift / no individual fallback either → skip
  if ((typeof wantedName !== 'string' || wantedName.length === 0) && !hasRootName) {
    report.push(`SKIP    ${file}  (no name to lift)`)
    skipped += 1
    continue
  }

  // No-op when all three already present at root
  if (hasRootName && hasRootDob && hasRootAge) {
    report.push(`NOOP    ${file}  (root already has name+dob+age)`)
    skipped += 1
    continue
  }

  // Rebuild: lifted fields first then spread, so migration is visible at top.
  // We strip the old top-level versions before re-spreading to avoid duplicate
  // keys (JSON serialiser will keep the later one but lint-friendliness matters).
  const { name: _omitN, dob: _omitD, age: _omitA, ...rest } = json
  const next = {
    name: wantedName,
    ...(wantedDob ? { dob: wantedDob } : {}),
    ...(Number.isFinite(wantedAge) ? { age: wantedAge } : {}),
    ...rest,
  }

  await writeFile(path, JSON.stringify(next, null, 2) + '\n', 'utf8')
  migrated += 1
  const action = hasRootName ? 'BACKFILL' : 'LIFT'
  report.push(`${action} ${file}  → name='${wantedName}' dob='${wantedDob ?? '?'}' age=${wantedAge ?? '?'}`)
}

console.log('L2-8 mrT migration report\n' + '─'.repeat(67))
report.forEach(line => console.log(line))
console.log('─'.repeat(67))
console.log(`migrated=${migrated} skipped=${skipped} total=${files.length}`)
