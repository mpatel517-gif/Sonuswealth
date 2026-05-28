/**
 * useTaxYear — global tax-year reader hook
 *
 * CX-1 closure (2026-05-28). X28TopBar already persists the user's selected
 * temporal window (`current-period`, `last-period`, `next-period`, etc.) into
 * `localStorage.sonuswealth.temporal`. This hook is the canonical READ side:
 * any screen can subscribe and get a UK tax-year string ('2025/26', '2026/27')
 * that updates whenever the user changes the X28 window selector.
 *
 * Returns:
 *   {
 *     taxYear:     '2025/26',           // human-readable tax year
 *     asOfDate:    Date,                // representative date INSIDE that TY
 *     ruleBundle:  'UK-2025.1' | 'UK-2026.1',  // canonical bundle ID for that TY
 *     window:      'current-period' | 'last-period' | 'next-period' | other,
 *     yearsOffset: -1 | 0 | 1,
 *   }
 *
 * Engine call pattern:
 *   const { ruleBundle } = useTaxYear()
 *   const iht = ihtExposure(entity, ruleBundle)   // bundle now reflects selector
 *
 * Listens for `storage` event so changes in one tab propagate to all tabs;
 * also re-reads on `sonus:taxyear` custom event for same-tab dispatch.
 */
import { useEffect, useState } from 'react'

const STORE_KEY = 'sonuswealth.temporal'

// UK tax year runs 6 April → 5 April. Returns the tax year for a Date.
function _taxYearForDate(d) {
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  // Before 6 April → still in previous tax year
  const startYear = (m < 4 || (m === 4 && day < 6)) ? y - 1 : y
  const endYearShort = String(startYear + 1).slice(-2)
  return `${startYear}/${endYearShort}`
}

function _bundleIdFor(startYear) {
  return `UK-${startYear}.1`
}

function _readWindow() {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORE_KEY) : null
    if (!raw) return 'current-period'
    const parsed = JSON.parse(raw)
    return parsed?.window || 'current-period'
  } catch { return 'current-period' }
}

function _resolve(windowId) {
  const today = new Date()
  let offset = 0
  if (windowId === 'last-period') offset = -1
  else if (windowId === 'next-period') offset = 1
  // Other windows (five-year, ten-year, twenty-year, lifetime) carry their
  // own forward horizon — but for *tax-year selection* they all default to
  // current-period since the underlying rule bundle only exists for present.
  const asOfDate = new Date(today)
  asOfDate.setFullYear(today.getFullYear() + offset)
  const taxYear = _taxYearForDate(asOfDate)
  const startYear = parseInt(taxYear.split('/')[0], 10)
  return {
    taxYear,
    asOfDate,
    ruleBundle: _bundleIdFor(startYear),
    window: windowId,
    yearsOffset: offset,
  }
}

export default function useTaxYear() {
  const [state, setState] = useState(() => _resolve(_readWindow()))

  useEffect(() => {
    const reread = () => setState(_resolve(_readWindow()))
    if (typeof window === 'undefined') return undefined
    window.addEventListener('storage', reread)
    window.addEventListener('sonus:taxyear', reread)
    return () => {
      window.removeEventListener('storage', reread)
      window.removeEventListener('sonus:taxyear', reread)
    }
  }, [])

  return state
}

// Imperative read for non-React contexts (engine wrappers etc.)
export function readTaxYearSync() {
  return _resolve(_readWindow())
}
