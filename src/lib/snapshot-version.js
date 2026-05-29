// ─────────────────────────────────────────────────────────────────────────────
// snapshot-version — stale snapshot detection (L4-7, 2026-05-28)
//
// Problem: a snapshot taken on Monday under bundle UK-2026.1.0 and read on
// Tuesday under UK-2026.1.1 (because the founder shipped a Budget bundle
// update overnight) silently uses Tuesday's rules to render Monday's
// snapshot. The £ figures the user sees are an inconsistent mix of two
// rule sets — confusing at best, wrong at worst.
//
// Fix: every snapshot carries a `bundle_id` (or `_meta.bundleId`). On read,
// compare to the engine's current bundle id. If different, the UI shows a
// "stale snapshot" banner with two affordances: "Recompute under today's
// rules" or "Keep as-is (locked at <bundle>)".
//
// API:
//   isSnapshotStale(snapshot, currentBundleId?) → boolean
//   snapshotVersionInfo(snapshot, currentBundleId?) →
//     { isStale, snapshotBundle, currentBundle, ageLabel }
//
// Pure functions — no React, no DOM, no engine import. The UI banner
// component (a future deliverable, tracked separately) reads these and
// renders the right text.
// ─────────────────────────────────────────────────────────────────────────────

// Walks a snapshot and finds the bundle id, regardless of where it lives.
// Covers the historical shapes the engine has used over the past 6 months.
export function snapshotBundleId(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null
  return (
    snapshot.bundle_id
    ?? snapshot.bundleId
    ?? snapshot.rules_bundle_ref
    ?? snapshot.bundle_version
    ?? snapshot._meta?.bundleId
    ?? snapshot._meta?.bundle_id
    ?? snapshot._meta?.bundleVersion
    ?? snapshot._meta?.version
    ?? null
  )
}

export function isSnapshotStale(snapshot, currentBundleId) {
  if (currentBundleId == null) return false       // engine doesn't know its own version → can't compare
  const id = snapshotBundleId(snapshot)
  if (id == null) return false                    // no bundle id on snapshot → can't compare (silent for legacy)
  return id !== currentBundleId
}

function ageLabelFromIso(iso) {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return null
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))
  if (days < 1) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} week${days < 14 ? '' : 's'} ago`
  if (days < 365) return `${Math.floor(days / 30)} month${days < 60 ? '' : 's'} ago`
  return `${Math.floor(days / 365)} year${days < 730 ? '' : 's'} ago`
}

export function snapshotVersionInfo(snapshot, currentBundleId) {
  const snapshotBundle = snapshotBundleId(snapshot)
  const isStale = isSnapshotStale(snapshot, currentBundleId)
  const takenAt = snapshot?.taken_at ?? snapshot?.takenAt ?? snapshot?._meta?.takenAt ?? snapshot?._meta?.snapshotDate ?? null
  return {
    isStale,
    snapshotBundle,
    currentBundle: currentBundleId,
    takenAt,
    ageLabel: ageLabelFromIso(takenAt),
  }
}

// Human-readable label for the stale-banner copy. Caller renders.
export function staleSnapshotLabel(info) {
  if (!info?.isStale) return null
  const age = info.ageLabel ? ` (${info.ageLabel})` : ''
  const taken = info.snapshotBundle ?? 'unknown'
  const now   = info.currentBundle  ?? 'unknown'
  return `Rules updated since this snapshot${age}. Snapshot used ${taken}; today uses ${now}.`
}
