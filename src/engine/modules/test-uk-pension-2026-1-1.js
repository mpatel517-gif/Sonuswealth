/**
 * test-uk-pension-2026-1-1.js
 * Smoke tests for uk-pension engine (s17a-3).
 * Run: BUNDLE_PATH=./UK-2026.1.1.json node test-uk-pension-2026-1-1.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const bundlePath = process.env.BUNDLE_PATH || './UK-2026.1.1.json';
const bundle = JSON.parse(fs.readFileSync(path.resolve(bundlePath), 'utf8'));
const e = require('./uk-pension-2026-1-1.js');

let passed = 0, failed = 0;
const failures = [];

function check(name, predicate, actual) {
  if (predicate) {
    passed++;
  } else {
    failed++;
    failures.push({ name, actual });
  }
}

function approx(a, b, tol) {
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= (tol || 0.01);
}

console.log('=== uk-pension-2026-1-1.js · smoke test (s17a-3) ===\n');

// ─── §A WRAPPERS ──────────────────────────────────────────────────────────
{
  const r = e.getWrapperPension({ wrapperType: 'SIPP', value: 500000 }, bundle);
  check('§A.1 SIPP classified DC + IHT-included from Apr 2027',
    r.amount === 500000 && r.breakdown.kind === 'DC' && r.breakdown.ihtFromApr2027 === true, r);

  const r2 = e.getWrapperPension({ wrapperType: 'OccDB', value: 12000 }, bundle);
  check('§A.2 OccDB classified DB + NOT IHT-included',
    r2.breakdown.kind === 'DB' && r2.breakdown.ihtFromApr2027 === false, r2);

  const r3 = e.getWrapperPension({ wrapperType: 'StatePension', value: 12548 }, bundle);
  check('§A.3 StatePension classified StateDB',
    r3.breakdown.kind === 'StateDB', r3);

  const r4 = e.getWrapperPension({ wrapperType: 'LISA', value: 30000 }, bundle);
  check('§A.4 LISA classified ISAFamily not pension',
    r4.breakdown.kind === 'ISAFamily', r4);

  const r5 = e.getWrapperPension({ wrapperType: 'NotARealWrapper', value: 100 }, bundle);
  check('§A.5 Unknown wrapper flagged not recognised',
    r5.breakdown.recognised === false, r5);

  const r6 = e.getWrapperPension({}, bundle);
  check('§A.6 No wrapperType returns null classification',
    r6.breakdown.wrapperType === null, r6);
}

// ─── §B CONTRIBUTIONS ─────────────────────────────────────────────────────
{
  const r = e.annualAllowance(bundle);
  check('§B.1 Standard AA = £60,000', r.amount === 60000, r);

  const r2 = e.moneyPurchaseAnnualAllowance(bundle);
  check('§B.2 MPAA = £10,000', r2.amount === 10000, r2);

  // Taper: gateway not passed (TI ≤ £200k)
  const t1 = e.taperedAnnualAllowance(150000, 280000, bundle);
  check('§B.3 Taper gateway: TI ≤ £200k → standard AA',
    t1.amount === 60000 && t1.breakdown.taperApplies === false, t1);

  // Taper: gateway passed but AI ≤ £260k
  const t2 = e.taperedAnnualAllowance(220000, 250000, bundle);
  check('§B.4 Taper gateway passed, AI ≤ £260k → standard AA',
    t2.amount === 60000 && t2.breakdown.taperApplies === false, t2);

  // Taper: AI £300k → taper applies, reduction £20k
  const t3 = e.taperedAnnualAllowance(220000, 300000, bundle);
  check('§B.5 Taper at AI £300k: AA = £60k − (£40k/2) = £40k',
    t3.amount === 40000 && t3.breakdown.taperApplies === true, t3);

  // Taper: AI £400k → at floor £10k
  const t4 = e.taperedAnnualAllowance(220000, 400000, bundle);
  check('§B.6 Taper at AI £400k: AA hits floor £10k',
    t4.amount === 10000 && t4.breakdown.taperApplies === true, t4);

  // Effective AA — MPAA binding
  const eff1 = e.effectiveAnnualAllowance({
    thresholdIncome: 100000, adjustedIncome: 150000,
    mpaaTriggered: true, relevantUKEarnings: 80000
  }, bundle);
  check('§B.7 Effective AA: MPAA binding when triggered (£10k < £60k)',
    eff1.amount === 10000, eff1);

  // Effective AA — earnings cap binding
  const eff2 = e.effectiveAnnualAllowance({
    thresholdIncome: 50000, adjustedIncome: 60000,
    mpaaTriggered: false, relevantUKEarnings: 5000
  }, bundle);
  check('§B.8 Effective AA: earnings cap binding when low earnings (£5k < £60k)',
    eff2.amount === 5000, eff2);

  // Effective AA — taper binding
  const eff3 = e.effectiveAnnualAllowance({
    thresholdIncome: 220000, adjustedIncome: 300000,
    mpaaTriggered: false, relevantUKEarnings: 250000
  }, bundle);
  check('§B.9 Effective AA: tapered AA binding (£40k)',
    eff3.amount === 40000, eff3);

  // Carry-forward
  const cf = e.carryForward(60000, [10000, 0, 30000], bundle);
  check('§B.10 Carry-forward: 60k current + 40k prior = 100k total',
    cf.amount === 100000 && cf.breakdown.carryForward === 40000, cf);

  // Carry-forward truncation
  const cf2 = e.carryForward(60000, [5000, 5000, 5000, 5000, 5000], bundle);
  check('§B.11 Carry-forward: only 3 prior years used',
    cf2.breakdown.carryForward === 15000, cf2);

  // RAS
  const ras = e.reliefAtSource(10000, 0.40, bundle);
  check('§B.12 RAS: net cost £8k, basic relief £2k, HR reclaim £2k',
    approx(ras.breakdown.netPaidToProvider, 8000) &&
    approx(ras.breakdown.basicReliefAddedAtSource, 2000) &&
    approx(ras.breakdown.higherRateReliefViaSA, 2000), ras);

  // Net pay
  const np = e.netPayContribution(10000, 0.40, bundle);
  check('§B.13 Net pay: full marginal relief at source, net cost £6k',
    approx(np.breakdown.netCost, 6000), np);

  // Salary sacrifice — pre-2029
  const ss1 = e.salarySacrifice(10000, 0.08, 0.138, 2026, bundle);
  check('§B.14 Sal-sac 2026: cap not active; full employer NI savings',
    ss1.breakdown.capActive === false &&
    approx(ss1.breakdown.employerNISaved, 1380), ss1);

  // Salary sacrifice — post-2029, cap applied
  const ss2 = e.salarySacrifice(50000, 0.08, 0.138, 2029, bundle);
  check('§B.15 Sal-sac 2029 cap applies (£50k×13.8%=£6.9k > £2k cap)',
    ss2.breakdown.capActive === true && ss2.breakdown.capApplied === true &&
    ss2.breakdown.employerNISaved === 2000, ss2);

  // Salary sacrifice — post-2029, below cap
  const ss3 = e.salarySacrifice(10000, 0.08, 0.138, 2029, bundle);
  check('§B.16 Sal-sac 2029 below cap (£1.38k < £2k)',
    ss3.breakdown.capActive === true && ss3.breakdown.capApplied === false, ss3);

  // AA charge
  const aac = e.annualAllowanceCharge(20000, 0.45, bundle);
  check('§B.17 AA charge: £20k excess × 45% = £9k',
    aac.amount === 9000, aac);

  // Scheme Pays
  const sp = e.schemePays(5000, 200000, bundle);
  check('§B.18 Scheme Pays: charge £5k > £2k threshold, eligible',
    sp.breakdown.eligible === true && sp.breakdown.fundAfter === 195000, sp);

  // Earnings cap — within
  const ec1 = e.relevantUKEarningsCap(50000, 30000, bundle);
  check('§B.19 Earnings cap: within (£30k ≤ £50k)',
    ec1.breakdown.capped === false, ec1);

  // Earnings cap — exceeds
  const ec2 = e.relevantUKEarningsCap(20000, 40000, bundle);
  check('§B.20 Earnings cap: exceeded (£40k > £20k cap)',
    ec2.breakdown.capped === true && ec2.amount === 20000, ec2);

  // Earnings cap — minimum floor £3,600
  const ec3 = e.relevantUKEarningsCap(0, 5000, bundle);
  check('§B.21 Earnings cap: zero earnings → £3,600 floor; £5k contribution exceeds',
    ec3.amount === 3600 && ec3.breakdown.capped === true, ec3);

  // HR relief reclaim — Scotland flagged
  const hr1 = e.higherRateReliefReclaim(10000, 0.41, 'Scotland', bundle);
  check('§B.22 HR reclaim Scotland: returns warning envelope',
    hr1.breakdown.warning === true, hr1);

  // HR relief reclaim — England HR
  const hr2 = e.higherRateReliefReclaim(10000, 0.40, 'England', bundle);
  check('§B.23 HR reclaim England HR: £10k × (40%−20%) = £2k',
    approx(hr2.amount, 2000), hr2);

  // HR relief reclaim — basic rate, nothing extra
  const hr3 = e.higherRateReliefReclaim(10000, 0.20, 'England', bundle);
  check('§B.24 HR reclaim BR: nothing extra reclaimable',
    hr3.amount === 0, hr3);

  // Junior pension
  const jp = e.juniorPensionContribution(2880, bundle);
  check('§B.25 Junior pension: £2,880 net → £3,600 gross',
    approx(jp.amount, 3600), jp);

  // Junior pension — exceeds
  const jp2 = e.juniorPensionContribution(5000, bundle);
  check('§B.26 Junior pension exceeds: capped at £2,880, £2,120 refused',
    jp2.breakdown.exceeded === true && jp2.breakdown.excessRefused === 2120, jp2);

  // Ltd-co employer contribution
  const ltd = e.ltdCoEmployerContribution(20000, 0.25, bundle);
  check('§B.27 Ltd-co contrib: £20k × 25% CT relief = £5k saving',
    approx(ltd.breakdown.ctSaving, 5000) && approx(ltd.breakdown.netCostToCompany, 15000), ltd);
}

// ─── §C DECUMULATION DC ───────────────────────────────────────────────────
{
  const lsa = e.lumpSumAllowance(bundle);
  check('§C.1 LSA = £268,275', lsa.amount === 268275, lsa);

  const lsdba = e.lumpSumAndDeathBenefitAllowance(bundle);
  check('§C.2 LSDBA = £1,073,100', lsdba.amount === 1073100, lsdba);

  // PCLS — within LSA
  const p1 = e.pcls(400000, 0, bundle);
  check('§C.3 PCLS £400k pot, full LSA: tax-free £100k',
    p1.amount === 100000 && p1.breakdown.taxableAtMarginal === 0, p1);

  // PCLS — exceeds LSA remaining
  const p2 = e.pcls(400000, 200000, bundle);
  check('§C.4 PCLS with LSA mostly used: tax-free £68,275, taxable £31,725',
    approx(p2.amount, 68275) && approx(p2.breakdown.taxableAtMarginal, 31725), p2);

  // PCLS — exhausted LSA
  const p3 = e.pcls(400000, 268275, bundle);
  check('§C.5 PCLS with LSA exhausted: all £100k taxable',
    p3.amount === 0 && p3.breakdown.taxableAtMarginal === 100000, p3);

  // Flexi-access drawdown
  const fad = e.flexiAccessDrawdown(20000, 30000, 'England', bundle);
  check('§C.6 Flexi-access £20k drawdown on top of £30k other income (HR band): tax 20%',
    approx(fad.breakdown.tax, 4000), fad);

  // UFPLS — full
  const u1 = e.ufpls(40000, 30000, 0, 'England', bundle);
  check('§C.7 UFPLS £40k: 25% tax-free £10k, 75% taxable £30k at HR slice',
    approx(u1.breakdown.taxFreeActual, 10000) &&
    approx(u1.breakdown.taxableAtMarginal, 30000) &&
    u1.breakdown.triggersMPAA === true, u1);

  // Pension recycling — not triggered
  const pr1 = e.pensionRecyclingTrigger(5000, 0.50, 8000, bundle);
  check('§C.8 Recycling: PCLS £5k < £7,500 threshold → not triggered',
    pr1.breakdown.recyclingFlagged === false, pr1);

  // Pension recycling — triggered
  const pr2 = e.pensionRecyclingTrigger(50000, 0.40, 20000, bundle);
  check('§C.9 Recycling: all 3 thresholds met → triggered',
    pr2.breakdown.recyclingFlagged === true, pr2);

  // Trivial commutation — eligible
  const tc1 = e.trivialCommutation(15000, 10000, 70, bundle);
  check('§C.10 Trivial commutation: £25k aggregate ≤ £30k, age 70 → eligible',
    tc1.breakdown.eligible === true && approx(tc1.breakdown.taxFree, 3750), tc1);

  // Trivial commutation — exceeds
  const tc2 = e.trivialCommutation(20000, 15000, 70, bundle);
  check('§C.11 Trivial commutation: £35k > £30k → not eligible',
    tc2.breakdown.eligible === false, tc2);

  // Trivial commutation — too old
  const tc3 = e.trivialCommutation(10000, 0, 76, bundle);
  check('§C.12 Trivial commutation: age 76 → not eligible',
    tc3.breakdown.eligible === false, tc3);

  // Small pots — eligible
  const sp1 = e.smallPotsRule(8000, 1, bundle);
  check('§C.13 Small pots: £8k ≤ £10k, 1 of 3 used → eligible',
    sp1.breakdown.eligible === true, sp1);

  // Small pots — exceeds size
  const sp2 = e.smallPotsRule(11000, 0, bundle);
  check('§C.14 Small pots: £11k > £10k → not eligible',
    sp2.breakdown.eligible === false, sp2);

  // Small pots — count exhausted
  const sp3 = e.smallPotsRule(5000, 3, bundle);
  check('§C.15 Small pots: already 3 used → not eligible',
    sp3.breakdown.eligible === false, sp3);

  // Annuity — single life
  const an = e.annuityIncome(200000, 60, {}, bundle);
  check('§C.16 Annuity: £200k at £60/£1k = £12k/yr',
    an.amount === 12000, an);

  // Annuity — joint, enhanced
  const an2 = e.annuityIncome(200000, 50, { joint: true, healthEnhanced: true }, bundle);
  check('§C.17 Joint enhanced annuity: still computed × user-supplied rate',
    an2.amount === 10000 && an2.breakdown.joint === true && an2.breakdown.healthEnhanced === true, an2);

  // Fixed-term annuity
  const fta = e.fixedTermAnnuity(100000, 5, 8000, 80000, bundle);
  check('§C.18 Fixed-term: £8k/yr × 5 + £80k maturity = £120k total',
    fta.breakdown.totalReceived === 120000, fta);
}

// ─── §D DB ─────────────────────────────────────────────────────────────────
{
  // CETV — advice required threshold
  const c1 = e.dbCETV(20000, 25);
  check('§D.1 CETV £500k > £30k → advice required',
    c1.amount === 500000 && c1.breakdown.adviceRequired === true, c1);

  const c2 = e.dbCETV(1000, 25);
  check('§D.2 CETV £25k < £30k → advice not required',
    c2.breakdown.adviceRequired === false, c2);

  // DB commutation
  const dc = e.dbCommutation(20000, 15, 5000, bundle);
  check('§D.3 DB commutation: £5k/yr × factor 15 = £75k lump sum, £15k/yr remaining',
    dc.amount === 75000 && dc.breakdown.remainingPension === 15000, dc);

  // Early retirement reduction
  const er = e.dbEarlyReduction(20000, 5, 0.04);
  check('§D.4 DB early reduction: 5yr × 4% = 20%, £20k → £16k',
    approx(er.amount, 16000), er);

  // Late retirement increase
  const lr = e.dbLateIncrease(20000, 3, 0.05);
  check('§D.5 DB late increase: 3yr × 5% = 15%, £20k → £23k',
    approx(lr.amount, 23000), lr);

  // Indexation — uncapped
  const ix1 = e.dbIndexation(20000, 0.04);
  check('§D.6 DB indexation uncapped: 4% → £20.8k',
    approx(ix1.amount, 20800), ix1);

  // Indexation — capped
  const ix2 = e.dbIndexation(20000, 0.07, 0.05);
  check('§D.7 DB indexation capped at 5%: 7% → effective 5% → £21k',
    approx(ix2.amount, 21000), ix2);

  // PPF — in payment
  const pp1 = e.pensionProtectionFund(20000, 70, 65, bundle);
  check('§D.8 PPF: in payment at scheme failure → 100%',
    pp1.breakdown.inPayment === true && pp1.amount === 20000, pp1);

  // PPF — not in payment
  const pp2 = e.pensionProtectionFund(20000, 60, 65, bundle);
  check('§D.9 PPF: not yet in payment → 90%',
    pp2.breakdown.inPayment === false && approx(pp2.amount, 18000), pp2);
}

// ─── §E DEATH BENEFITS ────────────────────────────────────────────────────
{
  // Pre-75, pre-Apr-2027 — no IHT, no IT
  const d1 = e.deathBenefitTaxPre75(500000, 0, '2026-12-01', bundle);
  check('§E.1 Death pre-75 + pre-Apr-2027: tax-free up to LSDBA, no IHT',
    d1.breakdown.taxFreeLump === 500000 && d1.breakdown.ihtIncluded === false, d1);

  // Pre-75, post-Apr-2027 — IHT-included
  const d2 = e.deathBenefitTaxPre75(500000, 0, '2027-06-01', bundle);
  check('§E.2 Death pre-75 + post-Apr-2027: tax-free pot but IHT applies',
    d2.breakdown.taxFreeLump === 500000 && d2.breakdown.ihtIncluded === true, d2);

  // Pre-75 with LSDBA exhausted
  const d3 = e.deathBenefitTaxPre75(500000, 1073100, '2026-01-01', bundle);
  check('§E.3 Death pre-75 LSDBA exhausted: all taxable at marginal',
    d3.breakdown.taxFreeLump === 0 && d3.breakdown.taxableExcess === 500000, d3);

  // Post-75 (always taxable income)
  const d4 = e.deathBenefitTaxPost75(30000, 0.40, '2026-06-01', 'England', bundle);
  check('§E.4 Death post-75: £30k drawdown × 40% = £12k tax · pre-Apr-2027 no IHT',
    approx(d4.breakdown.tax, 12000) && d4.breakdown.ihtIncluded === false, d4);

  // Post-75 + post-Apr-2027 (combined — UK-PEN-45 trigger)
  const d5 = e.deathBenefitTaxPost75(30000, 0.40, '2027-06-01', 'England', bundle);
  check('§E.5 Death post-75 post-Apr-2027: IHT flagged + IT continues',
    d5.breakdown.ihtIncluded === true, d5);

  // pensionIHTInclusion — pre-2027
  const ih1 = e.pensionIHTInclusion('2026-04-05', 500000, bundle);
  check('§E.6 Pension IHT inclusion pre-Apr-2027: not included',
    ih1.breakdown.included === false && ih1.amount === 0, ih1);

  // pensionIHTInclusion — post-2027
  const ih2 = e.pensionIHTInclusion('2027-04-06', 500000, bundle);
  check('§E.7 Pension IHT inclusion on Apr 6 2027: included; headline £200k',
    ih2.breakdown.included === true && ih2.amount === 500000 &&
    approx(ih2.breakdown.headlineIHTIfNoNRB, 200000), ih2);

  // combinedIHTITPost75 — Effective rate ≥67%
  const ci = e.combinedIHTITPost75(500000, '2027-06-01', 0.45, bundle);
  check('§E.8 Combined post-75 + post-Apr-2027 + 45% margin: effective ≥ 67%',
    ci.breakdown.effectiveRate >= 0.67, ci);

  // Pre-Apr-2027: no IHT
  const ci2 = e.combinedIHTITPost75(500000, '2026-06-01', 0.45, bundle);
  check('§E.9 Combined pre-Apr-2027 + 45% margin: only IT, effective 45%',
    ci2.breakdown.ihtIncluded === false && approx(ci2.breakdown.effectiveRate, 0.45), ci2);

  // DB spouse pension — default 50%
  const ds = e.dbDeathSpouse(20000);
  check('§E.10 DB spouse pension default 50%',
    ds.amount === 10000, ds);

  // DB spouse pension — 2/3
  const ds2 = e.dbDeathSpouse(30000, 2 / 3);
  check('§E.11 DB spouse pension 2/3',
    approx(ds2.amount, 20000), ds2);

  // DB children — 25% split between 2
  const dc = e.dbDeathChildren(20000, 0.25, 2);
  check('§E.12 DB children pension: 25% split between 2 = £2.5k each',
    dc.amount === 5000 && dc.breakdown.perChild === 2500, dc);

  // DB death in service
  const dis = e.dbDeathInService(50000, 4);
  check('§E.13 DB death in service: 4× £50k = £200k',
    dis.amount === 200000, dis);
}

// ─── §F STATE PENSION ─────────────────────────────────────────────────────
{
  const sp1 = e.newStatePension(35, bundle);
  check('§F.1 New SP full 35 years = £12,548',
    sp1.amount === 12548, sp1);

  const sp2 = e.newStatePension(20, bundle);
  check('§F.2 New SP 20/35 years pro-rata',
    approx(sp2.amount, 12548 * (20 / 35)), sp2);

  const sp3 = e.newStatePension(8, bundle);
  check('§F.3 New SP < 10 qualifying years → £0',
    sp3.amount === 0 && sp3.breakdown.eligible === false, sp3);

  // Triple lock — earnings highest
  const tl1 = e.tripleLockProjection(12548, 0.02, 0.04, 5);
  check('§F.4 Triple lock: earnings 4% highest, 5yr → 12548 × 1.04^5',
    approx(tl1.amount, 12548 * Math.pow(1.04, 5), 1), tl1);

  // Triple lock — floor 2.5%
  const tl2 = e.tripleLockProjection(12548, 0.01, 0.015, 5);
  check('§F.5 Triple lock: floor 2.5% binding',
    approx(tl2.breakdown.annualIncrease, 0.025), tl2);

  // SP deferral
  const dfr = e.statePensionDeferral(52, 12548, bundle);
  check('§F.6 SP deferral 52 weeks: 5 blocks × 1% = ~5.78%',
    approx(dfr.breakdown.upliftPct, 0.05) && approx(dfr.amount, 12548 * 1.05, 1), dfr);
}

// ─── §G CROSS-BORDER + SHARING ────────────────────────────────────────────
{
  // QROPS on list
  const q1 = e.qropsTransfer(200000, 'Australia', true, bundle);
  check('§G.1 QROPS on ROPS list: flagged ok',
    q1.breakdown.isOnROPSList === true, q1);

  // QROPS not on list
  const q2 = e.qropsTransfer(200000, 'Atlantis', false, bundle);
  check('§G.2 QROPS not on list: warning',
    q2.breakdown.isOnROPSList === false, q2);

  // OTC — excluded (member resident in same country)
  const o1 = e.overseasTransferCharge(200000, { memberResidentSameCountry: true }, bundle);
  check('§G.3 OTC: member resident same country → excluded',
    o1.amount === 0 && o1.breakdown.excluded === true, o1);

  // OTC — applies
  const o2 = e.overseasTransferCharge(200000, {}, bundle);
  check('§G.4 OTC: no exclusion → 25% × £200k = £50k',
    o2.amount === 50000, o2);

  // DC pension share
  const sh1 = e.pensionShareDC(500000, 50);
  check('§G.5 DC pension share 50% of £500k = £250k each',
    sh1.amount === 250000 && sh1.breakdown.remainingForOriginalMember === 250000, sh1);

  // DB pension share
  const sh2 = e.pensionShareDB(800000, 40, true);
  check('§G.6 DB pension share 40% of £800k = £320k credit',
    sh2.amount === 320000 && sh2.breakdown.valuationUpliftRecommended === true, sh2);
}

// ─── §H AGGREGATES ────────────────────────────────────────────────────────
{
  // Contribution room
  const cr = e.contributionRoom({
    thresholdIncome: 100000, adjustedIncome: 150000,
    mpaaTriggered: false, relevantUKEarnings: 100000,
    priorYearsUnused: [10000, 0, 5000]
  }, bundle);
  check('§H.1 Contribution room: standard AA £60k + carry £15k = £75k',
    cr.amount === 75000, cr);

  // Decumulation — too young
  const dec1 = e.decumulationCapacity(200000, 50, 'flexi-access', bundle);
  check('§H.2 Decumulation under NMPA: not eligible',
    dec1.amount === 0 && dec1.breakdown.eligible === false, dec1);

  // Decumulation — over NMPA
  const dec2 = e.decumulationCapacity(400000, 60, 'flexi-access', bundle);
  check('§H.3 Decumulation over NMPA: 25% PCLS = £100k',
    approx(dec2.breakdown.headlinePCLS, 100000), dec2);

  // Pension position — multi-asset
  const pp = e.pensionPosition({
    assets: [
      { wrapperType: 'SIPP', value: 400000 },
      { wrapperType: 'OccDB', value: 12000 },
      { wrapperType: 'StatePension', value: 12548 }
    ]
  }, bundle);
  check('§H.4 Pension position: DC £400k, DB £12k, StatePension £12,548',
    pp.breakdown.totalDC === 400000 &&
    pp.breakdown.totalDB === 12000 &&
    pp.breakdown.totalStateDB === 12548 &&
    pp.breakdown.grandTotal === 424548, pp);

  // Cost of inaction — pensionTiming stub
  const coi = e.costOfInactionPension({
    pensionContext: { contributionForgone: 10000, marginalRate: 0.40 }
  }, 'pensionTiming', bundle);
  check('§H.5 CoI pensionTiming stub: £10k × 40% = £4k forgone relief',
    coi.amount === 4000 && coi.breakdown.stub === true, coi);

  // CoI — wrong domain
  const coi2 = e.costOfInactionPension({}, 'estatePlanning', bundle);
  check('§H.6 CoI wrong domain: not applicable',
    coi2.breakdown.applicable === false, coi2);
}

// ─── REPORT ───────────────────────────────────────────────────────────────
console.log(`\n=== Result: ${passed} passed, ${failed} failed ===`);
if (failures.length > 0) {
  console.log('\nFailed scenarios:');
  failures.forEach(f => {
    console.log(`  ✗ ${f.name}`);
    console.log(`     actual:`, JSON.stringify(f.actual, null, 2).split('\n').slice(0, 6).join('\n'));
  });
  process.exit(1);
}
