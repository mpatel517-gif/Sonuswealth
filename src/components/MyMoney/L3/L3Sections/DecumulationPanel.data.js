// DecumulationPanel.data.js — pure data builder for the Decumulation L3 panel.
//
// Plan reference: "will my money last" — retirement sustainability.
// Engine selectors (all wrapped in try/catch — these are heavier calls):
//   · investable(entity)          fq-calculator.js ~line 169
//   · targetIncome(entity)        _helpers.js ~line 359
//   · fundedRatio(entity, cma)    fq-calculator.js ~line 479
//   · swrFromRegime(regime)       fq-calculator.js ~line 2703
//   · runwayWithDrawdown(entity)  _helpers.js ~line 490

import { investable, fundedRatio, swrFromRegime } from '../../../../engine/fq-calculator.js'
import { targetIncome, runwayWithDrawdown } from '../../../../engine/_helpers.js'
import { getActiveCMA } from '../../../../engine/cma.js'

// Express a future nominal £ amount in today's money.
function _toTodaysMoney(future, inflation, years) {
  if (!Number.isFinite(future)) return 0
  const f = Math.pow(1 + (inflation || 0), Math.max(0, years || 0))
  return f > 0 ? Math.round(future / f) : future
}

/**
 * Build a decumulation sustainability snapshot for the panel.
 *
 * Returns:
 *   {
 *     fundedRatioPct:    funded-ratio as a percentage (or null if INSUFFICIENT)
 *     targetIncome:      annual £ the persona wants to spend
 *     investableAssets:  total investable pool (ISA + SIPP + GIA + cash)
 *     sustainableIncome: investable × SWR (Bengen 4% unless persona overrides)
 *     swrLabel:          e.g. "Bengen 4%"
 *     swrRate:           e.g. 0.04
 *     runwayYears:       investable ÷ targetIncome (simple capital-depletion cover)
 *     onTrack:           boolean — sustainableIncome >= targetIncome
 *     frConfidence:      fundedRatio confidence string (INSUFFICIENT / MEDIUM / HIGH / etc.)
 *     frInsufficient:    boolean — true when fundedRatio cannot model (no targetIncome / low assets)
 *   }
 *
 * @param {object} entity
 * @returns {object}
 */
export function buildDecumulationSnapshot(entity) {
  // Read the LIVE assumptions (baseline ⊕ any user override) so adjustments in
  // Settings → Assumptions flow straight into this projection.
  const CMA_BUNDLE = getActiveCMA()

  // ── investable ──────────────────────────────────────────────────────────────
  let investableAssets = 0
  try {
    investableAssets = investable(entity) || 0
  } catch (_) {
    investableAssets = 0
  }

  // ── targetIncome ────────────────────────────────────────────────────────────
  let targetInc = 0
  try {
    targetInc = targetIncome(entity) || 0
  } catch (_) {
    targetInc = 0
  }

  // ── SWR regime ──────────────────────────────────────────────────────────────
  // Respect persona-level override; default to bengen.
  const regimeKey = entity?.swrRegime || 'bengen'
  let swrObj = { rate: 0.04, label: 'Bengen 4% (default)', source: 'fallback' }
  try {
    swrObj = swrFromRegime(regimeKey, null, null)
  } catch (_) {
    // swrObj stays default
  }
  const swrRate  = swrObj.rate || 0.04
  const swrLabel = swrObj.label || 'Bengen 4%'

  // ── sustainable income ──────────────────────────────────────────────────────
  const sustainableIncome = Math.round(investableAssets * swrRate)

  // ── funded ratio (full CMA: 5.8% growth, 2.7% inflation) ────────────────────
  let fundedRatioPct      = null
  let frConfidence        = 'INSUFFICIENT'
  let frInsufficient      = true
  let requiredNominal     = 0   // what you'd need at retirement (future £)
  let horizonYears        = 0
  const inflation = CMA_BUNDLE.inflation || 0.027
  const growth    = CMA_BUNDLE.growth || 0.058
  try {
    const fr = fundedRatio(entity, CMA_BUNDLE)
    frInsufficient = fr.insufficient_data === true
    frConfidence   = fr.confidence || 'INSUFFICIENT'
    if (!frInsufficient && fr.ratio != null) {
      fundedRatioPct   = Math.round(fr.ratio * 100)
      requiredNominal  = fr.required_assets || 0
      horizonYears     = fr.horizon_years || 0
    }
  } catch (_) {
    // stays null / INSUFFICIENT
  }
  // Project the SAME savings figure shown to the user (investableAssets) at the
  // CMA growth rate — so "savings now" and "projected savings" reconcile and
  // never look like the pot shrank. (fundedRatio's internal asset reader is
  // narrower than investable(); we keep its ratio as the headline but grow the
  // displayed figure consistently here.)
  const projectedNominal = horizonYears > 0
    ? Math.round(investableAssets * Math.pow(1 + growth, horizonYears))
    : investableAssets
  // Same figures expressed in today's money (today's purchasing power).
  const projectedReal = _toTodaysMoney(projectedNominal, inflation, horizonYears)
  const requiredReal  = _toTodaysMoney(requiredNominal,  inflation, horizonYears)

  // ── runway ──────────────────────────────────────────────────────────────────
  // Simple capital-depletion cover: investable ÷ targetIncome.
  // runwayWithDrawdown is horizon-scoped; for display "years of cover" we use
  // the simpler ratio — more intuitive in decum context.
  let runwayYears = 0
  try {
    runwayYears = targetInc > 0 ? Math.round((investableAssets / targetInc) * 10) / 10 : 0
  } catch (_) {
    runwayYears = 0
  }

  // ── on-track verdict ────────────────────────────────────────────────────────
  // Conservative rule: sustainable income (investable × SWR) must cover target.
  const onTrack = targetInc > 0 ? sustainableIncome >= targetInc : false

  return {
    fundedRatioPct,
    targetIncome: targetInc,
    investableAssets,
    sustainableIncome,
    swrLabel,
    swrRate,
    runwayYears,
    onTrack,
    frConfidence,
    frInsufficient,
    // CMA-projected savings at retirement, in both views (for the toggle).
    horizonYears,
    inflation,
    projected: { nominal: Math.round(projectedNominal), real: projectedReal },
    required:  { nominal: Math.round(requiredNominal),  real: requiredReal },
    cmaUsed: true,
  }
}
