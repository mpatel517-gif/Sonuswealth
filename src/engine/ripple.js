// ─────────────────────────────────────────────────────────────────────────────
// SONUSWEALTH · src/engine/ripple.js  (Phase 2c — PP-5)
//
// Single ripple path. One call returns every derived computation that depends
// on the entity, partitioned into scopes so callers can request only what
// they need. The point isn't speed (engine functions are already cheap) — it's
// correctness: every screen reads the same numbers from the same source, so
// Home.NW and MyMoney.NW can never disagree.
//
// Contract:
//   rippleEffect(entity, change?, scopes?)
//     → { balance_sheet, scores, iht, cashflow, protection, tax, timeline, _meta }
//
// Scopes:
//   'all'           → every block (default)
//   'balance_sheet' → netWorth, totals by category, liabilities
//   'scores'        → calcFQ, calcRisk, calcAPQ, financialProfile
//   'iht'           → ihtDynamic + breakdown + costOfInaction
//   'cashflow'      → monthlySurplus, fundedRatio, guardrail, investable
//   'protection'    → protectionFlat-derived gaps
//   'tax'           → incomeTax against effective drawdown + state pension
//   'timeline'      → planFor + planStaleness for primary plan
//
// Failure isolation: each scope is wrapped in try/catch so a bug in one
// subsystem (e.g. cashflow projection) cannot blank the whole UI. Failed
// scopes carry an `error` field and the rest of the output remains usable.
//
// Cache key: caller can use `_meta.bundleVersion` + `entity` identity to
// memoise. The companion React hook in src/state/ripple.jsx does this.
// ─────────────────────────────────────────────────────────────────────────────

import {
  netWorth, calcFQ, calcRisk, calcAPQ,
  ihtDynamic, costOfInaction, monthlySurplus, fundedRatio,
  guardrail, investable, financialProfile, planFor,
  fqBand, riskBand, incomeTax,
} from './fq-calculator.js';
import {
  pensionTotal, isaTotal, giaTotal, propertyTotal, cashTotal,
  liabilitiesTotal, monthlyDebtService, annualIncome,
  statePensionAnnual, targetIncome, protectionFlat, personAge,
} from './_helpers.js';
import { getBundle, getBundleVersion, getMacro, TAX } from './_bundle.js';

// ── Scope constants ─────────────────────────────────────────────────────────
export const SCOPE = Object.freeze({
  ALL:           'all',
  BALANCE_SHEET: 'balance_sheet',
  SCORES:        'scores',
  IHT:           'iht',
  CASHFLOW:      'cashflow',
  PROTECTION:    'protection',
  TAX:           'tax',
  TIMELINE:      'timeline',
});

const KNOWN_SCOPES = new Set([
  SCOPE.BALANCE_SHEET, SCOPE.SCORES, SCOPE.IHT, SCOPE.CASHFLOW,
  SCOPE.PROTECTION, SCOPE.TAX, SCOPE.TIMELINE,
]);

// ── Helpers ─────────────────────────────────────────────────────────────────
function wantsScope(scopes, scope) {
  if (!Array.isArray(scopes) || scopes.length === 0) return true;
  return scopes.includes('all') || scopes.includes(scope);
}

function safe(label, fn) {
  try {
    return { ok: true, value: fn() };
  } catch (e) {
    return { ok: false, error: e?.message || String(e), label };
  }
}

// ── Per-scope builders ──────────────────────────────────────────────────────

function buildBalanceSheet(entity) {
  const nw = safe('netWorth', () => netWorth(entity));
  return {
    netWorth: nw.ok ? nw.value : null,
    error: nw.ok ? undefined : nw.error,
    categories: {
      pensions:    safe('pensions',    () => pensionTotal(entity)).value ?? 0,
      isa:         safe('isa',         () => isaTotal(entity)).value ?? 0,
      gia:         safe('gia',         () => giaTotal(entity)).value ?? 0,
      property:    safe('property',    () => propertyTotal(entity)).value ?? 0,
      cash:        safe('cash',        () => cashTotal(entity)).value ?? 0,
      liabilities: safe('liabilities', () => liabilitiesTotal(entity)).value ?? 0,
    },
    monthlyDebtService: safe('monthlyDebtService', () => monthlyDebtService(entity)).value ?? 0,
  };
}

function buildScores(entity) {
  const fq = safe('calcFQ', () => calcFQ(entity));
  const risk = safe('calcRisk', () => calcRisk(entity));
  const apq = safe('calcAPQ', () => calcAPQ(entity));
  const profile = safe('financialProfile', () => financialProfile(entity));

  const fqScore = fq.ok ? (fq.value?.total ?? fq.value?.score ?? fq.value) : null;
  const riskScore = risk.ok ? (risk.value?.score ?? risk.value?.total ?? risk.value) : null;

  return {
    fq: {
      score: fqScore,
      band: fqScore != null ? safe('fqBand', () => fqBand(fqScore)).value : null,
      raw: fq.ok ? fq.value : null,
      error: fq.ok ? undefined : fq.error,
    },
    risk: {
      score: riskScore,
      band: riskScore != null ? safe('riskBand', () => riskBand(riskScore)).value : null,
      raw: risk.ok ? risk.value : null,
      error: risk.ok ? undefined : risk.error,
    },
    apq: {
      raw: apq.ok ? apq.value : null,
      count: Array.isArray(apq.value) ? apq.value.length : null,
      error: apq.ok ? undefined : apq.error,
    },
    profile: profile.ok ? profile.value : null,
    profileError: profile.ok ? undefined : profile.error,
  };
}

function buildIHT(entity) {
  // Include-SIPP rule: pre-2027-04-06 SIPP excluded; on/after that date included.
  const SIPP_IHT_DATE = TAX?.deadline || new Date('2027-04-06');
  const includeSipp = new Date() >= SIPP_IHT_DATE;

  const iht = safe('ihtDynamic', () => ihtDynamic(entity, includeSipp));
  const coi = safe('costOfInaction', () => costOfInaction(entity, 'IHT'));

  return {
    iht: iht.ok ? iht.value : null,
    ihtError: iht.ok ? undefined : iht.error,
    sippIncluded: includeSipp,
    cost_of_inaction: coi.ok ? coi.value : null,
    coiError: coi.ok ? undefined : coi.error,
  };
}

function buildCashflow(entity) {
  const surplus = safe('monthlySurplus', () => monthlySurplus(entity));
  const funded  = safe('fundedRatio', () => fundedRatio(entity));
  const gr      = safe('guardrail', () => guardrail(entity));
  const inv     = safe('investable', () => investable(entity));

  // Effective drawdown — explicit > target-employment delta > 0
  const drawdown = entity?.drawdown
                || entity?.drawdownPlan?.targetAnnual
                || entity?.drawdownPlan?.annual
                || 0;
  const target   = safe('targetIncome', () => targetIncome(entity)).value ?? 0;
  const employmentInc = safe('annualIncome', () => annualIncome(entity)).value ?? 0;
  let effectiveDrawdown = 0;
  let drawdownSource = 'none';
  if (drawdown > 0) {
    effectiveDrawdown = drawdown; drawdownSource = 'explicit';
  } else if (target > employmentInc) {
    effectiveDrawdown = Math.max(0, target - employmentInc);
    drawdownSource = employmentInc > 0 ? 'topup' : 'inferred_from_target';
  }

  return {
    monthlySurplus: surplus.ok ? surplus.value : null,
    surplusError: surplus.ok ? undefined : surplus.error,
    fundedRatio: funded.ok ? funded.value : null,
    fundedError: funded.ok ? undefined : funded.error,
    guardrail: gr.ok ? gr.value : null,
    investable: inv.ok ? inv.value : null,
    effectiveDrawdown,
    drawdownSource,
    targetIncome: target,
    employmentIncome: employmentInc,
  };
}

function buildProtection(entity) {
  const flat = safe('protectionFlat', () => protectionFlat(entity));
  if (!flat.ok) return { error: flat.error };
  const p = flat.value;

  // Simple gap heuristic: cover < 10x annual income is a flag.
  // The "right" gap rule lives in risk-engine; this is a v0 derived view.
  const income = safe('annualIncome', () => annualIncome(entity)).value ?? 0;
  const recommendedLifeCover = Math.round(income * 10);
  const lifeGap = Math.max(0, recommendedLifeCover - (p.life?.amount || 0));

  return {
    life:  p.life,
    ip:    p.ip,
    cic:   p.cic,
    rlp:   p.rlp,
    lifeGap,
    recommendedLifeCover,
    incomeUsed: income,
  };
}

function buildTax(entity) {
  // Compute against effective drawdown + employment + state pension.
  const drawdown = entity?.drawdown || entity?.drawdownPlan?.targetAnnual || 0;
  const employmentInc = safe('annualIncome', () => annualIncome(entity)).value ?? 0;
  const sp = safe('statePensionAnnual', () => statePensionAnnual(entity)).value ?? 0;
  const taxableEarnings = drawdown + employmentInc;

  const incTax = safe('incomeTax', () => incomeTax(taxableEarnings, sp, null));
  const grossIncome = taxableEarnings + sp;
  const netIncome = grossIncome - (incTax.value || 0);
  const effectiveRate = grossIncome > 0 ? Math.round((incTax.value || 0) / grossIncome * 100) : 0;

  return {
    grossIncome,
    statePension: sp,
    employmentIncome: employmentInc,
    drawdown,
    incomeTax: incTax.ok ? incTax.value : null,
    incomeTaxError: incTax.ok ? undefined : incTax.error,
    netIncome,
    effectiveTaxRate: effectiveRate,
    allowances: {
      personalAllowance: TAX?.pa,
      isa: TAX?.isaAllowance,
      pensionAA: TAX?.pensionAA,
      psaBasic: TAX?.psaBasic,
      psaHigher: TAX?.psaHigher,
    },
  };
}

function buildTimeline(entity) {
  // Use planFor for the canonical user plan. Defaulting to 'retirement'
  // window=30 mirrors the Timeline tab's primary plan tile. planFor returns
  // null when planType is unknown — handle gracefully.
  const planResult = safe('planFor', () => planFor(entity, 'retirement', 30));
  return {
    plan: planResult.ok ? planResult.value : null,
    error: planResult.ok ? undefined : planResult.error,
    age: safe('personAge', () => personAge(entity)).value ?? null,
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Compute all derived state from an entity, partitioned into scopes.
 *
 * @param {object} entity
 * @param {object|null} [change]  — optional event that triggered the recompute.
 *   In v0 we always do a full recompute regardless of change; the parameter
 *   is kept in the signature so future targeted invalidation can land without
 *   call-site churn. (PP-5 contract: rippleEffect(entity, change, scopes).)
 * @param {string[]} [scopes=['all']]  — subset to compute.
 * @returns {object}  partitioned derived state with _meta block.
 */
export function rippleEffect(entity, change = null, scopes = ['all']) {
  const startedAt = Date.now();

  if (!entity || typeof entity !== 'object') {
    return {
      _meta: {
        ok: false,
        error: 'rippleEffect: entity is required',
        scopes,
        change: change?.type || null,
        bundleVersion: getBundleVersion(),
        elapsedMs: 0,
        computedAt: new Date().toISOString(),
      },
    };
  }

  const out = {};
  if (wantsScope(scopes, SCOPE.BALANCE_SHEET)) out.balance_sheet = buildBalanceSheet(entity);
  if (wantsScope(scopes, SCOPE.SCORES))        out.scores        = buildScores(entity);
  if (wantsScope(scopes, SCOPE.IHT))           out.iht           = buildIHT(entity);
  if (wantsScope(scopes, SCOPE.CASHFLOW))      out.cashflow      = buildCashflow(entity);
  if (wantsScope(scopes, SCOPE.PROTECTION))    out.protection    = buildProtection(entity);
  if (wantsScope(scopes, SCOPE.TAX))           out.tax           = buildTax(entity);
  if (wantsScope(scopes, SCOPE.TIMELINE))      out.timeline      = buildTimeline(entity);

  out._meta = {
    ok: true,
    scopes: scopes.includes('all') ? [...KNOWN_SCOPES] : scopes.filter(s => KNOWN_SCOPES.has(s)),
    change: change?.type || null,
    bundleVersion: getBundleVersion(),
    bundle: TAX?.ver || null,
    taxYear: TAX?.taxYear || null,
    macroLoaded: getMacro() !== null,
    elapsedMs: Date.now() - startedAt,
    computedAt: new Date().toISOString(),
  };
  return out;
}

/**
 * Diff convenience: given two ripple outputs, returns the set of scope keys
 * whose top-level summary number changed. Useful for "what changed" banners
 * and for integration tests asserting that an event committed against an
 * entity actually moves the expected numbers.
 *
 * @param {object} before
 * @param {object} after
 * @returns {string[]}  scope names that differ
 */
export function rippleDiff(before, after) {
  if (!before || !after) return [];
  const moved = [];
  const cmp = (path) => {
    const a = path.split('.').reduce((o, k) => o?.[k], before);
    const b = path.split('.').reduce((o, k) => o?.[k], after);
    return a !== b;
  };
  if (cmp('balance_sheet.netWorth'))     moved.push('balance_sheet');
  if (cmp('scores.fq.score'))            moved.push('scores.fq');
  if (cmp('scores.risk.score'))          moved.push('scores.risk');
  if (cmp('iht.iht.iht') || cmp('iht.iht')) moved.push('iht');
  if (cmp('cashflow.monthlySurplus'))    moved.push('cashflow.surplus');
  if (cmp('cashflow.fundedRatio'))       moved.push('cashflow.funded');
  if (cmp('tax.incomeTax'))              moved.push('tax');
  if (cmp('protection.lifeGap'))         moved.push('protection');
  return moved;
}
