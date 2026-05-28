// ─────────────────────────────────────────────────────────────────────────────
// bundle-wiring.js — browser-side tax-year → rules-bundle bridge
//
// A4 foundation (2026-05-28). The TY chip in the top chrome writes the user's
// chosen window to localStorage.sonuswealth.temporal and dispatches a
// 'sonus:taxyear' event. Until now the chip purely re-rendered the in-page
// label — the engine still pinned itself to the default UK-2026.1.1 bundle
// because there was no browser-side bridge from "the user said 2024/25" to
// `setBundle(UK-2024.1.1)`.
//
// This module:
//   1. Statically imports every UK bundle (so they ship in the bundle, no
//      async loader at runtime).
//   2. Exposes selectBundleForTaxYear(taxYear) — pure function, returns the
//      JSON bundle for any UK tax year 2021/22 through 2026/27.
//   3. installBundleAutoSync() — wires a listener on 'sonus:taxyear' +
//      'storage' that calls setBundle() with the matching bundle every time
//      the user changes the chip. Idempotent.
//
// Wire from App.jsx once at boot: `installBundleAutoSync()`. After that the
// engine's TAX constants live-update whenever the chip flips. Engine math —
// PA, NRB, RNRB, dividend rates, NIC bands — all switch automatically because
// every consumer subscribes to onBundleChange() in _bundle.js.
// ─────────────────────────────────────────────────────────────────────────────

import { setBundle, getBundle } from './_bundle.js'
import UK_2021 from '../rules/UK-2021.1.1.json' with { type: 'json' }
import UK_2022 from '../rules/UK-2022.1.1.json' with { type: 'json' }
import UK_2023 from '../rules/UK-2023.1.1.json' with { type: 'json' }
import UK_2024 from '../rules/UK-2024.1.1.json' with { type: 'json' }
import UK_2025 from '../rules/UK-2025.1.1.json' with { type: 'json' }
import UK_2026 from '../rules/UK-2026.1.1.json' with { type: 'json' }

const BUNDLE_BY_TAX_YEAR = {
  '2021/22': UK_2021,
  '2022/23': UK_2022,
  '2023/24': UK_2023,
  '2024/25': UK_2024,
  '2025/26': UK_2025,
  '2026/27': UK_2026,
}

/**
 * Resolve a tax year string (e.g. '2024/25') to its JSON bundle. Returns the
 * UK-2026.1.1 bundle as a safe fallback if the year is unknown — caller can
 * inspect the returned bundle._meta.version to detect the fallback.
 */
export function selectBundleForTaxYear(taxYear) {
  return BUNDLE_BY_TAX_YEAR[taxYear] || UK_2026
}

/**
 * Wire the browser's TY chip → engine bridge. Idempotent — multiple calls
 * register only one listener. Returns an unsubscribe function for tests.
 *
 * Reads the current chip state on call so the engine is in sync immediately,
 * even before the user clicks anything (Tony loaded with `?ty=2024/25` would
 * otherwise show 2026 maths on first paint).
 */
let _installed = false
let _unsubscribe = null
export function installBundleAutoSync() {
  if (_installed || typeof window === 'undefined') return _unsubscribe || (() => {})
  _installed = true

  const STORE_KEY = 'sonuswealth.temporal'

  function _resolveCurrentTaxYear() {
    try {
      const raw = window.localStorage.getItem(STORE_KEY)
      const parsed = raw ? JSON.parse(raw) : null
      const windowId = parsed?.window || 'current-period'
      // Map window selector → asOfDate offset, then back to tax year. The
      // X28 selector carries calendar offsets (last-period = -1y, next-period
      // = +1y, current-period = 0y); all other windows (5y, 10y, lifetime)
      // surface forward projections but for *rules selection* default to
      // current-period since future bundles don't exist yet.
      const today = new Date()
      let offset = 0
      if (windowId === 'last-period') offset = -1
      else if (windowId === 'next-period') offset = 1
      const asOf = new Date(today)
      asOf.setFullYear(today.getFullYear() + offset)
      return _taxYearForDate(asOf)
    } catch { return '2026/27' }
  }

  function _taxYearForDate(d) {
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const day = d.getDate()
    const startYear = (m < 4 || (m === 4 && day < 6)) ? y - 1 : y
    const endShort = String(startYear + 1).slice(-2)
    return `${startYear}/${endShort}`
  }

  function _syncToCurrentTY() {
    const ty = _resolveCurrentTaxYear()
    const bundle = selectBundleForTaxYear(ty)
    const currentMeta = getBundle()?._meta?.version || getBundle()?.version
    const nextMeta = bundle?._meta?.version || bundle?.version
    if (currentMeta !== nextMeta) {
      setBundle(bundle)
    }
  }

  // First sync — bring engine in line with whatever the chip already says.
  _syncToCurrentTY()

  window.addEventListener('sonus:taxyear', _syncToCurrentTY)
  window.addEventListener('storage', _syncToCurrentTY)

  _unsubscribe = () => {
    window.removeEventListener('sonus:taxyear', _syncToCurrentTY)
    window.removeEventListener('storage', _syncToCurrentTY)
    _installed = false
    _unsubscribe = null
  }
  return _unsubscribe
}
