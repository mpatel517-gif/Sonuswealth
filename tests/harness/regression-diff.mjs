// ─────────────────────────────────────────────────────────────────────────────
// regression-diff — pure decision logic for L4-4 nightly persona regression
//
// Given a baseline {personaId, taxYear, fq, risk, netWorth, snapshotHash}[]
// and a fresh capture of the same shape, decide which cells drifted beyond
// tolerance.
//
// Why two tolerances:
//   - £NW is large numbers (£10k–£10M). Use a relative tolerance (default 0.5%).
//   - FQ/Risk are 0–100 scores. Use an absolute tolerance (default 1 point).
//
// Why a snapshot hash:
//   - The hero numbers might be unchanged but a sub-field (e.g. allowance
//     tracker, drawdown matrix) silently moved. The hash covers the WHOLE
//     snapshot so any field drift surfaces.
//
// API:
//   diffCells(baseline, fresh, tolerance?) →
//     { matched, drifted, missingInFresh, newInFresh, summary }
//
//   tolerance defaults:
//     { netWorthRel: 0.005,  // 0.5%
//       fqAbs: 1,            // 1 score point
//       riskAbs: 1,
//       requireHashMatch: true }
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_TOLERANCE = Object.freeze({
  netWorthRel:      0.005,   // 0.5% — covers normal float jitter, fails on real shifts
  fqAbs:            1,       // 1-point — score band changes register
  riskAbs:          1,
  requireHashMatch: true,    // any sub-field drift counts
})

function cellKey(row) {
  return `${row.personaId}::${row.taxYear}`
}

function absRel(a, b) {
  const aN = +a, bN = +b
  if (!Number.isFinite(aN) || !Number.isFinite(bN)) return { abs: Infinity, rel: Infinity }
  const abs = Math.abs(aN - bN)
  const denom = Math.max(Math.abs(aN), Math.abs(bN), 1e-9)
  return { abs, rel: abs / denom }
}

export function diffCells(baseline, fresh, tolerance = DEFAULT_TOLERANCE) {
  if (!Array.isArray(baseline)) throw new Error('diffCells: baseline must be an array')
  if (!Array.isArray(fresh))    throw new Error('diffCells: fresh must be an array')

  const t = { ...DEFAULT_TOLERANCE, ...tolerance }
  const baseMap  = new Map(baseline.map(r => [cellKey(r), r]))
  const freshMap = new Map(fresh.map(r => [cellKey(r), r]))

  const matched = []
  const drifted = []
  const missingInFresh = []
  const newInFresh = []

  // Walk baseline first — find drifted + missing
  for (const [key, b] of baseMap) {
    const f = freshMap.get(key)
    if (!f) { missingInFresh.push(key); continue }

    const nw  = absRel(b.netWorth, f.netWorth)
    const fq  = absRel(b.fq, f.fq)
    const rk  = absRel(b.risk, f.risk)
    const hashMatches = !t.requireHashMatch || (b.snapshotHash && b.snapshotHash === f.snapshotHash)

    const reasons = []
    if (nw.rel > t.netWorthRel) reasons.push(`netWorth drift £${Math.round(nw.abs)} (${(nw.rel * 100).toFixed(2)}%) > ${(t.netWorthRel * 100).toFixed(2)}%`)
    if (fq.abs > t.fqAbs)       reasons.push(`fq drift ${fq.abs.toFixed(1)} > ${t.fqAbs}`)
    if (rk.abs > t.riskAbs)     reasons.push(`risk drift ${rk.abs.toFixed(1)} > ${t.riskAbs}`)
    if (!hashMatches)           reasons.push(`snapshot hash drift (${b.snapshotHash?.slice(0, 8) || 'none'} → ${f.snapshotHash?.slice(0, 8) || 'none'})`)

    if (reasons.length === 0) {
      matched.push(key)
    } else {
      drifted.push({
        key,
        personaId: b.personaId,
        taxYear:   b.taxYear,
        baseline:  { fq: b.fq, risk: b.risk, netWorth: b.netWorth, hash: b.snapshotHash },
        fresh:     { fq: f.fq, risk: f.risk, netWorth: f.netWorth, hash: f.snapshotHash },
        reasons,
      })
    }
  }

  // Walk fresh — find rows new in this run that weren't in baseline
  for (const key of freshMap.keys()) {
    if (!baseMap.has(key)) newInFresh.push(key)
  }

  const summary = {
    baselineCount: baseline.length,
    freshCount:    fresh.length,
    matched:       matched.length,
    drifted:       drifted.length,
    missingInFresh: missingInFresh.length,
    newInFresh:    newInFresh.length,
    anyDrift:      drifted.length > 0 || missingInFresh.length > 0,
  }

  return { matched, drifted, missingInFresh, newInFresh, summary }
}

// ── Snapshot hashing helper ────────────────────────────────────────────────
// Deterministic JSON-stable hash. The harness produces large snapshot objects;
// we want a stable fingerprint regardless of key ordering. The hash is FNV-1a
// 32-bit folded over the canonical JSON — fast, collision-resistant enough
// for a 138-row regression set.
export function hashSnapshot(snapshot) {
  if (snapshot == null) return null
  const canonical = stableStringify(snapshot)
  // FNV-1a 32-bit
  let h = 0x811c9dc5
  for (let i = 0; i < canonical.length; i++) {
    h ^= canonical.charCodeAt(i)
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

// Run-metadata that changes every run regardless of the financial computation —
// excluded from the hash so a baseline doesn't drift on its own check. Without
// this, two consecutive captures differed on ALL cells (computed_at timestamp,
// _ripple.elapsedMs timing, _ripple.bundleVersion load counter) — which is why
// the regression baseline could never be committed. The fq/risk/netWorth and all
// real computation ARE deterministic; only these wrappers were not.
const VOLATILE_KEYS = new Set([
  'computed_at', 'computedAt', 'capturedAt', 'generatedAt',
  'elapsedMs', '_elapsedMs', 'durationMs', 'bundleVersion',
])

function stableStringify(value) {
  // Numbers: normalize float least-significant-bit noise so the hash is
  // platform-portable (a Windows-captured baseline must match a Linux CI run).
  // Without this, 2023/24 cells drifted Windows↔Linux on the HASH only (netWorth/
  // fq/risk all matched within tolerance) — i.e. a sub-field computed e.g.
  // 0.30000000000000004 on one platform and 0.29999999999999999 on the other.
  // Rounding to 6 decimals is far below any meaningful £/rate difference (pennies
  // survive) but well above the divergent bits. Non-finite → 'null' (stable).
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 'null'
    return JSON.stringify(Number(value.toFixed(6)))
  }
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']'
  const keys = Object.keys(value).filter(k => !VOLATILE_KEYS.has(k)).sort()
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}'
}

// ── Alert formatter ────────────────────────────────────────────────────────
// Produces the Slack message body for a drifted result. Caps at 10 lines
// so the alert doesn't get truncated by Slack's message limit on big drift.
export function formatAlert(result) {
  const lines = []
  lines.push(`*Sonuswealth nightly regression* — ${result.summary.drifted} cell(s) drifted, ${result.summary.missingInFresh} missing, ${result.summary.newInFresh} new.`)
  lines.push(`Baseline ${result.summary.baselineCount} · Fresh ${result.summary.freshCount} · Matched ${result.summary.matched}`)
  const shown = result.drifted.slice(0, 8)
  for (const d of shown) {
    lines.push(`🔴 ${d.personaId} ${d.taxYear} — ${d.reasons.join('; ')}`)
  }
  if (result.drifted.length > shown.length) {
    lines.push(`… plus ${result.drifted.length - shown.length} more drifted cell(s).`)
  }
  return lines.join('\n')
}
