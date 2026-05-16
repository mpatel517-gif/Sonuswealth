// ─────────────────────────────────────────────────────────────────────────────
// RiskOverlay.jsx — sheet variant of the Risk surface (D-ARCH-2 canonical).
//
// Spec: 2-Product-risk-layer-v1_6.md §1.1, §2.1
// Slides over the current screen when the Risk Score tile of the triple
// anchor is tapped. **Not a tab.**
//
// Architectural note: NO X28 time-window selector here — Risk Score is
// always point-in-time. Zone 8 has its OWN history picker (1/3/6/12 mo),
// which is a standalone control distinct from the X28 window.
//
// Both this overlay AND the full-page Risk.jsx render the same `RiskBody`
// composition so the two surfaces stay consistent.
//
// Polish layer: header counter-up, hero caption serif card, sw-press on close.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { calcRisk, riskBand, calcFQ, fqBand } from '../engine/fq-calculator.js'
import { BRAND } from '../config/brand.js'
import { RiskBody } from './Risk.jsx'  // re-use composed body
import { Num, FadeInOnMount } from '../components/shared/index.js'

export default function RiskOverlay({ entity, onClose, originLabel = 'Home' }) {
  const risk = calcRisk(entity)
  const band = risk.band || riskBand(risk.total)
  const fq   = calcFQ(entity)
  const fqB  = fq.band || fqBand(fq.total)

  // Esc to close
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Z0: hero caption gets a per-overlay collapse memory.
  const [heroCollapsed, setHeroCollapsed] = useState(false)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', flexDirection: 'column',
      background: 'var(--c-bg)',
      animation: 'rk-slide-up .3s cubic-bezier(0.16, 1, 0.3, 1)',
    }}>
      <style>{`
        @keyframes rk-slide-up {
          from { transform: translateY(24px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      {/* ── Z1 sticky header ─────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 5,
        background: 'var(--c-bg)',
        borderBottom: '1px solid var(--c-sep)',
        padding: '10px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button onClick={onClose} aria-label="Close" className="sw-press" style={{
          background: 'var(--c-surface2)', border: '1px solid var(--c-border)',
          borderRadius: '50%', width: 36, height: 36,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--c-text2)', fontSize: 16,
          transition: 'background var(--dur-fast) var(--ease-out-cubic)',
        }}>
          ✕
        </button>
        <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
          <div className="sw-eyebrow">
            Risk Score · point-in-time
          </div>
          <div style={{
            fontSize: 'var(--fs-hero)', fontWeight: 800,
            color: band.colour, lineHeight: 1.1,
            display:'inline-flex', alignItems:'baseline', gap:4,
          }}>
            <Num value={risk.total} format="score" animate />
            <span style={{
              fontSize: 'var(--fs-small)', color: 'var(--c-text3)',
              fontWeight: 400, marginLeft: 4,
            }}>
              /100
            </span>
            {/* Wealth Score sub-anchor */}
            <span style={{
              fontSize: 'var(--fs-small)', color: fqB.colour,
              fontWeight: 600, marginLeft: 12,
            }}>
              · Wealth <Num value={fq.total} format="score" animate />
            </span>
          </div>
          <div style={{
            fontSize: 'var(--fs-small)', fontWeight: 600, color: band.colour,
          }}>
            {band.name}
          </div>
        </div>
        <div style={{ width: 36 }} />
      </div>

      {/* ── Scrollable body — full zone set ──────────────────────────────── */}
      <div style={{
        flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        padding: '12px 16px 24px',
      }}>
        {/* Z0: X22 breadcrumb + X25 hero caption */}
        <button onClick={onClose} className="sw-press" style={{
          background:'none', border:'none', cursor:'pointer',
          display:'flex', alignItems:'center', gap:6,
          color:'var(--c-acc)', fontSize:12, fontWeight:600,
          padding:'4px 0', marginBottom:8,
        }}>
          <span style={{ fontSize:14 }}>←</span> {originLabel}
        </button>

        {heroCollapsed ? (
          <button onClick={() => setHeroCollapsed(false)}
            className="sw-chip sw-chip-sm sw-chip-mint sw-press"
            style={{ marginBottom:10 }}>
            ? What is this?
          </button>
        ) : (
          <FadeInOnMount>
            <div className="sw-card sw-card-elevated" style={{
              marginBottom:14, position:'relative',
              background:'linear-gradient(135deg, rgba(45,242,195,0.06), var(--c-surface))',
              borderLeft:'3px solid var(--c-acc)',
              padding:'14px 18px',
            }}>
              <button onClick={() => setHeroCollapsed(true)} className="sw-press" style={{
                position:'absolute', right:10, top:10,
                background:'none', border:'none', cursor:'pointer',
                color:'var(--c-text3)', fontSize:14,
              }}>×</button>
              <div style={{
                fontSize: 18, fontWeight: 700, letterSpacing:-0.3,
                color: 'var(--c-text)', fontStyle:'italic', marginBottom: 6,
                lineHeight:1.3, paddingRight:20,
                fontFamily:'Georgia, "Times New Roman", serif',
              }}>
                "If something went wrong tomorrow — would I survive it financially?"
              </div>
              <div style={{
                fontSize: 'var(--fs-small)', color: 'var(--c-text2)', lineHeight: 1.5,
              }}>
                See where you're resilient, where you're exposed, and what a shock
                to each would mean in pounds.
              </div>
            </div>
          </FadeInOnMount>
        )}

        {/* All zones — same composition as full-page Risk.jsx */}
        <RiskBody entity={entity} />

        {/* Disclaimer */}
        <div style={{
          textAlign: 'center', fontSize: 'var(--fs-micro)',
          color: 'var(--c-text3)',
          padding: '14px 16px 0', lineHeight: 1.6,
        }}>
          {BRAND.disclaimer}<br />
          {BRAND.rulesVersion} · Last verified: {BRAND.dataDate}
        </div>
      </div>
    </div>
  )
}
