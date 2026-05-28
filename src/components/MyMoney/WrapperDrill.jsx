// ─────────────────────────────────────────────────────────────────────────────
// WrapperDrill — L1→L2→L3 drill overlay opened when user taps a wrapper
// segment in the "How your money is held" composition bar.
//
// Hierarchy (per 2-Product-mymoney-v2_7 §157-160):
//   L1 — wrapper category (this drill's subject, e.g. "Pensions")
//   L2 — individual asset / item rows inside the wrapper
//   L3 — full per-asset panel (nested via AssetDetailOverlay)
//   L4 — number/chart drill (W0-T6/T7 primitives, opened from inside L3)
//
// Sections:
//   (a) Hero — wrapper name + total + 12-mo sparkline (est. badge if synth)
//   (b) Tax treatment — TaxTreatmentBlock at wrapper level
//   (c) L2 asset list — each row tappable → AssetDetailOverlay
//   (d) Concentration callout — only if wrapper ≥ 40% of net worth
//   (e) Filter affordance — optional link back to MyMoney filter behaviour
//   (f) Footer — BRAND.disclaimer (FCA info/guidance/storage stance)
//
// Founder principles: PP-3 drillability (every number drills), macOS pattern
// (simple surface, depth on tap), info/guidance/storage (no advice phrasing
// in concentration callout — just informational).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import OverlayShell from '../shared/OverlayShell.jsx'
import TaxTreatmentBlock from './TaxTreatmentBlock.jsx'
import AssetDetailOverlay from './AssetDetailOverlay.jsx'
import { BRAND } from '../../config/brand.js'

const WRAPPER_LABEL = {
  PENSION:  'Pensions',
  ISA:      'ISA',
  GIA:      'GIA',
  CASH:     'Cash',
  PROPERTY: 'Property',
  EIS:      'EIS',
  SEIS:     'SEIS',
  VCT:      'VCT',
  TRUST:    'Trust',
  BOND_ON:  'Onshore bond',
  BOND_OFF: 'Offshore bond',
  STATE:    'State pension',
  UNKNOWN:  'Wrapper unresolved',
}

const WRAPPER_PALETTE = {
  PENSION:  '#7AA7FF',
  ISA:      '#2DF2C3',
  GIA:      '#C58CFF',
  BOND_ON:  '#FFB347',
  BOND_OFF: '#FF9500',
  EIS:      '#FF598C',
  SEIS:     '#FF6B6B',
  VCT:      '#E77BFF',
  TRUST:    '#BDA5FF',
  CASH:     '#34C759',
  PROPERTY: '#FF9F0A',
  STATE:    '#8FA8C8',
  UNKNOWN:  '#9CA3AF',
}

function fmt(v) {
  const n = Math.round(+v || 0)
  const abs = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  if (abs >= 1_000_000) return `${sign}£${(abs / 1_000_000).toFixed(2)}m`
  if (abs >= 1_000)     return `${sign}£${(abs / 1_000).toFixed(0)}k`
  return `${sign}£${abs.toLocaleString()}`
}

function Section({ title, sub, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 11, fontWeight: 800, color: 'var(--c-text3)',
        letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8,
      }}>{title}</div>
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 10, lineHeight: 1.4 }}>
          {sub}
        </div>
      )}
      {children}
    </div>
  )
}

// Synthesise a 12-month back-cast from the current value, assuming constant
// monthly growth at 0.4% (≈ 5% annual). This is purely cosmetic context —
// flagged with `est.` badge so the user knows it isn't sourced.
function synthHistory(currentValue, months = 12, monthlyRate = 0.004) {
  if (!Number.isFinite(currentValue) || currentValue <= 0) return []
  const out = []
  let v = currentValue
  for (let i = 0; i < months; i++) {
    out.unshift(v)
    v = v / (1 + monthlyRate)
  }
  return out
}

function Sparkline({ data, color, width = 320, height = 60 }) {
  if (!Array.isArray(data) || data.length < 2) return null
  const W = width, H = height, pad = 4
  const vals = data.map(p => {
    const v = p != null && typeof p === 'object' ? +p.value : +p
    return Number.isFinite(v) ? v : 0
  })
  const maxV = Math.max(...vals)
  const minV = Math.min(...vals)
  const span = Math.max(maxV - minV, 1)
  const xs = vals.map((_, i) => pad + (i / (vals.length - 1)) * (W - pad * 2))
  const ys = vals.map(v => H - pad - ((v - minV) / span) * (H - pad * 2))
  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  const areaPath = `${path} L${xs[xs.length - 1].toFixed(1)},${(H - pad).toFixed(1)} L${xs[0].toFixed(1)},${(H - pad).toFixed(1)} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} aria-hidden="true" style={{ display: 'block' }}>
      <path d={areaPath} fill={color} fillOpacity="0.12" />
      <path d={path} fill="none" stroke={color} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="3" fill={color} />
    </svg>
  )
}

function MiniSparkline({ data, color }) {
  if (!Array.isArray(data) || data.length < 2) {
    // Flat line fallback for assets with no history.
    return (
      <svg viewBox="0 0 60 16" width="60" height="16" aria-hidden="true" style={{ display: 'block' }}>
        <line x1="2" y1="8" x2="58" y2="8" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      </svg>
    )
  }
  const W = 60, H = 16, pad = 2
  const vals = data.map(p => {
    const v = p != null && typeof p === 'object' ? +p.value : +p
    return Number.isFinite(v) ? v : 0
  })
  const maxV = Math.max(...vals)
  const minV = Math.min(...vals)
  const span = Math.max(maxV - minV, 1)
  const xs = vals.map((_, i) => pad + (i / (vals.length - 1)) * (W - pad * 2))
  const ys = vals.map(v => H - pad - ((v - minV) / span) * (H - pad * 2))
  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true" style={{ display: 'block' }}>
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function WrapperDrill({
  wrapper,
  assets = [],
  entity,
  ripple,
  personaId,
  onClose,
  onHome,
  onFilter,
}) {
  const [openAsset, setOpenAsset] = useState(null)

  const wrapperLabel = WRAPPER_LABEL[wrapper] || wrapper
  const color = WRAPPER_PALETTE[wrapper] || WRAPPER_PALETTE.GIA
  const total = assets.reduce((s, a) => s + (+a.value || 0), 0)

  // Hero history — prefer entity-provided trajectory if present, else synth.
  const supplied = entity?.trajectories?.wrapperHistory?.[wrapper]
  const heroHistory = Array.isArray(supplied) && supplied.length >= 2
    ? supplied.slice(-12)
    : synthHistory(total, 12)
  const isEstimated = !(Array.isArray(supplied) && supplied.length >= 2)

  // Concentration math — only show callout when wrapper is ≥ 40% of NW.
  const netWorth = +ripple?.balance_sheet?.netWorth || 0
  const concentrationPct = netWorth > 0 ? (total / netWorth) * 100 : 0
  const showConcentration = concentrationPct >= 40 && netWorth > 0

  return (
    <>
      <OverlayShell
        title={wrapperLabel}
        subtitle={`${fmt(total)} · ${assets.length} ${assets.length === 1 ? 'asset' : 'assets'}`}
        onBack={onClose}
        onHome={onHome}
      >
        <div style={{
          padding: '16px 16px 40px',
          // Dim the L2 stack when an L3 asset overlay is open above it
          opacity: openAsset ? 0.3 : 1,
          transition: 'opacity 180ms ease-out',
          pointerEvents: openAsset ? 'none' : 'auto',
        }}>

          {/* ── (a) Hero ────────────────────────────────────────────────── */}
          <Section title="1 · Wrapper overview">
            <div style={{
              background: 'var(--c-surface)', border: '1px solid var(--c-border)',
              borderRadius: 14, padding: '16px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <div style={{
                  fontSize: 32, fontWeight: 800, color: 'var(--c-text)',
                  fontVariantNumeric: 'tabular-nums', lineHeight: 1,
                }}>
                  {fmt(total)}
                </div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px', borderRadius: 100,
                  background: `color-mix(in srgb, ${color} 14%, transparent)`,
                  color, fontSize: 11, fontWeight: 800, letterSpacing: 0.4,
                  border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
                }}>
                  {wrapperLabel}
                </div>
                {isEstimated && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
                    textTransform: 'uppercase', color: 'var(--c-text3)',
                    padding: '2px 6px', borderRadius: 4,
                    border: '1px dashed var(--c-border)',
                  }}>est.</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 6 }}>
                {isEstimated
                  ? 'Trajectory estimated from current value — per-asset history not yet sourced.'
                  : 'Last 12 months · aggregate wrapper value.'}
              </div>
              <div style={{ marginTop: 10 }}>
                <Sparkline data={heroHistory} color={color} />
              </div>
            </div>
          </Section>

          {/* ── (b) Tax treatment ───────────────────────────────────────── */}
          <Section title="2 · Tax treatment">
            <div style={{
              background: 'var(--c-surface)', border: '1px solid var(--c-border)',
              borderRadius: 14, padding: '4px 8px',
            }}>
              <TaxTreatmentBlock wrapper={wrapper} compact />
            </div>
          </Section>

          {/* ── (c) L2 asset list ───────────────────────────────────────── */}
          <Section title={`3 · Assets in this wrapper · ${assets.length}`}>
            {assets.length === 0 ? (
              <div style={{
                background: 'var(--c-surface)', border: '1px dashed var(--c-border)',
                borderRadius: 14, padding: '18px 16px',
                fontSize: 12, color: 'var(--c-text3)', textAlign: 'center',
              }}>
                No assets in this wrapper yet.
              </div>
            ) : (
              <div style={{
                background: 'var(--c-surface)', border: '1px solid var(--c-border)',
                borderRadius: 14, overflow: 'hidden',
              }}>
                {assets.map((a, i) => {
                  const assetHistory = Array.isArray(a.raw?.history) && a.raw.history.length >= 2
                    ? a.raw.history.slice(-12)
                    : null
                  return (
                    <button
                      key={a.id || a.label || i}
                      type="button"
                      className="sw-press"
                      onClick={() => setOpenAsset(a)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        width: '100%', padding: '12px 14px',
                        background: 'transparent', border: 'none',
                        borderBottom: i < assets.length - 1 ? '1px solid var(--c-border)' : 'none',
                        cursor: 'pointer', textAlign: 'left',
                      }}
                      aria-label={`Open detail for ${a.label} · ${fmt(a.value)}`}
                    >
                      <span style={{
                        width: 8, height: 28, borderRadius: 2,
                        background: color, flexShrink: 0,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13, fontWeight: 700, color: 'var(--c-text)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {a.label}
                        </div>
                        {a.sub && (
                          <div style={{
                            fontSize: 11, color: 'var(--c-text3)', marginTop: 2,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {a.sub}
                          </div>
                        )}
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        <MiniSparkline data={assetHistory} color={color} />
                      </div>
                      <div style={{
                        fontSize: 13, fontWeight: 800, color: 'var(--c-text)',
                        fontVariantNumeric: 'tabular-nums', flexShrink: 0,
                        minWidth: 72, textAlign: 'right',
                      }}>
                        {fmt(a.value)}
                      </div>
                      <span aria-hidden="true" style={{
                        fontSize: 16, color: 'var(--c-text3)', flexShrink: 0,
                      }}>›</span>
                    </button>
                  )
                })}
              </div>
            )}
          </Section>

          {/* ── (d) Concentration callout ───────────────────────────────── */}
          {showConcentration && (
            <Section title="4 · Concentration">
              <div style={{
                background: 'var(--c-tint-neutral, var(--c-surface))',
                border: '1px solid var(--c-border)',
                borderRadius: 14, padding: '12px 14px',
                fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.5,
              }}>
                This wrapper holds{' '}
                <strong style={{ color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>
                  {concentrationPct.toFixed(0)}%
                </strong>{' '}
                of your net worth ({fmt(total)} of {fmt(netWorth)}). Informational only —
                diversification considerations vary by goal and time horizon.
              </div>
            </Section>
          )}

          {/* ── (e) Filter affordance ───────────────────────────────────── */}
          {typeof onFilter === 'function' && (
            <div style={{ marginTop: 8, marginBottom: 16 }}>
              <button
                type="button"
                className="sw-press"
                onClick={() => onFilter(wrapper)}
                style={{
                  background: 'transparent', border: 'none',
                  color: 'var(--c-acc)', fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', padding: '6px 0',
                }}
              >
                Filter MyMoney tile grid by {wrapperLabel} →
              </button>
            </div>
          )}

          {/* ── (f) Footer ──────────────────────────────────────────────── */}
          <p style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 16, lineHeight: 1.5 }}>
            {BRAND.disclaimer}
          </p>
        </div>
      </OverlayShell>

      {/* ── L3 nested overlay ─────────────────────────────────────────── */}
      {openAsset && (() => {
        // Bug A/B fix (founder audit 2026-05-25): the rowsFor* helpers (see
        // MyMoney.jsx §3) already tag every row with `wrapper`, but unwrapping
        // `asset.raw || asset` stripped that context, so AssetDetailOverlay
        // rendered "WRAPPER?" and "wrapper not resolved". Re-tag the raw asset
        // with the current wrapper code + derived category + itemType so the
        // overlay's tax block + provenance + title all resolve.
        const raw = openAsset.raw || openAsset
        const w = openAsset.wrapper || wrapper
        const category =
          (w === 'PENSION' || w === 'STATE') ? 'pensions'
          : (w === 'ISA' || w === 'GIA' || w === 'BOND_ON' || w === 'BOND_OFF'
              || w === 'EIS' || w === 'SEIS' || w === 'VCT' || w === 'TRUST') ? 'investments'
          : (w === 'PROPERTY') ? 'property'
          : (w === 'CASH') ? 'cash'
          : 'investments'
        const itemType = raw?.type || raw?.itemType || openAsset.tag || category
        // Hand the overlay a name-bearing object so its OverlayShell title
        // resolves to the asset label (was "Asset" generic header).
        // Also set `wrapperType` — getWrapper() in src/engine/_helpers.js reads
        // `asset.type || asset.wrapperType` (not `asset.wrapper`). For Property
        // rows the raw a.residence object lacks a `type` field, so without
        // wrapperType the resolver fell to UNKNOWN → "WRAPPER?" chip.
        const wrapperTypeHint =
          w === 'PROPERTY' ? 'property'
          : w === 'PENSION' ? 'pension'
          : w === 'STATE' ? 'state-pension'
          : w === 'ISA' ? 'isa'
          : w === 'GIA' ? 'gia'
          : w === 'CASH' ? 'cash'
          : w === 'BOND_ON' ? 'bond_on'
          : w === 'BOND_OFF' ? 'bond_off'
          : w === 'EIS' ? 'eis'
          : w === 'SEIS' ? 'seis'
          : w === 'VCT' ? 'vct'
          : w === 'TRUST' ? 'trust'
          : raw?.type
        const taggedAsset = {
          ...raw,
          wrapper: w,
          wrapperType: raw?.wrapperType || wrapperTypeHint,
          name: raw?.name || openAsset.label || openAsset.title || raw?.address || raw?.account_name || raw?.provider,
        }
        return (
          <AssetDetailOverlay
            asset={taggedAsset}
            domain={category}
            category={category}
            itemType={itemType}
            personaId={personaId}
            onBack={() => setOpenAsset(null)}
            onHome={onHome}
          />
        )
      })()}
    </>
  )
}
