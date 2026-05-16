// ─────────────────────────────────────────────────────────────────────────────
// AssetDetailOverlay — L3 per-asset detail view (task #3).
//
// Tapping an individual row inside a drilldown opens this overlay. Shows:
//   · Hero: asset name + value + wrapper badge
//   · Tax treatment block (asset-specific, via TaxTreatmentBlock)
//   · Provenance — last updated + source (manual / parsed / synced)
//   · Update-value affordance — commits ASSET_VALUE_UPDATED via useEvents()
//   · Extra metadata (provider, type, identifier) when present on the asset
//
// Renders nested inside the parent drilldown's OverlayShell. Back / Escape
// pops just this overlay; Home returns to MyMoney.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import OverlayShell from '../shared/OverlayShell.jsx'
import TaxTreatmentBlock from './TaxTreatmentBlock.jsx'
import { getWrapper } from '../../engine/_helpers.js'
import { useEvents, EV } from '../../state/events.jsx'

function fmt(v) {
  const n = Math.round(+v || 0)
  const abs = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  if (abs >= 1_000_000) return `${sign}£${(abs / 1_000_000).toFixed(2)}m`
  if (abs >= 1_000)     return `${sign}£${(abs / 1_000).toFixed(0)}k`
  return `${sign}£${abs.toLocaleString()}`
}

const WRAPPER_TONE = {
  ISA: 'sw-chip-mint', CASH: 'sw-chip-mint',
  PENSION: 'sw-chip-blue', STATE: 'sw-chip-blue',
  GIA: 'sw-chip-violet', EIS: 'sw-chip-violet', SEIS: 'sw-chip-violet', VCT: 'sw-chip-violet', TRUST: 'sw-chip-violet',
  BOND_ON: 'sw-chip-amber', BOND_OFF: 'sw-chip-amber', PROPERTY: 'sw-chip-amber',
  UNKNOWN: 'sw-chip-warn',
}

const WRAPPER_LABEL = {
  ISA: 'ISA · tax-free wrapper',
  GIA: 'General investment account · taxed',
  EIS: 'Enterprise Investment Scheme · 30% income tax relief',
  SEIS: 'Seed EIS · 50% income tax relief',
  VCT: 'Venture Capital Trust · 30% income tax relief',
  PENSION: 'Pension · tax-relief on contributions',
  CASH: 'Cash · personal savings allowance applies',
  PROPERTY: 'Property · CGT on disposal',
  BOND_ON: 'Onshore investment bond',
  BOND_OFF: 'Offshore investment bond',
  TRUST: 'Trust wrapper',
  STATE: 'State pension',
  UNKNOWN: 'Wrapper not set',
}

function assetValue(asset) {
  return +(asset?.value || asset?.value_gbp || asset?.balance || asset?.outstanding || asset?.outstanding_balance || 0)
}

function provenanceLabel(asset) {
  const src = asset?.source || asset?.provenance || 'manual'
  const date = asset?.last_updated || asset?.last_synced || asset?.captured_at
  const map = {
    manual: 'Manually entered',
    parsed: 'Parsed from document',
    synced: 'Synced from provider',
    'open-banking': 'Open Banking',
  }
  const label = map[src] || `Source: ${src}`
  if (!date) return label
  try {
    const d = new Date(date)
    if (!isNaN(d.getTime())) return `${label} · ${d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })}`
  } catch { /* ignore */ }
  return label
}

export default function AssetDetailOverlay({
  asset,
  domain,           // 'investments' | 'property' | 'liabilities' | 'business' | 'protection'
  category,         // taxonomy category id for the event payload (e.g. 'investments')
  itemType,         // taxonomy item id (e.g. 'isa_stocks_and_shares')
  personaId,        // active persona id — needed for commit()
  onBack,
  onHome,
}) {
  const { commit } = useEvents()
  const wrapper = getWrapper(asset)
  const value = assetValue(asset)
  const [newValue, setNewValue] = useState(value)
  const [editing, setEditing] = useState(false)
  const [updated, setUpdated] = useState(false)

  function saveValue() {
    if (+newValue === +value) { setEditing(false); return }
    commit(personaId, {
      type: EV.ASSET_VALUE_UPDATED,
      payload: {
        id: asset?.id,
        category: category || domain,
        itemType: itemType || asset?.type,
        fields: { value: +newValue },
        source: 'manual',
        confidence: 1,
      },
      timestamp: new Date().toISOString(),
    })
    setUpdated(true)
    setEditing(false)
  }

  const chipClass = WRAPPER_TONE[wrapper] || 'sw-chip-violet'
  const wrapperText = WRAPPER_LABEL[wrapper] || wrapper

  return (
    <OverlayShell
      title={asset?.name || asset?.provider || asset?.type || 'Asset'}
      subtitle={domain ? domain.charAt(0).toUpperCase() + domain.slice(1) : null}
      onBack={onBack}
      onHome={onHome}
    >
      <div style={{ padding: '18px 18px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <div style={{
          background: 'var(--c-surface)', border: '1px solid var(--c-border)',
          borderRadius: 18, padding: '18px 18px 20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span className={`sw-chip sw-chip-sm ${chipClass}`} style={{ fontWeight: 700, letterSpacing: 0.4 }}>
              {wrapper === 'UNKNOWN' ? 'WRAPPER?' : wrapper.replace('_', ' ')}
            </span>
            {asset?.provider && (
              <span style={{ fontSize: 11, color: 'var(--c-text3)' }}>{asset.provider}</span>
            )}
          </div>
          <div style={{
            fontSize: 32, fontWeight: 800, color: 'var(--c-text)',
            fontVariantNumeric: 'tabular-nums', lineHeight: 1.1,
          }}>
            {fmt(value)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--c-text3)', marginTop: 6 }}>
            {wrapperText}
          </div>
          {!editing ? (
            <button
              type="button"
              onClick={() => { setNewValue(value); setEditing(true); setUpdated(false) }}
              className="sw-press"
              style={{
                marginTop: 12, padding: '8px 14px', borderRadius: 10,
                border: '1px solid var(--c-border)', background: 'var(--c-surface2)',
                color: 'var(--c-text)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Update value
            </button>
          ) : (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--c-text3)' }}>£</span>
              <input
                type="number"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                style={{
                  flex: 1, minWidth: 0,
                  background: 'var(--c-surface2)', border: '1px solid var(--c-border)',
                  borderRadius: 8, padding: '8px 10px',
                  color: 'var(--c-text)', fontSize: 14, fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                }}
              />
              <button
                type="button" onClick={saveValue} className="sw-press"
                style={{
                  padding: '8px 14px', borderRadius: 10, border: 'none',
                  background: 'var(--c-acc)', color: 'var(--c-bg, #0B1F3A)',
                  fontSize: 12, fontWeight: 800, cursor: 'pointer',
                }}
              >Save</button>
              <button
                type="button" onClick={() => setEditing(false)}
                style={{
                  padding: '8px 10px', borderRadius: 10, border: 'none',
                  background: 'transparent', color: 'var(--c-text3)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >Cancel</button>
            </div>
          )}
          {updated && (
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--c-acc)' }}>
              ✓ Value updated · logged to the event store
            </div>
          )}
        </div>

        {/* ── Tax treatment ────────────────────────────────────────────── */}
        <div>
          <div style={{
            fontSize: 11, fontWeight: 800, color: 'var(--c-text3)',
            letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8,
          }}>How this is taxed</div>
          <TaxTreatmentBlock asset={asset} wrapper={wrapper} compact />
        </div>

        {/* ── Provenance ───────────────────────────────────────────────── */}
        <div>
          <div style={{
            fontSize: 11, fontWeight: 800, color: 'var(--c-text3)',
            letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8,
          }}>Where this came from</div>
          <div style={{
            background: 'var(--c-surface)', border: '1px solid var(--c-border)',
            borderRadius: 12, padding: '10px 14px',
            fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.45,
          }}>
            {provenanceLabel(asset)}
          </div>
        </div>

        {/* ── Metadata, if any ─────────────────────────────────────────── */}
        {(asset?.type || asset?.isin || asset?.account_number || asset?.address || asset?.use) && (
          <div>
            <div style={{
              fontSize: 11, fontWeight: 800, color: 'var(--c-text3)',
              letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8,
            }}>Details</div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px',
              background: 'var(--c-surface)', border: '1px solid var(--c-border)',
              borderRadius: 12, padding: '12px 14px',
              fontSize: 12, color: 'var(--c-text2)',
            }}>
              {asset.type && (<><span style={{ color: 'var(--c-text3)' }}>Type</span><span>{asset.type}</span></>)}
              {asset.use && (<><span style={{ color: 'var(--c-text3)' }}>Use</span><span>{asset.use}</span></>)}
              {asset.isin && (<><span style={{ color: 'var(--c-text3)' }}>ISIN</span><span style={{ fontFamily: 'monospace' }}>{asset.isin}</span></>)}
              {asset.account_number && (<><span style={{ color: 'var(--c-text3)' }}>Account</span><span style={{ fontFamily: 'monospace' }}>{asset.account_number}</span></>)}
              {asset.address && (<><span style={{ color: 'var(--c-text3)' }}>Address</span><span>{asset.address}</span></>)}
              {asset.interest_rate != null && (<><span style={{ color: 'var(--c-text3)' }}>Rate</span><span>{(asset.interest_rate * 100).toFixed(2)}%</span></>)}
              {asset.maturity_date && (<><span style={{ color: 'var(--c-text3)' }}>Matures</span><span>{asset.maturity_date}</span></>)}
            </div>
          </div>
        )}

      </div>
    </OverlayShell>
  )
}
