// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL METRICS — engine functions referenced across the product but not
// previously implemented in fq-calculator.js:
//
//   · propertyDecisionsCoI(entity, bundle)   — fills the previously-zero slot
//   · taxEfficiencyScore(entity, bundle)     — 0-100, capacity used vs total
//   · prcPccSpread(entity, bundle)           — Personal Risk Capacity vs Personal Capital Cost
//   · drawdownEfficiencyRatio(entity, bundle)— actual vs optimal drawdown
//   · effectiveBeneficiaryRate(entity, bundle)— % of estate reaching heirs after IHT
//
// Pure functions, numeric defaults, no throw. Each returns a plain object so
// callers can render confidence + breakdown without recomputing.
//
// Spec sources:
//   · Foundation v1.11 §0.1 Cost-of-Inaction (12-domain canonical)
//   · MyMoney v2.7 §2.3 wrapper × tax fast-path
//   · Home v1.4 §Z1.5 PRC/PCC sub-anchor
//   · Cashflow v1.7 §B Drawdown Efficiency Ratio
//   · Tax & Estate v1.6 §3 Effective Beneficiary Rate
// ─────────────────────────────────────────────────────────────────────────────

import {
  pensionTotal, investmentsTotal, propertyTotal, cashTotal,
  liabilitiesTotal, annualIncome, personAge, statePensionAnnual,
  protectionFlat, getWrapper, getMonthlyEssentials,
} from './_helpers.js';

// All tax constants drawn from the centralised bundle via fq-calculator's TAX object.
// CLAUDE.md §6.2: never hardcode tax rates, allowances, or thresholds.
import { TAX } from './fq-calculator.js';

// Single-source-of-truth IHT engine — referenced by ihtProjection / ihtDeltaPrePost2027
// so the v0.3 R4 signature card never diverges from the canonical legacy figure.
// (Task #99 fix, 2026-05-26.)
import { ihtExposure as _canonicalIhtExposure } from './tax-estate-engine.js';
import { maritalStatus } from './persona-helpers.js';

// IFA audit HIGH-16 fix (2026-05-26): cohabiting couples were charitably
// treated as having a 50% spousal share. UK IHT only recognises legal
// marriage and registered civil partnership for the inter-spouse exemption
// (IHTA 1984 s18) and NRB transfer (s8A). Cohabitees get neither.
// P1-S3-wired (2026-05-28): now reads via maritalStatus() normaliser so
// every spelling drift across personas resolves to a canonical status —
// cohabiting/cohab-sep/cohabitee/unmarried-partner all canonicalise away
// from 'married' regardless of which field the persona populated.
function isLegalSpouse(entity) {
  return maritalStatus(entity).isMarried;
}

// ── MARKET ASSUMPTIONS ───────────────────────────────────────────────────────
// Overridable assumptions for interest rates and drawdown efficiency.
// Callers may merge userAssumptions via spread: { ...defaultMarketAssumptions, ...userAssumptions }
export const defaultMarketAssumptions = {
  cashInterestRate:     0.04,   // assumed gross interest rate on cash savings
  mortgageInterestRate: 0.045,  // assumed mortgage / BTL loan interest rate
  debtInterestRate:     0.05,   // assumed general (non-mortgage) debt interest rate
  drawdownRate:         0.045,  // assumed safe/optimal drawdown rate for efficiency calc
};

/**
 * Merge user-supplied overrides into defaultMarketAssumptions.
 * Returns a frozen snapshot — callers destructure what they need.
 * @param {object} [overrides]
 * @returns {object}
 */
export function mergeAssumptions(overrides) {
  return Object.freeze({ ...defaultMarketAssumptions, ...(overrides || {}) });
}

function marginalRate(entity) {
  const inc = annualIncome(entity);
  if (inc > TAX.art) return TAX.ar;
  if (inc > TAX.brt) return TAX.hr;
  return TAX.br;
}

// ── §1 propertyDecisionsCoI ──────────────────────────────────────────────────
// Sources of CoI in the property domain:
//   1. BTL S24 drag — interest × (marginal - basic) per year
//   2. Multiple-dwelling council tax surplus if not nominated PPR
//   3. Excess SDLT on second-home stamp duty (post-purchase, sunk)
//   4. Insurance gaps on let property
// Returns conservative annual £ drag (one year).
export function propertyDecisionsCoI(entity, _bundle, marketAssumptions = defaultMarketAssumptions) {
  const { mortgageInterestRate } = mergeAssumptions(marketAssumptions);
  const a = entity?.assets || {};
  const btls = [
    ...(Array.isArray(a.property) ? a.property : []),
    ...((entity?.rental_portfolio?.properties) || []),
  ].filter(p => p && (
    /buy-to-let|btl|rental|let/i.test(String(p.use || p.type || '')) ||
    p.status === 'rental'
  ));

  let coi = 0;
  let assetSideInterest = 0;
  const marg = marginalRate(entity);

  for (const p of btls) {
    if (p.status === 'disposed') continue;
    // S24: interest tax-relief restricted to basic rate
    const interest = +p.annual_interest_cost
      || (+p.outstanding_balance || +p.mortgage?.outstanding || 0) * mortgageInterestRate;
    assetSideInterest += interest;
    const s24Drag = Math.max(0, interest * Math.max(0, marg - TAX.br));
    coi += s24Drag;

    // Uninsured / underinsured rental
    if (!p.landlord_insurance || p.landlord_insurance === 'none') {
      const value = +(p.value_gbp || p.value || 0);
      coi += value * 0.0005; // expected loss × premium-equiv
    }
  }

  // Some personas store BTL mortgages on the liability side rather than the
  // asset record. Fold these in only when we couldn't derive interest from the
  // property records themselves, to avoid double-counting.
  if (btls.length > 0 && assetSideInterest === 0) {
    const liabBtlInterest = (entity?.liabilities?.otherLoans || [])
      .filter(l => /buy-to-let|btl/i.test(l.type || ''))
      .reduce((s, l) => s + ((+l.outstanding || +l.outstanding_balance || 0)
                           * (+l.interest_rate || +l.apr || mortgageInterestRate)), 0);
    coi += Math.max(0, liabBtlInterest * Math.max(0, marg - TAX.br));
  }

  return Math.round(coi);
}

// ── §2 taxEfficiencyScore ────────────────────────────────────────────────────
// 0-100. Composite of: % ISA cap used (current year), % AA used, % AEA used,
// % gifting allowance used, % BPR-qualifying capacity used. Higher = more of
// the available shelter has been deployed. Designed for the "how tax-efficient
// is the picture" headline on MyMoney + Tax & Estate.
export function taxEfficiencyScore(entity, _bundle) {
  const a = entity?.assets || {};
  // ISA usage current year
  const isaContrib = (Array.isArray(a.investments) ? a.investments : [])
    .filter(i => /isa/i.test(i.type || ''))
    .reduce((s, i) => s + (+i.contribution_current_tax_year || 0), 0);
  const isaPct = Math.min(100, (isaContrib / TAX.isaAllowance) * 100);

  // AA usage
  const pensionContrib = +entity?.pensionContributions
    || +(a.pensionContributions || 0)
    || ((Array.isArray(a.pensions) ? a.pensions : [])
        .reduce((s, p) => s + (+p.annual_contribution || 0), 0));
  const aaPct = Math.min(100, (pensionContrib / TAX.pensionAA) * 100);

  // AEA usage — assume 0 if no disposal data; cap if cgt_realised_current_year present
  const aeaCap = TAX.cgaAllowance;
  const realisedGains = +entity?.cgt_realised_current_year || 0;
  const aeaPct = Math.min(100, (realisedGains / aeaCap) * 100);

  // Annual gift allowance — £3k
  const giftCap = TAX.giftExemption;
  const giftsThisYear = +entity?.gifts_current_tax_year || 0;
  const giftPct = Math.min(100, (giftsThisYear / giftCap) * 100);

  // BPR-qualifying capacity utilisation
  const bprQualifying = (entity?.business_assets || [])
    .filter(b => b.qualifies_for_bpr).reduce((s, b) => s + (+b.value_gbp || +b.value || 0), 0);
  const bprCap = 2_500_000;
  const bprPct = bprQualifying > 0 ? Math.min(100, (bprQualifying / bprCap) * 100) : 0;

  // Weighted blend — ISA + AA most actionable, others tail.
  const weights = { isa: 0.35, aa: 0.35, aea: 0.12, gift: 0.08, bpr: 0.10 };
  const score = Math.round(
    isaPct * weights.isa +
    aaPct  * weights.aa  +
    aeaPct * weights.aea +
    giftPct* weights.gift+
    bprPct * weights.bpr
  );

  return {
    total: score,
    breakdown: {
      isa:  Math.round(isaPct),
      aa:   Math.round(aaPct),
      aea:  Math.round(aeaPct),
      gift: Math.round(giftPct),
      bpr:  Math.round(bprPct),
    },
    confidence: 'MEDIUM', // depends on capture quality of contribution data
  };
}

// ── §3 prcPccSpread ──────────────────────────────────────────────────────────
// Personal Risk Capacity (PRC) — how much loss the financial picture can
// absorb before the user's lifestyle plan breaks.
// Personal Capital Cost (PCC) — annual cost of running the current plan.
// Spread (PRC - PCC) is the structural cushion. Positive = buffer; negative =
// the plan is running on borrowed time.
//
// PRC = liquid assets + 5y net surplus capacity − essential expenses × 12
// PCC = annual essential expenses × (1 + risk-adjusted load)
export function prcPccSpread(entity, _bundle) {
  const liquid = cashTotal(entity) + investmentsTotal(entity);
  // BLOCK-1 fix: route through canonical getMonthlyEssentials which checks
  // entity.monthlyExpenditure (the persona-a..g shape that the previous chain
  // ignored, causing TIME_COVERED=150yr and INCOME_BUFFER=52× on MyMoney).
  const essentials = getMonthlyEssentials(entity);
  const annualEssential = essentials.annual
    || (annualIncome(entity) * 0.55);  // fallback: 55% essentials assumption

  // PCC = annual essentials × risk-loading. Higher when concentrated, leveraged.
  const debt = liabilitiesTotal(entity);
  const assets = liquid + propertyTotal(entity) + pensionTotal(entity);
  const leverage = assets > 0 ? Math.min(1.5, 1 + debt / assets) : 1;
  const pcc = Math.round(annualEssential * leverage);

  // PRC = liquid + 5y of net surplus (income − essentials)
  const incomeNet = annualIncome(entity);
  const fiveYrSurplus = Math.max(0, (incomeNet - annualEssential) * 5);
  const prc = Math.round(liquid + fiveYrSurplus);

  const spread = prc - pcc;
  const ratio = pcc > 0 ? prc / pcc : 0;

  return {
    prc,
    pcc,
    spread,
    ratio,
    band: ratio >= 3 ? 'STRONG' : ratio >= 1.5 ? 'COMFORTABLE' : ratio >= 1 ? 'TIGHT' : 'STRETCHED',
    confidence: 'MEDIUM',
  };
}

// ── §4 drawdownEfficiencyRatio ───────────────────────────────────────────────
// Actual drawdown rate vs the engine's recommended optimal (Guyton-Klinger
// guardrail). 1.0 = on the optimal path. > 1.0 = over-drawing. < 1.0 =
// leaving income on the table (and growing the IHT-exposed pension pot post-2027).
export function drawdownEfficiencyRatio(entity, _bundle, marketAssumptions = defaultMarketAssumptions) {
  const { drawdownRate } = mergeAssumptions(marketAssumptions);
  const drawdown = +entity?.drawdown || 0;
  const pension = pensionTotal(entity);
  if (pension <= 0 || drawdown <= 0) {
    return { actual: drawdown, optimal: 0, ratio: 0, status: 'no-drawdown', confidence: 'HIGH' };
  }
  // Guyton-Klinger style optimal — default rate from market assumptions
  const optimal = pension * drawdownRate;
  const ratio = optimal > 0 ? drawdown / optimal : 0;
  let status;
  if (ratio < 0.5)  status = 'under-drawing';
  else if (ratio < 0.9) status = 'conservative';
  else if (ratio <= 1.1) status = 'on-target';
  else if (ratio <= 1.3) status = 'aggressive';
  else status = 'over-drawing';

  return {
    actual: Math.round(drawdown),
    optimal: Math.round(optimal),
    ratio: Math.round(ratio * 100) / 100,
    status,
    confidence: 'MEDIUM',
  };
}

// ── §5 effectiveBeneficiaryRate ──────────────────────────────────────────────
// What fraction of the estate, by current rules, actually reaches the named
// beneficiaries after IHT + admin friction. 1.0 = whole estate passes. 0.6 =
// 40% lost to IHT + 0% admin (the worst non-degenerate case at typical UK
// estate scale).
export function effectiveBeneficiaryRate(entity, _bundle) {
  const propVal = propertyTotal(entity);
  const liqVal = cashTotal(entity) + investmentsTotal(entity);
  const penVal = pensionTotal(entity);

  // Pre-2027: pension out of estate. Post-2027: in estate.
  // Use the more conservative (post-2027) view since the rule change is in
  // sight — this is the worst-case beneficiary outcome users should plan for.
  const estate = propVal + liqVal + penVal;
  if (estate <= 0) {
    return { rate: 1, estate: 0, ihtDue: 0, netToHeirs: 0, confidence: 'HIGH' };
  }

  // Nil-rate bands available
  // IFA audit HIGH-16 follow-up (2026-05-26): RNRB tapers £1 for every £2 of
  // estate above the £2m threshold (FA 2015 s9, TCGA-style taper). Previous
  // code applied the headline £175k flat — overstated shelter on estates
  // above £2m by up to £175k each, understating IHT by up to £70k.
  let bands = TAX.nrb;
  const residenceUsed = entity?.residence_to_descendants !== false; // default true if children present
  const hasChildren = (entity?.dependants || []).some(d => d.relationship === 'child')
    || (entity?.family_obligations || []).some(d => d.relationship === 'child');
  if (residenceUsed && hasChildren && propVal > 0) {
    const taperStart = TAX.rnrbTaper ?? 2_000_000;
    let effectiveRnrb = TAX.rnrb;
    if (estate > taperStart) {
      effectiveRnrb = Math.max(0, TAX.rnrb - (estate - taperStart) / 2);
    }
    bands += effectiveRnrb;
  }

  // BPR / APR shelter
  const bprShelter = Math.min(
    2_500_000,
    (entity?.business_assets || []).filter(b => b.qualifies_for_bpr)
      .reduce((s, b) => s + (+b.value_gbp || +b.value || 0), 0)
  );
  bands += bprShelter;

  // Spouse-exempt transfer — IFA audit HIGH-16 fix (2026-05-26).
  // Cohabitees were inheriting a default 0.5 spousal share because the old
  // check accepted `entity.isMarried === true` regardless of legal status.
  // UK IHT s18 only exempts transfers between legal spouses / civil partners.
  const isMarried = isLegalSpouse(entity);
  const spouseLeg = isMarried
    ? (entity?.estate_to_spouse_pct ?? 0.5)
    : 0; // cohabitees, single, divorced, widowed → no spousal exemption
  const spouseExempt = estate * Math.max(0, Math.min(1, spouseLeg));

  const taxable = Math.max(0, estate - bands - spouseExempt);
  const ihtDue = Math.round(taxable * TAX.ihtRate);
  const netToHeirs = Math.round(estate - ihtDue);
  const rate = Math.max(0, Math.min(1, netToHeirs / estate));

  return {
    rate: Math.round(rate * 1000) / 1000,
    estate: Math.round(estate),
    ihtDue,
    netToHeirs,
    bandsAvailable: Math.round(bands),
    spouseExempt: Math.round(spouseExempt),
    confidence: 'MEDIUM',
  };
}

// ── §5.5 ihtProjection / ihtDeltaPrePost2027 (NEW v0.3 — MASTER §3.1) ───────
// Closes IFA + Tax v2 critique blockers: SIPP-IHT pre/post-April-2027 delta
// is R4's signature moment (§3.2 R1→R4 deep-link, §4.7 stacked-bar segment).
// Pre-2027 (asOfDate < 2027-04-06): pensions OUT of estate (current rules).
// Post-2027 (asOfDate ≥ 2027-04-06): pensions INSIDE estate (Finance Act 2026).
//
// Spec sources:
//   · route-4-tax-estate.md §6 — Today / From April 2027 columns + delta value
//   · route-1-balance-sheet.md §3.2 — SIPP-IHT chip on Pensions tile
//   · route-7-decisions.md §6 — SIPP-IHT deadline ranking
//   · MASTER-SPEC §3.4 — paFreezeUntil + bprCombinedCap + petTaperByYear keys

/**
 * IHT projection under specified rule set.
 *
 * @param {object} entity
 * @param {string|Date} [asOfDate='2026-04-06'] ISO date — rule cut-off.
 * @returns {{ gross:number, nrb:number, rnrb:number, taxable:number, ihtDue:number, pensionsIncluded:boolean, asOfDate:string }}
 */
export function ihtProjection(entity, asOfDate = '2026-04-06') {
  const cutoff = asOfDate instanceof Date ? asOfDate : new Date(asOfDate);
  const pivot = new Date('2027-04-06');
  const pensionsIncluded = cutoff.getTime() >= pivot.getTime();

  // v0.3.2 Task #99 fix (2026-05-26):
  // Original ihtProjection re-implemented IHT base computation but diverged
  // from the canonical legacy te_ihtExposure — it ignored liability deduction,
  // funeral expenses, couple NRB doubling, transferable NRB from deceased
  // spouse, tiered BPR (100% / 50% AIM), and charity relief. For Mr T this
  // produced TODAY £151,816 against legacy £0 (the legacy figure was correct).
  //
  // Fix: delegate to canonical ihtExposure with scenario.postPension flag set
  // by the asOfDate pivot. Single source of truth — there is now no second
  // IHT computation in the engine. Pre-2027 cutoff → pensions OUT of estate;
  // 2027-04-06 onward → pensions IN (Finance Act 2026, Royal Assent 18-Mar-2026).
  let exp = null;
  try {
    exp = _canonicalIhtExposure(entity, 'UK-2026.1', { postPension: pensionsIncluded });
  } catch (_e) {
    exp = null;
  }

  if (exp && Number.isFinite(exp.iht_due)) {
    return {
      gross: Math.round(exp.gross_estate || 0),
      nrb: Math.round(exp.nrb?.available || 0),
      rnrb: Math.round(exp.rnrb?.available || 0),
      taxable: Math.round(exp.taxable_estate || 0),
      ihtDue: Math.round(exp.iht_due || 0),
      pensionsIncluded,
      asOfDate: cutoff.toISOString().slice(0, 10),
    };
  }

  // Fallback (ESM browser path): keep the simpler model but include
  // liability deduction and couple NRB doubling so the answer stays in the
  // same ballpark as the canonical engine.
  const propVal = propertyTotal(entity);
  const liqVal = cashTotal(entity) + investmentsTotal(entity);
  const penVal = pensionTotal(entity);
  const debts = liabilitiesTotal(entity);
  const grossPre = propVal + liqVal + (pensionsIncluded ? penVal : 0);
  const gross = Math.max(0, grossPre - debts - 5000); // ~funeral

  if (gross <= 0) {
    return {
      gross: 0,
      nrb: TAX.nrb ?? 325000,
      rnrb: 0,
      taxable: 0,
      ihtDue: 0,
      pensionsIncluded,
      asOfDate: cutoff.toISOString().slice(0, 10),
    };
  }

  const married = isLegalSpouse(entity);
  let nrb = TAX.nrb ?? 325000;
  let rnrbBase = TAX.rnrb ?? 175000;
  if (married) { nrb *= 2; rnrbBase *= 2; }

  const taperStart = TAX.rnrbTaper ?? 2_000_000;
  const residenceUsed = entity?.residence_to_descendants !== false;
  const hasChildren = (entity?.dependants || []).some(d => d.relationship === 'child')
    || (entity?.family_obligations || []).some(d => d.relationship === 'child')
    || entity?.estate?.directDescendant !== false;
  let rnrb = 0;
  if (residenceUsed && hasChildren && propVal > 0) {
    rnrb = rnrbBase;
    if (grossPre > taperStart) {
      rnrb = Math.max(0, rnrb - (grossPre - taperStart) / 2);
    }
  }

  const bprCap = TAX.bprCombinedCap ?? 2_500_000;
  const bprShelter = Math.min(
    bprCap,
    (entity?.business_assets || [])
      .filter(b => b.qualifies_for_bpr)
      .reduce((s, b) => s + (+b.value_gbp || +b.value || 0), 0)
  );

  const bands = nrb + rnrb + bprShelter;
  const taxable = Math.max(0, gross - bands);
  const ihtRate = TAX.ihtRate ?? 0.40;
  const ihtDue = Math.round(taxable * ihtRate);

  return {
    gross: Math.round(gross),
    nrb: Math.round(nrb),
    rnrb: Math.round(rnrb),
    taxable: Math.round(taxable),
    ihtDue,
    pensionsIncluded,
    asOfDate: cutoff.toISOString().slice(0, 10),
  };
}

/**
 * Delta of IHT exposure across the April 2027 rule change (Finance Act 2026 —
 * unused pensions enter the estate). R4 signature moment.
 *
 * @param {object} entity
 * @returns {{ today:number, post2027:number, delta:number, daysUntilApril2027:number, todayDetail:object, post2027Detail:object }}
 */
export function ihtDeltaPrePost2027(entity) {
  const todayDetail = ihtProjection(entity, '2026-04-06');
  const post2027Detail = ihtProjection(entity, '2027-04-06');
  const today = todayDetail.ihtDue;
  const post2027 = post2027Detail.ihtDue;
  const delta = post2027 - today;

  const now = new Date();
  const pivot = new Date('2027-04-06');
  const daysUntilApril2027 = Math.max(0, Math.round((pivot.getTime() - now.getTime()) / 86400000));

  return {
    today,
    post2027,
    delta,
    daysUntilApril2027,
    todayDetail,
    post2027Detail,
  };
}

// ── §6 Domain-specific CoI breakdown for MyMoney tiles ───────────────────────
// Each tile asks for its CoI line. Canonical computation per tile here so the
// UI doesn't carry per-domain math.
export function coiForDomain(entity, domain, bundle, marketAssumptions = defaultMarketAssumptions) {
  const { cashInterestRate, debtInterestRate } = mergeAssumptions(marketAssumptions);
  switch (domain) {
    case 'pensions': {
      // BLOCK-2 fix: respect FA 2004 s189 relievable-earnings cap + MPAA.
      // Without these caps a retired persona (no employment income) gets a
      // bogus £12k tax-relief headroom on £60k AA — overstated by ~17× because
      // they can only contribute up to £3,600 gross (the universal floor for
      // non-earners) and only get basic-rate relief.
      const aaRaw = TAX.pensionAA;
      const used = +entity?.pensionContributions
        || ((entity?.assets?.pensions || []).reduce((s, p) => s + (+p.annual_contribution || 0), 0));

      // Relievable earnings cap (s189 FA 2004): contributions eligible for
      // relief are capped at the higher of (a) UK relevant earnings,
      // (b) £3,600 gross. Pure-investment income, rental, pensions-in-payment
      // do NOT count as relevant earnings.
      const relevantEarnings =
          (+entity?.income?.employment       || 0)
        + (+entity?.income?.directorSalary   || 0)
        + (+entity?.income?.selfEmploymentNet || 0)
        + (+entity?.income?.gross_annual_employment || 0);  // alt field
      const reliefCap = Math.max(3600, relevantEarnings);

      // MPAA: if flexible drawdown triggered, hard cap at TAX.mpaa (£10k).
      const mpaaActive = !!(entity?.flexibleDrawdownTriggered
        || entity?.pension?.mpaaActive
        || (entity?.assets?.pensions || []).some(p => p.mpaaActive || p.fadStarted));
      const aaEffective = mpaaActive ? (TAX.mpaa || 10000) : aaRaw;

      // Headroom = min(AA after MPAA, relief cap) − already used
      const cap = Math.min(aaEffective, reliefCap);
      const left = Math.max(0, cap - used);
      const marg = marginalRate(entity);
      const reliefLost = left * marg;
      if (reliefLost < 200) return null;
      // BLOCK-3 FCA boundary reframe (no "gone forever").
      const note = mpaaActive ? ' (MPAA cap applies)' : (relevantEarnings < aaRaw ? ' (capped by relevant earnings)' : '');
      return `£${reliefLost >= 1000 ? (reliefLost / 1000).toFixed(1) + 'k' : reliefLost.toFixed(0)} of pension tax relief available this tax year${note} (deadline 5 April)`;
    }
    case 'investments': {
      const isaUsed = ((entity?.assets?.investments) || [])
        .filter(i => /isa/i.test(i.type || ''))
        .reduce((s, i) => s + (+i.contribution_current_tax_year || 0), 0);
      const left = Math.max(0, TAX.isaAllowance - isaUsed);
      const cash = cashTotal(entity);
      if (cash <= 0 || left < 1000) return null;
      const protect = Math.min(left, cash);
      const annualDrag = protect * cashInterestRate * marginalRate(entity);
      // V-5 fix (2026-05-28): sub-£1k values render as "£NNN/yr" not "£0.Xk/yr".
      return `${annualDrag < 1000 ? `£${Math.round(annualDrag)}` : `£${(annualDrag / 1000).toFixed(1)}k`}/yr of tax saved if you shelter £${(protect/1000).toFixed(0)}k into your ISA`;
    }
    case 'property': {
      const v = propertyDecisionsCoI(entity, bundle);
      if (v < 500) return null;
      // V-5 fix (2026-05-28): sub-£1k → "£NNN/yr" not "£0.Xk/yr".
      return `${v < 1000 ? `£${Math.round(v)}` : `£${(v / 1000).toFixed(1)}k`}/yr in extra tax because mortgage interest no longer fully offsets rental income`;
    }
    case 'business': {
      const bpr = (entity?.business_assets || [])
        .filter(b => b.qualifies_for_bpr)
        .reduce((s, b) => s + (+b.value_gbp || +b.value || 0), 0);
      if (bpr <= 0) return null;
      const sheltered = Math.min(bpr, 2_500_000);
      const saved = sheltered * TAX.ihtRate;
      const partial = bpr > 2_500_000;
      // BLOCK-3 FCA boundary follow-up: "protect the 2-year qualifying hold"
      // was imperative. Reframe as descriptive — the rule exists, you decide
      // how to act on it.
      return `Inheritance tax ${partial ? 'partially' : 'fully'} sheltered: £${(saved / 1000).toFixed(0)}k saved at current values. BPR requires a 2-year qualifying hold.`;
    }
    case 'protection': {
      const prot = protectionFlat(entity);
      if (prot.life.exists && !prot.life.inTrust) {
        const bite = prot.life.amount * TAX.ihtRate;
        // Tax+FCA / IFA audit 2026-05-26: "placing the policy in trust fixes
        // it" was directive about a specific product action. Reframed as
        // descriptive information; the action remains the user's choice.
        return `Up to £${(bite / 1000).toFixed(0)}k of the current life-cover payout would fall inside the estate for IHT. Policies written into a discretionary trust are typically held outside the estate (structure depends on personal circumstances).`;
      }
      return null;
    }
    case 'liabilities': {
      const debt = liabilitiesTotal(entity);
      if (debt < 1000) return null;
      const annualInterest = debt * debtInterestRate;
      // V-5 fix (2026-05-28): sub-£1k → "£NNN/yr" not "£0.Xk/yr".
      return `${annualInterest < 1000 ? `£${Math.round(annualInterest)}` : `£${(annualInterest / 1000).toFixed(1)}k`}/yr in interest while this debt runs`;
    }
    case 'cash': {
      const cash = cashTotal(entity);
      if (cash < 10000) return null;
      const psa = entity?.isHigherRateTaxpayer ? TAX.psaHigher : TAX.psaBasic;
      const rate = cashInterestRate;
      const interest = cash * rate;
      const taxable = Math.max(0, interest - psa);
      const tax = taxable * marginalRate(entity);
      if (tax < 200) return null;
      // BLOCK-3 FCA boundary: "wrapping into an ISA would shield it" is a
      // personal recommendation under COBS 9A. Reframe as informational
      // statement of mechanics — describes how ISAs work, not what you should do.
      return `£${tax.toFixed(0)}/yr in interest tax. ISAs shelter cash interest from income tax (annual subscription cap £${(TAX.isaAllowance/1000).toFixed(0)}k).`;
    }
    default:
      return null;
  }
}
