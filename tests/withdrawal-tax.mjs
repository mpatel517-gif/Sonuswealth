// tests/withdrawal-tax.mjs — per-year withdrawal tax + AllowanceLedger contract.
// Hand-calcs derive expectations FROM the live TAX bundle (no hardcoded figures),
// so the test tracks the bundle and still catches wrong-key regressions.
import { withdrawalTaxForYear, buildAllowanceLedger } from '../src/engine/withdrawal-tax.js'
import { TAX, incomeTax, calcPersonalAllowance, calcDividendTax } from '../src/engine/fq-calculator.js'
import { readFileSync } from 'node:fs'

let fails = 0, passes = 0
const log = (ok, m) => { ok ? (passes++, console.log('✓ ' + m)) : (fails++, console.log('✗ ' + m)) }

const BRUCE = JSON.parse(readFileSync(new URL('../src/rules/personas/persona-a.json', import.meta.url)))

console.log('\n── withdrawalTaxForYear: income ──')
{
  // Pure pension drawdown, no state pension — must equal the reused incomeTax().
  const r = withdrawalTaxForYear({ pensionDrawdown: 50000 })
  const expect = incomeTax(50000, 0, calcPersonalAllowance(50000))
  log(r.incomeTax === expect, `£50k drawdown income tax === incomeTax() (${r.incomeTax})`)
  log(r.cgt === 0 && r.dividendTax === 0, 'no CGT/dividend tax when none realised')
  log(r.total === expect, 'total === income tax alone here')
}
{
  // Drawdown + state pension stack correctly.
  const r = withdrawalTaxForYear({ pensionDrawdown: 30000, statePension: TAX.statePensionFull })
  const expect = incomeTax(30000, TAX.statePensionFull, calcPersonalAllowance(30000 + TAX.statePensionFull))
  log(r.incomeTax === expect, `drawdown + state pension taxed together (${r.incomeTax})`)
}

console.log('\n── withdrawalTaxForYear: tax-free routes ──')
{
  const r = withdrawalTaxForYear({ isaWithdrawal: 30000, pcls: 20000 })
  log(r.total === 0, 'ISA withdrawal + 25% PCLS are entirely tax-free')
  log(r.taxFreeUsed.pcls === 20000 && r.taxFreeUsed.isaWithdrawal === 30000, 'tax-free routes recorded')
}

console.log('\n── withdrawalTaxForYear: CGT band stacking ──')
{
  // Low income → gains sit mostly in the basic-rate CGT band.
  const r = withdrawalTaxForYear({ pensionDrawdown: 20000, giaGainRealised: 10000 })
  const gainTaxable = 10000 - TAX.cgaAllowance
  const expectCgt = Math.round(gainTaxable * TAX.cgtBasic)
  log(r.cgt === expectCgt, `£10k gain less AEA at basic CGT rate (${r.cgt} === ${expectCgt})`)
  log(r.breakdown.gainTaxable === gainTaxable, 'AEA applied to the gain')
}
{
  // Brought-forward losses reduce the gain only DOWN TO the AEA, never below.
  const r = withdrawalTaxForYear({ giaGainRealised: 10000, cgtLossesBroughtForward: 20000 })
  log(r.cgt === 0, 'b/f losses wipe the taxable gain → £0 CGT')
  log(r.taxFreeUsed.cgtLossesUsed === 10000 - TAX.cgaAllowance, `only losses needed to reach AEA used (${r.taxFreeUsed.cgtLossesUsed})`)
  log(r.taxFreeUsed.cgtLossesRemaining === 20000 - (10000 - TAX.cgaAllowance), 'excess losses carry on')
}

console.log('\n── withdrawalTaxForYear: dividends ──')
{
  const r = withdrawalTaxForYear({ dividends: 5000 })
  const expect = calcDividendTax(5000, 0).tax
  log(r.dividendTax === expect, `dividend tax === calcDividendTax() (${r.dividendTax})`)
}

console.log('\n── buildAllowanceLedger: temporal types ──')
{
  const { allowances } = buildAllowanceLedger(BRUCE)
  log(allowances.pension_aa.temporalType === 'carry_forward' && allowances.pension_aa.carryYears === 3, 'pension AA = carry_forward(3)')
  log(allowances.cgt_losses.temporalType === 'carry_forward' && allowances.cgt_losses.carryYears === Infinity, 'CGT losses = carry_forward(∞)')
  log(allowances.isa.temporalType === 'annual_reset', 'ISA = annual_reset (never banked)')
  log(allowances.iht_gift_exemption.temporalType === 'carry_forward' && allowances.iht_gift_exemption.carryYears === 1, 'IHT gift exemption = carry_forward(1)')
  log(allowances.lsa.temporalType === 'lifetime_pool', 'LSA = lifetime_pool')
  log(allowances.eis_relief.temporalType === 'carry_back' && allowances.seis_relief.temporalType === 'carry_back', 'EIS/SEIS = carry_back')
  log(allowances.marriage_allowance.carryYears === 4, 'Marriage Allowance carry_back(4)')
  log(allowances.pet_taper.temporalType === 'taper_decay', 'PET taper = taper_decay')
}

console.log('\n── buildAllowanceLedger: the two traps ──')
{
  // MPAA triggered → carry-forward VOID, only MPAA available.
  const { allowances, pensionAAAvailable, notes } = buildAllowanceLedger(BRUCE, { mpaaTriggered: true })
  log(pensionAAAvailable === TAX.mpaa, `MPAA → available = MPAA (${pensionAAAvailable} === ${TAX.mpaa})`)
  log(allowances.pension_aa.carryForwardTotal === 0, 'MPAA → carry-forward total zeroed')
  log(notes.some(n => /MPAA/.test(n)), 'MPAA void surfaced in notes')
}
{
  // No MPAA → available = current remaining + carry-forward total.
  const { allowances, pensionAAAvailable } = buildAllowanceLedger(BRUCE, { mpaaTriggered: false })
  const expect = allowances.pension_aa.currentRemaining + allowances.pension_aa.carryForwardTotal
  log(pensionAAAvailable === expect, `no MPAA → available = current + carry-forward (${pensionAAAvailable})`)
}
{
  // IHT gift exemption carry-forward(1): available = current + min(current, lastYearUnused).
  const e = { ...BRUCE, giftExemptionLastYearUnused: 3000 }
  const { allowances } = buildAllowanceLedger(e)
  log(allowances.iht_gift_exemption.available === TAX.annualGiftExemption * 2, 'unused last-year £3k → £6k available (carry one year)')
  const e2 = { ...BRUCE, giftExemptionLastYearUnused: 9999 }
  log(buildAllowanceLedger(e2).allowances.iht_gift_exemption.lastYearUnused === TAX.annualGiftExemption, 'last-year carry capped at one annual exemption')
}

console.log(`\nwithdrawal-tax — pass=${passes} fail=${fails}`)
process.exit(fails === 0 ? 0 : 1)
