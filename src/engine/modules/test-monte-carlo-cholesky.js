// =====================================================================
// SONUSWEALTH — parts/3-Engine/lib/test-monte-carlo-cholesky.js
// =====================================================================
// Smoke tests for monte-carlo.js v1.1 §G — Cholesky extension.
// Closes O-MC-CHOLESKY-1.
//
// Run: node test-monte-carlo-cholesky.js
//
// Carries: 68/68 v1.0 tests in test-monte-carlo.js (separate file).
// This file adds: ~30 §G assertions for Cholesky + multivariate normal.
// =====================================================================

import {
  mulberry32,
  choleskyDecompose,
  buildCovarianceMatrix,
  sampleMultivariateNormalFromChol,
  sampleMultivariateNormal,
} from './monte-carlo.js';

let pass = 0;
let fail = 0;
const failures = [];

function assert(cond, msg) {
  if (cond) { pass++; }
  else { fail++; failures.push(msg); console.error('FAIL: ' + msg); }
}

function approx(a, b, tol = 1e-9) {
  return Math.abs(a - b) <= tol;
}

function matMul(A, B) {
  const m = A.length, p = A[0].length, n = B[0].length;
  const C = new Array(m);
  for (let i = 0; i < m; i++) {
    C[i] = new Array(n).fill(0);
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let k = 0; k < p; k++) s += A[i][k] * B[k][j];
      C[i][j] = s;
    }
  }
  return C;
}
function transpose(A) {
  const m = A.length, n = A[0].length;
  const T = new Array(n);
  for (let i = 0; i < n; i++) {
    T[i] = new Array(m);
    for (let j = 0; j < m; j++) T[i][j] = A[j][i];
  }
  return T;
}

// =====================================================================
// §1 — choleskyDecompose: shape and basic correctness
// =====================================================================

console.log('§1 — Cholesky basic correctness');

// 1.1 — Identity matrix → identity Cholesky
{
  const I = [[1, 0], [0, 1]];
  const L = choleskyDecompose(I);
  assert(L.length === 2, '1.1a identity dim=2');
  assert(approx(L[0][0], 1) && approx(L[1][1], 1), '1.1b identity diag=1');
  assert(approx(L[0][1], 0) && approx(L[1][0], 0), '1.1c identity off-diag=0');
}

// 1.2 — 2x2 known case
{
  const A = [[4, 2], [2, 5]];
  const L = choleskyDecompose(A);
  assert(approx(L[0][0], 2), '1.2a L[0][0]=2');
  assert(approx(L[1][0], 1), '1.2b L[1][0]=1');
  assert(approx(L[1][1], 2), '1.2c L[1][1]=2');
  assert(approx(L[0][1], 0), '1.2d L[0][1]=0 (lower-triangular)');
}

// 1.3 — Reconstruction: L · L^T = A
{
  const A = [[4, 12, -16], [12, 37, -43], [-16, -43, 98]];
  const L = choleskyDecompose(A);
  const reconstruction = matMul(L, transpose(L));
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      assert(approx(reconstruction[i][j], A[i][j], 1e-9),
        `1.3 reconstruction [${i}][${j}] = ${reconstruction[i][j]} vs A=${A[i][j]}`);
    }
  }
}

// 1.4 — Result is lower-triangular
{
  const A = [[2, 1, 0], [1, 2, 1], [0, 1, 2]];
  const L = choleskyDecompose(A);
  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 3; j++) {
      assert(L[i][j] === 0, `1.4 L[${i}][${j}] must be 0 (above diagonal)`);
    }
  }
}

// 1.5 — Diagonal is positive
{
  const A = [[4, 12, -16], [12, 37, -43], [-16, -43, 98]];
  const L = choleskyDecompose(A);
  for (let i = 0; i < 3; i++) {
    assert(L[i][i] > 0, `1.5 diag[${i}] must be > 0`);
  }
}

// =====================================================================
// §2 — choleskyDecompose: error paths
// =====================================================================

console.log('§2 — Cholesky error paths');

// 2.1 — Non-square
{
  let threw = false;
  try { choleskyDecompose([[1, 2, 3], [4, 5, 6]]); } catch (e) { threw = true; }
  assert(threw, '2.1 non-square throws');
}

// 2.2 — Empty matrix
{
  let threw = false;
  try { choleskyDecompose([]); } catch (e) { threw = true; }
  assert(threw, '2.2 empty matrix throws');
}

// 2.3 — Asymmetric
{
  let threw = false; let msg = '';
  try { choleskyDecompose([[1, 0.5], [0.6, 1]]); } catch (e) { threw = true; msg = e.message; }
  assert(threw, '2.3a asymmetric throws');
  assert(msg.includes('symmetric'), '2.3b error mentions symmetric');
}

// 2.4 — Negative on diagonal (non-PD)
{
  let threw = false; let msg = '';
  try { choleskyDecompose([[-1, 0], [0, 1]]); } catch (e) { threw = true; msg = e.message; }
  assert(threw, '2.4a negative diag throws');
  assert(msg.includes('positive-definite'), '2.4b error mentions positive-definite');
}

// 2.5 — Singular (zero on diagonal effectively)
{
  let threw = false;
  // A matrix that is positive-semi-definite but not positive-definite
  // [[1,1],[1,1]] has eigenvalues 0 and 2; rank-deficient
  try { choleskyDecompose([[1, 1], [1, 1]]); } catch (e) { threw = true; }
  assert(threw, '2.5 singular (PSD only, not PD) throws');
}

// 2.6 — Non-finite entries
{
  let threw = false;
  try { choleskyDecompose([[1, NaN], [NaN, 1]]); } catch (e) { threw = true; }
  assert(threw, '2.6 NaN entries throw');
}

// 2.7 — Field path appears in error message
{
  let msg = '';
  try { choleskyDecompose([[-1, 0], [0, 1]], 'bundle.correlationMatrix.matrix'); }
  catch (e) { msg = e.message; }
  assert(msg.includes('bundle.correlationMatrix.matrix'),
    '2.7 field path in error message: ' + msg);
}

// =====================================================================
// §3 — buildCovarianceMatrix
// =====================================================================

console.log('§3 — buildCovarianceMatrix');

// 3.1 — Identity correlation + unit stddev → identity covariance
{
  const cov = buildCovarianceMatrix([1, 1], [[1, 0], [0, 1]]);
  assert(approx(cov[0][0], 1) && approx(cov[1][1], 1), '3.1a identity diag');
  assert(approx(cov[0][1], 0) && approx(cov[1][0], 0), '3.1b identity off-diag');
}

// 3.2 — Cov[i][j] = sigma_i · sigma_j · rho_ij
{
  const cov = buildCovarianceMatrix([0.10, 0.20], [[1.0, 0.5], [0.5, 1.0]]);
  assert(approx(cov[0][0], 0.01), '3.2a Cov[0][0] = 0.1²');
  assert(approx(cov[1][1], 0.04), '3.2b Cov[1][1] = 0.2²');
  assert(approx(cov[0][1], 0.10 * 0.20 * 0.5), '3.2c Cov[0][1] = σ₁σ₂ρ');
  assert(approx(cov[1][0], cov[0][1]), '3.2d Cov symmetric');
}

// 3.3 — Cov is symmetric
{
  const cov = buildCovarianceMatrix(
    [0.155, 0.145, 0.215, 0.030, 0.062, 0.075, 0.180, 0.005],
    // Use UK-CMA bundle values
    [
      [1.0, 0.85, 0.72, -0.10, -0.05, 0.45, 0.65, 0.05],
      [0.85, 1.0, 0.78, -0.12, -0.08, 0.42, 0.62, 0.03],
      [0.72, 0.78, 1.0, -0.05, 0.0, 0.40, 0.55, 0.02],
      [-0.10, -0.12, -0.05, 1.0, 0.85, 0.55, 0.10, 0.35],
      [-0.05, -0.08, 0.0, 0.85, 1.0, 0.70, 0.15, 0.25],
      [0.45, 0.42, 0.40, 0.55, 0.70, 1.0, 0.45, 0.18],
      [0.65, 0.62, 0.55, 0.10, 0.15, 0.45, 1.0, 0.08],
      [0.05, 0.03, 0.02, 0.35, 0.25, 0.18, 0.08, 1.0],
    ]
  );
  for (let i = 0; i < 8; i++) {
    for (let j = i + 1; j < 8; j++) {
      assert(approx(cov[i][j], cov[j][i], 1e-12),
        `3.3 cov sym [${i}][${j}] vs [${j}][${i}]`);
    }
  }
}

// 3.4 — Length mismatch
{
  let threw = false;
  try { buildCovarianceMatrix([1, 2, 3], [[1, 0], [0, 1]]); } catch (e) { threw = true; }
  assert(threw, '3.4 length mismatch throws');
}

// 3.5 — Negative stddev
{
  let threw = false;
  try { buildCovarianceMatrix([-0.1, 0.2], [[1, 0], [0, 1]]); } catch (e) { threw = true; }
  assert(threw, '3.5 negative stddev throws');
}

// =====================================================================
// §4 — UK-CMA correlation matrix end-to-end (bundle is PSD)
// =====================================================================

console.log('§4 — UK-CMA correlation matrix end-to-end');

const ukCmaCorrelation = [
  [1.0, 0.85, 0.72, -0.10, -0.05, 0.45, 0.65, 0.05],
  [0.85, 1.0, 0.78, -0.12, -0.08, 0.42, 0.62, 0.03],
  [0.72, 0.78, 1.0, -0.05, 0.0, 0.40, 0.55, 0.02],
  [-0.10, -0.12, -0.05, 1.0, 0.85, 0.55, 0.10, 0.35],
  [-0.05, -0.08, 0.0, 0.85, 1.0, 0.70, 0.15, 0.25],
  [0.45, 0.42, 0.40, 0.55, 0.70, 1.0, 0.45, 0.18],
  [0.65, 0.62, 0.55, 0.10, 0.15, 0.45, 1.0, 0.08],
  [0.05, 0.03, 0.02, 0.35, 0.25, 0.18, 0.08, 1.0],
];

// 4.1 — Bundle matrix decomposes successfully (verifies PSD claim in bundle)
{
  let L = null; let threw = false;
  try { L = choleskyDecompose(ukCmaCorrelation, 'UK-CMA-2026.1.correlationMatrix.matrix'); }
  catch (e) { threw = true; }
  assert(!threw, '4.1a UK-CMA correlation matrix is positive-definite');
  assert(L && L.length === 8, '4.1b L is 8×8');
}

// 4.2 — Reconstruction within tolerance
{
  const L = choleskyDecompose(ukCmaCorrelation);
  const R = matMul(L, transpose(L));
  let maxErr = 0;
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      maxErr = Math.max(maxErr, Math.abs(R[i][j] - ukCmaCorrelation[i][j]));
    }
  }
  assert(maxErr < 1e-9, `4.2 reconstruction maxErr=${maxErr}`);
}

// =====================================================================
// §5 — sampleMultivariateNormalFromChol — properties
// =====================================================================

console.log('§5 — sampleMultivariateNormalFromChol distributional properties');

// 5.1 — Sample dimension
{
  const cov = [[1, 0], [0, 1]];
  const L = choleskyDecompose(cov);
  const rng = mulberry32(42);
  const x = sampleMultivariateNormalFromChol([0, 0], L, rng);
  assert(Array.isArray(x) && x.length === 2, '5.1a sample is length-2 array');
  assert(Number.isFinite(x[0]) && Number.isFinite(x[1]), '5.1b finite values');
}

// 5.2 — Determinism with seeded RNG
{
  const cov = [[1, 0.5], [0.5, 1]];
  const L = choleskyDecompose(cov);
  const rng1 = mulberry32(42);
  const rng2 = mulberry32(42);
  const x1 = sampleMultivariateNormalFromChol([1, 2], L, rng1);
  const x2 = sampleMultivariateNormalFromChol([1, 2], L, rng2);
  assert(approx(x1[0], x2[0]) && approx(x1[1], x2[1]), '5.2 deterministic');
}

// 5.3 — Empirical mean ≈ specified mean (large N)
{
  const cov = [[0.04, 0.01], [0.01, 0.09]]; // sigma=0.2, sigma=0.3, rho=1/6
  const L = choleskyDecompose(cov);
  const rng = mulberry32(12345);
  const N = 10000;
  const mu = [0.05, 0.10];
  let sum0 = 0, sum1 = 0;
  for (let i = 0; i < N; i++) {
    const x = sampleMultivariateNormalFromChol(mu, L, rng);
    sum0 += x[0]; sum1 += x[1];
  }
  const empMean0 = sum0 / N, empMean1 = sum1 / N;
  // Standard error of mean ≈ sigma/sqrt(N) ≈ 0.002 / 0.003. Use 5×SE tolerance.
  assert(Math.abs(empMean0 - mu[0]) < 0.01, `5.3a emp mean[0]=${empMean0.toFixed(4)} ≈ ${mu[0]}`);
  assert(Math.abs(empMean1 - mu[1]) < 0.015, `5.3b emp mean[1]=${empMean1.toFixed(4)} ≈ ${mu[1]}`);
}

// 5.4 — Empirical covariance ≈ specified covariance (large N)
{
  const cov = [[0.04, 0.012], [0.012, 0.09]];  // rho = 0.012/(0.2*0.3) = 0.2
  const L = choleskyDecompose(cov);
  const rng = mulberry32(54321);
  const N = 20000;
  const samples = new Array(N);
  for (let i = 0; i < N; i++) {
    samples[i] = sampleMultivariateNormalFromChol([0, 0], L, rng);
  }
  let s00 = 0, s01 = 0, s11 = 0;
  for (let i = 0; i < N; i++) {
    s00 += samples[i][0] * samples[i][0];
    s01 += samples[i][0] * samples[i][1];
    s11 += samples[i][1] * samples[i][1];
  }
  const empVar0 = s00 / N, empCov01 = s01 / N, empVar1 = s11 / N;
  // Variance of variance estimator ≈ 2σ⁴/N → SE on var = σ²·sqrt(2/N) ≈ 0.0004 / 0.0009
  assert(Math.abs(empVar0 - 0.04) < 0.005, `5.4a var[0]=${empVar0.toFixed(4)} ≈ 0.04`);
  assert(Math.abs(empVar1 - 0.09) < 0.01, `5.4b var[1]=${empVar1.toFixed(4)} ≈ 0.09`);
  assert(Math.abs(empCov01 - 0.012) < 0.005, `5.4c cov=${empCov01.toFixed(4)} ≈ 0.012`);
}

// 5.5 — Length mismatch errors
{
  const L = choleskyDecompose([[1, 0], [0, 1]]);
  let threw = false;
  try { sampleMultivariateNormalFromChol([1, 2, 3], L, () => 0.5); } catch (e) { threw = true; }
  assert(threw, '5.5 length mismatch throws');
}

// =====================================================================
// §6 — sampleMultivariateNormal (convenience wrapper)
// =====================================================================

console.log('§6 — sampleMultivariateNormal wrapper');

// 6.1 — Wrapper produces valid samples
{
  const rng = mulberry32(7);
  const x = sampleMultivariateNormal([0, 0], [[1, 0.3], [0.3, 1]], rng);
  assert(x.length === 2 && Number.isFinite(x[0]) && Number.isFinite(x[1]),
    '6.1 wrapper sample valid');
}

// 6.2 — Wrapper rejects non-PD covariance
{
  let threw = false;
  try { sampleMultivariateNormal([0, 0], [[-1, 0], [0, 1]]); } catch (e) { threw = true; }
  assert(threw, '6.2 non-PD cov throws via wrapper');
}

// =====================================================================
// REPORT
// =====================================================================

console.log('');
console.log(`Cholesky tests: ${pass}/${pass + fail} passing (${fail} failures)`);
if (fail > 0) {
  console.log('FAILURES:');
  failures.forEach(f => console.log('  - ' + f));
  process.exit(1);
}
process.exit(0);
