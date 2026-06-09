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

// The tax year whose RULES are currently in force (today's). Deterministic
// default for the rule-year stepper when the user hasn't stepped.
function _currentTaxYear() {
  return _taxYearForDate(new Date())
}

function _readStore() {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORE_KEY) : null
    if (!raw) return {}
    return JSON.parse(raw) || {}
  } catch { return {} }
}

// Rule-year ownership (founder 2026-06-08): the global YearStepper owns WHICH
// tax year's rules apply via `ruleYear` in the store. The horizon dropdown
// (`window`) owns the projection horizon ONLY and no longer drives the rule
// bundle. So `taxYear`/`ruleBundle` here come from `ruleYear`; `window`/
// `yearsOffset` remain horizon descriptors.
function _resolve(store) {
  const windowId = store?.window || 'current-period'
  const ruleYear = store?.ruleYear || _currentTaxYear()
  const startYear = parseInt(String(ruleYear).split('/')[0], 10)
  const asOfDate = new Date()
  asOfDate.setFullYear(startYear) // a date inside the chosen rule year
  let offset = 0
  if (windowId === 'last-period') offset = -1
  else if (windowId === 'next-period') offset = 1
  return {
    taxYear: ruleYear,
    asOfDate,
    ruleBundle: _bundleIdFor(startYear),
    ruleYear,
    window: windowId,
    yearsOffset: offset,
    // viewMode is owned by X28TopBar (Today/Future/Plan/What-if). Surfaced here
    // so the RULES stepper can demote itself to read-only outside scenario/plan
    // (founder 2026-06-08 — rules-sweeping belongs in the what-if context).
    viewMode: store?.viewMode || 'actual',
  }
}

export default function useTaxYear() {
  const [state, setState] = useState(() => _resolve(_readStore()))

  useEffect(() => {
    const reread = () => setState(_resolve(_readStore()))
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
  return _resolve(_readStore())
}

// Ordered list of tax years with a real (non-draft) rule bundle, for the
// global YearStepper. Kept here so the hook and the stepper share one source.
export const RULE_YEARS = ['2021/22', '2022/23', '2023/24', '2024/25', '2025/26', '2026/27']

export { _currentTaxYear as currentTaxYear }
