// ─────────────────────────────────────────────────────────────────────────────
// CAELIXA / FINIO — UNIVERSAL ENGINE HELPERS  (CANONICAL)
// Schema-agnostic readers that return consistent values from EITHER persona shape:

import TAX_JSON from '../rules/tax-2026.json'
//
//   LEGACY FLAT (persona-a..g.json):
//     entity.assets.sipp.total, .isa.value, .residence.value, .portfolio.value,
//     .cash.total / .cash.own,  liabilities = { mortgage:{outstanding,...}, otherLoans:[]}
//
//   NEW NESTED  (mrT-*.json):
//     entity.assets.pensions[]{balance|balance_gbp|value, type, cetv?, last_valuation_date},
//     .investments[]{balance|balance_gbp|value, type, verified_by_user?, last_valuation_date},
//     .property[]{value|value_gbp, beneficial_interest_this_individual?, status?, '$ref'?},
//     .bank[]{balance|balance_gbp|interest_rate?},
//     liabilities = [{outstanding_balance|outstanding_balance_gbp, type, monthly_payment?}]
//
// Pure functions only. No throw — every reader returns numeric defaults.
// Spec: arch master §13.1 schema reconciliation; foundation v1.8 §3.4.
// ─────────────────────────────────────────────────────────────────────────────

/** @typedef {('legacy'|'nested'|'mixed'|'unknown')} SchemaKind */

/**
 * Detects which persona schema is in use.
 * CANONICAL
 * @param {object} entity
 * @returns {SchemaKind}
 */
export function detectSchema(entity) {
  if (!entity || !entity.assets) return 'unknown';
  const a = entity.assets;
  const hasFlat   = !!(a.sipp || a.isa || a.residence || a.portfolio || a.cash);
  const hasNested = Array.isArray(a.pensions) || Array.isArray(a.investments) ||
                    Array.isArray(a.property) || Array.isArray(a.bank);
  if (hasFlat && hasNested) return 'mixed';
  if (hasFlat)   return 'legacy';
  if (hasNested) return 'nested';
  return 'unknown';
}

// ── ASSET READERS (return scalar GBP totals) ────────────────────────────────

/**
 * Total pension/SIPP value across BOTH schemas.
 * Excludes occupational-DB pensions whose CETV is null (per FP-4 rule).
 * CANONICAL
 * @param {object} entity
 * @returns {number}
 */
export function pensionTotal(entity) {
  const a = entity?.assets || {};
  let total = 0;
  if (a.sipp?.total != null) total += +a.sipp.total || 0;
  if (Array.isArray(a.pensions)) {
    for (const p of a.pensions) {
      if (p.type === 'occupational-DB' && p.cetv == null) continue;
      total += +(p.cetv ?? p.balance_gbp ?? p.balance ?? p.value ?? 0) || 0;
    }
  }
  return total;
}

/**
 * Total ISA / general investment value across both schemas.
 * Includes legacy isa+portfolio AND nested investments[].
 * CANONICAL
 * @param {object} entity
 * @returns {number}
 */
export function investmentsTotal(entity) {
  const a = entity?.assets || {};
  let total = 0;
  // legacy
  if (a.isa?.value != null)       total += +a.isa.value       || 0;
  if (typeof a.isa === 'number')  total += +a.isa             || 0;
  if (a.portfolio?.value != null) total += +a.portfolio.value || 0;
  // nested
  if (Array.isArray(a.investments)) {
    for (const inv of a.investments) {
      total += +(inv.balance_gbp ?? inv.balance ?? inv.estimated_value ?? inv.value ?? 0) || 0;
    }
  }
  return total;
}

/**
 * ISA-only value (wrapper-specific). Both schemas.
 * CANONICAL
 * @param {object} entity
 * @returns {number}
 */
export function isaTotal(entity) {
  const a = entity?.assets || {};
  let total = 0;
  if (a.isa?.value != null)      total += +a.isa.value || 0;
  if (typeof a.isa === 'number') total += +a.isa       || 0;
  if (Array.isArray(a.investments)) {
    for (const inv of a.investments) {
      const t = (inv.type || '').toLowerCase();
      if (t.includes('isa')) total += +(inv.balance_gbp ?? inv.balance ?? inv.value ?? 0) || 0;
    }
  }
  return total;
}

/**
 * GIA-only value. Both schemas.
 * CANONICAL
 * @param {object} entity
 * @returns {number}
 */
export function giaTotal(entity) {
  const a = entity?.assets || {};
  let total = 0;
  if (a.portfolio?.value != null) total += +a.portfolio.value || 0;
  if (Array.isArray(a.investments)) {
    for (const inv of a.investments) {
      const t = (inv.type || '').toLowerCase();
      if (t === 'gia' || t.includes('general-investment')) {
        total += +(inv.balance_gbp ?? inv.balance ?? inv.value ?? 0) || 0;
      }
    }
  }
  return total;
}

/**
 * Total residential / property value.
 * CANONICAL
 * @param {object} entity
 * @returns {number}
 */
export function propertyTotal(entity) {
  const a = entity?.assets || {};
  let total = 0;
  if (a.residence?.value != null) {
    total += (+a.residence.value || 0) * (+a.residence.ownershipShare || 1);
  }
  if (Array.isArray(a.property)) {
    for (const p of a.property) {
      if (p['$ref'] || p.status === 'disposed') continue;
      const raw  = +(p.value_gbp ?? p.value ?? 0) || 0;
      const frac = +(p.beneficial_interest_this_individual ?? 1) || 1;
      total += raw * frac;
    }
  }
  if (entity?.rental_portfolio?.properties) {
    for (const p of entity.rental_portfolio.properties) {
      if (p.status === 'disposed') continue;
      total += +(p.value_gbp ?? p.value ?? p.estimated_value ?? 0) || 0;
    }
  }
  return total;
}

/**
 * Total cash across both schemas (current + savings + cash-ISA flagged separately).
 * CANONICAL
 * @param {object} entity
 * @returns {number}
 */
export function cashTotal(entity) {
  const a = entity?.assets || {};
  let total = 0;
  if (a.cash?.total != null) total += +a.cash.total || 0;
  else if (a.cash?.own != null) total += +a.cash.own || 0;
  if (Array.isArray(a.bank)) {
    for (const b of a.bank) {
      total += +(b.balance_gbp ?? b.balance ?? 0) || 0;
    }
  }
  return total;
}

/**
 * Total liabilities (debt). Both schemas.
 * CANONICAL
 * @param {object} entity
 * @returns {number}
 */
export function liabilitiesTotal(entity) {
  const l = entity?.liabilities;
  if (!l) return 0;
  if (Array.isArray(l)) {
    return l.reduce((s, x) =>
      s + (+(x.outstanding_balance_gbp ?? x.outstanding_balance ?? x.balance ?? 0) || 0), 0);
  }
  // legacy object shape
  const m = (+(l.mortgage?.outstanding) || 0);
  const o = (l.otherLoans || []).reduce((s, x) => s + (+x.outstanding || 0), 0);
  return m + o;
}

/**
 * Sum of monthly debt-service payments (mortgage + other loans + cards minimums).
 * CANONICAL
 * @param {object} entity
 * @returns {number}
 */
export function monthlyDebtService(entity) {
  const l = entity?.liabilities;
  if (!l) return 0;
  if (Array.isArray(l)) {
    return l.reduce((s, x) =>
      s + (+(x.monthly_payment ?? x.repayment_from_salary_monthly ?? x.min_payment_monthly ?? 0) || 0), 0);
  }
  const m = +(l.mortgage?.monthlyPayment) || 0;
  const o = (l.otherLoans || []).reduce((s, x) => s + (+x.monthlyPayment || 0), 0);
  return m + o;
}

// ── INCOME / DEMOGRAPHIC READERS ────────────────────────────────────────────

/**
 * Annual gross income across both schemas.
 * CANONICAL
 * @param {object} entity
 * @returns {number}
 */
export function annualIncome(entity) {
  // nested: individual.gross_salary
  const ind = entity?.individual;
  let total = 0;
  if (ind?.gross_salary != null) total += +ind.gross_salary || 0;
  // legacy: income.{employment, dividends, rentalIncome, overseasIncome}
  const inc = entity?.income;
  if (inc && !Array.isArray(inc)) {
    total += (+inc.employment || 0) + (+inc.dividends || 0) +
             (+inc.rentalIncome || 0) + (+inc.overseasIncome || 0) +
             (+inc.salary || 0) + (+inc.selfEmployed || 0) + (+inc.rental || 0) + (+inc.other || 0);
  }
  total += +entity?.drawdown || 0;
  return total;
}

/**
 * Persona age from either entity.age or individual.dob.
 * CANONICAL
 * @param {object} entity
 * @returns {number}
 */
export function personAge(entity) {
  if (entity?.age != null) return +entity.age || 0;
  const dob = entity?.individual?.dob;
  if (!dob) return 0;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 86400000));
}

/**
 * Target / essential annual expense.
 * CANONICAL
 * @param {object} entity
 * @returns {number}
 */
export function targetIncome(entity) {
  if (entity?.targetIncome != null) return +entity.targetIncome || 0;
  // Fallback: 60% of gross salary as essential expense for accumulators
  const inc = annualIncome(entity);
  return inc > 0 ? Math.round(inc * 0.6) : 30000;
}

/**
 * State-pension annual amount (best estimate).
 * CANONICAL
 * @param {object} entity
 * @returns {number}
 */
export function statePensionAnnual(entity) {
  if (entity?.income?.statePension?.annual != null) return +entity.income.statePension.annual || 0;
  const accrued = entity?.individual?.state_pension_accrued_years;
  const full = TAX_JSON.nationalInsurance?.stateNewPensionFullAmount
            ?? TAX_JSON.pension?.statePensionFullAmount
            ?? 11502;
  const yrs  = TAX_JSON.nationalInsurance?.statePensionQualifyingYears
            ?? TAX_JSON.pension?.statePensionQualifyingYears
            ?? 35;
  if (accrued != null) {
    return Math.round((accrued / yrs) * full);
  }
  return 0;
}

// ── PROTECTION READERS ──────────────────────────────────────────────────────

/**
 * Normalises protection across both schemas → flat object.
 * CANONICAL
 * @param {object} entity
 * @returns {{life:object, ip:object, cic:object, rlp:object}}
 */
export function protectionFlat(entity) {
  const out = {
    life: { exists: false, amount: 0, inTrust: false, premium: 0 },
    ip:   { exists: false, monthlyBenefit: 0, premium: 0 },
    cic:  { exists: false, amount: 0, premium: 0 },
    rlp:  { exists: false, amount: 0 },
  };
  // legacy
  const lp = entity?.assets?.protection;
  if (lp) {
    if (lp.lifeInsurance?.exists) {
      out.life = {
        exists: true,
        amount: +lp.lifeInsurance.amount || 0,
        inTrust: !!lp.lifeInsurance.inTrust,
        premium: +lp.lifeInsurance.premium || 0,
      };
    }
    if (lp.incomeProtection?.exists) {
      out.ip = {
        exists: true,
        monthlyBenefit: +lp.incomeProtection.monthlyBenefit || 0,
        premium: +lp.incomeProtection.premium || 0,
      };
    }
    if (lp.criticalIllness?.exists) {
      out.cic = {
        exists: true,
        amount: +lp.criticalIllness.amount || 0,
        premium: +lp.criticalIllness.premium || 0,
      };
    }
    if (lp.relevantLifePlan?.exists) {
      out.rlp = { exists: true, amount: +lp.relevantLifePlan.amount || 0 };
    }
  }
  // nested: array
  if (Array.isArray(entity?.protection)) {
    for (const p of entity.protection) {
      const t = (p.type || '').toLowerCase();
      if (t.includes('life-insurance')) {
        out.life = {
          exists: true,
          amount: +(p.cover_amount ?? p.amount ?? 0) || 0,
          inTrust: p.trust_status === 'in-trust' || p.trust_status === 'verified',
          premium: +(p.premium_monthly ?? p.premium ?? 0) || 0,
        };
      } else if (t.includes('income-protection')) {
        out.ip = {
          exists: true,
          monthlyBenefit: Math.round(((p.cover_pct_of_salary || 0) * (entity?.individual?.gross_salary || 0)) / 12),
          premium: +(p.premium_monthly ?? p.premium ?? 0) || 0,
        };
      } else if (t.includes('critical') || t.includes('cic')) {
        out.cic = {
          exists: true,
          amount: +(p.cover_amount ?? p.amount ?? 0) || 0,
          premium: +(p.premium_monthly ?? p.premium ?? 0) || 0,
        };
      } else if (t.includes('relevant-life')) {
        out.rlp = { exists: true, amount: +(p.cover_amount ?? p.amount ?? 0) || 0 };
      }
    }
  }
  return out;
}

// ── FLAGS / RULES ───────────────────────────────────────────────────────────

/**
 * Tests if a persona-flag is set. Looks at entity.flags[] OR top-level booleans.
 * CANONICAL
 * @param {object} entity
 * @param {string} flag
 * @returns {boolean}
 */
export function hasPersonaFlag(entity, flag) {
  if (!entity || !flag) return false;
  if (Array.isArray(entity.flags)) return entity.flags.includes(flag);
  if (entity.flags && typeof entity.flags === 'object') return !!entity.flags[flag];
  // Convention: also test top-level boolean of the same name
  if (typeof entity[flag] === 'boolean') return entity[flag];
  return false;
}

/**
 * Get domicile / jurisdiction from either schema.
 * CANONICAL
 * @param {object} entity
 * @returns {{primary:string, secondary?:string|null, domicile?:string, deemedDomicile?:boolean}}
 */
export function jurisdictionOf(entity) {
  if (entity?.jurisdiction) {
    return {
      primary:        entity.jurisdiction.primary || 'UK',
      secondary:      entity.jurisdiction.secondary ?? null,
      domicile:       entity.jurisdiction.domicile ?? entity.jurisdiction.primary,
      deemedDomicile: !!entity.jurisdiction.deemed_domicile,
    };
  }
  if (entity?.jurisdictionContext) {
    return {
      primary:        entity.jurisdictionContext.primary || 'UK-2026.1',
      secondary:      entity.jurisdictionContext.secondary ?? null,
    };
  }
  return { primary: 'UK', secondary: null };
}

/**
 * Wrapper-type classifier for a single asset row.
 * Returns one of: PENSION, ISA, GIA, BOND_ON, BOND_OFF, EIS, SEIS, VCT, TRUST, CASH, PROPERTY, STATE, UNKNOWN.
 *
 * Returns 'UNKNOWN' when the asset's type can't be resolved — spec §2.1
 * (D-WRAPPER-FIRST-1): "If getWrapper() cannot resolve → card renders with
 * confidence band indicator FP-4, grey badge 'WRAPPER?', and prompt: 'We need
 * more information to calculate tax treatment.' Do NOT default silently to GIA."
 * CANONICAL
 * @param {object} asset
 * @returns {string}
 */
export function getWrapper(asset) {
  if (!asset) return 'UNKNOWN';
  const t = String(asset.type || asset.wrapperType || '').toLowerCase();
  if (!t) return 'UNKNOWN';
  if (t.includes('sipp') || t.includes('ssas') || t.includes('pension')) return 'PENSION';
  if (t.includes('occupational') || t.includes('-db') || t === 'db' ||
      t.includes('workplace dc') || t.includes('workplace-dc') ||
      t.includes('final-salary') || t.includes('career-average') ||
      t === 'gpp' || t === 'rac' || t === 'qrops' || t === 'qnups' ||
      t.includes('master-trust') || t.includes('stakeholder')) return 'PENSION';
  if (t.includes('state-pension')) return 'STATE';
  if (t === 'cash-isa' || t.includes('isa')) return 'ISA';
  if (t === 'gia' || t.includes('general-investment')) return 'GIA';
  if (t === 'onshore-bond' || t === 'bond-on' || t === 'bond_on' || t.includes('investment-bond-onshore')) return 'BOND_ON';
  if (t === 'offshore-bond' || t === 'bond-off' || t === 'bond_off' || t.includes('investment-bond-offshore')) return 'BOND_OFF';
  if (t === 'eis')  return 'EIS';
  if (t === 'seis') return 'SEIS';
  if (t === 'vct')  return 'VCT';
  if (t.includes('trust')) return 'TRUST';
  if (t.includes('cash') || t.includes('savings') || t.includes('current-account') || t.includes('bank')) return 'CASH';
  if (t.includes('residence') || t.includes('property') || t.includes('btl')) return 'PROPERTY';
  // Alternatives held personally have GIA-like tax treatment (CGT on disposal,
  // in estate at full value). They are domain-tagged as ALT but live in the
  // GIA wrapper bucket for tax purposes. This is an explicit map, not a
  // silent fallback.
  if (t === 'crypto' || t.includes('crypto') ||
      t === 'private-equity' || t.includes('private-equity') ||
      t === 'p2p' || t.includes('peer-to-peer') ||
      t === 'commodity' || t.includes('commodit')) return 'GIA';
  return 'UNKNOWN';
}
