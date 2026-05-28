// ─────────────────────────────────────────────────────────────────────────────
// MoneyProtection.jsx — full-page Protection & Insurance view
//
// Route: /money/protection (Dashboard tab id 'money/protection').
// Reached from MyMoney section-nav chip "Protection & Insurance".
//
// Architecture: ProtectionDrillDown already renders the full per-policy panel
// (Domain J/K/L) — cover summary, in-trust flag, life-cover gap, IHT exposure,
// claims context. It's wrapped in OverlayShell. For a "full page" experience
// inside the Dashboard tab area, OverlayShell behaves as a full-screen panel
// which is exactly what we want.
//
// We pass onBack so the chip in MyMoney can return to the Balance Sheet view.
// FCA boundary preserved by ProtectionDrillDown — information / guidance only.
// ─────────────────────────────────────────────────────────────────────────────
import ProtectionDrillDown from '../components/MyMoney/ProtectionDrillDown.jsx'

export default function MoneyProtection({ entity, personaId, onBack, onHome }) {
  return (
    <ProtectionDrillDown
      entity={entity}
      personaId={personaId}
      onBack={onBack}
      onHome={onHome}
    />
  )
}
