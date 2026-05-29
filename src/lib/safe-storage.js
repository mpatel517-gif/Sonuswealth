// ─────────────────────────────────────────────────────────────────────────────
// safe-storage — quota-aware localStorage wrapper (L4-10, 2026-05-28)
//
// Problem: localStorage has a ~5 MB cap per origin. Sonuswealth writes:
//   - sw_persona              (small)
//   - sw_onboarding_progress  (small)
//   - sw_content_live_v1      (medium, ~5KB)
//   - per-persona scenario JSON (potentially large after many what-ifs)
//   - per-event commit log    (grows with usage)
// At ~100 scenarios the cap gets hit. setItem throws DOMException and the
// caller's screen state is silently lost.
//
// Fix: wrap setItem with LRU eviction + a soft warning event. Keys outside
// the LRU index (legacy, system, browser-managed) are never touched.
//
// API:
//   safeSet(key, value, opts?) → { ok: boolean, evicted: string[] }
//   safeGet(key, fallback?)    → string | fallback
//   safeRemove(key)            → boolean
//   indexKey(key)              → marks a key as LRU-managed (call once at boot
//                                for any key you DO want evicted under pressure)
//   storageStats()             → { used, cap, pct, indexedKeys, items }
//   onWarning(fn) / offWarning(fn) — subscribe to soft warnings at 80% / 95%
//
// The LRU index is itself stored in localStorage under `_sw_lru_index` so it
// survives reloads. Eviction picks the least-recently-touched indexed key.
// Calling indexKey() updates lastUsed; safeGet + safeSet update it too.
// ─────────────────────────────────────────────────────────────────────────────

const INDEX_KEY    = '_sw_lru_index_v1'
// Most browsers cap at ~5 MB per origin. The SOFT_CAP is for the warning
// thresholds (UI hints "you're at 80%"). Actual eviction is driven by
// QuotaExceededError on setItem — that's the only honest signal, since
// the real browser cap varies (Safari 5MB, Chrome 10MB, embedded WebViews
// less). Cap-agnostic eviction means this works everywhere.
let _softCap       = 4.5 * 1024 * 1024
let _warnAtPct     = 0.80
let _urgentPct     = 0.95

const _listeners = new Set()
function _emit(level, detail) {
  for (const fn of _listeners) {
    try { fn({ level, ...detail }) } catch {}
  }
}

function _hasLs() {
  try {
    return typeof localStorage !== 'undefined'
  } catch {
    return false
  }
}

// ── LRU index helpers ──────────────────────────────────────────────────────
// The index is a plain object { [key]: { lastUsed: ms, size: bytes } }.
function loadIndex() {
  if (!_hasLs()) return {}
  try {
    const raw = localStorage.getItem(INDEX_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return (parsed && typeof parsed === 'object') ? parsed : {}
  } catch {
    return {}
  }
}

function saveIndex(idx) {
  if (!_hasLs()) return
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(idx))
  } catch {
    // If we can't even save the index, eviction is the next caller's problem.
  }
}

// ── Public: mark a key as eligible for LRU eviction ─────────────────────────
export function indexKey(key) {
  if (!_hasLs() || !key) return
  const idx = loadIndex()
  if (!idx[key]) idx[key] = { lastUsed: Date.now(), size: 0 }
  saveIndex(idx)
}

// ── Storage stats ───────────────────────────────────────────────────────────
export function storageStats() {
  if (!_hasLs()) return { used: 0, cap: _softCap, pct: 0, indexedKeys: 0, items: 0, available: false }
  let used = 0
  let items = 0
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k) continue
    const v = localStorage.getItem(k) || ''
    used += k.length + v.length
    items++
  }
  const idx = loadIndex()
  return {
    used,
    cap:     _softCap,
    pct:     used / _softCap,
    indexedKeys: Object.keys(idx).length,
    items,
    available: true,
  }
}

// ── Eviction loop ───────────────────────────────────────────────────────────
// Removes the least-recently-used indexed key, repeating until used < target.
// Returns the list of evicted keys.
function evictUntilBelow(targetBytes) {
  const evicted = []
  let stats = storageStats()
  if (!stats.available) return evicted
  let idx = loadIndex()
  let entries = Object.entries(idx)
    .filter(([k]) => localStorage.getItem(k) != null)
    .sort((a, b) => (a[1]?.lastUsed || 0) - (b[1]?.lastUsed || 0))

  while (stats.used > targetBytes && entries.length > 0) {
    const [victim] = entries.shift()
    try {
      localStorage.removeItem(victim)
      delete idx[victim]
      evicted.push(victim)
    } catch {
      break
    }
    stats = storageStats()
  }
  saveIndex(idx)
  return evicted
}

// ── Public: safe write with eviction ────────────────────────────────────────
// `opts.indexed`: default true. Set false for one-off writes that should NOT
// participate in LRU (legacy keys, system flags, anything you don't want
// evicted to make room for newer stuff).
export function safeSet(key, value, opts = {}) {
  if (!_hasLs() || !key) return { ok: false, evicted: [], reason: 'no_localstorage' }
  const indexed = opts.indexed !== false
  const str = typeof value === 'string' ? value : JSON.stringify(value)
  let evicted = []

  // First attempt — optimistic write.
  try {
    localStorage.setItem(key, str)
  } catch (e) {
    // Quota exceeded — evict and retry. We don't know the real cap (browser-
    // specific) so we evict in passes, halving the indexed-key set each time
    // until the write succeeds or we have nothing left to evict.
    let wrote = false
    while (!wrote) {
      const idx = loadIndex()
      const entries = Object.entries(idx)
        .filter(([k]) => localStorage.getItem(k) != null && k !== key)
        .sort((a, b) => (a[1]?.lastUsed || 0) - (b[1]?.lastUsed || 0))
      if (entries.length === 0) {
        _emit('error', { key, error: (e && e.message) || String(e), evicted })
        return { ok: false, evicted, reason: 'quota_exceeded' }
      }
      // Evict the oldest entry per pass.
      const [victim] = entries.shift()
      try {
        localStorage.removeItem(victim)
        const updated = loadIndex()
        delete updated[victim]
        saveIndex(updated)
        evicted.push(victim)
      } catch { /* keep trying */ }
      try {
        localStorage.setItem(key, str)
        wrote = true
      } catch { /* keep evicting */ }
    }
  }

  if (indexed) {
    const idx = loadIndex()
    idx[key] = { lastUsed: Date.now(), size: str.length }
    saveIndex(idx)
  }

  // Soft warnings against the configurable soft cap.
  const post = storageStats()
  if (post.pct >= _urgentPct) _emit('urgent', { pct: post.pct, used: post.used, cap: post.cap })
  else if (post.pct >= _warnAtPct) _emit('warn', { pct: post.pct, used: post.used, cap: post.cap })

  return { ok: true, evicted }
}

// ── Public: safe read that touches LRU ─────────────────────────────────────
export function safeGet(key, fallback = null) {
  if (!_hasLs() || !key) return fallback
  try {
    const v = localStorage.getItem(key)
    if (v == null) return fallback
    // Touch LRU on read so frequently-read keys aren't evicted just because
    // they happened to be written first.
    const idx = loadIndex()
    if (idx[key]) {
      idx[key].lastUsed = Date.now()
      saveIndex(idx)
    }
    return v
  } catch {
    return fallback
  }
}

export function safeRemove(key) {
  if (!_hasLs() || !key) return false
  try {
    localStorage.removeItem(key)
    const idx = loadIndex()
    if (idx[key]) {
      delete idx[key]
      saveIndex(idx)
    }
    return true
  } catch {
    return false
  }
}

// ── Public: warning subscription ────────────────────────────────────────────
export function onWarning(fn)  { if (typeof fn === 'function') _listeners.add(fn) }
export function offWarning(fn) { _listeners.delete(fn) }

// ── Test hooks (not for production use) ─────────────────────────────────────
export const _internal = {
  get SOFT_CAP() { return _softCap },
  get WARN_AT_PCT() { return _warnAtPct },
  get URGENT_PCT() { return _urgentPct },
  configure({ softCap, warnAtPct, urgentPct } = {}) {
    if (typeof softCap === 'number')  _softCap   = softCap
    if (typeof warnAtPct === 'number') _warnAtPct = warnAtPct
    if (typeof urgentPct === 'number') _urgentPct = urgentPct
  },
  loadIndex,
  saveIndex,
  evictUntilBelow,
}
