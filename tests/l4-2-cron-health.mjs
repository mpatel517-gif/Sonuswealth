// ─────────────────────────────────────────────────────────────────────────────
// L4-2 — cron-health decision logic test
//
// Locks down the staleness math so the Edge Function can't silently regress
// to "always healthy" (the failure mode where you only find out the alert
// doesn't fire because nothing was ever broken until something is — by which
// time you've trusted the system for weeks).
//
// What this proves:
//   1. lastSeen null → 'unknown' (no rows yet — don't alert, first run pending)
//   2. age < threshold → 'healthy'
//   3. age == threshold → 'healthy' (boundary inclusive)
//   4. age > threshold → 'stale' with correct overBy
//   5. Invalid ISO date → 'unknown' (safe fallback)
//   6. summarise() counts + alert-line shape
//   7. MONITORS registry has the expected shape
//
// Run: node tests/l4-2-cron-health.mjs
// ─────────────────────────────────────────────────────────────────────────────

import {
  decideStatus,
  summarise,
  MONITORS,
} from '../supabase/functions/_shared/cron-health.js'

let fails = 0
function check(label, cond, detail) {
  if (cond) console.log(`✓ ${label}`)
  else { console.log(`✗ ${label} — ${detail || ''}`); fails++ }
}

const NOW = new Date('2026-05-28T12:00:00.000Z')
const HOUR = 3600

// ── Case 1 — lastSeen null returns 'unknown' ───────────────────────────────
{
  const r = decideStatus({ now: NOW, lastSeenIso: null, thresholdSeconds: 26 * HOUR })
  check(
    'Case 1 — lastSeen null returns unknown',
    r.status === 'unknown' && r.lastSeen === null && r.ageSeconds === null && r.overBy === 0,
    JSON.stringify(r)
  )
}

// ── Case 2 — age well within threshold → healthy ───────────────────────────
{
  const lastSeen = new Date(NOW.getTime() - (10 * HOUR * 1000)).toISOString()
  const r = decideStatus({ now: NOW, lastSeenIso: lastSeen, thresholdSeconds: 26 * HOUR })
  check(
    'Case 2 — age 10h, threshold 26h → healthy',
    r.status === 'healthy' && r.ageSeconds === 10 * HOUR && r.overBy === 0,
    JSON.stringify(r)
  )
}

// ── Case 3 — age == threshold → healthy (boundary inclusive) ───────────────
{
  const lastSeen = new Date(NOW.getTime() - (26 * HOUR * 1000)).toISOString()
  const r = decideStatus({ now: NOW, lastSeenIso: lastSeen, thresholdSeconds: 26 * HOUR })
  check(
    'Case 3 — age == threshold → healthy (boundary inclusive)',
    r.status === 'healthy' && r.overBy === 0,
    JSON.stringify(r)
  )
}

// ── Case 4 — age > threshold → stale with correct overBy ───────────────────
{
  const lastSeen = new Date(NOW.getTime() - (30 * HOUR * 1000)).toISOString()
  const r = decideStatus({ now: NOW, lastSeenIso: lastSeen, thresholdSeconds: 26 * HOUR })
  check(
    'Case 4 — age 30h, threshold 26h → stale (overBy 4h)',
    r.status === 'stale' && r.ageSeconds === 30 * HOUR && r.overBy === 4 * HOUR,
    JSON.stringify(r)
  )
}

// ── Case 5 — invalid ISO date → 'unknown' safe fallback ────────────────────
{
  const r = decideStatus({ now: NOW, lastSeenIso: 'not-a-date', thresholdSeconds: 26 * HOUR })
  check(
    'Case 5 — invalid ISO date returns unknown (safe fallback)',
    r.status === 'unknown' && r.lastSeen === null,
    JSON.stringify(r)
  )
}

// ── Case 6 — threshold must be positive ─────────────────────────────────────
{
  let raised = false
  try {
    decideStatus({ now: NOW, lastSeenIso: NOW.toISOString(), thresholdSeconds: -1 })
  } catch { raised = true }
  check('Case 6 — negative threshold throws', raised === true)
}

// ── Case 7 — summarise() counts + alert-line shape ──────────────────────────
{
  const decisions = [
    { cronName: 'a', thresholdSeconds: 26 * HOUR, status: 'healthy',  ageSeconds: 5 * HOUR },
    { cronName: 'b', thresholdSeconds: 26 * HOUR, status: 'stale',    ageSeconds: 50 * HOUR },
    { cronName: 'c', thresholdSeconds: 26 * HOUR, status: 'unknown',  ageSeconds: null },
    { cronName: 'd', thresholdSeconds: 1 * HOUR,  status: 'stale',    ageSeconds: 5 * HOUR },
  ]
  const s = summarise(decisions)
  check(
    'Case 7 — summarise counts 1 healthy, 2 stale, 1 unknown',
    s.healthyCount === 1 && s.staleCount === 2 && s.unknownCount === 1 && s.anyStale === true,
    JSON.stringify(s)
  )
  check(
    'Case 7b — alertLines mention both stale crons',
    s.alertLines.some(l => l.includes('b ')) && s.alertLines.some(l => l.includes('d ')),
    JSON.stringify(s.alertLines)
  )
}

// ── Case 8 — MONITORS registry shape ────────────────────────────────────────
{
  check('Case 8 — MONITORS is non-empty array', Array.isArray(MONITORS) && MONITORS.length > 0)
  for (const m of MONITORS) {
    check(
      `Case 8 — monitor "${m.cronName}" has required fields`,
      typeof m.cronName === 'string'
        && typeof m.table === 'string'
        && typeof m.timestampColumn === 'string'
        && typeof m.thresholdSeconds === 'number'
        && m.thresholdSeconds > 0
    )
  }
}

console.log(`\nL4-2 cron-health test — fails=${fails}`)
if (fails > 0) process.exit(1)
