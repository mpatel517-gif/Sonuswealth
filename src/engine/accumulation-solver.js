// src/engine/accumulation-solver.js
// ─────────────────────────────────────────────────────────────────────────────
// solveAccumulation — the accumulation half of the one goal engine (step 3).
// Consumes the ordered goalSpec and, for each accumulation goal, reports how
// on-track it is and the smallest lever (extra monthly saving) that closes the
// gap. Pure & deterministic; FCA framing (illustration, not advice).
//
// Reuses binarySearchSolver from goal-seek-engine.js for the "what monthly
// contribution hits the target" lever. Tax figures (allowances) from the bundle.
//
// Design: ~/.claude/plans/goal-engine-design.md §3 (ACC branch)
// ─────────────────────────────────────────────────────────────────────────────

import { TAX } from './fq-calculator.js'
import { binarySearchSolver } from './goal-seek-engine.js'
import { stampGuidance } from './financial-snapshot.js'

const FCA_DISCLAIMER = 'Illustrative under your assumptions — not a forecast or personal recommendation. Verify decisions with a qualified UK adviser.'

// Future value of a current balance + monthly contributions over `years`.
function fv(current, monthly, years, annualRate) {
  const r = Math.pow(1 + annualRate, 1 / 12) - 1
  const months = Math.round(years * 12)
  const fvCurrent = current * Math.pow(1 + annualRate, years)
  const annuity = r === 0 ? months : (Math.pow(1 + r, months) - 1) / r
  return fvCurrent + monthly * annuity
}

// ── Context extraction (mirror of the decumulation extractor, accumulation side)
export function extractAccumulationContext(entity = {}, opts = {}) {
  const a = entity.assets || {}
  const inc = entity.income || {}
  const age = +(entity.age ?? entity.individual?.age) || 40
  const growth = +opts.growth || +a.sipp?.growth || 0.05
  const inflation = opts.inflation != null ? +opts.inflation : 0.025

  const pension = +a.sipp?.total || (Array.isArray(a.sipp?.pensions) ? a.sipp.pensions.reduce((s, p) => s + (+p.value || 0), 0) : 0)
  const isa = +(a.isa?.value ?? a.isa?.total ?? 0)
  const gia = +(a.portfolio?.value ?? a.gia?.value ?? a.investments?.value ?? 0)
  const cash = +(a.cash?.total ?? a.cash?.own ?? a.cash?.value ?? 0)
  const investable = pension + isa + gia + Math.max(0, cash) // cash counts but see buffer goal
  // Monthly amount currently being saved (pension contribs + explicit savings).
  const pensionContribs = Array.isArray(a.sipp?.pensions)
    ? a.sipp.pensions.reduce((s, p) => s + (+(p.contribution_monthly?.personal || 0) + +(p.contribution_monthly?.employer || 0)), 0) : 0
  // Also read the active retirement plan's monthly contribution (where personas
  // record it), e.g. Mr T's £1,500/mo in plans[].
  const planContribution = Array.isArray(entity.plans)
    ? (+entity.plans.find(p => p.type === 'retirement' && p.status !== 'archived')?.monthlyContribution || 0) : 0
  const monthlyContribution = +entity.monthlyContribution || pensionContribs || +inc.monthlySavings || planContribution || 0
  const essentialsMonthly = +entity.expenses?.essentialsMonthly
    || (entity.expenses?.monthly ? +entity.expenses.monthly : 0)
    || Math.round((+entity.targetIncome || +inc.salary || 30000) * 0.6 / 12)

  return {
    age, growth, inflation,
    pots: { pension, isa, gia, cash }, investable, monthlyContribution, essentialsMonthly,
    retirementAge: +entity.retirementAge || +entity.preferences?.retirementAge || 67,
    targetIncome: +entity.targetIncome || 0,
    sparse: investable === 0 && monthlyContribution === 0,
  }
}

// ── Solve a single accumulation goal → on-track % + gap + the lever to close it.
function solveAccGoal(ctx, goal, opts = {}) {
  const base = { goalId: goal.id || goal.type, type: goal.type, objective: goal.objective }

  // Target lump + the age/date it's needed.
  const targetAge = goal.target?.age || (goal.target?.date ? _ageAtDate(ctx, goal.target.date) : ctx.retirementAge)
  const years = Math.max(0.5, targetAge - ctx.age)

  switch (goal.type) {
    case 'emergency_buffer': {
      // Target = N months of essentials (default 6); funded from cash.
      const months = +goal.target?.months || 6
      const target = ctx.essentialsMonthly * months
      const have = Math.max(0, ctx.pots.cash)
      const onTrackPct = target > 0 ? Math.min(100, Math.round((have / target) * 100)) : 100
      const gap = Math.max(0, target - have)
      return { ...base, target: Math.round(target), have: Math.round(have), onTrackPct,
        gap: Math.round(gap), lever: gap > 0 ? `Hold ${Math.round(gap).toLocaleString()} more in easy-access cash` : 'Buffer covered',
        rationale: `A safety net of ${months} months' essentials is £${Math.round(target).toLocaleString()}; you hold £${Math.round(have).toLocaleString()} in cash.` }
    }
    case 'retire_by':
    case 'house_deposit':
    case 'education_fund':
    case 'big_purchase': {
      // Lump target by a date/age. Project current relevant pots + current
      // monthly saving; if short, solve the extra monthly that closes it.
      const target = +goal.target?.lump || (goal.type === 'retire_by' && ctx.targetIncome ? ctx.targetIncome * 25 : 0)
      if (!target) return { ...base, onTrackPct: null, note: 'No numeric target set for this goal.' }
      // retire_by draws on all investable; shorter goals on liquid (isa+gia+cash).
      const startPot = goal.type === 'retire_by' ? ctx.investable : (ctx.pots.isa + ctx.pots.gia + Math.max(0, ctx.pots.cash))
      const projected = fv(startPot, ctx.monthlyContribution, years, ctx.growth)
      const onTrackPct = Math.min(150, Math.round((projected / target) * 100))
      // Lever: extra monthly contribution to exactly hit target by the date.
      const metricFn = (extra) => fv(startPot, ctx.monthlyContribution + extra, years, ctx.growth)
      const solved = binarySearchSolver(metricFn, target, { min: 0, max: 20000, tolerance: Math.max(500, target * 0.002), direction: 'gte' })
      const extra = projected >= target ? 0 : Math.round(solved.parameter)
      return { ...base, target: Math.round(target), projected: Math.round(projected), onTrackPct,
        years: Math.round(years), gap: Math.round(Math.max(0, target - projected)),
        lever: extra > 0 ? `Save ~£${extra.toLocaleString()}/mo more to reach £${Math.round(target).toLocaleString()} by age ${targetAge}` : `On track for £${Math.round(target).toLocaleString()} by age ${targetAge}`,
        rationale: `At ${Math.round(ctx.growth * 100)}% growth, £${Math.round(startPot).toLocaleString()} + £${Math.round(ctx.monthlyContribution).toLocaleString()}/mo grows to ~£${Math.round(projected).toLocaleString()} by age ${targetAge} (target £${Math.round(target).toLocaleString()}).` }
    }
    case 'maximise_relief': {
      // % of this year's ISA + pension allowance used (illustrative).
      const isaUsed = +ctx.pots && 0 // usage isn't in ctx; report headroom existence
      const isaAllow = TAX.isaAllowance, aaAllow = TAX.pensionAA
      return { ...base, onTrackPct: null,
        rationale: `This year you can shelter up to £${isaAllow.toLocaleString()} in an ISA and up to £${aaAllow.toLocaleString()} in pension contributions (plus any carry-forward). Unused ISA allowance does not roll over.`,
        lever: 'Use ISA + pension allowances before 5 April; they reset each year.' }
    }
    case 'debt_free': {
      // If debt + payoff data present, estimate; else flag.
      return { ...base, onTrackPct: null, lever: 'Increase overpayments to clear sooner', rationale: 'Debt-free timing depends on balance, rate and overpayment — captured per liability.' }
    }
    default:
      return { ...base, onTrackPct: null, note: `No accumulation solver for ${goal.type} yet.` }
  }
}

function _ageAtDate(ctx, dateStr) {
  // Deterministic: derive years-from-now from the target year vs a passed-in now.
  const y = parseInt(String(dateStr).slice(0, 4), 10)
  if (!y) return ctx.retirementAge
  // Without a live clock we approximate now-year from ctx if provided.
  const nowYear = ctx._nowYear || 2026
  return ctx.age + Math.max(0, y - nowYear)
}

export function solveAccumulation({ entity, goalSpec, opts = {} } = {}) {
  const ctx = extractAccumulationContext(entity, opts)
  ctx._nowYear = opts.now ? opts.now.getFullYear() : 2026
  const goals = (goalSpec?.goals || []).filter(g => !g.alwaysOn)

  if (ctx.sparse) {
    return stampGuidance({ branch: 'accumulation', perGoal: [], primary: goalSpec?.primary?.type || null,
      coverage: { dataRichness: 'sparse', unknowns: ['no savings or investable assets captured'] },
      disclaimer: FCA_DISCLAIMER }, entity, opts)
  }

  const perGoal = goals.map(g => solveAccGoal(ctx, g, opts))
  const primary = perGoal.find(g => g.type === goalSpec?.primary?.type) || perGoal[0] || null

  const out = {
    branch: 'accumulation',
    perGoal,
    primary: primary ? primary.type : null,
    headline: primary && primary.onTrackPct != null
      ? `${primary.onTrackPct}% of the way to your ${String(primary.type).replace(/_/g, ' ')} goal`
      : null,
    coverage: {
      dataRichness: 'sufficient',
      assumptions: [`${Math.round(ctx.growth * 100)}% nominal growth`, `${Math.round(ctx.inflation * 100)}% inflation`, `current saving £${Math.round(ctx.monthlyContribution).toLocaleString()}/mo`],
      unknowns: [],
    },
    labels: { onTrack: 'On-track % is an illustration under your assumptions, not a guarantee.' },
    binding: { primaryGoal: goalSpec?.primary?.type || null, lexicographicOrder: goals.map(g => g.type) },
    disclaimer: FCA_DISCLAIMER,
  }
  return stampGuidance(out, entity, opts)
}
