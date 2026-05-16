// ─────────────────────────────────────────────────────────────────────────────
// CAELIXA HOME ENGINE  —  A5 Home suite · s02a
// Spec: 2-Product-home-v1_0.md §16 + v1.1 patch
// C97 computeSinceLastVisit · C98 stateTileJourney · C99 whatActionWouldItTake ·
// C100 compositeTrajectory · C101 cohortRankHistory ·
// C102 realityEngineState · C103 prcPccCurrent
// Pure functions only. No side effects. No global state.
// ─────────────────────────────────────────────────────────────────────────────

import {
  calcFQ, calcAPQ, calcAge, calcNetWorth, netWorth,
  ihtSippDelta, daysLeft, lifeStageFor, guardrail, TAX,
} from './fq-calculator.js';

// calcNetWorth returns { net, gross, ... }; netWorth returns a plain number.
// Use _nw() everywhere to handle both simple-path and complex-path entities.
function _nw(entity) {
  const full = calcNetWorth(entity);
  if (typeof full === 'object' && (full?.net ?? 0) > 0) return full.net;
  return netWorth(entity);
}
import { prcPccSpread } from './cashflow-engine.js';
import { safetyNetState, debtFreeState, fiState, beneficiaryState } from './state-tiles-engine.js';

const HOME_VERSION = 'HOME-1.0';

// ── CMA DEFAULTS (used when no bundle passed) ─────────────────────────────────
const CMA_G    = 0.058;
const CMA_VOL  = 0.145;
const CMA_INFL = 0.027;

function _cma(bundle) {
  return {
    growth:    bundle?.growth    ?? CMA_G,
    vol:       bundle?.vol       ?? CMA_VOL,
    inflation: bundle?.inflation ?? CMA_INFL,
  };
}

// ── SHARED HELPERS ────────────────────────────────────────────────────────────

function _age(entity) {
  if (entity?.individual?.dob) return calcAge(entity.individual.dob);
  return entity?.age ?? 0;
}

function _cash(entity) {
  return entity?.assets?.cash?.total ?? 0;
}

function _monthlyEssentials(entity) {
  return (entity?.targetIncome ?? 50000) / 12;
}

function _totalDebt(entity) {
  const a = entity?.assets ?? {};
  const mortgage   = a.mortgage?.balance ?? a.residence?.mortgageBalance ?? 0;
  const loanArr    = a.liabilities ?? [];
  const loanTotal  = loanArr.reduce((s, l) => s + (l.outstanding_balance_gbp ?? l.balance ?? 0), 0);
  return mortgage + loanTotal;
}

function _daysBetween(msA, msB) {
  return Math.abs(msB - msA) / 86_400_000;
}

function _monthsFromNow(targetMonth) {
  if (typeof targetMonth === 'number') return Math.max(0, targetMonth);
  const t = new Date((targetMonth ?? '') + '-01');
  if (isNaN(t)) return 12;
  const now = new Date();
  return Math.max(0, (t.getFullYear() - now.getFullYear()) * 12 + (t.getMonth() - now.getMonth()));
}

// Deterministic pseudo-random [0,1] from string seed — keeps cohortRankHistory pure.
function _hash01(seed) {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) / 0xFFFFFFFF);
}

// FQ score → approximate cohort percentile (sigmoid mapping around score 50)
function _fqToPercentile(fqScore) {
  return Math.min(99, Math.max(1, Math.round(50 + (fqScore - 50) * 1.2)));
}

// Flat asset list for computeSinceLastVisit mover resolution
function _flatAssets(entity) {
  const a    = entity?.assets ?? {};
  const list = [];
  if (a.sipp?.total)      list.push({ id: 'sipp',      type: 'asset',     label: 'SIPP',      value: a.sipp.total });
  if (a.isa?.value)       list.push({ id: 'isa',       type: 'asset',     label: 'ISA',       value: a.isa.value });
  if (a.residence?.value) list.push({ id: 'residence', type: 'asset',     label: 'Property',  value: a.residence.value });
  if (a.portfolio?.value) list.push({ id: 'portfolio', type: 'asset',     label: 'Portfolio', value: a.portfolio.value });
  if (a.cash?.total)      list.push({ id: 'cash',      type: 'asset',     label: 'Cash',      value: a.cash.total });
  return list;
}

// ─────────────────────────────────────────────────────────────────────────────
// C97 — computeSinceLastVisit(entity, since)
// Spec: Home v1.0 §4.8 · §16.2
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Daily delta strip: biggest mover, biggest event, most-urgent change since last visit.
 * @param {object} entity
 * @param {string} since - ISO-8601 timestamp of last visit
 * @returns {{ biggestMover, biggestEvent, mostUrgentChange, windowStart, windowEnd, hasContent, confidence, rulesVersion }}
 */
export function computeSinceLastVisit(entity, since) {
  const sinceTs  = since ? new Date(since).getTime() : 0;
  const nowTs    = Date.now();
  const nowStr   = new Date(nowTs).toISOString();

  const events = (entity?.eventLog ?? []).filter(ev => {
    const ts = new Date(ev.timestamp ?? ev.ts ?? 0).getTime();
    return ts > sinceTs && ts <= nowTs;
  });

  // ── Biggest mover ─────────────────────────────────────────────────────────
  let biggestMover = null;
  const assetDeltas = {};
  for (const ev of events) {
    const id = ev.assetId ?? ev.asset_id;
    if (!id || ev.delta == null) continue;
    assetDeltas[id] = (assetDeltas[id] ?? 0) + ev.delta;
  }
  const deltaEntries = Object.entries(assetDeltas);
  if (deltaEntries.length > 0) {
    deltaEntries.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    const [topId, topDelta] = deltaEntries[0];
    const allAssets = _flatAssets(entity);
    const matched   = allAssets.find(a => a.id === topId);
    biggestMover = {
      type:          matched?.type ?? 'asset',
      id:            topId,
      label:         matched?.label ?? topId,
      absoluteDelta: topDelta,
      percentDelta:  matched?.value ? Math.round((topDelta / matched.value) * 1000) / 10 : null,
      direction:     topDelta >= 0 ? 'up' : 'down',
      confidence:    'MED',
    };
  }

  // ── Biggest event ─────────────────────────────────────────────────────────
  // Significance weights per Home v1.1 §4.2 (Risk_* events included)
  const SIG = {
    TAKE_ACTION_PATH_COMMITTED: 10, TL_MILESTONE_REACHED: 9,
    RISK_BAND_CROSSED: 9, TE_IHT_RECALCULATED: 8, RISK_PROFILE_CHANGED: 7,
    MM_ASSET_ADDED: 7, DOC_VAULT_ITEM_ADDED: 6, RISK_PROTECTION_ADDED: 6,
    API_PULL_VERIFIED: 5, PROVIDER_STATEMENT_RECEIVED: 5, MM_ASSET_UPDATED: 4,
  };
  let biggestEvent = null;
  if (events.length > 0) {
    const sorted = [...events].sort((a, b) => (SIG[b.eventType] ?? 3) - (SIG[a.eventType] ?? 3));
    const top = sorted[0];
    biggestEvent = {
      eventType: top.eventType,
      eventId:   top.eventId ?? top.id,
      label:     top.label ?? top.eventType,
      timestamp: top.timestamp ?? top.ts,
      actor:     top.actor ?? 'system',
    };
  }

  // ── Most urgent change ────────────────────────────────────────────────────
  let mostUrgentChange = null;
  const coi       = ihtSippDelta(entity);
  const dl        = daysLeft();
  const daysInWin = _daysBetween(sinceTs, nowTs);
  if (coi > 0 && dl > 0) {
    // CoI delta over window: proportional share of total exposure
    const coiDelta = Math.round(coi * daysInWin / dl);
    if (coiDelta > 50) {
      mostUrgentChange = {
        domain:        'iht',
        label:         'IHT clock advanced',
        coiDelta,
        daysAdvanced:  Math.round(daysInWin),
        routingTarget: 'tax-estate-estate',
      };
    }
  }

  const hasContent = biggestMover !== null || biggestEvent !== null || mostUrgentChange !== null;
  return {
    biggestMover,
    biggestEvent,
    mostUrgentChange,
    windowStart:  since ?? new Date(0).toISOString(),
    windowEnd:    nowStr,
    hasContent,
    confidence:   events.length > 0 ? 'HIGH' : coi > 0 ? 'MED' : 'LOW',
    rulesVersion: HOME_VERSION,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// C98 — stateTileJourney(entity, tile, projectionHorizon)
// Spec: Home v1.0 §16.3 · ported from romantic-feistel-769059 (30 Apr 2026)
// Journey arrow per state tile: direction · projected hit · on-track · CoI-of-delay.
// CoI-of-delay computed for fi + beneficiary tiles only (per spec §16.3).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Journey arrow for each state tile: direction, projected hit date, on-track flag.
 * @param {object} entity
 * @param {'safety_net'|'debt_free'|'fi'|'beneficiary'} tile
 * @param {number} [projectionHorizon=24] - months
 * @returns {{ tile, direction, projectedHitDate, onTrack, coiOfDelay, currentProgress, monthsToTarget, tileState, confidence, rulesVersion }}
 */
export function stateTileJourney(entity, tile, projectionHorizon = 24) {
  const fns = { safety_net: safetyNetState, debt_free: debtFreeState, fi: fiState, beneficiary: beneficiaryState };
  const stateFn = fns[tile];
  if (!stateFn) throw new Error(`Unknown tile: ${tile}`);

  const tileState = stateFn(entity);

  if (tileState.achieved) {
    return {
      tile, direction: 'achieved', projectedHitDate: null,
      onTrack: true, coiOfDelay: null,
      currentProgress: 100, monthsToTarget: 0,
      tileState, confidence: tileState.confidence ?? 'HIGH',
      rulesVersion: HOME_VERSION,
    };
  }

  const progress = tileState.progress ?? 0;
  // Linear velocity: 1.5%/mo when far from goal, 1%/mo when close
  const velocity = progress < 50 ? 1.5 : 1.0;
  const monthsToTarget = progress < 100 ? Math.ceil((100 - progress) / velocity) : 0;
  const hitDate = new Date();
  hitDate.setMonth(hitDate.getMonth() + monthsToTarget);

  const coiOfDelay = (tile === 'fi' || tile === 'beneficiary')
    ? (() => {
        const c = ihtSippDelta(entity);
        return c > 0 ? Math.round((c / 12) * Math.min(projectionHorizon, monthsToTarget)) : null;
      })()
    : null;

  return {
    tile,
    direction:        progress > 50 ? 'up' : 'stable',
    projectedHitDate: monthsToTarget > 0 ? hitDate.toISOString().substring(0, 7) : null,
    onTrack:          monthsToTarget <= projectionHorizon,
    coiOfDelay,
    currentProgress:  progress,
    monthsToTarget,
    tileState,
    confidence:       tileState.confidence ?? 'MEDIUM',
    rulesVersion:     HOME_VERSION,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// C99 — whatActionWouldItTake(entity, targetScore, targetMonth)
// Spec: Home v1.0 §7 · §8 · §16.4
// Greedy APQ walk: inverse-solve FINIO-1.0 to find minimum achievable action set.
// ─────────────────────────────────────────────────────────────────────────────

// Entity mutations per APQ action — simulate applying each action to the entity
const _ACTION_MUTATIONS = {
  'pension-drawdown': e => ({ ...e, drawdown: Math.round(guardrail(e) * 0.6) }),
  'life-insurance':   e => ({
    ...e,
    assets: { ...e.assets, protection: { ...e.assets?.protection, lifeInsurance: { exists: true, inTrust: true } } },
  }),
  'life-in-trust': e => ({
    ...e,
    assets: { ...e.assets, protection: { ...e.assets?.protection, lifeInsurance: { ...e.assets?.protection?.lifeInsurance, inTrust: true } } },
  }),
  'isa-allowance': e => ({
    ...e,
    assets: { ...e.assets, isa: { ...e.assets?.isa, value: (e.assets?.isa?.value ?? 0) + TAX.isaAllowance } },
  }),
  'cgt-bedisa': e => ({
    ...e,
    assets: { ...e.assets, isa: { ...e.assets?.isa, value: (e.assets?.isa?.value ?? 0) + Math.min(e.assets?.portfolio?.value ?? 0, TAX.isaAllowance) } },
  }),
  'nominations': e => ({
    ...e,
    assets: {
      ...e.assets,
      sipp: { ...e.assets?.sipp, pensions: (e.assets?.sipp?.pensions ?? []).map(p => ({ ...p, nominationDate: new Date().toISOString() })) },
    },
  }),
  'pay-optimise': e => ({ ...e, payOptimisation: { ...e.payOptimisation, taxSavingOptimised: 0 } }),
};

// Months required to complete each action (implementation timeline)
const _ACTION_MONTHS = {
  'pension-drawdown':    1,
  'life-insurance':      3,
  'life-in-trust':       2,
  'isa-allowance':       1,
  'cgt-bedisa':          1,
  'pension-consolidate': 6,
  'nominations':         1,
  'pay-optimise':        3,
};

/**
 * Minimum action set needed to reach targetScore by targetMonth.
 * @param {object} entity
 * @param {number} targetScore
 * @param {string|number} targetMonth - ISO-8601 month ('2026-12') or months-from-now (number)
 * @returns {{ feasible, actionSet, totalFqDelta, shortfall, confidence, alternatives, rulesVersion }}
 */
export function whatActionWouldItTake(entity, targetScore, targetMonth) {
  const currentFQ      = calcFQ(entity);
  const currentTotal   = currentFQ.total;
  const targetMonthsAway = _monthsFromNow(targetMonth);
  const gap = targetScore - currentTotal;

  if (gap <= 0) {
    return {
      feasible:     true,
      actionSet:    [],
      totalFqDelta: 0,
      shortfall:    0,
      confidence:   currentFQ.total >= 70 ? 'HIGH' : 'MED',
      alternatives: [],
      alreadyMet:   true,
      rulesVersion: HOME_VERSION,
    };
  }

  const apq         = calcAPQ(entity);
  const actionSet   = [];
  let accumulated   = 0;
  let workingEntity = { ...entity, assets: { ...entity.assets } };

  for (const action of apq) {
    if (accumulated >= gap) break;
    const mutate = _ACTION_MUTATIONS[action.id];
    if (!mutate) continue;

    const monthsNeeded  = _ACTION_MONTHS[action.id] ?? 3;
    const achievable    = monthsNeeded <= targetMonthsAway;
    const preMutFQ      = calcFQ(workingEntity).total;
    const mutated       = mutate(workingEntity);
    const fqDelta       = calcFQ(mutated).total - preMutFQ;

    if (fqDelta <= 0) continue;

    actionSet.push({
      action:      action.id,
      title:       action.title,
      fqDelta,
      achievable,
      monthsNeeded,
      impact:      action.impact,
    });
    accumulated += fqDelta;
    if (achievable) workingEntity = mutated;
  }

  const totalFqDelta = actionSet.reduce((s, a) => s + a.fqDelta, 0);
  const feasible     = totalFqDelta >= gap;

  return {
    feasible,
    actionSet,
    totalFqDelta,
    shortfall:    Math.max(0, gap - totalFqDelta),
    confidence:   apq.length > 0 ? 'MED' : 'LOW',
    alternatives: feasible ? [] : [{ label: 'Extend timeframe', suggestedMonths: targetMonthsAway + 6 }],
    rulesVersion: HOME_VERSION,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// C100 — compositeTrajectory(entity, range, includeCohort, includeFan, scenarios)
// Spec: Home v1.0 §8 · §16.5
// Layer 1: yourLine (synthetic history + CMA projection)
// Layer 2: cohortMedian (stub — cohort data post-launch)
// Layer 3: projectedFan (analytical log-normal using CMA)
// Layer 4: scenario overlays
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 4-layer NW trajectory dataset for composite trajectory chart.
 * @param {object} entity
 * @param {{ start?: string, end?: string }|null} range
 * @param {boolean} includeCohort
 * @param {boolean} includeFan
 * @param {Array} scenarios
 * @returns {{ yourLine, cohortMedian, projectedFan, scenarios, confidence, rulesVersion }}
 */
export function compositeTrajectory(entity, range = null, includeCohort = true, includeFan = true, scenarios = []) {
  const cma       = _cma(null);
  const todayNw   = _nw(entity);
  const todayTs   = Date.now();
  const startMs   = range?.start ? new Date(range.start).getTime() : todayTs - 3 * 365.25 * 86_400_000;
  const endMs     = range?.end   ? new Date(range.end).getTime()   : todayTs + 10 * 365.25 * 86_400_000;
  const monthMs   = 30.44 * 86_400_000;

  // Layer 1 — yourLine
  const yourLine = _trajectoryLine(todayNw, todayTs, startMs, endMs, monthMs, cma);

  // Layer 2 — cohortMedian (stub at 82% of user NW — engaged users skew above median)
  let cohortMedian = null;
  if (includeCohort) {
    const cohortBase = todayNw * 0.82;
    cohortMedian = _trajectoryBand(cohortBase, todayTs, startMs, endMs, monthMs, cma.growth * 0.95);
  }

  // Layer 3 — projectedFan (log-normal analytical — p10/p50/p90)
  let projectedFan = null;
  if (includeFan) {
    projectedFan = [];
    let cursor = todayTs + monthMs;
    while (cursor <= endMs) {
      const t        = (cursor - todayTs) / (365.25 * 86_400_000);
      const lnDrift  = (cma.growth - (cma.vol * cma.vol) / 2) * t;
      const lnSpread = cma.vol * Math.sqrt(t);
      projectedFan.push({
        date: new Date(cursor).toISOString().slice(0, 7),
        p10:  Math.round(todayNw * Math.exp(lnDrift - 1.282 * lnSpread)),
        p50:  Math.round(todayNw * Math.exp(lnDrift)),
        p90:  Math.round(todayNw * Math.exp(lnDrift + 1.282 * lnSpread)),
      });
      cursor += monthMs;
    }
  }

  // Layer 4 — scenario overlays
  const scenarioLines = (scenarios ?? []).map(sc => {
    const scEntity = sc.entityOverrides ? { ...entity, ...sc.entityOverrides } : entity;
    const scNw     = _nw(scEntity);
    return {
      label:       sc.label ?? 'Scenario',
      line:        _trajectoryLine(scNw, todayTs, todayTs, endMs, monthMs, cma),
      deltaVsBase: scNw - todayNw,
    };
  });

  return {
    yourLine,
    cohortMedian,
    projectedFan,
    scenarios:    scenarioLines.length > 0 ? scenarioLines : null,
    confidence:   'MED',
    rulesVersion: HOME_VERSION,
  };
}

function _trajectoryLine(baseNw, todayTs, startMs, endMs, monthMs, cma) {
  const line = [];
  let cursor = startMs;
  while (cursor <= endMs) {
    const yrs    = (cursor - todayTs) / (365.25 * 86_400_000);
    const nw     = yrs >= 0
      ? baseNw * Math.pow(1 + cma.growth, yrs)
      : baseNw / Math.pow(1 + cma.growth, -yrs);
    line.push({
      date:      new Date(cursor).toISOString().slice(0, 7),
      netWorth:  Math.round(nw),
      confidence: cursor <= todayTs ? 'MED' : 'LOW',
    });
    cursor += monthMs;
  }
  return line;
}

function _trajectoryBand(baseNw, todayTs, startMs, endMs, monthMs, growth) {
  const result = [];
  let cursor   = startMs;
  while (cursor <= endMs) {
    const yrs  = (cursor - todayTs) / (365.25 * 86_400_000);
    const base = yrs >= 0
      ? baseNw * Math.pow(1 + growth, yrs)
      : baseNw / Math.pow(1 + growth, -yrs);
    result.push({
      date:  new Date(cursor).toISOString().slice(0, 7),
      value: Math.round(base),
      p25:   Math.round(base * 0.78),
      p75:   Math.round(base * 1.24),
      p10:   Math.round(base * 0.62),
      p90:   Math.round(base * 1.40),
    });
    cursor += monthMs;
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// C101 — cohortRankHistory(entity, cohort, range)
// Spec: Home v1.0 §10 · §16.6
// Confidence always LOW — no real cohort data until post-launch.
// ─────────────────────────────────────────────────────────────────────────────

const _COHORT_SIZES = [0, 2100, 1800, 1500, 1200, 900, 600, 300];

/**
 * Monthly cohort rank history for heat-strip chart.
 * @param {object} entity
 * @param {object|null} cohort - cohort definition ({ lifeStage, jurisdiction, archetype, size })
 * @param {number} range - months back (default 12)
 * @returns {{ monthlyRanks, cohortDefinition, averageRank, trend, confidence, rulesVersion }}
 */
export function cohortRankHistory(entity, cohort = null, range = 12) {
  const age        = _age(entity);
  const ls         = lifeStageFor(age);
  const fq         = calcFQ(entity);
  const basePerc   = _fqToPercentile(fq.total);
  const cohortSize = cohort?.size ?? (_COHORT_SIZES[ls.stage] ?? 1000);
  const months     = typeof range === 'number' ? range : 12;

  const now = new Date();
  const monthlyRanks = [];
  for (let i = months - 1; i >= 0; i--) {
    const d      = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key    = d.toISOString().slice(0, 7);
    const rand   = _hash01(key + (entity?.id ?? 'default'));
    const variation = Math.round((rand - 0.5) * 8);
    const percentile = Math.min(99, Math.max(1, basePerc + variation));
    monthlyRanks.push({ month: key, percentile, cohortSize });
  }

  const percs  = monthlyRanks.map(r => r.percentile);
  const avg    = Math.round(percs.reduce((s, p) => s + p, 0) / percs.length);
  const first  = percs[0];
  const last   = percs[percs.length - 1];
  const trend  = last > first + 3 ? 'climbing' : last < first - 3 ? 'falling' : 'stable';

  return {
    monthlyRanks,
    cohortDefinition: cohort ?? {
      lifeStage:    ls.name,
      jurisdiction: entity?.jurisdiction ?? 'UK',
      archetype:    entity?.archetype ?? 'unknown',
    },
    averageRank:  avg,
    trend,
    confidence:   'LOW',
    rulesVersion: HOME_VERSION,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// C102 — realityEngineState(entity, bundle)
// Spec: Home v1.0 §11.9 · §16.7
// O-HOME-1 recommended defaults applied (founder sign-off pending).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Three-ring Reality Engine state: Personal · System · External.
 * @param {object} entity
 * @param {object|null} bundle - jurisdictional rules bundle (UK-2026.1)
 * @returns {{ personal, system, external, overallPressure, recommendedActions, rulesVersion }}
 */
export function realityEngineState(entity, bundle = null) {
  const cma      = _cma(bundle);
  const personal = _personalRing(entity);
  const system   = _systemRing(entity);
  const external = _externalRing(cma);

  const states = [personal.state, system.state, external.state];
  const overallPressure = states.includes('active') ? 'high'
    : states.includes('watch') ? 'medium'
    : 'low';

  return {
    personal,
    system,
    external,
    overallPressure,
    recommendedActions: _deriveRecommendations(personal, system),
    rulesVersion:       HOME_VERSION,
  };
}

// O-HOME-1: ring state = worst factor state
function _ringState(factors) {
  const states = factors.map(f => f.state);
  if (states.includes('active')) return 'active';
  if (states.includes('watch'))  return 'watch';
  return 'calm';
}

function _personalRing(entity) {
  const age    = _age(entity);
  const nw     = _nw(entity);
  const cash   = _cash(entity);
  const me     = _monthlyEssentials(entity);
  const debt   = _totalDebt(entity);
  const prot   = entity?.assets?.protection ?? {};
  const depsRaw = entity?.dependants;
  const deps   = Array.isArray(depsRaw) ? depsRaw.length : (depsRaw?.count ?? 0);
  const sipp   = entity?.assets?.sipp?.total ?? 0;
  const liquidityMonths = me > 0 ? cash / me : 0;
  const debtRatio       = nw > 0 ? debt / nw : 0;

  // Nomination currency evaluation
  const pensions  = entity?.assets?.sipp?.pensions ?? [];
  const stalePens = pensions.filter(p => {
    if (!p.nominationDate) return true;
    return (Date.now() - new Date(p.nominationDate)) > 3 * 365.25 * 86_400_000;
  });
  const agingPens = pensions.filter(p => {
    if (!p.nominationDate) return false;
    const ms = Date.now() - new Date(p.nominationDate);
    return ms > 2 * 365.25 * 86_400_000 && ms <= 3 * 365.25 * 86_400_000;
  });
  const nomState = (sipp === 0 || pensions.length === 0) ? 'calm'
    : stalePens.length > 0 ? 'watch'
    : agingPens.length > 0 ? 'watch'
    : 'calm';

  // Income stability: active income, state pension, or age >= 65
  const hasIncome = (entity?.income?.monthly ?? 0) > 0
    || (entity?.income?.statePension?.inPayment)
    || age >= 65;
  const incomeState = hasIncome ? 'calm' : 'watch';

  const factors = [
    { id: 'liquidity',              label: 'Emergency fund coverage',    currentValue: `${liquidityMonths.toFixed(1)} months`, state: liquidityMonths < 1 ? 'active' : liquidityMonths < 3 ? 'watch' : 'calm',  trend: 'stable' },
    { id: 'debt_stress',            label: 'Debt-stress ratio',          currentValue: debtRatio,                              state: debtRatio > 0.5 ? 'active' : debtRatio > 0.25 ? 'watch' : 'calm',         trend: 'stable' },
    { id: 'income_stability',       label: 'Income stability',           currentValue: entity?.employment?.status ?? 'unknown',state: incomeState,                                                                trend: 'stable' },
    { id: 'dependants_protection',  label: 'Dependant protection',       currentValue: `${deps} dependant(s)`,                 state: deps === 0 ? 'calm' : prot.lifeInsurance?.exists ? 'calm' : 'watch',      trend: 'stable' },
    { id: 'nomination_currency',    label: 'Pension nomination currency', currentValue: sipp > 0 ? 'pension present' : 'none', state: nomState,                                                                   trend: 'stable' },
  ];

  return { state: _ringState(factors), factors, lastChangeTs: new Date().toISOString() };
}

function _systemRing(entity) {
  const dl = daysLeft();
  // Finance Act 2026: DC pension IHT inclusion — effective April 2027
  // O-HOME-1: Active < 60 days, Watch < 365 days, Calm >= 365 days
  const ihtState = dl < 60 ? 'active' : dl < 365 ? 'watch' : 'calm';

  const factors = [
    { id: 'finance_act_2026_dc_iht', label: 'DC pension IHT inclusion',         currentValue: `${dl} days to effective`, state: ihtState,  trend: 'incoming' },
    { id: 'income_tax_freeze',       label: 'Income tax threshold freeze (2028)', currentValue: 'Frozen to 2028',         state: 'watch',   trend: 'stable'   },
    { id: 'cgt_changes',             label: 'CGT rates (BADR 18%)',               currentValue: '18% for business assets', state: 'watch',  trend: 'stable'   },
  ];

  return { state: _ringState(factors), factors, lastChangeTs: new Date().toISOString() };
}

function _externalRing(cma) {
  // O-HOME-1: External Calm = within norm, Watch = 95th pct, Active = 99th pct
  // Historical UK blended portfolio vol norm ≈ 14%; inflation target = 2%
  const volState  = cma.vol > 0.20 ? 'active' : cma.vol > 0.16 ? 'watch' : 'calm';
  const inflState = cma.inflation > 0.05 ? 'active' : cma.inflation > 0.03 ? 'watch' : 'calm';

  const factors = [
    { id: 'equity_volatility', label: 'Equity market volatility', currentValue: `${Math.round(cma.vol * 100)}%`,       state: volState,  trend: 'stable' },
    { id: 'inflation',         label: 'UK CPI inflation',          currentValue: `${Math.round(cma.inflation * 100)}%`, state: inflState, trend: 'stable' },
    { id: 'gilt_yields',       label: 'Gilt yields (10yr)',         currentValue: '3.5%',                               state: 'watch',   trend: 'stable' },
  ];

  return { state: _ringState(factors), factors, lastChangeTs: new Date().toISOString() };
}

function _deriveRecommendations(personal, system) {
  const recs = [];
  if (personal.state === 'active') recs.push('review_personal_risk_factors');
  const nomFactor = personal.factors.find(f => f.id === 'nomination_currency');
  if (nomFactor?.state !== 'calm') recs.push('update_pension_nominations');
  const liqFactor = personal.factors.find(f => f.id === 'liquidity');
  if (liqFactor?.state !== 'calm') recs.push('build_emergency_fund');
  const ihtFactor = system.factors.find(f => f.id === 'finance_act_2026_dc_iht');
  if (ihtFactor?.state !== 'calm') recs.push('review_iht_position');
  return recs;
}

// ─────────────────────────────────────────────────────────────────────────────
// C103 — prcPccCurrent(entity)
// Spec: Home v1.0 §12 · §16.8
// Thin extract from prcPccSpread for Home's micro spread bar.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Current-state PRC/PCC summary for Home micro spread bar.
 * @param {object} entity
 * @returns {{ prcCurrent, pccCurrent, spread, spreadDirection, bestDecision, worstDecision, confidence, rulesVersion }}
 */
export function prcPccCurrent(entity) {
  const full = prcPccSpread(entity);

  if (full.insufficient_data) {
    return {
      prcCurrent:     null,
      pccCurrent:     null,
      spread:         null,
      spreadDirection: null,
      bestDecision:   null,
      worstDecision:  null,
      confidence:     'INSUFFICIENT',
      rulesVersion:   HOME_VERSION,
    };
  }

  const r2         = n => Math.round(n * 100) / 100;
  const prcCurrent = full.prc_blocks.reduce((s, b) => s + (b.contribution_pp ?? 0), 0);
  const pccCurrent = full.pcc_blocks.reduce((s, b) => s + (b.contribution_pp ?? 0), 0);
  const spreadVal  = full.spread_pp ?? r2(prcCurrent - pccCurrent);

  const prcSorted = [...(full.prc_blocks ?? [])].sort((a, b) => (b.contribution_pp ?? 0) - (a.contribution_pp ?? 0));
  const pccSorted = [...(full.pcc_blocks ?? [])].sort((a, b) => (b.contribution_pp ?? 0) - (a.contribution_pp ?? 0));

  return {
    prcCurrent:     r2(prcCurrent),
    pccCurrent:     r2(pccCurrent),
    spread:         r2(spreadVal),
    spreadDirection: spreadVal >= 0 ? 'positive' : 'negative',
    bestDecision:   prcSorted[0] ? { id: prcSorted[0].name, label: prcSorted[0].name, spreadDelta: r2(prcSorted[0].contribution_pp) } : null,
    worstDecision:  pccSorted[0] ? { id: pccSorted[0].name, label: pccSorted[0].name, spreadDelta: r2(-pccSorted[0].contribution_pp) } : null,
    confidence:     full.confidence === 'HIGH' ? 'HIGH' : 'MED',
    rulesVersion:   HOME_VERSION,
  };
}
