// ─────────────────────────────────────────────────────────────────────────────
// TAX-HISTORY STORE  (M2 — prior-year Self-Assessment data)
//
// A per-persona, per-tax-year record of FILED / actual Self-Assessment figures.
// This is the DURABLE read-model: the event store (src/state/events.jsx) is
// in-memory and resets on reload, and the Supabase adapter is inert in demo, so
// prior-year data lives in localStorage under `sonuswealth.taxhistory` (mirrors
// the `sonuswealth.temporal` pattern; upgradeable to Supabase later).
//
// It feeds two things the current/future tax computation needs:
//   1. the carry-forward ledger (losses c/f, gift clock, pension AA unused) —
//      via deriveCarryForwardFromHistory() → buildCarryForwardLedger(priorYearStore)
//   2. the payments-on-account base (prior-year income tax + Class 4 NIC) —
//      via the `_priorYearLiability` it also returns.
//
// NOT historical net-worth snapshots — that's a separate, out-of-scope build.
// ─────────────────────────────────────────────────────────────────────────────

const STORE_KEY = 'sonuswealth.taxhistory'

/**
 * PriorYearRecord shape (one per tax year):
 * {
 *   taxYear: '2025/26',
 *   source: 'manual' | 'upload' | 'hmrc',
 *   filed: boolean,
 *   figures: {
 *     totalIncome, taxPaid, payeTaxPaid,
 *     incomeTaxPlusClass4,                 // POA base for the FOLLOWING year
 *     pensionAaUnused,                     // unused pension annual allowance this year
 *     lossesCarried: { capital, rental, trading },
 *     gifts: [{ date, amount, recipient? }],
 *     paymentsOnAccountMade,
 *   },
 *   provenance: { capturedAt, channel, documentRef? },
 *   confidence: number,                    // 1.0 manual, lower for parsed
 * }
 */

function _read() {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORE_KEY) : null
    return raw ? JSON.parse(raw) || {} : {}
  } catch { return {} }
}
function _write(all) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(all))
    window.dispatchEvent(new Event('sonus:taxhistory'))
  } catch { /* quota / SSR — silent */ }
}

/** All prior-year records for a persona, keyed by tax year. */
export function readTaxHistory(personaId) {
  const all = _read()
  return all[personaId || 'default'] || {}
}

/** Insert or replace a prior-year record. Returns the saved record. */
export function upsertPriorYear(personaId, record) {
  if (!record || !record.taxYear) return null
  const all = _read()
  const id = personaId || 'default'
  const forPersona = { ...(all[id] || {}) }
  forPersona[record.taxYear] = {
    source: 'manual',
    filed: true,
    confidence: 1.0,
    ...record,
    provenance: { capturedAt: new Date().toISOString(), channel: record.source || 'manual', ...(record.provenance || {}) },
  }
  all[id] = forPersona
  _write(all)
  return forPersona[record.taxYear]
}

/** Remove a prior-year record. */
export function removePriorYear(personaId, taxYear) {
  const all = _read()
  const id = personaId || 'default'
  if (all[id]) { delete all[id][taxYear]; _write(all) }
}

// Sort tax-year keys descending ('2025/26' > '2024/25' > …).
function _yearsDesc(records) {
  return Object.keys(records).sort().reverse()
}

/**
 * Derive the carry-forward ledger partial + the prior-year liability from the
 * stored history, for a given CURRENT tax year.
 *
 * - pension_aa_unused: [y-1, y-2, y-3] unused AA from the three preceding years
 * - gifts_history:     union of gifts across stored years (the 7-yr clock filter
 *                      is applied downstream in the ledger/engine)
 * - losses:            the MOST RECENT prior year's carried-forward balances
 *                      (carry-forward losses are a running balance)
 * - _priorYearLiability: the immediately-preceding year's income tax + Class 4
 *                      NIC — the payments-on-account base.
 *
 * Returns an object whose CARRY_FORWARD_SCHEMA-shaped keys are consumed by
 * buildCarryForwardLedger(entity, priorYearStore); the `_priorYearLiability`
 * meta key is ignored by the ledger and read separately by saComputation.
 *
 * @param {string} personaId
 * @param {string} [currentTaxYear='2026/27']
 */
export function deriveCarryForwardFromHistory(personaId, currentTaxYear = '2026/27') {
  const records = readTaxHistory(personaId)
  const years = _yearsDesc(records)
  if (years.length === 0) return null

  const curStart = parseInt(String(currentTaxYear).split('/')[0], 10)

  // Pension AA unused for the three preceding tax years, ordered [y-1, y-2, y-3].
  const aaUnused = [0, 0, 0]
  for (let i = 1; i <= 3; i++) {
    const yStart = curStart - i
    const key = `${yStart}/${String(yStart + 1).slice(-2)}`
    aaUnused[i - 1] = +records[key]?.figures?.pensionAaUnused || 0
  }

  // Gifts across all stored years.
  const gifts = []
  for (const y of years) {
    const g = records[y]?.figures?.gifts
    if (Array.isArray(g)) gifts.push(...g)
  }

  // Most recent prior year drives the running loss balances + the POA base.
  const latestKey = years.find((y) => parseInt(y, 10) < curStart) || years[0]
  const latest = records[latestKey]?.figures || {}
  const losses = {
    capital_cf: +latest.lossesCarried?.capital || 0,
    rental_cf: +latest.lossesCarried?.rental || 0,
    trading_cf: +latest.lossesCarried?.trading || 0,
  }

  const out = {}
  if (aaUnused.some((v) => v > 0)) out.pension_aa_unused = aaUnused
  if (gifts.length) out.gifts_history = gifts
  if (losses.capital_cf || losses.rental_cf || losses.trading_cf) out.losses = losses
  out._priorYearLiability = +latest.incomeTaxPlusClass4 || 0
  return out
}
