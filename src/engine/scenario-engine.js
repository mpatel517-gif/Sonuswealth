// src/engine/scenario-engine.js
// ─────────────────────────────────────────────────────────────────────────────
// THE ONE ENGINE — three modes over a single machine.
//
// Founder direction (2026-06-03): "Yes 1 engine." Today the app runs THREE
// separate bits of future-math — WhatIfLibrary (clone entity + recompute),
// CashFlowDrill sliders (local newSurplus = surplus + saved…), and the goal
// solver — so they can silently disagree (the same class of bug as the Sankey
// £0-tax and the Home↔Cashflow surplus mismatch). This module collapses them:
//
//   · SOLVE — the engine picks the levers (goal optimisation). Delegates to
//             solveDecumulation / solveAccumulation. → Cashflow "Your plan".
//   · TEST  — the user PINS a lever; the engine re-measures everything else
//             against the SAME canonical selectors. → every "what-if".
//   · RANK  — the engine surfaces the highest-impact UNPINNED lever as an
//             action. → Home "What next".
//
// One solver, three modes. The thing that kills divergence is measure(): it
// reads ONLY canonical selectors (netWorth, cashflowFlow, calcFQ, ihtProjection,
// fundedRatio), so a what-if delta is computed from the identical math Home and
// Cashflow already display. No surface may recompute its own surplus again.
//
// Purity: no Math.random (deterministic — we deliberately do NOT reuse the
// monteCarloPOS RNG path). No I/O, no event-store writes. previewCommit() only
// BUILDS the SCENARIO_SAVED payload; applying rippleEffect to the event store is
// the UI/lib layer's job (the deferred UI step), keeping this module cycle-free.
// ─────────────────────────────────────────────────────────────────────────────

import { netWorth, cashflowFlow, calcFQ, fundedRatio } from './fq-calculator.js'
import { ihtProjection, ihtDeltaPrePost2027 } from './canonical-metrics.js'
import { goalSpec as buildGoalSpec, inferBranch } from './goal-engine.js'
import { solveDecumulation } from './decumulation-solver.js'
import { solveAccumulation } from './accumulation-solver.js'
import { stampGuidance } from './financial-snapshot.js'

// Node 18+ / modern browsers have structuredClone; fall back to JSON clone.
const clone = (o) => (typeof structuredClone === 'function'
  ? structuredClone(o)
  : JSON.parse(JSON.stringify(o)))

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

// ─────────────────────────────────────────────────────────────────────────────
// LEVER REGISTRY — the shared vocabulary that replaces the three ad-hoc delta
// sets. A lever is a pure, parameterised transform with metadata.
//
//   apply(entity, value) → { mutate?(draft), flowAnnual?: number }
//     · mutate    — in-place edit of a CLONED entity; canonical selectors then
//                   read the change naturally (this is why income/asset levers
//                   flow through to netWorth/surplus without a parallel formula).
//     · flowAnnual— a TRANSPARENT additive £/yr adjustment to the canonical
//                   surplus, for changes the selectors don't model on the entity
//                   (cut essentials, pause contributions, refinance). Positive =
//                   surplus improves. The surplus base is still cashflowFlow();
//                   this is an explicit, auditable add-on, NOT a second engine.
//
//   robust:false  — flagged levers still poke single key-shapes (the WhatIfLibrary
//                   inheritance). They work on the standard shape but need the
//                   asset/liability-taxonomy-aware delta layer before the UI
//                   relies on them. Surfaced honestly rather than silently shipped.
//
//   horizon:true  — a projection lever (growth, retirement age). It reshapes the
//                   TRAJECTORY, not today's snapshot, so it's a no-op in TEST mode
//                   and belongs to SOLVE/projection. Declared so the UI knows.
// ─────────────────────────────────────────────────────────────────────────────

// Scale EARNED income on the exact fields calcAllIncome() actually reads — not
// income.gross/net/total, which it ignores (it builds from items + MAX-es the
// salary aliases). Touching the wrong fields is why a "pay change" once moved
// Mr T's canonical gross by almost nothing. Dividends are scaled as director
// comp (Mr T's real pay); for a non-director portfolio that conflates investment
// dividends — a refinement for the taxonomy-aware delta layer.
const EARNED_FIELDS = ['salary', 'employment', 'directorSalary', 'selfEmployed', 'selfEmploymentNet', 'dividends']
const scaleIncome = (draft, factor) => {
  const inc = draft.income || (draft.income = {})
  for (const k of EARNED_FIELDS) {
    if (typeof inc[k] === 'number') inc[k] = Math.round(inc[k] * factor)
  }
  // salary aliases are MAX-ed (not summed) by calcAllIncome — scale them together
  // so the max moves with the lever.
  if (draft.individual && typeof draft.individual.gross_salary === 'number') {
    draft.individual.gross_salary = Math.round(draft.individual.gross_salary * factor)
  }
}

const mortgageBalance = (e) => {
  const L = e.liabilities || e.assets?.liabilities || {}
  return num(L.mortgage?.outstanding) || num(L.mortgage?.balance)
    || (Array.isArray(L.mortgages) ? L.mortgages.reduce((s, m) => s + num(m.outstanding) + num(m.balance), 0) : 0)
}

export const LEVERS = [
  // ── Income / position shocks (robust — selectors read income directly) ──────
  {
    id: 'lose_job', label: 'Lose my income', subtitle: 'Earned income drops to £0',
    scope: 'position', robust: true, param: null,
    apply: () => ({ mutate: (d) => scaleIncome(d, 0) }),
  },
  {
    id: 'pay_change', label: 'Pay change', subtitle: 'Gross earnings up or down',
    scope: 'position', robust: true,
    param: { kind: 'percent', min: -50, max: 50, step: 1, unit: '%', default: 20 },
    apply: (e, v = 20) => ({ mutate: (d) => scaleIncome(d, 1 + num(v) / 100) }),
  },

  // ── Cashflow levers (robust — transparent £/yr adjustment to canonical surplus)
  {
    id: 'cut_essentials', label: 'Cut essential spending', subtitle: 'Trim the monthly essentials bill',
    scope: 'cashflow', robust: true,
    param: { kind: 'percent', min: 0, max: 40, step: 1, unit: '%', default: 10 },
    apply: (e, v = 10, ctx = {}) => {
      const essAnnual = num(ctx.flow?.essentials)
      return { flowAnnual: Math.round(essAnnual * (num(v) / 100)) }
    },
  },
  {
    id: 'pause_committed', label: 'Pause discretionary contributions', subtitle: 'Stop pension/ISA top-ups for a while',
    scope: 'cashflow', robust: true,
    param: { kind: 'months', min: 0, max: 12, step: 1, unit: 'mo', default: 6 },
    apply: (e, v = 6, ctx = {}) => {
      const committedAnnual = num(ctx.flow?.committed)
      // Saving = the fraction of a year the contributions are paused.
      return { flowAnnual: Math.round(committedAnnual * (Math.min(12, num(v)) / 12)) }
    },
  },
  {
    id: 'refinance_debt', label: 'Refinance debt', subtitle: 'Lower the interest rate on borrowing',
    scope: 'cashflow', robust: true,
    param: { kind: 'percent', min: 0, max: 5, step: 0.25, unit: '%', default: 1 },
    apply: (e, v = 1, ctx = {}) => {
      // Interest saved per year ≈ balance × Δrate. Uses mortgage as the dominant
      // balance; granular per-liability APR lives in the taxonomy follow-up.
      const bal = mortgageBalance(e)
      return { flowAnnual: Math.round(bal * (num(v) / 100)) }
    },
  },

  // ── Asset-moving shocks (robust:false — inherit WhatIfLibrary single-shape pokes)
  {
    id: 'sell_home', label: 'Sell main home', subtitle: 'Realise residential equity into cash',
    scope: 'position', robust: false, param: null,
    apply: (e) => ({
      mutate: (d) => {
        const val = num(d.assets?.residence?.value)
        const proceeds = Math.max(0, val - mortgageBalance(d))
        if (d.assets?.residence) d.assets.residence.value = 0
        d.assets = d.assets || {}
        d.assets.cash = { ...(d.assets.cash || {}), total: num(d.assets.cash?.total) + proceeds }
        if (d.liabilities?.mortgage) d.liabilities.mortgage.outstanding = 0
      },
    }),
  },
  {
    id: 'max_pension', label: 'Max pension this year', subtitle: 'Move cash into pension up to the Annual Allowance',
    scope: 'position', robust: false,
    param: { kind: 'currency', min: 0, max: 60000, step: 1000, unit: '£', default: 60000 },
    apply: (e, v = 60000, ctx = {}) => ({
      mutate: (d) => {
        const aa = num(ctx.allowance?.pensionAA) || 60000
        const room = Math.min(num(v) || aa, aa)
        const fromCash = Math.min(room, num(d.assets?.cash?.total))
        d.assets = d.assets || {}
        d.assets.cash = { ...(d.assets.cash || {}), total: num(d.assets.cash?.total) - fromCash }
        d.assets.sipp = { ...(d.assets.sipp || {}), total: num(d.assets.sipp?.total) + fromCash }
        // Net worth is unchanged (transfer); the meaningful deltas are IHT-2027
        // and the income-tax relief — surfaced via measure()/solve, not here.
      },
    }),
  },

  // ── Projection levers (horizon — reshape the trajectory, not the snapshot) ──
  {
    id: 'growth_rate', label: 'Investment growth', subtitle: 'Assumed annual return on invested pots',
    scope: 'holding', robust: true, horizon: true,
    param: { kind: 'percent', min: 1, max: 12, step: 0.1, unit: '%', default: 5 },
    apply: () => ({}), // handled in solve/projection mode; inert on the snapshot
  },
  {
    id: 'retire_age', label: 'Retirement age', subtitle: 'When earned income stops and drawdown begins',
    scope: 'holding', robust: true, horizon: true,
    param: { kind: 'age', min: 50, max: 75, step: 1, unit: '', default: 67 },
    apply: () => ({}), // handled in solve/projection mode; inert on the snapshot
  },
]

export const LEVER_INDEX = Object.fromEntries(LEVERS.map((l) => [l.id, l]))
export const leverById = (id) => LEVER_INDEX[id] || null

// ─────────────────────────────────────────────────────────────────────────────
// applyLevers — fold a list of pins onto a CLONED entity.
// pins: [{ id, value }]. ctx carries the canonical flow + allowance so levers
// that need "what are this person's essentials" don't recompute them.
// Returns { entity, flowAnnual, applied[] }.
// ─────────────────────────────────────────────────────────────────────────────
export function applyLevers(entity, pins = [], ctx = {}) {
  const draft = clone(entity || {})
  let flowAnnual = 0
  const applied = []
  for (const pin of pins) {
    const lever = leverById(pin?.id)
    if (!lever) continue
    const out = lever.apply(draft, pin.value, ctx) || {}
    if (typeof out.mutate === 'function') out.mutate(draft)
    if (typeof out.flowAnnual === 'number') flowAnnual += out.flowAnnual
    applied.push({ id: lever.id, label: lever.label, value: pin.value ?? lever.param?.default ?? null, horizon: !!lever.horizon, robust: lever.robust !== false })
  }
  return { entity: draft, flowAnnual, applied }
}

// ─────────────────────────────────────────────────────────────────────────────
// measure — the canonical metric snapshot. THE single source every mode diffs
// against. Reads only canonical selectors so nothing here can disagree with the
// numbers Home / MyMoney / Cashflow already show.
// ─────────────────────────────────────────────────────────────────────────────
export function measure(entity, opts = {}) {
  const bundle = opts.bundle
  const cma = opts.cma || null
  const flowAdjust = num(opts.flowAnnual)

  const flow = safe(() => cashflowFlow(entity, bundle), {})
  const surplusAnnual = num(flow.surplusAnnual) + flowAdjust

  return {
    netWorth: Math.round(safe(() => netWorth(entity), 0)),
    grossIncome: Math.round(num(flow.gross)),
    surplusAnnual: Math.round(surplusAnnual),
    surplusMonthly: Math.round(surplusAnnual / 12),
    fq: Math.round(safe(() => calcFQ(entity)?.total, 0)),
    ihtDue: Math.round(safe(() => ihtProjection(entity)?.ihtDue, 0)),
    ihtDelta2027: Math.round(safe(() => ihtDeltaPrePost2027(entity)?.delta, 0)),
    fundedRatio: safe(() => fundedRatio(entity, cma)?.ratio, null),
    // expose the canonical flow components so cashflow levers can size against them
    _flow: { essentials: num(flow.essentials), committed: num(flow.committed), debtService: num(flow.debtService) },
  }
}

function safe(fn, fallback) { try { const v = fn(); return v == null ? fallback : v } catch { return fallback } }

// Per-metric directional delta with the "better" direction baked in, so the UI
// never has to know whether up or down is good for a given metric.
const METRIC_META = {
  grossIncome:  { label: 'Income',        unit: '£',  betterWhen: 'up' },
  netWorth:     { label: 'Net worth',     unit: '£',  betterWhen: 'up' },
  surplusMonthly:{ label: 'Monthly surplus', unit: '£', betterWhen: 'up' },
  fq:           { label: 'Wealth Score',  unit: '',   betterWhen: 'up' },
  ihtDue:       { label: 'IHT exposure',  unit: '£',  betterWhen: 'down' },
  ihtDelta2027: { label: 'IHT change from 2027', unit: '£', betterWhen: 'down' },
  fundedRatio:  { label: 'Retirement funded', unit: '×', betterWhen: 'up' },
}

function diffMetrics(base, scen) {
  const out = []
  for (const key of Object.keys(METRIC_META)) {
    const b = base[key], s = scen[key]
    if (b == null && s == null) continue
    const delta = num(s) - num(b)
    if (delta === 0) continue
    const meta = METRIC_META[key]
    out.push({
      key, label: meta.label, unit: meta.unit,
      before: b, after: s, delta,
      direction: delta > 0 ? 'up' : 'down',
      better: (delta > 0) === (meta.betterWhen === 'up'),
    })
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// runScenario — the one entry. mode ∈ 'solve' | 'test' | 'rank'.
// ─────────────────────────────────────────────────────────────────────────────
export function runScenario(entity, config = {}) {
  const mode = config.mode || 'test'
  const opts = config.opts || {}

  if (mode === 'solve') return runSolve(entity, config, opts)
  if (mode === 'rank') return runRank(entity, config, opts)
  return runTest(entity, config, opts)
}

// SOLVE — engine picks the levers. Branch-aware delegation to the goal solvers.
function runSolve(entity, config, opts) {
  const spec = config.goalSpec || buildGoalSpec(entity, opts)
  const branch = spec.branch || inferBranch(entity)
  const result = branch === 'accumulation'
    ? solveAccumulation({ entity, goalSpec: spec, opts })
    : solveDecumulation({ entity, goalSpec: spec, opts })
  return { ...result, mode: 'solve', branch }
}

// TEST — user pins lever(s); re-measure everything else canonically.
function runTest(entity, config, opts) {
  const pins = config.pins || []
  const base = measure(entity, opts)
  // levers that size against the canonical flow/allowance get it via ctx
  const ctx = { flow: base._flow, allowance: opts.allowance }
  const { entity: scenEntity, flowAnnual, applied } = applyLevers(entity, pins, ctx)
  const scenario = measure(scenEntity, { ...opts, flowAnnual })

  const horizonOnly = applied.length > 0 && applied.every((a) => a.horizon)
  const deltas = diffMetrics(strip(base), strip(scenario))

  const out = {
    mode: 'test',
    pins: applied,
    baseline: strip(base),
    scenario: strip(scenario),
    deltas,
    // honesty: a horizon-only what-if (growth/retire age) doesn't move TODAY's
    // numbers — it reshapes the trajectory. Tell the caller to run SOLVE instead.
    note: horizonOnly
      ? 'This changes your projected path, not today’s position — see "Your plan" for the trajectory.'
      : (applied.some((a) => !a.robust)
        ? 'Estimate. Asset-move levers use a simplified model pending the taxonomy-aware layer.'
        : null),
    disclaimer: 'Illustrative under your assumptions — information, not a personal recommendation or forecast.',
  }
  return stampGuidance(out, entity, opts)
}

const strip = (m) => { const { _flow, ...rest } = m; return rest }

// RANK — surface the highest-impact unpinned lever as an action (feeds What-next).
// Scores each candidate by how much it moves the metric that matters for the
// person's PRIMARY goal (legacy→IHT, income→surplus, retire→funded ratio…).
function runRank(entity, config, opts) {
  const spec = config.goalSpec || buildGoalSpec(entity, opts)
  const primaryType = spec.primary?.type || null
  const targetMetric = GOAL_METRIC[primaryType] || 'netWorth'
  const meta = METRIC_META[targetMetric]

  const candidates = (config.candidates || LEVERS.filter((l) => !l.horizon))
    .map((l) => (typeof l === 'string' ? leverById(l) : l))
    .filter(Boolean)

  const base = measure(entity, opts)
  const ctx = { flow: base._flow, allowance: opts.allowance }

  const actions = candidates.map((lever) => {
    const value = lever.param?.default ?? null
    const { entity: scenEntity, flowAnnual } = applyLevers(entity, [{ id: lever.id, value }], ctx)
    const scen = measure(scenEntity, { ...opts, flowAnnual })
    const delta = num(scen[targetMetric]) - num(base[targetMetric])
    const improves = (delta > 0) === (meta.betterWhen === 'up')
    return {
      leverId: lever.id, label: lever.label, subtitle: lever.subtitle,
      value, metric: targetMetric, metricLabel: meta.label,
      delta, improves, magnitude: Math.abs(delta),
    }
  })
    // only actions the user can choose to DO that help the primary goal
    .filter((a) => a.improves && a.magnitude > 0)
    .sort((a, b) => b.magnitude - a.magnitude)

  const out = {
    mode: 'rank',
    primaryGoal: primaryType,
    targetMetric, targetMetricLabel: meta.label,
    actions,
    top: actions[0] || null,
    disclaimer: 'General guidance ranked under your stated priorities — not a personal recommendation.',
  }
  return stampGuidance(out, entity, opts)
}

// Which canonical metric improvement counts as progress for each goal type.
const GOAL_METRIC = {
  legacy: 'ihtDelta2027',
  min_lifetime_tax: 'ihtDue',
  income_floor: 'surplusMonthly',
  max_lifetime_spend: 'surplusMonthly',
  emergency_buffer: 'surplusMonthly',
  debt_free: 'surplusMonthly',
  retire_by: 'fundedRatio',
  house_deposit: 'netWorth',
  education_fund: 'netWorth',
}

// ─────────────────────────────────────────────────────────────────────────────
// previewCommit — build the SCENARIO_SAVED payload for a chosen set of pins.
// PURE: returns the change descriptor only. The UI/lib layer applies it to the
// event store and calls rippleEffect (kept out of the engine to avoid cycles
// and side effects). Mirrors the shape PropertyDecisions / DecumulationStrategy
// already commit, so the cross-tab ripple is wired the same way.
// ─────────────────────────────────────────────────────────────────────────────
export function previewCommit(entity, pins = [], opts = {}) {
  const test = runTest(entity, { pins, opts }, opts)
  const categoryDeltas = {}
  for (const d of test.deltas) categoryDeltas[d.key] = d.delta
  return {
    type: 'SCENARIO_SAVED',
    payload: {
      kind: opts.kind || 'whatif',
      pins: test.pins,
      deltas: categoryDeltas,
      asOf: test.asOf,
      snapshotHash: test.snapshotHash,
      label: opts.label || pins.map((p) => leverById(p.id)?.label).filter(Boolean).join(' + '),
    },
  }
}
