// ─────────────────────────────────────────────────────────────────────────────
// DECUMULATION — DRAW CLASSIFICATION + EVALUATE/EXCLUDE PRE-PASS  (engine P1)
//
// Replaces the old "everything that isn't DB is a drawable pot" assumption with
// a per-holding, feature-aware classification that runs BEFORE any sequencing.
// Spec: 0-Active/route-specs/2026-06-03-decumulation-engine-redesign-SPEC.md §2/§4.
//
// Two public functions:
//   classify(holding)            → derives the holding's DRAW_CLASS
//   evaluateHoldings(holdings, o) → { secureIncome, excluded, specialist,
//                                     reserve, sequenceable, netFloorIncome }
//
// Keyed on the 115-type asset taxonomy IDs (src/engine/asset-taxonomy.js). The
// taxonomy ID gives the BASE class; per-holding feature flags (gar, safeguarded,
// relief clock, user lock, embedded gain) override it. Founder decision (2026-06-03):
// MODEL safeguarded features (GAR annuitised income, DB net) into the floor where
// data exists, rather than only flag-and-exclude.
// ─────────────────────────────────────────────────────────────────────────────

import { TAX } from './fq-calculator.js'

// ── DRAW_CLASS enum (§2) ─────────────────────────────────────────────────────
export const DRAW_CLASS = {
  DRAW_DOWN: 'DRAW-DOWN',
  GUARANTEED_INCOME: 'GUARANTEED-INCOME-NOT-A-POT',
  ANNUITISE: 'ANNUITISE-DONT-DRAW',
  CONSOLIDATE_FIRST: 'CONSOLIDATE-OR-DRAW-FIRST',
  RELIEF_LOCKED: 'RELIEF-LOCKED-DONT-SELL-EARLY',
  CGT_MANAGED: 'DRAW-WITH-CGT-MANAGEMENT',
  EMERGENCY_BUFFER: 'EMERGENCY-BUFFER',
  SEQUENCE_RESERVE: 'SEQUENCE-RISK-RESERVE',
  ILLIQUID_LAST: 'ILLIQUID-LAST-RESORT',
  NOT_INCOME: 'NOT-INCOME',
  SPECIALIST: 'SPECIALIST-ADVICE-FLAG',
  // ordering hints layered on DRAW_DOWN / CGT_MANAGED — still sequenceable
  DRAW_FIRST_LOW_RETURN: 'DRAW-FIRST-LOW-RETURN',
  DRAW_LAST_TAX_FREE: 'DRAW-LAST-TAX-FREE',
  DRAW_EARLY_CGT_EXEMPT: 'DRAW-EARLY-CGT-EXEMPT',
  INCOME_PRODUCING_KEEP: 'INCOME-PRODUCING-KEEP',
  SELL_FOR_CAPITAL: 'SELL-FOR-CAPITAL-WITH-CGT',
}
const D = DRAW_CLASS

// Classes that, once derived, enter the sequenceable residual.
const SEQUENCEABLE = new Set([
  D.DRAW_DOWN, D.CGT_MANAGED, D.CONSOLIDATE_FIRST,
  D.DRAW_FIRST_LOW_RETURN, D.DRAW_LAST_TAX_FREE, D.DRAW_EARLY_CGT_EXEMPT,
  D.SELL_FOR_CAPITAL,
])

// ── Base taxonomy-ID → DRAW_CLASS map (§2, 58 income-relevant rows) ───────────
// Conditional rows (one ID, different class by feature flag) carry their PRIMARY
// class here; classify() applies the flag override. Protection products are
// NOT-INCOME by construction and omitted (never reach the sequencer).
export const TAXONOMY_DRAW_CLASS = {
  // PENSIONS
  SIPP: D.DRAW_DOWN, SSAS: D.DRAW_DOWN, WORKPLACE_DC: D.DRAW_DOWN, GPP: D.DRAW_DOWN,
  MASTER_TRUST: D.DRAW_DOWN, STAKEHOLDER: D.DRAW_DOWN, FAD: D.DRAW_DOWN, UFPLS: D.DRAW_DOWN,
  PERSONAL_PENSION: D.CONSOLIDATE_FIRST, DC_DEFERRED: D.CONSOLIDATE_FIRST,
  DB: D.GUARANTEED_INCOME, DB_CARE: D.GUARANTEED_INCOME, DB_PUBLIC: D.GUARANTEED_INCOME,
  DB_HYBRID: D.GUARANTEED_INCOME, // DC part split out during normalisation
  RAC_S226: D.ANNUITISE, SECTION_32: D.SPECIALIST, QROPS: D.SPECIALIST,
  STATE: D.GUARANTEED_INCOME, ANNUITY: D.GUARANTEED_INCOME, ANNUITY_ENHANCED: D.GUARANTEED_INCOME,
  // INVESTMENTS
  ISA_SS: D.DRAW_LAST_TAX_FREE, ISA_CASH: D.DRAW_DOWN, LISA: D.DRAW_DOWN,
  IFISA: D.DRAW_DOWN, JISA_SS: D.NOT_INCOME, JISA_CASH: D.NOT_INCOME, HTB_ISA: D.SPECIALIST,
  GIA: D.CGT_MANAGED, EQUITIES: D.CGT_MANAGED, FUNDS: D.CGT_MANAGED, INV_TRUST: D.CGT_MANAGED,
  ETF: D.CGT_MANAGED, ETC_GOLD: D.CGT_MANAGED, REIT: D.CGT_MANAGED, FX_INVEST: D.CGT_MANAGED,
  GILTS: D.DRAW_EARLY_CGT_EXEMPT, CORP_BONDS: D.CGT_MANAGED, // QCB flag flips in classify()
  STRUCTURED: D.SPECIALIST, BOND_ON: D.SPECIALIST, BOND_OFF: D.SPECIALIST,
  BOND_WP: D.SPECIALIST, BOND_CR: D.SPECIALIST,
  EIS: D.RELIEF_LOCKED, SEIS: D.RELIEF_LOCKED, VCT: D.RELIEF_LOCKED,
  // PROPERTY
  RESIDENCE: D.NOT_INCOME, SECOND_HOME: D.CGT_MANAGED, OVERSEAS: D.CGT_MANAGED,
  BTL: D.INCOME_PRODUCING_KEEP, HMO: D.INCOME_PRODUCING_KEEP, HOLIDAY_LET: D.INCOME_PRODUCING_KEEP,
  MIXED_USE: D.INCOME_PRODUCING_KEEP, COMMERCIAL: D.INCOME_PRODUCING_KEEP,
  SHARED_OWNERSHIP: D.ILLIQUID_LAST, LAND: D.ILLIQUID_LAST, WOODLAND: D.ILLIQUID_LAST,
  DEVELOPMENT_LAND: D.SELL_FOR_CAPITAL, EQUITY_RELEASE: D.NOT_INCOME, HOME_REVERSION: D.NOT_INCOME,
  // BUSINESS
  PSC_EQUITY: D.RELIEF_LOCKED, LTD_INVESTMENT: D.SELL_FOR_CAPITAL, SOLE_TRADER: D.RELIEF_LOCKED,
  PARTNERSHIP: D.RELIEF_LOCKED, LLP: D.RELIEF_LOCKED, BPR_AIM: D.RELIEF_LOCKED,
  EOT: D.SELL_FOR_CAPITAL, IP_ASSET: D.INCOME_PRODUCING_KEEP, DLA: D.DRAW_FIRST_LOW_RETURN,
  EMI: D.SELL_FOR_CAPITAL, CSOP: D.SELL_FOR_CAPITAL, SAYE: D.SELL_FOR_CAPITAL,
  SIP: D.SELL_FOR_CAPITAL, RSU: D.SELL_FOR_CAPITAL, UNAPPROVED_OPTIONS: D.SELL_FOR_CAPITAL,
  GROWTH_SHARES: D.SELL_FOR_CAPITAL,
  // CASH
  CURRENT: D.EMERGENCY_BUFFER, SAVINGS: D.DRAW_FIRST_LOW_RETURN, NOTICE: D.SEQUENCE_RESERVE,
  REGULAR_SAVER: D.SEQUENCE_RESERVE, FIXED: D.SEQUENCE_RESERVE, PREMIUM_BONDS: D.DRAW_FIRST_LOW_RETURN,
  NSI_INCOME: D.DRAW_FIRST_LOW_RETURN, NSI_INDEX: D.SEQUENCE_RESERVE, FX_ACCOUNT: D.ILLIQUID_LAST,
  OFFSHORE_CASH: D.CGT_MANAGED, CHILDREN_SAVINGS: D.NOT_INCOME,
  // ALTERNATIVES
  CRYPTO: D.SELL_FOR_CAPITAL, GOLD: D.SELL_FOR_CAPITAL, ART: D.ILLIQUID_LAST, WINE: D.ILLIQUID_LAST,
  JEWELLERY: D.ILLIQUID_LAST, COLLECTIBLE: D.ILLIQUID_LAST, CLASSIC_CARS: D.ILLIQUID_LAST,
  PE: D.ILLIQUID_LAST, P2P: D.INCOME_PRODUCING_KEEP, CROWDFUNDING: D.ILLIQUID_LAST,
  FORESTRY: D.ILLIQUID_LAST,
}

const now = () => new Date()
const future = (d) => d != null && new Date(d).getTime() > now().getTime()

/**
 * Derive a holding's DRAW_CLASS. Taxonomy base class, then per-holding feature
 * overrides (§4 derivation). Pure — no side effects.
 * @param {object} h normalised §3 holding
 * @param {object} [opts] { safeguardedThreshold }
 * @returns {string} DRAW_CLASS value
 */
export function classify(h = {}, opts = {}) {
  const safeguardedThreshold = +opts.safeguardedThreshold || +TAX.safeguardedAdviceThreshold || 30000
  const base = TAXONOMY_DRAW_CLASS[h.taxonomyId] || (h.category === 'cash' ? D.DRAW_FIRST_LOW_RETURN : D.DRAW_DOWN)

  // Universal overrides, highest precedence first.
  if (h.flaggedNonSpendable) return D.NOT_INCOME                       // user lock — never drawn
  if (base === D.NOT_INCOME) return D.NOT_INCOME
  // isPot:false marks a pure income stream (DB/state/annuity) — no drawable
  // balance. A rental property is isPot:false too but carries capital, so the
  // guard keeps its INCOME-PRODUCING-KEEP base class (net rent → floor, capital kept).
  if (h.isPot === false && h.currentValue == null) return D.GUARANTEED_INCOME
  if (h.gar) return D.ANNUITISE                                        // GAR ≈ +40% annuitised — don't draw
  // Safeguarded features needing a specialist to value (GMP / protected-TFC >25% /
  // safeguarded transfer over the advice threshold).
  if (h.gmp || (h.protectedTfcPct > 0.25) || (h.isSafeguarded && (+h.cetv || 0) > safeguardedThreshold)) {
    return D.SPECIALIST
  }
  if (base === D.SPECIALIST) return D.SPECIALIST                       // structured / bonds / S32 / QROPS / HTB
  // Relief-locked (EIS/SEIS/VCT income-relief clock, or BPR/business IHT shelter):
  // stay locked unless the holding period is EXPLICITLY expired. A relief asset
  // with no clock (e.g. BPR-AIM held >2yr — the IHT shelter is the lock, not a
  // clawback clock) defaults to locked so it is never auto-drawn.
  if (base === D.RELIEF_LOCKED) {
    return (h.reliefHoldingEndDate && !future(h.reliefHoldingEndDate)) ? D.DRAW_DOWN : D.RELIEF_LOCKED
  }
  // QCB corporate bonds become CGT-exempt.
  if (h.taxonomyId === 'CORP_BONDS' && h.isQcb) return D.DRAW_EARLY_CGT_EXEMPT
  // High-charge legacy DC with no guarantee → drain first (CONSOLIDATE-OR-DRAW-FIRST).
  if ((base === D.DRAW_DOWN || base === D.CONSOLIDATE_FIRST) && h.category === 'pensions') {
    const amc = (+h.amc || 0) + (+h.ocf || 0)
    if (amc >= 0.012 && !h.gar && !h.isSafeguarded) return D.CONSOLIDATE_FIRST
  }
  return base
}

/**
 * Build a SecureIncomeStream record from a guaranteed/annuitised holding.
 */
function streamFrom(h) {
  const taxTreatment = h.taxTreatment
    || (h.taxonomyId === 'ANNUITY' && h.isPLA ? 'capitalElementExempt'
      : /BTL|HMO|HOLIDAY_LET|MIXED_USE|COMMERCIAL|REIT/.test(h.taxonomyId) ? 'propertyIncome'
      : 'fullyTaxable')
  return {
    id: h.id,
    streamType: h.streamType
      || (h.taxonomyId === 'STATE' ? 'state'
        : /^DB/.test(h.taxonomyId) ? 'DB'
          : /ANNUITY/.test(h.taxonomyId) ? 'lifetimeAnnuity' : 'other'),
    grossAnnual: +h.guaranteedAnnual || +h.grossAnnual || +h.annualIncome || +h.income || 0,
    taxTreatment,
    startAge: h.startAge,
    escalation: h.escalation || h.inflationLinked,
    survivorPct: h.survivorPct,
    cetv: h.cetv,
    flaggedNonSpendable: true,
    sourceTaxonomyId: h.taxonomyId,
  }
}

/**
 * Net a secure-income stream after tax, by tax treatment. Lightweight P1 estimate
 * (precise per-band netting lands in P2 simulatePath). `marginalRate` lets the
 * caller pass a band-aware rate; defaults to the basic rate.
 */
function netStream(s, marginalRate) {
  const gross = +s.grossAnnual || 0
  if (gross <= 0) return 0
  const mr = marginalRate != null ? +marginalRate : (+TAX.br || 0.2)
  if (s.taxTreatment === 'capitalElementExempt') return gross * (1 - mr * 0.15) // ~85% capital element exempt
  // fullyTaxable + propertyIncome: PA covers the first slice; approximate net.
  const pa = +TAX.pa || 12570
  const taxable = Math.max(0, gross - pa)
  return gross - taxable * mr
}

/**
 * The §4 evaluate-then-exclude pre-pass. Classifies every holding and routes it
 * to exactly one bucket BEFORE any sequencing. Returns the secure-income floor.
 *
 * @param {object[]} holdings normalised §3 holdings
 * @param {object} [opts] { safeguardedThreshold, marginalRate }
 */
export function evaluateHoldings(holdings = [], opts = {}) {
  const secureIncome = []
  const excluded = []      // { holding, reason }
  const specialist = []
  const sequenceable = []
  const reserve = { emergency: [], sequence: [] }

  for (const h0 of holdings) {
    const h = { ...h0, drawClassification: classify(h0, opts) }
    const cls = h.drawClassification

    if (h.flaggedNonSpendable) { excluded.push({ holding: h, reason: 'user lock' }); continue }

    switch (cls) {
      case D.GUARANTEED_INCOME:
      case D.ANNUITISE:
        secureIncome.push(streamFrom(h)); continue
      case D.RELIEF_LOCKED:
        excluded.push({ holding: h, reason: `relief clock running to ${h.reliefHoldingEndDate || 'end of hold'}` }); continue
      case D.NOT_INCOME:
        excluded.push({ holding: h, reason: 'not a drawdown source' }); continue
      case D.SPECIALIST:
        specialist.push(h); excluded.push({ holding: h, reason: 'specialist advice needed to value' }); continue
      case D.ILLIQUID_LAST:
        excluded.push({ holding: h, reason: 'illiquid — last resort only' }); continue
      case D.INCOME_PRODUCING_KEEP:
        // Net income joins the floor; capital is not sequenced unless sold.
        if ((+h.rentalNetAnnual || +h.royaltyAnnualIncome || +h.grossAnnual || 0) > 0) {
          secureIncome.push(streamFrom({ ...h, grossAnnual: +h.rentalNetAnnual || +h.royaltyAnnualIncome || +h.grossAnnual }))
        }
        excluded.push({ holding: h, reason: 'income-producing — capital kept, not sequenced' }); continue
      case D.EMERGENCY_BUFFER:
        reserve.emergency.push(h); continue
      case D.SEQUENCE_RESERVE:
        reserve.sequence.push(h); continue
      default:
        sequenceable.push(h)
    }
  }

  const netFloorIncome = secureIncome.reduce((s, str) => s + netStream(str, opts.marginalRate), 0)
  const grossFloorIncome = secureIncome.reduce((s, str) => s + (+str.grossAnnual || 0), 0)

  return { secureIncome, excluded, specialist, reserve, sequenceable, netFloorIncome, grossFloorIncome }
}
