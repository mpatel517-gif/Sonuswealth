// ─────────────────────────────────────────────────────────────────────────────
// regression-check — nightly diff vs baseline (L4-4)
//
// Reads tests/regression-baseline.json, runs a fresh capture, diffs the two,
// writes a result file, and exits non-zero on drift so a CI runner can fail
// the job and trigger Slack via GH Actions secrets.
//
// Usage:
//   node tests/harness/regression-check.mjs [--baseline path] [--out path]
//
// Defaults:
//   --baseline tests/regression-baseline.json
//   --out      tests/reports/regression-result-<iso>.json
//
// Tolerance overrides can be passed via env:
//   REGRESSION_NW_REL=0.005          (0.5% NW)
//   REGRESSION_FQ_ABS=1              (1 score point)
//   REGRESSION_RISK_ABS=1
//   REGRESSION_REQUIRE_HASH=true|false
//
// Exit codes:
//   0  — no drift, no missing cells
//   1  — drift OR missing cells (CI runner should alert)
//   2  — baseline file unreadable / fresh capture failed entirely
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { generateSnapshot } from './snapshot.mjs'
import { diffCells, hashSnapshot, formatAlert, DEFAULT_TOLERANCE } from './regression-diff.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function parseArgs(argv) {
  const out = {
    baselinePath: path.resolve(__dirname, '../regression-baseline.json'),
    outPath: null,
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--baseline') out.baselinePath = path.resolve(argv[++i])
    else if (a === '--out')      out.outPath      = path.resolve(argv[++i])
  }
  if (!out.outPath) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    out.outPath = path.resolve(__dirname, `../reports/regression-result-${ts}.json`)
  }
  return out
}

function tolerance() {
  return {
    netWorthRel:      +(process.env.REGRESSION_NW_REL   ?? DEFAULT_TOLERANCE.netWorthRel),
    fqAbs:            +(process.env.REGRESSION_FQ_ABS   ?? DEFAULT_TOLERANCE.fqAbs),
    riskAbs:          +(process.env.REGRESSION_RISK_ABS ?? DEFAULT_TOLERANCE.riskAbs),
    requireHashMatch: (process.env.REGRESSION_REQUIRE_HASH ?? 'true') !== 'false',
  }
}

const args = parseArgs(process.argv)

// ── Read baseline ──────────────────────────────────────────────────────────
let baseline
try {
  const raw = fs.readFileSync(args.baselinePath, 'utf8')
  const parsed = JSON.parse(raw)
  baseline = Array.isArray(parsed) ? parsed : (parsed.cells || [])
  if (!Array.isArray(baseline) || baseline.length === 0) {
    throw new Error('baseline has no cells')
  }
} catch (e) {
  console.error(`✗ Could not read baseline at ${args.baselinePath}: ${e.message}`)
  console.error(`  Run: node tests/harness/regression-capture.mjs`)
  process.exit(2)
}

console.log(`Baseline: ${baseline.length} cells from ${args.baselinePath}`)

// ── Fresh capture (re-uses baseline's persona × year set) ──────────────────
const fresh = []
let i = 0
for (const b of baseline) {
  i++
  try {
    const snap = await generateSnapshot(b.personaId, b.taxYear)
    fresh.push({
      personaId: b.personaId,
      taxYear:   b.taxYear,
      fq:        Number(snap.fq_score ?? snap.fq ?? 0),
      risk:      Number(snap.risk_score ?? snap.risk ?? 0),
      netWorth:  Number(snap.net_worth ?? snap.netWorth ?? 0),
      snapshotHash: hashSnapshot(snap),
    })
    if (i % 20 === 0 || i === baseline.length) {
      console.log(`[${i}/${baseline.length}] captured`)
    }
  } catch (e) {
    console.error(`[${i}/${baseline.length}] ${b.personaId} ${b.taxYear} FAILED: ${e.message}`)
    // Keep going — fresh-set may legitimately have failures (will surface as missingInFresh)
  }
}

// ── Diff ───────────────────────────────────────────────────────────────────
const t = tolerance()
console.log(`Tolerance: netWorth ${(t.netWorthRel * 100).toFixed(2)}% · fq ±${t.fqAbs} · risk ±${t.riskAbs} · hash ${t.requireHashMatch ? 'required' : 'optional'}`)

const result = diffCells(baseline, fresh, t)

// ── Write report ───────────────────────────────────────────────────────────
fs.mkdirSync(path.dirname(args.outPath), { recursive: true })
fs.writeFileSync(args.outPath, JSON.stringify({
  _meta: {
    runAt: new Date().toISOString(),
    baselinePath: args.baselinePath,
    tolerance: t,
  },
  ...result,
}, null, 2))

console.log(`\nResult: ${result.summary.matched}/${result.summary.baselineCount} matched · ${result.summary.drifted} drifted · ${result.summary.missingInFresh} missing · ${result.summary.newInFresh} new`)
console.log(`Report: ${args.outPath}`)

if (result.summary.anyDrift) {
  console.log('\n' + formatAlert(result))
  process.exit(1)
}
console.log('\n✓ No drift')
process.exit(0)
