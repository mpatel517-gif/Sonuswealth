// W1-E golden-vector + duplication runner (static audit; no source edits)
import { readFileSync } from 'node:fs';
const P = (n) => JSON.parse(readFileSync(new URL(`../../src/rules/personas/${n}.json`, import.meta.url)));

const fq = await import('../../src/engine/fq-calculator.js');
const te = await import('../../src/engine/tax-estate-engine.js');
const mf = await import('../../src/engine/monthly-flow-engine.js');
const ti = await import('../../src/engine/taxable-income.js');
const helpers = await import('../../src/engine/_helpers.js');

const personas = { 'mrT-core': P('mrT-core'), 'persona-a': P('persona-a'), 'persona-family': P('persona-family') };

for (const [name, e] of Object.entries(personas)) {
  console.log(`\n=================== ${name} ===================`);
  const bd = ti.taxableIncomeBreakdown(e);
  console.log('breakdown:', JSON.stringify({ nsnd: bd.nsnd, savings: bd.savings, dividends: bd.dividends, total: bd.total, ani: bd.ani, reliefs: bd.reliefs }));
  const cit = fq.calcIncomeTax(e);
  console.log('calcIncomeTax:', JSON.stringify({ tax: cit.tax, nsnd: cit.nsndTax, sav: cit.savingsTax, div: cit.dividendTax, marginal: cit.marginalRate }));
  const nic = te.nicsDetail(e, 0);
  console.log('nicsDetail:', JSON.stringify({ class1: nic.class1, class4: nic.class4, total: nic.total_nic, salary_assessed: nic.salary_assessed, spQual: nic.state_pension_year_qualifying }));
  const cgt = te.cgtDetail(e, helpers.cgtChargeableHoldings(e));
  console.log('cgtDetail:', JSON.stringify({ total_gain: cgt.total_gain, taxable: cgt.taxable_gain, tax_due: cgt.tax_due }));
  const iht = te.ihtExposure(e);
  console.log('ihtExposure:', JSON.stringify({ gross: iht.grossEstate ?? iht.gross_estate, taxable: iht.taxable, nrb: iht.nrb_used ?? iht.nrb, rnrb: iht.rnrb_used ?? iht.rnrb, iht: iht.netIHT ?? iht.iht ?? iht.tax }).slice(0, 400));
  try {
    const ihtD = fq.ihtDynamic(e, true);
    console.log('ihtDynamic(fq):', JSON.stringify({ estate: ihtD.estate ?? ihtD.gross, taxable: ihtD.taxable, iht: ihtD.iht }));
  } catch (err) { console.log('ihtDynamic ERR', err.message); }

  // income aggregation trio
  const cai = fq.calcAllIncome(e);
  console.log('calcAllIncome.total:', cai.total, '| _helpers.annualIncome:', helpers.annualIncome(e));

  // surplus duo
  const ms = fq.monthlySurplus(e);
  const flow = mf.monthlyFlow(e);
  console.log('monthlySurplus(fq):', JSON.stringify(ms));
  console.log('monthlyFlow(mfe):', JSON.stringify({ inc: flow.monthlyIncome, exp: flow.monthlyExpenses, surplus: flow.surplus, comp: flow.components }));

  // allowanceTracker duo
  const atFQ = fq.allowanceTracker(e);
  const atTE = te.allowanceTracker(e);
  console.log('allowanceTracker fq :', JSON.stringify({ isaUsed: atFQ.isa.used, cgtUsed: atFQ.cgt.used, divUsed: atFQ.dividend.used }));
  console.log('allowanceTracker te :', JSON.stringify({ isaUsed: atTE.isa.used, cgtUsed: atTE.cgt.used, divUsed: atTE.dividend.used, penUsed: atTE.pension_aa.current_year.used }));

  // net worth duo
  console.log('netWorth(fq):', fq.netWorth(e));

  // taxThisYear roll-up
  const tty = te.taxThisYear(e);
  console.log('taxThisYear:', JSON.stringify({ total: tty.total_tax, comps: tty.components, gross: tty.gross, ani: tty.ani }));
}
