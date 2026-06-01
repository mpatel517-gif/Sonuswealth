// ─────────────────────────────────────────────────────────────────────────────
// L3PanelHost — production mount for any L3-2 topic panel.
//
// The 11 L3-2 panels (Income, Wrappers, IHT/Estate, Trusts, Drawdown, …) were
// built and snap-verified in PanelPreviewGallery (?panel=) but had no production
// home. This host is the ONE reusable way to open any of them as a real drill
// from any screen: it supplies the OverlayShell chrome + the DrillStackProvider
// (so every DrillableNumber inside opens its L4 leaf) + the edit-commit handler
// (so leaf corrections fold back via ASSET_FIELD_CORRECTED).
//
// Usage:
//   const [open, setOpen] = useState(false)
//   {open && (
//     <L3PanelHost title="Income sources" personaId={personaId}
//                  onClose={() => setOpen(false)}>
//       <IncomeSourcesPanel entity={entity} />
//     </L3PanelHost>
//   )}
// ─────────────────────────────────────────────────────────────────────────────

import OverlayShell from '../../shared/OverlayShell.jsx'
import { DrillStackProvider } from './DrillStack.jsx'
import { useEvents, EV } from '../../../state/events.jsx'

/**
 * @param {{
 *   title: string,
 *   subtitle?: string,
 *   personaId?: string,
 *   onClose: () => void,
 *   onHome?: () => void,
 *   children: React.ReactNode,   // the L3-2 panel element, already passed `entity`
 * }} props
 */
export function L3PanelHost({ title, subtitle, personaId, onClose, onHome, children }) {
  const { commit } = useEvents()

  // Leaf-edit → ASSET_FIELD_CORRECTED against the live persona (same contract the
  // preview gallery used). App folds it back into the effective entity.
  const handleEdit = (payload) => {
    if (!personaId) return
    commit(personaId, { type: EV.ASSET_FIELD_CORRECTED, payload })
  }

  // DrillStackProvider is the OUTER wrapper (its DrillStack is position:fixed and
  // would otherwise paint over the OverlayShell header). OverlayShell sits INSIDE
  // it as the base layer — same nesting the category drills use — so the
  // ← Back / ⌂ Home chrome is always visible. Founder 2026-06-01: "wherever you
  // go you must be able to get back."
  return (
    <DrillStackProvider onEdit={handleEdit}>
      <OverlayShell title={title} subtitle={subtitle} onBack={onClose} onHome={onHome}>
        <div style={{ padding: 12 }}>
          {children}
        </div>
      </OverlayShell>
    </DrillStackProvider>
  )
}
