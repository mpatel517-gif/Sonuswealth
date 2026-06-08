// tests/tax-income-tieout.mjs
//
// Cross-card TIE-OUT gate for the tax-income bug class (founder 2026-06-08:
// "you forget to check if the data matches across screens — one of your key
// failings"). The Tax & Estate screen once showed five contradictory numbers on
// one card (ANI £91k > Gross £79k; income tax £0 on £91k taxable; effective
// 0.0% with £4k tax; marginal 20% at £91k) because _grossIncome / calcAllIncome
// / calcANI / dividendTaxDetail each derived income differently.
//
//   Run: `npm run test:tax-tieout`
//
// This asserts the 5 invariants on the canonical engine outputs for EVERY
// persona fixture. "Does each card render a number" is not enough — the numbers
// must AGREE with each other. Fails loudly (exit 1) on any violation.
//
// The invariants (per 0-Active/CALC-AUDIT-tax-income-tieout.md):
//   1. Gross >= ANI                         (ANI = gross − reliefs; can't exceed gross)
//   2. income tax > 0 when NSND taxable > PA (real tax on real taxable income)
//   3. effective rate == round(total_tax / gross)
//   4. marginal rate matches the band TOTAL income sits in
//   5. one income base everywhere: taxThisYear.gross == calcIncomeTax.base.total
//      == calcANI feeds the same total; dividend stack reads the same base.

import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { TAX, calcIncomeTax, calcANI, calcAllIncome } from '../src/engine/fq-calculator.js'
import { taxableIncomeBreakdown } from '../src/engine/taxable-income.js'
import { taxThisYear, incomeTaxDetail, dividendTaxDetail } from '../src/engine/tax-estate-engine.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PERSONA_DIR = join(__dirname, '..', 'src', 'rules', 'personas')

const PA  = TAX.pa
const BRT = TAX.brt
const ART = TAX.art
const TAPER = TAX.adjustedNetIncomeCliff ?? 100000

const personaFiles = readdirSync(PERSONA_DIR).filter(f => f.endsWith('.json'))

const failures = []
const fail = (id, msg) => failures.push(`  ✗ ${id}: ${msg}`)

let checked = 0
for (const file of personaFiles) {
  const id = file.replace('.json', '')
  let entity
  try {
    const j = JSON.parse(readFileSync(join(PERSONA_DIR, file), 'utf8'))
    entity = j.entity || j
  } catch (e) { fail(id, `unreadable fixture: ${e.message}`); continue }

  let t, cit, bd, divd
  try {
    t    = taxThisYear(entity)
    cit  = calcIncomeTax(entity)
    bd   = taxableIncomeBreakdown(entity)
    divd = dividendTaxDetail(entity, entity.assets?.portfolio?.holdings || [])
    incomeTaxDetail(entity) // must not throw
  } catch (e) { fail(id, `engine threw: ${e.message}`); continue }
  checked++

  const gross = t.gross, ani = t.ani, totalTax = t.total_tax

  // 1. Gross >= ANI
  if (ani > gross + 1) fail(id, `ANI £${ani} > Gross £${gross} (impossible)`)

  // 2. income tax > 0 when non-savings taxable income exceeds the personal allowance
  if (bd.nsnd > PA + 1 && t.components.income_tax <= 0) {
    fail(id, `income tax £${t.components.income_tax} but NSND £${bd.nsnd} > PA £${PA}`)
  }

  // 3. effective rate == total_tax / gross
  if (gross > 0) {
    const expected = Math.round((totalTax / gross) * 1000) / 1000
    if (Math.abs(t.effective_rate - expected) > 0.001) {
      fail(id, `effective ${t.effective_rate} != total_tax/gross ${expected} (tax £${totalTax} / gross £${gross})`)
    }
  }

  // 4. marginal rate matches the band TOTAL income sits in
  let band
  if (ani <= PA) band = 0
  else if (ani > TAPER && ani < ART) band = 0.60  // PA-taper zone
  else if (ani > ART) band = TAX.ar
  else if (ani > BRT) band = TAX.hr
  else band = TAX.br
  if (Math.abs(t.marginal_rate - band) > 0.001) {
    fail(id, `marginal ${t.marginal_rate} != band ${band} for total income £${ani}`)
  }

  // 5. one income base everywhere
  if (Math.abs(gross - cit.base.total) > 1) {
    fail(id, `taxThisYear.gross £${gross} != calcIncomeTax.base.total £${cit.base.total}`)
  }
  const aniSel = calcANI(entity).ani
  // calcANI applies extra reliefs (gift aid/trade losses); with none it must equal the base total.
  const hasExtraReliefs = (+entity.giftAidAnnual || 0) + (+entity.pensionContribAnnual || 0) +
                          (+entity.pensionContribMonthly || 0) + (+entity.tradeLosses || 0) +
                          (+entity.qualifyingInterest || 0) > 0
  if (!hasExtraReliefs && Math.abs(aniSel - bd.total) > 1) {
    fail(id, `calcANI £${aniSel} != breakdown.total £${bd.total} (no extra reliefs)`)
  }
  // dividend stack must read the same base (gia_exposed == breakdown.dividends)
  if (Math.abs(divd.gia_exposed - bd.dividends) > 1) {
    fail(id, `dividend gia_exposed £${divd.gia_exposed} != breakdown.dividends £${bd.dividends}`)
  }
  // calcAllIncome.total is the GROSS (cashflow) view and may legitimately differ
  // from the taxable base by net-rental + savings classification — not asserted equal.
  void calcAllIncome
}

if (failures.length) {
  console.error(`\n🔴 tax-income tie-out FAILED — ${failures.length} violation(s) across ${checked} personas:\n`)
  console.error(failures.join('\n'))
  console.error('\nSee 0-Active/CALC-AUDIT-tax-income-tieout.md for the canonical fix.')
  process.exit(1)
}

console.log(`✓ tax-income tie-out — 5 invariants hold across ${checked} personas (PA £${PA}, BRT £${BRT}, ART £${ART}).`)
