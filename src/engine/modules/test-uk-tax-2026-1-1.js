// Smoke test — uk-tax.js × UK-2026.1.1.json
// Validates a handful of canonical scenarios against expected HMRC outputs.

const fs = require('fs');
const code = fs.readFileSync('/home/claude/uk-tax-2026-1-1.js', 'utf8');

// Convert ES modules to CommonJS for Node REPL-style execution
const bundle = JSON.parse(fs.readFileSync('/mnt/user-data/uploads/UK-2026_1_1.json', 'utf8'));

// Replace the import with a direct require equivalent
const transformed = code
  .replace(/^import bundle from '..\/rules\/UK-2026.1.1.json';$/m, `const bundle = ${JSON.stringify(bundle)};`)
  .replace(/^export function/gm, 'function')
  .replace(/^export\s+\{?[^}]*\}?\s*;?$/gm, '');

// Append exports object
const wrapped = transformed + `
module.exports = {
  adjustedNetIncome, personalAllowance, incomeTaxRUK, incomeTaxScottish, incomeTaxWelsh,
  incomeTax, marginalIncomeRate, dividendTax, personalSavingsAllowance, savingsIncomeTax,
  marriageAllowance, hicbc,
  nicClass1Employee, nicClass1Employer, nicClass1EmployerWithEA, nicClass2, nicClass4,
  nicTotalEmployee, salarySacrificeNICSaving,
  cgtAnnualExemptAmount, cgtRate, capitalGainsTax, cgtBADR, cgtInvestorsRelief,
  cgtPrincipalPrivateResidence, cgtSpouseTransfer, cgt30DayRule, cgtBedAndISA,
  sdltMainResidence, sdltFirstTimeBuyer, sdltAdditionalProperty, sdltNonUKResident,
  sdlt, sdrtOnShares, getWrapper, taxOnAsset
};
`;

fs.writeFileSync('/tmp/uk-tax-cjs.js', wrapped);
const T = require('/tmp/uk-tax-cjs.js');

let pass = 0, fail = 0;
function test(name, actual, expected, tolerance = 0.01) {
  const diff = Math.abs(actual - expected);
  const ok = diff <= tolerance;
  if (ok) { pass++; console.log(`✅ ${name}: ${actual} (expected ${expected})`); }
  else    { fail++; console.log(`❌ ${name}: got ${actual}, expected ${expected} (diff ${diff})`); }
}

console.log('\n=== INCOME TAX (rUK) ===');
// Salary £30k, PA £12,570 → taxable £17,430 @ 20% = £3,486
test('rUK £30k income tax', T.incomeTaxRUK(30000 - 12570).amount, 3486);
// Salary £75k → PA £12,570 → taxable £62,430. 37,700@20% + 24,730@40% = 7,540 + 9,892 = £17,432
test('rUK £75k income tax', T.incomeTaxRUK(75000 - 12570).amount, 17432);
// Salary £150k → ANI > £125,140 so PA = £0. Taxable £150k. 37,700@20% + 74,870@40% + 37,430@45%
// = 7,540 + 29,948 + 16,843.50 = £54,331.50
test('rUK £150k income tax (no PA)', T.incomeTaxRUK(150000).amount, 54331.50);

console.log('\n=== ANI + PA TAPER ===');
// ANI £110k → PA reduced by (110k-100k)/2 = £5k → PA = £7,570
test('PA at ANI £110k', T.personalAllowance(110000).amount, 7570);
// ANI £125,140 → PA = 0
test('PA at ANI £125,140', T.personalAllowance(125140).amount, 0);
// ANI £130k → PA = 0
test('PA at ANI £130k', T.personalAllowance(130000).amount, 0);
// ANI £100k → full PA
test('PA at ANI £100k', T.personalAllowance(100000).amount, 12570);

console.log('\n=== ADJUSTED NET INCOME ===');
const ani1 = T.adjustedNetIncome({ employment: 75000, pensionContribNet: 4000 });
// Gross pension = 4000 × 1.25 = 5000. ANI = 75000 - 5000 = 70000
test('ANI: £75k salary, £4k net pension contrib', ani1.amount, 70000);

console.log('\n=== NIC (CLASS 1 EMPLOYEE) ===');
// £30k earnings: (30000 - 12570) × 8% = 17430 × 8% = £1,394.40
test('Class 1 EE £30k', T.nicClass1Employee(30000).amount, 1394.40);
// £75k: (50270 - 12570) × 8% + (75000 - 50270) × 2%
// = 37700 × 8% + 24730 × 2% = 3016 + 494.60 = £3,510.60
test('Class 1 EE £75k', T.nicClass1Employee(75000).amount, 3510.60);

console.log('\n=== NIC (CLASS 1 EMPLOYER) ===');
// £75k: (75000 - 5000) × 15% = 70000 × 15% = £10,500
test('Class 1 ER £75k', T.nicClass1Employer(75000).amount, 10500);

console.log('\n=== NIC (CLASS 4) ===');
// £40k SE: (40000 - 12570) × 6% = 27430 × 6% = £1,645.80
test('Class 4 £40k', T.nicClass4(40000).amount, 1645.80);
// £75k: (50270 - 12570) × 6% + (75000 - 50270) × 2% = 37700 × 6% + 24730 × 2%
// = 2262 + 494.60 = £2,756.60
test('Class 4 £75k', T.nicClass4(75000).amount, 2756.60);

console.log('\n=== CGT ===');
// £10k gain, basic-rate taxpayer (taxable income £10k post-PA, plenty of basic-rate room)
// Taxable gain £10k - £3k AEA = £7k. £7k @ 18% = £1,260
test('CGT £10k gain, basic rate', T.capitalGainsTax(10000, 10000).amount, 1260);
// £50k gain, higher-rate taxpayer (taxable income £60k, no basic-rate room)
// Taxable gain £47k @ 24% = £11,280
test('CGT £50k gain, higher rate', T.capitalGainsTax(50000, 60000).amount, 11280);

console.log('\n=== CGT BADR ===');
// £500k qualifying gain, no lifetime used: £500k × 18% = £90,000
test('BADR £500k, no lifetime used', T.cgtBADR(500000, 0).amount, 90000);
// £500k qualifying gain, £700k lifetime used: only £300k eligible × 18% = £54,000
test('BADR £500k, £700k used', T.cgtBADR(500000, 700000).amount, 54000);

console.log('\n=== SDLT ===');
// £400k main residence: 0% on £125k + 2% on £125k + 5% on £150k = 0 + 2500 + 7500 = £10,000
test('SDLT £400k main residence', T.sdltMainResidence(400000).amount, 10000);
// FTB £400k: 0% on £300k + 5% on £100k = £5,000
test('SDLT FTB £400k', T.sdltFirstTimeBuyer(400000).amount, 5000);
// FTB £600k (> £500k threshold) → standard SDLT
// = 0% on £125k + 2% on £125k + 5% on £350k = 0 + 2500 + 17500 = £20,000
test('SDLT FTB £600k (no relief)', T.sdltFirstTimeBuyer(600000).amount, 20000);
// Additional property £400k: standard £10k + 5% × £400k = £10k + £20k = £30k
test('SDLT additional £400k', T.sdltAdditionalProperty(400000).amount, 30000);

console.log('\n=== HICBC ===');
// ANI £70k, child benefit £1,331 (1 child rate ~£25.60/wk × 52)
// 50% taper between £60k–£80k. (£70k - £60k) / £20k = 50%
// Charge = £1,331 × 50% = £665.50
test('HICBC at ANI £70k, CB £1,331', T.hicbc(70000, 1331).amount, 665.50);
// ANI £80k+ → 100% claw-back
test('HICBC at ANI £85k, CB £1,331', T.hicbc(85000, 1331).amount, 1331);
// ANI £55k → no charge
test('HICBC at ANI £55k', T.hicbc(55000, 1331).amount, 0);

console.log('\n=== DIVIDEND TAX ===');
// £10k dividends on top of £20k income (basic rate). Allowance £500 → taxable £9,500.
// All in basic-rate band → £9,500 × 10.75% = £1,021.25
test('Dividend £10k, £20k other (basic)', T.dividendTax(10000, 20000).amount, 1021.25);

console.log('\n=== SDRT ===');
// £10k purchase, non-AIM: 0.5% = £50
test('SDRT £10k non-AIM', T.sdrtOnShares(10000, false).amount, 50);
test('SDRT £10k AIM (exempt)', T.sdrtOnShares(10000, true).amount, 0);

console.log('\n=== SCOTTISH IT ===');
// Scottish taxpayer, taxable income £30k (post-PA, so gross £42,570)
// Bands (gross): starter 12,571–16,537 (4k @ 19%) → 760 (oops, wait — taxable terms)
// In post-PA terms with PA £12,570:
//   starter: from = 12571-12570-1 = 0, to = 16537-12570 = 3967 → 0–3967 @ 19%
//   basic:   from = 16538-12570-1 = 3967, to = 29527-12570 = 16957 → 3968–16957 @ 20%
//   intermediate: from = 29528-12570-1 = 16957, to = 43662-12570 = 31092 → 16958–31092 @ 21%
//   ...
// Taxable £30k:
//   3967 × 19% = 753.73
//   (16957-3967) = 12990 × 20% = 2598
//   (30000-16957) = 13043 × 21% = 2739.03
// Total ≈ £6,090.76
test('Scottish IT on £30k taxable', T.incomeTaxScottish(30000).amount, 6090.76, 1);

console.log('\n=== WRAPPER DISPATCH ===');
const isaResult = T.taxOnAsset({ wrapper: 'ISA' }, { income: 5000, gain: 10000 });
test('ISA wrapper: zero tax', isaResult.amount, 0);
const giaResult = T.taxOnAsset({ assetClass: 'gia' }, { income: 0, gain: 20000, taxableIncomeNonGain: 30000 });
// £20k gain, basic-rate room: 37700-30000 = 7700 @ 18% = 1386, then (20000-3000-7700) = 9300 @ 24% = 2232
// Wait — capitalGainsTax applies AEA first: gross 20000 - AEA 3000 = 17000 taxable
// 7700 in basic-rate room @ 18% = 1386
// 9300 in higher-rate @ 24% = 2232
// Total = 3618
test('GIA gain £20k @ £30k other income', giaResult.amount, 3618);

console.log(`\n=== RESULTS ===\n${pass} passed, ${fail} failed.`);
process.exit(fail > 0 ? 1 : 0);
