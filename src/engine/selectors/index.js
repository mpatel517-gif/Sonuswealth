/**
 * src/engine/selectors/index.js
 *
 * S1 — Engine Selector Layer (Phase 2, 2026-05-28)
 *
 * Single import surface for canonical entity reads. Surfaces (screens, drills,
 * components) should import from this module rather than reaching into raw
 * engine helpers — that way the "what counts as Liabilities" question has
 * exactly one answer, not N inline implementations.
 *
 * Background:
 *   The 2026-05-27 cross-surface audit caught the P0-2 bug: HomeScreen had
 *   an inline `(+l.mortgage || 0) + (+l.loans || 0) + …` reader that missed
 *   Bruce's £180k BTL mortgage (stored at `l.otherLoans[0].outstanding`).
 *   The engine's `liabilitiesTotal()` walker handled that shape correctly
 *   but the screen never called it. Multiple surfaces had the same problem
 *   for different fields (net worth, monthly essentials, IHT total, ANI).
 *
 *   This module fixes that class of bug structurally: there is one
 *   `liabilities(entity)` selector. If a surface needs Liabilities, it
 *   imports from here. Drift caught by `eslint-no-restricted-imports`.
 *
 * Conventions:
 *   - All selectors take `(entity, ...optionalContext)` and return a number,
 *     object, or boolean. Never mutate.
 *   - Selectors return `0`/`null`/`{}` for missing data, never throw.
 *   - Engine-internal helpers stay in `_helpers.js`, `canonical-metrics.js`,
 *     `tax-estate-engine.js`, `fq-calculator.js`, `persona-helpers.js`.
 *     This file is a re-export facade, not new logic.
 *
 * If a selector you need isn't here yet — add it. Do not import from raw
 * engine files in screens.
 */

// ── Balance Sheet ───────────────────────────────────────────────────────────
import {
  pensionTotal as _pensionTotal,
  investmentsTotal as _investmentsTotal,
  propertyTotal as _propertyTotal,
  cashTotal as _cashTotal,
  alternativesTotal as _alternativesTotal,
  businessTotal as _businessTotal,
  liabilitiesTotal as _liabilitiesTotal,
  annualIncome as _annualIncome,
  personAge as _personAge,
  statePensionAnnual as _statePensionAnnual,
  getMonthlyEssentials as _getMonthlyEssentials,
  protectionFlat as _protectionFlat,
  getWrapper as _getWrapper,
  isCouple as _isCouple,
} from '../_helpers.js';

import {
  netWorth as _netWorth,
  investable as _investable,
  calcANI as _calcANI,
  calcHICBC as _calcHICBC,
  calcPSA as _calcPSA,
  protectionScore as _protectionScore,
  calcFQ as _calcFQ,
  calcFQCalibrated as _calcFQCalibrated,
  netWorthHistory as _netWorthHistory,
  netWorthAtYears as _netWorthAtYears,
} from '../fq-calculator.js';

import {
  ihtExposure as _ihtExposure,
  costOfInactionEstate as _coi,  // P0-5 (2026-05-28): renamed from costOfInaction for clarity
} from '../tax-estate-engine.js';

import {
  ihtProjection as _ihtProjection,
  ihtDeltaPrePost2027 as _ihtDeltaPrePost2027,
  coiForDomain as _coiForDomain,
} from '../canonical-metrics.js';

import {
  maritalStatus as _maritalStatus,
} from '../persona-helpers.js';

import {
  dependants as _dependants,
  normalisePersona as _normalisePersona,
  validatePersona as _validatePersona,
  lpaStatus as _lpaStatus,
  warnIfLegacy as _warnIfLegacy,
  detectSchema as _detectSchema,
} from '../persona-normalizer.js';

// ── Balance-sheet selectors ─────────────────────────────────────────────────
/** Total pension wealth — DC + DB CETV + SIPP. Walks every shape. */
export const pensions = (entity) => _pensionTotal(entity);

/** Total investable assets — ISA + GIA + crypto + ETF + Alts. */
export const investments = (entity) => _investmentsTotal(entity);

/** Total property — PPR + BTL + holiday + commercial. Net of mortgage shown via liabilities(). */
export const properties = (entity) => _propertyTotal(entity);

/** Total cash — current + savings + ISA cash + premium bonds. */
export const cash = (entity) => _cashTotal(entity);

/**
 * Total alternatives — crypto, gold, art, wine, P2P, private equity. Illiquid.
 * Added 2026-05-28 (TO-1): engine netWorth() previously omitted this entirely
 * but display walkers (MyMoney heroTotalAssets) added them — breaking hero
 * arithmetic for personas holding alternatives. NOT added to investable() —
 * deliberately excluded because alternatives are illiquid.
 */
export const alternatives = (entity) => _alternativesTotal(entity);

/**
 * Total private-business equity (assets.businesses[]). TO-7 (2026-05-28):
 * previously invisible to NW. Tradeable BPR-qualifying instruments
 * (AIM/EIS/SEIS) stay inside `investments` to avoid double-counting.
 */
export const businesses = (entity) => _businessTotal(entity);

/**
 * Total liabilities — mortgage(s), loans, credit cards, otherLoans[], otherDebt.
 * Replaces inline `(+l.mortgage||0) + (+l.loans||0) + …` patterns that miss
 * shape variants (P0-2 root cause).
 */
export const liabilities = (entity) => _liabilitiesTotal(entity);

/** Net worth: investable + property + pensions + cash − liabilities. Canonical. */
export const netWorth = (entity) => _netWorth(entity);

/** Investable assets (liquid + investable wrappers, excludes home equity & pensions). */
export const investable = (entity) => _investable(entity);

/** Total assets — sum of all positive holdings (excludes liabilities). */
export const assetsTotal = (entity) => pensions(entity) + investments(entity) + properties(entity) + cash(entity);

/**
 * P13-1 (2026-05-28, IFA must-fix #1) — Concentration risk reader.
 *
 * Returns `{ topClass, topPct, classes: { pensions, properties, investments, cash }, status }`
 * where `status` ∈ {ok, watch, concentrated, severe}:
 *   ok           — top class ≤ 50%
 *   watch        — 50%–65% (early warning)
 *   concentrated — 65%–80% (real conversation)
 *   severe       — &gt; 80% (single-asset-class household — top priority)
 *
 * Why this exists: the FQ score is band-based across 5+ sub-dimensions but doesn't
 * weight single-asset-class concentration. A retired HNW with 70% in property reads
 * "fine" at FQ 69 — that's the IFA conversation the dashboard wasn't surfacing.
 * Now this reader is the source of truth for the concentration chip on Home/MyMoney/Risk.
 */
/**
 * P13-5 (2026-05-28, IFA must-fix #5) — Unified vulnerability signal.
 *
 * Consumer Duty (FCA, July 2023) requires platforms to recognise potentially
 * vulnerable clients and adapt tone + suppress urgency. Returns:
 *   {
 *     status: 'none' | 'watch' | 'elevated' | 'high',
 *     reasons: string[],   // human-readable list of triggers
 *     toneHint: 'standard' | 'gentle' | 'pause',  // shapes copy register
 *   }
 *
 * Triggers (any one bumps status):
 *   · life-stage 'foundation' (age ≤ 22) — financial literacy still forming
 *   · life-stage 'preservation' + age ≥ 80 — capacity concern window
 *   · recent bereavement event (within 12 months)
 *   · recent divorce/separation event (within 6 months)
 *   · recent capacity-loss flag (long-term illness, disability event)
 *   · monthly deficit > 10% of monthly income — financial difficulty signal
 *
 * Multiple triggers escalate: 1=watch, 2=elevated, 3+=high.
 */
export const derivedVulnerability = (entity) => {
  const reasons = []
  const age = entity?.age || 0
  const lifeStage = String(entity?.lifeStage || entity?.life_stage || '').toLowerCase()
  const events = Array.isArray(entity?.events) ? entity.events : []
  const now = new Date()
  const monthsAgo = (d) => {
    try { return (now - new Date(d)) / (1000 * 60 * 60 * 24 * 30.44) } catch { return Infinity }
  }

  // Trigger 1 — foundation life-stage
  if (lifeStage === 'foundation' || (age > 0 && age <= 22)) {
    reasons.push('Foundation life-stage — financial literacy still forming; suppress urgency, lead with education')
  }
  // Trigger 2 — late preservation / capacity window
  if ((lifeStage === 'preservation' || lifeStage === 'legacy') && age >= 80) {
    reasons.push(`Age ${age} with preservation/legacy life-stage — mental-capacity concerns possible; defer to LPA-holder where applicable`)
  }
  // Trigger 3 — recent bereavement
  const bereavement = events.find(e => /bereave|widow|partner_died|spouse_died/.test(String(e?.type || '').toLowerCase()))
  if (bereavement && monthsAgo(bereavement.date) <= 12) {
    reasons.push(`Bereavement within 12 months (${bereavement.date}) — decisions deferred; emphasise no rush`)
  }
  // Trigger 4 — recent divorce / separation
  const divorce = events.find(e => /divorce|separat|cohab.sep/.test(String(e?.type || '').toLowerCase()))
  if (divorce && monthsAgo(divorce.date) <= 6) {
    reasons.push(`Divorce/separation within 6 months (${divorce.date}) — financial position still settling`)
  }
  // Trigger 5 — capacity-loss / long illness event
  const illness = events.find(e => /capacity_loss|long_illness|disability|terminal/.test(String(e?.type || '').toLowerCase()))
  if (illness) {
    reasons.push(`Health event recorded (${illness.type}) — verify LPA + ensure caregiver access where appropriate`)
  }
  // Trigger 6 — financial difficulty (deficit > 10% of income)
  try {
    const income = +(entity?.income?.employment || 0) +
                   +(entity?.income?.dividends   || 0) +
                   +(entity?.income?.rental      || 0) +
                   +(entity?.income?.selfEmploymentNet || 0)
    const monthlyIncome = income / 12
    const monthlyEss = +(entity?.expenses?.essentialsMonthly || 0)
    if (monthlyIncome > 0 && monthlyEss > 0) {
      const deficitPct = Math.max(0, (monthlyEss - monthlyIncome) / monthlyIncome)
      if (deficitPct > 0.10) {
        reasons.push(`Essentials exceed income by ${Math.round(deficitPct * 100)}% — financial-difficulty signal`)
      }
    }
  } catch { /* shape edge — skip */ }

  let status = 'none'
  if (reasons.length >= 3)      status = 'high'
  else if (reasons.length === 2) status = 'elevated'
  else if (reasons.length === 1) status = 'watch'

  const toneHint =
    status === 'high'      ? 'pause' :
    status === 'elevated'  ? 'gentle' :
    status === 'watch'     ? 'gentle' :
                              'standard'

  return { status, reasons, toneHint }
}

export const concentrationRisk = (entity) => {
  const p = pensions(entity)
  const r = properties(entity)
  const i = investments(entity)
  const c = cash(entity)
  const total = p + r + i + c
  if (!total || total <= 0) {
    return { topClass: null, topPct: 0, classes: { pensions: 0, properties: 0, investments: 0, cash: 0 }, status: 'ok', total: 0 }
  }
  const classes = {
    pensions:    p / total,
    properties:  r / total,
    investments: i / total,
    cash:        c / total,
  }
  // Find the class with the largest share
  let topClass = 'pensions'
  let topPct = 0
  for (const [k, v] of Object.entries(classes)) {
    if (v > topPct) { topClass = k; topPct = v }
  }
  let status = 'ok'
  if      (topPct > 0.80) status = 'severe'
  else if (topPct > 0.65) status = 'concentrated'
  else if (topPct > 0.50) status = 'watch'
  return { topClass, topPct, classes, status, total }
}

// ── Income selectors ────────────────────────────────────────────────────────
/** Annual gross income — employment + dividends + rental + state pension. */
export const annualIncome = (entity) => _annualIncome(entity);

/** Annual state pension (if drawing or eligible). */
export const statePensionAnnual = (entity) => _statePensionAnnual(entity);

/**
 * Adjusted Net Income for tax thresholds (PA taper, HICBC, ART).
 * Returns `{ ani, … }` — destructure `.ani` for the number.
 */
export const ani = (entity, bundle) => _calcANI(entity, bundle);

/**
 * High-Income Child Benefit Charge — fires when ANI > £60k + entity has
 * `dependants[type=child, age<18]`. Returns `{ charge, ani, threshold, … }`.
 */
export const hicbc = (entity, bundle) => _calcHICBC(entity, bundle);

/** Personal Savings Allowance band (basic/higher/additional). */
export const psa = (entity, bundle) => _calcPSA(entity, bundle);

// ── Expense / liquidity selectors ───────────────────────────────────────────
/**
 * Monthly essentials. Returns `{ monthly, annual, source, isEstimate }`.
 * Walks the 4 supported shapes: expenses.essential_monthly (mrT),
 * expenses.essential_annual, monthlyExpenditure (persona-a..g), fallback
 * 55%-of-income estimate (marked `isEstimate: true`).
 */
export const monthlyEssentials = (entity) => _getMonthlyEssentials(entity);

// ── Tax / Estate selectors ──────────────────────────────────────────────────
/**
 * Canonical IHT exposure for a given bundle + scenario.
 * Returns `{ taxableEstate, nrb, rnrb, taper, iht, effectiveRate, … }`.
 */
export const ihtExposure = (entity, bundle = 'UK-2026.1', scenario = null) =>
  _ihtExposure(entity, bundle, scenario);

/**
 * IHT projection over a horizon (years). Used by R4 signature card.
 * Returns timeline of `{ year, taxable, iht, … }`.
 */
export const ihtProjection = (entity, asOfDate) => _ihtProjection(entity, asOfDate);

/**
 * IHT pre/post April 2027 delta — canonical v0.3 R4 signature card source.
 * Returns `{ pre, post, delta, effectiveRate, … }`.
 */
export const ihtDeltaPrePost2027 = (entity) => _ihtDeltaPrePost2027(entity);

// ── Cost of Inaction ────────────────────────────────────────────────────────
/** Tax-estate CoI: legacy cost of not acting on highlighted plays. */
export const coi = (entity, bundle = 'UK-2026.1') => _coi(entity, bundle);

/** CoI per domain (cashflow, protection, etc.). */
export const coiForDomain = (entity, domain, bundle, marketAssumptions) =>
  _coiForDomain(entity, domain, bundle, marketAssumptions);

// ── Score selectors ─────────────────────────────────────────────────────────
/** Full FQ scorecard — band, gauge, dimension scores. */
export const fq = (entity) => _calcFQ(entity);

/** Calibrated FQ scorecard (post-2026-05 calibration). */
export const fqCalibrated = (entity) => _calcFQCalibrated(entity);

/** Protection score (life cover + IP + CI + savings buffer). */
export const protection = (entity) => _protectionScore(entity);

// ── Demographic / household selectors ───────────────────────────────────────
/** Primary person's age, with DOB → years walker. */
export const age = (entity) => _personAge(entity);

/**
 * Marital status — canonicalised from 6 spelling variants.
 * Returns `{ status, isCouple, isCohab, isMarried, isSingle, rawField }`.
 */
export const maritalStatus = (entity) => _maritalStatus(entity);

/**
 * Boolean: is this entity a couple (married | civil partnership | cohabiting)?
 * For spousal-NRB / inter-spouse exemption use `maritalStatus(e).isMarried`.
 */
export const isCouple = (entity) => _isCouple(entity);

/**
 * Unified dependants reader — resolves UI personas' `dependants[]` and mrT
 * family's `children[]` to a single canonical array. Each entry has
 * `{ id, name, age, type, financiallyDependent, rawSource }`.
 * Used by calcHICBC, family-protection gap, JISA scoping.
 */
export const dependants = (entity) => _dependants(entity);

/**
 * Shallow-overlay normalised persona. Promotes nested shapes (individual.name
 * → name, partner → spouse, children[] → dependants[]) to top-level so any
 * call site can read `.name`, `.dob`, `.age`, `.maritalStatus`, `.isCouple`,
 * `.dependants`, `.spouseName` consistently regardless of persona shape.
 * Does NOT mutate the source entity.
 */
export const normalisePersona = (entity) => _normalisePersona(entity);

/**
 * Diagnostic: returns `{ ok, errors, warnings, canonical }` for the persona.
 * Useful for dev-mode HUD chip + persona-fixture CI schema check.
 */
export const validatePersona = (entity) => _validatePersona(entity);

/**
 * Unified LPA reader — resolves three known shape variants:
 *   (a) entity.estate.lpa.{healthWelfare,propertyFinancial} + *Registered + *Date
 *   (b) entity.estate.{lpaHealth,lpaFinance}.status
 *   (c) entity.lpa.{health,finance}
 * Returns canonical envelope `{ health, finance }` with each containing
 * `{ exists, registered, signedDate, staleFlag, status, source }`.
 */
export const lpaStatus = (entity) => _lpaStatus(entity);

/**
 * L2-9 — Two-schema collapse deprecation gate.
 * Emits a dev-mode console.warn once per (caller, entity-id) when a LEGACY
 * FLAT or MIXED schema is detected. Returns the schema kind so callers can
 * branch without re-calling detectSchema.
 *
 * Wire at engine-boundary mount points (selector entry, screen mount) rather
 * than per-call — the dedup key includes the caller string.
 *
 * Example:
 *   const kind = warnIfLegacy(entity, 'home-engine')
 *   if (kind === 'unknown') return null
 *
 * @param {object} entity
 * @param {string} [caller] - context label for log clarity and dedup
 * @returns {'legacy'|'nested'|'mixed'|'unknown'}
 */
export const warnIfLegacy = (entity, caller) => _warnIfLegacy(entity, caller);

/**
 * Direct schema detector (no side effects). Wraps _helpers.js detectSchema
 * so callers have a single import surface for everything schema-related.
 */
export const detectSchema = (entity) => _detectSchema(entity);

// ── History / trajectory ────────────────────────────────────────────────────
/** Net worth history series — 12mo / 24mo / 5yr. */
export const netWorthHistory = (entity, range = '12mo') => _netWorthHistory(entity, range);

/** Projected net worth at N years forward. */
export const netWorthAtYears = (entity, years) => _netWorthAtYears(entity, years);

// ── Helpers / utility re-exports ────────────────────────────────────────────
/**
 * Resolve the canonical wrapper key for an asset (isa/gia/pension/sipp/crypto/…).
 * Used by drill panels and AssetDetailOverlay.
 */
export const getWrapper = (asset) => _getWrapper(asset);

/**
 * Lump-sum protection cover (life + critical illness + IP flat amount).
 */
export const protectionFlat = (entity) => _protectionFlat(entity);
