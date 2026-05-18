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
        </div>
      </div>
    </aside>
  )
}
