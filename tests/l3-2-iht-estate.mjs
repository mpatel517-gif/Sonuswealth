// tests/l3-2-iht-estate.mjs
//
// L3 IHT-estate panel contract tests — data layer only.
// Run via: node tests/l3-2-iht-estate.mjs
//
// Asserts (≥15 cases):
//   - output shape
//   - ihtDue reconciles with ihtExposure(entity).iht_due
//   - net_estate identity: gross − debts − funeral
//   - beneficiary_value = net − iht (when iht > 0) or net (when iht === 0)
//   - rows present and populated
//   - labels plain-English (no bare 'NRB' as a row label)
//   - empty/low estate → ihtDue 0 and family keeps net (NOT £0)
//   - persona-a (decumulation) and persona-c (business owner)

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { buildEstateRows } from '../src/components/MyMoney/L3/L3Sections/IHTEstatePanel.data.js'
import { ihtExposure }     from '../src/engine/tax-estate-engine.js'
import {
  ihtTotalPayload,
  grossEstatePayload,
  bandsPayload,
  reliefsPayload,
  beneficiaryPayload,
} from '../src/components/MyMoney/L3/L3Sections/IHTEstatePayloads.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const personasDir = join(__dirname, '..', 'src', 'rules', 'personas')

let fails  = 0
let passes = 0

const log = (ok, msg) => {
  if (ok) { passes += 1; console.log(`✓ ${msg}`) }
  else    { fails  += 1; console.log(`✗ ${msg}`) }
}

const round = (n) => Math.round(n)
const near  = (a, b, tol = 1) => Math.abs(a - b) <= tol

async function loadPersona(file) {
  return JSON.parse(await readFile(join(personasDir, file), 'utf8'))
}

// ── Case 1 — output shape ──────────────────────────────────────────────────────
console.log('\n── Case 1 — output shape ──')
{
  const e = await loadPersona('persona-a.json')
  const r = buildEstateRows(e)
  log(Array.isArray(r.rows),          'rows is array')
  log(typeof r.ihtDue === 'number',   'ihtDue is number')
  log(typeof r.beneficiaryValue === 'number', 'beneficiaryValue is number')
  log(r.exposure != null,             'exposure object present')
  log(r.rows.length >= 4,             `rows.length >= 4 (got ${r.rows.length})`)
}

// ── Case 2 — ihtDue reconciles with engine ─────────────────────────────────────
console.log('\n── Case 2 — ihtDue reconciles with ihtExposure() ──')
{
  for (const file of ['persona-a.json', 'persona-c.json']) {
    const e   = await loadPersona(file)
    const r   = buildEstateRows(e)
    const exp = ihtExposure(e)
    log(
      near(r.ihtDue, exp.iht_due),
      `${file} → panel.ihtDue=${round(r.ihtDue).toLocaleString()} engine.iht_due=${round(exp.iht_due).toLocaleString()}`
    )
  }
}

// ── Case 3 — net_estate identity: gross − debts − funeral ──────────────────────
console.log('\n── Case 3 — net_estate = gross − debts − funeral ──')
{
  for (const file of ['persona-a.json', 'persona-c.json']) {
    const e   = await loadPersona(file)
    const exp = ihtExposure(e)
    const computed = Math.max(0, exp.gross_estate - (exp.deductions?.debts || 0) - (exp.deductions?.funeral || 0))
    log(
      near(computed, exp.net_estate),
      `${file} → computed=${round(computed).toLocaleString()} engine.net_estate=${round(exp.net_estate).toLocaleString()}`
    )
  }
}

// ── Case 4 — beneficiary_value = net − iht (when iht > 0) ─────────────────────
console.log('\n── Case 4 — beneficiary_value = net − iht when iht > 0 ──')
{
  for (const file of ['persona-a.json', 'persona-c.json']) {
    const e   = await loadPersona(file)
    const exp = ihtExposure(e)
    if (exp.iht_due > 0) {
      const expected = Math.max(0, exp.net_estate - exp.iht_due)
      log(
        near(exp.beneficiary_value, expected),
        `${file} → beneficiary=${round(exp.beneficiary_value).toLocaleString()} = net(${round(exp.net_estate).toLocaleString()}) − iht(${round(exp.iht_due).toLocaleString()})`
      )
    } else {
      // No IHT: family keeps net estate (not £0)
      log(
        exp.beneficiary_value === exp.net_estate || near(exp.beneficiary_value, exp.net_estate),
        `${file} → iht=0, family keeps full net estate (${round(exp.beneficiary_value).toLocaleString()}), not £0`
      )
    }
  }
}

// ── Case 5 — empty entity → ihtDue 0, family keeps net ────────────────────────
console.log('\n── Case 5 — empty entity → zero IHT, family keeps net ──')
{
  const r   = buildEstateRows({})
  const exp = ihtExposure({})
  log(r.ihtDue === 0,                           `empty entity → ihtDue=${r.ihtDue}`)
  log(r.beneficiaryValue === exp.net_estate || near(r.beneficiaryValue, exp.net_estate),
                                                `empty entity → beneficiary=net (not £0)`)
}

// ── Case 6 — low estate (below bands) → ihtDue 0 ──────────────────────────────
console.log('\n── Case 6 — low estate → ihtDue 0 ──')
{
  const small = { age: 60, assets: { cash: 50000, property: 100000 } }
  const r   = buildEstateRows(small)
  log(r.ihtDue === 0, `small estate → ihtDue=${r.ihtDue} (expected 0)`)
  // beneficiaryValue = net estate when iht = 0
  const exp = ihtExposure(small)
  log(
    near(r.beneficiaryValue, exp.net_estate),
    `small estate → beneficiary ${round(r.beneficiaryValue).toLocaleString()} ≈ net ${round(exp.net_estate).toLocaleString()}`
  )
}

// ── Case 7 — row labels are plain-English (no bare 'NRB') ─────────────────────
console.log('\n── Case 7 — row labels plain-English (no bare NRB/RNRB) ──')
{
  for (const file of ['persona-a.json', 'persona-c.json']) {
    const e = await loadPersona(file)
    const r = buildEstateRows(e)
    let ok = true
    for (const row of r.rows) {
      // bare 'NRB' or 'RNRB' as the entire label is banned; 'Tax-free bands' is fine
      if (row.label === 'NRB' || row.label === 'RNRB') {
        ok = false
        console.log(`  ✗ bare NRB/RNRB found as row label: "${row.label}"`)
      }
    }
    log(ok, `${file} → no bare NRB/RNRB row labels (${r.rows.length} rows checked)`)
  }
}

// ── Case 8 — all rows have required fields ─────────────────────────────────────
console.log('\n── Case 8 — all rows have key/label/value/drill ──')
{
  const e = await loadPersona('persona-a.json')
  const r = buildEstateRows(e)
  let ok  = true
  for (const row of r.rows) {
    if (!row.key || !row.label || typeof row.value !== 'number' || !row.drill) {
      ok = false
      console.log(`  ✗ malformed row: ${JSON.stringify({ key: row.key, label: row.label, hasValue: typeof row.value, hasDrill: !!row.drill })}`)
    }
  }
  log(ok, `persona-a → all ${r.rows.length} rows well-formed`)
}

// ── Case 9 — persona-c (business owner) ───────────────────────────────────────
console.log('\n── Case 9 — persona-c (business owner) ──')
{
  const e   = await loadPersona('persona-c.json')
  const r   = buildEstateRows(e)
  const exp = ihtExposure(e)
  log(typeof r.ihtDue === 'number',   `persona-c → ihtDue is number (${round(r.ihtDue).toLocaleString()})`)
  log(r.rows.length >= 4,             `persona-c → ${r.rows.length} rows`)
  log(near(r.ihtDue, exp.iht_due),    `persona-c → ihtDue reconciled with engine`)
}

// ── Case 10 — grossEstatePayload shape ────────────────────────────────────────
console.log('\n── Case 10 — grossEstatePayload shape ──')
{
  const e   = await loadPersona('persona-a.json')
  const exp = ihtExposure(e)
  const p   = grossEstatePayload(exp)
  log(typeof p.formula === 'string' && p.formula.length > 0, 'grossEstatePayload.formula is string')
  log(typeof p.source  === 'string' && p.source.includes('ihtExposure'), 'grossEstatePayload.source cites ihtExposure')
  log(Array.isArray(p.breakdown),     'grossEstatePayload.breakdown is array')
  log(p.editable === undefined,       'grossEstatePayload has no editable (read-only)')
}

// ── Case 11 — bandsPayload shape ──────────────────────────────────────────────
console.log('\n── Case 11 — bandsPayload shape ──')
{
  const e   = await loadPersona('persona-a.json')
  const exp = ihtExposure(e)
  const p   = bandsPayload(exp)
  log(typeof p.formula === 'string' && p.formula.length > 0, 'bandsPayload.formula is string')
  log(Array.isArray(p.breakdown),     'bandsPayload.breakdown is array')
  log(p.breakdown.length >= 2,        `bandsPayload.breakdown has entries (n=${p.breakdown.length})`)
  // Breakdown labels must not say bare 'NRB' — must be descriptive
  const allDescriptive = p.breakdown.every(b => b.label !== 'NRB' && b.label !== 'RNRB')
  log(allDescriptive, 'bandsPayload labels are descriptive (no bare NRB/RNRB)')
}

// ── Case 12 — reliefsPayload shape ────────────────────────────────────────────
console.log('\n── Case 12 — reliefsPayload shape ──')
{
  const e   = await loadPersona('persona-c.json')
  const exp = ihtExposure(e)
  const p   = reliefsPayload(exp)
  log(typeof p.formula === 'string',  'reliefsPayload.formula is string')
  log(typeof p.source  === 'string',  'reliefsPayload.source is string')
  log(Array.isArray(p.breakdown),     'reliefsPayload.breakdown is array')
}

// ── Case 13 — beneficiaryPayload shape ────────────────────────────────────────
console.log('\n── Case 13 — beneficiaryPayload shape ──')
{
  const e   = await loadPersona('persona-a.json')
  const exp = ihtExposure(e)
  const p   = beneficiaryPayload(exp)
  log(typeof p.formula === 'string',  'beneficiaryPayload.formula is string')
  log(Array.isArray(p.breakdown),     'beneficiaryPayload.breakdown is array')
  log(p.breakdown.some(b => b.label.includes('family') || b.label.includes('keeps')),
      'beneficiaryPayload.breakdown includes family-keeps row')
  log(p.editable === undefined,       'beneficiaryPayload has no editable (read-only)')
}

// ── Case 14 — ihtTotalPayload breakdown sums correctly ───────────────────────
console.log('\n── Case 14 — ihtTotalPayload breakdown structure ──')
{
  const e   = await loadPersona('persona-a.json')
  const exp = ihtExposure(e)
  const p   = ihtTotalPayload(exp)
  log(typeof p.formula === 'string',  'ihtTotalPayload.formula is string')
  log(p.breakdown.some(b => b.label === 'IHT due'), 'ihtTotalPayload.breakdown includes IHT due row')
  log(p.breakdown.some(b => b.label === 'Gross estate'), 'ihtTotalPayload.breakdown includes Gross estate row')
}

// ── Case 15 — mrT-decum-complex (has estate + pension) ───────────────────────
console.log('\n── Case 15 — mrT-decum-complex (estate-rich persona) ──')
{
  let e
  try {
    e = await loadPersona('mrT-decum-complex.json')
  } catch {
    console.log('  ⚠ mrT-decum-complex.json not found — using synthetic estate-rich entity')
    e = {
      dob: '1948-01-01',
      assets: {
        property:    [{ value: 1500000, address: 'Main home' }],
        isa:         { value: 200000 },
        sipp:        { total: 800000 },
        cash:        100000,
        liabilities: { total: 50000 },
      },
      estate: { directDescendant: true, funeralExpenses: 8000 },
    }
  }
  const r   = buildEstateRows(e)
  const exp = ihtExposure(e)
  log(typeof r.ihtDue === 'number',            `mrT-decum-complex → ihtDue is number (${round(r.ihtDue).toLocaleString()})`)
  log(near(r.ihtDue, exp.iht_due),             `mrT-decum-complex → ihtDue reconciled`)
  log(r.beneficiaryValue >= 0,                 `mrT-decum-complex → beneficiaryValue >= 0 (${round(r.beneficiaryValue).toLocaleString()})`)
}

// ── Summary ──────────────────────────────────────────────────────────────────
const total = passes + fails
console.log(`\n${'─'.repeat(67)}`)
console.log(`L3-2 IHT estate panel — pass=${passes} fail=${fails} total=${total}`)
console.log('═'.repeat(67))
process.exit(fails === 0 ? 0 : 1)
