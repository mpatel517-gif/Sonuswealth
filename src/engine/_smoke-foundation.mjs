// ─────────────────────────────────────────────────────────────────────────────
// SONUSWEALTH / FINIO — FOUNDATION ENGINE SMOKE TEST
// Runs every Wave 1A foundation function on persona-a (Bruce, legacy flat) and
// mrT-core (nested) and reports PASS/FAIL.
//
// Usage: node src/engine/_smoke-foundation.mjs
// Spec: arch master §13.1 schema reconciliation.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import * as fq from './fq-calculator.js';

const here   = dirname(fileURLToPath(import.meta.url));
const persA  = JSON.parse(readFileSync(join(here, '..', 'rules', 'personas', 'persona-a.json'), 'utf-8'));
const mrTCore = JSON.parse(readFileSync(join(here, '..', 'rules', 'personas', 'mrT-core.json'), 'utf-8'));

const SUITE = [
  // [name, fn, [args...], assert(result) -> [ok, note]]
  ['netWorth',                   e => fq.netWorth(e),                            r => [r > 0, `nw=£${r.toLocaleString()}`]],
  ['investable',                 e => fq.investable(e),                          r => [r > 0, `inv=£${r.toLocaleString()}`]],
  ['guardrail',                  e => fq.guardrail(e),                           r => [r > 0, `swr=£${r.toLocaleString()}`]],
  ['calcNetWorth',               e => fq.calcNetWorth(e),                        r => [r.net > 0, `net=£${r.net.toLocaleString()} (${r.confidence})`]],
  ['calcInvestable',             e => fq.calcInvestable(e),                      r => [r.value > 0, `val=£${r.value.toLocaleString()}`]],
  ['calcGuardrail',              e => fq.calcGuardrail(e),                       r => [r.guardrail > 0, `g=£${r.guardrail.toLocaleString()}`]],
  ['totalCoI',                   e => fq.totalCoI(e),                            r => [typeof r.total === 'number', `total=£${r.total} confidence=${r.confidence}`]],
  ['costOfInaction(default)',    e => fq.costOfInaction(e),                      r => [typeof r === 'number', `coi=£${r}`]],
  ['costOfInaction(sipp_iht)',   e => fq.costOfInaction(e, 'sipp_iht'),          r => [typeof r === 'number', `sippCoi=£${r}`]],
  ['costOfInaction(drawdown)',   e => fq.costOfInaction(e, 'drawdown'),          r => [typeof r === 'number', `drawCoi=£${r}`]],
  ['fiRatio',                    e => fq.fiRatio(e),                             r => [typeof r.ratio === 'number', `ratio=${r.ratio} multiple=${r.multiple}`]],
  ['debtRatio',                  e => fq.debtRatio(e),                           r => [typeof r.ratio === 'number', `dsr=${r.ratio} band=${r.band}`]],
  ['protectionScore',            e => fq.protectionScore(e),                     r => [typeof r.total === 'number', `score=${r.total} band=${r.band}`]],
  ['cashflowHealth',             e => fq.cashflowHealth(e),                      r => [typeof r.total === 'number' && r.total >= 0, `score=${r.total} band=${r.band}`]],
  ['estateReadiness',            e => fq.estateReadiness(e),                     r => [typeof r.total === 'number', `score=${r.total} band=${r.band}`]],
  ['taxEfficiency',              e => fq.taxEfficiency(e),                       r => [typeof r.total === 'number', `score=${r.total}`]],
  ['scoreTrajectory',            e => fq.scoreTrajectory(e, '12mo'),             r => [Array.isArray(r) && r.length > 0, `${r.length} pts, last=${r[r.length-1]?.value}`]],
  ['riskTrajectory',             e => fq.riskTrajectory(e, '12mo'),              r => [Array.isArray(r) && r.length > 0, `${r.length} pts, last=${r[r.length-1]?.value}`]],
  ['netWorthHistory',            e => fq.netWorthHistory(e, '12mo'),             r => [Array.isArray(r) && r.length > 0, `${r.length} pts`]],
  ['getWrapper',                 _ => fq.getWrapper({ type: 'SIPP' }),           r => [r === 'PENSION', `wrapper=${r}`]],
  ['hasPersonaFlag',             e => fq.hasPersonaFlag(e, 'isCouple'),          r => [typeof r === 'boolean', `flag=${r}`]],
  ['isRuleActive',               _ => fq.isRuleActive('SIPP_IHT_INCLUSION', new Date('2027-05-01')), r => [r === true, `active=${r}`]],
  ['getActiveRateForDate',       _ => fq.getActiveRateForDate('PSA_BASIC'),      r => [r === 1000, `psa=£${r}`]],
  ['monthlySurplus',             e => fq.monthlySurplus(e),                      r => [typeof r.surplus === 'number', `inc=£${r.income} ess=£${r.essential} surplus=£${r.surplus}`]],
  ['liquidityBuffer',            e => fq.liquidityBuffer(e),                     r => [typeof r.months === 'number', `${r.months}mo (${r.band})`]],
  ['swrFromRegime(morningstar)', _ => fq.swrFromRegime('morningstar_uk'),        r => [r.rate === 0.034, `rate=${r.rate} (${r.label})`]],
  ['bengenProjection',           e => fq.bengenProjection(e, 10),                r => [Array.isArray(r) && r.length === 10, `${r.length} years, y10 bal=£${r[9]?.balance.toLocaleString()}`]],
  ['guytonKlingerPath',          e => fq.guytonKlingerPath(e, 10),               r => [Array.isArray(r) && r.length === 10, `${r.length} years`]],
  ['bucketAllocation',           e => fq.bucketAllocation(e),                    r => [r.total > 0, `total=£${r.total.toLocaleString()}`]],
  ['floorUpsideSplit',           e => fq.floorUpsideSplit(e),                    r => [typeof r.ratio === 'number', `ratio=${r.ratio}`]],
  ['coiCashflowVariants',        e => fq.coiCashflowVariants(e),                 r => [typeof r.drawdown === 'number', `dd=${r.drawdown} wrap=${r.wrapper}`]],
  ['recommendedSurplusAllocation', e => fq.recommendedSurplusAllocation(e, 1000), r => [Array.isArray(r), `${r.length} items`]],
  // Tax-side
  ['calcANI',                    e => fq.calcANI(e),                             r => [typeof r.ani === 'number', `ani=£${r.ani.toLocaleString()}`]],
  ['calcPersonalAllowance',      e => fq.calcPersonalAllowance(50000),           r => [r > 0, `pa=£${r}`]],
  ['calcIncomeTax',              e => fq.calcIncomeTax(e),                       r => [typeof r.tax === 'number', `tax=£${r.tax.toLocaleString()}`]],
  ['calcDividendTax',            _ => fq.calcDividendTax(5000, 30000),           r => [typeof r.tax === 'number', `tax=£${r.tax}`]],
  ['calcHICBC',                  e => fq.calcHICBC(e),                           r => [typeof r.charge === 'number', `charge=£${r.charge}`]],
  ['calcPSA',                    e => fq.calcPSA(e),                             r => [typeof r.allowance === 'number', `psa=£${r.allowance} (${r.band})`]],
  ['calcMarriageAllowance',      e => fq.calcMarriageAllowance(e),               r => [typeof r.eligible === 'boolean', `eligible=${r.eligible}`]],
  ['classifyIncomeType',         _ => fq.classifyIncomeType({ type: 'dividends', amount: 100 }), r => [r === 'dividends', `cls=${r}`]],
  ['calcAllIncome',              e => fq.calcAllIncome(e),                       r => [typeof r.total === 'number', `total=£${r.total.toLocaleString()}`]],
  // Estate-side
  ['ihtWaterfall',               e => fq.ihtWaterfall(e, { sippDraw: 50000 }),   r => [Array.isArray(r.stages), `${r.stages.length} stages baseline=£${r.baseline.toLocaleString()}`]],
  ['drawdownMatrix',             e => fq.drawdownMatrix(e),                      r => [Array.isArray(r.rows), `${r.rows.length} rows rec=£${r.recommended}`]],
  ['allowanceTracker',           e => fq.allowanceTracker(e),                    r => [typeof r.utilization === 'number', `util=${r.utilization}%`]],
  ['willLpaStatus',              e => fq.willLpaStatus(e),                       r => [Array.isArray(r.flags), `flags=${r.flags.join(',') || '-'}`]],
  ['intestacyDistribution',      e => fq.intestacyDistribution(e),               r => [Array.isArray(r.beneficiaries), `${r.beneficiaries.length} beneficiaries`]],
  ['noWillCoI',                  e => fq.noWillCoI(e),                           r => [typeof r.total === 'number', `total=£${r.total}`]],
  ['rnrbTaper(entity)',          e => fq.rnrbTaper(e),                           r => [typeof r.rnrb === 'number', `rnrb=£${r.rnrb} lost=£${r.lost}`]],
  ['rnrbTaper(value)',           _ => fq.rnrbTaper(2200000),                     r => [r.lost > 0, `rnrb=£${r.rnrb} lost=£${r.lost}`]],
  ['rnrbEligibility',            e => fq.rnrbEligibility(e),                     r => [typeof r.eligible === 'boolean', `eligible=${r.eligible}`]],
  ['bprQualifyingValue',         e => fq.bprQualifyingValue(e),                  r => [typeof r.allowance === 'number', `allowance=£${r.allowance.toLocaleString()}`]],
  ['bprAprAllowance',            e => fq.bprAprAllowance(e),                     r => [typeof r.individual === 'number', `ind=£${r.individual.toLocaleString()}`]],
  ['aprQualification',           e => fq.aprQualification(e),                    r => [typeof r.qualifies === 'boolean', `qual=${r.qualifies}`]],
  ['trustPeriodicCharge',        _ => fq.trustPeriodicCharge({ settlementDate: '2024-02-14', currentValue: 500000 }), r => [typeof r.estimatedCharge === 'number', `charge=£${r.estimatedCharge}`]],
  ['taxAndEstateImpact',         e => fq.taxAndEstateImpact(e, { kind: 'drawdown', amount: 30000 }), r => [typeof r.net === 'number', `net=£${r.net}`]],
  ['figStatus',                  e => fq.figStatus(e),                           r => [typeof r.eligible === 'boolean', `eligible=${r.eligible}`]],
  ['trfStatus',                  e => fq.trfStatus(e),                           r => [typeof r.currentRate === 'number', `rate=${r.currentRate}`]],
  ['welshIncomeTax',             e => fq.welshIncomeTax(e),                      r => [typeof r.applies === 'boolean', `applies=${r.applies}`]],
  ['scottishIncomeTax',          e => fq.scottishIncomeTax(e),                   r => [typeof r.applies === 'boolean', `applies=${r.applies}`]],
  ['giftClockProjection',        e => fq.giftClockProjection(e),                 r => [Array.isArray(r), `${r.length} gifts`]],
  ['giftClockAll',               e => fq.giftClockAll(e),                        r => [Array.isArray(r), `${r.length} gifts`]],
  ['beneficiaryAnalysis',        e => fq.beneficiaryAnalysis(e),                 r => [typeof r.effectiveRate === 'number', `${r.beneficiaries.length} beneficiaries effRate=${r.effectiveRate}%`]],
  ['estateReadinessIndex',       e => fq.estateReadinessIndex(e),                r => [typeof r === 'number', `idx=${r}`]],
  // Plan layer
  ['planFor',                    e => fq.planFor(e, 'wealthScore'),              r => [r === null || typeof r === 'object', r === null ? 'no plan' : `plan ${r.id}`]],
  ['planStaleness',              e => fq.planStaleness(e, 'wealthScore'),        r => [typeof r.stale === 'boolean', `stale=${r.stale} reason="${r.reason}"`]],
  ['commitPlan',                 e => fq.commitPlan(e, { type: 'wealthScore', target: 75 }), r => [r.eventId && r.payload, `eventId=${r.eventId}`]],
  ['goalSeek',                   e => fq.goalSeek(e, 'wealthScore', 80),         r => [Array.isArray(r) && r.length > 0, `${r.length} paths, best gap=${r[0]?.gap}`]],
  // Variance / forecast
  ['forecastFor(netWorth,12mo)', e => fq.forecastFor(e, 'netWorth', '12mo'),     r => [Array.isArray(r) && r.length > 0, `${r.length} pts`]],
  ['varianceFor(actual,plan,12mo)', e => fq.varianceFor(e, 'actual', 'plan', '12mo'), r => [typeof r.variance === 'number', `var=${r.variance}`]],
  ['varianceFor(3-arg back-compat)', e => fq.varianceFor(e, 'actual', '12mo'),  r => [typeof r.variance === 'number', `var=${r.variance}`]],
  // Existing core (sanity)
  ['calcFQ',                     e => fq.calcFQ(e),                              r => [typeof r.total === 'number', `total=${r.total} band=${r.band.name}`]],
  ['calcRisk',                   e => fq.calcRisk(e),                            r => [typeof r.total === 'number', `total=${r.total} band=${r.band.name}`]],
  ['calcAPQ',                    e => fq.calcAPQ(e),                             r => [Array.isArray(r), `${r.length} items`]],
  ['financialProfile',           e => fq.financialProfile(e),                    r => [typeof r.profileKey === 'string', `key=${r.profileKey}`]],
];

const PERSONAS = [
  ['persona-a (Bruce, legacy flat)', persA],
  ['mrT-core (nested)',              mrTCore],
];

let pass = 0, fail = 0;
const failures = [];
for (const [pname, persona] of PERSONAS) {
  console.log(`\n══════ ${pname} ══════`);
  for (const [name, fn, assertFn] of SUITE) {
    let ok = false, note = '', err = null;
    try {
      const r = fn(persona);
      const [a, n] = assertFn(r);
      ok = a; note = n;
    } catch (e) {
      err = e;
      note = `THREW: ${e.message}`;
    }
    if (ok) { pass++; console.log(`  ✓ ${name.padEnd(36)} ${note}`); }
    else    { fail++; failures.push(`${pname} → ${name}: ${note}`); console.log(`  ✗ ${name.padEnd(36)} ${note}`); }
  }
}

console.log('\n──────────────── SUMMARY ────────────────');
console.log(`PASS: ${pass}`);
console.log(`FAIL: ${fail}`);
if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log('  - ' + f);
}
process.exit(fail > 0 ? 1 : 0);
