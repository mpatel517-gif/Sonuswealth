// ─────────────────────────────────────────────────────────────────────────────
// CAELIXA CALCULATION ENGINE
// Scoring engine:  FINIO-1.0   Risk engine: RISK-1.0   Tax rules: UK-2026.1
// Pure functions only. No side effects. No global state. No hardcoded values.
// Every output carries rulesVersion + scoringVersion stamps.
// ─────────────────────────────────────────────────────────────────────────────

import TAX_JSON from '../rules/tax-2026.json' with { type: 'json' };
import {
  pensionTotal     as _pensionTotal,
  investmentsTotal as _investmentsTotal,
  isaTotal         as _isaTotal,
  giaTotal         as _giaTotal,
  propertyTotal    as _propertyTotal,
  cashTotal        as _cashTotal,
  liabilitiesTotal as _liabilitiesTotal,
  monthlyDebtService as _monthlyDebtService,
  annualIncome     as _annualIncome,
  personAge        as _personAge,
  targetIncome     as _targetIncome,
  statePensionAnnual as _statePensionAnnual,
  protectionFlat   as _protectionFlat,
  hasPersonaFlag   as _hasPersonaFlag,
  jurisdictionOf   as _jurisdictionOf,
  getWrapper       as _getWrapper,
  detectSchema     as _detectSchema,
} from './_helpers.js';

// ── TAX OBJECT — flatten with fallbacks so app never crashes ─────────────────
export const TAX = {
  pa:            TAX_JSON.pa            ?? TAX_JSON.income?.personalAllowance        ?? 12570,
  brl:           TAX_JSON.brl           ?? TAX_JSON.income?.basicRateLimit           ?? 37700,
  brt:           TAX_JSON.brt           ?? TAX_JSON.income?.basicRateThreshold       ?? 50270,
  br:            TAX_JSON.br            ?? TAX_JSON.income?.basicRate                ?? 0.20,
  hr:            TAX_JSON.hr            ?? TAX_JSON.income?.higherRate               ?? 0.40,
  ar:            TAX_JSON.ar            ?? TAX_JSON.income?.additionalRate           ?? 0.45,
  art:           TAX_JSON.art           ?? TAX_JSON.income?.additionalRateThreshold  ?? 125140,
  nrb:           TAX_JSON.nrb           ?? TAX_JSON.iht?.nilRateBand                ?? 325000,
  rnrb:          TAX_JSON.rnrb          ?? TAX_JSON.iht?.residenceNilRateBand       ?? 175000,
  rnrbTaper:     TAX_JSON.rnrbTaper     ?? TAX_JSON.iht?.rnrbTaperThreshold         ?? 2000000,
  ihtRate:       TAX_JSON.ihtRate       ?? TAX_JSON.iht?.rate                       ?? 0.40,
  cgaAllowance:  TAX_JSON.cgaAllowance  ?? TAX_JSON.cgt?.annualExemption            ?? 3000,
  isaAllowance:  TAX_JSON.isaAllowance  ?? TAX_JSON.pension?.isaAllowance           ?? 20000,
  pensionAA:     TAX_JSON.pensionAA     ?? TAX_JSON.pension?.annualAllowance        ?? 60000,
  swr:           TAX_JSON.swr           ?? TAX_JSON.pension?.safeWithdrawalRate     ?? 0.04,
  deadline:      new Date(TAX_JSON.deadline ?? TAX_JSON.iht?.sippsEnterEstateDate   ?? '2027-04-06'),
  giftExemption: TAX_JSON.giftAnnualExemption ?? TAX_JSON.iht?.giftAnnualExemption  ?? 3000,
  // Post-LTA allowances (in force from 6 April 2024)
  lsa:           TAX_JSON.lsa           ?? 268275,    // Lump Sum Allowance
  lsdba:         TAX_JSON.lsdba         ?? 1073100,   // Lump Sum & Death Benefit Allowance
  spa:           TAX_JSON.pension?.statePensionAge ?? 66,
  ver:           TAX_JSON.version       ?? TAX_JSON._meta?.version ?? 'UK-2026.1',
  statePensionFull:      TAX_JSON.pension?.statePensionFullAmount
                      ?? TAX_JSON.nationalInsurance?.stateNewPensionFullAmount
                      ?? 11502,
  statePensionQualYears: TAX_JSON.pension?.statePensionQualifyingYears
                      ?? TAX_JSON.nationalInsurance?.statePensionQualifyingYears
                      ?? 35,
};

const SCORING_VERSION = 'FINIO-1.0';
const RISK_VERSION    = 'RISK-1.0';

// ── FORMATTERS ────────────────────────────────────────────────────────────────

/**
 * Formats a number as a GBP currency string.
 * @param {number|null|undefined} n
 * @returns {string} e.g. "£1.25m", "£37k", "£500", "—" for null/undefined
 */
export function fmt(n) {
  if (n === undefined || n === null) return '—';
  const neg = n < 0, abs = Math.abs(n);
  const pre = neg ? '−£' : '£';
  if (abs >= 1e6) return pre + (abs / 1e6).toFixed(2) + 'm';
  if (abs >= 1e3) return pre + Math.round(abs / 1e3) + 'k';
  return pre + Math.round(abs).toLocaleString();
}

/**
 * Days remaining until the SIPP-enters-estate deadline (TAX.deadline).
 * @returns {number} integer ≥ 0
 */
export function daysLeft() {
  return Math.max(0, Math.round((TAX.deadline - new Date()) / 86400000));
}

// ── LIFE STAGE ────────────────────────────────────────────────────────────────

/**
 * Returns the life-stage bucket for a given age.
 * @param {number} age
 * @param {'individual'|'employer'} type
 * @returns {{ stage: number, name: string, range: string }}
 */
export function lifeStageFor(age, type = 'individual') {
  if (type === 'employer') {
    if (age < 30) return { stage: 1, name: 'Foundation',    range: '18–30' };
    if (age < 45) return { stage: 2, name: 'Accumulation',  range: '30–45' };
    if (age < 55) return { stage: 3, name: 'Consolidation', range: '45–55' };
    if (age < 65) return { stage: 4, name: 'Transition',    range: '55–65' };
    return              { stage: 5, name: 'Decumulation',   range: '65–75' };
  }
  if (age < 30) return { stage: 1, name: 'Foundation',    range: '18–30' };
  if (age < 45) return { stage: 2, name: 'Accumulation',  range: '30–45' };
  if (age < 55) return { stage: 3, name: 'Consolidation', range: '45–55' };
  if (age < 65) return { stage: 4, name: 'Transition',    range: '55–65' };
  if (age < 75) return { stage: 5, name: 'Decumulation',  range: '65–75' };
  if (age < 85) return { stage: 6, name: 'Preservation',  range: '75–85' };
  return              { stage: 7, name: 'Legacy',          range: '85+'   };
}

// ── NET WORTH & INVESTABLE ────────────────────────────────────────────────────

/**
 * Total net worth: SIPP + ISA + residence + portfolio + cash − liabilities.
 * Schema-agnostic: handles both LEGACY FLAT (persona-a..g) and NEW NESTED (mrT-*).
 *
 * CONTRACT — precedence rule: For each asset class, if entity has BOTH the
 *   legacy-flat form (e.g. a.isa.value, a.sipp.total, a.portfolio.value, a.cash.total)
 *   AND the nested-array form (e.g. a.investments[], a.pensions[], a.bank[]),
 *   the NESTED form wins. The flat values are skipped entirely. This avoids
 *   double-counting (FIX R1: Mr T NW was inflated £484k → £727k by summing both).
 *   Nested arrays are the canonical event-sourced shape; flat fields exist for
 *   legacy persona-a..g back-compat only.
 *
 * Subtracts liabilities so mortgage debt is not counted as net worth.
 * CANONICAL
 * @param {object} e - entity object
 * @returns {number}
 */
export function netWorth(e) {
  if (!e) return 0;
  const a = e.assets || {};
  // Legacy fast-path: any flat field present and no nested arrays
  const hasFlat   = !!(a.sipp || a.isa || a.residence || a.portfolio || a.cash);
  const hasNested = Array.isArray(a.pensions) || Array.isArray(a.investments) ||
                    Array.isArray(a.property) || Array.isArray(a.bank);
  if (hasFlat && !hasNested) {
    const liab = _liabilitiesTotal(e);
    return (a.sipp?.total || 0) + (a.isa?.value || 0) +
           (a.residence?.value || 0) + (a.portfolio?.value || 0) +
           (a.cash?.total || 0) - liab;
  }
  // Nested or mixed: nested wins. Universal readers walk the nested arrays
  // only; flat-side values (a.isa.value etc.) are intentionally NOT added,
  // because in mixed personas they duplicate items already inside the nested
  // arrays (ISA in a.investments[], cash in a.bank[], SIPP in a.pensions[]).
  return _pensionTotal(e) + _investmentsTotal(e) + _propertyTotal(e) +
         _cashTotal(e) - _liabilitiesTotal(e);
}

/**
 * Investable assets: SIPP + ISA + portfolio + cash (excludes illiquid residence).
 * Schema-agnostic. Does NOT subtract liabilities (used for SWR / FI ratio inputs).
 * CANONICAL
 * @param {object} e - entity object
 * @returns {number}
 */
export function investable(e) {
  if (!e) return 0;
  const a = e.assets || {};
  const hasFlat   = !!(a.sipp || a.isa || a.portfolio || a.cash);
  const hasNested = Array.isArray(a.pensions) || Array.isArray(a.investments) || Array.isArray(a.bank);
  if (hasFlat && !hasNested) {
    return (a.sipp?.total || 0) + (a.isa?.value || 0) +
           (a.portfolio?.value || 0) + (a.cash?.total || 0);
  }
  return _pensionTotal(e) + _investmentsTotal(e) + _cashTotal(e);
}

/**
 * Safe-withdrawal-rate annual income ceiling (investable × TAX.swr).
 * @param {object} e - entity object
 * @returns {number}
 */
export function guardrail(e) {
  return investable(e) * TAX.swr;
}

// ── P2 FOUNDATIONAL ENGINE FUNCTIONS ─────────────────────────────────────────

/**
 * Age in whole years from ISO date string.
 * @param {string} dob - e.g. "1991-04-23"
 * @returns {number}
 */
export function calcAge(dob) {
  const ms = Date.now() - new Date(dob).getTime();
  return Math.floor(ms / (365.25 * 86400000));
}

/**
 * UK state pension projection from accrued NI years.
 * @param {object} entity - expects entity.individual.{dob, state_pension_accrued_years, state_pension_start_age}
 * @returns {{ annual_at_retirement: number|null, accrued_years: number|null, qualifying_years_needed: number, start_age: number, confidence: string }}
 */
export function calcStateP(entity) {
  const ind          = entity.individual || {};
  const accruedYears = ind.state_pension_accrued_years ?? null;
  const startAge     = ind.state_pension_start_age ?? TAX.spa;

  if (accruedYears === null || !ind.dob) {
    return { annual_at_retirement: null, accrued_years: accruedYears, qualifying_years_needed: null, start_age: startAge, confidence: 'INSUFFICIENT' };
  }

  const age                   = calcAge(ind.dob);
  const yearsToRetirement     = Math.max(0, startAge - age);
  const projectedQualYears    = Math.min(TAX.statePensionQualYears, accruedYears + yearsToRetirement);
  const annualAtRetirement    = Math.round((projectedQualYears / TAX.statePensionQualYears) * TAX.statePensionFull);
  const qualifyingYearsNeeded = Math.max(0, TAX.statePensionQualYears - projectedQualYears);

  return {
    annual_at_retirement:    annualAtRetirement,
    accrued_years:           accruedYears,
    qualifying_years_needed: qualifyingYearsNeeded,
    start_age:               startAge,
    confidence:              'HIGH',
  };
}

/**
 * Net worth: gross assets minus liabilities.
 * DB pensions with null CETV are excluded. FP-4 stale and FP-5 unverified assets
 * are included at stated value but flagged — confidence drops to MEDIUM.
 * @param {object} entity - fixture-format entity
 * @returns {{ gross: number, liabilities_total: number, net: number, confidence: string, staleness_flags: string[], excluded_assets: string[] }}
 */
export function calcNetWorth(entity) {
  const a              = entity.assets    || {};
  const stalenessFlags = [];
  const excludedAssets = [];
  let   confidence     = 'HIGH';

  // Pensions — exclude DB with null/undefined CETV; GBP fallback for cross-border fixtures
  let pensionTotal = 0;
  for (const p of (a.pensions || [])) {
    if (p.type === 'occupational-DB' && p.cetv == null) {
      excludedAssets.push(p.id);
      continue;
    }
    pensionTotal += p.balance_gbp ?? p.balance ?? 0;
    if (p.last_valuation_date) {
      const daysSince = (Date.now() - new Date(p.last_valuation_date)) / 86400000;
      if (daysSince > 365) stalenessFlags.push(`${p.id}-valuation-stale`);
    }
  }

  // Investments (ISA, GIA, crypto, private shares) — FP-5 unverified, FP-4 stale
  let investmentTotal = 0;
  for (const inv of (a.investments || [])) {
    investmentTotal += inv.estimated_value ?? inv.balance_gbp ?? inv.balance ?? 0;
    if (inv.verified_by_user === false) confidence = 'MEDIUM';
    if (inv.last_valuation_date) {
      const daysSince = (Date.now() - new Date(inv.last_valuation_date)) / 86400000;
      if (daysSince > 365) {
        stalenessFlags.push(`${inv.id}-valuation-stale`);
        confidence = 'MEDIUM';
      }
    }
  }

  // Property — skip $ref placeholders and disposed entries; apply beneficial_interest fraction
  let propertyTotal = 0;
  for (const p of (a.property || [])) {
    if (p['$ref'] || p.status === 'disposed') continue;
    const rawVal   = p.value_gbp ?? p.value ?? 0;
    const fraction = p.beneficial_interest_this_individual ?? 1;
    propertyTotal += rawVal * fraction;
  }
  // BTL / rental portfolio properties (landlord fixture pattern)
  for (const p of (entity.rental_portfolio?.properties || [])) {
    if (p.status === 'disposed') continue;
    propertyTotal += p.value_gbp ?? p.value ?? p.estimated_value ?? 0;
  }

  const bankTotal        = (a.bank || []).reduce((s, b) => s + (b.balance_gbp ?? b.balance ?? 0), 0);
  // FIX R1: nested-wins precedence. Legacy fixtures may carry flat fields
  // (a.sipp.total, a.isa.value, a.portfolio.value, a.residence.value, a.cash.total)
  // alongside nested arrays — when both forms exist, summing them double-counts.
  // For each asset class we add the flat value ONLY if the corresponding nested
  // array is absent or empty. Mirror of netWorth() contract above.
  const hasNestedPensions     = Array.isArray(a.pensions)    && a.pensions.length    > 0;
  const hasNestedInvestments  = Array.isArray(a.investments) && a.investments.length > 0;
  const hasNestedProperty     = Array.isArray(a.property)    && a.property.length    > 0;
  const hasNestedBank         = Array.isArray(a.bank)        && a.bank.length        > 0;
  const flatSipp     = hasNestedPensions    ? 0 : (a.sipp?.total      || 0);
  const flatIsaVal   = (typeof a.isa === 'number') ? a.isa : (a.isa?.value || 0);
  const flatIsa      = hasNestedInvestments ? 0 : flatIsaVal;
  const flatGia      = hasNestedInvestments ? 0 : (a.portfolio?.value || 0);
  const flatRes      = hasNestedProperty    ? 0 : ((a.residence?.value || 0) * (a.residence?.ownershipShare || 1));
  const flatCash     = hasNestedBank        ? 0 : (a.cash?.total ?? a.cash?.own ?? 0);
  const flatGross    = flatSipp + flatIsa + flatGia + flatRes + flatCash;
  const gross        = pensionTotal + investmentTotal + propertyTotal + bankTotal + flatGross;
  // Liabilities: handle both array (nested) and object (legacy) shapes.
  const liabilitiesTotal = _liabilitiesTotal(entity);

  return {
    gross,
    liabilities_total: liabilitiesTotal,
    net:               gross - liabilitiesTotal,
    confidence,
    staleness_flags:   stalenessFlags,
    excluded_assets:   excludedAssets,
  };
}

/**
 * Investable assets (gross minus property) with confidence metadata.
 * Schema-agnostic: subtracts both nested and legacy property values.
 * @param {object} entity - fixture-format entity
 * @returns {{ value: number, confidence: string, staleness_flags: string[] }}
 */
export function calcInvestable(entity) {
  const nw = calcNetWorth(entity);
  const propTotal = _propertyTotal(entity);
  return {
    value:           nw.gross - propTotal,
    confidence:      nw.confidence,
    staleness_flags: nw.staleness_flags,
  };
}

/**
 * Safe-withdrawal-rate guardrail with metadata.
 * @param {object} entity - fixture-format entity
 * @returns {{ guardrail: number, investable: number, swr: number, confidence: string }}
 */
export function calcGuardrail(entity) {
  const inv = calcInvestable(entity);
  return {
    guardrail:  Math.round(inv.value * TAX.swr),
    investable: inv.value,
    swr:        TAX.swr,
    confidence: inv.confidence,
  };
}

// ── INCOME TAX ON DRAWDOWN ────────────────────────────────────────────────────

/**
 * UK income tax on pension drawdown including state pension.
 * @param {number} drawdown - annual drawdown amount
 * @param {number} [statePension=11973] - annual state pension
 * @returns {number} tax due (rounded)
 */
export function incomeTax(drawdown, statePension = 11973) {
  if (drawdown <= 0) return 0;
  const gross    = drawdown + statePension;
  const taxable  = Math.max(0, gross - TAX.pa);
  let   tax      = Math.min(taxable, TAX.brl) * TAX.br;
  if (taxable > TAX.brl) tax += Math.min(taxable - TAX.brl, TAX.art - TAX.brt) * TAX.hr;
  if (taxable > TAX.art - TAX.pa) tax += (taxable - (TAX.art - TAX.pa)) * TAX.ar;
  return Math.round(tax);
}

// ── SIPP PROJECTION ───────────────────────────────────────────────────────────
// drawdown can be:
//   · a number (scalar)  → applied every year (backwards-compatible)
//   · an array of numbers → drawdown[i] for year i; last value repeats if array shorter
//   · an array of {amount} objects → per-year schedule with optional {reason} tags
// Spec reference: s02b-measures §H6 Drawdown Efficiency; master blueprint v1.2
// backlog item "Cash flow is never linear" (a82f6357). Engine now honours the
// per-year-withdrawal-vector requirement.

function _ddAtYear(drawdown, i) {
  if (drawdown == null) return 0;
  if (typeof drawdown === 'number') return drawdown;
  if (Array.isArray(drawdown) && drawdown.length > 0) {
    const entry = drawdown[Math.min(i, drawdown.length - 1)];
    if (typeof entry === 'number') return entry;
    if (entry && typeof entry === 'object') return entry.amount || 0;
  }
  return 0;
}

/**
 * Projects SIPP terminal value after N years.
 * drawdown can be: scalar number | number[] | {amount,reason}[]
 * @param {number} start
 * @param {number} growth - annual growth rate e.g. 0.05
 * @param {number|Array} drawdown
 * @param {number} years
 * @returns {number} terminal value (rounded)
 */
export function sippProjection(start, growth, drawdown, years) {
  let val = start;
  for (let i = 0; i < years; i++) {
    val = Math.max(0, val * (1 + growth) - _ddAtYear(drawdown, i));
  }
  return Math.round(val);
}

// Returns year-by-year projection as [{year, age, value, drawdown, reason}]
// Useful for chart rendering and the MyMoney pension Projections tab.
/**
 * Year-by-year SIPP projection for chart rendering.
 * @param {number} start
 * @param {number} growth
 * @param {number|Array} drawdown
 * @param {number} years
 * @param {number|null} [startAge]
 * @returns {Array<{year:number, age?:number, value:number, drawdown:number, reason?:string}>}
 */
export function sippProjectionSeries(start, growth, drawdown, years, startAge = null) {
  let val = start;
  const out = [];
  for (let i = 0; i < years; i++) {
    const dd = _ddAtYear(drawdown, i);
    val = Math.max(0, val * (1 + growth) - dd);
    const row = { year: i + 1, value: Math.round(val), drawdown: dd };
    if (startAge != null) row.age = startAge + i + 1;
    if (Array.isArray(drawdown)) {
      const entry = drawdown[Math.min(i, drawdown.length - 1)];
      if (entry && typeof entry === 'object' && entry.reason) row.reason = entry.reason;
    }
    out.push(row);
  }
  return out;
}

// Sum drawdown across a schedule (or scalar × years) — used for total-taken calcs.
export function drawdownTotal(drawdown, years) {
  let total = 0;
  for (let i = 0; i < years; i++) total += _ddAtYear(drawdown, i);
  return total;
}

// ── CASHFLOW ANALYTICS — FUNDED RATIO ────────────────────────────────────────

const SWR_REGIMES = {
  bengen:         { rate: 0.04,  label: 'Bengen 4%' },
  morningstar:    { rate: 0.037, label: 'Morningstar 3.7%' },
  guyton_klinger: { rate: 0.045, label: 'Guyton-Klinger 4.5%' },
  vanguard:       { rate: 0.033, label: 'Vanguard 3.3%' },
  prc_anchored:   { rate: 0.04,  label: 'PRC-anchored' },
};

/**
 * Funded ratio: projected retirement assets at retirementAge ÷ capital required
 * to fund targetIncome at the chosen SWR regime.
 * @param {object} entity
 * @param {object|null} [cma=null] - Capital Market Assumptions bundle (optional)
 * @returns {{ ratio: number|null, required_assets: number|null,
 *             actual_assets_at_retirement: number|null, target_income_real: number,
 *             swr: number|null, regime: string|null, retirement_age: number,
 *             current_age: number, horizon_years: number,
 *             confidence: string, insufficient_data: boolean, cma_bundle: object|null }}
 */
export function fundedRatio(entity, cma = null) {
  const e             = entity || {};
  const age           = e.age ?? 0;
  const retirementAge = e.retirementAge ?? TAX.spa;
  const horizon       = Math.max(0, retirementAge - age);
  const targetIncome  = e.targetIncome ?? 0;

  const sipp     = e.assets?.sipp?.total ?? 0;
  const isa      = typeof e.assets?.isa === 'number' ? e.assets.isa : (e.assets?.isa?.total ?? 0);
  const invRaw   = e.assets?.investments;
  const invest   = typeof invRaw === 'number' ? invRaw : (invRaw?.total ?? 0);
  const retStack = sipp + isa + invest;

  // FP-4: INSUFFICIENT — not enough data to model
  if (retStack < 10_000 || targetIncome === 0) {
    return {
      ratio: null, required_assets: null, actual_assets_at_retirement: null,
      target_income_real: targetIncome, swr: null, regime: null,
      retirement_age: retirementAge, current_age: age, horizon_years: horizon,
      confidence: 'INSUFFICIENT', insufficient_data: true, cma_bundle: cma,
    };
  }

  const life      = lifeStageFor(age);
  const regimeKey = e.swrRegime ?? (life.stage >= 5 ? 'morningstar' : 'bengen');
  const { rate, label } = SWR_REGIMES[regimeKey] ?? SWR_REGIMES.bengen;

  // FP-4: HIGH — already at or past retirement
  if (horizon <= 0) {
    const required = targetIncome / rate;
    return {
      ratio:                       Math.round((retStack / required) * 100) / 100,
      required_assets:             Math.round(required),
      actual_assets_at_retirement: Math.round(retStack),
      target_income_real:          targetIncome,
      swr: rate, regime: label,
      retirement_age: retirementAge, current_age: age, horizon_years: 0,
      confidence: 'HIGH', insufficient_data: false, cma_bundle: cma,
    };
  }

  const cmaExpired    = cma?.expiryDate ? new Date(cma.expiryDate) < new Date() : false;
  const growth        = cma?.growth    ?? e.growth    ?? 0.05;
  const inflation     = cma?.inflation ?? 0.025;

  // Project asset stack in nominal terms; inflate target income to retirement date
  const projectedNominal = retStack * Math.pow(1 + growth, horizon);
  const targetNominal    = targetIncome * Math.pow(1 + inflation, horizon);
  const required         = targetNominal / rate;
  const ratio            = projectedNominal / required;

  const confidence = cmaExpired ? 'LOW' : cma ? 'MED-HIGH' : 'MEDIUM';

  return {
    ratio:                       Math.round(ratio * 100) / 100,
    required_assets:             Math.round(required),
    actual_assets_at_retirement: Math.round(projectedNominal),
    target_income_real:          targetIncome,
    swr:                         rate,
    regime:                      label,
    retirement_age:              retirementAge,
    current_age:                 age,
    horizon_years:               horizon,
    confidence,
    insufficient_data:           false,
    cma_bundle:                  cma,
  };
}

// ── LSA / LSDBA HEADROOM (post-LTA 2024) ─────────────────────────────────────
// Returns remaining allowance for tax-free cash and death benefits.

/**
 * Remaining LSA / LSDBA headroom post-LTA abolition (April 2024).
 * @param {object} e - entity object
 * @returns {{ lsaRemaining: number, lsdbaRemaining: number, hasProtection: boolean }}
 */
export function lsaHeadroom(e) {
  const a          = e.assets || {};
  const sippTotal  = a.sipp?.total || 0;
  const crystalised = a.sipp?.crystalised || 0;  // amount already crystalised
  const tfcTaken   = a.sipp?.tfcTaken    || 0;   // tax-free cash already taken
  return {
    lsaRemaining:   Math.max(0, TAX.lsa   - tfcTaken),
    lsdbaRemaining: Math.max(0, TAX.lsdba - crystalised),
    hasProtection:  !!(a.sipp?.enhancedProtection || a.sipp?.fixedProtection),
  };
}

// ── DYNAMIC IHT CALCULATOR ────────────────────────────────────────────────────

/**
 * Dynamic IHT calculation including NRB/RNRB taper and optional SIPP inclusion.
 * @param {object} e - entity object
 * @param {boolean} [includeSipp=true]
 * @param {number|Array|null} [drawdownOverride]
 * @returns {{ gross:number, nrb:number, rnrb:number, taxable:number, iht:number, beneficiaryRate:number, sippContribution:number, rnrbLost:number }}
 */
export function ihtDynamic(e, includeSipp = true, drawdownOverride = null) {
  const a        = e.assets;
  if (!a) return { gross: 0, taxable: 0, iht: 0, beneficiaryRate: 1, sippContribution: 0 };

  // drawdownOverride can be scalar OR schedule (array). For IHT snapshot we
  // use the first-year draw to reduce SIPP balance; deeper IHT-at-age-X
  // modelling belongs in a forward projection (see sippProjectionSeries).
  const ddRaw       = drawdownOverride !== null ? drawdownOverride : (e.drawdown || 0);
  const drawdown    = _ddAtYear(ddRaw, 0);
  const resShare    = (a.residence?.value || 0) * (a.residence?.ownershipShare || 1);
  const sippVal     = includeSipp ? Math.max(0, (a.sipp?.total || 0) - drawdown) : 0;
  const isaVal      = a.isa?.value    || 0;
  const giaVal      = a.portfolio?.bpr ? 0 : (a.portfolio?.value || 0);
  const cashVal     = a.cash?.own     || 0;
  const protEstate  = (a.protection?.lifeInsurance?.exists && !a.protection.lifeInsurance.inTrust)
                        ? (a.protection.lifeInsurance.amount || 0) : 0;

  const gross = resShare + sippVal + isaVal + giaVal + cashVal + protEstate;

  let nrb  = TAX.nrb;  if (e.isCouple) nrb  *= 2;
  let rnrb = TAX.rnrb; if (e.isCouple) rnrb *= 2;
  if (gross > TAX.rnrbTaper) rnrb = Math.max(0, rnrb - (gross - TAX.rnrbTaper) / 2);

  const taxable = Math.max(0, gross - nrb - rnrb);
  const iht     = Math.round(taxable * TAX.ihtRate);
  return {
    gross, nrb, rnrb, taxable, iht,
    beneficiaryRate:   gross > 0 ? (gross - iht) / gross : 1,
    sippContribution:  includeSipp ? Math.round(sippVal * TAX.ihtRate) : 0,
    rnrbLost:          e.isCouple ? Math.max(0, TAX.rnrb * 2 - rnrb) : Math.max(0, TAX.rnrb - rnrb),
  };
}

/**
 * IHT cost of NOT drawing down SIPP before the estate-inclusion deadline.
 * @param {object} e - entity object
 * @returns {number}
 */
export function ihtSippDelta(e) {
  return Math.max(0, ihtDynamic(e, true).iht - ihtDynamic(e, false).iht);
}

/**
 * Per-domain cost-of-inaction dispatcher.
 * `costOfInaction(e)`                    → number — back-compat (totalCoI(e).total).
 * `costOfInaction(e, 'sipp_iht')`        → SIPP-IHT delta (legacy single-domain).
 * `costOfInaction(e, 'drawdown')`        → tax-burden delta from no drawdown.
 * `costOfInaction(e, '<other>')`         → byDomain[<other>] from totalCoI.
 * Backwards-compatible: existing screens calling `costOfInaction(e)` still get a number.
 * Spec: 2-Product-home-v1_4.md §Z3 + §0.5; arch master §13.3.
 * CANONICAL
 * @param {object} e - entity object
 * @param {string} [actionDomain] - optional domain key
 * @returns {number}
 */
export function costOfInaction(e, actionDomain) {
  if (!actionDomain || actionDomain === 'all' || actionDomain === 'total') {
    return totalCoI(e).total;
  }
  if (actionDomain === 'sipp_iht' || actionDomain === 'iht_sipp' || actionDomain === 'iht-sipp') {
    return ihtSippDelta(e);
  }
  const t = totalCoI(e);
  return (t.byDomain && (+t.byDomain[actionDomain] || 0)) || 0;
}

// ── GIFT TRACKER ──────────────────────────────────────────────────────────────

export function giftPct(dateStr) {
  const start = new Date(dateStr);
  return Math.min(100, Math.round(((Date.now() - start) / (7 * 365.25 * 86400000)) * 100));
}

export function taperBand(dateStr) {
  const yrs = (Date.now() - new Date(dateStr)) / (365.25 * 86400000);
  if (yrs < 3) return { label: 'Full IHT',   rate: 0.40, pct: 100 };
  if (yrs < 4) return { label: 'Taper 80%',  rate: 0.32, pct: 80  };
  if (yrs < 5) return { label: 'Taper 60%',  rate: 0.24, pct: 60  };
  if (yrs < 6) return { label: 'Taper 40%',  rate: 0.16, pct: 40  };
  if (yrs < 7) return { label: 'Taper 20%',  rate: 0.08, pct: 20  };
  return              { label: 'IHT-free',    rate: 0,    pct: 0   };
}

// ── NET WORTH TRAJECTORY ──────────────────────────────────────────────────────

export function trajectoryData(e) {
  const ages  = [62, 65, 68, 71, 74, 77, 80, 83, 86, 90];
  const base  = e.age || 62;
  const a     = e.assets || {};
  const sp    = e.income?.statePension?.annual  || 11973;
  const spAge = e.income?.statePension?.startAge || 67;
  const living = e.targetIncome || 50000;

  function proj(dd) {
    return ages.map(age => {
      const yrs = Math.max(0, age - base);
      let sv = a.sipp?.total      || 0;
      let iv = a.isa?.value       || 0;
      let rv = a.residence?.value || 0;
      let pv = a.portfolio?.value || 0;
      let cv = a.cash?.total      || 0;
      for (let y = 0; y < yrs; y++) {
        const myAge = base + y;
        const spInc = myAge >= spAge ? sp : 0;
        sv = Math.max(0, sv * (1 + (a.sipp?.growth || 0.05)) - dd);
        iv *= 1 + (a.isa?.growth || 0.05);
        rv *= 1.02;
        pv *= 1 + (a.portfolio?.growth || 0.05);
        cv  = Math.max(0, cv * 1.04 - Math.max(0, living - spInc - dd));
      }
      return { age, nw: Math.round(sv + iv + rv + pv + cv) };
    });
  }

  const ddOpt = Math.min(guardrail(e), TAX.brl);
  return {
    doNothing:   proj(0),
    draw25:      proj(25000),
    draw377:     proj(37700),
    drawPartial: proj(Math.round(ddOpt * 0.6)),
    drawOptimal: proj(ddOpt),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FINIO-1.0 — SCORING ENGINE
// Seven dimensions + Action Momentum multiplier → 0–100
// Situational amplifiers, not a fixed weight table.
// ─────────────────────────────────────────────────────────────────────────────

export function fqBand(score) {
  // D-RISK-BOUNDARY-1: boundary score belongs to upper (better) band. score < threshold.
  if (score < 20) return { name: 'Exposed',     colour: '#FF6B6B' };
  if (score < 40) return { name: 'Building',    colour: '#FFB347' };
  if (score < 60) return { name: 'Established', colour: '#4D8EFF' };
  if (score < 80) return { name: 'Optimised',   colour: '#00E5A8' };
  return                  { name: 'Exceptional', colour: '#00E5A8' };
}

/**
 * FINIO-1.0 scoring engine — seven dimensions + Action Momentum multiplier → 0–100.
 * @param {object} e - entity object
 * @returns {{ total:number, band:object, dims:object, momentum:number, raw:number, daysLeft:number, coi:number, netWorthVal:number, scoringVersion:string, taxRulesVersion:string }}
 */
export function calcFQ(e) {
  const a        = e.assets || {};
  const nw       = netWorth(e);
  const retNum   = (e.targetIncome || 50000) / TAX.swr;
  const drawdown = e.drawdown || 0;
  const prot     = a.protection || {};
  const dl       = daysLeft();
  const age      = e.age || 0;
  const sipp     = a.sipp?.total || 0;
  const coi      = ihtSippDelta(e);

  // ── 1. BEHAVIOUR  max 20 · floor 15 ─────────────────────────────────────
  let behaviour = 15;
  if ((a.isa?.value || 0) > 0)   behaviour += 2;   // using ISA wrapper
  if (a.trustGifts)               behaviour += 1;   // IHT gifting in motion
  const freshNoms = (a.sipp?.pensions || []).filter(p => {
    if (!p.nominationDate) return false;
    return (Date.now() - new Date(p.nominationDate)) < 2 * 365.25 * 86400000;
  }).length;
  if (freshNoms > 0)              behaviour += 1;   // nominations current
  if (drawdown > 0 || age < 55)  behaviour += 1;   // active engagement
  behaviour = Math.min(20, behaviour);

  // ── 2. CAPITAL  max 18 ──────────────────────────────────────────────────
  const capRatio = retNum > 0 ? nw / retNum : 0;
  const capital  = capRatio >= 2.0 ? 18 : capRatio >= 1.5 ? 16 :
                   capRatio >= 1.0 ? 14 : capRatio >= 0.75 ? 12 :
                   capRatio >= 0.50 ? 10 : capRatio >= 0.25 ? 7 : 3;

  // ── 3. TAX EFFICIENCY  max 18 ────────────────────────────────────────────
  const taxBase = e.isHigherRateTaxpayer ? 4 : 6;
  let tax = taxBase;
  if (drawdown > 0)                      tax += 5;   // pension used tax-efficiently
  if ((a.isa?.value || 0) > 50000)      tax += 3;   // substantial ISA wrapper use
  if (a.trustGifts)                      tax += 2;   // IHT mitigation in place
  if ((e.payOptimisation?.taxSavingOptimised || 0) > 0) tax -= 2; // saving still on table
  tax = Math.max(1, Math.min(18, tax));

  // ── 4. PROTECTION  max 16 ────────────────────────────────────────────────
  let protection = 0;
  if (prot.lifeInsurance?.exists) {
    protection += 5;
    if (prot.lifeInsurance?.inTrust) protection += 3;
  }
  if (prot.criticalIllness?.exists)   protection += 4;
  if (prot.incomeProtection?.exists)  protection += 3;
  if (prot.relevantLifePlan?.exists)  protection += 2;
  protection = Math.min(16, protection);

  // ── 5. CASHFLOW  max 16 · floor 12 ──────────────────────────────────────
  const cashMos  = ((a.cash?.total || 0) / (e.targetIncome || 50000)) * 12;
  const cashflow = cashMos >= 24 ? 16 : cashMos >= 12 ? 14 : cashMos >= 6 ? 13 : 12;

  // ── 6. DEBT INTELLIGENCE  max 14 ────────────────────────────────────────
  // Baseline 10 until debt model is fully captured in onboarding (Phase 2)
  const debt = 10;

  // ── 7. ESTATE INTELLIGENCE  max 28 ──────────────────────────────────────
  let estPos = 0;
  if (age >= 55) estPos += 8; else if (age >= 45) estPos += 4;
  if (a.trustGifts)                   estPos += 5;
  if (prot.lifeInsurance?.inTrust)    estPos += 3;
  if ((a.residence?.value || 0) > 0)  estPos += 3;
  if (nw >= 1000000) estPos += 5; else if (nw >= 500000) estPos += 3; else if (nw >= 200000) estPos += 1;

  const coiPct      = nw > 0 ? coi / nw : 0;
  const coiPenalty  = Math.min(18, Math.round(coiPct * 150));
  const urgPenalty  = (drawdown === 0 && sipp >= 50000 && age >= 55 && dl < 500)
                       ? Math.round(Math.min(6, (500 - dl) / 83)) : 0;
  const estate = Math.max(0, Math.min(28, estPos - coiPenalty - urgPenalty));

  // ── 8. ACTION MOMENTUM  multiplier 0.60–1.20 ────────────────────────────
  let momentum = 1.0;
  // Penalties
  if (drawdown === 0 && sipp >= 100000 && age >= 60 && dl < 365)       momentum -= 0.30;
  if (!prot.lifeInsurance?.exists && nw > 300000 && age >= 55)          momentum -= 0.08;
  if (prot.lifeInsurance?.exists && !prot.lifeInsurance?.inTrust && nw > 500000) momentum -= 0.05;
  if ((a.sipp?.pensions?.length || 0) >= 3)                              momentum -= 0.03;
  if (e.hasBusiness && e.isHigherRateTaxpayer && age < 65)               momentum -= 0.08;
  if (e.hasBusiness && !prot.criticalIllness?.exists && age < 65)        momentum -= 0.03;
  // Bonuses
  if (drawdown > 0)                    momentum += 0.05;
  if (a.trustGifts)                    momentum += 0.05;
  if (prot.lifeInsurance?.inTrust)     momentum += 0.05;
  if ((a.sipp?.pensions?.length || 1) <= 2) momentum += 0.03;
  momentum = Math.max(0.60, Math.min(1.20, momentum));

  const raw   = behaviour + capital + tax + protection + cashflow + debt + estate;
  const total = Math.min(100, Math.max(0, Math.round(raw * momentum)));

  return {
    total,
    band:     fqBand(total),
    dims:     { behaviour, capital, tax, protection, cashflow, debt, estate },
    momentum, raw,
    daysLeft: dl,
    coi,
    netWorthVal:      nw,
    scoringVersion:   SCORING_VERSION,
    taxRulesVersion:  TAX.ver,
  };
}

export function fqTrajectory(e) {
  const now     = calcFQ(e);
  const partial = calcFQ({ ...e, drawdown: Math.round(guardrail(e) * 0.5) });
  const eAll    = {
    ...e,
    drawdown: Math.round(Math.min(guardrail(e), TAX.brl)),
    assets: {
      ...e.assets,
      protection: {
        ...e.assets?.protection,
        lifeInsurance: { exists: true, inTrust: true, amount: 500000, premium: 1200 },
      },
    },
  };
  const all = calcFQ(eAll);
  return [
    { label: 'Today',       score: now.total,                                      month: 0,  colour: now.band.colour  },
    { label: '2 months',    score: Math.round(now.total * 0.55 + partial.total * 0.45), month: 2, colour: '#FFB347' },
    { label: '6 months',    score: partial.total,                                  month: 6,  colour: '#4D8EFF'  },
    { label: 'All actions', score: all.total,                                      month: 12, colour: '#00E5A8'  },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// RISK-1.0 — FINANCIAL RESILIENCE ENGINE  (s07 seven-dimension spec)
// Independent from Finio Score. Measures resilience, not health.
// Bands: Exposed (0–20) · Vulnerable (21–40) · Managed (41–60) ·
//        Protected (61–80) · Resilient (81–100)
// Seven dimensions totalling 100 pts. Dimension 7 starts at 0 for all users.
// Source: s07-risk-score-formal-spec.md · 19 April 2026
// ─────────────────────────────────────────────────────────────────────────────

export function riskBand(score) {
  // D-RISK-BOUNDARY-1: boundary score belongs to upper (better) band. score < threshold.
  if (score < 20) return { name: 'Exposed',    colour: '#FF3B30' };
  if (score < 40) return { name: 'Vulnerable', colour: '#FF6B6B' };
  if (score < 60) return { name: 'Managed',    colour: '#FFB347' };
  if (score < 80) return { name: 'Protected',  colour: '#4D8EFF' };
  return                  { name: 'Resilient',  colour: '#00E5A8' };
}

// Helper: is a nomination stale (> 3 years)?
function _isStale(dateStr) {
  if (!dateStr) return true;
  return (Date.now() - new Date(dateStr)) > 3 * 365.25 * 86400000;
}

// Exported for UI (MyMoney pension drill-down). Returns per-pension status.
// Each pension row: { name, value, nominationDate, isStale, ageYears, status }
// status: 'current' (< 2y) · 'aging' (2-3y) · 'stale' (> 3y) · 'missing' (no date)
export function nominationStatus(entity) {
  const pensions = entity.assets?.sipp?.pensions || [];
  return pensions.map(p => {
    if (!p.nominationDate) {
      return { ...p, isStale: true, ageYears: null, status: 'missing' };
    }
    const ageMs = Date.now() - new Date(p.nominationDate);
    const years = ageMs / (365.25 * 86400000);
    let status = 'current';
    if (years > 3) status = 'stale';
    else if (years > 2) status = 'aging';
    return {
      ...p,
      isStale: years > 3,
      ageYears: Math.round(years * 10) / 10,
      status,
    };
  });
}

// Summary flag: does this entity have any stale / missing nomination?
export function hasStaleNomination(entity) {
  return nominationStatus(entity).some(p => p.status === 'stale' || p.status === 'missing');
}

/**
 * RISK-1.0 financial resilience engine — seven dimensions → 0–100.
 * Independent from Finio Score; measures resilience, not financial health.
 * @param {object} e - entity object
 * @returns {{ total:number, band:object, dims:object, confidenceLevel:string, scoringVersion:string, taxRulesVersion:string }}
 */
export function calcRisk(e) {
  const a        = e.assets       || {};
  const prot     = a.protection   || {};
  const income   = e.income       || {};
  const liab     = e.liabilities  || {};
  const rqRaw    = e.riskQuestionnaire || {};
  // FIX risk.md CRIT 1.1: tolerate variant spellings emitted by some persona
  // fixtures. Canonical enums are what the downstream `===` checks expect;
  // the aliases below are normalised back to canonical so the existing
  // literal-equality logic (q11 === '3-6', q13 === 'three-or-more', etc.)
  // continues to fire correctly. Keep canonical values literal downstream.
  const Q11_ALIASES = { '3-to-6': '3-6', '1-to-3': '1-3', 'less-than-1': 'under-1', 'over-six': 'over-6' };
  const Q13_ALIASES = { 'two-plus': 'three-or-more', 'multiple': 'three-or-more', 'single': 'one' };
  const rq = {
    ...rqRaw,
    q11_liquidity_months: Q11_ALIASES[rqRaw.q11_liquidity_months] || rqRaw.q11_liquidity_months,
    q13_income_sources:   Q13_ALIASES[rqRaw.q13_income_sources]   || rqRaw.q13_income_sources,
  };
  const nw       = netWorth(e);
  const drawdown = e.drawdown     || 0;
  const age      = e.age          || 0;
  const lifeStage = e.lifeStage   || 1;

  // ── D1. INCOME RESILIENCE  max 20 ─────────────────────────────────────────
  // Data-inference path: count distinct active income sources.
  const dataSources = [
    (income.employment  || 0) > 0,
    (income.dividends   || 0) > 0,
    (income.rentalIncome || 0) > 0,
    drawdown > 0,
    (income.statePension?.annual || 0) > 0 && age >= (income.statePension?.startAge || 67),
    !!(e.hasBusiness),
  ].filter(Boolean).length;
  // Q13 from seed questionnaire overrides inferred count when data is sparse.
  const q13      = rq.q13_income_sources;
  const srcCount = q13 === 'three-or-more' ? 3 : q13 === 'two' ? 2 :
                   q13 === 'one'           ? 1 : dataSources;
  const incomeRes = srcCount >= 4 ? 20 : srcCount === 3 ? 16 :
                    srcCount === 2 ? 12 : srcCount === 1 ? 8 : 4;

  // ── D2. LIQUIDITY BUFFER  max 18 ──────────────────────────────────────────
  // Data-inference: months of essential expenditure in accessible cash.
  // Target varies by life stage (s07 §3.2).
  const monthlyEssential = (e.targetIncome || 50000) / 12;
  // Use data-inference (own cash ÷ monthly) unless questionnaire overrides.
  const ownCash    = a.cash?.own ?? a.cash?.total ?? 0;
  const dataMos    = monthlyEssential > 0 ? ownCash / monthlyEssential : 0;
  const q11        = rq.q11_liquidity_months;
  const qMos       = q11 === 'over-6' ? 8 : q11 === '3-6' ? 4.5 :
                     q11 === '1-3'    ? 2 : q11 === 'under-1' ? 0.5 : null;
  const cashMos    = qMos !== null && dataMos === 0 ? qMos : dataMos;
  // Target buffer by life stage
  const bufTarget  = lifeStage >= 6 ? 18 : lifeStage >= 5 ? 12 :
                     e.hasBusiness  ? 6  : lifeStage >= 4 ? 5  :
                     lifeStage >= 2 ? 4  : 3;
  const bufRatio   = bufTarget > 0 ? cashMos / bufTarget : 0;
  const liquidity  = bufRatio >= 1.5 ? 18 : bufRatio >= 1.0 ? 15 :
                     bufRatio >= 0.7 ? 11 : bufRatio >= 0.4 ? 7  :
                     bufRatio >= 0.2 ? 3  : 0;

  // ── D3. PROTECTION COVERAGE  max 18 ───────────────────────────────────────
  // Income protection: max 7. Life insurance: max 7 (5 + 2 in-trust bonus).
  // Critical illness: max 4.
  let protCov = 0;
  const q12 = rq.q12_income_protection;
  if (prot.incomeProtection?.exists || q12 === 'yes') {
    protCov += 7;
  } else if (q12 === 'partly' || prot.relevantLifePlan?.exists) {
    protCov += 3;   // employer-only or partial cover
  }
  if (prot.lifeInsurance?.exists) {
    protCov += prot.lifeInsurance.inTrust ? 7 : 5;
  }
  if (prot.criticalIllness?.exists) protCov += 4;
  protCov = Math.min(18, protCov);

  // ── D4. DEBT VULNERABILITY  max 15 ────────────────────────────────────────
  const mortgageOut     = liab.mortgage?.outstanding || 0;
  const otherDebt       = (liab.otherLoans || []).reduce((s, l) => s + (l.outstanding || 0), 0);
  const totalDebt       = mortgageOut + otherDebt;
  const monthlyService  = (liab.mortgage?.monthlyPayment || 0) +
                          (liab.otherLoans || []).reduce((s, l) => s + (l.monthlyPayment || 0), 0);
  const annualIncome    = e.targetIncome || 50000;
  const dsr             = annualIncome > 0 ? (monthlyService * 12) / annualIncome : 0;
  const leverage        = nw > 0 ? totalDebt / nw : 0;
  const hasVariable     = liab.mortgage?.rateType === 'variable' ||
                          (liab.otherLoans || []).some(l => l.rateType === 'variable');
  let debtVuln;
  if (totalDebt === 0) {
    debtVuln = 15;
  } else {
    debtVuln = leverage < 0.30 ? 13 : leverage < 0.50 ? 10 :
               leverage < 0.70 ? 6  : 2;
    if (dsr > 0.40)      debtVuln -= 5;
    else if (dsr > 0.25) debtVuln -= 3;
    else if (dsr > 0.15) debtVuln -= 1;
    if (hasVariable && leverage > 0.30) debtVuln -= 2;
  }
  debtVuln = Math.min(15, Math.max(0, debtVuln));

  // ── D5. CONCENTRATION RISK  max 12 ────────────────────────────────────────
  const resVal       = (a.residence?.value || 0) * (a.residence?.ownershipShare || 1);
  const resPct       = nw > 0 ? resVal / nw : 0;
  const sippPct      = nw > 0 ? (a.sipp?.total || 0) / nw : 0;
  const maxAssetPct  = Math.max(resPct, sippPct);
  const assetConc    = maxAssetPct > 0.70 ? 1 : maxAssetPct > 0.55 ? 3 :
                       maxAssetPct > 0.40 ? 5 : maxAssetPct > 0.25 ? 6 : 7;
  const incConc      = srcCount >= 3 ? 5 : srcCount === 2 ? 3 : 1;
  const concRisk     = Math.min(12, assetConc + incConc);

  // ── D6. DEPENDENCY EXPOSURE  max 10 ───────────────────────────────────────
  // Low score = high exposure. High score = low vulnerability.
  // Graduated scoring per spec §8.2 (3-Engine-risk-rules-v1_1 §8):
  //   Will: 3 (current) · 1 (old/exists) · 0 (none)
  //   Nominations: 2 (all current) · 1 (some stale/partial) · 0 (none)
  //   Life in trust: 2 (in trust) · 1 (exists, not in trust) · 0 (none)
  //   LPA: 2 (both) · 1 (one/partial) · 0 (neither)
  //   Guardian (minor children only): 1 (named) · 0 (not named)
  //   No-dependants path: 9 base + 1 if both LPAs (max 10)
  const dependants    = e.dependants || [];
  const minorChildren = dependants.filter(d => d.type === 'child' && (d.age || 0) < 18);
  const hasDependants = dependants.some(d => d.financiallyDependent !== false) ||
                        (e.isCouple && dependants.length === 0);  // couple have mutual dependency
  const pensions      = a.sipp?.pensions || [];

  // Will score: 3=current, 1=old/exists, 0=absent
  const willScore = e.willStatus === 'current' ? 3 : e.willStatus ? 1 : 0;

  // LPA score: 2=both, 1=one instrument, 0=neither
  const lpaScore = e.lpaStatus === 'both' ? 2
                 : (e.lpaStatus === 'one' || e.lpaStatus === 'pf' || e.lpaStatus === 'hw') ? 1
                 : 0;

  // Life insurance in trust score: 2=in trust, 1=exists not in trust, 0=absent
  const trustScore = (prot.lifeInsurance?.exists && prot.lifeInsurance?.inTrust) ? 2
                   : prot.lifeInsurance?.exists ? 1
                   : 0;

  // Nomination score: 2=all current, 1=some stale or partial, 0=none/unknown
  const nomAllCurrent = rq.d6_nominations_complete === 'all' ||
                        (pensions.length > 0 && pensions.every(p => !_isStale(p.nominationDate)));
  const nomSomeNamed  = pensions.length > 0 && pensions.some(p => p.nominationDate);
  const nomScore = nomAllCurrent ? 2 : (nomSomeNamed || rq.d6_nominations_complete === 'some') ? 1 : 0;

  // Guardian score (only relevant if minor children present): 1=named, 0=not named
  const guardianScore = minorChildren.length === 0 ? 1   // N/A → treat as no penalty
                      : e.guardianNamed ? 1 : 0;

  let depExp;
  if (!hasDependants) {
    // Single with no dependants: structurally low exposure (spec §8.2 default rule)
    depExp = 9 + (e.lpaStatus === 'both' ? 1 : 0);
  } else {
    depExp = willScore + nomScore + trustScore + lpaScore + guardianScore;
  }
  depExp = Math.min(10, Math.max(0, depExp));

  // ── D7. BEHAVIOURAL TRACK RECORD  max 7 ────────────────────────────────────
  // Observed, not answered. Always 0 at first capture for all users.
  // Accumulates from Finio event log over platform tenure (Part 11).
  const behaviouralTrack = 0;

  // ── CONFIDENCE LEVEL ───────────────────────────────────────────────────────
  const seedAnswered = [rq.q11_liquidity_months, rq.q12_income_protection, rq.q13_income_sources]
    .filter(Boolean).length;
  const hasDrillDown = !!(rq.d6_nominations_complete || rq.d4_debt_service_pct || rq.d6_will_current);
  const hasFinData   = (a.sipp?.total || 0) > 0 || (a.cash?.total || 0) > 0;
  let confidenceLevel = rq.confidenceLevel ||
    (seedAnswered >= 3 && hasDrillDown && hasFinData ? 'medium' :
     seedAnswered >= 2 || hasFinData                 ? 'low'    : 'low');

  // ── TOTAL ──────────────────────────────────────────────────────────────────
  const rawRisk = incomeRes + liquidity + protCov + debtVuln + concRisk + depExp + behaviouralTrack;
  const total   = Math.min(100, Math.max(0, rawRisk));

  return {
    total,
    band:   riskBand(total),
    dims: {
      incomeRes,           // D1 — Income Resilience         max 20
      liquidity,           // D2 — Liquidity Buffer          max 18
      protCov,             // D3 — Protection Coverage       max 18
      debtVuln,            // D4 — Debt Vulnerability        max 15
      concRisk,            // D5 — Concentration Risk        max 12
      depExp,              // D6 — Dependency Exposure       max 10
      behaviouralTrack,    // D7 — Behavioural Track Record  max  7
    },
    confidenceLevel,
    scoringVersion:  RISK_VERSION,
    taxRulesVersion: TAX.ver,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FINANCIAL PROFILE — 5×5 CROSS-MAP  (Invention 19 · s07 §8)
// Every combination of Finio Score band × Risk Score band → named profile.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 5×5 cross-map of Finio Score band × Risk Score band → named financial profile.
 * @param {object} e - entity object
 * @returns {{ fqScore:number, fqBand:string, riskScore:number, riskBand:string, profileKey:string, profileName:string, profileImplication:string, confidenceLevel:string }}
 */
export function financialProfile(e) {
  const fq   = calcFQ(e);
  const risk = calcRisk(e);

  // Cell names: v1.1 §4.9 canonical list. Key format: {fq_band}_{rs_band} (lowercase).
  // Chip display (D-RISK-1): two-line name joined with " · " separator.
  const PROFILES = {
    'exceptional_exposed':    { name: 'Exceptional finances / dangerously exposed',   implication: 'Exceptional finances — but one serious shock could be devastating. Resilience is urgent.' },
    'exceptional_vulnerable': { name: 'Exceptional finances / structurally fragile',  implication: 'Exceptional financial health with meaningful gaps in your resilience structure.' },
    'exceptional_managed':    { name: 'Exceptional finances / risk managed',          implication: 'Exceptional finances with core risks addressed — close the remaining gaps.' },
    'exceptional_protected':  { name: 'Exceptional finances / well protected',        implication: 'Exceptional finances and strong resilience — minor refinements remain.' },
    'exceptional_resilient':  { name: 'Exceptional / and resilient',                  implication: 'The Caelixa ideal — exceptional financial health and complete resilience.' },

    'optimised_exposed':      { name: 'Solid progress / seriously exposed',           implication: 'Strong finances but serious structural vulnerabilities that need urgent attention.' },
    'optimised_vulnerable':   { name: 'Solid progress / structurally at risk',        implication: 'Strong financial position with meaningful protection gaps to address.' },
    'optimised_managed':      { name: 'Solid / and balanced',                         implication: 'Good financial health with core risks addressed — keep optimising.' },
    'optimised_protected':    { name: 'Solid / and protected',                        implication: 'Strong finances with good resilience — well positioned for what comes next.' },
    'optimised_resilient':    { name: 'Solid / and resilient',                        implication: 'Strong finances and excellent resilience — focus on continued optimisation.' },

    'established_exposed':    { name: 'Established / but exposed',                   implication: 'Making solid financial progress but seriously vulnerable to shocks.' },
    'established_vulnerable': { name: 'Established / needs protection',               implication: 'Solid financial foundations with significant protection gaps.' },
    'established_managed':    { name: 'Stable / and managed',                         implication: 'Solid finances with risks broadly managed — keep building on both.' },
    'established_protected':  { name: 'Stable / and protected',                       implication: 'Solid financial progress with a good resilience structure in place.' },
    'established_resilient':  { name: 'Established / and resilient',                  implication: 'Solid finances and strong resilience — accelerate the financial build.' },

    'building_exposed':       { name: 'Building / on unstable ground',                implication: 'Building your financial position from a vulnerable base — prioritise resilience.' },
    'building_vulnerable':    { name: 'Building / with real risk',                    implication: 'Building your finances with some resilience in place — close the gaps.' },
    'building_managed':       { name: 'Building / risk managed',                      implication: 'Financial build underway with risks broadly managed — stay the course.' },
    'building_protected':     { name: 'Building / and protected',                     implication: 'Financial build with strong resilience foundations — focus on growing wealth.' },
    'building_resilient':     { name: 'Building / strong foundations',                implication: 'Building wealth from a very resilient base — excellent structural position.' },

    'exposed_exposed':        { name: 'Fragile / and exposed',                        implication: 'Both your financial position and resilience need immediate focus.' },
    'exposed_vulnerable':     { name: 'Fragile / risk aware',                         implication: 'Limited financial position but some resilience awareness in place.' },
    'exposed_managed':        { name: 'Fragile / some protection',                    implication: 'Limited finances but risks are broadly managed — focus on building.' },
    'exposed_protected':      { name: 'Fragile / but well covered',                   implication: 'Limited financial position but excellent resilience structure.' },
    'exposed_resilient':      { name: 'Structural gap / strong protection',           implication: 'Limited wealth but exceptional resilience — your foundation is strong.' },
  };

  const key     = `${fq.band.name.toLowerCase()}_${risk.band.name.toLowerCase()}`;
  const profile = PROFILES[key] || { name: `${fq.band.name} · ${risk.band.name}`, implication: '' };

  // chipName: two-part name joined for single-line D-RISK-1 chip display (v1.1 §4.9).
  const chipName = profile.name.includes('/')
    ? profile.name.split('/').map(s => s.trim()).join(' · ')
    : profile.name;

  return {
    fqScore:            fq.total,
    fqBand:             fq.band.name,
    riskScore:          risk.total,
    riskBand:           risk.band.name,
    profileKey:         key,
    profileName:        profile.name,
    chipName,
    profileImplication: profile.implication,
    confidenceLevel:    risk.confidenceLevel,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION PRIORITY QUEUE (APQ)
// Ranked list of recommended actions. Notifications read from this.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Action Priority Queue — ranked list of recommended client actions.
 * Read by the notifications layer and Priority Actions card.
 * @param {object} e - entity object
 * @returns {Array<{id:string, priority:number, colour:string, title:string, detail:string, impact:object, screen:string}>}
 */
export function calcAPQ(e) {
  const a   = e.assets || {};
  const prot = a.protection || {};
  const dl   = daysLeft();
  const age  = e.age || 0;
  const nw   = netWorth(e);
  const coi  = ihtSippDelta(e);
  const fq   = calcFQ(e);
  const risk = calcRisk(e);
  const actions = [];

  // Pension drawdown — critical if SIPP at risk and no drawdown
  if ((e.drawdown || 0) === 0 && (a.sipp?.total || 0) >= 50000 && age >= 55 && dl < 500) {
    const fqWith = calcFQ({ ...e, drawdown: Math.round(guardrail(e) * 0.6) });
    actions.push({
      id: 'pension-drawdown', priority: 1, colour: '#FF3B30',
      title: 'Start pension drawdown',
      detail: `${fmt(coi)} cost of inaction. ${dl} days to act before SIPP enters estate.`,
      impact: { finioScore: fqWith.total - fq.total, coi, deadline: TAX.deadline },
      screen: 'tax',
    });
  }

  // Life insurance not in trust
  if (!prot.lifeInsurance?.exists && nw > 200000) {
    actions.push({
      id: 'life-insurance', priority: nw > 500000 ? 1 : 2, colour: '#FF6B6B',
      title: 'Arrange life insurance in trust',
      detail: 'No life cover in place. Estate of ' + fmt(nw) + ' has no protection against early death.',
      impact: { finioScore: 8, riskScore: 8, deadline: null },
      screen: 'money',
    });
  } else if (prot.lifeInsurance?.exists && !prot.lifeInsurance?.inTrust && nw > 300000) {
    actions.push({
      id: 'life-in-trust', priority: 2, colour: '#FF9500',
      title: 'Place life insurance in trust',
      detail: 'Life insurance in your estate adds to IHT exposure. A discretionary trust removes it.',
      impact: { finioScore: 4, riskScore: 3, deadline: null },
      screen: 'money',
    });
  }

  // ISA allowance
  if ((a.cash?.total || 0) > 20000) {
    actions.push({
      id: 'isa-allowance', priority: 3, colour: '#4D8EFF',
      title: `Use ${fmt(TAX.isaAllowance)} ISA allowance`,
      detail: 'Move from taxable cash into ISA wrapper before 5 April.',
      impact: { finioScore: 2, deadline: new Date(new Date().getFullYear(), 3, 5) },
      screen: 'money',
    });
  }

  // CGT allowance — Bed and ISA
  if ((a.portfolio?.value || 0) > 0 && !a.portfolio?.bpr) {
    actions.push({
      id: 'cgt-bedisa', priority: 3, colour: '#4D8EFF',
      title: `Use ${fmt(TAX.cgaAllowance)} CGT allowance`,
      detail: 'Bed-and-ISA to shelter gains from future CGT. Annual allowance resets 6 April.',
      impact: { finioScore: 1, deadline: new Date(new Date().getFullYear(), 3, 5) },
      screen: 'money',
    });
  }

  // Pension consolidation
  if ((a.sipp?.pensions?.length || 0) >= 3) {
    actions.push({
      id: 'pension-consolidate', priority: 3, colour: '#4D8EFF',
      title: 'Consider pension consolidation',
      detail: `${a.sipp.pensions.length} pensions detected. Consolidating reduces charges and simplifies nominations.`,
      impact: { finioScore: 3, deadline: null },
      screen: 'money',
    });
  }

  // Nomination review
  const staleNoms = (a.sipp?.pensions || []).filter(p => {
    if (!p.nominationDate) return true;
    return (Date.now() - new Date(p.nominationDate)) > 3 * 365.25 * 86400000;
  });
  if (staleNoms.length > 0) {
    actions.push({
      id: 'nominations', priority: 3, colour: '#4D8EFF',
      title: 'Update pension nominations',
      detail: `${staleNoms.length} pension(s) have nominations older than 3 years.`,
      impact: { finioScore: 1, deadline: null },
      screen: 'money',
    });
  }

  // Business pay optimisation
  if (e.hasBusiness && e.isHigherRateTaxpayer && (e.payOptimisation?.taxSavingOptimised || 0) > 0) {
    actions.push({
      id: 'pay-optimise', priority: 2, colour: '#FF9500',
      title: 'Optimise salary / dividend / pension split',
      detail: `${fmt(e.payOptimisation.taxSavingOptimised)} annual tax saving available. Review extraction strategy.`,
      impact: { finioScore: 5, deadline: new Date(new Date().getFullYear(), 3, 5) },
      screen: 'money',
    });
  }

  // Sort: priority 1 first, then by finioScore impact descending
  return actions.sort((a, b) =>
    a.priority !== b.priority ? a.priority - b.priority :
    (b.impact?.finioScore || 0) - (a.impact?.finioScore || 0)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MONTE CARLO — LONGEVITY PROBABILITY ENGINE
// Target: 500 sequences with cohort life table weighting.
// Background queue infrastructure required for full build (Phase 2).
// Current: deterministic approximation with configurable runs.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Monte Carlo longevity probability — deterministic approximation until background queue is live.
 * @param {object} e - entity object
 * @param {number} [targetAge=90]
 * @param {number} [runs=100]
 * @returns {{ probability:number, targetAge:number, runs:number, label:string, scoringVersion:string }}
 */
export function longevityProbability(e, targetAge = 90, runs = 100) {
  const base    = e.age || 65;
  const years   = Math.max(0, targetAge - base);
  const inv     = investable(e);
  const sp      = e.income?.statePension?.annual || 0;
  const spAge   = e.income?.statePension?.startAge || 67;
  const spend   = e.targetIncome || 50000;
  const growth  = (e.assets?.sipp?.growth || 0.05);
  let survived  = 0;

  for (let r = 0; r < runs; r++) {
    let wealth = inv;
    for (let y = 0; y < years; y++) {
      const spInc   = (base + y) >= spAge ? sp : 0;
      const shock   = 1 + (growth - 0.02) + (Math.random() - 0.5) * 0.14; // ±7% vol
      const drawAmt = Math.max(0, spend - spInc - (e.drawdown || 0));
      wealth = wealth * shock - drawAmt;
      if (wealth <= 0) break;
    }
    if (wealth > 0) survived++;
  }

  return {
    probability:    Math.round((survived / runs) * 100),
    targetAge,
    runs,
    label:          `${Math.round((survived / runs) * 100)}% chance funds last to age ${targetAge}`,
    scoringVersion: 'MC-LITE-1.0',  // upgrade to MC-1.0 when background queue is live
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SOLVER FRAMEWORK — Gauss-Seidel with adaptive damping
// Resolves circular dependencies in the engine dependency graph.
// Currently stubbed: no circular deps in persona data yet exercises it.
// Convergence: delta < £1 across all nodes. Max 50 iterations.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gauss-Seidel solver with adaptive SOR damping for circular engine dependencies.
 * @param {function} stateFn - (state) => nextState
 * @param {object} initialState
 * @param {number} [maxIter=50]
 * @param {number} [tolerance=1] - convergence threshold (£1)
 * @returns {{ state:object, iterations:number, converged:boolean, delta:number }}
 */
export function solverIterate(stateFn, initialState, maxIter = 50, tolerance = 1) {
  let state  = { ...initialState };
  let omega  = 0.80;  // initial SOR damping factor
  let prevDelta = Infinity;

  for (let i = 0; i < maxIter; i++) {
    const next  = stateFn(state);
    const delta = Object.keys(next).reduce((sum, k) =>
      sum + Math.abs((next[k] || 0) - (state[k] || 0)), 0);

    if (delta < tolerance) return { state: next, iterations: i + 1, converged: true, delta };

    // Adaptive damping: increase omega if converging faster, decrease if oscillating
    omega = delta < prevDelta ? Math.min(1.20, omega * 1.05) : Math.max(0.50, omega * 0.85);
    state = Object.fromEntries(
      Object.keys(next).map(k => [k, state[k] + omega * ((next[k] || 0) - (state[k] || 0))])
    );
    prevDelta = delta;
  }

  return { state, iterations: maxIter, converged: false, delta: prevDelta };
}

// ─────────────────────────────────────────────────────────────────────────────
// TRADING 212 INTEGRATION — Finio Lab only
// Gated by VITE_TRADING212_API_KEY. Never available to other users.
// Maps T212 positions into Finio portfolio format for engine consumption.
// ─────────────────────────────────────────────────────────────────────────────

const T212_KEY  = import.meta.env?.VITE_TRADING212_API_KEY;
const T212_BASE = 'https://live.trading212.com/api/v0';

export async function fetchT212Portfolio() {
  if (!T212_KEY) return null;
  try {
    const [pos, cash] = await Promise.all([
      fetch(`${T212_BASE}/equity/portfolio`,       { headers: { Authorization: T212_KEY } })
        .then(r => r.ok ? r.json() : null),
      fetch(`${T212_BASE}/equity/account/cash`,    { headers: { Authorization: T212_KEY } })
        .then(r => r.ok ? r.json() : null),
    ]);
    return { positions: pos, cash };
  } catch { return null; }
}

// ── calcFQCalibrated — kept for HomeScreen compatibility ──────────────────────
// Applies a situational inaction penalty for personas with large undrawn SIPPs.
// This is a presentation wrapper only — it does not modify fq-calculator logic.
export function calcFQCalibrated(e) {
  const base = calcFQ(e);
  const sippAtRisk = (e.assets?.sipp?.total || 0) >= 100000 &&
                     (e.drawdown || 0) === 0 &&
                     (e.age || 0) >= 60;
  if (!sippAtRisk) return base;
  const capital_capped = Math.min(13, base.dims.capital);
  const momentum_adj   = Math.max(0.82, base.momentum - 0.08);
  const raw = base.dims.behaviour + capital_capped + base.dims.tax +
              base.dims.protection + base.dims.cashflow +
              base.dims.debt + base.dims.estate;
  const total = Math.min(100, Math.max(0, Math.round(raw * momentum_adj)));
  return { ...base, total, dims: { ...base.dims, capital: capital_capped }, momentum: momentum_adj };
}

export function mapT212ToPortfolio(t212Data) {
  if (!t212Data?.positions) return null;
  const positions = t212Data.positions;
  const totalVal  = positions.reduce((s, p) => s + (p.currentValue || 0), 0);
  return {
    value:  Math.round(totalVal),
    growth: 0.05,   // updated when YTD return is available
    bpr:    false,
    ret:    positions.length > 0
              ? positions.reduce((s, p) => s + ((p.ppl || 0) / (p.value || 1)), 0) / positions.length
              : 0,
    holdings: positions.map(p => ({
      ticker: p.ticker,
      name:   p.fullName || p.ticker,
      val:    fmt(p.currentValue || 0),
      pct:    p.currentValue ? ((p.ppl / p.currentValue) * 100).toFixed(1) + '%' : '—',
      up:     (p.ppl || 0) >= 0,
    })),
    source: 'trading212',
    lastSync: new Date().toISOString(),
  };
}

// ============================================================================
// WAVE 0 — ENGINE EXTENSIONS (stub functions for Wave 1/2 screens)
// All functions below are signatures with placeholder defaults.
// Real calculation logic is implemented at s02a.
// Do not modify any function above this line.
// ============================================================================

// ---------- Task 0.2: Time-window functions (X28) ----------

// STUB: implement at s02a
export function getTimeWindow(entity) {
  return {
    id: 'current-tax-year',
    start: '2026-04-06',
    end: '2027-04-05',
    label: 'Tax Year 2026/27',
  };
}

// STUB: implement at s02a
export function getViewMode(entity, screen) {
  return 'actual';
}

// STUB: implement at s02a
export function applyTimeWindow(data, window, aggregation) {
  return data;
}

// ---------- Task 0.3: Plan functions ----------

/**
 * Returns the active plan envelope for a given planType, or null if none exists.
 * Reads from entity.plans[] (per spec: 4-arg variant honours optional window for
 * type+window-scoped plans). Spec: 2-Product-home-v1_4.md §Plan layer.
 *
 * CANONICAL plan types (the only values stored on persona plans[]):
 *   - 'retirement'   — long-horizon wealth / drawdown / FI plan
 *   - 'estate'       — IHT mitigation, gifting trail, residence-NRB
 *   - 'gift'         — annual exemptions + lifetime gifting cadence
 *   - 'tax'          — wrapper sequencing, allowance utilisation, ANI cliffs
 *   - 'protection'   — life / IP / CIC coverage targets
 *
 * ALIAS MAP — callers (HomeScreen Card 5, etc.) sometimes ask for friendlier
 * UI-facing names. They are resolved to the canonical type before filtering
 * so the lookup actually finds something. Without this, Home Card 5 was
 * always empty (FIX R3: callers passed 'wealth' but personas store 'retirement').
 *   wealth   → retirement
 *   cashflow → retirement
 *   debt     → tax
 *   custom   → retirement
 *
 * CANONICAL
 * @param {object} entity
 * @param {string} planType - canonical type or alias (see above)
 * @param {string|object} [window] - optional time-window filter
 * @returns {object|null}
 */
export function planFor(entity, planType, window) {
  if (!entity || !planType) return null;
  const PLAN_TYPE_ALIASES = { wealth: 'retirement', cashflow: 'retirement', debt: 'tax', custom: 'retirement' };
  const resolvedType = PLAN_TYPE_ALIASES[planType] || planType;
  const plans = entity.plans || entity.plan || [];
  const list  = Array.isArray(plans) ? plans : (plans[resolvedType] ? [plans[resolvedType]] : []);
  const match = list.find(p => p && (p.type === resolvedType || p.planType === resolvedType));
  if (!match) return null;
  // If window specified, narrow if plan has a targetWindow
  if (window && match.targetWindow && JSON.stringify(match.targetWindow) !== JSON.stringify(window)) {
    return null;
  }
  return {
    id:               match.id || `plan-${resolvedType}-${entity.id || 'anon'}`,
    type:             resolvedType,
    target:           match.target ?? match.targetValue ?? null,
    baseline:         match.baseline ?? match.baselineValue ?? null,
    targetWindow:     match.targetWindow || window || null,
    lastReviewedAt:   match.lastReviewedAt || match.committedAt || null,
    committedAt:      match.committedAt || null,
    actions:          match.actions || [],
    status:           match.status || 'active',
  };
}

/**
 * Commits (writes) a plan envelope to the event store.
 * Stub event-store sink: returns the event envelope; integration layer attaches
 * to Supabase or in-memory store. Idempotent: same input yields same eventId hash.
 * CANONICAL
 * @param {object} entity
 * @param {object} plan - plan envelope (as returned by planFor)
 * @returns {{ eventId: string, type: string, ts: string, payload: object }}
 */
export function commitPlan(entity, plan) {
  // Old 3-arg call shape: commitPlan(entity, planType, planData)
  let p = plan;
  if (typeof plan === 'string' && arguments.length === 3) {
    // eslint-disable-next-line prefer-rest-params
    p = { ...arguments[2], type: plan };
  }
  const ts        = new Date().toISOString();
  const planType  = p?.type || p?.planType || 'unknown';
  const eventId   = `plan-commit-${entity?.id || 'anon'}-${planType}-${Date.now()}`;
  return {
    eventId,
    type:    'plan.committed',
    ts,
    payload: {
      entityId: entity?.id || null,
      plan: {
        id:             p?.id || eventId,
        type:           planType,
        target:         p?.target ?? null,
        baseline:       p?.baseline ?? null,
        targetWindow:   p?.targetWindow || null,
        actions:        p?.actions || [],
        committedAt:    ts,
        lastReviewedAt: ts,
        status:         'active',
      },
    },
  };
}

/**
 * Returns staleness diagnostics for a given plan.
 * A plan is "stale" if no review event has occurred in N months (default 6).
 * CANONICAL
 * @param {object} entity
 * @param {string} planType
 * @returns {{ stale:boolean, monthsSinceReview:number|null, reason:string, severity:string }}
 */
export function planStaleness(entity, planType) {
  const p = planFor(entity, planType);
  if (!p) {
    return { stale: false, monthsSinceReview: null, reason: 'No plan committed', severity: 'none' };
  }
  const last = p.lastReviewedAt ? new Date(p.lastReviewedAt) : null;
  if (!last || isNaN(last.getTime())) {
    return { stale: true, monthsSinceReview: null, reason: 'No review timestamp', severity: 'high' };
  }
  const months = (Date.now() - last.getTime()) / (30.44 * 86400000);
  const stale  = months > 6;
  const severity = months > 12 ? 'high' : months > 9 ? 'med' : months > 6 ? 'low' : 'none';
  return {
    stale,
    monthsSinceReview: Math.round(months * 10) / 10,
    reason: stale ? `Last reviewed ${months.toFixed(1)} months ago` : 'Plan current',
    severity,
  };
}

/**
 * Lists plans whose actions or targets conflict with each other.
 * Two plans conflict if they target overlapping resources (e.g. same SIPP) with
 * opposing directions, or if their committed dates are < 7 days apart and same domain.
 * CANONICAL
 * @param {object} entity
 * @returns {Array<{planA:string, planB:string, reason:string}>}
 */
export function planConflicts(entity) {
  const plans = Array.isArray(entity?.plans) ? entity.plans : [];
  const conflicts = [];
  for (let i = 0; i < plans.length; i++) {
    for (let j = i + 1; j < plans.length; j++) {
      const a = plans[i], b = plans[j];
      if (a.type === b.type && a.targetWindow && b.targetWindow &&
          JSON.stringify(a.targetWindow) === JSON.stringify(b.targetWindow)) {
        conflicts.push({
          planA: a.id || `plan-${i}`,
          planB: b.id || `plan-${j}`,
          reason: `Two ${a.type} plans for the same window`,
        });
      }
    }
  }
  return conflicts;
}

// ---------- Task 0.4: Forecast and variance functions ----------

/**
 * Forecast a metric over a time window. Synthesises projection from current
 * value + life-stage growth assumption. Real CMA-driven forecasts come from
 * domain engines (cashflow-engine.fiveCashflowScenarios).
 * CANONICAL
 * @param {object} entity
 * @param {string} metric - 'netWorth' | 'wealthScore' | 'riskScore' | 'sipp' | etc.
 * @param {string|object} [window] - '12mo' | '5yr' | { months: 24 }
 * @returns {Array<{date:string, value:number, confidence:string}>}
 */
export function forecastFor(entity, metric, window) {
  if (!entity || !metric) return [];
  const months = _parseWindowMonths(window) || 12;
  const out    = [];
  const today  = new Date();
  let baseVal;
  let growth = 0.05;
  switch (metric) {
    case 'netWorth':    baseVal = netWorth(entity); break;
    case 'investable':  baseVal = investable(entity); break;
    case 'sipp':        baseVal = _pensionTotal(entity); break;
    case 'isa':         baseVal = _isaTotal(entity); break;
    case 'wealthScore': baseVal = calcFQ(entity).total;  growth = 0.005; break;
    case 'riskScore':   baseVal = calcRisk(entity).total; growth = 0.005; break;
    default:            baseVal = 0;
  }
  const monthlyG = Math.pow(1 + growth, 1/12);
  let cur = baseVal;
  for (let m = 0; m <= months; m++) {
    const d = new Date(today.getFullYear(), today.getMonth() + m, 1);
    out.push({
      date: d.toISOString().split('T')[0],
      value: Math.round(cur),
      confidence: 'LOW',  // synthesised, not history-driven
    });
    cur *= monthlyG;
  }
  return out;
}

function _parseWindowMonths(window) {
  if (window == null) return null;
  if (typeof window === 'object') return window.months || window.weeks/4 || null;
  if (typeof window === 'string') {
    const m = window.match(/(\d+)\s*(mo|m|months?|y|yrs?|years?)/i);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    return /y/i.test(m[2]) ? n * 12 : n;
  }
  if (typeof window === 'number') return window;
  return null;
}

/**
 * Variance between two modes (e.g. 'actual' vs 'plan') over a window.
 * 4-arg signature per spec patch: varianceFor(entity, mode1, mode2, window).
 * 3-arg back-compat: varianceFor(entity, mode, window) — mode2 defaults to 'plan'.
 * CANONICAL
 * @param {object} entity
 * @param {string} mode1 - e.g. 'actual'
 * @param {string} [mode2='plan'] - e.g. 'plan' | 'forecast'
 * @param {string|object} [window]
 * @returns {{ variance:number, pct:number, direction:string, mode1:string, mode2:string, window:any }}
 */
export function varianceFor(entity, mode1, mode2, window) {
  // Detect 3-arg back-compat: varianceFor(e, mode, window)
  if (mode2 != null && typeof mode2 === 'string' && (mode2.match(/(mo|m|y|months?|years?)/i) || (typeof mode2 === 'object'))) {
    window = mode2;
    mode2 = 'plan';
  }
  mode2 = mode2 || 'plan';
  const series1 = forecastFor(entity, 'netWorth', window);
  const baseVal = (s) => s.length ? s[s.length - 1].value : 0;
  const v1 = baseVal(series1);
  // mode2 'plan' uses planFor target if available
  let v2 = v1;
  if (mode2 === 'plan') {
    const p = planFor(entity, 'netWorth') || planFor(entity, 'wealthScore');
    v2 = p?.target ?? v1;
  }
  const variance = v1 - v2;
  return {
    variance,
    pct: v2 ? Math.round((variance / v2) * 1000) / 10 : 0,
    direction: variance > 0 ? 'ahead' : variance < 0 ? 'behind' : 'neutral',
    mode1, mode2,
    window: window || '12mo',
  };
}

// ---------- Task 0.5: Diff / causality functions (X29) ----------

// STUB: implement at s02a
export function diffSet(entity, sinceTimestamp) {
  return [];
}

// STUB: implement at s02a
export function causalityChain(entity, metricChange) {
  return { chain: [], plainEnglish: 'No changes detected' };
}

// STUB: implement at s02a
export function acknowledgeDiff(entity, diffId) {
  return true;
}

// ---------- Task 0.6: Action / goal-seek functions (X24) ----------

// STUB: implement at s02a
export function actionsForAssetType(assetType) {
  return [];
}

// STUB: implement at s02a
export function actionsForComponent(entity, componentId) {
  return [];
}

/**
 * Simulates an action against the entity and returns score/networth deltas.
 * Action shape: { kind: 'drawdown'|'isa-fund'|'gift'|'protection-add', amount?: number }
 * Pure: does NOT mutate entity. Clones, applies, recomputes scores, diffs.
 * CANONICAL
 * @param {object} entity
 * @param {{kind:string, amount?:number, target?:string}} action
 * @returns {{ netWorthDelta:number, scoreDelta:number, riskDelta:number, ihtDelta:number }}
 */
export function simulateAction(entity, action) {
  if (!entity || !action) return { netWorthDelta: 0, scoreDelta: 0, riskDelta: 0, ihtDelta: 0 };
  const baseScore = calcFQ(entity).total;
  const baseRisk  = calcRisk(entity).total;
  const baseNW    = netWorth(entity);
  const baseIHT   = ihtDynamic(entity, true).iht;
  // Clone & mutate
  const e2 = JSON.parse(JSON.stringify(entity));
  const amt = +action.amount || 0;
  switch (action.kind) {
    case 'drawdown':
      e2.drawdown = (e2.drawdown || 0) + amt;
      break;
    case 'isa-fund': {
      e2.assets = e2.assets || {};
      if (e2.assets.isa) {
        e2.assets.isa.value = (e2.assets.isa.value || 0) + amt;
      } else {
        e2.assets.isa = { value: amt, growth: 0.05 };
      }
      if (e2.assets.cash?.total != null) e2.assets.cash.total = Math.max(0, e2.assets.cash.total - amt);
      break;
    }
    case 'gift':
      e2.assets = e2.assets || {};
      e2.assets.trustGifts = e2.assets.trustGifts || { each: 0, total: 0, date: new Date().toISOString().split('T')[0] };
      e2.assets.trustGifts.total = (e2.assets.trustGifts.total || 0) + amt;
      if (e2.assets.cash?.total != null) e2.assets.cash.total = Math.max(0, e2.assets.cash.total - amt);
      break;
    case 'protection-add':
      e2.assets = e2.assets || {};
      e2.assets.protection = e2.assets.protection || {};
      e2.assets.protection.lifeInsurance = { exists: true, amount: amt || 500000, inTrust: !!action.target?.includes('trust'), premium: 1200 };
      break;
  }
  return {
    netWorthDelta: netWorth(e2) - baseNW,
    scoreDelta:    calcFQ(e2).total - baseScore,
    riskDelta:     calcRisk(e2).total - baseRisk,
    ihtDelta:      ihtDynamic(e2, true).iht - baseIHT,
  };
}

/**
 * Solves for action paths that move targetMetric to targetValue within targetWindow.
 * Real binary-search solver across action space {drawdown, isa-fund, gift, protection-add}.
 * Returns ranked list of single-action paths that achieve the target (or come closest).
 * CANONICAL
 * @param {object} entity
 * @param {string} targetMetric - 'wealthScore' | 'riskScore' | 'netWorth' | 'iht'
 * @param {number} targetValue
 * @param {string|object} [targetWindow]
 * @param {object} [constraints]
 * @returns {Array<{action:object, achieves:number, gap:number, confidence:string}>}
 */
export function goalSeek(entity, targetMetric, targetValue, targetWindow, constraints) {
  if (!entity || targetMetric == null || targetValue == null) return [];
  const KINDS  = ['drawdown', 'isa-fund', 'gift', 'protection-add'];
  const inv    = investable(entity);
  const limit  = constraints?.maxAction ?? Math.max(50000, Math.min(inv, 500000));
  const paths  = [];
  for (const kind of KINDS) {
    // Binary search on amount in [0, limit]
    let lo = 0, hi = limit, best = null;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      const sim = simulateAction(entity, { kind, amount: mid });
      let achieves;
      switch (targetMetric) {
        case 'wealthScore': achieves = calcFQ(entity).total + sim.scoreDelta; break;
        case 'riskScore':   achieves = calcRisk(entity).total + sim.riskDelta; break;
        case 'netWorth':    achieves = netWorth(entity) + sim.netWorthDelta; break;
        case 'iht':         achieves = ihtDynamic(entity, true).iht + sim.ihtDelta; break;
        default:            achieves = sim.scoreDelta;
      }
      const gap = Math.abs(targetValue - achieves);
      if (!best || gap < best.gap) {
        best = { action: { kind, amount: Math.round(mid) }, achieves: Math.round(achieves), gap: Math.round(gap), confidence: 'MED' };
      }
      // For descending metrics (iht), invert direction
      if (targetMetric === 'iht') {
        if (achieves < targetValue) hi = mid; else lo = mid;
      } else {
        if (achieves < targetValue) lo = mid; else hi = mid;
      }
    }
    if (best) paths.push(best);
  }
  return paths.sort((a, b) => a.gap - b.gap);
}

// STUB: implement at s02a
export function solveForVariables(entity, fixedMetrics, freeVariables, target) {
  return [];
}

// STUB: implement at s02a
export function rippleEffect(entity, change) {
  return [];
}

// STUB: implement at s02a
export function lifeEventPaths(entity, targetMetric, targetValue) {
  return [];
}

// STUB: implement at s02a
export function aiFollowUp(entity, committedAction) {
  return { suggestion: null };
}

// ---------- Task 0.7: Pride / celebration functions (X26) ----------

// STUB: implement at s02a
export function milestoneCheck(entity) {
  return [];
}

// STUB: implement at s02a
export function streakCheck(entity) {
  return { active: false, days: 0 };
}

// STUB: implement at s02a
export function celebrationTrigger(entity, event) {
  return null;
}

// ---------- Task 0.8: Estate functions (X27) ----------

/**
 * Beneficiary analysis: who inherits what, and the effective post-IHT rate.
 * CANONICAL
 * @param {object} entity
 * @returns {{ beneficiaries:Array, effectiveRate:number, gross:number, net:number }}
 */
export function beneficiaryAnalysis(entity) {
  const iht = ihtDynamic(entity, true);
  const beneficiaries = [];
  // From legacy nominations
  const pensions = entity?.assets?.sipp?.pensions || [];
  for (const p of pensions) {
    if (p.nomination?.beneficiaries) {
      for (const b of p.nomination.beneficiaries) {
        beneficiaries.push({ source: p.name || p.id, name: b.name || b.relation, pct: b.pct || 0, type: 'pension' });
      }
    }
  }
  // Nested mrT-style
  const npens = entity?.assets?.pensions || [];
  for (const p of npens) {
    if (p.nomination?.beneficiaries) {
      for (const b of p.nomination.beneficiaries) {
        beneficiaries.push({ source: p.id, name: b.name || b.relation, pct: b.pct || 0, type: 'pension' });
      }
    }
  }
  return {
    beneficiaries,
    effectiveRate: iht.gross > 0 ? Math.round((iht.iht / iht.gross) * 1000) / 10 : 0,
    gross: iht.gross,
    net:   Math.round(iht.gross - iht.iht),
  };
}

/**
 * All gift clocks for the entity. Wraps the spec giftClockProjection model.
 * CANONICAL
 * @param {object} entity
 * @returns {Array<{date:string, amount:number, recipient:string, yearsElapsed:number, taperBand:object, freeIn:number}>}
 */
export function giftClockAll(entity) {
  const out = [];
  const trust = entity?.assets?.trustGifts;
  if (trust && trust.date) {
    out.push({
      date: trust.date,
      amount: +trust.total || 0,
      recipient: 'Trust',
      yearsElapsed: Math.round(((Date.now() - new Date(trust.date)) / (365.25 * 86400000)) * 10) / 10,
      taperBand: taperBand(trust.date),
      freeIn: Math.max(0, 7 - (Date.now() - new Date(trust.date)) / (365.25 * 86400000)),
    });
  }
  const gt = entity?.gifts_and_trusts || [];
  for (const g of gt) {
    if (!g.date) continue;
    const yrs = (Date.now() - new Date(g.date)) / (365.25 * 86400000);
    out.push({
      date: g.date,
      amount: +g.amount || 0,
      recipient: g.recipient || 'unknown',
      yearsElapsed: Math.round(yrs * 10) / 10,
      taperBand: taperBand(g.date),
      freeIn: Math.max(0, 7 - yrs),
    });
  }
  return out;
}

/**
 * Estate readiness composite index 0–100 based on will, LPA, nominations, gifts, RNRB.
 * CANONICAL
 * @param {object} entity
 * @returns {number}
 */
export function estateReadinessIndex(entity) {
  return estateReadiness(entity).total;
}

// ---------- Wave 1: Onboarding preview score ----------

// STUB: implement at s02a
// Returns approximate Wealth/Risk scores from raw onboarding answers, before
// any persona file is loaded. Replaced at s02a with real archetype mapping.
export function onboardingPreview(answers) {
  const a = answers || {};
  const focusCount = Array.isArray(a.focus) ? a.focus.length : 0;
  const setupCount = Array.isArray(a.setup) ? a.setup.length : 0;
  const ageBand = a.age >= 60 ? 18 : a.age >= 45 ? 14 : a.age >= 30 ? 10 : 6;
  const incomeBand = (a.income || 0) >= 100000 ? 14 : (a.income || 0) >= 50000 ? 10 : 6;
  const wealthBand = (a.liquidWealth || 0) >= 500000 ? 18 : (a.liquidWealth || 0) >= 100000 ? 12 : 6;
  const propertyBand = (a.propertyValue || 0) > 0 ? 8 : 0;
  const riskBoost = a.riskAppetite === 'growth' || a.riskAppetite === 'aggressive' ? 6 : 4;
  const total = Math.min(100, Math.max(0,
    ageBand + incomeBand + wealthBand + propertyBand + riskBoost +
    Math.min(8, focusCount * 2) + Math.min(6, setupCount * 2)
  ));
  const riskTotal = Math.min(100, Math.max(0,
    50 + (a.riskAppetite === 'cautious' ? 14
      : a.riskAppetite === 'balanced' ? 8
      : a.riskAppetite === 'growth'   ? -4
      : a.riskAppetite === 'aggressive' ? -12 : 0)
    + propertyBand + (wealthBand - 6)
  ));
  return {
    wealth: total,
    risk:   riskTotal,
    // FIX F-MATH-02: tag this as a stub projection so downstream UIs
    // (onboarding preview cards) can render with appropriate confidence
    // labelling rather than presenting it as a real archetype score.
    _meta: { status: 'stub', confidence: 'low', source: 'onboardingPreview-static-projection' },
  };
}

// ============================================================================
// CANONICAL ENGINE — FOUNDATION FUNCTIONS  (Wave 1A reconciliation, May 2026)
// All functions below carry the // CANONICAL JSDoc tag and handle BOTH persona
// schemas via _helpers.js readers. Spec refs: foundation v1.8 §3.4–3.6,
// 2-Product-home-v1_4.md §Z3, 2-Product-tax-estate-v1_0.md §8, s07 risk-spec.
// ============================================================================

// ── CROSS-CUTTING METRICS ────────────────────────────────────────────────────

/**
 * Domain-agnostic cost of inaction. Aggregates CoI across all action domains.
 * Spec: 2-Product-home-v1_4.md §Z3 + §0.5; arch master §13.3.
 * Returns { total, byDomain, daysToImpact, confidence }.
 * CANONICAL
 * @param {object} entity
 * @param {object} [bundle] - optional rule-bundle override
 * @returns {{ total:number, byDomain:object, daysToImpact:number, confidence:string }}
 */
export function totalCoI(entity, bundle) {
  const byDomain = {
    drawdown:           ihtSippDelta(entity),
    wrapperSequencing:  _wrapperSequencingCoI(entity),
    contributions:      _contributionCoI(entity),
    taxAllowances:      _taxAllowancesCoI(entity),
    estatePlanning:     _estatePlanningCoI(entity),
    protection:         _protectionCoI(entity),
    debt:               _debtCoI(entity),
    gifting:            _giftingCoI(entity),
    propertyDecisions:  0,                    // founder-IP — see openItem
    investmentStrategy: _investmentStrategyCoI(entity),
  };
  const total = Object.values(byDomain).reduce((s, v) => s + (+v || 0), 0);
  const daysLeft_ = daysLeft();
  const daysToImpact = byDomain.drawdown > 0 ? daysLeft_ : 365;
  // Confidence — HIGH if SIPP-IHT only; MED if multiple domains; LOW if estate gaps
  const activeDomains = Object.values(byDomain).filter(v => v > 0).length;
  const confidence = activeDomains <= 1 ? 'HIGH' : activeDomains <= 3 ? 'MED' : 'LOW';
  return { total: Math.round(total), byDomain, daysToImpact, confidence };
}

function _wrapperSequencingCoI(e) {
  // Tax-drag from un-wrapped GIA holdings vs ISA. Approx: GIA × dividend-yield × marginal-rate.
  const gia = _giaTotal(e);
  const yield_ = 0.025;  // typical equity dividend yield
  const rate   = e.isHigherRateTaxpayer ? 0.3375 : 0.0875;  // dividend rate above allowance
  return Math.round(Math.max(0, gia * yield_ * rate));
}
function _contributionCoI(e) {
  // Higher-rate taxpayer not maxing pension AA: 20% relief lost on shortfall up to AA cap.
  if (!e.isHigherRateTaxpayer) return 0;
  const pen = e.pensionContributions || (e.assets?.pensionContributions ?? 0);
  const cap = TAX.pensionAA;
  return Math.round(Math.max(0, (cap - pen)) * 0.20);
}
function _taxAllowancesCoI(e) {
  // Unused ISA allowance (cash > 0 and ISA < limit).
  const a = e.assets || {};
  const cash = _cashTotal(e);
  const isa  = _isaTotal(e);
  // ISA contribution this year: estimated unused = 20k - sum of contributions_current_tax_year
  const used = (Array.isArray(a.investments) ? a.investments : [])
    .filter(i => (i.type || '').toLowerCase().includes('isa'))
    .reduce((s, i) => s + (+i.contribution_current_tax_year || 0), 0);
  const unused = Math.max(0, TAX.isaAllowance - used);
  if (cash <= 0) return 0;
  // Tax saved: unused × dividend yield × dividend rate (basic = 8.75%, higher = 33.75%)
  const rate = e.isHigherRateTaxpayer ? 0.3375 : 0.0875;
  return Math.round(Math.min(unused, cash) * 0.025 * rate);
}
function _estatePlanningCoI(e) {
  // RNRB taper loss + no-will premium. Cap at IHT due.
  const exposure = ihtDynamic(e, true);
  let coi = 0;
  if (exposure.rnrbLost > 0) coi += Math.round(exposure.rnrbLost * TAX.ihtRate);
  if (e.willStatus !== 'current') coi += Math.round(exposure.iht * 0.05);  // 5% admin/dispute premium
  return coi;
}
function _protectionCoI(e) {
  // Probability-weighted shortfall: (target × shortfall%) × p(event).
  const prot = _protectionFlat(e);
  const dependants = (e.dependants || []).filter(d => d.financiallyDependent !== false);
  if (dependants.length === 0) return 0;
  const cover  = prot.life.amount;
  const need   = (e.targetIncome || _targetIncome(e)) * 10;  // 10x rule of thumb
  const gap    = Math.max(0, need - cover);
  const pYearly = 0.005;  // ~0.5% annual P(death) at age 50
  return Math.round(gap * pYearly * 5);  // 5-year horizon expected loss
}
function _debtCoI(e) {
  const ds = _monthlyDebtService(e);
  if (ds === 0) return 0;
  // High-APR debt drag: cards & student-loan above pension growth.
  const liab = e.liabilities;
  let drag = 0;
  if (Array.isArray(liab)) {
    for (const l of liab) {
      const apr = +l.apr || +l.interest_rate || 0;
      if (apr > 0.07) {
        drag += (+l.outstanding_balance || 0) * (apr - 0.05);
      }
    }
  }
  return Math.round(drag);
}
function _giftingCoI(e) {
  // Annual gift exemption £3,000 × 40% IHT — if not used.
  const gifts = e.gifts_and_trusts || [];
  const usedThisYear = gifts.filter(g => {
    const yrs = (Date.now() - new Date(g.date)) / (365.25 * 86400000);
    return yrs < 1 && g.within_annual_exemption;
  }).reduce((s, g) => s + (+g.amount || 0), 0);
  const unused = Math.max(0, TAX.giftExemption - usedThisYear);
  return Math.round(unused * TAX.ihtRate);
}
function _investmentStrategyCoI(e) {
  // Misalignment between risk score and asset mix — simplified: cash drag if cash > 24mo essential.
  const monthlyEss = (e.targetIncome || _targetIncome(e)) / 12;
  const months     = monthlyEss > 0 ? _cashTotal(e) / monthlyEss : 0;
  if (months <= 24) return 0;
  const excess = (months - 24) * monthlyEss;
  return Math.round(excess * 0.04);  // 4% growth foregone on excess cash
}

/**
 * Financial Independence ratio: investable / annual essential expense.
 * 25× target (4% rule) ≈ FI; 33× ≈ Lean FI; 50× ≈ Fat FI.
 * CANONICAL
 * @param {object} entity
 * @returns {{ ratio:number, multiple:number, fiTarget:number, achieved:boolean, confidence:string }}
 */
export function fiRatio(entity) {
  const inv = investable(entity);
  const target = _targetIncome(entity) || 30000;
  const fiTarget = target * 25;
  const ratio = fiTarget > 0 ? inv / fiTarget : 0;
  const multiple = target > 0 ? inv / target : 0;
  return {
    ratio: Math.round(ratio * 100) / 100,
    multiple: Math.round(multiple * 10) / 10,
    fiTarget,
    achieved: ratio >= 1.0,
    confidence: inv > 10000 ? 'HIGH' : 'LOW',
  };
}

/**
 * Debt-to-income ratio: annual debt service / annual net income.
 * Bands: <0.15 healthy, 0.15-0.30 caution, 0.30-0.40 stressed, >0.40 critical.
 * CANONICAL
 * @param {object} entity
 * @returns {{ ratio:number, monthlyService:number, annualIncome:number, band:string }}
 */
export function debtRatio(entity) {
  const ds = _monthlyDebtService(entity);
  const inc = _annualIncome(entity);
  const ratio = inc > 0 ? (ds * 12) / inc : (ds > 0 ? 1 : 0);
  const band = ratio === 0 ? 'none' : ratio < 0.15 ? 'healthy' :
               ratio < 0.30 ? 'caution' : ratio < 0.40 ? 'stressed' : 'critical';
  return {
    ratio: Math.round(ratio * 1000) / 1000,
    monthlyService: ds,
    annualIncome: inc,
    band,
  };
}

/**
 * Composite protection score 0–100 across life cover, IP, CIC, will, LPA, nominations.
 * CANONICAL
 * @param {object} entity
 * @returns {{ total:number, components:object, band:string }}
 */
export function protectionScore(entity) {
  const prot = _protectionFlat(entity);
  const components = {
    life:        prot.life.exists ? (prot.life.inTrust ? 25 : 18) : 0,        // max 25
    ip:          prot.ip.exists ? 18 : 0,                                      // max 18
    cic:         prot.cic.exists ? 12 : 0,                                     // max 12
    will:        entity.willStatus === 'current' ? 18 : entity.willStatus ? 6 : 0,  // max 18
    lpa:         entity.lpaStatus === 'both' ? 15 : entity.lpaStatus === 'one' ? 7 : 0,  // max 15
    nominations: hasStaleNomination(entity) ? 0 : 12,                          // max 12
  };
  const total = Math.min(100, Object.values(components).reduce((s, v) => s + v, 0));
  const band = total < 25 ? 'critical' : total < 50 ? 'gaps' :
               total < 75 ? 'partial'  : total < 90 ? 'good' : 'excellent';
  return { total, components, band };
}

/**
 * Composite cashflow health 0–100 with bands. Per spec: 25/25/20/15/15 weighted
 * sigmoid composite of liquidityBuffer, surplus, sequenceVuln, protectionGap, taxEfficiency.
 * Bands: Critical <20, Stressed 20-39, Steady 40-59, Healthy 60-79, Thriving 80+.
 * CANONICAL
 * @param {object} entity
 * @param {object} [bundle]
 * @returns {{ total:number, components:object, band:string, confidence:string }}
 */
export function cashflowHealth(entity, bundle) {
  // Component scores 0–100 — spec §3B five cashflow-native components.
  // Keys match what Cashflow.jsx reads from ec (ec.liquidityBuffer, ec.surplus).

  // 1. Liquidity buffer: months of essential spending in liquid cash (from liquidityBuffer()).
  const lb = liquidityBuffer(entity).score;

  // 2. Surplus ratio: annualised surplus as % of income. 25% surplus → 100, 0% → 0.
  const sur = monthlySurplus(entity).surplus;
  const inc = _annualIncome(entity);
  const surplusScore = inc > 0 ? Math.min(100, Math.max(0, (sur * 12 / inc) * 400)) : 50;

  // 3. Debt manageability: invert DSR. DSR 0% → 100; ≥40% → 0. Linear between 0–40%.
  const dr = debtRatio(entity);
  const debtManageabilityScore = Math.round(Math.max(0, Math.min(100, (1 - dr.ratio / 0.40) * 100)));

  // 4. Income resilience: distinct income source count → score.
  //    0 sources = 20, 1 = 50, 2 = 70, 3+ = 90.
  const allInc = calcAllIncome(entity, bundle);
  const srcCount = (allInc.items || []).filter(i => (+i.amount || 0) > 0).length;
  const incomeResilienceScore = srcCount === 0 ? 20
    : srcCount === 1 ? 50
    : srcCount === 2 ? 70
    : 90;

  // 5. Sequence risk: age-adjusted vulnerability to sequence-of-returns.
  //    Pre-55 accumulators face low near-term risk (80); 55–64 transition (65);
  //    65+ in drawdown face highest exposure (45).
  const age = +(entity.age || 0);
  const sequenceRiskScore = age < 55 ? 80 : age < 65 ? 65 : 45;

  const components = {
    liquidityBuffer:    Math.round(lb),
    surplus:            Math.round(surplusScore),
    debtManageability:  debtManageabilityScore,
    incomeResilience:   incomeResilienceScore,
    sequenceRisk:       sequenceRiskScore,
  };

  // Weighted: 30 / 25 / 20 / 15 / 10 = 1.00
  const total = Math.round(
    components.liquidityBuffer   * 0.30 +
    components.surplus           * 0.25 +
    components.debtManageability * 0.20 +
    components.incomeResilience  * 0.15 +
    components.sequenceRisk      * 0.10
  );
  const band = total < 20 ? 'Critical' : total < 40 ? 'Stressed' :
               total < 60 ? 'Steady'   : total < 80 ? 'Healthy' : 'Thriving';
  return { total, components, band, confidence: 'MED' };
}

/**
 * Estate readiness composite 0–100: will + LPA + nominations + RNRB plan + gift clock + BPR/APR.
 * CANONICAL
 * @param {object} entity
 * @returns {{ total:number, components:object, band:string }}
 */
export function estateReadiness(entity) {
  const components = {
    will:        entity.willStatus === 'current' ? 25 : entity.willStatus ? 10 : 0,
    lpa:         entity.lpaStatus === 'both' ? 20 : entity.lpaStatus === 'one' ? 8 : 0,
    nominations: hasStaleNomination(entity) ? 5 : 15,
    rnrbPlan:    ihtDynamic(entity, true).rnrbLost > 0 ? 5 : 15,
    giftClock:   giftClockAll(entity).length > 0 ? 12 : 5,
    bprApr:      bprQualifyingValue(entity) > 0 ? 10 : 0,
  };
  const total = Math.min(100, Object.values(components).reduce((s, v) => s + v, 0));
  const band = total < 30 ? 'gaps' : total < 60 ? 'partial' :
               total < 85 ? 'good' : 'excellent';
  return { total, components, band };
}

/**
 * Composite tax efficiency 0–100: allowance utilization, wrapper composition, ordering optimality.
 * CANONICAL
 * @param {object} entity
 * @returns {{ total:number, components:object }}
 */
export function taxEfficiency(entity) {
  const alloc = allowanceTracker(entity);
  // Utilization % across primary allowances
  const allocPct = alloc.utilization || 0;
  const isa = _isaTotal(entity);
  const gia = _giaTotal(entity);
  const wrap = isa + gia > 0 ? (isa / (isa + gia)) * 100 : 50;
  const ordering = (entity.drawdown || 0) > 0 ? 80 : 50;  // is drawdown happening per priority?
  const components = { allowanceUtil: Math.round(allocPct), wrapperMix: Math.round(wrap), drawdownOrder: ordering };
  const total = Math.round(components.allowanceUtil * 0.4 + components.wrapperMix * 0.4 + components.drawdownOrder * 0.2);
  return { total, components };
}

/**
 * Wealth Score trajectory over a window, synthesised from current + life-stage trend.
 * Real history comes from event store when available.
 * CANONICAL
 * @param {object} entity
 * @param {string|object} [range='12mo']
 * @returns {Array<{date:string, value:number, confidence:string}>}
 */
export function scoreTrajectory(entity, range = '12mo') {
  // Phase 2 Batch A.6 — prefer stored trajectory.
  // Note: this function returns the BACK-history series shape consumed by
  // ScoreJourney's forward extension. Stored shape is [{date, score}].
  const stored = entity?.trajectories?.scoreHistory;
  if (Array.isArray(stored) && stored.length >= 6) {
    return stored.map(p => ({
      date: p.date,
      value: p.score,
      confidence: 'HIGH',
    }));
  }
  const months = _parseWindowMonths(range) || 12;
  const cur = calcFQ(entity).total;
  const ls = lifeStageFor(_personAge(entity));
  // Foundation/Accumulation: +0.5/mo trend; Decumulation: 0; Legacy: -0.2/mo
  const trend = ls.stage <= 2 ? 0.5 : ls.stage <= 4 ? 0.2 : ls.stage <= 5 ? 0 : -0.2;
  const out = [];
  const today = new Date();
  for (let m = -months; m <= 0; m++) {
    const d = new Date(today.getFullYear(), today.getMonth() + m, 1);
    out.push({
      date: d.toISOString().split('T')[0],
      value: Math.round(Math.max(0, Math.min(100, cur + m * trend))),
      confidence: 'LOW',
    });
  }
  return out;
}

/**
 * Risk Score trajectory (same shape as scoreTrajectory).
 * CANONICAL
 * @param {object} entity
 * @param {string|object} [range='12mo']
 * @returns {Array<{date:string, value:number, confidence:string}>}
 */
export function riskTrajectory(entity, range = '12mo') {
  // Phase 2 Batch A.6 — prefer stored trajectory.
  const stored = entity?.trajectories?.riskHistory;
  if (Array.isArray(stored) && stored.length >= 6) {
    return stored.map(p => ({
      date: p.date,
      value: p.score,
      confidence: 'HIGH',
    }));
  }
  const months = _parseWindowMonths(range) || 12;
  const cur = calcRisk(entity).total;
  const out = [];
  const today = new Date();
  for (let m = -months; m <= 0; m++) {
    const d = new Date(today.getFullYear(), today.getMonth() + m, 1);
    out.push({
      date: d.toISOString().split('T')[0],
      value: Math.round(Math.max(0, Math.min(100, cur + m * 0.1))),
      confidence: 'LOW',
    });
  }
  return out;
}

/**
 * Net-worth trajectory over a window, synthesised from current + assumed growth.
 * CANONICAL
 * @param {object} entity
 * @param {string|object} [range='12mo']
 * @returns {Array<{date:string, value:number, confidence:string}>}
 */
export function netWorthHistory(entity, range = '12mo') {
  // Phase 2 Batch A.6 — prefer stored trajectory when persona carries one.
  const stored = entity?.trajectories?.netWorthHistory;
  if (Array.isArray(stored) && stored.length >= 6) {
    return stored.map(p => ({
      date: p.date,
      value: p.value,
      confidence: 'HIGH',
    }));
  }
  const months = _parseWindowMonths(range) || 12;
  const cur = netWorth(entity);
  const monthlyG = Math.pow(1.04, 1/12);  // assume 4% growth backwards (so divide)
  const out = [];
  const today = new Date();
  for (let m = -months; m <= 0; m++) {
    const d = new Date(today.getFullYear(), today.getMonth() + m, 1);
    out.push({
      date: d.toISOString().split('T')[0],
      value: Math.round(cur / Math.pow(monthlyG, -m)),
      confidence: 'LOW',
    });
  }
  return out;
}

// ── Canonical metrics (Phase 2 follow-up) ────────────────────────────────────
export {
  propertyDecisionsCoI,
  taxEfficiencyScore,
  prcPccSpread,
  drawdownEfficiencyRatio,
  effectiveBeneficiaryRate,
  coiForDomain,
} from './canonical-metrics.js';

/**
 * Project net-worth forward (or back) by `years`. Used by the X28 selector to
 * surface "your net worth in 10 years" when the user picks a forward window.
 * Uses entity.trajectories when available for backward projection; otherwise
 * compounds at a simple 4% growth rate (matches netWorthHistory).
 *
 * @param {object} entity
 * @param {number} years   positive = future, negative = past
 * @returns {{value:number, confidence:'HIGH'|'MEDIUM'|'LOW', source:string}}
 */
export function netWorthAtYears(entity, years) {
  const cur = netWorth(entity);
  if (!years || years === 0) {
    return { value: cur, confidence: 'HIGH', source: 'current' };
  }
  // Backward — prefer stored trajectory snapshot for the closest month.
  if (years < 0) {
    const stored = entity?.trajectories?.netWorthHistory;
    if (Array.isArray(stored) && stored.length > 0) {
      const targetIdx = Math.max(0, stored.length + Math.round(years * 12));
      const point = stored[Math.min(targetIdx, stored.length - 1)];
      if (point) return { value: Math.round(point.value), confidence: 'HIGH', source: 'trajectory' };
    }
  }
  // Forward — compound at 4%; reduce confidence as horizon extends.
  const factor = Math.pow(1.04, years);
  const confidence = Math.abs(years) <= 1 ? 'HIGH'
                   : Math.abs(years) <= 5 ? 'MEDIUM'
                   : 'LOW';
  return { value: Math.round(cur * factor), confidence, source: 'projection' };
}

/**
 * Net-worth at the end of an X28 window. Convenience wrapper around
 * netWorthAtYears that accepts the window id directly. Returns the same shape
 * plus the window record itself so callers can render "as at [window]" copy.
 *
 * @param {object} entity
 * @param {number} windowYears  e.g. 5, 10, -1
 * @returns {{value:number, confidence:string, source:string, years:number}}
 */
export function netWorthAtWindow(entity, windowYears) {
  const years = +windowYears || 0;
  const out = netWorthAtYears(entity, years);
  return { ...out, years };
}

// Aliases so spec naming and timeline-engine align
/** CANONICAL — alias of scoreTrajectory (timeline-engine uses calcScoreHistory). */
export const calcScoreHistory_alias = scoreTrajectory;
/** CANONICAL — alias of riskTrajectory. */
export const calcRiskHistory_alias = riskTrajectory;

// Re-export getWrapper from helpers
/**
 * Wrapper-type classifier. Returns one of: PENSION, ISA, GIA, BOND_ON, BOND_OFF,
 * EIS, SEIS, VCT, TRUST, CASH, PROPERTY, STATE.
 * CANONICAL
 * @param {object} asset
 * @returns {string}
 */
export function getWrapper(asset) {
  return _getWrapper(asset);
}

/**
 * Tests if a persona-flag is set on the entity.
 * CANONICAL
 * @param {object} entity
 * @param {string} flag
 * @returns {boolean}
 */
export function hasPersonaFlag(entity, flag) {
  return _hasPersonaFlag(entity, flag);
}

/**
 * Tests if a rule is in force at a given date. Used for SIPP-IHT 2027 transition etc.
 * CANONICAL
 * @param {string} ruleId - e.g. 'SIPP_IHT_INCLUSION', 'NON_DOM_2025_REFORM'
 * @param {Date|string} [asOfDate=now]
 * @param {object} [bundle]
 * @returns {boolean}
 */
export function isRuleActive(ruleId, asOfDate = new Date(), bundle) {
  const d = asOfDate instanceof Date ? asOfDate : new Date(asOfDate);
  const RULE_DATES = {
    SIPP_IHT_INCLUSION:    new Date(TAX_JSON.inheritanceTax?.pensionIHTInclusionDate || '2027-04-06'),
    NON_DOM_2025_REFORM:   new Date('2025-04-06'),
    APR_BPR_2M_CAP:        new Date(TAX_JSON.inheritanceTax?.aprBprCombinedAllowanceEffectiveDate || '2026-04-06'),
    AIM_BPR_50PCT:         new Date('2026-04-06'),
    PA_FROZEN_2028:        new Date('2026-04-06'),  // freeze still in effect
    LSA_LSDBA_REGIME:      new Date('2024-04-06'),
    HICBC_60K:             new Date('2024-04-06'),
  };
  const start = RULE_DATES[ruleId];
  if (!start) return false;
  return d >= start;
}

/**
 * Returns the effective rate/value for a parameterised rule at a given date.
 * Used for taper bands, allowance changes etc.
 * CANONICAL
 * @param {string} rateId - e.g. 'IHT_TAPER_5_6Y', 'PA_TAPER_RATE'
 * @param {Date|string} [asOfDate=now]
 * @param {object} [bundle]
 * @returns {number|null}
 */
export function getActiveRateForDate(rateId, asOfDate = new Date(), bundle) {
  const RATES = {
    IHT_RATE:           TAX_JSON.inheritanceTax?.ihtRate         || 0.40,
    IHT_TAPER_3_4Y:     1.00,
    IHT_TAPER_4_5Y:     0.80,
    IHT_TAPER_5_6Y:     0.60,
    IHT_TAPER_6_7Y:     0.40,
    PA_TAPER_RATE:      0.50,                                          // £1 per £2 over
    PSA_BASIC:          TAX_JSON.income?.savingsAllowanceBasicRate    || 1000,
    PSA_HIGHER:         TAX_JSON.income?.savingsAllowanceHigherRate   || 500,
    PSA_ADDITIONAL:     TAX_JSON.income?.savingsAllowanceAdditionalRate || 0,
    DIVIDEND_ALLOWANCE: TAX_JSON.income?.dividendAllowance || 500,
    ISA_ANNUAL:         TAX_JSON.isa?.annualAllowance || 20000,
    PENSION_AA:         TAX_JSON.pension?.annualAllowance || 60000,
    SWR:                0.04,
    SWR_MORNINGSTAR_UK: 0.034,                                         // UK-adjusted, NOT 3.7
  };
  return RATES[rateId] ?? null;
}

/**
 * Monthly surplus calculation: { income, essential, committed, debtService, surplus, deficit }.
 * CANONICAL
 * @param {object} entity
 * @param {object} [bundle]
 * @returns {{income:number, essential:number, committed:number, debtService:number, surplus:number, deficit:number}}
 */
export function monthlySurplus(entity, bundle) {
  const inc       = _annualIncome(entity);
  const essential = _targetIncome(entity);
  const ds        = _monthlyDebtService(entity);
  // Committed = pension/ISA contributions
  const a   = entity?.assets || {};
  const pcb = (Array.isArray(a.pensions) ? a.pensions : [])
    .reduce((s, p) => s + (+p.contribution_monthly_personal || 0) + (+p.contribution_monthly_employer || 0), 0);
  const isb = (Array.isArray(a.investments) ? a.investments : [])
    .filter(i => (i.type || '').toLowerCase().includes('isa'))
    .reduce((s, i) => s + ((+i.contribution_current_tax_year || 0) / 12), 0);
  const committed = pcb + isb;
  const monthlyInc = inc / 12;
  const monthlyEss = essential / 12;
  const surplus    = Math.round(monthlyInc - monthlyEss - ds - committed);
  return {
    income:       Math.round(monthlyInc),
    essential:    Math.round(monthlyEss),
    committed:    Math.round(committed),
    debtService:  Math.round(ds),
    surplus:      surplus > 0 ? surplus : 0,
    deficit:      surplus < 0 ? Math.abs(surplus) : 0,
  };
}

/**
 * Liquidity buffer in months of essential expenditure.
 * Bands per spec §4.9: Critical <1, Building 1–3, Covered 3+.
 * CANONICAL
 * @param {object} entity
 * @returns {{ months:number, score:number, band:string, accessibleCash:number, monthlyEssential:number }}
 */
export function liquidityBuffer(entity) {
  const cash    = _cashTotal(entity);
  const monthly = _targetIncome(entity) / 12;
  const months  = monthly > 0 ? cash / monthly : 0;
  const band    = months < 1 ? 'Critical' : months < 3 ? 'Building' : 'Covered';
  // Score 0-100: 6mo = 100; under 1mo = 0
  const score = Math.min(100, Math.max(0, (months / 6) * 100));
  return {
    months: Math.round(months * 10) / 10,
    score: Math.round(score),
    band,
    accessibleCash: Math.round(cash),
    monthlyEssential: Math.round(monthly),
  };
}

/**
 * Safe Withdrawal Rate by regime / lifestage. Morningstar UK-adjusted is 3.4% (NOT 3.7%).
 * CANONICAL
 * @param {string} regime - 'bengen' | 'morningstar_uk' | 'guyton_klinger' | 'vanguard'
 * @param {object} [lifestage]
 * @param {object} [bundle]
 * @returns {{ rate:number, label:string, source:string }}
 */
export function swrFromRegime(regime, lifestage, bundle) {
  switch ((regime || '').toLowerCase()) {
    case 'bengen':
      return { rate: 0.04, label: 'Bengen 4%', source: 'Bengen 1994' };
    case 'morningstar_uk':
    case 'morningstar':
      return { rate: 0.034, label: 'Morningstar UK-adj 3.4%', source: 'Morningstar UK 2024 (NOT 3.7%)' };
    case 'guyton_klinger':
    case 'gk':
      return { rate: 0.045, label: 'Guyton-Klinger 4.5% (adaptive)', source: 'Guyton & Klinger 2006' };
    case 'vanguard':
      return { rate: 0.033, label: 'Vanguard 3.3%', source: 'Vanguard UK 2023' };
    default:
      return { rate: 0.04, label: 'Bengen 4% (default)', source: 'fallback' };
  }
}

/**
 * Bengen 4%-rule projection.
 * CANONICAL
 * @param {object} entity
 * @param {number} [years=30]
 * @returns {Array<{year:number, age:number, balance:number, withdrawal:number}>}
 */
export function bengenProjection(entity, years = 30) {
  const inv  = investable(entity);
  const age  = _personAge(entity);
  const wd0  = inv * 0.04;
  const out  = [];
  let bal    = inv;
  let wd     = wd0;
  for (let y = 1; y <= years; y++) {
    bal = Math.max(0, bal * 1.05 - wd);
    out.push({ year: y, age: age + y, balance: Math.round(bal), withdrawal: Math.round(wd) });
    wd *= 1.025;  // inflate withdrawal 2.5% each year
  }
  return out;
}

/**
 * Guyton-Klinger adaptive corridor projection. Adjusts withdrawal up/down based on portfolio
 * health relative to initial withdrawal rate × prosperity (+20%) / preservation (-20%) corridors.
 * CANONICAL
 * @param {object} entity
 * @param {number} [years=30]
 * @param {object} [cma]
 * @returns {Array<{year:number, age:number, balance:number, withdrawal:number, rule:string}>}
 */
export function guytonKlingerPath(entity, years = 30, cma) {
  const inv = investable(entity);
  const age = _personAge(entity);
  const initRate = 0.045;
  let wd = inv * initRate;
  let bal = inv;
  const out = [];
  for (let y = 1; y <= years; y++) {
    const growth = (cma?.growth ?? 0.05) + (Math.random() - 0.5) * 0.03;
    bal = Math.max(0, bal * (1 + growth));
    const currentRate = bal > 0 ? wd / bal : 1;
    let rule = 'cpi';
    if (currentRate > initRate * 1.2) {
      wd *= 0.90;  // preservation
      rule = 'preservation';
    } else if (currentRate < initRate * 0.8 && y > 1) {
      wd *= 1.10;  // prosperity
      rule = 'prosperity';
    } else {
      wd *= 1.025;  // CPI
    }
    bal -= wd;
    out.push({ year: y, age: age + y, balance: Math.round(bal), withdrawal: Math.round(wd), rule });
  }
  return out;
}

/**
 * 3-bucket allocation: cash (0–2yr), medium (2–7yr), growth (7+yr).
 * CANONICAL
 * @param {object} entity
 * @returns {{ cash:object, medium:object, growth:object, total:number }}
 */
export function bucketAllocation(entity) {
  const target = _targetIncome(entity);
  const cashTarget   = target * 2;        // 24mo
  const mediumTarget = target * 5;        // years 2-7
  const inv          = investable(entity);
  const growthTarget = Math.max(0, inv - cashTarget - mediumTarget);
  return {
    cash:   { target: Math.round(cashTarget),   horizonYears: '0-2', actual: Math.min(cashTarget, _cashTotal(entity)) },
    medium: { target: Math.round(mediumTarget), horizonYears: '2-7', actual: Math.round(_isaTotal(entity)) },
    growth: { target: Math.round(growthTarget), horizonYears: '7+',  actual: Math.round(_pensionTotal(entity) + _giaTotal(entity)) },
    total:  Math.round(inv),
  };
}

/**
 * Floor + Upside split: state pension + annuity = floor; rest = upside.
 * CANONICAL
 * @param {object} entity
 * @returns {{ floor:object, upside:object, ratio:number }}
 */
export function floorUpsideSplit(entity) {
  const sp     = _statePensionAnnual(entity);
  const annuity = entity?.income?.annuity?.annual || 0;
  const floor  = sp + annuity;
  const inv    = investable(entity);
  const upsideAnnual = inv * 0.04;
  return {
    floor:  { annual: Math.round(floor),       sources: ['state_pension', 'annuity'] },
    upside: { annual: Math.round(upsideAnnual), portfolio: Math.round(inv) },
    ratio:  upsideAnnual > 0 ? Math.round((floor / (floor + upsideAnnual)) * 100) / 100 : 1,
  };
}

/**
 * Returns 4 cashflow CoI variants: drawdown / wrapper / contribution / allowance.
 * CANONICAL
 * @param {object} entity
 * @returns {{ drawdown:number, wrapper:number, contribution:number, allowance:number }}
 */
export function coiCashflowVariants(entity) {
  return {
    drawdown:     ihtSippDelta(entity),
    wrapper:      _wrapperSequencingCoI(entity),
    contribution: _contributionCoI(entity),
    allowance:    _taxAllowancesCoI(entity),
  };
}

/**
 * Recommended surplus allocation across 8-priority list.
 * Priorities: 1. high-APR debt, 2. emergency fund, 3. employer-match, 4. ISA, 5. SIPP,
 * 6. LISA (if eligible), 7. GIA, 8. property/other.
 * CANONICAL
 * @param {object} entity
 * @param {number} surplus - monthly surplus in GBP
 * @returns {Array<{priority:number, target:string, amount:number, reason:string}>}
 */
export function recommendedSurplusAllocation(entity, surplus) {
  const out = [];
  let rem = +surplus || 0;
  if (rem <= 0) return out;
  const liab = entity?.liabilities;
  const highApr = Array.isArray(liab) ? liab.filter(l => (+l.apr || +l.interest_rate || 0) > 0.07) : [];
  if (highApr.length > 0) {
    const need = highApr.reduce((s, l) => s + (+l.outstanding_balance || 0), 0);
    const a = Math.min(rem, need / 12);
    out.push({ priority: 1, target: 'high-apr-debt', amount: Math.round(a), reason: 'Pay down >7% APR debt first' });
    rem -= a;
  }
  // Emergency fund
  const lb = liquidityBuffer(entity);
  if (lb.months < 3 && rem > 0) {
    const need = (3 - lb.months) * lb.monthlyEssential;
    const a = Math.min(rem, need / 6);  // 6-month build
    out.push({ priority: 2, target: 'emergency-fund', amount: Math.round(a), reason: 'Build 3mo buffer' });
    rem -= a;
  }
  if (rem > 0 && _isaTotal(entity) < TAX.isaAllowance) {
    const a = Math.min(rem, TAX.isaAllowance / 12);
    out.push({ priority: 4, target: 'isa', amount: Math.round(a), reason: 'Use £20k ISA wrapper' });
    rem -= a;
  }
  if (rem > 0) {
    out.push({ priority: 5, target: 'sipp', amount: Math.round(rem), reason: 'Pension contribution (tax relief)' });
  }
  return out;
}

// ── TAX-SIDE FUNCTIONS ───────────────────────────────────────────────────────

/**
 * UK Adjusted Net Income (ANI) computation per UK-IT-19 (6 steps).
 * Step 1: total income → 2: gross-up gift aid → 3: deduct pension contribs →
 * 4: deduct trade losses → 5: deduct interest paid → 6: result = ANI.
 * Used for PA taper, HICBC, marriage allowance.
 * CANONICAL
 * @param {object} entity
 * @param {object} [bundle]
 * @returns {{ ani:number, steps:object, confidence:string }}
 */
export function calcANI(entity, bundle) {
  const inc = entity?.income || {};
  const ind = entity?.individual || {};
  const total = (+ind.gross_salary || 0) + (+inc.salary || 0) + (+inc.employment || 0) +
                (+inc.dividends || 0) + (+inc.rentalIncome || 0) + (+inc.rental || 0) +
                (+inc.selfEmployed || 0) + (+inc.savingsInterest || 0) + (+inc.other || 0) +
                (+inc.overseasIncome || 0) + (+entity.drawdown || 0);
  const giftAid     = +entity.giftAidAnnual || 0;
  const pensionRel  = +entity.pensionContribAnnual || 0;
  const tradeLosses = +entity.tradeLosses || 0;
  const interestPaid = +entity.qualifyingInterest || 0;
  const ani = Math.max(0, total + giftAid * 0.25 - pensionRel - tradeLosses - interestPaid);
  return {
    ani: Math.round(ani),
    steps: {
      total: Math.round(total),
      grossedUpGiftAid: Math.round(giftAid * 1.25),
      pensionContribs: pensionRel,
      tradeLosses,
      interestPaid,
    },
    confidence: total > 0 ? 'HIGH' : 'LOW',
  };
}

/**
 * Personal Allowance with £100k–£125,140 taper.
 * CANONICAL
 * @param {number} income - typically ANI
 * @param {object} [bundle]
 * @returns {number}
 */
export function calcPersonalAllowance(income, bundle) {
  const PA = TAX_JSON.income?.personalAllowance || 12570;
  const taperStart = TAX_JSON.income?.personalAllowanceTaperStart || 100000;
  const taperEnd   = TAX_JSON.income?.personalAllowanceTaperEnd || 125140;
  if (income <= taperStart) return PA;
  if (income >= taperEnd) return 0;
  return Math.max(0, PA - Math.floor((income - taperStart) / 2));
}

/**
 * Full UK income tax with proper ordering: non-savings → savings → dividends.
 * Includes PSA & dividend allowance.
 * CANONICAL
 * @param {object} entity
 * @param {object} [bundle]
 * @returns {{ tax:number, byBand:Array, byType:object, marginalRate:number }}
 */
export function calcIncomeTax(entity, bundle) {
  const income = calcAllIncome(entity, bundle);
  const ani = calcANI(entity, bundle).ani;
  const pa = calcPersonalAllowance(ani, bundle);
  let remaining = pa;
  const PA  = TAX_JSON.income.personalAllowance;
  const BR  = TAX_JSON.income.basicRate;
  const HR  = TAX_JSON.income.higherRate;
  const AR  = TAX_JSON.income.additionalRate;
  const BRL = TAX_JSON.income.basicRateBand;
  const ART = TAX_JSON.income.additionalRateThreshold;
  // Allocate PA: non-savings first, then savings, then dividends
  const ns = income.byType.non_savings - Math.min(income.byType.non_savings, remaining);
  remaining -= Math.min(income.byType.non_savings, remaining);
  const sv = income.byType.savings - Math.min(income.byType.savings, remaining);
  remaining -= Math.min(income.byType.savings, remaining);
  const dv = income.byType.dividends - Math.min(income.byType.dividends, remaining);
  // Tax non-savings
  let bandsLeft = BRL;
  let nsBasic = Math.min(ns, bandsLeft); bandsLeft -= nsBasic;
  let nsHigher = Math.min(ns - nsBasic, ART - PA - BRL); bandsLeft = ART - PA - BRL - nsHigher;
  let nsAdd = Math.max(0, ns - nsBasic - nsHigher);
  let tax = nsBasic * BR + nsHigher * HR + nsAdd * AR;
  // Tax savings (with PSA)
  const psa = entity?.isHigherRateTaxpayer ? 500 : (ani >= ART) ? 0 : 1000;
  const svTaxable = Math.max(0, sv - psa);
  let svBasic = Math.min(svTaxable, Math.max(0, bandsLeft));
  let svHigher = Math.max(0, svTaxable - svBasic);
  tax += svBasic * BR + svHigher * HR;
  // Tax dividends (with allowance)
  const da = TAX_JSON.income.dividendAllowance || 500;
  const dvTaxable = Math.max(0, dv - da);
  const dbr = TAX_JSON.income.dividendBasicRate || 0.0875;
  const dhr = TAX_JSON.income.dividendHigherRate || 0.3375;
  const dar = TAX_JSON.income.dividendAdditionalRate || 0.3935;
  const dvBasic = Math.min(dvTaxable, Math.max(0, BRL - nsBasic - svBasic));
  const dvHigher = Math.max(0, dvTaxable - dvBasic);
  tax += dvBasic * dbr + dvHigher * dhr;
  return {
    tax: Math.round(tax),
    byBand: [
      { type: 'non_savings_basic',  amount: nsBasic, rate: BR },
      { type: 'non_savings_higher', amount: nsHigher, rate: HR },
      { type: 'non_savings_add',    amount: nsAdd, rate: AR },
      { type: 'savings_basic',      amount: svBasic, rate: BR },
      { type: 'savings_higher',     amount: svHigher, rate: HR },
      { type: 'div_basic',          amount: dvBasic, rate: dbr },
      { type: 'div_higher',         amount: dvHigher, rate: dhr },
    ],
    byType: income.byType,
    marginalRate: ani > ART ? AR : ani > 50270 ? HR : BR,
  };
}

/**
 * Dividend tax calc.
 * CANONICAL
 * @param {number} divIncome
 * @param {number} otherTaxable - non-savings + savings already taxed
 * @param {object} [bundle]
 * @returns {{ tax:number, allowance:number, taxable:number }}
 */
export function calcDividendTax(divIncome, otherTaxable, bundle) {
  const da = TAX_JSON.income.dividendAllowance || 500;
  const dbr = TAX_JSON.income.dividendBasicRate || 0.0875;
  const dhr = TAX_JSON.income.dividendHigherRate || 0.3375;
  const dar = TAX_JSON.income.dividendAdditionalRate || 0.3935;
  const BRL = TAX_JSON.income.basicRateBand || 37700;
  const ART = TAX_JSON.income.additionalRateThreshold || 125140;
  const taxable = Math.max(0, divIncome - da);
  if (taxable === 0) return { tax: 0, allowance: da, taxable: 0 };
  const inBasic = Math.min(taxable, Math.max(0, BRL - otherTaxable));
  const inAdd   = Math.max(0, otherTaxable + taxable - ART);
  const inHigher = Math.max(0, taxable - inBasic - inAdd);
  const tax = inBasic * dbr + inHigher * dhr + inAdd * dar;
  return { tax: Math.round(tax), allowance: da, taxable };
}

/**
 * High Income Child Benefit Charge — 1% per £200 over £60k threshold.
 * CANONICAL
 * @param {object} entity
 * @param {object} [bundle]
 * @returns {{ charge:number, ani:number, threshold:number, dependantsCount:number, eligible:boolean }}
 */
export function calcHICBC(entity, bundle) {
  const ani = calcANI(entity, bundle).ani;
  const threshold = TAX_JSON.income?.highIncomeChildBenefitThreshold || 60000;
  const cap = threshold + 20000;
  const kids = (entity?.dependants || []).filter(d => d.type === 'child' && (d.age || 0) < 18 && d.financiallyDependent !== false);
  if (kids.length === 0 || ani <= threshold) return { charge: 0, ani, threshold, dependantsCount: kids.length, eligible: kids.length > 0 };
  // Approximate child benefit: £25.60/wk first child + £16.95/wk each additional
  const benefit = (25.60 + 16.95 * (kids.length - 1)) * 52;
  const pct = Math.min(1, (ani - threshold) / (cap - threshold));
  return { charge: Math.round(benefit * pct), ani, threshold, dependantsCount: kids.length, eligible: true };
}

/**
 * Personal Savings Allowance bands by taxpayer rate.
 * CANONICAL
 * @param {object} entity
 * @param {object} [bundle]
 * @returns {{ allowance:number, band:string, savings:number, taxableSavings:number }}
 */
export function calcPSA(entity, bundle) {
  const ani = calcANI(entity, bundle).ani;
  const ART = TAX_JSON.income.additionalRateThreshold;
  const BRT = TAX_JSON.income.basicRateThreshold;
  let allowance, band;
  if (ani >= ART)      { allowance = 0;    band = 'additional'; }
  else if (ani >= BRT) { allowance = 500;  band = 'higher'; }
  else                 { allowance = 1000; band = 'basic'; }
  const savings = +entity?.income?.savingsInterest || 0;
  const taxableSavings = Math.max(0, savings - allowance);
  return { allowance, band, savings, taxableSavings };
}

/**
 * Marriage Allowance: lower earner can transfer £1,260 of PA to spouse.
 * Only if neither spouse pays higher rate.
 * CANONICAL
 * @param {object} entity
 * @param {object} [bundle]
 * @returns {{ eligible:boolean, transferAmount:number, taxSaving:number, reason?:string }}
 */
export function calcMarriageAllowance(entity, bundle) {
  if (!entity.isCouple || !entity.spouse) {
    return { eligible: false, transferAmount: 0, taxSaving: 0, reason: 'Not married/civil partnership' };
  }
  const transfer = TAX_JSON.income?.marriageAllowanceTransfer || 1260;
  const recipientAni = calcANI(entity, bundle).ani;
  const spouseAni    = +entity.spouse.income || 0;
  const lower = Math.min(recipientAni, spouseAni);
  const higher = Math.max(recipientAni, spouseAni);
  if (higher > TAX_JSON.income.basicRateThreshold) {
    return { eligible: false, transferAmount: 0, taxSaving: 0, reason: 'Higher earner above basic rate' };
  }
  if (lower >= TAX_JSON.income.personalAllowance) {
    return { eligible: false, transferAmount: 0, taxSaving: 0, reason: 'Lower earner uses full PA' };
  }
  return { eligible: true, transferAmount: transfer, taxSaving: Math.round(transfer * 0.20) };
}

/**
 * Classifies an income item type.
 * CANONICAL
 * @param {object} item - { type?, source?, amount }
 * @returns {string} 'non_savings' | 'savings' | 'dividends' | 'cgt'
 */
export function classifyIncomeType(item) {
  const t = String(item?.type || item?.source || '').toLowerCase();
  if (t.includes('dividend')) return 'dividends';
  if (t.includes('interest') || t.includes('savings')) return 'savings';
  if (t.includes('capital-gain') || t.includes('cgt')) return 'cgt';
  return 'non_savings';
}

/**
 * Full Domain O income taxonomy aggregation (33-item spec).
 * Returns total + breakdown by classify type.
 * CANONICAL
 * @param {object} entity
 * @param {object} [bundle]
 * @returns {{ total:number, byType:{non_savings:number, savings:number, dividends:number, cgt:number}, items:Array }}
 */
export function calcAllIncome(entity, bundle) {
  const items = [];
  const inc = entity?.income || {};
  const ind = entity?.individual || {};
  if (ind.gross_salary)  items.push({ type: 'employment', amount: +ind.gross_salary });
  if (inc.salary)        items.push({ type: 'employment', amount: +inc.salary });
  if (inc.employment)    items.push({ type: 'employment', amount: +inc.employment });
  if (inc.selfEmployed)  items.push({ type: 'self-employment', amount: +inc.selfEmployed });
  if (inc.dividends)     items.push({ type: 'dividends', amount: +inc.dividends });
  if (inc.rental || inc.rentalIncome) items.push({ type: 'rental', amount: +(inc.rental || inc.rentalIncome) });
  if (inc.savingsInterest) items.push({ type: 'savings-interest', amount: +inc.savingsInterest });
  if (inc.overseasIncome)  items.push({ type: 'overseas', amount: +inc.overseasIncome });
  if (inc.statePension?.annual) items.push({ type: 'state-pension', amount: +inc.statePension.annual });
  if (entity.drawdown)   items.push({ type: 'drawdown', amount: +entity.drawdown });
  if (inc.other)         items.push({ type: 'other', amount: +inc.other });
  // Bank interest from nested
  for (const b of (entity?.assets?.bank || [])) {
    if (b.balance && b.interest_rate) {
      items.push({ type: 'savings-interest', amount: Math.round((+b.balance || 0) * (+b.interest_rate || 0)) });
    }
  }
  const byType = { non_savings: 0, savings: 0, dividends: 0, cgt: 0 };
  for (const it of items) {
    const cls = classifyIncomeType(it);
    byType[cls] = (byType[cls] || 0) + (+it.amount || 0);
  }
  const total = items.reduce((s, i) => s + (+i.amount || 0), 0);
  return { total: Math.round(total), byType, items };
}

// ── ESTATE-SIDE FUNCTIONS ────────────────────────────────────────────────────

/**
 * IHT multi-slider waterfall: applies deltas { drawdown?, gift?, bpr?, sippDraw? }
 * and returns waterfall stages. Used by the IHT-impact slider in TaxEstate.
 * CANONICAL
 * @param {object} entity
 * @param {object} deltas
 * @param {object} [bundle]
 * @returns {{ stages:Array, baseline:number, after:number, savings:number }}
 */
export function ihtWaterfall(entity, deltas, bundle) {
  const baseline = ihtDynamic(entity, true).iht;
  const stages = [{ label: 'Baseline IHT', value: baseline, cumulative: baseline }];
  let cur = { ...entity };
  let cumIht = baseline;
  if (deltas?.sippDraw) {
    cur = { ...cur, drawdown: (+cur.drawdown || 0) + (+deltas.sippDraw) };
    const ih = ihtDynamic(cur, true).iht;
    stages.push({ label: 'After SIPP drawdown', value: ih, cumulative: ih, delta: ih - cumIht });
    cumIht = ih;
  }
  if (deltas?.gift) {
    cur = { ...cur, assets: { ...cur.assets, trustGifts: { total: (+cur.assets?.trustGifts?.total || 0) + (+deltas.gift), date: new Date().toISOString().split('T')[0] } } };
    const ih = ihtDynamic(cur, true).iht;
    stages.push({ label: 'After gifts to trust', value: ih, cumulative: ih, delta: ih - cumIht });
    cumIht = ih;
  }
  if (deltas?.bpr) {
    // Mark portfolio as BPR-qualifying
    cur = { ...cur, assets: { ...cur.assets, portfolio: { ...cur.assets?.portfolio, bpr: true } } };
    const ih = ihtDynamic(cur, true).iht;
    stages.push({ label: 'After BPR positioning', value: ih, cumulative: ih, delta: ih - cumIht });
    cumIht = ih;
  }
  return { stages, baseline, after: cumIht, savings: baseline - cumIht };
}

/**
 * £5k-step drawdown matrix: tax + IHT impact at each level.
 * CANONICAL
 * @param {object} entity
 * @param {{from:number,to:number,step:number}} [range]
 * @param {boolean} [statePension=true]
 * @param {boolean|number} [spousalSplit=false]
 * @param {object} [bundle]
 * @returns {{ rows:Array, recommended:number }}
 */
export function drawdownMatrix(entity, range = { from: 0, to: 100000, step: 5000 }, statePension = true, spousalSplit = false, bundle) {
  const sp = statePension ? _statePensionAnnual(entity) : 0;
  const rows = [];
  let bestNet = -Infinity, bestRow = 0;
  for (let dd = range.from; dd <= range.to; dd += range.step) {
    const tax = incomeTax(dd, sp);
    const sippDelta = ihtSippDelta({ ...entity, drawdown: dd });
    const ihtSaved  = ihtSippDelta(entity) - sippDelta;
    const net = (dd - tax) + ihtSaved;
    rows.push({ drawdown: dd, tax, ihtSaved, net, netAfterTax: dd - tax });
    if (net > bestNet) { bestNet = net; bestRow = dd; }
  }
  return { rows, recommended: bestRow };
}

/**
 * Allowance tracker: ISA / PSA / CGT / Dividend / PA usage.
 * CANONICAL
 * @param {object} entity
 * @param {object} [bundle]
 * @returns {{ isa:object, psa:object, cgt:object, dividend:object, pa:object, utilization:number }}
 */
export function allowanceTracker(entity, bundle) {
  const a = entity?.assets || {};
  // ISA: contributions this tax year
  const isaUsed = (Array.isArray(a.investments) ? a.investments : [])
    .filter(i => (i.type || '').toLowerCase().includes('isa'))
    .reduce((s, i) => s + (+i.contribution_current_tax_year || 0), 0);
  const isa = {
    limit: TAX.isaAllowance,
    used: Math.round(isaUsed),
    remaining: Math.max(0, TAX.isaAllowance - isaUsed),
    pctUsed: Math.round((isaUsed / TAX.isaAllowance) * 100),
  };
  // PSA
  const psa_ = calcPSA(entity, bundle);
  const psa = {
    limit: psa_.allowance,
    used: Math.round(Math.min(psa_.allowance, psa_.savings)),
    remaining: Math.max(0, psa_.allowance - psa_.savings),
    pctUsed: psa_.allowance > 0 ? Math.round((Math.min(psa_.allowance, psa_.savings) / psa_.allowance) * 100) : 0,
  };
  // CGT annual exempt
  const cgt = {
    limit: TAX.cgaAllowance,
    used: Math.round(+entity?.income?.realisedGains || 0),
    remaining: Math.max(0, TAX.cgaAllowance - (+entity?.income?.realisedGains || 0)),
    pctUsed: Math.round(((+entity?.income?.realisedGains || 0) / TAX.cgaAllowance) * 100),
  };
  // Dividend allowance
  const div = {
    limit: TAX_JSON.income?.dividendAllowance || 500,
    used: Math.round(+entity?.income?.dividends || 0),
    remaining: Math.max(0, (TAX_JSON.income?.dividendAllowance || 500) - (+entity?.income?.dividends || 0)),
    pctUsed: Math.min(100, Math.round(((+entity?.income?.dividends || 0) / (TAX_JSON.income?.dividendAllowance || 500)) * 100)),
  };
  // Personal allowance utilisation
  const ani = calcANI(entity, bundle).ani;
  const pa  = calcPersonalAllowance(ani, bundle);
  const paInfo = {
    limit: TAX.pa,
    effective: pa,
    tapered: pa < TAX.pa,
    pctUsed: Math.min(100, ani > 0 ? Math.round((Math.min(ani, pa) / TAX.pa) * 100) : 0),
  };
  // Composite utilization
  const utilization = Math.round((isa.pctUsed + psa.pctUsed + cgt.pctUsed + div.pctUsed) / 4);
  return { isa, psa, cgt, dividend: div, pa: paInfo, utilization };
}

/**
 * Will & LPA discovery + intestacy implications + cohabiting RED flag.
 * CANONICAL
 * @param {object} entity
 * @returns {{ will:object, lpa:object, flags:Array<string>, intestacyRisk:number }}
 */
export function willLpaStatus(entity) {
  const will = {
    status: entity.willStatus || 'unknown',
    current: entity.willStatus === 'current',
    lastReviewedAt: entity.willLastReviewed || null,
  };
  const lpa = {
    status: entity.lpaStatus || 'none',
    propertyFinance: entity.lpaStatus === 'both' || entity.lpaStatus === 'pf',
    healthWelfare:   entity.lpaStatus === 'both' || entity.lpaStatus === 'hw',
  };
  const flags = [];
  if (!will.current) flags.push('NO_CURRENT_WILL');
  if (lpa.status === 'none') flags.push('NO_LPA');
  // Cohabiting without will = RED flag
  if (entity.relationshipStatus === 'cohabiting' && !will.current) flags.push('RED_COHABITING_NO_WILL');
  if (Array.isArray(entity.relationships) && entity.relationships.some(r => r.type === 'cohabiting' && !will.current)) {
    flags.push('RED_COHABITING_NO_WILL');
  }
  // Intestacy risk score
  const exposure = ihtDynamic(entity, true);
  const intestacyRisk = !will.current ? exposure.taxable : 0;
  return { will, lpa, flags, intestacyRisk };
}

/**
 * UK intestacy distribution rules: spouse/civil partner first, then issue.
 * Returns illustrative shares based on family structure.
 * CANONICAL
 * @param {object} entity
 * @returns {{ rules:string, beneficiaries:Array, totalEstate:number }}
 */
export function intestacyDistribution(entity) {
  const totalEstate = netWorth(entity);
  const beneficiaries = [];
  const hasSpouse = entity.isCouple || (Array.isArray(entity.relationships) && entity.relationships.some(r => r.type === 'spouse' || r.type === 'civil-partner'));
  const issue = (entity.dependants || []).filter(d => d.type === 'child');
  // Statutory legacy 2026: £322,000 to spouse
  const STATUTORY_LEGACY = 322000;
  let rules;
  if (hasSpouse && issue.length === 0) {
    beneficiaries.push({ name: 'Spouse', share: totalEstate, pct: 100 });
    rules = 'Spouse takes whole estate (no issue).';
  } else if (hasSpouse && issue.length > 0) {
    const toSpouse = Math.min(totalEstate, STATUTORY_LEGACY) + Math.max(0, totalEstate - STATUTORY_LEGACY) / 2;
    const toIssue  = totalEstate - toSpouse;
    beneficiaries.push({ name: 'Spouse', share: Math.round(toSpouse), pct: Math.round((toSpouse / totalEstate) * 100) });
    for (const k of issue) {
      beneficiaries.push({ name: `Child (${k.age})`, share: Math.round(toIssue / issue.length), pct: Math.round((toIssue / issue.length / totalEstate) * 100) });
    }
    rules = `Spouse: £${STATUTORY_LEGACY.toLocaleString()} statutory legacy + half of residue. Issue split remainder per stirpes.`;
  } else if (issue.length > 0) {
    for (const k of issue) {
      beneficiaries.push({ name: `Child (${k.age})`, share: Math.round(totalEstate / issue.length), pct: Math.round(100 / issue.length) });
    }
    rules = 'Issue take whole estate equally.';
  } else {
    rules = 'No spouse/issue → parents → siblings → other relatives → Crown.';
  }
  return { rules, beneficiaries, totalEstate };
}

/**
 * Cost of dying intestate: probate delay + IHT inefficiency + dispute risk.
 * CANONICAL
 * @param {object} entity
 * @returns {{ total:number, breakdown:object }}
 */
export function noWillCoI(entity) {
  if (entity.willStatus === 'current') return { total: 0, breakdown: { delay: 0, ihtPenalty: 0, dispute: 0 } };
  const exposure = ihtDynamic(entity, true);
  const delay      = Math.round(exposure.gross * 0.005);   // 6mo probate delay cost
  const ihtPenalty = Math.round(exposure.iht * 0.05);      // Loss of charity uplift, RNRB optimisation
  const dispute    = Math.round(exposure.gross * 0.02);    // Dispute risk
  return { total: delay + ihtPenalty + dispute, breakdown: { delay, ihtPenalty, dispute } };
}

/**
 * RNRB taper: £2m taper + downsizing credit.
 * CANONICAL
 * @param {number|object} estateValueOrEntity - estate value OR entity
 * @param {object} [bundle]
 * @returns {{ rnrb:number, lost:number, downsizingCredit:number, eligible:boolean }}
 */
export function rnrbTaper(estateValueOrEntity, bundle) {
  let estateValue;
  let downsizingCredit = 0;
  let eligible = true;
  if (typeof estateValueOrEntity === 'object' && estateValueOrEntity !== null) {
    const e = estateValueOrEntity;
    estateValue = ihtDynamic(e, true).gross;
    eligible = rnrbEligibility(e).eligible;
    downsizingCredit = +e.estate?.downsizingCredit || 0;
  } else {
    estateValue = +estateValueOrEntity || 0;
  }
  const rnrb = TAX_JSON.inheritanceTax?.residenceNilRateBand || 175000;
  const taper = TAX_JSON.inheritanceTax?.residenceNilRateBandTaperStart || 2000000;
  const effective = estateValue > taper ? Math.max(0, rnrb - (estateValue - taper) / 2) : rnrb;
  const lost = rnrb - effective;
  return { rnrb: eligible ? effective + downsizingCredit : 0, lost, downsizingCredit, eligible };
}

/**
 * RNRB eligibility check: direct-descendant inheritance of residence.
 * CANONICAL
 * @param {object} entity
 * @returns {{ eligible:boolean, reason:string, residentValue:number }}
 */
export function rnrbEligibility(entity) {
  const a = entity?.assets || {};
  const hasResidence = (a.residence?.value || 0) > 0 ||
                       (Array.isArray(a.property) && a.property.some(p => (p.type || '').includes('main-residence')));
  const hasDirectDescendant = (entity.dependants || []).some(d => d.type === 'child') ||
                               (entity.beneficiaries || []).some(b => /child|grandchild/i.test(b.relation || ''));
  if (!hasResidence) return { eligible: false, reason: 'No qualifying residence', residentValue: 0 };
  if (!hasDirectDescendant) return { eligible: false, reason: 'No direct descendant', residentValue: _propertyTotal(entity) };
  return { eligible: true, reason: 'Eligible — residence + direct descendant', residentValue: _propertyTotal(entity) };
}

/**
 * BPR qualifying value: £2.5m (single) / £5m (couple) gauge with AIM 50% sub-block.
 * Note: spec sometimes refers to 2.5M, sometimes 2M. Use IHT bundle: aprBprCombinedAllowance.
 * CANONICAL
 * @param {object} entity
 * @returns {{ tier1Full:number, tier2Aim:number, allowance:number, used:number, remaining:number }}
 */
export function bprQualifyingValue(entity) {
  const allowance = TAX_JSON.inheritanceTax?.aprBprCombinedAllowance || 2500000;
  const a = entity?.assets || {};
  const holdings = (a.portfolio?.holdings || []);
  let tier1 = 0, tier2 = 0;
  for (const h of holdings) {
    const val = +h.value || 0;
    if (h.bprTagged && !h.aim) tier1 += val;
    else if (h.aim || h.bprTagged) tier2 += val;
  }
  // Legacy: portfolio.bpr flag means whole portfolio qualifies
  if (a.portfolio?.bpr && tier1 === 0 && tier2 === 0) {
    tier1 = a.portfolio.value || 0;
  }
  const used = Math.min(allowance, tier1) + Math.min(Math.max(0, allowance - tier1), tier2 * 0.5);
  return {
    tier1Full: tier1,
    tier2Aim: tier2,
    allowance: entity.isCouple ? allowance * 2 : allowance,
    used: Math.round(used),
    remaining: Math.max(0, (entity.isCouple ? allowance * 2 : allowance) - used),
  };
}

/**
 * BPR / APR allowance: couples £5m pool.
 * CANONICAL
 * @param {object} entity
 * @returns {{ individual:number, couple:number, used:number, remaining:number }}
 */
export function bprAprAllowance(entity) {
  const ind = TAX_JSON.inheritanceTax?.aprBprCombinedAllowance || 2500000;
  const couple = TAX_JSON.inheritanceTax?.aprBprCombinedAllowanceCouple || 5000000;
  const total = entity.isCouple ? couple : ind;
  const used = bprQualifyingValue(entity).used;
  return { individual: ind, couple, used, remaining: Math.max(0, total - used) };
}

/**
 * APR (Agricultural Property Relief) qualifying conditions.
 * CANONICAL
 * @param {object} entity
 * @returns {{ qualifies:boolean, reason:string, value:number }}
 */
export function aprQualification(entity) {
  const a = entity?.assets || {};
  const farmland = (a.property || []).filter(p => /farm|agricultural/i.test(p.type || ''));
  if (farmland.length === 0) return { qualifies: false, reason: 'No agricultural property', value: 0 };
  const total = farmland.reduce((s, p) => s + (+p.value_gbp || +p.value || 0), 0);
  // Must be owner-occupied 2yrs OR tenant-occupied 7yrs
  const oldest = farmland.reduce((min, p) => {
    const d = new Date(p.purchase_date || Date.now());
    return d < min ? d : min;
  }, new Date());
  const yrs = (Date.now() - oldest) / (365.25 * 86400000);
  if (yrs < 2) return { qualifies: false, reason: `Held only ${yrs.toFixed(1)} years (<2)`, value: total };
  return { qualifies: true, reason: `Farmland held ${yrs.toFixed(1)} years`, value: total };
}

/**
 * Trust 10-year periodic charge timeline.
 * CANONICAL
 * @param {object} trust - { settlementDate, currentValue, ... }
 * @returns {{ nextChargeDate:string, yearsToCharge:number, estimatedCharge:number, rate:number }}
 */
export function trustPeriodicCharge(trust) {
  if (!trust) return { nextChargeDate: null, yearsToCharge: null, estimatedCharge: 0, rate: 0.06 };
  const set = new Date(trust.settlementDate || trust.date || Date.now());
  const yrs = (Date.now() - set) / (365.25 * 86400000);
  const cycles = Math.floor(yrs / 10);
  const next = new Date(set);
  next.setFullYear(next.getFullYear() + (cycles + 1) * 10);
  const yearsToCharge = (next - Date.now()) / (365.25 * 86400000);
  const NRB = TAX_JSON.inheritanceTax?.nilRateBand || 325000;
  const taxable = Math.max(0, (+trust.currentValue || +trust.total || 0) - NRB);
  const estimatedCharge = Math.round(taxable * 0.06);
  return {
    nextChargeDate: next.toISOString().split('T')[0],
    yearsToCharge: Math.round(yearsToCharge * 10) / 10,
    estimatedCharge,
    rate: 0.06,
  };
}

/**
 * Tax + Estate dual-impact panel for a candidate decision.
 * CANONICAL
 * @param {object} entity
 * @param {object} action - { kind, amount, ... }
 * @returns {{ taxImpact:object, estateImpact:object, net:number }}
 */
export function taxAndEstateImpact(entity, action) {
  const sim = simulateAction(entity, action);
  return {
    taxImpact: {
      delta: -Math.round(sim.netWorthDelta * 0.20),  // approximate marginal-rate hit
      detail: 'Approximate marginal rate × delta',
    },
    estateImpact: {
      ihtDelta: sim.ihtDelta,
      detail: sim.ihtDelta < 0 ? 'IHT reduced' : sim.ihtDelta > 0 ? 'IHT increased' : 'No IHT change',
    },
    net: sim.netWorthDelta - sim.ihtDelta,
  };
}

/**
 * FIG (Foreign Income & Gains) regime status — non-dom 2025 reform.
 * CANONICAL
 * @param {object} entity
 * @returns {{ eligible:boolean, yearsRemaining:number|null, status:string }}
 */
export function figStatus(entity) {
  const j = _jurisdictionOf(entity);
  if (j.primary === 'UK' && !j.deemedDomicile && !entity.individual?.residency_status?.includes('UK-resident')) {
    return { eligible: false, yearsRemaining: null, status: 'Not UK-resident' };
  }
  // FIG = first 4 years of UK residence (post-Apr 2025)
  const arrival = entity.individual?.uk_arrival_date || entity.uk_arrival_date;
  if (!arrival) return { eligible: false, yearsRemaining: null, status: 'UK-domiciled / unknown arrival' };
  const yrs = (Date.now() - new Date(arrival)) / (365.25 * 86400000);
  const remaining = Math.max(0, 4 - yrs);
  return {
    eligible: remaining > 0,
    yearsRemaining: Math.round(remaining * 10) / 10,
    status: remaining > 0 ? `FIG year ${Math.ceil(yrs)}/4` : 'FIG window closed',
  };
}

/**
 * Temporary Repatriation Facility (TRF) status — non-dom 2025 reform.
 * 12% rate window 2025/26 + 2026/27, 15% in 2027/28.
 * CANONICAL
 * @param {object} entity
 * @returns {{ eligible:boolean, currentRate:number, deadline:string }}
 */
export function trfStatus(entity) {
  const j = _jurisdictionOf(entity);
  // Eligible: was non-dom under old regime AND currently UK-resident
  const eligible = !!(entity.formerNonDom || entity.individual?.former_non_dom);
  const today = new Date();
  let currentRate, deadline;
  if (today < new Date('2027-04-06')) { currentRate = 0.12; deadline = '2027-04-05'; }
  else if (today < new Date('2028-04-06')) { currentRate = 0.15; deadline = '2028-04-05'; }
  else { currentRate = 0; deadline = 'closed'; }
  return { eligible, currentRate, deadline };
}

/**
 * Welsh income tax: same rates as rUK currently (devolved but matched).
 * CANONICAL
 * @param {object} entity
 * @returns {{ rates:object, applies:boolean, note:string }}
 */
export function welshIncomeTax(entity) {
  const isWelsh = /^(W|Wales)/i.test(entity?.jurisdiction?.subRegion || entity?.region || '');
  return {
    rates: { basic: 0.20, higher: 0.40, additional: 0.45 },
    applies: isWelsh,
    note: 'Welsh rates currently match rUK; devolved but unchanged. Welsh taxpayer code begins C.',
  };
}

/**
 * Scottish income tax — different bands and rates from rUK.
 * CANONICAL
 * @param {object} entity
 * @returns {{ rates:object, applies:boolean, bands:Array }}
 */
export function scottishIncomeTax(entity) {
  const isScottish = /^(S|Scotland)/i.test(entity?.jurisdiction?.subRegion || entity?.region || '') ||
                     entity?.taxResidency === 'scottish';
  return {
    rates: {
      starter: 0.19, basic: 0.20, intermediate: 0.21,
      higher: 0.42, advanced: 0.45, top: 0.48,
    },
    applies: isScottish,
    bands: [
      { name: 'Starter',      from: 12570,  to: 14876,  rate: 0.19 },
      { name: 'Basic',        from: 14876,  to: 26561,  rate: 0.20 },
      { name: 'Intermediate', from: 26561,  to: 43662,  rate: 0.21 },
      { name: 'Higher',       from: 43662,  to: 75000,  rate: 0.42 },
      { name: 'Advanced',     from: 75000,  to: 125140, rate: 0.45 },
      { name: 'Top',          from: 125140, to: null,   rate: 0.48 },
    ],
  };
}

/**
 * Gift clock projection — per-gift PETs array with transitional rules.
 * CANONICAL
 * @param {object} entity
 * @param {Date} [today=now]
 * @returns {Array<{date:string, amount:number, recipient:string, yrs:number, taperPct:number, ihtIfDieToday:number, ihtFreeIn:number}>}
 */
export function giftClockProjection(entity, today = new Date()) {
  const all = giftClockAll(entity);
  const IHT_RATE = TAX.ihtRate;
  return all.map(g => {
    const taperPct = g.taperBand?.rate || 0;
    const ihtIfDieToday = Math.round(g.amount * taperPct);
    return {
      date: g.date,
      amount: g.amount,
      recipient: g.recipient,
      yrs: g.yearsElapsed,
      taperPct,
      ihtIfDieToday,
      ihtFreeIn: g.freeIn,
    };
  });
}

// ============================================================================
// CANONICAL ENGINE FACADE — re-export from domain engines
// ============================================================================
//
// Strategic intent: screens currently import from fq-calculator.js. Domain logic
// lives (or should live) in {tax-estate,cashflow,timeline,risk,home}-engine.js.
// Re-exporting here lets screens migrate gradually while guaranteeing a single
// canonical source. Names that already exist in fq-calculator are NOT re-exported
// to avoid clashes (e.g. costOfInaction is dispatched here, not re-exported).
//
// Exports below carry the // CANONICAL convention for the engine audit.
// ============================================================================

export {
  // ── Cashflow engine ─────────────────────────────────────────────────────
  swrRegime              as cf_swrRegime,
  guytonKlinger          as cf_guytonKlinger,
  maxDrawdownExposure    as cf_maxDrawdownExposure,
  sequenceOfReturnsVulnerability as cf_sequenceOfReturnsVulnerability,
  probabilityOfSuccess   as cf_probabilityOfSuccess,
  portfolioEfficiency    as cf_portfolioEfficiency,
  prcPccSpread           as cf_prcPccSpread,
  realityEngineFactorisation as cf_realityEngineFactorisation,
  fiveCashflowScenarios  as cf_fiveCashflowScenarios,
} from './cashflow-engine.js';

export {
  // ── Tax & Estate engine — re-exported with explicit aliases to avoid
  // clashing with fq-calculator's own implementations.
  taxThisYear            as te_taxThisYear,
  incomeTaxDetail        as te_incomeTaxDetail,
  nicsDetail             as te_nicsDetail,
  cgtDetail              as te_cgtDetail,
  dividendTaxDetail      as te_dividendTaxDetail,
  taxDrag                as te_taxDrag,
  ihtExposure            as te_ihtExposure,
  trustContribution      as te_trustContribution,
  beneficiaryChain       as te_beneficiaryChain,
  bprClock               as te_bprClock,
  bprAllowanceTracker    as te_bprAllowanceTracker,
  selfAssessment         as te_selfAssessment,
} from './tax-estate-engine.js';

export {
  // ── Timeline engine ─────────────────────────────────────────────────────
  calcAPQTimeline,
  calcMilestones,
  calcGoalProgress,
  calcScoreHistory,
  calcRiskHistory,
  listScenarios,
  openScenario,
  saveScenario,
  updateScenario,
  deleteScenario,
} from './timeline-engine.js';

export {
  // ── Home engine ─────────────────────────────────────────────────────────
  computeSinceLastVisit,
  stateTileJourney,
  whatActionWouldItTake,
  compositeTrajectory,
  cohortRankHistory,
  realityEngineState,
  prcPccCurrent,
} from './home-engine.js';

export {
  // ── Monthly-flow engine ─────────────────────────────────────────────────
  monthlyFlow,
  allocationPressure,
} from './monthly-flow-engine.js';

export {
  // ── State-tiles engine ──────────────────────────────────────────────────
  safetyNetState,
  debtFreeState,
  fiState,
  beneficiaryState,
} from './state-tiles-engine.js';

export {
  // ── Risk engine ─────────────────────────────────────────────────────────
  runShock,
  riskShockSuite,
  whatWouldHelpMost,
  projectBTR,
} from './risk-engine.js';
