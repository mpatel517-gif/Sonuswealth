// ─────────────────────────────────────────────────────────────────────────────
// PanelPreviewGallery — preview surface for L3-2 Tier-A panels.
//
// Mounted by App.jsx when ?panel=income|wrappers|state-pension is in the URL.
// Gives a snap-verifiable preview of each panel against a real persona
// without requiring the panel to be wired into a production drill yet.
//
// This satisfies DoD §B Gate 1 (MCP snap evidence at 3 viewports × 2 themes)
// before the panel is wired into a permanent drill route in a follow-up
// commit. Once production wiring lands, this gallery can be removed or
// kept as a dev-mode preview surface.
//
// URL params:
//   ?panel=income          → IncomeSourcesPanel
//   ?panel=wrappers        → WrappersPanel
//   ?panel=state-pension   → StatePensionPanel
//   ?panel=tier-a          → all three stacked vertically (single snap to
//                            verify L3Panel composition consistency)
// ─────────────────────────────────────────────────────────────────────────────

import { IncomeSourcesPanel } from './IncomeSourcesPanel.jsx'
import { WrappersPanel } from './WrappersPanel.jsx'
import { StatePensionPanel } from './StatePensionPanel.jsx'
import { TaxObligationsPanel } from './TaxObligationsPanel.jsx'
import { IHTEstatePanel } from './IHTEstatePanel.jsx'
import { TrustsPanel } from './TrustsPanel.jsx'
import { DirectorCompPanel } from './DirectorCompPanel.jsx'
import { BTLPortfolioPanel } from './BTLPortfolioPanel.jsx'
import { FlexiDrawdownPanel } from './FlexiDrawdownPanel.jsx'
import { DCvsDBPanel } from './DCvsDBPanel.jsx'
import { DecumulationPanel } from './DecumulationPanel.jsx'
import { DrillStackProvider } from '../DrillStack.jsx'
import { TrajectoryBar } from '../TrajectoryBar.jsx'
import { useEvents, EV } from '../../../../state/events.jsx'

const PANELS = {
  // Tier A
  income:           { component: IncomeSourcesPanel, label: 'Income sources' },
  wrappers:         { component: WrappersPanel,      label: 'Wrappers' },
  'state-pension':  { component: StatePensionPanel,  label: 'State pension' },
  // Tier B
  'tax-obligations': { component: TaxObligationsPanel, label: 'Tax obligations' },
  'iht-estate':      { component: IHTEstatePanel,      label: 'IHT & estate' },
  trusts:            { component: TrustsPanel,         label: 'Trusts' },
  // Tier C
  'director-comp':   { component: DirectorCompPanel,   label: 'Director comp' },
  'btl-portfolio':   { component: BTLPortfolioPanel,   label: 'BTL portfolio' },
  'flexi-drawdown':  { component: FlexiDrawdownPanel,  label: 'Flexi-drawdown' },
  'dc-vs-db':        { component: DCvsDBPanel,         label: 'DC vs DB' },
  decumulation:      { component: DecumulationPanel,   label: 'Decumulation' },
}

function PanelHeader({ label, persona }) {
  return (
    <div
      data-preview-header=""
      style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--c-border, rgba(255,255,255,0.1))',
        background: 'var(--c-surface, rgba(255,255,255,0.02))',
      }}
    >
      <div style={{ fontSize: 8, opacity: 0.55, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        L3-2 Tier-A · Code-only preview
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)', marginTop: 2 }}>
        {label}
      </div>
      {persona && (
        <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 2 }}>
          Persona: {persona}
        </div>
      )}
    </div>
  )
}

/**
 * Top-level gallery shell. Reads ?panel= and mounts the right panel
 * with the effective entity passed by App.jsx.
 *
 * @param {{ entity: object, panel: string, personaId?: string, onBack?: () => void }} props
 */
export function PanelPreviewGallery({ entity, panel, personaId, onBack }) {
  const personaName = entity?.name || entity?.individual?.name || '(unknown)'
  const { commit } = useEvents()

  // Leaf-edit commit handler — turns the L4 edit form's payload into an
  // ASSET_FIELD_CORRECTED event against the current persona. App.jsx folds
  // committed events back into the effective entity, so the corrected value
  // is reflected when the user pops back to the L3 panel.
  const handleEdit = (payload) => {
    if (!personaId) return
    commit(personaId, { type: EV.ASSET_FIELD_CORRECTED, payload })
  }

  // Single-panel mode
  if (PANELS[panel]) {
    const { component: Panel, label } = PANELS[panel]
    return (
      <div
        data-preview-gallery={panel}
        style={{
          minHeight: '100vh',
          background: 'var(--c-bg, #0a0e14)',
          color: 'var(--c-text, #fff)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <PanelHeader label={label} persona={personaName} />
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            style={{
              alignSelf: 'flex-start',
              margin: '8px 14px',
              padding: '4px 10px',
              fontSize: 11,
              background: 'transparent',
              color: 'var(--c-text2)',
              border: '1px solid var(--c-border, rgba(255,255,255,0.15))',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            ← Back
          </button>
        )}
        {/* DrillStackProvider so any DrillableNumber inside the panel opens an
            L4 panel on top via the shared stack. */}
        <DrillStackProvider onEdit={handleEdit}>
          <div style={{ padding: 12 }}>
            <Panel entity={entity} />
          </div>
        </DrillStackProvider>
      </div>
    )
  }

  // Stacked all-three mode for cross-panel composition verification
  if (panel === 'tier-a') {
    return (
      <div
        data-preview-gallery="tier-a"
        style={{
          minHeight: '100vh',
          background: 'var(--c-bg, #0a0e14)',
          color: 'var(--c-text, #fff)',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          paddingBottom: 40,
        }}
      >
        <PanelHeader label="Tier A — all three" persona={personaName} />
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            style={{
              alignSelf: 'flex-start',
              margin: '8px 14px',
              padding: '4px 10px',
              fontSize: 11,
              background: 'transparent',
              color: 'var(--c-text2)',
              border: '1px solid var(--c-border, rgba(255,255,255,0.15))',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            ← Back
          </button>
        )}
        <DrillStackProvider onEdit={handleEdit}>
          <div style={{ padding: '0 12px' }}>
            <div data-tier-section="income"        style={{ marginBottom: 24 }}>
              <PanelHeader label="Income sources" persona={null} />
              <IncomeSourcesPanel entity={entity} />
            </div>
            <div data-tier-section="wrappers"      style={{ marginBottom: 24 }}>
              <PanelHeader label="Wrappers" persona={null} />
              <WrappersPanel entity={entity} />
            </div>
            <div data-tier-section="state-pension">
              <PanelHeader label="State pension" persona={null} />
              <StatePensionPanel entity={entity} />
            </div>
          </div>
        </DrillStackProvider>
      </div>
    )
  }

  // Scratch preview for the TrajectoryBar primitive (#18 1c snap gate).
  if (panel === 'trajectory') {
    const rows = [
      { label: 'Vanguard SIPP (grows)',    now: 420000, future: 612000, plan: 680000, direction: 'grow' },
      { label: 'BTL property (grows)',     now: 350000, future: 470000, plan: 470000, direction: 'grow' },
      { label: 'Current account (flat)',   now: 18000,  future: 18500,  plan: 18500,  direction: 'grow' },
      { label: 'Mortgage (pays down)',     now: 240000, future: 180000, plan: 120000, direction: 'shrink' },
      { label: 'State pension (switches on)', now: 0,    future: 12548,  plan: 12548,  direction: 'grow' },
    ]
    return (
      <div data-preview-gallery="trajectory" style={{ minHeight: '100vh', background: 'var(--c-bg,#0a0e14)', color: 'var(--c-text,#fff)', padding: 16 }}>
        <PanelHeader label="TrajectoryBar — grow / flat / shrink / switch-on" persona={null} />
        {['actual', 'forecast', 'plan'].map(mode => (
          <div key={mode} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6, margin: '8px 0' }}>
              Active lens: {mode}
            </div>
            {rows.map(r => (
              <div key={r.label} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--c-text2)', marginBottom: 2 }}>{r.label}</div>
                <TrajectoryBar {...r} activeMode={mode} horizonLabel="age 67" onExpand={() => {}} />
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  // Unknown panel — list the options
  return (
    <div
      data-preview-gallery="invalid"
      style={{
        minHeight: '100vh',
        background: 'var(--c-bg, #0a0e14)',
        color: 'var(--c-text)',
        padding: 24,
      }}
    >
      <h2 style={{ fontSize: 16 }}>Unknown ?panel value: {String(panel)}</h2>
      <p style={{ fontSize: 12, color: 'var(--c-text3)' }}>
        Try one of:
      </p>
      <ul style={{ fontSize: 12 }}>
        <li><code>?panel=income</code></li>
        <li><code>?panel=wrappers</code></li>
        <li><code>?panel=state-pension</code></li>
        <li><code>?panel=tier-a</code> (all three stacked)</li>
      </ul>
    </div>
  )
}
