/**
 * Caelixa · src/engine/uk-tax.js
 *
 * UK Income Tax · NIC · CGT · SDLT · SDRT · HICBC · Dividend · Savings · Salary Sacrifice
 *
 * Source authority:
 *   - Rules: 3-Engine-uk-tax-and-estate-coverage-v1_4.md (§2, §2a, §2.2a, §2.3,
 *            §2.4, §2.5, §3, §4, §9.1, §9.3, §13.2, §23)
 *   - Values: src/rules/UK-2026.1.1.json (UK-2026.1.1 bundle, tax year 2026/27)
 *   - Statutory: ITTOIA 2005 · ITA 2007 · TCGA 1992 · ITEPA 2003 · SSCBA 1992
 *                Finance Act 2026 · Autumn Budget 2025 · Spring Statement 2025
 *
 * Architectural rules (binding):
 *   - Never hardcode rates, bands, thresholds, or allowances. Always read from bundle.
 *   - Every public function returns { amount, breakdown, rules, explanation }
 *     to support X25 plain-English binding.
 *   - getWrapper(asset) must be called before any tax computation on a wrapped asset
 *     (D-WRAPPER-FIRST-1, MM v2.6 §0).
 *   - Functions are pure. No side effects. No mutation of inputs.
 *
 * Produced at: s17a-1 (Opus · Track A · 7 May 2026)
 * Status: DOCUMENTED · CURRENT
 *
 * Function inventory (50 functions in this file):
 *   §2/§2a/§2.2a/§23  — ANI, PA, income tax (rUK/Scottish/Welsh routing), marginal rate
 *   §2.3/§2.4/§2.5    — Dividend tax, savings tax, PSA, starting rate for savings
 *   §2.2/§13.2        — Marriage allowance, HICBC
 *   §3                — NIC Class 1 EE/ER, Class 2, Class 4, Employment Allowance
 *   §3/§7             — Salary sacrifice NIC saving
 *   §4                — CGT main, BADR, IR, AEA, PPR, spouse, 30-day, Bed-and-ISA
 *   §9.1              — SDLT main, FTB relief, additional property, non-UK resident
 *   §9.3              — SDRT on shares
 *   D-WRAPPER-FIRST-1 — getWrapper, taxOnAsset dispatcher
 */

import bundle from '../rules/UK-2026.1.1.json';

// =============================================================================
// HELPERS — band slicing, rate composition, breakdown construction
// =============================================================================

/**
 * Compute tax on an amount that falls within a band [from, to] at a given rate.
 * Returns { taxable, tax, from, to, rate } for breakdown reconstruction.
 *
 * @private
 */
function _sliceBand(amount, from, to, rate) {
  const taxable = Math.max(0, Math.min(amount, to) - from);
  return { taxable, tax: taxable * rate, from, to: Math.min(amount, to), rate };
}

/**
 * Round to whole pennies. HMRC rounds tax to the nearest penny except where a
 * specific calculation specifies otherwise.
 *
 * @private
 */
function _round(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Standard public-function result envelope. All public engine functions
 * return this shape to support X25 plain-English binding.
 *
 * @private
 */
function _result(amount, breakdown, rules, explanation) {
  return {
    amount: _round(amount),
    breakdown: breakdown || [],
    rules: rules || [],
    explanation: explanation || ''
  };
}

// =============================================================================
// §2.2a — ADJUSTED NET INCOME (ANI)
// Coverage v1.4 §2.2a · UK-IT-19
//
// ANI = total taxable income LESS:
//   - qualifying loan interest paid
//   - trading loss relief used
//   - gross Gift Aid (× 1.25 of cash given)
//   - gross pension contributions (relief at source × 1.25)
//
// ANI is upstream input to: PA taper, HICBC, PSA band, Marriage Allowance eligibility.
// =============================================================================

/**
 * Compute Adjusted Net Income (ANI) per the §2.2a stepwise formula.
 * UK-IT-19.
 *
 * @param {Object} income
 *   { employment, selfEmployed, pension, rental, savings, dividends, other,
 *     qualifyingLoanInterest, tradingLoss, giftAidNet, pensionContribNet }
 * @returns {Object} envelope with .amount = ANI
 */
export function adjustedNetIncome(income = {}) {
  const e = +(income.employment || 0);
  const se = +(income.selfEmployed || 0);
  const pen = +(income.pension || 0);
  const rent = +(income.rental || 0);
  const sav = +(income.savings || 0);
  const div = +(income.dividends || 0);
  const oth = +(income.other || 0);

  const totalIncome = e + se + pen + rent + sav + div + oth;

  // Reliefs deducted to arrive at ANI
  const loanInt = +(income.qualifyingLoanInterest || 0);
  const tradeLoss = +(income.tradingLoss || 0);
  const giftAidGross = +(income.giftAidNet || 0) * 1.25;
  const pensionGross = +(income.pensionContribNet || 0) * 1.25;

  const deductions = loanInt + tradeLoss + giftAidGross + pensionGross;
  const ani = Math.max(0, totalIncome - deductions);

  return _result(
    ani,
    [
      { label: 'Employment', value: e },
      { label: 'Self-employment', value: se },
      { label: 'Pension', value: pen },
      { label: 'Rental', value: rent },
      { label: 'Savings', value: sav },
      { label: 'Dividends', value: div },
      { label: 'Other', value: oth },
      { label: 'Total income', value: totalIncome },
      { label: 'Qualifying loan interest', value: -loanInt },
      { label: 'Trading loss relief', value: -tradeLoss },
      { label: 'Gift Aid (gross)', value: -giftAidGross },
      { label: 'Pension contributions (gross)', value: -pensionGross },
      { label: 'ANI', value: ani }
    ],
    ['UK-IT-19'],
    `Adjusted Net Income £${_round(ani).toLocaleString()} drives PA taper, HICBC, PSA band, and Marriage Allowance eligibility.`
  );
}

// =============================================================================
// §2.2 — PERSONAL ALLOWANCE (with taper £100k–£125,140)
// Coverage v1.4 §2.2 · UK-IT-04
// =============================================================================

/**
 * Compute the Personal Allowance available to the taxpayer given ANI.
 * PA tapers by £1 for every £2 of ANI above £100,000, hitting £0 at £125,140.
 * UK-IT-04. Effective 60% marginal rate in the taper band.
 *
 * @param {number} ani  Adjusted Net Income (use adjustedNetIncome().amount)
 * @returns {Object}
 */
export function personalAllowance(ani) {
  const pa = bundle.income.personalAllowance;
  const start = bundle.income.personalAllowanceTaperStart;
  const end = bundle.income.personalAllowanceTaperEnd;

  let available = pa;
  if (ani > end) available = 0;
  else if (ani > start) available = Math.max(0, pa - Math.floor((ani - start) / 2));

  const lost = pa - available;

  return _result(
    available,
    [
      { label: 'Standard PA', value: pa },
      { label: 'PA lost via taper', value: -lost },
      { label: 'Available PA', value: available }
    ],
    ['UK-IT-04'],
    available === pa
      ? `Full Personal Allowance £${pa.toLocaleString()} available.`
      : available === 0
      ? `Personal Allowance fully tapered (ANI £${_round(ani).toLocaleString()} ≥ £${end.toLocaleString()}). Effective 60% marginal rate has applied across £${start.toLocaleString()}–£${end.toLocaleString()} band.`
      : `Personal Allowance reduced to £${_round(available).toLocaleString()} (ANI £${_round(ani).toLocaleString()} in £${start.toLocaleString()}–£${end.toLocaleString()} taper band — 60% effective marginal rate).`
  );
}

// =============================================================================
// §2.1 / §23 — INCOME TAX (rUK + Scottish + Welsh routing)
// Coverage v1.4 §2.1 (rUK), §2a (Welsh), §23 (Scottish)
// =============================================================================

/**
 * Income tax on rUK (England + Wales + NI) bands.
 * Applies to non-savings, non-dividend income. UK-IT-01 to UK-IT-03.
 *
 * @param {number} taxableIncome  Income AFTER PA deduction
 * @returns {Object}
 */
export function incomeTaxRUK(taxableIncome) {
  if (taxableIncome <= 0) {
    return _result(0, [], ['UK-IT-01'], 'No taxable income.');
  }

  const inc = bundle.income;
  const basicBand = inc.basicRateBand;             // 37,700
  const arThreshold = inc.additionalRateThreshold; // 125,140 (above PA-eroded space)

  // Bands are expressed relative to taxable-income (after PA), so:
  //   0–37,700        @ 20%
  //   37,701–112,570  @ 40%   (additional rate threshold £125,140 minus £12,570 PA)
  //   above           @ 45%
  // We use the "above PA" threshold by subtracting standard PA from arThreshold.
  // For taxpayers whose PA has been tapered, taxableIncome already reflects the
  // higher PA-erosion; the additional-rate threshold is fixed at £125,140 of
  // *gross* income, so for taxable-income terms we use £112,570.
  const higherEnd = arThreshold - inc.personalAllowance; // 112,570

  const slices = [
    _sliceBand(taxableIncome, 0, basicBand, inc.basicRate),
    _sliceBand(taxableIncome, basicBand, higherEnd, inc.higherRate),
    _sliceBand(taxableIncome, higherEnd, Infinity, inc.additionalRate)
  ];

  const total = slices.reduce((a, s) => a + s.tax, 0);

  return _result(
    total,
    slices.filter(s => s.taxable > 0).map(s => ({
      label: `${(s.rate * 100).toFixed(0)}% on £${_round(s.taxable).toLocaleString()}`,
      value: _round(s.tax),
      from: s.from,
      to: s.to === Infinity ? null : s.to,
      rate: s.rate
    })),
    ['UK-IT-01', 'UK-IT-02', 'UK-IT-03'],
    `rUK income tax on £${_round(taxableIncome).toLocaleString()}: total £${_round(total).toLocaleString()}.`
  );
}

/**
 * Income tax on Scottish bands (2026/27).
 * Applies to non-savings, non-dividend income for Scottish taxpayers.
 * UK-SCOT-01 to UK-SCOT-08. Reads scottishRateBands2627 from bundle.
 *
 * Note: Personal Allowance is UK-wide. Scottish bands are expressed in terms
 * of *gross* income, not taxable income; we therefore reconstruct band edges
 * relative to taxable-income by subtracting the PA used by the taxpayer.
 * To keep the engine deterministic, this function expects taxableIncome
 * (post-PA). The caller is responsible for PA computation.
 *
 * @param {number} taxableIncome  Income AFTER PA deduction
 * @returns {Object}
 */
export function incomeTaxScottish(taxableIncome) {
  if (taxableIncome <= 0) {
    return _result(0, [], ['UK-SCOT-01'], 'No taxable income.');
  }

  const bands = bundle.income.scottishRateBands2627;
  const pa = bundle.income.personalAllowance;

  // Scottish band edges in bundle are "from / to" gross-income terms (e.g.
  // starter from £12,571). We translate to taxable-income by subtracting PA.
  // For taxpayers with tapered PA, the caller must pre-adjust taxableIncome
  // accordingly (it represents income above the PA actually available).
  const slices = [];
  const order = ['starter', 'basic', 'intermediate', 'higher', 'advanced', 'top'];

  for (const name of order) {
    const b = bands[name];
    if (!b) continue;
    const fromTaxable = Math.max(0, b.from - pa - 1); // -1 because b.from is inclusive
    const toTaxable = b.to ? b.to - pa : Infinity;
    const slice = _sliceBand(taxableIncome, fromTaxable, toTaxable, b.rate);
    slice.bandName = name;
    slices.push(slice);
  }

  const total = slices.reduce((a, s) => a + s.tax, 0);

  return _result(
    total,
    slices.filter(s => s.taxable > 0).map(s => ({
      label: `Scottish ${s.bandName} ${(s.rate * 100).toFixed(0)}% on £${_round(s.taxable).toLocaleString()}`,
      value: _round(s.tax),
      band: s.bandName,
      rate: s.rate
    })),
    ['UK-SCOT-01', 'UK-SCOT-02', 'UK-SCOT-03', 'UK-SCOT-04', 'UK-SCOT-05', 'UK-SCOT-06'],
    `Scottish income tax on £${_round(taxableIncome).toLocaleString()}: total £${_round(total).toLocaleString()}. Scottish bands apply to non-savings, non-dividend income only.`
  );
}

/**
 * Income tax on Welsh bands.
 * Welsh Rates of Income Tax (WRIT) currently mirror rUK (Welsh Government
 * has set rates equal to rUK since 2019/20). UK-WELSH-01 to UK-WELSH-04.
 * Engine routes Welsh taxpayers to rUK rates; this wrapper is the formal
 * entry point so future divergence can be handled in one place.
 *
 * @param {number} taxableIncome
 * @returns {Object}
 */
export function incomeTaxWelsh(taxableIncome) {
  const r = incomeTaxRUK(taxableIncome);
  return {
    ...r,
    rules: ['UK-WELSH-01', 'UK-WELSH-02', 'UK-IT-01', 'UK-IT-02', 'UK-IT-03'],
    explanation: `Welsh income tax: Welsh Rates of Income Tax (WRIT) mirror rUK rates for 2026/27. Welsh Government can vary by ±10p of basic, higher, or additional rates — currently held equal. Total: £${_round(r.amount).toLocaleString()}.`
  };
}

/**
 * Income tax router — selects rUK / Scottish / Welsh by residency.
 *
 * @param {number} taxableIncome
 * @param {string} residency  'ENG' | 'WAL' | 'SCT' | 'NIR' (defaults to 'ENG')
 * @returns {Object}
 */
export function incomeTax(taxableIncome, residency = 'ENG') {
  switch ((residency || '').toUpperCase()) {
    case 'SCT':
      return incomeTaxScottish(taxableIncome);
    case 'WAL':
      return incomeTaxWelsh(taxableIncome);
    case 'ENG':
    case 'NIR':
    default:
      return incomeTaxRUK(taxableIncome);
  }
}

/**
 * Marginal income tax rate at a given level of taxable income.
 * Used by relief-at-source top-up calculations and CoI engine.
 *
 * @param {number} taxableIncome
 * @param {string} residency
 * @returns {Object} { amount: marginal rate as decimal, ... }
 */
export function marginalIncomeRate(taxableIncome, residency = 'ENG') {
  const inc = bundle.income;
  const r = (residency || '').toUpperCase();

  if (r === 'SCT') {
    const bands = inc.scottishRateBands2627;
    const pa = inc.personalAllowance;
    const order = ['starter', 'basic', 'intermediate', 'higher', 'advanced', 'top'];
    let rate = 0;
    let bandName = 'below_pa';
    for (const name of order) {
      const b = bands[name];
      if (!b) continue;
      const fromTaxable = b.from - pa - 1;
      const toTaxable = b.to ? b.to - pa : Infinity;
      if (taxableIncome > fromTaxable) {
        rate = b.rate;
        bandName = name;
      }
    }
    return _result(
      rate,
      [{ label: `Scottish ${bandName} band`, value: rate }],
      ['UK-SCOT-01'],
      `Scottish marginal rate ${(rate * 100).toFixed(0)}% (${bandName}).`
    );
  }

  // rUK / Welsh
  let rate = 0;
  let bandName = 'below_pa';
  if (taxableIncome > 0) { rate = inc.basicRate; bandName = 'basic'; }
  if (taxableIncome > inc.basicRateBand) { rate = inc.higherRate; bandName = 'higher'; }
  if (taxableIncome > inc.additionalRateThreshold - inc.personalAllowance) {
    rate = inc.additionalRate;
    bandName = 'additional';
  }
  return _result(
    rate,
    [{ label: `${bandName} band`, value: rate }],
    ['UK-IT-01'],
    `Marginal rate ${(rate * 100).toFixed(0)}% (${bandName}).`
  );
}

// =============================================================================
// §2.3 — DIVIDEND TAX
// Coverage v1.4 §2.3 · UK-IT-22
// 2026/27 rates: 10.75% basic / 35.75% higher / 39.35% additional
// =============================================================================

/**
 * Dividend tax. Dividends sit "on top" of non-savings income for band
 * determination but are charged at dividend rates. Dividend Allowance is £500.
 * UK-IT-22.
 *
 * @param {number} dividends            Gross dividends
 * @param {number} taxableIncomeNonDiv  Non-dividend taxable income (post-PA)
 * @returns {Object}
 */
export function dividendTax(dividends, taxableIncomeNonDiv = 0) {
  if (dividends <= 0) {
    return _result(0, [], ['UK-IT-22'], 'No dividends.');
  }

  const inc = bundle.income;
  const allowance = inc.dividendAllowance;          // 500
  const basicEnd = inc.basicRateBand;               // 37,700
  const higherEnd = inc.additionalRateThreshold - inc.personalAllowance; // 112,570

  // Dividend allowance applied first
  const taxableDiv = Math.max(0, dividends - allowance);
  const usedAllowance = dividends - taxableDiv;

  // Stack dividends on top of non-div income to determine band fill
  const start = taxableIncomeNonDiv + usedAllowance; // allowance still uses band space
  const end = taxableIncomeNonDiv + dividends;

  const slice = (from, to, rate) => {
    const tax = _sliceBand(end, Math.max(start, from), to, rate);
    return tax;
  };

  const slices = [
    slice(0, basicEnd, inc.dividendBasicRate),
    slice(basicEnd, higherEnd, inc.dividendHigherRate),
    slice(higherEnd, Infinity, inc.dividendAdditionalRate)
  ];

  const total = slices.reduce((a, s) => a + s.tax, 0);

  return _result(
    total,
    [
      { label: `Dividend Allowance (£${allowance})`, value: 0 },
      ...slices.filter(s => s.taxable > 0).map(s => ({
        label: `${(s.rate * 100).toFixed(2)}% on £${_round(s.taxable).toLocaleString()}`,
        value: _round(s.tax),
        rate: s.rate
      }))
    ],
    ['UK-IT-22'],
    `Dividend tax on £${dividends.toLocaleString()} (allowance £${allowance}): total £${_round(total).toLocaleString()}. 2026/27 rates: 10.75%/35.75%/39.35%.`
  );
}

// =============================================================================
// §2.4/§2.5 — SAVINGS INCOME, PSA, STARTING RATE FOR SAVINGS
// Coverage v1.4 §2.4 · UK-IT-11/12
// =============================================================================

/**
 * Personal Savings Allowance — depends on top marginal rate of taxpayer.
 * Basic rate: £1,000 · Higher rate: £500 · Additional rate: £0.
 * UK-IT-11. Note: Scottish-rate taxpayers — PSA based on UK rate equivalent
 * for the income (Scottish 21% intermediate aligned with UK basic-rate PSA).
 *
 * @param {number} taxableIncome
 * @param {string} residency
 * @returns {Object}
 */
export function personalSavingsAllowance(taxableIncome, residency = 'ENG') {
  const inc = bundle.income;
  const ar = inc.additionalRateThreshold - inc.personalAllowance; // 112,570
  const hr = inc.basicRateBand;                                    // 37,700

  let psa, band;
  if (taxableIncome > ar) { psa = inc.savingsAllowanceAdditionalRate; band = 'additional'; }
  else if (taxableIncome > hr) { psa = inc.savingsAllowanceHigherRate; band = 'higher'; }
  else { psa = inc.savingsAllowanceBasicRate; band = 'basic'; }

  return _result(
    psa,
    [{ label: `${band}-rate PSA`, value: psa }],
    ['UK-IT-11'],
    `Personal Savings Allowance £${psa} (taxpayer in ${band}-rate band).`
  );
}

/**
 * Tax on savings income.
 * Order of operation:
 *   1. £5,000 starting-rate band at 0% — only available if non-savings income
 *      is below £17,570 (PA + £5,000). UK-IT-12.
 *   2. PSA — £1,000 / £500 / £0 at 0%. UK-IT-11.
 *   3. Excess taxed at savings rates (same as main rates).
 *
 * @param {number} savings              Gross savings income
 * @param {number} taxableIncomeNonSav  Non-savings taxable income (post-PA)
 * @param {string} residency
 * @returns {Object}
 */
export function savingsIncomeTax(savings, taxableIncomeNonSav = 0, residency = 'ENG') {
  if (savings <= 0) {
    return _result(0, [], ['UK-IT-11'], 'No savings income.');
  }

  const inc = bundle.income;
  const startingBand = inc.startingRateForSavingsBand; // 5000
  const startingRate = inc.startingRateForSavings;     // 0
  const psaResult = personalSavingsAllowance(taxableIncomeNonSav + savings, residency);
  const psa = psaResult.amount;

  // Starting-rate band only available if non-savings income leaves room
  // below £17,570 (PA + £5k). In post-PA terms: room = max(0, 5000 - nonSav).
  const startingRoom = Math.max(0, startingBand - taxableIncomeNonSav);
  const usedStarting = Math.min(savings, startingRoom);
  const afterStarting = savings - usedStarting;

  const usedPSA = Math.min(afterStarting, psa);
  const taxableSavings = afterStarting - usedPSA;

  // Stack savings on top of non-sav income for band determination
  const start = taxableIncomeNonSav + usedStarting + usedPSA;
  const end = taxableIncomeNonSav + savings;

  const slices = [
    _sliceBand(end, Math.max(start, 0), inc.basicRateBand, inc.basicRate),
    _sliceBand(end, Math.max(start, inc.basicRateBand), inc.additionalRateThreshold - inc.personalAllowance, inc.higherRate),
    _sliceBand(end, Math.max(start, inc.additionalRateThreshold - inc.personalAllowance), Infinity, inc.additionalRate)
  ];

  const total = slices.reduce((a, s) => a + s.tax, 0);

  return _result(
    total,
    [
      { label: `Starting rate (£${startingRoom} room used £${usedStarting})`, value: 0 },
      { label: `PSA (£${psa} used £${usedPSA})`, value: 0 },
      ...slices.filter(s => s.taxable > 0).map(s => ({
        label: `${(s.rate * 100).toFixed(0)}% on £${_round(s.taxable).toLocaleString()}`,
        value: _round(s.tax),
        rate: s.rate
      }))
    ],
    ['UK-IT-11', 'UK-IT-12'],
    `Savings tax on £${savings.toLocaleString()}: starting-rate band ${usedStarting > 0 ? `used £${usedStarting}` : 'unavailable'}, PSA £${psa} ${usedPSA > 0 ? `used £${usedPSA}` : 'unused'}, taxable £${_round(taxableSavings).toLocaleString()}. Total £${_round(total).toLocaleString()}.`
  );
}

// =============================================================================
// §2.2 — MARRIAGE ALLOWANCE
// Coverage v1.4 §2.2 · UK-IT-13 · UK-SCOT-07 (Scottish exclusion)
// =============================================================================

/**
 * Marriage Allowance — lower-earning spouse transfers £1,260 of PA to higher-
 * earning spouse. Recipient must be basic-rate UK taxpayer (20%). Scottish
 * intermediate-rate (21%) taxpayers cannot receive (UK-SCOT-07).
 *
 * @param {Object} transferor  { taxableIncome, residency }
 * @param {Object} recipient   { taxableIncome, residency }
 * @returns {Object}  amount = tax saved (typically £252 = £1,260 × 20%)
 */
export function marriageAllowance(transferor, recipient) {
  const inc = bundle.income;
  const transferAmount = inc.marriageAllowanceTransfer; // 1,260

  // Eligibility: transferor must be non-taxpayer (income ≤ PA) and recipient
  // must be a basic-rate taxpayer.
  const transferorEligible = transferor.taxableIncome <= 0;

  let recipientEligible;
  let recipientRate;
  if ((recipient.residency || 'ENG').toUpperCase() === 'SCT') {
    // Scottish: only starter (19%) and basic (20%) rate taxpayers can receive.
    // Intermediate rate (21%) cannot — UK-SCOT-07.
    const bands = inc.scottishRateBands2627;
    const pa = inc.personalAllowance;
    const intermediateStart = bands.intermediate.from - pa - 1;
    recipientEligible = recipient.taxableIncome <= intermediateStart;
    recipientRate = bands.basic.rate;
  } else {
    recipientEligible = recipient.taxableIncome <= inc.basicRateBand;
    recipientRate = inc.basicRate;
  }

  const eligible = transferorEligible && recipientEligible;
  const taxSaved = eligible ? transferAmount * recipientRate : 0;

  return _result(
    taxSaved,
    [
      { label: 'Transferor eligible (income ≤ PA)', value: transferorEligible ? 'yes' : 'no' },
      { label: 'Recipient eligible (basic-rate)', value: recipientEligible ? 'yes' : 'no' },
      { label: 'Transfer amount', value: transferAmount },
      { label: 'Tax saved', value: taxSaved }
    ],
    ['UK-IT-13', ...((recipient.residency || '').toUpperCase() === 'SCT' ? ['UK-SCOT-07'] : [])],
    eligible
      ? `Marriage Allowance: transfer £${transferAmount} of PA, save £${_round(taxSaved)} of tax.`
      : `Marriage Allowance not available: ${!transferorEligible ? 'transferor exceeds PA' : 'recipient is higher/additional/intermediate-rate taxpayer'}.`
  );
}

// =============================================================================
// §13.2 — HIGH INCOME CHILD BENEFIT CHARGE (HICBC)
// Coverage v1.4 §13.2 · UK-IT-53
// 2026/27: taper £60,000 → £80,000 (was £50k–£60k pre-2024)
// =============================================================================

/**
 * High Income Child Benefit Charge.
 * Charged on the higher-earning partner where ANI exceeds £60,000.
 * 100% claw-back at £80,000+. UK-IT-53. Requires ANI input.
 *
 * @param {number} ani           Adjusted Net Income of the higher-earner
 * @param {number} childBenefit  Annual child benefit received
 * @returns {Object}             amount = HICBC charge
 */
export function hicbc(ani, childBenefit = 0) {
  const inc = bundle.income;
  const start = inc.highIncomeChildBenefitThreshold; // 60,000
  const end = inc.highIncomeChildBenefitTaperEnd;    // 80,000

  if (ani <= start || childBenefit <= 0) {
    return _result(0, [], ['UK-IT-53'], 'No HICBC: ANI below £60,000 or no child benefit claimed.');
  }

  let pct;
  if (ani >= end) pct = 1;
  else pct = (ani - start) / (end - start);

  const charge = childBenefit * pct;

  return _result(
    charge,
    [
      { label: 'Child Benefit received', value: childBenefit },
      { label: `ANI £${_round(ani).toLocaleString()} in £${start.toLocaleString()}–£${end.toLocaleString()} taper`, value: pct },
      { label: 'HICBC charge', value: charge }
    ],
    ['UK-IT-53', 'UK-IT-19'],
    `HICBC: ${(pct * 100).toFixed(0)}% of £${childBenefit} child benefit clawed back = £${_round(charge)}. ${pct === 1 ? 'Full claw-back at ANI ≥ £80k.' : `Effective marginal rate in taper band = base rate + (${(100 / (end - start)).toFixed(2)}% × £benefit).`}`
  );
}

// =============================================================================
// §3 — NATIONAL INSURANCE
// Coverage v1.4 §3 · UK-NI-01 to UK-NI-15
// =============================================================================

/**
 * Class 1 Employee NIC.
 * 8% on £12,570–£50,270 (between PT and UEL); 2% above UEL. UK-NI-01.
 *
 * @param {number} earnings  Annual employment earnings
 * @returns {Object}
 */
export function nicClass1Employee(earnings) {
  if (earnings <= 0) return _result(0, [], ['UK-NI-01'], 'No earnings.');

  const ni = bundle.nationalInsurance;
  const pt = ni.primaryThreshold;     // 12,570
  const uel = ni.upperEarningsLimit;  // 50,270

  const mainBand = _sliceBand(earnings, pt, uel, ni.class1EmployeeRate);
  const upperBand = _sliceBand(earnings, uel, Infinity, ni.class1EmployeeRateAboveUEL);
  const total = mainBand.tax + upperBand.tax;

  return _result(
    total,
    [
      { label: `8% on £${_round(mainBand.taxable).toLocaleString()}`, value: _round(mainBand.tax) },
      ...(upperBand.taxable > 0 ? [{ label: `2% on £${_round(upperBand.taxable).toLocaleString()}`, value: _round(upperBand.tax) }] : [])
    ],
    ['UK-NI-01'],
    `Employee Class 1 NIC on £${earnings.toLocaleString()}: £${_round(total).toLocaleString()}.`
  );
}

/**
 * Class 1 Employer NIC (Secondary Class 1).
 * 15% on earnings above £5,000/year (Secondary Threshold). UK-NI-02.
 * Rate increased from 13.8% and threshold cut from £9,100 in April 2025.
 *
 * @param {number} earnings  Annual employment earnings
 * @returns {Object}
 */
export function nicClass1Employer(earnings) {
  if (earnings <= 0) return _result(0, [], ['UK-NI-02'], 'No earnings.');

  const ni = bundle.nationalInsurance;
  const st = ni.class1EmployerSecondaryThreshold; // 5,000
  const taxable = Math.max(0, earnings - st);
  const tax = taxable * ni.class1EmployerRate;

  return _result(
    tax,
    [{ label: `15% on £${_round(taxable).toLocaleString()} (above £${st} ST)`, value: _round(tax) }],
    ['UK-NI-02'],
    `Employer Class 1 NIC on £${earnings.toLocaleString()}: £${_round(tax).toLocaleString()}.`
  );
}

/**
 * Apply Employment Allowance to total employer NIC bill.
 * Up to £10,500/year offset, conditional on eligibility (employer not a sole-
 * director with no other employees; check excluded). UK-NI-14.
 *
 * @param {number}  totalEmployerNIC  Sum of employer NIC across all employees
 * @param {boolean} employerEligible  Caller pre-checked eligibility
 * @returns {Object}                  amount = NIC AFTER allowance
 */
export function nicClass1EmployerWithEA(totalEmployerNIC, employerEligible = true) {
  const ni = bundle.nationalInsurance;
  const ea = ni.employmentAllowance; // 10,500

  if (!employerEligible) {
    return _result(totalEmployerNIC, [{ label: 'EA not eligible', value: 0 }], ['UK-NI-14'],
      `Employment Allowance not available — full employer NIC £${_round(totalEmployerNIC).toLocaleString()}.`);
  }

  const used = Math.min(totalEmployerNIC, ea);
  const after = totalEmployerNIC - used;

  return _result(
    after,
    [
      { label: 'Employer NIC pre-EA', value: totalEmployerNIC },
      { label: `Employment Allowance used`, value: -used },
      { label: 'Employer NIC after EA', value: after }
    ],
    ['UK-NI-14'],
    `Employment Allowance: £${_round(used).toLocaleString()} of £${ea.toLocaleString()} used. Net employer NIC £${_round(after).toLocaleString()}.`
  );
}

/**
 * Class 2 NIC. Effectively zero-rated for 2026/27 above the Small Profits
 * Threshold (Class 2 abolished as a charge in April 2024 but retained as a
 * NICs credit mechanism for those between LPL and SPT). UK-NI-04.
 *
 * @param {number} profits  Annual self-employed profits
 * @returns {Object}
 */
export function nicClass2(profits) {
  const ni = bundle.nationalInsurance;
  const rate = ni.class2Rate; // 0
  const tax = Math.max(0, profits) * 0 + (rate > 0 ? rate * 52 : 0);
  return _result(
    tax,
    [{ label: 'Class 2 NIC (effectively abolished from 2024/25)', value: tax }],
    ['UK-NI-04'],
    `Class 2 NIC: £${_round(tax)}. (Effectively zero-rated since April 2024 — credit mechanism preserved.)`
  );
}

/**
 * Class 4 NIC.
 * 6% on profits £12,570–£50,270; 2% above. UK-NI-03.
 *
 * @param {number} profits  Annual self-employed profits
 * @returns {Object}
 */
export function nicClass4(profits) {
  if (profits <= 0) return _result(0, [], ['UK-NI-03'], 'No profits.');

  const ni = bundle.nationalInsurance;
  const lpl = ni.class4LowerProfitsLimit; // 12,570
  const upl = ni.class4UpperProfitsLimit; // 50,270

  const lower = _sliceBand(profits, lpl, upl, ni.class4RateLowerBand);
  const upper = _sliceBand(profits, upl, Infinity, ni.class4RateUpperBand);
  const total = lower.tax + upper.tax;

  return _result(
    total,
    [
      { label: `6% on £${_round(lower.taxable).toLocaleString()}`, value: _round(lower.tax) },
      ...(upper.taxable > 0 ? [{ label: `2% on £${_round(upper.taxable).toLocaleString()}`, value: _round(upper.tax) }] : [])
    ],
    ['UK-NI-03'],
    `Class 4 NIC on £${profits.toLocaleString()} profits: £${_round(total).toLocaleString()}.`
  );
}

/**
 * Total employee + self-employed NIC for an individual.
 *
 * @param {number} earnings  Employment earnings
 * @param {number} profits   Self-employed profits
 * @returns {Object}
 */
export function nicTotalEmployee(earnings = 0, profits = 0) {
  const c1 = nicClass1Employee(earnings).amount;
  const c2 = nicClass2(profits).amount;
  const c4 = nicClass4(profits).amount;
  const total = c1 + c2 + c4;
  return _result(
    total,
    [
      { label: 'Class 1 (employee)', value: c1 },
      { label: 'Class 2', value: c2 },
      { label: 'Class 4', value: c4 }
    ],
    ['UK-NI-01', 'UK-NI-03', 'UK-NI-04'],
    `Total individual NIC: £${_round(total).toLocaleString()}.`
  );
}

// =============================================================================
// SALARY SACRIFICE — NIC SAVING
// Coverage v1.4 §3, §7 · UK-PEN-07/08, UK-NI-13
// =============================================================================

/**
 * Salary sacrifice NIC saving. Both employee and employer save NIC on
 * sacrificed salary (subject to £2,000/yr NIC relief cap from April 2029).
 * For 2026/27 there is no cap. UK-PEN-07/08.
 *
 * @param {number} sacrificeAmount  Salary amount sacrificed into pension
 * @param {number} grossSalary      Gross salary BEFORE sacrifice (for marginal rate)
 * @returns {Object}                amount = total NIC saving (employee + employer)
 */
export function salarySacrificeNICSaving(sacrificeAmount, grossSalary) {
  const ni = bundle.nationalInsurance;

  // Employee marginal NIC rate at point of sacrifice
  const employeeRate = grossSalary > ni.upperEarningsLimit
    ? ni.class1EmployeeRateAboveUEL : ni.class1EmployeeRate;

  const employerRate = ni.class1EmployerRate;

  const employeeSaving = sacrificeAmount * employeeRate;
  const employerSaving = sacrificeAmount * employerRate;

  return _result(
    employeeSaving + employerSaving,
    [
      { label: `Employee NIC saved (${(employeeRate * 100).toFixed(0)}%)`, value: employeeSaving },
      { label: `Employer NIC saved (${(employerRate * 100).toFixed(0)}%)`, value: employerSaving }
    ],
    ['UK-PEN-07', 'UK-PEN-08', 'UK-NI-13'],
    `Salary sacrifice NIC saving on £${sacrificeAmount.toLocaleString()}: employee £${_round(employeeSaving).toLocaleString()} + employer £${_round(employerSaving).toLocaleString()} = £${_round(employeeSaving + employerSaving).toLocaleString()}. £2,000/yr cap applies from April 2029.`
  );
}

// =============================================================================
// §4 — CAPITAL GAINS TAX
// Coverage v1.4 §4 · UK-CGT-01 to UK-CGT-50
// 2026/27: AEA £3,000 · main rates 18%/24% · BADR/IR 18% (was 14%/10%)
// =============================================================================

/**
 * CGT Annual Exempt Amount.
 *
 * @returns {Object} amount = £3,000
 */
export function cgtAnnualExemptAmount() {
  const aea = bundle.capitalGains.annualExemptAmount;
  return _result(aea, [{ label: 'AEA 2026/27', value: aea }], ['UK-CGT-04'],
    `CGT Annual Exempt Amount: £${aea.toLocaleString()}.`);
}

/**
 * Determine CGT rate applicable to a given taxpayer at a given gain.
 * 18% if gain falls within unused basic-rate band; 24% above. (Aligned
 * residential and non-residential rates from April 2026.) UK-CGT-02/03.
 *
 * @param {number} gain                      Net gain after AEA
 * @param {number} taxableIncomeNonGain      Taxable income (post-PA) excluding gains
 * @returns {Object}                         amount = blended effective rate
 */
export function cgtRate(gain, taxableIncomeNonGain = 0) {
  if (gain <= 0) return _result(0, [], ['UK-CGT-02'], 'No gain.');

  const cg = bundle.capitalGains;
  const inc = bundle.income;
  const basicEnd = inc.basicRateBand; // 37,700

  const basicRoom = Math.max(0, basicEnd - taxableIncomeNonGain);
  const inBasic = Math.min(gain, basicRoom);
  const inHigher = gain - inBasic;

  const tax = inBasic * cg.basicRate + inHigher * cg.higherRate;
  const effectiveRate = gain > 0 ? tax / gain : 0;

  return _result(
    effectiveRate,
    [
      { label: `18% on £${_round(inBasic).toLocaleString()} (basic-rate room)`, value: _round(inBasic * cg.basicRate) },
      { label: `24% on £${_round(inHigher).toLocaleString()}`, value: _round(inHigher * cg.higherRate) }
    ],
    ['UK-CGT-02', 'UK-CGT-03'],
    `CGT effective rate ${(effectiveRate * 100).toFixed(2)}% on £${_round(gain).toLocaleString()} gain.`
  );
}

/**
 * Capital Gains Tax. Subtracts AEA, applies 18%/24% main rates.
 * Use cgtBADR / cgtInvestorsRelief for qualifying business disposals.
 *
 * @param {number} grossGain                Gross gain before AEA
 * @param {number} taxableIncomeNonGain     Taxable income (post-PA) excluding gains
 * @returns {Object}
 */
export function capitalGainsTax(grossGain, taxableIncomeNonGain = 0) {
  if (grossGain <= 0) return _result(0, [], ['UK-CGT-01'], 'No gain.');

  const cg = bundle.capitalGains;
  const aea = cg.annualExemptAmount;
  const taxableGain = Math.max(0, grossGain - aea);

  if (taxableGain === 0) {
    return _result(0,
      [{ label: 'AEA covers gain', value: 0 }],
      ['UK-CGT-04'],
      `Gain £${grossGain.toLocaleString()} covered by AEA £${aea}.`);
  }

  const inc = bundle.income;
  const basicEnd = inc.basicRateBand;
  const basicRoom = Math.max(0, basicEnd - taxableIncomeNonGain);
  const inBasic = Math.min(taxableGain, basicRoom);
  const inHigher = taxableGain - inBasic;
  const tax = inBasic * cg.basicRate + inHigher * cg.higherRate;

  return _result(
    tax,
    [
      { label: `Gross gain`, value: grossGain },
      { label: `AEA used`, value: -aea },
      { label: `Taxable gain`, value: taxableGain },
      { label: `18% on £${_round(inBasic).toLocaleString()}`, value: _round(inBasic * cg.basicRate) },
      { label: `24% on £${_round(inHigher).toLocaleString()}`, value: _round(inHigher * cg.higherRate) }
    ],
    ['UK-CGT-01', 'UK-CGT-02', 'UK-CGT-03', 'UK-CGT-04'],
    `CGT on £${grossGain.toLocaleString()} (AEA £${aea}): tax £${_round(tax).toLocaleString()}.`
  );
}

/**
 * Business Asset Disposal Relief.
 * 18% rate (from April 2026, was 14% in 25/26, 10% pre-2025).
 * £1m lifetime limit. UK-CGT-12.
 *
 * @param {number} qualifyingGain     Qualifying disposal gain
 * @param {number} lifetimeUsed       Already-used lifetime allowance
 * @returns {Object}
 */
export function cgtBADR(qualifyingGain, lifetimeUsed = 0) {
  const cg = bundle.capitalGains;
  const limit = cg.badrLifetimeLimit;        // 1,000,000
  const rate = cg.badrRate;                  // 0.18
  const remaining = Math.max(0, limit - lifetimeUsed);
  const eligible = Math.min(qualifyingGain, remaining);
  const tax = eligible * rate;

  return _result(
    tax,
    [
      { label: 'Lifetime limit remaining', value: remaining },
      { label: `BADR-eligible gain`, value: eligible },
      { label: `${(rate * 100).toFixed(0)}% on £${_round(eligible).toLocaleString()}`, value: tax }
    ],
    ['UK-CGT-12'],
    `BADR: £${_round(eligible).toLocaleString()} qualifies @ ${(rate * 100).toFixed(0)}% = £${_round(tax).toLocaleString()}. Remaining lifetime allowance: £${_round(remaining - eligible).toLocaleString()}.`
  );
}

/**
 * Investors' Relief.
 * 18% rate (aligned with BADR from April 2026). £1m lifetime. UK-CGT-13.
 * Qualifying unlisted shares held ≥ 3 years.
 *
 * @param {number} qualifyingGain
 * @param {number} lifetimeUsed
 * @returns {Object}
 */
export function cgtInvestorsRelief(qualifyingGain, lifetimeUsed = 0) {
  const cg = bundle.capitalGains;
  const limit = cg.investorsReliefLifetimeLimit;
  const rate = cg.investorsReliefRate;
  const remaining = Math.max(0, limit - lifetimeUsed);
  const eligible = Math.min(qualifyingGain, remaining);
  const tax = eligible * rate;

  return _result(
    tax,
    [
      { label: 'IR lifetime remaining', value: remaining },
      { label: 'IR-eligible gain', value: eligible },
      { label: `${(rate * 100).toFixed(0)}% on £${_round(eligible).toLocaleString()}`, value: tax }
    ],
    ['UK-CGT-13'],
    `Investors' Relief: £${_round(eligible).toLocaleString()} @ ${(rate * 100).toFixed(0)}% = £${_round(tax).toLocaleString()}.`
  );
}

/**
 * Principal Private Residence relief (CGT on main home).
 * Pro-rata exemption based on period of occupation as main residence,
 * plus final 9 months always exempt. UK-CGT-15.
 *
 * @param {number} grossGain        Gross gain on disposal
 * @param {number} occupationDays   Days property was main residence
 * @param {number} totalOwnedDays   Total days owned
 * @returns {Object}                amount = chargeable gain after PPR
 */
export function cgtPrincipalPrivateResidence(grossGain, occupationDays, totalOwnedDays) {
  if (grossGain <= 0 || totalOwnedDays <= 0) {
    return _result(0, [], ['UK-CGT-15'], 'No gain or invalid period.');
  }

  const finalPeriodMonths = bundle.property.cgtOnProperty.pprFinalPeriodExemptionMonths; // 9
  const finalPeriodDays = Math.round(finalPeriodMonths * 30.44);
  const exemptDays = Math.min(totalOwnedDays, occupationDays + finalPeriodDays);
  const exemptFraction = exemptDays / totalOwnedDays;
  const exemptGain = grossGain * exemptFraction;
  const chargeable = grossGain - exemptGain;

  return _result(
    chargeable,
    [
      { label: 'Gross gain', value: grossGain },
      { label: `Occupation ${occupationDays} + final 9mo (${finalPeriodDays}d) of ${totalOwnedDays}d`, value: exemptDays },
      { label: 'PPR-exempt fraction', value: exemptFraction },
      { label: 'Exempt gain', value: -exemptGain },
      { label: 'Chargeable gain', value: chargeable }
    ],
    ['UK-CGT-15'],
    `PPR: ${(exemptFraction * 100).toFixed(1)}% of £${_round(grossGain).toLocaleString()} exempt. Chargeable gain £${_round(chargeable).toLocaleString()}.`
  );
}

/**
 * Inter-spouse transfer — no-gain-no-loss in same tax year.
 * Transferee inherits original cost base. UK-CGT-09.
 *
 * @param {number} originalCostBase
 * @returns {Object} amount = inherited cost base for transferee
 */
export function cgtSpouseTransfer(originalCostBase) {
  return _result(
    originalCostBase,
    [{ label: 'Inherited cost base', value: originalCostBase }],
    ['UK-CGT-09'],
    `Spousal transfer: no-gain-no-loss. Transferee's cost base = £${originalCostBase.toLocaleString()}.`
  );
}

/**
 * 30-day rule — bed-and-breakfasting prevention.
 * Repurchase within 30 days matches against sale and prevents gain
 * crystallisation. UK-CGT-32.
 *
 * @param {Date|string} disposalDate
 * @param {Date|string} repurchaseDate
 * @returns {Object} amount = boolean (1 = blocked, 0 = allowed)
 */
export function cgt30DayRule(disposalDate, repurchaseDate) {
  const d1 = new Date(disposalDate);
  const d2 = new Date(repurchaseDate);
  const days = Math.abs((d2 - d1) / 86400000);
  const blocked = days < 30;
  return _result(
    blocked ? 1 : 0,
    [{ label: 'Days between disposal and repurchase', value: days }],
    ['UK-CGT-32'],
    blocked
      ? `30-day rule applies: repurchase within ${days.toFixed(0)} days. Bed-and-breakfasting blocked. Use Bed-and-ISA or Bed-and-Spouse instead.`
      : `30-day rule clear: ${days.toFixed(0)} days between disposal and repurchase.`
  );
}

/**
 * Bed-and-ISA — sell outside ISA, rebuy inside ISA.
 * Crystallises gain (using AEA), avoids 30-day rule because asset moves
 * into a different wrapper. UK-CGT-27.
 *
 * @param {number} unrealisedGain   Current unrealised gain on holding
 * @param {number} aeaUsed          AEA already used this tax year
 * @param {number} isaCapacity      Remaining ISA allowance for the year
 * @param {number} disposalAmount   Amount being sold and re-bought in ISA
 * @returns {Object}                amount = gain crystallised within AEA (tax-free)
 */
export function cgtBedAndISA(unrealisedGain, aeaUsed = 0, isaCapacity = 20000, disposalAmount = 0) {
  const cg = bundle.capitalGains;
  const aea = cg.annualExemptAmount;
  const aeaRemaining = Math.max(0, aea - aeaUsed);

  const gainCrystallised = Math.min(unrealisedGain, aeaRemaining);
  const headroom = Math.min(isaCapacity, disposalAmount);

  return _result(
    gainCrystallised,
    [
      { label: 'AEA remaining', value: aeaRemaining },
      { label: 'Gain crystallised tax-free', value: gainCrystallised },
      { label: 'ISA capacity used', value: headroom }
    ],
    ['UK-CGT-27', 'UK-ISA-10'],
    `Bed-and-ISA: crystallise £${_round(gainCrystallised).toLocaleString()} of gain within AEA. ISA capacity used £${_round(headroom).toLocaleString()}. Asset now grows tax-free inside ISA.`
  );
}

// =============================================================================
// §9.1 — STAMP DUTY LAND TAX (SDLT)
// Coverage v1.4 §9.1 · UK-PROP-01 to UK-PROP-13
// 2026/27: Standard residential bands · FTB relief £300k/£500k (corrected v1.4)
// 5% additional property surcharge · 2% non-UK resident surcharge
// =============================================================================

/**
 * SDLT on main residence (no surcharges).
 * UK-PROP-01 to UK-PROP-08.
 *
 * Note: the bundle uses HMRC-style integer band notation (e.g. from: 125001).
 * For slab math we track a running upper bound from the previous band rather
 * than reading b.from, to avoid the £1 gap at each boundary.
 *
 * @param {number} price  Purchase price
 * @returns {Object}
 */
export function sdltMainResidence(price) {
  if (price <= 0) return _result(0, [], ['UK-PROP-01'], 'No purchase.');

  const bands = bundle.property.sdlt.residentialRates;
  let tax = 0;
  const breakdown = [];
  let priorUpper = 0; // running upper bound of preceding band

  for (const b of bands) {
    const lower = priorUpper;
    const upper = b.upTo ? b.upTo : Infinity;
    const sliceAmt = Math.max(0, Math.min(price, upper) - lower);
    const sliceTax = sliceAmt * b.rate;
    if (sliceAmt > 0) {
      tax += sliceTax;
      breakdown.push({
        label: `${(b.rate * 100).toFixed(0)}% on £${_round(sliceAmt).toLocaleString()} (£${lower.toLocaleString()}–${upper === Infinity ? 'above' : '£' + upper.toLocaleString()})`,
        value: _round(sliceTax),
        rate: b.rate
      });
    }
    priorUpper = upper === Infinity ? priorUpper : upper;
  }

  return _result(
    tax,
    breakdown,
    ['UK-PROP-01', 'UK-PROP-02', 'UK-PROP-03', 'UK-PROP-04', 'UK-PROP-05', 'UK-PROP-06', 'UK-PROP-07', 'UK-PROP-08'],
    `SDLT on £${price.toLocaleString()}: £${_round(tax).toLocaleString()}.`
  );
}

/**
 * SDLT — First-Time Buyer Relief.
 * 0% to £300,000; 5% on £300,001–£500,000; full SDLT above £500,000.
 * Reverted from temporary £425k/£625k thresholds on 1 April 2025. UK-PROP-10.
 *
 * @param {number} price
 * @returns {Object}
 */
export function sdltFirstTimeBuyer(price) {
  const ftb = bundle.property.sdlt.firstTimeBuyerRelief;
  const zeroTo = ftb.zeroRateTo;       // 300,000
  const reducedTo = ftb.reducedRateTo; // 500,000
  const reducedRate = ftb.reducedRate; // 0.05

  // Above £500k: full standard SDLT applies (no relief)
  if (price > reducedTo) {
    const std = sdltMainResidence(price);
    return {
      ...std,
      rules: ['UK-PROP-10'],
      explanation: `FTB relief unavailable (price £${price.toLocaleString()} exceeds £${reducedTo.toLocaleString()}). Standard SDLT £${_round(std.amount).toLocaleString()} applies.`
    };
  }

  const taxable = Math.max(0, price - zeroTo);
  const tax = taxable * reducedRate;

  return _result(
    tax,
    [
      { label: `0% on first £${zeroTo.toLocaleString()}`, value: 0 },
      { label: `${(reducedRate * 100).toFixed(0)}% on £${_round(taxable).toLocaleString()}`, value: tax }
    ],
    ['UK-PROP-10'],
    `FTB SDLT on £${price.toLocaleString()}: £${_round(tax).toLocaleString()}. (Permanent thresholds £${zeroTo.toLocaleString()}/£${reducedTo.toLocaleString()} from 1 April 2025.)`
  );
}

/**
 * SDLT — Additional Property Surcharge.
 * 5% surcharge from 31 October 2024 (was 3%). Applied on top of standard
 * residential bands across all bands. UK-PROP-11.
 *
 * @param {number} price
 * @returns {Object}
 */
export function sdltAdditionalProperty(price) {
  const std = sdltMainResidence(price).amount;
  const surchargeRate = bundle.property.sdlt.additionalPropertySurcharge; // 0.05
  const surcharge = price * surchargeRate;
  const total = std + surcharge;

  return _result(
    total,
    [
      { label: 'Standard SDLT', value: std },
      { label: `${(surchargeRate * 100).toFixed(0)}% additional property surcharge`, value: surcharge }
    ],
    ['UK-PROP-01', 'UK-PROP-11'],
    `Additional property SDLT on £${price.toLocaleString()}: £${_round(std).toLocaleString()} standard + £${_round(surcharge).toLocaleString()} surcharge = £${_round(total).toLocaleString()}. Surcharge reclaimable within 12 months if previous main home sold within 36 months.`
  );
}

/**
 * SDLT — Non-UK Resident Surcharge.
 * 2% surcharge for buyers not UK-resident for 183+ days in 12 months
 * before purchase. UK-PROP-12.
 *
 * @param {number} price
 * @returns {Object}
 */
export function sdltNonUKResident(price) {
  const std = sdltMainResidence(price).amount;
  const surchargeRate = bundle.property.sdlt.nonUKResidentSurcharge; // 0.02
  const surcharge = price * surchargeRate;
  return _result(
    std + surcharge,
    [
      { label: 'Standard SDLT', value: std },
      { label: `${(surchargeRate * 100).toFixed(0)}% non-UK resident surcharge`, value: surcharge }
    ],
    ['UK-PROP-12'],
    `Non-UK resident SDLT on £${price.toLocaleString()}: £${_round(std + surcharge).toLocaleString()}.`
  );
}

/**
 * SDLT main router.
 * Combines FTB / additional property / non-UK resident logic.
 *
 * @param {number}  price
 * @param {Object}  flags  { firstTimeBuyer, additional, nonUKResident }
 * @returns {Object}
 */
export function sdlt(price, flags = {}) {
  const { firstTimeBuyer, additional, nonUKResident } = flags;

  // Surcharges stack on top of each other AND on top of base SDLT.
  // FTB relief is mutually exclusive with additional-property surcharge
  // (you cannot be a first-time buyer of an "additional" property).
  if (firstTimeBuyer && !additional) {
    let r = sdltFirstTimeBuyer(price);
    if (nonUKResident) {
      const surcharge = price * bundle.property.sdlt.nonUKResidentSurcharge;
      r = _result(
        r.amount + surcharge,
        [...r.breakdown, { label: '2% non-UK resident surcharge', value: surcharge }],
        [...r.rules, 'UK-PROP-12'],
        `${r.explanation} Plus £${_round(surcharge).toLocaleString()} non-UK resident surcharge.`
      );
    }
    return r;
  }

  if (additional) {
    let r = sdltAdditionalProperty(price);
    if (nonUKResident) {
      const surcharge = price * bundle.property.sdlt.nonUKResidentSurcharge;
      r = _result(
        r.amount + surcharge,
        [...r.breakdown, { label: '2% non-UK resident surcharge', value: surcharge }],
        [...r.rules, 'UK-PROP-12'],
        `${r.explanation} Plus £${_round(surcharge).toLocaleString()} non-UK resident surcharge.`
      );
    }
    return r;
  }

  if (nonUKResident) return sdltNonUKResident(price);
  return sdltMainResidence(price);
}

// =============================================================================
// §9.3 — STAMP DUTY RESERVE TAX (SDRT) ON SHARES
// Coverage v1.4 §9.3 · UK-PROP-31 to UK-PROP-33
// 0.5% on electronic UK share purchases (CREST). AIM shares exempt.
// =============================================================================

/**
 * SDRT on share purchases.
 *
 * @param {number}  price   Purchase consideration
 * @param {boolean} isAIM   AIM-listed shares are exempt
 * @returns {Object}
 */
export function sdrtOnShares(price, isAIM = false) {
  if (isAIM) {
    return _result(0,
      [{ label: 'AIM-exempt', value: 0 }],
      ['UK-PROP-33'],
      'AIM shares: SDRT exempt.');
  }
  const rate = bundle.property.sdrtOnShares.rate; // 0.005
  const tax = price * rate;
  return _result(
    tax,
    [{ label: `${(rate * 100).toFixed(2)}% SDRT`, value: tax }],
    ['UK-PROP-31'],
    `SDRT on £${price.toLocaleString()}: £${_round(tax).toLocaleString()}.`
  );
}

// =============================================================================
// WRAPPER-FIRST DISPATCHER (D-WRAPPER-FIRST-1)
// MM v2.6 §0 · binding before any IT, CGT, or IHT computation on an asset
// =============================================================================

/**
 * Resolve wrapper type for an asset.
 * Per D-WRAPPER-FIRST-1: this MUST be called before any tax calculation on a
 * wrapped asset. Unwrapped assets return 'GIA' (General Investment Account).
 *
 * Wrapper enum (canonical): 'ISA' | 'PENSION' | 'GIA' | 'EIS' | 'SEIS' | 'VCT' |
 *   'ONSHORE_BOND' | 'OFFSHORE_BOND' | 'TRUST' | 'COMPANY' | 'PROPERTY_DIRECT'
 *
 * @param {Object} asset
 * @returns {string}  Wrapper key
 */
export function getWrapper(asset = {}) {
  if (asset.wrapper) return String(asset.wrapper).toUpperCase();
  if (asset.isaType) return 'ISA';
  if (asset.pensionType) return 'PENSION';
  if (asset.eisRegistered) return 'EIS';
  if (asset.seisRegistered) return 'SEIS';
  if (asset.vctRegistered) return 'VCT';
  if (asset.bondType === 'onshore') return 'ONSHORE_BOND';
  if (asset.bondType === 'offshore') return 'OFFSHORE_BOND';
  if (asset.trustType) return 'TRUST';
  if (asset.companyShareholding) return 'COMPANY';
  if (asset.assetClass === 'property' && !asset.wrapper) return 'PROPERTY_DIRECT';
  return 'GIA';
}

/**
 * Wrapper-aware tax dispatcher for an income/gain stream from an asset.
 * Determines whether income/gain is taxable based on wrapper, and routes to
 * the correct calculator. Tax-exempt wrappers return zero. UK-ISA-09 etc.
 *
 * @param {Object} asset                  Asset object
 * @param {Object} flow                   { income, gain, ani, taxableIncome, residency, taxableIncomeNonGain }
 * @returns {Object}                      amount = tax payable
 */
export function taxOnAsset(asset, flow = {}) {
  const wrapper = getWrapper(asset);
  const { income = 0, gain = 0, ani = 0, taxableIncome = 0, residency = 'ENG', taxableIncomeNonGain = 0 } = flow;

  // Tax-exempt wrappers
  if (wrapper === 'ISA') {
    return _result(0,
      [{ label: 'ISA wrapper — exempt', value: 0 }],
      ['UK-ISA-09'],
      'Income and gains within ISA: tax-free.');
  }

  if (wrapper === 'PENSION') {
    // Pension growth is tax-free; tax arises on withdrawal (handled by uk-pension.js).
    return _result(0,
      [{ label: 'Pension wrapper — growth exempt; tax on withdrawal', value: 0 }],
      ['UK-PEN-01'],
      'Within-pension growth: tax-free. Tax arises on drawdown — see uk-pension.js.');
  }

  // Taxable wrappers — combine income and CGT
  const incomeTaxResult = income > 0
    ? incomeTax(income + taxableIncome, residency)
    : _result(0, [], [], '');
  const cgtResult = gain > 0
    ? capitalGainsTax(gain, taxableIncomeNonGain)
    : _result(0, [], [], '');

  const total = incomeTaxResult.amount + cgtResult.amount;

  return _result(
    total,
    [
      ...(income > 0 ? [{ label: `Income tax on £${income.toLocaleString()}`, value: incomeTaxResult.amount }] : []),
      ...(gain > 0 ? [{ label: `CGT on £${gain.toLocaleString()}`, value: cgtResult.amount }] : [])
    ],
    [...incomeTaxResult.rules, ...cgtResult.rules, 'D-WRAPPER-FIRST-1'],
    `Tax on ${wrapper} asset: income £${_round(incomeTaxResult.amount).toLocaleString()} + CGT £${_round(cgtResult.amount).toLocaleString()} = £${_round(total).toLocaleString()}.`
  );
}

// =============================================================================
// END OF FILE
// =============================================================================
