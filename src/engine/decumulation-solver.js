// src/engine/decumulation-solver.js
// ─────────────────────────────────────────────────────────────────────────────
// solveDecumulation — the goal-driven decumulation centrepiece (step 2b).
// Consumes the ordered goalSpec (goal-engine.js) → generates candidate
// withdrawal paths → simulates each deterministically under real per-year UK
// tax (withdrawal-tax.js) with the 6-Apr-2027 pension-in-estate flip → scores
// them LEXICOGRAPHICALLY by the user's goal priority → emits ranked paths +
// network + per-goal outcomes.
//
// Pure & deterministic (no Math.random — guytonKlingerPath in fq-calculator
// uses RNG, so we do NOT call it; we generate our own seeded schedules). All
// tax/IHT figures come from the rules bundle. Projection is deterministic, NOT
// Monte Carlo — successPct is an honest deterministic proxy (survival + buffer),
// labelled as such.
//
// Output contract (locked, design doc §4.5): every path carries `schedule`
// (the visible route), `scoreBreakdown` (why it won), `rationale`; the solver
// returns 2–4 selectable branches + a network with `alternatives`; `coverage`
// is the honesty surface.
//
// Design: ~/.claude/plans/goal-engine-design.md §3, §3.5, §4.5
// ─────────────────────────────────────────────────────────────────────────────

import { TAX } from './fq-calculator.js'
import { withdrawalTaxForYear, buildAllowanceLedger } from './withdrawal-tax.js'

const FCA_DISCLAIMER = 'Illustrative under your stated priorities and assumptions — not a forecast or personal recommendation. Verify decisions with a qualified UK adviser.'

// ─── Context extraction (coverage: DB never a pot; sparse data degrades) ─────
export function extractDecumulationContext(entity = {}, opts = {}) {
  const a = entity.assets || {}
  const inc = entity.income || {}
  const age = +(entity.age ?? entity.individual?.age) || 65
  const horizonAge = +opts.horizonAge || +entity.planningHorizonAge || 95
  const spa = +opts.statePensionAge || TAX.spa || 67

  // Spendable DC/SIPP pots only. DB schemes are guaranteed INCOME + a CETV —
  // never a drawable pot (the classic bug). Their income joins secureIncome.
  const pensionPots = Array.isArray(a.sipp?.pensions) ? a.sipp.pensions : []
  const isDB = (p) => /\b(db|defined benefit|final salary|career average|safeguarded)\b/i.test(String(p?.type || ''))
  const dbPots = pensionPots.filter(isDB)
  let pensionDC = 0
  if (pensionPots.length) pensionDC = pensionPots.filter(p => !isDB(p)).reduce((s, p) => s + (+p.value || 0), 0)
  else pensionDC = +a.sipp?.total || 0
  const dbIncome = dbPots.reduce((s, p) => s + (+p.annualIncome || +p.income || 0), 0)
    + (+a.dbPension?.annualIncome || +inc.dbPension || 0)

  const isa  = +a.isa?.value ?? 0; const isaVal = +(a.isa?.value ?? a.isa?.total ?? 0)
  const gia  = +(a.portfolio?.value ?? a.gia?.value ?? a.investments?.value ?? 0)
  const cash = +(a.cash?.total ?? a.cash?.own ?? a.cash?.value ?? 0)
  const property = (+a.residence?.value || 0) + (+a.btl?.value || 0) + (+a.buyToLet?.value || 0)
  const liabilities = +entity.totalLiabilities || sumLiabilities(entity)
  const giaLossesBf = +(a.cgt?.carryForwardLosses || a.cgt?.carry_forward_losses || 0)
  // Embedded-gain fraction of a GIA disposal (assumption — surfaced).
  const giaGainFraction = +opts.giaGainFraction || 0.4

  const statePensionAnnual = +inc.statePension?.annual || TAX.statePensionFull
  const rental = +inc.rental || +inc.rent || 0
  const dividends = +inc.dividends || 0
  const growth = +opts.growth || +a.sipp?.growth || 0.05

  // Net annual spending target the plan must deliver.
  const incomeTargetAnnual = +opts.incomeTarget
    || +entity.drawdownPlan?.targetAnnual
    || (+entity.drawdownPlan?.targetMonthly ? +entity.drawdownPlan.targetMonthly * 12 : 0)
    || +entity.targetIncome
    || 0

  return {
    age, horizonAge, spa, growth, giaGainFraction, giaLossesBf,
    pots: { pension: pensionDC, isa: isaVal, gia, cash },
    property, liabilities, dbIncome,
    secure: { statePensionAnnual, rental, dividends },
    incomeTargetAnnual,
    isHigherRateTaxpayer: !!entity.isHigherRateTaxpayer,
    flags: {
      hasDB: dbPots.length > 0 || dbIncome > 0,
      sparse: pensionDC + isaVal + gia + cash === 0,
    },
  }
}

function sumLiabilities(entity) {
  const L = entity.liabilities || entity.assets?.liabilities
  if (Array.isArray(L)) return L.reduce((s, l) => s + (+l.balance || +l.amount || 0), 0)
  if (L && typeof L === 'object') return Object.values(L).reduce((s, v) => s + (+(v?.balance ?? v) || 0), 0)
  return 0
}

// ─── Deterministic single-path simulation ────────────────────────────────────
// `order` is the pot draw-order, e.g. ['gia','isa','pension','cash']. Each year:
// secure income first, then draw the remaining GROSS need from pots in order.
// Pension draws are taxable; ISA/cash tax-free; GIA realises a gain fraction.
// IHT computed at the horizon (death proxy) with the 2027 pension-in-estate flip.
export function simulatePath(ctx, order, opts = {}) {
  const iht2027 = opts.iht2027 || TAX.deadline || new Date('2027-04-06')
  const deathYear = (opts.now ? opts.now.getFullYear() : 2026) + (ctx.horizonAge - ctx.age)
  const pensionInEstate = deathYear >= iht2027.getFullYear()

  let bal = { ...ctx.pots }
  let lossesBf = ctx.giaLossesBf
  let totalTax = 0, totalNetDelivered = 0
  const schedule = []
  let depletedAtAge = null

  for (let age = ctx.age; age <= ctx.horizonAge; age++) {
    // Grow pots at start of year.
    for (const k of Object.keys(bal)) bal[k] = bal[k] * (1 + ctx.growth)

    const sp = age >= ctx.spa ? ctx.secure.statePensionAnnual : 0
    const secureGross = sp + ctx.secure.rental + ctx.secure.dividends + ctx.dbIncome
    const grossNeed = Math.max(0, ctx.incomeTargetAnnual - secureGross)

    // Draw the gross need from pots in order.
    let need = grossNeed
    const draws = { pension: 0, isa: 0, cash: 0, gia: 0 }
    for (const pot of order) {
      if (need <= 0) break
      const take = Math.min(need, bal[pot] || 0)
      draws[pot] += take
      bal[pot] -= take
      need -= take
    }
    const sourceSwitch = order.find(p => draws[p] > 0 && bal[p] <= 1) || null
    if (need > 0 && depletedAtAge == null) depletedAtAge = age

    // Tax on the year's composition.
    const giaGain = draws.gia * ctx.giaGainFraction
    const tx = withdrawalTaxForYear({
      pensionDrawdown: draws.pension,
      statePension: sp,
      otherTaxableIncome: ctx.secure.rental,
      dividends: ctx.secure.dividends,
      giaGainRealised: giaGain,
      isaWithdrawal: draws.isa,
      cgtLossesBroughtForward: lossesBf,
      isHigherRateTaxpayer: ctx.isHigherRateTaxpayer,
    }, { })
    lossesBf = tx.taxFreeUsed.cgtLossesRemaining
    totalTax += tx.total
    const netDelivered = secureGross + grossNeed - tx.total
    totalNetDelivered += netDelivered

    schedule.push({
      year: (opts.now ? opts.now.getFullYear() : 2026) + (age - ctx.age),
      age,
      fromAsset: order.find(p => draws[p] > 0) || 'secure-only',
      draws: { ...draws },
      gross: Math.round(grossNeed),
      tax: tx.total,
      net: Math.round(netDelivered),
      ihtDelta: 0, // filled at horizon below
      sourceSwitch,
    })
  }

  // Estate / IHT at the horizon (the 2027 flip lives here).
  const liquidRemaining = (bal.isa || 0) + (bal.gia || 0) + (bal.cash || 0)
  const pensionRemaining = bal.pension || 0
  const estate = ctx.property + liquidRemaining + (pensionInEstate ? pensionRemaining : 0) - ctx.liabilities
  const rnrb = estate > (TAX.rnrbTaper || 2000000) ? Math.max(0, (TAX.rnrb || 175000) - (estate - (TAX.rnrbTaper || 2000000)) / 2) : (TAX.rnrb || 175000)
  const nilBands = (TAX.nrb || 325000) + rnrb
  const ihtExposure = Math.round(Math.max(0, estate - nilBands) * (TAX.ihtRate || 0.40))
  const afterIhtEstate = Math.round(estate - ihtExposure)

  const survived = depletedAtAge == null
  const yearsCovered = (depletedAtAge ?? (ctx.horizonAge + 1)) - ctx.age
  const totalYears = ctx.horizonAge - ctx.age + 1
  // Deterministic survival proxy: 100 if survived with terminal buffer, else
  // scaled by fraction of horizon funded.
  const terminalBuffer = (bal.pension || 0) + liquidRemaining
  const successPct = survived
    ? Math.min(100, 80 + Math.min(20, Math.round(terminalBuffer / Math.max(1, ctx.incomeTargetAnnual) * 2)))
    : Math.round((yearsCovered / totalYears) * 70)

  return {
    schedule, totalTax: Math.round(totalTax), totalNetDelivered: Math.round(totalNetDelivered),
    finalEstate: Math.round(estate), afterIhtEstate, ihtExposure,
    survived, depletedAtAge, successPct, pensionInEstate, terminalBuffer: Math.round(terminalBuffer),
  }
}

// ─── Candidate path generation ───────────────────────────────────────────────
// Standard orders + a goal-tuned order. Post-2027 + legacy → draw pension early
// (it now adds to the estate); pre-2027 or income-first → pension last.
export function generateCandidatePaths(ctx, goalSpec, opts = {}) {
  const primary = goalSpec?.primary?.type
  const iht2027 = opts.iht2027 || TAX.deadline || new Date('2027-04-06')
  const deathYear = (opts.now ? opts.now.getFullYear() : 2026) + (ctx.horizonAge - ctx.age)
  const post2027 = deathYear >= iht2027.getFullYear()

  const paths = [
    { id: 'gia-first', name: 'Spend taxable first', method: 'gia_first', order: ['gia', 'isa', 'pension', 'cash'] },
    { id: 'isa-first', name: 'Spend ISA first (preserve pension)', method: 'isa_first', order: ['cash', 'isa', 'gia', 'pension'] },
    { id: 'pension-first', name: 'Draw pension early', method: 'pension_first', order: ['pension', 'gia', 'isa', 'cash'] },
  ]
  // Goal-tuned order.
  let tunedOrder, tunedName
  if (primary === 'legacy' || primary === 'min_lifetime_tax') {
    tunedOrder = post2027
      ? ['pension', 'gia', 'cash', 'isa']   // shrink the now-taxable pension; keep ISA transfer
      : ['gia', 'cash', 'isa', 'pension']   // pre-2027 pension is IHT-free → keep it last
    tunedName = post2027 ? 'IHT-tuned: draw pension before 2027 bite' : 'IHT-tuned: preserve pension (pre-2027)'
  } else if (primary === 'income_floor' || primary === 'max_lifetime_spend') {
    tunedOrder = ['cash', 'gia', 'isa', 'pension'] // cash buffer, keep tax-advantaged pots compounding
    tunedName = 'Income-tuned: cash buffer, pension last'
  } else {
    tunedOrder = ['gia', 'isa', 'cash', 'pension']
    tunedName = 'Balanced order'
  }
  paths.push({ id: 'goal-tuned', name: tunedName, method: 'goal_tuned', order: tunedOrder, tuned: true })
  return paths
}

// ─── Lexicographic scoring against the ordered goals ─────────────────────────
// Each goal contributes an objective value; paths sorted by the primary goal's
// objective, ties broken by the next goal, and so on (the budgeting rule).
const OBJECTIVE_DIRECTION = {
  maximise_p_floor_for_life: { key: 'successPct', dir: +1 },
  maximise_sustainable_income: { key: 'totalNetDelivered', dir: +1 },
  maximise_after_iht_estate: { key: 'afterIhtEstate', dir: +1 },
  minimise_income_tax_plus_iht: { key: '_taxPlusIht', dir: -1 },
  fund_gap_to_state_pension: { key: 'successPct', dir: +1 },
}

export function scorePaths(simulated, goalSpec) {
  const goals = (goalSpec?.goals || []).filter(g => !g.alwaysOn && OBJECTIVE_DIRECTION[g.objective])
  const withMetrics = simulated.map(s => ({
    ...s,
    metrics: { ...s.sim, _taxPlusIht: s.sim.totalTax + s.sim.ihtExposure },
  }))
  const cmp = (a, b) => {
    for (const g of goals) {
      const od = OBJECTIVE_DIRECTION[g.objective]
      const av = a.metrics[od.key] ?? 0, bv = b.metrics[od.key] ?? 0
      if (av !== bv) return (bv - av) * od.dir
    }
    return 0
  }
  const ranked = [...withMetrics].sort(cmp)
  // scoreBreakdown: each goal's metric contribution → "why this path won".
  return ranked.map((p, i) => ({
    ...p,
    rank: i + 1,
    scoreBreakdown: goals.reduce((acc, g) => {
      const od = OBJECTIVE_DIRECTION[g.objective]
      acc[g.type] = { objective: g.objective, value: p.metrics[od.key] ?? 0, better: od.dir > 0 ? 'higher' : 'lower' }
      return acc
    }, {}),
  }))
}

// ─── Network (assets = nodes, draw flows = edges, branches = alternatives) ────
function buildNetwork(ctx, rankedPaths) {
  const potNodes = Object.entries(ctx.pots)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ id: k, label: k, value: Math.round(v), kind: 'pot' }))
  const sink = { id: 'income', label: 'Your income', kind: 'sink' }
  const top = rankedPaths[0]
  const edges = top ? top.path.order
    .filter(p => ctx.pots[p] > 0)
    .map((p, i) => ({ from: p, to: 'income', order: i + 1, taxCost: null, kind: i === 0 ? 'draw-first' : 'then' }))
    : []
  const alternatives = rankedPaths.slice(1).map(rp => ({
    pathId: rp.path.id, name: rp.path.name, order: rp.path.order,
    successPct: rp.sim.successPct, afterIhtEstate: rp.sim.afterIhtEstate, totalTax: rp.sim.totalTax,
  }))
  return { nodes: [...potNodes, sink], edges, alternatives }
}

// ─── The public solver ───────────────────────────────────────────────────────
export function solveDecumulation({ entity, goalSpec, opts = {} } = {}) {
  const ctx = extractDecumulationContext(entity, opts)
  const ledger = buildAllowanceLedger(entity, opts)

  // Sparse / no-decumulation-assets → honest empty result, never fabricate.
  if (ctx.flags.sparse) {
    return {
      rankedPaths: [], network: { nodes: [], edges: [], alternatives: [] }, perGoal: [],
      coverage: coverageSurface(ctx, ledger, ['no drawable assets captured']),
      ledger, binding: null, disclaimer: FCA_DISCLAIMER,
    }
  }

  const candidates = generateCandidatePaths(ctx, goalSpec, opts)
  const simulated = candidates.map(path => ({ path, sim: simulatePath(ctx, path.order, opts) }))
  const ranked = scorePaths(simulated, goalSpec)

  const rankedPaths = ranked.map(r => ({
    id: r.path.id, name: r.path.name, method: r.path.method, rank: r.rank,
    successPct: r.sim.successPct, totalTaxCost: r.sim.totalTax, ihtExposure: r.sim.ihtExposure,
    afterIhtEstate: r.sim.afterIhtEstate, survived: r.sim.survived, depletedAtAge: r.sim.depletedAtAge,
    scoreBreakdown: r.scoreBreakdown,
    rationale: buildRationale(r, ctx, ledger, goalSpec),
    schedule: r.sim.schedule,
    path: r.path,
    sim: r.sim,
  }))

  const perGoal = (goalSpec?.goals || []).filter(g => !g.alwaysOn).map(g => {
    const od = OBJECTIVE_DIRECTION[g.objective]
    const top = rankedPaths[0]
    return {
      goalId: g.id || g.type, type: g.type, objective: g.objective,
      value: od && top ? top.sim[od.key === '_taxPlusIht' ? 'totalTax' : od.key] ?? null : null,
      successPct: top?.sim.successPct ?? null,
    }
  })

  return {
    rankedPaths: rankedPaths.map(({ path, sim, ...rest }) => rest), // strip internals from public shape
    network: buildNetwork(ctx, rankedPaths),
    perGoal,
    coverage: coverageSurface(ctx, ledger, []),
    ledger,
    binding: { primaryGoal: goalSpec?.primary?.type || null, lexicographicOrder: (goalSpec?.goals || []).filter(g => !g.alwaysOn).map(g => g.type) },
    disclaimer: FCA_DISCLAIMER,
  }
}

function buildRationale(r, ctx, ledger, goalSpec) {
  const steps = []
  const first = r.path.order.find(p => ctx.pots[p] > 0)
  steps.push(`Advisers generally line up withdrawals to a goal — here, ${goalSpec?.primary?.type?.replace(/_/g, ' ') || 'your priority'} — drawing ${first} first under this path.`)
  if (r.path.method.includes('pension') && r.sim.pensionInEstate) {
    steps.push('From 6 April 2027 unused pensions count toward inheritance tax, so drawing the pension during life can reduce the estate.')
  }
  if (ledger.notes?.length) steps.push(...ledger.notes)
  if (!r.sim.survived) steps.push(`On these assumptions the plan funds to age ${r.sim.depletedAtAge} before the pots run low — a flag, not a forecast.`)
  return steps
}

function coverageSurface(ctx, ledger, unknowns) {
  return {
    household: 'single', // couples handled in a later pass
    pensionKinds: ctx.flags.hasDB ? ['DB (income, not a pot)', 'DC'] : ['DC'],
    wrappers: Object.entries(ctx.pots).filter(([, v]) => v > 0).map(([k]) => k),
    dataRichness: ctx.flags.sparse ? 'sparse' : 'sufficient',
    assumptions: [`deterministic ${Math.round(ctx.growth * 100)}% nominal growth`, `GIA embedded-gain ${Math.round(ctx.giaGainFraction * 100)}%`, `horizon age ${ctx.horizonAge}`],
    unknowns: [...unknowns, ...(ledger.notes || [])],
  }
}
