// =====================================================================
// CAELIXA — parts/3-Engine/lib/financial-math.js
// =====================================================================
// Shared financial-math utilities. PURE FUNCTIONS. NO BUNDLE DEPENDENCY.
//
// Built:    s17b-1 (7 May 2026 · Track A · Code · Opus)
// Phase:    A (financial-math lib) — first phase of s17b-1
// Consumed by:
//   - uk-cashflow-2026-1-1.js (Phase E–K · this session) — §G four-method comparison
//   - costOfInaction (canonical, MM v2.6 §0.1) — NPV core
//   - uk-risk-2026-1-1.js (s17b-2) — Fisher equation, rate conversion
//
// Sources (all functions cite at least one):
//   [CII-AF4]  CII AF4 Investment Planning — Advanced Diploma syllabus,
//              chapter on Time Value of Money (PMT, FV, PV, NPV, IRR)
//   [CII-R02]  CII R02 Investment Principles & Risk — Diploma syllabus
//              (annuity formulas, real vs nominal returns)
//   [BMA]      Brealey, Myers, Allen — Principles of Corporate Finance,
//              13th ed. Ch. 2 (PV/NPV), Ch. 3 (annuity), Ch. 5 (IRR)
//   [FISHER]   Fisher, I. (1930) The Theory of Interest
//              identity: (1+nominal) = (1+real)(1+inflation)
//   [NUM]      Press, Teukolsky, Vetterling, Flannery — Numerical Recipes,
//              Ch. 9 (Newton-Raphson root-finding)
//
// Discipline:
//   - All rates as decimals (0.05 = 5%). Never percentages.
//   - All amounts in same currency unit (caller's responsibility).
//   - Cashflow arrays: index 0 = period 0 (now, NOT discounted).
//   - Pure functions. No side effects. No globals. No bundle.
//   - Returns: numerics or { value, ... } structured objects (npvBreakdown).
//   - Throws on invalid inputs (NaN, rate ≤ -1, negative periods, etc.).
//   - No envelope `{amount, breakdown, rules, explanation}` here — that
//     convention is engine-layer; lib returns primitives, engine wraps.
//
// Quality gates (per skill v1.4 §2.6.5):
//   Q1 ✓ purpose + I/O on every fn       Q6 N/A jurisdiction-agnostic
//   Q2 ✓ JSDoc envelope                  Q7 ✓ smoke tests pass
//   Q3 N/A no bundle                     Q8 ✓ minimal clean API
//   Q4 N/A no dates                      Q9 ✓ math is settled science
//   Q5 N/A engines wrap explanations
// =====================================================================


// ---------------------------------------------------------------------
// §A — Validation helpers (private; not exported)
// ---------------------------------------------------------------------

function _requireFiniteNumber(name, x) {
  if (typeof x !== 'number' || !Number.isFinite(x)) {
    throw new Error(`financial-math: ${name} must be a finite number, got ${x}`);
  }
}

function _requireArray(name, x) {
  if (!Array.isArray(x)) {
    throw new Error(`financial-math: ${name} must be an array, got ${typeof x}`);
  }
}

function _requireRateGtMinusOne(name, rate) {
  if (rate <= -1) {
    throw new Error(`financial-math: ${name} must be > -1 (rate of -100% or worse is invalid), got ${rate}`);
  }
}


// ---------------------------------------------------------------------
// §B — Present value / Future value (single sum)
// Source: [BMA] Ch. 2, [CII-AF4] Time Value of Money
// ---------------------------------------------------------------------

/**
 * Present value of a single future amount.
 *   PV = amount / (1 + rate)^periods
 *
 * @param {number} amount    Future amount (any sign)
 * @param {number} rate      Per-period discount rate (decimal, e.g. 0.05 = 5%)
 * @param {number} periods   Number of compounding periods (can be fractional)
 * @returns {number}         Present value in same currency as amount
 */
export function pv(amount, rate, periods) {
  _requireFiniteNumber('amount', amount);
  _requireFiniteNumber('rate', rate);
  _requireFiniteNumber('periods', periods);
  _requireRateGtMinusOne('rate', rate);
  return amount / Math.pow(1 + rate, periods);
}

/**
 * Future value of a single present amount.
 *   FV = amount * (1 + rate)^periods
 *
 * @param {number} amount    Present amount (any sign)
 * @param {number} rate      Per-period growth rate (decimal)
 * @param {number} periods   Number of compounding periods
 * @returns {number}         Future value in same currency
 */
export function fv(amount, rate, periods) {
  _requireFiniteNumber('amount', amount);
  _requireFiniteNumber('rate', rate);
  _requireFiniteNumber('periods', periods);
  _requireRateGtMinusOne('rate', rate);
  return amount * Math.pow(1 + rate, periods);
}


// ---------------------------------------------------------------------
// §C — Annuity (level periodic payments)
// Source: [CII-R02], [BMA] Ch. 3
//
// type='ordinary' (default) — payments at END of period (annuity-immediate)
// type='due'                — payments at BEGINNING of period (annuity-due)
//                             Used for drawdown income paid in advance.
// ---------------------------------------------------------------------

/**
 * Present value of an annuity.
 *   PVA = pmt * [(1 - (1+r)^-n) / r]                      (ordinary)
 *   PVA = pmt * [(1 - (1+r)^-n) / r] * (1+r)              (due)
 *   Special case r = 0:  PVA = pmt * n
 *
 * @param {number} payment   Periodic payment
 * @param {number} rate      Per-period rate (decimal)
 * @param {number} periods   Number of payments
 * @param {string} [type]    'ordinary' (default) or 'due'
 * @returns {number}         Present value of payment stream
 */
export function pvAnnuity(payment, rate, periods, type = 'ordinary') {
  _requireFiniteNumber('payment', payment);
  _requireFiniteNumber('rate', rate);
  _requireFiniteNumber('periods', periods);
  _requireRateGtMinusOne('rate', rate);
  if (type !== 'ordinary' && type !== 'due') {
    throw new Error(`financial-math: type must be 'ordinary' or 'due', got '${type}'`);
  }
  if (rate === 0) return payment * periods;
  const factor = (1 - Math.pow(1 + rate, -periods)) / rate;
  return type === 'due' ? payment * factor * (1 + rate) : payment * factor;
}

/**
 * Future value of an annuity.
 *   FVA = pmt * [((1+r)^n - 1) / r]                       (ordinary)
 *   FVA = pmt * [((1+r)^n - 1) / r] * (1+r)               (due)
 *   Special case r = 0:  FVA = pmt * n
 *
 * @param {number} payment   Periodic payment
 * @param {number} rate      Per-period rate (decimal)
 * @param {number} periods   Number of payments
 * @param {string} [type]    'ordinary' (default) or 'due'
 * @returns {number}         Future value at end of last period
 */
export function fvAnnuity(payment, rate, periods, type = 'ordinary') {
  _requireFiniteNumber('payment', payment);
  _requireFiniteNumber('rate', rate);
  _requireFiniteNumber('periods', periods);
  _requireRateGtMinusOne('rate', rate);
  if (type !== 'ordinary' && type !== 'due') {
    throw new Error(`financial-math: type must be 'ordinary' or 'due', got '${type}'`);
  }
  if (rate === 0) return payment * periods;
  const factor = (Math.pow(1 + rate, periods) - 1) / rate;
  return type === 'due' ? payment * factor * (1 + rate) : payment * factor;
}


// ---------------------------------------------------------------------
// §D — PMT (periodic payment to amortise PV with optional FV residual)
// Source: [CII-AF4], [BMA]
//
// Standard mortgage / annuity payment formula:
//   PMT = -[ PV*(1+r)^n + FV ] * r / [ ((1+r)^n - 1) * adj ]
//   where adj = 1 (ordinary) or (1+r) (due)
//   Special case r = 0:  PMT = -(PV + FV) / n
//
// Sign convention (Excel-compatible):
//   Positive PV = amount you have today / amount owed today
//   Negative PMT = outflow (cash leaving you)
// ---------------------------------------------------------------------

/**
 * Periodic payment that amortises a present value to a future value.
 *
 * @param {number} presentValue   PV (positive = amount today)
 * @param {number} rate           Per-period rate (decimal)
 * @param {number} periods        Number of payments (must be > 0)
 * @param {number} [futureValue]  Residual FV at end (default 0)
 * @param {string} [type]         'ordinary' (default) or 'due'
 * @returns {number}              Payment per period (typically negative)
 */
export function pmt(presentValue, rate, periods, futureValue = 0, type = 'ordinary') {
  _requireFiniteNumber('presentValue', presentValue);
  _requireFiniteNumber('rate', rate);
  _requireFiniteNumber('periods', periods);
  _requireFiniteNumber('futureValue', futureValue);
  _requireRateGtMinusOne('rate', rate);
  if (periods === 0) {
    throw new Error('financial-math: periods cannot be zero in pmt');
  }
  if (type !== 'ordinary' && type !== 'due') {
    throw new Error(`financial-math: type must be 'ordinary' or 'due', got '${type}'`);
  }
  if (rate === 0) return -(presentValue + futureValue) / periods;
  const adj = type === 'due' ? (1 + rate) : 1;
  const factor = (Math.pow(1 + rate, periods) - 1) / rate;
  return -(presentValue * Math.pow(1 + rate, periods) + futureValue) / (factor * adj);
}


// ---------------------------------------------------------------------
// §E — NPV (net present value of a cashflow vector)
// Source: [BMA] Ch. 2, [CII-AF4]
//
// Convention: cashflows[0] is at period 0 (NOT discounted).
//             cashflows[i] is at period i (discounted i times).
//
// This is the canonical CoI computational core.
// ---------------------------------------------------------------------

/**
 * Net Present Value of a cashflow stream.
 *   NPV = Σ_{i=0}^{n} CF_i / (1+rate)^i
 *
 * @param {number} rate          Discount rate per period (decimal)
 * @param {number[]} cashflows   Index 0 = period 0 (now)
 * @returns {number}             NPV in same currency as cashflows
 */
export function npv(rate, cashflows) {
  _requireFiniteNumber('rate', rate);
  _requireArray('cashflows', cashflows);
  _requireRateGtMinusOne('rate', rate);
  let total = 0;
  for (let i = 0; i < cashflows.length; i++) {
    _requireFiniteNumber(`cashflows[${i}]`, cashflows[i]);
    total += cashflows[i] / Math.pow(1 + rate, i);
  }
  return total;
}

/**
 * NPV with structured per-period breakdown.
 * Used by canonical costOfInaction for plain-English action-pair generation
 * (per MM v2.6 §0.1: CoI requires "what staying on your current path costs you
 *  [£X today's money]" — the breakdown supports period-by-period attribution).
 *
 * @param {number} rate          Discount rate per period (decimal)
 * @param {number[]} cashflows   Index 0 = period 0
 * @returns {{value: number, contributions: Array<{period: number, cashflow: number, discountFactor: number, pv: number}>}}
 */
export function npvBreakdown(rate, cashflows) {
  _requireFiniteNumber('rate', rate);
  _requireArray('cashflows', cashflows);
  _requireRateGtMinusOne('rate', rate);
  const contributions = cashflows.map((cf, i) => {
    _requireFiniteNumber(`cashflows[${i}]`, cf);
    const discountFactor = Math.pow(1 + rate, i);
    return {
      period: i,
      cashflow: cf,
      discountFactor,
      pv: cf / discountFactor,
    };
  });
  const value = contributions.reduce((s, c) => s + c.pv, 0);
  return { value, contributions };
}


// ---------------------------------------------------------------------
// §F — IRR (internal rate of return)
// Source: [BMA] Ch. 5, [NUM] Ch. 9 (Newton-Raphson)
//
// Solve r such that NPV(r) = 0.
//
// Caveats (documented; not engineered around):
//   - Returns null if no convergence within tolerance/maxIter.
//   - Returns null if cashflow stream lacks sign change (no real IRR exists).
//   - For pathological multi-IRR cases, finds the IRR closest to the guess
//     (single-root limitation of Newton-Raphson). [BMA] Ch. 5 documents this;
//     real fix is to use NPV at a chosen rate, not IRR, for those streams.
// ---------------------------------------------------------------------

/**
 * Internal Rate of Return of a cashflow vector.
 *
 * @param {number[]} cashflows   Index 0 = period 0; must contain at least one
 *                               positive and one negative value
 * @param {number} [guess]       Initial guess (default 0.1 = 10%)
 * @param {number} [tolerance]   Convergence tolerance on |NPV(r)| (default 1e-7)
 * @param {number} [maxIter]     Max Newton-Raphson iterations (default 100)
 * @returns {number|null}        IRR as decimal, or null if no convergence
 */
export function irr(cashflows, guess = 0.1, tolerance = 1e-7, maxIter = 100) {
  _requireArray('cashflows', cashflows);
  _requireFiniteNumber('guess', guess);
  if (cashflows.length < 2) return null;

  // Sign-change check — IRR exists only if both positive and negative present
  let hasPos = false, hasNeg = false;
  for (let i = 0; i < cashflows.length; i++) {
    _requireFiniteNumber(`cashflows[${i}]`, cashflows[i]);
    if (cashflows[i] > 0) hasPos = true;
    if (cashflows[i] < 0) hasNeg = true;
  }
  if (!hasPos || !hasNeg) return null;

  let r = guess;
  if (r <= -1) return null;

  for (let iter = 0; iter < maxIter; iter++) {
    let f = 0;    // NPV(r)
    let df = 0;   // d/dr [NPV(r)] = -Σ i*CF_i / (1+r)^(i+1)
    for (let i = 0; i < cashflows.length; i++) {
      const factor = Math.pow(1 + r, i);
      f += cashflows[i] / factor;
      if (i > 0) df -= (i * cashflows[i]) / (factor * (1 + r));
    }
    if (Math.abs(f) < tolerance) return r;
    if (df === 0) return null;          // derivative collapse — no progress
    const rNext = r - f / df;
    if (!Number.isFinite(rNext) || rNext <= -1) return null;
    r = rNext;
  }
  return null;  // no convergence within maxIter
}


// ---------------------------------------------------------------------
// §G — Real / Nominal (Fisher equation)
// Source: [FISHER] Fisher (1930)
//
// Identity:  (1 + nominal) = (1 + real) * (1 + inflation)
//
// Used by:
//   - cashflow §F (forecast horizon — real vs nominal projections)
//   - canonical CoI (NPV must use real or nominal consistently)
//   - risk §C inflation risk (s17b-2)
// ---------------------------------------------------------------------

/**
 * Real rate from nominal rate and inflation rate (Fisher).
 *   real = (1 + nominal) / (1 + inflation) - 1
 *
 * @param {number} nominal     Nominal rate (decimal)
 * @param {number} inflation   Inflation rate over the same period (decimal)
 * @returns {number}           Real rate (decimal)
 */
export function realFromNominal(nominal, inflation) {
  _requireFiniteNumber('nominal', nominal);
  _requireFiniteNumber('inflation', inflation);
  _requireRateGtMinusOne('inflation', inflation);
  return (1 + nominal) / (1 + inflation) - 1;
}

/**
 * Nominal rate from real rate and inflation rate (Fisher).
 *   nominal = (1 + real) * (1 + inflation) - 1
 *
 * @param {number} real        Real rate (decimal)
 * @param {number} inflation   Inflation rate over the same period (decimal)
 * @returns {number}           Nominal rate (decimal)
 */
export function nominalFromReal(real, inflation) {
  _requireFiniteNumber('real', real);
  _requireFiniteNumber('inflation', inflation);
  return (1 + real) * (1 + inflation) - 1;
}


// ---------------------------------------------------------------------
// §H — Rate conversion (periodic ↔ effective annual)
// Source: [CII-R02] (APR vs EAR), [BMA] Ch. 2
// ---------------------------------------------------------------------

/**
 * Effective annual rate from a periodic rate.
 *   EAR = (1 + periodicRate)^periodsPerYear - 1
 *
 * @param {number} periodicRate     Per-period rate (decimal)
 * @param {number} periodsPerYear   e.g. 12 for monthly, 4 for quarterly
 * @returns {number}                Effective annual rate (decimal)
 */
export function effectiveAnnualFromPeriodic(periodicRate, periodsPerYear) {
  _requireFiniteNumber('periodicRate', periodicRate);
  _requireFiniteNumber('periodsPerYear', periodsPerYear);
  _requireRateGtMinusOne('periodicRate', periodicRate);
  if (periodsPerYear <= 0) {
    throw new Error(`financial-math: periodsPerYear must be > 0, got ${periodsPerYear}`);
  }
  return Math.pow(1 + periodicRate, periodsPerYear) - 1;
}

/**
 * Periodic rate from an effective annual rate.
 *   periodic = (1 + EAR)^(1/periodsPerYear) - 1
 *
 * @param {number} annualRate       Effective annual rate (decimal)
 * @param {number} periodsPerYear   e.g. 12 for monthly
 * @returns {number}                Periodic rate (decimal)
 */
export function periodicFromEffectiveAnnual(annualRate, periodsPerYear) {
  _requireFiniteNumber('annualRate', annualRate);
  _requireFiniteNumber('periodsPerYear', periodsPerYear);
  _requireRateGtMinusOne('annualRate', annualRate);
  if (periodsPerYear <= 0) {
    throw new Error(`financial-math: periodsPerYear must be > 0, got ${periodsPerYear}`);
  }
  return Math.pow(1 + annualRate, 1 / periodsPerYear) - 1;
}


// ---------------------------------------------------------------------
// End of financial-math.js · 11 exported functions
// pv · fv · pvAnnuity · fvAnnuity · pmt · npv · npvBreakdown · irr
// realFromNominal · nominalFromReal · effectiveAnnualFromPeriodic
// periodicFromEffectiveAnnual                  (12 if you count both above)
// ---------------------------------------------------------------------
