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
import { recommendMethodForGoal, METHODS } from './withdrawal-methods.js'
import { stampGuidance } from './financial-snapshot.js'
import { normaliseHoldings } from './decumulation-holdings.js'
import { evaluateHoldings } from './decumulation-classify.js'

const FCA_DISCLAIMER = 'Illustrative under your stated priorities and assumptions — not a forecast or personal recommendation. Verify decisions with a qualified UK adviser.'

// ─── Context extraction (coverage: DB never a pot; sparse data degrades) ─────
export function extractDecumulationContext(entity = {}, opts = {}) {
  const a = entity.assets || {}
  const inc = entity.income || {}
  const age = +(entity.age ?? entity.individual?.age) || 65
  const horizonAge = +opts.horizonAge || +entity.planningHorizonAge || 95
  // State Pension age from the persona's own record first, then the bundle.
  const spa = +opts.statePensionAge || +inc.statePension?.startAge || TAX.spa || 67

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

  const isaVal = +(a.isa?.value ?? a.isa?.total ?? 0)
  const gia  = +(a.portfolio?.value ?? a.gia?.value ?? a.investments?.value ?? 0)
  const cash = +(a.cash?.total ?? a.cash?.own ?? a.cash?.value ?? 0)
  // Estate property = main residence + every held property (BTLs live in
  // assets.property[]) + legacy btl/buyToLet keys. Illiquid → estate, not drawn.
  const propertyList = Array.isArray(a.property) ? a.property : []
  const property = (+a.residence?.value || 0)
    + propertyList.reduce((s, p) => s + (+(p.value ?? p.value_gbp) || 0), 0)
    + (+a.btl?.value || 0) + (+a.buyToLet?.value || 0)
  const liabilities = +entity.totalLiabilities || sumLiabilities(entity)
  const giaLossesBf = +(a.cgt?.carryForwardLosses || a.cgt?.carry_forward_losses || 0)
  // Embedded-gain fraction of a GIA disposal (assumption — surfaced).
  const giaGainFraction = +opts.giaGainFraction || 0.4

  const statePensionAnnual = +inc.statePension?.annual || +inc.statePension || TAX.statePensionFull
  // Rental: income field first, else net rent summed off the property records.
  const rental = +inc.rentalIncome || +inc.rental || +inc.rent
    || propertyList.reduce((s, p) => s + (+(p.rentalNetAnnual ?? (p.isRental ? p.rentalGrossAnnual : 0)) || 0), 0)
  const dividends = +inc.dividends || 0
  const growth = +opts.growth || +a.sipp?.growth || 0.05
  const inflation = opts.inflation != null ? +opts.inflation : 0.025
  // Marital status drives the spousal exemption: transfers to a surviving spouse
  // (incl. pensions post-2027) are IHT-exempt. Default assumption: a married
  // person leaves the estate to their spouse (overridable via opts).
  const married = !!(entity.isCouple || /married|civil|partner/i.test(
    String(entity.maritalStatus || entity.marital_status || entity.relationshipStatus || entity.household_status || '')))
  const estateToSpouseFraction = opts.estateToSpouseFraction != null
    ? Math.min(1, Math.max(0, +opts.estateToSpouseFraction)) : (married ? 1 : 0)
  // Tax-free-cash (PCLS) available = 25% of the pot, capped by the Lump Sum
  // Allowance (£268,275), less any already taken.
  const pclsLsaCap = Math.max(0, Math.min(pensionDC * 0.25, TAX.lsa) - (+a.sipp?.tfcTaken || 0))

  // Net annual spending target the plan must deliver.
  const incomeTargetAnnual = +opts.incomeTarget
    || +entity.drawdownPlan?.targetAnnual
    || (+entity.drawdownPlan?.targetMonthly ? +entity.drawdownPlan.targetMonthly * 12 : 0)
    || +entity.targetIncome
    || 0

  // ── P1: per-holding model + evaluate/exclude pre-pass (additive) ───────────
  // The scalar `pots` above stays as the compat shim so the legacy sequencer +
  // its 67 tests are untouched. `holdings` + `evaluation` are the new surface the
  // P2 per-holding sequencer and P3 network drill-down will consume.
  const holdings = normaliseHoldings(entity)
  const evaluation = evaluateHoldings(holdings, {
    safeguardedThreshold: TAX.safeguardedAdviceThreshold,
    marginalRate: entity.isHigherRateTaxpayer ? TAX.hr : TAX.br,
  })

  return {
    age, horizonAge, spa, growth, inflation, pclsLsaCap, giaGainFraction, giaLossesBf,
    married, estateToSpouseFraction,
    pots: { pension: pensionDC, isa: isaVal, gia, cash },
    holdings, evaluation,
    property, liabilities, dbIncome,
    secure: { statePensionAnnual, rental, dividends },
    incomeTargetAnnual,
    isHigherRateTaxpayer: !!entity.isHigherRateTaxpayer,
    // Beneficiary's marginal income-tax rate for the post-75 inherited-pension
    // charge (assumption — large inherited pots often push heirs to higher rate).
    beneficiaryRate: +opts.beneficiaryMarginalRate || +entity.beneficiaryMarginalRate || TAX.hr,
    flags: {
      hasDB: dbPots.length > 0 || dbIncome > 0,
      sparse: pensionDC + isaVal + gia + cash === 0,
    },
  }
}

// Robust across the liability shapes that drift across personas:
//   · flat array [{balance|amount|outstanding}]
//   · nested object { mortgage:{outstanding}, otherLoans:[{outstanding}] }
//   · plain numbers
function _liabAmount(v) {
  if (v == null) return 0
  if (typeof v === 'number') return v
  if (Array.isArray(v)) return v.reduce((s, x) => s + _liabAmount(x), 0)
  if (typeof v === 'object') {
    if (v.outstanding != null || v.balance != null || v.amount != null) {
      return +(v.outstanding ?? v.balance ?? v.amount) || 0
    }
    return Object.values(v).reduce((s, x) => s + _liabAmount(x), 0) // recurse one level (mortgage, otherLoans, …)
  }
  return 0
}
function sumLiabilities(entity) {
  return _liabAmount(entity.liabilities || entity.assets?.liabilities)
}

// ─── Deterministic single-path simulation ────────────────────────────────────
// `strategy` is EITHER a pot draw-order array (e.g. ['gia','isa','pension','cash'])
// OR a strategy object { order, fillBand }. With fillBand, each year draws pension
// only up to the basic-rate band (so it's taxed ≤20%), tops up from tax-free
// ISA/cash/GIA, and only overflows pension into higher rate as a last resort —
// the tax-smoothing an adviser actually does. Each year: secure income first,
// then fund the NET target from the pots. IHT at the horizon (2027 flip).
export function simulatePath(ctx, strategy, opts = {}) {
  const order = Array.isArray(strategy) ? strategy : (strategy.order || ['gia', 'isa', 'pension', 'cash'])
  const fillBand = !Array.isArray(strategy) && !!strategy.fillBand
  const iht2027 = opts.iht2027 || TAX.deadline || new Date('2027-04-06')
  const deathYear = (opts.now ? opts.now.getFullYear() : 2026) + (ctx.horizonAge - ctx.age)
  const pensionInEstate = deathYear >= iht2027.getFullYear()

  let bal = { ...ctx.pots }
  let lossesBf = ctx.giaLossesBf
  let lsaRemaining = ctx.pclsLsaCap          // tax-free-cash (PCLS) lifetime cap left
  let totalTax = 0, totalNetDelivered = 0
  const schedule = []
  let depletedAtAge = null
  const startYear = opts.now ? opts.now.getFullYear() : 2026

  for (let age = ctx.age; age <= ctx.horizonAge; age++) {
    const yIdx = age - ctx.age
    // Grow pots at start of year (nominal).
    for (const k of Object.keys(bal)) bal[k] = bal[k] * (1 + ctx.growth)

    const sp = age >= ctx.spa ? ctx.secure.statePensionAnnual : 0
    const secureTaxable = sp + ctx.secure.rental + ctx.dbIncome   // taxed as non-savings
    const secureGross = secureTaxable + ctx.secure.dividends
    // NET spending target, uprated by inflation so real spending power holds.
    const netTarget = ctx.incomeTargetAnnual * Math.pow(1 + ctx.inflation, yIdx)

    // ── Fund the year to hit the NET target. We gross up taxable draws because
    // £1 of pension drawdown delivers < £1 net. Pension's first slice is 25%
    // tax-free (PCLS) up to the LSA cap. Binary-search the total gross pulled
    // from pots (net is monotonic in it) so net delivered == netTarget.
    const potCap = order.reduce((s, p) => s + (bal[p] || 0), 0)
    // Tax-band-fill cap: the most pension gross we can take while its taxable
    // part stays inside the basic-rate band (taxed ≤20%). Taxable part is ~75%
    // while PCLS lasts, else 100%.
    const secureTaxableAbovePA = Math.max(0, secureTaxable - (TAX.pa || 12570))
    const bandTaxableHeadroom = Math.max(0, (TAX.brl || 37700) - secureTaxableAbovePA)
    const taxableFracOfPension = lsaRemaining > 0 ? 0.75 : 1
    const pensionInBandCap = bandTaxableHeadroom / taxableFracOfPension
    const allocate = (totalGross) => {
      let rem = totalGross
      const d = { pension: 0, isa: 0, cash: 0, gia: 0 }
      const fill = (pot, cap) => { const room = Math.max(0, cap - d[pot]); const t = Math.min(rem, room); d[pot] += t; rem -= t }
      if (fillBand) {
        fill('pension', Math.min(bal.pension || 0, pensionInBandCap)) // pension within basic rate
        fill('isa', bal.isa || 0); fill('cash', bal.cash || 0); fill('gia', bal.gia || 0) // tax-free / low top-ups
        fill('pension', bal.pension || 0)                            // overflow into higher rate (last resort)
      } else {
        for (const pot of order) { fill(pot, bal[pot] || 0); if (rem <= 0) break }
      }
      return d
    }
    const evalGross = (totalGross) => {
      const d = allocate(totalGross)
      const pclsTaxFree = Math.min(d.pension * 0.25, lsaRemaining)
      const pensionTaxable = d.pension - pclsTaxFree
      const giaGain = d.gia * ctx.giaGainFraction
      const tx = withdrawalTaxForYear({
        pensionDrawdown: pensionTaxable, statePension: sp,
        otherTaxableIncome: ctx.secure.rental + ctx.dbIncome, dividends: ctx.secure.dividends,
        giaGainRealised: giaGain, isaWithdrawal: d.isa, cgtLossesBroughtForward: lossesBf,
        isHigherRateTaxpayer: ctx.isHigherRateTaxpayer,
      })
      return { d, pclsTaxFree, pensionTaxable, giaGain, tx, net: secureGross + totalGross - tx.total }
    }

    let chosen, gross
    const atCap = evalGross(potCap)
    if (atCap.net <= netTarget) {                       // even draining everything can't meet target
      chosen = atCap; gross = potCap
      if (depletedAtAge == null && potCap < (netTarget - secureGross)) depletedAtAge = age
      if (atCap.net < netTarget - 1 && depletedAtAge == null) depletedAtAge = age
    } else {
      let lo = 0, hi = potCap
      for (let i = 0; i < 40; i++) {                    // bisection on total gross
        const mid = (lo + hi) / 2
        const r = evalGross(mid)
        if (r.net < netTarget) lo = mid; else hi = mid
        if (Math.abs(r.net - netTarget) < 1) { chosen = r; gross = mid; break }
      }
      if (!chosen) { gross = hi; chosen = evalGross(hi) }
    }

    // Commit the chosen draws.
    for (const pot of Object.keys(chosen.d)) bal[pot] -= chosen.d[pot]
    lsaRemaining = Math.max(0, lsaRemaining - chosen.pclsTaxFree)
    lossesBf = chosen.tx.taxFreeUsed.cgtLossesRemaining
    totalTax += chosen.tx.total
    const netDelivered = chosen.net
    totalNetDelivered += netDelivered
    const sourceSwitch = order.find(p => chosen.d[p] > 0 && (bal[p] || 0) <= 1) || null

    // End-of-year pot balances (post-growth, post-draw). `bal` is the REAL
    // running ledger the solver decremented at line ~218 — we expose it so the
    // depletion curve plots a computed balance, never a fabricated one.
    const potsEnd = {
      pension: Math.max(0, Math.round(bal.pension || 0)),
      isa: Math.max(0, Math.round(bal.isa || 0)),
      gia: Math.max(0, Math.round(bal.gia || 0)),
      cash: Math.max(0, Math.round(bal.cash || 0)),
    }
    const potsTotal = potsEnd.pension + potsEnd.isa + potsEnd.gia + potsEnd.cash
    schedule.push({
      year: startYear + yIdx, age,
      fromAsset: order.find(p => chosen.d[p] > 0) || 'secure-only',
      draws: { pension: Math.round(chosen.d.pension), isa: Math.round(chosen.d.isa), cash: Math.round(chosen.d.cash), gia: Math.round(chosen.d.gia) },
      pclsTaxFree: Math.round(chosen.pclsTaxFree),
      grossFromPots: Math.round(gross),
      target: Math.round(netTarget),
      tax: chosen.tx.total,
      net: Math.round(netDelivered),
      ihtDelta: 0,
      sourceSwitch,
      potsEnd,
      potsTotal,
    })
  }

  // Estate / death tax at the horizon. Two effects live here:
  //   (1) the 6-Apr-2027 flip — unused pensions enter the estate for IHT;
  //   (2) the pension DOUBLE TAX — a DC pension inherited on death at/after
  //       age 75 is ALSO income-taxable at the beneficiary's marginal rate, on
  //       top of IHT. Combined 64–67%+ (worse once the RNRB tapers away above
  //       £2m). An inherited ISA suffers IHT only. This is WHY post-2027 the
  //       guidance is to draw the pension down in life, not preserve it.
  //   Mechanism (FA 2026 / gov.uk technical note): income tax is charged on the
  //   pension NET of the IHT attributable to it — no true double charge on the
  //   same slice. Death < 75: pension is income-tax-free (IHT only).
  //   (Spousal exemption for couples handled in a later coverage pass.)
  const liquidRemaining = (bal.isa || 0) + (bal.gia || 0) + (bal.cash || 0)
  const pensionRemaining = bal.pension || 0
  const pensionInEstateVal = pensionInEstate ? pensionRemaining : 0
  const estate = ctx.property + liquidRemaining + pensionInEstateVal - ctx.liabilities
  const rnrb = estate > (TAX.rnrbTaper || 2000000) ? Math.max(0, (TAX.rnrb || 175000) - (estate - (TAX.rnrbTaper || 2000000)) / 2) : (TAX.rnrb || 175000)
  const nilBands = (TAX.nrb || 325000) + rnrb
  const ihtRate = TAX.ihtRate || 0.40
  const benRate = opts.beneficiaryMarginalRate ?? ctx.beneficiaryRate ?? TAX.hr
  // Spousal exemption: the fraction of the estate passing to a surviving spouse
  // is IHT-exempt (and pensions to a spouse are exempt from the 2027 inclusion).
  // Only the NON-spouse fraction bears death tax on this (first) death; the
  // transferable bands + second-death charge are not modelled (surfaced).
  const taxableFrac = 1 - (ctx.estateToSpouseFraction || 0)
  const ihtFull = Math.round(Math.max(0, estate - nilBands) * ihtRate)
  // The pension sits on TOP of the nil-rate bands (those shelter other estate),
  // so its IHT is the marginal 40% — capped at the total IHT (audit fix vs the
  // old gross-estate apportionment which overstated the net-of-IHT base).
  const pensionIHTShareFull = Math.min(pensionInEstateVal * ihtRate, ihtFull)
  const pensionDeathIncomeTaxFull = (pensionInEstate && ctx.horizonAge >= 75)
    ? Math.round((pensionInEstateVal - pensionIHTShareFull) * benRate)
    : 0
  const ihtExposure = Math.round(ihtFull * taxableFrac)
  const pensionDeathIncomeTax = Math.round(pensionDeathIncomeTaxFull * taxableFrac)
  const totalDeathTax = ihtExposure + pensionDeathIncomeTax
  const afterIhtEstate = Math.round(estate - totalDeathTax)

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
    pensionDeathIncomeTax, totalDeathTax, pensionRemainingAtDeath: Math.round(pensionInEstateVal),
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

  // Neutral, descriptive names (no imperatives like "Draw…"/"Spend…", no
  // "preserve" editorialising) — these are sequences to compare, not steers.
  // (Compliance: avoids implying one course is suitable-for-you.)
  const paths = [
    { id: 'gia-first', name: 'Taxable-accounts-first sequence', method: 'gia_first', order: ['gia', 'isa', 'pension', 'cash'] },
    { id: 'isa-first', name: 'ISA-first sequence', method: 'isa_first', order: ['cash', 'isa', 'gia', 'pension'] },
    { id: 'pension-first', name: 'Pension-first sequence', method: 'pension_first', order: ['pension', 'gia', 'isa', 'cash'] },
    // The adviser-grade route: draw pension only up to the basic-rate band each
    // year, top up from tax-free ISA/cash, overflow pension only as last resort.
    { id: 'fill-band', name: 'Tax-band-smoothed (fill basic rate, top up from ISA)', method: 'fill_band', order: ['pension', 'isa', 'cash', 'gia'], fillBand: true },
  ]
  // Goal-weighted order.
  let tunedOrder, tunedName
  if (primary === 'legacy' || primary === 'min_lifetime_tax') {
    tunedOrder = post2027
      ? ['pension', 'gia', 'cash', 'isa']   // shrink the now-taxable pension; keep ISA transfer
      : ['gia', 'cash', 'isa', 'pension']   // pre-2027 pension is IHT-free → keep it last
    tunedName = post2027 ? 'IHT-weighted sequence (pension before Apr 2027)' : 'IHT-weighted sequence (pension preserved, pre-2027)'
  } else if (primary === 'income_floor' || primary === 'max_lifetime_spend') {
    tunedOrder = ['cash', 'gia', 'isa', 'pension'] // cash buffer, keep tax-advantaged pots compounding
    tunedName = 'Income-weighted sequence (cash buffer, pension last)'
  } else {
    tunedOrder = ['gia', 'isa', 'cash', 'pension']
    tunedName = 'Balanced sequence'
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
    metrics: { ...s.sim, _taxPlusIht: s.sim.totalTax + s.sim.ihtExposure + (s.sim.pensionDeathIncomeTax || 0) },
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
    return stampGuidance({
      rankedPaths: [], network: { nodes: [], edges: [], alternatives: [] }, perGoal: [],
      coverage: coverageSurface(ctx, ledger, ['no drawable assets captured']),
      methodology: buildMethodology(ctx, ledger, goalSpec),
      inputs: {
        incomeTargetAnnual: Math.round(ctx.incomeTargetAnnual),
        currentAge: ctx.age, horizonAge: ctx.horizonAge,
        growth: ctx.growth, inflation: ctx.inflation, statePensionAge: ctx.spa,
      },
      ledger, binding: null, disclaimer: FCA_DISCLAIMER,
    }, entity, opts)
  }

  const candidates = generateCandidatePaths(ctx, goalSpec, opts)
  const simulated = candidates.map(path => ({ path, sim: simulatePath(ctx, path, opts) }))
  const ranked = scorePaths(simulated, goalSpec)

  const rankedPaths = ranked.map(r => ({
    id: r.path.id, name: r.path.name, method: r.path.method, rank: r.rank,
    successPct: r.sim.successPct, totalTaxCost: r.sim.totalTax, ihtExposure: r.sim.ihtExposure,
    pensionDeathIncomeTax: r.sim.pensionDeathIncomeTax, totalDeathTax: r.sim.totalDeathTax,
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
    // Report the SAME quantity the ranking optimised on — for min_lifetime_tax
    // that is income tax + IHT + inherited-pension income tax, not income tax
    // alone (audit tie-out fix: the displayed number must reconcile with the
    // logic that ranked the path).
    const value = od && top
      ? (od.key === '_taxPlusIht'
          ? top.sim.totalTax + top.sim.ihtExposure + (top.sim.pensionDeathIncomeTax || 0)
          : top.sim[od.key]) ?? null
      : null
    return { goalId: g.id || g.type, type: g.type, objective: g.objective, value, successPct: top?.sim.successPct ?? null }
  })

  const out = {
    // CONTRACT for UI consumers (compliance): `rank` is a sort by the user's
    // stated priorities, NOT a verdict. Label rank-1 as "ranked highest under
    // your priorities (illustrative)" — never "optimal", "best", or
    // "recommended". Present paths as peers to compare, not winner+also-rans.
    rankedPaths: rankedPaths.map(({ path, sim, ...rest }) => rest), // strip internals from public shape
    network: buildNetwork(ctx, rankedPaths),
    perGoal,
    coverage: coverageSurface(ctx, ledger, []),
    methodology: buildMethodology(ctx, ledger, goalSpec),
    ledger,
    labels: {
      ranking: 'Ranked by your stated priorities — illustrative, not "the best path for you".',
      resilience: 'Funding resilience: a deterministic illustration under your assumptions, not a probability.',
    },
    binding: { primaryGoal: goalSpec?.primary?.type || null, lexicographicOrder: (goalSpec?.goals || []).filter(g => !g.alwaysOn).map(g => g.type) },
    recommendedMethod: (() => { const id = recommendMethodForGoal(goalSpec?.primary?.type); return { id, label: METHODS[id]?.label, why: METHODS[id]?.summary } })(),
    // Resolved assumptions echoed back so the UI can seed interactive controls
    // from the REAL values used (not hardcoded guesses) and show provenance.
    inputs: {
      incomeTargetAnnual: Math.round(ctx.incomeTargetAnnual),
      currentAge: ctx.age, horizonAge: ctx.horizonAge,
      growth: ctx.growth, inflation: ctx.inflation, statePensionAge: ctx.spa,
    },
    disclaimer: FCA_DISCLAIMER,
  }
  return stampGuidance(out, entity, opts)
}

// Rationale = facts about the rules + what THIS sequence does, framed as an
// illustration, never a steer about the user's own pension. (Compliance: the
// swap test — replace "your pension / draw it down" with "an undrawn pension /
// under the rules" and it must still read as a fact, not advice.)
function buildRationale(r, ctx, ledger, goalSpec) {
  const steps = []
  const first = r.path.order.find(p => ctx.pots[p] > 0)
  const goalLabel = goalSpec?.primary?.type?.replace(/_/g, ' ') || 'your top priority'
  steps.push(`This sequence draws ${first} first. A goals-based method orders withdrawals to serve your top stated priority (${goalLabel}) before lower ones — this is one illustration of that method, not a recommendation to act.`)
  if (r.path.method.includes('pension') && r.sim.pensionInEstate) {
    steps.push('Under the rules, from 6 April 2027 an undrawn pension counts toward inheritance tax; a pension drawn during life is no longer part of the estate.')
  }
  if (r.sim.pensionDeathIncomeTax > 0) {
    steps.push(`On these assumptions ~£${Math.round(r.sim.pensionRemainingAtDeath / 1000)}k of pension would remain at age ${ctx.horizonAge}. Under the rules, an unused pension inherited after age 75 is taxed for inheritance AND the beneficiary pays income tax on it — here roughly £${Math.round(r.sim.totalDeathTax / 1000)}k combined. The more of a pension is drawn during life, the less is exposed to that combined charge — a property of the rules, not a suggestion about your pension.`)
  }
  if (ledger.notes?.length) steps.push(...ledger.notes)
  if (!r.sim.survived) steps.push(`On these assumptions the liquid pots fund spending to age ${r.sim.depletedAtAge} before running low — a flag to review your assumptions, not a forecast. Property is not counted as income here.`)
  return steps
}

// ─── Methodology provenance — the "How we worked this out" data (founder
// 2026-06-02: surface the logic so the user trusts the method). Every rule
// named with its legal source + status; every assumption listed. The UI renders
// this as a transparency panel. FCA: shown as method/illustration, not advice.
function buildMethodology(ctx, ledger, goalSpec) {
  const order = (goalSpec?.goals || []).filter(g => !g.alwaysOn).map(g => g.type)
  const rules = [
    {
      id: 'goal-priority', rule: 'We rank paths by your stated priorities',
      plainEnglish: `Your goals, in order: ${order.join(' → ') || 'income first'}. We find the withdrawal path that best serves the top priority, breaking ties by the next — so a higher goal is never sacrificed for a lower one.`,
      source: 'Goals-based budgeting rule (MSCI WealthBench; Vanguard VLCM)', status: 'METHOD',
    },
    {
      id: 'income-tax', rule: 'UK income tax on pension drawdown',
      plainEnglish: `Drawdown is taxed after your personal allowance (£${Math.round(TAX.pa).toLocaleString()}), at ${Math.round(TAX.br * 100)}% / ${Math.round(TAX.hr * 100)}% / ${Math.round(TAX.ar * 100)}% bands. ISA and the 25% tax-free cash are not taxed.`,
      source: 'Income Tax Act 2007', status: 'ENACTED',
    },
    {
      id: 'cgt', rule: 'Capital Gains Tax on GIA disposals',
      plainEnglish: `Gains above the £${Math.round(TAX.cgaAllowance).toLocaleString()} annual exemption are taxed at ${Math.round(TAX.cgtBasic * 100)}%/${Math.round(TAX.cgtHigher * 100)}%; carried-forward losses offset gains down to the exemption.`,
      source: 'TCGA 1992; HMRC CG21500', status: 'ENACTED',
    },
    {
      id: 'iht-2027', rule: 'Pensions enter the estate for inheritance tax',
      plainEnglish: `From 6 April 2027, unused pensions count toward your estate and may be taxed at ${Math.round((TAX.ihtRate || 0.4) * 100)}% inheritance tax. Before then they sit outside it.`,
      source: 'Finance Act 2026 (Royal Assent 18 Mar 2026)', status: 'ENACTED',
    },
    {
      id: 'pension-double-tax', rule: 'Inherited-pension double tax after age 75',
      plainEnglish: `If you die at or after 75, an unused pension is taxed for inheritance AND your beneficiary pays income tax (assumed ${Math.round(ctx.beneficiaryRate * 100)}%) when they draw it — a combined hit that can exceed 64%. This is why drawing the pension down in life often leaves more behind.`,
      source: 'Finance Act 2026; ITEPA 2003', status: 'ENACTED',
    },
  ]
  if (ledger?.allowances?.pension_aa) rules.push({
    id: 'carry-forward', rule: 'Unused allowances carried from prior years',
    plainEnglish: 'Pension allowance unused in the last 3 years can be added to this year (unless the Money Purchase Annual Allowance has been triggered, which voids it). Other allowances carry forward, carry back, or reset — we apply each correctly.',
    source: 'FA 2011 Sch 17; FA 2004', status: 'ENACTED',
  })
  return {
    rules,
    assumptions: ctx ? [
      { name: 'Investment growth', value: `${Math.round(ctx.growth * 100)}% nominal/yr`, editable: true },
      { name: 'Planning horizon', value: `age ${ctx.horizonAge}`, editable: true },
      { name: 'Beneficiary income-tax rate', value: `${Math.round(ctx.beneficiaryRate * 100)}%`, editable: true },
      { name: 'GIA embedded gain', value: `${Math.round(ctx.giaGainFraction * 100)}% of disposals`, editable: true },
    ] : [],
    note: 'Illustrative under your assumptions — not a forecast or personal recommendation.',
  }
}

function coverageSurface(ctx, ledger, unknowns) {
  const extra = []
  if (ctx?.property > 0) extra.push(`£${Math.round(ctx.property / 1000)}k of property is NOT modelled as an income source (downsizing / equity release / sale + property CGT are excluded) — runway shown is from liquid pots only.`)
  if (ctx?.married) extra.push(`Assumes the estate passes to your spouse on first death (spousal exemption applied — ${Math.round((ctx.estateToSpouseFraction || 0) * 100)}%), so death tax shown is for THIS death only; the transferable allowances and second-death charge are not yet modelled.`)
  else extra.push('Assumes a single person — for couples, transfers between spouses are usually inheritance-tax-free, so the death-tax figures would differ.')
  extra.push('The resilience score is a deterministic illustration under these assumptions, NOT a probability of success.')
  return {
    household: ctx?.married ? 'couple (spousal exemption applied to first death)' : 'single',
    pensionKinds: ctx.flags.hasDB ? ['DB (income, not a pot)', 'DC'] : ['DC'],
    wrappers: Object.entries(ctx.pots).filter(([, v]) => v > 0).map(([k]) => k),
    dataRichness: ctx.flags.sparse ? 'sparse' : 'sufficient',
    assumptions: [`deterministic ${Math.round(ctx.growth * 100)}% nominal growth`, `${Math.round(ctx.inflation * 100)}% inflation (spending target uprated each year)`, `25% tax-free cash used up to the £${Math.round((ctx.pclsLsaCap || 0) / 1000)}k Lump Sum Allowance`, `GIA embedded-gain ${Math.round(ctx.giaGainFraction * 100)}%`, `horizon age ${ctx.horizonAge}`, `beneficiary income-tax rate ${Math.round(ctx.beneficiaryRate * 100)}% (inherited-pension charge if death ≥75)`],
    unknowns: [...unknowns, ...extra, ...(ledger.notes || [])],
  }
}
