// trajectory-geometry.js — pure segment math for TrajectoryBar (#18, Pattern A).
// Turns (now, future, plan) into bar-segment percentages. 'grow' bars extend
// right (now→future→plan); 'shrink' bars (liabilities) scale to the largest
// magnitude so a falling balance reads as a retracting bar. Returns 0s for empty
// nodes (never NaN). No React — Node-testable.

export function trajectorySegments(now, future, plan, direction = 'grow') {
  const n = +now || 0, f = +future || 0, p = +plan || 0

  if (direction === 'shrink') {
    const max = Math.max(n, f, p, 1)
    return {
      direction,
      nowPct: 0,
      futurePct: Math.max(0, (f / max) * 100),       // balance remaining at Future
      planPct: Math.max(0, ((f - p) / max) * 100),   // extra cleared by the Plan
      remainingPct: Math.max(0, (p / max) * 100),    // balance remaining under Plan
    }
  }

  const total = Math.max(n, f, p)
  if (total <= 0) return { direction, nowPct: 0, futurePct: 0, planPct: 0 }
  const nowPct = (Math.min(n, total) / total) * 100
  const futurePct = (Math.max(0, Math.min(f, total) - n) / total) * 100
  const planPct = (Math.max(0, p - Math.max(n, f)) / total) * 100
  return { direction, nowPct, futurePct, planPct }
}
