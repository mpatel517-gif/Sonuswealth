// ─────────────────────────────────────────────────────────────────────────────
// HomeAlertsPanel — one managed "Needs attention" surface for Home.
//
// Founder 2026-06-13: the stacked full-width alert banners (cashflow deficit,
// SIPP-IHT 2027 countdown, …) took over the page and superseded the main info.
// This replaces them with ONE compact panel backed by the SAME canonical stream
// the Notification Centre uses (deriveNotifications) — so Home and the Centre
// can't drift, and "View all" routes to the Centre for the full list + snooze/ack.
//
// Severity-ranked (RED → AMBER → GREEN/GREY), shows the top few as one-line rows
// with a colour dot + inline action; the rest live behind "View all". Renders
// nothing when there's nothing to surface (the calm path).
// ─────────────────────────────────────────────────────────────────────────────

import { deriveNotifications } from '../../screens/NotificationCentre.jsx'

const TONE_RANK = { RED: 0, AMBER: 1, GREEN: 2, GREY: 3 }
const TONE_DOT = {
  RED:   'var(--c-coral-text, #FF6F7D)',
  AMBER: 'var(--c-warning, #E0A23C)',
  GREEN: 'var(--c-acc, #1F9D6B)',
  GREY:  'var(--c-text3)',
}
// Mirror of NotificationCentre NC_TYPES tones (kept local to avoid a cross-import;
// the stream items don't carry tone, only type).
const TYPE_TONE = {
  'NC-SC': 'AMBER', 'NC-DD': 'RED', 'NC-RA': 'AMBER', 'NC-TB': 'AMBER',
  'NC-EX': 'GREEN', 'NC-RC': 'RED', 'NC-CF': 'AMBER',
}

const MAX_INLINE = 3

export default function HomeAlertsPanel({ entity, onNav }) {
  let items = []
  try { items = deriveNotifications(entity) || [] } catch { items = [] }
  items = items.filter(n => !n.acknowledged_at)
  if (!items.length) return null // nothing to surface — calm path, render nothing

  const ranked = items
    .map(n => ({ ...n, _tone: TYPE_TONE[n.type] || 'GREY' }))
    .sort((a, b) => (TONE_RANK[a._tone] ?? 9) - (TONE_RANK[b._tone] ?? 9))
  const shown = ranked.slice(0, MAX_INLINE)
  const extra = ranked.length - shown.length

  return (
    <div role="region" aria-label="Needs attention" style={{
      margin: '2px 16px 0', padding: '10px 12px 8px',
      background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--c-text3)' }}>
          Needs attention · {ranked.length}
        </span>
        <button type="button" onClick={() => onNav?.('notif')} className="sw-press" style={{
          background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 12, fontWeight: 700, color: 'var(--c-acc)', padding: 0,
        }}>View all ›</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {shown.map((n, i) => (
          <button
            key={n.id}
            type="button"
            onClick={() => onNav?.(n.cta?.route || 'notif')}
            className="sw-press"
            aria-label={`${n.title}. ${n.cta?.label || 'Open'}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '8px 2px', background: 'none', cursor: 'pointer', textAlign: 'left',
              border: 'none', borderTop: i > 0 ? '1px solid var(--c-sep)' : 'none', fontFamily: 'inherit',
            }}
          >
            <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 100, background: TONE_DOT[n._tone], flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {n.title}
              </span>
              {n.body && (
                <span style={{ display: 'block', fontSize: 12, color: 'var(--c-text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {n.body}
                </span>
              )}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-acc)', flexShrink: 0, whiteSpace: 'nowrap' }}>
              {n.cta?.label || 'Open'} ›
            </span>
          </button>
        ))}
      </div>

      {extra > 0 && (
        <button type="button" onClick={() => onNav?.('notif')} className="sw-press" style={{
          marginTop: 4, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 11.5, color: 'var(--c-text3)', padding: '4px 2px',
        }}>
          + {extra} more in your Notification Centre
        </button>
      )}
    </div>
  )
}
