// ─────────────────────────────────────────────────────────────────────────────
// SONUSWEALTH / FINIO — PERSONA HELPERS  (pure, no UI, no copy)
//
// Engine helpers added 2026-05-26 to close IFA + Tax audit gaps:
//   · effectiveAA(entity)         — standard / MPAA / tapered AA resolution
//   · holdingClock(asset)         — EIS / SEIS / VCT minimum-holding-period
//   · cohabIHTCliff(entity)       — IHT exposure cohabitees lose vs married
//   · transferableNRB(entity)     — combined spousal NRB + RNRB shelter
//   · statePensionForecast(entity)— qualifying-years pro-rata forecast
//
// All functions are pure, return numeric or structured data only, never throw,
// never produce advice copy. Wrap callers may add narration upstream.
//
// Audits closed by this file:
//   · IFA HIGH-14 (MPAA / tapered AA invisible on MyMoney)
//   · IFA HIGH-15 (EIS/SEIS/VCT clawback risk unsurfaced)
//   · IFA HIGH-16 (Cohabitee IHT cliff invisible)
//   · IFA HIGH-17 (Transferable spousal allowances not surfaced)
//   · Tax MED-08  (State pension forecast missing qualifying-year context)
// ─────────────────────────────────────────────────────────────────────────────

import { TAX } from './_bundle.js';

// ── §1 effectiveAA ──────────────────────────────────────────────────────────
/**
 * Resolve the effective annual allowance for pension contributions.
 *
 * Resolution order (HMRC PTM057100 / PTM056510):
 *   1. MPAA — if flexible drawdown triggered, hard cap = £10,000 (MPAA).
 *   2. Tapered AA — if adjusted income > £260,000, reduce £1 of AA per £2 of
 *      excess, floor £10,000.
 *   3. Standard AA — £60,000 (default).
 *
 * @param {object} entity
 * @returns {{ aa:number, reason:('standard'|'mpaa'|'tapered'), mpaaActive:boolean, tapered:boolean, adjustedIncome:(number|null) }}
 */
export function effectiveAA(entity) {
  const standardAA = TAX.pensionAA ?? 60000;
  const mpaa       = TAX.mpaa ?? 10000; // FA 2017 MPAA — literal fallback if bundle omits.
  const taperThreshold = TAX.taperedAnnualAllowanceAdjustedIncome ?? 260000;
  const taperFloor = 10000; // Statutory floor under tapered AA regime.

  const mpaaActive = !!(
    entity?.flexibleDrawdownTriggered === true ||
    entity?.individual?.flexibleDrawdownTriggered === true ||
    entity?.pension?.mpaaActive === true
  );

  if (mpaaActive) {
    return {
      aa: mpaa,
      reason: 'mpaa',
      mpaaActive: true,
      tapered: false,
      adjustedIncome: null,
    };
  }

  // Adjusted income (FA 2011 s23) — approximated as total taxable income
  // including employer pension input. Best-effort: callers may pre-compute.
  const adjIncRaw =
      (+entity?.adjustedIncome) ||
      (+entity?.individual?.adjustedIncome) ||
      null;

  if (adjIncRaw != null && adjIncRaw > taperThreshold) {
    const reduction = (adjIncRaw - taperThreshold) / 2;
    const aa = Math.max(taperFloor, standardAA - reduction);
    return {
      aa,
      reason: 'tapered',
      mpaaActive: false,
      tapered: true,
      adjustedIncome: adjIncRaw,
    };
  }

  return {
    aa: standardAA,
    reason: 'standard',
    mpaaActive: false,
    tapered: false,
    adjustedIncome: adjIncRaw,
  };
}

// ── §2 holdingClock ─────────────────────────────────────────────────────────
/**
 * For wrapped tax-advantaged investments (EIS / SEIS / VCT), report years held
 * versus minimum-holding-period required to retain income-tax relief on exit.
 *
 *   EIS  — 3 years (ITA 2007 s159)
 *   SEIS — 3 years (ITA 2007 s257AB)
 *   VCT  — 5 years (ITA 2007 s266)
 *
 * @param {object} asset
 * @returns {({ wrapper:string, yearsHeld:number, yearsRequired:number, reliefAtRisk:boolean, expiryDate:(Date|null), status:('cleared'|'in-clock') })|null}
 */
export function holdingClock(asset) {
  if (!asset) return null;
  const t = String(asset.type || asset.wrapperType || '').toLowerCase();

  let wrapper = null;
  let yearsRequired = 0;
  if (t === 'eis')        { wrapper = 'EIS';  yearsRequired = 3; }
  else if (t === 'seis')  { wrapper = 'SEIS'; yearsRequired = 3; }
  else if (t === 'vct')   { wrapper = 'VCT';  yearsRequired = 5; }
  if (!wrapper) return null;

  const acqRaw = asset.acquisition_date || asset.start_date || asset.purchase_date;
  if (!acqRaw) {
    return {
      wrapper,
      yearsHeld: 0,
      yearsRequired,
      reliefAtRisk: true,
      expiryDate: null,
      status: 'in-clock',
    };
  }

  const acqDate = new Date(acqRaw);
  const now = Date.now();
  const yearsHeld = (now - acqDate.getTime()) / (365.25 * 86400000);
  const expiryDate = new Date(acqDate.getTime());
  expiryDate.setFullYear(expiryDate.getFullYear() + yearsRequired);

  const status = yearsHeld >= yearsRequired ? 'cleared' : 'in-clock';
  return {
    wrapper,
    yearsHeld: Math.round(yearsHeld * 100) / 100,
    yearsRequired,
    reliefAtRisk: status === 'in-clock',
    expiryDate,
    status,
  };
}

// ── helpers for IHT estimation ──────────────────────────────────────────────
function estimateEstateValue(entity) {
  if (entity == null) return 0;
  if (+entity.netWorth > 0) return +entity.netWorth;
  if (+entity.estate?.value > 0) return +entity.estate.value;
  const a = entity.assets || {};
  let total = 0;
  // sweep numeric values from common shapes
  if (a.residence?.value != null) total += +a.residence.value || 0;
  if (a.sipp?.total != null)      total += +a.sipp.total      || 0;
  if (a.isa?.value != null)       total += +a.isa.value       || 0;
  if (a.portfolio?.value != null) total += +a.portfolio.value || 0;
  if (a.cash?.total != null)      total += +a.cash.total      || 0;
  if (Array.isArray(a.pensions))    for (const p of a.pensions)    total += +(p.cetv ?? p.balance_gbp ?? p.balance ?? p.value ?? 0) || 0;
  if (Array.isArray(a.investments)) for (const i of a.investments) total += +(i.balance_gbp ?? i.balance ?? i.value ?? 0) || 0;
  if (Array.isArray(a.property))    for (const p of a.property)    total += +(p.value_gbp ?? p.value ?? 0) || 0;
  if (Array.isArray(a.bank))        for (const b of a.bank)        total += +(b.balance_gbp ?? b.balance ?? 0) || 0;
  return total;
}

// ── §3 cohabIHTCliff ────────────────────────────────────────────────────────
/**
 * Quantify the IHT exposure a cohabiting couple inherits vs a married couple.
 * UK IHT only recognises legal marriage and registered civil partnership for
 * the inter-spouse exemption (IHTA 1984 s18) and NRB transfer (s8A).
 *
 * Cohabitees are treated as strangers for IHT: the partner's leg of the joint
 * estate above their personal NRB is fully taxable at 40%.
 *
 * @deprecated 2026-05-28 — No active callers in src/. The audit (P2 dead-code
 *   purge) flagged this. The active surface for this concept is
 *   `<CohabIHTCliffTile>` in `components/MyMoney/PersonaGapTiles.jsx` which
 *   uses `tax-estate-engine.cohabIHTExposure()` (different signature). Kept
 *   exported so we don't break a future caller; remove in a focused cleanup
 *   after confirming with grep that no external consumer exists.
 *
 * @param {object} entity
 * @returns {({ exposure:number })|null}
 */
export function cohabIHTCliff(entity) {
  if (!entity) return null;
  const status = entity.maritalStatus || entity.individual?.maritalStatus || entity.household_status;
  if (status !== 'cohabiting' && status !== 'cohabitee' && status !== 'cohab') return null;

  const partner = entity.partner || entity.spouse;
  if (!partner) return null;

  const estate = estimateEstateValue(entity);
  // Partner's leg = 50% of joint estate by default (joint-tenancy assumption).
  const partnerLeg = estate * 0.5;
  const nrb = TAX.nrb ?? 325000;
  const rnrb = TAX.rnrb ?? 175000;
  const ihtRate = TAX.ihtRate ?? 0.40;

  // Partner gets their own NRB + RNRB (RNRB only if residence passes to direct
  // descendants — best-effort assumption true here). No spousal transfer
  // available to cohabitees.
  const partnerShelter = nrb + rnrb;
  const taxablePartnerLeg = Math.max(0, partnerLeg - partnerShelter);
  const exposure = Math.round(taxablePartnerLeg * ihtRate);

  return { exposure };
}

// ── §4 transferableNRB ──────────────────────────────────────────────────────
/**
 * Combined spousal nil-rate-band + residence-nil-rate-band shelter available
 * to a married / civil-partnership couple under IHTA 1984 s8A and FA 2015 s9.
 *
 *   combinedNRB  = £650,000 (2 × £325,000)
 *   combinedRNRB = £350,000 capped (2 × £175,000), tapered above £2m.
 *
 * @param {object} entity
 * @returns {({ combinedNRB:number, combinedRNRB:number, totalShelter:number, taperAt2m:boolean })|null}
 */
export function transferableNRB(entity) {
  if (!entity) return null;
  const status = entity.maritalStatus || entity.individual?.maritalStatus || entity.household_status;
  const married = status === 'married' || status === 'civil_partnership' || status === 'civil-partnership';
  if (!married) return null;

  const nrb = TAX.nrb ?? 325000;
  const rnrb = TAX.rnrb ?? 175000;
  const taperStart = TAX.rnrbTaper ?? 2000000;

  const combinedNRB = nrb * 2;
  const combinedRNRBCap = rnrb * 2;

  const estateValue = estimateEstateValue(entity);
  let combinedRNRB = combinedRNRBCap;
  let taperAt2m = false;
  if (estateValue > taperStart) {
    taperAt2m = true;
    combinedRNRB = Math.max(0, combinedRNRBCap - (estateValue - taperStart) / 2);
  }

  const totalShelter = combinedNRB + combinedRNRB;
  return { combinedNRB, combinedRNRB, totalShelter, taperAt2m };
}

// ── §5 statePensionForecast ─────────────────────────────────────────────────
/**
 * Pro-rata New State Pension forecast based on qualifying NI years.
 * (Pensions Act 2014 — 35 years for full nSP, sliding to 0 at <10 yrs.)
 *
 * @param {object} entity
 * @returns {({ annual:number, qualifyingYears:number, yearsRequired:35, weeklyPension:number, gapYears:number })|null}
 */
export function statePensionForecast(entity) {
  if (!entity) return null;
  const qy =
      entity.individual?.ni_qualifying_years ??
      entity.statePension?.qualifyingYears ??
      entity.individual?.state_pension_accrued_years ??
      null;
  if (qy == null) return null;
  const qualifyingYears = +qy || 0;

  const yearsRequired = TAX.statePensionQualYears ?? 35;
  const fullAnnual = TAX.statePensionFull ?? TAX.statePensionAnnual ?? 11502;

  const annual = Math.round((qualifyingYears / yearsRequired) * fullAnnual);
  const weeklyPension = Math.round((annual / 52) * 100) / 100;
  const gapYears = Math.max(0, yearsRequired - qualifyingYears);

  return {
    annual,
    qualifyingYears,
    yearsRequired: 35,
    weeklyPension,
    gapYears,
  };
}

// ── §6 carryForwardByYear ───────────────────────────────────────────────────
/**
 * Returns the per-year unused pension AA from the past 3 tax years,
 * or null if the entity hasn't recorded the breakdown.
 *
 * Pension audit P4 (2026-05-26): the previous drilldown UI read a scalar
 * `entity.carryForward3yr` that no persona populated, so the carry-forward
 * tile rendered "—" universally. This helper looks in the canonical place
 * (`entity.income.allowance_use.carry_forward_by_year`) and falls back to
 * legacy field names. Returned as a 3-tuple in [oldest, …, newest] order
 * because FA 2011 Sch 17 §10 mandates oldest-year-used-first matching.
 *
 * @param {object} entity
 * @returns {number[] | null}  [year_minus_3, year_minus_2, year_minus_1]
 */
export function carryForwardByYear(entity) {
  if (!entity) return null;
  const raw = entity.income?.allowance_use?.carry_forward_by_year
    ?? entity.carryForwardByYear
    ?? null;
  if (!raw) return null;
  if (Array.isArray(raw) && raw.length >= 3) {
    return [+raw[0] || 0, +raw[1] || 0, +raw[2] || 0];
  }
  if (typeof raw === 'object') {
    return [
      +(raw['y-3'] ?? raw.year_minus_3 ?? raw['-3']) || 0,
      +(raw['y-2'] ?? raw.year_minus_2 ?? raw['-2']) || 0,
      +(raw['y-1'] ?? raw.year_minus_1 ?? raw['-1']) || 0,
    ];
  }
  return null;
}

// ── §6 maritalStatus normaliser (S3 — 2026-05-27) ───────────────────────────
/**
 * Resolve a persona's marital / household status from any of the four
 * spellings that drift across the codebase + persona fixtures:
 *
 *   · entity.marital_status            (snake — mrT engine-test shape)
 *   · entity.maritalStatus             (camel — live-UI personas)
 *   · entity.relationshipStatus        (live-UI, alternative)
 *   · entity.household_status          (Ask Sonu / ontology shape)
 *   · entity.individual.marital_status (nested mrT-* fixtures)
 *
 * Returns one of: 'married' | 'civil-partnership' | 'cohabiting' | 'single'
 *                | 'divorced' | 'widowed' | 'separated' | 'unknown'.
 *
 * Before this normaliser landed, four different readers in the codebase
 * silently bailed when the persona used a spelling they didn't recognise —
 * a married cohabitee persona could show as 'single' on one screen and
 * 'married' on another, breaking spousal-NRB, cohab-IHT-cliff, and joint-
 * income paths. The audit catalogued 4 schema-drift findings on this field
 * alone (CROSS-SURFACE-PATTERNS P7).
 *
 * @param {object} entity
 * @returns {{ status:string, isCouple:boolean, isCohab:boolean, isMarried:boolean, isSingle:boolean, rawField:(string|null) }}
 */
export function maritalStatus(entity) {
  if (!entity || typeof entity !== 'object') {
    return { status: 'unknown', isCouple: false, isCohab: false, isMarried: false, isSingle: false, rawField: null };
  }
  // Probe order: live-UI shape first, then snake, then alternative naming,
  // then nested fixture shape. Last hit wins only when earlier ones miss.
  // P4-S3.5 (2026-05-28): mrT fixtures use entity.relationships[0].type
  // (e.g. 'married', 'divorced', 'cohabiting') with end_date semantics.
  // Without this probe mrT-couple/family/divorced silently behaved as 'single'.
  const activeRelation = Array.isArray(entity.relationships)
    ? entity.relationships.find(r => r?.type && !r?.end_date) || entity.relationships[0]
    : null;
  const probes = [
    ['maritalStatus',     entity.maritalStatus],
    ['marital_status',    entity.marital_status],
    ['relationshipStatus', entity.relationshipStatus],
    ['household_status',  entity.household_status],
    ['individual.marital_status', entity?.individual?.marital_status],
    ['individual.maritalStatus',  entity?.individual?.maritalStatus],
    ['relationships[0].type', activeRelation?.type],
  ];
  const hit = probes.find(([, v]) => typeof v === 'string' && v.length > 0);
  if (!hit) return { status: 'unknown', isCouple: false, isCohab: false, isMarried: false, isSingle: false, rawField: null };

  const raw  = String(hit[1]).toLowerCase().trim().replace(/[\s_]+/g, '-');
  // Canonicalise common variants.
  const canon =
      raw === 'married' || raw === 'civilly-partnered' || raw === 'civil-partner' || raw === 'civil-partnership' ? 'married'
    : raw === 'cohabiting' || raw === 'cohabitee' || raw === 'cohab' || raw === 'unmarried-partner' || raw === 'cohab-sep' ? 'cohabiting'
    : raw === 'single' || raw === 'never-married' ? 'single'
    : raw === 'divorced' || raw === 'civil-dissolution' ? 'divorced'
    : raw === 'widowed' || raw === 'widow' || raw === 'widower' ? 'widowed'
    : raw === 'separated' || raw === 'legally-separated' ? 'separated'
    : 'unknown';

  const isMarried = canon === 'married';
  const isCohab   = canon === 'cohabiting';
  const isSingle  = canon === 'single' || canon === 'divorced' || canon === 'widowed' || canon === 'separated';

  return {
    status: canon,
    isCouple: isMarried || isCohab,
    isCohab,
    isMarried,
    isSingle,
    rawField: hit[0],
  };
}
