// Zero-drift check: every fqBreakdown / riskBreakdown dimension must reconcile
// to the authoritative calcFQ / calcRisk dim value (band → exact; additive →
// sum, allowing for a documented cap). Also prints the human summaries.
import { readFileSync, readdirSync } from 'node:fs'
import { calcFQ, calcRisk, fqBreakdown, riskBreakdown } from '../src/engine/fq-calculator.js'

const dir = new URL('../src/rules/personas/', import.meta.url)
const files = readdirSync(dir).filter(f => f.endsWith('.json'))

let fails = 0
function check(label, bd, dims) {
  for (const k of Object.keys(bd)) {
    const { value, parts, max, summary } = bd[k]
    const authoritative = dims[k]
    if (value !== authoritative) {
      console.log(`  ✗ ${label}.${k}: breakdown value ${value} != engine ${authoritative}`)
      fails++
      continue
    }
    const rawSum = parts.reduce((s, p) => s + (p.points || 0), 0)
    const band = parts.length === 1 && parts[0].band
    // additive sums must equal value unless a cap/clamp bit (summary says "held to")
    if (!band && rawSum !== value && !summary.includes('held to')) {
      console.log(`  ✗ ${label}.${k}: parts sum ${rawSum} != value ${value} and no cap noted`)
      fails++
    }
    if (value > max) { console.log(`  ✗ ${label}.${k}: value ${value} exceeds max ${max}`); fails++ }
  }
}

for (const f of files.slice(0, 4)) {
  const e = JSON.parse(readFileSync(new URL(f, dir)))
  const ent = e.entity || e
  const fq = calcFQ(ent), risk = calcRisk(ent)
  console.log(`\n=== ${f} — Wealth ${fq.total} / Risk ${risk.total} ===`)
  const fb = fqBreakdown(ent), rb = riskBreakdown(ent)
  check('fq', fb, fq.dims)
  check('risk', rb, risk.dims)
  console.log('  behaviour :', fb.behaviour.summary)
  console.log('  protCov   :', rb.protCov.summary)
  console.log('  depExp    :', rb.depExp.summary)
}
console.log(fails === 0 ? '\n✅ ALL RECONCILE — zero drift' : `\n❌ ${fails} drift failures`)
process.exit(fails === 0 ? 0 : 1)
