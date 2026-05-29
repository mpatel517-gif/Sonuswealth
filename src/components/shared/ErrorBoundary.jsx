// ─────────────────────────────────────────────────────────────────────────────
// ErrorBoundary (L1-3, 2026-05-28)
//
// Catches render-time errors so an exception in any screen / drill / engine
// selector doesn't black-screen the whole SPA.
//
// Two failure modes covered:
//   1. Render error    → componentDidCatch / getDerivedStateFromError
//   2. Async error     → uncaught promise rejection (window event listener
//                        installed via useUncaughtErrorReporter hook below)
//
// L1-4 will wire `window.Sentry?.captureException(error)` once Sentry lands.
// Until then, errors are logged to console + offered for user copy.
//
// Usage:
//   <ErrorBoundary scope="App">      // top-level
//     <App />
//   </ErrorBoundary>
//
//   <ErrorBoundary scope="Risk">     // per-route (deeper boundary)
//     <RiskScreen />
//   </ErrorBoundary>
//
// `scope` is shown in the fallback chrome + carried in the error report so
// you can tell which screen broke without inspecting the stack.
// ─────────────────────────────────────────────────────────────────────────────

import { Component } from 'react'

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    background: 'var(--c-bg, #0a0a0a)',
    color: 'var(--c-text, #f0f0f0)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  card: {
    maxWidth: 560,
    padding: 32,
    borderRadius: 20,
    background: 'var(--c-surface, #1a1a1a)',
    border: '1px solid var(--c-border, #333)',
    boxShadow: 'var(--sh1, 0 8px 32px rgba(0,0,0,0.3))',
    lineHeight: 1.55,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--c-coral, #FF6F7D)',
    marginBottom: 12,
  },
  heading: {
    fontSize: 22,
    fontWeight: 800,
    margin: '0 0 12px',
    letterSpacing: -0.4,
  },
  body: {
    fontSize: 14,
    color: 'var(--c-text2, #b0b0b0)',
    margin: '0 0 20px',
  },
  buttonRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  buttonPrimary: {
    padding: '10px 18px',
    borderRadius: 100,
    background: 'var(--c-acc, #2DF2C3)',
    color: '#000',
    border: 'none',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  buttonSecondary: {
    padding: '10px 18px',
    borderRadius: 100,
    background: 'var(--c-surface2, #2a2a2a)',
    color: 'var(--c-text, #f0f0f0)',
    border: '1px solid var(--c-border, #333)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  details: {
    marginTop: 20,
    fontSize: 11,
    color: 'var(--c-text3, #888)',
  },
  stack: {
    marginTop: 8,
    padding: 12,
    background: 'var(--c-bg, #0a0a0a)',
    border: '1px solid var(--c-border, #333)',
    borderRadius: 8,
    fontFamily: 'ui-monospace, "SF Mono", monospace',
    fontSize: 10,
    lineHeight: 1.5,
    overflow: 'auto',
    maxHeight: 200,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
}

// ── Reporter hook (called from componentDidCatch + window handlers) ─────────
function reportError(error, errorInfo, scope) {
  const payload = {
    scope: scope || 'unknown',
    message: error?.message || String(error),
    stack: error?.stack || null,
    componentStack: errorInfo?.componentStack || null,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : null,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  }

  // Console always — useful for dev + visible if Sentry isn't installed yet.
  // eslint-disable-next-line no-console
  console.error('[ErrorBoundary]', scope, error, errorInfo)

  // Sentry hook — wired in L1-4. Optional chaining means this is a no-op
  // until @sentry/react is installed.
  try {
    if (typeof window !== 'undefined' && window.Sentry?.captureException) {
      window.Sentry.captureException(error, { extra: payload })
    }
  } catch {
    /* never let reporter itself crash the boundary */
  }

  return payload
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null, payload: null }
    this.handleRetry = this.handleRetry.bind(this)
    this.handleCopy = this.handleCopy.bind(this)
    this.handleReload = this.handleReload.bind(this)
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    const payload = reportError(error, errorInfo, this.props.scope)
    this.setState({ errorInfo, payload })
  }

  handleRetry() {
    // Clearing hasError re-renders children. If the underlying state that
    // caused the crash is still bad, the boundary will catch again — but at
    // least the user has a way out without a full reload.
    this.setState({ hasError: false, error: null, errorInfo: null, payload: null })
  }

  handleReload() {
    if (typeof window !== 'undefined') window.location.reload()
  }

  handleCopy() {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return
    const text = JSON.stringify(this.state.payload, null, 2)
    navigator.clipboard.writeText(text).catch(() => {})
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const { fallback, scope } = this.props
    // Caller can pass a custom fallback render — used for per-route boundaries
    // that should preserve outer chrome rather than full-page-replace.
    if (typeof fallback === 'function') {
      return fallback({
        error: this.state.error,
        scope,
        onRetry: this.handleRetry,
        onReload: this.handleReload,
      })
    }

    const message = this.state.error?.message || 'An unexpected error occurred.'
    const showStack =
      typeof import.meta !== 'undefined' &&
      (import.meta.env?.DEV || import.meta.env?.MODE === 'development')

    return (
      <div style={styles.page} role="alert" aria-live="assertive">
        <div style={styles.card}>
          <div style={styles.eyebrow}>
            {scope ? `${scope} crashed` : 'Something broke'}
          </div>
          <h1 style={styles.heading}>We hit an error rendering this view.</h1>
          <p style={styles.body}>
            The issue has been logged. You can try again, reload the page, or
            copy the error details to share with support.
          </p>
          <div style={styles.buttonRow}>
            <button type="button" onClick={this.handleRetry} style={styles.buttonPrimary}>
              Try again
            </button>
            <button type="button" onClick={this.handleReload} style={styles.buttonSecondary}>
              Reload page
            </button>
            <button type="button" onClick={this.handleCopy} style={styles.buttonSecondary}>
              Copy error
            </button>
          </div>
          {showStack && (
            <div style={styles.details}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                Error: {message}
              </div>
              {this.state.error?.stack && (
                <pre style={styles.stack}>{this.state.error.stack}</pre>
              )}
              {this.state.errorInfo?.componentStack && (
                <pre style={styles.stack}>
                  Component stack:
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }
}

// ── Uncaught-rejection reporter ─────────────────────────────────────────────
// Class boundaries don't catch promise rejections. Install once at app boot
// (called from App.jsx) to surface them to the same reporter.
let _installed = false
export function installGlobalErrorListeners() {
  if (_installed || typeof window === 'undefined') return
  _installed = true

  window.addEventListener('error', (event) => {
    reportError(event.error || new Error(event.message || 'window.error'), null, 'window')
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const err = reason instanceof Error ? reason : new Error(String(reason))
    reportError(err, null, 'unhandledrejection')
  })
}
