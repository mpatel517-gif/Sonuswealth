// ─────────────────────────────────────────────────────────────────────────────
// Sidebar — desktop-only navigation rail. Renders at ≥1024px viewports via
// the CSS class `.sw-sidebar` (hidden via @media at <1024px in design-tokens).
//
// Visual contract:
//   · Logo at top (same mark + wordmark as Dashboard header)
//   · 6 primary nav items, each with icon + label, active state with accent
//     vertical bar + glass background
//   · "Schedule Review" CTA pinned mid-rail
//   · Avatar + persona switcher at bottom
//
// Phase 2 Batch B.5 — responsive shell. Mobile keeps bottom-tab nav.
// ─────────────────────────────────────────────────────────────────────────────

const NAV = [
  { id: 'home',  label: 'Overview',    icon: '⌂' },
  { id: 'money', label: 'My Money',    icon: '◈' },
  { id: 'flow',  label: 'Cashflow',    icon: '≋' },
  { id: 'tax',   label: 'Tax & Estate', icon: '⚖' },
  { id: 'risk',  label: 'Risk',        icon: '◉' },
  { id: 'timeline',  label: 'Timeline',    icon: '◷' },
]

export default function Sidebar({
  tab, onTabChange, persona, entity, onScheduleReview, onAvatarClick,
}) {
  const initials = (entity?.displayName || entity?.name || 'BW')
    .split(/[\s&]/).filter(Boolean).slice(0, 2)
    .map(s => s[0]).join('').toUpperCase()

  return (
    <aside className="sw-sidebar">
      {/* Brand mark */}
      <div className="sw-sidebar-brand">
        <div className="sw-sidebar-logo">
          <img src="/assets/logo/logo-app-icon.png" width={32} height={32} alt="Sonuswealth" style={{ borderRadius: 8, display: 'block' }} />
        </div>
        <div>
          <div className="sw-sidebar-name">Sonuswealth</div>
          <div className="sw-sidebar-tagline">Premium Management</div>
        </div>
      </div>

      {/* Primary nav */}
      <nav className="sw-sidebar-nav" aria-label="Primary navigation">
        {NAV.map(n => {
          const active = tab === n.id
          return (
            <button
              key={n.id}
              onClick={() => onTabChange?.(n.id)}
              className={`sw-sidebar-item ${active ? 'sw-sidebar-item-active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <span className="sw-sidebar-icon">{n.icon}</span>
              <span className="sw-sidebar-label">{n.label}</span>
              {active && <span className="sw-sidebar-active-bar" />}
            </button>
          )
        })}
      </nav>

      {/* CTA */}
      <button onClick={onScheduleReview} className="sw-sidebar-cta">
        Schedule Review
      </button>

      {/* Avatar footer */}
      <div className="sw-sidebar-footer">
        <button onClick={onAvatarClick} className="sw-sidebar-avatar"
          aria-label="Switch persona">
          {initials}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sw-sidebar-avatar-name">{entity?.displayName || entity?.name || 'Persona'}</div>
          <div className="sw-sidebar-avatar-sub">Switch · {persona}</div>
          {/* Dev-mode identity badge — proves persona token resolves to the
              correct fixture. Flags red when entity.id doesn't square with
              the persona token. Catches the bug class that hid the broken
              `mrt: personaA` routing for months. */}
          {import.meta.env.DEV && entity?.id && (() => {
            // Normalise both sides: lowercase + strip `-primary` suffix from
            // fixture ids (mrT-landlord-primary → mrt-landlord). Match if:
            //   1. Exact equality after normalisation
            //   2. fixture id starts with token (mrt-landlord matches mrT-landlord-primary)
            //   3. mrt-core token aliases to the `mrt` fixture id (mrT-core uses {"id":"mrt"})
            //   4. Anna Finch snapshots (f-22, f-25, …) — id field varies per snapshot
            //   5. real-user runtime persona (built from onboarding)
            const idLow  = (entity.id || '').toLowerCase().replace(/-primary$/, '')
            const tokLow = (persona   || '').toLowerCase()
            const idMatch = idLow === tokLow
              || idLow.startsWith(tokLow + '-')
              || (tokLow === 'mrt-core' && idLow === 'mrt')
              || tokLow.startsWith('f-')
              || tokLow === 'real-user'
            return (
              <div
                data-testid="entity-identity-badge"
                data-entity-id={entity.id}
                data-persona-token={persona}
                style={{
                  fontSize: 10, marginTop: 4,
                  padding: '2px 6px', borderRadius: 4,
                  background: idMatch ? 'rgba(0,229,168,0.15)' : 'rgba(255,69,58,0.25)',
                  color:      idMatch ? '#00E5A8'              : '#FF453A',
                  border:    `1px solid ${idMatch ? '#00E5A8' : '#FF453A'}`,
                  fontFamily: 'monospace',
                }}
                title={idMatch ? 'entity.id matches persona token' : 'MISMATCH: persona token does not resolve to this entity.id'}
              >
                {idMatch ? '✓' : '⚠'} {entity.id}
                {entity.age != null && ` · ${entity.age}`}
              </div>
            )
          })()}
        </div>
      </div>
    </aside>
  )
}
