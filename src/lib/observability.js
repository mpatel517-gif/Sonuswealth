// ─────────────────────────────────────────────────────────────────────────────
// observability.js (L1-4, 2026-05-28)
//
// Sentry + PostHog init. Scaffold pattern: SDKs are NOT in package.json yet.
// When the founder installs them and sets DSNs, this file dynamically loads
// and wires them. Until then, every call is a no-op (no crashes, no logs).
//
// To activate:
//   npm i @sentry/react@^8 posthog-js@^1
//
//   .env.local:
//     VITE_SENTRY_DSN=https://...@sentry.io/...
//     VITE_POSTHOG_KEY=phc_...
//     VITE_POSTHOG_HOST=https://eu.i.posthog.com    # optional, defaults EU
//
// The dynamic-import pattern means:
//   - When SDKs are absent, the build still works (no static import errors).
//   - When DSNs are absent, init is skipped silently.
//   - When both present, init runs on first call to initObservability().
//
// Privacy posture (Consumer Duty alignment):
//   - PostHog autocapture is DISABLED. Form inputs, click text, page hashes
//     are not captured automatically — too easy to leak £ amounts in DOM.
//   - We send page views + named events only. Event payloads must not
//     contain personally identifying numbers.
//   - Sentry source-map upload is opt-in via env var.
//
// Sentry hooks into the existing ErrorBoundary via window.Sentry.
// ─────────────────────────────────────────────────────────────────────────────

const SENTRY_DSN = typeof import.meta !== 'undefined' ? (import.meta.env?.VITE_SENTRY_DSN || '') : ''
const POSTHOG_KEY = typeof import.meta !== 'undefined' ? (import.meta.env?.VITE_POSTHOG_KEY || '') : ''
const POSTHOG_HOST = typeof import.meta !== 'undefined'
  ? (import.meta.env?.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com')
  : 'https://eu.i.posthog.com'
const APP_ENV = typeof import.meta !== 'undefined' ? (import.meta.env?.MODE || 'production') : 'production'

let _initialised = false
let _sentry = null
let _posthog = null

// ── Sentry init (dynamic) ───────────────────────────────────────────────────
// /* @vite-ignore */ keeps Rolldown from trying to resolve the module at
// build time. The package is optional; when it's not installed the dynamic
// import rejects at runtime and we fall through silently.
async function tryInitSentry() {
  if (!SENTRY_DSN) return null
  try {
    // Module name lives in a variable so Vite's dev import-analysis can't
    // resolve it ahead of execution. Without this, dev-server fails to start
    // when @sentry/react isn't yet installed. Production rolldown respects
    // /* @vite-ignore */ as well.
    const sentryPkg = '@sentry/react'
    const Sentry = await import(/* @vite-ignore */ sentryPkg)
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: APP_ENV,
      // Performance + replay disabled by default — opt in when you understand
      // the privacy implications. Replay can capture £ amounts on screen.
      tracesSampleRate: 0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      // Strip query strings from breadcrumbs (?demo=X, ?seed=… leak data).
      beforeBreadcrumb(breadcrumb) {
        if (breadcrumb?.data?.url) {
          try {
            const u = new URL(breadcrumb.data.url, window.location.origin)
            u.search = ''
            breadcrumb.data.url = u.toString()
          } catch { /* leave as-is */ }
        }
        return breadcrumb
      },
    })
    // Expose on window for ErrorBoundary's optional-chain hook.
    if (typeof window !== 'undefined') window.Sentry = Sentry
    return Sentry
  } catch (e) {
    // SDK not installed yet — no problem, fall through silently.
    // eslint-disable-next-line no-console
    if (APP_ENV === 'development') console.debug('[observability] @sentry/react not installed; skipping')
    return null
  }
}

// ── PostHog init (dynamic) ──────────────────────────────────────────────────
async function tryInitPostHog() {
  if (!POSTHOG_KEY) return null
  try {
    // Same indirection as Sentry — defeats Vite dev import-analysis when the
    // optional package isn't installed.
    const posthogPkg = 'posthog-js'
    const { default: posthog } = await import(/* @vite-ignore */ posthogPkg)
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      // Privacy-preserving defaults — see file header.
      autocapture: false,
      capture_pageview: true,
      capture_pageleave: true,
      session_recording: { maskAllInputs: true, maskTextSelector: '[data-tieout],[data-pii]' },
      disable_session_recording: true,
      persistence: 'localStorage+cookie',
      // Strip query strings from page-view URLs to avoid leaking ?demo=, etc.
      sanitize_properties(properties) {
        if (properties?.$current_url) {
          try {
            const u = new URL(properties.$current_url)
            u.search = ''
            properties.$current_url = u.toString()
          } catch { /* leave */ }
        }
        return properties
      },
    })
    return posthog
  } catch (e) {
    // eslint-disable-next-line no-console
    if (APP_ENV === 'development') console.debug('[observability] posthog-js not installed; skipping')
    return null
  }
}

// ── Public API ──────────────────────────────────────────────────────────────
export async function initObservability() {
  if (_initialised) return { sentry: _sentry, posthog: _posthog }
  _initialised = true
  const [sentry, posthog] = await Promise.all([tryInitSentry(), tryInitPostHog()])
  _sentry = sentry
  _posthog = posthog
  return { sentry, posthog }
}

// Capture an exception. Called by ErrorBoundary fallback OR by any code that
// wants to report a caught-but-recoverable error.
export function captureException(error, context = {}) {
  if (_sentry?.captureException) {
    _sentry.captureException(error, { extra: context })
  } else if (typeof window !== 'undefined' && window.Sentry?.captureException) {
    window.Sentry.captureException(error, { extra: context })
  }
}

// Named-event capture. Used for product analytics — not for £ amounts.
// Examples:
//   track('TAX_YEAR_SWITCHED', { from: '2025/26', to: '2024/25' })
//   track('DRILL_OPENED', { domain: 'pension' })
//   track('SCENARIO_SAVED')
export function track(eventName, properties = {}) {
  if (_posthog?.capture) _posthog.capture(eventName, properties)
}

// Associate the current session with an authenticated user. Call this from
// Account.jsx after sign-in / sign-up. Detach on sign-out.
export function identify(userId, traits = {}) {
  if (_posthog?.identify) _posthog.identify(userId, traits)
  if (_sentry?.setUser) _sentry.setUser({ id: userId })
}

export function reset() {
  if (_posthog?.reset) _posthog.reset()
  if (_sentry?.setUser) _sentry.setUser(null)
}
