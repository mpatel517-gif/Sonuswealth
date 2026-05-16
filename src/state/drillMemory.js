// ─────────────────────────────────────────────────────────────────────────────
// drillMemory — §13.8 magic: "Resume where you left off"
//
// Persists the user's last drill path. On app mount, surface latest drill via
// a single Whisper notification: "Yesterday you were exploring Pension →
// Drawdown → Bengen detail. Resume?"
//
// Privacy: cleared on logout. Stored in localStorage with TTL (24h default).
// ─────────────────────────────────────────────────────────────────────────────

const STORE_KEY = 'sonuswealth.drillMemory'
const TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Record a drill path. Each frame is a {tab, metric, label} crumb.
 */
export function recordDrill(tab, frames) {
  if (typeof window === 'undefined') return
  try {
    const record = {
      tab,
      frames,
      ts: Date.now(),
    }
    localStorage.setItem(STORE_KEY, JSON.stringify(record))
  } catch { /* quota / SSR — silent */ }
}

/**
 * Read the latest drill if within TTL; returns null if expired or missing.
 */
export function readDrill() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.ts || Date.now() - parsed.ts > TTL_MS) {
      localStorage.removeItem(STORE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

/**
 * Clear drill memory (logout, manual clear).
 */
export function clearDrill() {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(STORE_KEY) } catch {}
}

/**
 * Format a drill memory record as a Whisper-compatible payload.
 */
export function drillAsWhisper(record) {
  if (!record?.frames?.length) return null
  const path = record.frames.map(f => f.label || f.metric).join(' › ')
  return {
    id: 'drill-resume',
    icon: '↩',
    text: `Yesterday you were exploring ${path}.`,
    cta: 'Resume',
    onTap: () => {
      // Caller wires this — typically: setTab(record.tab) + push frames to overlay stack
    },
  }
}
