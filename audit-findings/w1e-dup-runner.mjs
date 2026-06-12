// W1-E scratch — duplication disagreement runner (read-only, no source edits)
import fs from 'node:fs';
const P = (n) => JSON.parse(fs.readFileSync(`./src/rules/personas/${n}.json`, 'utf8'));
const fq = await import('../src/engine/fq-calculator.js');
const te = await import('../src/engine/tax-estate-engine.js');
const mf = await import('../src/engine/monthly-flow-engine.js');
const ti = await import('../src/engine/taxable-income.js');
const hp = await import('../src/engine/_helpers.js');
const pj = await import('../src/engine/projection.js');
const bundle = JSON.parse(fs.readFileSync('./src/rules/UK-2026.1.1.json', 'utf8'));

const personas = { 'mrT-core': P('mrT-core'), 'persona-a': P('persona-a'), 'persona-family': P('persona-family') };

// replica of tax-estate-engine private _grossIncome
const grossIncomeTE = (e) => {
  const inc = e.income || {};
  return (inc.salary||0)+(inc.selfEmployed||0)+(inc.rental||0)+(inc.other||0)+(e.drawdown||0);
};
// replica of cashflowFlow's inline NI
const niInline = (e) => {
  const N = bundle.nationalInsurance;
  const sal = Math.max(+(e?.individual?.gross_salary||0), +(e?.income?.salary||0), +(e?.income?.employment||0), +(e?.income?.directorSalary||0));
  return Math.round(Math.max(0, Math.min(sal, N.upperEarningsLimit)-N.primaryThreshold)*N.class1EmployeeRate + Math.max(0, sal-N.upperEarningsLimit)*N.class1EmployeeRateAboveUEL);
};

const r = (x) => { try { return typeof x === 'function' ? x() : x } catch (e) { return 'ERR:'+e.message } };

for (const [name, e] of Object.entries(personas)) {
  console.log(`\n===== ${name} =====`);
  console.log('inputs: income=', JSON.stringify(e.income), ' drawdown=', e.drawdown, ' age=', e.age ?? e.individual?.age, ' dob=', e.dob ?? e.individual?.dob);

  // 1. surplus engines
  const flow = r(() => mf.monthlyFlow(e));
  const surp = r(() => fq.monthlySurplus(e));
  console.log('monthlyFlow:    income/mo', flow.monthlyIncome, 'exp/mo', flow.monthlyExpenses, 'surplus', flow.surplus);
  console.log('monthlySurplus: income/mo', surp.income, 'essential', surp.essential, 'tax', surp.tax, 'surplus', surp.surplus, 'deficit', surp.deficit);

  // 2. income aggregations
  console.log('calcAllIncome.total     ', r(() => fq.calcAllIncome(e).total));
  console.log('taxableIncomeBkdn.total ', r(() => ti.taxableIncomeBreakdown(e).total));
  console.log('  parts', JSON.stringify(r(() => ti.taxableIncomeBreakdown(e).parts)));
  console.log('annualIncome(_helpers)  ', r(() => hp.annualIncome(e)));
  console.log('grossIncomeTE(replica)  ', grossIncomeTE(e));

  // 3. allowanceTrackers
  const atF = r(() => fq.allowanceTracker(e));
  const atT = r(() => te.allowanceTracker(e));
  console.log('allowanceTracker fq: isa.used', atF?.isa?.used, 'cgt.used', atF?.cgt?.used, 'div.used', atF?.dividend?.used);
  console.log('allowanceTracker te: isa.used', atT?.isa?.used, 'cgt.used', atT?.cgt?.used, 'div.used', atT?.dividend?.used, 'penAA.used', atT?.pension_aa?.current_year?.used);

  // 4. NIC
  const nd = r(() => te.nicsDetail(e));
  console.log('nicsDetail.total_nic', nd?.total_nic, '(class1', nd?.class1, 'class4', nd?.class4, ') vs cashflowFlow-inline-NI', niInline(e));

  // 5. tax
  const cit = r(() => fq.calcIncomeTax(e));
  console.log('calcIncomeTax.tax', cit?.tax, 'base', JSON.stringify(cit?.base));
  console.log('calcANI.ani', r(() => fq.calcANI(e).ani));

  // 6. IHT
  const ihD = r(() => fq.ihtDynamic(e, true));
  const ihE = r(() => te.ihtExposure(e));
  console.log('ihtDynamic(fq):  iht', ihD?.iht, 'taxable', ihD?.taxable, 'estate', ihD?.estate ?? ihD?.gross);
  console.log('ihtExposure(te): keys', ihE && typeof ihE === 'object' ? Object.keys(ihE).join(',') : ihE);
  if (ihE && typeof ihE === 'object') console.log('  te vals', JSON.stringify(ihE).slice(0, 400));

  // 7. net worth + projections
  const nw = r(() => fq.netWorth(e));
  console.log('netWorth', nw, '| netWorthAtYears(10)', r(() => fq.netWorthAtYears(e, 10)), '| netWorthAtHorizon(10)', r(() => pj.netWorthAtHorizon(e, 10)));
}
