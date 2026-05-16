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
  protectionFlat, getWrapper,
} from './_helpers.js';

const HIGHER_RATE = 0.40;
const ADDITIONAL_RATE = 0.45;
const BASIC_RATE = 0.20;
const CGT_HIGHER = 0.24;
const IHT_RATE = 0.40;
const ISA_CAP = 20000;
const PENSION_AA = 60000;
const RNRB = 175000;
const NRB = 325000;

function marginalRate(entity) {
  const inc = annualIncome(entity);
  if (inc > 125140) return ADDITIONAL_RATE;
  if (inc > 50270)  return HIGHER_RATE;
  return BASIC_RATE;
}

// ── §1 propertyDecisionsCoI ──────────────────────────────────────────────────
// Sources of CoI in the property domain:
//   1. BTL S24 drag — interest × (marginal - basic) per year
//   2. Multiple-dwelling council tax surplus if not nominated PPR
//   3. Excess SDLT on second-home stamp duty (post-purchase, sunk)
//   4. Insurance gaps on let property
// Returns conservative annual £ drag (one year).
export function propertyDecisionsCoI(entity, _bundle) {
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
    // S24 — mortgage interest × (marginal − 20%) is the extra tax landlords pay.
    const annualInterest = +p.annual_mortgage_interest
      || (+p.outstanding_balance || +p.mortgage?.outstanding || 0) * 0.045; // assume 4.5% if no rate
    assetSideInterest += annualInterest;
    const s24Drag = Math.max(0, annualInterest * Math.max(0, marg - BASIC_RATE));
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
                           * (+l.interest_rate || +l.apr || 0.045)), 0);
    coi += Math.max(0, liabBtlInterest * Math.max(0, marg - BASIC_RATE));
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
  const isaPct = Math.min(100, (isaContrib / ISA_CAP) * 100);

  // AA usage
  const pensionContrib = +entity?.pensionContributions
    || +(a.pensionContributions || 0)
    || ((Array.isArray(a.pensions) ? a.pensions : [])
        .reduce((s, p) => s + (+p.annual_contribution || 0), 0));
  const aaPct = Math.min(100, (pensionContrib / PENSION_AA) * 100);

  // AEA usage — assume 0 if no disposal data; cap if cgt_realised_current_year present
  const aeaCap = 3000;
  const realisedGains = +entity?.cgt_realised_current_year || 0;
  const aeaPct = Math.min(100, (realisedGains / aeaCap) * 100);

  // Annual gift allowance — £3k
  const giftCap = 3000;
  const giftsThisYear = +entity?.gifts_current_tax_year || 0;
  const giftPct = Math.min(100, (giftsThisYear / giftCap) * 100);

  // BPR-qualifying capacity utilisation
  const bprQualifying = (entity?.business_assets || [])
    .filter(b => b.qualifies_for_bpr).reduce((s, b) => s + (+b.value_gbp || +b.value || 0), 0);
  const bprCap = 1_000_000;
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
  const annualEssential = +entity?.expenses?.essential_annual
    || (+entity?.expenses?.essential_monthly * 12)
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
export function drawdownEfficiencyRatio(entity, _bundle) {
  const drawdown = +entity?.drawdown || 0;
  const pension = pensionTotal(entity);
  if (pension <= 0 || drawdown <= 0) {
    return { actual: drawdown, optimal: 0, ratio: 0, status: 'no-drawdown', confidence: 'HIGH' };
  }
  // Guyton-Klinger style optimal ≈ 4.5% of pot
  const optimal = pension * 0.045;
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
  let bands = NRB;
  const residenceUsed = entity?.residence_to_descendants !== false; // default true if children present
  const hasChildren = (entity?.dependants || []).some(d => d.relationship === 'child')
    || (entity?.family_obligations || []).some(d => d.relationship === 'child');
  if (residenceUsed && hasChildren && propVal > 0) bands += RNRB;

  // BPR / APR shelter
  const bprShelter = Math.min(
    1_000_000,
    (entity?.business_assets || []).filter(b => b.qualifies_for_bpr)
      .reduce((s, b) => s + (+b.value_gbp || +b.value || 0), 0)
  );
  bands += bprShelter;

  // Spouse-exempt transfer
  const isMarried = !!entity?.isMarried || entity?.maritalStatus === 'married';
  const spouseLeg = entity?.estate_to_spouse_pct ?? (isMarried ? 0.5 : 0);
  const spouseExempt = estate * Math.max(0, Math.min(1, spouseLeg));

  const taxable = Math.max(0, estate - bands - spouseExempt);
  const ihtDue = Math.round(taxable * IHT_RATE);
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

// ── §6 Domain-specific CoI breakdown for MyMoney tiles ───────────────────────
// Each tile asks for its CoI line. Canonical computation per tile here so the
// UI doesn't carry per-domain math.
export function coiForDomain(entity, domain, bundle) {
  switch (domain) {
    case 'pensions': {
      const aa = PENSION_AA;
      const used = +entity?.pensionContributions
        || ((entity?.assets?.pensions || []).reduce((s, p) => s + (+p.annual_contribution || 0), 0));
      const left = Math.max(0, aa - used);
      const marg = marginalRate(entity);
      const reliefLost = left * marg;
      if (reliefLost < 1000) return null;
      return `£${(reliefLost / 1000).toFixed(1)}k of tax relief gone forever if not used by 5 April`;
    }
    case 'investments': {
      const isaUsed = ((entity?.assets?.investments) || [])
        .filter(i => /isa/i.test(i.type || ''))
        .reduce((s, i) => s + (+i.contribution_current_tax_year || 0), 0);
      const left = Math.max(0, ISA_CAP - isaUsed);
      const cash = cashTotal(entity);
      if (cash <= 0 || left < 1000) return null;
      const protect = Math.min(left, cash);
      const annualDrag = protect * 0.035 * marginalRate(entity);
      return `£${(annualDrag / 1000).toFixed(1)}k/yr of tax saved if you shelter £${(protect/1000).toFixed(0)}k into your ISA`;
    }
    case 'property': {
      const v = propertyDecisionsCoI(entity, bundle);
      if (v < 500) return null;
      return `£${(v / 1000).toFixed(1)}k/yr in extra tax because mortgage interest no longer fully offsets rental income`;
    }
    case 'business': {
      const bpr = (entity?.business_assets || [])
        .filter(b => b.qualifies_for_bpr)
        .reduce((s, b) => s + (+b.value_gbp || +b.value || 0), 0);
      if (bpr <= 0) return null;
      const sheltered = Math.min(bpr, 1_000_000);
      const saved = sheltered * IHT_RATE;
      const partial = bpr > 1_000_000;
      return `Inheritance tax ${partial ? 'partially' : 'fully'} sheltered: £${(saved / 1000).toFixed(0)}k saved at current values · protect the 2-year qualifying hold`;
    }
    case 'protection': {
      const prot = protectionFlat(entity);
      if (prot.life.exists && !prot.life.inTrust) {
        const bite = prot.life.amount * IHT_RATE;
        return `If you die today, £${(bite / 1000).toFixed(0)}k of the life-cover payout would go to HMRC — placing the policy in trust fixes it`;
      }
      return null;
    }
    case 'liabilities': {
      const debt = liabilitiesTotal(entity);
      if (debt < 1000) return null;
      const annualInterest = debt * 0.05;
      return `£${(annualInterest / 1000).toFixed(1)}k/yr in interest while this debt runs`;
    }
    case 'cash': {
      const cash = cashTotal(entity);
      if (cash < 10000) return null;
      const psa = entity?.isHigherRateTaxpayer ? 500 : 1000;
      const rate = 0.04;
      const interest = cash * rate;
      const taxable = Math.max(0, interest - psa);
      const tax = taxable * marginalRate(entity);
      if (tax < 200) return null;
      return `£${tax.toFixed(0)}/yr in interest tax — wrapping into an ISA would shield it`;
    }
    default:
      return null;
  }
}
