// FlexiDrawdownPanel.data.js — pure data builder for the flexi-drawdown L3 panel.
//
// 2026-05-30: upgraded from the flat single-asset monteCarloPOS to the full
// CMA engine `probabilityOfSuccess` (cashflow-engine.js). That model uses:
//   · lognormal returns built from the CMA bundle's asset-class volatilities
//     (60/40 equity/bond blend with the real equity-bond correlation)
//   · the CMA growth + inflation assumptions (cma-2026.json: 5.8% growth,
//     2.7% inflation)
//   · inflation modelled as a random walk — the income you draw rises with
//     prices every year
//   · the State Pension layered in once you reach State Pension age
//   · 5-percentile terminal-pot fan (p10 / p25 / median / p75 / p90)
//
// Returns BOTH nominal terminal values (the actual £ figures in future years)
// and real values (the same money expressed in today's purchasing power, by
// discounting at the CMA inflation rate). The panel lets the user flip between
// the two — see the "In today's money / Future pounds" toggle.

import { investable } from '../../../../engine/fq-calculator.js'
import { probabilityOfSuccess } from '../../../../engine/cashflow-engine.js'
import { getActiveCMA } from '../../../../engine/cma.js'

// Express a future nominal £ amount in today's money.
//   today = future / (1 + inflation)^years
function _toTodaysMoney(future, inflation, years) {
  if (!Number.isFinite(future)) return 0
  const f = Math.pow(1 + (inflation || 0), Math.max(0, years || 0))
  return f > 0 ? Math.round(future / f) : future
}

/**
 * Build a drawdown sustainability snapshot using the full CMA engine.
 *
 * The yearly draw used by the model = entity.drawdown (if set) → else
 * entity.targetIncome (if set) → else 4% of investable savings (an
 * illustrative starting point, surfaced in the panel copy). It is fed to
 * probabilityOfSuccess via a shallow entity clone so editing the draw
 * updates the projection.
 *
 * @param {object} entity
 * @returns {{
 *   pot:number, annualDraw:number, drawSource:'custom'|'target'|'default',
 *   pos:number, horizonYears:number, terminalAge:number, startAge:number,
 *   inflation:number, runs:number, statePensionFrom:number,
 *   nominal:{p10:number,p50:number,p90:number},
 *   real:{p10:number,p50:number,p90:number},
 *   insufficient:boolean,
 * }}
 */
export function buildDrawdownSnapshot(entity) {
  // Live assumptions (baseline ⊕ user override) — see src/engine/cma.js.
  const CMA_BUNDLE = getActiveCMA()
  const pot = investable(entity)

  const customDraw = +entity?.drawdown
  const targetDraw = +entity?.targetIncome
  let annualDraw
  let drawSource
  if (Number.isFinite(customDraw) && customDraw > 0) {
    annualDraw = customDraw; drawSource = 'custom'
  } else if (Number.isFinite(targetDraw) && targetDraw > 0) {
    annualDraw = targetDraw; drawSource = 'target'
  } else {
    annualDraw = Math.round(pot * 0.04); drawSource = 'default'
  }

  // probabilityOfSuccess reads entity.targetIncome internally — feed the
  // chosen draw in via a shallow clone so the projection reflects it.
  const modelEntity = { ...entity, targetIncome: annualDraw }
  const r = probabilityOfSuccess(modelEntity, CMA_BUNDLE, 2000)

  if (r.insufficient_data) {
    return {
      pot, annualDraw, drawSource,
      pos: 0, horizonYears: r.horizon_years || 0, terminalAge: 95,
      startAge: r.retirement_age || (entity?.age || 65),
      inflation: CMA_BUNDLE.inflation || 0.027, runs: r.runs || 0,
      statePensionFrom: entity?.income?.statePension?.startAge || 67,
      nominal: { p10: 0, p50: 0, p90: 0 },
      real: { p10: 0, p50: 0, p90: 0 },
      insufficient: true,
    }
  }

  const inflation = CMA_BUNDLE.inflation || 0.027
  const horizon = r.horizon_years
  const startAge = r.retirement_age
  const terminalAge = startAge + horizon

  const nominal = {
    p10: Math.round(r.p10_terminal_value || 0),
    p50: Math.round(r.median_terminal_value || 0),
    p90: Math.round(r.p90_terminal_value || 0),
  }
  const real = {
    p10: _toTodaysMoney(nominal.p10, inflation, horizon),
    p50: _toTodaysMoney(nominal.p50, inflation, horizon),
    p90: _toTodaysMoney(nominal.p90, inflation, horizon),
  }

  return {
    pot,
    annualDraw,
    drawSource,
    pos: Math.round((r.pos || 0) * 100),   // engine gives 0-1 → percentage
    horizonYears: horizon,
    terminalAge,
    startAge,
    inflation,
    runs: r.runs,
    statePensionFrom: entity?.income?.statePension?.startAge || 67,
    nominal,
    real,
    insufficient: false,
  }
}
