// ─────────────────────────────────────────────────────────────────────────────
// CrossMap — 5×5 grid of Wealth band × Risk band → cell name.
// Active cell read from financialProfile(entity).profileKey.
// ─────────────────────────────────────────────────────────────────────────────

import { financialProfile } from '../../engine/fq-calculator.js'

const FQ_BANDS = ['Exceptional', 'Optimised', 'Established', 'Building', 'Exposed']
const RS_BANDS = ['Exposed', 'Vulnerable', 'Managed', 'Protected', 'Resilient']

// Cell colour scaled by (fqIdx + rsIdx) — top-right is best, bottom-left worst.
function cellTone(fqIdx, rsIdx) {
  const score = (FQ_BANDS.length - 1 - fqIdx) + rsIdx // 0..8
  if (score >= 7) return { bg: 'var(--c-acc-bg)',  border: 'rgba(45,242,195,.35)' }
  if (score >= 5) return { bg: 'rgba(126,240,168,.08)', border: 'rgba(126,240,168,.30)' }
  if (score >= 3) return { bg: 'var(--c-gold-bg)', border: 'rgba(255,189,89,.30)' }
  if (score >= 1) return { bg: 'var(--c-acc3-bg)', border: 'rgba(255,111,125,.30)' }
  return                 { bg: 'rgba(255,59,48,.12)', border: 'rgba(255,59,48,.40)' }
}

export default function CrossMap({ entity }) {
  let profile = {}
  try { profile = financialProfile(entity) || {} } catch {}
  const activeKey = profile.profileKey || ''
  const activeFQ = profile.fqBand || ''
  const activeRS = profile.riskBand || ''

  return (
    <div className="card">
      <div className="card-title">Financial Profile · 5×5</div>
      <div style={{
        fontSize:'var(--fs-small)', color:'var(--c-text2)',
        marginBottom:12, lineHeight:1.5,
      }}>
        <strong style={{ color:'var(--c-text)' }}>{profile.chipName || '—'}</strong>
        {profile.profileImplication && <> — {profile.profileImplication}</>}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'auto repeat(5, 1fr)', gap:3 }}>
        {/* Top-left empty */}
        <div />
        {RS_BANDS.map(rs => (
          <div key={rs} style={{
            fontSize:'var(--fs-label)', color:'var(--c-text3)',
            textAlign:'center', padding:'4px 0',
            textTransform:'uppercase', letterSpacing:0.4,
          }}>
            {rs.slice(0, 4)}
          </div>
        ))}
        {FQ_BANDS.map((fq, fqIdx) => (
          <Row key={fq} fq={fq} fqIdx={fqIdx} activeKey={activeKey} />
        ))}
      </div>

      <div style={{
        marginTop:10, display:'flex', gap:14, fontSize:'var(--fs-label)',
        color:'var(--c-text3)',
      }}>
        <span>← Less resilience</span>
        <span style={{ marginLeft:'auto' }}>More resilience →</span>
      </div>
      <div style={{ fontSize:'var(--fs-label)', color:'var(--c-text3)', marginTop:4 }}>
        Active cell: <strong style={{ color:'var(--c-text)' }}>{activeFQ} · {activeRS}</strong>
      </div>
    </div>
  )
}

function Row({ fq, fqIdx, activeKey }) {
  return (
    <>
      <div style={{
        fontSize:'var(--fs-label)', color:'var(--c-text3)',
        padding:'4px 6px 4px 0', textAlign:'right',
        textTransform:'uppercase', letterSpacing:0.4,
        alignSelf:'center',
      }}>
        {fq.slice(0, 6)}
      </div>
      {RS_BANDS.map((rs, rsIdx) => {
        const key = `${fq.toLowerCase()}_${rs.toLowerCase()}`
        const tone = cellTone(fqIdx, rsIdx)
        const active = key === activeKey
        return (
          <div key={rs} style={{
            background: active ? 'var(--c-acc)' : tone.bg,
            border: `1px solid ${active ? 'var(--c-acc)' : tone.border}`,
            borderRadius: 6, height: 32,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize: 'var(--fs-label)',
            color: active ? 'var(--c-bg)' : 'var(--c-text3)',
            fontWeight: active ? 800 : 600,
          }}>
            {active ? '●' : ''}
          </div>
        )
      })}
    </>
  )
}
