// tests/l3-2-wrappers.mjs
//
// L3-2 Tier-A #2 contract test: WrappersPanel data layer.
// Run via `npm run test:l3-2-wrappers`.

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { buildWrapperBuckets } from '../src/components/MyMoney/L3/L3Sections/WrappersPanel.data.js'
import { isaTotal, giaTotal, pensionTotal } from '../src/engine/_helpers.js'
import { netWorth } from '../src/engine/fq-calculator.js'

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

// ── Case 1 — buildWrapperBuckets returns { buckets, total, bucketCount } ──
console.log('\n── Case 1 — output shape ──')
{
  const e = await loadPersona('persona-c.json')
  const r = buildWrapperBuckets(e)
  log(Array.isArray(r.buckets), 'buckets is array')
  log(typeof r.total === 'number', 'total is number')
  log(typeof r.bucketCount === 'number', 'bucketCount is number')
  log(r.buckets.length === r.bucketCount, 'buckets.length === bucketCount')
}

// ── Case 2 — buckets sorted descending ─────────────────────────────────────
console.log('\n── Case 2 — buckets sorted largest-first ──')
{
  for (const file of ['persona-a.json', 'persona-c.json', 'persona-e.json', 'mrT-decum-complex.json']) {
    const e = await loadPersona(file)
    const r = buildWrapperBuckets(e)
    let sorted = true
    for (let i = 1; i < r.buckets.length; i++) {
      if (r.buckets[i - 1].value < r.buckets[i].value) { sorted = false; break }
    }
    log(sorted, `${file} → buckets descending (n=${r.buckets.length})`)
  }
}

// ── Case 3 — share% sums to 100% when total > 0 ────────────────────────────
console.log('\n── Case 3 — Σshare ≈ 100% ──')
{
  for (const file of ['persona-a.json', 'persona-c.json', 'mrT-decum-complex.json']) {
    const e = await loadPersona(file)
    const r = buildWrapperBuckets(e)
    if (r.total === 0) continue
    const sum = r.buckets.reduce((s, b) => s + b.share, 0)
    log(Math.abs(sum - 1) < 0.001, `${file} → Σshare=${sum.toFixed(4)}`)
  }
}

// ── Case 4 — ISA bucket reconciles with isaTotal(entity) ───────────────────
console.log('\n── Case 4 — ISA bucket === isaTotal() ──')
{
  for (const file of ['persona-a.json', 'persona-c.json', 'mrT-core.json']) {
    const e = await loadPersona(file)
    const r = buildWrapperBuckets(e)
    const panelIsa = r.buckets.find(b => b.key === 'isa')?.value || 0
    const engineIsa = isaTotal(e)
    log(Math.abs(panelIsa - engineIsa) < 1,
      `${file} → panel=£${round(panelIsa).toLocaleString()} engine=£${round(engineIsa).toLocaleString()}`)
  }
}

// ── Case 5 — Pension bucket === pensionTotal(entity) ───────────────────────
console.log('\n── Case 5 — Pension bucket === pensionTotal() ──')
{
  for (const file of ['persona-c.json', 'persona-e.json', 'mrT-core.json']) {
    const e = await loadPersona(file)
    const r = buildWrapperBuckets(e)
    const panelPension = r.buckets.find(b => b.key === 'pension')?.value || 0
    const enginePension = pensionTotal(e)
    log(Math.abs(panelPension - enginePension) < 1,
      `${file} → panel=£${round(panelPension).toLocaleString()} engine=£${round(enginePension).toLocaleString()}`)
  }
}

// ── Case 6 — labels resolved for every bucket ──────────────────────────────
console.log('\n── Case 6 — every bucket has a plain-English label + tax stance ──')
{
  for (const file of ['persona-a.json', 'persona-c.json', 'mrT-core.json']) {
    const e = await loadPersona(file)
    const r = buildWrapperBuckets(e)
    let ok = true
    for (const b of r.buckets) {
      if (typeof b.label !== 'string' || b.label.length === 0) ok = false
      if (typeof b.taxStance !== 'string' || b.taxStance.length === 0) ok = false
    }
    log(ok, `${file} → ${r.buckets.length} buckets all labelled + stanced`)
  }
}

// ── Case 7 — empty entity → total=0, bucketCount=0 ─────────────────────────
console.log('\n── Case 7 — empty entity → zero state ──')
{
  const r = buildWrapperBuckets({})
  log(r.total === 0, `empty entity → total=${r.total}`)
  log(r.buckets.length === 0, `empty entity → ${r.buckets.length} buckets`)
  log(r.bucketCount === 0, `empty entity → bucketCount=${r.bucketCount}`)
}

// ── Case 8 — schema-agnostic: FLAT and NESTED produce same totals ──────────
console.log('\n── Case 8 — FLAT vs NESTED schema parity ──')
{
  const flat = {
    age: 40,
    assets: {
      isa:       { value: 100_000 },
      sipp:      { total: 300_000 },
      portfolio: { value:  50_000 },
    },
  }
  const nested = {
    age: 40,
    assets: {
      investments: [
        { value: 100_000, type: 'ISA' },
        { value:  50_000, type: 'GIA' },
      ],
      pensions: [{ value: 300_000, type: 'SIPP' }],
    },
  }
  const rFlat   = buildWrapperBuckets(flat)
  const rNested = buildWrapperBuckets(nested)
  log(Math.abs(rFlat.total - rNested.total) < 1,
    `total parity → flat=£${round(rFlat.total).toLocaleString()} nested=£${round(rNested.total).toLocaleString()}`)
}

// ── Case 9 — unknown wrapper type routes to gia bucket, not lost ───────────
console.log('\n── Case 9 — unknown type defensively bucketed ──')
{
  const e = {
    age: 50,
    assets: {
      investments: [
        { value: 50_000, type: 'mystery-wrapper-2099' },
        { value: 25_000, type: 'GIA' },
      ],
    },
  }
  const r = buildWrapperBuckets(e)
  log(r.total === 75_000, `total = £75,000 (got £${r.total.toLocaleString()})`)
  log(r.buckets.find(b => b.key === 'gia')?.value === 75_000,
    `unknown collapsed into gia bucket`)
}

// ── Case 10 — taxAdvAlt collects EIS/SEIS/VCT/Bonds ────────────────────────
console.log('\n── Case 10 — taxAdvAlt bucket collects EIS/SEIS/VCT/Bonds ──')
{
  const e = {
    age: 50,
    assets: {
      investments: [
        { value: 30_000, type: 'EIS' },
        { value: 20_000, type: 'SEIS' },
        { value: 15_000, type: 'VCT' },
        { value: 10_000, type: 'Bond-onshore' },
      ],
    },
  }
  const r = buildWrapperBuckets(e)
  const taxAdv = r.buckets.find(b => b.key === 'taxAdvAlt')?.value || 0
  log(taxAdv === 75_000, `taxAdvAlt = £75,000 (got £${taxAdv.toLocaleString()})`)
}

// ── Summary ───────────────────────────────────────────────────────────────
const total = passes + fails
console.log(`\n${'─'.repeat(67)}`)
console.log(`L3-2 Wrappers panel — pass=${passes} fail=${fails} total=${total}`)
console.log('═'.repeat(67))
process.exit(fails === 0 ? 0 : 1)
