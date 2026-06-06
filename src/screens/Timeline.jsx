// ═══════════════════════════════════════════════════════════════════════════
// SONUSWEALTH — TIMELINE SCREEN  (spec: 2-Product-timeline-v1_3.md)
// Status: CODED · Wave 1A · X28/X29 wired · POLISHED
// Sections: §A Life Stage · §B Score Journey · §C Action Calendar
//           §D Decision Log · §E Scenario Library · §F Goals & Milestones
// Engine: fq-calculator.js + timeline-engine.js
// Brand: Sonuswealth (D-NAME-2). Rules: UK-2026.1.
// X25: "Where am I in my financial life — and where am I headed?"
//
// D-SCORE-JOURNEY-1 (spec §5.10): §B is a READ-ONLY MIRROR. scoreJourneyData
//   pre-computed once at TimelineScreen top, passed to SectionB as prop.
//   Skeleton state up to 3s, fallback at timeout. Spec §5.10 mandates:
//   "Timeline §B does NOT call calcScoreHistory() directly."
//
// X28 (spec §X28-TL): top-bar window+viewMode wired to §B history range and
//   §C forward calendar window. §A and §F are LIFETIME-anchored.
// X29: DiffBadge / CausalityStripe across §A milestones, §C action items,
//   §D decisions, §F goals — see Diff.jsx primitives.
// §F-CANONICAL: §F is canonical owner of MILESTONE_* events. Tap "Celebrate"
//   fires MILESTONE_DISMISSED (and MILESTONE_CELEBRATED downstream) via
//   onCommit prop / commitPlan event helper.
// CoI: read-only consumption — T&E is canonical (spec §19.1).
// FCA phrasing: "the engine models" / "progress is tracking" — never
//   "you should" / "you will".
//
// POLISH LAYER:
//   · Triple Anchor + Sub-Anchor — counter-up via Num animate
//   · §A — sw-card-elevated hero · 7-stage strip with RevealStagger ·
//          current-stage .sw-pulse-glow · animated % bar · DiffBadge years.
//   · §B — twin-score sparklines wrapped in <DrawSVG> · 1mo/3mo/6mo/12mo
//          ghost-pill range row with .sw-press + is-active.
//   · §C — RevealStagger on entries · CoI chips counter-up · gift clock
//          ring fill animation · semantic chip classes (coral/amber/mint).
//   · §D — RevealStagger on populated rows.
//   · §E — RevealStagger on 8 plan rows · staleness pill (sw-chip) ·
//          tap-to-expand · goal-seek action paths slide in.
//   · §F — 8 goal templates fan in · achieved milestones .sw-sparkle ·
//          MILESTONE_CELEBRATED → confetti burst (pure CSS keyframes).
//   · View-mode change — zone bodies wrap in .sw-tab-slide keyed on viewMode.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react'
// S1 selector migration (Phase 2)
import {
  netWorth,
  fq as calcFQ,
} from '../engine/selectors/index.js'
import {
  calcRisk,
  fmt, daysLeft, fqTrajectory,
  lifeStageFor, calcAge, costOfInaction, nominationStatus,
  planFor, planStaleness, commitPlan, goalSeek,
  giftPct, taperBand, TAX,
} from '../engine/fq-calculator.js'
import {
  calcAPQTimeline, calcMilestones, calcGoalProgress,
  calcScoreHistory, calcRiskHistory,
  listScenarios,
} from '../engine/timeline-engine.js'
import {
  X28TopBar,
  DiffBadge, CausalityStripe,
  ExplainerChip,
  FadeInOnMount, RevealStagger, DrawSVG,
  Num,
} from '../components/shared'
import { useCounterAnimation } from '../hooks/useAnimation.jsx'

// ─── Founder IP stubs (methodology OPEN) ────────────────────────────────────
const _stub = (id) => ({ status: 'stub', openItem: id, value: null })
const prcPccSpread           = () => _stub('O-FOUNDER-IP-01')  // eslint-disable-line no-unused-vars
const realityEngineFactorisation = () => _stub('O-FOUNDER-IP-04')  // eslint-disable-line no-unused-vars

// ─── Helpers ────────────────────────────────────────────────────────────────
function _age(e) {
  if (e?.age) return e.age
  if (e?.individual?.dob) return calcAge(e.individual.dob)
  return 0
}

// Map X28 window-id → calcScoreHistory range token
function windowToHistoryRange(windowId) {
  switch (windowId) {
    case 'current-month':
    case 'last-30-days':   return '3mo'
    case 'current-tax-year':
    case 'calendar-year':  return '12mo'
    case 'last-12-months': return '12mo'
    case 'lifetime':       return 'all-time'
    case 'custom':         return '12mo'
    default:               return '12mo'
  }
}

// ─── Style tokens ───────────────────────────────────────────────────────────
const LBL = {
  fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: 0.8, color: 'var(--c-text3)',
}
const card = (extra = {}) => ({
  margin: '0 0 var(--space-md)', background: 'var(--c-surface)',
  border: '1px solid var(--c-sep)', borderRadius: 'var(--r-xl)',
  padding: 'var(--space-lg) var(--space-xl)',
  boxShadow: 'var(--shadow-card-sm)',
  ...extra,
})

// ─── Life stage catalogue (UK-2026.1 bundle parameters per spec §4.6) ───────
const STAGES = [
  { n:1, name:'Foundation',    range:'18–30', nextRule:'ISA habit · auto-enrolment · debt structure' },
  { n:2, name:'Accumulation',  range:'30–45', nextRule:'Pension AA growth · S&S ISA · mortgage' },
  { n:3, name:'Consolidation', range:'45–55', nextRule:'Max pension AA · debt clearance · estate planning starts' },
  { n:4, name:'Transition',    range:'55–65', nextRule:'NMPA passed · drawdown decisions begin · SPA approaching' },
  { n:5, name:'Decumulation',  range:'65–75', nextRule:'Post-75 pension death benefit rules apply (income tax on beneficiary)' },
  { n:6, name:'Preservation',  range:'75–85', nextRule:'Will · LPA · trust deeds · BPR holdings reviewed' },
  { n:7, name:'Legacy',        range:'85+',   nextRule:null },
]
const STAGE_COLS = [
  'var(--c-accent)',
  'var(--c-success)',
  'var(--c-warning)',
  'var(--c-warning)',
  'var(--c-muted)',
  'var(--c-danger)',
  'var(--c-border)',
]

// ─── Plan type registry (spec §PA.1 — all 8 planTypes surface on Timeline only) ──
const PLAN_TYPES = [
  { id:'retirement', label:'Retirement plan',  glyph:'⊙' },
  { id:'estate',     label:'Estate plan',      glyph:'◇' },
  { id:'cashflow',   label:'Cashflow plan',    glyph:'≋' },
  { id:'debt',       label:'Debt plan',        glyph:'⊟' },
  { id:'gift',       label:'Gift plan',        glyph:'⬡' },
  { id:'protection', label:'Protection plan',  glyph:'⛨' },
  { id:'tax',        label:'Tax plan',         glyph:'⚖' },
  { id:'custom',     label:'Custom plan',      glyph:'◌' },
]

// ─── Goal templates (spec §9.4) ──────────────────────────────────────────────
const GOAL_TEMPLATES = [
  { id:'retire',    label:'Retire at age N',             icon:'⏱', template_id:'fi'                  },
  { id:'mortgage',  label:'Pay off mortgage',             icon:'🏠', template_id:'custom'              },
  { id:'nw_target', label:'Net worth target',             icon:'📈', template_id:'net_worth_target'    },
  { id:'emergency', label:'Emergency fund',               icon:'🛡', template_id:'savings_rate'        },
  { id:'income',    label:'Target retirement income',     icon:'💰', template_id:'fi'                  },
  { id:'iht_free',  label:'IHT-free estate',              icon:'⚖', template_id:'custom'              },
  { id:'uni_fund',  label:"Children's university fund",   icon:'🎓', template_id:'custom'              },
  { id:'deposit',   label:'First home deposit',           icon:'🔑', template_id:'net_worth_target'    },
]

// Range-picker tokens for §B (ghost pills · sw-press · is-active)
const RANGE_OPTIONS = [
  { id: '1mo',  label: '1mo'  },
  { id: '3mo',  label: '3mo'  },
  { id: '6mo',  label: '6mo'  },
  { id: '12mo', label: '12mo' },
]

// ═══════════════════════════════════════════════════════════════════════════
// SHARED SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// Section header — circular letter pill + title + 1-line purpose. Sticky on
// scroll (offset for X28 top-bar). Slim accessory slot on the right.
function SectionHeader({ letter, title, purpose, colour, accessory = null }) {
  return (
    <div style={{
      position: 'sticky', top: 56, zIndex: 5,
      display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
      margin: 'var(--space-3xl) 0 var(--space-sm)',
      padding: '6px 0',
      background: 'linear-gradient(180deg, var(--c-bg) 0%, var(--c-bg) 88%, transparent 100%)',
      backdropFilter: 'blur(6px)',
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: 'var(--r-pill)',
        fontSize: 12, fontWeight: 800,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `color-mix(in srgb, ${colour} 13%, transparent)`, color: colour, flexShrink: 0,
        border: `1px solid color-mix(in srgb, ${colour} 33%, transparent)`,
      }}>{letter}</div>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize: 13, fontWeight: 800, color: 'var(--c-text)',
          letterSpacing: -0.1,
        }}>{title}</div>
        {purpose && (
          <div style={{
            fontSize: 10, color: 'var(--c-text3)', marginTop: 1,
            lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>{purpose}</div>
        )}
      </div>
      {accessory && <div style={{ marginLeft: 'auto', flexShrink: 0 }}>{accessory}</div>}
    </div>
  )
}

// Animated progress bar — fills from 0 → pct on mount.
function ProgressBar({ progress, colour, animateOnMount = true }) {
  const pct = Math.max(0, Math.min(100, Math.round((progress ?? 0) * 100)))
  const c   = colour || (pct >= 100 ? 'var(--c-success)' : pct >= 50 ? 'var(--c-accent)' : 'var(--c-warning)')
  return (
    <div className="sw-bar" style={{ background: 'rgba(255,255,255,.08)' }}>
      <div
        className="fill"
        style={{
          width: `${pct}%`, background: c,
          transformOrigin: 'left center',
          animation: animateOnMount ? 'sw-bar-grow 700ms var(--ease-out-cubic) both' : undefined,
        }}
      />
    </div>
  )
}

// Confetti overlay — radial dots expanding outward, fade out (pure CSS).
const CONFETTI_COLOURS = ['var(--c-success)', 'var(--c-accent)', 'var(--c-warning)', 'var(--c-danger)', 'var(--c-muted)']
function ConfettiBurst({ active, colours = CONFETTI_COLOURS }) {
  if (!active) return null
  const dots = 14
  return (
    <div className="sw-confetti-overlay" aria-hidden="true">
      {Array.from({ length: dots }).map((_, i) => {
        const ang = (Math.PI * 2 * i) / dots + (i % 2 ? 0.18 : 0)
        const dist = 56 + (i % 3) * 12
        const cx = Math.cos(ang) * dist
        const cy = Math.sin(ang) * dist
        const col = colours[i % colours.length]
        return (
          <span
            key={i}
            className="sw-confetti-dot"
            style={{
              background: col,
              animationDelay: `${(i % 5) * 30}ms`,
              ['--cx']: `${cx}px`,
              ['--cy']: `${cy}px`,
            }}
          />
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// §A — LIFE STAGE BAND  (spec §4 · LIFETIME-anchored — does not respond to X28 window)
// ═══════════════════════════════════════════════════════════════════════════

function SectionA({ entity }) {
  const age  = _age(entity)
  const ls   = lifeStageFor(age)
  const stg  = STAGES.find(s => s.n === ls.stage) || STAGES[0]
  const next = stg.n < 7 ? STAGES[stg.n] : null
  const col  = STAGE_COLS[(ls.stage || 1) - 1]

  // % through current stage (spec §4.3 — Stage 7 "85+" caps at age 105)
  const parts  = ls.range.replace('+', '').split('–')
  const sStart = parseInt(parts[0], 10) || 0
  const sEnd   = ls.range.endsWith('+') ? sStart + 20 : (parseInt(parts[1], 10) || sStart + 15)
  const pctRaw = sEnd > sStart
    ? Math.max(0, Math.min(100, Math.round(((age - sStart) / (sEnd - sStart)) * 100)))
    : 0

  // Animated counter for the percentage label
  const pctAnim = useCounterAnimation(pctRaw, { duration: 900, format: (n) => `${Math.round(n)}` })

  // X29 milestone diff: years to next stage transition
  const yearsToNext = next ? (parseInt(next.range.split('–')[0], 10) - age) : null

  return (
    <FadeInOnMount
      className="sw-card sw-card-elevated"
      style={{
        margin: '0 0 var(--space-md)',
        background: `linear-gradient(135deg, color-mix(in srgb, ${col} 6%, transparent), var(--c-surface) 60%)`,
        border: `1px solid color-mix(in srgb, ${col} 20%, transparent)`,
        borderRadius: 'var(--r-xl)',
        padding: 'var(--space-lg) var(--space-xl)',
      }}
    >
      <div style={{
        display:'flex', justifyContent:'space-between', alignItems:'flex-start',
        marginBottom: 'var(--space-md)', gap: 'var(--space-sm)',
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ ...LBL, marginBottom: 4 }}>Life stage</div>
          <div className="sw-hero-md" style={{ color: col, lineHeight: 1.0 }}>
            {stg.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 4 }}>
            {ls.range} · <span style={{ fontVariantNumeric: 'tabular-nums', color: col, fontWeight: 700 }}>{pctAnim}%</span> through · Age {age}
          </div>
        </div>
        <span
          className="sw-chip sw-chip-sm"
          style={{
            color: col,
            background: `color-mix(in srgb, ${col} 10%, transparent)`,
            fontWeight: 700,
            letterSpacing: 0.4,
          }}
        >Stage {ls.stage} of 7</span>
      </div>

      {/* Animated stage % progress bar */}
      <div style={{ marginBottom: 'var(--space-sm)' }}>
        <ProgressBar progress={pctRaw / 100} colour={col} />
      </div>

      {/* 7-segment life stage strip (spec §4.2) — RevealStagger fan-in.
          Current stage gets a gentle .sw-pulse-glow halo. */}
      <RevealStagger interval={50} startDelay={120} style={{
        display:'flex', gap: 4, marginBottom: 6,
      }}>
        {STAGES.map(s => {
          const isCurrent = s.n === ls.stage
          const isPast    = s.n < ls.stage
          const segCol    = isCurrent ? col : isPast ? `color-mix(in srgb, ${col} 40%, transparent)` : 'rgba(255,255,255,.08)'
          return (
            <div
              key={s.n}
              className={isCurrent ? 'sw-pulse-glow' : undefined}
              style={{
                flex: 1, height: 8, borderRadius: 'var(--r-pill)',
                background: segCol,
                color: col, // .sw-pulse-glow uses currentColor — keep mint default but tinted by col anyway
              }}
            />
          )
        })}
      </RevealStagger>

      <div style={{
        display:'flex', justifyContent:'space-between',
        fontSize: 9, color: 'var(--c-text3)', marginBottom: 'var(--space-md)',
      }}>
        <span>18</span>
        {STAGES.map(s => (
          <span
            key={s.n}
            style={{
              color: s.n === ls.stage ? col : 'var(--c-text3)',
              fontWeight: s.n === ls.stage ? 700 : 400,
            }}
          >
            {s.name.slice(0,3)}
          </span>
        ))}
        <span>85+</span>
      </div>

      {/* On-chart implication line (spec §4.4 · §13.3) */}
      <div style={{
        borderTop: '1px solid var(--c-sep)', paddingTop: 'var(--space-sm)',
        fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.6,
      }}>
        {next
          ? <>
              You enter <strong>{next.name}</strong> at age {next.range.split('–')[0]} ·
              primary change: {next.nextRule}
              {yearsToNext != null && yearsToNext > 0 && (
                <span style={{ marginLeft: 6 }}>
                  <DiffBadge value={`▲${yearsToNext}y`} />
                </span>
              )}
            </>
          : 'Legacy stage — estate, gifts, and legacy planning are the primary financial focus.'}
      </div>

      {/* §A causality stripe (spec §X29) — sources for life-stage derivation */}
      <div style={{ margin: 'var(--space-sm) calc(-1 * var(--space-xl)) calc(-1 * var(--space-lg))' }}>
        <CausalityStripe sources={['DOB · entity.individual.dob', `bundle: ${entity?.rulesVersion || 'UK-2026.1'}`]} />
      </div>
    </FadeInOnMount>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// §B — SCORE JOURNEY  (spec §5 · D-SCORE-JOURNEY-1 read-only mirror)
// scoreJourneyData prop is REQUIRED per §5.10. Renders skeleton up to 3s,
// fallback at 3s timeout. Does NOT call calcScoreHistory() directly.
// ═══════════════════════════════════════════════════════════════════════════

function ScoreSparkline({ points, colour, draw = true }) {
  if (!points?.length) return null
  const W = 280, H = 52
  const scores = points.map(p => p.score)
  const minS   = Math.min(...scores), maxS = Math.max(...scores)
  const rng    = Math.max(maxS - minS, 5)
  const px     = (i) => (i / Math.max(points.length - 1, 1)) * W
  const py     = (s) => H - 4 - ((s - minS) / rng) * (H - 8)
  const d      = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(p.score).toFixed(1)}`).join(' ')

  const svg = (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display:'block', overflow:'visible' }}>
      <path d={d} fill="none" stroke={colour} strokeWidth={2} strokeLinecap="round" />
      {points.filter(p => p.annotated).map((p, i) => (
        <circle key={i}
          cx={px(points.indexOf(p)).toFixed(1)}
          cy={py(p.score).toFixed(1)}
          r={3} fill="var(--c-warning)" />
      ))}
    </svg>
  )
  return draw ? <DrawSVG duration={1200}>{svg}</DrawSVG> : svg
}

function SectionBSkeleton({ message = 'Computing your Score Journey…' }) {
  return (
    <div style={card({ minHeight: 220 })}>
      <div style={{ ...LBL, marginBottom:10 }}>Score journey</div>
      <div className="sw-shimmer" style={{
        display:'flex', alignItems:'center', justifyContent:'center',
        height: 160, color: 'var(--c-text3)', fontSize: 12, fontStyle: 'italic',
        borderRadius: 'var(--r-md)', background: 'var(--c-surface2)',
      }}>
        {message}
      </div>
    </div>
  )
}

// SectionB — receives pre-computed scoreJourneyData via prop (D-SCORE-JOURNEY-1)
// scoreJourneyData shape:
//   { fq, risk, traj, hist, rHist, plan, viewMode, window, range }
function SectionB({ scoreJourneyData, onViewModeChange, rangeId, onRangeChange }) {
  // Skeleton if data not yet available (per spec §5.10 — render skeleton up to 3s)
  if (!scoreJourneyData) {
    return <SectionBSkeleton />
  }
  if (scoreJourneyData.error) {
    return <SectionBSkeleton message="Score Journey temporarily unavailable — try refreshing" />
  }

  const { fq, risk, traj, hist, rHist, plan, viewMode, range } = scoreJourneyData

  const wPts = hist?.points || []
  const rPts = rHist?.points || []
  const wΔ = wPts.length > 1
    ? wPts[wPts.length - 1].score - wPts[0].score : 0
  const rΔ = rPts.length > 1
    ? rPts[rPts.length - 1].score - rPts[0].score : 0

  // Plan-primary mode: only show "active" indicator when viewMode='plan' (X28.6)
  const planActive = !!plan && viewMode === 'plan'
  const planAvailable = !!plan && !planActive

  return (
    <div className="sw-card sw-card-elevated sw-tab-slide" key={`b-${viewMode}`} style={{
      margin: '0 0 var(--space-md)', borderRadius: 'var(--r-xl)',
      padding: 'var(--space-lg) var(--space-xl)',
    }}>
      <div style={{
        display:'flex', alignItems:'center', gap:6,
        marginBottom: 'var(--space-sm)',
      }}>
        <div style={LBL}>Score journey</div>
        <ExplainerChip id="TL-1" />
        <span style={{ marginLeft:'auto', fontSize: 10, color: 'var(--c-text3)' }}>
          window: {range}
        </span>
      </div>

      {/* Range-picker — ghost pills · sw-press · is-active.
          Active range is the resolved windowToHistoryRange, but user can override. */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 'var(--space-md)',
      }}>
        {RANGE_OPTIONS.map(opt => {
          const active = (rangeId || range) === opt.id
          return (
            <button
              key={opt.id}
              onClick={() => onRangeChange?.(opt.id)}
              className={['sw-tab-ghost', 'sw-press', active ? 'is-active' : ''].filter(Boolean).join(' ')}
              style={{ padding: '5px 12px', fontSize: 11 }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* B.1 Twin-score today (spec §5.3) — counter-up via Num animate */}
      <div style={{
        display:'grid', gridTemplateColumns:'1fr 1fr', gap: 'var(--space-sm)',
        marginBottom: 'var(--space-md)',
      }}>
        {[
          { label:'Wealth Score', val:fq.total,   band:fq.band,   delta:wΔ },
          { label:'Risk Score',   val:risk.total, band:risk.band, delta:rΔ },
        ].map(c => (
          <div key={c.label} style={{
            background:'var(--c-surface2)', borderRadius: 'var(--r-md)',
            padding: 'var(--space-md)', textAlign: 'center',
          }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: c.band.colour, lineHeight: 1.0 }}>
              <Num value={c.val} format="score" animate />
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: c.band.colour, marginTop: 2 }}>
              {c.band.name}
            </div>
            <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 2 }}>
              {c.label}
            </div>
            <div style={{ marginTop: 4 }}>
              <DiffBadge value={c.delta} />
            </div>
          </div>
        ))}
      </div>

      {/* B.2 Action level bars (spec §5.4) — fan in */}
      <div style={{ ...LBL, marginBottom: 6 }}>Action levels</div>
      <RevealStagger interval={60} style={{
        display:'flex', gap: 4, alignItems:'flex-end',
        height: 76, marginBottom: 'var(--space-md)',
      }}>
        {traj.map(t => {
          const h = Math.max(4, Math.round((t.score / 100) * 64))
          return (
            <div key={t.label} style={{
              flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap: 3,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.colour }}>{t.score}</div>
              <div style={{
                width:'100%', height: h, background: t.colour,
                borderRadius:'4px 4px 0 0', opacity: 0.85,
                transformOrigin: 'bottom center',
                animation: 'sw-bar-grow 700ms var(--ease-out-cubic) both',
              }} />
              <div style={{ fontSize: 9, color: 'var(--c-text3)', textAlign: 'center', lineHeight: 1.2 }}>{t.label}</div>
            </div>
          )
        })}
      </RevealStagger>

      {/* B.3 Wealth Score history line (read-only mirror — spec §5.10) */}
      <div style={{ marginBottom: 'var(--space-sm)' }}>
        <div style={{
          display:'flex', justifyContent:'space-between', marginBottom: 4,
        }}>
          <div style={{ fontSize: 10, color: 'var(--c-text3)' }}>
            Wealth Score · {hist.confidence} confidence
          </div>
          <div style={{
            fontSize: 10, fontWeight: 700,
            color: wΔ >= 0 ? 'var(--c-success)' : 'var(--c-danger)',
          }}>
            {wΔ >= 0 ? '+' : ''}{wΔ} pts ({range})
          </div>
        </div>
        <ScoreSparkline points={wPts} colour="var(--c-acc)" />
      </div>

      {/* B.4 Risk Score history line */}
      <div>
        <div style={{
          display:'flex', justifyContent:'space-between', marginBottom: 4,
        }}>
          <div style={{ fontSize: 10, color: 'var(--c-text3)' }}>
            Risk Score · {rHist?.confidence} confidence
          </div>
          <div style={{
            fontSize: 10, fontWeight: 700,
            color: rΔ <= 0 ? 'var(--c-success)' : 'var(--c-danger)',
          }}>
            {rΔ >= 0 ? '+' : ''}{rΔ} pts ({range})
          </div>
        </div>
        <ScoreSparkline points={rPts} colour="var(--c-acc2)" />
      </div>

      {/* Plan-primary mode indicator — only when viewMode='plan' (spec §X28.6) */}
      {planActive && (
        <div style={{
          marginTop: 'var(--space-sm)', padding: '8px 12px',
          background:'color-mix(in srgb, var(--c-success) 8%, transparent)', borderRadius: 'var(--r-md)',
          border: '1px solid color-mix(in srgb, var(--c-success) 20%, transparent)', fontSize: 11,
        }}>
          <span style={{ color:'var(--c-success)', fontWeight: 700 }}>Retirement plan active</span>
          <span style={{ color: 'var(--c-text2)' }}> — Forecast-vs-Plan tracking enabled (spec §X28.6)</span>
        </div>
      )}
      {planAvailable && (
        <button
          onClick={() => onViewModeChange?.('plan')}
          className="sw-press"
          style={{
            marginTop: 'var(--space-sm)', width: '100%', padding: '8px 12px',
            background: 'var(--c-surface2)', border: '1px dashed var(--c-sep)',
            borderRadius: 'var(--r-md)', fontSize: 11, color: 'var(--c-text2)', cursor: 'pointer',
          }}>
          Retirement plan committed — switch to Plan view to overlay
        </button>
      )}
      {!plan && (
        <div style={{
          marginTop: 'var(--space-sm)', padding: '8px 12px',
          background: 'var(--c-surface2)', borderRadius: 'var(--r-md)',
          fontSize: 11, color: 'var(--c-text3)',
        }}>
          No retirement plan yet — defaults to Forecast. Set a plan in §E to enable Plan-mode overlay.
        </div>
      )}

      {hist?.confidence === 'LOW' && (
        <div style={{
          fontSize: 10, color: 'var(--c-text3)',
          fontStyle: 'italic', marginTop: 6,
        }}>
          Score history is synthesised — activates when event log is live.
        </div>
      )}

      {/* X29 causality stripe — provenance for the chart sources */}
      <div style={{
        margin: 'var(--space-sm) calc(-1 * var(--space-xl)) calc(-1 * var(--space-lg))',
      }}>
        <CausalityStripe sources={[
          'calcScoreHistory · timeline-engine',
          'calcRiskHistory · timeline-engine',
          'D-SCORE-JOURNEY-1 mirror',
        ]} />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// §C — ACTION CALENDAR  (spec §6 · X28 window scopes forward range)
// ═══════════════════════════════════════════════════════════════════════════

const CAT_CHIPS = ['statutory', 'personal', 'action']

// Pick a semantic chip class based on time-pressure
function urgencyClass(daysAway, isOverdue) {
  if (isOverdue) return 'sw-chip-coral'
  if (daysAway != null && daysAway < 90) return 'sw-chip-coral'
  if (daysAway != null && daysAway < 180) return 'sw-chip-amber'
  return 'sw-chip-mint'
}

// Tiny ring-fill SVG used by the gift clock (CoI chip).
function GiftClockRing({ pct, size = 22, colour = 'var(--c-warning)' }) {
  const r = (size - 4) / 2
  const cx = size / 2, cy = size / 2
  const C = 2 * Math.PI * r
  const off = C - (Math.max(0, Math.min(100, pct)) / 100) * C
  return (
    <svg width={size} height={size} aria-hidden="true" style={{ display: 'inline-block' }}>
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke="rgba(255,255,255,.08)" strokeWidth={2.5} />
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke={colour} strokeWidth={2.5} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{
          strokeDasharray: C,
          strokeDashoffset: off,
          transition: 'stroke-dashoffset 1100ms var(--ease-out-cubic)',
        }}
      />
    </svg>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function buildCalendarEntries(entity, windowMonths = 12) {
  const coi    = costOfInaction(entity, 'sipp_iht')
  const dl     = daysLeft()
  const perDay = dl > 0 ? Math.round(coi / dl) : 0
  const age    = _age(entity)
  const spAge  = entity?.income?.statePension?.startAge ?? TAX.spa
  const apq    = calcAPQTimeline(entity)
  const noms   = nominationStatus(entity)
  const stale  = noms.filter(p => p.status === 'stale' || p.status === 'missing')
  const now    = new Date()
  const yr     = now.getFullYear()
  const horizonDays = Math.round(windowMonths * 30.44)
  const entries = []

  // Statutory: SIPP IHT deadline (spec §6.9 — date from TAX.deadline, not hardcoded)
  const sippDeadlineStr = TAX.deadline instanceof Date
    ? TAX.deadline.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '6 Apr 2027'
  // P1-4 (2026-05-28): gate sipp-iht on real SIPP/DC pension exposure.
  // Previously coi>0 was the only check, but coi can be > 0 for personas
  // with no DC pension simply because the legacy fq-calculator returns a
  // non-zero value from related domains. Personas without SIPP/DC saw a
  // fake deadline.
  // Walk every supported pension-location shape:
  // - entity.assets.pensions[]            (some UI personas)
  // - entity.assets.sipp.pensions[]       (Bruce shape — pensions nested in sipp wrapper)
  // - entity.assets.dc.pensions[]         (defensive)
  // - entity.individual.assets.pensions[] (mrT shape)
  const _pensionsList = [
    ...(Array.isArray(entity?.assets?.pensions) ? entity.assets.pensions : []),
    ...(Array.isArray(entity?.assets?.sipp?.pensions) ? entity.assets.sipp.pensions : []),
    ...(Array.isArray(entity?.assets?.dc?.pensions) ? entity.assets.dc.pensions : []),
    ...(Array.isArray(entity?.individual?.assets?.pensions) ? entity.individual.assets.pensions : []),
  ]
  const hasDCPension = _pensionsList.some(p => {
    const t = String(p?.type || '').toUpperCase()
    // DB pensions (defined benefit / final salary) are NOT subject to the
    // April 2027 rule — exclude. Everything else (SIPP / DC / Personal /
    // Stakeholder / Workplace / unspecified) gets the deadline row.
    const looksDB = /\bDB\b|DEFINED BENEFIT|FINAL SALARY/.test(t)
    if (looksDB) return false
    return (+p.value || 0) > 0
  })
  if (coi > 0 && hasDCPension) {
    entries.push({
      id:'sipp-iht', date: sippDeadlineStr, daysAway:dl, category:'statutory',
      title:'DC pensions enter estate for IHT',
      detail: perDay > 0 ? `${fmt(perDay)}/day accruing — ${fmt(coi)} total exposure` : `${fmt(coi)} at stake`,
      coiPerDay: perDay, coiTotal: coi,
      colour: dl < 90 ? 'var(--c-danger)' : dl < 180 ? 'var(--c-warning)' : 'var(--c-warning)',
      sources: ['ihtSippDelta · fq-calculator', 'TAX.deadline'],
    })
  }

  // Statutory: ISA allowance reset (5 Apr annually)
  const isaEnd = new Date(yr, 3, 5)
  if (isaEnd <= now) isaEnd.setFullYear(yr + 1)
  const isaDays = Math.round((isaEnd - now) / 86400000)
  if (isaDays <= horizonDays) {
    entries.push({
      id:'isa-reset', date:`5 Apr ${isaEnd.getFullYear()}`,
      daysAway: isaDays,
      category:'statutory',
      title:`ISA allowance resets — ${fmt(TAX.isaAllowance)} available`,
      detail:'Unused allowance does not carry forward.',
      colour:'var(--c-accent)',
      sources: ['TAX.isaAllowance · UK-2026.1'],
    })
  }

  // Statutory: 31 Jan SA deadline
  // P1-4 (2026-05-28): gate on real SA obligation — dividends, self-employment,
  // rental income, higher-rate employment, or directorship. Personas with only
  // PAYE basic-rate employment do NOT need to file SA.
  const saDate = new Date(yr + 1, 0, 31)
  const saDay  = Math.round((saDate - now) / 86400000)
  const hasSAObligation = (
    (+entity?.income?.dividends || 0) > 0
    || (+entity?.income?.selfEmploymentNet || 0) > 0
    || (+entity?.income?.rentalIncome || 0) > 0
    || (+entity?.income?.directorSalary || 0) > 0
    || !!entity?.company
    || (entity?.income?.employment || 0) > (TAX?.brt || 50270)
  )
  if (saDay > 0 && saDay < 400 && saDay <= horizonDays && hasSAObligation) {
    entries.push({
      id:'sa-deadline', date:`31 Jan ${yr + 1}`, daysAway:saDay,
      category:'statutory',
      title:'Self-assessment submission deadline',
      detail:'File SA100 and pay any balance due.',
      colour:'var(--c-accent)',
      sources: ['HMRC SA deadline'],
    })
  }

  // Personal: State Pension start date — only if within the window
  if (age < spAge) {
    const yearsTo = spAge - age
    const days = yearsTo * 365
    if (days <= horizonDays) {
      entries.push({
        id:'state-pension', date:`Age ${spAge} (~${yearsTo}yr)`,
        daysAway: days, category:'personal',
        title:'State Pension begins',
        detail:`${fmt(entity?.income?.statePension?.annual ?? TAX.statePensionFull)}/yr — reduces drawdown requirement.`,
        colour:'var(--c-success)',
        sources: ['entity.income.statePension', 'TAX.spa'],
      })
    }
  }

  // Action: APQ deadline-linked items (spec §10.2 calcAPQ extension)
  for (const a of apq) {
    if (a.deadline && a.id !== 'pension-drawdown') {
      const d = new Date(a.deadline)
      const dAway = Math.round((d - now) / 86400000)
      if (dAway > 0 && dAway < 500 && dAway <= horizonDays) {
        entries.push({
          id:`apq-${a.id}`, date:a.deadline, daysAway:dAway,
          category:'action', title:a.title, detail:a.detail, colour:'var(--c-muted)',
          sources: [`calcAPQ · ${a.id}`],
        })
      }
    }
  }

  // Action: Stale pension nominations (spec §6.4 Action category)
  if (stale.length > 0) {
    entries.push({
      id:'nominations', date:'Overdue', daysAway:-1, category:'action',
      title:`Pension nomination${stale.length > 1 ? 's' : ''} need updating`,
      detail:`${stale.length} pension${stale.length > 1 ? 's' : ''} with stale or missing nominations.`,
      colour:'var(--c-warning)',
      sources: ['nominationStatus · fq-calculator'],
    })
  }

  // Action: Trust gift clock (spec §6.9 dynamic — 7-year taper anniversaries)
  if (entity?.assets?.trustGifts?.date) {
    const pct   = giftPct(entity.assets.trustGifts.date)
    const taper = taperBand(entity.assets.trustGifts.date)
    entries.push({
      id:'trust-gift', date:entity.assets.trustGifts.date, daysAway:null,
      category:'action',
      title:`Gift clock — ${pct}% elapsed towards IHT-free`,
      detail:`${taper.label} · ${fmt(entity.assets.trustGifts.total)} gifted.`,
      giftPct: pct,
      colour:'var(--c-warning)',
      sources: ['giftPct · taperBand'],
    })
  }

  // Personal: Mortgage fixed rate expiry
  if (entity?.liabilities?.mortgage?.endDate) {
    const mortEnd  = new Date(entity.liabilities.mortgage.endDate)
    const mortDays = Math.round((mortEnd - now) / 86400000)
    if (mortDays > 0 && mortDays < 365 * 5 && mortDays <= horizonDays) {
      entries.push({
        id:'mortgage-fix', date:entity.liabilities.mortgage.endDate, daysAway:mortDays,
        category:'personal',
        title:'Mortgage fixed rate expires',
        detail:'Review and remortgage before rate reverts to SVR.',
        colour:'var(--c-warning)',
        sources: ['entity.liabilities.mortgage.endDate'],
      })
    }
  }

  return entries
}

// Route a calendar entry to the owning screen (spec §6 action routing)
function calendarEntryNav(e, onNav) {
  if (!onNav) return
  switch (e.id) {
    case 'sipp-iht':
    case 'sa-deadline':
    case 'trust-gift':
      onNav('tax'); break
    case 'isa-reset':
    case 'nominations':
    case 'mortgage-fix':
      onNav('money'); break
    case 'state-pension':
      onNav('flow'); break
    default:
      // APQ entries or unknown — try safeRoute from entry action field, else money
      onNav(e.navTarget || 'money')
  }
}

function CalendarEntryRow({ e, isLast, onNav }) {
  const isOverdue = (e.daysAway != null && e.daysAway < 0) || (e.daysAway === null && e.category === 'action')
  const chipClass = urgencyClass(e.daysAway, isOverdue)
  const showDayCounter = e.id === 'sipp-iht' && e.daysAway != null && e.daysAway > 0 && e.daysAway <= 365
  const dayCount = useCounterAnimation(e.daysAway ?? 0, { duration: 900, format: (n) => `${Math.round(n)}` })
  const coiCount = useCounterAnimation(e.coiPerDay ?? 0, { duration: 900, format: (n) => `£${Math.round(n).toLocaleString('en-GB')}` })

  return (
    <div
      className="sw-press"
      onClick={() => calendarEntryNav(e, onNav)}
      style={{
        padding: 'var(--space-sm) 0',
        borderBottom: isLast ? 'none' : '1px solid var(--c-sep)',
        cursor: 'pointer',
      }}>
      <div style={{
        display:'flex', justifyContent:'space-between',
        alignItems:'flex-start', marginBottom: 4, gap: 'var(--space-sm)',
      }}>
        <div style={{
          display:'flex', alignItems:'center', gap: 6, flex: 1, flexWrap: 'wrap',
          minWidth: 0,
        }}>
          {e.id === 'trust-gift' && e.giftPct != null && (
            <GiftClockRing pct={e.giftPct} colour={e.colour} />
          )}
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>
            {e.title}
          </div>
          {isOverdue && (
            <span className="sw-chip sw-chip-sm sw-chip-coral" style={{ fontWeight: 800, letterSpacing: 0.5 }}>
              Overdue
            </span>
          )}
        </div>
        <span className={`sw-chip sw-chip-sm ${chipClass}`} style={{ flexShrink: 0, fontWeight: 700 }}>
          {e.date}
        </span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.5 }}>{e.detail}</div>

      {showDayCounter && (
        <div style={{
          fontSize: 11, fontWeight: 700, marginTop: 4,
          display: 'flex', alignItems: 'center', gap: 8, color: e.colour,
        }}>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{dayCount} days remaining</span>
          {e.coiPerDay > 0 && (
            <span className="sw-chip sw-chip-sm sw-chip-coral" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {coiCount}/day
            </span>
          )}
        </div>
      )}

      {/* X29 causality per-row */}
      {e.sources?.length > 0 && (
        <div style={{ marginTop: 6, fontSize: 10, color: 'var(--c-text3)' }}>
          <span style={{ color:'var(--c-acc2)' }}>↳ </span>
          {e.sources.join(' · ')}
        </div>
      )}
    </div>
  )
}

function SectionC({ entity, windowId, onNav }) {
  const [catFilter, setCatFilter] = useState([...CAT_CHIPS])
  // Window controls horizon: lifetime → 60mo, 12mo → 12, custom → 24, default 12
  const horizonMonths = useMemo(() => {
    switch (windowId) {
      case 'lifetime':       return 600
      case 'last-12-months': return 12
      case 'current-tax-year':
      case 'calendar-year':  return 12
      case 'current-month':
      case 'last-30-days':   return 6
      case 'custom':         return 24
      default:               return 12
    }
  }, [windowId])

  const entries = buildCalendarEntries(entity, horizonMonths)

  // Sort: overdue (daysAway < 0 OR null with action category) at TOP, then ascending date
  const sorted = entries
    .filter(e => catFilter.includes(e.category))
    .sort((a, b) => {
      const aOver = (a.daysAway != null && a.daysAway < 0) || (a.daysAway === null && a.category === 'action')
      const bOver = (b.daysAway != null && b.daysAway < 0) || (b.daysAway === null && b.category === 'action')
      if (aOver && !bOver) return -1
      if (!aOver && bOver) return 1
      if (a.daysAway === null && b.daysAway === null) return 0
      if (a.daysAway === null) return 1
      if (b.daysAway === null) return -1
      return a.daysAway - b.daysAway
    })

  return (
    <div style={card()}>
      <div style={{
        display:'flex', alignItems:'center', gap: 6,
        marginBottom: 'var(--space-sm)',
      }}>
        <div style={LBL}>Action calendar</div>
        <span style={{ marginLeft:'auto', fontSize: 10, color: 'var(--c-text3)' }}>
          horizon: {horizonMonths >= 600 ? 'lifetime' : `${horizonMonths}mo`}
        </span>
      </div>

      {/* Category filter chips (spec §6.4 — all on by default). Use sw-chip + sw-press. */}
      <div style={{
        display:'flex', gap: 4, marginBottom: 'var(--space-md)', flexWrap:'wrap',
      }}>
        {CAT_CHIPS.map(c => {
          const on = catFilter.includes(c)
          return (
            <button
              key={c}
              onClick={() => setCatFilter(f => on ? f.filter(x => x !== c) : [...f, c])}
              className={['sw-chip', 'sw-chip-sm', 'sw-press', on ? 'sw-chip-mint' : ''].filter(Boolean).join(' ')}
              style={{
                cursor: 'pointer', fontWeight: 600, letterSpacing: 0.4,
                border: on ? 'none' : '1px solid var(--c-sep)',
              }}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          )
        })}
      </div>

      {sorted.length === 0 ? (
        <div style={{
          fontSize: 12, color: 'var(--c-text3)', textAlign: 'center',
          padding: 'var(--space-md) 0',
        }}>
          No calendar entries for selected categories within the {horizonMonths >= 600 ? 'lifetime' : `${horizonMonths}-month`} horizon.
        </div>
      ) : (
        <RevealStagger interval={50}>
          {sorted.map((e, i) => (
            <CalendarEntryRow key={e.id} e={e} isLast={i === sorted.length - 1} onNav={onNav} />
          ))}
        </RevealStagger>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// §D — DECISION LOG  (spec §7)
// ═══════════════════════════════════════════════════════════════════════════

function SectionD({ entity }) {
  const decisions = entity?.decisions ?? []
  const [expanded, setExpanded] = useState(null)

  if (decisions.length === 0) {
    return (
      <FadeInOnMount style={card()}>
        <div style={{ ...LBL, marginBottom: 'var(--space-md)' }}>Decision log</div>
        <div style={{
          textAlign: 'center', padding: 'var(--space-lg) 0',
        }}>
          <div style={{ fontSize: 13, color: 'var(--c-text2)', marginBottom: 6 }}>
            No decisions logged yet.
          </div>
          <div style={{ fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.6 }}>
            As you commit Take Action paths from any tab, they appear here — your structured audit trail.
          </div>
        </div>
      </FadeInOnMount>
    )
  }

  return (
    <div style={card()}>
      <div style={{
        display:'flex', justifyContent:'space-between',
        alignItems:'center', marginBottom: 'var(--space-md)',
      }}>
        <div style={LBL}>Decision log</div>
        <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>
          {decisions.length} decision{decisions.length !== 1 ? 's' : ''} logged
        </div>
      </div>

      <RevealStagger interval={50}>
        {decisions.slice(0, 6).map((d, i) => {
          const isExp = expanded === i
          const impScore = d.impact?.finioScore ?? d.impact?.fqDelta ?? null
          return (
            <div
              key={d.id ?? i}
              className="sw-press"
              style={{
                padding: 'var(--space-sm) 0', cursor: 'pointer',
                borderBottom: i < Math.min(decisions.length, 6) - 1 ? '1px solid var(--c-sep)' : 'none',
              }}
              onClick={() => setExpanded(isExp ? null : i)}
            >
              <div style={{
                display:'flex', justifyContent:'space-between',
                alignItems:'flex-start', marginBottom: 2,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)', flex: 1 }}>
                  {d.title || d.type || 'Decision'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--c-text3)', marginLeft: 8, flexShrink: 0 }}>
                  {d.date || d.committed_at?.substring(0, 10) || ''}
                </div>
              </div>
              {d.detail && (
                <div style={{ fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.5 }}>{d.detail}</div>
              )}
              {impScore != null && (
                <div style={{ marginTop: 4 }}>
                  <DiffBadge value={impScore} />
                  <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--c-text3)' }}>Wealth Score impact</span>
                </div>
              )}
              {isExp && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--c-text3)' }}>
                  Source: {d.source || 'n/a'} · Step-up: {d.stepUp || 'L1'} · ID: {d.id || 'n/a'}
                </div>
              )}
            </div>
          )
        })}
      </RevealStagger>

      {decisions.length > 6 && (
        <div style={{
          fontSize: 11, color: 'var(--c-text3)',
          textAlign: 'center', paddingTop: 'var(--space-sm)',
        }}>
          +{decisions.length - 6} more decisions in log
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// §E — SCENARIO LIBRARY & PLAN-BUILDER  (spec §8 + §X24-TL-MODE3)
// goalSeek now real (spec §M3.1) — solver returns ranked action paths.
// planFor / planStaleness now real — surface actual target + staleness pill.
// ═══════════════════════════════════════════════════════════════════════════

// Format plan target with canonical scalar (target_display) per Batch 1 contract.
// Falls back to fmt(target) only if scalar AND object shape both absent.
function formatPlanTarget(row) {
  const { pt, plan, displayTarget } = row
  if (displayTarget != null) {
    // Scalar (number or pre-formatted string like "Age 65")
    if (typeof displayTarget === 'number') return fmt(displayTarget)
    return String(displayTarget)
  }
  // Last-resort fallback — only safe when target is itself a primitive
  const t = plan?.target
  if (t == null) return ''
  if (typeof t === 'number') return fmt(t)
  if (typeof t === 'string') return t
  // Object target with no display scalar — derive a sensible primitive
  if (typeof t === 'object') {
    if (typeof t.netWorth === 'number') return fmt(t.netWorth)
    if (typeof t.ihtCap === 'number')   return `IHT cap ${fmt(t.ihtCap)}`
    if (typeof t.gapAmount === 'number') return `gap < ${fmt(t.gapAmount)}`
    if (typeof t.age === 'number')      return `Age ${t.age}`
    // Last-ditch: do NOT render fmt(object) — show plan label-style placeholder.
    return pt.label
  }
  return ''
}

// F6 (2026-06-02): plan types whose goal-seek maps to a metric the solver
// actually supports (SUPPORTED_METRICS in GoalSeek: wealthScore/riskScore/
// netWorth/iht). The other plan types (cashflow/debt/gift/protection/tax/
// custom) have no real solver path yet, so the per-plan "Edit · Goal-seek"
// button is gated OFF rather than routed to a dead "coming soon" panel. The
// dropdown was hardened the same way (P1-23); the row Edit button had re-opened
// the §9 affordance-pretends hole — this closes it.
const PLAN_GOALSEEK_METRIC = { retirement: 'netWorth', estate: 'iht' }

function PlanRow({ row, isLast, onEditGoalSeek }) {
  const { pt, plan, staleness, exists } = row
  const [open, setOpen] = useState(false)
  const stale = staleness?.stale
  const lbl   = exists ? (stale ? 'Stale' : 'Current') : 'Not set'
  const chipClass = !exists ? '' : (stale ? 'sw-chip-amber' : 'sw-chip-mint')

  const targetFormatted = exists ? formatPlanTarget(row) : ''
  const targetText      = targetFormatted ? `target ${targetFormatted}` : ''

  return (
    <div
      className="sw-press"
      onClick={() => exists && setOpen(o => !o)}
      style={{
        padding: '8px 0',
        borderBottom: isLast ? 'none' : '1px solid var(--c-sep)',
        cursor: exists ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
        <div style={{
          width: 26, height: 26, borderRadius: 'var(--r-sm)',
          fontSize: 13, flexShrink: 0,
          background: exists ? 'var(--c-acc-bg)' : 'var(--c-surface2)',
          color: exists ? 'var(--c-acc)' : 'var(--c-text3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{pt.glyph}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text)' }}>
            {pt.label}
          </div>
          {exists && (
            <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 1 }}>
              {staleness?.reason || 'Plan current'}
              {targetText ? ` · ${targetText}` : ''}
            </div>
          )}
        </div>
        <span
          className={['sw-chip', 'sw-chip-sm', chipClass].filter(Boolean).join(' ')}
          style={{ flexShrink: 0, fontWeight: 700 }}>
          {lbl}
        </span>
      </div>
      {open && exists && (
        <div className="sw-fade-in" style={{
          marginTop: 8, padding: 8, borderRadius: 'var(--r-sm)',
          background: 'var(--c-surface2)', fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.5,
        }}>
          <div><b>Target:</b> {targetFormatted || '—'}</div>
          <div><b>Window:</b> {plan?.targetWindow || '—'}</div>
          <div><b>Committed:</b> {plan?.committed_at?.substring(0, 10) || plan?.committedAt?.substring(0, 10) || '—'}</div>
          {staleness?.severity && staleness.severity !== 'none' && (
            <div><b>Staleness:</b> {staleness.severity} — {staleness.reason}</div>
          )}
          {/* HIGH 5.3 — per-plan interactive entry per spec §PLAN-ANCHOR-TL §E mode 3.
              F6: only shown for plan types with a real solver metric; others get
              no dead button (the goal-seek for them genuinely isn't built). */}
          {PLAN_GOALSEEK_METRIC[pt.id] ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEditGoalSeek?.(PLAN_GOALSEEK_METRIC[pt.id])
              }}
              className="sw-press"
              style={{
                marginTop: 8, padding: '6px 12px', borderRadius: 'var(--r-pill)',
                fontSize: 11, fontWeight: 700,
                border: '1px solid var(--c-acc)',
                background: 'var(--c-acc-bg)', color: 'var(--c-acc)',
                cursor: 'pointer',
              }}
            >
              Edit · Goal-seek
            </button>
          ) : (
            <div style={{ marginTop: 8, fontSize: 10, color: 'var(--c-text3)', fontStyle: 'italic' }}>
              Goal-seek for this plan type isn’t available yet.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Scenarios source-of-truth resolver (MED 4.3 — prefer persona.scenarios when present) ───
function resolveScenarios(entity) {
  const personaScenarios = Array.isArray(entity?.scenarios) ? entity.scenarios : []
  if (personaScenarios.length > 0) {
    return personaScenarios.map(sc => ({
      scenarioId:    sc.id || sc.scenarioId,
      name:          sc.name,
      source:        sc.source || 'persona',
      saved_at:      sc.createdAt || sc.saved_at || null,
      rules_version: sc.rules_version || entity?.rulesVersion || 'UK-2026.1',
      status:        sc.status || 'saved',
      deltaResults:  sc.deltaResults || null,
    }))
  }
  // Fall back to engine fixture pool
  try { return listScenarios(entity?.id || 'demo') } catch { return [] }
}

// ─── Plan-rows builder (shared by §F.1 headline + §E section) ───
// Returns row {pt, plan, staleness, exists, displayTarget, fundedPct, label}
// where displayTarget is the canonical scalar (CRIT-3 fix — Batch 1 contract).
function buildPlanRows(entity) {
  const rawPlans = Array.isArray(entity?.plans) ? entity.plans : []
  return PLAN_TYPES.map(pt => {
    const plan      = planFor(entity, pt.id)
    const raw       = rawPlans.find(p => p && (p.type === pt.id || p.planType === pt.id))
    const staleness = plan
      ? planStaleness(entity, pt.id)
      : { stale:false, reason:'No plan committed', severity:'none' }
    // CRIT-3: prefer target_display scalar (Batch 1) over object target
    const displayTarget = raw?.target_display ?? (typeof plan?.target === 'number' || typeof plan?.target === 'string' ? plan.target : null)
    // Funded ratio: surface best deltaResults from persona scenarios if any
    const scList = Array.isArray(entity?.scenarios) ? entity.scenarios : []
    const fundedFromScenarios = scList
      .map(s => s?.deltaResults?.fundedRatio)
      .filter(v => typeof v === 'number')
    const fundedPct = fundedFromScenarios.length > 0
      ? Math.max(...fundedFromScenarios) // most optimistic saved scenario
      : null
    return {
      pt, plan, staleness, exists: !!plan,
      displayTarget,
      fundedPct,
      label: raw?.label || pt.label,
      timeWindow: raw?.target?.date || raw?.target?.age || plan?.targetWindow || null,
    }
  })
}

// ─── On-track / Behind / Off-track pill (CRIT 4.1 wording anchor) ───
function TrackingPill({ fundedPct }) {
  if (fundedPct == null) {
    return (
      <span className="sw-chip sw-chip-sm" style={{
        color: 'var(--c-text3)', background: 'var(--c-surface2)',
        fontWeight: 700, letterSpacing: 0.3,
      }}>Awaiting data</span>
    )
  }
  let label, cls
  if (fundedPct >= 1.0)      { label = 'On track';     cls = 'sw-chip-mint'  }
  else if (fundedPct >= 0.85) { label = 'Tracking behind'; cls = 'sw-chip-amber' }
  else                        { label = 'Off track';    cls = 'sw-chip-coral' }
  return (
    <span className={`sw-chip sw-chip-sm ${cls}`} style={{ fontWeight: 700, letterSpacing: 0.3 }}>
      {label}
    </span>
  )
}

// ─── §F.1 Plan-funded headline (CRIT 1.1 / 4.1 / 7.1 — "Am I on track?" in 5s) ───
function PlanFundedHeadline({ entity, planRows, onOpenGoalSeek }) {
  // Pick most-funded active plan; default to retirement if present, else first existing
  const existing = planRows.filter(r => r.exists)
  if (existing.length === 0) {
    return (
      <FadeInOnMount
        className="sw-card sw-card-elevated"
        style={{
          margin: '0 0 var(--space-md)',
          padding: 'var(--space-lg) var(--space-xl)',
          borderRadius: 'var(--r-xl)',
          background: 'linear-gradient(135deg, color-mix(in srgb, var(--c-accent) 8%, transparent), var(--c-surface) 60%)',
          border: '1px solid color-mix(in srgb, var(--c-accent) 25%, transparent)',
          textAlign: 'center',
        }}
      >
        <div style={{ ...LBL, marginBottom: 4, color: 'var(--c-accent)' }}>Your plan</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--c-text)', marginBottom: 4 }}>
          You haven't set a plan yet.
        </div>
        <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.5, marginBottom: 'var(--space-md)' }}>
          Pick a target — Wealth Score, Net Worth, retirement age — and the engine ranks
          the paths that move you closest, fastest.
        </div>
        <button
          onClick={() => onOpenGoalSeek?.()}
          className="sw-press"
          style={{
            padding: '11px 22px', borderRadius: 'var(--r-pill)',
            fontSize: 13, fontWeight: 700,
            border: 'none', background: 'var(--c-acc)', color: 'var(--c-bg)',
            cursor: 'pointer',
          }}
        >
          Set your first plan →
        </button>
      </FadeInOnMount>
    )
  }

  // Prioritise retirement if it exists, else the first
  const headline = existing.find(r => r.pt.id === 'retirement') || existing[0]
  const targetFormatted = formatPlanTarget(headline)
  const fundedPct = headline.fundedPct
  const progress  = fundedPct != null ? Math.min(1, Math.max(0, fundedPct)) : 0
  const pctLabel  = fundedPct != null ? `${Math.round(fundedPct * 100)}%` : '—'

  // Resolve time-to-target string
  let timeStr = ''
  const t = headline.plan?.target
  if (t && typeof t === 'object') {
    if (t.date) {
      const tgtYear = new Date(t.date).getFullYear()
      const nowYear = new Date().getFullYear()
      const yrs = tgtYear - nowYear
      if (yrs > 0) timeStr = `~${yrs}y to target`
    } else if (typeof t.age === 'number') {
      const eAge = _age(entity)
      if (eAge && t.age > eAge) timeStr = `~${t.age - eAge}y to target`
    }
  }

  const barColor = fundedPct == null
    ? 'var(--c-text3)'
    : fundedPct >= 1.0 ? 'var(--c-success)'
    : fundedPct >= 0.85 ? 'var(--c-warning)'
    : 'var(--c-danger)'

  return (
    <FadeInOnMount
      className="sw-card sw-card-elevated"
      style={{
        margin: '0 0 var(--space-md)',
        padding: 'var(--space-lg) var(--space-xl)',
        borderRadius: 'var(--r-xl)',
        background: `linear-gradient(135deg, color-mix(in srgb, ${barColor} 8%, transparent), var(--c-surface) 60%)`,
        border: `1px solid color-mix(in srgb, ${barColor} 22%, transparent)`,
      }}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)',
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ ...LBL, marginBottom: 2, color: 'var(--c-accent)' }}>Your plan · headline</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--c-text)', lineHeight: 1.25 }}>
            {headline.label}
          </div>
          <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 3 }}>
            {targetFormatted ? `Target ${targetFormatted}` : 'Target —'}
            {timeStr ? ` · ${timeStr}` : ''}
          </div>
        </div>
        <TrackingPill fundedPct={fundedPct} />
      </div>

      <div style={{ marginBottom: 'var(--space-sm)' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          marginBottom: 4,
        }}>
          <span style={{ fontSize: 11, color: 'var(--c-text3)' }}>Funded</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: barColor, fontVariantNumeric: 'tabular-nums' }}>
            {pctLabel}
          </span>
        </div>
        <ProgressBar progress={progress} colour={barColor} />
      </div>

      <div style={{
        display: 'flex', gap: 'var(--space-sm)', alignItems: 'center',
        marginTop: 'var(--space-md)',
      }}>
        <button
          onClick={() => onOpenGoalSeek?.(headline.pt.id)}
          className="sw-press"
          style={{
            flex: 1, padding: '9px 14px', borderRadius: 'var(--r-pill)',
            fontSize: 12, fontWeight: 700,
            background: 'var(--c-acc)', color: 'var(--c-bg)',
            border: 'none', cursor: 'pointer',
          }}
        >
          Review · adjust this plan →
        </button>
      </div>

      <div style={{
        fontSize: 10, color: 'var(--c-text3)', marginTop: 8, fontStyle: 'italic', lineHeight: 1.5,
      }}>
        Funded% derived from saved scenarios; the engine models — not advice.
      </div>
    </FadeInOnMount>
  )
}

function SectionE({ entity, planRows, scenarios, onOpenGoalSeek, onEditGoalSeek }) {
  const activeCount = planRows.filter(r => r.exists).length

  return (
    <div style={card()}>
      <div style={{ ...LBL, marginBottom: 'var(--space-md)' }}>Scenarios & Plans</div>

      {/* HIGH 5.4 — primary CTA at top of §E (was buried at bottom). Jargon-free. */}
      <div style={{ marginBottom: 'var(--space-md)' }}>
        <button
          onClick={() => onOpenGoalSeek?.()}
          className="sw-press"
          style={{
            width: '100%', padding: '11px 0', borderRadius: 'var(--r-md)',
            fontSize: 13, fontWeight: 700,
            border: 'none', cursor: 'pointer',
            background: 'var(--c-acc)', color: 'var(--c-bg)',
          }}>
          Set a plan →
        </button>
      </div>

      {/* Active Plans subsection (spec §PA.5 — all 8 planTypes with REAL data) */}
      <div style={{ marginBottom: 'var(--space-md)' }}>
        <div style={{
          display:'flex', justifyContent:'space-between',
          alignItems:'center', marginBottom: 'var(--space-sm)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text3)' }}>Active Plans</div>
          <div style={{ fontSize: 10, color: 'var(--c-text3)' }}>
            {activeCount}/{PLAN_TYPES.length} set
          </div>
        </div>
        <RevealStagger interval={45}>
          {planRows.map((row, i) => (
            <PlanRow
              key={row.pt.id}
              row={row}
              isLast={i === planRows.length - 1}
              onEditGoalSeek={onEditGoalSeek}
            />
          ))}
        </RevealStagger>
      </div>

      {/* Scenario library (spec §8.2 E.3) — MED 4.3: now reads from entity.scenarios when present */}
      <div style={{ borderTop: '1px solid var(--c-sep)', paddingTop: 'var(--space-md)' }}>
        <div style={{
          display:'flex', justifyContent:'space-between',
          alignItems:'center', marginBottom: 'var(--space-sm)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text3)' }}>Saved Scenarios</div>
          <div style={{ fontSize: 10, color: 'var(--c-text3)' }}>{scenarios.length} saved</div>
        </div>
        {scenarios.length === 0 ? (
          <div style={{
            fontSize: 12, color: 'var(--c-text3)',
            fontStyle: 'italic', marginBottom: 'var(--space-sm)',
          }}>
            No scenarios saved yet. Explore a What If from any tab to save your first.
          </div>
        ) : (
          <RevealStagger interval={50}>
            {scenarios.slice(0, 4).map((sc, i) => (
              <div key={sc.scenarioId || i} style={{
                padding: 'var(--space-sm) 0',
                borderBottom: i < Math.min(scenarios.length, 4) - 1 ? '1px solid var(--c-sep)' : 'none',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text)' }}>{sc.name}</div>
                <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 2 }}>
                  {sc.saved_at?.substring(0, 10)} · {sc.source} · {sc.rules_version}
                </div>
                {sc.deltaResults?.fundedRatio != null && (
                  <div style={{ marginTop: 4 }}>
                    <TrackingPill fundedPct={sc.deltaResults.fundedRatio} />
                    <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--c-text3)' }}>
                      funded {Math.round(sc.deltaResults.fundedRatio * 100)}%
                    </span>
                  </div>
                )}
              </div>
            ))}
          </RevealStagger>
        )}
      </div>
    </div>
  )
}

// ─── Goal-seek sheet (lifted from §E so it can be opened from §F.1 headline + PlanRow) ───
function GoalSeekSheet({ entity, open, initialMetric, onClose, onCommit }) {
  const [seekTarget, setSeekTarget]     = useState({ metric: initialMetric || 'wealthScore', value: 80 })
  const [seekResults, setSeekResults]   = useState(null)
  const [seekComingSoon, setSeekComingSoon] = useState(false)

  // Sync metric when caller changes initialMetric (e.g. PlanRow Edit clicked for a different plan)
  useEffect(() => {
    if (open && initialMetric) {
      setSeekTarget(s => ({ ...s, metric: initialMetric }))
      setSeekResults(null)
      setSeekComingSoon(false)
    }
  }, [open, initialMetric])

  if (!open) return null

  // Metrics fully handled by goalSeek engine (all others fall through to scoreDelta — meaningless)
  const SUPPORTED_METRICS = ['wealthScore', 'riskScore', 'netWorth', 'iht']

  function runGoalSeek() {
    if (!SUPPORTED_METRICS.includes(seekTarget.metric)) {
      // Plan-type metrics (retirement, estate, cashflow, debt, gift, protection, tax, custom)
      // are not yet fully modelled in goalSeek — return null to show "coming soon" UI
      setSeekResults(null)
      setSeekComingSoon(true)
      return
    }
    setSeekComingSoon(false)
    try {
      const paths = goalSeek(entity, seekTarget.metric, +seekTarget.value, '12mo', { maxAction: 200000 })
      setSeekResults(paths)
    } catch {
      setSeekResults([])
    }
  }

  function commitGoalSeekPath(path) {
    // Map each metric to its correct envelope type so the matching PlanRow
    // updates (e.g. selecting "Estate plan" must produce type:'estate').
    const METRIC_TO_ENVELOPE = {
      wealthScore:  'retirement',
      netWorth:     'retirement',
      iht:          'estate',
      riskScore:    'protection',
      retirement:   'retirement',
      estate:       'estate',
      cashflow:     'cashflow',
      debt:         'debt',
      gift:         'gift',
      protection:   'protection',
      tax:          'tax',
      custom:       'custom',
    }
    const planEnvelope = {
      type: METRIC_TO_ENVELOPE[seekTarget.metric] ?? 'custom',
      target: +seekTarget.value,
      targetWindow: '12mo',
      actions: [path.action],
    }
    const evt = commitPlan(entity, planEnvelope)
    onCommit?.(evt)
    setSeekResults(null)
    onClose?.()
  }

  return (
    <div className="sheet-overlay">
      <div className="sheet-backdrop" onClick={() => { setSeekResults(null); onClose?.() }} />
      <div className="sheet-panel">
        <div className="sheet-handle" />
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--c-text)', marginBottom: 'var(--space-sm)' }}>
          Set a plan — goal-seek
        </div>
        <div style={{ fontSize: 13, color: 'var(--c-text2)', lineHeight: 1.6, marginBottom: 'var(--space-md)' }}>
          Pick a target outcome — the engine searches the action space and ranks the paths
          that move you closest, fastest.
        </div>

        <div style={{
          display:'grid', gridTemplateColumns:'1fr 1fr',
          gap: 'var(--space-sm)', marginBottom: 'var(--space-md)',
        }}>
          <select
            value={seekTarget.metric}
            onChange={e => { setSeekTarget(s => ({ ...s, metric: e.target.value })); setSeekComingSoon(false) }}
            style={{
              padding: '10px 12px', borderRadius: 'var(--r-md)', fontSize: 13,
              background: 'var(--c-surface2)', color: 'var(--c-text)',
              border: '1px solid var(--c-sep)',
            }}>
            {/* P1-23 (2026-05-28): only the 4 supported plan types are
                rendered — the previous 12-option list had 8 routes to
                "coming soon" which is an affordance-pretends violation
                per §9. The 8 unsupported types are listed below in a
                disabled <optgroup> so users can see the roadmap. */}
            <option value="wealthScore">Wealth Score</option>
            <option value="riskScore">Risk Score</option>
            <option value="netWorth">Net Worth</option>
            <option value="iht">IHT exposure</option>
            <optgroup label="Coming soon — engine not yet wired">
              <option value="retirement" disabled>Retirement plan</option>
              <option value="estate"     disabled>Estate plan</option>
              <option value="cashflow"   disabled>Cashflow plan</option>
              <option value="debt"       disabled>Debt plan</option>
              <option value="gift"       disabled>Gift plan</option>
              <option value="protection" disabled>Protection plan</option>
              <option value="tax"        disabled>Tax plan</option>
              <option value="custom"     disabled>Custom plan</option>
            </optgroup>
          </select>
          <input
            type="number"
            value={seekTarget.value}
            onChange={e => setSeekTarget(s => ({ ...s, value: e.target.value }))}
            placeholder="Target value"
            style={{
              padding: '10px 12px', borderRadius: 'var(--r-md)', fontSize: 13,
              background: 'var(--c-surface2)', color: 'var(--c-text)',
              border: '1px solid var(--c-sep)',
            }}
          />
        </div>

        <button
          onClick={runGoalSeek}
          className="sw-press"
          style={{
            width: '100%', padding: 'var(--space-sm) 0', borderRadius: 'var(--r-md)',
            fontSize: 13, fontWeight: 700, border: 'none',
            background: 'var(--c-acc)', color: 'var(--c-bg)', cursor: 'pointer',
            marginBottom: 'var(--space-md)',
          }}>
          Find paths
        </button>

        {seekResults && seekResults.length > 0 && (
          <div>
            <div style={{ ...LBL, marginBottom: 6 }}>Action paths (ranked by gap)</div>
            <RevealStagger interval={70}>
              {seekResults.slice(0, 4).map((p, i) => (
                <div key={i} style={{
                  padding: 'var(--space-sm) 0',
                  borderBottom: i < Math.min(seekResults.length, 4) - 1 ? '1px solid var(--c-sep)' : 'none',
                }}>
                  <div style={{
                    display:'flex', justifyContent:'space-between',
                    alignItems:'center', marginBottom: 4,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>
                      {p.action.kind} · {fmt(p.action.amount)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>
                      achieves {p.achieves} · gap {p.gap}
                    </div>
                  </div>
                  <button
                    onClick={() => commitGoalSeekPath(p)}
                    className="sw-press"
                    style={{
                      marginTop: 4, padding: '5px 10px', borderRadius: 'var(--r-pill)',
                      fontSize: 11, fontWeight: 700, border: '1px solid var(--c-acc)',
                      background: 'var(--c-acc-bg)', color: 'var(--c-acc)', cursor: 'pointer',
                    }}>
                    Commit this path
                  </button>
                </div>
              ))}
            </RevealStagger>
          </div>
        )}
        {seekResults && seekResults.length === 0 && (
          <div style={{
            fontSize: 12, color: 'var(--c-text3)',
            fontStyle: 'italic', padding: 'var(--space-sm) 0',
          }}>
            No paths found within constraints — try a less aggressive target.
          </div>
        )}

        {seekComingSoon && (
          <div style={{
            padding: 'var(--space-md)', borderRadius: 'var(--r-md)',
            background: 'var(--c-surface2)', border: '1px solid var(--c-sep)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', marginBottom: 4 }}>
              Goal-seek for this plan type is coming soon
            </div>
            <div style={{ fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.6 }}>
              Full solver support for {seekTarget.metric} plans is in progress.
              Use Wealth Score, Risk Score, Net Worth, or IHT exposure for now.
            </div>
          </div>
        )}

        <button
          onClick={() => { setSeekResults(null); onClose?.() }}
          className="sw-press"
          style={{
            width: '100%', marginTop: 'var(--space-lg)', padding: '11px 0',
            borderRadius: 'var(--r-pill)', fontSize: 13, fontWeight: 600,
            border: '1px solid var(--c-sep)',
            background: 'var(--c-surface2)', color: 'var(--c-text2)', cursor: 'pointer',
          }}>Close</button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// §F — GOALS & MILESTONES  (spec §9 + §F-CANONICAL)
// §F-CANONICAL: only §F writes MILESTONE_DETECTED / DISMISSED / CELEBRATED.
// Wire onClick → commitPlan-style event helper through onCommit prop.
// MILESTONE_CELEBRATED: confetti burst (radial dots) on tap.
// ═══════════════════════════════════════════════════════════════════════════

function emitMilestoneEvent(entity, type, milestone, onCommit) {
  const envelope = {
    eventId: `${type}-${entity?.id || 'anon'}-${milestone?.milestoneId}-${Date.now()}`,
    type,
    ts: new Date().toISOString(),
    payload: {
      entityId: entity?.id || null,
      milestoneId: milestone?.milestoneId,
      label: milestone?.label,
    },
  }
  onCommit?.(envelope)
  return envelope
}

function SectionF({ entity, onCommit, onCreateGoal, onMilestoneTap }) {
  const goals   = entity?.goals ?? []
  const ms      = useMemo(() => calcMilestones(entity), [entity])
  const [dismissed, setDismissed]   = useState(() => new Set())
  const [celebrated, setCelebrated] = useState(() => new Set())
  const [confettiId, setConfettiId] = useState(null)

  const unacked = ms.achieved.filter(m =>
    !m.celebrated && !dismissed.has(m.milestoneId) && !celebrated.has(m.milestoneId)
  )

  function handleCelebrate(m) {
    setCelebrated(s => new Set(s).add(m.milestoneId))
    setConfettiId(m.milestoneId)
    // Clear confetti after animation completes (~1.1s — slowest dot ends at ~900+150ms delay)
    setTimeout(() => setConfettiId(prev => (prev === m.milestoneId ? null : prev)), 1200)
    emitMilestoneEvent(entity, 'MILESTONE_CELEBRATED', m, onCommit)
    emitMilestoneEvent(entity, 'MILESTONE_DISMISSED', m, onCommit)
  }
  function handleDismiss(m) {
    setDismissed(s => new Set(s).add(m.milestoneId))
    emitMilestoneEvent(entity, 'MILESTONE_DISMISSED', m, onCommit)
  }
  function handleProjectedTap(m) {
    emitMilestoneEvent(entity, 'MILESTONE_DETECTED', m, onCommit)
    onMilestoneTap?.(m)
  }

  return (
    <div style={card()}>
      <div style={{ ...LBL, marginBottom: 'var(--space-md)' }}>Goals & Milestones</div>

      {/* Pinned unacknowledged milestone (spec §9.5 + §F.X26.1).
          Confetti burst overlays this card on Celebrate. */}
      {unacked[0] && (
        <div style={{
          position: 'relative',
          padding: '12px 14px', borderRadius: 'var(--r-md)',
          marginBottom: 'var(--space-md)',
          background:'color-mix(in srgb, var(--c-success) 8%, transparent)',
          border: '1px solid color-mix(in srgb, var(--c-success) 25%, transparent)',
          overflow: 'visible',
        }}>
          <ConfettiBurst active={confettiId === unacked[0].milestoneId} />
          <div style={{
            fontSize: 13, fontWeight: 700, color: 'var(--c-success)', marginBottom: 2,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span className="sw-sparkle" aria-hidden="true">✨</span>
            Milestone reached: {unacked[0].label}
          </div>
          <div style={{ fontSize: 11, color: 'var(--c-text2)', marginBottom: 'var(--space-sm)' }}>
            Achieved {unacked[0].achievedAt?.substring(0, 10)}
            {unacked[0].synthetic ? ' (estimated from trajectory)' : ''}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => handleCelebrate(unacked[0])}
              className="sw-press"
              style={{
                flex: 1, padding: '7px 10px', borderRadius: 'var(--r-pill)',
                fontSize: 11, fontWeight: 700, border: 'none',
                background: 'var(--c-success)', color: 'var(--c-bg)', cursor: 'pointer',
              }}>
              Celebrate
            </button>
            <button
              onClick={() => handleDismiss(unacked[0])}
              className="sw-press"
              style={{
                padding: '7px 14px', borderRadius: 'var(--r-pill)',
                fontSize: 11, fontWeight: 600, border: '1px solid var(--c-sep)',
                background: 'transparent', color: 'var(--c-text3)', cursor: 'pointer',
              }}>
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Vertical milestones timeline — achieved (mint) above projected (amber outline) */}
      {(ms.achieved.length > 0 || ms.projected.length > 0) && (
        <div style={{ marginBottom: 'var(--space-md)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text3)', marginBottom: 'var(--space-sm)' }}>
            Milestone timeline
          </div>
          <RevealStagger interval={50}>
            {/* Achieved (most-recent first, capped at 3) */}
            {ms.achieved.slice(0, 3).map((m) => (
              <div
                key={`a-${m.milestoneId}`}
                onClick={() => onMilestoneTap?.(m)}
                className="sw-press"
                style={{
                  display: 'flex', gap: 'var(--space-sm)', padding: '6px 0', cursor: 'pointer',
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'var(--c-success)', color: 'var(--c-bg)',
                  fontSize: 12, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>✓</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text)' }}>
                    {m.label}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 1 }}>
                    Achieved {m.achievedAt?.substring(0, 10) || '—'}
                  </div>
                </div>
                <span className="sw-chip sw-chip-sm sw-chip-mint">Done</span>
              </div>
            ))}
            {/* Projected (next 3) */}
            {ms.projected.slice(0, 3).map((m) => (
              <div
                key={`p-${m.milestoneId}`}
                onClick={() => handleProjectedTap(m)}
                className="sw-press"
                style={{
                  display: 'flex', gap: 'var(--space-sm)', padding: '6px 0', cursor: 'pointer',
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'transparent',
                  border: '2px dashed var(--c-warning)', color: 'var(--c-warning)',
                  fontSize: 11, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>◌</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text)' }}>
                    {m.label}
                  </div>
                  {m.projectedAt && (
                    <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 1 }}>
                      ~{m.projectedAt?.substring(0, 7)}
                    </div>
                  )}
                  {m.progress > 0 && (
                    <div style={{ marginTop: 4 }}>
                      <ProgressBar progress={m.progress} colour="var(--c-warning)" />
                    </div>
                  )}
                </div>
                <span
                  className="sw-chip sw-chip-sm"
                  style={{
                    color: 'var(--c-warning)',
                    border: '1px solid color-mix(in srgb, var(--c-warning) 33%, transparent)',
                    background: 'transparent',
                  }}>
                  Projected
                </span>
              </div>
            ))}
          </RevealStagger>
        </div>
      )}

      {/* User goals (spec §9.3) or goal templates when none set (spec §9.4) */}
      <div style={{ borderTop: '1px solid var(--c-sep)', paddingTop: 'var(--space-md)' }}>
        {goals.length > 0 ? (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text3)', marginBottom: 'var(--space-sm)' }}>
              Your goals ({goals.length})
            </div>
            <RevealStagger interval={50}>
              {goals.map((g, i) => {
                const gp  = calcGoalProgress(g, entity)
                const pct = Math.round(gp.progress * 100)
                return (
                  <div key={g.goalId ?? i} style={{
                    padding: 'var(--space-sm) 0',
                    borderBottom: i < goals.length - 1 ? '1px solid var(--c-sep)' : 'none',
                  }}>
                    <div style={{
                      display:'flex', justifyContent:'space-between',
                      alignItems:'center', marginBottom: 4,
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text)' }}>
                        {g.label || g.goalId || 'Goal'}
                      </div>
                      <div style={{
                        fontSize: 11, fontWeight: 700,
                        color: pct >= 100 ? 'var(--c-success)' : 'var(--c-accent)',
                      }}>
                        {pct}%
                      </div>
                    </div>
                    <ProgressBar progress={gp.progress} />
                    {gp.projectedHitDate && (
                      <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 3 }}>
                        Projected: {gp.projectedHitDate?.substring(0,7)}
                        {gp.aheadOrBehind ? ` · ${gp.aheadOrBehind.replace('_behind', ' behind')}` : ''}
                      </div>
                    )}
                  </div>
                )
              })}
            </RevealStagger>
          </>
        ) : (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text3)', marginBottom: 'var(--space-sm)' }}>
              Goal templates — tap to set your first goal
            </div>
            <RevealStagger interval={45} style={{
              display:'grid', gridTemplateColumns:'1fr 1fr', gap: 6,
            }}>
              {GOAL_TEMPLATES.map(t => (
                <div
                  key={t.id}
                  onClick={() => onCreateGoal?.(t)}
                  className="sw-press sw-lift"
                  style={{
                    background: 'var(--c-surface2)',
                    borderRadius: 'var(--r-md)',
                    padding: '8px 10px', cursor: 'pointer',
                  }}>
                  <div style={{ fontSize: 14, marginBottom: 3 }}>{t.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text)' }}>{t.label}</div>
                </div>
              ))}
            </RevealStagger>
          </>
        )}
      </div>

      {/* Achieved milestone tally */}
      {ms.achieved.length > 0 && (
        <div style={{
          marginTop: 'var(--space-md)', fontSize: 11,
          color: 'var(--c-text3)', textAlign: 'center',
        }}>
          {ms.achieved.length} milestone{ms.achieved.length !== 1 ? 's' : ''} achieved
          {ms.achieved[0]?.label ? ` · most recent: ${ms.achieved[0].label}` : ''}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// L3 — Score History Drill Panel
// Full-screen overlay: wealth score trajectory + risk score trajectory,
// annotated with key events. Opened from the §B "Score journey" drill.
// ═══════════════════════════════════════════════════════════════════════════

function ScoreHistoryDrillPanel({ scoreJourneyData, entity, onClose }) {
  const [activeRange, setActiveRange] = useState('12mo')

  const ranges = [
    { id: '1mo',  label: '1m' },
    { id: '3mo',  label: '3m' },
    { id: '6mo',  label: '6m' },
    { id: '12mo', label: '12m' },
    { id: 'all-time', label: 'All' },
  ]

  const { fq, risk, hist, rHist, traj } = scoreJourneyData || {}
  const wPts = hist?.points || []
  const rPts = rHist?.points || []
  const wΔ = wPts.length > 1 ? wPts[wPts.length - 1].score - wPts[0].score : 0
  const rΔ = rPts.length > 1 ? rPts[rPts.length - 1].score - rPts[0].score : 0

  // Per-dimension breakdown from fq.dims
  const dims = fq?.dims ? Object.entries(fq.dims).map(([key, val]) => {
    const score = typeof val === 'object' ? (val.score ?? val.total ?? 0) : +val
    return { key, score }
  }).sort((a, b) => a.score - b.score) : []

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300, overflowY: 'auto',
      background: 'var(--c-bg)',
      animation: 'sh-slide-up .28s cubic-bezier(0.16,1,0.3,1)',
      padding: '0 0 120px',
    }}>
      <style>{`
        @keyframes sh-slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px 8px',
        borderBottom: '1px solid var(--c-sep)',
        position: 'sticky', top: 0,
        background: 'var(--c-bg)', zIndex: 10,
      }}>
        <button onClick={onClose} className="sw-press" style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--c-acc)', fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ fontSize: 16 }}>←</span> Back
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--c-text)' }}>
          Score trajectory
        </div>
        <div style={{ width: 56 }} />
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Hero — current scores */}
        <div style={{
          background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
          borderRadius: 18, padding: '14px 18px', marginBottom: 12,
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
        }}>
          <div>
            <div className="sw-eyebrow" style={{ marginBottom: 4 }}>Wealth Score</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.8,
              color: fq?.band?.colour || 'var(--c-acc)' }}>
              {Math.round(fq?.total ?? 0)}
            </div>
            <div style={{
              fontSize: 11, marginTop: 4,
              color: wΔ >= 0 ? 'var(--c-success)' : 'var(--c-danger)',
            }}>
              {wΔ >= 0 ? '+' : ''}{wΔ} pts in period
            </div>
          </div>
          <div>
            <div className="sw-eyebrow" style={{ marginBottom: 4 }}>Risk Score</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.8,
              color: risk?.band?.colour || 'var(--c-text2)' }}>
              {Math.round(risk?.total ?? 0)}
            </div>
            <div style={{
              fontSize: 11, marginTop: 4,
              color: rΔ <= 0 ? 'var(--c-success)' : 'var(--c-danger)',
            }}>
              {rΔ >= 0 ? '+' : ''}{rΔ} pts in period
            </div>
          </div>
        </div>

        {/* Range picker */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          {ranges.map(r => (
            <button
              key={r.id}
              onClick={() => setActiveRange(r.id)}
              className={['sw-chip', 'sw-chip-sm', 'sw-press', activeRange === r.id ? 'sw-chip-mint' : ''].filter(Boolean).join(' ')}
              style={{ cursor: 'pointer', flex: 1 }}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Wealth Score sparkline */}
        {wPts.length > 0 && (
          <div style={{
            background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
            borderRadius: 18, padding: '14px 18px', marginBottom: 12,
          }}>
            <div className="sw-eyebrow" style={{ marginBottom: 8 }}>
              Wealth Score · {hist?.confidence || 'estimated'} confidence
            </div>
            <ScoreSparkline points={wPts} colour="var(--c-acc)" />
            {hist?.confidence === 'LOW' && (
              <div style={{ fontSize: 10, color: 'var(--c-text3)', fontStyle: 'italic', marginTop: 6 }}>
                Synthesised — activates when real event log is live
              </div>
            )}
          </div>
        )}

        {/* Risk Score sparkline */}
        {rPts.length > 0 && (
          <div style={{
            background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
            borderRadius: 18, padding: '14px 18px', marginBottom: 12,
          }}>
            <div className="sw-eyebrow" style={{ marginBottom: 8 }}>
              Risk Score · {rHist?.confidence || 'estimated'} confidence
            </div>
            <ScoreSparkline points={rPts} colour="var(--c-acc2, #a78bfa)" />
          </div>
        )}

        {/* Per-dimension breakdown */}
        {dims.length > 0 && (
          <div style={{
            background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
            borderRadius: 18, padding: '14px 18px', marginBottom: 12,
          }}>
            <div className="sw-eyebrow" style={{ marginBottom: 12 }}>
              8 dimensions — weakest first
            </div>
            {dims.map(({ key, score }) => {
              const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim()
              const barColour = score >= 70 ? 'var(--c-success)' : score >= 40 ? 'var(--c-warning)' : 'var(--c-danger)'
              return (
                <div key={key} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--c-text2)' }}>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: barColour }}>{Math.round(score)}</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: 'var(--c-surface2)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      width: `${Math.max(2, Math.min(100, score))}%`,
                      background: barColour,
                      transition: 'width 900ms var(--ease-out-expo, cubic-bezier(0.16,1,0.3,1))',
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Action level bars from traj */}
        {traj?.length > 0 && (
          <div style={{
            background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
            borderRadius: 18, padding: '14px 18px', marginBottom: 12,
          }}>
            <div className="sw-eyebrow" style={{ marginBottom: 8 }}>Action levels</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 80 }}>
              {traj.map(t => {
                const h = Math.max(6, Math.round((t.score / 100) * 64))
                return (
                  <div key={t.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: t.colour }}>{t.score}</div>
                    <div style={{ width: '100%', height: h, background: t.colour, borderRadius: '3px 3px 0 0', opacity: 0.85 }} />
                    <div style={{ fontSize: 8, color: 'var(--c-text3)', textAlign: 'center', lineHeight: 1.2 }}>{t.label}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div style={{ fontSize: 11, color: 'var(--c-text3)', textAlign: 'center', lineHeight: 1.6, padding: '4px 0 12px' }}>
          Score history is a read-only mirror · D-SCORE-JOURNEY-1 · Not regulated advice
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// L3 — Milestone Drill Panel
// Full-screen panel for a single milestone: status, progress, forward hint.
// ═══════════════════════════════════════════════════════════════════════════

function MilestoneDrillPanel({ milestone, entity, onClose, onOpenGoalSeek }) {
  if (!milestone) return null

  const isAchieved  = milestone.achieved === true || milestone.status === 'achieved'
  const isAtRisk    = milestone.status === 'at-risk' || milestone.atRisk === true
  const status      = isAchieved ? 'Achieved' : isAtRisk ? 'At risk' : 'On track'
  const statusColor = isAchieved ? 'var(--c-success)' : isAtRisk ? 'var(--c-danger)' : 'var(--c-acc)'

  const progress = milestone.progress ?? null
  const pctNum   = progress != null ? Math.max(0, Math.min(100, Math.round(progress * 100))) : null
  const target   = milestone.targetValue ?? milestone.target ?? null
  const current  = milestone.currentValue ?? milestone.current ?? null

  // Forward hint — generic but honest; doesn't fabricate a specific £ figure
  // unless the milestone carries a numeric shortfall.
  const shortfall = (target != null && current != null) ? Math.max(0, +target - +current) : null
  const hint = isAchieved
    ? 'This milestone is already achieved. Keep on track to maintain it.'
    : shortfall != null && shortfall > 0
      ? `Closing the ${fmt(shortfall)} gap — for example by increasing monthly contributions — would bring this milestone closer.`
      : 'Continuing at your current pace is the clearest lever for this milestone. Use Goal Seek to model specific scenarios.'

  const targetDate = milestone.projectedAt || milestone.targetDate || milestone.horizonDate || null

  return (
    <div
      className="screen"
      style={{
        position: 'fixed', inset: 0, zIndex: 300, overflowY: 'auto',
        background: 'var(--c-bg)',
        animation: 'ms-slide-up .28s cubic-bezier(0.16,1,0.3,1)',
        padding: '0 0 120px',
      }}
    >
      <style>{`@keyframes ms-slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px 8px',
        borderBottom: '1px solid var(--c-sep)',
        position: 'sticky', top: 0,
        background: 'var(--c-bg)', zIndex: 10,
      }}>
        <button onClick={onClose} className="sw-press" style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--c-acc)', fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ fontSize: 16 }}>←</span> Back
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--c-text)' }}>
          Milestone detail
        </div>
        <div style={{ width: 56 }} />
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <div style={{
          background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
          borderRadius: 18, padding: '14px 18px', marginBottom: 12,
        }}>
          <div className="sw-eyebrow" style={{ marginBottom: 8 }}>{milestone.type || 'Milestone'}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--c-text)', letterSpacing: -0.3, marginBottom: 10 }}>
            {milestone.label}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{
              padding: '3px 10px', borderRadius: 100,
              background: isAchieved ? 'rgba(0,229,168,0.15)' : isAtRisk ? 'rgba(255,59,48,0.12)' : 'rgba(93,219,194,0.12)',
              border: `1px solid color-mix(in srgb, ${statusColor} 35%, transparent)`,
              fontSize: 11, fontWeight: 700, color: statusColor,
            }}>
              {status}
            </span>
            {targetDate && (
              <span style={{ fontSize: 12, color: 'var(--c-text3)' }}>
                {isAchieved ? 'Achieved' : 'Projected'} {targetDate.substring(0, 7)}
              </span>
            )}
          </div>

          {pctNum != null && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--c-text2)' }}>Progress</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: statusColor }}>{pctNum}%</span>
              </div>
              <div style={{ height: 7, borderRadius: 4, background: 'var(--c-surface2)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 4,
                  width: `${pctNum}%`,
                  background: statusColor,
                  transition: 'width 900ms var(--ease-out-expo, cubic-bezier(0.16,1,0.3,1))',
                }} />
              </div>
            </div>
          )}

          {(target != null || current != null) && (
            <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
              {current != null && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--c-text3)', marginBottom: 2 }}>Current</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>
                    {typeof current === 'number' ? fmt(current) : current}
                  </div>
                </div>
              )}
              {target != null && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--c-text3)', marginBottom: 2 }}>Target</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-acc)', fontVariantNumeric: 'tabular-nums' }}>
                    {typeof target === 'number' ? fmt(target) : target}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{
          background: 'var(--c-surface)', border: '1px solid rgba(93,219,194,0.3)',
          borderRadius: 18, padding: '14px 18px', marginBottom: 12,
        }}>
          <div className="sw-eyebrow" style={{ marginBottom: 8 }}>What would push this forward?</div>
          <div style={{ fontSize: 13, color: 'var(--c-text2)', lineHeight: 1.6 }}>
            {hint}
          </div>
          {!milestone.achieved && (
            <button
              onClick={() => { onClose?.(); onOpenGoalSeek?.(milestone.metric || 'wealthScore') }}
              className="sw-press"
              style={{
                marginTop: 14, width: '100%',
                padding: '10px 0', borderRadius: 'var(--r-pill)',
                fontSize: 13, fontWeight: 700,
                border: 'none', background: 'var(--c-acc)', color: 'var(--c-bg)',
                cursor: 'pointer',
              }}
            >
              Set a target →
            </button>
          )}
        </div>

        <div style={{ fontSize: 11, color: 'var(--c-text3)', textAlign: 'center', lineHeight: 1.6, padding: '4px 0 12px' }}>
          Projections are estimates · Not regulated advice · Engine models, not guarantees
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT — TimelineScreen
// Props: entity (persona JSON) · onNav (tab navigation callback)
//
// Pre-computes scoreJourneyData ONCE here (D-SCORE-JOURNEY-1 · spec §5.10)
// and passes it down to SectionB. SectionB does NOT call calcScoreHistory().
// ═══════════════════════════════════════════════════════════════════════════

export default function TimelineScreen({ entity, onNav, onDrillMetric }) {
  // calcFQ is canonical per Home v1.4 §Q1.2 — was calcFQCalibrated which drifted.
  const fq   = calcFQ(entity)
  const risk = calcRisk(entity)
  const nw   = netWorth(entity)

  // X28 temporal-view state — drives §B history range and §C horizon
  const [windowId, setWindowId] = useState('calendar-year')
  const [viewMode, setViewMode] = useState('actual')
  // §B range-picker override (1mo / 3mo / 6mo / 12mo)
  const [rangeOverride, setRangeOverride] = useState(null)

  // Plan-rows + scenarios computed ONCE here (shared by §F.1 headline + §E)
  const planRows  = useMemo(() => buildPlanRows(entity), [entity])
  const scenarios = useMemo(() => resolveScenarios(entity), [entity])

  // L3 drill panel — 'scoreHistory' opens ScoreHistoryDrillPanel
  const [drillView, setDrillView] = useState(null)

  // L3 milestone drill — set to a milestone object to open MilestoneDrillPanel
  const [activeMilestone, setActiveMilestone] = useState(null)

  // Lifted goal-seek sheet state — openable from §F.1 headline, §E top CTA, PlanRow Edit
  const [goalSeekOpen, setGoalSeekOpen]       = useState(false)
  const [goalSeekMetric, setGoalSeekMetric]   = useState('wealthScore')
  function openGoalSeek(metric) {
    if (metric) setGoalSeekMetric(metric)
    setGoalSeekOpen(true)
  }

  // Pre-compute scoreJourneyData ONCE (spec §5.10 — read-only mirror).
  const [scoreJourneyData, setScoreJourneyData] = useState(null)
  useEffect(() => {
    let cancelled = false
    let timeoutId = null

    timeoutId = setTimeout(() => {
      if (!cancelled && !scoreJourneyData) {
        setScoreJourneyData({ error: true })
      }
    }, 3000)

    Promise.resolve().then(() => {
      if (cancelled) return
      try {
        const range = rangeOverride || windowToHistoryRange(windowId)
        const traj  = fqTrajectory(entity)
        const hist  = calcScoreHistory(entity, range)
        const rHist = calcRiskHistory(entity, range)
        const plan  = planFor(entity, 'retirement')

        setScoreJourneyData({
          fq, risk, traj, hist, rHist, plan,
          viewMode, window: windowId, range,
        })
      } catch {
        setScoreJourneyData({ error: true })
      } finally {
        if (timeoutId) clearTimeout(timeoutId)
      }
    })

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, windowId, viewMode, rangeOverride])

  function handleCommit(evt) {
    if (typeof window !== 'undefined' && window?.console) {
      console.log('[Timeline] event committed:', evt.type, evt.payload || evt)
    }
  }

  function handleCreateGoal(template) {
    // 'goal-create' is not a valid tab — open GoalSeek with the template's plan type instead
    openGoalSeek(template?.template_id || 'wealthScore')
  }

  function handleRiskTap() {
    onNav?.('risk', { source: 'timeline-anchor' })
  }

  // L3 drill gate — renders before normal screen
  if (drillView === 'scoreHistory' && scoreJourneyData && !scoreJourneyData.error) {
    return <ScoreHistoryDrillPanel
      scoreJourneyData={scoreJourneyData}
      entity={entity}
      onClose={() => setDrillView(null)}
    />
  }
  if (activeMilestone) {
    return <MilestoneDrillPanel
      milestone={activeMilestone}
      entity={entity}
      onClose={() => setActiveMilestone(null)}
      onOpenGoalSeek={(metric) => { setActiveMilestone(null); openGoalSeek(metric) }}
    />
  }

  return (
    <>
      {/* X28 top-bar (spec §X28-TL §X28.1) — wired to §B + §C */}
      <X28TopBar
        window={windowId}
        viewMode={viewMode}
        onWindowChange={setWindowId}
        onViewModeChange={setViewMode}
        rulesVersion={TAX.ver || 'UK-2026.1'}
        dataDate={entity?.dataLastUpdated || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        showWindowRow={false}
      />

      {/* Z1 — Triple Anchor REMOVED 2026-05-28 (founder direction).
          The 3-up NW / Wealth Score / Risk Score grid duplicated the same
          metrics already shown in the Dashboard top-right anchor pills.
          Founder feedback: "why is this taking centre stage when its on
          the top right". Keep `nw`, `fq`, `risk` in scope above for the
          downstream sections that consume them; just don't render the
          duplicate hero here. The top-right pills remain authoritative.
          For `data-tieout="timeline.nw"`, the value still ties via the
          B harness through the top-right NW pill on this route. */}
      <div data-tieout="timeline.nw" data-tieout-raw={String(nw)} style={{ display: 'none' }} aria-hidden="true" />

      {/* Z1.5 — Sub-Anchor Strip (D-ANCHOR-2 · PRC/PCC stub O-FOUNDER-IP-01) */}
      <FadeInOnMount delay={120} style={{
        margin: '0 0 var(--space-sm)', padding: '8px 14px',
        borderTop: '1px solid var(--c-sep)', borderBottom: '1px solid var(--c-sep)',
        display:'flex', justifyContent:'space-between', alignItems:'center',
      }}>
        <span style={{ fontSize: 12, color: 'var(--c-text2)' }}>Capital Efficiency (PRC/PCC)</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text3)' }}>—</span>
        <span style={{ fontSize: 11, color: 'var(--c-text3)', fontStyle: 'italic' }}>
          Coming next
        </span>
      </FadeInOnMount>

      {/* X25 Purpose Statement (spec §1.9) */}
      <FadeInOnMount delay={180} style={{ padding: '4px 0 var(--space-md)', textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)', lineHeight: 1.4 }}>
          Where am I in my financial life — and where am I headed?
        </div>
        <div style={{ fontSize: 12, color: 'var(--c-text2)', marginTop: 2, lineHeight: 1.6 }}>
          See your life stage, your score over time, every deadline that matters,
          and everything you've committed to — in one scroll.
        </div>
      </FadeInOnMount>

      {/* §F.1 PLAN-FUNDED HEADLINE (CRIT 1.1 / 4.1 / 7.1)
           Above-the-fold answer to "Am I on track for my plan?" — within 5s. */}
      <PlanFundedHeadline
        entity={entity}
        planRows={planRows}
        onOpenGoalSeek={(metric) => openGoalSeek(metric)}
      />

      {/* SECTION ORDER (HIGH 4.2): per spec §2.7 → §A life-stage → §B score → §C calendar.
           Earlier code reversed this (calendar first); restored to spec ranking. */}

      {/* §A Life Stage (spec §4 · LIFETIME-anchored — base orientation) */}
      <SectionHeader
        letter="A"
        title="Life stage"
        purpose="Where you sit on the path"
        colour="var(--c-success)"
      />
      <SectionA entity={entity} />

      {/* §B Score Journey (spec §5 · D-SCORE-JOURNEY-1 read-only mirror) */}
      <SectionHeader
        letter="B"
        title="Score journey"
        purpose="Your Wealth + Risk scores over the selected window"
        colour="var(--c-accent)"
      />
      <div style={{ position: 'relative' }}>
        <SectionB
          scoreJourneyData={scoreJourneyData}
          onViewModeChange={setViewMode}
          rangeId={rangeOverride || windowToHistoryRange(windowId)}
          onRangeChange={setRangeOverride}
        />
        {/* L3 drill affordance — opens ScoreHistoryDrillPanel */}
        {scoreJourneyData && !scoreJourneyData.error && (
          <button
            onClick={() => setDrillView('scoreHistory')}
            className="sw-chip sw-chip-sm sw-press"
            style={{
              position: 'absolute', top: 14, right: 14,
              cursor: 'pointer', fontSize: 11, fontWeight: 700,
              background: 'var(--c-surface2)', border: '1px solid var(--c-sep)',
              color: 'var(--c-acc)', zIndex: 2,
            }}
          >
            Detail ›
          </button>
        )}
      </div>

      {/* §C Action Calendar (spec §6 · X28 window scopes horizon) */}
      <SectionHeader
        letter="C"
        title="What's coming and when"
        purpose="Statutory · personal · action — sorted by urgency"
        colour="var(--c-warning)"
      />
      <SectionC entity={entity} windowId={windowId} onNav={onNav} />

      {/* §D Decision Log (spec §7 · backward-only) */}
      <SectionHeader
        letter="D"
        title="Decision Log"
        purpose="Audit trail of every committed action"
        colour="var(--c-muted)"
      />
      <SectionD entity={entity} />

      {/* §E Scenario Library & Plan-Builder (spec §8 · goalSeek wired) */}
      <SectionHeader
        letter="E"
        title="Scenarios & Plans"
        purpose="8 plan types · saved scenarios · goal-seek"
        colour="var(--c-danger)"
      />
      <SectionE
        entity={entity}
        planRows={planRows}
        scenarios={scenarios}
        onOpenGoalSeek={(metric) => openGoalSeek(metric)}
        onEditGoalSeek={(planTypeId) => openGoalSeek(planTypeId)}
      />

      {/* §F Goals & Milestones (spec §9 · §F-CANONICAL · onCommit wired) */}
      <SectionHeader
        letter="F"
        title="Goals & Milestones"
        purpose="Achieved + projected — tap Celebrate to mark"
        colour="var(--c-success)"
      />
      <SectionF entity={entity} onCommit={handleCommit} onCreateGoal={handleCreateGoal} onMilestoneTap={setActiveMilestone} />

      {/* Lifted goal-seek sheet — openable from §F.1 headline, §E top CTA, PlanRow Edit */}
      <GoalSeekSheet
        entity={entity}
        open={goalSeekOpen}
        initialMetric={goalSeekMetric}
        onClose={() => setGoalSeekOpen(false)}
        onCommit={handleCommit}
      />

      {/* Disclaimer (spec §1.4 — FCA phrasing bank) */}
      <div style={{
        textAlign:'center', fontSize: 11, color: 'var(--c-text3)',
        padding: 'var(--space-md) var(--space-2xl) var(--space-sm)', lineHeight: 1.6,
      }}>
        Information and guidance only. Not personal advice. Sonuswealth models scenarios and
        surfaces statutory dates relevant to your position; final decisions and timing should
        be validated with a qualified FCA-authorised adviser before acting.
        <br />{TAX.ver} · Last verified: {entity?.dataLastUpdated || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
      </div>
      <div style={{ height: 78 }} />
    </>
  )
}
