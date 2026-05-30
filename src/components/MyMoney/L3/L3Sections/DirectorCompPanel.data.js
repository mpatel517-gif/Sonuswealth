// DirectorCompPanel.data.js — pure data builder for the Director Remuneration L3 panel.
//
// Plan reference: Tier-A director-comp panel.
// Pure JS — no JSX, safe to import in node ESM tests without a JSX loader.
//
// Exports:
//   buildRemunerationRows(entity) → { rows, salary, dividends, total }
//
// Income keys (mrT-ltd-director schema):
//   Salary  → entity.individual.gross_salary      (flat amount, matches personal allowance)
//   Divs    → entity.individual.dividend_income_annual
//   Fallback: entity.income.employment for salary, entity.income.dividends for divs
//   (persona-a and flat personas use entity.income.* shape)
//
// Company equity → entity.companies[].company_value_estimate
// NO hardcoded tax rates — dividend tax computed by engine via calcDividendTax.

import { calcDividendTax, fmt }  from '../../../../engine/fq-calculator.js'
import {
  salaryPayload,
  dividendsPayload,
  dividendTaxPayload,
  companyEquityPayload,
} from './DirectorCompPayloads.js'

// ─── Income key resolution ────────────────────────────────────────────────────
// Handles both the nested mrT shape (individual.*) and the flat shape (income.*)

function resolveSalary(entity) {
  const ind = entity?.individual || {}
  const inc = entity?.income     || {}
  return +(ind.gross_salary ?? inc.employment ?? inc.salary ?? 0)
}

function resolveDividends(entity) {
  const ind = entity?.individual || {}
  const inc = entity?.income     || {}
  return +(ind.dividend_income_annual ?? inc.dividends ?? 0)
}

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * Build remuneration rows for the director-comp panel.
 *
 * @param {object} entity
 * @returns {{
 *   rows:      Array<{ key:string, label:string, value:number, drill:object }>,
 *   salary:    number,
 *   dividends: number,
 *   total:     number,
 * }}
 */
export function buildRemunerationRows(entity) {
  const salary    = resolveSalary(entity)
  const dividends = resolveDividends(entity)
  const total     = salary + dividends

  // Dividend tax — engine selector, no inline math
  const divTaxResult = calcDividendTax(dividends, salary)
  const divTax = divTaxResult?.tax ?? 0

  const rows = []

  // Salary row — editable
  rows.push({
    key:   'salary',
    label: 'Director salary',
    value: salary,
    drill: salaryPayload(entity, salary),
  })

  // Dividends row — editable
  rows.push({
    key:   'dividends',
    label: 'Dividends from company',
    value: dividends,
    drill: dividendsPayload(entity, dividends),
  })

  // Dividend tax row — read-only
  rows.push({
    key:   'dividend-tax',
    label: 'Tax on dividends',
    value: divTax,
    drill: dividendTaxPayload(entity, dividends, salary, divTaxResult),
  })

  // Company equity rows — one per company, each editable
  const companies = entity?.companies
  if (Array.isArray(companies)) {
    companies.forEach((co, idx) => {
      const coValue = +(co.company_value_estimate ?? co.value ?? co.share_value_gbp ?? 0)
      rows.push({
        key:   `company-equity-${idx}`,
        label: `Shares in ${co.name || 'company'}`,
        value: coValue,
        drill: companyEquityPayload(co, idx, coValue),
      })
    })
  }

  return { rows, salary, dividends, total }
}
