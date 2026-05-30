// tests/l3-2-tax-obligations.mjs
//
// L3 Tax-obligations panel — data layer contract test.
//
// Tests the buildTaxRows pure builder (no React — JSX excluded by design).
// Mirrors the pattern established in tests/l3-2-income-sources.mjs.
//
// Run: node tests/l3-2-tax-obligations.mjs
// Exits non-zero when any assertion fails.

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { buildTaxRows } from '../src/components/MyMoney/L3/L3Sections/TaxObligationsPanel.data.js'
import { incomeTaxDetail, nicsDetail, dividendTaxDetail } from '../src/engine/tax-estate-engine.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const personasDir = join(__dirname, '..', 'src', 'rules', 'personas')

let fails = 0
let passes = 0
const log = (ok, msg) => {
  if (ok) { passes += 1; console.log(`✓ ${msg}`) }
  else    { fails  += 1; console.log(`✗ ${msg}`) }
}

async function loadPersona(file) {
  return JSON.parse(await readFile(join(personasDir, file), 'utf8'))
}

// ── Case 1 — output shape ─────────────────────────────────────────────────────
console.log('\n── Case 1 — output shape ──')
{
  const e = await loadPersona('persona-a.json')
  const r = buildTaxRows(e)
  log(Array.isArray(r.rows),          'rows is array')
  log(typeof r.total === 'number',    'total is number')
  log(typeof r.typeCount === 'number', 'typeCount is number')
  log(r.rows.length >= 0,             'rows.length is non-negative')
  log(r.total >= 0,                   'total is non-negative')
}

// ── Case 2 — every row has required fields ────────────────────────────────────
console.log('\n── Case 2 — row schema ──')
{
  const e = await loadPersona('persona-a.json')
  const r = buildTaxRows(e)
  let allValid = true
  for (const row of r.rows) {
    if (
      typeof row.key !== 'string' ||
      typeof row.label !== 'string' ||
      typeof row.value !== 'number' ||
      typeof row.fmtValue !== 'string'
    ) { allValid = false; break }
  }
  log(allValid, 'all rows have key, label, value, fmtValue fields')
}

// ── Case 3 — rows sorted descending by value ──────────────────────────────────
console.log('\n── Case 3 — rows sorted largest-first ──')
{
  for (const file of ['persona-a.json', 'persona-c.json', 'mrT-ltd-director.json']) {
    const e = await loadPersona(file)
    const r = buildTaxRows(e)
    let sorted = true
    for (let i = 1; i < r.rows.length; i++) {
      if (r.rows[i - 1].value < r.rows[i].value) { sorted = false; break }
    }
    log(sorted, `${file} → rows descending (n=${r.rows.length})`)
  }
}

// ── Case 4 — total reconciles with engine selectors ───────────────────────────
console.log('\n── Case 4 — total reconciles with engine selectors ──')
{
  for (const file of ['persona-a.json', 'persona-b.json', 'persona-c.json', 'mrT-ltd-director.json']) {
    const e = await loadPersona(file)
    const r = buildTaxRows(e)

    const detail = incomeTaxDetail(e)
    const nics   = nicsDetail(e)
    const divd   = dividendTaxDetail(e)
    const engineTotal = (detail?.total_tax ?? 0) + (nics?.total_nic ?? 0) + (divd?.tax_paid ?? 0)

    const gap = Math.abs(r.total - engineTotal)
    log(gap === 0, `${file} → panel total £${r.total.toLocaleString()} = engine £${engineTotal.toLocaleString()} (gap=${gap})`)
  }
}

// ── Case 5 — no row key duplicates ────────────────────────────────────────────
console.log('\n── Case 5 — rows unique by key ──')
{
  for (const file of ['persona-a.json', 'mrT-ltd-director.json', 'mrT-couple.json']) {
    const e = await loadPersona(file)
    const r = buildTaxRows(e)
    const keys   = r.rows.map(x => x.key)
    const unique = new Set(keys)
    log(keys.length === unique.size, `${file} → ${keys.length} rows / ${unique.size} unique keys`)
  }
}

// ── Case 6 — labels are plain-English (no raw jargon as a label) ─────────────
console.log('\n── Case 6 — labels contain no raw jargon ──')
{
  const JARGON_RE = /^(UEL|PA|NIC|PAYE|Class 1|Class 4|S24|ART|BR|HR|AR|BRL|BRT)$/
  for (const file of ['persona-a.json', 'persona-c.json', 'mrT-ltd-director.json']) {
    const e = await loadPersona(file)
    const r = buildTaxRows(e)
    let clean = true
    for (const row of r.rows) {
      if (JARGON_RE.test(row.label)) {
        clean = false
        console.log(`    · ${file} label='${row.label}'`)
        break
      }
    }
    log(clean, `${file} → no raw jargon label`)
  }
}

// ── Case 7 — empty entity → safe zeros, no throw ─────────────────────────────
console.log('\n── Case 7 — empty entity → zero total, no crash ──')
{
  let result
  let threw = false
  try { result = buildTaxRows({}) } catch (err) { threw = true; console.log('    · threw:', err.message) }
  log(!threw,                    'empty entity → no exception')
  log(result?.total === 0,       `empty entity → total=${result?.total}`)
  log(typeof result?.typeCount === 'number', `empty entity → typeCount is number`)
}

// ── Case 8 — entity with only salary → income-tax row present ────────────────
console.log('\n── Case 8 — salary entity has income-tax row ──')
{
  const e = { age: 40, income: { salary: 50000 } }
  const r = buildTaxRows(e)
  const itRow = r.rows.find(x => x.key === 'incomeTax')
  log(itRow != null,     'income-tax row present for salary entity')
  log(itRow?.value > 0,  `income-tax value > 0 (got ${itRow?.value})`)
}

// ── Case 9 — entity with salary → NIC row present ────────────────────────────
console.log('\n── Case 9 — salary entity has NIC row ──')
{
  const e = { age: 40, income: { salary: 50000 } }
  const r = buildTaxRows(e)
  const nicRow = r.rows.find(x => x.key === 'nic')
  log(nicRow != null,    'NIC row present for salary entity')
  log(nicRow?.value > 0, `NIC value > 0 (got ${nicRow?.value})`)
}

// ── Case 10 — bands present in incomeTaxDetail when income > 0 ───────────────
console.log('\n── Case 10 — incomeTaxDetail bands present when income > 0 ──')
{
  const e = { age: 40, income: { salary: 50000 } }
  const detail = incomeTaxDetail(e)
  log(Array.isArray(detail?.bands),    'bands is array')
  log(detail.bands.length > 0,         `bands.length=${detail.bands.length} > 0`)
  const anyTax = detail.bands.some(b => b.tax > 0)
  log(anyTax, 'at least one band has tax > 0')
}

// ── Case 11 — total_tax in incomeTaxDetail equals sum of band taxes ───────────
console.log('\n── Case 11 — total_tax reconciles with band sum ──')
{
  for (const file of ['persona-a.json', 'persona-c.json', 'mrT-ltd-director.json']) {
    const e = await loadPersona(file)
    const detail = incomeTaxDetail(e)
    if (!Array.isArray(detail?.bands)) continue
    const bandSum = detail.bands.reduce((s, b) => s + (b.tax || 0), 0)
    const gap     = Math.abs(bandSum - (detail.total_tax || 0))
    log(gap <= 1, `${file} → band sum £${bandSum} ≈ total_tax £${detail.total_tax} (gap=${gap})`)
  }
}

// ── Case 12 — dividend-tax row only appears when dividends present ─────────────
console.log('\n── Case 12 — dividend-tax row conditional on dividends ──')
{
  const noDiv = { age: 40, income: { salary: 50000 } }
  const withDiv = { age: 40, income: { salary: 50000, dividends: 5000 } }

  const rNo   = buildTaxRows(noDiv)
  const rWith = buildTaxRows(withDiv)

  const divRowNo   = rNo.rows.find(x => x.key === 'dividendTax')
  const divRowWith = rWith.rows.find(x => x.key === 'dividendTax')

  log(!divRowNo || divRowNo.value === 0, 'no-dividends entity → dividend row is 0 or absent')
  log(divRowWith != null,               'with-dividends entity → dividend row present')
}

// ── Case 13 — persona-a (FLAT schema) produces valid rows ─────────────────────
console.log('\n── Case 13 — persona-a FLAT schema ──')
{
  const e = await loadPersona('persona-a.json')
  const r = buildTaxRows(e)
  log(typeof r.total === 'number' && r.total >= 0, `persona-a → total=${r.total}`)
  log(r.rows.length >= 0, `persona-a → ${r.rows.length} rows`)
}

// ── Case 14 — mrT-ltd-director (NESTED schema) produces valid rows ────────────
console.log('\n── Case 14 — mrT-ltd-director NESTED schema ──')
{
  const e = await loadPersona('mrT-ltd-director.json')
  const r = buildTaxRows(e)
  log(typeof r.total === 'number' && r.total >= 0, `mrT-ltd-director → total=${r.total}`)
  log(r.rows.length >= 0, `mrT-ltd-director → ${r.rows.length} rows`)
}

// ── Case 15 — typeCount matches rows with value > 0 ──────────────────────────
console.log('\n── Case 15 — typeCount matches non-zero rows ──')
{
  for (const file of ['persona-a.json', 'persona-c.json']) {
    const e = await loadPersona(file)
    const r = buildTaxRows(e)
    const nonZeroCount = r.rows.filter(x => x.value > 0).length
    log(r.typeCount === nonZeroCount,
      `${file} → typeCount=${r.typeCount} equals non-zero rows=${nonZeroCount}`)
  }
}

// ── Case 16 — additional-rate taxpayer has higher-rate band taxes ─────────────
console.log('\n── Case 16 — high earner bands are correct ──')
{
  const e = { age: 45, income: { salary: 180000 } }
  const detail = incomeTaxDetail(e)
  const r = buildTaxRows(e)
  const itRow = r.rows.find(x => x.key === 'incomeTax')
  // Should have meaningful income tax on £180k
  log(itRow?.value > 20000, `£180k salary → income tax > £20k (got £${itRow?.value})`)
  // Multiple bands should be populated
  const activeBands = detail?.bands?.filter(b => b.tax > 0).length ?? 0
  log(activeBands >= 2, `£180k salary → at least 2 active bands (got ${activeBands})`)
}

// ── Case 17 — persona-c produces plausible results ────────────────────────────
console.log('\n── Case 17 — persona-c plausibility ──')
{
  const e = await loadPersona('persona-c.json')
  const r = buildTaxRows(e)
  const detail = incomeTaxDetail(e)
  log(typeof r.total === 'number', `persona-c → total is number (${r.total})`)
  log(detail?.confidence != null, `persona-c → confidence field present (${detail?.confidence})`)
}

// ── Summary ───────────────────────────────────────────────────────────────────
const total = passes + fails
console.log(`\n${'─'.repeat(67)}`)
console.log(`L3 Tax-obligations panel — pass=${passes} fail=${fails} total=${total}`)
console.log('═'.repeat(67))
process.exit(fails === 0 ? 0 : 1)
