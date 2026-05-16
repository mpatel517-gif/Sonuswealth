// ─────────────────────────────────────────────────────────────────────────────
// CrossMap5x5 — Financial Profile cross-map (Invention 19)
// Spec: risk-layer §4 + Invention 19
//
// 25-cell grid (5 cols Wealth bands × 5 rows Risk bands).
// Current cell — outline + name.  Adjacent cells — slight tint.
// Ideal cell (top-right) — faint emerald glow.
// Tap on adjacent cell → "How to get here" sheet stub.
// 400ms slide + glow pulse on cell change (D-RISK-13).
//
// Note on band naming:
//   The existing engine uses bands {Exceptional/Optimised/Established/Building/
//   Exposed} × {Exposed/Vulnerable/Managed/Protected/Resilient}. This component
//   accepts the prompt-spec naming
//     fqBand:   foundation | building | established | growing | exceptional
//     riskBand: vulnerable | cautious  | managed     | protected | resilient
//   …because the user asked for those props specifically. A small adapter at
//   the consumer side maps engine-bands → these.
//
// Props:
//   fqBand     'foundation' | 'building' | 'established' | 'growing' | 'exceptional'
//   riskBand   'vulnerable' | 'cautious' | 'managed'     | 'protected' | 'resilient'
//   onCellTap  (cellId) => void
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'

// Wealth bands ordered weakest → strongest (rendered top-to-bottom flipped)
const FQ_BANDS = [
  { id: 'foundation',  label: 'Foundation'  },
  { id: 'building',    label: 'Building'    },
  { id: 'established', label: 'Established' },
  { id: 'growing',     label: 'Growing'     },
  { id: 'exceptional', label: 'Exceptional' },
]
// Risk bands weakest → strongest (rendered left-to-right)
const RS_BANDS = [
  { id: 'vulnerable', label: 'Vulnerable' },
  { id: 'cautious',   label: 'Cautious'   },
  { id: 'managed',    label: 'Managed'    },
  { id: 'protected',  label: 'Protected'  },
  { id: 'resilient',  label: 'Resilient'  },
]

// Hand-curated cell names — "{Wealth} / {Risk}" two-line label.
// Sentence-style labels per spec ("Solid progress, seriously exposed" etc.).
function cellName(fqId, rsId) {
  const wealth = FQ_BANDS.find(b => b.id === fqId)?.label || fqId
  const risk   = RS_BANDS.find(b => b.id === rsId)?.label || rsId
  return `${wealth} / ${risk}`
}

function cellId(fqId, rsId) { return `${fqId}_${rsId}` }

function isAdjacent(curFq, curRs, fqId, rsId) {
  const dF = Math.abs(FQ_BANDS.findIndex(b => b.id === curFq)
                    - FQ_BANDS.findIndex(b => b.id === fqId))
  const dR = Math.abs(RS_BANDS.findIndex(b => b.id === curRs)
                    - RS_BANDS.findIndex(b => b.id === rsId))
  return (dF + dR) === 1
}

function cellTone(fqIdx, rsIdx) {
  const score = fqIdx + rsIdx // 0..8 — top-right strongest
  if (score >= 7) return { bg: 'var(--c-acc-bg)',           border: 'rgba(45,242,195,.30)' }
  if (score >= 5) return { bg: 'rgba(126,240,168,.06)',     border: 'rgba(126,240,168,.22)' }
  if (score >= 3) return { bg: 'var(--c-gold-bg)',          border: 'rgba(255,189,89,.22)' }
  if (score >= 1) return { bg: 'var(--c-acc3-bg)',          border: 'rgba(255,111,125,.22)' }
  return                 { bg: 'rgba(255,59,48,.10)',       border: 'rgba(255,59,48,.30)' }
}

export default function CrossMap5x5({
  fqBand = 'building',
  riskBand = 'cautious',
  onCellTap,
}) {
  // Cell-change pulse — when band props change, briefly glow the new cell.
  const prevKey = useRef(`${fqBand}_${riskBand}`)
  const [glow, setGlow] = useState(false)
  useEffect(() => {
    const next = `${fqBand}_${riskBand}`
    if (next !== prevKey.current) {
      prevKey.current = next
      setGlow(true)
      const t = setTimeout(() => setGlow(false), 600)
      return () => clearTimeout(t)
    }
  }, [fqBand, riskBand])

  // Sheet stub for "How to get here"
  const [movement, setMovement] = useState(null)

  // Render rows top-to-bottom = strongest wealth on top
  const rowsTopDown = [...FQ_BANDS].slice().reverse()

  return (
    <div className="card">
      <div className="card-title">Financial Profile · 5×5</div>
      <div style={{
        fontSize: 'var(--fs-small)', color: 'var(--c-text2)',
        marginBottom: 10, lineHeight: 1.5,
      }}>
        <strong style={{ color: 'var(--c-text)' }}>
          {cellName(fqBand, riskBand)}
        </strong>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'auto repeat(5, 1fr)',
        gap: 4,
      }}>
        {/* Top-left empty + risk header row */}
        <div />
        {RS_BANDS.map(rs => (
          <div key={rs.id} style={{
            fontSize: 'var(--fs-label)', color: 'var(--c-text3)',
            textAlign: 'center', padding: '4px 0',
            textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700,
          }}>
            {rs.label.slice(0, 4)}
          </div>
        ))}

        {/* Rows */}
        {rowsTopDown.map(fq => {
          const fqIdx = FQ_BANDS.findIndex(b => b.id === fq.id)
          return (
            <Row
              key={fq.id}
              fq={fq}
              fqIdx={fqIdx}
              curFq={fqBand}
              curRs={riskBand}
              glow={glow}
              onTap={(rsId) => {
                const id = cellId(fq.id, rsId)
                if (fq.id === fqBand && rsId === riskBand) {
                  onCellTap?.(id)
                  return
                }
                if (isAdjacent(fqBand, riskBand, fq.id, rsId)) {
                  setMovement({ id, name: cellName(fq.id, rsId), fqId: fq.id, rsId })
                } else {
                  onCellTap?.(id)
                }
              }}
            />
          )
        })}
      </div>

      <div style={{
        marginTop: 10, display: 'flex', gap: 14,
        fontSize: 'var(--fs-label)', color: 'var(--c-text3)',
      }}>
        <span>← Less resilience</span>
        <span style={{ marginLeft: 'auto' }}>More resilience →</span>
      </div>

      {movement && (
        <MovementSheet
          target={movement}
          onClose={() => setMovement(null)}
        />
      )}
    </div>
  )
}

function Row({ fq, fqIdx, curFq, curRs, glow, onTap }) {
  return (
    <>
      <div style={{
        fontSize: 'var(--fs-label)', color: 'var(--c-text3)',
        padding: '4px 6px 4px 0', textAlign: 'right',
        textTransform: 'uppercase', letterSpacing: 0.4,
        alignSelf: 'center', fontWeight: 700,
      }}>
        {fq.label.slice(0, 7)}
      </div>
      {RS_BANDS.map((rs, rsIdx) => {
        const tone = cellTone(fqIdx, rsIdx)
        const isCurrent = fq.id === curFq && rs.id === curRs
        const isAdj = isAdjacent(curFq, curRs, fq.id, rs.id)
        const isIdeal = fq.id === 'exceptional' && rs.id === 'resilient'
        return (
          <button
            key={rs.id}
            onClick={() => onTap?.(rs.id)}
            aria-label={cellName(fq.id, rs.id)}
            style={{
              position: 'relative',
              background: isCurrent
                ? 'var(--c-acc)'
                : isAdj
                  ? `color-mix(in srgb, ${tone.bg} 60%, var(--c-surface2))`
                  : tone.bg,
              border: `${isCurrent ? 2 : 1}px solid ${
                isCurrent
                  ? 'var(--c-acc)'
                  : isAdj
                    ? 'var(--c-border2)'
                    : tone.border
              }`,
              borderRadius: 8,
              minHeight: 44,
              padding: '4px 4px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9,
              fontWeight: 700,
              lineHeight: 1.15,
              color: isCurrent ? 'var(--c-bg)' : 'var(--c-text3)',
              cursor: 'pointer',
              transition: 'transform .4s ease, box-shadow .4s ease, background .3s, border .3s',
              transform: isCurrent && glow ? 'scale(1.04)' : 'scale(1)',
              boxShadow: isCurrent && glow
                ? '0 0 0 4px rgba(45,242,195,0.25), 0 0 20px rgba(45,242,195,0.45)'
                : isIdeal
                  ? '0 0 12px rgba(45,242,195,0.18)'
                  : 'none',
              textAlign: 'center',
              overflow: 'hidden',
            }}
          >
            {isCurrent ? (
              <span style={{ fontSize: 8, lineHeight: 1.15 }}>
                {fq.label}<br />/ {rs.label}
              </span>
            ) : isIdeal ? (
              <span style={{ fontSize: 11, color: 'var(--c-acc)' }}>★</span>
            ) : isAdj ? (
              <span style={{ fontSize: 9, opacity: 0.8 }}>→</span>
            ) : null}
          </button>
        )
      })}
    </>
  )
}

function MovementSheet({ target, onClose }) {
  return (
    <div
      role="dialog" aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 680,
          background: 'var(--c-surface)',
          borderRadius: '20px 20px 0 0',
          padding: '20px 20px 28px',
          maxHeight: '70vh', overflowY: 'auto',
        }}
      >
        <div style={{
          width: 36, height: 5, borderRadius: 3,
          background: 'var(--c-sep)', margin: '0 auto 16px',
        }} />
        <div style={{
          fontSize: 'var(--fs-label)', fontWeight: 700,
          color: 'var(--c-text3)',
          textTransform: 'uppercase', letterSpacing: 0.8,
          marginBottom: 4,
        }}>
          How to get here
        </div>
        <div style={{
          fontSize: 'var(--fs-title)', fontWeight: 800,
          color: 'var(--c-text)', marginBottom: 12,
        }}>
          {target.name}
        </div>
        <div style={{
          fontSize: 'var(--fs-body)', color: 'var(--c-text2)',
          lineHeight: 1.55,
        }}>
          The single highest-leverage action to move you to this cell will be
          surfaced here once you tap it from your live profile. (Stub — wires
          to engine.movementPaths(currentCell, targetCell).)
        </div>
      </div>
    </div>
  )
}

export { CrossMap5x5, FQ_BANDS as CROSSMAP_FQ_BANDS, RS_BANDS as CROSSMAP_RS_BANDS }
