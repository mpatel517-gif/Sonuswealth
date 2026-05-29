// ─────────────────────────────────────────────────────────────────────────────
// budget-watch-pages — the registry of HMRC / gov.uk pages watched by L4-3.
//
// Shared between the Edge Function and the Node test that locks down the
// shape (and surfaces broken URLs in CI before they fail in production).
//
// Add a page here, redeploy cron-budget-watch, done — no migration needed.
// ─────────────────────────────────────────────────────────────────────────────

export const PAGES = [
  {
    key: 'income_tax_rates',
    url: 'https://www.gov.uk/income-tax-rates',
    description: 'Income tax bands, rates, Personal Allowance',
  },
  {
    key: 'income_tax_pa_taper',
    url: 'https://www.gov.uk/income-tax-rates/income-over-100000',
    description: 'PA taper above £100k ANI',
  },
  {
    key: 'iht_rates_and_thresholds',
    url: 'https://www.gov.uk/government/publications/rates-and-allowances-inheritance-tax-thresholds-and-interest-rates',
    description: 'IHT NRB / RNRB / rate / interest rates',
  },
  {
    key: 'cgt_rates',
    url: 'https://www.gov.uk/capital-gains-tax/rates',
    description: 'Capital Gains Tax rates and AEA',
  },
  {
    key: 'ni_rates',
    url: 'https://www.gov.uk/national-insurance-rates-letters',
    description: 'NI contribution rates and category letters',
  },
  {
    key: 'pension_annual_allowance',
    url: 'https://www.gov.uk/tax-on-your-private-pension/annual-allowance',
    description: 'Pension Annual Allowance, MPAA',
  },
  {
    key: 'isa_subscription_limits',
    url: 'https://www.gov.uk/individual-savings-accounts/how-isas-work',
    description: 'ISA allowance / Lifetime ISA',
  },
]

export function validatePages(pages) {
  const errors = []
  if (!Array.isArray(pages)) return ['PAGES is not an array']
  const seenKeys = new Set()
  for (const p of pages) {
    if (!p || typeof p !== 'object') { errors.push('page is not an object'); continue }
    if (typeof p.key !== 'string' || !p.key) errors.push(`page missing string key: ${JSON.stringify(p)}`)
    if (seenKeys.has(p.key)) errors.push(`duplicate page key: ${p.key}`)
    seenKeys.add(p.key)
    if (typeof p.url !== 'string') errors.push(`page ${p.key} missing string url`)
    if (typeof p.url === 'string' && !/^https:\/\/(www\.)?gov\.uk\//.test(p.url)) {
      errors.push(`page ${p.key} url not gov.uk: ${p.url}`)
    }
    if (typeof p.description !== 'string' || !p.description) errors.push(`page ${p.key} missing description`)
  }
  return errors
}
