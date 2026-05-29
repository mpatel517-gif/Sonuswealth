// =====================================================================
// SONUSWEALTH — parts/3-Engine/test-uk-cashflow.js
// =====================================================================
// Smoke test for uk-cashflow-2026-1-1.js engine.
// Built at s17b-1c-eng (8 May 2026 · Track A · Code · Opus).
//
// Run from parts/3-Engine/:
//   node test-uk-cashflow.js
//
// Coverage: ~120+ assertions across 10 sections.
//   §1  Archetype + view mode (B)
//   §2  Domain P expense + tax + surplus (C)
//   §3  SWR + funded ratio + GK + Bengen + path (E)
//   §4  Bucket + Floor-Upside (F)
//   §5  Monte Carlo + risk metrics (G)
//   §6  Scenarios + goal-seek (H)
//   §7  CoI integration: handlers + variants + extras flow (I)
//   §8  Health + liquidity (J)
//   §9  Stubs (K)
//   §10 Drawdown sequencing + failure modes + cross-bundle (M, L)
// =====================================================================

import * as cf from './uk-cashflow-2026-1-1.js';
import { ACTION_DOMAINS, DEFAULT_HANDLERS, composeHandlers, costOfInaction, totalCoI }
  from './lib/canonical-coi.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const cma = JSON.parse(fs.readFileSync(path.join(__dirname, 'bundles', 'UK-CMA-2026.1.json'), 'utf8'));
const taxBundle = JSON.parse(fs.readFileSync(path.join(__dirname, 'bundles', 'UK-master-2026.1.1.json'), 'utf8'));

let pass = 0, fail = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    const msg = detail ? `${name} — ${detail}` : name;
    failures.push(msg);
    console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`);
  }
}

function checkEnvelope(name, result) {
  check(`${name} returns envelope shape`,
    typeof result === 'object' &&
    'amount' in result && 'breakdown' in result &&
    'rules' in result && 'explanation' in result,
    `got: ${JSON.stringify(Object.keys(result || {}))}`);
}

// =========================================================
// Test entities
// =========================================================

const populated_50yo = {
  age: 50,
  dateOfBirth: '1976-05-08',
  retirementAge: 67,
  longevityAge: 92,
  targetIncomeReal: 35000,
  annualIncome: 80000,
  pensionContributedThisYear: 20000,
  isaSubscribedThisYear: 10000,
  flags: [],
  income: [
    { id: 'salary', label: 'Salary', gross_annual: 80000, type: 'employment',
      class: 'non_savings', volatility: 0.1 },
    { id: 'div',    label: 'Dividends', gross_annual: 5000, type: 'investment',
      class: 'dividends', volatility: 0.3 },
  ],
  expenses: [
    { id: 'mortgage', label: 'Mortgage', monthly: 1500, class: 'FC', waterfall_step: 1 },
    { id: 'utilities', label: 'Utilities', monthly: 300, class: 'E', waterfall_step: 2 },
    { id: 'food', label: 'Food', monthly: 600, class: 'E', waterfall_step: 2 },
    { id: 'discretionary', label: 'Dining out', monthly: 400, class: 'D', waterfall_step: 3 },
  ],
  assets: [
    { type: 'sipp', value: 400000, isPension: true, retirement: true },
    { type: 'isa',  value: 80000 },
    { type: 'cash', value: 30000 },
    { type: 'mainResidence', value: 600000, isMainResidence: true },
    { type: 'equityFund', value: 50000 },
  ],
  liabilities: [
    { id: 'mortgage', label: 'Mortgage', balance: 200000, interestRate: 0.045,
      monthlyPayment: 1500 },
  ],
  portfolioAllocation: { uk_equity: 0.30, global_equity_ex_uk: 0.30, uk_gilts_medium: 0.20, cash: 0.20 },
  giftHistory: [],
};

const new_user = { age: 28, dateOfBirth: '1998-01-01', flags: [], income: [], expenses: [], assets: [] };

const insufficient = {
  age: 40, flags: [], income: [{ gross_annual: 50000, class: 'non_savings' }],
  expenses: [], assets: [], liabilities: []
};

const director = {
  ...populated_50yo,
  flags: ['director'],
  expenses: [
    ...populated_50yo.expenses,
    { id: 'office', label: 'Office rent', monthly: 800, class: 'BA', waterfall_step: 4 },
    { id: 'sa_obligation', label: 'SA tax payment', monthly: 1200, class: 'TX',
      due_date: '2027-01-31', tax_type: 'sa_balancing' },
  ]
};

// =========================================================
// §1 — Archetype + view mode
// =========================================================
console.log('\n§1 — Archetype + view mode');
{
  const arch1 = cf.detectCFArchetype(populated_50yo);
  check('archetype: populated entity → "populated"', arch1.archetype === 'populated');
  check('archetype: includes reasons array', Array.isArray(arch1.reasons));

  const arch2 = cf.detectCFArchetype(new_user);
  check('archetype: empty entity → "new_user"', arch2.archetype === 'new_user');

  const arch3 = cf.detectCFArchetype(insufficient);
  check('archetype: income only, no expense → "insufficient"', arch3.archetype === 'insufficient');

  const arch4 = cf.detectCFArchetype({ ...populated_50yo, flags: ['degraded'] });
  check('archetype: degraded flag → "degraded"', arch4.archetype === 'degraded');

  check('viewMode: regular → "simple"', cf.inferCashflowViewMode(populated_50yo) === 'simple');
  check('viewMode: director → "accountant"', cf.inferCashflowViewMode(director) === 'accountant');
  check('viewMode: self_employed flag → "accountant"',
    cf.inferCashflowViewMode({ ...populated_50yo, flags: ['self_employed'] }) === 'accountant');
}

// =========================================================
// §2 — Domain P expense + tax + surplus
// =========================================================
console.log('\n§2 — Domain P expense + tax + surplus');
{
  const profile = cf.monthlyExpenseProfile(populated_50yo);
  checkEnvelope('monthlyExpenseProfile', profile);
  check('profile: 4 items', profile.breakdown.item_count === 4);
  check('profile: total = 2800', profile.breakdown.total_monthly === 2800);
  check('profile: total annual = 33600', profile.breakdown.total_annual === 33600);

  const ed = cf.essentialVsDiscretionaryRatio(populated_50yo, cma);
  checkEnvelope('essentialVsDiscretionaryRatio', ed);
  check('E/D: essential includes utilities + food (£10800)', ed.breakdown.essential_total === 10800);
  check('E/D: discretionary £4800', ed.breakdown.discretionary_total === 4800);
  check('E/D: ratio is 10800/(10800+4800)=0.692',
    Math.abs(ed.breakdown.ratio - 10800 / 15600) < 0.001);
  check('E/D: benchmark applied (cma loaded)', ed.breakdown.life_stage_benchmark !== null);

  const tax = cf.taxPaymentSchedule(director, 2026, taxBundle, cma);
  checkEnvelope('taxPaymentSchedule', tax);
  check('tax schedule: at least 1 TX item', tax.breakdown.items.length >= 1);
  check('tax schedule: includes late_payment_interest_rate from CMA',
    typeof tax.breakdown.late_payment_interest_rate === 'number');

  const allowable = cf.allowableExpenseTotal(director);
  check('allowable: director gate passes', allowable.breakdown.persona_gate === 'director');
  check('allowable: total = 9600 (£800/mo × 12)', allowable.amount === 9600);

  const blocked = cf.allowableExpenseTotal(populated_50yo);
  check('allowable: non-director blocked', blocked.breakdown.persona_gate?.includes('BLOCKED'));

  const childcare = cf.childcareNetCost(
    { ...populated_50yo,
      expenses: [{ id: 'cc', monthly: 800, class: 'E', subclass: 'childcare' }],
      children: [{ age: 4 }, { age: 7 }],
      youngest_child_age: 4,
      parentAnnualIncome: 60000
    }, cma);
  check('childcare: returns net cost ≥ 0', childcare.amount >= 0);
  check('childcare: identifies tfc_eligible',
    typeof childcare.breakdown.tfc_eligible === 'boolean');

  const giftsCheck = cf.giftsFromNormalIncomeCheck(populated_50yo);
  check('gifts: returns OPEN status when N not set',
    giftsCheck.breakdown.open_item?.includes('O-CF-RULES-06'));

  const surplus = cf.recommendedSurplusAllocation(populated_50yo, 12000, taxBundle);
  checkEnvelope('recommendedSurplusAllocation', surplus);
  check('surplus: allocation array non-empty', surplus.breakdown.allocation.length > 0);
  check('surplus: residual is 0', surplus.breakdown.residual === 0);

  const surplusZero = cf.recommendedSurplusAllocation(populated_50yo, 0);
  check('surplus: zero input returns no allocation', surplusZero.breakdown.allocation.length === 0);
}

// =========================================================
// §3 — SWR + funded ratio + GK + Bengen + path
// =========================================================
console.log('\n§3 — SWR + funded ratio + GK + Bengen + path');
{
  const swrBengen = cf.swrFromRegime('bengen', populated_50yo, cma);
  check('SWR: bengen returns 4%', swrBengen.amount === 0.04);
  check('SWR: bengen has caveats array', Array.isArray(swrBengen.breakdown.caveats));

  const swrMorn = cf.swrFromRegime('morningstar', populated_50yo, cma);
  check('SWR: morningstar UK-localised = 3.4%', Math.abs(swrMorn.amount - 0.034) < 0.0001);

  const swrGK = cf.swrFromRegime('guytonKlinger', populated_50yo, cma);
  check('SWR: GK initial rate = 5.4%', Math.abs(swrGK.amount - 0.054) < 0.0001);

  const swrPRC = cf.swrFromRegime('prcAnchored', populated_50yo, cma);
  check('SWR: prc returns OPEN status', swrPRC.breakdown.open_item?.includes('O-CF-RULES-07'));

  const fr = cf.fundedRatio(populated_50yo, cma, taxBundle, 'bengen');
  checkEnvelope('fundedRatio', fr);
  check('funded ratio: ratio is positive number',
    typeof fr.amount === 'number' && fr.amount > 0);
  check('funded ratio: includes provenance string',
    fr.breakdown.provenance?.includes('UK-CMA-2026.1'));

  const frInsufficient = cf.fundedRatio({ ...populated_50yo, assets: [] }, cma, taxBundle);
  check('funded ratio: insufficient retirement assets → INSUFFICIENT confidence',
    frInsufficient.breakdown.confidence === 'INSUFFICIENT');

  const proj = cf.bengenProjection(populated_50yo, cma, 0.04);
  checkEnvelope('bengenProjection', proj);
  check('bengen projection: year-by-year table populated',
    Array.isArray(proj.breakdown.year_by_year_table) && proj.breakdown.year_by_year_table.length > 0);

  const gk = cf.guytonKlinger(populated_50yo, cma);
  checkEnvelope('guytonKlinger', gk);
  check('GK: returns position string',
    ['normal', 'prosperity', 'preservation'].includes(gk.breakdown.position));

  const gkPath = cf.guytonKlingerPath(populated_50yo, cma, null,
    [0.05, 0.07, -0.10, 0.12, 0.04]);   // 5-year arbitrary path
  checkEnvelope('guytonKlingerPath', gkPath);
  check('GK path: 5 entries returned',
    gkPath.breakdown.path.length === 5 || gkPath.breakdown.depleted);
  check('GK path: tracks raises/cuts',
    typeof gkPath.breakdown.triggers_fired?.raises === 'number' &&
    typeof gkPath.breakdown.triggers_fired?.cuts === 'number');
}

// =========================================================
// §4 — Bucket + Floor-Upside
// =========================================================
console.log('\n§4 — Bucket + Floor-Upside');
{
  const buckets = cf.bucketAllocation(populated_50yo);
  checkEnvelope('bucketAllocation', buckets);
  check('buckets: bucket1 target = 24 months', buckets.breakdown.bucket1.target_months === 24);
  check('buckets: bucket2 target = 60 months', buckets.breakdown.bucket2.target_months === 60);
  check('buckets: monthly_essential = 900 (£300+£600)',
    buckets.breakdown.monthly_essential === 900);
  check('buckets: cash = £30,000', buckets.breakdown.bucket1.current === 30000);

  const replenish = cf.bucketReplenishCheck(populated_50yo);
  checkEnvelope('bucketReplenishCheck', replenish);
  check('replenish: includes v1 note for O-CF-RULES-04',
    replenish.breakdown.v1_note?.includes('O-CF-RULES-04'));

  const replenishStress = cf.bucketReplenishCheck({
    ...populated_50yo,
    recentEquityReturn: -0.25, monthsSinceLastB2Defer: 20
  });
  check('replenish: 18-month cap forces replenish even when equities down',
    replenishStress.breakdown.force_replenish_b2 === true);

  const floor = cf.floorUpsideSplit({
    ...populated_50yo,
    income: [
      { type: 'statePension', gross_annual: 12500, label: 'State Pension' },
      { type: 'dbPension', gross_annual: 8000, label: 'Old DB pension' }
    ],
    sex: 'M', retirementHorizonYears: 25
  }, cma);
  checkEnvelope('floorUpsideSplit', floor);
  check('floor: returns floor_status', !!floor.breakdown.floor_status);
  check('floor: bond_ladder rungs populated',
    Array.isArray(floor.breakdown.plug_options.bond_ladder.rungs));
  check('floor: annuity option present',
    floor.breakdown.plug_options.annuity !== null);
  check('floor: includes v1 note for O-CF-RULES-03',
    floor.breakdown.v1_note?.includes('O-CF-RULES-03'));

  const floorIncome = cf.guaranteedFloorIncome({
    income: [
      { type: 'statePension', gross_annual: 12500, label: 'State Pension' },
      { type: 'dbPension', gross_annual: 5000, label: 'DB pension' }
    ]
  });
  check('guaranteedFloorIncome: sums correctly', floorIncome.amount === 17500);
}

// =========================================================
// §5 — Monte Carlo + risk metrics
// =========================================================
console.log('\n§5 — Monte Carlo + risk metrics');
{
  // Use small run count for speed
  const pos = cf.probabilityOfSuccess({ ...populated_50yo, seed: 42 }, cma, 200);
  checkEnvelope('probabilityOfSuccess', pos);
  check('PoS: returns probability in [0, 1]',
    typeof pos.amount === 'number' && pos.amount >= 0 && pos.amount <= 1);
  check('PoS: includes terminal value percentiles',
    typeof pos.breakdown.median_terminal_value === 'number');
  check('PoS: deterministic with seed (run twice, same result)',
    cf.probabilityOfSuccess({ ...populated_50yo, seed: 42 }, cma, 200).amount === pos.amount);
  check('PoS: MC_RUN_TIERS exposed', cf.MC_RUN_TIERS.sync === 1000);

  const sor = cf.sequenceOfReturnsVulnerability(populated_50yo, cma);
  checkEnvelope('sequenceOfReturnsVulnerability', sor);
  check('SoR: vulnerability_years is non-negative integer-ish',
    sor.breakdown.vulnerability_years >= 0);

  const mdd = cf.maxDrawdownExposure(populated_50yo, cma);
  checkEnvelope('maxDrawdownExposure', mdd);
  check('max DD: implied_max_dd in [0, 1]',
    mdd.amount >= 0 && mdd.amount <= 1);

  const mddWithTol = cf.maxDrawdownExposure(
    { ...populated_50yo, statedDrawdownTolerance: 0.20 }, cma);
  check('max DD: gap computed when tolerance set',
    typeof mddWithTol.breakdown.gap === 'number');

  const eff = cf.portfolioEfficiency(populated_50yo, cma);
  checkEnvelope('portfolioEfficiency', eff);
  check('efficiency: portfolio Sharpe is finite',
    Number.isFinite(eff.breakdown.portfolio_sharpe));
  check('efficiency: 60/40 benchmark Sharpe is finite',
    Number.isFinite(eff.breakdown.benchmark_60_40_sharpe));

  // Insufficient data path
  const posInsuf = cf.probabilityOfSuccess({ ...populated_50yo, assets: [] }, cma, 100);
  check('PoS: insufficient assets → error envelope',
    posInsuf.breakdown.error === 'INSUFFICIENT_DATA');
}

// =========================================================
// §6 — Scenarios + goal-seek
// =========================================================
console.log('\n§6 — Scenarios + goal-seek');
{
  const scenarios = cf.fiveCashflowScenarios({ ...populated_50yo, seed: 42 }, cma);
  checkEnvelope('fiveCashflowScenarios', scenarios);
  check('scenarios: 5 returned', scenarios.breakdown.scenarios.length === 5);
  check('scenarios: each has pos + terminal_value_median + coI',
    scenarios.breakdown.scenarios.every(s =>
      typeof s.pos === 'number' && typeof s.terminal_value_median === 'number' &&
      typeof s.coI === 'number'));

  const goal = cf.goalSeek(populated_50yo, 'fundedRatio', 1.0, '2043-05-08', null, cma, taxBundle);
  checkEnvelope('goalSeek', goal);
  check('goal: returns 2-4 paths',
    goal.breakdown.paths.length >= 2 && goal.breakdown.paths.length <= 4);
  check('goal: each path has actions + ripple + feasibility + plainEnglish + tradeOff',
    goal.breakdown.paths.every(p =>
      Array.isArray(p.actions) && p.ripple && p.feasibility && p.plainEnglish && p.tradeOff));

  const goalUnsupported = cf.goalSeek(populated_50yo, 'unsupportedMetric', 1.0, '2030-01-01', null, cma);
  check('goal: unsupported metric returns reason',
    goalUnsupported.breakdown.reason === 'TARGET_METRIC_UNSUPPORTED');
}

// =========================================================
// §7 — CoI integration: handlers + variants + extras flow
// =========================================================
console.log('\n§7 — CoI integration');
{
  const extras = cf.buildCFCoIExtras(populated_50yo, cma, taxBundle);
  check('extras: contains cma', extras.cma === cma);
  check('extras: contains taxBundle', extras.taxBundle === taxBundle);
  check('extras: discountRateReal is real (≈ gilt yield - inflation)',
    Math.abs(extras.discountRateReal - 0.0225) < 0.005);
  check('extras: _meta cites O-CF-RULES-12',
    extras._meta.sourceForDiscountRate?.includes('O-CF-RULES-12'));

  // Each handler must return valid envelope per canonical-coi handler contract
  for (const handlerName of ['drawdown', 'wrapperSequencing', 'taxAllowances',
                              'contributions', 'investmentStrategy', 'debt']) {
    const handler = cf[handlerName + 'Handler'];
    const handlers = composeHandlers(DEFAULT_HANDLERS, { [handlerName]: handler });
    const result = costOfInaction(populated_50yo, handlerName, taxBundle, handlers, extras);
    check(`handler[${handlerName}]: valid envelope shape`,
      typeof result.amount === 'number' && result.breakdown && result.rules);
    check(`handler[${handlerName}]: reports status`,
      ['IMPLEMENTED', 'OPEN', 'NOT_APPLICABLE'].includes(result.breakdown.status));
  }

  // cfHandlers map
  check('cfHandlers: has 6 entries', Object.keys(cf.cfHandlers).length === 6);
  check('cfHandlers: keys match canonical domains',
    Object.keys(cf.cfHandlers).every(k => ACTION_DOMAINS.includes(k)));

  // composeCFHandlers (without estate/pension — pure CF handlers + defaults)
  const composed = cf.composeCFHandlers(null, null);
  check('composeCFHandlers: covers all 12 domains',
    ACTION_DOMAINS.every(d => typeof composed[d] === 'function'));

  // coiCashflowVariants
  const variants = cf.coiCashflowVariants(populated_50yo, cma, taxBundle);
  checkEnvelope('coiCashflowVariants', variants);
  check('variants: contains all 3 named variants',
    variants.breakdown.withdrawal_sequence_coI &&
    variants.breakdown.surplus_allocation_coI &&
    variants.breakdown.pension_contribution_coI);
  check('variants: discount rate threaded from O-CF-RULES-12',
    variants.breakdown._discountRateSource?.includes('O-CF-RULES-12'));

  // totalCoI via cfHandlers — proves canonical-coi.js extras flow works end-to-end
  const totalRes = totalCoI(populated_50yo, taxBundle, composed, extras);
  checkEnvelope('totalCoI via composed handlers', totalRes);
  check('totalCoI: domainCount = 12', totalRes.breakdown.domainCount === 12);
  check('totalCoI: all per-domain results have extrasKeys (proves extras flowed)',
    ACTION_DOMAINS.every(d =>
      Array.isArray(totalRes.breakdown.perDomain[d].breakdown.ctx.extrasKeys)));
}

// =========================================================
// §8 — Health + liquidity
// =========================================================
console.log('\n§8 — Health + liquidity');
{
  const health = cf.cashflowHealth(populated_50yo);
  checkEnvelope('cashflowHealth', health);
  check('health: score in [0, 100]',
    health.amount >= 0 && health.amount <= 100);
  check('health: has 5 components',
    Object.keys(health.breakdown.components).length === 5);
  check('health: weights sum to 1',
    Math.abs(Object.values(health.breakdown.components)
      .reduce((s, c) => s + c.weight, 0) - 1) < 0.001);

  const buffer = cf.liquidityBuffer(populated_50yo);
  checkEnvelope('liquidityBuffer', buffer);
  check('buffer: months_covered is positive', buffer.amount > 0);
  check('buffer: band assigned',
    ['CRITICAL', 'AT_RISK', 'ADEQUATE', 'STRONG'].includes(buffer.breakdown.band));
}

// =========================================================
// §9 — Stubs
// =========================================================
console.log('\n§9 — Stubs');
{
  const reality = cf.realityEngineFactorisation(populated_50yo, taxBundle);
  check('reality: status=stub', reality.breakdown.status === 'stub');
  check('reality: openItem cited', reality.breakdown.openItem === 'O-CF-RULES-09');
  check('reality: rules cite skill v1.4 §2.7',
    reality.rules.some(r => r.includes('skill v1.4 §2.7')));

  const prc = cf.prcPccSpread(populated_50yo, taxBundle);
  check('prc: status=stub', prc.breakdown.status === 'stub');
  check('prc: openItem cited', prc.breakdown.openItem === 'O-CF-RULES-07');
}

// =========================================================
// §10 — Drawdown sequencing + failure modes + cross-bundle
// =========================================================
console.log('\n§10 — Drawdown sequencing + failure modes + cross-bundle');
{
  const seq = cf.optimalDrawdownSequence(populated_50yo, cma, taxBundle);
  checkEnvelope('optimalDrawdownSequence', seq);
  check('drawdown seq: returns sequence array', Array.isArray(seq.breakdown.sequence));
  check('drawdown seq: identifies IHT exposure',
    typeof seq.breakdown.iht_exposed === 'boolean');

  // High-estate entity — should get IHT-aware sequence
  const ihtExposed = cf.optimalDrawdownSequence(
    { ...populated_50yo, grossEstateValue: 800000 }, cma, taxBundle);
  check('drawdown seq: IHT-exposed entity gets GIA-first order',
    ihtExposed.breakdown.sequence[0] === 'gia');

  // Failure modes — engine should not throw on missing CMA
  const noCma = cf.fundedRatio(populated_50yo, null);
  check('failure: missing CMA returns INSUFFICIENT_DATA error',
    noCma.breakdown.error === 'INSUFFICIENT_DATA');

  const noEstate = cf.optimalDrawdownSequence(populated_50yo, null);
  check('failure: missing CMA on drawdown seq returns error',
    noEstate.breakdown.error === 'INSUFFICIENT_DATA');

  // Cross-bundle field reads validated by virtue of all preceding tests passing.
  // Add one explicit cross-bundle check:
  check('cross-bundle: tax bundle taxYear = "2026/27"',
    taxBundle._meta.taxYear === '2026/27');
  check('cross-bundle: CMA bundle effective_until = 2027-04-05',
    cma.effective_until === '2027-04-05');
  check('cross-bundle: tax + CMA loaded in same engine call without conflict',
    cf.fundedRatio(populated_50yo, cma, taxBundle).amount > 0);

  // Edge: degraded entity
  const degraded = cf.cashflowHealth({ ...populated_50yo, flags: ['degraded'], income: [] });
  check('degraded entity: no income → INSUFFICIENT_DATA',
    degraded.breakdown.error === 'INSUFFICIENT_DATA');
}

// =========================================================
// Summary
// =========================================================
console.log('\n' + '='.repeat(60));
console.log(`uk-cashflow engine smoke: ${pass} pass, ${fail} fail`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  · ${f}`));
  process.exit(1);
}
console.log('='.repeat(60));
