// ─────────────────────────────────────────────────────────────────────────────
// DetailOverlay — breadcrumb full-screen drill view (PP-3 nth-degree drillable)
//
// Tap any <Drillable> → push a DetailOverlay onto the stack. Overlay shows:
//   · Breadcrumb header (Home › NW › Assets ← back)
//   · Title + formula + confidence + source for the metric
//   · Drivers list — each driver is itself <Drillable> (recursive)
//   · Terminal node shows source + provenance instead of further drivers
//
// Stack model: caller owns an array of frames in state; DetailOverlay reads
// the top frame. Back action pops one frame; close action pops all.
//
// Props:
//   frame      DriverNode — produced by `driver(entity, metric, level)`
//   onDrill    fn(metric) — push a deeper frame
//   onBack     fn         — pop one frame
//   onClose    fn         — pop all frames (back to tab)
//   crumbs     string[]   — breadcrumb labels from root → current
// ─────────────────────────────────────────────────────────────────────────────

import { fmt } from '../../engine/fq-calculator.js'
import { ALIAS } from '../../copy/plain-english.js'

const FORMAT_BY_UNIT = {
  // fmt() already prepends the currency symbol — don't add a second £ (was "££0").
  gbp:   v => (typeof fmt === 'function' ? fmt(v) : `£${Math.round(v || 0).toLocaleString()}`),
  pct:   v => `${(v || 0).toFixed(1)}%`,
  score: v => `${Math.round(v || 0)}`,
  count: v => `${v || 0}`,
}

const label = key => ALIAS[key] || prettify(key)
function prettify(s) {
  return String(s || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, c => c.toUpperCase())
}

export default function DetailOverlay({ frame, onDrill, onBack, onClose, crumbs = [] }) {
  if (!frame) return null
  const fmtVal = FORMAT_BY_UNIT[frame.unit] || FORMAT_BY_UNIT.gbp

  return (
    <div className="sheet-overlay">
      <div className="sheet-backdrop" onClick={typeof onClose === 'function' ? onClose : undefined} />
      <div
        role="dialog"
        aria-label={`${label(frame.metric)} detail`}
        style={{
          position: 'absolute', inset: 0,
          background: 'var(--c-bg)',
          display: 'flex', flexDirection: 'column',
          animation: 'fadeIn 0.25s ease',
        }}
      >
        {/* Breadcrumb header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 16px', borderBottom: '1px solid var(--c-sep)',
          flexShrink: 0,
        }}>
          <button
            onClick={typeof onBack === 'function' ? onBack : undefined}
            aria-label="Back"
            className="sw-press"
            style={{
              padding: '4px 10px', borderRadius: 8,
              background: 'var(--c-surface2)', border: '1px solid var(--c-border)',
              color: 'var(--c-text2)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >← Back</button>
          <div style={{ flex: 1, minWidth: 0,
            fontSize: 11, color: 'var(--c-text3)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {crumbs.map((c, i) => (
              <span key={i}>
                {label(c)}{i < crumbs.length - 1 && <span style={{ opacity: 0.5 }}> › </span>}
              </span>
            ))}
          </div>
          <button
            onClick={typeof onClose === 'function' ? onClose : undefined}
            aria-label="Close detail"
            className="sw-press"
            style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'var(--c-surface2)', border: '1px solid var(--c-border)',
              color: 'var(--c-text2)', fontSize: 14, cursor: 'pointer',
            }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {/* Hero */}
          <div className="sw-tile sw-tile-hero" style={{ marginBottom: 16 }}>
            <div className="sw-eyebrow">{label(frame.metric)}</div>
            <div className="sw-hero" style={{ marginTop: 6 }}>{fmtVal(frame.value)}</div>
            <div style={{
              marginTop: 12, fontSize: 13, color: 'var(--c-text2)',
              lineHeight: 1.5,
            }}>
              {frame.formula}
            </div>
            <div style={{
              marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap',
            }}>
              <span className="sw-chip sw-chip-sm">{frame.source}</span>
              <span className={`sw-chip sw-chip-sm sw-chip-${frame.confidence === 'high' ? 'mint' : frame.confidence === 'low' ? 'coral' : 'amber'}`}>
                {frame.confidence} confidence
              </span>
              {frame.terminal && <span className="sw-chip sw-chip-sm">terminal</span>}
            </div>
          </div>

          {/* Drivers list */}
          {frame.drivers?.length > 0 && (
            <>
              <div className="sw-eyebrow" style={{ marginBottom: 8 }}>What drives this</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {frame.drivers.map((d, i) => {
                  const dFmt = FORMAT_BY_UNIT[d.unit] || FORMAT_BY_UNIT.gbp
                  return (
                    <button
                      key={d.metric + i}
                      onClick={() => onDrill?.(d.metric)}
                      className="sw-tile sw-tile-interactive"
                      style={{
                        textAlign: 'left', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>
                          {label(d.metric)}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 2 }}>
                          {d.formula}
                        </div>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--c-text)' }}>
                        {dFmt(d.value)}
                      </div>
                      <span style={{ color: 'var(--c-text3)', fontSize: 14 }}>›</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {frame.terminal && (
            <div style={{
              marginTop: 16, padding: 12,
              background: 'var(--c-tint-neutral)', borderRadius: 12,
              fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.5,
            }}>
              This is the deepest level for {label(frame.metric)}. Source: {frame.source}.
              Confidence: {frame.confidence}.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
