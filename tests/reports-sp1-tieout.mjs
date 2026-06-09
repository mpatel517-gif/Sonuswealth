// tests/reports-sp1-tieout.mjs — Reports SP-1 §4 numeric reconciliation.
// Every report figure must equal its engine source. Build-blocking (§9.5 Gate 2).
import { readFileSync } from 'node:fs'
import { netWorth, monthlySurplus, calcIncomeTax } from '../src/engine/fq-calculator.js'
import { liabilitiesTotal } from '../src/engine/_helpers.js'
import { ihtDeltaPrePost2027 } from '../src/engine/canonical-metrics.js'
import { buildBalanceSheet } from '../src/components/Reports/statements/balanceSheet.js'
import { buildIncomeStatement } from '../src/components/Reports/statements/incomeStatement.js'
import { buildCashflowStatement } from '../src/components/Reports/statements/cashflowStatement.js'

let fails = 0, passes = 0
const log = (ok, m) => { ok ? (passes++, console.log('✓ ' + m)) : (fails++, console.log('✗ ' + m)) }
const load = (f) => JSON.parse(readFileSync(new URL(`../src/rules/personas/${f}`, import.meta.url)))
const personas = [['a', load('persona-a.json')], ['c', load('persona-c.json')], ['mrT', load('mrT-core.json')]]

for (const [id, e] of personas) {
  console.log(`\n── persona ${id} ──`)
  const bs = buildBalanceSheet(e)
  const assets = bs.nodes.find(n => n.key === 'assets').value
  const liabs = bs.nodes.find(n => n.key === 'liabilities').value
  const nwNode = bs.nodes.find(n => n.key === 'networth').value
  const nwEngine = netWorth(e)
  log(nwNode === nwEngine, `BS NW node === netWorth() (${nwNode} === ${nwEngine})`)
  log(assets - liabs === nwEngine, `Assets − Liabilities === NW (${assets} − ${liabs} === ${nwEngine})`)
  log(liabs === liabilitiesTotal(e), `BS liabilities === liabilitiesTotal()`)

  const ms = monthlySurplus(e, 'UK-2026.1')
  const inc = buildIncomeStatement(e, 'UK-2026.1')
  const incNet = inc.nodes.find(n => n.key === 'surplus').value
  log(incNet === ms.surplus - ms.deficit, `Income surplus === NET monthlySurplus (${incNet})`)
  log(inc.nodes.find(n => n.key === 'income').value === ms.income, 'Income line === monthlySurplus.income')
  log(inc.nodes.find(n => n.key === 'tax').value === ms.tax, 'Income tax line === monthlySurplus.tax')

  const cf = buildCashflowStatement(e, 'UK-2026.1')
  const cfNet = cf.nodes.find(n => n.key === 'net').value
  log(cfNet === ms.surplus - ms.deficit, `Cashflow net === NET monthlySurplus (${cfNet})`)

  const iht = ihtDeltaPrePost2027(e)
  log(typeof iht.today === 'number', `Estate IHT today is numeric (£${iht.today})`)

  const it = calcIncomeTax(e, 'UK-2026.1')
  log(typeof it.tax === 'number', `calcIncomeTax().tax numeric (£${it.tax})`)
}

console.log(`\nreports-sp1-tieout — pass=${passes} fail=${fails}`)
process.exit(fails === 0 ? 0 : 1)
