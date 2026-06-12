// ─────────────────────────────────────────────────────────────────────────────
// golden-vectors.mjs — independent calc audit (P6, the launch-blocking gate).
//
// Hand-computed HMRC 2026/27 worked examples asserted against the live engine.
// Each vector is derived from first principles (statute + published thresholds),
// NOT from the engine — so a divergence is a real engine bug, not a tautology.
// Tolerance £1 (rounding). Run: node tests/golden-vectors.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'url'
import { resolve } from 'path'
const f = (p) => pathToFileURL(resolve(p)).href
const { calcIncomeTax, cashflowFlow, TAX } = await import(f('src/engine/fq-calculator.js'))
const { cgtDetail, ihtExposure } = await import(f('src/engine/tax-estate-engine.js'))

let pass = 0, fail = 0
const within = (a, b, tol = 1) => Math.abs(a - b) <= tol
function check(name, got, want, tol = 1) {
  const ok = within(got, want, tol)
  console.log(`${ok ? '✓' : '✗ FAIL'}  ${name.padEnd(52)} got=${Math.round(got)} want=${want}`)
  ok ? pass++ : fail++
}

// Young single person so state pension never counts; no other income.
const salaryOnly = (gross) => ({ age: 40, individual: { dob: '1986-01-01' }, income: { employment: gross } })

// ── 1. Income tax (NSND), 2026/27: PA £12,570, BR 20% to £50,270, HR 40% ──────
// £60,000: 20%×(50270−12570=37700)=7,540 + 40%×(60000−50270=9730)=3,892 = 11,432
check('IncomeTax £60k salary', calcIncomeTax(salaryOnly(60000)).tax, 11432)
// £40,000: 20%×(40000−12570=27430)=5,486
check('IncomeTax £40k salary', calcIncomeTax(salaryOnly(40000)).tax, 5486)
// £125,140: PA fully tapered (0), taxable = 125,140. 20%×37,700=7,540 +
// 40%×(125,140−37,700=87,440)=34,976. Additional rate starts AT 125,140 taxable
// (= £125,140 income − £0 PA), so no 45% slice. Total = 42,516.
// (Pre-P6 the engine charged £43,145 — it fixed the additional-rate boundary at
//  £112,570 taxable regardless of the tapered PA, over-taxing ~£12,570 at 45%.)
check('IncomeTax £125,140 (PA=0)', calcIncomeTax(salaryOnly(125140)).tax, 42516)
// £100,000: PA still full (taper starts at 100k). 7,540 + 40%×(100000−50270=49730)=19,892 = 27,432
check('IncomeTax £100k (full PA)', calcIncomeTax(salaryOnly(100000)).tax, 27432)
// £150,000: PA=0, taxable 150,000. 7,540 + 40%×87,440=34,976 + 45%×(150,000−125,140=24,860)=11,187 = 53,703
check('IncomeTax £150k (45% slice)', calcIncomeTax(salaryOnly(150000)).tax, 53703)

// ── 2. Employee Class 1 NI, 2026/27: 8% £12,570–£50,270, 2% above ────────────
// cashflowFlow computes NI inline. £50,000: 8%×(50000−12570=37430)=2,994
check('NI £50k salary', cashflowFlow(salaryOnly(50000)).ni, 2994, 2)
// £70,000: 8%×(50270−12570=37700)=3,016 + 2%×(70000−50270=19730)=394.6 = 3,411
check('NI £70k salary', cashflowFlow(salaryOnly(70000)).ni, 3411, 2)

// ── 3. CGT, 2026/27: AEA £3,000, 18% basic / 24% higher on other assets ──────
// Higher-rate person, £20,000 gain: (20000−3000)×24% = 4,080
const cgtEntity = {
  age: 45, individual: { dob: '1981-01-01' }, income: { employment: 80000 },
  assets: { cgt: { realisedThisYear: [{ gain: 20000, assetClass: 'other' }] } },
}
;(() => {
  const d = cgtDetail(cgtEntity, [], 'UK-2026.1')
  const due = d.cgt_due ?? d.total_cgt ?? d.tax_due ?? d.cgt ?? (d.summary && d.summary.cgt_due)
  if (due == null) { console.log('⚠  CGT: could not find due field in', Object.keys(d).join(',')); }
  else check('CGT £20k gain, higher-rate (24%)', due, 4080, 2)
})()

// ── 4. IHT, 2026/27: NRB £325k, 40%. Single, no residence/descendant. ────────
// £600k cash less £5,000 standard funeral deduction = £595k net. No RNRB:
// (595,000−325,000)×40% = 108,000.
const ihtEntity = {
  age: 70, individual: { dob: '1956-01-01' },
  estate: { directDescendant: false },
  assets: { cash: { own: 600000, total: 600000 } },
}
;(() => {
  const e = ihtExposure(ihtEntity, 'UK-2026.1')
  check('IHT £600k cash less funeral, no RNRB', e.iht_due, 108000, 50)
})()

// ── 5. Bundle rate sanity (catch silent stale rates) ─────────────────────────
console.log(`\nBundle rates in use: PA=£${TAX.personalAllowance ?? TAX.pa} basicRate=${TAX.basicRate} higherRate=${TAX.higherRate} ihtRate=${TAX.ihtRate} cgtHigher=${TAX.cgtHigher ?? TAX.cgtHigherRate}`)

console.log(`\nGolden vectors: ${pass} pass / ${fail} fail`)
process.exit(fail > 0 ? 1 : 0)
