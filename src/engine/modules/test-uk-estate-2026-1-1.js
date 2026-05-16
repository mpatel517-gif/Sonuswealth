/**
 * test-uk-estate-2026-1-1.js
 *
 * Smoke test for uk-estate-2026-1-1.js (s17a-2 deliverable).
 * Pattern mirrors s17a-1's test-uk-tax-2026-1-1.js (30 scenarios pass).
 *
 * Each test asserts the engine's `amount` against an HMRC-derived expected output,
 * with tolerance for rounding (currency to nearest pence; rates to 4 dp).
 *
 * Run: `node test/test-uk-estate-2026-1-1.js`
 *
 * Bundle: UK-2026.1.1.json — loaded at top.
 */

'use strict';

import { readFileSync } from 'node:fs';
import {
  nilRateBand, residenceNilRateBand, transferableNRB, transferableRNRB, combinedNilRateBands,
  annualGiftExemption, smallGiftsExemption, weddingGiftExemption, normalExpenditureFromIncomeQualifies,
  spouseExemption, charityExemption,
  taperReliefFactor, petStatus, cltEntryCharge, cltAdditionalChargeOnDeath,
  cumulateGiftsForNRB, failedPETsTax, grobIncluded, fourteenYearRule,
  bprQualifies, aprQualifies,
  bprAprAllowanceForEntity, bprAprAllocateAllowance, bprAprTransitionalRegime,
  aimBprRelief, bprAprReliefApplied,
  ihtRate, charityTenPercentTest, instalmentEligible, ihtWaterfall,
  ihtScope, excludedPropertyTrust,
  intestacyDistribution, inheritanceAct1975Eligible,
  deedOfVariation,
  trustTenYearAnniversaryCharge, trustExitCharge, trustITRate, trustCGTRate,
  loanTrustValueInEstate, dgtChargeable, frtCheck,
  pre2006IIPInEstate,
  lpaAttorneyGiftPermitted,
  getWrapperEstate, estateValuation, ihtDynamic, estatePlanningHandler, taxOnEstate,
} from '../src/engine/uk-estate-2026-1-1.js';

const BUNDLE_PATH = process.env.BUNDLE_PATH || './UK-2026.1.1.json';
const bundle = JSON.parse(readFileSync(BUNDLE_PATH, 'utf8'));

let passed = 0, failed = 0;
const failures = [];

function approxEqual(a, b, tol = 0.01) {
  return Math.abs(a - b) <= tol;
}

function test(name, actual, expected, tol = 0.01) {
  const ok = (typeof expected === 'number' && typeof actual === 'number')
    ? approxEqual(actual, expected, tol)
    : actual === expected;
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push({ name, expected, actual });
    console.log(`  ✗ ${name}  expected=${expected}  actual=${actual}`);
  }
}

console.log('\n=== uk-estate-2026-1-1.js · smoke test (s17a-2 + O-EST-RNRB-CAP-1 · v1.1) ===\n');

// ──── §5.1 IHT BANDS ────
console.log('§5.1 IHT bands:');
test('NRB amount', nilRateBand(bundle).amount, 325000);
test('RNRB no descendants → 0', residenceNilRateBand(500000, false, bundle).amount, 0);
test('RNRB full @ £500k estate', residenceNilRateBand(500000, true, bundle).amount, 175000);
// Estate £2.5m → taper £250k off RNRB → 175k - 250k = 0 (clamped)
test('RNRB tapered to 0 @ £2.5m estate', residenceNilRateBand(2500000, true, bundle).amount, 0);
// Estate £2.2m → taper £100k off → 175k - 100k = 75k
test('RNRB partial taper @ £2.2m estate', residenceNilRateBand(2200000, true, bundle).amount, 75000);

// TNRB: 100% of deceased's NRB transfers
test('TNRB 100% transfer = £325k', transferableNRB(1.0, bundle).amount, 325000);
test('TNRB 50% transfer = £162.5k', transferableNRB(0.5, bundle).amount, 162500);

// Combined: estate £1m, both spouses unused 100%, residence to descendants
const combined1 = combinedNilRateBands({
  grossEstateValue: 1000000,
  residenceLeftToDirectDescendants: true,
  deceasedSpouseUnusedNRBPct: 1.0,
  deceasedSpouseUnusedRNRBPct: 1.0,
}, bundle);
// Expected: £325k + £325k (TNRB) + £350k (RNRB total) = £1,000,000 — the famous "£1m IHT-free couple"
test('Combined £1m couple at £1m estate', combined1.amount, 1000000);

// ──── §5.2 Exemptions ────
console.log('\n§5.2 Exemptions:');
test('Annual exemption fresh = £3k', annualGiftExemption(0, 0, bundle).amount, 3000);
test('Annual exemption with carry-fwd = £6k', annualGiftExemption(3000, 0, bundle).amount, 6000);
test('Small gift £250 exempt', smallGiftsExemption([{ recipient: 'A', amount: 250 }], bundle).amount, 250);
test('Small gift £251 fails (whole amount)', smallGiftsExemption([{ recipient: 'A', amount: 251 }], bundle).amount, 0);
test('Wedding gift parent = £5k', weddingGiftExemption('parent', bundle).amount, 5000);
test('Spouse exemption UK-dom unlimited', spouseExemption(2000000, true, 0, bundle).amount, 2000000);
// Non-dom spouse: capped at £325k cumulatively
test('Spouse exemption non-dom capped @ £325k', spouseExemption(500000, false, 0, bundle).amount, 325000);
test('Charity exemption qualifying', charityExemption(100000, true, bundle).amount, 100000);

// ──── §5.4 Gifts/PETs/Taper ────
console.log('\n§5.4 Gifts/PETs/Taper:');
test('Taper 0-3 yrs = full rate (factor 1.0)', taperReliefFactor(2.5, bundle).amount, 1.0);
test('Taper 3-4 yrs = 0.80 (32% effective)', taperReliefFactor(3.5, bundle).amount, 0.80);
test('Taper 6-7 yrs = 0.20 (8% effective)', taperReliefFactor(6.5, bundle).amount, 0.20);
test('Taper 7+ yrs = 0', taperReliefFactor(7.5, bundle).amount, 0);

// CLT entry charge: £400k CLT, no prior CLTs → £325k NRB → £75k above NRB × 20% = £15k
test('CLT £400k entry charge = £15k', cltEntryCharge(400000, 0, bundle).amount, 15000);

// Cumulation: two PETs in 7yr window — older first uses NRB
const gifts = [
  { date: '2020-01-15', amount: 200000, type: 'PET', exemptionsApplied: 3000 },
  { date: '2022-06-01', amount: 250000, type: 'PET', exemptionsApplied: 0 },
];
const deathDate = '2026-05-07';
const cum = cumulateGiftsForNRB(gifts, deathDate, bundle);
// Net values: £197k, £250k. Total £447k. NRB £325k → £122k above NRB on 2nd gift
test('Gift cumulation NRB consumed = £325k', cum.amount, 325000);

// Failed PETs tax: 1st gift wholly within NRB (no tax). 2nd gift: above-NRB £122k.
// Years since 2nd gift = 2026-05 minus 2022-06 ≈ 3.93 → taper factor 0.80
// Tax = 122,000 × 0.40 × 0.80 = £39,040
const fpt = failedPETsTax(gifts, deathDate, bundle);
test('Failed PETs tax ≈ £39,040', fpt.amount, 39040, 50);

// GROB
test('GROB detected (gift home, live there free)',
  grobIncluded({ donorRetainsBenefit: true, payingMarketRent: false }, bundle).amount, 1);
test('GROB broken with market rent',
  grobIncluded({ donorRetainsBenefit: true, payingMarketRent: true }, bundle).amount, 0);

// ──── §5.3 BPR/APR ────
console.log('\n§5.3/§5.3a BPR/APR:');
test('BPR unquoted trading 2yr+ = 100%',
  bprQualifies({ type: 'unquotedTradingCompany', holdingPeriodYears: 3 }, bundle).amount, 1.0);
test('BPR fails <2yr hold',
  bprQualifies({ type: 'unquotedTradingCompany', holdingPeriodYears: 1 }, bundle).amount, 0);
test('AIM BPR = 50% from Apr 2026',
  bprQualifies({ type: 'aimShares', holdingPeriodYears: 3 }, bundle).amount, 0.50);

test('APR owner-occupied 2yr+ = 100%',
  aprQualifies({ type: 'farmland', occupancyType: 'ownerOccupied', ownershipYears: 5 }, bundle).amount, 1.0);
test('APR let pre-1995 (AHA) 7yr+ = 50%',
  aprQualifies({ type: 'farmland', occupancyType: 'tenantFarmer', tenancyType: 'AHA1986', ownershipYears: 10 }, bundle).amount, 0.50);
test('APR let post-1995 (FBT) 7yr+ = 100%',
  aprQualifies({ type: 'farmland', occupancyType: 'tenantFarmer', tenancyType: 'ATA1995', ownershipYears: 10 }, bundle).amount, 1.0);

// BPR/APR allowance entity — solo individual = £2.5m
test('BPR/APR allowance solo = £2.5m', bprAprAllowanceForEntity(0, bundle).amount, 2500000);
// Couple unused full transfer = £5m
test('BPR/APR allowance couple = £5m', bprAprAllowanceForEntity(1.0, bundle).amount, 5000000);

// AIM BPR relief: £100k held 3 years → 50% × £100k = £50k relief; remaining £50k taxable
test('AIM BPR relief £100k = £50k', aimBprRelief(100000, 3, bundle).amount, 50000);

// BPR/APR allocation: £3m APR + £2m BPR = £5m total, £2.5m allowance
// APR share 60% → £1.5m allowance; BPR 40% → £1.0m allowance
const alloc = bprAprAllocateAllowance(3000000, 2000000, 2500000);
test('BPR/APR alloc APR allowance = £1.5m', alloc.breakdown.aprAllowance, 1500000);
test('BPR/APR alloc BPR allowance = £1.0m', alloc.breakdown.bprAllowance, 1000000);

// Full BPR/APR computation: £3m BPR (no APR), no spouse transfer, no AIM
// → first £2.5m at 100%, £500k at 50% = £2.5m + £250k = £2.75m relief
const reliefScenario = bprAprReliefApplied({
  aprAssets: [],
  bprAssets: [{ value: 3000000 }],
  aimAssets: [],
  deceasedSpouseUnusedAllowancePct: 0,
}, bundle);
test('BPR scenario £3m → £2.75m relief', reliefScenario.amount, 2750000);

// Transitional regime
const regime1 = bprAprTransitionalRegime('2024-01-15', '2027-06-01', bundle);
test('Pre-30-Oct-2024 transfer → old-unlimited',
  regime1.breakdown.regime, 'old-unlimited');
const regime2 = bprAprTransitionalRegime('2025-06-15', '2027-06-01', bundle);
test('Transition window + post-reform death → new-with-allowance',
  regime2.breakdown.regime, 'new-with-allowance');
const regime3 = bprAprTransitionalRegime('2025-06-15', '2025-12-01', bundle);
test('Transition window + pre-reform death → old-unlimited',
  regime3.breakdown.regime, 'old-unlimited');

// ──── §5.5 Computation ────
console.log('\n§5.5 Computation:');
// Charity 10% test: net estate £900k, charity £90k → exactly 10% qualifies
test('Charity 10% test exactly 10% qualifies',
  charityTenPercentTest({ grossEstate: 1000000, totalExemptions: 100000, totalReliefs: 0, charitableLegacy: 90000 }, bundle).amount, 1);
test('Charity 10% test 9% fails',
  charityTenPercentTest({ grossEstate: 1000000, totalExemptions: 100000, totalReliefs: 0, charitableLegacy: 81000 }, bundle).amount, 0);

// IHT rate: charity 10% → 36%
test('IHT rate 36% with 10% charity',
  ihtRate(900000, 90000, bundle).amount, 0.36);
test('IHT rate 40% no charity',
  ihtRate(900000, 0, bundle).amount, 0.40);

// IHT waterfall — single £700k estate, no spouse, no charity, no reliefs, no gifts
// Bands £325k (NRB) + £175k (RNRB if descendants) = £500k → taxable £200k × 40% = £80k
const wf1 = ihtWaterfall({
  grossEstate: 700000,
  residenceLeftToDirectDescendants: true,
}, bundle);
test('Waterfall £700k → £80k IHT', wf1.amount, 80000);

// Couple double-NRB: £1m estate, both spouses unused, residence to descendants
// = full £1m bands → £0 IHT
const wf2 = ihtWaterfall({
  grossEstate: 1000000,
  residenceLeftToDirectDescendants: true,
  deceasedSpouseUnusedNRBPct: 1.0,
  deceasedSpouseUnusedRNRBPct: 1.0,
}, bundle);
test('Waterfall couple £1m → £0', wf2.amount, 0);

// Instalment eligibility
test('Instalment OK: ukLand', instalmentEligible({ type: 'ukLand' }, bundle).amount, 1);
test('Instalment OK: BPR', instalmentEligible({ type: 'bprQualifying' }, bundle).amount, 1);
test('Instalment fail: cash', instalmentEligible({ type: 'cash' }, bundle).amount, 0);

// ──── §5.6 Domicile ────
console.log('\n§5.6 Domicile:');
test('Long-term resident 10/20 → worldwide',
  ihtScope(10, false, bundle).breakdown.scope, 'worldwide');
test('Non-LTR non-dom → UK-situs only',
  ihtScope(5, false, bundle).breakdown.scope, 'UK-situs only');

// ──── §5.7 Intestacy ────
console.log('\n§5.7 Intestacy:');
const int1 = intestacyDistribution({
  estateValue: 1000000, jurisdiction: 'EW',
  maritalStatus: 'married', hasChildren: true, hasIssue: true,
}, bundle);
// Spouse: chattels + £322k + ½ × (£1m - £322k) = £322k + £339k = £661k
test('Intestacy E&W married+children spouse total',
  int1.breakdown.distribution.spouse.total, 661000);
test('Intestacy Scotland flagged separately',
  intestacyDistribution({ estateValue: 1000000, jurisdiction: 'Scotland', maritalStatus: 'married', hasChildren: true, hasIssue: true }, bundle)
    .breakdown.jurisdiction, 'Scotland');

// Inheritance Act 1975 eligibility
test('IA1975 spouse eligible',
  inheritanceAct1975Eligible({ relationship: 'spouse', monthsSinceProbate: 3 }, bundle).amount, 1);
test('IA1975 cohabitee 1yr → ineligible',
  inheritanceAct1975Eligible({ relationship: 'cohabitee_2yr', yearsCohabiting: 1, monthsSinceProbate: 3 }, bundle).amount, 0);
test('IA1975 out of time',
  inheritanceAct1975Eligible({ relationship: 'spouse', monthsSinceProbate: 8 }, bundle).amount, 0);

// ──── §5.9 DoV ────
console.log('\n§5.9 DoV:');
test('DoV valid within 2 years',
  deedOfVariation({
    deathDate: '2024-06-01', dovDate: '2025-06-01',
    signedByAllAffectedBeneficiaries: true, inWriting: true, containsS142Election: true,
  }, bundle).amount, 1);
test('DoV invalid past 2 years',
  deedOfVariation({
    deathDate: '2022-01-01', dovDate: '2025-06-01',
    signedByAllAffectedBeneficiaries: true, inWriting: true, containsS142Election: true,
  }, bundle).amount, 0);

// ──── §6 Trusts ────
console.log('\n§6 Trusts:');
// 10-year charge: trust £700k, no prior CLTs → £325k NRB → £375k above × 6% = £22.5k
test('Trust 10yr charge £700k = £22.5k',
  trustTenYearAnniversaryCharge({ trustValue: 700000, priorChargeableTransfers7yrs: 0 }, bundle).amount, 22500);
// Exit charge: £100k leaving, 20 quarters since TYA, last TYA effective 4%
// → exit rate = 4% × 20/40 = 2% → £2,000
test('Trust exit charge',
  trustExitCharge({ amountLeaving: 100000, lastTYAEffectiveRate: 0.04, quartersSinceTYA: 20 }, bundle).amount, 2000);

// Trust IT discretionary: £10k non-div above £1k band → first £1k @20% = £200, remaining £9k @45% = £4,050 → £4,250
const ti1 = trustITRate({ trustType: 'discretionary', nonDividendIncome: 10000, dividendIncome: 0 }, bundle);
test('Trust IT discretionary £10k income',
  ti1.amount, 4250);

// Trust CGT: £20k gains, AEA = ½ × £3k = £1,500, taxable £18,500 × 24% = £4,440
test('Trust CGT £20k gains',
  trustCGTRate(20000, {}, bundle).amount, 4440);

// ──── §6.3 Estate vehicles ────
console.log('\n§6.3 Estate vehicles:');
// Loan trust: £200k loan, £50k repaid, £280k current → £150k in estate, £130k outside
const lt = loanTrustValueInEstate({ originalLoanAmount: 200000, currentTrustValue: 280000, loanRepaid: 50000 }, bundle);
test('Loan trust in estate', lt.amount, 150000);
test('Loan trust outside estate growth', lt.breakdown.outsideEstate, 130000);

// DGT: £500k transfer, 40% discount → chargeable £300k
test('DGT chargeable',
  dgtChargeable({ transferAmount: 500000, actuarialDiscountPct: 0.40, trustType: 'absolute' }, bundle).amount, 300000);

// ──── §6.4 Pre-2006 ────
console.log('\n§6.4 Pre-2006:');
test('Pre-2006 IIP qualifying → in estate',
  pre2006IIPInEstate({ trustValue: 500000, settlementDate: '2003-01-01', isQualifyingInterest: true }, bundle).amount, 500000);
test('Post-2006 → not in estate',
  pre2006IIPInEstate({ trustValue: 500000, settlementDate: '2010-01-01', isQualifyingInterest: true }, bundle).amount, 0);

// ──── §13.2/§16 LPA ────
console.log('\n§13.2/§16 LPA:');
test('LPA birthday gift to family permitted',
  lpaAttorneyGiftPermitted({
    amount: 500, occasionType: 'birthday', recipientType: 'family', isReasonableRelativeToEstate: true,
  }, 1000000, bundle).amount, 1);
test('LPA IHT-planning gift NOT permitted',
  lpaAttorneyGiftPermitted({
    amount: 3000, occasionType: 'iht_planning', recipientType: 'family', isReasonableRelativeToEstate: true,
  }, 1000000, bundle).amount, 0);

// ──── Aggregates ────
console.log('\nAggregates (wrapper-first + ihtDynamic):');
const wrap1 = getWrapperEstate({ wrapperType: 'SIPP_UNCRYSTALLISED' });
test('Wrapper SIPP → PENSION_DC', wrap1.estateInclusion, 'PENSION_DC');
const wrap2 = getWrapperEstate({ wrapperType: 'LIFE_POLICY', isInTrust: true });
test('Wrapper Life-in-trust → OUTSIDE_ESTATE', wrap2.estateInclusion, 'OUTSIDE_ESTATE');
const wrap3 = getWrapperEstate({ wrapperType: 'ISA' });
test('Wrapper ISA → IN_ESTATE', wrap3.estateInclusion, 'IN_ESTATE');

// Estate valuation
const ent = {
  assets: [
    { name: 'House', wrapperType: 'PROPERTY_DIRECT', value: 800000 },
    { name: 'ISA',   wrapperType: 'ISA',             value: 100000 },
    { name: 'SIPP',  wrapperType: 'SIPP_UNCRYSTALLISED', value: 500000 },
    { name: 'Life policy in trust', wrapperType: 'LIFE_POLICY', isInTrust: true, value: 250000 },
  ],
};
const ev = estateValuation(ent, bundle);
// Pre-Apr-2027 (today is May 2026): SIPP excluded → estate = £900k
test('Estate valuation pre-Apr-2027 (SIPP outside)', ev.amount, 900000);
test('Estate valuation outside-estate total', ev.breakdown.outsideEstate, 250000);

// ──── §5.1 RNRB residence-value cap (O-EST-RNRB-CAP-1 fix · IHTM46031 · v1.1) ────
console.log('\n§5.1 RNRB cap (IHTM46031 · v1.1):');

// Test 1: £100k residence, no taper → RNRB capped at £100k (not full £175k base)
test('RNRB capped at £100k residence (no taper)',
  residenceNilRateBand(900000, true, bundle, 100000).amount, 100000);

// Test 2: £500k residence, no taper → cap not binding → full tapered RNRB = £175k
test('RNRB £500k residence → cap not binding → £175k',
  residenceNilRateBand(900000, true, bundle, 500000).amount, 175000);

// Test 3: £60k residence + taper (£2.2m estate → tapered RNRB = £75k) → cap £60k applies
// taperReduction = floor((2200000-2000000)/2) = 100000; rnrbAfterTaper = 175000-100000 = 75000
// min(75000, 60000) = 60000
test('RNRB cap + taper: £2.2m estate, £60k residence → £60k',
  residenceNilRateBand(2200000, true, bundle, 60000).amount, 60000);

// Test 4: £100k residence + taper (£2.2m estate → tapered £75k) → cap £100k → not binding
// min(75000, 100000) = 75000
test('RNRB cap + taper: £2.2m estate, £100k residence → taper binding at £75k',
  residenceNilRateBand(2200000, true, bundle, 100000).amount, 75000);

// Test 5: backward compat — no 4th arg → Infinity → same result as pre-patch
test('RNRB backward compat: no residenceValue arg → £175k (no cap)',
  residenceNilRateBand(900000, true, bundle).amount, 175000);

// Test 6: combinedNilRateBands with residenceValue cap
// NRB £325k + RNRB capped at £100k = £425k
const combinedWithCap = combinedNilRateBands({
  grossEstateValue: 900000,
  residenceLeftToDirectDescendants: true,
  deceasedSpouseUnusedNRBPct: 0,
  deceasedSpouseUnusedRNRBPct: 0,
  residenceValue: 100000,
}, bundle);
test('combinedNilRateBands: residenceValue cap (£100k) → £425k total',
  combinedWithCap.amount, 425000);

// Test 7: ihtDynamic end-to-end — small flat (cap binding)
// £100k flat + £800k ISA = £900k estate. RNRB capped at £100k (not £175k).
// Bands: £325k + £100k = £425k. Taxable: £475k × 40% = £190k.
const entSmallFlat = {
  assets: [
    { name: 'Small flat', wrapperType: 'PROPERTY_DIRECT', value: 100000 },
    { name: 'ISA', wrapperType: 'ISA', value: 800000 },
  ],
};
const dynSmallFlat = ihtDynamic(entSmallFlat, { residenceLeftToDirectDescendants: true }, bundle);
test('ihtDynamic: £100k flat → RNRB capped → IHT £190k', dynSmallFlat.amount, 190000);

// Test 8: ihtDynamic with explicit opts.residenceValue override
// Uses ent (house £800k, estate £900k). Override to £50k. RNRB = £50k.
// Bands: £325k + £50k = £375k. Taxable: £525k × 40% = £210k.
const dynExplicitCap = ihtDynamic(ent, { residenceLeftToDirectDescendants: true, residenceValue: 50000 }, bundle);
test('ihtDynamic: explicit residenceValue opt £50k → IHT £210k', dynExplicitCap.amount, 210000);

// taxOnEstate per-asset illustrative
const tone = taxOnEstate({ wrapperType: 'PROPERTY_DIRECT', value: 800000 }, {}, bundle);
test('taxOnEstate £800k naive @ 40% = £320k', tone.amount, 320000);
test('taxOnEstate SIPP pre-Apr-2027 = £0',
  taxOnEstate({ wrapperType: 'SIPP_UNCRYSTALLISED', value: 500000 }, {}, bundle).amount, 0);

// ──── ihtDynamic end-to-end ────
console.log('\nihtDynamic end-to-end:');
// Solo individual, £900k estate, residence to descendants, no spouse/charity/gifts, no BPR
// Bands: £325k NRB + £175k RNRB = £500k → taxable £400k × 40% = £160k
const dyn1 = ihtDynamic(ent, {
  residenceLeftToDirectDescendants: true,
}, bundle);
test('ihtDynamic solo £900k estate → £160k IHT', dyn1.amount, 160000);

// Same estate, override SIPP inclusion (post-Apr-2027 simulated) → estate £1.4m
// Bands £500k → taxable £900k × 40% = £360k
const dyn2 = ihtDynamic(ent, {
  residenceLeftToDirectDescendants: true,
  includeSipp: true,
}, bundle);
test('ihtDynamic with SIPP included → £360k IHT', dyn2.amount, 360000);

// Couple (1m estate, both spouses unused, residence to descendants, no SIPP)
// Use same entity but boost to £1m
const ent3 = { assets: [...ent.assets.slice(0, 2), { name: 'Bonds', wrapperType: 'GIA', value: 100000 }] };
const dyn3 = ihtDynamic(ent3, {
  residenceLeftToDirectDescendants: true,
  deceasedSpouseUnusedNRBPct: 1.0,
  deceasedSpouseUnusedRNRBPct: 1.0,
}, bundle);
// Estate £1m, full bands £1m → £0 IHT
test('ihtDynamic couple £1m → £0', dyn3.amount, 0);

// ──── SUMMARY ────
console.log(`\n=== Result: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) {
  console.log('Failures:');
  for (const f of failures) {
    console.log(`  · ${f.name}: expected ${f.expected}, got ${f.actual}`);
  }
  process.exit(1);
}
process.exit(0);
