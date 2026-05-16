// RadarChart.jsx — Sonuswealth design (29 April 2026; 3-anchor centre 2026-05-11)
// Uses CSS-positioned div nodes + SVG polygon, matching preview.html design.
//
// 2026-05-11 update (user feedback):
//   · Theme-aware via --c-radar-* tokens (was hardcoded mint).
//   · Centre now stacks 3 anchors (NW · Wealth Score · Risk Score)
//     instead of just the single score.
//
// Props: { entity, fqData, onDimTap, rippleDims }

import { netWorth, fmt, calcRisk, riskBand } from '../../engine/fq-calculator.js'
import { DIMENSIONS } from '../../config/dimensions.js'
import { WEIGHT } from '../../config/typography.js'

function safe(fn, fallback) { try { return fn() } catch { return fallback } }

const SIZE    = 338
const CX      = SIZE / 2       // 169
const CY      = SIZE / 2       // 169
const MAX_R   = 128            // polygon outer ring radius
const NODE_R  = 142            // radius at which node centres sit (was 174, reduced to fit 68px nodes inside)
const MIN_FRAC = 0.06          // minimum fill so every node shows

function toRad(deg) { return deg * Math.PI / 180 }

export default function RadarChart({ entity, fqData, onDimTap, rippleDims }) {
  const safeDims = fqData?.dims || {}
  const dims = DIMENSIONS.map(d => ({
    ...d,
    score: safeDims[d.key] ?? 0,
    frac:  Math.min(1, (safeDims[d.key] ?? 0) / (d.max || 1)),
    pct:   Math.round(Math.min(1, (safeDims[d.key] ?? 0) / (d.max || 1)) * 100),
  }))

  // SVG polygon points (score shape)
  const polyPts = dims.map(d => {
    const r     = Math.max(MIN_FRAC, d.frac) * MAX_R
    const angle = toRad(d.angle)
    return `${(CX + r * Math.cos(angle)).toFixed(1)},${(CY + r * Math.sin(angle)).toFixed(1)}`
  }).join(' ')

  // Ring radii
  const rings = [0.27, 0.53, 0.8, 1.0]

  return (
    <div style={{ position:'relative', width:'100%', aspectRatio:'1/1', overflow:'visible' }}>

      {/* Scan sweep — theme-aware via --c-radar-glow */}
      <div style={{
        position:'absolute', inset:'8%', borderRadius:'50%', pointerEvents:'none', zIndex:1,
        background:'conic-gradient(from -50deg, transparent 0deg, var(--c-radar-glow) 24deg, transparent 58deg)',
        animation:'caelixaScan 6.5s linear infinite',
      }} />

      {/* SVG — rings, axes, polygon (all theme-aware via --c-radar-* tokens) */}
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ position:'absolute', inset:0, width:'100%', height:'100%', overflow:'visible' }}
        aria-label="Financial radar"
      >
        {/* Rings */}
        {rings.map((r, i) => (
          <circle key={i} cx={CX} cy={CY} r={r * MAX_R}
            fill="none" stroke="var(--c-radar-ring)" strokeWidth={1}/>
        ))}

        {/* Axes */}
        {dims.map((d, i) => {
          const angle = toRad(d.angle)
          return (
            <line key={i}
              x1={CX} y1={CY}
              x2={(CX + MAX_R * Math.cos(angle)).toFixed(1)}
              y2={(CY + MAX_R * Math.sin(angle)).toFixed(1)}
              stroke="var(--c-radar-axis)" strokeWidth={1}/>
          )
        })}

        {/* Score polygon — fill + stroke + glow + draw-in animation.
            stroke-dasharray + sw-stroke-draw animates stroke-dashoffset from
            length to 0 over 1.6s (Phase 2 Batch B chart-animation upgrade). */}
        <polygon points={polyPts}
          className="sw-stroke-draw"
          fill="var(--c-radar-fill)"
          stroke="var(--c-radar-stroke)"
          strokeWidth={2.2}
          strokeLinejoin="round"
          strokeDasharray="900"
          style={{
            '--sw-draw-len': '900',
            filter: 'drop-shadow(0 0 12px var(--c-radar-glow))',
            transition: 'fill .3s ease, stroke .3s ease',
          }}
        />

        {/* Ripple rings for changed dims */}
        {dims.map((d, i) => {
          if (!rippleDims?.includes(d.key)) return null
          const angle = toRad(d.angle)
          const r     = Math.max(MIN_FRAC, d.frac) * MAX_R
          return (
            <circle key={`rip_${i}`}
              cx={(CX + r * Math.cos(angle)).toFixed(1)}
              cy={(CY + r * Math.sin(angle)).toFixed(1)}
              r={14} fill="none" stroke={d.colour} strokeWidth={1.5}
              opacity={0.6} strokeDasharray="3 3"/>
          )
        })}
      </svg>

      {/* Centre — 3-anchor stack (user 2026-05-11: "3 anchors in the middle
          not just the score"). NW small top · Wealth Score big middle ·
          Risk Score small bottom. Theme-aware via tokens. */}
      <CentreAnchors entity={entity} fqTotal={fqData?.total ?? 0} />

      {/* Dimension nodes */}
      {dims.map((d, i) => {
        const angle  = toRad(d.angle)
        const leftPct = (CX + NODE_R * Math.cos(angle)) / SIZE * 100
        const topPct  = (CY + NODE_R * Math.sin(angle)) / SIZE * 100
        const isDanger = d.pct < 20
        return (
          <div key={d.key}
            onClick={() => onDimTap?.(d.key)}
            style={{
              position:'absolute',
              left:`${leftPct}%`, top:`${topPct}%`,
              transform:'translate(-50%,-50%)',
              width:68, minHeight:54,
              padding:'8px 6px',
              display:'grid', alignContent:'center', gap:2,
              textAlign:'center', borderRadius:16,
              border:`1px solid ${isDanger ? 'var(--c-acc3)' : 'var(--c-border)'}`,
              background:'var(--c-radar-node-bg)',
              backdropFilter:'blur(14px)',
              cursor:'pointer', zIndex:3,
              boxShadow:`0 14px 30px rgba(0,0,0,.10)${isDanger ? ', 0 0 18px var(--c-acc3-bg)' : ''}`,
              color: 'var(--c-text)',
              animation:`caelixaRise .75s cubic-bezier(.2,.9,.2,1) both`,
              animationDelay:`${0.36 + i * 0.07}s`,
            }}
          >
            <strong style={{ fontSize:18, lineHeight:1, fontWeight:WEIGHT.bold, color: d.colour }}>{d.pct}</strong>
            {d.label.split(' ').map((word, wi) => (
              <span key={wi} style={{ display:'block', color:'var(--c-text2)', fontSize:10, lineHeight:1.1, fontWeight:WEIGHT.bold }}>{word}</span>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ── Centre — 3 anchors stacked (NW small · Wealth Score big · Risk Score small) ──
function CentreAnchors({ entity, fqTotal }) {
  const nw   = safe(() => netWorth(entity), 0)
  const risk = safe(() => calcRisk(entity), { total: 0, band: null })
  const riskTotal = risk.total ?? 0
  const rb        = risk.band || safe(() => riskBand(riskTotal), { colour: 'var(--c-text2)' })

  // Compact NW format — £3.6M / £820k / £45k
  const nwCompact = (() => {
    const n = nw || 0
    if (n >= 1e6) return `£${(n / 1e6).toFixed(n >= 10e6 ? 0 : 2)}M`
    if (n >= 1e3) return `£${Math.round(n / 1e3)}k`
    return `£${Math.round(n)}`
  })()

  return (
    <div style={{
      position: 'absolute', left: '50%', top: '50%',
      transform: 'translate(-50%, -50%)',
      width: '40%', height: '40%',
      minWidth: 120, minHeight: 120,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 2,
      borderRadius: '50%',
      border: '1px solid var(--c-border2)',
      background: 'radial-gradient(circle at 50% 35%, var(--c-acc-bg), transparent 36%), var(--c-surface)',
      boxShadow: '0 0 38px var(--c-radar-glow), 0 4px 18px rgba(0,0,0,.20)',
      textAlign: 'center', zIndex: 2, pointerEvents: 'none',
      padding: '8px 6px',
    }}>
      {/* Top: Net Worth (small) */}
      <div>
        <div style={{
          fontSize: 8, fontWeight: 800, letterSpacing: '.10em',
          textTransform: 'uppercase', color: 'var(--c-text3)',
        }}>Net Worth</div>
        <div style={{
          fontSize: 13, fontWeight: 800, color: 'var(--c-text)',
          lineHeight: 1, marginTop: 1,
        }}>{nwCompact}</div>
      </div>

      {/* Centre: Wealth Score (big — the radar's primary number) */}
      <div style={{ margin: '4px 0' }}>
        <div style={{
          fontSize: 8, fontWeight: 800, letterSpacing: '.10em',
          textTransform: 'uppercase', color: 'var(--c-text3)',
        }}>Wealth</div>
        <div style={{
          fontSize: 28, fontWeight: 900, color: 'var(--c-acc)',
          lineHeight: 1, letterSpacing: -1, marginTop: 1,
        }}>{fqTotal ?? 0}</div>
      </div>

      {/* Bottom: Risk Score (small) */}
      <div>
        <div style={{
          fontSize: 8, fontWeight: 800, letterSpacing: '.10em',
          textTransform: 'uppercase', color: 'var(--c-text3)',
        }}>Risk</div>
        <div style={{
          fontSize: 13, fontWeight: 800, color: rb.colour || 'var(--c-text2)',
          lineHeight: 1, marginTop: 1,
        }}>{riskTotal}</div>
      </div>
    </div>
  )
}
