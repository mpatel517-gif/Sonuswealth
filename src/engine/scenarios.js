// ─────────────────────────────────────────────────────────────────────────────
// SONUSWEALTH / FINIO — SCENARIO ENGINE (Monte Carlo + projection helpers)
//
// NEW v0.3 — MASTER-SPEC §3.1 / route-8-drilldowns.md §2 + §2.1
//
// Functions:
//   · monteCarloPOS(entity, schedule, options)  — pot-of-survival probability
//
// Performance target: < 500ms at 5000 simulations on a modern laptop.
// Pure functions only — no UI, no copy, no side effects.
// ─────────────────────────────────────────────────────────────────────────────

import { pensionTotal } from './_helpers.js';

// ── Box-Muller normal sampling (deterministic seedable via Math.random) ────
function _boxMuller() {
  // Two independent N(0,1) samples per call; we only need one.
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Monte Carlo Probability of Survival (POS) for pension pot under a drawdown
 * schedule + CMA assumptions. Returns the % of simulations where the pot
 * survives to terminalAge, plus percentile bands by age.
 *
 * Schedule semantics:
 *   · Array form: [yr0_drawdown, yr1_drawdown, …] — indexed from "now".
 *   · Object form: { 0: amt, 1: amt, … } keyed by year offset.
 *   · Scalar fallback: schedule.annual or numeric → flat annual drawdown.
 *   · If schedule is shorter than projection horizon, last value persists.
 *
 * CMA assumptions:
 *   · cmaAssumptions.mean    — annual real return mean (default 0.04 = 4%)
 *   · cmaAssumptions.stdev   — annual real return stdev (default 0.10 = 10%)
 *   · cmaAssumptions.startAge — current age (default: entity.age || 65)
 *
 * @param {object} entity
 * @param {Array<number>|Object|number} schedule
 * @param {{ simulations?:number, terminalAge?:number, cmaAssumptions?:object, pensionPot?:number }} [options]
 * @returns {{ probability:number, percentilesByAge:Array<{age:number,p10:number,p50:number,p90:number}>, simulations:number, terminalAge:number, startAge:number, durationMs:number }}
 */
export function monteCarloPOS(entity, schedule, options = {}) {
  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

  const simulations = +options.simulations || 5000;
  const terminalAge = +options.terminalAge || 95;
  const cma = {
    mean: 0.04,
    stdev: 0.10,
    startAge: +(entity?.age ?? entity?.individual?.age) || 65,
    ...(options.cmaAssumptions || {}),
  };

  const startPot = +options.pensionPot || pensionTotal(entity) || 0;
  const horizonYears = Math.max(1, terminalAge - cma.startAge);

  // Normalise schedule → flat array of length horizonYears.
  const yearlyDraw = new Array(horizonYears).fill(0);
  if (Array.isArray(schedule)) {
    const last = schedule.length > 0 ? +schedule[schedule.length - 1] || 0 : 0;
    for (let i = 0; i < horizonYears; i++) {
      yearlyDraw[i] = i < schedule.length ? (+schedule[i] || 0) : last;
    }
  } else if (schedule && typeof schedule === 'object') {
    const annualFallback = +schedule.annual || 0;
    let lastSeen = annualFallback;
    for (let i = 0; i < horizonYears; i++) {
      if (schedule[i] != null) lastSeen = +schedule[i] || 0;
      else if (schedule[String(i)] != null) lastSeen = +schedule[String(i)] || 0;
      yearlyDraw[i] = lastSeen;
    }
  } else if (typeof schedule === 'number' && Number.isFinite(schedule)) {
    yearlyDraw.fill(+schedule || 0);
  }

  // Pre-allocate percentile collectors per year.
  const potsByYear = new Array(horizonYears + 1);
  for (let y = 0; y <= horizonYears; y++) {
    potsByYear[y] = new Float64Array(simulations);
  }

  let survived = 0;
  for (let s = 0; s < simulations; s++) {
    let pot = startPot;
    potsByYear[0][s] = pot;
    let alive = true;
    for (let y = 0; y < horizonYears; y++) {
      if (!alive) {
        potsByYear[y + 1][s] = 0;
        continue;
      }
      // Annual real return ~ N(mean, stdev)
      const r = cma.mean + cma.stdev * _boxMuller();
      // Order: drawdown happens at start of year, then growth on remainder.
      pot -= yearlyDraw[y];
      if (pot <= 0) {
        pot = 0;
        alive = false;
      } else {
        pot = pot * (1 + r);
        if (pot < 0) pot = 0;
      }
      potsByYear[y + 1][s] = pot;
    }
    if (alive && pot > 0) survived++;
  }

  const probability = simulations > 0 ? (survived / simulations) * 100 : 0;

  // Build percentile bands per age.
  const percentilesByAge = [];
  for (let y = 0; y <= horizonYears; y++) {
    const arr = potsByYear[y];
    // Sort copy for percentile lookup.
    const sorted = Array.from(arr).sort((a, b) => a - b);
    const p10 = sorted[Math.floor(simulations * 0.10)] ?? 0;
    const p50 = sorted[Math.floor(simulations * 0.50)] ?? 0;
    const p90 = sorted[Math.floor(simulations * 0.90)] ?? 0;
    percentilesByAge.push({
      age: cma.startAge + y,
      p10: Math.round(p10),
      p50: Math.round(p50),
      p90: Math.round(p90),
    });
  }

  const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

  return {
    probability: Math.round(probability * 10) / 10,
    percentilesByAge,
    simulations,
    terminalAge,
    startAge: cma.startAge,
    durationMs: Math.round(t1 - t0),
  };
}
