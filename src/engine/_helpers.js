// ─────────────────────────────────────────────────────────────────────────────
// SONUSWEALTH / FINIO — UNIVERSAL ENGINE HELPERS  (CANONICAL)
// Schema-agnostic readers that return consistent values from EITHER persona shape:

import { getBundle } from './_bundle.js';
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
  // TO-4 fix (2026-05-28): when `sipp.pensions[]` exists (the canonical
  // per-product breakdown), derive sipp's contribution from THAT array
  // rather than reading the standalone `sipp.total` field. Personas like
  // Tony Stark carried a stale `sipp.total: 1,430,000` that didn't match
  // the array sum (£1,049,000) — a £381k phantom that fed into NW, IHT,
  // and drawdown projections. Array is single source of truth.
  if (Array.isArray(a.sipp?.pensions)) {
    for (const p of a.sipp.pensions) {
      // DB entries carry value:0 by convention; CETV is informational only.
      // Skip DB unless an explicit cetv-as-balance flag is set (none today).
      if ((p.type === 'occupational-DB' || p.type === 'Occupational DB') && (p.value == null || +p.value === 0)) continue;
      total += +(p.value ?? p.balance_gbp ?? p.balance ?? 0) || 0;
    }
  } else if (a.sipp?.total != null) {
    // Fallback: persona has only the flat total field (older fixture shape).
    total += +a.sipp.total || 0;
  }
  if (Array.isArray(a.pensions)) {
    for (const p of a.pensions) {
      if (p.type === 'occupational-DB' && p.cetv == null) continue;
      total += +(p.cetv ?? p.balance_gbp ?? p.balance ?? p.value ?? 0) || 0;
      // Phase C: include pending Pension Sharing Order incoming transfers. The
      // mrT-divorced fixture stores £180k pending in `pso_incoming_pending`
      // because it's flagged as in-transit (not yet on the SIPP statement) but
      // legally belongs to this individual — it WILL land within months. The
      // engine's NW walker previously skipped this, causing a £180k miss vs
      // the fixture's own stated NW range. See FP-4 (PSO timing) in null_coverage.
      total += +(p.pso_incoming_pending ?? 0) || 0;
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
  const invArr = Array.isArray(a.investments) ? a.investments : [];
  // Detect whether the canonical nested array already carries ISA / GIA holdings,
  // so we do NOT also add the legacy scalar shape (double-count). Mr T stores ISA
  // + GIA in BOTH a.investments[] AND the a.isa / a.portfolio scalars; the old code
  // summed both, inflating netWorth by £71.4k (ISA £46.6k + GIA £24.8k counted
  // twice). Mirrors foldLegacyInvestments' guard in InvestmentsDrillDown so the
  // engine, the drill, and the tile all agree. (Audit 2026-06-01.)
  const invHasISA = invArr.some(i => /isa/i.test(String(i.type ?? i.wrapper ?? '')));
  const invHasGIA = invArr.some(i => /\bgia\b|general/i.test(String(i.type ?? i.wrapper ?? '')));
  // legacy scalars — only when the nested array doesn't already cover them
  if (!invHasISA) {
    if (a.isa?.value != null)           total += +a.isa.value || 0;
    else if (typeof a.isa === 'number') total += +a.isa       || 0;
  }
  if (!invHasGIA && a.portfolio?.value != null) total += +a.portfolio.value || 0;
  // nested
  for (const inv of invArr) {
    total += +(inv.balance_gbp ?? inv.balance ?? inv.estimated_value ?? inv.value ?? 0) || 0;
  }
  // B7 fix (2026-06-01): persona-c (Tony Stark) stores GIA accounts in a.gia[],
  // tax-efficient investments in a.taxEfficientInvestments[], and onshore/offshore
  // bonds in a.investmentBonds[]. None are inside a.investments[] so they were
  // silently omitted from netWorth(). Add all three read-paths here.
  if (Array.isArray(a.gia)) {
    for (const x of a.gia) {
      total += +(x.value ?? x.balance_gbp ?? x.balance ?? 0) || 0;
    }
  }
  if (Array.isArray(a.taxEfficientInvestments)) {
    for (const x of a.taxEfficientInvestments) {
      total += +(x.value ?? x.balance_gbp ?? x.balance ?? 0) || 0;
    }
  }
  if (Array.isArray(a.investmentBonds)) {
    for (const x of a.investmentBonds) {
      total += +(x.value ?? x.balance_gbp ?? x.balance ?? 0) || 0;
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
 * Total alternatives value (crypto, gold, P2P, art, wine, private equity, etc).
 * CANONICAL — added 2026-05-28 to close TO-1 (B-track tie-out finding).
 *
 * Background: engine `netWorth()` previously omitted alternatives entirely.
 * Display walker at `MyMoney.jsx:3199 heroTotalAssets` had always included them,
 * so personas holding alternatives (Tony Stark £315k, Mr T £28k) saw an
 * arithmetically broken hero strip — NW ≠ Assets − Liabilities. Also rippled
 * to `calcFQ`, `fundedRatio`, `investable`-adjacent metrics.
 *
 * Note: alternatives are deliberately NOT added to `investable()` — they are
 * typically illiquid (gold bars, art, crypto with custody risk, P2P locked).
 * @param {object} entity
 * @returns {number}
 */
export function alternativesTotal(entity) {
  const a = entity?.assets || {};
  // Mirror rowsForAlternatives (screens/MyMoney.jsx): alt holdings live at BOTH
  // top-level `entity.alternatives[]` (Mr T's wine) and nested `assets.alternatives[]`
  // (persona-c's crypto/gold). Merge and de-dupe by id (then name) so a persona
  // populating either — or both — is counted exactly once. Before this fix the
  // selector read ONLY the nested array, so Mr T's £8.4k wine was dropped from
  // netWorth() while the Alternatives tile counted it (sum-of-tiles £1.156m vs
  // hero Assets £1.13m — the residual §9.5 Σtiles=Assets gap). No persona currently
  // populates both shapes, so this changes only mrT-core. (2026-06-01.)
  const seen = new Set();
  let total = 0;
  for (const alt of [
    ...(Array.isArray(entity?.alternatives) ? entity.alternatives : []),
    ...(Array.isArray(a.alternatives) ? a.alternatives : []),
  ]) {
    const key = alt?.id ?? alt?.name ?? JSON.stringify(alt);
    if (seen.has(key)) continue;
    seen.add(key);
    if (alt?.status === 'disposed') continue;
    const raw  = +(alt.value_gbp ?? alt.value ?? alt.estimated_value ?? 0) || 0;
    const frac = +(alt.beneficial_interest_this_individual ?? alt.ownershipShare ?? 1) || 1;
    total += raw * frac;
  }
  return total;
}

/**
 * Total private-business equity.
 * CANONICAL. TO-7 (L2-4, 2026-05-28). Surfaced by the dynamic-onboarding
 * contract test — `assets.businesses[]` was previously ignored by the
 * engine even though onboarding-shape entities populate it. Walks the
 * array, applies ownership share where present, skips disposed entries.
 *
 * Note: BPR-qualifying tradeable investments (AIM, EIS, SEIS) live inside
 * `assets.investments[]` with a `bpr_qualifying: true` flag and stay there
 * — they are NOT included here, to avoid double-counting.
 *
 * @param {object} entity
 * @returns {number}
 */
export function businessTotal(entity) {
  const a = entity?.assets || {};
  // Read the SAME source the hero strip uses (screens/MyMoney.jsx _heroBaseAssets):
  // prefer the top-level `entity.business_assets[]` (the shape Mr T + the Business
  // CategoryTile/rowsForBPR use), else fall back to `assets.businesses[]` (the
  // onboarding shape) — never both, so personas populating either are counted once.
  // Before this fix the engine read ONLY `assets.businesses[]`, so Mr T's £145k
  // Synthetic Tech stake (stored top-level) was dropped from netWorth() — the hero
  // counted it (Assets £1.20m) while engine NW omitted it (£698k), so the strip
  // failed the §9.5 tie-out (Assets − Liab ≠ NW). (2026-06-01.)
  const list = (Array.isArray(entity?.business_assets) && entity.business_assets.length)
    ? entity.business_assets
    : (a.businesses || a.business_assets || a.businessAssets || a.business || []);
  let total = 0;
  if (Array.isArray(list)) {
    for (const b of list) {
      if (b?.status === 'disposed') continue;
      const raw  = +(b.value_gbp ?? b.value ?? b.estimated_value ?? 0) || 0;
      const frac = +(b.beneficial_interest_this_individual ?? b.ownershipShare ?? 1) || 1;
      total += raw * frac;
    }
  }
  // Director's-loan account in credit (director has lent money TO the company) is a
  // receivable — an asset of the individual. The Business tile counts it via
  // rowsForDirector (screens/MyMoney.jsx — Mr T's £18.5k → tile shows £163k), but the
  // engine omitted it, so netWorth() ran £18.5k light of the tile. Add it when in
  // credit so engine = tile = hero. (Only mrT-core carries a DLA.) (2026-06-01.)
  const dla = entity?.directors_loan;
  if (dla && dla.in_credit && +dla.balance) total += +dla.balance;
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
  // Phase C UX pass 3 — F1 cascade fix: previous version summed BOTH the
  // legacy `assets.cash.total` AND the nested `assets.bank[]` array. For
  // mrT-core (mixed schema fixture) this double-counted: a single £29k
  // cash position was reported as £57k, then propagated to CASH tile's
  // "interest tax" CoW via marginalRate-driven calc → £712/yr (real ~£61).
  //
  // Fix: choose the more detailed schema. If bank[] is populated, it is
  // authoritative (per-account detail); else fall back to the aggregated
  // legacy cash.total / cash.own scalar.
  const a = entity?.assets || {};
  if (Array.isArray(a.bank) && a.bank.length > 0) {
    return a.bank.reduce((s, b) => s + (+(b.balance_gbp ?? b.balance ?? 0) || 0), 0);
  }
  if (a.cash?.total != null) return +a.cash.total || 0;
  if (a.cash?.own != null)   return +a.cash.own   || 0;
  return 0;
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
  // B5 fix (2026-06-01): property mortgages stored on asset.property[].mortgage_outstanding
  // were never counted in the engine liabilities total. Persona-c carries £700k across two
  // BTL properties. Assets are gross (pre-mortgage) values so adding mortgage debt here is
  // correct — no double-subtraction.
  const a = entity?.assets || {};
  const propMortgages = Array.isArray(a.property)
    ? a.property.reduce((s, p) => {
        if (p['$ref'] || p.status === 'disposed') return s;
        return s + +(p.mortgage_outstanding ?? p.mortgage_balance ?? 0);
      }, 0)
    : 0;
  return m + o + propMortgages;
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
  // Phase C UX pass 3 — F1 root cause fix: previous version DOUBLE-SUMMED
  // salary across `individual.gross_salary` and `income.employment` (same
  // underlying figure in two schemas), and added `inc.rental` PLUS
  // `inc.rentalIncome` (alias pair). For Mr T this inflated annual income
  // from £42k → £78k, flipping the persona to higher-rate band and
  // poisoning EVERY marginal-rate-driven Cost-of-Waiting tile downstream.
  //
  // Fix: take MAX of equivalent fields, not SUM.
  const ind = entity?.individual;
  const inc = entity?.income || {};

  // Salary: nested individual.gross_salary OR legacy income.employment / income.salary.
  // Use MAX — they are the same underlying figure expressed in different schemas.
  const salary = Math.max(
    +(ind?.gross_salary || 0),
    +(inc.employment || 0),
    +(inc.salary || 0),
  );

  // Rental: inc.rental and inc.rentalIncome are aliases. MAX, not SUM.
  const rental = Math.max(+(inc.rental || 0), +(inc.rentalIncome || 0));

  // Other income streams ADD (genuinely distinct sources).
  const dividends      = +(inc.dividends || 0);
  const overseasIncome = +(inc.overseasIncome || 0);
  const selfEmployed   = +(inc.selfEmployed || 0);
  const other          = +(inc.other || 0);
  const drawdown       = +entity?.drawdown || 0;

  return salary + dividends + rental + overseasIncome + selfEmployed + other + drawdown;
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
  const TAX_JSON = getBundle();
  const full = TAX_JSON.nationalInsurance?.stateNewPensionFullAmount
            ?? TAX_JSON.pension?.statePensionFullAmount
            ?? 12547.60;
  const yrs  = TAX_JSON.nationalInsurance?.statePensionQualifyingYears
            ?? TAX_JSON.pension?.statePensionQualifyingYears
            ?? 35;
  if (accrued != null) {
    return Math.round((accrued / yrs) * full);
  }
  return 0;
}

// ── HOUSEHOLD STATUS READER — Phase C engine couple-reader fix ──────────────
// Returns true if persona is in a couple. Reads any of: `isCouple` flag (Bruce
// schema), nested `partner: {...}` object (mrT-* fixtures), nested
// `spouse: {...}`, or explicit `household_status === 'couple'`. Was previously
// only checking `entity.isCouple` — caused 36 cells of mrT couple fixtures
// to silently lose spousal NRB transfer (engine returned NRB=£325k not £650k).
export function isCouple(entity) {
  if (!entity) return false;
  if (entity.isCouple === true) return true;
  if (entity.household_status === 'couple') return true;
  if (entity.individual?.marital_status === 'married' || entity.individual?.marital_status === 'civil-partnership') return true;
  // Partner / spouse object MUST have at least one identifying field to count
  // (otherwise an empty placeholder `partner: {}` would trigger false positives).
  const p = entity.partner || entity.spouse;
  if (p && typeof p === 'object' && (p.id || p.name || p.dob || p.age || p.marital_status)) return true;
  return false;
}

// ── EXPENSE READERS — Phase C BLOCK-1 fix ───────────────────────────────────
// Canonical reader for monthly essential spend across all persona shapes.
// Previously the lookup chain ignored `entity.monthlyExpenditure` (which is
// where persona-a..g store it) and fell through to 55% × annualIncome — a
// fallback so wrong it produced the visible bugs the founder kept flagging:
//   * MyMoney TIME_COVERED = 150.3 yr (real ~32-46 yr)
//   * MyMoney INCOME_BUFFER = 52.4× (real ~0.27-1×)
//   * CASH tile "6.9 yr essentials covered" (vs same screen's "22 months")
//
// Lookup order (most explicit → least):
//   1. expenses.essential_monthly  (mrT-* engine-test schema)
//   2. expenses.essential_annual / 12  (canonical-metrics expected this)
//   3. expenses.monthly  (alternative field on some fixtures)
//   4. monthlyExpenditure  (persona-a..g shape — PRIMARY for live UI)
//   5. monthly_expenditure / monthly_essential (snake_case variants)
//   6. annualIncome × 0.55 / 12  (fallback ONLY — never first choice)
//
// Returns { monthly, annual, source, isEstimate } so callers can flag estimates.
export function getMonthlyEssentials(entity) {
  if (!entity) return { monthly: 0, annual: 0, source: 'none', isEstimate: true };
  const e = entity.expenses || {};
  // 1
  if (+e.essential_monthly > 0) {
    const m = +e.essential_monthly;
    return { monthly: m, annual: m * 12, source: 'expenses.essential_monthly', isEstimate: false };
  }
  // 2
  if (+e.essential_annual > 0) {
    const a = +e.essential_annual;
    return { monthly: a / 12, annual: a, source: 'expenses.essential_annual', isEstimate: false };
  }
  // 3
  if (+e.monthly > 0) {
    const m = +e.monthly;
    return { monthly: m, annual: m * 12, source: 'expenses.monthly', isEstimate: false };
  }
  // 4 — persona-a..g shape (CRITICAL — this was the missed lookup)
  if (+entity.monthlyExpenditure > 0) {
    const m = +entity.monthlyExpenditure;
    return { monthly: m, annual: m * 12, source: 'entity.monthlyExpenditure', isEstimate: false };
  }
  // 5 — snake_case variants seen in some fixtures
  if (+entity.monthly_expenditure > 0) {
    const m = +entity.monthly_expenditure;
    return { monthly: m, annual: m * 12, source: 'entity.monthly_expenditure', isEstimate: false };
  }
  if (+entity.monthly_essential > 0) {
    const m = +entity.monthly_essential;
    return { monthly: m, annual: m * 12, source: 'entity.monthly_essential', isEstimate: false };
  }
  // 6 — fallback (label as estimate so UI can show "est." badge)
  // Import-free fallback: caller can pass annualIncome via a wrapper if needed.
  // Default to ZERO here rather than guessing — callers that need a fallback
  // should explicitly pass it. Returning 0 makes the "estimate" branch visible.
  return { monthly: 0, annual: 0, source: 'none', isEstimate: true };
}

/**
 * Convenience: annualised version.
 */
export function getAnnualEssentials(entity) {
  return getMonthlyEssentials(entity).annual;
}

// ── §X — runwayWithDrawdown (NEW v0.3 — MASTER-SPEC §3.1) ──────────────────
/**
 * Months of essential expenses covered by cash PLUS planned drawdown over
 * the horizon. Closes IFA face-fall #1 from v0.2 critique: Bruce's runway
 * previously read cash÷essentials = deficit, ignoring his £96k/yr planned
 * drawdown. Spec: route-3-cashflow.md §6 + A3 + §8 (shared bullet).
 *
 * Behaviour:
 *   · Decum personas (life-stage ≥ 4 OR flexibleDrawdownTriggered flag) →
 *     plannedDrawdownOverHorizon = entity.drawdownSchedule[year] summed over
 *     horizonMonths (best-effort: scalar fallback uses annualDrawdown × frac).
 *   · Accumulation personas → plannedDrawdownOverHorizon = 0; reduces to cash
 *     ÷ essentials (legacy R3 v0.1 behaviour).
 *   · essentials = getMonthlyEssentials(entity); if 0/estimated, returns
 *     Infinity-safe 0-months result so UI can render empty state.
 *
 * @param {object} entity
 * @param {number} [horizonMonths=12]
 * @returns {{ months:number, cash:number, plannedDrawdownOverHorizon:number, essentialsMonthly:number, isDecum:boolean }}
 */
export function runwayWithDrawdown(entity, horizonMonths = 12) {
  const cash = cashTotal(entity);
  const ess = getMonthlyEssentials(entity);
  const essentialsMonthly = ess.monthly || 0;

  // Decum detection — life-stage ≥ 4 OR MPAA / FAD trigger flags.
  const lifeStage = +(entity?.lifeStage ?? entity?.individual?.lifeStage ?? entity?.individual?.life_stage ?? 0);
  const fadFlag = !!(
    entity?.flexibleDrawdownTriggered === true ||
    entity?.individual?.flexibleDrawdownTriggered === true ||
    entity?.pension?.mpaaActive === true
  );
  const isDecum = lifeStage >= 4 || fadFlag;

  // Planned drawdown over horizon — best-effort across persona shapes.
  let plannedDrawdownOverHorizon = 0;
  if (isDecum) {
    const sched = entity?.drawdownSchedule;
    if (Array.isArray(sched) && sched.length > 0) {
      // Schedule shape: array of yearly amounts [yr0, yr1, …]. Sum the
      // fractional years that fall inside the horizon.
      const horizonYears = horizonMonths / 12;
      const wholeYears = Math.floor(horizonYears);
      const frac = horizonYears - wholeYears;
      for (let i = 0; i < wholeYears && i < sched.length; i++) {
        plannedDrawdownOverHorizon += +sched[i] || 0;
      }
      if (frac > 0 && wholeYears < sched.length) {
        plannedDrawdownOverHorizon += (+sched[wholeYears] || 0) * frac;
      }
    } else if (typeof sched === 'object' && sched != null) {
      // Object shape keyed by year offset — sum the in-horizon entries.
      const horizonYears = horizonMonths / 12;
      for (const [k, v] of Object.entries(sched)) {
        const yr = +k;
        if (Number.isFinite(yr) && yr < horizonYears) {
          plannedDrawdownOverHorizon += +v || 0;
        }
      }
    } else {
      // Scalar fallback: entity.drawdown is the annual rate.
      const annualDrawdown = +entity?.drawdown || 0;
      plannedDrawdownOverHorizon = annualDrawdown * (horizonMonths / 12);
    }
  }

  if (essentialsMonthly <= 0) {
    return {
      months: 0,
      cash,
      plannedDrawdownOverHorizon: Math.round(plannedDrawdownOverHorizon),
      essentialsMonthly: 0,
      isDecum,
    };
  }

  const months = (cash + plannedDrawdownOverHorizon) / essentialsMonthly;
  return {
    months: Math.round(months * 10) / 10,
    cash: Math.round(cash),
    plannedDrawdownOverHorizon: Math.round(plannedDrawdownOverHorizon),
    essentialsMonthly: Math.round(essentialsMonthly),
    isDecum,
  };
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
