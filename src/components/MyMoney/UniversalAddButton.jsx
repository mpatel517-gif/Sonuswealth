// ─────────────────────────────────────────────────────────────────────────────
// UniversalAddButton — floating "+" that opens the canonical bucket-flow
// AddItemSheet directly. Previously had its own intermediate 6-type picker
// (with stale "Forms are coming in Phase 2" copy) sitting in front of the
// real 10-category bucket flow — that was redundant + misleading. Cut.
// ─────────────────────────────────────────────────────────────────────────────

export default function UniversalAddButton({ onSelect }) {
  return (
    <button
      onClick={() => onSelect?.()}
      aria-label="Add asset"
      className="sw-press"
      style={{
        position: 'fixed', bottom: 96, right: 18,
        width: 56, height: 56, borderRadius: '50%',
        background: 'var(--c-acc)', color: 'var(--c-bg, #0B1F3A)',
        border: 'none', cursor: 'pointer',
        fontSize: 28, fontWeight: 700,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4), 0 0 18px color-mix(in srgb, var(--c-acc) 40%, transparent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 50,
      }}
    >
      +
    </button>
  )
}
