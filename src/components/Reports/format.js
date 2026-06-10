// src/components/Reports/format.js
// Exact GBP for statement line items (accountant-facing), mirroring
// SAComputationView.money(). NOT the app's compact fmt().

export function money(n) {
  const v = Math.round(+n || 0)
  const s = `£${Math.abs(v).toLocaleString('en-GB')}`
  return v < 0 ? `−${s}` : s
}

// Signed delta string for comparison badges.
export function deltaStr(curr, prev) {
  if (prev == null || !isFinite(prev)) return null
  const d = Math.round((+curr || 0) - (+prev || 0))
  if (d === 0) return '£0'
  return (d > 0 ? '+' : '−') + `£${Math.abs(d).toLocaleString('en-GB')}`
}
