// FlexiDrawdownPanel.data.js — pure data builder for the flexi-drawdown L3 panel.
//
// Plan reference: MyMoney L3 Tier-A — pension drawdown sustainability.

import { pensionTotal } from '../../../../engine/_helpers.js'
import { monteCarloPOS } from '../../../../engine/scenarios.js'

/**
 * Build a drawdown sustainability snapshot for the panel.
 *
 * Reads:
 *   · pot:        pensionTotal(entity)
 *   · annualDraw: entity.drawdown if set + finite > 0; else 4% of pot (illustrative default)
 *   · monteCarloPOS(entity, annualDraw, { simulations:2000, terminalAge:95 })
 *
 * Returns:
 *   {
 *     pot:          total pension pot (GBP)
 *     annualDraw:   annual drawdown amount used (GBP)
 *     drawIsCustom: boolean — true when entity.drawdown was used, false when 4% default applied
 *     pos:          probability of survival 0-100 (%)
 *     terminalAge:  age the MC projects to (95)
 *     startAge:     current age used in simulation
 *     p10:          pessimistic pot at terminal age
 *     p50:          median pot at terminal age
 *     p90:          optimistic pot at terminal age
 *     simulations:  number of MC paths run
 *   }
 *
 * @param {object} entity
 * @returns {object}
 */
export function buildDrawdownSnapshot(entity) {
  const pot = pensionTotal(entity)

  const customDraw = +entity?.drawdown
  const drawIsCustom = Number.isFinite(customDraw) && customDraw > 0
  // 4% of pot is the illustrative safe-withdrawal-rate default used ONLY when
  // entity.drawdown is not set. Surfaced as copy in the panel so users know.
  const annualDraw = drawIsCustom ? customDraw : pot * 0.04

  const result = monteCarloPOS(entity, annualDraw, {
    simulations: 2000,
    terminalAge: 95,
  })

  const last = result.percentilesByAge[result.percentilesByAge.length - 1] || {}

  return {
    pot,
    annualDraw,
    drawIsCustom,
    pos: result.probability,
    terminalAge: result.terminalAge,
    startAge: result.startAge,
    p10: last.p10 ?? 0,
    p50: last.p50 ?? 0,
    p90: last.p90 ?? 0,
    simulations: result.simulations,
  }
}
