// ─────────────────────────────────────────────────────────────────────────────
// CAELIXA TAX & ESTATE ENGINE  —  P4 · s02a
// Spec: 2-Product-tax-estate-v1_0.md §8 + v1_1.md patches
// Pure functions only. No side effects. No global state.
// All monetary values GBP. All rates as decimals.
// bundle param accepts 'UK-2026.1' string — functions read from TAX_JSON directly.
// ─────────────────────────────────────────────────────────────────────────────

import TAX_JSON from '../rules/tax-2026.json' with { type: 'json' };
import {
  calcAge,
  ihtSippDelta,
  taperBand,
} from './fq-calculator.js';

// ── BUNDLE HELPERS ────────────────────────────────────────────────────────────

const INC  = TAX_JSON.income;
const CGT  = TAX_JSON.capitalGains;
const IHT  = TAX_JSON.inheritanceTax;
const PEN  = TAX_JSON.pension;
const ISA  = TAX_JSON.isa;
const NIC  = TAX_JSON.nationalInsurance;
const TR   = TAX_JSON.trusts;

const PA   = INC.personalAllowance;          // 12570
const BRL  = INC.basicRateBand;              // 37700
const BRT  = INC.basicRateThreshold;         // 50270
const ART  = INC.additionalRateThreshold;    // 125140
const BR   = INC.basicRate;                  // 0.20
const HR   = INC.higherRate;                 // 0.40
const AR   = INC.additionalRate;             // 0.45
const NRB  = IHT.nilRateBand;               // 325000
const RNRB = IHT.residenceNilRateBand;      // 175000
const IHT_RATE     = IHT.ihtRate;           // 0.40
const IHT_CHARITY  = IHT.ihtReducedRate;    // 0.36
const CHARITY_TEST = IHT.ihtReducedRateCharityThreshold; // 0.10
const APR_BPR_ALLOWANCE = IHT.aprBprCombinedAllowance;  // 2500000
const PENSION_IHT_DATE  = new Date(IHT.pensionIHTInclusionDate); // 2027-04-06
const NIC_PT   = NIC.primaryThreshold;      // 12570
const NIC_UEL  = NIC.upperEarningsLimit;    // 50270
const NIC_RATE = NIC.class1EmployeeRate;    // 0.08
const NIC_RATE_UPPER = NIC.class1EmployeeRateAboveUEL; // 0.02

// ── INTERNAL HELPERS ──────────────────────────────────────────────────────────

/**
 * Returns gross estate values by class.
 * Property sums ALL physical real estate: primary residence + BTL + rental
 * portfolio + second homes — all chargeable to IHT (none excluded unless held
 * in trust or PPR-exempt at death).
 * Liabilities sum ALL debts: mortgage (object or number shape) + BTL/secured
 * loans + unsecured loans + credit cards + student loan + bridging — each
 * Number()-coerced to defend against object shapes in fixtures.
 */
function _assetVals(e) {
  const a = e.assets || {};
  const sipp = a.sipp?.total ?? (a.pensions || []).reduce((s, p) => s + (p.value || 0), 0);

  // Primary residence
  const residenceVal = Number(a.residence?.value || 0) * Number(a.residence?.ownershipShare || 1);

  // assets.property[] array — BTL, second homes, additional dwellings
  const propertyArrayVal = Array.isArray(a.property)
    ? a.property.reduce((s, p) => s + Number(p?.value || 0) * Number(p?.ownershipShare ?? p?.beneficial_interest_this_individual ?? 1), 0)
    : 0;

  // assets.rental_portfolio — accept either array shape or { properties: [] } object shape
  let rentalPortfolioVal = 0;
  const rp = a.rental_portfolio;
  if (Array.isArray(rp)) {
    rentalPortfolioVal = rp.reduce((s, p) => s + Number(p?.value || 0) * Number(p?.ownershipShare ?? p?.beneficial_interest_this_individual ?? 1), 0);
  } else if (rp && Array.isArray(rp.properties)) {
    rentalPortfolioVal = rp.properties.reduce((s, p) => s + Number(p?.value || 0) * Number(p?.ownershipShare ?? p?.beneficial_interest_this_individual ?? 1), 0);
  }

  const property = residenceVal + propertyArrayVal + rentalPortfolioVal;

  // Liabilities — handle object {outstanding} shape AND raw-number shape
  const L = e.liabilities || {};
  const mortgageRaw = L.mortgage;
  const mortgageVal = mortgageRaw && typeof mortgageRaw === 'object'
    ? Number(mortgageRaw?.outstanding || 0)
    : Number(mortgageRaw || 0);

  const sumLoanArray = (arr) => Array.isArray(arr)
    ? arr.reduce((s, x) => s + Number(x?.outstanding ?? x?.outstanding_balance ?? x?.balance ?? 0), 0)
    : 0;

  const unsecuredLoansVal = sumLoanArray(L.unsecured_loans);
  const creditCardsVal    = sumLoanArray(L.credit_cards);
  // otherLoans[] is the canonical array on Mr T fixture — also sum it
  const otherLoansVal     = sumLoanArray(L.otherLoans);

  const studentLoanRaw = L.student_loan;
  const studentLoanVal = studentLoanRaw && typeof studentLoanRaw === 'object'
    ? Number(studentLoanRaw?.outstanding ?? studentLoanRaw?.outstanding_balance ?? 0)
    : Number(studentLoanRaw || 0);

  const bridgingRaw = L.bridging;
  const bridgingVal = bridgingRaw && typeof bridgingRaw === 'object'
    ? Number(bridgingRaw?.outstanding ?? bridgingRaw?.outstanding_balance ?? 0)
    : Number(bridgingRaw || 0);

  const otherVal = Number(L.other || 0);

  const liabilities = mortgageVal + unsecuredLoansVal + creditCardsVal + otherLoansVal + studentLoanVal + bridgingVal + otherVal;

  return {
    sipp,
    isa:      Number(a.isa?.value        || 0),
    gia:      Number(a.portfolio?.value  || 0),
    cash:     Number(a.cash?.own         || 0),
    property,
    liabilities,
  };
}

function _grossIncome(e) {
  const inc = e.income || {};
  return (inc.salary || 0) + (inc.selfEmployed || 0) + (inc.rental || 0) +
         (inc.other || 0) + (e.drawdown || 0);
}

function _effectivePA(grossIncome) {
  if (grossIncome <= INC.personalAllowanceTaperStart) return PA;
  if (grossIncome >= ART) return 0;
  const excess = grossIncome - INC.personalAllowanceTaperStart;
  return Math.max(0, PA - Math.floor(excess / 2));
}

function _incomeTaxBands(taxableIncome) {
  const bands = [];
  let remaining = taxableIncome;

  const basicUsed = Math.min(remaining, BRL);
  bands.push({ name: 'basic', rate: BR, threshold: BRL, used: basicUsed, tax: Math.round(basicUsed * BR) });
  remaining -= basicUsed;

  const taperBand2 = Math.max(0, ART - BRT);
  const taperUsed = Math.min(remaining, taperBand2);
  if (taperUsed > 0) {
    bands.push({ name: 'higher', rate: HR, threshold: taperBand2, used: taperUsed, tax: Math.round(taperUsed * HR) });
    remaining -= taperUsed;
  }

  if (remaining > 0) {
    bands.push({ name: 'additional', rate: AR, threshold: null, used: remaining, tax: Math.round(remaining * AR) });
  }

  return bands;
}

function _marginalRate(grossIncome, effectivePA) {
  const taxable = Math.max(0, grossIncome - effectivePA);
  if (grossIncome > INC.personalAllowanceTaperStart && grossIncome < ART) return 0.60;
  if (taxable <= BRL) return BR;
  if (grossIncome < ART) return HR;
  return AR;
}

function _yearsElapsed(dateStr) {
  return (Date.now() - new Date(dateStr)) / (365.25 * 86400000);
}

function _taperPct(yearsElapsed) {
  if (yearsElapsed >= 7) return 0;
  if (yearsElapsed >= 6) return IHT.taperRelief.years6to7;
  if (yearsElapsed >= 5) return IHT.taperRelief.years5to6;
  if (yearsElapsed >= 4) return IHT.taperRelief.years4to5;
  if (yearsElapsed >= 3) return IHT.taperRelief.years3to4;
  return 1.0;
}

function _confidence(e, requiredFields) {
  const missing = requiredFields.filter(f => {
    const parts = f.split('.');
    let obj = e;
    for (const p of parts) { obj = obj?.[p]; }
    return obj === undefined || obj === null;
  });
  if (missing.length === 0) return 'HIGH';
  if (missing.length <= 2) return 'MED';
  return 'LOW';
}

// ── §8.1 taxThisYear ─────────────────────────────────────────────────────────

export function taxThisYear(entity, year = 'tax-2026-27', bundle = 'UK-2026.1') {
  const itd  = incomeTaxDetail(entity, 0, bundle);
  const nics = nicsDetail(entity, 0, bundle);
  const cgtd = cgtDetail(entity, entity.assets?.portfolio?.holdings || [], bundle);
  const divd = dividendTaxDetail(entity, entity.assets?.portfolio?.holdings || [], bundle);

  const gross = _grossIncome(entity);
  const savings_tax = _savingsInterestTax(entity, itd.marginal_rate, bundle);

  const total_tax = itd.total_tax + nics.total_nic + cgtd.tax_due + divd.tax_paid + savings_tax;
  const net_after_tax = Math.max(0, gross - total_tax);

  return {
    total_tax,
    components: {
      income_tax:   itd.total_tax,
      nics:         nics.total_nic,
      cgt:          cgtd.tax_due,
      dividend_tax: divd.tax_paid,
      savings_tax,
    },
    effective_rate:  gross > 0 ? Math.round((total_tax / gross) * 1000) / 1000 : 0,
    drag_pct:        gross > 0 ? Math.round((total_tax / gross) * 1000) / 1000 : 0,
    net_after_tax,
    gross,
    confidence:      itd.confidence,
    bundle,
    provenance: {
      income:  'entity.income + entity.drawdown',
      cgt:     'entity.assets.portfolio.holdings',
      pension: 'entity.assets.sipp',
    },
  };
}

function _savingsInterestTax(entity, marginalRate, bundle) {
  const interest = entity.income?.savings || 0;
  if (interest <= 0) return 0;
  const psa = marginalRate <= BR ? INC.savingsAllowanceBasicRate :
              marginalRate <= HR ? INC.savingsAllowanceHigherRate : 0;
  const taxable = Math.max(0, interest - psa);
  return Math.round(taxable * marginalRate);
}

// ── §8.2 incomeTaxDetail ─────────────────────────────────────────────────────

export function incomeTaxDetail(entity, deltaIncome = 0, bundle = 'UK-2026.1') {
  const gross = _grossIncome(entity) + deltaIncome;
  const effectivePA = _effectivePA(gross);
  const taperLoss = PA - effectivePA;
  const taxable = Math.max(0, gross - effectivePA);
  const bands = _incomeTaxBands(taxable);
  const total_tax = bands.reduce((s, b) => s + b.tax, 0);
  const marginal = _marginalRate(gross, effectivePA);
  const scottish = entity.taxResidence === 'SCO';
  const conf = _confidence(entity, ['income']);

  return {
    gross_income: gross,
    personal_allowance: {
      available:    PA,
      used:         effectivePA,
      taper_loss:   taperLoss,
      after_taper:  effectivePA,
    },
    bands,
    total_tax,
    effective_rate:         gross > 0 ? Math.round((total_tax / gross) * 1000) / 1000 : 0,
    marginal_rate:          marginal,
    marginal_on_next_pound: marginal,
    scottish_variant:       scottish,
    confidence:             conf,
    bundle,
  };
}

// ── §8.3 nicsDetail ──────────────────────────────────────────────────────────

export function nicsDetail(entity, salarySacrifice = 0, bundle = 'UK-2026.1') {
  const salary = Math.max(0, (entity.income?.salary || 0) - salarySacrifice);
  const selfEmp = entity.income?.selfEmployed || 0;

  // Class 1 employee
  const c1Lower  = Math.max(0, Math.min(salary, NIC_UEL) - NIC_PT);
  const c1Upper  = Math.max(0, salary - NIC_UEL);
  const class1   = Math.round(c1Lower * NIC_RATE + c1Upper * NIC_RATE_UPPER);

  // Class 4 (self-employed)
  const c4Lower  = Math.max(0, Math.min(selfEmp, NIC.class4UpperProfitsLimit) - NIC.class4LowerProfitsLimit);
  const c4Upper  = Math.max(0, selfEmp - NIC.class4UpperProfitsLimit);
  const class4   = Math.round(c4Lower * NIC.class4RateLowerBand + c4Upper * NIC.class4RateUpperBand);

  const total_nic = class1 + class4;

  const ssSaving = salarySacrifice > 0
    ? Math.round(Math.min(salarySacrifice, Math.max(0, NIC_UEL - (salary + salarySacrifice))) * NIC_RATE)
    : 0;

  const CAP_DATE = '2029-04-06';
  const CAP_AMT  = 2000;
  const yearsToCap = (_yearsElapsed('2026-04-06') < 3); // within 3-year warning window

  return {
    salary_assessed: salary + salarySacrifice,
    salary_after_sacrifice: salary,
    class1,
    class4,
    total_nic,
    salary_sacrifice_saving_nic: ssSaving,
    salary_sacrifice_cap_horizon: {
      effective_date:       CAP_DATE,
      cap_amount_per_year:  CAP_AMT,
      current_year_in_scope: false,
      show_horizon_warning: yearsToCap,
    },
    state_pension_year_qualifying: salary >= NIC_PT || selfEmp >= NIC.class4LowerProfitsLimit,
    confidence: _confidence(entity, ['income.salary']),
    bundle,
  };
}

// ── §8.4 cgtDetail ───────────────────────────────────────────────────────────

export function cgtDetail(entity, holdings = [], bundle = 'UK-2026.1') {
  const exemption = CGT.annualExemptAmount;
  const marginalRate = incomeTaxDetail(entity, 0, bundle).marginal_rate;
  const cgtRate = marginalRate <= BR ? CGT.basicRate : CGT.higherRate;

  const realised = (entity.assets?.cgt?.realisedThisYear || []).map(r => ({
    asset:            r.asset,
    acquisition_date: r.acquisitionDate,
    sale_date:        r.saleDate,
    gain:             r.gain || 0,
    rate:             r.isBADR ? CGT.badrRate : cgtRate,
    tax:              Math.round(Math.max(0, r.gain || 0) * (r.isBADR ? CGT.badrRate : cgtRate)),
  }));

  const totalGain = realised.reduce((s, r) => s + r.gain, 0);
  const exemptionUsed = Math.min(exemption, Math.max(0, totalGain));
  const taxableGain   = Math.max(0, totalGain - exemption);
  const tax_due       = Math.round(taxableGain * cgtRate);

  const pending = holdings.filter(h => h.currentValue > (h.baseCost || 0)).map(h => {
    const gain = h.currentValue - (h.baseCost || 0);
    const taxIfSold = Math.round(Math.max(0, gain - Math.max(0, exemption - exemptionUsed)) * cgtRate);
    return {
      asset:                   h.name || h.id,
      current_value:           h.currentValue,
      base_cost:               h.baseCost || 0,
      unrealised_gain:         gain,
      if_sold_today_tax:       taxIfSold,
      bed_and_isa_opportunity: taxIfSold > 0 && (entity.assets?.isa?.remaining || 0) > 0,
    };
  });

  const spousalTransfer = entity.isCouple ? {
    eligible_value:              pending.reduce((s, p) => s + p.current_value, 0),
    additional_exemption_available: Math.max(0, exemption - exemptionUsed),
  } : null;

  return {
    annual_exemption: { total: exemption, used: exemptionUsed, remaining: Math.max(0, exemption - exemptionUsed) },
    realised,
    total_gain:  totalGain,
    taxable_gain: taxableGain,
    tax_due,
    pending,
    carry_forward_losses: entity.assets?.cgt?.carryForwardLosses || 0,
    spousal_transfer_opportunity: spousalTransfer,
    confidence: _confidence(entity, ['assets.portfolio']),
    bundle,
  };
}

// ── §8.5 dividendTaxDetail (v1.1 patched — rates 0.1075 / 0.3575) ────────────

export function dividendTaxDetail(entity, holdings = [], bundle = 'UK-2026.1') {
  const allowance  = INC.dividendAllowance;  // 500
  const marginal   = incomeTaxDetail(entity, 0, bundle).marginal_rate;
  const divRate    = marginal <= BR ? INC.dividendBasicRate :
                     marginal <= HR ? INC.dividendHigherRate :
                                      INC.dividendAdditionalRate;

  const totalDiv   = entity.income?.dividends || 0;
  const isaShield  = entity.assets?.isa?.dividendIncome || 0;
  const giaExposed = Math.max(0, totalDiv - isaShield);
  const taxable    = Math.max(0, giaExposed - allowance);
  const tax_paid   = Math.round(taxable * divRate);

  const allowanceUsed = Math.min(allowance, giaExposed);
  const isaHeadroom   = Math.max(0, (ISA.annualAllowance) - (entity.assets?.isa?.usedThisYear || 0));
  const moveSaving    = giaExposed > allowance
    ? Math.round(Math.min(giaExposed, isaHeadroom) * divRate)
    : 0;

  return {
    allowance: { total: allowance, used: allowanceUsed, remaining: Math.max(0, allowance - allowanceUsed) },
    total_dividend:  totalDiv,
    isa_shielded:    isaShield,
    gia_exposed:     giaExposed,
    effective_rate:  giaExposed > 0 ? Math.round((tax_paid / giaExposed) * 1000) / 1000 : 0,
    tax_paid,
    move_to_isa_opportunity: {
      eligible_amount:    giaExposed,
      tax_saving_annual:  moveSaving,
      isa_headroom:       isaHeadroom,
    },
    rates_effective_from: '2026-04-06',
    confidence: _confidence(entity, ['income.dividends']),
    bundle,
  };
}

// ── §8.6 allowanceTracker (v1.1 patched — ISA cap horizon + savings horizon) ─

export function allowanceTracker(entity, year = 'tax-2026-27', bundle = 'UK-2026.1') {
  const a   = entity.assets || {};
  const inc = entity.income || {};
  const age = calcAge(entity.dob);

  const isaUsed      = a.isa?.usedThisYear || 0;
  const isaTotal     = ISA.annualAllowance;
  const cgtUsed      = (entity.assets?.cgt?.realisedThisYear || []).reduce((s, r) => s + Math.max(0, r.gain || 0), 0);
  const cgtExemption = CGT.annualExemptAmount;
  const pensionAA    = PEN.annualAllowance;
  const pensionUsed  = entity.pension?.contributionsThisYear || 0;
  const pensionCF    = entity.pension?.carryForward || { 'tax-2023-24': 0, 'tax-2024-25': 0, 'tax-2025-26': 0 };
  const divUsed      = Math.min(INC.dividendAllowance, entity.income?.dividends || 0);
  const savingsUsed  = Math.min(INC.savingsAllowanceBasicRate, inc.savings || 0);
  const marginal     = incomeTaxDetail(entity, 0, bundle).marginal_rate;
  const savingsPSA   = marginal <= BR ? INC.savingsAllowanceBasicRate :
                       marginal <= HR ? INC.savingsAllowanceHigherRate : 0;

  const ageAt2027 = age + 1;
  const cashIsaCap = {
    effective_date:      '2027-04-06',
    age_at_effect:       ageAt2027,
    cap_applies:         ageAt2027 < 65,
    cap_amount:          12000,
    residual_must_invest: Math.max(0, isaTotal - 12000),
    last_full_cash_year: '2026-27',
  };

  return {
    isa: {
      total: isaTotal, used: isaUsed, remaining: Math.max(0, isaTotal - isaUsed),
      sub_types: {
        cash: a.isa?.cashISA || 0,
        ss:   a.isa?.stocksSharesISA || 0,
        jisa: a.isa?.jisa || 0,
      },
      cash_isa_cap_horizon: cashIsaCap,
    },
    cgt: {
      total: cgtExemption,
      used:  Math.min(cgtExemption, Math.max(0, cgtUsed)),
      remaining: Math.max(0, cgtExemption - Math.min(cgtExemption, cgtUsed)),
    },
    pension_aa: {
      current_year: {
        total:               pensionAA,
        used:                pensionUsed,
        remaining:           Math.max(0, pensionAA - pensionUsed),
        tapered:             _grossIncome(entity) > PEN.taperedAnnualAllowanceThreshold,
        tapered_threshold_at: PEN.taperedAnnualAllowanceThreshold,
      },
      carry_forward: { ...pensionCF, total: Object.values(pensionCF).reduce((s, v) => s + v, 0) },
    },
    dividend: {
      total: INC.dividendAllowance, used: divUsed,
      remaining: Math.max(0, INC.dividendAllowance - divUsed),
    },
    savings: {
      psa:       savingsPSA,
      total:     savingsPSA,
      used:      Math.min(savingsPSA, savingsUsed),
      remaining: Math.max(0, savingsPSA - savingsUsed),
      rate_horizon: {
        effective_date: '2027-04-06',
        basic_pre:  0.20, basic_post:  0.22,
        higher_pre: 0.40, higher_post: 0.42,
        additional_pre: 0.45, additional_post: 0.47,
      },
    },
    confidence: _confidence(entity, ['assets.isa', 'income']),
    bundle,
  };
}

// ── §8.7 taxDrag ─────────────────────────────────────────────────────────────

export function taxDrag(entity, bundle = 'UK-2026.1') {
  const gross  = _grossIncome(entity);
  if (gross <= 0) return { drag_pct: 0, components: {}, peer: null, optimised: null, confidence: 'LOW' };

  const tty = taxThisYear(entity, 'tax-2026-27', bundle);
  const drag = tty.drag_pct;

  const itShare   = gross > 0 ? tty.components.income_tax / gross : 0;
  const nicShare  = gross > 0 ? tty.components.nics / gross : 0;
  const cgtShare  = gross > 0 ? tty.components.cgt / gross : 0;
  const divShare  = gross > 0 ? tty.components.dividend_tax / gross : 0;
  const taperLoss = drag - itShare - nicShare - cgtShare - divShare;

  // Peer benchmarks — approximated until cohort data available
  const peer = { p25: 0.18, p50: 0.22, p75: 0.28, user_pct: null, cohort_data: false };
  if (drag <= 0.18)      peer.user_pct = 'p25';
  else if (drag <= 0.22) peer.user_pct = 'p50';
  else if (drag <= 0.28) peer.user_pct = 'p75';
  else                   peer.user_pct = 'above-p75';

  // Optimised drag: maximise pension + ISA wrappers
  const optimisedPensionContrib = Math.min(
    Math.max(0, PEN.annualAllowance - (entity.pension?.contributionsThisYear || 0)),
    Math.max(0, gross - PA)
  );
  const optimisedDrag = Math.round(Math.max(0, drag - (optimisedPensionContrib * HR / gross)) * 1000) / 1000;

  return {
    drag_pct: drag,
    components: {
      income_tax_share:  Math.round(itShare  * 1000) / 1000,
      nics_share:        Math.round(nicShare * 1000) / 1000,
      cgt_share:         Math.round(cgtShare * 1000) / 1000,
      dividend_share:    Math.round(divShare * 1000) / 1000,
      allowance_taper:   Math.round(Math.max(0, taperLoss) * 1000) / 1000,
    },
    peer,
    optimised: {
      drag_pct:       optimisedDrag,
      levers_applied: ['max_pension_contribution', 'isa_wrapper'],
      saving_pp:      Math.round((drag - optimisedDrag) * 1000) / 1000,
    },
    confidence: _confidence(entity, ['income']),
    bundle,
  };
}

// ── §8.8 drawdownMatrix ───────────────────────────────────────────────────────

export function drawdownMatrix(entity, range = { from: 0, to: 150000, step: 5000 }, statePension = true, spousalSplit = false, bundle = 'UK-2026.1') {
  const sipp      = entity.assets?.sipp?.total || 0;
  if (sipp < 1000) {
    return { insufficient_data: true, reason: 'No SIPP balance', rows: [], confidence: 'LOW' };
  }

  const sp        = statePension ? (PEN.statePensionFullAmount || 11502) : 0;
  const age       = calcAge(entity.dob);
  const horizon   = Math.max(10, 90 - age);
  const growth    = 0.05;
  const inflation = 0.025;

  const rows = [];
  for (let dd = range.from; dd <= range.to; dd += range.step) {
    const grossTotal  = dd + sp;
    const multiplier  = spousalSplit ? 2 : 1;
    const effectiveDD = spousalSplit ? dd / 2 : dd;
    const itResult    = incomeTaxDetail({ ...entity, drawdown: effectiveDD }, 0, bundle);
    const nicResult   = nicsDetail({ ...entity, income: { ...entity.income, salary: 0 } }, 0, bundle);
    const totalTax    = itResult.total_tax + nicResult.total_nic;
    const postTax     = Math.max(0, grossTotal - totalTax) * multiplier;
    const marginal    = itResult.marginal_rate;

    // IHT impact: each £1 drawdown now reduces SIPP post-2027; PV over horizon
    const sippReduction    = Math.min(sipp, dd * horizon);
    const ihtImpactLifetime = -Math.round(sippReduction * IHT_RATE);
    const ihtImpactPerYear  = horizon > 0 ? Math.round(ihtImpactLifetime / horizon) : 0;

    // CoI delta vs zero-drawdown baseline
    const baselineCoI = ihtSippDelta(entity);
    const withDrawdownCoI = ihtSippDelta({ ...entity, drawdown: dd });
    const coiDelta = withDrawdownCoI - baselineCoI;

    rows.push({
      drawdown:               dd,
      gross_income_total:     grossTotal,
      post_tax:               Math.round(postTax),
      marginal_rate:          marginal,
      total_tax_year:         Math.round(totalTax * multiplier),
      iht_impact_lifetime:    ihtImpactLifetime,
      iht_impact_per_year:    ihtImpactPerYear,
      coi_delta:              coiDelta,
      beneficiary_value_delta: -ihtImpactLifetime,
    });
  }

  // Recommended row: maximise beneficiary value at marginal_rate ≤ 0.40
  const eligible     = rows.filter(r => r.marginal_rate <= HR);
  const recommended  = eligible.length > 0
    ? eligible.reduce((best, r) => r.beneficiary_value_delta > best.beneficiary_value_delta ? r : best, eligible[0])
    : rows[0];

  return {
    rows,
    recommended_row:       recommended?.drawdown ?? 0,
    recommended_rationale: 'Maximises beneficiary value at marginal rate ≤ 40%',
    confidence:            'HIGH',
    assumptions: {
      growth_rate:   growth,
      inflation,
      cma_bundle:    'UK-CMA-2026.1',
      deadline:      PENSION_IHT_DATE.toISOString().split('T')[0],
      horizon_years: horizon,
    },
    bundle,
  };
}

// ── §8.9 ihtExposure (v1.1 patched — charity-pensions + PR-liability) ─────────

export function ihtExposure(entity, bundle = 'UK-2026.1', scenario = null) {
  const a       = _assetVals(entity);
  const today   = new Date();
  // scenario?.postPension forces the post-2027 regime (SIPP in estate) regardless
  // of today's date — used by the After-6-Apr-2027 tile to stay on the same
  // code path as IHTDrillPanel rather than diverging via ihtDynamic.
  const postPensionIHT = scenario?.postPension === true ? true : today >= PENSION_IHT_DATE;

  // Gross estate
  const sippInEstate = postPensionIHT ? a.sipp : 0;
  let gross = a.property + a.isa + a.gia + a.cash + sippInEstate;
  if (entity.assets?.protection?.lifeInsurance?.exists && !entity.assets.protection.lifeInsurance.inTrust) {
    gross += entity.assets.protection.lifeInsurance.amount || 0;
  }

  // Deductions
  const debtTotal   = a.liabilities;
  const funeral     = entity.estate?.funeralExpenses || 5000;
  const deductions  = { debts: debtTotal, funeral };
  const net_estate  = Math.max(0, gross - debtTotal - funeral);

  // NRB / RNRB
  let nrb  = NRB;  if (entity.isCouple) nrb  *= 2;
  let rnrb = RNRB; if (entity.isCouple) rnrb *= 2;
  const rnrbTaperThreshold = IHT.residenceNilRateBandTaperStart || 2000000;
  if (gross > rnrbTaperThreshold) rnrb = Math.max(0, rnrb - (gross - rnrbTaperThreshold) / 2);
  const hasDirectDesc = entity.estate?.directDescendant !== false;
  if (!hasDirectDesc) rnrb = 0;
  const transferableNRB = entity.isCouple && (entity.spouse?.unusedNRB || 0);
  nrb += transferableNRB;

  // APR / BPR reliefs — tiered
  const holdings = entity.assets?.portfolio?.holdings || [];
  const bprResult = bprQualifyingValue(entity, bundle);
  const aprRelief = { tier1_100pct: bprResult.tier1_100pct, tier2_50pct_above_allowance: bprResult.tier2_50pct_above_allowance, tier2_50pct_aim_or_not_listed: bprResult.tier2_50pct_aim_or_not_listed, allowance_used: bprResult.allowance_used, allowance_remaining: bprResult.allowance_remaining };
  const bpr_total = bprResult.tier1_100pct + Math.round(bprResult.tier2_50pct_above_allowance * 0.5) + Math.round(bprResult.tier2_50pct_aim_or_not_listed * 0.5);

  // Charity relief
  const charityPct   = entity.estate?.charityPct || 0;
  const charityValue = Math.round(net_estate * charityPct);
  const ten_pct_test = charityPct >= CHARITY_TEST;
  const effectiveIHTRate = ten_pct_test ? IHT_CHARITY : IHT_RATE;

  // Taxable estate
  const taxable_estate = Math.max(0, net_estate - nrb - rnrb - bpr_total - charityValue);
  const iht_due = Math.round(taxable_estate * effectiveIHTRate);
  const effective_rate = net_estate > 0 ? Math.round((iht_due / net_estate) * 1000) / 1000 : 0;

  // beneficiary_value: if no IHT due, family receives the entire net estate.
  // If IHT > 0, family receives net_estate − IHT_due. Defend against NaN by
  // coercing to safe numbers; sub-NRB estates must NEVER display "£0 to family".
  const _safeNet = Number.isFinite(net_estate) ? net_estate : 0;
  const _safeIHT = Number.isFinite(iht_due) ? iht_due : 0;
  const beneficiary_value = _safeIHT === 0
    ? _safeNet
    : Math.max(0, _safeNet - _safeIHT);

  // PR liability (post-2027 pension IHT)
  const pensionIHT = postPensionIHT ? Math.round(sippInEstate * IHT_RATE) : 0;
  const pr_liability = {
    pension_iht_payable_by_pr: pensionIHT,
    six_month_deadline:        null,
    withholding_mechanism_available: false,
  };

  // Post-75 double-tax sensitivity
  const age = calcAge(entity.dob);
  const post75 = age >= 75 || entity.estate?.modelPost75 === true;
  const marginal = incomeTaxDetail(entity, 0, bundle).marginal_rate;
  const post_75_double_tax = postPensionIHT ? {
    iht_at_estate:       pensionIHT,
    income_tax_at_marginal: Math.round(sippInEstate * marginal),
    combined_effective_rate: Math.round((IHT_RATE + marginal) * 100) / 100,
    tax_credit_mechanism: 'finalising',
  } : null;

  return {
    gross_estate:        gross,
    deductions,
    net_estate,
    nrb:  { available: nrb,  used: Math.min(nrb,  net_estate), transferable_from_spouse: transferableNRB },
    rnrb: { available: rnrb, used: Math.min(rnrb, Math.max(0, net_estate - nrb)), transferable_from_spouse: 0 },
    taxable_estate,
    iht_before_reliefs:  Math.round(Math.max(0, net_estate - nrb - rnrb) * effectiveIHTRate),
    reliefs: {
      apr_bpr:   aprRelief,
      charity: {
        pre_2027_estate_assets:  charityValue,
        post_2027_pension_assets: postPensionIHT ? Math.round(a.sipp * charityPct) : 0,
        ten_pct_test_passed:     ten_pct_test,
        reduced_rate_applied:    ten_pct_test ? IHT_CHARITY : null,
      },
    },
    iht_due,
    effective_iht_rate:  effective_rate,
    beneficiary_value,
    pr_liability,
    post_75_double_tax,
    scenario_applied:    scenario,
    confidence:          _confidence(entity, ['assets', 'estate']),
    bundle,
  };
}

// ── §8.10 ihtWaterfall (v1.1 patched — APR/BPR slider) ───────────────────────

export function ihtWaterfall(entity, deltas = {}, bundle = 'UK-2026.1') {
  const a        = _assetVals(entity);
  const today    = new Date();
  const postPIHT = today >= PENSION_IHT_DATE;

  const baseline = ihtExposure(entity, bundle);

  const drawdownConsumed  = (deltas.drawdown_per_year || 0) * 20;
  const giftAmt           = deltas.gift_amount || 0;
  const giftDate          = deltas.gift_date ? new Date(deltas.gift_date) : null;
  const propertyDelta     = a.property - (deltas.property_downsize_to || a.property);
  const trustAmt          = deltas.life_in_trust_amount || 0;
  const charityPct        = deltas.charity_pct || 0;
  const aprBprClaimed     = Math.min(deltas.apr_bpr_allowance_claimed || 0, APR_BPR_ALLOWANCE);
  const charityPensionPct = deltas.charity_pension_pct || 0;

  const gross = baseline.gross_estate;

  const afterDrawdown = gross - drawdownConsumed;
  const giftTaperPct  = giftDate ? _taperPct(_yearsElapsed(giftDate.toISOString())) : 1.0;
  const effectiveGift = Math.round(giftAmt * (1 - giftTaperPct));

  const afterGift     = afterDrawdown - giftAmt;
  const afterDownsize = afterGift - propertyDelta;
  const afterTrust    = afterDownsize - trustAmt;

  let nrb  = NRB;  if (entity.isCouple) nrb  *= 2;
  let rnrb = RNRB; if (entity.isCouple) rnrb *= 2;
  const rnrbTaperAt = IHT.residenceNilRateBandTaperStart || 2000000;
  if (afterTrust > rnrbTaperAt) rnrb = Math.max(0, rnrb - (afterTrust - rnrbTaperAt) / 2);

  const charityValue = Math.round(afterTrust * charityPct);
  const ten_pct_test = charityPct >= CHARITY_TEST;
  const effectiveRate = ten_pct_test ? IHT_CHARITY : IHT_RATE;

  const bprRelief   = aprBprClaimed;
  const afterReliefs = Math.max(0, afterTrust - nrb - rnrb - bprRelief - charityValue);
  const iht_due     = Math.round(afterReliefs * effectiveRate);

  const components = [
    { stage: 'gross_estate',             value: gross },
    { stage: 'minus_drawdown_consumed',  value: -drawdownConsumed },
    { stage: 'minus_gift_PET',           value: -giftAmt, taper_status: giftDate ? 'within-7-year' : null },
    { stage: 'minus_property_downsize',  value: -propertyDelta },
    { stage: 'minus_life_in_trust',      value: -trustAmt, taper_status: trustAmt > 0 ? 'CLT-CLE-applies' : null },
    { stage: 'subtotal',                 value: afterTrust },
    { stage: 'minus_NRB',                value: -Math.min(nrb, afterTrust) },
    { stage: 'minus_RNRB',               value: -Math.min(rnrb, Math.max(0, afterTrust - nrb)) },
    { stage: 'minus_BPR_APR',            value: -bprRelief },
    { stage: 'minus_charity',            value: -charityValue },
    { stage: 'taxable',                  value: afterReliefs },
    { stage: `iht_at_${ten_pct_test ? 36 : 40}pct`, value: iht_due },
    { stage: 'iht_due',                  value: iht_due },
  ];

  return {
    estate_after_deltas:    Math.max(0, afterTrust),
    iht_due,
    delta_vs_baseline:      iht_due - baseline.iht_due,
    waterfall_components:   components,
    applies_charity_36_rate: ten_pct_test,
    warnings:               giftDate && giftTaperPct > 0 ? [`Gift from ${giftDate.toISOString().split('T')[0]} still within 7-year window`] : [],
    confidence:             baseline.confidence,
    bundle,
  };
}

// ── §8.11 giftClockProjection (v1.1 patched — transitional rule) ──────────────

export function giftClockProjection(entity, gifts = [], today = new Date(), bundle = 'UK-2026.1') {
  gifts = gifts.length ? gifts : (entity.estate?.gifts || []);
  const annualExemption = IHT.annualGiftExemption;
  const usedThisYear = entity.estate?.giftExemptionUsedThisYear || 0;

  const REFORM_DATE   = new Date('2026-04-06');
  const TRANSITIONAL  = new Date('2024-10-30');

  const pets = gifts.map(g => {
    const date    = new Date(g.date || g.giftDate);
    const elapsed = _yearsElapsed(date.toISOString());
    const taperPct = _taperPct(elapsed);
    const ihtDue  = elapsed >= 7 ? 0 : Math.round(g.amount * taperPct * IHT_RATE);

    // v1.1 transitional rule
    const inTransitional = date >= TRANSITIONAL && today >= REFORM_DATE;
    const preReformIHT = Math.round(g.amount * taperPct * IHT_RATE);
    const newRulesIHT  = inTransitional ? Math.round(g.amount * taperPct * IHT_RATE) : preReformIHT;

    const monthsToFree = elapsed >= 7 ? 0 : Math.round((7 - elapsed) * 12);

    return {
      id:              g.id || `gift-${date.getTime()}`,
      recipient:       g.recipient || 'Unknown',
      amount:          g.amount,
      date:            date.toISOString().split('T')[0],
      years_elapsed:   Math.round(elapsed * 10) / 10,
      taper_band:      taperBand(date.toISOString()).label,
      taper_pct:       taperPct,
      iht_if_died_today: ihtDue,
      iht_after_clock: 0,
      months_to_clear: monthsToFree,
      transitional_treatment_eligible: inTransitional,
      failed_pet_iht_under_new_rules:  newRulesIHT,
      pre_reform_failed_pet_iht:       preReformIHT,
    };
  });

  const cumulative_tax_free = pets
    .filter(p => p.iht_if_died_today === 0)
    .reduce((s, p) => s + p.amount, 0);

  const upcoming = pets
    .filter(p => p.months_to_clear > 0 && p.months_to_clear <= 36)
    .map(p => ({
      pet_id:      p.id,
      clears_on:   new Date(new Date(p.date).getTime() + 7 * 365.25 * 86400000).toISOString().split('T')[0],
      value_freed: p.amount,
    }))
    .sort((a, b) => new Date(a.clears_on) - new Date(b.clears_on));

  return {
    pets,
    annual_exemption:          { available: annualExemption, used: usedThisYear },
    cumulative_tax_free,
    upcoming_clock_clearances: upcoming,
    confidence:                _confidence(entity, ['estate.gifts']),
    bundle,
  };
}

// ── §8.12 trustPeriodicCharge + trustContribution (v1.1 patched) ──────────────

export function trustPeriodicCharge(trust, asAt = new Date(), bundle = 'UK-2026.1') {
  const settled    = new Date(trust.settlementDate || trust.settledOn);
  const elapsed    = _yearsElapsed(settled.toISOString());
  const periodsMissed = Math.floor(elapsed / 10);
  const nextPeriodDate = new Date(settled);
  nextPeriodDate.setFullYear(nextPeriodDate.getFullYear() + (periodsMissed + 1) * 10);
  const yearsToNext = (nextPeriodDate - asAt) / (365.25 * 86400000);

  const currentValue  = trust.currentValue || 0;
  const cumCLT        = trust.cumulativeCLT || 0;
  const trustAllowance = APR_BPR_ALLOWANCE;
  const allowanceUsed  = Math.min(trustAllowance, currentValue);
  const aboveAllowance = Math.max(0, currentValue - trustAllowance);
  const notionalTransfer = currentValue + cumCLT;
  const periodicRate = notionalTransfer > NRB
    ? Math.min(0.06, ((notionalTransfer - NRB) / notionalTransfer) * 0.30 * 0.20)
    : 0;
  const estimated_charge = Math.round(aboveAllowance * periodicRate);
  // TODO: remove deedInVault/hasVaultDocument once Vault flow writes raw_file_id (D-VAULT-FIELD-MIGRATION)
  const hasDeed = !!(trust.raw_file_id || trust.deedInVault || trust.hasVaultDocument);

  return {
    trust_id:          trust.id || trust.trustId,
    current_value:     currentValue,
    next_periodic_date: nextPeriodDate.toISOString().split('T')[0],
    years_to_next:     Math.round(yearsToNext * 10) / 10,
    rate_calc: {
      notional_transfer:  notionalTransfer,
      cumulative_chargeable: cumCLT,
      rate:               periodicRate,
      after_qualifying_period_relief: 0,
      capped_at_6_pct:    periodicRate >= 0.06 ? estimated_charge : 0,
    },
    estimated_charge,
    exit_charge_pending: null,
    trust_allowance: {
      available:                   trustAllowance,
      used:                        allowanceUsed,
      refreshes_on:                nextPeriodDate.toISOString().split('T')[0],
      headroom_after_contribution: Math.max(0, trustAllowance - allowanceUsed),
    },
    confidence: hasDeed ? 'HIGH' : 'LOW',
    confidence_note: hasDeed ? null : 'Upload trust deed to Vault for accurate periodic-charge computation',
    bundle,
  };
}

export function trustContribution(entity, contribution, trustType = 'discretionary', bundle = 'UK-2026.1') {
  const cumCLT     = entity.estate?.cumulativeCLT || 0;
  const nrbUsed    = Math.min(NRB, cumCLT);
  const nrbRemaining = Math.max(0, NRB - nrbUsed);
  const entry_charge = contribution > nrbRemaining
    ? Math.round((contribution - nrbRemaining) * TR.discretionaryTrust.entryChargeRate)
    : 0;

  const settleDate = new Date();
  const periodicDate = new Date(settleDate);
  periodicDate.setFullYear(periodicDate.getFullYear() + 10);

  const trustAllowance = APR_BPR_ALLOWANCE;

  return {
    trust_type:               trustType,
    contribution,
    cumulative_clt_history:   cumCLT,
    nrb_consumption:          Math.min(contribution, nrbRemaining),
    entry_charge,
    cgt_on_disposal:          0,
    seven_year_status:        trustType === 'discretionary' ? 'CLT' : 'PET',
    estate_removal_pct:       1.0,
    ten_year_periodic_due_at: periodicDate.toISOString().split('T')[0],
    trust_allowance: {
      available:                   trustAllowance,
      used:                        Math.min(trustAllowance, contribution),
      refreshes_on:                periodicDate.toISOString().split('T')[0],
      headroom_after_contribution: Math.max(0, trustAllowance - contribution),
    },
    confidence: _confidence(entity, ['estate']),
    bundle,
  };
}

// ── §8.13 taxAndEstateImpact (DUAL-IMPACT) ────────────────────────────────────

export function taxAndEstateImpact(entity, decision, bundle = 'UK-2026.1') {
  const { type, params = {} } = decision;

  const baseTax   = taxThisYear(entity, 'tax-2026-27', bundle);
  const baseEstate = ihtExposure(entity, bundle);

  let modifiedEntity = { ...entity };

  switch (type) {
    case 'drawdown':
      modifiedEntity = { ...entity, drawdown: params.amount || 0 };
      break;
    case 'gift':
      modifiedEntity = {
        ...entity,
        estate: {
          ...(entity.estate || {}),
          gifts: [...(entity.estate?.gifts || []), { amount: params.amount || 0, date: params.date || new Date().toISOString(), recipient: params.recipient }],
        },
      };
      break;
    case 'salary-sacrifice':
      modifiedEntity = {
        ...entity,
        income: { ...(entity.income || {}), salary: Math.max(0, (entity.income?.salary || 0) - (params.amount || 0)) },
      };
      break;
    case 'bed-and-isa':
      modifiedEntity = {
        ...entity,
        assets: {
          ...(entity.assets || {}),
          isa: { ...(entity.assets?.isa || {}), value: (entity.assets?.isa?.value || 0) + (params.amount || 0), usedThisYear: (entity.assets?.isa?.usedThisYear || 0) + (params.amount || 0) },
          portfolio: { ...(entity.assets?.portfolio || {}), value: Math.max(0, (entity.assets?.portfolio?.value || 0) - (params.amount || 0)) },
        },
      };
      break;
    default:
      break;
  }

  const modTax    = taxThisYear(modifiedEntity, 'tax-2026-27', bundle);
  const modEstate = ihtExposure(modifiedEntity, bundle);

  const itd     = incomeTaxDetail(modifiedEntity, 0, bundle);
  const crossYear = baseEstate.iht_due - modEstate.iht_due > 0 && modTax.total_tax > baseTax.total_tax;
  const crossoverYears = crossYear
    ? Math.round((modTax.total_tax - baseTax.total_tax) / Math.max(1, (baseEstate.iht_due - modEstate.iht_due) / 30))
    : null;

  const insight = crossYear && crossoverYears
    ? `Tax drag +${Math.round((modTax.drag_pct - baseTax.drag_pct) * 100)}pp but IHT exposure -£${Math.round((baseEstate.iht_due - modEstate.iht_due) / 1000)}k. Cross-over: year ${crossoverYears}.`
    : `Tax impact: ${modTax.total_tax > baseTax.total_tax ? '+' : ''}£${Math.round(Math.abs(modTax.total_tax - baseTax.total_tax) / 1000)}k · Estate impact: -£${Math.round(Math.max(0, baseEstate.iht_due - modEstate.iht_due) / 1000)}k IHT.`;

  return {
    tax: {
      marginal_rate:         itd.marginal_rate,
      total_tax_year:        modTax.total_tax,
      drag_pct:              modTax.drag_pct,
      effective_rate:        modTax.effective_rate,
      cgt_now:               modTax.components.cgt,
      dividend_tax_change:   modTax.components.dividend_tax - baseTax.components.dividend_tax,
      nic_change:            modTax.components.nics - baseTax.components.nics,
      allowance_consumption: allowanceTracker(modifiedEntity, 'tax-2026-27', bundle),
    },
    estate: {
      iht_lifetime:          modEstate.iht_due,
      coi_today:             ihtSippDelta(modifiedEntity),
      coi_per_year:          Math.round(ihtSippDelta(modifiedEntity) / 30),
      coi_per_day:           Math.round(ihtSippDelta(modifiedEntity) / (30 * 365)),
      rnrb_position:         rnrbTaper(modifiedEntity, bundle),
      beneficiary_value:     modEstate.beneficiary_value,
      seven_year_clock_status: type === 'gift' ? 'started' : null,
      ten_year_periodic_status: type === 'trust-contribution' ? 'started' : null,
    },
    delta_vs_baseline: {
      tax: {
        total:     modTax.total_tax - baseTax.total_tax,
        drag_pp:   Math.round((modTax.drag_pct - baseTax.drag_pct) * 1000) / 1000,
      },
      estate: {
        iht:        modEstate.iht_due - baseEstate.iht_due,
        beneficiary: modEstate.beneficiary_value - baseEstate.beneficiary_value,
      },
    },
    cross_topic_insight:   insight,
    confidence:            'HIGH',
    warnings:              [],
    language_keys: { cross_topic_insight: `tax_estate.insight.${type}.balanced` },
    bundle,
  };
}

// ── §8.14 nominationStatus (full spec — extends existing fq-calculator version) ─

export function nominationStatus(entity, bundle = 'UK-2026.1') {
  const pensions = entity.assets?.sipp?.pensions || entity.assets?.pensions || [];
  const mapped = pensions.map(p => {
    const staleYears = 3;
    const agingYears = 2;
    let status = 'missing';
    let ageYears = null;
    let stale_flag = true;
    let missing_flag = !p.nominationDate;
    let conflict_flag = false;
    let conflict_reason = null;

    if (p.nominationDate) {
      ageYears = Math.round(_yearsElapsed(p.nominationDate) * 10) / 10;
      status = ageYears > staleYears ? 'stale' : ageYears > agingYears ? 'aging' : 'current';
      stale_flag = ageYears > staleYears;
      missing_flag = false;
    }

    const nominations = p.nominations || (p.nomineePercent !== undefined ? [{ beneficiary: p.nomineeName || 'Unknown', percentage: p.nomineePercent, contingent_id: null }] : []);
    const totalPct = nominations.reduce((s, n) => s + (n.percentage || 0), 0);
    if (nominations.length > 0 && Math.abs(totalPct - 100) > 0.01) {
      conflict_flag = true;
      conflict_reason = `Nomination percentages sum to ${totalPct}% (should be 100%)`;
    }

    return {
      pension_id:    p.id || p.pensionId,
      scheme_name:   p.schemeName || p.name || 'Unknown',
      provider:      p.provider || 'Unknown',
      nominations,
      last_reviewed_at: p.nominationDate || null,
      stale_flag,
      missing_flag,
      conflict_flag,
      conflict_reason,
      age_years:     ageYears,
      status,
    };
  });

  const summary = {
    total:    mapped.length,
    current:  mapped.filter(p => p.status === 'current').length,
    stale:    mapped.filter(p => p.status === 'stale').length,
    missing:  mapped.filter(p => p.missing_flag).length,
    conflict: mapped.filter(p => p.conflict_flag).length,
  };

  return { pensions: mapped, summary, confidence: _confidence(entity, ['assets.sipp']), bundle };
}

// ── §8.15 beneficiaryChain ────────────────────────────────────────────────────

export function beneficiaryChain(entity, scenario = null) {
  const a = entity.assets || {};
  const routes = [];

  // Pension routes via nominations
  (a.sipp?.pensions || a.pensions || []).forEach(p => {
    (p.nominations || []).forEach(n => {
      routes.push({ person: n.beneficiary, asset_type: 'pension', asset_id: p.id, value: (p.value || 0) * (n.percentage / 100), route: 'nomination' });
    });
    if (!(p.nominations || []).length) {
      routes.push({ person: 'Estate', asset_type: 'pension', asset_id: p.id, value: p.value || 0, route: 'estate-no-nomination' });
    }
  });

  // ISA via will
  if (a.isa?.value) {
    const willBenef = entity.estate?.will?.beneficiaries?.[0] || 'Estate';
    routes.push({ person: willBenef, asset_type: 'isa', asset_id: 'isa', value: a.isa.value, route: 'will' });
    if (entity.isCouple) {
      routes.push({ person: 'Spouse (APS)', asset_type: 'isa_aps', asset_id: 'isa_aps', value: a.isa.value, route: 'aps-surviving-spouse' });
    }
  }

  // Property
  if (a.residence?.value) {
    const jointTenancy = a.residence.ownershipType === 'joint-tenancy';
    const person = jointTenancy ? 'Surviving joint owner' : (entity.estate?.will?.beneficiaries?.[0] || 'Estate');
    routes.push({ person, asset_type: 'property', asset_id: 'residence', value: (a.residence.value * (a.residence.ownershipShare || 1)), route: jointTenancy ? 'joint-tenancy' : 'will' });
  }

  // Cash / GIA via will
  if (a.cash?.own || a.portfolio?.value) {
    const willBenef = entity.estate?.will?.beneficiaries?.[0] || 'Estate';
    if (a.cash?.own)       routes.push({ person: willBenef, asset_type: 'cash', asset_id: 'cash', value: a.cash.own, route: 'will' });
    if (a.portfolio?.value) routes.push({ person: willBenef, asset_type: 'gia', asset_id: 'portfolio', value: a.portfolio.value, route: 'will' });
  }

  // Apply scenario
  let scenarioRoutes = routes;
  if (scenario === 'spouse-predeceases') {
    scenarioRoutes = routes.map(r => r.person === 'Surviving joint owner' ? { ...r, person: 'Estate', route: 'estate-spouse-predeceased' } : r);
  }

  // Aggregate by person
  const byPerson = {};
  scenarioRoutes.forEach(r => {
    if (!byPerson[r.person]) byPerson[r.person] = { person: r.person, total_inherited: 0, sources: [] };
    byPerson[r.person].total_inherited += r.value;
    byPerson[r.person].sources.push({ asset_type: r.asset_type, asset_id: r.asset_id, value: r.value, route: r.route });
  });

  const beneficiaries = Object.values(byPerson);
  const total_named   = beneficiaries.filter(b => b.person !== 'Estate').reduce((s, b) => s + b.total_inherited, 0);
  const to_estate     = (byPerson['Estate']?.total_inherited || 0);

  // Conflicts: nomination routes to person X but will routes same asset to person Y
  const conflicts = [];
  const pensionRoutes = routes.filter(r => r.asset_type === 'pension' && r.route === 'nomination');
  const willRoutes    = routes.filter(r => r.route === 'will');
  pensionRoutes.forEach(pr => {
    const conflict = willRoutes.find(wr => wr.asset_id === pr.asset_id);
    if (conflict && conflict.person !== pr.person) {
      conflicts.push({ type: 'nomination-vs-will', asset_id: pr.asset_id, nomination_routes_to: pr.person, will_routes_to: conflict.person });
    }
  });

  return {
    beneficiaries,
    total_passing_to_named: total_named,
    passing_to_estate:      to_estate,
    conflicts,
    scenario_applied:       scenario,
    confidence:             _confidence(entity, ['assets', 'estate']),
  };
}

// ── §8.16 rnrbTaper ──────────────────────────────────────────────────────────

export function rnrbTaper(entity, bundle = 'UK-2026.1') {
  const gross      = ihtExposure(entity, bundle).gross_estate;
  const taperAt    = IHT.residenceNilRateBandTaperStart || 2000000;
  const coupleMulti = entity.isCouple ? 2 : 1;
  const baseRnrb   = RNRB * coupleMulti;
  const transferRnrb = entity.isCouple && entity.spouse?.unusedRNRB ? entity.spouse.unusedRNRB : 0;
  const totalAvail = baseRnrb + transferRnrb;
  const taperLoss  = gross > taperAt ? Math.min(totalAvail, Math.floor((gross - taperAt) / 2)) : 0;
  const netRnrb    = Math.max(0, totalAvail - taperLoss);
  const hasDirDesc  = entity.estate?.directDescendant !== false;
  const downsizeRelief = entity.estate?.downsizeRelief || { eligible: false, amount: 0 };

  const warnings = [];
  if (!hasDirDesc) warnings.push('No direct descendant eligible — RNRB not available');
  if (taperLoss > 0) warnings.push(`RNRB reduced by £${taperLoss.toLocaleString()} due to estate above £${(taperAt / 1000000).toFixed(1)}m threshold`);

  return {
    base_rnrb:              baseRnrb,
    transferable_rnrb:      transferRnrb,
    total_available:        hasDirDesc ? totalAvail : 0,
    estate_value:           gross,
    taper_threshold:        taperAt,
    taper_loss:             taperLoss,
    net_rnrb:               hasDirDesc ? netRnrb : 0,
    direct_descendant_eligible: hasDirDesc,
    downsize_relief:        downsizeRelief,
    warnings,
    confidence:             _confidence(entity, ['estate', 'assets']),
    bundle,
  };
}

// ── §8.17 bprClock + bprQualifyingValue ──────────────────────────────────────

export function bprClock(holding, asAt = new Date(), bundle = 'UK-2026.1') {
  const acqDate  = new Date(holding.acquisitionDate || holding.acquired);
  const elapsed  = _yearsElapsed(acqDate.toISOString());
  const cleared  = elapsed >= 2;
  const monthsLeft = cleared ? 0 : Math.round((2 - elapsed) * 12);
  const isAIM    = holding.type === 'AIM' || holding.isAIM === true;
  const bprRate  = isAIM ? 0.50 : (cleared ? 1.0 : 0);
  const cv       = holding.currentValue || 0;
  const reliefAmt = Math.round(cv * bprRate);
  const exposure  = Math.round(cv * IHT_RATE * (1 - bprRate));

  return {
    holding_id:           holding.id || holding.holdingId,
    acquisition_date:     acqDate.toISOString().split('T')[0],
    as_at:                asAt.toISOString().split('T')[0],
    years_held:           Math.round(elapsed * 10) / 10,
    cleared,
    months_remaining:     monthsLeft,
    bpr_rate:             bprRate,
    current_value:        cv,
    iht_relief_if_cleared: reliefAmt,
    iht_exposure_pre_clear: exposure,
    is_aim:               isAIM,
    warning: !cleared ? `2-year qualifying period not complete — ${monthsLeft} months remaining` : null,
    bundle,
  };
}

export function bprQualifyingValue(entity, bundle = 'UK-2026.1') {
  const holdings = (entity.assets?.portfolio?.holdings || []).filter(h => h.bprTagged || h.isBPR);
  const today = new Date();
  const allowance = APR_BPR_ALLOWANCE;

  const clocks = holdings.map(h => bprClock(h, today, bundle));
  const qualified = clocks.filter(c => c.cleared && !c.is_aim);
  const aim       = clocks.filter(c => c.is_aim);

  const tier1Total    = qualified.reduce((s, c) => s + c.current_value, 0);
  const tier1In100    = Math.min(tier1Total, allowance);
  const tier1Above    = Math.max(0, tier1Total - allowance);
  const aimTotal      = aim.reduce((s, c) => s + c.current_value, 0);
  const allowanceUsed = tier1In100;
  const allowanceLeft = Math.max(0, allowance - allowanceUsed);

  return {
    tier1_100pct:               tier1In100,
    tier2_50pct_above_allowance: tier1Above,
    tier2_50pct_aim_or_not_listed: aimTotal,
    allowance_used:             allowanceUsed,
    allowance_remaining:        allowanceLeft,
    couple_combined_allowance:  entity.isCouple ? APR_BPR_ALLOWANCE * 2 : null,
    clocks,
    confidence:                 _confidence(entity, ['assets.portfolio']),
    bundle,
  };
}

// ── §8.18 selfAssessment + willLpaStatus ──────────────────────────────────────

export function selfAssessment(entity, year = 'tax-2026-27', bundle = 'UK-2026.1') {
  const sa = entity.selfAssessment || {};
  const income = entity.income || {};
  const gross  = _grossIncome(entity);

  const needs_sa = (
    gross > 100000 ||
    (income.selfEmployed || 0) > 1000 ||
    (income.rental || 0) > 2500 ||
    (income.dividends || 0) > 10000 ||
    (income.foreign || 0) > 0 ||
    sa.registered === true
  );

  const deadline   = new Date(`${year.startsWith('tax') ? '20' + year.split('-')[1] : '2027'}-01-31`);
  const daysToFile = Math.ceil((deadline - new Date()) / 86400000);
  const prefillPct = _saPreFill(entity);

  return {
    needs_sa,
    registered:       sa.registered || false,
    deadline_online:  deadline.toISOString().split('T')[0],
    days_to_deadline: daysToFile,
    prefill_pct:      prefillPct,
    prefill_ready:    prefillPct >= 80,
    income_sources:   Object.entries(income).filter(([, v]) => v > 0).map(([k]) => k),
    payments_on_account: (income.selfEmployed || 0) > 0 || (income.rental || 0) > 0,
    confidence:       _confidence(entity, ['income']),
    bundle,
  };
}

function _saPreFill(entity) {
  let score = 0;
  const checks = [
    entity.income?.salary,
    entity.income?.dividends,
    entity.assets?.portfolio,
    entity.assets?.sipp,
    entity.dob,
    entity.taxResidence,
  ];
  checks.forEach(c => { if (c) score += 1; });
  return Math.round((score / checks.length) * 100);
}

export function willLpaStatus(entity) {
  const estate = entity.estate || {};
  const now    = new Date();

  const will = {
    exists:       !!(estate.will?.exists || estate.will?.date),
    last_reviewed: estate.will?.date || null,
    age_years:     estate.will?.date ? Math.round(_yearsElapsed(estate.will.date) * 10) / 10 : null,
    stale_flag:    estate.will?.date ? _yearsElapsed(estate.will.date) > 5 : true,
    missing_flag:  !(estate.will?.exists || estate.will?.date),
    beneficiaries: estate.will?.beneficiaries || [],
  };

  const lpa = {
    property_financial: {
      exists:     !!(estate.lpa?.propertyFinancial),
      registered: !!(estate.lpa?.propertyFinancialRegistered),
      stale_flag: estate.lpa?.propertyFinancialDate ? _yearsElapsed(estate.lpa.propertyFinancialDate) > 10 : true,
    },
    health_welfare: {
      exists:     !!(estate.lpa?.healthWelfare),
      registered: !!(estate.lpa?.healthWelfareRegistered),
      stale_flag: estate.lpa?.healthWelfareDate ? _yearsElapsed(estate.lpa.healthWelfareDate) > 10 : true,
    },
  };

  const flags = [];
  if (will.missing_flag) flags.push('Will missing');
  if (will.stale_flag && !will.missing_flag) flags.push('Will may need review (5+ years old)');
  if (!lpa.property_financial.exists) flags.push('Property & Financial LPA not registered');
  if (!lpa.health_welfare.exists)     flags.push('Health & Welfare LPA not registered');

  return { will, lpa, flags, confidence: _confidence(entity, ['estate']) };
}

// ── §8.19 costOfInaction (FULL — arch master §13.3) ──────────────────────────

export function costOfInaction(entity, bundle = 'UK-2026.1') {
  const today   = new Date();
  const deadline = PENSION_IHT_DATE;
  const daysLeft = Math.max(0, Math.round((deadline - today) / 86400000));

  const baseIHT    = ihtExposure(entity, bundle);
  const totalCoI   = ihtSippDelta(entity);
  const perDay     = daysLeft > 0 ? Math.round(totalCoI / daysLeft) : 0;

  // Per-action savings
  const actions = {};

  // start-drawdown
  const optDD = drawdownMatrix(entity, { from: 0, to: 120000, step: 5000 }, true, false, bundle);
  const recDD  = optDD.recommended_row || 0;
  if (recDD > 0 && (entity.drawdown || 0) < recDD) {
    const withDD = ihtSippDelta({ ...entity, drawdown: recDD });
    actions['start-drawdown'] = { savings: Math.max(0, totalCoI - withDD), deadline_driven: true };
  }

  // gift-to-trust
  const giftSaving = Math.round(Math.min(IHT.annualGiftExemption, totalCoI) * IHT_RATE);
  if (giftSaving > 0) actions['gift-annual-exemption'] = { savings: giftSaving, deadline_driven: false };

  // bpr-positioning
  const bprVal = bprQualifyingValue(entity, bundle);
  if (bprVal.allowance_remaining > 0) {
    const bprSaving = Math.round(bprVal.allowance_remaining * IHT_RATE);
    actions['bpr-positioning'] = { savings: bprSaving, deadline_driven: false };
  }

  // bed-and-isa
  const cgd = cgtDetail(entity, entity.assets?.portfolio?.holdings || [], bundle);
  const bedIsaSaving = cgd.pending.filter(p => p.bed_and_isa_opportunity).reduce((s, p) => s + p.if_sold_today_tax * 0, 0);
  if (bedIsaSaving > 0) actions['bed-and-isa'] = { savings: bedIsaSaving, deadline_driven: false };

  const sortedByPriority = Object.entries(actions)
    .sort(([, a], [, b]) => b.savings - a.savings)
    .map(([id, val]) => ({ id, ...val }));

  return {
    total:             totalCoI,
    per_day:           perDay,
    days_to_deadline:  daysLeft,
    deadline:          deadline.toISOString().split('T')[0],
    byAction:          actions,
    sortedByPriority,
    confidence:        _confidence(entity, ['assets.sipp', 'estate']),
    bundle,
  };
}

// ── §8.16-v1.1 NEW: bprAllowanceTracker ──────────────────────────────────────

export function bprAllowanceTracker(entity, bundle = 'UK-2026.1') {
  const today    = new Date();
  const qv       = bprQualifyingValue(entity, bundle);
  const allowance = APR_BPR_ALLOWANCE;

  // Couple combined
  const coupleMult   = entity.isCouple ? 2 : 1;
  const coupleTotal  = allowance * coupleMult;
  const spouseUsed   = entity.isCouple ? (entity.spouse?.bprAllowanceUsed || 0) : 0;
  const coupleUsed   = qv.allowance_used + spouseUsed;

  // 7-year refresh date for lifetime gifts
  const oldestHolding = (entity.assets?.portfolio?.holdings || [])
    .filter(h => h.bprTagged && h.acquisitionDate)
    .sort((a, b) => new Date(a.acquisitionDate) - new Date(b.acquisitionDate))[0];
  const refreshBase = oldestHolding ? new Date(oldestHolding.acquisitionDate) : today;
  const refreshDate = new Date(refreshBase);
  refreshDate.setFullYear(refreshDate.getFullYear() + 7);

  // Trust allowances
  const trusts = (entity.estate?.trusts || []).map(t => ({
    trust_id:   t.id,
    total:      allowance,
    used:       Math.min(allowance, t.currentValue || 0),
    remaining:  Math.max(0, allowance - (t.currentValue || 0)),
    refreshes_on: (() => {
      const d = new Date(t.settlementDate || today);
      d.setFullYear(d.getFullYear() + 10);
      return d.toISOString().split('T')[0];
    })(),
  }));

  // Transitional gifts
  const TRANSITIONAL = new Date('2024-10-30');
  const transitional = (entity.estate?.gifts || [])
    .filter(g => new Date(g.date || g.giftDate) >= TRANSITIONAL)
    .map(g => ({
      gift_id:  g.id,
      date:     g.date || g.giftDate,
      value:    g.amount,
      in_scope: today >= new Date('2026-04-06'),
    }));

  const ihtExposureNow = ihtExposure(entity, bundle).iht_due;
  const preReformIHT   = (() => {
    const oldBundle = { ...entity, _usePreReformBPR: true };
    return ihtExposureNow + Math.round(qv.tier2_50pct_aim_or_not_listed * IHT_RATE * 0.5);
  })();

  const conf = qv.clocks.every(c => c.cleared)
    ? _confidence(entity, ['assets.portfolio'])
    : 'MED';

  return {
    allowance: {
      individual_total:         allowance,
      individual_used:          qv.allowance_used,
      individual_remaining:     qv.allowance_remaining,
      refreshes_for_lifetime_gifts: refreshDate.toISOString().split('T')[0],
      couple_combined_total:    coupleTotal,
      couple_combined_used:     coupleUsed,
      couple_combined_remaining: Math.max(0, coupleTotal - coupleUsed),
      transferable_on_first_death: entity.isCouple,
    },
    holdings_tier1:                    qv.clocks.filter(c => c.cleared && !c.is_aim),
    holdings_tier2_above_allowance:    qv.clocks.filter(c => c.cleared && !c.is_aim && c.current_value > qv.allowance_remaining),
    holdings_tier2_aim_or_not_listed:  qv.clocks.filter(c => c.is_aim),
    iht_exposure_summary: {
      if_died_today:        ihtExposureNow,
      pre_reform_comparison: preReformIHT,
      delta:                ihtExposureNow - preReformIHT,
    },
    trust_allowances:  trusts,
    transitional_gifts: transitional,
    confidence:        conf,
    provenance: { holdings: 'entity.assets.portfolio.holdings', trusts: 'entity.estate.trusts', gifts: 'entity.estate.gifts' },
    bundle,
  };
}

// ── §8.20 ihtProjection — year-by-year IHT exposure over a horizon ────────────

/**
 * Projects IHT exposure year by year, applying asset growth, the annual gift
 * exemption, and the pension phase-in on 6 Apr 2027.
 *
 * @param {object} entity
 * @param {number} horizonYears  — number of years to project (default 10)
 * @returns {Array<{year, estateValue, ihtDue, pensionIncluded, gifts, netEstate}>}
 */
export function ihtProjection(entity, horizonYears = 10) {
  const a           = _assetVals(entity);
  const growthRate  = entity.expectedReturn ?? 0.04;
  const annualGift  = IHT.annualGiftExemption || 3000;
  const hasRNRB     = !!(entity.assets?.residence?.value || (entity.assets?.property || []).length) &&
                      entity.estate?.directDescendant !== false;

  // NRB (static for projection — thresholds frozen per current policy)
  const nrb  = NRB  * (entity.isCouple ? 2 : 1);
  const baseRnrb = hasRNRB ? RNRB * (entity.isCouple ? 2 : 1) : 0;

  // RNRB taper threshold (£2m; tapers to £0 at £2.35m single / £2.7m couple)
  const rnrbTaperThreshold = IHT.residenceNilRateBandTaperStart || 2000000;

  // BPR: pre-compute qualifying value once (holdings don't change year-to-year in projection)
  const bprResult  = bprQualifyingValue(entity);
  const bprRelief  = bprResult.tier1_100pct +
                     Math.round(bprResult.tier2_50pct_above_allowance * 0.5) +
                     Math.round(bprResult.tier2_50pct_aim_or_not_listed * 0.5);

  // Gift deduction: only apply if entity actually plans gifts
  const hasGifts        = (entity.annualGifts || 0) > 0 || (entity.plannedGifts || 0) > 0;
  const annualGiftDeduction = hasGifts ? annualGift : 0;

  // Base estate excluding pension (pension added from 2027)
  const basePre2027 = a.property + a.isa + a.gia + a.cash;
  const sipp        = a.sipp;

  const currentYear = new Date().getFullYear();
  const rows = [];

  let runningEstate = basePre2027;        // non-pension assets, compounding
  let runningSipp   = sipp;               // pension, compounding separately

  for (let i = 0; i < horizonYears; i++) {
    const year = currentYear + i;

    // Apply growth for years after the first
    if (i > 0) {
      runningEstate *= (1 + growthRate);
      runningSipp   *= (1 + growthRate);
    }

    // Pension phase-in: included from April 2027
    const pensionIncluded = year >= PENSION_IHT_DATE.getFullYear();
    const sippInEstate    = pensionIncluded ? runningSipp : 0;

    // Gross estate before gifts
    const grossEstate = Math.max(0, runningEstate + sippInEstate);

    // Gift deduction: actual if planned, else headroom (not assumed)
    const gifts     = annualGiftDeduction;
    const netEstate = Math.max(0, grossEstate - gifts);

    // RNRB taper: reduce by £1 per £2 over £2m threshold (mirrors ihtExposure pattern)
    let rnrb = baseRnrb;
    if (hasRNRB && grossEstate > rnrbTaperThreshold) {
      rnrb = Math.max(0, baseRnrb - Math.floor((grossEstate - rnrbTaperThreshold) / 2));
    }

    // IHT calc — deduct NRB, tapered RNRB, and BPR relief
    const taxable = Math.max(0, netEstate - nrb - rnrb - bprRelief);
    const ihtDue  = Math.round(taxable * IHT_RATE);

    rows.push({
      year,
      estateValue:      Math.round(grossEstate),
      ihtDue,
      pensionIncluded,
      gifts,
      giftHeadroom:     hasGifts ? 0 : annualGift,
      netEstate:        Math.round(netEstate),
      rnrb:             Math.round(rnrb),
      bprRelief:        Math.round(bprRelief),
    });

    // Subtract gift from running estate for next year (only if actually giving)
    if (hasGifts) runningEstate = Math.max(0, runningEstate - annualGift);
  }

  return rows;
}
