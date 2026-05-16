/**
 * test-uk-residency-2026-1-1.js
 * Smoke tests for uk-residency engine.
 * Run: BUNDLE_PATH=./UK-master-2026.1.1.json node test-uk-residency-2026-1-1.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const bundlePath = process.env.BUNDLE_PATH || './UK-master-2026.1.1.json';
const bundle = JSON.parse(fs.readFileSync(path.resolve(bundlePath), 'utf8'));
const e = require('./uk-residency-2026-1-1.js');

let passed = 0, failed = 0;
const failures = [];
function check(name, predicate, actual) {
  if (predicate) passed++;
  else { failed++; failures.push({ name, actual }); }
}

console.log('=== uk-residency-2026-1-1.js · smoke test (s17a-3) ===\n');

// ─── §B.1 Automatic overseas tests ────────────────────────────────────────
{
  // Test 1: leaver, < 16 days
  const r1 = e.automaticOverseasTest1(
    { ukDays: 10, priorYearsResident: [true, true, true] }, bundle);
  check('§B.1.1 Auto overseas test 1: leaver with 10 days passes',
    r1.amount === true && r1.breakdown.applies === true, r1);

  const r2 = e.automaticOverseasTest1(
    { ukDays: 30, priorYearsResident: [true, true, true] }, bundle);
  check('§B.1.2 Auto overseas test 1: leaver with 30 days fails',
    r2.amount === false, r2);

  const r3 = e.automaticOverseasTest1(
    { ukDays: 5, priorYearsResident: [false, false, false] }, bundle);
  check('§B.1.3 Auto overseas test 1: arriver doesn\'t qualify',
    r3.amount === false && r3.breakdown.applies === false, r3);

  // Test 2: arriver, < 46 days
  const r4 = e.automaticOverseasTest2(
    { ukDays: 30, priorYearsResident: [false, false, false] }, bundle);
  check('§B.1.4 Auto overseas test 2: arriver with 30 days passes',
    r4.amount === true, r4);

  const r5 = e.automaticOverseasTest2(
    { ukDays: 50, priorYearsResident: [false, false, false] }, bundle);
  check('§B.1.5 Auto overseas test 2: arriver with 50 days fails',
    r5.amount === false, r5);

  // Test 3: full-time work overseas
  const r6 = e.automaticOverseasTest3({
    avgHoursPerWeekOverseas: 40, ukDays: 80, ukWorkdays: 20,
    significantBreaksFromOverseasWork: false
  }, bundle);
  check('§B.1.6 Auto overseas test 3: 40hr/wk, 80 UK days, 20 UK workdays passes',
    r6.amount === true, r6);

  const r7 = e.automaticOverseasTest3({
    avgHoursPerWeekOverseas: 40, ukDays: 100, ukWorkdays: 20,
    significantBreaksFromOverseasWork: false
  }, bundle);
  check('§B.1.7 Auto overseas test 3: 100 UK days fails',
    r7.amount === false, r7);
}

// ─── §B.2 Automatic UK tests ──────────────────────────────────────────────
{
  const r1 = e.automaticUKTest1({ ukDays: 200 }, bundle);
  check('§B.2.1 Auto UK test 1: 200 days passes', r1.amount === true, r1);

  const r2 = e.automaticUKTest1({ ukDays: 100 }, bundle);
  check('§B.2.2 Auto UK test 1: 100 days fails', r2.amount === false, r2);

  const r3 = e.automaticUKTest2({
    ukHomeConsecutiveDays: 100, daysInUKHomeInTaxYear: 50,
    hasOverseasHome: false
  }, bundle);
  check('§B.2.3 Auto UK test 2: UK-only home, 100 consec days, 50 in tax year passes',
    r3.amount === true, r3);

  const r4 = e.automaticUKTest2({
    ukHomeConsecutiveDays: 100, daysInUKHomeInTaxYear: 50,
    hasOverseasHome: true, daysInOverseasHome: 100
  }, bundle);
  check('§B.2.4 Auto UK test 2: significant overseas home use → fails',
    r4.amount === false, r4);

  const r5 = e.automaticUKTest3({
    avgHoursPerWeekUK: 40, ukWorkPercentOver365: 0.85
  }, bundle);
  check('§B.2.5 Auto UK test 3: 40hr/wk, 85% UK work passes',
    r5.amount === true, r5);

  const r6 = e.automaticUKTest3({
    avgHoursPerWeekUK: 40, ukWorkPercentOver365: 0.60
  }, bundle);
  check('§B.2.6 Auto UK test 3: 60% UK work fails',
    r6.amount === false, r6);
}

// ─── §B.3 Sufficient ties ─────────────────────────────────────────────────
{
  // Count ties
  const t1 = e.countTies({
    familyTie: true, accommodationTie: true, workTie: false,
    ninetyDayTie: true, countryTie: true
  }, 'leaver', bundle);
  check('§B.3.1 Leaver with 4 ties (incl. country)',
    t1.amount === 4, t1);

  const t2 = e.countTies({
    familyTie: true, accommodationTie: true, workTie: false,
    ninetyDayTie: true, countryTie: true
  }, 'arriver', bundle);
  check('§B.3.2 Arriver: country tie not counted (3 ties)',
    t2.amount === 3 && !t2.breakdown.ties.includes('country'), t2);

  // Matrix lookup
  const m1 = e.sufficientTiesResult(50, 3, 'leaver', bundle);
  check('§B.3.3 Leaver 50 days, 3 ties → resident',
    m1.amount === true, m1);

  const m2 = e.sufficientTiesResult(50, 2, 'leaver', bundle);
  check('§B.3.4 Leaver 50 days, 2 ties → not resident',
    m2.amount === false, m2);

  const m3 = e.sufficientTiesResult(30, 3, 'arriver', bundle);
  check('§B.3.5 Arriver in 16-45 band → always non-resident',
    m3.amount === false && m3.breakdown.required === 'N/A', m3);

  const m4 = e.sufficientTiesResult(150, 1, 'leaver', bundle);
  check('§B.3.6 Leaver 150 days, 1 tie → resident',
    m4.amount === true, m4);
}

// ─── §B.4 SRT aggregate ───────────────────────────────────────────────────
{
  // Auto overseas wins
  const s1 = e.statutoryResidenceTest({
    ukDays: 10, priorYearsResident: [true, true, true]
  }, bundle);
  check('§B.4.1 SRT: 10 days leaver → auto non-resident',
    s1.amount === 'non-resident' && s1.breakdown.stage === 'automaticOverseas', s1);

  // Auto UK wins
  const s2 = e.statutoryResidenceTest({
    ukDays: 200, priorYearsResident: [false, false, false]
  }, bundle);
  check('§B.4.2 SRT: 200 days → auto UK resident',
    s2.amount === 'uk-resident' && s2.breakdown.stage === 'automaticUK', s2);

  // Sufficient ties — leaver, mid-band, 3 ties → resident
  const s3 = e.statutoryResidenceTest({
    ukDays: 60, priorYearsResident: [true, true, true],
    familyTie: true, accommodationTie: true, ninetyDayTie: true
  }, bundle);
  check('§B.4.3 SRT: leaver 60 days, 3 ties → UK resident via ties',
    s3.amount === 'uk-resident' && s3.breakdown.stage === 'sufficientTies', s3);

  // Sufficient ties — arriver, mid-band, 3 ties → not enough (needs 4)
  const s4 = e.statutoryResidenceTest({
    ukDays: 60, priorYearsResident: [false, false, false],
    familyTie: true, accommodationTie: true, ninetyDayTie: true
  }, bundle);
  check('§B.4.4 SRT: arriver 60 days, 3 ties → non-resident (needs 4)',
    s4.amount === 'non-resident' && s4.breakdown.stage === 'sufficientTies', s4);
}

// ─── §C Day count ─────────────────────────────────────────────────────────
{
  const d1 = e.countUKDays(180, 0, bundle);
  check('§C.1 No exceptional: 180 → 180', d1.amount === 180, d1);

  const d2 = e.countUKDays(180, 30, bundle);
  check('§C.2 30 exceptional disregarded: 180 → 150', d2.amount === 150, d2);

  const d3 = e.countUKDays(180, 90, bundle);
  check('§C.3 90 claimed but capped at 60: 180 → 120',
    d3.amount === 120 && d3.breakdown.exceptionalCapped === true, d3);
}

// ─── §D Split year ────────────────────────────────────────────────────────
{
  // Leaver Case 1
  const sy1 = e.splitYearLeaver({
    startedFTOverseasWork: true, notUKResNextYear: true,
    ftOverseasWorkContinuesToYearEnd: true, meetsAutoOverseas3NextYear: true,
    firstDayOfOverseasWork: '2026-09-15'
  }, bundle);
  check('§D.1 Leaver Case 1: starting FT overseas work',
    sy1.amount === 'case1' && sy1.breakdown.case === 1, sy1);

  // Leaver no case
  const sy2 = e.splitYearLeaver({}, bundle);
  check('§D.2 Leaver: no case', sy2.amount === null, sy2);

  // Arriver Case 5
  const sy3 = e.splitYearArriver({
    startedFTUKWork: true, notUKResPriorYear: true, ukResThisYear: true,
    ftUKWorkContinues365Plus: true, firstDayUKFTWork: '2026-08-01'
  }, bundle);
  check('§D.3 Arriver Case 5: starting FT UK work',
    sy3.amount === 'case5' && sy3.breakdown.case === 5, sy3);

  // Determine split year — leaver
  const sy4 = e.determineSplitYear({
    movementDirection: 'leaving',
    startedFTOverseasWork: true, notUKResNextYear: true,
    ftOverseasWorkContinuesToYearEnd: true, meetsAutoOverseas3NextYear: true,
    firstDayOfOverseasWork: '2026-09-15'
  }, bundle);
  check('§D.4 determineSplitYear: leaver Case 1',
    sy4.amount === 'case1', sy4);

  // No movement
  const sy5 = e.determineSplitYear({}, bundle);
  check('§D.5 determineSplitYear: no movement', sy5.amount === null, sy5);
}

// ─── §E Domicile ──────────────────────────────────────────────────────────
{
  // DOO — legitimate, father's domicile
  const d1 = e.domicileOfOrigin({
    fatherDomicileAtBirth: 'India', motherDomicileAtBirth: 'UK',
    legitimateAtBirth: true
  }, bundle);
  check('§E.1 DOO: legitimate → father (India)',
    d1.amount === 'India', d1);

  // DOO — illegitimate, mother's domicile
  const d2 = e.domicileOfOrigin({
    fatherDomicileAtBirth: 'India', motherDomicileAtBirth: 'UK',
    legitimateAtBirth: false
  }, bundle);
  check('§E.2 DOO: illegitimate → mother (UK)',
    d2.amount === 'UK', d2);

  // DoC — acquired
  const d3 = e.domicileOfChoice({
    residingInJurisdictionOfChoice: true, intentionToRemainIndefinitely: true,
    jurisdictionOfChoice: 'France'
  }, bundle);
  check('§E.3 DoC: residing + intent → France',
    d3.amount === 'France', d3);

  // DoC — not acquired
  const d4 = e.domicileOfChoice({
    residingInJurisdictionOfChoice: true, intentionToRemainIndefinitely: false,
    jurisdictionOfChoice: 'France'
  }, bundle);
  check('§E.4 DoC: no firm intent → not acquired',
    d4.amount === null, d4);

  // DoD — child
  const d5 = e.domicileOfDependence({ age: 10, relevantParentDomicile: 'UK' }, bundle);
  check('§E.5 DoD: age 10 → UK', d5.amount === 'UK', d5);

  // DoD — adult
  const d6 = e.domicileOfDependence({ age: 18, relevantParentDomicile: 'UK' }, bundle);
  check('§E.6 DoD: age 18 → not applicable',
    d6.amount === null && d6.breakdown.applicable === false, d6);

  // Transitional deemed domicile
  const d7 = e.deemedDomicileTransitional({
    eventDate: '2024-06-01', ukResidentYears: 18
  }, bundle);
  check('§E.7 Deemed dom transitional: pre-Apr-2025, 18 yr → deemed',
    d7.amount === true, d7);

  const d8 = e.deemedDomicileTransitional({
    eventDate: '2026-06-01', ukResidentYears: 18
  }, bundle);
  check('§E.8 Deemed dom transitional: post-Apr-2025 → superseded by LTR',
    d8.amount === false && d8.breakdown.inTransitional === false, d8);
}

// ─── §F Long-term resident IHT (REQUIRED BY HANDOVER) ─────────────────────
{
  const ltr1 = e.longTermResidentStatus({ yearsUKResidentInLast20: 12 }, bundle);
  check('§F.1 LTR: 12 of last 20 → IS long-term resident',
    ltr1.amount === true && ltr1.breakdown.ihtScope === 'worldwide', ltr1);

  const ltr2 = e.longTermResidentStatus({ yearsUKResidentInLast20: 5 }, bundle);
  check('§F.2 LTR: 5 of last 20 → NOT long-term resident',
    ltr2.amount === false && ltr2.breakdown.ihtScope === 'UK-situs only', ltr2);

  const ltr3 = e.longTermResidentStatus({ yearsUKResidentInLast20: 10 }, bundle);
  check('§F.3 LTR: exactly 10 → IS long-term resident (≥ threshold)',
    ltr3.amount === true, ltr3);
}

// ─── §G FIG ────────────────────────────────────────────────────────────────
{
  // Eligible
  const f1 = e.figEligibility({
    ukResidentCurrentYear: true,
    priorYearsResident: Array(10).fill(false),
    yearsUKResidentSoFar: 1
  }, bundle);
  check('§G.1 FIG: UK res this yr, non-res 10 yrs, year 1 → eligible',
    f1.amount === true && f1.breakdown.remainingFigYears === 3, f1);

  // Not eligible — was UK resident in last 10
  const f2 = e.figEligibility({
    ukResidentCurrentYear: true,
    priorYearsResident: [false, false, false, false, false, false, false, false, false, true]
  }, bundle);
  check('§G.2 FIG: was UK res in last 10 → not eligible',
    f2.amount === false, f2);

  // Election made
  const f3 = e.figElect({
    ukResidentCurrentYear: true,
    priorYearsResident: Array(10).fill(false),
    yearsUKResidentSoFar: 1,
    electFIG: true
  }, bundle);
  check('§G.3 FIG election: foreign income/gains exempt',
    f3.amount === true && f3.breakdown.foreignIncomeExempt === true, f3);

  // No election
  const f4 = e.figElect({
    ukResidentCurrentYear: true,
    priorYearsResident: Array(10).fill(false),
    yearsUKResidentSoFar: 1,
    electFIG: false
  }, bundle);
  check('§G.4 FIG no election: worldwide arising basis',
    f4.amount === null && f4.breakdown.elected === false, f4);

  // Year 5 alert — in cliff
  const f5 = e.figYearFiveAlert({ yearsUKResidentSoFar: 5 }, bundle);
  check('§G.5 FIG year 5: cliff (window closed)',
    f5.breakdown.inCliff === true, f5);

  // Year 5 alert — final FIG year
  const f6 = e.figYearFiveAlert({ yearsUKResidentSoFar: 4 }, bundle);
  check('§G.6 FIG year 4: final year, plan ahead',
    f6.breakdown.inFinalYear === true && f6.breakdown.yearsToCliff === 1, f6);

  // Year 5 alert — early
  const f7 = e.figYearFiveAlert({ yearsUKResidentSoFar: 1 }, bundle);
  check('§G.7 FIG year 1: 4 years to cliff',
    f7.amount === 4 && f7.breakdown.inCliff === false, f7);
}

// ─── §H TRF ────────────────────────────────────────────────────────────────
{
  // Rate lookup
  const t1 = e.trfRate(2025, bundle);
  check('§H.1 TRF rate 2025/26 = 12%', t1.amount === 0.12, t1);

  const t2 = e.trfRate(2027, bundle);
  check('§H.2 TRF rate 2027/28 = 15%', t2.amount === 0.15, t2);

  const t3 = e.trfRate(2028, bundle);
  check('§H.3 TRF rate 2028/29 = unavailable',
    t3.amount === null, t3);

  // Designation eligible
  const td = e.trfDesignate(500000, 2026, {
    formerRemittanceBasisUser: true, hasPreApr2025UnremittedFIG: true
  }, bundle);
  check('§H.4 TRF designate £500k at 2026/27 12% = £60k tax',
    td.amount === 60000, td);

  // Designation not eligible
  const td2 = e.trfDesignate(500000, 2026, {
    formerRemittanceBasisUser: false, hasPreApr2025UnremittedFIG: true
  }, bundle);
  check('§H.5 TRF designate: not RB user → ineligible',
    td2.amount === 0 && td2.breakdown.eligible === false, td2);

  // Mixed-fund priority
  const mfp = e.trfMixedFundPriority([
    { type: 'gains', amount: 50000 },
    { type: 'post2008Income', amount: 100000 },
    { type: 'cleanCapital', amount: 200000 },
    { type: 'pre2008Income', amount: 30000 }
  ], bundle);
  check('§H.6 Mixed-fund priority: post-2008 income first',
    mfp.amount[0].type === 'post2008Income' &&
    mfp.amount[1].type === 'pre2008Income' &&
    mfp.amount[2].type === 'gains' &&
    mfp.amount[3].type === 'cleanCapital', mfp);
}

// ─── §I Temporary non-residence + DTAA + FTC ─────────────────────────────
{
  // TNR — within 5 years
  const t1 = e.temporaryNonResidence({
    yearsAwayFromUK: 3, wasUKResidentBeforeLeaving: true, hasReturnedToUK: true
  }, bundle);
  check('§I.1 TNR: 3 yrs away → applies', t1.amount === true, t1);

  // TNR — 5+ years
  const t2 = e.temporaryNonResidence({
    yearsAwayFromUK: 6, wasUKResidentBeforeLeaving: true, hasReturnedToUK: true
  }, bundle);
  check('§I.2 TNR: 6 yrs away → does not apply', t2.amount === false, t2);

  // Treaty tie-break — permanent home
  const tb1 = e.treatyResidenceTieBreaker({
    facts: { permanentHomeUK: true, permanentHomeOther: false }
  }, bundle);
  check('§I.3 Tie-break: permanent home UK only → UK',
    tb1.amount === 'UK', tb1);

  // Treaty tie-break — vital interests
  const tb2 = e.treatyResidenceTieBreaker({
    facts: { permanentHomeUK: true, permanentHomeOther: true, centreOfVitalInterests: 'France' }
  }, bundle);
  check('§I.4 Tie-break: both homes → vital interests France',
    tb2.amount === 'France', tb2);

  // FTC — full credit
  const ftc1 = e.foreignTaxCredit(10000, 8000, bundle);
  check('§I.5 FTC: foreign 8k ≤ UK 10k → credit 8k',
    ftc1.amount === 8000 && ftc1.breakdown.ukTaxAfterCredit === 2000, ftc1);

  // FTC — capped at UK liability
  const ftc2 = e.foreignTaxCredit(10000, 12000, bundle);
  check('§I.6 FTC: foreign 12k > UK 10k → credit capped at 10k',
    ftc2.amount === 10000 && ftc2.breakdown.unrelievedForeignTax === 2000, ftc2);
}

// ─── §J Aggregates ────────────────────────────────────────────────────────
{
  const r1 = e.getResidencyStatus({
    ukDays: 200, priorYearsResident: [false, false, false],
    yearsUKResidentInLast20: 5
  }, bundle);
  check('§J.1 getResidencyStatus: aggregates SRT + LTR',
    r1.amount === 'uk-resident' && r1.breakdown.longTermResident === false, r1);

  const sc1 = e.taxScope('uk-resident', false, bundle);
  check('§J.2 taxScope: UK resident, not LTR → IHT UK-situs only',
    sc1.breakdown.ihtScope === 'UK-situs only' &&
    sc1.breakdown.itCgtScope.includes('worldwide'), sc1);

  const sc2 = e.taxScope('uk-resident', true, bundle);
  check('§J.3 taxScope: UK resident, LTR → IHT worldwide',
    sc2.breakdown.ihtScope === 'worldwide', sc2);

  const sc3 = e.taxScope('non-resident', false, bundle);
  check('§J.4 taxScope: non-resident → IT/CGT UK-source only',
    sc3.breakdown.itCgtScope === 'UK-source only', sc3);
}

// ─── REPORT ───────────────────────────────────────────────────────────────
console.log(`\n=== Result: ${passed} passed, ${failed} failed ===`);
if (failures.length > 0) {
  console.log('\nFailed:');
  failures.forEach(f => {
    console.log(`  ✗ ${f.name}`);
    console.log(`     actual:`, JSON.stringify(f.actual, null, 2).split('\n').slice(0, 8).join('\n'));
  });
  process.exit(1);
}
