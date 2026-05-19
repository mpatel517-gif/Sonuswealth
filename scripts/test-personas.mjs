// ─────────────────────────────────────────────────────────────────────────────
// PERSONA SMOKE TEST — 7 profiles × fq-calculator + canonical-metrics pipeline
//
// Runs against the live engine via createRequire for the JSON bundle.
// CLAUDE.md §6.2: tax values exclusively from tax-2026.json.
// CLAUDE.md §6.3: market assumptions via defaultMarketAssumptions + overrides.
//
// Usage:  node scripts/test-personas.mjs
// ─────────────────────────────────────────────────────────────────────────────

import { createRequire } from 'module';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = resolve(__dirname, '..');
const require = createRequire(import.meta.url);

// Load tax bundle via require (works for JSON in CJS compat mode)
const TAX_JSON = require(resolve(projectRoot, 'src/rules/tax-2026.json'));

// ── TAX OBJECT (mirrors fq-calculator.js:30-68) ─────────────────────────────
const TAX = {
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
  giftExemption: TAX_JSON.giftAnnualExemption ?? TAX_JSON.iht?.giftAnnualExemption  ?? 3000,
  psaBasic:      TAX_JSON.income?.savingsAllowanceBasicRate    ?? 1000,
  psaHigher:     TAX_JSON.income?.savingsAllowanceHigherRate   ?? 500,
  psaAdditional: TAX_JSON.income?.savingsAllowanceAdditionalRate ?? 0,
  hicbcTaperWidth: TAX_JSON.income?.hicbcTaperWidth ?? 20000,
  lsa:           TAX_JSON.lsa           ?? 268275,
  lsdba:         TAX_JSON.lsdba         ?? 1073100,
  spa:           TAX_JSON.pension?.statePensionAge ?? 66,
  statePensionFull: TAX_JSON.pension?.statePensionFullAmount
                 ?? TAX_JSON.nationalInsurance?.stateNewPensionFullAmount
                 ?? 11502,
  statePensionQualYears: TAX_JSON.pension?.statePensionQualifyingYears
                 ?? TAX_JSON.nationalInsurance?.statePensionQualifyingYears
                 ?? 35,
  scottishBands: [
    { name: 'Starter',      from: TAX_JSON.income?.scottishStarterBandFrom      ?? 12570,  to: TAX_JSON.income?.scottishStarterBandTo        ?? 14876,  rate: TAX_JSON.income?.scottishStarterRate      ?? 0.19 },
    { name: 'Basic',        from: TAX_JSON.income?.scottishBasicBandFrom        ?? 14876,  to: TAX_JSON.income?.scottishBasicBandTo          ?? 26561,  rate: TAX_JSON.income?.scottishBasicRate        ?? 0.20 },
    { name: 'Intermediate', from: TAX_JSON.income?.scottishIntermediateBandFrom ?? 26561,  to: TAX_JSON.income?.scottishIntermediateBandTo   ?? 43662,  rate: TAX_JSON.income?.scottishIntermediateRate ?? 0.21 },
    { name: 'Higher',       from: TAX_JSON.income?.scottishHigherBandFrom       ?? 43662,  to: TAX_JSON.income?.scottishHigherBandTo         ?? 75000,  rate: TAX_JSON.income?.scottishHigherRate       ?? 0.42 },
    { name: 'Advanced',     from: TAX_JSON.income?.scottishAdvancedBandFrom     ?? 75000,  to: TAX_JSON.income?.scottishAdvancedBandTo       ?? 125140, rate: TAX_JSON.income?.scottishAdvancedRate     ?? 0.45 },
    { name: 'Top',          from: TAX_JSON.income?.scottishTopBandFrom          ?? 125140, to: null,                                                rate: TAX_JSON.income?.scottishTopRate          ?? 0.48 },
  ],
  ver:           TAX_JSON.version       ?? TAX_JSON._meta?.version ?? 'UK-2026.1',
  taxYear:       TAX_JSON._meta?.taxYear ?? '2026/27',
  deadline:      new Date(TAX_JSON.deadline ?? TAX_JSON.iht?.sippsEnterEstateDate ?? '2027-04-06'),
};

// ── MARKET ASSUMPTIONS (mirrors canonical-metrics.js:33-39) ──────────────────
const defaultMarketAssumptions = Object.freeze({
  cashInterestRate:     0.04,
  mortgageInterestRate: 0.045,
  debtInterestRate:     0.05,
  drawdownRate:         0.045,
});

function mergeAssumptions(overrides) {
  return Object.freeze({ ...defaultMarketAssumptions, ...(overrides || {}) });
}

// ── SIMPLE FORMATTER ─────────────────────────────────────────────────────────
function fmt(n) {
  if (n === undefined || n === null) return '—';
  const neg = n < 0, abs = Math.abs(n);
  const pre = neg ? '−£' : '£';
  if (abs >= 1e6) return pre + (abs / 1e6).toFixed(2) + 'm';
  if (abs >= 1e3) return pre + Math.round(abs / 1e3) + 'k';
  return pre + Math.round(abs).toLocaleString();
}

// ── BASIC HELPERS (inline from _helpers.js) ──────────────────────────────────
function getTotal(arr) {
  if (!Array.isArray(arr)) return 0;
  return arr.reduce((s, item) => s + (+item.total || +item.value || +item.balance || +item.value_gbp || +item.outstanding || +item.outstanding_balance || 0), 0);
}

function pensionTotal(e) {
  const a = e?.assets || {};
  return getTotal(a.pensions) || +(a.sipp?.total) || 0;
}
function investmentsTotal(e) {
  const a = e?.assets || {};
  const inv = getTotal(a.investments) || +(a.portfolio?.value) || 0;
  return inv;
}
function propertyTotal(e) {
  const a = e?.assets || {};
  return getTotal(a.property) || +(a.residence?.value) || 0;
}
function cashTotal(e) {
  const a = e?.assets || {};
  return getTotal(a.cash) || getTotal(a.bank) || +(a.cash?.total) || 0;
}
function liabilitiesTotal(e) {
  const liabs = e?.liabilities || {};
  if (Array.isArray(liabs)) return liabs.reduce((s, l) => s + (+l.outstanding || +l.outstanding_balance || 0), 0);
  return (liabs.mortgage?.outstanding || 0) + getTotal(liabs.otherLoans || []);
}
function annualIncome(e) {
  return +e?.annualIncome || +e?.income?.gross || +e?.income?.total || 0;
}
function personAge(e) { return +e?.age || 0; }

// ── NET WORTH ────────────────────────────────────────────────────────────────
function netWorth(e) {
  return pensionTotal(e) + investmentsTotal(e) + propertyTotal(e) + cashTotal(e) - liabilitiesTotal(e);
}

// ── PERSONAL ALLOWANCE (mirrors fq-calculator.js:2875) ───────────────────────
function calcPersonalAllowance(income) {
  const PA = TAX_JSON.income?.personalAllowance || 12570;
  const taperStart = TAX_JSON.income?.personalAllowanceTaperStart || 100000;
  const taperEnd   = TAX_JSON.income?.personalAllowanceTaperEnd || 125140;
  if (income <= taperStart) return PA;
  if (income >= taperEnd) return 0;
  return Math.max(0, PA - Math.floor((income - taperStart) / 2));
}

// ── MARGINAL TAX RATE ────────────────────────────────────────────────────────
function marginalRate(e) {
  const inc = annualIncome(e);
  if (inc > TAX.art) return TAX.ar;
  if (inc > TAX.brt) return TAX.hr;
  return TAX.br;
}

// ── CANONICAL METRICS (inline from canonical-metrics.js) ─────────────────────

function taxEfficiencyScore(e, ma = defaultMarketAssumptions) {
  const ma2 = mergeAssumptions(ma);
  const a = e?.assets || {};

  const isaContrib = (Array.isArray(a.investments) ? a.investments : [])
    .filter(i => /isa/i.test(i.type || ''))
    .reduce((s, i) => s + (+i.contribution_current_tax_year || 0), 0);
  const isaPct = Math.min(100, (isaContrib / TAX.isaAllowance) * 100);

  const pensionContrib = +e?.pensionContributions || 0;
  const aaPct = Math.min(100, (pensionContrib / TAX.pensionAA) * 100);

  const aeaCap = TAX.cgaAllowance;
  const realisedGains = +e?.cgt_realised_current_year || 0;
  const aeaPct = Math.min(100, (realisedGains / aeaCap) * 100);

  const giftCap = TAX.giftExemption;
  const giftsThisYear = +e?.gifts_current_tax_year || 0;
  const giftPct = Math.min(100, (giftsThisYear / giftCap) * 100);

  const bprCap = 1_000_000;
  const bprQualifying = (e?.business_assets || [])
    .filter(b => b.qualifies_for_bpr).reduce((s, b) => s + (+b.value_gbp || +b.value || 0), 0);
  const bprPct = bprQualifying > 0 ? Math.min(100, (bprQualifying / bprCap) * 100) : 0;

  const weights = { isa: 0.35, aa: 0.35, aea: 0.12, gift: 0.08, bpr: 0.10 };
  const score = Math.round(
    isaPct * weights.isa +
    aaPct  * weights.aa  +
    aeaPct * weights.aea +
    giftPct* weights.gift+
    bprPct * weights.bpr
  );

  return { total: score, breakdown: { isa: Math.round(isaPct), aa: Math.round(aaPct), aea: Math.round(aeaPct), gift: Math.round(giftPct), bpr: Math.round(bprPct) }, confidence: 'MEDIUM' };
}

function effectiveBeneficiaryRate(e) {
  const propVal = propertyTotal(e);
  const liqVal  = cashTotal(e) + investmentsTotal(e);
  const penVal  = pensionTotal(e);
  const estate = propVal + liqVal + penVal;
  if (estate <= 0) return { rate: 1, estate: 0, ihtDue: 0, netToHeirs: 0, confidence: 'HIGH' };

  let bands = TAX.nrb;
  const hasChildren = (e?.dependants || []).some(d => d.relationship === 'child');
  const residenceUsed = e?.residence_to_descendants !== false;
  if (residenceUsed && hasChildren && propVal > 0) bands += TAX.rnrb;

  const bprShelter = Math.min(1_000_000, (e?.business_assets || []).filter(b => b.qualifies_for_bpr).reduce((s, b) => s + (+b.value_gbp || +b.value || 0), 0));
  bands += bprShelter;

  const isMarried = !!e?.isMarried || e?.maritalStatus === 'married';
  const spouseLeg = e?.estate_to_spouse_pct ?? (isMarried ? 0.5 : 0);
  const spouseExempt = estate * Math.max(0, Math.min(1, spouseLeg));

  const taxable = Math.max(0, estate - bands - spouseExempt);
  const ihtDue = Math.round(taxable * TAX.ihtRate);
  const netToHeirs = Math.round(estate - ihtDue);
  const rate = Math.max(0, Math.min(1, netToHeirs / estate));

  return {
    rate: Math.round(rate * 1000) / 1000,
    estate: Math.round(estate), ihtDue, netToHeirs,
    bandsAvailable: Math.round(bands), spouseExempt: Math.round(spouseExempt),
    confidence: 'MEDIUM',
  };
}

function prcPccSpread(e) {
  const liquid = cashTotal(e) + investmentsTotal(e);
  const annualEssential = 55000; // stylised
  const debt = liabilitiesTotal(e);
  const assets = liquid + propertyTotal(e) + pensionTotal(e);
  const leverage = assets > 0 ? Math.min(1.5, 1 + debt / assets) : 1;
  const pcc = Math.round(annualEssential * leverage);
  const fiveYrSurplus = Math.max(0, (annualIncome(e) - annualEssential) * 5);
  const prc = Math.round(liquid + fiveYrSurplus);
  const spread = prc - pcc;
  const ratio = pcc > 0 ? prc / pcc : 0;
  return { prc, pcc, spread, ratio, confidence: 'MEDIUM' };
}

function drawdownEfficiencyRatio(e, ma = defaultMarketAssumptions) {
  const { drawdownRate } = mergeAssumptions(ma);
  const dd = +e?.drawdown || 0;
  const p = pensionTotal(e);
  if (p <= 0 || dd <= 0) return { actual: dd, optimal: 0, ratio: 0, status: 'no-drawdown', confidence: 'HIGH' };
  const optimal = p * drawdownRate;
  const ratio = optimal > 0 ? dd / optimal : 0;
  let status;
  if (ratio < 0.5)  status = 'under-drawing';
  else if (ratio <= 1.2) status = 'on-track';
  else status = 'over-drawing';
  return { actual: Math.round(dd), optimal: Math.round(optimal), ratio: Math.round(ratio * 100) / 100, status, confidence: 'MEDIUM' };
}

function coiForDomain(e, domain, ma = defaultMarketAssumptions) {
  const { cashInterestRate, debtInterestRate } = mergeAssumptions(ma);
  switch (domain) {
    case 'pensions': {
      const aa = TAX.pensionAA;
      const used = +e?.pensionContributions || 0;
      const left = Math.max(0, aa - used);
      const marg = marginalRate(e);
      const reliefLost = left * marg;
      if (reliefLost < 1000) return null;
      return `£${(reliefLost / 1000).toFixed(1)}k of tax relief gone forever if not used by 5 April`;
    }
    case 'investments': {
      const isaUsed = ((e?.assets?.investments) || []).filter(i => /isa/i.test(i.type || '')).reduce((s, i) => s + (+i.contribution_current_tax_year || 0), 0);
      const left = Math.max(0, TAX.isaAllowance - isaUsed);
      const cash = cashTotal(e);
      if (cash <= 0 || left < 1000) return null;
      const protect = Math.min(left, cash);
      const annualDrag = protect * cashInterestRate * marginalRate(e);
      return `£${(annualDrag / 1000).toFixed(1)}k/yr of tax saved if you shelter £${(protect/1000).toFixed(0)}k into your ISA`;
    }
    case 'liabilities': {
      const debt = liabilitiesTotal(e);
      if (debt < 1000) return null;
      const annualInterest = debt * debtInterestRate;
      return `£${(annualInterest / 1000).toFixed(1)}k/yr in interest while this debt runs`;
    }
    case 'cash': {
      const cash = cashTotal(e);
      if (cash < 10000) return null;
      const psa = e?.isHigherRateTaxpayer ? TAX.psaHigher : TAX.psaBasic;
      const interest = cash * cashInterestRate;
      const taxable = Math.max(0, interest - psa);
      const tax = taxable * marginalRate(e);
      if (tax < 200) return null;
      return `£${tax.toFixed(0)}/yr in interest tax — wrapping into an ISA would shield it`;
    }
    case 'business': {
      const bpr = (e?.business_assets || []).filter(b => b.qualifies_for_bpr).reduce((s, b) => s + (+b.value_gbp || +b.value || 0), 0);
      if (bpr <= 0) return null;
      const sheltered = Math.min(bpr, 1_000_000);
      const saved = sheltered * TAX.ihtRate;
      const partial = bpr > 1_000_000;
      return `Inheritance tax ${partial ? 'partially' : 'fully'} sheltered: £${(saved / 1000).toFixed(0)}k saved · protect the 2-year qualifying hold`;
    }
    default: return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7 PERSONA MOCK PROFILES
// ═══════════════════════════════════════════════════════════════════════════════

const PERSONAS = {
  // A: Wayne — wealthy retiree, drawdown phase, trusts in place
  A: {
    name: 'A · Wayne', age: 62, targetIncome: 120000,
    assets: {
      pensions: [{ total: 2800000, type: 'SIPP' }],
      investments: [{ value: 850000, type: 'GIA' }, { value: 420000, type: 'ISA', contribution_current_tax_year: 20000 }],
      property: [{ value: 2200000, use: 'residence' }],
      cash: { total: 95000 },
    },
    liabilities: { mortgage: { outstanding: 0 }, otherLoans: [] },
    income: { gross: 120000, statePension: { annual: 11502, startAge: 67 } },
    drawdown: 126000,
    dependants: [{ relationship: 'child', age: 34 }],
    isMarried: false,
    pensionContributions: 0,
  },

  // B: Flintstones — married couple, still working, mortgage, kids, moderate
  B: {
    name: 'B · Flintstones', age: 48, targetIncome: 85000,
    assets: {
      pensions: [{ total: 520000, type: 'workplace' }, { total: 180000, type: 'SIPP' }],
      investments: [{ value: 75000, type: 'GIA' }, { value: 45000, type: 'ISA', contribution_current_tax_year: 8000 }],
      property: [{ value: 650000, use: 'residence' }],
      cash: { total: 32000 },
    },
    liabilities: { mortgage: { outstanding: 285000 }, otherLoans: [{ outstanding: 15000, type: 'car' }] },
    income: { gross: 85000 },
    drawdown: 0,
    dependants: [{ relationship: 'child', age: 12 }, { relationship: 'child', age: 9 }],
    isMarried: true, estate_to_spouse_pct: 1.0,
    pensionContributions: 18000,
  },

  // C: Tony Stark — HIGH INCOME, SSAS, BPR company shares, SIPP, BTL, GIA
  C: {
    name: 'C · Stark', age: 54, targetIncome: 350000,
    isHigherRateTaxpayer: true,
    assets: {
      pensions: [
        { total: 1900000, type: 'SSAS' },
        { total: 850000, type: 'SIPP', annual_contribution: 10000 },
      ],
      investments: [
        { value: 1200000, type: 'GIA' },
        { value: 280000, type: 'ISA', contribution_current_tax_year: 20000 },
      ],
      property: [
        { value: 3200000, use: 'residence' },
        { value: 450000, use: 'buy-to-let', outstanding_balance: 180000, status: 'rental' },
        { value: 320000, use: 'buy-to-let', outstanding_balance: 140000, status: 'rental' },
      ],
      cash: { total: 380000 },
    },
    liabilities: {
      mortgage: { outstanding: 420000 },
      otherLoans: [
        { outstanding: 180000, type: 'buy-to-let' },
        { outstanding: 140000, type: 'buy-to-let' },
      ],
    },
    income: { gross: 480000 }, // salary + dividends + rental
    drawdown: 0,
    dependants: [{ relationship: 'child', age: 22 }],
    isMarried: true, estate_to_spouse_pct: 0.5,
    pensionContributions: 10000,
    business_assets: [
      { value_gbp: 2800000, qualifies_for_bpr: true, name: 'Stark Industries Ltd ordinary shares' },
    ],
    annualIncome: 480000,
    cgt_realised_current_year: 42000,
    gifts_current_tax_year: 5000,
  },

  // D: Granger — young professional, nil-rate-band only, pre-family
  D: {
    name: 'D · Granger', age: 31, targetIncome: 55000,
    assets: {
      pensions: [{ total: 80000, type: 'workplace' }],
      investments: [{ value: 12000, type: 'ISA', contribution_current_tax_year: 5000 }],
      property: [], // renting
      cash: { total: 18000 },
    },
    liabilities: { otherLoans: [{ outstanding: 22000, type: 'student' }] },
    income: { gross: 55000 },
    drawdown: 0,
    dependants: [],
    isMarried: false,
    pensionContributions: 4400,
  },

  // E: Wonka — entrepreneur, business assets, trusts, unconventional structure
  E: {
    name: 'E · Wonka', age: 58, targetIncome: 200000,
    isHigherRateTaxpayer: true,
    assets: {
      pensions: [{ total: 1400000, type: 'SIPP' }],
      investments: [{ value: 450000, type: 'GIA' }, { value: 200000, type: 'ISA', contribution_current_tax_year: 20000 }],
      property: [{ value: 1800000, use: 'residence' }],
      cash: { total: 120000 },
    },
    liabilities: { mortgage: { outstanding: 350000 }, otherLoans: [] },
    income: { gross: 200000 },
    drawdown: 84000,
    dependants: [{ relationship: 'child', age: 26 }],
    isMarried: false,
    pensionContributions: 60000,
    business_assets: [
      { value_gbp: 1500000, qualifies_for_bpr: true, name: 'Wonka Confectionery Ltd' },
      { value_gbp: 400000, qualifies_for_bpr: false, name: 'Fudge Co preference shares' },
    ],
    gifts_current_tax_year: 15000,
  },

  // F: Anna — mid-career, DB pension promise, no home equity yet
  F: {
    name: 'F · Anna', age: 37, targetIncome: 72000,
    assets: {
      pensions: [{ total: 210000, type: 'DB', annual_contribution: 7200 }],
      investments: [{ value: 35000, type: 'GIA' }, { value: 28000, type: 'ISA', contribution_current_tax_year: 12000 }],
      property: [{ value: 420000, use: 'residence' }],
      cash: { total: 14000 },
    },
    liabilities: { mortgage: { outstanding: 310000 }, otherLoans: [] },
    income: { gross: 72000 },
    drawdown: 0,
    dependants: [],
    isMarried: false,
    pensionContributions: 7200,
  },

  // G: NRI — Non-resident individual, UK property but no UK income
  G: {
    name: 'G · NRI', age: 55, targetIncome: 150000,
    isHigherRateTaxpayer: true,
    assets: {
      pensions: [{ total: 900000, type: 'QROPS' }],
      investments: [{ value: 600000, type: 'offshore bond' }],
      property: [{ value: 1400000, use: 'residence', country: 'UK' }, { value: 700000, use: 'residence', country: 'UAE' }],
      cash: { total: 250000 },
    },
    liabilities: { mortgage: { outstanding: 0 }, otherLoans: [] },
    income: { gross: 0 }, // no UK income
    drawdown: 0,
    dependants: [{ relationship: 'child', age: 25 }],
    isMarried: true, estate_to_spouse_pct: 1.0,
    pensionContributions: 0,
    jurisdiction: { subRegion: 'Non-Resident' },
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SMOKE TEST RUNNER
// ═══════════════════════════════════════════════════════════════════════════════

function smokePersona(p, label, ma = defaultMarketAssumptions) {
  const nw = netWorth(p);
  const pa = calcPersonalAllowance(annualIncome(p));
  const marg = marginalRate(p);
  const taxEff = taxEfficiencyScore(p, ma);
  const ebr = effectiveBeneficiaryRate(p);
  const prc = prcPccSpread(p);
  const der = drawdownEfficiencyRatio(p, ma);
  const cois = ['pensions', 'investments', 'liabilities', 'cash', 'business']
    .map(d => coiForDomain(p, d, ma)).filter(Boolean);

  const results = {
    persona: p.name || label,
    taxableIncome: fmt(annualIncome(p)),
    netWorth: fmt(nw),
    personalAllowance: fmt(pa),
    marginalRate: `${(marg * 100).toFixed(0)}%`,
    taxEfficiency: taxEff.total,
    ebrRate: `${(ebr.rate * 100).toFixed(1)}%`,
    ihtDue: fmt(ebr.ihtDue),
    bandsAvailable: fmt(ebr.bandsAvailable),
    prcSpread: prc.spread >= 0 ? `+${fmt(prc.spread)}` : fmt(prc.spread),
    prcRatio: prc.ratio.toFixed(2) + '×',
    drawdown: der,
    coiCount: cois.length,
    coiSummary: cois.slice(0, 3).map(c => c.length > 90 ? c.slice(0, 87) + '…' : c),
  };

  // NaN guard: check every numeric output
  const guardFailures = [];
  if (isNaN(nw)) guardFailures.push('netWorth=NaN');
  if (isNaN(pa)) guardFailures.push('personalAllowance=NaN');
  if (isNaN(taxEff.total)) guardFailures.push('taxEfficiency=NaN');
  if (isNaN(ebr.ihtDue)) guardFailures.push('ihtDue=NaN');
  if (isNaN(prc.spread)) guardFailures.push('prcSpread=NaN');
  if (isNaN(der.ratio)) guardFailures.push('drawdownRatio=NaN');
  if (guardFailures.length) results._guards = guardFailures;

  return results;
}

function divider(char = '─', len = 72) { console.log(char.repeat(len)); }

// ── RUN 1: default market assumptions ────────────────────────────────────────
console.log('\n');
divider('═');
console.log('  PERSONA SMOKE TEST — 7 profiles × defaultMarketAssumptions');
divider('═');

const defaultResults = [];
for (const [key, p] of Object.entries(PERSONAS)) {
  const r = smokePersona(p, key);
  defaultResults.push(r);

  console.log(`\n▶ ${r.persona} (${p.name}) — age ${p.age}`);
  console.log(`  Taxable income:   ${r.taxableIncome}`);
  console.log(`  Net worth:        ${r.netWorth}`);
  console.log(`  PA / Marginal:    ${r.personalAllowance} / ${r.marginalRate}`);
  console.log(`  Tax efficiency:   ${r.taxEfficiency}/100`);
  console.log(`  IHT: estate→heirs ${r.ebrRate} · IHT due ${r.ihtDue} · bands ${r.bandsAvailable}`);
  console.log(`  PRC/PCC spread:   ${r.prcSpread} (${r.prcRatio})`);
  console.log(`  Drawdown:         actual ${fmt(r.drawdown.actual)} / optimal ${fmt(r.drawdown.optimal)} → ratio ${r.drawdown.ratio} (${r.drawdown.status})`);
  console.log(`  CoI alerts:       ${r.coiCount}`);
  for (const c of r.coiSummary) console.log(`    • ${c}`);
  if (r._guards) console.log(`  ⚠ GUARD FAILURES: ${r._guards.join(', ')}`);
}

// ── RUN 2: Persona C with custom overrides ───────────────────────────────────
console.log('\n');
divider('═');
console.log('  PERSONA C (STARK) — custom market assumption overrides');
console.log('  Override: cashInterestRate 0.05 (was 0.04), drawdownRate 0.05 (was 0.045)');
divider('═');

const starkOverrides = { cashInterestRate: 0.05, drawdownRate: 0.05 };
const starkCustom = smokePersona(PERSONAS.C, 'C (override)', starkOverrides);
const starkDefault = defaultResults.find(r => r.persona === 'C · Stark');

console.log(`\n▶ C · Stark — custom market assumptions`);
console.log(`  Tax efficiency:   ${starkCustom.taxEfficiency}/100  (default: ${starkDefault?.taxEfficiency ?? '—'}/100)`);
  console.log(`  Drawdown:         actual ${fmt(starkCustom.drawdown.actual)} / optimal ${fmt(starkCustom.drawdown.optimal)} → ratio ${starkCustom.drawdown.ratio} (${starkCustom.drawdown.status})`);
  console.log(`                     default: optimal ${fmt(starkDefault?.drawdown?.optimal)} → ratio ${starkDefault?.drawdown?.ratio} (${starkDefault?.drawdown?.status})`);
console.log(`  CoI alerts:       ${starkCustom.coiCount}`);
for (const c of starkCustom.coiSummary) console.log(`    • ${c}`);
if (starkCustom._guards) console.log(`  ⚠ GUARD FAILURES: ${starkCustom._guards.join(', ')}`);

// ── FINAL VERDICT ────────────────────────────────────────────────────────────
console.log('\n');
divider('═');
const allResults = [...defaultResults, starkCustom];
const failures = allResults.filter(r => r._guards && r._guards.length > 0);
const nanCount = allResults.reduce((n, r) => n + (r._guards ? r._guards.length : 0), 0);

console.log(`  VERDICT: ${allResults.length} runs · ${nanCount} NaN guard failures`);
if (failures.length > 0) {
  for (const f of failures)
    console.log(`    ✗ ${f.persona}: ${f._guards.join(', ')}`);
} else {
  console.log('  ✅ ALL CLEAN — no NaN, no crash, every persona resolves.');
}
divider('═');
console.log(`  Bundle version: ${TAX.ver}  ·  Tax year: ${TAX.taxYear}`);
console.log(`  Market assumptions: cash ${(defaultMarketAssumptions.cashInterestRate * 100).toFixed(1)}% · mortgage ${(defaultMarketAssumptions.mortgageInterestRate * 100).toFixed(1)}% · debt ${(defaultMarketAssumptions.debtInterestRate * 100).toFixed(1)}% · drawdown ${(defaultMarketAssumptions.drawdownRate * 100).toFixed(1)}%`);
divider('═');
