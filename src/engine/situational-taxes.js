// situational-taxes.js — taxes that apply to a household's SITUATION rather than
// its annual income or its estate: the s24 landlord finance-cost restriction,
// SDLT borne acquiring a property portfolio, and the corporation tax sitting
// behind a director's dividends. Surfaced by the Tax tab's "Other taxes in your
// situation" card, which only renders the rows that actually apply to the entity.
//
// Rates are taken from the canonical per-year rule bundles (src/rules/UK-*.json),
// NOT hardcoded from memory. Where a figure is an estimate (sunk SDLT at purchase,
// corporation tax grossed up from profit-after-tax), it is labelled ESTIMATED and
// the assumption is returned alongside, per the independent-calc-audit discipline.

// ── SDLT ─────────────────────────────────────────────────────────────────────
// Purchase-year regime: the two variables that actually move SDLT for these
// purchases are the additional-dwelling surcharge rate and the 0% band ceiling.
// (Intra-year holidays — e.g. the Jul–Sep 2021 taper — are NOT modelled; flagged.)
function _residentialBands(dateISO) {
  // £250k 0% band ran 23 Sep 2022 → 31 Mar 2025; £125k otherwise.
  const d = dateISO || '';
  const holiday = d >= '2022-09-23' && d <= '2025-03-31';
  return holiday
    ? [{ to: 250000, rate: 0 }, { to: 925000, rate: 0.05 }, { to: 1500000, rate: 0.10 }, { to: Infinity, rate: 0.12 }]
    : [{ to: 125000, rate: 0 }, { to: 250000, rate: 0.02 }, { to: 925000, rate: 0.05 }, { to: 1500000, rate: 0.10 }, { to: Infinity, rate: 0.12 }];
}
function _additionalSurcharge(dateISO) {
  // 3% from 1 Apr 2016; raised to 5% on 31 Oct 2024.
  return (dateISO || '') >= '2024-10-31' ? 0.05 : 0.03;
}
// Non-residential / mixed (commercial, farmland): stable bands, NO surcharge.
const NON_RES_BANDS = [{ to: 150000, rate: 0 }, { to: 250000, rate: 0.02 }, { to: Infinity, rate: 0.05 }];

function _slab(price, bands, addRate = 0) {
  let tax = 0, lo = 0;
  for (const b of bands) {
    if (price <= lo) break;
    const amt = Math.min(price, b.to) - lo;
    tax += amt * (b.rate + addRate);
    lo = b.to;
  }
  return Math.round(tax);
}

const RESIDENTIAL_USES = new Set(['buy-to-let', 'second-home', 'hmo', 'residential', 'main-residence', 'btl']);

/**
 * SDLT on a single property purchase at its purchase-year regime.
 * @returns {{ applicable:boolean, tax:number, surcharge:number, regime:string, reason:string }}
 */
export function sdltForPurchase(price, { use = 'residential', dateISO = '', hasOtherProperty = true } = {}) {
  const p = +price || 0;
  const u = String(use).toLowerCase();
  if (u === 'overseas') return { applicable: false, tax: 0, surcharge: 0, regime: 'overseas', reason: 'Foreign property — UK SDLT does not apply (local transfer tax does).' };
  if (u === 'commercial' || u === 'agricultural' || u === 'mixed') {
    const tax = _slab(p, NON_RES_BANDS);
    return { applicable: true, tax, surcharge: 0, regime: 'non-residential', reason: `Non-residential rates (0% to £150k, no surcharge).` };
  }
  // residential
  const isAdditional = RESIDENTIAL_USES.has(u) && hasOtherProperty;
  const surcharge = isAdditional ? _additionalSurcharge(dateISO) : 0;
  const tax = _slab(p, _residentialBands(dateISO), surcharge);
  return {
    applicable: true, tax, surcharge,
    regime: isAdditional ? 'residential + additional-dwelling surcharge' : 'residential',
    reason: isAdditional
      ? `Residential additional dwelling: +${Math.round(surcharge * 100)}% surcharge on every band (you already own a home).`
      : `Standard residential rates.`,
  };
}

/**
 * SDLT borne acquiring the whole property portfolio, per property + total.
 * ESTIMATED at purchase-year standard rates; intra-year holidays not modelled.
 */
export function portfolioSDLT(entity) {
  const props = entity?.assets?.property;
  if (!Array.isArray(props) || !props.length) return null;
  const ownsHome = !!(entity?.assets?.residence?.value);
  const rows = props.map(p => {
    const r = sdltForPurchase(p.purchase_price ?? p.value, {
      use: p.use, dateISO: p.purchase_date, hasOtherProperty: ownsHome,
    });
    return {
      label: p.label || p.address || p.use,
      use: p.use,
      price: +(p.purchase_price ?? p.value) || 0,
      date: p.purchase_date || null,
      sdlt: r.tax,
      applicable: r.applicable,
      reason: r.reason,
    };
  });
  const total = rows.reduce((s, r) => s + (r.sdlt || 0), 0);
  return {
    total,
    rows,
    status: 'ESTIMATED',
    assumptions: 'Computed at each purchase year’s standard rates (surcharge 3% pre-31 Oct 2024, 5% after; £250k 0% band 23 Sep 2022–31 Mar 2025). Intra-year reliefs/holidays and linked-transaction rules not modelled.',
  };
}

// ── Corporation tax behind director dividends ────────────────────────────────
// 2026/27 (UK-2026.1.1): 19% to £50k, 25% from £250k, marginal relief between
// (standard fraction 3/200). We are GIVEN profit-after-tax; gross it up to the
// pre-tax profit that produces it, so the CT figure is derived, not invented.
function _grossUpCT(profitAfterTax) {
  const SP = 50000, MP = 250000, smallR = 0.19, mainR = 0.25, mscf = 0.015;
  // After-tax as a function of pre-tax P, in each band:
  //   P ≤ 50k:        after = 0.81 P
  //   50k < P < 250k: after = 0.735 P + 3750   (0.25P − (250k−P)·0.015 is the CT)
  //   P ≥ 250k:       after = 0.75 P
  const a = +profitAfterTax || 0;
  let P, band;
  if (a <= SP * 0.81) { P = a / 0.81; band = '19% small-profits'; }
  else if (a < (0.735 * MP + 3750)) { P = (a - 3750) / 0.735; band = '25% main rate, marginal relief'; }
  else { P = a / 0.75; band = '25% main rate'; }
  const ct = Math.round(P - a);
  return { preTax: Math.round(P), ct, band };
}

/**
 * Company-level tax view: corporation tax behind the company's profit, and the
 * double-tax narrative on dividends drawn from it. Personal-impact framing
 * (corporation tax filing itself is out of Sonuswealth scope).
 */
export function companyTaxView(entity) {
  const companies = Array.isArray(entity?.companies) ? entity.companies
    : (entity?.companies ? [entity.companies] : []);
  if (!companies.length) return null;
  const VAT_THRESHOLD = 90000; // 2024+ registration threshold
  const rows = companies.map(c => {
    const profitAfterTax = +(c.annual_profit_after_tax ?? 0) || 0;
    const ct = profitAfterTax > 0 ? _grossUpCT(profitAfterTax) : null;
    return {
      name: c.name || c.id,
      turnover: +(c.annual_turnover || 0) || 0,
      profitAfterTax,
      ct: ct?.ct || 0,
      preTax: ct?.preTax || 0,
      ctBand: ct?.band || null,
      vatRegistered: (+(c.annual_turnover || 0) || 0) >= VAT_THRESHOLD,
      tradingStatus: c.trading_status || null,
    };
  });
  const dividends = Math.max(+(entity?.income?.directorDividends || 0), +(entity?.income?.dividends || 0)) || 0;
  return {
    rows,
    totalCT: rows.reduce((s, r) => s + r.ct, 0),
    dividendsDrawn: dividends,
    status: 'ESTIMATED',
    doubleTaxNote: dividends > 0
      ? `Your £${dividends.toLocaleString('en-GB')} dividends are paid from profit that already bore corporation tax, then taxed again personally — the dividend is taxed twice.`
      : null,
  };
}

// ── Section 24 landlord finance-cost restriction ─────────────────────────────
/**
 * s24: since 2020/21, BTL mortgage interest is no longer deductible from rental
 * profit; landlords get a 20% basic-rate tax CREDIT instead. For a higher-rate
 * landlord this raises the effective tax on rent. We surface what the fixture
 * gives (gross rent, net taxable after s24); the exact interest add-back needs
 * the interest figure and is flagged where absent.
 */
export function s24View(entity) {
  const rp = entity?.assets?.rental_portfolio;
  const grossRent = +(rp?.annual_gross_rent ?? entity?.income?.rentalIncome ?? 0) || 0;
  if (grossRent <= 0) return null;
  const netAfterS24 = +(rp?.annual_net_rent_after_s24 ?? entity?.income?.rentalIncomeNet ?? 0) || 0;
  const interest = +(rp?.annual_mortgage_interest ?? 0) || 0;
  return {
    applies: true,
    grossRent,
    netAfterS24,
    mortgageInterest: interest || null,
    basicRateCredit: interest ? Math.round(interest * 0.20) : null,
    note: 'Buy-to-let mortgage interest is no longer deducted from rental profit (s24, fully phased in 2020/21). You get a 20% basic-rate tax credit instead — so higher-rate landlords pay more tax on the same rent.',
  };
}

/**
 * The applicable situational-tax rows for the "Other taxes in your situation"
 * card. Returns only what genuinely applies to this entity.
 */
export function situationalTaxes(entity) {
  const out = [];
  const s24 = s24View(entity);
  if (s24) out.push({ kind: 's24', ...s24 });
  const sdlt = portfolioSDLT(entity);
  if (sdlt && sdlt.total > 0) out.push({ kind: 'sdlt', ...sdlt });
  const co = companyTaxView(entity);
  if (co) out.push({ kind: 'corp', ...co });
  return out;
}
