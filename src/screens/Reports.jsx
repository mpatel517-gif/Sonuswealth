// src/screens/Reports.jsx — SP-1: the live Reports viewer (was a Phase-3 stub).
// Export name preserved so Dashboard's More-sheet wiring holds. The viewer is
// tab-aware; the More-sheet entry passes activeTab so it defaults to the right
// statement. Spec: 2026-06-09-reports-SP-1-framework-and-statements-spec.md.
import ReportsViewer from './ReportsViewer.jsx'

export default function Reports({ entity, personaId, onBack, onHome, activeTab, onCommit }) {
  return (
    <ReportsViewer
      entity={entity}
      personaId={personaId}
      onBack={onBack}
      onHome={onHome}
      activeTab={activeTab}
      onCommit={onCommit}
    />
  )
}
