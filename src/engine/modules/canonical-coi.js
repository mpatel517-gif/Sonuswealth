// =====================================================================
// SONUSWEALTH — parts/3-Engine/lib/canonical-coi.js
// =====================================================================
// Canonical Cost of Inaction (CoI) per MM v2.6 §0.1.
// PURE. HANDLER-INJECTED (no global registry). NO BUNDLE WRITES.
//
// Built:    s17b-1 (7 May 2026 · Track A · Code · Opus)
// Phase:    C (canonical CoI infrastructure)
// Replaces: costOfInactionPension (uk-pension-2026-1-1.js — Phase D retrofit)
//           costOfInactionEstate (uk-estate-2026-1-1.js — Phase D retrofit)
// Consumed by: cashflow §G (Phase J) · MyMoney tab CoI tiles (Wave 1A)
//
// =====================================================================
// CANONICAL DEFINITION (MM v2.6 §0.1, verbatim authority):
//   "The quantified financial cost — expressed as NPV in today's money
//    at the CMA discount rate — of a user taking no action (or continuing
//    a suboptimal strategy) versus the engine-computed optimal action set,
//    within a specified decision domain."
//
//   - Domain-agnostic across the 12 canonical action domains.
//   - Always ≥ 0. Inaction always has a cost; question is magnitude.
//   - Plain-English action pair required: "current path costs you £X.
//     Here is what to do instead [action + outcome]."
//   - actionDomain is REQUIRED.
// =====================================================================
//
// Handler contract:
//   handler(entity, bundle, ctx) → {
//     status:        'IMPLEMENTED' | 'OPEN' | 'NOT_APPLICABLE',
//     currentPath:   number[],          // cashflow vector, period 0 = now
//     optimalPath:   number[],          // cashflow vector, period 0 = now
//     action: {
//       currentDescription: string,
//       optimalDescription: string,
//       outcome:            string,
//     },
//     rules:         string[],          // sources for this handler
//     notes?:        string,            // optional caveats
//   }
//
//   ctx provided by infrastructure: { discountRateReal, inflation,
//     horizonYears, currentAge, longevityAge, resolverNotes[] }
//
//   Optional `extras` arg to costOfInaction() and totalCoI() merges
//   additional keys into ctx — used by CF engine to inject CMA bundle
//   (ctx.cma) and CF-derived discount rate (ctx.discountRateReal override).
//   Reserved key `resolverNotes` cannot be overridden via extras.
//   Override of resolved values (discountRateReal/inflation/horizonYears/
//   currentAge/longevityAge) is permitted; an audit note is appended to
//   ctx.resolverNotes recording the override.
//
// Engines stay PURE: they EXPORT handlers, they don't register globally.
// Caller assembles handler map and passes to costOfInaction.
//
// =====================================================================
// Sources:
//   [MM-V26]    MM v2.6 §0.1 — canonical CoI definition
//   [FCA-COBS]  FCA COBS 13 Annex 2 — projection rates (~2% real default)
//   [BOE-MPC]   BoE Monetary Policy Committee remit — 2% CPI target
//   [ONS-LT]    ONS National Life Tables 2020-22 — longevity median ~88
//   [CII-AF4]   CII AF4 Investment Planning — NPV in financial planning
//   [BMA-2]     Brealey/Myers/Allen Ch.2 — NPV theory
//
// Quality gates:
//   Q1 ✓ JSDoc on every public fn        Q6 N/A (jurisdiction at handlers)
//   Q2 ✓ {amount, breakdown, rules,       Q7 ✓ smoke tests pass
//          explanation} envelope          Q8 ✓ minimal API; 12-domain registry
//   Q3 ✓ bundle via resolvers w/ sourced  Q9 ✓ NPV settled; handlers vary
//          defaults                              (handler `status` declares)
//   Q4 ✓ no date-gating at this layer
//   Q5 ✓ explanation is plain-English
// =====================================================================

import { npv } from './financial-math.js';


// ---------------------------------------------------------------------
// §A — Canonical action domains (frozen; mutable only via MM spec bump)
// Source: MM v2.6 §0.1 — sourced against CII curriculum practice areas
// ---------------------------------------------------------------------

export const ACTION_DOMAINS = Object.freeze([
  'drawdown',              // CII AF7, R04
  'wrapperSequencing',     // CII AF4, AF5
  'taxAllowances',         // CII AF1, J03
  'pensionTiming',         // CII AF7, R04
  'estatePlanning',        // CII AF1, AF5, J02
  'protection',            // CII R05, R07
  'contributions',         // CII AF7, R04
  'debt',                  // CII CF6 (Mortgage Advice)
  'gifting',               // CII AF1 (IHT planning)
  'propertyDecisions',     // CII CF6, ER1 (Equity Release)
  'investmentStrategy',    // CII AF4, R02
  'longTermCare',          // CII CF8 (Long-Term Care Insurance)
]);

const _ACTION_DOMAIN_SET = new Set(ACTION_DOMAINS);


// ---------------------------------------------------------------------
// §B — Sourced defaults (used only when bundle key absent)
// Open items if unset:  O-COI-CMA-RATE-1, O-COI-INFLATION-1, O-COI-HORIZON-1
// ---------------------------------------------------------------------

const _DEFAULTS = Object.freeze({
  discountRateReal: 0.02,   // [FCA-COBS] mid-rate convention
  inflation:        0.02,   // [BOE-MPC] CPI target
  longevityAge:     88,     // [ONS-LT] median band; MM v2.6 §0.1 three-band model
});


// ---------------------------------------------------------------------
// §C — Bundle resolvers (private — surface notes in envelope `rules`)
// ---------------------------------------------------------------------

function _resolveDiscountRate(bundle) {
  const v = bundle?.coi?.discountRateReal ?? bundle?.economic?.discountRateReal;
  if (typeof v === 'number' && Number.isFinite(v)) {
    return { rate: v, isDefault: false, source: 'bundle' };
  }
  return { rate: _DEFAULTS.discountRateReal, isDefault: true,
           source: 'FCA COBS 13 Annex 2 (default; O-COI-CMA-RATE-1)' };
}

function _resolveInflation(bundle) {
  const v = bundle?.economic?.inflation ?? bundle?.coi?.inflation;
  if (typeof v === 'number' && Number.isFinite(v)) {
    return { rate: v, isDefault: false, source: 'bundle' };
  }
  return { rate: _DEFAULTS.inflation, isDefault: true,
           source: 'BoE 2% CPI target (default; O-COI-INFLATION-1)' };
}

function _resolveCurrentAge(entity) {
  if (typeof entity?.age === 'number' && Number.isFinite(entity.age)) {
    return entity.age;
  }
  if (entity?.dateOfBirth) {
    const dob = new Date(entity.dateOfBirth);
    if (!Number.isNaN(dob.getTime())) {
      const today = new Date();
      let a = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) a--;
      return a;
    }
  }
  throw new Error('canonical-coi: cannot resolve current age (entity.age or entity.dateOfBirth required)');
}

function _resolveHorizon(entity, bundle) {
  const currentAge = _resolveCurrentAge(entity);
  const band = bundle?.coi?.longevityBand;
  const ages = bundle?.coi?.longevityAges;
  let longevityAge, source, isDefault;
  if (ages && typeof ages === 'object' && band && typeof ages[band] === 'number') {
    longevityAge = ages[band]; source = `bundle.coi.longevityAges.${band}`; isDefault = false;
  } else if (typeof ages?.median === 'number') {
    longevityAge = ages.median; source = 'bundle.coi.longevityAges.median'; isDefault = false;
  } else {
    longevityAge = _DEFAULTS.longevityAge;
    source = 'ONS National Life Tables 2020-22 median (default; O-COI-HORIZON-1)';
    isDefault = true;
  }
  const horizonYears = Math.max(1, longevityAge - currentAge);
  return { currentAge, longevityAge, horizonYears, source, isDefault };
}


// ---------------------------------------------------------------------
// §D — Validation
// ---------------------------------------------------------------------

function _validateActionDomain(actionDomain) {
  if (typeof actionDomain !== 'string') {
    throw new Error(`canonical-coi: actionDomain must be a string, got ${typeof actionDomain}`);
  }
  if (!_ACTION_DOMAIN_SET.has(actionDomain)) {
    throw new Error(
      `canonical-coi: actionDomain "${actionDomain}" not in canonical 12. ` +
      `Valid: ${ACTION_DOMAINS.join(', ')}`
    );
  }
}

function _validateHandlerResult(result, actionDomain) {
  if (!result || typeof result !== 'object') {
    throw new Error(`canonical-coi: handler for "${actionDomain}" returned non-object`);
  }
  const validStatuses = ['IMPLEMENTED', 'OPEN', 'NOT_APPLICABLE'];
  if (!validStatuses.includes(result.status)) {
    throw new Error(
      `canonical-coi: handler "${actionDomain}" returned invalid status "${result.status}". ` +
      `Must be one of: ${validStatuses.join(', ')}`
    );
  }
  if (result.status === 'IMPLEMENTED') {
    if (!Array.isArray(result.currentPath) || !Array.isArray(result.optimalPath)) {
      throw new Error(
        `canonical-coi: handler "${actionDomain}" status=IMPLEMENTED requires currentPath and optimalPath arrays`
      );
    }
    if (!result.action || typeof result.action !== 'object') {
      throw new Error(`canonical-coi: handler "${actionDomain}" status=IMPLEMENTED requires action object`);
    }
  }
}

// Reserved ctx keys that cannot be overridden via extras (infrastructure-owned).
const _CTX_RESERVED_KEYS = Object.freeze(['resolverNotes']);

// Resolved ctx keys; if overridden via extras, an audit note is appended.
const _CTX_RESOLVED_KEYS = Object.freeze([
  'discountRateReal', 'inflation', 'horizonYears', 'currentAge', 'longevityAge',
]);

function _validateExtras(extras) {
  if (extras === undefined || extras === null) return; // optional
  if (typeof extras !== 'object' || Array.isArray(extras)) {
    throw new Error(
      `canonical-coi: extras must be a plain object, got ${Array.isArray(extras) ? 'array' : typeof extras}`
    );
  }
  for (const k of _CTX_RESERVED_KEYS) {
    if (k in extras) {
      throw new Error(
        `canonical-coi: extras cannot override reserved ctx key "${k}" (infrastructure-owned)`
      );
    }
  }
}


// ---------------------------------------------------------------------
// §E — Default handlers (all 12 domains stubbed as OPEN)
// Each returns a structured envelope showing the domain is recognised
// but no handler logic is yet supplied. Caller overrides individual
// domains by passing a handlers map with the same keys.
// ---------------------------------------------------------------------

function _stubHandler(domain) {
  return function defaultStub(_entity, _bundle, _ctx) {
    return {
      status: 'OPEN',
      currentPath: [],
      optimalPath: [],
      action: {
        currentDescription: `[${domain}] handler not yet supplied`,
        optimalDescription: `[${domain}] handler not yet supplied`,
        outcome:            `Engine hook registered; canonical handler awaits domain implementation.`,
      },
      rules: ['MM v2.6 §0.1 — handler stub awaiting domain implementation'],
      notes: `No handler injected for "${domain}". Caller must supply via handlers map.`,
    };
  };
}

export const DEFAULT_HANDLERS = Object.freeze(
  ACTION_DOMAINS.reduce((acc, d) => { acc[d] = _stubHandler(d); return acc; }, {})
);


// ---------------------------------------------------------------------
// §F — Compose handlers (caller utility)
// Later sources override earlier (right-to-left precedence).
//   composeHandlers(DEFAULT_HANDLERS, { pensionTiming: realHandler })
//     → all 12 stubbed except pensionTiming uses realHandler
// ---------------------------------------------------------------------

export function composeHandlers(...maps) {
  const out = {};
  for (const m of maps) {
    if (!m || typeof m !== 'object') continue;
    for (const k of Object.keys(m)) {
      if (typeof m[k] === 'function') out[k] = m[k];
    }
  }
  return out;
}


// ---------------------------------------------------------------------
// §G — Build context passed to handlers
// ---------------------------------------------------------------------

function _buildCtx(entity, bundle, extras) {
  const dr = _resolveDiscountRate(bundle);
  const inf = _resolveInflation(bundle);
  const hz = _resolveHorizon(entity, bundle);
  const resolverNotes = [];
  if (dr.isDefault)  resolverNotes.push(`discountRateReal: ${dr.source}`);
  if (inf.isDefault) resolverNotes.push(`inflation: ${inf.source}`);
  if (hz.isDefault)  resolverNotes.push(`horizon: ${hz.source}`);

  const ctx = {
    discountRateReal: dr.rate,
    inflation:        inf.rate,
    horizonYears:     hz.horizonYears,
    currentAge:       hz.currentAge,
    longevityAge:     hz.longevityAge,
    resolverNotes,
  };

  // Merge extras (validated upstream by _validateExtras).
  // Override of resolved keys is permitted; an audit note is appended.
  // Reserved keys are blocked at validation time, not here.
  if (extras !== undefined && extras !== null) {
    for (const k of Object.keys(extras)) {
      if (_CTX_RESOLVED_KEYS.includes(k)) {
        const previous = ctx[k];
        ctx.resolverNotes.push(
          `[override] ${k}: extras override (was ${JSON.stringify(previous)})`
        );
      }
      ctx[k] = extras[k];
    }
  }

  return ctx;
}


// ---------------------------------------------------------------------
// §H — costOfInaction (canonical entry point)
// ---------------------------------------------------------------------

/**
 * Canonical Cost of Inaction. Per MM v2.6 §0.1.
 *
 * @param {object} entity         Person/couple entity (must include age or dateOfBirth)
 * @param {string} actionDomain   One of ACTION_DOMAINS (12 canonical)
 * @param {object} bundle         Jurisdiction bundle (e.g. UK-master-2026.1.1)
 * @param {object} handlers       Map of { domain: handler(entity, bundle, ctx) }
 *                                — typically composeHandlers(DEFAULT_HANDLERS, engineHandlers)
 * @param {object} [extras]       Optional plain object merged into ctx before
 *                                handler invocation. Used by CF engine to inject
 *                                CMA bundle (extras.cma) and override discount
 *                                rate (extras.discountRateReal). Reserved key
 *                                `resolverNotes` cannot appear in extras.
 *                                Override of resolved keys is permitted with
 *                                audit note appended to ctx.resolverNotes.
 * @returns {{amount: number, breakdown: object, rules: string[], explanation: string}}
 */
export function costOfInaction(entity, actionDomain, bundle, handlers, extras) {
  if (entity === undefined || entity === null) {
    throw new Error('canonical-coi: entity is required');
  }
  _validateActionDomain(actionDomain);
  if (!handlers || typeof handlers !== 'object') {
    throw new Error('canonical-coi: handlers map is required (use composeHandlers)');
  }
  const handler = handlers[actionDomain];
  if (typeof handler !== 'function') {
    throw new Error(`canonical-coi: no handler in map for "${actionDomain}"`);
  }
  _validateExtras(extras);

  const ctx = _buildCtx(entity, bundle, extras);
  const result = handler(entity, bundle, ctx);
  _validateHandlerResult(result, actionDomain);

  // Compute NPV delta for IMPLEMENTED domains; OPEN/NOT_APPLICABLE → 0
  let amount = 0;
  let currentNPV = 0;
  let optimalNPV = 0;
  if (result.status === 'IMPLEMENTED') {
    currentNPV = npv(ctx.discountRateReal, result.currentPath);
    optimalNPV = npv(ctx.discountRateReal, result.optimalPath);
    // CoI = max(0, optimalNPV - currentNPV)
    // Convention: paths express value from user's perspective — higher NPV is
    // better. Optimal path's NPV ≥ current path's NPV, so CoI = optimal - current.
    // Floor at 0 enforces "always ≥ 0" axiom (numerical noise tolerance).
    amount = Math.max(0, optimalNPV - currentNPV);
  }

  const explanation = (result.status === 'IMPLEMENTED')
    ? `Continuing your current path (${result.action.currentDescription}) costs ` +
      `£${Math.round(amount).toLocaleString('en-GB')} in today's money over ` +
      `${ctx.horizonYears} years at ${(ctx.discountRateReal * 100).toFixed(1)}% real discount. ` +
      `Optimal action: ${result.action.optimalDescription}. Outcome: ${result.action.outcome}.`
    : `Cost of Inaction (${actionDomain}) — ${result.status}. ${result.notes || ''}`.trim();

  const rules = [
    'MM v2.6 §0.1 (canonical CoI definition)',
    ...(result.rules || []),
    ...ctx.resolverNotes.map(n => n.startsWith('[override] ') ? n : `[default] ${n}`),
  ];

  return {
    amount,
    breakdown: {
      actionDomain,
      status: result.status,
      currentNPV,
      optimalNPV,
      delta: optimalNPV - currentNPV,
      currentPath: result.currentPath,
      optimalPath: result.optimalPath,
      action: result.action,
      ctx: {
        discountRateReal: ctx.discountRateReal,
        inflation:        ctx.inflation,
        horizonYears:     ctx.horizonYears,
        currentAge:       ctx.currentAge,
        longevityAge:     ctx.longevityAge,
        ...(extras !== undefined && extras !== null ? { extrasKeys: Object.keys(extras) } : {}),
      },
      handlerNotes: result.notes,
    },
    rules,
    explanation,
  };
}


// ---------------------------------------------------------------------
// §I — totalCoI (aggregate across 12 domains)
// MM v2.6 §0.1: "Aggregate: totalCoI(entity, bundle) sums open CoI
//                across all domains."
// ---------------------------------------------------------------------

/**
 * Sum CoI across all canonical domains.
 *
 * @param {object} entity
 * @param {object} bundle
 * @param {object} handlers   Same shape as for costOfInaction
 * @param {object} [extras]   Optional plain object passed through to each
 *                            domain's costOfInaction call (see costOfInaction
 *                            for semantics).
 * @returns {{amount: number, breakdown: object, rules: string[], explanation: string}}
 */
export function totalCoI(entity, bundle, handlers, extras) {
  // Validate extras once up-front (each per-domain costOfInaction call would
  // otherwise re-validate identical input N times).
  _validateExtras(extras);

  const perDomain = {};
  const implemented = [];
  const open = [];
  const notApplicable = [];
  let total = 0;

  for (const domain of ACTION_DOMAINS) {
    const result = costOfInaction(entity, domain, bundle, handlers, extras);
    perDomain[domain] = result;
    total += result.amount;
    const status = result.breakdown.status;
    if (status === 'IMPLEMENTED')         implemented.push(domain);
    else if (status === 'OPEN')           open.push(domain);
    else if (status === 'NOT_APPLICABLE') notApplicable.push(domain);
  }

  const explanation =
    `Total Cost of Inaction across ${implemented.length} implemented domain(s): ` +
    `£${Math.round(total).toLocaleString('en-GB')} in today's money. ` +
    (open.length > 0
      ? `${open.length} domain(s) awaiting handler implementation: ${open.join(', ')}. `
      : '') +
    (notApplicable.length > 0
      ? `${notApplicable.length} domain(s) not applicable to this entity: ${notApplicable.join(', ')}.`
      : '');

  return {
    amount: total,
    breakdown: {
      perDomain,
      domainsImplemented: implemented,
      domainsOpen: open,
      domainsNotApplicable: notApplicable,
      domainCount: ACTION_DOMAINS.length,
    },
    rules: ['MM v2.6 §0.1 (canonical CoI aggregate)'],
    explanation,
  };
}


// ---------------------------------------------------------------------
// End of canonical-coi.js · 4 exports
//   ACTION_DOMAINS  · DEFAULT_HANDLERS  · composeHandlers
//   costOfInaction(entity, actionDomain, bundle, handlers, extras?)
//   totalCoI(entity, bundle, handlers, extras?)
//
// Patched at s17b-1c-eng (Phase A · Option A · F-PHASE0-3 resolution):
// optional `extras` arg merges into ctx, enabling CF engine to inject
// CMA bundle (ctx.cma) and override discount rate (ctx.discountRateReal)
// without breaking the existing 4-arg call signature. All prior call
// sites in uk-pension/uk-estate retrofits continue to work unchanged.
// ---------------------------------------------------------------------
