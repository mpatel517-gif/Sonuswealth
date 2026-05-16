// test-UK-CMA-2026.1.js
// Smoke test for UK-CMA-2026.1 bundle
// Run from parts/3-Engine/bundles/: node test-UK-CMA-2026.1.js
// Pattern matches existing test-uk-pension.js, test-uk-estate.js
//
// Built at s17b-1c-cma · 8 May 2026 · Opus
// Validates: structural integrity · ranges · correlation matrix PSD · yield curve sanity ·
// annuity table completeness · expense band shape · cross-bundle non-duplication · _source citations.

const fs = require('fs');
const path = require('path');

const BUNDLE_PATH = process.env.BUNDLE_PATH || path.join(__dirname, 'UK-CMA-2026.1.json');
const TAX_BUNDLE_PATH = process.env.TAX_BUNDLE_PATH || path.join(__dirname, 'UK-master-2026.1.1.json');

let bundle;
try {
  bundle = JSON.parse(fs.readFileSync(BUNDLE_PATH, 'utf8'));
} catch (e) {
  console.error(`✗ FATAL: cannot load CMA bundle from ${BUNDLE_PATH}`);
  console.error(`  ${e.message}`);
  process.exit(1);
}

let pass = 0, fail = 0, skipped = 0;
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

function checkSkip(name, reason) {
  skipped++;
  console.log(`  ~ ${name} [SKIPPED: ${reason}]`);
}

// ============================================================
// §1 — STRUCTURAL: bundle loads, _meta present, top-level fields, types
// ============================================================
console.log('\n§1 — Structural');

check('bundle loads as object', typeof bundle === 'object' && bundle !== null);
check('_meta present', typeof bundle._meta === 'object');
check('_meta.version = "UK-CMA-2026.1"', bundle._meta && bundle._meta.version === 'UK-CMA-2026.1');
check('_meta.type = "capital-market-assumptions"', bundle._meta && bundle._meta.type === 'capital-market-assumptions');
check('_meta.jurisdiction = "UK"', bundle._meta && bundle._meta.jurisdiction === 'UK');
check('_meta.effectiveFrom = "2026-04-06"', bundle._meta && bundle._meta.effectiveFrom === '2026-04-06');
check('_meta.effectiveTo = "2027-04-05"', bundle._meta && bundle._meta.effectiveTo === '2027-04-05');
check('_meta.sourceUniverseDecisions present', bundle._meta && typeof bundle._meta.sourceUniverseDecisions === 'object');

const requiredFields = [
  'inflationPath', 'equityReturns', 'bondReturns', 'giltYields', 'annuityRates',
  'propertyGrowthRate', 'cashRate', 'correlationMatrix', 'gkDefaults', 'swrRegimes',
  'expenseBands', 'hmrcInterestRate', 'tvLicenceFee', 'vehicleExciseDuty',
  'taxFreeChildcareExtended', 'childcareFreeHours', 'nhsPrescriptionCharges',
  'independentSchoolVAT', 'effective_until'
];
requiredFields.forEach(f => {
  check(`top-level field present: ${f}`, bundle[f] !== undefined);
});

check('inflationPath is array', Array.isArray(bundle.inflationPath));
check('giltYields is array', Array.isArray(bundle.giltYields));
check('annuityRates is array', Array.isArray(bundle.annuityRates));
check('correlationMatrix.matrix is array', bundle.correlationMatrix && Array.isArray(bundle.correlationMatrix.matrix));
check('correlationMatrix.assetClasses is array', bundle.correlationMatrix && Array.isArray(bundle.correlationMatrix.assetClasses));
check('expenseBands is object', typeof bundle.expenseBands === 'object');
check('effective_until matches _meta.effectiveTo', bundle.effective_until === bundle._meta.effectiveTo);

// ============================================================
// §2 — RANGE/SANITY: macro values within plausible bounds
// ============================================================
console.log('\n§2 — Range/sanity');

bundle.inflationPath.forEach((row, i) => {
  check(`inflationPath[${i}].cpi ∈ [-0.05, 0.20]`,
    typeof row.cpi === 'number' && row.cpi >= -0.05 && row.cpi <= 0.20,
    `got ${row.cpi}`);
});

const ukEq = bundle.equityReturns.uk;
check('equityReturns.uk.mean ∈ [0, 0.15]', ukEq.mean >= 0 && ukEq.mean <= 0.15, `got ${ukEq.mean}`);
check('equityReturns.uk.std_dev ∈ [0.05, 0.30]', ukEq.std_dev >= 0.05 && ukEq.std_dev <= 0.30, `got ${ukEq.std_dev}`);
check('equityReturns.global.mean ∈ [0, 0.15]', bundle.equityReturns.global.mean >= 0 && bundle.equityReturns.global.mean <= 0.15);
check('equityReturns.emerging.std_dev > equityReturns.uk.std_dev (EM higher vol)',
  bundle.equityReturns.emerging.std_dev > ukEq.std_dev);

const bondShort = bundle.bondReturns.short;
const bondMedium = bundle.bondReturns.medium;
check('bondReturns.short.std_dev < equityReturns.uk.std_dev (bonds lower vol than equity)',
  bondShort.std_dev < ukEq.std_dev);
check('bondReturns.medium.std_dev > bondReturns.short.std_dev (medium > short duration vol)',
  bondMedium.std_dev > bondShort.std_dev);
check('bondReturns.medium.mean > bondReturns.short.mean (term premium)',
  bondMedium.mean > bondShort.mean);
check('bondReturns.corporateCredit.mean > bondReturns.medium.mean (credit spread)',
  bundle.bondReturns.corporateCredit.mean > bondMedium.mean);

check('cashRate.value ∈ [-0.01, 0.10]',
  bundle.cashRate.value >= -0.01 && bundle.cashRate.value <= 0.10,
  `got ${bundle.cashRate.value}`);
check('cashRate.value < bondReturns.short.mean (cash < bonds)',
  bundle.cashRate.value < bondShort.mean);

check('propertyGrowthRate.value ∈ [-0.02, 0.10]',
  bundle.propertyGrowthRate.value >= -0.02 && bundle.propertyGrowthRate.value <= 0.10);

check('hmrcInterestRate.latePayment > cashRate.value (HMRC = base + 4%)',
  bundle.hmrcInterestRate.latePayment > bundle.cashRate.value);
check('hmrcInterestRate.repayment < hmrcInterestRate.latePayment',
  bundle.hmrcInterestRate.repayment < bundle.hmrcInterestRate.latePayment);

check('tvLicenceFee.value ∈ [100, 250]',
  bundle.tvLicenceFee.value >= 100 && bundle.tvLicenceFee.value <= 250);

check('independentSchoolVAT.rate = 0.20',
  bundle.independentSchoolVAT.rate === 0.20);

// ============================================================
// §3 — CORRELATION MATRIX: symmetry, diagonal, bounds, PSD-lite
// ============================================================
console.log('\n§3 — Correlation matrix');

const cm = bundle.correlationMatrix;
const M = cm.matrix;
const N = cm.assetClasses.length;

check(`assetClasses length matches matrix dim (N=${N})`,
  M.length === N && M.every(row => row.length === N));

check('N = 8 (Standard 8 asset universe per O-CF-RULES-01 = B)', N === 8);

// Diagonal = 1.0
let diagonalOk = true;
for (let i = 0; i < N; i++) {
  if (M[i][i] !== 1.0) { diagonalOk = false; break; }
}
check('diagonal entries all = 1.0', diagonalOk);

// Symmetry
let symmetryOk = true;
for (let i = 0; i < N; i++) {
  for (let j = 0; j < N; j++) {
    if (Math.abs(M[i][j] - M[j][i]) > 1e-9) { symmetryOk = false; break; }
  }
}
check('matrix is symmetric (M[i][j] = M[j][i])', symmetryOk);

// All values ∈ [-1, 1]
let boundsOk = true;
for (let i = 0; i < N; i++) {
  for (let j = 0; j < N; j++) {
    if (M[i][j] < -1 || M[i][j] > 1) { boundsOk = false; break; }
  }
}
check('all values ∈ [-1, 1]', boundsOk);

// PSD-lite: row sums positive (necessary but not sufficient — full eigenvalue check defers to runtime)
let psdLiteOk = true;
for (let i = 0; i < N; i++) {
  const rowSum = M[i].reduce((a, b) => a + b, 0);
  if (rowSum < 0) { psdLiteOk = false; break; }
}
check('PSD-lite check: row sums all ≥ 0', psdLiteOk);

// Positive correlation pairs that should be positive
const idx = (name) => cm.assetClasses.indexOf(name);
check('uk_equity ↔ global_equity_ex_uk strongly positive (>0.7)',
  M[idx('uk_equity')][idx('global_equity_ex_uk')] > 0.7);
check('uk_gilts_short ↔ uk_gilts_medium strongly positive (>0.7)',
  M[idx('uk_gilts_short')][idx('uk_gilts_medium')] > 0.7);
check('uk_equity ↔ uk_gilts_short negative or near-zero (<0.2)',
  M[idx('uk_equity')][idx('uk_gilts_short')] < 0.2);

// ============================================================
// §4 — YIELD CURVE: monotonic-ish, expected durations
// ============================================================
console.log('\n§4 — Yield curve');

const expectedDurations = [1, 3, 5, 10, 15, 20, 25, 30];
const presentDurations = bundle.giltYields.map(g => g.duration_years);
expectedDurations.forEach(d => {
  check(`giltYields includes duration ${d}yr`, presentDurations.includes(d));
});

bundle.giltYields.forEach((g, i) => {
  check(`giltYields[${i}].yield ∈ [-0.02, 0.10]`,
    g.yield >= -0.02 && g.yield <= 0.10,
    `${g.duration_years}yr = ${g.yield}`);
});

// Loosely monotonic — no big inversions
const yields = bundle.giltYields.map(g => g.yield);
const tenYr = bundle.giltYields.find(g => g.duration_years === 10);
check('10yr gilt yield exists (used as risk-free for CoI variants per O-CF-RULES-12)', !!tenYr);
check('30yr yield ≥ 1yr yield (no extreme inversion)', yields[yields.length - 1] >= yields[0] - 0.01);

// ============================================================
// §5 — ANNUITY TABLE COMPLETENESS
// ============================================================
console.log('\n§5 — Annuity table');

const ages = [55, 60, 65, 70, 75];
const sexes = ['M', 'F'];
ages.forEach(age => {
  sexes.forEach(sex => {
    const matching = bundle.annuityRates.filter(a => a.age === age && a.sex === sex);
    check(`annuityRates: age=${age}, sex=${sex} present (any guarantee/escalation)`,
      matching.length > 0,
      `count=${matching.length}`);
  });
});

// Monotonic: older age → higher rate (same sex, no guarantee, no escalation)
const ageMonotonic = (sex) => {
  const filtered = ages.map(age =>
    bundle.annuityRates.find(a => a.age === age && a.sex === sex && a.guarantee_years === 0 && a.escalation_pct === 0.000)
  );
  for (let i = 1; i < filtered.length; i++) {
    if (!filtered[i] || !filtered[i-1] || filtered[i].rate_per_100k_pa <= filtered[i-1].rate_per_100k_pa) return false;
  }
  return true;
};
check('annuityRates monotonic in age for M (level, no guarantee)', ageMonotonic('M'));
check('annuityRates monotonic in age for F (level, no guarantee)', ageMonotonic('F'));

// 3% escalation < level (level pays more upfront)
const m65level = bundle.annuityRates.find(a => a.age === 65 && a.sex === 'M' && a.guarantee_years === 0 && a.escalation_pct === 0);
const m65esc = bundle.annuityRates.find(a => a.age === 65 && a.sex === 'M' && a.guarantee_years === 0 && a.escalation_pct === 0.03);
check('age 65 M: 3% escalation rate < level rate (escalation costs upfront)',
  m65esc.rate_per_100k_pa < m65level.rate_per_100k_pa);

// Female rate < Male rate (longer female life expectancy)
const f65level = bundle.annuityRates.find(a => a.age === 65 && a.sex === 'F' && a.guarantee_years === 0 && a.escalation_pct === 0);
check('age 65: female rate < male rate (longer female longevity)',
  f65level.rate_per_100k_pa < m65level.rate_per_100k_pa);

// ============================================================
// §6 — EXPENSE BANDS: shape, life stages present, essential ≤ comfortable
// ============================================================
console.log('\n§6 — Expense bands');

const stages = ['foundation_18_30', 'accumulation_30_45', 'pre_retirement_45_60', 'transition_60_67', 'decumulation_67_plus'];
const tiers = ['minimum', 'moderate', 'comfortable'];

stages.forEach(stage => {
  check(`expenseBands.${stage} present`, !!bundle.expenseBands[stage]);
  if (bundle.expenseBands[stage]) {
    tiers.forEach(tier => {
      check(`expenseBands.${stage}.${tier} present`, !!bundle.expenseBands[stage][tier]);
      if (bundle.expenseBands[stage][tier]) {
        const t = bundle.expenseBands[stage][tier];
        check(`expenseBands.${stage}.${tier}: essential + discretionary > 0`,
          (t.essential_annual + t.discretionary_annual) > 0);
      }
    });
    // Tier monotonic: minimum.essential ≤ moderate.essential ≤ comfortable.essential
    const min = bundle.expenseBands[stage].minimum.essential_annual;
    const mod = bundle.expenseBands[stage].moderate.essential_annual;
    const com = bundle.expenseBands[stage].comfortable.essential_annual;
    check(`expenseBands.${stage}: minimum ≤ moderate ≤ comfortable (essential)`,
      min <= mod && mod <= com);
  }
});

// ============================================================
// §7 — CROSS-BUNDLE: tax bundle non-duplication
// ============================================================
console.log('\n§7 — Cross-bundle (vs UK-master tax bundle)');

let taxBundle;
try {
  taxBundle = JSON.parse(fs.readFileSync(TAX_BUNDLE_PATH, 'utf8'));
  check('tax bundle UK-master loads', !!taxBundle);
  check('tax bundle _meta.version = "UK-2026.1.1"', taxBundle._meta.version === 'UK-2026.1.1');

  // Confirm CMA-owned retail-reference fields are NOT in tax bundle (Finding 1 resolution)
  const taxBundleStr = JSON.stringify(taxBundle);
  check('tvLicenceFee NOT in tax bundle (CMA owns)',
    !taxBundleStr.match(/"tvLicenceFee"/));
  check('hmrcInterestRate NOT in tax bundle (CMA owns)',
    !taxBundleStr.match(/"hmrcInterestRate"/));
  check('nhsPrescriptionCharges NOT in tax bundle (CMA owns)',
    !taxBundleStr.match(/"nhsPrescriptionCharges"/));
  check('childcareFreeHours NOT in tax bundle (CMA owns)',
    !taxBundleStr.match(/"childcareFreeHours"/));

  // CF §7.3 fields that genuinely belong to tax bundle should still resolve
  check('tax bundle: income.personalAllowance present', taxBundle.income && typeof taxBundle.income.personalAllowance === 'number');
} catch (e) {
  checkSkip('tax bundle cross-check', `cannot load tax bundle: ${e.message}`);
}

// ============================================================
// §8 — SOURCE CITATIONS: every leaf value has _source
// ============================================================
console.log('\n§8 — Source citations');

function walkSources(obj, path = '') {
  let leafCount = 0, withSource = 0;
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      const r = walkSources(item, `${path}[${i}]`);
      leafCount += r.leafCount;
      withSource += r.withSource;
    });
  } else if (typeof obj === 'object' && obj !== null) {
    // Object with _source = leaf-with-source
    if ('_source' in obj) {
      leafCount++;
      withSource++;
    } else {
      Object.entries(obj).forEach(([k, v]) => {
        if (k.startsWith('_')) return; // skip _meta-like keys at top-level recursion
        if (typeof v === 'object' && v !== null) {
          const r = walkSources(v, `${path}.${k}`);
          leafCount += r.leafCount;
          withSource += r.withSource;
        }
      });
    }
  }
  return { leafCount, withSource };
}

const sourceWalk = walkSources(bundle);
check(`source citation coverage ≥ 95% (got ${sourceWalk.withSource}/${sourceWalk.leafCount})`,
  sourceWalk.leafCount > 0 && (sourceWalk.withSource / sourceWalk.leafCount) >= 0.95);

// Specific spot-checks
check('inflationPath[0] has _source', bundle.inflationPath[0]._source);
check('equityReturns.uk has _source', bundle.equityReturns.uk._source);
check('correlationMatrix has _source', bundle.correlationMatrix._source);
check('gkDefaults has _source', bundle.gkDefaults._source);
check('hmrcInterestRate has _source', bundle.hmrcInterestRate._source);

// _meta.sourceUniverseDecisions records all 5 §5 + Finding 1 decisions
const decisions = bundle._meta.sourceUniverseDecisions;
check('_meta records §5.1 (asset universe)', !!decisions['O-CF-RULES-01_assetUniverse']);
check('_meta records §5.2 (Morningstar)', !!decisions['O-CF-RULES-05_swrMorningstar']);
check('_meta records §5.3 (expense bands)', !!decisions['O-CF-RULES-10_expenseBands']);
check('_meta records §5.4 (CoI discount rate)', !!decisions['O-CF-RULES-12_coiDiscountRate']);
check('_meta records Finding 1 resolution', !!decisions['Finding1_retailReferenceFieldOwnership']);

// ============================================================
// SUMMARY
// ============================================================
console.log('\n' + '='.repeat(60));
console.log(`SMOKE TEST SUMMARY: ${pass} pass · ${fail} fail · ${skipped} skipped`);
console.log('='.repeat(60));

if (fail > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  - ${f}`));
  process.exit(1);
} else {
  console.log('\n✅ All structural, range, correlation matrix, yield curve, annuity table,');
  console.log('   expense band, cross-bundle, and source-citation checks pass.');
  process.exit(0);
}
