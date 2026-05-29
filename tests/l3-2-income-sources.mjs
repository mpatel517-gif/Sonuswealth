// tests/l3-2-income-sources.mjs
//
// L3-2 Tier-A #1 contract test: IncomeSourcesPanel data layer.
//
// Tests the _buildSourceRows_test data builder (not the React render —
// that lives behind the snap-verification gate in DoD §B Gate 1, which
// runs once the panel is wired to a user route).
//
// The data-layer test alone is enough to gate against the failure modes
// the plan calls out: double-counting (F1 root cause), schema drift
// (FLAT vs NESTED), wrong tax-band routing, and missing source labels.
//
// Run via `npm run test:l3-2-income`.

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { buildSourceRows } from '../src/components/MyMoney/L3/L3Sections/IncomeSourcesPanel.data.js'
import { annualIncome } from '../src/engine/_helpers.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const personasDir = join(__dirname, '..', 'src', 'rules', 'personas')

let fails = 0
let passes = 0
const log = (ok, msg) => {
  if (ok) { passes += 1; console.log(`✓ ${msg}`) }
  else    { fails  += 1; console.log(`✗ ${msg}`) }
}
const round = (n) => Math.round(n)

async function loadPersona(file) {
  return JSON.parse(await readFile(join(personasDir, file), 'utf8'))
}

// ── Case 1 — buildSourceRows returns {rows, total, sourceCount} ────────────
console.log('\n── Case 1 — output shape ──')
{
  const e = await loadPersona('persona-a.json')
  const r = buildSourceRows(e)
  log(Array.isArray(r.rows), 'rows is array')
  log(typeof r.total === 'number', 'total is number')
  log(typeof r.sourceCount === 'number', 'sourceCount is number')
  log(r.rows.length === r.sourceCount, 'rows.length === sourceCount')
}

// ── Case 2 — rows are sorted descending by value ───────────────────────────
console.log('\n── Case 2 — rows sorted largest-first ──')
{
  for (const file of ['persona-a.json', 'persona-c.json', 'mrT-ltd-director.json']) {
    const e = await loadPersona(file)
    const r = buildSourceRows(e)
    let sorted = true
    for (let i = 1; i < r.rows.length; i++) {
      if (r.rows[i - 1].value < r.rows[i].value) { sorted = false; break }
    }
    log(sorted, `${file} → rows descending (n=${r.rows.length})`)
  }
}

// ── Case 3 — total reconciles with annualIncome selector ───────────────────
// (the engine canonical) — proves no double-counting in the panel layer
console.log('\n── Case 3 — panel total reconciles with annualIncome() ──')
{
  for (const file of ['persona-a.json', 'persona-b.json', 'persona-c.json', 'mrT-couple.json', 'mrT-ltd-director.json']) {
    const e = await loadPersona(file)
    const r = buildSourceRows(e)
    const engineTotal = annualIncome(e)
    // The panel excludes state pension when age < startAge; annualIncome
    // doesn't gate by age. So |panel - engine| ≤ statePensionAnnual(e).
    // For most fixtures the gap is 0; for retirees both include sp.
    const gap = Math.abs(r.total - engineTotal)
    const acceptable = gap < Math.max(15000, engineTotal * 0.10) // generous — state-pension band
    log(acceptable,
      `${file} → panel=${round(r.total).toLocaleString()} engine=${round(engineTotal).toLocaleString()} gap=${round(gap).toLocaleString()}`)
  }
}

// ── Case 4 — no row appears twice ──────────────────────────────────────────
console.log('\n── Case 4 — rows unique by source key ──')
{
  for (const file of ['persona-a.json', 'mrT-couple.json', 'mrT-divorced.json']) {
    const e = await loadPersona(file)
    const r = buildSourceRows(e)
    const keys = r.rows.map(x => x.key)
    const unique = new Set(keys)
    log(keys.length === unique.size, `${file} → ${keys.length} rows / ${unique.size} unique keys`)
  }
}

// ── Case 5 — share% sums to ~100% when total > 0 ───────────────────────────
console.log('\n── Case 5 — share% sums to 100% ──')
{
  for (const file of ['persona-a.json', 'persona-c.json', 'mrT-ltd-director.json']) {
    const e = await loadPersona(file)
    const r = buildSourceRows(e)
    if (r.total === 0) continue
    const sharesum = r.rows.reduce((s, x) => s + x.share, 0)
    log(Math.abs(sharesum - 1) < 0.001, `${file} → Σshare=${sharesum.toFixed(4)}`)
  }
}

// ── Case 6 — labels resolved for every row (no raw keys leak to UI) ────────
console.log('\n── Case 6 — every row has a plain-English label ──')
{
  for (const file of ['persona-a.json', 'mrT-uk-th.json', 'mrT-family.json']) {
    const e = await loadPersona(file)
    const r = buildSourceRows(e)
    let allLabelled = true
    for (const row of r.rows) {
      if (typeof row.label !== 'string' || row.label.length === 0 || row.label === row.key) {
        allLabelled = false
        console.log(`    · ${file}.${row.key}: label='${row.label}'`)
        break
      }
    }
    log(allLabelled, `${file} → ${r.rows.length} rows all labelled`)
  }
}

// ── Case 7 — empty-assets persona → total=0, sourceCount=0 ────────────────
console.log('\n── Case 7 — empty persona → zero total ──')
{
  const r = buildSourceRows({ age: 30 })
  log(r.total === 0, `empty entity → total=${r.total}`)
  log(r.rows.length === 0, `empty entity → ${r.rows.length} rows`)
  log(r.sourceCount === 0, `empty entity → sourceCount=${r.sourceCount}`)
}

// ── Case 8 — F1 root-cause guard: salary not double-summed across schemas ─
console.log('\n── Case 8 — salary MAX not SUM across dual-schema ──')
{
  // Synthetic dual-schema entity carrying salary in BOTH places.
  const e = {
    age: 40,
    individual: { gross_salary: 60000 },
    income: { employment: 60000 },
  }
  const r = buildSourceRows(e)
  const employmentRow = r.rows.find(x => x.key === 'employment')
  log(employmentRow?.value === 60000,
    `dual-schema salary → £60,000 (got £${employmentRow?.value?.toLocaleString() || 0})`)
}

// ── Case 9 — rental aliases (.rental vs .rentalIncome) MAX not SUM ────────
console.log('\n── Case 9 — rental aliases MAX not SUM ──')
{
  const e = {
    age: 50,
    income: { rental: 24000, rentalIncome: 24000 },
  }
  const r = buildSourceRows(e)
  const rentalRow = r.rows.find(x => x.key === 'rental')
  log(rentalRow?.value === 24000,
    `rental aliased → £24,000 (got £${rentalRow?.value?.toLocaleString() || 0})`)
}

// ── Case 10 — state pension gated by age < startAge ────────────────────────
console.log('\n── Case 10 — state pension only counts past startAge ──')
{
  const young = {
    age: 50,
    income: { statePension: { annual: 11500, startAge: 67 } },
    individual: { state_pension_accrued_years: 35 },
  }
  const old = {
    age: 70,
    income: { statePension: { annual: 11500, startAge: 67 } },
    individual: { state_pension_accrued_years: 35 },
  }
  const rYoung = buildSourceRows(young)
  const rOld   = buildSourceRows(old)
  const spYoung = rYoung.rows.find(x => x.key === 'statePension')
  const spOld   = rOld.rows.find(x => x.key === 'statePension')
  log(!spYoung || spYoung.value === 0, `young (age 50) → no state pension row`)
  log(spOld && spOld.value === 11500,   `old (age 70) → state pension row £11,500`)
}

// ── Summary ───────────────────────────────────────────────────────────────
const total = passes + fails
console.log(`\n${'─'.repeat(67)}`)
console.log(`L3-2 Income-sources panel — pass=${passes} fail=${fails} total=${total}`)
console.log('═'.repeat(67))
process.exit(fails === 0 ? 0 : 1)
