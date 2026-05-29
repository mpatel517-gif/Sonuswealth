// ─────────────────────────────────────────────────────────────────────────────
// useContent — externalised-copy lookup hook (L3-4 + L3-5, 2026-05-28)
//
// Founder pushback: "how can we update the app with new content without a
// deploy?". This module is the answer.
//
// Architecture (two-layer):
//
//   Layer 1 (static): src/content/uk-en.json — bundled with the JS chunk,
//     loads at first paint with zero network latency. Always present.
//
//   Layer 2 (live):   `content-pull` Edge Function reads finio_content.
//     Fetched once per session, cached in sessionStorage. Overlays Layer 1.
//
// Resolution order at lookup time:
//   1. Live overlay (if fetched this session)
//   2. Static bundle (always)
//   3. Caller's fallback argument
//   4. undefined (caller should never get here — the second arg matters)
//
// This means:
//   * Page load is fast (no blocking fetch)
//   * Copy edits in Supabase land on the next session (or the next refresh)
//   * A down `content-pull` function NEVER causes copy to disappear —
//     the static bundle is the floor.
//
// Security note (re-stated from migration 015):
//   Legal disclaimers + the FCA boundary string are convenience-copied
//   into uk-en.json but the CANONICAL source stays in BRAND.disclaimer
//   and src/content/legal/*.md. Don't rely on this hook for legal-binding
//   text — a Supabase compromise would otherwise be a regulatory event.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import CONTENT from '../content/uk-en.json' with { type: 'json' }

// ── Live overlay state ─────────────────────────────────────────────────────
// Module-scoped so all hook callers share the same overlay without re-fetch.
let _liveOverlay = null            // { [key]: value } or null if not loaded
let _liveLoadPromise = null         // in-flight fetch promise (dedupe concurrent hooks)
const _LIVE_SESSION_KEY = 'sw_content_live_v1'
const _LIVE_TTL_MS = 1000 * 60 * 30 // 30 minutes — bounds cache staleness when tab stays open

// Resolve the content-pull URL from env. If unset, live overlay is disabled
// (e.g. in unit-test environments without Supabase wiring) — static bundle
// still works.
function _contentPullUrl() {
  try {
    const supaUrl = import.meta?.env?.VITE_SUPABASE_URL
    if (!supaUrl) return null
    return `${supaUrl.replace(/\/$/, '')}/functions/v1/content-pull?locale=uk-en`
  } catch {
    return null
  }
}

// Restore session cache eagerly so the very first getContent() call inside
// a fresh page (before the React effect fires) already has live values.
function _restoreFromSession() {
  if (typeof sessionStorage === 'undefined') return
  try {
    const raw = sessionStorage.getItem(_LIVE_SESSION_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return
    const ageMs = Date.now() - (+parsed.savedAt || 0)
    if (ageMs > _LIVE_TTL_MS) return
    if (parsed.bundle && typeof parsed.bundle === 'object') {
      _liveOverlay = parsed.bundle
    }
  } catch {
    // ignore — corrupt cache just falls back to network or static.
  }
}
_restoreFromSession()

async function _fetchLiveOverlay() {
  if (_liveOverlay) return _liveOverlay
  if (_liveLoadPromise) return _liveLoadPromise

  const url = _contentPullUrl()
  if (!url) return null

  _liveLoadPromise = (async () => {
    try {
      const res = await fetch(url, { method: 'GET' })
      if (!res.ok) throw new Error(`content-pull HTTP ${res.status}`)
      const body = await res.json()
      const bundle = (body && typeof body.bundle === 'object') ? body.bundle : null
      if (!bundle) return null

      _liveOverlay = bundle
      try {
        sessionStorage.setItem(_LIVE_SESSION_KEY, JSON.stringify({
          bundle,
          savedAt: Date.now(),
          version: body.version ?? 0,
          lastUpdated: body.lastUpdated ?? null,
        }))
      } catch {
        // sessionStorage full / disabled (private window) — silently skip.
      }
      return bundle
    } catch (e) {
      // Network or function down — static bundle remains canonical.
      console.warn('[useContent] live overlay fetch failed:', (e && e.message) || e)
      return null
    } finally {
      _liveLoadPromise = null
    }
  })()

  return _liveLoadPromise
}

// ── Dot-path resolver against the static bundle ────────────────────────────
function _resolveStatic(key) {
  if (typeof key !== 'string' || !key) return undefined
  const parts = key.split('.')
  let node = CONTENT
  for (const part of parts) {
    if (node == null || typeof node !== 'object') return undefined
    node = node[part]
  }
  return node
}

// ── Resolution: live overlay first, then static, then fallback ─────────────
function _resolve(key) {
  if (_liveOverlay && typeof _liveOverlay[key] === 'string') {
    return _liveOverlay[key]
  }
  return _resolveStatic(key)
}

// ── Pure lookup (non-React contexts: engine helpers, scripts) ──────────────
export function getContent(key, fallback) {
  const v = _resolve(key)
  if (typeof v === 'string') return v
  // Allow arrays / objects too (for keys that hold structured data) — caller
  // is responsible for type-checking. For string slots, prefer fallback.
  if (v != null && typeof v !== 'object') return v
  return fallback
}

// ── React hook ─────────────────────────────────────────────────────────────
// Returns a stable `t(key, fallback)` callback + triggers a one-shot live
// overlay fetch on first mount per session. The callback is memoised — safe
// to use in dependency arrays.
//
// The hook re-renders when the live overlay lands so call sites get the new
// copy without manual subscription.
export function useContent() {
  const [, force] = useState(0)

  useEffect(() => {
    let cancelled = false
    _fetchLiveOverlay().then((bundle) => {
      if (cancelled) return
      if (bundle) force((n) => n + 1) // re-render so child reads new copy
    })
    return () => { cancelled = true }
  }, [])

  return useCallback((key, fallback) => getContent(key, fallback), [])
}

// ── Prime the live overlay at app boot ─────────────────────────────────────
// Call once from main.jsx or App.jsx so the live overlay is primed even when
// the first surface uses the synchronous getContent() helper rather than the
// useContent() hook. Fire-and-forget — failure is silent + non-blocking.
export function primeLiveContent() {
  _fetchLiveOverlay().catch(() => {}) // already swallowed inside, defensive
}

// ── Manual refresh (for an admin "Refresh content" button later) ───────────
export async function refreshLiveContent() {
  _liveOverlay = null
  try { sessionStorage.removeItem(_LIVE_SESSION_KEY) } catch {}
  return _fetchLiveOverlay()
}

// ── Bundle metadata (debug / version chip / Phase-2 cron status) ───────────
export const CONTENT_VERSION = CONTENT?._meta?.version || 'unknown'
export const CONTENT_LOCALE  = CONTENT?._meta?.locale  || 'uk-en'
export const CONTENT_UPDATED = CONTENT?._meta?.lastUpdated || null
