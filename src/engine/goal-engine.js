// src/engine/goal-engine.js
// ─────────────────────────────────────────────────────────────────────────────
// Goal Engine — STEP 1: the pure model (taxonomy · normalisation · ordering).
// Pure, deterministic, Node-importable. NO UI, NO tax math, NO solver yet —
// those are the accumulation/decumulation branches (steps 2–3) that CONSUME the
// ordered goal spec this module produces.
//
// Design: ~/.claude/plans/goal-engine-design.md
//
// The unlock (MSCI WealthBench / Vanguard VLCM): every financial goal — saving
// or drawing — is described by the SAME four attributes:
//   · term              (when the money is needed)
//   · amount            (how much)
//   · shortfallTolerance (how acceptable it is to miss it = capacity for loss)
//   · priority          (the user's ranking when not everything can be funded)
// "Save £40k deposit by 2030" and "never run out of essential income for life"
// are the same SHAPE. One model, not two engines stapled together.
//
// Budgeting rule (MSCI, and it matches the founder's lexicographic instinct):
// goals with the LOWEST acceptable shortfall risk / HIGHEST priority are funded
// FIRST; lower goals optimise only within the feasible set that does not break
// the higher ones.
//
// FCA boundary: objectives/constraints here are INFORMATION about what a goal
// implies. The solver that acts on them frames everything "optimal-under-your-
// stated-priorities", never "you should". No goal type names a product.
// ─────────────────────────────────────────────────────────────────────────────

// ─── The taxonomy ───
// Default priority is the needs-hierarchy order (lower number = funded first;
// City University "People's financial needs": necessities → safety → retirement
// → enhancing life → independence → generational transfer → legacy). The user
// can reorder; these are only seeds.
//
// `alwaysOn: true` goals are not standalone-funded — they apply as global
// constraints to every other goal (you never "fund" tax-efficiency; you respect
// it throughout).
export const GOAL_TYPES = {
  // ACCUMULATION
  emergency_buffer: { branch: 'accumulation', defaultPriority: 1, defaultShortfall: 'hard', objective: 'reach_buffer_months', targetKind: 'income', question: 'Do I have a safety net if income stops?' },
  debt_free:        { branch: 'accumulation', defaultPriority: 3, defaultShortfall: 'soft', objective: 'clear_debt_by_date', targetKind: 'date',   question: 'When am I free of this debt?' },
  house_deposit:    { branch: 'accumulation', defaultPriority: 5, defaultShortfall: 'soft', objective: 'hit_lump_by_date', targetKind: 'lumpSum', question: 'Can I afford the deposit, and when?' },
  education_fund:   { branch: 'accumulation', defaultPriority: 7, defaultShortfall: 'soft', objective: 'hit_lump_by_date', targetKind: 'lumpSum', question: "Will the kids' education be funded?" },
  retire_by:        { branch: 'accumulation', defaultPriority: 6, defaultShortfall: 'soft', objective: 'hit_pot_by_age',   targetKind: 'ratio',   question: 'Am I on track to retire when I want?' },
  big_purchase:     { branch: 'accumulation', defaultPriority: 13, defaultShortfall: 'soft', objective: 'hit_lump_by_date', targetKind: 'lumpSum', question: 'Can I fund this without derailing the rest?' },
  maximise_relief:  { branch: 'accumulation', defaultPriority: 14, defaultShortfall: 'soft', objective: 'use_allowances',   targetKind: 'ratio',   question: 'Am I wasting any tax allowances this year?' },

  // DECUMULATION
  income_floor:      { branch: 'decumulation', defaultPriority: 2,  defaultShortfall: 'hard', objective: 'maximise_p_floor_for_life', targetKind: 'income',   question: 'Will the essentials always be covered, for life?' },
  max_lifetime_spend:{ branch: 'decumulation', defaultPriority: 8,  defaultShortfall: 'soft', objective: 'maximise_sustainable_income', targetKind: 'income',   question: 'How much can I safely spend and enjoy?' },
  legacy:            { branch: 'decumulation', defaultPriority: 10, defaultShortfall: 'soft', objective: 'maximise_after_iht_estate', targetKind: 'preserve', question: 'What can I pass on, after tax?' },
  min_lifetime_tax:  { branch: 'decumulation', defaultPriority: 9,  defaultShortfall: 'soft', objective: 'minimise_income_tax_plus_iht', targetKind: 'reduce', question: 'Am I paying more tax over my lifetime than I need to?' },
  gifting:           { branch: 'decumulation', defaultPriority: 11, defaultShortfall: 'soft', objective: 'maximise_gifts_within_exemption', targetKind: 'income', question: 'How much can I give my family now, safely?' },
  charity:           { branch: 'decumulation', defaultPriority: 12, defaultShortfall: 'soft', objective: 'maximise_charitable_with_relief', targetKind: 'lumpSum', question: 'How do I give to causes I care about, tax-efficiently?' },
  fund_care:         { branch: 'decumulation', defaultPriority: 4,  defaultShortfall: 'hard', objective: 'reserve_for_care', targetKind: 'lumpSum', question: 'Could I afford later-life care if I needed it?' },
  bridge:            { branch: 'decumulation', defaultPriority: 6,  defaultShortfall: 'hard', objective: 'fund_gap_to_state_pension', targetKind: 'income', question: 'How do I fund the gap until the State Pension starts?' },

  // CROSS-STAGE — always-on constraints, not standalone goals
  tax_efficiency: { branch: 'either', defaultPriority: 99, defaultShortfall: 'soft', objective: 'never_waste_allowances', targetKind: 'ratio', question: 'Is every allowance and band being used well?', alwaysOn: true },
  risk_bound:     { branch: 'either', defaultPriority: 99, defaultShortfall: 'hard', objective: 'stay_within_capacity_for_loss', targetKind: 'ratio', question: 'Am I taking more risk than I can afford to?', alwaysOn: true },
}

export const GOAL_TYPE_KEYS = Object.keys(GOAL_TYPES)

// ─── Branch inference (mirrors fq-calculator.inferLifeStage; kept local so this
// module stays a pure leaf with no heavy imports). 'decumulation' when the
// person is in/near drawdown; else 'accumulation'. ───
export function inferBranch(entity = {}) {
  const override = entity?.preferences?.lifeStageOverride
  if (override === 'decumulator') return 'decumulation'
  if (override === 'accumulator') return 'accumulation'
  if (+(entity?.lifeStage || 0) >= 5 || /decumul/i.test(entity?.lifeStageName || '')) return 'decumulation'
  const drawing = +(entity?.drawdown || 0) > 0 || +(entity?.pensionDrawdown || 0) > 0
  const planInMotion = entity?.drawdownPlan && entity.drawdownPlan.status && entity.drawdownPlan.status !== 'not_started'
  if (drawing || planInMotion) return 'decumulation'
  const age = +(entity?.age ?? entity?.individual?.age) || 0
  const retAge = +(entity?.retirementAge ?? entity?.preferences?.retirementAge) || 67
  if (age && age >= retAge) return 'decumulation'
  return 'accumulation'
}

// ─── Constraints a goal imposes on the solver. Returned as data, not actions.
// `iht2027` injectable so tests can assert the post-2027 flip deterministically.
function constraintsFor(type, { iht2027 = new Date('2027-04-06') } = {}) {
  switch (type) {
    case 'income_floor':
      return [
        { code: 'SECURE_INCOME_COVERS_ESSENTIALS', kind: 'layer', rationale: 'Fund essentials from secure income (State Pension, DB, annuity) before flexing the rest — advisers generally protect the floor first.' },
        { code: 'SWR_SAFE', kind: 'bound', rationale: 'Hold the withdrawal rate at a sustainable level so the floor survives a long retirement and poor early returns.' },
      ]
    case 'legacy':
      return [
        // The post-2027 flip — the engine's hard core. Before the date, pensions
        // sit outside the estate (spend other money first). After it, drawing /
        // gifting the pension during life shrinks the estate.
        { code: 'POST_2027_DRAW_PENSION_TO_SHRINK_ESTATE', kind: 'temporal', activeFrom: iht2027.toISOString(), rationale: 'From 6 Apr 2027 unused pensions count toward inheritance tax; drawing or gifting them during life can reduce the estate.' },
        { code: 'PRESERVE_WRAPPER_TRANSFER', kind: 'prefer', rationale: 'Keep wrappers that pass efficiently to heirs intact where it does not cost more tax overall.' },
      ]
    case 'min_lifetime_tax':
      return [
        { code: 'BAND_SMOOTH_WITHDRAWALS', kind: 'optimise', rationale: 'Spread withdrawals across years to use personal allowance and basic-rate band rather than spiking into higher rates.' },
        { code: 'COMBINE_INCOME_TAX_AND_IHT', kind: 'optimise', rationale: 'Treat income tax and inheritance tax as one problem — accepting modest income tax now can avoid a larger IHT bill later.' },
      ]
    case 'gifting':
      return [{ code: 'GIFTS_FROM_SURPLUS_INCOME', kind: 'prefer', rationale: 'Regular gifts out of surplus income can be immediately exempt from inheritance tax if they do not reduce your standard of living.' }]
    case 'bridge':
      return [{ code: 'FUND_PRE_STATE_PENSION_GAP', kind: 'window', rationale: 'Cover the income gap between stopping work and the State Pension starting, without over-drawing.' }]
    case 'emergency_buffer':
      return [{ code: 'EASY_ACCESS_CASH', kind: 'allocation', rationale: 'Hold the buffer in easy-access cash, not invested — its job is certainty, not growth.' }]
    case 'house_deposit':
    case 'education_fund':
    case 'big_purchase':
      return [{ code: 'DE_RISK_AS_DATE_NEARS', kind: 'glide', rationale: 'Reduce investment risk as the target date approaches so a late dip cannot derail it.' }]
    case 'retire_by':
      return [{ code: 'MAXIMISE_RELIEVED_CONTRIBUTIONS', kind: 'optimise', rationale: 'Use pension tax relief and ISA allowances to reach the number more efficiently.' }]
    default:
      return []
  }
}

// ─── normalizeGoal — fill branch / priority / shortfallTolerance / objective /
// constraints from the type. Idempotent: a normalised goal passed back in is
// unchanged (user-set priority/shortfall always win over defaults). ───
export function normalizeGoal(goal = {}, ctx = {}) {
  const meta = GOAL_TYPES[goal.type]
  if (!meta) {
    // Unknown type — return as-is but tagged, so the caller can surface it
    // rather than silently dropping a goal.
    return { ...goal, branch: goal.branch || 'either', priority: goal.priority ?? 50, shortfallTolerance: goal.shortfallTolerance || 'soft', objective: goal.objective || null, constraints: goal.constraints || [], unknownType: true }
  }
  return {
    ...goal,
    branch: goal.branch || meta.branch,
    priority: Number.isFinite(goal.priority) ? goal.priority : meta.defaultPriority,
    shortfallTolerance: goal.shortfallTolerance || meta.defaultShortfall,
    objective: goal.objective || meta.objective,
    question: goal.question || meta.question,
    alwaysOn: goal.alwaysOn ?? !!meta.alwaysOn,
    constraints: (goal.constraints && goal.constraints.length) ? goal.constraints : constraintsFor(goal.type, ctx),
  }
}

// ─── orderGoals — the budgeting rule made concrete. Lexicographic:
//   1. priority ascending (lower number funded first)
//   2. tie-break: hard before soft (lowest shortfall tolerance first)
//   3. tie-break: original order (stable → deterministic)
// always-on constraint goals sort to the end (they are not "funded").
export function orderGoals(goals = []) {
  const rank = { hard: 0, soft: 1 }
  return goals
    .map((g, i) => ({ g, i }))
    .sort((a, b) => {
      const aOn = a.g.alwaysOn ? 1 : 0, bOn = b.g.alwaysOn ? 1 : 0
      if (aOn !== bOn) return aOn - bOn
      const pa = Number.isFinite(a.g.priority) ? a.g.priority : 50
      const pb = Number.isFinite(b.g.priority) ? b.g.priority : 50
      if (pa !== pb) return pa - pb
      const sa = rank[a.g.shortfallTolerance] ?? 1, sb = rank[b.g.shortfallTolerance] ?? 1
      if (sa !== sb) return sa - sb
      return a.i - b.i
    })
    .map(x => x.g)
}

// ─── PLAN → GOAL mapping. Personas carry an ad-hoc `plans[]` (type:
// retirement/estate/tax/gift/protection + a `target` blob). Map those to
// canonical goal types using the branch + target shape to disambiguate. This is
// how the engine reads REAL persona data instead of fabricated goals.
function planToGoalType(plan, branch) {
  const t = String(plan?.type || '').toLowerCase()
  switch (t) {
    case 'retirement':
      // Accumulator's retirement plan = "retire by X"; decumulator's = drawing
      // an income (floor if it looks like essentials, else spend target).
      return branch === 'decumulation' ? 'income_floor' : 'retire_by'
    case 'estate':   return 'legacy'
    case 'gift':     return 'gifting'
    case 'tax':      return branch === 'decumulation' ? 'min_lifetime_tax' : 'maximise_relief'
    case 'protection': return null // protection is a cover concern, not a fund/draw goal — handled elsewhere
    case 'debt':     return 'debt_free'
    case 'house':    return 'house_deposit'
    case 'education': return 'education_fund'
    case 'care':     return 'fund_care'
    case 'charity':  return 'charity'
    default:         return null
  }
}

// Pull a typed `target` out of the persona plan's loose target blob.
function targetFromPlan(plan, goalType) {
  const tg = plan?.target || {}
  const meta = GOAL_TYPES[goalType]
  const kind = meta?.targetKind
  // Prefer the field that matches the goal's target kind; fall back sensibly.
  const income = tg.monthlyDrawdown != null ? +tg.monthlyDrawdown * 12
    : tg.targetAnnual != null ? +tg.targetAnnual
    : tg.monthlyIncome != null ? +tg.monthlyIncome * 12
    : null
  const lump = tg.netWorth != null ? +tg.netWorth
    : tg.amount != null ? +tg.amount
    : tg.gapAmount != null ? +tg.gapAmount
    : null
  const date = tg.date || null
  const age = tg.age != null ? +tg.age : null
  return {
    kind,
    income, lump, date, age,
    ihtCap: tg.ihtCap != null ? +tg.ihtCap : null,
    raw: tg,
  }
}

// ─── deriveGoals — read an entity's real data into canonical (un-normalised)
// goals. Reads entity.plans[], folds in drawdownPlan / targetIncome. Branch
// inferred once. Priority seeded from plan order is NOT used — needs-hierarchy
// defaults drive it until the user reorders (so a persona's incidental plan
// order doesn't masquerade as a deliberate ranking). ───
export function deriveGoals(entity = {}, opts = {}) {
  const branch = opts.branch || inferBranch(entity)
  const plans = Array.isArray(entity.plans) ? entity.plans : []
  const goals = []
  const seen = new Set()

  for (const plan of plans) {
    if (plan && plan.status === 'archived') continue
    const type = planToGoalType(plan, branch)
    if (!type || seen.has(type)) continue
    seen.add(type)
    goals.push({
      id: plan.id || `goal-${type}`,
      type,
      label: plan.label || null,
      target: targetFromPlan(plan, type),
      sourcePlanId: plan.id || null,
      status: plan.status || 'active',
    })
  }

  // Fold the active drawdown intent into the income goal's target if a
  // decumulator has one but no explicit income figure came through the plan.
  if (branch === 'decumulation' && entity.drawdownPlan) {
    const dp = entity.drawdownPlan
    const incomeGoal = goals.find(g => g.type === 'income_floor' || g.type === 'max_lifetime_spend')
    const annual = dp.targetAnnual != null ? +dp.targetAnnual : (dp.targetMonthly != null ? +dp.targetMonthly * 12 : null)
    if (incomeGoal && annual != null && incomeGoal.target?.income == null) {
      incomeGoal.target = { ...incomeGoal.target, income: annual }
    }
  }

  return goals
}

// ─── goalSpec — the single entry the branch solvers + UI consume:
// derive → normalise → order. Pure and deterministic. ───
export function goalSpec(entity = {}, opts = {}) {
  const branch = opts.branch || inferBranch(entity)
  const ctx = { iht2027: opts.iht2027 || new Date('2027-04-06') }
  const raw = opts.goals || deriveGoals(entity, { branch })
  const normalised = raw.map(g => normalizeGoal(g, ctx))
  return {
    branch,
    goals: orderGoals(normalised),
    primary: orderGoals(normalised).find(g => !g.alwaysOn) || null,
  }
}
