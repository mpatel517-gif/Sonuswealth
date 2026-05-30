// l3-2-btl-portfolio.mjs — Node ESM tests for BTLPortfolioPanel.data.js
//
// ≥15 assertions covering:
//   - Output shape from buildBTLRows
//   - totalValue = sum of per-property values
//   - grossYield = totalGrossRent / totalValue
//   - Each property row carries an editableValue.path containing 'assets.property['
//   - Only let properties included (main-residence excluded)
//   - concentration in [0, 1]
//   - mrT-landlord (4 entries in assets.property[], 3 are BTL)
//   - persona-a (1 BTL property)
//   - $ref resolution works for mrT-landlord
//   - grossYield is a ratio (≤1 reasonable for BTL)

import { readFile }      from 'fs/promises'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { buildBTLRows }  from '../src/components/MyMoney/L3/L3Sections/BTLPortfolioPanel.data.js'

const __dirname    = dirname(fileURLToPath(import.meta.url))
const personasDir  = join(__dirname, '..', 'src', 'rules', 'personas')

let passes = 0
let fails  = 0
const log = (ok, msg) => {
  if (ok) { passes += 1; console.log(`✓ ${msg}`) }
  else    { fails  += 1; console.log(`✗ ${msg}`) }
}

async function loadPersona(file) {
  return JSON.parse(await readFile(join(personasDir, file), 'utf8'))
}

// ── Case 1 — output shape from buildBTLRows ───────────────────────────────────
console.log('\n── Case 1 — output shape ───────────────────────────────────────')
{
  const entity = { assets: { property: [] } }
  const r      = buildBTLRows(entity)
  log(Array.isArray(r.properties),     'properties is an array')
  log(typeof r.totalValue === 'number', 'totalValue is a number')
  log(typeof r.totalGrossRent === 'number', 'totalGrossRent is a number')
  log(typeof r.grossYield === 'number', 'grossYield is a number')
  log(typeof r.concentration === 'number', 'concentration is a number')
  log(r.properties.length === 0,       'empty entity → 0 properties')
  log(r.totalValue === 0,              'empty entity → totalValue = 0')
  log(r.grossYield === 0,              'empty entity → grossYield = 0')
}

// ── Case 2 — persona-a (1 BTL with isRental + rentalGrossAnnual) ─────────────
console.log('\n── Case 2 — persona-a (1 BTL) ──────────────────────────────────')
{
  const entity = await loadPersona('persona-a.json')
  const r      = buildBTLRows(entity)

  log(r.properties.length === 1, `persona-a: exactly 1 BTL property (got ${r.properties.length})`)

  const p = r.properties[0]
  log(p.value === 450_000,                   `persona-a: property value = £450,000 (got ${p.value})`)
  log(p.grossRent === 24_000,                `persona-a: grossRent = £24,000 (got ${p.grossRent})`)
  log(p.netRent === 19_200,                  `persona-a: netRent = £19,200 (got ${p.netRent})`)
  log(r.totalValue === 450_000,              `persona-a: totalValue = £450,000 (got ${r.totalValue})`)
  log(r.totalGrossRent === 24_000,           `persona-a: totalGrossRent = £24,000 (got ${r.totalGrossRent})`)

  const expectedYield = 24_000 / 450_000
  log(Math.abs(r.grossYield - expectedYield) < 0.0001,
    `persona-a: grossYield = ${(expectedYield*100).toFixed(4)}% (got ${(r.grossYield*100).toFixed(4)}%)`)

  log(r.concentration >= 0 && r.concentration <= 1,
    `persona-a: concentration in [0,1] (got ${r.concentration.toFixed(4)})`)

  log(
    p.editableValue?.path?.includes('assets.property['),
    `persona-a: editableValue.path includes 'assets.property[' (got '${p.editableValue?.path}')`,
  )
}

// ── Case 3 — mrT-landlord ($ref resolution, 3 BTL out of 4 entries) ──────────
console.log('\n── Case 3 — mrT-landlord (3 of 4 assets.property[] are BTL) ───')
{
  const entity = await loadPersona('mrT-landlord.json')
  const r      = buildBTLRows(entity)

  // assets.property[] has 4 entries: 1 main-residence + 3 $refs (btl-1, btl-2, hmo-1)
  log(r.properties.length === 3,
    `mrT-landlord: 3 BTL properties resolved (got ${r.properties.length})`)

  // totalValue = btl-1(185k) + btl-2(265k) + hmo-1(380k) = 830,000
  const expectedTotal = 185_000 + 265_000 + 380_000
  log(r.totalValue === expectedTotal,
    `mrT-landlord: totalValue = £${expectedTotal.toLocaleString()} (got £${r.totalValue.toLocaleString()})`)

  // totalGrossRent = 14,400 + 13,200 + 34,800 = 62,400
  const expectedGross = 14_400 + 13_200 + 34_800
  log(r.totalGrossRent === expectedGross,
    `mrT-landlord: totalGrossRent = £${expectedGross.toLocaleString()} (got £${r.totalGrossRent.toLocaleString()})`)

  const expectedYield = expectedGross / expectedTotal
  log(Math.abs(r.grossYield - expectedYield) < 0.0001,
    `mrT-landlord: grossYield = ${(expectedYield*100).toFixed(4)}% (got ${(r.grossYield*100).toFixed(4)}%)`)

  // Every property row must have an editableValue.path with 'assets.property['
  const allHaveEditablePath = r.properties.every(
    p => typeof p.editableValue?.path === 'string' && p.editableValue.path.includes('assets.property['),
  )
  log(allHaveEditablePath,
    'mrT-landlord: every property row has editableValue.path containing assets.property[')

  // REAL index check — idx must be the index in assets.property[], not filtered index.
  // assets.property[0] = main-residence, assets.property[1] = btl-1, etc.
  // So BTL rows must have idx ≥ 1.
  const minIdx = Math.min(...r.properties.map(p => p.idx))
  log(minIdx >= 1,
    `mrT-landlord: min BTL idx = ${minIdx} (should be ≥1 because index 0 is main-residence)`)

  log(r.concentration >= 0 && r.concentration <= 1,
    `mrT-landlord: concentration in [0,1] (got ${r.concentration.toFixed(4)})`)

  // Main residence excluded — verify by name/type
  const hasMainRes = r.properties.some(
    p => p.prop?.type === 'main-residence' || p.prop?.id === 'main-residence',
  )
  log(!hasMainRes, 'mrT-landlord: main-residence excluded from BTL rows')
}

// ── Case 4 — entity with no property array ────────────────────────────────────
console.log('\n── Case 4 — entity with no property array ───────────────────────')
{
  const entity = { assets: { sipp: { total: 100_000 } } }
  const r      = buildBTLRows(entity)
  log(r.properties.length === 0, 'no property array → 0 properties')
  log(r.grossYield === 0,        'no property array → grossYield = 0')
}

// ── Summary ───────────────────────────────────────────────────────────────────
const total = passes + fails
console.log(`\n${'─'.repeat(67)}`)
console.log(`L3-2 BTL portfolio panel — pass=${passes} fail=${fails} total=${total}`)
console.log('═'.repeat(67))
process.exit(fails === 0 ? 0 : 1)
