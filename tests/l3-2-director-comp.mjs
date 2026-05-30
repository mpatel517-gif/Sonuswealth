// l3-2-director-comp.mjs — test suite for DirectorCompPanel.data.js
//
// Tests: buildRemunerationRows shape, totals, labels, editable paths,
//        dividend-tax reconciliation, graceful degradation on persona-a.
// Run:   node tests/l3-2-director-comp.mjs

import { readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Dynamic import of data module ───────────────────────────────────────────
const { buildRemunerationRows } = await import(
  '../src/components/MyMoney/L3/L3Sections/DirectorCompPanel.data.js'
)
const { calcDividendTax, fmt } = await import(
  '../src/engine/fq-calculator.js'
)

const personasDir = join(__dirname, '..', 'src', 'rules', 'personas')

let passes = 0
let fails  = 0
const log = (ok, msg) => {
  if (ok) { passes += 1; console.log(`✓ ${msg}`) }
  else    { fails  += 1; console.log(`✗ ${msg}`) }
}

async function loadPersona(file) {
  return JSON.parse(await readFile(join(personasDir, file), 'utf8'))
}

// ─── Case 1 — buildRemunerationRows shape ─────────────────────────────────────
console.log('\n── Case 1: buildRemunerationRows returns expected shape ──')
{
  const mrT = await loadPersona('mrT-ltd-director.json')
  const result = buildRemunerationRows(mrT)

  log(result !== null && typeof result === 'object', 'returns an object')
  log(typeof result.salary    === 'number', 'result.salary is a number')
  log(typeof result.dividends === 'number', 'result.dividends is a number')
  log(typeof result.total     === 'number', 'result.total is a number')
  log(Array.isArray(result.rows), 'result.rows is an array')
}

// ─── Case 2 — mrT income values ──────────────────────────────────────────────
console.log('\n── Case 2: mrT-ltd-director income values ──')
{
  const mrT = await loadPersona('mrT-ltd-director.json')
  const { salary, dividends, total, rows } = buildRemunerationRows(mrT)

  log(salary    === 12570,        `salary = £12,570 (got £${salary})`)
  log(dividends === 60000,        `dividends = £60,000 (got £${dividends})`)
  log(total     === salary + dividends, `total = salary + dividends (got ${total})`)
}

// ─── Case 3 — rows presence and keys ─────────────────────────────────────────
console.log('\n── Case 3: rows present and correctly keyed ──')
{
  const mrT = await loadPersona('mrT-ltd-director.json')
  const { rows } = buildRemunerationRows(mrT)

  const keys = rows.map(r => r.key)
  log(keys.includes('salary'),       'salary row present')
  log(keys.includes('dividends'),    'dividends row present')
  log(keys.includes('dividend-tax'), 'dividend-tax row present')
  log(keys.some(k => k.startsWith('company-equity-')), 'at least one company-equity row present')
}

// ─── Case 4 — plain-English labels (no bare acronyms as row labels) ───────────
console.log('\n── Case 4: row labels are plain English ──')
{
  const mrT = await loadPersona('mrT-ltd-director.json')
  const { rows } = buildRemunerationRows(mrT)

  const labels = rows.map(r => r.label)

  // Must not have bare PSC / DLA as stand-alone labels
  log(!labels.some(l => l === 'PSC'),                   'no bare PSC label')
  log(!labels.some(l => l === 'DLA'),                   'no bare DLA label')

  // Salary label must be plain English
  const salaryRow = rows.find(r => r.key === 'salary')
  log(salaryRow?.label?.toLowerCase().includes('salary') || salaryRow?.label?.toLowerCase().includes('director'),
      `salary row label is plain English ("${salaryRow?.label}")`)

  // Dividends label must be plain English
  const divRow = rows.find(r => r.key === 'dividends')
  log(divRow?.label?.toLowerCase().includes('dividend'),
      `dividends row label is plain English ("${divRow?.label}")`)
}

// ─── Case 5 — dividend-tax row reconciles with calcDividendTax ────────────────
console.log('\n── Case 5: dividend-tax row reconciles with engine ──')
{
  const mrT = await loadPersona('mrT-ltd-director.json')
  const { salary, dividends, rows } = buildRemunerationRows(mrT)

  const engineResult = calcDividendTax(dividends, salary)
  const engineTax    = engineResult?.tax ?? 0

  const taxRow = rows.find(r => r.key === 'dividend-tax')
  log(taxRow !== undefined,            'dividend-tax row exists')
  log(taxRow?.value === engineTax,     `dividend-tax value matches engine: £${engineTax} (got £${taxRow?.value})`)
}

// ─── Case 6 — editable rows carry a path ─────────────────────────────────────
console.log('\n── Case 6: editable rows carry a path ──')
{
  const mrT = await loadPersona('mrT-ltd-director.json')
  const { rows } = buildRemunerationRows(mrT)

  const salaryRow  = rows.find(r => r.key === 'salary')
  const divRow     = rows.find(r => r.key === 'dividends')
  const equityRow  = rows.find(r => r.key === 'company-equity-0')
  const taxRow     = rows.find(r => r.key === 'dividend-tax')

  log(typeof salaryRow?.drill?.editable?.path === 'string',  `salary row has editable.path ("${salaryRow?.drill?.editable?.path}")`)
  log(typeof divRow?.drill?.editable?.path    === 'string',  `dividends row has editable.path ("${divRow?.drill?.editable?.path}")`)
  log(typeof equityRow?.drill?.editable?.path === 'string',  `company-equity-0 row has editable.path ("${equityRow?.drill?.editable?.path}")`)
  log(taxRow?.drill?.editable == null,                        'dividend-tax row has NO editable (read-only)')
}

// ─── Case 7 — editable currentValue matches the row value ────────────────────
console.log('\n── Case 7: editable.currentValue matches row.value ──')
{
  const mrT = await loadPersona('mrT-ltd-director.json')
  const { rows } = buildRemunerationRows(mrT)

  const salaryRow = rows.find(r => r.key === 'salary')
  const divRow    = rows.find(r => r.key === 'dividends')
  const equityRow = rows.find(r => r.key === 'company-equity-0')

  log(salaryRow?.drill?.editable?.currentValue === salaryRow?.value,
      `salary editable.currentValue === row.value (${salaryRow?.value})`)
  log(divRow?.drill?.editable?.currentValue === divRow?.value,
      `dividends editable.currentValue === row.value (${divRow?.value})`)
  log(equityRow?.drill?.editable?.currentValue === equityRow?.value,
      `company-equity editable.currentValue === row.value (${equityRow?.value})`)
}

// ─── Case 8 — company-equity-0 path uses real index ──────────────────────────
console.log('\n── Case 8: company-equity paths use real numeric index ──')
{
  const mrT = await loadPersona('mrT-ltd-director.json')
  const { rows } = buildRemunerationRows(mrT)

  const equityRows = rows.filter(r => r.key.startsWith('company-equity-'))
  equityRows.forEach((r, i) => {
    const path = r.drill?.editable?.path || ''
    log(path.includes(`[${i}]`), `company-equity-${i} path contains [${i}] ("${path}")`)
  })
}

// ─── Case 9 — drill objects present and contain formula + source ──────────────
console.log('\n── Case 9: all rows have drill.formula and drill.source ──')
{
  const mrT = await loadPersona('mrT-ltd-director.json')
  const { rows } = buildRemunerationRows(mrT)

  let allHaveFormula = true
  let allHaveSource  = true
  rows.forEach(r => {
    if (typeof r.drill?.formula !== 'string') allHaveFormula = false
    if (typeof r.drill?.source  !== 'string') allHaveSource  = false
  })
  log(allHaveFormula, 'all rows have drill.formula (string)')
  log(allHaveSource,  'all rows have drill.source (string)')
}

// ─── Case 10 — persona-a graceful degradation ────────────────────────────────
console.log('\n── Case 10: persona-a graceful degradation ──')
{
  const pa = await loadPersona('persona-a.json')
  let threw = false
  let result
  try {
    result = buildRemunerationRows(pa)
  } catch (e) {
    threw = true
  }

  log(!threw, 'does not throw on persona-a')
  log(result !== undefined, 'returns a result object for persona-a')
  log(Array.isArray(result?.rows), 'rows is an array for persona-a')

  // persona-a has income.dividends = 16000, no salary, no companies
  log(typeof result?.dividends === 'number', `persona-a dividends is a number (got ${result?.dividends})`)
  log((result?.companies?.length ?? result?.rows?.filter(r => r.key.startsWith('company-equity-')).length ?? 0) === 0,
      'persona-a has no company-equity rows (no companies on persona-a)')
}

// ─── Summary ──────────────────────────────────────────────────────────────────
const total = passes + fails
console.log(`\n${'─'.repeat(67)}`)
console.log(`L3-2 Director-comp panel — pass=${passes} fail=${fails} total=${total}`)
console.log('─'.repeat(67))
process.exit(fails === 0 ? 0 : 1)
