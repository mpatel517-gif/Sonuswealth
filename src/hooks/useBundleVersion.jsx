// ─────────────────────────────────────────────────────────────────────────────
// useBundleVersion — React hook that returns the engine's bundle version
// counter, re-renders the calling component on every setBundle() call.
//
// A4 last-mile (2026-05-28). Without this, useMemo() / useEffect() deps in
// screens like MoneyIncome / TaxEstate key off `entity` only and don't
// recompute when the user flips the TY chip — so the engine has new rates
// but the screen shows yesterday's numbers.
//
// Usage:
//   const bundleVersion = useBundleVersion()
//   const taxInfo = useMemo(() => calcIncomeTax(entity), [entity, bundleVersion])
//
// Implementation: subscribe to onBundleChange in _bundle.js. The callback
// fires synchronously inside setBundle(), so on the next React commit the
// hook re-renders and any memo with bundleVersion in deps recomputes.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { getBundleVersion, onBundleChange } from '../engine/_bundle.js'

export default function useBundleVersion() {
  const [version, setVersion] = useState(() => getBundleVersion())

  useEffect(() => {
    const unsubscribe = onBundleChange(() => {
      setVersion(getBundleVersion())
    })
    return unsubscribe
  }, [])

  return version
}
