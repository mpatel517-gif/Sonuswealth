// ─────────────────────────────────────────────────────────────────────────────
// L4-7 — snapshot version drift detection test
//
// Cases:
//   1. Snapshot with matching bundle_id → not stale
//   2. Snapshot with different bundle_id → stale
//   3. Snapshot with no bundle id → not stale (legacy safe path)
//   4. Engine without currentBundleId → not stale (don't false-alarm)
//   5. snapshotBundleId walks all known location shapes
//   6. ageLabel renders today / yesterday / weeks / months / years
//   7. staleSnapshotLabel renders only when stale, includes bundle ids + age
//
// Run: node tests/l4-7-snapshot-version.mjs
// ─────────────────────────────────────────────────────────────────────────────

import {
  isSnapshotStale,
  snapshotBundleId,
  snapshotVersionInfo,
  staleSnapshotLabel,
} from '../src/lib/snapshot-version.js'

let fails = 0
function check(label, cond, detail) {
  if (cond) console.log(`✓ ${label}`)
  else { console.log(`✗ ${label} — ${detail || ''}`); fails++ }
}

// ── Case 1 — matching bundle → not stale ───────────────────────────────────
{
  const s = { bundle_id: 'UK-2026.1', taken_at: new Date().toISOString() }
  check('Case 1 — matching bundle_id → not stale',
    isSnapshotStale(s, 'UK-2026.1') === false)
}

// ── Case 2 — different bundle → stale ──────────────────────────────────────
{
  const s = { bundle_id: 'UK-2026.1' }
  check('Case 2 — different bundle_id → stale',
    isSnapshotStale(s, 'UK-2026.2') === true)
}

// ── Case 3 — no bundle id on snapshot → not stale (legacy safe) ────────────
{
  const s = { taken_at: '2025-01-01' }
  check('Case 3 — legacy snapshot without bundle id → not stale (silent)',
    isSnapshotStale(s, 'UK-2026.1') === false)
}

// ── Case 4 — engine without currentBundleId → not stale ────────────────────
{
  const s = { bundle_id: 'UK-2026.1' }
  check('Case 4 — engine without currentBundleId → not stale',
    isSnapshotStale(s, null) === false && isSnapshotStale(s, undefined) === false)
}

// ── Case 5 — walks all known location shapes ───────────────────────────────
{
  check('Case 5a — top-level bundle_id',
    snapshotBundleId({ bundle_id: 'A' }) === 'A')
  check('Case 5b — bundleId camelCase',
    snapshotBundleId({ bundleId: 'B' }) === 'B')
  check('Case 5c — rules_bundle_ref (event envelope)',
    snapshotBundleId({ rules_bundle_ref: 'C' }) === 'C')
  check('Case 5d — _meta.bundleId',
    snapshotBundleId({ _meta: { bundleId: 'D' } }) === 'D')
  check('Case 5e — _meta.version',
    snapshotBundleId({ _meta: { version: 'E' } }) === 'E')
  check('Case 5f — null / non-object returns null',
    snapshotBundleId(null) === null && snapshotBundleId('not-an-object') === null)
}

// ── Case 6 — ageLabel ──────────────────────────────────────────────────────
{
  const t = (delta) => new Date(Date.now() + delta).toISOString()
  const info = (delta) => snapshotVersionInfo({ taken_at: t(delta), bundle_id: 'X' }, 'X')
  check('Case 6a — today',
    info(0).ageLabel === 'today')
  check('Case 6b — yesterday',
    info(-1.5 * 24 * 3600 * 1000).ageLabel === 'yesterday')
  check('Case 6c — days ago',
    /^\d days ago$/.test(info(-3 * 24 * 3600 * 1000).ageLabel))
  check('Case 6d — weeks ago',
    /^\d+ week/.test(info(-10 * 24 * 3600 * 1000).ageLabel))
  check('Case 6e — months ago',
    /^\d+ month/.test(info(-45 * 24 * 3600 * 1000).ageLabel))
  check('Case 6f — years ago',
    /^\d+ year/.test(info(-400 * 24 * 3600 * 1000).ageLabel))
}

// ── Case 7 — staleSnapshotLabel ────────────────────────────────────────────
{
  const fresh = snapshotVersionInfo({ bundle_id: 'UK-2026.1' }, 'UK-2026.1')
  check('Case 7a — fresh snapshot returns null label',
    staleSnapshotLabel(fresh) === null)

  const stale = snapshotVersionInfo({ bundle_id: 'UK-2026.1', taken_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString() }, 'UK-2026.2')
  const label = staleSnapshotLabel(stale)
  check('Case 7b — stale label includes both bundles + age',
    typeof label === 'string'
      && label.includes('UK-2026.1')
      && label.includes('UK-2026.2')
      && label.includes('days ago'),
    label
  )
}

console.log(`\nL4-7 snapshot-version test — fails=${fails}`)
if (fails > 0) process.exit(1)
