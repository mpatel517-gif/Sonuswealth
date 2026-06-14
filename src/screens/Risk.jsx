// ─────────────────────────────────────────────────────────────────────────────
// Risk.jsx — Risk full-page surface (Wave 2 Agent I refactor + polish pass)
//
// Spec: 2-Product-risk-layer-v1_6.md (§2.2 zone map)
// Architectural note (§1.1, D-ARCH-2): Risk is canonically an OVERLAY, not a
// tab. Both surfaces are kept consistent during transition. The full-page
// variant renders the same zone set as RiskOverlay.jsx — sourced from the same
// shared building blocks below.
//
// Polish layer (this revision):
//   · Ring fill: 1500ms with elastic settle, counter-up via <Num animate />
//   · 5×5 cells, 7-dim rows, shock cards, take-action cards, what-helps rows,
//     D6 sub-chips → entry stagger via <RevealStagger>
//   · History line: <DrawSVG> on mount
//   · Setback chip: pulse-glow when triggered
//   · Life-event banner: slide-in from top
//   · Floating + button: sw-lift sw-press, halo on idle
//   · Plan anchor: pulse-glow when no plan committed
//   · Cards: sw-lift, chips/buttons: sw-press; design-token classes everywhere
//
// Zone coverage (full page = overlay):
//   Z0  — X25 hero caption + X22 breadcrumb
//   Z1  — Risk Score ring + Setback chip (D-RISK-18) + Confidence chip (level)
//   Z2  — 5×5 cross-map (Invention 19 · CrossMap5x5)
//   Z3  — 7-dimension breakdown (DimRow with D6 sub-chips · D-RISK-D6-SUBSCORING)
//   Z4  — Protection gap card
//   Z5  — Shock scenarios from runShock() (engine recompute, no hardcoded delta)
//   Z6  — Confidence card
//   Z7  — Life-event re-open prompts (lifeEventPaths)
//   Z8  — Risk score history (calcRiskHistory · own picker, distinct from X28)
//   Z9  — Take Action top 3 (calcAPQ filtered/sorted by riskScore impact)
//   Z10 — Universal "+" Add Protection floating button
//   Z11 — "What would help most" lens (whatWouldHelpMost)
//   Z12 — X28 protection plan anchor (always rendered · D-RISK-20-ALL-USERS)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from 'react'
import DecisionDrawers from '../components/Decisions/DecisionDrawers.jsx'
import { useEventsFor } from '../state/events.jsx'
// S1 selector migration (Phase 2): canonical netWorth via facade. Other
// risk-specific helpers stay in fq-calculator (their re-export through
// selectors would force every screen to take the selector module on as
// a structural dependency without benefit).
import {
  netWorth,
  fq as calcFQ,
} from '../engine/selectors/index.js'
import {
  fmt, fqBand,
  calcRisk, riskBand, financialProfile, riskBreakdown,
  calcAPQ, planFor,
  calcRiskHistory,
  riskShockSuite, whatWouldHelpMost as engineWhatHelpsMost, lifeEventPaths, shockTrajectory,
  runShock, SHOCK_PARAM_DEFAULTS,
} from '../engine/fq-calculator.js'
import { BRAND } from '../config/brand.js'
// TripleAnchor intentionally NOT used on Risk — spec §2.3 + §2.7 D-ANCHOR-2
// invert the hierarchy here (Risk primary, Wealth + NW secondary). The shared
// TripleAnchor renders NW-dominant for every other tab, so Risk uses a local
// RiskPrimaryAnchor block instead. (`fmt` is already imported above.)
import {
  CrossMap5x5, DiffBadge, ExplainerChip,
  Num, FadeInOnMount, RevealStagger, DrawSVG, RevealCard,
  // X28TopBar deliberately not imported — spec §33c O-RISK-17 bans X28 on Risk.
} from '../components/shared/index.js'
import ProtectionGap from '../components/Risk/ProtectionGap.jsx'
import QuestionBankEditor from '../components/Risk/QuestionBankEditor.jsx'

// ── Engine-band → CrossMap5x5 prop mapper ─────────────────────────────────
const FQ_NAME_MAP = {
  exposed:'foundation', exception:'foundation', foundation:'foundation',
  building:'building',  established:'established',
  optimised:'growing',  optimized:'growing', growing:'growing',
  exceptional:'exceptional',
}
const RS_NAME_MAP = {
  exposed:'vulnerable', vulnerable:'vulnerable',
  cautious:'cautious',  managed:'managed',
  protected:'protected', resilient:'resilient',
}
const mapFqBand   = (n='') => FQ_NAME_MAP[String(n).toLowerCase()] || 'building'
const mapRiskBand = (n='') => RS_NAME_MAP[String(n).toLowerCase()] || 'cautious'

// ── Risk dimension config ─────────────────────────────────────────────────
const DIMS = [
  { key:'incomeRes',        label:'Income Resilience',     max:20, icon:'◈' },
  { key:'liquidity',        label:'Liquidity Buffer',      max:18, icon:'◉' },
  { key:'protCov',          label:'Protection Coverage',   max:18, icon:'◐' },
  { key:'debtVuln',         label:'Debt Vulnerability',    max:15, icon:'⚖' },
  { key:'concRisk',         label:'Concentration Risk',    max:12, icon:'◎' },
  { key:'depExp',           label:'Dependency Exposure',   max:10, icon:'◑' },
  { key:'behaviouralTrack', label:'Behavioural Track',     max:7,  icon:'◷' },
]
const RISK_DIM_DESCRIPTIONS = {
  incomeRes:        'How resilient your income is — number of sources, stability, and what happens if the primary source stops.',
  liquidity:        'Whether you hold enough accessible cash to absorb a shock without selling investments.',
  protCov:          'How well protected you are against loss of income, death, or serious illness.',
  debtVuln:         'Whether your debt level amplifies your financial risks — leverage, debt service, and rate exposure.',
  concRisk:         'Whether your wealth and income are over-concentrated in a single asset, employer, or asset class.',
  depExp:           'Whether people who depend on you would be provided for — will, nominations, power of attorney, and a named guardian.',
  behaviouralTrack: 'Your demonstrated financial behaviour on the platform over time. Starts at zero — earns through action.',
}

// ── Dim bar colour by % of max ────────────────────────────────────────────
function dimColor(score, max) {
  const pct = score / (max || 1)
  if (pct >= 0.80) return 'var(--c-success)'
  if (pct >= 0.60) return 'var(--c-accent)'
  if (pct >= 0.40) return 'var(--c-warning)'
  if (pct >= 0.20) return 'var(--c-danger)'
  return 'var(--c-danger)'
}

// ── D6 Dependency-Exposure sub-scoring (D-RISK-D6-SUBSCORING) ─────────────
function d6SubScores(entity) {
  const a    = entity.assets   || {}
  const prot = a.protection    || {}
  const dependants = entity.dependants?.length || 0
  const will =
    entity.willStatus === 'current' ? 6 :
    entity.willStatus === 'basic' || entity.willStatus === 'outdated' ? 3 : 0
  const lpa =
    entity.lpaStatus === 'both' ? 6 :
    entity.lpaStatus === 'financial_only' || entity.lpaStatus === 'health_only' ? 3 : 0
  const noms = entity.nominationsStatus === 'all' ? 6 :
               entity.nominationsStatus === 'partial' ? 3 : 0
  const life = prot.lifeInsurance?.exists
    ? (prot.lifeInsurance?.inTrust ? 6 : 3)
    : (dependants === 0 ? 6 : 0)
  const guard = dependants === 0 ? 6
              : entity.guardianStatus === 'formal' ? 6
              : entity.guardianStatus === 'informal' ? 3 : 0
  return [
    { key:'will',      label:'Will',          v: will  },
    { key:'lpa',       label:'Power of attorney', v: lpa },
    { key:'noms',      label:'Nominations',   v: noms  },
    { key:'trust',     label:'Life-in-trust', v: life  },
    { key:'guardian',  label:'Guardian',      v: guard },
  ]
}

// ── Animated ring gauge (1500ms elastic settle + counter-up) ──────────────
function RiskRing({ score, band }) {
  const R = 80, CIRC = 2 * Math.PI * R
  const [fill, setFill] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setFill(score), 80)
    return () => clearTimeout(t)
  }, [score])

  return (
    <svg viewBox="0 0 200 200" width="200" height="200" style={{ overflow:'visible' }}>
      {[0.2,0.4,0.6,0.8].map(r => (
        <circle key={r} cx={100} cy={100} r={r*(R-4)} fill="none"
          stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
      ))}
      <circle cx={100} cy={100} r={R} fill="none"
        stroke="rgba(255,255,255,0.08)" strokeWidth="14" />
      <circle cx={100} cy={100} r={R} fill="none"
        stroke={band.colour} strokeWidth="14" strokeLinecap="round"
        strokeDasharray={`${(fill/100)*CIRC} ${CIRC}`}
        strokeDashoffset={CIRC * 0.25}
        style={{ transition:'stroke-dasharray 1500ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}
      />
      <foreignObject x="40" y="68" width="120" height="48">
        <div style={{
          width:'100%', height:'100%', display:'flex',
          alignItems:'center', justifyContent:'center',
          fontFamily:'DM Sans, sans-serif',
          fontSize:38, fontWeight:900, color:'var(--c-text)',
          letterSpacing:-2, lineHeight:1,
        }}>
          <Num value={score} format="score" animate />
          {/* V-6 fix (2026-05-28): denominator dropped. Prior "/93" leaked the
              dimension max-cap into the user-facing display (BTR is 0 at
              launch, so the engine's effective ceiling is 93). Users read
              "71/93" as a fraction with an arbitrary denominator. The band
              label ("Protected" / "Stretched" / etc.) below is enough context;
              the number stands on its own like the Wealth Score. */}
        </div>
      </foreignObject>
      <text x={100} y={120} textAnchor="middle"
        fontSize="11" fontWeight="700" fill={band.colour}
        fontFamily="DM Sans, sans-serif">
        {band.name}
      </text>
      <text x={100} y={136} textAnchor="middle"
        fontSize="11" fill="var(--c-text3)"
        fontFamily="DM Sans, sans-serif">
        Risk Score
      </text>
    </svg>
  )
}

// ── Confidence chip — semantic level only (§8.1) ──────────────────────────
function ConfBadge({ level }) {
  const cls = level === 'high'   ? 'sw-chip sw-chip-sm sw-chip-blue'
             : level === 'medium' ? 'sw-chip sw-chip-sm sw-chip-amber'
             :                      'sw-chip sw-chip-sm sw-chip-coral'
  const label = level === 'high'   ? 'High confidence'
               : level === 'medium' ? 'Medium confidence'
               :                      'Low confidence'
  return <span className={cls}>{label}</span>
}

// ── Setback chip (D-RISK-18) — pulse-glow when triggered ──────────────────
function SetbackChip({ entity }) {
  try {
    const hist = calcRiskHistory(entity, '1mo')?.points || []
    if (hist.length < 2) return null
    const start = hist[0].score, end = hist[hist.length - 1].score
    const drop = start - end
    if (drop >= 5) {
      return (
        <span className="sw-pulse-glow" style={{
          display:'inline-block', borderRadius:100,
          color:'var(--c-danger)',
        }}>
          <DiffBadge value={-drop}>Setback</DiffBadge>
        </span>
      )
    }
  } catch {}
  return null
}

// ── AI chip (RISK-AI-1..8) — dispatches sonus:ask custom event ────────────
// Catalogue of chip → seed question. Keeps copy close to where it surfaces so
// the chip label and the question Ask Sonu opens with stay aligned.
const RISK_AI_QUESTIONS = {
  'RISK-AI-1': 'Walk me through my Risk Score — what are the biggest drivers right now?',
  'RISK-AI-2': 'Where am I most exposed if income stopped tomorrow?',
  'RISK-AI-3': 'For this scenario, what would I actually do in the first 30 days?',
  'RISK-AI-4': 'Is my protection coverage roughly right for my situation?',
  'RISK-AI-5': 'What is the cheapest single move that improves my Risk Score?',
  'RISK-AI-6': 'I had a life event — which Risk dimensions should I re-check?',
  'RISK-AI-7': 'Explain my Dependency Exposure sub-scores in plain English.',
  'RISK-AI-8': 'Of the recommended actions, which one should I do first and why?',
}
function AskChip({ id = 'RISK-AI-1', label = 'Ask Sonu' }) {
  const open = (e) => {
    e.stopPropagation()
    const question = RISK_AI_QUESTIONS[id] || label
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('sonus:ask', {
        detail: { question, seed: { surface: 'risk', chipId: id } },
      }))
    }
  }
  return (
    <button
      data-ai-chip={id}
      className="sw-chip sw-chip-sm sw-chip-mint sw-chip-outline sw-press"
      style={{ marginLeft:8, cursor:'pointer' }}
      onClick={open}
    >
      ⌘ {label}
    </button>
  )
}

// ── Financial profile cell (elevated card, hero band-name) ────────────────
function ProfileCell({ profile }) {
  if (!profile) return null
  return (
    <FadeInOnMount delay={120}>
      <div className="card sw-card-elevated sw-lift" style={{
        marginBottom:12, textAlign:'center',
        background:'linear-gradient(180deg, rgba(45,242,195,0.04), var(--c-surface))',
        borderColor:'rgba(45,242,195,0.18)',
      }}>
        <div className="sw-eyebrow" style={{ marginBottom:8 }}>
          {BRAND.financialProfile}
        </div>
        <div className="sw-hero-md" style={{ marginBottom:8, color:'var(--c-text)' }}>
          {(profile.profileName || '').replace(/ \/ /g, ' · ')}
        </div>
        <div style={{ fontSize:13, color:'var(--c-text2)', lineHeight:1.55 }}>
          {profile.profileImplication}
        </div>
      </div>
    </FadeInOnMount>
  )
}

// ── Dimension row with progress bar (sw-bar) ──────────────────────────────
// CRIT 1.3 — D7 Behavioural Track is hardcoded 0 in the engine. Rendering
// "0/7" in danger-red implies a measured failure; reality is "no history yet".
// We special-case D7 here so the row reads "Building track record — needs 90
// days" in a neutral grey, not a red 0.
function DimRow({ dimCfg, score, entity, onTap }) {
  const isBTRBuilding = dimCfg.key === 'behaviouralTrack' && score === 0
  const pct   = Math.round((score / dimCfg.max) * 100)
  const color = isBTRBuilding ? 'var(--c-text3)' : dimColor(score, dimCfg.max)
  // Stagger the fill animation so it doesn't fire instantly with mount
  const [w, setW] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setW(pct), 120)
    return () => clearTimeout(t)
  }, [pct])
  return (
    <div onClick={() => onTap(dimCfg)} className="sw-press" style={{
      display:'flex', alignItems:'center', gap:10,
      padding:'10px 0', borderBottom:'1px solid var(--c-sep)',
      cursor:'pointer',
    }}>
      <div style={{ width:7, height:7, borderRadius:'50%',
        background:color, flexShrink:0 }} />
      <div style={{ fontSize:13, color:'var(--c-text2)', width:140, flexShrink:0 }}>
        {dimCfg.label}
      </div>
      {isBTRBuilding ? (
        <div style={{
          flex:1, fontSize:11, color:'var(--c-text3)', fontStyle:'italic',
          lineHeight:1.3,
        }}>
          Building track record — needs 90 days of activity
        </div>
      ) : (
        <div className="sw-bar" style={{ flex:1 }}>
          <div className="fill" style={{
            width:`${w}%`, background:color,
            transition:'width 800ms cubic-bezier(0.16, 1, 0.3, 1)',
          }} />
        </div>
      )}
      <div style={{ fontSize:13, fontWeight:700, color, width:36,
        textAlign:'right', flexShrink:0 }}>
        {isBTRBuilding ? '—' : `${score}/${dimCfg.max}`}
      </div>
      <div style={{ fontSize:14, color:'var(--c-text3)', flexShrink:0 }}>›</div>
    </div>
  )
}

// ── 7-dimension panel with 3-view toggle (Radar · Orbit · Bars) ────────────
// Spec v1.6: per-dim breakdown should be viewable as heptagonal radar, orbiting
// nodes, or stacked bars. Bars is the default for accessibility; Radar makes
// strong/weak shape obvious at a glance; Orbit gives each dim equal visual
// weight regardless of score.
function DimensionsPanel({ dims, risk, entity, onTap }) {
  const [view, setView] = useState('bars')
  const items = dims.map(d => ({
    ...d,
    score: risk.dims?.[d.key] || 0,
    pct:   Math.round(((risk.dims?.[d.key] || 0) / d.max) * 100),
  }))
  // Band colour drives the radar polygon stroke + tinted fill so the shape
  // reads as "vulnerable/cautious/protected/resilient" at a glance instead
  // of always lying mint-green. (CRIT 1.5 — radar-green half-fix.)
  const bandColour = risk.band?.colour || riskBand(risk.total).colour
  return (
    <div className="card sw-lift">
      <div className="sw-eyebrow" style={{ marginBottom: 8 }}>Resilience</div>
      <div className="card-title" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>Resilience Dimensions</span>
        <ExplainerChip id="RISK-1" />
      </div>
      <div role="tablist" style={{
        display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
        gap: 4, padding: 4, margin: '8px 0 12px',
        border: '1px solid var(--c-sep)', borderRadius: 14,
        background: 'var(--c-surface2)',
      }}>
        {['radar', 'orbit', 'bars'].map(v => {
          const active = view === v
          return (
            <button key={v} role="tab" aria-selected={active}
              onClick={() => setView(v)}
              className="sw-press"
              style={{
                minHeight: 30, border: 0, borderRadius: 10, cursor: 'pointer',
                background: active ? 'var(--c-surface)' : 'transparent',
                color: active ? 'var(--c-text)' : 'var(--c-text3)',
                fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                textTransform: 'uppercase',
                boxShadow: active ? '0 4px 12px rgba(0,0,0,0.10)' : 'none',
              }}>{v}</button>
          )
        })}
      </div>
      {view === 'radar' && <RadarHeptaView items={items} onTap={onTap} bandColour={bandColour} />}
      {view === 'orbit' && <OrbitView items={items} onTap={onTap} />}
      {view === 'bars'  && (
        <RevealStagger interval={60}>
          {dims.map(d => (
            <DimRow key={d.key} dimCfg={d}
              score={risk.dims?.[d.key] || 0}
              entity={entity} onTap={onTap} />
          ))}
        </RevealStagger>
      )}
    </div>
  )
}

// Hex / CSS-var → rgba helper. Falls back to the raw colour for fill so
// CSS vars still render (browsers ignore an invalid rgba and use stroke).
function bandFillAlpha(colour, alpha = 0.18) {
  if (!colour) return `rgba(0,229,168,${alpha})`
  const c = String(colour).trim()
  // #RGB or #RRGGBB
  const hex = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (hex) {
    let h = hex[1]
    if (h.length === 3) h = h.split('').map(x => x + x).join('')
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    return `rgba(${r},${g},${b},${alpha})`
  }
  // rgb(r,g,b) → rgba
  const rgb = c.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i)
  if (rgb) return `rgba(${rgb[1]},${rgb[2]},${rgb[3]},${alpha})`
  // CSS var or unknown → use color-mix so it scales with theme
  return `color-mix(in srgb, ${c} ${Math.round(alpha * 100)}%, transparent)`
}

// Radar view — heptagonal SVG. 7 spokes at 360/7°; polygon at score fraction.
// `bandColour` drives stroke + tinted fill so a vulnerable persona sees a red
// polygon, not the old hard-coded mint.
function RadarHeptaView({ items, onTap, bandColour = 'var(--c-acc)' }) {
  const SIZE = 280, CX = SIZE / 2, CY = SIZE / 2, R = SIZE * 0.34
  const angles = items.map((_, i) => (Math.PI * 2 * (i / items.length)) - Math.PI / 2)
  const guidePolys = [0.25, 0.5, 0.75, 1].map(s => (
    items.map((_, i) => {
      const a = angles[i]
      return `${(CX + Math.cos(a) * R * s).toFixed(1)},${(CY + Math.sin(a) * R * s).toFixed(1)}`
    }).join(' ')
  ))
  const polyPts = items.map((d, i) => {
    const frac = d.max ? (d.score / d.max) : 0
    const a = angles[i]
    return `${(CX + Math.cos(a) * R * frac).toFixed(1)},${(CY + Math.sin(a) * R * frac).toFixed(1)}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" style={{ display: 'block' }}>
      {guidePolys.map((p, i) => (
        <polygon key={i} points={p} fill="none"
          stroke="var(--c-sep)" strokeWidth="0.5" opacity="0.55" />
      ))}
      {items.map((_, i) => {
        const a = angles[i]
        return <line key={i}
          x1={CX} y1={CY}
          x2={(CX + Math.cos(a) * R).toFixed(1)}
          y2={(CY + Math.sin(a) * R).toFixed(1)}
          stroke="var(--c-sep)" strokeWidth="0.5" opacity="0.5" />
      })}
      <polygon points={polyPts}
        className="sw-stroke-draw"
        fill={bandFillAlpha(bandColour, 0.18)} stroke={bandColour} strokeWidth="2"
        strokeDasharray="600"
        style={{
          '--sw-draw-len': '600',
          filter: `drop-shadow(0 0 12px ${bandFillAlpha(bandColour, 0.45)})`,
        }} />
      {items.map((d, i) => {
        const a = angles[i]
        const cx = CX + Math.cos(a) * R * (d.max ? d.score / d.max : 0)
        const cy = CY + Math.sin(a) * R * (d.max ? d.score / d.max : 0)
        const lx = CX + Math.cos(a) * (R + 24)
        const ly = CY + Math.sin(a) * (R + 24)
        const color = dimColor(d.score, d.max)
        return (
          <g key={d.key} style={{ cursor: 'pointer' }}
            onClick={() => onTap?.(d)}>
            <circle cx={cx} cy={cy} r="4" fill={color} />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
              fontSize="9" fontWeight="700" fill="var(--c-text2)"
              fontFamily="DM Sans,sans-serif">
              {d.label.split(' ')[0]}
            </text>
            <text x={lx} y={ly + 10} textAnchor="middle" dominantBaseline="middle"
              fontSize="9" fill="var(--c-text3)" fontFamily="DM Sans,sans-serif">
              {d.pct}%
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// Orbit view — 7 nodes positioned around a centre cap showing total/100.
function OrbitView({ items, onTap }) {
  const PCT_R = 36  // node ring radius as % of container
  const total = items.reduce((s, d) => s + d.score, 0)
  return (
    <div style={{
      position: 'relative', width: '100%', aspectRatio: '1/1',
      maxWidth: 280, margin: '0 auto',
    }}>
      {[20, 32, 46].map(p => (
        <div key={p} style={{
          position: 'absolute', inset: `${p}%`,
          border: '1px solid var(--c-sep)', borderRadius: '50%', opacity: 0.5,
        }} />
      ))}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%,-50%)',
        width: '36%', height: '36%', display: 'grid', placeItems: 'center',
        textAlign: 'center', border: '1px solid var(--c-sep)',
        borderRadius: '50%', background: 'var(--c-surface)',
        padding: 4,
      }}>
        {/* HIGH 1.4 — centre no longer says "78/100" (duplicate of ring).
            Label as composite of the 7 dimensions so it reads as a sum. */}
        <div>
          <div style={{ fontSize: 9, color: 'var(--c-text3)', fontWeight: 700, letterSpacing: 0.4 }}>
            COMPOSITE
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--c-text)', lineHeight: 1 }}>
            {total}
          </div>
          <div style={{ fontSize: 8, color: 'var(--c-text3)', marginTop: 1, lineHeight: 1.2 }}>
            sum of 7 dims
          </div>
        </div>
      </div>
      {items.map((d, i) => {
        const a = (Math.PI * 2 * (i / items.length)) - Math.PI / 2
        const x = 50 + PCT_R * Math.cos(a)
        const y = 50 + PCT_R * Math.sin(a)
        const color = dimColor(d.score, d.max)
        return (
          <button key={d.key} onClick={() => onTap?.(d)}
            className="sw-press"
            style={{
              position: 'absolute', left: `${x}%`, top: `${y}%`,
              transform: 'translate(-50%,-50%)',
              width: 64, padding: '6px 4px',
              border: `1px solid ${color}55`, borderRadius: 14,
              background: 'var(--c-surface)', cursor: 'pointer',
              display: 'grid', placeItems: 'center', gap: 2,
              fontSize: 10, color,
            }}>
            <strong style={{ fontSize: 14, fontWeight: 800, lineHeight: 1 }}>{d.pct}</strong>
            <span style={{ fontSize: 9, color: 'var(--c-text2)', textAlign: 'center', lineHeight: 1.1 }}>
              {d.label.split(' ')[0]}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── D6 questionnaire — 5 questions feeding dependency-exposure sub-scores ──
// Spec: Risk Layer v1.6 — D6 input flow + life-event re-open matrix (16 event
// subtypes, deferred). This wave delivers the multi-step input UI and fires a
// `risk_questionnaire_committed` event with all 5 answers. Engine consumption
// of the event (mapping answers into entity.willStatus / lpaStatus / etc.) is
// follow-up engine work — out of scope here.
const D6_QUESTIONS = [
  {
    id: 'willStatus',
    title: 'Is your will up to date?',
    sub: 'Updated within the last 5 years, reflects current wishes, names current executors.',
    options: [
      { value: 'current', label: 'Yes — current and reviewed', tone: 'good' },
      { value: 'basic',   label: 'Have one, may be outdated',  tone: 'warn' },
      { value: 'none',    label: 'No will / not sure',         tone: 'bad'  },
    ],
  },
  {
    id: 'lpaStatus',
    title: 'Do you have a Power of Attorney (LPA)?',
    sub: 'A LPA lets someone you trust act for you if you lose capacity. Two types: property + finance, and health + welfare.',
    options: [
      { value: 'both',            label: 'Yes — both types in place',    tone: 'good' },
      { value: 'financial_only',  label: 'Property + finance only',       tone: 'warn' },
      { value: 'health_only',     label: 'Health + welfare only',         tone: 'warn' },
      { value: 'none',            label: 'No LPA in place',               tone: 'bad'  },
    ],
  },
  {
    id: 'nominationsStatus',
    title: 'Are pension and death-benefit nominations recorded?',
    sub: 'Nominations tell your pension or insurance provider who should receive the funds. Without one, decisions fall to the scheme trustees.',
    options: [
      { value: 'all',     label: 'All providers have nominations',  tone: 'good' },
      { value: 'partial', label: 'Some recorded, some missing',     tone: 'warn' },
      { value: 'none',    label: 'None recorded / unsure',          tone: 'bad'  },
    ],
  },
  {
    id: 'lifeInTrust',
    title: 'Is your life cover written in trust?',
    sub: 'Life insurance written in trust pays out faster and stays outside the estate for inheritance tax. Most people skip this step.',
    options: [
      { value: 'in_trust', label: 'Yes — written in trust',     tone: 'good' },
      { value: 'exists',   label: 'I have cover but not in trust', tone: 'warn' },
      { value: 'none',     label: 'No life cover',              tone: 'bad'  },
    ],
  },
  {
    id: 'guardianStatus',
    title: 'Are guardians named for any dependants?',
    sub: 'Anyone who relies on you financially or for care. If you have no dependants, the answer is automatically "fully covered".',
    options: [
      { value: 'formal',         label: 'Yes — named in will',            tone: 'good' },
      { value: 'informal',       label: 'Informal arrangement only',      tone: 'warn' },
      { value: 'none',           label: 'No guardians named',             tone: 'bad'  },
      { value: 'no_dependants',  label: 'No dependants',                  tone: 'good' },
    ],
  },
]

function D6Questionnaire({ entity, onClose, onCommit }) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState(() => ({
    willStatus:        entity.willStatus || null,
    lpaStatus:         entity.lpaStatus || null,
    nominationsStatus: entity.nominationsStatus || null,
    lifeInTrust:       entity.assets?.protection?.lifeInsurance?.inTrust ? 'in_trust'
                     : entity.assets?.protection?.lifeInsurance?.exists  ? 'exists'
                     : null,
    guardianStatus:    entity.guardianStatus || (entity.dependants?.length ? null : 'no_dependants'),
  }))
  const q = D6_QUESTIONS[step]
  const total = D6_QUESTIONS.length
  const picked = answers[q.id]
  const complete = D6_QUESTIONS.every(qq => answers[qq.id] != null)

  function pick(v) {
    setAnswers(a => ({ ...a, [q.id]: v }))
  }
  function next() {
    if (step < total - 1) setStep(s => s + 1)
  }
  function back() {
    if (step > 0) setStep(s => s - 1)
  }
  function submit() {
    onCommit?.({
      type: 'risk_questionnaire_committed',
      ts: Date.now(),
      correlation_id: `risk-d6-${Date.now()}`,
      payload: { source: 'D6', answers },
    })
    onClose?.()
  }

  return (
    <div className="sheet-overlay">
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet-panel sw-fade-in-up" style={{ maxHeight:'88vh', overflowY:'auto' }}>
        <div className="sheet-handle" />

        {/* Progress strip */}
        <div style={{
          display:'flex', gap:4, marginBottom:16,
        }}>
          {D6_QUESTIONS.map((_, i) => (
            <div key={i} style={{
              flex:1, height:3, borderRadius:100,
              background: i <= step ? 'var(--c-acc)' : 'var(--c-surface2)',
              transition:'background .25s',
            }} />
          ))}
        </div>

        <div className="sw-eyebrow" style={{ marginBottom:6 }}>
          Step {step + 1} of {total} · Dependency questionnaire
        </div>
        <div style={{
          fontSize:17, fontWeight:800, color:'var(--c-text)', marginBottom:8,
          letterSpacing:-0.1,
        }}>
          {q.title}
        </div>
        <div style={{ fontSize:12, color:'var(--c-text3)', lineHeight:1.6, marginBottom:16 }}>
          {q.sub}
        </div>

        {/* Options */}
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
          {q.options.map(o => {
            const active = picked === o.value
            const toneBorder = o.tone === 'good' ? 'rgba(0,229,168,0.45)'
                             : o.tone === 'warn' ? 'rgba(255,179,71,0.45)'
                             : 'rgba(255,111,125,0.45)'
            const toneBg = o.tone === 'good' ? 'rgba(0,229,168,0.10)'
                         : o.tone === 'warn' ? 'rgba(255,179,71,0.10)'
                         : 'rgba(255,111,125,0.10)'
            return (
              <button key={o.value} onClick={() => pick(o.value)}
                className="sw-press"
                style={{
                  textAlign:'left', cursor:'pointer',
                  padding:'12px 14px', borderRadius:12,
                  background: active ? toneBg : 'var(--c-surface2)',
                  border: active ? `1.5px solid ${toneBorder}` : '1px solid var(--c-sep)',
                  color:'var(--c-text)', fontSize:14, fontWeight: active ? 700 : 500,
                  display:'flex', alignItems:'center', gap:10,
                }}>
                <span style={{
                  width:18, height:18, borderRadius:'50%',
                  border: `2px solid ${active ? toneBorder : 'var(--c-sep)'}`,
                  background: active ? toneBorder : 'transparent',
                  flexShrink:0,
                }} />
                {o.label}
              </button>
            )
          })}
        </div>

        {/* Nav buttons */}
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={back} disabled={step === 0} className="sw-press"
            style={{
              padding:'10px 16px', fontSize:13, fontWeight:700,
              background:'transparent', color:'var(--c-text3)',
              border:'1px solid var(--c-border)', borderRadius:100,
              cursor: step === 0 ? 'not-allowed' : 'pointer',
              opacity: step === 0 ? 0.5 : 1,
            }}>
            Back
          </button>
          {step < total - 1 ? (
            <button onClick={next} disabled={!picked} className="sw-press"
              style={{
                flex:1, padding:'10px 16px', fontSize:13, fontWeight:700,
                background:'var(--c-acc)', color:'var(--c-bg)',
                border:'none', borderRadius:100,
                cursor: !picked ? 'not-allowed' : 'pointer',
                opacity: !picked ? 0.5 : 1,
              }}>
              Next →
            </button>
          ) : (
            <button onClick={submit} disabled={!complete} className="sw-press"
              style={{
                flex:1, padding:'10px 16px', fontSize:13, fontWeight:800,
                background:'var(--c-acc)', color:'var(--c-bg)',
                border:'none', borderRadius:100,
                cursor: !complete ? 'not-allowed' : 'pointer',
                opacity: !complete ? 0.5 : 1,
              }}>
              Submit answers
            </button>
          )}
          <button onClick={onClose} className="sw-press"
            style={{
              padding:'10px 16px', fontSize:13, fontWeight:700,
              background:'transparent', color:'var(--c-text3)',
              border:'1px solid var(--c-border)', borderRadius:100,
              cursor:'pointer',
            }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── D6 Sub-chip row (staggered fan-in inside DimSheet) ────────────────────
function D6SubChips({ entity, onCommit }) {
  const subs = d6SubScores(entity)
  const [qOpen, setQOpen] = useState(false)
  return (
    <div style={{ marginBottom:14 }}>
      <div className="sw-eyebrow" style={{ marginBottom:8 }}>
        Sub-score breakdown
      </div>
      <RevealStagger interval={50} style={{
        display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:6,
      }}>
        {subs.map(s => (
          <div key={s.key} style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'6px 10px', borderRadius:8,
            background:'var(--c-surface2)',
            border:'1px solid var(--c-sep)',
          }}>
            <span style={{ fontSize:12, color:'var(--c-text2)' }}>{s.label}</span>
            <span style={{ fontSize:12, fontWeight:700,
              color: s.v === 6 ? 'var(--c-success)' : s.v === 3 ? 'var(--c-warning)' : 'var(--c-danger)' }}>
              {s.v === 6 ? '✓' : s.v === 3 ? '◐' : '○'} {s.v}/6
            </span>
          </div>
        ))}
      </RevealStagger>
      <button onClick={() => setQOpen(true)} className="sw-press"
        style={{
          marginTop:10, width:'100%',
          padding:'10px 14px', fontSize:12, fontWeight:700,
          background:'var(--c-acc)', color:'var(--c-bg)',
          border:'none', borderRadius:100, cursor:'pointer',
          letterSpacing:0.4,
        }}>
        Update answers — 60-second questionnaire →
      </button>
      {qOpen && (
        <D6Questionnaire
          entity={entity}
          onClose={() => setQOpen(false)}
          onCommit={onCommit}
        />
      )}
    </div>
  )
}

// ── Dimension detail sheet ────────────────────────────────────────────────
function DimSheet({ dimCfg, score, entity, onClose, onCommit }) {
  if (!dimCfg) return null
  const pct   = Math.round((score / dimCfg.max) * 100)
  const color = dimColor(score, dimCfg.max)
  return (
    <div className="sheet-overlay">
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet-panel sw-fade-in-up">
        <div className="sheet-handle" />
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
          <div style={{ width:44, height:44, borderRadius:12,
            background:`${color}22`, display:'flex', alignItems:'center',
            justifyContent:'center', fontSize:20 }}>
            {dimCfg.icon}
          </div>
          <div>
            <div style={{ fontSize:17, fontWeight:800, color:'var(--c-text)' }}>
              {dimCfg.label}
            </div>
            <div style={{ fontSize:13, color, fontWeight:600, marginTop:2 }}>
              {score}/{dimCfg.max} · {pct}% of maximum
            </div>
          </div>
        </div>
        <div style={{ fontSize:14, color:'var(--c-text2)', lineHeight:1.7,
          marginBottom:16 }}>
          {RISK_DIM_DESCRIPTIONS[dimCfg.key]}
        </div>

        {/* Traceability — every dimension value decomposes to its components
            (founder: "every value presented must be traceable"). Sourced from
            riskBreakdown(), which mirrors calcRisk D1–D7 (zero-drift). */}
        {(() => {
          let bd = null
          try { bd = riskBreakdown(entity)[dimCfg.key] } catch {}
          if (!bd?.parts?.length) return null
          return (
            <div style={{ background:'var(--c-surface2)',
              border:'1px solid var(--c-border)', borderRadius:12,
              padding:12, marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--c-text3)',
                textTransform:'uppercase', letterSpacing:0.4, marginBottom:8 }}>
                How this is built
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {bd.parts.map((pp, i) => (
                  <div key={i} style={{ display:'flex',
                    justifyContent:'space-between', gap:12, fontSize:13,
                    color:'var(--c-text2)' }}>
                    <span>{pp.label}</span>
                    <span style={{ fontWeight:700, color:'var(--c-text)',
                      flexShrink:0 }}>
                      {pp.band ? bd.value : `${pp.points >= 0 ? '+' : ''}${pp.points}`}
                    </span>
                  </div>
                ))}
                <div style={{ display:'flex', justifyContent:'space-between',
                  fontSize:13, fontWeight:800, color:'var(--c-text)',
                  borderTop:'1px solid var(--c-sep)', paddingTop:6, marginTop:2 }}>
                  <span>Total</span><span>{bd.value} of {bd.max}</span>
                </div>
              </div>
            </div>
          )
        })()}

        {dimCfg.key === 'depExp' && <D6SubChips entity={entity} onCommit={onCommit} />}

        {dimCfg.key === 'behaviouralTrack' && (
          <div style={{ background:'rgba(255,179,71,.08)',
            border:'1px solid rgba(255,179,71,.25)', borderRadius:12,
            padding:12, marginBottom:16 }}>
            <div style={{ fontSize:13, color:'var(--c-warning)', fontWeight:700,
              marginBottom:4 }}>
              How to earn points
            </div>
            <div style={{ fontSize:13, color:'var(--c-text2)', lineHeight:1.6 }}>
              Complete APQ actions, update profile after life events, respond to deadline prompts, upload documents when asked. Points accumulate over time — not immediately.
            </div>
          </div>
        )}
        <button onClick={onClose} className="sw-press" style={{ width:'100%',
          background:'var(--c-acc2)', color:'var(--c-bg)', border:'none',
          borderRadius:100, padding:'13px 0', fontSize:14,
          fontWeight:700, cursor:'pointer' }}>
          Got it
        </button>
      </div>
    </div>
  )
}

// ── Shock card routing map (FD-CROSS-1) ──────────────────────────────────────
const SHOCK_HANDOFF = {
  job_loss:    { nav: 'money', label: 'Review my finances →' },
  market_fall: { nav: 'money', label: 'Review drawdown plan →' },
  illness:     { nav: 'money', label: 'Add protection →' },
  rate_rise:   { nav: 'flow',  label: 'Review cashflow →' },
  death:       { nav: 'tax',   label: 'Review estate plan →' },
}

// ── Grabbable scrub track (drag the filled bar OR key the range mirror) ───────
// Ported from TaxEstate ScrubTrack / DecisionCharts startScrub: relative drag
// (no jump-to-cursor) + keyboard-accessible <input type=range>. Both drive the
// same value, so every dependent £-figure + trajectory below rescales live.
function ShockScrub({ value, min, max, step = 1, onChange, colour = 'var(--c-danger)', ariaLabel, valueText }) {
  const pct = max > min ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)) : 0
  const startScrub = (e) => {
    e.preventDefault()
    const el = e.currentTarget
    const trackW = el.getBoundingClientRect().width || 1
    const x0 = e.clientX, v0 = Number(value)
    try { el.setPointerCapture(e.pointerId) } catch {}
    const move = (ev) => {
      const dx = (ev.clientX ?? x0) - x0
      let v = v0 + (dx / trackW) * (max - min)
      v = Math.round(v / step) * step
      onChange(Math.max(min, Math.min(max, v)))
    }
    const end = () => {
      try { el.releasePointerCapture(e.pointerId) } catch {}
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', end)
      el.removeEventListener('pointercancel', end)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', end)
    el.addEventListener('pointercancel', end)
  }
  return (
    <div>
      <div onPointerDown={startScrub}
        title="Drag to change the shock — the £ impact and trajectory below update together"
        style={{
          position:'relative', height:20, borderRadius:7,
          background:'var(--c-surface2)', border:'1px solid var(--c-border)',
          overflow:'hidden', cursor:'ew-resize', touchAction:'none',
        }}>
        <div style={{ width:`${pct}%`, height:'100%', borderRadius:5, background:colour,
          minWidth: pct > 0 ? 4 : 0, transition:'width .08s linear' }} />
        <div aria-hidden style={{ position:'absolute', right:6, top:0, bottom:0,
          display:'flex', alignItems:'center', gap:2, pointerEvents:'none', opacity:0.55 }}>
          <span style={{ width:2, height:9, borderRadius:2, background:'var(--c-text3)' }} />
          <span style={{ width:2, height:9, borderRadius:2, background:'var(--c-text3)' }} />
        </div>
      </div>
      <input type="range" min={min} max={max} step={step}
        value={value} onChange={e => onChange(Number(e.target.value))}
        aria-label={ariaLabel} aria-valuetext={valueText}
        style={{ width:'100%', accentColor:colour, marginTop:6 }} />
    </div>
  )
}

// ── Shock Lab (Z5 driver) — grab a shock, watch the £ impact + banded ─────────
// resilience trajectory re-draw LIVE. Drives runShock() + shockTrajectory()
// with dragged params (size / horizon / income-loss depth). Every figure is an
// engine output (PENDING PROFESSIONAL SIGN-OFF) — no hardcoded delta in the UI.
const SHOCK_LAB_MENU = [
  { id:'market_fall', label:'Market fall' },
  { id:'rate_rise',   label:'Rate rise' },
  { id:'job_loss',    label:'Income loss' },
  { id:'illness',     label:'Illness' },
  { id:'death',       label:'Death' },
]
function ShockLab({ entity }) {
  const [shockId, setShockId] = useState('market_fall')
  const [horizon, setHorizon] = useState(24)        // trajectory window (months)
  // Per-shock dragged params, seeded from engine defaults. Stored once; we read
  // the slice for the active shock so switching shocks keeps each one's setting.
  const [params, setParams] = useState(() => ({
    market_fall: { dropPct: 0.30 },
    rate_rise:   { riseBps: 200 },
    job_loss:    { incomeLossPct: 1.0, durationMonths: 6 },
    illness:     { incomeLossPct: 1.0, durationMonths: 6 },
    death:       {},
  }))
  const p = params[shockId] || {}
  const setP = (patch) => setParams(prev => ({ ...prev, [shockId]: { ...prev[shockId], ...patch } }))

  // Derive — never setState in render. useMemo recomputes only when the entity
  // ref, shock, params or horizon change (no entity-in-effect loop risk).
  const { result, traj } = useMemo(() => {
    let result = null, traj = null
    try { result = runShock(entity, shockId, undefined, p) } catch {}
    try { traj   = shockTrajectory(entity, shockId, horizon, p) } catch {}
    return { result, traj }
  }, [entity, shockId, JSON.stringify(p), horizon])

  // Slider config by shock type
  const sliders = []
  if (shockId === 'market_fall') {
    sliders.push({ key:'dropPct', label:'Drop size', min:5, max:80, step:5,
      get:() => Math.round((p.dropPct ?? 0.30) * 100),
      set:(v) => setP({ dropPct: v / 100 }), fmt:(v)=>`−${v}%` })
  } else if (shockId === 'rate_rise') {
    sliders.push({ key:'riseBps', label:'Rate rise', min:25, max:500, step:25,
      get:() => p.riseBps ?? 200,
      set:(v) => setP({ riseBps: v }), fmt:(v)=>`+${(v/100).toFixed(2)}%` })
  } else if (shockId === 'job_loss' || shockId === 'illness') {
    sliders.push({ key:'incomeLossPct', label:'Income lost', min:10, max:100, step:10,
      get:() => Math.round((p.incomeLossPct ?? 1.0) * 100),
      set:(v) => setP({ incomeLossPct: v / 100 }), fmt:(v)=>`${v}%` })
    sliders.push({ key:'durationMonths', label:'For how long', min:1, max:24, step:1,
      get:() => p.durationMonths ?? 6,
      set:(v) => setP({ durationMonths: v }), fmt:(v)=>`${v}mo` })
  }

  const rsDelta = result?.rsDelta ?? 0
  const nwDelta = result?.nwDelta ?? 0
  const deltaColour = rsDelta <= -10 ? 'var(--c-danger)' : rsDelta < 0 ? 'var(--c-warning)' : 'var(--c-success)'

  return (
    <div className="card sw-lift" style={{ marginBottom:12, borderColor:'rgba(255,179,71,0.28)' }}>
      <div className="sw-eyebrow" style={{ marginBottom:8 }}>Shock Lab · drag to stress-test</div>
      <div className="card-title" style={{
        display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span>Grab a shock — watch it hit live</span>
        <span style={{
          fontSize:9, fontWeight:600, letterSpacing:'0.04em', color:'var(--c-text3)',
          background:'var(--c-surface2)', border:'1px solid var(--c-sep)',
          borderRadius:4, padding:'1px 5px' }}>est · pending sign-off</span>
      </div>

      {/* Shock picker */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', margin:'10px 0 12px' }}>
        {SHOCK_LAB_MENU.map(s => (
          <button key={s.id} onClick={() => setShockId(s.id)} className="sw-press"
            style={{
              fontSize:11, fontWeight:700,
              background: shockId === s.id ? 'var(--c-acc)' : 'var(--c-surface2)',
              color:      shockId === s.id ? 'var(--c-bg)'  : 'var(--c-text2)',
              border:'1px solid var(--c-sep)', borderRadius:100,
              padding:'5px 12px', cursor:'pointer',
            }}>{s.label}</button>
        ))}
      </div>

      {/* Sliders (size / income-loss / duration) */}
      {sliders.length > 0 ? (
        <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:14 }}>
          {sliders.map(sl => {
            const cur = sl.get()
            return (
              <div key={sl.key}>
                <div style={{ display:'flex', justifyContent:'space-between',
                  alignItems:'baseline', marginBottom:5 }}>
                  <span style={{ fontSize:12, color:'var(--c-text2)', fontWeight:600 }}>{sl.label}</span>
                  <span style={{ fontSize:14, fontWeight:800, color:'var(--c-text)' }}>{sl.fmt(cur)}</span>
                </div>
                <ShockScrub value={cur} min={sl.min} max={sl.max} step={sl.step}
                  onChange={sl.set} ariaLabel={`${sl.label} for ${shockId}`}
                  valueText={sl.fmt(cur)} />
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ fontSize:12, color:'var(--c-text3)', marginBottom:14, lineHeight:1.5 }}>
          Death is modelled from your estate position under current IHT rules — there's no size to drag.
          The figures below recompute from your data.
        </div>
      )}

      {/* Horizon control (drawdown survival window) */}
      <div style={{ marginBottom:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between',
          alignItems:'baseline', marginBottom:5 }}>
          <span style={{ fontSize:12, color:'var(--c-text2)', fontWeight:600 }}>Look-ahead window</span>
          <span style={{ fontSize:14, fontWeight:800, color:'var(--c-text)' }}>{horizon} months</span>
        </div>
        <ShockScrub value={horizon} min={6} max={60} step={6}
          colour="var(--c-acc2)" onChange={setHorizon}
          ariaLabel="Trajectory look-ahead window in months" valueText={`${horizon} months`} />
      </div>

      {/* Live £ impact readout */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
        <div style={{ background:'var(--c-surface2)', borderRadius:12, padding:'10px 12px' }}>
          <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase',
            letterSpacing:0.6, color:'var(--c-text3)', marginBottom:4 }}>Risk Score impact</div>
          <div style={{ fontSize:18, fontWeight:800, color:deltaColour }}>
            {result ? <>{result.rsBefore} → {result.rsAfter} <span style={{ fontSize:13 }}>({rsDelta >= 0 ? '+' : ''}{rsDelta})</span></> : '—'}
          </div>
        </div>
        <div style={{ background:'var(--c-surface2)', borderRadius:12, padding:'10px 12px' }}>
          <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase',
            letterSpacing:0.6, color:'var(--c-text3)', marginBottom:4 }}>Net worth impact</div>
          <div style={{ fontSize:18, fontWeight:800,
            color: nwDelta < 0 ? 'var(--c-danger)' : 'var(--c-success)' }}>
            {result ? <>{nwDelta < 0 ? '−' : '+'}{fmt(Math.abs(Math.round(nwDelta)))}</> : '—'}
          </div>
        </div>
      </div>

      {/* Banded resilience trajectory (history-free; today divider + ±1σ cone) */}
      <ShockBandChart traj={traj} />
    </div>
  )
}

// ── Banded trajectory chart — shocked median path inside a ±1σ uncertainty ────
// cone (NOT one deterministic line · brief mandate). Baseline (no-shock) dashed
// for reference. Both axes labelled; net rate stated; survival/recovery called out.
function ShockBandChart({ traj }) {
  if (!traj || !traj.shocked || traj.shocked.length < 2) {
    return (
      <div style={{ fontSize:12, color:'var(--c-text3)', textAlign:'center', padding:'14px 0' }}>
        Not enough portfolio data to draw a trajectory for this shock.
      </div>
    )
  }
  const { baseline, shocked, shockedLo, shockedHi, survivalMonths, recoveryMonth, netRate } = traj
  const W = 300, H = 110, pL = 38, pR = 8, pT = 10, pB = 22
  const pw = W - pL - pR, ph = H - pT - pB
  const n = shocked.length - 1
  const allVals = baseline.map(d => d.value)
    .concat((shockedHi || shocked).map(d => d.value))
    .concat((shockedLo || shocked).map(d => d.value))
  const maxV = Math.max(...allVals, 1)
  const px = i => pL + (i / Math.max(n, 1)) * pw
  const py = v => pT + ph - (v / maxV) * ph
  const line = (arr) => arr.map((d, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(d.value).toFixed(1)}`).join(' ')
  // Band polygon: hi path forward + lo path reversed
  const band = (() => {
    if (!shockedLo || !shockedHi) return null
    const up = shockedHi.map((d, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(d.value).toFixed(1)}`).join(' ')
    const down = shockedLo.slice().reverse().map((d, ri) => {
      const i = shockedLo.length - 1 - ri
      return `L${px(i).toFixed(1)},${py(d.value).toFixed(1)}`
    }).join(' ')
    return `${up} ${down} Z`
  })()
  const yTicks = [0, 0.5, 1].map(f => ({ v: maxV * f, y: py(maxV * f) }))
  const xMid = Math.round(n / 2)

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display:'block', overflow:'visible' }}>
        {/* Y grid + axis labels (£) */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={pL} y1={t.y} x2={W - pR} y2={t.y} stroke="var(--c-sep)" strokeWidth="0.5" opacity="0.6" />
            <text x={pL - 4} y={t.y + 3} textAnchor="end" fontSize="8" fill="var(--c-text3)"
              fontFamily="DM Sans,sans-serif">{fmt(Math.round(t.v))}</text>
          </g>
        ))}
        {/* X axis labels (months) */}
        {[0, xMid, n].map((i, k) => (
          <text key={k} x={px(i)} y={H - 6} textAnchor={k === 0 ? 'start' : k === 2 ? 'end' : 'middle'}
            fontSize="8" fill="var(--c-text3)" fontFamily="DM Sans,sans-serif">{i}mo</text>
        ))}
        {/* Uncertainty cone */}
        {band && <path d={band} fill="rgba(255,111,125,0.14)" stroke="none" />}
        {/* Baseline (no shock) — dashed reference */}
        <path d={line(baseline)} fill="none" stroke="var(--c-text3)" strokeWidth="1.2"
          strokeDasharray="3 3" opacity="0.7" />
        {/* Shocked median */}
        <path d={line(shocked)} fill="none" stroke="var(--c-danger)" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" />
        {/* "today" divider at month 0 (start of projection) */}
        <line x1={px(0)} y1={pT} x2={px(0)} y2={pT + ph} stroke="var(--c-acc2)"
          strokeWidth="1" strokeDasharray="2 2" opacity="0.8" />
        <text x={px(0) + 2} y={pT + 7} fontSize="7.5" fill="var(--c-acc2)"
          fontFamily="DM Sans,sans-serif">today</text>
      </svg>
      {/* Legend + read-out */}
      <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginTop:6, fontSize:10, color:'var(--c-text3)' }}>
        <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
          <span style={{ width:14, height:2, background:'var(--c-danger)', display:'inline-block' }} />shocked path
        </span>
        <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
          <span style={{ width:14, height:8, background:'rgba(255,111,125,0.20)', display:'inline-block', borderRadius:2 }} />±1σ range
        </span>
        <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
          <span style={{ width:14, height:0, borderTop:'1.5px dashed var(--c-text3)', display:'inline-block' }} />no-shock
        </span>
      </div>
      <div style={{ fontSize:11, marginTop:6, lineHeight:1.5,
        color: survivalMonths < n ? 'var(--c-danger)' : 'var(--c-text2)' }}>
        {survivalMonths < n
          ? `At current spending, the stressed portfolio runs down at about month ${survivalMonths}.`
          : recoveryMonth
            ? `Portfolio holds across the window; baseline recovers its pre-shock level by about month ${recoveryMonth}.`
            : `Portfolio holds across the window at current spending.`}
        {' '}Net assumed growth {((netRate ?? 0.04) * 100).toFixed(1)}%/yr. Range widens with time (√t).
      </div>
    </div>
  )
}

// ── Shock card (uses runShock engine output, animated counter-up on expand) ─
function ShockCard({ shock, onNav, onAddProtection }) {
  const [open, setOpen] = useState(false)
  const colour =
    shock.rsDelta <= -10 ? 'var(--c-danger)' :
    shock.rsDelta <= -5  ? 'var(--c-danger)' :
    shock.rsDelta <= -2  ? 'var(--c-warning)' : 'var(--c-warning)'

  const handoff = SHOCK_HANDOFF[shock.shockId]

  function handleAct(e) {
    e.stopPropagation()
    if (shock.shockId === 'illness') {
      onAddProtection?.('life-cover')
    } else if (handoff?.nav) {
      onNav?.(handoff.nav)
    }
  }

  return (
    <div onClick={() => setOpen(!open)} className="sw-lift sw-press" style={{
      background:'var(--c-surface)', border:`1px solid color-mix(in srgb, ${colour} 50%, var(--c-border))`,
      borderRadius:'14px',
      padding:'12px 14px', marginBottom:8, cursor:'pointer',
    }}>
      <div style={{ display:'flex', alignItems:'center',
        justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, flex:1 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--c-text)', display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
              {shock.label}
              <span style={{
                fontSize: 9, fontWeight: 600, letterSpacing: '0.04em',
                color: 'var(--c-text3)',
                background: 'var(--c-surface2)',
                border: '1px solid var(--c-sep)',
                borderRadius: 4, padding: '1px 5px',
              }}>est · not advice</span>
            </div>
            <div style={{ fontSize:11, color:colour, marginTop:1, display:'flex',
              alignItems:'baseline', gap:4, flexWrap:'wrap' }}>
              <span>Risk</span>
              {open ? <Num value={shock.rsBefore} format="score" animate /> : <strong>{shock.rsBefore}</strong>}
              <span>→</span>
              {open ? <Num value={shock.rsAfter} format="score" animate /> : <strong>{shock.rsAfter}</strong>}
              <span>({shock.rsDelta >= 0 ? '+' : ''}{shock.rsDelta})</span>
              <span>· Wealth</span>
              {open ? <Num value={shock.fqBefore} format="score" animate /> : <strong>{shock.fqBefore}</strong>}
              <span>→</span>
              {open ? <Num value={shock.fqAfter} format="score" animate /> : <strong>{shock.fqAfter}</strong>}
              {shock.nwDelta !== 0 && <span>· NW {shock.nwDelta < 0 ? '−' : '+'}{fmt(Math.abs(shock.nwDelta))}</span>}
            </div>
          </div>
          <AskChip id="RISK-AI-3" label="What would I do?" />
        </div>
        <span style={{ color:'var(--c-text3)', fontSize:14,
          transform: open ? 'rotate(90deg)' : 'none',
          transition:'transform .2s' }}>›</span>
      </div>
      {open && (
        <div className="sw-fade-in" style={{ marginTop:12, paddingTop:12,
          borderTop:'1px solid var(--c-sep)' }}>
          <div style={{ fontSize:13, color:'var(--c-text2)', lineHeight:1.55 }}>
            {shock.description}
          </div>
          {shock.traj && (() => {
            const { baseline, shocked, survivalMonths, recoveryMonth } = shock.traj
            const W = 120, H = 40
            const all = baseline.map(p => p.value).concat(shocked.map(p => p.value))
            const minV = Math.min(...all), maxV = Math.max(...all)
            const range = maxV - minV || 1
            const px = i => (i / (Math.max(baseline.length - 1, 1))) * W
            const py = v => H - ((v - minV) / range) * (H - 4) - 2
            const basePath    = baseline.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(p.value).toFixed(1)}`).join(' ')
            const shockedPath = shocked.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(p.value).toFixed(1)}`).join(' ')
            const survivesWindow = survivalMonths >= baseline.length - 1
            const label = survivesWindow
              ? (recoveryMonth ? `Recovers ~${recoveryMonth}mo` : null)
              : `Portfolio lasts ~${survivalMonths}mo at current spend`
            return (
              <div style={{ marginTop:10 }}>
                <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}
                  style={{ display:'block', overflow:'visible' }}>
                  <path d={basePath} fill="none"
                    stroke="var(--c-text3)" strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
                  <path d={shockedPath} fill="none"
                    stroke="var(--c-danger)" strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {label && (
                  <div style={{ fontSize:11, color: survivesWindow ? 'var(--c-text3)' : 'var(--c-danger)',
                    marginTop:4, fontWeight:600 }}>
                    {label}
                  </div>
                )}
              </div>
            )
          })()}
          {handoff && (onNav || onAddProtection) && (
            <button
              onClick={handleAct}
              className="sw-press"
              style={{
                marginTop: 10, width: '100%',
                background: 'var(--c-surface2)',
                border: '1px solid var(--c-sep)',
                borderRadius: 10, padding: '10px 14px',
                fontSize: 12, fontWeight: 700,
                color: 'var(--c-acc2)', cursor: 'pointer',
                textAlign: 'left',
              }}
            >{handoff.label}</button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Score history chart (Z8) — line draws in via DrawSVG ──────────────────
const HISTORY_PICKERS = [
  { id:'1mo', label:'1mo' },
  { id:'3mo', label:'3mo' },
  { id:'6mo', label:'6mo' },
  { id:'12mo', label:'12mo' },
]

function RiskHistory({ entity }) {
  const [range, setRange] = useState('3mo')
  let series = []
  try { series = calcRiskHistory(entity, range)?.points || [] } catch { series = [] }
  if (series.length === 0) return null
  const W = 320, H = 80, pL = 8, pR = 8, pT = 8, pB = 8
  const pw = W - pL - pR, ph = H - pT - pB
  const px = i => pL + (i / (Math.max(series.length - 1, 1))) * pw
  const py = v => pT + ph - (v / 100) * ph
  const path = series.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(p.score).toFixed(1)}`
  ).join(' ')
  const start = series[0].score, end = series[series.length - 1].score
  const delta = end - start

  return (
    <div className="card sw-lift">
      <div style={{ display:'flex', alignItems:'center',
        justifyContent:'space-between', marginBottom:8 }}>
        <div className="card-title" style={{ marginBottom:0 }}>
          Score History <span className="sw-eyebrow" style={{ marginLeft:4 }}>· always live</span>
        </div>
        <div style={{ display:'flex', background:'var(--c-surface2)',
          borderRadius:100, padding:3, gap:2 }}>
          {HISTORY_PICKERS.map(p => (
            <button key={p.id} onClick={() => setRange(p.id)}
              className="sw-press"
              style={{
                background: range === p.id ? 'var(--c-acc)' : 'transparent',
                color: range === p.id ? 'var(--c-bg)' : 'var(--c-text2)',
                border:'none', cursor:'pointer',
                padding:'4px 10px', borderRadius:100,
                fontSize:11, fontWeight:700,
              }}>{p.label}</button>
          ))}
        </div>
      </div>
      <DrawSVG key={range} duration={1000}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display:'block' }}>
          <path d={path} fill="none"
            stroke={delta >= 0 ? 'var(--c-acc)' : 'var(--c-danger)'}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={px(series.length - 1).toFixed(1)} cy={py(end).toFixed(1)} r="3"
            fill={delta >= 0 ? 'var(--c-acc)' : 'var(--c-danger)'} />
        </svg>
      </DrawSVG>
      <div style={{ display:'flex', justifyContent:'space-between',
        marginTop:6, fontSize:11 }}>
        <span style={{ color:'var(--c-text3)' }}>
          {range} ago: <strong style={{ color:'var(--c-text)' }}>{start}</strong>
        </span>
        <span style={{ color:'var(--c-text3)' }}>
          Today: <strong style={{ color:'var(--c-text)' }}>{end}</strong>
        </span>
        <span style={{ fontWeight:700,
          color: delta >= 0 ? 'var(--c-acc)' : 'var(--c-danger)' }}>
          {delta >= 0 ? '+' : ''}{delta}
        </span>
      </div>
    </div>
  )
}

// ── Attitude version history (Z8b) ─────────────────────────────────────────
// Every committed risk-perception answer, newest first, with the move from the
// prior version. Reads the append-only event log the engine already folds, so
// each "Update your risk perception" submission is a stored, dated version —
// this is the "storage of each version" surface. Versions persist across
// sessions via the event store's localStorage mirror (UI read, not a store).
const APPETITE_ORDER = ['cautious', 'balanced', 'growth', 'aggressive']
const APPETITE_SHORT = { cautious: 'Cautious', balanced: 'Balanced', growth: 'Growth', aggressive: 'Aggressive' }
function AttitudeHistory({ personaId }) {
  const log = useEventsFor(personaId)
  const versions = (log || [])
    .filter(ev => ev.type === 'risk_perception_committed')
    .map(ev => ({ ts: ev.ts, ans: ev.payload?.answers || ev.answers || {} }))
    .filter(v => v.ans && typeof v.ans.riskAppetite === 'string')
    .sort((a, b) => (a.ts || 0) - (b.ts || 0)) // chronological for delta calc

  if (versions.length === 0) {
    return (
      <div className="card" style={{ marginTop: 12 }}>
        <div className="sw-eyebrow" style={{ marginBottom: 6 }}>Attitude history</div>
        <div style={{ fontSize: 12, color: 'var(--c-text3)', lineHeight: 1.55 }}>
          No saved versions yet. Each time you update your risk perception, that
          answer is stored here with its date — so you can see how your attitude
          to risk changes over time.
        </div>
      </div>
    )
  }

  const rows = versions.slice().reverse() // newest first for display
  return (
    <div className="card sw-lift" style={{ marginTop: 12 }}>
      <div className="sw-eyebrow" style={{ marginBottom: 10 }}>
        Attitude history · {versions.length} version{versions.length === 1 ? '' : 's'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((v, i) => {
          const chronoIdx = versions.length - 1 - i
          const prev = chronoIdx > 0 ? versions[chronoIdx - 1] : null
          const cur = APPETITE_ORDER.indexOf(v.ans.riskAppetite)
          const was = prev ? APPETITE_ORDER.indexOf(prev.ans.riskAppetite) : -1
          const moved = prev && cur !== was
          const dir = moved ? (cur > was ? 'more growth-seeking' : 'more cautious') : null
          let date = ''
          try { date = new Date(v.ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) } catch {}
          return (
            <div key={v.ts || i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 10,
              background: 'var(--c-surface2)', border: '1px solid var(--c-sep)',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: i === 0 ? 'var(--c-acc)' : 'var(--c-text3)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>
                  {APPETITE_SHORT[v.ans.riskAppetite] || v.ans.riskAppetite}
                  {i === 0 && (
                    <span style={{ fontSize: 10, color: 'var(--c-acc)', marginLeft: 6, fontWeight: 700 }}>
                      current
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 1 }}>{date}</div>
              </div>
              {moved && (
                <span style={{ fontSize: 10, fontWeight: 700,
                  color: cur > was ? 'var(--c-warning)' : 'var(--c-acc)' }}>
                  {dir}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Confidence card (Z6, spec §8.1) ─────────────────────────────────────────
// How sure we are of the Risk Score — three levels per Risk rules v1.1 §11.
// Previously only a chip on the anchor; this restores the dedicated card the
// spec calls for, framed in plain English (no "primary/secondary input" jargon).
function ConfidenceCard({ risk }) {
  const level = risk?.confidenceLevel || 'low'
  const meta = {
    high:   { label: 'High confidence',   color: 'var(--c-acc)',     text: 'We have the key inputs your Risk Score needs. Only optional detail is missing.' },
    medium: { label: 'Medium confidence', color: 'var(--c-warning)', text: 'Your score uses your main inputs, but some details are estimated. Adding income, protection or estate details would sharpen it.' },
    low:    { label: 'Low confidence',    color: 'var(--c-danger)',  text: 'Some key inputs are missing or assumed, so treat the score as indicative. Adding your income, protection and estate details will raise it.' },
  }[level] || {}
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="sw-eyebrow" style={{ marginBottom: 6 }}>How sure we are</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color }} />
        <span style={{ fontSize: 14, fontWeight: 800, color: meta.color }}>{meta.label}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.55 }}>{meta.text}</div>
    </div>
  )
}

// ── Attitude review re-prompt ───────────────────────────────────────────────
// Surfaces a gentle nudge when the user has never set their risk perception, or
// last answered more than 12 months ago (spec §6.6 annual-anniversary trigger).
// Reads the event log so the cadence is honest, not hardcoded.
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000
function RiskReviewPrompt({ personaId, onReview }) {
  const log = useEventsFor(personaId)
  const last = (log || [])
    .filter(ev => ev.type === 'risk_perception_committed')
    .reduce((max, ev) => Math.max(max, ev.ts || 0), 0)
  let stale = false, msg = ''
  if (!last) {
    // Never answered — handled by the in-card "Not set" prompt, no banner.
    return null
  }
  let ageMs = 0
  try { ageMs = Date.now() - last } catch { ageMs = 0 }
  if (ageMs < ONE_YEAR_MS) return null
  stale = true
  const months = Math.round(ageMs / (30 * 24 * 60 * 60 * 1000))
  msg = `You last reviewed your risk attitude about ${months} months ago. Attitudes drift — worth a refresh.`
  if (!stale) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
      padding: '10px 12px', borderRadius: 10,
      background: 'rgba(255,179,71,0.08)', border: '1px solid rgba(255,179,71,0.28)',
    }}>
      <span style={{ fontSize: 16 }}>⟳</span>
      <span style={{ flex: 1, fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.45 }}>{msg}</span>
      <button onClick={onReview} className="sw-press" style={{
        flexShrink: 0, fontSize: 11, fontWeight: 700, cursor: 'pointer',
        background: 'var(--c-acc)', color: 'var(--c-bg)', border: 'none',
        borderRadius: 100, padding: '6px 12px',
      }}>Review</button>
    </div>
  )
}

// ── Take Action top-3 (Z9) — staggered cards ──────────────────────────────
function TakeAction({ entity, onAct }) {
  let actions = []
  try { actions = calcAPQ(entity) || [] } catch { actions = [] }
  const top = actions
    .filter(a => (a.impact?.riskScore || 0) > 0)
    .sort((a, b) => (b.impact?.riskScore || 0) - (a.impact?.riskScore || 0))
    .slice(0, 3)
  if (top.length === 0) return null

  return (
    <div className="card sw-lift">
      <div className="card-title" style={{
        display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span>Take Action — top 3 for Risk</span>
        <AskChip id="RISK-AI-8" label="Which to prioritise?" />
      </div>
      <RevealStagger interval={80}>
        {top.map((a, i) => (
          <div key={a.id} onClick={() => onAct?.(a)} className="sw-press" style={{
            display:'flex', alignItems:'center', gap:10,
            padding:'10px 0', cursor:'pointer',
            borderBottom: i < top.length - 1 ? '1px solid var(--c-sep)' : 'none',
          }}>
            <div style={{ width:24, height:24, borderRadius:'50%',
              background:`${a.colour}33`, color:a.colour,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:12, fontWeight:700, flexShrink:0 }}>{i+1}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--c-text)' }}>
                {a.title}
              </div>
              <div style={{ fontSize:11, color:'var(--c-text3)', marginTop:2,
                lineHeight:1.4 }}>
                {a.detail}
              </div>
            </div>
            <span className="sw-chip sw-chip-sm sw-chip-mint" style={{ flexShrink:0 }}>
              +{a.impact.riskScore}
            </span>
          </div>
        ))}
      </RevealStagger>
    </div>
  )
}

// ── Mitigation action → owning surface routing (FD-CROSS-1) ─────────────────
function mitigationRoute(action, onNav, onAddProtection) {
  if (!action) return null
  const a = action.toLowerCase()
  if (a.includes('pension') || a.includes('sipp') || a.includes('diversify_income') ||
      a.includes('emergency_fund') || a.includes('overpay')) {
    return () => onNav?.('money')
  }
  if (a.includes('iht') || a.includes('estate') || a.includes('will') || a.includes('trust')) {
    return () => onNav?.('tax')
  }
  if (a.includes('mortgage') || a.includes('rate') || a.includes('cash') || a.includes('income_protection') && !a.includes('add_income')) {
    return () => onNav?.('flow')
  }
  if (a.includes('life_insurance') || a.includes('income_protection') || a.includes('protection')) {
    return () => onAddProtection?.('life-cover')
  }
  return () => onNav?.('money')
}

// ── "What would help most" lens (Z11) — staggered table rows ──────────────
function WhatHelpsMost({ entity, onNav, onAddProtection }) {
  const [shockId, setShockId] = useState('job_loss')
  const SHOCKS = [
    { id:'job_loss',    label:'Job loss' },
    { id:'illness',     label:'Illness' },
    { id:'market_fall', label:'Market −30%' },
    { id:'rate_rise',   label:'Rate +2%' },
    { id:'death',       label:'Death' },
  ]
  let result = null
  try { result = engineWhatHelpsMost(entity, shockId) } catch { result = null }
  const mits = result?.mitigations || []

  return (
    <div className="card sw-lift">
      <div className="card-title" style={{
        display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span>What would help most</span>
        <ExplainerChip id="RISK-1" />
      </div>
      <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap' }}>
        {SHOCKS.map(s => (
          <button key={s.id} onClick={() => setShockId(s.id)}
            className="sw-press"
            style={{
              fontSize:11, fontWeight:700,
              background: shockId === s.id ? 'var(--c-acc)' : 'var(--c-surface2)',
              color:      shockId === s.id ? 'var(--c-bg)'      : 'var(--c-text2)',
              border:'1px solid var(--c-sep)',
              borderRadius:100, padding:'4px 10px', cursor:'pointer',
            }}>{s.label}</button>
        ))}
      </div>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
        <thead>
          <tr style={{ color:'var(--c-text3)', textAlign:'left' }}>
            <th style={{ padding:'6px 8px', fontWeight:700 }}>
              Action
              <span style={{
                marginLeft:6, fontSize:9, fontWeight:700, letterSpacing:'0.04em',
                color:'var(--c-text3)', textTransform:'uppercase', opacity:0.7,
              }}>est · not advice</span>
            </th>
            <th style={{ padding:'6px 8px', fontWeight:700, textAlign:'right' }}>Effort</th>
            <th style={{ padding:'6px 8px', fontWeight:700, textAlign:'right' }}>Δ Risk</th>
          </tr>
        </thead>
        <tbody key={shockId}>
          {mits.slice(0, 5).map((m, i) => {
            const route = mitigationRoute(m.action, onNav, onAddProtection)
            return (
            <tr key={m.action} className="sw-fade-in-up"
              onClick={route || undefined}
              style={{
                borderTop:'1px solid var(--c-sep)',
                animationDelay: `${i * 50}ms`,
                cursor: route ? 'pointer' : 'default',
              }}>
              <td style={{ padding:'8px', color:'var(--c-text)' }}>
                <div style={{ fontWeight:700, display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                  <span>#{i+1} {m.action.replace(/_/g, ' ')}</span>
                  {route && (
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      color: 'var(--c-acc2)',
                      flexShrink: 0,
                    }}>Act →</span>
                  )}
                </div>
                <div style={{ fontSize:11, color:'var(--c-text3)', marginTop:2 }}>
                  {m.description}
                </div>
              </td>
              <td style={{ padding:'8px', textAlign:'right',
                color:'var(--c-text2)' }}>{m.effort}</td>
              <td style={{ padding:'8px', textAlign:'right',
                fontWeight:700,
                color: m.rsDeltaImprovement > 0 ? 'var(--c-acc)' : 'var(--c-text3)' }}>
                {m.rsDeltaImprovement > 0 ? '+' : ''}{m.rsDeltaImprovement}
              </td>
            </tr>
            )
          })}
          {mits.length === 0 && (
            <tr><td colSpan={3} style={{ padding:'12px',
              textAlign:'center', color:'var(--c-text3)' }}>
              No improvements available for this shock.
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ── Life-event banner (Z7) — slides in from top ───────────────────────────
// onReview opens the perception questionnaire so the "re-answer" affordance is
// live, not a dead caption (fixes prior S-08). This is the life-event re-prompt
// trigger (spec §6.6 (a) — re-answer on any life event).
function LifeEventBanner({ entity, onReview }) {
  let events = []
  try { events = lifeEventPaths(entity) || [] } catch { events = [] }
  if (!events || events.length === 0) return null
  return (
    <div className="card sw-lift" style={{
      borderColor:'rgba(255,179,71,.30)',
      animation:'rk-life-slide-down 400ms cubic-bezier(0.16, 1, 0.3, 1) both',
    }}>
      <style>{`
        @keyframes rk-life-slide-down {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="card-title" style={{
        display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span>Life event detected — review your risk profile</span>
        <AskChip id="RISK-AI-6" label="What should I review?" />
      </div>
      <div style={{ fontSize:12, color:'var(--c-text2)', lineHeight:1.55, marginBottom: onReview ? 10 : 0 }}>
        {events.length} prompt{events.length === 1 ? '' : 's'} pending. A life event can
        change how much risk you can take — worth re-checking your attitude.
      </div>
      {onReview && (
        <button onClick={onReview} className="sw-press" style={{
          fontSize: 12, fontWeight: 700, cursor: 'pointer',
          background: 'var(--c-acc)', color: 'var(--c-bg)', border: 'none',
          borderRadius: 100, padding: '8px 16px',
        }}>Re-check my risk attitude →</button>
      )}
    </div>
  )
}

// ── Protection plan anchor (Z12) — pulse-glow when no plan committed ──────
function ProtectionPlanCard({ entity }) {
  const plan = (() => { try { return planFor(entity, 'protection') } catch { return null } })()
  if (plan) {
    return (
      <div className="card sw-lift" style={{ borderColor:'var(--c-acc)' }}>
        <div className="card-title">Active Protection Plan</div>
        <div style={{ fontSize:13, color:'var(--c-text2)', lineHeight:1.55 }}>
          You have an active protection plan in place. Last updated:{' '}
          {plan.lastUpdated || '—'}. Coverage gaps and renewals are reviewed
          against this anchor.
        </div>
      </div>
    )
  }
  return (
    <div className="card sw-lift sw-pulse-glow" style={{ borderColor:'var(--c-sep)' }}>
      <div className="card-title">Protection Plan</div>
      <div style={{ fontSize:13, color:'var(--c-text2)', lineHeight:1.55,
        marginBottom:10 }}>
        No protection plan committed yet. Building one anchors your future
        gap-tracking and lets you compare your plan against what actually happens.
      </div>
      <button
        onClick={() => {
          // Hand off to Timeline tab with a protection-plan seed. Dashboard
          // doesn't yet listen for `?planType=protection` on hash, so this
          // also dispatches a navigation event for any listener wired later.
          if (typeof window !== 'undefined') {
            try {
              window.dispatchEvent(new CustomEvent('sonus:navigate', {
                detail: { tab: 'timeline', planType: 'protection' },
              }))
            } catch {}
            try {
              window.location.hash = '#tab=timeline&planType=protection'
            } catch {}
          }
        }}
        className="sw-press"
        style={{
          background:'var(--c-acc2)', color:'var(--c-bg)', border:'none',
          borderRadius:100, padding:'9px 16px',
          fontSize:12, fontWeight:700, cursor:'pointer' }}>
        Start a protection plan →
      </button>
      <div style={{ fontSize:10, color:'var(--c-text3)', marginTop:8 }}>
        Opens the Timeline tab with a protection-plan seed. Full builder ships in Phase 2.
      </div>
    </div>
  )
}

// ── Universal "+" Add Protection (Z10) ────────────────────────────────────
// MED 2.3 — Will / LPA / Nominations are estate-readiness (D6 Dependency
// Exposure), not protection coverage (D3). Splitting the sheet into two
// labelled sections so the dimensions stay honest.
const COVERAGE_TYPES = [
  { id:'life',    label:'Life cover',           icon:'⚖' },
  { id:'ip',      label:'Income protection',    icon:'◐' },
  { id:'cic',     label:'Critical illness',     icon:'◉' },
]
const ESTATE_TYPES = [
  { id:'will',    label:'Will',                 icon:'▣' },
  { id:'lpa',     label:'Lasting power of attorney', icon:'◑' },
  { id:'noms',    label:'Nominations',          icon:'◈' },
]

function UniversalAdd({ open, onClose, onPick }) {
  if (!open) return null
  const tileBtn = (t) => (
    <button key={t.id} onClick={() => onPick?.(t.id)}
      className="sw-press sw-lift"
      style={{
        display:'flex', alignItems:'center', gap:10,
        padding:'12px 14px', borderRadius:14,
        background:'var(--c-surface2)',
        border:'1px solid var(--c-sep)',
        cursor:'pointer', textAlign:'left',
      }}>
      <span style={{ fontSize:20 }}>{t.icon}</span>
      <span style={{ fontSize:13, fontWeight:700,
        color:'var(--c-text)' }}>{t.label}</span>
    </button>
  )
  return (
    <div className="sheet-overlay">
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet-panel sw-fade-in-up" style={{ maxHeight:'88vh', overflowY:'auto' }}>
        <div className="sheet-handle" />
        <div style={{ fontSize:17, fontWeight:800, color:'var(--c-text)',
          marginBottom:14 }}>Add to your safety net</div>

        {/* D3 — Protection coverage */}
        <div className="sw-eyebrow" style={{ marginBottom:8 }}>
          Protection coverage
        </div>
        <div style={{ fontSize:11, color:'var(--c-text3)', marginBottom:10,
          lineHeight:1.45 }}>
          Insurance products that pay out on loss of income, serious illness, or death.
        </div>
        <RevealStagger interval={40} style={{ display:'grid',
          gridTemplateColumns:'repeat(2, 1fr)', gap:8, marginBottom:18 }}>
          {COVERAGE_TYPES.map(tileBtn)}
        </RevealStagger>

        {/* D6 — Estate readiness */}
        <div className="sw-eyebrow" style={{ marginBottom:8 }}>
          Estate readiness
        </div>
        <div style={{ fontSize:11, color:'var(--c-text3)', marginBottom:10,
          lineHeight:1.45 }}>
          Documents that direct what happens to your wealth and care if you can't.
        </div>
        <RevealStagger interval={40} style={{ display:'grid',
          gridTemplateColumns:'repeat(2, 1fr)', gap:8 }}>
          {ESTATE_TYPES.map(tileBtn)}
        </RevealStagger>

        <div style={{ fontSize:10, color:'var(--c-text3)', marginTop:12,
          marginBottom:8, lineHeight:1.4 }}>
          Document storage and policy capture ship in Phase 2 — picking now seeds a "coming next" follow-up on the Timeline.
        </div>

        <button onClick={onClose} className="sw-press" style={{ width:'100%', marginTop:6,
          background:'var(--c-surface2)', color:'var(--c-text2)',
          border:'1px solid var(--c-sep)',
          borderRadius:100, padding:'11px 0', fontSize:13,
          fontWeight:700, cursor:'pointer' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function FloatingAddButton({ onTap }) {
  return (
    <button onClick={onTap} aria-label="Add protection"
      className="sw-lift sw-press sw-pulse-glow"
      style={{
        position:'fixed', right:20, bottom:24, zIndex:120,
        width:60, height:60, borderRadius:'50%',
        background:'var(--c-acc)',
        color:'var(--c-bg)',
        border:'none', cursor:'pointer',
        fontSize:30, fontWeight:800, lineHeight:1,
        boxShadow:'0 6px 24px rgba(45,242,195,.35), 0 2px 8px rgba(0,0,0,.4)',
      }}>+</button>
  )
}

// ── Z0: X25 hero caption + X22 breadcrumb (elevated card, hero typography) ─
function X25Header({ originLabel = 'Home', onBack }) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div style={{ marginBottom:14 }}>
      {/* X22 breadcrumb */}
      <button onClick={onBack} className="sw-press" style={{
        background:'none', border:'none', cursor:'pointer',
        display:'flex', alignItems:'center', gap:6,
        color:'var(--c-acc)', fontSize:12, fontWeight:600,
        padding:'4px 0', marginBottom:8,
      }}>
        <span style={{ fontSize:14 }}>←</span> {originLabel}
      </button>

      {collapsed ? (
        <button onClick={() => setCollapsed(false)} className="sw-chip sw-chip-sm sw-chip-mint sw-press">
          ? What is this?
        </button>
      ) : (
        <FadeInOnMount>
          <div className="sw-card sw-card-elevated" style={{
            position:'relative',
            background:'linear-gradient(135deg, rgba(45,242,195,0.06), var(--c-surface))',
            border:'1px solid var(--c-acc)',
            padding:'14px 18px',
          }}>
            <button type="button" onClick={() => setCollapsed(true)} aria-label="Collapse risk story banner" className="sw-press" style={{
              position:'absolute', right:10, top:10,
              background:'none', border:'none', cursor:'pointer',
              color:'var(--c-text3)', fontSize:14,
            }}>×</button>
            <div style={{
              fontSize:18, fontWeight:700, color:'var(--c-text)',
              fontStyle:'italic', marginBottom:6, letterSpacing:-0.3,
              lineHeight:1.3, paddingRight:20,
              fontFamily:'Georgia, "Times New Roman", serif',
            }}>
              "If something went wrong tomorrow — would I survive it financially?"
            </div>
            <div style={{ fontSize:12, color:'var(--c-text2)', lineHeight:1.5 }}>
              See where you're resilient, where you're exposed, and what a shock
              to each would mean in pounds.
            </div>
          </div>
        </FadeInOnMount>
      )}
    </div>
  )
}

// ── Risk Perception Questionnaire — 3 questions, updates riskAppetite ────────
const PERCEPTION_QUESTIONS = [
  {
    id: 'riskAppetite',
    title: 'What best describes your investment approach?',
    sub: 'Your psychological comfort with ups and downs in the value of your money.',
    options: [
      { value: 'cautious',   label: 'Cautious — I prioritise stability over returns',      tone: 'neutral' },
      { value: 'balanced',   label: 'Balanced — mix of growth and security',               tone: 'neutral' },
      { value: 'growth',     label: 'Growth — I accept volatility for higher long-term returns', tone: 'neutral' },
      { value: 'aggressive', label: 'Aggressive — maximum growth, I can tolerate big swings', tone: 'warn' },
    ],
  },
  {
    id: 'timeHorizon',
    title: 'How long before you need to draw on this wealth?',
    sub: 'A longer horizon typically supports a higher risk tolerance.',
    options: [
      { value: 'under5',  label: 'Under 5 years',   tone: 'warn' },
      { value: '5to10',   label: '5–10 years',       tone: 'neutral' },
      { value: '10to20',  label: '10–20 years',      tone: 'neutral' },
      { value: 'over20',  label: '20+ years',        tone: 'good' },
    ],
  },
  {
    id: 'lossReaction',
    title: 'If your portfolio fell 20% in a year, what would you do?',
    sub: 'Honest answer — this tests capacity for loss, not just stated preference.',
    options: [
      { value: 'sell',    label: 'Sell — reduce exposure immediately', tone: 'warn' },
      { value: 'hold',    label: 'Hold — wait for recovery',           tone: 'neutral' },
      { value: 'buy',     label: 'Buy more — take advantage of the dip', tone: 'good' },
      { value: 'unsure',  label: 'Unsure — would need to review',      tone: 'warn' },
    ],
  },
]

// Version tag for the perception question set. Every committed answer carries
// it, so when questions are edited/added later (the future editable bank) old
// answers stay self-describing and the history never silently mismatches. This
// is the foundation the runtime question bank edits.
const RISK_QUESTION_SET_VERSION = 'risk-perception-v1'

// The effective question bank = admin-edited set (folded onto entity) or the
// built-in default. The version travels with every committed answer.
function getQuestionBank(entity) {
  const b = entity?.riskQuestionBank
  return Array.isArray(b) && b.length ? b : PERCEPTION_QUESTIONS
}
function getBankVersion(entity) {
  return entity?.riskQuestionBankVersion || RISK_QUESTION_SET_VERSION
}

function RiskPerceptionQuestionnaire({ entity, onClose, onCommit, questions, version }) {
  const bank = (Array.isArray(questions) && questions.length) ? questions : PERCEPTION_QUESTIONS
  const ver = version || RISK_QUESTION_SET_VERSION
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState(() => ({
    // Pre-fill from the user's current answers so re-answering edits, not resets.
    riskAppetite: entity?.riskAppetite || undefined,
    timeHorizon:  entity?.riskTimeHorizon || undefined,
    lossReaction: entity?.riskLossReaction || undefined,
  }))
  const q = bank[Math.min(step, bank.length - 1)]
  const total = bank.length

  function selectAnswer(val) {
    const next = { ...answers, [q.id]: val }
    setAnswers(next)
    if (step < total - 1) {
      setStep(step + 1)
    } else {
      onCommit?.({
        type: 'risk_perception_committed',
        ts: Date.now(),
        questionSetVersion: ver,
        answers: next,
      })
    }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 480,
        background: 'var(--c-surface)',
        borderRadius: '20px 20px 0 0',
        padding: '20px 20px 36px',
        maxHeight: '80vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="sw-eyebrow">Step {step + 1} of {total} · Risk perception</div>
          <button type="button" onClick={onClose} aria-label="Close risk perception drill" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text3)', fontSize: 18 }}>×</button>
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--c-text)', marginBottom: 6, lineHeight: 1.3 }}>{q.title}</div>
        {q.sub && <div style={{ fontSize: 12, color: 'var(--c-text3)', marginBottom: 16, lineHeight: 1.5 }}>{q.sub}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {q.options.map(opt => (
            <button
              key={opt.value}
              onClick={() => selectAnswer(opt.value)}
              style={{
                padding: '11px 14px', borderRadius: 12, textAlign: 'left',
                background: answers[q.id] === opt.value ? 'rgba(45,242,195,0.12)' : 'var(--c-surface2)',
                border: answers[q.id] === opt.value ? '1px solid var(--c-acc)' : '1px solid var(--c-sep)',
                color: 'var(--c-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Suggested risk level (investing drawer) ────────────────────────────────
// Maps the user's OWN answers (appetite + horizon + loss-reaction, all folded
// onto entity by the risk_perception_committed reducer) to a risk CATEGORY,
// using the IFA-canonical principle that suitability = the more conservative of
// willingness (stated appetite) and capacity (horizon + loss-reaction +
// calculated resilience). This is self-knowledge, NOT a personal
// recommendation: no products, no "you should", allocation bands are generic
// category illustrations — not figures derived from the user's money.
// ⚠ COPY PENDING sonuswealth-compliance review before this ships.
const RISK_LEVEL_INFO = {
  cautious:   { label: 'Cautious',    band: 'typically a smaller share in higher-risk assets', means: 'Stability matters more than growth — smaller ups and downs.' },
  balanced:   { label: 'Balanced',    band: 'typically a roughly even split of higher- and lower-risk assets', means: 'A mix of growth and stability — moderate ups and downs.' },
  growth:     { label: 'Growth',      band: 'typically a larger share in higher-risk assets', means: 'Long-term growth prioritised — larger ups and downs accepted.' },
  aggressive: { label: 'Adventurous', band: 'typically a high share in higher-risk assets', means: 'Maximum growth focus — large short-term falls are expected.' },
}
const APPETITE_IDX = { cautious: 0, balanced: 1, growth: 2, aggressive: 3 }
const HORIZON_IDX  = { under5: 0, '5to10': 1, '10to20': 2, over20: 3 }
const LOSS_IDX     = { sell: 0, unsure: 1, hold: 2, buy: 3 }
const RESILIENCE_IDX = { vulnerable: 0, cautious: 1, managed: 2, protected: 3, resilient: 3 }
const IDX_TO_LEVEL = ['cautious', 'balanced', 'growth', 'aggressive']

function SuggestedRiskLevel({ entity, risk }) {
  const appetite = entity?.riskAppetite
  if (!appetite || APPETITE_IDX[appetite] == null) {
    return (
      <div style={{ marginTop: 4, fontSize: 12, color: 'var(--c-text3)', lineHeight: 1.55 }}>
        Answer the 60-second questionnaire above to see how your stated attitude
        compares with your capacity for risk.
      </div>
    )
  }
  const willIdx = APPETITE_IDX[appetite]
  // Capacity = average of horizon, loss-reaction and calculated resilience —
  // whichever the user has answered (each is 0–3). Missing inputs are skipped.
  const capSignals = []
  if (HORIZON_IDX[entity.riskTimeHorizon] != null) capSignals.push(HORIZON_IDX[entity.riskTimeHorizon])
  if (LOSS_IDX[entity.riskLossReaction] != null) capSignals.push(LOSS_IDX[entity.riskLossReaction])
  const bandName = (risk?.band?.name || riskBand(risk?.total || 0).name || '').toLowerCase()
  if (RESILIENCE_IDX[bandName] != null) capSignals.push(RESILIENCE_IDX[bandName])
  const capIdx = capSignals.length
    ? Math.round(capSignals.reduce((s, x) => s + x, 0) / capSignals.length)
    : willIdx
  // Suitability = the more conservative of willingness and capacity.
  const suggestedIdx = Math.min(willIdx, capIdx)
  const suggested = IDX_TO_LEVEL[suggestedIdx]
  const info = RISK_LEVEL_INFO[suggested]
  const gap = willIdx - capIdx // >0: appetite exceeds capacity

  // Copy states the gap as a fact, never directs a course of action (FCA
  // PERG 8.28 — avoid evaluation/persuasion; sonuswealth-compliance AMBER fix).
  const mismatch = gap >= 1
    ? { tone: 'warn', text: `Your stated appetite (${RISK_LEVEL_INFO[appetite].label}) sits above what your answers about capacity suggest. A fall could mean selling at the wrong time — so there's a gap between the risk you say you'll take and the risk your situation may absorb.` }
    : gap <= -1
      ? { tone: 'good', text: `Your capacity for risk looks higher than your stated appetite. The two don't have to match — this is just a difference between how you feel about risk and what your situation could absorb.` }
      : { tone: 'neutral', text: 'Your stated attitude and your capacity for risk are broadly in line.' }
  const toneBorder = mismatch.tone === 'warn' ? 'rgba(255,179,71,0.30)' : mismatch.tone === 'good' ? 'rgba(0,229,168,0.25)' : 'var(--c-sep)'
  const toneBg = mismatch.tone === 'warn' ? 'rgba(255,179,71,0.07)' : mismatch.tone === 'good' ? 'rgba(0,229,168,0.06)' : 'var(--c-surface2)'

  return (
    <div style={{ marginTop: 14 }}>
      <div className="sw-eyebrow" style={{ marginBottom: 8 }}>What your answers indicate</div>
      <div style={{
        background: 'var(--c-surface2)', border: '1px solid var(--c-sep)',
        borderRadius: 12, padding: '12px 14px', marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--c-text)' }}>{info.label}</span>
          <span style={{ fontSize: 11, color: 'var(--c-text3)' }}>based on your answers</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.55, marginTop: 6 }}>
          {info.means} People who describe themselves this way {info.band}.
        </div>
      </div>
      <div style={{ background: toneBg, border: `1px solid ${toneBorder}`, borderRadius: 10, padding: '10px 12px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6,
          color: mismatch.tone === 'warn' ? 'var(--c-warning)' : mismatch.tone === 'good' ? 'var(--c-acc)' : 'var(--c-text3)',
          marginBottom: 4 }}>
          Attitude vs capacity
        </div>
        <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.55 }}>{mismatch.text}</div>
      </div>
      <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 8, fontStyle: 'italic', lineHeight: 1.5 }}>
        General information about risk categories — not a personal recommendation, a
        product suggestion, or financial advice. Your actual choices depend on your
        full circumstances.
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable composed body — renders all zones. Used by Risk.jsx full-page
// surface AND by RiskOverlay sheet variant.
// `suppressPrimaryRing` — when the parent (Risk full page) already renders the
// sticky Risk-primary anchor at the top, hide the Z1 ring card here to avoid
// the 4×-on-page score-78 duplication called out in HIGH 3.1.
// ─────────────────────────────────────────────────────────────────────────────
export function RiskBody({ entity, personaId, admin = false, onAddProtection, onNav, onDrillMetric, onCommit, suppressPrimaryRing = false }) {
  const [activeDim, setActiveDim] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [riskQOpen, setRiskQOpen] = useState(false)
  const [bankEditorOpen, setBankEditorOpen] = useState(false)

  const risk = calcRisk(entity)
  const fq   = calcFQ(entity)

  let profile = null
  try { profile = financialProfile(entity) } catch {}

  let shocks = []
  try {
    const suite = riskShockSuite(entity)
    shocks = Object.values(suite || {}).map(s => {
      let traj = null
      try { traj = shockTrajectory(entity, s.shockId) } catch {}
      return { ...s, traj }
    })
  } catch { shocks = [] }

  // ── Drawer header badges — at-a-glance status so a collapsed drawer tells
  //    you what's inside without opening it. ────────────────────────────────
  const band = risk.band || riskBand(risk.total)
  const appetiteKey = entity?.riskAppetite
  let actionCount = 0
  try { actionCount = (calcAPQ(entity) || []).filter(a => (a.impact?.riskScore || 0) > 0).slice(0, 3).length } catch {}
  const _attLog = useEventsFor(personaId)
  const attVersions = (_attLog || []).filter(ev => ev.type === 'risk_perception_committed').length
  const severeShock = shocks.some(s => (s.rsDelta || 0) <= -10)
  const badge = (text, color) => (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
      color, background: `color-mix(in srgb, ${color} 14%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 45%, transparent)`, whiteSpace: 'nowrap',
    }}>{text}</span>
  )

  return (
    <>
      {/* De-weight card-in-card: the drawer IS the card, so inner class-styled
          cards drop their border/background/shadow. Cards with an inline accent
          (Shock Lab, shock cards, protection plan, profile cell) override these
          via inline-style specificity and keep their emphasis. Scoped to the
          RevealCard drawer bodies (id="rc-risk-*-body") so nothing else moves. */}
      <style>{`
        [id^="rc-risk-"] .card {
          background: transparent;
          border-color: transparent;
          box-shadow: none;
        }
      `}</style>

      {/* Z1: Ring + Setback chip + Confidence chip — elevated card.
          Suppressed on the full-page Risk surface because RiskPrimaryAnchor
          already renders the sticky primary ring + ConfBadge + SetbackChip. */}
      {!suppressPrimaryRing && (
        <FadeInOnMount delay={40}>
          <div className="card sw-card-elevated" style={{
            display:'flex', flexDirection:'column',
            alignItems:'center', marginBottom:12,
            padding:'18px 16px',
          }}>
            <RiskRing score={risk.total} band={risk.band || riskBand(risk.total)} />
            <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:6,
              flexWrap:'wrap', justifyContent:'center' }}>
              <ConfBadge level={risk.confidenceLevel || 'low'} />
              <SetbackChip entity={entity} />
              <ExplainerChip id="HOME-2" />
            </div>
          </div>
        </FadeInOnMount>
      )}

      {/* Top signal: life-event banner — only renders when triggered, kept
          above the drawers so a re-open prompt is never hidden in a closed
          section (Z7). */}
      <LifeEventBanner entity={entity} onReview={() => setRiskQOpen(true)} />

      {/* ── Drawer 1 · Where I stand (open by default) ─────────────────────
          Diagnostic anchor (spec §2.4 diagnostic-first): the band-name
          implication, the 5×5 profile map, and the 7 resilience dimensions. */}
      <RevealCard cardId="risk-stand" title="Where I stand" defaultOpen>
        <ProfileCell profile={profile} />

        {/* Z2: 5×5 cross-map — staggered cells fan in */}
        <FadeInOnMount delay={120}>
          <div className="sw-eyebrow" style={{ marginBottom:6, marginLeft:4 }}>
            Financial Profile Map
          </div>
          <CrossMap5x5
            fqBand={mapFqBand(fq.band?.name)}
            riskBand={mapRiskBand(risk.band?.name)}
          />
        </FadeInOnMount>

        {/* Z3: 7-dimension breakdown — 3-view toggle (Radar · Orbit · Bars) */}
        <DimensionsPanel
          dims={DIMS}
          risk={risk}
          entity={entity}
          onTap={setActiveDim}
        />
      </RevealCard>

      {/* ── Drawer 2 · The risk in my investing ────────────────────────────
          Stated appetite vs calculated resilience + the perception
          questionnaire. NOTE (compliance): this surface reconciles attitude
          with capacity as self-knowledge. The suggested-risk-level build sits
          here and goes through sonuswealth-compliance before its copy ships —
          it must state category meaning + generic ranges, never products or
          "you should". */}
      <RevealCard cardId="risk-investing" title="The risk in my investing"
        headerAccessory={badge(appetiteKey ? (APPETITE_SHORT[appetiteKey] || appetiteKey) : 'Not set', appetiteKey ? 'var(--c-acc)' : 'var(--c-warning)')}>
        {/* Annual re-prompt (spec §6.6) — shows only when the last answer is >12mo old */}
        <RiskReviewPrompt personaId={personaId} onReview={() => setRiskQOpen(true)} />
        {(() => {
          const appetite = entity?.riskAppetite
          const APPETITE_LABELS = {
            cautious:   { label: 'Cautious',   desc: 'Prefer stability — lower returns accepted to reduce volatility.' },
            balanced:   { label: 'Balanced',   desc: 'Mix of growth and stability — accepts moderate swings.' },
            growth:     { label: 'Growth',     desc: 'Prioritises long-term growth — comfortable with higher volatility.' },
            aggressive: { label: 'Aggressive', desc: 'Maximum growth focus — accepts significant short-term falls.' },
          }
          const current = appetite ? APPETITE_LABELS[appetite] : null
          const band = risk.band || riskBand(risk.total)
          const RISK_DECISIONS = {
            vulnerable: 'At lower resilience, people often hold 12+ months in accessible cash and focus on income stability before taking on new debt.',
            cautious:   'A 6–12 month cash buffer and reviewed protection cover are common at this level, with allocations tending to be more conservative.',
            managed:    'At this level, annual stress-scenario reviews and use of ISA / pension tax shelters are typical.',
            protected:  'Resilience is solid — attention often shifts toward growth and estate efficiency.',
            resilient:  'Resilience is strong — there is often capacity for more investment risk and a focus on legacy.',
          }
          const decision = RISK_DECISIONS[(band.name || '').toLowerCase()] || 'Your seven dimensions show where resilience could improve.'
          return (
            <FadeInOnMount delay={40}>
              <div style={{ marginBottom: 4 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div style={{ background: 'var(--c-surface2)', borderRadius: 12, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--c-text3)', marginBottom: 4 }}>
                      Stated appetite
                    </div>
                    {current ? (
                      <>
                        <div style={{ fontSize: 14, fontWeight: 800, color: band.colour }}>{current.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 2, lineHeight: 1.4 }}>{current.desc}</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--c-text3)', fontStyle: 'italic' }}>Not set — update your profile</div>
                    )}
                  </div>
                  <div style={{ background: 'var(--c-surface2)', borderRadius: 12, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--c-text3)', marginBottom: 4 }}>
                      Calculated resilience
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: band.colour }}>{band.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 2, lineHeight: 1.4 }}>
                      {risk.total}/100 — from your 7 dimensions
                    </div>
                  </div>
                </div>
                <div style={{ background: 'rgba(45,242,195,0.06)', border: '1px solid rgba(45,242,195,0.15)', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--c-acc)', marginBottom: 4 }}>
                    What this means for decisions
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.55 }}>{decision}</div>
                  <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 6, fontStyle: 'italic' }}>General information, not personal advice.</div>
                </div>
                <button
                  onClick={() => setRiskQOpen(true)}
                  style={{
                    width: '100%', padding: '9px 14px', borderRadius: 100,
                    background: 'var(--c-surface2)', border: '1px solid var(--c-sep)',
                    fontSize: 12, fontWeight: 700, color: 'var(--c-acc)',
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
                  }}
                >
                  Update your risk perception — 60-second questionnaire →
                </button>
              </div>
            </FadeInOnMount>
          )
        })()}

        {/* Suggested risk level — willingness vs capacity (compliance-gated copy) */}
        <SuggestedRiskLevel entity={entity} risk={risk} />

        {/* Admin-only: edit the question bank. Hidden from end users — a runtime
            question editor is a rules-admin function, not a user one. */}
        {admin && (
          <button onClick={() => setBankEditorOpen(true)} className="sw-press"
            style={{
              marginTop: 12, width: '100%', padding: '9px 14px', borderRadius: 100,
              background: 'transparent', border: '1px dashed var(--c-border)',
              fontSize: 12, fontWeight: 700, color: 'var(--c-text3)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
            ⚙ Edit risk questions (admin)
          </button>
        )}
      </RevealCard>

      {/* ── Drawer 3 · What could go wrong ──────────────────────────────────
          Stress-test cluster (spec §2.4): protection gap, the live Shock Lab,
          and the engine-recomputed shock scenarios. */}
      <RevealCard cardId="risk-wrong" title="What could go wrong"
        headerAccessory={badge(severeShock ? 'High impact' : `${shocks.length} stress tests`, severeShock ? 'var(--c-warning)' : 'var(--c-text3)')}>
        {/* Z4: Protection gap card */}
        <ProtectionGap entity={entity} onAction={() => onAddProtection?.('life-cover')} />

        {/* Z5a: Shock Lab — grabbable shock size/horizon/income-loss, live re-draw */}
        <ShockLab entity={entity} />

        {/* Z5b: Shock scenarios — staggered cards (at-a-glance summary at defaults) */}
        <div className="card sw-lift">
          <div className="sw-eyebrow" style={{ marginBottom:8 }}>Stress Tests</div>
          <div className="card-title" style={{
            display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span>Shock Scenarios — recomputed by engine</span>
            <AskChip id="RISK-AI-3" label="What if?" />
          </div>
          {shocks.length === 0 ? (
            <div style={{ fontSize:12, color:'var(--c-text3)' }}>
              We don't have enough of your data yet to model these shocks.
            </div>
          ) : (
            <RevealStagger interval={70}>
              {shocks.map(s => <ShockCard key={s.shockId} shock={s} onNav={onNav} onAddProtection={onAddProtection} />)}
            </RevealStagger>
          )}
        </div>
      </RevealCard>

      {/* ── Drawer 4 · What I'd do about it ─────────────────────────────────
          Action cluster (spec §2.4): top-3 ranked actions, the what-helps-most
          lens, and the protection-plan anchor. */}
      <RevealCard cardId="risk-act" title="What I'd do about it"
        headerAccessory={actionCount ? badge(`${actionCount} action${actionCount === 1 ? '' : 's'}`, 'var(--c-acc)') : null}>
        {/* Z9: Take Action top 3 — staggered.
            onAct wires the row click to a navigation/ask event so it's no
            longer a silent affordance. Dashboard or any listener can route. */}
        <TakeAction
          entity={entity}
          onAct={(a) => {
            if (typeof window === 'undefined') return
            // Prefer drill if the action has a dimension key
            if (a?.dimension && typeof onDrillMetric === 'function') {
              onDrillMetric(`risk:${a.dimension}`)
              return
            }
            try {
              window.dispatchEvent(new CustomEvent('sonus:action', {
                detail: { source: 'risk-take-action', action: a },
              }))
            } catch {}
          }}
        />

        {/* Z11: What would help most lens — staggered rows */}
        <WhatHelpsMost entity={entity} onNav={onNav} onAddProtection={onAddProtection} />

        {/* Z12: Protection plan anchor (always rendered, pulses if no plan) */}
        <ProtectionPlanCard entity={entity} />
      </RevealCard>

      {/* ── Drawer 5 · How it's changed ─────────────────────────────────────
          History cluster (spec §2.4): the Risk Score time-series. Attitude
          version-history lands here next once the event→entity loop is wired. */}
      <RevealCard cardId="risk-changed" title="How it's changed"
        headerAccessory={attVersions ? badge(`${attVersions} version${attVersions === 1 ? '' : 's'}`, 'var(--c-text3)') : null}>
        {/* Z8: History (own picker, line draws in) */}
        <RiskHistory entity={entity} />
        {/* Z8b: Attitude version history — each committed perception answer, dated */}
        <AttitudeHistory personaId={personaId} />
        {/* Z6: Confidence — how sure we are of the score (spec §8.1) */}
        <ConfidenceCard risk={risk} />
      </RevealCard>

      {/* Risk perception questionnaire — rendered at overlay level so any
          re-prompt (life-event banner, annual nudge) can open it regardless of
          which drawer is open. */}
      {riskQOpen && (
        <RiskPerceptionQuestionnaire
          entity={entity}
          questions={getQuestionBank(entity)}
          version={getBankVersion(entity)}
          onClose={() => setRiskQOpen(false)}
          onCommit={(answers) => { onCommit?.(answers); setRiskQOpen(false) }}
        />
      )}

      {/* Admin-only: edit the perception question bank (event-sourced) */}
      {bankEditorOpen && (
        <QuestionBankEditor
          entity={entity}
          onClose={() => setBankEditorOpen(false)}
          onCommit={(ev) => { onCommit?.(ev); setBankEditorOpen(false) }}
        />
      )}

      {/* Dimension detail sheet */}
      {activeDim && (
        <DimSheet
          dimCfg={activeDim}
          score={risk.dims?.[activeDim.key] || 0}
          entity={entity}
          onClose={() => setActiveDim(null)}
          onCommit={onCommit}
        />
      )}

      {/* Z10: Universal "+" Add Protection */}
      <FloatingAddButton onTap={() => setAddOpen(true)} />
      <UniversalAdd
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onPick={(id) => { setAddOpen(false); onAddProtection?.(id) }}
      />
    </>
  )
}

// ── Risk-primary anchor (spec §2.3 + §2.7 D-ANCHOR-2) ─────────────────────
// On the Risk tab the hierarchy inverts: Risk Score is the hero (large, left),
// with Wealth Score + Net Worth as smaller, secondary tiles on the right.
// Sticks under the breadcrumb on scroll so the ring stays visible while the
// user drills through the dimensions, stress tests, and history below.
function RiskPrimaryAnchor({ entity, risk, fq, nw, onDrillMetric }) {
  const band = risk.band || riskBand(risk.total)
  return (
    <div
      data-risk-anchor="primary"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 60,
        // Frosted backing so content scrolling under it stays legible.
        background: 'color-mix(in srgb, var(--c-bg) 88%, transparent)',
        // saturate() forces a full-viewport colour-matrix pass on every
        // composite, which kept this sticky strip from settling to a stable
        // frame (preview_screenshot wedge). Blur alone keeps the frosted read.
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderBottom: '1px solid var(--c-sep)',
        padding: '10px 16px 12px',
        marginBottom: 14,
        marginLeft: -16,
        marginRight: -16,
      }}>
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 10,
      }}>
        {/* Primary — Risk ring (large, left, ~60% width) */}
        <div className="card sw-card-elevated" style={{
          flex: '1 1 60%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '12px 12px 14px',
          borderColor: `${band.colour}55`,
          background: `linear-gradient(180deg, color-mix(in srgb, ${band.colour} 6%, var(--c-surface)), var(--c-surface))`,
        }}>
          <div className="sw-eyebrow" style={{ marginBottom: 4, color: band.colour }}>
            Risk Score
          </div>
          <RiskRing score={risk.total} band={band} />
          <div style={{
            display: 'flex', gap: 6, alignItems: 'center', marginTop: 4,
            flexWrap: 'wrap', justifyContent: 'center',
          }}>
            <ConfBadge level={risk.confidenceLevel || 'low'} />
            <SetbackChip entity={entity} />
            <ExplainerChip id="HOME-2" />
          </div>
        </div>

        {/* Secondary — Wealth + Net Worth stacked, small (right, ~40% width) */}
        <div style={{
          flex: '1 1 40%',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          minWidth: 0,
        }}>
          <SecondaryTile
            label="Wealth Score"
            value={fq.total}
            band={fq.band || fqBand(fq.total)}
            onTap={() => onDrillMetric?.('wealthScore')}
          />
          <SecondaryTile
            label="You own"
            value={fmt(nw)}
            isMoney
            tieout="risk.nw"
            tieoutRaw={nw}
            onTap={() => onDrillMetric?.('netWorth')}
          />
        </div>
      </div>
    </div>
  )
}

function SecondaryTile({ label, value, band, isMoney = false, onTap, tieout, tieoutRaw }) {
  return (
    <button
      onClick={onTap}
      className="sw-card sw-lift sw-press"
      style={{
        flex: 1,
        textAlign: 'left',
        background: 'var(--c-surface)',
        border: `1px solid ${band ? `${band.colour}33` : 'var(--c-border2)'}`,
        borderRadius: 'var(--r-md, 12px)',
        padding: '8px 10px',
        cursor: onTap ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        minWidth: 0,
        minHeight: 56,
      }}>
      <div className="sw-eyebrow" style={{
        marginBottom: 2, fontSize: 9, letterSpacing: 0.3,
      }}>
        {label}
      </div>
      <div
        data-tieout={tieout || undefined}
        data-tieout-raw={tieoutRaw != null ? String(tieoutRaw) : undefined}
        style={{
        fontSize: isMoney ? 16 : 20,
        fontWeight: 800,
        color: band ? band.colour : 'var(--c-text)',
        lineHeight: 1.1,
        letterSpacing: -0.4,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {value}
      </div>
      {band && (
        <div style={{
          fontSize: 9, color: 'var(--c-text3)', marginTop: 2,
          textTransform: 'capitalize',
        }}>
          {band.name}
        </div>
      )}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Default export — full-page Risk surface.
// ─────────────────────────────────────────────────────────────────────────────
export default function Risk({ entity, personaId, onHome, onBack, originLabel = 'Home', onDrillMetric, onCommit, onAddProtection, onNav, onOpenDecision }) {
  const risk = calcRisk(entity)
  const fq   = calcFQ(entity)
  const nw   = netWorth(entity)

  // Admin gate for the question-bank editor. Founder-accessible via ?admin=1,
  // hidden from end users (a runtime question editor is a rules-admin function).
  // TODO: bind to a real admin role once rules-admin (Tier-4) lands.
  const isAdmin = typeof window !== 'undefined' && (() => {
    try { return new URLSearchParams(window.location.search).get('admin') === '1' } catch { return false }
  })()

  // No X28 state on Risk — see spec §33c O-RISK-17. RiskHistory carries its
  // own 1/3/6/12 mo selector for change-over-time.

  return (
    <div className="screen">
      {/* X28 top-bar deliberately OMITTED on Risk.
          Spec §33c O-RISK-17 explicitly bans X28 on Risk: temporal-view
          framings (FY / RY / TY12) don't map onto a point-in-time resilience
          score. The local Risk History card (Z8) carries its own 1/3/6/12 mo
          picker for change-over-time, which is the only temporal cut that
          makes sense here. */}

      {/* Z0: X22 breadcrumb + X25 hero caption */}
      <X25Header originLabel={originLabel} onBack={onHome} />

      {/* Risk-primary anchor — sticky. Spec §2.3 + §2.7 D-ANCHOR-2:
          Risk Score primary (left/large), Wealth + NW secondary (right/small).
          Inverse hierarchy from Home/MyMoney's TripleAnchor. */}
      <RiskPrimaryAnchor
        entity={entity}
        risk={risk}
        fq={fq}
        nw={nw}
        onDrillMetric={onDrillMetric}
      />

      {/* All zones (Z1 ring suppressed — primary anchor already shows it) */}
      <RiskBody
        entity={entity}
        personaId={personaId}
        admin={isAdmin}
        onDrillMetric={onDrillMetric}
        onCommit={onCommit}
        onAddProtection={onAddProtection}
        onNav={onNav}
        suppressPrimaryRing
      />

      <DecisionDrawers screen="risk" onOpen={onOpenDecision} />

      <p className="disclaimer">
        {BRAND.disclaimer}<br />{BRAND.rulesVersion} · {BRAND.dataDate}
      </p>
    </div>
  )
}
