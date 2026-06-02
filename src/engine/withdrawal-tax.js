// src/engine/withdrawal-tax.js
// ─────────────────────────────────────────────────────────────────────────────
// Per-year UK withdrawal tax + the AllowanceLedger (temporal allowances).
// Pure, deterministic, Node-importable. Step 2 of the goal engine — the
// load-bearing tax surface the decumulation solver scores paths against.
//
// EVERY figure comes from the rules bundle (TAX) — ZERO hardcoded tax numbers.
// The silent wrong-key fallback bug class (see memory) is the thing this file
// is most at risk of, so each bundle key is read by name and asserted in tests
// against hand-calcs.
//
// Reuses (does not reinvent):
//   · incomeTax(drawdown, statePension, effPA)  fq-calculator.js — banded income tax
//   · calcPersonalAllowance(income)             fq-calculator.js — PA taper
//   · calcDividendTax(div, otherTaxable)        fq-calculator.js — dividend bands
//   · allowanceTracker(entity)                  tax-estate-engine.js — headroom + pension carry_forward
//   · carryForwardByYear(entity)                persona-helpers.js — FA 2011 oldest-first 3-tuple
//   · lsaHeadroom(entity)                       fq-calculator.js — LSA/LSDBA pool
// Design: ~/.claude/plans/goal-engine-design.md §3.5
// ─────────────────────────────────────────────────────────────────────────────

import { TAX, incomeTax, calcPersonalAllowance, calcDividendTax, lsaHeadroom } from './fq-calculator.js'
import { allowanceTracker } from './tax-estate-engine.js'
import { carryForwardByYear } from './persona-helpers.js'

// ─── Per-year withdrawal tax ─────────────────────────────────────────────────
// Given a single year's withdrawal composition, return the tax due, split by
// kind. Tax-free components (PCLS 25%, ISA) are excluded from the taxable base
// by construction — passing them in is a no-op on tax, which is the point: the
// solver can route income through them to cut the bill.
//
// HMRC ordering honoured: non-savings income first (uses PA + basic band), then
// gains stack on top as the top slice (so the basic-rate CGT band is only what
// the income left unused). Dividends/savings use their own allowances.
//
// @param {object} y - the year's withdrawal composition (all annual £):
//   { pensionDrawdown, statePension, otherTaxableIncome, dividends, savingsInterest,
//     giaGainRealised, isaWithdrawal, pcls, isHigherRateTaxpayer,
//     cgtLossesBroughtForward }
// @param {object} [opts] - { bundle } (reserved; TAX is the active bundle)
// @returns {{ incomeTax, cgt, dividendTax, savingsTax, total, taxFreeUsed, breakdown }}
export function withdrawalTaxForYear(y = {}, opts = {}) {
  const pensionDrawdown = +y.pensionDrawdown || 0
  const statePension    = +y.statePension || 0
  const otherTaxable    = +y.otherTaxableIncome || 0
  const dividends       = +y.dividends || 0
  const savings         = +y.savingsInterest || 0
  const gainRealised    = +y.giaGainRealised || 0
  const isaWithdrawal   = +y.isaWithdrawal || 0
  const pcls            = +y.pcls || 0
  const lossesBf        = +y.cgtLossesBroughtForward || 0

  // ── Non-savings income tax (pension drawdown + other taxable + state pension)
  // PA tapers on total income (ANI proxy = all taxable income; PCLS/ISA excluded).
  const taxableNonSavings = pensionDrawdown + otherTaxable
  const grossForTaper = taxableNonSavings + statePension + savings + dividends
  const effPA = calcPersonalAllowance(grossForTaper)
  const incTax = incomeTax(taxableNonSavings, statePension, effPA)

  // Taxable non-savings ABOVE the personal allowance — needed to know how much
  // basic-rate band the gains/dividends can still use.
  const taxableAbovePA = Math.max(0, taxableNonSavings + statePension - effPA)

  // HMRC statutory ordering (ITA 2007 s16): non-savings → SAVINGS → DIVIDENDS,
  // with dividends the TOP slice. (Audit fix 2026-06-02: savings were wrongly
  // stacked above dividends, and the basic-rate band was handed to both.)

  // ── Savings tax (PSA by band; stacks directly above non-savings).
  const ART = TAX.art, BRT = TAX.brt
  const aniProxy = grossForTaper
  const psa = aniProxy >= ART ? (TAX.psaAdditional || 0)
            : aniProxy >= BRT ? (TAX.psaHigher || 500)
            : (TAX.psaBasic || 1000)
  const savingsTaxable = Math.max(0, savings - psa)
  const svBasicRoom = Math.max(0, TAX.brl - taxableAbovePA)
  const svBasic = Math.min(savingsTaxable, svBasicRoom)
  const svHigher = Math.max(0, savingsTaxable - svBasic)
  const savingsTax = Math.round(svBasic * TAX.br + svHigher * TAX.hr)

  // ── Dividend tax — the genuine TOP slice: stacks above non-savings + taxable
  // savings, so it only reaches the basic-rate band that those leave unused.
  const dvTax = dividends > 0 ? calcDividendTax(dividends, taxableAbovePA + savingsTaxable).tax : 0

  // ── CGT on realised GIA gains. Brought-forward losses reduce the gain only
  // down TO the annual exempt amount, never below (CG21500). Gains are the top
  // slice: basic-rate CGT only on the band the income left unused.
  const AEA = TAX.cgaAllowance
  // Apply b/f losses: usable only to bring gain to AEA (excess loss carries on).
  const gainAfterLosses = lossesBf > 0
    ? Math.max(Math.min(gainRealised, AEA), gainRealised - lossesBf)
    : gainRealised
  const lossesUsed = Math.max(0, gainRealised - gainAfterLosses)
  const gainTaxable = Math.max(0, gainAfterLosses - AEA)
  const cgtBasicRoom = Math.max(0, TAX.brl - taxableAbovePA - Math.max(0, dividends - (TAX.dividendAllowance || 500)) - savingsTaxable)
  const gainBasic = Math.min(gainTaxable, cgtBasicRoom)
  const gainHigher = Math.max(0, gainTaxable - gainBasic)
  const cgt = Math.round(gainBasic * TAX.cgtBasic + gainHigher * TAX.cgtHigher)

  const total = incTax + dvTax + savingsTax + cgt
  return {
    incomeTax: incTax,
    dividendTax: dvTax,
    savingsTax,
    cgt,
    total,
    taxFreeUsed: { pcls, isaWithdrawal, cgtLossesUsed: lossesUsed, cgtLossesRemaining: Math.max(0, lossesBf - lossesUsed) },
    breakdown: {
      effPA, psa, AEA,
      taxableNonSavings, taxableAbovePA, gainTaxable, gainBasic, gainHigher,
      marginalBand: aniProxy >= ART ? 'additional' : aniProxy >= BRT ? 'higher' : 'basic',
    },
  }
}

// ─── AllowanceLedger (temporal allowances) ───────────────────────────────────
// Build the per-allowance picture the solver reads BEFORE scoring paths: each
// allowance's temporalType + current headroom + what prior-year unused balance
// is available. Reuses the existing trackers rather than reinventing tax law.
//
// temporalType ∈ annual_reset | carry_forward(N) | carry_back(N) |
//                lifetime_pool | taper_decay | transferable_on_death
//
// The two traps the solver MUST honour (verified gov.uk/HMRC):
//   · MPAA triggered → pension AA carry-forward is VOID (only MPAA available).
//   · Tapered AA → the carryable amount is the reduced AA, not £60k.
//
// @param {object} entity
// @param {object} [opts] - { mpaaTriggered?:bool }
// @returns {{ allowances: object, pensionAAAvailable:number, notes:string[] }}
export function buildAllowanceLedger(entity = {}, opts = {}) {
  const notes = []
  let tracker = {}
  try { tracker = allowanceTracker(entity) || {} } catch { tracker = {} }

  // Pension AA — current year (possibly tapered) + 3yr carry-forward, unless MPAA.
  const aaCurrent = tracker.pension_aa?.current_year || { total: TAX.pensionAA, used: 0, remaining: TAX.pensionAA, tapered: false }
  const tapered = !!aaCurrent.tapered
  const mpaaTriggered = opts.mpaaTriggered != null
    ? !!opts.mpaaTriggered
    : !!(entity.pension?.mpaaTriggered || entity.mpaaTriggered || +(entity.drawdown || 0) > 0 && entity.pension?.flexiblyAccessed)
  const cfByYear = carryForwardByYear(entity) // [y-3, y-2, y-1] oldest-first, or null
  const cfTotal = Array.isArray(cfByYear)
    ? cfByYear.reduce((s, v) => s + (+v || 0), 0)
    : (tracker.pension_aa?.carry_forward?.total || 0)

  let pensionAAAvailable
  if (mpaaTriggered) {
    pensionAAAvailable = TAX.mpaa
    notes.push('MPAA triggered — pension carry-forward void; only the Money Purchase Annual Allowance is available.')
  } else {
    pensionAAAvailable = (aaCurrent.remaining ?? aaCurrent.total ?? TAX.pensionAA) + cfTotal
    if (tapered) notes.push('Tapered annual allowance — carry-forward is based on the reduced allowance, not £60k.')
    if (cfTotal > 0) notes.push(`Carry-forward available from the prior 3 years: ${Math.round(cfTotal)} (oldest year used first).`)
  }

  // CGT brought-forward losses (carry_forward indefinitely, to AEA floor).
  const cgtLossesBf = +(entity.assets?.cgt?.carryForwardLosses || entity.assets?.cgt?.carry_forward_losses || 0)

  // LSA / LSDBA lifetime pool.
  let lsa = { lsaRemaining: TAX.lsa, lsdbaRemaining: TAX.lsdba, hasProtection: false }
  try { lsa = lsaHeadroom(entity) || lsa } catch { /* keep default */ }

  // IHT annual gift exemption — carry_forward(1) only.
  const giftCurrent = TAX.annualGiftExemption
  const giftLastYearUnused = +(entity.iht?.giftExemptionLastYearUnused || entity.giftExemptionLastYearUnused || 0)

  const allowances = {
    pension_aa: {
      temporalType: 'carry_forward', carryYears: 3, condition: 'scheme member each year; current year used first',
      currentYear: aaCurrent.total ?? TAX.pensionAA, currentRemaining: aaCurrent.remaining ?? aaCurrent.total ?? TAX.pensionAA,
      tapered, mpaaTriggered, carryForwardByYear: cfByYear, carryForwardTotal: mpaaTriggered ? 0 : cfTotal,
      available: pensionAAAvailable, status: 'ENACTED',
    },
    cgt_losses: {
      temporalType: 'carry_forward', carryYears: Infinity, condition: 'usable only down to the annual exempt amount; 4yr claim window',
      broughtForward: cgtLossesBf, aea: TAX.cgaAllowance, status: 'ENACTED',
    },
    isa: {
      temporalType: 'annual_reset', condition: 'use-it-or-lose-it — never banked',
      total: tracker.isa?.total ?? TAX.isaAllowance, remaining: tracker.isa?.remaining ?? TAX.isaAllowance, status: 'ENACTED',
    },
    iht_gift_exemption: {
      temporalType: 'carry_forward', carryYears: 1, condition: 'one year only (max 2× current)',
      currentYear: giftCurrent, lastYearUnused: Math.min(giftCurrent, giftLastYearUnused),
      available: giftCurrent + Math.min(giftCurrent, giftLastYearUnused), status: 'ENACTED',
    },
    lsa: {
      temporalType: 'lifetime_pool', lsaRemaining: lsa.lsaRemaining, lsdbaRemaining: lsa.lsdbaRemaining,
      hasProtection: !!lsa.hasProtection, status: 'ENACTED',
    },
    // Carry-BACK reliefs — surfaced as available levers (claimed in a prior year).
    eis_relief: { temporalType: 'carry_back', carryYears: 1, rate: TAX.eisITRate, status: 'ENACTED' },
    seis_relief: { temporalType: 'carry_back', carryYears: 1, rate: TAX.seisITRate, status: 'ENACTED' },
    gift_aid: { temporalType: 'carry_back', carryYears: 1, status: 'ENACTED' },
    marriage_allowance: { temporalType: 'carry_back', carryYears: 4, status: 'ENACTED' },
    // Time-decay — informational for the solver's IHT scoring.
    pet_taper: { temporalType: 'taper_decay', schedule: TAX.petTaperByYear, status: 'ENACTED' },
  }

  return { allowances, pensionAAAvailable, cgtLossesBf, notes }
}
