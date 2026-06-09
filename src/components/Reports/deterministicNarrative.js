// src/components/Reports/deterministicNarrative.js
// Templated, deterministic narrative per report (O-RF-3 v1.0: deterministic
// primary; AI overlay = SP-5). FCA boundary: describes the position, never
// recommends a product or action ("you could consider" max, no "you should").

import { money } from './format.js'

export function narrative(reportId, data) {
  switch (reportId) {
    case 'nw':
      return `Your net worth is ${money(data.netWorth)}, made up of ${money(data.assets)} in assets less ${money(data.liabilities)} of liabilities. This snapshot reflects your current holdings as classified by the engine.`
    case 'cashflow':
      return data.net >= 0
        ? `Your current plan runs a monthly surplus of ${money(data.net)}. Surplus is income after tax, committed saving, essential living, and debt service.`
        : `Your current plan runs a monthly deficit of ${money(Math.abs(data.net))}. Outflows currently exceed inflows on this basis.`
    case 'estate':
      return data.delta > 0
        ? `Your estimated inheritance-tax exposure today is ${money(data.today)}. From April 2027, unused pensions enter the estate for IHT, which on current figures changes the exposure by ${money(data.delta)}.`
        : `Your estimated inheritance-tax exposure today is ${money(data.today)}.`
    default:
      return ''
  }
}
