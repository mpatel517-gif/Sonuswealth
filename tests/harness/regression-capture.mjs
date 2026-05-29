// ─────────────────────────────────────────────────────────────────────────────
// regression-capture — seed the baseline file (L4-4)
//
// Runs generateSnapshot() for the canonical persona × tax-year matrix and
// writes the result as a baseline JSON file. Run this ONCE to seed the
// baseline that the nightly regression-diff cron compares against.
//
// Usage:
//   node tests/harness/regression-capture.mjs [--out path] [--personas a,b,c] [--years 2025/26,2026/27]
//
// Defaults:
//   --out      tests/regression-baseline.json
//   --personas main 7 personas + 13 mrT family + 7 historical = 27 personas
//   --years    2026/27 only (current year)
//
// Re-run this when you DELIBERATELY change a rules bundle or persona
// fixture and want to update the baseline. The diff cron will alert on
// any subsequent unintended drift.
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { generateSnapshot } from './snapshot.mjs'
import { hashSnapshot } from './regression-diff.mjs'
import { listPersonas } from '../../src/lib/data-source.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function parseArgs(argv) {
  const out = {
    outPath: path.resolve(__dirname, '../regression-baseline.json'),
    personas: null,
    years: ['2026/27'],
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--out')      out.outPath = path.resolve(argv[++i])
    else if (a === '--personas') out.personas = argv[++i].split(',')
    else if (a === '--years')    out.years    = argv[++i].split(',')
  }
  return out
}

const args = parseArgs(process.argv)

async function resolvePersonas() {
  if (args.personas) return args.personas
  const main = ['persona-a','persona-b','persona-c','persona-d','persona-e','persona-f','persona-g']
  const [mrT, historical] = await Promise.all([
    listPersonas('mrT').catch(() => []),
    listPersonas('historical').catch(() => []),
  ])
  return [
    ...main,
    ...mrT.map(p => p.persona_id),
    ...historical.map(p => p.persona_id),
  ]
}

const personas = await resolvePersonas()
console.log(`Capturing baseline for ${personas.length} personas × ${args.years.length} years = ${personas.length * args.years.length} cells`)
console.log(`Writing to: ${args.outPath}`)

const rows = []
let i = 0
const total = personas.length * args.years.length
for (const personaId of personas) {
  for (const taxYear of args.years) {
    i++
    try {
      const snap = await generateSnapshot(personaId, taxYear)
      rows.push({
        personaId,
        taxYear,
        fq:       Number(snap.fq_score ?? snap.fq ?? 0),
        risk:     Number(snap.risk_score ?? snap.risk ?? 0),
        netWorth: Number(snap.net_worth ?? snap.netWorth ?? 0),
        snapshotHash: hashSnapshot(snap),
      })
      if (i % 10 === 0 || i === total) {
        console.log(`[${i}/${total}] ${personaId} ${taxYear}`)
      }
    } catch (e) {
      console.error(`[${i}/${total}] ${personaId} ${taxYear} — FAILED: ${e.message}`)
      rows.push({
        personaId, taxYear, fq: 0, risk: 0, netWorth: 0, snapshotHash: null,
        error: e.message,
      })
    }
  }
}

const payload = {
  _meta: {
    capturedAt: new Date().toISOString(),
    personaCount: personas.length,
    yearCount: args.years.length,
    cellCount: rows.length,
    errors: rows.filter(r => r.error).length,
    note: 'L4-4 baseline. Re-capture only when you DELIBERATELY change rules or fixtures.',
  },
  cells: rows,
}

fs.mkdirSync(path.dirname(args.outPath), { recursive: true })
fs.writeFileSync(args.outPath, JSON.stringify(payload, null, 2))
console.log(`\n✓ Baseline written: ${rows.length} rows, ${payload._meta.errors} errors`)
