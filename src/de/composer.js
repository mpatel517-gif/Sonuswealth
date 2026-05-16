/**
 * src/de/composer.js — Dynamic prompt composer for the Decision Engine
 *
 * One function: buildPrompt(entity, eventIds, userQuery, userAnswers?)
 * Returns a prompt string ready to send to Claude.
 *
 * Four layers assembled at runtime:
 *   1. User's financial picture (engine-derived — no invented numbers)
 *   2. Active deadlines (rules-uk.js + engine)
 *   3. The event(s) + user's own words + any follow-up answers
 *   4. Response contract (Claude MUST return this exact JSON shape)
 */

import { EVENTS, mergeEventContexts, DEADLINES } from './ontology.js';
import {
  TAX,
  calcNetWorth,
  ihtDynamic,
  daysLeft,
  monthlySurplus,
  lsaHeadroom,
  fiRatio,
  debtRatio,
  protectionScore,
  cashflowHealth,
  netWorthAtYears,
  estateReadiness,
  willLpaStatus,
  allowanceTracker,
  giftClockAll,
} from '../engine/fq-calculator.js';
import { monthlyFlow } from '../engine/monthly-flow-engine.js';

// ── Safe engine call ──────────────────────────────────────────────────────────
// All composer engine calls are wrapped — a missing entity field should never
// crash the prompt builder; it just returns null and the prompt notes the gap.
function safe(fn, ...args) {
  try {
    const result = fn(...args);
    return result ?? null;
  } catch {
    return null;
  }
}

function fmt(n) {
  if (n == null || isNaN(n)) return 'unknown';
  if (Math.abs(n) >= 1_000_000) return `£${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000)    return `£${(n / 1_000).toFixed(0)}K`;
  return `£${Math.round(n).toLocaleString()}`;
}

function fmtPct(n) {
  if (n == null || isNaN(n)) return 'unknown';
  return `${(n * 100).toFixed(1)}%`;
}

function fmtDays(n) {
  if (n == null || isNaN(n) || n < 0) return 'passed';
  if (n === 0) return 'today';
  const months = Math.floor(n / 30);
  return months > 0 ? `${months} months (${n} days)` : `${n} days`;
}

// ── Layer 1: User financial picture ──────────────────────────────────────────

function buildUserState(entity) {
  const nw        = safe(calcNetWorth, entity);
  const iht       = safe(ihtDynamic, entity, true);  // includeSipp=true (ENACTED 2027)
  const surplus   = safe(monthlySurplus, entity);
  const lsa       = safe(lsaHeadroom, entity);
  const fi        = safe(fiRatio, entity);
  const debt      = safe(debtRatio, entity);
  const prot      = safe(protectionScore, entity);
  const cfHealth  = safe(cashflowHealth, entity);
  const nwY10     = safe(netWorthAtYears, entity, 10);
  const estate    = safe(estateReadiness, entity);
  const willLpa   = safe(willLpaStatus, entity);
  const allowance = safe(allowanceTracker, entity);
  const giftClks  = safe(giftClockAll, entity);
  const flow      = safe(monthlyFlow, entity);

  const age = entity?.profile?.dob
    ? Math.floor((Date.now() - new Date(entity.profile.dob)) / (365.25 * 24 * 3600 * 1000))
    : null;

  // calcNetWorth returns {net, confidence, breakdown} or null
  const nwNum = typeof nw === 'object' ? (nw?.net ?? nw?.value ?? null) : nw;
  // ihtDynamic returns {exposure, breakdown} or a number
  const ihtNum = typeof iht === 'object' ? (iht?.exposure ?? iht?.net ?? iht?.iht ?? null) : iht;
  // monthlySurplus returns {surplus, income, essential} or a number
  const surplusNum = typeof surplus === 'object' ? (surplus?.surplus ?? null) : surplus;
  // fiRatio returns {ratio, multiple, ...}
  const fiNum = typeof fi === 'object' ? (fi?.ratio ?? fi?.multiple ?? null) : fi;
  // debtRatio returns {ratio, band, ...}
  const debtNum = typeof debt === 'object' ? (debt?.ratio ?? null) : debt;
  // netWorthAtYears returns [{balance,...}] array (bengen style) or {value, ...}
  const nwY10Num = Array.isArray(nwY10)
    ? (nwY10[nwY10.length - 1]?.balance ?? null)
    : (typeof nwY10 === 'object' ? (nwY10?.value ?? nwY10?.net ?? null) : nwY10);
  // flow returns {income, expenses, ...} — income is monthly
  const flowIncome = typeof flow === 'object' ? (flow?.income ?? flow?.monthlyIncome ?? null) : null;

  return {
    netWorth:              nwNum,
    netWorthFormatted:     fmt(nwNum),
    netWorthIn10yrs:       nwY10Num,
    netWorthIn10yrsFormatted: fmt(nwY10Num),
    age,
    annualIncomeFmt:       flowIncome != null ? fmt(flowIncome * 12) : 'unknown',
    monthlySurplus:        surplusNum,
    monthlySurplusFmt:     fmt(surplusNum),
    ihtExposure:           ihtNum,
    ihtExposureFmt:        fmt(ihtNum),
    lsaHeadroom:           lsa,
    lsaHeadroomFmt:        fmt(lsa),
    fiRatio:               fiNum,
    fiRatioFmt:            fmtPct(fiNum),
    debtRatio:             debtNum,
    debtRatioFmt:          fmtPct(debtNum),
    protectionScore:       typeof prot === 'object' ? (prot?.total ?? prot?.score ?? null) : prot,
    cashflowHealth:        typeof cfHealth === 'object' ? (cfHealth?.total ?? cfHealth?.score ?? null) : cfHealth,
    estateReadiness:       typeof estate === 'object' ? estate : null,
    willStatus:            willLpa?.will ?? willLpa?.flags?.join(',') ?? null,
    lpaStatus:             willLpa?.lpa ?? null,
    allowances:            allowance,
    giftClocks:            giftClks,
    jurisdiction:          entity?.profile?.country ?? entity?.jurisdiction ?? 'UK',
    maritalStatus:         entity?.profile?.maritalStatus ?? entity?.marital_status ?? null,
    retirementAge:         entity?.profile?.retirementAge ?? entity?.target_retirement_age ?? null,
  };
}

// ── Layer 2: Active deadlines ─────────────────────────────────────────────────

const SIPP_IHT_DATE = new Date('2027-04-06');
const NMPA_DATE     = new Date('2028-04-06');
const ISA_CASH_DATE = new Date('2027-04-06');

function buildDeadlines(entity, deadlineIds) {
  const today = new Date();
  const results = [];

  if (deadlineIds.includes(DEADLINES.SIPP_IHT_2027)) {
    const days = safe(daysLeft) ?? Math.ceil((SIPP_IHT_DATE - today) / 86400000);
    results.push({
      id: DEADLINES.SIPP_IHT_2027,
      label: 'SIPP/pension enters estate for IHT',
      date: '6 April 2027',
      daysRemaining: days,
      daysFormatted: fmtDays(days),
      severity: days < 90 ? 'critical' : days < 365 ? 'high' : 'medium',
      source: 'Finance Act 2026 (Royal Assent 18 March 2026) — ENACTED',
    });
  }

  if (deadlineIds.includes(DEADLINES.TAX_YEAR_END)) {
    const nextApril5 = new Date(today.getFullYear(), 3, 5);
    if (nextApril5 < today) nextApril5.setFullYear(nextApril5.getFullYear() + 1);
    const days = Math.ceil((nextApril5 - today) / 86400000);
    results.push({
      id: DEADLINES.TAX_YEAR_END,
      label: 'Tax year end',
      date: `5 April ${nextApril5.getFullYear()}`,
      daysRemaining: days,
      daysFormatted: fmtDays(days),
      severity: days < 30 ? 'high' : 'medium',
      source: 'HMRC',
    });
  }

  if (deadlineIds.includes(DEADLINES.PENSION_AA)) {
    const nextApril5 = new Date(today.getFullYear(), 3, 5);
    if (nextApril5 < today) nextApril5.setFullYear(nextApril5.getFullYear() + 1);
    const days = Math.ceil((nextApril5 - today) / 86400000);
    const aaUsed = entity?.pensionContributions?.thisYear ?? null;
    results.push({
      id: DEADLINES.PENSION_AA,
      label: `Pension annual allowance (£${(TAX.pensionAA / 1000).toFixed(0)}K — use or lose)`,
      date: `5 April ${nextApril5.getFullYear()}`,
      daysRemaining: days,
      daysFormatted: fmtDays(days),
      severity: days < 60 ? 'high' : 'low',
      aaUsedThisYear: aaUsed,
      source: 'rules-uk.js',
    });
  }

  if (deadlineIds.includes(DEADLINES.ISA_ANNUAL)) {
    const nextApril6 = new Date(today.getFullYear(), 3, 6);
    if (nextApril6 < today) nextApril6.setFullYear(nextApril6.getFullYear() + 1);
    const days = Math.ceil((nextApril6 - today) / 86400000);
    results.push({
      id: DEADLINES.ISA_ANNUAL,
      label: `ISA allowance (£${(TAX.isaAllowance / 1000).toFixed(0)}K — use or lose)`,
      date: `6 April ${nextApril6.getFullYear()}`,
      daysRemaining: days,
      daysFormatted: fmtDays(days),
      severity: days < 60 ? 'high' : 'low',
      source: 'rules-uk.js',
    });
  }

  if (deadlineIds.includes(DEADLINES.CGT_ANNUAL)) {
    const nextApril5 = new Date(today.getFullYear(), 3, 5);
    if (nextApril5 < today) nextApril5.setFullYear(nextApril5.getFullYear() + 1);
    const days = Math.ceil((nextApril5 - today) / 86400000);
    results.push({
      id: DEADLINES.CGT_ANNUAL,
      label: `CGT annual exempt amount (£${(TAX.cgaAllowance / 1000).toFixed(0)}K — use or lose)`,
      date: `5 April ${nextApril5.getFullYear()}`,
      daysRemaining: days,
      daysFormatted: fmtDays(days),
      severity: days < 60 ? 'high' : 'low',
      source: 'rules-uk.js',
    });
  }

  if (deadlineIds.includes(DEADLINES.GIFT_7YR)) {
    const clocks = safe(giftClockAll, entity);
    if (clocks?.length) {
      results.push({
        id: DEADLINES.GIFT_7YR,
        label: `Active gift taper clocks (${clocks.length} gifts)`,
        note: 'IHT taper relief applies 3–7 years from each gift date',
        source: 'rules-uk.js',
        giftClocks: clocks.slice(0, 3),
      });
    } else {
      results.push({
        id: DEADLINES.GIFT_7YR,
        label: 'Gift 7-year taper clock',
        note: 'No active clocks — new gifts start new 7-year clocks immediately',
        source: 'rules-uk.js',
      });
    }
  }

  if (deadlineIds.includes(DEADLINES.NMPA_2028)) {
    const days = Math.ceil((NMPA_DATE - today) / 86400000);
    results.push({
      id: DEADLINES.NMPA_2028,
      label: 'Normal Minimum Pension Age rises from 55 to 57',
      date: '6 April 2028',
      daysRemaining: days,
      daysFormatted: fmtDays(days),
      severity: days < 365 ? 'high' : 'medium',
      source: 'rules-uk.js (ENACTED)',
    });
  }

  if (deadlineIds.includes(DEADLINES.ISA_CASH_SUB)) {
    const days = Math.ceil((ISA_CASH_DATE - today) / 86400000);
    results.push({
      id: DEADLINES.ISA_CASH_SUB,
      label: 'Cash ISA sub-limit of £12K applies to under-65s',
      date: '6 April 2027',
      daysRemaining: days,
      daysFormatted: fmtDays(days),
      severity: 'low',
      source: 'rules-uk.js (ENACTED)',
    });
  }

  return results;
}

// ── Layer 3: Event context ────────────────────────────────────────────────────

function buildEventContext(eventIds, userQuery, userAnswers, isCompound) {
  const events = eventIds.map(id => EVENTS[id]).filter(Boolean);
  const offOntology = events.length === 0;

  if (offOntology) {
    return {
      matched: false, offOntology: true,
      userQuery, userAnswers: userAnswers ?? {},
      note: 'No exact ontology match — running dynamic pipeline with low confidence.',
    };
  }

  return {
    matched: true, offOntology: false,
    events: events.map(e => ({
      id: e.id, category: e.category, label: e.label,
      irreversibilityBaseline: e.irreversibilityBaseline,
    })),
    compoundMode: isCompound,
    userQuery,
    userAnswers: userAnswers ?? {},
  };
}

// ── Layer 4: Response contract ────────────────────────────────────────────────
// The exact JSON shape Claude must return. Included verbatim in every prompt.

const AVAILABLE_ENGINE_CALLS = `
Available engineCall functions (always entity as first arg; extraArgs as shown):
  fq.calcNetWorth          ()
  fq.ihtDynamic            ()
  fq.monthlySurplus        ()
  fq.lsaHeadroom           ()
  fq.fiRatio               ()
  fq.debtRatio             ()
  fq.netWorthAtYears       (years: number)
  fq.bengenProjection      (years: number)
  fq.estateReadiness       ()
  fq.willLpaStatus         ()
  fq.allowanceTracker      ()
  fq.giftClockAll          ()
  fq.ihtWaterfall          ()
  fq.cashflowHealth        ()
  fq.giftClockProjection   ()
  fq.taxAndEstateImpact    (action: object)
  cashflow.probabilityOfSuccess     ()
  cashflow.fiveCashflowScenarios    ()
  cashflow.maxDrawdownExposure      ()
  cashflow.swrRegime                (regime: string)
  cashflow.realityEngineFactorisation ()
  tax.ihtExposure           ()
  tax.allowanceTracker      ()
  tax.incomeTaxDetail       (deltaIncome: number)
  tax.cgtDetail             ()
  tax.drawdownMatrix        ()
  tax.giftClockProjection   ()
  tax.willLpaStatus         ()
  tax.rnrbTaper             ()
  tax.bprQualifyingValue    ()
  tax.nominationStatus      ()
  tax.costOfInaction        ()
  tax.taxDrag               ()
  tax.taxThisYear           ()
  timeline.calcMilestones   ()
  simulator.netWorthImpact  (overrides: object)
  simulator.ihtImpact       (overrides: object)
  risk.riskShockSuite       ()
  flow.monthlyFlow          ()
  flow.allocationPressure   ()
`;

const RESPONSE_CONTRACT = `
## RESPONSE CONTRACT — return ONLY this JSON, no markdown, no explanation

{
  "events": ["event_id"],
  "decision": "The core question being decided",
  "statement": "2–3 sentence contextual summary using the user's actual numbers",
  "yourAnswers": { "key": "value or null for unanswered" },

  "research": [
    { "source": "rules-uk.js", "fact": "exact rule with value and status" },
    { "source": "live", "fact": "[MOCK] description — real data post-demo" }
  ],

  "options": [
    {
      "id": "A",
      "name": "Short option name",
      "rationale": "Why this is a valid path",
      "pros": ["string"],
      "cons": ["string"],
      "consequences": [
        {
          "metric": "ΔNW (y10)",
          "engine": "fq",
          "engineCall": { "fn": "netWorthAtYears", "extraArgs": [10] },
          "value": "Claude placeholder — validator replaces this",
          "confidence": 0.9
        }
      ],
      "irreversibility": "low | medium | high — optionally override baseline",
      "sequence": ["Step 1", "Step 2"],
      "risks": ["string"],
      "subDecisions": [{ "id": "A1", "q": "follow-up question" }]
    }
  ],

  "unconsidered": {
    "name": "Option the user didn't name",
    "why": "Why it's worth considering (FCA-compliant framing)"
  },

  "conflicts": [
    {
      "with": "deadline or competing event label",
      "severity": "high | medium | low",
      "note": "Specific conflict explanation"
    }
  ],

  "recommendation": {
    "pathId": "A",
    "rationale": "FCA-compliant: use 'one option to consider' not 'you should'",
    "fcaCompliant": true
  }
}

RULES:
- Return 3–4 options always. Option D must be the unconsidered path.
- Every option needs 2–4 consequences with engineCall populated.
- consequences[].value is a placeholder only — the validator will replace it.
- conflicts[] must reference active deadlines from the deadlines block above.
- recommendation.rationale must not say "you should". Use "one option to consider".
- fcaCompliant must be true. If you cannot make it true, omit recommendation.
- research[] must include at least one rules-uk.js source and one [MOCK] live source.
- yourAnswers keys = the fields in userAnswers that are still null (what's missing).
`;

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Build the prompt for Claude.
 *
 * @param {object} entity          - User's financial entity (full schema)
 * @param {string[]} eventIds      - Matched ontology event IDs (1 = single, N = compound)
 * @param {string} userQuery       - User's original free-text question
 * @param {object} [userAnswers]   - Answers to any follow-up questions collected so far
 * @returns {string}               - Full prompt string ready for Claude API
 */
export function buildPrompt(entity, eventIds, userQuery, userAnswers = {}) {
  const isCompound = eventIds.length > 1;
  const merged = mergeEventContexts(eventIds);

  const userState    = buildUserState(entity);
  const deadlines    = buildDeadlines(entity, merged.defaultDeadlines);
  const eventContext = buildEventContext(eventIds, userQuery, userAnswers, isCompound);

  const systemBlock = `You are the Sonuswealth Decision Engine. You produce structured financial decision trees grounded in the user's real numbers. You never invent financial figures — every consequence value you write is a placeholder that the validator will replace with a real engine calculation. Your job is to produce a correctly shaped, FCA-compliant decision tree with valid engineCall objects.`;

  const userBlock = [
    `## User financial picture (engine-derived — ${new Date().toISOString().slice(0, 10)})`,
    `Net worth: ${userState.netWorthFormatted}`,
    `Age: ${userState.age ?? 'unknown'}`,
    `Annual income: ${userState.annualIncomeFmt}`,
    `Monthly surplus: ${userState.monthlySurplusFmt}`,
    `IHT exposure (post-2027 SIPP rule): ${userState.ihtExposureFmt}`,
    `LSA headroom (pension tax-free): ${userState.lsaHeadroomFmt}`,
    `FI ratio: ${userState.fiRatioFmt}`,
    `Debt ratio: ${userState.debtRatioFmt}`,
    `Protection score: ${userState.protectionScore != null ? `${userState.protectionScore}/10` : 'unknown'}`,
    `Estate readiness: ${typeof userState.estateReadiness === 'object' ? JSON.stringify(userState.estateReadiness)?.slice(0, 120) : (userState.estateReadiness ?? 'unknown')}`,
    `Will status: ${userState.willStatus ?? 'unknown'}`,
    `LPA status: ${userState.lpaStatus ?? 'unknown'}`,
    userState.allowances ? `Allowances: ${JSON.stringify(userState.allowances).slice(0, 300)}` : '',
    '',
    `## Active deadlines`,
    deadlines.length === 0
      ? '(none for this event)'
      : deadlines.map(d =>
          `- ${d.label}: ${d.date ?? ''} (${d.daysFormatted ?? ''}) [${d.severity ?? 'info'}] — ${d.source}`
        ).join('\n'),
    '',
    `## Life event`,
    isCompound
      ? `COMPOUND MODE — ${eventIds.length} simultaneous events: ${eventIds.join(', ')}`
      : `Single event: ${eventIds[0] ?? 'unknown'}`,
    `User's question: "${userQuery}"`,
    userAnswers && Object.keys(userAnswers).length > 0
      ? `Follow-up answers: ${JSON.stringify(userAnswers)}`
      : '',
    eventContext.offOntology
      ? `⚠️ Off-ontology query — run dynamic pipeline, set confidence to LOW, surface adviser CTA.`
      : '',
    '',
    `## UK financial rules in scope (from rules-uk.js, tax year 2026/27)`,
    `ISA allowance: £${(TAX.isaAllowance / 1000).toFixed(0)}K (ENACTED)`,
    `Pension AA: £${(TAX.pensionAA / 1000).toFixed(0)}K (ENACTED) — carry-forward available if unused in prior 3 tax years`,
    `MPAA: £10K/yr if flexi-access drawdown triggered (IRREVERSIBLE — permanent, not annual). Source: rules-uk.js ENACTED`,
    `NRB: £${(TAX.nrb / 1000).toFixed(0)}K | RNRB: £${(TAX.rnrb / 1000).toFixed(0)}K`,
    `IHT rate: ${(TAX.ihtRate * 100).toFixed(0)}%`,
    `CGT exempt: £${(TAX.cgaAllowance / 1000).toFixed(0)}K`,
    `SIPP/pension enters estate for IHT: 6 April 2027 (Finance Act 2026 — ENACTED). Spousal bypass trust nominations still prevent immediate IHT for discretionary beneficiaries.`,
    `CGT rates (Oct 2024): residential 18% basic / 24% higher. Other assets 18% basic / 24% higher. Annual exempt amount £${(TAX.cgaAllowance / 1000).toFixed(0)}K. Bed-and-ISA / bed-and-SIPP within current year allowances may reduce liability.`,
    '',
    AVAILABLE_ENGINE_CALLS,
    RESPONSE_CONTRACT,
  ].filter(Boolean).join('\n');

  return `${systemBlock}\n\n${userBlock}`;
}

/**
 * Extract a summary of what context was gathered for logging / debugging.
 * Does not call Claude — just shows what the prompt contains.
 */
export function buildContextSummary(entity, eventIds, userQuery) {
  const merged   = mergeEventContexts(eventIds);
  const state    = buildUserState(entity);
  const deadlines = buildDeadlines(entity, merged.defaultDeadlines);
  return {
    eventIds,
    userQuery,
    enginesRequired: merged.requiredContext,
    deadlineCount: deadlines.length,
    deadlines: deadlines.map(d => d.label),
    netWorth: state.netWorthFormatted,
    ihtExposure: state.ihtExposureFmt,
    monthlySurplus: state.monthlySurplusFmt,
  };
}
