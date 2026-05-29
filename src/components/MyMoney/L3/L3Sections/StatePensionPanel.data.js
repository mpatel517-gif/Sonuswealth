// StatePensionPanel.data.js — pure data builder for the State-pension L3 panel.
//
// Plan reference: LANE3-OUTSTANDING.md §1 Tier A #3.

import { statePensionAnnual } from '../../../../engine/_helpers.js'
import { TAX, getBundle } from '../../../../engine/_bundle.js'

/**
 * Build a state-pension snapshot for the panel.
 *
 * Reads:
 *   · entitlement now: statePensionAnnual(entity)
 *   · full entitlement: TAX.statePensionFull (from active bundle)
 *   · qualifying years required: TAX.statePensionQualYears
 *   · state pension age: TAX.spa
 *   · accrued years: entity.individual.state_pension_accrued_years
 *   · current age: entity.age
 *
 * Returns:
 *   {
 *     entitlementNow:        annual £ at current accrual rate
 *     fullEntitlement:       annual £ at full qualifying years
 *     gapToFull:             £/yr missed vs full
 *     qualifyingYearsNeeded: total years required for full
 *     accruedYears:          years recorded
 *     missingYears:          qualifyingYearsNeeded - accruedYears (>= 0)
 *     yearsToSpa:            spa - currentAge (>= 0)
 *     spa:                   state pension age (default 66)
 *     onTrackForFull:        boolean — can reach full by SPA?
 *     gapFillableBySpa:      missingYears we still have time to accrue
 *     pensionFraction:       accruedYears / qualifyingYearsNeeded (0..1)
 *   }
 *
 * @param {object} entity
 * @returns {object}
 */
export function buildStatePensionSnapshot(entity) {
  // Trigger bundle init — TAX is mutated on getBundle() first call.
  getBundle()

  const entitlementNow = statePensionAnnual(entity)
  const fullEntitlement = +TAX.statePensionFull || 0
  const qualifyingYearsNeeded = +TAX.statePensionQualYears || 35
  const spa = +TAX.spa || 66

  const accruedYears = +(entity?.individual?.state_pension_accrued_years || 0)
  const currentAge = +entity?.age || 0
  const yearsToSpa = Math.max(0, spa - currentAge)

  const missingYears = Math.max(0, qualifyingYearsNeeded - accruedYears)
  const gapFillableBySpa = Math.min(missingYears, yearsToSpa)
  const onTrackForFull = (accruedYears + yearsToSpa) >= qualifyingYearsNeeded

  const gapToFull = Math.max(0, fullEntitlement - entitlementNow)
  const pensionFraction = qualifyingYearsNeeded > 0
    ? Math.min(1, accruedYears / qualifyingYearsNeeded)
    : 0

  return {
    entitlementNow,
    fullEntitlement,
    gapToFull,
    qualifyingYearsNeeded,
    accruedYears,
    missingYears,
    yearsToSpa,
    spa,
    onTrackForFull,
    gapFillableBySpa,
    pensionFraction,
  }
}
