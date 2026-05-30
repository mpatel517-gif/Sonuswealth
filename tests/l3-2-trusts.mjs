// tests/l3-2-trusts.mjs
//
// L3 Tier-A (Trusts) contract test: TrustsPanel data layer.
// Run via: node tests/l3-2-trusts.mjs

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { buildTrustRows, trustTypeLabel } from '../src/components/MyMoney/L3/L3Sections/TrustsPanel.data.js'
import { trustsTotalPayload, trustL5 } from '../src/components/MyMoney/L3/L3Sections/TrustsPayloads.js'

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

// ── Case 1 — output shape ────────────────────────────────────────────────────
console.log('\n── Case 1 — output shape ──')
{
  const e = await loadPersona('mrT-decum-complex.json')
  const r = buildTrustRows(e)
  log(Array.isArray(r.rows),           'rows is array')
  log(typeof r.total === 'number',     'total is number')
  log(typeof r.trustCount === 'number','trustCount is number')
  log(r.rows.length === r.trustCount,  'rows.length === trustCount')
}

// ── Case 2 — mrT-decum-complex: 1 trust, fund value 235000 ─────────────────
console.log('\n── Case 2 — mrT-decum-complex: 1 trust, £235,000 ──')
{
  const e = await loadPersona('mrT-decum-complex.json')
  const r = buildTrustRows(e)
  log(r.trustCount === 1,              `trustCount=1 (got ${r.trustCount})`)
  log(r.total === 235_000,             `total=£235,000 (got £${r.total.toLocaleString()})`)
  log(r.rows[0]?.value === 235_000,    `row[0].value=£235,000 (got ${r.rows[0]?.value})`)
}

// ── Case 3 — total equals sum of trust_fund_value ────────────────────────────
console.log('\n── Case 3 — total === Σ trust_fund_value ──')
{
  const e = await loadPersona('mrT-decum-complex.json')
  const r = buildTrustRows(e)
  const sumFromRows = r.rows.reduce((s, row) => s + row.value, 0)
  log(r.total === sumFromRows, `total=${r.total} === Σrows=${sumFromRows}`)
}

// ── Case 4 — persona-a (no trusts): empty-safe ───────────────────────────────
console.log('\n── Case 4 — persona-a: 0 trusts, empty-safe ──')
{
  const e = await loadPersona('persona-a.json')
  const r = buildTrustRows(e)
  log(r.trustCount === 0, `trustCount=0 (got ${r.trustCount})`)
  log(r.total === 0,      `total=0 (got ${r.total})`)
  log(r.rows.length === 0,'rows.length=0')
}

// ── Case 5 — empty entity: no crash, zero state ──────────────────────────────
console.log('\n── Case 5 — empty entity ──')
{
  const r = buildTrustRows({})
  log(r.total === 0,      `empty entity → total=0`)
  log(r.trustCount === 0, `empty entity → trustCount=0`)
  log(r.rows.length === 0,'empty entity → 0 rows')
}

// ── Case 6 — row.idx is real array index ─────────────────────────────────────
console.log('\n── Case 6 — row.idx is valid entity.trusts[] index ──')
{
  const e = await loadPersona('mrT-decum-complex.json')
  const r = buildTrustRows(e)
  const trusts = e.trusts || []
  let ok = true
  for (const row of r.rows) {
    if (row.idx < 0 || row.idx >= trusts.length) ok = false
    if (trusts[row.idx] == null) ok = false
  }
  log(ok, `all row.idx are valid entity.trusts[] indices`)
}

// ── Case 7 — drill.editable.path targets correct array index ─────────────────
console.log('\n── Case 7 — drill.editable.path === trusts[${idx}].trust_fund_value ──')
{
  const e = await loadPersona('mrT-decum-complex.json')
  const r = buildTrustRows(e)
  for (const row of r.rows) {
    const expected = `trusts[${row.idx}].trust_fund_value`
    log(
      row.drill?.editable?.path === expected,
      `row[${row.idx}].drill.editable.path="${row.drill?.editable?.path}" (expected "${expected}")`
    )
  }
}

// ── Case 8 — drill.editable.currentValue === trust_fund_value ────────────────
console.log('\n── Case 8 — editable.currentValue === trust fund value ──')
{
  const e = await loadPersona('mrT-decum-complex.json')
  const r = buildTrustRows(e)
  for (const row of r.rows) {
    const trust = e.trusts[row.idx]
    log(
      row.drill?.editable?.currentValue === trust.trust_fund_value,
      `row[${row.idx}] editable.currentValue=${row.drill?.editable?.currentValue} matches fixture ${trust.trust_fund_value}`
    )
  }
}

// ── Case 9 — plain-English labels (no raw taxonomy codes) ────────────────────
console.log('\n── Case 9 — labels plain-English (no raw type strings) ──')
{
  const e = await loadPersona('mrT-decum-complex.json')
  const r = buildTrustRows(e)
  for (const row of r.rows) {
    const trust = e.trusts[row.idx]
    const rawType = trust.type || ''
    log(
      row.label !== rawType,
      `row label "${row.label}" is not raw type "${rawType}"`
    )
    log(
      row.label === 'Discretionary trust',
      `discretionary-trust → "Discretionary trust" (got "${row.label}")`
    )
  }
}

// ── Case 10 — trustTypeLabel maps correctly ───────────────────────────────────
console.log('\n── Case 10 — trustTypeLabel mapping ──')
{
  log(trustTypeLabel('discretionary-trust') === 'Discretionary trust', 'discretionary-trust → "Discretionary trust"')
  log(trustTypeLabel('bare-trust')          === 'Bare trust',           'bare-trust → "Bare trust"')
  log(trustTypeLabel('interest-in-possession') === 'Interest-in-possession trust', 'iip mapped')
  log(trustTypeLabel(undefined)             === 'Trust',                'undefined → "Trust"')
  log(trustTypeLabel('unknown-xyz')         === 'Trust',                'unknown → "Trust" fallback')
}

// ── Case 11 — trustsTotalPayload shape ───────────────────────────────────────
console.log('\n── Case 11 — trustsTotalPayload shape ──')
{
  const e = await loadPersona('mrT-decum-complex.json')
  const r = buildTrustRows(e)
  const p = trustsTotalPayload(e, r.total, r.trustCount)
  log(typeof p.formula === 'string' && p.formula.length > 0,  'formula non-empty string')
  log(typeof p.source === 'string' && p.source.length > 0,    'source non-empty string')
  log(p.confidence === 'high',                                 'confidence=high when trusts present')
  log(Array.isArray(p.breakdown) && p.breakdown.length > 0,   'breakdown is non-empty array')
}

// ── Case 12 — trustL5 shape + editable path ──────────────────────────────────
console.log('\n── Case 12 — trustL5 payload ──')
{
  const e = await loadPersona('mrT-decum-complex.json')
  const trust = e.trusts[0]
  const p = trustL5(trust, 0, 'entity.trusts')
  log(typeof p.metric === 'string',         'metric is string')
  log(Array.isArray(p.breakdown),            'breakdown is array')
  log(p.editable?.path === 'trusts[0].trust_fund_value', `editable.path="${p.editable?.path}"`)
  log(p.editable?.currentValue === 235_000,  `editable.currentValue=235000 (got ${p.editable?.currentValue})`)
  log(p.editable?.unit === '£',              'editable.unit=£')
}

// ── Case 13 — multi-trust synthetic: total and indices ──────────────────────
console.log('\n── Case 13 — synthetic multi-trust entity ──')
{
  const e = {
    trusts: [
      { id: 't-1', type: 'discretionary-trust', settlor: 'Alice', trust_fund_value: 100_000 },
      { id: 't-2', type: 'bare-trust',           settlor: 'Bob',   trust_fund_value:  50_000 },
    ],
  }
  const r = buildTrustRows(e)
  log(r.trustCount === 2,                   `trustCount=2 (got ${r.trustCount})`)
  log(r.total === 150_000,                   `total=£150,000 (got £${r.total.toLocaleString()})`)
  log(r.rows[0].idx === 0,                   `rows[0].idx=0`)
  log(r.rows[1].idx === 1,                   `rows[1].idx=1`)
  log(r.rows[0].label === 'Discretionary trust', `rows[0] label "Discretionary trust"`)
  log(r.rows[1].label === 'Bare trust',          `rows[1] label "Bare trust"`)
  log(r.rows[0].drill.editable.path === 'trusts[0].trust_fund_value', 'row[0] editable path')
  log(r.rows[1].drill.editable.path === 'trusts[1].trust_fund_value', 'row[1] editable path')
}

// ── Summary ─────────────────────────────────────────────────────────────────
const total = passes + fails
console.log(`\n${'─'.repeat(67)}`)
console.log(`L3 Trusts panel — pass=${passes} fail=${fails} total=${total}`)
console.log('═'.repeat(67))
process.exit(fails === 0 ? 0 : 1)
