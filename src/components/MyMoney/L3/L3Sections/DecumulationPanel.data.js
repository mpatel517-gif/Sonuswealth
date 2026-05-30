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

  // ── funded ratio ─────────────────────────────────────────────────────────────
  let fundedRatioPct  = null
  let frConfidence    = 'INSUFFICIENT'
  let frInsufficient  = true
  try {
    const fr = fundedRatio(entity, null)
    frInsufficient = fr.insufficient_data === true
    frConfidence   = fr.confidence || 'INSUFFICIENT'
    if (!frInsufficient && fr.ratio != null) {
      fundedRatioPct = Math.round(fr.ratio * 100)
    }
  } catch (_) {
    // stays null / INSUFFICIENT
  }

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
  }
}
