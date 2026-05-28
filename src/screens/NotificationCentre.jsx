// ─────────────────────────────────────────────────────────────────────────────
// NotificationCentre — Phase 3 module.
//
// Spec: 2-Product-notifications-v1_0.md
// Taxonomy (FIX-13): NC-SC / NC-DD / NC-RA / NC-TB / NC-EX / NC-RC
// Tones: RED / AMBER / GREEN / GREY
// Engine-derived stream (APQ + SIPP-IHT countdown + X27 estate-discovery).
// Anti-nagger collapse, mandatory NC-RC, source chip, snooze, acknowledge.
//
// Distinct from APQ Priority Actions (those are on Home).
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react'
import { calcAPQ } from '../engine/fq-calculator.js'

// ── Taxonomy per spec ──
const NC_TYPES = {
  'NC-SC': { label: 'Score Change',        tone: 'AMBER' },
  'NC-DD': { label: 'Deadline',            tone: 'RED'   },
  'NC-RA': { label: 'Rules Alert',         tone: 'AMBER' },
  'NC-TB': { label: 'Tax Boundary',        tone: 'AMBER' },
  'NC-EX': { label: 'Export Ready',        tone: 'GREEN' },
  'NC-RC': { label: 'Regulatory Critical', tone: 'RED', mandatory: true },
}

const TONE_COLOUR = {
  RED:   '#FF3B30',
  AMBER: '#FF9F0A',
  GREEN: '#00E5A8',
  GREY:  '#9CA3AF',
}

const TONE_CHIP = {
  RED:   'sw-chip-coral',
  AMBER: 'sw-chip-amber',
  GREEN: 'sw-chip-mint',
  GREY:  '',
}

// ── SIPP IHT countdown helper (engine-aligned: 6 April 2027) ──
const SIPP_IHT_DATE = new Date('2027-04-06')
function sipDays(_entity, now = Date.now()) {
  const ms = SIPP_IHT_DATE.getTime() - now
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

// ── Engine-derived stream ──
function deriveNotifications(entity, { now = Date.now() } = {}) {
  const items = []
  const e = entity || {}
  const entity_id    = e.id || 'unknown'
  const jurisdiction = e.jurisdictionContext?.primary || 'UK-2026.1'

  // APQ → NC-SC
  let apq = []
  try { apq = calcAPQ(e) || [] } catch (_err) { apq = [] }
  for (const action of apq) {
    items.push({
      id:              `apq-${action.id}`,
      correlation_id:  `corr-apq-${action.id}`,
      entity_id,
      jurisdiction,
      type:            'NC-SC',
      title:           action.title,
      body:            action.detail || action.reason || '',
      cta:             { label: 'Take action', route: action.screen || 'home' },
      source_chip:     'From your priority actions',
      created_at:      now,
      acknowledged_at: null,
      can_disable:     true,
    })
  }

  // SIPP IHT countdown → NC-RC (mandatory, non-dismissible) if <500 days
  const days = sipDays(e, now)
  if (days < 500) {
    items.push({
      id:              'sipp-iht-countdown',
      correlation_id:  'corr-sipp-iht-2027',
      entity_id,
      jurisdiction,
      type:            'NC-RC',
      title:           'SIPP enters estate April 2027',
      body:            `${days} days until pension becomes IHT-chargeable.`,
      cta:             { label: 'View plan', route: 'tax' },
      source_chip:     'From UK tax rules · FA2026',
      created_at:      now,
      acknowledged_at: null,
      can_disable:     false,
    })
  }

  // X27 estate-discovery (Caelixa differentiator):
  // business assets present + no will → NC-RA "confirm will covers BPR succession".
  const hasBusinessAssets = Array.isArray(e.assets?.business_assets)
    ? e.assets.business_assets.length > 0
    : Array.isArray(e.business_assets) && e.business_assets.length > 0
  const hasWill = !!(e.estate?.will?.exists || e.will?.exists || e.estate?.willInPlace)
  if (hasBusinessAssets && !hasWill) {
    items.push({
      id:              'x27-business-will',
      correlation_id:  'corr-x27-business-will',
      entity_id,
      jurisdiction,
      type:            'NC-RA',
      title:           'Confirm will covers business succession',
      body:            'You hold business assets — confirm your will covers BPR succession.',
      cta:             { label: 'Open Tax & Estate', route: 'tax' },
      source_chip:     'From estate discovery',
      created_at:      now,
      acknowledged_at: null,
      can_disable:     true,
    })
  }

  return items
}

// ── Tile renderer for a single notification ──
function NotifCard({ n, onNavigate, onAcknowledge, onSnooze, onDismiss }) {
  const def    = NC_TYPES[n.type] || { label: n.type, tone: 'GREY' }
  const tone   = def.tone
  const colour = TONE_COLOUR[tone]
  const canDismiss = n.can_disable !== false

  return (
    <div
      className="sw-tile"
      style={{
        textAlign: 'left',
        borderLeft: `3px solid ${colour}`,
        paddingLeft: 12,
        opacity: n.acknowledged_at ? 0.55 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span className={`sw-chip sw-chip-sm ${TONE_CHIP[tone]}`}>{tone}</span>
        <span style={{ fontSize: 10, color: 'var(--c-text3)', fontWeight: 700, letterSpacing: 0.4 }}>
          {n.type} · {def.label}
        </span>
        {n.source_chip && (
          <span
            style={{
              fontSize: 10, color: 'var(--c-text3)',
              padding: '2px 6px', borderRadius: 6,
              border: '1px solid var(--c-border)',
              background: 'var(--c-surface2)',
            }}
          >{n.source_chip}</span>
        )}
        <span style={{ flex: 1 }} />
        {!canDismiss && (
          <span
            title="Regulatory critical — cannot be disabled"
            style={{ fontSize: 10, color: colour, fontWeight: 700 }}
          >MANDATORY</span>
        )}
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)', marginBottom: 4 }}>
        {n.title}
      </div>
      <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.55 }}>
        {n.body}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
        {n.cta && (
          <button
            type="button"
            onClick={() => n.cta?.route && onNavigate?.(n.cta.route)}
            className="sw-press"
            style={{
              padding: '6px 12px', borderRadius: 8,
              background: 'var(--c-acc)', color: 'var(--c-acc-on, #061018)',
              border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >{n.cta.label} →</button>
        )}
        <button
          type="button"
          onClick={() => onAcknowledge?.(n.id)}
          className="sw-press"
          style={{
            padding: '6px 10px', borderRadius: 8,
            background: 'transparent', color: 'var(--c-text2)',
            border: '1px solid var(--c-border)', fontSize: 11, cursor: 'pointer',
          }}
        >{n.acknowledged_at ? 'Acknowledged' : 'Acknowledge'}</button>
        <button
          type="button"
          onClick={() => onSnooze?.(n.id)}
          className="sw-press"
          style={{
            padding: '6px 10px', borderRadius: 8,
            background: 'transparent', color: 'var(--c-text2)',
            border: '1px solid var(--c-border)', fontSize: 11, cursor: 'pointer',
          }}
        >Snooze 7d</button>
        {canDismiss && (
          <button
            type="button"
            onClick={() => onDismiss?.(n.id)}
            aria-label="Dismiss notification"
            className="sw-press"
            aria-label="Dismiss notification"
            style={{
              marginLeft: 'auto',
              padding: '4px 8px', borderRadius: 8,
              background: 'transparent', color: 'var(--c-text3)',
              border: '1px solid var(--c-border)', fontSize: 12, cursor: 'pointer',
            }}
          >×</button>
        )}
      </div>
    </div>
  )
}

export default function NotificationCentre({ entity, onBack, onNavigate }) {
  const all = useMemo(() => deriveNotifications(entity || {}), [entity])

  // local UI state (acknowledge / dismiss / snooze / collapse expansion)
  const [acks,      setAcks]      = useState({})  // id → ISO string
  const [dismissed, setDismissed] = useState({})  // id → true
  const [snoozed,   setSnoozed]   = useState({})  // id → expiry ms
  const [expanded,  setExpanded]  = useState({})  // type → bool

  const now = Date.now()
  const visible = all
    .filter(n => !dismissed[n.id])
    .filter(n => !(snoozed[n.id] && snoozed[n.id] > now))
    .map(n => ({ ...n, acknowledged_at: acks[n.id] || null }))

  // Group by type for anti-nagger collapse (≥2 of same type collapses).
  const byType = visible.reduce((acc, n) => {
    (acc[n.type] = acc[n.type] || []).push(n)
    return acc
  }, {})

  const orderedTypes = Object.keys(byType).sort((a, b) => {
    // RED first, then AMBER, then GREEN, then GREY
    const order = { RED: 0, AMBER: 1, GREEN: 2, GREY: 3 }
    return (order[NC_TYPES[a]?.tone] ?? 9) - (order[NC_TYPES[b]?.tone] ?? 9)
  })

  const handleAck     = (id) => setAcks(p => ({ ...p, [id]: new Date().toISOString() }))
  const handleDismiss = (id) => setDismissed(p => ({ ...p, [id]: true }))
  const handleSnooze  = (id) => setSnoozed(p => ({ ...p, [id]: Date.now() + 7 * 86_400_000 }))

  return (
    <div className="screen" style={{ padding: '16px 16px 120px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        {onBack && (
          <button onClick={onBack} className="sw-press" style={{
            padding: '4px 10px', borderRadius: 8,
            background: 'var(--c-surface2)', border: '1px solid var(--c-border)',
            color: 'var(--c-text2)', fontSize: 13, cursor: 'pointer',
          }}>← Home</button>
        )}
        <div style={{ flex: 1 }}>
          <div className="sw-eyebrow">Notifications</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--c-text)', marginTop: 2 }}>
            What you'll want to know
          </div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--c-text2)', marginBottom: 16, lineHeight: 1.55 }}>
        Notifications are state changes worth surfacing — separate from your priority
        actions. Whisper-quiet by default; tap a row to act.
      </div>

      {visible.length === 0 && (
        <div style={{
          padding: '24px 16px', textAlign: 'center', borderRadius: 12,
          border: '1px dashed var(--c-border)', color: 'var(--c-text3)', fontSize: 13,
        }}>
          You're all caught up.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {orderedTypes.map(type => {
          const group     = byType[type]
          const def       = NC_TYPES[type] || { label: type, tone: 'GREY' }
          const collapsed = group.length >= 2 && !expanded[type]

          if (collapsed) {
            // Show first row + "N more" chip-style summary.
            const first = group[0]
            return (
              <div key={type} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <NotifCard
                  n={first}
                  onNavigate={onNavigate}
                  onAcknowledge={handleAck}
                  onSnooze={handleSnooze}
                  onDismiss={handleDismiss}
                />
                <button
                  type="button"
                  onClick={() => setExpanded(p => ({ ...p, [type]: true }))}
                  className="sw-press"
                  style={{
                    alignSelf: 'flex-start',
                    padding: '6px 10px', borderRadius: 8,
                    background: 'var(--c-surface2)', color: 'var(--c-text2)',
                    border: '1px solid var(--c-border)', fontSize: 12, cursor: 'pointer',
                  }}
                >
                  {group.length - 1} more {def.label.toLowerCase()} notification{group.length - 1 === 1 ? '' : 's'} ▾
                </button>
              </div>
            )
          }

          return (
            <div key={type} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {group.map(n => (
                <NotifCard
                  key={n.id}
                  n={n}
                  onNavigate={onNavigate}
                  onAcknowledge={handleAck}
                  onSnooze={handleSnooze}
                  onDismiss={handleDismiss}
                />
              ))}
              {group.length >= 2 && (
                <button
                  type="button"
                  onClick={() => setExpanded(p => ({ ...p, [type]: false }))}
                  className="sw-press"
                  style={{
                    alignSelf: 'flex-start',
                    padding: '4px 8px', borderRadius: 8,
                    background: 'transparent', color: 'var(--c-text3)',
                    border: '1px solid var(--c-border)', fontSize: 11, cursor: 'pointer',
                  }}
                >Collapse ▴</button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
