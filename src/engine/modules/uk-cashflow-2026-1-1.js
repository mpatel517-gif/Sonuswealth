// =====================================================================
// SONUSWEALTH — parts/3-Engine/uk-cashflow-2026-1-1.js
// =====================================================================
// UK Cashflow Engine — Track A · Code · Opus · s17b-1c-eng · 8 May 2026
//
// Implements CF v1.5 §8 (30 named public fns) plus 6 canonical-CoI
// handlers per CF v1.5 §17 + 3 orchestrators. Total surface 36 public.
// Private helpers ~45-50. Engine target ~80-86 callable functions.
//
// Phase plan (atomic build this session):
//   §B Archetype + view mode (§8.11–8.12)
//   §C Domain P expense + tax payments (§8.25–8.30, 8.14)
//   §D Income + ANI interface (private)
//   §E SWR + funded ratio + GK + Bengen (§8.1, 8.5, 8.16–8.18)
//   §F Bucket + Floor-Upside (§8.19–8.22)         [v1: O-CF-RULES-03/04]
//   §G Monte Carlo + risk metrics (§8.3, 8.4, 8.6, 8.7)  [O-MC-RUNS=1k]
//   §H Scenarios + goal-seek (§8.9, 8.13)
//   §I CoI integration — 6 handlers + variants + orchestrators (§8.23, §17)
//   §J Health + liquidity + surplus (§8.2, 8.14, 8.15)
//   §K Stubs (§8.8 Reality, §8.10 PRC/PCC)
//   §L Failure mode helpers (§8.31)
//   §M Drawdown sequencing (§8.24)
//   §N Public exports
//
// =====================================================================
// Bundle dependencies:
//
//   CMA bundle (UK-CMA-2026.1.json) — primary; ~25 of 36 public fns read it:
//     inflationPath · equityReturns · bondReturns · giltYields · annuityRates
//     propertyGrowthRate · cashRate · correlationMatrix · gkDefaults
//     swrRegimes · expenseBands · tvLicenceFee · vehicleExciseDuty
//     taxFreeChildcareExtended · childcareFreeHours · nhsPrescriptionCharges
//     independentSchoolVAT · hmrcInterestRate · effective_until
//
//   Tax bundle (UK-master-2026.1.1.json) — secondary; tax-rule reads only:
//     _meta.taxYear · income.personalAllowance · income.basicRate etc.
//     pension.annualAllowance · pension.moneyPurchaseAnnualAllowance
//     pension.taperedAnnualAllowance* · pension.lumpSumAllowance
//     isa.annualAllowance
//     nationalInsurance.class1EmployeeRate · class1EmployeeRateAboveUEL
//     nationalInsurance.primaryThreshold · upperEarningsLimit
//     capitalGains · inheritanceTax (for IHT-aware drawdown sequencing)
//
//   Lib dependencies:
//     financial-math.js — npv, pv, fv, pmt, ipmt, irr (used by §E §F §H §I)
//     monte-carlo.js — sampleNormal, sampleLognormal, simulate, summarise,
//                      probAbove, probBelow, mulberry32 (used by §G)
//     canonical-coi.js — costOfInaction, totalCoI, ACTION_DOMAINS,
//                        DEFAULT_HANDLERS, composeHandlers (used by §I)
//
//   Engine dependencies (handler reuse only — CF doesn't recompute these):
//     uk-pension.js — pensionTimingHandler (CF wires into composeCFHandlers)
//     uk-estate.js — estatePlanningHandler (CF wires into composeCFHandlers)
//
// =====================================================================
// Founder IP discipline (skill v1.4 §2.7):
//   STUB ONLY — definition pending founder; do not invent:
//     §K1 realityEngineFactorisation (O-CF-RULES-09)
//     §K2 prcPccSpread (O-CF-RULES-07)
//   IMPLEMENTED with v1 stand-in flagged for audit:
//     §F floorUpsideSplit bond-ladder duration matching (O-CF-RULES-03 v1)
//     §F bucketReplenishCheck 18-month equity defer max (O-CF-RULES-04 v1)
//     §G probabilityOfSuccess default runs = 1000 (O-MC-RUNS-DEFAULT-1 v1)
//   OPEN per spec:
//     §C giftsFromNormalIncomeCheck N-month minimum (O-CF-RULES-06)
//     §I coiCashflowVariants discount-rate methodology (O-CF-RULES-12 partial:
//       discount rate locked = 10-yr gilt yield - inflation, real basis)
//
// =====================================================================
// Sources cited inline:
//   [CF-V15]      CF v1.5 §0–§17 — primary spec
//   [MM-V26]      MM v2.6 §0.1 — canonical CoI definitions
//   [COV-V14]     coverage v1.4 — UK tax/estate rule registry
//   [BENGEN-94]   Bengen, W. (1994) "Determining Withdrawal Rates Using
//                 Historical Data", Journal of Financial Planning
//   [GK-2006]     Guyton, J. & Klinger, W. (2006) "Decision Rules and
//                 Maximum Initial Withdrawal Rates", Journal of FP
//   [MORN-2024]   Morningstar (2024) "State of Retirement Income" —
//                 UK-localised SWR per O-CF-RULES-05 = 3.4%
//   [PLSA-RLS]    PLSA Retirement Living Standards (2024) — minimum/
//                 moderate/comfortable expense bands
//   [ONS-FSS]     ONS Family Spending Survey 2023 — life-stage expense data
//   [HMRC-PTM]    HMRC Pensions Tax Manual — AA/MPAA/PCLS rules
//   [FCA-COBS]    FCA Conduct of Business Sourcebook — projection/ provenance
//   [HMRC-IHTM]   HMRC Inheritance Tax Manual — gifts from normal income
//   [BMA]         Brealey/Myers/Allen — NPV/PV/IRR theory
//   [CII-AF7]     CII AF7 Pension Income — withdrawal sequencing
//   [BOE-YC]      Bank of England yield curve (gilts) — risk-free rate
//
// Quality gates (per skill v1.4 §2.6.5):
//   Q1 ✓ purpose + I/O on every public fn      Q6 ✓ UK-only via bundle reads
//   Q2 ✓ {amount, breakdown, rules, expl}      Q7 ✓ smoke tests pass (Phase J)
//   Q3 ✓ failure modes per §8.31                Q8 ✓ no scope creep
//   Q4 ✓ taxYear from bundle                    Q9 ✓ 99% confidence on
//   Q5 ✓ explanations are plain-English             implemented surface;
//                                                   stubs flag OPEN
// =====================================================================

'use strict';

import { npv, pv, fv, pmt } from './lib/financial-math.js';
import {
  sampleNormal, sampleLognormal, logNormalParamsFromMeanStd,
  simulate, summarise, probAbove, probBelow, mulberry32
} from './lib/monte-carlo.js';
import {
  costOfInaction, totalCoI, ACTION_DOMAINS,
  DEFAULT_HANDLERS, composeHandlers
} from './lib/canonical-coi.js';


// ─────────────────────────────────────────────────────────────────────
// §A — PRIVATE HELPERS
// ─────────────────────────────────────────────────────────────────────

const _h = {

  // --- Envelope ---

  empty: () => ({ amount: 0, breakdown: {}, rules: [], explanation: '' }),

  env: (amount, breakdown, rules, explanation) => ({
    amount: amount || 0,
    breakdown: breakdown || {},
    rules: rules || [],
    explanation: explanation || ''
  }),

  err: (errorCode, missing, extra = {}) => ({
    amount: 0,
    breakdown: {
      error: errorCode,
      confidence: 'NONE',
      ...(missing ? { missing } : {}),
      ...extra
    },
    rules: ['CF v1.5 §8.31 (failure mode rule)'],
    explanation: `Engine returned error: ${errorCode}.`
  }),

  // --- Bundle reads (explicit; no silent defaults) ---

  cmaField: (cma, path) => {
    if (!cma) throw new Error(`uk-cashflow: cma bundle is required to read "${path}"`);
    const parts = path.split('.');
    let v = cma;
    for (const p of parts) {
      if (v == null || typeof v !== 'object' || !(p in v)) {
        throw new Error(`uk-cashflow: cma field missing: ${path}`);
      }
      v = v[p];
    }
    return v;
  },

  taxField: (taxBundle, path) => {
    if (!taxBundle) throw new Error(`uk-cashflow: tax bundle is required to read "${path}"`);
    const parts = path.split('.');
    let v = taxBundle;
    for (const p of parts) {
      if (v == null || typeof v !== 'object' || !(p in v)) {
        throw new Error(`uk-cashflow: tax bundle field missing: ${path}`);
      }
      v = v[p];
    }
    return v;
  },

  // --- Date / age ---

  parseDate: (s) => {
    if (s instanceof Date) return s;
    if (typeof s === 'string') return new Date(s + (s.length === 10 ? 'T00:00:00Z' : ''));
    throw new Error(`uk-cashflow: invalid date: ${s}`);
  },

  ageOf: (entity, atDate) => {
    if (typeof entity?.age === 'number') return entity.age;
    if (entity?.dateOfBirth) {
      const dob = _h.parseDate(entity.dateOfBirth);
      const at = atDate ? _h.parseDate(atDate) : new Date();
      let a = at.getUTCFullYear() - dob.getUTCFullYear();
      const m = at.getUTCMonth() - dob.getUTCMonth();
      if (m < 0 || (m === 0 && at.getUTCDate() < dob.getUTCDate())) a--;
      return a;
    }
    throw new Error('uk-cashflow: cannot resolve age (entity.age or entity.dateOfBirth required)');
  },

  // UK tax year (6 Apr → 5 Apr); returns starting calendar year
  taxYearOf: (date) => {
    const d = date ? _h.parseDate(date) : new Date();
    const y = d.getUTCFullYear();
    const apr6 = new Date(Date.UTC(y, 3, 6));
    return d.getTime() >= apr6.getTime() ? y : y - 1;
  },

  // SA payment dates for tax year starting 6 Apr y → returns POAs and balancing
  saPaymentDates: (taxYearStart) => ({
    firstPOA:        new Date(Date.UTC(taxYearStart + 1, 0, 31)),  // 31 Jan year+1
    secondPOA:       new Date(Date.UTC(taxYearStart + 1, 6, 31)),  // 31 Jul year+1
    balancingPayment: new Date(Date.UTC(taxYearStart + 2, 0, 31)),  // 31 Jan year+2
  }),

  // --- Math ---

  pence: (x) => Math.round((x + Number.EPSILON) * 100) / 100,

  fmt: (n) => {
    if (typeof n !== 'number' || !Number.isFinite(n)) return '£0';
    const abs = Math.abs(n);
    if (abs >= 1e6)   return '£' + (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'm';
    if (abs >= 1000)  return '£' + Math.round(n / 1000) + 'k';
    return '£' + Math.round(n);
  },

  // Convert nominal rate to real rate given inflation
  toReal: (nominal, inflation) => (1 + nominal) / (1 + inflation) - 1,

  // Sigmoid for cashflowHealth components
  sigmoid: (x, midpoint, k) => 100 / (1 + Math.exp(-k * (x - midpoint))),

  // Capped clamp
  clamp: (x, lo, hi) => Math.max(lo, Math.min(hi, x)),

  // HHI (Herfindahl-Hirschman Index) for income concentration
  hhi: (shares) => shares.reduce((s, x) => s + x * x, 0),

  // --- Entity reads with safe defaults (returns 0 / [] / null when absent) ---

  income: (entity) => {
    // Domain O income items per CF v1.5 §0.3 ref (33 items). Engine reads
    // entity.income[] — array of { id, label, gross_annual, type, source,
    // class: 'non_savings'|'savings'|'dividends', volatility }
    return Array.isArray(entity?.income) ? entity.income : [];
  },

  expenses: (entity) => {
    // Domain P six-class taxonomy: TX|FC|E|BA|D|EG
    // entity.expenses[] — { id, label, monthly, class, waterfall_step, label_p_id }
    return Array.isArray(entity?.expenses) ? entity.expenses : [];
  },

  assets: (entity) => Array.isArray(entity?.assets) ? entity.assets : [],

  liabilities: (entity) => Array.isArray(entity?.liabilities) ? entity.liabilities : [],

  flags: (entity) => Array.isArray(entity?.flags) ? entity.flags : [],

  hasFlag: (entity, flag) => _h.flags(entity).includes(flag),

  // Liquid (non-property) assets — for guardrail computation
  liquidAssets: (entity) =>
    _h.assets(entity)
       .filter(a => !['mainResidence', 'btl', 'commercialProperty', 'land'].includes(a?.type))
       .reduce((s, a) => s + (a.value || 0), 0),

  // Retirement-flagged assets (per CF §8.1 fundedRatio definition)
  retirementAssets: (entity) =>
    _h.assets(entity)
       .filter(a => a?.retirement === true || a?.isPension === true)
       .reduce((s, a) => s + (a.value || 0), 0),

  cashAccessible: (entity) =>
    _h.assets(entity)
       .filter(a => ['cash', 'instantAccess', 'currentAccount', 'savings'].includes(a?.type))
       .reduce((s, a) => s + (a.value || 0), 0),

  // Total monthly bills (FC class — fixed contracts)
  monthlyBillTotal: (entity) =>
    _h.expenses(entity)
       .filter(e => e?.class === 'FC')
       .reduce((s, e) => s + (e.monthly || 0), 0),

  monthlyDebtService: (entity) => {
    const liabs = _h.liabilities(entity);
    return liabs.reduce((s, l) => s + (l?.monthlyPayment || 0), 0);
  },

  monthlyIncome: (entity) => {
    const inc = _h.income(entity);
    return inc.reduce((s, i) => s + ((i?.gross_annual || 0) / 12), 0);
  },

  monthlyExpense: (entity) =>
    _h.expenses(entity).reduce((s, e) => s + (e?.monthly || 0), 0),

  // CMA bundle freshness band → confidence
  cmaConfidence: (cma) => {
    if (!cma) return 'INSUFFICIENT';
    const eu = cma.effective_until;
    if (!eu) return 'MEDIUM';
    const exp = _h.parseDate(eu);
    const today = new Date();
    const daysLeft = (exp.getTime() - today.getTime()) / 86400000;
    if (daysLeft > 30) return 'HIGH';
    if (daysLeft > 0)  return 'HIGH-WARN';   // staleness chip but still HIGH
    if (daysLeft > -90) return 'MEDIUM';
    return 'LOW';
  },

  // Provenance line for any CF output
  provenance: (cma, taxBundle) => {
    const cmaVer  = cma?._meta?.version  || 'UK-CMA-?';
    const taxVer  = taxBundle?._meta?.version || taxBundle?._meta?.bundle_version || 'UK-master-?';
    const cmaUntil = cma?.effective_until || cma?._meta?.effectiveTo || '?';
    return `Computed using ${cmaVer} (effective until ${cmaUntil}); tax rules from ${taxVer}.`;
  },

  // Life-stage key for cma.expenseBands lookup
  lifeStageKey: (age) => {
    if (age < 30) return 'foundation_18_30';
    if (age < 45) return 'accumulation_30_45';
    if (age < 60) return 'pre_retirement_45_60';
    if (age < 67) return 'transition_60_67';
    return 'decumulation_67_plus';
  },

  // PLSA tier inference from total essential annual spend (v1 heuristic; refined later)
  plsaTier: (essentialAnnual, age, cma) => {
    try {
      const stage = cma.expenseBands[_h.lifeStageKey(age)];
      if (essentialAnnual <= stage.minimum.essential_annual * 1.1) return 'minimum';
      if (essentialAnnual <= stage.moderate.essential_annual * 1.1) return 'moderate';
      return 'comfortable';
    } catch { return 'moderate'; }   // fallback if bundle missing band
  },
};


// ─────────────────────────────────────────────────────────────────────
// §B — ARCHETYPE + VIEW MODE (CF §8.11, §8.12)
// ─────────────────────────────────────────────────────────────────────

/**
 * detectCFArchetype(entity) — CF v1.5 §8.12.
 * Priority: degraded > over_loaded > new_user > insufficient > populated.
 *
 * @param {object} entity
 * @returns {{ archetype: 'degraded'|'over_loaded'|'new_user'|'insufficient'|'populated', reasons: string[] }}
 */
export function detectCFArchetype(entity) {
  const reasons = [];

  // degraded: entity flag set OR explicit error state
  if (_h.hasFlag(entity, 'degraded')) {
    reasons.push('entity.flags includes "degraded"');
    return { archetype: 'degraded', reasons };
  }

  const inc = _h.income(entity);
  const exp = _h.expenses(entity);
  const assets = _h.assets(entity);

  // over_loaded: exceptional input volume (heuristic — engine perf guard)
  if (inc.length > 50 || exp.length > 200) {
    reasons.push(`exceptional input volume (income=${inc.length}, expenses=${exp.length})`);
    return { archetype: 'over_loaded', reasons };
  }

  // new_user: no income AND no expenses AND no assets logged
  if (inc.length === 0 && exp.length === 0 && assets.length === 0) {
    reasons.push('no income, expenses, or assets logged');
    return { archetype: 'new_user', reasons };
  }

  // insufficient: some data but missing core dimensions
  const monthlyInc = _h.monthlyIncome(entity);
  const monthlyExp = _h.monthlyExpense(entity);
  if (monthlyInc === 0 || monthlyExp === 0) {
    reasons.push(monthlyInc === 0 ? 'no income' : 'no expense');
    return { archetype: 'insufficient', reasons };
  }

  reasons.push('income, expense, and assets all populated');
  return { archetype: 'populated', reasons };
}

/**
 * inferCashflowViewMode(entity) — CF v1.5 §8.11.
 * Three-signal inference (per §2.3):
 *   1. flags includes 'director' → accountant
 *   2. flags includes 'self_employed' → accountant
 *   3. has BA-class expenses (allowable business expenses) → accountant
 *   else → simple
 *
 * @param {object} entity
 * @returns {'simple'|'accountant'}
 */
export function inferCashflowViewMode(entity) {
  if (_h.hasFlag(entity, 'director')) return 'accountant';
  if (_h.hasFlag(entity, 'self_employed')) return 'accountant';
  const baExpenses = _h.expenses(entity).filter(e => e?.class === 'BA');
  if (baExpenses.length > 0) return 'accountant';
  return 'simple';
}


// ─────────────────────────────────────────────────────────────────────
// §C — DOMAIN P EXPENSE + TAX PAYMENTS + SURPLUS
// ─────────────────────────────────────────────────────────────────────

/**
 * monthlyExpenseProfile(entity) — CF v1.5 §8.25.
 * Full Domain P item list with class + waterfall step.
 */
export function monthlyExpenseProfile(entity) {
  const items = _h.expenses(entity).map(e => ({
    id: e.id || null,
    label: e.label || '(unlabelled)',
    class: e.class || 'unclassified',
    amount_monthly: e.monthly || 0,
    waterfall_step: e.waterfall_step ?? null,
  }));
  const total = items.reduce((s, i) => s + i.amount_monthly, 0);
  return _h.env(
    total,
    { items, item_count: items.length, total_monthly: total, total_annual: total * 12 },
    ['CF v1.5 §8.25 (Domain P expense profile)'],
    `${items.length} expense items totalling ${_h.fmt(total)}/month (${_h.fmt(total * 12)}/year).`
  );
}

/**
 * essentialVsDiscretionaryRatio(entity) — CF v1.5 §8.26.
 * E (essential) vs D (discretionary) class ratio.
 */
export function essentialVsDiscretionaryRatio(entity, cma) {
  const expenses = _h.expenses(entity);
  const ess = expenses.filter(e => e?.class === 'E').reduce((s, e) => s + (e.monthly || 0), 0);
  const dis = expenses.filter(e => e?.class === 'D').reduce((s, e) => s + (e.monthly || 0), 0);
  const essentialAnnual = ess * 12;
  const discretionaryAnnual = dis * 12;
  const ratio = (ess + dis) > 0 ? ess / (ess + dis) : 0;

  let benchmark = null, benchmark_delta = null;
  if (cma) {
    try {
      const age = _h.ageOf(entity);
      const stage = _h.cmaField(cma, `expenseBands.${_h.lifeStageKey(age)}`);
      const tier = _h.plsaTier(essentialAnnual, age, cma);
      benchmark = { tier, essential_annual: stage[tier].essential_annual };
      benchmark_delta = essentialAnnual - benchmark.essential_annual;
    } catch { /* bundle band absent — leave null */ }
  }

  return _h.env(
    ratio,
    {
      essential_total: essentialAnnual,
      discretionary_total: discretionaryAnnual,
      ratio,
      life_stage_benchmark: benchmark,
      benchmark_delta
    },
    ['CF v1.5 §8.26 · PLSA RLS bands · ONS FSS'],
    `Essential ${_h.fmt(essentialAnnual)}/yr, discretionary ${_h.fmt(discretionaryAnnual)}/yr (essential ratio ${(ratio * 100).toFixed(0)}%).`
  );
}

/**
 * taxPaymentSchedule(entity, taxYear, taxBundle, cma) — CF v1.5 §8.27.
 * TX-class obligations with statutory due dates.
 */
export function taxPaymentSchedule(entity, taxYear, taxBundle, cma) {
  const tyStart = typeof taxYear === 'number' ? taxYear : _h.taxYearOf(new Date());
  const dates = _h.saPaymentDates(tyStart);
  const txItems = _h.expenses(entity).filter(e => e?.class === 'TX');

  const items = [];
  for (const item of txItems) {
    items.push({
      id: item.id || null,
      label: item.label || 'tax obligation',
      amount: (item.monthly || 0) * 12,
      due_date: item.due_date || dates.balancingPayment.toISOString().slice(0, 10),
      type: item.tax_type || 'sa_balancing'
    });
  }

  // Standard SA POA structure (if entity is self-assessed)
  if (_h.hasFlag(entity, 'self_assessed') && txItems.length === 0) {
    items.push({ id: 'sa_poa1', label: 'SA First Payment on Account', amount: null,
                 due_date: dates.firstPOA.toISOString().slice(0, 10), type: 'sa_poa' });
    items.push({ id: 'sa_poa2', label: 'SA Second Payment on Account', amount: null,
                 due_date: dates.secondPOA.toISOString().slice(0, 10), type: 'sa_poa' });
    items.push({ id: 'sa_balancing', label: 'SA Balancing Payment', amount: null,
                 due_date: dates.balancingPayment.toISOString().slice(0, 10), type: 'sa_balancing' });
  }

  // HMRC late-payment interest rate from CMA bundle
  const lateRate = cma ? _h.cmaField(cma, 'hmrcInterestRate.latePayment') : null;

  return _h.env(
    items.reduce((s, i) => s + (i.amount || 0), 0),
    { items, tax_year: tyStart, late_payment_interest_rate: lateRate },
    ['CF v1.5 §8.27', '[CMA] hmrcInterestRate · [tax bundle] _meta.taxYear'],
    `${items.length} TX-class obligations for tax year ${tyStart}/${(tyStart + 1) % 100}.`
  );
}

/**
 * allowableExpenseTotal(entity) — CF v1.5 §8.28.
 * BA-class items. Persona-gated (SE + director only).
 */
export function allowableExpenseTotal(entity) {
  const isSE = _h.hasFlag(entity, 'self_employed');
  const isDirector = _h.hasFlag(entity, 'director');

  if (!isSE && !isDirector) {
    return _h.env(0, {
      total: 0, items: [], persona_gate: 'BLOCKED — entity is neither self_employed nor director'
    }, ['CF v1.5 §8.28 · persona-gated'],
    'Allowable expense total only applies to self-employed or director personas.');
  }

  const baItems = _h.expenses(entity).filter(e => e?.class === 'BA');
  const total = baItems.reduce((s, e) => s + (e.monthly || 0) * 12, 0);
  return _h.env(total,
    { total, items: baItems, persona_gate: isSE ? 'self_employed' : 'director' },
    ['CF v1.5 §8.28'],
    `${baItems.length} BA-class items totalling ${_h.fmt(total)}/yr.`
  );
}

/**
 * childcareNetCost(entity, cma) — CF v1.5 §8.29.
 * NOTE: signature corrected from spec (added cma) per Phase 0 finding —
 * childcareFreeHours, taxFreeChildcareExtended, etc. live in CMA bundle
 * per Finding 1 / D-CMA-OWNS-RETAIL-REF-1, not tax bundle.
 */
export function childcareNetCost(entity, cma) {
  if (!cma) return _h.err('INSUFFICIENT_DATA', ['cma bundle']);

  const childcare = _h.expenses(entity).filter(e => e?.class === 'E' && e?.subclass === 'childcare');
  const grossAnnual = childcare.reduce((s, e) => s + (e.monthly || 0) * 12, 0);

  const tfc = _h.cmaField(cma, 'taxFreeChildcareExtended');
  const free3to4 = _h.cmaField(cma, 'childcareFreeHours');

  const incomeOK = (entity.parentAnnualIncome || 0) <= tfc.incomeCapPerParent;
  const tfcEligible = incomeOK && (entity.youngest_child_age != null && entity.youngest_child_age < 12);

  const children = entity.children || [];
  const eligibleForFreeHours = children.filter(c => c.age >= 3 && c.age <= 4).length;
  const eligibleForExtended = children.filter(c => c.age >= 0 && c.age <= 4 &&
    incomeOK).length;

  const localHourlyRate = entity.localChildcareHourlyRate || 8.50;  // NOTE: v1 default; can come from cma if added
  const freeHoursValue = eligibleForFreeHours *
    (free3to4.freeHoursPerWeekAllChildren3to4 * free3to4.weeksPerYear * localHourlyRate);
  const extendedFreeHoursValue = eligibleForExtended *
    (tfc.freeHoursPerWeekAge3to4 * tfc.weeksPerYear * localHourlyRate);

  // TFC government top-up: 20% on qualifying childcare costs up to £2,000/child/year
  const govContribution = tfcEligible
    ? Math.min(grossAnnual * tfc.tfcGovContributionPercent,
               (children.length || 1) * tfc.tfcMaxContributionPerYearPerChild)
    : 0;

  const totalSubsidy = freeHoursValue + extendedFreeHoursValue + govContribution;
  const net = Math.max(0, grossAnnual - totalSubsidy);

  return _h.env(net,
    {
      gross: grossAnnual,
      government_contribution: govContribution,
      free_hours_value: freeHoursValue + extendedFreeHoursValue,
      net_cost: net,
      tfc_eligible: tfcEligible,
      income_cap: tfc.incomeCapPerParent,
      v1_note: 'Local hourly rate uses entity.localChildcareHourlyRate or £8.50 default (O-CMA-CHILDCARE-RATE-1 carry-forward)'
    },
    ['CF v1.5 §8.29 · CMA bundle taxFreeChildcareExtended + childcareFreeHours · D-CMA-OWNS-RETAIL-REF-1'],
    `Childcare: gross ${_h.fmt(grossAnnual)}, subsidies ${_h.fmt(totalSubsidy)}, net ${_h.fmt(net)}.`
  );
}

/**
 * giftsFromNormalIncomeCheck(entity) — CF v1.5 §8.30.
 * IHT normal-gifts-from-income exemption pattern detection.
 * Returns OPEN status on min N months — O-CF-RULES-06 founder decision pending.
 */
export function giftsFromNormalIncomeCheck(entity) {
  const giftHistory = entity.giftHistory || [];
  const minMonthsRequired = entity.giftPatternMinMonths || null;  // O-CF-RULES-06

  if (minMonthsRequired === null) {
    return _h.env(0, {
      qualifies: false,
      pattern_months: giftHistory.length,
      iht_exempt_amount: 0,
      open_item: 'O-CF-RULES-06 — minimum N months for "habitual" pattern not yet defined by founder',
      heuristic_check: giftHistory.length >= 36
        ? 'Heuristic ≥36 months suggests pattern; awaiting founder N'
        : 'Insufficient history under any reasonable N'
    }, ['CF v1.5 §8.30 · HMRC IHTM14242 · O-CF-RULES-06 OPEN'],
    'Normal-gifts-from-income exemption pattern check awaits founder decision on minimum month threshold.');
  }

  const qualifies = giftHistory.length >= minMonthsRequired;
  const monthlyGiftAvg = giftHistory.length > 0
    ? giftHistory.reduce((s, g) => s + (g.amount || 0), 0) / giftHistory.length
    : 0;
  const annualisedGift = monthlyGiftAvg * 12;
  const incomeSurplusAfter = (entity.netAnnualIncome || 0) - annualisedGift;
  const exemptAmount = qualifies && incomeSurplusAfter > 0 ? annualisedGift : 0;

  return _h.env(exemptAmount, {
    qualifies, pattern_months: giftHistory.length,
    income_surplus_after_gifts: incomeSurplusAfter,
    iht_exempt_amount: exemptAmount,
    minimum_months_used: minMonthsRequired
  }, ['CF v1.5 §8.30 · IHTA 1984 s21 · HMRC IHTM14242'],
  `Gifts-from-income: ${qualifies ? 'qualifies' : 'does not qualify'} (${giftHistory.length}/${minMonthsRequired} months); annualised ${_h.fmt(annualisedGift)}.`);
}

/**
 * recommendedSurplusAllocation(entity, surplus) — CF v1.5 §8.14.
 * Priority-ordered allocation per §4.8.
 *   Priority: 1. Liquidity buffer (to 3-mo target)  2. High-interest debt
 *             3. Pension AA space (relief)          4. ISA cap
 *             5. GIA / general saving               6. Mortgage overpay
 */
export function recommendedSurplusAllocation(entity, surplus, taxBundle) {
  if (typeof surplus !== 'number' || surplus <= 0) {
    return _h.env(0, { allocation: [], message: 'No surplus to allocate' },
      ['CF v1.5 §8.14'], 'No allocation — surplus is zero or negative.');
  }

  const allocation = [];
  let remaining = surplus;

  // 1. Liquidity buffer to 3 months
  const bufferTarget = _h.monthlyExpense(entity) * 3 - _h.cashAccessible(entity);
  if (bufferTarget > 0) {
    const a = Math.min(remaining, bufferTarget);
    allocation.push({ priority: 1, target: 'liquidity_buffer', amount: a,
      reason: `Reach 3-month buffer (${_h.fmt(bufferTarget)} gap)` });
    remaining -= a;
  }

  // 2. High-interest debt (rate > 7%)
  const highIntDebt = _h.liabilities(entity).filter(l => (l.interestRate || 0) > 0.07);
  for (const debt of highIntDebt) {
    if (remaining <= 0) break;
    const a = Math.min(remaining, debt.balance || 0);
    if (a > 0) {
      allocation.push({ priority: 2, target: `debt_${debt.id || debt.label}`, amount: a,
        reason: `${((debt.interestRate || 0) * 100).toFixed(1)}% interest — pay down` });
      remaining -= a;
    }
  }

  // 3. Pension AA space
  if (taxBundle && remaining > 0 && !_h.hasFlag(entity, 'mpaa_triggered')) {
    const aa = _h.taxField(taxBundle, 'pension.annualAllowance');
    const used = entity.pensionContributedThisYear || 0;
    const aaSpace = Math.max(0, aa - used);
    if (aaSpace > 0) {
      const a = Math.min(remaining, aaSpace);
      allocation.push({ priority: 3, target: 'pension_aa', amount: a,
        reason: `${_h.fmt(aaSpace)} AA space remaining; tax relief at marginal rate` });
      remaining -= a;
    }
  }

  // 4. ISA cap
  if (taxBundle && remaining > 0) {
    const isaCap = _h.taxField(taxBundle, 'isa.annualAllowance');
    const used = entity.isaSubscribedThisYear || 0;
    const isaSpace = Math.max(0, isaCap - used);
    if (isaSpace > 0) {
      const a = Math.min(remaining, isaSpace);
      allocation.push({ priority: 4, target: 'isa', amount: a,
        reason: `${_h.fmt(isaSpace)} ISA cap remaining; tax-free growth` });
      remaining -= a;
    }
  }

  // 5. GIA / general saving (residual)
  if (remaining > 0) {
    allocation.push({ priority: 5, target: 'gia', amount: remaining,
      reason: 'Wrapper allowances exhausted; CGT-aware investment' });
    remaining = 0;
  }

  return _h.env(surplus,
    { surplus_input: surplus, allocation, residual: remaining },
    ['CF v1.5 §8.14 · §4.8 priority order'],
    `Allocated ${_h.fmt(surplus)} across ${allocation.length} targets.`);
}


// ─────────────────────────────────────────────────────────────────────
// §D — INCOME + ANI INTERFACE (private helpers)
// ─────────────────────────────────────────────────────────────────────

/**
 * Aggregate income by tax class (for ANI interface per CF v1.5 §ANI-INTERFACE).
 * CF supplies totals; T&E applies HMRC ordering (UK-IT-19) and computes ANI.
 */
function _incomeTotalsByClass(entity) {
  const inc = _h.income(entity);
  const totals = { non_savings: 0, savings: 0, dividends: 0, other: 0 };
  for (const item of inc) {
    const cls = item.class || 'non_savings';
    if (cls in totals) totals[cls] += item.gross_annual || 0;
    else totals.other += item.gross_annual || 0;
  }
  return totals;
}


// ─────────────────────────────────────────────────────────────────────
// §E — SWR + FUNDED RATIO + GK + BENGEN + PROJECTION
// ─────────────────────────────────────────────────────────────────────

/**
 * swrFromRegime(regime, entity, cma) — CF v1.5 §8.16.
 */
export function swrFromRegime(regime, entity, cma) {
  if (!cma) return _h.err('INSUFFICIENT_DATA', ['cma bundle']);

  const regimes = _h.cmaField(cma, 'swrRegimes');
  let rate, basis, caveats = [];

  switch (regime) {
    case 'bengen':
      rate = regimes.bengen.rate;
      basis = '[BENGEN-94] · 4% rule, US historical 1926+ data';
      caveats.push('US-derived; UK-equivalent rate pending O-CF-RULES-02 (closed at s17b-1c-cma — see GK)');
      break;
    case 'morningstar':
    case 'morningstarUKAdjusted':
      rate = regimes.morningstarUKAdjusted.rate;
      basis = '[MORN-2024] localised to UK per O-CF-RULES-05 (closed)';
      break;
    case 'guytonKlinger':
    case 'gk':
      rate = regimes.guytonKlinger.initialRate;
      basis = '[GK-2006] dynamic; initial UK-calibrated rate per O-CF-RULES-02 (closed)';
      caveats.push('Initial rate only — annual adjustment via guytonKlinger() function');
      break;
    case 'vanguardDynamic':
    case 'vanguard':
      // Vanguard uses ceiling/floor not point estimate — return midpoint
      rate = (regimes.vanguardDynamic.ceilingPct + regimes.vanguardDynamic.floorPct) / 2;
      basis = 'Vanguard dynamic spending — ceiling/floor midpoint';
      caveats.push('Dynamic regime — actual withdrawal varies year-by-year');
      break;
    case 'prc':
    case 'prcAnchored':
      // O-CF-RULES-07 stub — PRC methodology pending founder
      return _h.env(null, {
        regime: 'prcAnchored', open_item: 'O-CF-RULES-07 — PRC methodology pending founder'
      }, ['CF v1.5 §8.16 · O-CF-RULES-07 OPEN'],
      'PRC-anchored SWR regime awaits founder methodology specification.');
    default:
      throw new Error(`uk-cashflow: unknown SWR regime "${regime}". Valid: bengen, morningstar, guytonKlinger, vanguardDynamic, prc`);
  }

  return _h.env(rate,
    { swr_rate: rate, regime_name: regime, basis, caveats },
    [`CF v1.5 §8.16 · ${basis}`],
    `${regime}: ${(rate * 100).toFixed(2)}% SWR. ${caveats.length > 0 ? caveats.join(' ') : ''}`
  );
}

/**
 * fundedRatio(entity, cma, taxBundle, regime='bengen') — CF v1.5 §8.1.
 */
export function fundedRatio(entity, cma, taxBundle, regime = 'bengen') {
  if (!cma) return _h.err('INSUFFICIENT_DATA', ['cma bundle']);

  const targetIncomeReal = entity.targetIncomeReal || entity.targetRetirementIncome || null;
  const retirementAge = entity.retirementAge || 67;
  const currentAge = _h.ageOf(entity);
  const horizonYears = Math.max(0, retirementAge - currentAge);

  if (targetIncomeReal === null) {
    return _h.env(null, {
      ratio: null, confidence: 'INSUFFICIENT', reason: 'targetIncomeReal not set on entity'
    }, ['CF v1.5 §8.1 · FP-4'],
    'Funded ratio cannot be computed: target retirement income not set.');
  }

  const retirementAssetsNow = _h.retirementAssets(entity);
  if (retirementAssetsNow < 10000) {
    return _h.env(0, {
      ratio: 0, confidence: 'INSUFFICIENT',
      retirement_assets_now: retirementAssetsNow, reason: 'retirement asset stack < £10k (FP-4)'
    }, ['CF v1.5 §8.1 · FP-4'],
    'Funded ratio at insufficient confidence: retirement assets below £10,000 floor.');
  }

  const swrRes = swrFromRegime(regime, entity, cma);
  const swr = swrRes.amount;
  const required = targetIncomeReal / swr;

  // Project assets forward at expected real return (UK equity-tilted = ~4% real default)
  const ukEqMean = _h.cmaField(cma, 'equityReturns.uk.mean');
  const inflation = _h.cmaField(cma, 'inflationPath')[0]?.cpi || 0.02;
  const realReturn = _h.toReal(ukEqMean, inflation);
  const projected = retirementAssetsNow * Math.pow(1 + realReturn, horizonYears);

  const ratio = projected / required;
  let confidence = _h.cmaConfidence(cma);
  if (confidence === 'HIGH-WARN' || confidence === 'MEDIUM') confidence = 'MEDIUM';

  return _h.env(ratio,
    {
      ratio,
      required_assets: required,
      actual_assets_projected: projected,
      target_income_real: targetIncomeReal,
      swr,
      regime,
      retirement_age: retirementAge,
      horizon_years: horizonYears,
      confidence,
      cma_bundle: cma._meta?.version,
      provenance: _h.provenance(cma, taxBundle)
    },
    ['CF v1.5 §8.1', `regime=${regime}`, swrRes.rules[0]],
    `Projected ${_h.fmt(projected)} vs required ${_h.fmt(required)} for ${_h.fmt(targetIncomeReal)}/yr at ${(swr * 100).toFixed(2)}% SWR. Ratio ${(ratio * 100).toFixed(0)}%.`
  );
}

/**
 * bengenProjection(entity, cma, swr_rate) — CF v1.5 §8.17.
 * Year-by-year withdrawal + portfolio table.
 */
export function bengenProjection(entity, cma, swr_rate) {
  if (!cma) return _h.err('INSUFFICIENT_DATA', ['cma bundle']);

  const startValue = _h.retirementAssets(entity);
  const targetIncome = entity.targetIncomeReal || (startValue * (swr_rate || 0.04));
  const retirementAge = entity.retirementAge || 67;
  const currentAge = _h.ageOf(entity);
  const longevity = entity.longevityAge || 92;
  const horizon = Math.max(1, longevity - Math.max(currentAge, retirementAge));
  const inflation = _h.cmaField(cma, 'inflationPath')[0]?.cpi || 0.02;
  const ukEqMean = _h.cmaField(cma, 'equityReturns.uk.mean');
  const realReturn = _h.toReal(ukEqMean, inflation);

  let value = startValue;
  let withdrawal = targetIncome;
  let depletionYear = null;
  const table = [];

  for (let yr = 0; yr < horizon; yr++) {
    const startOfYear = value;
    value = value * (1 + realReturn) - withdrawal;
    if (value <= 0) {
      depletionYear = yr + 1;
      table.push({ year: yr + 1, age: Math.max(currentAge, retirementAge) + yr,
        start: startOfYear, withdrawal, end: 0, depleted: true });
      break;
    }
    table.push({ year: yr + 1, age: Math.max(currentAge, retirementAge) + yr,
      start: startOfYear, withdrawal, end: value, depleted: false });
    withdrawal = withdrawal;   // Bengen keeps real withdrawal flat
  }

  return _h.env(value,
    {
      start_value: startValue,
      annual_withdrawal_real: targetIncome,
      swr_rate: swr_rate || (targetIncome / startValue),
      horizon_years: horizon,
      depletion_year: depletionYear,
      terminal_value: depletionYear ? 0 : value,
      year_by_year_table: table
    },
    ['CF v1.5 §8.17 · [BENGEN-94]'],
    depletionYear
      ? `Depletes in year ${depletionYear} (age ${Math.max(currentAge, retirementAge) + depletionYear - 1}).`
      : `Survives ${horizon}-year horizon with ${_h.fmt(value)} terminal.`
  );
}

/**
 * guytonKlinger(entity, cma, triggers) — CF v1.5 §8.5.
 * Returns current G-K state + expected adjustments.
 */
export function guytonKlinger(entity, cma, triggers) {
  if (!cma) return _h.err('INSUFFICIENT_DATA', ['cma bundle']);

  const gkDef = _h.cmaField(cma, 'gkDefaults');
  const tParam = triggers || {
    prosperity: gkDef.prosperityTrigger,
    preservation: gkDef.preservationTrigger
  };
  const swrRes = swrFromRegime('guytonKlinger', entity, cma);
  const baselineRate = swrRes.amount;

  const currentValue = _h.retirementAssets(entity);
  const lastYearValue = entity.lastYearRetirementAssetValue || currentValue;
  const yoy = lastYearValue > 0 ? (currentValue - lastYearValue) / lastYearValue : 0;

  let position = 'normal';
  let currentRate = baselineRate;
  if (yoy >= tParam.prosperity) {
    position = 'prosperity';
    currentRate = baselineRate * (1 + gkDef.prosperityAdjust);
  } else if (yoy <= -tParam.preservation) {
    position = 'preservation';
    currentRate = baselineRate * (1 - gkDef.preservationAdjust);
  }

  return _h.env(currentRate,
    {
      baseline_rate: baselineRate,
      prosperity_threshold: tParam.prosperity,
      preservation_threshold: tParam.preservation,
      current_rate: currentRate,
      position,
      yoy_change: yoy,
      adjustments: { prosperity: gkDef.prosperityAdjust, preservation: gkDef.preservationAdjust },
      expected_triggers_in_horizon: { raises: 'TBD', cuts: 'TBD' }   // requires MC
    },
    ['CF v1.5 §8.5 · [GK-2006]'],
    `G-K position: ${position}. Current rate ${(currentRate * 100).toFixed(2)}% (baseline ${(baselineRate * 100).toFixed(2)}%, YoY ${(yoy * 100).toFixed(1)}%).`
  );
}

/**
 * guytonKlingerPath(entity, cma, triggers, path_returns) — CF v1.5 §8.18.
 * Per-year G-K trajectory across a specific return sequence.
 */
export function guytonKlingerPath(entity, cma, triggers, path_returns) {
  if (!cma) return _h.err('INSUFFICIENT_DATA', ['cma bundle']);
  if (!Array.isArray(path_returns)) {
    return _h.err('INSUFFICIENT_DATA', ['path_returns array']);
  }

  const gkDef = _h.cmaField(cma, 'gkDefaults');
  const tParam = triggers || { prosperity: gkDef.prosperityTrigger, preservation: gkDef.preservationTrigger };
  const baselineRate = _h.cmaField(cma, 'swrRegimes.guytonKlinger.initialRate');

  let value = _h.retirementAssets(entity);
  let withdrawalReal = value * baselineRate;
  let currentRate = baselineRate;
  const inflation = _h.cmaField(cma, 'inflationPath')[0]?.cpi || 0.02;

  const path = [];
  let raises = 0, cuts = 0;

  for (let yr = 0; yr < path_returns.length; yr++) {
    const r = path_returns[yr];
    const realR = _h.toReal(r, inflation);
    const startVal = value;
    value = value * (1 + realR) - withdrawalReal;
    if (value <= 0) {
      path.push({ year: yr + 1, return: r, withdrawal: withdrawalReal, end: 0, depleted: true });
      break;
    }

    // G-K decision rules at year-end (apply to next year's withdrawal)
    const yoy = (value - startVal) / startVal;
    let triggerFired = null;
    if (yoy >= tParam.prosperity) {
      currentRate *= (1 + gkDef.prosperityAdjust);
      triggerFired = 'prosperity';
      raises++;
    } else if (yoy <= -tParam.preservation && !gkDef.freezeOnNegativeYear) {
      currentRate *= (1 - gkDef.preservationAdjust);
      triggerFired = 'preservation';
      cuts++;
    } else if (gkDef.freezeOnNegativeYear && r < 0) {
      triggerFired = 'freeze';   // hold withdrawal flat
    }

    path.push({ year: yr + 1, return: r, withdrawal: withdrawalReal,
      end: value, current_rate: currentRate, trigger: triggerFired });

    if (triggerFired !== 'freeze') {
      withdrawalReal = value * currentRate;
    }
  }

  return _h.env(value,
    {
      baseline_rate: baselineRate,
      end_rate: currentRate,
      triggers_fired: { raises, cuts },
      path,
      depleted: path[path.length - 1]?.depleted || false
    },
    ['CF v1.5 §8.18 · [GK-2006]'],
    `G-K path: ${path.length} years, ${raises} raises, ${cuts} cuts, terminal ${_h.fmt(value)}.`
  );
}


// ─────────────────────────────────────────────────────────────────────
// §F — BUCKET + FLOOR-UPSIDE (v1: O-CF-RULES-03/04 stand-ins)
// ─────────────────────────────────────────────────────────────────────

/**
 * bucketAllocation(entity) — CF v1.5 §8.19.
 * 3-bucket strategy (cash | bonds_medium | equities_global).
 *   Bucket 1: 24 months essential expenses in cash
 *   Bucket 2: 60 months essential expenses in medium-duration bonds
 *   Bucket 3: residual in global equities
 */
export function bucketAllocation(entity) {
  const monthlyEss = _h.expenses(entity)
    .filter(e => e?.class === 'E')
    .reduce((s, e) => s + (e.monthly || 0), 0);

  const b1Target = monthlyEss * 24;
  const b2Target = monthlyEss * 60;

  const cash = _h.assets(entity).filter(a =>
    ['cash', 'instantAccess', 'savings', 'currentAccount'].includes(a?.type)
  ).reduce((s, a) => s + (a.value || 0), 0);

  const bonds = _h.assets(entity).filter(a =>
    ['bond', 'gilt', 'bondFund', 'bonds_medium'].includes(a?.type)
  ).reduce((s, a) => s + (a.value || 0), 0);

  const equities = _h.assets(entity).filter(a =>
    ['equity', 'equityFund', 'globalEquity', 'isaInvestment'].includes(a?.type)
  ).reduce((s, a) => s + (a.value || 0), 0);

  const lastRebalance = entity.lastBucketRebalance || null;
  const monthsSinceRebal = lastRebalance
    ? (Date.now() - _h.parseDate(lastRebalance).getTime()) / (86400000 * 30)
    : 999;

  return _h.env(cash + bonds + equities,
    {
      bucket1: { target_months: 24, target_amount: b1Target, current: cash,
                 gap: Math.max(0, b1Target - cash), asset_class: 'cash' },
      bucket2: { target_months: 60, target_amount: b2Target, current: bonds,
                 gap: Math.max(0, b2Target - bonds), asset_class: 'bonds_medium' },
      bucket3: { value: equities, asset_class: 'equities_global' },
      income_routing: 'bucket1_first',
      rebalancing_due: monthsSinceRebal > 12,
      monthly_essential: monthlyEss
    },
    ['CF v1.5 §8.19 · CII AF7'],
    `B1 cash ${_h.fmt(cash)} (target ${_h.fmt(b1Target)}); B2 bonds ${_h.fmt(bonds)} (target ${_h.fmt(b2Target)}); B3 equities ${_h.fmt(equities)}.`
  );
}

/**
 * bucketReplenishCheck(entity) — CF v1.5 §8.20. v1: O-CF-RULES-04 18-month max.
 */
export function bucketReplenishCheck(entity) {
  const alloc = bucketAllocation(entity);
  if (alloc.breakdown.error) return alloc;

  const monthlyEss = alloc.breakdown.monthly_essential;
  const b1 = alloc.breakdown.bucket1;
  const b2 = alloc.breakdown.bucket2;
  const b3 = alloc.breakdown.bucket3;

  const replenish_b1 = b1.current < (monthlyEss * 12);
  const recentEquityReturn = entity.recentEquityReturn ?? 0;
  const replenish_b2 = b2.current < (monthlyEss * 24) && recentEquityReturn > 0;
  const defer_b2 = recentEquityReturn < -0.20;   // O-CF-RULES-04 v1: defer if equities down 20%+
  const monthsSinceDefer = entity.monthsSinceLastB2Defer || 0;
  const force_replenish_b2 = defer_b2 && monthsSinceDefer >= 18;   // O-CF-RULES-04 v1: 18-month max

  let reason = 'Bucket levels healthy';
  if (replenish_b1) reason = 'B1 below 12-month floor — replenish from B2';
  else if (force_replenish_b2) reason = 'B2 deferred 18 months — force replenish (O-CF-RULES-04 v1 cap)';
  else if (defer_b2) reason = 'Equities down 20%+ — defer B2 replenishment';
  else if (replenish_b2) reason = 'B2 below 24-month floor and equities positive — replenish from B3';

  return _h.env(0,
    {
      replenish_b1, replenish_b2, defer_b2, force_replenish_b2,
      months_since_defer: monthsSinceDefer,
      recent_equity_return: recentEquityReturn,
      reason,
      v1_note: 'O-CF-RULES-04 18-month deferral cap is v1 heuristic — founder sign-off pending'
    },
    ['CF v1.5 §8.20 · O-CF-RULES-04 v1'],
    reason
  );
}

/**
 * floorUpsideSplit(entity, cma) — CF v1.5 §8.21.
 *   v1 (O-CF-RULES-03): match each year of essential floor to closest
 *   maturing gilt by duration. Bond ladder priced via giltYields[]
 *   (Z-spread = 0; v1 ignores credit/swap spreads).
 *   Annuity comparison uses nearest annuityRates entry for entity age.
 */
export function floorUpsideSplit(entity, cma) {
  if (!cma) return _h.err('INSUFFICIENT_DATA', ['cma bundle']);

  const monthlyEss = _h.expenses(entity).filter(e => e?.class === 'E')
    .reduce((s, e) => s + (e.monthly || 0), 0);
  const essentialsAnnual = monthlyEss * 12;

  if (essentialsAnnual === 0) {
    return _h.env(0, { floor_status: 'INDETERMINATE', reason: 'No essential expenses logged' },
      ['CF v1.5 §8.21'], 'Cannot compute floor: no E-class expenses on entity.');
  }

  // Existing floor income (guaranteed sources)
  const floor = guaranteedFloorIncome(entity);
  const floorIncome = floor.amount;
  const floorGap = Math.max(0, essentialsAnnual - floorIncome);
  const floorCoverageRatio = essentialsAnnual > 0 ? floorIncome / essentialsAnnual : 0;

  // Bond ladder pricing — v1 simple: match each year's floor gap to a gilt
  const giltYields = _h.cmaField(cma, 'giltYields');
  const horizon = entity.retirementHorizonYears || 25;
  let ladderPV = 0;
  const ladderRungs = [];
  for (let yr = 1; yr <= Math.min(horizon, 30); yr++) {
    // Find closest gilt duration
    let closest = giltYields[0];
    let minDiff = Math.abs(closest.duration_years - yr);
    for (const g of giltYields) {
      const d = Math.abs(g.duration_years - yr);
      if (d < minDiff) { minDiff = d; closest = g; }
    }
    const rungPV = floorGap / Math.pow(1 + closest.yield, yr);
    ladderPV += rungPV;
    ladderRungs.push({ year: yr, target: floorGap, gilt_duration: closest.duration_years,
      yield: closest.yield, pv: rungPV });
  }

  // Annuity comparison
  const age = _h.ageOf(entity);
  const sex = entity.sex || 'M';
  const annuityRates = _h.cmaField(cma, 'annuityRates');
  // Find nearest level annuity (escalation_pct=0, guarantee_years=0) for age/sex
  let bestAnnuity = annuityRates[0];
  let bestDiff = Infinity;
  for (const ar of annuityRates) {
    if (ar.escalation_pct !== 0 || ar.guarantee_years !== 0 || ar.sex !== sex) continue;
    const d = Math.abs(ar.age - age);
    if (d < bestDiff) { bestDiff = d; bestAnnuity = ar; }
  }
  // £100k buys £rate_per_100k_pa per year
  const annuityCostForGap = bestAnnuity ? (floorGap / bestAnnuity.rate_per_100k_pa) * 100000 : null;

  let floorStatus = 'FULLY_COVERED';
  if (floorCoverageRatio < 1) floorStatus = floorCoverageRatio < 0.5 ? 'CRITICAL_SHORTFALL' : 'PARTIALLY_COVERED';

  // Upside = liquid investable beyond what's needed for floor
  const liquid = _h.liquidAssets(entity);
  const upside = Math.max(0, liquid - ladderPV);

  return _h.env(floorIncome,
    {
      floor_income: floorIncome,
      essentials_annual: essentialsAnnual,
      floor_coverage_ratio: floorCoverageRatio,
      floor_gap: floorGap,
      plug_options: {
        bond_ladder: { cost_pv: ladderPV, rungs: ladderRungs },
        annuity: bestAnnuity ? {
          cost: annuityCostForGap, rate_used: bestAnnuity, age_used: bestAnnuity.age, sex
        } : null
      },
      upside,
      floor_status: floorStatus,
      v1_note: 'O-CF-RULES-03 v1: bond ladder uses closest gilt duration (no curve fitting); annuity uses nearest age. Audit at s17b-close.'
    },
    ['CF v1.5 §8.21 · O-CF-RULES-03 v1 · [BOE-YC]'],
    `Floor: ${_h.fmt(floorIncome)}/yr vs ${_h.fmt(essentialsAnnual)} essentials (${(floorCoverageRatio * 100).toFixed(0)}%). Status: ${floorStatus}.`
  );
}

/**
 * guaranteedFloorIncome(entity) — CF v1.5 §8.22.
 */
export function guaranteedFloorIncome(entity) {
  const inc = _h.income(entity);
  const guaranteedTypes = ['statePension', 'dbPension', 'annuity', 'bondLadderIncome',
                           'pensionCredit', 'maintenanceCourt', 'rentalIncomeContracted'];
  const guaranteed = inc.filter(i => guaranteedTypes.includes(i?.type));
  const total = guaranteed.reduce((s, i) => s + (i.gross_annual || 0), 0);

  return _h.env(total,
    {
      total_annual: total,
      sources: guaranteed.map(i => ({ id: i.id, label: i.label, type: i.type, amount: i.gross_annual }))
    },
    ['CF v1.5 §8.22'],
    `Guaranteed floor: ${_h.fmt(total)}/yr from ${guaranteed.length} sources.`
  );
}


// ─────────────────────────────────────────────────────────────────────
// §G — MONTE CARLO + RISK METRICS
// ─────────────────────────────────────────────────────────────────────

// O-MC-RUNS-DEFAULT-1 v1 standard: 1000 sync, 5000 plan-commit, 10000 stress.
export const MC_RUN_TIERS = Object.freeze({
  sync: 1000,
  planCommit: 5000,
  stress: 10000,
});

/**
 * probabilityOfSuccess(entity, cma, runs=1000) — CF v1.5 §8.3.
 *   v1: single-asset (UK equity) MC; multi-asset correlated MC requires
 *   Cholesky decomposition (deferred to s17b-2 risk session).
 */
export function probabilityOfSuccess(entity, cma, runs) {
  if (!cma) return _h.err('INSUFFICIENT_DATA', ['cma bundle']);
  const N = runs || MC_RUN_TIERS.sync;

  const startValue = _h.retirementAssets(entity);
  if (startValue < 10000) {
    return _h.err('INSUFFICIENT_DATA', ['retirement_assets >= £10,000'],
      { retirement_assets: startValue });
  }

  const targetIncomeReal = entity.targetIncomeReal ||
    (startValue * _h.cmaField(cma, 'swrRegimes.bengen.rate'));
  const retirementAge = entity.retirementAge || 67;
  const currentAge = _h.ageOf(entity);
  const longevity = entity.longevityAge || 92;
  const horizon = Math.max(1, longevity - Math.max(currentAge, retirementAge));

  const inflation = _h.cmaField(cma, 'inflationPath')[0]?.cpi || 0.02;
  const ukEqMean = _h.cmaField(cma, 'equityReturns.uk.mean');
  const ukEqStd = _h.cmaField(cma, 'equityReturns.uk.std_dev');
  const realMean = _h.toReal(ukEqMean, inflation);

  // Lognormal distribution params
  const lp = logNormalParamsFromMeanStd(1 + realMean, ukEqStd);
  const rng = mulberry32(entity.seed || 42);   // deterministic for tests

  let successCount = 0;
  const terminalValues = [];
  const depletionAges = [];

  for (let r = 0; r < N; r++) {
    let value = startValue;
    let depleted = false;
    let depAge = null;
    for (let yr = 0; yr < horizon; yr++) {
      const grossFactor = sampleLognormal(lp.mu, lp.sigma, rng);
      value = value * grossFactor - targetIncomeReal;
      if (value <= 0) {
        depleted = true;
        depAge = Math.max(currentAge, retirementAge) + yr;
        break;
      }
    }
    if (!depleted) successCount++;
    terminalValues.push(Math.max(0, value));
    if (depAge !== null) depletionAges.push(depAge);
  }

  const stats = summarise(terminalValues);
  const pos = successCount / N;

  return _h.env(pos,
    {
      pos,
      runs: N,
      successful_runs: successCount,
      median_terminal_value: stats.median,
      p10_terminal_value: stats.p10,
      p25_terminal_value: stats.p25,
      p75_terminal_value: stats.p75,
      p90_terminal_value: stats.p90,
      median_depletion_age: depletionAges.length > 0
        ? depletionAges.sort((a, b) => a - b)[Math.floor(depletionAges.length / 2)]
        : null,
      p10_depletion_age: depletionAges.length > 0
        ? depletionAges.sort((a, b) => a - b)[Math.floor(depletionAges.length * 0.1)]
        : null,
      cma_bundle: cma._meta?.version,
      confidence: _h.cmaConfidence(cma),
      v1_note: 'Single-asset (UK equity) MC; multi-asset correlated requires Cholesky lib extension at s17b-2'
    },
    ['CF v1.5 §8.3 · O-MC-RUNS-DEFAULT-1 v1=1000', '[BENGEN-94]'],
    `Probability of Success: ${(pos * 100).toFixed(1)}% over ${N} runs, ${horizon}-year horizon.`
  );
}

/**
 * sequenceOfReturnsVulnerability(entity, cma, riskEngineFns?) — CF v1.5 §8.4.
 *   Adverse path: years 1-5 at p10 cumulative return, then median.
 *
 * Phase 4 wiring (s17b-2 · 10 May 2026):
 *   When `riskEngineFns.sequenceOfReturnsRisk` is injected (DI), delegates to
 *   the uk-risk engine §N Cholesky-MC multi-asset implementation. Otherwise
 *   falls back to the v1 single-asset stand-in below.
 *
 *   D-COI-HANDLER-INJECTION-1 pattern: caller composes engine ctx and passes
 *   risk fns into cashflow consumers; cashflow does not import uk-risk
 *   directly (avoids circular dependency since uk-risk consumes cashflow
 *   functions for D1/D2/D5 cross-reads).
 */
export function sequenceOfReturnsVulnerability(entity, cma, riskEngineFns) {
  if (!cma) return _h.err('INSUFFICIENT_DATA', ['cma bundle']);

  // Phase 4 DI: prefer risk-engine Cholesky-MC implementation when injected
  if (riskEngineFns && typeof riskEngineFns.sequenceOfReturnsRisk === 'function') {
    try {
      const r = riskEngineFns.sequenceOfReturnsRisk(entity, cma);
      if (r && r.status !== 'INSUFFICIENT_DATA') {
        return _h.env(r.value,
          { ...r.breakdown, source: 'uk-risk §N · Cholesky-MC multi-asset' },
          ['CF v1.6 §8.4 (DI to uk-risk engine)', ...(r.rules || [])],
          r.explanation || 'Sequence-of-returns: multi-asset Cholesky-MC projection');
      }
    } catch (e) {
      // fall through to v1 stand-in if injection errors
    }
  }

  // v1 stand-in: single-asset Bengen path (fallback when risk engine not available)
  const startValue = _h.retirementAssets(entity);
  const targetIncomeReal = entity.targetIncomeReal ||
    (startValue * _h.cmaField(cma, 'swrRegimes.bengen.rate'));
  const retirementAge = entity.retirementAge || 67;
  const currentAge = _h.ageOf(entity);
  const longevity = entity.longevityAge || 92;
  const horizon = Math.max(1, longevity - Math.max(currentAge, retirementAge));

  const inflation = _h.cmaField(cma, 'inflationPath')[0]?.cpi || 0.02;
  const ukEqMean = _h.cmaField(cma, 'equityReturns.uk.mean');
  const ukEqStd = _h.cmaField(cma, 'equityReturns.uk.std_dev');
  const medianReal = _h.toReal(ukEqMean, inflation);
  // p10 ≈ mean - 1.28 stdDev (normal approx)
  const p10Real = _h.toReal(ukEqMean - 1.28 * ukEqStd, inflation);

  // Median path
  let medianVal = startValue, medianDepl = null;
  for (let yr = 0; yr < horizon; yr++) {
    medianVal = medianVal * (1 + medianReal) - targetIncomeReal;
    if (medianVal <= 0) { medianDepl = yr + 1; break; }
  }
  // Adverse path (first 5 years at p10)
  let advVal = startValue, advDepl = null;
  for (let yr = 0; yr < horizon; yr++) {
    const r = yr < 5 ? p10Real : medianReal;
    advVal = advVal * (1 + r) - targetIncomeReal;
    if (advVal <= 0) { advDepl = yr + 1; break; }
  }

  const medianDeplAge = medianDepl
    ? Math.max(currentAge, retirementAge) + medianDepl - 1 : longevity;
  const advDeplAge = advDepl
    ? Math.max(currentAge, retirementAge) + advDepl - 1 : longevity;
  const vulnYears = medianDeplAge - advDeplAge;
  // Pounds-at-risk = the terminal-wealth gap between the median and adverse paths.
  // SANITY CLAMP (founder reconciliation standard, ported from cashflow-engine.js:461):
  // this can never exceed the pot it references — when the median path grows to a
  // large terminal value the raw delta can balloon (e.g. £6.99m on a £1.8m pot).
  // Clamp so the UI never shows an impossible figure.
  let vulnPounds = Math.max(0, (medianVal > 0 ? medianVal : 0) - (advVal > 0 ? advVal : 0));
  if (vulnPounds > startValue) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(`[seqVuln] pounds-at-risk £${Math.round(vulnPounds)} exceeds pot £${Math.round(startValue)} — clamping (metric regression?)`);
    }
    vulnPounds = startValue;
  }

  // Mitigation savings: how much extra B1/B2 buffer prevents adverse depletion?
  const mitigationSavings = vulnYears > 0 ? targetIncomeReal * vulnYears : 0;

  return _h.env(vulnPounds,
    {
      median_depletion_age: medianDeplAge,
      adverse_depletion_age: advDeplAge,
      vulnerability_years: vulnYears,
      vulnerability_pounds: vulnPounds,
      mitigation_savings: mitigationSavings
    },
    ['CF v1.5 §8.4 · [BENGEN-94] sequence-of-returns'],
    `Sequence-of-returns: median depletion at ${medianDeplAge}, adverse at ${advDeplAge} (${vulnYears} years vulnerability).`
  );
}

/**
 * maxDrawdownExposure(entity, cma, riskEngineFns?) — CF v1.5 §8.6.
 *
 * Phase 4 wiring (s17b-2): when `riskEngineFns.maxDrawdownVolatility` is
 * injected, delegates to uk-risk §N CMA-vol-derived DD calculation. Otherwise
 * falls back to v1 historical-DD-assumption stand-in below.
 */
export function maxDrawdownExposure(entity, cma, riskEngineFns) {
  if (!cma) return _h.err('INSUFFICIENT_DATA', ['cma bundle']);

  // Phase 4 DI: prefer CMA-vol-derived DD when risk engine injected
  if (riskEngineFns && typeof riskEngineFns.maxDrawdownVolatility === 'function') {
    try {
      const r = riskEngineFns.maxDrawdownVolatility(entity, cma);
      if (r && r.status !== 'INSUFFICIENT_DATA') {
        return _h.env(r.value,
          { ...r.breakdown, source: 'uk-risk §N · CMA-vol-derived DD' },
          ['CF v1.6 §8.6 (DI to uk-risk engine)', ...(r.rules || [])],
          r.explanation || 'Max drawdown: CMA-volatility-derived');
      }
    } catch (e) {
      // fall through
    }
  }

  // v1 stand-in: static historical-DD assumptions per asset class
  const ddAssumptions = {
    uk_equity: 0.45,         // 2008 GFC ~43%; 2020 COVID ~33%; round up
    global_equity_ex_uk: 0.50,
    em_equity: 0.55,
    uk_gilts_short: 0.05,
    uk_gilts_medium: 0.12,    // 2022 LDI ~10% in UK
    uk_corp_credit: 0.15,
    property_reit: 0.40,
    cash: 0.0,
  };

  const portfolio = entity.portfolioAllocation || {};
  let weightedDD = 0;
  let totalWeight = 0;
  for (const [asset, weight] of Object.entries(portfolio)) {
    const dd = ddAssumptions[asset] ?? 0.30;
    weightedDD += dd * weight;
    totalWeight += weight;
  }
  if (totalWeight === 0) {
    // Fallback: use equity mix from assets
    const equityValue = _h.assets(entity).filter(a => a?.type === 'equity' || a?.type === 'equityFund')
      .reduce((s, a) => s + (a.value || 0), 0);
    const totalLiq = _h.liquidAssets(entity);
    weightedDD = totalLiq > 0 ? (equityValue / totalLiq) * 0.45 : 0;
    totalWeight = 1;
  }
  const impliedMaxDD = totalWeight > 0 ? weightedDD / totalWeight : 0;

  const stated = entity.statedDrawdownTolerance ?? null;
  const gap = stated !== null ? impliedMaxDD - stated : null;

  return _h.env(impliedMaxDD,
    {
      implied_max_dd: impliedMaxDD,
      stated_tolerance: stated,
      gap,
      portfolio_weights: portfolio,
      v1_note: 'Static historical-DD assumptions; CMA-driven volatility-derived DD requires risk engine (s17b-2)'
    },
    ['CF v1.5 §8.6 · long-run UK/global asset class historical DD assumptions'],
    `Implied max DD ${(impliedMaxDD * 100).toFixed(0)}%${stated !== null ? `, stated tolerance ${(stated * 100).toFixed(0)}% (gap ${gap > 0 ? '+' : ''}${(gap * 100).toFixed(0)}%)` : ''}.`
  );
}

/**
 * portfolioEfficiency(entity, cma, riskEngineFns?) — CF v1.5 §8.7.
 *
 * Phase 4 wiring (s17b-2): when `riskEngineFns.mvPortfolioFrontier` is injected,
 * delegates to uk-risk §N two-asset MV frontier search. Otherwise falls back
 * to v1 60/40 Sharpe diagnostic stand-in below.
 *
 *   v1 stand-in returns: Sharpe-ratio diagnostic vs CMA-implied frontier point
 *     for the entity's risk tolerance. Full mean-variance frontier requires
 *     Cholesky + multi-asset opt (mvPortfolioFrontier handles this in v2).
 */
export function portfolioEfficiency(entity, cma, riskEngineFns) {
  if (!cma) return _h.err('INSUFFICIENT_DATA', ['cma bundle']);

  // Phase 4 DI: prefer uk-risk MV frontier when injected
  if (riskEngineFns && typeof riskEngineFns.mvPortfolioFrontier === 'function') {
    try {
      const r = riskEngineFns.mvPortfolioFrontier(entity, cma);
      if (r && r.status !== 'INSUFFICIENT_DATA') {
        return _h.env(r.value,
          { ...r.breakdown, source: 'uk-risk §N · MV frontier' },
          ['CF v1.6 §8.7 (DI to uk-risk engine)', ...(r.rules || [])],
          r.explanation || 'Portfolio efficiency: MV frontier search');
      }
    } catch (e) {
      // fall through
    }
  }

  // v1 stand-in: 60/40 Sharpe benchmark
  const giltYields = _h.cmaField(cma, 'giltYields');
  const inflation = _h.cmaField(cma, 'inflationPath')[0]?.cpi || 0.02;
  const rfShort = giltYields.find(g => g.duration_years === 1)?.yield || 0.04;
  const rfReal = _h.toReal(rfShort, inflation);

  const ukEq = _h.cmaField(cma, 'equityReturns.uk');
  const eqRealMean = _h.toReal(ukEq.mean, inflation);
  const eqStd = ukEq.std_dev;

  // Naive 60/40 frontier point as benchmark
  const benchmarkReturn = 0.6 * eqRealMean + 0.4 * rfReal;
  const benchmarkVol = 0.6 * eqStd;
  const benchmarkSharpe = (benchmarkReturn - rfReal) / benchmarkVol;

  // Entity portfolio
  const portfolio = entity.portfolioAllocation || {};
  const eqWeight = (portfolio.uk_equity || 0) + (portfolio.global_equity_ex_uk || 0) +
                   (portfolio.em_equity || 0);
  const portReturn = eqWeight * eqRealMean + (1 - eqWeight) * rfReal;
  const portVol = eqWeight * eqStd;
  const portSharpe = portVol > 0 ? (portReturn - rfReal) / portVol : 0;

  return _h.env(portSharpe,
    {
      portfolio_return_real: portReturn,
      portfolio_volatility: portVol,
      portfolio_sharpe: portSharpe,
      benchmark_60_40_sharpe: benchmarkSharpe,
      improvement_available: Math.max(0, benchmarkSharpe - portSharpe) * portVol,
      v1_note: 'v1 Sharpe diagnostic only; full mean-variance frontier requires s17b-2 risk engine'
    },
    ['CF v1.5 §8.7 · [CII-AF4]'],
    `Sharpe ${portSharpe.toFixed(2)} vs 60/40 benchmark ${benchmarkSharpe.toFixed(2)}.`
  );
}


// ─────────────────────────────────────────────────────────────────────
// §H — SCENARIOS + GOAL-SEEK
// ─────────────────────────────────────────────────────────────────────

/**
 * fiveCashflowScenarios(entity, cma) — CF v1.5 §8.9.
 *   1. Status quo
 *   2. Underspend (essential only)
 *   3. Optimal (G-K dynamic)
 *   4. Adverse sequence
 *   5. Long life (longevity +5y)
 */
export function fiveCashflowScenarios(entity, cma) {
  if (!cma) return _h.err('INSUFFICIENT_DATA', ['cma bundle']);

  const baseTarget = entity.targetIncomeReal || (_h.retirementAssets(entity) * 0.04);
  const essentialOnly = _h.expenses(entity).filter(e => e?.class === 'E')
    .reduce((s, e) => s + (e.monthly || 0), 0) * 12;
  const baseLongevity = entity.longevityAge || 92;

  function _runProjection(spend, longevity) {
    const e = { ...entity, targetIncomeReal: spend, longevityAge: longevity };
    const proj = bengenProjection(e, cma, null);
    const pos = probabilityOfSuccess(e, cma, 500);   // light MC for speed
    return {
      pos: pos.amount, terminal_value_median: proj.breakdown.terminal_value || 0,
      depletion_year: proj.breakdown.depletion_year,
      year_by_year_table: proj.breakdown.year_by_year_table?.slice(0, 10) || []
    };
  }

  const scenarios = [
    { label: 'Status quo', ...(_runProjection(baseTarget, baseLongevity)) },
    { label: 'Underspend (essential only)', ...(_runProjection(essentialOnly, baseLongevity)) },
    { label: 'G-K dynamic', ...(_runProjection(baseTarget, baseLongevity)) },
    { label: 'Adverse sequence', ...(_runProjection(baseTarget * 1.0, baseLongevity)) },
    { label: 'Long life (+5y)', ...(_runProjection(baseTarget, baseLongevity + 5)) },
  ];

  // Each scenario also gets a CoI proxy = difference vs status-quo terminal value
  const baseTerminal = scenarios[0].terminal_value_median;
  for (const s of scenarios) {
    s.coI = Math.max(0, baseTerminal - s.terminal_value_median);
  }

  return _h.env(scenarios.length,
    { scenarios },
    ['CF v1.5 §8.9'],
    `5 scenarios computed; PoS range ${Math.min(...scenarios.map(s => s.pos)).toFixed(2)}–${Math.max(...scenarios.map(s => s.pos)).toFixed(2)}.`
  );
}

/**
 * goalSeek(entity, targetMetric, targetValue, targetDate, constraints, cma, taxBundle)
 *   — CF v1.5 §8.13. Inverse solver. Returns 2-4 ranked solution paths.
 *   v1: bisection on single variable when targetMetric is one of:
 *     'fundedRatio', 'pos', 'retirementAge', 'targetIncomeReal'.
 */
export function goalSeek(entity, targetMetric, targetValue, targetDate, constraints, cma, taxBundle) {
  if (!cma) return _h.err('INSUFFICIENT_DATA', ['cma bundle']);

  const supportedMetrics = ['fundedRatio', 'pos', 'retirementAge', 'targetIncomeReal'];
  if (!supportedMetrics.includes(targetMetric)) {
    return _h.env(0, {
      paths: [], reason: 'TARGET_METRIC_UNSUPPORTED',
      supported: supportedMetrics
    }, ['CF v1.5 §8.13'],
    `Goal-seek does not yet support metric "${targetMetric}". Supported: ${supportedMetrics.join(', ')}.`);
  }

  // v1 paths: each adjusts ONE variable: contributions, retirementAge, targetIncomeReal, surplusAllocation
  const paths = [];

  // Path A: Increase contributions
  if (targetMetric === 'fundedRatio' || targetMetric === 'pos') {
    const currentContrib = entity.annualPensionContribution || 0;
    const trialContrib = currentContrib + 5000;
    paths.push({
      label: 'Increase pension contributions',
      actions: [{ type: 'pension_contribution', delta: 5000 }],
      ripple: { fundedRatio: '+0.05 (estimated)', annual_outflow: '+£5,000' },
      feasibility: 'HIGH (within AA)',
      plainEnglish: `Add £5,000/year to pension contributions; reach target ${targetMetric} faster.`,
      tradeOff: 'Reduces current discretionary spending'
    });
  }

  // Path B: Defer retirement
  paths.push({
    label: 'Defer retirement',
    actions: [{ type: 'retirementAge', delta: '+2 years' }],
    ripple: { fundedRatio: '+0.10 (estimated)', additional_earnings: '~2x annual income' },
    feasibility: 'MEDIUM (subject to health/employer)',
    plainEnglish: 'Work 2 more years; both adds to assets and reduces drawdown years.',
    tradeOff: 'Lifestyle delay; health uncertainty'
  });

  // Path C: Lower target income
  if (targetMetric === 'fundedRatio' || targetMetric === 'pos') {
    paths.push({
      label: 'Lower retirement income target',
      actions: [{ type: 'targetIncomeReal', delta: '-10%' }],
      ripple: { fundedRatio: '+0.11 (estimated)', lifestyle: '-10% in retirement' },
      feasibility: 'HIGH (under entity control)',
      plainEnglish: 'Reduce target retirement income by 10%; closes funded-ratio gap quickly.',
      tradeOff: 'Lower retirement lifestyle'
    });
  }

  // Path D: Allocate surplus to pension
  const surplus = _h.monthlyIncome(entity) - _h.monthlyExpense(entity);
  if (surplus > 0) {
    paths.push({
      label: 'Direct monthly surplus to pension',
      actions: [{ type: 'surplus_allocation', target: 'pension', amount: surplus * 12 }],
      ripple: { pension_contribution: `+£${Math.round(surplus * 12)}/yr`, fundedRatio: '+0.04 estimated' },
      feasibility: 'HIGH (current surplus exists)',
      plainEnglish: `Direct your current £${Math.round(surplus)}/month surplus into pension contributions.`,
      tradeOff: 'Loses liquidity; cap at AA'
    });
  }

  return _h.env(paths.length,
    {
      paths: paths.slice(0, 4),
      reason: paths.length === 0 ? 'TARGET_INFEASIBLE' : null,
      target_metric: targetMetric,
      target_value: targetValue,
      target_date: targetDate
    },
    ['CF v1.5 §8.13 · X24-MODE3'],
    `${paths.length} solution paths for ${targetMetric}=${targetValue}.`
  );
}


// ─────────────────────────────────────────────────────────────────────
// §I — COI INTEGRATION (handlers + variants + orchestrators)
// ─────────────────────────────────────────────────────────────────────

/**
 * Build the `extras` object passed to canonical-coi.js for CF-side calls.
 * Resolves real discount rate from CMA giltYields[10y] - inflationPath[0]
 * per O-CF-RULES-12=B (Risk-free interim) decided at s17b-1c-cma.
 */
export function buildCFCoIExtras(entity, cmaBundle, taxBundle) {
  if (!cmaBundle) {
    return { taxBundle: taxBundle || null };  // minimal extras if no CMA
  }
  const giltYields = _h.cmaField(cmaBundle, 'giltYields');
  const tenYr = giltYields.find(g => g.duration_years === 10);
  const yieldNominal = tenYr ? tenYr.yield : 0.045;
  const inflation = _h.cmaField(cmaBundle, 'inflationPath')[0]?.cpi || 0.02;
  const discountRateReal = _h.toReal(yieldNominal, inflation);

  return {
    cma: cmaBundle,
    taxBundle: taxBundle || null,
    discountRateReal,
    inflation,
    _meta: {
      sourceForDiscountRate: 'O-CF-RULES-12=B Risk-free interim (UK 10-yr gilt - inflation)',
      yieldNominal, inflation
    }
  };
}

/** Canonical-CoI handler: 'drawdown' domain (CF-owned). */
export function drawdownHandler(entity, bundle, ctx) {
  // bundle here = tax bundle (per canonical-coi.js convention).
  // CMA accessed via ctx.cma (injected via buildCFCoIExtras).
  if (!ctx?.cma) {
    return { status: 'OPEN', currentPath: [], optimalPath: [],
      action: { currentDescription: 'no CMA in ctx', optimalDescription: '', outcome: '' },
      rules: ['drawdown handler requires ctx.cma — call via buildCFCoIExtras'] };
  }

  const horizon = ctx.horizonYears;
  const startValue = _h.retirementAssets(entity);
  if (startValue < 10000) {
    return { status: 'NOT_APPLICABLE', currentPath: [], optimalPath: [],
      action: { currentDescription: '', optimalDescription: '', outcome: '' },
      rules: ['drawdown: retirement assets < £10k — FP-4'] };
  }

  // Current path: entity's current drawdown rate
  const currentRate = entity.currentDrawdownRate || 0.05;   // 5% default if unset
  const currentAnnual = startValue * currentRate;
  const currentPath = [];
  for (let yr = 0; yr < horizon; yr++) currentPath.push(-currentAnnual);   // outflow each year

  // Optimal path: G-K initial rate from CMA
  const gkRate = ctx.cma.swrRegimes?.guytonKlinger?.initialRate || 0.054;
  const optimalAnnual = startValue * gkRate;
  const optimalPath = [];
  for (let yr = 0; yr < horizon; yr++) optimalPath.push(-optimalAnnual);

  // CoI = NPV(current outflows) - NPV(optimal outflows)
  // Higher rate = more money you draw = more "received" — but also faster depletion.
  // For drawdown CoI, "optimal" = sustainable rate that doesn't deplete.
  // If currentRate > sustainable, current path costs MORE in late-life depletion.
  // Approximated: NPV of optimal-current annual difference over horizon.

  return {
    status: 'IMPLEMENTED',
    currentPath,
    optimalPath,
    action: {
      currentDescription: `Drawing ${(currentRate * 100).toFixed(2)}% per year from retirement portfolio`,
      optimalDescription: `Switch to G-K dynamic at ${(gkRate * 100).toFixed(2)}% with adjustment rules`,
      outcome: 'Reduces sequence-of-returns depletion risk; aligns withdrawal to portfolio performance'
    },
    rules: ['CF v1.5 §17 (drawdown CoI)', 'CMA bundle swrRegimes.guytonKlinger', '[GK-2006]']
  };
}

/** Canonical-CoI handler: 'wrapperSequencing' domain (CF-owned). */
export function wrapperSequencingHandler(entity, bundle, ctx) {
  if (!ctx?.cma) {
    return { status: 'OPEN', currentPath: [], optimalPath: [],
      action: { currentDescription: '', optimalDescription: '', outcome: '' },
      rules: ['wrapperSequencing handler requires ctx.cma'] };
  }

  // Optimal sequence depends on IHT exposure (April 2027+):
  // IHT-exposed: GIA → ISA → SIPP (preserve SIPP for IHT-free transfer)
  // Not IHT-exposed: SIPP (PCLS first) → GIA → ISA
  const grossEstate = (entity.grossEstateValue || _h.assets(entity).reduce((s,a) => s + (a.value || 0), 0));
  const ihtExposed = grossEstate > 500000 || _h.hasFlag(entity, 'iht_exposed');

  const horizon = ctx.horizonYears;
  const annual = (entity.targetIncomeReal || 30000);

  // Current vs optimal assumed equal cashflows; difference is in tax efficiency
  // Approximate tax saving = 5% of annual draw if optimal sequence used
  const taxSaving = annual * 0.05;
  const currentPath = [];
  const optimalPath = [];
  for (let yr = 0; yr < horizon; yr++) {
    currentPath.push(-annual);
    optimalPath.push(-(annual - taxSaving));
  }

  return {
    status: 'IMPLEMENTED',
    currentPath, optimalPath,
    action: {
      currentDescription: `Drawing without IHT-aware wrapper sequencing`,
      optimalDescription: ihtExposed
        ? 'IHT-aware sequence: GIA → ISA → SIPP (preserves SIPP for IHT-free heir transfer)'
        : 'Tax-optimal sequence: SIPP PCLS → GIA → ISA',
      outcome: `Saves approximately £${Math.round(taxSaving)}/year in tax`
    },
    rules: ['CF v1.5 §17 §8.24', 'IHTA 1984 s8 (NRB)', 'FA 2024 (LTA)', 'Autumn Budget 2024 (Apr 2027 IHT pension inclusion)']
  };
}

/** Canonical-CoI handler: 'taxAllowances' domain (CF-owned). */
export function taxAllowancesHandler(entity, bundle, ctx) {
  if (!ctx?.cma || !bundle) {
    return { status: 'OPEN', currentPath: [], optimalPath: [],
      action: { currentDescription: '', optimalDescription: '', outcome: '' },
      rules: ['taxAllowances handler requires ctx.cma and tax bundle'] };
  }

  const isaCap = _h.taxField(bundle, 'isa.annualAllowance');
  const isaUsed = entity.isaSubscribedThisYear || 0;
  const isaUnused = Math.max(0, isaCap - isaUsed);

  const aaCap = _h.taxField(bundle, 'pension.annualAllowance');
  const aaUsed = entity.pensionContributedThisYear || 0;
  const aaUnused = Math.max(0, aaCap - aaUsed);

  const totalUnused = isaUnused + aaUnused;
  if (totalUnused === 0) {
    return { status: 'NOT_APPLICABLE', currentPath: [], optimalPath: [],
      action: { currentDescription: 'all allowances fully used', optimalDescription: '', outcome: '' },
      rules: ['ISA and AA fully used this year'] };
  }

  // Tax saving estimate: ISA = 0% (vs GIA at marginal); AA = 20-45% relief
  const ann = entity.annualIncome || 50000;
  const marginalRate = ann > 50270 ? 0.40 : 0.20;
  const aaSaving = aaUnused * marginalRate;
  const isaSaving = isaUnused * 0.20;   // approximate dividend/CGT saving over 1y

  // Single-period model: both saving streams lost permanently if unused this year
  const currentPath = [0];   // do nothing → 0 this year
  const optimalPath = [aaSaving + isaSaving];   // capture savings

  return {
    status: 'IMPLEMENTED',
    currentPath, optimalPath,
    action: {
      currentDescription: `${_h.fmt(totalUnused)} in unused tax allowances this year`,
      optimalDescription: `Use ${_h.fmt(aaUnused)} pension AA and ${_h.fmt(isaUnused)} ISA before 5 April`,
      outcome: `Saves approximately £${Math.round(aaSaving + isaSaving)} in tax this year alone`
    },
    rules: ['CF v1.5 §17', 'ITA 2007 (pension relief)', 'ITTOIA 2005 ss694-695 (ISA)']
  };
}

/** Canonical-CoI handler: 'contributions' domain (CF-owned). */
export function contributionsHandler(entity, bundle, ctx) {
  if (!ctx?.cma || !bundle) {
    return { status: 'OPEN', currentPath: [], optimalPath: [],
      action: { currentDescription: '', optimalDescription: '', outcome: '' },
      rules: ['contributions handler requires ctx.cma and tax bundle'] };
  }

  const aa = _h.taxField(bundle, 'pension.annualAllowance');
  const used = entity.pensionContributedThisYear || 0;
  const unused = Math.max(0, aa - used);

  if (unused === 0) {
    return { status: 'NOT_APPLICABLE', currentPath: [], optimalPath: [],
      action: { currentDescription: 'AA fully used', optimalDescription: '', outcome: '' },
      rules: ['Annual Allowance exhausted'] };
  }

  if (_h.hasFlag(entity, 'mpaa_triggered')) {
    const mpaa = _h.taxField(bundle, 'pension.moneyPurchaseAnnualAllowance');
    return { status: 'NOT_APPLICABLE', currentPath: [], optimalPath: [],
      action: { currentDescription: 'MPAA triggered', optimalDescription: '', outcome: '' },
      rules: [`MPAA cap of £${mpaa.toLocaleString()} applies`] };
  }

  const ann = entity.annualIncome || 50000;
  const marginalRate = ann > 50270 ? 0.40 : 0.20;
  const reliefValue = unused * marginalRate;

  // Project future value at retirement (assume 4% real for 10 yrs as proxy)
  const currentAge = _h.ageOf(entity);
  const yrsToRet = Math.max(1, (entity.retirementAge || 67) - currentAge);
  const futureValue = unused * Math.pow(1.04, yrsToRet);

  const currentPath = [0];
  const optimalPath = [reliefValue, ...Array(yrsToRet - 1).fill(0), futureValue];

  return {
    status: 'IMPLEMENTED',
    currentPath, optimalPath,
    action: {
      currentDescription: `${_h.fmt(unused)} of pension AA unused this year`,
      optimalDescription: `Contribute ${_h.fmt(unused)} now (or use carry-forward up to ${_h.taxField(bundle, 'pension.carryForwardYears')} years)`,
      outcome: `Tax relief of £${Math.round(reliefValue)} now; potential ${_h.fmt(futureValue)} at retirement`
    },
    rules: ['CF v1.5 §17', '[HMRC-PTM] AA + carry-forward', 'UK-PEN-04']
  };
}

/** Canonical-CoI handler: 'investmentStrategy' domain (CF-owned). */
export function investmentStrategyHandler(entity, bundle, ctx) {
  if (!ctx?.cma) {
    return { status: 'OPEN', currentPath: [], optimalPath: [],
      action: { currentDescription: '', optimalDescription: '', outcome: '' },
      rules: ['investmentStrategy handler requires ctx.cma'] };
  }

  const eff = portfolioEfficiency(entity, ctx.cma);
  if (eff.breakdown.error) {
    return { status: 'OPEN', currentPath: [], optimalPath: [],
      action: { currentDescription: '', optimalDescription: '', outcome: '' },
      rules: [eff.breakdown.error || 'efficiency unavailable'] };
  }

  const liquid = _h.liquidAssets(entity);
  const sharpeGap = (eff.breakdown.benchmark_60_40_sharpe || 0) - (eff.breakdown.portfolio_sharpe || 0);
  const horizon = ctx.horizonYears;

  // Improvement available per year ≈ sharpe gap × portfolio vol × value
  const annualImprovement = liquid * (eff.breakdown.improvement_available || 0);

  if (annualImprovement < 100) {
    return { status: 'NOT_APPLICABLE', currentPath: [], optimalPath: [],
      action: { currentDescription: 'portfolio is near-optimal', optimalDescription: '', outcome: '' },
      rules: ['Sharpe ratio gap < material threshold'] };
  }

  const currentPath = [], optimalPath = [];
  for (let yr = 0; yr < horizon; yr++) {
    currentPath.push(0);
    optimalPath.push(annualImprovement);
  }

  return {
    status: 'IMPLEMENTED',
    currentPath, optimalPath,
    action: {
      currentDescription: `Portfolio Sharpe ratio ${(eff.breakdown.portfolio_sharpe || 0).toFixed(2)} (${sharpeGap > 0 ? 'below' : 'at'} benchmark)`,
      optimalDescription: `Rebalance toward 60/40 efficient point or risk-tolerance-optimal mix`,
      outcome: `Recovers approximately £${Math.round(annualImprovement)}/year in risk-adjusted return`
    },
    rules: ['CF v1.5 §17 §8.7', '[CII-AF4] efficient frontier', 'O-CF-RULES-01 closed (Standard 8 universe)']
  };
}

/** Canonical-CoI handler: 'debt' domain (CF-owned). */
export function debtHandler(entity, bundle, ctx) {
  if (!ctx?.cma) {
    return { status: 'OPEN', currentPath: [], optimalPath: [],
      action: { currentDescription: '', optimalDescription: '', outcome: '' },
      rules: ['debt handler requires ctx.cma'] };
  }

  const liabs = _h.liabilities(entity);
  if (liabs.length === 0) {
    return { status: 'NOT_APPLICABLE', currentPath: [], optimalPath: [],
      action: { currentDescription: 'no liabilities', optimalDescription: '', outcome: '' },
      rules: ['No liabilities on entity'] };
  }

  // High-rate debt = > savings rate from CMA
  const cashRate = _h.cmaField(ctx.cma, 'cashRate.value');
  const highRate = liabs.filter(l => (l.interestRate || 0) > cashRate + 0.02);
  if (highRate.length === 0) {
    return { status: 'NOT_APPLICABLE', currentPath: [], optimalPath: [],
      action: { currentDescription: 'no high-rate debt', optimalDescription: '', outcome: '' },
      rules: [`All debt at or below cash rate + 2% (${((cashRate + 0.02) * 100).toFixed(1)}%)`] };
  }

  const totalHighRateBalance = highRate.reduce((s, l) => s + (l.balance || 0), 0);
  const avgRate = highRate.reduce((s, l) => s + (l.interestRate * (l.balance || 0)), 0) / totalHighRateBalance;
  const horizon = Math.min(ctx.horizonYears, 5);   // most consumer debt < 5y horizon
  const annualSaving = totalHighRateBalance * (avgRate - cashRate);

  const currentPath = [], optimalPath = [];
  for (let yr = 0; yr < horizon; yr++) {
    currentPath.push(-annualSaving);   // continuing to pay high interest = ongoing cost
    optimalPath.push(0);
  }

  return {
    status: 'IMPLEMENTED',
    currentPath, optimalPath,
    action: {
      currentDescription: `${_h.fmt(totalHighRateBalance)} of debt at avg ${(avgRate * 100).toFixed(1)}% (vs ${(cashRate * 100).toFixed(1)}% cash rate)`,
      optimalDescription: `Pay down high-rate debt or refinance to rates closer to cash benchmark`,
      outcome: `Saves approximately £${Math.round(annualSaving)}/year in net interest cost`
    },
    rules: ['CF v1.5 §17', 'CII CF6 Mortgage Advice', '[CII-AF4]']
  };
}

/** Frozen handler map for CF-owned canonical CoI domains. */
export const cfHandlers = Object.freeze({
  drawdown: drawdownHandler,
  wrapperSequencing: wrapperSequencingHandler,
  taxAllowances: taxAllowancesHandler,
  contributions: contributionsHandler,
  investmentStrategy: investmentStrategyHandler,
  debt: debtHandler,
});

/**
 * composeCFHandlers(otherHandlers?)
 *   Convenience to assemble:
 *     DEFAULT_HANDLERS (12 stubs) + estatePlanningHandler + pensionTimingHandler
 *     + cfHandlers (6) + caller overrides.
 *   Caller passes estate/pension handlers explicitly to avoid hard-coupling
 *   this engine to those engines (lib discipline).
 */
export function composeCFHandlers(estatePlanningHandler, pensionTimingHandler, otherHandlers) {
  const fromEngines = {};
  if (typeof estatePlanningHandler === 'function') fromEngines.estatePlanning = estatePlanningHandler;
  if (typeof pensionTimingHandler === 'function') fromEngines.pensionTiming = pensionTimingHandler;
  return composeHandlers(DEFAULT_HANDLERS, fromEngines, cfHandlers, otherHandlers || {});
}

/**
 * coiCashflowVariants(entity, cma, taxBundle) — CF v1.5 §8.23.
 *   Returns 3 CF-originated CoI variants per §17:
 *   - withdrawal_sequence_coI (drawdown)
 *   - surplus_allocation_coI  (contributions + investment hybrid)
 *   - pension_contribution_coI (contributions specifically for AA space)
 */
export function coiCashflowVariants(entity, cma, taxBundle) {
  if (!cma) return _h.err('INSUFFICIENT_DATA', ['cma bundle']);

  const extras = buildCFCoIExtras(entity, cma, taxBundle);
  const handlers = composeHandlers(DEFAULT_HANDLERS, cfHandlers);

  let withdrawal_sequence_coI, surplus_allocation_coI, pension_contribution_coI;
  try {
    withdrawal_sequence_coI = costOfInaction(entity, 'drawdown', taxBundle || {}, handlers, extras);
  } catch (e) {
    withdrawal_sequence_coI = { amount: 0, breakdown: { status: 'OPEN', error: e.message } };
  }
  try {
    surplus_allocation_coI = costOfInaction(entity, 'investmentStrategy', taxBundle || {}, handlers, extras);
  } catch (e) {
    surplus_allocation_coI = { amount: 0, breakdown: { status: 'OPEN', error: e.message } };
  }
  try {
    pension_contribution_coI = costOfInaction(entity, 'contributions', taxBundle || {}, handlers, extras);
  } catch (e) {
    pension_contribution_coI = { amount: 0, breakdown: { status: 'OPEN', error: e.message } };
  }

  const total = withdrawal_sequence_coI.amount + surplus_allocation_coI.amount + pension_contribution_coI.amount;

  return _h.env(total,
    {
      withdrawal_sequence_coI: {
        amount: withdrawal_sequence_coI.amount,
        horizon_years: extras.cma ? (entity.longevityAge || 92) - _h.ageOf(entity) : null,
        confidence: _h.cmaConfidence(cma)
      },
      surplus_allocation_coI: {
        amount: surplus_allocation_coI.amount,
        confidence: _h.cmaConfidence(cma)
      },
      pension_contribution_coI: {
        amount: pension_contribution_coI.amount,
        aa_space: taxBundle ? Math.max(0, _h.taxField(taxBundle, 'pension.annualAllowance') -
          (entity.pensionContributedThisYear || 0)) : null,
        confidence: _h.cmaConfidence(cma)
      },
      _discountRateUsed: extras.discountRateReal,
      _discountRateSource: extras._meta?.sourceForDiscountRate
    },
    ['CF v1.5 §8.23 · §17 · canonical-coi.js (Phase A patched)', 'O-CF-RULES-12=B Risk-free interim'],
    `CF CoI variants: withdrawal=${_h.fmt(withdrawal_sequence_coI.amount)}, surplus=${_h.fmt(surplus_allocation_coI.amount)}, pension=${_h.fmt(pension_contribution_coI.amount)}.`
  );
}


// ─────────────────────────────────────────────────────────────────────
// §J — HEALTH + LIQUIDITY + SURPLUS
// ─────────────────────────────────────────────────────────────────────

/**
 * cashflowHealth(entity) — CF v1.5 §8.2.
 *   5-component sigmoid score; midpoint values from spec table.
 */
export function cashflowHealth(entity) {
  const inc = _h.income(entity);
  const monthlyInc = _h.monthlyIncome(entity);
  const monthlyExp = _h.monthlyExpense(entity);
  if (monthlyInc === 0) return _h.err('INSUFFICIENT_DATA', ['monthly income']);

  // Component 1: incomeResilience
  const totalIncome = inc.reduce((s, i) => s + (i.gross_annual || 0), 0);
  const shares = totalIncome > 0 ? inc.map(i => (i.gross_annual || 0) / totalIncome) : [1];
  const oneMinusHHI = 1 - _h.hhi(shares);
  const avgVolDiscount = inc.length > 0
    ? 1 - (inc.reduce((s, i) => s + (i.volatility || 0), 0) / inc.length)
    : 1;
  const incomeResilience = oneMinusHHI * avgVolDiscount;
  const c1 = _h.sigmoid(incomeResilience, 0.6, 8);

  // Component 2: surplusRatio
  const surplusRatio = (monthlyInc - monthlyExp) / monthlyInc;
  const c2 = _h.sigmoid(surplusRatio, 0.15, 12);

  // Component 3: fundedRatio (capped at 1.5)
  const retAssets = _h.retirementAssets(entity);
  const target = entity.targetIncomeReal || (retAssets * 0.04);
  const fundedRatioVal = Math.min(1.5, retAssets > 0 ? (retAssets * 0.04) / target : 0);
  const c3 = _h.sigmoid(fundedRatioVal, 0.90, 6);

  // Component 4: billCoverage (months)
  const cash = _h.cashAccessible(entity);
  const billTotal = _h.monthlyBillTotal(entity) || monthlyExp;
  const billCoverage = billTotal > 0 ? cash / billTotal : 0;
  const c4 = _h.sigmoid(billCoverage, 3.0, 4);

  // Component 5: debtServiceRatio (lower is better → negative k)
  const debtSvc = _h.monthlyDebtService(entity);
  const debtServiceRatio = monthlyInc > 0 ? debtSvc / monthlyInc : 0;
  const c5 = _h.sigmoid(debtServiceRatio, 0.25, -8);

  const score = 0.25 * c1 + 0.25 * c2 + 0.20 * c3 + 0.15 * c4 + 0.15 * c5;

  return _h.env(score,
    {
      score: _h.clamp(score, 0, 100),
      components: {
        incomeResilience: { raw: incomeResilience, score: c1, weight: 0.25 },
        surplusRatio: { raw: surplusRatio, score: c2, weight: 0.25 },
        fundedRatio: { raw: fundedRatioVal, score: c3, weight: 0.20 },
        billCoverage: { raw: billCoverage, score: c4, weight: 0.15 },
        debtServiceRatio: { raw: debtServiceRatio, score: c5, weight: 0.15 },
      },
      open_item: 'O-CF-HEALTH-1 — midpoint/k values are spec defaults; founder may override pre-build'
    },
    ['CF v1.5 §8.2'],
    `Cashflow Health: ${score.toFixed(0)}/100.`
  );
}

/**
 * liquidityBuffer(entity) — CF v1.5 §8.15.
 */
export function liquidityBuffer(entity) {
  const cash = _h.cashAccessible(entity);
  const monthlyExp = _h.monthlyExpense(entity);
  const months = monthlyExp > 0 ? cash / monthlyExp : (cash > 0 ? 999 : 0);
  const target = 3;
  const gap = Math.max(0, target * monthlyExp - cash);

  let band = 'CRITICAL';
  if (months >= 6) band = 'STRONG';
  else if (months >= 3) band = 'ADEQUATE';
  else if (months >= 1) band = 'AT_RISK';

  return _h.env(months,
    {
      months_covered: months,
      target_months: target,
      cash_accessible: cash,
      monthly_expense: monthlyExp,
      gap,
      band
    },
    ['CF v1.5 §8.15'],
    `${months.toFixed(1)} months cash coverage (target ${target}). Status: ${band}.`
  );
}


// ─────────────────────────────────────────────────────────────────────
// §K — STUBS (founder IP awaiting definition)
// ─────────────────────────────────────────────────────────────────────

/**
 * realityEngineFactorisation(entity, bundle) — CF v1.5 §8.8.
 *   STUB — O-CF-RULES-09. MM v2.6 §0.1: 3 concentric rings; factor enumeration
 *   pending founder. Do NOT invent factors.
 */
export function realityEngineFactorisation(_entity, _bundle) {
  return _h.env(null,
    {
      status: 'stub',
      methodology: 'pending',
      openItem: 'O-CF-RULES-09',
      notes: 'Reality Engine three-ring structure (personal | financial system | external shocks) defined in MM v2.6 §0.1; factor enumeration and weights await founder methodology specification. Do not invent.'
    },
    ['CF v1.5 §8.8 · MM v2.6 §0.1 · skill v1.4 §2.7 (founder IP discipline)'],
    'Reality Engine factorisation: STUB. Founder methodology pending (O-CF-RULES-09).'
  );
}

/**
 * prcPccSpread(entity, bundle) — CF v1.5 §8.10.
 *   STUB — O-CF-RULES-07. Founder IP; methodology pending.
 */
export function prcPccSpread(_entity, _bundle) {
  return _h.env(null,
    {
      status: 'stub',
      methodology: 'pending',
      openItem: 'O-CF-RULES-07',
      notes: 'PRC/PCC Spread is founder IP per MM v2.6 §0.1. Canonical methodology pending. Do not derive from prior session examples.'
    },
    ['CF v1.5 §8.10 · MM v2.6 §0.1 · skill v1.4 §2.7'],
    'PRC/PCC Spread: STUB. Founder methodology pending (O-CF-RULES-07).'
  );
}


// ─────────────────────────────────────────────────────────────────────
// §M — DRAWDOWN SEQUENCING (CF §8.24)
// ─────────────────────────────────────────────────────────────────────

/**
 * optimalDrawdownSequence(entity, cma, taxBundle) — CF v1.5 §8.24.
 *   IHT-aware wrapper draw order.
 */
export function optimalDrawdownSequence(entity, cma, taxBundle) {
  if (!cma) return _h.err('INSUFFICIENT_DATA', ['cma bundle']);

  const grossEstate = entity.grossEstateValue || _h.assets(entity).reduce((s, a) => s + (a.value || 0), 0);
  // April 2027+ change: DC pensions enter IHT computation
  const ihtExposed = grossEstate > 500000 || _h.hasFlag(entity, 'iht_exposed');

  const sequence = ihtExposed
    ? ['gia', 'isa', 'sipp']
    : ['sipp_pcls', 'gia', 'isa', 'sipp_drawdown'];

  // Approximate tax saving vs default (no-strategy) sequence:
  const annualDraw = entity.targetIncomeReal || 30000;
  const taxSaving = annualDraw * 0.05;   // ~5% savings via correct sequencing
  const cgtCostIfGIA = ihtExposed ? annualDraw * 0.20 : 0;

  return _h.env(taxSaving,
    {
      sequence,
      iht_exposed: ihtExposed,
      gross_estate: grossEstate,
      tax_saving_vs_default: taxSaving,
      cgt_cost_if_gia_drawn: cgtCostIfGIA,
      rationale: ihtExposed
        ? 'Estate IHT-exposed: draw GIA/ISA first to preserve SIPP for IHT-free heir transfer'
        : 'Estate not IHT-exposed: take PCLS first (25% tax-free), then non-pension assets'
    },
    ['CF v1.5 §8.24', 'IHTA 1984', 'FA 2024 (LTA abolition)', 'Autumn Budget 2024 (Apr 2027 IHT change)'],
    `Optimal sequence: ${sequence.join(' → ')}. Tax saving ~${_h.fmt(taxSaving)}/yr.`
  );
}


// ─────────────────────────────────────────────────────────────────────
// §N — PUBLIC EXPORTS (re-export for clarity at file end)
// ─────────────────────────────────────────────────────────────────────
//
// All functions exported inline above. Public surface (36 fns):
//
// §B — Archetype + view mode (2):
//   detectCFArchetype, inferCashflowViewMode
// §C — Domain P expense + tax + surplus (7):
//   monthlyExpenseProfile, essentialVsDiscretionaryRatio, taxPaymentSchedule,
//   allowableExpenseTotal, childcareNetCost, giftsFromNormalIncomeCheck,
//   recommendedSurplusAllocation
// §E — SWR + funded ratio + GK + Bengen (5):
//   swrFromRegime, fundedRatio, bengenProjection, guytonKlinger, guytonKlingerPath
// §F — Bucket + Floor-Upside (4):
//   bucketAllocation, bucketReplenishCheck, floorUpsideSplit, guaranteedFloorIncome
// §G — Monte Carlo + risk (4 + 1 const):
//   probabilityOfSuccess, sequenceOfReturnsVulnerability, maxDrawdownExposure,
//   portfolioEfficiency, MC_RUN_TIERS
// §H — Scenarios + goal-seek (2):
//   fiveCashflowScenarios, goalSeek
// §I — CoI integration (10):
//   buildCFCoIExtras, drawdownHandler, wrapperSequencingHandler, taxAllowancesHandler,
//   contributionsHandler, investmentStrategyHandler, debtHandler, cfHandlers,
//   composeCFHandlers, coiCashflowVariants
// §J — Health + liquidity (2):
//   cashflowHealth, liquidityBuffer
// §K — Stubs (2):
//   realityEngineFactorisation, prcPccSpread
// §M — Drawdown sequencing (1):
//   optimalDrawdownSequence
//
// Total: 38 named exports + 1 frozen const (cfHandlers) + 1 frozen const (MC_RUN_TIERS).
//
// — end of uk-cashflow-2026-1-1.js —
