// tests/l3-2-dc-vs-db.mjs
//
// L3 DCvsDB panel — data layer contract test.
// Run via: node tests/l3-2-dc-vs-db.mjs

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { buildPensionMix, ILLUSTRATIVE_RATE, ILLUSTRATIVE_YEARS } from '../src/components/MyMoney/L3/L3Sections/DCvsDBPanel.data.js'
import { pvAnnuity } from '../src/engine/modules/financial-math.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const personasDir = join(__dirname, '..', 'src', 'rules', 'personas')

let passes = 0
let fails  = 0
const log = (ok, msg) => {
  if (ok) { passes++; console.log(`✓ ${msg}`) }
  else    { fails++;  console.log(`✗ ${msg}`) }
}

async function loadPersona(file) {
  return JSON.parse(await readFile(join(personasDir, file), 'utf8'))
}

// ── Case 1 — output shape ─────────────────────────────────────────────────────
console.log('\n── Case 1 — output shape ──')
{
  const e = await loadPersona('mrT-decum-complex.json')
  const r = buildPensionMix(e)
  log(Array.isArray(r.dcSchemes),    'dcSchemes is array')
  log(Array.isArray(r.dbSchemes),    'dbSchemes is array')
  log(typeof r.dcTotal === 'number', 'dcTotal is number')
  log(typeof r.dbAnnual === 'number', 'dbAnnual is number')
  log(typeof r.dbCapitalEquiv === 'number', 'dbCapitalEquiv is number')
  log(typeof r.total === 'number',   'total is number')
}

// ── Case 2 — mrT-decum-complex: 1 DC SIPP + 1 DB ─────────────────────────────
console.log('\n── Case 2 — mrT-decum-complex DC/DB split ──')
{
  const e = await loadPersona('mrT-decum-complex.json')
  const r = buildPensionMix(e)
  log(r.dcSchemes.length >= 1, `dcSchemes.length=${r.dcSchemes.length} (≥1 DC)`)
  log(r.dbSchemes.length === 1, `dbSchemes.length=${r.dbSchemes.length} (exactly 1 DB)`)
  const db = r.dbSchemes[0]
  // mrT DB: annual_pension_gross = 28000, no cetv field
  log(db.annual === 28000, `DB annual=${db.annual} (expected 28000)`)
  log(db.cetv === null, `DB cetv=null (no cetv in persona)`)
  log(db.cetvIsEstimate === true, `DB cetvIsEstimate=true`)
}

// ── Case 3 — mrT DC total reconciles with sipp.pensions[] sum ────────────────
console.log('\n── Case 3 — mrT DC total reconciles with pensions[] balance ──')
{
  const e = await loadPersona('mrT-decum-complex.json')
  const r = buildPensionMix(e)
  // mrT DC: assets.pensions[0] type=SIPP balance=2,400,000
  const dcSumFromPersona = +(e.assets?.pensions?.find(p => !/db/i.test(p.type))?.balance ?? 0)
  log(r.dcTotal === dcSumFromPersona,
    `dcTotal=${r.dcTotal.toLocaleString()} matches persona SIPP balance=${dcSumFromPersona.toLocaleString()}`)
}

// ── Case 4 — DB capital equiv finite and > annual ─────────────────────────────
console.log('\n── Case 4 — dbCapitalEquiv finite and > dbAnnual ──')
{
  const e = await loadPersona('mrT-decum-complex.json')
  const r = buildPensionMix(e)
  log(isFinite(r.dbCapitalEquiv), `dbCapitalEquiv is finite (${r.dbCapitalEquiv.toLocaleString()})`)
  log(r.dbCapitalEquiv > r.dbAnnual, `dbCapitalEquiv=${r.dbCapitalEquiv.toLocaleString()} > dbAnnual=${r.dbAnnual.toLocaleString()}`)
}

// ── Case 5 — DB capital equiv uses pvAnnuity correctly ───────────────────────
console.log('\n── Case 5 — DB capital equiv = pvAnnuity(annual, ILLUSTRATIVE_RATE, ILLUSTRATIVE_YEARS) ──')
{
  const e = await loadPersona('mrT-decum-complex.json')
  const r = buildPensionMix(e)
  const expected = pvAnnuity(r.dbAnnual, ILLUSTRATIVE_RATE, ILLUSTRATIVE_YEARS)
  log(Math.abs(r.dbCapitalEquiv - expected) < 1,
    `dbCapitalEquiv=${Math.round(r.dbCapitalEquiv).toLocaleString()} ≈ pvAnnuity expected=${Math.round(expected).toLocaleString()}`)
}

// ── Case 6 — total = dcTotal + DB capital equiv (no cetv case) ───────────────
console.log('\n── Case 6 — total = dcTotal + DB capital equiv (no-cetv) ──')
{
  const e = await loadPersona('mrT-decum-complex.json')
  const r = buildPensionMix(e)
  // When cetv is null, capitalEquiv is used in total
  const expected = r.dcTotal + r.dbSchemes.reduce((s, d) => s + (d.cetv ?? d.capitalEquiv), 0)
  log(Math.abs(r.total - expected) < 1, `total=${r.total.toLocaleString()} = expected=${expected.toLocaleString()}`)
}

// ── Case 7 — DB scheme carries editable cetv path ────────────────────────────
console.log('\n── Case 7 — DB scheme idx matches assets.pensions[] ──')
{
  const e = await loadPersona('mrT-decum-complex.json')
  const r = buildPensionMix(e)
  const db = r.dbSchemes[0]
  // DB pension is at pensions[1] in mrT (pensions[0] is SIPP)
  log(typeof db.idx === 'number', `db.idx is number (${db.idx})`)
  // Validate: the entity at that index is indeed a DB type
  const raw = e.assets.pensions[db.idx]
  log(/db/i.test(raw?.type ?? ''), `pensions[${db.idx}].type="${raw?.type}" is DB`)
}

// ── Case 8 — DC scheme editable path contains sipp.pensions[ ─────────────────
console.log('\n── Case 8 — DC sipp schemes have correct source ──')
{
  const e = await loadPersona('persona-a.json')
  const r = buildPensionMix(e)
  log(r.dcSchemes.length > 0, `persona-a has ${r.dcSchemes.length} DC schemes`)
  const sippSchemes = r.dcSchemes.filter(s => s.source === 'sipp')
  log(sippSchemes.length > 0, `at least 1 scheme sourced from sipp (${sippSchemes.length})`)
  for (const s of sippSchemes) {
    log(typeof s.idx === 'number', `sipp scheme idx=${s.idx} is number`)
  }
}

// ── Case 9 — persona-a: DC only, dbSchemes empty, no crash ───────────────────
console.log('\n── Case 9 — persona-a DC-only: no crash, dbSchemes empty ──')
{
  const e = await loadPersona('persona-a.json')
  let r
  try {
    r = buildPensionMix(e)
    log(true, 'buildPensionMix(persona-a) did not throw')
  } catch (err) {
    log(false, `buildPensionMix(persona-a) threw: ${err.message}`)
    r = { dbSchemes: [], dcSchemes: [], dbAnnual: 0, dbCapitalEquiv: 0, dcTotal: 0, total: 0 }
  }
  log(r.dbSchemes.length === 0, `persona-a dbSchemes.length=${r.dbSchemes.length} (expected 0)`)
  log(r.dbAnnual === 0,         `persona-a dbAnnual=${r.dbAnnual} (expected 0)`)
  log(r.dbCapitalEquiv === 0,   `persona-a dbCapitalEquiv=${r.dbCapitalEquiv} (expected 0)`)
  log(r.dcTotal > 0,            `persona-a dcTotal=${r.dcTotal.toLocaleString()} > 0`)
}

// ── Case 10 — persona-a dcTotal reconciles with sipp.pensions[] sum ──────────
console.log('\n── Case 10 — persona-a dcTotal reconciles with sipp.pensions[] ──')
{
  const e = await loadPersona('persona-a.json')
  const r = buildPensionMix(e)
  const sippSum = (e.assets?.sipp?.pensions || []).reduce((s, p) => {
    if (/occupational.?db/i.test(p.type || '')) return s
    return s + (+(p.value ?? p.balance ?? 0) || 0)
  }, 0)
  log(Math.abs(r.dcTotal - sippSum) < 1,
    `persona-a dcTotal=${r.dcTotal.toLocaleString()} = sippSum=${sippSum.toLocaleString()}`)
}

// ── Case 11 — empty entity → all zeros, no crash ─────────────────────────────
console.log('\n── Case 11 — empty entity → zeros, no crash ──')
{
  let r
  try {
    r = buildPensionMix({})
    log(true, 'buildPensionMix({}) did not throw')
  } catch (err) {
    log(false, `buildPensionMix({}) threw: ${err.message}`)
    r = null
  }
  if (r) {
    log(r.total === 0,         `empty → total=0`)
    log(r.dcTotal === 0,       `empty → dcTotal=0`)
    log(r.dbAnnual === 0,      `empty → dbAnnual=0`)
    log(r.dbCapitalEquiv === 0, `empty → dbCapitalEquiv=0`)
  }
}

// ── Case 12 — synthetic entity with known CETV ────────────────────────────────
console.log('\n── Case 12 — synthetic entity: DB with explicit cetv ──')
{
  const e = {
    assets: {
      pensions: [
        { type: 'occupational-DB', name: 'Test DB', projected_annual_pension: 10000, cetv: 200000 },
      ],
    },
  }
  const r = buildPensionMix(e)
  log(r.dbSchemes.length === 1,     'synthetic: 1 DB scheme')
  log(r.dbSchemes[0].cetv === 200000, `synthetic: cetv=200000`)
  log(r.dbSchemes[0].cetvIsEstimate === false, 'synthetic: cetvIsEstimate=false')
  log(r.dbSchemes[0].capitalEquiv === 200000, 'synthetic: capitalEquiv = cetv when cetv provided')
  // total should use cetv directly
  log(r.total === 200000, `synthetic: total=${r.total} = cetv 200000`)
}

// ── Case 13 — ILLUSTRATIVE constants exported and sane ────────────────────────
console.log('\n── Case 13 — ILLUSTRATIVE constants ──')
{
  log(typeof ILLUSTRATIVE_RATE === 'number' && ILLUSTRATIVE_RATE > 0 && ILLUSTRATIVE_RATE < 1,
    `ILLUSTRATIVE_RATE=${ILLUSTRATIVE_RATE} (0 < rate < 1)`)
  log(typeof ILLUSTRATIVE_YEARS === 'number' && ILLUSTRATIVE_YEARS > 0,
    `ILLUSTRATIVE_YEARS=${ILLUSTRATIVE_YEARS} > 0`)
}

// ── Case 14 — DB with cetv: total = dcTotal + cetv (not pvAnnuity) ────────────
console.log('\n── Case 14 — DB with cetv: total uses cetv not estimate ──')
{
  const e = {
    assets: {
      sipp: { pensions: [{ name: 'My SIPP', type: 'SIPP', value: 100000 }] },
      pensions: [
        { type: 'occupational-DB', name: 'NHS DB', projected_annual_pension: 15000, cetv: 300000 },
      ],
    },
  }
  const r = buildPensionMix(e)
  log(r.dcTotal === 100000, `dcTotal=100000`)
  log(r.dbSchemes[0].cetv === 300000, `DB cetv=300000`)
  log(r.total === 400000, `total=400000 (100k DC + 300k cetv)`)
}

// ── Case 15 — mrT DB: name resolved from scheme field ────────────────────────
console.log('\n── Case 15 — mrT DB name resolved ──')
{
  const e = await loadPersona('mrT-decum-complex.json')
  const r = buildPensionMix(e)
  const db = r.dbSchemes[0]
  log(typeof db.name === 'string' && db.name.length > 0, `DB name="${db.name}" is non-empty string`)
}

// ── Summary ───────────────────────────────────────────────────────────────────
const total = passes + fails
console.log(`\n${'─'.repeat(67)}`)
console.log(`DC vs DB panel — pass=${passes} fail=${fails} total=${total}`)
console.log('═'.repeat(67))
process.exit(fails === 0 ? 0 : 1)
