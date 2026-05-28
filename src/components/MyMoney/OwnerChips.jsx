// ─────────────────────────────────────────────────────────────────────────────
// OwnerChips — multi-select owner-attribution chip row used in AddItemSheet
// and any other entry surface that needs household-attribution.
//
// Mirrors Voyant's "Mihir / Bindi / Keyan / Ryan" chip row at the top of every
// asset form: lets the user say who owns the asset (self / partner / dependants)
// without forcing a single dropdown.
//
// Reusable: takes `{ owners, selected, onChange }` — owners is a list of
// `{ id, name, color }` objects; selected is the array of chosen ids; onChange
// is invoked with the new array.
//
// `getHouseholdOwners(entity)` derives the list from the canonical persona
// shape (entity.individual / entity.partner / entity.dependants). Exported so
// AddItemSheet (and any future caller) can build the chip list from entity
// without duplicating the derivation rules.
// ─────────────────────────────────────────────────────────────────────────────

export function getHouseholdOwners(entity) {
  const out = []
  const me = entity?.individual?.name || entity?.name || 'You'
  out.push({ id: 'self', name: me, color: '#2DF2C3' })
  const partner = entity?.individual?.partner || entity?.partner || entity?.spouse
  if (partner) {
    out.push({ id: 'partner', name: partner.name || 'Partner', color: '#7AA7FF' })
  }
  const deps = entity?.individual?.dependants || entity?.dependants || []
  for (const d of deps) {
    out.push({
      id: d.id || `d-${d.name || 'dep'}`,
      name: d.name || 'Dependant',
      color: '#FFB347',
    })
  }
  return out
}

function initials(name) {
  if (!name) return '?'
  const parts = String(name).trim().split(/\s+/)
  return (parts[0]?.[0] || '?').toUpperCase() + (parts[1]?.[0]?.toUpperCase() || '')
}

export default function OwnerChips({ owners = [], selected = [], onChange }) {
  function toggle(id) {
    const isOn = selected.includes(id)
    const next = isOn ? selected.filter(x => x !== id) : [...selected, id]
    // Must always have at least one owner — block deselect of the last chip.
    if (next.length === 0) return
    onChange?.(next)
  }

  if (!owners.length) return null

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {owners.map(o => {
        const on = selected.includes(o.id)
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => toggle(o.id)}
            className="sw-pressable"
            aria-pressed={on}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 12px 6px 6px',
              borderRadius: 999,
              cursor: 'pointer',
              background: on
                ? `color-mix(in srgb, ${o.color} 16%, var(--c-surface2))`
                : 'var(--c-surface2)',
              border: on
                ? `1.5px solid ${o.color}`
                : '1px solid var(--c-border)',
              color: on ? 'var(--c-text)' : 'var(--c-text2)',
              fontSize: 12, fontWeight: 700,
              transition: 'background .15s, border-color .15s',
              boxShadow: on
                ? `0 0 0 3px color-mix(in srgb, ${o.color} 18%, transparent)`
                : 'none',
            }}
          >
            <span style={{
              width: 22, height: 22, borderRadius: '50%',
              background: o.color,
              color: '#0B1F3A',
              fontSize: 10, fontWeight: 900,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              letterSpacing: 0.4,
            }}>
              {initials(o.name)}
            </span>
            <span>{o.name}</span>
          </button>
        )
      })}
    </div>
  )
}
