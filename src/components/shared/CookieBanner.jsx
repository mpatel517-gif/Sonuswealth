// ─────────────────────────────────────────────────────────────────────────────
// CookieBanner (L1-2, 2026-05-28)
//
// Privacy-preserving cookie banner:
//   - Hidden when user has already chosen (localStorage `sw_cookie_consent`)
//   - Default: only strictly-necessary cookies; analytics + error reporting
//     require explicit consent
//   - Respects Do Not Track — if DNT is set, banner shows but only the
//     "necessary only" option (analytics permanently off)
//
// Consent values:
//   'necessary' — strictly necessary only (no PostHog, no Sentry)
//   'analytics' — strictly necessary + PostHog + Sentry
//
// On change, fires window event `sonus:cookie-consent` that observability.js
// can listen for to (re)init or shutdown SDKs.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'sw_cookie_consent'

function readConsent() {
  if (typeof window === 'undefined') return null
  try { return window.localStorage?.getItem(STORAGE_KEY) || null } catch { return null }
}

function writeConsent(value) {
  try { window.localStorage?.setItem(STORAGE_KEY, value) } catch { /* ignore */ }
  try {
    window.dispatchEvent(new CustomEvent('sonus:cookie-consent', { detail: { value } }))
  } catch { /* ignore */ }
}

function isDNT() {
  if (typeof navigator === 'undefined') return false
  return navigator.doNotTrack === '1' || window?.doNotTrack === '1' || navigator.msDoNotTrack === '1'
}

export default function CookieBanner({ onOpenCookies }) {
  const [consent, setConsent] = useState(() => readConsent())
  const [dnt] = useState(isDNT)

  // Re-read on storage events from other tabs.
  useEffect(() => {
    const handler = (e) => { if (e.key === STORAGE_KEY) setConsent(e.newValue) }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  if (consent) return null

  function choose(value) {
    writeConsent(value)
    setConsent(value)
  }

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      style={{
        position: 'fixed', bottom: 16, left: 16, right: 16, zIndex: 1000,
        maxWidth: 720, margin: '0 auto',
        background: 'var(--c-surface)', color: 'var(--c-text)',
        border: '1px solid var(--c-border)',
        borderRadius: 14, padding: '14px 16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      <div style={{ fontSize: 13, lineHeight: 1.55 }}>
        We use a small number of essential cookies to keep you signed in and
        remember your preferences. Optional analytics and error-reporting cookies
        are off by default — choose below.{' '}
        {onOpenCookies && (
          <button
            type="button"
            onClick={onOpenCookies}
            style={{
              background: 'none', border: 'none', padding: 0,
              color: 'var(--c-acc)', textDecoration: 'underline', cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Cookie details
          </button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => choose('necessary')}
          style={{
            padding: '8px 14px', borderRadius: 100,
            background: 'var(--c-surface2)', border: '1px solid var(--c-border)',
            color: 'var(--c-text)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Strictly necessary only
        </button>
        {!dnt && (
          <button
            type="button"
            onClick={() => choose('analytics')}
            style={{
              padding: '8px 14px', borderRadius: 100,
              background: 'var(--c-acc)', border: 'none',
              color: '#000', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Accept analytics
          </button>
        )}
      </div>
      {dnt && (
        <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>
          We detected Do Not Track in your browser, so analytics is permanently off.
        </div>
      )}
    </div>
  )
}
