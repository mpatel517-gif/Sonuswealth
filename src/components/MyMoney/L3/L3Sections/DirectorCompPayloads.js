// DirectorCompPayloads.js — pure payload builders for the Director Remuneration L3 panel.
//
// Plan reference: Tier-A director-comp panel.
// Pure JS — no React, no JSX. Safe to import from tests + .data.js.
//
// Each builder returns the four fields L4NumberPanel consumes:
//   { formula, source, confidence, breakdown, editable? }
//
// `formula`    — plain-English calculation
// `source`     — engine selector or entity path that produced the value
// `confidence` — 'high' | 'medium' | 'low' based on data signals
// `breakdown`  — array of { label, value } for L4 breakdown list
// `editable`   — { path, label, currentValue, unit } on rows the user can correct
//
// Per CLAUDE.md §6: NO hardcoded tax rates. Dividend tax values passed in from
// calcDividendTax(); this file describes them, does not re-compute them.

import { fmt } from '../../../../engine/fq-calculator.js'

// ─── Salary payload ───────────────────────────────────────────────────────────

export function salaryPayload(entity, salary) {
  const ind = entity?.individual || {}
  const rows = []
  rows.push({ label: 'Gross salary',              value: fmt(salary) })
  rows.push({ label: 'Taxed as employment income', value: 'Yes — PAYE via payroll' })
  rows.push({ label: 'National Insurance (Class 1)', value: 'Applies above primary threshold (£12,570)' })
  if (ind.salary_rationale || entity?.archetype_specific?.extraction_structure?.salary_rationale) {
    rows.push({ label: 'Rationale', value: ind.salary_rationale || entity.archetype_specific.extraction_structure.salary_rationale })
  }
  return {
    formula:    'Director salary paid through payroll. Taxed at marginal income-tax rate and subject to Class 1 National Insurance above the primary threshold.',
    source:     'entity.individual.gross_salary (or entity.income.employment for flat-schema personas)',
    confidence: salary > 0 ? 'high' : 'low',
    breakdown:  rows,
    editable: {
      path:         'individual.gross_salary',
      label:        'Director salary',
      currentValue: salary,
      unit:         '£',
    },
  }
}

// ─── Dividends payload ────────────────────────────────────────────────────────

export function dividendsPayload(entity, dividends) {
  const extr = entity?.archetype_specific?.extraction_structure || {}
  const rows = []
  rows.push({ label: 'Gross dividends',          value: fmt(dividends) })
  rows.push({ label: 'Dividend allowance (£500)', value: 'First £500 tax-free each year' })
  rows.push({ label: 'Source',                    value: 'Company profits after corporation tax' })
  if (extr.total_extraction_personal != null) {
    rows.push({ label: 'Total personal extraction', value: fmt(+extr.total_extraction_personal) })
  }
  if (extr.company_retained_profit != null) {
    rows.push({ label: 'Company retained profit',   value: fmt(+extr.company_retained_profit) })
  }
  return {
    formula:    'Dividends paid from company post-corporation-tax profit. Taxed at dividend rates (8.75% basic / 33.75% higher / 39.35% additional) on amounts above the £500 annual dividend allowance.',
    source:     'entity.individual.dividend_income_annual (or entity.income.dividends for flat-schema personas)',
    confidence: dividends > 0 ? 'high' : 'low',
    breakdown:  rows,
    editable: {
      path:         'individual.dividend_income_annual',
      label:        'Dividends from company',
      currentValue: dividends,
      unit:         '£',
    },
  }
}

// ─── Dividend-tax payload (read-only) ─────────────────────────────────────────

export function dividendTaxPayload(entity, dividends, salary, divTaxResult) {
  const tax     = divTaxResult?.tax      ?? 0
  const taxable = divTaxResult?.taxable  ?? 0
  const allow   = divTaxResult?.allowance ?? 500

  const rows = []
  rows.push({ label: 'Dividends received',    value: fmt(dividends) })
  rows.push({ label: 'Dividend allowance',    value: fmt(allow) })
  rows.push({ label: 'Taxable dividends',     value: fmt(taxable) })
  rows.push({ label: 'Tax due on dividends',  value: fmt(tax) })
  rows.push({ label: 'Other taxable income',  value: fmt(salary) })
  rows.push({ label: 'Computed by',           value: 'calcDividendTax(dividends, salary) — engine selector, rates from tax-2026.json' })

  return {
    formula:    'Dividend tax computed by the Sonuswealth engine (calcDividendTax). Rates depend on where dividends fall in the income-tax bands after other income is placed first.',
    source:     'calcDividendTax(divIncome, otherTaxable) from src/engine/fq-calculator.js — rates loaded from tax-2026.json',
    confidence: dividends > 0 ? 'high' : 'medium',
    breakdown:  rows,
    // read-only — no editable descriptor
  }
}

// ─── Company equity payload ───────────────────────────────────────────────────

export function companyEquityPayload(co, idx, coValue) {
  const rows = []
  if (co.name)             rows.push({ label: 'Company name',          value: co.name })
  if (co.entity_type)      rows.push({ label: 'Entity type',           value: co.entity_type })
  if (co.trading_company != null) {
    rows.push({ label: 'Trading company',       value: co.trading_company ? 'Yes' : 'No' })
  }
  if (co.bpr_qualifying_trade != null) {
    rows.push({ label: 'Business Property Relief eligible', value: co.bpr_qualifying_trade ? 'Yes — 100% relief on trading shares' : 'No' })
  }
  if (co.annual_turnover != null) {
    rows.push({ label: 'Annual turnover',       value: fmt(+co.annual_turnover) })
  }
  if (co.annual_profit_before_tax != null) {
    rows.push({ label: 'Profit before tax',     value: fmt(+co.annual_profit_before_tax) })
  }
  const shareholding = Array.isArray(co.shareholding) ? co.shareholding[0] : null
  if (shareholding?.pct != null) {
    rows.push({ label: 'Your shareholding',     value: `${shareholding.pct}%` })
  }
  if (co.directors_loan_account_balance != null) {
    rows.push({
      label: co.directors_loan_in_credit_to_director ? 'Director loan (in credit — owed to you)' : 'Director loan (owed to company)',
      value: fmt(+co.directors_loan_account_balance),
    })
  }
  rows.push({ label: 'Valuation method', value: 'Director estimate — upload third-party valuation to upgrade confidence' })

  return {
    formula:    'Director estimate of company value. Trading company shares held for 2+ years may qualify for 100% Business Property Relief (BPR), potentially removing them from your taxable estate.',
    source:     `entity.companies[${idx}].company_value_estimate`,
    confidence: 'medium', // self-assessed until third-party valuation uploaded
    breakdown:  rows,
    editable: {
      path:         `companies[${idx}].company_value_estimate`,
      label:        `Estimated value — ${co.name || 'company'}`,
      currentValue: coValue,
      unit:         '£',
    },
  }
}
