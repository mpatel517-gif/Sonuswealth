// =====================================================================
// CAELIXA — parts/3-Engine/lib/monte-carlo.js
// =====================================================================
// Shared Monte Carlo / stochastic simulation utilities.
// PURE FUNCTIONS. NO BUNDLE DEPENDENCY. SEEDABLE FOR REPRODUCIBILITY.
//
// Built:    s17b-1 (7 May 2026 · Track A · Code · Opus)
// Patched:  s17b-2 (10 May 2026 · Track A · Code · Opus) — Cholesky extension v1.1
// Phase:    B (Monte Carlo lib) — second phase of s17b-1
// Consumed by:
//   - uk-cashflow-2026-1-1.js — §G Monte Carlo method (single-asset)
//   - uk-risk-2026-1-1.js (s17b-2 · this patch) — §A multi-asset risk via Cholesky
//
// Sources:
//   [BOX]      Box, G. E. P. & Muller, M. E. (1958) "A Note on the Generation
//              of Random Normal Deviates", Annals of Mathematical Statistics 29(2)
//              — Box-Muller transform
//   [BMA-10]   Brealey/Myers/Allen Ch.10 — Geometric Brownian Motion / lognormal
//              asset price model
//   [CII-AF4]  CII AF4 Investment Planning — stochastic forecasting (Monte Carlo
//              for retirement planning)
//   [ETTINGER] Tommy Ettinger (2018) — Mulberry32 PRNG (public domain).
//              De facto standard simple seedable PRNG in modern JS.
//   [EXCEL]    Excel PERCENTILE.INC convention for linear-interpolation quantiles
//   [GVL-4]    Golub & Van Loan, Matrix Computations 4th ed. (2013), §4.2.5
//              — Cholesky decomposition for symmetric positive-definite matrices
//   [GLASSER]  Glasserman, Monte Carlo Methods in Financial Engineering (2004)
//              §2.3 — Multivariate normal sampling via Cholesky factor
//
// Discipline:
//   - All RNGs are seedable. Production code uses Math.random by default;
//     tests inject mulberry32 for determinism.
//   - All distribution samplers accept optional rng parameter.
//   - simulate() is a generic orchestrator — caller provides step function.
//   - Engines stay pure: this lib never reads bundle, never mutates state.
//   - Cholesky failure modes are loud-fail with informative errors citing the
//     bundle field path — non-PSD matrices indicate bundle corruption.
//
// Quality gates (per skill v1.4 §2.6.5):
//   Q1 ✓ purpose + I/O on every fn       Q6 N/A jurisdiction-agnostic
//   Q2 ✓ JSDoc envelope                  Q7 ✓ smoke tests pass
//   Q3 N/A no bundle                     Q8 ✓ minimal clean API
//   Q4 N/A no dates                      Q9 ✓ statistics is settled
//   Q5 N/A engines wrap explanations
// =====================================================================


// ---------------------------------------------------------------------
// §A — Validation helpers (private)
// ---------------------------------------------------------------------

function _requireFiniteNumber(name, x) {
  if (typeof x !== 'number' || !Number.isFinite(x)) {
    throw new Error(`monte-carlo: ${name} must be a finite number, got ${x}`);
  }
}

function _requirePositiveInteger(name, x) {
  if (!Number.isInteger(x) || x <= 0) {
    throw new Error(`monte-carlo: ${name} must be a positive integer, got ${x}`);
  }
}

function _requireFunction(name, x) {
  if (typeof x !== 'function') {
    throw new Error(`monte-carlo: ${name} must be a function, got ${typeof x}`);
  }
}

function _requireArray(name, x) {
  if (!Array.isArray(x)) {
    throw new Error(`monte-carlo: ${name} must be an array, got ${typeof x}`);
  }
}

function _requireSquareMatrix(name, m) {
  _requireArray(name, m);
  const n = m.length;
  if (n === 0) throw new Error(`monte-carlo: ${name} must be non-empty matrix`);
  for (let i = 0; i < n; i++) {
    _requireArray(`${name}[${i}]`, m[i]);
    if (m[i].length !== n) {
      throw new Error(
        `monte-carlo: ${name} must be square (${n}×${n}); row ${i} has length ${m[i].length}`
      );
    }
    for (let j = 0; j < n; j++) {
      _requireFiniteNumber(`${name}[${i}][${j}]`, m[i][j]);
    }
  }
  return n;
}


// ---------------------------------------------------------------------
// §B — Seedable PRNG (Mulberry32)
// Source: [ETTINGER] — public domain
// ---------------------------------------------------------------------

/**
 * Create a seeded pseudo-random number generator (Mulberry32).
 *
 * @param {number} seed   Integer seed (any 32-bit value)
 * @returns {() => number}   Function returning uniform[0,1) on each call
 */
export function mulberry32(seed) {
  _requireFiniteNumber('seed', seed);
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


// ---------------------------------------------------------------------
// §C — Distribution samplers
// ---------------------------------------------------------------------

/**
 * Sample one value from a Normal (Gaussian) distribution N(mean, stdDev^2).
 * Uses Box-Muller transform [BOX].
 *
 * @param {number} [mean]    Mean (default 0)
 * @param {number} [stdDev]  Standard deviation (default 1, must be ≥ 0)
 * @param {() => number} [rng]   Uniform[0,1) generator (default Math.random)
 * @returns {number}         Single sample
 */
export function sampleNormal(mean = 0, stdDev = 1, rng = Math.random) {
  _requireFiniteNumber('mean', mean);
  _requireFiniteNumber('stdDev', stdDev);
  if (stdDev < 0) throw new Error('monte-carlo: stdDev must be ≥ 0');
  _requireFunction('rng', rng);
  let u1 = 0;
  while (u1 === 0) u1 = rng();
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + stdDev * z;
}

/**
 * Sample one value from a Lognormal distribution.
 * X ~ Lognormal(mu, sigma^2)  iff  ln(X) ~ Normal(mu, sigma^2).
 * Standard model for asset prices [BMA-10] geometric Brownian motion.
 *
 * @param {number} mu       Mean of underlying normal (LOG-space)
 * @param {number} sigma    Std dev of underlying normal (LOG-space, ≥ 0)
 * @param {() => number} [rng]   Default Math.random
 * @returns {number}        Sample, always > 0
 */
export function sampleLognormal(mu, sigma, rng = Math.random) {
  _requireFiniteNumber('mu', mu);
  _requireFiniteNumber('sigma', sigma);
  if (sigma < 0) throw new Error('monte-carlo: sigma must be ≥ 0');
  return Math.exp(sampleNormal(mu, sigma, rng));
}

/**
 * Convert arithmetic-space mean/stdDev to lognormal log-space (mu, sigma)
 * parameters.
 *
 * For X ~ Lognormal(mu, sigma^2):
 *   E[X]   = exp(mu + sigma^2/2)
 *   Var[X] = (exp(sigma^2) - 1) * exp(2*mu + sigma^2)
 * Inversion:
 *   sigma^2 = ln(1 + (stdDev/mean)^2)
 *   mu = ln(mean) - sigma^2/2
 *
 * @param {number} mean     Arithmetic mean of lognormal (must be > 0)
 * @param {number} stdDev   Arithmetic std dev (must be ≥ 0)
 * @returns {{mu: number, sigma: number}}
 */
export function logNormalParamsFromMeanStd(mean, stdDev) {
  _requireFiniteNumber('mean', mean);
  _requireFiniteNumber('stdDev', stdDev);
  if (mean <= 0) throw new Error('monte-carlo: lognormal mean must be > 0');
  if (stdDev < 0) throw new Error('monte-carlo: stdDev must be ≥ 0');
  const variance = stdDev * stdDev;
  const sigmaSq = Math.log(1 + variance / (mean * mean));
  const mu = Math.log(mean) - sigmaSq / 2;
  return { mu, sigma: Math.sqrt(sigmaSq) };
}


// ---------------------------------------------------------------------
// §D — Simulation orchestrator
// ---------------------------------------------------------------------

/**
 * Run a Monte Carlo simulation.
 *
 * @param {object} config
 * @param {number} config.runs            Number of simulation paths (positive int)
 * @param {number} config.periods         Periods per path (positive int)
 * @param {object|() => object} config.initialState   State at period 0
 * @param {(state, period, rng) => object} config.step
 * @param {(state, period) => boolean} [config.terminate]   Optional early-exit
 * @param {() => number} [config.rng]     Uniform[0,1) RNG (default Math.random)
 *
 * @returns {{trajectories: object[][], terminations: number[]}}
 */
export function simulate(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('monte-carlo: simulate requires a config object');
  }
  const { runs, periods, initialState, step, terminate, rng = Math.random } = config;

  _requirePositiveInteger('runs', runs);
  _requirePositiveInteger('periods', periods);
  _requireFunction('step', step);
  _requireFunction('rng', rng);
  if (terminate !== undefined) _requireFunction('terminate', terminate);
  if (initialState === undefined) {
    throw new Error('monte-carlo: initialState required');
  }

  const trajectories = new Array(runs);
  const terminations = new Array(runs);

  for (let r = 0; r < runs; r++) {
    const start = (typeof initialState === 'function')
      ? initialState()
      : { ...initialState };
    const traj = [start];
    let state = start;
    let endPeriod = periods;

    for (let p = 1; p <= periods; p++) {
      state = step(state, p, rng);
      traj.push(state);
      if (terminate && terminate(state, p)) {
        endPeriod = p;
        break;
      }
    }

    trajectories[r] = traj;
    terminations[r] = endPeriod;
  }

  return { trajectories, terminations };
}


// ---------------------------------------------------------------------
// §E — Distribution statistics
// ---------------------------------------------------------------------

function _quantile(sortedAsc, p) {
  const n = sortedAsc.length;
  if (n === 0) return NaN;
  if (n === 1) return sortedAsc[0];
  const idx = p * (n - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo);
}

/**
 * Statistical summary of an array of numeric outcomes.
 * Returns count, min, max, mean, median, stdDev, and standard percentiles.
 *
 * Population variance (divide by n, not n-1) — Monte Carlo output is the
 * full population of simulated outcomes, not a sample of a larger one.
 *
 * @param {number[]} values
 * @returns {{count, min, max, mean, median, stdDev, p5, p10, p25, p50, p75, p90, p95}}
 */
export function summarise(values) {
  _requireArray('values', values);
  if (values.length === 0) {
    return {
      count: 0, min: NaN, max: NaN, mean: NaN, median: NaN, stdDev: NaN,
      p5: NaN, p10: NaN, p25: NaN, p50: NaN, p75: NaN, p90: NaN, p95: NaN,
    };
  }
  for (let i = 0; i < values.length; i++) {
    _requireFiniteNumber(`values[${i}]`, values[i]);
  }
  const sorted = [...values].sort((a, b) => a - b);
  const n = values.length;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += values[i];
  const mean = sum / n;
  let sqSum = 0;
  for (let i = 0; i < n; i++) {
    const d = values[i] - mean;
    sqSum += d * d;
  }
  const stdDev = Math.sqrt(sqSum / n);

  return {
    count: n,
    min: sorted[0],
    max: sorted[n - 1],
    mean,
    median: _quantile(sorted, 0.50),
    stdDev,
    p5: _quantile(sorted, 0.05),
    p10: _quantile(sorted, 0.10),
    p25: _quantile(sorted, 0.25),
    p50: _quantile(sorted, 0.50),
    p75: _quantile(sorted, 0.75),
    p90: _quantile(sorted, 0.90),
    p95: _quantile(sorted, 0.95),
  };
}


// ---------------------------------------------------------------------
// §F — Probability helpers
// ---------------------------------------------------------------------

/**
 * Empirical probability that a sampled value exceeds threshold (strict >).
 * @param {number[]} values
 * @param {number} threshold
 * @returns {number}   probability in [0, 1]; 0 if values empty
 */
export function probAbove(values, threshold) {
  _requireArray('values', values);
  _requireFiniteNumber('threshold', threshold);
  if (values.length === 0) return 0;
  let count = 0;
  for (let i = 0; i < values.length; i++) {
    _requireFiniteNumber(`values[${i}]`, values[i]);
    if (values[i] > threshold) count++;
  }
  return count / values.length;
}

/**
 * Empirical probability that a sampled value is below threshold (strict <).
 * @param {number[]} values
 * @param {number} threshold
 * @returns {number}   probability in [0, 1]; 0 if values empty
 */
export function probBelow(values, threshold) {
  _requireArray('values', values);
  _requireFiniteNumber('threshold', threshold);
  if (values.length === 0) return 0;
  let count = 0;
  for (let i = 0; i < values.length; i++) {
    _requireFiniteNumber(`values[${i}]`, values[i]);
    if (values[i] < threshold) count++;
  }
  return count / values.length;
}


// =====================================================================
// §G — CHOLESKY DECOMPOSITION (v1.1 · s17b-2 patch · 10 May 2026)
// =====================================================================
// Multivariate normal sampling for correlated multi-asset Monte Carlo.
// Closes O-MC-CHOLESKY-1. Used by uk-risk engine §8.4 sequence-of-returns,
// §8.6 max-drawdown volatility, §8.7 mean-variance frontier.
//
// Source: [GVL-4] §4.2.5 (Cholesky algorithm), [GLASSER] §2.3 (multivariate
// normal sampling via Cholesky factor: X = mu + L·Z where Z ~ N(0,I)).
//
// Numerical tolerance: 1e-10 for symmetry check, 1e-12 for diagonal positivity.
// These are tight enough to catch genuine errors in hand-curated bundle
// matrices but loose enough to absorb floating-point rounding.
// =====================================================================

const _CHOL_SYM_TOL = 1e-10;
const _CHOL_DIAG_TOL = 1e-12;

/**
 * Cholesky decomposition of a symmetric positive-definite matrix.
 * Returns the lower-triangular factor L such that A = L·L^T.
 *
 * Loud-fail discipline (per locked default): throws with informative error
 * citing matrix property violation. Does NOT silently regularise.
 *
 * Algorithm: standard column-wise Cholesky [GVL-4] §4.2.5.
 *   For j = 0 .. n-1:
 *     L[j][j] = sqrt(A[j][j] - sum_{k=0..j-1} L[j][k]^2)
 *     For i = j+1 .. n-1:
 *       L[i][j] = (A[i][j] - sum_{k=0..j-1} L[i][k]·L[j][k]) / L[j][j]
 *     L[j][i] = 0 for i > j  (lower triangular)
 *
 * @param {number[][]} matrix   Symmetric PSD square matrix (n×n)
 * @param {string} [fieldPath]  Optional path for error messages (e.g.
 *                              'bundle.correlationMatrix.matrix')
 * @returns {number[][]}        Lower-triangular n×n matrix L
 *
 * @throws {Error} If matrix is not square, not symmetric, has non-finite
 *                 entries, or is not positive-definite.
 */
export function choleskyDecompose(matrix, fieldPath = 'matrix') {
  const n = _requireSquareMatrix(fieldPath, matrix);

  // Symmetry check
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(matrix[i][j] - matrix[j][i]) > _CHOL_SYM_TOL) {
        throw new Error(
          `monte-carlo: ${fieldPath} not symmetric: ` +
          `[${i}][${j}]=${matrix[i][j]} vs [${j}][${i}]=${matrix[j][i]} ` +
          `(diff ${Math.abs(matrix[i][j] - matrix[j][i])} > tol ${_CHOL_SYM_TOL})`
        );
      }
    }
  }

  // Initialise L as zero matrix
  const L = new Array(n);
  for (let i = 0; i < n; i++) L[i] = new Array(n).fill(0);

  // Column-wise Cholesky
  for (let j = 0; j < n; j++) {
    let diagSq = matrix[j][j];
    for (let k = 0; k < j; k++) {
      diagSq -= L[j][k] * L[j][k];
    }
    if (diagSq <= _CHOL_DIAG_TOL) {
      throw new Error(
        `monte-carlo: ${fieldPath} not positive-definite: ` +
        `diagonal element ${j} computes to ${diagSq} (≤ tol ${_CHOL_DIAG_TOL}). ` +
        `Bundle field may be corrupted or matrix may be only positive-semi-definite.`
      );
    }
    L[j][j] = Math.sqrt(diagSq);

    for (let i = j + 1; i < n; i++) {
      let off = matrix[i][j];
      for (let k = 0; k < j; k++) {
        off -= L[i][k] * L[j][k];
      }
      L[i][j] = off / L[j][j];
    }
  }

  return L;
}

/**
 * Build a covariance matrix from a vector of standard deviations and a
 * correlation matrix.
 *   Cov[i][j] = sigma[i] · sigma[j] · Corr[i][j]
 *
 * @param {number[]} stdDevs        Length-n vector of std deviations (≥ 0)
 * @param {number[][]} correlation  n×n correlation matrix (symmetric, diag=1)
 * @param {string} [fieldPath]      Optional path for error messages
 * @returns {number[][]}            n×n covariance matrix
 */
export function buildCovarianceMatrix(stdDevs, correlation, fieldPath = 'correlation') {
  _requireArray('stdDevs', stdDevs);
  const n = _requireSquareMatrix(fieldPath, correlation);
  if (stdDevs.length !== n) {
    throw new Error(
      `monte-carlo: stdDevs length ${stdDevs.length} ≠ correlation dim ${n}`
    );
  }
  for (let i = 0; i < n; i++) {
    _requireFiniteNumber(`stdDevs[${i}]`, stdDevs[i]);
    if (stdDevs[i] < 0) {
      throw new Error(`monte-carlo: stdDevs[${i}] must be ≥ 0, got ${stdDevs[i]}`);
    }
  }
  const cov = new Array(n);
  for (let i = 0; i < n; i++) {
    cov[i] = new Array(n);
    for (let j = 0; j < n; j++) {
      cov[i][j] = stdDevs[i] * stdDevs[j] * correlation[i][j];
    }
  }
  return cov;
}

/**
 * Sample one vector from a multivariate normal distribution.
 * Uses pre-computed Cholesky factor L: X = mu + L·Z where Z[i] ~ iid N(0,1).
 * Reference: [GLASSER] §2.3.
 *
 * Caller passes the pre-decomposed L (decompose once, sample many times) for
 * efficiency. Use sampleMultivariateNormal() if doing one-off sampling.
 *
 * @param {number[]} mean        Length-n mean vector
 * @param {number[][]} cholFactor   Lower-triangular n×n Cholesky factor of cov
 * @param {() => number} [rng]   Default Math.random
 * @returns {number[]}           Length-n sample vector
 */
export function sampleMultivariateNormalFromChol(mean, cholFactor, rng = Math.random) {
  _requireArray('mean', mean);
  const n = _requireSquareMatrix('cholFactor', cholFactor);
  if (mean.length !== n) {
    throw new Error(
      `monte-carlo: mean length ${mean.length} ≠ cholFactor dim ${n}`
    );
  }
  for (let i = 0; i < n; i++) _requireFiniteNumber(`mean[${i}]`, mean[i]);
  _requireFunction('rng', rng);

  // Sample Z ~ N(0, I)
  const z = new Array(n);
  for (let i = 0; i < n; i++) z[i] = sampleNormal(0, 1, rng);

  // X = mean + L·Z (L is lower-triangular)
  const x = new Array(n);
  for (let i = 0; i < n; i++) {
    let s = mean[i];
    for (let k = 0; k <= i; k++) {
      s += cholFactor[i][k] * z[k];
    }
    x[i] = s;
  }
  return x;
}

/**
 * Sample one vector from a multivariate normal — convenience wrapper.
 * Decomposes covariance matrix internally; caller supplies cov directly.
 *
 * For repeated sampling, prefer choleskyDecompose() once + repeated calls
 * to sampleMultivariateNormalFromChol() for efficiency.
 *
 * @param {number[]} mean        Length-n mean vector
 * @param {number[][]} cov       n×n covariance matrix (symmetric PD)
 * @param {() => number} [rng]   Default Math.random
 * @returns {number[]}           Length-n sample vector
 */
export function sampleMultivariateNormal(mean, cov, rng = Math.random) {
  const L = choleskyDecompose(cov, 'cov');
  return sampleMultivariateNormalFromChol(mean, L, rng);
}


// ---------------------------------------------------------------------
// End of monte-carlo.js v1.1 · 12 exported functions
//   §B  mulberry32
//   §C  sampleNormal · sampleLognormal · logNormalParamsFromMeanStd
//   §D  simulate
//   §E  summarise
//   §F  probAbove · probBelow
//   §G  choleskyDecompose · buildCovarianceMatrix
//       sampleMultivariateNormalFromChol · sampleMultivariateNormal  [NEW v1.1]
//
// v1.1 patch (s17b-2 · 10 May 2026):
//   - Added §G Cholesky decomposition + multivariate normal sampling
//   - Closes O-MC-CHOLESKY-1
//   - Backward compatible: all v1.0 functions unchanged
//   - 4 new exports (12 total · was 8)
// ---------------------------------------------------------------------
