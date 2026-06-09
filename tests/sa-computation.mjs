// tests/sa-computation.mjs
//
// Tie-out gate for the SA filing-format engine (src/engine/sa-computation.js,
// M1·1C). The SA computation ORCHESTRATES the canonical engine — so its numbers
// must AGREE with te_taxThisYear / te_cgtDetail, not re-derive them. Plus targeted
// checks for payments-on-account, the carry-forward ledger, and capital-loss
// application.
//
//   Run: node tests/sa-computation.mjs
//
// Fails loudly (exit 1) on any violation.

import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { calcIncomeTax, te_taxThisYear, te_cgtDetail } from '../src/engine/fq-calculator.js'
import { saComputation, paymentsOnAccount } from '../src/engine/sa-computation.js'
import { buildCarryForwardLedger } from '../src/engine/carry-forward-state.js'
import { buildTaxYearState } from '../src/engine/ask-sonu/tax-year-state.js'
import { upsertPriorYear, deriveCarryForwardFromHistory } from '../src/state/tax-history.js'
import { calcTaxLiabilities } from '../src/engine/timeline-engine.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PERSONA_DIR = join(__dirname, '..', 'src', 'rules', 'personas')

const failures = []
const fail = (id, msg) => failures.push(`  ✗ ${id}: ${msg}`)
const near = (a, b, tol = 1) => Math.abs((+a || 0) - (+b || 0)) <= tol

// ── 1. Persona tie-outs ──────────────────────────────────────────────────────
const personaFiles = readdirSync(PERSONA_DIR).filter((f) => f.endsWith('.json'))
let checked = 0
for (const file of personaFiles) {
  const id = file.replace('.json', '')
  let entity
  try {
    const j = JSON.parse(readFileSync(join(PERSONA_DIR, file), 'utf8'))
    entity = j.entity || j
  } catch (e) { fail(id, `unreadable fixture: ${e.message}`); continue }

  let sa, t, cit, cgt
  try {
    sa = saComputation(entity)
    t = te_taxThisYear(entity)
    cit = calcIncomeTax(entity)
    cgt = te_cgtDetail(entity, [])
  } catch (e) { fail(id, `engine threw: ${e.message}`); continue }
  checked++

  const c = sa.computation

  // income_tax_due == te_taxThisYear income_tax (nsnd) + savings_tax
  if (!near(c.income_tax_due, t.components.income_tax + t.components.savings_tax)) {
    fail(id, `income_tax_due £${c.income_tax_due} != taxThisYear nsnd+savings £${t.components.income_tax + t.components.savings_tax}`)
  }
  // dividend_tax matches
  if (!near(c.dividend_tax, t.components.dividend_tax)) {
    fail(id, `dividend_tax £${c.dividend_tax} != taxThisYear £${t.components.dividend_tax}`)
  }
  // cgt_due == te_cgtDetail.tax_due when no carry-forward capital losses applied
  const lossApplied = !sa.provenance.carry_forward.losses.provisional && (entity?.carryForward?.losses?.capital_cf > 0 || entity?.assets?.cgt?.carryForwardLosses > 0)
  if (!lossApplied && !near(c.cgt_due, cgt.tax_due)) {
    fail(id, `cgt_due £${c.cgt_due} != te_cgtDetail £${cgt.tax_due} (no losses applied)`)
  }
  // Σ(band amount × rate) ≈ cit.tax (= income tax + dividend tax)
  const bandTax = c.tax_by_band.reduce((s, b) => s + b.amount * b.rate, 0)
  if (!near(bandTax, cit.tax, 2)) {
    fail(id, `Σ band tax £${Math.round(bandTax)} != calcIncomeTax.tax £${cit.tax}`)
  }
  // SA100 always present; sections non-empty
  if (!sa.sections.length || !sa.sections.some((s) => s.page === 'SA100')) {
    fail(id, `missing SA100 / empty sections`)
  }
  // balancing_payment never negative
  if (c.balancing_payment < 0) fail(id, `negative balancing payment £${c.balancing_payment}`)
}

// ── 2. Payments on account (TMA 1970 s59A) ───────────────────────────────────
{
  const big = paymentsOnAccount(10000, 0, 10000) // £10k IT+C4, no PAYE
  if (!big.required || big.each !== 5000) fail('POA-50%', `expected required+£5,000 each, got ${JSON.stringify(big)}`)
  const small = paymentsOnAccount(500, 0, 500) // below £1,000 de-minimis
  if (small.required) fail('POA-deminimis', `£500 liability should not require POA`)
  const mostlyPaye = paymentsOnAccount(2000, 9000, 2000) // ≥80% at source
  if (mostlyPaye.required) fail('POA-80pct', `≥80% taxed at source should not require POA`)
}

// ── 3. Carry-forward ledger ──────────────────────────────────────────────────
{
  // year-keyed object → ordered array [most recent … oldest]
  const e = { pension: { carryForward: { 'tax-2023-24': 3000, 'tax-2024-25': 5000, 'tax-2025-26': 9000 } } }
  const led = buildCarryForwardLedger(e)
  const arr = led.fields.pension_aa_unused
  if (!(arr[0] === 9000 && arr[1] === 5000 && arr[2] === 3000)) {
    fail('CF-order', `pension_aa_unused mis-ordered: ${JSON.stringify(arr)} (expected [9000,5000,3000])`)
  }
  if (led.provenance.pension_aa_unused.provisional) fail('CF-prov', `real carry-forward wrongly flagged provisional`)
  // empty entity → provisional honest-absence
  const empty = buildCarryForwardLedger({})
  if (!empty.provenance.gifts_history.provisional || !empty.provenance.gifts_history.assumption) {
    fail('CF-absence', `empty gifts_history should be provisional with an assumption`)
  }
  if (empty.fields.mpaa.triggered !== false) fail('CF-default', `empty mpaa should default to not-triggered`)
}

// ── 4. Capital losses reduce the chargeable gain ─────────────────────────────
{
  const base = {
    income: { salary: 60000 },
    assets: { cgt: { realisedThisYear: [{ asset: 'GIA', gain: 50000 }] } },
  }
  const withLoss = { ...base, carryForward: { losses: { capital_cf: 20000, rental_cf: 0, trading_cf: 0 } } }
  const a = saComputation(base).computation.cgt_due
  const b = saComputation(withLoss).computation.cgt_due
  if (!(b < a)) fail('CGT-loss', `capital losses c/f should reduce CGT: no-loss £${a}, with-loss £${b}`)
}

// ── 5. tax-year-state rewire: carry-forward flows into AA headroom ───────────
{
  const e = {
    income: { salary: 80000 },
    pensionContributions: 10000,
    pension: { carryForward: { 'tax-2023-24': 3000, 'tax-2024-25': 5000, 'tax-2025-26': 9000 } },
  }
  const st = buildTaxYearState(e)
  if (st.pension_aa.carryForward !== 17000) fail('TYS-cf', `aa.carryForward £${st.pension_aa.carryForward} != £17,000`)
  if (st.pension_aa.totalAvailable !== st.pension_aa.effective + 17000) {
    fail('TYS-total', `aa.totalAvailable £${st.pension_aa.totalAvailable} != effective+cf`)
  }
  if (st.pension_aa.remaining !== Math.max(0, st.pension_aa.totalAvailable - 10000)) {
    fail('TYS-remaining', `aa.remaining wrong: £${st.pension_aa.remaining}`)
  }
  if (st.pension_carry_forward_provisional) fail('TYS-prov', `real carry-forward wrongly provisional`)

  const empty = buildTaxYearState({ income: { salary: 40000 } })
  if (!empty.pension_carry_forward_provisional) fail('TYS-absence', `absent carry-forward should be provisional`)
  if (empty.pension_aa.carryForward !== 0) fail('TYS-abszero', `absent carry-forward should be £0`)
}

// ── 6. Prior-year store: round-trip + flips POA/balancing provisional→firm ───
{
  // minimal localStorage/window shim for node
  const _ls = {}
  globalThis.window = {
    localStorage: { getItem: (k) => (k in _ls ? _ls[k] : null), setItem: (k, v) => { _ls[k] = String(v) }, removeItem: (k) => { delete _ls[k] } },
    dispatchEvent: () => {}, addEventListener: () => {}, removeEventListener: () => {},
  }
  upsertPriorYear('test', {
    taxYear: '2025/26',
    figures: { incomeTaxPlusClass4: 10000, payeTaxPaid: 0, pensionAaUnused: 5000, lossesCarried: { capital: 8000, rental: 0, trading: 0 }, gifts: [] },
  })
  const derived = deriveCarryForwardFromHistory('test', '2026/27')
  if (derived._priorYearLiability !== 10000) fail('TH-poa', `priorYearLiability £${derived._priorYearLiability} != £10,000`)
  if (derived.losses.capital_cf !== 8000) fail('TH-loss', `capital_cf £${derived.losses?.capital_cf} != £8,000`)
  if (derived.pension_aa_unused?.[0] !== 5000) fail('TH-aa', `pension_aa_unused[0] £${derived.pension_aa_unused?.[0]} != £5,000 (y-1)`)

  const ent = { income: { salary: 60000, dividends: 20000 } }
  const before = saComputation(ent).computation
  const after = saComputation(ent, 'tax-2026-27', 'UK-2026.1', { priorYearStore: derived, priorYearLiability: derived._priorYearLiability }).computation
  if (after.payments_on_account_made !== 10000) fail('TH-made', `POA made £${after.payments_on_account_made} != £10,000 after prior-year added`)
  if (!(after.balancing_payment < before.balancing_payment)) fail('TH-balance', `balancing payment should drop after POA made: before £${before.balancing_payment}, after £${after.balancing_payment}`)
  delete globalThis.window
}

// ── 7. Timeline tax liabilities (M3) ─────────────────────────────────────────
{
  const now = new Date('2026-06-09T00:00:00Z')
  const ent = { income: { salary: 60000, dividends: 20000 } }
  const sa = saComputation(ent)
  const liabs = calcTaxLiabilities(ent, { sa, now })
  const bal = liabs.find((l) => l.id === 'sa-balancing')
  const p1 = liabs.find((l) => l.id === 'sa-poa-1')
  const p2 = liabs.find((l) => l.id === 'sa-poa-2')
  if (!bal || bal.amount !== sa.computation.balancing_payment) fail('TL-bal', `balancing item missing/mismatched`)
  if (!p1 || !/-01-31$/.test(p1.dateISO)) fail('TL-poa1', `POA#1 not on 31 Jan: ${p1?.dateISO}`)
  if (!p2 || !/-07-31$/.test(p2.dateISO)) fail('TL-poa2', `POA#2 not on 31 Jul: ${p2?.dateISO}`)
  if (p1 && p1.amount !== sa.computation.poa_next_year[0]?.amount) fail('TL-poa1amt', `POA#1 amount mismatch`)
  // CGT 60-day property report
  const propEnt = { income: { salary: 50000 }, assets: { cgt: { realisedThisYear: [{ asset: 'BTL property', gain: 40000, saleDate: '2026-05-01' }] } } }
  const propLiabs = calcTaxLiabilities(propEnt, { sa: saComputation(propEnt), now })
  const cgt = propLiabs.find((l) => l.id.startsWith('cgt-60'))
  if (!cgt || cgt.dateISO !== '2026-06-30') fail('TL-cgt', `CGT 60-day report not at saleDate+60: ${cgt?.dateISO}`)
}

// ── 8. Comprehensive pages (M4) appear when triggered, omit otherwise ────────
{
  const pagesOf = (e) => saComputation(e).sections.map((s) => s.page)
  const plain = pagesOf({ income: { salary: 50000 } })
  for (const p of ['SA104', 'SA106', 'SA107', 'SA109']) {
    if (plain.includes(p)) fail('M4-omit', `${p} should be omitted for a plain salary persona`)
  }
  if (!pagesOf({ income: { salary: 40000, partnership: 30000 } }).includes('SA104')) fail('M4-sa104', `SA104 missing for partnership income`)
  if (!pagesOf({ income: { salary: 40000, overseasIncome: 8000 } }).includes('SA106')) fail('M4-sa106', `SA106 missing for foreign income`)
  if (!pagesOf({ income: { salary: 40000, trustIncome: 5000 } }).includes('SA107')) fail('M4-sa107', `SA107 missing for trust income`)
  if (!pagesOf({ income: { salary: 40000 }, nonUKResident: true }).includes('SA109')) fail('M4-sa109', `SA109 missing for non-resident`)
}

if (failures.length) {
  console.error(`\n🔴 sa-computation tie-out FAILED — ${failures.length} violation(s) across ${checked} personas:\n`)
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log(`✓ sa-computation — orchestration tie-outs hold across ${checked} personas; POA, ledger, and loss-application checks pass.`)
