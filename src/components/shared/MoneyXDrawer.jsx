// ─────────────────────────────────────────────────────────────────────────────
// MoneyXDrawer — 8-chip cross-screen nav (founder direction 2026-05-28).
//
// "Every screen should be organised the same way." This component is the
// canonical drawer that lives at the top of every MoneyX-family screen:
//   Balance Sheet · Income Statement · Cashflow · Tax & Allowances ·
//   Protection & Insurance · Business · Trusts & Estate · Cost of inaction.
//
// Originally extracted from MyMoney.jsx §3358 and Cashflow.jsx
// CashflowSectionDrawer — both inline versions are now thin wrappers around
// this. Adding the drawer to TaxEstate / Risk / Timeline is a one-line
// import + render.
//
// Director-gated chip (Business) and trust-gated chip (Trusts & Estate) hide
// when the persona has no data in those domains, matching MyMoney's predicate
// so the chip set is consistent across screens.
//
// Active chip is determined by the `activeRoute` prop (matches the Dashboard
// tab id: 'money' | 'money/income' | 'flow' | 'tax' | 'money/protection' |
// 'money/business' | 'trusts' | 'decisions'). Inactive chips call onNav(route).
// Tapping the active chip scrolls to top instead of re-navigating.
// ─────────────────────────────────────────────────────────────────────────────

export default function MoneyXDrawer({ entity, activeRoute, onNav }) {
  const entityData = entity || {}
  const hasBusiness = !!(entityData.hasBusiness
    || (entityData.assets?.business_assets || []).length > 0
    || entityData.persona?.flags?.includes('director'))
  const hasTrustOrEstate = !!(entityData.hasTrust
    || entityData.estate?.will
    || entityData.estate?.lpa
    || entityData.assets?.protection?.lifeInsurance?.inTrust)

  const sections = [
    { id: 'mm-balance',    label: 'Balance Sheet',          always: true,             route: 'money'            },
    { id: 'mm-income',     label: 'Income Statement',       always: true,             route: 'money/income'     },
    { id: 'mm-flow',       label: 'Cashflow',               always: true,             route: 'flow'             },
    { id: 'mm-tax',        label: 'Tax & Allowances',       always: true,             route: 'tax'              },
    { id: 'mm-insurance',  label: 'Protection & Insurance', always: true,             route: 'money/protection' },
    { id: 'mm-business',   label: 'Business',               always: hasBusiness,      route: 'money/business'   },
    { id: 'mm-trusts',     label: 'Trusts & Estate',        always: hasTrustOrEstate, route: 'trusts'           },
    { id: 'mm-decisions',  label: 'Cost of inaction',       always: true,             route: 'decisions'        },
  ].filter(s => s.always)

  return (
    <nav
      aria-label="Money sections"
      style={{
        position: 'sticky', top: 0, zIndex: 40,
        margin: '0 -16px 8px', padding: '8px 16px',
        background: 'color-mix(in srgb, var(--c-bg) 92%, transparent)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderBottom: '1px solid color-mix(in srgb, var(--c-border) 60%, transparent)',
        display: 'flex', gap: 6, overflowX: 'auto',
        scrollbarWidth: 'none',
      }}
    >
      {sections.map(s => {
        const isActive = s.route === activeRoute
        const baseBg = isActive
          ? 'color-mix(in srgb, var(--c-acc) 18%, var(--c-surface2))'
          : 'var(--c-surface2)'
        const baseColor = isActive ? 'var(--c-acc)' : 'var(--c-text2)'
        const baseBorder = isActive
          ? 'color-mix(in srgb, var(--c-acc) 55%, var(--c-border))'
          : 'var(--c-border)'
        return (
          <button
            key={s.id}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            onClick={() => {
              if (isActive) {
                window.scrollTo({ top: 0, behavior: 'smooth' })
                return
              }
              if (typeof onNav === 'function') onNav(s.route)
            }}
            style={{
              flexShrink: 0,
              padding: '6px 12px',
              fontSize: 11, fontWeight: isActive ? 700 : 600,
              background: baseBg,
              border: `1px solid ${baseBorder}`,
              borderRadius: 999,
              color: baseColor,
              cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s, border-color 0.15s',
              minHeight: 32,
            }}
            onMouseEnter={e => { if (!isActive) {
              e.currentTarget.style.background = 'color-mix(in srgb, var(--c-acc) 12%, var(--c-surface2))'
              e.currentTarget.style.color = 'var(--c-acc)'
              e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--c-acc) 35%, var(--c-border))'
            }}}
            onMouseLeave={e => { if (!isActive) {
              e.currentTarget.style.background = baseBg
              e.currentTarget.style.color = baseColor
              e.currentTarget.style.borderColor = baseBorder
            }}}
          >
            {s.label}
          </button>
        )
      })}
    </nav>
  )
}
