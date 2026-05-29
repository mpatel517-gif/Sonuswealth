// ─────────────────────────────────────────────────────────────────────────────
// cron-health — pure decision logic for the cron-health-check Edge Function
// (L4-2, 2026-05-28)
//
// Extracted from the Deno function so the staleness logic can be unit-tested
// under Node. The Edge Function imports this file and applies the decisions
// to a real Supabase result set.
//
// API:
//   decideStatus({ now, lastSeenIso, thresholdSeconds }) →
//     { status: 'healthy' | 'stale' | 'unknown',
//       lastSeen: Date | null,
//       ageSeconds: number | null,
//       overBy: number }
//
//   summarise(decisions) →
//     { staleCount, healthyCount, unknownCount, anyStale, alertLines: [] }
// ─────────────────────────────────────────────────────────────────────────────

export function decideStatus({ now, lastSeenIso, thresholdSeconds }) {
  if (typeof thresholdSeconds !== 'number' || thresholdSeconds <= 0) {
    throw new Error('decideStatus: thresholdSeconds must be a positive number')
  }
  const nowMs = (now instanceof Date ? now : new Date(now)).getTime()
  if (!Number.isFinite(nowMs)) throw new Error('decideStatus: invalid now')

  if (lastSeenIso == null) {
    return {
      status: 'unknown',
      lastSeen: null,
      ageSeconds: null,
      overBy: 0,
    }
  }

  const lastSeenMs = new Date(lastSeenIso).getTime()
  if (!Number.isFinite(lastSeenMs)) {
    return {
      status: 'unknown',
      lastSeen: null,
      ageSeconds: null,
      overBy: 0,
    }
  }

  const ageSeconds = Math.max(0, Math.round((nowMs - lastSeenMs) / 1000))
  const thresholdMs = thresholdSeconds * 1000
  const isStale = (nowMs - lastSeenMs) > thresholdMs
  const overBy = isStale ? Math.round((nowMs - lastSeenMs - thresholdMs) / 1000) : 0

  return {
    status: isStale ? 'stale' : 'healthy',
    lastSeen: new Date(lastSeenMs),
    ageSeconds,
    overBy,
  }
}

export function summarise(decisions) {
  let staleCount = 0
  let healthyCount = 0
  let unknownCount = 0
  const alertLines = []

  for (const d of decisions) {
    if (d.status === 'stale') {
      staleCount++
      const hrs = (d.ageSeconds / 3600).toFixed(1)
      alertLines.push(`🔴 ${d.cronName} — last write ${hrs}h ago, threshold ${(d.thresholdSeconds / 3600).toFixed(1)}h`)
    } else if (d.status === 'unknown') {
      unknownCount++
      alertLines.push(`⚪ ${d.cronName} — no writes yet (first run pending?)`)
    } else {
      healthyCount++
    }
  }

  return {
    staleCount,
    healthyCount,
    unknownCount,
    anyStale: staleCount > 0,
    alertLines,
  }
}

// The monitor registry — single source of truth for what gets watched.
// Each entry: { cronName, table, timestampColumn, thresholdSeconds }.
// The Edge Function queries `SELECT max(timestampColumn) FROM table` and
// passes the result through decideStatus.
//
// Threshold = run-interval + grace window. For a 24-hour cron, 26 hours
// allows one missed run before alerting.
export const MONITORS = [
  {
    cronName: 'cron-context-pull',
    table: 'finio_macro_variables',
    timestampColumn: 'effective_date',
    thresholdSeconds: 26 * 3600,      // daily cron + 2h grace
    description: 'UK CPIH + BoE Bank Rate daily pull from ONS / BoE',
  },
  {
    cronName: 'cron-rules-activation',
    table: 'finio_scheduled_activations',
    timestampColumn: 'activated_at',
    thresholdSeconds: 26 * 3600,      // daily cron + 2h grace
    description: 'Daily activation of rules with effective_at <= now',
  },
  {
    cronName: 'cron-cma-refresh',
    table: 'finio_cma_bundle',
    timestampColumn: 'fetched_at',
    thresholdSeconds: 8 * 24 * 3600,  // weekly cron + 1 day grace
    description: 'Weekly refresh of gilt yield, FTSE 100, PLSA RLS',
  },
]
