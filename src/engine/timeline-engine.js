// ─────────────────────────────────────────────────────────────────────────────
// SONUSWEALTH TIMELINE ENGINE — A5
// Five Timeline suite function groups (TL v1.0 §10): calcAPQTimeline ·
// calcMilestones · calcGoalProgress · calcScoreHistory · calcRiskHistory ·
// Scenario CRUD (in-memory stub — Supabase persistence at Phase 2).
// Pure functions except Scenario CRUD (stateful in-memory store for demo).
// ─────────────────────────────────────────────────────────────────────────────

import {
  TAX, calcFQ, calcAPQ, calcRisk, netWorth, ihtSippDelta, daysLeft, fmt,
} from './fq-calculator.js';

const TL_ENGINE_VERSION = 'TL-1.0';

// ── UK MILESTONE CATALOGUE — v1.0 ────────────────────────────────────────────
// Pending move to rules bundle UK-2026.1.milestones at Phase 2.
const UK_MILESTONE_CATALOGUE = [
  { id: 'nw_100k',           type: 'net_worth',   threshold: 100_000,   label: 'First £100,000 net worth'        },
  { id: 'nw_250k',           type: 'net_worth',   threshold: 250_000,   label: '£250,000 net worth'              },
  { id: 'nw_500k',           type: 'net_worth',   threshold: 500_000,   label: 'Half a million net worth'        },
  { id: 'nw_1m',             type: 'net_worth',   threshold: 1_000_000, label: 'Millionaire milestone'           },
  { id: 'nw_2m',             type: 'net_worth',   threshold: 2_000_000, label: '£2 million net worth'            },
  { id: 'nw_3m',             type: 'net_worth',   threshold: 3_000_000, label: '£3 million net worth'            },
  { id: 'nw_5m',             type: 'net_worth',   threshold: 5_000_000, label: '£5 million net worth'            },
  { id: 'nw_10m',            type: 'net_worth',   threshold: 10_000_000, label: '£10 million net worth'          },
  { id: 'debt_free',         type: 'behavioural', label: 'Debt free'                                            },
  { id: 'safety_net',        type: 'behavioural', label: 'Emergency fund complete'                              },
  { id: 'fi',                type: 'behavioural', label: 'Financially independent'                              },
  { id: 'trust_established', type: 'behavioural', label: 'Trust established'                                    },
  { id: 'first_drawdown',    type: 'behavioural', label: 'Pension drawdown started'                             },
  { id: 'pension_nominated', type: 'behavioural', label: 'All pension nominations current'                      },
  { id: 'isa_maxed',         type: 'behavioural', label: 'ISA allowance maximised'                              },
];

// ── PRIVATE: iso duration string from days ────────────────────────────────────
function _isoDuration(days) {
  const y = Math.floor(days / 365); const m = Math.floor((days % 365) / 30);
  return `P${y > 0 ? y + 'Y' : ''}${m > 0 ? m + 'M' : ''}`;
}

// ── FUTURE TAX LIABILITIES (M3) ───────────────────────────────────────────────
// Dated tax payments for the Timeline calendar: Self-Assessment balancing + the
// two payments on account, and the 60-day CGT property report. Amounts come from
// the SA computation (passed via opts.sa so this stays free of a sa-computation
// import — no engine cycle). ISO-pure: the screen formats dates + computes
// daysAway. The SIPP-IHT countdown is owned by the existing `sipp-iht` calendar
// row, so it is deliberately NOT emitted here (no duplicate).
//
// Dates are the NEXT occurrence from `now` (a forward "money coming due" view),
// with amounts from the current-year estimate — so a long horizon surfaces
// "31 Jan: file & pay ~£X + first POA ~£Y". Flagged as estimates when provisional.
//
// @param {object} entity
// @param {object} [opts] — { sa: saComputation(entity) result, now?: Date }
// @returns {Array<{id,dateISO,amount,category,title,detail,sources}>}
export function calcTaxLiabilities(entity, opts = {}) {
  const now = opts.now instanceof Date ? opts.now : new Date();
  const sa = opts.sa;
  const items = [];
  if (!entity) return items;

  if (sa && sa.computation) {
    const c = sa.computation;
    const est = sa.confidence === 'low' ? ' (estimate)' : '';
    // Build in UTC so toISOString() doesn't shift the calendar day on a machine
    // east of UTC (BST → 31 Jul local midnight = 30 Jul UTC).
    const y = now.getUTCFullYear();
    const nextJan31 = new Date(Date.UTC(y, 0, 31)); if (nextJan31 <= now) nextJan31.setUTCFullYear(y + 1);
    const nextJul31 = new Date(Date.UTC(y, 6, 31)); if (nextJul31 <= now) nextJul31.setUTCFullYear(y + 1);
    const iso = (d) => d.toISOString().slice(0, 10);

    if (c.balancing_payment > 0) {
      items.push({
        id: 'sa-balancing', dateISO: iso(nextJan31), amount: c.balancing_payment, category: 'statutory',
        title: 'Self-assessment — file & pay balance',
        detail: `Estimated balance due ${fmt(c.balancing_payment)}${est} · file SA100`,
        sources: ['Your Self-Assessment estimate', 'HMRC SA deadline 31 Jan'],
      });
    }
    const poa = c.poa_next_year || [];
    if (poa[0]?.amount > 0) {
      items.push({
        id: 'sa-poa-1', dateISO: iso(nextJan31), amount: poa[0].amount, category: 'statutory',
        title: 'First payment on account', detail: `~${fmt(poa[0].amount)} towards next year's tax${est}`,
        sources: ['Your Self-Assessment estimate', 'TMA 1970 s59A'],
      });
    }
    if (poa[1]?.amount > 0) {
      items.push({
        id: 'sa-poa-2', dateISO: iso(nextJul31), amount: poa[1].amount, category: 'statutory',
        title: 'Second payment on account', detail: `~${fmt(poa[1].amount)} towards next year's tax${est}`,
        sources: ['Your Self-Assessment estimate', 'TMA 1970 s59A'],
      });
    }
  }

  // 60-day CGT property report — per realised property disposal this year.
  const disposals = entity?.assets?.cgt?.realisedThisYear || [];
  for (const r of disposals) {
    const label = String(r.asset || r.assetType || r.type || '');
    const isProperty = /propert|land|residential|btl|buy.?to.?let|second home/i.test(label);
    if (isProperty && r.saleDate && (r.gain || 0) > 0) {
      const due = new Date(new Date(r.saleDate).getTime() + 60 * 86400000);
      items.push({
        id: `cgt-60-${(r.asset || 'property').toString().slice(0, 24)}`,
        dateISO: due.toISOString().slice(0, 10), amount: null, category: 'statutory',
        title: 'Capital gains tax — 60-day property report',
        detail: 'Report and pay CGT within 60 days of completion.',
        sources: ['Your property disposal', 'HMRC 60-day CGT reporting rule'],
      });
    }
  }

  return items;
}

// ── PRIVATE: synthetic achieved-at from today's NW + estimated growth rate ───
function _syntheticAchievedAt(threshold, currentNW, growthRate = 0.07) {
  if (currentNW < threshold) return null;
  if (!Number.isFinite(currentNW) || currentNW <= 0 || threshold <= 0) return null;
  const years = Math.log(currentNW / threshold) / Math.log(1 + growthRate);
  if (!Number.isFinite(years)) return null;
  const d = new Date();
  d.setFullYear(d.getFullYear() - Math.round(years));
  return d.toISOString();
}

// ── PRIVATE: synthetic projected hit date from growth projection ──────────────
function _syntheticProjectedAt(threshold, currentNW, growthRate = 0.05) {
  if (currentNW >= threshold) return null;
  if (!Number.isFinite(currentNW) || currentNW <= 0 || threshold <= 0) return null;
  const years = Math.log(threshold / currentNW) / Math.log(1 + growthRate);
  if (!Number.isFinite(years) || years > 200) return null; // cap at 200y horizon
  const d = new Date();
  d.setFullYear(d.getFullYear() + Math.round(years));
  d.setDate(1);
  return d.toISOString().substring(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1 — calcAPQTimeline — additive wrapper over calcAPQ
// ─────────────────────────────────────────────────────────────────────────────

// Deadline + category for each known APQ item
const APQ_TIMELINE_META = {
  'pension-drawdown':   { category: 'estate',    reminderCadence: 'one-shot',  deadlineFn: () => TAX.deadline.toISOString().substring(0, 10) },
  'life-insurance':     { category: 'estate',    reminderCadence: 'biennial',  deadlineFn: () => null },
  'life-in-trust':      { category: 'estate',    reminderCadence: 'biennial',  deadlineFn: () => null },
  'isa-allowance':      { category: 'tax',        reminderCadence: 'annual',   deadlineFn: () => `${new Date().getFullYear()}-04-05` },
  'cgt-bedisa':         { category: 'tax',        reminderCadence: 'annual',   deadlineFn: () => `${new Date().getFullYear()}-04-05` },
  'pension-consolidate':{ category: 'mymoney',   reminderCadence: 'one-shot',  deadlineFn: () => null },
  'nominations':        { category: 'estate',    reminderCadence: 'biennial',  deadlineFn: () => null },
  'pay-optimise':       { category: 'tax',        reminderCadence: 'annual',   deadlineFn: () => `${new Date().getFullYear()}-04-05` },
};

/**
 * APQ enriched for Timeline: adds deadline, category, coiLink, reminderCadence.
 * Wraps existing calcAPQ — no modification to fq-calculator.js.
 * @param {object} entity
 * @param {object} [bundle]
 * @returns {Array<{id, priority, title, detail, deadline, category, coiLink, reminderCadence, impact, screen}>}
 */
export function calcAPQTimeline(entity, bundle = null) {
  const base = calcAPQ(entity);
  const coi  = ihtSippDelta(entity);
  const dl   = daysLeft();

  return base.map(item => {
    const meta = APQ_TIMELINE_META[item.id] ?? {};
    const deadline = meta.deadlineFn ? meta.deadlineFn() : null;
    const coiLink = (item.id === 'pension-drawdown' && coi > 0) ? {
      byActionKey:  'start_drawdown',
      savings:       Math.round(coi),
      daysToImpact:  dl,
    } : null;

    return {
      ...item,
      deadline,
      category:        meta.category        ?? 'mymoney',
      coiLink,
      reminderCadence: meta.reminderCadence ?? 'one-shot',
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2 — calcMilestones
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Achieved + projected milestones from UK milestone catalogue.
 * achievedAt timestamps are synthetic when no event log present.
 * @param {object} entity
 * @param {object} [bundle]
 * @returns {{ achieved, projected, catalogue, confidence, rulesVersion }}
 */
export function calcMilestones(entity, bundle = null) {
  const catalogue = bundle?.milestones ?? UK_MILESTONE_CATALOGUE;
  const nw        = netWorth(entity);
  const a         = entity.assets ?? {};
  const age       = entity.age ?? 30;
  const events    = entity.events ?? [];

  // Resolve behavioural milestone states
  const behaviouralStates = {
    debt_free:         (entity.liabilities?.mortgage?.outstanding ?? 0) === 0
                    && (entity.liabilities?.otherLoans?.length ?? 0) === 0,
    safety_net:        (() => {
                         const lifeStage = entity.lifeStage ?? 5;
                         const target = { 1:3, 2:4, 3:5, 4:6, 5:12, 6:18, 7:18 }[lifeStage] ?? 6;
                         const cash = a.cash?.own ?? a.cash?.total ?? 0;
                         const mo = (entity.targetIncome ?? 50000) / 12;
                         return mo > 0 ? (cash / mo) >= target : false;
                       })(),
    trust_established: !!(a.trustGifts),
    fi:                false,  // derived from fiState — simplified here
    first_drawdown:    (entity.drawdown ?? 0) > 0,
    pension_nominated: (a.sipp?.pensions ?? []).every(p => {
                         if (!p.nominationDate) return false;
                         return (Date.now() - new Date(p.nominationDate)) < 3 * 365.25 * 86400_000;
                       }),
    isa_maxed:         false,  // no way to know from snapshot — requires event log
  };

  const achieved = [];
  const projected = [];

  for (const m of catalogue) {
    if (m.type === 'net_worth') {
      if (nw >= m.threshold) {
        // Achieved — synthesise achievedAt from historical accumulation
        const achievedAt = events.find(e => e.milestone_id === m.id)?.date
          ?? _syntheticAchievedAt(m.threshold, nw, 0.07);

        const prior = catalogue.filter(p => p.type === 'net_worth' && p.threshold < m.threshold)
          .sort((a, b) => b.threshold - a.threshold)[0];

        const nowMs = Date.now();
        const achMs = achievedAt ? new Date(achievedAt).getTime() : nowMs;
        const days  = Math.max(0, (nowMs - achMs) / 86400_000);

        achieved.push({
          milestoneId:    m.id,
          label:          m.label,
          achievedAt:     achievedAt ? new Date(achievedAt).toISOString() : new Date().toISOString(),
          elapsed:        _isoDuration(days),
          delta:          { netWorth: m.threshold, fromMilestone: prior?.threshold ?? 0 },
          celebrated:     false,
          synthetic:      !events.find(e => e.milestone_id === m.id),
        });
      } else {
        // Projected — estimate from growth at current trajectory
        const growth    = a.sipp?.growth ?? 0.05;
        const projected_at = _syntheticProjectedAt(m.threshold, nw, growth);
        projected.push({
          milestoneId:   m.id,
          label:         m.label,
          projectedAt:   projected_at,
          progress:      nw > 0 ? Math.min(0.99, nw / m.threshold) : 0,
          confidence:    'MEDIUM',
          assumptions:   { growth, currentNW: Math.round(nw) },
        });
      }
    } else {
      // Behavioural milestones
      const isAchieved = behaviouralStates[m.id] ?? false;
      const achievedAt = events.find(e => e.milestone_id === m.id)?.date;

      if (isAchieved) {
        achieved.push({
          milestoneId: m.id,
          label:       m.label,
          achievedAt:  achievedAt ?? new Date().toISOString(),
          elapsed:     achievedAt ? _isoDuration((Date.now() - new Date(achievedAt)) / 86400_000) : 'P0D',
          delta:       {},
          celebrated:  false,
          synthetic:   !achievedAt,
        });
      } else if (m.id !== 'isa_maxed') {
        projected.push({
          milestoneId: m.id,
          label:       m.label,
          projectedAt: null,
          progress:    0,
          confidence:  'LOW',
          assumptions: {},
        });
      }
    }
  }

  // Sort achieved by achievedAt desc, projected by progress desc
  achieved.sort((a, b) => new Date(b.achievedAt) - new Date(a.achievedAt));
  projected.sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0));

  return {
    achieved,
    projected,
    catalogue,
    confidence:  'MEDIUM',
    rulesVersion: entity.rulesVersion ?? 'UK-2026.1',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3 — calcGoalProgress
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-goal progress and projected hit date.
 * template_id drives computation: 'net_worth_target' | 'savings_rate' | 'fi' | 'custom'.
 * @param {object} goal - { goalId, template_id, target, targetDate, unit?, label? }
 * @param {object} entity
 * @param {object} [bundle]
 * @returns {{ goalId, progress, projectedHitDate, targetDate, aheadOrBehind, contribution, confidence, rulesVersion }}
 */
export function calcGoalProgress(goal, entity, bundle = null) {
  const { goalId = 'unknown', template_id = 'custom', target, targetDate } = goal;
  const nw    = netWorth(entity);
  const inc   = entity.income ?? {};
  const spend = entity.targetIncome ?? 50000;
  const growth = entity.assets?.sipp?.growth ?? 0.05;

  let progress = 0;
  let projectedHitDate = null;
  let confidence = 'MEDIUM';
  let contribution = null;

  switch (template_id) {
    case 'net_worth_target': {
      progress = target > 0 ? Math.min(1, nw / target) : 0;
      if (progress < 1) {
        projectedHitDate = _syntheticProjectedAt(target, nw, growth);
      }
      break;
    }

    case 'savings_rate': {
      // target is a monthly savings amount; entity must have income
      const monthlyIncome = (inc.employment ?? 0) / 12 + (inc.dividends ?? 0) / 12;
      const monthlySpend  = spend / 12;
      const actualRate    = monthlyIncome > 0 ? Math.max(0, (monthlyIncome - monthlySpend) / monthlyIncome) : 0;
      const targetRate    = target > 0 ? target : 0.2;  // target as decimal (e.g. 0.20 = 20%)
      progress = targetRate > 0 ? Math.min(1, actualRate / targetRate) : 0;
      confidence = monthlyIncome > 0 ? 'HIGH' : 'LOW';
      contribution = {
        monthly_avg:      Math.round(monthlyIncome - monthlySpend),
        last_12mo_total:  Math.round((monthlyIncome - monthlySpend) * 12),
        drag_explanations: monthlyIncome === 0 ? ['No active income captured'] : [],
      };
      break;
    }

    case 'fi': {
      const investable = (entity.assets?.sipp?.total ?? 0)
        + (typeof entity.assets?.isa === 'number' ? entity.assets.isa : (entity.assets?.isa?.value ?? 0))
        + (entity.assets?.portfolio?.value ?? 0)
        + (entity.assets?.cash?.own ?? entity.assets?.cash?.total ?? 0);
      const retirementAge = entity.retirementAge ?? TAX.spa;
      const stage  = entity.lifeStage ?? 5;
      const swr    = entity.swrOverride ?? (stage >= 5 ? 0.037 : TAX.swr);
      const horizon = Math.max(0, retirementAge - (entity.age ?? 30));
      const projected = horizon > 0 ? investable * Math.pow(1 + growth, horizon) : investable;
      const required  = Math.round((spend * Math.pow(1.025, horizon)) / swr);
      progress = required > 0 ? Math.min(1, projected / required) : 0;
      if (progress < 1) {
        const yearsNeeded = Math.log(required / investable) / Math.log(1 + growth);
        const d = new Date();
        d.setFullYear(d.getFullYear() + Math.ceil(yearsNeeded));
        projectedHitDate = d.toISOString().substring(0, 10);
      }
      confidence = 'MEDIUM';
      break;
    }

    default: {
      // Custom goal: progress from user-supplied measurement / target
      const measurement = goal.measurement ?? goal.current ?? 0;
      progress = target > 0 ? Math.min(1, measurement / target) : 0;
      confidence = 'LOW';
      break;
    }
  }

  // aheadOrBehind: compare projectedHitDate vs targetDate
  let aheadOrBehind = null;
  if (projectedHitDate && targetDate) {
    const days = Math.round((new Date(targetDate) - new Date(projectedHitDate)) / 86400_000);
    aheadOrBehind = (days >= 0 ? '+' : '') + _isoDuration(Math.abs(days)) + (days < 0 ? '_behind' : '');
  }

  return {
    goalId,
    progress:        Math.round(progress * 100) / 100,
    projectedHitDate,
    targetDate:      targetDate ?? null,
    aheadOrBehind,
    contribution:    contribution ?? { monthly_avg: 0, last_12mo_total: 0, drag_explanations: [] },
    confidence,
    rulesVersion:    entity.rulesVersion ?? 'UK-2026.1',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4 — calcScoreHistory + calcRiskHistory
// ─────────────────────────────────────────────────────────────────────────────

const RANGE_TO_MONTHS = { '3mo': 3, '6mo': 6, '12mo': 12, '24mo': 24, 'all-time': 60 };
const RANGE_TO_INTERVAL = { '3mo': 1, '6mo': 1, '12mo': 1, '24mo': 3, 'all-time': 6 };

function _buildHistory(today, range, noiseScale = 0.5) {
  const months   = RANGE_TO_MONTHS[range] ?? 12;
  const interval = RANGE_TO_INTERVAL[range] ?? 1;
  const points   = [];
  const now      = new Date();

  // Walk back from today, adding gentle historical drift
  let score = today;
  const snapCount = Math.ceil(months / interval);

  for (let i = snapCount; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i * interval, 1);
    if (i > 0) {
      // Synthetic backward: score was slightly lower, with noise
      score = Math.max(0, Math.min(100,
        today - (i * (noiseScale * 0.5)) + (Math.sin(i * 1.3) * noiseScale)
      ));
    } else {
      score = today;
    }
    points.push({ date: d.toISOString().substring(0, 10), score: Math.round(score), synthetic: i > 0 });
  }
  return points;
}

function _buildAnnotations(entity, points, scoreType) {
  const annotations = [];

  // Finance Act 2026 rule change (March 2026)
  const rulesChangeDate = '2026-03-18';
  if (points.some(p => p.date <= rulesChangeDate && rulesChangeDate <= points[points.length - 1]?.date)) {
    annotations.push({
      date:        rulesChangeDate,
      type:        'rule_change',
      eventId:     'finance-act-2026',
      delta:       scoreType === 'fq' ? -3 : -2,
      description: 'Finance Act 2026 enacted — SIPP IHT inclusion from April 2027',
    });
  }

  return annotations;
}

/**
 * Finio Score time-series with annotations.
 * Synthetic when entity has no event log. Points are monthly for ≤12mo.
 * @param {object} entity
 * @param {string} [range='12mo'] - '3mo'|'6mo'|'12mo'|'24mo'|'all-time'
 * @param {object} [bundle]
 * @returns {{ range, points, annotations, todayScore, confidence, rulesVersion }}
 */
export function calcScoreHistory(entity, range = '12mo', bundle = null) {
  const today = calcFQ(entity).total;
  // Phase 2 Batch A.6 — prefer stored trajectory when persona carries one.
  // Stored shape is [{date, score}]; map to points + override today with last value.
  const stored = entity?.trajectories?.scoreHistory;
  let points;
  if (Array.isArray(stored) && stored.length >= 6) {
    points = stored.map(p => ({ date: p.date, score: p.score, annotated: false }));
  } else {
    points = _buildHistory(today, range, 1.5);
  }
  const annots = _buildAnnotations(entity, points, 'fq');
  const hasRealHistory = Array.isArray(stored)
    ? true
    : (entity.events ?? []).some(e => e.type?.startsWith('FQ_'));

  for (const ann of annots) {
    const pt = points.find(p => p.date <= ann.date);
    if (pt) pt.annotated = true;
  }

  return {
    range,
    points,
    annotations: annots,
    todayScore:  today,
    confidence:  hasRealHistory ? 'HIGH' : 'LOW',
    rulesVersion: entity.rulesVersion ?? 'UK-2026.1',
  };
}

/**
 * Risk Score time-series with annotations.
 * @param {object} entity
 * @param {string} [range='12mo']
 * @param {object} [bundle]
 * @returns {{ range, points, annotations, todayScore, confidence, rulesVersion }}
 */
export function calcRiskHistory(entity, range = '12mo', bundle = null) {
  const today = calcRisk(entity).total;
  // Phase 2 Batch A.6 — prefer stored trajectory.
  const stored = entity?.trajectories?.riskHistory;
  let points;
  if (Array.isArray(stored) && stored.length >= 6) {
    points = stored.map(p => ({ date: p.date, score: p.score, annotated: false }));
  } else {
    points = _buildHistory(today, range, 1.0);
  }
  const annots = _buildAnnotations(entity, points, 'risk');
  const hasRealHistory = Array.isArray(stored)
    ? true
    : (entity.events ?? []).some(e => e.type?.startsWith('RISK_'));

  for (const ann of annots) {
    const pt = points.find(p => p.date <= ann.date);
    if (pt) pt.annotated = true;
  }

  return {
    range,
    points,
    annotations: annots,
    todayScore:  today,
    confidence:  hasRealHistory ? 'HIGH' : 'LOW',
    rulesVersion: entity.rulesVersion ?? 'UK-2026.1',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5 — Scenario CRUD (in-memory store · Supabase at Phase 2)
// ─────────────────────────────────────────────────────────────────────────────

// Module-level in-memory store — replaced by Supabase event-store at Phase 2
const _store = new Map();
let   _seq   = 1;

function _scId() { return `sc_${String(_seq++).padStart(5, '0')}`; }

/**
 * List saved scenarios for a user, with optional source/status filters.
 * @param {string} userId
 * @param {{ source?: string, status?: string }} [filters]
 * @returns {Array<{scenarioId, name, source, saved_at, rules_version, status, progress}>}
 */
export function listScenarios(userId, filters = {}) {
  const results = [];
  for (const sc of _store.values()) {
    if (sc.userId !== userId) continue;
    if (sc.status === 'deleted') continue;
    if (filters.source && sc.source !== filters.source) continue;
    if (filters.status && sc.status !== filters.status) continue;
    results.push({
      scenarioId:   sc.scenarioId,
      name:         sc.name,
      source:       sc.source,
      saved_at:     sc.saved_at,
      rules_version: sc.rules_version,
      status:       sc.status,
    });
  }
  return results.sort((a, b) => new Date(b.saved_at) - new Date(a.saved_at));
}

/**
 * Open a scenario for viewing. mode 'snapshot' returns saved state; 'current' re-runs engine.
 * @param {string} scenarioId
 * @param {'snapshot'|'current'} [mode='snapshot']
 * @param {object} [currentEntity] - required for mode='current'
 * @returns {object|null} full scenario or null if not found
 */
export function openScenario(scenarioId, mode = 'snapshot', currentEntity = null) {
  const sc = _store.get(scenarioId);
  if (!sc || sc.status === 'deleted') return null;
  if (mode === 'current' && currentEntity) {
    // Re-run saved_inputs against current entity state
    const rerunOutput = {
      fqScore:   calcFQ(currentEntity).total,
      riskScore: calcRisk(currentEntity).total,
      nw:        netWorth(currentEntity),
      coi:       ihtSippDelta(currentEntity),
      rerun_at:  new Date().toISOString(),
      stale_rules: sc.rules_version !== (currentEntity.rulesVersion ?? 'UK-2026.1'),
    };
    return { ...sc, rerun_output: rerunOutput, opened_in: 'current' };
  }
  return { ...sc, opened_in: 'snapshot' };
}

/**
 * Save a new scenario to the in-memory store.
 * O-TL-18: source_spec_version field included per v1.1 patch.
 * @param {object} scenarioData
 * @returns {{ scenarioId, saved_at }}
 */
export function saveScenario(scenarioData) {
  const id = _scId();
  const now = new Date().toISOString();
  const sc = {
    scenarioId:          id,
    userId:              scenarioData.userId     ?? 'u_unknown',
    name:                scenarioData.name       ?? 'Untitled scenario',
    source:              scenarioData.source     ?? 'mymoney',
    source_action_id:    scenarioData.source_action_id ?? null,
    source_spec_version: scenarioData.source_spec_version ?? null,  // O-TL-18
    saved_at:            now,
    saved_state_snapshot: scenarioData.saved_state_snapshot ?? {},
    saved_inputs:        scenarioData.saved_inputs  ?? {},
    saved_output:        scenarioData.saved_output  ?? {},
    rules_version:       scenarioData.rules_version ?? 'UK-2026.1',
    cma_version:         scenarioData.cma_version   ?? 'UK-CMA-2026.1',
    status:              'active',
    promoted_decision_id: null,
    deleted_at:          null,
  };
  _store.set(id, sc);
  return { scenarioId: id, saved_at: now };
}

/**
 * Update an existing scenario.
 * @param {string} scenarioId
 * @param {object} updates
 * @returns {{ scenarioId, updated_at }|null}
 */
export function updateScenario(scenarioId, updates) {
  const sc = _store.get(scenarioId);
  if (!sc || sc.status === 'deleted') return null;
  const now = new Date().toISOString();
  _store.set(scenarioId, { ...sc, ...updates, scenarioId, updated_at: now });
  return { scenarioId, updated_at: now };
}

/**
 * Soft-delete a scenario (marks deleted: true, does not erase).
 * @param {string} scenarioId
 * @returns {{ scenarioId, deleted_at }|null}
 */
export function deleteScenario(scenarioId) {
  const sc = _store.get(scenarioId);
  if (!sc) return null;
  const now = new Date().toISOString();
  _store.set(scenarioId, { ...sc, status: 'deleted', deleted_at: now });
  return { scenarioId, deleted_at: now };
}
