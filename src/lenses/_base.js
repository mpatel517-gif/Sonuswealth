// ─────────────────────────────────────────────────────────────────────────────
// SONUSWEALTH LENS BASE — shared utilities for all professional lenses
//
// Every lens implements the 5-method interface specified in ARCHITECTURE-V0.md §3:
//   - is_relevant(persona, asOfDate)    → { score: 0..1, reason }
//   - observe(persona, asOfDate)        → Observation[]
//   - recommend(persona, asOfDate, obj) → Recommendation[]
//   - red_flags(persona)                → RedFlag[]
//   - what_if_prompts(persona)          → string[]
// ─────────────────────────────────────────────────────────────────────────────

export const SEVERITY = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
export const URGENCY = { ROUTINE: 1, SOON: 2, URGENT: 3, IMMEDIATE: 4 };

export function fmt(n) {
  if (n == null || Number.isNaN(n)) return '—';
  if (typeof n !== 'number') return String(n);
  return '£' + Math.round(n).toLocaleString('en-GB');
}

export function pct(n, decimals = 1) {
  if (n == null) return '—';
  return (n * 100).toFixed(decimals) + '%';
}

// Days until April 5 of next tax year end (UK)
export function daysToTaxYearEnd(asOfDate = new Date()) {
  const year = asOfDate.getFullYear();
  let endApril5 = new Date(Date.UTC(year, 3, 5));    // April 5 this year
  if (asOfDate > endApril5) endApril5 = new Date(Date.UTC(year + 1, 3, 5));
  const ms = endApril5 - asOfDate;
  return Math.ceil(ms / 86400000);
}

// Days until April 6 2027 (SIPP IHT inclusion)
export function daysToSippIht(asOfDate = new Date()) {
  const target = new Date(Date.UTC(2027, 3, 6));
  return Math.ceil((target - asOfDate) / 86400000);
}

// Compute persona age at a given date
export function ageAt(persona, asOfDate = new Date()) {
  if (persona.dob) {
    const dob = new Date(persona.dob);
    let years = asOfDate.getFullYear() - dob.getFullYear();
    if (asOfDate.getMonth() < dob.getMonth() ||
       (asOfDate.getMonth() === dob.getMonth() && asOfDate.getDate() < dob.getDate())) years--;
    return years;
  }
  return persona.age ?? null;
}

// Sum all asset values (for estate-size checks)
export function grossAssets(persona) {
  if (!persona.assets) return 0;
  let total = 0;
  for (const v of Object.values(persona.assets)) {
    if (typeof v === 'object' && v !== null) {
      total += v.value ?? v.total ?? v.outstanding ?? 0;
    }
  }
  return total;
}

// Total gross taxable income for a persona (best-effort heuristic)
export function grossIncome(persona) {
  const t = persona.targetIncome ?? 0;
  const s = persona.income?.salary ?? 0;
  const b = persona.income?.bonus ?? 0;
  const d = persona.drawdown ?? 0;
  const dp = persona.drawdownPlan?.targetAnnual ?? 0;
  // If they target an income but haven't started drawing, project from drawdownPlan
  if (d === 0 && dp > 0) return Math.max(t, dp + s + b);
  return Math.max(t, d + s + b);
}

// Recommendation/Observation builders — keep structure consistent across lenses
export function observation({ id, severity, category, text, citation, finding }) {
  return { id, type: 'observation', severity, category, text, citation, finding };
}

export function recommendation({ id, strategy_id, headline, drill_down, action_steps,
                                  impact, risk, citation, assumptions, flip_conditions,
                                  fca_boundary, common_mistakes }) {
  return {
    id, type: 'recommendation', strategy_id, headline, drill_down,
    action_steps, impact, risk, citation, assumptions,
    flip_conditions, fca_boundary, common_mistakes,
  };
}

export function redFlag({ id, urgency, action, deadline, cost_of_inaction, citation }) {
  return { id, type: 'red_flag', urgency, action, deadline, cost_of_inaction, citation };
}
